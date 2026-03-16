/**
 * Configuration and constants
 * Color scales, layer definitions, API endpoints
 */

const CONFIG = {
  // API Configuration
  API: {
    BDL_BASE: 'https://bdl.stat.gov.pl/api/v1',
    POLAND_CODE: '000000000000',
    TIMEOUT: 9000,
    BATCH_SIZE: 15,
    CORS_PROXY: 'https://corsproxy.io/',
  },

  // Data configuration
  DATA: {
    FALLBACK_FILE: './data/sectors-2025.json',
    CACHE_KEY: 'bdl_data_cache',
    CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
    AGE_PROFILE_SUBJECT_ID: 'P3978',
    AGE_PROFILE_GROUPS: ['15-24', '25-34', '35-44', '45-54'],
    AGE_PROFILE_FALLBACK: {
      source: 'GUS BDL BAEL P3978 (fallback)',
      year: 2025,
      groups: {
        '15-24': { count: 961, share: 0 },
        '25-34': { count: 3643, share: 0 },
        '35-44': { count: 4987, share: 0 },
        '45-54': { count: 4493, share: 0 },
      },
    },
  },

  // Color palette
  COLORS: {
    bg: '#0a0a0a',
    surface: '#141414',
    surface2: '#1c1c1c',
    border: '#252525',
    border2: '#333',
    text: '#eeeae2',
    muted: '#666',
    muted2: '#444',
    accent: '#f5a623',
    green: '#4ade80',
    red: '#f87171',
    blue: '#60a5fa',
    purple: '#a78bfa',
  },

  // Font families
  FONTS: {
    display: "'Syne', sans-serif",
    body: "'Inter', -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  // Layer definitions
  LAYERS: {
    outlook: {
      label: 'Zmiana zatrudnienia 2019–2023 (%)',
      desc: 'Czerwony = kurczące się · Zielony = rosnące',
      colorFn: (d) => CONFIG.outlookColor(d.data.outlook),
      legendItems: [
        { c: '#7f1d1d', l: '< −10%' },
        { c: '#dc2626', l: '−4 do −10%' },
        { c: '#f97316', l: '−1 do −4%' },
        { c: '#6b7280', l: 'Stabilny' },
        { c: '#4ade80', l: '+1 do +4%' },
        { c: '#16a34a', l: '+5 do +9%' },
        { c: '#15803d', l: '≥ +10%' },
      ],
      type: 'items',
    },
    pay: {
      label: 'Mediana wynagrodzenia brutto (PLN / m-c) · Z-12 X 2022',
      desc: 'Ciemny = niższe · Jasnoniebieski = wyższe płace',
      colorFn: (d) => CONFIG.payScale(d.data.pay),
      type: 'gradient',
      min: 4000,
      max: 11000,
      unitL: '4 000 PLN',
      unitR: '11 000+ PLN',
    },
    ai: {
      label: 'Ekspozycja na AI · szacunek 0–10',
      desc: 'Czerwony = praca cyfrowa, głęboka transformacja · Zielony = praca fizyczna',
      colorFn: (d) => CONFIG.aiScale(d.data.ai),
      type: 'gradient',
      min: 0,
      max: 10,
      unitL: '0 — minimalna',
      unitR: '10 — maksymalna',
    },
    edu: {
      label: 'Typowe wykształcenie',
      desc:
        'Pomarańczowy = zawodowe · Niebieski = średnie · Fioletowy = wyższe',
      colorFn: (d) => CONFIG.eduMap[d.data.edu] || '#6b7280',
      legendItems: [
        { c: '#f97316', l: 'Zawodowe' },
        { c: '#60a5fa', l: 'Średnie' },
        { c: '#818cf8', l: 'Wyższe / Średnie' },
        { c: '#4338ca', l: 'Wyższe' },
      ],
      type: 'items',
    },
    age: {
      label: 'Wiek najbardziej zagrożony transformacją AI (heurystyka)',
      desc: 'Kolor pokazuje grupę wieku z najwyższym ryzykiem transformacji (na bazie BAEL P3978 + profil sektora)',
      colorFn: (d) => {
        const profile = Utils.getAgeRiskProfile(d.data);
        return CONFIG.ageRiskColor(profile.dominantAge);
      },
      legendItems: [
        { c: '#fb7185', l: '15–24: wejście na rynek i presja na role juniorskie' },
        { c: '#f59e0b', l: '25–34: przyspieszona transformacja kompetencji cyfrowych' },
        { c: '#a78bfa', l: '35–44: presja produktywności i reorganizacji ról' },
        { c: '#38bdf8', l: '45–54: ryzyko luki kompetencji i potrzeby reskillingu' },
      ],
      type: 'items',
    },
    balance: {
      label: 'AI: szansa vs zagrożenie (heurystyka sektorowa)',
      desc: 'Zielony = większa szansa; Czerwony = większe zagrożenie; Szary = równowaga',
      colorFn: (d) => {
        const profile = Utils.getAIChanceThreatProfile(d.data);
        return CONFIG.balanceColor(profile.label);
      },
      legendItems: [
        { c: '#22c55e', l: 'Szansa: AI + wzrost sektora + wyższa wartość pracy' },
        { c: '#6b7280', l: 'Równowaga: jednocześnie presja i szansa' },
        { c: '#ef4444', l: 'Zagrożenie: AI + spadek sektora + niska poduszka płacowa' },
      ],
      type: 'items',
    },
  },

  // Education color map
  EDU_MAP: {
    'Zawodowe': '#f97316',
    'Zawodowe / Średnie': '#fb923c',
    'Zawodowe / Podstawowe': '#fbbf24',
    'Średnie': '#60a5fa',
    'Średnie / Zawodowe': '#7dd3fc',
    'Wyższe / Zawodowe': '#a78bfa',
    'Wyższe / Średnie': '#818cf8',
    'Wyższe': '#4338ca',
  },
};

// ── Color scales ──────────────────────────────────────────────────────────

/**
 * Outlook (employment trend) color scheme
 */
CONFIG.outlookColor = (v) => {
  if (v <= -10) return '#7f1d1d';
  if (v <= -4) return '#dc2626';
  if (v < 0) return '#f97316';
  if (v === 0) return '#6b7280';
  if (v <= 4) return '#4ade80';
  if (v <= 9) return '#16a34a';
  return '#15803d';
};

/**
 * Pay (wage) color scale: blue gradient from dark to light
 */
CONFIG.payScale = d3.scaleSequential((t) =>
  d3.interpolate('#1e3a5f', '#38bdf8')(t)
).domain([4000, 11000]);

/**
 * AI exposure color scale: RdYlGn (Red-Yellow-Green)
 */
CONFIG.aiScale = d3.scaleSequential((t) =>
  d3.interpolateRdYlGn(1 - t)
).domain([0, 10]);

/**
 * AI bar color based on exposure level
 */
CONFIG.aiBarColor = (v) => {
  if (v >= 7) return '#f87171'; // Red - high exposure
  if (v >= 4) return '#f5a623'; // Orange - medium
  return '#4ade80'; // Green - low
};

CONFIG.ageRiskColor = (ageGroup) => {
  if (ageGroup === '15-24') return '#fb7185';
  if (ageGroup === '25-34') return '#f59e0b';
  if (ageGroup === '35-44') return '#a78bfa';
  return '#38bdf8';
};

CONFIG.balanceColor = (label) => {
  if (label === 'Szansa') return '#22c55e';
  if (label === 'Zagrożenie') return '#ef4444';
  return '#6b7280';
};

// Update LAYERS with computed color maps
CONFIG.LAYERS.edu.colorFn = (d) =>
  CONFIG.EDU_MAP[d.data.edu] || '#6b7280';

// Re-export eduMap for convenience
CONFIG.eduMap = CONFIG.EDU_MAP;
