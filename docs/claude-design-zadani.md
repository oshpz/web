# Zadání pro Claude Design – kontrast a vzhled (F7)

Stav 17. 10. 2026. Projekt v Claude Design: „Redesign webu hasičů Praha západ“, repozitář `oshpz/web`, větev `main`.
Pravidla formátu a vzhledu jsou v `CLAUDE.md` (sekce Formát souborů `.dc.html`, Vzhled, Spolupráce s Claude Design).

## Než začneš: synchronizace

Od poslední práce v Claude Design (navigace správy okresu F6, 14. 10.) se šablony v repozitáři hodně změnily – viz seznam níže. 17. 10. přibyly role barev (F7): v šablonách se nepíše `var(--color-accent)`, ale `var(--color-brand)` (plochy, grafy, velký text) nebo `var(--color-action)` (text, odkazy, tlačítka, ovládací prvky).
**Pracuj jen nad aktuální větví `main`.** Starší kopie souborů v projektu Claude Design nepoužívej, jinak by se tyto změny ztratily.

Změny v šablonách od 14. 10. (zachovat):

| Soubor | Co přibylo nebo se změnilo |
| --- | --- |
| `index.html` | počty sborů, okrsků a členů z dat (`pocty.*`); blok „Chci se přidat“ na stránce sboru přepíná `prihlaskaOnline` / `prihlaskaPozdeji` (odkaz na kancelář místo ukázky); prázdné aktuality na úvodu (`newsHomeZadne`); kalendář: nadcházející nahoře, proběhlé pod „Proběhlo · měsíc“; třída `tap44` a pravidla 44 px pro záložky, řazení, legendu, filtry AZH |
| `Aplikace OSH.dc.html` | detail dokumentu: blok tlačítek zveřejněného dokumentu řídí `dk.zverejneny` (pole řídí `dk.locked`), tlačítko „Uložit změny“; obrazovka Moduly se skutečným stavem a v `LIVE_VIEWS`; tlačítko s názvem v první buňce klikacích řádků tabulek (klávesnice); zvonek portálu sboru 44 × 44 px; hlášky výpadku s `chyba` / `sit`; adresa pro příspěvky e-mailem v úvodu Příspěvků |
| `sbory-mapa.html` | skript přesunut do `sbory-mapa.js` (kvůli CSP) |
| `docs/*.dc.html`, `docs/plan.html` | doplněná CSP v `<head>` |

Nesahat: `support.js` (runtime), `data/*` (data webu, `data/web.json` zapisuje server), `apps-script/`, `skupiny-script/`.

## Úkol 1 – kontrast červené (WCAG AA) – hotovo 17. 10. (varianta A, viz `docs/revize-2026-10.md`)

Norma pro běžný text je 4,5 : 1, pro velký text (od 24 px, nebo 18,7 px tučně) 3 : 1. Spočítáno z tokenů v `_ds/…/styles.css`:

| Kombinace | Kontrast | Splňuje |
| --- | --- | --- |
| bílý text na `--color-accent` `#ec3013` | 4,20 : 1 | jen velký text |
| bílý text na `--color-accent-600` `#dd2b0f` | 4,74 : 1 | ano, těsně |
| bílý text na `--color-accent-700` `#ae1800` | 7,17 : 1 | ano |
| `#ec3013` jako text na pozadí `#f3f2f2` | 3,76 : 1 | jen velký text |
| `#ec3013` jako text na `--color-surface` `#eae9e9` | 3,47 : 1 | jen velký text |
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

## Výstup

- Návrh variant s ukázkou na obrazovkách: úvod webu, přihlášení, přehled správy okresu, detail dokumentu, portál sboru – na počítači i telefonu (pod 720 px).
- U zvolené varianty seznam změněných tokenů a tříd (`_ds/…/styles.css`, případně inline styly v šablonách).
- Do repozitáře změny převede Claude Code (stejně jako navigaci F6), aby se nepřepsaly novější úpravy. Drobné úpravy přímo v souborech jsou možné, jen nad aktuální `main` a se zachovanou strukturou šablon.
