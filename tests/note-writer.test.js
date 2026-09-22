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
import { SENTENCE_GROUPS, ALL_OPTIONS, findOption, findGroup, previewText, SOURCE_LABELS } from '../src/notewriter/sentenceBank.js';

const chemo = findOption('kjemo-ec90-taxan');
const endo = findOption('endo-ai-5');

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
    expect(joinBlocks(blocks, '')).toBe(chemo.core);
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
    expect(fns.map(([k]) => k).sort()).toEqual(['findGroup', 'findOption', 'previewText']);
  });

  it('ingen gruppe kan matche pasientdata — menyen er uavhengig av pasienten', () => {
    for (const group of SENTENCE_GROUPS) {
      expect(group.transcription).toBeUndefined();
      for (const option of group.options) expect(option.value).toBeUndefined();
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
      // «TC ×6» er en legitim, kort kjerne
      expect((option.sentence ?? option.core ?? option.text ?? '').trim().length).toBeGreaterThanOrEqual(5);
      expect(Object.keys(SOURCE_LABELS)).toContain(option.source);
    }
  });

  it('ingen id-er kolliderer', () => {
    const ids = ALL_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hele setninger slutter med punktum; indikasjoner er tekstbiter uten', () => {
    for (const option of ALL_OPTIONS) {
      if (option.sentence) expect(option.sentence.endsWith('.')).toBe(true);
      else if (option.groupKind === 'setning') expect(option.text.endsWith('.')).toBe(true);
      else expect(option.core.endsWith('.')).toBe(false);
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

// ================================================================
//  Registeret — svar på henvisning, ikke behandlingsnotat
// ================================================================

import { buildOpening, buildTreatmentSection } from '../src/notewriter/referralText.js';

const PATIENT = {
  bioGroup: 'HR+HER2-', intent: 'adjuvant', tStage: 'pT2', nStage: 'pN1',
  menopausal: 'post', age: '58', erPercent: '90', prPercent: '60',
  her2: 'IHC 0', ki67: '40', grade: '3', geneTest: 'none',
};

const itemsFor = (ids) => ids.map((id) => {
  const o = findOption(id);
  return { core: o.core, groupId: o.groupId, lead: o.groupLead, listPrefix: o.listPrefix };
});

describe('buildOpening — som den opprinnelige malen', () => {
  it('starter med Diagnose og diagnosekode', () => {
    expect(buildOpening(PATIENT)).toMatch(/^Diagnose: C50\.9 Ca mammae/);
  });

  it('legger til C77.9 ved lymfeknutemetastase, men ikke ved pN0', () => {
    expect(buildOpening(PATIENT)).toContain('C77.9 Lymfeknutemetastase');
    expect(buildOpening({ ...PATIENT, nStage: 'pN0' })).not.toContain('C77.9');
  });

  it('skriver stadium, reseptorstatus og HER2 slik originalen gjør', () => {
    const text = buildOpening(PATIENT);
    expect(text).toContain('pT2pN1');
    expect(text).toContain('ER+ (90%) og PR+ (60%)');
    expect(text).toContain('HER2 Neg (IHC 0)');
  });

  it('tar med grad og Ki-67', () => {
    const text = buildOpening(PATIENT);
    expect(text).toContain('grad 3');
    expect(text).toContain('Ki-67 40%');
  });

  it('avslutter med alder, kjønn og menopausal status', () => {
    expect(buildOpening(PATIENT)).toMatch(/hos en 58 år gammel kvinne med sikker postmenopausal status\.$/);
  });

  it('gjengir gentest med score når den er oppgitt', () => {
    expect(buildOpening({ ...PATIENT, geneTest: 'prosigna', geneScore: '55' })).toContain('Prosigna ROR-score 55');
    expect(buildOpening(PATIENT)).toContain('genekspresjonstest ikke utført');
  });

  it('utelater felter som ikke er fylt ut', () => {
    const sparse = buildOpening({ bioGroup: 'HR-HER2-', nStage: 'pN0' });
    expect(sparse).not.toContain('undefined');
    expect(sparse).not.toMatch(/grad|Ki-67|år gammel/);
  });

  it('skriver ER- og PR- for trippel negativ', () => {
    expect(buildOpening({ ...PATIENT, bioGroup: 'HR-HER2-' })).toContain('ER- og PR-');
  });
});

describe('buildTreatmentSection — to oppsett', () => {
  const items = itemsFor(['kjemo-ec90-taxan', 'endo-ai-5', 'str-bryst-regional']);

  it('bruker «indikasjon for», ikke «det gis»', () => {
    for (const mode of ['samlet', 'perGruppe']) {
      const text = buildTreatmentSection(items, 'adjuvant', mode).join('\n');
      expect(text).toContain('indikasjon for');
      expect(text).not.toMatch(/\bDet gis\b/);
    }
  });

  it('skriver «I henhold til», ikke «Ihht»', () => {
    const text = buildTreatmentSection(items, 'adjuvant', 'samlet')[0];
    expect(text).toContain('I henhold til retningslinjer');
    expect(text).not.toContain('Ihht');
  });

  it('samlet: én nummerert liste under én ledetekst', () => {
    const [text] = buildTreatmentSection(items, 'adjuvant', 'samlet');
    expect(text).toContain('indikasjon for adjuvant behandling:');
    expect(text).toContain('\n1. ');
    expect(text).toContain('\n2. ');
    expect(text).toContain('\n3. ');
  });

  it('samlet: punkter starter med stor forbokstav, og forkortelser beholdes', () => {
    const [text] = buildTreatmentSection(items, 'adjuvant', 'samlet');
    expect(text).toContain('1. EC90 ×4 etterfulgt av taxan.');
    expect(text).toContain('2. Aromatasehemmer');
  });

  it('samlet: strålebehandling mister ikke sitt eget ord i listeform', () => {
    const [text] = buildTreatmentSection(items, 'adjuvant', 'samlet');
    expect(text).toMatch(/\d\. Strålebehandling mot hele brystet og regionale lymfeknuter\./);
  });

  it('perGruppe: én setning per gruppe med gruppens egen ledetekst', () => {
    const sections = buildTreatmentSection(items, 'adjuvant', 'perGruppe');
    expect(sections).toHaveLength(3);
    expect(sections[0]).toBe('I henhold til retningslinjer er det indikasjon for adjuvant behandling med EC90 ×4 etterfulgt av taxan.');
    expect(sections[1]).toContain('Videre indikasjon for adjuvant endokrin behandling:');
    expect(sections[2]).toContain('Det er indikasjon for postoperativ strålebehandling mot');
  });

  it('perGruppe: samler flere valg fra samme gruppe i én setning', () => {
    const two = itemsFor(['kjemo-ec90-taxan', 'kjemo-tc6']);
    expect(buildTreatmentSection(two, 'adjuvant', 'perGruppe')).toHaveLength(1);
  });

  it('bytter ledeteksten til neoadjuvant når intensjonen er det', () => {
    const text = buildTreatmentSection(items, 'neoadjuvant', 'samlet')[0];
    expect(text).toContain('indikasjon for neoadjuvant behandling:');
  });

  it('gir tomt avsnitt når ingenting er valgt', () => {
    expect(buildTreatmentSection([], 'adjuvant', 'samlet')).toEqual([]);
    expect(buildTreatmentSection([], 'adjuvant', 'perGruppe')).toEqual([]);
  });
});

describe('previewText — det menyen viser er det svaret faktisk får', () => {
  it('virker for rå alternativer fra group.options, slik komponenten bruker dem', () => {
    // Denne feilen slapp gjennom én gang: komponenten itererer group.options,
    // som mangler groupKind/groupLead, og forhåndsvisningen ble «undefined.»
    for (const group of SENTENCE_GROUPS) {
      for (const option of group.options) {
        const text = previewText(option, 'adjuvant', group);
        expect(text).toBeTruthy();
        expect(text).not.toContain('undefined');
        expect(text.endsWith('.')).toBe(true);
      }
    }
  });

  it('viser hele setninger uendret', () => {
    const group = findGroup('utredning');
    expect(previewText(group.options[0], 'adjuvant', group)).toBe('Det bestilles MR mamma og metastasescreening.');
  });

  it('setter gruppens ledetekst foran indikasjoner', () => {
    const group = findGroup('endokrin');
    expect(previewText(group.options[0], 'adjuvant', group))
      .toBe('Videre indikasjon for adjuvant endokrin behandling: aromatasehemmer (letrozol/anastrozol) i 5 år.');
  });

  it('følger behandlingsintensjonen', () => {
    const group = findGroup('kjemoterapi');
    expect(previewText(group.options[0], 'neoadjuvant', group)).toContain('neoadjuvant behandling med');
  });

  it('virker også for berikede alternativer uten gruppe', () => {
    expect(previewText(findOption('utr-mr'))).toBe('Det bestilles MR mamma og metastasescreening.');
    expect(previewText(findOption('kjemo-ec90'), 'adjuvant')).toContain('indikasjon for adjuvant behandling med EC90 ×4.');
  });

  it('tåler tomt alternativ', () => {
    expect(previewText(null)).toBe('');
    expect(previewText(undefined, 'adjuvant')).toBe('');
  });
});

describe('negasjoner får sin egen setning', () => {
  const negations = ALL_OPTIONS.filter((o) => o.sentence);

  it('finnes, og bærer aldri en bekreftende ledetekst', () => {
    expect(negations.length).toBeGreaterThanOrEqual(6);
    for (const option of negations) {
      const text = previewText(option, 'adjuvant');
      // Feilen var en bekreftende ledetekst rett foran negasjonen — «for ikke
      // kjemoterapi», «mot ingen områder». «Det er ikke indikasjon for …» er riktig.
      expect(text).not.toContain('mot ingen områder');
      expect(text).not.toContain('i form av ikke');
      expect(text).not.toContain('behandling med ikke');
    }
  });

  it('formuleres som «Det er ikke indikasjon for …»', () => {
    expect(previewText(findOption('kjemo-ingen'))).toBe('Det er ikke indikasjon for kjemoterapi.');
    expect(previewText(findOption('str-ingen'))).toBe('Det er ikke indikasjon for postoperativ strålebehandling.');
  });

  it('står som eget punkt i den nummererte listen', () => {
    const items = [findOption('kjemo-ec90-taxan'), findOption('str-ingen')].map((o) => ({
      core: o.core, sentence: o.sentence, groupId: o.groupId, lead: o.groupLead, listPrefix: o.listPrefix,
    }));
    const [text] = buildTreatmentSection(items, 'adjuvant', 'samlet');
    expect(text).toContain('1. EC90 ×4 etterfulgt av taxan.');
    expect(text).toContain('2. Det er ikke indikasjon for postoperativ strålebehandling.');
  });

  it('slås ikke sammen med gruppen i per-gruppe-oppsettet', () => {
    const items = [findOption('endo-ai-5'), findOption('endo-ingen')].map((o) => ({
      core: o.core, sentence: o.sentence, groupId: o.groupId, lead: o.groupLead,
    }));
    const sections = buildTreatmentSection(items, 'adjuvant', 'perGruppe');
    expect(sections).toHaveLength(2);
    expect(sections[1]).toBe('Det er ikke indikasjon for endokrin behandling, da tumor ikke er hormonreseptorpositiv.');
  });
});

describe('ingen forhåndsvisning er ugrammatisk', () => {
  it('hele katalogen leser som norsk', () => {
    for (const group of SENTENCE_GROUPS) {
      for (const option of group.options) {
        const text = previewText(option, 'adjuvant', group);
        expect(text).not.toMatch(/\b(med|for|av|mot|:)\s+ikke\s/);
        expect(text).not.toMatch(/\bmot ingen\b/);
        expect(text).not.toMatch(/\s{2,}/);
        expect(text).not.toMatch(/\.\./);
      }
    }
  });
});

describe('«Videre» forutsetter at noe kom før', () => {
  const mk = (ids) => ids.map((id) => {
    const o = findOption(id);
    return { core: o.core, sentence: o.sentence, groupId: o.groupId,
             lead: o.groupLead, firstLead: o.groupFirstLead, listPrefix: o.listPrefix };
  });

  it('åpner aldri svaret med «Videre»', () => {
    for (const id of ['immun-keynote-neo', 'her2-trastuzumab', 'endo-ai-5']) {
      const [first] = buildTreatmentSection(mk([id]), 'adjuvant', 'perGruppe');
      expect(first.startsWith('Videre')).toBe(false);
      expect(first).toMatch(/^I henhold til retningslinjer/);
    }
  });

  it('beholder «Videre» når gruppen ikke står først', () => {
    const sections = buildTreatmentSection(mk(['kjemo-ec90-taxan', 'endo-ai-5']), 'adjuvant', 'perGruppe');
    expect(sections[0]).toMatch(/^I henhold til retningslinjer/);
    expect(sections[1]).toMatch(/^Videre indikasjon for/);
  });

  it('gjelder ikke grupper som alltid åpner med «Det er indikasjon for»', () => {
    const [first] = buildTreatmentSection(mk(['cdk-abema']), 'adjuvant', 'perGruppe');
    expect(first).toMatch(/^Det er indikasjon for CDK4\/6-hemmer/);
  });
});
