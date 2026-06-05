/**
 * Kjernetyper for klinisk retningslinjegraversystem.
 *
 * Disse typene sikrer korrekthet gjennom hele pipelinen:
 *   PatientInput → CQLOutput → DMN-tabeller → TreatmentPlan
 *
 * VIKTIG: Endringer i disse typene krever oppdatering av alle nedstrøms konsumenter.
 */

// ============================================================
// 1. Pasientinput (fra skjema / FHIR)
// ============================================================

export type ERStatus = 'positive' | 'negative';
export type PRStatus = 'positive' | 'negative';
export type HER2IHC = '0' | '1+' | '2+' | '3+';
export type HER2SISH = 'positive' | 'negative';
export type HER2Status = 'positive' | 'negative' | 'equivocal' | 'unknown';
export type NStage = 'N0' | 'N1mi' | 'N1' | 'N2' | 'N3';
export type TStageDetailed = 'T1a' | 'T1b' | 'T1c' | 'T2' | 'T3' | 'T4';
export type TStageSimple = 'T1' | 'T2' | 'T3' | 'T4';
export type Stadium = 'I' | 'IIA' | 'IIB' | 'IIIA' | 'IIIB' | 'IIIC';
export type Grade = 1 | 2 | 3;
export type MenopausalStatus = 'pre' | 'peri' | 'post' | 'unknown';
export type SurgeryType = 'bcs' | 'mastectomy';
export type TreatmentMode = 'adjuvant' | 'neoadjuvant' | 'post-neoadjuvant';
export type GeneTest = 'prosigna' | 'oncotypedx' | 'none';
export type BRCAStatus = 'BRCA1' | 'BRCA2' | 'negative' | 'not_tested' | 'VUS';
export type HistologicalType = 'ductal' | 'lobular' | 'other';
export type PCRStatus = 'pCR' | 'non-pCR' | 'not_applicable';
export type ProsignaSubtype = 'lumA' | 'lumB';
export type BioGroup = 'HR+HER2-' | 'HR+HER2+' | 'HR-HER2+' | 'TN' | 'unknown';
export type LuminalSubtype = 'A-like' | 'B-like' | 'unknown';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type OrganFunction = 'normal' | 'reduced' | 'severe';

export interface PatientInput {
  // Reseptor
  erStatus?: ERStatus | null;
  erPercent?: number | null;
  prStatus?: PRStatus | null;
  prPercent?: number | null;

  // HER2
  her2Status?: HER2Status | null;
  her2ihc?: HER2IHC | null;
  her2sish?: HER2SISH | null;

  // Tumor/svulst
  tumorSizeMm?: number | null;
  grade?: Grade | string | null;
  ki67?: number | null;

  // Stadieinndeling
  nStage?: NStage | null;
  tStageOverride?: 'T4' | null;

  // Genekspresjon
  geneTest?: GeneTest | null;
  geneTestDone?: boolean;
  rorScore?: number | null;
  rsScore?: number | null;
  prosignaSubtype?: ProsignaSubtype | null;

  // Pasientfaktorer
  age?: number | null;
  menopausalStatus?: MenopausalStatus | null;
  surgeryType?: SurgeryType | null;
  ecogScore?: number | null;
  treatmentMode?: TreatmentMode;

  // Risiko / organfunksjon
  cardiacRisk?: RiskLevel;
  renalFunction?: OrganFunction;
  hepaticFunction?: OrganFunction;
  neutropeniaRisk?: RiskLevel;
  diarrhoeaRisk?: RiskLevel;
  needMonotherapy?: boolean;
  priorTherapyLines?: number;

  // BRCA / genetisk testing
  brcaStatus?: BRCAStatus | null;

  // Histologisk type
  histologicalType?: HistologicalType | null;

  // Post-neoadjuvant
  pcrStatus?: PCRStatus | null;

  // Metastatisk (legacy)
  metastatic?: boolean;
  patientId?: string;
}

// ============================================================
// 2. CQL-output (deriverte kliniske fakta)
// ============================================================

export interface CQLOutput {
  // Reseptorstatus
  erPositive: boolean;
  prPositive: boolean;
  hrPositive: boolean;
  erPercent: number | null;
  prPercent: number | null;

  // HER2
  her2Status: HER2Status;
  her2Positive: boolean;
  her2Negative: boolean;
  her2ihc: HER2IHC | null;
  her2sish: HER2SISH | null;

  // Biologisk klassifisering
  bioGroup: BioGroup;
  luminalSubtype: LuminalSubtype | null;

  // Stadieinndeling
  tStage: TStageDetailed | null;
  tSimple: TStageSimple | null;
  nStage: NStage | null;
  stadium: Stadium | null;
  tumorSizeMm: number | null;

  // Tumor/svulstkarakteristika
  grade: Grade | null;
  ki67Value: number | null;

  // Genekspresjon
  geneTest: GeneTest;
  geneTestDone: boolean;
  rorScore: number | null;
  rsScore: number | null;
  prosignaSubtype: ProsignaSubtype | null;
  gesHighRisk: boolean;
  gesLowRisk: boolean;

  // Pasientfaktorer
  ecogScore: number | null;
  menopausalStatus: MenopausalStatus;
  age: number | null;
  treatmentMode: TreatmentMode;
  isNeoadjuvant: boolean;
  surgeryType: SurgeryType | null;

  // BRCA / genetikk
  brcaStatus: BRCAStatus;
  brcaMutated: boolean;
  olaparibEligible: boolean;

  // Histologisk type
  histologicalType: HistologicalType | null;

  // Post-neoadjuvant
  pcrStatus: PCRStatus;
  isPostNeoadjuvant: boolean;

  // Risikoflagg
  isHighRisk: boolean;
  cdk46eligible: boolean;
  hasSystemicTherapy: boolean;
  hasOFS: boolean;

  // Legacy
  isMetastatic: boolean;
  eligible: boolean;
  hrPositiveHer2Negative: boolean;
  priorTherapyLines: number;
  hepaticFunction: string;
  renalFunction: string;
  cardiacRisk: string;
  neutropeniaRisk: string;
  diarrhoeaRisk: string;
  needMonotherapy: boolean;
}

// ============================================================
// 3. DMN-tabelltyper
// ============================================================

export type HitPolicy = 'FIRST' | 'PRIORITY' | 'COLLECT' | 'RULE ORDER';

export type ConditionValue =
  | string
  | number
  | boolean
  | null
  | ConditionValue[]                          // OR (disjunksjon)
  | { not: ConditionValue }                   // NOT (negasjon)
  | { gte?: number; gt?: number; lte?: number; lt?: number }; // Intervall

export interface DMNInput {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  allowedValues?: (string | number | boolean | null)[];
}

export interface DMNOutput {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'string[]';
  allowedValues?: (string | number | boolean)[];
}

// ---- Retningslinjekildereferanse (sporbarhet) ----

export interface GuidelineReference {
  /** Navn på retningslinje, f.eks. "Nasjonalt handlingsprogram for brystkreft" */
  document: string;
  /** Spesifikt kapittel/seksjon, f.eks. "Kap. 12.3.2" */
  chapter?: string;
  /** Sidetall i retningslinjen, f.eks. "s. 45-47" */
  page?: string;
  /** Revisjon/versjon av retningslinjen, f.eks. "Mars 2025" */
  revision: string;
  /** NBCG tabellarisk oversikt-referanse, f.eks. "NBCG tabellarisk oversikt 17.12.24" */
  nbcgTable?: string;
  /** Klinisk studiereferanse, f.eks. "MonarchE", "KEYNOTE-522" */
  trialReference?: string;
}

export interface RuleChangeEntry {
  /** ISO-tidsstempel for endringen */
  timestamp: string;
  /** Hvem som gjorde endringen (bruker-ID eller "system") */
  changedBy: string;
  /** Hva som ble endret */
  description: string;
  /** Forrige regelversjon (for diff) */
  previousRule?: Partial<DMNRule>;
}

export interface DMNRule {
  id: string;
  description?: string;
  priority?: number;
  conditions: Record<string, ConditionValue>;
  outputs: Record<string, unknown>;
  /** Referanse til klinisk retningslinjekilde for denne regelen */
  sourceRef?: GuidelineReference;
  /** Om regelen er endret fra standard (systemstyrt) */
  isModified?: boolean;
  /** Tidsstempel for siste endring via admin-UI */
  lastModifiedAt?: string;
  /** Bruker som sist endret denne regelen */
  lastModifiedBy?: string;
}

export interface DMNTable {
  id: string;
  name: string;
  hitPolicy: HitPolicy;
  version: string;
  lastUpdated: string;
  inputs: DMNInput[];
  outputs: DMNOutput[];
  rules: DMNRule[];
  /** Primær retningslinjekilde for hele tabellen */
  guidelineSource?: GuidelineReference;
  /** Endringslogg for tabellen */
  changeLog?: RuleChangeEntry[];
  /** Om noen regler i tabellen er endret fra standardverdier */
  hasModifiedRules?: boolean;
}

export interface DMNEvalResult {
  tableId: string;
  tableName: string;
  matched: boolean;
  result: Record<string, unknown> | Record<string, unknown>[] | null;
  matchedRules: Array<{
    ruleId: string;
    priority: number;
    description?: string;
    outputs: Record<string, unknown>;
  }>;
  allRulesEvaluated: number;
  hitPolicy?: HitPolicy;
}

// ============================================================
// 4. Behandlingsplan
// ============================================================

export type StepType = 'chemo' | 'endocrine' | 'cdk46' | 'radiation' | 'bisphosphonate' | 'targeted' | 'custom';

export interface TreatmentStep {
  type: StepType;
  name: string;
  detail: string;
  rationale?: string;
  duration?: string;
  priority?: number;
}

export interface TreatmentPlan {
  bioGroup: BioGroup;
  steps: TreatmentStep[];
  warnings: string[];
  dmnResults: Record<string, DMNEvalResult>;
  isNeoadjuvant?: boolean;
  luminalSubtype?: LuminalSubtype | null;
  chemoPathway?: string | null;
}

// ============================================================
// 5. Regelkonfliktdeteksjon
// ============================================================

export interface RuleConflict {
  tableId: string;
  tableName: string;
  ruleA: string;
  ruleB: string;
  overlapDescription: string;
  severity: 'error' | 'warning' | 'info';
}

// ============================================================
// 6. DMN JSON-skjema metadata
// ============================================================

export const DMN_SCHEMA_VERSION = '1.0.0';

export interface DMNSchemaMetadata {
  schemaVersion: string;
  generatedAt: string;
  tableCount: number;
  totalRuleCount: number;
}
