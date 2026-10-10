/**
 * Prezentace „Nový web a aplikace OSH Praha-západ“ (setkání starostů OSH a KSH, Přibyslav, říjen 2026).
 *
 * Jak použít: script.google.com → Nový projekt → vložit celý tento soubor → nahoře vybrat vytvoritPrezentaci → Spustit
 * → povolit přístup (Google Prezentace). Prezentace vznikne v kořeni vašeho Disku, odkaz je v Protokolu provádění.
 * Spustit znovu = nová prezentace (stará zůstane). Snímky obrazovky se berou z test.oshpz.cz/docs/prezentace/.
 * Poznámky pro mluvčí jsou u každého snímku (Zobrazit → Zobrazit poznámky řečníka).
 */

const PREZ = {
  nazev: 'OSH Praha-západ – nový web a aplikace (Přibyslav 2026)',
  obrazky: 'https://test.oshpz.cz/docs/prezentace/',
  font: 'Archivo',
  inkoust: '#201e1d', podklad: '#f3f2f2', bila: '#ffffff', seda: '#6b6766', linka: '#c9c6c5',
  cervena: '#ec3013', modra: '#2f4fb0'
};

function vytvoritPrezentaci() {
  const p = SlidesApp.create(PREZ.nazev);
  const W = p.getPageWidth(), H = p.getPageHeight(); // 720 × 405 bodů (16:9)
  p.getSlides()[0].remove();
  const S = obsah_();
  S.forEach(def => snimek_(p, W, H, def));
  p.saveAndClose();
  console.log('Prezentace hotová (' + S.length + ' snímků): ' + p.getUrl());
}

/* ---------- obsah ---------- */

function obsah_() {
  return [
    { typ: 'titul', nadpis: 'Nový web a aplikace\nOSH Praha-západ', podnadpis: 'Co chystáme pro sbory a okres',
      pata: 'Setkání starostů OSH a KSH · Přibyslav · říjen 2026',
      pozn: 'Dobrý den, představím, na čem v okrese Praha-západ pracujeme: nový web okresu a aplikaci pro sbory a kancelář okresu. Zabere to asi deset minut, pak ráda odpovím na dotazy.' },

    { typ: 'body', stitek: 'Výchozí stav', nadpis: 'Proč to měníme',
      body: ['Starý web oshpz.cz (Joomla) je těžko udržovatelný a na mobilu se špatně používá.',
        'Dokumenty, termíny a zprávy pro sbory jsou roztroušené v e-mailech, na webu a na Disku.',
        'Žádosti o pořádání akcí, výpůjčky majetku a připomínky termínů se řeší ručně.',
        'Cíl: jedno místo, méně ruční práce v kanceláři a sbor uvidí přesně to, co se ho týká.'],
      pozn: 'Okres má 71 sborů a zhruba 3 700 členů. Většina komunikace dnes běží přes e-maily a ruční přeposílání. Chceme, aby informace šly jednou cestou a nic se neztratilo.' },

    { typ: 'sloupce', stitek: 'Přehled', nadpis: 'Tři části, jedna data',
      sloupce: [
        ['Veřejný web', PREZ.modra, 'Aktuality, kalendář akcí, orgány a jejich zápisy, mapa a kontakty sborů, soutěže a výsledky mládeže.'],
        ['Portál sboru', PREZ.modra, 'Po přihlášení: akce, uzávěrky a dokumenty pro sbory, žádosti o pořádání akcí, zprávy okresu.'],
        ['Správa okresu', PREZ.cervena, 'Schvalování dokumentů a žádostí, kalendář, majetek a výpůjčky, příspěvky na web, záznam změn.']],
      pozn: 'Všechny tři části čerpají ze stejných dat v Google Tabulkách a na Google Disku okresu. Co kancelář jednou schválí, objeví se na webu, v portálu sborů i v kalendáři.' },

    { typ: 'obrazek', stitek: 'Veřejný web', nadpis: 'Web pro veřejnost i sbory', obr: 'web-uvod.png', obr2: 'web-mobil.png',
      body: ['Aktuality, kalendář akcí a uzávěrek', 'Orgány OSH a jejich zápisy', 'Mapa a kontakty 71 sborů', 'Soutěže a výsledky mládeže', 'Pohodlně na mobilu'],
      pozn: 'Web se plní sám z toho, co kancelář schválí: zveřejněný zápis výboru, akce v kalendáři nebo aktualita. Nikdo nemusí nic přepisovat na web ručně.' },

    { typ: 'obrazek', stitek: 'Portál sboru', nadpis: 'Sbor vidí, co se ho týká', obr: 'portal-sboru.png',
      body: ['Přihlášení kódem na e-mail – bez hesla', 'Akce a uzávěrky na 30 dní dopředu', 'Dokumenty jen pro sbory, MH nebo okrsek', 'Žádost o pořádání akce či soutěže', 'Zprávy okresu'],
      pozn: 'Starosta, velitel nebo vedoucí mládeže zadá svůj e-mail a přijde mu kód. Hesla si nikdo nepamatuje. Sbor vidí veřejné věci a k tomu to, co je určené jen sborům, sborům s mladými hasiči nebo jeho okrsku.' },

    { typ: 'obrazek', stitek: 'Správa okresu', nadpis: 'Méně ruční práce v kanceláři', obr: 'sprava-zadosti.png', obr2: 'prispevek-mobil.png',
      body: ['Žádosti sborů s hlídáním souběhu akcí', 'Schválení = zápis do kalendáře a e-mail sboru', 'Dokumenty z Disku po schválení na web', 'Majetek a výpůjčky', 'Aktuality i e-mailem, se schválením'],
      pozn: 'Když sbor podá žádost o pořádání soutěže, aplikace sama upozorní, že ten den už je jiná akce, třeba ve stejném okrsku. Po schválení se akce zapíše do kalendáře a sbor dostane e-mail. Aktualitu může dopisovatel poslat i obyčejným e-mailem s fotkami, kancelář ji jen schválí.' },

    { typ: 'body', stitek: 'Bezpečnost', nadpis: 'Bezpečně a s ohledem na osobní údaje',
      body: ['Přihlášení jednorázovým kódem, oprávnění se ověřuje na serveru u každého kroku.',
        'Každý vidí jen to, co mu patří: sbor svůj sbor, okres podle přidělené role.',
        'Kontakty funkcionářů na webu jen s jejich souhlasem.',
        'Rodná čísla se do tabulek neukládají – jen do přihlášky pro evidenci SH ČMS.',
        'Záznam změn, týdenní zálohy, fotky na web bez polohy GPS.'],
      pozn: 'Na ochranu údajů jsme mysleli od začátku. Všechno je v Google Workspace okresu, ne u cizí firmy. Každá změna se zapisuje, takže víme, kdo co kdy upravil.' },

    { typ: 'body', stitek: 'Provoz', nadpis: 'Na čem to stojí',
      body: ['Google Workspace pro neziskové organizace: Disk, Tabulky, Kalendář, skupiny.',
        'Každý sbor má skupinu sdh-…@oshpz.cz s osobními e-maily svých lidí.',
        'Web a aplikace běží na GitHub Pages – bez serveru, který by bylo nutné spravovat.',
        'Bez licenčních poplatků; data zůstávají v Disku a tabulkách okresu.'],
      pozn: 'Sbory nepotřebují žádné nové účty ani licence. Stačí osobní e-mail, který zařadíme do skupiny sboru. Pro okres je to provoz prakticky bez nákladů.' },

    { typ: 'casova', stitek: 'Harmonogram', nadpis: 'Kdy to bude',
      kroky: [['Říjen', 'Test v kanceláři okresu', 'web test.oshpz.cz, aplikace na testovacích datech'],
        ['Listopad', 'Pilot se sbory', 'vybrané sbory zkoušejí portál a dávají zpětnou vazbu'],
        ['Prosinec', 'Spuštění', 'přepnutí oshpz.cz na nový web do konce roku 2026'],
        ['Potom', 'Další moduly', 'přihlášky do soutěží a výsledky, přihlášky nových členů']],
      pozn: 'Dnes jsme ve fázi testování v okrese. Pilot se sbory plánujeme na listopad a přepnutí webu do konce roku. Soutěže a přihlášky členů přijdou po spuštění.' },

    { typ: 'body', stitek: 'Spolupráce', nadpis: 'Co potřebujeme od sborů',
      body: ['Osobní e-maily starosty, velitele a vedoucího mládeže do skupiny sboru.',
        'Údaje o sboru: mladí hasiči, výjezdová jednotka, soutěžní družstva, okrsek.',
        'Několik sborů do pilotu a jejich zpětnou vazbu.'],
      pozn: 'Kontakty budeme sbírat formulářem, který rozešle kancelář okresu. Uvítáme sbory, které se zapojí do pilotu v listopadu.' },

    { typ: 'body', stitek: 'Pro další okresy', nadpis: 'Dá se převzít',
      body: ['Řešení je postavené na běžných službách Google a otevřeném kódu.',
        'Jiné OSH může použít stejný postup se svou doménou a daty.',
        'Rádi předáme zkušenosti, postup nastavení a ukážeme, jak to funguje.'],
      pozn: 'Pokud by o podobné řešení měly zájem další okresy nebo kraj, rádi se podělíme. Nejvíc práce je v nastavení skupin sborů a sběru kontaktů, technická část je připravená.' },

    { typ: 'zaver', nadpis: 'Děkuji za pozornost', podnadpis: 'Vyzkoušejte: test.oshpz.cz', pata: 'Dotazy a zájem o pilot: spravci@oshpz.cz',
      pozn: 'Testovací web je veřejně dostupný na test.oshpz.cz. Děkuji a ráda odpovím na dotazy.' }
  ];
}

/* ---------- vykreslení ---------- */

function snimek_(p, W, H, d) {
  const sl = p.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  sl.getBackground().setSolidFill(d.typ === 'titul' || d.typ === 'zaver' ? PREZ.inkoust : PREZ.podklad);
  const M = 36; // okraj
  if (d.typ === 'titul' || d.typ === 'zaver') {
    obdelnik_(sl, 0, 0, 14, H, d.typ === 'titul' ? PREZ.cervena : PREZ.modra);
    text_(sl, 'OSH PRAHA-ZÁPAD', M + 10, 40, W - 2 * M, 20, 11, true, PREZ.cervena, 0.08);
    text_(sl, d.nadpis, M + 10, 92, W - 2 * M - 20, 150, d.typ === 'titul' ? 46 : 40, true, PREZ.bila);
    text_(sl, d.podnadpis, M + 10, 250, W - 2 * M - 20, 40, 20, false, PREZ.bila);
    obdelnik_(sl, M + 10, H - 64, W - 2 * M - 10, 2, '#5a5655');
    text_(sl, d.pata, M + 10, H - 54, W - 2 * M - 10, 24, 12, false, '#c9c6c5');
  } else {
    obdelnik_(sl, M, 28, 40, 4, d.typ === 'obrazek' && /Správa/.test(d.stitek) ? PREZ.cervena : PREZ.modra);
    text_(sl, (d.stitek || '').toUpperCase(), M, 36, 400, 18, 10, true, PREZ.seda, 0.08);
    text_(sl, d.nadpis, M, 54, W - 2 * M, 44, 28, true, PREZ.inkoust);
    obdelnik_(sl, M, 104, W - 2 * M, 2, PREZ.inkoust);
    if (d.typ === 'body') odrazky_(sl, d.body, M, 122, W - 2 * M - 80, H - 150, 17);
    if (d.typ === 'sloupce') {
      const sw = (W - 2 * M - 2 * 18) / 3;
      d.sloupce.forEach((s, i) => {
        const x = M + i * (sw + 18);
        obdelnik_(sl, x, 126, sw, 6, s[1]);
        text_(sl, s[0], x, 140, sw, 30, 19, true, PREZ.inkoust);
        text_(sl, s[2], x, 176, sw, 160, 13, false, PREZ.inkoust, 0, 1.35);
      });
    }
    if (d.typ === 'obrazek') {
      const textW = 230;
      odrazky_(sl, d.body, M, 122, textW - 10, H - 140, 13);
      const ox = M + textW + 6, ow = W - M - ox;
      if (d.obr2) {
        const mw = 92, hlW = ow - mw - 12;
        obrazek_(sl, d.obr, ox, 122, hlW, H - 122 - 24);
        obrazek_(sl, d.obr2, ox + hlW + 12, 122, mw, H - 122 - 24);
      } else obrazek_(sl, d.obr, ox, 122, ow, H - 122 - 24);
    }
    if (d.typ === 'casova') {
      const n = d.kroky.length, sw = (W - 2 * M - (n - 1) * 12) / n;
      d.kroky.forEach((k, i) => {
        const x = M + i * (sw + 12);
        obdelnik_(sl, x, 130, sw, 6, i === 2 ? PREZ.cervena : PREZ.inkoust);
        text_(sl, k[0], x, 146, sw, 26, 20, true, i === 2 ? PREZ.cervena : PREZ.inkoust);
        text_(sl, k[1], x, 178, sw, 44, 14, true, PREZ.inkoust, 0, 1.2);
        text_(sl, k[2], x, 222, sw, 110, 12, false, PREZ.seda, 0, 1.35);
      });
    }
    text_(sl, 'OSH Praha-západ · nový web a aplikace', M, H - 22, 400, 16, 8, false, PREZ.seda);
  }
  if (d.pozn) sl.getNotesPage().getSpeakerNotesShape().getText().setText(d.pozn);
}

function text_(sl, t, x, y, w, h, vel, tucne, barva, prostrkani, radkovani) {
  const box = sl.insertTextBox(t, x, y, w, h);
  const st = box.getText().getTextStyle();
  st.setFontFamily(PREZ.font).setFontSize(vel).setBold(!!tucne).setForegroundColor(barva);
  if (radkovani) box.getText().getParagraphStyle().setLineSpacing(radkovani * 100);
  box.setContentAlignment(SlidesApp.ContentAlignment.TOP);
  return box;
}

function odrazky_(sl, body, x, y, w, h, vel) {
  const box = sl.insertTextBox(body.join('\n'), x, y, w, h);
  const t = box.getText();
  t.getTextStyle().setFontFamily(PREZ.font).setFontSize(vel).setForegroundColor(PREZ.inkoust);
  t.getParagraphStyle().setLineSpacing(125).setSpaceBelow(vel * 0.6);
  t.getListStyle().applyListPreset(SlidesApp.ListPreset.DISC_CIRCLE_SQUARE);
  box.setContentAlignment(SlidesApp.ContentAlignment.TOP);
  return box;
}

function obdelnik_(sl, x, y, w, h, barva) {
  const r = sl.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  r.getFill().setSolidFill(barva); r.getBorder().setTransparent();
  return r;
}

/** Snímek obrazovky vložený do rámečku w × h se zachováním poměru stran, s tenkou linkou kolem. */
function obrazek_(sl, soubor, x, y, w, h) {
  try {
    const img = sl.insertImage(PREZ.obrazky + soubor);
    const k = Math.min(w / img.getWidth(), h / img.getHeight());
    const iw = img.getWidth() * k, ih = img.getHeight() * k;
    img.setWidth(iw).setHeight(ih).setLeft(x + (w - iw) / 2).setTop(y);
    const ram = sl.insertShape(SlidesApp.ShapeType.RECTANGLE, x + (w - iw) / 2, y, iw, ih);
    ram.getFill().setTransparent(); ram.getBorder().setWeight(1).getLineFill().setSolidFill(PREZ.linka);
  } catch (e) {
    console.warn('Obrázek ' + soubor + ' se nepodařilo vložit: ' + e.message);
    text_(sl, '[snímek obrazovky: ' + soubor + ']', x, y, w, 30, 12, false, PREZ.seda);
  }
}
