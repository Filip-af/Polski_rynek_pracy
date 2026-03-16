/**
 * API integration module
 * Handles fetching data from GUS BDL and fallback sources
 */

const API = {
  /**
   * Fetch with automatic CORS proxy fallback
   */
  fetch: async (url, maxAttempts = 2) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await Utils.fetchWithTimeout(url);
        if (response.ok) return response;
        throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        console.warn(`Attempt ${attempt} failed for ${url}:`, err.message);

        // On last attempt or if not a network/timeout error, try CORS proxy
        if (attempt === maxAttempts && (err.message.includes('timeout') ||
          err.message.includes('Failed to fetch'))) {
          try {
            const proxyUrl =
              CONFIG.API.CORS_PROXY +
              '?' +
              encodeURIComponent(url);
            return await Utils.fetchWithTimeout(proxyUrl);
          } catch (proxyErr) {
            console.warn('CORS proxy also failed:', proxyErr.message);
            throw proxyErr;
          }
        }

        if (attempt < maxAttempts) {
          await Utils.delay(1000 * attempt); // Exponential backoff
        }
      }
    }
  },

  /**
   * Load fallback/static data from sectors-2025.json
   * Uses preloaded data if available (instant), otherwise fetches asynchronously
   */
  loadFallback: async () => {
    // Use preloaded data if available (instant, no async needed)
    if (window.PRELOADED_FALLBACK && Array.isArray(window.PRELOADED_FALLBACK)) {
      console.log('Using preloaded fallback data (instant, ' + window.PRELOADED_FALLBACK.length + ' sectors)');
      return window.PRELOADED_FALLBACK;
    }

    // Fallback to async fetch if preload failed
    try {
      const response = await fetch(CONFIG.DATA.FALLBACK_FILE);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.sectors || [];
    } catch (err) {
      console.error('Failed to load fallback data:', err);
      return [];
    }
  },

  /**
   * Load official age profile from GUS BDL BAEL table P3978 (Pracujacy wedlug wieku).
   */
  loadAgeProfile: async () => {
    const fallback = Utils.clone(CONFIG.DATA.AGE_PROFILE_FALLBACK);
    try {
      const varsUrl = `${CONFIG.API.BDL_BASE}/variables?subject-id=${CONFIG.DATA.AGE_PROFILE_SUBJECT_ID}&format=json&lang=en`;
      const varsRes = await API.fetch(varsUrl);
      if (!varsRes.ok) throw new Error(`age variables ${varsRes.status}`);

      const varsPayload = await varsRes.json();
      const vars = varsPayload.results || [];

      const ageVars = [];
      for (const v of vars) {
        const detailUrl = `${CONFIG.API.BDL_BASE}/variables/${v.id}?format=json&lang=en`;
        const detailRes = await API.fetch(detailUrl);
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();

        const ageBand = detail.n2;
        const metricType = (detail.n3 || '').toLowerCase();
        if (!CONFIG.DATA.AGE_PROFILE_GROUPS.includes(ageBand)) continue;
        if (!metricType.includes('numerical')) continue;

        ageVars.push({ id: detail.id, ageBand });
      }

      if (ageVars.length === 0) throw new Error('Brak zmiennych wieku BAEL');

      const params = ageVars.map((v) => `var-id=${v.id}`).join('&');
      const dataUrl = `${CONFIG.API.BDL_BASE}/data/by-unit/${CONFIG.API.POLAND_CODE}?format=json&${params}&page-size=100`;
      const dataRes = await API.fetch(dataUrl);
      if (!dataRes.ok) throw new Error(`age by-unit ${dataRes.status}`);

      const dataPayload = await dataRes.json();
      const rows = dataPayload.results || [];
      if (rows.length === 0) throw new Error('Brak danych wieku BAEL');

      const groups = {};
      let latestYear = 0;

      rows.forEach((r) => {
        const mapEntry = ageVars.find((x) => x.id === r.id);
        if (!mapEntry) return;

        const vals = r.values || [];
        if (vals.length === 0) return;
        const latest = vals.reduce((a, b) => (Number(a.year) > Number(b.year) ? a : b));
        if (latest.val == null) return;

        groups[mapEntry.ageBand] = { count: Number(latest.val), share: 0 };
        latestYear = Math.max(latestYear, Number(latest.year || 0));
      });

      const total = Object.values(groups).reduce((s, g) => s + (g.count || 0), 0);
      if (total <= 0) throw new Error('Suma grup wieku = 0');

      Object.keys(groups).forEach((k) => {
        groups[k].share = groups[k].count / total;
      });

      return {
        source: 'GUS BDL BAEL P3978: Pracujacy wedlug wieku',
        year: latestYear || fallback.year,
        groups,
      };
    } catch (err) {
      console.warn('Age profile fallback:', err.message);
      const fallbackTotal = Object.values(fallback.groups).reduce((s, g) => s + g.count, 0);
      Object.keys(fallback.groups).forEach((k) => {
        fallback.groups[k].share = fallbackTotal > 0 ? fallback.groups[k].count / fallbackTotal : 0;
      });
      return fallback;
    }
  },

  /**
   * Main BDL fetch orchestration
   */
  fetchBDL: async (sectors) => {
    const startTime = performance.now();
    try {
      // Step 1: Find PKD section subject
      Utils.setStatus('busy',
        '[1/3] Szukam subgrup sekcji PKD w G479…'
      );

      const subjectsUrl = `${CONFIG.API.BDL_BASE}/subjects?parent-id=G479&format=json&lang=pl&page-size=50`;
      const subjectsRes = await API.fetch(subjectsUrl);
      if (!subjectsRes.ok) throw new Error(`subjects ${subjectsRes.status}`);

      const subjectsData = await subjectsRes.json();
      const allSubjects = subjectsData.results || [];

      // Try to find exact PKD section subject
      let targetSubject = allSubjects.find(
        (s) =>
          s.name &&
          s.name.toLowerCase().includes('sekcji pkd') &&
          s.name.toLowerCase().includes('siedziby')
      );

      if (!targetSubject) {
        targetSubject = allSubjects.find(
          (s) =>
            s.name && s.name.toLowerCase().includes('sekcji pkd')
        );
      }

      if (!targetSubject) {
        throw new Error('Nie znaleziono subgrupy PKD w G479');
      }

      // Step 2: Get variables
      Utils.setStatus(
        'busy',
        `[2/3] Zmienne: „${targetSubject.name.slice(0, 50)}…"`
      );

      const variablesUrl = `${CONFIG.API.BDL_BASE}/variables?subject-id=${targetSubject.id}&format=json&lang=pl&page-size=150`;
      const variablesRes = await API.fetch(variablesUrl);
      if (!variablesRes.ok)
        throw new Error(`variables ${variablesRes.status}`);

      const variablesData = await variablesRes.json();
      let allVariables = variablesData.results || [];

      // Filter for "total" aggregations
      let filteredVars = allVariables.filter((v) => {
        if (!v.dimensions) return false;
        const dimNames = v.dimensions
          .map((d) => (d.name || '').toLowerCase());
        return dimNames.some(
          (d) =>
            d === 'ogółem' ||
            d === 'total' ||
            d === 'razem' ||
            d === 'ogolem'
        );
      });

      if (filteredVars.length === 0) filteredVars = allVariables;
      if (filteredVars.length === 0) {
        throw new Error('Brak zmiennych w subgrupie');
      }

      // Step 3: Fetch data in batches
      const varIds = filteredVars.map((v) => v.id);
      const batches = [];
      for (let i = 0; i < varIds.length; i += CONFIG.API.BATCH_SIZE) {
        batches.push(varIds.slice(i, i + CONFIG.API.BATCH_SIZE));
      }

      Utils.setStatus(
        'busy',
        `[3/3] Pobieram dane PL (${batches.length} partii, ${varIds.length} zmiennych)…`
      );

      const allData = [];
      for (const batch of batches) {
        const params = batch.map((id) => `var-id=${id}`).join('&');
        const dataUrl = `${CONFIG.API.BDL_BASE}/data/by-unit/${CONFIG.API.POLAND_CODE}?format=json&${params}&page-size=100`;

        const dataRes = await API.fetch(dataUrl);
        if (!dataRes.ok) throw new Error(`by-unit ${dataRes.status}`);

        const dataPayload = await dataRes.json();
        allData.push(...(dataPayload.results || []));
      }

      // Step 4: Parse and map data
      const updates = {};
      let latestYear = 0;

      allData.forEach((unitVariable) => {
        const variable = filteredVars.find((v) => v.id === unitVariable.id) ||
          allVariables.find((v) => v.id === unitVariable.id);

        if (!variable || !variable.dimensions) return;

        // Extract PKD section letter
        let sectionLetter = null;
        const dimensionWithSection = variable.dimensions.find((d) => {
          const name = (d.name || '').toUpperCase();
          return /\bSEKCJ[A-Z]\s+[A-S]\b/.test(name) ||
            /^SEKCJA\s+[A-S]/.test(name) ||
            /^[A-S]\s*[-–—]/.test(name.trim()) ||
            /\b[A-S]\s*[-–—]\s*[A-ZŁÓŚŹĆĘĄ]/.test(name);
        });

        if (dimensionWithSection) {
          const match = (dimensionWithSection.name || '')
            .toUpperCase()
            .match(/\b([A-S])\b/);
          if (match) sectionLetter = match[1];
        }

        // Fallback: try to extract from variable name
        if (!sectionLetter && unitVariable.name) {
          const name = unitVariable.name.toUpperCase();
          let match = name.match(/SEKCJ[A-Z]\s+([A-S])\b/);
          if (!match) match = name.match(/\b([A-S])\s*[-–]/);
          if (match) sectionLetter = match[1];
        }

        if (!sectionLetter) return;

        // Get latest value
        const values = unitVariable.values || [];
        if (values.length === 0) return;

        const latest = values.reduce((a, b) =>
          a.year > b.year ? a : b
        );

        if (latest.val == null) return;

        updates[sectionLetter] = latest.val;
        if (latest.year > latestYear) latestYear = latest.year;
      });

      // Step 5: Merge with existing data
      const matched = Object.keys(updates).length;
      if (matched === 0) {
        throw new Error(
          'Nie dopasowano danych do sekcji PKD'
        );
      }

      // Keep one canonical unit in the app: thousands of workers (tys. osob).
      // Some BDL endpoints may return absolute persons, so normalize heuristically.
      const totalRaw = Object.values(updates).reduce((sum, v) => sum + Number(v || 0), 0);
      const looksLikePersonsUnit = totalRaw > 200000;
      if (looksLikePersonsUnit) {
        Object.keys(updates).forEach((k) => {
          updates[k] = Number(updates[k]) / 1000;
        });
      }

      const updated = sectors.map((s) => ({
        ...s,
        emp: updates[s.code] || s.emp,
        dataSource: 'BDL API live',
      }));

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      Utils.setStatus(
        'ok',
        `✓ BDL API: ${matched}/19 sekcji. Dane za ${latestYear}. Jednostka: tys. osob${looksLikePersonsUnit ? ' (przeliczone z osob)' : ''}. (${duration}s)`,
        latestYear
      );

      Utils.setBadgeLive(true);

      // Cache the successful result
      Utils.setCache(CONFIG.DATA.CACHE_KEY, updated);

      return { sectors: updated, year: latestYear, live: true };
    } catch (err) {
      console.error('BDL API error:', err);
      Utils.setStatus(
        'warn',
        `✗ BDL API: ${err.message} — używam dane archiwalne`
      );
      Utils.setBadgeLive(false);

      return {
        sectors,
        year: 2023,
        live: false,
        error: err.message,
      };
    }
  },

  /**
   * Smart load: try cache, then live, then fallback
   */
  load: async () => {
    try {
      // Try cache first
      const cached = Utils.getCache(CONFIG.DATA.CACHE_KEY);
      if (cached) {
        console.log('Using cached BDL data');
        Utils.setStatus(
          'ok',
          '✓ Dane z cache (7 dni)',
          null
        );
        Utils.setBadgeLive(true);
        return { sectors: cached, year: 2023, live: false };
      }

      // Load fallback first for immediate display
      Utils.setStatus('busy', 'Ładowanie danych…');
      const fallbackSectors = await API.loadFallback();

      // Try live
      return await API.fetchBDL(fallbackSectors);
    } catch (err) {
      console.error('Data load error:', err);
      throw err;
    }
  },
};
