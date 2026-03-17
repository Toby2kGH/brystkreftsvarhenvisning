/**
 * Konfigurerbare kliniske terskelverdier.
 *
 * Disse verdiene brukes av CQL-motoren for fakta-derivering.
 * Klinikere kan endre tersklene via API uten å endre kode.
 *
 * Alle terskler har dokumentert kilde fra NBCG Handlingsprogram
 * eller internasjonale retningslinjer.
 */

export const DEFAULT_THRESHOLDS = {
  // ── ER-status ────────────────────────────────────────────
  erPositiveThreshold: {
    value: 10,
    unit: '%',
    description: 'ER > denne verdien regnes som ER-positiv',
    source: 'NBCG Handlingsprogram, kap. 7.1; St. Gallen 2023 konsensus',
    note: 'ER 1-10% = lav-positiv, regnes klinisk som ER-negativ',
  },
  erLowPositiveMin: {
    value: 1,
    unit: '%',
    description: 'Nedre grense for ER lav-positiv',
    source: 'ASCO/CAP 2020 retningslinjer; NBCG',
    note: 'ER ≥1% og ≤10% er lav-positiv',
  },

  // ── PR-status ────────────────────────────────────────────
  prPositiveThreshold: {
    value: 1,
    unit: '%',
    description: 'PR ≥ denne verdien regnes som PR-positiv',
    source: 'ASCO/CAP 2020; NBCG Handlingsprogram',
    note: 'PR ≥1% = positiv',
  },

  // ── Ki-67 ────────────────────────────────────────────────
  ki67HighThreshold: {
    value: 20,
    unit: '%',
    description: 'Ki-67 ≥ denne verdien klassifiseres som høy (Luminal B-like)',
    source: 'St. Gallen 2023 konsensus; NBCG Handlingsprogram kap. 7.2',
    note: 'Kontroversielt: noen sentre bruker 14% (IBCSG), andre 20% (St. Gallen). NBCG anbefaler 20%',
  },

  // ── PR for luminal subtype ───────────────────────────────
  prLowForLuminalB: {
    value: 20,
    unit: '%',
    description: 'PR < denne verdien teller som Luminal B-like-faktor',
    source: 'St. Gallen 2013/2023 konsensus',
    note: 'PR <20% er en av kriteriene for Luminal B-like klassifisering',
  },

  // ── Prosigna ROR-score ───────────────────────────────────
  rorLowCutoff: {
    value: 40,
    unit: 'score',
    description: 'ROR ≤ denne verdien = lav risiko',
    source: 'NBCG Handlingsprogram kap. 7.3 (17.12.24)',
    note: 'Prosigna ROR ≤40 betyr lav risiko, ingen kjemoterapi',
  },
  rorHighCutoff: {
    value: 60,
    unit: 'score',
    description: 'ROR > denne verdien = høy risiko',
    source: 'NBCG Handlingsprogram kap. 7.3 (17.12.24)',
    note: 'Prosigna ROR >60 betyr høy risiko, kjemoterapi anbefales',
  },

  // ── OncotypeDX RS-score ──────────────────────────────────
  rsHighCutoff: {
    value: 25,
    unit: 'score',
    description: 'RS > denne verdien = høy risiko (kjemoterapi)',
    source: 'TAILORx (Sparano 2018); RxPONDER (Kalinsky 2021); NBCG',
    note: 'RS ≤25 + postmenopausal: endokrin alene (TAILORx). RS ≤25 + premenopausal pN1: endokrin alene (RxPONDER)',
  },

  // ── Fertilitetsvarsel ────────────────────────────────────
  fertilityWarningAge: {
    value: 40,
    unit: 'år',
    description: 'Alder ≤ denne verdien utløser fertilitetsrådgivningsvarsel',
    source: 'NBCG Handlingsprogram kap. 10.1; ESMO fertility guidelines 2020',
    note: 'Alle fertile kvinner som skal ha gonadotoksisk behandling bør tilbys fertilitetsrådgivning',
  },
};

/**
 * Aktivt terskelverdisett — starter med defaults, kan oppdateres runtime.
 */
let activeThresholds = { ...DEFAULT_THRESHOLDS };

export function getThresholds() {
  return activeThresholds;
}

export function getThresholdValue(key) {
  return activeThresholds[key]?.value ?? DEFAULT_THRESHOLDS[key]?.value;
}

export function updateThreshold(key, value) {
  if (!(key in DEFAULT_THRESHOLDS)) {
    throw new Error(`Ukjent terskel: ${key}`);
  }
  activeThresholds = {
    ...activeThresholds,
    [key]: { ...activeThresholds[key], value },
  };
  return activeThresholds[key];
}

export function resetThresholds() {
  activeThresholds = { ...DEFAULT_THRESHOLDS };
  return activeThresholds;
}

export function getAllThresholdDocs() {
  return Object.entries(activeThresholds).map(([key, t]) => ({
    key,
    value: t.value,
    unit: t.unit,
    description: t.description,
    source: t.source,
    note: t.note,
    isDefault: t.value === DEFAULT_THRESHOLDS[key].value,
    defaultValue: DEFAULT_THRESHOLDS[key].value,
  }));
}
