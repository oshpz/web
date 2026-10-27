/**
 * OSH data – testy ke školení (B18, docs/skoleni.md). Nový soubor „Testy“ ve stejném projektu.
 *
 * Ostrý test píše kandidát na školení na svém telefonu: okres v detailu školení klikne Spustit test → odkaz a QR test.html#k=<kód>
 *   (kód jen jako otisk v listu Školení, platí do konce dne školení). Kandidát vybere sebe ze seznamu účastníků, ověří se datem narození
 *   a dostane náhodný výběr otázek ze sady „zkouška“ (list Otázky testů, test = kód kvalifikace). Server opraví; nesplní-li, zkouší znovu
 *   (nový výběr, přednostně jiné otázky) – pokusů tolik, kolik je potřeba, dokud test platí. Správné odpovědi ostré sady nikdy neopustí server.
 * Nastavení testu je u druhu kvalifikace (list Druhy kvalifikací: Test – otázek, Test – max. chyb, Test – minut). Výsledné rozhodnutí o školení
 *   dál dělá okres (Vyhodnotit) – splněný test jen předvyplní „absolvoval“.
 * Cvičná sada („cvičná“) jde veřejně na web (?co=web → testy) i se správnými odpověďmi – musí být jiné otázky než zkouška.
 * Ostrá sada není v repozitáři (je veřejný): návrh v apps-script/OtazkyZkouska.gs (.gitignore) vloží menu OSH data → Školení: vložit návrh otázek.
 * Veřejné otázky (Druhy kvalifikací → Test – veřejné otázky = ANO, rozhodne odborná rada): sada k učení = zkouška + cvičná, celá jde na web
 *   se správnými odpověďmi (jen živě ?co=web – do data/web.json v repozitáři ne) a test na školení losuje z ní; kandidát po testu vidí u chyb i správnou odpověď.
 */

const LIST_OTAZKY = 'Otázky testů', LIST_POKUSY = 'Pokusy testů';
const TS_PISMENA = ['A', 'B', 'C', 'D'];
const TS_MAX_POKUSU = 20; // ochrana proti zkoušení odpovědí – pokusů na osobu za 6 hodin (víc mezipaměť neudrží)

// Cvičná sada (veřejná, na webu). [test, okruh, otázka, SPRÁVNÁ, špatná, špatná, špatná, zdroj] – SHP = Směrnice hry Plamen 2022, OZ ZHVB = rámcové OZ ZHVB 2026/2027.
const TS_CVICNE = [
  ['VM3', 'Hra Plamen', 'Pro koho tvoří hra Plamen roční náplň činnosti?', 'pro mladé hasiče do 15 let', 'jen pro sportovní oddíly dorostu', 'pro všechny členy SDH', 'jen pro děti do 11 let', 'SHP kap. 1'],
  ['VM3', 'Hra Plamen', 'Na jaká dvě odvětví se dělí činnost úseku mládeže SH ČMS?', 'výchovně vzdělávací a sportovní', 'okresní a krajské', 'letní a zimní', 'členské a nečlenské', 'SHP kap. 1'],
  ['VM3', 'Hra Plamen', 'Co je pilířem pravidelné celoroční činnosti kolektivu mladých hasičů?', 'pravidelné schůzky', 'soutěže v požárním útoku', 'letní tábory', 'zkoušky odborností', 'SHP kap. 2.3'],
  ['VM3', 'Hra Plamen', 'Jak dlouho trvají vícedenní akce kolektivu (víkendovky, příměstské tábory) podle směrnice?', '2–6 dnů', '1 den', '7–14 dnů', 'nejméně 10 dnů', 'SHP kap. 2.3'],
  ['VM3', 'Hra Plamen', 'Jak se jmenuje IV. okruh celoroční činnosti?', 'dobrovolnictví', 'odznaky odbornosti', 'výcvik a prevence', 'vzdělávání a kultura', 'SHP kap. 2.3.2'],
  ['VM3', 'Hra Plamen', 'Jak se jmenuje VI. okruh celoroční činnosti?', 'výcvik a prevence', 'dobrovolnictví', 'celoroční volnočasové aktivity', 'aktivity pro veřejnost', 'SHP kap. 2.3.2'],
  ['VM3', 'Hra Plamen', 'Co musí obsahovat zápis o akci v kronice kolektivu?', 'stačí záznam s datem konání (počet hodin se neuvádí)', 'přesný počet hodin a podpisy všech účastníků', 'fotografie každého účastníka', 'potvrzení od OSH', 'SHP kap. 2.3.3'],
  ['VM3', 'Hra Plamen', 'Jak se hodnotí plnění celoroční činnosti kolektivu?', 'jen zda kolektiv splnil, či nesplnil', 'body za každou splněnou podmínku', 'pořadím kolektivů v okrese', 'známkou jako ve škole', 'SHP kap. 2.3.3'],
  ['VM3', 'Sportovní část', 'K jakému datu se aktualizuje registrační list sportovního oddílu SDH?', 'k 30. 1. příslušného roku', 'k 1. 9. příslušného roku', 'k 31. 3. příslušného roku', 'k 31. 12. předchozího roku', 'SHP kap. 4.2'],
  ['VM3', 'Sportovní část', 'Kde musí být zapsáni všichni členové sportovního oddílu SDH?', 'v příslušném státním rejstříku sportovců a sportovních organizací', 'jen v kronice kolektivu', 'v registru obyvatel obce', 'v evidenci ÚORM', 'SHP kap. 4.2'],
  ['VM3', 'Sportovní část', 'Kdo může rozhodnout o zařazení družstva kategorie mladší do kategorie starší?', 'trenér družstva', 'jen OORM', 'hlavní rozhodčí soutěže', 'nelze to', 'SHP kap. 4 – Kategorie'],
  ['VM3', 'Sportovní část', 'Nejméně kolik dní před soutěží musí OORM oznámit úpravy počtu disciplín a jejich hodnocení v okresních kolech hry Plamen?', '60 dnů', '14 dnů', '30 dnů', '90 dnů', 'SHP kap. 4 – Družstva'],
  ['VM3', 'Sportovní část', 'Do kdy je uzávěrka oznámení o přestupu podle přestupového systému hry Plamen?', '31. 3. příslušného ročníku', '1. 9. příslušného ročníku', '31. 1. příslušného ročníku', '30. 6. příslušného ročníku', 'SHP kap. 4 – Možnosti přestupu'],
  ['VM3', 'Sportovní část', 'Soutěžící při štafetě použije opasek, který není povinný. Co platí?', 'musí s ním disciplínu na svém úseku dokončit', 'může ho kdykoli odhodit', 'pokus je neplatný', 'musí ho mít celé družstvo ve všech disciplínách', 'SHP kap. 4 – Práva a povinnosti soutěžících'],
  ['VM3', 'Sportovní část', 'Soutěžícímu v průběhu disciplíny upadne přilba. Co musí udělat?', 'přerušit činnost, přilbu nasadit a teprve pak pokračovat', 'pokračovat a přilbu nasadit až v cíli', 'disciplínu ukončit', 'vzít přilbu do ruky a běžet dál', 'SHP kap. 4 – Práva a povinnosti soutěžících'],
  ['VM3', 'Sportovní část', 'Kdo kontroluje a podepisuje výsledkové listiny soutěže?', 'hlavní rozhodčí', 'zapisovatel', 'velitel soutěže', 'trenéři družstev', 'SHP kap. 4 – Hlavní rozhodčí'],
  ['VM3', 'Sportovní část', 'Jak se ručně měří čas soutěžícího?', 'zpravidla třemi, nejméně však dvěma časoměřiči nezávisle na sobě', 'jedním časoměřičem', 'vždy čtyřmi časoměřiči', 'odhadem rozhodčího disciplíny', 'SHP kap. 4 – Časoměřiči'],
  ['VM3', 'Sportovní část', 'Čas změřily jen dvoje stopky a časy se rozcházejí. Co je úředním časem?', 'horší čas', 'lepší čas', 'průměr obou časů', 'pokus se opakuje', 'SHP kap. 4 – Časoměřiči'],
  ['VM3', 'Sportovní část', 'Jakou číselnou hodnotu má pokus, ke kterému družstvo nenastoupilo?', '999 s', '998 s', '0 s', '120 s', 'SHP kap. 4 – Hodnocení družstev'],
  ['VM3', 'Disciplíny', 'Jak velký je terč v požárním útoku a kde je otvor?', 'štít 50 × 50 cm, otvor o průměru 50 mm ve výšce 160 cm', 'štít 1 × 1 m, otvor 10 cm ve výšce 1 m', 'kruhový terč o průměru 30 cm', 'štít 50 × 50 cm, otvor 10 cm ve výšce 2 m', 'SHP kap. 5.1'],
  ['VM3', 'Disciplíny', 'Kolik hadic C se použije v požárním útoku?', '4', '2', '3', '6', 'SHP kap. 5.1'],
  ['VM3', 'Disciplíny', 'Na jaký nejvyšší tlak je nastaven přetlakový ventil v požárním útoku?', '0,3 MPa', '0,1 MPa', '0,8 MPa', '1,2 MPa', 'SHP kap. 5.1'],
  ['VM3', 'Disciplíny', 'U kterého čísla je v požárním útoku CTIF na uzlovém stojanu vždy obraz úvazu na proudnici?', 'u čísla 7', 'u čísla 6', 'u čísla 9', 'pokaždé jinde', 'SHP kap. 5.2'],
  ['VM3', 'Disciplíny', 'Kolik trestných sekund je v požárním útoku CTIF za celé přetočení hadice?', '5', '10', '20', '2', 'SHP kap. 5.2'],
  ['VM3', 'Disciplíny', 'Jaká je doba na přípravu pokusu ve štafetě 4 × 60 m?', '5 minut', '2 minuty', '10 minut', '1 minuta', 'SHP kap. 5.3'],
  ['VM3', 'Disciplíny', 'Jaká je doba na přípravu pokusu ve štafetě požárních dvojic?', '2 minuty', '5 minut', '10 minut', '30 sekund', 'SHP kap. 5.5'],
  ['VM3', 'Disciplíny', 'V jaké vzdálenosti od startu je v běhu na 60 m s překážkami kladina?', '22 m', '10 m', '14 m', '43 m', 'SHP kap. 5.6'],
  ['VM3', 'Disciplíny', 'Při shodě časů na prvních třech místech v běhu na 60 m s překážkami rozhoduje nejprve', 'horší z obou časů', 'mladší věk závodníka', 'los', 'čas na kladině', 'SHP kap. 5.6'],
  ['VM3', 'ZHVB', 'Jak dlouhá je trať ZHVB pro kategorii starší?', 'přibližně 3 km', 'přibližně 1 km', 'přibližně 5 km', 'přibližně 2 km', 'OZ ZHVB – Popis tratě'],
  ['VM3', 'ZHVB', 'Kolik hlídek může současně plnit úkol na jednom stanovišti ZHVB?', 'vždy jen jedna', 'dvě, pokud to umožňuje materiál', 'libovolný počet', 'tři', 'OZ ZHVB – Provedení'],
  ['VM3', 'ZHVB', 'Nejméně kolik dní před soutěží musí OORM oznámit hlídkám úpravy okresního kola ZHVB?', '90 dnů', '30 dnů', '60 dnů', '14 dnů', 'OZ ZHVB – Okrsková a okresní kola'],
  ['VM3', 'ZHVB', 'Které hlídky plní na stanovišti K1 hod na cíl místo střelby ze vzduchovky?', 'přípravka a hlídky škol a dalších organizací (nečlenové)', 'dorost', 'kategorie starší', 'všechny kategorie', 'OZ ZHVB – K1'],
  ['VM3', 'ZHVB', 'Stejný čas dvou hlídek a stejný počet trestných bodů. Které stanoviště rozhoduje jako první?', 'Požární ochrana', 'Střelba ze vzduchovky', 'Uzlování', 'Orientace v přírodě', 'OZ ZHVB – Hodnocení'],
  ['VM3', 'ZHVB', 'Který jehličnatý strom v ČR jediný na zimu opadává?', 'modřín', 'smrk', 'borovice', 'jedle', 'OZ ZHVB – K2'],
  ['VM3', 'ZHVB', 'Se kterou rostlinou si děti nesmí splést jedovatý rulík?', 's borůvkou', 's kopřivou', 's mateřídouškou', 's heřmánkem', 'OZ ZHVB – K2'],
  ['VM3', 'ZHVB', 'Který uzel je tím pevnější, čím víc se utáhne, a uchycuje lano ke kůlům a stromům?', 'lodní uzel', 'plochá spojka', 'osmičkové oko', 'liščí uzel', 'OZ ZHVB – K3'],
  ['VM3', 'ZHVB', 'K čemu se hodí plochá spojka?', 'ke spojování provazů a svazování konců obvazu', 'k vytahování hadic do pater', 'k navázání hasiče na lano', 'k uvázání lana ke kmeni', 'OZ ZHVB – K3'],
  ['VM3', 'Ochrana obyvatelstva', 'Které telefonní číslo mají hasiči?', '150', '155', '158', '156', 'OZ ZHVB – K5, K7'],
  ['VM3', 'Ochrana obyvatelstva', 'Které číslo je jednotné evropské číslo tísňového volání?', '112', '911', '150', '999', 'OZ ZHVB – K7'],
  ['VM3', 'Požární ochrana', 'Vidíte venku požár, který sami neuhasíte. Co uděláte?', 'nepřibližuji se, volám hasiče a varuji lidi v okolí', 'jdu se podívat zblízka', 'začnu hasit, i když je velký', 'počkám, až přijedou hasiči, a nikomu nic neřeknu', 'OZ ZHVB – K5'],
  ['VM3', 'První pomoc', 'Jak postupujete při bodnutí hmyzem?', 'odstranit žihadlo, zjistit alergii (pak volat 155 nebo podat lék), jinak chladit', 'žihadlo nechat a ránu zahřát', 'ránu vyříznout', 'vždy hned podat léky na spaní', 'OZ ZHVB – K6'],
  ['VM3', 'První pomoc', 'Jak poskytnete první pomoc při úpalu?', 'přesunout do stínu, ochladit a podat tekutiny', 'zabalit do deky', 'nechat na slunci a podat sladkosti', 'osprchovat ledovou vodou celé tělo', 'OZ ZHVB – K6'],
  ['VM3', 'První pomoc', 'Proč po pokousání zvířetem vyhledáme lékaře?', 'nebezpečí vztekliny', 'kvůli omrzlinám', 'kvůli úpalu', 'není to potřeba', 'OZ ZHVB – K6'],
  ['VM3', 'První pomoc', 'K čemu slouží metoda FAST?', 'k rozpoznání příznaků cévní mozkové příhody', 'k měření tepu', 'k ošetření zlomeniny', 'k poznání otravy houbami', 'OZ ZHVB – K6'],
  ['VM3', 'První pomoc', 'Proč ukládáme člověka v bezvědomí, který dýchá, do zotavovací polohy?', 'aby nedošlo k neprůchodnosti dýchacích cest a vdechnutí zvratků', 'aby se rychleji probral', 'aby se zahřál', 'aby mohl lépe mluvit', 'OZ ZHVB – K6']
];

/* ---------- čtení ---------- */

function tsOtazky_(test, sada) {
  if (!dataSs_().getSheetByName(LIST_OTAZKY)) return [];
  return radky_(LIST_OTAZKY).filter(r => r['ID'] && String(r['Test']).trim() === test && String(r['Sada'] || 'zkouška') === sada && String(r['Aktivní'] || 'ANO').toUpperCase() !== 'NE'
    && String(r['Otázka'] || '').trim() && TS_PISMENA.indexOf(String(r['Správně']).trim().toUpperCase()) >= 0)
    .map(r => ({ id: String(r['ID']), okruh: String(r['Okruh'] || ''), t: String(r['Otázka']), m: TS_PISMENA.map(p => String(r[p] == null ? '' : r[p]).trim()), s: TS_PISMENA.indexOf(String(r['Správně']).trim().toUpperCase()), zdroj: String(r['Zdroj'] || '') }))
    .filter(q => q.m[q.s] && q.m.filter(Boolean).length >= 2);
}
/** Nastavení testu kvalifikace (Druhy kvalifikací): null = kvalifikace test nemá. */
function tsNastaveni_(kod) {
  const sh = dataSs_().getSheetByName(LIST_DRUHY_KVAL); if (!sh) return null;
  const r = radky_(LIST_DRUHY_KVAL).find(x => String(x['Kód']).trim() === String(kod || ''));
  const n = r ? Number(r['Test – otázek']) || 0 : 0;
  return n > 0 ? { kod: String(kod), nazev: String(r['Název'] || kod), otazek: n, maxChyb: Math.max(0, Number(r['Test – max. chyb']) || 0), minut: Number(r['Test – minut']) || 0, verejne: ano_(r['Test – veřejné otázky']) } : null;
}
/** Otázky, ze kterých se losuje test: ostrá sada, u veřejných otázek i cvičná (kandidáti se celou sadu učí z webu). */
function tsSada_(n) { return n.verejne ? tsOtazky_(n.kod, 'zkouška').concat(tsOtazky_(n.kod, 'cvičná')) : tsOtazky_(n.kod, 'zkouška'); }
function tsPokusy_(akceId) {
  if (!dataSs_().getSheetByName(LIST_POKUSY)) return [];
  return radky_(LIST_POKUSY).filter(r => r['ID'] && (!akceId || String(r['Akce – ID']) === akceId)).map(r => ({ id: String(r['ID']), skoleni: String(r['Akce – ID']), ucastnik: String(r['Účastník – ID']),
    pokus: Number(r['Pokus']) || 0, vysledek: String(r['Výsledek'] || ''), chyb: r['Chyb'] === '' ? null : Number(r['Chyb']), otazek: Number(r['Otázek']) || 0, zacatek: skIso_(r['Začátek']), odevzdano: skIso_(r['Odevzdáno']) }));
}
/** Souhrn testu u účastníků (detail školení pro okres): { [ID účastníka]: { pokusu, splneno, chyb, otazek } }. */
function tsSouhrn_(akceId) {
  const m = {};
  tsPokusy_(akceId).forEach(p => { const x = m[p.ucastnik] = m[p.ucastnik] || { pokusu: 0, splneno: false, chyb: null, otazek: 0, probiha: false };
    if (p.vysledek === 'probíhá') { x.probiha = true; return; }
    x.pokusu++; if (p.vysledek === 'splněno' && !x.splneno) { x.splneno = true; x.chyb = p.chyb; x.otazek = p.otazek; x.pokus = p.pokus; } });
  return m;
}
/** Test školení pro detail okresu: nastavení podle kvalifikací, stav odkazu. */
function tsSkoleni_(s, x) {
  const kody = s.druh === 'seminář' ? [] : s.kody, nast = kody.map(tsNastaveni_).filter(Boolean);
  if (!nast.length) return { ma: false };
  const plati = x && x.r[x.t.col('Test platí do')];
  return { ma: true, kvalifikace: nast.map(n => ({ kod: n.kod, nazev: n.nazev, otazek: n.otazek, maxChyb: n.maxChyb, minut: n.minut, verejne: n.verejne, vSade: tsSada_(n).length })),
    spusteny: !!(x && x.r[x.t.col('Test – otisk')] && plati instanceof Date && plati > new Date()), platiDo: plati instanceof Date ? plati.toISOString() : '' };
}

/* ---------- okres: spustit / ukončit test ---------- */

function tsSpustit_(o, req, zrusit) {
  const id = String(req.id || ''), lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const x = skNajit_(id), s = skNacist_(id);
    if (!x || !s) return { ok: false, chyba: 'Školení nenalezeno.' };
    if (!smiSkoleni_(o, s.pro)) return { ok: false, chyba: 'Toto školení nespravujete.' };
    const c = x.t.col;
    if (c('Test – otisk') < 0) return { ok: false, chyba: 'V listu Školení chybí sloupce testu – spusťte v tabulce OSH data → Založit / doplnit strukturu.' };
    if (zrusit) { x.r[c('Test – otisk')] = ''; x.r[c('Test platí do')] = ''; x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]); zaznamZmeny_(o.email, LIST_SKOLENI, id, 'upraveno', '', 'test ukončen'); return skDetail_(o, id); }
    if (['přihlášky', 'uzavřeno'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Test jde spustit jen u školení s přihláškami nebo uzavřeného (ne vyhodnoceného).' };
    const t = tsSkoleni_(s, null);
    if (!t.ma) return { ok: false, chyba: 'Kvalifikace školení nemá test (Druhy kvalifikací → Test – otázek).' };
    const prazdna = t.kvalifikace.find(k => !k.vSade);
    if (prazdna) return { ok: false, chyba: 'Pro ' + prazdna.nazev + ' nejsou v listu Otázky testů žádné aktivní otázky sady zkouška.' };
    const den = cleDen_(s.do || s.od).split('-').map(Number), plati = new Date(den[0], den[1] - 1, den[2], 23, 59, 59);
    if (plati < new Date()) return { ok: false, chyba: 'Školení už podle data skončilo – test spustit nejde.' };
    if (new Date(cleDen_(s.od) + 'T00:00:00') > new Date()) return { ok: false, chyba: 'Test jde spustit až v den školení (' + skDatum_(s.od) + ').' };
    const kod = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
    x.r[c('Test – otisk')] = otisk_('ts|' + kod); x.r[c('Test platí do')] = plati;
    x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
    zaznamZmeny_(o.email, LIST_SKOLENI, id, 'upraveno', '', 'test spuštěn do ' + skDatum_(plati.toISOString()));
    const web = String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '');
    return Object.assign(skDetail_(o, id), { odkaz: web + '/test.html#k=' + kod });
  } finally { lock.releaseLock(); }
}

/* ---------- veřejně: test kandidáta (bez přihlášení, kód v odkazu) ---------- */

function tsPodleKodu_(kod) {
  kod = String(kod || '');
  if (!/^[a-f0-9]{32}$/.test(kod)) return { chyba: 'Neplatný odkaz na test.' };
  if (!dataSs_().getSheetByName(LIST_SKOLENI)) return { chyba: 'Test není dostupný.' };
  const t = skTab_(LIST_SKOLENI), o = otisk_('ts|' + kod), i = t.v.findIndex(r => r[t.col('Test – otisk')] === o);
  if (i < 0) return { chyba: 'Odkaz neplatí – okres mohl test ukončit nebo spustit znovu. Požádejte lektora o aktuální QR kód.' };
  const plati = t.v[i][t.col('Test platí do')];
  if (!(plati instanceof Date) || plati < new Date()) return { chyba: 'Platnost testu skončila (platí do konce dne školení).' };
  const id = String(t.v[i][t.col('Akce – ID')]), s = skNacist_(id);
  return s ? { s: s } : { chyba: 'Školení nenalezeno.' };
}
const tsZamichat_ = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; };

/** Veřejná akce „test“: krok info | start | odevzdat. */
function testApi_(req) {
  const c = CacheService.getScriptCache(), klicChyb = 'ts_chyb_' + Math.floor(Date.now() / 600000);
  if (Number(c.get(klicChyb) || 0) >= 200) return { ok: false, chyba: 'Příliš mnoho neplatných pokusů. Zkuste to za 10 minut.' };
  const k = tsPodleKodu_(req.kod);
  if (k.chyba) { c.put(klicChyb, String(Number(c.get(klicChyb) || 0) + 1), 900); return { ok: false, chyba: k.chyba, neplatny: true }; }
  const s = k.s, uc = skUcastnici_(s.id, null).filter(u => u.stav !== 'odhlášeno'), souhrn = tsSouhrn_(s.id);
  const nastU = u => tsNastaveni_(s.kody.length > 1 ? u.kod || s.kody[0] : s.kody[0]);
  if (req.krok === 'info') return { ok: true, test: true, skoleni: { nazev: s.nazev, datum: skDatum_(s.od) },
    ucastnici: uc.map(u => { const n = nastU(u); return { id: u.id, jmeno: u.prijmeni + ' ' + u.jmeno, sbor: String(u.sbor).replace(/^SDH\s+/i, ''), splneno: !!(souhrn[u.id] || {}).splneno, test: n ? n.nazev : '' }; }).filter(u => u.test) };
  const u = uc.find(x => x.id === String(req.ucastnik || ''));
  if (!u) return { ok: false, chyba: 'Účastník nenalezen – vyberte se znovu ze seznamu.' };
  const n = nastU(u);
  if (!n) return { ok: false, chyba: 'Pro vaši kvalifikaci test není.' };
  if (cleDen_(req.narozen) !== u.narozen) { // ověření osoby – chyby počítá limit
    if (limit_('test-narozen', u.id, 10, 3600)) return { ok: false, chyba: 'Příliš mnoho chybných pokusů o ověření. Obraťte se na lektora.' };
    return { ok: false, chyba: 'Datum narození nesouhlasí s přihláškou na školení. Zkuste to znovu, nebo se obraťte na lektora.' };
  }
  if (req.krok === 'start') return tsStart_(s, u, n, souhrn[u.id] || {});
  if (req.krok === 'odevzdat') return tsOdevzdat_(s, u, n, req);
  return { ok: false, chyba: 'Neznámý krok.' };
}
function tsStart_(s, u, n, sou) {
  if (sou.splneno) return { ok: true, test: true, hotovo: true, vysledek: { splneno: true, chyb: sou.chyb, otazek: sou.otazek, maxChyb: n.maxChyb, pokus: sou.pokus } };
  if (limit_('test-pokus', u.id, TS_MAX_POKUSU, 21600)) return { ok: false, chyba: 'Pokusů bylo příliš mnoho. Obraťte se na lektora.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sada = tsSada_(n);
    if (!sada.length) return { ok: false, chyba: 'Otázky testu nejsou připravené – obraťte se na lektora.' };
    const t = skTab_(LIST_POKUSY), col = t.col, ted = new Date();
    const moje = t.v.filter(r => String(r[col('Účastník – ID')]) === u.id && String(r[col('Akce – ID')]) === s.id);
    const probiha = moje.find(r => r[col('Výsledek')] === 'probíhá'); // nedokončený pokus (obnovení stránky) – vrátit stejný
    if (probiha) { // nový klíč – kandidát se právě znovu ověřil datem narození
      const klic2 = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32), j = t.v.indexOf(probiha);
      probiha[col('Klíč – otisk')] = otisk_('tsp|' + klic2); t.sh.getRange(j + 2, 1, 1, t.h.length).setValues([probiha]);
      return tsZadani_(String(probiha[col('ID')]), Number(probiha[col('Pokus')]), JSON.parse(probiha[col('Otázky')] || '[]'), sada, n, probiha[col('Začátek')], klic2, true);
    }
    // nový výběr: přednostně otázky, které v minulém pokusu nebyly
    const minule = {}; moje.slice(-1).forEach(r => { try { JSON.parse(r[col('Otázky')] || '[]').forEach(q => { minule[q[0]] = true; }); } catch (e) {} });
    const pocet = Math.min(n.otazek, sada.length), nove = tsZamichat_(sada.filter(q => !minule[q.id])), stare = tsZamichat_(sada.filter(q => minule[q.id]));
    const vyber = nove.concat(stare).slice(0, pocet), poradi = vyber.map(q => [q.id, tsZamichat_([0, 1, 2, 3].filter(i => q.m[i])).join('')]);
    const id = skNoveId_('T'), klic = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32), cislo = moje.length + 1;
    const r = t.h.map(() => ''), set = (k, v) => { if (col(k) >= 0) r[col(k)] = v; };
    set('ID', id); set('Akce – ID', s.id); set('Účastník – ID', u.id); set('Jméno', u.jmeno + ' ' + u.prijmeni); set('Test', n.kod); set('Pokus', cislo); set('Otázky', JSON.stringify(poradi));
    set('Začátek', ted); set('Otázek', pocet); set('Výsledek', 'probíhá'); set('Klíč – otisk', otisk_('tsp|' + klic));
    t.sh.appendRow(r);
    return tsZadani_(id, cislo, poradi, sada, n, ted, klic, false);
  } finally { lock.releaseLock(); }
}
/** Zadání pro prohlížeč: jen texty otázek a odpovědí v zamíchaném pořadí – bez správných odpovědí. */
function tsZadani_(id, cislo, poradi, sada, n, zacatek, klic, obnoveno) {
  const mapa = {}; sada.forEach(q => { mapa[q.id] = q; });
  return { ok: true, test: true, pokus: { id: id, cislo: cislo, klic: klic, obnoveno: obnoveno, zacatek: zacatek instanceof Date ? zacatek.toISOString() : String(zacatek), minut: n.minut, maxChyb: n.maxChyb, nazev: n.nazev,
    otazky: poradi.map(([qid, por]) => { const q = mapa[qid] || { t: '(otázka byla vyřazena – počítá se jako správná)', m: [] }; return { t: q.t, m: por.split('').map(i => q.m[Number(i)] || '') }; }) } };
}
function tsOdevzdat_(s, u, n, req) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = skTab_(LIST_POKUSY), col = t.col, i = t.v.findIndex(r => String(r[col('ID')]) === String(req.pokus || '') && String(r[col('Účastník – ID')]) === u.id);
    if (i < 0) return { ok: false, chyba: 'Pokus nenalezen.' };
    const r = t.v[i];
    if (r[col('Výsledek')] !== 'probíhá') // opakované odeslání (výpadek spojení) – vrátit uložený výsledek
      return { ok: true, test: true, vysledek: { splneno: r[col('Výsledek')] === 'splněno', chyb: Number(r[col('Chyb')]) || 0, otazek: Number(r[col('Otázek')]) || 0, maxChyb: n.maxChyb, pokus: Number(r[col('Pokus')]), spatne: [], znovu: true } };
    if (!req.klic || r[col('Klíč – otisk')] !== otisk_('tsp|' + String(req.klic))) return { ok: false, chyba: 'Pokus patří jinému zařízení – začněte nový.' };
    const ted = new Date();
    if (n.minut && ted - r[col('Začátek')] > (n.minut + 2) * 60000) { r[col('Výsledek')] = 'nesplněno'; } // po čase: hodnotí se jako nesplněný
    const poradi = JSON.parse(r[col('Otázky')] || '[]'), sada = tsSada_(n), mapa = {}; sada.forEach(q => { mapa[q.id] = q; });
    const odp = Array.isArray(req.odpovedi) ? req.odpovedi : [];
    const spatne = [];
    poradi.forEach(([qid, por], j) => {
      const q = mapa[qid]; if (!q) return; // vyřazená otázka se nepočítá jako chyba
      const v = Number(odp[j]), puv = Number.isInteger(v) && v >= 0 && v < por.length ? Number(por[v]) : -1;
      if (puv !== q.s) spatne.push({ c: j + 1, t: q.t, vase: puv >= 0 ? q.m[puv] : '(bez odpovědi)', spravne: n.verejne ? q.m[q.s] : undefined }); // správná jen u veřejných otázek
    });
    const splneno = r[col('Výsledek')] !== 'nesplněno' && spatne.length <= n.maxChyb;
    r[col('Odevzdáno')] = ted; r[col('Chyb')] = spatne.length; r[col('Výsledek')] = splneno ? 'splněno' : 'nesplněno';
    r[col('Odpovědi')] = JSON.stringify(odp.slice(0, 200).map(x => Number.isInteger(Number(x)) ? Number(x) : null)); r[col('Klíč – otisk')] = '';
    t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
    zaznamZmeny_('test', LIST_POKUSY, String(r[col('ID')]), 'upraveno', 'probíhá', r[col('Výsledek')] + ' (' + spatne.length + ' chyb)');
    // u tajné ostré sady se správné odpovědi kandidátovi neukazují – jen které otázky měl špatně
    return { ok: true, test: true, vysledek: { splneno: splneno, chyb: spatne.length, otazek: poradi.length, maxChyb: n.maxChyb, pokus: Number(r[col('Pokus')]), casVyprsel: n.minut && ted - r[col('Začátek')] > (n.minut + 2) * 60000, spatne: spatne } };
  } finally { lock.releaseLock(); }
}

/* ---------- web: cvičné testy ---------- */

/** Pro ?co=web: cvičné sady (se správnými odpověďmi – jsou veřejné). */
function testyVerejne_() {
  if (!dataSs_().getSheetByName(LIST_OTAZKY)) return [];
  const druhy = skDruhy_().filter(d => d.aktivni), out = [];
  druhy.forEach(d => { const n = tsNastaveni_(d.kod), q = n && n.verejne ? tsSada_(n) : tsOtazky_(d.kod, 'cvičná');
    if (q.length) out.push({ kod: d.kod, nazev: d.nazev, pro: d.pro, otazek: n ? n.otazek : 0, maxChyb: n ? n.maxChyb : 0, verejne: !!(n && n.verejne), otazky: q.map(x => ({ id: x.id, t: x.t, m: x.m, s: x.s, okruh: x.okruh, zdroj: x.zdroj })) }); });
  return out;
}

/* ---------- návrh otázek do tabulky ---------- */

/** Vloží cvičnou sadu (TS_CVICNE) a návrh ostré sady (TS_ZKOUSKA_NAVRH z OtazkyZkouska.gs, jen lokálně) – každou jen do prázdné sady. */
function vlozitNavrhOtazekTestu() {
  const t = skTab_(LIST_OTAZKY), ted = new Date(), out = [], hlaseni = [];
  const ma = (test, sada) => t.v.some(r => String(r[t.col('Test')]) === test && String(r[t.col('Sada')]) === sada);
  const radek = (test, sada, okruh, otazka, odp, zdroj, i) => { const r = t.h.map(() => ''), set = (k, v) => { if (t.col(k) >= 0) r[t.col(k)] = v; };
    set('ID', 'Q' + (sada === 'cvičná' ? 'C' : 'Z') + test + '-' + String(i + 1).padStart(3, '0')); set('Test', test); set('Sada', sada); set('Okruh', okruh); set('Otázka', otazka);
    odp.forEach((x, j) => set(TS_PISMENA[j], x)); set('Správně', 'A'); set('Zdroj', zdroj); set('Aktivní', 'ANO'); set('Poznámka', 'návrh 10/2026 – ke kontrole OORM'); set('Vytvořeno', ted); set('Vytvořil', 'návrh');
    return r; };
  if (!ma('VM3', 'cvičná')) { TS_CVICNE.forEach((q, i) => out.push(radek(q[0], 'cvičná', q[1], q[2], q.slice(3, 7), q[7], i))); hlaseni.push('cvičná sada VM3: ' + TS_CVICNE.length); }
  else hlaseni.push('cvičná sada VM3 už v tabulce je – nic nevkládám');
  if (typeof TS_ZKOUSKA_NAVRH === 'undefined') hlaseni.push('ostrá sada: soubor OtazkyZkouska.gs v projektu není (je jen lokálně u správce)');
  else if (!ma('VM3', 'zkouška')) { TS_ZKOUSKA_NAVRH.forEach((q, i) => out.push(radek('VM3', 'zkouška', q[0], q[1], q.slice(2, 6), q[6], i))); hlaseni.push('ostrá sada VM3: ' + TS_ZKOUSKA_NAVRH.length); }
  else hlaseni.push('ostrá sada VM3 už v tabulce je – nic nevkládám');
  if (out.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, out.length, t.h.length).setValues(out);
  // VM3: nastavení testu podle koncepce SH ČMS (40 otázek, nejvýš 8 chyb), jen když je prázdné
  const d = skTab_(LIST_DRUHY_KVAL), dc = d.col, i = d.v.findIndex(r => String(r[dc('Kód')]) === 'VM3');
  if (i >= 0 && dc('Test – otázek') >= 0 && !d.v[i][dc('Test – otázek')]) { d.sh.getRange(i + 2, dc('Test – otázek') + 1).setValue(40); d.sh.getRange(i + 2, dc('Test – max. chyb') + 1).setValue(8); hlaseni.push('VM3: test 40 otázek, nejvýš 8 chyb'); }
  vycistitCache_();
  const text = 'Otázky testů – ' + hlaseni.join('; ') + '. Zkontrolujte je s OORM (list Otázky testů, sloupec Aktivní).';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Otázky testů', 15); } catch (e) {}
  return text;
}
