/**
 * Tekstuttrekk fra en rad i de ordrette NBCG-tabellene.
 *
 * Delt mellom Tabelloppslag og Tabelloppslag 2.0, slik at begge fanene
 * plukker de samme cellene ut av en rad. All tekst er ordrett fra PDF-en —
 * ingenting omskrives her.
 */

/**
 * Anbefalingsteksten: cellene tabellen selv peker ut som anbefaling.
 * Kolonner med `label` prefikses (f.eks. «Ribociklib: …») slik at tabeller med
 * flere anbefalingskolonner gir meningsfull tekst.
 */
export function buildJournalText(row, recCols) {
  const cols = recCols && recCols.length ? recCols : [{ idx: row.cells.length - 2 }];
  return cols
    .map((rc) => {
      const v = (row.cells[rc.idx] || '').trim();
      if (!v) return '';
      return rc.label ? `${rc.label}: ${v}` : v;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Forbeholdene: kolonnene som kommer *etter* anbefalingen — i praksis
 * «Grunnlag for eventuell vurdering av annet terapi-valg». Tabellene har ikke
 * noe eget forbehold-felt; teksten står her.
 *
 * Kolonnene før anbefalingen er oppslagsnøkler (hovedgruppe, subgruppering,
 * stadium) og hører hjemme i oppslagsveien, ikke blant forbeholdene.
 */
export function buildRationaleText(row, table) {
  const lastRec = Math.max(...(table.recCols || [{ idx: -1 }]).map((rc) => rc.idx));
  const parts = row.cells
    .map((cell, i) => ({ cell: (cell || '').trim(), i }))
    .filter(({ cell, i }) => cell && i > lastRec);

  // Med bare én forbeholdskolonne sier kolonneoverskriften ikke noe teksten
  // rundt ikke allerede sier — den tas bare med når flere kolonner må skilles.
  if (parts.length === 1) return parts[0].cell;

  return parts.map(({ cell, i }) => (table.columns[i] ? `${table.columns[i]}: ${cell}` : cell)).join('\n');
}

/**
 * Smulesti gjennom oppslagskolonnene, f.eks. «HR+ HER2- › LumB-liknende* › pT1-2pN1-3».
 *
 * Flere celler har en forklarende hale etter et linjeskift + stjerne
 * («LumB-liknende*\n\n*Følgende karakteristika: …»). Den hører til fotnotene,
 * ikke til navnet på raden, så den klippes bort her.
 */
export function buildRowPath(row, table) {
  return row.cells
    .slice(0, table.mergeCount + 1)
    .map((c) => (c || '').split(/\n\s*\*/)[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' › ');
}
