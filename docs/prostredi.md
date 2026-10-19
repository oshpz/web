# Prostředí TEST a OSTRÝ provoz (L0)

Stejný kód běží ve dvou oddělených prostředích. Liší se jen konfigurací, kód se pro ostrý provoz neupravuje.

| | TEST | OSTRÝ provoz |
| --- | --- | --- |
| Web a aplikace | https://test.oshpz.cz | https://oshpz.cz (při souběhu se starým webem https://novy.oshpz.cz) |
| Repozitář GitHub | `oshpz/web` – vývoj, Pages z `main` | `oshpz/web-ostry` – jen hotová sestavení, Pages z `main` |
| Konfigurace webu | `prostredi/test.config.js` → `config.js` | `prostredi/ostry.config.js` → `config.js` v `web-ostry` |
| Apps Script | projekt v tabulce *OSH data TEST*, účet admin@ | projekt v ostré tabulce *OSH data*, účet **aplikace@** |
| clasp | `apps-script/.clasp.test.json` (stejné jako `.clasp.json`) | `apps-script/.clasp.ostry.json` (vzor `.clasp.ostry.json.example`) |
| Nastavení `REZIM` | `TEST` – e-maily jen na `spravci@` | `OSTRY` – e-maily skutečným adresátům |
| Data | testovací tabulka, disk *OSHPZ – TEST*, kalendář *OSHPZ – TEST* | ostrá tabulka, disk VEŘEJNÉ, ostrý kalendář |

Spuštění ostrého provozu krok za krokem: [spusteni-ostre.md](spusteni-ostre.md).

## Proč dva repozitáře

GitHub Pages dá jednomu repozitáři jen jednu doménu. Proto:

- **`oshpz/web`** zůstává pro vývoj i test. Vede z něj test.oshpz.cz, čte ho Claude Design a jsou v něm i interní podklady (`docs/`), zdrojáky serveru a plán.
- **`oshpz/web-ostry`** obsahuje jen to, co patří na veřejný web. Plní ho `./nasadit.sh ostry` a nic se v něm needituje ručně. Výjimkou je `data/web.json`, který tam zapisuje ostrý server.

Výhody: ostrý web nikdy neukáže rozpracovanou změnu, interní dokumenty se na veřejnou doménu nedostanou a každé nasazení je v `web-ostry` jeden commit s číslem verze z `oshpz/web`. Zpět se vrací `git revert` posledního nasazení v `web-ostry`.

## config.js

Web (`index.html`), aplikace (`Aplikace OSH.dc.html`) i plán (`docs/Plan zavedeni.dc.html`) berou hodnoty prostředí jen z `window.OSH_CONFIG`. Nastavuje ho `config.js` v kořeni webu. **`config.js` se needituje** – vytvoří ho `./nasadit.sh` z `prostredi/<prostředí>.config.js`.

| Klíč | Význam | TEST |
| --- | --- | --- |
| `prostredi` | `TEST` nebo `OSTRY` | `TEST` |
| `apiUrl` | adresa nasazení Apps Script (`…/exec`) | `…AKfycbz175mn…/exec` |
| `turnstileSitekey` | veřejný klíč Cloudflare Turnstile. Prázdný = stránka si ho vyžádá ze serveru (`?co=ping`). | `0x4AAAAAAFQXzTDrG7tWfz7m` |
| `webUrl` | adresa webu bez lomítka na konci (odkaz na přihlášku sboru, režim plánu jen ke čtení) | `https://test.oshpz.cz` |
| `aplikaceUrl` | adresa aplikace (odkazy z webu) | `https://test.oshpz.cz/Aplikace%20OSH.dc.html` |
| `kalendarId` | ID veřejného Google Kalendáře (pro vložení / odběr na webu; zatím jen připraveno) | kalendář *OSHPZ – TEST* |
| `dataUrl` | statická kopie dat webu | `data/web.json` |

Stránka otevřená bez `config.js` (náhled v Claude Design, soubor z disku) se chová jako TEST: bez adresy serveru ukáže vestavěnou ukázku.

Natvrdo zapsané hodnoty: adresa `/exec` byla v `index.html` i v aplikaci. Teď je jen v `prostredi/*.config.js`. ID kalendáře a sitekey v kódu webu nebyly – sitekey si stránky braly ze serveru, kalendář zná jen server.

### Co se liší podle prostředí

| | TEST | OSTRÝ |
| --- | --- | --- |
| `<meta name="robots" content="noindex">` | ano – vkládá ho `nasadit.sh` (značka `data-prostredi="test"`), ne ručně | ne – sestavení ho odstraní |
| Proužek „Testovací verze“ nahoře | ano (kód je jen v `prostredi/test.config.js`, stránku posune dolů, nic nezakrývá) | ne – v ostrém sestavení ten kód vůbec není |
| Web při výpadku serveru i kopie dat | vestavěná ukázka + hláška „zobrazuji vestavěnou ukázku“ | hláška „Aktuální údaje se teď nepodařilo načíst…“, žádné vymyšlené akce, termíny, zprávy ani dokumenty (archiv výsledků soutěží a seznam sborů zůstávají – jsou skutečné) |
| Aplikace – „Vyzkoušet ukázku s vymyšlenými daty“ | ano | skryto (ani stará adresa `#prihlaska=` ukázku neotevře) |
| Aplikace – obrazovky bez serveru (Soutěže, Přihlášky a Výsledky sborů…) | s lištou „Ukázka“ | skryté – v navigaci jen napojené obrazovky (`LIVE_VIEWS`, `SB_LIVE_VIEWS`) |
| CSP | `nasadit.sh` doplní adresy z konfigurace (server, kopie dat, Turnstile); nic neubírá | totéž |

## nasadit.sh

Potřebuje Node.js (stejný jako pro clasp). Spouští se v kořeni repozitáře `oshpz/web`:

```
./nasadit.sh test                          # test.oshpz.cz: config.js + hlavičky stránek, commit, git pull --rebase, git push
./nasadit.sh ostry --cname novy.oshpz.cz   # sestavení do ../web-ostry (klon oshpz/web-ostry), commit, push
./nasadit.sh ostry                         # totéž s doménou oshpz.cz (výchozí)
./nasadit.sh ostry --nanecisto [složka]    # jen sestaví do složky a zkontroluje – nic necommituje (jde i s DOPLNIT)
./nasadit.sh server test                   # Apps Script TEST: kontrola kolizí a syntaxe .gs, clasp push, clasp deploy -i <ID>
./nasadit.sh server ostry                  # totéž do ostrého projektu účtem aplikace@
```

Skript odmítne nasadit:
- když jsou v repozitáři necommitnuté změny (u `ostry` i v `web-ostry`);
- když konfigurace obsahuje `DOPLNIT` (`prostredi/ostry.config.js`, `.clasp.ostry.json`);
- když sestavení neprojde kontrolou;
- u `server`, když dva soubory `.gs` definují stejné jméno nebo má soubor syntaktickou chybu.

**Kontrola sestavení** (vypíše se při každém běhu):
- *ostrý:* bez `noindex`, bez testovacího proužku, bez `test.oshpz.cz`, bez adresy testovacího serveru a ID testovacího kalendáře, bez `DOPLNIT`, bez interních souborů;
- *test:* `noindex` na všech stránkách.

Do ostrého webu nejde:
- `docs/`, `apps-script/`, `skupiny-script/`, `prostredi/`, `nasadit.sh`;
- `*.md` v kořeni, `.gitignore`, `assets/ucty/` (ikony účtů Google);
- `data/web.json` – ten v `web-ostry` zapisuje ostrý server a sestavení ho nepřepíše.

`CNAME` nastaví parametr `--cname` (výchozí `oshpz.cz`) a `README.md` vznikne s upozorněním, že se soubory needitují.

Po `./nasadit.sh server …` skript zavolá `?co=ping` a ověří, že server odpovídá ve správném režimu. Adresa `/exec` se nasazením nemění.

## Apps Script

Kód je v obou projektech stejný. Prostředí určuje list **Nastavení** (`REZIM`) a Vlastnosti skriptu – v kódu nejsou žádná ID disků, kalendářů ani tabulek.

### Vlastnosti skriptu (Apps Script → ⚙ Nastavení projektu → Vlastnosti skriptu)

| Klíč | Kdo vyplní | Význam |
| --- | --- | --- |
| `PROSTREDI` | vy, **před prvním** Založit / doplnit strukturu (ostrý: `OSTRY`) | podle něj vzniknou výchozí hodnoty Nastavení (`REZIM` = `OSTRY`, `GITHUB_REPO` = `oshpz/web-ostry`). V testu ho doplní skript sám. |
| `TABULKA_ID` | Založit / doplnit strukturu | ID tabulky pro webovou aplikaci |
| `TURNSTILE_SECRET` | vy | tajný klíč Turnstile (Cloudflare → Turnstile → widget → Settings) |
| `GITHUB_TOKEN` | vy | fine-grained token jen pro repozitář z `GITHUB_REPO`, oprávnění *Contents: Read and write* |
| `GH_WEB_OTISK`, `PRIHLASKY_SLOZKA_ID`, `s_…`, `pr_…` | skript | otisk dat webu, složka přihlášek, přihlášení uživatelů, zpracované e-maily – nepřenášejí se |

### List Nastavení

Výchozí hodnoty vloží **Založit / doplnit strukturu**, a to jen u chybějících klíčů. Existující řádky nikdy nepřepíše. Na prázdné tabulce s `PROSTREDI = OSTRY` založí ostrý tvar:

| Klíč | TEST | OSTRÝ – výchozí | Poznámka |
| --- | --- | --- | --- |
| `REZIM` | `TEST` | `OSTRY` | |
| `TEST_EMAIL`, `TEST_KODY_PRIMO` | `spravci@oshpz.cz`, `ANO` | stejné | v ostrém se nepoužívají |
| `DOMENA`, `ODESILATEL` | `oshpz.cz`, `aplikace@oshpz.cz` | stejné | |
| `DISK_ID` | *OSHPZ – TEST* (docs/nastaveni-test.md) | **doplnit** – disk VEŘEJNÉ | |
| `SLOZKA_ORGANY` | `Orgány OSH PZ` | stejné | podsložky VV, OKRR, OORM, OORS, OORB, OORV, OSP |
| `KALENDAR_ID` | *OSHPZ – TEST* | **doplnit** | |
| `WEB_URL` | `https://test.oshpz.cz` | `https://oshpz.cz` | při souběhu `https://novy.oshpz.cz` |
| `TABULKA_ID` | doplní skript | doplní skript | |
| `TURNSTILE_SITEKEY` | klíč widgetu | **doplnit** – stejný widget, stejný klíč | |
| `TURNSTILE_DOMENY` | `test.oshpz.cz` | `oshpz.cz,www.oshpz.cz,novy.oshpz.cz` | |
| `TURNSTILE_PRISNE` | `ANO` | stejné | |
| `MAJETEK_CISELNIKY_ID`, `MAJETEK_TABULKA_ID`, `MAJETEK_VYPUJCKY_ID`, `MAJETEK_FOTO_DISK` | tabulky staré evidence | **doplnit** | evidence majetku je jedna – v ostrém stejná ID jako v testu |
| `SKUPINY_TABULKA_ID` | tabulka *Sbory* (Skupiny OSH) | **doplnit** | skupiny jsou jedny – stejné ID jako v testu |
| `PRISPEVKY_EMAIL` | `prispevky@oshpz.cz` | stejné | alias účtu, pod kterým skript běží |
| `GITHUB_REPO`, `GITHUB_VETEV` | `oshpz/web`, `main` | `oshpz/web-ostry`, `main` | kam se zapisuje `data/web.json` |
| `OKRES_UCET`, `ODVOD_*`, `PRISPEVEK_*`, `PRIHLASKY_*`, `PRIPOMINKY_DNY`, `ZALOHY_TYDNY`, `SLOZKA_ZALOHY`, `POJMENOVANI` | | stejné | provozní hodnoty – zkontrolovat |

### kontrolaProstredi

Tabulka → **OSH data → Kontrola prostředí**, nebo v editoru Apps Script spustit funkci `kontrolaProstredi`. Nic nemění, jen čte. Výsledek zapíše do listu **Kontrola prostředí** (zeleně OK, žlutě POZOR, červeně CHYBÍ). Kontroluje:

- **prostředí:** `REZIM` vs. `PROSTREDI`, účet skriptu (ostrý = `ODESILATEL`), název tabulky bez „TEST“;
- **Nastavení:** povinné a doporučené klíče, `TABULKA_ID`;
- **Vlastnosti skriptu:** `TURNSTILE_SECRET`, `GITHUB_TOKEN`;
- **disk:**
  - přístup k `DISK_ID` s právem přidávat soubory, název bez „TEST“;
  - složka orgánů se všemi podsložkami;
  - sborové skupiny nejsou členy disku;
- **kalendář:** účet skriptu ho vidí, název bez „TEST“;
- **tabulky evidence majetku a Skupiny OSH:** právo úprav;
- **skupiny:** `spravci@`, `sbory@`, `sbory-mh@`, `sbory-jsdh@`, `sbory-sport@` a skupiny `sdh-…` (účet skriptu potřebuje roli správce skupin);
- **pošta:** alias `PRISPEVKY_EMAIL` patří účtu skriptu, denní kvóta;
- **časovače:** všechny z `nastavitSpousteni` běží;
- **web:**
  - `WEB_URL/config.js` má stejné prostředí jako server a stejný sitekey;
  - `apiUrl` z něj odpovídá ve stejném režimu;
- **GitHub:** token smí zapisovat do `GITHUB_REPO`.

### Dva účty v clasp

Test je pod admin@ (výchozí uživatel clasp), ostrý projekt od začátku pod **aplikace@**. clasp 3 umí víc pojmenovaných přihlášení:

```
clasp login -u aplikace        # v prohlížeči se přihlásit jako aplikace@oshpz.cz
clasp login                    # (výchozí) admin@ – už je
```

Pole `"ucet"` v `.clasp.<prostředí>.json` říká, které přihlášení `nasadit.sh server` použije (`default` = admin@, `aplikace` = aplikace@). Ručně by to bylo `clasp -u aplikace -P "$PWD/.clasp.ostry.json" push`. Cesta za `-P` musí být absolutní, jinak clasp 3.4 hlásí „escapes project root“.

Účet aplikace@ musí mít zapnuté **Google Apps Script API**: https://script.google.com/home/usersettings (přihlášený jako aplikace@).

### Skript skupin

`skupiny-script/` je jeden pro oba světy (skupiny i tabulka *Sbory* jsou skutečné). Při přepnutí domény změnit v `skupiny-script/Kontakty.gs` `ARES_URL` z `test.oshpz.cz` na ostrý web.

## Turnstile

Jeden widget pro obě prostředí, se stejným sitekey a secret. V Cloudflare (účet web@oshpz.cz) → **Turnstile** → widget „OSH aplikace TEST“ → **Settings → Hostname management** přidat `oshpz.cz`, `www.oshpz.cz` a `novy.oshpz.cz`. Widget je vhodné přejmenovat na „OSH aplikace“. V Nastavení každého prostředí vyplnit `TURNSTILE_DOMENY` jeho doménami. Server odmítne token z cizí domény.
