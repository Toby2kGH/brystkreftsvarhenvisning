// ============================================================
//  Tabelloppslag — digitaliserte anbefalingstabeller (verbatim)
// ============================================================
//
//  Dette er en ORDRETT digitalisering av de to vedlagte NBCG-
//  tabell-PDF-ene. Modulen brukes KUN av det nye "Tabelloppslag"-
//  verktøyet (fanen "Tabelloppslag"). Den endrer ingenting i det
//  eksisterende beslutningstre- / beslutningstabell-verktøyet.
//
//  Hensikten er IKKE å gi en algoritmisk anbefaling, men å vise
//  hvor i de offisielle tabellene pasienten hører hjemme (highlighte
//  riktig rad) og tilby den ordrette tabellteksten som utgangspunkt
//  for journaltekst. All tolkning og endelig vurdering gjøres av
//  klinikeren mot gjeldende handlingsprogram.
//
//  Hver rad har en `crit`-blokk (strukturerte kriterier) som
//  matcheren i matcher.js bruker for å avgjøre om raden passer
//  pasientens input. Tekstcellene (`cells`) er ordrette fra PDF.
// ============================================================

// ----------------------------------------------------------------
//  Hjelpere for T-/N-grupperinger (brukes i crit-blokkene)
// ----------------------------------------------------------------
export const T_VALUES = ['pT1a', 'pT1b', 'pT1c', 'pT2', 'pT3', 'pT4'];
export const N_VALUES = ['pN0', 'pN1', 'pN2', 'pN3'];

const T1ab = ['pT1a', 'pT1b'];
const T1c = ['pT1c'];
const T2 = ['pT2'];
const T1abc = ['pT1a', 'pT1b', 'pT1c'];
const T1cT2 = ['pT1c', 'pT2'];
const T12 = ['pT1a', 'pT1b', 'pT1c', 'pT2'];

// ================================================================
//  TABELL 1 — Genekspresjonstest foreligger
//  Kilde: "Anbefalinger for primæropererte pasienter med HR+HER2-
//  pT1-2pN0 status eller postmenopausale pasienter med pT1-2pN1
//  status hvor svar på anbefalt genekspresjonstest foreligger"
//  (tabellaris.12.24)
// ================================================================

const ER_NOTE_LUMA =
  'ER ekspresjonen vil nesten alltid være høy for LumA subtype. Dersom denne likevel er lav, vurder behandlingsalgoritme for «LumB ROR Intermediate»';

export const tableGeneTest = {
  id: 'genetest',
  title:
    'Anbefalinger for primæropererte pasienter med HR+HER2- pT1-2pN0 status eller postmenopausale pasienter med pT1-2pN1 status hvor svar på anbefalt genekspresjonstest foreligger',
  shortTitle: 'Genekspresjonstest foreligger',
  source: 'NBCG Handlingsprogram — tabell «genekspresjonstest foreligger» (rev. 12.24)',
  revision: '12.24',
  // Hvilken type tabell: 'primary' = hovedoppslag, 'addon' = tilleggsbehandling
  kind: 'primary',
  // Antall venstre-kolonner som kan slås sammen (rowSpan): gruppe, N-status, genekspresjonstest
  mergeCount: 3,
  // Kolonner som utgjør anbefalings-/journaltekst (resten av ikke-merge-kolonnene
  // regnes som «grunnlag/utdyping» og vises dempet).
  recCols: [{ idx: 4 }],
  columns: [
    'Hoved-gruppe',
    'N status',
    'Genekspresjonstest*',
    'Ytterligere subgruppering',
    'Generell terapi-anbefaling**',
    'Grunnlag for eventuell vurdering av annet terapi-valg (eskalering eller de-eskalering)**',
  ],
  rows: [
    // ---- pN0 · Prosigna Luminal A · ROR 0-40 ----
    {
      cells: ['HR+\nHER2-', 'pN0', 'Prosigna\nLuminal A\nROR score 0-40', 'pT1a-b', 'Ingen behandling', ''],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T1ab, rorMin: 0, rorMax: 40 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal A\nROR score 0-40',
        'pT1c',
        'Grad 1: Ingen behandling\nGrad 2-3: Endokrin behandling\nZoledronsyre ved postmenopausal status',
        ER_NOTE_LUMA,
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T1c, rorMin: 0, rorMax: 40 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal A\nROR score 0-40',
        'pT2',
        'Endokrin behandling\nZoledronsyre ved postmenopausal status',
        ER_NOTE_LUMA,
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T2, rorMin: 0, rorMax: 40 },
    },

    // ---- pN0 · Prosigna Luminal A · ROR 41-60 ----
    {
      cells: ['HR+\nHER2-', 'pN0', 'Prosigna\nLuminal A**\nROR score 41-60', 'pT1a-b', 'Ingen behandling', ''],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumA', nStage: ['pN0'], tStage: T1ab, rorMin: 41, rorMax: 60 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal A**\nROR score 41-60',
        'pT1c',
        'Endokrin behandling\nZoledronsyre ved postmenopausal status',
        ER_NOTE_LUMA,
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumA', nStage: ['pN0'], tStage: T1c, rorMin: 41, rorMax: 60 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal A**\nROR score 41-60',
        'pT2',
        'Premenopausal: EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling. Endokrin behandling som inkluderer goserelin kan vurderes som alternativ til kjemoterapi.***\nPostmenopausal: Endokrin behandling og zoledronsyre',
        'Ved postmenopausal status: EC90 x 4 eller TC x 4 → endokrin behandling kan vurderes ved kombinasjonen av histologisk grad 3, høy absolutt ROR score og stor tumorstørrelse innenfor kategorien',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumA', nStage: ['pN0'], tStage: T2, rorMin: 41, rorMax: 60 },
    },

    // ---- pN0 · Prosigna Luminal B · ROR 41-60 ----
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal B**\nROR score 41-60',
        'pT1a-b',
        'ER≥50%: Endokrin behandling\nER<50%: Vurder EC90 x 4 eller TC x 4 → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Individuell vurdering av grunnlag for systembehandling kan gjøres ved pT1a pN0 tumores',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumB', nStage: ['pN0'], tStage: T1ab, rorMin: 41, rorMax: 60 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal B**\nROR score 41-60',
        'pT1c',
        'ER≥50%: Premenopausal: EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling. Endokrin behandling som inkluderer goserelin kan vurderes som alternativ til kjemoterapi.***\nPostmenopausal: Endokrin behandling og zoledronsyre\nER<50%: EC90 x 4 eller TC x 4 → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Ved ER<50%: EC90 x 4 → taxan → endokrin behandling kan vurderes ved kombinasjonen av histologisk grad 3 og høy absolutt ROR score innenfor kategorien eller ved svært lav ER ekspresjon. TC x 6 er et akseptabelt alternativ til EC90 x 4 → taxan spesielt ved cardiale risikofaktorer som gjør at man vil unngå antracycliner.',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumB', nStage: ['pN0'], tStage: T1c, rorMin: 41, rorMax: 60 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nLuminal B**\nROR score 41-60',
        'pT2',
        'ER≥50%: EC90 x 4 eller TC x 4 → endokrin behandling\nER<50%: EC90 x 4 → taxan → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Ved ER≥50%: Endokrin behandling kan vurderes ved kombinasjonen av histologisk grad 1-2, lav absolutt ROR score og liten tumorstørrelse innenfor kategorien\n\nVed ER<50%: TC x 6 er et akseptabelt alternativ til EC90 x 4 → taxan spesielt ved cardiale risikofaktorer som gjør at man vil unngå antracycliner',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', prosignaSubtype: 'lumB', nStage: ['pN0'], tStage: T2, rorMin: 41, rorMax: 60 },
    },

    // ---- pN0 · Prosigna · ROR >60 ----
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nROR score >60',
        'pT1a-b',
        'ER≥50%: Endokrin behandling\nER<50%: EC90 x 4 eller TC x 4 → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Ved ER≥50%: EC90 x 4 eller TC x 4 → endokrin behandling kan vurderes ved kombinasjonen av grad 3, høy absolutt ROR score og stor tumorstørrelse innenfor kategorien.\n\nIndividuell vurdering av grunnlag for systembehandling kan gjøres ved pT1a pN0 tumores',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T1ab, rorMin: 61 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nROR score >60',
        'pT1c',
        'EC90 x 4 → taxan → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'TC x 6 er et akseptabelt alternativ til EC90 x 4 → taxan spesielt ved cardiale risikofaktorer som gjør at man vil unngå antracycliner.',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T1c, rorMin: 61 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'pN0',
        'Prosigna\nROR score >60',
        'pT2',
        'EC90 x 4 → taxan → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'TC x 6 er et akseptabelt alternativ til EC90 x 4 → taxan spesielt ved cardiale risikofaktorer som gjør at man vil unngå antracycliner.',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'prosigna', nStage: ['pN0'], tStage: T2, rorMin: 61 },
    },

    // ---- Postmenopausal pN1 · OncotypeDx ----
    {
      cells: [
        'HR+\nHER2-',
        'Post-\nmenopausal\npN1',
        'OncotypeDx\nRS≤25',
        '',
        'ER≥50%: Endokrin behandling og zoledronsyre\nER<50%: Vurder om grunnlag for kjemoterapi → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'ER<50%: Vurder om indikasjon for kjemoterapi, enten EC90 x 4 eller TC x 4 eller eventuelt EC90 x 4 → taxan, vurderes i forhold til ER ekspresjonsnivå og klinisk risiko',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'oncotypedx', menopausal: 'post', nStage: ['pN1'], rsMax: 25 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Post-\nmenopausal\npN1',
        'OncotypeDx\nRS>25',
        '',
        'EC90 x 4 → taxan → endokrin behandling\nZoledronsyre ved postmenopausal status',
        'TC x 6 er et akseptabelt alternativ til EC90 x 4 → taxan spesielt ved cardiale risikofaktorer som gjør at man vil unngå antracycliner.',
      ],
      crit: { bioGroup: 'HR+HER2-', geneTest: 'oncotypedx', menopausal: 'post', nStage: ['pN1'], rsMin: 26 },
    },
  ],
  footnotes: [
    '*I noen få tilfeller vil molekylær subtype (med Prosigna test) for HR+HER2- svulster være «Basal»- eller «HER2-enriched», adjuvant behandling vil da følge ROR score og Luminal B subtype.',
    '**Alder og absolutt ER ekspresjonsnivå kan gi grunnlag for individuell vurdering av behandlingsvalg. Dersom absolutt ROR score er meget nær cut-off verdier for ROR risk klassifiseringen (low/intermediate/high) kan det gi grunnlag for individuell vurdering av behandlingsvalg.',
    '*** Beslutningsgrunnlaget vedrørende endokrin behandling som alternativ til kjemoterapi er indirekte, og sikker kunnskap om dette alternativet for premenopausale pasienter er enda ikke tilgjengelig.',
  ],
};

// ================================================================
//  TABELL 2 — Genekspresjonstest IKKE utført / ikke indisert
//  Kilde: "Anbefalinger for adjuvant systemisk behandling etter
//  primærkirurgi dersom det ikke er indikasjon for
//  genekspresjonstest eller slik test ikke er utført (19.11.25)"
//  (tabellovernstest)
// ================================================================

export const tableNoGeneTest = {
  id: 'nogenetest',
  title:
    'Anbefalinger for adjuvant systemisk behandling etter primærkirurgi dersom det ikke er indikasjon for genekspresjonstest eller slik test ikke er utført (19.11.25)',
  shortTitle: 'Genekspresjonstest ikke utført',
  source: 'NBCG Handlingsprogram — tabell «ikke genekspresjonstest» (rev. 19.11.25)',
  revision: '19.11.25',
  kind: 'primary',
  // Venstre-kolonner som kan slås sammen: hovedgruppe, subgruppering
  mergeCount: 2,
  recCols: [{ idx: 3 }],
  columns: [
    'Hoved-gruppe',
    'Subgruppering ved undersøkelser av tumor',
    'Ytterligere subgruppering',
    'Generell terapi-anbefaling',
    'Grunnlag for annet terapi-valg',
  ],
  rows: [
    // ================= HR+ HER2- =================
    // ---- Lum A-liknende ----
    {
      cells: ['HR+\nHER2-', 'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%', 'pT1a-b pN0', 'Ingen behandling', ''],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: ['pN0'], tStage: T1ab },
    },
    {
      cells: ['HR+\nHER2-', 'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%', 'pT1c pN0 grad 1', 'Ingen behandling', ''],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: ['pN0'], tStage: T1c, grade: [1] },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%',
        'pT1c grad 2 pN0\npT2pN0 grad 1',
        'Endokrin behandling\nZoledronsyre ved postmenopausal status',
        '',
      ],
      crit: {
        bioGroup: 'HR+HER2-',
        luminalLike: 'A',
        anyOf: [
          { nStage: ['pN0'], tStage: T1c, grade: [2] },
          { nStage: ['pN0'], tStage: T2, grade: [1] },
        ],
      },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%',
        'pT2pN0 Grad 2',
        'Premenopausal: EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling. Endokrin behandling som inkluderer goserelin kan vurderes som alternativ til kjemoterapi.\nPostmenopausal: Endokrin behandling og zoledronsyre',
        '',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: ['pN0'], tStage: T2, grade: [2] },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%',
        'pT1-2pN1',
        'Premenopausal: EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling.\nPostmenopausal: Endokrin behandling og zoledronsyre',
        'Premenopausale: Hvis ikke kjemoterapi benyttes bør endokrin behandling inkludere goserelin (ut i fra vurdering av tumorstørrelse, omfang av lymfeknutemetastaser og grad).\nPostmenopausale: Tumorstørrelse og omfang av lymfeknutemetastaser kan gi grunnlag for kjemoterapi (EC90 x 4, alternativt TC x 4)',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: ['pN1'], tStage: T12 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Lum A-liknende*\n\n*Følgende karakteristika:\nKi67<10%, G1-2, HR>50%',
        'pN2-3',
        'EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Spesielt omfattende lymfeknutemetastasering sykdom kan gi grunnlag for å gi EC90 x 4 → taxan',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'A', nStage: ['pN2', 'pN3'] },
    },

    // ---- LumB-liknende ----
    {
      cells: [
        'HR+\nHER2-',
        'LumB-liknende*\n\n*Følgende karakteristika:\n1) Ki67>35% eller\n2) Grad 3 og samsvarende høy Ki67 eller\n3) HR<50%',
        'pT1a-b pN0',
        'Endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Lav HR positivitet eller høyere proliferasjongrad kan gi grunnlag for kjemoterapi (EC90 x 4 eller TC x 4)\nIndividuell vurdering av grunnlag for systembehandling kan gjøres ved små pT1apN0 tumores',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'B', nStage: ['pN0'], tStage: T1ab },
    },
    {
      cells: [
        'HR+\nHER2-',
        'LumB-liknende*\n\n*Følgende karakteristika:\n1) Ki67>35% eller\n2) Grad 3 og samsvarende høy Ki67 eller\n3) HR<50%',
        'pT1c-pT2 pN0',
        'EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Meget høy proliferasjongrad kan gi grunnlag for å gi EC90 x 4 → taxan (alternativt TC x 6)',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'B', nStage: ['pN0'], tStage: T1cT2 },
    },
    {
      cells: [
        'HR+\nHER2-',
        'LumB-liknende*\n\n*Følgende karakteristika:\n1) Ki67>35% eller\n2) Grad 3 og samsvarende høy Ki67 eller\n3) HR<50%',
        'pT1-2pN1-3',
        'EC90 x 4 → taxan alternativt EC90 x 4 eller TC x 4 (valg avhengig av risikovurdering) etterfulgt av endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Alternativ til EC90 x 4 → taxan er TC x 6 dersom ikke beh.plan er lagt som følge av mange lymfeknutemetastaser',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'B', nStage: ['pN1', 'pN2', 'pN3'], tStage: T12 },
    },

    // ---- Ikke konklusiv Luminal gruppe ----
    {
      cells: [
        'HR+\nHER2-',
        'Ikke konklusiv Luminal gruppe (ikke passende i de luminale grupper over)',
        'pN0',
        'Generell anbefaling om behandlingsvalg ikke mulig uten geneksprepsjonsanalyse',
        '',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'inconclusive', nStage: ['pN0'] },
    },
    {
      cells: [
        'HR+\nHER2-',
        'Ikke konklusiv Luminal gruppe (ikke passende i de luminale grupper over)',
        'pN1-3',
        'EC90 x 4 eller TC x 4 etterfulgt av endokrin behandling\nVed postmenopausal status alternativt endokrin behandling ved pN1 eller individuell vurdering\nZoledronsyre ved postmenopausal status',
        'Mange lymfeknutemetastaser kan gi grunnlag for å gi EC90 x 4 → taxan',
      ],
      crit: { bioGroup: 'HR+HER2-', luminalLike: 'inconclusive', nStage: ['pN1', 'pN2', 'pN3'] },
    },

    // ================= HR+ HER2+ =================
    {
      cells: [
        'HR+\nHER2+',
        '',
        'pT1pN0',
        'Taxan/trastuzumab etterfulgt av trastuzumab og endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Individuell vurdering av grunnlag for systembehandling kan gjøres ved små pT1apN0 tumores\nSpesielt høy risikoprofil kan gi grunnlag for behandling tilsvarende pT2pN0',
      ],
      crit: { bioGroup: 'HR+HER2+', nStage: ['pN0'], tStage: T1abc },
    },
    {
      cells: [
        'HR+\nHER2+',
        '',
        'pT2pN0',
        'Taxan/carboplatin/trastuzumab (TCH) etterfulgt av trastuzumab og endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Alternativ til TCH: EC90 x 4 → taxan/trastuzumab',
      ],
      crit: { bioGroup: 'HR+HER2+', nStage: ['pN0'], tStage: T2 },
    },
    {
      cells: [
        'HR+\nHER2+',
        '',
        'pT1-2pN1-3',
        'Taxan/carboplatin/trastuzumab/pertuzumab (TCHP) etterfulgt av trastuzumab/pertuzumab og endokrin behandling\nZoledronsyre ved postmenopausal status',
        'Alternativ til TCHP: EC90 x 4 → taxan/trastuzumab/pertuzumab',
      ],
      crit: { bioGroup: 'HR+HER2+', nStage: ['pN1', 'pN2', 'pN3'], tStage: T12 },
    },

    // ================= HR- HER2+ =================
    {
      cells: [
        'HR-\nHER2+',
        '',
        'pT1pN0',
        'Taxan/trastuzumab etterfulgt av trastuzumab\nZoledronsyre ved postmenopausal status',
        'Individuell vurdering av grunnlag for systembehandling kan gjøres ved små pT1apN0 tumores\nSpesielt høy risikoprofil kan gi grunnlag for behandling tilsvarende pT2pN0',
      ],
      crit: { bioGroup: 'HR-HER2+', nStage: ['pN0'], tStage: T1abc },
    },
    {
      cells: [
        'HR-\nHER2+',
        '',
        'pT2pN0',
        'Taxan/carboplatin/trastuzumab (TCH) etterfulgt av trastuzumab\nZoledronsyre ved postmenopausal status',
        'Alternativ til TCH: EC90 x 4 → taxan/trastuzumab',
      ],
      crit: { bioGroup: 'HR-HER2+', nStage: ['pN0'], tStage: T2 },
    },
    {
      cells: [
        'HR-\nHER2+',
        '',
        'pT1-2pN1-3',
        'Taxan/carboplatin/trastuzumab/pertuzumab (TCHP) etterfulgt av trastuzumab/pertuzumab\nZoledronsyre ved postmenopausal status',
        'Alternativ til TCHP: EC90 x 4 → taxan/trastuzumab/pertuzumab',
      ],
      crit: { bioGroup: 'HR-HER2+', nStage: ['pN1', 'pN2', 'pN3'], tStage: T12 },
    },

    // ================= HR- HER2- (TN) =================
    {
      cells: [
        'HR-\nHER2-',
        '',
        'pT1apN0',
        'Ingen generell abefaling om kjemoterapi',
        'Individuell vurdering av eventuelt grunnlag for kjemoterapi (TILs analyse kan vurderes)',
      ],
      crit: { bioGroup: 'HR-HER2-', nStage: ['pN0'], tStage: ['pT1a'] },
    },
    {
      cells: [
        'HR-\nHER2-',
        '',
        'pT1bpN0',
        'EC90 x 4 → taxan\nZoledronsyre ved postmenopausal status',
        'Lav proliferasjongrad og histologisk grad kan gi grunnlag for å utelate taxaner (evt kun gi TC x 4). Individuell vurdering av grunnlag for å gi kjemoterapi (TILs analyse kan vurderes)',
      ],
      crit: { bioGroup: 'HR-HER2-', nStage: ['pN0'], tStage: ['pT1b'] },
    },
    {
      cells: [
        'HR-\nHER2-',
        '',
        'pT1cpN0',
        'EC90 x 4 → taxan\nZoledronsyre ved postmenopausal status',
        'Lav proliferasjongrad og histologisk grad kan gi grunnlag for å utelate taxaner (evt kun gi TC x 4). (TILs analyse kan vurderes)',
      ],
      crit: { bioGroup: 'HR-HER2-', nStage: ['pN0'], tStage: ['pT1c'] },
    },
    {
      cells: [
        'HR-\nHER2-',
        '',
        'pT1pN1-3\npT2pN0-3',
        'Dersom ikke neoadjuvant behandling er gitt:\ntaxan/carboplatin → EC90 x 4\nZoledronsyre ved postmenopausal status',
        'TC x 6 er et akseptabelt alternativ ved mindre omfattende lymfeknutemetastaser og med kardiale risikofaktorer som gjør at man vil unngå antracycliner.',
      ],
      crit: {
        bioGroup: 'HR-HER2-',
        anyOf: [
          { tStage: T1abc, nStage: ['pN1', 'pN2', 'pN3'] },
          { tStage: T2, nStage: ['pN0', 'pN1', 'pN2', 'pN3'] },
        ],
      },
    },
  ],
  footnotes: [
    '*Beslutningsgrunnlaget vedrørende endokrin behandling som alternativ til kjemoterapi er indirekte, og sikker kunnskap om dette alternativet for premenopausale pasienter er enda ikke tilgjengelig.',
    'Metastaseutredning: Lymfeknute-positive pasienter som enten er HER2 positive eller trippel negative bør metastasescreenes, dersom dette ikke nevneverdig forsinker tidspunkt for behandlingsstart.',
    'Hormonreseptorstatus: Dersom ER er negativ og PR er positiv, bør reseptorundersøkelsene gjentas for å avdekke med sikkerhet om endokrin behandling er aktuelt. PgR positivitet/ER negativitet er sjelden og oftest uttrykk for falsk positivitet (for PR) eller falsk negativitet (for ER).',
    'Genekspresjonstester anbefales benyttet til å vurdere bruk av kjemoterapi for pasienter med HR+HER2- pT1-2pN0 status da slike tester gir sikrest prognostisk (og prediktiv) informasjon med lav interlaboratorievariabilitet. Dersom Prosigna test utføres, henvises til egen oversikt over retningslinjer, hvor testsvaret er inkludert i vurderingsgrunnlaget.',
    'Vurdering av proliferasjon og Luminale subtyper dersom genekspresjonstest ikke er utført: Ki67 proliferasjonsindeks (estimeres som % Ki67 positive celler i hot spot) kan i tillegg til histologisk grad bidra til å skille mellom Luminal A liknende og Luminal B liknende subtyper av brystkreft (ER positive subtyper) dersom Ki67 er <10% eller >35%. Ki67 verdier mellom 10% og 35% bør ikke benyttes for vurdering av grunnlag for kjemoterapi.',
  ],
};

// ================================================================
//  TABELL 3 — Adjuvant CDK4/6-hemmer i kombinasjon med endokrin
//  behandling (TILLEGGSBEHANDLING for HR-positiv sykdom).
//  Kilde: "Oversikt anbefaling om bruk av CDK4/6 hemmer i
//  kombinasjon med endokrin behandling (19.11.25)"
//
//  Denne tabellen er en addon: den er relevant SAMTIDIG med
//  primærtabellen (med/uten gentest) for HR+HER2- pasienter, slik
//  at flere relevante tabeller kan vises for samme pasient.
//
//  Indekseres på TNM (forenklet T0–T4 + N0–N3) og anatomisk
//  stadium. Cellene inneholder de ordrette betingelsene
//  (grad/GES), så verktøyet highlighter kun riktig TNM-rad — det
//  avgjør ikke ja/nei selv.
// ================================================================

export const tableCDK46 = {
  id: 'cdk46',
  title: 'Oversikt anbefaling om bruk av CDK4/6 hemmer i kombinasjon med endokrin behandling (19.11.25)',
  shortTitle: 'CDK4/6-hemmer (tillegg, HR+)',
  source: 'NBCG Handlingsprogram — tabell «adjuvant CDK4/6-hemmer» (rev. 19.11.25)',
  revision: '19.11.25',
  kind: 'addon',
  // Relevant som tillegg for HR-positiv, HER2-negativ sykdom
  appliesToBioGroups: ['HR+HER2-'],
  // Kun anatomisk stadium (kolonne 0) slås sammen
  mergeCount: 1,
  // Begge medikamentkolonnene utgjør anbefalingsteksten
  recCols: [
    { idx: 2, label: 'Ribociklib' },
    { idx: 3, label: 'Abemaciklib' },
  ],
  columns: ['Anatomisk stadieinndeling', 'TNM', 'Ribociklib anbefales', 'Abemaciklib anbefales'],
  rows: [
    { cells: ['I', 'T1N0', 'Nei', 'Nei'], crit: { tSimple: ['T1'], nStage: ['pN0'] } },

    { cells: ['IIA', 'T0N1*', 'Om grad 3 eller høyrisiko på GES#', 'Nei'], crit: { tSimple: ['T0'], nStage: ['pN1'] } },
    { cells: ['IIA', 'T1N1*', 'Om grad 3 eller høyrisiko på GES#', 'Om grad 3 (1. valg)'], crit: { tSimple: ['T1'], nStage: ['pN1'] } },
    { cells: ['IIA', 'T2N0', 'Om grad 3 eller høyrisiko på GES#', 'Nei'], crit: { tSimple: ['T2'], nStage: ['pN0'] } },

    { cells: ['IIB', 'T2N1', 'Ja\n(avstå om grad 1 eller lavrisiko GES#)', 'Om grad 3 (1. valg)'], crit: { tSimple: ['T2'], nStage: ['pN1'] } },
    { cells: ['IIB', 'T3N0', 'Ja\n(avstå om grad 1 eller lavrisiko GES#)', 'Nei'], crit: { tSimple: ['T3'], nStage: ['pN0'] } },

    { cells: ['IIIA', 'T0N2', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T0'], nStage: ['pN2'] } },
    { cells: ['IIIA', 'T1N2', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T1'], nStage: ['pN2'] } },
    { cells: ['IIIA', 'T2N2', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T2'], nStage: ['pN2'] } },
    { cells: ['IIIA', 'T3N1', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T3'], nStage: ['pN1'] } },
    { cells: ['IIIA', 'T3N2', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T3'], nStage: ['pN2'] } },

    { cells: ['IIIB', 'T4N0', 'Ja', 'Nei'], crit: { tSimple: ['T4'], nStage: ['pN0'] } },
    { cells: ['IIIB', 'T4N1', 'Ja', 'Om grad 3 eller tumor ≥ 5 cm (1. valg)'], crit: { tSimple: ['T4'], nStage: ['pN1'] } },
    { cells: ['IIIB', 'T4N2', 'Ja', 'Ja (1. valg)'], crit: { tSimple: ['T4'], nStage: ['pN2'] } },

    { cells: ['IIIC', 'AnyTN3', 'Ja', 'Ja (1. valg)'], crit: { nStage: ['pN3'] } },
  ],
  footnotes: [
    '* Ingen behandlingsindikasjon ved pN1mic (mikrometastase). #GES = genekspresjon.',
  ],
  // Redaksjonell merknad om hvordan verktøyet behandler tabellen — IKKE fra
  // PDF-en, og derfor holdt utenfor `footnotes`, som kun skal være ordrett
  // NBCG-tekst som kan siteres i et svarbrev.
  appNote:
    'Tabellen er en tilleggsvurdering for HR+HER2- sykdom og kommer i tillegg til primæranbefalingen. Cellene angir betingelsene (grad/GES) ordrett — vurder disse opp mot pasienten.',
};

// ================================================================
//  Felles regime-/forklaringstekst (ordrett fra PDF-enes fotnoter)
//  Vises som sammenleggbar referanse i verktøyet slik at ingen
//  tekst fra PDF-ene går tapt.
// ================================================================

export const sharedRegimens = [
  {
    heading: 'Endokrin behandling',
    text: 'Det henvises til tekstlige anbefalinger i Handlingsprogrammet. For oversikt over adjuvant CDK4/6 hemmer behandling henvises til egen tabell i handlingsprogrammet. Calcium/VitD (1000 mg/800 IE daglig) skal i utgangspunktet gis til alle som står på AI (for eksempel Calcigran forte tyggetabletter).',
  },
  {
    heading: 'Bentetthetsundersøkelser',
    text: 'Ved bruk av AI eller unge kvinner som benytter goserelin: Dersom ikke zoledronsyre benyttes som adjuvant behandling, bør det gjøres bentetthetsmålinger ved oppstart, etter 1 år og deretter hvert 2. år inntil avslutning av AI.',
  },
  {
    heading: 'Zoledronsyre',
    text: 'Zoledronsyre gis i.v. primært i dosering 4 mg hver 3. måned i 2 år eller (sekundærvalg) hver 6. måned i 5 år ved avdeling som vanligvis gir kjemoterapi. Behandlingen er kun aktuell for pasienter med postmenopausal status (naturlig eller indusert) som skal gjennomføre systemisk adjuvant behandling. Tannstatus bør vurderes før oppstart av behandlingen.',
  },
  {
    heading: 'Ikke-hormonell behandling (kjemoterapiregimer)',
    text: 'EC90 (epirubicin 90 mg/m2 + cyklofosfamid 600 mg/m2) gis hver 3. uke. TC i form av docetaxel 75 mg/m2 + cyklofosfamid 600 mg/m2 gis også hver 3. uke. Paklitaxel 80mg/m2 hver uke kan benyttes som alternativ til docetaxel hver 3. uke i TC regimet. Taxan/carboplatin gis enten hver 3. uke i form av docetaxel 75 mg/m2 + carboplatin AUC 5(-6) x 6, eller ukentlig i form av paclitaxel 80 mg/m2 + carboplatin AUC 1.5-2 x 12 (alternativt kan carboplatin fortsatt gis hver 3. uke). Det gis G-CSF som primærprofylakse mot febrile neutropenier dersom det ikke gis ukentlige kurer. Ved indikasjon for taxan i sekvens med EC90: Docetaxel 100 mg/m2 hver tredje uke x 4 eller paclitaxel 80mg/m2 hver uke x 12. Ved bruk av docetaxel gis G-CSF som primærprofylakse mot febrile neutropenier. Ved HER2 positiv status og indikasjon for kjemoterapi: Trastuzumab eller trastuzumab+pertuzumab infusjon hver 3. uke i 1 år med oppstart samtidig med taxanbehandlingen. Gjør LVEF måling før oppstart av EC90 (hvis dette benyttes), før oppstart av anti-HER2 behandling, deretter hver 3. mnd til avsluttet behandling. Følg egen algoritme for vurdering av LVEF i forhold til anti-HER2-behandlingen. For andre alternative kjemoterapiregimer, konferer tekst.',
  },
  {
    heading: 'Alder og bruk av kjemoterapi og/eller zoledronsyre',
    text: 'Ved indikasjon, bør i utgangspunktet den skisserte adjuvante kjemoterapi og/eller zoledronsyrebehandling gis opp til minimum 75 års alder, men det anbefales ikke å benytte høy alder alene som grunn for å utelate bruk av kjemoterapi/zoledronsyre. Ved alder >70–75 år må behandling vurderes nøye i forhold til komorbiditet og leveutsikter – og individuell tilpasning kan være nødvendig.',
  },
  {
    heading: 'Strålebehandling (for pasienter som ikke gjennomgår neoadjuvant behandling)',
    text: 'Aktuelt hvis 1) operert brystbevarende, 2) ikke fri margin etter ablatio, eller 3) pN1(>2 mm)-pN3. Ved indikasjon for kjemoterapi og planlagt 12 ukers behandlingsperiode, henvis til stråleterapi i forbindelse med eller 3 uker etter oppstart av behandlingen. Dersom det er planlagt 18-24 ukers behandlingsperiode, henvis til stråleterapi midtveis i behandlingen. Dersom det ikke er indikasjon for kjemoterapi, henvis til stråleterapi umiddelbart.',
  },
];

export const guidelineTables = [tableNoGeneTest, tableGeneTest, tableCDK46];

// Tilleggstabeller (addons) som kan være relevante samtidig med en primærtabell.
export const addonTables = [tableCDK46];
