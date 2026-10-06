# B1 – tabulka OSH data TEST

1. Na disku **OSHPZ – TEST** ve složce **Data** vytvořte prázdnou tabulku **OSH data TEST**.
2. **Rozšíření → Apps Script**, smažte obsah, vložte `OSH-data-struktura.gs`, uložte.
3. Nahoře vyberte funkci **zalozitStrukturu** → **Spustit** → povolte přístup.
4. Za chvíli je v tabulce 14 listů s hlavičkami, rozbalovacími hodnotami a formáty.

5. V menu **OSH data → Založit tabulku OSH citlivé** (nebo funkce **zalozitCitlivou**). Vznikne tabulka na **vašem Můj disk** – záměrně ne na sdíleném disku, kam vidí všichni jeho členové. Sdílí se jen s `aplikace@`. Pak ji ručně nasdílejte 1–2 lidem, kteří zapisují do evidence SH ČMS – **ne celé skupině spravci@**.

Skript jde spustit kdykoli znovu (menu **OSH data**). Doplní jen to, co chybí – data nemaže.

## Listy
- **Nastavení** – ID disku, kalendáře, režim TEST/OSTRY. Předvyplněno.
- **Uživatelé** – role (doplníte, až budou známí lidé – R2).
- **Sbory** – stejné sloupce jako tabulka Skupiny OSH. Data můžete zkopírovat.
- **Akce, Termíny** – kalendář okresu a sborů.
- **Dokumenty** – zápisy a dokumenty z Disku ke schválení.
- **Žádosti** – žádosti sborů o pořádání.
- **Přihlášky družstev, Výsledky** – soutěže.
- **Majetek, Rezervace** – výpůjčky vybavení.
- **Členské přihlášky** – bez rodného čísla. To je v tabulce **OSH citlivé** (propojené přes ID přihlášky) a 30 dní po zápisu do evidence SH ČMS se samo smaže (lhůta v Nastavení).
- **Příspěvky** – články na web.
- **Záznam změn** – kdo, kdy, co.

## Zásady
- Řádek 1 (hlavičku) neměňte – aplikace hledá sloupce podle názvu. Při pokusu o úpravu se ukáže varování.
- Sloupce **ID, Vytvořeno, Vytvořil, Upraveno, Upravil** vyplňuje aplikace.
- Tabulku sdílejte jen se `spravci@` a `aplikace@`. Sbory a veřejnost do ní přístup nemají – vidí jen to, co jim pošle aplikace.

Hotovo → označte **B1** v plánu.

---

# B2.1 – základ API (webová aplikace)

1. V Apps Script vlevo **+ → Skript**, pojmenujte **API**, vložte `API.gs`, uložte.
2. Spusťte funkci **pripravitApi** (uloží ID tabulky pro web).
3. Spusťte **vlozitUkazkovaData** – přidá 3 testovací řádky (TEST-A1, TEST-T1, TEST-D1).
4. **Nasadit → Nové nasazení** → ozubené kolo → **Webová aplikace**:
   - Popis: `B2.1`
   - Spustit jako: **Já**
   - Kdo má přístup: **Kdokoli**
   - **Nasadit** → zkopírujte **URL webové aplikace** (končí `/exec`).
5. Test v prohlížeči (i v anonymním okně):
   - `…/exec` → `{"ok":true,"rezim":"TEST",…}`
   - `…/exec?co=akce` → testovací akce
   - `…/exec?co=terminy`, `…/exec?co=dokumenty&organ=VV`

**Bezpečnost:** „Kdokoli“ znamená, že adresu může zavolat každý – ale API zatím vrací jen řádky se stavem **zveřejněno** a ne „jen okres“. Uživatelé, přihlášky, rodná čísla ani zápis nejsou dostupné. Ty přijdou až s přihlášením (díl 2).

**Při změně kódu:** Nasadit → **Spravovat nasazení** → tužka → Verze: **Nová verze**. URL zůstane stejná.

---

# B2.2 – přihlášení kódem

1. Nahraďte obsah souboru **API** novým `API.gs` (doPost se přesunul).
2. **+ → Skript** → `Prihlaseni` → vložte `Prihlaseni.gs`, uložte.
3. Do listu **Uživatelé** dejte sebe: E-mail, Jméno, Aktivní **ANO**, Správce **ANO**. Pro test sboru vepište svůj osobní e-mail do **Sbory → Kontakty** u jednoho sboru.
4. Spusťte **nastavitSpousteni** (noční údržba 2:00) a povolte nová oprávnění (odesílání e-mailů).
5. **Nasadit → Spravovat nasazení → tužka → Verze: Nová verze → Nasadit.** URL zůstane stejná, `…/exec` ukáže `"verze":"B2.2"`.
6. Otevřete stránku **Test přihlášení** a přihlaste se.

V režimu TEST chodí kódy na **spravci@** s předmětem `[TEST → adresát]`.

**Pojistky:** kód platí 10 min a má 5 pokusů; max. 5 kódů za hodinu na adresu; neznámý e-mail dostane stejnou odpověď jako známý; po přihlášení přijde upozornění; přepnutí **Aktivní: NE** odhlásí okamžitě; funkce **odhlasitVsechny** zruší všechny relace.

---

# B2.3 – dokumenty z Disku

1. **+ → Skript** → `Dokumenty` → vložte `Dokumenty.gs`.
2. Nahraďte obsah souborů **Prihlaseni**, **API** a **OSH-data-struktura** novými verzemi.
3. Spusťte **nastavitSpousteni** a povolte přístup k Disku.
4. **Spravovat nasazení → Nová verze** (`/exec` ukáže `B2.3`).
5. Obnovte tabulku – v menu **OSH data** přibudou položky Dokumenty.

**Sdílený disk musí povolit odkazy:** Disk → OSHPZ – TEST → Nastavení sdíleného disku → povolit sdílení s lidmi mimo organizaci **a** přístup přes odkaz. Jinak zveřejnění skončí chybou.

## Test
1. Do složky jednoho orgánu nahrajte `VV 20261001 Zápis z jednání.pdf` a ještě `test bez data.pdf`.
2. Menu **OSH data → Dokumenty: zkontrolovat Disk teď** (nebo počkejte 15 min).
3. V listu Dokumenty: 2 řádky **ke schválení**. Druhý má **Upozornění** (název neodpovídá vzoru). Na spravci@ přijde e-mail.
4. Označte první řádek → **Dokumenty: zveřejnit označené**. Stav **zveřejněno**, vyplní se Veřejný odkaz (otevřete v anonymním okně).
5. `…/exec?co=dokumenty&organ=VV` – zápis je v seznamu (cache do 5 min se po schválení maže hned).
6. Smažte soubor z Disku → po kontrole se stav změní na **staženo** a ze seznamu zmizí.

U druhého souboru: buď ho přejmenujte (vznikne nový řádek, starý zamítněte), nebo doplňte Orgán/Rok/Název ručně v tabulce a zveřejněte.

---

# B5 – kalendář (+ zápis akcí a termínů z aplikace)

1. Na stránce **Skripty** zkopírujte změněné soubory a vytvořte nový **Kalendar**.
2. Kalendář **OSHPZ – TEST** musí být sdílen s vaším účtem s právem **Provádět změny událostí** (jako vlastník ho máte).
3. Spusťte **nastavitSpousteni** a povolte přístup ke Kalendáři.
4. **Spravovat nasazení → Nová verze** (`/exec` ukáže `B5`).

## Test
1. Řádek TEST-A1 v listu **Akce** má stav zveřejněno → menu **OSH data → Kalendář: synchronizovat teď**. Akce je v kalendáři, ve sloupci **Kalendář – událost** je její ID.
2. Změňte v řádku Místo nebo čas → během pár sekund se změní i v kalendáři.
3. Přidejte nový řádek do **Termíny** (Název, Datum, Stav: zveřejněno) → ID i Vytvořeno/Vytvořil se doplní samo, v kalendáři vznikne celodenní událost.
4. Stav **zrušeno** → událost zmizí. Smazání celého řádku → zmizí při hodinové synchronizaci (nebo z menu).

Akce bez času (Od = jen datum) jsou celodenní; vícedenní akce = Od a Do jako data.

---

# B6 – e-maily, oznámení a připomínky

1. Na stránce **Skripty** zkopírujte změněné soubory a vytvořte nový **Posta**.
2. Spusťte **zalozitStrukturu** – do Akce a Termínů přibudou sloupce **Oznámeno** a **Připomenuto** (Akce i **Připomenout (dny předem)**).
3. Spusťte **nastavitSpousteni** (oznámení každých 15 min, připomínky v 7:00).
4. **Spravovat nasazení → Nová verze** (`/exec` ukáže `B6`).

**Adresát podle „Pro koho“:** všechny sbory → sbory@, sbory s MH → sbory-mh@, s JSDH → sbory-jsdh@, se sportem → sbory-sport@, okrsek + číslo → okrsek-03@, jen okres → spravci@, veřejnost → bez e-mailu (jen web).

**Kdo smí psát do skupin:** e-mail odchází z účtu, pod kterým běží skript. Ten musí smět psát do souhrnných skupin (u vás jako správce ano). V režimu TEST to zatím nevadí – vše jde na TEST_EMAIL.

## Test
1. Označte řádek TEST-A1 → **E-maily: náhled pro označený řádek**. Přijde vám ukázka v novém vzhledu, v předmětu je skutečný adresát.
2. U řádku vymažte **Oznámeno** → **E-maily: poslat oznámení teď** (řádek nesmí být upravený v posledních 10 minutách). Na TEST_EMAIL přijde `[TEST → sbory@oshpz.cz] Nová akce: …`.
3. Termín za 3 dny se stavem zveřejněno → **E-maily: poslat připomínky teď** → přijde „Za 3 dny: …“, ve sloupci **Připomenuto** je `3,14`. Druhé spuštění už nic nepošle.

Oznámení se neposílá pro proběhlé akce, veřejnost a řádky upravené v posledních 10 minutách (ať neodejde rozepsaný). Smazáním hodnoty v Oznámeno se pošle znovu.

---

# B3.5 – sbor podle členství ve skupině sdh-…@

Kdo je členem skupiny **sdh-cernosice@** (osobní e-mail), přihlásí se za SDH Černošice. Přidání nebo odebrání ve skupině = přidání nebo odebrání přístupu, do hodiny (z menu hned). Sloupec **Kontakty** v listu Sbory zůstává jako záloha.

1. Apps Script vlevo **Služby → +** → **Admin SDK API** → identifikátor `AdminDirectory` → Přidat.
2. Zkopírujte změněné soubory **Prihlaseni**, **OSH-data-struktura**, **API**.
3. Spusťte **obnovitClenstvi** a povolte přístup ke skupinám. Vznikne list **Členství skupin** (e-mail, skupina, sbor).
4. Spusťte **nastavitSpousteni** (přibude obnova členství každou hodinu).
5. **Spravovat nasazení → Nová verze** (`/exec` ukáže `B3.5`).

## Test
1. Do jedné skupiny sdh-…@ přidejte svůj osobní e-mail (pokud tam ještě není) → menu **Skupiny: načíst členství sborů teď**.
2. Smažte ten e-mail ze sloupce **Kontakty** v listu Sbory (aby se testovala jen skupina).
3. Na stránce **Test přihlášení** se přihlaste osobním e-mailem → v odpovědi `"sbory": [{ "sbor": "…", "zdroj": "skupina" }]`.
4. Odeberte se ze skupiny → načíst členství → **Znovu načíst role** → sbor zmizí.

Sloupec **Sbor** se bere z listu Sbory podle sloupce **Skupina**; když tam sbor chybí, použije se název skupiny.
