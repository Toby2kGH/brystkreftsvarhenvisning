import React, { useState } from 'react';

const INITIAL_STATE = {
  erStatus: 'positive',
  prStatus: 'positive',
  her2Status: 'negative',
  ki67: '',
  ecogScore: '0',
  metastatic: 'yes',
  menopausalStatus: 'post',
  priorTherapyLines: '0',
  hepaticFunction: 'normal',
  renalFunction: 'normal',
  cardiacRisk: 'low',
  neutropeniaRisk: 'low',
  diarrhoeaRisk: 'low',
  needMonotherapy: 'no',
};

export default function PatientForm({ onSubmit, loading }) {
  const [form, setForm] = useState(INITIAL_STATE);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <h2>Pasientdata</h2>

      <fieldset>
        <legend>Tumorkarakteristikk</legend>

        <div className="form-row">
          <label>
            Østrogenreseptor (ER)
            <select name="erStatus" value={form.erStatus} onChange={handleChange}>
              <option value="positive">Positiv</option>
              <option value="negative">Negativ</option>
            </select>
          </label>

          <label>
            Progesteronreseptor (PR)
            <select name="prStatus" value={form.prStatus} onChange={handleChange}>
              <option value="positive">Positiv</option>
              <option value="negative">Negativ</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            HER2-status
            <select name="her2Status" value={form.her2Status} onChange={handleChange}>
              <option value="negative">Negativ</option>
              <option value="positive">Positiv</option>
            </select>
          </label>

          <label>
            Ki-67 (%)
            <input
              type="number"
              name="ki67"
              value={form.ki67}
              onChange={handleChange}
              min="0"
              max="100"
              placeholder="f.eks. 25"
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Pasientstatus</legend>

        <div className="form-row">
          <label>
            Metastatisk sykdom
            <select name="metastatic" value={form.metastatic} onChange={handleChange}>
              <option value="yes">Ja</option>
              <option value="no">Nei</option>
            </select>
          </label>

          <label>
            ECOG funksjonsstatus
            <select name="ecogScore" value={form.ecogScore} onChange={handleChange}>
              <option value="0">0 - Fullt aktiv</option>
              <option value="1">1 - Begrenset fysisk</option>
              <option value="2">2 - Oppegående &gt;50%</option>
              <option value="3">3 - Sengeliggende &gt;50%</option>
              <option value="4">4 - Helt sengeliggende</option>
            </select>
          </label>
        </div>

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
            Tidligere behandlingslinjer
            <select name="priorTherapyLines" value={form.priorTherapyLines} onChange={handleChange}>
              <option value="0">0 - Førstelinjebehandling</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3+</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Risikofaktorer og organfunksjon</legend>

        <div className="form-row">
          <label>
            Kardial risiko
            <select name="cardiacRisk" value={form.cardiacRisk} onChange={handleChange}>
              <option value="low">Lav</option>
              <option value="moderate">Moderat</option>
              <option value="high">Høy (QTc-forlengelse)</option>
            </select>
          </label>

          <label>
            Nøytropenirisiko
            <select name="neutropeniaRisk" value={form.neutropeniaRisk} onChange={handleChange}>
              <option value="low">Lav</option>
              <option value="moderate">Moderat</option>
              <option value="high">Høy</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Diarérisiko
            <select name="diarrhoeaRisk" value={form.diarrhoeaRisk} onChange={handleChange}>
              <option value="low">Lav</option>
              <option value="moderate">Moderat</option>
              <option value="high">Høy</option>
            </select>
          </label>

          <label>
            Leverfunksjon
            <select name="hepaticFunction" value={form.hepaticFunction} onChange={handleChange}>
              <option value="normal">Normal</option>
              <option value="mild">Lett nedsatt</option>
              <option value="moderate">Moderat nedsatt</option>
              <option value="severe">Alvorlig nedsatt</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Nyrefunksjon
            <select name="renalFunction" value={form.renalFunction} onChange={handleChange}>
              <option value="normal">Normal</option>
              <option value="mild">Lett nedsatt</option>
              <option value="moderate">Moderat nedsatt</option>
              <option value="severe">Alvorlig nedsatt</option>
            </select>
          </label>

          <label>
            Behov for monoterapi
            <select name="needMonotherapy" value={form.needMonotherapy} onChange={handleChange}>
              <option value="no">Nei</option>
              <option value="yes">Ja (tåler ikke kombinasjon)</option>
            </select>
          </label>
        </div>
      </fieldset>

      <button type="submit" className="submit-btn" disabled={loading}>
        {loading ? 'Evaluerer...' : 'Evaluer behandlingsvalg'}
      </button>
    </form>
  );
}
