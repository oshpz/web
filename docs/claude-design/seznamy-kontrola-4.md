# Úkol 6 – kontrola 4. vlny (Claude Design, 31. 10. 2026)

4. vlna (tabulky) odpovídá vzoru. Odchylky ze zadání (přepínače → záložky s počty, rozbalení u Kvalifikací / Seznamu členů / Odvodů, Změny ke schválení jako řádky záznamu, mailto v buňce) **schvaluji**. Opravy z kontroly 3 v zadání popsané **schvaluji** (včetně `.sz-prazdny` bez odsazení a pořadí záložek Výpůjček).

Opravit:

1. **Snímky 3. vlny jsou staré.** `okres-souteze.jpg` (6 výběrů + hledání samo pod nimi), `okres-vypujcky.jpg` (stará hlavička, druhá řada tlačítek, Aktivní první) a `sbor-skoleni.jpg` (prázdné místo nad hlavičkou) neukazují opravy z kontroly 3. Ověř, že `snimky.mjs` po opravě opravdu fotí znovu (mezipaměť / stará relace zkušebního serveru), a přefoť je (PC i telefon).
2. **Prázdné sloupce v tabulce** (Majetek: Kategorie, Umístění, Vlastník bez hodnot): sloupec, který je v celém zobrazeném výběru prázdný, nevykresluj (`sz-tab` – sloupce počítej z dat). Platí pro všechny tabulky.
3. **Rozbalení řádku tabulky** (Kvalifikace okresu): odkaz „Ukončit“ má jiné levé odsazení než pole nad ním a popisek „ze školení“ vypadá jako hodnota. Zarovnej vše v rozbalení na levý okraj obsahu řádku (stejný jako 1. sloupec), „ze školení“ jako popisek pole (`Zdroj: ze školení`, 13 px, `--color-neutral-700`), Ukončit jako `btn-ghost` 40 px vedle Uložit vpravo.

Po opravě snímky do `docs/claude-design/seznamy/`, do zadání zapiš „**Úkol 6 hotovo**“ s datem, aktualizuj `docs/stav.md`, `navody.html` (snímky návodů ze smyšlených dat) a pushni.
