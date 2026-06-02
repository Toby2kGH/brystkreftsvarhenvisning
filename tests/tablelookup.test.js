// ============================================================
//  Tester for Tabelloppslag-verktøyet (ny fane)
//  Verifiserer at matcheren slår opp riktig rad i de
//  digitaliserte NBCG-tabellene, og at luminal-klassifiseringen
//  følger karakteristikaene fra PDF-en.
// ============================================================
import { describe, it, expect } from 'vitest';
import { tableGeneTest, tableNoGeneTest } from '../src/tablelookup/guidelineTables.js';
import { findMatchingRows, rowMatches, classifyLuminalLike } from '../src/tablelookup/matcher.js';

// Hjelper: tekst-stien (gruppe › ... › ytterligere) for en treff-rad
function pathOf(table, idx) {
  return table.rows[idx].cells
    .slice(0, table.mergeCount + 1)
    .map((c) => c.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join(' › ');
}

describe('Tabelloppslag — genekspresjonstest foreligger', () => {
  it('OncotypeDx RS>25, postmenopausal pN1 → riktig rad', () => {
    const m = findMatchingRows(tableGeneTest, {
      bioGroup: 'HR+HER2-', geneTest: 'oncotypedx', menopausal: 'post', nStage: 'pN1', tStage: 'pT2', rsScore: '30',
    });
    expect(m).toHaveLength(1);
    expect(pathOf(tableGeneTest, m[0])).toContain('OncotypeDx RS>25');
  });

  it('OncotypeDx RS≤25 treffer lav-risiko-raden', () => {
    const m = findMatchingRows(tableGeneTest, {
      bioGroup: 'HR+HER2-', geneTest: 'oncotypedx', menopausal: 'post', nStage: 'pN1', rsScore: '12',
    });
    expect(m).toHaveLength(1);
    expect(pathOf(tableGeneTest, m[0])).toContain('OncotypeDx RS≤25');
  });

  it('Prosigna Luminal A (ROR 0-40), pT1c pN0', () => {
    const m = findMatchingRows(tableGeneTest, {
      bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT1c', rorScore: '20',
    });
    expect(m).toHaveLength(1);
    expect(pathOf(tableGeneTest, m[0])).toContain('ROR score 0-40');
  });

  it('Prosigna Luminal B (ROR 41-60), subtype skiller A fra B', () => {
    const base = { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT2', rorScore: '50' };
    const mB = findMatchingRows(tableGeneTest, { ...base, prosignaSubtype: 'lumB' });
    expect(mB).toHaveLength(1);
    expect(pathOf(tableGeneTest, mB[0])).toContain('Luminal B');
    const mA = findMatchingRows(tableGeneTest, { ...base, prosignaSubtype: 'lumA' });
    expect(mA).toHaveLength(1);
    expect(pathOf(tableGeneTest, mA[0])).toContain('Luminal A');
  });

  it('ROR >60 treffer høyrisiko-raden uavhengig av subtype', () => {
    const m = findMatchingRows(tableGeneTest, {
      bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT1c', rorScore: '75',
    });
    expect(m).toHaveLength(1);
    expect(pathOf(tableGeneTest, m[0])).toContain('ROR score >60');
  });
});

describe('Tabelloppslag — ingen genekspresjonstest', () => {
  it('Lum A-liknende pT2pN0 grad 2', () => {
    const m = findMatchingRows(tableNoGeneTest, {
      bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: 'pN0', tStage: 'pT2', grade: '2',
    });
    expect(m).toHaveLength(1);
    expect(pathOf(tableNoGeneTest, m[0])).toContain('pT2pN0 Grad 2');
  });

  it('Lum A-liknende kombinasjonsrad (anyOf): pT1c grad 2 ELLER pT2 grad 1', () => {
    const a = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: 'pN0', tStage: 'pT1c', grade: '2' });
    const b = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: 'pN0', tStage: 'pT2', grade: '1' });
    expect(pathOf(tableNoGeneTest, a[0])).toContain('pT1c grad 2 pN0');
    expect(pathOf(tableNoGeneTest, b[0])).toContain('pT1c grad 2 pN0');
  });

  it('HR- HER2+ pT2 pN0 → TCH-rad', () => {
    const m = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR-HER2+', nStage: 'pN0', tStage: 'pT2' });
    expect(m).toHaveLength(1);
    expect(tableNoGeneTest.rows[m[0]].cells[3]).toContain('TCH');
  });

  it('Trippel negativ pT2 pN0 treffer anyOf-rad (pT1pN1-3 / pT2pN0-3)', () => {
    const m = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR-HER2-', nStage: 'pN0', tStage: 'pT2' });
    expect(m).toHaveLength(1);
    expect(pathOf(tableNoGeneTest, m[0])).toContain('pT2pN0-3');
  });

  it('Trippel negativ pT1b pN0 → egen rad', () => {
    const m = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR-HER2-', nStage: 'pN0', tStage: 'pT1b' });
    expect(m).toHaveLength(1);
    expect(pathOf(tableNoGeneTest, m[0])).toContain('pT1bpN0');
  });

  it('Hver rad treffer høyst én gang for et fullt spesifisert kasus', () => {
    // pT2 pN0 grad 2, LumA → nøyaktig ett treff (ingen overlappende rader)
    const m = findMatchingRows(tableNoGeneTest, { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: 'pN0', tStage: 'pT2', grade: '2' });
    expect(m).toHaveLength(1);
  });
});

describe('Luminal-liknende klassifisering', () => {
  it('Ki67<10, G1-2, HR>50 → Lum A', () => {
    expect(classifyLuminalLike({ ki67: '5', grade: '2', hrPercent: '90' }).value).toBe('A');
  });
  it('Ki67>35 → LumB', () => {
    expect(classifyLuminalLike({ ki67: '40', grade: '3', hrPercent: '80' }).value).toBe('B');
  });
  it('HR<50 → LumB', () => {
    expect(classifyLuminalLike({ ki67: '8', grade: '1', hrPercent: '30' }).value).toBe('B');
  });
  it('Ki67 i gråsonen 10-35 uten B-kriterier → ikke konklusiv', () => {
    expect(classifyLuminalLike({ ki67: '20', grade: '2', hrPercent: '80' }).value).toBe('inconclusive');
  });
  it('Ingen data → null (ingen forslag)', () => {
    expect(classifyLuminalLike({ ki67: '', grade: '', hrPercent: '' })).toBeNull();
  });
});

describe('rowMatches — ukjente felt blokkerer ikke treff', () => {
  it('manglende menopausal status hindrer ikke et ellers gyldig treff', () => {
    const crit = { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: ['pT1c'], rorMin: 0, rorMax: 40 };
    expect(rowMatches(crit, { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT1c', rorScore: '20', menopausal: '' })).toBe(true);
  });
});
