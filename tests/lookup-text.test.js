/**
 * Tester for tekstsammensetningen i Tabelloppslag 1.1.
 *
 * Det som må holde: teksten er ordrett fra tabellene, den dekker alle
 * tabellene pasienten treffer i, og bare radene legen faktisk har krysset av
 * kommer med. Verktøyet skal ikke kunne skrive noe som ikke står i PDF-en.
 */

import { describe, it, expect } from 'vitest';
import {
  rowKey,
  formatRowBlock,
  buildLookupText,
  buildRecommendationsOnly,
  buildSources,
  buildFootnotes,
  defaultSelection,
} from '../src/tablelookup/lookupText.js';
import { findMatchingRows } from '../src/tablelookup/matcher.js';
import { tableNoGeneTest, tableGeneTest, tableCDK46 } from '../src/tablelookup/guidelineTables.js';

/** HR+HER2- LumB, pT2pN1, postmenopausal — treffer både primærtabell og CDK4/6. */
const INPUT = {
  bioGroup: 'HR+HER2-',
  luminalLike: 'B',
  tStage: 'pT2',
  tSimple: 'T2',
  nStage: 'pN1',
  menopausal: 'post',
};

function sectionsFor(input, tables = [tableNoGeneTest, tableCDK46]) {
  return tables.map((table) => ({ table, matches: findMatchingRows(table, input) }));
}

describe('defaultSelection', () => {
  it('krysser av alle treffende rader', () => {
    const sections = sectionsFor(INPUT);
    const selected = defaultSelection(sections);
    const total = sections.reduce((n, s) => n + s.matches.length, 0);
    expect(selected.size).toBe(total);
    expect(total).toBeGreaterThan(0);
  });

  it('tar ikke med rader som ikke treffer', () => {
    const sections = sectionsFor(INPUT);
    const selected = defaultSelection(sections);
    for (const { table, matches } of sections) {
      for (let i = 0; i < table.rows.length; i++) {
        expect(selected.has(rowKey(table.id, i))).toBe(matches.includes(i));
      }
    }
  });
});

describe('buildLookupText', () => {
  const sections = sectionsFor(INPUT);
  const selected = defaultSelection(sections);

  it('dekker alle tabellene pasienten treffer i', () => {
    const text = buildLookupText(sections, selected);
    expect(text).toContain(tableNoGeneTest.shortTitle);
    expect(text).toContain(tableCDK46.shortTitle);
  });

  it('tar med hver tabells egen kilde', () => {
    const text = buildLookupText(sections, selected);
    expect(text).toContain(tableNoGeneTest.source);
    expect(text).toContain(tableCDK46.source);
  });

  it('gjengir anbefalingscellene ordrett', () => {
    const text = buildLookupText(sections, selected);
    for (const { table, matches } of sections) {
      for (const i of matches) {
        for (const rc of table.recCols) {
          const cell = (table.rows[i].cells[rc.idx] || '').trim();
          if (cell) expect(text).toContain(cell);
        }
      }
    }
  });

  it('utelater rader legen har fjernet', () => {
    const [primary] = sections;
    const dropped = rowKey(primary.table.id, primary.matches[0]);
    const reduced = new Set(selected);
    reduced.delete(dropped);

    const before = buildLookupText(sections, selected);
    const after = buildLookupText(sections, reduced);
    expect(after.length).toBeLessThan(before.length);
    expect(after).not.toContain(primary.table.shortTitle);
    expect(after).toContain(tableCDK46.shortTitle);
  });

  it('gir tom streng når ingenting er valgt', () => {
    expect(buildLookupText(sections, new Set())).toBe('');
  });

  it('kan utelate grunnlag og kilde', () => {
    const text = buildLookupText(sections, selected, { includeRationale: false, includeSource: false });
    expect(text).not.toContain('Kilde:');
    expect(text).not.toContain('Grunnlag for eventuelt annet terapivalg');
  });
});

describe('formatRowBlock', () => {
  it('starter med tabellnavn og oppslagsvei', () => {
    const idx = findMatchingRows(tableCDK46, INPUT)[0];
    const block = formatRowBlock(tableCDK46.rows[idx], tableCDK46);
    expect(block.split('\n')[0]).toContain(tableCDK46.shortTitle);
    expect(block.split('\n')[0]).toContain('T2N1');
  });

  it('prefikser navngitte anbefalingskolonner', () => {
    const idx = findMatchingRows(tableCDK46, INPUT)[0];
    const block = formatRowBlock(tableCDK46.rows[idx], tableCDK46);
    expect(block).toContain('Ribociklib:');
    expect(block).toContain('Abemaciklib:');
  });
});

describe('buildRecommendationsOnly / buildSources / buildFootnotes', () => {
  const sections = sectionsFor(INPUT);
  const selected = defaultSelection(sections);

  it('anbefalingene alene inneholder ingen kilde eller oppslagsvei', () => {
    const text = buildRecommendationsOnly(sections, selected);
    expect(text).not.toContain('Kilde:');
    expect(text).not.toContain(tableCDK46.shortTitle);
    expect(text.length).toBeGreaterThan(0);
  });

  it('kilder gjentas ikke', () => {
    const sources = buildSources(sections, selected).split('\n').filter(Boolean);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('fotnoter hentes bare fra tabeller med valgt rad', () => {
    const notes = buildFootnotes(sections, selected);
    expect(notes).toContain(tableCDK46.footnotes[0]);
    expect(buildFootnotes(sections, new Set())).toBe('');
  });
});

describe('flere tabeller samtidig', () => {
  it('gentest-pasienten treffer primærtabellen for gentest', () => {
    const input = {
      bioGroup: 'HR+HER2-',
      geneTest: 'prosigna',
      nStage: 'pN0',
      tStage: 'pT1a',
      tSimple: 'T1',
      rorScore: '20',
    };
    const sections = sectionsFor(input, [tableGeneTest, tableCDK46]);
    const selected = defaultSelection(sections);
    const text = buildLookupText(sections, selected);
    expect(text).toContain(tableGeneTest.shortTitle);
    expect(text).toContain(tableGeneTest.source);
  });
});

// ================================================================
//  Ordnet utvalg (versjon 1.1)
// ================================================================

import {
  pickKey,
  hasPick,
  formatFootnoteBlock,
  buildPickedText,
  describePick,
  movePick,
} from '../src/tablelookup/lookupText.js';
import { guidelineTables } from '../src/tablelookup/guidelineTables.js';

describe('buildPickedText — legen bestemmer innhold og rekkefølge', () => {
  const rowA = { kind: 'row', tableId: 'nogenetest', index: 13 };
  const rowB = { kind: 'row', tableId: 'cdk46', index: 4 };
  const note = { kind: 'footnote', tableId: 'nogenetest', index: 0 };

  it('gir tom tekst når ingenting er lagt til', () => {
    expect(buildPickedText([], guidelineTables)).toBe('');
  });

  it('følger legens rekkefølge, ikke tabellenes', () => {
    const forward = buildPickedText([rowA, rowB], guidelineTables);
    const reversed = buildPickedText([rowB, rowA], guidelineTables);
    expect(forward).not.toBe(reversed);
    expect(forward.indexOf('Genekspresjonstest ikke utført')).toBeLessThan(forward.indexOf('CDK4/6-hemmer'));
    expect(reversed.indexOf('CDK4/6-hemmer')).toBeLessThan(reversed.indexOf('Genekspresjonstest ikke utført'));
  });

  it('lar fotnoter flettes inn mellom rader', () => {
    const text = buildPickedText([rowA, note, rowB], guidelineTables);
    const noteAt = text.indexOf('Fotnote —');
    expect(noteAt).toBeGreaterThan(text.indexOf('Genekspresjonstest ikke utført —'));
    expect(noteAt).toBeLessThan(text.indexOf('CDK4/6-hemmer'));
  });

  it('tar bare med det som faktisk er lagt til', () => {
    const text = buildPickedText([rowB], guidelineTables);
    expect(text).toContain('CDK4/6-hemmer');
    expect(text).not.toContain('Genekspresjonstest ikke utført');
  });

  it('hopper over ukjente tabeller og rader i stedet for å krasje', () => {
    expect(buildPickedText([{ kind: 'row', tableId: 'finnesikke', index: 0 }], guidelineTables)).toBe('');
    expect(buildPickedText([{ kind: 'row', tableId: 'cdk46', index: 999 }], guidelineTables)).toBe('');
    expect(buildPickedText([{ kind: 'footnote', tableId: 'cdk46', index: 99 }], guidelineTables)).toBe('');
  });

  it('gjengir fotnoten ordrett og merker hvilken tabell den hører til', () => {
    const table = guidelineTables.find((t) => t.id === 'nogenetest');
    const block = formatFootnoteBlock(table, 0);
    expect(block).toContain(table.footnotes[0]);
    expect(block).toContain(table.shortTitle);
    expect(block).toContain(`rev. ${table.revision}`);
  });
});

describe('hjelpere for plukklisten', () => {
  it('hasPick kjenner igjen det som alt er lagt til', () => {
    const picks = [{ kind: 'row', tableId: 'cdk46', index: 4 }];
    expect(hasPick(picks, 'row', 'cdk46', 4)).toBe(true);
    expect(hasPick(picks, 'footnote', 'cdk46', 4)).toBe(false);
    expect(hasPick(picks, 'row', 'cdk46', 5)).toBe(false);
  });

  it('pickKey skiller rad og fotnote med samme indeks', () => {
    expect(pickKey({ kind: 'row', tableId: 'cdk46', index: 0 }))
      .not.toBe(pickKey({ kind: 'footnote', tableId: 'cdk46', index: 0 }));
  });

  it('describePick gir en lesbar etikett for begge typer', () => {
    expect(describePick({ kind: 'row', tableId: 'cdk46', index: 4 }, guidelineTables)).toContain('T2N1');
    expect(describePick({ kind: 'footnote', tableId: 'cdk46', index: 0 }, guidelineTables)).toMatch(/^Fotnote/);
  });

  it('movePick bytter plass og lar endene være i fred', () => {
    const picks = [{ kind: 'row', tableId: 'a', index: 0 }, { kind: 'row', tableId: 'b', index: 1 }];
    expect(movePick(picks, 0, 1)[0].tableId).toBe('b');
    expect(movePick(picks, 0, -1)).toBe(picks);
    expect(movePick(picks, 1, 1)).toBe(picks);
  });
});

describe('fotnotene er ordrett NBCG-tekst', () => {
  it('ingen app-forfattet merknad ligger i footnotes', () => {
    for (const table of guidelineTables) {
      for (const note of table.footnotes) {
        expect(note).not.toContain('verktøyet');
        expect(note).not.toContain('Tabellen er en tilleggsvurdering');
      }
      // Den redaksjonelle merknaden skal ligge i sitt eget felt, ikke blant fotnotene
      if (table.appNote) expect(table.footnotes).not.toContain(table.appNote);
    }
  });

  it('hver tabell oppgir sin egen revisjon strukturert', () => {
    for (const table of guidelineTables) {
      expect(table.revision).toBeTruthy();
      expect(table.source).toContain(table.revision);
    }
  });
});
