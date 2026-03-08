import React, { useState, useEffect } from 'react';

export default function DecisionTableViewer() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    fetchTables();
  }, []);

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

  function startEdit(rule) {
    setEditingRule(rule.id);
    setEditForm({
      description: rule.description,
      priority: rule.priority,
      conditions: JSON.stringify(rule.conditions, null, 2),
      recommendation: rule.outputs.recommendation,
      confidence: rule.outputs.confidence,
      rationale: rule.outputs.rationale,
      warnings: (rule.outputs.warnings || []).join('\n'),
      combinationPartner: rule.outputs.combinationPartner || '',
    });
  }

  function cancelEdit() {
    setEditingRule(null);
    setEditForm({});
  }

  async function saveRule(ruleId) {
    const table = { ...selectedTable };
    const ruleIndex = table.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return;

    let parsedConditions;
    try {
      parsedConditions = JSON.parse(editForm.conditions);
    } catch {
      setSaveMessage('Ugyldig JSON i betingelser');
      return;
    }

    table.rules[ruleIndex] = {
      ...table.rules[ruleIndex],
      description: editForm.description,
      priority: Number(editForm.priority),
      conditions: parsedConditions,
      outputs: {
        recommendation: editForm.recommendation,
        confidence: editForm.confidence,
        rationale: editForm.rationale,
        warnings: editForm.warnings.split('\n').filter(Boolean),
        combinationPartner: editForm.combinationPartner || null,
      },
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
      setSaveMessage('Tabeller tilbakestilt');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage('Feil ved tilbakestilling');
    }
  }

  if (loading) return <p>Laster beslutningstabeller...</p>;

  return (
    <div className="table-viewer">
      <div className="table-viewer-header">
        <h2>Beslutningslogikk</h2>
        <p className="viewer-description">
          Oversikt over reglene som styrer CDK4/6-inhibitorvalg. Klinikere kan se og redigere betingelser,
          anbefalinger og begrunnelser direkte.
        </p>
      </div>

      {/* Tabelvalg */}
      <div className="table-tabs">
        {tables.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${selectedTable?.id === t.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedTable(t);
              setEditingRule(null);
            }}
          >
            {t.name}
          </button>
        ))}
        <button className="tab-btn reset-btn" onClick={resetTables}>
          Tilbakestill
        </button>
      </div>

      {saveMessage && <div className="save-message">{saveMessage}</div>}

      {selectedTable && (
        <div className="table-detail">
          {/* Tabelinformasjon */}
          <div className="table-meta">
            <span>Hit Policy: <strong>{selectedTable.hitPolicy}</strong></span>
            <span>Versjon: <strong>{selectedTable.version}</strong></span>
            <span>Sist oppdatert: <strong>{selectedTable.lastUpdated}</strong></span>
            <span>Antall regler: <strong>{selectedTable.rules.length}</strong></span>
          </div>

          {/* Input-kolonner */}
          <div className="inputs-section">
            <h3>Input-variabler</h3>
            <div className="input-chips">
              {selectedTable.inputs.map((input) => (
                <div key={input.id} className="input-chip">
                  <strong>{input.label}</strong>
                  <span className="chip-type">{input.type}</span>
                  {input.allowedValues && (
                    <span className="chip-values">{input.allowedValues.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Regler */}
          <h3>Regler (sortert etter prioritet)</h3>
          <div className="rules-list">
            {[...selectedTable.rules]
              .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
              .map((rule) => (
                <div key={rule.id} className="rule-card">
                  {editingRule === rule.id ? (
                    <RuleEditor
                      form={editForm}
                      setForm={setEditForm}
                      onSave={() => saveRule(rule.id)}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <RuleDisplay rule={rule} onEdit={() => startEdit(rule)} />
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Arkitekturforklaring */}
      <details className="architecture-info">
        <summary>Om BPM+ Health-arkitekturen</summary>
        <div className="arch-content">
          <h4>Dataflyt: CQL (datahenting) → DMN (beslutning)</h4>
          <div className="arch-diagram">
            <div className="arch-box">FHIR/mCODE Pasientdata</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box highlight">CQL Engine (datahenting og beregning)</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box highlight">DMN Engine (beslutningsregler)</div>
            <div className="arch-arrow">→</div>
            <div className="arch-box">Klinisk anbefaling</div>
          </div>
          <p>
            <strong>CQL</strong> (Clinical Quality Language) henter og beregner kliniske fakta fra FHIR-ressurser.
            <br />
            <strong>DMN</strong> (Decision Model and Notation) evaluerer reglene som vises ovenfor mot CQL-output.
            <br />
            Denne separasjonen gjør at klinikere kan lese og endre beslutningsregler (DMN) uten å måtte forstå
            datahentingslogikken (CQL).
          </p>
        </div>
      </details>
    </div>
  );
}

function RuleDisplay({ rule, onEdit }) {
  return (
    <>
      <div className="rule-header">
        <span className="rule-id">{rule.id}</span>
        <span className="rule-priority">Prioritet: {rule.priority ?? 0}</span>
        <button className="edit-btn" onClick={onEdit}>
          Rediger
        </button>
      </div>
      <p className="rule-description">{rule.description}</p>

      <div className="rule-body">
        <div className="rule-conditions">
          <strong>Betingelser:</strong>
          <ul>
            {Object.entries(rule.conditions).map(([key, val]) => (
              <li key={key}>
                <code>{key}</code> = {formatCondition(val)}
              </li>
            ))}
          </ul>
        </div>

        <div className="rule-outputs">
          <strong>Resultat:</strong>
          <div className="output-item">
            <span className="output-label">Anbefaling:</span>
            <span className="output-value drug-name">{rule.outputs.recommendation}</span>
          </div>
          <div className="output-item">
            <span className="output-label">Konfidens:</span>
            <span className={`output-value confidence-${rule.outputs.confidence}`}>
              {rule.outputs.confidence}
            </span>
          </div>
          <div className="output-item rationale">
            <span className="output-label">Begrunnelse:</span>
            <span className="output-value">{rule.outputs.rationale}</span>
          </div>
          {rule.outputs.combinationPartner && (
            <div className="output-item">
              <span className="output-label">Kombinasjon:</span>
              <span className="output-value">{rule.outputs.combinationPartner}</span>
            </div>
          )}
          {rule.outputs.warnings?.length > 0 && (
            <div className="output-item">
              <span className="output-label">Advarsler:</span>
              <ul className="warnings-list">
                {rule.outputs.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RuleEditor({ form, setForm, onSave, onCancel }) {
  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  return (
    <div className="rule-editor">
      <h4>Rediger regel</h4>

      <label>
        Beskrivelse
        <input name="description" value={form.description} onChange={handleChange} />
      </label>

      <label>
        Prioritet
        <input type="number" name="priority" value={form.priority} onChange={handleChange} />
      </label>

      <label>
        Betingelser (JSON)
        <textarea name="conditions" value={form.conditions} onChange={handleChange} rows={4} />
      </label>

      <label>
        Anbefalt legemiddel
        <select name="recommendation" value={form.recommendation} onChange={handleChange}>
          <option value="Palbociclib">Palbociclib</option>
          <option value="Ribociclib">Ribociclib</option>
          <option value="Abemaciclib">Abemaciclib</option>
          <option value="INGEN">Ingen</option>
        </select>
      </label>

      <label>
        Konfidens
        <select name="confidence" value={form.confidence} onChange={handleChange}>
          <option value="high">Høy</option>
          <option value="moderate">Moderat</option>
          <option value="low">Lav</option>
        </select>
      </label>

      <label>
        Begrunnelse
        <textarea name="rationale" value={form.rationale} onChange={handleChange} rows={3} />
      </label>

      <label>
        Advarsler (én per linje)
        <textarea name="warnings" value={form.warnings} onChange={handleChange} rows={3} />
      </label>

      <label>
        Kombinasjonspartner
        <input name="combinationPartner" value={form.combinationPartner} onChange={handleChange} />
      </label>

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
  if (Array.isArray(val)) return val.join(' | ');
  if (typeof val === 'object' && val !== null && 'not' in val) {
    return `ikke ${formatCondition(val.not)}`;
  }
  return String(val);
}
