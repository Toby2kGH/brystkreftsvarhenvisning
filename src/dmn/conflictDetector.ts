/**
 * Regelkonfliktdetektor — Identifiserer overlappende og motstridende regler.
 *
 * For klinisk beslutningsstøtte kan motstridende regler føre til uforutsigbare
 * anbefalinger. Denne modulen detekterer:
 *
 * 1. Eksakte duplikater (identiske betingelser)
 * 2. Delmengdekonflikter (regel A sine betingelser er en delmengde av B sine)
 * 3. Motstridende output (overlappende betingelser med ulike resultat)
 * 4. Skyggelagte regler (uoppnåelige regler i FIRST hit-policy tabeller)
 */

import type { DMNTable, DMNRule, ConditionValue, RuleConflict } from '../types/clinical.js';

/**
 * Detekter konflikter i én tabell.
 */
export function detectConflicts(table: DMNTable): RuleConflict[] {
  const conflicts: RuleConflict[] = [];
  const rules = table.rules;

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const ruleA = rules[i]!;
      const ruleB = rules[j]!;

      const overlap = analyzeOverlap(ruleA, ruleB);
      if (!overlap) continue;

      if (overlap === 'exact') {
        conflicts.push({
          tableId: table.id,
          tableName: table.name,
          ruleA: ruleA.id,
          ruleB: ruleB.id,
          overlapDescription: `Identiske betingelser — ${ruleA.id} og ${ruleB.id} har nøyaktig samme betingelser`,
          severity: 'error',
        });
      } else if (overlap === 'a_subset_of_b') {
      // A er mer spesifikk enn B — hvis A kommer etter B i en FIRST-tabell, er A skyggelagt
        if (table.hitPolicy === 'FIRST') {
          conflicts.push({
            tableId: table.id,
            tableName: table.name,
            ruleA: ruleA.id,
            ruleB: ruleB.id,
            overlapDescription: `${ruleB.id} skygger ${ruleA.id}: ${ruleB.id} er mer generell og kommer først i en FIRST-tabell`,
            severity: 'warning',
          });
        }
      } else if (overlap === 'b_subset_of_a') {
        if (table.hitPolicy === 'FIRST') {
          conflicts.push({
            tableId: table.id,
            tableName: table.name,
            ruleA: ruleA.id,
            ruleB: ruleB.id,
            overlapDescription: `${ruleA.id} skygger ${ruleB.id}: ${ruleA.id} er mer generell og kommer først i en FIRST-tabell`,
            severity: 'warning',
          });
        }
      } else if (overlap === 'partial') {
        // Flagg kun hvis output er ulike
        if (outputsDiffer(ruleA, ruleB)) {
          conflicts.push({
            tableId: table.id,
            tableName: table.name,
            ruleA: ruleA.id,
            ruleB: ruleB.id,
            overlapDescription: `Overlappende betingelser med ulike resultater mellom ${ruleA.id} og ${ruleB.id}`,
            severity: 'info',
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detekter konflikter på tvers av alle tabeller.
 */
export function detectAllConflicts(tables: Record<string, DMNTable>): RuleConflict[] {
  const allConflicts: RuleConflict[] = [];
  for (const table of Object.values(tables)) {
    allConflicts.push(...detectConflicts(table));
  }
  return allConflicts;
}

type OverlapType = 'exact' | 'a_subset_of_b' | 'b_subset_of_a' | 'partial' | null;

/**
 * Analyser overlapp mellom to reglers betingelser.
 */
function analyzeOverlap(ruleA: DMNRule, ruleB: DMNRule): OverlapType {
  const keysA = Object.keys(ruleA.conditions);
  const keysB = Object.keys(ruleB.conditions);
  const allKeys = new Set([...keysA, ...keysB]);

  let aSubsetOfB = true;  // Alle A sine betingelser er innenfor B
  let bSubsetOfA = true;  // Alle B sine betingelser er innenfor A
  let anyOverlap = true;

  for (const key of allKeys) {
    const condA = ruleA.conditions[key];
    const condB = ruleB.conditions[key];

    // Hvis én regel mangler betingelsen, er den et wildcard (matcher alt)
    if (condA === undefined && condB !== undefined) {
      aSubsetOfB = false;  // A er bredere på denne dimensjonen
      continue;
    }
    if (condB === undefined && condA !== undefined) {
      bSubsetOfA = false;  // B er bredere på denne dimensjonen
      continue;
    }

    // Begge har denne betingelsen
    const rel = conditionRelation(condA, condB);
    if (rel === 'disjoint') {
      anyOverlap = false;
      break;
    }
    if (rel === 'a_in_b') {
      bSubsetOfA = false;
    } else if (rel === 'b_in_a') {
      aSubsetOfB = false;
    } else if (rel === 'overlap') {
      aSubsetOfB = false;
      bSubsetOfA = false;
    }
    // 'equal' endrer ingenting
  }

  if (!anyOverlap) return null;
  if (aSubsetOfB && bSubsetOfA) return 'exact';
  if (aSubsetOfB) return 'a_subset_of_b';
  if (bSubsetOfA) return 'b_subset_of_a';
  return 'partial';
}

type CondRelation = 'equal' | 'a_in_b' | 'b_in_a' | 'overlap' | 'disjoint';

/**
 * Bestem relasjonen mellom to betingelsesverdier.
 */
function conditionRelation(a: ConditionValue, b: ConditionValue): CondRelation {
  // Normaliser til mengder av aksepterte verdier der mulig
  const setA = conditionToValueSet(a);
  const setB = conditionToValueSet(b);

  if (setA && setB) {
    return setRelation(setA, setB);
  }

  // Range-sammenligning
  const rangeA = conditionToRange(a);
  const rangeB = conditionToRange(b);

  if (rangeA && rangeB) {
    return rangeRelation(rangeA, rangeB);
  }

  // Enkel likhet
  if (primitiveEqual(a, b)) return 'equal';

  // Kan ikke bestemme — anta overlapp (konservativt)
  return 'overlap';
}

function conditionToValueSet(cond: ConditionValue): Set<string> | null {
  if (cond === null || cond === undefined) return null;
  if (typeof cond === 'string' || typeof cond === 'number' || typeof cond === 'boolean') {
    return new Set([String(cond)]);
  }
  if (Array.isArray(cond)) {
    const set = new Set<string>();
    for (const item of cond) {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        set.add(String(item));
      } else {
        return null; // Kompleks nøsting — kan ikke redusere til mengde
      }
    }
    return set;
  }
  return null;
}

function setRelation(a: Set<string>, b: Set<string>): CondRelation {
  const aInB = [...a].every((v) => b.has(v));
  const bInA = [...b].every((v) => a.has(v));
  if (aInB && bInA) return 'equal';
  if (aInB) return 'a_in_b';
  if (bInA) return 'b_in_a';
  const hasOverlap = [...a].some((v) => b.has(v));
  return hasOverlap ? 'overlap' : 'disjoint';
}

interface Range {
  min: number;
  minInclusive: boolean;
  max: number;
  maxInclusive: boolean;
}

function conditionToRange(cond: ConditionValue): Range | null {
  if (typeof cond === 'number') {
    return { min: cond, minInclusive: true, max: cond, maxInclusive: true };
  }
  if (cond && typeof cond === 'object' && !Array.isArray(cond) && !('not' in cond)) {
    const obj = cond as Record<string, number>;
    let min = -Infinity, minInclusive = true;
    let max = Infinity, maxInclusive = true;
    if ('gte' in obj) { min = obj.gte!; minInclusive = true; }
    if ('gt' in obj) { min = obj.gt!; minInclusive = false; }
    if ('lte' in obj) { max = obj.lte!; maxInclusive = true; }
    if ('lt' in obj) { max = obj.lt!; maxInclusive = false; }
    return { min, minInclusive, max, maxInclusive };
  }
  return null;
}

function rangeRelation(a: Range, b: Range): CondRelation {
  // Sjekk disjunkte
  if (a.max < b.min || b.max < a.min) return 'disjoint';
  if (a.max === b.min && !(a.maxInclusive && b.minInclusive)) return 'disjoint';
  if (b.max === a.min && !(b.maxInclusive && a.minInclusive)) return 'disjoint';

  // Sjekk likhet
  if (a.min === b.min && a.max === b.max && a.minInclusive === b.minInclusive && a.maxInclusive === b.maxInclusive) {
    return 'equal';
  }

  // Sjekk inneslutning
  const aInB = (b.min < a.min || (b.min === a.min && (b.minInclusive || !a.minInclusive))) &&
               (b.max > a.max || (b.max === a.max && (b.maxInclusive || !a.maxInclusive)));
  const bInA = (a.min < b.min || (a.min === b.min && (a.minInclusive || !b.minInclusive))) &&
               (a.max > b.max || (a.max === b.max && (a.maxInclusive || !b.maxInclusive)));

  if (aInB) return 'a_in_b';
  if (bInA) return 'b_in_a';
  return 'overlap';
}

function primitiveEqual(a: unknown, b: unknown): boolean {
  return a === b;
}

function outputsDiffer(ruleA: DMNRule, ruleB: DMNRule): boolean {
  const keysA = Object.keys(ruleA.outputs);
  const keysB = Object.keys(ruleB.outputs);
  const allKeys = new Set([...keysA, ...keysB]);

  for (const key of allKeys) {
    if (JSON.stringify(ruleA.outputs[key]) !== JSON.stringify(ruleB.outputs[key])) {
      return true;
    }
  }
  return false;
}
