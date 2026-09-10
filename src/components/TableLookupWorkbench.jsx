import React, { useState, useMemo } from 'react';
import PatientForm from './PatientForm.jsx';
import { INITIAL_STATE, normalizePatientData } from '../clinical/patientFields.js';
import { evaluateCQL, validateClinicalData } from '../cql/cqlEngine.js';
import { tableGeneTest, tableNoGeneTest, addonTables } from '../tablelookup/guidelineTables.js';
import { toLookupInput, isUnmappedNStage, N1MI_NOTE, BIO_GROUP_OPTIONS } from '../tablelookup/patientInput.js';
import { classifyTable, countByStatus, FIELD_LABELS, MATCH, UNKNOWN, EXCLUDED } from '../tablelookup/rowStatus.js';
import { buildJournalText, buildRationaleText, buildRowPath } from '../tablelookup/journalText.js';
import { renderTemplate, makeTemplateStorage, copyText } from '../textgen/templateEngine.js';
import { TemplateEditor, VariablePalette } from '../textgen/TemplateEditor.jsx';
import { TEMPLATE_VARIABLES, resolveVariable, evaluateCondition } from '../textgen/clinicalVariables.js';

// ============================================================
// Malvariabler — pasientdata fra venstre kolonne, ordrett tekst fra valgt rad
// ============================================================

// Behandlingsresultater kommer fra regelmotorens plan. På denne siden er det
// den ordrette tabellraden klinikeren valgte som er kilden, så den utelates.
const PATIENT_VAR_GROUPS = TEMPLATE_VARIABLES.filter((g) => g.group !== 'Behandlingsresultater');

const ROW_VARS = [
  { id: 'row.recommendation', label: 'Anbefaling (ordrett)' },
  { id: 'row.grunnlag', label: 'Grunnlag/forbehold (ordrett)' },
  { id: 'row.path', label: 'Rad (oppslagsvei)' },
  { id: 'row.tableTitle', label: 'Tabellens tittel' },
  { id: 'row.source', label: 'Kilde' },
  { id: 'row.footnotes', label: 'Fotnoter' },
];

const LOOKUP_CONDITIONS = [
  { id: 'isTN', label: 'Er trippel negativ' },
  { id: 'isHER2pos', label: 'Er HER2-positiv' },
  { id: 'isNodePositive', label: 'Er lymfeknute-positiv' },
  { id: 'hasGeneTest', label: 'Har genekspresjonstest' },
  { id: 'row.hasGrunnlag', label: 'Valgt rad har grunnlag/forbehold' },
  { id: 'row.hasFootnotes', label: 'Tabellen har fotnoter' },
];

/** Én variabel per tabellkolonne, merket med tabellens egen kolonneoverskrift. */
function cellVarsFor(table) {
  if (!table) return [];
  return table.columns.map((col, i) => ({ id: `cell.${i}`, label: col.replace(/\s+/g, ' ').trim() }));
}

function variablesFor(table) {
  const groups = [...PATIENT_VAR_GROUPS, { group: 'Valgt tabellrad', vars: ROW_VARS }];
  const cells = cellVarsFor(table);
  if (cells.length) groups.push({ group: 'Tabellceller (ordrett)', vars: cells });
  return groups;
}

function resolveLookupVar(id, ctx) {
  const { row, table, cqlOutput } = ctx;

  if (id.startsWith('cell.')) {
    if (!row || !table) return '—';
    return (row.cells[Number(id.slice(5))] || '').trim() || '—';
  }

  if (!id.startsWith('row.')) {
    return cqlOutput ? resolveVariable(id, cqlOutput, null) : '—';
  }

  if (!row || !table) return '—';
  switch (id) {
    case 'row.recommendation': return buildJournalText(row, table.recCols) || '—';
    case 'row.grunnlag': return buildRationaleText(row, table) || 'Ingen';
    case 'row.path': return buildRowPath(row, table) || '—';
    case 'row.tableTitle': return table.title;
    case 'row.source': return table.source;
    case 'row.footnotes': return table.footnotes?.length ? table.footnotes.join('\n') : 'Ingen';
    default: return `[${id}]`;
  }
}

function evalLookupCond(id, ctx) {
  const { row, table, cqlOutput } = ctx;
  switch (id) {
    case 'row.hasGrunnlag': return !!(row && table && buildRationaleText(row, table));
    case 'row.hasFootnotes': return !!table?.footnotes?.length;
    default: return cqlOutput ? evaluateCondition(id, cqlOutput, null) : false;
  }
}

// Åpningen speiler «Mal-basert svar på henvisning», men anbefalingen er den
// ordrette teksten fra raden klinikeren valgte — ikke regelmotorens forslag.
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
  { type: 'text', value: ' status.\n\nOppslag: ' },
  { type: 'var', varId: 'row.path' },
  { type: 'text', value: '\n\nAnbefaling iht. tabell:\n' },
  { type: 'var', varId: 'row.recommendation' },
  { type: 'cond', condition: 'row.hasGrunnlag', trueText: '\n\nGrunnlag for eventuelt annet terapivalg:\n', falseText: '' },
  { type: 'cond', condition: 'row.hasGrunnlag', trueText: '', falseText: '', useVar: 'row.grunnlag' },
  { type: 'text', value: '\n\nKilde: ' },
  { type: 'var', varId: 'row.source' },
];

const lookupStorage = makeTemplateStorage('lookup2Templates');

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
  const [bioOverride, setBioOverride] = useState('');
  const [luminalOverride, setLuminalOverride] = useState('');
  const [selected, setSelected] = useState(null); // { tableId, rowIndex }
  const [showExcluded, setShowExcluded] = useState({});
  const [blocks, setBlocks] = useState(DEFAULT_LOOKUP_TEMPLATE);
  const [savedTemplates, setSavedTemplates] = useState(() => lookupStorage.load());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copied, setCopied] = useState(false);

  // evaluateCQL er en ren derivasjon og tåler delvis utfylte data, men vi
  // feiler mykt uansett — et halvutfylt skjema skal aldri krasje oppslaget.
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
  // Skjemaets defaults sammenlignes derfor mot et blankt skjema, og bare felter
  // klinikeren har rørt regnes som påstander.
  const assertedForm = useMemo(() => {
    const asserted = {};
    for (const key of Object.keys(form)) asserted[key] = touched.has(key) ? form[key] : '';
    return asserted;
  }, [form, touched]);

  const { input, derivedBioGroup, luminalSuggestion } = useMemo(
    () => toLookupInput(assertedForm, derive(assertedForm), {
      bioGroup: bioOverride,
      luminalLike: luminalOverride,
    }),
    [assertedForm, bioOverride, luminalOverride],
  );

  // Hvilke tabeller som er i spill følger samme regel som Tabelloppslag-fanen:
  // primærtabellen avhenger av om gentest foreligger, tillegg av hovedgruppen.
  const relevantTables = useMemo(() => {
    const primary = input.geneTestAvailable ? tableGeneTest : tableNoGeneTest;
    const list = [{ table: primary, role: 'Primæranbefaling' }];
    for (const addon of addonTables) {
      if (!addon.appliesToBioGroups || addon.appliesToBioGroups.includes(input.bioGroup)) {
        list.push({ table: addon, role: 'Tilleggsbehandling' });
      }
    }
    return list;
  }, [input.geneTestAvailable, input.bioGroup]);

  const sections = useMemo(
    () => relevantTables.map(({ table, role }) => {
      const rows = classifyTable(table, input);
      return { table, role, rows, counts: countByStatus(rows) };
    }),
    [relevantTables, input],
  );

  const selectedSection = selected ? sections.find((s) => s.table.id === selected.tableId) : null;
  const selectedTable = selectedSection?.table || null;
  const selectedRow = selectedTable ? selectedTable.rows[selected.rowIndex] : null;

  const genCtx = { cqlOutput, row: selectedRow, table: selectedTable };
  const variables = useMemo(() => variablesFor(selectedTable), [selectedTable]);
  const renderedText = useMemo(
    () => (selectedRow
      ? renderTemplate(blocks, (id) => resolveLookupVar(id, genCtx), (id) => evalLookupCond(id, genCtx))
      : ''),
    [blocks, selectedRow, selectedTable, cqlOutput],
  );

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
    setBioOverride('');
    setLuminalOverride('');
    setSelected(null);
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

  const savedNames = Object.keys(savedTemplates);
  const showLuminalControl = !input.geneTestAvailable && input.bioGroup === 'HR+HER2-';

  return (
    <div className="tlw">
      <div className="tlw-header">
        <h2>Tabelloppslag 2.0</h2>
        <p className="tlw-subtitle">
          Fyll ut det du vet, velg riktig rad i de ordrette NBCG-tabellene selv, og få
          journalteksten bygget av pasientdata og tabellens egen tekst. Ingen algoritme
          velger behandling her.
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
            Hovedgruppe (HR/HER2)
            <select value={bioOverride || derivedBioGroup} onChange={(e) => setBioOverride(e.target.value)}>
              <option value="">— Utledes fra reseptorstatus —</option>
              {BIO_GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {derivedBioGroup && !bioOverride && (
              <span className="tlw-derived-note">Utledet fra ER/PR/HER2 nedenfor.</span>
            )}
            {bioOverride && bioOverride !== derivedBioGroup && derivedBioGroup && (
              <span className="tlw-derived-note tlw-overridden">
                Overstyrt manuelt — reseptorstatus tilsier {derivedBioGroup}.
              </span>
            )}
          </label>

          <PatientForm embedded value={form} onChange={handleFormChange} />

          {showLuminalControl && (
            <label className="tlw-group-select">
              Luminal-liknende gruppe
              <select value={input.luminalLike} onChange={(e) => setLuminalOverride(e.target.value)}>
                <option value="">— Ikke bestemt —</option>
                <option value="A">Lum A-liknende</option>
                <option value="B">LumB-liknende</option>
                <option value="inconclusive">Ikke konklusiv</option>
              </select>
              {luminalSuggestion && (
                <span className="tlw-derived-note">
                  {luminalSuggestion.explanation}
                  {luminalOverride ? ' (overstyrt manuelt)' : ''}
                </span>
              )}
            </label>
          )}

          {isUnmappedNStage(form) && <div className="tlw-missing"><p>{N1MI_NOTE}</p></div>}

          {missing.length > 0 && (
            <div className="tlw-missing">
              <strong>Ikke utfylt ennå:</strong>
              <ul>{missing.map((m) => <li key={m}>{m}</li>)}</ul>
              <p>Radene til høyre snevres inn etter hvert som feltene fylles ut.</p>
            </div>
          )}

          <p className="tlw-privacy">Opplysninger og utkast beholdes bare mens siden er åpen.</p>
        </section>

        {/* ================= 02 OPPSLAG ================= */}
        <section className="tlw-col tlw-col-lookup">
          <div className="tlw-col-head">
            <span className="tlw-step">02 / Oppslag</span>
            <h3>Relevante tabellrader</h3>
          </div>

          {selectedRow && (
            <div className="tlw-selected-bar">
              <span className="tlw-selected-check">✓</span>
              <span className="tlw-selected-text">
                Valgt rad: <strong>{buildRowPath(selectedRow, selectedTable)}</strong> — {selectedTable.shortTitle}
              </span>
              <button className="tlw-clear-btn" onClick={() => setSelected(null)}>Fjern valg</button>
            </div>
          )}

          {!input.bioGroup ? (
            <div className="tlw-empty">
              <div className="tlw-empty-icon">☰</div>
              <h4>Finn riktig rad i NBCG</h4>
              <p>Velg hovedgruppe til venstre. Oppslaget avgrenses etter hvert som du fyller ut.</p>
            </div>
          ) : (
            sections.map(({ table, role, rows, counts }) => {
              const expanded = !!showExcluded[table.id];
              const visible = expanded ? rows : rows.filter((r) => r.status !== EXCLUDED);
              return (
                <div key={table.id} className="tlw-section">
                  <div className="tlw-section-head">
                    <span className="tlw-role-badge">{role}</span>
                    <strong>{table.shortTitle}</strong>
                    <span className="tlw-section-counts">
                      {counts[MATCH]} passer · {counts[UNKNOWN]} mulige · {counts[EXCLUDED]} utelukket
                    </span>
                  </div>
                  <div className="tlw-table-source">📖 {table.source}</div>

                  <div className="tlw-rows">
                    {visible.map(({ row, index, status, unknownKeys }) => {
                      const isSelected = selected?.tableId === table.id && selected?.rowIndex === index;
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`tlw-row tlw-${status}${isSelected ? ' selected' : ''}`}
                          onClick={() => setSelected(isSelected ? null : { tableId: table.id, rowIndex: index })}
                          aria-pressed={isSelected}
                        >
                          <div className="tlw-row-head">
                            <span className="tlw-rule-id">{buildRowPath(row, table)}</span>
                            <span className={`tlw-status tlw-status-${status}`}>{STATUS_LABEL[status]}</span>
                            {isSelected && <span className="tlw-chosen">✓ Valgt</span>}
                          </div>

                          <div className="tlw-row-outputs">
                            {row.cells.map((cell, i) => {
                              const text = (cell || '').trim();
                              if (!text || i < table.mergeCount) return null;
                              const isRec = (table.recCols || []).some((rc) => rc.idx === i);
                              return (
                                <div key={i} className={`tlw-out${isRec ? ' tlw-out-rec' : ''}`}>
                                  <span className="tlw-out-key">{table.columns[i]}</span>
                                  <span className="tlw-out-val">{text}</span>
                                </div>
                              );
                            })}
                          </div>

                          {status === UNKNOWN && unknownKeys.length > 0 && (
                            <div className="tlw-row-unknown">
                              Avhenger av: {unknownKeys.map((k) => FIELD_LABELS[k] || k).join(', ')}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {counts[EXCLUDED] > 0 && (
                    <button
                      className="tlw-toggle-excluded"
                      onClick={() => setShowExcluded((p) => ({ ...p, [table.id]: !p[table.id] }))}
                    >
                      {expanded ? 'Skjul utelukkede rader' : `Vis utelukkede rader (${counts[EXCLUDED]})`}
                    </button>
                  )}

                  {table.footnotes?.length > 0 && (
                    <details className="tlw-footnotes">
                      <summary>Fotnoter og forbehold ({table.footnotes.length})</summary>
                      <ul>{table.footnotes.map((f, i) => <li key={i}>{f}</li>)}</ul>
                    </details>
                  )}
                </div>
              );
            })
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

          {!selectedRow ? (
            <div className="tlw-empty">
              <div className="tlw-empty-icon">¶</div>
              <h4>Fra tabell til utkast</h4>
              <p>Velg en tabellrad for å samle originaltekst, forbehold og kilde her.</p>
            </div>
          ) : (
            <>
              <div className="tlw-doc-ref">
                Bygget på <strong>{buildRowPath(selectedRow, selectedTable)}</strong> i {selectedTable.shortTitle}
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
                  Teksten bygges av pasientopplysningene til venstre og den ordrette teksten
                  i raden du valgte. Rediger blokkene for å tilpasse formuleringene lokalt.
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
                  variables={variables}
                  onInsert={(varId) => setBlocks([...blocks, { type: 'var', varId }])}
                />

                <TemplateEditor
                  blocks={blocks}
                  onChange={setBlocks}
                  variables={variables}
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
