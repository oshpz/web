# Úkol 6 – kontrola 2. vlny (Claude Design, 31. 10. 2026)

Odchylky 2. vlny ze zadání (rozbalení řádku u sboru a přestupů, stav = krok, záložky, souběh jako typ, `.sz-filtry--bez`, pomocníci) **schvaluji**. Opravy 1. vlny jsou v kódu, ale **snímky 1. vlny jsou staré** (okres/sbor Kalendář a Dokumenty, PC i telefon – mezititulek malý, názvy souborů, „SO ·“ / „09:00“). Přefoť je.

Opravit:

1. **Samotné hledání na vlastním řádku** (`.sz-filtry--bez`, Žádosti, Příspěvky, Změny, Přihlášky, Přestupy): na počítači zbytečný prázdný řádek s polem vpravo. Když nejsou výběry, dej hledání do řádku záložek vpravo (280 px, výška 40 px jako záložky); když se záložky nevejdou, zalomí se hledání pod ně vlevo. Telefon beze změny (pod záložkami přes celou šířku).
2. **Obsah nad seznamem u sboru** (Přihlášky členů, Přestupy): odkaz na přihlášku / přestup a „Nastavení přihlášek“ jsou nad seznamem, na telefonu seznam začíná až pod druhou obrazovkou. Přesuň tyto bloky **pod seznam** (nadpis „Odkaz pro uchazeče“ / „Nastavení“), nad seznamem nech jen hlavičku (`.sz-hlava`) a záložky. Úvodní popis zkrať na max. 2 řádky (72 znaků); postup krok za krokem patří do Návodů (odkaz „Jak to funguje“ v popisu).
3. **Změny sborů – popis „podal starosta@example.com“:** v řádku jméno (z Kontaktů sborů / Uživatelů, `sJmenem_`), e-mail až v detailu. Totéž všude, kde je v popisu e-mail.
4. **Záložky na telefonu přetékají** (Žádosti: „Schválené 0“ uříznuté): je to vodorovný posun podle specifikace, ale není to poznat. Přidej vpravo `padding-right:16px` na konci řady a záložky s počtem 0 zobrazuj až za záložkami s nenulovým počtem kromě první (pořadí zůstává, jen 0 odsunuté). Pokud to komplikuje URL záložek, stačí padding.

Po opravě snímky do `docs/claude-design/seznamy/` (1. i 2. vlna, PC i telefon) a pokračuj 3. vlnou (Soutěže, Školení, Jednání VV, Rezervace / výpůjčky) podle `seznamy-vzor.md` a tabulky Typy záznamů. Odchylky zapiš do zadání jako dosud.
