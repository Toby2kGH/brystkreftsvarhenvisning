import React, { useState } from 'react';
import ReferralLetterGenerator from './ReferralLetterGenerator.jsx';

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

      {/* Journaltekst — kopierbar, synlig øverst */}
      {journalText && (
        <div className="journal-text-box">
          <div className="journal-text-header">
            <h3>Journaltekst</h3>
            <button className="copy-btn" onClick={() => copyToClipboard(journalText, setCopiedJournal)}>
              {copiedJournal ? 'Kopiert!' : 'Kopier til utklippstavle'}
            </button>
          </div>
          <pre className="journal-text-content">{journalText}</pre>
        </div>
      )}

      {/* Referral Letter Generator (3 modes) */}
      <ReferralLetterGenerator result={result} />

      {/* Treatment Steps — detaljert visning */}
      <details className="details-section" open>
        <summary>Behandlingstrinn (detaljert)</summary>
        <div className="treatment-steps">
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
      </details>

      {/* Beslutningsgrunnlag — synliggjør ALL logikk */}
      <details className="details-section" open>
        <summary>Beslutningsgrunnlag (hvordan vi kom til denne anbefalingen)</summary>
        <div className="logic-explanation">
          <h4>Steg-for-steg logikk</h4>

          {/* ER-status */}
          <div className="logic-step">
            <span className="logic-step-num">1</span>
            <div className="logic-step-text">
              <strong>ER-status: {cqlOutput?.erPositive ? 'Positiv' : 'Negativ'}</strong>
              {cqlOutput?.erPercent != null ? (
                <>
                  {' '}— ER {cqlOutput.erPercent}%.
                  {cqlOutput.erLowPositive
                    ? ` Lav-positiv (1-10%): regnes klinisk som ER-negativ iht. NBCG/St. Gallen.`
                    : cqlOutput.erPercent > 10
                    ? ` Over 10% terskel: ER-positiv.`
                    : ` 0%: ER-negativ.`
                  }
                </>
              ) : (
                <> — Satt direkte som {cqlOutput?.erPositive ? 'positiv' : 'negativ'} (ingen prosentverdi angitt).</>
              )}
              <span className="logic-step-source">Regel: ER &gt;10% = positiv, 1-10% = lav-positiv (negativ), 0% = negativ</span>
            </div>
          </div>

          {/* PR-status */}
          <div className="logic-step">
            <span className="logic-step-num">2</span>
            <div className="logic-step-text">
              <strong>PR-status: {cqlOutput?.prPositive ? 'Positiv' : 'Negativ'}</strong>
              {cqlOutput?.prPercent != null
                ? <> — PR {cqlOutput.prPercent}%. {cqlOutput.prPercent >= 1 ? 'Over 1% terskel: PR-positiv.' : '0%: PR-negativ.'}</>
                : <> — Satt direkte som {cqlOutput?.prPositive ? 'positiv' : 'negativ'}.</>
              }
              <span className="logic-step-source">Regel: PR &ge;1% = positiv</span>
            </div>
          </div>

          {/* HR-status */}
          <div className="logic-step">
            <span className="logic-step-num">3</span>
            <div className="logic-step-text">
              <strong>HR-status (hormonreseptor): {cqlOutput?.hrPositive ? 'Positiv' : 'Negativ'}</strong>
              {' '}— HR = ER positiv ELLER PR positiv.
              {cqlOutput?.erPositive && cqlOutput?.prPositive && ' Begge er positive.'}
              {cqlOutput?.erPositive && !cqlOutput?.prPositive && ' ER er positiv (PR negativ).'}
              {!cqlOutput?.erPositive && cqlOutput?.prPositive && ' PR er positiv (ER negativ).'}
              {!cqlOutput?.erPositive && !cqlOutput?.prPositive && ' Ingen av reseptorene er positive.'}
              <span className="logic-step-source">Regel: HR+ = ER+ eller PR+</span>
            </div>
          </div>

          {/* HER2-status */}
          <div className="logic-step">
            <span className="logic-step-num">4</span>
            <div className="logic-step-text">
              <strong>HER2-status: {cqlOutput?.her2Status === 'positive' ? 'Positiv' : cqlOutput?.her2Status === 'negative' ? 'Negativ' : cqlOutput?.her2Status === 'equivocal' ? 'Ekvivokal' : 'Ukjent'}</strong>
              {cqlOutput?.her2ihc && (
                <> — IHC: {cqlOutput.her2ihc}
                  {cqlOutput.her2ihc === '3+' && '. IHC 3+ = HER2-positiv (overekspresjon bekreftet).'}
                  {(cqlOutput.her2ihc === '0' || cqlOutput.her2ihc === '1+') && `. IHC ${cqlOutput.her2ihc} = HER2-negativ.`}
                  {cqlOutput.her2ihc === '2+' && (
                    cqlOutput.her2sish
                      ? <> + SISH: {cqlOutput.her2sish}. {cqlOutput.her2sish === 'positive' ? 'Amplifisert = HER2-positiv.' : 'Ikke amplifisert = HER2-negativ.'}</>
                      : <>. Ekvivokal — SISH/ISH kreves for avklaring.</>
                  )}
                </>
              )}
              <span className="logic-step-source">Regel: IHC 3+ = positiv, IHC 0/1+ = negativ, IHC 2+ krever SISH</span>
            </div>
          </div>

          {/* Biologisk gruppe */}
          <div className="logic-step">
            <span className="logic-step-num">5</span>
            <div className="logic-step-text">
              <strong>Biologisk gruppe: {cqlOutput?.bioGroup}</strong>
              {' '}—
              {cqlOutput?.bioGroup === 'HR+HER2-' && ' HR-positiv + HER2-negativ = Luminal (hormonreseptorpositiv).'}
              {cqlOutput?.bioGroup === 'HR+HER2+' && ' HR-positiv + HER2-positiv = Dobbelpositive. Krever både HER2-rettet og endokrin terapi.'}
              {cqlOutput?.bioGroup === 'HR-HER2+' && ' HR-negativ + HER2-positiv = Kun HER2-rettet terapi (ingen endokrin).'}
              {cqlOutput?.bioGroup === 'TN' && ' HR-negativ + HER2-negativ = Trippel negativ. Krever kjemoterapi.'}
              {cqlOutput?.bioGroup === 'unknown' && ' Kan ikke bestemmes — mangler reseptordata.'}
              <span className="logic-step-source">Regel: Kombinasjon av HR (steg 3) + HER2 (steg 4) bestemmer biogruppe</span>
            </div>
          </div>

          {/* Luminal subtype (kun HR+HER2-) */}
          {cqlOutput?.luminalSubtype && (
            <div className="logic-step">
              <span className="logic-step-num">6</span>
              <div className="logic-step-text">
                <strong>Luminal subtype: {cqlOutput.luminalSubtype}</strong>
                {' '}—
                {cqlOutput.luminalSubtype === 'B-like' && (
                  <>B-like hvis: Grad 3, Ki-67 &ge;20%, eller PR &lt;20%.
                    {cqlOutput.grade === 3 && ' Grad 3 er oppfylt.'}
                    {cqlOutput.ki67Value != null && cqlOutput.ki67Value >= 20 && ` Ki-67 ${cqlOutput.ki67Value}% ≥20%.`}
                    {cqlOutput.prPercent != null && cqlOutput.prPercent < 20 && ` PR ${cqlOutput.prPercent}% <20%.`}
                  </>
                )}
                {cqlOutput.luminalSubtype === 'A-like' && ' A-like: Grad 1-2, Ki-67 <20%, PR ≥20%.'}
                <span className="logic-step-source">Regel: Grad 3 / Ki-67&ge;20 / PR&lt;20 → B-like, ellers A-like</span>
              </div>
            </div>
          )}

          {/* Stadium */}
          {cqlOutput?.stadium && (
            <div className="logic-step">
              <span className="logic-step-num">{cqlOutput.luminalSubtype ? '7' : '6'}</span>
              <div className="logic-step-text">
                <strong>Stadium: {cqlOutput.stadium}</strong>
                {' '}— Utledet fra T-stadium ({cqlOutput.tStage || '?'}) + N-stadium ({cqlOutput.nStage || '?'}).
                {cqlOutput.tumorSizeMm != null && <> Tumor {cqlOutput.tumorSizeMm}mm → {cqlOutput.tStage}.</>}
                <span className="logic-step-source">TNM-klassifikasjon (AJCC 8. utgave)</span>
              </div>
            </div>
          )}
        </div>

        {/* Rå verdier */}
        <details style={{ marginTop: '12px' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.9rem' }}>Alle CQL-verdier (teknisk visning)</summary>
          <div className="data-grid" style={{ marginTop: '8px' }}>
            <DataRow label="Biologisk gruppe" value={cqlOutput?.bioGroup} highlight />
            <DataRow label="ER" value={cqlOutput?.erPositive ? `Positiv${cqlOutput.erPercent ? ` (${cqlOutput.erPercent}%)` : ''}` : `Negativ${cqlOutput?.erLowPositive ? ' (lav-positiv 1-10%)' : ''}`} />
            <DataRow label="PR" value={cqlOutput?.prPositive ? `Positiv${cqlOutput.prPercent ? ` (${cqlOutput.prPercent}%)` : ''}` : 'Negativ'} />
            <DataRow label="HR" value={cqlOutput?.hrPositive ? 'Positiv (ER+ eller PR+)' : 'Negativ'} />
            <DataRow label="HER2" value={cqlOutput?.her2Status === 'positive' ? 'Positiv' : cqlOutput?.her2Status === 'negative' ? 'Negativ' : cqlOutput?.her2Status === 'equivocal' ? 'Ekvivokal' : 'Ukjent'} />
            {cqlOutput?.her2ihc && <DataRow label="HER2 IHC" value={cqlOutput.her2ihc} />}
            {cqlOutput?.her2sish && <DataRow label="HER2 SISH" value={cqlOutput.her2sish === 'positive' ? 'Amplifisert' : cqlOutput.her2sish === 'negative' ? 'Ikke amplifisert' : cqlOutput.her2sish} />}
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
      </details>

      {/* DMN Details — alle evaluerte tabeller */}
      {treatmentPlan.dmnResults && Object.keys(treatmentPlan.dmnResults).length > 0 && (
        <details className="details-section">
          <summary>DMN-tabellresultater (alle evaluerte beslutningstabeller)</summary>
          <div className="dmn-info">
            {Object.entries(treatmentPlan.dmnResults).map(([key, dmnRes]) => (
              <div key={key} style={{ marginBottom: '16px', padding: '12px', background: '#f9f9f9', borderRadius: '6px', borderLeft: `3px solid ${dmnRes.matched ? 'var(--accent)' : 'var(--border)'}` }}>
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>{dmnRes.tableId || key}</strong>
                  <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: dmnRes.matched ? 'var(--accent)' : 'var(--text-light)' }}>
                    {dmnRes.matched ? 'Treff' : 'Ingen treff'}
                  </span>
                </p>
                {dmnRes.matched && dmnRes.matchedRules && (
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Matchede regler:</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                      {dmnRes.matchedRules.map((r) => (
                        <li key={r.ruleId}>
                          <code>{r.ruleId}</code>: {r.description}
                          {r.sourceRef && (
                            <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginLeft: '6px' }}>
                              [{r.sourceRef.document} {r.sourceRef.page}]
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {dmnRes.matched && dmnRes.result && !Array.isArray(dmnRes.result) && (
                  <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    {dmnRes.result.rationale && <p><em>Begrunnelse: {dmnRes.result.rationale}</em></p>}
                  </div>
                )}
              </div>
            ))}
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
