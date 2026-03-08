/**
 * CQL Execution Engine — Full clinical fact derivation
 *
 * Ports logic from the NBCG HTML decision support app into BPM+ Health CQL layer.
 * CQL is responsible for data retrieval and fact derivation (WHAT),
 * while DMN handles decision logic (HOW).
 *
 * Derived facts:
 * - HER2 status from IHC + SISH
 * - Biological subgroup (HR+HER2-, HR+HER2+, HR-HER2+, TN)
 * - Clinical staging (T-group, stadium)
 * - Luminal subtype (A-like vs B-like)
 * - Gene expression test interpretation (Prosigna ROR, OncotypeDX RS)
 * - CDK4/6 eligibility flags
 * - Chemotherapy pathway for HR+HER2-
 * - Endocrine therapy selection
 * - Bisphosphonate eligibility
 */

/**
 * Derive HER2 status from IHC and SISH results.
 * Per NBCG: IHC 0/1+ = negative, IHC 3+ = positive, IHC 2+ requires SISH.
 */
export function deriveHER2(her2ihc, her2sish) {
  if (her2ihc === '3+') return 'positive';
  if (her2ihc === '0' || her2ihc === '1+') return 'negative';
  if (her2ihc === '2+') {
    if (her2sish === 'positive' || her2sish === 'amplified') return 'positive';
    if (her2sish === 'negative' || her2sish === 'not_amplified') return 'negative';
    return 'equivocal'; // SISH not done or unclear
  }
  return 'unknown';
}

/**
 * Derive biological subgroup from receptor status.
 * 4 groups: HR+HER2-, HR+HER2+, HR-HER2+, TN (triple negative)
 */
export function deriveBioGroup(erPositive, prPositive, her2Status) {
  const hrPositive = erPositive || prPositive;
  const her2Pos = her2Status === 'positive';
  const her2Neg = her2Status === 'negative';

  if (hrPositive && her2Neg) return 'HR+HER2-';
  if (hrPositive && her2Pos) return 'HR+HER2+';
  if (!hrPositive && her2Pos) return 'HR-HER2+';
  if (!hrPositive && her2Neg) return 'TN';
  return 'unknown';
}

/**
 * Derive T-group from tumor size in mm.
 * Per TNM: T1a ≤5mm, T1b 6-10mm, T1c 11-20mm, T2 21-50mm, T3 >50mm, T4 = chest wall/skin
 */
export function deriveTStage(tumorSizeMm, tStageOverride) {
  if (tStageOverride === 'T4') return 'T4';
  if (tumorSizeMm == null || isNaN(tumorSizeMm)) return null;
  if (tumorSizeMm <= 5) return 'T1a';
  if (tumorSizeMm <= 10) return 'T1b';
  if (tumorSizeMm <= 20) return 'T1c';
  if (tumorSizeMm <= 50) return 'T2';
  return 'T3';
}

/**
 * Derive simplified T-group for decision logic.
 * Groups T1a/T1b/T1c → T1, keeps T2/T3/T4.
 */
export function simplifyTStage(tStage) {
  if (!tStage) return null;
  if (tStage.startsWith('T1')) return 'T1';
  return tStage; // T2, T3, T4
}

/**
 * Derive clinical stadium from T and N staging.
 * Simplified per NBCG staging used in treatment decisions.
 */
export function deriveStadium(tSimple, nStage) {
  if (!tSimple || !nStage) return null;

  if (nStage === 'N3') return 'IIIC';
  if (tSimple === 'T4' && nStage === 'N2') return 'IIIB';
  if (tSimple === 'T4' && (nStage === 'N1' || nStage === 'N0' || nStage === 'N1mi')) return 'IIIB';
  if (nStage === 'N2') return 'IIIA';
  if (tSimple === 'T3' && nStage === 'N1') return 'IIIA';

  if (tSimple === 'T3' && nStage === 'N0') return 'IIB';
  if (tSimple === 'T2' && nStage === 'N1') return 'IIB';

  if (tSimple === 'T2' && (nStage === 'N0' || nStage === 'N1mi')) return 'IIA';
  if (tSimple === 'T1' && nStage === 'N1') return 'IIA';

  if (tSimple === 'T1' && (nStage === 'N0' || nStage === 'N1mi')) return 'I';

  return null;
}

/**
 * Determine if gene expression test (GES) indicates high risk.
 * Prosigna: ROR score interpretation per age/node status.
 * OncotypeDX: RS > 25 = high risk.
 */
export function deriveGESRisk(geneTest, rorScore, rsScore, prosignaSubtype, nStage) {
  if (!geneTest || geneTest === 'none') {
    return { gesHighRisk: null, gesLowRisk: null, geneTestDone: false };
  }

  if (geneTest === 'prosigna') {
    if (rorScore == null) return { gesHighRisk: null, gesLowRisk: null, geneTestDone: true };
    // Prosigna interpretation per NBCG:
    // N0: Low ≤40, Intermediate 41-60, High >60
    // N1mi/N1: Low ≤40, Intermediate 41-60, High >60
    const isN0 = nStage === 'N0' || nStage === 'N1mi';
    const highThreshold = isN0 ? 60 : 60;
    const lowThreshold = isN0 ? 40 : 40;
    return {
      gesHighRisk: rorScore > highThreshold,
      gesLowRisk: rorScore <= lowThreshold,
      geneTestDone: true,
      prosignaSubtype: prosignaSubtype || null,
      rorScore,
    };
  }

  if (geneTest === 'oncotypedx') {
    if (rsScore == null) return { gesHighRisk: null, gesLowRisk: null, geneTestDone: true };
    return {
      gesHighRisk: rsScore > 25,
      gesLowRisk: rsScore <= 25,
      geneTestDone: true,
      rsScore,
    };
  }

  return { gesHighRisk: null, gesLowRisk: null, geneTestDone: false };
}

/**
 * Derive luminal subtype for HR+HER2- tumors.
 * Luminal A-like: G1-2, Ki-67 low (<20%), PR ≥20%
 * Luminal B-like: G3, Ki-67 high (≥20%), or PR <20%
 */
export function deriveLuminalSubtype(grade, ki67Value, prPercent) {
  if (grade === 3) return 'B-like';
  if (ki67Value != null && ki67Value >= 20) return 'B-like';
  if (prPercent != null && prPercent < 20) return 'B-like';
  if (grade != null && grade <= 2) return 'A-like';
  return 'unknown';
}

/**
 * Determine HR+HER2- chemotherapy pathway.
 * This is the most complex clinical logic — ported from HTML app's getHRposHER2negAdj().
 *
 * Pathways:
 * - 'none': No chemo, endocrine only
 * - 'EC': EC ×4 (epirubicin/cyclophosphamide)
 * - 'EC_taxan': EC ×4 + taxane
 * - 'gene_test_needed': Gene expression test should guide decision
 * - 'consider_chemo': Chemo should be considered (clinical judgment)
 */
export function deriveHRposHER2negChemoPathway(params) {
  const {
    tSimple, nStage, grade, ki67Value,
    geneTestDone, gesHighRisk, gesLowRisk,
    prosignaSubtype, rorScore, rsScore, geneTest,
    tumorSizeMm,
  } = params;

  // N0: Gene expression guided (if done) or grade/Ki67 based
  if (nStage === 'N0') {
    return deriveN0Pathway(params);
  }

  // N1mi: Similar to N0 but slightly more aggressive
  if (nStage === 'N1mi') {
    return deriveN1miPathway(params);
  }

  // N1 (1-3 positive nodes): Gene expression or grade-based
  if (nStage === 'N1') {
    return deriveN1Pathway(params);
  }

  // N2 (4-9 nodes) or N3 (≥10 nodes): Always chemo
  if (nStage === 'N2' || nStage === 'N3') {
    return {
      pathway: 'EC_taxan',
      rationale: `N${nStage.slice(1)}: Cytostatika anbefales ved ≥4 positive lymfeknuter`,
    };
  }

  return { pathway: 'unknown', rationale: 'Kan ikke bestemme kjemoterapivei' };
}

function deriveN0Pathway(params) {
  const { tSimple, grade, ki67Value, geneTestDone, gesHighRisk, gesLowRisk, tumorSizeMm } = params;

  // T1a/T1b N0: No chemo regardless
  if (tSimple === 'T1' && tumorSizeMm != null && tumorSizeMm <= 10) {
    return { pathway: 'none', rationale: 'Liten tumor (≤10mm) N0: Ingen kjemoterapi' };
  }

  // T1c N0 or T2 N0
  if (geneTestDone) {
    if (gesLowRisk) {
      return { pathway: 'none', rationale: 'Genekspresjonstest viser lav risiko — ingen kjemoterapi' };
    }
    if (gesHighRisk) {
      if (tSimple === 'T1') {
        return { pathway: 'EC', rationale: 'Genekspresjonstest viser høy risiko, T1c N0: EC ×4' };
      }
      return { pathway: 'EC', rationale: 'Genekspresjonstest viser høy risiko: EC ×4' };
    }
    // Intermediate risk
    return { pathway: 'consider_chemo', rationale: 'Genekspresjonstest viser intermediær risiko — vurder kjemoterapi' };
  }

  // No gene test: use grade + Ki-67
  if (grade === 1) {
    return { pathway: 'none', rationale: 'Grad 1, N0: Ingen kjemoterapi anbefalt' };
  }
  if (grade === 3) {
    return { pathway: 'EC', rationale: 'Grad 3, N0: EC ×4 anbefalt' };
  }
  // Grade 2: gene test recommended
  return { pathway: 'gene_test_needed', rationale: 'Grad 2, N0: Genekspresjonstest anbefales for å avklare kjemoterapibehov' };
}

function deriveN1miPathway(params) {
  const { tSimple, grade, geneTestDone, gesHighRisk, gesLowRisk, tumorSizeMm } = params;

  // Small tumors with N1mi: consider no chemo
  if (tSimple === 'T1' && tumorSizeMm != null && tumorSizeMm <= 10) {
    return { pathway: 'none', rationale: 'Liten tumor (≤10mm) med N1mi: Ingen kjemoterapi' };
  }

  if (geneTestDone) {
    if (gesLowRisk) {
      return { pathway: 'none', rationale: 'N1mi med lav risiko genekspresjonstest: Ingen kjemoterapi' };
    }
    if (gesHighRisk) {
      return { pathway: 'EC', rationale: 'N1mi med høy risiko genekspresjonstest: EC ×4' };
    }
    return { pathway: 'consider_chemo', rationale: 'N1mi med intermediær risiko — vurder kjemoterapi' };
  }

  if (grade === 3) {
    return { pathway: 'EC', rationale: 'N1mi, Grad 3: EC ×4 anbefalt' };
  }
  return { pathway: 'gene_test_needed', rationale: 'N1mi: Genekspresjonstest anbefales' };
}

function deriveN1Pathway(params) {
  const { grade, geneTestDone, gesHighRisk, gesLowRisk, tSimple } = params;

  if (geneTestDone) {
    if (gesLowRisk) {
      return { pathway: 'none', rationale: 'N1 med lav risiko genekspresjonstest: Ingen kjemoterapi' };
    }
    if (gesHighRisk) {
      return { pathway: 'EC_taxan', rationale: 'N1 med høy risiko genekspresjonstest: EC ×4 + taxan' };
    }
    return { pathway: 'consider_chemo', rationale: 'N1 med intermediær risiko — vurder kjemoterapi' };
  }

  if (grade === 3) {
    return { pathway: 'EC_taxan', rationale: 'N1, Grad 3: EC ×4 + taxan anbefalt' };
  }
  if (grade === 1) {
    return { pathway: 'none', rationale: 'N1, Grad 1: Genekspresjonstest anbefales, men lav risiko' };
  }
  return { pathway: 'gene_test_needed', rationale: 'N1: Genekspresjonstest anbefales for å avklare kjemoterapibehov' };
}

/**
 * Determine endocrine therapy.
 * Per NBCG guidelines.
 */
export function deriveEndocrineTherapy(menopausalStatus, isHighRisk, hasChemo) {
  if (menopausalStatus === 'post') {
    return {
      therapy: 'aromatasehemmer',
      detail: 'Aromatasehemmer (AI) i 5 år',
      duration: '5 år',
    };
  }

  if (menopausalStatus === 'pre' || menopausalStatus === 'peri') {
    if (isHighRisk || hasChemo) {
      return {
        therapy: 'tamoxifen_ofs',
        detail: 'Tamoxifen + ovarisk suppresjon (GnRH-agonist), evt. AI + OFS',
        duration: '5-10 år',
        note: 'Ved høy risiko: Vurder AI + OFS',
      };
    }
    return {
      therapy: 'tamoxifen',
      detail: 'Tamoxifen i 5-10 år',
      duration: '5-10 år',
    };
  }

  return {
    therapy: 'tamoxifen',
    detail: 'Tamoxifen (menopausal status ukjent)',
    duration: '5 år',
  };
}

/**
 * Determine bisphosphonate (zoledronic acid / Zometa) eligibility.
 * Per NBCG: postmenopausal, or premenopausal with OFS, and receiving systemic therapy.
 */
export function deriveZometaEligibility(menopausalStatus, age, hasSystemicTherapy, hasOFS) {
  if (!hasSystemicTherapy) {
    return { eligible: false, rationale: 'Ingen systemisk behandling' };
  }

  if (menopausalStatus === 'post') {
    return { eligible: true, rationale: 'Postmenopausal med systemisk behandling: Zoledronsyre 4mg × 6 (q6m)' };
  }

  if ((menopausalStatus === 'pre' || menopausalStatus === 'peri') && hasOFS) {
    return { eligible: true, rationale: 'Premenopausal med OFS: Zoledronsyre 4mg × 6' };
  }

  if (age != null && age >= 55) {
    return { eligible: true, rationale: 'Alder ≥55 med systemisk behandling: Zoledronsyre' };
  }

  return { eligible: false, rationale: 'Premenopausal uten OFS: Zoledronsyre ikke indisert' };
}

/**
 * Derive radiation therapy recommendation.
 * Based on surgery type, node status, and margins.
 */
export function deriveRadiation(surgeryType, nStage, tSimple) {
  if (surgeryType === 'mastectomy') {
    if (nStage === 'N2' || nStage === 'N3' || tSimple === 'T3' || tSimple === 'T4') {
      return {
        recommended: true,
        type: 'lokoregional',
        detail: 'Strålebehandling brystvegg + regionale lymfeknuter',
      };
    }
    if (nStage === 'N1') {
      return {
        recommended: true,
        type: 'lokoregional',
        detail: 'Strålebehandling brystvegg + regionale lymfeknuter (N1)',
      };
    }
    return {
      recommended: false,
      type: null,
      detail: 'Ingen strålebehandling etter mastektomi ved N0/N1mi',
    };
  }

  // Breast-conserving surgery (BCS) — always radiation
  if (surgeryType === 'bcs' || surgeryType === 'lumpectomy') {
    if (nStage === 'N1' || nStage === 'N2' || nStage === 'N3') {
      return {
        recommended: true,
        type: 'bryst_og_regional',
        detail: 'Strålebehandling hele brystet + regionale lymfeknuter',
      };
    }
    return {
      recommended: true,
      type: 'bryst',
      detail: 'Strålebehandling hele brystet',
    };
  }

  return { recommended: null, type: null, detail: 'Kirurgitype ikke angitt' };
}

// ============================================================
// Main CQL evaluation function
// ============================================================

/**
 * Main CQL evaluation: derive all clinical facts from raw patient data.
 *
 * @param {Object} clinicalData - Raw patient data from form or FHIR
 * @returns {Object} All derived clinical facts for DMN and treatment builder
 */
export function evaluateCQL(clinicalData) {
  const {
    // Receptor data
    erStatus, erPercent,
    prStatus, prPercent,
    her2ihc, her2sish,
    her2Status: her2Direct,
    ki67,
    // Staging
    tumorSizeMm, tStageOverride, nStage,
    // Tumor characteristics
    grade,
    // Gene expression
    geneTest, rorScore, rsScore, prosignaSubtype,
    // Patient factors
    menopausalStatus, age, ecogScore,
    // Treatment context
    treatmentMode, surgeryType,
    priorTherapyLines,
    // Risk factors (legacy support)
    hepaticFunction, renalFunction, cardiacRisk,
    neutropeniaRisk, diarrhoeaRisk, needMonotherapy,
    // Legacy metastatic
    metastatic,
  } = clinicalData;

  // --- Receptor status ---
  const erPositive = erStatus === true || erStatus === 'positive' || (erPercent != null && erPercent >= 1);
  const prPositive = prStatus === true || prStatus === 'positive' || (prPercent != null && prPercent >= 1);
  const hrPositive = erPositive || prPositive;

  // --- HER2 ---
  let her2 = her2Direct || null;
  if (!her2 || her2 === 'unknown') {
    her2 = deriveHER2(her2ihc, her2sish);
  }
  const her2Positive = her2 === 'positive';
  const her2Negative = her2 === 'negative';

  // --- Biogroup ---
  const bioGroup = deriveBioGroup(erPositive, prPositive, her2);

  // --- Staging ---
  const tStage = deriveTStage(tumorSizeMm, tStageOverride);
  const tSimple = simplifyTStage(tStage);
  const stadium = deriveStadium(tSimple, nStage);

  // --- Ki-67 ---
  const ki67Value = typeof ki67 === 'number' ? ki67 : parseFloat(ki67);
  const validKi67 = !isNaN(ki67Value) && ki67Value >= 0 && ki67Value <= 100;

  // --- Grade ---
  const gradeNum = typeof grade === 'number' ? grade : parseInt(grade, 10);
  const validGrade = !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 3;

  // --- ECOG ---
  const ecog = typeof ecogScore === 'number' ? ecogScore : parseInt(ecogScore, 10);
  const validEcog = !isNaN(ecog) && ecog >= 0 && ecog <= 5;

  // --- Gene expression ---
  const gesResult = deriveGESRisk(geneTest, rorScore, rsScore, prosignaSubtype, nStage);

  // --- Luminal subtype (HR+HER2- only) ---
  const luminalSubtype = bioGroup === 'HR+HER2-'
    ? deriveLuminalSubtype(validGrade ? gradeNum : null, validKi67 ? ki67Value : null, prPercent)
    : null;

  // --- Treatment mode ---
  const mode = treatmentMode || 'adjuvant';
  const isNeoadjuvant = mode === 'neoadjuvant';

  // --- Chemo pathway (HR+HER2- adjuvant only) ---
  let chemoPathway = null;
  if (bioGroup === 'HR+HER2-' && !isNeoadjuvant) {
    chemoPathway = deriveHRposHER2negChemoPathway({
      tSimple, nStage,
      grade: validGrade ? gradeNum : null,
      ki67Value: validKi67 ? ki67Value : null,
      geneTestDone: gesResult.geneTestDone,
      gesHighRisk: gesResult.gesHighRisk,
      gesLowRisk: gesResult.gesLowRisk,
      prosignaSubtype: gesResult.prosignaSubtype,
      rorScore, rsScore, geneTest,
      tumorSizeMm,
    });
  }

  // --- High risk determination (for endocrine/CDK4/6 decisions) ---
  const hasChemo = chemoPathway && (chemoPathway.pathway === 'EC' || chemoPathway.pathway === 'EC_taxan');
  const isHighRisk = hasChemo ||
    nStage === 'N1' || nStage === 'N2' || nStage === 'N3' ||
    (validGrade && gradeNum === 3) ||
    gesResult.gesHighRisk === true;

  // --- Endocrine therapy (HR+ only) ---
  let endocrineTherapy = null;
  if (hrPositive) {
    endocrineTherapy = deriveEndocrineTherapy(menopausalStatus, isHighRisk, hasChemo);
  }

  // --- Zometa ---
  const hasOFS = endocrineTherapy &&
    (endocrineTherapy.therapy === 'tamoxifen_ofs');
  const hasSystemicTherapy = hasChemo || !!endocrineTherapy;
  const zometa = deriveZometaEligibility(menopausalStatus, age, hasSystemicTherapy, hasOFS);

  // --- Radiation ---
  const radiation = deriveRadiation(surgeryType, nStage, tSimple);

  // --- CDK4/6 eligibility (adjuvant context, for DMN table) ---
  const cdk46eligible = bioGroup === 'HR+HER2-' && !isNeoadjuvant;

  // --- Legacy metastatic eligibility (backward compat) ---
  const isMetastatic = metastatic === true || metastatic === 'yes';
  const legacyEligible = (hrPositive && her2Negative) && validEcog && ecog <= 2 && isMetastatic;

  return {
    // Receptor facts
    erPositive,
    prPositive,
    erPercent: erPercent ?? null,
    prPercent: prPercent ?? null,
    her2Status: her2,
    her2Positive,
    her2Negative,
    her2ihc: her2ihc || null,
    her2sish: her2sish || null,
    hrPositive,

    // Biological classification
    bioGroup,
    luminalSubtype,

    // Staging
    tStage,
    tSimple,
    nStage: nStage || null,
    stadium,
    tumorSizeMm: tumorSizeMm ?? null,

    // Tumor characteristics
    grade: validGrade ? gradeNum : null,
    ki67Value: validKi67 ? ki67Value : null,

    // Gene expression
    geneTest: geneTest || null,
    ...gesResult,

    // ECOG
    ecogScore: validEcog ? ecog : null,

    // Patient factors
    menopausalStatus: menopausalStatus || 'unknown',
    age: age ?? null,
    treatmentMode: mode,
    isNeoadjuvant,

    // Treatment pathway derivations (CQL computed)
    chemoPathway,
    endocrineTherapy,
    zometa,
    radiation,
    isHighRisk,

    // CDK4/6 eligibility (for DMN input)
    cdk46eligible,

    // Legacy compatibility
    isMetastatic,
    eligible: legacyEligible,
    hrPositiveHer2Negative: hrPositive && her2Negative,
    priorTherapyLines: typeof priorTherapyLines === 'number' ? priorTherapyLines : parseInt(priorTherapyLines, 10) || 0,
    hepaticFunction: hepaticFunction || 'normal',
    renalFunction: renalFunction || 'normal',
    cardiacRisk: cardiacRisk || 'low',
    neutropeniaRisk: neutropeniaRisk || 'low',
    diarrhoeaRisk: diarrhoeaRisk || 'low',
    needMonotherapy: needMonotherapy === true || needMonotherapy === 'yes',
    surgeryType: surgeryType || null,
  };
}

/**
 * Validate clinical data — checks for minimum required fields.
 */
export function validateClinicalData(clinicalData) {
  const errors = [];

  if (clinicalData.erStatus == null && clinicalData.erPercent == null) {
    errors.push('Østrogenreseptor (ER) status mangler');
  }
  if (clinicalData.her2Status == null && clinicalData.her2ihc == null) {
    errors.push('HER2-status mangler (angi IHC eller direkte status)');
  }
  if (clinicalData.nStage == null && clinicalData.metastatic == null) {
    errors.push('N-stadium eller metastatisk status mangler');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default { evaluateCQL, validateClinicalData, deriveHER2, deriveBioGroup, deriveTStage, deriveStadium, deriveGESRisk };
