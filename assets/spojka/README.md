# Spojka – logo a ikony (návrh 2a)

Aplikace OSH Praha-západ pro okres, sbory a veřejnost. Název podle půlspojky: dvě půlky spojují okres (červená) a sbory (modrá).

## Barvy
| Role | Hex | Použití |
| --- | --- | --- |
| Okres | `#ec3013` | levá půlka, správa okresu |
| Sbory | `#2b4fb0` | pravá půlka, portál sborů (= `oklch(46% 0.16 265)`) |
| Inkoust | `#201e1d` | text loga, jednobarevná verze |
| Podklad | `#f3f2f2` | |

## Soubory
**logo/** – slovo „Sp◯jka“, písmo Archivo 800 převedené na křivky (font netřeba)
- `spojka-barevne` – hlavní logo (web, e-maily, PDF): inkoust + červená/modrá půlka
- `spojka-mono`, `spojka-bila` – jednobarevně (tisk, razítko / na tmavém a fotce)
- `spojka-okres`, `spojka-sbory` – bílé do hlaviček: vlastní půlka plná, druhá na 40 %
- `*-osh` – s podtitulem „OSH Praha-západ“
- PNG v šířce 600 a 1200 px (e-maily 600 px zobrazit na 300 px)
- `spojka-email-600.png` – barevné logo na **neprůhledném bílém** podkladu pro patičku e-mailů (zobrazit na 170 px); v tmavém režimu pošty by průhledné PNG s tmavým písmem zmizelo

**ikony/**
- `ikona-okres|sbory|web` – ikona aplikace (SVG + PNG 180 Apple, 192, 512 PWA)
- `favicon-okres|sbory|web` – ikona v prohlížeči (SVG, ICO 16/32/48, PNG)
- `znak-barevny`, `znak-mono` – celý znak bez podkladu

**spojka-logo.js** – stejné logo jako vektor pro pdf-lib (`SpojkaLogo.doPdf`) a data pro web.
**manifest.webmanifest** – instalace aplikace na telefon (start = Aplikace OSH); je v kořeni webu (`/manifest.webmanifest`, relativní cesty – sedí na test.oshpz.cz i na ostrém webu).

## Pravidla
- Znak v textu je vždy silný (jako tahy písmen), samostatné ikony mají tenčí čáru – neprohazovat.
- Okolo loga volné místo aspoň výšky zubu (≈ 1/4 výšky „o“). Nejmenší velikost slova 16 px / 6 mm.
- Půlky nerozdělovat jinak: okres = vždy levá červená, sbory = vždy pravá modrá. Barvy neměnit, logo nestínovat, neotáčet.
- Na červeném / modrém podkladu jen `bila`, `okres`, `sbory`.
- **Organizace je OSH, Spojka je nástroj.** Ve výstupech OSH (PDF, e-maily) patří do hlavičky logo OSH, Spojka jen do patičky („Vytvořeno v aplikaci Spojka“, znak 10–12 pt).
- Při nové identitě od grafika se vymění jen písmo a odstíny; tvar znaku zůstává.
