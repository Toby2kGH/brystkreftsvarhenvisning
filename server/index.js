/**
 * Express-server for Brystkreft Beslutningsstøtte
 *
 * Pipeline: Patient Form → CQL (facts) → DMN tables (ALL decisions) → Treatment Builder → Display
 */

import express from 'express';
import cors from 'cors';
import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import { ALL_DECISION_TABLES } from '../src/dmn/decisionTables.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';
import { buildPatientBundle } from '../src/fhir/mCodeProfiles.js';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory editable copies of all decision tables
let decisionTables = {};
for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
  decisionTables[id] = structuredClone(table);
}

// ============================================================
// Main evaluation endpoint
// ============================================================

app.post('/api/evaluate', (req, res) => {
  try {
    const clinicalData = req.body;
    const validation = validateClinicalData(clinicalData);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Manglende pasientdata', details: validation.errors });
    }

    // CQL: derive facts
    const cqlOutput = evaluateCQL(clinicalData);

    // Treatment builder uses DMN tables for ALL decisions
    const treatmentPlan = buildTreatmentPlan(cqlOutput, decisionTables);

    // Generate texts
    const journalText = buildJournalText(cqlOutput, treatmentPlan);
    const referralText = cqlOutput.isNeoadjuvant ? buildReferralText(cqlOutput) : null;

    // FHIR Bundle (audit)
    const fhirBundle = buildPatientBundle({
      patientId: clinicalData.patientId || 'anonymous',
      ...clinicalData,
    });

    res.json({
      treatmentPlan,
      cqlOutput,
      dmnResults: treatmentPlan.dmnResults,
      journalText,
      referralText,
      fhirBundle,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Evalueringsfeil:', err);
    res.status(500).json({ error: 'Intern feil ved evaluering', message: err.message });
  }
});

// ============================================================
// Decision table administration (all tables visible/editable)
// ============================================================

app.get('/api/decision-tables', (_req, res) => {
  res.json(Object.values(decisionTables));
});

app.get('/api/decision-tables/:id', (req, res) => {
  const table = decisionTables[req.params.id];
  if (!table) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  res.json(table);
});

app.put('/api/decision-tables/:id', (req, res) => {
  const id = req.params.id;
  if (!decisionTables[id]) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  const updated = req.body;
  updated.lastUpdated = new Date().toISOString();
  decisionTables[id] = updated;
  res.json({ message: 'Beslutningstabel oppdatert', table: updated });
});

app.post('/api/decision-tables/reset', (_req, res) => {
  decisionTables = {};
  for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
    decisionTables[id] = structuredClone(table);
  }
  res.json({ message: 'Alle beslutningstabeller tilbakestilt' });
});

// ============================================================
// CDS Hooks
// ============================================================

app.get('/cds-services', (_req, res) => {
  res.json({
    services: [{
      hook: 'patient-view',
      id: 'breast-cancer-adjuvant-cds',
      title: 'Brystkreft Adjuvant Beslutningsstøtte (NBCG)',
      description: 'Behandlingsanbefalinger for adjuvant brystkreft basert på NBCG Handlingsprogram',
      prefetch: {
        patient: 'Patient/{{context.patientId}}',
        conditions: 'Condition?patient={{context.patientId}}&code=http://hl7.org/fhir/sid/icd-10-cm|C50',
        tumorMarkers: 'Observation?patient={{context.patientId}}&code=http://loinc.org|85337-4,85339-0,85319-2,85329-1',
        ecog: 'Observation?patient={{context.patientId}}&code=http://loinc.org|89247-1&_sort=-date&_count=1',
      },
    }],
  });
});

app.post('/cds-services/breast-cancer-adjuvant-cds', (req, res) => {
  try {
    const { context, prefetch } = req.body;
    const clinicalData = extractFromPrefetch(prefetch, context);
    const cqlOutput = evaluateCQL(clinicalData);
    const treatmentPlan = buildTreatmentPlan(cqlOutput, decisionTables);

    const cards = [];
    if (treatmentPlan.steps.length > 0) {
      cards.push({
        uuid: crypto.randomUUID?.() || Date.now().toString(),
        summary: `Behandlingsplan (${treatmentPlan.bioGroup}): ${treatmentPlan.steps.map((s) => s.name).join(', ')}`,
        detail: buildJournalText(cqlOutput, treatmentPlan),
        indicator: 'info',
        source: { label: 'Brystkreft CDS (NBCG)', url: 'https://nbcg.no' },
        suggestions: treatmentPlan.warnings.map((w) => ({ label: w, uuid: crypto.randomUUID?.() || Date.now().toString() })),
      });
    }
    res.json({ cards });
  } catch (err) {
    console.error('CDS Hooks feil:', err);
    res.json({ cards: [] });
  }
});

function extractFromPrefetch(prefetch, context = {}) {
  const data = {
    erStatus: null, prStatus: null, her2ihc: null, her2sish: null, ki67: null,
    nStage: context.nStage || 'N0', tumorSizeMm: context.tumorSizeMm || null,
    grade: context.grade || null, menopausalStatus: context.menopausalStatus || 'unknown',
    treatmentMode: context.treatmentMode || 'adjuvant', surgeryType: context.surgeryType || null,
    geneTest: context.geneTest || 'none', rorScore: context.rorScore || null, rsScore: context.rsScore || null,
  };

  if (prefetch?.tumorMarkers?.entry) {
    for (const entry of prefetch.tumorMarkers.entry) {
      const obs = entry.resource;
      const code = obs?.code?.coding?.[0]?.code;
      const isPositive = obs?.valueCodeableConcept?.coding?.[0]?.code === '10828004';
      if (code === '85337-4') data.erStatus = isPositive ? 'positive' : 'negative';
      if (code === '85339-0') data.prStatus = isPositive ? 'positive' : 'negative';
      if (code === '85319-2') { const display = obs?.valueCodeableConcept?.coding?.[0]?.display; if (display) data.her2ihc = display; }
      if (code === '85329-1') data.ki67 = obs?.valueQuantity?.value;
    }
  }
  if (prefetch?.ecog?.entry?.[0]) data.ecogScore = prefetch.ecog.entry[0].resource?.valueInteger;
  return data;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Brystkreft CDS-server kjører på port ${PORT}`));

export default app;
