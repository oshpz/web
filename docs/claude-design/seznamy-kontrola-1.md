# Úkol 6 – kontrola 1. vlny (Claude Design, 30. 10. 2026)

Snímky v `docs/claude-design/seznamy/` odpovídají variantě 6b. Odchylky z `docs/claude-design-zadani.md` (záložky Nadcházející / Proběhlé u okresu, rozbalení řádku u sboru, Nové / Všechny u dokumentů sboru, hledání, pomocné třídy, `--color-neutral-100` pod výběry, kostra) **schvaluji**. Opravit:

1. **Mezititulek skupiny** („Listopad 2026 3“) je malý a šedý. Podle specifikace `.sz-skupina`: název 18 px / 800 `--color-text`, počet 14 px `--color-neutral-700`, `padding:16px 0 8px`. Na telefonu 17 px.
2. **Kotva na telefonu:** „SO · 09:00“ se láme na dva řádky („SO ·“ / „09:00“). Na telefonu dej den a čas pod sebe bez tečky (`.sz-kotva-po` jako dva řádky: „SO“, „09:00“), nebo `white-space:nowrap` a 10 px. Preferuji pod sebe.
3. **Titulek dokumentu = název souboru** („OORM 2026 Směrnice hra plamen.pdf“). Orgán a datum už jsou v kotvě, na telefonu se titulek zkracuje. Titulek = název bez zkratky orgánu, data a přípony, první písmeno velké („Směrnice Hra Plamen“, „Zápis z jednání“). Celý název souboru do detailu (u okresu) nebo do `title` řádku.
4. **Typ v Kalendáři se liší mezi okresem a sborem** u stejné položky: okres „Akce okresu“ / „Termín“, sbor „Akce“ / „Uzávěrka“. Použij stejné hodnoty z pole `typ` všude (Akce okresu, Akce sboru, Soutěž, Školení, Termín).
5. **Dokumenty sboru – popis „nový“:** popis má nést údaje (typ dokumentu · PDF), ne stav. „Nový“ dej jako štítek stavu (`.sz-stitek--stav`, neutrální) ve sloupci stavu, na telefonu první ve štítcích.
6. **Celé názvy (varianta 7b, schváleno 30. 10.):** `.sz-titulek` se smí zalomit **nejvýš na 2 řádky** (`display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.3`), „…“ až na konci 2. řádku. Platí na počítači i telefonu. Mřížka, kotva vlevo a min. výška řádku zůstávají, řádek s dvouřádkovým titulkem je jen vyšší (`align-items:start` na telefonu, `center` na počítači). Celý název vždy i v `title` řádku. Do `seznamy-vzor.md` zapiš změnu v řádku `.sz-titulek`.

Po opravě nové snímky do `docs/claude-design/seznamy/` (stejné názvy) a pokračuj 2. vlnou (Žádosti, Příspěvky, Změny sborů, Přihlášky členů, Přestupy) podle `seznamy-vzor.md` a tabulky Typy záznamů v zadání. Odchylky zapiš do zadání jako u 1. vlny.
