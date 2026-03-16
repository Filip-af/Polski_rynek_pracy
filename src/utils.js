/**
 * Utility functions for data manipulation and DOM interaction
 */

const Utils = {
  /**
   * Format absolute large number (generic helper)
   */
  formatNumber: (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(2).replace('.', ',') + ' M';
    if (n >= 1000) return (n / 1000).toFixed(2).replace('.', ',') + ' tys.';
    return Math.round(n) + '';
  },

  /**
   * Employment values are stored in thousands of people.
   * Example: 1273 = 1.273 million workers.
   */
  formatWorkersFromThousands: (n) => {
    if (n >= 1000) {
      const millions = (n / 1000).toFixed(2).replace('.', ',');
      return `${millions} mln osób`;
    }
    const thousands = Math.round(n).toLocaleString('pl-PL');
    return `${thousands} tys. osób`;
  },

  /**
   * Short worker format for compact cards.
   */
  formatWorkersShort: (n) => {
    if (n >= 1000) {
      return (n / 1000).toFixed(2).replace('.', ',') + ' mln';
    }
    return Math.round(n).toLocaleString('pl-PL') + ' tys.';
  },

  /**
   * Clamp helper for heuristic scores.
   */
  clamp: (v, min = 0, max = 10) => Math.max(min, Math.min(max, v)),

  /**
   * Estimate which age group is most exposed to AI transition risk in a sector.
   * Uses official GUS BAEL age profile (P3978) as base weights and
   * sector characteristics (AI exposure, trend, pay) as risk modifiers.
   */
  getAgeRiskProfile: (sector, ageProfile = null) => {
    const profile = ageProfile || window.APP_STATE?.ageProfile || CONFIG.DATA.AGE_PROFILE_FALLBACK;
    const ai = sector.ai || 0;
    const outlook = sector.outlook || 0;
    const pay = sector.pay || 0;

    const g = profile.groups || {};
    const shares = {
      '15-24': g['15-24']?.share || 0.2,
      '25-34': g['25-34']?.share || 0.3,
      '35-44': g['35-44']?.share || 0.3,
      '45-54': g['45-54']?.share || 0.2,
    };

    // Base transition pressure from sector profile.
    const pressure = 0.7 + (ai / 10) * 0.6 + (outlook < 0 ? 0.2 : 0) + (pay < 6000 ? 0.15 : 0);

    const v15_24 = Utils.clamp((shares['15-24'] * pressure * 0.95) * 10);
    const v25_34 = Utils.clamp((shares['25-34'] * pressure * 1.0) * 10);
    const v35_44 = Utils.clamp((shares['35-44'] * pressure * 1.05) * 10);
    const v45_54 = Utils.clamp((shares['45-54'] * pressure * 1.15) * 10);

    const scores = [
      { key: '15-24', value: v15_24 },
      { key: '25-34', value: v25_34 },
      { key: '35-44', value: v35_44 },
      { key: '45-54', value: v45_54 },
    ].sort((a, b) => b.value - a.value);

    return {
      dominantAge: scores[0].key,
      score: scores[0].value,
      details: scores,
      source: profile.source || 'GUS BAEL P3978',
      sourceYear: profile.year || null,
    };
  },

  /**
   * Estimate if AI is more likely an opportunity or threat for a sector.
   */
  getAIChanceThreatProfile: (sector) => {
    const ai = sector.ai || 0;
    const outlook = sector.outlook || 0;
    const pay = sector.pay || 0;

    const opportunity = Utils.clamp(
      ai * 0.58 + Math.max(outlook, 0) * 0.45 + Math.max((pay - 6000) / 1000, 0)
    );

    const threat = Utils.clamp(
      ai * 0.72 + Math.max(-outlook, 0) * 0.55 + Math.max((6000 - pay) / 1000, 0)
    );

    let label = 'Równowaga';
    if (opportunity - threat >= 1) label = 'Szansa';
    if (threat - opportunity >= 1) label = 'Zagrożenie';

    return { opportunity, threat, label };
  },

  /**
   * Format as percentage of total
   */
  formatPercent: (n, total) => {
    return ((n / total) * 100).toFixed(1) + '%';
  },

  /**
   * Delay for async operations
   */
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Fetch with timeout
   */
  fetchWithTimeout: async (url, timeout = CONFIG.API.TIMEOUT) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`timeout (${timeout}ms)`);
      }
      throw err;
    }
  },

  /**
   * Validate sector data
   */
  validateSector: (sector) => {
    const rules = [
      sector.code && sector.code.length === 1,
      sector.emp > 0,
      sector.pay >= 2500 && sector.pay <= 15000,
      sector.outlook >= -20 && sector.outlook <= 20,
      sector.ai >= 0 && sector.ai <= 10,
    ];
    return rules.every((r) => r);
  },

  /**
   * Deep clone object
   */
  clone: (obj) => JSON.parse(JSON.stringify(obj)),

  /**
   * Get from localStorage with expiry check
   */
  getCache: (key, maxAge = CONFIG.DATA.CACHE_DURATION) => {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    try {
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      if (age > maxAge) {
        localStorage.removeItem(key);
        return null;
      }
      return data.value;
    } catch (err) {
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Set cache with timestamp
   */
  setCache: (key, value) => {
    localStorage.setItem(
      key,
      JSON.stringify({ value, timestamp: Date.now() })
    );
  },

  /**
   * Show notification in API bar
   */
  setStatus: (type, message, year = null) => {
    const bar = document.getElementById('api-bar');
    const chain = document.getElementById('api-chain');
    const spin = document.getElementById('api-spin');
    const ytag = document.getElementById('api-ytag');

    bar.className = type; // 'busy', 'ok', 'warn'
    chain.textContent = message;
    spin.style.display = type === 'busy' ? 'block' : 'none';

    if (year) {
      ytag.textContent = year;
      ytag.style.display = 'inline';
    } else {
      ytag.style.display = 'none';
    }

    // Auto-collapse success bar after 3.5s
    if (type === 'ok') {
      setTimeout(() => bar.classList.add('collapsed'), 3500);
    }
  },

  /**
   * Update live data badge
   */
  setBadgeLive: (isLive) => {
    document.getElementById('badge-live').style.display = isLive
      ? 'inline-flex'
      : 'none';
    document.getElementById('badge-static').style.display = isLive
      ? 'none'
      : 'inline-flex';
  },

  /**
   * Update header stats
   */
  updateStats: (total, year) => {
    document.getElementById('stat-total').textContent = Utils.formatWorkersShort(
      total
    );
    document.getElementById('stat-year').textContent = year || '—';
  },

  /**
   * Parse PKD section from variable name
   */
  extractPKDSection: (variableName, dimensionName = '') => {
    const fullText = (variableName + ' ' + dimensionName).toUpperCase();

    // Try pattern: SEKCJA A, sekcji A, etc.
    let match = fullText.match(/SEKCJ[A-Z]\s+([A-S])\b/);
    if (match) return match[1];

    // Try pattern: A – something
    match = fullText.match(/\b([A-S])\s*[-–—]\s*[A-ZŁÓŚŹĆĘĄ]/);
    if (match) return match[1];

    // Try pattern: just A
    match = fullText.match(/\b([A-S])\b/);
    if (match) return match[1];

    return null;
  },

  /**
   * Create tooltip HTML
   */
  createTooltip: (sector, layer) => {
    const colorValue = CONFIG.LAYERS[layer]?.colorFn(sector) || '#666';
    const ageProfile = Utils.getAgeRiskProfile(sector.data);
    const balance = Utils.getAIChanceThreatProfile(sector.data);
    const metric = {
      outlook: `${sector.data.outlook > 0 ? '+' : ''}${sector.data.outlook}%`,
      pay: `${sector.data.pay.toLocaleString('pl-PL')} PLN`,
      ai: `${sector.data.ai}/10`,
      edu: sector.data.edu,
      age: `${ageProfile.dominantAge} (score ${ageProfile.score.toFixed(1)}/10)`,
      balance: `${balance.label} (S ${balance.opportunity.toFixed(1)} / Z ${balance.threat.toFixed(1)})`,
    }[layer] || '—';

    let html = `
      <div class="tt-code">${sector.data.code}</div>
      <div class="tt-name">${sector.data.name.replace(/\n/g, ' ')}</div>
      <div class="tt-grid">
        <div class="tt-k">Zatrudnienie:</div>
        <div class="tt-v">${Utils.formatWorkersFromThousands(sector.data.emp)}</div>
        <div class="tt-k">Mediana wynagrodzenia:</div>
        <div class="tt-v">${sector.data.pay.toLocaleString('pl-PL')} PLN</div>
        <div class="tt-k">${CONFIG.LAYERS[layer].label}:</div>
        <div class="tt-v">${metric}</div>
      </div>
    `;

    if (layer === 'ai' || true) {
      html += `
        <div class="tt-aibar">
          <div class="tt-aibar-lbl">
            <span>Ekspozycja AI</span>
            <span>${sector.data.ai}/10</span>
          </div>
          <div class="tt-track">
            <div class="tt-fill" style="width: ${(sector.data.ai / 10) * 100}%; background: ${CONFIG.aiBarColor(sector.data.ai)}"></div>
          </div>
          <div class="tt-ainote">${sector.data.aiNote}</div>
        </div>
      `;
    }

    html += `<div class="tt-src">Źródło: ${sector.data.dataSource || 'GUS BDL'}</div>`;

    return html;
  },
};
