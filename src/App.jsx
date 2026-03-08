import React, { useState } from 'react';
import PatientForm from './components/PatientForm.jsx';
import DecisionResult from './components/DecisionResult.jsx';
import DecisionTableViewer from './components/DecisionTableViewer.jsx';
import './styles.css';

export default function App() {
  const [page, setPage] = useState('form'); // 'form' | 'tables'
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
        const err = await response.json();
        throw new Error(err.details?.join(', ') || err.error || 'Ukjent feil');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Brystkreft Beslutningsstøtte</h1>
        <p className="subtitle">Adjuvant behandlingsprotokoll per NBCG Handlingsprogram</p>
        <nav className="nav">
          <button
            className={`nav-btn ${page === 'form' ? 'active' : ''}`}
            onClick={() => setPage('form')}
          >
            Pasientvurdering
          </button>
          <button
            className={`nav-btn ${page === 'tables' ? 'active' : ''}`}
            onClick={() => setPage('tables')}
          >
            Beslutningslogikk
          </button>
        </nav>
      </header>

      <main className="main">
        {page === 'form' && (
          <>
            <PatientForm onSubmit={handleEvaluate} loading={loading} />

            {error && (
              <div className="error-banner">
                <strong>Feil:</strong> {error}
              </div>
            )}

            {result && <DecisionResult result={result} />}
          </>
        )}

        {page === 'tables' && <DecisionTableViewer />}
      </main>

      <footer className="app-footer">
        <p>
          BPM+ Health-arkitektur: CQL (datahenting) + DMN (beslutningslogikk) | mCODE/FHIR-kompatibel
        </p>
        <p className="disclaimer">
          Kun for klinisk beslutningsstøtte. Erstatter ikke klinisk skjønn.
        </p>
      </footer>
    </div>
  );
}
