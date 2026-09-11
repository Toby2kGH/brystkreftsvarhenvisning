/**
 * Tester for innledningssetningen i Tabelloppslag 1.1.
 *
 * Poenget er at teksten skal være ferdig, ikke noe legen må rydde i: riktig
 * grammatikk, og ingen spor av felter som ikke er fylt ut.
 */

import { describe, it, expect } from 'vitest';
import { buildIntro, geneTestPhrase } from '../src/tablelookup/introText.js';

const LOOKUP = {
  bioGroup: 'HR+HER2-',
  tStage: 'pT2',
  nStage: 'pN1',
  menopausal: 'post',
  luminalLike: 'B',
  geneTestAvailable: false,
  geneTest: '',
  prosignaSubtype: '',
  rorScore: '',
  rsScore: '',
};
const JOURNAL = { age: '58', erPercent: '90', prPercent: '60', ki67: '40', grade: '3', her2: '' };

describe('buildIntro — grammatikk', () => {
  it('setter menopausal status som adjektiv, ikke som løsrevet ord', () => {
    const text = buildIntro(LOOKUP, JOURNAL);
    expect(text).toMatch(/^Postmenopausal pasient, 58 år\./);
    expect(text).not.toContain('Pasient med postmenopausal');
  });

  it('bruker premenopausal like riktig', () => {
    expect(buildIntro({ ...LOOKUP, menopausal: 'pre' }, JOURNAL)).toMatch(/^Premenopausal pasient/);
  });

  it('faller tilbake til «Pasient» uten menopausal status', () => {
    expect(buildIntro({ ...LOOKUP, menopausal: '' }, JOURNAL)).toMatch(/^Pasient, 58 år\./);
  });

  it('utelater alder når den ikke er oppgitt', () => {
    const text = buildIntro(LOOKUP, { ...JOURNAL, age: '' });
    expect(text).toMatch(/^Postmenopausal pasient\. /);
    expect(text).not.toContain('år');
  });

  it('skriver hovedgruppen lesbart, ikke som kode', () => {
    expect(buildIntro(LOOKUP, JOURNAL)).toContain('HR+ HER2-');
  });

  it('avslutter med punktum', () => {
    expect(buildIntro(LOOKUP, JOURNAL).endsWith('.')).toBe(true);
  });
});

describe('buildIntro — tomme felt utelates', () => {
  it('inneholder aldri tankestrek for manglende verdier', () => {
    const sparse = buildIntro({ bioGroup: 'HR-HER2-', menopausal: 'pre' }, {});
    expect(sparse).not.toContain('—');
    expect(buildIntro(LOOKUP, JOURNAL)).not.toContain('—');
  });

  it('tar bare med de patologiske funnene som faktisk er oppgitt', () => {
    const text = buildIntro(LOOKUP, { age: '58', erPercent: '90', prPercent: '', ki67: '', grade: '', her2: '' });
    expect(text).toContain('ER 90 %');
    expect(text).not.toContain('PR');
    expect(text).not.toContain('Ki-67');
    expect(text).not.toContain('grad');
  });

  it('tar med HER2 når legen har skrevet den inn', () => {
    expect(buildIntro(LOOKUP, { ...JOURNAL, her2: 'IHC 0' })).toContain('HER2 IHC 0');
  });

  it('utelater luminalgruppe når den ikke er valgt', () => {
    expect(buildIntro({ ...LOOKUP, luminalLike: '' }, JOURNAL)).not.toContain('Vurdert som');
  });

  it('gir tom streng når ingenting er fylt ut', () => {
    expect(buildIntro({}, {})).toBe('');
    expect(buildIntro(LOOKUP, JOURNAL)).not.toBe('');
  });

  it('utelater stadium når verken T eller N er valgt', () => {
    const text = buildIntro({ ...LOOKUP, tStage: '', nStage: '' }, JOURNAL);
    expect(text).toContain('HR+ HER2-');
    expect(text).not.toMatch(/pT|pN/);
  });
});

describe('geneTestPhrase', () => {
  it('gir null når ingen test er oppgitt', () => {
    expect(geneTestPhrase(LOOKUP)).toBeNull();
    expect(geneTestPhrase({ ...LOOKUP, geneTestAvailable: true, geneTest: '' })).toBeNull();
  });

  it('tar med ROR-score og subtype for Prosigna', () => {
    const phrase = geneTestPhrase({
      ...LOOKUP, geneTestAvailable: true, geneTest: 'prosigna', rorScore: '55', prosignaSubtype: 'lumB',
    });
    expect(phrase).toBe('Prosigna (PAM50): ROR-score 55, Luminal B');
  });

  it('tar med RS for OncotypeDx', () => {
    expect(geneTestPhrase({ ...LOOKUP, geneTestAvailable: true, geneTest: 'oncotypedx', rsScore: '26' }))
      .toBe('OncotypeDx: RS 26');
  });

  it('gir bare testnavnet når scoren mangler', () => {
    expect(geneTestPhrase({ ...LOOKUP, geneTestAvailable: true, geneTest: 'prosigna' })).toBe('Prosigna (PAM50)');
  });
});
