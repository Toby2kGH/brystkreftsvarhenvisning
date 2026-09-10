/**
 * Tester for tre-tilstands klassifisering i Tabelloppslag 2.0.
 *
 * Det kritiske skillet: en rad skal først forsvinne fra listen når
 * opplysningene faktisk motsier den — ikke når klinikeren ennå ikke har fylt
 * ut feltet. Og klassifiseringen må aldri si noe annet enn matcheren som
 * Tabelloppslag-fanen bruker.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyGuidelineRow,
  classifyTable,
  countByStatus,
  MATCH,
  UNKNOWN,
  EXCLUDED,
} from '../src/tablelookup/rowStatus.js';
import { rowMatches } from '../src/tablelookup/matcher.js';
import { tableGeneTest, tableNoGeneTest, tableCDK46 } from '../src/tablelookup/guidelineTables.js';
import { toLookupInput } from '../src/tablelookup/patientInput.js';

describe('classifyGuidelineRow — grunntilfeller', () => {
  const crit = { bioGroup: 'HR+HER2-', nStage: ['pN1'] };

  it('gir match når alle kriterier er oppfylt', () => {
    const r = classifyGuidelineRow(crit, { bioGroup: 'HR+HER2-', nStage: 'pN1' });
    expect(r.status).toBe(MATCH);
    expect(r.unknownKeys).toEqual([]);
  });

  it('gir unknown og navngir feltet som mangler', () => {
    const r = classifyGuidelineRow(crit, { bioGroup: 'HR+HER2-' });
    expect(r.status).toBe(UNKNOWN);
    expect(r.unknownKeys).toEqual(['nStage']);
  });

  it('gir excluded når et kriterium er sikkert brutt', () => {
    expect(classifyGuidelineRow(crit, { bioGroup: 'HR-HER2-', nStage: 'pN1' }).status).toBe(EXCLUDED);
  });

  it('lar sikker bom veie tyngre enn manglende data', () => {
    expect(classifyGuidelineRow(crit, { bioGroup: 'HR-HER2-' }).status).toBe(EXCLUDED);
  });

  it('behandler tom streng som ikke utfylt', () => {
    expect(classifyGuidelineRow(crit, { bioGroup: '', nStage: '' }).status).toBe(UNKNOWN);
  });

  it('gir match for rad uten kriterier', () => {
    expect(classifyGuidelineRow({}, {}).status).toBe(MATCH);
  });
});

describe('classifyGuidelineRow — kriterietyper', () => {
  it('array er disjunksjon', () => {
    const crit = { nStage: ['pN1', 'pN2'] };
    expect(classifyGuidelineRow(crit, { nStage: 'pN2' }).status).toBe(MATCH);
    expect(classifyGuidelineRow(crit, { nStage: 'pN3' }).status).toBe(EXCLUDED);
  });

  it('numeriske grenser sammenlignes som tall', () => {
    const crit = { rorMin: 41, rorMax: 60 };
    expect(classifyGuidelineRow(crit, { rorScore: '41' }).status).toBe(MATCH);
    expect(classifyGuidelineRow(crit, { rorScore: '61' }).status).toBe(EXCLUDED);
    expect(classifyGuidelineRow(crit, {}).status).toBe(UNKNOWN);
  });

  it('grad leses som tall', () => {
    const crit = { grade: [1, 2] };
    expect(classifyGuidelineRow(crit, { grade: '2' }).status).toBe(MATCH);
    expect(classifyGuidelineRow(crit, { grade: '3' }).status).toBe(EXCLUDED);
  });

  it('anyOf er ubestemt først når ingen gren kan avgjøres', () => {
    const crit = {
      bioGroup: 'HR+HER2-',
      anyOf: [
        { nStage: ['pN0'], tStage: ['pT1c'], grade: [2] },
        { nStage: ['pN0'], tStage: ['pT2'], grade: [1] },
      ],
    };
    // Ingen gren har fullstendige data → ubestemt
    expect(classifyGuidelineRow(crit, { bioGroup: 'HR+HER2-' }).status).toBe(UNKNOWN);
    // Én gren er fullt bestemt og treffer → match, ikke ubestemt
    const decided = classifyGuidelineRow(crit, {
      bioGroup: 'HR+HER2-', nStage: 'pN0', tStage: 'pT2', grade: '1',
    });
    expect(decided.status).toBe(MATCH);
    expect(decided.unknownKeys).toEqual([]);
  });
});

describe('classifyTable', () => {
  const input = { bioGroup: 'HR+HER2-', tSimple: 'T2', nStage: 'pN1' };

  it('sorterer treff først, så mulige, så utelukkede', () => {
    const rows = classifyTable(tableCDK46, input);
    const order = rows.map((r) => r.status);
    const lastMatch = order.lastIndexOf(MATCH);
    const firstExcluded = order.indexOf(EXCLUDED);
    expect(rows).toHaveLength(tableCDK46.rows.length);
    if (lastMatch !== -1 && firstExcluded !== -1) expect(lastMatch).toBeLessThan(firstExcluded);
  });

  it('beholder tabellens egen rekkefølge innenfor hver status', () => {
    const matched = classifyTable(tableCDK46, input)
      .filter((r) => r.status === MATCH)
      .map((r) => r.index);
    expect(matched).toEqual([...matched].sort((a, b) => a - b));
  });

  it('gir tom liste for manglende tabell', () => {
    expect(classifyTable(null, {})).toEqual([]);
    expect(classifyTable({}, {})).toEqual([]);
  });

  it('utelukker ingenting når ingenting er oppgitt', () => {
    const counts = countByStatus(classifyTable(tableCDK46, {}));
    expect(counts[EXCLUDED]).toBe(0);
    expect(counts[UNKNOWN]).toBe(tableCDK46.rows.length);
  });

  it('snevrer inn etter hvert som opplysninger fylles ut', () => {
    const before = countByStatus(classifyTable(tableNoGeneTest, {}));
    const after = countByStatus(classifyTable(tableNoGeneTest, { bioGroup: 'HR-HER2-', nStage: 'pN0', tStage: 'pT2' }));
    expect(before[EXCLUDED]).toBe(0);
    expect(after[EXCLUDED]).toBeGreaterThan(0);
  });
});

describe('samsvar med matcher.js', () => {
  const cases = [
    { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: 'pN0', tStage: 'pT1a', rorScore: '20' },
    { bioGroup: 'HR+HER2-', geneTest: 'oncotypedx', menopausal: 'post', nStage: 'pN1', rsScore: '30' },
    { bioGroup: 'HR-HER2-', nStage: 'pN0', tStage: 'pT2', grade: '3' },
    { bioGroup: 'HR+HER2-', tSimple: 'T2', nStage: 'pN1' },
  ];

  it('match er identisk med rowMatches når ingenting er ubestemt', () => {
    for (const table of [tableGeneTest, tableNoGeneTest, tableCDK46]) {
      for (const input of cases) {
        for (const row of table.rows) {
          const { status, unknownKeys } = classifyGuidelineRow(row.crit, input);
          if (unknownKeys.length === 0) {
            expect(status === MATCH).toBe(rowMatches(row.crit, input));
          }
        }
      }
    }
  });

  it('en rad matcheren treffer blir aldri utelukket', () => {
    for (const table of [tableGeneTest, tableNoGeneTest, tableCDK46]) {
      for (const input of cases) {
        for (const row of table.rows) {
          if (rowMatches(row.crit, input)) {
            expect(classifyGuidelineRow(row.crit, input).status).not.toBe(EXCLUDED);
          }
        }
      }
    }
  });
});

describe('toLookupInput — oversettelse fra pasientskjemaet', () => {
  const blank = {
    nStage: '', menopausalStatus: '', geneTest: '', prosignaSubtype: '',
    erPercent: '', ki67: '', grade: '', rorScore: '', rsScore: '', tStageOverride: '',
  };

  it('oversetter trippel negativ til tabellenes hovedgruppe', () => {
    const { input } = toLookupInput(blank, { bioGroup: 'TN' });
    expect(input.bioGroup).toBe('HR-HER2-');
  });

  it('gir T- og N-stadium patologisk form', () => {
    const { input } = toLookupInput({ ...blank, nStage: 'N2' }, { bioGroup: 'HR+HER2-', tStage: 'T1c' });
    expect(input.tStage).toBe('pT1c');
    expect(input.tSimple).toBe('T1');
    expect(input.nStage).toBe('pN2');
  });

  it('lar N1mi stå uoversatt slik at oppslaget ikke avgrenses feil', () => {
    const { input } = toLookupInput({ ...blank, nStage: 'N1mi' }, { bioGroup: 'HR+HER2-' });
    expect(input.nStage).toBe('');
  });

  it('lar manuell hovedgruppe overstyre den utledede', () => {
    const { input, derivedBioGroup } = toLookupInput(blank, { bioGroup: 'TN' }, { bioGroup: 'HR+HER2-' });
    expect(input.bioGroup).toBe('HR+HER2-');
    expect(derivedBioGroup).toBe('HR-HER2-');
  });

  it('tåler at regelmotoren ikke ga noe resultat', () => {
    const { input } = toLookupInput(blank, null);
    expect(input.bioGroup).toBe('');
    expect(input.tStage).toBe('');
  });
});
