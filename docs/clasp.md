# Apps Script přes clasp

Jednorázově (Mac, Terminál):

1. Node.js: `brew install node` (nebo instalátor z nodejs.org).
2. `npm install -g @google/clasp`
3. `clasp login` – přihlásit se účtem, pod kterým je skript nasazený.
4. Povolit API: https://script.google.com/home/usersettings → **Google Apps Script API: Zapnuto**.
5. ID skriptu: v editoru Apps Script → ⚙ **Nastavení projektu** → *ID skriptu*.
6. V repozitáři:
   ```
   cd ~/git/oshpz-web/apps-script
   cp .clasp.json.example .clasp.json   # vložit ID skriptu (scriptExtensions .gs = stahuje jako .gs, ne .js)
   clasp pull                           # stáhne živou verzi (pravda) – přepíše soubory ve složce
   git diff                             # zkontrolovat rozdíly proti repozitáři
   ```
7. ID nasazení: Apps Script → **Nasadit → Spravovat nasazení** → *ID nasazení* (začíná AKfycbz175mn…). Zapsané v `CLAUDE.md`.

V `VS Code` se `! příkaz` nespustí – `clasp login` spustí Claude a pošle odkaz k přihlášení.

Běžná úprava:
```
clasp push                                   # nahraje kód
clasp deploy -i <ID nasazení> -d "popis"     # nová verze na STEJNÉ adrese /exec
```
Ověření: `https://…/exec` vrátí `{"ok":true, "verze": …}`.

Skript v tabulce *Skupiny OSH* je propojený taky (10. 10. 2026): `skupiny-script/.clasp.json`, projekt „Skupiny OSHPZ“. Stačí `cd skupiny-script && clasp push -f` – webovou aplikaci nemá, nasazení není potřeba. Po přidání nových služeb (Formuláře, Disk, stahování z webu) je při prvním spuštění funkce v tabulce nutné povolit oprávnění.

`.clasp.json` obsahuje jen ID skriptu (není tajné). Přihlašovací `~/.clasprc.json` do repozitáře **nikdy** nedávat.
