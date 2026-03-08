/**
 * CQL Execution Engine Wrapper
 *
 * Kjører CQL-uttrykk mot pasientdata for å hente ut kliniske fakta.
 * I BPM+ Health-arkitekturen er CQL ansvarlig for datahenting (WHAT),
 * mens DMN håndterer beslutningslogikken (HOW).
 *
 * I denne implementasjonen simulerer vi CQL-evaluering med direkte
 * JavaScript-logikk som speiler CQL-definisjonene, for bruk uten
 * full cql-execution kompilator-pipeline.
 */

/**
 * Evaluer CQL-uttrykk mot kliniske pasientdata.
 * Returnerer et objekt med alle CQL-definisjonsverdier.
 *
 * @param {Object} clinicalData - Kliniske pasientdata (fra skjema eller FHIR)
 * @returns {Object} CQL-evalueringsresultater klar for DMN-input
 */
export function evaluateCQL(clinicalData) {
  const {
    erStatus,
    prStatus,
    her2Status,
    ki67,
    ecogScore,
    metastatic,
    menopausalStatus,
    priorTherapyLines,
    hepaticFunction,
    renalFunction,
    cardiacRisk,
    neutropeniaRisk,
    diarrhoeaRisk,
    needMonotherapy,
  } = clinicalData;

  // Primære kliniske fakta (speiler CQL-definisjoner)
  const erPositive = erStatus === true || erStatus === 'positive';
  const prPositive = prStatus === true || prStatus === 'positive';
  const her2Negative = her2Status === false || her2Status === 'negative';
  const hrPositiveHer2Negative = erPositive && her2Negative;

  // ECOG validering
  const ecog = typeof ecogScore === 'number' ? ecogScore : parseInt(ecogScore, 10);
  const validEcog = !isNaN(ecog) && ecog >= 0 && ecog <= 5;

  // Ki-67 validering
  const ki67Value = typeof ki67 === 'number' ? ki67 : parseFloat(ki67);
  const validKi67 = !isNaN(ki67Value) && ki67Value >= 0 && ki67Value <= 100;

  // Kvalifisering for CDK4/6-inhibitor
  const eligible = hrPositiveHer2Negative && validEcog && ecog <= 2 && (metastatic === true || metastatic === 'yes');

  return {
    // Primære fakta
    erPositive,
    prPositive,
    her2Negative,
    hrPositiveHer2Negative,
    ki67Value: validKi67 ? ki67Value : null,
    ecogScore: validEcog ? ecog : null,
    isMetastatic: metastatic === true || metastatic === 'yes',

    // Kvalifisering
    eligible,

    // Kliniske risikofaktorer (for DMN-input)
    menopausalStatus: menopausalStatus || 'unknown',
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
 * Valider at alle nødvendige kliniske data er tilstede
 */
export function validateClinicalData(clinicalData) {
  const errors = [];

  if (clinicalData.erStatus == null) errors.push('Østrogenreseptor (ER) status mangler');
  if (clinicalData.her2Status == null) errors.push('HER2-status mangler');
  if (clinicalData.ecogScore == null) errors.push('ECOG funksjonsstatus mangler');
  if (clinicalData.metastatic == null) errors.push('Metastatisk status mangler');

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default { evaluateCQL, validateClinicalData };
