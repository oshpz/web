# Zadání: Lidé sboru – přestavba B17 bez evidence SH ČMS

Stav: **zadání k realizaci**, 25. 11. 2026. Nahrazuje dnešní „Seznam členů“ (B17, `Clenove.gs`), který se plnil importem exportu z evidencesdh.cz.

## Proč

Schůzka 24. 11. 2026 (Josef Myslín, starosta OSH; Petra Myslínová) a odpovědi v dotazníku 25. 11. 2026: evidence SH ČMS (evidencesdh.cz) jsou **master data**. Aplikace z ní nesmí nic přebírat ani vést okresní kopii členů, a nikdo nesmí nic opisovat navíc. Jediná možnost je, že si **sbor vede vlastní interní seznam lidí** v rozsahu údajů, které stejně uvádí do přihlášek, a nese za něj odpovědnost. Odpovědi: tabulka „Evidence členů a aplikace Spojka – dotazy (Odpovědi)“ na Disku admin@ (není v repozitáři – jsou v ní jména respondentů).

## Pravidla (z odpovědí, závazná)

1. **Žádná vazba na evidenci** – ani import, ani export, ani párování podle evidenčního čísla. Okres nic zpětně neopisuje (evidenční číslo, den zápisu).
2. **Seznam je interní věc sboru.** Pracuje s ním jen daný sbor – ne jiný sbor, ne okres. Okres nemá žádnou obrazovku, hledání ani souhrn přes seznamy sborů.
3. **Každý záznam vzniká aktivním krokem sboru** (ruční zadání nebo tlačítko „Přidat do seznamu“ u přihlášky / přestupu). Nikdy automaticky.
4. **Jen údaje, které jdou do přihlášek**: jméno, příjmení, datum narození, pohlaví, obec, číslo průkazu (nepovinné), vztah ke sboru. Nic dalšího (žádné kontakty, zákonní zástupci, adresy).
5. **Odpovědnost sboru** je řečená výslovně: poučení při prvním použití + trvale viditelný odkaz na panelu seznamu. Sbor má u každého záznamu zvážit oprávněnost; cizího člena zadávat jen když za sbor soutěží opakovaně.
6. **Okres smí vidět a uchovat to, co mu sbor pošle k akci, kterou okres pořádá**: soupisky, účastníci školení, kvalifikace, přestupy, příznak „není člen sboru“. Jen nezbytné údaje. (Dnešní stav vyhovuje, nemění se.)
7. **Výmaz**: 2 roky od posledního použití, s upozorněním sboru předem. Správce údajů = sbor, okres = provozovatel platformy.
8. Registrační čísla sborů (71) zůstávají – nejsou osobní údaj.

## Co se ruší

| Dnes | Kde | Náhrada |
|---|---|---|
| Import z evidence (`clenoveImport`, `importEvidence`, `cleImport*`, `cleImportCist_`, `cleSboryMapa_`, `CLE_IMPORT_SLOUPCE`, `vytvoritUkazkovyExport`) | `Clenove.gs`, menu tabulky, aplikace (Správce) | bez náhrady; složku Import/ na sdíleném disku zrušit |
| Nastavení `CLENOVE_IMPORT_SLOZKA`, `CLENOVE_IMPORT_ALIASY` | `OSH-data-struktura.gs` | bez náhrady |
| List **Změny členů** a akce `clenZmenaPodat`, `clenZmenaZrusit`, `clenZmenaRozhodnout` | `Clenove.gs`, `Prihlaseni.gs`, `Souhrn.gs` (`zmenyClenu`) | sbor edituje přímo |
| Obrazovka okresu **Seznam členů** (`clenovesez`: `clenoveOkres`, `cleOkres_`, `nactiClenyOkres`, `clo.*`, odznak, zvonek „Změna člena ke schválení“) | aplikace, `LIVE_VIEWS`, `OK_SKUPINY`, `okObrazovky`, `okSmi`, `okOdznak` | bez náhrady |
| `cleSoupiskaOkres_` (okres dohledává ručně zadané lidi v seznamech jiných sborů) | `Souteze.gs` | okres vidí jen vztah, který uvedl sbor |
| Automatický zápis `cleZPrihlasky_` (v `prhEvidence_`) a `cleZPrestupu_` (v Přestupy → Provedeno) | `Prihlasky.gs`, `Prestupy.gs` | tlačítko sboru „Přidat do seznamu“ (`lidePrekopirovat`) |
| Sloupce Evidenční číslo (jako klíč), Členem od, Aktivní, Zdroj `evidence` | list Členové | viz nový model |
| Krok okresu „Zapsat do evidence“ s povinným evidenčním číslem (`prhEvidence_`, `prhEv`, pole `prh-ev`) | `Prihlasky.gs`, aplikace | jen potvrzení „Zapsáno“ s dnem zápisu (kvůli e-mailu o vzniku členství podle stanov čl. 19 odst. 5) – bez čísla; sloupec Evidenční číslo v Členských přihláškách a `evidencniCislo` v odpovědích uchazeči zrušit |
| Texty „z evidence SH ČMS“, „není v evidenci“, „mimo evidenci“ | aplikace, `soupiska.js` (PDF), `navody.html`, `docs/*` | „seznam lidí sboru“, „nečlen sboru“, „host z SDH …“ |

Export CSV schválených přihlášek (`prihlaskyExport`) zůstává – vadit nevadí, evidence ale nic nenahraje; v textu tlačítka říct „pro ruční přepis“.

## Nový model: list **Lidé sborů**

Nahrazuje list Členové (`LIST_CLENOVE = 'Lidé sborů'`; v TESTu starý list smazat, `Založit / doplnit strukturu` založí nový – žádná migrace, import skutečného exportu nikdy neproběhl). `audit: false` zůstává (bez sloupců Vytvořil/Upravil – nahrazují je Přidal/Aktualizováno).

| Sloupec | Typ | Poznámka |
|---|---|---|
| ID | text | `L` + čas + náhoda (`cleNoveId_`) |
| Sbor, Skupina | text | jako dnes; server ověřuje přes `pohledSboru_` |
| Jméno, Příjmení | text | do 60 znaků, `kontrolaTextu_`, `bezVzorce_` |
| Datum narození | date | povinné |
| Pohlaví | muž / žena | povinné (soupisky dívek / chlapců) |
| Obec | text | nepovinné, jen obec (přihlášky OORM) |
| Kategorie | mladý hasič / dorost / dospělý | počítá server (`cleKategorie_`), jako dnes |
| Číslo průkazu | text | nepovinné, zadává sbor; **nepáruje se** podle něj, jen se tiskne do přihlášek |
| Vztah | člen sboru / člen jiného SDH / nečlen | povinné; výchozí „člen sboru“ |
| Jiný sbor | text | jen u „člen jiného SDH“ (název, do 80 znaků) |
| Zdroj | ručně / z přihlášky / z přestupu | odkud sbor záznam převzal (vždy po kliknutí sboru) |
| Přidal | email | kdo ze sboru záznam založil |
| Přidáno | datetime | |
| Naposledy použito | datetime | aktualizuje soupiska (`soutezPrihlasit`), přihlášení na školení (`skoleniPrihlasit`), úprava záznamu |
| Aktualizováno | datetime | |

Nový sloupec v listu **Sbory**: `Lidé – poučení` (datetime) a `Lidé – poučení potvrdil` (email) – kdo za sbor potvrdil poučení. Dokud není, portál ukáže místo seznamu poučení.

Nastavení: `CLENOVE_VYMAZ_DNY` → **730** s novým popisem (dní od posledního použití, pak noční údržba záznam smaže); nové `CLENOVE_UPOZORNIT_DNY` = 30 (kolik dní před výmazem dostane sbor e-mail se jmény, která se smažou, pokud je sbor nepoužije nebo neupraví).

## Server (`Clenove.gs`, předpona `cle` zůstává, akce nové `lide*`)

Všechny jen pro přihlášený sbor (`pohledSboru_(o, req.sbor)`), `OPAKOVATELNE` u zápisů, limity `limit_('lide', email, 60, 3600)`.

- `lideSbor` – seznam lidí sboru + `kandidati`: zapsané členské přihlášky sboru (stav `zapsáno`, bez `Údaje smazány`) a provedené přestupy do sboru, které ještě v seznamu nejsou (porovnání jméno + příjmení + datum narození, `cleKlicOsoby_`) + `pouceni` (datum, kdo).
- `lidePouceni` – sbor potvrdí poučení (zapíše do Sbory). Bez potvrzení ostatní zápisové akce vrací chybu „Nejdřív potvrďte poučení“.
- `lideUlozit` – přidat / upravit (`data.id` prázdné = nový). Validace: jméno, příjmení, datum narození (RRRR-MM-DD, věk 3–100 let), pohlaví, vztah, u „člen jiného SDH“ název sboru; obec do 80, číslo průkazu `[\w/-]{1,20}`. Duplicita ve stejném sboru (klíč osoby) = chyba „Už v seznamu je“. Záznam změn: jen ID a sbor, nikdy jméno.
- `lideSmazat` – smaže řádek (opravdu smaže, žádné „neaktivní“). Soupisky a účastníci školení si údaje nesou v sobě (JSON / vlastní sloupce), nic se nerozbije.
- `lidePrekopirovat` – `zdroj: 'prihlaska' | 'prestup'`, `id` řádku. Server ověří, že přihláška patří sboru (Skupina) a je `zapsáno`, resp. přestup má `Do skupina` = sbor a stav `provedeno`; založí záznam se Zdroj podle původu, Vztah „člen sboru“, jen jméno, příjmení, datum narození, (pohlaví z přihlášky je v `udaje.json` jen jako RČ – **nečíst**, sbor doplní ručně v následné úpravě; u přestupu pohlaví není) → formulář se po překopírování rovnou otevře k doplnění pohlaví. Nikdy obec z `udaje.json`.
- `cleClenove_(skupina)` zůstává jako interní čtení pro soupisky (`cleSoupiska_`) a školení (`skoleniPrihlasit`, `Skoleni.gs:494` párování kvalifikace k osobě – jen v rámci jednoho sboru, to je v pořádku). Volání `cleClenove_(null)` (všechny sbory) **nesmí existovat**.
- `cleUdrzba_`: smazat lidi s Naposledy použito (nebo Přidáno) starším než `CLENOVE_VYMAZ_DNY`; `CLENOVE_UPOZORNIT_DNY` před tím jednou e-mail skupině sboru („Tito lidé se za 30 dní smažou ze seznamu, pokud je nepoužijete“ – jména jen v e-mailu sboru, ne do záznamu změn); soupisky po ročníku beze změny; blok Změny členů pryč.
- `vlozitTestyClenu` (jen TEST): přizpůsobit sloupcům (Vztah, Přidal = test, Naposledy použito), ID `LTEST…`, `UklidTestu.gs` doplnit.
- Rozcestník `doPostAkce_`: odstranit staré `clenove*` řádky, přidat `lide*` s komentářem; `node nastroje/rozhrani.mjs`; `docs/api-popis.md`.

### Soupisky (`Souteze.gs`, `cleSoupiska_`, `soupiska.js`)

- Položka soupisky nově nese `vztah` (z listu) nebo `rucne: 1` (zadáno rovnou v přihlášce, jako dosud `mimo`). `host` (název cizího sboru) zůstává.
- Sloupec listu Přihlášky družstev **Mimo evidenci** → přejmenovat na **Nečlenů** = počet položek, které nejsou „člen sboru“ (ručně zadaní + jiný SDH + nečlen). Server počítá, aplikace okresu zobrazí u každé osoby štítek: „člen sboru“ / „SDH Název“ / „nečlen“ / „zadáno ručně“.
- PDF přihlášky (`soupiska.js`): sloupec „Poznámka“ místo „není v evidenci“ tiskne „host – SDH Název“ nebo „nečlen“; u člena sboru nic. Kopie pravidel `cleRozsah_` / `clePosoudit_` beze změny.
- Při uložení soupisky server zapíše `Naposledy použito` u použitých ID.

### Přihlášky členů a přestupy

- `prhEvidence_` → `prhZapsano_` (akce `prihlaskaZapsano`): jen `clenemOd` (výchozí dnes). E-mail o vzniku členství bez evidenčního čísla. Tlačítko okresu „Zapsáno v evidenci“ (bez pole). Záložka „K zápisu do evidence“ zůstává (je to krok okresu v evidencesdh.cz).
- Po zápisu dostane sbor dnešní e-mail „zapsáno“ + věta „Chcete-li ho mít v seznamu lidí sboru pro soutěže a školení, přidejte ho v portálu: Členové → Lidé sboru → Přidat z přihlášek“.
- Přestup `Provedeno`: stejně, e-mail přijímajícímu sboru s touto větou; `cleZPrestupu_` zrušit.

## Portál sboru – obrazovka **Lidé sboru** (`sbView = 'seznam'`, položka v `SB_SKUPINY` přejmenovat na „Lidé sboru“)

Podle vzoru seznamů (`docs/claude-design/seznamy-vzor.md`, `szSeznam`).

1. **Poučení (první použití)** – místo seznamu karta s textem níže a tlačítkem „Rozumím, seznam vede náš sbor“ (`lidePouceni`). Po potvrzení v hlavičce seznamu trvale: „Interní seznam SDH Název – odpovídá za něj sbor. [Co to znamená]“ (odkaz otevře totéž poučení v dialogu).
2. **Hlavička**: Načíst znovu, hlavní akce „Přidat člověka“. Záložky: Všichni (n) · Mladí hasíči · Dorost · Dospělí · Hosté a nečleni (vztah ≠ člen sboru). Hledání první, filtr vztahu.
3. **Řádek**: Příjmení Jméno · nar. · kategorie · obec · štítek vztahu (u jiného SDH název) · číslo průkazu · „naposledy použito …“ nebo „zatím nepoužito“. Rozbalení řádku: Upravit, Smazat (potvrzení: „Smazat … ze seznamu? Soupisky a přihlášky na školení zůstávají.“).
4. **Formulář** (přidat / upravit): jméno, příjmení, datum narození, pohlaví, obec, vztah (přepínač: člen našeho sboru / člen jiného SDH + název / nečlen), číslo průkazu. Pod vztahem nápověda: „Člena jiného sboru nebo nečlena zadejte jen tehdy, když za vás soutěží či se školí opakovaně. Za oprávněnost záznamu odpovídá sbor.“
5. **Přidat z přihlášek a přestupů** – sekce (nebo záložka) „K převzetí (n)“ s kandidáty z `lideSbor.kandidati`: řádek se jménem, datem narození a původem („přihláška zapsaná 12. 11. 2026“ / „přestup z SDH X provedený …“) a tlačítkem **Přidat do seznamu** → `lidePrekopirovat` → otevře se formulář k doplnění pohlaví a obce. Tlačítko „Nepřidávat“ skryje kandidáta (jen v prohlížeči, localStorage `oshpz-lide-skryt`).
6. **Prázdný stav**: „Seznam je prázdný. Přidejte lidi, které přihlašujete na soutěže a školení – soupisky a přihlášky pak vyplníte výběrem. Seznam vede jen váš sbor.“
7. Výběr do soupisky (`ss2.sp`) a na školení: beze změny mechaniky, jen texty („Člen není v seznamu – zadat ručně“ zůstává, hláška o prázdném seznamu nově „Seznam lidí sboru je prázdný – přidejte je v Členové → Lidé sboru, nebo zadejte ručně“).

### Text poučení (návrh k odsouhlasení VV)

> **Čí je tento seznam**
> Seznam lidí sboru je interní pomůcka SDH Název ve Spojce. Vede ho jen váš sbor – nevidí ho okres ani jiné sbory a není nijak propojený s Centrální evidencí členů SH ČMS (evidencesdh.cz), která zůstává jediným zdrojem údajů o členství.
> Slouží k tomu, abyste jména, data narození a další údaje, které stejně uvádíte do přihlášek na soutěže a školení, nemuseli opisovat pokaždé znovu. Každý záznam do seznamu přidává sbor sám; zadávejte jen lidi, které skutečně přihlašujete, a jen údaje, které přihlášky vyžadují. Člena jiného sboru nebo nečlena zadejte jen tehdy, když za vás soutěží či se školí opakovaně.
> Za údaje v seznamu odpovídá sbor jako správce osobních údajů (čl. 4 GDPR); Okresní sdružení hasičů Praha-západ poskytuje jen nástroj. Lidé v seznamu mají právo vědět, co o nich vedete, a žádat výmaz – obracejí se na sbor. Záznam, který dva roky nepoužijete, se automaticky smaže; 30 dní předem vás upozorníme e-mailem.
> Co okresu posíláte v přihláškách (soupisky, účastníci školení), okres uchovává pro pořádání akce podle pravidel v Informaci o zpracování osobních údajů.

## Okres

- Obrazovka Seznam členů pryč (viz tabulka rušení). Navigace Sbory: Přihlášky členů, Přestupy, Změny sborů, Kontakty sborů.
- Soutěže → přihláška → soupiska: u osob štítek vztahu; „Nečlenů: n“ místo „Mimo evidenci“.
- Přihlášky členů: krok „Zapsáno v evidenci“ bez pole evidenčního čísla; v detailu zapsané přihlášky nezobrazovat číslo.
- Školení a kvalifikace: beze změny.

## Dokumentace, návody, testy

- `OSH-data-struktura.gs` (listy Lidé sborů, Sbory, Přihlášky družstev, Členské přihlášky, Nastavení), `docs/api-popis.md`, `docs/rozhrani.md` (`node nastroje/rozhrani.mjs`), `docs/pravidla-domeny.md` (odstavec Seznam členů → Lidé sboru), `docs/stav.md` (B17), `docs/Plan zavedeni.dc.html` (B17 text a kroky), `docs/claude-design-zadani.md` (tabulka změn v šablonách).
- `docs/zpracovani-udaju.html`: okruh „Seznam členů pro přihlášky na soutěže“ přepsat na „Lidé sboru“ – správce sbor, OSH provozovatel; účel, údaje, odkud (sbor), kdo vidí (jen sbor), lhůta 2 roky od posledního použití; soupisky a školení u okresu beze změny. Přihlášky členů: bez evidenčního čísla. Do „K rozhodnutí VV“: text poučení.
- `docs/podklady-vv.html`: řádek „Seznam členů sborů z evidence“ → „Lidé sboru (interní seznam sboru, bez vazby na evidenci)“.
- `navody.html`: kapitola `sb-seznam` přepsat (poučení, přidání, převzetí z přihlášek, smazání), v `ok-prihlasky` odstranit import a změny členů, upravit zápis přihlášky; snímky `sbor-seznam.jpg`, `okres-clenove.jpg` (smazat), `okres-prihlasky.jpg` znovu (`node nastroje/navody/snimky.mjs`).
- `docs/testovani.html`: scénáře S16 (sbor: poučení, přidání, převzetí z přihlášky, soupiska s hostem, smazání) a O12 (okres: soupiska se štítky, zápis přihlášky bez čísla; ověřit, že okres nikde seznam nevidí).
- Index webu: věta o počtu členů „z Evidence OSH zaokrouhleně na stovky“ (`index.html:2722`) je jen číslo v textu, zůstává.

## Postup a odhad

1. Server: struktura listů, `Clenove.gs` (nové akce, údržba, test), `Prihlasky.gs` / `Prestupy.gs` (zrušit automatiku, zápis bez čísla), `Souteze.gs` (vztah, Nečlenů), `Souhrn.gs`, rozcestník – **1 den**.
2. Aplikace – portál sboru (poučení, seznam, formulář, převzetí), výběr do soupisky a na školení, texty – **1 den**.
3. Aplikace – okres (odstranění obrazovky, soupiska se štítky, zápis přihlášky), `soupiska.js` PDF – **0,5 dne**.
4. Dokumenty, návody se snímky, testovací scénáře, `rozhrani.mjs` – **0,5 dne**.
5. V TESTu: smazat listy Členové a Změny členů, `Založit / doplnit strukturu`, `vlozitTestyClenu`, projít S16 a O12, `./nasadit.sh server test` + `./nasadit.sh test`.

## Otevřené body

- ~~Odpověď Petry Myslínové (dotazník)~~ – odpovědi starosty platí za oba (26. 11. 2026).
- Písemné potvrzení od starosty OSH e-mailem (přislíbil) – založit k `docs/zpracovani-udaju.html`.
- VV: schválit text poučení a lhůtu 2 roky (doplnit do kapitoly „K rozhodnutí“).
