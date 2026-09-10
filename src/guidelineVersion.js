/**
 * Enkelt kildepunkt for hvilken NBCG-revisjon innholdet er verifisert mot.
 *
 * Unngår at versjonsetiketten i UI driver fra hverandre. Oppdater HER når
 * innholdet er gjennomgått mot en ny NBCG-revisjon, og legg til en linje i
 * CHANGELOG.md med hvem som verifiserte.
 */
export const GUIDELINE_VERSION = {
  handlingsprogram: 'Mars 2025',
  tables: '17.12.24 / 04.09.25 / 15.11.23',
  verifiedDate: '2026-07-30',
};

/** Eksplisitt virkeområde — hindrer at verktøyet forveksles med et komplett forløp. */
export const SCOPE_NOTE =
  'Dekker adjuvant og neoadjuvant systembehandling. Omfatter ikke metastatisk ' +
  'sykdom, kirurgi/sentinel node, strålebehandlingsdetaljer, oppfølging/kontroll ' +
  'eller dose-/bivirkningsmonitorering.';
