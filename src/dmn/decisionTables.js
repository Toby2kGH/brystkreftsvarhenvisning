/**
 * DMN Decision Tables — ALL clinical decision logic.
 *
 * Every clinical decision is expressed as a transparent, editable DMN table.
 * This allows clinicians and decision-makers to inspect, verify, and modify
 * the logic that drives treatment recommendations.
 *
 * Tables:
 * 1. HER2_DETERMINATION_TABLE — HER2 from IHC + SISH
 * 2. CHEMO_PATHWAY_TABLE — HR+HER2- chemotherapy decisions (N0/N1mi/N1/N2+)
 * 3. CDK46_DECISION_TABLE — CDK4/6 adjuvant NBCG sept 2025
 * 4. ENDOCRINE_THERAPY_TABLE — Endocrine therapy selection
 * 5. ZOMETA_TABLE — Bisphosphonate eligibility
 * 6. RADIATION_TABLE — Radiation therapy
 * 7. HRPOS_HER2POS_TABLE — HR+HER2+ adjuvant treatment
 * 8. HRNEG_HER2POS_TABLE — HR-HER2+ adjuvant treatment
 * 9. TN_TABLE — Triple negative adjuvant treatment
 * 10. NEOADJUVANT_TABLE — Neoadjuvant all subgroups
 * 11. NEAR_CUTOFF_TABLE — Near-cutoff warnings for shared decision-making
 */

// ============================================================
// 1. HER2 DETERMINATION
// ============================================================

export const HER2_DETERMINATION_TABLE = {
  id: 'her2-determination',
  name: 'HER2-bestemmelse (IHC + SISH)',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'her2ihc', label: 'HER2 IHC-score', type: 'string', allowedValues: ['0', '1+', '2+', '3+'] },
    { id: 'her2sish', label: 'HER2 SISH/ISH', type: 'string', allowedValues: ['positive', 'negative', null] },
  ],

  outputs: [
    { id: 'her2Result', label: 'HER2-status', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'H1', conditions: { her2ihc: '3+' }, outputs: { her2Result: 'positive', rationale: 'IHC 3+: HER2-positiv (overekspresjon bekreftet)' } },
    { id: 'H2', conditions: { her2ihc: '0' }, outputs: { her2Result: 'negative', rationale: 'IHC 0: HER2-negativ' } },
    { id: 'H3', conditions: { her2ihc: '1+' }, outputs: { her2Result: 'negative', rationale: 'IHC 1+: HER2-negativ (lav ekspresjon, ingen amplifisering)' } },
    { id: 'H4', conditions: { her2ihc: '2+', her2sish: 'positive' }, outputs: { her2Result: 'positive', rationale: 'IHC 2+ med SISH-amplifisert: HER2-positiv' } },
    { id: 'H5', conditions: { her2ihc: '2+', her2sish: 'negative' }, outputs: { her2Result: 'negative', rationale: 'IHC 2+ med SISH ikke-amplifisert: HER2-negativ' } },
    { id: 'H6', conditions: { her2ihc: '2+' }, outputs: { her2Result: 'equivocal', rationale: 'IHC 2+ uten SISH: Ekvivokal — SISH/ISH-analyse kreves for endelig avklaring' } },
  ],
};

// ============================================================
// 2. HR+HER2- CHEMOTHERAPY PATHWAY
// ============================================================

export const CHEMO_PATHWAY_TABLE = {
  id: 'chemo-pathway-hrpos-her2neg',
  name: 'Kjemoterapi HR+HER2- (Prosigna/OncotypeDX/Grad)',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
    { id: 'grade', label: 'Histologisk grad', type: 'number' },
    { id: 'geneTest', label: 'Genekspresjonstest', type: 'string', allowedValues: ['prosigna', 'oncotypedx', 'none'] },
    { id: 'rorScore', label: 'Prosigna ROR-score', type: 'number' },
    { id: 'rsScore', label: 'OncotypeDX RS-score', type: 'number' },
    { id: 'prosignaSubtype', label: 'PAM50 subtype', type: 'string' },
    { id: 'ki67Value', label: 'Ki-67 (%)', type: 'number' },
  ],

  outputs: [
    { id: 'pathway', label: 'Kjemoterapivei', type: 'string', allowedValues: ['none', 'EC', 'EC_taxan', 'gene_test_needed', 'consider_chemo'] },
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    // === N2/N3: Always chemo ===
    { id: 'CP1', conditions: { nStage: ['N2', 'N3'] }, outputs: { pathway: 'EC_taxan', regimen: 'EC ×4 + taxan (docetaxel/paklitaxel)', rationale: '≥4 positive lymfeknuter: Kjemoterapi alltid anbefalt' } },

    // === N1 with Prosigna ===
    { id: 'CP2', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { lte: 40 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1, Prosigna ROR ≤40 (lav risiko): Endokrinterapi alene' } },
    { id: 'CP3', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { gt: 60 } }, outputs: { pathway: 'EC_taxan', regimen: 'EC ×4 + taxan', rationale: 'N1, Prosigna ROR >60 (høy risiko): EC + taxan anbefalt' } },
    { id: 'CP3b', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } }, outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC ×4', rationale: 'N1, Prosigna ROR 41-60 (intermediær): Individuell vurdering — diskuter med pasient' } },

    // === N1 with OncotypeDX ===
    { id: 'CP4', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { lte: 25 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1, OncotypeDX RS ≤25: Endokrinterapi alene (RxPONDER)' } },
    { id: 'CP5', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { gt: 25 } }, outputs: { pathway: 'EC_taxan', regimen: 'EC ×4 + taxan', rationale: 'N1, OncotypeDX RS >25: Kjemoterapi anbefalt' } },

    // === N1 without gene test ===
    { id: 'CP6', conditions: { nStage: 'N1', grade: 3 }, outputs: { pathway: 'EC_taxan', regimen: 'EC ×4 + taxan', rationale: 'N1, Grad 3 uten gentest: Kjemoterapi anbefalt' } },
    { id: 'CP7', conditions: { nStage: 'N1', grade: 1 }, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N1, Grad 1: Lav risiko, men gentest anbefales for avklaring' } },
    { id: 'CP8', conditions: { nStage: 'N1', grade: 2 }, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N1, Grad 2: Genekspresjonstest anbefales for å avklare kjemoterapibehov' } },
    { id: 'CP8b', conditions: { nStage: 'N1' }, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N1 uten grad/gentest: Anbefaler genekspresjonstest' } },

    // === N1mi with Prosigna ===
    { id: 'CP9', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { lte: 40 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1mi, Prosigna ROR ≤40: Lav risiko, endokrinterapi alene' } },
    { id: 'CP10', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { gt: 60 } }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N1mi, Prosigna ROR >60: EC ×4 anbefalt' } },
    { id: 'CP10b', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } }, outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC ×4', rationale: 'N1mi, Prosigna ROR 41-60: Intermediær — individuell vurdering' } },

    // === N1mi with OncotypeDX ===
    { id: 'CP11', conditions: { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: { lte: 25 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1mi, OncotypeDX RS ≤25: Endokrinterapi alene' } },
    { id: 'CP12', conditions: { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: { gt: 25 } }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N1mi, OncotypeDX RS >25: EC ×4 anbefalt' } },

    // === N1mi without gene test ===
    { id: 'CP13', conditions: { nStage: 'N1mi', tumorSizeMm: { lte: 10 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1mi, liten tumor ≤10mm: Ingen kjemoterapi' } },
    { id: 'CP14', conditions: { nStage: 'N1mi', grade: 3 }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N1mi, Grad 3: EC ×4 anbefalt' } },
    { id: 'CP15', conditions: { nStage: 'N1mi' }, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N1mi: Gentest anbefales for avklaring av kjemoterapibehov' } },

    // === N0 with Prosigna ===
    { id: 'CP16', conditions: { nStage: 'N0', tumorSizeMm: { lte: 10 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N0, ≤10mm: For liten tumor for kjemoterapi' } },
    { id: 'CP17', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N0, Prosigna ROR ≤40 (lav risiko): Endokrinterapi alene' } },
    { id: 'CP18', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 }, grade: 3 }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N0, Prosigna ROR >60 + G3: EC ×4' } },
    { id: 'CP18b', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 } }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N0, Prosigna ROR >60 (høy risiko): EC ×4 anbefalt' } },
    { id: 'CP18c', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } }, outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC ×4', rationale: 'N0, Prosigna ROR 41-60 (intermediær risiko): Individuell vurdering' } },

    // === N0 with OncotypeDX ===
    { id: 'CP19', conditions: { nStage: 'N0', geneTest: 'oncotypedx', rsScore: { lte: 25 } }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N0, OncotypeDX RS ≤25: Endokrinterapi alene (TAILORx)' } },
    { id: 'CP20', conditions: { nStage: 'N0', geneTest: 'oncotypedx', rsScore: { gt: 25 } }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N0, OncotypeDX RS >25: EC ×4 anbefalt' } },

    // === N0 without gene test (grade + Ki67 based) ===
    { id: 'CP21', conditions: { nStage: 'N0', grade: 1 }, outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N0, Grad 1: Lav risiko — endokrinterapi alene' } },
    { id: 'CP22', conditions: { nStage: 'N0', grade: 3 }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N0, Grad 3: EC ×4 anbefalt' } },
    { id: 'CP23', conditions: { nStage: 'N0', grade: 2, ki67Value: { gte: 30 } }, outputs: { pathway: 'EC', regimen: 'EC ×4', rationale: 'N0, Grad 2 + Ki-67 ≥30%: EC ×4 anbefalt — høy proliferasjon' } },
    { id: 'CP24', conditions: { nStage: 'N0', grade: 2 }, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N0, Grad 2: Genekspresjonstest anbefales for å avklare kjemoterapibehov' } },

    // === Fallback ===
    { id: 'CP25', conditions: {}, outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'Utilstrekkelig data — genekspresjonstest anbefales' } },
  ],
};

// ============================================================
// 3. CDK4/6 ADJUVANT (NBCG sept 2025)
// ============================================================

export const CDK46_DECISION_TABLE = {
  id: 'cdk46-adjuvant-selection',
  name: 'CDK4/6-inhibitor Adjuvant (NBCG sept 2025)',
  hitPolicy: 'PRIORITY',
  version: '2.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'cdk46eligible', label: 'Kvalifisert (HR+HER2-, adjuvant)', type: 'boolean' },
    { id: 'tSimple', label: 'T-stadium', type: 'string', allowedValues: ['T1', 'T2', 'T3', 'T4'] },
    { id: 'nStage', label: 'N-stadium', type: 'string', allowedValues: ['N0', 'N1mi', 'N1', 'N2', 'N3'] },
    { id: 'grade', label: 'Histologisk grad', type: 'number', allowedValues: [1, 2, 3] },
    { id: 'gesHighRisk', label: 'GES høy risiko', type: 'boolean' },
    { id: 'gesLowRisk', label: 'GES lav risiko', type: 'boolean' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'abemaciclib', label: 'Abemaciclib', type: 'string', allowedValues: ['yes', 'no', 'first_choice', 'if_G3'] },
    { id: 'ribociclib', label: 'Ribociclib', type: 'string', allowedValues: ['yes', 'no', 'if_G3_or_gesHigh'] },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
  ],

  rules: [
    { id: 'R0', priority: 0, description: 'Ikke kvalifisert for CDK4/6i', conditions: { cdk46eligible: false }, outputs: { abemaciclib: 'no', ribociclib: 'no', rationale: 'Krever HR+HER2-, adjuvant setting', warnings: [] } },
    { id: 'R1', priority: 12, description: 'Stadium I (T1 N0): Ingen CDK4/6i', conditions: { cdk46eligible: true, tSimple: 'T1', nStage: 'N0' }, outputs: { abemaciclib: 'no', ribociclib: 'no', rationale: 'T1 N0: Lav risiko, CDK4/6i ikke indisert', warnings: [] } },
    { id: 'R2', priority: 11, description: 'T2 N0: Ribo kun ved G3/GES høy', conditions: { cdk46eligible: true, tSimple: 'T2', nStage: 'N0' }, outputs: { abemaciclib: 'no', ribociclib: 'if_G3_or_gesHigh', rationale: 'T2 N0: Ribociclib kan vurderes ved G3 eller høyrisiko GES', warnings: ['Abemaciclib ikke indisert ved T2 N0'] } },
    { id: 'R2b', priority: 11, description: 'T1 N1mi: Ribo kun ved G3/GES høy', conditions: { cdk46eligible: true, tSimple: 'T1', nStage: 'N1mi' }, outputs: { abemaciclib: 'no', ribociclib: 'if_G3_or_gesHigh', rationale: 'T1 N1mi: Ribociclib ved G3/GES høy risiko', warnings: [] } },
    { id: 'R9', priority: 10, description: 'T2 N1mi: Ribo ved G3/GES høy', conditions: { cdk46eligible: true, tSimple: 'T2', nStage: 'N1mi' }, outputs: { abemaciclib: 'no', ribociclib: 'if_G3_or_gesHigh', rationale: 'T2 N1mi: Ribociclib ved G3/GES høy risiko', warnings: [] } },
    { id: 'R3', priority: 10, description: 'T1 N1: Abema ved G3, Ribo ved G3/GES høy', conditions: { cdk46eligible: true, tSimple: 'T1', nStage: 'N1' }, outputs: { abemaciclib: 'if_G3', ribociclib: 'if_G3_or_gesHigh', rationale: 'T1 N1: Abemaciclib ved G3 (MonarchE). Ribociclib ved G3/GES høy (NATALEE)', warnings: [] } },
    { id: 'R4', priority: 9, description: 'T2 N1: Abema ved G3, Ribo ja', conditions: { cdk46eligible: true, tSimple: 'T2', nStage: 'N1' }, outputs: { abemaciclib: 'if_G3', ribociclib: 'yes', rationale: 'T2 N1: Abemaciclib ved G3. Ribociclib anbefalt', warnings: ['Ved lav risiko GES: Vurder å avstå fra ribociclib'] } },
    { id: 'R5', priority: 9, description: 'T3 N0: Abema ved G3, Ribo ja', conditions: { cdk46eligible: true, tSimple: 'T3', nStage: 'N0' }, outputs: { abemaciclib: 'if_G3', ribociclib: 'yes', rationale: 'T3 N0: Abemaciclib ved G3. Ribociclib anbefalt', warnings: ['Ved lav risiko GES: Vurder å avstå fra ribociclib'] } },
    { id: 'R8', priority: 13, description: 'N3: Abema førstevalg', conditions: { cdk46eligible: true, nStage: 'N3' }, outputs: { abemaciclib: 'first_choice', ribociclib: 'yes', rationale: 'N3 (≥10 lymfeknuter): Abemaciclib førstevalg (MonarchE)', warnings: ['Svært høy risiko', 'Diaré vanlig med abemaciclib'] } },
    { id: 'R6', priority: 8, description: 'N2: Abema førstevalg', conditions: { cdk46eligible: true, nStage: 'N2' }, outputs: { abemaciclib: 'first_choice', ribociclib: 'yes', rationale: 'N2: Abemaciclib førstevalg (MonarchE). Ribociclib også aktuelt', warnings: ['Høyrisikogruppe'] } },
    { id: 'R6b', priority: 8, description: 'T3 N1: Abema førstevalg', conditions: { cdk46eligible: true, tSimple: 'T3', nStage: 'N1' }, outputs: { abemaciclib: 'first_choice', ribociclib: 'yes', rationale: 'T3 N1: Abemaciclib førstevalg', warnings: ['Høyrisikogruppe'] } },
    { id: 'R7', priority: 7, description: 'T4 N0: Ribo ja', conditions: { cdk46eligible: true, tSimple: 'T4', nStage: 'N0' }, outputs: { abemaciclib: 'no', ribociclib: 'yes', rationale: 'T4 N0: Ribociclib anbefalt (NATALEE)', warnings: [] } },
    { id: 'R7b', priority: 7, description: 'T4 N1: Abema ved G3, Ribo ja', conditions: { cdk46eligible: true, tSimple: 'T4', nStage: 'N1' }, outputs: { abemaciclib: 'if_G3', ribociclib: 'yes', rationale: 'T4 N1: Abemaciclib ved G3/stor tumor. Ribociclib anbefalt', warnings: ['Vurder abemaciclib ved ≥5cm'] } },
    { id: 'R7c', priority: 7, description: 'T4 N2: Abema førstevalg', conditions: { cdk46eligible: true, tSimple: 'T4', nStage: 'N2' }, outputs: { abemaciclib: 'first_choice', ribociclib: 'yes', rationale: 'T4 N2: Abemaciclib førstevalg', warnings: ['Høyrisikogruppe'] } },
    { id: 'R10', priority: 1, description: 'Fallback kvalifiserte', conditions: { cdk46eligible: true }, outputs: { abemaciclib: 'no', ribociclib: 'if_G3_or_gesHigh', rationale: 'Individuell vurdering nødvendig', warnings: ['Individuell vurdering'] } },
  ],
};

// ============================================================
// 4. ENDOCRINE THERAPY
// ============================================================

export const ENDOCRINE_THERAPY_TABLE = {
  id: 'endocrine-therapy-selection',
  name: 'Endokrinterapi',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'hrPositive', label: 'HR-positiv', type: 'boolean' },
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string', allowedValues: ['pre', 'peri', 'post', 'unknown'] },
    { id: 'isHighRisk', label: 'Høy risiko (N+, G3, GES høy, eller kjemoterapi)', type: 'boolean' },
  ],

  outputs: [
    { id: 'therapy', label: 'Terapi', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'duration', label: 'Varighet', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'ET0', conditions: { hrPositive: false }, outputs: { therapy: 'ingen', detail: 'Ikke HR-positiv — ingen endokrinterapi', duration: '-', rationale: 'Endokrinterapi kun ved HR+ tumorer' } },
    { id: 'ET1', conditions: { hrPositive: true, menopausalStatus: 'post' }, outputs: { therapy: 'aromatasehemmer', detail: 'Aromatasehemmer (letrozol/anastrozol) i 5 år', duration: '5 år', rationale: 'Standard for postmenopausale: AI mer effektivt enn tamoxifen' } },
    { id: 'ET2', conditions: { hrPositive: true, menopausalStatus: ['pre', 'peri'], isHighRisk: true }, outputs: { therapy: 'tamoxifen_ofs', detail: 'Tamoxifen + ovarisk suppresjon (GnRH-agonist/goserelin). Evt. AI + OFS ved svært høy risiko', duration: '5-10 år', rationale: 'SOFT/TEXT: OFS-tillegg ved høyrisiko premenopausale (alder <35, N+, G3, kjemoterapi)' } },
    { id: 'ET3', conditions: { hrPositive: true, menopausalStatus: ['pre', 'peri'] }, outputs: { therapy: 'tamoxifen', detail: 'Tamoxifen 20mg daglig i 5-10 år', duration: '5-10 år', rationale: 'Standard for pre/perimenopausal uten høyrisikofaktorer' } },
    { id: 'ET4', conditions: { hrPositive: true }, outputs: { therapy: 'tamoxifen', detail: 'Tamoxifen (menopausal status ukjent)', duration: '5 år', rationale: 'Standard endokrinterapi når menopausal status ukjent' } },
  ],
};

// ============================================================
// 5. ZOMETA (BISPHOSPHONATE)
// ============================================================

export const ZOMETA_TABLE = {
  id: 'zometa-eligibility',
  name: 'Zoledronsyre (bisfosfonat)',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'hasSystemicTherapy', label: 'Mottar systemisk behandling', type: 'boolean' },
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string' },
    { id: 'hasOFS', label: 'Ovarisk suppresjon (OFS)', type: 'boolean' },
    { id: 'age', label: 'Alder', type: 'number' },
  ],

  outputs: [
    { id: 'eligible', label: 'Indisert', type: 'boolean' },
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'Z0', conditions: { hasSystemicTherapy: false }, outputs: { eligible: false, regimen: '-', rationale: 'Ingen systemisk behandling — zoledronsyre ikke indisert' } },
    { id: 'Z1', conditions: { hasSystemicTherapy: true, menopausalStatus: 'post' }, outputs: { eligible: true, regimen: 'Zoledronsyre 4mg iv q6m × 6 (3 år)', rationale: 'Postmenopausal med systemisk behandling: ABCSG-12/AZURE — reduserer fjernresidiv' } },
    { id: 'Z2', conditions: { hasSystemicTherapy: true, menopausalStatus: ['pre', 'peri'], hasOFS: true }, outputs: { eligible: true, regimen: 'Zoledronsyre 4mg iv q6m × 6 (3 år)', rationale: 'Premenopausal med OFS: Samme indikasjon som postmenopausale' } },
    { id: 'Z3', conditions: { hasSystemicTherapy: true, age: { gte: 55 } }, outputs: { eligible: true, regimen: 'Zoledronsyre 4mg iv q6m × 6 (3 år)', rationale: 'Alder ≥55 med systemisk behandling' } },
    { id: 'Z4', conditions: { hasSystemicTherapy: true }, outputs: { eligible: false, regimen: '-', rationale: 'Premenopausal uten OFS, alder <55: Zoledronsyre ikke indisert' } },
  ],
};

// ============================================================
// 6. RADIATION
// ============================================================

export const RADIATION_TABLE = {
  id: 'radiation-therapy',
  name: 'Strålebehandling',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'surgeryType', label: 'Kirurgitype', type: 'string', allowedValues: ['bcs', 'mastectomy'] },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tSimple', label: 'T-stadium', type: 'string' },
  ],

  outputs: [
    { id: 'recommended', label: 'Anbefalt', type: 'boolean' },
    { id: 'type', label: 'Type', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    // BCS — always radiation
    { id: 'RT1', conditions: { surgeryType: 'bcs', nStage: ['N1', 'N2', 'N3'] }, outputs: { recommended: true, type: 'bryst_og_regional', detail: 'Hele brystet + regionale lymfeknuter', rationale: 'BCS + lymfeknutepositiv: Lokoregional stråling (EORTC/DBCG)' } },
    { id: 'RT2', conditions: { surgeryType: 'bcs' }, outputs: { recommended: true, type: 'bryst', detail: 'Hele brystet (boost til tumorleie)', rationale: 'Brystbevarende kirurgi: Alltid strålebehandling mot hele brystet' } },

    // Mastectomy — conditional
    { id: 'RT3', conditions: { surgeryType: 'mastectomy', nStage: ['N2', 'N3'] }, outputs: { recommended: true, type: 'lokoregional', detail: 'Brystvegg + regionale lymfeknuter', rationale: 'Mastektomi + ≥4 positive knuter: Lokoregional stråling anbefalt' } },
    { id: 'RT4', conditions: { surgeryType: 'mastectomy', nStage: 'N1' }, outputs: { recommended: true, type: 'lokoregional', detail: 'Brystvegg + regionale lymfeknuter', rationale: 'Mastektomi + N1: Lokoregional stråling anbefalt (1-3 positive knuter)' } },
    { id: 'RT5', conditions: { surgeryType: 'mastectomy', tSimple: ['T3', 'T4'] }, outputs: { recommended: true, type: 'lokoregional', detail: 'Brystvegg + regionale lymfeknuter', rationale: 'Mastektomi + stor tumor (T3/T4): Lokoregional stråling anbefalt' } },
    { id: 'RT6', conditions: { surgeryType: 'mastectomy' }, outputs: { recommended: false, type: 'ingen', detail: 'Ingen strålebehandling', rationale: 'Mastektomi + N0/N1mi + T1-T2: Strålebehandling ikke rutinemessig anbefalt' } },

    // No surgery info
    { id: 'RT7', conditions: {}, outputs: { recommended: null, type: 'ukjent', detail: 'Kirurgitype mangler', rationale: 'Kan ikke vurdere strålebehandling uten kirurgiinformasjon' } },
  ],
};

// ============================================================
// 7. HR+HER2+ ADJUVANT
// ============================================================

export const HRPOS_HER2POS_TABLE = {
  id: 'hrpos-her2pos-adjuvant',
  name: 'HR+HER2+ Adjuvant behandling',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'HH1', conditions: { bioGroup: 'HR+HER2+', nStage: 'N0', tumorSizeMm: { lte: 20 } }, outputs: { regimen: 'Paklitaxel ukentlig ×12 + Trastuzumab 1 år', detail: 'APT-regimet: Paklitaxel 80mg/m² ukentlig × 12 + trastuzumab q3w totalt 1 år', rationale: 'Lav risiko HR+HER2+ (T1 N0): APT-regimet tilstrekkelig (APT-studien)' } },
    { id: 'HH2', conditions: { bioGroup: 'HR+HER2+', nStage: 'N0' }, outputs: { regimen: 'TC ×4 + HP 1 år', detail: 'Docetaxel/Cyklofosfamid × 4 + trastuzumab/pertuzumab q3w totalt 1 år', rationale: 'HR+HER2+ N0 med større tumor: TC-HP' } },
    { id: 'HH3', conditions: { bioGroup: 'HR+HER2+', nStage: 'N1mi' }, outputs: { regimen: 'TC ×4 + HP 1 år', detail: 'Docetaxel/Cyklofosfamid × 4 + trastuzumab/pertuzumab q3w totalt 1 år', rationale: 'HR+HER2+ N1mi: TC-HP' } },
    { id: 'HH4', conditions: { bioGroup: 'HR+HER2+' }, outputs: { regimen: 'EC ×4 → Taxan + HP 1 år', detail: 'EC × 4, deretter taxan + trastuzumab + pertuzumab. HP totalt 1 år. Pertuzumab ved nodepositiv', rationale: 'Nodepositiv HR+HER2+: Full kjemoterapi + dobbel HER2-blokade (APHINITY)' } },
  ],
};

// ============================================================
// 8. HR-HER2+ ADJUVANT
// ============================================================

export const HRNEG_HER2POS_TABLE = {
  id: 'hrneg-her2pos-adjuvant',
  name: 'HR-HER2+ Adjuvant behandling',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'NH1', conditions: { bioGroup: 'HR-HER2+', nStage: 'N0', tumorSizeMm: { lte: 20 } }, outputs: { regimen: 'Paklitaxel ×12 + Trastuzumab 1 år', detail: 'APT-regimet: Paklitaxel 80mg/m² ukentlig × 12 + trastuzumab q3w 1 år', rationale: 'Lav risiko HR-HER2+: APT-regimet (APT-studien)' } },
    { id: 'NH2', conditions: { bioGroup: 'HR-HER2+', nStage: 'N0' }, outputs: { regimen: 'TC ×4 + Trastuzumab 1 år', detail: 'Docetaxel/Cyklofosfamid × 4 + trastuzumab q3w totalt 1 år', rationale: 'HR-HER2+ N0 med større tumor' } },
    { id: 'NH3', conditions: { bioGroup: 'HR-HER2+' }, outputs: { regimen: 'EC ×4 → Taxan + HP 1 år', detail: 'EC × 4, deretter taxan + trastuzumab + pertuzumab q3w. HP totalt 1 år', rationale: 'Nodepositiv HR-HER2+: Full kjemoterapi + dobbel HER2-blokade (APHINITY)' } },
  ],
};

// ============================================================
// 9. TRIPLE NEGATIVE ADJUVANT
// ============================================================

export const TN_TABLE = {
  id: 'tn-adjuvant',
  name: 'Trippel negativ (TN) Adjuvant behandling',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
    { id: 'stadium', label: 'Stadium', type: 'string' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
  ],

  rules: [
    { id: 'TN1', conditions: { bioGroup: 'TN', nStage: 'N0', tumorSizeMm: { lte: 10 } }, outputs: { regimen: 'Vurder kjemoterapi individuelt', detail: 'Liten TN tumor (≤10mm N0): Individuell vurdering', rationale: 'Svært liten TN: Prognose relativt god, men TN-biologi er aggressiv', warnings: ['Individuell vurdering — diskuter med pasient'] } },
    { id: 'TN2', conditions: { bioGroup: 'TN', nStage: 'N0' }, outputs: { regimen: 'EC ×4 + Taxan', detail: 'Epirubicin/Cyklofosfamid × 4, deretter docetaxel/paklitaxel', rationale: 'TN N0: Standard adjuvant kjemoterapi', warnings: [] } },
    { id: 'TN3', conditions: { bioGroup: 'TN', nStage: 'N1mi' }, outputs: { regimen: 'EC ×4 + Taxan', detail: 'EC × 4 + taxan', rationale: 'TN N1mi: Kjemoterapi anbefalt', warnings: [] } },
    { id: 'TN4', conditions: { bioGroup: 'TN' }, outputs: { regimen: 'EC ×4 + Taxan ± Karboplatin + Pembrolizumab', detail: 'EC × 4, deretter taxan ± karboplatin. Vurder pembrolizumab ved stadium II-III (KEYNOTE-522)', rationale: 'Nodepositiv TN: Intensivert kjemoterapi ± immunterapi', warnings: ['Vurder pembrolizumab (Keytruda) ved stadium II-III (KEYNOTE-522)', 'Karboplatin kan gi økt hematologisk toksisitet'] } },
  ],
};

// ============================================================
// 10. NEOADJUVANT
// ============================================================

export const NEOADJUVANT_TABLE = {
  id: 'neoadjuvant-treatment',
  name: 'Neoadjuvant behandling (alle undergrupper)',
  hitPolicy: 'FIRST',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'isNeoadjuvant', label: 'Neoadjuvant modus', type: 'boolean' },
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string', allowedValues: ['HR+HER2-', 'HR+HER2+', 'HR-HER2+', 'TN'] },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
  ],

  rules: [
    { id: 'NEO0', conditions: { isNeoadjuvant: false }, outputs: { regimen: '-', detail: 'Ikke neoadjuvant', rationale: '-', warnings: [] } },
    { id: 'NEO1', conditions: { isNeoadjuvant: true, bioGroup: 'HR+HER2-' }, outputs: { regimen: 'EC ×4 → Taxan', detail: 'Neoadjuvant: EC × 4, deretter taxan × 12 uker. Endokrinterapi postoperativt', rationale: 'HR+HER2- neoadjuvant: Standard kjemoterapi', warnings: ['Henvisning til MDT/onkolog', 'Endokrinterapi planlegges postoperativt'] } },
    { id: 'NEO2', conditions: { isNeoadjuvant: true, bioGroup: 'HR+HER2+' }, outputs: { regimen: 'EC ×4 → Taxan + HP', detail: 'Neoadjuvant: EC × 4, deretter taxan + trastuzumab + pertuzumab. HP totalt 1 år', rationale: 'HR+HER2+ neoadjuvant: Dobbel HER2-blokade (NeoSphere/TRYPHAENA)', warnings: ['Henvisning til MDT/onkolog', 'Ved pCR: Fortsett HP. Ved non-pCR: Vurder T-DM1 (KATHERINE)'] } },
    { id: 'NEO3', conditions: { isNeoadjuvant: true, bioGroup: 'HR-HER2+' }, outputs: { regimen: 'EC ×4 → Taxan + HP', detail: 'Neoadjuvant: EC × 4, deretter taxan + trastuzumab + pertuzumab. HP totalt 1 år', rationale: 'HR-HER2+ neoadjuvant: Dobbel HER2-blokade', warnings: ['Henvisning til MDT/onkolog', 'Ved non-pCR: T-DM1 14 kurer (KATHERINE)'] } },
    { id: 'NEO4', conditions: { isNeoadjuvant: true, bioGroup: 'TN' }, outputs: { regimen: 'Pembrolizumab + Karboplatin/Taxan → EC', detail: 'KEYNOTE-522: Pembrolizumab + karboplatin + paklitaxel × 12 uker, deretter pembrolizumab + EC × 4. Adjuvant pembrolizumab 9 kurer', rationale: 'TN neoadjuvant: Immunterapi + kjemoterapi (KEYNOTE-522)', warnings: ['Henvisning til MDT/onkolog', 'Immunterapi — screening for autoimmunitet', 'Ved non-pCR: Vurder capecitabin (CREATE-X)'] } },
  ],
};

// ============================================================
// 11. NEAR-CUTOFF WARNINGS
// ============================================================

export const NEAR_CUTOFF_TABLE = {
  id: 'near-cutoff-warnings',
  name: 'Grenseverdi-advarsler (nær cut-off)',
  hitPolicy: 'COLLECT',
  version: '1.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'rorScore', label: 'Prosigna ROR-score', type: 'number' },
    { id: 'rsScore', label: 'OncotypeDX RS-score', type: 'number' },
    { id: 'ki67Value', label: 'Ki-67 (%)', type: 'number' },
    { id: 'erPercent', label: 'ER (%)', type: 'number' },
    { id: 'prPercent', label: 'PR (%)', type: 'number' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
    { id: 'grade', label: 'Histologisk grad', type: 'number' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
  ],

  outputs: [
    { id: 'parameter', label: 'Parameter', type: 'string' },
    { id: 'warning', label: 'Advarsel', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
  ],

  rules: [
    // ROR near thresholds
    { id: 'NC1', conditions: { rorScore: { gte: 36, lte: 44 } }, outputs: { parameter: 'ROR-score', warning: 'Nær grenseverdi 40 (lav/intermediær)', detail: 'ROR-score nær 40: Forskjellen mellom «lav risiko» og «intermediær» kan være marginal. Diskuter kost/nytte med pasient' } },
    { id: 'NC2', conditions: { rorScore: { gte: 56, lte: 64 } }, outputs: { parameter: 'ROR-score', warning: 'Nær grenseverdi 60 (intermediær/høy)', detail: 'ROR-score nær 60: Forskjellen mellom «intermediær» og «høy risiko» er marginal. Vurder tilleggsrisikofaktorer' } },

    // RS near threshold
    { id: 'NC3', conditions: { rsScore: { gte: 22, lte: 28 } }, outputs: { parameter: 'RS-score', warning: 'Nær grenseverdi 25 (OncotypeDX)', detail: 'RS-score nær 25: Grense for kjemoterapibehov. Ved postmenopausal: RS 16-25 har liten nytte av kjemoterapi (TAILORx). Diskuter med pasient' } },

    // Ki-67 near threshold
    { id: 'NC4', conditions: { ki67Value: { gte: 15, lte: 24 } }, outputs: { parameter: 'Ki-67', warning: 'Nær grenseverdi 20% (luminal A/B)', detail: 'Ki-67 nær 20%: Grenseverdi for luminal A-like vs B-like klassifisering. Ki-67 har betydelig inter-observer variabilitet' } },

    // ER low positive
    { id: 'NC5', conditions: { erPercent: { gte: 1, lte: 10 } }, outputs: { parameter: 'ER', warning: 'Lav ER-positivitet (1-10%)', detail: 'ER 1-10%: «Lav positiv» — biologisk usikkert. Tumorer med ER 1-10% oppfører seg ofte mer som ER-negative. Vurder om endokrinterapi gir tilstrekkelig nytte' } },

    // PR low
    { id: 'NC6', conditions: { prPercent: { gte: 1, lte: 10 } }, outputs: { parameter: 'PR', warning: 'Lav PR-positivitet (1-10%)', detail: 'PR 1-10%: Lav PR-ekspresjon tyder på luminal B-like biologi selv med gunstig grad/Ki-67' } },

    // Tumor size near T-stage cutoffs
    { id: 'NC7', conditions: { tumorSizeMm: { gte: 18, lte: 22 } }, outputs: { parameter: 'Tumorstørrelse', warning: 'Nær T1c/T2 grense (20mm)', detail: 'Tumor ~20mm: Grensen mellom T1c og T2. Millimeterforskjell kan påvirke stadieinndelingen' } },
    { id: 'NC8', conditions: { tumorSizeMm: { gte: 48, lte: 52 } }, outputs: { parameter: 'Tumorstørrelse', warning: 'Nær T2/T3 grense (50mm)', detail: 'Tumor ~50mm: Grensen mellom T2 og T3. T3 kan kvalifisere for neoadjuvant og/eller andre CDK4/6i-indikasjoner' } },

    // Node-related
    { id: 'NC9', conditions: { nStage: 'N1mi' }, outputs: { parameter: 'N-stadium', warning: 'Mikrometastase (N1mi)', detail: 'N1mi: Klinisk betydning omdiskutert. Noen retningslinjer behandler som N0, andre som N1. Individuell vurdering nødvendig' } },
  ],
};

// ============================================================
// Export ALL tables
// ============================================================

export const ALL_DECISION_TABLES = {
  'her2-determination': HER2_DETERMINATION_TABLE,
  'chemo-pathway-hrpos-her2neg': CHEMO_PATHWAY_TABLE,
  'cdk46-adjuvant-selection': CDK46_DECISION_TABLE,
  'endocrine-therapy-selection': ENDOCRINE_THERAPY_TABLE,
  'zometa-eligibility': ZOMETA_TABLE,
  'radiation-therapy': RADIATION_TABLE,
  'hrpos-her2pos-adjuvant': HRPOS_HER2POS_TABLE,
  'hrneg-her2pos-adjuvant': HRNEG_HER2POS_TABLE,
  'tn-adjuvant': TN_TABLE,
  'neoadjuvant-treatment': NEOADJUVANT_TABLE,
  'near-cutoff-warnings': NEAR_CUTOFF_TABLE,
};

// Legacy export for backward compatibility
export const ENDOCRINE_PARTNER_TABLE = ENDOCRINE_THERAPY_TABLE;

export default ALL_DECISION_TABLES;
