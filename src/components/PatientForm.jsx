import React, { useState } from 'react';
import {
  INITIAL_STATE,
  applyFieldChange,
  normalizePatientData,
  deriveFormVisibility,
} from '../clinical/patientFields.js';

/**
 * Pasientskjema.
 *
 * Ukontrollert som standard (Pasientvurdering-siden). Sendes `value` og
 * `onChange` inn, blir skjemaet kontrollert av forelderen — det er slik
 * Tabelloppslag 2.0 gjenbruker de samme feltene i venstre kolonne, uten at
 * feltlogikken må skrives to ganger. `embedded` skjuler overskrift og
 * submit-knapp for bruk inne i en annen arbeidsflate.
 */
export default function PatientForm({ onSubmit, loading, onShowTables, value, onChange, embedded }) {
  const [internalForm, setInternalForm] = useState(INITIAL_STATE);
  const isControlled = value != null && typeof onChange === 'function';
  const form = isControlled ? value : internalForm;

  function handleChange(e) {
    const { name, value: fieldValue } = e.target;
    if (isControlled) {
      onChange(applyFieldChange(form, name, fieldValue));
    } else {
      setInternalForm((prev) => applyFieldChange(prev, name, fieldValue));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(normalizePatientData(form));
  }

  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    isNeoadjuvant,
    showSISH,
    showGeneTestSection,
    showProsignaOption,
    showOncotypeOption,
    showProsigna,
    showOncotype,
  } = deriveFormVisibility(form);

  return (
    <form className="patient-form" onSubmit={handleSubmit} noValidate>
      {!embedded && <h2>Pasientdata — Brystkreft Retningslinjegraver</h2>}

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
              <option value="">Ikke angitt</option>
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
              <option value="">Ikke angitt</option>
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
              <option value="">Velg …</option>
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

      {!embedded && (
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Evaluerer...' : 'Evaluer behandlingsvalg'}
        </button>
      )}

      {!embedded && onShowTables && (
        <p className="tables-link">
          <a href="#beslutningslogikk" onClick={(e) => { e.preventDefault(); onShowTables(); }}>
            Vis bakenforliggende beslutningsstruktur
          </a>
        </p>
      )}
    </form>
  );
}
