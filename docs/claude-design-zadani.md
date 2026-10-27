# Zadání pro Claude Design – kontrast a vzhled (F7)

Stav 24. 10. 2026. Projekt v Claude Design: „Redesign webu hasičů Praha západ“, repozitář `oshpz/web`, větev `main`.
Pravidla formátu a vzhledu jsou v `CLAUDE.md` (sekce Formát souborů `.dc.html`, Vzhled, Spolupráce s Claude Design).

## Než začneš: synchronizace

Od poslední práce v Claude Design (navigace správy okresu F6, 14. 10.) se šablony v repozitáři hodně změnily – viz seznam níže. 17. 10. přibyly role barev (F7): v šablonách se nepíše `var(--color-accent)`, ale `var(--color-brand)` (plochy, grafy, velký text) nebo `var(--color-action)` (text, odkazy, tlačítka, ovládací prvky).
**Pracuj jen nad aktuální větví `main`.** Starší kopie souborů v projektu Claude Design nepoužívej, jinak by se tyto změny ztratily.

Změny v šablonách od 14. 10. (zachovat):

| Soubor | Co přibylo nebo se změnilo |
| --- | --- |
| `index.html` | počty sborů, okrsků a členů z dat (`pocty.*`); blok „Chci se přidat“ na stránce sboru přepíná `prihlaskaOnline` / `prihlaskaPozdeji` (odkaz na kancelář místo ukázky); prázdné aktuality na úvodu (`newsHomeZadne`); kalendář: nadcházející nahoře, proběhlé pod „Proběhlo · měsíc“; třída `tap44` a pravidla 44 px pro záložky, řazení, legendu, filtry AZH; výsledky soutěže: sloupce z `v.sloupce` (Hra Plamen – disciplíny / kola), popis nad tabulkou `kat.kolaPopis` – 23. 10.; aktuality: archiv po letech – čipy roků pod seznamem (`prRokyChips`, `prMaArchiv`), načítání a chyba roku (`prRokNacitam`, `prRokChyba`), odkaz na původní web jen bez archivu (`prBezArchivu`), adresa `?stranka=aktuality&rok=` – 24. 10.; Soutěže jako samostatná položka hlavního menu (`navDef` key `souteze`, sekce `souteze`; dřív pod Mladí hasiči), nadpis Soutěže pro mládež i dospělé, z Dokumentů pryč odkaz Soutěže 2026; filtry seznamu `soF.*` (typ, kategorie, sbor – kde startoval; v adrese `?stranka=souteze&rocnik=…&typ=…&kat=…&sdh=…`), počet a Zrušit filtry; Dokumenty: položka s víc odkazy (`d.vice`, `d.odkazy` – tlačítka v řádku, např. přestup online i papírově), běžná položka `d.jeden` – 25. 10. |
| `Aplikace OSH.dc.html` | detail dokumentu: blok tlačítek zveřejněného dokumentu řídí `dk.zverejneny` (pole řídí `dk.locked`), tlačítko „Uložit změny“; obrazovka Moduly se skutečným stavem a v `LIVE_VIEWS`; tlačítko s názvem v první buňce klikacích řádků tabulek (klávesnice); zvonek portálu sboru 44 × 44 px; hlášky výpadku s `chyba` / `sit`; adresa pro příspěvky e-mailem v úvodu Příspěvků; formulář soutěže: druh ZHVB, blok `sf.jeZhvb` (popis hodnocení) a `sf.neniZhvb` (pokusy a shoda jen mimo ZHVB); v OZ „Společný limit na SDH pro víc kategorií“ (`sf.ozSpol`, `sf.pridatSpol`) – 23. 10.; Hra Plamen: blok `sf.jePlamen` (disciplíny `sf.discF`, předvolby `sf.discPredvolby`), pokusy a shoda pod `sf.maPokusy` (dřív `sf.neniZhvb`); pohár: pole Hodnocení `pf2.typ`, bloky `pf2.jePlamen` / `pf2.jePohar`, hlavička tabulky `c.hlava` místo `pf2.kolaHlava`, popis `pf2.poradiPopis`; záložka „Poháry, ligy a Plamen“; detail kola Plamenu: sekce Časový harmonogram (`sd2.jePlamen`, `sd2.hm.*` – nastavení v `<details>`, akce, tabulky s odhadem); portál sboru u soutěže blok „Kdy nastupujete“ (`r.maHarm`, `r.harm`) – 24. 10.; **správa okresu → Soutěže jako seznam a detail**: filtry `so.typ/kat/dj/rok/stav/pohar/ceka` (Čeká na mě), sekce `so.sekce` (tabulka / karty), štítek = další krok okresu (`okKrok`), adresa `#okres/souteze?…`; detail `sd2` (společný s pořádajícím sborem) se záložkami `sd2.zalozky` (Přehled / Družstva / Rozpis ke stojanům / Harmonogram / Výsledky), `sd2.isPrehled/isDruzstva/isRozpis/isHarm/isVysl`, kategorie `sd2.drChips` a `sd2.vysChips`, výsledky prvních 10 + `sd2.tlVysVse`; odkazy pro rozhodčí a hlavní akce zůstávají nad záložkami; třída `ok-obsah-skryt` (prázdný obal pod detailem); Majetek → Výpůjčky: panel protokolu `mj.prot.*` (Předání / Vrácení, příjemce, zaškrtávání věcí, pole, poznámka), tlačítko „Předávací protokol“ vedle „Nová výpůjčka“ (`mj.novyProt`), v detailu výpůjčky `mj.v.protPredani` / `mj.v.protVraceni` (`mj.v.maVraceni`) – 25. 10.; horní lišta: odkaz **Návody** (`navody.html`) před Odhlásit, na přihlášení odkaz na návody; **portál sboru → nová záložka Vybavení** (`sbVybaveniLive`, `vb.*`: formulář zápůjčky s nabídkou a dostupností, Vaše zápůjčky); Majetek → Rezervace sborů: Potvrdit / Zamítnout (`r.lzeRozhodnout`, `r.maInfo`); detail žádosti o akci už vybavení nepotvrzuje (`zd2.vybInfo`); **portál sboru → Soutěže přepracované na seznam a detail** (`ss2.seznam` / `ss2.detail`): filtry `ss2.typ/kat/dj/rok/nase`, sekce `ss2.sekce` (Nadcházející / Proběhlé, na PC tabulka `.ok-pc-blok`, na telefonu karty `.ok-mob-blok`), `ss2.maDalsi`; detail `ss2.d.*` se záložkami Informace / Naše družstva / Startovní pořadí / Výsledky (`ss2.d.zalozky`, přepínač kategorie `ss2.d.katChips`, Jen naše, prvních 10 řádků + `ss2.d.tlVse`); adresa `#sbor/<skupina>/souteze?typ=…` a `#sbor/<skupina>/soutez/<ID>` – 25. 10. |
| `sbory-mapa.html` | skript přesunut do `sbory-mapa.js` (kvůli CSP) |
| `index.html` (18. 10.) | nová stránka `isPrihlaska` (`ph.*`) – veřejná přihláška člena, styly `.ph-*`, Turnstile v CSP |
| `Aplikace OSH.dc.html` (18. 10.) | ostré obrazovky přihlášek členů: okres `okClenoveLive` (`po.*`), sbor `sbClenoveLive` (`ps.*`); ukázky `okClenove` / `sbClenove` jen mimo ostrý režim; záložka sboru „Přihlášky členů“ |
| `Aplikace OSH.dc.html` (18.–19. 10.) | přihlášky členů dál: karta sboru s datem narození, číslem, časem podání a kontaktem; **grafické fáze přihlášky** (`prKroky`, `aria-label="Fáze přihlášky"`) u karty sboru i v detailu okresu; Zaplaceno + QR platba před předáním okresu; odvod okresu (souhrn dluhu a QR na účet okresu u sboru, filtr Odvody a „Odvod přijat“ u okresu); panel Nastavení přihlášek sboru (příspěvky, výchozí sportovec MH) |
| obě stránky (18. 10.) | texty: „Stáhnout“ jen pro soubory; zpětvzetí podání sborem = „Zrušit“ (stav Zrušeno), stažení z webu = „Zrušit zveřejnění“ – viz CLAUDE.md, Texty v aplikaci |
| `prihlaska.js` (18. 10.) | nový sdílený skript webu i aplikace (kontrola rodného čísla, PDF přihlášky, QR platba) – neměnit v Claude Design, jen volat |
| `Aplikace OSH.dc.html` (19. 10. večer) | přihlášky: 7 fází (`prKroky`: Podáno, Platba sboru, Sken a fotka, Odvod okresu, Předáno okresu, Schváleno, Zapsáno; pole `bd` = obrys u nezaplaceného odvodu, třída `pr-krok` pro menší písmo na telefonu); karta sboru: Nahrát sken / fotku, Předat okresu, Odvod okresu (QR panel s tlačítkem `ps.qrAkce`); detail okresu: fotka člena (`po.fotka`) |
| `Aplikace OSH.dc.html` (19. 10.) | obrazovka Sbory → Kontakty sborů (`okKontakty`, `ks.*`): hledání, filtr funkce a okrsku, detail sboru, Kopírovat e-maily |
| obě stránky (21. 10.) | přihláška jako žádost: web – výběr kategorie `ph.kat` (třída `.ph-kat`), motivační dopis, fotka, stránka uchazeče přes osobní odkaz (`ph.odkazRezim`, QR, PDF, nahrání skenu, doplnění); aplikace – posouzení žádosti na kartě sboru (`r.pos.*`), kategorie a datum výboru v nové přihlášce (`ps.kat`, `ps.vybor`), sportovci dospělí v nastavení |
| obě stránky + plán (19. 10., L0) | `<script src="config.js">` v hlavičce (prostředí – needitovat, generuje `nasadit.sh`); `this.CFG` / `this.OSTRY`; web: hláška `vypadek` / `vypadekText` pod hlavičkou, odkazy na aplikaci `{{ aplikaceUrl }}`; aplikace: „Vyzkoušet ukázku“ v `<sc-if value="{{ lzeUkazka }}">`; `<meta name="robots" … data-prostredi="test">` a CSP spravuje `nasadit.sh` – ručně neměnit |
| obě stránky (21. 10., stanovy) | přihláška: zaškrtávátko trvalého pobytu při jiné příslušnosti než ČR (web `ph.maPobyt`, id `ph-trvalyPobyt`; sbor `ps.maPobyt`, id `pf-trvalyPobyt`); stav uchazeče „zapsáno“ s dnem vzniku členství; okres – detail přihlášky pole Den zápisu (`po.clenemOd`, `po.zapisInfo`, id `prh-clod`) a řádek Členem od |
| `Aplikace OSH.dc.html` (21. 10.) | přehled okresu (`okPrehledLive`): dva sloupce – **K vyřízení** jen s nenulovými položkami (`opl.ukoly`: `v`, `l`, `kde` = cesta v navigaci, `go`), `opl.nicNeceka`, řádek „Bez čekajících“ (`opl.vyrizeno`), a **Nejbližší akce a termíny** s tlačítkem Kalendář (`opl.kalendar`); `opl.stats` zrušeno. Portál sboru: záložka `prihlasky` se jmenuje **Soutěže** (nadpis „Soutěže – naše přihlášky“), ať se neplete s Přihláškami členů |
| `Aplikace OSH.dc.html` (21. 10., B8) | okres Akce → Soutěže živě: `okSoutezeLive` (`so.*` seznam a záložky Soutěže / Poháry a ligy, `sf.*` formulář soutěže, `sd2.*` detail – kroky, od 22. 10. blok Organizační zabezpečení ve formuláři (`sf.ozf`, `sf.harm`, `sf.ozKat`, `sf.onOz*`), akce podle stavu, odkazy rozhodčích s QR, průběžné výsledky, přihlášená družstva po kategoriích se šipkami a losem, `pf2.*` pohár – od 22. 10. i pole Družstev v poháru `pf2.druzstev`); ukázky `okSoutezeList` / `okSoutezDetail` jen v režimu ukázky. Portál sboru: záložka Soutěže živě `sbSoutezeLive` (`ss2.*`), záložka Výsledky v ostrém režimu není |
| `Aplikace OSH.dc.html` (22. 10., sborová soutěž) | formulář (`soSdilenyForm`) a detail soutěže (`soSdilenyDetail`) jsou ve **společném bloku `soSdileny`** za sekcí sboru – zobrazí ho správa okresu i pořádající sbor (`soTema`); kořeny okresu a sboru mají `min-height:{{ okMinH }}` / `{{ sbMinH }}` a odsazení `okObsahPad` / `sbObsahPad`. Ve formuláři sboru jsou termín a pohár skryté (`sf.lzeTermin`, `sf.lzePohar`). Portál: tlačítko Spravovat soutěž (`r.poradam`), host mimo okres v přidání družstva (`sd2.dr.jeHost`) |
| nové stránky (21. 10., B8) | závodní panel `zavod.html` + `zavod.js` (prostý JavaScript, ne Design Component – kvůli práci bez signálu; styly z `_ds`), `souteze.js` (výpočet pořadí – neměnit v Claude Design), `zavod-sw.js` (offline mezipaměť) |
| `Aplikace OSH.dc.html` (22. 10., uzlová štafeta) | druh „uzlová štafeta“ povolený (`sf.druhy`), kategorie podle druhu (`soKatNavrhy(pro, druh)`), volba druhu nastaví shodu „horší pokus“; popisek pole názvu `sd2.dr.popisek` / `ss2.f.popisek` (jednotlivci = „Závodník – jméno a příjmení“), návrh názvu `soNavrhNazev` (jednotlivci bez návrhu); formulář `sf.jeUzlovka`, `sf.stojanu`, `sf.stojanyF` (stojany a rozhodčí); detail `sd2.jeTest` + `sd2.testAkce` (testovací data), `sd2.maRozpis`, `sd2.rozpis` (bloky s `bunky`, mřížka `sd2.rozpisCols`, hlavička `sd2.stojanyHlava`) |
| `Aplikace OSH.dc.html` (23. 10., přestupy) | nové obrazovky: sbor `sbPrestupyLive` (`pss.*`, záložka Přestupy, formulář `pss.f`), okres `okPrestupyLive` (`pso.*`, položka Sbory → Přestupy); karta přestupu `r.*` (akce, sken); `notRace` vynechává i `prestupy` |
| `index.html` (23. 10., přestupy) | nová stránka `isPrestup` (`pr.*`, `?stranka=prestup`, osobní odkaz `&k=`), styly z přihlášky (`.ph-sekce`, `.ph-pole`) |
| `Aplikace OSH.dc.html` (23. 10., liga) | detail poháru: seznam kol `pf2.maKola` / `pf2.kola` (proklik na soutěž); záložka Poháry a ligy: testovací blok `so.jeTest`, `so.testLiga` |
| `docs/*.dc.html`, `docs/plan.html` | doplněná CSP v `<head>` |
| `Aplikace OSH.dc.html` (26. 10., B18 školení) | nové obrazovky: okres skupina **Školení** v `OK_SKUPINY` (položky `skoleni`, `kvalifikace`) – `okSkoleniLive` (`sko.*`: seznam `sko.rows`, formulář `sko.f` vč. odborností zkoušky `sko.f.kodyOpts`, detail `sko.d` s výsledky účastníků `sko.d.ucastnici`), `okKvalLive` (`kvo.*`, úprava řádku `r.ed`); sbor **Členové → Školení** (`sbSkoleniLive`, `sks.*`, výběr členů `r.p.*`, záložka Kvalifikace členů `sks.kval`) |
| `Aplikace OSH.dc.html` (26. 10., B18 test) | detail školení: blok **Test na školení** (`sko.d.maTest`, `sko.d.testInfo`, QR `sko.d.qr`, `sko.d.testSpustit` / `testUkoncit`); nová stránka `test.html` + `test.js` (prostý JavaScript jako závodní panel, ne Design Component) |
| `index.html` (26. 10., B18 test) | stránka Školení: blok **Procvičování** (`sk.testy`, cvičný test `sk.cv.*`) |
| `index.html` (26. 10., B18 školení) | nová stránka `isSkoleni` (`sk.*`, `?stranka=skoleni`); odkazy „Odbornosti a specializace“ (Mladí hasiči) a „Školení a odbornosti“ (Dokumenty) vedou na ni (`goSkoleni`) |
| `Aplikace OSH.dc.html` (26. 10., B17 členové) | nové obrazovky: sbor **Členové → Seznam** (`sbSeznamLive`, `cls.*`, formulář změny `cls.f` / `cls.maForm`), okres **Sbory → Seznam členů** (`okSeznamClLive`, `clo.*`, položka `clenovesez` v `OK_SKUPINY`); v přihlášce na soutěž blok **soupisky** `ss2.sp.*` (pozice, nabídka členů, ruční člen `ss2.sp.r` / `rOn`), u našich družstev `m.lzeUpravit` / `m.upravit` (Soupiska), `m.clenove`; blok **Přihlášky k tisku** `ss2.d.tisk` / `ss2.d.ved` / `vedOn` (údaje vedoucího jen v prohlížeči), obec v soupisce (`ss2.sp.r.obec`) a ve změně člena (`cls.f.obec`); okres u družstev `r.soupiska`, `r.maMimo`. Nový skript `soupiska.js` (načítá se za `prihlaska.js`). Pozor na názvy: `okClenoveLive` = Přihlášky členů, seznam je `okSeznamClLive`. |
| `index.html` (27. 10., přihláška na školení) | stránka Školení: u školení `x.lzePrihlasit` tlačítko Přihlásit se (`x.prihlasit`), pod seznamem blok `skf.*` (formulář `skf.f` / `skf.on`, `skf.sbory`, `skf.odbornosti`, `skf.hotovo`) |
| `Aplikace OSH.dc.html` (27. 10., víc stupňů kurzu) | formulář školení: kvalifikace vždy zaškrtávátka `sko.f.vyberKval` / `sko.f.kvalLegend` (dřív `jeZkouska`); výsledky `u.maObn` / `u.obn` (nová / obnova); portál sboru při přihlášení `c.maObn` / `c.obn`, ručně `x.maObn`, `x.kodLabel` |
| `docs/Plan zavedeni.dc.html` (27. 10.) | nové činnosti P8 (aplikace@ → spojka@), R8 (cvičné otázky od rad), F10 (Vzdělávání na webu), F11 (online kurzy), F12 (užší navigace webu), F13 (značka Spojka); kroky B18, F10, F13, nový krok B5.5 a F8.4 (jen na konec seznamů – odškrtnutí se neposunou); L1 závisí i na P8 |
| `Aplikace OSH.dc.html` (27. 10., Spojka) | hlavička: `nav.logo` = cesta k SVG (`spojka-okres.svg` / `spojka-sbory.svg`, třída `spojka-hl`, 28 / 22 px) místo čtverce OSH/SDH; `nav.podnadpis` bez „Spojka“; přihlášení: `<h1>` s `spojka-barevne-osh.svg`; v `<head>` favicon / manifest / theme-color s id `spojka-*` (přepíná `znacka()`), `assets/spojka/spojka-logo.js` |
| `index.html` (27. 10., Spojka) | patička: odkaz „Spojka – přihlášení pro sbory a okres“ se znakem `znak-barevny.svg` 20 px; favicon a logo webu zůstávají OSH |
| `index.html` (27. 10., navigace) | „Orgány OSH“ v navigaci přejmenováno na **O nás** (podpoložky Orgány OSH, orgány, Historie, AZH, **Kontakty**); samostatná položka Kontakty zrušena, odkaz Kontakty v patičce; stránka Kontakty má kicker O nás |
| `index.html` (27. 10., Vzdělávání) | nová položka navigace **Vzdělávání** (`navDef` key `vzdelavani`, podpoložky Přehled / Školení a odbornosti / Cvičné otázky) a rozcestník `isVzdelavani` (`vz.*`, dlaždice `grid3`, Online kurzy = Připravujeme); stránky `skoleni` a `procvicovani` patří do sekce Vzdělávání (zpět `goVzdelavani`), z Dokumentů odkazy pryč |
| `index.html` (27. 10., procvičování) | nová stránka **Procvičování otázek** `isProcvicovani` (`pv.*`: výběr sady `pv.skupiny`, režimy `pv.rezimy` – Učit se `pv.u.*`, Test nanečisto `pv.t.*`, Všechny otázky `pv.v.*`, okruhy `pv.okruhy`, postup `pv.zvladnuto` / `pv.procent`); na stránce Školení jen odkazy `sk.testy[].go`; odkazy `goProcvicovani` z Mladých hasičů a Dokumentů, mobilní nabídka |
| `index.html` (27. 10., víc stupňů kurzu) | přihláška na školení: `skf.kodLabel`, `skf.maObnovu` (Žádám o nová / obnova) |
| `Aplikace OSH.dc.html` (27. 10., školení z webu) | formulář školení `sko.f.web` / `sko.f.jeVerejne` (Přihlášky i z webu); účastník `u.lzeOdhlasit` / `u.odhlasit` (okres odhlásí) |
| `Aplikace OSH.dc.html` (27. 10., Nastavení) | okres **Správa → Nastavení** (`okNastaveni`, `mn.*`: `mn.poradatel`, `mn.poradatelOpts`, `mn.ulozit`) – osobní výchozí Vyhlašuje / Pořádá v kalendáři (`rel.uzivatel.nastaveni.poradatel`); kalendář `kf.orgOpts` nabízí i Kancelář OSH PZ |
| `Aplikace OSH.dc.html` (25. 10., F9 navigace) | hlavičky okresu a sboru nahradil **jeden blok Navigace** nad bloky Okres / Sbor (`maNav`, data `nav.*` z `navigace()`: `nav.tema`, `nav.plocha`, `nav.logo`, `nav.nazev`, `nav.titulekMob`, `nav.skupiny`, `nav.pod`, `nav.lista`, `nav.viceSk`, přepínač sborů na telefonu `nav.prepinac`); `okNav` a `sbTabs` už nejsou. Skupiny sboru `SB_SKUPINY` (Přehled; Akce: Kalendář, Soutěže, Žádosti; Členové: Přihlášky členů, Přestupy; Vybavení; Sbor: Můj sbor, Dokumenty), u skupin pole `ik` (ikona spodní lišty). Kořeny Okres / Sbor / Soutěž mají třídu `nav.skrytTrida` / `sbObsahTrida` (obsah pod nabídkou Více) – v atributu jen jedna díra. |
| obě stránky (27. 10., název) | aplikace se jmenuje **Spojka** (hasičská spojka – propojuje okres, sbory a veřejnost): `<title>Spojka – OSH Praha-západ</title>`, přihlášení nadpis „Spojka“, podnadpis navigace „Spojka OSH Praha-západ“; na webu odkazy „ve Spojce“. Soubor `Aplikace OSH.dc.html` (adresa) se nemění. |

Nesahat: `support.js` (runtime), `config.js` a `prostredi/` (prostředí, `nasadit.sh`), `prihlaska.js` (přihlášky – PDF, rodné číslo, QR), `souteze.js`, `zavod.js` a `zavod-sw.js` (soutěže – pořadí, závodní panel bez signálu), `data/*` (data webu, `data/web.json` zapisuje server), `apps-script/`, `skupiny-script/`.

## Úkol 1 – kontrast červené (WCAG AA) – hotovo 17. 10. (varianta A, viz `docs/revize-2026-10.md`)

Norma pro běžný text je 4,5 : 1, pro velký text (od 24 px, nebo 18,7 px tučně) 3 : 1. Spočítáno z tokenů v `_ds/…/styles.css`:

| Kombinace | Kontrast | Splňuje |
| --- | --- | --- |
| bílý text na `--color-accent` `#ec3013` | 4,20 : 1 | jen velký text |
| bílý text na `--color-accent-600` `#dd2b0f` | 4,74 : 1 | ano, těsně |
| bílý text na `--color-accent-700` `#ae1800` | 7,17 : 1 | ano |
| `#ec3013` jako text na pozadí `#f3f2f2` | 3,76 : 1 | jen velký text |
| `#ec3013` jako text na `--color-surface` `#eae9e9` | 3,47 : 1 | jen velký text |
| `docs/Plan zavedeni.dc.html` | úkol R6 (průběh kola Plamenu – rozhodnutí OORM), krok B8.12 (harmonogram Plamenu), texty B8 – 24. 10. |
| `--color-accent-700` jako text na pozadí | 6,41 : 1 | ano |

Kde to vadí (správa okresu a web):
- primární tlačítka `.btn-primary` – „Poslat kód“, „Přidat do kalendáře“, „+ Nový příspěvek“, „Zveřejnit“, „Uložit změny“;
- logo „OSH“ (bílé písmo v červeném čtverci) a štítek „Ukázka“ (červené písmo 11 px na šedé);
- odkazy a zvýrazněné malé písmo v barvě akcentu (např. „← Zpět na dokumenty“, chybové hlášky `--color-accent-700` už vyhovují).

Velké plochy – červený pruh správy okresu s nadpisem 30 px tučně – mohou zůstat `#ec3013` (velký text 3 : 1 splní).

Navrhni varianty, uživatel vybere:
- **A** – značka zůstane `#ec3013` na velkých plochách, tlačítka a malé písmo přejdou na `--color-accent-700`;
- **B** – celý akcent posunout na `--color-accent-600` (menší vizuální změna, kontrast jen těsně nad normou);
- případně vlastní, ale vždy s čísly kontrastu.

Zkontroluj i modrý motiv sborů (`data-theme="sbor"`, `oklch(46% 0.16 265)` a jeho odstíny), hlavně malé písmo a štítky.

## Úkol 2 – záhlaví tabulek (N8) – hotovo 17. 10.

`.table th` v `_ds/…/styles.css` má barvu `color-mix(… var(--color-text) 60% …)` = `#747372`, kontrast 4,23 : 1 při 11 px. Aplikace ho dnes přebarvuje na `--color-neutral-700` (`#605d5d`, 5,83 : 1); oprava patří přímo do design systému, aby platila i na webu a v dalších stránkách. Jedno záhlaví („Jméno“) má vlastní styl – sjednotit.

## Úkol 3 – logo (čeká na okres)

`assets/logo-osh-docasne.png` a `assets/logo-osh-docasne-144.png` jsou dočasné. Finální logo a případný návrh vzhledu dodá okres; až bude, navrhni jeho použití v hlavičce webu, aplikace a v ikoně aplikace (`assets/ucty/ikona-aplikace.png`). Do té doby jen počítej s tím, že se logo vymění (rozměry 48 px na webu, čtverec v hlavičce aplikace).

## Úkol 5 – logo aplikace Spojka – hotovo 27. 10. (návrh 2a, `assets/spojka/`; nasazení viz tabulka Změny v šablonách)

Návrh: slovo **Spojka**, písmeno „o“ = dvě půlky hadicové spojky se zuby (levá červená = okres, pravá modrá = sbory), pod tím „OSH Praha-západ“. Varianty: barevná, jednobarevná (tisk, razítko, výšivka), bílá na červeném pruhu (Správa okresu) a na modrém (Portál sboru), čtvercové ikony Okres / Sbory / Web, malé velikosti 32 / 16 px.

**Dodej:** SVG (barevné, jednobarevné, bílé), PNG ikony 512 / 192 / 180 / 32 / 16 px a čtverec pro e-maily (PNG 96 px). Barvy přes role (`--color-brand` plochy, červená `#ec3013` okres, modrá `oklch(46% 0.16 265)` sbory); v šabloně žádné barvy natvrdo mimo SVG loga. Soubory do `assets/logo/` (dnes dočasné `assets/logo-osh-docasne*.png`, `assets/ucty/ikona-aplikace.png`).

**Kde všude se nasadí** (název „Spojka“ už v textech je – mění se hlavně obraz a vysvětlení):

| Kde | Soubor / místo | Poznámka |
| --- | --- | --- |
| Web – odkaz do aplikace | `index.html`: patička „Přihlášení pro sbory a okres“, texty „ve Spojce (aplikace OSH)“ v kalendáři a soutěžích, Dokumenty → „Návody ke Spojce“ | Na webu chybí **co Spojka je** – navrhni krátký blok (např. v O nás nebo patičce): aplikace pro sbory a okres, přihlášení kódem na e-mail, odkaz na návody. |
| Aplikace – přihlášení | `Aplikace OSH.dc.html` ř. ~101 (nadpis Spojka), `<title>` | logo nad přihlášením |
| Aplikace – hlavička | blok Navigace (`nav.*`, `podnadpis` „Spojka OSH Praha-západ“ / „Portál sboru · Spojka…“) | bílá varianta na červeném (okres) a modrém (sbor) pruhu |
| Ikony | favicon a ikona na plochu – zatím žádné `<link rel="icon">` ve stránkách (`Aplikace OSH.dc.html`, `index.html`, `navody.html`, `zavod.html`, `test.html`) | závodní panel a test jdou na telefonu „na plochu“ |
| Návody | `navody.html` (titulek, „Otevřít Spojku“) | |
| E-maily | `apps-script/Posta.gs` `sablona_()` – záhlaví „OSH Praha-západ“, pata „Automatická zpráva ze Spojky…“ | jen PNG z `https://` adresy webu (`WEB_URL`), SVG pošta neukáže; žádné externí obrázky mimo vlastní doménu |
| PDF ze serveru (HTML → PDF) | `Majetek.gs` protokol, `Skoleni.gs` prezenční listina, `Prestupy.gs` přestupní lístek, `Souteze.gs` OZ a výsledková listina (hlavička z Nastavení `OZ_HLAVICKA`) | logo jako inline SVG nebo `data:` PNG (Apps Script nestahuje obrázky z webu); pata „Vytvořeno ve Spojce…“ |
| PDF v prohlížeči (pdf-lib) | `soupiska.js` (pata „Vytvořeno ve Spojce…“), `prihlaska.js` (přihláška člena – oficiální tiskopis SH ČMS) | do tiskopisu SH ČMS logo **nedávat**, jen do paty soupisky; pdf-lib umí PNG/JPG, ne SVG |
| Prezentace | `docs/prezentace/Prezentace.gs` | |

CSP: obrázky loga musí být z vlastní domény (soubory v repozitáři) nebo inline – žádné CDN.

: seznam s filtry a detail – hotovo 25. 10. (přímo v repozitáři, níže původní návrh; odchylky v tabulce Změny v šablonách)

Stejný vzor jako nový portál sboru → Soutěže (`ss2.*`, hotovo 25. 10.), aby okres i sbory pracovali se stejnou logikou. Dnes je to dlouhý seznam tlačítek (`so.rows`) a detail (`sd2.*`), kde jsou pod sebou všechny sekce: družstva, startovka, rozběhy, harmonogram, výsledky, pořadí, OZ a odkazy pro rozhodčí.

**Seznam (`#okres/souteze?typ=…&rok=…&stav=…`)**
- Filtry v jednom řádku (stejné prvky jako u sboru): Typ soutěže (vše / požární útok / Hra Plamen / ZHVB / uzlová štafeta / sborová), Kategorie, Družstva / jednotlivci, Rok (letos výchozí + ročníky Plamenu), navíc **Stav** (vše / koncept / přihlášky / uzavřeno / závod / ověřeno / zveřejněno) a **Pohár** (vše / konkrétní pohár nebo ročník Plamenu). Volba „Jen naše“ tu nahradí **„Čeká na mě“** (koncept bez kategorií, ověřeno ke zveřejnění, uzávěrka minula a přihlášky jsou otevřené).
- Nadcházející / Proběhlé s počtem, tabulka na PC, karta na telefonu, řádek klikací (min. 56 px), 20 + Další.
- Řádek: datum, název, štítky typu a kategorií, místo a pořadatel (sborová = název sboru), **jeden štítek stavu** s dalším krokem okresu: „Koncept – doplnit“, „Přihlášky do 5. 11. · 23 družstev“, „Uzavřeno – vylosovat startovku“, „Závod probíhá · 41/86 zápisů“, „Ověřit výsledky“, „Zveřejněno“.
- Nahoře zůstává blok „Schválené žádosti bez založené soutěže“ (jen když nějaké jsou) a tlačítka Nová soutěž / Načíst znovu. Poháry zůstávají jako druhá karta „Poháry, ligy a Plamen“ (stejný vzor seznam → detail).

**Detail (`#okres/souteze/<ID>/<záložka>`)**
- Hlavička: zpět, název, datum, místo, pořadatel, štítky, stav a **hlavní akce podle stavu** (Otevřít přihlášky / Uzavřít a vylosovat / Zahájit závod a poslat odkazy rozhodčím / Ověřit / Zveřejnit), vedle ní Upravit a menu „Další“ (zrušit, PDF OZ, testovací data v TESTu).
- Záložky (jen ty s obsahem): **Přehled** (stav, uzávěrka, počty po kategoriích, OZ a propozice, startovné, pohár a kolo), **Družstva** (všechna přihlášená s kontaktem, přidat / upravit / odhlásit, filtr kategorie), **Startovní pořadí** (los / ruční pořadí; u uzlovky rozběhy a stojany; u Plamenu **Harmonogram** jako vlastní záložka), **Závod** (odkazy a QR pro rozhodčí, průběžný stav zápisů po kategoriích), **Výsledky** (přepínač kategorie, jedna tabulka max. 720 px, prvních 10 + Zobrazit vše, ověření a zveřejnění, PDF).
- Výchozí záložka podle stavu: koncept → Přehled, přihlášky → Družstva, uzavřeno → Startovní pořadí, závod → Závod, ověřeno a zveřejněno → Výsledky.
- Sborová soutěž (pořadatel = sbor, `sbSoSel`) používá stejný detail – sbor vidí stejné záložky bez okresních akcí (pohár, termín).

**Server**: `soutezeOkres` zúžit na lehký seznam (bez družstev a výsledků; počty a stav zápisů jako čísla), detail `soutez` beze změny – už se načítá až při otevření.

## Výstup

- Návrh variant s ukázkou na obrazovkách: úvod webu, přihlášení, přehled správy okresu, detail dokumentu, portál sboru – na počítači i telefonu (pod 720 px).
- U zvolené varianty seznam změněných tokenů a tříd (`_ds/…/styles.css`, případně inline styly v šablonách).
- Do repozitáře změny převede Claude Code (stejně jako navigaci F6), aby se nepřepsaly novější úpravy. Drobné úpravy přímo v souborech jsou možné, jen nad aktuální `main` a se zachovanou strukturou šablon.
