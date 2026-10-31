# Cvičné otázky ZHVB – kontrola (Claude Design, 31. 10. 2026)

Funkce i vyříznuté obrázky jsou v pořádku (značky, příroda, PO bez čísel a popisků, sedí s názvy). Opravit:

1. **Chyba v datech (moje):** otázky `K6P1`–`K6P4` (první pomoc pro přípravku a mladší, Obr. 10) mají `kat` P, M, S, D – podle OZ je plní jen **přípravka a mladší** (starší mají Obr. 11, dorost Obr. 12). V `data/zhvb-otazky.js` nastav u nich `"kat": ["P","M"]`. Počty pak: přípravka 34, mladší 48, starší 82, dorost 117.
2. **Telefon – okruhy:** 7–8 tlačítek okruhů zabere celou obrazovku. Pod 720 px je zobraz jako jeden výběr (`select`, 44 px, „Všechny okruhy“ + K2…K7), stejně jako filtry v aplikaci. Kategorie nech jako tlačítka, ale ve 2 sloupcích mřížky (`grid-template-columns:1fr 1fr`), ať se nelámou nepravidelně.
3. **Učit se – pruh „Zvládnuto“** ukazuje počet za vybraný okruh, ale popisek to neříká. Při vybraném okruhu piš „Zvládnuto 0 z 25 v okruhu K2 …“, jinak „… z 82“.

Pushni a aktualizuj snímky v `docs/claude-design/zhvb/` pod novými názvy (`*-v2.jpg`).
