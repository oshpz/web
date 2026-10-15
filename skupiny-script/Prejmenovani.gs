/**
 * Přejmenování sboru (např. na žádost sboru kvůli záměně s jiným subjektem).
 *
 * Co dělá podle PREJMENOVANE_SBORY a PREJMENOVANE_SKUPINY:
 *  - v obou tabulkách (Skupiny OSH a OSH data TEST) přepíše ve všech listech sloupce Sbor a Pořadatel
 *    („SDH Starý“, „Starý“ i „SDH Starý (10. okrsek)“); list Protokol a odpovědi formuláře nechá,
 *  - po ruční změně adresy skupiny v Admin konzoli (stará adresa zůstane jako alias) přepíše sloupec Skupina
 *    („sdh-stary“ i „sdh-stary@oshpz.cz“) – jinak by synchronizace skupin chtěla založit starou adresu znovu,
 *  - přejmenuje Google skupinu sboru (název a popis),
 *  - obnoví seznam sborů ve formuláři kontaktů. Starší odpovědi se starým názvem se dál párují (posledniOdpovedi_).
 *
 * Spouštět z editoru: nejdřív prejmenovatNahled (nic nemění, vše zapíše do Protokolu), pak prejmenovatProvest.
 * Opakované spuštění nic nepokazí – co už je přejmenované, přeskočí.
 */

const PREJMENOVANE_SBORY = {
  'SDH Slapy': 'SDH Slapy nad Vltavou' // 15. 10. 2026 na žádost sboru (záměna se SDH Slapy u Tábora)
};
// Adresy skupin změněné ručně v Admin konzoli (bez domény).
const PREJMENOVANE_SKUPINY = {
  'sdh-slapy': 'sdh-slapy-nad-vltavou' // 15. 10. 2026, sdh-slapy@ zůstává jako alias
};

function prejmenovatNahled() { prejmenovat_(true); }
function prejmenovatProvest() { prejmenovat_(false); }

function prejmenovat_(nanecisto) {
  const log = protokol_(nanecisto);
  try {
    const tabulky = [tabulka_(), SpreadsheetApp.openById(KONT.OSH_DATA_ID)];
    const preskocit = [CFG.LOG, KONT.LIST_ODPOVEDI];
    let zmen = 0;
    Object.keys(PREJMENOVANE_SKUPINY).forEach(stara => {
      const nova = PREJMENOVANE_SKUPINY[stara];
      tabulky.forEach(ss => ss.getSheets().filter(sh => preskocit.indexOf(sh.getName()) < 0 && sh.getLastRow() > 1).forEach(sh => {
        const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim());
        h.forEach((nazev, c) => {
          if (nazev !== 'Skupina') return;
          const rng = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = rng.getValues();
          let n = 0;
          v.forEach(r => { const t = String(r[0]).trim().toLowerCase(), [jm, dom] = t.split('@'); if (jm === stara) { r[0] = nova + (dom ? '@' + dom : ''); n++; } });
          if (!n) return;
          log('přejmenovat v tabulce', '', ss.getName() + ' › ' + sh.getName() + ' › Skupina: ' + n + '× ' + stara + ' → ' + nova);
          zmen += n;
          if (!nanecisto) rng.setValues(v);
        });
      }));
    });

    Object.keys(PREJMENOVANE_SBORY).forEach(stary => {
      const novy = PREJMENOVANE_SBORY[stary];
      const zaklad = s => s.replace(/^SDH\s+/i, '').trim();
      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const vzor = new RegExp('^(SDH\\s+)?' + esc(zaklad(stary)) + '(\\s*\\(.*\\))?$');

      tabulky.forEach(ss => ss.getSheets().filter(sh => preskocit.indexOf(sh.getName()) < 0 && sh.getLastRow() > 1).forEach(sh => {
        const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x => String(x).trim());
        h.forEach((nazev, c) => {
          if (nazev !== 'Sbor' && nazev !== 'Pořadatel') return;
          const rng = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = rng.getValues();
          let n = 0;
          v.forEach(r => { const t = String(r[0]).trim(), m = t.match(vzor); if (m) { r[0] = (m[1] ? 'SDH ' : '') + zaklad(novy) + (m[2] || ''); n++; } });
          if (!n) return;
          log('přejmenovat v tabulce', '', ss.getName() + ' › ' + sh.getName() + ' › ' + nazev + ': ' + n + '× ' + stary + ' → ' + novy);
          zmen += n;
          if (!nanecisto) rng.setValues(v);
        });
      }));

      const s = nactiSbory_().find(r => r.sbor === stary || r.sbor === novy);
      if (!s) { log('skupina nenalezena', '', 'v listu Sbory není ' + stary + ' ani ' + novy); return; }
      const g = AdminDirectory.Groups.get(s.email);
      if (g.name !== novy) {
        log('přejmenovat skupinu', s.email, g.name + ' → ' + novy);
        zmen++;
        if (!nanecisto) AdminDirectory.Groups.patch({ name: novy, description: String(g.description || '').split(g.name).join(novy) }, s.email);
      }
    });

    if (!nanecisto && zmen) {
      const it = formular_().getItems(FormApp.ItemType.LIST).find(i => i.getTitle() === OT.sbor);
      if (it) { it.asListItem().setChoiceValues(sboryProFormular_()); log('formulář', '', 'seznam sborů obnoven'); }
    }
    log('HOTOVO', '', zmen ? zmen + (nanecisto ? ' změn k provedení – spusťte prejmenovatProvest' : ' změn provedeno') : 'nic k přejmenování');
  } catch (e) {
    log('CHYBA', '', String(e && e.message || e));
    log.flush();
    throw e;
  }
  log.flush();
}
