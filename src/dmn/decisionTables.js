/**
 * DMN Decision Tables for CDK4/6-inhibitorvalg ved HR+/HER2- metastatisk brystkreft.
 *
 * Basert på kliniske retningslinjer:
 * - NBCG (Norsk Bryst Cancer Gruppe) retningslinjer
 * - ESMO Clinical Practice Guidelines
 * - FDA/EMA godkjenningsindikasjoner
 *
 * Tre godkjente CDK4/6-inhibitorer:
 * 1. Palbociclib (Ibrance) - bred indikasjon, mest klinisk erfaring
 * 2. Ribociclib (Kisqali) - overlevelsesdata, OBS QTc-forlengelse
 * 3. Abemaciclib (Verzenio) - kan brukes som monoterapi, OBS diaré
 *
 * Beslutningstabellen er strukturert i DMN-format med:
 * - Input: Kliniske variabler fra CQL-evaluering
 * - Rules: Betingelser med hit policy PRIORITY (P)
 * - Output: Anbefalt behandling med begrunnelse
 */

/**
 * Hovedbeslutningstabellen for CDK4/6-inhibitorvalg.
 * Hit Policy: PRIORITY - første treff med høyest prioritet vinner.
 *
 * Klinisk-redigerbar struktur: Klinikere kan legge til/endre regler
 * uten å endre kode.
 */
export const CDK46_DECISION_TABLE = {
  id: 'cdk46-inhibitor-selection',
  name: 'CDK4/6-inhibitor Valg',
  hitPolicy: 'PRIORITY',
  version: '1.0.0',
  lastUpdated: '2026-03-07',

  inputs: [
    { id: 'eligible', label: 'Kvalifisert for CDK4/6i', type: 'boolean' },
    { id: 'cardiacRisk', label: 'Kardial risiko', type: 'string', allowedValues: ['low', 'moderate', 'high'] },
    { id: 'neutropeniaRisk', label: 'Nøytropenirisiko', type: 'string', allowedValues: ['low', 'moderate', 'high'] },
    { id: 'diarrhoeaRisk', label: 'Diarérisiko', type: 'string', allowedValues: ['low', 'moderate', 'high'] },
    { id: 'hepaticFunction', label: 'Leverfunksjon', type: 'string', allowedValues: ['normal', 'mild', 'moderate', 'severe'] },
    { id: 'needMonotherapy', label: 'Behov for monoterapi', type: 'boolean' },
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string', allowedValues: ['pre', 'peri', 'post', 'unknown'] },
    { id: 'priorTherapyLines', label: 'Antall tidligere behandlingslinjer', type: 'number' },
  ],

  outputs: [
    { id: 'recommendation', label: 'Anbefalt CDK4/6-inhibitor', type: 'string' },
    { id: 'confidence', label: 'Konfidens', type: 'string', allowedValues: ['high', 'moderate', 'low'] },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
    { id: 'combinationPartner', label: 'Kombinasjonspartner', type: 'string' },
  ],

  rules: [
    // Regel 0: Ikke kvalifisert
    {
      id: 'R0',
      priority: 0,
      description: 'Ikke kvalifisert for CDK4/6-inhibitor',
      conditions: {
        eligible: false,
      },
      outputs: {
        recommendation: 'INGEN',
        confidence: 'high',
        rationale: 'Pasienten oppfyller ikke kriteriene for CDK4/6-inhibitorbehandling (krever HR+/HER2-, metastatisk, ECOG ≤2)',
        warnings: [],
        combinationPartner: null,
      },
    },

    // Regel 1: Monoterapi påkrevd → Abemaciclib (eneste godkjent som monoterapi)
    {
      id: 'R1',
      priority: 10,
      description: 'Monoterapi nødvendig - kun abemaciclib godkjent',
      conditions: {
        eligible: true,
        needMonotherapy: true,
      },
      outputs: {
        recommendation: 'Abemaciclib',
        confidence: 'high',
        rationale: 'Abemaciclib er den eneste CDK4/6-inhibitoren godkjent som monoterapi etter progresjon på endokrinterapi',
        warnings: ['Diaré er svært vanlig (>80%) - krever proaktiv håndtering med loperamid'],
        combinationPartner: null,
      },
    },

    // Regel 2: Høy kardial risiko → Unngå ribociclib (QTc-forlengelse)
    {
      id: 'R2',
      priority: 9,
      description: 'Høy kardial risiko - unngå ribociclib pga QTc-forlengelse',
      conditions: {
        eligible: true,
        cardiacRisk: 'high',
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Palbociclib',
        confidence: 'high',
        rationale: 'Ribociclib kontraindisert ved høy kardial risiko grunnet QTc-forlengelse. Palbociclib anbefalt pga gunstig sikkerhetsprofil',
        warnings: ['Nøytropeni krever regelmessig blodprøvekontroll'],
        combinationPartner: 'Letrozol eller fulvestrant',
      },
    },

    // Regel 3: Høy nøytropenirisiko → Abemaciclib (lavere nøytropenirisiko)
    {
      id: 'R3',
      priority: 8,
      description: 'Høy nøytropenirisiko - abemaciclib gir mindre nøytropeni',
      conditions: {
        eligible: true,
        neutropeniaRisk: 'high',
        diarrhoeaRisk: { not: 'high' },
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Abemaciclib',
        confidence: 'moderate',
        rationale: 'Abemaciclib har lavere forekomst av alvorlig nøytropeni sammenlignet med palbociclib og ribociclib',
        warnings: ['Diaré er vanlig - proaktiv håndtering anbefales', 'Tromboembolisk risiko bør vurderes'],
        combinationPartner: 'Letrozol eller fulvestrant',
      },
    },

    // Regel 4: Høy diarérisiko → Unngå abemaciclib
    {
      id: 'R4',
      priority: 8,
      description: 'Høy diarérisiko - unngå abemaciclib',
      conditions: {
        eligible: true,
        diarrhoeaRisk: 'high',
        cardiacRisk: { not: 'high' },
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Ribociclib',
        confidence: 'moderate',
        rationale: 'Abemaciclib unngås ved høy diarérisiko. Ribociclib anbefalt pga dokumentert overlevelsesgevinst (MONALEESA-studiene)',
        warnings: ['QTc-monitorering anbefales', 'Nøytropeni krever blodprøvekontroll'],
        combinationPartner: 'Letrozol eller fulvestrant',
      },
    },

    // Regel 5: Nedsatt leverfunksjon → Dosejustering nødvendig
    {
      id: 'R5',
      priority: 7,
      description: 'Nedsatt leverfunksjon - palbociclib best dokumentert',
      conditions: {
        eligible: true,
        hepaticFunction: ['moderate', 'severe'],
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Palbociclib',
        confidence: 'moderate',
        rationale: 'Palbociclib har best dokumentasjon for dosejustering ved nedsatt leverfunksjon. Dosereduksjon kan være nødvendig',
        warnings: ['Dosejustering ved nedsatt leverfunksjon', 'Tett monitorering av leverprøver'],
        combinationPartner: 'Letrozol eller fulvestrant',
      },
    },

    // Regel 6: Premenopausal + førstelinjebehandling → Ribociclib (MONALEESA-7)
    {
      id: 'R6',
      priority: 6,
      description: 'Premenopausal førstelinjebehandling - ribociclib (MONALEESA-7 data)',
      conditions: {
        eligible: true,
        menopausalStatus: ['pre', 'peri'],
        priorTherapyLines: 0,
        cardiacRisk: { not: 'high' },
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Ribociclib',
        confidence: 'high',
        rationale: 'Ribociclib har sterkest evidens for premenopausale pasienter i førstelinjebehandling (MONALEESA-7: signifikant OS-gevinst)',
        warnings: ['Krever ovarisk suppresjon (GnRH-agonist)', 'QTc-monitorering ved oppstart'],
        combinationPartner: 'Letrozol + goserelin',
      },
    },

    // Regel 7: Postmenopausal + førstelinjebehandling → Ribociclib (overlevelsesdata)
    {
      id: 'R7',
      priority: 5,
      description: 'Postmenopausal førstelinjebehandling - ribociclib foretrukket',
      conditions: {
        eligible: true,
        menopausalStatus: 'post',
        priorTherapyLines: 0,
        cardiacRisk: { not: 'high' },
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Ribociclib',
        confidence: 'high',
        rationale: 'Ribociclib har dokumentert total overlevelsesgevinst i MONALEESA-2 (postmenopausale, 1.linje)',
        warnings: ['QTc-monitorering ved oppstart og under behandling'],
        combinationPartner: 'Letrozol',
      },
    },

    // Regel 8: Andrelinje etter endokrinterapi → Alle tre er aktuelle
    {
      id: 'R8',
      priority: 4,
      description: 'Andrelinje etter progresjon på endokrinterapi',
      conditions: {
        eligible: true,
        priorTherapyLines: [1, 2],
        needMonotherapy: false,
      },
      outputs: {
        recommendation: 'Palbociclib',
        confidence: 'moderate',
        rationale: 'Etter progresjon på endokrinterapi er alle CDK4/6-inhibitorer aktuelle. Palbociclib i kombinasjon med fulvestrant har bred dokumentasjon (PALOMA-3)',
        warnings: ['Nøytropeni krever regelmessig blodprøvekontroll'],
        combinationPartner: 'Fulvestrant',
      },
    },

    // Regel 9: Standardanbefaling (fallback)
    {
      id: 'R9',
      priority: 1,
      description: 'Standardanbefaling når ingen spesifikke kontraindikasjoner',
      conditions: {
        eligible: true,
      },
      outputs: {
        recommendation: 'Palbociclib',
        confidence: 'moderate',
        rationale: 'Palbociclib anbefalt som standardvalg grunnet lengst klinisk erfaring og veletablert sikkerhetsprofil',
        warnings: ['Nøytropeni er den vanligste bivirkningen - regelmessig blodprøvekontroll'],
        combinationPartner: 'Aromatasehemmer eller fulvestrant',
      },
    },
  ],
};

/**
 * Tilleggsbeslutningstabellen: Endokrinterapi kombinasjonspartner
 */
export const ENDOCRINE_PARTNER_TABLE = {
  id: 'endocrine-partner-selection',
  name: 'Endokrinterapi Kombinasjonspartner',
  hitPolicy: 'FIRST',
  version: '1.0.0',

  inputs: [
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string' },
    { id: 'priorTherapyLines', label: 'Tidligere behandlingslinjer', type: 'number' },
    { id: 'priorEndocrineTherapy', label: 'Tidligere endokrinterapi', type: 'boolean' },
  ],

  outputs: [
    { id: 'partner', label: 'Kombinasjonspartner', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    {
      id: 'EP1',
      conditions: { priorTherapyLines: 0, menopausalStatus: 'post' },
      outputs: { partner: 'Letrozol', rationale: 'Aromatasehemmer i førstelinjebehandling for postmenopausale' },
    },
    {
      id: 'EP2',
      conditions: { priorTherapyLines: 0, menopausalStatus: ['pre', 'peri'] },
      outputs: { partner: 'Letrozol + Goserelin', rationale: 'Aromatasehemmer + ovarisk suppresjon for premenopausale' },
    },
    {
      id: 'EP3',
      conditions: { priorEndocrineTherapy: true },
      outputs: { partner: 'Fulvestrant', rationale: 'Fulvestrant etter progresjon på aromatasehemmer' },
    },
    {
      id: 'EP4',
      conditions: {},
      outputs: { partner: 'Aromatasehemmer', rationale: 'Standard endokrinterapi' },
    },
  ],
};

export default { CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE };
