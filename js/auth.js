// ============================================================
// BetaReads — Auth Module (Login, Hashing, Session, Lockout)
// ============================================================

const Auth = (() => {
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_SECONDS = 30;
  let failedAttempts = 0;
  let lockoutEndTime = null;

  /**
   * SHA-256 hash using Web Crypto API
   */
  async function hashPassword(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if user is in lockout period
   */
  function isLockedOut() {
    if (!lockoutEndTime) return false;
    if (Date.now() < lockoutEndTime) return true;
    // Lockout expired
    lockoutEndTime = null;
    failedAttempts = 0;
    return false;
  }

  /**
   * Get remaining lockout seconds
   */
  function getLockoutRemaining() {
    if (!lockoutEndTime) return 0;
    return Math.max(0, Math.ceil((lockoutEndTime - Date.now()) / 1000));
  }

  /**
   * Fetch from Google Apps Script (handles 302 redirect properly)
   */
  async function fetchFromSheet(url, options = {}) {
    const response = await fetch(url, {
      redirect: 'follow',
      ...options
    });
    return response;
  }

  /**
   * Login with username and password
   * Returns { success: boolean, error?: string }
   */
  async function login(username, password) {
    if (isLockedOut()) {
      return { success: false, error: `Too many attempts. Try again in ${getLockoutRemaining()} seconds.` };
    }

    const passwordHash = await hashPassword(password);

    // Try cached credentials first
    let credentials = Storage.get(Storage.KEYS.AUTH);

    // If no cached credentials, try fetching from sheet
    if (!credentials) {
      const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
      if (sheetUrl) {
        try {
          const response = await fetchFromSheet(`${sheetUrl}?action=get_credentials`);
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (parseErr) {
            console.error('Failed to parse credentials response:', text.substring(0, 200));
            return { success: false, error: 'Invalid response from server. Check your Apps Script deployment.' };
          }
          if (data.status === 'ok' && data.config) {
            credentials = {
              username: data.config.username,
              passwordHash: data.config.password_hash,
              displayName: data.config.display_name,
              email: data.config.email
            };
            // Cache for offline use
            Storage.set(Storage.KEYS.AUTH, credentials);
          }
        } catch (e) {
          console.error('Fetch credentials failed:', e);
          // If offline and no cache, can't login
          if (!credentials) {
            return { success: false, error: 'Cannot verify credentials. Please check your internet connection.' };
          }
        }
      } else {
        return { success: false, error: 'No configuration found. Please complete setup first.' };
      }
    }

    if (!credentials) {
      return { success: false, error: 'No credentials found. Please complete setup.' };
    }

    // Compare
    if (username === credentials.username && passwordHash === credentials.passwordHash) {
      // Success
      failedAttempts = 0;
      lockoutEndTime = null;
      const token = crypto.randomUUID();
      Storage.setSession(Storage.KEYS.SESSION, {
        token,
        username: credentials.username,
        displayName: credentials.displayName,
        loginTime: Date.now()
      });
      return { success: true };
    }

    // Failure
    failedAttempts++;
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockoutEndTime = Date.now() + (LOCKOUT_SECONDS * 1000);
      return { success: false, error: `Too many failed attempts. Locked for ${LOCKOUT_SECONDS} seconds.`, lockout: true };
    }

    return { success: false, error: `Invalid username or password. ${MAX_ATTEMPTS - failedAttempts} attempts remaining.` };
  }

  /**
   * Check if there's an active session
   */
  function isLoggedIn() {
    const session = Storage.getSession(Storage.KEYS.SESSION);
    return session !== null;
  }

  /**
   * Get current session info
   */
  function getSession() {
    return Storage.getSession(Storage.KEYS.SESSION);
  }

  /**
   * Logout — clear session
   */
  function logout() {
    Storage.removeSession(Storage.KEYS.SESSION);
  }

  /**
   * Check if setup is complete
   */
  function isSetupComplete() {
    return Storage.get(Storage.KEYS.SETUP_COMPLETE) === true;
  }

  /**
   * Create account during setup
   */
  async function createAccount(data) {
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
    if (!sheetUrl) {
      return { success: false, error: 'Google Sheet URL not configured.' };
    }

    const passwordHash = await hashPassword(data.password);

    // Always cache credentials locally first (in case the sheet POST fails due to CORS)
    Storage.set(Storage.KEYS.AUTH, {
      username: data.username,
      passwordHash,
      displayName: data.displayName,
      email: data.email
    });
    Storage.set(Storage.KEYS.SETUP_COMPLETE, true);

    try {
      const response = await fetchFromSheet(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setup_account',
          displayName: data.displayName,
          email: data.email,
          username: data.username,
          passwordHash
        })
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        // POST succeeded (credentials already cached), but response wasn't JSON.
        // This can happen with Google Apps Script redirects. Treat as success.
        console.warn('Account POST response not JSON, but credentials are cached locally.');
        return { success: true };
      }

      if (result.status === 'ok') {
        return { success: true };
      }

      return { success: false, error: result.message || 'Failed to save to Google Sheet, but credentials are saved locally.' };
    } catch (e) {
      // Even if the network call fails, credentials are cached locally
      console.warn('Network error during account creation, but credentials are cached locally:', e);
      return { success: true };
    }
  }

  /**
   * Validate Google Sheet URL by sending a ping
   */
  async function validateSheetUrl(url) {
    try {
      const response = await fetchFromSheet(`${url}?action=ping`);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return false;
      }
      return data.status === 'betareads_ok';
    } catch (e) {
      return false;
    }
  }

  return {
    hashPassword,
    login,
    isLoggedIn,
    getSession,
    logout,
    isSetupComplete,
    createAccount,
    validateSheetUrl,
    isLockedOut,
    getLockoutRemaining
  };
})();
