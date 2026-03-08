import { describe, it, expect } from 'vitest';
import { evaluateDecisionTable, formatRecommendation, evaluateDecisionChain } from '../src/dmn/dmnEngine.js';
import { CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE } from '../src/dmn/decisionTables.js';
import { evaluateCQL, validateClinicalData } from '../src/cql/cqlEngine.js';

// ============================================================
// CQL Engine Tests
// ============================================================

describe('CQL Engine', () => {
  describe('evaluateCQL', () => {
    it('should identify HR+/HER2- patients', () => {
      const result = evaluateCQL({
        erStatus: 'positive',
        prStatus: 'positive',
        her2Status: 'negative',
        ecogScore: 1,
        metastatic: 'yes',
      });

      expect(result.erPositive).toBe(true);
      expect(result.prPositive).toBe(true);
      expect(result.her2Negative).toBe(true);
      expect(result.hrPositiveHer2Negative).toBe(true);
      expect(result.eligible).toBe(true);
    });

    it('should reject HER2+ patients', () => {
      const result = evaluateCQL({
        erStatus: 'positive',
        her2Status: 'positive',
        ecogScore: 0,
        metastatic: 'yes',
      });

      expect(result.her2Negative).toBe(false);
      expect(result.hrPositiveHer2Negative).toBe(false);
      expect(result.eligible).toBe(false);
    });

    it('should reject non-metastatic patients', () => {
      const result = evaluateCQL({
        erStatus: 'positive',
        her2Status: 'negative',
        ecogScore: 0,
        metastatic: 'no',
      });

      expect(result.eligible).toBe(false);
    });

    it('should reject ECOG > 2', () => {
      const result = evaluateCQL({
        erStatus: 'positive',
        her2Status: 'negative',
        ecogScore: 3,
        metastatic: 'yes',
      });

      expect(result.eligible).toBe(false);
    });

    it('should handle boolean inputs', () => {
      const result = evaluateCQL({
        erStatus: true,
        her2Status: false,
        ecogScore: 0,
        metastatic: true,
      });

      expect(result.erPositive).toBe(true);
      expect(result.her2Negative).toBe(true);
      expect(result.eligible).toBe(true);
    });

    it('should parse Ki-67 correctly', () => {
      const result = evaluateCQL({ erStatus: 'positive', her2Status: 'negative', ki67: 25, ecogScore: 0 });
      expect(result.ki67Value).toBe(25);
    });

    it('should set default risk values', () => {
      const result = evaluateCQL({ erStatus: 'positive', her2Status: 'negative', ecogScore: 0 });
      expect(result.cardiacRisk).toBe('low');
      expect(result.neutropeniaRisk).toBe('low');
      expect(result.hepaticFunction).toBe('normal');
      expect(result.needMonotherapy).toBe(false);
    });
  });

  describe('validateClinicalData', () => {
    it('should pass with all required fields', () => {
      const result = validateClinicalData({
        erStatus: 'positive',
        her2Status: 'negative',
        ecogScore: 0,
        metastatic: 'yes',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with missing fields', () => {
      const result = validateClinicalData({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// DMN Engine Tests
// ============================================================

describe('DMN Engine', () => {
  describe('evaluateDecisionTable', () => {
    it('should return INGEN for ineligible patients', () => {
      const context = { eligible: false };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('INGEN');
    });

    it('should recommend Abemaciclib for monotherapy needs', () => {
      const context = {
        eligible: true,
        needMonotherapy: true,
        cardiacRisk: 'low',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'post',
        priorTherapyLines: 1,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('Abemaciclib');
    });

    it('should avoid Ribociclib with high cardiac risk', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'high',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'post',
        priorTherapyLines: 0,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).not.toBe('Ribociclib');
    });

    it('should recommend Abemaciclib for high neutropenia risk (low diarrhoea)', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'low',
        neutropeniaRisk: 'high',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'post',
        priorTherapyLines: 0,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('Abemaciclib');
    });

    it('should recommend Ribociclib for premenopausal first-line', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'low',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'pre',
        priorTherapyLines: 0,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('Ribociclib');
    });

    it('should recommend Ribociclib for postmenopausal first-line', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'low',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'post',
        priorTherapyLines: 0,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('Ribociclib');
    });

    it('should fall back to Palbociclib for standard cases', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'low',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'unknown',
        priorTherapyLines: 5,
      };
      const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);

      expect(result.matched).toBe(true);
      expect(result.result.recommendation).toBe('Palbociclib');
    });
  });

  describe('formatRecommendation', () => {
    it('should format matched result with all fields', () => {
      const dmnResult = evaluateDecisionTable(CDK46_DECISION_TABLE, {
        eligible: true,
        needMonotherapy: true,
      });
      const formatted = formatRecommendation(dmnResult);

      expect(formatted.summary).toContain('Abemaciclib');
      expect(formatted.recommendation).toBe('Abemaciclib');
      expect(formatted.confidence).toBeDefined();
      expect(formatted.rationale).toBeDefined();
      expect(formatted.warnings).toBeInstanceOf(Array);
    });

    it('should handle no match', () => {
      const formatted = formatRecommendation({
        matched: false,
        result: null,
        matchedRules: [],
      });

      expect(formatted.summary).toBe('Ingen anbefaling');
      expect(formatted.recommendation).toBeNull();
    });
  });

  describe('evaluateDecisionChain', () => {
    it('should chain multiple tables', () => {
      const context = {
        eligible: true,
        needMonotherapy: false,
        cardiacRisk: 'low',
        neutropeniaRisk: 'low',
        diarrhoeaRisk: 'low',
        hepaticFunction: 'normal',
        menopausalStatus: 'post',
        priorTherapyLines: 0,
      };

      const result = evaluateDecisionChain(
        [CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE],
        context
      );

      expect(result.tableResults).toHaveLength(2);
      expect(result.tableResults[0].matched).toBe(true);
      expect(result.tableResults[1].matched).toBe(true);
    });
  });
});

// ============================================================
// Integration Tests: CQL → DMN Pipeline
// ============================================================

describe('CQL → DMN Integration', () => {
  it('should run full pipeline for eligible patient', () => {
    const clinicalData = {
      erStatus: 'positive',
      prStatus: 'positive',
      her2Status: 'negative',
      ki67: 30,
      ecogScore: 1,
      metastatic: 'yes',
      menopausalStatus: 'post',
      priorTherapyLines: 0,
      cardiacRisk: 'low',
      neutropeniaRisk: 'low',
      diarrhoeaRisk: 'low',
      hepaticFunction: 'normal',
      needMonotherapy: 'no',
    };

    const cqlOutput = evaluateCQL(clinicalData);
    expect(cqlOutput.eligible).toBe(true);

    const dmnResult = evaluateDecisionTable(CDK46_DECISION_TABLE, cqlOutput);
    expect(dmnResult.matched).toBe(true);

    const rec = formatRecommendation(dmnResult);
    expect(rec.recommendation).toBe('Ribociclib');
    expect(rec.confidence).toBe('high');
  });

  it('should handle high cardiac risk patient', () => {
    const cqlOutput = evaluateCQL({
      erStatus: 'positive',
      her2Status: 'negative',
      ecogScore: 0,
      metastatic: 'yes',
      cardiacRisk: 'high',
      needMonotherapy: 'no',
    });

    const dmnResult = evaluateDecisionTable(CDK46_DECISION_TABLE, cqlOutput);
    const rec = formatRecommendation(dmnResult);

    expect(rec.recommendation).not.toBe('Ribociclib');
  });

  it('should handle ineligible patient (ER negative, PR negative)', () => {
    const cqlOutput = evaluateCQL({
      erStatus: 'negative',
      prStatus: 'negative',
      her2Status: 'negative',
      ecogScore: 0,
      metastatic: 'yes',
    });

    expect(cqlOutput.eligible).toBe(false);

    const dmnResult = evaluateDecisionTable(CDK46_DECISION_TABLE, cqlOutput);
    const rec = formatRecommendation(dmnResult);

    expect(rec.recommendation).toBe('INGEN');
  });

  it('should qualify ER-/PR+ patient as HR+ (PR-only positive)', () => {
    const cqlOutput = evaluateCQL({
      erStatus: 'negative',
      prStatus: 'positive',
      her2Status: 'negative',
      ecogScore: 0,
      metastatic: 'yes',
    });

    expect(cqlOutput.hrPositiveHer2Negative).toBe(true);
    expect(cqlOutput.eligible).toBe(true);
  });
});

// ============================================================
// DMN Engine: Range comparisons
// ============================================================

describe('DMN Range Comparisons', () => {
  it('should match gte condition', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { gte: 30 } }, outputs: { result: 'high' } }],
    };
    expect(evaluateDecisionTable(table, { value: 30 }).result.result).toBe('high');
    expect(evaluateDecisionTable(table, { value: 31 }).result.result).toBe('high');
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
    expect(evaluateDecisionTable(table, { value: 30 }).matched).toBe(false);
  });

  it('should return false for range comparison with null actual value', () => {
    const table = {
      id: 'test', name: 'test', hitPolicy: 'FIRST',
      rules: [{ id: 'T1', conditions: { value: { gte: 10 } }, outputs: { result: 'ok' } }],
    };
    expect(evaluateDecisionTable(table, { value: null }).matched).toBe(false);
  });
});

// ============================================================
// DMN: Additional rule coverage
// ============================================================

describe('DMN Additional Rules', () => {
  it('R4: should recommend Ribociclib for high diarrhoea risk', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'high', hepaticFunction: 'normal',
      menopausalStatus: 'post', priorTherapyLines: 0,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Ribociclib');
  });

  it('R5: should recommend Palbociclib for moderate hepatic impairment', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'moderate',
      menopausalStatus: 'post', priorTherapyLines: 0,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Palbociclib');
  });

  it('R5: should recommend Palbociclib for severe hepatic impairment', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'severe',
      menopausalStatus: 'unknown', priorTherapyLines: 0,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Palbociclib');
  });

  it('R8: should recommend Palbociclib for second-line treatment', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'post', priorTherapyLines: 1,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Palbociclib');
    expect(result.result.combinationPartner).toBe('Fulvestrant');
  });

  it('R10: should recommend Ribociclib for high Ki-67 (>=30%)', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'unknown', priorTherapyLines: 5, ki67Value: 35,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Ribociclib');
  });

  it('R9: should fall back to Palbociclib when Ki-67 < 30%', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'unknown', priorTherapyLines: 5, ki67Value: 15,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    expect(result.result.recommendation).toBe('Palbociclib');
  });

  it('R3 should win over R4 when both neutropenia and diarrhoea risks are high', () => {
    // R3 (priority 8) > R4 (priority 7), but R3 requires diarrhoeaRisk != 'high'
    // So when both are high, R3 doesn't match, R4 matches
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'high', diarrhoeaRisk: 'high', hepaticFunction: 'normal',
      menopausalStatus: 'unknown', priorTherapyLines: 5,
    };
    const result = evaluateDecisionTable(CDK46_DECISION_TABLE, context);
    // R3 excluded (diarrhoeaRisk=high), R4 matches (cardiacRisk not high)
    expect(result.result.recommendation).toBe('Ribociclib');
  });
});

// ============================================================
// Decision Chain: CDK4/6i + Endocrine Partner
// ============================================================

describe('Decision Chain with Endocrine Partner', () => {
  it('should chain CDK4/6i + endocrine partner for postmenopausal 1st line', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'post', priorTherapyLines: 0,
    };
    const result = evaluateDecisionChain([CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE], context);

    expect(result.tableResults[0].result.recommendation).toBe('Ribociclib');
    expect(result.tableResults[1].result.partner).toBe('Letrozol');
  });

  it('should chain CDK4/6i + endocrine partner for premenopausal 1st line', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'pre', priorTherapyLines: 0,
    };
    const result = evaluateDecisionChain([CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE], context);

    expect(result.tableResults[0].result.recommendation).toBe('Ribociclib');
    expect(result.tableResults[1].result.partner).toBe('Letrozol + Goserelin');
  });

  it('should recommend Fulvestrant for prior endocrine therapy', () => {
    const context = {
      eligible: true, needMonotherapy: false, cardiacRisk: 'low',
      neutropeniaRisk: 'low', diarrhoeaRisk: 'low', hepaticFunction: 'normal',
      menopausalStatus: 'post', priorTherapyLines: 1, priorEndocrineTherapy: true,
    };
    const result = evaluateDecisionChain([CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE], context);

    expect(result.tableResults[1].result.partner).toBe('Fulvestrant');
  });
});

// ============================================================
// Error handling and validation
// ============================================================

describe('Validation and Edge Cases', () => {
  it('should list all missing fields', () => {
    const result = validateClinicalData({});
    expect(result.errors).toHaveLength(4);
    expect(result.errors).toContain('Østrogenreseptor (ER) status mangler');
    expect(result.errors).toContain('HER2-status mangler');
    expect(result.errors).toContain('ECOG funksjonsstatus mangler');
    expect(result.errors).toContain('Metastatisk status mangler');
  });

  it('should handle invalid Ki-67 values', () => {
    const result = evaluateCQL({ erStatus: 'positive', her2Status: 'negative', ki67: 'abc', ecogScore: 0 });
    expect(result.ki67Value).toBeNull();
  });

  it('should handle invalid ECOG values', () => {
    const result = evaluateCQL({ erStatus: 'positive', her2Status: 'negative', ecogScore: 'invalid' });
    expect(result.ecogScore).toBeNull();
    expect(result.eligible).toBe(false);
  });

  it('should handle empty decision table', () => {
    const emptyTable = { id: 'empty', name: 'Empty', hitPolicy: 'FIRST', rules: [] };
    const result = evaluateDecisionTable(emptyTable, { eligible: true });
    expect(result.matched).toBe(false);
  });
});
