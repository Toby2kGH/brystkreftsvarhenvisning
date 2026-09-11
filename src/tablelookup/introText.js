/**
 * Innledningssetningen i journalutkastet.
 *
 * Bygges av verdiene legen selv har oppgitt — ingenting utledes. Felter som
 * ikke er fylt ut faller helt bort; utkastet skal aldri inneholde «—» eller
 * halvferdige formuleringer som legen må rydde opp i etterpå.
 */

const MENOPAUSAL_ADJECTIVE = { pre: 'Premenopausal', post: 'Postmenopausal' };

/** Tabellenes kodede hovedgruppe → slik den skrives i en journal. */
const BIO_GROUP_LABEL = {
  'HR+HER2-': 'HR+ HER2-',
  'HR+HER2+': 'HR+ HER2+',
  'HR-HER2+': 'HR- HER2+',
  'HR-HER2-': 'HR- HER2-',
};
const GENE_TEST_NAME = { prosigna: 'Prosigna (PAM50)', oncotypedx: 'OncotypeDx' };
const PAM50_NAME = { lumA: 'Luminal A', lumB: 'Luminal B' };
const LUMINAL_NAME = {
  A: 'Lum A-liknende',
  B: 'LumB-liknende',
  inconclusive: 'ikke konklusiv Luminal gruppe',
};

const has = (v) => v !== '' && v != null;

/** «Postmenopausal pasient, 58 år» — ikke «Pasient med postmenopausal». */
function personPhrase(menopausal, age) {
  const adjective = MENOPAUSAL_ADJECTIVE[menopausal];
  const subject = adjective ? `${adjective} pasient` : 'Pasient';
  return has(age) ? `${subject}, ${age} år` : subject;
}

/** Genekspresjonstest med score, eller null når den ikke er oppgitt. */
export function geneTestPhrase(lookup) {
  if (!lookup.geneTestAvailable || !lookup.geneTest) return null;
  const name = GENE_TEST_NAME[lookup.geneTest] || lookup.geneTest;
  if (lookup.geneTest === 'prosigna') {
    const parts = [];
    if (has(lookup.rorScore)) parts.push(`ROR-score ${lookup.rorScore}`);
    if (PAM50_NAME[lookup.prosignaSubtype]) parts.push(PAM50_NAME[lookup.prosignaSubtype]);
    return parts.length ? `${name}: ${parts.join(', ')}` : name;
  }
  if (lookup.geneTest === 'oncotypedx' && has(lookup.rsScore)) return `${name}: RS ${lookup.rsScore}`;
  return name;
}

/**
 * Hele innledningen, som én til fire setninger avhengig av hva som er fylt ut.
 * Returnerer tom streng når ingenting foreligger, slik at malen kan utelate den.
 *
 * @param lookup   feltene som styrer oppslaget
 * @param journal  feltene som bare gjengis i teksten
 */
export function buildIntro(lookup = {}, journal = {}) {
  const sentences = [];

  // Setning 1 — person, hovedgruppe og stadium
  const first = [personPhrase(lookup.menopausal, journal.age)];
  const staging = [];
  if (has(lookup.bioGroup)) staging.push(BIO_GROUP_LABEL[lookup.bioGroup] || lookup.bioGroup);
  const tnm = [lookup.tStage, lookup.nStage].filter(has).join('');
  if (tnm) staging.push(tnm);
  if (staging.length) first.push(staging.join(' '));
  sentences.push(first.join('. '));

  // Setning 2 — patologiske funn, kun det som er oppgitt
  const findings = [];
  if (has(journal.erPercent)) findings.push(`ER ${journal.erPercent} %`);
  if (has(journal.prPercent)) findings.push(`PR ${journal.prPercent} %`);
  if (has(journal.her2)) findings.push(`HER2 ${journal.her2}`);
  if (has(journal.ki67)) findings.push(`Ki-67 ${journal.ki67} %`);
  if (has(journal.grade)) findings.push(`grad ${journal.grade}`);
  if (findings.length) sentences.push(findings.join(', '));

  // Setning 3 — genekspresjonstest
  const geneTest = geneTestPhrase(lookup);
  if (geneTest) sentences.push(geneTest);

  // Setning 4 — luminal gruppe, som legen selv har vurdert
  if (LUMINAL_NAME[lookup.luminalLike]) {
    sentences.push(`Vurdert som ${LUMINAL_NAME[lookup.luminalLike]}`);
  }

  // Uten noe som helst utfylt blir første setning bare «Pasient» — da er det
  // ingen innledning å skrive, og malen skal hoppe over den.
  if (sentences.length === 1 && sentences[0] === 'Pasient') return '';

  return sentences.join('. ') + '.';
}
