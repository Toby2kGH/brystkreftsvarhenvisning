/**
 * Logikken bak Tabelloppslag 1.2 — holdt utenfor komponenten så den kan testes.
 *
 * Tre endringer fra 1.1 bor her:
 *
 * 1. Genekspresjonsscore velges som tabellens egne intervaller («ROR score
 *    41-60», «RS≤25»), ikke som tall. Oppslaget blir da ren likhet mellom
 *    legens valg og tabellens tekst — verktøyet sammenligner ingen tall mot
 *    grenseverdier.
 * 2. Felt som skjules, tømmes. Et skjult valg skal aldri kunne styre
 *    markeringen eller havne i innledningen.
 * 3. Arbeidsflyten: hva legen har tatt stilling til, hvilke tabeller som er
 *    gått gjennom, og hva som er lagt i notatet. Dette er sporing av legens
 *    egen gjennomgang — ingenting her vurderer pasienten.
 */

import { rowMatches } from './matcher.js';

// ----------------------------------------------------------------
//  Score-intervaller, med tabellens egen skrivemåte som etikett
// ----------------------------------------------------------------

export const ROR_BANDS = [
  { value: '0-40', label: 'ROR score 0-40', introText: '0-40', min: 0, max: 40 },
  { value: '41-60', label: 'ROR score 41-60', introText: '41-60', min: 41, max: 60 },
  { value: '>60', label: 'ROR score >60', introText: '>60', min: 61, max: null },
];

export const RS_BANDS = [
  { value: '<=25', label: 'RS≤25', introText: '≤25', min: null, max: 25 },
  { value: '>25', label: 'RS>25', introText: '>25', min: 26, max: null },
];

const findBand = (bands, value) => bands.find((b) => b.value === value) || null;

/** Sant når radens intervall er nøyaktig det intervallet legen har valgt. */
function sameInterval(critMin, critMax, band) {
  return (critMin ?? null) === band.min && (critMax ?? null) === band.max;
}

/**
 * Treffer raden legens valg? Kategoriene sammenlignes som i 1.1; scoren
 * sammenlignes som intervall mot intervall, aldri tall mot grense.
 */
export function rowMatches12(crit, input) {
  // Tallfeltene holdes utenfor, så matcherens grenseverdisammenligning aldri slår inn.
  const { rorScore, rsScore, rorBand, rsBand, ...categories } = input;
  if (!rowMatches(crit, categories)) return false;

  const ror = findBand(ROR_BANDS, rorBand);
  if (ror && (crit.rorMin != null || crit.rorMax != null) && !sameInterval(crit.rorMin, crit.rorMax, ror)) return false;

  const rs = findBand(RS_BANDS, rsBand);
  if (rs && (crit.rsMin != null || crit.rsMax != null) && !sameInterval(crit.rsMin, crit.rsMax, rs)) return false;

  return true;
}

export function findMatchingRows12(table, input) {
  const matched = [];
  table.rows.forEach((row, i) => {
    if (rowMatches12(row.crit, input)) matched.push(i);
  });
  return matched;
}

// ----------------------------------------------------------------
//  Oppslagsfeltene: hvilke vises, og tømming av de som skjules
// ----------------------------------------------------------------

export const EMPTY_LOOKUP_12 = {
  bioGroup: '',
  tStage: '',
  nStage: '',
  menopausal: '',
  geneTestAvailable: false,
  geneTest: '',
  rorBand: '',
  prosignaSubtype: '',
  rsBand: '',
  luminalLike: '',
};

/** Genekspresjonstest og luminal gruppe hører bare til HR+HER2--tabellene. */
const isHrPosHer2Neg = (lookup) => lookup.bioGroup === 'HR+HER2-';

/** Hvilke valg som vises akkurat nå — i den rekkefølgen de står i skjemaet. */
export function visibleDecisions(lookup) {
  const fields = [
    { id: 'bioGroup', label: 'Hovedgruppe' },
    { id: 'tStage', label: 'T-stadium' },
    { id: 'nStage', label: 'N-stadium' },
    { id: 'menopausal', label: 'Menopausal status' },
  ];
  if (!isHrPosHer2Neg(lookup)) return fields;

  if (!lookup.geneTestAvailable) {
    fields.push({ id: 'luminalLike', label: 'Luminal-liknende gruppe' });
    return fields;
  }

  fields.push({ id: 'geneTest', label: 'Genekspresjonstest' });
  if (lookup.geneTest === 'prosigna') {
    fields.push({ id: 'rorBand', label: 'ROR score' });
    if (lookup.rorBand === '41-60') fields.push({ id: 'prosignaSubtype', label: 'PAM50 subtype' });
  }
  if (lookup.geneTest === 'oncotypedx') fields.push({ id: 'rsBand', label: 'Recurrence Score' });
  return fields;
}

/** Valgene som vises, men ikke er tatt stilling til ennå. */
export function missingDecisions(lookup) {
  return visibleDecisions(lookup).filter((f) => lookup[f.id] === '' || lookup[f.id] == null);
}

/**
 * Sett ett felt og tøm alt som dermed skjules. Returnerer nytt objekt.
 * Et felt som ikke lenger vises, skal ikke kunne påvirke noe.
 */
export function setLookupField(lookup, field, value) {
  const next = { ...lookup, [field]: value };
  if (field === 'geneTest') {
    next.rorBand = '';
    next.rsBand = '';
    next.prosignaSubtype = '';
  }

  if (!isHrPosHer2Neg(next)) next.geneTestAvailable = false;

  const visible = new Set(visibleDecisions(next).map((f) => f.id));
  for (const id of ['geneTest', 'rorBand', 'prosignaSubtype', 'rsBand', 'luminalLike']) {
    if (!visible.has(id)) next[id] = '';
  }
  return next;
}

/**
 * Oppslaget oversatt til feltene innledningen forstår. Scoren skrives som
 * intervallet legen valgte, med tabellens skrivemåte.
 */
export function introLookup(lookup) {
  return {
    ...lookup,
    rorScore: findBand(ROR_BANDS, lookup.rorBand)?.introText || '',
    rsScore: findBand(RS_BANDS, lookup.rsBand)?.introText || '',
  };
}

// ----------------------------------------------------------------
//  Gjennomgang av tabellene
// ----------------------------------------------------------------

/**
 * Fingeravtrykk av det legen så da tabellen ble kvittert ut. Endres
 * markeringen etterpå, er gjennomgangen ikke lenger gyldig.
 */
export function reviewSignature(matches) {
  return matches.join(',');
}

/** 'todo' | 'done' | 'changed' */
export function reviewStatus(reviewed, tableId, matches) {
  if (!(tableId in reviewed)) return 'todo';
  return reviewed[tableId] === reviewSignature(matches) ? 'done' : 'changed';
}

/**
 * Hvor legen bør gå videre: første valg som mangler, ellers første tabell
 * som ikke er gått gjennom, ellers oppsummeringen.
 */
export function nextStep(lookup, sections, reviewed) {
  if (missingDecisions(lookup).length) return { kind: 'input' };
  const table = sections.find((s) => reviewStatus(reviewed, s.table.id, s.matches) !== 'done');
  if (table) return { kind: 'table', tableId: table.table.id };
  return { kind: 'summary' };
}

// ----------------------------------------------------------------
//  Utvalget i notatet
// ----------------------------------------------------------------

/**
 * Er en lagt-til rad fortsatt markert med nåværende valg? Fotnoter er ikke
 * knyttet til valgene og regnes alltid som gjeldende.
 */
export function isPickCurrent(pick, sections) {
  if (pick.kind !== 'row') return true;
  const section = sections.find((s) => s.table.id === pick.tableId);
  return !!section && section.matches.includes(pick.index);
}

/**
 * Antall rader og fotnoter per tabell, i den rekkefølgen tabellene først
 * dukker opp i notatet.
 */
export function summarizePicks(picks, tables) {
  const byId = Array.isArray(tables) ? Object.fromEntries(tables.map((t) => [t.id, t])) : tables;
  const order = [];
  const counts = {};
  for (const pick of picks) {
    if (!byId[pick.tableId]) continue;
    if (!counts[pick.tableId]) {
      counts[pick.tableId] = { table: byId[pick.tableId], rows: 0, footnotes: 0 };
      order.push(pick.tableId);
    }
    if (pick.kind === 'row') counts[pick.tableId].rows += 1;
    else counts[pick.tableId].footnotes += 1;
  }
  return order.map((id) => counts[id]);
}
