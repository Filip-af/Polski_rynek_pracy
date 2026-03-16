/**
 * Main application entry point
 * Orchestrates data loading, rendering, and UI initialization
 */

(async function () {
  try {
    // Show loading message
    Utils.setStatus('busy', 'Ładowanie danych…');

    // Load data and official GUS age profile in parallel
    const [result, ageProfile] = await Promise.all([
      API.load(),
      API.loadAgeProfile(),
    ]);
    const { sectors, year, live } = result;

    // Store in global state
    window.APP_STATE.sectors = sectors;
    window.APP_STATE.ageProfile = ageProfile;

    // Calculate initial stats
    const total = sectors.reduce((sum, s) => sum + s.emp, 0);
    Utils.updateStats(total, live ? `${year} (live)` : `${year} (archiwalne)`);

    // Render UI
    Render.renderLegend('ai');
    Render.render(sectors, 'ai');
    Render.calcImpact(sectors);

    // Initialize interactions
    UI.initLayerControls(sectors, 'ai');
    UI.initModal();
    UI.initResize(sectors);

  } catch (error) {
    console.error('Fatal error:', error);
    Utils.setStatus(
      'warn',
      `⚠ Błąd aplikacji: ${error.message}`
    );
  }
})();
