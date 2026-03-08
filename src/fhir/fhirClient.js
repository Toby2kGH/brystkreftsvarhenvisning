/**
 * FHIR-klient for datahenting fra EHR-systemer.
 * Støtter SMART on FHIR autorisasjon og mCODE-profilerte forespørsler.
 */

const DEFAULT_FHIR_BASE = 'http://localhost:8080/fhir';

export class FhirClient {
  constructor(baseUrl = DEFAULT_FHIR_BASE, accessToken = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      throw new FhirError(`FHIR-forespørsel feilet: ${response.status} ${response.statusText}`, response.status);
    }

    return response.json();
  }

  /**
   * Hent pasient med mCODE CancerPatient-profil
   */
  async getPatient(patientId) {
    return this.request(`/Patient/${patientId}`);
  }

  /**
   * Hent alle aktive brystkreftdiagnoser for pasient
   */
  async getBreastCancerConditions(patientId) {
    return this.request(
      `/Condition?patient=${patientId}&code=http://hl7.org/fhir/sid/icd-10-cm|C50&_profile=http://hl7.org/fhir/us/mcode/StructureDefinition/mcode-primary-cancer-condition`
    );
  }

  /**
   * Hent tumormarkør-observasjoner (ER, PR, HER2, Ki-67)
   */
  async getTumorMarkers(patientId) {
    const loincCodes = ['85337-4', '85339-0', '85319-2', '85329-1'].join(',');
    return this.request(`/Observation?patient=${patientId}&code=http://loinc.org|${loincCodes}`);
  }

  /**
   * Hent ECOG funksjonsstatus
   */
  async getECOGStatus(patientId) {
    return this.request(`/Observation?patient=${patientId}&code=http://loinc.org|89247-1&_sort=-date&_count=1`);
  }

  /**
   * Hent medikamenthistorikk
   */
  async getMedicationStatements(patientId) {
    return this.request(`/MedicationStatement?patient=${patientId}&_sort=-effective`);
  }

  /**
   * Hent laboratorieresultater (lever, nyre)
   */
  async getLabResults(patientId, loincCodes) {
    return this.request(`/Observation?patient=${patientId}&code=http://loinc.org|${loincCodes.join(',')}&_sort=-date&_count=5`);
  }

  /**
   * Hent all relevant klinisk data for CDK4/6-inhibitor beslutningsstøtte
   */
  async getDecisionSupportData(patientId) {
    const [patient, conditions, tumorMarkers, ecog, medications] = await Promise.all([
      this.getPatient(patientId),
      this.getBreastCancerConditions(patientId),
      this.getTumorMarkers(patientId),
      this.getECOGStatus(patientId),
      this.getMedicationStatements(patientId),
    ]);

    return {
      patient,
      conditions: conditions.entry?.map((e) => e.resource) ?? [],
      tumorMarkers: tumorMarkers.entry?.map((e) => e.resource) ?? [],
      ecogStatus: ecog.entry?.[0]?.resource ?? null,
      medications: medications.entry?.map((e) => e.resource) ?? [],
    };
  }
}

class FhirError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'FhirError';
    this.statusCode = statusCode;
  }
}

export default FhirClient;
