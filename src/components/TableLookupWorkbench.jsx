import React, { useState, useMemo } from 'react';
import PatientForm from './PatientForm.jsx';
import { INITIAL_STATE, normalizePatientData } from '../clinical/patientFields.js';
import { evaluateCQL, validateClinicalData } from '../cql/cqlEngine.js';
import { ALL_DECISION_TABLES } from '../dmn/decisionTables.js';
import { classifyTableRules, countByStatus, MATCH, UNKNOWN, EXCLUDED } from '../dmn/ruleMatcher.js';
import { formatSource, formatCondition, formatCDK46 } from '../dmn/ruleFormat.js';
import { renderTemplate, makeTemplateStorage, copyText } from '../textgen/templateEngine.js';
import { TemplateEditor, VariablePalette } from '../textgen/TemplateEditor.jsx';
import { TEMPLATE_VARIABLES, resolveVariable, evaluateCondition } from '../textgen/clinicalVariables.js';

// ============================================================
// Hovedgrupper — NBCG-tabellene klinikeren kan slå opp i
// ============================================================

const TABLE_LIST = Object.values(ALL_DECISION_TABLES);

// ============================================================
// Malvariabler — pasientdata fra venstre kolonne, anbefaling fra valgt rad
// ============================================================

// Behandlingsresultater kommer fra regelmotorens plan. På denne siden er det
// klinikerens valgte rad som er kilden, så den gruppen utelates bevisst.
const PATIENT_VAR_GROUPS = TEMPLATE_VARIABLES.filter((g) => g.group !== 'Behandlingsresultater');

const ROW_VAR_GROUP = {
  group: 'Valgt tabellrad',
  vars: [
    { id: 'row.tableName', label: 'NBCG-tabell' },
    { id: 'row.ruleId', label: 'Regel-ID' },
    { id: 'row.ruleDesc', label: 'Regelbeskrivelse' },
    { id: 'row.regimen', label: 'Regime' },
    { id: 'row.detail', label: 'Detaljer' },
    { id: 'row.rationale', label: 'Begrunnelse' },
    { id: 'row.duration', label: 'Varighet' },
    { id: 'row.therapy', label: 'Terapi' },
    { id: 'row.warnings', label: 'Forbehold/advarsler' },
    { id: 'row.source', label: 'NBCG-kildehenvisning' },
  ],
};

const LOOKUP_VARIABLES = [...PATIENT_VAR_GROUPS, ROW_VAR_GROUP];

const LOOKUP_CONDITIONS = [
  { id: 'isTN', label: 'Er trippel negativ' },
  { id: 'isHER2pos', label: 'Er HER2-positiv' },
  { id: 'isNeoadjuvant', label: 'Er neoadjuvant' },
  { id: 'isNodePositive', label: 'Er lymfeknute-positiv' },
  { id: 'hasGeneTest', label: 'Har genekspresjonstest' },
  { id: 'row.hasRegimen', label: 'Valgt rad har regime' },
  { id: 'row.hasDuration', label: 'Valgt rad har varighet' },
  { id: 'row.hasWarnings', label: 'Valgt rad har forbehold' },
];

function resolveLookupVar(id, ctx) {
  if (!id.startsWith('row.')) {
    if (!ctx.cqlOutput) return '—';
    return resolveVariable(id, ctx.cqlOutput, null);
  }
  const o = (ctx.rule && ctx.rule.outputs) || {};
  switch (id) {
    case 'row.tableName': return ctx.table?.name || '—';
    case 'row.ruleId': return ctx.rule?.id || '—';
    case 'row.ruleDesc': return ctx.rule?.description || '—';
    case 'row.regimen': return o.regimen || '—';
    case 'row.detail': return o.detail || '—';
    case 'row.rationale': return o.rationale || '—';
    case 'row.duration': return o.duration || '—';
    case 'row.therapy': return o.therapy || '—';
    case 'row.warnings': return o.warnings?.length ? o.warnings.join('. ') : 'Ingen';
    case 'row.source': return ctx.rule ? formatSource(ctx.rule, ctx.table) : '—';
    default: return `[${id}]`;
  }
}

function evalLookupCond(id, ctx) {
  const o = (ctx.rule && ctx.rule.outputs) || {};
  switch (id) {
    case 'row.hasRegimen': return !!o.regimen;
    case 'row.hasDuration': return !!o.duration;
    case 'row.hasWarnings': return !!o.warnings?.length;
    default:
      if (!ctx.cqlOutput) return false;
      return evaluateCondition(id, ctx.cqlOutput, null);
  }
}

// Åpningen speiler «Mal-basert svar på henvisning», men anbefalingen hentes
// fra raden klinikeren valgte — ikke fra regelmotorens forslag.
const DEFAULT_LOOKUP_TEMPLATE = [
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
  { type: 'text', value: ' status.\n\nOppslag i ' },
  { type: 'var', varId: 'row.tableName' },
  { type: 'text', value: ' (rad ' },
  { type: 'var', varId: 'row.ruleId' },
  { type: 'text', value: '):\n' },
  { type: 'cond', condition: 'row.hasRegimen', trueText: 'Anbefalt: ', falseText: '' },
  { type: 'cond', condition: 'row.hasRegimen', trueText: '', falseText: '', useVar: 'row.regimen' },
  { type: 'cond', condition: 'row.hasRegimen', trueText: '. ', falseText: '' },
  { type: 'var', varId: 'row.rationale' },
  { type: 'cond', condition: 'row.hasDuration', trueText: '\nVarighet: ', falseText: '' },
  { type: 'cond', condition: 'row.hasDuration', trueText: '', falseText: '', useVar: 'row.duration' },
  { type: 'cond', condition: 'row.hasWarnings', trueText: '\n\nForbehold: ', falseText: '' },
  { type: 'cond', condition: 'row.hasWarnings', trueText: '', falseText: '', useVar: 'row.warnings' },
  { type: 'text', value: '\n\nKilde: ' },
  { type: 'var', varId: 'row.source' },
];

const lookupStorage = makeTemplateStorage('lookup2Templates');

/** Skjema uten en eneste opplysning — referansepunktet for hva klinikeren faktisk har oppgitt. */
const BLANK_FORM = Object.fromEntries(Object.keys(INITIAL_STATE).map((k) => [k, '']));

const STATUS_LABEL = {
  [MATCH]: 'Passer',
  [UNKNOWN]: 'Mulig — mangler data',
  [EXCLUDED]: 'Utelukket',
};

// ============================================================
// Komponent
// ============================================================

export default function TableLookupWorkbench() {
  const [form, setForm] = useState(INITIAL_STATE);
  // Skjemaets defaults (N0, adjuvant, BCS …) er bekvemmeligheter, ikke påstander.
  // Bare felter klinikeren faktisk har rørt får lov til å utelukke tabellrader.
  const [touched, setTouched] = useState(() => new Set());
  const [tableId, setTableId] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [blocks, setBlocks] = useState(DEFAULT_LOOKUP_TEMPLATE);
  const [savedTemplates, setSavedTemplates] = useState(() => lookupStorage.load());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copied, setCopied] = useState(false);

  // Regelmotorens avledninger kjøres på hver endring. evaluateCQL er en ren
  // derivasjon og tåler delvis utfylte data, men vi feiler mykt uansett —
  // et halvutfylt skjema skal aldri kunne krasje oppslaget.
  const derive = (source) => {
    try {
      return evaluateCQL(normalizePatientData(source));
    } catch {
      return null;
    }
  };

  // Journalteksten skal gjenspeile det klinikeren ser i skjemaet, defaults inkludert.
  const { cqlOutput, missing } = useMemo(() => ({
    cqlOutput: derive(form),
    missing: validateClinicalData(normalizePatientData(form)).errors,
  }), [form]);

  // Oppslaget skal bare snevres inn av det klinikeren faktisk har oppgitt.
  //
  // To ting står i veien: skjemaets defaults (N0, adjuvant, BCS), og at
  // evaluateCQL alltid gir konkrete avledninger — `cdk46eligible` er `false`
  // også for et helt tomt skjema. Begge deler ville utelukket rader før
  // klinikeren har tatt stilling til noe.
  //
  // Derfor sammenlignes avledningen med et blankt skjema: bare fakta som
  // faktisk skyldes noe klinikeren har fylt ut, får utelukke en rad. Fakta som
  // sammenfaller med blank-verdien lar raden stå som «mulig». Det gjør at
  // verktøyet heller viser en rad for mye enn skjuler en klinikeren trengte.
  const lookupContext = useMemo(() => {
    const asserted = {};
    for (const key of Object.keys(form)) asserted[key] = touched.has(key) ? form[key] : '';

    const derived = derive(asserted) || {};
    const baseline = derive(BLANK_FORM) || {};

    const context = {};
    for (const [key, value] of Object.entries(derived)) {
      if (value !== baseline[key]) context[key] = value;
    }
    return context;
  }, [form, touched]);

  const table = tableId ? ALL_DECISION_TABLES[tableId] : null;

  const classified = useMemo(
    () => (table ? classifyTableRules(table, lookupContext) : []),
    [table, lookupContext],
  );
  const counts = useMemo(() => countByStatus(classified), [classified]);

  const selectedEntry = classified.find((c) => c.rule.id === selectedRuleId) || null;
  const selectedRule = selectedEntry?.rule || null;

  const genCtx = { cqlOutput, rule: selectedRule, table };
  const renderedText = useMemo(
    () => (selectedRule ? renderTemplate(blocks, (id) => resolveLookupVar(id, genCtx), (id) => evalLookupCond(id, genCtx)) : ''),
    // genCtx er avledet av de tre feltene under; egen referanse hver render
    [blocks, selectedRule, table, cqlOutput],
  );

  function handleSelectTable(id) {
    setTableId(id);
    setSelectedRuleId(null);
    setShowExcluded(false);
  }

  function handleFormChange(next) {
    setTouched((prev) => {
      const marked = new Set(prev);
      for (const key of Object.keys(next)) {
        if (next[key] !== form[key]) marked.add(key);
      }
      return marked;
    });
    setForm(next);
  }

  function handleReset() {
    setForm(INITIAL_STATE);
    setTouched(new Set());
    setTableId('');
    setSelectedRuleId(null);
  }

  function handleCopy() {
    copyText(renderedText, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSaveTemplate() {
    const name = newTemplateName.trim();
    if (!name) return;
    lookupStorage.save(name, blocks);
    setSavedTemplates(lookupStorage.load());
    setNewTemplateName('');
  }

  function handleDeleteTemplate(name) {
    lookupStorage.remove(name);
    setSavedTemplates(lookupStorage.load());
  }

  const visibleRows = showExcluded ? classified : classified.filter((c) => c.status !== EXCLUDED);
  const savedNames = Object.keys(savedTemplates);

  return (
    <div className="tlw">
      <div className="tlw-header">
        <h2>Tabelloppslag 2.0</h2>
        <p className="tlw-subtitle">
          Fyll ut det du vet, finn riktig NBCG-rad selv, og få journalteksten bygget av
          pasientdata og den raden du valgte. Ingen algoritme velger behandling her.
        </p>
      </div>

      <div className="tlw-grid">
        {/* ================= 01 GRUNNLAG ================= */}
        <section className="tlw-col tlw-col-input">
          <div className="tlw-col-head">
            <span className="tlw-step">01 / Grunnlag</span>
            <div className="tlw-col-title-row">
              <h3>Pasientopplysninger</h3>
              <button className="tlw-reset" onClick={handleReset}>Nullstill</button>
            </div>
            <p className="tlw-col-desc">
              Angi opplysninger for å avgrense tabellradene. Ingen personidentifiserende data.
            </p>
          </div>

          <label className="tlw-group-select">
            Hovedgruppe (NBCG-tabell)
            <select value={tableId} onChange={(e) => handleSelectTable(e.target.value)}>
              <option value="">Velg hovedgruppe …</option>
              {TABLE_LIST.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <PatientForm embedded value={form} onChange={handleFormChange} />

          {missing.length > 0 && (
            <div className="tlw-missing">
              <strong>Ikke utfylt ennå:</strong>
              <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
              <p>Radene under snevres inn etter hvert som feltene fylles ut.</p>
            </div>
          )}

          <p className="tlw-privacy">Opplysninger og utkast beholdes bare mens siden er åpen.</p>
        </section>

        {/* ================= 02 OPPSLAG ================= */}
        <section className="tlw-col tlw-col-lookup">
          <div className="tlw-col-head">
            <span className="tlw-step">02 / Oppslag</span>
            <h3>Relevante tabellrader</h3>
            {table && (
              <p className="tlw-col-desc">
                {counts[MATCH]} passer · {counts[UNKNOWN]} mulige · {counts[EXCLUDED]} utelukket
              </p>
            )}
          </div>

          {selectedRule && (
            <div className="tlw-selected-bar">
              <span className="tlw-selected-check">✓</span>
              <span className="tlw-selected-text">
                Valgt rad: <strong>{table.name}</strong> · rad <strong>{selectedRule.id}</strong>
              </span>
              <button className="tlw-clear-btn" onClick={() => setSelectedRuleId(null)}>Fjern valg</button>
            </div>
          )}

          {!table ? (
            <div className="tlw-empty">
              <div className="tlw-empty-icon">☰</div>
              <h4>Finn riktig rad i NBCG</h4>
              <p>Velg hovedgruppe til venstre. Oppslaget avgrenses etter hvert som du fyller ut.</p>
            </div>
          ) : (
            <>
              <div className="tlw-table-source">📖 {formatSource(null, table)}</div>

              <div className="tlw-rows">
                {visibleRows.map(({ rule, status, unknownKeys }) => {
                  const isSelected = rule.id === selectedRuleId;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      className={`tlw-row tlw-${status}${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelectedRuleId(isSelected ? null : rule.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="tlw-row-head">
                        <span className="tlw-rule-id">{rule.id}</span>
                        <span className={`tlw-status tlw-status-${status}`}>{STATUS_LABEL[status]}</span>
                        {isSelected && <span className="tlw-chosen">✓ Valgt</span>}
                      </div>

                      {rule.description && <div className="tlw-row-desc">{rule.description}</div>}

                      <RuleOutputs outputs={rule.outputs} />

                      {status === UNKNOWN && unknownKeys.length > 0 && (
                        <div className="tlw-row-unknown">Avhenger av: {unknownKeys.join(', ')}</div>
                      )}

                      <div className="tlw-row-conditions">
                        {Object.entries(rule.conditions || {}).map(([key, val]) => (
                          <span key={key} className="tlw-cond-chip">
                            <strong>{key}</strong>: {formatCondition(val)}
                          </span>
                        ))}
                      </div>

                      <div className="tlw-row-source">{formatSource(rule, table)}</div>
                    </button>
                  );
                })}
              </div>

              {counts[EXCLUDED] > 0 && (
                <button className="tlw-toggle-excluded" onClick={() => setShowExcluded(!showExcluded)}>
                  {showExcluded ? 'Skjul utelukkede rader' : `Vis utelukkede rader (${counts[EXCLUDED]})`}
                </button>
              )}
            </>
          )}
        </section>

        {/* ================= 03 DOKUMENTASJON ================= */}
        <section className="tlw-col tlw-col-doc">
          <div className="tlw-col-head">
            <span className="tlw-step">03 / Dokumentasjon</span>
            <div className="tlw-col-title-row">
              <h3>Journalutkast</h3>
              <span className="tlw-count">{renderedText.length}</span>
            </div>
            <p className="tlw-col-desc">Mal-basert svar på henvisning</p>
          </div>

          {!selectedRule ? (
            <div className="tlw-empty">
              <div className="tlw-empty-icon">¶</div>
              <h4>Fra tabell til utkast</h4>
              <p>Velg en tabellrad for å samle originaltekst, forbehold og kilde her.</p>
            </div>
          ) : (
            <>
              <div className="tlw-doc-ref">
                Bygget på <strong>{table.name}</strong> · rad <strong>{selectedRule.id}</strong>
              </div>

              <div className="tlw-preview-head">
                <h4>Generert tekst</h4>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? 'Kopiert!' : 'Kopier til utklippstavle'}
                </button>
              </div>
              <pre className="tlw-preview">{renderedText}</pre>

              <details className="tlw-template" open>
                <summary>Malen</summary>
                <p className="tlw-template-note">
                  Teksten bygges av pasientopplysningene til venstre og raden du valgte i midten.
                  Rediger blokkene for å tilpasse formuleringene lokalt.
                </p>

                {savedNames.length > 0 && (
                  <div className="tlw-saved">
                    <strong>Lagrede maler:</strong>
                    {savedNames.map((name) => (
                      <span key={name} className="tlw-saved-item">
                        <button onClick={() => setBlocks(savedTemplates[name])}>{name}</button>
                        <button className="tlw-saved-del" onClick={() => handleDeleteTemplate(name)} title="Slett">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <VariablePalette
                  variables={LOOKUP_VARIABLES}
                  onInsert={(varId) => setBlocks([...blocks, { type: 'var', varId }])}
                />

                <TemplateEditor
                  blocks={blocks}
                  onChange={setBlocks}
                  variables={LOOKUP_VARIABLES}
                  conditions={LOOKUP_CONDITIONS}
                  resolvePreview={(id) => resolveLookupVar(id, genCtx)}
                  evalPreview={(id) => evalLookupCond(id, genCtx)}
                />

                <div className="tlw-template-actions">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Navn på mal…"
                  />
                  <button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>Lagre mal</button>
                  <button onClick={() => setBlocks(DEFAULT_LOOKUP_TEMPLATE)}>Tilbakestill standard</button>
                </div>
              </details>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Radens anbefalingsfelter — bare de som faktisk er satt. */
function RuleOutputs({ outputs }) {
  if (!outputs) return null;
  const rows = [
    ['Regime', outputs.regimen],
    ['Detaljer', outputs.detail],
    ['Begrunnelse', outputs.rationale],
    ['Varighet', outputs.duration],
    ['Terapi', outputs.therapy],
    ['Behandlingsvei', outputs.pathway],
    ['HER2-status', outputs.her2Result],
    ['Abemaciclib', outputs.abemaciclib && formatCDK46(outputs.abemaciclib)],
    ['Ribociclib', outputs.ribociclib && formatCDK46(outputs.ribociclib)],
    ['Anbefalt', outputs.recommended],
    ['Type', outputs.type],
    ['Aktuelt', typeof outputs.eligible === 'boolean' ? (outputs.eligible ? 'Ja' : 'Nei') : outputs.eligible],
  ].filter(([, v]) => v != null && v !== '');

  return (
    <div className="tlw-row-outputs">
      {rows.map(([key, val]) => (
        <div key={key} className="tlw-out">
          <span className="tlw-out-key">{key}</span>
          <span className="tlw-out-val">{String(val)}</span>
        </div>
      ))}
      {outputs.warnings?.length > 0 && (
        <div className="tlw-row-warnings">
          <span className="tlw-out-key">Forbehold</span>
          <ul>{outputs.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
