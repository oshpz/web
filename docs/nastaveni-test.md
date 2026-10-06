# Nastavení testovacího prostředí

Hodnoty pro konfiguraci skriptu (B2). Nejsou tajné, jen ID.

domena: oshpz.cz
ucet_aplikace: aplikace@oshpz.cz
skupina_spravcu: spravci@oshpz.cz

## Disk
sdileny_disk_test: OSHPZ – TEST
sdileny_disk_test_id: 0ANaj4Bv5hwLBUk9PVA
slozka_organy: Orgány OSH PZ
organy: VV, OKRR, OORM, OORS, OORB, OORV, OSP

## Pojmenování souborů
Závazné (rozhodnuto 2. 10. 2026):
- `ZKRATKA RRRRMMDD Název` – např. VV 20250115 Zápis z jednání
- `ZKRATKA RRRR Název` – jen rok, když není konkrétní datum, např. VV 2025 Plán činnosti
Starší tvar `ZKRATKA RRMMDD Název` skript ještě přijme, ale nahlásí ho k přejmenování.
Zkratka = název složky orgánu.

## Kalendář
kalendar_test: OSHPZ – TEST
kalendar_test_id: c_fc2074828901426d752a8489df57f1a88ce228719f9d4db3cc78a4c79ef65cee@group.calendar.google.com

## GitHub
organizace: oshpz
repozitar: oshpz/web
ucet: oshpz-web (web@oshpz.cz)
pages_default: https://oshpz.github.io/web/

## Ještě doplnit
- tabulka_data_test_id (B1)
- subdoména test.oshpz.cz (P5)

## API (Apps Script webová aplikace)
- URL: https://script.google.com/macros/s/AKfycbz175mnWiIWxmQbf9lRKkL8rNHIZzpBKq9p_B85IzVsYZhTgQYSSROeZiLGprEnNodA/exec
- Tabulka OSH data TEST: 1efB7L11PVpybZi_j-YILtJ_U3sCP58ESg3eKqKJP0Tg

## Ostrá verze – sdílené disky
- **VEŘEJNÉ** (už existuje): složka „Orgány OSH PZ“ s podsložkami orgánů. Sdílení odkazem povoleno. `DISK_ID` v listu Nastavení ostré tabulky = ID disku VEŘEJNÉ.
- **INTERNÍ**: zůstává uzavřený (bez sdílení mimo organizaci). Aplikace do něj nesahá.
- Soubory na VEŘEJNÉ nejsou veřejné, dokud je někdo neschválí – do té doby je vidí jen členové disku.
