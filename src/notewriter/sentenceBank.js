/**
 * Setningsbank for svar på henvisning.
 *
 * Registeret følger den opprinnelige «klinisk svar»-malen: man svarer med hva
 * det er *indikasjon for*, ikke med hva som gis. Teksten er hentet fra
 * regelmotoren (src/dmn/decisionTables.js, treatmentBuilder.js),
 * beslutningstreet og malene i ReferralLetterGenerator.
 *
 * To slags grupper:
 *   kind: 'indikasjon' — alternativene er tekstbiter (`core`) som settes inn i
 *         en ledetekst. Enten samlet i én nummerert liste, eller under
 *         gruppens egen `lead`. Se referralText.js.
 *   kind: 'setning'    — alternativene er hele setninger (`text`) som står for
 *         seg selv, slik «Det bestilles MR mamma …» gjør i originalen.
 *
 * VIKTIG OM MDR: katalogen er inert. Ingenting her kjenner pasienten, ingen
 * funksjon tar imot pasientdata, rekkefølgen er fast og ingen setning er
 * merket som anbefalt. Tumorbiologi og stadium står i åpningslinjen — de
 * bygges av pasientfeltene, ikke av avkryssinger.
 *
 * `source`:
 *   'regelmotor'  — src/dmn/decisionTables.js / treatmentBuilder.js
 *   'kliniskSvar' — malene i ReferralLetterGenerator / clinicalVariables
 *   'prosedyre'   — prosedyretekst skrevet for dette verktøyet, ikke NBCG-sitat
 */

export const SOURCE_LABELS = {
  regelmotor: 'Fra regelmotoren',
  kliniskSvar: 'Fra klinisk svar',
  prosedyre: 'Prosedyretekst (ikke NBCG-sitat)',
};

export const SENTENCE_GROUPS = [
  // ============================================================
  //  Indikasjoner — settes inn i en ledetekst
  // ============================================================
  {
    id: 'kjemoterapi',
    heading: 'Kjemoterapi',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'I henhold til retningslinjer er det indikasjon for {intent} behandling med',
    options: [
      { id: 'kjemo-ec90-taxan', label: 'EC90 ×4 → taxan', core: 'EC90 ×4 etterfulgt av taxan', source: 'regelmotor' },
      { id: 'kjemo-ec90-tc', label: 'EC90 ×4 eller TC ×4', core: 'EC90 ×4 eller TC ×4', source: 'regelmotor' },
      { id: 'kjemo-ec90', label: 'EC90 ×4', core: 'EC90 ×4', source: 'regelmotor' },
      { id: 'kjemo-tc6', label: 'TC ×6', core: 'TC ×6', source: 'regelmotor' },
      { id: 'kjemo-taxan-carbo-ec90', label: 'Taxan/carboplatin → EC90 ×4', core: 'taxan/carboplatin etterfulgt av EC90 ×4', source: 'regelmotor' },
      { id: 'kjemo-paklitaxel', label: 'Paklitaxel 80 mg/m² ukentlig ×12', core: 'paklitaxel 80 mg/m² ukentlig ×12', source: 'regelmotor' },
      { id: 'kjemo-docetaxel', label: 'Docetaxel q3w', core: 'docetaxel 75 mg/m² hver 3. uke', source: 'regelmotor' },
      { id: 'kjemo-taxan-12uker', label: 'Taxan ×12 uker', core: 'taxan over 12 uker', source: 'regelmotor' },
      { id: 'kjemo-dosedense', label: 'Dose-dense EC90 q2w → taxan', core: 'dose-dense EC90 hver 2. uke etterfulgt av docetaxel q2w eller paklitaxel ukentlig', source: 'regelmotor' },
      { id: 'kjemo-capecitabin', label: 'Capecitabin ×6–8 (CREATE-X)', core: 'capecitabin 1250 mg/m² ×2 daglig dag 1–14, hver 3. uke × 6–8 kurer (CREATE-X)', source: 'regelmotor' },
      { id: 'kjemo-ingen', label: 'Ingen kjemoterapi',
        sentence: 'Det er ikke indikasjon for kjemoterapi.', source: 'regelmotor' },
    ],
  },
  {
    id: 'immunterapi',
    heading: 'Immunterapi',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Videre er det indikasjon for',
    firstLead: 'I henhold til retningslinjer er det indikasjon for {intent} behandling med',
    options: [
      { id: 'immun-keynote-neo', label: 'Pembrolizumab neoadjuvant (KEYNOTE-522)',
        core: 'pembrolizumab med karboplatin og paklitaxel × 12 uker, deretter pembrolizumab med EC90 ×4 (KEYNOTE-522)', source: 'regelmotor' },
      { id: 'immun-keynote-adj', label: 'Adjuvant pembrolizumab ×9',
        core: 'adjuvant pembrolizumab 200 mg hver 3. uke × 9 kurer (KEYNOTE-522)', source: 'regelmotor' },
    ],
  },
  {
    id: 'her2',
    heading: 'HER2-rettet behandling',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Videre er det indikasjon for HER2-rettet behandling med',
    firstLead: 'I henhold til retningslinjer er det indikasjon for HER2-rettet behandling med',
    options: [
      { id: 'her2-trastuzumab', label: 'Trastuzumab i 1 år',
        core: 'trastuzumab hver 3. uke i totalt 1 år, med oppstart samtidig med taxanbehandlingen', source: 'regelmotor' },
      { id: 'her2-hp', label: 'Trastuzumab + pertuzumab i 1 år',
        core: 'trastuzumab og pertuzumab hver 3. uke i totalt 1 år, med oppstart samtidig med taxanbehandlingen', source: 'regelmotor' },
      { id: 'her2-tdm1', label: 'T-DM1 ×14 ved non-pCR (KATHERINE)',
        core: 'T-DM1 3,6 mg/kg hver 3. uke × 14 kurer ved non-pCR, i stedet for adjuvant trastuzumab (KATHERINE)', source: 'regelmotor' },
    ],
  },
  {
    id: 'endokrin',
    heading: 'Endokrin behandling',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Videre indikasjon for {intent} endokrin behandling:',
    firstLead: 'I henhold til retningslinjer er det indikasjon for {intent} endokrin behandling:',
    options: [
      { id: 'endo-ai-5', label: 'Aromatasehemmer i 5 år',
        core: 'aromatasehemmer (letrozol/anastrozol) i 5 år', source: 'regelmotor' },
      { id: 'endo-ai-5-10', label: 'Aromatasehemmer i 5–10 år',
        core: 'aromatasehemmer (letrozol/anastrozol) i 5–10 år, ved høy risiko vurderes 7–8 opp til 10 år', source: 'regelmotor' },
      { id: 'endo-tam', label: 'Tamoxifen 20 mg i 5 år',
        core: 'tamoxifen 20 mg daglig i 5 år', source: 'regelmotor' },
      { id: 'endo-ofs-ai', label: 'OFS (goserelin) + aromatasehemmer',
        core: 'ovariefunksjonssuppresjon med goserelin i 5 år kombinert med aromatasehemmer, med oppstart så snart som mulig', source: 'regelmotor' },
      { id: 'endo-ofs-tam', label: 'OFS (goserelin) + tamoxifen',
        core: 'ovariefunksjonssuppresjon med goserelin i 5 år kombinert med tamoxifen, med oppstart så snart som mulig', source: 'regelmotor' },
      { id: 'endo-neo', label: 'Neoadjuvant endokrin behandling',
        core: 'aromatasehemmer, for premenopausale med tillegg av goserelin, til maksimal respons over 6–12 måneder', source: 'regelmotor' },
      { id: 'endo-ingen', label: 'Ingen endokrin behandling',
        sentence: 'Det er ikke indikasjon for endokrin behandling, da tumor ikke er hormonreseptorpositiv.', source: 'regelmotor' },
    ],
  },
  {
    id: 'cdk46',
    heading: 'CDK4/6-hemmer',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Det er indikasjon for CDK4/6-hemmer i kombinasjon med endokrin behandling:',
    options: [
      { id: 'cdk-abema', label: 'Abemaciclib 150 mg ×2 i 2 år (MonarchE)',
        core: 'abemaciclib 150 mg ×2 daglig i 2 år (MonarchE)', source: 'regelmotor' },
      { id: 'cdk-ribo', label: 'Ribociclib 400 mg daglig i 3 år (NATALEE)',
        core: 'ribociclib 400 mg daglig i 3 år (NATALEE)', source: 'regelmotor' },
      { id: 'cdk-ingen', label: 'Ingen CDK4/6-hemmer',
        sentence: 'Det er ikke indikasjon for CDK4/6-hemmer.', source: 'regelmotor' },
    ],
  },
  {
    id: 'bisfosfonat',
    heading: 'Bisfosfonat',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Det er indikasjon for bisfosfonat i form av',
    listPrefix: '',
    options: [
      { id: 'bis-3mnd', label: 'Zoledronsyre hver 3. måned i 2 år',
        core: 'zoledronsyre 4 mg intravenøst hver 3. måned i 2 år', source: 'prosedyre' },
      { id: 'bis-6mnd', label: 'Zoledronsyre hver 6. måned i 5 år',
        core: 'zoledronsyre 4 mg intravenøst hver 6. måned i 5 år', source: 'prosedyre' },
      { id: 'bis-postmeno', label: 'Ved postmenopausal status',
        core: 'zoledronsyre ved postmenopausal status, naturlig eller indusert', source: 'regelmotor' },
      { id: 'bis-ingen', label: 'Ingen bisfosfonat',
        sentence: 'Det er ikke indikasjon for zoledronsyre.', source: 'regelmotor' },
    ],
  },
  {
    id: 'parp',
    heading: 'PARP-hemmer',
    kind: 'indikasjon',
    select: 'multi',
    lead: 'Det er indikasjon for',
    options: [
      { id: 'parp-olaparib', label: 'Olaparib 300 mg ×2 i 1 år (OlympiA)',
        core: 'olaparib (Lynparza) 300 mg ×2 daglig i 1 år, med oppstart innen 12 uker etter avsluttet kjemoterapi og i kombinasjon med endokrin behandling ved HR-positiv sykdom', source: 'regelmotor' },
      { id: 'parp-olaparib-vurder', label: 'Olaparib vurderes',
        sentence: 'Olaparib vurderes etter individuell risikovurdering.', source: 'regelmotor' },
      { id: 'parp-ingen', label: 'Ingen indikasjon for olaparib',
        sentence: 'Det er ikke indikasjon for olaparib, da det ikke foreligger patogen germline BRCA1/2-mutasjon.', source: 'regelmotor' },
    ],
  },
  {
    id: 'straling',
    heading: 'Strålebehandling',
    kind: 'indikasjon',
    select: 'single',
    lead: 'Det er indikasjon for postoperativ strålebehandling mot',
    listPrefix: 'strålebehandling mot',
    options: [
      { id: 'str-bryst', label: 'Hele brystet med boost', core: 'hele brystet med boost mot tumorleiet', source: 'regelmotor' },
      { id: 'str-bryst-regional', label: 'Hele brystet + regionale lymfeknuter', core: 'hele brystet og regionale lymfeknuter', source: 'regelmotor' },
      { id: 'str-brystvegg', label: 'Brystvegg + regionale lymfeknuter', core: 'brystvegg og regionale lymfeknuter', source: 'regelmotor' },
      { id: 'str-ingen', label: 'Ingen strålebehandling',
        sentence: 'Det er ikke indikasjon for postoperativ strålebehandling.', source: 'regelmotor' },
    ],
  },

  // ============================================================
  //  Egne setninger — står for seg selv, som i originalen
  // ============================================================
  {
    id: 'utredning',
    heading: 'Utredning og bestillinger',
    kind: 'setning',
    select: 'multi',
    options: [
      { id: 'utr-mr', label: 'MR mamma og metastasescreening',
        text: 'Det bestilles MR mamma og metastasescreening.', source: 'kliniskSvar' },
      { id: 'utr-blodprover', label: 'Standard blodprøver',
        text: 'Standard ca mammae blodprøver bestilles, evt FSH/LH/østradiol.', source: 'kliniskSvar' },
      { id: 'utr-immun', label: 'Immunterapiblodprøver',
        text: 'Ved trippel negativ sykdom med immunterapi-indikasjon bestilles immunterapiblodprøver i forkant.', source: 'kliniskSvar' },
      { id: 'utr-ekg', label: 'EKG før oppstart',
        text: 'Det tas EKG før oppstart av behandlingen.', source: 'prosedyre' },
      { id: 'utr-lvef', label: 'LVEF-måling før oppstart',
        text: 'Det gjøres LVEF-måling før oppstart av EC90 og før oppstart av anti-HER2-behandling.', source: 'regelmotor' },
      { id: 'utr-tannstatus', label: 'Tannstatus før zoledronsyre',
        text: 'Tannstatus vurderes før oppstart av zoledronsyre.', source: 'prosedyre' },
      { id: 'utr-markor', label: 'Markør/klips ved planlagt BCS',
        text: 'Ved planlagt brystbevarende kirurgi bestilles markør eller klips i tumorsengen før oppstart.', source: 'regelmotor' },
      { id: 'utr-brca', label: 'BRCA-testing',
        text: 'Det anbefales BRCA-testing. Svaret kan påvirke behandlingsvalg og kirurgisk strategi.', source: 'regelmotor' },
      { id: 'utr-genetisk', label: 'Genetisk veiledning',
        text: 'Pasienten henvises til genetisk veiledning.', source: 'regelmotor' },
      { id: 'utr-mdt', label: 'MDT-vurdering',
        text: 'Pasienten henvises til vurdering i multidisiplinært team.', source: 'regelmotor' },
    ],
  },
  {
    id: 'oppfolging',
    heading: 'Oppfølging underveis',
    kind: 'setning',
    select: 'multi',
    options: [
      { id: 'opp-hjerte', label: 'Følges for hjertetoksisitet',
        text: 'Pasienten skal følges for hjertetoksisitet ved EC90-behandling.', source: 'kliniskSvar' },
      { id: 'opp-lvef', label: 'LVEF hver 3. måned',
        text: 'LVEF måles hver 3. måned til avsluttet behandling.', source: 'regelmotor' },
      { id: 'opp-respons', label: 'Responsevaluering hver 3. uke',
        text: 'Klinisk responsevaluering gjøres hver 3. uke.', source: 'regelmotor' },
      { id: 'opp-respons36', label: 'Responsevaluering hver 3.–6. uke',
        text: 'Klinisk responsevaluering gjøres hver 3.–6. uke, med billeddiagnostikk ved behov.', source: 'regelmotor' },
      { id: 'opp-hematologi', label: 'Hematologisk monitorering',
        text: 'Det gjøres hematologisk monitorering med fullblodstelling dag 1 i hver syklus.', source: 'regelmotor' },
      { id: 'opp-lever', label: 'Lever- og blodprøver ved hver kur',
        text: 'Lever- og blodprøver tas ved hver kur.', source: 'regelmotor' },
      { id: 'opp-autoimmun', label: 'Screening for autoimmune bivirkninger',
        text: 'Det gjøres screening for autoimmune bivirkninger under immunterapi.', source: 'regelmotor' },
      { id: 'opp-bentetthet', label: 'Bentetthetsmåling ved AI/goserelin',
        text: 'Ved aromatasehemmer eller goserelin uten samtidig zoledronsyre gjøres bentetthetsmåling ved oppstart, etter 1 år og deretter hvert 2. år.', source: 'prosedyre' },
      { id: 'opp-calcium', label: 'Kalsium og vitamin D ved AI',
        text: 'Kalsium og vitamin D, 1000 mg og 800 IE daglig, gis til alle som står på aromatasehemmer.', source: 'regelmotor' },
      { id: 'opp-gcsf', label: 'G-CSF som primærprofylakse',
        text: 'Det gis G-CSF som primærprofylakse mot febril nøytropeni når det ikke gis ukentlige kurer.', source: 'regelmotor' },
    ],
  },
  {
    id: 'merknader',
    heading: 'Merknader',
    kind: 'setning',
    select: 'multi',
    options: [
      { id: 'mrk-fertilitet', label: 'Fertilitetsrådgivning',
        text: 'Fertilitetsrådgivning og eventuelle fertilitetsbevarende tiltak tilbys før oppstart av gonadotoksisk behandling.', source: 'regelmotor' },
      { id: 'mrk-alder', label: 'Alder og komorbiditet',
        text: 'Ved alder over 70–75 år vurderes behandlingen nøye opp mot komorbiditet og leveutsikter.', source: 'prosedyre' },
      { id: 'mrk-lavpositiv', label: 'ER lav-positiv (1–10 %)',
        text: 'ER er lav-positiv i intervallet 1–10 %. Slike tumorer oppfører seg ofte mer som ER-negative, og nytten av endokrin behandling er usikker.', source: 'regelmotor' },
      { id: 'mrk-n1mi', label: 'N1mi — klinisk betydning omdiskutert',
        text: 'Ved N1mi er den kliniske betydningen omdiskutert, og behandlingen vurderes individuelt.', source: 'regelmotor' },
      { id: 'mrk-individuell', label: 'Individuell vurdering',
        text: 'Behandlingsvalget krever individuell vurdering.', source: 'regelmotor' },
      { id: 'mrk-pasient', label: 'Diskutert med pasienten',
        text: 'Behandlingsopplegget er diskutert med pasienten.', source: 'prosedyre' },
    ],
  },
];

/** Alle alternativer flatet ut, for oppslag på id. */
export const ALL_OPTIONS = SENTENCE_GROUPS.flatMap((g) =>
  g.options.map((o) => ({
    ...o, groupId: g.id, groupHeading: g.heading, groupKind: g.kind,
    groupLead: g.lead, groupFirstLead: g.firstLead, listPrefix: g.listPrefix,
  })),
);

export function findOption(optionId) {
  return ALL_OPTIONS.find((o) => o.id === optionId) || null;
}

export function findGroup(groupId) {
  return SENTENCE_GROUPS.find((g) => g.id === groupId) || null;
}

/**
 * Forhåndsvisning av én setning, slik den vil lese i svaret.
 *
 * Tar imot både et rått alternativ fra `group.options` og et beriket fra
 * ALL_OPTIONS. Gruppen kan sendes med når alternativet er rått — uten den
 * ville ledeteksten mangle og hele setninger bli «undefined».
 */
export function previewText(option, intent = '', group = null) {
  if (!option) return '';
  // En egen setning overstyrer ledeteksten. Negasjoner kan ikke bære en
  // bekreftende ledetekst: «indikasjon for … ikke kjemoterapi» er ikke norsk.
  if (option.sentence) return option.sentence;
  const kind = option.groupKind ?? group?.kind;
  if (kind === 'setning') return option.text ?? '';
  const raw = option.groupLead ?? group?.lead ?? '';
  const lead = raw.replace(/\{intent\}/g, intent || 'adjuvant').replace(/\s+/g, ' ').trim();
  const core = option.core ?? option.text ?? '';
  if (!core) return '';
  return lead ? `${lead} ${core}.` : `${core}.`;
}
