/**
 * OSH data – členové orgánů pro web (list „Členové orgánů“).
 * Nový soubor „Organy“ ve stejném projektu.
 *
 * Jeden řádek = jeden člověk v jednom orgánu. Funkce vyplněná = vedení (např. „Předseda OKRR“), prázdná = člen.
 * Telefon a e-mail jdou na web jen při „Kontakt na web“ = ANO (souhlas se zveřejněním). Aktivní = NE → na webu není.
 * Web čte ?co=organy (5 min v mezipaměti, ruční úprava listu ji hned smaže).
 * Data převedl z dřívějšího webu jednorázový skript naplnitClenyOrganu (8. 10. 2026, už odstraněn).
 */

const LIST_ORGANY = 'Členové orgánů';
const ORGANY_PORADI = ['VV', 'OKRR', 'OORM', 'OORS', 'OORB', 'OORV', 'OSP'];

function organyVerejne_() {
  const c = CacheService.getScriptCache(), z = c.get('v_organy');
  if (z) return JSON.parse(z);
  const data = radky_(LIST_ORGANY).filter(r => r['Orgán'] && r['Jméno'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE')
    .map(r => {
      const kontakt = ano_(r['Kontakt na web']);
      return { organ: String(r['Orgán']).trim(), poradi: Number(r['Pořadí']) || 999, funkce: String(r['Funkce'] || '').trim(), jmeno: String(r['Jméno']).trim(),
        sbor: String(r['Sbor'] || '').trim(), tel: kontakt ? String(r['Telefon'] || '').trim() : '', email: kontakt ? String(r['E-mail'] || '').trim() : '', pozn: String(r['Poznámka'] || '').trim() };
    })
    .sort((a, b) => (ORGANY_PORADI.indexOf(a.organ) - ORGANY_PORADI.indexOf(b.organ)) || (a.poradi - b.poradi));
  try { c.put('v_organy', JSON.stringify(data), 300); } catch (e) {}
  return data;
}
