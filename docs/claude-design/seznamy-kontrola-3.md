# Úkol 6 – kontrola 3. vlny (Claude Design, 31. 10. 2026)

Opravy 2. vlny a přefocené snímky 1. a 2. vlny jsou v pořádku. Odchylky 3. vlny ze zadání (záložky Soutěží, Poháry jako záložka, Přihlásit u sboru, K vyhodnocení, rozbalení rezervací a zápůjček) **schvaluji**. Opravit:

1. **Řada filtrů s hledáním** (Soutěže okresu i sboru): šest výběrů zaplní řádek a hledání visí samo na dalším řádku vpravo. Pravidlo pro všechny seznamy: v řadě `.sz-filtry` je **hledání první** (vlevo, `flex:1 1 240px`), za ním **nejvýš 3 výběry** (Soutěže: rok, typ, kategorie), ostatní pod tlačítkem **„Další filtry (n)“** (40 px, ghost; rozbalí druhou řadu). Na telefonu beze změny („Filtry (n)“ + hledání). Zapiš do `seznamy-vzor.md` (řádek `.sz-filtry`).
2. **Školení sboru (PC):** nad hlavičkou je asi 130 px prázdného místa (pravděpodobně prázdný blok nebo lišta zpráv bez obsahu). Hlavička má začínat stejně vysoko jako na ostatních obrazovkách.
3. **Školení sboru – odznak bez kroku:** v podnabídce je u Školení odznak 1, ale žádný řádek nemá stav = krok. Řádek, který odznak počítá, má `ceka` a krok **Přihlásit členy** (nebo odznak nepočítat). Pravidlo: co počítá odznak, je v seznamu vždy jako `ceka` v první záložce.
4. **Majetek a výpůjčky** neodpovídá vzoru:
   - hlavička: „Načíst znovu“ je obrysové tlačítko → ghost s ↻ jako jinde; **Předávací protokol** a **Nová výpůjčka** patří do `.sz-hlava` vpravo (podle otevřené části), ne na vlastní řádek nad záložkami;
   - části Přehled / Majetek / Výpůjčky / Osoby / Číselníky jsou dnes druhá řada tlačítek s počty v závorkách. Udělej z nich **podnabídku** jako Kalendář / Soutěže (bílá lišta pod hlavní navigací, F6) – pak nad seznamem zůstane jen jedna řada záložek;
   - prázdný stav: odsazení zarovnej s řádky (`.sz-prazdny` bez levého odsazení navíc, stejné jako u ostatních).
5. **Vybavení sboru (telefon):** stará hlavička – „Načíst znovu“ a „Půjčit vybavení“ vedle sebe nad popisem. Podle vzoru: H1 + ikona ↻ 44 px vpravo, popis, pod ním hlavní akce přes celou šířku.
6. **Popisy pod nadpisem** jsou na telefonu 3–4 řádky (Kalendář, Soutěže, Vybavení, Majetek). Zkrať na **max. 72 znaků**, zbytek do Návodů („Jak to funguje“). Návrhy:
   - Kalendář: „Akce okresu, termíny a soutěže. Propisuje se na web a do kalendáře.“
   - Soutěže (okres): „Od vypsání přes přihlášky a závod po výsledky na webu.“
   - Vybavení (sbor): „Vybavení, které okres půjčuje sborům. Jak to funguje“
   - Majetek: „Evidence majetku OSH – stejná data jako stará Evidence majetku.“
   - Jednání VV: „Hlasování per rollam a podklady k zasedáním. Platí poslední hlas.“
7. **Jednání VV – kotva:** u otevřeného hlasování je kotva termín konce, ale čte se jako datum jednání. Do `kotva2` dej „do 02:33“ (ne den v týdnu), aby bylo jasné, že jde o termín. Totéž u přihlášek se lhůtou.

Po opravě snímky 3. vlny do `docs/claude-design/seznamy/` (PC i telefon, u Majetku i podnabídka) a pokračuj 4. vlnou (tabulky: Seznam členů, Kvalifikace, Kontakty sborů, Záznam změn, Majetek – výška řádku 64 px, na telefonu jako `.sz-radek`, 1. sloupec = titulek, ostatní do popisu). Odchylky zapiš do zadání jako dosud.
