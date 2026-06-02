import React, { useState, useMemo } from 'react';
import PatientForm from './PatientForm.jsx';
import { evaluateCQL } from '../cql/cqlEngine.js';
import {
  tableGeneTest,
  tableNoGeneTest,
  tableNeoadjuvant,
  addonTables,
  referenceDocs,
  sharedRegimens,
} from '../tablelookup/guidelineTables.js';
import { findMatchingRows, deriveMatchInput } from '../tablelookup/matcher.js';

// ================================================================
//  Tabelloppslag — ny fane (endrer ikke det eksisterende verktøyet)
// ================================================================
//
//  Bruker SAMME pasientskjema som "Pasientvurdering" (PatientForm) og
//  SAMME deriveringslogikk (evaluateCQL) for å finne fram til hva som
//  er T-stadium, N-stadium, biologisk undergruppe, menopausal status,
//  luminal subtype osv. ut fra inndata. Deretter slår verktøyet kun
//  opp hvor i de offisielle NBCG-tabellene pasienten hører hjemme —
//  det gir INGEN algoritmisk anbefaling, men highlighter riktig rad og
//  tilbyr den ordrette tabellteksten som redigerbart journaltekst.
// ================================================================

export default function TableLookup() {
  const [facts, setFacts] = useState(null); // deriverte CQL-fakta (null før oppslag)
  const [luminalOverride, setLuminalOverride] = useState(''); // manuell overstyring av luminal-gruppe
  const [edited, setEdited] = useState({}); // redigert journaltekst: key = `${tableId}:${rowIdx}`
  const [copiedKey, setCopiedKey] = useState(null);

  // Kjør samme derivering som "Pasientvurdering" og bygg matcher-input.
  function handleLookup(patientData) {
    setFacts(evaluateCQL(patientData));
    setLuminalOverride('');
    setEdited({});
  }

  const { matchInput, luminalSuggestion } = useMemo(
    () => (facts ? deriveMatchInput(facts, luminalOverride) : { matchInput: null, luminalSuggestion: null }),
    [facts, luminalOverride]
  );

  // Primærtabell: neoadjuvant situasjon bruker neoadjuvant-tabellen,
  // ellers avhenger valget av om gentest foreligger.
  const primaryTable = matchInput?.neoadjuvant
    ? tableNeoadjuvant
    : matchInput?.geneTestAvailable
    ? tableGeneTest
    : tableNoGeneTest;
  const otherTable = matchInput?.geneTestAvailable ? tableNoGeneTest : tableGeneTest;

  // Tilleggstabeller (f.eks. CDK4/6, pT1pN1mi) som er relevante for denne
  // pasienten samtidig. En pasient kan dermed få flere relevante tabeller
  // vist på én gang. Addons gjelder ikke i neoadjuvant situasjon.
  const relevantTables = useMemo(() => {
    if (!matchInput) return [];
    const list = [{ table: primaryTable, role: matchInput.neoadjuvant ? 'Neoadjuvant' : 'Primæranbefaling' }];
    if (!matchInput.neoadjuvant) {
      for (const addon of addonTables) {
        const bioOk = !addon.appliesToBioGroups || addon.appliesToBioGroups.includes(matchInput.bioGroup);
        const nOk = !addon.requiresNStage || addon.requiresNStage.includes(matchInput.nStage);
        if (bioOk && nOk) list.push({ table: addon, role: 'Tilleggsbehandling' });
      }
    }
    return list;
  }, [primaryTable, matchInput]);

  // Relevante tekstdokumenter (narrativ, ikke tabell) — endokrin behandling
  // velges ut fra hovedgruppe (HR+) og menopausal status.
  const relevantDocs = useMemo(
    () =>
      matchInput
        ? referenceDocs.filter(
            (doc) =>
              (!doc.appliesToBioGroups || doc.appliesToBioGroups.includes(matchInput.bioGroup)) &&
              (!doc.menopausal || !matchInput.menopausal || doc.menopausal === matchInput.menopausal)
          )
        : [],
    [matchInput]
  );

  // Treff per relevant tabell
  const matchesByTable = useMemo(
    () => (matchInput ? relevantTables.map(({ table }) => findMatchingRows(table, matchInput)) : []),
    [relevantTables, matchInput]
  );

  // Skal luminal-gruppen vises/kunne overstyres? (kun når den påvirker oppslaget)
  const luminalRelevant =
    matchInput && matchInput.bioGroup === 'HR+HER2-' && (matchInput.neoadjuvant || !matchInput.geneTestAvailable);

  return (
    <div className="lookup">
      <div className="lookup-intro">
        <h2>Tabelloppslag</h2>
        <p>
          Fyll ut <strong>samme pasientskjema som på «Pasientvurdering»</strong>. Verktøyet bruker den
          samme deriveringslogikken til å finne fram til hva som er T-stadium, N-stadium, biologisk
          undergruppe, menopausal status og luminal subtype — og slår deretter opp hvor i de offisielle
          NBCG-tabellene pasienten hører hjemme. Det gir <strong>ingen algoritmisk anbefaling</strong>,
          men highlighter riktig rad og tilbyr den ordrette tabellteksten som utgangspunkt for
          journaltekst (kan tilpasses per rad).
        </p>
        <p>
          <strong>Flere tabeller og dokumenter kan være relevante for samme pasient.</strong> For
          HR-positiv, HER2-negativ sykdom vises f.eks. tabellen for adjuvant CDK4/6-hemmer og — ved
          mikrometastase — pT1pN1(mi)/Prosigna-tabellen. For HR-positiv sykdom vises også relevant
          tekstdokument for adjuvant endokrin behandling. Velg «Neoadjuvant» som behandlingsmodus for å
          slå opp i tabellen for neoadjuvant behandling.
        </p>
      </div>

      {/* ---------------- Inndata: samme skjema som Pasientvurdering ---------------- */}
      <PatientForm onSubmit={handleLookup} submitLabel="Slå opp i tabellene" loadingLabel="Slår opp…" />

      {/* ---------------- Avledede fakta + luminal-overstyring ---------------- */}
      {matchInput && (
        <DerivedFacts
          matchInput={matchInput}
          luminalSuggestion={luminalSuggestion}
          luminalRelevant={luminalRelevant}
          luminalOverride={luminalOverride}
          setLuminalOverride={setLuminalOverride}
        />
      )}

      {!matchInput && (
        <p className="lookup-summary lookup-summary-empty">
          Fyll ut pasientskjemaet over og trykk «Slå opp i tabellene» for å se hvor pasienten hører hjemme.
        </p>
      )}

      {matchInput && (
        <>
          {/* ---------------- Treff-oppsummering (alle relevante tabeller) ---------------- */}
          <MatchSummary relevantTables={relevantTables} matchesByTable={matchesByTable} bioGroup={matchInput.bioGroup} />

          {/* ---------------- Relevante tabeller (primær + ev. tillegg) ---------------- */}
          {relevantTables.map(({ table, role }, i) => (
            <LookupTable
              key={table.id}
              table={table}
              role={role}
              matches={matchesByTable[i]}
              edited={edited}
              setEdited={setEdited}
              copiedKey={copiedKey}
              setCopiedKey={setCopiedKey}
              isActive
            />
          ))}

          {/* ---------------- Relevante tekstdokumenter (endokrin behandling) ---------------- */}
          {relevantDocs.length > 0 && (
            <div className="lookup-docs">
              <h3 className="lookup-docs-title">Relevante tekstdokumenter</h3>
              {relevantDocs.map((doc) => (
                <ReferenceDoc key={doc.id} doc={doc} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
              ))}
            </div>
          )}

          {/* ---------------- Den andre primærtabellen (referanse) ---------------- */}
          {!matchInput.neoadjuvant && (
            <details className="lookup-other">
              <summary>Vis også: {otherTable.shortTitle} (referanse, ingen highlight)</summary>
              <LookupTable table={otherTable} matches={[]} edited={edited} setEdited={setEdited} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
            </details>
          )}
        </>
      )}

      {/* ---------------- Regimer / forklaringer ---------------- */}
      <details className="lookup-regimens">
        <summary>Regimer og forklaringer (ordrett fra handlingsprogrammet)</summary>
        <div className="lookup-regimens-body">
          {sharedRegimens.map((r) => (
            <div key={r.heading} className="lookup-regimen">
              <h4>{r.heading}</h4>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </details>

      <p className="lookup-disclaimer">
        Verktøyet gjengir tabeller fra NBCG sitt handlingsprogram for å vise hvor pasienten hører hjemme og
        forenkle journalføring. Det er ingen beslutningsstøtte. Kontroller alltid mot siste versjon av
        handlingsprogrammet og vurder teksten kritisk.
      </p>
    </div>
  );
}

// ================================================================
//  Avledede fakta — viser hva som ble derivert fra pasientdata
//  (T-stadium, N-stadium, biogruppe osv.) + luminal-overstyring.
// ================================================================

const BIO_LABEL = {
  'HR+HER2-': 'HR+ HER2-',
  'HR+HER2+': 'HR+ HER2+',
  'HR-HER2+': 'HR- HER2+',
  'HR-HER2-': 'HR- HER2- (trippel negativ)',
};
const MENO_LABEL = { pre: 'Premenopausal', post: 'Postmenopausal' };
const LUMINAL_LABEL = { A: 'Lum A-liknende', B: 'LumB-liknende', inconclusive: 'Ikke konklusiv' };

function DerivedFacts({ matchInput, luminalSuggestion, luminalRelevant, luminalOverride, setLuminalOverride }) {
  const chips = [
    { label: 'Modus', value: matchInput.neoadjuvant ? 'Neoadjuvant' : 'Adjuvant' },
    { label: 'Biogruppe', value: BIO_LABEL[matchInput.bioGroup] || '—' },
    { label: 'T-stadium', value: matchInput.tStage ? `${matchInput.tStage} (${matchInput.tSimple})` : '—' },
    { label: 'N-stadium', value: matchInput.nStage || '—' },
    { label: 'Menopausal', value: MENO_LABEL[matchInput.menopausal] || '—' },
  ];
  if (matchInput.geneTestAvailable) {
    if (matchInput.geneTest === 'prosigna') {
      chips.push({ label: 'Prosigna ROR', value: matchInput.rorScore !== '' ? String(matchInput.rorScore) : '—' });
      if (matchInput.prosignaSubtype) chips.push({ label: 'PAM50', value: matchInput.prosignaSubtype === 'lumA' ? 'Luminal A' : 'Luminal B' });
    } else if (matchInput.geneTest === 'oncotypedx') {
      chips.push({ label: 'OncotypeDx RS', value: matchInput.rsScore !== '' ? String(matchInput.rsScore) : '—' });
    }
  }

  return (
    <div className="lookup-derived">
      <h3 className="lookup-derived-title">Avledet fra pasientdata</h3>
      <div className="lookup-derived-chips">
        {chips.map((c) => (
          <div key={c.label} className="lookup-derived-chip">
            <span className="lookup-derived-key">{c.label}</span>
            <span className="lookup-derived-val">{c.value}</span>
          </div>
        ))}
      </div>

      {luminalRelevant && (
        <div className="lookup-derived-luminal">
          <label htmlFor="lk-lum-override">Luminal-liknende gruppe</label>
          <select id="lk-lum-override" value={luminalOverride || matchInput.luminalLike} onChange={(e) => setLuminalOverride(e.target.value)}>
            <option value="">— Ikke valgt —</option>
            <option value="A">Lum A-liknende</option>
            <option value="B">LumB-liknende</option>
            <option value="inconclusive">Ikke konklusiv Luminal gruppe</option>
          </select>
          {luminalSuggestion && (
            <p className="lookup-suggestion">
              Forslag fra deriverte verdier: <strong>{LUMINAL_LABEL[luminalSuggestion.value] || luminalSuggestion.label}</strong>. {luminalSuggestion.explanation}
              {luminalOverride && luminalOverride !== luminalSuggestion.value && ' (overstyrt manuelt)'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ================================================================
//  Treff-oppsummering
// ================================================================

function MatchSummary({ relevantTables, matchesByTable, bioGroup }) {
  if (!bioGroup) {
    return (
      <div className="lookup-summary lookup-summary-empty">
        Klarte ikke å avlede biologisk undergruppe fra inndata (sjekk ER/PR- og HER2-status).
      </div>
    );
  }

  const anyHit = matchesByTable.some((m) => m.length > 0);
  if (!anyHit) {
    return (
      <div className="lookup-summary lookup-summary-none">
        Ingen rad treffer i de relevante tabellene foreløpig. Fyll ut flere felt, eller pasienten faller
        utenfor disse tabellene (se handlingsprogrammet for f.eks. pT3/pT4 eller neoadjuvant situasjon).
      </div>
    );
  }

  return (
    <div className="lookup-summary lookup-summary-hit">
      <strong>Relevante tabeller for denne pasienten:</strong>
      {relevantTables.map(({ table, role }, ti) => {
        const matches = matchesByTable[ti];
        return (
          <div key={table.id} className="lookup-summary-block">
            <span className="lookup-summary-tablename">
              <span className="lookup-role-badge">{role}</span> {table.shortTitle}
            </span>
            {matches.length === 0 ? (
              <p className="lookup-summary-nomatch">Ingen treffende rad ennå — fyll ut flere felt.</p>
            ) : (
              <ul>
                {matches.map((i) => {
                  const cells = table.rows[i].cells;
                  const path = cells
                    .slice(0, table.mergeCount + 1)
                    .map((c) => c.replace(/\n/g, ' ').trim())
                    .filter(Boolean);
                  return <li key={i}>{path.join(' › ')}</li>;
                })}
              </ul>
            )}
            <span className="lookup-summary-source">Kilde: {table.source}</span>
          </div>
        );
      })}
    </div>
  );
}

// ================================================================
//  Interaktiv tabell med rowSpan og highlighting
// ================================================================

function LookupTable({ table, role, matches, edited, setEdited, copiedKey, setCopiedKey, isActive }) {
  const matchSet = useMemo(() => new Set(matches), [matches]);
  const spans = useMemo(() => computeSpans(table.rows, table.mergeCount), [table]);
  // Settet med kolonneindekser som utgjør anbefalingstekst
  const recColSet = useMemo(() => new Set((table.recCols || []).map((rc) => rc.idx)), [table]);
  const hasMatch = matches.length > 0;

  function keyFor(rowIdx) {
    return `${table.id}:${rowIdx}`;
  }

  function valueFor(rowIdx) {
    const k = keyFor(rowIdx);
    if (k in edited) return edited[k];
    return buildJournalText(table.rows[rowIdx], table.recCols);
  }

  async function copyText(rowIdx) {
    const text = valueFor(rowIdx);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyFor(rowIdx));
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignorerer clipboard-feil (kan blokkeres av nettleser) */
    }
  }

  return (
    <div className={`lookup-table-wrap ${isActive ? 'active' : ''} ${table.kind === 'addon' ? 'addon' : ''}`}>
      <h3 className="lookup-table-title">
        {role && <span className="lookup-role-badge">{role}</span>}
        {table.title}
      </h3>
      <div className="lookup-table-scroll">
        <table className="lookup-table">
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
              {hasMatch && <th className="lookup-journal-col">Foreslått journaltekst</th>}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => {
              const isHit = matchSet.has(rowIdx);
              return (
                <tr key={rowIdx} className={isHit ? 'lookup-row-hit' : ''}>
                  {row.cells.map((cell, colIdx) => {
                    // Sammenslåtte venstre-kolonner
                    if (colIdx < table.mergeCount) {
                      const span = spans[rowIdx][colIdx];
                      if (!span.render) return null;
                      return (
                        <td key={colIdx} rowSpan={span.span} className="lookup-cell-merge">
                          <MultilineText text={cell} />
                        </td>
                      );
                    }
                    const cls = recColSet.has(colIdx) ? 'lookup-cell-rec' : 'lookup-cell-rationale';
                    return (
                      <td key={colIdx} className={cls}>
                        <MultilineText text={cell} />
                      </td>
                    );
                  })}

                  {hasMatch && (
                    <td className="lookup-journal-cell">
                      {isHit ? (
                        <div className="lookup-journal-box">
                          <textarea
                            value={valueFor(rowIdx)}
                            onChange={(e) => setEdited((prev) => ({ ...prev, [keyFor(rowIdx)]: e.target.value }))}
                            rows={6}
                          />
                          <button type="button" className="lookup-copy-btn" onClick={() => copyText(rowIdx)}>
                            {copiedKey === keyFor(rowIdx) ? 'Kopiert!' : 'Kopier tekst'}
                          </button>
                        </div>
                      ) : (
                        <span className="lookup-journal-empty" aria-hidden="true" />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {table.footnotes && table.footnotes.length > 0 && (
        <div className="lookup-footnotes">
          {table.footnotes.map((f, i) => (
            <p key={i}>{f}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// Bygger standard journaltekst-utgangspunkt fra en rad ut fra tabellens
// anbefalingskolonner (recCols). Kolonner med label prefikses (f.eks.
// "Ribociklib: ...") slik at tabeller med flere anbefalingskolonner
// (som CDK4/6) gir meningsfull tekst.
function buildJournalText(row, recCols) {
  const cols = recCols && recCols.length ? recCols : [{ idx: row.cells.length - 2 }];
  return cols
    .map((rc) => {
      const v = (row.cells[rc.idx] || '').trim();
      if (!v) return '';
      return rc.label ? `${rc.label}: ${v}` : v;
    })
    .filter(Boolean)
    .join('\n');
}

// ================================================================
//  Referansedokument (narrativ tekst, f.eks. endokrin behandling)
// ================================================================

function ReferenceDoc({ doc, copiedKey, setCopiedKey }) {
  const copyKey = `doc:${doc.id}`;

  function fullText() {
    const parts = [doc.title];
    if (doc.intro) parts.push(doc.intro);
    for (const s of doc.sections) {
      parts.push(`${s.heading}\n${s.text}`);
    }
    return parts.join('\n\n');
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText());
      setCopiedKey(copyKey);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* clipboard kan være blokkert */
    }
  }

  return (
    <details className="lookup-doc" open>
      <summary>
        <span className="lookup-role-badge">Tekstdokument</span>
        {doc.shortTitle}
      </summary>
      <div className="lookup-doc-body">
        <p className="lookup-doc-fulltitle">{doc.title}</p>
        {doc.intro && <p className="lookup-doc-intro">{doc.intro}</p>}
        {doc.sections.map((s, i) => (
          <div key={i} className="lookup-doc-section">
            <h4>{s.heading}</h4>
            <p>
              <MultilineText text={s.text} />
            </p>
          </div>
        ))}
        <div className="lookup-doc-foot">
          <button type="button" className="lookup-copy-btn" onClick={copyAll}>
            {copiedKey === copyKey ? 'Kopiert!' : 'Kopier hele dokumentet'}
          </button>
          <span className="lookup-summary-source">Kilde: {doc.source}</span>
        </div>
      </div>
    </details>
  );
}

function MultilineText({ text }) {
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

// ----------------------------------------------------------------
//  Beregner rowSpan for de sammenslåtte venstre-kolonnene.
//  En celle i kolonne c starter et nytt spenn hvis raden er første,
//  eller hvis en av kolonnene 0..c skiller seg fra forrige rad.
// ----------------------------------------------------------------
function computeSpans(rows, mergeCount) {
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

// Sant hvis cellene 0..c er identiske i to rader (for nested merge).
function sameUpTo(cellsA, cellsB, c) {
  for (let i = 0; i <= c; i++) {
    if (cellsA[i] !== cellsB[i]) return false;
  }
  return true;
}
