/**
 * Tester for «Skriv journalnotat».
 *
 * To ting må holde. Det ene er brukerkravet: tekst legen har skrevet eller
 * endret skal ikke forsvinne fordi han krysser av noe annet. Det andre er
 * MDR-grensen: katalogen må være inert — den kan ikke kjenne pasienten, og
 * ingen behandlingsgruppe kan være forhåndsvalgt.
 */

import { describe, it, expect } from 'vitest';
import {
  addSentence,
  removeByOption,
  replaceGroupSelection,
  addFreeText,
  editBlock,
  removeBlock,
  moveBlock,
  hasOption,
  selectedOptionIds,
  joinBlocks,
} from '../src/notewriter/noteBlocks.js';
import { SENTENCE_GROUPS, ALL_OPTIONS, findOption, findGroup, SOURCE_LABELS } from '../src/notewriter/sentenceBank.js';

const chemo = findOption('kjemo-ec90-taxan');
const endo = findOption('endo-ai-5');
const bio = findOption('bio-hrpos-her2neg');

describe('noteBlocks — redigering overlever nye valg', () => {
  it('beholder en redigert setning når en annen krysses av', () => {
    let blocks = addSentence([], chemo);
    blocks = editBlock(blocks, blocks[0].key, 'Det gis EC90 ×4 → taxan, oppstart uke 40.');
    blocks = addSentence(blocks, endo);

    const edited = blocks.find((b) => b.optionId === chemo.id);
    expect(edited.text).toContain('uke 40');
    expect(edited.edited).toBe(true);
    expect(blocks).toHaveLength(2);
  });

  it('beholder fri tekst når setninger krysses av og av igjen', () => {
    let blocks = addFreeText([], 'Pasienten ønsker betenkningstid.');
    blocks = addSentence(blocks, chemo);
    blocks = removeByOption(blocks, chemo.id);
    blocks = addSentence(blocks, endo);

    const free = blocks.filter((b) => b.kind === 'free');
    expect(free).toHaveLength(1);
    expect(free[0].text).toBe('Pasienten ønsker betenkningstid.');
  });

  it('fri tekst fjernes aldri av removeByOption', () => {
    let blocks = addFreeText([], 'Egen merknad');
    blocks = removeByOption(blocks, undefined);
    expect(blocks).toHaveLength(1);
  });

  it('legger ikke inn samme setning to ganger', () => {
    let blocks = addSentence([], chemo);
    blocks = addSentence(blocks, chemo);
    expect(blocks).toHaveLength(1);
  });

  it('gir hver blokk en unik nøkkel, også to like fritekster', () => {
    let blocks = addFreeText([], 'samme');
    blocks = addFreeText(blocks, 'samme');
    expect(blocks[0].key).not.toBe(blocks[1].key);
  });
});

describe('noteBlocks — enkeltvalg og rekkefølge', () => {
  const group = findGroup('straling');
  const ids = group.options.map((o) => o.id);

  it('bytter ut forrige valg i en enkeltvalgsgruppe', () => {
    let blocks = replaceGroupSelection([], ids, group.options[0]);
    blocks = replaceGroupSelection(blocks, ids, group.options[1]);
    expect(selectedOptionIds(blocks)).toEqual([group.options[1].id]);
  });

  it('rører ikke andre gruppers setninger eller fri tekst', () => {
    let blocks = addSentence([], chemo);
    blocks = addFreeText(blocks, 'Egen tekst');
    blocks = replaceGroupSelection(blocks, ids, group.options[0]);
    blocks = replaceGroupSelection(blocks, ids, group.options[2]);

    expect(hasOption(blocks, chemo.id)).toBe(true);
    expect(blocks.some((b) => b.kind === 'free')).toBe(true);
  });

  it('moveBlock bytter plass og lar endene være i fred', () => {
    let blocks = addSentence(addSentence([], chemo), endo);
    const first = blocks[0].key;
    expect(moveBlock(blocks, first, 1)[1].key).toBe(first);
    expect(moveBlock(blocks, first, -1)).toBe(blocks);
  });

  it('removeBlock tar bort én blokk uten å røre resten', () => {
    let blocks = addSentence(addSentence([], chemo), endo);
    blocks = removeBlock(blocks, blocks[0].key);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].optionId).toBe(endo.id);
  });
});

describe('joinBlocks', () => {
  it('setter innledningen først', () => {
    const blocks = addSentence([], chemo);
    expect(joinBlocks(blocks, 'Postmenopausal pasient, 58 år.')).toMatch(/^Postmenopausal pasient, 58 år\./);
  });

  it('hopper over tomme blokker', () => {
    const blocks = addFreeText(addSentence([], chemo), '   ');
    expect(joinBlocks(blocks, '')).toBe(chemo.text);
  });

  it('gir tom streng når ingenting finnes', () => {
    expect(joinBlocks([], '')).toBe('');
  });
});

describe('setningsbanken er inert — MDR', () => {
  it('eksporterer ingen funksjon som tar imot pasientdata', async () => {
    const mod = await import('../src/notewriter/sentenceBank.js');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    // findOption/findGroup tar en id, ikke pasientdata
    expect(fns.map(([k]) => k).sort()).toEqual(['findGroup', 'findOption']);
    for (const [, fn] of fns) expect(fn.length).toBe(1);
  });

  it('ingen behandlingsgruppe er merket som transkripsjon', () => {
    const transcription = SENTENCE_GROUPS.filter((g) => g.transcription).map((g) => g.id);
    expect(transcription).toEqual(['biologi', 'intensjon']);
  });

  it('bare transkripsjonsgruppene har verdier som kan matche pasientdata', () => {
    for (const group of SENTENCE_GROUPS) {
      if (group.transcription) continue;
      for (const option of group.options) {
        expect(option.value).toBeUndefined();
      }
    }
  });

  it('ingen setning markerer seg selv som anbefalt', () => {
    for (const option of ALL_OPTIONS) {
      expect(option.label.toLowerCase()).not.toMatch(/anbefalt|førstevalg|1\. valg/);
      expect(option).not.toHaveProperty('recommended');
      expect(option).not.toHaveProperty('priority');
    }
  });
});

describe('setningsbanken — form og kilder', () => {
  it('hvert alternativ har id, label, tekst og kjent kilde', () => {
    for (const option of ALL_OPTIONS) {
      expect(option.id).toBeTruthy();
      expect(option.label).toBeTruthy();
      expect(option.text?.trim().length).toBeGreaterThan(10);
      expect(Object.keys(SOURCE_LABELS)).toContain(option.source);
    }
  });

  it('ingen id-er kolliderer', () => {
    const ids = ALL_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hver setning er en hel setning som slutter med punktum', () => {
    for (const option of ALL_OPTIONS) {
      expect(option.text.endsWith('.')).toBe(true);
    }
  });

  it('hver gruppe har overskrift og minst to alternativer', () => {
    for (const group of SENTENCE_GROUPS) {
      expect(group.heading).toBeTruthy();
      expect(['single', 'multi']).toContain(group.select);
      expect(group.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('prosedyretekst er merket som sådan og ikke som retningslinje', () => {
    const prosedyre = ALL_OPTIONS.filter((o) => o.source === 'prosedyre');
    expect(prosedyre.length).toBeGreaterThan(0);
    expect(SOURCE_LABELS.prosedyre).toContain('ikke NBCG-sitat');
  });

  it('findOption og findGroup finner det de skal, og null ellers', () => {
    expect(findOption('kjemo-ec90-taxan').groupId).toBe('kjemoterapi');
    expect(findOption('finnes-ikke')).toBeNull();
    expect(findGroup('kjemoterapi').options.length).toBeGreaterThan(0);
    expect(findGroup('finnes-ikke')).toBeNull();
  });
});
