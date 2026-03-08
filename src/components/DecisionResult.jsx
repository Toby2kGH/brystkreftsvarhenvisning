import React, { useState } from 'react';

const STEP_TYPE_LABELS = {
  chemo: 'Kjemoterapi',
  endocrine: 'Endokrinterapi',
  cdk46: 'CDK4/6-inhibitor',
  radiation: 'Strålebehandling',
  bisphosphonate: 'Bisfosfonat',
};

const STEP_TYPE_COLORS = {
  chemo: '#e74c3c',
  endocrine: '#2980b9',
  cdk46: '#8e44ad',
  radiation: '#e67e22',
  bisphosphonate: '#27ae60',
};

export default function DecisionResult({ result }) {
  const { treatmentPlan, cqlOutput, dmnResult, journalText, referralText } = result;
  const [copiedJournal, setCopiedJournal] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  if (!treatmentPlan) return null;

  const { bioGroup, steps, warnings, isNeoadjuvant, luminalSubtype, chemoPathway } = treatmentPlan;

  function copyToClipboard(text, setCopied) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="decision-result">
      <h2>Behandlingsanbefaling</h2>

      {/* Biological Profile */}
      <div className="bio-profile">
        <span className={`bio-badge bio-${bioGroup?.replace(/[+\-]/g, '')}`}>
          {bioGroup || 'Ukjent'}
        </span>
        {luminalSubtype && (
          <span className="bio-badge luminal">{luminalSubtype}</span>
        )}
        {isNeoadjuvant && (
          <span className="bio-badge neoadjuvant">Neoadjuvant</span>
        )}
        {cqlOutput?.stadium && (
          <span className="bio-badge stadium">Stadium {cqlOutput.stadium}</span>
        )}
        {cqlOutput?.tStage && (
          <span className="bio-badge staging">{cqlOutput.tStage} {cqlOutput.nStage}</span>
        )}
      </div>

      {/* Warnings */}
      {warnings?.length > 0 && (
        <div className="warnings-box">
          <strong>Merknader:</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Treatment Steps */}
      <div className="treatment-steps">
        <h3>Behandlingstrinn</h3>
        {steps.length === 0 ? (
          <p className="no-steps">Ingen spesifikke behandlingstrinn anbefalt</p>
        ) : (
          <ol className="steps-list">
            {steps.map((step, i) => (
              <li key={i} className="step-card">
                <div className="step-header">
                  <span
                    className="step-type-badge"
                    style={{ backgroundColor: STEP_TYPE_COLORS[step.type] || '#7f8c8d' }}
                  >
                    {STEP_TYPE_LABELS[step.type] || step.type}
                  </span>
                  <strong className="step-name">{step.name}</strong>
                  {step.priority === 1 && (
                    <span className="priority-badge">Førstevalg</span>
                  )}
                </div>
                <p className="step-detail">{step.detail}</p>
                {step.duration && (
                  <p className="step-duration">Varighet: {step.duration}</p>
                )}
                {step.rationale && (
                  <p className="step-rationale">{step.rationale}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Journal Text */}
      {journalText && (
        <div className="journal-section">
          <div className="journal-header">
            <h3>Journaltekst</h3>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(journalText, setCopiedJournal)}
            >
              {copiedJournal ? 'Kopiert!' : 'Kopier'}
            </button>
          </div>
          <pre className="journal-text">{journalText}</pre>
        </div>
      )}

      {/* Referral Text (neoadjuvant) */}
      {referralText && (
        <div className="journal-section referral-section">
          <div className="journal-header">
            <h3>Henvisningstekst</h3>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(referralText, setCopiedReferral)}
            >
              {copiedReferral ? 'Kopiert!' : 'Kopier'}
            </button>
          </div>
          <pre className="journal-text">{referralText}</pre>
        </div>
      )}

      {/* CQL Details */}
      <details className="details-section">
        <summary>CQL-evaluering (kliniske fakta)</summary>
        <div className="data-grid">
          <DataRow label="Biologisk gruppe" value={cqlOutput?.bioGroup} highlight />
          <DataRow label="ER" value={cqlOutput?.erPositive ? `Positiv${cqlOutput.erPercent ? ` (${cqlOutput.erPercent}%)` : ''}` : 'Negativ'} />
          <DataRow label="PR" value={cqlOutput?.prPositive ? `Positiv${cqlOutput.prPercent ? ` (${cqlOutput.prPercent}%)` : ''}` : 'Negativ'} />
          <DataRow label="HER2" value={cqlOutput?.her2Status} />
          {cqlOutput?.her2ihc && <DataRow label="HER2 IHC" value={cqlOutput.her2ihc} />}
          {cqlOutput?.her2sish && <DataRow label="HER2 SISH" value={cqlOutput.her2sish} />}
          <DataRow label="Ki-67" value={cqlOutput?.ki67Value != null ? `${cqlOutput.ki67Value}%` : '—'} />
          <DataRow label="Grad" value={cqlOutput?.grade ?? '—'} />
          <DataRow label="T-stadium" value={cqlOutput?.tStage ?? '—'} />
          <DataRow label="N-stadium" value={cqlOutput?.nStage ?? '—'} />
          <DataRow label="Stadium" value={cqlOutput?.stadium ?? '—'} />
          {cqlOutput?.luminalSubtype && <DataRow label="Luminal subtype" value={cqlOutput.luminalSubtype} />}
          {cqlOutput?.geneTestDone && <DataRow label="Gentest" value={cqlOutput.geneTest} />}
          {cqlOutput?.rorScore != null && <DataRow label="ROR-score" value={cqlOutput.rorScore} />}
          {cqlOutput?.rsScore != null && <DataRow label="RS-score" value={cqlOutput.rsScore} />}
          <DataRow label="Menopausal status" value={translateMenopausal(cqlOutput?.menopausalStatus)} />
        </div>
      </details>

      {/* DMN Details */}
      {dmnResult && (
        <details className="details-section">
          <summary>DMN-evaluering (CDK4/6-beslutning)</summary>
          <div className="dmn-info">
            <p><strong>Tabell:</strong> {dmnResult.tableId}</p>
            <p><strong>Treff:</strong> {dmnResult.matched ? 'Ja' : 'Nei'}</p>
            {dmnResult.result && (
              <>
                <p><strong>Abemaciclib:</strong> {dmnResult.result.abemaciclib}</p>
                <p><strong>Ribociclib:</strong> {dmnResult.result.ribociclib}</p>
                <p><strong>Begrunnelse:</strong> {dmnResult.result.rationale}</p>
              </>
            )}
            {dmnResult.matchedRules && (
              <div>
                <strong>Matchede regler:</strong>
                <ul>
                  {dmnResult.matchedRules.map((r) => (
                    <li key={r.ruleId}>
                      <code>{r.ruleId}</code>: {r.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      <p className="timestamp">Evaluert: {new Date(result.timestamp).toLocaleString('nb-NO')}</p>
    </div>
  );
}

function DataRow({ label, value, highlight }) {
  return (
    <div className={`data-row ${highlight ? 'highlight' : ''}`}>
      <span className="data-label">{label}</span>
      <span className="data-value">{String(value ?? '—')}</span>
    </div>
  );
}

function translateMenopausal(status) {
  const map = { pre: 'Premenopausal', peri: 'Perimenopausal', post: 'Postmenopausal', unknown: 'Ukjent' };
  return map[status] || status || '—';
}
