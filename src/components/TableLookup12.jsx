import React, { useState, useMemo } from 'react';
import {
  tableGeneTest,
  tableNoGeneTest,
  addonTables,
  guidelineTables,
  sharedRegimens,
} from '../tablelookup/guidelineTables.js';
import { MultilineText, computeSpans } from '../tablelookup/tableGrid.jsx';
import { buildPickedText, describePick, hasPick, movePick } from '../tablelookup/lookupText.js';
import { buildIntro } from '../tablelookup/introText.js';
import {
  ROR_BANDS,
  RS_BANDS,
  EMPTY_LOOKUP_12,
  findMatchingRows12,
  setLookupField,
  visibleDecisions,
  missingDecisions,
  introLookup,
  reviewSignature,
  reviewStatus,
  nextStep,
  isPickCurrent,
  summarizePicks,
} from '../tablelookup/lookup12.js';
import { renderTemplate, makeTemplateStorage, copyText } from '../textgen/templateEngine.js';
import { TemplateEditor, VariablePalette } from '../textgen/TemplateEditor.jsx';
import { SCOPE_NOTE } from '../guidelineVersion.js';

// ================================================================
//  Tabelloppslag 1.2 — veiledet gjennomgang
//
//  Samme prinsipp som 1.1: legen oppgir tabellens egne kategorier, tabellen
//  markerer raden, og ingenting havner i notatet før legen legger det til.
//
//  Nytt i 1.2:
//   - Score velges som tabellens intervaller, ikke som tall.
//   - Felt som skjules, tømmes.
//   - Siden leses ovenfra og ned i tre steg. Hver tabell er et eget kort
//     med fotnotene under, og legen kvitterer ut kortet når det er lest.
//     En fast fremdriftslinje viser hva som gjenstår og hvor man trykker.
//   - Til slutt en oppsummering av alt som er tatt med, rett over notatet.
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

// Tabellens egne karakteristika, ordrett som lesehjelp. Legen velger selv.
const LUMINAL_CRITERIA =
  'Lum A-liknende: Ki67<10%, G1-2, HR>50%. ' +
  'LumB-liknende: 1) Ki67>35%, eller 2) grad 3 og samsvarende høy Ki67, eller 3) HR<50%. ' +
  'Ki67 mellom 10% og 35% bør ikke benyttes for vurdering av grunnlag for kjemoterapi.';

const EMPTY_JOURNAL = { erPercent: '', prPercent: '', her2: '', ki67: '', grade: '', age: '' };

const STEP_IDS = { input: 'tl12-step-input', tables: 'tl12-step-tables', summary: 'tl12-step-summary' };
const tableAnchor = (id) => `tl12-table-${id}`;

/** Forenklet T ('pT2' → 'T2') for CDK4/6-tabellen. Ren omskriving av legens eget valg. */
function simpleT(tStage) {
  if (!tStage) return '';
  if (tStage.startsWith('pT1')) return 'T1';
  return tStage.replace(/^p/, '');
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  { id: 'harUtvalg', label: 'Noe er lagt til i notatet' },
];

function resolveVar(id, ctx) {
  const { lookup, journal, picks, intro } = ctx;
  const blank = (v) => (v === '' || v == null ? '' : v);
  switch (id) {
    case 'innledning': return intro;
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
    case 'harInnledning': return !!ctx.intro;
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

const storage = makeTemplateStorage('lookup12PicksTemplates');

const STATUS_TEXT = { todo: 'Ikke gjennomgått', done: 'Gjennomgått', changed: 'Endret — se over igjen' };
const STATUS_ICON = { todo: '○', done: '✓', changed: '!' };

// ================================================================
//  Komponent
// ================================================================

export default function TableLookup12() {
  const [lookup, setLookup] = useState(EMPTY_LOOKUP_12);
  const [journal, setJournal] = useState(EMPTY_JOURNAL);
  const [picks, setPicks] = useState([]);
  const [reviewed, setReviewed] = useState({});
  const [blocks, setBlocks] = useState(DEFAULT_TEMPLATE);
  const [savedTemplates, setSavedTemplates] = useState(() => storage.load());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copied, setCopied] = useState(false);

  const updateLookup = (field, value) => setLookup((p) => setLookupField(p, field, value));
  const updateJournal = (field, value) => setJournal((p) => ({ ...p, [field]: value }));

  const matchInput = useMemo(() => ({ ...lookup, tSimple: simpleT(lookup.tStage) }), [lookup]);

  // Tabellene som skal gås gjennom: primærtabell etter gentest-status, tillegg etter hovedgruppe.
  const sections = useMemo(() => {
    if (!lookup.bioGroup) return [];
    const primary = lookup.geneTestAvailable ? tableGeneTest : tableNoGeneTest;
    const list = [{ table: primary, role: 'Primæranbefaling' }];
    for (const addon of addonTables) {
      if (!addon.appliesToBioGroups || addon.appliesToBioGroups.includes(lookup.bioGroup)) {
        list.push({ table: addon, role: 'Tilleggsbehandling' });
      }
    }
    return list.map((s) => ({ ...s, matches: findMatchingRows12(s.table, matchInput) }));
  }, [lookup.bioGroup, lookup.geneTestAvailable, matchInput]);

  const otherTable = lookup.geneTestAvailable ? tableNoGeneTest : tableGeneTest;
  const decisions = visibleDecisions(lookup);
  const missing = missingDecisions(lookup);
  const statuses = Object.fromEntries(sections.map((s) => [s.table.id, reviewStatus(reviewed, s.table.id, s.matches)]));
  const doneCount = sections.filter((s) => statuses[s.table.id] === 'done').length;
  const pending = sections.filter((s) => statuses[s.table.id] !== 'done');
  const next = nextStep(lookup, sections, reviewed);

  const intro = useMemo(() => buildIntro(introLookup(lookup), journal), [lookup, journal]);
  const ctx = { lookup, journal, picks, intro };
  const renderedText = useMemo(
    () => (picks.length ? renderTemplate(blocks, (id) => resolveVar(id, ctx), (id) => evalCond(id, ctx)) : ''),
    [blocks, lookup, journal, picks, intro],
  );
  const pickSummary = summarizePicks(picks, guidelineTables);
  const stalePicks = picks.filter((p) => !isPickCurrent(p, sections));

  function addPick(kind, tableId, index) {
    setPicks((prev) => (hasPick(prev, kind, tableId, index) ? prev : [...prev, { kind, tableId, index }]));
  }
  function removePick(at) {
    setPicks((prev) => prev.filter((_, i) => i !== at));
  }
  function removePickByRef(kind, tableId, index) {
    setPicks((prev) => prev.filter((p) => !(p.kind === kind && p.tableId === tableId && p.index === index)));
  }

  function markReviewed(section) {
    setReviewed((prev) => ({ ...prev, [section.table.id]: reviewSignature(section.matches) }));
    // Videre til neste kort som ikke er gått gjennom, ellers til oppsummeringen.
    const idx = sections.indexOf(section);
    const following = [...sections.slice(idx + 1), ...sections.slice(0, idx)]
      .find((s) => statuses[s.table.id] !== 'done');
    setTimeout(() => scrollToId(following ? tableAnchor(following.table.id) : STEP_IDS.summary), 50);
  }
  function unmarkReviewed(tableId) {
    setReviewed((prev) => {
      const nextReviewed = { ...prev };
      delete nextReviewed[tableId];
      return nextReviewed;
    });
  }

  function goNext() {
    if (next.kind === 'input') scrollToId(STEP_IDS.input);
    else if (next.kind === 'table') scrollToId(tableAnchor(next.tableId));
    else scrollToId(STEP_IDS.summary);
  }

  function handleReset() {
    setLookup(EMPTY_LOOKUP_12);
    setJournal(EMPTY_JOURNAL);
    setPicks([]);
    setReviewed({});
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
  const isHrPos = lookup.bioGroup === 'HR+HER2-';
  const nextLabel = next.kind === 'input' ? `Ta stilling til: ${missing[0].label}`
    : next.kind === 'table' ? `Gå gjennom: ${sections.find((s) => s.table.id === next.tableId).table.shortTitle}`
      : 'Til oppsummering og notat';
  const isMissing = (id) => missing.some((m) => m.id === id);

  return (
    <div className="tl12">
      <div className="tl12-header">
        <h2>Tabelloppslag 1.2</h2>
        <p className="tl12-lead">
          Tre steg ovenfra og ned: oppgi tabellens kategorier, les hver tabell med fotnoter og
          legg til det som gjelder, og kontroller oppsummeringen før du kopierer notatet.
        </p>
        <details className="tl11-about">
          <summary>Om verktøyet</summary>
          <p>
            <strong>Verktøyet regner ingenting ut.</strong> Du velger tabellens egne kategorier
            — også genekspresjonsscoren velges som tabellens intervall, ikke som tall. En markert
            rad har de samme kategoriene som du har valgt; det er ikke en vurdering av pasienten.
            Ingen rad skjules, og ingenting havner i notatet før du legger det til.
          </p>
          <p>
            Dette er ingen beslutningsstøtte, og all tolkning gjøres av deg. All generert tekst
            er enten verdier du selv har oppgitt eller ordrett fra NBCG-tabellen. Kontroller
            alltid mot siste versjon av handlingsprogrammet. {SCOPE_NOTE}
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

      {/* ============ FREMDRIFT (fast øverst) ============ */}
      <nav className="tl12-progress" aria-label="Fremdrift">
        <ol className="tl12-progress-steps">
          <li className={missing.length ? 'todo' : 'done'}>
            <button onClick={() => scrollToId(STEP_IDS.input)}>
              <span className="tl12-progress-num">1</span>
              Opplysninger
              <span className="tl12-progress-meta">{decisions.length - missing.length}/{decisions.length}</span>
            </button>
          </li>
          <li className={!sections.length ? 'todo' : pending.length ? 'todo' : 'done'}>
            <button onClick={() => scrollToId(STEP_IDS.tables)}>
              <span className="tl12-progress-num">2</span>
              Tabeller
              <span className="tl12-progress-meta">{doneCount}/{sections.length || '–'}</span>
            </button>
            {sections.length > 0 && (
              <span className="tl12-progress-tables">
                {sections.map((s) => (
                  <button key={s.table.id} className={`tl12-chip tl12-chip-${statuses[s.table.id]}`}
                    onClick={() => scrollToId(tableAnchor(s.table.id))}
                    title={`${s.table.shortTitle}: ${STATUS_TEXT[statuses[s.table.id]]}`}>
                    {STATUS_ICON[statuses[s.table.id]]} {s.table.shortTitle}
                  </button>
                ))}
              </span>
            )}
          </li>
          <li className={picks.length ? 'done' : 'todo'}>
            <button onClick={() => scrollToId(STEP_IDS.summary)}>
              <span className="tl12-progress-num">3</span>
              Oppsummering
              <span className="tl12-progress-meta">{picks.length} i notatet</span>
            </button>
          </li>
        </ol>
        <button className="tl12-next" onClick={goNext}>{nextLabel} ↓</button>
      </nav>

      {/* ============ STEG 1 — OPPLYSNINGER ============ */}
      <section id={STEP_IDS.input} className="tl12-card tl12-step">
        <div className="tl12-step-head">
          <span className="tl12-step-num">1</span>
          <div>
            <h3>Ta stilling til opplysningene</h3>
            <p>
              Valgene i den blå rammen styrer hvilken rad som markeres. Felt merket
              <span className="tl12-need">Må velges</span> mangler.
            </p>
          </div>
          <button className="tl11-reset" onClick={handleReset}>Nullstill alt</button>
        </div>

        <div className="tl12-input-grid">
          <fieldset className="tl11-fieldset tl11-fieldset-lookup">
            <legend>Styrer oppslaget</legend>

            <Field label="Hovedgruppe (HR/HER2)" missing={isMissing('bioGroup')}>
              <select value={lookup.bioGroup} onChange={(e) => updateLookup('bioGroup', e.target.value)}>
                <option value="">— Velg —</option>
                {BIO_GROUPS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </Field>

            <div className="tl11-field-row">
              <Field label="T-stadium (patologisk)" missing={isMissing('tStage')}>
                <select value={lookup.tStage} onChange={(e) => updateLookup('tStage', e.target.value)}>
                  <option value="">— Velg —</option>
                  {T_STAGES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="N-stadium (patologisk)" missing={isMissing('nStage')}>
                <select value={lookup.nStage} onChange={(e) => updateLookup('nStage', e.target.value)}>
                  <option value="">— Velg —</option>
                  {N_STAGES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Menopausal status" missing={isMissing('menopausal')}>
              <select value={lookup.menopausal} onChange={(e) => updateLookup('menopausal', e.target.value)}>
                <option value="">— Velg —</option>
                <option value="pre">Premenopausal</option>
                <option value="post">Postmenopausal</option>
              </select>
            </Field>

            {isHrPos && (
              <label className="tl11-field tl11-check">
                <input
                  type="checkbox"
                  checked={lookup.geneTestAvailable}
                  onChange={(e) => updateLookup('geneTestAvailable', e.target.checked)}
                />
                Genekspresjonstest foreligger
              </label>
            )}

            {lookup.geneTestAvailable && (
              <>
                <Field label="Genekspresjonstest" missing={isMissing('geneTest')}>
                  <select value={lookup.geneTest} onChange={(e) => updateLookup('geneTest', e.target.value)}>
                    <option value="">— Velg —</option>
                    <option value="prosigna">Prosigna (PAM50)</option>
                    <option value="oncotypedx">OncotypeDx</option>
                  </select>
                </Field>
                {lookup.geneTest === 'prosigna' && (
                  <div className="tl11-field-row">
                    <Field label="ROR score (tabellens intervall)" missing={isMissing('rorBand')}>
                      <select value={lookup.rorBand} onChange={(e) => updateLookup('rorBand', e.target.value)}>
                        <option value="">— Velg —</option>
                        {ROR_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    </Field>
                    {lookup.rorBand === '41-60' && (
                      <Field label="PAM50 subtype" missing={isMissing('prosignaSubtype')}>
                        <select value={lookup.prosignaSubtype} onChange={(e) => updateLookup('prosignaSubtype', e.target.value)}>
                          <option value="">— Velg —</option>
                          <option value="lumA">Luminal A</option>
                          <option value="lumB">Luminal B</option>
                        </select>
                      </Field>
                    )}
                  </div>
                )}
                {lookup.geneTest === 'oncotypedx' && (
                  <Field label="Recurrence Score (tabellens intervall)" missing={isMissing('rsBand')}>
                    <select value={lookup.rsBand} onChange={(e) => updateLookup('rsBand', e.target.value)}>
                      <option value="">— Velg —</option>
                      {RS_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </Field>
                )}
              </>
            )}

            {isHrPos && !lookup.geneTestAvailable && (
              <Field label="Luminal-liknende gruppe" missing={isMissing('luminalLike')}>
                <select value={lookup.luminalLike} onChange={(e) => updateLookup('luminalLike', e.target.value)}>
                  <option value="">— Velg —</option>
                  {LUMINAL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <span className="tl11-criteria">{LUMINAL_CRITERIA}</span>
              </Field>
            )}
          </fieldset>

          <fieldset className="tl11-fieldset tl11-fieldset-journal">
            <legend>Valgfritt — gjengis bare i innledningen</legend>

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
            <p className="tl11-privacy">Opplysninger og notat beholdes bare mens siden er åpen.</p>
          </fieldset>
        </div>

        <div className="tl12-step-foot">
          {missing.length ? (
            <p className="tl12-foot-missing">
              Mangler: {missing.map((m) => m.label).join(', ')}. Du kan gå videre, men tabellen
              markerer da flere rader.
            </p>
          ) : (
            <p className="tl12-foot-ok">✓ Alle valg er tatt.</p>
          )}
          <button className="tl12-continue" onClick={() => scrollToId(STEP_IDS.tables)} disabled={!lookup.bioGroup}>
            Videre til tabellene ↓
          </button>
        </div>
      </section>

      {/* ============ STEG 2 — TABELLENE ============ */}
      <section id={STEP_IDS.tables} className="tl12-step tl12-step-tables">
        <div className="tl12-card tl12-step-head tl12-step-head-standalone">
          <span className="tl12-step-num">2</span>
          <div>
            <h3>Gå gjennom {sections.length ? `alle ${sections.length} tabellene` : 'tabellene'}</h3>
            <p>
              Rull ned gjennom hver tabell <strong>og fotnotene under den</strong>. Trykk
              <span className="tl12-inline-btn">+ Legg til i notat</span> på det som gjelder, og
              <span className="tl12-inline-btn tl12-inline-btn-done">✓ Tabell og fotnoter er lest</span>
              nederst i hvert kort.
            </p>
          </div>
        </div>

        {!lookup.bioGroup ? (
          <div className="tl12-card tl11-empty">
            <div className="tl11-empty-icon">☰</div>
            <h4>Velg hovedgruppe i steg 1</h4>
            <p>Da vises tabellene som gjelder hovedgruppen, én etter én.</p>
          </div>
        ) : (
          sections.map((section, i) => (
            <TableCard
              key={section.table.id}
              section={section}
              position={i + 1}
              total={sections.length}
              status={statuses[section.table.id]}
              picks={picks}
              onAdd={addPick}
              onRemove={removePickByRef}
              onReviewed={() => markReviewed(section)}
              onUnreview={() => unmarkReviewed(section.table.id)}
            />
          ))
        )}

        <div className="tl12-card tl12-reference">
          <h4>Til referanse (valgfritt)</h4>
          <details className="tl11-other">
            <summary>Vis også: {otherTable.shortTitle} (ingen markering)</summary>
            <GuidelineTable table={otherTable} matches={[]} picks={picks} onAdd={addPick} onRemove={removePickByRef} />
            <Footnotes table={otherTable} picks={picks} onAdd={addPick} onRemove={removePickByRef} />
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
        </div>
      </section>

      {/* ============ STEG 3 — OPPSUMMERING OG NOTAT ============ */}
      <section id={STEP_IDS.summary} className="tl12-card tl12-step tl12-step-summary">
        <div className="tl12-step-head">
          <span className="tl12-step-num">3</span>
          <div>
            <h3>Oppsummering og notat</h3>
            <p>Kontroller hva du har tatt med før du kopierer notatet.</p>
          </div>
        </div>

        {(pending.length > 0 || missing.length > 0 || stalePicks.length > 0) && (
          <ul className="tl12-checklist">
            {missing.length > 0 && (
              <li>
                Ikke tatt stilling til: {missing.map((m) => m.label).join(', ')}.{' '}
                <button onClick={() => scrollToId(STEP_IDS.input)}>Gå til steg 1</button>
              </li>
            )}
            {pending.map((s) => (
              <li key={s.table.id}>
                {s.table.shortTitle}: {STATUS_TEXT[statuses[s.table.id]].toLowerCase()}.{' '}
                <button onClick={() => scrollToId(tableAnchor(s.table.id))}>Gå til tabellen</button>
              </li>
            ))}
            {stalePicks.length > 0 && (
              <li>
                {stalePicks.length === 1 ? 'Én rad' : `${stalePicks.length} rader`} i notatet er ikke
                markert med valgene du har nå — se merket «ikke markert» under.
              </li>
            )}
          </ul>
        )}

        <div className="tl12-summary">
          <h4>Dette har du tatt med</h4>
          {!picks.length ? (
            <p className="tl12-summary-empty">
              Ingenting ennå. Legg til rader og fotnoter i steg 2 — ingenting tas med av seg selv.
            </p>
          ) : (
            <>
              <ul className="tl12-summary-tables">
                {pickSummary.map(({ table, rows, footnotes }) => (
                  <li key={table.id}>
                    <strong>{table.shortTitle}</strong> (rev. {table.revision}):{' '}
                    {[rows && `${rows} rad${rows > 1 ? 'er' : ''}`, footnotes && `${footnotes} fotnote${footnotes > 1 ? 'r' : ''}`]
                      .filter(Boolean).join(' og ')}
                  </li>
                ))}
                {sections.filter((s) => !pickSummary.some((p) => p.table.id === s.table.id)).map((s) => (
                  <li key={s.table.id} className="tl12-summary-none">
                    <strong>{s.table.shortTitle}</strong>: ingenting tatt med
                  </li>
                ))}
              </ul>

              <p className="tl12-summary-order">Rekkefølgen under er rekkefølgen i notatet:</p>
              <ol className="tl11-picks tl12-picks">
                {picks.map((pick, i) => {
                  const stale = !isPickCurrent(pick, sections);
                  return (
                    <li key={`${pick.kind}-${pick.tableId}-${pick.index}`}
                      className={`tl11-pick tl11-pick-${pick.kind}${stale ? ' tl12-pick-stale' : ''}`}>
                      <span className="tl11-pick-label">
                        {describePick(pick, guidelineTables)}
                        {stale && <em className="tl12-stale-tag">ikke markert med nåværende valg</em>}
                      </span>
                      <span className="tl11-pick-actions">
                        <button onClick={() => setPicks((p) => movePick(p, i, -1))} disabled={i === 0} title="Flytt opp">↑</button>
                        <button onClick={() => setPicks((p) => movePick(p, i, 1))} disabled={i === picks.length - 1} title="Flytt ned">↓</button>
                        <button className="tl11-pick-del" onClick={() => removePick(i)} title="Fjern">×</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {picks.length > 0 && (
          <>
            <div className="tl11-preview-head">
              <h4>Notatet</h4>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? 'Kopiert!' : 'Kopier til utklippstavle'}
              </button>
            </div>
            <pre className="tl11-preview tl12-preview">{renderedText}</pre>

            <details className="tl11-template">
              <summary>Tilpass malen</summary>
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
  );
}

// ================================================================
//  Byggeklosser
// ================================================================

function Field({ label, missing, children }) {
  return (
    <label className={`tl11-field${missing ? ' tl12-field-missing' : ''}`}>
      <span className="tl12-field-label">
        {label}
        {missing && <span className="tl12-need">Må velges</span>}
      </span>
      {children}
    </label>
  );
}

/** Ett kort per tabell: veiledning, tabellen, fotnotene og utkvittering. */
function TableCard({ section, position, total, status, picks, onAdd, onRemove, onReviewed, onUnreview }) {
  const { table, role, matches } = section;
  const footnoteCount = table.footnotes?.length || 0;
  const addedHere = picks.filter((p) => p.tableId === table.id).length;

  return (
    <article id={tableAnchor(table.id)} className={`tl12-card tl12-table-card tl12-status-${status}${table.kind === 'addon' ? ' addon' : ''}`}>
      <header className="tl12-table-head">
        <span className="tl12-table-pos">Tabell {position} av {total}</span>
        <span className="tl11-role-badge">{role}</span>
        <span className={`tl12-status tl12-status-badge-${status}`}>{STATUS_ICON[status]} {STATUS_TEXT[status]}</span>
        <h4>{table.title} <span className="tl11-rev-badge">rev. {table.revision}</span></h4>
      </header>

      <p className={`tl12-hint${matches.length ? '' : ' tl12-hint-none'}`}>
        {matches.length
          ? `${matches.length === 1 ? 'Én rad er markert' : `${matches.length} rader er markert`} fordi de har kategoriene du valgte. ` +
            'Les raden, og trykk «+ Legg til i notat» hvis den skal med.'
          : 'Ingen rad har akkurat disse kategoriene. Kontroller valgene i steg 1, og se handlingsprogrammet for situasjoner tabellen ikke dekker.'}
      </p>

      <GuidelineTable table={table} matches={matches} picks={picks} onAdd={onAdd} onRemove={onRemove} />

      <div className="tl11-table-source">Kilde: {table.source}</div>
      {table.appNote && <p className="tl11-appnote">Merknad fra verktøyet (ikke NBCG-tekst): {table.appNote}</p>}

      <Footnotes table={table} picks={picks} onAdd={onAdd} onRemove={onRemove} highlight />

      <footer className="tl12-table-foot">
        <span className="tl12-table-foot-count">
          Fra denne tabellen i notatet: <strong>{addedHere}</strong>
        </span>
        {status === 'done' ? (
          <button className="tl12-reviewed" onClick={onUnreview} title="Angre">✓ Gjennomgått — angre</button>
        ) : (
          <button className="tl12-review-btn" onClick={onReviewed}>
            ✓ Tabell og {footnoteCount ? `${footnoteCount} fotnote${footnoteCount > 1 ? 'r' : ''}` : 'fotnoter'} er lest — neste ↓
          </button>
        )}
      </footer>
      {status === 'changed' && (
        <p className="tl12-changed-note">Markeringen er endret siden du kvitterte ut tabellen. Se over og kvitter ut på nytt.</p>
      )}
    </article>
  );
}

/** Tabellen, gjengitt som i handlingsprogrammet. Første kolonne er handlingen. */
function GuidelineTable({ table, matches, picks, onAdd, onRemove }) {
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const spans = useMemo(() => computeSpans(table.rows, table.mergeCount), [table]);
  const recColSet = useMemo(() => new Set((table.recCols || []).map((rc) => rc.idx)), [table]);
  const hasMatch = matches.length > 0;

  return (
    <div className="tl11-table-scroll">
      <table className="lookup-table tl11-table tl12-table">
        <thead>
          <tr>
            {hasMatch && <th className="tl12-add-col">Til notat</th>}
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
                    {isHit && (added ? (
                      <button className="tl12-added" onClick={() => onRemove('row', table.id, rowIdx)}
                        title="Fjern fra notatet">✓ I notatet</button>
                    ) : (
                      <button className="tl12-add" onClick={() => onAdd('row', table.id, rowIdx)}>
                        + Legg til i notat
                      </button>
                    ))}
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
  );
}

function Footnotes({ table, picks, onAdd, onRemove, highlight }) {
  if (!table.footnotes?.length) return null;
  return (
    <div className={`tl11-footnotes tl12-footnotes${highlight ? ' tl12-footnotes-main' : ''}`}>
      <span className="tl12-footnotes-head">
        Fotnoter til tabellen ({table.footnotes.length}) — les alle, legg til de som gjelder
      </span>
      <ul>
        {table.footnotes.map((note, i) => {
          const added = hasPick(picks, 'footnote', table.id, i);
          return (
            <li key={i}>
              {added ? (
                <button className="tl12-added" onClick={() => onRemove('footnote', table.id, i)}
                  title="Fjern fra notatet">✓ I notatet</button>
              ) : (
                <button className="tl12-add" onClick={() => onAdd('footnote', table.id, i)}>+ Legg til</button>
              )}
              <span>{note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
