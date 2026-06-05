import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';
import { buildPatientBundle } from '../src/fhir/mCodeProfiles.js';
import { ALL_DECISION_TABLES } from '../src/dmn/decisionTables.js';

const decisionTables = {};
for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
  decisionTables[id] = structuredClone(table);
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clinicalData = req.body;
    const validation = validateClinicalData(clinicalData);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Manglende pasientdata', details: validation.errors });
    }

    const cqlOutput = evaluateCQL(clinicalData);
    const treatmentPlan = buildTreatmentPlan(cqlOutput, decisionTables);
    const journalText = buildJournalText(cqlOutput, treatmentPlan);
    const referralText = cqlOutput.isNeoadjuvant ? buildReferralText(cqlOutput) : null;

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
}
