/**
 * Setter sammen journaltekst fra radene legen har krysset av, på tvers av
 * tabeller.
 *
 * Én pasient treffer gjerne både en primærtabell og en tilleggstabell, og da
 * må begge anbefalingene med — hver med sin egen kilde. Alt her er ordrett
 * fra guidelineTables.js; ingenting omskrives eller tolkes.
 */

import { buildJournalText, buildRationaleText, buildRowPath } from './journalText.js';

/** Stabil nøkkel for én rad i én tabell — brukes til avkryssingene i UI. */
export function rowKey(tableId, rowIndex) {
  return `${tableId}:${rowIndex}`;
}

/**
 * Én avkrysset rad som tekstblokk: hvilken tabell og rad, anbefalingen
 * ordrett, eventuelt grunnlag/forbehold, og kilden.
 */
export function formatRowBlock(row, table, { includeRationale = true, includeSource = true } = {}) {
  const lines = [`${table.shortTitle} — ${buildRowPath(row, table)}`];

  const recommendation = buildJournalText(row, table.recCols);
  if (recommendation) lines.push(recommendation);

  if (includeRationale) {
    const rationale = buildRationaleText(row, table);
    if (rationale) lines.push(`Grunnlag for eventuelt annet terapivalg: ${rationale}`);
  }

  if (includeSource) lines.push(`Kilde: ${table.source}`);

  return lines.join('\n');
}

/**
 * Alle avkryssede rader, i den rekkefølgen tabellene vises.
 *
 * @param sections  [{ table, matches: number[] }] — treffende rader per tabell
 * @param selected  Set med nøkler fra rowKey()
 */
export function buildLookupText(sections, selected, options = {}) {
  const blocks = [];
  for (const { table, matches } of sections) {
    for (const rowIndex of matches) {
      if (!selected.has(rowKey(table.id, rowIndex))) continue;
      blocks.push(formatRowBlock(table.rows[rowIndex], table, options));
    }
  }
  return blocks.join('\n\n');
}

/** Kun anbefalingscellene, uten oppslagsvei, grunnlag eller kilde. */
export function buildRecommendationsOnly(sections, selected) {
  const blocks = [];
  for (const { table, matches } of sections) {
    for (const rowIndex of matches) {
      if (!selected.has(rowKey(table.id, rowIndex))) continue;
      const text = buildJournalText(table.rows[rowIndex], table.recCols);
      if (text) blocks.push(text);
    }
  }
  return blocks.join('\n\n');
}

/** Kildene til de tabellene som faktisk har en avkrysset rad, uten gjentakelser. */
export function buildSources(sections, selected) {
  const sources = [];
  for (const { table, matches } of sections) {
    const used = matches.some((i) => selected.has(rowKey(table.id, i)));
    if (used && !sources.includes(table.source)) sources.push(table.source);
  }
  return sources.join('\n');
}

/** Fotnotene til de samme tabellene, ordrett. */
export function buildFootnotes(sections, selected) {
  const out = [];
  for (const { table, matches } of sections) {
    const used = matches.some((i) => selected.has(rowKey(table.id, i)));
    if (!used || !table.footnotes?.length) continue;
    out.push(`${table.shortTitle}:\n${table.footnotes.join('\n')}`);
  }
  return out.join('\n\n');
}

/** Alle treffende rader, avkrysset som standard — legen fjerner det som ikke skal med. */
export function defaultSelection(sections) {
  const set = new Set();
  for (const { table, matches } of sections) {
    for (const rowIndex of matches) set.add(rowKey(table.id, rowIndex));
  }
  return set;
}

// ================================================================
//  Ordnet utvalg (versjon 1.1)
//
//  Her er ikke utvalget et sett, men en liste legen selv har bygget:
//  rekkefølgen er hans, og fotnoter kan flettes inn mellom radene.
//  Skillet mot `selected` over er med vilje — der er alt som treffer med
//  til legen fjerner det, her er ingenting med før legen legger det til.
// ================================================================

/** Stabil nøkkel for én plukket bit — rad eller fotnote. */
export function pickKey(pick) {
  return `${pick.kind}:${pick.tableId}:${pick.index}`;
}

/** Er denne raden/fotnoten allerede lagt til? */
export function hasPick(picks, kind, tableId, index) {
  return picks.some((p) => p.kind === kind && p.tableId === tableId && p.index === index);
}

/** Én fotnote som tekstblokk, merket med hvilken tabell den hører til. */
export function formatFootnoteBlock(table, index) {
  const note = table.footnotes?.[index];
  if (!note) return '';
  return `Fotnote — ${table.shortTitle} (rev. ${table.revision}):\n${note}`;
}

/**
 * Teksten i den rekkefølgen legen har lagt bitene inn.
 *
 * @param picks   [{ kind: 'row' | 'footnote', tableId, index }]
 * @param tables  oppslagbare tabeller (array eller objekt med id som nøkkel)
 */
export function buildPickedText(picks, tables, options = {}) {
  const byId = Array.isArray(tables)
    ? Object.fromEntries(tables.map((t) => [t.id, t]))
    : tables;

  const blocks = [];
  for (const pick of picks) {
    const table = byId[pick.tableId];
    if (!table) continue;
    if (pick.kind === 'row') {
      const row = table.rows[pick.index];
      if (row) blocks.push(formatRowBlock(row, table, options));
    } else if (pick.kind === 'footnote') {
      const block = formatFootnoteBlock(table, pick.index);
      if (block) blocks.push(block);
    }
  }
  return blocks.join('\n\n');
}

/** Kort etikett for listen i høyre kolonne. */
export function describePick(pick, tables) {
  const byId = Array.isArray(tables) ? Object.fromEntries(tables.map((t) => [t.id, t])) : tables;
  const table = byId[pick.tableId];
  if (!table) return '(ukjent)';
  if (pick.kind === 'row') {
    const row = table.rows[pick.index];
    return row ? `${table.shortTitle} — ${buildRowPath(row, table)}` : table.shortTitle;
  }
  const note = table.footnotes?.[pick.index] || '';
  const short = note.length > 70 ? `${note.slice(0, 70).trimEnd()}…` : note;
  return `Fotnote (${table.shortTitle}): ${short}`;
}

/** Flytt en bit opp eller ned i rekkefølgen. Returnerer en ny liste. */
export function movePick(picks, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= picks.length) return picks;
  const next = [...picks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
