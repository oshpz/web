# Spuštění ostrého provozu – kontrolní seznam

Pro: Michal (správce Workspace). Plán: úkoly **L1** (ostrý účet a data), **L3** (přesměrování starých adres), **L4** (schválení VV), **L5** (přepnutí oshpz.cz) a **L6** (starý web jen pro čtení). Jak prostředí fungují: [prostredi.md](prostredi.md).

Pořadí je důležité:
1. Postavit ostré prostředí vedle testu.
2. Ověřit ho na **novy.oshpz.cz**, zatímco starý web dál běží na oshpz.cz.
3. Teprve po schválení VV přepnout DNS.

Test (test.oshpz.cz) běží celou dobu beze změny.

Kroky, které dělá Claude Code, jsou označené **(Claude)**.

---

## 1. Ostrá tabulka a disk (L1)

**Disk.** Ostrý provoz používá existující sdílený disk **VEŘEJNÉ** se složkou „Orgány OSH PZ“ (rozhodnuto dříve, viz `docs/nastaveni-test.md`). Disk INTERNÍ zůstává uzavřený.
1. Otevřít drive.google.com → **Sdílené disky → VEŘEJNÉ**.
2. Zkontrolovat strukturu jako v testu: složka **Orgány OSH PZ** a v ní podsložky **VV, OKRR, OORM, OORS, OORB, OORV, OSP**. Chybějící založit (pravé tlačítko → Nová složka). Složky *Žádosti* a *Zálohy* založí skript sám.
3. Pravé tlačítko na disku → **Spravovat členy** → přidat **aplikace@oshpz.cz** jako **Správce obsahu**. Sborové skupiny (`sdh-…`, `okrsek-…`, `sbory@`) členy disku být nesmí.
4. ID disku: otevřít disk, adresa v prohlížeči končí `…/drive/folders/<ID>` → zapsat si (`DISK_ID`).
5. Totéž (Správce obsahu pro aplikace@) na disku **evidence majetku** a právo úprav pro aplikace@ ve třech tabulkách evidence (Číselníky, Majetek, Výpůjčky) a v tabulce **Sbory** (Skupiny OSH) – Sdílet → aplikace@ → Editor.

**Tabulka.**
1. Přihlásit se do Google jako **aplikace@oshpz.cz** (anonymní okno, ať se nepletou účty).
2. sheets.google.com → **Prázdná tabulka** → přejmenovat na **OSH data** (bez „TEST“).
3. Soubor → **Přesunout** → disk **VEŘEJNÉ**, ne do Orgány OSH PZ. Lepší je samostatná složka *Aplikace*, kterou vidí jen okres.

## 2. Ostrý kalendář (L1)

1. Jako aplikace@: calendar.google.com → vlevo **Další kalendáře → + → Vytvořit nový kalendář** → název **OSH Praha-západ** → Vytvořit.
2. Nastavení kalendáře → **Přístupová oprávnění pro události** → zaškrtnout **Zpřístupnit veřejnosti** (jen podrobnosti o událostech). Web ho může vložit nebo nabídnout k odběru.
3. **Integrovat kalendář** → zkopírovat **ID kalendáře** (`…@group.calendar.google.com`) → zapsat si (`KALENDAR_ID`).
4. Sdílet se **spravci@oshpz.cz** → *Provádět změny událostí*.

## 3. Projekt Apps Script pod aplikace@ (L1, B9.3)

1. **Role pro skupiny:** v Admin konzoli (admin.google.com) jako admin@: **Účet → Role správců** → **Správce skupin** → *Přiřadit uživatele* → aplikace@oshpz.cz. Je to potřeba pro členství skupin a pro provádění změn sborů.
2. Jako aplikace@ otevřít https://script.google.com/home/usersettings → **Google Apps Script API: Zapnuto**.
3. V ostré tabulce **Rozšíření → Apps Script** → přejmenovat projekt na **OSH data** → ⚙ **Nastavení projektu** → zkopírovat **ID skriptu**.
4. **(Claude)** v `apps-script/` zkopírovat `.clasp.ostry.json.example` na `.clasp.ostry.json` a vložit ID skriptu (`deploymentId` zatím DOPLNIT); `clasp login -u aplikace` – Claude pošle odkaz, otevřít ho v prohlížeči přihlášeném jako aplikace@.
5. **(Claude)** nahrát kód: `clasp -u aplikace -P "$PWD/.clasp.ostry.json" push -f`.
6. V editoru Apps Script: ⚙ **Nastavení projektu → Vlastnosti skriptu → Přidat vlastnost**:
   - `PROSTREDI` = `OSTRY` (**před** dalším krokem),
   - `TURNSTILE_SECRET` = tajný klíč z Cloudflare (stejný jako v testu),
   - `GITHUB_TOKEN` = nový fine-grained token (krok 5.4).
7. Obnovit tabulku (F5) → menu **OSH data → Založit / doplnit strukturu** → povolit oprávnění (Pokročilé → Přejít na OSH data → Povolit). Vzniknou všechny listy a Nastavení s `REZIM = OSTRY`.
8. V listu **Nastavení** doplnit prázdné hodnoty:
   - `DISK_ID`, `KALENDAR_ID` (kroky 1 a 2);
   - `TURNSTILE_SITEKEY` (stejný jako v testu);
   - `MAJETEK_CISELNIKY_ID`, `MAJETEK_TABULKA_ID`, `MAJETEK_VYPUJCKY_ID`, `MAJETEK_FOTO_DISK` a `SKUPINY_TABULKA_ID` – zkopírovat z Nastavení testovací tabulky;
   - `WEB_URL` = `https://novy.oshpz.cz` (do přepnutí DNS).

   Provozní hodnoty porovnat s testem: `OKRES_UCET`, `ODVOD_*`, `PRISPEVEK_*`.
9. Převzít data z testu (kapitola 6).
10. **Nasadit → Nové nasazení** → ozubené kolo → **Webová aplikace** → popis „ostrý provoz“, *Spustit jako*: **Já (aplikace@)**, *Kdo má přístup*: **Kdokoli** → Nasadit → zkopírovat **ID nasazení** (`AKfycb…`).
11. **(Claude)** ID nasazení do `.clasp.ostry.json` (`deploymentId`) a do `prostredi/ostry.config.js` (`apiUrl`); doplnit `turnstileSitekey`, `kalendarId`, `webUrl` a `aplikaceUrl` (zatím `https://novy.oshpz.cz`). Další nasazení serveru už jen `./nasadit.sh server ostry`.
12. V editoru vybrat funkci **nastavitSpousteni** → Spustit → povolit oprávnění.
13. Tabulka → **OSH data → Kontrola prostředí** → projít červené řádky, opakovat, dokud nezbyde jen POZOR, kterému rozumíte. Kontrola webu projde až po kapitole 5.

## 4. Alias prispevky@ (B9.3)

1. admin.google.com → **Adresář → Uživatelé** → **admin@oshpz.cz** → *Informace o uživateli* → **Alternativní e-mailové adresy** → u `prispevky@oshpz.cz` odebrat → Uložit.
2. Hned potom **aplikace@oshpz.cz** → Alternativní e-mailové adresy → **Přidat** `prispevky` → Uložit. Projeví se do několika minut, nejpozději do 24 h.
3. V **testovací** tabulce Nastavení vymazat `PRISPEVKY_EMAIL`. Test tak přestane číst poštu admin@, kde alias už není.
4. V ostré tabulce **Kontrola prostředí** → řádek *Alias prispevky@* musí být OK.

## 5. Repozitář web-ostry a souběh na novy.oshpz.cz (L1)

1. github.com (účet web@oshpz.cz) → organizace **oshpz** → **New repository** → název **web-ostry**, Public, bez README → Create.
2. **(Claude)** `git clone https://github.com/oshpz/web-ostry.git ../web-ostry`.
3. **(Claude)** `./nasadit.sh ostry --cname novy.oshpz.cz` – sestaví, zkontroluje a nahraje první verzi.
4. Token pro data webu: github.com → Settings → Developer settings → **Fine-grained tokens → Generate new token** → Resource owner **oshpz**, *Only select repositories*: **web-ostry**, *Repository permissions → Contents: Read and write* → Generate → hodnotu vložit do Vlastností ostrého skriptu jako `GITHUB_TOKEN` (krok 3.6).
5. Repozitář **web-ostry → Settings → Pages** → *Source*: **Deploy from a branch**, větev **main**, složka **/ (root)** → Save.
6. DNS u Forpsi (administrace domény oshpz.cz → DNS záznamy) → přidat **CNAME**: název `novy`, hodnota `oshpz.github.io.` → Uložit.
7. Po pár minutách v **Settings → Pages** svítí *DNS check successful* → zaškrtnout **Enforce HTTPS**.
8. Doporučeno proti převzetí domény: organizace **oshpz → Settings → Pages → Add a domain** → `oshpz.cz` → vložit TXT záznam, který GitHub ukáže, do DNS u Forpsi → Verify.
9. Cloudflare → Turnstile → widget → **Hostname management** → přidat `oshpz.cz`, `www.oshpz.cz`, `novy.oshpz.cz`.
10. Ostrá tabulka → **Kontrola prostředí** → teď musí projít i *Web* a *GitHub*.
11. Otevřít https://novy.oshpz.cz:
    - **web:** bez proužku „Testovací verze“, bez ukázkových dat;
    - **aplikace:** přihlášení kódem (přijde z aplikace@), portál sboru, správa okresu;
    - **příspěvek e-mailem** na prispevky@.

## 6. Převzetí dat z testu (L1)

Ostrá tabulka začíná prázdná. Z testu se převádí jen to, co je skutečné:

| List | Převzít? | Jak |
| --- | --- | --- |
| **Sbory** | ano | celý obsah |
| **Kontakty sborů** | ano | celý obsah (souhlasy z formuláře platí) |
| **Uživatelé** | ano | jen skutečné osoby a role, ne testovací účty (gmail navrhovatele apod.) |
| **Členové orgánů** | ano | celý obsah |
| Akce, Termíny | jen skutečné okresní termíny | vymazat sloupec *Kalendář – událost*; ve sloupci *Oznámeno* nechat datum, jinak by odešlo oznámení všem sborům |
| Dokumenty | ne | ostrý skript si soubory z disku VEŘEJNÉ najde sám (kontrola Disku) |
| Žádosti, Rezervace, Příspěvky, Změny sborů | ne | testovací |
| Členské přihlášky | **ne** | testovací; osobní údaje jsou v testu na Můj disk admin@ – po skončení testu smazat |
| Záznam změn, Členství skupin, Úklid testů, Kontrola prostředí | ne | vzniknou znovu |
| Nastavení | ne | ostré vzniká v kroku 3.7 |

Postup u každého převáděného listu:
1. V testovací tabulce otevřít list a porovnat **řádek záhlaví** s ostrou tabulkou. Aplikace hledá sloupce podle názvu. Když se pořadí liší, kopírovat po sloupcích.
2. Kliknout do buňky A2 → **Ctrl+Shift+End** (označí data) → Ctrl+C.
3. V ostré tabulce stejný list → buňka **A2** → **Ctrl+Shift+V** (vložit jen hodnoty).
4. Nakonec **OSH data → Skupiny: načíst členství sborů teď** a **Kontrola prostředí**.

## 7. Přepnutí oshpz.cz na nový web (L4 → L5)

**Kdy:**
- po schválení VV (L4);
- po aspoň týdnu bezchybného souběhu na novy.oshpz.cz;
- s hotovým přesměrováním starých adres (L3);
- ve všední den dopoledne, ne před akcí okresu.

**Den předem:**
1. Forpsi → DNS oshpz.cz → **zapsat si (vyfotit) současné záznamy** `@` (A, případně AAAA) a `www`. To je cesta zpět.
2. TTL záznamů `@` a `www` snížit na **300** s, aby se změna i návrat projevily rychle.
3. Starý web na archivní adrese, třeba `archiv.oshpz.cz`: u Forpsi přidat alias hostingu a v Joomle (`configuration.php`, `$live_site`) adresu, je-li vyplněná. Odkaz „původní web“ v `index.html` pak **(Claude)** přesměruje na archiv.

**Přepnutí:**
1. **(Claude)** `prostredi/ostry.config.js`: `webUrl` a `aplikaceUrl` na `https://oshpz.cz` → commit → `./nasadit.sh ostry` (výchozí CNAME oshpz.cz).
2. Ostrá tabulka → Nastavení `WEB_URL` = `https://oshpz.cz`.
3. Forpsi DNS:
   - záznam `@` typu **A** nahradit čtyřmi: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
   - **AAAA**: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`;
   - `www` jako **CNAME** `oshpz.github.io.`.
4. web-ostry → Settings → Pages → Custom domain `oshpz.cz` (nastaví ho už CNAME) → po *DNS check successful* **Enforce HTTPS**. Certifikát může trvat až hodinu.
5. Odstranit CNAME `novy` z DNS **až po** ověření. Do té doby novy.oshpz.cz přesměruje na oshpz.cz.
6. **(Claude)** `skupiny-script/Kontakty.gs` → `ARES_URL` na `https://oshpz.cz/data/sbory-ares.js` → `clasp push`.
7. Ostrá tabulka → **Kontrola prostředí**.

**Návrat zpět (kdyby něco nešlo):** vrátit v DNS záznamy z kroku „Den předem“ 1. Díky TTL 300 se projeví do několika minut. Nový web zůstane dostupný přes `oshpz.github.io/web-ostry` a po vrácení CNAME `novy` znovu na novy.oshpz.cz.

## 8. Přesměrování starých adres (L3, navazuje na B15)

GitHub Pages neumí přesměrování na serveru. Staré adresy `oshpz.cz/index.php/…` proto zachytí stránka **404.html** v ostrém webu a přesměruje je skriptem:
- **článek** převedený v B15 → `?clanek=<adresa>` (adresa z původní URL);
- **sekce** (orgány, sbory, kalendář, mládež…) → odpovídající stránka nového webu;
- **ostatní** → úvod s odkazem na archiv starého webu.

**(Claude)** připraví `404.html` a tabulku nejnavštěvovanějších adres v rámci L3. Seznam adres dodá okres z hostingu Forpsi (statistiky přístupů) nebo z Google Search Console. Musí být hotové před krokem 7.

## 9. Po spuštění (L6)

- Po měsíci provozu: Joomla jen pro čtení (zrušit účty redaktorů), archiv ponechat.
- Testovací prostředí dál slouží k vývoji. Nové verze jdou nejdřív `./nasadit.sh test`, po ověření `./nasadit.sh ostry` a `./nasadit.sh server ostry`.
