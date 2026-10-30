# Úkol 6 – vzor seznamu ve Spojce (varianta 6b) – specifikace pro Claude Code

Zvoleno 30. 10. 2026. Návrh: `Seznamy - návrh vzoru.dc.html` (Claude Design), varianta **6b**. Barvy jen přes role (`--color-brand`, `--color-action`, `--color-accent-100/800` pro „pro koho“, `--color-neutral-*`). Motiv sboru je předefinuje sám (`[data-theme="sbor"]`).

## Třídy (do `<helmet>` v `Aplikace OSH.dc.html`)

| Třída | Počítač (od 720 px) | Telefon (pod 720 px) |
| --- | --- | --- |
| `.sz-seznam` | `border-top: 2px solid var(--color-divider)` | stejné |
| `.sz-radek` | `display:grid; grid-template-columns: 88px minmax(0,1fr) 150px auto 24px; gap:16px; align-items:center; min-height:64px; padding:8px 16px 8px 20px; border-bottom:1px solid var(--color-divider); position:relative; text-align:left; width:100%; background:none; cursor:pointer` | `grid-template-columns: 56px minmax(0,1fr) 16px; gap:12px; align-items:start; min-height:72px; padding:12px 8px 12px 16px` |
| `.sz-radek:hover` | `background: var(--color-surface)` | – (jen `:active`) |
| `.sz-radek:focus-visible` | `outline:2px solid var(--color-action); outline-offset:-2px` | stejné |
| `.sz-radek--vybrany` | `background: var(--color-accent-100)` | stejné |
| `.sz-radek--ceka::before` | `content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--color-brand)` | stejné |
| `.sz-radek--zrusene` | `opacity:.55`; `.sz-titulek` přeškrtnutý | stejné |
| `.sz-kotva` (2 řádky) | 1. `.sz-kotva-hl` 20 px / 800, line-height 1.1, nowrap („14. 11.“, „OORM“); 2. `.sz-kotva-po` 12 px, verzálky, letter-spacing .04em, `--color-neutral-700` („so · 09:00“, „23. 10.“) | 18 px / 11 px |
| `.sz-titulek` | 16 px / 700, 1 řádek, `text-overflow: ellipsis` | stejné |
| `.sz-popis` | 14 px, `--color-neutral-700`, 1 řádek se zkrácením | max 2 řádky (`-webkit-line-clamp:2`) |
| `.sz-stav` (sloupec 150 px) | jeden štítek `.sz-stitek--stav`, výška 24 px, `padding:0 10px`, 13 px | přesune se do `.sz-stitky` pod popis jako první |
| `.sz-stitky` | `display:flex; gap:6px; justify-content:flex-end` – typ → pro koho | pod popisem, `flex-wrap:wrap`, pořadí stav → typ → pro koho |
| `.sz-stitek` | výška 22 px, `padding:0 8px`, 12 px, nowrap, bez zaoblení | stejné |
| `.sz-stitek--stav` | `background: var(--color-neutral-200)` | |
| `.sz-stitek--ceka` | `background: var(--color-action); color:#fff; font-weight:700` – text je **konkrétní krok** („Ke schválení“, „Odevzdat hlášení“), nikdy „Čeká na vás“ | |
| `.sz-stitek--zrus` | `--color-neutral-200`, text `--color-neutral-700`, přeškrtnutý | |
| `.sz-stitek--typ` | `border:1px solid var(--color-neutral-500)` | |
| `.sz-stitek--pro` | `background: var(--color-accent-100); color: var(--color-accent-800)` | |
| `.sz-sipka` | „→“ 18 px, `--color-neutral-500`; u `--ceka` `--color-action` | stejné |
| `.sz-skupina` | mezititulek 18 px / 800 + počet 14 px `--color-neutral-700`, `padding:16px 0 8px`, pod ním `.sz-seznam` | 17 px |
| `.sz-zalozky` | řada `gap:8px`; záložka 40 px, `border:2px solid var(--color-text)`, 14 px / 700, vždy s počtem („Ke schválení 2“); aktivní vyplněná `--color-text`, bílé písmo; první = co čeká na mě | 44 px, jedna řada s vodorovným posunem |
| `.sz-filtry` | výběry 40 px, `1px solid var(--color-neutral-500)`, bílé pozadí; hledání vpravo 280 px | tlačítko „Filtry (n)“ 44 px + hledání přes zbytek šířky |
| `.sz-hlava` | H1 36 px + popis 15 px (max 72 znaků, 2 řádky); vpravo „↻ Načíst znovu“ (ghost) a nejvýš jedna akce, obě 40 px, nowrap | H1 28 px + ikona ↻ 44 px; hlavní akce pod nadpisem přes celou šířku |
| `.sz-prazdny` | `padding:24px 0 0 20px`: tučně co tu není (16 px), proč / kdy se objeví (14 px šedě), nejvýš jeden odkaz | stejné |

Kostra (`<spojka-kostra>`, F14): výška řádku 64 / 72 px, bloky v místě kotvy, titulku + popisu a stavu.

## Tvar řádku v `renderVals`

```js
radek({ kotva, kotva2, titulek, popis: [..], stav, ceka, zrus, typ, pro, go, id })
// → { kotva, kotva2, titulek, popis: 'a · b', stav: { t, druh: 'ceka'|'stav'|'zrus' } | null,
//     stitky: [{ t, druh: 'typ'|'pro' }], ceka, zrus, go, id }
```
- `kotva2` = den v týdnu a čas spojené „ · “ („so · 09:00“); rok jen mimo letošek, a to v `kotva2` („so · 2025 · 09:00“), aby se kotva vešla do 88 px.
- `popis` – `radek()` vynechá prázdné části (oprava „· ·“).
- `ceka = true` jen když je na řadě přihlášený uživatel; `stav.druh` je pak `ceka`.

## Pořadí převodu
1. Kalendář (okres, sbor) a Dokumenty (okres, sbor) – po převodu snímky do `docs/claude-design/seznamy/`.
2. Žádosti, Příspěvky, Změny sborů, Přihlášky členů, Přestupy.
3. Soutěže, Školení, Jednání VV, Rezervace / výpůjčky.
4. Tabulky (Seznam členů, Kvalifikace, Kontakty, Záznam změn, Majetek): stejná výška řádku 64 px; na telefonu jako `.sz-radek` (1. sloupec = titulek, ostatní do popisu).
