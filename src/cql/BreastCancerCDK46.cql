/**
 * CQL-bibliotek: Brystkreft CDK4/6-inhibitor Retningslinjegraver
 *
 * Formål: Hente og transformere pasientdata fra FHIR/mCODE-ressurser
 * for bruk i DMN-beslutningsregler for CDK4/6-inhibitorvalg.
 *
 * Arkitektur: CQL håndterer datahenting (WHAT), DMN håndterer beslutningslogikk (HOW).
 * Dette sikrer separasjon mellom datainnhenting og beslutningsregler
 * i henhold til BPM+ Health-prinsipper.
 */
library BreastCancerCDK46 version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1'

// -- Kodesystemer --
codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'
codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'
codesystem "RxNorm": 'http://www.nlm.nih.gov/research/umls/rxnorm'

// -- Verdisett --
valueset "Breast Cancer ICD10": 'http://example.org/fhir/ValueSet/breast-cancer-icd10'
valueset "CDK46 Inhibitors": 'http://example.org/fhir/ValueSet/cdk46-inhibitors'
valueset "Endocrine Therapy": 'http://example.org/fhir/ValueSet/endocrine-therapy'

// -- Koder --
code "ER Status": '85337-4' from "LOINC" display 'Østrogenreseptorstatus'
code "PR Status": '85339-0' from "LOINC" display 'Progesteronreseptorstatus'
code "HER2 Status": '85319-2' from "LOINC" display 'HER2-status'
code "Ki67": '85329-1' from "LOINC" display 'Ki-67 proliferasjonsindeks'
code "ECOG Score": '89247-1' from "LOINC" display 'ECOG funksjonsstatus'

code "Positive": '10828004' from "SNOMED" display 'Positiv'
code "Negative": '260385009' from "SNOMED" display 'Negativ'

// -- Kontekst --
context Patient

// ============================================================
// DATAHENTING - Primære kliniske fakta
// ============================================================

/**
 * Aktiv brystkreftdiagnose
 */
define "Has Breast Cancer":
  exists([Condition: "Breast Cancer ICD10"] C
    where C.clinicalStatus ~ ToConcept(Global."active"))

/**
 * Østrogenreseptor-status
 */
define "ER Positive":
  exists([Observation: "ER Status"] O
    where O.status in {'final', 'amended'}
      and O.value ~ "Positive")

/**
 * Progesteronreseptor-status
 */
define "PR Positive":
  exists([Observation: "PR Status"] O
    where O.status in {'final', 'amended'}
      and O.value ~ "Positive")

/**
 * HER2-status
 */
define "HER2 Negative":
  exists([Observation: "HER2 Status"] O
    where O.status in {'final', 'amended'}
      and O.value ~ "Negative")

/**
 * Hormonreseptor-positiv / HER2-negativ (HR+/HER2-)
 * Hovedindikasjon for CDK4/6-inhibitorer
 */
define "Is HR Positive HER2 Negative":
  "ER Positive" and "HER2 Negative"

/**
 * Ki-67 proliferasjonsindeks (%)
 */
define "Ki67 Value":
  Last([Observation: "Ki67"] O
    where O.status in {'final', 'amended'}
    sort by effective).value as Quantity

/**
 * ECOG funksjonsstatus (0-5)
 */
define "ECOG Performance Status":
  Last([Observation: "ECOG Score"] O
    where O.status in {'final', 'amended'}
    sort by effective).value as Integer

// ============================================================
// AVLEDEDE FAKTA - Input til DMN-beslutningstabell
// ============================================================

/**
 * Kvalifisert for CDK4/6-inhibitor?
 * Krav: HR+/HER2-, avansert/metastatisk, ECOG 0-2
 */
define "Eligible for CDK46 Inhibitor":
  "Is HR Positive HER2 Negative"
    and "ECOG Performance Status" <= 2

/**
 * Samlet dataobjekt for DMN-evaluering
 * Disse verdiene sendes som input til DMN-beslutningstabellen
 */
define "CDK46 Decision Input":
  {
    erPositive: "ER Positive",
    prPositive: "PR Positive",
    her2Negative: "HER2 Negative",
    hrPositiveHer2Negative: "Is HR Positive HER2 Negative",
    ki67Value: "Ki67 Value",
    ecogScore: "ECOG Performance Status",
    eligible: "Eligible for CDK46 Inhibitor"
  }
