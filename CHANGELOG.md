# Endringslogg — retningslinjeversjoner

Sporer hvilken NBCG-revisjon appens kliniske innhold er verifisert mot.
Enkelt kildepunkt for versjon: `src/guidelineVersion.js`.

| App-dato | NBCG Handlingsprogram | NBCG-tabeller | Verifisert av | Notat |
|----------|-----------------------|---------------|---------------|-------|
| 2026-07-30 | Mars 2025 | 17.12.24 / 04.09.25 / 15.11.23 | (ikke signert) | ⚠ NBCG har publisert **mars 2026**-revisjon. Innholdet er **ikke** gjennomgått mot mars 2026 ennå — må verifiseres av faggruppe før klinisk bruk. |

## Rutine ved ny NBCG-revisjon

1. Sammenlign ny revisjon mot beslutningstabellene i `src/dmn/decisionTables.js` (`guidelineSource`/`sourceRef` per tabell/regel).
2. Oppdater regler som er faglig endret — **kun etter klinisk gjennomgang**, aldri stille.
3. Oppdater `src/guidelineVersion.js` (revisjon + `verifiedDate`) og legg til en rad over med hvem som verifiserte.
4. Kjør `npx vitest run` og oppdater/legg til tester for endret logikk.
