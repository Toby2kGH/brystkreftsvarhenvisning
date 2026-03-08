/**
 * CQL Execution Engine — Pure fact derivation (WHAT).
 *
 * CQL only derives clinical FACTS from raw patient data.
 * All DECISIONS are made by DMN tables (transparent, editable).
 *
 * Derived facts:
 * - Receptor status (ER, PR, HER2 from IHC/SISH)
 * - Biological subgroup
 * - Staging (T-stage, N-stage, stadium)
 * - Ki-67, grade validation
 * - Gene expression test scores
 * - Luminal subtype
 * - Risk flags
 */

/**
 * Derive simplified T-stage from tumor size.
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

export function simplifyTStage(tStage) {
  if (!tStage) return null;
  if (tStage.startsWith('T1')) return 'T1';
  return tStage;
}

/**
 * Derive clinical stadium from T and N staging.
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
 * Derive luminal subtype for HR+HER2- tumors.
 */
export function deriveLuminalSubtype(grade, ki67Value, prPercent) {
  if (grade === 3) return 'B-like';
  if (ki67Value != null && ki67Value >= 20) return 'B-like';
  if (prPercent != null && prPercent < 20) return 'B-like';
  if (grade != null && grade <= 2) return 'A-like';
  return 'unknown';
}

/**
 * Derive biological subgroup.
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
 * Main CQL evaluation: derive all clinical facts from raw patient data.
 * NO decisions are made here — only facts for DMN input.
 */
export function evaluateCQL(clinicalData) {
  const {
    erStatus, erPercent, prStatus, prPercent,
    her2ihc, her2sish, her2Status: her2Direct,
    ki67, tumorSizeMm, tStageOverride, nStage, grade,
    geneTest, rorScore, rsScore, prosignaSubtype,
    menopausalStatus, age, ecogScore,
    treatmentMode, surgeryType, priorTherapyLines,
    hepaticFunction, renalFunction, cardiacRisk,
    neutropeniaRisk, diarrhoeaRisk, needMonotherapy,
    metastatic,
  } = clinicalData;

  // --- Receptor status ---
  const erPositive = erStatus === true || erStatus === 'positive' || (erPercent != null && erPercent >= 1);
  const prPositive = prStatus === true || prStatus === 'positive' || (prPercent != null && prPercent >= 1);
  const hrPositive = erPositive || prPositive;

  // --- HER2 (basic derivation — DMN HER2 table gives detailed rationale) ---
  let her2 = her2Direct || null;
  if (!her2 || her2 === 'unknown') {
    if (her2ihc === '3+') her2 = 'positive';
    else if (her2ihc === '0' || her2ihc === '1+') her2 = 'negative';
    else if (her2ihc === '2+') {
      if (her2sish === 'positive' || her2sish === 'amplified') her2 = 'positive';
      else if (her2sish === 'negative' || her2sish === 'not_amplified') her2 = 'negative';
      else her2 = 'equivocal';
    } else her2 = 'unknown';
  }
  const her2Positive = her2 === 'positive';
  const her2Negative = her2 === 'negative';

  // --- Biogroup ---
  const bioGroup = deriveBioGroup(erPositive, prPositive, her2);

  // --- Staging ---
  const tStage = deriveTStage(tumorSizeMm, tStageOverride);
  const tSimple = simplifyTStage(tStage);
  const stadium = deriveStadium(tSimple, nStage);

  // --- Value parsing ---
  const ki67Value = typeof ki67 === 'number' ? ki67 : parseFloat(ki67);
  const validKi67 = !isNaN(ki67Value) && ki67Value >= 0 && ki67Value <= 100;
  const gradeNum = typeof grade === 'number' ? grade : parseInt(grade, 10);
  const validGrade = !isNaN(gradeNum) && gradeNum >= 1 && gradeNum <= 3;
  const ecog = typeof ecogScore === 'number' ? ecogScore : parseInt(ecogScore, 10);
  const validEcog = !isNaN(ecog) && ecog >= 0 && ecog <= 5;
  const rorVal = typeof rorScore === 'number' ? rorScore : parseFloat(rorScore);
  const validRor = !isNaN(rorVal) && rorVal >= 0;
  const rsVal = typeof rsScore === 'number' ? rsScore : parseFloat(rsScore);
  const validRs = !isNaN(rsVal) && rsVal >= 0;

  // --- Luminal subtype ---
  const luminalSubtype = bioGroup === 'HR+HER2-'
    ? deriveLuminalSubtype(validGrade ? gradeNum : null, validKi67 ? ki67Value : null, prPercent)
    : null;

  // --- Treatment mode ---
  const mode = treatmentMode || 'adjuvant';
  const isNeoadjuvant = mode === 'neoadjuvant';

  // --- High risk (fact, not decision) ---
  const isHighRisk =
    nStage === 'N1' || nStage === 'N2' || nStage === 'N3' ||
    (validGrade && gradeNum === 3);

  // --- CDK4/6 eligibility flag ---
  const cdk46eligible = bioGroup === 'HR+HER2-' && !isNeoadjuvant;

  // --- Gene expression facts ---
  const geneTestDone = geneTest && geneTest !== 'none';
  const gesHighRisk = geneTestDone && (
    (geneTest === 'prosigna' && validRor && rorVal > 60) ||
    (geneTest === 'oncotypedx' && validRs && rsVal > 25)
  );
  const gesLowRisk = geneTestDone && (
    (geneTest === 'prosigna' && validRor && rorVal <= 40) ||
    (geneTest === 'oncotypedx' && validRs && rsVal <= 25)
  );

  // --- Systemic therapy flags (for zometa DMN input) ---
  // These are basic flags; actual therapy decisions come from DMN tables
  const hasSystemicTherapy = hrPositive || bioGroup === 'TN' || bioGroup === 'HR-HER2+' || bioGroup === 'HR+HER2+';
  const hasOFS = hrPositive && (menopausalStatus === 'pre' || menopausalStatus === 'peri') && isHighRisk;

  // --- Legacy ---
  const isMetastatic = metastatic === true || metastatic === 'yes';
  const legacyEligible = hrPositive && her2Negative && validEcog && ecog <= 2 && isMetastatic;

  return {
    // Receptor facts
    erPositive, prPositive, hrPositive,
    erPercent: erPercent ?? null,
    prPercent: prPercent ?? null,
    her2Status: her2, her2Positive, her2Negative,
    her2ihc: her2ihc || null, her2sish: her2sish || null,

    // Biological classification
    bioGroup, luminalSubtype,

    // Staging
    tStage, tSimple,
    nStage: nStage || null,
    stadium,
    tumorSizeMm: tumorSizeMm ?? null,

    // Tumor characteristics
    grade: validGrade ? gradeNum : null,
    ki67Value: validKi67 ? ki67Value : null,

    // Gene expression
    geneTest: geneTest || 'none',
    geneTestDone: !!geneTestDone,
    rorScore: validRor ? rorVal : null,
    rsScore: validRs ? rsVal : null,
    prosignaSubtype: prosignaSubtype || null,
    gesHighRisk, gesLowRisk,

    // ECOG
    ecogScore: validEcog ? ecog : null,

    // Patient factors
    menopausalStatus: menopausalStatus || 'unknown',
    age: age ?? null,
    treatmentMode: mode,
    isNeoadjuvant,
    surgeryType: surgeryType || null,

    // Risk flags (facts)
    isHighRisk,
    cdk46eligible,
    hasSystemicTherapy,
    hasOFS,

    // Legacy
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
  };
}

/**
 * Validate clinical data.
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
  return { valid: errors.length === 0, errors };
}

export default { evaluateCQL, validateClinicalData, deriveBioGroup, deriveTStage, deriveStadium, deriveLuminalSubtype };
