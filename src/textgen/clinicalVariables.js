/**
 * Variabel- og betingelseskatalog for pasient- og behandlingstekst.
 *
 * Resolverne leser fra `cqlOutput` (avledede pasientdata) og `treatmentPlan`
 * (regelmotorens forslag). Delt mellom «Mal-basert svar på henvisning» på
 * Pasientvurdering-siden og Tabelloppslag 2.0, som bruker pasientgruppene
 * derfra men henter selve anbefalingen fra raden klinikeren har valgt.
 */

// ============================================================
// Available template variables — grouped by clinical category
// ============================================================

export const TEMPLATE_VARIABLES = [
  { group: 'Diagnose', vars: [
    { id: 'diagnosisCode', label: 'Diagnosekode (C50.9 + evt C77.9)', resolver: (cql) => {
      let code = 'C50.9 Ca mammae';
      if (cql.nStage && cql.nStage !== 'N0') code += ', C77.9 Lymfeknutemetastase';
      return code;
    }},
    { id: 'bioGroup', label: 'Biologisk gruppe', resolver: (cql) => cql.bioGroup || '—' },
    { id: 'luminalSubtype', label: 'Luminal subtype', resolver: (cql) => cql.luminalSubtype || '—' },
  ]},
  { group: 'Staging', vars: [
    { id: 'tStage', label: 'T-stadium', resolver: (cql) => cql.tStage || '—' },
    { id: 'nStage', label: 'N-stadium', resolver: (cql) => cql.nStage || '—' },
    { id: 'stadium', label: 'Stadium', resolver: (cql) => cql.stadium || '—' },
    { id: 'stagingFull', label: 'pTNM (full)', resolver: (cql) => `p${cql.tStage || '?'}p${cql.nStage || '?'}` },
  ]},
  { group: 'Reseptorstatus', vars: [
    { id: 'erFull', label: 'ER-status med %', resolver: (cql) => {
      if (!cql.erPositive) return 'ER negativ';
      return `ER+ (${cql.erPercent != null ? cql.erPercent + '%' : 'positiv'})`;
    }},
    { id: 'prFull', label: 'PR-status med %', resolver: (cql) => {
      if (!cql.prPositive) return 'PR negativ';
      return `PR+ (${cql.prPercent != null ? cql.prPercent + '%' : 'positiv'})`;
    }},
    { id: 'erPrCombined', label: 'ER og PR kombinert', resolver: (cql) => {
      // Uten prosentverdi droppes parentesen helt — «PR+ ()» hører ikke hjemme i et svarbrev
      const fmt = (positive, percent, label) =>
        positive ? `${label}+${percent != null ? ` (${percent}%)` : ''}` : `${label}-`;
      return `${fmt(cql.erPositive, cql.erPercent, 'ER')} og ${fmt(cql.prPositive, cql.prPercent, 'PR')}`;
    }},
    { id: 'her2Full', label: 'HER2-status (IHC+SISH)', resolver: (cql) => {
      let s = `HER2 ${cql.her2Positive ? 'Pos' : 'Neg'}`;
      if (cql.her2ihc) s += ` (IHC ${cql.her2ihc}`;
      if (cql.her2sish) s += `, SISH ${cql.her2sish === 'positive' ? 'amplifisert' : 'ikke amplifisert'}`;
      if (cql.her2ihc) s += ')';
      return s;
    }},
    { id: 'ki67', label: 'Ki-67', resolver: (cql) => cql.ki67Value != null ? `Ki-67 ${cql.ki67Value}%` : '—' },
    { id: 'grade', label: 'Histologisk grad', resolver: (cql) => cql.grade ? `Grad ${cql.grade}` : '—' },
  ]},
  { group: 'Genekspresjonstest', vars: [
    { id: 'geneTestResult', label: 'Gentest med score', resolver: (cql) => {
      if (!cql.geneTestDone || cql.geneTest === 'none') return 'Ikke utført';
      if (cql.geneTest === 'prosigna') return `Prosigna ROR-score ${cql.rorScore ?? '—'}`;
      if (cql.geneTest === 'oncotypedx') return `OncotypeDX RS ${cql.rsScore ?? '—'}`;
      return cql.geneTest;
    }},
    { id: 'prosignaSubtype', label: 'Prosigna subtype', resolver: (cql) => {
      if (cql.prosignaSubtype === 'lumA') return 'Luminal A';
      if (cql.prosignaSubtype === 'lumB') return 'Luminal B';
      return '—';
    }},
  ]},
  { group: 'Pasient', vars: [
    { id: 'age', label: 'Alder', resolver: (cql) => cql.age ? `${cql.age} år gammel` : '—' },
    { id: 'ageNum', label: 'Alder (kun tall)', resolver: (cql) => cql.age ? `${cql.age}` : '—' },
    { id: 'menopausalStatus', label: 'Menopausal status', resolver: (cql) => {
      const map = { pre: 'premenopausal', peri: 'perimenopausal', post: 'postmenopausal', unknown: 'usikker menopausal' };
      return map[cql.menopausalStatus] || '—';
    }},
    { id: 'menopausalCertainty', label: 'Sikker/usikker menopause', resolver: (cql) => {
      if (cql.menopausalStatus === 'post') return 'sikker postmenopausal';
      if (cql.menopausalStatus === 'pre') return 'sikker premenopausal';
      if (cql.menopausalStatus === 'peri') return 'usikker menopausal';
      return 'usikker menopausal';
    }},
    { id: 'surgeryType', label: 'Kirurgitype', resolver: (cql) => {
      if (cql.surgeryType === 'bcs') return 'brystbevarende kirurgi (BCT)';
      if (cql.surgeryType === 'mastectomy') return 'mastektomi';
      return '—';
    }},
    { id: 'treatmentMode', label: 'Behandlingsmodus', resolver: (cql) => cql.isNeoadjuvant ? 'neoadjuvant' : 'adjuvant' },
  ]},
  { group: 'Behandlingsresultater', vars: [
    { id: 'chemoRegimen', label: 'Kjemoterapiregime', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo ? chemo.detail : 'Ingen kjemoterapi';
    }},
    { id: 'chemoName', label: 'Kjemoterapinavn (kort)', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo ? chemo.name : 'Ingen kjemoterapi';
    }},
    { id: 'endocrineRegimen', label: 'Endokrin behandling', resolver: (cql, plan) => {
      const endo = plan?.steps?.find(s => s.type === 'endocrine');
      return endo ? endo.detail : 'Ingen endokrin behandling';
    }},
    { id: 'endocrineName', label: 'Endokrin behandling (kort)', resolver: (cql, plan) => {
      const endo = plan?.steps?.find(s => s.type === 'endocrine');
      return endo ? endo.name : 'Ingen endokrin behandling';
    }},
    { id: 'cdk46Regimen', label: 'CDK4/6-hemmer', resolver: (cql, plan) => {
      const cdk = plan?.steps?.find(s => s.type === 'cdk46');
      return cdk ? cdk.detail : 'Ingen CDK4/6-hemmer';
    }},
    { id: 'cdk46Name', label: 'CDK4/6-hemmer (kort)', resolver: (cql, plan) => {
      const cdk = plan?.steps?.find(s => s.type === 'cdk46');
      return cdk ? cdk.name : 'Ingen CDK4/6-hemmer';
    }},
    { id: 'radiationRegimen', label: 'Strålebehandling', resolver: (cql, plan) => {
      const rad = plan?.steps?.find(s => s.type === 'radiation');
      return rad ? rad.detail : 'Ingen strålebehandling';
    }},
    { id: 'bisphosphonate', label: 'Bisfosfonat', resolver: (cql, plan) => {
      const bis = plan?.steps?.find(s => s.type === 'bisphosphonate');
      return bis ? bis.detail : 'Ingen bisfosfonat';
    }},
    { id: 'allStepsSummary', label: 'Alle behandlingstrinn (oppsummert)', resolver: (cql, plan) => {
      if (!plan?.steps?.length) return 'Ingen behandling anbefalt';
      return plan.steps.map(s => s.name).join(', ');
    }},
    { id: 'allStepsDetailed', label: 'Alle behandlingstrinn (detaljert)', resolver: (cql, plan) => {
      if (!plan?.steps?.length) return 'Ingen behandling anbefalt';
      return plan.steps.map((s, i) => `${i + 1}. ${s.detail || s.name}`).join('. ');
    }},
    { id: 'warnings', label: 'Merknader/varsler', resolver: (cql, plan) => {
      if (!plan?.warnings?.length) return 'Ingen merknader';
      return plan.warnings.join('. ');
    }},
    { id: 'hasEC90', label: 'Inneholder EC90 (ja/nei)', resolver: (cql, plan) => {
      const chemo = plan?.steps?.find(s => s.type === 'chemo');
      return chemo && chemo.detail?.includes('EC90') ? 'ja' : 'nei';
    }},
  ]},
];

// Flatten for easy lookup
export const ALL_VARS = TEMPLATE_VARIABLES.flatMap(g => g.vars);

export function resolveVariable(varId, cqlOutput, treatmentPlan) {
  const v = ALL_VARS.find(v => v.id === varId);
  if (!v) return `[${varId}]`;
  return v.resolver(cqlOutput, treatmentPlan);
}

// ============================================================
// Condition evaluators for conditional blocks
// ============================================================

export function evaluateCondition(condId, cqlOutput, treatmentPlan) {
  switch (condId) {
    case 'hasEC90': {
      const chemo = treatmentPlan?.steps?.find(s => s.type === 'chemo');
      return !!(chemo && chemo.detail?.includes('EC90'));
    }
    case 'isTN': return cqlOutput.bioGroup === 'TN';
    case 'isHER2pos': return cqlOutput.her2Positive === true;
    case 'isNeoadjuvant': return cqlOutput.isNeoadjuvant === true;
    case 'hasWarnings': return (treatmentPlan?.warnings?.length ?? 0) > 0;
    case 'hasChemo': return !!treatmentPlan?.steps?.find(s => s.type === 'chemo');
    case 'hasCDK46': return !!treatmentPlan?.steps?.find(s => s.type === 'cdk46');
    case 'hasEndocrine': return !!treatmentPlan?.steps?.find(s => s.type === 'endocrine');
    case 'hasRadiation': return !!treatmentPlan?.steps?.find(s => s.type === 'radiation');
    case 'hasBisphosphonate': return !!treatmentPlan?.steps?.find(s => s.type === 'bisphosphonate');
    case 'hasGeneTest': return cqlOutput.geneTestDone && cqlOutput.geneTest !== 'none';
    case 'isNodePositive': return cqlOutput.nStage && cqlOutput.nStage !== 'N0';
    default: return false;
  }
}

export const CONDITION_OPTIONS = [
  { id: 'hasEC90', label: 'Har EC90-kjemoterapi' },
  { id: 'isTN', label: 'Er trippel negativ' },
  { id: 'isHER2pos', label: 'Er HER2-positiv' },
  { id: 'isNeoadjuvant', label: 'Er neoadjuvant' },
  { id: 'hasWarnings', label: 'Har merknader' },
  { id: 'hasChemo', label: 'Har kjemoterapi' },
  { id: 'hasCDK46', label: 'Har CDK4/6-hemmer' },
  { id: 'hasEndocrine', label: 'Har endokrin behandling' },
  { id: 'hasRadiation', label: 'Har strålebehandling' },
  { id: 'hasBisphosphonate', label: 'Har bisfosfonat' },
  { id: 'hasGeneTest', label: 'Har genekspresjonstest' },
  { id: 'isNodePositive', label: 'Er lymfeknute-positiv' },
];
