/**
 * Express-server for Brystkreft Retningslinjegraver
 *
 * Pipeline: Patient Form → CQL (facts) → DMN tables (ALL decisions) → Treatment Builder → Display
 *
 * Persistens: SQLite (better-sqlite3) — transaksjonssikker, atomisk
 * Testkjøring: Asynkron (execFile) — blokkerer ikke serveren
 * Validering: validateDMNTable() kalles ved import og tabellendring
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import Database from 'better-sqlite3';
import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import { ALL_DECISION_TABLES } from '../src/dmn/decisionTables.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';
import { buildPatientBundle } from '../src/fhir/mCodeProfiles.js';
import { validateDMNTable, validateAllTables } from '../src/dmn/dmnValidator.js';
import { getThresholds, getThresholdValue, updateThreshold, resetThresholds, getAllThresholdDocs } from '../src/cql/clinicalThresholds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// CORS: sett ALLOWED_ORIGINS (kommaseparert) for å låse til spesifikke origins.
// Er den ikke satt, tillates alle origins (kun ment for lokal utvikling — den
// deploybare prod-flaten er den skrivebeskyttede Vercel-serverless-flaten).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Tillat verktøy uten origin (curl, samme-origin) og eksplisitt tillatte origins
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin ikke tillatt av CORS'));
  },
}));
app.use(express.json({ limit: '5mb' }));

// Kjøremodus: skrive-/testendepunkter er kun tilgjengelige lokalt (ikke i deploy).
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================
// SQLite-database — erstatter JSON-filer
// ============================================================

const DB_PATH = path.join(__dirname, 'cds-data.sqlite');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS custom_tables (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    table_id TEXT,
    table_name TEXT,
    description TEXT,
    changed_by TEXT DEFAULT 'admin-ui',
    details TEXT
  );
  CREATE TABLE IF NOT EXISTS algorithm_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    tables_data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS thresholds (
    key TEXT PRIMARY KEY,
    value REAL NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// ============================================================
// Persistence helpers (SQLite)
// ============================================================

function loadChangeLog() {
  const rows = db.prepare('SELECT * FROM change_log ORDER BY timestamp DESC LIMIT 500').all();
  return rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}

function addChangeLogEntry(tableId, tableName, description, changedBy, details) {
  const entry = {
    id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    table_id: tableId,
    table_name: tableName,
    description,
    changed_by: changedBy || 'admin-ui',
    details: details ? JSON.stringify(details) : null,
  };
  db.prepare('INSERT INTO change_log (id, timestamp, table_id, table_name, description, changed_by, details) VALUES (@id, @timestamp, @table_id, @table_name, @description, @changed_by, @details)').run(entry);
  // Cap at 500
  db.prepare('DELETE FROM change_log WHERE id NOT IN (SELECT id FROM change_log ORDER BY timestamp DESC LIMIT 500)').run();
  return { ...entry, tableId, tableName, changedBy: entry.changed_by };
}

function saveTables(tables) {
  const upsert = db.prepare('INSERT OR REPLACE INTO custom_tables (id, data, updated_at) VALUES (?, ?, ?)');
  const deleteAll = db.prepare('DELETE FROM custom_tables');
  const now = new Date().toISOString();
  db.transaction(() => {
    deleteAll.run();
    for (const [id, table] of Object.entries(tables)) {
      upsert.run(id, JSON.stringify(table), now);
    }
  })();
}

function loadCustomTablesFromDb() {
  const rows = db.prepare('SELECT id, data FROM custom_tables').all();
  const tables = {};
  for (const row of rows) {
    try { tables[row.id] = JSON.parse(row.data); } catch {}
  }
  return tables;
}

function loadAlgorithmSetsFromDb() {
  const rows = db.prepare('SELECT * FROM algorithm_sets').all();
  const sets = {};
  for (const row of rows) {
    try {
      sets[row.id] = { id: row.id, name: row.name, description: row.description, createdAt: row.created_at, tables: JSON.parse(row.tables_data) };
    } catch {}
  }
  return sets;
}

function loadCustomThresholds() {
  const rows = db.prepare('SELECT key, value FROM thresholds').all();
  for (const row of rows) {
    try { updateThreshold(row.key, row.value); } catch {}
  }
}

// ============================================================
// Rule modification detection
// ============================================================

function detectModifiedRules(table) {
  const defaultTable = ALL_DECISION_TABLES[table.id];
  if (!defaultTable) {
    table.hasModifiedRules = true;
    for (const rule of table.rules) rule.isModified = true;
    return table;
  }

  const defaultRuleMap = new Map(defaultTable.rules.map((r) => [r.id, r]));
  let hasModified = false;

  for (const rule of table.rules) {
    const defaultRule = defaultRuleMap.get(rule.id);
    if (!defaultRule) {
      rule.isModified = true;
      hasModified = true;
    } else {
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

  const currentRuleIds = new Set(table.rules.map((r) => r.id));
  const deletedRuleIds = defaultTable.rules.filter((r) => !currentRuleIds.has(r.id)).map((r) => r.id);
  if (deletedRuleIds.length > 0) {
    hasModified = true;
    table._deletedRuleIds = deletedRuleIds;
  }

  table.hasModifiedRules = hasModified;
  return table;
}

function diffRules(oldRule, newRule) {
  const changes = [];
  if (!oldRule) return [{ field: '*', type: 'added', detail: 'Ny regel lagt til' }];
  if (!newRule) return [{ field: '*', type: 'deleted', detail: 'Regel slettet' }];

  if (JSON.stringify(oldRule.conditions) !== JSON.stringify(newRule.conditions)) {
    changes.push({ field: 'conditions', type: 'changed', old: oldRule.conditions, new: newRule.conditions });
  }
  for (const key of new Set([...Object.keys(oldRule.outputs || {}), ...Object.keys(newRule.outputs || {})])) {
    if (JSON.stringify(oldRule.outputs?.[key]) !== JSON.stringify(newRule.outputs?.[key])) {
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
  const custom = loadCustomTablesFromDb();
  for (const [id, table] of Object.entries(custom)) {
    decisionTables[id] = table;
  }
  for (const id of Object.keys(decisionTables)) {
    detectModifiedRules(decisionTables[id]);
  }
}
loadTables();
loadCustomThresholds();

let algorithmSets = loadAlgorithmSetsFromDb();

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
});

// ============================================================
// Decision table administration
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

  // Valider tabellstruktur
  const validationErrors = validateDMNTable(updated);
  const criticalErrors = validationErrors.filter((e) => e.severity === 'error');
  if (criticalErrors.length > 0) {
    return res.status(400).json({ error: 'Tabell har valideringsfeil', validationErrors: criticalErrors });
  }

  const oldTable = decisionTables[id];
  const changedBy = req.headers['x-changed-by'] || 'admin-ui';
  updated.lastUpdated = new Date().toISOString();

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
    if (!newRuleMap.has(ruleId)) changeDescriptions.push(`Regel slettet: ${ruleId}`);
  }

  if (changeDescriptions.length > 0) {
    for (const desc of changeDescriptions) addChangeLogEntry(id, updated.name, desc, changedBy);
    if (!updated.changeLog) updated.changeLog = [];
    updated.changeLog.unshift({ timestamp: updated.lastUpdated, changedBy, description: changeDescriptions.join('; ') });
    if (updated.changeLog.length > 100) updated.changeLog = updated.changeLog.slice(0, 100);
  }

  decisionTables[id] = updated;
  detectModifiedRules(updated);
  saveTables(decisionTables);
  res.json({ message: 'Beslutningstabel oppdatert', table: updated, changes: changeDescriptions, validationWarnings: validationErrors.filter((e) => e.severity === 'warning') });
});

app.post('/api/decision-tables', (req, res) => {
  const table = req.body;
  if (!table.id || !table.name) return res.status(400).json({ error: 'Tabell må ha id og navn' });
  if (decisionTables[table.id]) return res.status(409).json({ error: 'Tabell med denne ID-en finnes allerede' });
  table.lastUpdated = new Date().toISOString();
  table.version = table.version || '1.0.0';
  decisionTables[table.id] = table;
  saveTables(decisionTables);
  res.json({ message: 'Ny beslutningstabel opprettet', table });
});

app.delete('/api/decision-tables/:id', (req, res) => {
  const id = req.params.id;
  if (!decisionTables[id]) return res.status(404).json({ error: 'Beslutningstabel ikke funnet' });
  if (ALL_DECISION_TABLES[id]) return res.status(403).json({ error: 'Kan ikke slette standardtabell — bruk tilbakestilling' });
  delete decisionTables[id];
  saveTables(decisionTables);
  res.json({ message: 'Beslutningstabel slettet' });
});

app.post('/api/decision-tables/reset', (req, res) => {
  const changedBy = req.headers?.['x-changed-by'] || 'admin-ui';
  addChangeLogEntry('*', 'Alle tabeller', 'Alle beslutningstabeller tilbakestilt til standard', changedBy);
  decisionTables = {};
  for (const [id, table] of Object.entries(ALL_DECISION_TABLES)) {
    decisionTables[id] = structuredClone(table);
  }
  db.prepare('DELETE FROM custom_tables').run();
  res.json({ message: 'Alle beslutningstabeller tilbakestilt' });
});

// ============================================================
// Change log & diff endpoints
// ============================================================

app.get('/api/change-log', (_req, res) => {
  res.json(loadChangeLog());
});

app.get('/api/change-log/:tableId', (req, res) => {
  const rows = db.prepare('SELECT * FROM change_log WHERE table_id = ? ORDER BY timestamp DESC LIMIT 100').all(req.params.tableId);
  res.json(rows.map((r) => ({ ...r, tableId: r.table_id, tableName: r.table_name, changedBy: r.changed_by, details: r.details ? JSON.parse(r.details) : null })));
});

app.get('/api/decision-tables/:id/diff', (req, res) => {
  const id = req.params.id;
  const current = decisionTables[id];
  const defaultTable = ALL_DECISION_TABLES[id];

  if (!current) return res.status(404).json({ error: 'Tabell ikke funnet' });
  if (!defaultTable) return res.json({ isCustomTable: true, message: 'Egendefinert tabell uten standardreferanse' });

  const diffs = [];
  const defaultRuleMap = new Map(defaultTable.rules.map((r) => [r.id, r]));
  const currentRuleMap = new Map(current.rules.map((r) => [r.id, r]));

  for (const [ruleId, currentRule] of currentRuleMap) {
    const defaultRule = defaultRuleMap.get(ruleId);
    const ruleDiffs = diffRules(defaultRule, currentRule);
    if (ruleDiffs.length > 0) {
      diffs.push({ ruleId, type: defaultRule ? 'modified' : 'added', changes: ruleDiffs, defaultRule: defaultRule || null, currentRule });
    }
  }
  for (const [ruleId, defaultRule] of defaultRuleMap) {
    if (!currentRuleMap.has(ruleId)) {
      diffs.push({ ruleId, type: 'deleted', changes: [{ field: '*', type: 'deleted', detail: 'Regel slettet' }], defaultRule, currentRule: null });
    }
  }

  res.json({ tableId: id, tableName: current.name, hasModifications: diffs.length > 0, totalDiffs: diffs.length, diffs });
});

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
    table.rules.push(structuredClone(defaultRule));
    addChangeLogEntry(id, table.name, `Regel ${ruleId} gjenopprettet fra standard`, changedBy);
  } else {
    table.rules[ruleIndex] = structuredClone(defaultRule);
    addChangeLogEntry(id, table.name, `Regel ${ruleId} tilbakestilt til standard`, changedBy);
  }

  table.lastUpdated = new Date().toISOString();
  detectModifiedRules(table);
  saveTables(decisionTables);
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
      title: 'Brystkreft Adjuvant Retningslinjegraver (NBCG)',
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

// ============================================================
// Algoritmeversjonering
// ============================================================

app.post('/api/algorithm-sets', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Navn er påkrevd' });
  const id = name.toLowerCase().replace(/[^a-zæøå0-9]+/g, '-').replace(/^-|-$/g, '');
  if (algorithmSets[id]) return res.status(409).json({ error: 'Et algoritmesett med dette navnet finnes allerede' });

  const set = { id, name, description: description || '', createdAt: new Date().toISOString(), tables: structuredClone(decisionTables) };
  algorithmSets[id] = set;
  db.prepare('INSERT INTO algorithm_sets (id, name, description, created_at, tables_data) VALUES (?, ?, ?, ?, ?)').run(id, name, description || '', set.createdAt, JSON.stringify(set.tables));
  res.json({ message: `Algoritmesett "${name}" lagret`, id });
});

app.get('/api/algorithm-sets', (_req, res) => {
  const summary = Object.values(algorithmSets).map((s) => ({
    id: s.id, name: s.name, description: s.description, createdAt: s.createdAt, tableCount: Object.keys(s.tables).length,
  }));
  res.json(summary);
});

app.get('/api/algorithm-sets/:id', (req, res) => {
  const set = algorithmSets[req.params.id];
  if (!set) return res.status(404).json({ error: 'Algoritmesett ikke funnet' });
  res.json(set);
});

app.post('/api/algorithm-sets/:id/activate', (req, res) => {
  const set = algorithmSets[req.params.id];
  if (!set) return res.status(404).json({ error: 'Algoritmesett ikke funnet' });
  const changedBy = req.headers['x-changed-by'] || 'admin-ui';
  addChangeLogEntry('*', 'Alle tabeller', `Algoritmesett "${set.name}" aktivert`, changedBy);
  decisionTables = structuredClone(set.tables);
  for (const id of Object.keys(decisionTables)) detectModifiedRules(decisionTables[id]);
  saveTables(decisionTables);
  res.json({ message: `Algoritmesett "${set.name}" aktivert`, tableCount: Object.keys(decisionTables).length });
});

app.delete('/api/algorithm-sets/:id', (req, res) => {
  const id = req.params.id;
  if (!algorithmSets[id]) return res.status(404).json({ error: 'Algoritmesett ikke funnet' });
  delete algorithmSets[id];
  db.prepare('DELETE FROM algorithm_sets WHERE id = ?').run(id);
  res.json({ message: 'Algoritmesett slettet' });
});

app.get('/api/algorithm-sets/compare/:idA/:idB', (req, res) => {
  const { idA, idB } = req.params;
  const setA = idA === 'current' ? { tables: decisionTables, name: 'Nåværende' } : algorithmSets[idA];
  const setB = idB === 'current' ? { tables: decisionTables, name: 'Nåværende' } : algorithmSets[idB];
  if (!setA) return res.status(404).json({ error: `Sett "${idA}" ikke funnet` });
  if (!setB) return res.status(404).json({ error: `Sett "${idB}" ikke funnet` });

  const differences = [];
  const allTableIds = new Set([...Object.keys(setA.tables), ...Object.keys(setB.tables)]);
  for (const tableId of allTableIds) {
    const tA = setA.tables[tableId];
    const tB = setB.tables[tableId];
    if (!tA) { differences.push({ tableId, type: 'only_in_b', tableName: tB?.name }); continue; }
    if (!tB) { differences.push({ tableId, type: 'only_in_a', tableName: tA?.name }); continue; }
    const ruleChanges = [];
    const ruleMapB = new Map(tB.rules.map((r) => [r.id, r]));
    for (const ruleA of tA.rules) {
      const ruleB = ruleMapB.get(ruleA.id);
      if (!ruleB) { ruleChanges.push({ ruleId: ruleA.id, type: 'only_in_a' }); continue; }
      if (JSON.stringify(ruleA.conditions) !== JSON.stringify(ruleB.conditions) ||
          JSON.stringify(ruleA.outputs) !== JSON.stringify(ruleB.outputs)) {
        ruleChanges.push({ ruleId: ruleA.id, type: 'changed' });
      }
    }
    for (const ruleB of tB.rules) {
      if (!tA.rules.find((r) => r.id === ruleB.id)) ruleChanges.push({ ruleId: ruleB.id, type: 'only_in_b' });
    }
    if (ruleChanges.length > 0) differences.push({ tableId, type: 'rules_differ', tableName: tA.name, ruleChanges });
  }
  res.json({ nameA: setA.name, nameB: setB.name, totalDifferences: differences.length, differences });
});

// ============================================================
// Eksport/import med validering
// ============================================================

app.get('/api/export/tables', (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="decision-tables.json"');
  res.json({ exportedAt: new Date().toISOString(), version: '1.0', tables: decisionTables });
});

app.post('/api/import/tables', (req, res) => {
  const { tables } = req.body;
  if (!tables || typeof tables !== 'object') return res.status(400).json({ error: 'Ugyldig import-format. Forventet { tables: {...} }' });

  // Valider alle tabeller FØR import
  const validation = validateAllTables(tables);
  const criticalErrors = validation.errors.filter((e) => e.severity === 'error');
  if (criticalErrors.length > 0) {
    return res.status(400).json({
      error: `Import avvist: ${criticalErrors.length} valideringsfeil funnet`,
      validationErrors: criticalErrors,
      warnings: validation.errors.filter((e) => e.severity === 'warning'),
    });
  }

  const changedBy = req.headers['x-changed-by'] || 'admin-ui';
  let importCount = 0;
  for (const [id, table] of Object.entries(tables)) {
    if (table && table.id && table.rules) {
      decisionTables[id] = table;
      detectModifiedRules(decisionTables[id]);
      importCount++;
    }
  }
  addChangeLogEntry('*', 'Import', `${importCount} tabeller importert`, changedBy);
  saveTables(decisionTables);
  res.json({
    message: `${importCount} tabeller importert`,
    importCount,
    warnings: validation.errors.filter((e) => e.severity === 'warning'),
  });
});

app.get('/api/modification-status', (_req, res) => {
  const modifiedTables = [];
  for (const [id, table] of Object.entries(decisionTables)) {
    if (table.hasModifiedRules) {
      modifiedTables.push({
        tableId: id,
        tableName: table.name,
        modifiedRuleCount: table.rules.filter((r) => r.isModified).length,
        lastChange: table.changeLog?.[0] || null,
      });
    }
  }
  res.json({ hasModifications: modifiedTables.length > 0, modifiedTables, totalModifiedTables: modifiedTables.length });
});

// ============================================================
// Kliniske terskelverdier — konfigurerbare via API
// ============================================================

app.get('/api/thresholds', (_req, res) => {
  res.json(getAllThresholdDocs());
});

app.put('/api/thresholds/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value == null || typeof value !== 'number') {
    return res.status(400).json({ error: 'value må være et tall' });
  }
  try {
    const updated = updateThreshold(key, value);
    db.prepare('INSERT OR REPLACE INTO thresholds (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, new Date().toISOString());
    addChangeLogEntry('thresholds', 'Terskelverdier', `Terskel "${key}" endret til ${value}`, req.headers['x-changed-by'] || 'admin-ui');
    res.json({ message: `Terskel "${key}" oppdatert`, threshold: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/thresholds/reset', (req, res) => {
  resetThresholds();
  db.prepare('DELETE FROM thresholds').run();
  addChangeLogEntry('thresholds', 'Terskelverdier', 'Alle terskelverdier tilbakestilt', req.headers['x-changed-by'] || 'admin-ui');
  res.json({ message: 'Alle terskelverdier tilbakestilt til standard', thresholds: getAllThresholdDocs() });
});

// ============================================================
// Testkjøring fra UI — ASYNKRON (blokkerer ikke serveren)
// ============================================================

let testRunning = false;
let lastTestTime = 0;
const TEST_COOLDOWN_MS = 10000; // 10 sekunder mellom kjøringer

app.post('/api/run-tests', (_req, res) => {
  // Sikkerhet: testkjøring shell-er ut og er kun tilgjengelig lokalt (ikke i deploy).
  if (IS_PRODUCTION) {
    return res.status(403).json({ error: 'Testkjøring er deaktivert i produksjonsmiljø.' });
  }
  // Rate limiting
  const now = Date.now();
  if (testRunning) {
    return res.status(429).json({ error: 'En testkjøring pågår allerede. Vent til den er ferdig.' });
  }
  if (now - lastTestTime < TEST_COOLDOWN_MS) {
    const waitSec = Math.ceil((TEST_COOLDOWN_MS - (now - lastTestTime)) / 1000);
    return res.status(429).json({ error: `Vennligst vent ${waitSec} sekunder før neste testkjøring.` });
  }

  testRunning = true;
  lastTestTime = now;

  execFile('npx', ['vitest', 'run', '--reporter=json'], {
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 5 * 1024 * 1024,
  }, (err, stdout, stderr) => {
    testRunning = false;
    const output = stdout || stderr || (err?.message ?? '');

    let jsonResult;
    try { jsonResult = JSON.parse(output); } catch { jsonResult = null; }

    if (jsonResult) {
      const testSuites = (jsonResult.testResults || []).map((suite) => ({
        file: suite.name?.replace(/^.*\/tests\//, 'tests/'),
        tests: (suite.assertionResults || []).map((t) => ({
          name: t.fullName || t.title,
          status: t.status,
          failureMessage: t.failureMessages?.[0] || null,
        })),
        passed: (suite.assertionResults || []).filter((t) => t.status === 'passed').length,
        failed: (suite.assertionResults || []).filter((t) => t.status === 'failed').length,
      }));

      const totalPassed = testSuites.reduce((s, f) => s + f.passed, 0);
      const totalFailed = testSuites.reduce((s, f) => s + f.failed, 0);

      res.json({
        success: totalFailed === 0,
        totalPassed,
        totalFailed,
        totalTests: totalPassed + totalFailed,
        testSuites,
        timestamp: new Date().toISOString(),
      });
    } else {
      const passed = (output.match(/(\d+) passed/) || [])[1] || '0';
      const failed = (output.match(/(\d+) failed/) || [])[1] || '0';
      res.json({
        success: !output.includes('FAIL') && !err,
        totalPassed: parseInt(passed),
        totalFailed: parseInt(failed),
        totalTests: parseInt(passed) + parseInt(failed),
        rawOutput: output.slice(0, 5000),
        timestamp: new Date().toISOString(),
      });
    }
  });
});

// ============================================================
// Production static file serving
// ============================================================

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/cds-services')) {
    return res.status(404).json({ error: 'Endepunkt ikke funnet' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// ============================================================
// Oppstart
// ============================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Brystkreft CDS-server kjører på port ${PORT} (SQLite: ${DB_PATH})`));

export default app;
