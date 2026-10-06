# Stav projektu (6. 10. 2026)

## Hotovo
- **P0–P7** příprava: představení VV, účet aplikace@, skupina spravci@, sdílený disk TEST, GitHub (org. oshpz, repo web, 2FA), DNS test.oshpz.cz na Pages, kalendář TEST, skupiny sborů.
- **B1** struktura tabulky OSH data TEST.
- **B2** API: veřejné čtení, přihlášení, zápis akcí a termínů (Kalendar.gs).
- **B3** přihlašování a role – ověřeno (sbor podle skupiny i sloupce Kontakty).
- **B5** synchronizace s Google Kalendářem – ověřeno.
- **B6** e-maily, připomínky, testovací režim – ověřeno.
- **B10** skupiny sborů založeny (sdh-…, okrsek-…, souhrnné).

## Rozpracováno
- **B4** hlídání Disku a schvalování dokumentů – funguje zveřejnění, ověřit zbývající podkroky (opravy názvů, stažení z webu).
- **B9** nasazení webové aplikace – běží, chybí ustálený postup nových verzí (vyřeší clasp).
- **F2** veřejný web na skutečná data – `index.html` čte `akce`, `terminy`, `dokumenty` z API (funkce `loadLive`), při výpadku ukáže vestavěná ukázková data. **Ještě nenahráno na Pages – první commit tohoto balíčku.** Doplnit: `<meta name="robots" content="noindex">` pro testovací doménu.

## Další na řadě
1. **F1** aplikace na skutečná data: nahradit localStorage (`oshpz-app-proto-v4`) voláním API, přihlášení kódem, chybové a offline stavy (závodní panel bez signálu).
2. **F3** ochrana veřejné přihlášky (Cloudflare Turnstile, limity).
3. **F4** publikace a test na test.oshpz.cz.
4. **G2/G5** záloha tabulky (týdně, i XLSX), záznam změn.

## Čeká na okres (blokuje)
- **R1 + R5** formální souhlas VV s testovacím provozem a sběrem kontaktů sborů → pak formulář pro sbory → **B11** naplnění skupin.
- **R2** osoby a role (list Uživatelé).
- **R3** pravidla bodování ZHVB a uzlové štafety → **B8**.
- **R4** šablona přihlášky SH ČMS → **B7** (PDF + QR platba).
