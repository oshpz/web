# CLAUDE.md – Web a aplikace OSH Praha – západ

Kontext pro Claude Code. Komunikuj **česky**, stručně. Uživatel (Michal Kalian) je správce Google Workspace okresu, ne vývojář na plný úvazek – u každého kroku, který dělá on (Admin konzole, Apps Script, DNS), napiš přesný postup klikání.

## Co to je
Nový web a aplikace Okresního sdružení hasičů Praha – západ (OSH PZ, 71 sborů, 12 okrsků). Nahrazuje starý Joomla web www.oshpz.cz, který **zatím běží dál** – nic na něm neměň.

- **Veřejný web** `index.html` – zprávy, kalendář, orgány a jejich zápisy, sbory (mapa, ARES), soutěže a výsledky.
- **Aplikace** `Aplikace OSH.dc.html` – portál sborů (modrý motiv `data-theme="sbor"`) a správa okresu (červený). Zatím **prototyp nad localStorage** – úkol F1 ji napojí na API.
- **Server** `apps-script/` – Google Apps Script vázaný na tabulku *OSH data TEST*, nasazený jako webová aplikace („spustit jako já“, přístup kdokoli).
- **Skupiny** `skupiny-script/` – samostatný skript v tabulce *Skupiny OSH*, zakládá Google skupiny sborů.

Hosting: GitHub Pages z větve `main`, kořen repozitáře, doména **test.oshpz.cz** (soubor `CNAME`). `.nojekyll` je nutný – jinak Pages nevydá složku `_ds/`.

## Formát souborů `.dc.html`
Stránky jsou „Design Components“ z nástroje Claude Design: běžné HTML, které načte `support.js` (runtime, **neupravovat**). Uvnitř `<x-dc>` je šablona s `{{ cesta }}` dírami, `<sc-for>`, `<sc-if>`, a `<script type="text/x-dc" data-dc-script>` s třídou `class Component extends DCLogic` (React-like: `state`, `setState`, `renderVals()` vrací hodnoty pro šablonu).
- Díry jsou jen tečkové cesty – žádné výrazy; vše spočítej v `renderVals()`.
- Styly inline v šabloně; `<helmet>` jen pro odkazy, fonty, `@keyframes`.
- Tyto soubory jdou otevřít přímo v prohlížeči i editovat v Claude Design – **zachovej formát**, nepřepisuj na React/build. Žádný bundler, žádné npm v produkci.

## Vzhled (Modernist)
`_ds/…/styles.css` + `_ds_bundle.js`, průvodce `_ds/…/readme.md`. Archivo, nulové zaoblení, silné 2px linky, popisky flush-left, fotky černobíle. Červená `#ec3013` = okres/správa, modrá `oklch(46% 0.16 265)` = sbory. Ikony Lucide. Bez emoji, bez gradientů.

## Data a ID (test)
Viz `docs/nastaveni-test.md`. Hlavní:
- API: `https://script.google.com/macros/s/AKfycbz175mnWiIWxmQbf9lRKkL8rNHIZzpBKq9p_B85IzVsYZhTgQYSSROeZiLGprEnNodA/exec`
- Tabulka OSH data TEST `1efB7L11PVpybZi_j-YILtJ_U3sCP58ESg3eKqKJP0Tg` – listy a sloupce definuje `apps-script/OSH-data-struktura.gs` (aplikace hledá sloupce **podle názvu hlavičky**).
- Sdílený disk OSHPZ – TEST `0ANaj4Bv5hwLBUk9PVA`, složka „Orgány OSH PZ“ s podsložkami VV, OKRR, OORM, OORS, OORB, OORV, OSP.
- Kalendář OSHPZ – TEST (ID v nastavení).
- List **Nastavení** v tabulce: `REZIM` = `TEST` → všechny e-maily jdou jen na `spravci@oshpz.cz`.

## API
- `GET ?co=ping|akce|terminy|dokumenty` – veřejné, jen `Stav = zveřejněno` a ne „jen okres“, cache 5 min, volitelně `&organ=`, `&rok=`, `&callback=` (JSONP).
- `POST` (tělo JSON, `Content-Type: text/plain` kvůli CORS) s `akce`: přihlášení kódem (`poslatKod`, `overitKod`), `ja`, dokumenty (`dokumentRozhodnout` …), `ulozitAkci`, `ulozitTermin`. Viz `doPost` v `Prihlaseni.gs`.
- Přihlášení: okres přes Google účet @oshpz.cz, sbory a VV **kódem na osobní e-mail** (bez hesla). Sbor se určí podle členství e-mailu ve skupině `sdh-…@oshpz.cz` (+ sloupec Kontakty v listu Sbory). Role = sloupce ANO/NE v listu **Uživatelé** (Dokumenty, Termíny, Akce, Soutěže, Majetek, Přihlášky, Příspěvky, Sbory, Správce). **Kontrola oprávnění vždy na serveru.**

## Pravidla domény
- Názvy dokumentů: `ZKRATKA RRRRMMDD Název` nebo `ZKRATKA RRRR Název` (jen rok). Zkratka = složka orgánu. Starší `RRMMDD` přijmout s upozorněním.
- Dokument se zveřejní až po schválení; pak skript nastaví sdílení odkazem.
- **Rodné číslo** se neukládá do tabulky ani repozitáře – jen do PDF přihlášky ve složce na Disku (evidence SH ČMS ho potřebuje).
- Skupiny: `sdh-<obec>@`, `okrsek-<n>@`, souhrnné `sbory@`, `sbory-mh@`, `sbory-jsdh@` (skupiny ve skupinách; do souhrnných smí psát jen okres).
- Repozitář je **veřejný** – nikdy do něj nedávej osobní údaje, kontakty sborů (CSV s e-maily jsou v `.gitignore`), tokeny ani hesla. Tajné hodnoty patří do Script Properties.

## Apps Script přes clasp
Postup v `docs/clasp.md`. Pravda je **živý projekt v Apps Script** – při prvním propojení udělej `clasp pull` a teprve pak upravuj. Po `clasp push` je nutné nové nasazení verze (`clasp deploy -i <deploymentId>`), jinak `/exec` běží na staré verzi. URL nasazení se nesmí změnit.
Po přidání časovačů nebo nových služeb připomeň uživateli spustit `nastavitSpousteni` a povolit oprávnění.

## Stav a další kroky
`docs/stav.md` – co je hotové a co dál. Plán s Ganttem: `docs/Plan zavedeni.dc.html` (stav odškrtávání má uživatel ve svém prohlížeči, ne v souboru).

## Spolupráce s Claude Design
Návrhy nových obrazovek vznikají v Claude Design (projekt „Redesign webu hasičů Praha západ“), který čte tento repozitář. Drobné úpravy dělej přímo tady; zachovej strukturu šablon, ať je jde dál upravovat i tam.
