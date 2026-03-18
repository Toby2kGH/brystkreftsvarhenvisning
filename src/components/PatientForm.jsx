import React, { useState } from 'react';

const INITIAL_STATE = {
  treatmentMode: 'adjuvant',
  // Receptor
  erStatus: 'positive',
  erPercent: '',
  prStatus: 'positive',
  prPercent: '',
  // HER2
  her2ihc: '',
  her2sish: '',
  // Tumor
  ki67: '',
  grade: '',
  tumorSizeMm: '',
  tStageOverride: '',
  nStage: 'N0',
  histologicalType: '',
  // Gene expression
  geneTest: 'none',
  rorScore: '',
  rsScore: '',
  prosignaSubtype: '',
  // Patient
  menopausalStatus: 'post',
  age: '',
  surgeryType: 'bcs',
  // BRCA
  brcaStatus: 'not_tested',
  // Post-neoadjuvant
  pcrStatus: '',
};

export default function PatientForm({ onSubmit, loading, onShowTables }) {
  const [form, setForm] = useState(INITIAL_STATE);

  function handleChange(e) {
    setForm((prev) => {
      const next = { ...prev, [e.target.name]: e.target.value };
      // Reset gene test when switching to neoadjuvant (gene tests not relevant)
      if (e.target.name === 'treatmentMode' && e.target.value === 'neoadjuvant') {
        next.geneTest = 'none';
        next.rorScore = '';
        next.rsScore = '';
        next.prosignaSubtype = '';
      }
      // Reset gene test if current selection becomes unavailable
      if (['nStage', 'tumorSizeMm', 'tStageOverride', 'menopausalStatus'].includes(e.target.name)) {
        const isT3 = next.tStageOverride === 'T4' || (next.tumorSizeMm !== '' && Number(next.tumorSizeMm) > 50);
        const isN1Plus = ['N1', 'N2', 'N3'].includes(next.nStage);
        if (next.geneTest === 'prosigna' && (isT3 || isN1Plus)) {
          next.geneTest = 'none';
          next.rorScore = '';
          next.prosignaSubtype = '';
        }
        if (next.geneTest === 'oncotypedx' && !(isN1Plus && next.menopausalStatus === 'post')) {
          next.geneTest = 'none';
          next.rsScore = '';
        }
      }
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Convert numeric fields
    const data = {
      ...form,
      erPercent: form.erPercent !== '' ? Number(form.erPercent) : undefined,
      prPercent: form.prPercent !== '' ? Number(form.prPercent) : undefined,
      ki67: form.ki67 !== '' ? Number(form.ki67) : undefined,
      grade: form.grade !== '' ? Number(form.grade) : undefined,
      tumorSizeMm: form.tumorSizeMm !== '' ? Number(form.tumorSizeMm) : undefined,
      age: form.age !== '' ? Number(form.age) : undefined,
      rorScore: form.rorScore !== '' ? Number(form.rorScore) : undefined,
      rsScore: form.rsScore !== '' ? Number(form.rsScore) : undefined,
      tStageOverride: form.tStageOverride || undefined,
      her2ihc: form.her2ihc || undefined,
      her2sish: form.her2sish || undefined,
      geneTest: form.geneTest || undefined,
      prosignaSubtype: form.prosignaSubtype || undefined,
      brcaStatus: form.brcaStatus || undefined,
      histologicalType: form.histologicalType || undefined,
      pcrStatus: form.pcrStatus || undefined,
    };
    onSubmit(data);
  }

  const [showAdvanced, setShowAdvanced] = useState(false);

  const isNeoadjuvant = form.treatmentMode === 'neoadjuvant';
  const showSISH = form.her2ihc === '2+';
  const isT3orHigher = form.tStageOverride === 'T4' || (form.tumorSizeMm !== '' && Number(form.tumorSizeMm) > 50);
  const isN1orHigher = ['N1', 'N2', 'N3'].includes(form.nStage);
  const showGeneTestSection = !isNeoadjuvant;
  const showProsignaOption = !isT3orHigher && !isN1orHigher;
  const showOncotypeOption = isN1orHigher && form.menopausalStatus === 'post';
  const showProsigna = form.geneTest === 'prosigna' && showProsignaOption;
  const showOncotype = form.geneTest === 'oncotypedx' && showOncotypeOption;

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <h2>Pasientdata — Brystkreft Retningslinjegraver</h2>

      {/* Treatment Mode */}
      <fieldset>
        <legend>Behandlingsmodus</legend>
        <div className="form-row">
          <label>
            Modus
            <select name="treatmentMode" value={form.treatmentMode} onChange={handleChange}>
              <option value="adjuvant">Adjuvant (postoperativ)</option>
              <option value="neoadjuvant">Neoadjuvant (preoperativ)</option>
              <option value="post-neoadjuvant">Postneoadjuvant (etter neoadjuvant)</option>
            </select>
          </label>
          {!isNeoadjuvant && (
            <label>
              Kirurgitype
              <select name="surgeryType" value={form.surgeryType} onChange={handleChange}>
                <option value="bcs">Brystbevarende (BCS)</option>
                <option value="mastectomy">Mastektomi</option>
                <option value="">Ikke angitt</option>
              </select>
            </label>
          )}
        </div>
      </fieldset>

      {/* Receptor Status */}
      <fieldset>
        <legend>Reseptorstatus</legend>
        <div className="form-row">
          <label>
            ER %
            <input type="number" name="erPercent" value={form.erPercent} onChange={handleChange}
              min="0" max="100" placeholder="%" />
          </label>
          <label>
            ER-status {form.erPercent !== '' ? <span className="derived-status">({Number(form.erPercent) > 10 ? 'Positiv' : Number(form.erPercent) >= 1 ? 'Lav-positiv → regnes negativ' : 'Negativ'})</span> : null}
            <select name="erStatus" value={form.erPercent !== '' ? (Number(form.erPercent) > 10 ? 'positive' : 'negative') : form.erStatus} onChange={handleChange} disabled={form.erPercent !== ''}>
              <option value="positive">Positiv</option>
              <option value="negative">Negativ</option>
            </select>
          </label>
          <label>
            PR %
            <input type="number" name="prPercent" value={form.prPercent} onChange={handleChange}
              min="0" max="100" placeholder="%" />
          </label>
          <label>
            PR-status
            <select name="prStatus" value={form.prStatus} onChange={handleChange}>
              <option value="positive">Positiv</option>
              <option value="negative">Negativ</option>
            </select>
          </label>
        </div>
        {form.erPercent !== '' && Number(form.erPercent) >= 1 && Number(form.erPercent) <= 10 && (
          <div className="field-warning">
            ER {form.erPercent}% er lav-positiv (1-10%). Regnes klinisk som ER-negativ iht. NBCG/St. Gallen.
          </div>
        )}
      </fieldset>

      {/* HER2 */}
      <fieldset>
        <legend>HER2-bestemmelse</legend>
        <div className="form-row">
          <label>
            HER2 IHC
            <select name="her2ihc" value={form.her2ihc} onChange={handleChange}>
              <option value="">Ikke angitt</option>
              <option value="0">0</option>
              <option value="1+">1+</option>
              <option value="2+">2+ (krever SISH)</option>
              <option value="3+">3+</option>
            </select>
          </label>
          {showSISH && (
            <label>
              HER2 SISH/ISH
              <select name="her2sish" value={form.her2sish} onChange={handleChange}>
                <option value="">Ikke utført</option>
                <option value="positive">Positiv (amplifisert)</option>
                <option value="negative">Negativ (ikke amplifisert)</option>
              </select>
            </label>
          )}
        </div>
      </fieldset>

      {/* Tumor Characteristics */}
      <fieldset>
        <legend>Tumorkarakteristikk</legend>
        <div className="form-row">
          <label>
            Tumorstørrelse (mm)
            <input type="number" name="tumorSizeMm" value={form.tumorSizeMm} onChange={handleChange}
              min="1" max="200" placeholder="mm" />
          </label>
          <label>
            T-stadium (override)
            <select name="tStageOverride" value={form.tStageOverride} onChange={handleChange}>
              <option value="">Beregn fra størrelse</option>
              <option value="T4">T4 (brystvegg/hud)</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Histologisk grad
            <select name="grade" value={form.grade} onChange={handleChange}>
              <option value="">Ikke angitt</option>
              <option value="1">Grad 1 (lav)</option>
              <option value="2">Grad 2 (intermediær)</option>
              <option value="3">Grad 3 (høy)</option>
            </select>
          </label>
          <label>
            Ki-67 (%)
            <input type="number" name="ki67" value={form.ki67} onChange={handleChange}
              min="0" max="100" placeholder="%" />
          </label>
        </div>
        <div className="form-row">
          <label>
            N-stadium (lymfeknuter)
            <select name="nStage" value={form.nStage} onChange={handleChange}>
              <option value="N0">N0 (ingen spredning)</option>
              <option value="N1mi">N1mi (mikrometastase)</option>
              <option value="N1">N1 (1-3 positive)</option>
              <option value="N2">N2 (4-9 positive)</option>
              <option value="N3">N3 (≥10 positive)</option>
            </select>
          </label>
        </div>
      </fieldset>

      {/* Gene Expression — hidden for neoadjuvant */}
      {showGeneTestSection && (
        <fieldset>
          <legend>Genekspresjonstest</legend>
          <div className="form-row">
            <label>
              Test
              <select name="geneTest" value={form.geneTest} onChange={handleChange}>
                <option value="none">Ingen / Ikke utført</option>
                {showProsignaOption && <option value="prosigna">Prosigna (PAM50)</option>}
                {showOncotypeOption && <option value="oncotypedx">OncotypeDX</option>}
              </select>
            </label>
            {showProsigna && (
              <>
                <label>
                  ROR-score
                  <input type="number" name="rorScore" value={form.rorScore} onChange={handleChange}
                    min="0" max="100" placeholder="0-100" />
                </label>
                <label>
                  PAM50 subtype
                  <select name="prosignaSubtype" value={form.prosignaSubtype} onChange={handleChange}>
                    <option value="">Ikke angitt</option>
                    <option value="lumA">Luminal A</option>
                    <option value="lumB">Luminal B</option>
                    <option value="her2enriched">HER2-enriched</option>
                    <option value="basallike">Basal-like</option>
                  </select>
                </label>
              </>
            )}
            {showOncotype && (
              <label>
                Recurrence Score (RS)
                <input type="number" name="rsScore" value={form.rsScore} onChange={handleChange}
                  min="0" max="100" placeholder="0-100" />
              </label>
            )}
          </div>
        </fieldset>
      )}

      {/* Patient Factors */}
      <fieldset>
        <legend>Pasientfaktorer</legend>
        <div className="form-row">
          <label>
            Menopausal status
            <select name="menopausalStatus" value={form.menopausalStatus} onChange={handleChange}>
              <option value="pre">Premenopausal</option>
              <option value="peri">Perimenopausal</option>
              <option value="post">Postmenopausal</option>
              <option value="unknown">Ukjent</option>
            </select>
          </label>
          <label>
            Alder
            <input type="number" name="age" value={form.age} onChange={handleChange}
              min="18" max="110" placeholder="år" />
          </label>
        </div>
      </fieldset>

      {/* Post-neoadjuvant: pCR — vises alltid når relevant */}
      {form.treatmentMode === 'post-neoadjuvant' && (
        <fieldset>
          <legend>Postneoadjuvant respons</legend>
          <div className="form-row">
            <label>
              pCR-status (patologisk komplett respons)
              <select name="pcrStatus" value={form.pcrStatus} onChange={handleChange}>
                <option value="">Ikke angitt</option>
                <option value="pCR">pCR (ingen residualtumor)</option>
                <option value="non-pCR">Non-pCR (residualtumor)</option>
              </select>
            </label>
          </div>
        </fieldset>
      )}

      {/* Avanserte/valgfrie felter — sammenleggbar */}
      <button
        type="button"
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? 'Skjul avanserte felter' : 'Vis avanserte felter (BRCA, histologi, ECOG ...)'}
      </button>

      {showAdvanced && (
        <>
          <fieldset>
            <legend>BRCA / Genetikk</legend>
            <div className="form-row">
              <label>
                BRCA-status
                <select name="brcaStatus" value={form.brcaStatus} onChange={handleChange}>
                  <option value="not_tested">Ikke testet</option>
                  <option value="BRCA1">BRCA1-mutasjon</option>
                  <option value="BRCA2">BRCA2-mutasjon</option>
                  <option value="negative">Negativ (ingen mutasjon)</option>
                  <option value="VUS">VUS (usikker variant)</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Histologisk type</legend>
            <div className="form-row">
              <label>
                Type
                <select name="histologicalType" value={form.histologicalType} onChange={handleChange}>
                  <option value="">Ikke angitt</option>
                  <option value="ductal">Duktalt karsinom (NST)</option>
                  <option value="lobular">Lobulart karsinom</option>
                  <option value="other">Annen type</option>
                </select>
              </label>
            </div>
          </fieldset>
        </>
      )}

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Evaluerer...' : 'Evaluer behandlingsvalg'}
      </button>

      {onShowTables && (
        <p className="tables-link">
          <a href="#beslutningslogikk" onClick={(e) => { e.preventDefault(); onShowTables(); }}>
            Vis bakenforliggende beslutningsstruktur
          </a>
        </p>
      )}
    </form>
  );
}
