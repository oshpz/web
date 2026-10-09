# CLAUDE.md – Web a aplikace OSH Praha – západ

Kontext pro Claude Code. Komunikuj **česky**, stručně. Uživatel (Michal Kalian) je správce Google Workspace okresu, ne vývojář na plný úvazek – u každého kroku, který dělá on (Admin konzole, Apps Script, DNS), napiš přesný postup klikání.

## Co to je
Nový web a aplikace Okresního sdružení hasičů Praha – západ (OSH PZ, 71 sborů, 12 okrsků). Nahrazuje starý Joomla web www.oshpz.cz, který **zatím běží dál** – nic na něm neměň.

- **Veřejný web** `index.html` – zprávy, kalendář, orgány a jejich zápisy, sbory (mapa, ARES), soutěže a výsledky.
- **Aplikace** `Aplikace OSH.dc.html` – portál sborů (modrý motiv `data-theme="sbor"`) a správa okresu (červený). Po přihlášení kódem pracuje se **skutečnými daty přes API**; moduly bez serveru jsou označené „Ukázka“. Bez přihlášení jde spustit celý dřívější prototyp (localStorage) – „Vyzkoušet ukázku“.
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

## API (Apps Script, `doGet` v `API.gs`, `doPost` v `Prihlaseni.gs`)
- **Veřejné GET** `?co=` (JSONP přes `&callback=`): `ping` (režim, verze, veřejný klíč Turnstile), `akce`, `terminy`, `dokumenty` (jen `Stav = zveřejněno` a viditelné pro veřejnost), `sbory` (název, okrsek, MH, JSDH, Sport – bez kontaktů), `organy` (členové orgánů; telefon/e-mail jen se souhlasem), `clanek&a=adresa` (detail příspěvku, jen zveřejněné pro veřejnost), **`web`** = vše pro `index.html` jedním dotazem (předem v mezipaměti, časovač `obnovitWebData`).
- **POST** (tělo JSON, `Content-Type: text/plain` kvůli CORS, pole `akce`, `token`, `klic`):
  - přihlášení: `kod` (+ `turnstile`), `overit`, `ja`, `odhlasit`;
  - dokumenty (role Dokumenty/Správce): `dokumentyVse`, `zkontrolovatDisk`, `dokumentRozhodnout` (zveřejnit / vrátit / zamítnout / stáhnout, `upravy` vč. Pro koho);
  - kalendář (Termíny/Správce): `kalendar`, `ulozitAkci`, `ulozitTermin`, `zrusitAkci`, `zrusitTermin`;
  - portál sboru: `portal`, `nahlasitZmenu`, `zadostiSbor`, `zadostUlozit`, `zadostStahnout`, `zadostPriloha` (vždy `sbor` = skupina, server ověří členství);
  - žádosti – okres (Akce/Správce): `zadostiOkres` (se souběhy), `zadostRozhodnout`;
  - `zaznamZmen` (Správce);
  - příspěvky (Příspěvky = zveřejnit / navrhnout, Správce): `prispevky`, `prispevekUlozit` (krok ulozit / odeslat / zverejnit, `upraveno` = kontrola souběhu), `prispevekRozhodnout` (vrátit s poznámkou / stáhnout), `prispevekSoubor`, `prispevekSouborSmazat`, `prispevekNahledy`, `prispevekSmazat` (zveřejnit / Správce, ne zveřejněný; navrhovatel jen svůj koncept);
  - majetek (Majetek/Správce): `majetekData`, `majetekUlozit` (typ majetek / osoba / kategorie / stavMajetku / stavVypujcky, `puvodni` = kontrola souběhu), `majetekVyradit`, `vypujckaNova`, `vypujckaVratit`, `majetekFoto`, `majetekFotoNahrat`.
- Zápisy z `OPAKOVATELNE` jsou idempotentní: stejný `klic` do 10 min vrátí uloženou odpověď (aplikace při výpadku opakuje). Google občas doručí POST jako GET bez parametrů → odpověď „ping“ aplikace bere jako výpadek.
- Přihlášení: sbory, VV i okres **kódem na e-mail** (bez hesla). Sbor = členství ve skupině `sdh-…@` (+ sloupec Kontakty v listu Sbory). Role = sloupce v listu **Uživatelé** (Dokumenty, Termíny, Akce, Soutěže, Majetek, Přihlášky, Příspěvky, Sbory, Správce). **Kontrola oprávnění vždy na serveru.**

## Aplikace – jak je postavená (pro úpravy v Claude Design)
- `state.mode`: `login` | `live` | `demo`. V `live` jsou napojené obrazovky v `LIVE_VIEWS` (okres: přehled, kalendář, dokumenty, žádosti, majetek, příspěvky, záznam změn) a `SB_LIVE_VIEWS` (sbor: přehled, kalendář, dokumenty, můj sbor, žádosti); ostatní ukazují lištu „Ukázka“ a neukládají.
- Volání serveru jen přes `this.api(akce, data)` (opakování, chyby, odhlášení) a pro zápisy `this.serverem(akce, data, hotovo, tlacitko)` – blokuje tlačítka a na stisknutém ukáže „Ukládám…“ (`tl.*`, `busyTl`).
- Převody řádků tabulky ↔ aplikace: `zDok`, `zKal`, `naKal`; data portálu `pt.*`, žádosti `zo.*`/`zd2.*` (okres) a `zs.*` (sbor), přehled okresu `opl.*`.
- Viditelnost **Pro koho** (veřejnost, všechny sbory, sbory s MH/JSDH/se sportem, okrsek, jen okres): pravidla jen na serveru v `smiVidet_()` (`Portal.gs`); aplikace jen zobrazuje štítky (`stitek()`, `proPopis()`).
- **CSP** je v `<meta>` obou stránek – nový externí zdroj (skript, API, rámec, písmo) je nutné do CSP doplnit, jinak ho prohlížeč zablokuje.
- Nahrávání souborů: `souborChyba()` v aplikaci a `overitSoubor_()` na serveru (PDF, obrázky, max 10 MB).

## Web (`index.html`)
- Živá data jedním dotazem `?co=web` (15 s limit, 1× opakování); bez spojení zůstanou vestavěná data. Členové orgánů, příznak MH sborů, kalendář a dokumenty pochází z tabulky. **JSDH je napevno podle HZS.**
- Vestavěný záložní seznam členů orgánů je jen jména – kontakty nepatří do kódu (jsou v listu Členové orgánů se souhlasem).

## Bezpečnost
- Text od uživatele: `kontrolaTextu_` (délka, HTML, vzorec na začátku) a `bezVzorce_` při zápisu do tabulky. Odkazy jen `https://`.
- Turnstile (Cloudflare) u žádosti o kód: site key v Nastavení `TURNSTILE_SITEKEY`, secret ve Vlastnostech skriptu `TURNSTILE_SECRET`. Limity: 5 kódů / e-mail / h, 30 / web / 10 min, po 5 chybných kódech blokace 15 min.
- Mezipaměť: Nastavení 5 min, Uživatelé a Sbory 2 min, veřejná data 5 min; ruční úprava listu ji maže (`priUprave` → `vycistitMezipamet_`, `vycistitCache_`).

## Pravidla domény
- Názvy dokumentů: `ZKRATKA RRRRMMDD Název` nebo `ZKRATKA RRRR Název` (jen rok). Zkratka = složka orgánu. Starší `RRMMDD` přijmout s upozorněním.
- Dokument se zveřejní až po schválení. Veřejný = sdílení odkazem; jinak sdílení se skupinou podle Pro koho (`sbory@`, `sbory-mh@`, `okrsek-NN@`…) přes Drive API bez oznamovacího e-mailu (`nastavitSdileni_`). Sborové skupiny nesmí být členy sdíleného disku.
- Žádosti sborů (`Zadosti.gs`): sbor upravuje jen ve stavu podáno / vráceno k doplnění; schválení vytvoří řádek v Akcích a událost v kalendáři; přílohy ve složce Žádosti/<ID> na sdíleném disku.
- **Evidence majetku** (`Majetek.gs`) jsou tři tabulky staré aplikace (ID v Nastavení `MAJETEK_*`), která běží dál a zapisuje podle pozic sloupců: neměnit hlavičky ani pořadí sloupců, nemazat řádky, ID jako stará aplikace, před zápisem kontrolovat, že se řádek nezměnil. Zdrojáky staré aplikace (`evidence-old-*`) jsou jen lokálně a v `.gitignore`.
- **Příspěvky** (`Prispevky.gs`): text je omezený Markdown, do HTML ho převádí jen `prHtml_` (kopie `prHtml` v aplikaci – měnit obě). Fotky zmenšuje prohlížeč (1600 px, bez EXIF/GPS), z e-mailu server přes náhled Disku. Sdílení souborů až po zveřejnění. Na webu autor jen jménem, nikdy e-mail.
- Listy jako zdroj pravdy pro web: **Sbory** (MH…), **Členové orgánů** (Kontakt na web = souhlas, Aktivní = NE skryje).
- **Rodné číslo** se neukládá do tabulky ani repozitáře – jen do PDF přihlášky ve složce na Disku (evidence SH ČMS ho potřebuje).
- Skupiny: `sdh-<obec>@`, `okrsek-<n>@`, souhrnné `sbory@`, `sbory-mh@`, `sbory-jsdh@` (skupiny ve skupinách; do souhrnných smí psát jen okres).
- Repozitář je **veřejný** – nikdy do něj nedávej osobní údaje, kontakty sborů (CSV s e-maily jsou v `.gitignore`), tokeny ani hesla. Tajné hodnoty patří do Script Properties.

## Apps Script přes clasp
Postup v `docs/clasp.md`. Propojeno (6. 10. 2026, účet admin@oshpz.cz): `apps-script/.clasp.json`, ID skriptu `1K2Udqwj29KQeZCMqMYeZgw0ca57rin9sXk8I0FF5sZCoy2ktAOBh1JJG`, **ID nasazení `AKfycbz175mnWiIWxmQbf9lRKkL8rNHIZzpBKq9p_B85IzVsYZhTgQYSSROeZiLGprEnNodA`** (verze 8 „B3 hotovo“). Pravda je **živý projekt v Apps Script** – při prvním propojení udělej `clasp pull` a teprve pak upravuj. Po `clasp push` je nutné nové nasazení verze (`clasp deploy -i <deploymentId>`), jinak `/exec` běží na staré verzi. URL nasazení se nesmí změnit.
Po přidání časovačů nebo nových služeb připomeň uživateli spustit `nastavitSpousteni` a povolit oprávnění.

## Stav a další kroky
`docs/stav.md` – co je hotové a co dál. Plán s Ganttem: `docs/Plan zavedeni.dc.html` (stav odškrtávání má uživatel ve svém prohlížeči, ne v souboru).

## Spolupráce s Claude Design
Návrhy nových obrazovek vznikají v Claude Design (projekt „Redesign webu hasičů Praha západ“), který čte tento repozitář. Drobné úpravy dělej přímo tady; zachovej strukturu šablon, ať je jde dál upravovat i tam.
