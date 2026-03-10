/**
 * Core type definitions for the clinical decision support system.
 *
 * These types enforce correctness across the entire pipeline:
 *   PatientInput → CQLOutput → DMN Tables → TreatmentPlan
 *
 * IMPORTANT: Changes to these types require updating all downstream consumers.
 */

// ============================================================
// 1. Patient Input (from form / FHIR)
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
export type TreatmentMode = 'adjuvant' | 'neoadjuvant';
export type GeneTest = 'prosigna' | 'oncotypedx' | 'none';
export type ProsignaSubtype = 'lumA' | 'lumB';
export type BioGroup = 'HR+HER2-' | 'HR+HER2+' | 'HR-HER2+' | 'TN' | 'unknown';
export type LuminalSubtype = 'A-like' | 'B-like' | 'unknown';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type OrganFunction = 'normal' | 'reduced' | 'severe';

export interface PatientInput {
  // Receptor
  erStatus?: ERStatus | null;
  erPercent?: number | null;
  prStatus?: PRStatus | null;
  prPercent?: number | null;

  // HER2
  her2Status?: HER2Status | null;
  her2ihc?: HER2IHC | null;
  her2sish?: HER2SISH | null;

  // Tumor
  tumorSizeMm?: number | null;
  grade?: Grade | string | null;
  ki67?: number | null;

  // Staging
  nStage?: NStage | null;
  tStageOverride?: 'T4' | null;

  // Gene expression
  geneTest?: GeneTest | null;
  geneTestDone?: boolean;
  rorScore?: number | null;
  rsScore?: number | null;
  prosignaSubtype?: ProsignaSubtype | null;

  // Patient factors
  age?: number | null;
  menopausalStatus?: MenopausalStatus | null;
  surgeryType?: SurgeryType | null;
  ecogScore?: number | null;
  treatmentMode?: TreatmentMode;

  // Risk / organ function
  cardiacRisk?: RiskLevel;
  renalFunction?: OrganFunction;
  hepaticFunction?: OrganFunction;
  neutropeniaRisk?: RiskLevel;
  diarrhoeaRisk?: RiskLevel;
  needMonotherapy?: boolean;
  priorTherapyLines?: number;

  // Metastatic (legacy)
  metastatic?: boolean;
  patientId?: string;
}

// ============================================================
// 2. CQL Output (derived clinical facts)
// ============================================================

export interface CQLOutput {
  // Receptor status
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

  // Biological classification
  bioGroup: BioGroup;
  luminalSubtype: LuminalSubtype | null;

  // Staging
  tStage: TStageDetailed | null;
  tSimple: TStageSimple | null;
  nStage: NStage | null;
  stadium: Stadium | null;
  tumorSizeMm: number | null;

  // Tumor characteristics
  grade: Grade | null;
  ki67Value: number | null;

  // Gene expression
  geneTest: GeneTest;
  geneTestDone: boolean;
  rorScore: number | null;
  rsScore: number | null;
  prosignaSubtype: ProsignaSubtype | null;
  gesHighRisk: boolean;
  gesLowRisk: boolean;

  // Patient factors
  ecogScore: number | null;
  menopausalStatus: MenopausalStatus;
  age: number | null;
  treatmentMode: TreatmentMode;
  isNeoadjuvant: boolean;
  surgeryType: SurgeryType | null;

  // Risk flags
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
// 3. DMN Table Types
// ============================================================

export type HitPolicy = 'FIRST' | 'PRIORITY' | 'COLLECT' | 'RULE ORDER';

export type ConditionValue =
  | string
  | number
  | boolean
  | null
  | ConditionValue[]                          // OR (disjunction)
  | { not: ConditionValue }                   // NOT
  | { gte?: number; gt?: number; lte?: number; lt?: number }; // Range

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

// ---- Guideline source reference (traceability) ----

export interface GuidelineReference {
  /** Guideline document name, e.g. "Nasjonalt handlingsprogram for brystkreft" */
  document: string;
  /** Specific chapter/section, e.g. "Kap. 12.3.2" */
  chapter?: string;
  /** Page number(s) in the guideline, e.g. "s. 45-47" */
  page?: string;
  /** Guideline revision/version, e.g. "Mars 2025" */
  revision: string;
  /** NBCG tabular overview reference, e.g. "NBCG tabellarisk oversikt 17.12.24" */
  nbcgTable?: string;
  /** Clinical trial reference, e.g. "MonarchE", "KEYNOTE-522" */
  trialReference?: string;
}

export interface RuleChangeEntry {
  /** ISO timestamp of the change */
  timestamp: string;
  /** Who made the change (user ID or "system") */
  changedBy: string;
  /** What was changed */
  description: string;
  /** Previous rule snapshot (for diff) */
  previousRule?: Partial<DMNRule>;
}

export interface DMNRule {
  id: string;
  description?: string;
  priority?: number;
  conditions: Record<string, ConditionValue>;
  outputs: Record<string, unknown>;
  /** Reference to the clinical guideline source for this rule */
  sourceRef?: GuidelineReference;
  /** Whether this rule has been modified from the default (system-managed) */
  isModified?: boolean;
  /** Timestamp of last modification via admin UI */
  lastModifiedAt?: string;
  /** User who last modified this rule */
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
  /** Primary guideline source for the entire table */
  guidelineSource?: GuidelineReference;
  /** Change log for the table */
  changeLog?: RuleChangeEntry[];
  /** Whether any rules in this table have been modified from defaults */
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
// 4. Treatment Plan
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
// 5. Rule Conflict Detection
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
// 6. DMN JSON Schema metadata
// ============================================================

export const DMN_SCHEMA_VERSION = '1.0.0';

export interface DMNSchemaMetadata {
  schemaVersion: string;
  generatedAt: string;
  tableCount: number;
  totalRuleCount: number;
}
