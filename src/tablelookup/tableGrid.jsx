import React from 'react';

/**
 * Rutenett-byggeklosser for de ordrette NBCG-tabellene.
 *
 * Delt mellom Tabelloppslag og Tabelloppslag 1.1, slik at begge fanene
 * gjengir tabellene med nøyaktig samme sammenslåing og linjebrekking som
 * PDF-en. Rene presentasjonsfunksjoner — de tolker ingenting.
 */

/** Cellens egne linjeskift bevares, uten å tvinge `white-space: pre` på kolonnen. */
export function MultilineText({ text }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Beregner rowSpan for de sammenslåtte venstre-kolonnene.
 * En celle i kolonne c starter et nytt spenn hvis raden er første,
 * eller hvis en av kolonnene 0..c skiller seg fra forrige rad.
 */
export function computeSpans(rows, mergeCount) {
  const result = rows.map(() => []);
  for (let c = 0; c < mergeCount; c++) {
    let r = 0;
    while (r < rows.length) {
      // Finn lengden på spennet som starter på rad r for kolonne c
      let len = 1;
      while (
        r + len < rows.length &&
        sameUpTo(rows[r].cells, rows[r + len].cells, c)
      ) {
        len++;
      }
      result[r][c] = { render: true, span: len };
      for (let k = 1; k < len; k++) {
        result[r + k][c] = { render: false, span: 0 };
      }
      r += len;
    }
  }
  return result;
}

/** Sant hvis cellene 0..c er identiske i to rader (for nested merge). */
export function sameUpTo(cellsA, cellsB, c) {
  for (let i = 0; i <= c; i++) {
    if (cellsA[i] !== cellsB[i]) return false;
  }
  return true;
}
