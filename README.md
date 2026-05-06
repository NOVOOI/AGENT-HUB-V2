# Novooi Ads Dashboard

Profesjonell Google Ads-analyse for [Novooi.no](https://novooi.no) — norsk premium nettbutikk for møbler og interiør med 100+ norske designere.

## Hva er dette?

Et statisk dashboard som:
- Henter live Google Ads-data via en Cloudflare Worker (proxy)
- Viser kampanjer, søkeord, søketermer, annonser og annonsegrupper
- Gir AI-drevne analyser og forslag via Claude API
- Genererer PDF-rapporter
- Sporer historikk og sammenligner perioder
- Visualiserer kontostruktur

---

## Filstruktur

```
novooi-ads/
├── index.html                  ← Redirect til pages/dashboard.html
├── README.md                   ← Denne filen
├── pages/
│   └── dashboard.html          ← Hele UI-strukturen (ingen inline JS)
├── css/
│   └── main.css                ← All styling med seksjonskommentarer
├── js/
│   ├── data.js                 ← State, PW_HASH, BENCHMARKS, TAB_PROMPTS
│   ├── helpers.js              ← Formatering, wPost, toast, setBtnLoading,
│   │                              buildSortableTable, filterTable, logAction
│   ├── render.js               ← Alle renderXxx-funksjoner
│   ├── ai.js                   ← Alle Claude API-kall (analyse, chat, PDF-tekst)
│   ├── report.js               ← PDF-generering med jsPDF
│   └── app.js                  ← Entry point: init, fetchAll, event delegation
└── .github/
    └── workflows/
        └── static.yml          ← GitHub Pages deploy
```

### Ansvarsfordeling (viktig)

| Fil | Inneholder |
|-----|-----------|
| `data.js` | All state (`state`-objektet), konstanter (`PW_HASH`, `BENCHMARKS`), `TAB_PROMPTS` |
| `helpers.js` | Rene utility-funksjoner — ingen DOM-state |
| `render.js` | DOM-rendering — leser fra `state`, skriver til DOM |
| `ai.js` | Alle `fetch`-kall mot Claude API — kaller render-funksjoner etter svar |
| `report.js` | PDF-logikk isolert fra resten |
| `app.js` | Eneste fil som binder events — importerer alt, eksporterer ingenting |

---

## Lokal utvikling

ES modules krever en HTTP-server (kan ikke åpne `file://` direkte).

```bash
# Alternativ 1 — npx serve
npx serve .

# Alternativ 2 — Python
python3 -m http.server 8080

# Åpne
open http://localhost:3000
```

---

## Cloudflare Worker

Dashboardet kommuniserer med en Cloudflare Worker som proxy mot Google Ads API og Claude API.

### Endepunkter Worker må støtte

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| POST | `/campaigns`    | Hent kampanjedata |
| POST | `/adgroups`     | Hent annonsegrupper |
| POST | `/ads`          | Hent annonser |
| POST | `/keywords`     | Hent søkeord |
| POST | `/searchterms`  | Hent søketermer |
| POST | `/structure`    | Hent kontostruktur |
| POST | `/history`      | Hent historikk-snapshots |
| POST | `/history/save` | Lagre snapshot |
| POST | `/ai`           | Claude API-kall (enkelt) |
| POST | `/chat`         | Claude API chat (multi-turn) |
| POST | `/memory/save`  | Lagre kampanjehukommelse |
| POST | `/memory/load`  | Last kampanjehukommelse |

### Autentisering

Alle kall sender headeren `X-App-Password`. Worker validerer mot SHA-256-hashen definert i `js/data.js`:

```javascript
// data.js
export const PW_HASH = 'dcd458ef...'; // SHA-256 av passord
```

For å bytte passord:
1. Kjør `crypto.subtle.digest('SHA-256', new TextEncoder().encode('nyttpassord'))` i konsollen
2. Konverter til hex-streng
3. Oppdater `PW_HASH` i `js/data.js`

---

## GitHub Pages deploy

Push til `main`-branchen trigget automatisk deploy via `.github/workflows/static.yml`.

Manuelt:
```bash
git add .
git commit -m "Oppdatering"
git push origin main
```

Aktiver GitHub Pages under **Settings → Pages → Source: GitHub Actions**.

---

## Legg til ny fane / side

1. **Legg til nav-knapp** i `pages/dashboard.html`:
   ```html
   <button class="nav-btn" data-page="min-side">Min side</button>
   ```

2. **Legg til page-section** i `pages/dashboard.html`:
   ```html
   <section id="page-min-side" class="page-section">
     <div class="page-header"><h1 class="page-title">Min side</h1></div>
     <!-- innhold -->
   </section>
   ```

3. **Legg til render-funksjon** i `js/render.js` og eksporter den.

4. **Kall render-funksjonen** fra `renderAll()` i `js/render.js`.

---

## Legg til ny AI-funksjon

1. Definer system-prompt og userMsg-funksjon i `js/data.js` under `TAB_PROMPTS` (om det er en fane-analyse), eller direkte i `js/ai.js`.

2. Eksporter funksjonen fra `js/ai.js`.

3. Importer og bind til en knapp i `js/app.js` under `bindEvents()`.

---

## CSS-variabler (korrekte navn)

| Hensikt | Variabel |
|---------|----------|
| Positiv/grønn | `var(--good)` |
| Advarsel/oransje | `var(--warn)` |
| Feil/rød | `var(--bad)` |
| Bakgrunn | `var(--bg)` |
| Sekundær bakgrunn | `var(--bg2)` |
| Dempet tekst | `var(--ink3)` |
| Monospace | `var(--mono)` |
| Serif | `var(--serif)` |

> **Merk:** Ikke bruk `var(--green)`, `var(--red)`, `var(--orange)`, `var(--taupe)` eller `var(--cream)` — disse er ikke definert og vil gi transparente farger.
