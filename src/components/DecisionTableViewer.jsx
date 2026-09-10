import React, { useState, useEffect } from 'react';

// All CQL output parameters available for conditions
const CQL_PARAMETERS = [
  { id: 'erPercent', label: 'ER (%)', type: 'number' },
  { id: 'prPercent', label: 'PR (%)', type: 'number' },
  { id: 'erPositive', label: 'ER-positiv', type: 'boolean' },
  { id: 'prPositive', label: 'PR-positiv', type: 'boolean' },
  { id: 'hrPositive', label: 'HR-positiv', type: 'boolean' },
  { id: 'her2Positive', label: 'HER2-positiv', type: 'boolean' },
  { id: 'her2Negative', label: 'HER2-negativ', type: 'boolean' },
  { id: 'her2ihc', label: 'HER2 IHC', type: 'enum', values: ['0', '1+', '2+', '3+'] },
  { id: 'her2sish', label: 'HER2 SISH', type: 'enum', values: ['positive', 'negative'] },
  { id: 'her2Status', label: 'HER2-status', type: 'enum', values: ['positive', 'negative', 'equivocal', 'unknown'] },
  { id: 'bioGroup', label: 'Biologisk gruppe', type: 'enum', values: ['HR+HER2-', 'HR+HER2+', 'HR-HER2+', 'TN', 'unknown'] },
  { id: 'luminalSubtype', label: 'Luminal subtype', type: 'enum', values: ['A-like', 'B-like', 'unknown'] },
  { id: 'tStage', label: 'T-stadium (detaljert)', type: 'enum', values: ['T1a', 'T1b', 'T1c', 'T2', 'T3', 'T4'] },
  { id: 'tSimple', label: 'T-stadium (forenklet)', type: 'enum', values: ['T1', 'T2', 'T3', 'T4'] },
  { id: 'nStage', label: 'N-stadium', type: 'enum', values: ['N0', 'N1mi', 'N1', 'N2', 'N3'] },
  { id: 'stadium', label: 'Stadium', type: 'enum', values: ['I', 'IIA', 'IIB', 'IIIA', 'IIIB', 'IIIC'] },
  { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  { id: 'grade', label: 'Histologisk grad', type: 'enum', values: [1, 2, 3] },
  { id: 'ki67Value', label: 'Ki-67 (%)', type: 'number' },
  { id: 'geneTest', label: 'Genekspresjonstest', type: 'enum', values: ['prosigna', 'oncotypedx', 'none'] },
  { id: 'geneTestDone', label: 'Gentest utført', type: 'boolean' },
  { id: 'rorScore', label: 'Prosigna ROR-score', type: 'number' },
  { id: 'rsScore', label: 'OncotypeDX RS-score', type: 'number' },
  { id: 'prosignaSubtype', label: 'PAM50 subtype', type: 'enum', values: ['lumA', 'lumB'] },
  { id: 'gesHighRisk', label: 'GES høyrisiko', type: 'boolean' },
  { id: 'gesLowRisk', label: 'GES lavrisiko', type: 'boolean' },
  { id: 'age', label: 'Alder', type: 'number' },
  { id: 'menopausalStatus', label: 'Menopausal status', type: 'enum', values: ['pre', 'peri', 'post', 'unknown'] },
  { id: 'surgeryType', label: 'Kirurgitype', type: 'enum', values: ['bcs', 'mastectomy'] },
  { id: 'ecogScore', label: 'ECOG-score', type: 'number' },
  { id: 'isNeoadjuvant', label: 'Neoadjuvant', type: 'boolean' },
  { id: 'isHighRisk', label: 'Høyrisiko', type: 'boolean' },
  { id: 'cdk46eligible', label: 'CDK4/6-kandidat', type: 'boolean' },
  { id: 'hasSystemicTherapy', label: 'Systemisk behandling', type: 'boolean' },
  { id: 'hasOFS', label: 'OFS (ovariefunksjonssuppresjon)', type: 'boolean' },
  { id: 'cardiacRisk', label: 'Kardial risiko', type: 'enum', values: ['low', 'moderate', 'high'] },
  { id: 'renalFunction', label: 'Nyrefunksjon', type: 'enum', values: ['normal', 'reduced', 'severe'] },
  { id: 'hepaticFunction', label: 'Leverfunksjon', type: 'enum', values: ['normal', 'reduced', 'severe'] },
  { id: 'brcaStatus', label: 'BRCA-status', type: 'enum', values: ['BRCA1', 'BRCA2', 'negative', 'not_tested', 'VUS'] },
  { id: 'brcaMutated', label: 'BRCA-mutert', type: 'boolean' },
  { id: 'olaparibEligible', label: 'Olaparib-kandidat', type: 'boolean' },
  { id: 'histologicalType', label: 'Histologisk type', type: 'enum', values: ['ductal', 'lobular', 'other'] },
  { id: 'pcrStatus', label: 'pCR-status', type: 'enum', values: ['pCR', 'non-pCR', 'not_applicable'] },
  { id: 'isPostNeoadjuvant', label: 'Postneoadjuvant', type: 'boolean' },
];

const PARAM_MAP = Object.fromEntries(CQL_PARAMETERS.map((p) => [p.id, p]));

export default function DecisionTableViewer() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableForm, setNewTableForm] = useState({ id: '', name: '', hitPolicy: 'FIRST' });
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [globalChangeLog, setGlobalChangeLog] = useState([]);
  const [tableDiff, setTableDiff] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testRunning, setTestRunning] = useState(false);

  useEffect(() => { fetchTables(); }, []);

  async function fetchTables() {
    try {
      const res = await fetch('/api/decision-tables');
      const data = await res.json();
      setTables(data);
      if (data.length > 0 && !selectedTable) setSelectedTable(data[0]);
    } catch (err) {
      console.error('Kunne ikke hente beslutningstabeller:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchChangeLog(tableId) {
    try {
      const url = tableId ? `/api/change-log/${tableId}` : '/api/change-log';
      const res = await fetch(url);
      const data = await res.json();
      setGlobalChangeLog(data);
    } catch (err) {
      console.error('Kunne ikke hente endringslogg:', err);
    }
  }

  async function fetchDiff(tableId) {
    try {
      const res = await fetch(`/api/decision-tables/${tableId}/diff`);
      const data = await res.json();
      setTableDiff(data);
    } catch (err) {
      console.error('Kunne ikke hente diff:', err);
    }
  }

  async function runTests() {
    setTestRunning(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/run-tests', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: err.message, totalPassed: 0, totalFailed: 0, totalTests: 0 });
    } finally {
      setTestRunning(false);
    }
  }

  async function revertRule(tableId, ruleId) {
    if (!confirm(`Tilbakestill regel ${ruleId} til standardversjon?`)) return;
    try {
      const res = await fetch(`/api/decision-tables/${tableId}/revert-rule/${ruleId}`, { method: 'POST' });
      const data = await res.json();
      setSelectedTable(data.table);
      setTables((prev) => prev.map((t) => (t.id === data.table.id ? data.table : t)));
      showMsg(`Regel ${ruleId} tilbakestilt til standard`);
      fetchDiff(tableId);
    } catch (err) {
      showMsg('Feil ved tilbakestilling: ' + err.message);
    }
  }

  function showMsg(msg) {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 3000);
  }

  // ================================================================
  // Rule editing
  // ================================================================

  function startEdit(rule, table) {
    setEditingRule(rule.id);
    const outputEntries = {};
    if (table.outputs) {
      for (const out of table.outputs) {
        const val = rule.outputs[out.id];
        outputEntries[out.id] = {
          value: Array.isArray(val) ? val.join('\n') : (val ?? ''),
          label: out.label,
          type: out.type,
          allowedValues: out.allowedValues,
        };
      }
    }
    // Parse conditions into visual rows
    const conditionRows = conditionsToRows(rule.conditions);
    setEditForm({
      description: rule.description || '',
      priority: rule.priority ?? 0,
      conditionRows,
      outputs: outputEntries,
    });
  }

  function startAdd(table) {
    const nextId = generateNextRuleId(table);
    const outputEntries = {};
    if (table.outputs) {
      for (const out of table.outputs) {
        outputEntries[out.id] = {
          value: '',
          label: out.label,
          type: out.type,
          allowedValues: out.allowedValues,
        };
      }
    }
    setEditingRule('__new__');
    setEditForm({
      newId: nextId,
      description: '',
      priority: 0,
      conditionRows: [{ param: '', operator: '=', value: '' }],
      outputs: outputEntries,
    });
  }

  function cancelEdit() { setEditingRule(null); setEditForm({}); }

  async function saveRule(ruleId) {
    const table = { ...selectedTable, rules: [...selectedTable.rules] };

    const conditions = rowsToConditions(editForm.conditionRows);
    const newOutputs = parseOutputs(editForm.outputs);

    if (ruleId === '__new__') {
      table.rules.push({
        id: editForm.newId,
        description: editForm.description,
        priority: Number(editForm.priority),
        conditions,
        outputs: newOutputs,
      });
    } else {
      const ruleIndex = table.rules.findIndex((r) => r.id === ruleId);
      if (ruleIndex === -1) return;
      table.rules[ruleIndex] = {
        ...table.rules[ruleIndex],
        description: editForm.description,
        priority: Number(editForm.priority),
        conditions,
        outputs: newOutputs,
      };
    }

    await persistTable(table);
  }

  async function deleteRule(ruleId) {
    if (!confirm(`Slett regel ${ruleId}?`)) return;
    const table = { ...selectedTable, rules: selectedTable.rules.filter((r) => r.id !== ruleId) };
    await persistTable(table);
  }

  async function persistTable(table) {
    try {
      const res = await fetch(`/api/decision-tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table),
      });
      const updated = await res.json();
      setSelectedTable(updated.table);
      setTables((prev) => prev.map((t) => (t.id === updated.table.id ? updated.table : t)));
      showMsg('Regel lagret');
      setEditingRule(null);
    } catch (err) {
      showMsg('Kunne ikke lagre: ' + err.message);
    }
  }

  // ================================================================
  // Table create / delete / reset
  // ================================================================

  async function createTable() {
    const id = newTableForm.id.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id || !newTableForm.name.trim()) { showMsg('ID og navn er påkrevd'); return; }
    const table = {
      id,
      name: newTableForm.name.trim(),
      hitPolicy: newTableForm.hitPolicy,
      version: '1.0.0',
      inputs: [],
      outputs: [
        { id: 'regimen', label: 'Regime', type: 'string' },
        { id: 'rationale', label: 'Begrunnelse', type: 'string' },
      ],
      rules: [],
    };
    try {
      const res = await fetch('/api/decision-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table),
      });
      if (!res.ok) { const err = await res.json(); showMsg(err.error); return; }
      await fetchTables();
      // Select the new table
      setSelectedTable(table);
      setShowNewTable(false);
      setNewTableForm({ id: '', name: '', hitPolicy: 'FIRST' });
      showMsg('Ny tabell opprettet');
    } catch (err) {
      showMsg('Feil ved opprettelse: ' + err.message);
    }
  }

  async function deleteTable(tableId) {
    if (!confirm(`Slett tabell "${tableId}"?`)) return;
    try {
      const res = await fetch(`/api/decision-tables/${tableId}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); showMsg(err.error); return; }
      setSelectedTable(null);
      await fetchTables();
      showMsg('Tabell slettet');
    } catch (err) {
      showMsg('Feil: ' + err.message);
    }
  }

  async function resetTables() {
    if (!confirm('Tilbakestill alle beslutningstabeller til standard?')) return;
    try {
      await fetch('/api/decision-tables/reset', { method: 'POST' });
      setSelectedTable(null);
      await fetchTables();
      showMsg('Alle tabeller tilbakestilt');
    } catch { showMsg('Feil ved tilbakestilling'); }
  }

  if (loading) return <p>Laster beslutningstabeller...</p>;

  // Skrive-/testendepunkter finnes ikke i produksjon (Vercel) — vis kun-lese-modus.
  const IS_PROD = import.meta.env.PROD;

  return (
    <div className="table-viewer">
      <div className="table-viewer-header">
        <h2>Beslutningslogikk — Alle tabeller</h2>
        <p className="viewer-description">
          Alle kliniske beslutninger er uttrykt som transparente tabeller med kildehenvisning
          til NBCG. {IS_PROD
            ? 'Denne visningen er skrivebeskyttet — logikken kan kun endres i lokalt utviklingsmiljø.'
            : 'Klinikere og beslutningstakere kan inspisere, verifisere og endre logikken direkte.'}
        </p>
        {IS_PROD && (
          <div className="viewer-readonly-banner">🔒 Skrivebeskyttet visning</div>
        )}
      </div>

      {/* Table tabs */}
      <div className="table-tabs">
        {tables.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${selectedTable?.id === t.id ? 'active' : ''} ${t.hasModifiedRules ? 'tab-modified' : ''}`}
            onClick={() => { setSelectedTable(t); setEditingRule(null); setTableDiff(null); }}
            title={t.hasModifiedRules ? `${t.name} (endret fra standard)` : t.name}
          >
            {t.hasModifiedRules && <span className="modified-dot" title="Inneholder endrede regler" />}
            {t.name.length > 25 ? t.name.slice(0, 25) + '…' : t.name}
          </button>
        ))}
        {!IS_PROD && <button className="tab-btn add-table-btn" onClick={() => setShowNewTable(true)} title="Legg til ny tabell">+ Ny tabell</button>}
        {!IS_PROD && <button className="tab-btn reset-btn" onClick={resetTables}>Tilbakestill alle</button>}
        <button className="tab-btn changelog-btn" onClick={() => { setShowChangeLog(!showChangeLog); if (!showChangeLog) fetchChangeLog(); }}>Endringslogg</button>
        {!IS_PROD && (
          <button className={`tab-btn test-btn ${testRunning ? 'running' : ''}`} onClick={runTests} disabled={testRunning}>
            {testRunning ? 'Kjorer tester...' : 'Kjor tester'}
          </button>
        )}
      </div>

      {saveMessage && <div className="save-message">{saveMessage}</div>}

      {/* Testresultat-panel */}
      {testResult && (
        <div className={`test-result-panel ${testResult.success ? 'test-pass' : 'test-fail'}`}>
          <div className="test-result-header">
            <h3>
              {testResult.success ? 'Alle tester bestatt' : 'Tester feilet'}
            </h3>
            <span className="test-result-summary">
              {testResult.totalPassed} bestatt / {testResult.totalFailed} feilet / {testResult.totalTests} totalt
            </span>
            <button className="cancel-btn" onClick={() => setTestResult(null)}>Lukk</button>
          </div>

          {testResult.testSuites && testResult.testSuites.map((suite) => (
            <div key={suite.file} className="test-suite">
              <div className="test-suite-header">
                <span className={`test-suite-status ${suite.failed > 0 ? 'fail' : 'pass'}`}>
                  {suite.failed > 0 ? 'FEIL' : 'OK'}
                </span>
                <span className="test-suite-file">{suite.file}</span>
                <span className="test-suite-count">{suite.passed}/{suite.passed + suite.failed}</span>
              </div>
              {suite.failed > 0 && (
                <div className="test-failures">
                  {suite.tests.filter((t) => t.status === 'failed').map((t, i) => (
                    <div key={i} className="test-failure-item">
                      <span className="test-failure-name">{t.name}</span>
                      {t.failureMessage && (
                        <pre className="test-failure-msg">{t.failureMessage.slice(0, 500)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {testResult.rawOutput && !testResult.testSuites && (
            <pre className="test-raw-output">{testResult.rawOutput.slice(0, 2000)}</pre>
          )}

          <p className="test-timestamp">Kjort: {new Date(testResult.timestamp).toLocaleString('nb-NO')}</p>
        </div>
      )}

      {/* Global change log */}
      {showChangeLog && (
        <div className="change-log-panel">
          <div className="change-log-header">
            <h3>Endringslogg</h3>
            <button className="cancel-btn" onClick={() => setShowChangeLog(false)}>Lukk</button>
          </div>
          {globalChangeLog.length === 0 ? (
            <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Ingen endringer registrert</p>
          ) : (
            <div className="change-log-entries">
              {globalChangeLog.slice(0, 50).map((entry) => (
                <div key={entry.id || entry.timestamp} className="change-log-entry">
                  <div className="change-log-meta">
                    <span className="change-log-time">{new Date(entry.timestamp).toLocaleString('nb-NO')}</span>
                    <span className="change-log-table">{entry.tableName}</span>
                    <span className="change-log-user">{entry.changedBy}</span>
                  </div>
                  <div className="change-log-desc">{entry.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New table form */}
      {showNewTable && (
        <div className="new-table-form">
          <h3>Opprett ny beslutningstabel</h3>
          <div className="new-table-fields">
            <label>
              Tabell-ID (unik nøkkel)
              <input value={newTableForm.id} onChange={(e) => setNewTableForm((p) => ({ ...p, id: e.target.value }))} placeholder="f.eks. nytt-medikament-xx" />
            </label>
            <label>
              Tabellnavn
              <input value={newTableForm.name} onChange={(e) => setNewTableForm((p) => ({ ...p, name: e.target.value }))} placeholder="f.eks. Medikament XX - Adjuvant" />
            </label>
            <label>
              Hit Policy
              <select value={newTableForm.hitPolicy} onChange={(e) => setNewTableForm((p) => ({ ...p, hitPolicy: e.target.value }))}>
                <option value="FIRST">FIRST (første treff)</option>
                <option value="PRIORITY">PRIORITY (prioritetsbasert)</option>
                <option value="COLLECT">COLLECT (samle alle treff)</option>
              </select>
            </label>
          </div>
          <div className="editor-actions">
            <button className="save-btn" onClick={createTable}>Opprett tabell</button>
            <button className="cancel-btn" onClick={() => setShowNewTable(false)}>Avbryt</button>
          </div>
        </div>
      )}

      {selectedTable && (
        <div className="table-detail">
          <div className="table-meta">
            <span>Hit Policy: <strong>{selectedTable.hitPolicy}</strong></span>
            <span>Versjon: <strong>{selectedTable.version || '—'}</strong></span>
            <span>Oppdatert: <strong>{selectedTable.lastUpdated || '—'}</strong></span>
            <span>Regler: <strong>{selectedTable.rules.length}</strong></span>
            {!IS_PROD && !isStandardTable(selectedTable.id) && (
              <button className="delete-table-btn" onClick={() => deleteTable(selectedTable.id)}>Slett tabell</button>
            )}
            <button className="diff-btn" onClick={() => fetchDiff(selectedTable.id)}>Vis endringer fra standard</button>
          </div>

          {/* Guideline source reference */}
          {selectedTable.guidelineSource && (
            <div className="guideline-source-banner">
              <strong>Kilde:</strong> {selectedTable.guidelineSource.document}
              {selectedTable.guidelineSource.chapter && <> — {selectedTable.guidelineSource.chapter}</>}
              {selectedTable.guidelineSource.page && <> ({selectedTable.guidelineSource.page})</>}
              {selectedTable.guidelineSource.revision && <span className="guideline-revision"> | Revisjon: {selectedTable.guidelineSource.revision}</span>}
              {selectedTable.guidelineSource.trialReference && <span className="guideline-trial"> | Studier: {selectedTable.guidelineSource.trialReference}</span>}
            </div>
          )}

          {/* Modified rules warning */}
          {selectedTable.hasModifiedRules && (
            <div className="modified-warning-banner">
              <strong>Advarsel:</strong> Denne tabellen inneholder regler som er endret fra standardversjonen.
              Endrede regler er merket med en oransje indikator. Klikk &quot;Vis endringer fra standard&quot; for detaljer.
              {selectedTable.changeLog && selectedTable.changeLog.length > 0 && (
                <div className="table-changelog-preview">
                  Siste endring: {new Date(selectedTable.changeLog[0].timestamp).toLocaleString('nb-NO')} av {selectedTable.changeLog[0].changedBy}
                  — {selectedTable.changeLog[0].description}
                </div>
              )}
            </div>
          )}

          {/* Diff view */}
          {tableDiff && tableDiff.tableId === selectedTable.id && (
            <div className="diff-panel">
              <div className="diff-header">
                <h3>Endringer fra standard ({tableDiff.totalDiffs} {tableDiff.totalDiffs === 1 ? 'endring' : 'endringer'})</h3>
                <button className="cancel-btn" onClick={() => setTableDiff(null)}>Lukk</button>
              </div>
              {tableDiff.totalDiffs === 0 ? (
                <p style={{ color: '#27ae60', fontStyle: 'italic' }}>Ingen endringer — tabellen er identisk med standardversjonen</p>
              ) : (
                <div className="diff-entries">
                  {tableDiff.diffs.map((d) => (
                    <div key={d.ruleId} className={`diff-entry diff-${d.type}`}>
                      <div className="diff-rule-header">
                        <span className="diff-rule-id">{d.ruleId}</span>
                        <span className={`diff-type-badge diff-type-${d.type}`}>
                          {d.type === 'modified' ? 'Endret' : d.type === 'added' ? 'Ny' : 'Slettet'}
                        </span>
                        {d.type === 'modified' && (
                          <button className="revert-btn" onClick={() => revertRule(selectedTable.id, d.ruleId)}>Tilbakestill</button>
                        )}
                      </div>
                      {d.changes.map((c, i) => (
                        <div key={i} className="diff-change">
                          <span className="diff-field">{c.field}</span>
                          {c.old !== undefined && <span className="diff-old">Før: {JSON.stringify(c.old)}</span>}
                          {c.new !== undefined && <span className="diff-new">Etter: {JSON.stringify(c.new)}</span>}
                          {c.detail && <span className="diff-detail">{c.detail}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inputs */}
          {selectedTable.inputs && selectedTable.inputs.length > 0 && (
            <div className="inputs-section">
              <h3>Input-variabler</h3>
              <div className="input-chips">
                {selectedTable.inputs.map((input) => (
                  <div key={input.id} className="input-chip">
                    <strong>{input.label}</strong>
                    <span className="chip-type">{input.type}</span>
                    {input.allowedValues && <span className="chip-values">{input.allowedValues.join(', ')}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output columns */}
          {selectedTable.outputs && selectedTable.outputs.length > 0 && (
            <div className="inputs-section">
              <h3>Output-kolonner</h3>
              <div className="input-chips">
                {selectedTable.outputs.map((out) => (
                  <div key={out.id} className="input-chip">
                    <strong>{out.label}</strong>
                    <span className="chip-type">{out.type}</span>
                    {out.allowedValues && <span className="chip-values">{out.allowedValues.join(', ')}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          <div className="rules-header">
            <h3>Regler {selectedTable.hitPolicy === 'PRIORITY' ? '(sortert etter prioritet)' : ''}</h3>
            <button className="add-rule-btn" onClick={() => startAdd(selectedTable)}>+ Legg til regel</button>
          </div>

          <div className="rules-list">
            {/* New rule form at top */}
            {editingRule === '__new__' && (
              <div className="rule-card rule-card-new">
                <VisualRuleEditor
                  form={editForm}
                  setForm={setEditForm}
                  table={selectedTable}
                  onSave={() => saveRule('__new__')}
                  onCancel={cancelEdit}
                  isNew
                />
              </div>
            )}

            {[...selectedTable.rules]
              .sort((a, b) => selectedTable.hitPolicy === 'PRIORITY' ? (b.priority ?? 0) - (a.priority ?? 0) : 0)
              .map((rule) => (
                <div key={rule.id} className="rule-card">
                  {editingRule === rule.id ? (
                    <VisualRuleEditor
                      form={editForm}
                      setForm={setEditForm}
                      table={selectedTable}
                      onSave={() => saveRule(rule.id)}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <GenericRuleDisplay rule={rule} table={selectedTable} readOnly={IS_PROD} onEdit={() => startEdit(rule, selectedTable)} onDelete={() => deleteRule(rule.id)} onRevert={isStandardTable(selectedTable.id) ? (ruleId) => revertRule(selectedTable.id, ruleId) : null} />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Architecture info */}
      <details className="architecture-info">
        <summary>Om BPM+ Health-arkitekturen</summary>
        <div className="arch-content">
          <h4>Dataflyt: CQL (fakta) → DMN (alle beslutninger)</h4>
          <div className="arch-diagram">
            <div className="arch-box">Pasientdata</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box highlight">CQL (fakta-derivering)</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box highlight">DMN (beslutningstabeller)</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box">Behandlingsplan</div>
          </div>
          <p>
            <strong>CQL</strong> henter og beregner kliniske fakta (reseptorstatus, staging, Ki-67).
            <br />
            <strong>DMN</strong> evaluerer ALLE beslutningsregler. Hver klinisk beslutning — HER2-bestemmelse,
            kjemoterapi, CDK4/6, endokrinterapi, strålebehandling, bisfosfonat — er en egen tabell som kan
            inspiseres og redigeres uavhengig.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Egendefinerte tabeller</strong> evalueres automatisk mot pasientdata. Opprett en ny tabell,
            legg til regler med betingelser, og systemet inkluderer resultatene i behandlingsplanen.
          </p>
        </div>
      </details>
    </div>
  );
}

// ================================================================
// Standard table IDs (cannot be deleted)
// ================================================================

const STANDARD_TABLE_IDS = new Set([
  'her2-determination', 'chemo-pathway-hrpos-her2neg', 'cdk46-adjuvant-selection',
  'endocrine-therapy-selection', 'zometa-eligibility', 'radiation-therapy',
  'hrpos-her2pos-adjuvant', 'hrneg-her2pos-adjuvant', 'tn-adjuvant',
  'neoadjuvant-treatment', 'post-neoadjuvant-treatment', 'brca-olaparib-eligibility',
  'near-cutoff-warnings',
]);

function isStandardTable(id) { return STANDARD_TABLE_IDS.has(id); }

// ================================================================
// Condition ↔ visual row conversion
// ================================================================

function conditionsToRows(conditions) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return [{ param: '', operator: '=', value: '' }];
  }
  const rows = [];
  for (const [param, expected] of Object.entries(conditions)) {
    if (expected === true) {
      rows.push({ param, operator: '=', value: 'true' });
    } else if (expected === false) {
      rows.push({ param, operator: '=', value: 'false' });
    } else if (Array.isArray(expected)) {
      rows.push({ param, operator: 'in', value: expected.join(', ') });
    } else if (typeof expected === 'object' && expected !== null) {
      if ('not' in expected) {
        const notVal = expected.not;
        if (Array.isArray(notVal)) {
          rows.push({ param, operator: 'not_in', value: notVal.join(', ') });
        } else {
          rows.push({ param, operator: '!=', value: String(notVal) });
        }
      } else {
        // Range operators
        if ('gte' in expected) rows.push({ param, operator: '>=', value: String(expected.gte) });
        if ('gt' in expected) rows.push({ param, operator: '>', value: String(expected.gt) });
        if ('lte' in expected) rows.push({ param, operator: '<=', value: String(expected.lte) });
        if ('lt' in expected) rows.push({ param, operator: '<', value: String(expected.lt) });
      }
    } else {
      rows.push({ param, operator: '=', value: String(expected) });
    }
  }
  return rows.length > 0 ? rows : [{ param: '', operator: '=', value: '' }];
}

function rowsToConditions(rows) {
  const conditions = {};
  for (const row of rows) {
    if (!row.param) continue;
    const paramDef = PARAM_MAP[row.param];
    const val = row.value.trim();
    if (!val) continue;

    switch (row.operator) {
      case '=': {
        conditions[row.param] = coerceValue(val, paramDef);
        break;
      }
      case '!=': {
        conditions[row.param] = { not: coerceValue(val, paramDef) };
        break;
      }
      case 'in': {
        const items = val.split(',').map((s) => s.trim()).filter(Boolean).map((s) => coerceValue(s, paramDef));
        conditions[row.param] = items;
        break;
      }
      case 'not_in': {
        const items = val.split(',').map((s) => s.trim()).filter(Boolean).map((s) => coerceValue(s, paramDef));
        conditions[row.param] = { not: items };
        break;
      }
      case '>=': {
        conditions[row.param] = { ...conditions[row.param], gte: Number(val) };
        break;
      }
      case '>': {
        conditions[row.param] = { ...conditions[row.param], gt: Number(val) };
        break;
      }
      case '<=': {
        conditions[row.param] = { ...conditions[row.param], lte: Number(val) };
        break;
      }
      case '<': {
        conditions[row.param] = { ...conditions[row.param], lt: Number(val) };
        break;
      }
    }
  }
  return conditions;
}

function coerceValue(val, paramDef) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (paramDef?.type === 'number' || paramDef?.type === 'enum') {
    const num = Number(val);
    if (!isNaN(num) && String(num) === val) return num;
  }
  return val;
}

function generateNextRuleId(table) {
  const prefix = table.id.split('-').map((w) => w[0]?.toUpperCase() || '').join('').slice(0, 3) || 'R';
  const existing = table.rules.map((r) => r.id);
  for (let i = 1; i < 999; i++) {
    const candidate = `${prefix}${i}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

function parseOutputs(outputEntries) {
  const newOutputs = {};
  for (const [key, entry] of Object.entries(outputEntries)) {
    if (entry.type === 'string[]') {
      newOutputs[key] = entry.value.split('\n').filter(Boolean);
    } else if (entry.type === 'boolean') {
      newOutputs[key] = entry.value === 'true' || entry.value === true;
    } else if (entry.type === 'number') {
      newOutputs[key] = Number(entry.value);
    } else {
      newOutputs[key] = entry.value;
    }
  }
  return newOutputs;
}

// ================================================================
// Display component
// ================================================================

function GenericRuleDisplay({ rule, table, onEdit, onDelete, onRevert, readOnly }) {
  return (
    <>
      <div className="rule-header">
        <span className="rule-id">{rule.id}</span>
        {rule.isModified && <span className="rule-modified-badge" title={`Endret ${rule.lastModifiedAt ? new Date(rule.lastModifiedAt).toLocaleString('nb-NO') : ''} av ${rule.lastModifiedBy || 'ukjent'}`}>Endret</span>}
        {rule.priority != null && table.hitPolicy === 'PRIORITY' && <span className="rule-priority">Prioritet: {rule.priority}</span>}
        {!readOnly && <button className="edit-btn" onClick={onEdit}>Rediger</button>}
        {!readOnly && rule.isModified && onRevert && <button className="revert-btn" onClick={() => onRevert(rule.id)}>Tilbakestill</button>}
        {!readOnly && <button className="delete-rule-btn" onClick={onDelete}>Slett</button>}
      </div>
      {rule.description && <p className="rule-description">{rule.description}</p>}
      {rule.sourceRef && (
        <div className="rule-source-ref">
          <span className="source-ref-label">Kilde:</span>
          {rule.sourceRef.document && <span>{rule.sourceRef.document}</span>}
          {rule.sourceRef.chapter && <span> — {rule.sourceRef.chapter}</span>}
          {rule.sourceRef.page && <span> ({rule.sourceRef.page})</span>}
          {rule.sourceRef.revision && <span className="source-ref-revision"> [{rule.sourceRef.revision}]</span>}
          {rule.sourceRef.trialReference && <span className="source-ref-trial"> Studie: {rule.sourceRef.trialReference}</span>}
        </div>
      )}

      <div className="rule-body">
        <div className="rule-conditions">
          <strong>Betingelser:</strong>
          {Object.keys(rule.conditions).length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#7f8c8d' }}>Ingen (fallback/catch-all)</p>
          ) : (
            <ul>
              {Object.entries(rule.conditions).map(([key, val]) => {
                const inputDef = table.inputs?.find((i) => i.id === key) || PARAM_MAP[key];
                return (
                  <li key={key}>
                    <code>{inputDef?.label || key}</code> = {formatCondition(val)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rule-outputs">
          <strong>Resultat:</strong>
          {table.outputs ? table.outputs.map((outDef) => {
            const val = rule.outputs[outDef.id];
            if (val == null || (Array.isArray(val) && val.length === 0)) return null;
            return (
              <div key={outDef.id} className="output-item">
                <span className="output-label">{outDef.label}:</span>
                <span className="output-value">
                  {Array.isArray(val) ? val.join('; ') : String(val)}
                </span>
              </div>
            );
          }) : Object.entries(rule.outputs).map(([key, val]) => (
            <div key={key} className="output-item">
              <span className="output-label">{key}:</span>
              <span className="output-value">{Array.isArray(val) ? val.join('; ') : String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ================================================================
// Visual Rule Editor with condition builder
// ================================================================

function VisualRuleEditor({ form, setForm, table, onSave, onCancel, isNew }) {
  function updateRow(index, field, value) {
    setForm((prev) => {
      const rows = [...prev.conditionRows];
      rows[index] = { ...rows[index], [field]: value };
      // Reset value when parameter changes
      if (field === 'param') rows[index].value = '';
      return { ...prev, conditionRows: rows };
    });
  }

  function addRow() {
    setForm((prev) => ({
      ...prev,
      conditionRows: [...prev.conditionRows, { param: '', operator: '=', value: '' }],
    }));
  }

  function removeRow(index) {
    setForm((prev) => ({
      ...prev,
      conditionRows: prev.conditionRows.length > 1
        ? prev.conditionRows.filter((_, i) => i !== index)
        : [{ param: '', operator: '=', value: '' }],
    }));
  }

  function handleOutputChange(outputId, value) {
    setForm((prev) => ({
      ...prev,
      outputs: { ...prev.outputs, [outputId]: { ...prev.outputs[outputId], value } },
    }));
  }

  const operatorOptions = [
    { value: '=', label: 'er lik (=)' },
    { value: '!=', label: 'er ikke (≠)' },
    { value: '>', label: 'større enn (>)' },
    { value: '>=', label: 'større eller lik (≥)' },
    { value: '<', label: 'mindre enn (<)' },
    { value: '<=', label: 'mindre eller lik (≤)' },
    { value: 'in', label: 'er en av (IN)' },
    { value: 'not_in', label: 'er ikke en av (NOT IN)' },
  ];

  return (
    <div className="rule-editor">
      <h4>{isNew ? 'Ny regel' : 'Rediger regel'}</h4>

      <label>
        Beskrivelse
        <input name="description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Kort beskrivelse av regelen" />
      </label>

      {table.hitPolicy === 'PRIORITY' && (
        <label>
          Prioritet
          <input type="number" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} />
        </label>
      )}

      {/* Visual condition builder */}
      <div className="condition-builder">
        <strong>Betingelser</strong>
        <p className="condition-hint">Legg til betingelser for når regelen skal gjelde. Alle betingelser må være oppfylt (OG-logikk).</p>

        {form.conditionRows.map((row, idx) => {
          const paramDef = PARAM_MAP[row.param];
          return (
            <div key={idx} className="condition-row">
              {/* Parameter dropdown */}
              <select
                className="cond-param"
                value={row.param}
                onChange={(e) => updateRow(idx, 'param', e.target.value)}
              >
                <option value="">— Velg parameter —</option>
                <optgroup label="Reseptor">
                  {CQL_PARAMETERS.filter((p) => ['erPercent', 'prPercent', 'erPositive', 'prPositive', 'hrPositive'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="HER2">
                  {CQL_PARAMETERS.filter((p) => ['her2ihc', 'her2sish', 'her2Status', 'her2Positive', 'her2Negative'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Biologi">
                  {CQL_PARAMETERS.filter((p) => ['bioGroup', 'luminalSubtype'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Staging">
                  {CQL_PARAMETERS.filter((p) => ['tStage', 'tSimple', 'nStage', 'stadium', 'tumorSizeMm'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Tumor">
                  {CQL_PARAMETERS.filter((p) => ['grade', 'ki67Value'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Gentest">
                  {CQL_PARAMETERS.filter((p) => ['geneTest', 'geneTestDone', 'rorScore', 'rsScore', 'prosignaSubtype', 'gesHighRisk', 'gesLowRisk'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Pasient">
                  {CQL_PARAMETERS.filter((p) => ['age', 'menopausalStatus', 'surgeryType', 'ecogScore'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Risikoflagg">
                  {CQL_PARAMETERS.filter((p) => ['isNeoadjuvant', 'isHighRisk', 'cdk46eligible', 'hasSystemicTherapy', 'hasOFS'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Organfunksjon">
                  {CQL_PARAMETERS.filter((p) => ['cardiacRisk', 'renalFunction', 'hepaticFunction'].includes(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </optgroup>
              </select>

              {/* Operator dropdown */}
              <select
                className="cond-op"
                value={row.operator}
                onChange={(e) => updateRow(idx, 'operator', e.target.value)}
              >
                {operatorOptions
                  .filter((op) => {
                    // Limit operators based on parameter type
                    if (!paramDef) return true;
                    if (paramDef.type === 'boolean') return ['=', '!='].includes(op.value);
                    if (paramDef.type === 'enum') return ['=', '!=', 'in', 'not_in'].includes(op.value);
                    return true;
                  })
                  .map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
              </select>

              {/* Value input — smart per type */}
              {renderValueInput(row, paramDef, idx, updateRow)}

              <button className="cond-remove" onClick={() => removeRow(idx)} title="Fjern betingelse">×</button>
            </div>
          );
        })}

        <button className="cond-add" onClick={addRow}>+ Legg til betingelse</button>
      </div>

      {/* Outputs */}
      <h4>Resultat (output)</h4>
      {Object.entries(form.outputs).map(([key, entry]) => (
        <label key={key}>
          {entry.label}
          {entry.allowedValues ? (
            <select value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)}>
              <option value="">— Velg —</option>
              {entry.allowedValues.map((v) => (
                <option key={v} value={v}>{String(v)}</option>
              ))}
            </select>
          ) : entry.type === 'string[]' ? (
            <textarea value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)} rows={2} placeholder="Én per linje" />
          ) : (
            <input value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)} placeholder={entry.label} />
          )}
        </label>
      ))}

      <div className="editor-actions">
        <button className="save-btn" onClick={onSave}>{isNew ? 'Opprett regel' : 'Lagre'}</button>
        <button className="cancel-btn" onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  );
}

function renderValueInput(row, paramDef, idx, updateRow) {
  // For "in" or "not_in", allow comma-separated with enum chips
  if (row.operator === 'in' || row.operator === 'not_in') {
    if (paramDef?.type === 'enum' && paramDef.values) {
      const selected = row.value.split(',').map((s) => s.trim()).filter(Boolean);
      return (
        <div className="cond-multi-select">
          {paramDef.values.map((v) => (
            <label key={v} className={`cond-chip ${selected.includes(String(v)) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(String(v))}
                onChange={(e) => {
                  const newSel = e.target.checked
                    ? [...selected, String(v)]
                    : selected.filter((s) => s !== String(v));
                  updateRow(idx, 'value', newSel.join(', '));
                }}
              />
              {String(v)}
            </label>
          ))}
        </div>
      );
    }
    return <input className="cond-value" value={row.value} onChange={(e) => updateRow(idx, 'value', e.target.value)} placeholder="Verdier (komma-separert)" />;
  }

  // Boolean
  if (paramDef?.type === 'boolean') {
    return (
      <select className="cond-value" value={row.value} onChange={(e) => updateRow(idx, 'value', e.target.value)}>
        <option value="">— Velg —</option>
        <option value="true">Ja</option>
        <option value="false">Nei</option>
      </select>
    );
  }

  // Enum with single value
  if (paramDef?.type === 'enum' && paramDef.values && (row.operator === '=' || row.operator === '!=')) {
    return (
      <select className="cond-value" value={row.value} onChange={(e) => updateRow(idx, 'value', e.target.value)}>
        <option value="">— Velg —</option>
        {paramDef.values.map((v) => (
          <option key={v} value={v}>{String(v)}</option>
        ))}
      </select>
    );
  }

  // Number
  if (paramDef?.type === 'number') {
    return <input className="cond-value" type="number" value={row.value} onChange={(e) => updateRow(idx, 'value', e.target.value)} placeholder="Tall" />;
  }

  // Default: text input
  return <input className="cond-value" value={row.value} onChange={(e) => updateRow(idx, 'value', e.target.value)} placeholder="Verdi" />;
}

function formatCondition(val) {
  if (val === true) return 'ja';
  if (val === false) return 'nei';
  if (Array.isArray(val)) return val.map(formatCondition).join(' | ');
  if (typeof val === 'object' && val !== null) {
    if ('not' in val) return `ikke ${formatCondition(val.not)}`;
    const parts = [];
    if ('gte' in val) parts.push(`≥ ${val.gte}`);
    if ('gt' in val) parts.push(`> ${val.gt}`);
    if ('lte' in val) parts.push(`≤ ${val.lte}`);
    if ('lt' in val) parts.push(`< ${val.lt}`);
    return parts.join(' og ');
  }
  return String(val);
}
