// ============================================================
// BetaReads — Content Protection (Viewer Page Only)
// ============================================================

const Protection = (() => {
  let isActive = false;
  let devtoolsCheckInterval = null;

  /**
   * Enable all protections on the reader page
   */
  function enable() {
    if (isActive) return;
    isActive = true;

    disableCopy();
    disableContextMenu();
    blockKeyboardShortcuts();
    enablePrintProtection();
    enableAntiScreenshot();
    enableDevToolsDetection();
  }

  /**
   * Disable all protections (for author dashboard)
   */
  function disable() {
    if (!isActive) return;
    isActive = false;

    document.removeEventListener('copy', preventEvent);
    document.removeEventListener('contextmenu', preventEvent);
    document.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeprint', handleBeforePrint);

    if (devtoolsCheckInterval) {
      clearInterval(devtoolsCheckInterval);
      devtoolsCheckInterval = null;
    }

    const overlay = document.getElementById('anti-screenshot-overlay');
    if (overlay) overlay.remove();

    const protectionOverlay = document.getElementById('protection-overlay');
    if (protectionOverlay) protectionOverlay.classList.remove('active');
  }

  /**
   * Prevent default event handler
   */
  function preventEvent(e) {
    e.preventDefault();
    return false;
  }

  /**
   * Disable text copying (but keep text selection for inline comments)
   */
  function disableCopy() {
    document.addEventListener('copy', preventEvent);
    // NOTE: We do NOT set user-select: none because the reader needs
    // text selection enabled for the inline highlight + comment feature.
    // The copy event listener blocks Ctrl+C/Cmd+C instead.
  }

  /**
   * Disable right-click context menu
   */
  function disableContextMenu() {
    document.addEventListener('contextmenu', preventEvent);
  }

  /**
   * Block keyboard shortcuts
   */
  function blockKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeydown);
  }

  function handleKeydown(e) {
    // Block: Ctrl+C, Ctrl+S, Ctrl+P, Ctrl+U, F12, Ctrl+Shift+I, Ctrl+Shift+J
    const blocked = [
      e.ctrlKey && e.key === 'c',
      e.ctrlKey && e.key === 's',
      e.ctrlKey && e.key === 'p',
      e.ctrlKey && e.key === 'u',
      e.key === 'F12',
      e.ctrlKey && e.shiftKey && e.key === 'I',
      e.ctrlKey && e.shiftKey && e.key === 'i',
      e.ctrlKey && e.shiftKey && e.key === 'J',
      e.ctrlKey && e.shiftKey && e.key === 'j',
      // Mac equivalents
      e.metaKey && e.key === 'c',
      e.metaKey && e.key === 's',
      e.metaKey && e.key === 'p',
      e.metaKey && e.key === 'u',
      e.metaKey && e.altKey && e.key === 'i',
      e.metaKey && e.altKey && e.key === 'j'
    ];

    if (blocked.some(Boolean)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }

  /**
   * Print protection
   */
  function enablePrintProtection() {
    window.addEventListener('beforeprint', handleBeforePrint);
  }

  function handleBeforePrint() {
    const overlay = document.getElementById('protection-overlay');
    if (overlay) overlay.classList.add('active');
  }

  /**
   * Anti-screenshot (best-effort CSS overlay)
   */
  function enableAntiScreenshot() {
    // Create a semi-transparent overlay with mix-blend-mode
    // This doesn't prevent screenshots but makes them less useful
    let overlay = document.getElementById('anti-screenshot-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'anti-screenshot-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        mix-blend-mode: difference;
        background: rgba(255,255,255,0.003);
        z-index: 9998;
      `;
      document.body.appendChild(overlay);
    }
  }

  /**
   * DevTools detection (best-effort)
   */
  function enableDevToolsDetection() {
    const threshold = 160;

    devtoolsCheckInterval = setInterval(() => {
      const widthDelta = window.outerWidth - window.innerWidth > threshold;
      const heightDelta = window.outerHeight - window.innerHeight > threshold;

      if (widthDelta || heightDelta) {
        showDevToolsWarning();
      } else {
        hideDevToolsWarning();
      }
    }, 1000);
  }

  /**
   * Show DevTools warning
   */
  function showDevToolsWarning() {
    const overlay = document.getElementById('protection-overlay');
    if (overlay && !overlay.classList.contains('active')) {
      overlay.classList.add('active');
    }
    // Blur the content
    const content = document.querySelector('.reader-content');
    if (content) {
      content.style.filter = 'blur(10px)';
    }
  }

  /**
   * Hide DevTools warning
   */
  function hideDevToolsWarning() {
    const overlay = document.getElementById('protection-overlay');
    if (overlay) overlay.classList.remove('active');
    const content = document.querySelector('.reader-content');
    if (content) {
      content.style.filter = '';
    }
  }

  return { enable, disable };
})();
