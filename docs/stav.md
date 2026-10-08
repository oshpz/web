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
  Mladí hasiči (8. 10. 2026): seznam sborů s MH na stránce Mladí hasiči; příznak MH na celém webu bere z listu **Sbory** (sloupec MH) přes `?co=sbory` – zdroj pravdy je tabulka, bez spojení záloha = účast v soutěžích mládeže. JSDH zůstává napevno podle HZS.
  Členové orgánů (8. 10. 2026): list **Členové orgánů** (`Organy.gs`, API `?co=organy`) – zdroj pravdy pro stránky orgánů na webu. Telefon a e-mail jen při „Kontakt na web“ = ANO (souhlas, GDPR), „Aktivní“ = NE skryje. V kódu webu zůstal jen záložní seznam jmen bez kontaktů. Převedeno 8. 10. 2026 (67 lidí), převodní funkce odstraněna.
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
- **Viditelnost „Pro koho“ a portál sboru** (`Portal.gs`, ověřeno 7. 10. 2026 – sbor s MH / bez MH / web, sdílení dokumentu se skupinou sbory-mh@):
  - Pravidla jen na serveru v `smiVidet_(uzivatel, radek)`: veřejnost = „veřejnost“ a prázdné; sbor navíc „všechny sbory“, podle vlastností (MH, JSDH, Sport z listu Sbory) a „okrsek“ při shodě Okrsku; okres vše. Používá ji veřejné API (`?co=akce|terminy|dokumenty`) i portál (`portal`).
  - Dokumenty mají sloupce **Pro koho** a **Okrsek**. Neveřejný dokument se nesdílí odkazem, ale se skupinou (sbory@, sbory-mh@, sbory-jsdh@, sbory-sport@, okrsek-NN@) přes službu Drive API bez oznamovacího e-mailu; „jen okres“ = jen sdílený disk. Změna v aplikaci nebo ruční změna v tabulce sdílení upraví.
  - Neveřejné akce a termíny jsou v Google Kalendáři jako soukromé události.
  - Aplikace, okres: v kalendáři i u dokumentů volba Pro koho (+ okrsek), u zveřejněného dokumentu „Uložit změnu viditelnosti“.
  - Portál sboru (modrý): **Přehled** (akce a uzávěrky na 30 dní, nové dokumenty), **Kalendář** a **Dokumenty** se štítky („Pro sbory“, „MH“, „Okrsek 12“…) a filtrem orgánu, **Můj sbor** (údaje z listu Sbory, členové skupiny sdh-…, „Nahlásit změnu“ → e-mail na spravci@ a Záznam změn), přepínač sboru. Oznámení: blížící se termíny a nové dokumenty.
  - Web: kalendář má poznámku „Další termíny pro sbory po přihlášení“ s odkazem do aplikace. Sekce Mladí hasiči už z API nedostane položky „sbory s MH“ (nejsou veřejné).
  - Test: `vlozitTestyViditelnosti` přidá akce TEST-V1 až V4 (všechny sbory, sbory s MH, okrsek 12, jen okres).
- **B12 Žádosti sborů o pořádání akcí a soutěží** (`Zadosti.gs`, ověřeno 8. 10. 2026):
  - List Žádosti: stav „vráceno k doplnění“, nové sloupce Do, Pro koho, Kontakt, Popis, Akce – ID (přes `zalozitStrukturu`).
  - Portál sboru → **Žádosti**: formulář (typ, název, od–do, místo, pro koho, popis, vybavení jako text, kontakt předvyplněný, přílohy PDF/obrázky do Žádosti/<ID> na sdíleném disku), seznam vlastních žádostí s poznámkou okresu, úprava a stažení ve stavu podáno / vráceno k doplnění. Jen vlastní sbor, kontrola na serveru.
  - Správa okresu → **Žádosti** (role Akce nebo Správce): filtr stavu, souběh s akcemi a žádostmi ve stejné dny (stejný okrsek zvýrazněný), Schválit / Vrátit k doplnění / Zamítnout (poznámka povinná). Schválení vytvoří akci (akce sboru / soutěž, zveřejněno) a událost v kalendáři; detail soutěže doplní B8.
  - Přehled okresu (ostrý režim): počty žádostí a dokumentů ke schválení, nejbližší akce a termíny.
  - E-maily: nová / upravená žádost → role Akce (jinak spravci@); rozhodnutí → kontakt + skupina sdh-…. Vše v Záznamu změn. Test: `vlozitTestyZadosti`.
  - Čas akce (8. 10. 2026): „Celý den“, nebo Začátek a nepovinný Konec (sloupce Čas od, Čas do). Schválení je přenese do Od/Do akce – celodenní, s časem i vícedenní.
  - Vybavení zatím volný text – napojí se s modulem Majetek.

## Rozpracováno
- **B13 Majetek a rezervace** (`Majetek.gs`, nasazeno 8. 10. 2026, čeká na ověření): správa okresu → **Majetek** nad stávající Evidencí majetku (stará aplikace běží dál beze změny).
  - Zdroj: tři tabulky staré aplikace – Nastavení `MAJETEK_CISELNIKY_ID` (OSHPZ_Evidence_Číselníky), `MAJETEK_TABULKA_ID` (OSHPZ_Evidence_Majetek), `MAJETEK_VYPUJCKY_ID` (OSHPZ_Evidence_Výpůjčky); fotky do složky „Foto majetku“ na sdíleném disku `MAJETEK_FOTO_DISK` (stará aplikace fotky neukládá).
  - Souběh: čtení a zápis podle hlaviček, ID jako stará aplikace (M/O/V + 6 znaků, slug u číselníků), řádky se nemažou (vyřazení = Aktivní_záznam / Aktivní = NE, majetek navíc stav VYRAZENO), výpůjčka → PUJCENO, vrácení → Skutečné_vrácení + VRÁCENO + K_DISPOZICI (nebo zvolený stav), PO_TERMINU se nezapisuje. Zápis jen když se řádek od načtení nezměnil. Audit do Záznamu změn i do Audit_log tabulek evidence.
  - Role Majetek nebo Správce (jen Majetek → vidí jen Přehled a Majetek). Přehled (stavy, aktivní výpůjčky, po termínu, kontroly > 12 měsíců), Majetek (hledání, filtry, detail 17 polí, fotka, přidat / upravit / vyřadit), Výpůjčky (Aktivní, Po termínu, Historie, nová, vrácení), Osoby, Číselníky (přidat, upravit – deaktivovat nejde, list nemá sloupec Aktivní).
  - Detail majetku: **Dostupnost** (kalendář dvou měsíců z výpůjček, jako `getAvailability` staré aplikace; nevrácené po termínu obsazené do dneška) a **Nahlásit poškození** (`majetekPoskozeni`: stav ROZBITE jako stará aplikace – nebo stav s „ROZBIT“ v ID/názvu z číselníku, poznámka do auditu).
  - Denně 7:30 souhrn výpůjček po termínu pro roli Majetek (`souhrnVypujcekPoTerminu`).
  - Starý `code.gs` (`updateMajetek`) při úpravě vymaže Foto_URL – měnit se nebude; nová aplikace fotku dohledá ve složce Foto majetku podle názvu „<ID> …“ a odkaz vrátí (`mjFotoNajit_`, `mjFotoObnovit_`).
  - Listy **Majetek** a **Rezervace** v OSH data TEST (z B1) jsou **nahrazené** zdrojovými tabulkami Evidence majetku a nepoužívají se.
- **B9** nasazení webové aplikace – clasp propojen (účet admin@oshpz.cz), nové verze: `clasp push` + `clasp deploy -i <ID nasazení>`.
  **Později:** nasazení i clasp přehodit z admin@ na aplikace@oshpz.cz (aplikace pak poběží a posílat poštu pod aplikace@).
- **Bezpečnost** (kontrola 6. 10. 2026): opraven zápis vzorců do tabulky, limity žádostí o kód, chybové hlášky, `integrity` u CDN, `noindex`; CSP a kontrola vstupů v F3. Zbývá ověřit souhlas funkcionářů s kontakty na webu (GDPR) – v listu Členové orgánů sloupec „Kontakt na web“.
- **Moduly aplikace zatím jako „Ukázka“** (vymyšlená data, nic se neukládá):
  - **Soutěže** – soutěže okresu, přihlášky družstev, startovky, výsledky, závodní panel; v portálu sboru přihlášky a výsledky; soutěže v kalendáři (B5.4). Čeká na **R3 → B8**, závodní panel pak **T3**.
  - **Přihlášky členů** – veřejná přihláška, „Noví členové“ ve sboru, kontrola skenů v okrese. Čeká na **R4 → B7** (zápis přihlášek, PDF + QR platba; zapojit Turnstile a `overitSoubor_` z F3), informace pro členy **G1**.
  - **Příspěvky** (aktuality od okresu a sborů) – list Příspěvky je připravený, v aplikaci jen volba „koncept článku“ u dokumentu; v plánu zatím bez úkolu.
  - **Přehled okresu** – souhrny (žádosti, soutěže, vybavení) počítají z ukázkových modulů výše; napojí se spolu s nimi. V portálu sboru jsou jako ukázka karty Žádosti, Přihlášky, Výsledky a Noví členové.

## Další na řadě
1. **Napojení vybavení u žádostí sborů na evidenci majetku** (dnes volný text) a pohled sborů na majetek; soutěže a přihlášky členů až po R3/R4.
2. **F4** publikace a test na test.oshpz.cz.

## Backlog
- **Statická data pro veřejný web** (před ostrým spuštěním): skript po změně v tabulce (a každých pár minut) zapíše veřejná data jako `data/web.json` do repozitáře přes GitHub API (token ve Vlastnostech skriptu). Web je načte ze své domény za < 0,1 s, bez závislosti na výkyvech Apps Script (dnes `?co=web` 1–2 s, občas 8–24 s). Změna se na webu projeví za 1–2 min (sestavení Pages).
- Přepínání prostředí TST / PROD (`prostredi/`, `nasadit.sh`, `config.js`), druhý widget Turnstile pro oshpz.cz.
- B9: nasazení a clasp z admin@ na aplikace@.

## Čeká na okres (blokuje)
- **R1 + R5** formální souhlas VV s testovacím provozem a sběrem kontaktů sborů → pak formulář pro sbory → **B11** naplnění skupin.
- **R2** osoby a role (list Uživatelé).
- **R3** pravidla bodování ZHVB a uzlové štafety → **B8**.
- **R4** šablona přihlášky SH ČMS → **B7** (PDF + QR platba).
