# Endringslogg — retningslinjeversjoner

Sporer hvilken NBCG-revisjon appens kliniske innhold er verifisert mot.
Enkelt kildepunkt for versjon: `src/guidelineVersion.js`.

| App-dato | NBCG Handlingsprogram | NBCG-tabeller | Verifisert av | Notat |
|----------|-----------------------|---------------|---------------|-------|
| 2026-07-30 | Mars 2025 | 17.12.24 / 04.09.25 / 15.11.23 | (ikke signert) | ⚠ NBCG har publisert **mars 2026**-revisjon. Innholdet er **ikke** gjennomgått mot mars 2026 ennå — må verifiseres av faggruppe før klinisk bruk. |

## To tabellsett med hver sin revisjon

Appen inneholder to uavhengige digitaliseringer av NBCG, og de har **ikke** samme
revisjon. Tabellen over gjelder bare det første:

| Sett | Fil | Brukes av | Revisjon |
|------|-----|-----------|----------|
| Beslutningstabeller (DMN) | `src/dmn/decisionTables.js` | Pasientvurdering, Beslutningstre, Beslutningslogikk | 17.12.24 / 04.09.25 / 15.11.23 |
| Ordrette PDF-tabeller | `src/tablelookup/guidelineTables.js` | Tabelloppslag (alle versjoner) | 12.24 / 19.11.25 / 19.11.25 |

Oppslagstabellene bærer sin egen revisjon i feltet `revision` og viser den i
grensesnittet per tabell. De skal aldri merkes med `GUIDELINE_VERSION.tables`,
som beskriver DMN-settet — de to kan drive fra hverandre, og gjør det i dag:
CDK4/6-tabellen i oppslaget er `19.11.25`, altså nyere enn `04.09.25` i DMN-settet.

## Rutine ved ny NBCG-revisjon

1. Sammenlign ny revisjon mot beslutningstabellene i `src/dmn/decisionTables.js` (`guidelineSource`/`sourceRef` per tabell/regel).
2. Oppdater regler som er faglig endret — **kun etter klinisk gjennomgang**, aldri stille.
3. Oppdater `src/guidelineVersion.js` (revisjon + `verifiedDate`) og legg til en rad over med hvem som verifiserte.
4. Kjør `npx vitest run` og oppdater/legg til tester for endret logikk.
5. Ved ny revisjon av PDF-tabellene: oppdater `revision` og `source` i
   `src/tablelookup/guidelineTables.js` og tabellen over — de følger ikke
   `src/guidelineVersion.js`.
