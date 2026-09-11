import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SENTENCE_GROUPS, SOURCE_LABELS, findOption } from '../notewriter/sentenceBank.js';
import {
  addSentence,
  removeByOption,
  replaceGroupSelection,
  addFreeText,
  editBlock,
  removeBlock,
  moveBlock,
  hasOption,
  joinBlocks,
} from '../notewriter/noteBlocks.js';
import { buildIntro } from '../tablelookup/introText.js';
import { copyText } from '../textgen/templateEngine.js';
import { SCOPE_NOTE } from '../guidelineVersion.js';

// ================================================================
//  Skriv journalnotat
//
//  Et notatverktøy, ikke et beslutningsverktøy. Legen fyller inn
//  pasientkarakteristika, får en innledning bygget av dem, og krysser av
//  hvilke standardsetninger som skal med.
//
//  MDR-grensen ligger i ett punkt: pasientopplysningene styrer KUN
//  innledningen. De filtrerer aldri menyen, sorterer den ikke, markerer
//  ingenting som passende og forhåndsvelger ingen behandling. Bare de to
//  gruppene som gjengir det legen selv har tastet — tumorbiologi og
//  behandlingsintensjon — settes inn automatisk.
// ================================================================

const NBCG_URL = 'https://nbcg.no/retningslinjer-2/retningslinjer/';

const BIO_GROUPS = [
  { value: 'HR+HER2-', label: 'HR+ HER2-' },
  { value: 'HR+HER2+', label: 'HR+ HER2+' },
  { value: 'HR-HER2+', label: 'HR- HER2+' },
  { value: 'HR-HER2-', label: 'HR- HER2- (trippel negativ)' },
];
const T_STAGES = ['pT1a', 'pT1b', 'pT1c', 'pT2', 'pT3', 'pT4'];
const N_STAGES = ['pN0', 'pN1', 'pN2', 'pN3'];

const EMPTY_PATIENT = {
  bioGroup: '',
  intent: '',
  tStage: '',
  nStage: '',
  menopausal: '',
  age: '',
  erPercent: '',
  prPercent: '',
  her2: '',
  ki67: '',
  grade: '',
};

export default function JournalNoteWriter() {
  const [patient, setPatient] = useState(EMPTY_PATIENT);
  const [blocks, setBlocks] = useState([]);
  const [copied, setCopied] = useState(false);
  // Husker hvilke transkripsjonsverdier vi alt har satt inn, så en setning
  // legen har fjernet ikke kommer snikende tilbake.
  const autoApplied = useRef({});

  const update = (field, value) => setPatient((p) => ({ ...p, [field]: value }));

  const intro = useMemo(
    () => buildIntro(
      { bioGroup: patient.bioGroup, tStage: patient.tStage, nStage: patient.nStage, menopausal: patient.menopausal },
      patient,
    ),
    [patient],
  );

  // Transkripsjonsgruppene settes inn automatisk — de gjentar bare det legen
  // selv har valgt i feltene til venstre. Ingen behandlingsgruppe røres her.
  useEffect(() => {
    for (const group of SENTENCE_GROUPS) {
      if (!group.transcription) continue;
      const value = patient[group.transcription];
      if (!value || autoApplied.current[group.id] === value) continue;
      autoApplied.current[group.id] = value;
      const option = group.options.find((o) => o.value === value);
      const ids = group.options.map((o) => o.id);
      setBlocks((prev) => replaceGroupSelection(prev, ids, option));
    }
  }, [patient.bioGroup, patient.intent]);

  function toggle(group, option) {
    setBlocks((prev) => {
      if (hasOption(prev, option.id)) return removeByOption(prev, option.id);
      if (group.select === 'single') {
        return replaceGroupSelection(prev, group.options.map((o) => o.id), option);
      }
      return addSentence(prev, option);
    });
  }

  function handleReset() {
    setPatient(EMPTY_PATIENT);
    setBlocks([]);
    autoApplied.current = {};
  }

  const noteText = useMemo(() => joinBlocks(blocks, intro), [blocks, intro]);

  function handleCopy() {
    copyText(noteText, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="note">
      <div className="note-header">
        <h2>Skriv journalnotat</h2>
        <p className="note-lead">
          Fyll inn pasientopplysningene, kryss av hvilke setninger som skal med, og kopier
          notatet inn i journalen. Verktøyet foreslår ingen behandling — du velger hver setning.
        </p>
        <p className="note-nbcg">
          Setningene er et øyeblikksbilde av innholdet i denne appen.{' '}
          <a href={NBCG_URL} target="_blank" rel="noopener noreferrer">
            Kontroller mot gjeldende retningslinje på nbcg.no
          </a>{' '}
          før du bruker notatet.
        </p>
        <details className="note-about">
          <summary>Om verktøyet</summary>
          <p>
            Pasientopplysningene styrer <strong>bare innledningen</strong>. De filtrerer ikke
            menyen, sorterer den ikke og markerer ingen setning som passende for denne
            pasienten. Bare tumorbiologi og behandlingsintensjon settes inn automatisk, fordi
            de gjentar det du selv har valgt. Hvert behandlingsvalg starter tomt.
          </p>
          <p>
            Dette er ingen beslutningsstøtte. Alle setninger kan redigeres, og tekst du har
            skrevet eller endret blir stående selv om du krysser av noe annet etterpå. {SCOPE_NOTE}
          </p>
        </details>
      </div>

      <div className="note-grid">
        {/* ============ 01 PASIENTOPPLYSNINGER ============ */}
        <section className="note-col note-col-input">
          <div className="note-col-head">
            <span className="note-step">01 / Pasient</span>
            <div className="note-title-row">
              <h3>Pasientopplysninger</h3>
              <button className="note-reset" onClick={handleReset}>Nullstill</button>
            </div>
            <p className="note-col-desc">Bygger innledningen. Påvirker ikke setningsmenyen.</p>
          </div>

          <label className="note-field">
            Hovedgruppe (HR/HER2)
            <select value={patient.bioGroup} onChange={(e) => update('bioGroup', e.target.value)}>
              <option value="">— Velg —</option>
              {BIO_GROUPS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>

          <label className="note-field">
            Behandlingsintensjon
            <select value={patient.intent} onChange={(e) => update('intent', e.target.value)}>
              <option value="">— Velg —</option>
              <option value="adjuvant">Adjuvant</option>
              <option value="neoadjuvant">Neoadjuvant</option>
              <option value="post-neoadjuvant">Postneoadjuvant</option>
            </select>
          </label>

          <div className="note-field-row">
            <label className="note-field">
              T-stadium
              <select value={patient.tStage} onChange={(e) => update('tStage', e.target.value)}>
                <option value="">—</option>
                {T_STAGES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="note-field">
              N-stadium
              <select value={patient.nStage} onChange={(e) => update('nStage', e.target.value)}>
                <option value="">—</option>
                {N_STAGES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <div className="note-field-row">
            <label className="note-field">
              Menopausal status
              <select value={patient.menopausal} onChange={(e) => update('menopausal', e.target.value)}>
                <option value="">—</option>
                <option value="pre">Premenopausal</option>
                <option value="post">Postmenopausal</option>
              </select>
            </label>
            <label className="note-field">
              Alder
              <input type="number" min="18" max="110" value={patient.age}
                onChange={(e) => update('age', e.target.value)} placeholder="år" />
            </label>
          </div>

          <div className="note-field-row">
            <label className="note-field">
              ER (%)
              <input type="number" min="0" max="100" value={patient.erPercent}
                onChange={(e) => update('erPercent', e.target.value)} placeholder="%" />
            </label>
            <label className="note-field">
              PR (%)
              <input type="number" min="0" max="100" value={patient.prPercent}
                onChange={(e) => update('prPercent', e.target.value)} placeholder="%" />
            </label>
          </div>

          <div className="note-field-row">
            <label className="note-field">
              Ki-67 (%)
              <input type="number" min="0" max="100" value={patient.ki67}
                onChange={(e) => update('ki67', e.target.value)} placeholder="%" />
            </label>
            <label className="note-field">
              Histologisk grad
              <select value={patient.grade} onChange={(e) => update('grade', e.target.value)}>
                <option value="">—</option>
                <option value="1">Grad 1</option>
                <option value="2">Grad 2</option>
                <option value="3">Grad 3</option>
              </select>
            </label>
          </div>

          <label className="note-field">
            HER2 (IHC/ISH)
            <input type="text" value={patient.her2}
              onChange={(e) => update('her2', e.target.value)} placeholder="f.eks. IHC 2+, ISH negativ" />
          </label>

          {intro && (
            <div className="note-intro-preview">
              <strong>Innledning:</strong>
              <p>{intro}</p>
            </div>
          )}
        </section>

        {/* ============ 02 SETNINGSVALG ============ */}
        <section className="note-col note-col-pick">
          <div className="note-col-head">
            <span className="note-step">02 / Setninger</span>
            <h3>Hva skal med?</h3>
            <p className="note-col-desc">Kryss av. Teksten under hvert valg er den som settes inn.</p>
          </div>

          {SENTENCE_GROUPS.map((group) => (
            <fieldset key={group.id} className={`note-group${group.transcription ? ' note-group-transcription' : ''}`}>
              <legend>{group.heading}</legend>
              {group.transcription && (
                <p className="note-group-note">Settes inn fra opplysningene dine — kan fjernes.</p>
              )}
              {group.note && <p className="note-group-note">{group.note}</p>}

              {group.options.map((option) => {
                const checked = hasOption(blocks, option.id);
                return (
                  <label key={option.id} className={`note-option${checked ? ' checked' : ''}`}>
                    <input
                      type={group.select === 'single' ? 'radio' : 'checkbox'}
                      name={group.select === 'single' ? `g-${group.id}` : undefined}
                      checked={checked}
                      onChange={() => toggle(group, option)}
                    />
                    <span className="note-option-body">
                      <span className="note-option-label">{option.label}</span>
                      <span className="note-option-text">{option.text}</span>
                      <span className={`note-source note-source-${option.source}`}>
                        {SOURCE_LABELS[option.source]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </section>

        {/* ============ 03 NOTATET ============ */}
        <section className="note-col note-col-doc">
          <div className="note-col-head">
            <span className="note-step">03 / Notatet</span>
            <div className="note-title-row">
              <h3>Journalnotat</h3>
              <span className="note-count">{noteText.length}</span>
            </div>
            <p className="note-col-desc">Skriv rett i feltene. Det du endrer blir stående.</p>
          </div>

          <div className="note-actions">
            <button className="copy-btn" onClick={handleCopy} disabled={!noteText}>
              {copied ? 'Kopiert!' : 'Kopier hele notatet'}
            </button>
            <button className="note-add-free" onClick={() => setBlocks((b) => addFreeText(b))}>
              + Egen tekst
            </button>
          </div>

          {intro && (
            <div className="note-block note-block-intro">
              <span className="note-block-tag">Innledning</span>
              <p>{intro}</p>
            </div>
          )}

          {!blocks.length ? (
            <div className="note-empty">
              <div className="note-empty-icon">¶</div>
              <h4>Ingen setninger valgt</h4>
              <p>Kryss av i midten, eller trykk «Egen tekst» for å skrive fritt.</p>
            </div>
          ) : (
            blocks.map((block, i) => (
              <div key={block.key} className={`note-block note-block-${block.kind}`}>
                <div className="note-block-head">
                  <span className="note-block-tag">
                    {block.kind === 'free' ? 'Egen tekst' : findOption(block.optionId)?.groupHeading || 'Setning'}
                    {block.edited && <em> · endret</em>}
                  </span>
                  <span className="note-block-actions">
                    <button onClick={() => setBlocks((b) => moveBlock(b, block.key, -1))}
                      disabled={i === 0} title="Flytt opp">↑</button>
                    <button onClick={() => setBlocks((b) => moveBlock(b, block.key, 1))}
                      disabled={i === blocks.length - 1} title="Flytt ned">↓</button>
                    <button className="note-block-del" onClick={() => setBlocks((b) => removeBlock(b, block.key))}
                      title="Fjern">×</button>
                  </span>
                </div>
                <textarea
                  value={block.text}
                  onChange={(e) => setBlocks((b) => editBlock(b, block.key, e.target.value))}
                  rows={Math.max(2, Math.ceil((block.text.length || 1) / 60))}
                  placeholder={block.kind === 'free' ? 'Skriv din egen tekst…' : ''}
                />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
