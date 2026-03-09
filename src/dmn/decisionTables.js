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
//    Aligned with NBCG tabellarisk oversikt 17.12.24:
//    pT1-2 pN0 (Prosigna) and postmenopausal pT1-2 pN1 (OncotypeDX)
// ============================================================

export const CHEMO_PATHWAY_TABLE = {
  id: 'chemo-pathway-hrpos-her2neg',
  name: 'Kjemoterapi HR+HER2- (NBCG 17.12.24)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-08',

  inputs: [
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tStage', label: 'T-stadium (detaljert)', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
    { id: 'grade', label: 'Histologisk grad', type: 'number' },
    { id: 'geneTest', label: 'Genekspresjonstest', type: 'string', allowedValues: ['prosigna', 'oncotypedx', 'none'] },
    { id: 'rorScore', label: 'Prosigna ROR-score', type: 'number' },
    { id: 'rsScore', label: 'OncotypeDX RS-score', type: 'number' },
    { id: 'prosignaSubtype', label: 'PAM50 subtype', type: 'string' },
    { id: 'erPercent', label: 'ER (%)', type: 'number' },
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string' },
    { id: 'ki67Value', label: 'Ki-67 (%)', type: 'number' },
  ],

  outputs: [
    { id: 'pathway', label: 'Kjemoterapivei', type: 'string', allowedValues: ['none', 'EC', 'EC_taxan', 'gene_test_needed', 'consider_chemo'] },
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    // ==========================================
    // N2/N3: Always chemo
    // ==========================================
    { id: 'CP1', conditions: { nStage: ['N2', 'N3'] }, outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN2-3 (≥4 positive lymfeknuter): EC90 ×4 eller TC ×4 → endokrin. Zoledronsyre ved postmenopausal status. Spesielt omfattende lymfeknutemetastasering kan gi grunnlag for EC90 ×4 + taxan' } },

    // ==========================================
    // N0, Prosigna — Luminal A, ROR 0-40
    // ==========================================
    { id: 'CP_A1', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'none', regimen: 'Ingen systembehandling', rationale: 'pN0, Prosigna Lum A, ROR ≤40, pT1a-b: Ingen behandling' } },
    { id: 'CP_A2', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 }, tStage: 'T1c', grade: 1 },
      outputs: { pathway: 'none', regimen: 'Ingen behandling', rationale: 'pN0, Prosigna ROR ≤40, pT1c, Grad 1: Ingen behandling' } },
    { id: 'CP_A3', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 }, tStage: 'T1c' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Prosigna ROR ≤40, pT1c, Grad 2-3: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_A4', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 }, tStage: 'T2' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Prosigna ROR ≤40, pT2: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    // ROR ≤40 fallback (tStage unknown)
    { id: 'CP_A5', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { lte: 40 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'pN0, Prosigna ROR ≤40 (lav risiko): Endokrinterapi alene' } },

    // ==========================================
    // N0, Prosigna — Luminal A, ROR 41-60
    // ==========================================
    { id: 'CP_B1', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'none', regimen: 'Ingen systembehandling', rationale: 'pN0, Luminal A, ROR 41-60, pT1a-b: Ingen behandling' } },
    { id: 'CP_B2', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 }, tStage: 'T1c' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Luminal A, ROR 41-60, pT1c: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_B3', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 }, tStage: 'T2', menopausalStatus: ['pre', 'peri'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Luminal A, ROR 41-60, pT2, premenopausal: EC90 ×4 eller TC ×4 → endokrin. Endokrin behandling inkl. goserelin kan vurderes som alternativ til kjemoterapi' } },
    { id: 'CP_B4', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 }, tStage: 'T2' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Luminal A, ROR 41-60, pT2, postmenopausal: Endokrin behandling og zoledronsyre' } },

    // ==========================================
    // N0, Prosigna — Luminal B, ROR 41-60
    // ==========================================
    { id: 'CP_C1', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: ['T1a', 'T1b'], erPercent: { gte: 50 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Luminal B, ROR 41-60, pT1a-b, ER ≥50%: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_C2', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 eller TC ×4', rationale: 'pN0, Luminal B, ROR 41-60, pT1a-b, ER <50%: Vurder EC90 ×4 eller TC ×4 + endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_C3', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: 'T1c', erPercent: { gte: 50 }, menopausalStatus: ['pre', 'peri'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Luminal B, ROR 41-60, pT1c, ER ≥50%, premenopausal: EC90 ×4 eller TC ×4 → endokrin. Goserelin + endokrin kan vurderes som alternativ' } },
    { id: 'CP_C4', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: 'T1c', erPercent: { gte: 50 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Luminal B, ROR 41-60, pT1c, ER ≥50%, postmenopausal: Endokrin behandling og zoledronsyre' } },
    { id: 'CP_C5', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: 'T1c' },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Luminal B, ROR 41-60, pT1c, ER <50%: EC90 ×4 eller TC ×4 + endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_C6', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: 'T2', erPercent: { gte: 50 } },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Luminal B, ROR 41-60, pT2, ER ≥50%: EC90 ×4 eller TC ×4 + endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_C7', conditions: { nStage: 'N0', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, tStage: 'T2' },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN0, Luminal B, ROR 41-60, pT2, ER <50%: EC90 ×4 + taxan + endokrin. TC ×6 er akseptabelt alternativ. Zoledronsyre ved postmenopausal status' } },

    // ==========================================
    // N0, Prosigna — ROR 41-60, subtype ikke angitt (fallback)
    // ==========================================
    { id: 'CP_BC', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } },
      outputs: { pathway: 'consider_chemo', regimen: 'Individuell vurdering — angi PAM50 subtype', rationale: 'pN0, Prosigna ROR 41-60: Behandling avhenger av Luminal A vs B subtype og ER-ekspresjon. Angi PAM50 subtype for presis anbefaling' } },

    // ==========================================
    // N0, Prosigna — ROR >60
    // ==========================================
    { id: 'CP_D1', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 }, tStage: ['T1a', 'T1b'], erPercent: { gte: 50 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Prosigna ROR >60, pT1a-b, ER ≥50%: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_D2', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Prosigna ROR >60, pT1a-b, ER <50%: EC90 ×4 eller TC ×4 + endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_D3', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 }, tStage: 'T1c' },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN0, Prosigna ROR >60, pT1c: EC90 ×4 + taxan + endokrin. TC ×6 er akseptabelt alternativ. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_D4', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 }, tStage: 'T2' },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN0, Prosigna ROR >60, pT2: EC90 ×4 + taxan + endokrin. TC ×6 er akseptabelt alternativ. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_D5', conditions: { nStage: 'N0', geneTest: 'prosigna', rorScore: { gt: 60 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN0, Prosigna ROR >60: EC90 ×4 + taxan + endokrin behandling' } },

    // ==========================================
    // N0 with OncotypeDX
    // ==========================================
    { id: 'CP19', conditions: { nStage: 'N0', geneTest: 'oncotypedx', rsScore: { lte: 25 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'pN0, OncotypeDX RS ≤25: Endokrinterapi alene (TAILORx)' } },
    { id: 'CP20', conditions: { nStage: 'N0', geneTest: 'oncotypedx', rsScore: { gt: 25 } },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, OncotypeDX RS >25: EC90 ×4 eller TC ×4 + endokrin behandling' } },

    // ==========================================
    // N0 without gene test — LumA-like (Ki67<10%, G1-2, HR>50%) per NBCG 17.12.24
    // ==========================================
    { id: 'CP_F1', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: [1, 2], erPercent: { gt: 50 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'none', regimen: 'Ingen systembehandling', rationale: 'pN0, Lum A-liknende (Ki67<10%, G1-2, HR>50%), pT1a-b: Ingen behandling' } },
    { id: 'CP_F2', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: 1, erPercent: { gt: 50 }, tStage: 'T1c' },
      outputs: { pathway: 'none', regimen: 'Ingen behandling', rationale: 'pN0, Lum A-liknende, pT1c, Grad 1: Ingen behandling' } },
    { id: 'CP_F3', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: 2, erPercent: { gt: 50 }, tStage: 'T1c' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Lum A-liknende, pT1c, Grad 2: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_F4', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: 1, erPercent: { gt: 50 }, tStage: 'T2' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Lum A-liknende, pT2, Grad 1: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_F5', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: 2, erPercent: { gt: 50 }, tStage: 'T2', menopausalStatus: ['pre', 'peri'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Lum A-liknende, pT2, Grad 2, premenopausal: EC90 ×4 eller TC ×4 → endokrin. Goserelin + endokrin kan vurderes som alternativ til kjemoterapi' } },
    { id: 'CP_F6', conditions: { nStage: 'N0', ki67Value: { lt: 10 }, grade: 2, erPercent: { gt: 50 }, tStage: 'T2' },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN0, Lum A-liknende, pT2, Grad 2, postmenopausal: Endokrin behandling og zoledronsyre' } },

    // ==========================================
    // N0 without gene test — LumB-like (Ki67>35% ELLER G3+høy Ki67 ELLER HR<50%) per NBCG 17.12.24
    // ==========================================
    { id: 'CP_G1', conditions: { nStage: 'N0', erPercent: { lt: 50 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 eller TC ×4', rationale: 'pN0, Lum B-liknende (ER <50%), pT1a-b: Endokrin behandling. Lav HR-positivitet kan gi grunnlag for kjemoterapi (EC90 ×4 eller TC ×4)' } },
    { id: 'CP_G1b', conditions: { nStage: 'N0', ki67Value: { gt: 35 }, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 eller TC ×4', rationale: 'pN0, Lum B-liknende (Ki67>35%), pT1a-b: Endokrin behandling. Høy proliferasjon kan gi grunnlag for kjemoterapi' } },
    { id: 'CP_G2', conditions: { nStage: 'N0', erPercent: { lt: 50 }, tStage: ['T1c', 'T2'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Lum B-liknende (ER <50%), pT1c-T2: EC90 ×4 eller TC ×4 + endokrin. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP_G2b', conditions: { nStage: 'N0', ki67Value: { gt: 35 }, tStage: ['T1c', 'T2'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Lum B-liknende (Ki67>35%), pT1c-T2: EC90 ×4 eller TC ×4 + endokrin. Svært høy proliferasjon kan gi grunnlag for EC90 ×4 + taxan (alternativt TC ×6)' } },
    { id: 'CP_G3', conditions: { nStage: 'N0', grade: 3, tStage: ['T1a', 'T1b'] },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 eller TC ×4', rationale: 'pN0, Grad 3, pT1a-b: Endokrin behandling. Høy grad kan gi grunnlag for kjemoterapi' } },
    { id: 'CP_G4', conditions: { nStage: 'N0', grade: 3, tStage: ['T1c', 'T2'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN0, Grad 3, pT1c-T2: EC90 ×4 eller TC ×4 + endokrin. Svært høy proliferasjon kan gi grunnlag for EC90 ×4 + taxan' } },

    // ==========================================
    // N0 without gene test — Ikke-konklusiv luminal / fallback
    // ==========================================
    { id: 'CP16', conditions: { nStage: 'N0', tumorSizeMm: { lte: 10 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'pN0, ≤10mm: Liten tumor — genekspresjonstest kan vurderes. Individuell vurdering ved pT1a pN0' } },
    { id: 'CP21', conditions: { nStage: 'N0', grade: 1 },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'pN0, Grad 1: Lav risiko — endokrinterapi alene' } },
    { id: 'CP24', conditions: { nStage: 'N0', grade: 2 },
      outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'pN0, Grad 2: Generell anbefaling ikke mulig uten genekspresjonstest. Gentest anbefales' } },
    { id: 'CP25_N0', conditions: { nStage: 'N0' },
      outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'pN0: Genekspresjonstest anbefales for å avklare kjemoterapibehov' } },

    // ==========================================
    // N1, OncotypeDX — postmenopausal (NBCG tabell 17.12.24)
    // ==========================================
    { id: 'CP_E1', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { lte: 25 }, menopausalStatus: 'post', erPercent: { gte: 50 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN1 postmenopausal, OncotypeDX RS ≤25, ER ≥50%: Endokrin behandling og zoledronsyre' } },
    { id: 'CP_E2', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { lte: 25 }, menopausalStatus: 'post' },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder kjemoterapi', rationale: 'pN1 postmenopausal, OncotypeDX RS ≤25, ER <50%: Vurder om grunnlag for kjemoterapi + endokrin. Zoledronsyre' } },
    { id: 'CP_E3', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { gt: 25 }, menopausalStatus: 'post' },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN1 postmenopausal, OncotypeDX RS >25: EC90 ×4 + taxan + endokrin + zoledronsyre. TC ×6 er akseptabelt alternativ' } },

    // N1, OncotypeDX — pre/peri (RxPONDER — ikke eksplisitt i NBCG-tabellen for gentest)
    { id: 'CP4', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { lte: 25 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1 premenopausal, OncotypeDX RS ≤25: Endokrinterapi alene (RxPONDER)' } },
    { id: 'CP5', conditions: { nStage: 'N1', geneTest: 'oncotypedx', rsScore: { gt: 25 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'N1, OncotypeDX RS >25: Kjemoterapi anbefalt' } },

    // N1, Prosigna
    { id: 'CP2', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { lte: 40 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1, Prosigna ROR ≤40: Endokrinterapi alene' } },
    { id: 'CP3', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { gt: 60 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'N1, Prosigna ROR >60 (høy risiko): EC90 ×4 + taxan anbefalt' } },
    { id: 'CP3b', conditions: { nStage: 'N1', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4', rationale: 'N1, Prosigna ROR 41-60 (intermediær): Individuell vurdering — diskuter med pasient' } },

    // N1 without gene test — LumA-like (per NBCG 17.12.24)
    { id: 'CP_H1', conditions: { nStage: 'N1', ki67Value: { lt: 10 }, grade: [1, 2], erPercent: { gt: 50 }, menopausalStatus: ['pre', 'peri'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN1, Lum A-liknende, premenopausal: EC90 ×4 eller TC ×4 → endokrin. Goserelin + endokrin kan vurderes som alternativ til kjemoterapi' } },
    { id: 'CP_H2', conditions: { nStage: 'N1', ki67Value: { lt: 10 }, grade: [1, 2], erPercent: { gt: 50 } },
      outputs: { pathway: 'consider_chemo', regimen: 'Individuell vurdering', rationale: 'pN1, Lum A-liknende, postmenopausal: Tumorstørrelse og omfang av lymfeknutemetastaser kan gi grunnlag for kjemoterapi (EC90 ×4 alternativt TC ×4). Alternativt endokrin behandling. Zoledronsyre' } },

    // N1 without gene test — LumB-like
    { id: 'CP_H3', conditions: { nStage: 'N1', erPercent: { lt: 50 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN1, Lum B-liknende (ER <50%): EC90 ×4 + taxan. Alternativt EC90 ×4 eller TC ×4 avhengig av risikovurdering. TC ×6 akseptabelt alternativ' } },
    { id: 'CP_H4', conditions: { nStage: 'N1', ki67Value: { gt: 35 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN1, Lum B-liknende (Ki67>35%): EC90 ×4 + taxan. Alternativt EC90 ×4 eller TC ×4. TC ×6 akseptabelt alternativ' } },
    { id: 'CP6', conditions: { nStage: 'N1', grade: 3 },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'N1, Grad 3 uten gentest: Kjemoterapi anbefalt. TC ×6 akseptabelt alternativ' } },

    // N1 without gene test — Ikke-konklusiv
    { id: 'CP_H5', conditions: { nStage: 'N1', menopausalStatus: 'post' },
      outputs: { pathway: 'consider_chemo', regimen: 'EC90 ×4 eller TC ×4, alternativt endokrin', rationale: 'pN1 postmenopausal, ikke-konklusiv luminal: EC90 ×4 eller TC ×4 → endokrin. Ved pN1 kan alternativt endokrin behandling alene vurderes. Zoledronsyre. Mange lymfeknutemetastaser → EC90 ×4 + taxan' } },
    { id: 'CP8b', conditions: { nStage: 'N1' },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'N1: EC90 ×4 eller TC ×4 → endokrin behandling. Genekspresjonstest anbefales for å avklare behandlingsintensitet. Mange lymfeknutemetastaser → EC90 ×4 + taxan' } },

    // ==========================================
    // N1mi with Prosigna — per NBCG pT1 pN1(mi) tabell (16.11.22)
    // ==========================================
    // Luminal A, ROR 0-40: Endokrin (lav ER → vurder EC)
    { id: 'CP9', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { lte: 40 }, erPercent: { lt: 50 } },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 eller TC ×4', rationale: 'pN1mi, Prosigna ROR ≤40, ER <50%: Endokrin behandling. Lav ER-ekspresjon kan gi grunnlag for EC90 ×4 eller TC ×4. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP9b', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { lte: 40 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN1mi, Prosigna Lum A, ROR ≤40: Endokrin behandling. Zoledronsyre ved postmenopausal status' } },

    // Luminal A, ROR 41-60: Pre → EC/TC (goserelin alt), Post → endokrin
    { id: 'CP10_A1', conditions: { nStage: 'N1mi', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 }, menopausalStatus: ['pre', 'peri'] },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN1mi, Luminal A, ROR 41-60, premenopausal: EC90 ×4 eller TC ×4 → endokrin. Goserelin + endokrin kan vurderes som alternativ til kjemoterapi' } },
    { id: 'CP10_A2', conditions: { nStage: 'N1mi', geneTest: 'prosigna', prosignaSubtype: 'lumA', rorScore: { gt: 40, lte: 60 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi — endokrinterapi', rationale: 'pN1mi, Luminal A, ROR 41-60, postmenopausal: Endokrin behandling. Zoledronsyre' } },

    // Luminal B, ROR 41-60: ER≥50% → EC/TC, ER<50% → EC+taxan
    { id: 'CP10_B1', conditions: { nStage: 'N1mi', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 }, erPercent: { gte: 50 } },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4 eller TC ×4', rationale: 'pN1mi, Luminal B, ROR 41-60, ER ≥50%: EC90 ×4 eller TC ×4 + endokrin. Endokrin behandling kan vurderes ved G1-2 og lav absolutt ROR. Zoledronsyre ved postmenopausal status' } },
    { id: 'CP10_B2', conditions: { nStage: 'N1mi', geneTest: 'prosigna', prosignaSubtype: 'lumB', rorScore: { gt: 40, lte: 60 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN1mi, Luminal B, ROR 41-60, ER <50%: EC90 ×4 + taxan + endokrin. Zoledronsyre ved postmenopausal status' } },

    // ROR 41-60 subtype not specified fallback
    { id: 'CP10b', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { gt: 40, lte: 60 } },
      outputs: { pathway: 'consider_chemo', regimen: 'Vurder EC90 ×4 — angi PAM50 subtype', rationale: 'pN1mi, Prosigna ROR 41-60: Angi PAM50 subtype for presis anbefaling' } },

    // Luminal B, ROR >60: EC+taxan
    { id: 'CP10_C1', conditions: { nStage: 'N1mi', geneTest: 'prosigna', rorScore: { gt: 60 } },
      outputs: { pathway: 'EC_taxan', regimen: 'EC90 ×4 + taxan', rationale: 'pN1mi, Prosigna ROR >60 (Luminal B): EC90 ×4 + taxan + endokrin. TC ×6 er akseptabelt alternativ ved kardiale risikofaktorer. Zoledronsyre ved postmenopausal status' } },

    // N1mi with OncotypeDX
    { id: 'CP11', conditions: { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: { lte: 25 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1mi, OncotypeDX RS ≤25: Endokrinterapi alene' } },
    { id: 'CP12', conditions: { nStage: 'N1mi', geneTest: 'oncotypedx', rsScore: { gt: 25 } },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4', rationale: 'N1mi, OncotypeDX RS >25: EC90 ×4 anbefalt' } },

    // N1mi without gene test
    { id: 'CP13', conditions: { nStage: 'N1mi', tumorSizeMm: { lte: 10 } },
      outputs: { pathway: 'none', regimen: 'Ingen kjemoterapi', rationale: 'N1mi, liten tumor ≤10mm: Ingen kjemoterapi' } },
    { id: 'CP14', conditions: { nStage: 'N1mi', grade: 3 },
      outputs: { pathway: 'EC', regimen: 'EC90 ×4', rationale: 'N1mi, Grad 3: EC90 ×4 anbefalt' } },
    { id: 'CP15', conditions: { nStage: 'N1mi' },
      outputs: { pathway: 'gene_test_needed', regimen: 'Genekspresjonstest anbefales', rationale: 'N1mi: Gentest anbefales for avklaring av kjemoterapibehov' } },

    // ==========================================
    // Fallback
    // ==========================================
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
  name: 'Endokrinterapi (NBCG 17.12.24)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-09',

  inputs: [
    { id: 'hrPositive', label: 'HR-positiv', type: 'boolean' },
    { id: 'menopausalStatus', label: 'Menopausal status', type: 'string', allowedValues: ['pre', 'peri', 'post', 'unknown'] },
    { id: 'isHighRisk', label: 'Høy risiko (N+, G3, GES høy, eller kjemoterapi)', type: 'boolean' },
    { id: 'age', label: 'Alder', type: 'number' },
  ],

  outputs: [
    { id: 'therapy', label: 'Terapi', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'duration', label: 'Varighet', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    { id: 'ET0', conditions: { hrPositive: false }, outputs: { therapy: 'ingen', detail: 'Ikke HR-positiv — ingen endokrinterapi', duration: '-', rationale: 'Endokrinterapi kun ved HR+ tumorer' } },

    // Postmenopausal — NBCG 17.12.24
    { id: 'ET1', conditions: { hrPositive: true, menopausalStatus: 'post', isHighRisk: true }, outputs: { therapy: 'aromatasehemmer', detail: 'Aromatasehemmer (letrozol/anastrozol) i 5-10 år. Ved høy risiko: vurder 7-8 (opp til 10) års AI', duration: '5-10 år', rationale: 'Postmenopausal høyrisiko: AI er førstevalg. Utvidet behandling (7-10 år) ved høy risiko. Alternativer: Tamoxifen 2-3 år → AI 5 år, eller AI 2-3 år → Tamoxifen 2-3 år. Calcium/VitD anbefales ved AI' } },
    { id: 'ET1b', conditions: { hrPositive: true, menopausalStatus: 'post' }, outputs: { therapy: 'aromatasehemmer', detail: 'Aromatasehemmer (letrozol/anastrozol) i 5 år', duration: '5 år', rationale: 'Postmenopausal standardrisiko: AI 5 år. Alternativer: Tamoxifen 5-10 år, Tamoxifen 2-3 år → AI 5 år. Calcium/VitD anbefales ved AI' } },

    // Premenopausal <35 med høy risiko — NBCG 17.12.24
    { id: 'ET2a', conditions: { hrPositive: true, menopausalStatus: ['pre', 'peri'], isHighRisk: true, age: { lt: 35 } }, outputs: { therapy: 'ai_ofs', detail: 'OFS (goserelin) 5 år + AI (foretrukket) eller tamoxifen. AI + OFS gir best sykdomsfri overlevelse. Oppstart OFS så snart som mulig', duration: '5-10 år', rationale: 'SOFT/TEXT: Under 35 med kjemoterapi-indikasjon: OFS alltid anbefalt. AI + OFS foretrukket over tamoxifen + OFS. Dersom menstruasjon ikke opphører etter kjemoterapi eller kommer tilbake innen 8 mnd → OFS bør legges til' } },

    // Premenopausal ≥35 med høy risiko — NBCG 17.12.24
    { id: 'ET2b', conditions: { hrPositive: true, menopausalStatus: ['pre', 'peri'], isHighRisk: true }, outputs: { therapy: 'ai_ofs', detail: 'OFS (goserelin) 5 år + AI (foretrukket), subsidiært OFS + tamoxifen. Oppstart OFS så snart som mulig', duration: '5-10 år', rationale: 'SOFT/TEXT: Premenopausal høyrisiko ≥35 år: OFS + AI foretrukket. OFS + tamoxifen ved tolerabilitetsproblemer. Dersom menstruasjon ikke opphører etter kjemoterapi eller kommer tilbake innen 8 mnd → OFS bør legges til. Utvidet beh: Ved OFS+AI i 5 år → tamoxifen 5 år eller AI 2-3 år videre' } },

    // Premenopausal lav risiko — NBCG 17.12.24
    { id: 'ET3', conditions: { hrPositive: true, menopausalStatus: ['pre', 'peri'] }, outputs: { therapy: 'tamoxifen', detail: 'Tamoxifen 20mg daglig i 5 år. Ved høyere risikoprofil uten kjemoterapi: vurder OFS-tillegg', duration: '5-10 år', rationale: 'Lav risiko premenopausal: Tamoxifen 5 år. Utvidet beh til 10 år ved risikoprofil. Dersom post etter 5 år: vurder AI 2-5 år' } },

    // Ukjent menopausal status
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
  name: 'HR+HER2+ Adjuvant behandling (NBCG 17.12.24)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-09',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tStage', label: 'T-stadium (detaljert)', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    // pT1 N0: Taxan/trastuzumab (individuell vurdering ved pT1a)
    { id: 'HH1', conditions: { bioGroup: 'HR+HER2+', nStage: 'N0', tStage: ['T1a', 'T1b', 'T1c'] }, outputs: { regimen: 'Taxan/trastuzumab → trastuzumab + endokrin', detail: 'Taxan (paklitaxel 80mg/m² ukentlig ×12 eller docetaxel q3w) + trastuzumab q3w → trastuzumab totalt 1 år + endokrin', rationale: 'HR+HER2+ pT1 N0: Taxan/trastuzumab tilstrekkelig. Individuell vurdering ved pT1a. Spesielt høy risikoprofil → vurder EC90 ×4 + taxan/trastuzumab. Zoledronsyre ved postmenopausal status' } },
    // pT2 N0: EC90+taxan/trastuzumab
    { id: 'HH2', conditions: { bioGroup: 'HR+HER2+', nStage: 'N0' }, outputs: { regimen: 'EC90 ×4 → taxan/trastuzumab → trastuzumab + endokrin', detail: 'EC90 ×4, deretter taxan + trastuzumab q3w → trastuzumab totalt 1 år + endokrin. Alternativ: taxan/carboplatin', rationale: 'HR+HER2+ pT2 N0: EC90 ×4 + taxan/trastuzumab. Zoledronsyre ved postmenopausal status' } },
    // N1mi: same as pT1 N0
    { id: 'HH3', conditions: { bioGroup: 'HR+HER2+', nStage: 'N1mi' }, outputs: { regimen: 'Taxan/trastuzumab → trastuzumab + endokrin', detail: 'Taxan + trastuzumab q3w → trastuzumab totalt 1 år + endokrin', rationale: 'HR+HER2+ N1mi: Taxan/trastuzumab. Zoledronsyre ved postmenopausal status' } },
    // N1-3: EC90+taxan/trastuzumab+pertuzumab
    { id: 'HH4', conditions: { bioGroup: 'HR+HER2+' }, outputs: { regimen: 'EC90 ×4 → taxan + trastuzumab/pertuzumab → HP + endokrin', detail: 'EC90 ×4, deretter taxan + trastuzumab + pertuzumab q3w. Trastuzumab/pertuzumab totalt 1 år + endokrin. Alternativ: taxan/carboplatin', rationale: 'HR+HER2+ nodepositiv: Full kjemoterapi + dobbel HER2-blokade (APHINITY). Zoledronsyre ved postmenopausal status' } },
  ],
};

// ============================================================
// 8. HR-HER2+ ADJUVANT
// ============================================================

export const HRNEG_HER2POS_TABLE = {
  id: 'hrneg-her2pos-adjuvant',
  name: 'HR-HER2+ Adjuvant behandling (NBCG 17.12.24)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-09',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tStage', label: 'T-stadium (detaljert)', type: 'string' },
    { id: 'tumorSizeMm', label: 'Tumorstørrelse (mm)', type: 'number' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
  ],

  rules: [
    // pT1 N0: Taxan/trastuzumab (individuell vurdering ved pT1a)
    { id: 'NH1', conditions: { bioGroup: 'HR-HER2+', nStage: 'N0', tStage: ['T1a', 'T1b', 'T1c'] }, outputs: { regimen: 'Taxan/trastuzumab → trastuzumab 1 år', detail: 'Taxan (paklitaxel 80mg/m² ukentlig ×12 eller docetaxel q3w) + trastuzumab → trastuzumab totalt 1 år', rationale: 'HR-HER2+ pT1 N0: Taxan/trastuzumab. Individuell vurdering ved pT1a. Spesielt høy risikoprofil → EC90 ×4 + taxan/trastuzumab eller taxan/carboplatin/trastuzumab. Zoledronsyre ved postmenopausal status' } },
    // pT2 N0: EC90+taxan/trastuzumab
    { id: 'NH2', conditions: { bioGroup: 'HR-HER2+', nStage: 'N0' }, outputs: { regimen: 'EC90 ×4 → taxan/trastuzumab → trastuzumab 1 år', detail: 'EC90 ×4, deretter taxan + trastuzumab q3w → trastuzumab totalt 1 år. Alternativ: taxan/carboplatin', rationale: 'HR-HER2+ pT2 N0: EC90 ×4 + taxan/trastuzumab. Zoledronsyre ved postmenopausal status' } },
    // N1-3: EC90+taxan/trastuzumab+pertuzumab
    { id: 'NH3', conditions: { bioGroup: 'HR-HER2+' }, outputs: { regimen: 'EC90 ×4 → taxan + trastuzumab/pertuzumab → HP 1 år', detail: 'EC90 ×4, deretter taxan + trastuzumab + pertuzumab q3w. Trastuzumab/pertuzumab totalt 1 år. Alternativ: taxan/carboplatin', rationale: 'HR-HER2+ nodepositiv: Full kjemoterapi + dobbel HER2-blokade (APHINITY). Zoledronsyre ved postmenopausal status' } },
  ],
};

// ============================================================
// 9. TRIPLE NEGATIVE ADJUVANT
// ============================================================

export const TN_TABLE = {
  id: 'tn-adjuvant',
  name: 'Trippel negativ (TN) Adjuvant behandling (NBCG 17.12.24)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-09',

  inputs: [
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string' },
    { id: 'nStage', label: 'N-stadium', type: 'string' },
    { id: 'tStage', label: 'T-stadium (detaljert)', type: 'string' },
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
    // pT1a N0: Ingen generell anbefaling
    { id: 'TN1a', conditions: { bioGroup: 'TN', nStage: 'N0', tStage: 'T1a' }, outputs: { regimen: 'Ingen generell anbefaling om kjemoterapi', detail: 'pT1a pN0 TN: Ingen generell anbefaling. Individuell vurdering', rationale: 'pT1a pN0 TN: Ingen generell anbefaling om kjemoterapi', warnings: ['Individuell vurdering — diskuter med pasient'] } },
    // pT1b N0: EC90+taxan (lav prolif/grad → TC×4 mulig)
    { id: 'TN1b', conditions: { bioGroup: 'TN', nStage: 'N0', tStage: 'T1b' }, outputs: { regimen: 'EC90 ×4 + taxan', detail: 'EC90 ×4 + taxan. Alternativ: taxan/carboplatin. Lav proliferasjon og grad kan gi grunnlag for å utelate taxaner (evt kun TC ×4)', rationale: 'pT1b pN0 TN: EC90 ×4 + taxan. Individuell vurdering av grunnlag for kjemoterapi (TILs-analyse kan vurderes). Zoledronsyre ved postmenopausal status', warnings: [] } },
    // pT1c N0: EC90+taxan
    { id: 'TN1c', conditions: { bioGroup: 'TN', nStage: 'N0', tStage: 'T1c' }, outputs: { regimen: 'EC90 ×4 + taxan', detail: 'EC90 ×4 + taxan. Alternativ: taxan/carboplatin. Lav proliferasjon og grad kan gi grunnlag for å utelate taxaner', rationale: 'pT1c pN0 TN: EC90 ×4 + taxan. Individuell vurdering (TILs-analyse kan vurderes). Zoledronsyre ved postmenopausal status', warnings: [] } },
    // N0 fallback (T2+): EC90+taxan
    { id: 'TN2', conditions: { bioGroup: 'TN', nStage: 'N0' }, outputs: { regimen: 'EC90 ×4 + taxan', detail: 'EC90 ×4 + taxan. Alternativ: taxan/carboplatin', rationale: 'TN pN0: EC90 ×4 + taxan. Zoledronsyre ved postmenopausal status', warnings: [] } },
    // N1mi
    { id: 'TN3', conditions: { bioGroup: 'TN', nStage: 'N1mi' }, outputs: { regimen: 'EC90 ×4 + taxan', detail: 'EC90 ×4 + taxan', rationale: 'TN N1mi: Kjemoterapi anbefalt. Zoledronsyre ved postmenopausal status', warnings: [] } },
    // N1-3 (dersom ikke neoadjuvant): Taxan/carboplatin → EC90 (NBCG sekvens)
    { id: 'TN4', conditions: { bioGroup: 'TN' }, outputs: { regimen: 'Taxan/carboplatin → EC90 ×4', detail: 'Taxan/carboplatin (docetaxel 75mg/m² + carboplatin AUC 5-6 q3w, eller paklitaxel 80mg/m² + carboplatin AUC 1.5-2 ukentlig), deretter EC90 ×4. TC ×6 akseptabelt alternativ ved færre lymfeknutemetastaser og kardiale risikofaktorer', rationale: 'TN nodepositiv/pT2+: Dersom ikke neoadjuvant gitt: taxan/carboplatin → EC90 ×4. Zoledronsyre ved postmenopausal status', warnings: ['Vurder neoadjuvant med pembrolizumab (KEYNOTE-522) ved stadium II-III'] } },
  ],
};

// ============================================================
// 10. NEOADJUVANT
// ============================================================

export const NEOADJUVANT_TABLE = {
  id: 'neoadjuvant-treatment',
  name: 'Neoadjuvant behandling (NBCG 15.11.23)',
  hitPolicy: 'FIRST',
  version: '2.0.0',
  lastUpdated: '2026-03-09',

  inputs: [
    { id: 'isNeoadjuvant', label: 'Neoadjuvant modus', type: 'boolean' },
    { id: 'bioGroup', label: 'Biologisk gruppe', type: 'string', allowedValues: ['HR+HER2-', 'HR+HER2+', 'HR-HER2+', 'TN'] },
    { id: 'luminalSubtype', label: 'Luminal subtype', type: 'string' },
  ],

  outputs: [
    { id: 'regimen', label: 'Regime', type: 'string' },
    { id: 'detail', label: 'Detaljer', type: 'string' },
    { id: 'rationale', label: 'Begrunnelse', type: 'string' },
    { id: 'warnings', label: 'Advarsler', type: 'string[]' },
  ],

  rules: [
    { id: 'NEO0', conditions: { isNeoadjuvant: false }, outputs: { regimen: '-', detail: 'Ikke neoadjuvant', rationale: '-', warnings: [] } },

    // HR+HER2- — Sterkt ER+/Luminal A: Endokrin neoadjuvant (NBCG 15.11.23)
    { id: 'NEO1a', conditions: { isNeoadjuvant: true, bioGroup: 'HR+HER2-', luminalSubtype: 'Luminal A' }, outputs: { regimen: 'Neoadjuvant endokrin behandling', detail: 'AI (+ goserelin for premenopausale) til maksimal respons (6-12 mnd). Klinisk responsevaluering hver 3-6 uke, billeddiagnostikk ved behov. MR mot slutten av behandlingstiden ved BCT-kandidat', rationale: 'HR+HER2- Luminal A / sterkt ER+: Neoadjuvant endokrin behandling (NBCG 15.11.23). Ved progresjon eller manglende respons: seponér og skift til kjemoterapi eller vurder operasjon', warnings: ['Henvisning til MDT/onkolog', 'Responsevaluering hver 3-6 uke', 'Ved progresjon: Skift til kjemoterapi'] } },

    // HR+HER2- — Alle andre: EC90×4 → 12 uker taxan
    { id: 'NEO1b', conditions: { isNeoadjuvant: true, bioGroup: 'HR+HER2-' }, outputs: { regimen: 'EC90 ×4 → taxan 12 uker', detail: 'Neoadjuvant: EC90 ×4, deretter taxan × 12 uker. Endokrinterapi postoperativt. Klinisk responsevaluering hver 3. uke. Mindre intens kjemoterapi kan vurderes individuelt (f.eks. klassiske lobulære carcinomer)', rationale: 'HR+HER2- (ikke Lum A) neoadjuvant: EC90 ×4 → 12 uker taxan (NBCG 15.11.23). Ved progresjon: seponér og skift til annen behandling eller vurder operasjon', warnings: ['Henvisning til MDT/onkolog', 'Endokrinterapi planlegges postoperativt', 'Ved progresjon: Skift behandling'] } },

    // HER2+ (alle): EC90×4 → 12 uker taxan + trastuzumab + pertuzumab
    { id: 'NEO2', conditions: { isNeoadjuvant: true, bioGroup: 'HR+HER2+' }, outputs: { regimen: 'EC90 ×4 → taxan + trastuzumab/pertuzumab', detail: 'Neoadjuvant: EC90 ×4, deretter taxan ×12 uker + trastuzumab + pertuzumab q3w. HP totalt 1 år + endokrin', rationale: 'HR+HER2+ neoadjuvant: EC90 + taxan + dobbel HER2-blokade (NBCG 15.11.23). Responsevaluering hver 3. uke', warnings: ['Henvisning til MDT/onkolog', 'Ved pCR: Fortsett HP. Ved non-pCR: Vurder T-DM1 (KATHERINE)', 'LVEF-måling før EC90 og før anti-HER2'] } },
    { id: 'NEO3', conditions: { isNeoadjuvant: true, bioGroup: 'HR-HER2+' }, outputs: { regimen: 'EC90 ×4 → taxan + trastuzumab/pertuzumab', detail: 'Neoadjuvant: EC90 ×4, deretter taxan ×12 uker + trastuzumab + pertuzumab q3w. HP totalt 1 år', rationale: 'HR-HER2+ neoadjuvant: EC90 + taxan + dobbel HER2-blokade (NBCG 15.11.23)', warnings: ['Henvisning til MDT/onkolog', 'Ved non-pCR: T-DM1 14 kurer (KATHERINE)', 'LVEF-måling før EC90 og før anti-HER2'] } },

    // TN: Pembrolizumab + paklitaxel/carboplatin → pembrolizumab + EC90 (KEYNOTE-522)
    { id: 'NEO4', conditions: { isNeoadjuvant: true, bioGroup: 'TN' }, outputs: { regimen: 'Pembrolizumab + paklitaxel/carboplatin → pembrolizumab + EC90', detail: 'KEYNOTE-522: Pembrolizumab + karboplatin + paklitaxel × 12 uker, deretter pembrolizumab + EC90 × 4. Adjuvant pembrolizumab 9 kurer. Alternativ uten pembrolizumab: Paklitaxel/carboplatin → EC90 ×4. Andre alternativer: EC90 ×4 → taxan, dose-dense EC90 q2w → docetaxel q2w/paklitaxel ukentlig', rationale: 'TN neoadjuvant: Immunterapi + kjemoterapi (KEYNOTE-522, NBCG 15.11.23)', warnings: ['Henvisning til MDT/onkolog', 'Immunterapi — screening for autoimmunitet', 'Ved non-pCR: Vurder capecitabin (CREATE-X)'] } },
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
