/**
 * Journalnotatet som en ordnet liste av blokker.
 *
 * Notatet bygges ikke på nytt ved hver endring. Grunnen er et konkret krav:
 * tekst legen har skrevet eller endret skal ikke forsvinne fordi han krysser
 * av noe annet etterpå. Derfor eier hver avkryssing sin egen blokk, og
 * redigering endrer blokkens tekst uten at noe annet røres.
 *
 * Blokk: { key, kind: 'sentence' | 'free', optionId?, text, edited? }
 */

let counter = 0;
const nextKey = (prefix) => `${prefix}-${++counter}`;

/** Legg til setningen bakerst, med mindre den alt ligger i notatet. */
export function addSentence(blocks, option) {
  if (!option) return blocks;
  if (blocks.some((b) => b.kind === 'sentence' && b.optionId === option.id)) return blocks;
  return [...blocks, { key: nextKey('s'), kind: 'sentence', optionId: option.id, text: option.text }];
}

/** Fjern blokken som hører til denne avkryssingen. Fri tekst røres aldri. */
export function removeByOption(blocks, optionId) {
  return blocks.filter((b) => !(b.kind === 'sentence' && b.optionId === optionId));
}

/**
 * Bytt ut alle setninger fra en gruppe der bare ett valg er lov.
 * Fri tekst og setninger fra andre grupper står urørt.
 */
export function replaceGroupSelection(blocks, groupOptionIds, option) {
  const others = blocks.filter((b) => !(b.kind === 'sentence' && groupOptionIds.includes(b.optionId)));
  return option ? addSentence(others, option) : others;
}

/** Fri tekstblokk som ingen avkryssing eier — fjernes aldri automatisk. */
export function addFreeText(blocks, text = '') {
  return [...blocks, { key: nextKey('f'), kind: 'free', text }];
}

/** Rediger teksten i én blokk. Merkes som endret så UI kan vise det. */
export function editBlock(blocks, key, text) {
  return blocks.map((b) => (b.key === key ? { ...b, text, edited: true } : b));
}

export function removeBlock(blocks, key) {
  return blocks.filter((b) => b.key !== key);
}

/** Flytt en blokk opp eller ned. Returnerer samme liste hvis den ikke kan flyttes. */
export function moveBlock(blocks, key, delta) {
  const i = blocks.findIndex((b) => b.key === key);
  const target = i + delta;
  if (i === -1 || target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[i], next[target]] = [next[target], next[i]];
  return next;
}

/** Hvilke avkryssinger er representert i notatet akkurat nå. */
export function selectedOptionIds(blocks) {
  return blocks.filter((b) => b.kind === 'sentence').map((b) => b.optionId);
}

export function hasOption(blocks, optionId) {
  return blocks.some((b) => b.kind === 'sentence' && b.optionId === optionId);
}

/**
 * Notatet som sammenhengende tekst: innledningen først, deretter blokkene.
 * Tomme blokker hoppes over, så en ubrukt fritekstblokk ikke lager luft.
 */
export function joinBlocks(blocks, intro = '') {
  const parts = [];
  if (intro && intro.trim()) parts.push(intro.trim());
  for (const b of blocks) {
    const text = (b.text || '').trim();
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}
