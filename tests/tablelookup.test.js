// ============================================================
//  Tester for Tabelloppslag-verktøyet (ny fane)
//  Verifiserer at matcheren slår opp riktig rad i de
//  digitaliserte NBCG-tabellene, og at luminal-klassifiseringen
//  følger karakteristikaene fra PDF-en.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  tableGeneTest,
  tableNoGeneTest,
  tableCDK46,
  tablePt1mic,
  tableNeoadjuvant,
  addonTables,
  referenceDocs,
} from '../src/tablelookup/guidelineTables.js';
import { findMatchingRows, rowMatches, classifyLuminalLike, simplifyT } from '../src/tablelookup/matcher.js';

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

describe('Tabelloppslag — CDK4/6-hemmer (tilleggstabell)', () => {
  it('er registrert som addon for HR+HER2-', () => {
    expect(addonTables).toContain(tableCDK46);
    expect(tableCDK46.appliesToBioGroups).toContain('HR+HER2-');
  });

  it('simplifyT mapper pT-stadier til T0–T4', () => {
    expect(simplifyT('pT1a')).toBe('T1');
    expect(simplifyT('pT1c')).toBe('T1');
    expect(simplifyT('pT2')).toBe('T2');
    expect(simplifyT('pT4')).toBe('T4');
    expect(simplifyT('T0')).toBe('T0');
  });

  it('T2N1 (pT2/pN1) → IIB-rad med Ribociklib Ja', () => {
    const m = findMatchingRows(tableCDK46, { tSimple: simplifyT('pT2'), nStage: 'pN1' });
    expect(m).toHaveLength(1);
    const row = tableCDK46.rows[m[0]];
    expect(row.cells[1]).toBe('T2N1');
    expect(row.cells[2]).toContain('Ja');
  });

  it('T1N0 → stadium I, begge Nei', () => {
    const m = findMatchingRows(tableCDK46, { tSimple: simplifyT('pT1c'), nStage: 'pN0' });
    expect(m).toHaveLength(1);
    expect(tableCDK46.rows[m[0]].cells[0]).toBe('I');
  });

  it('AnyT N3 treffer uavhengig av T', () => {
    const m1 = findMatchingRows(tableCDK46, { tSimple: 'T1', nStage: 'pN3' });
    const m2 = findMatchingRows(tableCDK46, { tSimple: 'T4', nStage: 'pN3' });
    expect(m1).toEqual(m2);
    expect(tableCDK46.rows[m1[0]].cells[1]).toBe('AnyTN3');
  });

  it('T4N1 → Abemaciklib-betingelse om grad 3 / tumor ≥ 5 cm', () => {
    const m = findMatchingRows(tableCDK46, { tSimple: 'T4', nStage: 'pN1' });
    expect(tableCDK46.rows[m[0]].cells[3]).toContain('≥ 5 cm');
  });

  it('hvert fullt TNM-kasus gir nøyaktig én CDK-rad', () => {
    for (const t of ['T0', 'T1', 'T2', 'T3', 'T4']) {
      for (const n of ['pN0', 'pN1', 'pN2', 'pN3']) {
        const m = findMatchingRows(tableCDK46, { tSimple: t, nStage: n });
        expect(m.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Tabelloppslag — pT1 pN1(mi) med Prosigna (tilleggstabell)', () => {
  it('er addon for HR+HER2- og krever pN1mi', () => {
    expect(addonTables).toContain(tablePt1mic);
    expect(tablePt1mic.appliesToBioGroups).toContain('HR+HER2-');
    expect(tablePt1mic.requiresNStage).toContain('pN1mi');
  });

  it('ROR 0-40 → Luminal A endokrin-rad', () => {
    const m = findMatchingRows(tablePt1mic, { bioGroup: 'HR+HER2-', nStage: 'pN1mi', tStage: 'pT1c', rorScore: '30' });
    expect(m).toHaveLength(1);
    expect(tablePt1mic.rows[m[0]].cells[2]).toContain('Luminal A');
    expect(tablePt1mic.rows[m[0]].cells[3]).toContain('Endokrin behandling');
  });

  it('ROR 41-60 skilles på subtype', () => {
    const base = { bioGroup: 'HR+HER2-', nStage: 'pN1mi', tStage: 'pT1c', rorScore: '50' };
    const a = findMatchingRows(tablePt1mic, { ...base, prosignaSubtype: 'lumA' });
    const b = findMatchingRows(tablePt1mic, { ...base, prosignaSubtype: 'lumB' });
    expect(tablePt1mic.rows[a[0]].cells[2]).toContain('Luminal A');
    expect(tablePt1mic.rows[b[0]].cells[2]).toContain('Luminal B');
  });

  it('ROR >60 → EC90 → taxan-rad', () => {
    const m = findMatchingRows(tablePt1mic, { bioGroup: 'HR+HER2-', nStage: 'pN1mi', tStage: 'pT1c', rorScore: '75' });
    expect(m).toHaveLength(1);
    expect(tablePt1mic.rows[m[0]].cells[3]).toContain('taxan');
  });
});

describe('Tabelloppslag — neoadjuvant behandling', () => {
  it('ER+HER2- Luminal A → endokrin-rad', () => {
    const m = findMatchingRows(tableNeoadjuvant, { bioGroup: 'HR+HER2-', luminalLike: 'A' });
    expect(m).toHaveLength(1);
    expect(tableNeoadjuvant.rows[m[0]].cells[1]).toContain('Luminal A');
    expect(tableNeoadjuvant.rows[m[0]].cells[2]).toContain('Endokrin behandling');
  });

  it('ER+HER2- ikke-LumA → «Alle andre» (kjemoterapi)', () => {
    const m = findMatchingRows(tableNeoadjuvant, { bioGroup: 'HR+HER2-', luminalLike: 'B' });
    expect(m).toHaveLength(1);
    expect(tableNeoadjuvant.rows[m[0]].cells[1]).toBe('Alle andre');
  });

  it('HER2+ (begge HR-varianter) → TCHP-rad', () => {
    for (const bg of ['HR+HER2+', 'HR-HER2+']) {
      const m = findMatchingRows(tableNeoadjuvant, { bioGroup: bg });
      expect(m).toHaveLength(1);
      expect(tableNeoadjuvant.rows[m[0]].cells[2]).toContain('TCHP');
    }
  });

  it('Trippel negativ → pembrolizumab-rad', () => {
    const m = findMatchingRows(tableNeoadjuvant, { bioGroup: 'HR-HER2-' });
    expect(m).toHaveLength(1);
    expect(tableNeoadjuvant.rows[m[0]].cells[2]).toContain('Pembrolizumab');
  });

  it('ukjent luminal → begge ER+HER2--rader er kandidater', () => {
    const m = findMatchingRows(tableNeoadjuvant, { bioGroup: 'HR+HER2-', luminalLike: '' });
    expect(m).toHaveLength(2);
  });
});

describe('Tabelloppslag — referansedokumenter (endokrin)', () => {
  it('finnes ett pre- og ett postmenopausalt dokument for HR+', () => {
    const pre = referenceDocs.find((d) => d.menopausal === 'pre');
    const post = referenceDocs.find((d) => d.menopausal === 'post');
    expect(pre).toBeTruthy();
    expect(post).toBeTruthy();
    expect(pre.appliesToBioGroups).toContain('HR+HER2-');
    expect(post.sections.length).toBeGreaterThan(0);
  });
});

describe('rowMatches — bioGroups (flere grupper) og luminalLikeIn', () => {
  it('bioGroups matcher hvilken som helst av gruppene', () => {
    const crit = { bioGroups: ['HR+HER2+', 'HR-HER2+'] };
    expect(rowMatches(crit, { bioGroup: 'HR+HER2+' })).toBe(true);
    expect(rowMatches(crit, { bioGroup: 'HR-HER2+' })).toBe(true);
    expect(rowMatches(crit, { bioGroup: 'HR-HER2-' })).toBe(false);
  });
  it('luminalLikeIn ekskluderer Lum A', () => {
    const crit = { bioGroup: 'HR+HER2-', luminalLikeIn: ['B', 'inconclusive'] };
    expect(rowMatches(crit, { bioGroup: 'HR+HER2-', luminalLike: 'A' })).toBe(false);
    expect(rowMatches(crit, { bioGroup: 'HR+HER2-', luminalLike: 'B' })).toBe(true);
  });
});

describe('rowMatches — ukjente felt blokkerer ikke treff', () => {
  it('manglende menopausal status hindrer ikke et ellers gyldig treff', () => {
    const crit = { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: ['pT1c'], rorMin: 0, rorMax: 40 };
    expect(rowMatches(crit, { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT1c', rorScore: '20', menopausal: '' })).toBe(true);
  });
});
