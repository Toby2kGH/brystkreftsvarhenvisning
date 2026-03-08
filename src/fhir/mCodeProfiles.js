/**
 * mCODE (Minimal Common Oncology Data Elements) FHIR profiler.
 * Mapper mellom kliniske data og mCODE/FHIR-ressurser for brystkreft.
 *
 * Profiler brukt:
 * - mCODE CancerPatient (US Core Patient)
 * - mCODE PrimaryCancerCondition
 * - mCODE TNMClinicalStageGroup
 * - mCODE TumorMarkerTest (ER, PR, HER2, Ki-67)
 * - mCODE CancerRelatedMedicationStatement
 * - mCODE ECOGPerformanceStatus
 */

// SNOMED CT og LOINC koder for brystkreftbehandling
export const CODE_SYSTEMS = {
  SNOMED: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  ICD10: 'http://hl7.org/fhir/sid/icd-10-cm',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  MCODE: 'http://hl7.org/fhir/us/mcode/StructureDefinition',
};

export const BREAST_CANCER_CODES = {
  // ICD-10 brystkreft
  primaryDiagnosis: { system: CODE_SYSTEMS.ICD10, code: 'C50', display: 'Ondartet svulst i bryst' },

  // Tumormarkører (LOINC)
  estrogenReceptor: { system: CODE_SYSTEMS.LOINC, code: '85337-4', display: 'Østrogenreseptor' },
  progesteroneReceptor: { system: CODE_SYSTEMS.LOINC, code: '85339-0', display: 'Progesteronreseptor' },
  her2Status: { system: CODE_SYSTEMS.LOINC, code: '85319-2', display: 'HER2-status' },
  ki67: { system: CODE_SYSTEMS.LOINC, code: '85329-1', display: 'Ki-67 proliferasjonsindeks' },

  // ECOG (LOINC)
  ecogStatus: { system: CODE_SYSTEMS.LOINC, code: '89247-1', display: 'ECOG funksjonsstatus' },

  // CDK4/6-inhibitorer (RxNorm)
  palbociclib: { system: CODE_SYSTEMS.RXNORM, code: '1873983', display: 'Palbociclib' },
  ribociclib: { system: CODE_SYSTEMS.RXNORM, code: '1946825', display: 'Ribociclib' },
  abemaciclib: { system: CODE_SYSTEMS.RXNORM, code: '2049106', display: 'Abemaciclib' },

  // Endokrinterapi (RxNorm)
  letrozol: { system: CODE_SYSTEMS.RXNORM, code: '72965', display: 'Letrozol' },
  fulvestrant: { system: CODE_SYSTEMS.RXNORM, code: '258494', display: 'Fulvestrant' },
  tamoxifen: { system: CODE_SYSTEMS.RXNORM, code: '10324', display: 'Tamoksifen' },
};

/**
 * Bygg en mCODE PrimaryCancerCondition FHIR-ressurs
 */
export function buildPrimaryCancerCondition(patientId, { stage, erStatus, prStatus, her2Status, metastatic }) {
  return {
    resourceType: 'Condition',
    meta: {
      profile: [`${CODE_SYSTEMS.MCODE}/mcode-primary-cancer-condition`],
    },
    subject: { reference: `Patient/${patientId}` },
    code: {
      coding: [BREAST_CANCER_CODES.primaryDiagnosis],
    },
    stage: stage
      ? [
          {
            summary: {
              coding: [
                {
                  system: CODE_SYSTEMS.SNOMED,
                  code: stage,
                  display: `Stadium ${stage}`,
                },
              ],
            },
          },
        ]
      : undefined,
    extension: [
      {
        url: `${CODE_SYSTEMS.MCODE}/mcode-histology-morphology-behavior`,
        valueCodeableConcept: {
          coding: [
            {
              system: CODE_SYSTEMS.SNOMED,
              code: metastatic ? '14799000' : '399919001',
              display: metastatic ? 'Metastatisk neoplasme' : 'Primær neoplasme',
            },
          ],
        },
      },
    ],
  };
}

/**
 * Bygg mCODE TumorMarkerTest observasjoner
 */
export function buildTumorMarkerTests(patientId, { erStatus, prStatus, her2Status, ki67 }) {
  const observations = [];

  if (erStatus != null) {
    observations.push(buildObservation(patientId, BREAST_CANCER_CODES.estrogenReceptor, erStatus, 'Positiv', 'Negativ'));
  }
  if (prStatus != null) {
    observations.push(buildObservation(patientId, BREAST_CANCER_CODES.progesteroneReceptor, prStatus, 'Positiv', 'Negativ'));
  }
  if (her2Status != null) {
    observations.push(buildObservation(patientId, BREAST_CANCER_CODES.her2Status, her2Status, 'Positiv', 'Negativ'));
  }
  if (ki67 != null) {
    observations.push({
      resourceType: 'Observation',
      meta: { profile: [`${CODE_SYSTEMS.MCODE}/mcode-tumor-marker-test`] },
      subject: { reference: `Patient/${patientId}` },
      code: { coding: [BREAST_CANCER_CODES.ki67] },
      valueQuantity: { value: ki67, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
      status: 'final',
    });
  }

  return observations;
}

function buildObservation(patientId, code, isPositive, posDisplay, negDisplay) {
  return {
    resourceType: 'Observation',
    meta: { profile: [`${CODE_SYSTEMS.MCODE}/mcode-tumor-marker-test`] },
    subject: { reference: `Patient/${patientId}` },
    code: { coding: [code] },
    valueCodeableConcept: {
      coding: [
        {
          system: CODE_SYSTEMS.SNOMED,
          code: isPositive ? '10828004' : '260385009',
          display: isPositive ? posDisplay : negDisplay,
        },
      ],
    },
    status: 'final',
  };
}

/**
 * Bygg mCODE ECOGPerformanceStatus
 */
export function buildECOGStatus(patientId, ecogScore) {
  return {
    resourceType: 'Observation',
    meta: { profile: [`${CODE_SYSTEMS.MCODE}/mcode-ecog-performance-status`] },
    subject: { reference: `Patient/${patientId}` },
    code: { coding: [BREAST_CANCER_CODES.ecogStatus] },
    valueInteger: ecogScore,
    status: 'final',
  };
}

/**
 * Bygg komplett mCODE-kompatibelt FHIR Bundle fra kliniske data
 */
export function buildPatientBundle(clinicalData) {
  const {
    patientId,
    name,
    birthDate,
    gender,
    erStatus,
    prStatus,
    her2Status,
    ki67,
    ecogScore,
    stage,
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

  const patient = {
    resourceType: 'Patient',
    id: patientId,
    meta: { profile: [`${CODE_SYSTEMS.MCODE}/mcode-cancer-patient`] },
    name: name ? [{ text: name }] : undefined,
    birthDate,
    gender,
  };

  const condition = buildPrimaryCancerCondition(patientId, { stage, erStatus, prStatus, her2Status, metastatic });
  const tumorMarkers = buildTumorMarkerTests(patientId, { erStatus, prStatus, her2Status, ki67 });
  const ecog = ecogScore != null ? buildECOGStatus(patientId, ecogScore) : null;

  const entries = [
    { resource: patient, fullUrl: `urn:uuid:patient-${patientId}` },
    { resource: condition, fullUrl: `urn:uuid:condition-${patientId}` },
    ...tumorMarkers.map((obs, i) => ({ resource: obs, fullUrl: `urn:uuid:obs-${patientId}-${i}` })),
  ];

  if (ecog) {
    entries.push({ resource: ecog, fullUrl: `urn:uuid:ecog-${patientId}` });
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
    // Kliniske tilleggsdata som ikke har direkte FHIR-mapping
    _clinicalContext: {
      menopausalStatus,
      priorTherapyLines,
      hepaticFunction,
      renalFunction,
      cardiacRisk,
      neutropeniaRisk,
      diarrhoeaRisk,
      needMonotherapy,
    },
  };
}
