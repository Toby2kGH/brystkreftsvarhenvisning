/**
 * DMN Decision Tables for CDK4/6-inhibitor adjuvant behandling.
 *
 * Basert på NBCG Handlingsprogram (mars 2025) + CDK4/6-oppdatering (september 2025).
 *
 * Adjuvant CDK4/6-inhibitorer:
 * 1. Abemaciclib (Verzenios) — MonarchE-studien, 2 år adjuvant
 * 2. Ribociclib (Kisqali) — NATALEE-studien, 3 år adjuvant
 *
 * Indikasjoner basert på stadium (T+N) og tumorgrad/genekspresjonstest.
 */

/**
 * CDK4/6-inhibitor adjuvant beslutningstabel.
 * Hit Policy: PRIORITY — høyeste prioritet vinner.
 *
 * Input fra CQL: cdk46eligible, tSimple, nStage, grade, gesHighRisk, gesLowRisk, geneTestDone
 * Output: abemaciclib og ribociclib anbefalinger
 */
export const CDK46_DECISION_TABLE = {
  id: 'cdk46-adjuvant-selection',
  name: 'CDK4/6-inhibitor Adjuvant Valg (NBCG sept 2025)',
  hitPolicy: 'PRIORITY',
  version: '2.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'cdk46eligible', label: 'Kvalifisert for CDK4/6i (HR+HER2-, adjuvant)', type: 'boolean' },
    { id: 'tSimple', label: 'T-stadium (forenklet)', type: 'string', allowedValues: ['T1', 'T2', 'T3', 'T4'] },
    { id: 'nStage', label: 'N-stadium', type: 'string', allowedValues: ['N0', 'N1mi', 'N1', 'N2', 'N3'] },
    { id: 'grade', label: 'Histologisk grad', type: 'number', allowedValues: [1, 2, 3] },
    { id: 'gesHighRisk', label: 'Genekspresjonstest høy risiko', type: 'boolean' },
    { id: 'gesLowRisk', label: 'Genekspresjonstest lav risiko', type: 'boolean' },
    { id: 'geneTestDone', label: 'Genekspresjonstest utført', type: 'boolean' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'abemaciclib', label: 'Abemaciclib anbefaling', type: 'string', allowedValues: ['yes', 'no', 'first_choice', 'if_G3'] },
    { id: 'ribociclib', label: 'Ribociclib anbefaling', type: 'string', allowedValues: ['yes', 'no', 'if_high_risk', 'if_G3_or_gesHigh'] },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
  ],

  rules: [
    // R0: Ikke kvalifisert
    {
      id: 'R0',
      priority: 0,
      description: 'Ikke kvalifisert for adjuvant CDK4/6-inhibitor',
      conditions: {
        cdk46eligible: false,
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'no',
        rationale: 'Pasienten oppfyller ikke kriteriene for adjuvant CDK4/6-inhibitor (krever HR+HER2-, adjuvant setting)',
        warnings: [],
      },
    },

    // R1: Stadium I (T1 N0) — Ingen CDK4/6i
    {
      id: 'R1',
      priority: 12,
      description: 'Stadium I (T1 N0): Ingen CDK4/6-inhibitor',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T1',
        nStage: 'N0',
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'no',
        rationale: 'Stadium I (T1 N0): Lav risiko, CDK4/6-inhibitor ikke indisert',
        warnings: [],
      },
    },

    // R2: Stadium IIA (T2 N0) — Ribociclib kun ved G3 eller GES høy risiko
    {
      id: 'R2',
      priority: 11,
      description: 'Stadium IIA (T2 N0): Ribociclib kun ved G3 eller høyrisiko GES',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T2',
        nStage: 'N0',
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'if_G3_or_gesHigh',
        rationale: 'Stadium IIA (T2 N0): Ribociclib kan vurderes ved G3 eller høyrisiko genekspresjonstest',
        warnings: ['Abemaciclib ikke indisert ved T2 N0'],
      },
    },

    // R2b: Stadium IIA (T1 N1mi) — Lignende T2N0
    {
      id: 'R2b',
      priority: 11,
      description: 'T1 N1mi: Ribociclib kun ved G3 eller høyrisiko GES',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T1',
        nStage: 'N1mi',
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'if_G3_or_gesHigh',
        rationale: 'T1 N1mi: Ribociclib kan vurderes ved G3 eller høyrisiko genekspresjonstest',
        warnings: [],
      },
    },

    // R3: Stadium IIA (T1 N1) — Abemaciclib ved G3, Ribociclib ved G3/GES høy
    {
      id: 'R3',
      priority: 10,
      description: 'Stadium IIA (T1 N1): Abemaciclib ved G3, Ribociclib ved G3/GES høy risiko',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T1',
        nStage: 'N1',
      },
      outputs: {
        abemaciclib: 'if_G3',
        ribociclib: 'if_G3_or_gesHigh',
        rationale: 'Stadium IIA (T1 N1): Abemaciclib ved grad 3 (MonarchE). Ribociclib ved grad 3 eller høyrisiko GES (NATALEE)',
        warnings: [],
      },
    },

    // R4: Stadium IIB (T2 N1) — Abemaciclib ved G3, Ribociclib ja (unntatt GES lav)
    {
      id: 'R4',
      priority: 9,
      description: 'Stadium IIB (T2 N1): Abemaciclib ved G3, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T2',
        nStage: 'N1',
      },
      outputs: {
        abemaciclib: 'if_G3',
        ribociclib: 'yes',
        rationale: 'Stadium IIB (T2 N1): Abemaciclib ved grad 3. Ribociclib anbefalt (unntatt ved lav risiko GES)',
        warnings: ['Ved lav risiko genekspresjonstest: Vurder å avstå fra ribociclib'],
      },
    },

    // R5: Stadium IIB (T3 N0) — Abemaciclib ved G3, Ribociclib ja
    {
      id: 'R5',
      priority: 9,
      description: 'Stadium IIB (T3 N0): Abemaciclib ved G3, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T3',
        nStage: 'N0',
      },
      outputs: {
        abemaciclib: 'if_G3',
        ribociclib: 'yes',
        rationale: 'Stadium IIB (T3 N0): Abemaciclib ved grad 3. Ribociclib anbefalt (unntatt ved lav risiko GES)',
        warnings: ['Ved lav risiko genekspresjonstest: Vurder å avstå fra ribociclib'],
      },
    },

    // R6: Stadium IIIA (N2 eller T3N1) — Abemaciclib førstevalg, Ribociclib ja
    {
      id: 'R6',
      priority: 8,
      description: 'Stadium IIIA (N2/T3N1): Abemaciclib førstevalg, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        nStage: 'N2',
      },
      outputs: {
        abemaciclib: 'first_choice',
        ribociclib: 'yes',
        rationale: 'Stadium IIIA (N2): Abemaciclib førstevalg (MonarchE). Ribociclib også aktuelt (NATALEE)',
        warnings: ['Høyrisikogruppe — CDK4/6-inhibitor sterkt anbefalt'],
      },
    },

    // R6b: T3 N1
    {
      id: 'R6b',
      priority: 8,
      description: 'Stadium IIIA (T3 N1): Abemaciclib førstevalg, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T3',
        nStage: 'N1',
      },
      outputs: {
        abemaciclib: 'first_choice',
        ribociclib: 'yes',
        rationale: 'Stadium IIIA (T3 N1): Abemaciclib førstevalg (MonarchE). Ribociclib også aktuelt (NATALEE)',
        warnings: ['Høyrisikogruppe — CDK4/6-inhibitor sterkt anbefalt'],
      },
    },

    // R7: Stadium IIIB (T4) — Differensiert etter N-status
    {
      id: 'R7',
      priority: 7,
      description: 'T4 N0: Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T4',
        nStage: 'N0',
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'yes',
        rationale: 'T4 N0: Ribociclib anbefalt (NATALEE)',
        warnings: [],
      },
    },

    // R7b: T4 N1 — Abemaciclib ved G3 eller tumor ≥5cm
    {
      id: 'R7b',
      priority: 7,
      description: 'T4 N1: Abemaciclib ved G3/stor tumor, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T4',
        nStage: 'N1',
      },
      outputs: {
        abemaciclib: 'if_G3',
        ribociclib: 'yes',
        rationale: 'T4 N1: Abemaciclib ved G3 eller tumorstørrelse ≥50mm. Ribociclib anbefalt',
        warnings: ['Vurder abemaciclib ved stor tumor (≥5cm) uavhengig av grad'],
      },
    },

    // R7c: T4 N2 — Abemaciclib førstevalg
    {
      id: 'R7c',
      priority: 7,
      description: 'T4 N2: Abemaciclib førstevalg, Ribociclib ja',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T4',
        nStage: 'N2',
      },
      outputs: {
        abemaciclib: 'first_choice',
        ribociclib: 'yes',
        rationale: 'T4 N2: Abemaciclib førstevalg. Ribociclib også aktuelt',
        warnings: ['Høyrisikogruppe — CDK4/6-inhibitor sterkt anbefalt'],
      },
    },

    // R8: N3 (uansett T) — Abemaciclib førstevalg, Ribociclib ja
    {
      id: 'R8',
      priority: 13,
      description: 'N3 (≥10 positive lymfeknuter): Abemaciclib førstevalg',
      conditions: {
        cdk46eligible: true,
        nStage: 'N3',
      },
      outputs: {
        abemaciclib: 'first_choice',
        ribociclib: 'yes',
        rationale: 'N3 (≥10 positive lymfeknuter): Abemaciclib førstevalg (MonarchE). Ribociclib også aktuelt (NATALEE)',
        warnings: ['Svært høy risiko — CDK4/6-inhibitor sterkt anbefalt', 'Diaré vanlig med abemaciclib — proaktiv håndtering'],
      },
    },

    // R9: T2 N1mi — Mellomgruppe
    {
      id: 'R9',
      priority: 10,
      description: 'T2 N1mi: Ribociclib ved G3/GES høy risiko',
      conditions: {
        cdk46eligible: true,
        tSimple: 'T2',
        nStage: 'N1mi',
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'if_G3_or_gesHigh',
        rationale: 'T2 N1mi: Ribociclib kan vurderes ved G3 eller høyrisiko genekspresjonstest',
        warnings: [],
      },
    },

    // R10: Fallback for eligible patients
    {
      id: 'R10',
      priority: 1,
      description: 'Standardanbefaling kvalifiserte pasienter',
      conditions: {
        cdk46eligible: true,
      },
      outputs: {
        abemaciclib: 'no',
        ribociclib: 'if_G3_or_gesHigh',
        rationale: 'Vurder CDK4/6-inhibitor basert på individuell risikoprofil',
        warnings: ['Individuell vurdering nødvendig'],
      },
    },
  ],
};

/**
 * Endokrinterapi kombinasjonspartner — beholdt fra v1 med oppdateringer.
 */
export const ENDOCRINE_PARTNER_TABLE = {
  id: 'endocrine-partner-selection',
  name: 'Endokrinterapi Kombinasjonspartner',
  hitPolicy: 'FIRST',
  version: '2.0.0',

  inputs: [
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string' },
    { id: 'priorTherapyLines', label: 'Tidligere behandlingslinjer', type: 'number' },
    { id: 'isHighRisk', label: 'Høyrisikopasient', type: 'boolean' },
  ],

  outputs: [
    { id: 'partner', label: 'Endokrinterapi', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    {
      id: 'EP1',
      conditions: { menopausalStatus: 'post' },
      outputs: { partner: 'Aromatasehemmer (AI) 5 år', rationale: 'Standard for postmenopausale: AI (letrozol/anastrozol)' },
    },
    {
      id: 'EP2',
      conditions: { menopausalStatus: ['pre', 'peri'], isHighRisk: true },
      outputs: { partner: 'Tamoxifen + OFS (evt. AI + OFS)', rationale: 'Høyrisiko pre/perimenopausal: Tamoxifen + ovarisk suppresjon, evt AI + OFS' },
    },
    {
      id: 'EP3',
      conditions: { menopausalStatus: ['pre', 'peri'] },
      outputs: { partner: 'Tamoxifen 5-10 år', rationale: 'Standard for pre/perimenopausal: Tamoxifen' },
    },
    {
      id: 'EP4',
      conditions: {},
      outputs: { partner: 'Tamoxifen', rationale: 'Standard endokrinterapi' },
    },
  ],
};

export default { CDK46_DECISION_TABLE, ENDOCRINE_PARTNER_TABLE };
