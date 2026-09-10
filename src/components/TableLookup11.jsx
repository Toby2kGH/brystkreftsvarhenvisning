import React, { useState, useMemo, useEffect } from 'react';
import {
  tableGeneTest,
  tableNoGeneTest,
  addonTables,
  sharedRegimens,
} from '../tablelookup/guidelineTables.js';
import { findMatchingRows } from '../tablelookup/matcher.js';
import { MultilineText, computeSpans } from '../tablelookup/tableGrid.jsx';
import { buildRowPath } from '../tablelookup/journalText.js';
import {
  rowKey,
  buildLookupText,
  buildRecommendationsOnly,
  buildSources,
  buildFootnotes,
  defaultSelection,
} from '../tablelookup/lookupText.js';
import { renderTemplate, makeTemplateStorage, copyText } from '../textgen/templateEngine.js';
import { TemplateEditor, VariablePalette } from '../textgen/TemplateEditor.jsx';
import { GUIDELINE_VERSION, SCOPE_NOTE } from '../guidelineVersion.js';

// ================================================================
//  Tabelloppslag 1.1 — rent oppslagsverktøy
//
//  Verktøyet regner ingenting ut. Alle verdier oppslaget bruker er
//  eksplisitt oppgitt av legen, hele tabellen vises alltid (ingen rad
//  skjules eller utelukkes), og all generert tekst er enten legens egne
//  verdier eller ordrett fra NBCG-tabellen. Det er skillet mot
//  Pasientvurdering og Tabelloppslag 2.0, som utleder biologisk gruppe,
//  stadium og luminalgruppe fra tallene.
// ================================================================

// ---- Felter som styrer oppslaget (alle eksplisitte valg) --------

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

// Tabellens egne karakteristika, gjengitt ordrett som lesehjelp. Legen leser
// kriteriene og velger selv — verktøyet klassifiserer ikke.
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
const EMPTY_JOURNAL = {
  erPercent: '',
  prPercent: '',
  her2: '',
  ki67: '',
  grade: '',
  age: '',
};

// Forenklet T ('pT2' → 'T2') for CDK4/6-tabellen, som indekseres på TNM.
// Ren omskriving av legens eget valg, ikke en utledning.
function simpleT(tStage) {
  if (!tStage) return '';
  if (tStage.startsWith('pT1')) return 'T1';
  return tStage.replace(/^p/, '');
}

// ---- Malvariabler: kun legens verdier + ordrett tabelltekst -----

const MENOPAUSAL_LABEL = { pre: 'premenopausal', post: 'postmenopausal' };
const GENE_TEST_LABEL = { prosigna: 'Prosigna (PAM50)', oncotypedx: 'OncotypeDx' };
const PAM50_LABEL = { lumA: 'Luminal A', lumB: 'Luminal B' };

const TEMPLATE_VARIABLES = [
  { group: 'Oppgitt av deg — oppslag', vars: [
    { id: 'hovedgruppe', label: 'Hovedgruppe (HR/HER2)' },
    { id: 'tStadium', label: 'T-stadium' },
    { id: 'nStadium', label: 'N-stadium' },
    { id: 'tnm', label: 'T- og N-stadium samlet' },
    { id: 'menopausal', label: 'Menopausal status' },
    { id: 'gentest', label: 'Genekspresjonstest med score' },
    { id: 'pam50', label: 'PAM50 subtype' },
    { id: 'luminal', label: 'Luminal-liknende gruppe' },
  ]},
  { group: 'Oppgitt av deg — journal', vars: [
    { id: 'alder', label: 'Alder' },
    { id: 'erProsent', label: 'ER (%)' },
    { id: 'prProsent', label: 'PR (%)' },
    { id: 'erPr', label: 'ER og PR samlet' },
    { id: 'her2', label: 'HER2 (IHC/ISH)' },
    { id: 'ki67', label: 'Ki-67 (%)' },
    { id: 'grad', label: 'Histologisk grad' },
  ]},
  { group: 'Ordrett fra tabellene', vars: [
    { id: 'tabelltekst', label: 'Alle valgte rader (med kilde)' },
    { id: 'tabellAnbefalinger', label: 'Kun anbefalingstekst' },
    { id: 'tabellKilder', label: 'Kilder' },
    { id: 'tabellFotnoter', label: 'Fotnoter' },
  ]},
];

const TEMPLATE_CONDITIONS = [
  { id: 'harAlder', label: 'Alder er oppgitt' },
  { id: 'harGrad', label: 'Grad er oppgitt' },
  { id: 'harKi67', label: 'Ki-67 er oppgitt' },
  { id: 'harGentest', label: 'Genekspresjonstest er oppgitt' },
  { id: 'harLuminal', label: 'Luminal-gruppe er oppgitt' },
  { id: 'harFotnoter', label: 'Valgte tabeller har fotnoter' },
];

function resolveVar(id, ctx) {
  const { lookup, journal, sections, selected } = ctx;
  const dash = (v) => (v === '' || v == null ? '—' : v);
  switch (id) {
    case 'hovedgruppe': return dash(BIO_GROUPS.find((b) => b.value === lookup.bioGroup)?.label);
    case 'tStadium': return dash(lookup.tStage);
    case 'nStadium': return dash(lookup.nStage);
    case 'tnm': return [lookup.tStage, lookup.nStage].filter(Boolean).join('') || '—';
    case 'menopausal': return dash(MENOPAUSAL_LABEL[lookup.menopausal]);
    case 'gentest': {
      if (!lookup.geneTestAvailable || !lookup.geneTest) return 'ikke utført';
      const name = GENE_TEST_LABEL[lookup.geneTest] || lookup.geneTest;
      if (lookup.geneTest === 'prosigna' && lookup.rorScore !== '') return `${name}, ROR-score ${lookup.rorScore}`;
      if (lookup.geneTest === 'oncotypedx' && lookup.rsScore !== '') return `${name}, RS ${lookup.rsScore}`;
      return name;
    }
    case 'pam50': return dash(PAM50_LABEL[lookup.prosignaSubtype]);
    case 'luminal': return dash(LUMINAL_OPTIONS.find((l) => l.value === lookup.luminalLike)?.label);
    case 'alder': return journal.age !== '' ? `${journal.age} år` : '—';
    case 'erProsent': return journal.erPercent !== '' ? `${journal.erPercent} %` : '—';
    case 'prProsent': return journal.prPercent !== '' ? `${journal.prPercent} %` : '—';
    case 'erPr': {
      const parts = [];
      if (journal.erPercent !== '') parts.push(`ER ${journal.erPercent} %`);
      if (journal.prPercent !== '') parts.push(`PR ${journal.prPercent} %`);
      return parts.join(', ') || '—';
    }
    case 'her2': return dash(journal.her2);
    case 'ki67': return journal.ki67 !== '' ? `Ki-67 ${journal.ki67} %` : '—';
    case 'grad': return journal.grade !== '' ? `grad ${journal.grade}` : '—';
    case 'tabelltekst': return buildLookupText(sections, selected) || '—';
    case 'tabellAnbefalinger': return buildRecommendationsOnly(sections, selected) || '—';
    case 'tabellKilder': return buildSources(sections, selected) || '—';
    case 'tabellFotnoter': return buildFootnotes(sections, selected) || 'Ingen';
    default: return `[${id}]`;
  }
}

function evalCond(id, ctx) {
  const { lookup, journal, sections, selected } = ctx;
  switch (id) {
    case 'harAlder': return journal.age !== '';
    case 'harGrad': return journal.grade !== '';
    case 'harKi67': return journal.ki67 !== '';
    case 'harGentest': return !!(lookup.geneTestAvailable && lookup.geneTest);
    case 'harLuminal': return !!lookup.luminalLike;
    case 'harFotnoter': return !!buildFootnotes(sections, selected);
    default: return false;
  }
}

// Innledningen består utelukkende av verdier legen selv har oppgitt.
const TEMPLATE_WITH_PATIENT = [
  { type: 'cond', condition: 'harAlder', trueText: 'Kvinne ', falseText: 'Pasient med ' },
  { type: 'cond', condition: 'harAlder', trueText: '', falseText: '', useVar: 'alder' },
  { type: 'cond', condition: 'harAlder', trueText: ', ', falseText: '' },
  { type: 'var', varId: 'menopausal' },
  { type: 'text', value: '. ' },
  { type: 'var', varId: 'hovedgruppe' },
  { type: 'text', value: ' ' },
  { type: 'var', varId: 'tnm' },
  { type: 'text', value: ', ' },
  { type: 'var', varId: 'erPr' },
  { type: 'cond', condition: 'harKi67', trueText: ', ', falseText: '' },
  { type: 'cond', condition: 'harKi67', trueText: '', falseText: '', useVar: 'ki67' },
  { type: 'cond', condition: 'harGrad', trueText: ', ', falseText: '' },
  { type: 'cond', condition: 'harGrad', trueText: '', falseText: '', useVar: 'grad' },
  { type: 'cond', condition: 'harGentest', trueText: '. Genekspresjonstest: ', falseText: '' },
  { type: 'cond', condition: 'harGentest', trueText: '', falseText: '', useVar: 'gentest' },
  { type: 'cond', condition: 'harLuminal', trueText: '. Vurdert som ', falseText: '' },
  { type: 'cond', condition: 'harLuminal', trueText: '', falseText: '', useVar: 'luminal' },
  { type: 'text', value: '.\n\nOppslag i NBCG sine anbefalingstabeller:\n\n' },
  { type: 'var', varId: 'tabelltekst' },
];

const TEMPLATE_TABLE_ONLY = [
  { type: 'text', value: 'Oppslag i NBCG sine anbefalingstabeller:\n\n' },
  { type: 'var', varId: 'tabelltekst' },
];

const storage = makeTemplateStorage('lookup11Templates');

// ================================================================
//  Komponent
// ================================================================

export default function TableLookup11() {
  const [lookup, setLookup] = useState(EMPTY_LOOKUP);
  const [journal, setJournal] = useState(EMPTY_JOURNAL);
  const [mode, setMode] = useState('withPatient'); // 'withPatient' | 'tableOnly'
  const [blocks, setBlocks] = useState(TEMPLATE_WITH_PATIENT);
  const [touchedTemplate, setTouchedTemplate] = useState(false);
  const [deselected, setDeselected] = useState(() => new Set());
  const [savedTemplates, setSavedTemplates] = useState(() => storage.load());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copied, setCopied] = useState(false);

  function updateLookup(field, value) {
    setLookup((prev) => ({ ...prev, [field]: value }));
  }
  function updateJournal(field, value) {
    setJournal((prev) => ({ ...prev, [field]: value }));
  }

  // Matcher-input er legens valg, ordrett — pluss forenklet T, som er en ren
  // omskriving av T-stadiet legen alt har valgt.
  const matchInput = useMemo(
    () => ({ ...lookup, tSimple: simpleT(lookup.tStage) }),
    [lookup],
  );

  // Relevante tabeller, som i Tabelloppslag: primærtabell etter gentest-status,
  // tillegg etter hovedgruppe. Flere tabeller kan gjelde samtidig.
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

  // Alle treff er med som standard; legen fjerner det som ikke skal i brevet.
  const selected = useMemo(() => {
    const all = defaultSelection(sections);
    for (const key of deselected) all.delete(key);
    return all;
  }, [sections, deselected]);

  const totalMatches = sections.reduce((n, s) => n + s.matches.length, 0);

  // Malen følger veksleren så lenge legen ikke har redigert den selv.
  useEffect(() => {
    if (touchedTemplate) return;
    setBlocks(mode === 'withPatient' ? TEMPLATE_WITH_PATIENT : TEMPLATE_TABLE_ONLY);
  }, [mode, touchedTemplate]);

  const ctx = { lookup, journal, sections, selected };
  const renderedText = useMemo(
    () => (selected.size ? renderTemplate(blocks, (id) => resolveVar(id, ctx), (id) => evalCond(id, ctx)) : ''),
    [blocks, lookup, journal, sections, selected],
  );

  function toggleRow(tableId, rowIndex) {
    const key = rowKey(tableId, rowIndex);
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleReset() {
    setLookup(EMPTY_LOOKUP);
    setJournal(EMPTY_JOURNAL);
    setDeselected(new Set());
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

  function handleTemplateChange(next) {
    setTouchedTemplate(true);
    setBlocks(next);
  }

  const savedNames = Object.keys(savedTemplates);
  const showLuminal = lookup.bioGroup === 'HR+HER2-' && !lookup.geneTestAvailable;

  return (
    <div className="tl11">
      <div className="tl11-header">
        <h2>Tabelloppslag 1.1</h2>
        <p className="tl11-subtitle">
          Et rent oppslagsverktøy. Du oppgir selv hvor pasienten hører hjemme, verktøyet
          viser hele NBCG-tabellen og markerer raden, og teksten settes sammen av dine egne
          verdier og tabellens ordrette tekst.
        </p>
        <p className="tl11-mdr">
          <strong>Verktøyet regner ingenting ut.</strong> Hovedgruppe, stadium, menopausal status
          og luminal gruppe er verdier du oppgir — ingen av dem utledes fra tall. Ingen rad
          skjules eller utelukkes: hele tabellen står slik den gjør i handlingsprogrammet.
          Dette er ingen beslutningsstøtte, og all tolkning gjøres av deg.
        </p>
      </div>

      <div className="tl11-grid">
        {/* ============ 01 OPPSLAGSGRUNNLAG ============ */}
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
            <p className="tl11-fieldset-note">Disse verdiene bestemmer hvilken rad som markeres.</p>

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
                        <option value="">— Velg (brukes ved ROR 41–60) —</option>
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
            <p className="tl11-fieldset-note">Påvirker ikke oppslaget — skrives kun inn i journalteksten.</p>

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
            <p className="tl11-col-desc">
              Hele tabellen vises alltid. Markert rad er der opplysningene dine peker.
            </p>
          </div>

          {!lookup.bioGroup ? (
            <div className="tl11-empty">
              <div className="tl11-empty-icon">☰</div>
              <h4>Velg hovedgruppe</h4>
              <p>Oppslaget markerer rad når du har oppgitt hovedgruppe. Tabellene vises uansett i sin helhet.</p>
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
                  selected={selected}
                  onToggleRow={toggleRow}
                />
              ))}
            </>
          )}

          <details className="tl11-other">
            <summary>Vis også: {otherTable.shortTitle} (referanse, ingen markering)</summary>
            <GuidelineTableView table={otherTable} matches={[]} selected={selected} onToggleRow={toggleRow} />
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

          <p className="tl11-disclaimer">
            Verktøyet gjengir tabeller fra NBCG sitt handlingsprogram for å vise hvor pasienten hører
            hjemme og forenkle journalføring. Det er ingen beslutningsstøtte. Innhold verifisert mot
            NBCG Handlingsprogram {GUIDELINE_VERSION.handlingsprogram} (+ tabeller {GUIDELINE_VERSION.tables}).
            Kontroller alltid mot siste versjon. {SCOPE_NOTE}
          </p>
        </section>

        {/* ============ 03 SVARBREV ============ */}
        <section className="tl11-col tl11-col-doc">
          <div className="tl11-col-head">
            <span className="tl11-step">03 / Dokumentasjon</span>
            <div className="tl11-title-row">
              <h3>Journalutkast</h3>
              <span className="tl11-count">{renderedText.length}</span>
            </div>
            <p className="tl11-col-desc">Mal-basert svar på henvisning</p>
          </div>

          <div className="tl11-mode">
            <button
              className={`tl11-mode-btn ${mode === 'withPatient' ? 'active' : ''}`}
              onClick={() => setMode('withPatient')}
            >
              Med pasientopplysninger
            </button>
            <button
              className={`tl11-mode-btn ${mode === 'tableOnly' ? 'active' : ''}`}
              onClick={() => setMode('tableOnly')}
            >
              Kun tabelltekst
            </button>
          </div>
          {touchedTemplate && (
            <p className="tl11-mode-note">
              Malen er redigert manuelt, så veksleren endrer den ikke lenger. Bruk «Tilbakestill mal».
            </p>
          )}

          {!selected.size ? (
            <div className="tl11-empty">
              <div className="tl11-empty-icon">¶</div>
              <h4>Fra tabell til utkast</h4>
              <p>Når en rad er markert, samles den ordrette tabellteksten, forbeholdene og kilden her.</p>
            </div>
          ) : (
            <>
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
                  Teksten består av verdiene du har oppgitt og den ordrette teksten fra radene du
                  har krysset av. Ingenting er omskrevet eller utledet.
                </p>

                {savedNames.length > 0 && (
                  <div className="tl11-saved">
                    <strong>Lagrede maler:</strong>
                    {savedNames.map((name) => (
                      <span key={name} className="tl11-saved-item">
                        <button onClick={() => { setTouchedTemplate(true); setBlocks(savedTemplates[name]); }}>{name}</button>
                        <button className="tl11-saved-del" onClick={() => handleDeleteTemplate(name)} title="Slett">×</button>
                      </span>
                    ))}
                  </div>
                )}

                <VariablePalette
                  variables={TEMPLATE_VARIABLES}
                  onInsert={(varId) => handleTemplateChange([...blocks, { type: 'var', varId }])}
                />

                <TemplateEditor
                  blocks={blocks}
                  onChange={handleTemplateChange}
                  variables={TEMPLATE_VARIABLES}
                  conditions={TEMPLATE_CONDITIONS}
                  resolvePreview={(id) => resolveVar(id, ctx)}
                  evalPreview={(id) => evalCond(id, ctx)}
                />

                <div className="tl11-template-actions">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Navn på mal…"
                  />
                  <button onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>Lagre mal</button>
                  <button onClick={() => {
                    setTouchedTemplate(false);
                    setBlocks(mode === 'withPatient' ? TEMPLATE_WITH_PATIENT : TEMPLATE_TABLE_ONLY);
                  }}>Tilbakestill mal</button>
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

function GuidelineTableView({ table, role, matches, selected, onToggleRow }) {
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const spans = useMemo(() => computeSpans(table.rows, table.mergeCount), [table]);
  const recColSet = useMemo(() => new Set((table.recCols || []).map((rc) => rc.idx)), [table]);
  const hasMatch = matches.length > 0;

  return (
    <div className={`tl11-table-wrap${table.kind === 'addon' ? ' addon' : ''}`}>
      <h4 className="tl11-table-title">
        {role && <span className="tl11-role-badge">{role}</span>}
        {table.title}
      </h4>

      <div className="tl11-table-scroll">
        <table className="lookup-table tl11-table">
          <thead>
            <tr>
              {hasMatch && <th className="tl11-pick-col">Med i tekst</th>}
              {table.columns.map((c, i) => <th key={i}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => {
              const isHit = matchSet.has(rowIdx);
              const isPicked = isHit && selected.has(rowKey(table.id, rowIdx));
              return (
                <tr key={rowIdx} className={isHit ? 'lookup-row-hit' : ''}>
                  {hasMatch && (
                    <td className="tl11-pick-cell">
                      {isHit && (
                        <label className="tl11-pick">
                          <input
                            type="checkbox"
                            checked={isPicked}
                            onChange={() => onToggleRow(table.id, rowIdx)}
                            aria-label={`Ta med ${buildRowPath(row, table)} i teksten`}
                          />
                        </label>
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
          {table.footnotes.map((f, i) => <p key={i}>{f}</p>)}
        </div>
      )}
    </div>
  );
}
