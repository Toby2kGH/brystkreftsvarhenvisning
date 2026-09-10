/**
 * Delte feltdefinisjoner for pasientskjemaet.
 *
 * Brukes av både PatientForm (Pasientvurdering) og TableLookupWorkbench
 * (Tabelloppslag 2.0). Den kliniske feltlogikken — nøytrale defaults,
 * kaskade-reset av gentester og talltvang før evaluering — skal finnes
 * ett sted, slik at de to sidene ikke kan drifte fra hverandre.
 */

export const INITIAL_STATE = {
  treatmentMode: 'adjuvant',
  // Receptor — nøytrale defaults: tving eksplisitt valg (unngå stille HR+-antagelse)
  erStatus: '',
  erPercent: '',
  prStatus: '',
  prPercent: '',
  // HER2
  her2ihc: '',
  her2sish: '',
  // Tumor
  ki67: '',
  grade: '',
  tumorSizeMm: '',
  tStageOverride: '',
  nStage: 'N0',
  histologicalType: '',
  // Gene expression
  geneTest: 'none',
  rorScore: '',
  rsScore: '',
  prosignaSubtype: '',
  // Patient
  menopausalStatus: '',
  age: '',
  surgeryType: 'bcs',
  // BRCA
  brcaStatus: 'not_tested',
  // Post-neoadjuvant
  pcrStatus: '',
};

/**
 * Sett ett felt og rydd opp i felter som ikke lenger er gyldige.
 *
 * Gentester nullstilles når de blir uaktuelle: Prosigna er ikke validert ved
 * T3+/N1+, og OncotypeDX brukes kun ved N1+ hos postmenopausale. Uten dette
 * kunne en score bli liggende igjen og påvirke evalueringen etter at
 * klinikeren endret stadium.
 */
export function applyFieldChange(prev, name, value) {
  const next = { ...prev, [name]: value };

  // Gentest er ikke relevant ved neoadjuvant behandling
  if (name === 'treatmentMode' && value === 'neoadjuvant') {
    next.geneTest = 'none';
    next.rorScore = '';
    next.rsScore = '';
    next.prosignaSubtype = '';
  }

  if (['nStage', 'tumorSizeMm', 'tStageOverride', 'menopausalStatus'].includes(name)) {
    const isT3 = next.tStageOverride === 'T4' || (next.tumorSizeMm !== '' && Number(next.tumorSizeMm) > 50);
    const isN1Plus = ['N1', 'N2', 'N3'].includes(next.nStage);
    if (next.geneTest === 'prosigna' && (isT3 || isN1Plus)) {
      next.geneTest = 'none';
      next.rorScore = '';
      next.prosignaSubtype = '';
    }
    if (next.geneTest === 'oncotypedx' && !(isN1Plus && next.menopausalStatus === 'post')) {
      next.geneTest = 'none';
      next.rsScore = '';
    }
  }

  return next;
}

/** Gjør skjemaets strengverdier om til tall/undefined slik regelmotoren forventer. */
export function normalizePatientData(form) {
  const num = (v) => (v !== '' ? Number(v) : undefined);
  const str = (v) => (v !== '' ? v : undefined);
  return {
    ...form,
    erPercent: num(form.erPercent),
    prPercent: num(form.prPercent),
    ki67: num(form.ki67),
    grade: num(form.grade),
    tumorSizeMm: num(form.tumorSizeMm),
    age: num(form.age),
    rorScore: num(form.rorScore),
    rsScore: num(form.rsScore),
    tStageOverride: str(form.tStageOverride),
    her2ihc: str(form.her2ihc),
    her2sish: str(form.her2sish),
    geneTest: str(form.geneTest),
    prosignaSubtype: str(form.prosignaSubtype),
    brcaStatus: str(form.brcaStatus),
    histologicalType: str(form.histologicalType),
    pcrStatus: str(form.pcrStatus),
  };
}

/** Feltavhengigheter som styrer hvilke deler av skjemaet som vises. */
export function deriveFormVisibility(form) {
  const isNeoadjuvant = form.treatmentMode === 'neoadjuvant';
  const isT3orHigher = form.tStageOverride === 'T4' || (form.tumorSizeMm !== '' && Number(form.tumorSizeMm) > 50);
  const isN1orHigher = ['N1', 'N2', 'N3'].includes(form.nStage);
  const showProsignaOption = !isT3orHigher && !isN1orHigher;
  const showOncotypeOption = isN1orHigher && form.menopausalStatus === 'post';
  return {
    isNeoadjuvant,
    showSISH: form.her2ihc === '2+',
    showGeneTestSection: !isNeoadjuvant,
    showProsignaOption,
    showOncotypeOption,
    showProsigna: form.geneTest === 'prosigna' && showProsignaOption,
    showOncotype: form.geneTest === 'oncotypedx' && showOncotypeOption,
  };
}
