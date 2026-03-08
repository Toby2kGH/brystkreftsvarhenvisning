/**
 * Express-server for Brystkreft Beslutningsstøtte
 *
 * Endepunkter:
 * - POST /api/evaluate       - Evaluer pasientdata mot beslutningstabeller
 * - GET  /api/decision-tables - Hent beslutningstabeller (for redigering)
 * - PUT  /api/decision-tables/:id - Oppdater beslutningstabel
 * - GET  /cds-services       - CDS Hooks discovery
 * - POST /cds-services/cdk46 - CDS Hooks evaluering
 */

import express from 'express';
import cors from 'cors';
import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';
import { evaluateDecisionTable, formatRecommendation } from '../src/dmn/dmnEngine.js';
import { CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE } from '../src/dmn/decisionTables.js';
import { buildPatientBundle } from '../src/fhir/mCodeProfiles.js';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory kopi av beslutningstabeller (kliniker-redigerbare)
let decisionTables = {
  'cdk46-inhibitor-selection': structuredClone(CDK46_DECISION_TABLE),
  'endocrine-partner-selection': structuredClone(ENDOCRINE_PARTNER_TABLE),
};

// ============================================================
// Beslutningsstøtte-endepunkter
// ============================================================

/**
 * POST /api/evaluate
 * Motta pasientdata, kjør CQL → DMN pipeline, returner anbefaling
 */
app.post('/api/evaluate', (req, res) => {
  try {
    const clinicalData = req.body;

    // Valider input
    const validation = validateClinicalData(clinicalData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Manglende pasientdata',
        details: validation.errors,
      });
    }

    // Steg 1: CQL-evaluering (datahenting og beregning)
    const cqlOutput = evaluateCQL(clinicalData);

    // Steg 2: DMN-evaluering (beslutningslogikk)
    const table = decisionTables['cdk46-inhibitor-selection'];
    const dmnResult = evaluateDecisionTable(table, cqlOutput);
    const recommendation = formatRecommendation(dmnResult);

    // Steg 3: Bygg FHIR Bundle (for audit trail)
    const fhirBundle = buildPatientBundle({
      patientId: clinicalData.patientId || 'anonymous',
      ...clinicalData,
    });

    res.json({
      recommendation,
      cqlOutput,
      dmnResult: {
        tableId: dmnResult.tableId,
        matched: dmnResult.matched,
        matchedRules: dmnResult.matchedRules?.map((r) => ({
          ruleId: r.ruleId,
          description: r.description,
        })),
      },
      fhirBundle,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Evalueringsfeil:', err);
    res.status(500).json({ error: 'Intern feil ved evaluering', message: err.message });
  }
});

// ============================================================
// Beslutningstabel-administrasjon (for kliniker-redigering)
// ============================================================

/**
 * GET /api/decision-tables
 * Hent alle beslutningstabeller
 */
app.get('/api/decision-tables', (_req, res) => {
  res.json(Object.values(decisionTables));
});

/**
 * GET /api/decision-tables/:id
 * Hent én beslutningstabel
 */
app.get('/api/decision-tables/:id', (req, res) => {
  const table = decisionTables[req.params.id];
  if (!table) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  res.json(table);
});

/**
 * PUT /api/decision-tables/:id
 * Oppdater en beslutningstabel (kliniker-redigering)
 */
app.put('/api/decision-tables/:id', (req, res) => {
  const id = req.params.id;
  if (!decisionTables[id]) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });

  const updated = req.body;
  updated.lastUpdated = new Date().toISOString();
  decisionTables[id] = updated;

  res.json({ message: 'Beslutningstabel oppdatert', table: updated });
});

/**
 * POST /api/decision-tables/reset
 * Tilbakestill beslutningstabeller til standard
 */
app.post('/api/decision-tables/reset', (_req, res) => {
  decisionTables = {
    'cdk46-inhibitor-selection': structuredClone(CDK46_DECISION_TABLE),
    'endocrine-partner-selection': structuredClone(ENDOCRINE_PARTNER_TABLE),
  };
  res.json({ message: 'Beslutningstabeller tilbakestilt' });
});

// ============================================================
// CDS Hooks endepunkter
// ============================================================

/**
 * GET /cds-services
 * CDS Hooks Discovery - annonserer tilgjengelige tjenester
 */
app.get('/cds-services', (_req, res) => {
  res.json({
    services: [
      {
        hook: 'patient-view',
        id: 'cdk46-inhibitor-cds',
        title: 'CDK4/6-inhibitor Beslutningsstøtte for Brystkreft',
        description:
          'Gir anbefalinger for valg av CDK4/6-inhibitor ved HR+/HER2- metastatisk brystkreft basert på kliniske risikofaktorer',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          conditions: 'Condition?patient={{context.patientId}}&code=http://hl7.org/fhir/sid/icd-10-cm|C50',
          tumorMarkers:
            'Observation?patient={{context.patientId}}&code=http://loinc.org|85337-4,85339-0,85319-2,85329-1',
          ecog: 'Observation?patient={{context.patientId}}&code=http://loinc.org|89247-1&_sort=-date&_count=1',
        },
      },
    ],
  });
});

/**
 * POST /cds-services/cdk46-inhibitor-cds
 * CDS Hooks Service - evaluer og returner anbefalingskort
 */
app.post('/cds-services/cdk46-inhibitor-cds', (req, res) => {
  try {
    const { context, prefetch } = req.body;

    // Ekstraher kliniske data fra prefetch FHIR-ressurser
    const clinicalData = extractFromPrefetch(prefetch);
    const cqlOutput = evaluateCQL(clinicalData);
    const table = decisionTables['cdk46-inhibitor-selection'];
    const dmnResult = evaluateDecisionTable(table, cqlOutput);
    const rec = formatRecommendation(dmnResult);

    const cards = [];

    if (rec.recommendation && rec.recommendation !== 'INGEN') {
      cards.push({
        uuid: crypto.randomUUID?.() || Date.now().toString(),
        summary: `CDK4/6i anbefaling: ${rec.recommendation}`,
        detail: `${rec.rationale}\n\nKombinasjonspartner: ${rec.combinationPartner || 'Ikke spesifisert'}`,
        indicator: rec.confidence === 'high' ? 'info' : 'warning',
        source: {
          label: 'Brystkreft CDK4/6i CDS',
          url: 'https://nbcg.no',
        },
        suggestions: rec.warnings.map((w) => ({
          label: w,
          uuid: crypto.randomUUID?.() || Date.now().toString(),
        })),
      });
    }

    res.json({ cards });
  } catch (err) {
    console.error('CDS Hooks feil:', err);
    res.json({ cards: [] });
  }
});

/**
 * Ekstraher kliniske data fra FHIR prefetch-ressurser
 */
function extractFromPrefetch(prefetch) {
  const data = {
    erStatus: null,
    prStatus: null,
    her2Status: null,
    ki67: null,
    ecogScore: null,
    metastatic: null,
  };

  if (prefetch?.tumorMarkers?.entry) {
    for (const entry of prefetch.tumorMarkers.entry) {
      const obs = entry.resource;
      const code = obs?.code?.coding?.[0]?.code;
      const isPositive = obs?.valueCodeableConcept?.coding?.[0]?.code === '10828004';

      if (code === '85337-4') data.erStatus = isPositive ? 'positive' : 'negative';
      if (code === '85339-0') data.prStatus = isPositive ? 'positive' : 'negative';
      if (code === '85319-2') data.her2Status = isPositive ? 'positive' : 'negative';
      if (code === '85329-1') data.ki67 = obs?.valueQuantity?.value;
    }
  }

  if (prefetch?.ecog?.entry?.[0]) {
    data.ecogScore = prefetch.ecog.entry[0].resource?.valueInteger;
  }

  return data;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Brystkreft CDS-server kjører på port ${PORT}`);
});

export default app;
