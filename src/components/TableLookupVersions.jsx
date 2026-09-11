import React, { useState } from 'react';
import TableLookup from './TableLookup.jsx';
import TableLookup105 from './TableLookup105.jsx';
import TableLookup11 from './TableLookup11.jsx';
import TableLookupWorkbench from './TableLookupWorkbench.jsx';

/**
 * Skall rundt de fire oppslagsversjonene.
 *
 * Versjonene lever side om side mens de sammenlignes i klinisk bruk, men de
 * hører hjemme under én fane — fire faner i menyen sa ingenting om at det er
 * samme verktøy i ulike utgaver. 1.1 er den som vises først.
 */

const VERSIONS = [
  { id: '1.1', label: 'Versjon 1.1 — legen plukker selv', Component: TableLookup11 },
  { id: '1.05', label: 'Versjon 1.05 — alle treff tas med', Component: TableLookup105 },
  { id: '1', label: 'Versjon 1 — tabell med journaltekst per rad', Component: TableLookup },
  { id: '2.0', label: 'Versjon 2.0 — utleder fra pasientdata', Component: TableLookupWorkbench },
];

export default function TableLookupVersions() {
  const [version, setVersion] = useState('1.1');
  const active = VERSIONS.find((v) => v.id === version) || VERSIONS[0];
  const Active = active.Component;

  return (
    <div className="lookup-versions">
      <label className="lookup-version-picker">
        Versjon av tabelloppslaget
        <select value={version} onChange={(e) => setVersion(e.target.value)}>
          {VERSIONS.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </label>

      <Active />
    </div>
  );
}
