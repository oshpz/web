# Zadání pro Claude Design – kontrast a vzhled (F7)

Stav 30. 10. 2026 (nový úkol 6 – jednotné seznamy). Projekt v Claude Design: „Redesign webu hasičů Praha západ“, repozitář `oshpz/web`, větev `main`.
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
| `Aplikace OSH.dc.html` (28. 10., F14 načítání) | nový skript `spojka-nacitani.js` a prvky `<spojka-nacitani>` / `<spojka-kostra>` v šabloně: celá obrazovka `celaNacita` (pod lištou zpráv), detaily (`sko.d.nacita`, `vvo.d.nacita`, `ms.nacitam`, `ss2.d.nacitam`, `sd2.loading`), seznamy – před každým `x.prazdno` blok `x.kostra` (počítá `kostry()` na konci `renderVals`), náhledy `po.nahledNacita`, `po.fotkaNacita`, `mj.d.fotoNacita`, záznam změn `zz.kostra`; žádné texty „Načítám…“. Lišta zpráv bez „Načítám data…“ (`net.nacita`) a bez hlášky offline (proužek kreslí skript). Tlačítka bez spojení: `offlineTl` v `tlx` |
| `Aplikace OSH.dc.html` (30. 10., úkol 6 – 2. vlna) | Žádosti (`zo.sz`, `zs.sz` + rozbalení), Příspěvky (`pr.sz`), Změny sborů (`zm.sz`), Přihlášky členů (`po.sz`, `ps.sz` – karta v rozbalení, `r._x`), Přestupy (`pso.sz`, `pss.sz`, `prsRadek()`, `r._x`); hlavičky `.sz-hlava`; staré `x.rows` / `x.chips` zůstávají jako zdroj dat |
| `Aplikace OSH.dc.html` (30. 10., úkol 6 – 1. vlna) | třídy `.sz-*` v `<helmet>` (viz úkol 6 a `docs/claude-design/seznamy-vzor.md`); metody `radek()` a `kotvaData()`; obrazovky Kalendář okresu (`kz.*`), Dokumenty okresu (`dz.*` – tabulka zrušena), Kalendář sboru (`kp.*`, rozbalení `r.otevreny`), Dokumenty sboru (`dp.*`); společné `szZalozky`, `szFiltry` (stav `szFiltry`), `szMesice`, `szHledat`; `pt.znovu`; `zKal` vrací i `typ` |
| `Aplikace OSH.dc.html` (29. 10., B19 hlas za člena) | detail jednání: blok `vvo.d.lzeZa` / `vvo.d.za.*` (člen, způsob, volby u bodů `vvo.d.za.body`, „u všech bodů“ `vvo.d.za.vse`, `vvo.d.za.zapsat`); u bodu v `b.stavHlasu` i kdo hlas zapsal |
| `Aplikace OSH.dc.html` (28. 10., B19 kvórum) | formulář jednání bez pole kvóra (`vvo.f.pravidlo`), detail `vvo.d.pravidlo`, `vvo.d.neusnasenischopne`, u bodu `b.pocty`; zasedání pole Přítomno (`vvo.d.pritomno`, `vvo.d.vysPravidlo`) |
| `Aplikace OSH.dc.html` (28. 10., B19 hlasování VV) | nová skupina **VV** v `OK_SKUPINY` (položka `vv`, ikona `vote`, `smiVV` – kdo má jen VV, vidí Přehled a VV: `jenVV`); obrazovka `okVVLive` (`vvo.*`: záložky `vvo.taby`, seznam `vvo.rows`, formulář `vvo.f` s body `vvo.f.body` (↑↓, smazat), detail `vvo.d` – podklady, body s tlačítky `b.volby` (56 px), „… všem“ `vvo.d.vse`, ruční výsledek zasedání `b.lzeVysledek`, tabulka `vvo.d.tabulka`, připomínky); Přehled okresu karta Čeká na váš hlas (`opl.maVV`, `opl.vv`); adresa `#okres/vv/<id>` |
| `index.html` (26. 10., B18 test) | stránka Školení: blok **Procvičování** (`sk.testy`, cvičný test `sk.cv.*`) |
| `index.html` (26. 10., B18 školení) | nová stránka `isSkoleni` (`sk.*`, `?stranka=skoleni`); odkazy „Odbornosti a specializace“ (Mladí hasiči) a „Školení a odbornosti“ (Dokumenty) vedou na ni (`goSkoleni`) |
| `Aplikace OSH.dc.html` (26. 10., B17 členové) | nové obrazovky: sbor **Členové → Seznam** (`sbSeznamLive`, `cls.*`, formulář změny `cls.f` / `cls.maForm`), okres **Sbory → Seznam členů** (`okSeznamClLive`, `clo.*`, položka `clenovesez` v `OK_SKUPINY`); v přihlášce na soutěž blok **soupisky** `ss2.sp.*` (pozice, nabídka členů, ruční člen `ss2.sp.r` / `rOn`), u našich družstev `m.lzeUpravit` / `m.upravit` (Soupiska), `m.clenove`; blok **Přihlášky k tisku** `ss2.d.tisk` / `ss2.d.ved` / `vedOn` (údaje vedoucího jen v prohlížeči), obec v soupisce (`ss2.sp.r.obec`) a ve změně člena (`cls.f.obec`); okres u družstev `r.soupiska`, `r.maMimo`. Nový skript `soupiska.js` (načítá se za `prihlaska.js`). Pozor na názvy: `okClenoveLive` = Přihlášky členů, seznam je `okSeznamClLive`. |
| `index.html` (27. 10., přihláška na školení) | stránka Školení: u školení `x.lzePrihlasit` tlačítko Přihlásit se (`x.prihlasit`), pod seznamem blok `skf.*` (formulář `skf.f` / `skf.on`, `skf.sbory`, `skf.odbornosti`, `skf.hotovo`) |
| `Aplikace OSH.dc.html` (27. 10., víc stupňů kurzu) | formulář školení: kvalifikace vždy zaškrtávátka `sko.f.vyberKval` / `sko.f.kvalLegend` (dřív `jeZkouska`); výsledky `u.maObn` / `u.obn` (nová / obnova); portál sboru při přihlášení `c.maObn` / `c.obn`, ručně `x.maObn`, `x.kodLabel` |
| `Aplikace OSH.dc.html` (27. 10., tmavý režim a přepínač) | `<meta name="color-scheme" content="only light">` (prohlížeč aplikaci neztmaví); logo na přihlášení vložené jako `<svg>` s `currentColor` místo `<img>`; přepínač okres / sbory na telefonu v hlavičce okresu i sboru (`nav.maPrepinac`, `prepinacMob`, „Správa okresu“), tlačítka v tmavé liště jen na počítači |
| `index.html` (27. 10., partneři) | dlaždice Partneři a Užitečné odkazy nahradil kompaktní pás `section.pas` (třídy `.pas-r`, `.pas-l` v `<helmet>`): popisek vlevo, jména v řádku, popis odkazu v `title`; z patičky pryč duplicitní Facebook, SH ČMS, KSH |
| `index.html` (27. 10., úvod a O nás) | úvod: hlavní tlačítko „Spojka – přihlášení pro sbory“ (znak, `aplikaceUrl`) + Najít sbor; dlaždice Soutěže / Vzdělávání / Dokumenty a formuláře (Orgány, Sbory a Mladí hasiči jsou v navigaci); O nás: kicker OSH Praha – západ, blok Kontakty (`kontakty` + sídlo, odkaz na stránku Kontakty) |
| `Aplikace OSH.dc.html` (28. 10., nabídka uživatele) | černé pruhy `isLive` / `isDemo` (`liveChips`, `uzivatelText`, `roleChips` v šabloně) zrušeny; v hlavičce `nav` za zvonkem blok `data-ucet` s tlačítkem (`um.btnText`, `um.toggle`, `aria-expanded` = `um.aria`) a panelem `.um-panel` (`um.jmeno`, `um.email`, `um.popis`, `um.prepnout` [label, barva, aktivni], `um.maNastaveni`, Návody, `um.maReset`, `um.odhlasit`), na telefonu `.um-zastin`; stejný blok v hlavičce ukázky veřejnosti; ve Více nahoře řádek `um.otevrit`; místo pro Vzhled (tmavý režim – F8); `nav.podnadpis` = jen role; přepínač v hlavičce (`nav.maPrepinac`) zrušen; stav `ucet`, zavírání Esc / klepnutím mimo (`componentDidMount`) |
| `Aplikace OSH.dc.html` (28. 10., navigace sboru) | `SB_SKUPINY` v pořadí Přehled, Akce, Členové, Sbor, Vybavení; spodní lišta sboru `vListe: ['prehled', 'akce', 'clenove', 'sbor']` – Vybavení pod Více |
| `docs/Plan zavedeni.dc.html` (28. 10., B19) | nové činnosti B19 (Jednání VV – hlasování, podklady, historie) a B19b (Příprava zápisů VV, backlog, závisí na B19) |
| `docs/Plan zavedeni.dc.html` (28. 10.) | F12 přejmenováno na Navigace a úvod webu + 4 kroky; G3 kroky (návody, Spojka na ploše, scénáře, po pilotu); F9.4 přepínač na telefonu; F13.9–10 tmavý režim a logo v e-mailech |
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

## Úkol 6 – jednotné seznamy ve Spojce (řádek záznamu) – zadáno 30. 10., varianta 6b schválena 30. 10. (`docs/claude-design/seznamy-vzor.md`), **1. vlna hotovo 30. 10.**, **2. vlna hotovo 30. 10.**

**Kontrola 2. vlny** (`docs/claude-design/seznamy-kontrola-2.md`, 31. 10.): odchylky schváleny, body 1–4 opraveny 31. 10. – záložky a hledání v jedné řadě `.sz-ovladani` (samotné hledání vpravo 280 px, při zalomení pod záložkami vlevo; s výběry dál na vlastním řádku), u sboru (Přihlášky, Přestupy) nad seznamem jen hlavička a záložky, odkaz a nastavení pod seznamem, popis zkrácený s odkazem „Jak to funguje“ do Návodů; v řádku jméno místo e-mailu (server `jmenoLidi_()` – `PodalJmeno` u změn sborů, `Vytvořil – jméno` u dokumentů; bez jména se e-mail neukáže), záložky s počtem 0 až za nenulovými (kromě první a vybrané), na telefonu konec řady záložek odsazený. Snímky 1. i 2. vlny přefocené 31. 10.

**2. vlna hotovo 30. 10.** – Žádosti (okres `zo.sz`, sbor `zs.sz`), Příspěvky (`pr.sz`), Změny sborů (`zm.sz`), Přihlášky členů (okres `po.sz`, sbor `ps.sz`), Přestupy (okres `pso.sz`, sbor `pss.sz`). Snímky: `docs/claude-design/seznamy/okres-zadosti.jpg`, `okres-prispevky.jpg`, `okres-zmenysb.jpg`, `okres-clenove.jpg`, `okres-prestupy.jpg`, `sbor-zadosti.jpg`, `sbor-clenove.jpg`, `sbor-prestupy.jpg` a `mob-…`. Odchylky a doplňky 2. vlny (k posouzení):
- **Rozbalení řádku místo detailu** (jako Kalendář sboru): Žádosti sboru (podrobnosti, poznámka okresu, vybavení, přílohy, Upravit / Zrušit žádost), Přihlášky členů sboru (celá dosavadní karta – fáze, posouzení výborem, platba, sken, fotka, předání), Přestupy okresu i sboru (údaje, souhlasy, akce). Jen jeden otevřený řádek (stav `szOtevreny`). Okres Žádosti, Příspěvky, Změny sborů a Přihlášky dál otevírají svůj detail.
- **Stav = krok** (při `ceka`): Ke schválení (žádosti, změny, příspěvky role zveřejnit), Upravit a poslat (vrácený vlastní příspěvek), Zkontrolovat sken / Zapsat do evidence (přihlášky okres), Posoudit žádost / Předat okresu / Opravit a předat (přihlášky sbor), Doplnit žádost (vrácená žádost sboru), Dát souhlas (přestup sbor), Zapsat do evidence / Rozhodnout (přestup okres). Texty krátké, aby se vešly do sloupce 150 px.
- **Záložky:** Příspěvky – u role zveřejnit je první Ke schválení, jinak Koncepty; Žádosti sboru Podané (i vrácené) / Vyřízené / Vše; Přestupy sboru Čeká na nás / Všechny (dřív bez záložek). Přihlášky okresu – záložka **Odvody** zůstává tabulkou po sborech (4. vlna).
- **Filtry jen s hledáním** (žádné výběry) – třída `.sz-filtry--bez`, na telefonu bez tlačítka Filtry.
- **Souběh u žádostí okresu** jako štítek typu („Souběh 2, okrsek 1“), ne stav.
- **Pomocníci:** `szSeznam()` (záložky, řádky, prázdný stav, „Zrušit hledání“), `szOtevreny` / `szPrepnout` (rozbalení), `szDen()`.


**1. vlna hotovo 30. 10.** – Kalendář okresu, Kalendář sboru, Dokumenty okresu (z tabulky na řádky), Dokumenty sboru. Snímky po převodu: `docs/claude-design/seznamy/okres-kalendar.jpg`, `okres-dokumenty.jpg`, `sbor-kalendar.jpg`, `sbor-dokumenty.jpg` a `mob-…` (393 px). Řádek na počítači 64 px (5 sloupců), na telefonu min. 72 px (3 sloupce: kotva, obsah se štítky pod popisem, šipka – se štítky a dvouřádkovým popisem 75–100 px). Další vlny: 2) Žádosti, Příspěvky, Změny sborů, Přihlášky členů, Přestupy; 3) Soutěže, Školení, Jednání VV, Rezervace; 4) tabulky.

**Kontrola 1. vlny** (`docs/claude-design/seznamy-kontrola-1.md`, 30. 10.): odchylky schváleny, body 1–6 opraveny 30. 10. – mezititulek skupiny 18 px / 800 (vlastní třídy `.sz-skupina-nazev` / `-pocet` – runtime obaluje text do `<span class="sc-interp">`, proto žádná pravidla „… span“), kotva na telefonu den a čas pod sebou (`r.kotva2m`), titulek dokumentu bez zkratky, data a přípony (`velke(parseDok().nazev)`, celý soubor v `title`), typ v kalendáři stejný u okresu i sboru (`typKalendare()`; filtr sboru jako u okresu), Dokumenty sboru – popis typ · přípona (portál posílá Název souboru), „Nový“ jako stav, `.sz-titulek` nejvýš 2 řádky (varianta 7b, zapsáno i v `seznamy-vzor.md`).

Odchylky a doplňky 1. vlny (k posouzení v Claude Design):
- **Kalendář okresu:** záložky Nadcházející / Proběhlé (specifikace je u okresu neuvádí – stejné jako u sboru), druh (Akce okresu / Termíny / Soutěže a akce sborů) jako výběr. Štítek typu z nového pole `typ` (sloupec Typ listu Akce): Akce okresu, Akce sboru (pořadatel SDH), Soutěž, Školení, Termín.
- **Kalendář sboru:** kliknutí řádek **rozbalí** (`.sz-radek--vybrany` + nová třída `.sz-rozbal`: popis, odkaz na propozice, u soutěže „Otevřít v Soutěžích“) – sbor nemá detail akce. Uzávěrka do 14 dní = `ceka`, stav „Splnit do 30. 11.“.
- **Dokumenty sboru:** nemají stavy – záložky **Nové** (zveřejněné za 30 dní, výchozí, když nějaké jsou) / **Všechny**. Kliknutí otevře soubor v nové kartě.
- **Hledání** na všech čtyřech obrazovkách (název, orgán, místo, pořadatel).
- **Pomocné třídy navíc:** `.sz-hlava-text`, `.sz-hlava-akce`, `.sz-znovu` + `.sz-znovu-t` (na telefonu jen ↻ 44 px), `.sz-akce-hl` (na telefonu přes celou šířku pod nadpisem), `.sz-filtr` (max 240 px), `.sz-filtry-tl` + `.sz-filtry--otevrene` (telefon), `.sz-hlavni`, `.sz-stitky--pc` / `--mob` (stav se na telefonu přesune do štítků), `.sz-rozbal`.
- **Pozadí výběrů a hledání** `--color-neutral-100` (téměř bílá – bílý token v systému není).
- **Kostra** (`spojka-nacitani.js`): stejná mřížka a výška jako řádek (88 px kotva, titulek + popis, 150 px stav; telefon 72 px bez stavu), horní čára `--color-divider`.


**Cíl:** všechny seznamy ve Spojce (správa okresu i portál sboru) mají jeden společný vzor. Řádky mají stejnou výšku, stejnou mřížku, stejné písmo titulku a popisu, stejné štítky a stejné chování. Typy záznamů se smí lišit **jen v určených místech** (co je v levém sloupci, jaké údaje jsou v popisu, které štítky). Výsledek má být přehledný na počítači i na telefonu a dát se použít i pro budoucí obrazovky bez nového návrhu.

**Podklady – současný stav (smyšlená data ze zkušebního serveru, 30. 10.):** `docs/claude-design/seznamy/`
- okres na počítači: `okres-kalendar.jpg`, `okres-dokumenty.jpg`, `okres-zadosti.jpg`, `okres-prispevky.jpg`, `okres-zmenysb.jpg`, `okres-kontakty.jpg`, `okres-clenove.jpg` (přihlášky členů), `okres-prestupy.jpg`, `okres-clenovesez.jpg` (seznam členů), `okres-souteze.jpg`, `okres-skoleni.jpg`, `okres-kvalifikace.jpg`, `okres-majetek.jpg`, `okres-vv.jpg`, `okres-zaznam.jpg`
- sbor na počítači: `sbor-prehled.jpg`, `sbor-kalendar.jpg`, `sbor-dokumenty.jpg`, `sbor-zadosti.jpg`, `sbor-vybaveni.jpg`, `sbor-seznam.jpg`, `sbor-clenove.jpg`, `sbor-prestupy.jpg`, `sbor-prihlasky.jpg` (soutěže), `sbor-skoleni.jpg`
- telefon (393 px): `mob-okres-kalendar.jpg`, `mob-okres-dokumenty.jpg`, `mob-okres-zadosti.jpg`, `mob-sbor-kalendar.jpg`, `mob-sbor-dokumenty.jpg`, `mob-sbor-prihlasky.jpg`

### Co je dnes nejednotné (ze snímků)
- **Tři různé formy seznamu:** řádky s datem vlevo (Kalendář, Žádosti, Příspěvky), tabulka se záhlavím (Dokumenty okresu, Přihlášky členů, Soutěže sboru) a karty s popisem pod titulkem (Školení, Jednání VV). Volba nemá pravidlo – Dokumenty jsou u okresu tabulka a u sboru řádky s podtrženým odkazem.
- **Levý sloupec s datem** má na každé obrazovce jinou šířku (cca 120–200 px), jiný formát („so 14. 11. 2026“, „so 21. 11.“, „28. 11. 2026 09:00–16:00“ v textu) a jinou váhu písma (tučné / šedé).
- **Titulek:** někde obyčejné písmo s popisem na stejném řádku za tečkou (Kalendář), jinde tučný titulek a popis pod ním (Žádosti, Příspěvky), jinde odkaz s podtržením (Dokumenty sboru), u Školení štítek před titulkem.
- **Výška řádků** 48–90 px podle obrazovky; u Soutěží sboru štítky kategorií zalamují řádek do tří výšek.
- **Štítky** ve čtyřech podobách – vyplněný světlý (Akce okresu, Ke kontrole u okresu), obrys barvou role (Termín, Ke schválení, Souběh 1), šedý (Koncept, Uzávěrka), modrý tint (Pro sbory, MH) – bez pravidla, který znamená stav, typ nebo „pro koho“. Pořadí štítků se liší (stav vlevo i vpravo).
- **Filtry:** záložky stavu ve třech velikostech (40 / 44 / 48 px), počty „(1)“ jen někde (Kalendář je nemá); Soutěže a Školení mají místo záložek řadu výběrů, Dokumenty dvě řady tlačítek pod sebou.
- **Tlačítka v záhlaví:** „Načíst znovu“ je u každé obrazovky jinak velké, hlavní akce jednou malá („Přidat do kalendáře“), jindy velká s „+“ („+ Nový příspěvek“).
- **Telefon:** Kalendář okresu se na 393 px nerozloží – tři sloupce vedle sebe, titulek po jednom slově na řádek (`mob-okres-kalendar.jpg`). Tabulky (Dokumenty, Přihlášky) se jen posouvají do strany.
- **Chyba v datech řádku:** u termínu bez místa je v popisu „· ·“ (prázdné části se nevynechávají).
- **Prázdný stav** je jednou věta pod čarou, jindy „Nic.“, jindy dlouhý text s návodem.

### Návrh vzoru (výchozí – dotáhni a navrhni varianty)
**Obrazovka seznamu** (shora): nadpis H1 + popis (max 2 řádky, max 72 znaků na řádek) a vpravo akce (nejvýš jedna hlavní, ostatní sekundární stejné výšky; „Načíst znovu“ jako nenápadná ikonová / textová akce) → **záložky stavu** (jedna velikost, vždy s počtem „Ke schválení 3“, první = co čeká na mě) → **další filtry** v jednom řádku (výběry stejné výšky, hledání vpravo; na telefonu sbalit pod „Filtry (2)“) → **seznam** → prázdný stav.

**Řádek záznamu** (jedna mřížka pro všechny typy):
| Část | Obsah | Pravidlo |
| --- | --- | --- |
| levý sloupec (pevná šířka, např. 96 px) | „kotva“ typu – datum (den v týdnu + „14. 11.“, rok jen mimo letošek, čas pod tím), u lidí iniciály / foto, u dokumentu zkratka orgánu | vždy stejná šířka a zarovnání na celé obrazovce |
| titulek | název záznamu | 16 px, tučně, 1 řádek se zkrácením „…“ (celý v detailu) |
| popis | 2–4 údaje oddělené „ · “ (kdo, kde, kolik) | 14 px, šedá, max 1 řádek na počítači / 2 na telefonu; prázdné údaje se vynechají |
| štítky | nejvýš 2–3 | pevné pořadí: **stav** → **typ** → **pro koho**; každý druh jeden styl (viz níže) |
| pravý okraj | „Čeká na vás“ / počet nebo šipka → | celý řádek je jedno klikací místo (detail), šipka jen jako znamení |

- **Výška:** stejná minimální výška pro všechny řádky (např. 64 px = titulek + popis); jednořádkové typy se doplní na stejnou výšku, ne zúží.
- **Druhy štítků (3, ne víc):** *stav* (vyplněný; „čeká na mě / na okres“ barvou role akce, hotové neutrálně, zamítnuté / zrušené přeškrtnutě nebo šedě), *typ* (obrys neutrální), *pro koho* (tint barvy role: Pro sbory, MH, Okrsek 5). Kategorie soutěží a podobné výčty nepatří do štítků řádku – do popisu („mladší, starší, dorost“) nebo do detailu.
- **Seskupení:** volitelný mezititulek skupiny (měsíc u kalendáře, Nadcházející / Proběhlé u soutěží a školení) – jeden styl.
- **Tabulka** jen tam, kde se porovnávají hodnoty ve sloupcích (Seznam členů, Kvalifikace, Kontakty sborů, Záznam změn, Majetek). Stejná výška řádku jako u řádku záznamu, záhlaví podle úkolu 2. **Na telefonu se tabulka mění na řádky záznamu** (první sloupec = titulek, ostatní do popisu), ne vodorovné posouvání.
- **Telefon (pod 720 px):** levý sloupec zůstane úzký (datum na dva řádky „so / 14. 11.“), titulek a popis vedle, štítky pod popisem; nikdy víc než dva sloupce.
- **Stavy řádku:** najetí myší, zaměření klávesnicí (viditelný rámeček), vybraný / otevřený, „čeká na vás“ (zvýraznění levé hrany barvou role), zrušené / historické (tlumené). Načítání = `<spojka-kostra>` se stejnou výškou řádku (F14 – sjednotit kostru s novou výškou).
- **Do budoucna** (jen navrhnout místo, nedělat): hromadný výběr (zaškrtávátko vlevo od kotvy), řazení podle sloupce u tabulek, „Načíst další“ nad 50 řádků, akce přímo v řádku (max jedna, např. Schválit) – ne víc tlačítek v řádku.

### Typy záznamů – co se smí lišit
| Typ (obrazovka) | Kotva vlevo | Titulek | Popis | Štítky (stav · typ · pro koho) |
| --- | --- | --- | --- | --- |
| Akce / termín (Kalendář okres i sbor) | datum + čas | název | pořadatel · místo | – · Akce okresu / Termín / Soutěž · Pro sbory / MH / Okrsek |
| Soutěž (okres, sbor) | datum | název | místo · pořadatel · kategorie | stav soutěže / pro náš sbor (Přihlášeno 2, Výsledky 3. místo) · druh | – |
| Školení | datum | název | místo · kvalifikace · přihlášeno 11 / 20 | stav · druh | – |
| Dokument (okres i sbor) | zkratka orgánu + datum | název dokumentu | soubor z Disku · typ | stav (jen okres) · – · pro koho |
| Příspěvek | datum | titulek | autor · štítky obsahu | stav | – |
| Žádost sboru (okres, sbor) | datum akce | název akce | sbor · typ · místo · vybavení | stav · souběh | – |
| Změna sboru | datum podání | sbor | co se mění (počet) | stav | – |
| Přihláška člena (okres, sbor) | datum podání | jméno uchazeče | sbor · kategorie · platba | fáze (7 kroků jako malý ukazatel?) | – |
| Přestup | datum | jméno | z sboru → do sboru | stav | – |
| Jednání VV | termín | název | per rollam / zasedání · hlasovalo 2 z 4 · navrhuje | stav · „Čeká na váš hlas“ vpravo | – |
| Rezervace / výpůjčka | od–do | věc | sbor · účel | stav | – |
| Člen, kvalifikace, kontakt, záznam změn | – (tabulka) | | | |

### Technika (pro převod do šablon – udělá Claude Code)
- Vzor jako **společné třídy v `<helmet>`** obou motivů (okres i sbor), např. `.sz-radek`, `.sz-kotva`, `.sz-titulek`, `.sz-popis`, `.sz-stitky`, `.sz-stitek--stav|typ|pro`, `.sz-skupina`, `.sz-filtry`, `.sz-zalozky`; barvy jen přes role (`--color-brand`, `--color-action`), žádné `var(--color-accent)` v šabloně.
- V `renderVals` každý seznam vrací řádky ve **stejném tvaru** `{ kotva, kotva2, titulek, popis, stitky: [{ t, druh }], ceka, go, id }` (pomocná metoda `radek()`), aby šablona měla pro všechny seznamy téměř stejný blok. Prázdné části popisu vynechá `radek()` (oprava „· ·“).
- Zachovat formát `.dc.html` (díry jen tečkové cesty, `<sc-for>`, `<sc-if>`) a kostry `x.kostra` (F14).

### Postup a výstup
1. **Návrh vzoru** na dvou obrazovkách – **Kalendář** a **Dokumenty**, okres i sbor, počítač i telefon (393 px). Ke schválení správcem (Michal Kalian).
2. Po schválení: specifikace tříd a tvaru řádku (výška, mezery, písmo, štítky) a pořadí převodu ostatních obrazovek podle tabulky typů.
3. Do repozitáře převede Claude Code obrazovku po obrazovce (začne Kalendářem a Dokumenty), po každé snímky do `docs/claude-design/seznamy/` pro kontrolu.

## Výstup

- Návrh variant s ukázkou na obrazovkách: úvod webu, přihlášení, přehled správy okresu, detail dokumentu, portál sboru – na počítači i telefonu (pod 720 px).
- U zvolené varianty seznam změněných tokenů a tříd (`_ds/…/styles.css`, případně inline styly v šablonách).
- Do repozitáře změny převede Claude Code (stejně jako navigaci F6), aby se nepřepsaly novější úpravy. Drobné úpravy přímo v souborech jsou možné, jen nad aktuální `main` a se zachovanou strukturou šablon.
