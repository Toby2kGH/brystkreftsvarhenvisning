/**
 * Tre-tilstands klassifisering av beslutningsregler mot delvis utfylte pasientdata.
 *
 * Regelmotoren (dmnEngine) svarer ja/nei på om en regel treffer, fordi den
 * kjøres på et ferdig utfylt datasett. Ved manuelt oppslag fylles skjemaet ut
 * gradvis, og da er «vet ikke ennå» et eget svar: en regel som krever Ki-67
 * skal ikke skjules før klinikeren faktisk har oppgitt Ki-67.
 *
 * Betingelses-semantikken (FEEL-subsettet) gjenbrukes fra dmnEngine, slik at
 * oppslaget og evalueringen ikke kan tolke den samme regelen ulikt.
 */

import { matchCondition } from './dmnEngine.js';

export const MATCH = 'match';
export const UNKNOWN = 'unknown';
export const EXCLUDED = 'excluded';

/** Wildcard-betingelser stiller ingen krav og trenger derfor ingen data. */
function isWildcard(expected) {
  return expected == null;
}

/**
 * Klassifiser én regel mot en (mulig ufullstendig) kontekst.
 *
 * @returns {{ status: string, unknownKeys: string[], failedKeys: string[] }}
 *   - `match`    — alle betingelser er oppfylt med dataene som foreligger
 *   - `unknown`  — ingen betingelse er brutt, men noen mangler data ennå
 *   - `excluded` — minst én betingelse er sikkert brutt
 */
export function classifyRule(rule, context = {}) {
  const unknownKeys = [];
  const failedKeys = [];

  for (const [inputId, expected] of Object.entries(rule.conditions || {})) {
    if (isWildcard(expected)) continue;

    const actual = context[inputId];
    if (actual === undefined || actual === null || actual === '') {
      unknownKeys.push(inputId);
      continue;
    }

    if (!matchCondition(expected, actual)) {
      failedKeys.push(inputId);
    }
  }

  let status = MATCH;
  if (failedKeys.length > 0) status = EXCLUDED;
  else if (unknownKeys.length > 0) status = UNKNOWN;

  return { status, unknownKeys, failedKeys };
}

const STATUS_ORDER = { [MATCH]: 0, [UNKNOWN]: 1, [EXCLUDED]: 2 };

/**
 * Klassifiser alle radene i en tabell og sorter dem slik klinikeren leser dem:
 * treff først, så de som mangler data, så de utelukkede. Innenfor hver gruppe
 * beholdes tabellens egen rekkefølge — den speiler NBCG-dokumentet.
 */
export function classifyTableRules(table, context = {}) {
  if (!table || !Array.isArray(table.rules)) return [];
  return table.rules
    .map((rule, index) => ({ rule, index, ...classifyRule(rule, context) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.index - b.index);
}

/** Antall rader per status — brukes til teller-merkene i oppslaget. */
export function countByStatus(classified) {
  return classified.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    { [MATCH]: 0, [UNKNOWN]: 0, [EXCLUDED]: 0 },
  );
}
