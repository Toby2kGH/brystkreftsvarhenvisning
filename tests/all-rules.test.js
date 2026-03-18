/**
 * Comprehensive Rule-Level Tests — Every rule in every table must be verified.
 *
 * These tests ensure that:
 * 1. Each rule fires for its intended patient profile
 * 2. Each rule produces the expected output
 * 3. Rules don't accidentally shadow each other
 *
 * Naming convention: [TableID] / [RuleID] — [Description]
 */

import { describe, it, expect } from 'vitest';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import {
  HER2_DETERMINATION_TABLE,
  CHEMO_PATHWAY_TABLE,
  CDK46_DECISION_TABLE,
  ENDOCRINE_THERAPY_TABLE,
  ZOMETA_TABLE,
  RADIATION_TABLE,
  HRPOS_HER2POS_TABLE,
  HRNEG_HER2POS_TABLE,
  TN_TABLE,
  NEOADJUVANT_TABLE,
  NEAR_CUTOFF_TABLE,
  ALL_DECISION_TABLES,
} from '../src/dmn/decisionTables.js';

/**
 * Helper: evaluate and assert the first matched rule.
 */
function expectRule(table, context, expectedRuleId) {
  const result = evaluateDecisionTable(table, context);
  expect(result.matched, `Expected a match for rule ${expectedRuleId} but got no match. Context: ${JSON.stringify(context)}`).toBe(true);
  const matchedId = result.matchedRules[0]?.ruleId;
  expect(matchedId, `Expected rule ${expectedRuleId} but got ${matchedId}`).toBe(expectedRuleId);
  return result;
}

function expectNoMatch(table, context) {
  const result = evaluateDecisionTable(table, context);
  expect(result.matched).toBe(false);
}

// ============================================================
// 1. HER2 DETERMINATION TABLE
// ============================================================

describe('HER2 Determination Table', () => {
  const T = HER2_DETERMINATION_TABLE;

  it('H1 — IHC 3+ → positive', () => {
    const r = expectRule(T, { her2ihc: '3+' }, 'H1');
    expect(r.result.her2Result).toBe('positive');
  });

  it('H2 — IHC 0 → negative', () => {
    const r = expectRule(T, { her2ihc: '0' }, 'H2');
    expect(r.result.her2Result).toBe('negative');
  });

  it('H3 — IHC 1+ → negative', () => {
    const r = expectRule(T, { her2ihc: '1+' }, 'H3');
    expect(r.result.her2Result).toBe('negative');
  });

  it('H4 — IHC 2+ SISH positive → positive', () => {
    const r = expectRule(T, { her2ihc: '2+', her2sish: 'positive' }, 'H4');
    expect(r.result.her2Result).toBe('positive');
  });

  it('H5 — IHC 2+ SISH negative → negative', () => {
    const r = expectRule(T, { her2ihc: '2+', her2sish: 'negative' }, 'H5');
    expect(r.result.her2Result).toBe('negative');
  });

  it('H6 — IHC 2+ no SISH → equivocal', () => {
    const r = expectRule(T, { her2ihc: '2+' }, 'H6');
    expect(r.result.her2Result).toBe('equivocal');
  });
});

// ============================================================
// 2. CHEMO PATHWAY (HR+HER2-) — Selected representative rules
// ============================================================

describe('Chemo Pathway HR+HER2-', () => {
  const T = CHEMO_PATHWAY_TABLE;

  it('CP1 — N2/N3 → always chemo', () => {
    const r = expectRule(T, { nStage: 'N2' }, 'CP1');
    expect(r.result.pathway).toBe('EC');
  });

  it('CP1 — N3 also matches', () => {
    expectRule(T, { nStage: 'N3' }, 'CP1');
  });

  it('CP_A1 — N0, Prosigna ROR≤40, T1a → none', () => {
    const r = expectRule(T, { nStage: 'N0', geneTest: 'prosigna', rorScore: 30, tStage: 'T1a' }, 'CP_A1');
    expect(r.result.pathway).toBe('none');
  });

  it('CP_A3 — N0, Prosigna ROR≤40, T1c → endocrine', () => {
    expectRule(T, { nStage: 'N0', geneTest: 'prosigna', rorScore: 35, tStage: 'T1c', grade: 2 }, 'CP_A3');
  });

  it('CP_D3 — N0, Prosigna ROR>60, T1c → EC+taxan', () => {
    const r = expectRule(T, { nStage: 'N0', geneTest: 'prosigna', rorScore: 70, tStage: 'T1c' }, 'CP_D3');
    expect(r.result.pathway).toBe('EC_taxan');
  });

  it('CP19 — N0, OncotypeDX RS≤25 → none', () => {
    const r = expectRule(T, { nStage: 'N0', geneTest: 'oncotypedx', rsScore: 20 }, 'CP19');
    expect(r.result.pathway).toBe('none');
  });

  it('CP20 — N0, OncotypeDX RS>25 → EC', () => {
    const r = expectRule(T, { nStage: 'N0', geneTest: 'oncotypedx', rsScore: 30 }, 'CP20');
    expect(r.result.pathway).toBe('EC');
  });

  it('CP_F1 — N0, LumA-like (Ki67<10, G1, ER>50), T1a → none', () => {
    expectRule(T, { nStage: 'N0', ki67Value: 5, grade: 1, erPercent: 80, tStage: 'T1a', geneTest: 'none' }, 'CP_F1');
  });

  it('CP_G2 — N0, LumB-like (ER<50), T1c → EC', () => {
    const r = expectRule(T, { nStage: 'N0', erPercent: 30, tStage: 'T1c', geneTest: 'none' }, 'CP_G2');
    expect(r.result.pathway).toBe('EC');
  });

  it('CP_E1 — N1, OncotypeDX RS≤25, post, ER≥50 → none', () => {
    expectRule(T, { nStage: 'N1', geneTest: 'oncotypedx', rsScore: 20, menopausalStatus: 'post', erPercent: 60 }, 'CP_E1');
  });

  it('CP_E3 — N1, OncotypeDX RS>25, post → EC_taxan', () => {
    const r = expectRule(T, { nStage: 'N1', geneTest: 'oncotypedx', rsScore: 30, menopausalStatus: 'post' }, 'CP_E3');
    expect(r.result.pathway).toBe('EC_taxan');
  });

  it('CP9 — N1mi, Prosigna ROR≤40, ER<50 → consider', () => {
    expectRule(T, { nStage: 'N1mi', geneTest: 'prosigna', rorScore: 30, erPercent: 30 }, 'CP9');
  });

  it('CP11 — N1mi, OncotypeDX RS≤25 → none', () => {
    expectRule(T, { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: 20 }, 'CP11');
  });

  it('CP14 — N1mi, Grade 3 → EC', () => {
    expectRule(T, { nStage: 'N1mi', grade: 3, geneTest: 'none', tumorSizeMm: 25 }, 'CP14');
  });

  it('CP25 — Fallback (empty context) → gene_test_needed', () => {
    const r = expectRule(T, {}, 'CP25');
    expect(r.result.pathway).toBe('gene_test_needed');
  });
});

// ============================================================
// 3. CDK4/6 DECISION TABLE
// ============================================================

describe('CDK4/6 Adjuvant Selection', () => {
  const T = CDK46_DECISION_TABLE;

  it('R0 — Not eligible → no', () => {
    const r = expectRule(T, { cdk46eligible: false }, 'R0');
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });

  it('R1 — T1 N0 (Stage I) → both no', () => {
    const r = expectRule(T, { cdk46eligible: true, tSimple: 'T1', nStage: 'N0' }, 'R1');
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });

  it('R2 — T2 N0 → ribo if_G3_or_gesHigh', () => {
    const r = expectRule(T, { cdk46eligible: true, tSimple: 'T2', nStage: 'N0' }, 'R2');
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('if_G3_or_gesHigh');
  });

  it('R3 — T1 N1 → abema if_monarchE, ribo if_G3_or_gesHigh', () => {
    const r = expectRule(T, { cdk46eligible: true, tSimple: 'T1', nStage: 'N1' }, 'R3');
    expect(r.result.abemaciclib).toBe('if_monarchE');
    expect(r.result.ribociclib).toBe('if_G3_or_gesHigh');
  });

  it('R4 — T2 N1 → abema if_monarchE, ribo yes_unless_low', () => {
    const r = expectRule(T, { cdk46eligible: true, tSimple: 'T2', nStage: 'N1' }, 'R4');
    expect(r.result.abemaciclib).toBe('if_monarchE');
    expect(r.result.ribociclib).toBe('yes_unless_low');
  });

  it('R5 — T3 N0 → ribo yes_unless_low', () => {
    const r = expectRule(T, { cdk46eligible: true, tSimple: 'T3', nStage: 'N0' }, 'R5');
    expect(r.result.ribociclib).toBe('yes_unless_low');
  });

  it('R6 — N2 → abema first_choice', () => {
    const r = expectRule(T, { cdk46eligible: true, nStage: 'N2', tSimple: 'T2' }, 'R6');
    expect(r.result.abemaciclib).toBe('first_choice');
    expect(r.result.ribociclib).toBe('yes');
  });

  it('R8 — N3 → abema first_choice', () => {
    const r = expectRule(T, { cdk46eligible: true, nStage: 'N3', tSimple: 'T1' }, 'R8');
    expect(r.result.abemaciclib).toBe('first_choice');
  });

  it('R_N1mi — N1mi → no CDK4/6i', () => {
    const r = expectRule(T, { cdk46eligible: true, nStage: 'N1mi', tSimple: 'T2' }, 'R_N1mi');
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });
});

// ============================================================
// 4. ENDOCRINE THERAPY TABLE
// ============================================================

describe('Endocrine Therapy Selection', () => {
  const T = ENDOCRINE_THERAPY_TABLE;

  it('ET0 — HR-negative → ingen', () => {
    const r = expectRule(T, { hrPositive: false }, 'ET0');
    expect(r.result.therapy).toBe('ingen');
  });

  it('ET1 — Postmenopausal high risk → AI 5-10 yr', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'post', isHighRisk: true }, 'ET1');
    expect(r.result.therapy).toBe('aromatasehemmer');
  });

  it('ET1b — Postmenopausal standard → AI 5 yr', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'post', isHighRisk: false }, 'ET1b');
    expect(r.result.therapy).toBe('aromatasehemmer');
  });

  it('ET2a — Pre <35 high risk → OFS + AI', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'pre', isHighRisk: true, age: 30 }, 'ET2a');
    expect(r.result.therapy).toBe('ai_ofs');
  });

  it('ET2b — Pre ≥35 high risk → OFS + AI', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'pre', isHighRisk: true, age: 40 }, 'ET2b');
    expect(r.result.therapy).toBe('ai_ofs');
  });

  it('ET3 — Pre low risk → tamoxifen', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'pre', isHighRisk: false }, 'ET3');
    expect(r.result.therapy).toBe('tamoxifen');
  });

  it('ET4 — Unknown menopausal → tamoxifen', () => {
    const r = expectRule(T, { hrPositive: true, menopausalStatus: 'unknown' }, 'ET4');
    expect(r.result.therapy).toBe('tamoxifen');
  });
});

// ============================================================
// 5. ZOMETA TABLE
// ============================================================

describe('Zometa Eligibility', () => {
  const T = ZOMETA_TABLE;

  it('Z0 — No systemic therapy → not eligible', () => {
    const r = expectRule(T, { hasSystemicTherapy: false }, 'Z0');
    expect(r.result.eligible).toBe(false);
  });

  it('Z1 — Postmenopausal + systemic → eligible', () => {
    const r = expectRule(T, { hasSystemicTherapy: true, menopausalStatus: 'post' }, 'Z1');
    expect(r.result.eligible).toBe(true);
  });

  it('Z2 — Pre + OFS + systemic → eligible', () => {
    const r = expectRule(T, { hasSystemicTherapy: true, menopausalStatus: 'pre', hasOFS: true }, 'Z2');
    expect(r.result.eligible).toBe(true);
  });

  it('Z3 — Age ≥55 + systemic → eligible', () => {
    const r = expectRule(T, { hasSystemicTherapy: true, menopausalStatus: 'pre', hasOFS: false, age: 60 }, 'Z3');
    expect(r.result.eligible).toBe(true);
  });

  it('Z4 — Pre <55 no OFS → not eligible', () => {
    const r = expectRule(T, { hasSystemicTherapy: true, menopausalStatus: 'pre', hasOFS: false, age: 40 }, 'Z4');
    expect(r.result.eligible).toBe(false);
  });
});

// ============================================================
// 6. RADIATION TABLE
// ============================================================

describe('Radiation Therapy', () => {
  const T = RADIATION_TABLE;

  it('RT1 — BCS + N1 → breast + regional', () => {
    const r = expectRule(T, { surgeryType: 'bcs', nStage: 'N1' }, 'RT1');
    expect(r.result.recommended).toBe(true);
    expect(r.result.type).toBe('bryst_og_regional');
  });

  it('RT2 — BCS + N0 → breast only', () => {
    const r = expectRule(T, { surgeryType: 'bcs', nStage: 'N0' }, 'RT2');
    expect(r.result.recommended).toBe(true);
    expect(r.result.type).toBe('bryst');
  });

  it('RT3 — Mastectomy + N2 → locoregional', () => {
    const r = expectRule(T, { surgeryType: 'mastectomy', nStage: 'N2' }, 'RT3');
    expect(r.result.recommended).toBe(true);
  });

  it('RT5 — Mastectomy + T3 → locoregional', () => {
    expectRule(T, { surgeryType: 'mastectomy', tSimple: 'T3', nStage: 'N0' }, 'RT5');
  });

  it('RT6 — Mastectomy + N0 + T1 → no radiation', () => {
    const r = expectRule(T, { surgeryType: 'mastectomy', nStage: 'N0', tSimple: 'T1' }, 'RT6');
    expect(r.result.recommended).toBe(false);
  });
});

// ============================================================
// 7. HR+HER2+ ADJUVANT
// ============================================================

describe('HR+HER2+ Adjuvant', () => {
  const T = HRPOS_HER2POS_TABLE;

  it('HH1 — T1 N0 → taxan/trastuzumab', () => {
    const r = expectRule(T, { bioGroup: 'HR+HER2+', nStage: 'N0', tStage: 'T1c' }, 'HH1');
    expect(r.result.regimen).toContain('Taxan/trastuzumab');
  });

  it('HH2 — T2 N0 → EC90+taxan/trastuzumab', () => {
    const r = expectRule(T, { bioGroup: 'HR+HER2+', nStage: 'N0', tStage: 'T2' }, 'HH2');
    expect(r.result.regimen).toContain('EC90');
  });

  it('HH3 — N1mi → taxan/trastuzumab', () => {
    expectRule(T, { bioGroup: 'HR+HER2+', nStage: 'N1mi' }, 'HH3');
  });

  it('HH4 — N1+ → full chemo + dual HER2', () => {
    const r = expectRule(T, { bioGroup: 'HR+HER2+', nStage: 'N1' }, 'HH4');
    expect(r.result.regimen).toContain('pertuzumab');
  });
});

// ============================================================
// 8. HR-HER2+ ADJUVANT
// ============================================================

describe('HR-HER2+ Adjuvant', () => {
  const T = HRNEG_HER2POS_TABLE;

  it('NH1 — T1 N0 → taxan/trastuzumab', () => {
    expectRule(T, { bioGroup: 'HR-HER2+', nStage: 'N0', tStage: 'T1b' }, 'NH1');
  });

  it('NH2 — T2 N0 → EC90+taxan/trastuzumab', () => {
    expectRule(T, { bioGroup: 'HR-HER2+', nStage: 'N0', tStage: 'T2' }, 'NH2');
  });

  it('NH3 — N1+ → full chemo + dual HER2', () => {
    const r = expectRule(T, { bioGroup: 'HR-HER2+', nStage: 'N1' }, 'NH3');
    expect(r.result.regimen).toContain('pertuzumab');
  });
});

// ============================================================
// 9. TRIPLE NEGATIVE ADJUVANT
// ============================================================

describe('TN Adjuvant', () => {
  const T = TN_TABLE;

  it('TN1a — T1a N0 → no general rec', () => {
    const r = expectRule(T, { bioGroup: 'TN', nStage: 'N0', tStage: 'T1a' }, 'TN1a');
    expect(r.result.regimen).toContain('Ingen generell');
  });

  it('TN1b — T1b N0 → EC90+taxan', () => {
    expectRule(T, { bioGroup: 'TN', nStage: 'N0', tStage: 'T1b' }, 'TN1b');
  });

  it('TN2 — T2 N0 → EC90+taxan', () => {
    expectRule(T, { bioGroup: 'TN', nStage: 'N0', tStage: 'T2' }, 'TN2');
  });

  it('TN3 — N1mi → EC90+taxan', () => {
    expectRule(T, { bioGroup: 'TN', nStage: 'N1mi' }, 'TN3');
  });

  it('TN4 — N1+ → taxan/carbo + EC90', () => {
    const r = expectRule(T, { bioGroup: 'TN', nStage: 'N1' }, 'TN4');
    expect(r.result.regimen).toContain('carboplatin');
  });
});

// ============================================================
// 10. NEOADJUVANT TABLE
// ============================================================

describe('Neoadjuvant Treatment', () => {
  const T = NEOADJUVANT_TABLE;

  it('NEO0 — Not neoadjuvant → skip', () => {
    expectRule(T, { isNeoadjuvant: false }, 'NEO0');
  });

  it('NEO1a — HR+HER2- Lum A → endocrine neoadjuvant', () => {
    const r = expectRule(T, { isNeoadjuvant: true, bioGroup: 'HR+HER2-', luminalSubtype: 'A-like' }, 'NEO1a');
    expect(r.result.regimen).toContain('endokrin');
  });

  it('NEO1b — HR+HER2- non-LumA → EC90+taxan', () => {
    const r = expectRule(T, { isNeoadjuvant: true, bioGroup: 'HR+HER2-', luminalSubtype: 'B-like' }, 'NEO1b');
    expect(r.result.regimen).toContain('EC90');
  });

  it('NEO2 — HR+HER2+ → EC90+taxan+HP', () => {
    const r = expectRule(T, { isNeoadjuvant: true, bioGroup: 'HR+HER2+' }, 'NEO2');
    expect(r.result.regimen).toContain('trastuzumab');
  });

  it('NEO3 — HR-HER2+ → EC90+taxan+HP', () => {
    expectRule(T, { isNeoadjuvant: true, bioGroup: 'HR-HER2+' }, 'NEO3');
  });

  it('NEO4 — TN → pembrolizumab+chemo (KEYNOTE-522)', () => {
    const r = expectRule(T, { isNeoadjuvant: true, bioGroup: 'TN' }, 'NEO4');
    expect(r.result.regimen).toContain('Pembrolizumab');
  });
});

// ============================================================
// 11. NEAR-CUTOFF WARNINGS (COLLECT policy)
// ============================================================

describe('Near-Cutoff Warnings', () => {
  const T = NEAR_CUTOFF_TABLE;

  it('NC1 — ROR 38 → near 40 warning', () => {
    const result = evaluateDecisionTable(T, { rorScore: 38 });
    expect(result.matched).toBe(true);
    const params = result.result.map(r => r.parameter);
    expect(params).toContain('ROR-score');
  });

  it('NC3 — RS 24 → near 25 warning', () => {
    const result = evaluateDecisionTable(T, { rsScore: 24 });
    expect(result.matched).toBe(true);
  });

  it('NC5 — ER 5% → low positive warning', () => {
    const result = evaluateDecisionTable(T, { erPercent: 5 });
    expect(result.matched).toBe(true);
    const params = result.result.map(r => r.parameter);
    expect(params).toContain('ER');
  });

  it('NC7 — Tumor 19mm → near T1c/T2 warning', () => {
    const result = evaluateDecisionTable(T, { tumorSizeMm: 19 });
    expect(result.matched).toBe(true);
  });

  it('NC9 — N1mi → micrometastasis warning', () => {
    const result = evaluateDecisionTable(T, { nStage: 'N1mi' });
    expect(result.matched).toBe(true);
  });

  it('Multiple warnings can fire simultaneously', () => {
    const result = evaluateDecisionTable(T, { rorScore: 38, erPercent: 5, nStage: 'N1mi' });
    expect(result.matched).toBe(true);
    expect(result.result.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================
// POST-NEOADJUVANT TABLE TESTS
// ============================================================

import { POST_NEOADJUVANT_TABLE } from '../src/dmn/decisionTables.js';

describe('Post-Neoadjuvant Table', () => {
  const T = POST_NEOADJUVANT_TABLE;

  it('PNA0 — not post-neoadjuvant returns no treatment', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: false });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toBe('-');
  });

  it('PNA1 — HER2+ non-pCR → T-DM1 (KATHERINE)', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: true, bioGroup: 'HR+HER2+', pcrStatus: 'non-pCR' });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toContain('T-DM1');
  });

  it('PNA2 — HER2+ pCR → continue trastuzumab', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: true, bioGroup: 'HR-HER2+', pcrStatus: 'pCR' });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toContain('rastuzumab');
  });

  it('PNA3 — TN non-pCR + BRCA → olaparib', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: true, bioGroup: 'TN', pcrStatus: 'non-pCR', brcaMutated: true });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toContain('Olaparib');
  });

  it('PNA4 — TN non-pCR without BRCA → capecitabin', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: true, bioGroup: 'TN', pcrStatus: 'non-pCR', brcaMutated: false });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toContain('Capecitabin');
  });

  it('PNA7 — TN pCR → adjuvant pembrolizumab', () => {
    const result = evaluateDecisionTable(T, { isPostNeoadjuvant: true, bioGroup: 'TN', pcrStatus: 'pCR' });
    expect(result.matched).toBe(true);
    expect(result.result.regimen).toContain('pembrolizumab');
  });
});

// ============================================================
// BRCA / OLAPARIB TABLE TESTS
// ============================================================

import { BRCA_OLAPARIB_TABLE } from '../src/dmn/decisionTables.js';

describe('BRCA / Olaparib Table', () => {
  const T = BRCA_OLAPARIB_TABLE;

  it('BRCA1 — BRCA-mutated + HER2-neg + high risk → olaparib', () => {
    const result = evaluateDecisionTable(T, { brcaMutated: true, her2Negative: true, isHighRisk: true });
    expect(result.matched).toBe(true);
    expect(result.result.recommendation).toContain('Olaparib');
  });

  it('BRCA3 — TN not tested <60 → recommend testing', () => {
    const result = evaluateDecisionTable(T, { brcaStatus: 'not_tested', bioGroup: 'TN', age: 45, her2Negative: true });
    expect(result.matched).toBe(true);
    expect(result.result.recommendation).toContain('testing anbefalt');
  });

  it('BRCA6 — negative → no BRCA treatment', () => {
    const result = evaluateDecisionTable(T, { brcaStatus: 'negative' });
    expect(result.matched).toBe(true);
    expect(result.result.recommendation).toContain('Ingen');
  });

  it('BRCA4 — HR+HER2- young high risk not tested → consider testing', () => {
    const result = evaluateDecisionTable(T, { brcaStatus: 'not_tested', bioGroup: 'HR+HER2-', isHighRisk: true, age: 42 });
    expect(result.matched).toBe(true);
    expect(result.result.recommendation).toContain('Vurder');
  });
});

// ============================================================
// META: Verify all tables have at least one test
// ============================================================

describe('Meta: All tables tested', () => {
  const testedTableIds = new Set([
    'her2-determination',
    'chemo-pathway-hrpos-her2neg',
    'cdk46-adjuvant-selection',
    'endocrine-therapy-selection',
    'zometa-eligibility',
    'radiation-therapy',
    'hrpos-her2pos-adjuvant',
    'hrneg-her2pos-adjuvant',
    'tn-adjuvant',
    'neoadjuvant-treatment',
    'post-neoadjuvant-treatment',
    'brca-olaparib-eligibility',
    'near-cutoff-warnings',
  ]);

  it('All 13 standard tables are covered', () => {
    const allIds = Object.keys(ALL_DECISION_TABLES);
    for (const id of allIds) {
      expect(testedTableIds.has(id), `Table ${id} is not tested`).toBe(true);
    }
  });
});
