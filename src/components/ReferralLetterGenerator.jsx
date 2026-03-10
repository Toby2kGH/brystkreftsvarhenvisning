import React, { useState, useEffect, useRef } from 'react';

// ============================================================
// Available template variables — grouped by clinical category
// ============================================================

const TEMPLATE_VARIABLES = [
  { group: 'Diagnose', vars: [
    { id: 'diagnosisCode', label: 'Diagnosekode (C50.9 + evt C77.9)', resolver: (cql) => {
      let code = 'C50.9 Ca mammae';
      if (cql.nStage && cql.nStage !== 'N0') code += ', C77.9 Lymfeknutemetastase';
      return code;
    }},
    { id: 'bioGroup', label: 'Biologisk gruppe', resolver: (cql) => cql.bioGroup || '—' },
    { id: 'luminalSubtype', label: 'Luminal subtype', resolver: (cql) => cql.luminalSubtype || '—' },
  ]},
  { group: 'Staging', vars: [
    { id: 'tStage', label: 'T-stadium', resolver: (cql) => cql.tStage || '—' },
    { id: 'nStage', label: 'N-stadium', resolver: (cql) => cql.nStage || '—' },
    { id: 'stadium', label: 'Stadium', resolver: (cql) => cql.stadium || '—' },
    { id: 'stagingFull', label: 'pTNM (full)', resolver: (cql) => `p${cql.tStage || '?'}p${cql.nStage || '?'}` },
  ]},
  { group: 'Reseptorstatus', vars: [
    { id: 'erFull', label: 'ER-status med %', resolver: (cql) => {
      if (!cql.erPositive) return 'ER negativ';
      return `ER+ (${cql.erPercent != null ? cql.erPercent + '%' : 'positiv'})`;
    }},
    { id: 'prFull', label: 'PR-status med %', resolver: (cql) => {
      if (!cql.prPositive) return 'PR negativ';
      return `PR+ (${cql.prPercent != null ? cql.prPercent + '%' : 'positiv'})`;
    }},
    { id: 'erPrCombined', label: 'ER og PR kombinert', resolver: (cql) => {
      const er = cql.erPositive ? `ER+ (${cql.erPercent != null ? cql.erPercent + '%' : ''})` : 'ER-';
      const pr = cql.prPositive ? `PR+ (${cql.prPercent != null ? cql.prPercent + '%' : ''})` : 'PR-';
      return `${er} og ${pr}`;
    }},
    { id: 'her2Full', label: 'HER2-status (IHC+SISH)', resolver: (cql) => {
      let s = `HER2 ${cql.her2Positive ? 'Pos' : 'Neg'}`;
      if (cql.her2ihc) s += ` (IHC ${cql.her2ihc}`;
      if (cql.her2sish) s += `, SISH ${cql.her2sish === 'positive' ? 'amplifisert' : 'ikke amplifisert'}`;
      if (cql.her2ihc) s += ')';
      return s;
    }},
    { id: 'ki67', label: 'Ki-67', resolver: (cql) => cql.ki67Value != null ? `Ki-67 ${cql.ki67Value}%` : '—' },
    { id: 'grade', label: 'Histologisk grad', resolver: (cql) => cql.grade ? `Grad ${cql.grade}` : '—' },
  ]},
  { group: 'Genekspresjonstest', vars: [
    { id: 'geneTestResult', label: 'Gentest med score', resolver: (cql) => {
      if (!cql.geneTestDone || cql.geneTest === 'none') return 'Ikke utført';
      if (cql.geneTest === 'prosigna') return `Prosigna ROR-score ${cql.rorScore ?? '—'}`;
      if (cql.geneTest === 'oncotypedx') return `OncotypeDX RS ${cql.rsScore ?? '—'}`;
      return cql.geneTest;
    }},
    { id: 'prosignaSubtype', label: 'Prosigna subtype', resolver: (cql) => {
      if (cql.prosignaSubtype === 'lumA') return 'Luminal A';
      if (cql.prosignaSubtype === 'lumB') return 'Luminal B';
      return '—';
    }},
  ]},
  { group: 'Pasient', vars: [
    { id: 'age', label: 'Alder', resolver: (cql) => cql.age ? `${cql.age} år gammel` : '—' },
    { id: 'ageNum', label: 'Alder (kun tall)', resolver: (cql) => cql.age ? `${cql.age}` : '—' },
    { id: 'menopausalStatus', label: 'Menopausal status', resolver: (cql) => {
      const map = { pre: 'premenopausal', peri: 'perimenopausal', post: 'postmenopausal', unknown: 'usikker menopausal' };
      return map[cql.menopausalStatus] || '—';
    }},
    { id: 'menopausalCertainty', label: 'Sikker/usikker menopause', resolver: (cql) => {
      if (cql.menopausalStatus === 'post') return 'sikker postmenopausal';
      if (cql.menopausalStatus === 'pre') return 'sikker premenopausal';
      if (cql.menopausalStatus === 'peri') return 'usikker menopausal';
      return 'usikker menopausal';
    }},
    { id: 'surgeryType', label: 'Kirurgitype', resolver: (cql) => {
      if (cql.surgeryType === 'bcs') return 'brystbevarende kirurgi (BCT)';
      if (cql.surgeryType === 'mastectomy') return 'mastektomi';
      return '—';
    }},
    { id: 'treatmentMode', label: 'Behandlingsmodus', resolver: (cql) => cql.isNeoadjuvant ? 'neoadjuvant' : 'adjuvant' },
  ]},
  { group: 'Behandlingsresultater', vars: [
    { id: 'chemoRegimen', label: 'Kjemoterapiregime', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo ? chemo.detail : 'Ingen kjemoterapi';
    }},
    { id: 'chemoName', label: 'Kjemoterapinavn (kort)', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo ? chemo.name : 'Ingen kjemoterapi';
    }},
    { id: 'endocrineRegimen', label: 'Endokrin behandling', resolver: (cql, plan) => {
      const endo = plan?.steps?.find(s => s.type === 'endocrine');
      return endo ? endo.detail : 'Ingen endokrin behandling';
    }},
    { id: 'endocrineName', label: 'Endokrin behandling (kort)', resolver: (cql, plan) => {
      const endo = plan?.steps?.find(s => s.type === 'endocrine');
      return endo ? endo.name : 'Ingen endokrin behandling';
    }},
    { id: 'cdk46Regimen', label: 'CDK4/6-hemmer', resolver: (cql, plan) => {
      const cdk = plan?.steps?.find(s => s.type === 'cdk46');
      return cdk ? cdk.detail : 'Ingen CDK4/6-hemmer';
    }},
    { id: 'cdk46Name', label: 'CDK4/6-hemmer (kort)', resolver: (cql, plan) => {
      const cdk = plan?.steps?.find(s => s.type === 'cdk46');
      return cdk ? cdk.name : 'Ingen CDK4/6-hemmer';
    }},
    { id: 'radiationRegimen', label: 'Strålebehandling', resolver: (cql, plan) => {
      const rad = plan?.steps?.find(s => s.type === 'radiation');
      return rad ? rad.detail : 'Ingen strålebehandling';
    }},
    { id: 'bisphosphonate', label: 'Bisfosfonat', resolver: (cql, plan) => {
      const bis = plan?.steps?.find(s => s.type === 'bisphosphonate');
      return bis ? bis.detail : 'Ingen bisfosfonat';
    }},
    { id: 'allStepsSummary', label: 'Alle behandlingstrinn (oppsummert)', resolver: (cql, plan) => {
      if (!plan?.steps?.length) return 'Ingen behandling anbefalt';
      return plan.steps.map(s => s.name).join(', ');
    }},
    { id: 'allStepsDetailed', label: 'Alle behandlingstrinn (detaljert)', resolver: (cql, plan) => {
      if (!plan?.steps?.length) return 'Ingen behandling anbefalt';
      return plan.steps.map((s, i) => `${i + 1}. ${s.detail || s.name}`).join('. ');
    }},
    { id: 'warnings', label: 'Merknader/varsler', resolver: (cql, plan) => {
      if (!plan?.warnings?.length) return 'Ingen merknader';
      return plan.warnings.join('. ');
    }},
    { id: 'hasEC90', label: 'Inneholder EC90 (ja/nei)', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo && chemo.detail?.includes('EC90') ? 'ja' : 'nei';
    }},
  ]},
];

// Flatten for easy lookup
const ALL_VARS = TEMPLATE_VARIABLES.flatMap(g => g.vars);

function resolveVariable(varId, cqlOutput, treatmentPlan) {
  const v = ALL_VARS.find(v => v.id === varId);
  if (!v) return `[${varId}]`;
  return v.resolver(cqlOutput, treatmentPlan);
}

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
  { type: 'text', value: '\n\nVidere indikasjon for adjuvant behandling med ' },
  { type: 'var', varId: 'endocrineRegimen' },
  { type: 'text', value: '.' },
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
// Condition evaluators for conditional blocks
// ============================================================

function evaluateCondition(condId, cqlOutput, treatmentPlan) {
  switch (condId) {
    case 'hasEC90': {
      const chemo = treatmentPlan?.steps?.find(s => s.type === 'chemo');
      return !!(chemo && chemo.detail?.includes('EC90'));
    }
    case 'isTN': return cqlOutput.bioGroup === 'TN';
    case 'isHER2pos': return cqlOutput.her2Positive === true;
    case 'isNeoadjuvant': return cqlOutput.isNeoadjuvant === true;
    case 'hasWarnings': return (treatmentPlan?.warnings?.length ?? 0) > 0;
    case 'hasChemo': return !!treatmentPlan?.steps?.find(s => s.type === 'chemo');
    case 'hasCDK46': return !!treatmentPlan?.steps?.find(s => s.type === 'cdk46');
    case 'hasEndocrine': return !!treatmentPlan?.steps?.find(s => s.type === 'endocrine');
    case 'hasRadiation': return !!treatmentPlan?.steps?.find(s => s.type === 'radiation');
    case 'hasBisphosphonate': return !!treatmentPlan?.steps?.find(s => s.type === 'bisphosphonate');
    case 'hasGeneTest': return cqlOutput.geneTestDone && cqlOutput.geneTest !== 'none';
    case 'isNodePositive': return cqlOutput.nStage && cqlOutput.nStage !== 'N0';
    default: return false;
  }
}

const CONDITION_OPTIONS = [
  { id: 'hasEC90', label: 'Har EC90-kjemoterapi' },
  { id: 'isTN', label: 'Er trippel negativ' },
  { id: 'isHER2pos', label: 'Er HER2-positiv' },
  { id: 'isNeoadjuvant', label: 'Er neoadjuvant' },
  { id: 'hasWarnings', label: 'Har merknader' },
  { id: 'hasChemo', label: 'Har kjemoterapi' },
  { id: 'hasCDK46', label: 'Har CDK4/6-hemmer' },
  { id: 'hasEndocrine', label: 'Har endokrin behandling' },
  { id: 'hasRadiation', label: 'Har strålebehandling' },
  { id: 'hasBisphosphonate', label: 'Har bisfosfonat' },
  { id: 'hasGeneTest', label: 'Har genekspresjonstest' },
  { id: 'isNodePositive', label: 'Er lymfeknute-positiv' },
];

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
          Klinisk svar
        </button>
        <button className={`ref-tab ${mode === 'custom' ? 'active' : ''}`} onClick={() => setMode('custom')}>
          Egendefinert mal
        </button>
      </div>

      {/* Mode content */}
      <div className="ref-mode-content">

        {/* MODE 1: Standard (current) */}
        {mode === 'standard' && (
          <div className="ref-standard">
            <p className="ref-description">Standardtekst generert fra beslutningsstøtten, slik den er i dag.</p>
          </div>
        )}

        {/* MODE 2: Clinical referral letter */}
        {mode === 'clinical' && (
          <div className="ref-clinical">
            <p className="ref-description">
              Klinisk svar på henvisning — {isNeo ? 'neoadjuvant' : 'adjuvant'} oppsett.
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

        {/* Rendered preview + copy */}
        <div className="ref-preview-section">
          <div className="ref-preview-header">
            <h4>Forhåndsvisning</h4>
            <button className="copy-btn" onClick={() => copyToClipboard(renderedText)}>
              {copied ? 'Kopiert!' : 'Kopier til utklippstavle'}
            </button>
          </div>
          <pre className="ref-preview-text">{renderedText}</pre>
        </div>
      </div>
    </div>
  );
}
