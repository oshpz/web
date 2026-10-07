# Stav projektu (6. 10. 2026)

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
- **G2** zálohy (`Zalohy.gs`, ověřeno 7. 10. 2026): každou neděli 3:00 kopie tabulky + XLSX do složky „Zálohy“ na sdíleném disku, název `OSH data RRRRMMDD`; drží se 12 týdnů (`ZALOHY_TYDNY`), první záloha měsíce 12 měsíců. Menu OSH data → Zálohovat teď. Při chybě e-mail na spravci@. Tabulka OSH citlivé se záměrně nezálohuje.
- **G5** záznam změn (ověřeno 7. 10. 2026): zapisují se zápisy z aplikace (dokumenty, akce, termíny, přihlášení), nové a zmizelé soubory z Disku, **ruční úpravy v tabulce** (`priUprave`: u jedné buňky sloupec a hodnota před → po), mazání rodných čísel, zálohy. Sbory a Uživatelé se přes API zatím nezapisují – jejich ruční úpravy ano. 1. den v měsíci se záznamy starší než 24 měsíců přesunou do „OSH záznam změn archiv“ ve složce Zálohy. V aplikaci karta **Záznam změn** jen pro roli Správce (posledních 200, filtr list a uživatel).

## Rozpracováno
- **B9** nasazení webové aplikace – clasp propojen (účet admin@oshpz.cz), nové verze: `clasp push` + `clasp deploy -i <ID nasazení>`.
  **Později:** nasazení i clasp přehodit z admin@ na aplikace@oshpz.cz (aplikace pak poběží a posílat poštu pod aplikace@).
- **Bezpečnost** (kontrola 6. 10. 2026): opraven zápis vzorců do tabulky, limity žádostí o kód, chybové hlášky, `integrity` u CDN, `noindex`; CSP a kontrola vstupů v F3. Zbývá souhlas funkcionářů s kontakty na webu (GDPR).
- **F3** ochrana veřejných formulářů (`Ochrana.gs`, nasazeno 7. 10. 2026, **čeká na klíče Turnstile**):
  - Cloudflare Turnstile (neviditelný) u žádosti o přihlašovací kód; server ověří token přes siteverify. Veřejný klíč: Nastavení → `TURNSTILE_SITEKEY` (web si ho bere z `?co=ping`), tajný: Vlastnosti skriptu → `TURNSTILE_SECRET`, domény: `TURNSTILE_DOMENY` (prázdné = z WEB_URL). Chybí klíč/token nebo nesedí doména → TEST varuje, OSTRY odmítne; neplatný token se odmítá vždy.
  - Limity: 5 žádostí o kód na e-mail za hodinu, 30 na web za 10 min, po 5 chybných kódech blokace e-mailu na 15 min; překročení v Záznamu změn.
  - Kontrola vstupů na serveru (akce, termíny, dokumenty): délka, HTML, vzorec na začátku, povolené hodnoty, data, odkaz jen https. Soubory: `overitSoubor_` (PDF, JPG, PNG, HEIC, WEBP, max 10 MB) – použít v B7; v aplikaci kontrola typu a velikosti u všech nahrávání.
  - CSP v `index.html` a `Aplikace OSH.dc.html` (vlastní doména, script.google.com, googleusercontent, unpkg, jsdelivr, Google Fonts, Google mapy, ARES, challenges.cloudflare.com).
  - Veřejná přihláška člena je zatím jen ukázka bez serveru – Turnstile a `overitSoubor_` zapojit při B7.
- **F1** aplikace na skutečná data – krok 1 nasazen (verze 10) a ověřen uživatelem 6. 10. 2026: přihlášení kódem, role ze serveru, **Dokumenty** a **Kalendář** přes API, chybové a offline hlášky. Ostatní moduly jsou po přihlášení „Ukázka“ (neukládá se); bez přihlášení jde spustit celá ukázka (dřívější prototyp).
  Nové akce API: `dokumentyVse`, `zkontrolovatDisk`, `kalendar`, `zrusitAkci`, `zrusitTermin`, rozhodnutí `vrátit` (s poznámkou). „Stáhnout“ vrací dokument ke schválení.
  Po nasazení spustit v tabulce `zalozitStrukturu` (nový sloupec Termíny → Pořadatel).

## Další na řadě
1. **F1 další kroky**: viditelnost „jen pro sbory“ (kalendář, dokumenty), portál sboru na skutečná data; soutěže a přihlášky členů až po R3/R4.
2. **F4** publikace a test na test.oshpz.cz.

## Čeká na okres (blokuje)
- **R1 + R5** formální souhlas VV s testovacím provozem a sběrem kontaktů sborů → pak formulář pro sbory → **B11** naplnění skupin.
- **R2** osoby a role (list Uživatelé).
- **R3** pravidla bodování ZHVB a uzlové štafety → **B8**.
- **R4** šablona přihlášky SH ČMS → **B7** (PDF + QR platba).
