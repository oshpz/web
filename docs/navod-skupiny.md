# Skupiny sborů – návod

Výsledek: `sdh-…@oshpz.cz` pro každý sbor, `sbory@`, `sbory-mh@`, `sbory-jsdh@`, `sbory-sport@` a `okrsek-01@` … `okrsek-14@`. Souhrnné skupiny obsahují sborové skupiny, ne lidi.

## 1. Admin konzole (jednou)
1. **Aplikace → Google Workspace → Skupiny pro firmy → Možnosti sdílení:** zapnout „Vlastníci skupin mohou povolit externí členy“ a „Povolit příjem e-mailů mimo organizaci“.
2. Spouštět musí účet s rolí **Super Admin** (nebo Správce skupin).

## 2. Tabulka
1. Na Disku vytvořte tabulku **Skupiny OSH** a importujte `Sbory.csv` (Soubor → Importovat → Nahradit aktuální list). List přejmenujte na **Sbory**.
2. Zkontrolujte:
   - **72 řádků** – web má o jeden sbor víc než „71 sborů“. Neaktivní sbor označte `NE` ve sloupci Aktivní.
   - **MH** je podle soutěží 2026, **JSDH** podle seznamu HZS (březen 2026).
   - **Sport** je prázdný – doplňte `ANO` u sborů se soutěžními družstvy.
   - **Skupina** – adresy můžete zkrátit (např. `sdh-mnisek`). Měnit je později už nedoporučuji.
   - **Kontakty** – osobní e-maily lidí ze sboru oddělené čárkou. Může zůstat prázdné, skupiny se založí i tak.

## 3. Skript
1. V tabulce **Rozšíření → Apps Script**, smažte obsah a vložte celý `Skupiny.gs`. Uložte.
2. Vlevo **Služby → +**: přidejte **Admin SDK API** (identifikátor `AdminDirectory`) a **Groups Settings API** (`AdminGroupsSettings`).
3. Obnovte tabulku. Objeví se menu **Skupiny OSH**. Funkci `onOpen` z editoru nespouštějte, spouští se sama při otevření tabulky.
   - Když jste skript založili zvlášť na script.google.com, menu se neobjeví. Do `TABULKA_ID` vložte ID tabulky z její adresy, v editoru nahoře vyberte funkci `nahled` a klikněte na **Spustit**.
4. **1. Náhled změn** – při prvním spuštění povolte přístup. V listu **Protokol** uvidíte, co by se stalo. Nic se nemění.
5. **2. Provést změny** – založí skupiny a zařadí je. Trvá pár minut. Když skript skončí na časovém limitu, spusťte ho znovu – pokračuje, kde přestal.

## Běžný provoz
- Sbor založí MH, přijde nový člověk, změní se okrsek → upravte řádek a spusťte **Náhled** a **Provést změny**.
- Skript **nikdy nic nemaže**. Lidi navíc ve sborové skupině jen nahlásí. Kdo chce, aby je odebíral, nastaví v kódu `ODEBIRAT_LIDI: true`.
- Vlastníky a správce skupin skript nikdy neodebírá.
- Po zařazení do souhrnné skupiny může trvat až 10 minut, než začne pošta chodit.

## Pravidla skupin (nastaví skript)
- **Sborové skupiny:** externí členové povoleni, psát může kdokoli (obec, HZS), podezřelé zprávy čekají na schválení.
- **Souhrnné skupiny:** psát smí jen účty @oshpz.cz – nikdo omylem neodpoví všem sborům.
- Všude: členy přidává jen okres, seznam členů vidí jen správci, odpověď jde odesílateli.

Pravidla jde kdykoli znovu použít přes **Skupiny OSH → Nastavit pravidla všech skupin**.
