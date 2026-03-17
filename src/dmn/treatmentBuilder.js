/**
 * Behandlingsplanbygger — Sammenstiller behandlingsplaner fra DMN-tabellresultat.
 *
 * Alle kliniske beslutninger kommer nå fra DMN-tabeller (transparente, redigerbare).
 * Denne modulen sammenstiller kun resultatene til en strukturert behandlingsplan.
 */

import { evaluateDecisionTable } from './dmnEngine.js';
import { getThresholdValue } from '../cql/clinicalThresholds.js';
import {
  HER2_DETERMINATION_TABLE,
  CHEMO_PATHWAY_TABLE,
  CDK46_DECISION_TABLE,
  ENDOCRINE_THERAPY_TABLE,
  ZOMETA_TABLE,
  RADIATION_TABLE,
  HRPOS_HER2POS_TABLE,
  HRNEG_HER2POS_TABLE,
  TN_TABLE,
  NEOADJUVANT_TABLE,
  POST_NEOADJUVANT_TABLE,
  BRCA_OLAPARIB_TABLE,
  NEAR_CUTOFF_TABLE,
} from './decisionTables.js';

/**
 * Bygg komplett behandlingsplan med DMN-tabeller for ALLE beslutninger.
 * Returnerer behandlingsplan + alle DMN-evalueringsresultat for transparens.
 */
export function buildTreatmentPlan(cqlOutput, customTables = {}) {
  const tables = {
    her2: customTables['her2-determination'] || HER2_DETERMINATION_TABLE,
    chemo: customTables['chemo-pathway-hrpos-her2neg'] || CHEMO_PATHWAY_TABLE,
    cdk46: customTables['cdk46-adjuvant-selection'] || CDK46_DECISION_TABLE,
    endocrine: customTables['endocrine-therapy-selection'] || ENDOCRINE_THERAPY_TABLE,
    zometa: customTables['zometa-eligibility'] || ZOMETA_TABLE,
    radiation: customTables['radiation-therapy'] || RADIATION_TABLE,
    hrposHer2pos: customTables['hrpos-her2pos-adjuvant'] || HRPOS_HER2POS_TABLE,
    hrnegHer2pos: customTables['hrneg-her2pos-adjuvant'] || HRNEG_HER2POS_TABLE,
    tn: customTables['tn-adjuvant'] || TN_TABLE,
    neoadjuvant: customTables['neoadjuvant-treatment'] || NEOADJUVANT_TABLE,
    postNeoadjuvant: customTables['post-neoadjuvant-treatment'] || POST_NEOADJUVANT_TABLE,
    brcaOlaparib: customTables['brca-olaparib-eligibility'] || BRCA_OLAPARIB_TABLE,
    nearCutoff: customTables['near-cutoff-warnings'] || NEAR_CUTOFF_TABLE,
  };

  const dmnResults = {};
  const steps = [];
  const warnings = [];
  const { bioGroup, isNeoadjuvant, isPostNeoadjuvant } = cqlOutput;

  // 0. ER lav-positiv varsel
  if (cqlOutput.erLowPositive) {
    warnings.push(`ER lav-positiv (${cqlOutput.erPercent}%): ER 1-10% regnes klinisk som ER-negativ. Behandlingsvalg er tilpasset deretter.`);
  }

  // 0b. Fertilitetsrådgivning for pasienter i fertil alder
  const fertilityAge = getThresholdValue('fertilityWarningAge');
  if (cqlOutput.age != null && cqlOutput.age <= fertilityAge && (cqlOutput.menopausalStatus === 'pre' || cqlOutput.menopausalStatus === 'peri')) {
    warnings.push(`Fertilitet: Pasienten er ${cqlOutput.age} år (≤${fertilityAge}). Fertilitetsrådgivning og evt. fertilitetsbevarende tiltak bør tilbys FØR oppstart av gonadotoksisk behandling (NBCG kap. 10.1).`);
  }

  // 1. HER2-bestemmelse (for transparens)
  dmnResults.her2 = evaluateDecisionTable(tables.her2, cqlOutput);

  // 2. Grenseverdivarsler (COLLECT — flere kan utløses)
  dmnResults.nearCutoff = evaluateDecisionTable(tables.nearCutoff, cqlOutput);
  if (dmnResults.nearCutoff.matched) {
    const cutoffResults = Array.isArray(dmnResults.nearCutoff.result)
      ? dmnResults.nearCutoff.result
      : [dmnResults.nearCutoff.result];
    for (const r of cutoffResults) {
      warnings.push(`⚠ ${r.parameter}: ${r.warning}`);
    }
  }

  // 3. Neoadjuvant behandlingsvei
  if (isNeoadjuvant) {
    dmnResults.neoadjuvant = evaluateDecisionTable(tables.neoadjuvant, cqlOutput);
    if (dmnResults.neoadjuvant.matched && dmnResults.neoadjuvant.result) {
      const r = dmnResults.neoadjuvant.result;
      steps.push({ type: 'chemo', name: r.regimen, detail: r.detail, rationale: r.rationale });
      if (r.warnings) warnings.push(...r.warnings);
    }

    // Markørbestilling ved planlagt brystbevarende kirurgi (BCS)
    if (cqlOutput.surgeryType === 'bcs') {
      warnings.push('Planlagt BCS: Bestill markør/klips i tumorseng før oppstart neoadjuvant behandling for å sikre identifikasjon av tumorområdet ved operasjon.');
    }

    // Endokrin for HR+ neoadjuvant
    if (cqlOutput.hrPositive) {
      dmnResults.endocrine = evaluateDecisionTable(tables.endocrine, cqlOutput);
      if (dmnResults.endocrine.matched && dmnResults.endocrine.result?.therapy !== 'ingen') {
        steps.push({ type: 'endocrine', name: 'Endokrinterapi postoperativt', detail: dmnResults.endocrine.result.detail, duration: dmnResults.endocrine.result.duration });
      }
    }

    return { bioGroup, steps, warnings, isNeoadjuvant: true, dmnResults };
  }

  // 3b. Post-neoadjuvant behandlingsvei (pCR-baserte beslutninger)
  if (isPostNeoadjuvant) {
    dmnResults.postNeoadjuvant = evaluateDecisionTable(tables.postNeoadjuvant, cqlOutput);
    if (dmnResults.postNeoadjuvant.matched && dmnResults.postNeoadjuvant.result) {
      const r = dmnResults.postNeoadjuvant.result;
      if (r.regimen && r.regimen !== '-') {
        steps.push({ type: 'chemo', name: r.regimen, detail: r.detail, rationale: r.rationale });
      }
      if (r.warnings) warnings.push(...r.warnings);
    }

    // BRCA/olaparib-evaluering
    dmnResults.brcaOlaparib = evaluateDecisionTable(tables.brcaOlaparib, cqlOutput);
    if (dmnResults.brcaOlaparib.matched && dmnResults.brcaOlaparib.result) {
      const r = dmnResults.brcaOlaparib.result;
      if (r.recommendation && !r.recommendation.includes('Ingen')) {
        // Unngå duplisering av olaparib hvis allerede i post-neo-planen
        const hasOlaparib = steps.some((s) => s.name?.toLowerCase().includes('olaparib'));
        if (!hasOlaparib && r.recommendation.includes('laparib')) {
          // Allerede håndtert av post-neoadjuvant-tabellen
        } else if (!hasOlaparib) {
          steps.push({ type: 'targeted', name: r.recommendation, detail: r.detail, rationale: r.rationale });
        }
        if (r.warnings) warnings.push(...r.warnings);
      }
    }

    // Endokrin for HR+
    if (cqlOutput.hrPositive) {
      dmnResults.endocrine = evaluateDecisionTable(tables.endocrine, cqlOutput);
      if (dmnResults.endocrine.matched && dmnResults.endocrine.result?.therapy !== 'ingen') {
        const r = dmnResults.endocrine.result;
        const hasEndocrine = steps.some((s) => s.type === 'endocrine');
        if (!hasEndocrine) {
          steps.push({ type: 'endocrine', name: 'Endokrinterapi', detail: r.detail, duration: r.duration, rationale: r.rationale });
        }
      }
    }

    // Strålebehandling
    dmnResults.radiation = evaluateDecisionTable(tables.radiation, cqlOutput);
    if (dmnResults.radiation.matched && dmnResults.radiation.result?.recommended === true) {
      steps.push({ type: 'radiation', name: 'Strålebehandling', detail: dmnResults.radiation.result.detail, rationale: dmnResults.radiation.result.rationale });
    }

    return { bioGroup, steps, warnings, isPostNeoadjuvant: true, dmnResults };
  }

  // 4. Adjuvant behandlingsvei — biogruppebasert
  switch (bioGroup) {
    case 'HR+HER2-':
      buildHRposHER2neg(cqlOutput, tables, dmnResults, steps, warnings);
      break;
    case 'HR+HER2+':
      buildHRposHER2pos(cqlOutput, tables, dmnResults, steps, warnings);
      break;
    case 'HR-HER2+':
      buildHRnegHER2pos(cqlOutput, tables, dmnResults, steps, warnings);
      break;
    case 'TN':
      buildTN(cqlOutput, tables, dmnResults, steps, warnings);
      break;
    default:
      warnings.push('Biologisk undergruppe ikke bestemt');
  }

  // 4b. BRCA / Olaparib-evaluering (alle adjuvante biogrupper)
  dmnResults.brcaOlaparib = evaluateDecisionTable(tables.brcaOlaparib, cqlOutput);
  if (dmnResults.brcaOlaparib.matched && dmnResults.brcaOlaparib.result) {
    const r = dmnResults.brcaOlaparib.result;
    if (r.recommendation && r.recommendation.includes('laparib') && r.recommendation.includes('300mg')) {
      steps.push({ type: 'targeted', name: 'Olaparib (Lynparza)', detail: r.detail, rationale: r.rationale });
    }
    if (r.recommendation && r.recommendation.includes('testing')) {
      warnings.push(`BRCA: ${r.recommendation} — ${r.detail}`);
    }
    if (r.warnings && r.warnings.length > 0) warnings.push(...r.warnings);
  }

  // 5. Strålebehandling (alle adjuvante)
  dmnResults.radiation = evaluateDecisionTable(tables.radiation, cqlOutput);
  if (dmnResults.radiation.matched && dmnResults.radiation.result?.recommended === true) {
    steps.push({ type: 'radiation', name: 'Strålebehandling', detail: dmnResults.radiation.result.detail, rationale: dmnResults.radiation.result.rationale });
  }

  // 6. Zometa
  dmnResults.zometa = evaluateDecisionTable(tables.zometa, cqlOutput);
  if (dmnResults.zometa.matched && dmnResults.zometa.result?.eligible === true) {
    steps.push({ type: 'bisphosphonate', name: 'Zoledronsyre (Zometa)', detail: dmnResults.zometa.result.regimen, rationale: dmnResults.zometa.result.rationale });
  }

  // 7. Evaluer egendefinerte tabeller som ikke er i standardsettet
  const standardIds = new Set(Object.values(tables).map((t) => t.id));
  for (const [id, table] of Object.entries(customTables)) {
    if (!standardIds.has(id)) {
      const result = evaluateDecisionTable(table, cqlOutput);
      dmnResults[id] = result;
      if (result.matched && result.result) {
        const r = Array.isArray(result.result) ? result.result : [result.result];
        for (const out of r) {
          if (out.regimen || out.recommendation) {
            steps.push({ type: out.type || 'custom', name: out.regimen || out.recommendation, detail: out.detail || out.rationale || '', rationale: out.rationale || '' });
          }
          if (out.warning) warnings.push(out.warning);
        }
      }
    }
  }

  return {
    bioGroup,
    steps,
    warnings,
    dmnResults,
    luminalSubtype: cqlOutput.luminalSubtype,
    chemoPathway: dmnResults.chemo?.result?.pathway || null,
  };
}

// ============================================================
// Biogruppebasert sammenstilling (bruker DMN-resultat)
// ============================================================

function buildHRposHER2neg(cql, tables, dmnResults, steps, warnings) {
  // Kjemoterapivalg fra DMN
  dmnResults.chemo = evaluateDecisionTable(tables.chemo, cql);
  if (dmnResults.chemo.matched && dmnResults.chemo.result) {
    const r = dmnResults.chemo.result;
    if (r.pathway === 'EC' || r.pathway === 'EC_taxan') {
      steps.push({ type: 'chemo', name: r.regimen, detail: r.regimen, rationale: r.rationale });
    } else if (r.pathway === 'gene_test_needed') {
      warnings.push(r.rationale);
    } else if (r.pathway === 'consider_chemo') {
      warnings.push(r.rationale);
    }
  }

  // Endokrinterapi
  dmnResults.endocrine = evaluateDecisionTable(tables.endocrine, cql);
  if (dmnResults.endocrine.matched && dmnResults.endocrine.result?.therapy !== 'ingen') {
    const r = dmnResults.endocrine.result;
    const nameMap = { aromatasehemmer: 'Aromatasehemmer (AI)', ai_ofs: 'OFS + AI (foretrukket)', tamoxifen_ofs: 'OFS + Tamoxifen', tamoxifen: 'Tamoxifen' };
    steps.push({ type: 'endocrine', name: nameMap[r.therapy] || r.therapy, detail: r.detail, duration: r.duration, rationale: r.rationale });
  }

  // CDK4/6
  dmnResults.cdk46 = evaluateDecisionTable(tables.cdk46, cql);
  if (dmnResults.cdk46.matched && dmnResults.cdk46.result) {
    const r = dmnResults.cdk46.result;
    const abema = resolveCDK46(r.abemaciclib, cql.grade, cql.gesHighRisk, cql.gesLowRisk, cql.tumorSizeMm, cql.ki67Value);
    const ribo = resolveCDK46(r.ribociclib, cql.grade, cql.gesHighRisk, cql.gesLowRisk, cql.tumorSizeMm, cql.ki67Value);

    if (abema === 'yes' || abema === 'first_choice') {
      steps.push({ type: 'cdk46', name: 'Abemaciclib (Verzenios)', detail: abema === 'first_choice' ? 'Abemaciclib 150mg ×2 daglig i 2 år — FØRSTEVALG (MonarchE)' : 'Abemaciclib 150mg ×2 daglig i 2 år (MonarchE)', priority: abema === 'first_choice' ? 1 : 2 });
    }
    if (ribo === 'yes') {
      steps.push({ type: 'cdk46', name: 'Ribociclib (Kisqali)', detail: 'Ribociclib 400mg daglig i 3 år (NATALEE)', priority: abema === 'first_choice' ? 2 : 1 });
    }
    if (r.warnings) warnings.push(...r.warnings);
  }
}

function buildHRposHER2pos(cql, tables, dmnResults, steps, warnings) {
  dmnResults.hrposHer2pos = evaluateDecisionTable(tables.hrposHer2pos, cql);
  if (dmnResults.hrposHer2pos.matched && dmnResults.hrposHer2pos.result) {
    const r = dmnResults.hrposHer2pos.result;
    steps.push({ type: 'chemo', name: r.regimen, detail: r.detail, rationale: r.rationale });
  }

  // Endokrinterapi (HR+)
  dmnResults.endocrine = evaluateDecisionTable(tables.endocrine, cql);
  if (dmnResults.endocrine.matched && dmnResults.endocrine.result?.therapy !== 'ingen') {
    const r = dmnResults.endocrine.result;
    steps.push({ type: 'endocrine', name: r.detail, detail: r.detail, duration: r.duration });
  }
}

function buildHRnegHER2pos(cql, tables, dmnResults, steps, warnings) {
  dmnResults.hrnegHer2pos = evaluateDecisionTable(tables.hrnegHer2pos, cql);
  if (dmnResults.hrnegHer2pos.matched && dmnResults.hrnegHer2pos.result) {
    const r = dmnResults.hrnegHer2pos.result;
    steps.push({ type: 'chemo', name: r.regimen, detail: r.detail, rationale: r.rationale });
  }
}

function buildTN(cql, tables, dmnResults, steps, warnings) {
  dmnResults.tn = evaluateDecisionTable(tables.tn, cql);
  if (dmnResults.tn.matched && dmnResults.tn.result) {
    const r = dmnResults.tn.result;
    steps.push({ type: 'chemo', name: r.regimen, detail: r.detail, rationale: r.rationale });
    if (r.warnings) warnings.push(...r.warnings);
  }
}

function resolveCDK46(value, grade, gesHigh, gesLow, tumorSizeMm, ki67Value) {
  if (value === 'yes' || value === 'first_choice') return value;
  if (value === 'no') return 'no';
  if (value === 'if_G3') return grade === 3 ? 'yes' : 'no';
  if (value === 'if_G3_or_gesHigh') return (grade === 3 || gesHigh === true) ? 'yes' : 'no';
  if (value === 'if_G3_or_5cm') return (grade === 3 || (tumorSizeMm != null && tumorSizeMm >= 50)) ? 'first_choice' : 'no';
  // MonarchE criteria: N1 + at least one of G3, Ki-67 ≥20%, tumor ≥5cm (NBCG 04.09.25)
  if (value === 'if_monarchE') return (grade === 3 || (ki67Value != null && ki67Value >= 20) || (tumorSizeMm != null && tumorSizeMm >= 50)) ? 'first_choice' : 'no';
  if (value === 'yes_unless_low') return (grade === 1 || gesLow === true) ? 'no' : 'yes';
  return 'no';
}

// ============================================================
// Tekstgenerering
// ============================================================

export function buildJournalText(cqlOutput, treatmentPlan) {
  const lines = [];
  lines.push(cqlOutput.isNeoadjuvant ? 'NEOADJUVANT BEHANDLINGSPLAN — BRYSTKREFT' : 'ADJUVANT BEHANDLINGSPLAN — BRYSTKREFT');
  lines.push('');
  lines.push(`Biologisk undergruppe: ${treatmentPlan.bioGroup}`);
  if (cqlOutput.tStage) lines.push(`T-stadium: ${cqlOutput.tStage}`);
  if (cqlOutput.nStage) lines.push(`N-stadium: ${cqlOutput.nStage}`);
  if (cqlOutput.stadium) lines.push(`Stadium: ${cqlOutput.stadium}`);
  if (cqlOutput.grade) lines.push(`Grad: ${cqlOutput.grade}`);
  if (cqlOutput.ki67Value != null) lines.push(`Ki-67: ${cqlOutput.ki67Value}%`);
  if (cqlOutput.her2ihc) lines.push(`HER2 IHC: ${cqlOutput.her2ihc}`);
  if (cqlOutput.her2sish) lines.push(`HER2 SISH: ${cqlOutput.her2sish}`);
  if (cqlOutput.luminalSubtype) lines.push(`Luminal subtype: ${cqlOutput.luminalSubtype}`);
  if (cqlOutput.geneTestDone) {
    lines.push(`Genekspresjonstest: ${cqlOutput.geneTest}`);
    if (cqlOutput.rorScore != null) lines.push(`  ROR-score: ${cqlOutput.rorScore}`);
    if (cqlOutput.rsScore != null) lines.push(`  RS-score: ${cqlOutput.rsScore}`);
  }

  lines.push('');
  lines.push('BEHANDLINGSTRINN:');
  for (let i = 0; i < treatmentPlan.steps.length; i++) {
    const step = treatmentPlan.steps[i];
    lines.push(`${i + 1}. ${step.name}`);
    if (step.detail && step.detail !== step.name) lines.push(`   ${step.detail}`);
    if (step.duration) lines.push(`   Varighet: ${step.duration}`);
  }

  if (treatmentPlan.warnings.length > 0) {
    lines.push('');
    lines.push('MERKNADER:');
    for (const w of treatmentPlan.warnings) lines.push(`- ${w}`);
  }

  return lines.join('\n');
}

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
