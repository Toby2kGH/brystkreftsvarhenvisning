import { describe, it, expect } from 'vitest';
import { evaluateDecisionTable, evaluateDecisionChain } from '../src/dmn/dmnEngine.js';
import {
  HER2_DETERMINATION_TABLE, CHEMO_PATHWAY_TABLE, CDK46_DECISION_TABLE,
  ENDOCRINE_THERAPY_TABLE, ZOMETA_TABLE, RADIATION_TABLE,
  HRPOS_HER2POS_TABLE, HRNEG_HER2POS_TABLE, TN_TABLE,
  NEOADJUVANT_TABLE, NEAR_CUTOFF_TABLE,
} from '../src/dmn/decisionTables.js';
import { evaluateCQL, validateClinicalData, deriveBioGroup, deriveTStage, deriveStadium, deriveLuminalSubtype } from '../src/cql/cqlEngine.js';
import { buildTreatmentPlan, buildJournalText, buildReferralText } from '../src/dmn/treatmentBuilder.js';

// ============================================================
// CQL: Fact Derivation
// ============================================================

describe('CQL: Biogroup', () => {
  it('ER+ HER2- → HR+HER2-', () => expect(deriveBioGroup(true, false, 'negative')).toBe('HR+HER2-'));
  it('ER+ HER2+ → HR+HER2+', () => expect(deriveBioGroup(true, true, 'positive')).toBe('HR+HER2+'));
  it('ER- HER2+ → HR-HER2+', () => expect(deriveBioGroup(false, false, 'positive')).toBe('HR-HER2+'));
  it('ER- HER2- → TN', () => expect(deriveBioGroup(false, false, 'negative')).toBe('TN'));
  it('PR+ alone = HR+', () => expect(deriveBioGroup(false, true, 'negative')).toBe('HR+HER2-'));
});

describe('CQL: Staging', () => {
  it('derives T-stage', () => {
    expect(deriveTStage(5)).toBe('T1a');
    expect(deriveTStage(10)).toBe('T1b');
    expect(deriveTStage(15)).toBe('T1c');
    expect(deriveTStage(30)).toBe('T2');
    expect(deriveTStage(55)).toBe('T3');
    expect(deriveTStage(20, 'T4')).toBe('T4');
  });
  it('derives stadium', () => {
    expect(deriveStadium('T1', 'N0')).toBe('I');
    expect(deriveStadium('T2', 'N0')).toBe('IIA');
    expect(deriveStadium('T2', 'N1')).toBe('IIB');
    expect(deriveStadium('T3', 'N1')).toBe('IIIA');
    expect(deriveStadium('T1', 'N3')).toBe('IIIC');
  });
});

describe('CQL: Luminal Subtype', () => {
  it('Grade 3 → B-like', () => expect(deriveLuminalSubtype(3, 10, 50)).toBe('B-like'));
  it('Grade 1 low Ki67 → A-like', () => expect(deriveLuminalSubtype(1, 10, 50)).toBe('A-like'));
  it('High Ki67 → B-like', () => expect(deriveLuminalSubtype(2, 25, 50)).toBe('B-like'));
  it('Low PR → B-like', () => expect(deriveLuminalSubtype(2, 10, 5)).toBe('B-like'));
});

describe('CQL: Full evaluateCQL', () => {
  it('derives biogroup + staging', () => {
    const r = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N1', grade: 2, menopausalStatus: 'post' });
    expect(r.bioGroup).toBe('HR+HER2-');
    expect(r.tSimple).toBe('T2');
    expect(r.stadium).toBe('IIB');
    expect(r.cdk46eligible).toBe(true);
  });
  it('derives HER2 from IHC 3+', () => {
    const r = evaluateCQL({ erStatus: 'positive', her2ihc: '3+', tumorSizeMm: 15, nStage: 'N0' });
    expect(r.bioGroup).toBe('HR+HER2+');
    expect(r.cdk46eligible).toBe(false);
  });
  it('derives TN', () => {
    const r = evaluateCQL({ erStatus: 'negative', prStatus: 'negative', her2ihc: '1+', tumorSizeMm: 30, nStage: 'N1' });
    expect(r.bioGroup).toBe('TN');
  });
  it('handles ER from percent', () => {
    const r = evaluateCQL({ erPercent: 90, her2ihc: '1+', nStage: 'N0' });
    expect(r.erPositive).toBe(true);
  });
  it('derives gene expression facts', () => {
    const r = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N0', geneTest: 'prosigna', rorScore: 65, tumorSizeMm: 20 });
    expect(r.gesHighRisk).toBe(true);
    expect(r.geneTestDone).toBe(true);
  });
});

describe('CQL: Validation', () => {
  it('passes with ER + HER2 + N-stage', () => {
    expect(validateClinicalData({ erStatus: 'positive', her2ihc: '0', nStage: 'N0' }).valid).toBe(true);
  });
  it('fails with missing fields', () => {
    expect(validateClinicalData({}).valid).toBe(false);
  });
});

// ============================================================
// DMN: HER2 Determination Table
// ============================================================

describe('DMN: HER2 Determination', () => {
  it('IHC 3+ → positive', () => {
    const r = evaluateDecisionTable(HER2_DETERMINATION_TABLE, { her2ihc: '3+' });
    expect(r.result.her2Result).toBe('positive');
  });
  it('IHC 0 → negative', () => {
    const r = evaluateDecisionTable(HER2_DETERMINATION_TABLE, { her2ihc: '0' });
    expect(r.result.her2Result).toBe('negative');
  });
  it('IHC 2+ SISH positive → positive', () => {
    const r = evaluateDecisionTable(HER2_DETERMINATION_TABLE, { her2ihc: '2+', her2sish: 'positive' });
    expect(r.result.her2Result).toBe('positive');
  });
  it('IHC 2+ SISH negative → negative', () => {
    const r = evaluateDecisionTable(HER2_DETERMINATION_TABLE, { her2ihc: '2+', her2sish: 'negative' });
    expect(r.result.her2Result).toBe('negative');
  });
  it('IHC 2+ no SISH → equivocal', () => {
    const r = evaluateDecisionTable(HER2_DETERMINATION_TABLE, { her2ihc: '2+' });
    expect(r.result.her2Result).toBe('equivocal');
  });
});

// ============================================================
// DMN: Chemo Pathway Table (Prosigna/OncotypeDX/Grade)
// ============================================================

describe('DMN: Chemo Pathway HR+HER2-', () => {
  it('N2 → always EC', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N2' });
    expect(r.result.pathway).toBe('EC');
  });
  it('N1 Prosigna ROR ≤40 → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', geneTest: 'prosigna', rorScore: 35 });
    expect(r.result.pathway).toBe('none');
  });
  it('N1 Prosigna ROR >60 → EC+taxan', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', geneTest: 'prosigna', rorScore: 65 });
    expect(r.result.pathway).toBe('EC_taxan');
  });
  it('N1 Prosigna ROR 45 → consider chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', geneTest: 'prosigna', rorScore: 45 });
    expect(r.result.pathway).toBe('consider_chemo');
  });
  it('N1 OncotypeDX RS ≤25 → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', geneTest: 'oncotypedx', rsScore: 20 });
    expect(r.result.pathway).toBe('none');
  });
  it('N1 OncotypeDX RS >25 → EC+taxan', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', geneTest: 'oncotypedx', rsScore: 30 });
    expect(r.result.pathway).toBe('EC_taxan');
  });
  it('N1 G3 no gene test → EC+taxan', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', grade: 3 });
    expect(r.result.pathway).toBe('EC_taxan');
  });
  it('N1 G2 no gene test → EC', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1', grade: 2 });
    expect(r.result.pathway).toBe('EC');
  });
  it('N0 ≤10mm → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', tumorSizeMm: 8 });
    expect(r.result.pathway).toBe('none');
  });
  it('N0 Prosigna ROR ≤40 → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', geneTest: 'prosigna', rorScore: 30, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('none');
  });
  it('N0 Prosigna ROR >60 → EC_taxan', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', geneTest: 'prosigna', rorScore: 65, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('EC_taxan');
  });
  it('N0 OncotypeDX RS ≤25 → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', geneTest: 'oncotypedx', rsScore: 15, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('none');
  });
  it('N0 G1 no gene test → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', grade: 1, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('none');
  });
  it('N0 G3 → gene_test_needed', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', grade: 3, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('gene_test_needed');
  });
  it('N0 G2 Ki67 ≥30 → gene_test_needed', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N0', grade: 2, ki67Value: 35, tumorSizeMm: 18 });
    expect(r.result.pathway).toBe('gene_test_needed');
  });
  it('N1mi Prosigna ROR ≤40 → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1mi', geneTest: 'prosigna', rorScore: 30 });
    expect(r.result.pathway).toBe('none');
  });
  it('N1mi OncotypeDX RS >25 → EC', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: 30 });
    expect(r.result.pathway).toBe('EC');
  });
  it('N1mi ≤10mm → no chemo', () => {
    const r = evaluateDecisionTable(CHEMO_PATHWAY_TABLE, { nStage: 'N1mi', tumorSizeMm: 8 });
    expect(r.result.pathway).toBe('none');
  });
});

// ============================================================
// DMN: CDK4/6 Adjuvant Table
// ============================================================

describe('DMN: CDK4/6 Adjuvant', () => {
  it('ineligible → no', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: false });
    expect(r.result.abemaciclib).toBe('no');
  });
  it('T1 N0 → no CDK4/6', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: true, tSimple: 'T1', nStage: 'N0' });
    expect(r.result.abemaciclib).toBe('no');
    expect(r.result.ribociclib).toBe('no');
  });
  it('T2 N0 → ribo conditional', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: true, tSimple: 'T2', nStage: 'N0' });
    expect(r.result.ribociclib).toBe('if_G3_or_gesHigh');
  });
  it('N2 → abema first choice', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: true, tSimple: 'T2', nStage: 'N2' });
    expect(r.result.abemaciclib).toBe('first_choice');
  });
  it('N3 → abema first choice (highest priority)', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: true, tSimple: 'T1', nStage: 'N3' });
    expect(r.result.abemaciclib).toBe('first_choice');
  });
  it('T2 N1 → abema if G3, ribo yes', () => {
    const r = evaluateDecisionTable(CDK46_DECISION_TABLE, { cdk46eligible: true, tSimple: 'T2', nStage: 'N1' });
    expect(r.result.abemaciclib).toBe('if_G3');
    expect(r.result.ribociclib).toBe('yes_unless_low');
  });
});

// ============================================================
// DMN: Endocrine Therapy Table
// ============================================================

describe('DMN: Endocrine Therapy', () => {
  it('HR- → ingen', () => {
    const r = evaluateDecisionTable(ENDOCRINE_THERAPY_TABLE, { hrPositive: false });
    expect(r.result.therapy).toBe('ingen');
  });
  it('HR+ post → AI', () => {
    const r = evaluateDecisionTable(ENDOCRINE_THERAPY_TABLE, { hrPositive: true, menopausalStatus: 'post' });
    expect(r.result.therapy).toBe('aromatasehemmer');
  });
  it('HR+ pre high risk → AI+OFS', () => {
    const r = evaluateDecisionTable(ENDOCRINE_THERAPY_TABLE, { hrPositive: true, menopausalStatus: 'pre', isHighRisk: true });
    expect(r.result.therapy).toBe('ai_ofs');
  });
  it('HR+ pre standard → tamoxifen', () => {
    const r = evaluateDecisionTable(ENDOCRINE_THERAPY_TABLE, { hrPositive: true, menopausalStatus: 'pre', isHighRisk: false });
    expect(r.result.therapy).toBe('tamoxifen');
  });
});

// ============================================================
// DMN: Zometa Table
// ============================================================

describe('DMN: Zometa', () => {
  it('no systemic → not eligible', () => {
    const r = evaluateDecisionTable(ZOMETA_TABLE, { hasSystemicTherapy: false });
    expect(r.result.eligible).toBe(false);
  });
  it('post + systemic → eligible', () => {
    const r = evaluateDecisionTable(ZOMETA_TABLE, { hasSystemicTherapy: true, menopausalStatus: 'post' });
    expect(r.result.eligible).toBe(true);
  });
  it('pre + OFS → eligible', () => {
    const r = evaluateDecisionTable(ZOMETA_TABLE, { hasSystemicTherapy: true, menopausalStatus: 'pre', hasOFS: true });
    expect(r.result.eligible).toBe(true);
  });
  it('pre no OFS → not eligible', () => {
    const r = evaluateDecisionTable(ZOMETA_TABLE, { hasSystemicTherapy: true, menopausalStatus: 'pre', hasOFS: false, age: 40 });
    expect(r.result.eligible).toBe(false);
  });
});

// ============================================================
// DMN: Radiation Table
// ============================================================

describe('DMN: Radiation', () => {
  it('BCS N0 → breast', () => {
    const r = evaluateDecisionTable(RADIATION_TABLE, { surgeryType: 'bcs', nStage: 'N0' });
    expect(r.result.recommended).toBe(true);
    expect(r.result.type).toBe('bryst');
  });
  it('BCS N1 → breast+regional', () => {
    const r = evaluateDecisionTable(RADIATION_TABLE, { surgeryType: 'bcs', nStage: 'N1' });
    expect(r.result.type).toBe('bryst_og_regional');
  });
  it('mastectomy N0 T1 → no radiation', () => {
    const r = evaluateDecisionTable(RADIATION_TABLE, { surgeryType: 'mastectomy', nStage: 'N0', tSimple: 'T1' });
    expect(r.result.recommended).toBe(false);
  });
  it('mastectomy N2 → locoregional', () => {
    const r = evaluateDecisionTable(RADIATION_TABLE, { surgeryType: 'mastectomy', nStage: 'N2' });
    expect(r.result.type).toBe('lokoregional');
  });
});

// ============================================================
// DMN: Subgroup Treatment Tables
// ============================================================

describe('DMN: HR+HER2+ Adjuvant', () => {
  it('small N0 → EC90 + taxan/trastuzumab', () => {
    const r = evaluateDecisionTable(HRPOS_HER2POS_TABLE, { bioGroup: 'HR+HER2+', nStage: 'N0', tumorSizeMm: 12 });
    expect(r.result.regimen).toContain('EC90');
  });
  it('N1 → EC+taxan+HP', () => {
    const r = evaluateDecisionTable(HRPOS_HER2POS_TABLE, { bioGroup: 'HR+HER2+', nStage: 'N1', tumorSizeMm: 30 });
    expect(r.result.regimen).toContain('EC');
  });
});

describe('DMN: TN Adjuvant', () => {
  it('small N0 → EC90 + taxan', () => {
    const r = evaluateDecisionTable(TN_TABLE, { bioGroup: 'TN', nStage: 'N0', tumorSizeMm: 8 });
    expect(r.result.regimen).toContain('EC90');
  });
  it('N1 → taxan/carboplatin → EC90', () => {
    const r = evaluateDecisionTable(TN_TABLE, { bioGroup: 'TN', nStage: 'N1', tumorSizeMm: 30 });
    expect(r.result.regimen).toContain('Taxan/carboplatin');
  });
});

describe('DMN: Neoadjuvant', () => {
  it('not neoadjuvant → skip', () => {
    const r = evaluateDecisionTable(NEOADJUVANT_TABLE, { isNeoadjuvant: false });
    expect(r.result.regimen).toBe('-');
  });
  it('TN neoadjuvant → KEYNOTE-522', () => {
    const r = evaluateDecisionTable(NEOADJUVANT_TABLE, { isNeoadjuvant: true, bioGroup: 'TN' });
    expect(r.result.regimen).toContain('Pembrolizumab');
  });
});

// ============================================================
// DMN: Near-Cutoff Warnings
// ============================================================

describe('DMN: Near-Cutoff Warnings', () => {
  it('ROR near 40 → warning', () => {
    const r = evaluateDecisionTable(NEAR_CUTOFF_TABLE, { rorScore: 39 });
    expect(r.matched).toBe(true);
    const results = Array.isArray(r.result) ? r.result : [r.result];
    expect(results.some((w) => w.parameter === 'ROR-score')).toBe(true);
  });
  it('RS near 25 → warning', () => {
    const r = evaluateDecisionTable(NEAR_CUTOFF_TABLE, { rsScore: 24 });
    expect(r.matched).toBe(true);
  });
  it('low ER (5%) → warning', () => {
    const r = evaluateDecisionTable(NEAR_CUTOFF_TABLE, { erPercent: 5 });
    expect(r.matched).toBe(true);
  });
  it('Ki-67 near 20% → warning', () => {
    const r = evaluateDecisionTable(NEAR_CUTOFF_TABLE, { ki67Value: 18 });
    expect(r.matched).toBe(true);
  });
  it('tumor near 20mm → warning', () => {
    const r = evaluateDecisionTable(NEAR_CUTOFF_TABLE, { tumorSizeMm: 19 });
    expect(r.matched).toBe(true);
  });
});

// ============================================================
// DMN Engine: Range comparisons
// ============================================================

describe('DMN: Range Comparisons', () => {
  it('gte', () => {
    const t = { id: 't', name: 't', hitPolicy: 'FIRST', rules: [{ id: 'T1', conditions: { v: { gte: 30 } }, outputs: { r: 'h' } }] };
    expect(evaluateDecisionTable(t, { v: 30 }).result.r).toBe('h');
    expect(evaluateDecisionTable(t, { v: 29 }).matched).toBe(false);
  });
  it('combined range', () => {
    const t = { id: 't', name: 't', hitPolicy: 'FIRST', rules: [{ id: 'T1', conditions: { v: { gte: 10, lt: 30 } }, outputs: { r: 'm' } }] };
    expect(evaluateDecisionTable(t, { v: 15 }).result.r).toBe('m');
    expect(evaluateDecisionTable(t, { v: 30 }).matched).toBe(false);
  });
});

// ============================================================
// Treatment Builder Integration
// ============================================================

describe('Treatment Builder', () => {
  it('HR+HER2- N2 G3: complete plan', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '1+', tumorSizeMm: 35, nStage: 'N2', grade: 3, ki67: 40, menopausalStatus: 'post', surgeryType: 'mastectomy', age: 62 });
    const plan = buildTreatmentPlan(cql);
    expect(plan.bioGroup).toBe('HR+HER2-');
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'cdk46')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'bisphosphonate')).toBe(true);
  });

  it('HR+HER2- T1 N0 G1: minimal', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 8, nStage: 'N0', grade: 1, surgeryType: 'bcs', menopausalStatus: 'post' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(false);
    expect(plan.steps.some((s) => s.type === 'cdk46')).toBe(false);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'radiation')).toBe(true);
  });

  it('TN N1: chemo + radiation, no endocrine', () => {
    const cql = evaluateCQL({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', surgeryType: 'bcs' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.bioGroup).toBe('TN');
    expect(plan.steps.some((s) => s.type === 'chemo')).toBe(true);
    expect(plan.steps.some((s) => s.type === 'endocrine')).toBe(false);
  });

  it('neoadjuvant generates plan', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 50, nStage: 'N2', treatmentMode: 'neoadjuvant' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.isNeoadjuvant).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('near-cutoff warnings fire for borderline values', () => {
    const cql = evaluateCQL({ erStatus: 'positive', erPercent: 5, her2ihc: '0', tumorSizeMm: 19, nStage: 'N0', ki67: 18 });
    const plan = buildTreatmentPlan(cql);
    expect(plan.warnings.some((w) => w.includes('ER'))).toBe(true);
    expect(plan.warnings.some((w) => w.includes('Tumorstørrelse'))).toBe(true);
    expect(plan.warnings.some((w) => w.includes('Ki-67'))).toBe(true);
  });

  it('includes dmnResults for transparency', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N1', grade: 3, menopausalStatus: 'post', surgeryType: 'bcs' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.dmnResults).toBeDefined();
    expect(plan.dmnResults.her2).toBeDefined();
    expect(plan.dmnResults.chemo).toBeDefined();
    expect(plan.dmnResults.cdk46).toBeDefined();
    expect(plan.dmnResults.endocrine).toBeDefined();
    expect(plan.dmnResults.radiation).toBeDefined();
    expect(plan.dmnResults.zometa).toBeDefined();
    expect(plan.dmnResults.nearCutoff).toBeDefined();
  });
});

// ============================================================
// Journal/Referral Text
// ============================================================

describe('Text Generation', () => {
  it('generates journal text', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N1', grade: 3, menopausalStatus: 'post', surgeryType: 'bcs' });
    const plan = buildTreatmentPlan(cql);
    const text = buildJournalText(cql, plan);
    expect(text).toContain('ADJUVANT BEHANDLINGSPLAN');
    expect(text).toContain('HR+HER2-');
    expect(text).toContain('BEHANDLINGSTRINN');
  });

  it('generates referral text', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 50, nStage: 'N2', treatmentMode: 'neoadjuvant' });
    const text = buildReferralText(cql);
    expect(text).toContain('HENVISNING');
    expect(text).toContain('neoadjuvant');
  });
});

// ============================================================
// ER lav-positiv logikk (NBCG/St. Gallen: ER 1-10% = ER-negativ)
// ============================================================
describe('ER low-positive logic', () => {
  it('ER 5% → erPositive = false, erLowPositive = true', () => {
    const r = evaluateCQL({ erPercent: 5, her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(false);
    expect(r.erLowPositive).toBe(true);
  });

  it('ER 10% → erPositive = false, erLowPositive = true (grense)', () => {
    const r = evaluateCQL({ erPercent: 10, her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(false);
    expect(r.erLowPositive).toBe(true);
  });

  it('ER 11% → erPositive = true, erLowPositive = false', () => {
    const r = evaluateCQL({ erPercent: 11, her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(true);
    expect(r.erLowPositive).toBe(false);
  });

  it('ER 0% → erPositive = false, erLowPositive = false', () => {
    const r = evaluateCQL({ erPercent: 0, her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(false);
    expect(r.erLowPositive).toBe(false);
  });

  it('ER prosent overstyrer erStatus dropdown', () => {
    // Bruker setter positiv i dropdown, men prosent er 5% → skal bli negativ
    const r = evaluateCQL({ erStatus: 'positive', erPercent: 5, her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(false);
    expect(r.erLowPositive).toBe(true);
  });

  it('Uten erPercent brukes erStatus direkte', () => {
    const r = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N0' });
    expect(r.erPositive).toBe(true);
    expect(r.erLowPositive).toBe(false);
  });

  it('ER lav-positiv gir biogruppe TN (ikke HR+) med HER2-negativ', () => {
    const r = evaluateCQL({ erPercent: 5, prStatus: 'negative', her2ihc: '0', nStage: 'N0' });
    expect(r.bioGroup).toBe('TN');
  });

  it('ER lav-positiv gir varsel i behandlingsplan', () => {
    const cql = evaluateCQL({ erPercent: 5, prStatus: 'negative', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.warnings.some((w) => w.includes('lav-positiv'))).toBe(true);
  });
});

// ============================================================
// Neoadjuvant + BCS markørvarsel
// ============================================================
describe('Neoadjuvant BCS marker warning', () => {
  it('neoadjuvant + BCS → markør-varsel', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'neoadjuvant', surgeryType: 'bcs' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.warnings.some((w) => w.includes('markør') || w.includes('klips'))).toBe(true);
  });

  it('neoadjuvant + mastektomi → ingen markør-varsel', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'neoadjuvant', surgeryType: 'mastectomy' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.warnings.some((w) => w.includes('markør') || w.includes('klips'))).toBe(false);
  });

  it('adjuvant + BCS → ingen markør-varsel', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0', surgeryType: 'bcs' });
    const plan = buildTreatmentPlan(cql);
    expect(plan.warnings.some((w) => w.includes('markør') || w.includes('klips'))).toBe(false);
  });
});
