/**
 * Rule Conflict Detector — Identifies overlapping and contradictory rules.
 *
 * For clinical decision support, conflicting rules can lead to unpredictable
 * recommendations. This module detects:
 *
 * 1. Exact duplicates (identical conditions)
 * 2. Subset conflicts (rule A's conditions are a subset of rule B's)
 * 3. Contradictory outputs (overlapping conditions with different results)
 * 4. Shadowed rules (unreachable rules in FIRST hit-policy tables)
 */

import type { DMNTable, DMNRule, ConditionValue, RuleConflict } from '../types/clinical.js';

/**
 * Detect conflicts in a single table.
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
        // A is more specific than B — if A comes after B in a FIRST table, A is shadowed
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
        // Only flag if outputs differ
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
 * Detect conflicts across all tables.
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
 * Analyze the overlap between two rules' conditions.
 */
function analyzeOverlap(ruleA: DMNRule, ruleB: DMNRule): OverlapType {
  const keysA = Object.keys(ruleA.conditions);
  const keysB = Object.keys(ruleB.conditions);
  const allKeys = new Set([...keysA, ...keysB]);

  let aSubsetOfB = true;  // All of A's conditions are within B's
  let bSubsetOfA = true;  // All of B's conditions are within A's
  let anyOverlap = true;

  for (const key of allKeys) {
    const condA = ruleA.conditions[key];
    const condB = ruleB.conditions[key];

    // If one rule doesn't have this condition, it's a wildcard (matches anything)
    if (condA === undefined && condB !== undefined) {
      aSubsetOfB = false;  // A is broader on this dimension
      continue;
    }
    if (condB === undefined && condA !== undefined) {
      bSubsetOfA = false;  // B is broader on this dimension
      continue;
    }

    // Both have this condition
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
    // 'equal' doesn't change anything
  }

  if (!anyOverlap) return null;
  if (aSubsetOfB && bSubsetOfA) return 'exact';
  if (aSubsetOfB) return 'a_subset_of_b';
  if (bSubsetOfA) return 'b_subset_of_a';
  return 'partial';
}

type CondRelation = 'equal' | 'a_in_b' | 'b_in_a' | 'overlap' | 'disjoint';

/**
 * Determine the relationship between two condition values.
 */
function conditionRelation(a: ConditionValue, b: ConditionValue): CondRelation {
  // Normalize to sets of accepted values where possible
  const setA = conditionToValueSet(a);
  const setB = conditionToValueSet(b);

  if (setA && setB) {
    return setRelation(setA, setB);
  }

  // Range comparison
  const rangeA = conditionToRange(a);
  const rangeB = conditionToRange(b);

  if (rangeA && rangeB) {
    return rangeRelation(rangeA, rangeB);
  }

  // Simple equality
  if (primitiveEqual(a, b)) return 'equal';

  // Can't determine — assume overlap (conservative)
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
        return null; // Complex nested — can't reduce to set
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
  // Check disjoint
  if (a.max < b.min || b.max < a.min) return 'disjoint';
  if (a.max === b.min && !(a.maxInclusive && b.minInclusive)) return 'disjoint';
  if (b.max === a.min && !(b.maxInclusive && a.minInclusive)) return 'disjoint';

  // Check equality
  if (a.min === b.min && a.max === b.max && a.minInclusive === b.minInclusive && a.maxInclusive === b.maxInclusive) {
    return 'equal';
  }

  // Check containment
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
