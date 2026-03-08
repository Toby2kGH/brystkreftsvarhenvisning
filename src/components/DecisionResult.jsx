import React from 'react';

export default function DecisionResult({ result }) {
  const { recommendation, cqlOutput, dmnResult } = result;

  if (!recommendation) return null;

  const confidenceClass =
    recommendation.confidence === 'high'
      ? 'confidence-high'
      : recommendation.confidence === 'moderate'
        ? 'confidence-moderate'
        : 'confidence-low';

  return (
    <div className="decision-result">
      <h2>Anbefaling</h2>

      {/* Hovedanbefaling */}
      <div className={`recommendation-card ${confidenceClass}`}>
        <div className="rec-header">
          <h3>{recommendation.summary}</h3>
          <span className={`confidence-badge ${confidenceClass}`}>
            {recommendation.confidence === 'high'
              ? 'Høy konfidens'
              : recommendation.confidence === 'moderate'
                ? 'Moderat konfidens'
                : 'Lav konfidens'}
          </span>
        </div>

        <p className="rationale">{recommendation.rationale}</p>

        {(recommendation.endocrinePartner || recommendation.combinationPartner) && (
          <div className="combination">
            <strong>Kombinasjonspartner:</strong>{' '}
            {recommendation.endocrinePartner || recommendation.combinationPartner}
            {recommendation.endocrineRationale && (
              <span className="endocrine-rationale"> — {recommendation.endocrineRationale}</span>
            )}
          </div>
        )}

        {recommendation.warnings?.length > 0 && (
          <div className="warnings">
            <strong>Advarsler:</strong>
            <ul>
              {recommendation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* CQL-output (datahenting) */}
      <details className="details-section">
        <summary>CQL-evaluering (datahenting)</summary>
        <div className="data-grid">
          <DataRow label="HR+/HER2-" value={cqlOutput.hrPositiveHer2Negative ? 'Ja' : 'Nei'} />
          <DataRow label="ER positiv" value={cqlOutput.erPositive ? 'Ja' : 'Nei'} />
          <DataRow label="PR positiv" value={cqlOutput.prPositive ? 'Ja' : 'Nei'} />
          <DataRow label="HER2 negativ" value={cqlOutput.her2Negative ? 'Ja' : 'Nei'} />
          <DataRow label="Ki-67" value={cqlOutput.ki67Value != null ? `${cqlOutput.ki67Value}%` : 'Ikke angitt'} />
          <DataRow label="ECOG" value={cqlOutput.ecogScore} />
          <DataRow label="Metastatisk" value={cqlOutput.isMetastatic ? 'Ja' : 'Nei'} />
          <DataRow label="Kvalifisert for CDK4/6i" value={cqlOutput.eligible ? 'Ja' : 'Nei'} highlight />
          <DataRow label="Menopausal status" value={translateMenopausal(cqlOutput.menopausalStatus)} />
          <DataRow label="Tidligere behandlingslinjer" value={cqlOutput.priorTherapyLines} />
          <DataRow label="Kardial risiko" value={translateRisk(cqlOutput.cardiacRisk)} />
          <DataRow label="Nøytropenirisiko" value={translateRisk(cqlOutput.neutropeniaRisk)} />
          <DataRow label="Diarérisiko" value={translateRisk(cqlOutput.diarrhoeaRisk)} />
          <DataRow label="Leverfunksjon" value={translateOrgan(cqlOutput.hepaticFunction)} />
          <DataRow label="Behov monoterapi" value={cqlOutput.needMonotherapy ? 'Ja' : 'Nei'} />
        </div>
      </details>

      {/* DMN-resultat (beslutningslogikk) */}
      <details className="details-section">
        <summary>DMN-evaluering (beslutningslogikk)</summary>
        <div className="dmn-info">
          <p>
            <strong>Tabell:</strong> {dmnResult.tableId}
          </p>
          <p>
            <strong>Treff:</strong> {dmnResult.matched ? 'Ja' : 'Nei'}
          </p>
          {dmnResult.endocrinePartner && (
            <p>
              <strong>Endokrinterapi:</strong> {dmnResult.endocrinePartner.partner} — {dmnResult.endocrinePartner.rationale}
            </p>
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
  return map[status] || status;
}

function translateRisk(risk) {
  const map = { low: 'Lav', moderate: 'Moderat', high: 'Høy' };
  return map[risk] || risk;
}

function translateOrgan(fn) {
  const map = { normal: 'Normal', mild: 'Lett nedsatt', moderate: 'Moderat nedsatt', severe: 'Alvorlig nedsatt' };
  return map[fn] || fn;
}
