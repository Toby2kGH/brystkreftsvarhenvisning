import React, { useState, useEffect } from 'react';

export default function DecisionTableViewer() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => { fetchTables(); }, []);

  async function fetchTables() {
    try {
      const res = await fetch('/api/decision-tables');
      const data = await res.json();
      setTables(data);
      if (data.length > 0) setSelectedTable(data[0]);
    } catch (err) {
      console.error('Kunne ikke hente beslutningstabeller:', err);
    } finally {
      setLoading(false);
    }
  }

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
    setEditForm({
      description: rule.description || '',
      priority: rule.priority ?? 0,
      conditions: JSON.stringify(rule.conditions, null, 2),
      outputs: outputEntries,
    });
  }

  function cancelEdit() { setEditingRule(null); setEditForm({}); }

  async function saveRule(ruleId) {
    const table = { ...selectedTable, rules: [...selectedTable.rules] };
    const ruleIndex = table.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return;

    let parsedConditions;
    try { parsedConditions = JSON.parse(editForm.conditions); }
    catch { setSaveMessage('Ugyldig JSON i betingelser'); return; }

    const newOutputs = {};
    for (const [key, entry] of Object.entries(editForm.outputs)) {
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

    table.rules[ruleIndex] = {
      ...table.rules[ruleIndex],
      description: editForm.description,
      priority: Number(editForm.priority),
      conditions: parsedConditions,
      outputs: newOutputs,
    };

    try {
      const res = await fetch(`/api/decision-tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(table),
      });
      const updated = await res.json();
      setSelectedTable(updated.table);
      setTables((prev) => prev.map((t) => (t.id === updated.table.id ? updated.table : t)));
      setSaveMessage('Regel lagret');
      setEditingRule(null);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage('Kunne ikke lagre: ' + err.message);
    }
  }

  async function resetTables() {
    if (!confirm('Tilbakestill alle beslutningstabeller til standard?')) return;
    try {
      await fetch('/api/decision-tables/reset', { method: 'POST' });
      await fetchTables();
      setSaveMessage('Alle tabeller tilbakestilt');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch { setSaveMessage('Feil ved tilbakestilling'); }
  }

  if (loading) return <p>Laster beslutningstabeller...</p>;

  return (
    <div className="table-viewer">
      <div className="table-viewer-header">
        <h2>Beslutningslogikk — Alle tabeller</h2>
        <p className="viewer-description">
          Alle kliniske beslutninger er uttrykt som transparente, redigerbare tabeller.
          Klinikere og beslutningstakere kan inspisere, verifisere og endre logikken direkte.
        </p>
      </div>

      {/* Table tabs */}
      <div className="table-tabs">
        {tables.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${selectedTable?.id === t.id ? 'active' : ''}`}
            onClick={() => { setSelectedTable(t); setEditingRule(null); }}
            title={t.name}
          >
            {t.name.length > 25 ? t.name.slice(0, 25) + '…' : t.name}
          </button>
        ))}
        <button className="tab-btn reset-btn" onClick={resetTables}>Tilbakestill alle</button>
      </div>

      {saveMessage && <div className="save-message">{saveMessage}</div>}

      {selectedTable && (
        <div className="table-detail">
          <div className="table-meta">
            <span>Hit Policy: <strong>{selectedTable.hitPolicy}</strong></span>
            <span>Versjon: <strong>{selectedTable.version || '—'}</strong></span>
            <span>Oppdatert: <strong>{selectedTable.lastUpdated || '—'}</strong></span>
            <span>Regler: <strong>{selectedTable.rules.length}</strong></span>
          </div>

          {/* Inputs */}
          {selectedTable.inputs && (
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
          {selectedTable.outputs && (
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
          <h3>Regler {selectedTable.hitPolicy === 'PRIORITY' ? '(sortert etter prioritet)' : ''}</h3>
          <div className="rules-list">
            {[...selectedTable.rules]
              .sort((a, b) => selectedTable.hitPolicy === 'PRIORITY' ? (b.priority ?? 0) - (a.priority ?? 0) : 0)
              .map((rule) => (
                <div key={rule.id} className="rule-card">
                  {editingRule === rule.id ? (
                    <GenericRuleEditor
                      form={editForm}
                      setForm={setEditForm}
                      table={selectedTable}
                      onSave={() => saveRule(rule.id)}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <GenericRuleDisplay rule={rule} table={selectedTable} onEdit={() => startEdit(rule, selectedTable)} />
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
            <div className="arch-box highlight">DMN (11 beslutningstabeller)</div>
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
        </div>
      </details>
    </div>
  );
}

function GenericRuleDisplay({ rule, table, onEdit }) {
  return (
    <>
      <div className="rule-header">
        <span className="rule-id">{rule.id}</span>
        {rule.priority != null && <span className="rule-priority">Prioritet: {rule.priority}</span>}
        <button className="edit-btn" onClick={onEdit}>Rediger</button>
      </div>
      {rule.description && <p className="rule-description">{rule.description}</p>}

      <div className="rule-body">
        <div className="rule-conditions">
          <strong>Betingelser:</strong>
          {Object.keys(rule.conditions).length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#7f8c8d' }}>Ingen (fallback/catch-all)</p>
          ) : (
            <ul>
              {Object.entries(rule.conditions).map(([key, val]) => {
                const inputDef = table.inputs?.find((i) => i.id === key);
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

function GenericRuleEditor({ form, setForm, table, onSave, onCancel }) {
  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleOutputChange(outputId, value) {
    setForm((prev) => ({
      ...prev,
      outputs: { ...prev.outputs, [outputId]: { ...prev.outputs[outputId], value } },
    }));
  }

  return (
    <div className="rule-editor">
      <h4>Rediger regel</h4>

      <label>
        Beskrivelse
        <input name="description" value={form.description} onChange={handleChange} />
      </label>

      {table.hitPolicy === 'PRIORITY' && (
        <label>
          Prioritet
          <input type="number" name="priority" value={form.priority} onChange={handleChange} />
        </label>
      )}

      <label>
        Betingelser (JSON)
        <textarea name="conditions" value={form.conditions} onChange={handleChange} rows={4} />
      </label>

      <h4>Output-verdier</h4>
      {Object.entries(form.outputs).map(([key, entry]) => (
        <label key={key}>
          {entry.label}
          {entry.allowedValues ? (
            <select value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)}>
              {entry.allowedValues.map((v) => (
                <option key={v} value={v}>{String(v)}</option>
              ))}
            </select>
          ) : entry.type === 'string[]' ? (
            <textarea value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)} rows={2} placeholder="Én per linje" />
          ) : (
            <input value={entry.value} onChange={(e) => handleOutputChange(key, e.target.value)} />
          )}
        </label>
      ))}

      <div className="editor-actions">
        <button className="save-btn" onClick={onSave}>Lagre</button>
        <button className="cancel-btn" onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  );
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
