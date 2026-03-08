/**
 * DMN Decision Engine
 *
 * Evaluerer DMN-beslutningstabeller mot CQL-output.
 * Implementerer hit policies: PRIORITY, FIRST, COLLECT, RULE ORDER.
 *
 * I BPM+ Health-arkitekturen mottar DMN-motoren strukturerte data
 * fra CQL-evaluering og produserer kliniske anbefalinger.
 */

/**
 * Evaluer en beslutningstabel mot gitt input-kontekst.
 *
 * @param {Object} table - DMN-beslutningstabel (fra decisionTables.js)
 * @param {Object} context - Input-kontekst fra CQL-evaluering
 * @returns {Object} Evalueringsresultat med anbefaling(er)
 */
export function evaluateDecisionTable(table, context) {
  const matchingRules = [];

  for (const rule of table.rules) {
    const match = evaluateRule(rule, context);
    if (match) {
      matchingRules.push({
        ruleId: rule.id,
        priority: rule.priority ?? 0,
        description: rule.description,
        outputs: rule.outputs,
      });
    }
  }

  if (matchingRules.length === 0) {
    return {
      tableId: table.id,
      tableName: table.name,
      matched: false,
      result: null,
      matchedRules: [],
      allRulesEvaluated: table.rules.length,
    };
  }

  let result;
  switch (table.hitPolicy) {
    case 'PRIORITY':
      matchingRules.sort((a, b) => b.priority - a.priority);
      result = matchingRules[0].outputs;
      break;
    case 'FIRST':
      result = matchingRules[0].outputs;
      break;
    case 'COLLECT':
      result = matchingRules.map((r) => r.outputs);
      break;
    case 'RULE ORDER':
      result = matchingRules.map((r) => r.outputs);
      break;
    default:
      result = matchingRules[0].outputs;
  }

  return {
    tableId: table.id,
    tableName: table.name,
    matched: true,
    result,
    matchedRules: matchingRules,
    allRulesEvaluated: table.rules.length,
    hitPolicy: table.hitPolicy,
  };
}

/**
 * Evaluer en enkelt regel mot kontekst.
 * Støtter: eksakt match, arrays (OR), objekter med 'not' (negasjon).
 */
function evaluateRule(rule, context) {
  for (const [inputId, expected] of Object.entries(rule.conditions)) {
    const actual = context[inputId];

    if (!matchCondition(expected, actual)) {
      return false;
    }
  }
  return true;
}

/**
 * Match en enkelt betingelse mot en verdi.
 * Implementerer en subset av FEEL-semantikk:
 * - Eksakt verdi: 'high' matcher 'high'
 * - Array (disjunksjon): ['pre', 'peri'] matcher 'pre' eller 'peri'
 * - Objekt med 'not': { not: 'high' } matcher alt unntatt 'high'
 * - Boolean: true/false eksakt match
 * - Null/undefined: behandles som "any" (wildcard)
 */
function matchCondition(expected, actual) {
  // Null/undefined condition = wildcard (matches anything)
  if (expected == null) return true;

  // Negasjon: { not: value }
  if (typeof expected === 'object' && !Array.isArray(expected) && 'not' in expected) {
    return !matchCondition(expected.not, actual);
  }

  // Array = disjunksjon (OR)
  if (Array.isArray(expected)) {
    return expected.some((e) => matchCondition(e, actual));
  }

  // Eksakt match
  return expected === actual;
}

/**
 * Evaluer flere beslutningstabeller i sekvens (DRD - Decision Requirements Diagram).
 * Output fra en tabell kan brukes som input til neste.
 */
export function evaluateDecisionChain(tables, initialContext) {
  let context = { ...initialContext };
  const results = [];

  for (const table of tables) {
    const result = evaluateDecisionTable(table, context);
    results.push(result);

    // Merg output til kontekst for neste tabell
    if (result.matched && result.result && !Array.isArray(result.result)) {
      context = { ...context, ...result.result };
    }
  }

  return {
    finalContext: context,
    tableResults: results,
  };
}

/**
 * Formater evalueringsresultat til klinisk vennlig output
 */
export function formatRecommendation(result) {
  if (!result.matched) {
    return {
      summary: 'Ingen anbefaling',
      detail: 'Beslutningstabellen ga ingen treff for de angitte pasientdataene.',
      recommendation: null,
      confidence: null,
      rationale: null,
      warnings: [],
    };
  }

  const output = result.result;
  return {
    summary: output.recommendation
      ? `Anbefalt: ${output.recommendation}`
      : 'Ingen spesifikk anbefaling',
    detail: output.rationale || '',
    recommendation: output.recommendation || null,
    confidence: output.confidence || null,
    rationale: output.rationale || null,
    warnings: output.warnings || [],
    combinationPartner: output.combinationPartner || null,
    matchedRule: result.matchedRules?.[0]?.ruleId || null,
    allMatchedRules: result.matchedRules?.map((r) => r.ruleId) || [],
  };
}

export default { evaluateDecisionTable, evaluateDecisionChain, formatRecommendation };
