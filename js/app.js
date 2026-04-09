// ============================================================
// BetaReads — App Shell (Router, Lifecycle, Init)
// ============================================================

const App = (() => {
  let currentView = null;
  let loginHandlerBound = false;

  /**
   * Initialize the application
   */
  function init() {
    // Initialize theme
    Theme.init();

    // Purge expired storage
    Storage.purgeExpired();

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);

    // Initial route
    handleRoute();
  }

  /**
   * Handle hash-based routing
   */
  function handleRoute() {
    const hash = window.location.hash || '#/';
    const path = hash.replace('#', '');

    // Cleanup previous view
    if (currentView === 'reader') {
      Reader.destroy();
    }

    // Route matching
    if (path.startsWith('/read/')) {
      const rawPath = path.replace('/read/', '');
      const parts = rawPath.split('?');
      const slug = parts[0];
      
      if (parts.length > 1) {
        const queryParams = new URLSearchParams('?' + parts[1]);
        if (queryParams.has('db')) {
           const dbUrl = atob(decodeURIComponent(queryParams.get('db')));
           Storage.set(Storage.KEYS.SHEET_URL, dbUrl);
           // Also make sure offline queue works for this DB right away
           window.dispatchEvent(new Event('online'));
        }
      }

      showView('reader-view');
      currentView = 'reader';
      Reader.init(slug);
    } else {
      // Main route — check setup/auth
      if (!Auth.isSetupComplete()) {
        showView('setup-view');
        currentView = 'setup';
        Setup.init();
      } else if (!Auth.isLoggedIn()) {
        showView('login-view');
        currentView = 'login';
        initLogin();
      } else {
        showView('dashboard-view');
        currentView = 'dashboard';
        Dashboard.init();
        // Update dashboard display name
        const session = Auth.getSession();
        const nameEl = document.getElementById('dashboard-author-name');
        if (nameEl && session) nameEl.textContent = session.displayName || 'Author';
      }
    }
  }

  /**
   * Show a view, hide others
   */
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
  }

  /**
   * Navigate to a route
   * Forces a re-route even if the hash is unchanged
   */
  function navigate(path) {
    const newHash = `#/${path}`;
    if (window.location.hash === newHash || (!window.location.hash && newHash === '#/')) {
      // Hash is the same — hashchange won't fire, so call handleRoute directly
      handleRoute();
    } else {
      window.location.hash = newHash;
    }
  }

  /**
   * Initialize login view
   */
  function initLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Remove any previously bound handler to prevent duplicates
    if (loginHandlerBound) {
      form.removeEventListener('submit', handleLogin);
    }
    form.addEventListener('submit', handleLogin);
    loginHandlerBound = true;

    // Clear any previous error
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.textContent = '';

    // Reset submit button state
    const submitBtn = document.getElementById('login-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }

    // Lockout check interval
    const lockoutEl = document.getElementById('login-lockout');
    if (lockoutEl) {
      setInterval(() => {
        if (Auth.isLockedOut()) {
          lockoutEl.classList.remove('hidden');
          const countdownEl = document.getElementById('lockout-countdown');
          if (countdownEl) countdownEl.textContent = `${Auth.getLockoutRemaining()}s`;
        } else {
          lockoutEl.classList.add('hidden');
        }
      }, 1000);
    }
  }

  /**
   * Handle login form submission
   */
  async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    if (!username || !password) {
      errorEl.textContent = 'Please enter both username and password.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Logging in…';

    const result = await Auth.login(username, password);

    if (result.success) {
      errorEl.textContent = '';
      // Navigate to dashboard — handleRoute is called directly if hash is already #/
      navigate('');
    } else {
      errorEl.textContent = result.error;

      if (result.lockout) {
        const lockoutEl = document.getElementById('login-lockout');
        if (lockoutEl) lockoutEl.classList.remove('hidden');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  }

  /**
   * Show a snackbar notification
   */
  function showSnackbar(message, duration = 3000) {
    let container = document.getElementById('snackbar-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'snackbar-container';
      container.className = 'snackbar-container';
      document.body.appendChild(container);
    }

    const snackbar = document.createElement('div');
    snackbar.className = 'snackbar';
    snackbar.textContent = message;

    container.appendChild(snackbar);

    setTimeout(() => {
      snackbar.classList.add('closing');
      snackbar.addEventListener('animationend', () => snackbar.remove());
    }, duration);
  }

  return {
    init,
    navigate,
    showView,
    showSnackbar,
    handleRoute
  };
})();

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', App.init);
