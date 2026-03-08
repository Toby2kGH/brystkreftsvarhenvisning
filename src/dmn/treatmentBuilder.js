/**
 * Treatment Builder — Assembles complete treatment plans from CQL facts + DMN results.
 *
 * Handles all 4 biological subgroups × 2 treatment modes:
 * - HR+HER2- adjuvant (most complex: chemo pathway + endocrine + CDK4/6 + radiation + zometa)
 * - HR+HER2+ adjuvant (chemo + anti-HER2 + endocrine + radiation)
 * - HR-HER2+ adjuvant (chemo + anti-HER2 + radiation)
 * - Triple Negative adjuvant (chemo + radiation, evt. immunterapi)
 * - Neoadjuvant (all subgroups)
 *
 * Also generates journal text and referral text.
 */

/**
 * Build complete treatment plan from CQL output and DMN CDK4/6 result.
 */
export function buildTreatmentPlan(cqlOutput, cdk46Result) {
  const { bioGroup, isNeoadjuvant } = cqlOutput;

  if (isNeoadjuvant) {
    return buildNeoadjuvantPlan(cqlOutput);
  }

  switch (bioGroup) {
    case 'HR+HER2-':
      return buildHRposHER2negPlan(cqlOutput, cdk46Result);
    case 'HR+HER2+':
      return buildHRposHER2posPlan(cqlOutput);
    case 'HR-HER2+':
      return buildHRnegHER2posPlan(cqlOutput);
    case 'TN':
      return buildTripleNegativePlan(cqlOutput);
    default:
      return {
        steps: [],
        warnings: ['Biologisk undergruppe ikke bestemt — kan ikke gi behandlingsanbefaling'],
        bioGroup: bioGroup || 'unknown',
      };
  }
}

// ============================================================
// HR+HER2- Adjuvant
// ============================================================

function buildHRposHER2negPlan(cql, cdk46Result) {
  const steps = [];
  const warnings = [];

  // Step 1: Chemotherapy
  if (cql.chemoPathway) {
    const cp = cql.chemoPathway;
    if (cp.pathway === 'EC') {
      steps.push({ type: 'chemo', name: 'EC ×4', detail: 'Epirubicin/Cyklofosfamid 4 kurer', rationale: cp.rationale });
    } else if (cp.pathway === 'EC_taxan') {
      steps.push({ type: 'chemo', name: 'EC ×4 + Taxan', detail: 'Epirubicin/Cyklofosfamid 4 kurer, deretter taxan (docetaxel/paklitaxel)', rationale: cp.rationale });
    } else if (cp.pathway === 'gene_test_needed') {
      warnings.push('Genekspresjonstest anbefales for å avklare kjemoterapibehov');
    } else if (cp.pathway === 'consider_chemo') {
      warnings.push(cp.rationale);
    }
    // pathway === 'none': no chemo step added
  }

  // Step 2: Endocrine therapy
  if (cql.endocrineTherapy) {
    steps.push({
      type: 'endocrine',
      name: formatEndocrineName(cql.endocrineTherapy),
      detail: cql.endocrineTherapy.detail,
      duration: cql.endocrineTherapy.duration,
    });
  }

  // Step 3: CDK4/6 inhibitor (from DMN result)
  if (cdk46Result && cdk46Result.matched && cdk46Result.result) {
    const r = cdk46Result.result;
    const cdk46Steps = formatCDK46Recommendation(r, cql);
    steps.push(...cdk46Steps);
    if (r.warnings) warnings.push(...r.warnings);
  }

  // Step 4: Radiation
  if (cql.radiation && cql.radiation.recommended) {
    steps.push({
      type: 'radiation',
      name: 'Strålebehandling',
      detail: cql.radiation.detail,
    });
  }

  // Step 5: Bisphosphonate
  if (cql.zometa && cql.zometa.eligible) {
    steps.push({
      type: 'bisphosphonate',
      name: 'Zoledronsyre (Zometa)',
      detail: 'Zoledronsyre 4mg iv × 6 (hver 6. måned i 3 år)',
      rationale: cql.zometa.rationale,
    });
  }

  return {
    bioGroup: 'HR+HER2-',
    steps,
    warnings,
    chemoPathway: cql.chemoPathway,
    luminalSubtype: cql.luminalSubtype,
  };
}

function formatCDK46Recommendation(dmnOutput, cql) {
  const steps = [];
  const grade = cql.grade;
  const gesHigh = cql.gesHighRisk;

  // Resolve conditional recommendations
  const abema = resolveCDK46Conditional(dmnOutput.abemaciclib, grade, gesHigh, cql.tumorSizeMm);
  const ribo = resolveCDK46Conditional(dmnOutput.ribociclib, grade, gesHigh, cql.tumorSizeMm);

  if (abema === 'yes' || abema === 'first_choice') {
    steps.push({
      type: 'cdk46',
      name: 'Abemaciclib (Verzenios)',
      detail: abema === 'first_choice'
        ? 'Abemaciclib 150mg ×2 daglig i 2 år — FØRSTEVALG (MonarchE)'
        : 'Abemaciclib 150mg ×2 daglig i 2 år (MonarchE)',
      priority: abema === 'first_choice' ? 1 : 2,
    });
  }

  if (ribo === 'yes') {
    steps.push({
      type: 'cdk46',
      name: 'Ribociclib (Kisqali)',
      detail: 'Ribociclib 400mg daglig i 3 år (NATALEE)',
      priority: abema === 'first_choice' ? 2 : 1,
    });
  }

  return steps;
}

function resolveCDK46Conditional(value, grade, gesHigh, tumorSizeMm) {
  if (value === 'yes' || value === 'first_choice') return value;
  if (value === 'no') return 'no';

  if (value === 'if_G3') {
    return grade === 3 ? 'yes' : 'no';
  }
  if (value === 'if_G3_or_gesHigh') {
    if (grade === 3 || gesHigh === true) return 'yes';
    return 'no';
  }
  return 'no';
}

function formatEndocrineName(endo) {
  if (!endo) return 'Endokrinterapi';
  switch (endo.therapy) {
    case 'aromatasehemmer': return 'Aromatasehemmer (AI)';
    case 'tamoxifen_ofs': return 'Tamoxifen + OFS';
    case 'tamoxifen': return 'Tamoxifen';
    default: return 'Endokrinterapi';
  }
}

// ============================================================
// HR+HER2+ Adjuvant
// ============================================================

function buildHRposHER2posPlan(cql) {
  const steps = [];
  const warnings = [];
  const { tSimple, nStage, stadium } = cql;

  // Chemo + anti-HER2 based on staging
  if (tSimple === 'T1' && nStage === 'N0' && cql.tumorSizeMm != null && cql.tumorSizeMm <= 20) {
    // Small T1 N0: Weekly paclitaxel + trastuzumab (APT-regimen)
    steps.push({
      type: 'chemo',
      name: 'Paklitaxel ukentlig ×12 + Trastuzumab',
      detail: 'APT-regimet: Paklitaxel 80mg/m² ukentlig × 12, trastuzumab q3w × 1 år',
      rationale: 'Lav risiko HR+HER2+: APT-regimet tilstrekkelig',
    });
  } else if (nStage === 'N0') {
    // Larger N0: TC-HP
    steps.push({
      type: 'chemo',
      name: 'TC ×4 + HP',
      detail: 'Docetaxel/Cyklofosfamid × 4 + trastuzumab/pertuzumab q3w × 1 år',
      rationale: 'HR+HER2+ N0 med større tumor',
    });
  } else {
    // Node-positive: EC + taxan + HP
    steps.push({
      type: 'chemo',
      name: 'EC ×4 → Taxan + HP',
      detail: 'EC × 4, deretter taxan + trastuzumab/pertuzumab. HP totalt 1 år',
      rationale: 'Lymfeknutepositiv HR+HER2+: Full kjemoterapi + dobbel HER2-blokade',
    });
    warnings.push('Pertuzumab tillegg ved nodepositive pasienter');
  }

  // Endocrine therapy (HR+)
  if (cql.endocrineTherapy) {
    steps.push({
      type: 'endocrine',
      name: formatEndocrineName(cql.endocrineTherapy),
      detail: cql.endocrineTherapy.detail,
      duration: cql.endocrineTherapy.duration,
    });
  }

  // Radiation
  if (cql.radiation && cql.radiation.recommended) {
    steps.push({ type: 'radiation', name: 'Strålebehandling', detail: cql.radiation.detail });
  }

  // Zometa
  if (cql.zometa && cql.zometa.eligible) {
    steps.push({ type: 'bisphosphonate', name: 'Zoledronsyre', detail: 'Zoledronsyre 4mg iv × 6' });
  }

  return { bioGroup: 'HR+HER2+', steps, warnings };
}

// ============================================================
// HR-HER2+ Adjuvant
// ============================================================

function buildHRnegHER2posPlan(cql) {
  const steps = [];
  const warnings = [];

  if (cql.tSimple === 'T1' && cql.nStage === 'N0' && cql.tumorSizeMm != null && cql.tumorSizeMm <= 20) {
    steps.push({
      type: 'chemo',
      name: 'Paklitaxel ukentlig ×12 + Trastuzumab',
      detail: 'APT-regimet: Paklitaxel 80mg/m² ukentlig × 12, trastuzumab q3w × 1 år',
    });
  } else if (cql.nStage === 'N0') {
    steps.push({
      type: 'chemo',
      name: 'TC ×4 + Trastuzumab',
      detail: 'Docetaxel/Cyklofosfamid × 4 + trastuzumab q3w × 1 år',
    });
  } else {
    steps.push({
      type: 'chemo',
      name: 'EC ×4 → Taxan + HP',
      detail: 'EC × 4, deretter taxan + trastuzumab/pertuzumab q3w. HP totalt 1 år',
    });
    warnings.push('Pertuzumab tillegg ved nodepositive HR-HER2+');
  }

  if (cql.radiation && cql.radiation.recommended) {
    steps.push({ type: 'radiation', name: 'Strålebehandling', detail: cql.radiation.detail });
  }

  return { bioGroup: 'HR-HER2+', steps, warnings };
}

// ============================================================
// Triple Negative Adjuvant
// ============================================================

function buildTripleNegativePlan(cql) {
  const steps = [];
  const warnings = [];

  if (cql.tSimple === 'T1' && cql.nStage === 'N0' && cql.tumorSizeMm != null && cql.tumorSizeMm <= 10) {
    // Very small TN: May not need chemo
    steps.push({
      type: 'chemo',
      name: 'Vurder kjemoterapi',
      detail: 'Liten trippel negativ tumor (≤10mm N0): Individuell vurdering av kjemoterapi',
    });
    warnings.push('Liten TN tumor — kjemoterapi kan vurderes individuelt');
  } else if (cql.nStage === 'N0') {
    steps.push({
      type: 'chemo',
      name: 'EC ×4 + Taxan',
      detail: 'Epirubicin/Cyklofosfamid × 4, deretter docetaxel/paklitaxel',
      rationale: 'Trippel negativ N0: Standard kjemoterapi',
    });
  } else {
    steps.push({
      type: 'chemo',
      name: 'EC ×4 + Taxan ± Karboplatin',
      detail: 'EC × 4, deretter taxan ± karboplatin. Vurder pembrolizumab ved stadium II-III',
      rationale: 'Nodepositiv TN: Intensivert kjemoterapi',
    });
    warnings.push('Vurder pembrolizumab (Keytruda) ved stadium II-III TN (KEYNOTE-522)');
  }

  if (cql.radiation && cql.radiation.recommended) {
    steps.push({ type: 'radiation', name: 'Strålebehandling', detail: cql.radiation.detail });
  }

  return { bioGroup: 'TN', steps, warnings };
}

// ============================================================
// Neoadjuvant
// ============================================================

function buildNeoadjuvantPlan(cql) {
  const steps = [];
  const warnings = [];
  const { bioGroup } = cql;

  warnings.push('Neoadjuvant behandling — henvisning til MDT/onkolog');

  switch (bioGroup) {
    case 'HR+HER2-':
      steps.push({
        type: 'chemo',
        name: 'EC ×4 → Taxan (neoadjuvant)',
        detail: 'Neoadjuvant kjemoterapi: EC × 4, deretter taxan × 12 uker',
      });
      steps.push({
        type: 'endocrine',
        name: 'Endokrinterapi postoperativt',
        detail: 'Endokrinterapi etter kirurgi basert på menopausal status',
      });
      break;
    case 'HR+HER2+':
      steps.push({
        type: 'chemo',
        name: 'EC ×4 → Taxan + HP (neoadjuvant)',
        detail: 'Neoadjuvant: EC × 4, deretter taxan + trastuzumab + pertuzumab',
      });
      break;
    case 'HR-HER2+':
      steps.push({
        type: 'chemo',
        name: 'EC ×4 → Taxan + HP (neoadjuvant)',
        detail: 'Neoadjuvant: EC × 4, deretter taxan + trastuzumab + pertuzumab',
      });
      break;
    case 'TN':
      steps.push({
        type: 'chemo',
        name: 'Pembrolizumab + Karboplatin/Taxan → EC (neoadjuvant)',
        detail: 'KEYNOTE-522: Pembrolizumab + karboplatin + paklitaxel × 12 uker, deretter pembrolizumab + EC × 4',
      });
      warnings.push('Immunterapi (pembrolizumab) ved TN stadium II-III');
      break;
    default:
      warnings.push('Biologisk undergruppe må avklares før neoadjuvant behandling');
  }

  return { bioGroup, steps, warnings, isNeoadjuvant: true };
}

// ============================================================
// Journal Text Generation
// ============================================================

/**
 * Generate journal text (Norwegian clinical format) from treatment plan.
 */
export function buildJournalText(cqlOutput, treatmentPlan) {
  const lines = [];

  lines.push('ADJUVANT BEHANDLINGSPLAN — BRYSTKREFT');
  lines.push('');

  // Patient/tumor characteristics
  lines.push(`Biologisk undergruppe: ${treatmentPlan.bioGroup}`);
  if (cqlOutput.tStage) lines.push(`T-stadium: ${cqlOutput.tStage}`);
  if (cqlOutput.nStage) lines.push(`N-stadium: ${cqlOutput.nStage}`);
  if (cqlOutput.stadium) lines.push(`Stadium: ${cqlOutput.stadium}`);
  if (cqlOutput.grade) lines.push(`Grad: ${cqlOutput.grade}`);
  if (cqlOutput.ki67Value != null) lines.push(`Ki-67: ${cqlOutput.ki67Value}%`);
  if (cqlOutput.her2ihc) lines.push(`HER2 IHC: ${cqlOutput.her2ihc}`);
  if (cqlOutput.her2sish) lines.push(`HER2 SISH: ${cqlOutput.her2sish}`);
  if (cqlOutput.luminalSubtype) lines.push(`Luminal subtype: ${cqlOutput.luminalSubtype}`);
  if (cqlOutput.geneTest && cqlOutput.geneTestDone) {
    lines.push(`Genekspresjonstest: ${cqlOutput.geneTest}`);
    if (cqlOutput.rorScore != null) lines.push(`  ROR-score: ${cqlOutput.rorScore}`);
    if (cqlOutput.rsScore != null) lines.push(`  RS-score: ${cqlOutput.rsScore}`);
  }

  lines.push('');
  lines.push('BEHANDLINGSTRINN:');

  for (let i = 0; i < treatmentPlan.steps.length; i++) {
    const step = treatmentPlan.steps[i];
    lines.push(`${i + 1}. ${step.name}`);
    if (step.detail) lines.push(`   ${step.detail}`);
    if (step.duration) lines.push(`   Varighet: ${step.duration}`);
  }

  if (treatmentPlan.warnings.length > 0) {
    lines.push('');
    lines.push('MERKNADER:');
    for (const w of treatmentPlan.warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate referral text for neoadjuvant patients.
 */
export function buildReferralText(cqlOutput) {
  const lines = [];
  lines.push('HENVISNING — NEOADJUVANT BRYSTKREFTBEHANDLING');
  lines.push('');
  lines.push(`Biologisk undergruppe: ${cqlOutput.bioGroup}`);
  if (cqlOutput.tStage) lines.push(`Klinisk T-stadium: ${cqlOutput.tStage}`);
  if (cqlOutput.nStage) lines.push(`Klinisk N-stadium: ${cqlOutput.nStage}`);
  if (cqlOutput.stadium) lines.push(`Stadium: ${cqlOutput.stadium}`);
  if (cqlOutput.grade) lines.push(`Grad: ${cqlOutput.grade}`);
  if (cqlOutput.her2ihc) lines.push(`HER2 IHC: ${cqlOutput.her2ihc}`);
  if (cqlOutput.ki67Value != null) lines.push(`Ki-67: ${cqlOutput.ki67Value}%`);
  lines.push('');
  lines.push('Pasienten henvises for vurdering av neoadjuvant behandling.');
  lines.push('Ber om diskusjon i MDT (multidisiplinært team).');
  return lines.join('\n');
}

export default { buildTreatmentPlan, buildJournalText, buildReferralText };
