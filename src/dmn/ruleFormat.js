/**
 * Presentasjon av DMN-regler for klinikeren.
 *
 * Delt mellom beslutningstreet og Tabelloppslag 2.0, slik at en regel og dens
 * NBCG-kildehenvisning ser lik ut uansett hvor i appen den vises.
 */

/** Regelens egen kildehenvisning, med fallback til tabellens. */
export function resolveSource(rule, table) {
  return (rule && rule.sourceRef) || (table && table.guidelineSource) || null;
}

/** Kildehenvisning som én lesbar linje: dokument · revisjon · kapittel · side · studie · NBCG-tabell. */
export function formatSource(rule, table) {
  const ref = resolveSource(rule, table);
  if (!ref) return 'NBCG Handlingsprogram';
  const parts = [ref.document, ref.revision, ref.chapter, ref.page, ref.trialReference || ref.study, ref.nbcgTable].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'NBCG Handlingsprogram';
}

/** Én betingelsesverdi som lesbar tekst (FEEL-subsettet regelmotoren bruker). */
export function formatCondition(val) {
  if (val === null || val === undefined) return 'vilkårlig';
  if (Array.isArray(val)) return val.join(' / ');
  if (typeof val === 'object') {
    const parts = [];
    if ('gte' in val) parts.push(`≥${val.gte}`);
    if ('gt' in val) parts.push(`>${val.gt}`);
    if ('lte' in val) parts.push(`≤${val.lte}`);
    if ('lt' in val) parts.push(`<${val.lt}`);
    if ('not' in val) parts.push(`ikke ${val.not}`);
    return parts.join(', ');
  }
  if (typeof val === 'boolean') return val ? 'ja' : 'nei';
  return String(val);
}

/** CDK4/6-tabellens kodede anbefalingsverdier til norsk. */
export function formatCDK46(val) {
  const map = {
    yes: 'Ja — anbefalt',
    no: 'Nei',
    first_choice: 'Førstevalg',
    if_G3: 'Kun ved Grad 3',
    'if_G3_or_gesHigh': 'Ved Grad 3 eller GES høy risiko',
    'if_G3_or_5cm': 'Ved Grad 3 eller tumor ≥5cm (førstevalg)',
    'yes_unless_low': 'Ja (avstå ved Grad 1 eller lavrisiko GES)',
  };
  return map[val] || val;
}
