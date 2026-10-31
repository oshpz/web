# Cvičné otázky ZHVB ve Vzdělávání – zadání pro Claude Code (Claude Design, 31. 10. 2026)

Zdroj: Rámcové OZ ZHVB 2026/27 (ÚORM, schváleno 19. 3. 2026), `docs/pravidla`. Okresní OZ ani směrnice OSH PZ obsah stanovišť nemění (jen termín, místo a kategorie).

## Data
`data/zhvb-otazky.js` (přiložený) = `window.OSH_ZHVB` ve stejném tvaru jako sady z `?co=web` → `testy` (`kod`, `nazev`, `otazek`, `otazky[{ id, okruh, t, m[4], s, zdroj }]`) a navíc:
- `obr` – cesta k obrázku (značka, příroda, uzel, PO značka) – 89 ze 126 otázek,
- `kat` – kategorie, pro které otázka platí (`P` přípravka, `M` mladší, `S` starší, `D` dorost) podle rozsahů v OZ (např. značky 1–10 / 1–15 / 1–25 / 1–40),
- `kategorie` – seznam kategorií pro výběr.

Statická veřejná data (ne server, ne `data/web.json`) – soubor je veřejný úmyslně, jde o veřejné OZ. Při novém ročníku OZ ho přegenerovat.

## Obrázky – vyříznout z PDF do `assets/zhvb/`
Z `docs/pravidla/…rámcové OZ ZHVB 2026-2027.pdf` (Chrome přes DevTools jako `nastroje/navody/snimky.mjs`, nebo pdftoppm + ořez):
- `znacka-01.png` … `znacka-40.png` – Obr. 2, str. 17 PDF (vektor – vykreslit stránku ve 3× a ořezat mřížku),
- `priroda-01.png` … `priroda-24.png` – Obr. 3, str. 19–21 (vložené rastry, pořadí podle čísel pod obrázky),
- `uzel-1.png` … `uzel-5.png` – Obr. 4, str. 23, pořadí: tesařský, plochá spojka, lodní, osmičkové oko, liščí,
- `po-01.png` … `po-20.png` – Obr. 9, str. 32.
Čtverec, bílé pozadí, **bez čísla a bez popisku** (jinak je odpověď vidět), PNG max 400 px, celkem do ~1,5 MB. Ověř ručně několik kusů proti tabulce názvů v OZ – číslo obrázku musí sedět s `id`.

## Web – stránka `?stranka=procvicovani`
1. Načti `data/zhvb-otazky.js` (skript v `<helmet>`, CSP – vlastní doména) a přidej sadu do seznamu sad (`TSL`) jako první, kód `ZHVB`; rozcestník Vzdělávání: řádek „Cvičné otázky ZHVB – příprava hlídek mladých hasičů“.
2. **Výběr kategorie** nad režimy jako záložky (Přípravka / Mladší / Starší / Dorost, s počtem otázek), uložit do localStorage `oshpz-procvicovani` (klíč `zhvbKat`, výchozí Mladší). Filtr `q.kat.includes(kat)` platí pro Učit se, Test nanečisto i Všechny otázky. Okruhy (K2…K7) zůstávají jako dnes.
3. **Obrázek** u otázky (`q.obr`): nad textem otázky, 160 px čtverec (telefon 140 px), `object-fit:contain`, bílé pozadí, 2px rámeček `--color-divider`, `alt` = „Obrázek k otázce“ (ne odpověď!). Ve Všech otázkách malý 64 px vlevo u řádku. Obrázky se **nebarví do šeda** (značky mají barvy).
4. Test nanečisto: 20 otázek z kategorie, bez hranice úspěchu (`otazek` bez `maxChyb`) – výsledek „x správně z 20“.
5. Zdroj pod odpovědí jako u ostatních sad („Rámcové OZ ZHVB 2026/27, Obr. 2, značka č. 25“).
6. Pod nadpisem odkaz na OZ v Dokumentech (je-li zveřejněné).

## Neřeší (stanoviště, která se nedají procvičit volbou)
Hod na cíl, brannost, vázání uzlů (jen poznávání), trojúhelník hoření, záchranářská ulička, evakuační zavazadlo a rizika v domácnosti (jen obrázky bez textu v OZ – případně později), azimuty.

## Dál
Návod v `navody.html` (sekce Web – procvičování), scénář v `docs/testovani.html`, snímky ze smyšlených dat (zde ale jen veřejné OZ – v pořádku). Zapiš do `docs/stav.md` a `docs/claude-design-zadani.md` (Změny v šablonách).
