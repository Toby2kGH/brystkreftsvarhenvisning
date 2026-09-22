/**
 * Tester for Tabelloppslag 1.2.
 *
 * Det som må holde: score velges som tabellens intervall og sammenlignes
 * aldri som tall, skjulte valg kan ikke påvirke noe, og arbeidsflyten
 * (utkvittering, oppsummering) speiler det legen faktisk har gjort.
 */

import { describe, it, expect } from 'vitest';
import {
  ROR_BANDS,
  RS_BANDS,
  EMPTY_LOOKUP_12,
  findMatchingRows12,
  setLookupField,
  visibleDecisions,
  missingDecisions,
  introLookup,
  reviewSignature,
  reviewStatus,
  nextStep,
  isPickCurrent,
  summarizePicks,
} from '../src/tablelookup/lookup12.js';
import { buildIntro } from '../src/tablelookup/introText.js';
import { tableGeneTest, tableNoGeneTest, tableCDK46, guidelineTables } from '../src/tablelookup/guidelineTables.js';

const set = (lookup, entries) => Object.entries(entries).reduce((l, [k, v]) => setLookupField(l, k, v), lookup);

const PROSIGNA = set(EMPTY_LOOKUP_12, {
  bioGroup: 'HR+HER2-',
  tStage: 'pT1c',
  nStage: 'pN0',
  menopausal: 'post',
  geneTestAvailable: true,
  geneTest: 'prosigna',
});

describe('score som tabellens intervall', () => {
  it('etikettene er tabellens egen skrivemåte', () => {
    const cellText = tableGeneTest.rows.map((r) => r.cells[2]).join('\n');
    for (const band of ROR_BANDS) expect(cellText).toContain(band.label);
    for (const band of RS_BANDS) expect(cellText).toContain(band.label);
  });

  it('hvert ROR-intervall markerer bare rader med nøyaktig det intervallet', () => {
    for (const band of ROR_BANDS) {
      const lookup = set(PROSIGNA, { rorBand: band.value, prosignaSubtype: band.value === '41-60' ? 'lumA' : '' });
      const rows = findMatchingRows12(tableGeneTest, lookup);
      expect(rows.length).toBe(1);
      expect(tableGeneTest.rows[rows[0]].cells[2]).toContain(band.label);
    }
  });

  it('uten valgt intervall markeres alle Prosigna-rader for pT1c pN0', () => {
    const rows = findMatchingRows12(tableGeneTest, PROSIGNA);
    expect(rows.length).toBe(4); // 0-40, 41-60 LumA, 41-60 LumB, >60
  });

  it('RS-intervallene skiller de to OncotypeDx-radene', () => {
    const base = set(PROSIGNA, { nStage: 'pN1', geneTest: 'oncotypedx' });
    for (const band of RS_BANDS) {
      const rows = findMatchingRows12(tableGeneTest, setLookupField(base, 'rsBand', band.value));
      expect(rows.length).toBe(1);
      expect(tableGeneTest.rows[rows[0]].cells[2]).toContain(band.label);
    }
  });

  it('et tall i rorScore brukes aldri til markering', () => {
    const withNumber = { ...PROSIGNA, rorScore: '45' };
    expect(findMatchingRows12(tableGeneTest, withNumber)).toEqual(findMatchingRows12(tableGeneTest, PROSIGNA));
  });
});

describe('skjulte felt tømmes', () => {
  it('luminal gruppe tømmes når hovedgruppen byttes', () => {
    const lookup = set(EMPTY_LOOKUP_12, { bioGroup: 'HR+HER2-', luminalLike: 'A' });
    const switched = setLookupField(lookup, 'bioGroup', 'HR-HER2-');
    expect(switched.luminalLike).toBe('');
    expect(buildIntro(introLookup(switched), {})).not.toContain('Lum');
  });

  it('luminal gruppe tømmes når genekspresjonstest krysses av', () => {
    const lookup = set(EMPTY_LOOKUP_12, { bioGroup: 'HR+HER2-', luminalLike: 'B' });
    expect(setLookupField(lookup, 'geneTestAvailable', true).luminalLike).toBe('');
  });

  it('gentest-feltene tømmes når avkrysningen fjernes', () => {
    const lookup = set(PROSIGNA, { rorBand: '41-60', prosignaSubtype: 'lumB' });
    const off = setLookupField(lookup, 'geneTestAvailable', false);
    expect(off).toMatchObject({ geneTest: '', rorBand: '', prosignaSubtype: '' });
  });

  it('PAM50 subtype tømmes når ROR ikke lenger er 41-60', () => {
    const lookup = set(PROSIGNA, { rorBand: '41-60', prosignaSubtype: 'lumA' });
    expect(setLookupField(lookup, 'rorBand', '>60').prosignaSubtype).toBe('');
  });

  it('bytte av test tømmer scoren fra forrige test', () => {
    const lookup = setLookupField(PROSIGNA, 'rorBand', '0-40');
    expect(setLookupField(lookup, 'geneTest', 'oncotypedx').rorBand).toBe('');
  });

  it('gentest kan ikke stå på for andre hovedgrupper', () => {
    expect(setLookupField(PROSIGNA, 'bioGroup', 'HR+HER2+')).toMatchObject({ geneTestAvailable: false, geneTest: '' });
  });
});

describe('hva legen må ta stilling til', () => {
  it('tomt skjema: de fire grunnvalgene mangler', () => {
    expect(missingDecisions(EMPTY_LOOKUP_12).map((f) => f.id)).toEqual(['bioGroup', 'tStage', 'nStage', 'menopausal']);
  });

  it('HR+HER2- uten gentest ber om luminal gruppe', () => {
    const ids = visibleDecisions(setLookupField(EMPTY_LOOKUP_12, 'bioGroup', 'HR+HER2-')).map((f) => f.id);
    expect(ids).toContain('luminalLike');
  });

  it('PAM50 subtype etterspørres bare ved ROR 41-60', () => {
    expect(visibleDecisions(setLookupField(PROSIGNA, 'rorBand', '0-40')).map((f) => f.id)).not.toContain('prosignaSubtype');
    expect(visibleDecisions(setLookupField(PROSIGNA, 'rorBand', '41-60')).map((f) => f.id)).toContain('prosignaSubtype');
  });
});

describe('innledningen', () => {
  it('skriver scoren som intervallet legen valgte', () => {
    const intro = buildIntro(introLookup(set(PROSIGNA, { rorBand: '41-60', prosignaSubtype: 'lumA' })), {});
    expect(intro).toContain('ROR-score 41-60, Luminal A');
  });

  it('skriver RS med tabellens tegn', () => {
    const lookup = set(PROSIGNA, { geneTest: 'oncotypedx', rsBand: '<=25' });
    expect(buildIntro(introLookup(lookup), {})).toContain('RS ≤25');
  });
});

describe('gjennomgang av tabellene', () => {
  const sections = [
    { table: tableNoGeneTest, matches: [3] },
    { table: tableCDK46, matches: [4] },
  ];

  it('ikke utkvittert → todo, utkvittert → done, endret markering → changed', () => {
    expect(reviewStatus({}, 'cdk46', [4])).toBe('todo');
    const reviewed = { cdk46: reviewSignature([4]) };
    expect(reviewStatus(reviewed, 'cdk46', [4])).toBe('done');
    expect(reviewStatus(reviewed, 'cdk46', [5])).toBe('changed');
  });

  it('neste steg: manglende valg først, så første tabell som ikke er gått gjennom', () => {
    expect(nextStep(EMPTY_LOOKUP_12, sections, {}).kind).toBe('input');
    const complete = set(EMPTY_LOOKUP_12, { bioGroup: 'HR+HER2+', tStage: 'pT2', nStage: 'pN1', menopausal: 'pre' });
    expect(nextStep(complete, sections, { nogenetest: '3' })).toEqual({ kind: 'table', tableId: 'cdk46' });
    expect(nextStep(complete, sections, { nogenetest: '3', cdk46: '4' })).toEqual({ kind: 'summary' });
  });
});

describe('oppsummeringen', () => {
  const sections = [{ table: tableCDK46, matches: [4] }];

  it('en rad som ikke lenger er markert flagges; fotnoter gjør ikke det', () => {
    expect(isPickCurrent({ kind: 'row', tableId: 'cdk46', index: 4 }, sections)).toBe(true);
    expect(isPickCurrent({ kind: 'row', tableId: 'cdk46', index: 2 }, sections)).toBe(false);
    expect(isPickCurrent({ kind: 'row', tableId: 'genetest', index: 0 }, sections)).toBe(false);
    expect(isPickCurrent({ kind: 'footnote', tableId: 'genetest', index: 0 }, sections)).toBe(true);
  });

  it('teller rader og fotnoter per tabell i den rekkefølgen de ble lagt til', () => {
    const summary = summarizePicks([
      { kind: 'row', tableId: 'cdk46', index: 4 },
      { kind: 'row', tableId: 'nogenetest', index: 1 },
      { kind: 'footnote', tableId: 'cdk46', index: 0 },
    ], guidelineTables);
    expect(summary.map((s) => [s.table.id, s.rows, s.footnotes])).toEqual([
      ['cdk46', 1, 1],
      ['nogenetest', 1, 0],
    ]);
  });
});
