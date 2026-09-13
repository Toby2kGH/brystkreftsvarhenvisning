/**
 * Svar på henvisning — åpningslinje og sammensetning.
 *
 * Registeret følger den opprinnelige «klinisk svar»-malen i
 * ReferralLetterGenerator: man svarer med hva det er *indikasjon for*, ikke
 * med hva som gis. Derfor «I henhold til retningslinjer er det indikasjon for
 * adjuvant behandling: …» og ikke «Det gis …».
 *
 * To oppsett, som legen veksler mellom:
 *   'samlet'    — all behandling i én nummerert liste under én ledetekst
 *   'perGruppe' — hver gruppe med sin egen ledetekst
 */

const has = (v) => v !== '' && v != null;

const MENOPAUSAL_CERTAINTY = {
  post: 'sikker postmenopausal',
  pre: 'sikker premenopausal',
  peri: 'usikker menopausal',
};

const HER2_LABEL = { 'HR+HER2+': 'Pos', 'HR-HER2+': 'Pos', 'HR+HER2-': 'Neg', 'HR-HER2-': 'Neg' };
const HR_POSITIVE = { 'HR+HER2+': true, 'HR+HER2-': true, 'HR-HER2+': false, 'HR-HER2-': false };

const GENE_TEST_NAME = { prosigna: 'Prosigna ROR-score', oncotypedx: 'OncotypeDX RS' };

export const INTENT_WORD = {
  adjuvant: 'adjuvant',
  neoadjuvant: 'neoadjuvant',
  'post-neoadjuvant': 'postneoadjuvant',
};

/** «C50.9 Ca mammae, C77.9 Lymfeknutemetastase» — som i den opprinnelige malen. */
function diagnosisCode(patient) {
  let code = 'C50.9 Ca mammae';
  if (has(patient.nStage) && patient.nStage !== 'pN0') code += ', C77.9 Lymfeknutemetastase';
  return code;
}

/** «ER+ (90%) og PR+ (60%)» — prosent tas med når den er oppgitt. */
function receptorPhrase(patient) {
  const hrPos = HR_POSITIVE[patient.bioGroup];
  const one = (label, percent, positive) => {
    if (positive === false) return `${label}-`;
    if (has(percent)) return `${label}+ (${percent}%)`;
    return positive === true ? `${label}+` : '';
  };
  // ER/PR-positivitet følger hovedgruppen; prosenten er legens egen verdi.
  const er = one('ER', patient.erPercent, hrPos);
  const pr = one('PR', patient.prPercent, hrPos);
  return [er, pr].filter(Boolean).join(' og ');
}

function her2Phrase(patient) {
  const status = HER2_LABEL[patient.bioGroup];
  if (!status) return has(patient.her2) ? `HER2 ${patient.her2}` : '';
  return has(patient.her2) ? `HER2 ${status} (${patient.her2})` : `HER2 ${status}`;
}

function geneTestPhrase(patient) {
  // Originalen skriver bare «Ikke utført», som henger løst midt i setningen.
  // Samme opplysning, men lesbar.
  if (!has(patient.geneTest) || patient.geneTest === 'none') return 'genekspresjonstest ikke utført';
  const name = GENE_TEST_NAME[patient.geneTest] || patient.geneTest;
  return has(patient.geneScore) ? `${name} ${patient.geneScore}` : name;
}

/**
 * Åpningslinjen, bygget som i den opprinnelige malen — med grad og Ki-67 lagt
 * til. Felter som ikke er fylt ut faller bort uten å etterlate seg spor.
 */
export function buildOpening(patient = {}) {
  const staging = [patient.tStage, patient.nStage].filter(has).join('');

  const parts = [diagnosisCode(patient)];
  if (staging) parts.push(staging);

  const receptors = receptorPhrase(patient);
  if (receptors) parts.push(receptors);

  const her2 = her2Phrase(patient);
  if (her2) parts.push(her2);

  const morphology = [];
  if (has(patient.grade)) morphology.push(`grad ${patient.grade}`);
  if (has(patient.ki67)) morphology.push(`Ki-67 ${patient.ki67}%`);

  let line = `Diagnose: ${parts.join(' ')}`;
  if (morphology.length) line += ` ${morphology.join(', ')}`;
  line += `, ${geneTestPhrase(patient)}`;

  const person = [];
  if (has(patient.age)) person.push(`${patient.age} år gammel`);
  person.push('kvinne');
  const certainty = MENOPAUSAL_CERTAINTY[patient.menopausal];
  line += ` hos en ${person.join(' ')}`;
  if (certainty) line += ` med ${certainty} status`;

  return `${line}.`;
}

/** Forkortelser og regimenavn skal ikke få liten forbokstav: EC90, TC, OFS, T-DM1. */
const isAcronym = (word) => /^[A-ZÆØÅ][A-ZÆØÅ0-9-]+/.test(word);

/** «Aromatasehemmer i 5 år» → «aromatasehemmer i 5 år», men «EC90 ×4» står. */
function lowerFirst(text) {
  if (!text) return text;
  const firstWord = text.split(/\s/)[0];
  return isAcronym(firstWord) ? text : text[0].toLowerCase() + text.slice(1);
}

/** Punkt i en nummerert liste starter med stor forbokstav. */
function upperFirst(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/**
 * Setter sammen behandlingsavsnittet.
 *
 * @param items   [{ core, groupId, lead }] i legens rekkefølge
 * @param intent  'adjuvant' | 'neoadjuvant' | 'post-neoadjuvant' | ''
 * @param mode    'samlet' | 'perGruppe'
 */
export function buildTreatmentSection(items, intent, mode) {
  if (!items.length) return [];
  const intentWord = INTENT_WORD[intent] || '';

  if (mode === 'samlet') {
    const heading = intentWord
      ? `I henhold til retningslinjer er det indikasjon for ${intentWord} behandling:`
      : 'I henhold til retningslinjer er det indikasjon for følgende behandling:';
    const lines = items.map((it, i) => {
      // I listeform står punktet alene, så noen grupper trenger sitt eget ord
      // med — «hele brystet» blir meningsløst uten «strålebehandling mot».
      const body = it.listPrefix ? `${it.listPrefix} ${it.core}` : it.core;
      return `${i + 1}. ${upperFirst(body)}.`;
    });
    return [`${heading}\n${lines.join('\n')}`];
  }

  // perGruppe — hver gruppe får sin egen ledetekst, i den rekkefølgen de kom
  const order = [];
  const byGroup = new Map();
  for (const item of items) {
    if (!byGroup.has(item.groupId)) {
      byGroup.set(item.groupId, { lead: item.lead, cores: [] });
      order.push(item.groupId);
    }
    byGroup.get(item.groupId).cores.push(item.core);
  }

  return order.map((groupId) => {
    const { lead, cores } = byGroup.get(groupId);
    const body = cores.map(lowerFirst).join('. ');
    const resolved = (lead || 'Det er indikasjon for {intent}').replace(/\{intent\}/g, intentWord).replace(/\s+/g, ' ').trim();
    return `${resolved} ${body}.`;
  });
}
