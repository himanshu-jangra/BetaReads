// ============================================================
// BetaReads — Viewer Reading Page
// ============================================================

const Reader = (() => {
  let currentSlug = null;
  let currentWriting = null;
  let currentWritingMeta = null;
  let chapters = [];
  let activeChapter = 0;
  let chapterProgress = {};
  let scrollObserver = null;

  /**
   * Initialize reader for a slug
   */
  async function init(slug) {
    currentSlug = slug;

    // Get writing metadata
    const writings = Storage.getWritings();
    currentWritingMeta = writings.find(w => w.slug === slug);

    // Get writing content
    currentWriting = Storage.getWriting(slug);

    if (!currentWritingMeta || !currentWriting) {
      const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
      if (sheetUrl) {
        document.getElementById('reader-view').innerHTML = '<div style="padding:40px;text-align:center;color:var(--md-primary);">Downloading novel from server... please wait.</div>';
        
        const remoteWriting = await Sync.fetchWriting(slug, sheetUrl);
        if (remoteWriting) {
          currentWritingMeta = remoteWriting;
          currentWriting = { chapters: remoteWriting.chapters, chapterMode: true };
        } else {
          showError('Writing not found on server or link is invalid.');
          return;
        }
      } else {
        showError('Writing not found locally and no database connection provided.');
        return;
      }
    }

    chapters = currentWriting.chapters || [];
    chapterProgress = {};

    // Check for password
    if (currentWritingMeta.password) {
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const urlPassword = urlParams.get('pw');

      if (urlPassword) {
        const hash = await Auth.hashPassword(urlPassword);
        const expectedHash = await Auth.hashPassword(currentWritingMeta.password);
        if (hash !== expectedHash) {
          showPasswordGate();
          return;
        }
      } else {
        showPasswordGate();
        return;
      }
    }

    // Check for viewer identity
    const viewerName = Storage.get(Storage.KEYS.VIEWER_NAME);
    if (!viewerName) {
      showViewerIdentity();
      return;
    }

    // Refresh TTL
    Storage.refreshTTL(Storage.KEYS.VIEWER_NAME, 30);

    // Show reading interface
    showReadingInterface();
  }

  /**
   * Show password gate
   */
  function showPasswordGate() {
    const readerView = document.getElementById('reader-view');
    readerView.innerHTML = `
      <div class="password-gate">
        <div class="password-gate-card">
          <div class="lock-icon">🔒</div>
          <h2>This writing is protected</h2>
          <p class="font-body-medium text-muted">Enter the password to continue reading.</p>
          <div class="input-group">
            <div class="password-field">
              <input type="password" class="input-field" id="reader-password-input" placeholder="Enter password" autocomplete="off">
              <button class="password-toggle" onclick="Reader.togglePasswordVisibility()" aria-label="Toggle password visibility">👁️</button>
            </div>
            <span class="input-error" id="reader-password-error"></span>
          </div>
          <button class="btn btn-filled w-full" onclick="Reader.submitPassword()">Continue</button>
        </div>
      </div>
    `;
  }

  /**
   * Submit password for reader
   */
  async function submitPassword() {
    const input = document.getElementById('reader-password-input');
    const errorEl = document.getElementById('reader-password-error');
    const password = input.value;

    if (!password) {
      errorEl.textContent = 'Please enter a password.';
      return;
    }

    const hash = await Auth.hashPassword(password);
    const expectedHash = await Auth.hashPassword(currentWritingMeta.password);

    if (hash === expectedHash) {
      // Check viewer identity
      const viewerName = Storage.get(Storage.KEYS.VIEWER_NAME);
      if (!viewerName) {
        showViewerIdentity();
      } else {
        Storage.refreshTTL(Storage.KEYS.VIEWER_NAME, 30);
        showReadingInterface();
      }
    } else {
      errorEl.textContent = 'Incorrect password.';
      input.classList.add('error');
    }
  }

  /**
   * Toggle password visibility in reader gate
   */
  function togglePasswordVisibility() {
    const input = document.getElementById('reader-password-input');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  /**
   * Show viewer identity screen
   */
  function showViewerIdentity() {
    const readerView = document.getElementById('reader-view');
    const instructionsHtml = currentWritingMeta.instructions
      ? `<div class="viewer-instructions">${Markdown.escapeHtml(currentWritingMeta.instructions)}</div>`
      : '';

    readerView.innerHTML = `
      <div class="viewer-identity-screen">
        <div class="viewer-identity-card">
          <h1>${Markdown.escapeHtml(currentWritingMeta.title)}</h1>
          <p class="writing-credit">Written by ${Markdown.escapeHtml(currentWritingMeta.writtenBy || 'Author')}</p>
          ${instructionsHtml}
          <div class="input-group" style="text-align:left;">
            <label for="viewer-name-input">Your Name</label>
            <input type="text" class="input-field" id="viewer-name-input" placeholder="Enter your name (for reference only)" autocomplete="off">
            <span class="input-helper">Your name is shown next to your comments. No account is created.</span>
          </div>
          <label class="checkbox">
            <input type="checkbox" id="viewer-agree-checkbox">
            <span>I agree not to copy, share, or distribute this content.</span>
          </label>
          <button class="btn btn-filled btn-lg w-full" onclick="Reader.startReading()" id="start-reading-btn" disabled>Start Reading</button>
        </div>
      </div>
    `;

    // Enable button when checkbox is checked
    const checkbox = document.getElementById('viewer-agree-checkbox');
    const startBtn = document.getElementById('start-reading-btn');
    checkbox.addEventListener('change', () => {
      startBtn.disabled = !checkbox.checked;
    });
  }

  /**
   * Start reading (after identity screen)
   */
  function startReading() {
    const nameInput = document.getElementById('viewer-name-input');
    const name = nameInput?.value.trim() || 'Anonymous Reader';

    Storage.set(Storage.KEYS.VIEWER_NAME, name, 30);
    showReadingInterface();
  }

  /**
   * Show the main reading interface
   */
  function showReadingInterface() {
    const readerView = document.getElementById('reader-view');
    const typeClass = `type-${(currentWritingMeta.type || 'other').toLowerCase().replace(/\s+/g, '-')}`;

    readerView.innerHTML = `
      <div class="reader-container">
        <!-- Top Bar -->
        <div class="reader-topbar">
          <div class="reader-topbar-left">
            <button class="btn-icon reader-menu-btn" onclick="Reader.toggleChapterNav()" aria-label="Toggle chapter navigation">☰</button>
            <div>
              <div class="reader-topbar-title">${Markdown.escapeHtml(currentWritingMeta.title)}</div>
              <div class="reader-topbar-credit">by ${Markdown.escapeHtml(currentWritingMeta.writtenBy || 'Author')}</div>
            </div>
          </div>
          <div class="reader-topbar-right">
            <span class="reader-chapter-progress" id="chapter-progress-label">Chapter 1 of ${chapters.length}</span>
            <div class="sync-indicator">
              <span class="sync-dot synced"></span>
              <span class="sync-label font-label-small">Synced</span>
            </div>
            <button class="btn-icon" data-theme-toggle onclick="Theme.toggle()" aria-label="Toggle theme">🌙</button>
          </div>
        </div>

        <!-- Chapter Nav -->
        <nav class="chapter-nav" id="chapter-nav" aria-label="Chapter navigation">
          <div class="chapter-nav-header">Chapters</div>
          <div class="chapter-nav-list" id="chapter-nav-list"></div>
        </nav>

        <!-- Content -->
        <main class="reader-content ${typeClass}" id="reader-content">
          <div class="reader-content-inner" id="reader-content-inner"></div>
          <div class="reading-end-container" id="reading-end-container"></div>
        </main>

        <!-- Comment Panel (Desktop + Mobile) -->
        <aside class="comment-panel" id="comment-panel" aria-label="Comments">
          <div class="comment-panel-header">
            <h3>Comments</h3>
            <span class="comment-panel-count" id="comment-panel-count">0 comments</span>
          </div>
          <div id="comment-list"></div>
          <div class="comment-input-area" id="general-comment-input-area">
            <textarea class="input-field" id="general-comment-input" placeholder="Add a comment to this chapter..." rows="3"></textarea>
            <div style="text-align: right; margin-top: var(--space-sm);">
              <button class="btn btn-filled btn-sm" onclick="Feedback.submitGeneralComment()">Post</button>
            </div>
          </div>
        </aside>

        <!-- Sticky Comment FAB (Mobile + Desktop) -->
        <button class="reader-comment-fab" id="reader-comment-fab" onclick="Reader.toggleCommentPanel()" aria-label="Show comments">
          💬 <span id="comment-fab-count">0</span>
        </button>

        <!-- Drawer Overlay (Mobile) -->
        <div class="drawer-overlay" id="drawer-overlay" onclick="Reader.toggleChapterNav()"></div>

        <!-- Protection Overlay -->
        <div class="protection-overlay" id="protection-overlay">
          <h2>⚠️ Developer Tools Detected</h2>
          <p>Please close developer tools to continue reading.</p>
        </div>
      </div>
    `;

    // Update theme toggle
    Theme.init();

    // Render chapter nav
    renderChapterNav();

    // Show first chapter
    navigateToChapter(0);

    // Enable content protection
    Protection.enable();

    // Enable feedback system
    Feedback.init(currentSlug, currentWritingMeta.title, currentWritingMeta.feedbackConfig);

    // Initialize sync
    Sync.init();

    // Setup scroll tracking
    setupScrollTracking();
  }

  /**
   * Render chapter navigation list
   */
  function renderChapterNav() {
    const list = document.getElementById('chapter-nav-list');
    if (!list) return;

    list.innerHTML = chapters.map((ch, i) => `
      <button class="chapter-nav-item ${i === activeChapter ? 'active' : ''} ${chapterProgress[i] >= 90 ? 'read' : ''}"
              onclick="Reader.navigateToChapter(${i})"
              aria-label="Chapter ${i + 1}: ${Markdown.escapeHtml(ch.title)}">
        <span class="chapter-nav-indicator"></span>
        <div style="flex:1;min-width:0;">
          <div class="text-ellipsis">${Markdown.escapeHtml(ch.title)}</div>
          <div class="chapter-nav-progress">
            <div class="chapter-nav-progress-fill" style="width:${chapterProgress[i] || 0}%"></div>
          </div>
        </div>
      </button>
    `).join('');
  }

  /**
   * Navigate to a chapter
   */
  function navigateToChapter(index) {
    if (index < 0 || index >= chapters.length) return;

    activeChapter = index;
    const chapter = chapters[index];

    const contentInner = document.getElementById('reader-content-inner');
    if (!contentInner) return;

    // Render chapter
    const renderedContent = Markdown.render(chapter.content);
    contentInner.innerHTML = `
      <div class="chapter-section active" data-chapter="${index}">
        <h2 class="font-headline-medium" style="margin-bottom:var(--space-xl);">${Markdown.escapeHtml(chapter.title)}</h2>
        ${renderedContent}
      </div>
    `;

    // Add chapter comment box if enabled
    const chapterSection = contentInner.querySelector('.chapter-section');
    if (chapterSection) {
      Feedback.renderChapterCommentBox(chapterSection, index);
    }

    // Show end-of-reading screen if last chapter
    const endContainer = document.getElementById('reading-end-container');
    if (endContainer) {
      if (index === chapters.length - 1) {
        endContainer.innerHTML = `
          <div style="text-align:center;margin-top:var(--space-2xl);padding:var(--space-lg);">
            <button class="btn btn-filled btn-lg" onclick="Reader.showEndScreen()">✨ Finish Reading & Give Feedback</button>
          </div>
        `;
      } else {
        endContainer.innerHTML = `
          <div style="text-align:center;margin-top:var(--space-xl);padding:var(--space-md);">
            <button class="btn btn-filled" onclick="Reader.navigateToChapter(${index + 1})">Next Chapter →</button>
          </div>
        `;
      }
    }

    // Update progress label
    const progressLabel = document.getElementById('chapter-progress-label');
    if (progressLabel) {
      progressLabel.textContent = `Chapter ${index + 1} of ${chapters.length}`;
    }

    // Update nav
    renderChapterNav();

    // Update feedback panel
    Feedback.setChapter(index);

    // Update FAB count
    updateCommentFabCount();

    // Scroll to top
    const contentEl = document.getElementById('reader-content');
    if (contentEl) contentEl.scrollTop = 0;

    // Close drawer on mobile
    const nav = document.getElementById('chapter-nav');
    if (nav) nav.classList.remove('open');
    const overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  /**
   * Update comment FAB badge count
   */
  function updateCommentFabCount() {
    const fabCount = document.getElementById('comment-fab-count');
    if (fabCount) {
      const allFeedback = Storage.getFeedback(currentSlug) || [];
      const chapterComments = allFeedback.filter(f => f.chapterIndex === activeChapter && f.status !== 'deleted');
      fabCount.textContent = chapterComments.length;
    }
  }

  /**
   * Toggle comment panel visibility (for mobile)
   */
  function toggleCommentPanel() {
    const panel = document.getElementById('comment-panel');
    const overlay = document.getElementById('drawer-overlay');
    if (panel) {
      const isOpen = panel.classList.toggle('open');
      if (overlay) {
        if (isOpen) {
          overlay.classList.add('open');
          // Add close handlers specifically for the comment panel
          overlay.onclick = () => {
            panel.classList.remove('open');
            overlay.classList.remove('open');
          };
        } else {
          overlay.classList.remove('open');
        }
      }
    }
  }

  /**
   * Close comment panel explicitly
   */
  function closeCommentPanel() {
    const panel = document.getElementById('comment-panel');
    const overlay = document.getElementById('drawer-overlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  /**
   * Show the end-of-reading screen as a full-page overlay
   */
  function showEndScreen() {
    const readerView = document.getElementById('reader-view');

    // Create a full-page feedback view
    const feedbackView = document.createElement('div');
    feedbackView.className = 'feedback-fullpage';
    feedbackView.id = 'feedback-fullpage';
    feedbackView.innerHTML = `
      <div class="feedback-fullpage-container">
        <button class="feedback-fullpage-back" onclick="Reader.closeEndScreen()">← Back to reading</button>
        <div class="feedback-fullpage-content" id="feedback-fullpage-content"></div>
      </div>
    `;

    readerView.appendChild(feedbackView);

    // Show rating screen inside the full-page container
    const contentArea = document.getElementById('feedback-fullpage-content');
    if (contentArea) {
      Feedback.showRatingScreen(contentArea);
    }
  }

  /**
   * Close end screen and go back to reading
   */
  function closeEndScreen() {
    const fullpage = document.getElementById('feedback-fullpage');
    if (fullpage) fullpage.remove();
  }

  /**
   * Toggle chapter navigation drawer
   */
  function toggleChapterNav() {
    const nav = document.getElementById('chapter-nav');
    const overlay = document.getElementById('drawer-overlay');
    if (nav) {
      const isOpen = nav.classList.toggle('open');
      if (overlay) {
        if (isOpen) {
          overlay.classList.add('open');
          overlay.onclick = () => {
            nav.classList.remove('open');
            overlay.classList.remove('open');
          };
        } else {
          overlay.classList.remove('open');
        }
      }
    }
  }

  /**
   * Setup scroll tracking for chapter progress
   */
  function setupScrollTracking() {
    const contentEl = document.getElementById('reader-content');
    if (!contentEl) return;

    contentEl.addEventListener('scroll', () => {
      const scrollTop = contentEl.scrollTop;
      const scrollHeight = contentEl.scrollHeight - contentEl.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(100, Math.round((scrollTop / scrollHeight) * 100)) : 100;

      chapterProgress[activeChapter] = Math.max(chapterProgress[activeChapter] || 0, progress);

      // Update progress bar in nav
      const navItems = document.querySelectorAll('.chapter-nav-item');
      if (navItems[activeChapter]) {
        const fill = navItems[activeChapter].querySelector('.chapter-nav-progress-fill');
        if (fill) fill.style.width = `${chapterProgress[activeChapter]}%`;

        if (chapterProgress[activeChapter] >= 90) {
          navItems[activeChapter].classList.add('read');
        }
      }
    });
  }

  /**
   * Show error state
   */
  function showError(message) {
    const readerView = document.getElementById('reader-view');
    readerView.innerHTML = `
      <div class="viewer-identity-screen">
        <div class="viewer-identity-card">
          <h1 style="font:var(--text-headline-medium);color:var(--md-error);">Not Found</h1>
          <p class="font-body-large text-muted">${Markdown.escapeHtml(message)}</p>
          <a href="#/" class="btn btn-filled">Go Home</a>
        </div>
      </div>
    `;
  }

  /**
   * Cleanup when leaving reader
   */
  function destroy() {
    Protection.disable();
    Sync.destroy();
    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }
  }

  return {
    init,
    destroy,
    submitPassword,
    togglePasswordVisibility,
    startReading,
    navigateToChapter,
    toggleChapterNav,
    toggleCommentPanel,
    closeCommentPanel,
    showEndScreen,
    closeEndScreen,
    updateCommentFabCount
  };
})();
