// ============================================================
// BetaReads — Theme Manager (Dark / Light Mode)
// ============================================================

const Theme = (() => {
  const TOGGLE_ICON_LIGHT = '☀️';
  const TOGGLE_ICON_DARK = '🌙';

  /**
   * Initialize theme from localStorage or system preference
   */
  function init() {
    const saved = Storage.get(Storage.KEYS.THEME);
    if (saved) {
      apply(saved);
    } else {
      // Default to light mode per PRD
      apply('light');
    }
  }

  /**
   * Apply a theme
   */
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Storage.set(Storage.KEYS.THEME, theme);
    updateToggleButtons(theme);
  }

  /**
   * Toggle between light and dark
   */
  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    apply(next);
  }

  /**
   * Get current theme
   */
  function current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  /**
   * Update all toggle buttons on the page
   */
  function updateToggleButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.textContent = theme === 'dark' ? TOGGLE_ICON_LIGHT : TOGGLE_ICON_DARK;
      btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    });
  }

  return { init, apply, toggle, current };
})();
