import React, { useState } from 'react';

/**
 * Generisk, gjenbrukbar mal-editor med dra-og-slipp blokker og forhåndsvisning.
 *
 * Datakilde-agnostisk: får inn variabel-/betingelseskataloger og resolver-
 * funksjoner, ikke en spesifikk pasientdata-struktur.
 *
 * Props:
 *  - blocks, onChange
 *  - variables: [{ group, vars: [{ id, label }] }]
 *  - conditions: [{ id, label }]
 *  - resolvePreview: (varId) => string   (valgfri; slår på forhåndsvisning)
 *  - evalPreview: (condId) => boolean     (valgfri)
 *  - readOnly
 */
export function TemplateEditor({ blocks, onChange, variables, conditions, resolvePreview, evalPreview, readOnly }) {
  const [dragIndex, setDragIndex] = useState(null);
  const allVars = variables.flatMap((g) => g.vars);

  function updateBlock(idx, updates) {
    onChange(blocks.map((b, i) => (i === idx ? { ...b, ...updates } : b)));
  }
  function removeBlock(idx) {
    onChange(blocks.filter((_, i) => i !== idx));
  }
  function addTextBlock() {
    onChange([...blocks, { type: 'text', value: '' }]);
  }
  function addVarBlock() {
    onChange([...blocks, { type: 'var', varId: variables[0].vars[0].id }]);
  }
  function addCondBlock() {
    onChange([...blocks, { type: 'cond', condition: conditions[0].id, trueText: '', falseText: '' }]);
  }
  function handleDrop(targetIdx) {
    if (dragIndex === null || dragIndex === targetIdx) return;
    const next = [...blocks];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
    setDragIndex(null);
  }

  if (readOnly) {
    return (
      <div className="template-blocks-readonly">
        {blocks.map((block, i) => (
          <span key={i} className={`tpl-block tpl-${block.type}`}>
            {block.type === 'text' && <span>{block.value}</span>}
            {block.type === 'var' && <span className="tpl-var-tag">{allVars.find((v) => v.id === block.varId)?.label || block.varId}</span>}
            {block.type === 'cond' && <span className="tpl-cond-tag">Hvis {conditions.find((c) => c.id === block.condition)?.label || block.condition}</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="template-editor">
      <div className="template-blocks">
        {blocks.map((block, i) => (
          <div
            key={i}
            className={`tpl-block-edit tpl-${block.type}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
          >
            <div className="tpl-block-header">
              <span className="tpl-drag-handle">⠿</span>
              <span className="tpl-block-type">
                {block.type === 'text' ? 'Tekst' : block.type === 'var' ? 'Variabel' : 'Betingelse'}
              </span>
              <button className="tpl-remove-btn" onClick={() => removeBlock(i)} title="Fjern">×</button>
            </div>

            {block.type === 'text' && (
              <textarea
                className="tpl-text-input"
                value={block.value}
                onChange={(e) => updateBlock(i, { value: e.target.value })}
                rows={Math.max(1, (block.value.match(/\n/g) || []).length + 1)}
                placeholder="Skriv fritekst her..."
              />
            )}

            {block.type === 'var' && (
              <select className="tpl-var-select" value={block.varId} onChange={(e) => updateBlock(i, { varId: e.target.value })}>
                {variables.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.vars.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}

            {block.type === 'cond' && (
              <div className="tpl-cond-edit">
                <label>
                  Betingelse:
                  <select value={block.condition} onChange={(e) => updateBlock(i, { condition: e.target.value })}>
                    {conditions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Hvis sant:
                  <textarea value={block.trueText || ''} onChange={(e) => updateBlock(i, { trueText: e.target.value })} rows={2} placeholder="Tekst når betingelsen er sann..." />
                </label>
                <label>
                  Hvis usant:
                  <textarea value={block.falseText || ''} onChange={(e) => updateBlock(i, { falseText: e.target.value })} rows={2} placeholder="Tekst når betingelsen er usann..." />
                </label>
              </div>
            )}

            {resolvePreview && (
              <div className="tpl-block-preview">
                {block.type === 'var' && <em>{resolvePreview(block.varId)}</em>}
                {block.type === 'cond' && evalPreview && (
                  <em>{evalPreview(block.condition) ? `✓ ${block.trueText || '(tom)'}` : `✗ ${block.falseText || '(tom)'}`}</em>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="template-add-bar">
        <button className="tpl-add-btn" onClick={addTextBlock}>+ Tekst</button>
        <button className="tpl-add-btn" onClick={addVarBlock}>+ Variabel</button>
        <button className="tpl-add-btn" onClick={addCondBlock}>+ Betingelse</button>
      </div>
    </div>
  );
}

/** Kollapsbar variabel-palett for hurtig innsetting. */
export function VariablePalette({ variables, onInsert }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="var-palette">
      <button className="var-palette-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Skjul variabler' : 'Vis tilgjengelige variabler'}
      </button>
      {expanded && (
        <div className="var-palette-grid">
          {variables.map((g) => (
            <div key={g.group} className="var-palette-group">
              <strong>{g.group}</strong>
              <div className="var-palette-chips">
                {g.vars.map((v) => (
                  <button key={v.id} className="var-chip" onClick={() => onInsert(v.id)} title={v.label}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
