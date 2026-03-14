/**
 * Guideline Compliance Tests
 *
 * Verifies that decision logic matches NBCG Handlingsprogram (Mars 2025)
 * and CDK4/6 supplement (NBCG 04.09.25).
 *
 * Each test references a specific guideline chapter/section.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCQL } from '../src/cql/cqlEngine.js';
import { buildTreatmentPlan } from '../src/dmn/treatmentBuilder.js';
import { evaluateDecisionTable } from '../src/dmn/dmnEngine.js';
import {
  CDK46_DECISION_TABLE,
  BRCA_OLAPARIB_TABLE,
  POST_NEOADJUVANT_TABLE,
  NEOADJUVANT_TABLE,
  CHEMO_PATHWAY_TABLE,
  ENDOCRINE_THERAPY_TABLE,
  TN_TABLE,
  HRPOS_HER2POS_TABLE,
  HRNEG_HER2POS_TABLE,
} from '../src/dmn/decisionTables.js';

// Helper to build a full plan from raw patient data
function planFor(data) {
  const cql = evaluateCQL(data);
  return { cql, plan: buildTreatmentPlan(cql) };
}

// ============================================================
// 1. CDK4/6 MonarchE criteria (NBCG 04.09.25)
// ============================================================

describe('CDK4/6: MonarchE abemaciclib criteria (NBCG 04.09.25)', () => {
  it('N2 (≥4 positive nodes): abemaciclib first choice', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N2', grade: 2, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('N3 (≥10 positive nodes): abemaciclib first choice', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N3', grade: 2, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('T2 N1 G3: abemaciclib indicated (monarchE: N1 + G3)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', grade: 3, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('T2 N1 Ki-67≥20%: abemaciclib indicated (monarchE: N1 + Ki-67≥20%)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', grade: 2, ki67: 25, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('T2 N1 G2 Ki-67 10%: abemaciclib NOT indicated', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', grade: 2, ki67: 10, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(false);
  });

  it('T1 N1 Ki-67≥20%: abemaciclib indicated (monarchE: N1 + Ki-67≥20%)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 15, nStage: 'N1', grade: 2, ki67: 22, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('T3 N1: abemaciclib first choice (monarchE: N1 + tumor>5cm)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 55, nStage: 'N1', grade: 2, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Abemaciclib'))).toBe(true);
  });

  it('T1 N0 (Stage I): no CDK4/6i indication', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 15, nStage: 'N0', grade: 2, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.length).toBe(0);
  });

  it('N1mi: explicitly no CDK4/6i indication', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N1mi', grade: 3, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.length).toBe(0);
  });

  it('Ribociclib T2 N0 G3: indicated (NATALEE stage II+)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N0', grade: 3, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Ribociclib'))).toBe(true);
  });

  it('Ribociclib T2 N0 G1: NOT indicated (abstain at G1/low-risk)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 25, nStage: 'N0', grade: 1, menopausalStatus: 'post' });
    const cdk = plan.steps.filter(s => s.type === 'cdk46');
    expect(cdk.some(s => s.name.includes('Ribociclib'))).toBe(false);
  });
});

// ============================================================
// 2. isHighRisk derivation correctness
// ============================================================

describe('CQL: isHighRisk fact derivation', () => {
  it('N1 = high risk', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N1', tumorSizeMm: 20 });
    expect(cql.isHighRisk).toBe(true);
  });

  it('G3 = high risk', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N0', grade: 3, tumorSizeMm: 20 });
    expect(cql.isHighRisk).toBe(true);
  });

  it('N0 G2 = NOT high risk', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N0', grade: 2, tumorSizeMm: 20 });
    expect(cql.isHighRisk).toBe(false);
  });

  it('olaparibEligible requires isHighRisk + BRCA + HER2-neg', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N1', grade: 3, brcaStatus: 'BRCA1', tumorSizeMm: 20 });
    expect(cql.isHighRisk).toBe(true);
    expect(cql.brcaMutated).toBe(true);
    expect(cql.olaparibEligible).toBe(true);
  });

  it('olaparibEligible false when BRCA-negative', () => {
    const cql = evaluateCQL({ erStatus: 'positive', her2ihc: '0', nStage: 'N1', grade: 3, brcaStatus: 'negative', tumorSizeMm: 20 });
    expect(cql.olaparibEligible).toBe(false);
  });

  it('olaparibEligible true for TN + BRCA (even without N+/G3)', () => {
    const cql = evaluateCQL({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', nStage: 'N0', grade: 2, brcaStatus: 'BRCA2', tumorSizeMm: 20 });
    expect(cql.bioGroup).toBe('TN');
    expect(cql.olaparibEligible).toBe(true);
  });
});

// ============================================================
// 3. Post-neoadjuvant (Kap. 12.6)
// ============================================================

describe('Post-neoadjuvant compliance (Kap. 12.6)', () => {
  it('HER2+ non-pCR → T-DM1 (KATHERINE)', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '3+', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'post-neoadjuvant', pcrStatus: 'non-pCR' });
    expect(plan.steps.some(s => s.name?.includes('T-DM1'))).toBe(true);
  });

  it('TN non-pCR + BRCA → olaparib (OlympiA)', () => {
    const { plan } = planFor({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'post-neoadjuvant', pcrStatus: 'non-pCR', brcaStatus: 'BRCA1' });
    expect(plan.steps.some(s => s.name?.includes('Olaparib') || s.name?.includes('olaparib'))).toBe(true);
  });

  it('TN non-pCR without BRCA → capecitabin (CREATE-X)', () => {
    const { plan } = planFor({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'post-neoadjuvant', pcrStatus: 'non-pCR', brcaStatus: 'negative' });
    expect(plan.steps.some(s => s.name?.includes('Capecitabin') || s.name?.includes('capecitabin'))).toBe(true);
  });

  it('TN pCR → adjuvant pembrolizumab (KEYNOTE-522)', () => {
    const { plan } = planFor({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'post-neoadjuvant', pcrStatus: 'pCR' });
    expect(plan.steps.some(s => s.name?.includes('pembrolizumab') || s.name?.includes('Pembrolizumab'))).toBe(true);
  });
});

// ============================================================
// 4. Endocrine therapy (NBCG 17.12.24, SOFT/TEXT)
// ============================================================

describe('Endocrine therapy compliance (SOFT/TEXT)', () => {
  it('Postmenopausal HR+ → AI', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0', grade: 2, menopausalStatus: 'post', surgeryType: 'bcs' });
    expect(plan.steps.some(s => s.type === 'endocrine' && s.name.includes('Aromatasehemmer'))).toBe(true);
  });

  it('Premenopausal HR+ high risk → OFS + AI', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', grade: 3, menopausalStatus: 'pre', age: 40, surgeryType: 'bcs' });
    expect(plan.steps.some(s => s.type === 'endocrine' && s.name.includes('OFS'))).toBe(true);
  });

  it('Premenopausal HR+ low risk → tamoxifen', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 15, nStage: 'N0', grade: 1, menopausalStatus: 'pre', age: 45, surgeryType: 'bcs' });
    expect(plan.steps.some(s => s.type === 'endocrine' && s.name.includes('Tamoxifen'))).toBe(true);
  });
});

// ============================================================
// 5. Neoadjuvant per biogroup (NBCG 15.11.23)
// ============================================================

describe('Neoadjuvant compliance (NBCG 15.11.23)', () => {
  it('TN neoadjuvant → pembrolizumab + chemo (KEYNOTE-522)', () => {
    const { plan } = planFor({ erStatus: 'negative', prStatus: 'negative', her2ihc: '0', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'neoadjuvant' });
    expect(plan.steps.some(s => s.name?.includes('Pembrolizumab'))).toBe(true);
  });

  it('HER2+ neoadjuvant → EC90 + taxan + trastuzumab/pertuzumab', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '3+', tumorSizeMm: 30, nStage: 'N1', treatmentMode: 'neoadjuvant' });
    expect(plan.steps.some(s => s.name?.includes('trastuzumab'))).toBe(true);
  });
});

// ============================================================
// 6. sourceRef traceability — every table has guidelineSource
// ============================================================

describe('sourceRef traceability', () => {
  const tables = [
    CDK46_DECISION_TABLE,
    BRCA_OLAPARIB_TABLE,
    POST_NEOADJUVANT_TABLE,
    NEOADJUVANT_TABLE,
    CHEMO_PATHWAY_TABLE,
    ENDOCRINE_THERAPY_TABLE,
    TN_TABLE,
    HRPOS_HER2POS_TABLE,
    HRNEG_HER2POS_TABLE,
  ];

  for (const table of tables) {
    it(`${table.name} has guidelineSource`, () => {
      expect(table.guidelineSource).toBeDefined();
      expect(table.guidelineSource.document || table.guidelineSource.chapter).toBeTruthy();
    });
  }
});

// ============================================================
// 7. Fertility warning (Kap. 10.1)
// ============================================================

describe('Fertility counseling warning (Kap. 10.1)', () => {
  it('Premenopausal ≤40 → fertility warning', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0', grade: 2, menopausalStatus: 'pre', age: 35, surgeryType: 'bcs' });
    expect(plan.warnings.some(w => w.includes('Fertilitet'))).toBe(true);
  });

  it('Postmenopausal → no fertility warning', () => {
    const { plan } = planFor({ erStatus: 'positive', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0', grade: 2, menopausalStatus: 'post', age: 55, surgeryType: 'bcs' });
    expect(plan.warnings.some(w => w.includes('Fertilitet'))).toBe(false);
  });
});

// ============================================================
// 8. ER low-positive handling (NBCG/St. Gallen)
// ============================================================

describe('ER low-positive (1-10%) compliance', () => {
  it('ER 5% treated as clinically ER-negative', () => {
    const cql = evaluateCQL({ erPercent: 5, prStatus: 'negative', her2ihc: '0', nStage: 'N0' });
    expect(cql.erPositive).toBe(false);
    expect(cql.erLowPositive).toBe(true);
    expect(cql.bioGroup).toBe('TN');
  });

  it('ER 5% generates low-positive warning in plan', () => {
    const { plan } = planFor({ erPercent: 5, prStatus: 'negative', her2ihc: '0', tumorSizeMm: 20, nStage: 'N0' });
    expect(plan.warnings.some(w => w.includes('lav-positiv'))).toBe(true);
  });
});
