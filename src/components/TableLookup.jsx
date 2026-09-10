import React, { useState, useMemo } from 'react';
import {
  tableGeneTest,
  tableNoGeneTest,
  addonTables,
  sharedRegimens,
} from '../tablelookup/guidelineTables.js';
import { findMatchingRows, classifyLuminalLike, simplifyT } from '../tablelookup/matcher.js';
import { buildJournalText } from '../tablelookup/journalText.js';
import { MultilineText, computeSpans } from '../tablelookup/tableGrid.jsx';

// ================================================================
//  Tabelloppslag — ny fane (endrer ikke det eksisterende verktøyet)
// ================================================================
//
//  I motsetning til "Pasientvurdering"/"Beslutningstre" gir denne
//  fanen INGEN algoritmisk anbefaling. Den slår kun opp hvor i de
//  offisielle NBCG-tabellene pasienten hører hjemme, highlighter
//  riktig rad, og tilbyr den ordrette tabellteksten som redigerbart
//  utgangspunkt for journaltekst.
// ================================================================

const EMPTY_INPUT = {
  bioGroup: '',
  tStage: '',
  nStage: '',
  menopausal: '',
  geneTestAvailable: false,
  geneTest: '',
  prosignaSubtype: '',
  rorScore: '',
  rsScore: '',
  ki67: '',
  grade: '',
  hrPercent: '',
};

export default function TableLookup() {
  const [input, setInput] = useState(EMPTY_INPUT);
  const [luminalOverride, setLuminalOverride] = useState(''); // manuell overstyring av luminal-liknende gruppe
  const [edited, setEdited] = useState({}); // redigert journaltekst: key = `${tableId}:${rowIdx}`
  const [copiedKey, setCopiedKey] = useState(null);

  function update(field, value) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  // Foreslått luminal-liknende klassifisering (kun relevant uten gentest, HR+HER2-)
  const luminalSuggestion = useMemo(
    () => classifyLuminalLike({ ki67: input.ki67, grade: input.grade, hrPercent: input.hrPercent }),
    [input.ki67, input.grade, input.hrPercent]
  );
  const effectiveLuminal = luminalOverride || luminalSuggestion?.value || '';

  // Input som sendes til matcheren (med effektiv luminal-gruppe + forenklet T innbakt)
  const matchInput = useMemo(
    () => ({ ...input, luminalLike: effectiveLuminal, tSimple: simplifyT(input.tStage) }),
    [input, effectiveLuminal]
  );

  // Primærtabell avhenger av om gentest foreligger
  const primaryTable = input.geneTestAvailable ? tableGeneTest : tableNoGeneTest;
  const otherTable = input.geneTestAvailable ? tableNoGeneTest : tableGeneTest;

  // Tilleggstabeller (f.eks. CDK4/6) som er relevante for denne pasienten samtidig.
  // En pasient kan dermed få flere relevante tabeller vist på én gang.
  const relevantTables = useMemo(() => {
    const list = [{ table: primaryTable, role: 'Primæranbefaling' }];
    for (const addon of addonTables) {
      if (!addon.appliesToBioGroups || addon.appliesToBioGroups.includes(input.bioGroup)) {
        list.push({ table: addon, role: 'Tilleggsbehandling' });
      }
    }
    return list;
  }, [primaryTable, input.bioGroup]);

  // Treff per relevant tabell
  const matchesByTable = useMemo(
    () => relevantTables.map(({ table }) => findMatchingRows(table, matchInput)),
    [relevantTables, matchInput]
  );

  function resetAll() {
    setInput(EMPTY_INPUT);
    setLuminalOverride('');
    setEdited({});
  }

  return (
    <div className="lookup">
      <div className="lookup-intro">
        <h2>Tabelloppslag</h2>
        <p>
          Dette verktøyet gir <strong>ingen algoritmisk anbefaling</strong>. Det viser hvor i de
          offisielle NBCG-tabellene pasienten hører hjemme basert på inndata, highlighter riktig rad,
          og lar deg kopiere den ordrette tabellteksten som utgangspunkt for journaltekst (kan
          tilpasses per rad). All tolkning og endelig vurdering gjøres av klinikeren mot gjeldende
          handlingsprogram.
        </p>
        <p>
          <strong>Flere tabeller kan være relevante for samme pasient.</strong> For HR-positiv,
          HER2-negativ sykdom vises i tillegg tabellen for adjuvant CDK4/6-hemmer som mulig
          tilleggsbehandling.
        </p>
      </div>

      {/* ---------------- Inndata ---------------- */}
      <div className="lookup-form">
        <div className="lookup-field lookup-field-toggle">
          <span className="lookup-label">Genekspresjonstest foreligger?</span>
          <div className="lookup-segmented">
            <button
              type="button"
              className={!input.geneTestAvailable ? 'active' : ''}
              onClick={() => update('geneTestAvailable', false)}
            >
              Nei / ikke utført
            </button>
            <button
              type="button"
              className={input.geneTestAvailable ? 'active' : ''}
              onClick={() => update('geneTestAvailable', true)}
            >
              Ja
            </button>
          </div>
        </div>

        <div className="lookup-field">
          <label htmlFor="lk-bio">Hovedgruppe (HR/HER2)</label>
          <select id="lk-bio" value={input.bioGroup} onChange={(e) => update('bioGroup', e.target.value)}>
            <option value="">— Velg —</option>
            <option value="HR+HER2-">HR+ HER2-</option>
            <option value="HR+HER2+">HR+ HER2+</option>
            <option value="HR-HER2+">HR- HER2+</option>
            <option value="HR-HER2-">HR- HER2- (trippel negativ)</option>
          </select>
        </div>

        <div className="lookup-field">
          <label htmlFor="lk-t">T-stadium (patologisk)</label>
          <select id="lk-t" value={input.tStage} onChange={(e) => update('tStage', e.target.value)}>
            <option value="">— Velg —</option>
            <option value="T0">T0 (ingen påvist tumor)</option>
            <option value="pT1a">pT1a</option>
            <option value="pT1b">pT1b</option>
            <option value="pT1c">pT1c</option>
            <option value="pT2">pT2</option>
            <option value="pT3">pT3</option>
            <option value="pT4">pT4</option>
          </select>
        </div>

        <div className="lookup-field">
          <label htmlFor="lk-n">N-stadium (patologisk)</label>
          <select id="lk-n" value={input.nStage} onChange={(e) => update('nStage', e.target.value)}>
            <option value="">— Velg —</option>
            <option value="pN0">pN0</option>
            <option value="pN1">pN1</option>
            <option value="pN2">pN2</option>
            <option value="pN3">pN3</option>
          </select>
        </div>

        <div className="lookup-field">
          <label htmlFor="lk-meno">Menopausal status</label>
          <select id="lk-meno" value={input.menopausal} onChange={(e) => update('menopausal', e.target.value)}>
            <option value="">— Velg —</option>
            <option value="pre">Premenopausal</option>
            <option value="post">Postmenopausal</option>
          </select>
        </div>

        {/* Gentest-spesifikke felt */}
        {input.geneTestAvailable && (
          <>
            <div className="lookup-field">
              <label htmlFor="lk-gt">Genekspresjonstest</label>
              <select id="lk-gt" value={input.geneTest} onChange={(e) => update('geneTest', e.target.value)}>
                <option value="">— Velg —</option>
                <option value="prosigna">Prosigna (ROR)</option>
                <option value="oncotypedx">OncotypeDx (RS)</option>
              </select>
            </div>

            {input.geneTest === 'prosigna' && (
              <>
                <div className="lookup-field">
                  <label htmlFor="lk-ror">Prosigna ROR-score</label>
                  <input
                    id="lk-ror"
                    type="number"
                    value={input.rorScore}
                    onChange={(e) => update('rorScore', e.target.value)}
                    placeholder="0–100"
                  />
                </div>
                <div className="lookup-field">
                  <label htmlFor="lk-sub">Molekylær subtype (PAM50)</label>
                  <select id="lk-sub" value={input.prosignaSubtype} onChange={(e) => update('prosignaSubtype', e.target.value)}>
                    <option value="">— Velg (brukes ved ROR 41–60) —</option>
                    <option value="lumA">Luminal A</option>
                    <option value="lumB">Luminal B</option>
                  </select>
                </div>
              </>
            )}

            {input.geneTest === 'oncotypedx' && (
              <div className="lookup-field">
                <label htmlFor="lk-rs">OncotypeDx RS-score</label>
                <input
                  id="lk-rs"
                  type="number"
                  value={input.rsScore}
                  onChange={(e) => update('rsScore', e.target.value)}
                  placeholder="0–100"
                />
              </div>
            )}
          </>
        )}

        {/* Luminal-liknende klassifisering — kun uten gentest og HR+HER2- */}
        {!input.geneTestAvailable && input.bioGroup === 'HR+HER2-' && (
          <>
            <div className="lookup-field">
              <label htmlFor="lk-ki">Ki67 (%)</label>
              <input id="lk-ki" type="number" value={input.ki67} onChange={(e) => update('ki67', e.target.value)} placeholder="%" />
            </div>
            <div className="lookup-field">
              <label htmlFor="lk-grade">Histologisk grad</label>
              <select id="lk-grade" value={input.grade} onChange={(e) => update('grade', e.target.value)}>
                <option value="">— Velg —</option>
                <option value="1">Grad 1</option>
                <option value="2">Grad 2</option>
                <option value="3">Grad 3</option>
              </select>
            </div>
            <div className="lookup-field">
              <label htmlFor="lk-hr">HR-ekspresjon (%)</label>
              <input id="lk-hr" type="number" value={input.hrPercent} onChange={(e) => update('hrPercent', e.target.value)} placeholder="%" />
            </div>
            <div className="lookup-field lookup-field-wide">
              <label htmlFor="lk-lum">Luminal-liknende gruppe</label>
              <select id="lk-lum" value={effectiveLuminal} onChange={(e) => setLuminalOverride(e.target.value)}>
                <option value="">— Ikke valgt —</option>
                <option value="A">Lum A-liknende</option>
                <option value="B">LumB-liknende</option>
                <option value="inconclusive">Ikke konklusiv Luminal gruppe</option>
              </select>
              {luminalSuggestion && (
                <p className="lookup-suggestion">
                  Forslag basert på input: <strong>{luminalSuggestion.label}</strong>. {luminalSuggestion.explanation}
                  {luminalOverride && luminalOverride !== luminalSuggestion.value && ' (overstyrt manuelt)'}
                </p>
              )}
            </div>
          </>
        )}

        <div className="lookup-field lookup-actions">
          <button type="button" className="lookup-reset" onClick={resetAll}>Nullstill</button>
        </div>
      </div>

      {/* ---------------- Treff-oppsummering (alle relevante tabeller) ---------------- */}
      <MatchSummary relevantTables={relevantTables} matchesByTable={matchesByTable} bioGroup={input.bioGroup} />

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

      {/* ---------------- Den andre primærtabellen (referanse) ---------------- */}
      <details className="lookup-other">
        <summary>Vis også: {otherTable.shortTitle} (referanse, ingen highlight)</summary>
        <LookupTable table={otherTable} matches={[]} edited={edited} setEdited={setEdited} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
      </details>

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
//  Treff-oppsummering
// ================================================================

function MatchSummary({ relevantTables, matchesByTable, bioGroup }) {
  if (!bioGroup) {
    return <div className="lookup-summary lookup-summary-empty">Velg minst hovedgruppe for å slå opp i tabellen(e).</div>;
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
