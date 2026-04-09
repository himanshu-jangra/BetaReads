// ============================================================
// BetaReads — Sync Engine (Offline Queue + Auto-Sync)
// ============================================================

const Sync = (() => {
  let syncInterval = null;
  let isSyncing = false;
  const SYNC_INTERVAL_MS = 60000; // 60 seconds
  const MAX_RETRIES = 3;
  const BASE_RETRY_DELAY = 2000; // 2 seconds

  /**
   * Initialize sync engine
   */
  function init() {
    // Sync on page load
    syncAll();

    // Sync every 60 seconds
    syncInterval = setInterval(syncAll, SYNC_INTERVAL_MS);

    // Sync on reconnect
    window.addEventListener('online', () => {
      updateStatus('syncing');
      syncAll();
    });

    window.addEventListener('offline', () => {
      updateStatus('offline');
    });

    // Set initial status
    updateStatus(navigator.onLine ? 'synced' : 'offline');
  }

  /**
   * Add feedback to sync queue
   */
  function queueFeedback(writingTitle, feedback) {
    const item = {
      id: crypto.randomUUID(),
      writingTitle,
      feedback,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    Storage.addToSyncQueue(item);
    updateStatus('syncing');

    // Try to sync immediately
    if (navigator.onLine) {
      syncAll();
    } else {
      updateStatus('offline');
    }

    return item.id;
  }

  /**
   * Sync all queued items
   */
  async function syncAll() {
    if (isSyncing) return;
    if (!navigator.onLine) {
      updateStatus('offline');
      return;
    }

    const queue = Storage.getSyncQueue();
    if (queue.length === 0) {
      updateStatus('synced');
      return;
    }

    isSyncing = true;
    updateStatus('syncing');

    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
    if (!sheetUrl) {
      isSyncing = false;
      updateStatus('offline');
      return;
    }

    const failedItems = [];

    // Group by writing title for batch sending
    const grouped = {};
    queue.forEach(item => {
      if (!grouped[item.writingTitle]) {
        grouped[item.writingTitle] = [];
      }
      grouped[item.writingTitle].push(item);
    });

    for (const [writingTitle, items] of Object.entries(grouped)) {
      try {
        const feedbackBatch = items.map(item => item.feedback);
        const response = await fetchWithRetry(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'append_feedback',
            writingTitle,
            feedback: feedbackBatch
          })
        });

        const result = await response.json();

        if (result.status !== 'ok') {
          // Push back to failed
          items.forEach(item => {
            item.retries++;
            if (item.retries < MAX_RETRIES) {
              failedItems.push(item);
            }
          });
        }
      } catch (e) {
        items.forEach(item => {
          item.retries++;
          if (item.retries < MAX_RETRIES) {
            failedItems.push(item);
          }
        });
      }
    }

    // Update queue with only failed items
    Storage.setSyncQueue(failedItems);

    isSyncing = false;
    updateStatus(failedItems.length > 0 ? 'syncing' : 'synced');

    // Announce to screen readers
    announceStatus(failedItems.length > 0 ? 'Some feedback items are pending sync.' : 'All feedback synced.');
  }

  /**
   * Fetch with exponential backoff retry
   * Handles Google Apps Script redirect behavior
   */
  async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        // Google Apps Script redirects POST to GET for the response.
        // We must follow redirects (default behavior).
        const response = await fetch(url, { ...options, redirect: 'follow' });
        // GAS responses after redirect are typically 200 OK
        if (response.ok || response.type === 'opaque' || response.status === 0) {
          return response;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (e) {
        if (i === retries - 1) throw e;
        const delay = BASE_RETRY_DELAY * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Update sync status indicators in UI
   */
  function updateStatus(status) {
    document.querySelectorAll('.sync-dot').forEach(dot => {
      dot.className = `sync-dot ${status}`;
    });
    document.querySelectorAll('.sync-label').forEach(label => {
      const labels = { synced: 'Synced', syncing: 'Syncing…', offline: 'Offline' };
      label.textContent = labels[status] || status;
    });
  }

  /**
   * ARIA live announcement for screen readers
   */
  function announceStatus(message) {
    let announcer = document.getElementById('sync-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sync-announcer';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.className = 'sr-only';
      document.body.appendChild(announcer);
    }
    announcer.textContent = message;
  }

  /**
   * Get current queue size
   */
  function getQueueSize() {
    return Storage.getSyncQueue().length;
  }

  /**
   * Force a sync now
   */
  function syncNow() {
    return syncAll();
  }

  /**
   * Stop sync interval (cleanup)
   */
  function destroy() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  /**
   * Fetch feedback from Google Sheet for a writing (for Author dashboard)
   */
  async function fetchFeedback(writingTitle) {
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
    if (!sheetUrl) return [];

    try {
      const response = await fetch(`${sheetUrl}?action=get_feedback&tab=${encodeURIComponent(writingTitle)}`);
      const data = await response.json();
      if (data.status === 'ok') {
        return data.rows || [];
      }
    } catch (e) {
      console.error('Failed to fetch feedback:', e);
    }
    return [];
  }

  /**
   * Publish writing to Google Sheets backend
   */
  async function publishWriting(writingObj) {
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
    if (!sheetUrl || !navigator.onLine) return { status: 'offline' };

    const metadataJson = JSON.stringify({
      title: writingObj.title,
      writtenBy: writingObj.writtenBy,
      type: writingObj.type,
      config: writingObj.feedbackConfig,
      instructions: writingObj.instructions || '',
      password: writingObj.password || ''
    });

    const fullContentJson = JSON.stringify(writingObj.chapters || []);
    const CHUNK_SIZE = 40000;
    const chunks = [];
    
    for (let i = 0; i < fullContentJson.length; i += CHUNK_SIZE) {
      chunks.push({
        index: i / CHUNK_SIZE,
        text: fullContentJson.substring(i, i + CHUNK_SIZE)
      });
    }

    try {
      const response = await fetchWithRetry(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
           action: 'save_writing',
           slug: writingObj.slug,
           metadata_json: metadataJson,
           chunks: chunks
        })
      });
      return await response.json();
    } catch (e) {
      console.error('Publish writing failed', e);
      return { status: 'error', message: e.message };
    }
  }

  /**
   * Fetch writing from Google Sheets backend
   */
  async function fetchWriting(slug, sheetUrl) {
    if (!sheetUrl) return null;

    try {
      const response = await fetchWithRetry(`${sheetUrl}?action=get_writing&slug=${encodeURIComponent(slug)}`);
      const data = await response.json();
      if (data.status === 'ok') {
        let metadata = {};
        try { metadata = JSON.parse(data.metadata || "{}"); } catch (e) {}
        let chapters = [];
        try { chapters = JSON.parse(data.content || "[]"); } catch (e) {}
        
        return {
          slug: data.slug,
          title: metadata.title || 'Untitled',
          writtenBy: metadata.writtenBy || 'Author',
          type: metadata.type || 'Other',
          instructions: metadata.instructions || null,
          password: metadata.password || null,
          feedbackConfig: metadata.config || { inline:true, general:true, rating:true, structured:true },
          chapters: chapters,
        };
      }
    } catch (e) {
      console.error('Fetch remote writing failed', e);
    }
    return null;
  }

  return {
    init,
    queueFeedback,
    syncAll,
    syncNow,
    getQueueSize,
    updateStatus,
    destroy,
    fetchFeedback,
    publishWriting,
    fetchWriting
  };
})();
