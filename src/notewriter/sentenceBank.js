/**
 * Setningsbank for «Skriv journalnotat».
 *
 * Teksten er hentet fra det som alt er skrevet i denne appen — regelmotorens
 * beslutningstabeller (src/dmn/decisionTables.js), behandlingsplanbyggeren
 * (src/dmn/treatmentBuilder.js), beslutningstreet og «klinisk svar».
 *
 * VIKTIG OM MDR: katalogen er inert. Ingenting her vet noe om pasienten, og
 * ingen funksjon i denne filen tar imot pasientdata. Rekkefølgen er fast,
 * ingen setning er merket som anbefalt, og bare grupper med
 * `transcription: true` — altså de som gjentar det legen selv har tastet inn —
 * kan forhåndskrysses. Alt som er et behandlingsvalg starter tomt.
 *
 * `source` sier hvor teksten kommer fra:
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
  //  Gjengivelse av det legen har tastet inn — kan forhåndskrysses
  // ============================================================
  {
    id: 'biologi',
    heading: 'Tumorbiologi',
    lead: 'Pasienten har en',
    select: 'single',
    transcription: 'bioGroup',
    options: [
      { id: 'bio-hrpos-her2neg', value: 'HR+HER2-', label: 'HR-positiv og HER2-negativ tumor',
        text: 'Pasienten har en HR-positiv og HER2-negativ tumor.', source: 'kliniskSvar' },
      { id: 'bio-hrpos-her2pos', value: 'HR+HER2+', label: 'HR-positiv og HER2-positiv tumor',
        text: 'Pasienten har en HR-positiv og HER2-positiv tumor.', source: 'kliniskSvar' },
      { id: 'bio-hrneg-her2pos', value: 'HR-HER2+', label: 'HR-negativ og HER2-positiv tumor',
        text: 'Pasienten har en HR-negativ og HER2-positiv tumor.', source: 'kliniskSvar' },
      { id: 'bio-tn', value: 'HR-HER2-', label: 'trippel negativ tumor',
        text: 'Pasienten har en trippel negativ tumor.', source: 'kliniskSvar' },
    ],
  },
  {
    id: 'intensjon',
    heading: 'Behandlingsintensjon',
    lead: 'Pasienten skal iht. retningslinjer få',
    select: 'single',
    transcription: 'intent',
    options: [
      { id: 'int-adjuvant', value: 'adjuvant', label: 'adjuvant behandling',
        text: 'Pasienten skal iht. retningslinjer få adjuvant behandling.', source: 'kliniskSvar' },
      { id: 'int-neoadjuvant', value: 'neoadjuvant', label: 'neoadjuvant behandling',
        text: 'Pasienten skal iht. retningslinjer få neoadjuvant behandling før kirurgi.', source: 'kliniskSvar' },
      { id: 'int-postneo', value: 'post-neoadjuvant', label: 'postneoadjuvant behandling',
        text: 'Pasienten skal iht. retningslinjer få postneoadjuvant behandling.', source: 'kliniskSvar' },
    ],
  },

  // ============================================================
  //  Behandlingsvalg — starter alltid tomme
  // ============================================================
  {
    id: 'kjemoterapi',
    heading: 'Kjemoterapi',
    lead: 'Det gis',
    select: 'multi',
    options: [
      { id: 'kjemo-ec90-taxan', label: 'EC90 ×4 → taxan',
        text: 'Det gis kjemoterapi med EC90 ×4 etterfulgt av taxan.', source: 'regelmotor' },
      { id: 'kjemo-ec90-tc', label: 'EC90 ×4 eller TC ×4',
        text: 'Det gis kjemoterapi med EC90 ×4 eller TC ×4.', source: 'regelmotor' },
      { id: 'kjemo-ec90', label: 'EC90 ×4',
        text: 'Det gis kjemoterapi med EC90 ×4.', source: 'regelmotor' },
      { id: 'kjemo-taxan-carbo-ec90', label: 'Taxan/carboplatin → EC90 ×4',
        text: 'Det gis kjemoterapi med taxan/carboplatin etterfulgt av EC90 ×4.', source: 'regelmotor' },
      { id: 'kjemo-taxan-12uker', label: 'Taxan 12 uker',
        text: 'Det gis taxan over 12 uker.', source: 'regelmotor' },
      { id: 'kjemo-capecitabin', label: 'Capecitabin 6–8 kurer (CREATE-X)',
        text: 'Det gis capecitabin 6–8 kurer (CREATE-X).', source: 'regelmotor' },
      { id: 'kjemo-ingen', label: 'Ingen kjemoterapi',
        text: 'Det er ikke indikasjon for kjemoterapi.', source: 'regelmotor' },
      { id: 'kjemo-vurderes', label: 'Kjemoterapi vurderes',
        text: 'Grunnlaget for kjemoterapi vurderes individuelt.', source: 'regelmotor' },
    ],
  },
  {
    id: 'immunterapi',
    heading: 'Immunterapi',
    lead: '',
    select: 'multi',
    options: [
      { id: 'immun-keynote-neo', label: 'Pembrolizumab neoadjuvant (KEYNOTE-522)',
        text: 'Det gis pembrolizumab i kombinasjon med paklitaxel/karboplatin, deretter pembrolizumab med EC90 (KEYNOTE-522).', source: 'regelmotor' },
      { id: 'immun-keynote-adj', label: 'Adjuvant pembrolizumab 9 kurer',
        text: 'Det gis adjuvant pembrolizumab 200 mg q3w × 9 kurer (KEYNOTE-522).', source: 'regelmotor' },
    ],
  },
  {
    id: 'her2',
    heading: 'HER2-rettet behandling',
    lead: '',
    select: 'multi',
    options: [
      { id: 'her2-trastuzumab', label: 'Trastuzumab i 1 år',
        text: 'Det gis trastuzumab q3w i totalt 1 år, med oppstart samtidig med taxanbehandlingen.', source: 'regelmotor' },
      { id: 'her2-hp', label: 'Trastuzumab + pertuzumab i 1 år',
        text: 'Det gis trastuzumab og pertuzumab q3w i totalt 1 år, med oppstart samtidig med taxanbehandlingen.', source: 'regelmotor' },
      { id: 'her2-tdm1', label: 'T-DM1 ×14 ved non-pCR (KATHERINE)',
        text: 'Ved non-pCR gis T-DM1 3,6 mg/kg q3w × 14 kurer i stedet for adjuvant trastuzumab (KATHERINE).', source: 'regelmotor' },
    ],
  },
  {
    id: 'endokrin',
    heading: 'Endokrin behandling',
    lead: '',
    select: 'multi',
    options: [
      { id: 'endo-ai-5', label: 'Aromatasehemmer i 5 år',
        text: 'Det gis aromatasehemmer (letrozol/anastrozol) i 5 år.', source: 'regelmotor' },
      { id: 'endo-ai-5-10', label: 'Aromatasehemmer i 5–10 år',
        text: 'Det gis aromatasehemmer (letrozol/anastrozol) i 5–10 år. Ved høy risiko vurderes 7–8, opp til 10 års AI.', source: 'regelmotor' },
      { id: 'endo-tam', label: 'Tamoxifen 20 mg i 5 år',
        text: 'Det gis tamoxifen 20 mg daglig i 5 år.', source: 'regelmotor' },
      { id: 'endo-ofs-ai', label: 'OFS (goserelin) + aromatasehemmer',
        text: 'Det gis ovariefunksjonssuppresjon med goserelin i 5 år kombinert med aromatasehemmer. Oppstart av OFS så snart som mulig.', source: 'regelmotor' },
      { id: 'endo-ofs-tam', label: 'OFS (goserelin) + tamoxifen',
        text: 'Det gis ovariefunksjonssuppresjon med goserelin i 5 år kombinert med tamoxifen. Oppstart av OFS så snart som mulig.', source: 'regelmotor' },
      { id: 'endo-neo', label: 'Neoadjuvant endokrin behandling',
        text: 'Det gis neoadjuvant endokrin behandling med aromatasehemmer, for premenopausale med tillegg av goserelin, til maksimal respons over 6–12 måneder.', source: 'regelmotor' },
      { id: 'endo-ingen', label: 'Ingen endokrin behandling',
        text: 'Tumor er ikke hormonreseptorpositiv, og det er ikke indikasjon for endokrin behandling.', source: 'regelmotor' },
    ],
  },
  {
    id: 'cdk46',
    heading: 'CDK4/6-hemmer',
    lead: '',
    select: 'multi',
    options: [
      { id: 'cdk-abema', label: 'Abemaciclib 150 mg ×2 i 2 år (MonarchE)',
        text: 'Det gis abemaciclib 150 mg ×2 daglig i 2 år i kombinasjon med endokrin behandling (MonarchE).', source: 'regelmotor' },
      { id: 'cdk-ribo', label: 'Ribociclib 400 mg daglig i 3 år (NATALEE)',
        text: 'Det gis ribociclib 400 mg daglig i 3 år i kombinasjon med endokrin behandling (NATALEE).', source: 'regelmotor' },
      { id: 'cdk-ingen', label: 'Ingen CDK4/6-hemmer',
        text: 'Det er ikke indikasjon for CDK4/6-hemmer.', source: 'regelmotor' },
    ],
  },
  {
    id: 'bisfosfonat',
    heading: 'Bisfosfonat',
    lead: '',
    select: 'multi',
    options: [
      { id: 'bis-3mnd', label: 'Zoledronsyre 4 mg hver 3. måned i 2 år',
        text: 'Det gis zoledronsyre 4 mg intravenøst hver 3. måned i 2 år.', source: 'prosedyre' },
      { id: 'bis-6mnd', label: 'Zoledronsyre 4 mg hver 6. måned i 5 år',
        text: 'Det gis zoledronsyre 4 mg intravenøst hver 6. måned i 5 år.', source: 'prosedyre' },
      { id: 'bis-postmeno', label: 'Zoledronsyre ved postmenopausal status',
        text: 'Zoledronsyre er aktuelt ved postmenopausal status, naturlig eller indusert, hos pasienter som skal gjennomføre systemisk adjuvant behandling.', source: 'regelmotor' },
      { id: 'bis-ingen', label: 'Ingen bisfosfonat',
        text: 'Det er ikke indikasjon for zoledronsyre.', source: 'regelmotor' },
    ],
  },
  {
    id: 'parp',
    heading: 'PARP-hemmer og BRCA',
    lead: '',
    select: 'multi',
    options: [
      { id: 'parp-olaparib', label: 'Olaparib 300 mg ×2 i 1 år (OlympiA)',
        text: 'Det gis olaparib (Lynparza) 300 mg ×2 daglig i 1 år, med oppstart innen 12 uker etter avsluttet kjemoterapi. Kombineres med endokrin behandling ved HR-positiv sykdom.', source: 'regelmotor' },
      { id: 'parp-testing', label: 'BRCA-testing anbefales',
        text: 'Det anbefales BRCA-testing. Svaret kan påvirke behandlingsvalg og kirurgisk strategi.', source: 'regelmotor' },
      { id: 'parp-genetisk', label: 'Henvises til genetisk veiledning',
        text: 'Pasienten henvises til genetisk veiledning.', source: 'regelmotor' },
    ],
  },
  {
    id: 'straling',
    heading: 'Strålebehandling',
    lead: '',
    select: 'single',
    options: [
      { id: 'str-bryst', label: 'Hele brystet med boost',
        text: 'Det gis strålebehandling mot hele brystet med boost mot tumorleiet.', source: 'regelmotor' },
      { id: 'str-bryst-regional', label: 'Hele brystet + regionale lymfeknuter',
        text: 'Det gis strålebehandling mot hele brystet og regionale lymfeknuter.', source: 'regelmotor' },
      { id: 'str-brystvegg', label: 'Brystvegg + regionale lymfeknuter',
        text: 'Det gis strålebehandling mot brystvegg og regionale lymfeknuter.', source: 'regelmotor' },
      { id: 'str-avhengig', label: 'Avhengig av operasjonstype',
        text: 'Det er indikasjon for postoperativ strålebehandling avhengig av operasjonstype.', source: 'kliniskSvar' },
      { id: 'str-ingen', label: 'Ingen strålebehandling',
        text: 'Det er ikke indikasjon for strålebehandling.', source: 'regelmotor' },
    ],
  },

  // ============================================================
  //  Forløp, prøver og oppfølging
  // ============================================================
  {
    id: 'neoadjuvant',
    heading: 'Neoadjuvant forløp',
    lead: '',
    select: 'multi',
    options: [
      { id: 'neo-mr', label: 'MR mamma og metastasescreening',
        text: 'Det bestilles MR mamma og metastasescreening.', source: 'kliniskSvar' },
      { id: 'neo-respons', label: 'Responsevaluering hver 3. uke',
        text: 'Klinisk responsevaluering gjøres hver 3. uke.', source: 'regelmotor' },
      { id: 'neo-respons36', label: 'Responsevaluering hver 3.–6. uke',
        text: 'Klinisk responsevaluering gjøres hver 3.–6. uke, med billeddiagnostikk ved behov.', source: 'regelmotor' },
      { id: 'neo-markor', label: 'Markør/klips før oppstart ved planlagt BCS',
        text: 'Ved planlagt brystbevarende kirurgi bestilles markør eller klips i tumorsengen før oppstart, for å sikre identifikasjon av tumorområdet ved operasjon.', source: 'regelmotor' },
      { id: 'neo-mdt', label: 'Henvises til MDT',
        text: 'Pasienten henvises til multidisiplinært team (MDT).', source: 'regelmotor' },
    ],
  },
  {
    id: 'prover',
    heading: 'Blodprøver og undersøkelser før oppstart',
    lead: '',
    select: 'multi',
    note: 'Prosedyretekst. Tilpass til lokal rutine.',
    options: [
      { id: 'pro-standard', label: 'Standard blodprøver',
        text: 'Standard blodprøver for ca. mammae bestilles, eventuelt med FSH, LH og østradiol.', source: 'kliniskSvar' },
      { id: 'pro-immun', label: 'Immunterapiblodprøver',
        text: 'Ved indikasjon for immunterapi bestilles immunterapiblodprøver i forkant.', source: 'kliniskSvar' },
      { id: 'pro-ekg', label: 'EKG før oppstart',
        text: 'Det tas EKG før oppstart av behandlingen.', source: 'prosedyre' },
      { id: 'pro-ekg-etter', label: 'EKG etter oppstart',
        text: 'Det tas kontroll-EKG etter oppstart av behandlingen.', source: 'prosedyre' },
      { id: 'pro-lvef-for', label: 'LVEF-måling før oppstart',
        text: 'Det gjøres LVEF-måling før oppstart av EC90 og før oppstart av anti-HER2-behandling.', source: 'regelmotor' },
      { id: 'pro-tannstatus', label: 'Tannstatus før zoledronsyre',
        text: 'Tannstatus vurderes før oppstart av zoledronsyre.', source: 'prosedyre' },
    ],
  },
  {
    id: 'monitorering',
    heading: 'Monitorering underveis',
    lead: '',
    select: 'multi',
    options: [
      { id: 'mon-lvef', label: 'LVEF hver 3. måned',
        text: 'LVEF måles hver 3. måned til avsluttet behandling.', source: 'regelmotor' },
      { id: 'mon-hjerte', label: 'Følges for hjertetoksisitet',
        text: 'Pasienten følges for hjertetoksisitet ved EC90-behandling.', source: 'kliniskSvar' },
      { id: 'mon-hematologi', label: 'Hematologisk monitorering',
        text: 'Det gjøres hematologisk monitorering med fullblodstelling dag 1 i hver syklus.', source: 'regelmotor' },
      { id: 'mon-lever', label: 'Lever- og blodprøver ved hver kur',
        text: 'Lever- og blodprøver tas ved hver kur.', source: 'regelmotor' },
      { id: 'mon-autoimmun', label: 'Screening for autoimmune bivirkninger',
        text: 'Det gjøres screening for autoimmune bivirkninger under immunterapi.', source: 'regelmotor' },
      { id: 'mon-bentetthet', label: 'Bentetthetsmåling ved AI/goserelin',
        text: 'Ved aromatasehemmer eller goserelin uten samtidig zoledronsyre gjøres bentetthetsmåling ved oppstart, etter 1 år og deretter hvert 2. år til avsluttet behandling.', source: 'prosedyre' },
      { id: 'mon-calcium', label: 'Kalsium og vitamin D ved AI',
        text: 'Kalsium og vitamin D, 1000 mg og 800 IE daglig, gis til alle som står på aromatasehemmer.', source: 'regelmotor' },
      { id: 'mon-gcsf', label: 'G-CSF som primærprofylakse',
        text: 'Det gis G-CSF som primærprofylakse mot febril nøytropeni når det ikke gis ukentlige kurer.', source: 'regelmotor' },
      { id: 'mon-antiemetika', label: 'Antiemetisk profylakse',
        text: 'Det gis antiemetisk profylakse.', source: 'regelmotor' },
    ],
  },
  {
    id: 'saerskilt',
    heading: 'Særskilte hensyn',
    lead: '',
    select: 'multi',
    options: [
      { id: 'sar-fertilitet', label: 'Fertilitetsrådgivning før oppstart',
        text: 'Fertilitetsrådgivning og eventuelle fertilitetsbevarende tiltak tilbys før oppstart av gonadotoksisk behandling.', source: 'regelmotor' },
      { id: 'sar-alder', label: 'Alder og komorbiditet',
        text: 'Ved alder over 70–75 år vurderes behandlingen nøye opp mot komorbiditet og leveutsikter, og individuell tilpasning kan være nødvendig.', source: 'prosedyre' },
      { id: 'sar-lavpositiv', label: 'ER lav-positiv (1–10 %)',
        text: 'ER er lav-positiv i intervallet 1–10 %. Slike tumorer oppfører seg ofte mer som ER-negative, og nytten av endokrin behandling er usikker.', source: 'regelmotor' },
      { id: 'sar-n1mi', label: 'N1mi — klinisk betydning omdiskutert',
        text: 'Ved N1mi er den kliniske betydningen omdiskutert, og behandlingen vurderes individuelt.', source: 'regelmotor' },
      { id: 'sar-individuell', label: 'Individuell vurdering',
        text: 'Behandlingsvalget krever individuell vurdering.', source: 'regelmotor' },
      { id: 'sar-pasient', label: 'Diskutert med pasienten',
        text: 'Behandlingsopplegget er diskutert med pasienten.', source: 'prosedyre' },
    ],
  },
];

/** Alle alternativer flatet ut, for oppslag på id. */
export const ALL_OPTIONS = SENTENCE_GROUPS.flatMap((g) =>
  g.options.map((o) => ({ ...o, groupId: g.id, groupHeading: g.heading })),
);

export function findOption(optionId) {
  return ALL_OPTIONS.find((o) => o.id === optionId) || null;
}

export function findGroup(groupId) {
  return SENTENCE_GROUPS.find((g) => g.id === groupId) || null;
}
