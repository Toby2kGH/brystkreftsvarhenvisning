import React, { useState, useMemo } from 'react';
import {
  tableGeneTest,
  tableNoGeneTest,
  addonTables,
  guidelineTables,
  sharedRegimens,
} from '../tablelookup/guidelineTables.js';
import { findMatchingRows } from '../tablelookup/matcher.js';
import { MultilineText, computeSpans } from '../tablelookup/tableGrid.jsx';
import { buildRowPath } from '../tablelookup/journalText.js';
import { buildPickedText, describePick, hasPick, movePick } from '../tablelookup/lookupText.js';
import { buildIntro } from '../tablelookup/introText.js';
import { renderTemplate, makeTemplateStorage, copyText } from '../textgen/templateEngine.js';
import { TemplateEditor, VariablePalette } from '../textgen/TemplateEditor.jsx';
import { SCOPE_NOTE } from '../guidelineVersion.js';

// ================================================================
//  Tabelloppslag 1.1 — oppslagsverktøy der legen plukker selv
//
//  Forskjellen fra 1.05: markert er ikke det samme som valgt. Tabellen
//  markerer fortsatt hver rad som passer opplysningene, men det er bare
//  informasjon om hvor pasienten lander. Journalutkastet starter tomt, og
//  legen legger til de radene og fotnotene som faktisk gjelder, i den
//  rekkefølgen han vil ha dem.
//
//  Som i 1.05 regner verktøyet ingenting ut, og hele tabellen står alltid.
// ================================================================

const BIO_GROUPS = [
  { value: 'HR+HER2-', label: 'HR+ HER2-' },
  { value: 'HR+HER2+', label: 'HR+ HER2+' },
  { value: 'HR-HER2+', label: 'HR- HER2+' },
  { value: 'HR-HER2-', label: 'HR- HER2- (trippel negativ)' },
];

const T_STAGES = ['pT1a', 'pT1b', 'pT1c', 'pT2', 'pT3', 'pT4'];
const N_STAGES = ['pN0', 'pN1', 'pN2', 'pN3'];

const LUMINAL_OPTIONS = [
  { value: 'A', label: 'Lum A-liknende' },
  { value: 'B', label: 'LumB-liknende' },
  { value: 'inconclusive', label: 'Ikke konklusiv Luminal gruppe' },
];

// Tabellens egne karakteristika, ordrett som lesehjelp. Legen leser kriteriene
// og velger selv — verktøyet klassifiserer ikke.
const LUMINAL_CRITERIA =
  'Lum A-liknende: Ki67<10%, G1-2, HR>50%. ' +
  'LumB-liknende: 1) Ki67>35%, eller 2) grad 3 og samsvarende høy Ki67, eller 3) HR<50%. ' +
  'Ki67 mellom 10% og 35% bør ikke benyttes for vurdering av grunnlag for kjemoterapi.';

const EMPTY_LOOKUP = {
  bioGroup: '',
  tStage: '',
  nStage: '',
  menopausal: '',
  geneTestAvailable: false,
  geneTest: '',
  prosignaSubtype: '',
  rorScore: '',
  rsScore: '',
  luminalLike: '',
};

// Felter som aldri påvirker oppslaget — kun transkribert til teksten.
const EMPTY_JOURNAL = { erPercent: '', prPercent: '', her2: '', ki67: '', grade: '', age: '' };

/** Forenklet T ('pT2' → 'T2') for CDK4/6-tabellen. Ren omskriving av legens eget valg. */
function simpleT(tStage) {
  if (!tStage) return '';
  if (tStage.startsWith('pT1')) return 'T1';
  return tStage.replace(/^p/, '');
}

// ---- Malvariabler ----------------------------------------------

const TEMPLATE_VARIABLES = [
  { group: 'Oppgitt av deg', vars: [
    { id: 'innledning', label: 'Innledning (hele setningen)' },
    { id: 'hovedgruppe', label: 'Hovedgruppe (HR/HER2)' },
    { id: 'tnm', label: 'T- og N-stadium' },
    { id: 'menopausal', label: 'Menopausal status' },
    { id: 'luminal', label: 'Luminal-liknende gruppe' },
    { id: 'alder', label: 'Alder' },
    { id: 'erPr', label: 'ER og PR' },
    { id: 'ki67', label: 'Ki-67' },
    { id: 'grad', label: 'Histologisk grad' },
  ]},
  { group: 'Valgt fra tabellene', vars: [
    { id: 'utvalg', label: 'Alt du har lagt til, i din rekkefølge' },
  ]},
];

const TEMPLATE_CONDITIONS = [
  { id: 'harInnledning', label: 'Innledningen har innhold' },
  { id: 'harUtvalg', label: 'Noe er lagt til i utkastet' },
];

function resolveVar(id, ctx) {
  const { lookup, journal, picks } = ctx;
  const blank = (v) => (v === '' || v == null ? '' : v);
  switch (id) {
    case 'innledning': return buildIntro(lookup, journal);
    case 'hovedgruppe': return blank(BIO_GROUPS.find((b) => b.value === lookup.bioGroup)?.label);
    case 'tnm': return [lookup.tStage, lookup.nStage].filter(Boolean).join('');
    case 'menopausal': return lookup.menopausal === 'post' ? 'postmenopausal'
      : lookup.menopausal === 'pre' ? 'premenopausal' : '';
    case 'luminal': return blank(LUMINAL_OPTIONS.find((l) => l.value === lookup.luminalLike)?.label);
    case 'alder': return journal.age !== '' ? `${journal.age} år` : '';
    case 'erPr': return [
      journal.erPercent !== '' ? `ER ${journal.erPercent} %` : '',
      journal.prPercent !== '' ? `PR ${journal.prPercent} %` : '',
    ].filter(Boolean).join(', ');
    case 'ki67': return journal.ki67 !== '' ? `Ki-67 ${journal.ki67} %` : '';
    case 'grad': return journal.grade !== '' ? `grad ${journal.grade}` : '';
    case 'utvalg': return buildPickedText(picks, guidelineTables);
    default: return `[${id}]`;
  }
}

function evalCond(id, ctx) {
  switch (id) {
    case 'harInnledning': return !!buildIntro(ctx.lookup, ctx.journal);
    case 'harUtvalg': return ctx.picks.length > 0;
    default: return false;
  }
}

const DEFAULT_TEMPLATE = [
  { type: 'cond', condition: 'harInnledning', trueText: '', falseText: '', useVar: 'innledning' },
  { type: 'cond', condition: 'harInnledning', trueText: '\n\n', falseText: '' },
  { type: 'text', value: 'Oppslag i NBCG sine anbefalingstabeller:\n\n' },
  { type: 'var', varId: 'utvalg' },
];

const storage = makeTemplateStorage('lookup11PicksTemplates');

// ================================================================
//  Komponent
// ================================================================

export default function TableLookup11() {
  const [lookup, setLookup] = useState(EMPTY_LOOKUP);
  const [journal, setJournal] = useState(EMPTY_JOURNAL);
  const [picks, setPicks] = useState([]);
  const [blocks, setBlocks] = useState(DEFAULT_TEMPLATE);
  const [savedTemplates, setSavedTemplates] = useState(() => storage.load());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copied, setCopied] = useState(false);

  const updateLookup = (field, value) => setLookup((p) => ({ ...p, [field]: value }));
  const updateJournal = (field, value) => setJournal((p) => ({ ...p, [field]: value }));

  const matchInput = useMemo(() => ({ ...lookup, tSimple: simpleT(lookup.tStage) }), [lookup]);

  // Relevante tabeller: primærtabell etter gentest-status, tillegg etter hovedgruppe.
  const sections = useMemo(() => {
    const primary = lookup.geneTestAvailable ? tableGeneTest : tableNoGeneTest;
    const list = [{ table: primary, role: 'Primæranbefaling' }];
    for (const addon of addonTables) {
      if (!addon.appliesToBioGroups || addon.appliesToBioGroups.includes(lookup.bioGroup)) {
        list.push({ table: addon, role: 'Tilleggsbehandling' });
      }
    }
    return list.map((s) => ({ ...s, matches: findMatchingRows(s.table, matchInput) }));
  }, [lookup.geneTestAvailable, lookup.bioGroup, matchInput]);

  const otherTable = lookup.geneTestAvailable ? tableNoGeneTest : tableGeneTest;
  const totalMatches = sections.reduce((n, s) => n + s.matches.length, 0);

  const ctx = { lookup, journal, picks };
  const renderedText = useMemo(
    () => (picks.length ? renderTemplate(blocks, (id) => resolveVar(id, ctx), (id) => evalCond(id, ctx)) : ''),
    [blocks, lookup, journal, picks],
  );

  function addPick(kind, tableId, index) {
    setPicks((prev) => (hasPick(prev, kind, tableId, index) ? prev : [...prev, { kind, tableId, index }]));
  }
  function removePick(at) {
    setPicks((prev) => prev.filter((_, i) => i !== at));
  }
  function removePickByRef(kind, tableId, index) {
    setPicks((prev) => prev.filter((p) => !(p.kind === kind && p.tableId === tableId && p.index === index)));
  }

  function handleReset() {
    setLookup(EMPTY_LOOKUP);
    setJournal(EMPTY_JOURNAL);
    setPicks([]);
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
    storage.save(name, blocks);
    setSavedTemplates(storage.load());
    setNewTemplateName('');
  }

  function handleDeleteTemplate(name) {
    storage.remove(name);
    setSavedTemplates(storage.load());
  }

  const savedNames = Object.keys(savedTemplates);
  const showLuminal = lookup.bioGroup === 'HR+HER2-' && !lookup.geneTestAvailable;

  return (
    <div className="tl11">
      <div className="tl11-header">
        <h2>Tabelloppslag 1.1</h2>
        <p className="tl11-lead">
          Du oppgir hvor pasienten hører hjemme, tabellen markerer raden, og du legger selv
          det du vil ha inn i journalutkastet.
        </p>
        <details className="tl11-about">
          <summary>Om verktøyet</summary>
          <p>
            <strong>Verktøyet regner ingenting ut.</strong> Hovedgruppe, stadium, menopausal
            status og luminal gruppe er verdier du oppgir — ingen av dem utledes fra tall.
            Ingen rad skjules eller utelukkes: hele tabellen står slik den gjør i
            handlingsprogrammet. At en rad er markert betyr bare at den passer opplysningene
            dine; ingenting havner i journalteksten før du legger det til.
          </p>
          <p>
            Dette er ingen beslutningsstøtte, og all tolkning gjøres av deg. All generert
            tekst er enten verdier du selv har oppgitt eller ordrett fra NBCG-tabellen.
            Kontroller alltid mot siste versjon av handlingsprogrammet. {SCOPE_NOTE}
          </p>
          <p className="tl11-revisions">
            Oppslaget bruker: {guidelineTables.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 && ' · '}
                {t.shortTitle} <strong>rev. {t.revision}</strong>
              </React.Fragment>
            ))}
          </p>
        </details>
      </div>

      <div className="tl11-grid">
        {/* ============ 01 GRUNNLAG ============ */}
        <section className="tl11-col tl11-col-input">
          <div className="tl11-col-head">
            <span className="tl11-step">01 / Grunnlag</span>
            <div className="tl11-title-row">
              <h3>Dine opplysninger</h3>
              <button className="tl11-reset" onClick={handleReset}>Nullstill</button>
            </div>
          </div>

          <fieldset className="tl11-fieldset tl11-fieldset-lookup">
            <legend>Styrer oppslaget</legend>

            <label className="tl11-field">
              Hovedgruppe (HR/HER2)
              <select value={lookup.bioGroup} onChange={(e) => updateLookup('bioGroup', e.target.value)}>
                <option value="">— Velg —</option>
                {BIO_GROUPS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>

            <div className="tl11-field-row">
              <label className="tl11-field">
                T-stadium (patologisk)
                <select value={lookup.tStage} onChange={(e) => updateLookup('tStage', e.target.value)}>
                  <option value="">— Velg —</option>
                  {T_STAGES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="tl11-field">
                N-stadium (patologisk)
                <select value={lookup.nStage} onChange={(e) => updateLookup('nStage', e.target.value)}>
                  <option value="">— Velg —</option>
                  {N_STAGES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>

            <label className="tl11-field">
              Menopausal status
              <select value={lookup.menopausal} onChange={(e) => updateLookup('menopausal', e.target.value)}>
                <option value="">— Velg —</option>
                <option value="pre">Premenopausal</option>
                <option value="post">Postmenopausal</option>
              </select>
            </label>

            <label className="tl11-field tl11-check">
              <input
                type="checkbox"
                checked={lookup.geneTestAvailable}
                onChange={(e) => updateLookup('geneTestAvailable', e.target.checked)}
              />
              Genekspresjonstest foreligger
            </label>

            {lookup.geneTestAvailable && (
              <>
                <label className="tl11-field">
                  Genekspresjonstest
                  <select value={lookup.geneTest} onChange={(e) => updateLookup('geneTest', e.target.value)}>
                    <option value="">— Velg —</option>
                    <option value="prosigna">Prosigna (PAM50)</option>
                    <option value="oncotypedx">OncotypeDx</option>
                  </select>
                </label>
                {lookup.geneTest === 'prosigna' && (
                  <div className="tl11-field-row">
                    <label className="tl11-field">
                      ROR-score
                      <input type="number" min="0" max="100" value={lookup.rorScore}
                        onChange={(e) => updateLookup('rorScore', e.target.value)} placeholder="0–100" />
                    </label>
                    <label className="tl11-field">
                      PAM50 subtype
                      <select value={lookup.prosignaSubtype} onChange={(e) => updateLookup('prosignaSubtype', e.target.value)}>
                        <option value="">— Velg (ved ROR 41–60) —</option>
                        <option value="lumA">Luminal A</option>
                        <option value="lumB">Luminal B</option>
                      </select>
                    </label>
                  </div>
                )}
                {lookup.geneTest === 'oncotypedx' && (
                  <label className="tl11-field">
                    Recurrence Score (RS)
                    <input type="number" min="0" max="100" value={lookup.rsScore}
                      onChange={(e) => updateLookup('rsScore', e.target.value)} placeholder="0–100" />
                  </label>
                )}
              </>
            )}

            {showLuminal && (
              <label className="tl11-field">
                Luminal-liknende gruppe
                <select value={lookup.luminalLike} onChange={(e) => updateLookup('luminalLike', e.target.value)}>
                  <option value="">— Velg —</option>
                  {LUMINAL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <span className="tl11-criteria">{LUMINAL_CRITERIA}</span>
              </label>
            )}
          </fieldset>

          <fieldset className="tl11-fieldset tl11-fieldset-journal">
            <legend>Gjengis bare i teksten</legend>

            <div className="tl11-field-row">
              <label className="tl11-field">
                ER (%)
                <input type="number" min="0" max="100" value={journal.erPercent}
                  onChange={(e) => updateJournal('erPercent', e.target.value)} placeholder="%" />
              </label>
              <label className="tl11-field">
                PR (%)
                <input type="number" min="0" max="100" value={journal.prPercent}
                  onChange={(e) => updateJournal('prPercent', e.target.value)} placeholder="%" />
              </label>
            </div>
            <div className="tl11-field-row">
              <label className="tl11-field">
                Ki-67 (%)
                <input type="number" min="0" max="100" value={journal.ki67}
                  onChange={(e) => updateJournal('ki67', e.target.value)} placeholder="%" />
              </label>
              <label className="tl11-field">
                Histologisk grad
                <select value={journal.grade} onChange={(e) => updateJournal('grade', e.target.value)}>
                  <option value="">— Velg —</option>
                  <option value="1">Grad 1</option>
                  <option value="2">Grad 2</option>
                  <option value="3">Grad 3</option>
                </select>
              </label>
            </div>
            <div className="tl11-field-row">
              <label className="tl11-field">
                HER2 (IHC/ISH)
                <input type="text" value={journal.her2}
                  onChange={(e) => updateJournal('her2', e.target.value)} placeholder="f.eks. IHC 2+, ISH negativ" />
              </label>
              <label className="tl11-field">
                Alder
                <input type="number" min="18" max="110" value={journal.age}
                  onChange={(e) => updateJournal('age', e.target.value)} placeholder="år" />
              </label>
            </div>
          </fieldset>

          <p className="tl11-privacy">Opplysninger og utkast beholdes bare mens siden er åpen.</p>
        </section>

        {/* ============ 02 TABELLENE ============ */}
        <section className="tl11-col tl11-col-tables">
          <div className="tl11-col-head">
            <span className="tl11-step">02 / Oppslag</span>
            <h3>NBCG-tabellene</h3>
            <p className="tl11-col-desc">Markert rad passer opplysningene dine. Legg til det du vil ha i teksten.</p>
          </div>

          {!lookup.bioGroup ? (
            <div className="tl11-empty">
              <div className="tl11-empty-icon">☰</div>
              <h4>Velg hovedgruppe</h4>
              <p>Tabellene vises i sin helhet uansett — oppslaget markerer rad når hovedgruppe er valgt.</p>
            </div>
          ) : (
            <>
              {totalMatches === 0 && (
                <div className="tl11-nomatch">
                  Ingen rad treffer ennå. Oppgi flere felt, eller så faller pasienten utenfor disse
                  tabellene (se handlingsprogrammet for f.eks. pT3/pT4 eller neoadjuvant situasjon).
                </div>
              )}

              {sections.map(({ table, role, matches }) => (
                <GuidelineTableView
                  key={table.id}
                  table={table}
                  role={role}
                  matches={matches}
                  picks={picks}
                  onAdd={addPick}
                  onRemove={removePickByRef}
                />
              ))}
            </>
          )}

          <details className="tl11-other">
            <summary>Vis også: {otherTable.shortTitle} (referanse, ingen markering)</summary>
            <GuidelineTableView table={otherTable} matches={[]} picks={picks} onAdd={addPick} onRemove={removePickByRef} />
          </details>

          <details className="tl11-regimens">
            <summary>Regimer og forklaringer (ordrett fra handlingsprogrammet)</summary>
            <div className="tl11-regimens-body">
              {sharedRegimens.map((r) => (
                <div key={r.heading} className="tl11-regimen">
                  <h4>{r.heading}</h4>
                  <p>{r.text}</p>
                </div>
              ))}
            </div>
          </details>
        </section>

        {/* ============ 03 JOURNALUTKAST ============ */}
        <section className="tl11-col tl11-col-doc">
          <div className="tl11-col-head">
            <span className="tl11-step">03 / Dokumentasjon</span>
            <div className="tl11-title-row">
              <h3>Journalutkast</h3>
              <span className="tl11-count">{picks.length}</span>
            </div>
            <p className="tl11-col-desc">Mal-basert svar på henvisning</p>
          </div>

          {!picks.length ? (
            <div className="tl11-empty">
              <div className="tl11-empty-icon">¶</div>
              <h4>Utkastet er tomt</h4>
              <p>Trykk «Legg til» på en markert rad eller en fotnote for å bygge teksten. Ingenting tas med av seg selv.</p>
            </div>
          ) : (
            <>
              <ol className="tl11-picks">
                {picks.map((pick, i) => (
                  <li key={`${pick.kind}-${pick.tableId}-${pick.index}`} className={`tl11-pick tl11-pick-${pick.kind}`}>
                    <span className="tl11-pick-label">{describePick(pick, guidelineTables)}</span>
                    <span className="tl11-pick-actions">
                      <button onClick={() => setPicks((p) => movePick(p, i, -1))} disabled={i === 0} title="Flytt opp">↑</button>
                      <button onClick={() => setPicks((p) => movePick(p, i, 1))} disabled={i === picks.length - 1} title="Flytt ned">↓</button>
                      <button className="tl11-pick-del" onClick={() => removePick(i)} title="Fjern">×</button>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="tl11-preview-head">
                <h4>Generert tekst</h4>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? 'Kopiert!' : 'Kopier til utklippstavle'}
                </button>
              </div>
              <pre className="tl11-preview">{renderedText}</pre>

              <details className="tl11-template">
                <summary>Malen</summary>
                <p className="tl11-template-note">
                  Innledningen bygges av verdiene du har oppgitt; felter du ikke har fylt ut
                  utelates. Resten er ordrett fra det du har lagt til.
                </p>

                {savedNames.length > 0 && (
                  <div className="tl11-saved">
                    <strong>Lagrede maler:</strong>
                    {savedNames.map((name) => (
                      <span key={name} className="tl11-saved-item">
                        <button onClick={() => setBlocks(savedTemplates[name])}>{name}</button>
                        <button className="tl11-saved-del" onClick={() => handleDeleteTemplate(name)} title="Slett">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <VariablePalette
                  variables={TEMPLATE_VARIABLES}
                  onInsert={(varId) => setBlocks([...blocks, { type: 'var', varId }])}
                />

                <TemplateEditor
                  blocks={blocks}
                  onChange={setBlocks}
                  variables={TEMPLATE_VARIABLES}
                  conditions={TEMPLATE_CONDITIONS}
                  resolvePreview={(id) => resolveVar(id, ctx)}
                  evalPreview={(id) => evalCond(id, ctx)}
                />

                <div className="tl11-template-actions">
                  <input type="text" value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)} placeholder="Navn på mal…" />
                  <button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>Lagre mal</button>
                  <button onClick={() => setBlocks(DEFAULT_TEMPLATE)}>Tilbakestill mal</button>
                </div>
              </details>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ================================================================
//  Tabellen, gjengitt som i handlingsprogrammet
// ================================================================

function GuidelineTableView({ table, role, matches, picks, onAdd, onRemove }) {
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const spans = useMemo(() => computeSpans(table.rows, table.mergeCount), [table]);
  const recColSet = useMemo(() => new Set((table.recCols || []).map((rc) => rc.idx)), [table]);
  const hasMatch = matches.length > 0;

  return (
    <div className={`tl11-table-wrap${table.kind === 'addon' ? ' addon' : ''}`}>
      <h4 className="tl11-table-title">
        {role && <span className="tl11-role-badge">{role}</span>}
        {table.title}
        <span className="tl11-rev-badge">rev. {table.revision}</span>
      </h4>

      <div className="tl11-table-scroll">
        <table className="lookup-table tl11-table">
          <thead>
            <tr>
              {hasMatch && <th className="tl11-add-col">Til utkast</th>}
              {table.columns.map((c, i) => <th key={i}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => {
              const isHit = matchSet.has(rowIdx);
              const added = hasPick(picks, 'row', table.id, rowIdx);
              return (
                <tr key={rowIdx} className={isHit ? 'lookup-row-hit' : ''}>
                  {hasMatch && (
                    <td className="tl11-add-cell">
                      {isHit && (
                        added ? (
                          <button className="tl11-added" onClick={() => onRemove('row', table.id, rowIdx)}
                            title="Fjern fra utkastet">✓ Lagt til</button>
                        ) : (
                          <button className="tl11-add" onClick={() => onAdd('row', table.id, rowIdx)}
                            title={`Legg ${buildRowPath(row, table)} til i utkastet`}>Legg til</button>
                        )
                      )}
                    </td>
                  )}
                  {row.cells.map((cell, colIdx) => {
                    if (colIdx < table.mergeCount) {
                      const span = spans[rowIdx][colIdx];
                      if (!span.render) return null;
                      return (
                        <td key={colIdx} rowSpan={span.span} className="lookup-cell-merge">
                          <MultilineText text={cell} />
                        </td>
                      );
                    }
                    return (
                      <td key={colIdx} className={recColSet.has(colIdx) ? 'lookup-cell-rec' : 'lookup-cell-rationale'}>
                        <MultilineText text={cell} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="tl11-table-source">Kilde: {table.source}</div>

      {table.footnotes?.length > 0 && (
        <div className="tl11-footnotes">
          <span className="tl11-footnotes-head">Fotnoter — legg til de som gjelder pasienten</span>
          <ul>
            {table.footnotes.map((note, i) => {
              const added = hasPick(picks, 'footnote', table.id, i);
              return (
                <li key={i}>
                  {added ? (
                    <button className="tl11-added" onClick={() => onRemove('footnote', table.id, i)}
                      title="Fjern fra utkastet">✓ Lagt til</button>
                  ) : (
                    <button className="tl11-add" onClick={() => onAdd('footnote', table.id, i)}>Legg til</button>
                  )}
                  <span>{note}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {table.appNote && <p className="tl11-appnote">Merknad fra verktøyet (ikke NBCG-tekst): {table.appNote}</p>}
    </div>
  );
}
