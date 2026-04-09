// ============================================================
// BetaReads — Storage Helpers (localStorage with TTL support)
// ============================================================

const Storage = (() => {
  // Key constants from PRD Section 11
  const KEYS = {
    SHEET_URL: 'betareads_sheet_url',
    AUTH: 'betareads_auth',
    SESSION: 'betareads_session',
    WRITINGS: 'betareads_writings',
    WRITING_PREFIX: 'betareads_writing_',
    VIEWER_NAME: 'betareads_viewer_name',
    THEME: 'betareads_theme',
    FEEDBACK_PREFIX: 'betareads_feedback_',
    SYNC_QUEUE: 'betareads_sync_queue',
    SETUP_COMPLETE: 'betareads_setup_complete'
  };

  /**
   * Set a value with optional TTL (in days)
   */
  function set(key, value, ttlDays = null) {
    const item = {
      value,
      timestamp: Date.now()
    };
    if (ttlDays) {
      item.expiry = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);
    }
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.error('Storage.set failed:', e);
    }
  }

  /**
   * Get a value, returns null if expired or missing
   */
  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    } catch (e) {
      // Handle legacy non-JSON values
      return localStorage.getItem(key);
    }
  }

  /**
   * Remove a key
   */
  function remove(key) {
    localStorage.removeItem(key);
  }

  /**
   * Refresh TTL on an existing item
   */
  function refreshTTL(key, ttlDays) {
    const value = get(key);
    if (value !== null) {
      set(key, value, ttlDays);
    }
  }

  /**
   * Purge all expired items with betareads_ prefix
   */
  function purgeExpired() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('betareads_')) {
        try {
          const raw = localStorage.getItem(key);
          const item = JSON.parse(raw);
          if (item.expiry && Date.now() > item.expiry) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // Non-JSON item, skip
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }

  // Session storage (cleared on tab close)
  function setSession(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.setSession failed:', e);
    }
  }

  function getSession(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function removeSession(key) {
    sessionStorage.removeItem(key);
  }

  /**
   * Get writing data by slug
   */
  function getWriting(slug) {
    return get(KEYS.WRITING_PREFIX + slug);
  }

  /**
   * Set writing data by slug
   */
  function setWriting(slug, data) {
    set(KEYS.WRITING_PREFIX + slug, data);
  }

  /**
   * Get all writings metadata
   */
  function getWritings() {
    return get(KEYS.WRITINGS) || [];
  }

  /**
   * Update writings list
   */
  function setWritings(writings) {
    set(KEYS.WRITINGS, writings);
  }

  /**
   * Get feedback for a writing
   */
  function getFeedback(slug) {
    return get(KEYS.FEEDBACK_PREFIX + slug) || [];
  }

  /**
   * Set feedback for a writing (with 30-day TTL)
   */
  function setFeedback(slug, feedback) {
    set(KEYS.FEEDBACK_PREFIX + slug, feedback, 30);
  }

  /**
   * Get sync queue
   */
  function getSyncQueue() {
    return get(KEYS.SYNC_QUEUE) || [];
  }

  /**
   * Set sync queue
   */
  function setSyncQueue(queue) {
    set(KEYS.SYNC_QUEUE, queue);
  }

  /**
   * Add item to sync queue
   */
  function addToSyncQueue(item) {
    const queue = getSyncQueue();
    queue.push(item);
    setSyncQueue(queue);
  }

  /**
   * Clear sync queue
   */
  function clearSyncQueue() {
    remove(KEYS.SYNC_QUEUE);
  }

  // Purge on init
  purgeExpired();

  return {
    KEYS,
    set,
    get,
    remove,
    refreshTTL,
    purgeExpired,
    setSession,
    getSession,
    removeSession,
    getWriting,
    setWriting,
    getWritings,
    setWritings,
    getFeedback,
    setFeedback,
    getSyncQueue,
    setSyncQueue,
    addToSyncQueue,
    clearSyncQueue
  };
})();
