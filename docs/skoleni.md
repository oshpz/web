# Školení a odbornosti (B18) – návrh a stav

*26. 10. 2026 · prototyp v TESTu, čeká na odborné rady a VV (otázky níže). Vzhled podle stávajícího stylu (Modernist), novou identitu (F8) dostane s ostatními obrazovkami.*

## Co modul řeší

| Část | Kdo | Co umí |
|---|---|---|
| **Školení okresu** | okres (role Školení) | Vypsání kurzu, obnovy kvalifikace, semináře nebo zkoušky odborností MH. Školení je akce v kalendáři (Typ školení): od otevření přihlášek se zobrazí sborům, na webu a v Google Kalendáři. Kapacita, uzávěrka, poplatek, lektor, materiály. Prezenční listina v PDF. |
| **Přihlášky ze sborů** | sbor (portál → Členové → Školení) | Výběr členů ze Seznamu členů (B17), výjimečně člověka mimo seznam. Aplikace pustí jen vhodné (MH × dospělí, nejnižší věk kvalifikace). U zkoušky s víc odbornostmi sbor u každého dítěte zvolí, kterou skládá. Odhlášení do začátku školení. |
| **Výsledky a kvalifikace** | okres | Po začátku školení u každého účastníka absolvoval / neuspěl / nepřišel (+ číslo osvědčení). **Vyhodnotit** zapíše absolventům kvalifikaci s platností (konec školení + platnost z katalogu); u obnovy starou ukončí. Sbory dostanou e-mail. |
| **Kvalifikace s platností** | okres, sbor jen své | Seznam kvalifikací (vedoucí mládeže, rozhodčí, hlavní vedoucí tábora, odbornosti MH…) s filtry Končí platnost / Propadlé. Ruční zápis kurzu jinde (kraj, ústředí) nebo staršího osvědčení. Sbor dostane e-mail **90 a 30 dní** před koncem platnosti. |
| **Web** | veřejnost | Stránka *Školení a odbornosti* (`?stranka=skoleni`): vypsaná veřejná školení (bez jmen účastníků) a katalog kvalifikací a odborností MH s odkazy na materiály. Odkazy z Mladí hasiči → Odbornosti a z Dokumentů. |
| **Procvičování (testy)** | veřejnost | **Zatím ne** – čeká na otázky od odborných rad (Q6). Na webu je místo označené Připravujeme. |

Odbornosti a specializace MH nemají vlastní mechanismus: jsou to kvalifikace s `Pro = MH` bez omezení platnosti a „zkouška odborností“ je školení druhu *zkouška*.

## Průběh

```
okres: Vypsat školení (koncept) → Otevřít přihlášky ──► kalendář, web, portál sborů, oznámení sborům (B5)
sbor:  Členové → Školení → Přihlásit členy (do uzávěrky a kapacity)
okres: Uzavřít přihlášky → Prezenční listina (PDF)
       po začátku: výsledky u účastníků → Vyhodnotit ──► Kvalifikace (+ e-mail sborům)
noc:   90 / 30 dní před koncem platnosti ──► e-mail sboru
```

## Data (tabulka OSH data)

| List | Obsah |
|---|---|
| **Druhy kvalifikací** | Katalog: kód, název, oblast, Pro (dospělí / MH), **platnost (roky)**, **min. věk**, garant (OORM, OORS…), odkaz na materiály, aktivní. Výchozí řádky vloží *Založit / doplnit strukturu* – jsou to **návrhy k ověření**. |
| **Školení** | Klíč Akce – ID (název, termín, místo, Pro koho jsou v listu Akce), druh, kvalifikace (u zkoušky víc kódů), Pro, garant, kapacita, uzávěrka, poplatek, lektor, materiály, stav. |
| **Účastníci školení** | Sbor, člen (ID ze Seznamu členů), jméno, příjmení, datum narození, odbornost, stav, číslo osvědčení. |
| **Kvalifikace** | Osoba (jméno, datum narození, sbor, ID člena), kód, získáno, **platí do**, číslo osvědčení, zdroj (školení / ručně), aktivní, upozorněno. |

Nastavení: `SKOLENI_UPOZORNIT_DNY` (90,30), `SKOLENI_VYMAZ_UCASTNICI_DNY` (1095), `SKOLENI_VYMAZ_KVALIFIKACE_DNY` (1825). Uživatelé: nový sloupec **Školení** (všechny / MH / dospělí).

Server `apps-script/Skoleni.gs` (akce `skoleniOkres`, `skoleni`, `skoleniUlozit`, `skoleniStav`, `skoleniVysledky`, `skoleniPrezence`, `kvalifikaceOkres`, `kvalifikaceUlozit`, sbor `skoleniSbor`, `skoleniPrihlasit`, `skoleniOdhlasit`; web v `?co=web` jako `skoleni` a `kvalifikace`) – popis v `docs/rozhrani.md`.

## Osobní údaje

- Ukládá se jen **jméno, příjmení, datum narození, sbor** a údaje o kvalifikaci. Žádné rodné číslo, adresa, telefon ani e-mail účastníka.
- Kvalifikace vidí okres (role Školení) a sbor jen u svých členů. Na webu nikdy jména účastníků ani držitelů – jen vypsaná školení a katalog (jméno lektora ano, stejně jako hlavní rozhodčí u soutěží).
- Lhůty výmazu (návrh): účastníci školení 3 roky po konání, kvalifikace 5 let po konci platnosti nebo ukončení. Mazání dělá noční údržba.
- Je to nová činnost zpracování – doplnit do záznamu o zpracování (G1, `docs/zpracovani-udaju.html`, činnost 9).

## Otázky pro odborné rady a VV

| # | Otázka | Kdo | Do té doby v aplikaci |
|---|---|---|---|
| Q1 | Kdo bude mít roli Školení (OORM pro MH, OORS / VV pro dospělé)? | VV | role dle listu Uživatelé |
| Q2 | Seznam kvalifikací a jejich **platnost** – vedoucí mládeže I.–III., instruktor, rozhodčí mládeže, rozhodčí PS, trenéři, strojník / velitel SH ČMS, preventista… | OORM, OORS, OORB, VV | návrh 5 let u vedoucích a rozhodčích |
| Q3 | Seznam **odborností a specializací MH**, které okres zkouší (a zda specializace mladších evidovat zvlášť). | OORM | strojník, zdravotník, preventista, kronikář, cvičitel, spojař, topograf |
| Q4 | **Nejnižší věk** u kvalifikací (instruktor od 15, vedoucí a rozhodčí od 18?). | OORM, OORS | VM III. 15 let, ostatní vedoucí, rozhodčí, HVT 18 let |
| Q5 | Evidovat kvalifikace získané **jinde** (kraj, ústředí) – zapisuje okres podle kopie osvědčení? Vést i čísla osvědčení? | VV | ano, ručně okres |
| Q6 | **Cvičné testy** na webu: dodají odborné rady otázky (a smíme použít oficiální testy SH ČMS)? | OORM, OORV | jen místo „Připravujeme“ |
| Q7 | Lhůty výmazu (3 roky účastníci, 5 let kvalifikace) a právní základ (oprávněný zájem – vedení kvalifikací podle směrnic SH ČMS). | VV | návrh v Nastavení |
| Q8 | Poplatky za školení: jen informace (dnes), nebo i QR platba a evidence zaplacení jako u odvodů? | VV | jen informace |

## Co udělat v TESTu

1. **Nasadit**: `./nasadit.sh server test` a `./nasadit.sh test` (Claude Code).
2. **Tabulka OSH data → Založit / doplnit strukturu** – přibudou listy Druhy kvalifikací, Školení, Účastníci školení, Kvalifikace, sloupec Uživatelé › Školení a tři klíče v Nastavení; Druhy kvalifikací se naplní návrhem.
3. V listu **Uživatelé** dát testerům do sloupce **Školení** hodnotu `všechny` (nebo `MH` / `dospělí`).
4. Zkouška bez sborů: menu **OSH data → Školení: vložit testovací školení a kvalifikace** (potřebuje testovací členy – *Členové: vložit testovací členy*). Uklidí je *Úklid testů*.
5. Scénáře **S17** (sbor) a **O14** (okres) v `docs/testovani.html`.

## Další kroky (po rozhodnutí)

- Cvičné testy (Q6): otázky jako `data/testy/<kód>.json`, procvičování na webu bez přihlášení, bez ukládání výsledků.
- Sbor nahraje kopii osvědčení z kurzu jinde → okres potvrdí (dnes jen e-mailem a ručním zápisem).
- Potvrzení o absolvování / osvědčení v PDF z aplikace (až s identitou F8).
- QR platba poplatku (Q8).
