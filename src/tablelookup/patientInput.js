/**
 * Adapter fra pasientskjemaet til tabelloppslagets matcher.
 *
 * De ordrette NBCG-tabellene bruker et annet vokabular enn regelmotoren:
 * patologiske stadier med p-prefiks (pT1c, pN0), «HR-HER2-» for trippel
 * negativ, og `menopausal` framfor `menopausalStatus`. Oversettelsen ligger
 * her, eksplisitt, slik at ingen av delene trenger å kjenne den andre.
 */

import { simplifyT, classifyLuminalLike } from './matcher.js';

/** Regelmotorens biogruppe → tabellenes «Hoved-gruppe»-kolonne. */
const BIO_GROUP = {
  'HR+HER2-': 'HR+HER2-',
  'HR+HER2+': 'HR+HER2+',
  'HR-HER2+': 'HR-HER2+',
  TN: 'HR-HER2-',
};

/**
 * N-stadium → tabellenes pN-verdier.
 *
 * N1mi har ingen egen rad: fotnoten til CDK4/6-tabellen sier «Ingen
 * behandlingsindikasjon ved pN1mic». Den lates derfor stå uoversatt, slik at
 * oppslaget viser radene som mulige framfor å tvinge pasienten inn i pN0
 * eller pN1 — klinikeren varsles i stedet.
 */
const N_STAGE = {
  N0: 'pN0',
  N1: 'pN1',
  N2: 'pN2',
  N3: 'pN3',
};

export const N1MI_NOTE =
  'N1mi (mikrometastase) har ingen egen rad i tabellene. Oppslaget avgrenses derfor ikke på N-stadium — se fotnoten om at det ikke er behandlingsindikasjon ved pN1mic.';

export function isUnmappedNStage(form) {
  return form.nStage === 'N1mi';
}

/** T-stadium fra regelmotoren ('T1c') → tabellenes patologiske form ('pT1c'). */
function toPathologicalT(tStage) {
  if (!tStage) return '';
  return tStage.startsWith('p') ? tStage : `p${tStage}`;
}

const num = (v) => (v === '' || v == null ? '' : v);

/**
 * Bygg matcher-input fra skjemaet og regelmotorens avledninger.
 *
 * @param form        skjemastaten (rå strengverdier)
 * @param cqlOutput   evaluateCQL-resultatet, eller null
 * @param overrides   { bioGroup, luminalLike } — klinikerens manuelle valg
 */
export function toLookupInput(form, cqlOutput, overrides = {}) {
  const derivedBio = cqlOutput?.bioGroup ? BIO_GROUP[cqlOutput.bioGroup] || '' : '';
  const bioGroup = overrides.bioGroup || derivedBio;

  const tStage = toPathologicalT(cqlOutput?.tStage || form.tStageOverride || '');
  const hrPercent = num(form.erPercent);

  const luminalSuggestion = classifyLuminalLike({
    ki67: num(form.ki67),
    grade: num(form.grade),
    hrPercent,
  });
  const luminalLike = overrides.luminalLike || luminalSuggestion?.value || '';

  return {
    input: {
      bioGroup,
      tStage,
      tSimple: simplifyT(tStage),
      nStage: N_STAGE[form.nStage] || '',
      menopausal: form.menopausalStatus === 'post' || form.menopausalStatus === 'pre' ? form.menopausalStatus : '',
      geneTestAvailable: !!form.geneTest && form.geneTest !== 'none',
      geneTest: form.geneTest && form.geneTest !== 'none' ? form.geneTest : '',
      prosignaSubtype: form.prosignaSubtype || '',
      rorScore: num(form.rorScore),
      rsScore: num(form.rsScore),
      ki67: num(form.ki67),
      grade: num(form.grade),
      hrPercent,
      luminalLike,
    },
    derivedBioGroup: derivedBio,
    luminalSuggestion,
  };
}

export const BIO_GROUP_OPTIONS = [
  { value: 'HR+HER2-', label: 'HR+ HER2-' },
  { value: 'HR+HER2+', label: 'HR+ HER2+' },
  { value: 'HR-HER2+', label: 'HR- HER2+' },
  { value: 'HR-HER2-', label: 'HR- HER2- (trippel negativ)' },
];
