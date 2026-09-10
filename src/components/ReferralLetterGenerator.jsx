import React, { useState, useEffect, useRef } from 'react';
import {
  TEMPLATE_VARIABLES,
  ALL_VARS,
  resolveVariable,
  evaluateCondition,
  CONDITION_OPTIONS,
} from '../textgen/clinicalVariables.js';


// ============================================================
// Default templates for Mode 2
// ============================================================

const DEFAULT_ADJUVANT_TEMPLATE = [
  { type: 'text', value: 'Diagnose: ' },
  { type: 'var', varId: 'diagnosisCode' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'stagingFull' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'erPrCombined' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'her2Full' },
  { type: 'text', value: ', ' },
  { type: 'var', varId: 'geneTestResult' },
  { type: 'text', value: ' hos en ' },
  { type: 'var', varId: 'age' },
  { type: 'text', value: ' kvinne med ' },
  { type: 'var', varId: 'menopausalCertainty' },
  { type: 'text', value: ' status.\n\nIhht retningslinjer er det indikasjon for adjuvant ' },
  { type: 'var', varId: 'allStepsDetailed' },
  { type: 'text', value: '.\n\n' },
  { type: 'cond', condition: 'hasEC90', trueText: 'Pasienten skal følges for hjertetoksisitet ved EC90-behandling. ', falseText: '' },
  { type: 'var', varId: 'radiationRegimen' },
  { type: 'text', value: ' som ledd i ' },
  { type: 'var', varId: 'surgeryType' },
  { type: 'text', value: '.' },
  { type: 'cond', condition: 'hasWarnings', trueText: '\n\nMerknader: ', falseText: '' },
  { type: 'cond', condition: 'hasWarnings', trueText: '', falseText: '', useVar: 'warnings' },
];

const DEFAULT_NEOADJUVANT_TEMPLATE = [
  { type: 'text', value: 'Diagnose: ' },
  { type: 'var', varId: 'diagnosisCode' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'stagingFull' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'erPrCombined' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'her2Full' },
  { type: 'text', value: ', ' },
  { type: 'var', varId: 'geneTestResult' },
  { type: 'text', value: ' hos en ' },
  { type: 'var', varId: 'age' },
  { type: 'text', value: ' kvinne med ' },
  { type: 'var', varId: 'menopausalCertainty' },
  { type: 'text', value: ' status.\n\nIhht retningslinjer er det indikasjon for neoadjuvant behandling med ' },
  { type: 'var', varId: 'chemoRegimen' },
  { type: 'text', value: ' før kirurgi.\n\nDet bestilles MR mamma og metastasescreening.' },
  { type: 'cond', condition: 'hasEC90', trueText: ' Pasienten følges for hjertetoksisitet.', falseText: '' },
  { type: 'cond', condition: 'isTN', trueText: '\n\nVed trippel negativ sykdom med immunterapi-indikasjon: immunterapiblodprøver bestilles i forkant.', falseText: '\n\nStandard ca mammae blodprøver bestilles, evt FSH/LH/østradiol.' },
  { type: 'text', value: '\n\nDet er indikasjon for postoperativ strålebehandling avhengig av operasjonstype.' },
  { type: 'cond', condition: 'hasEndocrine', trueText: '\n\nVidere indikasjon for adjuvant endokrin behandling: ', falseText: '' },
  { type: 'cond', condition: 'hasEndocrine', trueText: '', falseText: '', useVar: 'endocrineRegimen' },
  { type: 'cond', condition: 'hasEndocrine', trueText: '.', falseText: '' },
  { type: 'cond', condition: 'hasWarnings', trueText: '\n\nMerknader: ', falseText: '' },
  { type: 'cond', condition: 'hasWarnings', trueText: '', falseText: '', useVar: 'warnings' },
];

// ============================================================
// Storage helpers (localStorage)
// ============================================================

const STORAGE_KEY = 'referralLetterTemplates';

function loadSavedTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveTemplate(name, blocks) {
  const saved = loadSavedTemplates();
  saved[name] = blocks;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function deleteSavedTemplate(name) {
  const saved = loadSavedTemplates();
  delete saved[name];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

// ============================================================
// Render template to text
// ============================================================

function renderTemplate(blocks, cqlOutput, treatmentPlan) {
  let text = '';
  for (const block of blocks) {
    if (block.type === 'text') {
      text += block.value;
    } else if (block.type === 'var') {
      text += resolveVariable(block.varId, cqlOutput, treatmentPlan);
    } else if (block.type === 'cond') {
      const result = evaluateCondition(block.condition, cqlOutput, treatmentPlan);
      if (result) {
        text += block.trueText || '';
        if (block.useVar) text += resolveVariable(block.useVar, cqlOutput, treatmentPlan);
      } else {
        text += block.falseText || '';
      }
    }
  }
  return text;
}

// ============================================================
// Component: TemplateEditor — the modular block editor
// ============================================================

function TemplateEditor({ blocks, onChange, cqlOutput, treatmentPlan, readOnly }) {
  const [dragIndex, setDragIndex] = useState(null);

  function updateBlock(idx, updates) {
    const next = blocks.map((b, i) => i === idx ? { ...b, ...updates } : b);
    onChange(next);
  }

  function removeBlock(idx) {
    onChange(blocks.filter((_, i) => i !== idx));
  }

  function insertBlock(idx, block) {
    const next = [...blocks];
    next.splice(idx + 1, 0, block);
    onChange(next);
  }

  function addTextBlock() {
    onChange([...blocks, { type: 'text', value: '' }]);
  }

  function addVarBlock(varId) {
    onChange([...blocks, { type: 'var', varId }]);
  }

  function addCondBlock() {
    onChange([...blocks, { type: 'cond', condition: 'hasEC90', trueText: '', falseText: '' }]);
  }

  function handleDragStart(idx) {
    setDragIndex(idx);
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
            {block.type === 'var' && <span className="tpl-var-tag">{ALL_VARS.find(v => v.id === block.varId)?.label || block.varId}</span>}
            {block.type === 'cond' && <span className="tpl-cond-tag">Hvis {CONDITION_OPTIONS.find(c => c.id === block.condition)?.label || block.condition}</span>}
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
            onDragStart={() => handleDragStart(i)}
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
              <select
                className="tpl-var-select"
                value={block.varId}
                onChange={(e) => updateBlock(i, { varId: e.target.value })}
              >
                {TEMPLATE_VARIABLES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.vars.map(v => (
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
                    {CONDITION_OPTIONS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Hvis sant:
                  <textarea
                    value={block.trueText || ''}
                    onChange={(e) => updateBlock(i, { trueText: e.target.value })}
                    rows={2}
                    placeholder="Tekst når betingelsen er sann..."
                  />
                </label>
                <label>
                  Hvis usant:
                  <textarea
                    value={block.falseText || ''}
                    onChange={(e) => updateBlock(i, { falseText: e.target.value })}
                    rows={2}
                    placeholder="Tekst når betingelsen er usann..."
                  />
                </label>
              </div>
            )}

            {/* Preview of resolved value */}
            {cqlOutput && (
              <div className="tpl-block-preview">
                {block.type === 'var' && <em>{resolveVariable(block.varId, cqlOutput, treatmentPlan)}</em>}
                {block.type === 'cond' && (
                  <em>
                    {evaluateCondition(block.condition, cqlOutput, treatmentPlan)
                      ? `✓ ${block.trueText || '(tom)'}`
                      : `✗ ${block.falseText || '(tom)'}`}
                  </em>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="template-add-bar">
        <button className="tpl-add-btn" onClick={addTextBlock}>+ Tekst</button>
        <div className="tpl-add-var-group">
          <button className="tpl-add-btn" onClick={() => addVarBlock(TEMPLATE_VARIABLES[0].vars[0].id)}>+ Variabel</button>
        </div>
        <button className="tpl-add-btn" onClick={addCondBlock}>+ Betingelse</button>
      </div>
    </div>
  );
}

// ============================================================
// Quick variable palette for insertion
// ============================================================

function VariablePalette({ onInsert }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="var-palette">
      <button className="var-palette-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Skjul variabler' : 'Vis tilgjengelige variabler'}
      </button>
      {expanded && (
        <div className="var-palette-grid">
          {TEMPLATE_VARIABLES.map(g => (
            <div key={g.group} className="var-palette-group">
              <strong>{g.group}</strong>
              <div className="var-palette-chips">
                {g.vars.map(v => (
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

// ============================================================
// Main Component
// ============================================================

export default function ReferralLetterGenerator({ result }) {
  const { treatmentPlan, cqlOutput, journalText, referralText } = result;
  const [mode, setMode] = useState('standard');  // 'standard' | 'clinical' | 'custom'
  const [copied, setCopied] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState(loadSavedTemplates());
  const [selectedCustomTemplate, setSelectedCustomTemplate] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');

  // Clinical template blocks (mode 2) — use neoadjuvant or adjuvant default
  const isNeo = cqlOutput?.isNeoadjuvant;
  const defaultClinicalBlocks = isNeo ? DEFAULT_NEOADJUVANT_TEMPLATE : DEFAULT_ADJUVANT_TEMPLATE;
  const [clinicalBlocks, setClinicalBlocks] = useState(defaultClinicalBlocks);

  // Custom template blocks (mode 3)
  const [customBlocks, setCustomBlocks] = useState([{ type: 'text', value: '' }]);

  // Update clinical template when switching between neo/adj
  useEffect(() => {
    setClinicalBlocks(isNeo ? DEFAULT_NEOADJUVANT_TEMPLATE : DEFAULT_ADJUVANT_TEMPLATE);
  }, [isNeo]);

  if (!treatmentPlan || !cqlOutput) return null;

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    });
  }

  function handleSaveCustom() {
    const name = newTemplateName.trim();
    if (!name) return;
    saveTemplate(name, customBlocks);
    setSavedTemplates(loadSavedTemplates());
    setSelectedCustomTemplate(name);
    setNewTemplateName('');
  }

  function handleLoadCustom(name) {
    const saved = loadSavedTemplates();
    if (saved[name]) {
      setCustomBlocks(saved[name]);
      setSelectedCustomTemplate(name);
    }
  }

  function handleDeleteTemplate(name) {
    deleteSavedTemplate(name);
    setSavedTemplates(loadSavedTemplates());
    if (selectedCustomTemplate === name) {
      setSelectedCustomTemplate('');
      setCustomBlocks([{ type: 'text', value: '' }]);
    }
  }

  function handleSaveClinical() {
    const name = `Klinisk - ${isNeo ? 'neoadjuvant' : 'adjuvant'}`;
    saveTemplate(name, clinicalBlocks);
    setSavedTemplates(loadSavedTemplates());
  }

  // Generate rendered text based on current mode
  let renderedText = '';
  if (mode === 'standard') {
    renderedText = journalText || '';
    if (referralText) renderedText += '\n\n---\n\n' + referralText;
  } else if (mode === 'clinical') {
    renderedText = renderTemplate(clinicalBlocks, cqlOutput, treatmentPlan);
  } else if (mode === 'custom') {
    renderedText = renderTemplate(customBlocks, cqlOutput, treatmentPlan);
  }

  const templateNames = Object.keys(savedTemplates);

  return (
    <div className="referral-generator">
      <h3>Henvisnings- og svartekst</h3>

      {/* Mode tabs */}
      <div className="ref-mode-tabs">
        <button className={`ref-tab ${mode === 'standard' ? 'active' : ''}`} onClick={() => setMode('standard')}>
          Standard
        </button>
        <button className={`ref-tab ${mode === 'clinical' ? 'active' : ''}`} onClick={() => setMode('clinical')}>
          Mal-basert svar på henvisning
        </button>
        <button className={`ref-tab ${mode === 'custom' ? 'active' : ''}`} onClick={() => setMode('custom')}>
          Egendefinert mal
        </button>
      </div>

      {/* Mode content */}
      <div className="ref-mode-content">

        {/* Rendered preview + copy — shown first for easy access */}
        <div className="ref-preview-section">
          <div className="ref-preview-header">
            <h4>Generert tekst</h4>
            <button className="copy-btn" onClick={() => copyToClipboard(renderedText)}>
              {copied ? 'Kopiert!' : 'Kopier til utklippstavle'}
            </button>
          </div>
          <pre className="ref-preview-text">{renderedText}</pre>
        </div>

        {/* MODE 1: Standard (current) */}
        {mode === 'standard' && (
          <div className="ref-standard">
            <p className="ref-description">Standardtekst generert fra retningslinjegraverens regelmotor.</p>
          </div>
        )}

        {/* MODE 2: Clinical referral letter */}
        {mode === 'clinical' && (
          <div className="ref-clinical">
            <p className="ref-description">
              Mal-basert svar på henvisning — {isNeo ? 'neoadjuvant' : 'adjuvant'} oppsett.
              Rediger malen under for å tilpasse teksten til lokale behov.
            </p>
            <TemplateEditor
              blocks={clinicalBlocks}
              onChange={setClinicalBlocks}
              cqlOutput={cqlOutput}
              treatmentPlan={treatmentPlan}
            />
            <div className="ref-clinical-actions">
              <button className="tpl-save-btn" onClick={handleSaveClinical}>Lagre mal lokalt</button>
              <button className="tpl-reset-btn" onClick={() => setClinicalBlocks(defaultClinicalBlocks)}>Tilbakestill standard</button>
            </div>
          </div>
        )}

        {/* MODE 3: Custom template */}
        {mode === 'custom' && (
          <div className="ref-custom">
            <p className="ref-description">
              Bygg din egen mal med fritekst og dynamiske variabler fra pasientdata og behandlingsresultater.
              Maler lagres lokalt i nettleseren.
            </p>

            {/* Saved templates */}
            {templateNames.length > 0 && (
              <div className="ref-saved-templates">
                <strong>Lagrede maler:</strong>
                <div className="ref-template-list">
                  {templateNames.map(name => (
                    <div key={name} className="ref-template-item">
                      <button
                        className={`ref-template-btn ${selectedCustomTemplate === name ? 'active' : ''}`}
                        onClick={() => handleLoadCustom(name)}
                      >
                        {name}
                      </button>
                      <button className="ref-template-delete" onClick={() => handleDeleteTemplate(name)} title="Slett">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <VariablePalette onInsert={(varId) => setCustomBlocks([...customBlocks, { type: 'var', varId }])} />

            <TemplateEditor
              blocks={customBlocks}
              onChange={setCustomBlocks}
              cqlOutput={cqlOutput}
              treatmentPlan={treatmentPlan}
            />

            <div className="ref-save-row">
              <input
                type="text"
                className="ref-save-input"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Navn på mal..."
              />
              <button className="tpl-save-btn" onClick={handleSaveCustom} disabled={!newTemplateName.trim()}>
                Lagre mal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
