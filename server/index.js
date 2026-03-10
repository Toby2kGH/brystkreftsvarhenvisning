/**
 * Express-server for Brystkreft Beslutningsstøtte
 *
 * Pipeline: Patient Form → CQL (facts) → DMN tables (ALL decisions) → Treatment Builder → Display
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import { ALL_DECISION_TABLES } from '../src/dmn/decisionTables.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';
import { buildPatientBundle } from '../src/fhir/mCodeProfiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CUSTOM_TABLES_PATH = path.join(__dirname, 'custom-tables.json');
const CHANGE_LOG_PATH = path.join(__dirname, 'change-log.json');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// Change log persistence
// ============================================================

let changeLog = [];
function loadChangeLog() {
  if (fs.existsSync(CHANGE_LOG_PATH)) {
    try {
      changeLog = JSON.parse(fs.readFileSync(CHANGE_LOG_PATH, 'utf-8'));
    } catch (err) {
      console.warn('Kunne ikke laste change-log.json:', err.message);
      changeLog = [];
    }
  }
}
loadChangeLog();

function saveChangeLog() {
  try {
    fs.writeFileSync(CHANGE_LOG_PATH, JSON.stringify(changeLog, null, 2), 'utf-8');
  } catch (err) {
    console.error('Kunne ikke lagre change-log.json:', err.message);
  }
}

function addChangeLogEntry(tableId, tableName, description, changedBy, details) {
  const entry = {
    id: `CL-${Date.now()}`,
    timestamp: new Date().toISOString(),
    tableId,
    tableName,
    description,
    changedBy: changedBy || 'admin-ui',
    details: details || null,
  };
  changeLog.unshift(entry); // newest first
  if (changeLog.length > 500) changeLog = changeLog.slice(0, 500); // cap at 500
  saveChangeLog();
  return entry;
}

// ============================================================
// Rule modification detection
// ============================================================

/**
 * Compare a table's rules against the default (original) rules.
 * Returns the table with isModified flags set on changed rules,
 * and hasModifiedRules on the table itself.
 */
function detectModifiedRules(table) {
  const defaultTable = ALL_DECISION_TABLES[table.id];
  if (!defaultTable) {
    // Custom table — all rules are "new"
    table.hasModifiedRules = true;
    for (const rule of table.rules) {
      rule.isModified = true;
    }
    return table;
  }

  const defaultRuleMap = new Map(defaultTable.rules.map((r) => [r.id, r]));
  let hasModified = false;

  for (const rule of table.rules) {
    const defaultRule = defaultRuleMap.get(rule.id);
    if (!defaultRule) {
      // New rule added via admin UI
      rule.isModified = true;
      hasModified = true;
    } else {
      // Compare conditions and outputs
      const condChanged = JSON.stringify(rule.conditions) !== JSON.stringify(defaultRule.conditions);
      const outChanged = JSON.stringify(rule.outputs) !== JSON.stringify(defaultRule.outputs);
      if (condChanged || outChanged) {
        rule.isModified = true;
        hasModified = true;
      } else {
        rule.isModified = false;
      }
    }
  }

  // Check for deleted rules
  const currentRuleIds = new Set(table.rules.map((r) => r.id));
  const deletedRuleIds = defaultTable.rules.filter((r) => !currentRuleIds.has(r.id)).map((r) => r.id);
  if (deletedRuleIds.length > 0) {
    hasModified = true;
    table._deletedRuleIds = deletedRuleIds;
  }

  table.hasModifiedRules = hasModified;
  return table;
}

/**
 * Build a diff between two rule versions.
 */
function diffRules(oldRule, newRule) {
  const changes = [];
  if (!oldRule) return [{ field: '*', type: 'added', detail: 'Ny regel lagt til' }];
  if (!newRule) return [{ field: '*', type: 'deleted', detail: 'Regel slettet' }];

  // Compare conditions
  const oldConds = JSON.stringify(oldRule.conditions);
  const newConds = JSON.stringify(newRule.conditions);
  if (oldConds !== newConds) {
    changes.push({ field: 'conditions', type: 'changed', old: oldRule.conditions, new: newRule.conditions });
  }

  // Compare outputs
  for (const key of new Set([...Object.keys(oldRule.outputs || {}), ...Object.keys(newRule.outputs || {})])) {
    const oldVal = JSON.stringify(oldRule.outputs?.[key]);
    const newVal = JSON.stringify(newRule.outputs?.[key]);
    if (oldVal !== newVal) {
      changes.push({ field: `outputs.${key}`, type: 'changed', old: oldRule.outputs?.[key], new: newRule.outputs?.[key] });
    }
  }

  return changes;
}

// ============================================================
// Table loading with modification detection
// ============================================================

let decisionTables = {};
function loadTables() {
  decisionTables = {};
  for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
    decisionTables[id] = structuredClone(table);
  }
  // Overlay persisted custom tables
  if (fs.existsSync(CUSTOM_TABLES_PATH)) {
    try {
      const custom = JSON.parse(fs.readFileSync(CUSTOM_TABLES_PATH, 'utf-8'));
      for (const [id, table] of Object.entries(custom)) {
        decisionTables[id] = table;
      }
    } catch (err) {
      console.warn('Kunne ikke laste custom-tables.json:', err.message);
    }
  }
  // Detect modified rules across all tables
  for (const id of Object.keys(decisionTables)) {
    detectModifiedRules(decisionTables[id]);
  }
}
loadTables();

function saveTables() {
  try {
    fs.writeFileSync(CUSTOM_TABLES_PATH, JSON.stringify(decisionTables, null, 2), 'utf-8');
  } catch (err) {
    console.error('Kunne ikke lagre custom-tables.json:', err.message);
  }
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
  const oldTable = decisionTables[id];
  const updated = req.body;
  const changedBy = req.headers['x-changed-by'] || 'admin-ui';
  updated.lastUpdated = new Date().toISOString();

  // Detect rule-level changes and log them
  const oldRuleMap = new Map(oldTable.rules.map((r) => [r.id, r]));
  const newRuleMap = new Map(updated.rules.map((r) => [r.id, r]));
  const changeDescriptions = [];

  for (const [ruleId, newRule] of newRuleMap) {
    const oldRule = oldRuleMap.get(ruleId);
    if (!oldRule) {
      changeDescriptions.push(`Ny regel lagt til: ${ruleId}`);
      newRule.isModified = true;
      newRule.lastModifiedAt = updated.lastUpdated;
      newRule.lastModifiedBy = changedBy;
    } else {
      const diffs = diffRules(oldRule, newRule);
      if (diffs.length > 0) {
        changeDescriptions.push(`Regel ${ruleId} endret: ${diffs.map((d) => d.field).join(', ')}`);
        newRule.isModified = true;
        newRule.lastModifiedAt = updated.lastUpdated;
        newRule.lastModifiedBy = changedBy;
      }
    }
  }

  for (const ruleId of oldRuleMap.keys()) {
    if (!newRuleMap.has(ruleId)) {
      changeDescriptions.push(`Regel slettet: ${ruleId}`);
    }
  }

  // Log all changes
  if (changeDescriptions.length > 0) {
    for (const desc of changeDescriptions) {
      addChangeLogEntry(id, updated.name, desc, changedBy);
    }
    // Also add to table's own changeLog
    if (!updated.changeLog) updated.changeLog = [];
    updated.changeLog.unshift({
      timestamp: updated.lastUpdated,
      changedBy,
      description: changeDescriptions.join('; '),
    });
    if (updated.changeLog.length > 100) updated.changeLog = updated.changeLog.slice(0, 100);
  }

  decisionTables[id] = updated;
  detectModifiedRules(updated);
  saveTables();
  res.json({ message: 'Beslutningstabel oppdatert', table: updated, changes: changeDescriptions });
});

// Create a new custom table
app.post('/api/decision-tables', (req, res) => {
  const table = req.body;
  if (!table.id || !table.name) return res.status(400).json({ error: 'Tabell må ha id og navn' });
  if (decisionTables[table.id]) return res.status(409).json({ error: 'Tabell med denne ID-en finnes allerede' });
  table.lastUpdated = new Date().toISOString();
  table.version = table.version || '1.0.0';
  decisionTables[table.id] = table;
  saveTables();
  res.json({ message: 'Ny beslutningstabel opprettet', table });
});

// Delete a custom table (only non-default)
app.delete('/api/decision-tables/:id', (req, res) => {
  const id = req.params.id;
  if (!decisionTables[id]) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  if (ALL_DECISION_TABLES[id]) return res.status(403).json({ error: 'Kan ikke slette standardtabell — bruk tilbakestilling' });
  delete decisionTables[id];
  saveTables();
  res.json({ message: 'Beslutningstabel slettet' });
});

app.post('/api/decision-tables/reset', (_req, res) => {
  const changedBy = _req?.headers?.['x-changed-by'] || 'admin-ui';
  addChangeLogEntry('*', 'Alle tabeller', 'Alle beslutningstabeller tilbakestilt til standard', changedBy);
  decisionTables = {};
  for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
    decisionTables[id] = structuredClone(table);
  }
  // Remove custom tables file
  try { fs.unlinkSync(CUSTOM_TABLES_PATH); } catch {}
  res.json({ message: 'Alle beslutningstabeller tilbakestilt' });
});

// ============================================================
// Change log & diff endpoints
// ============================================================

// Get full change log (newest first)
app.get('/api/change-log', (_req, res) => {
  res.json(changeLog);
});

// Get change log for a specific table
app.get('/api/change-log/:tableId', (req, res) => {
  const filtered = changeLog.filter((e) => e.tableId === req.params.tableId);
  res.json(filtered);
});

// Get diff: compare current table against default
app.get('/api/decision-tables/:id/diff', (req, res) => {
  const id = req.params.id;
  const current = decisionTables[id];
  const defaultTable = ALL_DECISION_TABLES[id];

  if (!current) return res.status(404).json({ error: 'Tabell ikke funnet' });
  if (!defaultTable) return res.json({ isCustomTable: true, message: 'Egendefinert tabell uten standardreferanse' });

  const diffs = [];
  const defaultRuleMap = new Map(defaultTable.rules.map((r) => [r.id, r]));
  const currentRuleMap = new Map(current.rules.map((r) => [r.id, r]));

  // Modified or new rules
  for (const [ruleId, currentRule] of currentRuleMap) {
    const defaultRule = defaultRuleMap.get(ruleId);
    const ruleDiffs = diffRules(defaultRule, currentRule);
    if (ruleDiffs.length > 0) {
      diffs.push({ ruleId, type: defaultRule ? 'modified' : 'added', changes: ruleDiffs, defaultRule: defaultRule || null, currentRule });
    }
  }

  // Deleted rules
  for (const [ruleId, defaultRule] of defaultRuleMap) {
    if (!currentRuleMap.has(ruleId)) {
      diffs.push({ ruleId, type: 'deleted', changes: [{ field: '*', type: 'deleted', detail: 'Regel slettet' }], defaultRule, currentRule: null });
    }
  }

  res.json({
    tableId: id,
    tableName: current.name,
    hasModifications: diffs.length > 0,
    totalDiffs: diffs.length,
    diffs,
  });
});

// Revert a specific rule to its default version
app.post('/api/decision-tables/:id/revert-rule/:ruleId', (req, res) => {
  const { id, ruleId } = req.params;
  const table = decisionTables[id];
  const defaultTable = ALL_DECISION_TABLES[id];

  if (!table) return res.status(404).json({ error: 'Tabell ikke funnet' });
  if (!defaultTable) return res.status(400).json({ error: 'Ingen standardtabell å tilbakestille til' });

  const defaultRule = defaultTable.rules.find((r) => r.id === ruleId);
  if (!defaultRule) return res.status(404).json({ error: 'Regel ikke funnet i standardtabell' });

  const changedBy = req.headers['x-changed-by'] || 'admin-ui';
  const ruleIndex = table.rules.findIndex((r) => r.id === ruleId);

  if (ruleIndex === -1) {
    // Rule was deleted — restore it
    table.rules.push(structuredClone(defaultRule));
    addChangeLogEntry(id, table.name, `Regel ${ruleId} gjenopprettet fra standard`, changedBy);
  } else {
    table.rules[ruleIndex] = structuredClone(defaultRule);
    addChangeLogEntry(id, table.name, `Regel ${ruleId} tilbakestilt til standard`, changedBy);
  }

  table.lastUpdated = new Date().toISOString();
  detectModifiedRules(table);
  saveTables();
  res.json({ message: `Regel ${ruleId} tilbakestilt`, table });
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
