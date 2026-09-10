/**
 * Tester for tre-tilstands klassifisering i det manuelle tabelloppslaget.
 *
 * Det kritiske skillet: en regel skal først forsvinne fra listen når dataene
 * faktisk motsier den — ikke når klinikeren ennå ikke har fylt ut feltet.
 */

import { describe, it, expect } from 'vitest';
import { classifyRule, classifyTableRules, countByStatus, MATCH, UNKNOWN, EXCLUDED } from '../src/dmn/ruleMatcher.js';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import { CDK46_DECISION_TABLE, ENDOCRINE_THERAPY_TABLE } from '../src/dmn/decisionTables.js';

describe('classifyRule — grunntilfeller', () => {
  const rule = { id: 'X1', conditions: { bioGroup: 'TN', nStage: 'N1' } };

  it('gir match når alle betingelser er oppfylt', () => {
    const r = classifyRule(rule, { bioGroup: 'TN', nStage: 'N1' });
    expect(r.status).toBe(MATCH);
    expect(r.unknownKeys).toEqual([]);
    expect(r.failedKeys).toEqual([]);
  });

  it('gir unknown og navngir feltet som mangler', () => {
    const r = classifyRule(rule, { bioGroup: 'TN' });
    expect(r.status).toBe(UNKNOWN);
    expect(r.unknownKeys).toEqual(['nStage']);
  });

  it('gir excluded når en betingelse er sikkert brutt', () => {
    const r = classifyRule(rule, { bioGroup: 'HR+HER2-', nStage: 'N1' });
    expect(r.status).toBe(EXCLUDED);
    expect(r.failedKeys).toEqual(['bioGroup']);
  });

  it('lar sikker bom veie tyngre enn manglende data', () => {
    const r = classifyRule(rule, { bioGroup: 'HR+HER2-' });
    expect(r.status).toBe(EXCLUDED);
  });

  it('behandler tom streng og null som ikke utfylt', () => {
    expect(classifyRule(rule, { bioGroup: '', nStage: null }).status).toBe(UNKNOWN);
  });

  it('gir match for regel uten betingelser', () => {
    expect(classifyRule({ id: 'F', conditions: {} }, {}).status).toBe(MATCH);
  });
});

describe('classifyRule — FEEL-semantikk følger regelmotoren', () => {
  it('array er disjunksjon', () => {
    const rule = { id: 'A', conditions: { nStage: ['N1', 'N2'] } };
    expect(classifyRule(rule, { nStage: 'N2' }).status).toBe(MATCH);
    expect(classifyRule(rule, { nStage: 'N3' }).status).toBe(EXCLUDED);
  });

  it('not-betingelse negerer', () => {
    const rule = { id: 'B', conditions: { bioGroup: { not: 'TN' } } };
    expect(classifyRule(rule, { bioGroup: 'HR+HER2-' }).status).toBe(MATCH);
    expect(classifyRule(rule, { bioGroup: 'TN' }).status).toBe(EXCLUDED);
  });

  it('range-betingelser sammenlignes numerisk', () => {
    const rule = { id: 'C', conditions: { ki67Value: { gte: 30 } } };
    expect(classifyRule(rule, { ki67Value: 30 }).status).toBe(MATCH);
    expect(classifyRule(rule, { ki67Value: 29 }).status).toBe(EXCLUDED);
    expect(classifyRule(rule, {}).status).toBe(UNKNOWN);
  });

  it('null-betingelse er wildcard og krever ingen data', () => {
    const rule = { id: 'D', conditions: { her2sish: null, her2ihc: '3+' } };
    const r = classifyRule(rule, { her2ihc: '3+' });
    expect(r.status).toBe(MATCH);
    expect(r.unknownKeys).toEqual([]);
  });

  it('boolean-betingelser matcher eksakt', () => {
    const rule = { id: 'E', conditions: { cdk46eligible: true } };
    expect(classifyRule(rule, { cdk46eligible: true }).status).toBe(MATCH);
    expect(classifyRule(rule, { cdk46eligible: false }).status).toBe(EXCLUDED);
  });
});

describe('classifyTableRules', () => {
  const context = { cdk46eligible: true, nStage: 'N3' };

  it('sorterer treff først, så mulige, så utelukkede', () => {
    const rows = classifyTableRules(CDK46_DECISION_TABLE, context);
    const order = rows.map((r) => r.status);
    const firstExcluded = order.indexOf(EXCLUDED);
    const lastMatch = order.lastIndexOf(MATCH);
    expect(rows.length).toBe(CDK46_DECISION_TABLE.rules.length);
    if (firstExcluded !== -1 && lastMatch !== -1) expect(lastMatch).toBeLessThan(firstExcluded);
  });

  it('beholder tabellens egen rekkefølge innenfor hver status', () => {
    const rows = classifyTableRules(CDK46_DECISION_TABLE, context);
    const matched = rows.filter((r) => r.status === MATCH).map((r) => r.index);
    expect(matched).toEqual([...matched].sort((a, b) => a - b));
  });

  it('gir tom liste for manglende tabell', () => {
    expect(classifyTableRules(null, {})).toEqual([]);
    expect(classifyTableRules({}, {})).toEqual([]);
  });

  it('snevrer inn etter hvert som kontekst fylles ut', () => {
    const empty = countByStatus(classifyTableRules(ENDOCRINE_THERAPY_TABLE, {}));
    const filled = countByStatus(classifyTableRules(ENDOCRINE_THERAPY_TABLE, {
      menopausalStatus: 'post',
      isHighRisk: false,
    }));
    expect(empty[EXCLUDED]).toBe(0);
    expect(filled[EXCLUDED]).toBeGreaterThan(0);
  });
});

describe('samsvar med evaluateDecisionTable', () => {
  it('regelen motoren velger er klassifisert som match ved fullstendige data', () => {
    const context = { menopausalStatus: 'post', isHighRisk: false };
    const engineResult = evaluateDecisionTable(ENDOCRINE_THERAPY_TABLE, context);
    if (!engineResult?.ruleId) return;

    const row = classifyTableRules(ENDOCRINE_THERAPY_TABLE, context)
      .find((r) => r.rule.id === engineResult.ruleId);
    expect(row.status).toBe(MATCH);
  });

  it('ingen regel motoren ville truffet er feilaktig utelukket', () => {
    const context = { cdk46eligible: true, nStage: 'N3' };
    const engineResult = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    if (!engineResult?.ruleId) return;

    const row = classifyTableRules(CDK46_DECISION_TABLE, context)
      .find((r) => r.rule.id === engineResult.ruleId);
    expect(row.status).not.toBe(EXCLUDED);
  });
});
