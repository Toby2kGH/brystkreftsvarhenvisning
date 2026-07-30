/**
 * Delt malmotor for tekstgenerering.
 *
 * Brukes både av ReferralLetterGenerator (algoritmisk side) og av det
 * manuelle oppslagsverktøyet (InteractiveDecisionTree). Motoren er
 * datakilde-agnostisk: den tar inn resolver-funksjoner, ikke en spesifikk
 * pasientdata-struktur. Slik kan begge verktøyene dele samme byggeklosser.
 *
 * Blokktyper:
 *   { type: 'text', value }
 *   { type: 'var',  varId }
 *   { type: 'cond', condition, trueText, falseText, useVar? }
 */

export function renderTemplate(blocks, resolveVar, evalCond) {
  let text = '';
  for (const block of blocks) {
    if (block.type === 'text') {
      text += block.value;
    } else if (block.type === 'var') {
      text += resolveVar(block.varId);
    } else if (block.type === 'cond') {
      if (evalCond(block.condition)) {
        text += block.trueText || '';
        if (block.useVar) text += resolveVar(block.useVar);
      } else {
        text += block.falseText || '';
      }
    }
  }
  return text;
}

/**
 * Lag localStorage-baserte mal-lagringshjelpere for en gitt nøkkel.
 * Rene funksjoner over ett navnerom — feiler stille ved manglende lagring.
 */
export function makeTemplateStorage(storageKey) {
  return {
    load() {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    },
    save(name, blocks) {
      const saved = this.load();
      saved[name] = blocks;
      localStorage.setItem(storageKey, JSON.stringify(saved));
    },
    remove(name) {
      const saved = this.load();
      delete saved[name];
      localStorage.setItem(storageKey, JSON.stringify(saved));
    },
  };
}

/** Kopier tekst til utklippstavle med fallback for ikke-HTTPS/uten Clipboard API. */
export function copyText(text, onDone) {
  const done = () => { if (onDone) onDone(); };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch {}
}
