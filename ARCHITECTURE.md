# Arkitektur — Brystkreft Beslutningsstøtte

Klinisk beslutningsstøtteverktøy for adjuvant/neoadjuvant brystkreftbehandling,
basert på **NBCG retningslinjer** og **Nasjonalt handlingsprogram for brystkreft**.

## Klinisk kilde

All klinisk logikk er hentet fra:

| Dokument | Revisjon |
|----------|----------|
| Nasjonalt handlingsprogram for brystkreft | Mars 2025 |
| NBCG tabellarisk oversikt — adjuvant | 17.12.2024 |
| NBCG tabellarisk oversikt — neoadjuvant | 04.09.2025 |
| NBCG tabellarisk oversikt — strålebehandling | 15.11.2023 |

Hver beslutningstabell har en `guidelineSource` som peker til spesifikt dokument,
kapittel og revisjon. Enkeltregler har `sourceRef` med kapittelnummer, side og
eventuell klinisk studie (MonarchE, OlympiA, KEYNOTE-522 osv.).

## Pipeline (BPM+ Health)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ PatientForm  │────▶│  CQL Engine  │────▶│  DMN Engine  │────▶│  Treatment   │
│  (input)     │     │  (fakta)     │     │  (beslut.)   │     │  Builder     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                           │                     │                     │
                     Deriverer fakta       Evaluerer regler     Sammenstiller
                     fra rådata:           i tabeller:          behandlingsplan:
                     - Biogruppe           - Kjemoterapi        - Trinn
                     - Stadium             - Endokrin           - Advarsler
                     - Luminal subtype     - CDK4/6             - Journaltekst
                     - Risikovurdering     - Stråling           - FHIR Bundle
                                           - Bisfosfonat
```

**Prinsipp:** CQL deriverer kun FAKTA (hva er tilstanden). DMN tar alle BESLUTNINGER
(hva skal gjøres). Treatment Builder sammenstiller resultatene.

## Filkart

```
brystkreftsvarhenvisning/
├── server/
│   └── index.js                  # Express API-server, endepunkter, endringslogg
│
├── src/
│   ├── App.jsx                   # React-app med fannavigasjon
│   ├── index.jsx                 # React inngangsport
│   ├── styles.css                # All CSS inkl. versjonerings-UI
│   │
│   ├── types/
│   │   └── clinical.ts           # Alle TypeScript-typer for hele pipelinen
│   │
│   ├── cql/
│   │   ├── cqlEngine.js          # Faktaderivering (ER, HER2, biogruppe, stadium)
│   │   └── BreastCancerCDK46.cql # CQL-spesifikasjon (FHIR-definisjoner)
│   │
│   ├── dmn/
│   │   ├── dmnEngine.js          # DMN-motor (evaluerer regler, hit policies)
│   │   ├── decisionTables.js     # 13 beslutningstabeller med ~170 regler
│   │   ├── treatmentBuilder.js   # Sammenstiller behandlingsplan fra DMN-resultat
│   │   ├── dmnSchema.ts          # Validering av tabellstruktur ved lasting
│   │   └── conflictDetector.ts   # Oppdager overlappende/motstridende regler
│   │
│   ├── fhir/
│   │   └── mCodeProfiles.js      # FHIR/mCODE-profiler (pasientbundle)
│   │
│   └── components/
│       ├── PatientForm.jsx        # Klinisk inputskjema
│       ├── DecisionResult.jsx     # Behandlingsplanvisning
│       ├── DecisionTableViewer.jsx# Admin-UI: se/redigere beslutningstabeller
│       ├── InteractiveDecisionTree.jsx # Klikkbart beslutningstre
│       └── ReferralLetterGenerator.jsx # Henvisningsbrev (3 maler)
│
├── tests/
│   ├── all-rules.test.js         # Regeltester for alle 13 tabeller (170 tester)
│   ├── decision-engine.test.js   # CQL- og DMN-motortester
│   └── mcode-profiles.test.js    # FHIR-bundletester
│
└── docs/
    └── CRITICAL_REVIEW.md        # Kjente begrensninger og gap
```

## Beslutningstabeller (DMN)

13 tabeller med ulike hit policies:

| ID | Navn | Hit Policy | Regler | Kilde |
|----|------|-----------|--------|-------|
| `her2-determination` | HER2-bestemmelse | FIRST | 8 | Handlingsprogram Kap. 4 |
| `chemo-pathway-hrpos-her2neg` | Kjemoterapivalg HR+HER2- | FIRST | 24 | NBCG 17.12.24 |
| `cdk46-adjuvant-selection` | CDK4/6-inhibitorvalg | FIRST | 22 | NBCG 17.12.24, MonarchE/NATALEE |
| `endocrine-therapy-selection` | Endokrinterapi | FIRST | 12 | NBCG 17.12.24 |
| `radiation-therapy` | Strålebehandling | FIRST | 14 | NBCG 15.11.23 |
| `zometa-eligibility` | Zoledronsyre-eligibilitet | FIRST | 5 | Handlingsprogram |
| `hrpos-her2pos-adjuvant` | HR+HER2+ adjuvant | FIRST | 5 | NBCG 17.12.24 |
| `hrneg-her2pos-adjuvant` | HR-HER2+ adjuvant | FIRST | 4 | NBCG 17.12.24 |
| `tn-adjuvant` | Trippel-negativ adjuvant | FIRST | 4 | NBCG 17.12.24 |
| `neoadjuvant-treatment` | Neoadjuvant behandling | FIRST | 9 | NBCG 04.09.25 |
| `post-neoadjuvant-treatment` | Post-neoadjuvant | FIRST | 8 | KATHERINE, CREATE-X, OlympiA |
| `brca-olaparib-eligibility` | BRCA/Olaparib | FIRST | 7 | OlympiA |
| `near-cutoff-warnings` | Grenseverdivarsler | COLLECT | 5 | Klinisk praksis |

## Dataflyt (detaljert)

### 1. Pasientinput → CQL

`PatientForm.jsx` sender skjemadata til `POST /api/evaluate`.
Serveren kaller `evaluateCQL()` som deriverer:

- **Reseptorstatus**: ER+/-, PR+/-, HER2 (fra IHC/SISH)
- **Biogruppe**: HR+HER2-, HR+HER2+, HR-HER2+, TN
- **Stadium**: T-stage (fra størrelse), N-stage, TNM-stadium
- **Luminal subtype**: A-like/B-like (for HR+HER2-)
- **Risikofaktorer**: isHighRisk, olaparibEligible, cdk46eligible

### 2. CQL-fakta → DMN-tabeller

`treatmentBuilder.js` evaluerer relevante tabeller basert på biogruppe
og behandlingsmodus (adjuvant/neoadjuvant/post-neoadjuvant).

### 3. DMN-resultat → Behandlingsplan

Resultater samles til en `TreatmentPlan` med:
- `steps[]` — Behandlingstrinn (kjemo, endokrin, CDK4/6, stråling, bisfosfonat)
- `warnings[]` — Kliniske advarsler
- `dmnResults` — Alle evaluerte tabeller (for transparens)

### 4. Behandlingsplan → Visning

- **DecisionResult.jsx**: Viser trinnvis behandlingsplan
- **ReferralLetterGenerator.jsx**: Genererer henvisningsbrev
- **FHIR Bundle**: mCODE-kompatibel audit-trail

## Versjonskontroll og sporbarhet

### Kildehenvisning
- Hver tabell: `guidelineSource` → dokument, kapittel, revisjon
- Enkeltregler: `sourceRef` → kapittel, side, NBCG-tabell, klinisk studie

### Endringsdeteksjon
- Serveren sammenligner regler mot hardkodede standardverdier (`JSON.stringify`)
- Endrede regler markeres med `isModified`, `lastModifiedAt`, `lastModifiedBy`
- Admin-UI viser oransje prikk på faner med endrede regler

### Endringslogg
- `changeLog[]` på hver tabell
- Global endringslogg i `server/change-log.json`
- API: `GET /api/change-log`, `GET /api/decision-tables/:id/diff`
- Tilbakestilling: per regel eller alle tabeller

## API-endepunkter

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| POST | `/api/evaluate` | Evaluerer pasientdata, returnerer behandlingsplan |
| GET | `/api/decision-tables` | Henter alle beslutningstabeller |
| GET | `/api/decision-tables/:id` | Henter én tabell |
| PUT | `/api/decision-tables/:id` | Oppdaterer en tabell (med endringslogg) |
| POST | `/api/decision-tables` | Oppretter ny egendefinert tabell |
| DELETE | `/api/decision-tables/:id` | Sletter egendefinert tabell |
| POST | `/api/decision-tables/reset` | Tilbakestiller alle tabeller til standard |
| GET | `/api/decision-tables/:id/diff` | Sammenligner tabell mot standard |
| POST | `/api/decision-tables/:id/revert-rule/:ruleId` | Tilbakestiller én regel |
| GET | `/api/change-log` | Global endringslogg |
| GET | `/api/change-log/:tableId` | Endringslogg for én tabell |
| GET | `/cds-services` | CDS Hooks service discovery |
| POST | `/cds-services/breast-cancer-adjuvant-cds` | CDS Hooks-endepunkt |

## Teknologier

- **Frontend**: React + Vite
- **Backend**: Express.js
- **Typer**: TypeScript (`.ts` for typer/validering, `.js` for logikk)
- **Test**: Vitest (170 tester)
- **Standarder**: FHIR R4, mCODE, CDS Hooks, CQL, DMN
