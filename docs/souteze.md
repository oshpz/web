# Soutěže (B8) – rámec, požární útok, pohár a rozbor pravidel

Stav k 21. 10. 2026. Hotový je **rámec soutěží**, **požární útok** (dospělí i dorost) a **pohár / liga okresu**. **Hra Plamen a ZHVB** přijdou jako další krok. Jejich pravidla jsou rozebraná níže v části „Rozbor pravidel“. Uzlovou štafetu a ZHVB blokuje R3 (pravidla od OORM).

Kód: `apps-script/Souteze.gs` (server), `zavod.html` + `zavod.js` + `zavod-sw.js` (závodní panel), `souteze.js` (výpočet pořadí v telefonu, kopie serveru). Aplikace: Akce → Soutěže (okres), záložka Soutěže (sbor). Web: `?soutez=RRRR-ID`.

## Jak soutěž probíhá

| Stav | Kdo | Co se děje |
| --- | --- | --- |
| koncept | okres | Soutěž je založená. Okres ji zakládá buď přímo (Nová soutěž), nebo ze schválené žádosti sboru (B12). Je v kalendáři okresu (B5.4), sbory ji v portálu ještě nevidí. |
| přihlášky | sbory | Sbor v portálu (záložka Soutěže) přihlásí družstvo do kategorie. Do uzávěrky ho může i odhlásit. Okres může družstvo přidat kdykoli. |
| uzavřeno | okres | Okres sestaví startovní pořadí v kategorii (los nebo šipky). Sbory vidí startovku. |
| závod | rozhodčí | Okres vytvoří dva odkazy (rozhodčí, hlavní rozhodčí) s QR. Rozhodčí zapisují v telefonu i bez signálu. |
| ověřeno | hlavní rozhodčí | Hlavní rozhodčí zkontroluje úplnost, případně určí pořadí při shodě a výsledky ověří. Okres dostane e-mail. |
| zveřejněno | okres | Výsledky jsou na webu (`?soutez=…`) a na Disku je PDF výsledková listina (Soutěže/RRRR, kdokoli s odkazem). Kolo se započítá do poháru. |

Zpět se dá jít takto:
- **Zrušit zveřejnění** vrátí soutěž do stavu ověřeno.
- **Vrátit k opravě** zruší ověření a vytvoří nové odkazy pro rozhodčí.
- **Zrušit soutěž** ji odstraní z kalendáře i webu, řádky v tabulce zůstanou.

### Role a přístup

- **Role Soutěže** (list Uživatelé) má hodnotu *všechny*, *MH* nebo *dospělí*. Každá soutěž a pohár má pole **Pro** (MH / dospělí). Server pustí jen odpovídající roli, Správce smí vše.
- **Sbor** vidí soutěže od stavu přihlášky. Vidí jen svá družstva s kontaktem, u ostatních jen název a startovní číslo.
- **Rozhodčí** se nepřihlašují. Odkaz `zavod.html#k=<kód>` platí jen pro jednu soutěž a do konce jejího posledního dne (Akce → Do).
  - Kód je náhodný a má 128 bitů. V tabulce je uložený jen jeho otisk.
  - Odkaz pro hlavního rozhodčího umí navíc výsledky ověřit.
  - Nové odkazy zneplatní staré. Neplatné kódy server počítá a po 200 za 10 minut přestane odpovídat.

### Závodní panel bez signálu

- Při prvním otevření (se signálem) se soutěž, startovka a výsledky uloží v telefonu. Stránku si telefon uloží do mezipaměti (`zavod-sw.js`), takže jde znovu otevřít i bez signálu.
- Každý zápis má vlastní klíč a čeká ve frontě v telefonu. Po připojení se odešle, při výpadku se pošle znovu a server ho podle klíče nezapíše dvakrát.
- Když stejný pokus zapíší dva rozhodčí, platí novější zápis podle času v telefonu. Server to rozhodčímu ohlásí.
- Hlavní rozhodčí ověřuje až s prázdnou frontou a se signálem.

## Listy v tabulce OSH data

Listy založí nebo doplní **Založit / doplnit strukturu**.

- **Soutěže** (nový): má jeden řádek na soutěž, propojený s řádkem v listu Akce přes sloupec *Akce – ID*. Sloupce:
  - Druh, Pro, Kategorie, Pokusy (1 / 2), Shoda časů, Uzávěrka, Propozice (odkaz), Pohár – ID a Kolo, Hlavní rozhodčí, Stav;
  - otisky kódů a Kódy platí do;
  - Ověřil a Ověřeno, Zveřejnil a Zveřejněno, Výsledky – PDF, Žádost – ID.
- **Přihlášky družstev** (z B1, doplněné sloupce): Skupina, Start, Pořadí při shodě, Přihlásil. Sloupec *Členové* se nepoužívá, protože jména závodníků aplikace nesbírá.
- **Výsledky** (z B1, doplněné sloupce): jeden řádek = jeden pokus družstva. Sloupce:
  - Přihláška – ID, Pokus, Čas L, Čas P;
  - Čas (s) = výsledný čas pokusu;
  - Platnost (platný / NP / DIS / nenastoupil), Poznámka, Rozhodčí;
  - Zapsáno (čas v telefonu), Zápis – klíč;
  - Stav (zapsáno / ověřeno / zveřejněno), Pořadí (vyplní se při zveřejnění).
- **Poháry** (nový): Název, Ročník, Pro, Kategorie, Body, Body za NP, Započítat kol, Min. kol, Stav (koncept / zveřejněno / zrušeno).

## Výpočet – požární útok

1. **Výsledný čas pokusu je delší z časů terčů L a P.** Útok končí sražením obou terčů (Plamen 5.1, Hodnocení: „signalizace obou terčů“).
2. **Pokusy:** 1, nebo 2 (nastavení soutěže). **Platí lepší** pokus (Plamen 5.1: „Do hodnocení se započítává lepší z obou pokusů“).
3. **NP (neplatný pokus) je vždy za platnými pokusy.** Pro porovnání má NP hodnotu 998 s a nenastoupený nebo chybějící pokus 999 s (Plamen, Hodnocení družstev).
4. **Shoda nejlepšího času:**
   - *pravidla SH ČMS*: rozhoduje menší součet obou pokusů (Plamen, Hodnocení družstev: „Při shodném čase v disciplíně se provádí srovnání součtu časů obou pokusů“). Při stále stejném součtu nebo při jednom pokusu je místo dělené (1., 2., 2., 4.).
   - *horší pokus*: rozhoduje čas horšího pokusu, pak dělené místo (OZ uzlové štafety 2026, Plamen 5.6 běh na 60 m).
   - *rozhoduje pořadatel*: pořadí mezi družstvy se stejným časem určí hlavní rozhodčí v panelu. Bez toho nejde ověřit.
5. **DIS** (diskvalifikace) a **nenastoupil** jsou bez pořadí na konci listiny. Odhlášené družstvo ve výsledcích není.

Automatický test je `testPoradiSoutezi` (menu OSH data → Soutěže: test výpočtu pořadí). Stejný výpočet v `souteze.js` je ověřený proti serveru na 900 náhodných případech.

## Pohár / liga

Podle **Pravidel Poháru rady mládeže v požárním útoku 2026** (schválena VV OSH PZ 3. 12. 2025, Disk: Mládež / 2026 Pohár …).

- **Kolo poháru** je soutěž, u které je vyplněné *Pohár – ID*. Do pořadí se počítají jen **zveřejněná** kola.
- **Body za umístění** v kategorii:
  - „počet družstev“: vítěz kola dostane tolik bodů, kolik je družstev **přihlášených do poháru** v kategorii, druhý o bod méně – bez ohledu na to, kolik jich do kola přijelo. Počet je v poli *Družstev v poháru* (např. „přípravka 4, mladší 10, starší 8, smíšený dorost 6“). Bez něj se vezme počet různých družstev ze všech kol.
  - nebo tabulka „10,8,6,5,4,3,2,1“ (další místa 0).
  - Dělené místo dostane body toho místa.
- **NP** dostane *Body za NP*, prázdné pole = body podle umístění (NP je za platnými). **DIS** 0 b. **Nenastoupil** = v kole nestartoval.
- **Celkem** = součet *Započítat kol* nejlepších kol (prázdné = všechna, pravidla 2026: všechna). Družstvo, které neabsolvovalo *Min. kol* (pravidla 2026: aspoň polovina kol), je bez pořadí.
- **Shoda bodů:** větší počet lepších umístění (víc 1. míst, pak 2. míst…), pak **lepší čas dosažený v celém ročníku**, pak dělené místo.
- Družstvo se mezi koly páruje **podle názvu v kategorii**, proto musí sbor psát název stejně (např. „Sloup A“).
- Ověřeno na výsledcích 2026: v kategorii mladší je v tabulce 9 družstev, vítěz kola měl vždy 10 bodů – do poháru bylo přihlášeno 10 družstev.
- Mimo aplikaci zůstává: ztráta bodů za nenastoupení k vyhlášení (max. 3 omluvy), registrační poplatek, přípravka měří stopkami (panel to umí – zapisuje se čas).

## Organizační zabezpečení v aplikaci (22. 10. 2026)

OZ se vyplňuje ve formuláři soutěže (Akce → Soutěže → Nová / Upravit, blok Organizační zabezpečení) a aplikace z něj vytvoří **PDF** v podobě dosavadních OZ okresu (tlačítko *Vytvořit PDF organizačního zabezpečení* v detailu; po každém uložení soutěže se PDF samo aktualizuje).
- Uloženo jako JSON ve sloupci *OZ* listu Soutěže, PDF ve složce Soutěže/<rok> na sdíleném disku, odkaz ve sloupci *OZ – PDF*. **Kdokoli s odkazem až od otevření přihlášek**; v konceptu a po zrušení soutěže neveřejné.
- Hlavička PDF z Nastavení **OZ_HLAVICKA** (řádky oddělené \n – doplňte třeba telefon).
- Sama se doplní: místo, den, pořadatel, hlavní rozhodčí, kategorie s ročníky a limity, disciplína a pokusy (když nejsou vyplněné), přihlášky v portálu do uzávěrky, startovné s účtem OSH (Nastavení OKRES_UCET).
- **Max. družstev na SDH** v kategorii hlídá aplikace při přihlášce sboru (okres může přidat i nad limit). Ročníky narození vidí sbor u výběru kategorie.
- Na webu: PDF mezi dokumenty soutěže, v údajích zahájení, startovné a náčelník štábu. V portálu sboru odkaz na PDF a startovné.
- *Převzít z jiné soutěže* zkopíruje OZ (harmonogram, štáb, podmínky, úpravy pravidel…) – stačí upravit časy a ročníky.

## Organizační zabezpečení okresních soutěží 2026 (Disk: Mládež)

Všechna OZ mají stejnou kostru (podle ní je blok OZ v aplikaci):
- **Hlavička:** pořádá (OORM + okrsek / SDH), místo, den konání.
- **Harmonogram** (často po kategoriích): prezence, porada rozhodčích, porada vedoucích, nástup, zahájení, předpokládaný konec.
- **Štáb:** náčelník štábu, velitel soutěže, hlavní rozhodčí, prezence a sčítací komise, zdravotní služba.
- **Podmínky účasti:** registrace sportovců na OSH, kategorie s **ročníky narození** a počtem členů (min. / max.), kolik členů musí být z jednoho SDH a kolik lze zapůjčit, max. družstev / hlídek / jednotlivců na SDH, počet pomocných rozhodčích ze SDH, přihláška s razítkem a průkazy MH s fotografií.
- **Disciplíny a počet pokusů**, **úpravy pravidel** proti směrnici (často dlouhý text), příloha **vlastní materiál**.
- **Startovné** (výše, za SDH nebo za družstvo, splatnost, účet, zpráva pro příjemce), strava, výstroj, doprava.
- **Přihlášky:** do kdy a kam (e-mail oorm@, tabulka Excel se jmény).
- **Protesty** (kauce 200 / 500 Kč).

Z OZ 2026 plyne pro další kroky:
- **Uzlová štafeta** (OZ 14. ročníku): jednotlivci i družstva (5 členů), 2 pokusy, platí rychlejší, **shoda = horší pokus**. Trestné sekundy: předčasný start 2.–5. závodníka 10 s, chybný uzel 30 s, pomoc 30 s. Neplatný pokus: 2. chybný start, vynechaný uzel, méně než 3 správné uzly (přípravka 2), zkoušení uzlů při přípravě, nad 60 s (přípravka 90 s). Uzly: tesařský, lodní, úvaz na proudnici, zkracovačka, záchranný (přípravka tesařský, lodní, plochá spojka). → pravidla pro R3 v podstatě dává OZ.
- **Dorost** (OZ okresního kola): družstva dorostenci, dorostenky, smíšené (5–8 členů); jednotlivci mladší / střední / starší podle ročníku; požární útok všech kategorií na 2 B, je zároveň 1. kolem poháru; štafeta 4 × 100 m v okrese nebývá.
- **Hra Plamen 2026:** 1. kolo štafeta 4 × 60 m a štafeta CTIF, 2. kolo požární útok, útok CTIF, štafeta dvojic – s řadou okresních úprav (přípravka, časový limit CTIF 5 min, terč s plechovkou za 10 trestných sekund…).
- **60 m překážek:** jednotlivci, dívky / chlapci ve 4 věkových skupinách podle ročníku, 2 pokusy.
- **ZHVB:** hlídky přípravka, mladší, starší, dorost (dorostenci, dorostenky, smíšený), stanoviště K1–K8, max. hlídek na SDH, startovné 300 Kč za SDH.

## Web a kalendář

- `?co=web` vrací `souteze: [{ rocnik, souteze: [...] }]` ve stejném formátu jako `data/souteze-RRRR.js`. Soutěže ze tabulky se doplní k ročníkům z datových souborů a stejné ID přepíše.
- **Plánované soutěže** (přihlášky až ověřeno) jsou na webu bez výsledků, **zveřejněné** s výsledky a PDF. Poháry jsou na webu jen ve stavu zveřejněno.
- Statická kopie `data/web.json` obsahuje soutěže taky. Nejsou v nich osobní údaje kromě jména hlavního rozhodčího, které je veřejné v propozicích.
- **Kalendář:** soutěž založená okresem se zapíše do listu Akce jako zveřejněná a odtud do Google Kalendáře (B5). Soutěž ze žádosti už v kalendáři je. Zrušení ji z kalendáře odstraní.

## Rozbor pravidel (docs/pravidla)

### Směrnice hry Plamen (platnost od 1. 9. 2022)

- **Ročník** trvá od 1. 9. do 31. 8. Věková kategorie se určuje podle věku v roce ukončení ročníku.
- **Kategorie družstev:**
  - přípravka do 6 let, mladší do 11 let, starší do 15 let, bez rozlišení pohlaví;
  - družstvo má aspoň 5 členů, do vyšších kol 9;
  - mladší nesmí doplnit nikdo starší, starší smí doplnit mladší.
- **Jednotlivci** (jen běh na 60 m s překážkami): přípravka, mladší dívky, mladší chlapci, starší dívky, starší chlapci.
- **Doporučené disciplíny okresního kola:** požární útok, štafeta 4 × 60 m, požární útok s překážkami CTIF, štafeta CTIF, štafeta požárních dvojic. Okresní rada mládeže (OORM) je může upravit, nejpozději 60 dní před kolem.

| Disciplína | Kdo | Pokusy | Hodnocení |
| --- | --- | --- | --- |
| Požární útok (5.1) | 7 členů, u mladších obsluhuje stroj dospělý | okres 1 nebo 2 (pořadatel), vyšší kola 2, platí lepší | Čas do signalizace obou terčů. **Neplatný pokus:** sací koš nepřišroubovaný před ponořením, pomoc druhého proudu, cizí pomoc, zavodnění nad 60 s, útok nad 120 s, překročení čáry nástřiku, saponát, ztracená výstroj, nepoužitý předepsaný materiál, rozpadlé sací vedení; 2 chybné starty. |
| Požární útok CTIF (5.2) | 8 + velitel | okres podle pořadatele, vyšší kola 2, platí lepší | Čas + **trestné body = ztrátové sekundy**: překážka 10, přetočení hadice 5, rozpojení spojky 20, chybné rozložení hadice 10, zapomenuté nářadí 5, chybný technický prostředek 10, chybný uzel 10, nesprávná práce 10, chyba velitele 10. NP: nenastříkaný terč, závada vlastního materiálu, cizí pomoc. |
| Štafeta 4 × 60 m (5.3) | 2 štafety po 4 | každá 1 pokus, platí lepší štafeta | Čas. Jen neplatné pokusy (kladina, předávka mimo území, rozpojené hadice, PHP…). |
| Štafeta CTIF 400 m (5.4) | 9 závodníků | okres podle pořadatele, vyšší kola 2 | Čas + tb: spojení 10, překážka 10, vyšlápnutí 10, proudnice nepřenesená přes cíl 20. |
| Štafeta požárních dvojic (5.5) | 1 nebo 2 štafety (4 + velitel) | platí lepší štafeta | Čas + tb (předčasné vyběhnutí 10 / člen, nesvinutý kotouč…). |
| Běh 60 m s překážkami (5.6) | jednotlivci | 2, platí lepší | Při shodě na 1.–3. místě rozhoduje horší čas, pak rozběh. |

**Úřední čas** při ručním měření:
- měří 3 časoměřiči (nejméně 2);
- když se dva časy shodují, platí ten; jinak platí střední čas;
- při dvou stopkách, které se rozcházejí, platí horší čas;
- elektronická časomíra dává úřední čas rovnou.

Ve směrnici se nikde **neprůměruje**.

**Celkové pořadí kola:**
- Družstvo dostane body za umístění v disciplínách (1. místo = 1 bod…) a nejnižší součet vyhrává.
- Hodnotí se jen družstvo, které absolvovalo všechny disciplíny.
- Při shodě součtu rozhoduje lepší umístění v disciplínách v tomto pořadí: PÚ, 4 × 60 m, PÚ CTIF, štafeta CTIF, dvojice.
- Při shodě času v disciplíně rozhoduje součet obou pokusů, potom trestné body u lepšího času. NP má hodnotu 998 s, nenastoupil 999 s.

**Pro další krok (Hra Plamen):**
- výsledky po disciplínách, u CTIF disciplín trestné sekundy po druzích chyb;
- body za umístění a celkové pořadí podle pravidel výše;
- jednotlivci 60 m jako samostatná kategorie se dvěma pokusy.

### ZHVB – rámcové organizační zabezpečení 2024/2025 (schváleno ÚORM 31. 3. 2024)

- **Hlídka má 5 členů.**
- **Kategorie MH:**
  - přípravka do 6, mladší do 11, starší 11–15;
  - dorost smíšený, dorostenky, dorostenci 15–18.
- **Kategorie neorganizovaných:** ZŠ1 do 11, ZŠ2 do 15, SŠ do 18.
- **Účast MH** je podmíněná splněním celoroční činnosti (kronika, posouzení OORM do 20. 9.).
- **Hodnocení:** čas na trati + **trestné body (1 bod = 1 minuta)** − čekací čas na stanovištích. Vyhrává nejnižší výsledný čas.
- **Výsledek je neplatný**, když hlídka:
  - opustí předstartovní prostor;
  - vynechá stanoviště nebo zkrátí trať;
  - odmítne úkol nebo přijme cizí pomoc;
  - poruší značení;
  - nedoběhne celá;
  - ztratí startovní kartu;
  - manipuluje s mířidly.
- **Rozhodčí:** hlavní rozhodčí, startér, zapisovatel, 7 rozhodčích na stanovištích a časoměřiči. Při hodnocení je „vhodné, aby byli přítomni vždy min. 2 rozhodčí“. Nejde o průměr, ale o potvrzení chyby.
- **OORM smí** upravit počet stanovišť a hodnocení, a to nejméně 90 dní předem v OZ.

| Stanoviště | Úkol a kategorie | Trestné body |
| --- | --- | --- |
| K1 | hod na cíl (přípravka, ZŠ1, ZŠ2, SŠ) / střelba ze vzduchovky (mladší, starší, dorost) | 1 za nepovalenou láhev / špalík, max 15; 4. hod nebo rána = 3 b za člena |
| K2 | turistické a topografické značky (všichni) | 1 za značku, max 10 |
| K2 | stopy, stromy, rostliny (všichni) | 1 za obrázek, max 5 |
| K3 | uzly (přípravka jen plochou spojku) | 3 za uzel, max 15 |
| K4 | přeskok příkopu (přípravka, ZŠ, SŠ / dorost) | 3, max 15 / dorost 1, max 5 |
| K4 | lano (mladší, starší / dorost) | 3, max 15 / dorost 2, max 10 |
| K5 | rizika v domácnosti (přípravka, mladší, ZŠ1) / chování při mimořádných událostech (starší, dorost, ZŠ2, SŠ) | 1, max 5 |
| K5 | trojúhelník hoření (všichni) | 5 |
| K5 | značky technických prostředků PO (všichni) | 1, max 5 |
| K6 | první pomoc (přípravka, mladší, starší, ZŠ1, ZŠ2) | 3, max 15 |
| K6 | stavy ohrožující život (dorost, SŠ) | příznaky 1 + postup 2, max 15 |
| K7 | záchranářská ulička (všichni) | 5 |
| K7 | tísňová volání (všichni) | 1, max 5 |
| K7 | evakuační zavazadlo (všichni) | 1 za člena, max 5 |
| K8 | azimut (dorost, SŠ) | chybí 1 razítko 5 b, 2 razítka 10 b, 3 razítka = hlídka nehodnocena |

**Pro další krok (ZHVB):**
- zápis po stanovištích: rozhodčí stanoviště zapíše trestné body a čekací čas, cíl zapíše čas na trati;
- tabulka stanovišť podle kategorie je výše;
- strop bodů podle tabulky;
- pole „výsledek neplatný“.
- Panel i offline fronta se použijí stejné, jen jiný formulář zápisu.

### Uzlová štafeta

V `docs/pravidla` pravidla nejsou. Výsledky ročníků 2017–2026 v `data/souteze-*.js` uvádějí „jednotlivci a družstva, 2 pokusy, počítá se rychlejší“. Čeká se na R3 (OORM).

## Otázky, které z pravidel nejde rozhodnout

Zodpovězeno z Disku (OZ a pravidla poháru 2026): shoda bodů v poháru, kolik bodů dostane vítěz kola, min. počet kol, pravidla uzlové štafety, kategorie dorostu.

1. **Pravidla pro dospělé:** V `docs/pravidla` ani na Disku mládeže nejsou pravidla pro dospělé. Pro požární útok dospělých jsem převzal pravidla hry Plamen (lepší ze 2 pokusů, shoda podle součtu, NP = 998). Platí pro okresní soutěž dospělých stejně, nebo jsou propozice okresní soutěže v požárním sportu jinde?
2. **Časové limity požárního útoku:** Plamen má zavodnění do 60 s a útok do 120 s, jinak NP. Mají se v panelu hlídat automaticky (čas nad 120 s = NP), nebo to stačí nechat na rozhodčím? Platí stejný limit pro dospělé a dorost?
3. **Ruční měření stopkami** (přípravka v poháru, uzlovka): Panel teď bere jeden úřední čas na terč nebo pokus. Má přijímat i všechny stopky a úřední čas dopočítat (střední ze tří, horší ze dvou)?
4. **„Průměr z více rozhodčích“** (krok v původním plánu B8): Ani Plamen, ani ZHVB, ani OZ 2026 nic neprůměrují. Lze krok zrušit?
5. **NP v poháru:** Pravidla 2026 NP neřeší. Teď dostane NP body podle umístění (je za platnými), nebo pevný počet z pole *Body za NP*. Je to tak správně?
6. **Ztráta bodů v poháru** za nenastoupení k vyhlášení (max. 3 omluvy): Má se evidovat v aplikaci, nebo zůstane mimo ni?
7. **Pořadí NP družstev:** Teď mají NP družstva pořadí za platnými, při shodě dělené (např. 5.–6.). Má se jim pořadí dávat, nebo je uvádět bez pořadí jako DIS?
8. **Startovní pořadí:** Teď se losuje v každé kategorii zvlášť. Losuje se na okresních soutěžích přes všechny kategorie najednou (společný rozpis)?
9. **Hlavní rozhodčí na webu:** Jeho jméno je na webu a ve výsledkové listině, jako dosud v OZ. Souhlasí s tím OORM a VV?
