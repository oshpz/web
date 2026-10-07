# Stav projektu (7. 10. 2026)

## Hotovo
- **P0–P7** příprava: představení VV, účet aplikace@, skupina spravci@, sdílený disk TEST, GitHub (org. oshpz, repo web, 2FA), DNS test.oshpz.cz na Pages, kalendář TEST, skupiny sborů.
- **B1** struktura tabulky OSH data TEST.
- **B2** API: veřejné čtení, přihlášení, zápis akcí a termínů (Kalendar.gs).
- **B3** přihlašování a role – ověřeno (sbor podle skupiny i sloupce Kontakty).
- **B4** hlídání Disku a schvalování dokumentů – ověřeno 6. 10. 2026 (zveřejnění, vrácení k opravě, oprava názvu → zpět ke schválení, stažení z webu, kontrola Disku z aplikace).
- **B5** synchronizace s Google Kalendářem – B5.1 z tabulky do kalendáře, B5.2 úprava a zrušení, B5.3 zápis z aplikace (ověřeno 6. 10. 2026). **B5.4** schválené soutěže do kalendáře čeká na soutěže (R3 → B8).
- **B6** e-maily, připomínky, testovací režim – ověřeno.
- **B10** skupiny sborů založeny (sdh-…, okrsek-…, souhrnné).
- **F2** veřejný web na skutečná data – nasazeno na test.oshpz.cz 6. 10. 2026: `index.html` čte `akce`, `terminy`, `dokumenty` z API (funkce `loadLive`), při chybě dotaz zopakuje, při výpadku ukáže vestavěná ukázková data. `noindex` pro testovací doménu.
- **F1** aplikace OSH na skutečná data – ověřeno uživatelem 7. 10. 2026: přihlášení kódem, role ze serveru (přepínání okres / sbor), **Dokumenty** (zveřejnit, vrátit k opravě, stáhnout, zkontrolovat Disk), **Kalendář** (akce a termíny – přidat, upravit, smazat), **Záznam změn** (Správce), chybové a offline hlášky, opakování dotazu bez dvojího zápisu. Moduly, které ještě nejsou napojené, jsou po přihlášení označené „Ukázka“ (viz Rozpracováno); bez přihlášení jde spustit celá ukázka.
  API: `dokumentyVse`, `zkontrolovatDisk`, `kalendar`, `zrusitAkci`, `zrusitTermin`, `zaznamZmen`, rozhodnutí `vrátit` (s poznámkou); „Stáhnout“ vrací dokument ke schválení.
- **G2** zálohy (`Zalohy.gs`, ověřeno 7. 10. 2026): každou neděli 3:00 kopie tabulky + XLSX do složky „Zálohy“ na sdíleném disku, název `OSH data RRRRMMDD`; drží se 12 týdnů (`ZALOHY_TYDNY`), první záloha měsíce 12 měsíců. Menu OSH data → Zálohovat teď. Při chybě e-mail na spravci@. Tabulka OSH citlivé se záměrně nezálohuje.
- **G5** záznam změn (ověřeno 7. 10. 2026): zapisují se zápisy z aplikace (dokumenty, akce, termíny, přihlášení), nové a zmizelé soubory z Disku, **ruční úpravy v tabulce** (`priUprave`: u jedné buňky sloupec a hodnota před → po), mazání rodných čísel, zálohy. Sbory a Uživatelé se přes API zatím nezapisují – jejich ruční úpravy ano. 1. den v měsíci se záznamy starší než 24 měsíců přesunou do „OSH záznam změn archiv“ ve složce Zálohy. V aplikaci karta **Záznam změn** jen pro roli Správce (posledních 200, filtr list a uživatel).
- **F3** ochrana veřejných formulářů (`Ochrana.gs`) – Turnstile ověřen 7. 10. 2026: widget „OSH aplikace TEST“ v Cloudflare (účet web@oshpz.cz), klíče uloženy (site key v Nastavení, secret ve Vlastnostech skriptu), provoz vidět v Cloudflare Analytics (akce `kod`, doména test.oshpz.cz).
  - Cloudflare Turnstile (neviditelný) u žádosti o přihlašovací kód; server ověří token přes siteverify. Veřejný klíč: Nastavení → `TURNSTILE_SITEKEY` (web si ho bere z `?co=ping`), tajný: Vlastnosti skriptu → `TURNSTILE_SECRET`, domény: `TURNSTILE_DOMENY` (prázdné = z WEB_URL). Chybí klíč/token nebo nesedí doména → TEST varuje, OSTRY odmítne; neplatný token se odmítá vždy.
  - Limity: 5 žádostí o kód na e-mail za hodinu, 30 na web za 10 min, po 5 chybných kódech blokace e-mailu na 15 min; překročení v Záznamu změn.
  - Kontrola vstupů na serveru (akce, termíny, dokumenty): délka, HTML, vzorec na začátku, povolené hodnoty, data, odkaz jen https. Soubory: `overitSoubor_` (PDF, JPG, PNG, HEIC, WEBP, max 10 MB) – použít v B7; v aplikaci kontrola typu a velikosti u všech nahrávání.
  - CSP v `index.html` a `Aplikace OSH.dc.html` (vlastní doména, script.google.com, googleusercontent, unpkg, jsdelivr, Google Fonts, Google mapy, ARES, challenges.cloudflare.com).
  - **Pozn.:** veřejná přihláška člena je zatím jen ukázka bez serveru – Turnstile a `overitSoubor_` se zapojí u veřejné přihlášky v **B7**.

## Rozpracováno
- **B9** nasazení webové aplikace – clasp propojen (účet admin@oshpz.cz), nové verze: `clasp push` + `clasp deploy -i <ID nasazení>`.
  **Později:** nasazení i clasp přehodit z admin@ na aplikace@oshpz.cz (aplikace pak poběží a posílat poštu pod aplikace@).
- **Bezpečnost** (kontrola 6. 10. 2026): opraven zápis vzorců do tabulky, limity žádostí o kód, chybové hlášky, `integrity` u CDN, `noindex`; CSP a kontrola vstupů v F3. Zbývá souhlas funkcionářů s kontakty na webu (GDPR).
- **Moduly aplikace zatím jako „Ukázka“** (vymyšlená data, nic se neukládá):
  - **Soutěže** – soutěže okresu, přihlášky družstev, startovky, výsledky, závodní panel; v portálu sboru přihlášky a výsledky; soutěže v kalendáři (B5.4). Čeká na **R3 → B8**, závodní panel pak **T3**.
  - **Přihlášky členů** – veřejná přihláška, „Noví členové“ ve sboru, kontrola skenů v okrese. Čeká na **R4 → B7** (PDF + QR platba; zapojit Turnstile a `overitSoubor_` z F3), informace pro členy **G1**.
  - **Žádosti sborů** o pořádání akcí a soutěží – nečeká na okres, list Žádosti je připravený, chybí API a napojení (žádost o soutěž navazuje na B8).
  - **Majetek a rezervace vybavení** – nečeká na okres; rozhodnout, jestli napojit stávající Evidenci majetku na listy Majetek a Rezervace.
  - **Příspěvky** (aktuality od okresu a sborů) – list Příspěvky je připravený, v aplikaci jen volba „koncept článku“ u dokumentu; v plánu zatím bez úkolu.
  - **Přehled okresu a portál sboru** – souhrny, nastavení přihlášky, oznámení počítají z ukázkových modulů výše; napojí se spolu s nimi. Chybí i viditelnost „jen pro sbory“ (kalendář, dokumenty).

## Další na řadě
1. **Nenapojené moduly bez čekání na okres**: viditelnost „jen pro sbory“, portál sboru, žádosti sborů, majetek (viz Rozpracováno); soutěže a přihlášky členů až po R3/R4.
2. **F4** publikace a test na test.oshpz.cz.

## Čeká na okres (blokuje)
- **R1 + R5** formální souhlas VV s testovacím provozem a sběrem kontaktů sborů → pak formulář pro sbory → **B11** naplnění skupin.
- **R2** osoby a role (list Uživatelé).
- **R3** pravidla bodování ZHVB a uzlové štafety → **B8**.
- **R4** šablona přihlášky SH ČMS → **B7** (PDF + QR platba).
