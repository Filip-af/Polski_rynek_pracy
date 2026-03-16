/**
 * UI interaction handlers
 */

const UI = {
  /**
   * Initialize layer controls
   */
  initLayerControls: (sectors, currentLayer) => {
    document.querySelectorAll('.btn[data-layer]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const newLayer = e.target.dataset.layer;

        // Update button states
        document.querySelectorAll('.btn[data-layer]').forEach((b) => {
          b.classList.remove('active');
        });
        e.target.classList.add('active');

        // Update visualization
        Render.renderLegend(newLayer);
        Render.render(sectors, newLayer);

        window.APP_STATE.currentLayer = newLayer;
      });
    });

    // Set initial active button
    document.querySelector(
      `.btn[data-layer="${currentLayer}"]`
    ).classList.add('active');
  },

  /**
   * Initialize modal controls
   */
  initModal: () => {
    const overlay = document.getElementById('overlay');

    window.openAbout = () => {
      overlay.classList.add('show');
    };

    window.closeAbout = () => {
      overlay.classList.remove('show');
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeAbout();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAbout();
    });
  },

  /**
   * Handle window resize (debounced re-render)
   */
  initResize: (sectors) => {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        Render.render(
          sectors,
          window.APP_STATE.currentLayer
        );
      }, 130);
    });
  },
};

/**
 * Global app state
 */
window.APP_STATE = {
  sectors: [],
  currentLayer: 'ai',
  ageProfile: null,
};
