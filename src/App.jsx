import React, { useState, useEffect } from 'react';
import PatientForm from './components/PatientForm.jsx';
import DecisionResult from './components/DecisionResult.jsx';
import DecisionTableViewer from './components/DecisionTableViewer.jsx';
import InteractiveDecisionTree from './components/InteractiveDecisionTree.jsx';
import './styles.css';

// I produksjon (Vercel) finnes ikke skrive-/admin-endepunktene — skjul UI som
// ellers ville feilet stille. Redigering skjer kun i lokalt utviklingsmiljø.
const IS_PROD = import.meta.env.PROD;

export default function App() {
  const [page, setPage] = useState('form'); // 'form' | 'tables' | 'tree'
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modStatus, setModStatus] = useState(null);
  const [algSets, setAlgSets] = useState([]);
  const [showAlgPanel, setShowAlgPanel] = useState(false);
  const [algName, setAlgName] = useState('');
  const [algDesc, setAlgDesc] = useState('');
  const [compareResult, setCompareResult] = useState(null);

  // Hent modifikasjonsstatus ved oppstart og etter endringer
  useEffect(() => {
    fetchModStatus();
    fetchAlgSets();
  }, [page]);

  async function fetchModStatus() {
    try {
      const res = await fetch('/api/modification-status');
      if (res.ok) setModStatus(await res.json());
    } catch {}
  }

  async function fetchAlgSets() {
    try {
      const res = await fetch('/api/algorithm-sets');
      if (res.ok) setAlgSets(await res.json());
    } catch {}
  }

  async function handleEvaluate(patientData) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientData),
      });

      if (!response.ok) {
        let errorMessage = `Serverfeil (${response.status})`;
        try {
          const ct = response.headers.get('content-type');
          if (ct && ct.includes('application/json')) {
            const err = await response.json();
            errorMessage = err.details?.join(', ') || err.error || errorMessage;
          }
        } catch {}
        throw new Error(errorMessage);
      }

      const ct = response.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        throw new Error('Uventet svarformat fra server (forventet JSON)');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'En ukjent feil oppstod ved evaluering');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAlgSet() {
    if (!algName.trim()) return;
    try {
      const res = await fetch('/api/algorithm-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: algName, description: algDesc }),
      });
      if (res.ok) {
        setAlgName('');
        setAlgDesc('');
        fetchAlgSets();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (err) { alert(err.message); }
  }

  async function handleActivateAlgSet(id) {
    if (!confirm('Aktivere dette algoritmesettet? Nåværende tabeller vil bli overskrevet.')) return;
    try {
      const res = await fetch(`/api/algorithm-sets/${id}/activate`, { method: 'POST' });
      if (res.ok) { fetchModStatus(); alert('Algoritmesett aktivert'); }
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteAlgSet(id) {
    if (!confirm('Slette dette algoritmesettet permanent?')) return;
    try {
      const res = await fetch(`/api/algorithm-sets/${id}`, { method: 'DELETE' });
      if (res.ok) fetchAlgSets();
    } catch (err) { alert(err.message); }
  }

  async function handleCompare(idA, idB) {
    try {
      const res = await fetch(`/api/algorithm-sets/compare/${idA}/${idB}`);
      if (res.ok) setCompareResult(await res.json());
    } catch (err) { alert(err.message); }
  }

  async function handleExportTables() {
    try {
      const res = await fetch('/api/export/tables');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beslutningsregler-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message); }
  }

  function handleImportTables(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const tables = data.tables || data;
        const res = await fetch('/api/import/tables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables }),
        });
        const result = await res.json();
        alert(result.message || result.error);
        fetchModStatus();
      } catch (err) { alert('Ugyldig fil: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Brystkreft Retningslinjegraver</h1>
        <p className="subtitle">
          Adjuvant behandlingsprotokoll per{' '}
          <a href="https://nbcg.no/retningslinjer-2/retningslinjer/" target="_blank" rel="noopener noreferrer" className="nbcg-link">
            NBCG Handlingsprogram
          </a>
        </p>
        <p className="guideline-version">
          Innhold verifisert mot NBCG Handlingsprogram mars 2025 (+ tabeller 17.12.24 / 04.09.25 / 15.11.23).
          NBCG oppdaterer jevnlig — kontroller mot gjeldende versjon på nbcg.no før klinisk bruk.
        </p>
        <nav className="nav">
          <button
            className={`nav-btn ${page === 'form' ? 'active' : ''}`}
            onClick={() => setPage('form')}
          >
            Pasientvurdering
          </button>
          <button
            className={`nav-btn ${page === 'tree' ? 'active' : ''}`}
            onClick={() => setPage('tree')}
          >
            Beslutningstre
          </button>
          <button
            className={`nav-btn ${page === 'tables' ? 'active' : ''}`}
            onClick={() => setPage('tables')}
          >
            Beslutningslogikk
          </button>
        </nav>
      </header>

      {/* Varselbanner for endrede algoritmer — vises på forsiden */}
      {modStatus?.hasModifications && (
        <div className="mod-warning-banner">
          <strong>Endrede algoritmer:</strong> {modStatus.totalModifiedTables} tabell(er) avviker fra standard.
          <ul className="mod-warning-list">
            {modStatus.modifiedTables.map((t) => (
              <li key={t.tableId}>
                <strong>{t.tableName}</strong> — {t.modifiedRuleCount} endrede regler
                {t.lastChange && <span className="mod-change-time"> (sist: {new Date(t.lastChange.timestamp).toLocaleDateString('nb-NO')})</span>}
              </li>
            ))}
          </ul>
          <button className="mod-view-btn" onClick={() => setPage('tables')}>Vis i beslutningslogikk</button>
        </div>
      )}

      <main className="main">
        {page === 'form' && (
          <>
            {/* Algoritmesett-panel — kun i lokalt miljø (skrive-endepunkter finnes ikke i prod) */}
            {!IS_PROD && (
              <div className="alg-toolbar">
                <button className="alg-toggle-btn" onClick={() => setShowAlgPanel(!showAlgPanel)}>
                  {showAlgPanel ? 'Skjul' : 'Algoritmesett'}
                </button>
                <button className="alg-export-btn" onClick={handleExportTables}>Eksporter regler</button>
                <label className="alg-import-btn">
                  Importer regler
                  <input type="file" accept=".json" onChange={handleImportTables} hidden />
                </label>
              </div>
            )}

            {!IS_PROD && showAlgPanel && (
              <div className="alg-panel">
                <h3>Lagrede algoritmesett</h3>
                <p className="alg-desc">Lagre nåværende regelsett med navn for å kunne bytte mellom versjoner og sammenligne.</p>
                <div className="alg-save-row">
                  <input type="text" placeholder="Navn (f.eks. Mars 25 + CDK4 høst 25)" value={algName} onChange={(e) => setAlgName(e.target.value)} className="alg-name-input" />
                  <input type="text" placeholder="Beskrivelse (valgfritt)" value={algDesc} onChange={(e) => setAlgDesc(e.target.value)} className="alg-desc-input" />
                  <button onClick={handleSaveAlgSet} disabled={!algName.trim()} className="alg-save-btn">Lagre nåværende</button>
                </div>

                {algSets.length > 0 ? (
                  <table className="alg-table">
                    <thead>
                      <tr>
                        <th>Navn</th>
                        <th>Beskrivelse</th>
                        <th>Opprettet</th>
                        <th>Tabeller</th>
                        <th>Handlinger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {algSets.map((s) => (
                        <tr key={s.id}>
                          <td><strong>{s.name}</strong></td>
                          <td>{s.description || '—'}</td>
                          <td>{new Date(s.createdAt).toLocaleDateString('nb-NO')}</td>
                          <td>{s.tableCount}</td>
                          <td className="alg-actions">
                            <button onClick={() => handleActivateAlgSet(s.id)}>Aktiver</button>
                            <button onClick={() => handleCompare('current', s.id)}>Sammenlign</button>
                            <button className="alg-delete-btn" onClick={() => handleDeleteAlgSet(s.id)}>Slett</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="alg-empty">Ingen lagrede algoritmesett ennå.</p>
                )}

                {compareResult && (
                  <div className="alg-compare-result">
                    <h4>Sammenligning: {compareResult.nameA} vs. {compareResult.nameB}</h4>
                    {compareResult.totalDifferences === 0 ? (
                      <p className="alg-no-diff">Ingen forskjeller funnet.</p>
                    ) : (
                      <ul className="alg-diff-list">
                        {compareResult.differences.map((d, i) => (
                          <li key={i}>
                            <strong>{d.tableName || d.tableId}</strong>: {
                              d.type === 'only_in_a' ? 'Kun i ' + compareResult.nameA :
                              d.type === 'only_in_b' ? 'Kun i ' + compareResult.nameB :
                              d.type === 'rule_count' ? `Ulikt antall regler (${d.countA} vs ${d.countB})` :
                              `${d.ruleChanges?.length || 0} regelendringer`
                            }
                          </li>
                        ))}
                      </ul>
                    )}
                    <button onClick={() => setCompareResult(null)}>Lukk</button>
                  </div>
                )}
              </div>
            )}

            <PatientForm onSubmit={handleEvaluate} loading={loading} onShowTables={() => setPage('tables')} />

            {error && (
              <div className="error-banner">
                <strong>Feil:</strong> {error}
              </div>
            )}

            {result && <DecisionResult result={result} />}
          </>
        )}

        {page === 'tree' && <InteractiveDecisionTree />}

        {page === 'tables' && <DecisionTableViewer />}
      </main>

      <footer className="app-footer">
        <p>
          BPM+ Health-arkitektur: CQL (datahenting) + DMN (beslutningslogikk) | mCODE/FHIR-kompatibel
        </p>
        <p className="disclaimer">
          Kun for å visualisere råd ifra handlingsprogrammet til NBCG og generere journaltekst. Kan tilpasses lokalt, men er kun for å forkorte arbeidstid. Dette er ingen beslutningstøtte — det er viktig å kritisk vurdere tekst samt sjekke siste versjon av handlingsprogram.
        </p>
      </footer>
    </div>
  );
}
