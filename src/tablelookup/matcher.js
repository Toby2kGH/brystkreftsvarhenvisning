// ============================================================
//  Tabelloppslag — matchelogikk
// ============================================================
//
//  Avgjør hvilken rad i en anbefalingstabell pasientens input
//  hører hjemme i. Dette er IKKE en beslutningsmotor som velger
//  behandling — den slår kun opp riktig rad i de offisielle
//  tabellene slik at klinikeren kan highlighte og kopiere tekst.
//
//  Matchingen er bevisst transparent: hvert kriterium er en enkel
//  sammenligning, og en rad treffer kun hvis ALLE oppgitte
//  kriterier er oppfylt. Felt som ikke er fylt ut i input regnes
//  som «ukjent» og hindrer ikke treff på det kriteriet.
// ============================================================

// Sjekker ett sett kriterier (uten anyOf) mot input.
function matchesCriteriaBlock(crit, input) {
  if (crit.bioGroup && input.bioGroup && crit.bioGroup !== input.bioGroup) return false;
  if (crit.menopausal && input.menopausal && crit.menopausal !== input.menopausal) return false;
  if (crit.geneTest && input.geneTest && crit.geneTest !== input.geneTest) return false;
  if (crit.prosignaSubtype && input.prosignaSubtype && crit.prosignaSubtype !== input.prosignaSubtype) return false;
  if (crit.luminalLike && input.luminalLike && crit.luminalLike !== input.luminalLike) return false;

  if (crit.tStage && input.tStage && !crit.tStage.includes(input.tStage)) return false;
  if (crit.tSimple && input.tSimple && !crit.tSimple.includes(input.tSimple)) return false;
  if (crit.nStage && input.nStage && !crit.nStage.includes(input.nStage)) return false;
  if (crit.grade && input.grade != null && input.grade !== '' && !crit.grade.includes(Number(input.grade))) return false;

  if (crit.rorMin != null && input.rorScore !== '' && input.rorScore != null && Number(input.rorScore) < crit.rorMin) return false;
  if (crit.rorMax != null && input.rorScore !== '' && input.rorScore != null && Number(input.rorScore) > crit.rorMax) return false;
  if (crit.rsMin != null && input.rsScore !== '' && input.rsScore != null && Number(input.rsScore) < crit.rsMin) return false;
  if (crit.rsMax != null && input.rsScore !== '' && input.rsScore != null && Number(input.rsScore) > crit.rsMax) return false;

  return true;
}

// Full matching av en rad, inkludert evt. anyOf-alternativer.
export function rowMatches(crit, input) {
  if (!matchesCriteriaBlock(crit, input)) return false;
  if (crit.anyOf && crit.anyOf.length > 0) {
    return crit.anyOf.some((sub) => matchesCriteriaBlock(sub, input));
  }
  return true;
}

// Returnerer en liste med indekser for radene i `table.rows` som treffer.
export function findMatchingRows(table, input) {
  const matched = [];
  table.rows.forEach((row, i) => {
    if (rowMatches(row.crit, input)) matched.push(i);
  });
  return matched;
}

// Avleder forenklet T-kategori (T0–T4) fra detaljert pT-stadium.
// Brukes av tabeller som indekseres på TNM (f.eks. CDK4/6-tabellen).
export function simplifyT(tStage) {
  if (!tStage) return '';
  if (tStage === 'T0' || tStage === 'pT0') return 'T0';
  if (tStage.startsWith('pT1') || tStage === 'T1') return 'T1';
  if (tStage === 'pT2' || tStage === 'T2') return 'T2';
  if (tStage === 'pT3' || tStage === 'T3') return 'T3';
  if (tStage === 'pT4' || tStage === 'T4') return 'T4';
  return '';
}

// ----------------------------------------------------------------
//  Luminal-liknende klassifisering (kun for tabellen UTEN gentest).
//  Følger karakteristikaene i PDF-en ordrett:
//   - Lum A-liknende:  Ki67<10%, G1-2, HR>50%
//   - LumB-liknende:   1) Ki67>35%  ELLER
//                      2) Grad 3 og samsvarende høy Ki67  ELLER
//                      3) HR<50%
//   - Ellers «Ikke konklusiv» (bl.a. Ki67 10–35% uten andre B-kriterier),
//     jf. «Ki67 verdier mellom 10% og 35% bør ikke benyttes».
//
//  Returnerer { value, label, explanation } eller null hvis for lite
//  data til å foreslå noe. Klinikeren kan alltid overstyre manuelt.
// ----------------------------------------------------------------
export function classifyLuminalLike({ ki67, grade, hrPercent }) {
  const hasKi = ki67 !== '' && ki67 != null;
  const hasGrade = grade !== '' && grade != null;
  const hasHr = hrPercent !== '' && hrPercent != null;
  const ki = Number(ki67);
  const g = Number(grade);
  const hr = Number(hrPercent);

  if (!hasKi && !hasGrade && !hasHr) return null;

  // LumB-liknende — minst ett kriterium oppfylt
  const bReasons = [];
  if (hasKi && ki > 35) bReasons.push('Ki67 > 35 %');
  if (hasGrade && g === 3 && hasKi && ki >= 20) bReasons.push('Grad 3 med samsvarende høy Ki67');
  if (hasHr && hr < 50) bReasons.push('HR < 50 %');
  if (bReasons.length > 0) {
    return { value: 'B', label: 'LumB-liknende', explanation: 'Oppfyller LumB-kriterium: ' + bReasons.join('; ') + '.' };
  }

  // Lum A-liknende — alle tre karakteristika (for de feltene som er oppgitt)
  const aOk =
    (!hasKi || ki < 10) &&
    (!hasGrade || g === 1 || g === 2) &&
    (!hasHr || hr > 50);
  const aComplete = hasKi && hasGrade && hasHr;
  if (aOk && aComplete) {
    return { value: 'A', label: 'Lum A-liknende', explanation: 'Oppfyller Lum A-karakteristika: Ki67 < 10 %, G1-2 og HR > 50 %.' };
  }

  // Ki67 i gråsonen 10–35 % uten B-kriterier → ikke konklusiv
  if (hasKi && ki >= 10 && ki <= 35) {
    return {
      value: 'inconclusive',
      label: 'Ikke konklusiv Luminal gruppe',
      explanation: 'Ki67 mellom 10 % og 35 % bør ikke benyttes for vurdering av grunnlag for kjemoterapi — gruppen kan ikke klassifiseres sikkert uten genekspresjonsanalyse.',
    };
  }

  // Delvis Lum A-profil, men ufullstendige data
  if (aOk) {
    return { value: 'A', label: 'Lum A-liknende (forslag)', explanation: 'Tilgjengelige verdier er forenlige med Lum A-liknende, men ikke alle karakteristika er oppgitt.' };
  }

  return {
    value: 'inconclusive',
    label: 'Ikke konklusiv Luminal gruppe',
    explanation: 'Verdiene passer ikke entydig i Lum A- eller LumB-liknende gruppe.',
  };
}
