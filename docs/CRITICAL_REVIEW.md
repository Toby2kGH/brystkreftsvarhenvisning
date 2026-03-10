# Kritisk gjennomgang: Brystkreft Beslutningsstøtte som nasjonalt rammeverk

**Dato:** 2026-03-10
**Kontekst:** Evaluering av koden som potensielt rammeverk for alle handlingsprogram og beslutningstrær innenfor norsk kreftbehandling
**Referanse:** NBCG Handlingsprogram revisjon mars 2025

---

## 1. ARKITEKTUR OG METODEVALG

### Styrker
- **BPM+ Health-arkitekturen (CQL → DMN → Treatment Plan)** separerer faktaderivering fra beslutningstaking, i tråd med OMG-standarden
- **DMN-tabeller** er transparente, inspiserbare og redigerbare av klinikere — kritisk for tillit
- **Near-cutoff advarsler** (tabell 11) viser god forståelse av at grenseverdier er veiledende, ikke absolutte
- **11 beslutningstabeller med 80+ regler** dekker hoveddelene av adjuvant brystkreftbehandling

### Kritiske svakheter

#### 1.1 Ingen versjonering av klinisk innhold
Beslutningsinnholdet er hardkodet i `decisionTables.js`. For nasjonalt rammeverk MÅ det finnes:
- **Separat versjonering** av klinisk logikk vs. applikasjonskode
- **Dato-gyldige regler** (gyldig-fra/gyldig-til) for sporbarhet ved handlingsprogram-endringer
- **Endringslogg** med hvem som endret hva og hvorfor
- **Per-regel audit trail** (nåværende `lastUpdated`/`version` per tabell er utilstrekkelig)

#### 1.2 Ingen FHIR-integrasjon i praksis
`mCodeProfiles.js` eksisterer men er frakoblet CQL-motoren:
- Input MÅ kunne komme fra strukturerte FHIR-bundles (kreftregisteret, patologisystemer)
- Output BØR eksporteres som FHIR CarePlan / MedicationRequest
- Manuell datainntasting skalerer ikke nasjonalt

#### 1.3 CQL-motoren er pseudo-CQL
`cqlEngine.js` er JavaScript som *navngis* CQL, men er ikke en ekte CQL-evaluator. For nasjonalt rammeverk:
- Bruk ekte CQL-biblioteker (f.eks. cql-execution) som kan valideres og deles på tvers av helseforetak
- Nåværende implementasjon binder faktaderivering til denne spesifikke kodebasen

#### 1.4 DMN-motoren er forenklet
`dmnEngine.js` implementerer en subset av FEEL:
- Støtter: eksakt match, arrays, range-sammenligninger, negasjon
- **Mangler**: regex, dato-evaluering, funksjonsuttrykk, innebygde FEEL-funksjoner
- For kompleksere handlingsprogram (f.eks. lungekreft med mange mutasjoner) vil dette bli begrensende

---

## 2. KLINISK INNHOLDSANALYSE — NBCG MARS 2025

### 2.1 Godt dekket

| Tema | Status |
|------|--------|
| HER2-bestemmelse (IHC/SISH) | ✅ Korrekt |
| HR+HER2- kjemoterapivei (N0/N1mi/N1/N2+) | ✅ Detaljert, inkl. Prosigna/OncotypeDX |
| Prosigna ROR-grenseverdier (0-40/41-60/>60) | ✅ Per NBCG tabell 17.12.24 |
| OncotypeDX RS ≤25/>25 | ✅ Korrekt |
| Luminal A-like uten gentest | ✅ Ki67<10%, G1-2 |
| Luminal B-like uten gentest | ✅ Ki67>35%, G3, ER<50% |
| CDK4/6-inhibitor (NBCG 04.09.25) | ✅ Abemaciclib/ribociclib differensiering |
| Endokrinterapi (AI vs tamoxifen, OFS) | ✅ Per SOFT/TEXT |
| Zoledronsyre | ✅ Korrekte kriterier |
| Strålebehandling (grunnleggende) | ✅ BCS/mastektomi |
| Neoadjuvant (alle undergrupper) | ✅ KEYNOTE-522 for TN |
| TN adjuvant | ✅ EC90 + taxan |
| HER2+ adjuvant | ✅ Trastuzumab ± pertuzumab |

### 2.2 MANGLER — Ikke reflektert i verktøyet

#### A. Post-neoadjuvant behandling (🔴 kritisk)
- **HER2+ non-pCR**: T-DM1 14 kurer (KATHERINE) — nevnes kun i warning-string, ikke som strukturert trinn
- **TN non-pCR**: Capecitabin 6-8 kurer (CREATE-X) — nevnes kun i warning
- **pCR-vurdering**: Ingen input for patologisk respons (ypT/ypN)

#### B. Neoadjuvant indikasjons-kriterier
Verktøyet gir ingen veiledning om NÅR neoadjuvant bør velges:
- TN stadium II-III → neoadjuvant med pembrolizumab
- HER2+ stadium II-III → neoadjuvant med dobbel HER2-blokade
- HR+HER2- Luminal A → neoadjuvant endokrin

#### C. HER2-low / T-DXd
- IHC 1+ og IHC 2+/SISH- klassifiseres som "negative" (korrekt for primærbehandling)
- Men mangler flagging av HER2-low status for metastatisk T-DXd (DESTINY-Breast04)

#### D. BRCA/genetisk testing og olaparib (🔴 kritisk)
- Ingen input for BRCA-status
- Ingen olaparib-vurdering (OlympiA)
- Mangler kriterier for genetisk utredning (TN < 60 år, bilateral)

#### E. Strålebehandling — ufullstendig
Mangler:
- Hypofraksjonerte regimer (40 Gy/15 vs. 50 Gy/25)
- Boost-spesifikasjoner
- Regional stråling (aksille, supraclaviculært, parasternalt)
- PMRT-kriterier

#### F. Kirurgisk beslutningsstøtte — fraværende
- Sentinel node-kriterier
- Aksillær disseksjon vs. observasjon
- Rekonstruksjonsalternativer

#### G. Oppfølging/kontroll — fraværende

#### H. Bivirkningsmonitorering — fraværende
- CDK4/6i-spesifikk (diaré/nøytropeni/QT)
- Immunterapi (autoimmune reaksjoner)
- LVEF-monitorering ved HER2-behandling
- Input-felter (cardiacRisk, neutropeniaRisk) finnes i CQL men brukes ikke i DMN

#### I. Eldre pasienter / komorbiditet
- Geriatrisk vurdering ikke inkludert
- `age` brukes kun for endokrinterapi (<35 år)
- Reduserte regimer for eldre mangler

---

## 3. BRUKERVENNLIGHET

### Styrker
- Norsk grensesnitt
- 3-modus referansebrevgenerator
- Interaktivt beslutningstre
- Near-cutoff advarsler

### Forbedringsforslag

#### A. PatientForm
- Ingen real-time validering eller inkonsistens-sjekk
- Mangler tooltip/hjelpetekster
- Betinget felt-visning ufullstendig (gentest synlig for TN/HER2+)
- Mangler obligatorisk-markering

#### B. Resultatvisning
- `consider_chemo`/`gene_test_needed` vises kun som warnings — bør ha egne UI-elementer
- Ingen konfidenssnivå-indikasjon
- Mangler lenker til kildestudier (MonarchE, NATALEE, KEYNOTE-522)

#### C. Tilgjengelighet
- Ingen ARIA-attributter
- Ingen tastaturnavigasjon-optimering
- WCAG 2.1 AA er minstekrav for nasjonale systemer

---

## 4. TRANSPARENS

### Styrker
- DMN-tabeller synlige i "Beslutningslogikk"-fanen
- CQL-evaluering i detalj-panel
- `rationale`-felt i alle regler

### Mangler
- **Ingen referanser til handlingsprogram**: Reglene refererer ikke til kapitler/sider i NBCG
- **Ingen versjonsdifferensiering**: Umulig å se hva som endret seg ved oppdatering
- **Ingen godkjenningsflyt**: Endringer i beslutningslogikk må godkjennes av faggrupper

---

## 5. TEKNISKE ANBEFALINGER

1. **Generaliser arkitekturen**: Gjør DMN-motoren krefttype-agnostisk. Erstatt hardkodede `buildHRposHER2neg` etc. med konfigurasjonsdrevet system
2. **Eksternaliser klinisk innhold**: Flytt til egne JSON/YAML-filer eller database, adskilt fra app-koden
3. **Implementer DRD**: `evaluateDecisionChain` eksisterer men brukes ikke — bruk det for eksplisitte tabellavhengigheter
4. **FHIR-integrasjon**: Import fra journalsystemer, eksport som CarePlan, rapportering til Kreftregisteret
5. **Sikkerhet**: HelseID/ID-porten, audit-logging, ingen lagring av pasientdata i browser
6. **Kvalitetssikring**: Integrasjonstester, klinisk validering mot pasientkohorter
7. **TypeScript-migrering**: dmnSchema.ts og conflictDetector.ts er ikke integrert

---

## 6. PRIORITERT HANDLINGSLISTE

| Prioritet | Tiltak | Begrunnelse |
|-----------|--------|-------------|
| 🔴 Kritisk | Post-neoadjuvant behandlingslogikk (T-DM1, capecitabin, olaparib) | Klinisk gap |
| 🔴 Kritisk | BRCA-status og olaparib-vurdering | Mangler PARP-inhibitor |
| 🔴 Kritisk | pCR/non-pCR input og logikk | Neoadjuvant-modulen er halvferdig |
| 🟡 Høy | Generaliser til krefttype-agnostisk rammeverk | Nasjonal skalering |
| 🟡 Høy | Eksternaliser klinisk innhold | Vedlikeholdbarhet |
| 🟡 Høy | FHIR-import/eksport | Interoperabilitet |
| 🟡 Høy | Referanser til handlingsprogram per regel | Sporbarhet |
| 🟢 Middels | Fullstendig strålebehandlingslogikk | Klinisk detalj |
| 🟢 Middels | Geriatrisk/komorbiditetsvurdering | Klinisk relevans |
| 🟢 Middels | WCAG 2.1 AA tilgjengelighet | Lovkrav |
| ⚪ Lavere | Kirurgisk beslutningsstøtte | Utvidelse av scope |
| ⚪ Lavere | Oppfølgingsprotokoll | Utvidelse av scope |

---

## Oppsummering

Verktøyet er et **solid proof-of-concept** med riktig arkitekturmessig tankegang. Den kliniske implementeringen av HR+HER2- kjemoterapiveien er imponerende detaljert og korrekt per NBCG mars 2025.

For å fungere som **nasjonalt rammeverk** mangler det: post-neoadjuvant behandling, BRCA/olaparib, HER2-low-flagging, generalisering til andre krefttyper, ekte FHIR-integrasjon, og klinisk versjonskontroll med godkjenningsflyt.
