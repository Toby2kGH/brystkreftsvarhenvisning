/**
 * Tre-tilstands klassifisering av rader i de ordrette NBCG-tabellene.
 *
 * matcher.js svarer ja/nei: et felt som ikke er fylt ut blokkerer ikke treff,
 * så en underspesifisert pasient treffer mange rader. Det er riktig for
 * markering, men ikke nok for en arbeidsflate som fylles ut gradvis — der er
 * «vet ikke ennå» et eget svar, slik at klinikeren ser hvilke opplysninger
 * som gjenstår før raden kan avgjøres.
 *
 * Avgjørelsen for kjente felter delegeres til rowMatches, slik at de to
 * verktøyene aldri kan tolke den samme raden ulikt.
 */

import { rowMatches } from './matcher.js';

export const MATCH = 'match';
export const UNKNOWN = 'unknown';
export const EXCLUDED = 'excluded';

/** Hvilket input-felt hvert crit-felt spør etter, og hvordan feltet leses. */
const CRIT_FIELDS = {
  bioGroup: 'bioGroup',
  menopausal: 'menopausal',
  geneTest: 'geneTest',
  prosignaSubtype: 'prosignaSubtype',
  luminalLike: 'luminalLike',
  tStage: 'tStage',
  tSimple: 'tSimple',
  nStage: 'nStage',
  grade: 'grade',
  rorMin: 'rorScore',
  rorMax: 'rorScore',
  rsMin: 'rsScore',
  rsMax: 'rsScore',
};

/** Lesbare navn til «Avhenger av»-linjen i oppslaget. */
export const FIELD_LABELS = {
  bioGroup: 'hovedgruppe (HR/HER2)',
  menopausal: 'menopausal status',
  geneTest: 'genekspresjonstest',
  prosignaSubtype: 'PAM50 subtype',
  luminalLike: 'luminal-liknende gruppe',
  tStage: 'T-stadium',
  tSimple: 'T-stadium',
  nStage: 'N-stadium',
  grade: 'histologisk grad',
  rorScore: 'ROR-score',
  rsScore: 'RS-score',
};

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

/** Samle input-feltene ett crit-sett spør etter, men som ikke er oppgitt. */
function collectUnknown(crit, input, into) {
  for (const [critKey, inputKey] of Object.entries(CRIT_FIELDS)) {
    if (crit[critKey] == null) continue;
    if (isMissing(input[inputKey])) into.add(inputKey);
  }
}

/**
 * Klassifiser én rad mot en (mulig ufullstendig) input.
 *
 * @returns {{ status: string, unknownKeys: string[] }}
 *   - `match`    — raden treffer med opplysningene som foreligger
 *   - `unknown`  — ingen kriterier er brutt, men noen mangler data
 *   - `excluded` — minst ett kriterium er sikkert brutt
 */
export function classifyGuidelineRow(crit, input = {}) {
  if (!crit) return { status: MATCH, unknownKeys: [] };

  const unknown = new Set();
  collectUnknown(crit, input, unknown);
  // anyOf er en disjunksjon: den er først ubestemt når ingen gren kan avgjøres
  if (crit.anyOf?.length) {
    const branchUnknowns = crit.anyOf.map((sub) => {
      const s = new Set();
      collectUnknown(sub, input, s);
      return s;
    });
    const anyBranchDecidable = branchUnknowns.some((s) => s.size === 0);
    if (!anyBranchDecidable) {
      for (const s of branchUnknowns) for (const k of s) unknown.add(k);
    }
  }

  // rowMatches er permissiv for manglende felt, så et «false» her er en sikker bom.
  if (!rowMatches(crit, input)) return { status: EXCLUDED, unknownKeys: [...unknown] };

  return unknown.size > 0
    ? { status: UNKNOWN, unknownKeys: [...unknown] }
    : { status: MATCH, unknownKeys: [] };
}

const STATUS_ORDER = { [MATCH]: 0, [UNKNOWN]: 1, [EXCLUDED]: 2 };

/**
 * Klassifiser alle radene i en tabell og sorter dem slik klinikeren leser dem:
 * treff først, så de som mangler data, så de utelukkede. Innenfor hver gruppe
 * beholdes tabellens egen rekkefølge — den speiler PDF-en.
 */
export function classifyTable(table, input = {}) {
  if (!table || !Array.isArray(table.rows)) return [];
  return table.rows
    .map((row, index) => ({ row, index, ...classifyGuidelineRow(row.crit, input) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.index - b.index);
}

/** Antall rader per status — brukes til teller-merkene i oppslaget. */
export function countByStatus(classified) {
  return classified.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    { [MATCH]: 0, [UNKNOWN]: 0, [EXCLUDED]: 0 },
  );
}
