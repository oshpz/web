# Rozhraní aplikace a serveru (G4)

Stav 25. 10. 2026. Popisuje, jak web (`index.html`), aplikace (`Aplikace OSH.dc.html`) a závodní panel (`zavod.html`) mluví se serverem (Google Apps Script, `apps-script/`), jaká data server drží a co by se muselo vyměnit při odchodu z Google Workspace. Klienti znají jen adresu serveru (`window.OSH_CONFIG.apiUrl`) a operace níže. Nový server se stejnými operacemi a stejnými odpověďmi proto web ani aplikaci nezmění.

Části mezi značkami `<!-- GEN:… -->` generuje z kódu **`node nastroje/rozhrani.mjs`**. Spouští se po každé změně API a výsledek se commitne. `--kontrola` jen ověří, že dokument sedí. `./nasadit.sh server` kontrolu spouští sám a nenasadí, když klient volá akci, kterou server nezná. Generovaný rozbor je statický (čte zvyklosti kódu), takže sloupce Kdo, Vstup a Data jsou orientační. Rozhoduje vždy kód serveru.

## 1. Volání a odpověď

- **Jedna adresa** `…/exec` (webová aplikace Apps Script, „spustit jako já“, přístup kdokoli).
  - **GET `?co=…`**: veřejné čtení. Volitelně `&callback=fn` (JSONP).
  - **POST**: tělo je JSON, posílá se jako `Content-Type: text/plain`, aby prohlížeč nedělal předběžný dotaz CORS. Tělo má pole:
    - `akce`, `token` (u přihlášených),
    - `klic`: náhodné ID požadavku pro bezpečné opakování,
    - parametry akce.
- **Odpověď** je vždy JSON.
  - Úspěch: `{ "ok": true, …data }`.
  - Chyba: `{ "ok": false, "chyba": "text pro uživatele" }`.
  - Neplatná relace: navíc `"odhlasen": true` a aplikace uživatele odhlásí.
  - Anonymní dotaz při vnitřní chybě dostane jen „Chyba serveru“, přihlášený dostane text chyby.
  - Přihlášený dostane i `_cas`, dobu kroků pro diagnostiku pomalých zápisů.
  - Neznámá akce: `"Neznámá akce"`.
- **Příklad** (bez osobních údajů):
  ```
  → {"akce":"zadostiSbor","token":"…","klic":"3f2c…","sbor":"sdh-obec"}
  ← {"ok":true,"data":[{"ID":"Z2610…","Typ":"pořádání soutěže","Název":"Pohár obce","Datum":"2026-06-13","Stav":"podáno","prilohy":[],"vybaveni":[]}],"nabidka":[{"id":"M1A2B3C","nazev":"Stan PRO 3x6"}]}
  ← {"ok":false,"chyba":"Ke sboru sdh-obec nemáte přístup."}
  ```
- **Opakování bez dvojího zápisu.** Zápisy označené ↻ (seznam `OPAKOVATELNE` v `Prihlaseni.gs`) si server pamatuje 10 minut podle `klic` + tokenu.
  - Opakovaný požadavek dostane uloženou odpověď. Když první ještě běží, počká na jeho výsledek.
  - Aplikace po výpadku nebo časovém limitu (40 s, u souborů 90 s) dotaz jednou zopakuje.
  - Google občas doručí POST jako GET bez parametrů. Odpověď „ping“ proto aplikace bere jako výpadek.

## 2. Přihlášení a oprávnění

- **Kód na e-mail** (bez hesla): `kod` → 6místný kód platný 10 minut → `overit` vrátí `token`.
  - Limity:
    - 5 kódů na e-mail za hodinu,
    - 30 kódů na celý web za 10 minut,
    - po 5 chybných kódech blokace 15 minut.
  - Před odesláním kódu se ověřuje Cloudflare Turnstile:
    - veřejný klíč (sitekey) je v Nastavení `TURNSTILE_SITEKEY`,
    - tajný klíč je ve Vlastnostech skriptu `TURNSTILE_SECRET`.
- **Relace**:
  - Token se ukládá jen jako otisk SHA-256 ve Vlastnostech skriptu (`s_<otisk>`, e-mail + platnost).
  - Platí 30 dní, pro role, které zveřejňují, 7 dní.
  - Každý požadavek znovu ověří, že uživatel je aktivní. Deaktivace v listu Uživatelé tedy odhlásí hned.
  - `odhlasit` relaci zruší, `odhlasitVsechny` (z editoru) zruší všechny.
- **Kdo je kdo**:
  - **Role okresu** jsou sloupce listu **Uživatelé**: Dokumenty, Termíny, Akce, Soutěže, Majetek, Přihlášky, Příspěvky (zveřejnit / navrhnout), Sbory, Správce.
  - **Sbor** je dán členstvím ve skupině `sdh-…@`. List *Členství skupin* se obnovuje každou hodinu z Admin SDK, k tomu sloupec Kontakty v listu Sbory.
  - Akce sboru posílají `sbor` (skupinu) a server ověří členství (`pohledSboru_`).
- **Bez přihlášení**:
  - `zavod`: kód rozhodčího v odkazu, v tabulce jen otisk, platí do konce soutěže.
  - `prihlaskaVerejna` a `prestupVerejny`: Turnstile a limity.
  - `prihlaskaUchazec` a `prestupZadatel`: osobní klíč v odkazu z e-mailu, v tabulce jen otisk.
  - Veřejné GET vrací jen zveřejněné záznamy pro veřejnost a nikdy kontakty bez souhlasu.
- **Kontrola vstupů** jen na serveru:
  - `kontrolaTextu_`: délka, HTML, vzorec na začátku. U zápisu do tabulky `bezVzorce_`.
  - Odkazy jen `https://`.
  - Soubory přes `overitSoubor_`: PDF a obrázky, nejvýš 10 MB.
- **Viditelnost „Pro koho“** počítá jen server (`smiVidet_`). Klient ji jen zobrazuje.

## 3. Mezipaměť, časovače a testovací režim

- **Mezipaměť** (CacheService):
  - Nastavení 5 minut, Uživatelé a Sbory 2 minuty, veřejná data 5 minut, Evidence majetku 2 minuty.
  - Data celého webu (`?co=web`) sestavuje předem časovač každých 5 minut. Při změně je zapíše i jako statickou kopii `data/web.json` přes GitHub API.
  - Ruční úprava listu mezipaměť smaže (`priUprave`).
- **Testovací režim**:
  - Nastavení `REZIM` = TEST: všechny e-maily jdou na `spravci@`. Výjimkou je přihlašovací kód, ten jde uživateli.
  - Testovací akce (`soutezTest…`) fungují jen v TESTu.
  - Prostředí určuje vlastnost skriptu `PROSTREDI`. Přehled chybějících nastavení vypíše `kontrolaProstredi`.

## 4. Mapa dat

- **Tabulka OSH data** (`TABULKA_ID`) je zdroj pravdy. Listy a sloupce definuje `OSH-data-struktura.gs` (příloha B) a klienti hledají sloupce podle názvu hlavičky. Vedle ní:
  - tři tabulky **Evidence majetku** (`MAJETEK_*`): stará aplikace, zápis podle pozic sloupců, strukturu neměnit;
  - tabulka **Sbory** (Skupiny OSH, `skupiny-script/`).
- **Sdílený disk** (`DISK_ID`):
  - `Orgány OSH PZ/<VV, OKRR, OORM, OORS, OORB, OORV, OSP>`: dokumenty ke schválení a zveřejnění, hlídá časovač;
  - `Žádosti/<ID>`;
  - `Příspěvky/<ID>`: fotky a přílohy, sdílí se až po zveřejnění;
  - `Soutěže/<rok>`: PDF výsledků, OZ a harmonogramu;
  - `Zálohy`: týdenní kopie tabulky a XLSX;
  - `Foto majetku` (`MAJETEK_FOTO_DISK`).
- **Můj disk účtu skriptu**, bez sdílení: `Přihlášky členů OSH (důvěrné)/<sbor>/<ID>`.
  - Obsahuje vyplněné PDF, `udaje.json` s rodným číslem a adresou, skeny a fotky.
  - Je tam i `Přestupy/<ID>`.
  - Noční údržba citlivé údaje po lhůtě maže.
- **Skupiny Google**:
  - `sdh-<obec>@` a `okrsek-<n>@`;
  - souhrnné `sbory@`, `sbory-mh@`, `sbory-jsdh@`, `sbory-sport@` (skupiny ve skupinách);
  - podle funkce `vedouci-mh@`, `starostove@`, `pokladnici@`, `jednatele@` (časovač `synchronizovatFunkce`);
  - `spravci@`.
  - Zakládá je `skupiny-script`. Změny lidí provádí `zmenaSboruRozhodnout` přes Admin SDK.
  - Neveřejné dokumenty se sdílejí se skupinou podle Pro koho.
- **Kalendář** (`KALENDAR_ID`): Akce a Termíny jako události, neveřejné jako soukromé.
- **Gmail**:
  - odesílání z účtu skriptu (oznámení, připomínky, kódy);
  - příspěvky e-mailem na alias `prispevky@` čte časovač.
- **Mimo Google**:
  - Cloudflare Turnstile;
  - GitHub (Pages a `data/web.json`, token `GITHUB_TOKEN`).
- Klíče v listu Nastavení, Vlastnosti skriptu a časovače: příloha C.

## 5. Závislosti na Googlu a náhrada při odchodu

Web a aplikace se nemění: mění se jen `apiUrl` v `config.js`. Nový server musí umět stejné akce a vracet stejný JSON. Odhad práce je ve dnech práce Claude Code a správce a nezahrnuje převod dat a testy se sbory.

| Dnes (Google) | Na co se používá | Náhrada | Náročnost |
| --- | --- | --- | --- |
| Apps Script (webová aplikace, časovače, HTML → PDF) | celý server, 97 akcí POST, 9 GET, 15 časovačů | server v Node.js (nebo PHP) na VPS / kontejneru, cron, PDF přes headless Chrome | 10–15 dní |
| Tabulka OSH data + Evidence majetku | 21 listů, ruční úpravy správců | databáze (PostgreSQL / SQLite), tabulky 1:1 podle listů. Pro ruční úpravy administrace nebo import a export do tabulky | 4–6 dní |
| CacheService, Vlastnosti skriptu | mezipaměť, relace, limity, tajné klíče | Redis nebo tabulky v databázi, tajné klíče v proměnných prostředí | 1 den |
| Disk | dokumenty orgánů, přílohy, fotky, PDF, citlivé přihlášky | úložiště souborů (S3 kompatibilní / Nextcloud). Veřejné soubory přes odkaz, ostatní jen přes server s kontrolou role. Dokumenty orgánů nahrávat aplikací místo hlídání složek | 3–5 dní |
| Gmail | oznámení, připomínky, kódy; příspěvky e-mailem | SMTP (transakční služba nebo pošta domény); příjem přes IMAP | 1–2 dny |
| Skupiny Google + Admin SDK | přihlášení sboru podle členství, rozesílky, sdílení podle Pro koho | členství v databázi (sbor ↔ e-mail). Rozesílky jako e-mailové konference u poskytovatele pošty (Mailman / aliasy). Sdílení řeší server | 3–5 dní |
| Kalendář Google | veřejný a sborový kalendář akcí | iCal: server generuje `.ics` (veřejný a pro sbory s tajným odkazem), odběr v libovolném kalendáři | 1 den |
| (zůstává) | Turnstile, GitHub Pages, statický web | beze změny | – |

**Celkem asi 25–35 dní**, převod dat a testy s okresem a sbory ještě zvlášť. Největší položky jsou přepis 97 akcí a náhrada skupin, kde se dnes opírá přihlášení sborů. Nejméně rizikový postup: po jednom modulu, nejdřív data (export listů do databáze), pak akce se stejnými názvy. Zkouší se proti stejným klientům v TESTu (`apiUrl` v `prostredi/test.config.js`).

## Příloha A: operace

### GET (veřejné, `?co=…`)
<!-- GEN:get -->
| `?co=` | Funkce | Vrací | Volá |
| --- | --- | --- | --- |
| `ping` | – | `rezim`, `cas`, `verze`, `turnstile` | aplikace, web |
| `sbory` | `sboryVerejne_` | Veřejné vlastnosti sborů pro web (zdroj pravdy = list Sbory). | web |
| `organy` | `organyVerejne_` | z listů Členové orgánů | web |
| `prispevky` | `prispevkyRok_` | Příspěvky jednoho roku pro archiv (?co=prispevky&rok=RRRR) – stejný tvar jako seznam pro web, bez textu. | web |
| `clanek` | `prClanekVerejny_` | Detail pro web (?co=clanek&a=adresa). | web |
| `web` | `obnovitWebData` | Data pro veřejný web předem do mezipaměti (časovač každých 5 minut, nastavitSpousteni). | web |
| `akce` | `cistVerejne_` | řádky listu Akce (ID, Název, Typ, Pořadatel, Od, Do, Místo, Pro koho, Okrsek, Popis, Odkaz), jen zveřejněné pro veřejnost |  |
| `terminy` | `cistVerejne_` | řádky listu Termíny (ID, Název, Datum, Typ, Pro koho, Okrsek, Popis), jen zveřejněné pro veřejnost |  |
| `dokumenty` | `cistVerejne_` | řádky listu Dokumenty (ID, Orgán, Datum, Rok, Název, Veřejný odkaz), jen zveřejněné pro veřejnost |  |
<!-- /GEN:get -->

### POST (`akce`)
<!-- GEN:akce -->
Celkem **125 akcí POST** v 17 modulech, z toho 88 zapisuje (✎) a 75 je opakovatelných (↻ – stejný `klic` do 10 min vrátí uloženou odpověď).
Sloupce: **Kdo** = stráž na serveru; **Vstup** = pole požadavku vedle `akce`, `token`, `klic` (omezení délky z `kontrolaTextu_`); **Výstup** = klíče odpovědi vedle `ok`; **Data** = listy tabulky (**tučně** = zapisuje) a *služby Googlu*, se kterými obsluha pracuje (i nepřímo); **Volá** = aplikace / web / panel.

#### Prihlaseni.gs

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `kod` ✎ ↻ | pošle přihlašovací kód na e-mail (Turnstile, limity) Chyby např.: „Zadejte platný e-mail.“ | veřejné (Turnstile, limity) | `email`, `turnstile` | – | Členství skupin, Sbory, Uživatelé, *e-mail*, *Turnstile* | aplikace, web |
| `overit` ✎ ↻ | ověří kód z e-mailu a vrátí token relace a uživatele Chyby např.: „Po několika chybných kódech je přihlášení na 15 minut zablokované. Zku“ | veřejné (kód / klíč v odkazu) | `email`, `kod` | `token`, `platnostDni`, `uzivatel` | Členství skupin, Kontakty sborů, Sbory, Uživatelé, **Záznam změn**, *e-mail* | aplikace, panel |
| `ja` | kdo je přihlášený (ověření tokenu) | přihlášený | `token` | `uzivatel` | Kontakty sborů |  |
| `odhlasit` | zruší relaci (token) | kdokoli s tokenem relace | `token` | – |  | aplikace |
| `nastaveniUlozit` ✎ | osobní nastavení uživatele okresu (výchozí pořadatel v kalendáři) Chyby např.: „Neznámý pořadatel.“ | přihlášený | `data` | `nastaveni` | **Uživatelé**, **Záznam změn** | aplikace |

#### Souhrn.gs (`apiSouhrn_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `souhrn` | po přihlášení: uživatel a položky k vyřízení podle rolí (odznaky, zvonek, přehled) | přihlášený | – | – | Akce, Členské přihlášky, Dokumenty, Druhy kvalifikací, Kontakty sborů, Přestupy, Příspěvky, Rezervace, Soutěže, Školení, Termíny, Uživatelé, Změny členů, Změny sborů, Žádosti, *Evidence majetku* | aplikace |

#### Dokumenty.gs (`apiDokumenty_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `dokumentyKeSchvaleni` | dokumenty ve stavu ke schválení Chyby např.: „Nemáte oprávnění schvalovat dokumenty.“ | role Dokumenty / Správce | – | `data` | Dokumenty |  |
| `dokumentyVse` | všechny dokumenty pro správu Chyby např.: „Nemáte oprávnění schvalovat dokumenty.“ | role Dokumenty / Správce | – | `data` | Dokumenty | aplikace |
| `zkontrolovatDisk` ✎ ↻ | hned zkontroluje složky orgánů na Disku (nové soubory ke schválení) Chyby např.: „Nemáte oprávnění schvalovat dokumenty.“ | role Dokumenty / Správce | – | `nove`, `data` | Dokumenty | aplikace |
| `dokumentRozhodnout` ✎ ↻ | Zveřejní, vrátí k opravě (zamítne) nebo stáhne dokument. `rozhodnoutDokument_` | role Dokumenty / Správce | `upravy`, `poznamka`, `rozhodnuti`, `id` | `data` | **Dokumenty**, **Záznam změn**, *Disk* | aplikace |

#### Kalendar.gs (`apiKalendar_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `kalendar` | akce a termíny okresu pro správu (i koncepty, bez zrušených) | role Správce / Termíny | – | `data` | Akce, Termíny | aplikace, web |
| `ulozitAkci` ✎ ↻ | nová / upravená akce okresu, zápis do Google Kalendáře Chyby např.: „Nemáte oprávnění spravovat kalendář okresu.“ | role Správce / Termíny | `data`, `id` (Název ≤ 200, Pořadatel ≤ 100, Místo ≤ 200, Popis ≤ 5000, Odkaz ≤ 500) | `data` | **Akce**, **Termíny**, **Záznam změn**, *Kalendář* | aplikace |
| `ulozitTermin` ✎ ↻ | nový / upravený termín (uzávěrka, jednání…), zápis do kalendáře Chyby např.: „Nemáte oprávnění spravovat kalendář okresu.“ | role Správce / Termíny | `data`, `id` (Název ≤ 200, Pořadatel ≤ 100, Místo ≤ 200, Popis ≤ 5000, Odkaz ≤ 500) | `data` | **Akce**, **Termíny**, **Záznam změn**, *Kalendář* | aplikace |
| `zrusitAkci` ✎ ↻ | „Smazat“ z aplikace = Stav zrušeno. `zrusitZaznam_` Chyby např.: „Chybí ID záznamu.“ | role Správce / Termíny | `id` | – | **Rezervace**, **Soutěže**, **Záznam změn**, **Žádosti**, *Kalendář* | aplikace |
| `zrusitTermin` ✎ ↻ | zrušení termínu (Stav zrušeno, událost z kalendáře pryč) `zrusitZaznam_` Chyby např.: „Chybí název.“ | role Správce / Termíny | `id`, `data` (Název ≤ 200, Pořadatel ≤ 100, Místo ≤ 200, Popis ≤ 5000, Odkaz ≤ 500) | `data` | Akce, **Rezervace**, **Soutěže**, Termíny, **Záznam změn**, **Žádosti**, *Kalendář* | aplikace |

#### Zalohy.gs (`apiZaznam_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `zaznamZmen` | posledních 200 záznamů změn s filtrem listu a uživatele Chyby např.: „Záznam změn vidí jen správce.“ | role Správce | `list`, `uzivatel` | `data`, `listy`, `uzivatele`, `celkem` | Záznam změn | aplikace |

#### Portal.gs (`apiNahlasitZmenu_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `portal` | portál sboru: akce, termíny, dokumenty podle Pro koho, údaje a členové sboru, položky k vyřízení Chyby např.: „Ke sboru“ | sbor (člen skupiny) | `sbor` | `sbor`, `akce`, `terminy`, `dokumenty`, `clenove`, `prispevky`, `prihlasky`, `souteze` | Akce, Členské přihlášky, Členství skupin, Dokumenty, Přestupy, Přihlášky družstev, Příspěvky, Sbory, Soutěže, Termíny, Uživatelé | aplikace |
| `nahlasitZmenu` ✎ ↻ | volný text o změně údajů sboru e-mailem okresu Chyby např.: „Ke sboru“ | sbor (člen skupiny) | `sbor`, `text` | – | Sbory, **Záznam změn**, *e-mail* | aplikace |

#### Zadosti.gs (`apiZadosti_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `zadostiSbor` | žádosti sboru a nabídka vybavení okresu | sbor (člen skupiny) | – | `data`, `nabidka` | Nabídka majetku, Rezervace, Žádosti, *Disk*, *Evidence majetku* | aplikace |
| `zadostUlozit` ✎ ↻ | podání / úprava žádosti o pořádání akce nebo soutěže (vč. `zadostUlozit_` Chyby např.: „Příliš mnoho uložení žádostí za hodinu. Zkuste to později.“ | sbor (člen skupiny) | `data`, `id` (Název ≤ 200, Místo ≤ 200, Popis ≤ 5000, Vybavení ≤ 1000, Kontakt ≤ 254) | `data` | Nabídka majetku, **Rezervace**, Uživatelé, **Záznam změn**, **Žádosti**, *e-mail*, *Disk*, *Evidence majetku* | aplikace |
| `zadostStahnout` ✎ ↻ | sbor zruší svou žádost (stav zrušeno) `zadostZmenitStav_` Chyby např.: „Žádost nenalezena.“ | sbor (člen skupiny) | `id` | – | **Záznam změn**, **Žádosti** | aplikace |
| `zadostPriloha` ✎ ↻ | Jedna příloha (base64) k žádosti ve stavu podáno / vráceno k doplnění. `zadostPriloha_` Chyby např.: „Žádost nenalezena.“ | sbor (člen skupiny) | `id`, `nazev`, `mime`, `data` | `prilohy` | **Záznam změn**, **Žádosti**, *Disk* | aplikace |
| `zadostiOkres` | žádosti všech sborů pro okres se souběhy termínů `zadostiOkres_` | role Akce / Správce | – | `data` | Rezervace, Žádosti, *Disk*, *Evidence majetku* | aplikace |
| `zadostPrilohy` | přílohy vyřízené žádosti až v detailu (seznam je bez nich – S5 revize) `zadostJson_` Chyby např.: „Žádost nenalezena.“ | role Akce / Správce | `id` | `id`, `prilohy` | Žádosti, *Disk* | aplikace |
| `zadostRozhodnout` ✎ ↻ | okres schválí (řádek Akce + kalendář, potvrzené vybavení) / vrátí / zamítne žádost `zadostRozhodnout_` Chyby např.: „Neznámé rozhodnutí.“ | role Akce / Správce | `id`, `rozhodnuti`, `poznamka` | `akceId`, `vybaveni`, `data` | **Akce**, **Rezervace**, Sbory, **Soutěže**, Termíny, Uživatelé, **Záznam změn**, **Žádosti**, *e-mail*, *Disk*, *Kalendář*, *Evidence majetku* | aplikace |

#### Majetek.gs (`apiMajetek_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `majetekData` | Data evidence + nabídka sborům a rezervace z OSH data (ty se čtou vždy čerstvé, nejsou v mezipaměti evidence). `mjDataSRezervacemi_` | role Majetek / Správce | `cerstva` | – | Nabídka majetku, Rezervace, Žádosti, *Evidence majetku* | aplikace |
| `majetekUlozit` ✎ ↻ | Přidat / upravit majetek, osobu nebo položku číselníku. `mjUlozit_` Chyby např.: „Neznámý typ záznamu.“ | role Majetek / Správce | `typ`, `data`, `id`, `puvodni` | `id`, `zmen` | **Záznam změn**, *Evidence majetku* | aplikace |
| `majetekVyradit` ✎ ↻ | Vyřazení bez mazání: majetek → Aktivní_záznam NE (+ stav VYRAZENO, ať ho stará aplikace ukáže jako vyřazený), osoba → Aktivní NE. `mjVyradit_` Chyby např.: „Vyřadit jde jen majetek nebo osobu.“ | role Majetek / Správce | `typ`, `id`, `puvodni`, `data` | `id`, `zmen` | **Záznam změn**, *Evidence majetku* | aplikace |
| `vypujckaNova` ✎ ↻ | Nová výpůjčka – jen majetek aktivní a K_DISPOZICI. `mjVypujcka_` Chyby např.: „Majetek v evidenci není.“ | role Majetek / Správce | `data`, `rezervace` (Jméno_příjmení ≤ 200, SDH_příjemce ≤ 200, Účel_použití ≤ 300, Místo_použití ≤ 300, Stav_při_půjčení ≤ 300) | `id` | **Rezervace**, **Záznam změn**, *Evidence majetku* | aplikace |
| `vypujckaVratit` ✎ ↻ | Vrácení: Skutečné_vrácení = dnes, VRÁCENO, Stav_při_vrácení. `mjVratit_` Chyby např.: „Neznámý stav majetku.“ | role Majetek / Správce | `data`, `stavMajetku`, `id`, `puvodni` (Stav_při_vrácení ≤ 300, Poznámka ≤ 2000) | – | **Rezervace**, **Záznam změn**, *Evidence majetku* | aplikace |
| `majetekFoto` ✎ | Náhled fotky jako data. `mjFoto_` | role Majetek / Správce | `id` | `foto`, `chybaFoto`, `url`, `obnoveno` | **Záznam změn**, *Disk*, *Evidence majetku* | aplikace |
| `majetekFotoNahrat` ✎ ↻ | Nová fotka do složky „Foto majetku“ na sdíleném disku evidence (MAJETEK_FOTO_DISK) a odkaz do Foto_URL. `mjFotoNahrat_` Chyby např.: „Soubor se nepodařilo přečíst.“ | role Majetek / Správce | `data`, `mime`, `nazev`, `id`, `puvodni` | `url` | **Záznam změn**, *Disk*, *Evidence majetku* | aplikace |
| `majetekPoskozeni` ✎ ↻ | Nahlášení poškození – stejně jako nahlasitPoskozeni ve staré aplikaci. `mjPoskozeni_` Chyby např.: „Majetek v evidenci není. Načtěte znovu.“ | role Majetek / Správce | `poznamka`, `id`, `puvodni` | `stav` | **Záznam změn**, *Evidence majetku* | aplikace |
| `majetekProtokol` ✎ | Předávací protokol nebo protokol o vrácení pro jednu či více výpůjček (jedna výpůjčka = jedna věc). `mjProtokol_` Chyby např.: „Některá výpůjčka už v evidenci není. Načtěte znovu.“ | role Majetek / Správce | `typ`, `udaje`, `vypujcky` (zastupce ≤ 200, prijemce ≤ 200, sdh ≤ 200, misto ≤ 200, poznamka ≤ 1000) | `nazev`, `data` | Nabídka majetku, Rezervace, **Záznam změn**, Žádosti, *Evidence majetku* | aplikace |
| `majetekNabidka` ✎ ↻ | Zapnutí / vypnutí nabídky sborům u jedné věci. `mjNabidkaUlozit_` Chyby např.: „Majetek v evidenci není. Načtěte znovu.“ | role Majetek / Správce | `id`, `poznamka`, `nabizet` | – | **Nabídka majetku**, **Záznam změn**, *Evidence majetku* | aplikace |
| `rezervaceRozhodnout` ✎ ↻ | role Majetek potvrdí / zamítne vybavení sboru (samostatná zápůjčka i vybavení schválené akce) `rezRozhodnout_` Chyby např.: „Vyberte věci.“ | role Majetek / Správce | `ids`, `rozhodnuti`, `duvod` | `zprava` | **Rezervace**, Sbory, **Záznam změn**, Žádosti, *e-mail*, *Evidence majetku* | aplikace |
| `rezervaceZrusit` ✎ ↻ | Zrušení potvrzené rezervace (např. `rezZrusitOkresem_` Chyby např.: „Rezervace nenalezena. Načtěte znovu.“ | role Majetek / Správce | `poznamka`, `id` | – | **Rezervace**, Sbory, **Záznam změn**, Žádosti, *e-mail*, *Evidence majetku* | aplikace |

#### MajetekSbory.gs (`apiVybaveniSbor_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `vybaveniSbor` | portál sboru: nabídka vybavení okresu a zápůjčky sboru `vybaveniSbor_` | sbor (člen skupiny) | – | `nabidka`, `data`, `sbor` | Nabídka majetku, Rezervace, Žádosti, *Evidence majetku* | aplikace |
| `vybaveniZadost` ✎ ↻ | portál sboru: samostatná žádost o zápůjčku vybavení (bez akce) – schvaluje role Majetek `vybaveniZadost_` Chyby např.: „Příliš mnoho žádostí za hodinu. Zkuste to později.“ | sbor (člen skupiny) | `data` (Účel ≤ 200, Místo ≤ 200, Kontakt ≤ 254, Poznámka ≤ 1000) | – | Nabídka majetku, **Rezervace**, Uživatelé, **Záznam změn**, Žádosti, *e-mail*, *Evidence majetku* | aplikace |
| `vybaveniZrusit` ✎ ↻ | portál sboru: zrušení vlastní zápůjčky (dokud není vydaná) `vybaveniZrusit_` Chyby např.: „Zápůjčku už nejde zrušit (je vydaná nebo vyřízená). Načtěte znovu.“ | sbor (člen skupiny) | `id` | – | **Rezervace**, Uživatelé, **Záznam změn**, Žádosti, *e-mail*, *Evidence majetku* | aplikace |

#### Prispevky.gs (`apiPrispevky_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `prispevky` | zveřejnit: všechny příspěvky. `prSeznam_` | role Správce / Příspěvky | – | `data`, `dokumenty`, `role`, `email` | Příspěvky, Uživatelé | aplikace |
| `prispevekUlozit` ✎ ↻ | Uložení obsahu + krok. `prUlozit_` Chyby např.: „Neznámý krok.“ | role Správce / Příspěvky | `data`, `krok`, `id`, `upraveno` | `id`, `data` | **Příspěvky**, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prispevekRozhodnout` ✎ ↻ | Vrátit k úpravě (povinná poznámka) / stáhnout z webu. `prRozhodnout_` Chyby např.: „Vracet a stahovat může jen role Příspěvky = zveřejnit.“ | role Správce / Příspěvky | `rozhodnuti`, `poznamka`, `id` | `data` | **Příspěvky**, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prispevekSoubor` ✎ ↻ | Jeden soubor (base64). `prSoubor_` Chyby např.: „Soubor se nepodařilo přečíst.“ | role Správce / Příspěvky | `druh`, `nazev`, `mime`, `data`, `id` | `soubor`, `data` | **Příspěvky**, Uživatelé, **Záznam změn**, *Disk* | aplikace |
| `prispevekSouborSmazat` ✎ ↻ | smaže fotku nebo přílohu příspěvku `prSouborSmazat_` Chyby např.: „Příspěvek nenalezen. Načtěte znovu.“ | role Správce / Příspěvky | `id`, `soubor` | `data` | **Příspěvky**, Uživatelé, **Záznam změn**, *Disk* | aplikace |
| `prispevekNahledy` | Malé náhledy fotek pro editor (fotky nemusí být sdílené). `prNahledy_` Chyby např.: „Příspěvek nenalezen.“ | role Správce / Příspěvky | `id` | `nahledy` | Příspěvky, *Disk* | aplikace |
| `prispevekSmazat` ✎ ↻ | Smazání příspěvku: role zveřejnit / Správce (ne zveřejněný – ten se nejdřív stáhne), navrhovatel jen svůj koncept. `prSmazat_` Chyby např.: „Příspěvek nenalezen. Načtěte znovu.“ | role Správce / Příspěvky | `id`, `upraveno` | `id` | **Příspěvky**, **Záznam změn**, *Disk* | aplikace |

#### ZmenySboru.gs (`apiZmenySboru_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `mujSbor` | lidé ve skupině sboru, jejich funkce a údaje sboru, návrhy změn `mujSbor_` | sbor (člen skupiny) | – | `skupina`, `lide`, `udaje`, `funkce`, `zadosti` | Členství skupin, Kontakty sborů, Sbory, Změny sborů | aplikace |
| `zmenaSboruPodat` ✎ ↻ | sbor navrhne změny lidí a údajů (schvaluje okres) `zmenaPodat_` Chyby např.: „Žádné změny k odeslání.“ | sbor (člen skupiny) | `zmeny`, `poznamka` | `id`, `data` | Členství skupin, Kontakty sborů, Sbory, Uživatelé, **Záznam změn**, **Změny sborů**, *e-mail* | aplikace |
| `zmenaSboruStahnout` ✎ ↻ | sbor zruší svůj návrh změn `zmenaStahnout_` Chyby např.: „Žádost nenalezena.“ | sbor (člen skupiny) | `id` | `data`, `skupina`, `lide`, `udaje`, `funkce`, `zadosti` | Členství skupin, Kontakty sborů, Sbory, **Záznam změn**, **Změny sborů** | aplikace |
| `kontaktySboru` | Kontakty sborů pro okres (role Sbory / Správce). `kontaktyOkres_` Chyby např.: „Kontakty sborů vidí jen role Sbory nebo Správce.“ | role Sbory / Správce | – | `sbory`, `lide`, `funkce`, `domena` | Členství skupin, Kontakty sborů, Sbory | aplikace |
| `zmenySboru` | návrhy změn všech sborů pro okres `zmenyOkres_` | role Sbory / Správce | – | `data` | Členství skupin, Kontakty sborů, Sbory, Změny sborů | aplikace |
| `zmenaSboruRozhodnout` ✎ ↻ | okres schválí (provede ve skupinách a listech) / zamítne návrh změn `zmenaRozhodnout_` Chyby např.: „Neznámé rozhodnutí.“ | role Sbory / Správce | `id`, `rozhodnuti`, `poznamka` | `vysledek`, `data` | **Členství skupin**, **Kontakty sborů**, **Sbory**, **Záznam změn**, **Změny sborů**, *e-mail*, *Skupiny* | aplikace |

#### Souteze.gs (`apiSouteze_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `zavod` ✎ | závodní panel rozhodčích – bez přihlášení (kód v odkazu, Souteze.gs) Chyby např.: „Příliš mnoho neplatných odkazů. Zkuste to za 10 minut.“ | veřejné (kód / klíč v odkazu) | `kod`, `krok`, `zapisy`, `jmeno`, `shoda` | – | Akce, **Přihlášky družstev**, **Soutěže**, Uživatelé, **Výsledky**, **Záznam změn**, *e-mail* | aplikace, panel |
| `soutezeOkres` | Seznam pro okres: soutěže (podle role), poháry, schválené žádosti o pořádání soutěže bez založené soutěže. `soOkres_` | role Správce / Soutěže | – | `data`, `pohary`, `zadosti`, `sbory`, `role`, `hotove` | Akce, Poháry, Přihlášky družstev, Sbory, Soutěže, Výsledky, Žádosti | aplikace |
| `soutez` | Detail pro okres: soutěž, družstva (s kontaktem), výsledky, pořadí, pohár. `soDetail_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id` | `data`, `druzstva`, `vysledky`, `poradi`, `harm` | Akce, Členové, Přihlášky družstev, Soutěže, Výsledky | aplikace, web |
| `soutezUlozit` ✎ ↻ | Založení / úprava soutěže. `soUlozit_` Chyby např.: „Sbor zakládá soutěž žádostí o pořádání (Žádosti).“ | role Správce / Soutěže | `data`, `id`, `zadost` | – | **Akce**, Poháry, Přihlášky družstev, **Soutěže**, Termíny, Výsledky, **Záznam změn**, Žádosti, *Disk*, *Kalendář* | aplikace |
| `soutezStav` ✎ ↻ | Přechody stavu. Okres. `soZmenitStav_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `stav` | – | **Akce**, **Přihlášky družstev**, **Rezervace**, **Soutěže**, Uživatelé, **Výsledky**, **Záznam změn**, **Žádosti**, *e-mail*, *Disk*, *Kalendář* | aplikace |
| `soutezStart` ✎ ↻ | Startovní pořadí v kategorii. `soStart_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `kategorie`, `los`, `poradi` | – | Akce, **Přihlášky družstev**, Soutěže, Výsledky, **Záznam změn** | aplikace |
| `soutezRozradit` ✎ ↻ | Akce soutezRozradit: rozřadí přihlášené (uzlová štafeta) ke stojanům a podle 1. `soRozradit_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id` | – | Akce, **Přihlášky družstev**, Soutěže, Výsledky, **Záznam změn** | aplikace |
| `soutezHarmonogram` ✎ ↻ | Akce soutezHarmonogram. `soHarmonogram_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `nast`, `los`, `pdf` | – | Akce, Přihlášky družstev, **Soutěže**, Výsledky, **Záznam změn**, *Disk* | aplikace |
| `soutezTestLiga` ✎ ↻ | Testovací liga (jen TEST). `soTestLiga_` Chyby např.: „Testovací liga jde vložit jen v TESTu.“ | role Správce / Soutěže | `data`, `id`, `zadost`, `stav`, `krok`, `naKategorii`, `zrusit`, `jmeno`, `shoda`, `zapisy` | `pohar`, `poradi` | **Akce**, **Poháry**, **Přihlášky družstev**, Sbory, **Soutěže**, Termíny, Uživatelé, **Výsledky**, **Záznam změn**, **Žádosti**, *e-mail*, *Disk*, *Kalendář* | aplikace |
| `soutezTest` ✎ ↻ | Akce soutezTest: krok prihlasky = doplní vymyšlené závodníky / družstva (pocet), krok vysledky = náhodné výsledky chybějícím pokusům. `soTestDoplnit_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `krok`, `naKategorii`, `jmeno`, `shoda`, `zapisy` | – | Akce, **Přihlášky družstev**, Sbory, **Soutěže**, Uživatelé, **Výsledky**, **Záznam změn**, *e-mail* | aplikace |
| `soutezDruzstvo` ✎ ↻ | Okres přidá / upraví / odhlásí družstvo kdykoli před ověřením (pozdní přihláška, přihláška na místě). `soDruzstvoOkres_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `data`, `prihlaska`, `odhlasit` | `id` | Akce, **Přihlášky družstev**, Sbory, Soutěže, Výsledky, **Záznam změn** | aplikace |
| `soutezZverejnit` ✎ ↻ | Zveřejní ověřené výsledky. `soZverejnit_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id`, `zrusit`, `stav` | – | **Akce**, **Přihlášky družstev**, **Soutěže**, Uživatelé, **Výsledky**, **Záznam změn**, **Žádosti**, *e-mail*, *Disk*, *Kalendář* | aplikace |
| `poharUlozit` ✎ ↻ | pohár / liga / ročník Plamenu okresu `soPoharUlozit_` Chyby např.: „Poháry pro“ | role Správce / Soutěže | `data`, `id` | `pohar`, `poradi` | Akce, **Poháry**, Přihlášky družstev, Soutěže, Výsledky, **Záznam změn** | aplikace |
| `soutezOz` ✎ ↻ | PDF organizačního zabezpečení soutěže na Disk `soOzVytvorit_` Chyby např.: „Soutěž nenalezena.“ | role Správce / Soutěže | `id` | – | **Akce**, Přihlášky družstev, **Soutěže**, Výsledky, **Záznam změn**, *Disk* | aplikace |
| `soutezeSbor` | Portál sboru → Soutěže, seznam (lehký – bez startovek a výsledků. `soSbor_` | sbor (člen skupiny) | – | `data`, `sbor` | Akce, Poháry, Přihlášky družstev, Sbory, Soutěže, Výsledky | aplikace |
| `soutezSbor` | detail jedné soutěže pro sbor (informace, naše družstva, startovní pořadí, výsledky) `soSborDetail_` Chyby např.: „Soutěž nenalezena.“ | sbor (člen skupiny) | `id` | `data` | Akce, Přihlášky družstev, Soutěže, Výsledky | aplikace |
| `soutezPrihlasit` ✎ ↻ | sbor přihlásí / upraví družstvo (limity OZ) `soPrihlasit_` Chyby např.: „Soutěž nenalezena.“ | sbor (člen skupiny) | `id`, `data`, `prihlaska` | `id`, `data`, `sbor` | Akce, Poháry, **Přihlášky družstev**, Sbory, Soutěže, Výsledky, **Záznam změn** | aplikace |
| `soutezOdhlasit` ✎ ↻ | sbor odhlásí družstvo `soOdhlasit_` Chyby např.: „Soutěž nenalezena.“ | sbor (člen skupiny) | `id`, `prihlaska` | `id`, `data`, `sbor` | Akce, Poháry, **Přihlášky družstev**, Sbory, Soutěže, Výsledky, **Záznam změn** | aplikace |

#### Prestupy.gs (`apiPrestupy_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `prestupVerejny` ✎ ↻ | žádost o přestup z webu – bez přihlášení (Turnstile + limity, Prestupy.gs) Chyby např.: „Služba je teď přetížená. Zkuste to za 10 minut.“ | veřejné (Turnstile, limity) | `turnstile`, `data` | – | **Přestupy**, Sbory, Uživatelé, **Záznam změn**, *e-mail*, *Turnstile* | web |
| `prestupZadatel` ✎ | osobní odkaz žadatele o přestup Chyby např.: „Odkaz neplatí.“ | veřejné (kód / klíč v odkazu) | `k`, `krok`, `nazev`, `mime`, `data` | `nazev`, `data` | **Přestupy**, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | web |
| `prestupyOkres` | všechny přestupy pro okres Chyby např.: „Přestupy vyřizuje role Přihlášky nebo Správce.“ | role Přihlášky / Správce | – | `data` | Přestupy | aplikace |
| `prestupRozhodnout` ✎ ↻ | Okres: provést (zapsáno v evidenci. `prsRozhodnout_` Chyby např.: „Přestupy vyřizuje role Přihlášky nebo Správce.“ | role Přihlášky / Správce | `id`, `rozhodnuti`, `duvod`, `datum` | `data` | **Členové**, **Přestupy**, Sbory, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `prestupPdf` | okres nebo sbor, kterého se přestup týká `prsPdf_` | role Přihlášky / Správce nebo sbor (člen skupiny) | – | `nazev`, `data` |  | aplikace |
| `prestupSkenStahnout` | okres nebo sbor, kterého se přestup týká `prsSkenStahnout_` Chyby např.: „Sken zatím není nahraný.“ | role Přihlášky / Správce nebo sbor (člen skupiny) | – | `nazev`, `mime`, `data` | *Disk* | aplikace |
| `prestupySbor` | přestupy, kterých se sbor týká | sbor (člen skupiny) | – | `data`, `sbory` | Přestupy, Sbory | aplikace |
| `prestupNovy` ✎ ↻ | Založení žádosti. zdroj 'web' (žadatel) / 'sbor' (přijímající sbor – jeho souhlas je tím daný) / 'test'. `prsZalozit_` Chyby např.: „Příliš mnoho přestupů za hodinu. Zkuste to později.“ | sbor (člen skupiny) | `data`, `id` | – | **Přestupy**, Sbory, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `prestupSouhlas` ✎ ↻ | Souhlas nebo nesouhlas sboru z okresu (sk = skupina přihlášeného sboru). `prsSouhlas_` Chyby např.: „O přestupu už se rozhoduje dál (“ | sbor (člen skupiny) | `souhlas`, `duvod` | `data` | **Přestupy**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `prestupSken` ✎ ↻ | Sken papírového lístku = souhlas sboru z jiného okresu. `prsSken_` Chyby např.: „Přestup je uzavřený (“ | sbor (člen skupiny) | `nazev`, `mime`, `data` | `data` | **Přestupy**, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prestupZrusit` ✎ ↻ | přijímající sbor zruší žádost o přestup `prsZrusit_` Chyby např.: „Žádost může zrušit přijímající sbor nebo žadatel.“ | sbor (člen skupiny) | – | `data` | **Přestupy**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |

#### Prihlasky.gs (`apiPrihlasky_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `prihlaskaVerejna` ✎ ↻ | veřejný formulář na webu – bez přihlášení (Turnstile + limity) Chyby např.: „Online přihlášky jsou teď vypnuté. Ozvěte se kanceláři OSH.“ | veřejné (Turnstile, limity) | `turnstile`, `data`, `sbor` | `id`, `vs`, `kategorie`, `odkaz`, `data` | **Členské přihlášky**, Sbory, Uživatelé, **Záznam změn**, *e-mail*, *Disk*, *Turnstile* | web |
| `prihlaskaUchazec` ✎ | osobní odkaz uchazeče (stav, PDF, sken, doplnění) – bez přihlášení, klíč v odkazu Chyby např.: „Akce se nepodařila. Zkuste to prosím znovu.“ | veřejné | `k`, `krok`, `nazev`, `mime`, `data` | – | **Členské přihlášky**, Sbory, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | web |
| `prihlaskySbor` | přihlášky sboru, jeho nastavení příspěvků a odvod okresu | sbor (člen skupiny) | – | `data`, `ucet`, `prispevek`, `nastaveni`, `odvod`, `zapnuto`, `sbory` | Členské přihlášky, Sbory | aplikace |
| `prihlaskaNova` ✎ ↻ | Založení přihlášky. zdroj 'web' = žádost uchazeče (fotka povinná, sportovce a datum výboru určí sbor při přijetí, uchazeč dostane osobní odkaz). `prhZalozit_` Chyby např.: „Sbor nenalezen v listu Sbory.“ | sbor (člen skupiny) | `data`, `id` | `id`, `vs`, `kategorie`, `odkaz`, `data` | **Členské přihlášky**, Sbory, Uživatelé, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prihlaskyNastaveni` ✎ ↻ | Sbor si sám nastaví výši příspěvků a výchozí „sportovec“ u MH a dospělých (vnitřní nastavení sboru – okres to neschvaluje). `prhUlozitNastaveni_` Chyby např.: „Příspěvek zadejte jako celé číslo v Kč (0–99999), nebo nechte prázdné.“ | sbor (člen skupiny) | `prispevekDospely`, `prispevekMH`, `dospelySportovec`, `mhSportovec` | `nastaveni` | **Sbory**, **Záznam změn** | aplikace |
| `prihlaskaSken` ✎ ↻ | Sken podepsané přihlášky – jen nahraje (předání okresu je zvlášť. `prhSken_` Chyby např.: „Sken jde nahrát jen k přihlášce, která ještě není u okresu.“ | sbor (člen skupiny) | `nazev`, `mime`, `data` | `data` | **Členské přihlášky**, **Záznam změn**, *Disk* | aplikace |
| `prihlaskaPosoudit` ✎ ↻ | Sbor posoudí žádost uchazeče (výbor SDH). `prhPosoudit_` Chyby např.: „O přihlášce už je rozhodnuto (“ | sbor (člen skupiny) | `rozhodnuti`, `poznamka`, `sportovec`, `datumVyboru` | `data` | **Členské přihlášky**, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prihlaskaFotkaNahrat` ✎ ↻ | Digitální fotka člena (JPEG/PNG, zmenšená prohlížečem). `prhFotka_` Chyby např.: „Fotku jde nahrát jen k přihlášce, která ještě není u okresu.“ | sbor (člen skupiny) | `mime`, `data` | `data` | **Členské přihlášky**, **Záznam změn**, *Disk* | aplikace |
| `prihlaskaFotka` | fotka člena k přihlášce (okres nebo sbor přihlášky) `prhFotkaCist_` Chyby např.: „Fotka není nahraná.“ | role Přihlášky / Správce nebo sbor (člen skupiny) | – | `nazev`, `mime`, `data` | *Disk* | aplikace |
| `prihlaskaPredat` ✎ ↻ | Předání okresu: po zaplacení příspěvku sboru, se skenem a fotkou. `prhPredat_` Chyby např.: „Přihláška ve stavu „“ | sbor (člen skupiny) | – | `data` | **Členské přihlášky**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `prihlaskaOdvodZaplacen` ✎ ↻ | Sbor označí odvod okresu za vybrané přihlášky jako zaplacený (nebo označení zruší, dokud ho okres nepřijal). `prhOdvodZaplacen_` Chyby např.: „Vyberte přihlášky.“ | sbor (člen skupiny) | `ids`, `zaplaceno` | `data`, `odvod` | **Členské přihlášky**, **Záznam změn** | aplikace |
| `prihlaskaZaplaceno` ✎ ↻ | sbor označí zaplacený příspěvek sboru `prhZaplaceno_` Chyby např.: „Platbu potvrdíte u přihlášky, která ještě není u okresu.“ | sbor (člen skupiny) | `zaplaceno` | `data` | **Členské přihlášky**, **Záznam změn** | aplikace |
| `prihlaskaStahnout` ✎ ↻ | Zrušení sborem / zamítnutí okresem. `prhKonec_` Chyby např.: „Přihláška ve stavu „“ | sbor (člen skupiny) | – | `data` | **Členské přihlášky**, **Záznam změn** | aplikace |
| `prihlaskaPdf` ✎ | data pro vyplnění PDF přihlášky (prohlížeč ho vyplní a zploští) `prhPdf_` Chyby např.: „Vyplněné PDF už bylo po lhůtě smazáno.“ | role Přihlášky / Správce nebo sbor (člen skupiny) | – | – | Členské přihlášky, **Záznam změn**, *Disk* | aplikace |
| `prihlaskaSkenNahled` | náhled skenu podepsané přihlášky `prhSkenNahled_` | role Přihlášky / Správce nebo sbor (člen skupiny) | – | `nazev`, `mime`, `data`, `nahled`, `pozdeji` | *Disk* | aplikace |
| `prihlaskyOkres` | přihlášky předané okresu | role Přihlášky / Správce | – | `data` | Členské přihlášky | aplikace |
| `prihlaskaDetail` | Detail pro okres: údaje z tabulky + z udaje.json jen maskované rodné číslo, adresa, zákonný zástupce. `prhDetail_` | role Přihlášky / Správce | – | `data`, `detail` | *Disk* | aplikace |
| `prihlaskaRozhodnout` ✎ ↻ | okres schválí / vrátí / zamítne přihlášku (důvod povinný) `prhRozhodnout_` Chyby např.: „Napište důvod – sbor ho uvidí.“ | role Přihlášky / Správce | `rozhodnuti`, `duvod` | `data` | **Členské přihlášky**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `prihlaskaEvidence` ✎ ↻ | Zápis do Centrální evidence. `prhEvidence_` Chyby např.: „Vyplňte evidenční číslo z evidencesdh.cz (písmena, číslice, - a /).“ | role Přihlášky / Správce | `cislo`, `clenemOd` | `data` | **Členové**, **Členské přihlášky**, **Záznam změn**, *e-mail*, *Disk* | aplikace |
| `prihlaskyExport` ✎ | Export pro ruční přepis do evidencesdh.cz. `prhExport_` | role Přihlášky / Správce | – | `nazev`, `csv`, `pocet` | Členské přihlášky, **Záznam změn**, *Disk* | aplikace |
| `prihlaskyOdvod` ✎ ↻ | Okres označí odvody za vybrané přihlášky jako přijaté (nebo přijetí zruší). `prhOdvod_` Chyby např.: „Přihláška nenalezena.“ | role Přihlášky / Správce | `id`, `ids`, `prijato` | `data` | **Členské přihlášky**, **Záznam změn** | aplikace |

#### Clenove.gs (`apiClenove_`)

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `clenoveSbor` | seznam členů sboru (jen čtení) a jeho nahlášené změny – B17, Clenove.gs `cleSbor_` | sbor (člen skupiny) | – | `data`, `zmeny` | Členové, Změny členů | aplikace |
| `clenZmenaPodat` ✎ ↻ | sbor nahlásí ukončení členství nebo opravu údajů člena `clePodat_` Chyby např.: „Vyberte, co se má změnit.“ | sbor (člen skupiny) | `data` | – | **Členové**, Uživatelé, **Záznam změn**, **Změny členů**, *e-mail* | aplikace |
| `clenZmenaZrusit` ✎ ↻ | sbor zruší nahlášenou změnu, dokud ji okres nevyřídil `cleZrusit_` Chyby např.: „Změna nenalezena.“ | sbor (člen skupiny) | `id` | `data`, `zmeny` | **Členové**, **Záznam změn**, **Změny členů** | aplikace |
| `clenoveOkres` | členové všech sborů a změny ke schválení (role Přihlášky / Správce) `cleOkres_` | role Přihlášky / Správce | – | `data`, `zmeny` | Členové, Sbory, Změny členů | aplikace |
| `clenZmenaRozhodnout` ✎ ↻ | okres změnu člena provede, nebo zamítne s důvodem `cleRozhodnout_` Chyby např.: „Import z evidence spouští jen Správce.“ | role Přihlášky / Správce | `rozhodnuti`, `poznamka`, `id` | `zprava`, `pocty`, `nesparovane` | **Členové**, Sbory, Uživatelé, **Záznam změn**, **Změny členů**, *e-mail*, *Disk* | aplikace |
| `clenoveImport` ✎ | import exportu z evidencesdh.cz ze složky Import/ (jen Správce) Chyby např.: „Seznam členů všech sborů vidí role Přihlášky nebo Správce.“ | role Přihlášky / Správce | `sbor` | `zprava`, `pocty`, `nesparovane` | **Členové**, Sbory, **Záznam změn**, *Disk* | aplikace |

#### Skoleni.gs

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `skoleniOkres` | školení pro okres (role Školení / Správce) s počty přihlášených – B18, Skoleni.gs `skOkres_` | role Správce / Školení | – | `data`, `druhy`, `role` | Akce, Druhy kvalifikací, Školení, Účastníci školení | aplikace |
| `skoleni` | detail školení s účastníky `skDetail_` Chyby např.: „Školení nenalezeno.“ | role Správce / Školení | `id` | `data`, `test`, `ucastnici` | Akce, Druhy kvalifikací, Pokusy testů, Školení, Účastníci školení | aplikace, web |
| `skoleniUlozit` ✎ ↻ | vypsání / úprava školení (řádek Akce → kalendář + řádek Školení) `skUlozit_` Chyby např.: „Školení pro“ | role Správce / Školení | `data`, `id` | – | **Akce**, Druhy kvalifikací, **Kvalifikace**, **Školení**, Termíny, **Účastníci školení**, **Záznam změn**, *Kalendář* | aplikace |
| `skoleniStav` ✎ ↻ | koncept / přihlášky / uzavřeno / zrušeno (e-mail sborům s přihlášenými) `skZmenitStav_` Chyby např.: „Školení nenalezeno.“ | role Správce / Školení | `id`, `stav`, `poznamka` | – | **Akce**, **Druhy kvalifikací**, **Školení**, **Účastníci školení**, Uživatelé, **Záznam změn**, *e-mail*, *Kalendář* | aplikace |
| `skoleniVysledky` ✎ ↻ | výsledky účastníků; dokoncit = vyhodnotit a založit kvalifikace `skVysledky_` Chyby např.: „Příliš mnoho řádků.“ | role Správce / Školení | `id`, `vysledky`, `dokoncit` | – | Akce, Druhy kvalifikací, **Kvalifikace**, **Školení**, **Účastníci školení**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `skoleniPrezence` ✎ | prezenční listina (PDF, neukládá se) `skPrezence_` Chyby např.: „Školení nenalezeno.“ | role Správce / Školení | `id` | `nazev`, `data`, `test`, `ucastnici` | Školení, Účastníci školení, **Záznam změn** | aplikace |
| `kvalifikaceOkres` | kvalifikace osob s platností, katalog druhů a sbory `skKvalOkres_` | role Správce / Školení | – | `data`, `druhy`, `sbory`, `upozornit` | Druhy kvalifikací, Kvalifikace, Sbory | aplikace |
| `kvalifikaceUlozit` ✎ ↻ | ruční zápis kvalifikace (kurz jinde) nebo úprava / ukončení Chyby např.: „Školení a kvalifikace spravuje role Školení nebo Správce.“ | role Správce / Školení | `sbor`, `data`, `id` | – | Členové, Druhy kvalifikací, **Kvalifikace**, Sbory, **Záznam změn** | aplikace |
| `skoleniSbor` | školení, která sbor vidí, jeho účastníci a kvalifikace jeho členů `skSbor_` | sbor (člen skupiny) | – | `skupina`, `data`, `ucastnici`, `kvalifikace`, `druhy`, `upozornit` | Akce, Druhy kvalifikací, Kvalifikace, Školení, Účastníci školení | aplikace |
| `skoleniPrihlasit` ✎ ↻ | sbor přihlásí členy ze seznamu (nebo ručně) do uzávěrky a kapacity `skPrihlasit_` Chyby např.: „Vyberte aspoň jednoho člena.“ | sbor (člen skupiny) | `data`, `id` | – | Akce, Členové, Druhy kvalifikací, Kvalifikace, Školení, **Účastníci školení**, **Záznam změn** | aplikace |
| `skoleniOdhlasit` ✎ ↻ | sbor odhlásí účastníka, dokud školení nezačalo `skOdhlasit_` Chyby např.: „Přihláška nenalezena.“ | sbor (člen skupiny) | `data`, `ucastnik` | – | Akce, Druhy kvalifikací, Kvalifikace, Školení, **Účastníci školení**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `testSpustit` ✎ ↻ | okres spustí test na školení – odkaz a QR test.html#k=… do konce dne školení (Testy.gs) `tsSpustit_` Chyby např.: „Školení nenalezeno.“ | role Správce / Školení | `id` | – | Akce, Druhy kvalifikací, **Školení**, Účastníci školení, **Záznam změn** | aplikace |
| `skoleniOdhlasitOkres` ✎ | okres odhlásí účastníka školení (i přihlášku z webu), dokud není vyhodnocené `skOdhlasitOkres_` Chyby např.: „Účastník nenalezen.“ | role Správce / Školení | `ucastnik` | – | Akce, Druhy kvalifikací, Školení, **Účastníci školení**, Uživatelé, **Záznam změn**, *e-mail* | aplikace |
| `testUkoncit` ✎ ↻ | okres ukončí test (odkaz přestane platit) `tsSpustit_` Chyby např.: „Školení nenalezeno.“ | role Správce / Školení | `id` | – | Akce, Druhy kvalifikací, **Školení**, Účastníci školení, **Záznam změn** | aplikace |
| `skoleniPrihlaskaWeb` ✎ | přihláška na školení z webu – bez přihlášení (Turnstile + limity, jen školení s Přihlášky z webu) Chyby např.: „Vyplňte jméno a příjmení.“ | veřejné (Turnstile, limity) | `turnstile`, `data` | `nazev` | Akce, Druhy kvalifikací, Sbory, Školení, **Účastníci školení**, Uživatelé, **Záznam změn**, *e-mail*, *Turnstile* | web |

#### Testy.gs

| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |
| --- | --- | --- | --- | --- | --- | --- |
| `test` ✎ | test kandidáta na školení – bez přihlášení (kód v odkazu, krok info / start / odevzdat, Testy.gs) Chyby např.: „Příliš mnoho neplatných pokusů. Zkuste to za 10 minut.“ | veřejné (kód / klíč v odkazu) | `kod`, `krok`, `ucastnik`, `narozen`, `pokus`, `odpovedi` | `test`, `skoleni`, `ucastnici` | Akce, Druhy kvalifikací, Otázky testů, **Pokusy testů**, Školení, Účastníci školení, **Záznam změn** | web, test |
<!-- /GEN:akce -->

## Příloha B: listy tabulky OSH data

Listy Evidence majetku jsou v samostatných tabulkách staré aplikace (sloupec Data u akcí: *Evidence majetku*). List Majetek v OSH data se nepoužívá.

<!-- GEN:listy -->
| List | Sloupce | Zapisují akce | Jen čtou |
| --- | --- | --- | --- |
| **Nastavení** | Klíč, Hodnota, Popis | jen ručně / časovače | – |
| **Uživatelé** | E-mail, Jméno, Aktivní, Dokumenty, Termíny, Akce, Soutěže, Majetek, Přihlášky, Příspěvky, Sbory, Správce, Poznámka, Školení, Výchozí pořadatel | `nastaveniUlozit` | `kod`, `overit`, `souhrn`, `portal`, `zadostUlozit`, `zadostRozhodnout` a 32 dalších |
| **Sbory** | Sbor, Skupina, Okrsek, MH, JSDH, Sport, Aktivní, IČO, Číslo účtu, Web, Kontakty, Poznámka, Příspěvek dospělý, Příspěvek MH, MH jako sportovec, Dospělý jako sportovec, Registrační číslo | `zmenaSboruRozhodnout`, `prihlaskyNastaveni` | `kod`, `overit`, `portal`, `nahlasitZmenu`, `zadostRozhodnout`, `rezervaceRozhodnout` a 27 dalších |
| **Kontakty sborů** | Sbor, Skupina, Jméno, Funkce, E-mail, Aktivní, Zdroj, Poznámka | `zmenaSboruRozhodnout` | `overit`, `ja`, `souhrn`, `mujSbor`, `zmenaSboruPodat`, `zmenaSboruStahnout` a 2 dalších |
| **Změny sborů** | ID, Sbor, Skupina, Změny, Popis, Stav, Poznámka sboru, Poznámka, Výsledek, Vyřídil, Vyřízeno | `zmenaSboruPodat`, `zmenaSboruStahnout`, `zmenaSboruRozhodnout` | `souhrn`, `mujSbor`, `zmenySboru` |
| **Členové orgánů** | Orgán, Pořadí, Funkce, Jméno, Sbor, Telefon, E-mail, Poznámka, Kontakt na web, Aktivní | jen ručně / časovače | – |
| **Akce** | ID, Název, Typ, Pořadatel, Od, Do, Místo, Pro koho, Okrsek, Popis, Odkaz, Stav, Kalendář – událost, Připomenout (dny předem), Oznámeno, Připomenuto | `ulozitAkci`, `ulozitTermin`, `zadostRozhodnout`, `soutezUlozit`, `soutezStav`, `soutezTestLiga`, `soutezZverejnit`, `soutezOz`, `skoleniUlozit`, `skoleniStav` | `souhrn`, `kalendar`, `zrusitTermin`, `portal`, `zavod`, `soutezeOkres` a 22 dalších |
| **Termíny** | ID, Název, Datum, Typ, Pořadatel, Pro koho, Okrsek, Popis, Připomenout (dny předem), Stav, Kalendář – událost, Oznámeno, Připomenuto | `ulozitAkci`, `ulozitTermin` | `souhrn`, `kalendar`, `zrusitTermin`, `portal`, `zadostRozhodnout`, `soutezUlozit` a 2 dalších |
| **Dokumenty** | ID, Soubor – ID, Název souboru, Orgán, Datum, Rok, Název, Stav, Upozornění, Schválil, Schváleno, Veřejný odkaz, Pro koho, Okrsek | `dokumentRozhodnout` | `souhrn`, `dokumentyKeSchvaleni`, `dokumentyVse`, `zkontrolovatDisk`, `portal` |
| **Žádosti** | ID, Sbor, Typ, Název, Datum, Místo, Vybavení, Přílohy – složka, Stav, Vyřídil, Vyřízeno, Poznámka, Do, Pro koho, Kontakt, Popis, Akce – ID, Čas od, Čas do | `zrusitAkci`, `zrusitTermin`, `zadostUlozit`, `zadostStahnout`, `zadostPriloha`, `zadostRozhodnout`, `soutezStav`, `soutezTestLiga`, `soutezZverejnit` | `souhrn`, `zadostiSbor`, `zadostiOkres`, `zadostPrilohy`, `majetekData`, `majetekProtokol` a 7 dalších |
| **Soutěže** | Akce – ID, Druh, Pro, Kategorie, Pokusy, Shoda časů, Uzávěrka, Propozice, Pohár – ID, Kolo, Hlavní rozhodčí, Stav, Kód rozhodčích – otisk, Kód hlavního rozhodčího – otisk, Kódy platí do, Ověřil, Ověřeno, Zveřejnil, Zveřejněno, Výsledky – PDF, Žádost – ID, Poznámka, OZ, OZ – PDF, Pořadatel – skupina, Stojany, Disciplíny, Harmonogram | `zrusitAkci`, `zrusitTermin`, `zadostRozhodnout`, `zavod`, `soutezUlozit`, `soutezStav`, `soutezHarmonogram`, `soutezTestLiga`, `soutezTest`, `soutezZverejnit` a 1 dalších | `souhrn`, `portal`, `soutezeOkres`, `soutez`, `soutezStart`, `soutezRozradit` a 6 dalších |
| **Přihlášky družstev** | ID, Akce – ID, Sbor, Kategorie, Družstvo, Členové, Kontakt, Stav, Skupina, Start, Pořadí při shodě, Přihlásil, Rozběh 1, Stojan 1, Rozběh 2, Stojan 2, Soupiska, Mimo evidenci | `zavod`, `soutezStav`, `soutezStart`, `soutezRozradit`, `soutezTestLiga`, `soutezTest`, `soutezDruzstvo`, `soutezZverejnit`, `soutezPrihlasit`, `soutezOdhlasit` | `portal`, `soutezeOkres`, `soutez`, `soutezUlozit`, `soutezHarmonogram`, `poharUlozit` a 3 dalších |
| **Členové** | ID, Sbor, Skupina, Jméno, Příjmení, Datum narození, Pohlaví, Obec, Kategorie, Evidenční číslo, Členem od, Aktivní, Zdroj, Aktualizováno | `prestupRozhodnout`, `prihlaskaEvidence`, `clenZmenaPodat`, `clenZmenaZrusit`, `clenZmenaRozhodnout`, `clenoveImport` | `soutez`, `clenoveSbor`, `clenoveOkres`, `kvalifikaceUlozit`, `skoleniPrihlasit` |
| **Změny členů** | ID, Člen – ID, Člen, Sbor, Skupina, Změna, Údaje, Důvod, Stav, Podal, Podáno, Vyřídil, Vyřízeno, Poznámka | `clenZmenaPodat`, `clenZmenaZrusit`, `clenZmenaRozhodnout` | `souhrn`, `clenoveSbor`, `clenoveOkres` |
| **Přestupy** | ID, Jméno, Příjmení, Datum narození, Evidenční číslo, Zákonný zástupce, E-mail, Telefon, Z sboru, Z skupina, Z okresu, Do sboru, Do skupina, Do okresu, Důvod, Stav, Stav od, Souhlas domovského, Souhlas domovského – kdo, Souhlas přijímajícího, Souhlas přijímajícího – kdo, Sken – ID, Poznámka, Zdroj, Odkaz – otisk, Provedeno | `prestupVerejny`, `prestupZadatel`, `prestupRozhodnout`, `prestupNovy`, `prestupSouhlas`, `prestupSken`, `prestupZrusit` | `souhrn`, `portal`, `prestupyOkres`, `prestupySbor` |
| **Druhy kvalifikací** | Kód, Název, Oblast, Pro, Platnost (roky), Min. věk, Orgán, Materiály, Aktivní, Poznámka, Test – otázek, Test – max. chyb, Test – minut, Test – veřejné otázky | `skoleniStav` | `souhrn`, `skoleniOkres`, `skoleni`, `skoleniUlozit`, `skoleniVysledky`, `kvalifikaceOkres` a 9 dalších |
| **Školení** | Akce – ID, Druh, Kvalifikace, Pro, Orgán, Kapacita, Uzávěrka, Poplatek, Lektor, Materiály, Stav, Vyhodnotil, Vyhodnoceno, Poznámka, Test – otisk, Test platí do, Přihlášky z webu | `skoleniUlozit`, `skoleniStav`, `skoleniVysledky`, `testSpustit`, `testUkoncit` | `souhrn`, `skoleniOkres`, `skoleni`, `skoleniPrezence`, `skoleniSbor`, `skoleniPrihlasit` a 4 dalších |
| **Účastníci školení** | ID, Akce – ID, Sbor, Skupina, Člen – ID, Jméno, Příjmení, Datum narození, Stav, Kód, Číslo osvědčení, Poznámka, Přihlásil, Přihlášeno, Kvalifikace – ID, E-mail, Telefon, Obnova | `skoleniUlozit`, `skoleniStav`, `skoleniVysledky`, `skoleniPrihlasit`, `skoleniOdhlasit`, `skoleniOdhlasitOkres`, `skoleniPrihlaskaWeb` | `skoleniOkres`, `skoleni`, `skoleniPrezence`, `skoleniSbor`, `testSpustit`, `testUkoncit` a 1 dalších |
| **Kvalifikace** | ID, Kód, Kvalifikace, Člen – ID, Jméno, Příjmení, Datum narození, Sbor, Skupina, Získáno, Platí do, Číslo osvědčení, Zdroj, Akce – ID, Aktivní, Upozorněno, Poznámka | `skoleniUlozit`, `skoleniVysledky`, `kvalifikaceUlozit` | `kvalifikaceOkres`, `skoleniSbor`, `skoleniPrihlasit`, `skoleniOdhlasit` |
| **Otázky testů** | ID, Test, Sada, Okruh, Otázka, A, B, C, D, Správně, Zdroj, Aktivní, Poznámka | jen ručně / časovače | `test` |
| **Pokusy testů** | ID, Akce – ID, Účastník – ID, Jméno, Test, Pokus, Otázky, Začátek, Odevzdáno, Otázek, Chyb, Výsledek, Odpovědi, Klíč – otisk | `test` | `skoleni` |
| **Výsledky** | ID, Akce – ID, Kategorie, Disciplína, Sbor, Družstvo, Čas (s), Trestné body, Výsledek, Pořadí, Rozhodčí, Stav, Přihláška – ID, Pokus, Čas L, Čas P, Platnost, Poznámka, Zapsáno, Zápis – klíč, Rozpis | `zavod`, `soutezStav`, `soutezTestLiga`, `soutezTest`, `soutezZverejnit` | `soutezeOkres`, `soutez`, `soutezUlozit`, `soutezStart`, `soutezRozradit`, `soutezHarmonogram` a 7 dalších |
| **Poháry** | ID, Název, Ročník, Pro, Kategorie, Body, Body za NP, Započítat kol, Min. kol, Stav, Popis, Družstev v poháru, Typ | `soutezTestLiga`, `poharUlozit` | `soutezeOkres`, `soutezUlozit`, `soutezeSbor`, `soutezPrihlasit`, `soutezOdhlasit` |
| **Majetek** | ID, Název, Kategorie, Počet, Umístění, Stav, Kauce (Kč), Foto – ID, Poznámka | jen ručně / časovače | – |
| **Nabídka majetku** | Majetek – ID, Název, Nabízet sborům, Poznámka pro sbory | `majetekNabidka` | `zadostiSbor`, `zadostUlozit`, `majetekData`, `majetekProtokol`, `vybaveniSbor`, `vybaveniZadost` |
| **Rezervace** | ID, Majetek – ID, Sbor, Od, Do, Účel, Stav, Potvrdil, Stav po vrácení, Poznámka, Žádost – ID, Výpůjčka – ID, Zápůjčka – ID, Místo, Kontakt | `zrusitAkci`, `zrusitTermin`, `zadostUlozit`, `zadostRozhodnout`, `vypujckaNova`, `vypujckaVratit`, `rezervaceRozhodnout`, `rezervaceZrusit`, `vybaveniZadost`, `vybaveniZrusit` a 1 dalších | `souhrn`, `zadostiSbor`, `zadostiOkres`, `majetekData`, `majetekProtokol`, `vybaveniSbor` |
| **Členské přihlášky** | ID, Sbor, Skupina, Jméno, Příjmení, Datum narození, Kategorie, Sportovec, Přestup z, E-mail, Telefon, Zákonný zástupce, Variabilní symbol, Zaplaceno, Evidenční číslo, Členem od, Stav, Stav od, Poznámka, Zdroj, Složka – ID, PDF – ID, Sken – ID, Fotka – ID, Údaje smazány, Odvod, Odvod přijat, Odvod zaplacen, Motivační dopis, Schváleno výborem, Sken uchazeče – ID, Odkaz – otisk | `prihlaskaVerejna`, `prihlaskaUchazec`, `prihlaskaNova`, `prihlaskaSken`, `prihlaskaPosoudit`, `prihlaskaFotkaNahrat`, `prihlaskaPredat`, `prihlaskaOdvodZaplacen`, `prihlaskaZaplaceno`, `prihlaskaStahnout` a 3 dalších | `souhrn`, `portal`, `prihlaskySbor`, `prihlaskaPdf`, `prihlaskyOkres`, `prihlaskyExport` |
| **Příspěvky** | ID, Titulek, Perex, Text, Fotky – složka, Přílohy, Autor, Zdroj, Stav, Zveřejněno, Odkaz, Pro koho, Hlavní fotka – ID, Připnout, Štítky, Adresa, Poznámka, Původní adresa | `prispevekUlozit`, `prispevekRozhodnout`, `prispevekSoubor`, `prispevekSouborSmazat`, `prispevekSmazat` | `souhrn`, `portal`, `prispevky`, `prispevekNahledy` |
| **Záznam změn** | Čas, Uživatel, List, ID, Akce, Před, Po | `overit`, `nastaveniUlozit`, `dokumentRozhodnout`, `ulozitAkci`, `ulozitTermin`, `zrusitAkci`, `zrusitTermin`, `nahlasitZmenu`, `zadostUlozit`, `zadostStahnout` a 76 dalších | `zaznamZmen` |
<!-- /GEN:listy -->

## Příloha C: nastavení a časovače

<!-- GEN:nastaveni -->
| Klíč v listu Nastavení | Používá |
| --- | --- |
| `CITLIVE_ID` | OSH-data-struktura.gs |
| `CLENOVE_IMPORT_ALIASY` | Clenove.gs |
| `CLENOVE_IMPORT_SLOZKA` | Clenove.gs |
| `CLENOVE_VYMAZ_DNY` | Clenove.gs |
| `DISK_ID` | Dokumenty.gs |
| `DOMENA` | API.gs |
| `GITHUB_REPO` | API.gs |
| `GITHUB_VETEV` | API.gs |
| `JOOMLA_SLOZKA` | ImportJoomla.gs |
| `JOOMLA_TEST_POCET` | ImportJoomla.gs |
| `KALENDAR_ID` | Kalendar.gs |
| `MAJETEK_CISELNIKY_ID` | OSH-data-struktura.gs |
| `MAJETEK_FOTO_DISK` | Majetek.gs |
| `MAJETEK_TABULKA_ID` | OSH-data-struktura.gs |
| `MAJETEK_VYPUJCKY_ID` | OSH-data-struktura.gs |
| `ODESILATEL` | OSH-data-struktura.gs |
| `ODVOD_DOSPELY` | OSH-data-struktura.gs |
| `ODVOD_MH` | OSH-data-struktura.gs |
| `OKRES_UCET` | Prihlasky.gs |
| `OZ_HLAVICKA` | Skoleni.gs |
| `POJMENOVANI` | OSH-data-struktura.gs |
| `PRIHLASKY_SLOZKA_ID` | Prihlasky.gs |
| `PRIHLASKY_VYMAZ_OSTATNI_DNY` | Prihlasky.gs |
| `PRIHLASKY_VYMAZ_ZAPSANO_DNY` | Prihlasky.gs |
| `PRIHLASKY_ZAPNUTO` | Prihlasky.gs |
| `PRIPOMINKY_DNY` | Posta.gs |
| `PRISPEVEK_DOSPELY` | OSH-data-struktura.gs |
| `PRISPEVEK_MH` | OSH-data-struktura.gs |
| `PRISPEVKY_EMAIL` | Prispevky.gs |
| `RC_SMAZAT_PO_DNECH` | OSH-data-struktura.gs |
| `REZIM` | API.gs |
| `SKOLENI_UPOZORNIT_DNY` | Skoleni.gs |
| `SKOLENI_VYMAZ_KVALIFIKACE_DNY` | Skoleni.gs |
| `SKOLENI_VYMAZ_UCASTNICI_DNY` | Skoleni.gs |
| `SKUPINY_TABULKA_ID` | ZmenySboru.gs |
| `SLOZKA_ORGANY` | Dokumenty.gs |
| `SLOZKA_ZALOHY` | Zalohy.gs |
| `TABULKA_ID` | OSH-data-struktura.gs |
| `TEST_EMAIL` | Posta.gs |
| `TEST_KODY_PRIMO` | Posta.gs |
| `TURNSTILE_DOMENY` | Ochrana.gs |
| `TURNSTILE_PRISNE` | Ochrana.gs |
| `TURNSTILE_SITEKEY` | API.gs |
| `WEB_URL` | ImportJoomla.gs |
| `ZALOHY_TYDNY` | Zalohy.gs |
<!-- /GEN:nastaveni -->

<!-- GEN:vlastnosti -->
| Vlastnost skriptu (tajné / ID) | Používá |
| --- | --- |
| `GH_WEB_OTISK` | API.gs |
| `GITHUB_TOKEN` | API.gs, Prostredi.gs |
| `KONTAKTY_FORM_ID` | Kontakty.gs |
| `PRESTUPY_KLIC` | Prestupy.gs |
| `PRIHLASKY_SLOZKA_ID` | Prihlasky.gs |
| `PROSTREDI` | OSH-data-struktura.gs, Prostredi.gs |
| `TABULKA_ID` | API.gs, OSH-data-struktura.gs, Prihlaseni.gs, Prostredi.gs, Zalohy.gs |
| `TURNSTILE_SECRET` | Ochrana.gs, Prostredi.gs |
<!-- /GEN:vlastnosti -->

Časovače zakládá `nastavitSpousteni` (po přidání časovače ji spustit znovu a povolit oprávnění):

<!-- GEN:casovace -->
| Funkce | Kdy | Soubor | Účel |
| --- | --- | --- | --- |
| `importJoomla` | jednorázově (pokračování dávky) | ImportJoomla.gs |  |
| `nocniUdrzba` | denně 2:00 | Prihlaseni.gs | Každou noc ve 2:00: smaže prošlé relace a staré značky zpracovaných e-mailů, u přihlášek po lhůtě citlivé údaje, neaktivní členy a soupisky skončených ročníků (cleUdrzba_), upozorn |
| `kontrolaDokumentu` | každých 15 min | Dokumenty.gs | Spouští se každých 15 minut. |
| `synchronizovatKalendar` | každou hodinu | Kalendar.gs | Celá synchronizace obou listů. |
| `priUprave` | při úpravě tabulky | Kalendar.gs | Instalovaný spouštěč při úpravě tabulky. |
| `poslatOznameni` | každých 15 min | Posta.gs | Každých 15 min: oznámí nově zveřejněné akce a termíny (10 min po poslední úpravě, aby se neposílal rozepsaný řádek). |
| `poslatPripominky` | denně 7:00 | Posta.gs | Každé ráno v 7:00: připomínky podle „Připomenout (dny předem)“ (prázdné = PRIPOMINKY_DNY z Nastavení). |
| `obnovitClenstvi` | každou hodinu | Prihlaseni.gs | Projde všechny skupiny sdh-…@ a zapíše jejich členy do listu „Členství skupin“. |
| `obnovitWebData` | každých 5 min | API.gs | Data pro veřejný web předem do mezipaměti (časovač každých 5 minut, nastavitSpousteni). |
| `souhrnVypujcekPoTerminu` | denně 7:30 | Majetek.gs | Časovač každý den v 7:30. |
| `prijmoutPrispevkyEmailem` | každých 10 min | Prispevky.gs | Časovač každých 10 min. |
| `zalohovat` | neděle 3:00 | Zalohy.gs | Týdenní spouštění (neděle 3:00). |
| `archivovatZaznam` | 1. den v měsíci 4:00 | Zalohy.gs | 1. den v měsíci: záznamy starší než 24 měsíců → tabulka „OSH záznam změn archiv“. |
| `synchronizovatFunkce` | každou hodinu | Skupiny.gs |  |
<!-- /GEN:casovace -->
