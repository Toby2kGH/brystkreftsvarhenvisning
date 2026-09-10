# Personvern og datahåndtering

Kortfattet oversikt for vurdering (Helsedirektoratet / personvernombud).

## Ingen lagring eller overføring av pasientdata

- **Ingen server-side lagring av pasientdata.** Evalueringsendepunktene
  (`POST /api/evaluate` i `server/index.js`, og `api/evaluate.js` på Vercel)
  er statsløse: de beregner et svar og returnerer det. Ingenting skrives til
  database. SQLite-basen (`server/cds-data.sqlite`) inneholder kun
  beslutningstabeller, terskelverdier, algoritmesett og endringslogg for
  *reglene* — ingen kliniske/pasientidentifiserende data.
- **Ingen tredjepartsoverføring.** Ingen analyse, telemetri eller
  eksterne kall i forespørselsløypen. Eneste eksterne referanse er en
  vanlig lenke til nbcg.no. FHIR-bundle bruker `patientId || 'anonymous'`
  — ingen identitet kreves eller lagres.
- **localStorage lagrer kun maler**, ikke pasientdata: nøklene
  `referralLetterTemplates` og `treeLookupTemplates` inneholder gjenbrukbar
  *tekststruktur*.

## Kjent kanttilfelle

Dersom en kliniker manuelt limer pasientspesifikk tekst inn i en mal og
lagrer den, vil den teksten havne i nettleserens localStorage på den
maskinen. Standardmalene inneholder kun struktur/variabler, ikke pasientdata.
Anbefaling: ikke lagre ferdig utfylt journaltekst som mal på delte maskiner.

## Deployering

Den offentlig eksponerte flaten bør være den **skrivebeskyttede
Vercel-serverless-flaten** (`api/*`), som ikke har skrive-endepunkter.
Express-serveren (`server/index.js`) har admin-/skrive-endepunkter uten
autentisering og skal **ikke** eksponeres offentlig uten HelseID/ID-porten
og `ALLOWED_ORIGINS` satt.
