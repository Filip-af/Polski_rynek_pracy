# Polski Rynek Pracy — Wizualizator PKD 2007

**Interaktywna mapa zatrudnienia i wpływu AI na polską gospodarkę.**

Zainspirowane przez [karpathy.ai/jobs](https://karpathy.ai/jobs) — replikacja metodologii wizualizacji rynku pracy dla Polski.

**Dane:**
- 📊 Zatrudnienie: GUS BDL API (live, ≤7 dni cache) + JSON fallback (stan 31.12.2023)
- 💰 Wynagrodzenia: Struktura wynagrodzeń Z-12 X 2022 (GUS)
- 🤖 Ekspozycja AI: Szacunki LLM wg metodologii Karpathy (0–10)
- 📈 Wpływ na PKB: McKinsey GI / OECD 2024 (+1–3%/rok)

---

## 🏗 Architektura projektu

```
Polski_rynek_pracy/
├── index.html              # Czysty HTML (struktura)
├── style.css               # Styling (12 sekcji, responsive)
├── data/
│   └── sectors-2025.json   # Fallback + metadata (19 sekcji PKD)
├── src/
│   ├── config.js           # Kolory, skale, definicje warstw
│   ├── utils.js            # Funkcje pomocnicze (format, cache, DOM)
│   ├── api.js              # GUS BDL + fallback, retry logic
│   ├── render.js           # D3 treemap, legenda, impact calc
│   ├── ui.js               # Event handlers, modal, resize
│   └── app.js              # Entry point, orchestration
└── README.md               # Ta dokumentacja
```

**Poprzednia struktura:** Monolityczny plik HTML (~770 KB) z wbudowanym CSS i JS.
**Nowa struktura:** Modułowa, maintainable, ~110 KB HTML + split files.

---

## 🚀 Uruchomienie

### Lokalnie (bez API)
```bash
# Serwer HTTP (Chrome blokuje CORS w file://)
python -m http.server 8000
# http://localhost:8000
```

### Online
Wrzuć zawartość repo na dowolny statyczny hosting (GitHub Pages, Netlify, etc.)

---

## 📦 Dane i źródła

### Zatrudnienie (GUS BDL)
- **Endpoint:** `GET /api/v1/data/by-unit/000000000000?var-id=...`
- **Problem:** ~50 zmiennych (19 sekcji × 3 płci) → batching po 15
- **Fallback:** `data/sectors-2025.json` (dane za 2023-12-31)
- **Cache:** localStorage, 7 dni
- **Jednostka:** `emp` jest w **tys. osób** (np. `1273` = `1,273 mln osób`)

**Dokładne requesty wykonywane przez aplikację:**
- `GET https://bdl.stat.gov.pl/api/v1/subjects?parent-id=G479&format=json&lang=pl&page-size=50`
- `GET https://bdl.stat.gov.pl/api/v1/variables?subject-id={subjectId}&format=json&lang=pl&page-size=150`
- `GET https://bdl.stat.gov.pl/api/v1/data/by-unit/000000000000?format=json&var-id={id1}&var-id={id2}&page-size=100`

### Wynagrodzenia (GUS Z-12, X 2022)
- Mediana brutto, podmioty ≥ 10 pracowników
- Źródło: https://stat.gov.pl/obszary-tematyczne/rynek-pracy/
- **Status:** Statyczne, brak API

### Ekspozycja na AI (Szacunek)
- Ocena 0–10 wg metodologii Karpathy
- Oparta na: cyfrowy charakter pracy, automatyzacja potencjalna
- **Nie jest:** prognozą ani oficalnym wskaźnikiem
- **To:** szacunkiem LLM dla celów edukacyjnych

### Wiek a ryzyko AI (oficjalne tablice GUS + model sektorowy)
- Oficjalna baza wieku: **GUS BDL BAEL `P3978` (Pracujacy wedlug wieku)**
- Endpointy:
  - `GET https://bdl.stat.gov.pl/api/v1/variables?subject-id=P3978&format=json&lang=en`
  - `GET https://bdl.stat.gov.pl/api/v1/data/by-unit/000000000000?format=json&var-id=1614883&var-id=1614885&var-id=1614887&var-id=1614889&page-size=100`
- Model ryzyka wieku laczy oficjalne udzialy wieku z profilem sektora (AI, trend zatrudnienia, place).

### PKB Impact (McKinsey / OECD 2024)
- +1–3% PKB rocznie z produktywności AI (5-letni horyzont)
- Przy PKD Polsce ~3 100 mld PLN → +31–93 mld PLN/rok (szacunek)

### Słownik skrótów
- **GUS**: Główny Urząd Statystyczny
- **BDL**: Bank Danych Lokalnych (API GUS)
- **PKD**: Polska Klasyfikacja Działalności
- **AI**: sztuczna inteligencja
- **LLM**: duży model językowy
- **PKB**: produkt krajowy brutto
- **FTE**: Full-Time Equivalent (ekwiwalent pełnego etatu)

---

## 🔧 Rozbudowa i maintenance

### Dodanie nowej warstwy (kolumny)
```javascript
// src/config.js
LAYERS.newMetric = {
  label: "Twoja metrika",
  desc: "Opis",
  colorFn: (d) => yourScale(d.data.yourField),
  legendItems: [...],
  type: "items"  // lub "gradient"
};
```

### Aktualizacja danych sektorów
```bash
# Edytuj data/sectors-2025.json
# API zawsze próbuje live, fallback jest automatyczny
```

### Aktualizacja wynagrodzeń (ręczna)
Pobierz najnowsze Z-12 z GUS, zmiennie wartości w `data/sectors-2025.json`:
```json
{
  "code": "J",
  "name": "IT",
  "pay": 10500,
  "trends": {
    "2022": 10200,
    "2023": 10500,
    "2024": 11000
  }
}
```

### Testing & Errors
```javascript
// W devtools
APP_STATE.sectors          // Dane sektora
window.CONFIG.LAYERS       // Definicje warstw
Utils.formatNumber(1234)   // Testy funkcji
```

---

## 📊 Dane wbudowane vs API

| Aspekt | Live BDL | JSON Fallback |
|--------|----------|---------------|
| Świeżość | ≤ 1 dzień | 31.12.2023 |
| Warunki | Sieć internet | Zawsze (offline ok) |
| Ściśliwość | API + parsing | 1 plik JSON |
| Cache | 7 dni localStorage | — |

**Strategia:** BDL API spróbuj → fallback do JSON → hardcoded FALLBACK (nigdy się nie pojawiło w praktyce)

---

## ⚠ Ograniczenia i zastrzeżenia

1. **Ekspozycja na AI** — szacunek, nie prognoza
2. **Brak rozbitych danych** — tylko agregaty (nie widać podsekcji)
3. **API limit GUS** — 5 req/s, fallback do corsproxy.io
4. **Wynagrodzenia** — X 2022, aktualizacja ręczna
5. **Metodologia zmian** — outlook (2019–2023), może się zmienić

---

## 🔗 Linki i kredyty

- **Inspiracja:** [Andrej Karpathy — karpathy.ai/jobs](https://karpathy.ai/jobs)
- **Dane:** [GUS BDL API](https://bdl.stat.gov.pl/) (CC BY 4.0)
- **Wizualizacja:** [D3.js](https://d3js.org/)
- **Licencja:** CC BY 4.0 (dane GUS)

---

## 🐛 Znane problemy

- [ ] Gradient legend nie renderuje — TODO
- [ ] Mobile: tooltips mogą być poza viewport
- [ ] BDL API czasem timeout → proxyowanie

---

## 📝 Changelog

### v2.0 (2025-03-16)
- 🔄 Refactor: monolityczna → modułowa architektura
- ✨ Nowe: cache localStorage, retry logic, CORS fallback
- 📚 Dokumentacja: dodana w README
- 🎨 Czysty HTML/CSS bez wbudowanego kodu
- 📦 Modułowe JS (config, utils, api, render, ui, app)

### v1.0 (2025-03-xx)
- Początkowa wersja: monolityczny index.html
