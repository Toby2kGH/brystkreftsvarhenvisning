/**
 * Safety-hardening regression tests (Spor C).
 *
 * Beskytter de kliniske sikkerhets-/robusthetsendringene:
 * - Grenseverdier akkurat på cutoff (RS 25, ROR 40/60, Ki-67 20, tumor 50 mm)
 * - NEO1a luminal A-like → neoadjuvant endokrin (ende-til-ende)
 * - HER2-ekvivokal → ukjent biogruppe → hard-stopp (insufficientData)
 * - Ugyldig input → validering + CQL-nullstilling
 * - Journaltekst inneholder ER/PR og skriver HER2 IHC '0'
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCQL,
  validateClinicalData,
  deriveTStage,
  deriveLuminalSubtype,
} from '../src/cql/cqlEngine.js';
import { buildTreatmentPlan, buildJournalText } from '../src/dmn/treatmentBuilder.js';

const base = {
  erStatus: 'positive', prStatus: 'positive', her2ihc: '0',
  nStage: 'N0', menopausalStatus: 'post',
};

// ============================================================
// Grenseverdier — akkurat på cutoff
// ============================================================

describe('Boundary: gene expression cutoffs', () => {
  it('RS = 25 → lav risiko (lte 25), ikke høy', () => {
    const cql = evaluateCQL({ ...base, geneTest: 'oncotypedx', rsScore: 25 });
    expect(cql.gesLowRisk).toBe(true);
    expect(cql.gesHighRisk).toBe(false);
  });

  it('ROR = 40 → lav risiko (lte 40)', () => {
    const cql = evaluateCQL({ ...base, geneTest: 'prosigna', rorScore: 40 });
    expect(cql.gesLowRisk).toBe(true);
    expect(cql.gesHighRisk).toBe(false);
  });

  it('ROR = 60 → verken lav eller høy (intermediær; høy krever > 60)', () => {
    const cql = evaluateCQL({ ...base, geneTest: 'prosigna', rorScore: 60 });
    expect(cql.gesHighRisk).toBe(false);
    expect(cql.gesLowRisk).toBe(false);
  });

  it('ROR = 61 → høy risiko', () => {
    const cql = evaluateCQL({ ...base, geneTest: 'prosigna', rorScore: 61 });
    expect(cql.gesHighRisk).toBe(true);
  });
});

describe('Boundary: Ki-67 = 20 og T-stadium = 50 mm', () => {
  it('Ki-67 = 20 med grad 2 → B-like (>= 20)', () => {
    expect(deriveLuminalSubtype(2, 20, 80)).toBe('B-like');
  });

  it('Ki-67 = 19 med grad 2 og PR ok → A-like', () => {
    expect(deriveLuminalSubtype(2, 19, 80)).toBe('A-like');
  });

  it('tumor = 50 mm → T2 (<= 50)', () => {
    expect(deriveTStage(50)).toBe('T2');
  });

  it('tumor = 51 mm → T3 (> 50)', () => {
    expect(deriveTStage(51)).toBe('T3');
  });

  it('monarchE: T2 (50 mm) N1 HR+HER2- → abemaciclib førstevalg (tumor >= 50)', () => {
    const cql = evaluateCQL({
      ...base, nStage: 'N1', tumorSizeMm: 50, grade: 2, ki67: 10,
    });
    const plan = buildTreatmentPlan(cql);
    const abema = plan.steps.find((s) => s.name?.includes('Abemaciclib'));
    expect(abema).toBeTruthy();
    expect(abema.priority).toBe(1);
  });
});

// ============================================================
// NEO1a — luminal A-like → neoadjuvant endokrin (ende-til-ende)
// ============================================================

describe('NEO1a: sterkt ER+ → A-like → neoadjuvant endokrin', () => {
  it('grad 1, Ki-67 10, PR 80 → luminalSubtype A-like', () => {
    const cql = evaluateCQL({
      ...base, treatmentMode: 'neoadjuvant',
      erPercent: 90, prPercent: 80, grade: 1, ki67: 10, tumorSizeMm: 30, nStage: 'N0',
    });
    expect(cql.luminalSubtype).toBe('A-like');
  });

  it('bygger neoadjuvant endokrin (NEO1a), ikke kjemoterapi (NEO1b)', () => {
    const cql = evaluateCQL({
      ...base, treatmentMode: 'neoadjuvant',
      erPercent: 90, prPercent: 80, grade: 1, ki67: 10, tumorSizeMm: 30, nStage: 'N0',
    });
    const plan = buildTreatmentPlan(cql);
    const matched = plan.dmnResults.neoadjuvant?.matchedRules?.[0]?.ruleId;
    expect(matched).toBe('NEO1a');
    // Skal ikke ende på EC90-kjemoterapi
    const chemo = plan.steps.find((s) => s.type === 'chemo');
    expect(chemo?.name?.includes('EC90')).not.toBe(true);
  });
});

// ============================================================
// HER2-ekvivokal → ukjent biogruppe → hard-stopp
// ============================================================

describe('Hard-stopp ved ukjent biogruppe (HER2 2+ uten SISH)', () => {
  it('HER2 IHC 2+ uten SISH → bioGroup unknown → insufficientData, ingen steps', () => {
    const cql = evaluateCQL({
      erStatus: 'positive', prStatus: 'positive', her2ihc: '2+',
      nStage: 'N0', menopausalStatus: 'post', grade: 2,
    });
    expect(cql.her2Status).toBe('equivocal');
    expect(cql.bioGroup).toBe('unknown');
    const plan = buildTreatmentPlan(cql);
    expect(plan.insufficientData).toBe(true);
    expect(plan.steps.length).toBe(0);
    expect(plan.warnings.some((w) => w.includes('UTILSTREKKELIGE DATA'))).toBe(true);
  });
});

// ============================================================
// Ugyldig input → validering + CQL-nullstilling
// ============================================================

describe('Ugyldig input håndteres defensivt', () => {
  it('Ki-67 = -5 og 150 → ki67Value null', () => {
    expect(evaluateCQL({ ...base, ki67: -5 }).ki67Value).toBe(null);
    expect(evaluateCQL({ ...base, ki67: 150 }).ki67Value).toBe(null);
  });

  it('grad = 7 → grade null', () => {
    expect(evaluateCQL({ ...base, grade: 7 }).grade).toBe(null);
  });

  it('validateClinicalData krever ER + PR + HER2 + N-stadium + menopausal', () => {
    expect(validateClinicalData({ erStatus: 'positive' }).valid).toBe(false);
    expect(validateClinicalData({ ...base }).valid).toBe(true);
    // Mangler PR
    expect(validateClinicalData({ erStatus: 'positive', her2ihc: '0', nStage: 'N0', menopausalStatus: 'post' }).valid).toBe(false);
    // Mangler menopausal
    expect(validateClinicalData({ erStatus: 'positive', prStatus: 'positive', her2ihc: '0', nStage: 'N0' }).valid).toBe(false);
  });

  it('tom streng regnes som manglende (ikke gyldig)', () => {
    expect(validateClinicalData({ erStatus: '', prStatus: '', her2ihc: '', nStage: '', menopausalStatus: '' }).valid).toBe(false);
  });
});

// ============================================================
// Journaltekst — ER/PR med, HER2 IHC '0' skrives ut
// ============================================================

describe('Journaltekst inneholder reseptorstatus', () => {
  it('inneholder ER og PR, og skriver HER2 IHC 0 (regresjonsvern for «0»-bug)', () => {
    const cql = evaluateCQL({
      ...base, erPercent: 90, prPercent: 80, grade: 2, ki67: 10, nStage: 'N0',
    });
    const plan = buildTreatmentPlan(cql);
    const text = buildJournalText(cql, plan);
    expect(text).toMatch(/ER:/);
    expect(text).toMatch(/PR:/);
    expect(text).toContain('HER2 IHC: 0');
    expect(text).toContain('Menopausal status:');
  });
});
