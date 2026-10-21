/* Přihláška člena SH ČMS (B7) – společný kód webu (index.html) a aplikace (Aplikace OSH.dc.html).
 * - rc(text): kontrola rodného čísla, datum narození, věk, kategorie (do 18 let = mladý hasič)
 * - pdf(data, zaklad, { koncept }): vyplní originální šablonu SH ČMS (assets/sablony, pole formuláře podle názvu) písmem s diakritikou;
 *   koncept = formulář nezploští (sportovce a datum schválení výborem doplní sbor při přijetí – dokoncit())
 * - dokoncit(pdf, { sportovec, datumVyboru }): doplní koncept a zploští (k tisku); starší už zploštělé PDF vrátí beze změny
 * - zmensitFoto(soubor): fotka v prohlížeči – max. 1200 px, JPEG, bez EXIF/GPS
 * - spd(...): řetězec pro QR platbu (SPD 1.0), účet ve tvaru [předčíslí-]číslo/kód banky → IBAN
 * Rodné číslo se nikam neposílá kromě serveru aplikace (do PDF a udaje.json); v rozhraní jen maskované (maska()).
 * pdf-lib a fontkit se načtou až při prvním PDF (unpkg, pevná verze + SRI – adresy musí být v CSP obou stránek). */
(function (koren) {
  const KNIHOVNY = [
    ['PDFLib', 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js', 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI'],
    ['fontkit', 'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js', 'sha384-2p6U+1mmqF10USehFeRiyG2ESG9FwIqN+jxULn5w9jjQIihSn9Pt13dVCn/Hawjn'],
    ['qrcode', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js', 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k']
  ];
  const SABLONA = { 'dospělý': 'assets/sablony/prihlaska-clena-hasic.pdf', 'mladý hasič': 'assets/sablony/prihlaska-clena-mlady-hasic.pdf' };
  const PISMO = 'assets/fonty/NotoSans-Regular.ttf';

  // zbytek po dělení dlouhého čísla zapsaného jako text (bez BigInt)
  const mod = (cislice, n) => String(cislice).split('').reduce((z, c) => (z * 10 + +c) % n, 0);

  /* ---------- rodné číslo ---------- */
  // Formát RRMMDD/XXXX (od 1954 deset číslic, dělitelné 11; starší devět číslic). Ženy měsíc +50, od roku 2004 může být +20.
  function rc(text, kDatu) {
    const s = String(text || '').replace(/[\s/]/g, '');
    if (!/^\d{9,10}$/.test(s)) return { ok: false, chyba: 'Rodné číslo má tvar RRMMDD/XXXX (9 nebo 10 číslic).' };
    let rr = +s.slice(0, 2), mm = +s.slice(2, 4), dd = +s.slice(4, 6);
    let rok = s.length === 9 ? 1900 + rr : (rr < 54 ? 2000 + rr : 1900 + rr);
    if (s.length === 9 && rr >= 54) return { ok: false, chyba: 'Rodné číslo po roce 1953 má 10 číslic.' };
    if (mm > 70) mm -= 70; else if (mm > 50) mm -= 50; else if (mm > 20) mm -= 20;
    const d = new Date(Date.UTC(rok, mm - 1, dd));
    if (mm < 1 || mm > 12 || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return { ok: false, chyba: 'Rodné číslo neobsahuje platné datum narození.' };
    if (s.length === 10) {
      if (mod(s, 11) !== 0 && !(mod(s.slice(0, 9), 11) === 10 && s[9] === '0')) return { ok: false, chyba: 'Rodné číslo není platné (kontrolní číslice nesedí). Zkontrolujte ho.' };
    }
    const k = kDatu ? new Date(kDatu) : new Date();
    if (d > k) return { ok: false, chyba: 'Rodné číslo obsahuje datum narození v budoucnosti.' };
    let vek = k.getFullYear() - rok; if (k.getMonth() + 1 < mm || (k.getMonth() + 1 === mm && k.getDate() < dd)) vek--;
    const datum = rok + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    return { ok: true, cislo: s.slice(0, 6) + '/' + s.slice(6), datum, vek, kategorie: vek < 18 ? 'mladý hasič' : 'dospělý' };
  }
  const maska = text => { const s = String(text || '').replace(/[\s/]/g, ''); return s.length >= 9 ? '******/' + s.slice(6) : ''; };
  const datumCz = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (+m[3]) + '. ' + (+m[2]) + '. ' + m[1] : ''; };

  /* ---------- formulář (web i portál sboru) ----------
   * f = hodnoty polí { kategorie ('dospělý' | 'mladý hasič' – vybere uchazeč), jmeno, prijmeni, rc, ulice, obec, psc, prislusnost, telefon, email,
   *       sportovec, zzJmeno, zzNarozeni, zzTelefon, prestup, prestupSbor ('jiny' = mimo okres), prestupJiny, souhlas, motivace, fotka (zvolená) }.
   * volby.zadost = žádost uchazeče na webu (fotka povinná, u dospělého motivační dopis). Stejná pravidla jako server (prhKontrola_ v Prihlasky.gs). */
  const TEL = /^\+?[\d ()-]{9,20}$/, MOTIVACE_MAX = 2000;
  const KATEGORIE = ['dospělý', 'mladý hasič'];
  // členem SH ČMS může být občan ČR nebo cizinec s povolením k trvalému pobytu v ČR (Stanovy SH ČMS 2025, čl. 19 odst. 2)
  const jeCR = t => /^(čr|cr|cz|cze|česk(á|a) republika|česko|czech republic)$/i.test(String(t || 'ČR').trim());
  /** Kategorie vybraná uchazečem vs. věk z rodného čísla (k dnešku): text chyby, nebo ''. */
  function kategorieChyba(kategorie, r) {
    if (!r || !r.ok || !kategorie || r.kategorie === kategorie) return '';
    const let_ = n => n + (n === 1 ? ' rok' : n >= 2 && n <= 4 ? ' roky' : ' let');
    return r.kategorie === 'mladý hasič'
      ? 'Podle rodného čísla je uchazeči ' + let_(r.vek) + ' – do 18 let vyberte přihlášku mladého hasiče.'
      : 'Podle rodného čísla je uchazeči ' + let_(r.vek) + ' – od 18 let vyberte přihlášku dospělého (hasiče).';
  }
  function kontrola(f, volby) {
    const e = {}, t = k => String(f[k] || '').trim(), zadost = !!(volby && volby.zadost);
    if (KATEGORIE.indexOf(f.kategorie) < 0) e.kategorie = 'Vyberte, jestli jde o přihlášku dospělého, nebo mladého hasiče.';
    if (!t('jmeno')) e.jmeno = 'Vyplňte jméno.';
    if (!t('prijmeni')) e.prijmeni = 'Vyplňte příjmení.';
    const r = rc(f.rc); if (!r.ok) e.rc = r.chyba;
    const kch = kategorieChyba(f.kategorie, r); if (kch) { e.kategorie = kch; e.rc = kch; }
    if (r.ok && r.vek < 3 && !kch) e.rc = 'Mladým hasičem může být dítě od 3 let (stanovy SH ČMS).';
    if (!jeCR(f.prislusnost) && !f.trvalyPobyt) e.trvalyPobyt = 'Členem SH ČMS může být občan ČR nebo cizinec s povolením k trvalému pobytu v ČR – potvrďte ho.';
    if (!t('ulice')) e.ulice = 'Vyplňte ulici a číslo popisné.';
    if (!t('obec')) e.obec = 'Vyplňte obec.';
    if (!/^\d{3}\s?\d{2}$/.test(t('psc'))) e.psc = 'PSČ má pět číslic.';
    if (!TEL.test(t('telefon'))) e.telefon = 'Vyplňte telefon (aspoň 9 číslic).';
    if (!/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(t('email'))) e.email = 'Vyplňte platný e-mail.';
    if (f.kategorie === 'mladý hasič') {
      if (!t('zzJmeno')) e.zzJmeno = 'Vyplňte jméno a příjmení zákonného zástupce.';
      const zn = new Date(t('zzNarozeni'));
      if (!t('zzNarozeni') || isNaN(zn) || (Date.now() - zn.getTime()) < 18 * 365.25 * 864e5) e.zzNarozeni = 'Vyplňte datum narození zákonného zástupce (musí být zletilý).';
      if (!TEL.test(t('zzTelefon'))) e.zzTelefon = 'Vyplňte telefon zákonného zástupce.';
    }
    if (f.prestup && !(f.prestupSbor === 'jiny' ? t('prestupJiny') : t('prestupSbor'))) e.prestupSbor = 'Vyberte sbor, ze kterého přestupujete.';
    if (t('motivace').length > MOTIVACE_MAX) e.motivace = 'Motivační dopis může mít nejvýš ' + MOTIVACE_MAX + ' znaků.';
    if (zadost && f.kategorie === 'dospělý' && t('motivace').length < 20) e.motivace = 'Napište pár vět, proč se chcete stát členem sboru.';
    if (zadost && !f.fotka) e.fotka = 'Přiložte fotku (obličej zepředu, stačí z mobilu).';
    if (!f.souhlas) e.souhlas = 'Bez souhlasu se zpracováním osobních údajů přihlášku podat nejde.';
    return e;
  }
  /** Vyčištěné údaje pro PDF i server (rodné číslo s lomítkem, PSČ „252 04“). Volat až po kontrola() bez chyb. */
  function udaje(f, sbor, regCislo) {
    const r = rc(f.rc), t = k => String(f[k] || '').trim(), psc = t('psc').replace(/\s/g, ''), kat = KATEGORIE.indexOf(f.kategorie) >= 0 ? f.kategorie : r.kategorie, mh = kat === 'mladý hasič';
    return { kategorie: kat, sbor: sbor, regCislo: String(regCislo || '').trim(), jmeno: t('jmeno'), prijmeni: t('prijmeni'), rc: r.cislo, ulice: t('ulice'), obec: t('obec'), psc: psc.slice(0, 3) + ' ' + psc.slice(3),
      prislusnost: t('prislusnost') || 'ČR', telefon: t('telefon'), email: t('email').toLowerCase(), sportovec: f.sportovec === true ? true : f.sportovec === false ? false : null, /* null = rozhodne sbor při přijetí */
      zzJmeno: mh ? t('zzJmeno') : '', zzNarozeni: mh ? t('zzNarozeni') : '', zzTelefon: mh ? t('zzTelefon') : '',
      prestup: !!f.prestup, prestupZ: f.prestup ? (f.prestupSbor === 'jiny' ? t('prestupJiny') : t('prestupSbor')) : '', souhlas: !!f.souhlas,
      motivace: t('motivace').slice(0, MOTIVACE_MAX), datumVyboru: t('datumVyboru'), trvalyPobyt: !jeCR(f.prislusnost) && !!f.trvalyPobyt };
  }

  /* ---------- načtení knihoven a souborů ---------- */
  const nactene = {};
  function knihovna(jm) {
    if (koren[jm]) return Promise.resolve(koren[jm]);
    const k = KNIHOVNY.find(x => x[0] === jm);
    if (!nactene[jm]) nactene[jm] = new Promise((ok, chyba) => {
      const sc = document.createElement('script'); sc.src = k[1]; sc.integrity = k[2]; sc.crossOrigin = 'anonymous';
      sc.onload = () => koren[jm] ? ok(koren[jm]) : chyba(new Error('Knihovnu ' + jm + ' se nepodařilo načíst.'));
      sc.onerror = () => { nactene[jm] = null; chyba(new Error('Knihovnu pro PDF se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.')); };
      document.head.appendChild(sc);
    });
    return nactene[jm];
  }
  const soubor = cesta => fetch(cesta, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error('Šablonu přihlášky se nepodařilo načíst (' + r.status + ').'); return r.arrayBuffer(); });

  /* ---------- vyplnění šablony ----------
   * d = { kategorie, sbor, regCislo (registrační číslo sboru), jmeno, prijmeni, rc, ulice, obec, psc, prislusnost, telefon, email, sportovec (bool),
   *       zzJmeno, zzNarozeni (YYYY-MM-DD), zzTelefon, prestupZ } */
  async function vyplnit(sablona, pismo, d, PDFLib, fontkit, koncept) {
    const doc = await PDFLib.PDFDocument.load(sablona);
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(pismo, { subset: true });
    const form = doc.getForm(), mh = d.kategorie === 'mladý hasič';
    const pole = (jmena, hodnota, velikost) => {
      const jm = [].concat(jmena).find(n => { try { form.getTextField(n); return true; } catch (e) { return false; } });
      if (!jm) return;
      const tf = form.getTextField(jm); tf.setFontSize(velikost || 10); tf.setText(String(hodnota || '').slice(0, 120));
    };
    pole('název SDH', String(d.sbor || '').replace(/^SDH\s+/i, ''));
    pole('číslo člena', d.regCislo); // políčko „Evidenční číslo“ vedle názvu sboru = registrační číslo sboru
    pole('titul, jméno, příjmení, titul', [d.jmeno, d.prijmeni].filter(Boolean).join(' '), 11);
    pole(['RČ člena', 'RČ'], d.rc, 11);
    pole(['trv. bydliště člena', 'trvalé bydliště člena'], d.ulice);
    pole(['trv. bydliště člena 2', 'trvalé bydliště člena 2'], d.obec);
    pole('PSČ', d.psc);
    pole('Státní příslušnost', d.prislusnost || 'ČR');
    pole('Email', d.email, 9);
    pole('Tel', d.telefon);
    if (mh) { pole('zák. zástupce', d.zzJmeno); pole('Datum narození zák. zástupce', datumCz(d.zzNarozeni)); pole('telefon na zák. zástupce', d.zzTelefon); }
    if (d.prestupZ) pole('původní SDH', d.prestupZ, 8);
    sportovecADatum(form, d);
    // u MH „Dne“ zůstává prázdné – vyplní se na papíře
    form.updateFieldAppearances(font);
    if (!koncept) form.flatten();
    doc.setTitle('Přihláška člena SH ČMS – ' + [d.jmeno, d.prijmeni].join(' '));
    return doc.save();
  }
  /** Sportovec (ANO / NE, null = nechat prázdné) a datum schválení výborem SDH (YYYY-MM-DD). */
  function sportovecADatum(form, d) {
    if (d.sportovec === true || d.sportovec === false) { try { const rg = form.getRadioGroup('Sportovec'), volba = rg.getOptions().find(o => (d.sportovec ? /ano$/i : /ne$/i).test(o)); if (volba) rg.select(volba); } catch (e) {} }
    if (d.datumVyboru) { try { const tf = form.getTextField('Datum schválení VV SDH'); tf.setFontSize(10); tf.setText(datumCz(d.datumVyboru)); } catch (e) {} }
  }
  async function pdf(d, zaklad, volby) {
    const z = zaklad || '';
    const [PDFLib, fontkit, sablona, pismo] = await Promise.all([knihovna('PDFLib'), knihovna('fontkit'), soubor(z + SABLONA[d.kategorie]), soubor(z + PISMO)]);
    return vyplnit(sablona, pismo, d, PDFLib, fontkit, !!(volby && volby.koncept));
  }
  /** Koncept přihlášky (nezploštělý formulář) → doplní sportovce a datum výboru a zploští k tisku. Zploštělé PDF (starší přihlášky) vrátí, jak je. */
  async function dokoncit(bajty, d, zaklad) {
    const [PDFLib, fontkit, pismo] = await Promise.all([knihovna('PDFLib'), knihovna('fontkit'), soubor((zaklad || '') + PISMO)]);
    const doc = await PDFLib.PDFDocument.load(bajty), form = doc.getForm();
    if (!form.getFields().length) return bajty;
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(pismo, { subset: true });
    sportovecADatum(form, d || {});
    form.updateFieldAppearances(font);
    form.flatten();
    return doc.save();
  }
  /** Fotka v prohlížeči: delší strana max. 1200 px, JPEG 85 %. Překreslení do canvasu zahodí EXIF včetně GPS. → { data (base64), nahled (data URL) } */
  function zmensitFoto(f, max) {
    const m = max || 1200;
    return new Promise((ok, ko) => {
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => {
        const k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        const du = c.toDataURL('image/jpeg', 0.85); URL.revokeObjectURL(url);
        ok({ data: du.split(',')[1], nahled: du });
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Fotku se nepodařilo otevřít. Uložte ji jako JPG a zkuste to znovu.')); };
      img.src = url;
    });
  }
  function stahnout(bajty, nazev, typ) {
    const url = URL.createObjectURL(new Blob([bajty], { type: typ || 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  const doBase64 = bajty => { let s = ''; const b = new Uint8Array(bajty); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const zBase64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));

  /* ---------- QR platba ---------- */
  // české číslo účtu → IBAN (CZkk BBBB PPPPPP CCCCCCCCCC)
  function iban(ucet) {
    const m = String(ucet || '').replace(/\s/g, '').match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);
    if (!m) return '';
    const bban = m[3] + (m[1] || '').padStart(6, '0') + m[2].padStart(10, '0');
    return 'CZ' + String(98 - mod(bban + '123500', 97)).padStart(2, '0') + bban; // „CZ00“ → 12 35 00
  }
  function spd(ucet, castka, vs, zprava) {
    const i = iban(ucet); if (!i) return '';
    const msg = String(zprava || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[*]/g, ' ').slice(0, 60);
    return 'SPD*1.0*ACC:' + i + (castka ? '*AM:' + Number(castka).toFixed(2) : '') + '*CC:CZK' + (vs ? '*X-VS:' + String(vs).replace(/\D/g, '').slice(0, 10) : '') + (msg ? '*MSG:' + msg : '');
  }
  // QR jako obrázek (data URL) – stránka ho vloží do <img>, bez vkládání HTML
  async function qrObrazek(text) { const q = (await knihovna('qrcode'))(0, 'M'); q.addData(text); q.make(); return q.createDataURL(6, 8); }

  const api = { rc, maska, datumCz, jeCR, kontrola, kategorieChyba, udaje, pdf, vyplnit, dokoncit, zmensitFoto, stahnout, doBase64, zBase64, iban, spd, qrObrazek, KATEGORIE, MOTIVACE_MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else koren.OSH_PRIHLASKA = api;
})(typeof window !== 'undefined' ? window : globalThis);
