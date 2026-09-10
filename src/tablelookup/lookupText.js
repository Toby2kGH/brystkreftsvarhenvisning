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
