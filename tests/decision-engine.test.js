import { describe, it, expect } from 'vitest';
import { evaluateDecisionTable, formatRecommendation, evaluateDecisionChain } from '../src/dmn/dmnEngine.js';
import { CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE } from '../src/dmn/decisionTables.js';
import {
  evaluateCQL, validateClinicalData,
  deriveHER2, deriveBioGroup, deriveTStage, deriveStadium, deriveGESRisk,
  deriveLuminalSubtype, deriveEndocrineTherapy, deriveZometaEligibility, deriveRadiation,
} from '../src/cql/cqlEngine.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';

// ============================================================
// CQL: HER2 Derivation
// ============================================================

describe('CQL: HER2 Derivation', () => {
  it('IHC 3+ → positive', () => {
    expect(deriveHER2('3+', null)).toBe('positive');
  });

  it('IHC 0 → negative', () => {
    expect(deriveHER2('0', null)).toBe('negative');
  });

  it('IHC 1+ → negative', () => {
    expect(deriveHER2('1+', null)).toBe('negative');
  });

  it('IHC 2+ with positive SISH → positive', () => {
    expect(deriveHER2('2+', 'positive')).toBe('positive');
  });

  it('IHC 2+ with negative SISH → negative', () => {
    expect(deriveHER2('2+', 'negative')).toBe('negative');
  });

  it('IHC 2+ without SISH → equivocal', () => {
    expect(deriveHER2('2+', null)).toBe('equivocal');
  });
});

// ============================================================
// CQL: Biogroup Derivation
// ============================================================

describe('CQL: Biogroup', () => {
  it('ER+ HER2- → HR+HER2-', () => {
    expect(deriveBioGroup(true, false, 'negative')).toBe('HR+HER2-');
  });

  it('ER+ HER2+ → HR+HER2+', () => {
    expect(deriveBioGroup(true, true, 'positive')).toBe('HR+HER2+');
  });

  it('ER- PR- HER2+ → HR-HER2+', () => {
    expect(deriveBioGroup(false, false, 'positive')).toBe('HR-HER2+');
  });

  it('ER- PR- HER2- → TN', () => {
    expect(deriveBioGroup(false, false, 'negative')).toBe('TN');
  });

  it('PR+ alone qualifies as HR+', () => {
    expect(deriveBioGroup(false, true, 'negative')).toBe('HR+HER2-');
  });
});

// ============================================================
// CQL: T-Stage and Stadium
// ============================================================

describe('CQL: Staging', () => {
  it('derives T-stage from tumor size', () => {
    expect(deriveTStage(5)).toBe('T1a');
    expect(deriveTStage(10)).toBe('T1b');
    expect(deriveTStage(15)).toBe('T1c');
    expect(deriveTStage(30)).toBe('T2');
    expect(deriveTStage(55)).toBe('T3');
  });

  it('T4 override', () => {
    expect(deriveTStage(20, 'T4')).toBe('T4');
  });

  it('derives stadium from T + N', () => {
    expect(deriveStadium('T1', 'N0')).toBe('I');
    expect(deriveStadium('T2', 'N0')).toBe('IIA');
    expect(deriveStadium('T1', 'N1')).toBe('IIA');
    expect(deriveStadium('T2', 'N1')).toBe('IIB');
    expect(deriveStadium('T3', 'N0')).toBe('IIB');
    expect(deriveStadium('T3', 'N1')).toBe('IIIA');
    expect(deriveStadium('T1', 'N3')).toBe('IIIC');
  });
});

// ============================================================
// CQL: Gene Expression
// ============================================================

describe('CQL: Gene Expression', () => {
  it('Prosigna high risk (ROR > 60)', () => {
    const r = deriveGESRisk('prosigna', 65, null, null, 'N0');
    expect(r.gesHighRisk).toBe(true);
    expect(r.geneTestDone).toBe(true);
  });

  it('Prosigna low risk (ROR ≤ 40)', () => {
    const r = deriveGESRisk('prosigna', 35, null, null, 'N0');
    expect(r.gesLowRisk).toBe(true);
  });

  it('OncotypeDX high risk (RS > 25)', () => {
    const r = deriveGESRisk('oncotypedx', null, 30, null, 'N0');
    expect(r.gesHighRisk).toBe(true);
  });

  it('OncotypeDX low risk (RS ≤ 25)', () => {
    const r = deriveGESRisk('oncotypedx', null, 20, null, 'N0');
    expect(r.gesLowRisk).toBe(true);
  });

  it('No gene test', () => {
    const r = deriveGESRisk('none', null, null, null, 'N0');
    expect(r.geneTestDone).toBe(false);
  });
});

// ============================================================
// CQL: Luminal Subtype
// ============================================================

describe('CQL: Luminal Subtype', () => {
  it('Grade 3 → B-like', () => {
    expect(deriveLuminalSubtype(3, 10, 50)).toBe('B-like');
  });

  it('Grade 1 low Ki67 → A-like', () => {
    expect(deriveLuminalSubtype(1, 10, 50)).toBe('A-like');
  });

  it('Grade 2 high Ki67 → B-like', () => {
    expect(deriveLuminalSubtype(2, 25, 50)).toBe('B-like');
  });

  it('Low PR → B-like', () => {
    expect(deriveLuminalSubtype(2, 10, 5)).toBe('B-like');
  });
});

// ============================================================
// CQL: Full evaluateCQL
// ============================================================

describe('CQL: Full Evaluation', () => {
  it('should derive biogroup and staging from IHC + size + N', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      prStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 25,
      nStage: 'N1',
      grade: 2,
      menopausalStatus: 'post',
    });

    expect(result.bioGroup).toBe('HR+HER2-');
    expect(result.tSimple).toBe('T2');
    expect(result.stadium).toBe('IIB');
    expect(result.cdk46eligible).toBe(true);
  });

  it('should derive HR+HER2+ from IHC 3+', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '3+',
      tumorSizeMm: 15,
      nStage: 'N0',
    });

    expect(result.bioGroup).toBe('HR+HER2+');
    expect(result.cdk46eligible).toBe(false); // only HR+HER2- eligible for CDK4/6
  });

  it('should derive TN from ER-/PR-/HER2-', () => {
    const result = evaluateCQL({
      erStatus: 'negative',
      prStatus: 'negative',
      her2ihc: '1+',
      tumorSizeMm: 30,
      nStage: 'N1',
    });

    expect(result.bioGroup).toBe('TN');
  });

  it('should derive chemo pathway for HR+HER2- N0 G3', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 18,
      nStage: 'N0',
      grade: 3,
    });

    expect(result.chemoPathway.pathway).toBe('EC');
  });

  it('should recommend gene test for N0 G2', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 18,
      nStage: 'N0',
      grade: 2,
    });

    expect(result.chemoPathway.pathway).toBe('gene_test_needed');
  });

  it('should give EC_taxan for N2', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '1+',
      tumorSizeMm: 25,
      nStage: 'N2',
      grade: 2,
    });

    expect(result.chemoPathway.pathway).toBe('EC_taxan');
  });

  it('should handle endocrine therapy for postmenopausal', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 25,
      nStage: 'N1',
      menopausalStatus: 'post',
      grade: 2,
    });

    expect(result.endocrineTherapy.therapy).toBe('aromatasehemmer');
  });

  it('should handle legacy metastatic eligibility', () => {
    const result = evaluateCQL({
      erStatus: 'positive',
      her2Status: 'negative',
      ecogScore: 1,
      metastatic: 'yes',
      nStage: 'N0',
    });

    expect(result.eligible).toBe(true); // legacy
    expect(result.isMetastatic).toBe(true);
  });
});

// ============================================================
// CQL: Validation
// ============================================================

describe('CQL: Validation', () => {
  it('should pass with ER + HER2 IHC + N-stage', () => {
    const r = validateClinicalData({ erStatus: 'positive', her2ihc: '0', nStage: 'N0' });
    expect(r.valid).toBe(true);
  });

  it('should fail with missing ER and HER2', () => {
    const r = validateClinicalData({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('should accept erPercent as alternative to erStatus', () => {
    const r = validateClinicalData({ erPercent: 90, her2ihc: '3+', nStage: 'N1' });
    expect(r.valid).toBe(true);
  });
});

// ============================================================
// CQL: Endocrine, Zometa, Radiation
// ============================================================

describe('CQL: Endocrine Therapy', () => {
  it('postmenopausal → AI', () => {
    const r = deriveEndocrineTherapy('post', false, false);
    expect(r.therapy).toBe('aromatasehemmer');
  });

  it('premenopausal high risk → tamoxifen + OFS', () => {
    const r = deriveEndocrineTherapy('pre', true, true);
    expect(r.therapy).toBe('tamoxifen_ofs');
  });

  it('premenopausal low risk → tamoxifen', () => {
    const r = deriveEndocrineTherapy('pre', false, false);
    expect(r.therapy).toBe('tamoxifen');
  });
});

describe('CQL: Zometa Eligibility', () => {
  it('postmenopausal with systemic → eligible', () => {
    const r = deriveZometaEligibility('post', 60, true, false);
    expect(r.eligible).toBe(true);
  });

  it('premenopausal with OFS → eligible', () => {
    const r = deriveZometaEligibility('pre', 40, true, true);
    expect(r.eligible).toBe(true);
  });

  it('premenopausal without OFS → not eligible', () => {
    const r = deriveZometaEligibility('pre', 40, true, false);
    expect(r.eligible).toBe(false);
  });
});

describe('CQL: Radiation', () => {
  it('BCS N0 → breast only', () => {
    const r = deriveRadiation('bcs', 'N0', 'T1');
    expect(r.recommended).toBe(true);
    expect(r.type).toBe('bryst');
  });

  it('BCS N1 → breast + regional', () => {
    const r = deriveRadiation('bcs', 'N1', 'T2');
    expect(r.type).toBe('bryst_og_regional');
  });

  it('mastectomy N0 → no radiation', () => {
    const r = deriveRadiation('mastectomy', 'N0', 'T1');
    expect(r.recommended).toBe(false);
  });

  it('mastectomy N2 → locoregional', () => {
    const r = deriveRadiation('mastectomy', 'N2', 'T2');
    expect(r.recommended).toBe(true);
    expect(r.type).toBe('lokoregional');
  });
});

// ============================================================
// DMN: CDK4/6 Adjuvant Table
// ============================================================

describe('DMN: CDK4/6 Adjuvant Table', () => {
  it('R0: ineligible → no CDK4/6', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: false });
    expect(r.matched).toBe(true);
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });

  it('R1: T1 N0 → no CDK4/6', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T1', nStage: 'N0',
    });
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });

  it('R2: T2 N0 → ribo if G3/GES high only', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T2', nStage: 'N0',
    });
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('if_G3_or_gesHigh');
  });

  it('R3: T1 N1 → abema if G3, ribo if G3/GES high', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T1', nStage: 'N1',
    });
    expect(r.result.abemaciclib).toBe('if_G3');
    expect(r.result.ribociclib).toBe('if_G3_or_gesHigh');
  });

  it('R4: T2 N1 → abema if G3, ribo yes', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T2', nStage: 'N1',
    });
    expect(r.result.abemaciclib).toBe('if_G3');
    expect(r.result.ribociclib).toBe('yes');
  });

  it('R6: N2 → abema first choice, ribo yes', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T2', nStage: 'N2',
    });
    expect(r.result.abemaciclib).toBe('first_choice');
    expect(r.result.ribociclib).toBe('yes');
  });

  it('R8: N3 → abema first choice (highest priority)', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T1', nStage: 'N3',
    });
    expect(r.result.abemaciclib).toBe('first_choice');
    expect(r.result.ribociclib).toBe('yes');
  });

  it('R5: T3 N0 → abema if G3, ribo yes', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, {
      cdk46eligible: true, tSimple: 'T3', nStage: 'N0',
    });
    expect(r.result.abemaciclib).toBe('if_G3');
    expect(r.result.ribociclib).toBe('yes');
  });
});

// ============================================================
// DMN: Endocrine Partner Table
// ============================================================

describe('DMN: Endocrine Partner Table', () => {
  it('postmenopausal → AI', () => {
    const r = evaluateDecisionTable(ENDOCRINE_PARTNER_TABLE, { menopausalStatus: 'post' });
    expect(r.result.partner).toContain('Aromatasehemmer');
  });

  it('premenopausal high risk → Tamoxifen + OFS', () => {
    const r = evaluateDecisionTable(ENDOCRINE_PARTNER_TABLE, { menopausalStatus: 'pre', isHighRisk: true });
    expect(r.result.partner).toContain('OFS');
  });

  it('premenopausal standard → Tamoxifen', () => {
    const r = evaluateDecisionTable(ENDOCRINE_PARTNER_TABLE, { menopausalStatus: 'pre', isHighRisk: false });
    expect(r.result.partner).toContain('Tamoxifen');
  });
});

// ============================================================
// DMN Engine: Range comparisons (preserved)
// ============================================================

describe('DMN Range Comparisons', () => {
  it('should match gte condition', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { gte: 30 } }, outputs: { result: 'high' } }],
    };
    expect(evaluateDecisionTable(table, { value: 30 }).result.result).toBe('high');
    expect(evaluateDecisionTable(table, { value: 29 }).matched).toBe(false);
  });

  it('should match lt condition', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { lt: 20 } }, outputs: { result: 'low' } }],
    };
    expect(evaluateDecisionTable(table, { value: 19 }).result.result).toBe('low');
    expect(evaluateDecisionTable(table, { value: 20 }).matched).toBe(false);
  });

  it('should match combined gte + lt range', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { gte: 10, lt: 30 } }, outputs: { result: 'mid' } }],
    };
    expect(evaluateDecisionTable(table, { value: 15 }).result.result).toBe('mid');
    expect(evaluateDecisionTable(table, { value: 9 }).matched).toBe(false);
  });

  it('should return false for range comparison with null', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { gte: 10 } }, outputs: { result: 'ok' } }],
    };
    expect(evaluateDecisionTable(table, { value: null }).matched).toBe(false);
  });
});

// ============================================================
// Treatment Builder
// ============================================================

describe('Treatment Builder', () => {
  function makeCQL(overrides) {
    return evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 25,
      nStage: 'N1',
      grade: 3,
      menopausalStatus: 'post',
      surgeryType: 'bcs',
      ...overrides,
    });
  }

  it('HR+HER2- adjuvant: should include chemo + endocrine + CDK4/6 + radiation', () => {
    const cql = makeCQL({});
    const cdk46 = evaluateDecisionTable(CDK46_DECISION_TABLE, cql);
    const plan = buildTreatmentPlan(cql, cdk46);

    expect(plan.bioGroup).toBe('HR+HER2-');
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
  });

  it('HR+HER2- T1 N0 G1: minimal treatment', () => {
    const cql = makeCQL({ tumorSizeMm: 8, nStage: 'N0', grade: 1, surgeryType: 'bcs' });
    const cdk46 = evaluateDecisionTable(CDK46_DECISION_TABLE, cql);
    const plan = buildTreatmentPlan(cql, cdk46);

    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(false);
    // CDK4/6 should be absent (T1 N0)
    expect(plan.steps.some((s) => s.type === 'cdk46')).toBe(false);
    // Should still have endocrine + radiation for BCS
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
  });

  it('HR+HER2+ adjuvant: should include chemo + anti-HER2', () => {
    const cql = makeCQL({ her2ihc: '3+', nStage: 'N1' });
    const plan = buildTreatmentPlan(cql, null);

    expect(plan.bioGroup).toBe('HR+HER2+');
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps[0].name).toContain('HP');
  });

  it('TN adjuvant: should include chemo', () => {
    const cql = makeCQL({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', nStage: 'N1' });
    const plan = buildTreatmentPlan(cql, null);

    expect(plan.bioGroup).toBe('TN');
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
  });

  it('Neoadjuvant mode should generate referral-ready plan', () => {
    const cql = makeCQL({ treatmentMode: 'neoadjuvant' });
    const plan = buildTreatmentPlan(cql, null);

    expect(plan.isNeoadjuvant).toBe(true);
    expect(plan.warnings.some((w) => w.includes('Neoadjuvant'))).toBe(true);
  });
});

// ============================================================
// Journal Text
// ============================================================

describe('Journal Text Generation', () => {
  it('should generate formatted journal text', () => {
    const cql = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 25,
      nStage: 'N1',
      grade: 3,
      menopausalStatus: 'post',
      surgeryType: 'bcs',
    });
    const cdk46 = evaluateDecisionTable(CDK46_DECISION_TABLE, cql);
    const plan = buildTreatmentPlan(cql, cdk46);
    const text = buildJournalText(cql, plan);

    expect(text).toContain('ADJUVANT BEHANDLINGSPLAN');
    expect(text).toContain('HR+HER2-');
    expect(text).toContain('BEHANDLINGSTRINN');
  });

  it('should generate referral text for neoadjuvant', () => {
    const cql = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 50,
      nStage: 'N2',
      treatmentMode: 'neoadjuvant',
    });
    const text = buildReferralText(cql);

    expect(text).toContain('HENVISNING');
    expect(text).toContain('neoadjuvant');
  });
});

// ============================================================
// Full Pipeline Integration
// ============================================================

describe('Full Pipeline: CQL → DMN → Treatment Builder', () => {
  it('HR+HER2- N2 G3 postmenopausal: high risk complete plan', () => {
    const clinicalData = {
      erStatus: 'positive',
      prStatus: 'positive',
      her2ihc: '1+',
      tumorSizeMm: 35,
      nStage: 'N2',
      grade: 3,
      ki67: 40,
      menopausalStatus: 'post',
      surgeryType: 'mastectomy',
      age: 62,
    };

    const cql = evaluateCQL(clinicalData);
    expect(cql.bioGroup).toBe('HR+HER2-');
    expect(cql.stadium).toBe('IIIA');
    expect(cql.chemoPathway.pathway).toBe('EC_taxan');

    const cdk46 = evaluateDecisionTable(CDK46_DECISION_TABLE, cql);
    expect(cdk46.result.abemaciclib).toBe('first_choice');

    const plan = buildTreatmentPlan(cql, cdk46);
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'cdk46')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'bisphosphonate')).toBe(true);
  });

  it('HR+HER2- T1 N0 low risk: endocrine only + radiation (BCS)', () => {
    const cql = evaluateCQL({
      erStatus: 'positive',
      her2ihc: '0',
      tumorSizeMm: 12,
      nStage: 'N0',
      grade: 1,
      menopausalStatus: 'post',
      surgeryType: 'bcs',
    });

    expect(cql.chemoPathway.pathway).toBe('none');

    const cdk46 = evaluateDecisionTable(CDK46_DECISION_TABLE, cql);
    expect(cdk46.result.ribociclib).toBe('no');

    const plan = buildTreatmentPlan(cql, cdk46);
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(false);
    expect(plan.steps.some((s) => s.type === 'cdk46')).toBe(false);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
  });

  it('TN N1: chemo + radiation, no endocrine', () => {
    const cql = evaluateCQL({
      erStatus: 'negative',
      prStatus: 'negative',
      her2ihc: '0',
      tumorSizeMm: 30,
      nStage: 'N1',
      surgeryType: 'bcs',
    });

    expect(cql.bioGroup).toBe('TN');
    expect(cql.endocrineTherapy).toBeNull();

    const plan = buildTreatmentPlan(cql, null);
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(false);
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge Cases', () => {
  it('should handle empty decision table', () => {
    const emptyTable = { id: 'empty', name: 'Empty', hitPolicy: 'FIRST', rules: [] };
    const result = evaluateDecisionTable(emptyTable, { cdk46eligible: true });
    expect(result.matched).toBe(false);
  });

  it('should handle missing optional fields gracefully', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N0' });
    expect(cql.bioGroup).toBe('HR+HER2-');
    expect(cql.grade).toBeNull();
    expect(cql.ki67Value).toBeNull();
  });

  it('should handle ER from percent', () => {
    const cql = evaluateCQL({ erPercent: 90, her2ihc: '1+', nStage: 'N0' });
    expect(cql.erPositive).toBe(true);
    expect(cql.hrPositive).toBe(true);
  });
});
