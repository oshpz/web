# Převod starých aktualit z Joomly (B15) – zkušební běh

Stav 24. 10. 2026. **Zkušební běh: nic se nezapsalo do tabulky ani na Disk.** Data, fotky a přílohy jsou jen lokálně ve složce `migrace/` (v `.gitignore`), v repozitáři je jen tento report a kód.

## Jak to proběhlo

- **Zdroj:** veřejný web https://www.oshpz.cz (Joomla 4), SQL export nebyl k dispozici. Stahování šetrně: 1 požadavek za sekundu, User-Agent „OSHPZ migrace“, vše v mezipaměti (opakovaný běh nic znovu nestahuje).
- **Najití článků:** stránka článku na starém webu neukazuje datum, autora ani kategorii, mají je ale kanály kategorií. Proto (1) kanály Atom všech kategorií podle čísla kategorie (`index.php?option=com_content&view=category&id=N&format=feed&type=atom`) se stránkováním `&start=`, i kategorie mimo menu (např. zápisy OKRR, ročníky Plamenu); (2) stránka každého článku pro plný text a obrázky; (3) kontrola všech čísel článků 1–719, aby nic nevypadlo.
- **Nástroj:** `node nastroje/joomla-migrace.mjs vse` (stažení + zpracování), podklady pro report `node nastroje/joomla-report.mjs`. Fotky zmenšuje `nastroje/zmensit-foto.swift` (macOS).
- **Výstup v `migrace/`:** `prispevky.json` (připravené řádky listu Příspěvky), `media/<číslo článku>/` (fotky a přílohy), `presmerovani.json` (stará URL → nová adresa), `vynechane.json`, `report.json`.

## Převod

- **Text** → omezený Markdown listu Příspěvky (stejný jako u B14: odstavce, `**tučně**`, `[odkaz](https://…)`, odrážky `- `). Nadpisy jako tučný odstavec, tabulky jako řádky „a | b“. Odstraněno: Joomla styly, `<span>`, prázdné odstavce, skripty, značky pluginů (`{gallery}`, `{loadmodule}`…), věta ochrany e-mailů Joomly („Tato e-mailová adresa je chráněna před spamboty…“ – adresa je ve skriptu, zbude jen ta věta). Entity (`&uuml;` …) a rozbité kódování opraveno.
- **Odkazy:** jen `https://` (15 odkazů převedeno z `http://`), sledovací parametry pryč. Odkazy na jiné staré články → `https://oshpz.cz/?clanek=…`. Soubory na starém webu → přílohy; dokumenty na cizích webech zůstaly odkazem. Vložené video → řádek „Video: https://…“.
- **Fotky:** delší strana 1600 px, JPEG bez EXIF/GPS, první = hlavní fotka, ostatní galerie. Vynechány ikony, smajlíky, SVG a obrázky pod 200 px. Obrázky z cizích webů v textu článku se stáhly (jsou v seznamu problémů).
- **Přílohy:** PDF, DOC(X), XLS(X), PPT(X), ZIP ze starého webu, každá s MD5. **Shoda se zveřejněnými dokumenty orgánů** se hledá až při importu podle MD5 (Disk ho u každého souboru zná) – stejný soubor se nenahraje znovu, příspěvek na dokument jen odkáže.
- **Pole:** Stav = zveřejněno, Zdroj = joomla, Zveřejněno = původní datum z kanálu, Pro koho = veřejnost, Adresa = slug z titulku (při shodě + rok, pak -2), Autor = jméno z Joomly (účet „OSHPZ“ → prázdné = „OSH Praha-západ“), Perex = první skutečný odstavec bez formátování a holých adres (do 240 znaků). ID při importu `PJ<číslo starého článku>`.

## Kategorie → štítky

Štítky se tvoří z názvu kategorie a její cesty na starém webu (ne ze slov titulku):

| Pravidlo (kategorie / cesta obsahuje) | Štítek |
| --- | --- |
| jednání, zápis, výkonný výbor, kontrolní (OKRR), odborná rada, shromáždění | orgány |
| mládež (OORM), Plamen, dorost, uzlová štafeta | MH |
| sport (ORHS), soutěž, pohár, liga | soutěže |
| akce | akce |
| akce SDH, sbory | sbory |
| zasloužilí hasiči (aktiv, medailonky, blahopřejeme, vzpomínáme) | zasloužilí hasiči |
| historie, odboj, kronika, zaniklé sbory | historie |
| dokumenty | dokumenty |
| zprávy, úvodní stránka (a vše ostatní) | okres |

Výsledek po kategoriích je v tabulce níže. Nové štítky oproti příspěvkům z aplikace: akce, orgány, zasloužilí hasiči, historie, dokumenty.

## Vynecháno (22 stránek, ne aktuality)

Starý web má i stálé stránky bez data a mimo kategorie – na novém webu jsou jinde (orgány, kontakty, sbory, dokumenty) a obsahují kontakty, proto se nepřevádějí: vedení OSH a kontakty orgánů (č. 8, 77, 81–83, 88), seznamy členů OORR, OORB, VV a stránka OORB (12, 14, 17, 78), sbory a okrsky s kontakty (97, 102), seznam zasloužilých hasičů (95), uvítání, stanovy, odbornosti, dokumenty JPO, přihlášky, metodický pokyn a představení OSH (10, 80, 98, 99, 245, 474, 589), Pohár starosty a výsledky (113, 242). Seznam s čísly je v `migrace/vynechane.json`.

## Rozsah

| | Počet |
| --- | --- |
| Kategorie s články (kanály podle čísla kategorie) | 42 |
| Články celkem (veřejně publikované) | 523 |
| z toho mimo kanály kategorií (dohledané podle čísla) | 18 |
| Požadavků na starý web (tento běh, bez mezipaměti) | 931 |

### Po letech

| Rok | Článků |
| --- | --- |
| 2026 | 46 |
| 2025 | 31 |
| 2024 | 48 |
| 2023 | 24 |
| 2022 | 27 |
| 2021 | 21 |
| 2020 | 43 |
| 2019 | 105 |
| 2018 | 98 |
| 2017 | 74 |
| 2016 | 6 |

### Po kategoriích a štítcích

| Kategorie Joomly | Cesta na starém webu | Článků | Štítky |
| --- | --- | --- | --- |
| Akce SDH | `/index.php/akce/67-akce-sdh` | 94 | akce, sbory |
| Jednání VV OSH | `/index.php/organy-osh/vykonny-vybor/jednani-vykonneho-vyboru` | 73 | orgány |
| Akce OSH | `/index.php/akce/66-akce-osh` | 57 | akce |
| Zprávy | `/index.php/zpravy` | 46 | okres |
| Jednání OKRR | `/index.php/organy-osh/okresni-kontrolni-a-revizni-rada-sh-cms/jednani-okrr` | 43 | orgány |
| Historie | `/index.php/historie` | 27 | historie |
| Ze života ZH | `/index.php/aktiv-zaslouzilych-hasicu/dalsi` | 26 | zasloužilí hasiči |
| Jednání OORM | `/index.php/organy-osh/usek-mladeze/jednani-oorm` | 20 | orgány, MH |
| Vzpomínáme | `/index.php/aktiv-zaslouzilych-hasicu/vzpominame` | 19 | zasloužilí hasiči |
| Ostatní hasičské akce | `/index.php/akce/68-ostatni-hasicske-akce` | 16 | akce |
| Jednání OORB | `/index.php/organy-osh/usek-bezpecnosti/jednani-rady` | 13 | orgány |
| Jednání okresního shromáždění představitelů | `/index.php/organy-osh/okresni-shromazdeni-predstavitelu/jednani-okresniho-shromazdeni-predstavitelu` | 12 | orgány |
| Soutěže | `/index.php/organy-osh/usek-mladeze/souteze` | 10 | MH, soutěže |
| Dokumenty | `/index.php/dokumenty` | 9 | dokumenty |
| Blahopřejeme | `/index.php/aktiv-zaslouzilych-hasicu/blahoprejeme` | 8 | zasloužilí hasiči |
| 2018/2019 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2018-2019` | 7 | MH, soutěže |
| Medailónky ZH | `/index.php/aktiv-zaslouzilych-hasicu/medailonky-zh` | 6 | zasloužilí hasiči |
| 2021/2022 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2021-2022` | 5 | MH, soutěže |
| 2017 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2017` | 4 | MH, soutěže |
| 2022/2023 | `/index.php/organy-osh/usek-mladeze/souteze/dorost/2022-2023` | 4 | MH, soutěže |
| 2018 | `/index.php/organy-osh/usek-mladeze/souteze/dorost/2018` | 3 | MH, soutěže |
| 2024/2025 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2024-2025` | 3 | MH, soutěže |
| 2023/2024 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2023-2024` | 3 | MH, soutěže |
| 2020/2021 | `/index.php/organy-osh/usek-mladeze/souteze/dorost/2020-2021` | 3 | MH, soutěže |
| Jednání OORV | `/index.php/organy-osh/usek-sportu/jednani-orhs` | 2 | orgány, soutěže |
| Zaniklé sbory | `/index.php/sbory/zanikle-sbory` | 2 | sbory, historie |
| Okresní odborná rada sportu | `/index.php` | 2 | orgány, soutěže |
| Další zajímavé akce | `/index.php/akce/69-dalsi-zajimave-akce` | 2 | akce |
| 2019/2020 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2019-2020` | 2 | MH, soutěže |
| 2026/2027 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2026-2027` | 1 | MH, soutěže |
| 2025/2026 | `/index.php/organy-osh/usek-mladeze/souteze/plamen/2025-2026` | 1 | MH, soutěže |

## Fotky a přílohy

| | Počet | Velikost |
| --- | --- | --- |
| Fotky (zmenšené na 1600 px, JPEG bez EXIF/GPS) | 422 | 102,4 MB (originály 239,9 MB) |
| Vynechané malé obrázky (pod 200 px) | 3 | – |
| Přílohy (PDF, DOC, XLS…) | 318 | 115,7 MB (unikátních 115,7 MB) |
| Články s aspoň jednou fotkou | 170 | |
| Články s přílohou | 189 | |

Typy příloh: pdf 192, docx 51, doc 34, xlsx 25, xls 9, zip 5, pptx 2.

## Články s problémy

| Problém | Článků |
| --- | --- |
| e-mail skrytý ochranou Joomly vynechán | 16 |
| rozbitý obrázek | 4 |
| stránka článku na staré adrese nejde otevřít (text podle čísla článku) | 2 |
| rozbitá příloha | 2 |
| obrázek z cizího webu (stažen) | 1 |
| odkazy mimo web (aspoň jeden) | 109 (celkem 171 odkazů, z toho 15 převedeno z http na https) |
| interní odkazy na staré články (přepsané na ?clanek=) | 0 (celkem 0) |

<details><summary>Seznam článků s problémy</summary>

- **Pomozme rodině našich hasičů** (2026, `/index.php/zpravy/678-pomozme-rodine-nasich-hasicu`): obrázek z cizího webu (stažen): https://www.dh.cz/images/Dokumenty/zpravy/2026/3_Dopis_pomoc_rodine_Svobodovych.jpeg; rozbitý obrázek: https://www.dh.cz/cache/images/Dokumenty/zpravy/2026/Dopis_pomoc_rodine_Svobodovych_599x449-equal.jpeg (HTTP 404); rozbitý obrázek: https://www.dh.cz/cache/images/Dokumenty/zpravy/2026/2_Dopis_pomoc_rodine_Svobodovych_317x569-equal.jpeg (HTTP 404)
- **Zápis z jednání ORHS duben 2026** (2026, `/index.php?option=com_content&view=article&id=665`): stránka článku na staré adrese nejde otevřít (text podle čísla článku)
- **Slavnostní vyhodnocení 1. ročníku ligy v požárním útoku** (2025, `/index.php/akce/66-akce-osh/644-slavnostni-vyhodnoceni-1-rocniku-ligy-v-pozarnim-utoku`): rozbitý obrázek: https://www.oshpz.cz/Users/michalkalian/Downloads/WhatsApp%20Image%202025-09-29%20at%2016.05.35.jpeg (HTTP 404)
- **Zápis z jednání ORHS duben 2025** (2025, `/index.php?option=com_content&view=article&id=623`): stránka článku na staré adrese nejde otevřít (text podle čísla článku)
- **Cesta k českému hasičskému názvosloví přes duchovního otce Sokola** (2024, `/index.php/historie/588-cesta-k-ceskemu-hasicskemu-nazvoslovi-pres-duchovniho-otce-sokola`): rozbitý obrázek: blob:<a href= (HTTP 0)
- **Zápis z Vedení ze dne 6. 2. 2024** (2024, `/index.php/organy-osh/vykonny-vybor/jednani-vykonneho-vyboru/563-zapis-vv-ze-dne-6-2-2024`): rozbitá příloha: https://www.oshpz.cz/images/Org%C3%A1ny_OSH/V%C3%BDkonn%C3%BD_v%C3%BDbor_OSH/Jedn%C3%A1n%C3%AD/Usnesen%C3%AD-vybaven%C3%AD-pro-ml%C3%A1de%C5%BE.pdf (místo souboru stránka – soubor na starém webu chybí)
- **Webinář "Datové schránky" a "Vyznamenání SH ČMS" - materiály** (2022, `/index.php/akce/66-akce-osh/498-webinar-datove-schranky-a-vyznamenani-sh-cms-materialy`): e-mail skrytý ochranou Joomly vynechán (2×)
- **Akce DOBROUŠKY - výroba panenek pro osamělé seniory - SDH Libeň** (2020, `/index.php/akce/67-akce-sdh/452-akce-dobrousky-vyroba-panenek-pro-osamele-seniory-sdh-liben`): e-mail skrytý ochranou Joomly vynechán (1×)
- **10. ročník okresního kola uzlové štafety, Středokluky, 14. 3. 2019** (2020, `/index.php/akce/66-akce-osh/419-10-rocnik-okresniho-kola-uzlove-stafety-stredokluky-14-3-2019`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Setkání kronikářů SDH - 5. 4. 2020 - Dobřichovice** (2020, `/index.php/akce/66-akce-osh/418-setkani-kronikaru-sdh-5-4-2020-dobrichovic`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Soutěž koňských stříkaček, Kytín, 24.8.2019** (2019, `/index.php/akce/67-akce-sdh/373-soutez-konskych-strikacek-kytin-24-8-2019`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Pohár starosty OSH, 21. 9. 2019, Čisovice** (2019, `/index.php/akce/66-akce-osh/369-pohar-starosty-osh-21-9-2019-cisovice`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Hasičská fontána k příležitosti dne dárců kostní dřeně, 21.9.2019, Vestec** (2019, `/index.php/akce/67-akce-sdh/368-hasicska-fontana-k-prilezitosti-dne-darcu-kostni-drene-21-9-2019-vestec`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Pohár starosty OSH, 29.6.2019, Pikovice** (2019, `/index.php/akce/66-akce-osh/343-pohar-starosty-osh-29-6-2019-pikovice`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Kurz pro hlavní vedoucí táborů, 8.3.-10.3.2019** (2019, `/index.php/akce/68-ostatni-hasicske-akce/308-kurz-pro-hlavni-vedouci-taboru-8-3-10-3-2019`): e-mail skrytý ochranou Joomly vynechán (1×)
- **9. ročník okresního kola uzlové štafety, Středokluky, 16.3.2019** (2019, `/index.php/akce/66-akce-osh/307-9-rocnik-okresniho-kola-uzlove-stafety-stredokluky-16-3-2019`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Školení preventistů pro všechny členy SDH a JSDH, 13.4.2019** (2019, `/index.php/akce/66-akce-osh/306-skoleni-preventistu-pro-vsechny-cleny-sdh-a-jsdh-13-4-2019`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Zápis z jednání 3. 12. 2018** (2019, `/index.php/organy-osh/usek-bezpecnosti/jednani-rady/302-zapis-z-jednani-3-12-2018`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Soutěž, Pivní slavnosti Hostivice, 8.9.2018** (2018, `/index.php/akce/67-akce-sdh/262-soutez-pivni-slavnosti-hostivice-8-9-2018`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Školení rozhodčích požárního sportu - 17. 4. 2018** (2018, `/index.php/akce/66-akce-osh/201-skoleni-rozhodcich-pozarniho-sportu-17-4-2018`): rozbitá příloha: https://www.oshpz.cz/images/Pozv%C3%A1nka_%C5%A1kolen%C3%AD_rozhod%C4%8D%C3%ADch_PS_17.docx (místo souboru stránka – soubor na starém webu chybí)
- **Pietní setkání u hrobu Petra Jindřicha** (2017, `/index.php/aktiv-zaslouzilych-hasicu/vzpominame/175-pietni-setkani-u-hrobu-petra-jindricha`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Oslavy 110. výročí SDH Choteč - 1. 7. 2017** (2017, `/index.php/akce/67-akce-sdh/141-oslavy-110-vyroci-sdh-chotec-1-1-2017`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Školení pokladníků** (2017, `/index.php/akce/66-akce-osh/109-skoleni-pokladniku`): e-mail skrytý ochranou Joomly vynechán (1×)
- **Trojnásobné životní jubileum našich „Zasloužilých hasičů“** (2016, `/index.php/aktiv-zaslouzilych-hasicu/blahoprejeme/93-trojnasobne-zivotni-jubileum-nasich-zaslouzilych-hasicu`): rozbitý obrázek: https://mail.volny.cz/download.php?… (HTTP 200); rozbitý obrázek: https://mail.volny.cz/download.php?… (HTTP 200); rozbitý obrázek: https://mail.volny.cz/download.php?… (HTTP 200)

</details>

## Ukázka převedených článků

**Štědrý dar Nadace Agrofert** – 2024, štítky okres, adresa `?clanek=stedry-dar-nadace-agrofert`, 3 fotek, 0 příloh

> Máme milou povinnost oznámit, že jsme uspěli v mimořádné výzvě Hasičského fondu Nadace Agrofert, která byla určena pro projekty zaměřené na pomoc po rozsáhlých povodních. Požádali jsme o prostředky na pořízení dalších vysoušečů, abychom mohli ještě lépe pomáhat těm, kteří byli postiženi povodní. Náš projekt správní radu Nadace Agrofert zaujal a byl nám poskytnut grant ve výši 50 000 Kč. Tyto prostředky byly využity k …

**Zápis OKRR ze dne 16. 10. 2024** – 2024, štítky orgány, adresa `?clanek=zapis-okrr-ze-dne-16-10-2024`, 0 fotek, 1 příloh

> Zápis z jednání

**Zapojení hasičů do odboje za 2. světové války** – 2026, štítky historie, adresa `?clanek=zapojeni-hasicu-do-odboje-za-2-svetove-valky`, 0 fotek, 0 příloh

> Rešerše k pojmu hasičský odboj: ⏎ https://docs.google.com/document/d/10N3p-gQe55EpuDmuohoamIno5CRlDneL/edit ⏎ Archivní materiál v podobě dotazníků-zapojení hasičů do odboje za 2. světové války: ⏎ https://drive.google.com/file/d/1aaaRHTK-0EEr8AHU9hc3sIVDmJ4aRRTe/view

## Odhad místa na Disku

Fotky 102,4 MB + přílohy 115,7 MB = **218,1 MB** (při propojení shodných příloh s dokumenty orgánů méně; unikátní přílohy 115,7 MB). Místo se počítá do úložiště Google Workspace okresu; sdílený disk unese až 400 000 položek, import přidá 740 souborů a 330 složek.


## Přesměrování starých adres

`migrace/presmerovani.json` (pro `data/presmerovani.json`, **zatím necommitováno**): 1 046 cest (každá SEF adresa s `/index.php/…` i bez něj) a 523 čísel článků → adresa `?clanek=`. Formát `{ verze, web, cesty: { "/index.php/zpravy/691-…": "adresa" }, id: { "691": "adresa" } }` – číslo článku pokryje i adresy, které Joomla tvořila jinak (`index.php?option=com_content&view=article&id=691`, `…/691-cokoli`).

Po přepnutí domény oshpz.cz na nový web (GitHub Pages) přijdou staré adresy na stránku, která neexistuje – je potřeba **`404.html`**, která z adresy vytáhne cestu nebo číslo článku, podle `presmerovani.json` přesměruje na `/?clanek=…` a jinak na úvod. Udělat spolu s ostrým importem (L1).

## Ostrý import (připravený, nespuštěný)

`apps-script/ImportJoomla.gs`, funkce `importJoomla` (z editoru Apps Scriptu):

1. Složku `migrace/` (stačí `prispevky.json` a `media/`) nahrát na Disk účtu, pod kterým skript běží.
2. ID složky zapsat do listu Nastavení jako `JOOMLA_SLOZKA`.
3. V tabulce OSH data spustit **Založit / doplnit strukturu** (přibude sloupec Původní adresa a zdroj joomla), pak `importJoomla`.

- Nahraje fotky a přílohy do `Příspěvky/<ID>` na sdíleném disku se sdílením odkazem a zapíše řádky do listu Příspěvky.
- **Opakovatelný:** řádek se pozná podle Zdroj = joomla + Původní adresa, nic se nezdvojí; nedokončený článek (při přerušení) se dokončí a soubory, které už ve složce jsou, se znovu nenahrávají.
- **Po dávkách:** po 4,5 minuty skončí a naplánuje si pokračování za minutu, dokud není hotovo.
- **V režimu TEST jen 20 nejnovějších článků** (vzorek ke kontrole), v OSTRÉM všechny.
- Web zobrazí u převzatých článků jméno autora z Joomly (sloupec Autor je u nich jméno, ne e-mail – `prAutorJmeno_` v `Prispevky.gs`).

## Rozhodnutí (24. 10. 2026)

1. **Zápisy orgánů** – převést **všechny** jako příspěvky (165 článků se štítkem orgány). Shodné přílohy se zveřejněnými dokumenty orgánů import jen propojí (MD5), nenahraje je znovu.
2. **Archiv po letech** – hotovo: na stránce Aktuality jsou pod seznamem roky s počtem článků (Nejnovější · 2026 · 2025 …), `?stranka=aktuality&rok=2019` načte všechny zveřejněné veřejné příspěvky toho roku (`?co=prispevky&rok=` – `prispevkyRok_` v `Prispevky.gs`, mezipaměť 5 min; seznam roků `prispevkyRoky` jde s `?co=web` i do `data/web.json`). Jakmile archiv existuje, zmizí odkaz „Starší zprávy na původním webu“.
3. **Jména autorů** – ponechat (jméno z Joomly, „OSH Praha-západ“ u účtu OSHPZ).
4. **Rozbité obrázky a přílohy** – převést bez nich (na starém webu se neopravují).

Zbývá: ostrý import s přechodem domény (L1) a `404.html` s přesměrováním.
