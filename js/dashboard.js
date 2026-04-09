// ============================================================
// BetaReads — Author Dashboard (Writing Manager, Feedback View)
// ============================================================

const Dashboard = (() => {
  let currentFeedbackSlug = null;
  let editingSlug = null; // Track which writing is being edited
  let eventsBound = false;

  /**
   * Initialize dashboard
   */
  function init() {
    renderWritings();
    if (!eventsBound) {
      bindEvents();
      eventsBound = true;
    }
  }

  /**
   * Bind dashboard events
   */
  function bindEvents() {
    // FAB: Add new writing
    const fab = document.getElementById('add-writing-fab');
    if (fab) {
      fab.addEventListener('click', openAddWritingModal);
    }

    // Add writing modal steps
    const nextStep1 = document.getElementById('add-writing-next-1');
    if (nextStep1) nextStep1.addEventListener('click', () => showAddWritingStep(2));

    const nextStep2 = document.getElementById('add-writing-next-2');
    if (nextStep2) nextStep2.addEventListener('click', () => showAddWritingStep(3));

    const backStep2 = document.getElementById('add-writing-back-2');
    if (backStep2) backStep2.addEventListener('click', () => showAddWritingStep(1));

    const backStep3 = document.getElementById('add-writing-back-3');
    if (backStep3) backStep3.addEventListener('click', () => showAddWritingStep(2));

    const submitWriting = document.getElementById('add-writing-submit');
    if (submitWriting) submitWriting.addEventListener('click', handleAddWriting);

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        closeModal(modalId);
        editingSlug = null; // Reset editing state
      });
    });

    // Upload toggle
    const uploadToggle = document.getElementById('upload-toggle');
    const pasteToggle = document.getElementById('paste-toggle');
    if (uploadToggle && pasteToggle) {
      uploadToggle.addEventListener('click', () => {
        uploadToggle.classList.add('selected');
        pasteToggle.classList.remove('selected');
        document.getElementById('upload-area').classList.remove('hidden');
        document.getElementById('paste-area').classList.add('hidden');
      });
      pasteToggle.addEventListener('click', () => {
        pasteToggle.classList.add('selected');
        uploadToggle.classList.remove('selected');
        document.getElementById('paste-area').classList.remove('hidden');
        document.getElementById('upload-area').classList.add('hidden');
      });
    }

    // File upload
    const fileInput = document.getElementById('writing-file-input');
    const dropArea = document.getElementById('upload-area');
    if (fileInput && dropArea) {
      dropArea.addEventListener('click', () => fileInput.click());
      dropArea.addEventListener('dragover', e => {
        e.preventDefault();
        dropArea.classList.add('dragover');
      });
      dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
      dropArea.addEventListener('drop', e => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleFileUpload(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', e => {
        if (e.target.files.length > 0) {
          handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Manual chapter mode: insert break button
    const insertBreakBtn = document.getElementById('insert-break-btn');
    if (insertBreakBtn) {
      insertBreakBtn.addEventListener('click', () => {
        const textarea = document.getElementById('writing-paste-content');
        if (textarea) Markdown.insertBreakMarker(textarea);
      });
    }

    // Chapter mode radio toggle
    document.querySelectorAll('input[name="chapter-mode"]').forEach(radio => {
      radio.addEventListener('change', e => {
        const manualTools = document.getElementById('manual-chapter-tools');
        if (manualTools) {
          manualTools.classList.toggle('hidden', e.target.value !== 'manual');
        }
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout();
        App.navigate('');
      });
    }

    // Feedback modal close
    const closeFeedback = document.getElementById('close-feedback-modal');
    if (closeFeedback) closeFeedback.addEventListener('click', () => closeModal('feedback-modal'));

    // CSV export
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportFeedbackCSV);

    // Feedback filters
    document.querySelectorAll('.feedback-filter').forEach(select => {
      select.addEventListener('change', filterFeedbackTable);
    });

    // Edit modal close
    const closeEdit = document.getElementById('close-edit-modal');
    if (closeEdit) closeEdit.addEventListener('click', () => {
      closeModal('edit-writing-modal');
      editingSlug = null;
    });

    // Edit modal save
    const saveEditBtn = document.getElementById('edit-writing-save');
    if (saveEditBtn) saveEditBtn.addEventListener('click', handleSaveEdit);
  }

  /**
   * Render writing cards
   */
  function renderWritings() {
    const grid = document.getElementById('writings-grid');
    if (!grid) return;

    const writings = Storage.getWritings();

    if (writings.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📝</div>
          <h3>No writings yet</h3>
          <p>Add your first writing to start collecting beta reader feedback.</p>
          <button class="btn btn-filled" onclick="Dashboard.openAddWritingModal()">+ Add New Writing</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = writings.map(w => renderWritingCard(w)).join('');
  }

  /**
   * Render a single writing card
   */
  function renderWritingCard(writing) {
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL) || '';
    const encodedDb = sheetUrl ? encodeURIComponent(btoa(sheetUrl)) : '';
    const shareUrl = `${window.location.origin}${window.location.pathname}#/read/${writing.slug}${encodedDb ? '?db=' + encodedDb : ''}`;
    const feedbackTypes = [];
    const fc = writing.feedbackConfig || {};
    if (fc.inline !== false) feedbackTypes.push('💬 Inline');
    if (fc.general !== false) feedbackTypes.push('📝 General');
    if (fc.rating !== false) feedbackTypes.push('⭐ Rating');
    if (fc.structured !== false) feedbackTypes.push('📊 Structured');

    const passwordHtml = writing.password
      ? `<div class="writing-card-password">
           <span>🔒</span>
           <span class="password-mask" data-password="${Markdown.escapeHtml(writing.password)}" data-revealed="false">••••••••</span>
           <button class="btn-icon" onclick="Dashboard.togglePassword(this)" aria-label="Reveal password" style="min-height:28px;min-width:28px;font-size:12px;">👁️</button>
         </div>`
      : '';

    return `
      <div class="writing-card" data-slug="${writing.slug}">
        <div class="writing-card-header">
          <div>
            <div class="writing-card-title">${Markdown.escapeHtml(writing.title)}</div>
            <div class="writing-card-credit">Written by ${Markdown.escapeHtml(writing.writtenBy || 'Author')}</div>
          </div>
          <span class="writing-card-type">${Markdown.escapeHtml(writing.type || 'Other')}</span>
        </div>

        <div class="writing-card-meta">
          <span class="writing-card-date">📅 ${new Date(writing.createdAt).toLocaleDateString()}</span>
          <span class="writing-card-viewers">👥 ${writing.viewerCount || 0} viewers</span>
        </div>

        <div class="writing-card-feedback-types">
          ${feedbackTypes.map(t => `<span class="chip chip-filled">${t}</span>`).join('')}
        </div>

        ${passwordHtml}

        <div class="writing-card-actions">
          <div class="writing-card-share">
            <span class="writing-card-share-url" title="${shareUrl}">${shareUrl}</span>
            <button class="copy-btn" onclick="Dashboard.copyLink('${writing.slug}')" aria-label="Copy share link">📋</button>
          </div>
          <div class="writing-card-buttons">
            <button class="btn btn-outlined btn-sm" onclick="Dashboard.editWriting('${writing.slug}')">✏️ Edit</button>
            <button class="btn btn-tonal btn-sm" onclick="Dashboard.viewFeedback('${writing.slug}')">View Feedback</button>
            <button class="btn btn-text btn-sm" onclick="Dashboard.deleteWriting('${writing.slug}')" style="color:var(--md-error);">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Open add writing modal (new writing mode)
   */
  function openAddWritingModal() {
    editingSlug = null;
    showAddWritingStep(1);
    openModal('add-writing-modal');

    // Update modal title for "Add" mode
    const modalTitle = document.querySelector('#add-writing-modal .modal-header h2');
    if (modalTitle) modalTitle.textContent = 'Add New Writing';

    const submitBtn = document.getElementById('add-writing-submit');
    if (submitBtn) submitBtn.textContent = 'Add Writing';

    // Pre-fill "Written by" with author name
    const session = Auth.getSession();
    const writtenByInput = document.getElementById('writing-written-by');
    if (writtenByInput && session && !writtenByInput.value) {
      writtenByInput.value = session.displayName || '';
    }
  }

  /**
   * Open edit writing modal
   */
  function editWriting(slug) {
    const writings = Storage.getWritings();
    const writing = writings.find(w => w.slug === slug);
    if (!writing) return;

    const writingData = Storage.getWriting(slug);

    // ─── Populate the edit modal ─────────────────────────────
    const modal = document.getElementById('edit-writing-modal');
    if (!modal) return;

    editingSlug = slug;

    // Build chapter list HTML
    const chapters = writingData?.chapters || [];
    const chaptersHtml = chapters.map((ch, i) => `
      <div class="edit-chapter-row">
        <span class="edit-chapter-index">${i + 1}</span>
        <input type="text" class="input-field edit-chapter-input" data-chapter-index="${i}" value="${Markdown.escapeHtml(ch.title)}" placeholder="Chapter title">
      </div>
    `).join('');

    // Build feedback toggles HTML
    const fc = writing.feedbackConfig || {};

    document.getElementById('edit-writing-title').value = writing.title;
    document.getElementById('edit-writing-written-by').value = writing.writtenBy || '';
    document.getElementById('edit-writing-type').value = writing.type || 'novel';
    document.getElementById('edit-writing-password').value = writing.password || '';
    document.getElementById('edit-writing-instructions').value = writing.instructions || '';
    document.getElementById('edit-chapters-list').innerHTML = chaptersHtml;

    // Content
    document.getElementById('edit-writing-content').value = writingData?.content || '';

    // Feedback toggles
    document.getElementById('edit-feedback-inline').checked = fc.inline !== false;
    document.getElementById('edit-feedback-general').checked = fc.general !== false;
    document.getElementById('edit-feedback-rating').checked = fc.rating !== false;
    document.getElementById('edit-feedback-structured').checked = fc.structured !== false;

    openModal('edit-writing-modal');
  }

  /**
   * Save edits to a writing
   */
  function handleSaveEdit() {
    if (!editingSlug) return;

    const writings = Storage.getWritings();
    const writing = writings.find(w => w.slug === editingSlug);
    if (!writing) return;

    // Get values
    const newTitle = document.getElementById('edit-writing-title').value.trim();
    const newWrittenBy = document.getElementById('edit-writing-written-by').value.trim();
    const newType = document.getElementById('edit-writing-type').value;
    const newPassword = document.getElementById('edit-writing-password').value.trim();
    const newInstructions = document.getElementById('edit-writing-instructions').value.trim();
    const newContent = document.getElementById('edit-writing-content').value.trim();

    const errorEl = document.getElementById('edit-writing-error');

    if (!newTitle) {
      errorEl.textContent = 'Title is required.';
      return;
    }

    // Update chapter titles from the inputs
    const chapterInputs = document.querySelectorAll('.edit-chapter-input');
    const writingData = Storage.getWriting(editingSlug);
    if (writingData && writingData.chapters) {
      chapterInputs.forEach(input => {
        const idx = parseInt(input.getAttribute('data-chapter-index'));
        if (writingData.chapters[idx]) {
          writingData.chapters[idx].title = input.value.trim() || writingData.chapters[idx].title;
        }
      });
    }

    // If content changed, re-parse chapters
    if (newContent && writingData && newContent !== writingData.content) {
      const chapterMode = writingData.chapterMode || 'auto';
      const newChapters = Markdown.parseChapters(newContent, chapterMode);
      writingData.content = newContent;
      writingData.chapters = newChapters;
    }

    // Save content
    if (writingData) {
      Storage.setWriting(editingSlug, writingData);
    }

    // Update metadata
    writing.title = newTitle;
    writing.writtenBy = newWrittenBy || writing.writtenBy;
    writing.type = newType;
    writing.password = newPassword || null;
    writing.instructions = newInstructions || null;
    writing.feedbackConfig = {
      inline: document.getElementById('edit-feedback-inline').checked,
      general: document.getElementById('edit-feedback-general').checked,
      rating: document.getElementById('edit-feedback-rating').checked,
      structured: document.getElementById('edit-feedback-structured').checked
    };

    Storage.setWritings(writings);

    // Sync remote updates dynamically
    Sync.publishWriting({ ...writing, chapters: writingData ? writingData.chapters : [] }).then(res => {
      if (res && res.status === 'error') {
        App.showSnackbar('Database Push Failed: ' + (res.message || 'Unknown error'));
      }
    });

    closeModal('edit-writing-modal');
    editingSlug = null;
    renderWritings();
    App.showSnackbar('Writing updated!');
    errorEl.textContent = '';
  }

  /**
   * Show a step in the add writing wizard
   */
  function showAddWritingStep(step) {
    document.querySelectorAll('.add-writing-step').forEach(el => el.classList.remove('active'));
    const stepEl = document.getElementById(`add-writing-step-${step}`);
    if (stepEl) stepEl.classList.add('active');
  }

  /**
   * Handle file upload
   */
  function handleFileUpload(file) {
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      App.showSnackbar('Please upload a .txt or .md file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target.result;
      document.getElementById('writing-paste-content').value = content;
      // Switch to paste view to show content
      document.getElementById('paste-toggle').click();
      document.getElementById('upload-filename').textContent = `✓ ${file.name} loaded`;
      App.showSnackbar(`"${file.name}" loaded successfully.`);
    };
    reader.readAsText(file);
  }

  /**
   * Handle add writing submission
   */
  async function handleAddWriting() {
    const title = document.getElementById('writing-title').value.trim();
    const writtenBy = document.getElementById('writing-written-by').value.trim();
    const type = document.getElementById('writing-type').value;
    const content = document.getElementById('writing-paste-content').value.trim();
    const chapterMode = document.querySelector('input[name="chapter-mode"]:checked')?.value || 'auto';
    const password = document.getElementById('writing-password').value.trim();
    const instructions = document.getElementById('writing-instructions').value.trim();

    // Feedback toggles
    const feedbackConfig = {
      inline: document.getElementById('feedback-inline')?.checked ?? true,
      general: document.getElementById('feedback-general')?.checked ?? true,
      rating: document.getElementById('feedback-rating')?.checked ?? true,
      structured: document.getElementById('feedback-structured')?.checked ?? true
    };

    const errorEl = document.getElementById('add-writing-error');

    // Validate
    if (!title) { errorEl.textContent = 'Title is required.'; return; }
    if (!content) { errorEl.textContent = 'Please upload or paste your writing.'; return; }

    const slug = Markdown.slugify(title);

    // Check for duplicate slug
    const writings = Storage.getWritings();
    if (writings.find(w => w.slug === slug)) {
      errorEl.textContent = 'A writing with a similar title already exists. Please choose a different title.';
      return;
    }

    const submitBtn = document.getElementById('add-writing-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Saving…';

    // Parse chapters
    const chapters = Markdown.parseChapters(content, chapterMode);

    // Create writing object
    const writing = {
      title,
      slug,
      writtenBy: writtenBy || Auth.getSession()?.displayName || 'Author',
      type,
      chapterMode,
      password: password || null,
      instructions: instructions || null,
      feedbackConfig,
      createdAt: new Date().toISOString(),
      viewerCount: 0
    };

    // Store content separately (can be large)
    Storage.setWriting(slug, { content, chapters, chapterMode });

    // Add to writings list
    writings.push(writing);
    Storage.setWritings(writings);

    // Create tab in Google Sheet
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL);
    if (sheetUrl && navigator.onLine) {
      try {
        await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ action: 'create_tab', writingTitle: title })
        });

        // Publish to remote hosting database
        Sync.publishWriting({ ...writing, chapters: chapters }).then(res => {
          console.log('Novel payload saved:', res);
          if (res && res.status === 'error') {
            App.showSnackbar('Database Push Failed: ' + (res.message || 'Unknown error'));
          } else {
            console.log('Successfully synced blocks.');
          }
        });
      } catch (e) {
        App.showSnackbar('Connection fail: ' + e.message);
        console.warn('Could not create sheet tab or upload remote payload:', e);
      }
    }

    // Close modal and refresh
    closeModal('add-writing-modal');
    resetAddWritingForm();
    renderWritings();
    App.showSnackbar(`"${title}" added successfully!`);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Writing';
    errorEl.textContent = '';
  }

  /**
   * Reset the add writing form
   */
  function resetAddWritingForm() {
    document.getElementById('writing-title').value = '';
    document.getElementById('writing-written-by').value = '';
    document.getElementById('writing-type').value = 'novel';
    document.getElementById('writing-paste-content').value = '';
    document.getElementById('writing-password').value = '';
    document.getElementById('writing-instructions').value = '';
    document.getElementById('upload-filename').textContent = '';
    document.getElementById('add-writing-error').textContent = '';
    document.querySelectorAll('.feedback-toggle').forEach(t => t.checked = true);
  }

  /**
   * Copy share link for a writing
   */
  function copyLink(slug) {
    const sheetUrl = Storage.get(Storage.KEYS.SHEET_URL) || '';
    const encodedDb = sheetUrl ? encodeURIComponent(btoa(sheetUrl)) : '';
    const url = `${window.location.origin}${window.location.pathname}#/read/${slug}${encodedDb ? '?db=' + encodedDb : ''}`;
    navigator.clipboard.writeText(url).then(() => {
      App.showSnackbar('Share link copied to clipboard!');
    });
  }

  /**
   * Toggle password visibility on card
   */
  function togglePassword(btn) {
    const mask = btn.parentElement.querySelector('.password-mask');
    if (!mask) return;
    const revealed = mask.getAttribute('data-revealed') === 'true';
    if (revealed) {
      mask.textContent = '••••••••';
      mask.setAttribute('data-revealed', 'false');
      btn.textContent = '👁️';
    } else {
      mask.textContent = mask.getAttribute('data-password');
      mask.setAttribute('data-revealed', 'true');
      btn.textContent = '🙈';
    }
  }

  /**
   * Delete a writing
   */
  function deleteWriting(slug) {
    if (!confirm('Are you sure you want to delete this writing? This cannot be undone.')) return;

    let writings = Storage.getWritings();
    writings = writings.filter(w => w.slug !== slug);
    Storage.setWritings(writings);
    Storage.remove(Storage.KEYS.WRITING_PREFIX + slug);
    Storage.remove(Storage.KEYS.FEEDBACK_PREFIX + slug);

    renderWritings();
    App.showSnackbar('Writing deleted.');
  }

  /**
   * View feedback for a writing
   */
  async function viewFeedback(slug) {
    currentFeedbackSlug = slug;
    const writings = Storage.getWritings();
    const writing = writings.find(w => w.slug === slug);
    if (!writing) return;

    const titleEl = document.getElementById('feedback-modal-title');
    if (titleEl) titleEl.textContent = `Feedback — ${writing.title}`;

    const tableBody = document.getElementById('feedback-table-body');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-lg">Loading feedback…</td></tr>';

    openModal('feedback-modal');

    // Try to fetch from sheet
    let feedbackRows = [];
    try {
      feedbackRows = await Sync.fetchFeedback(writing.title);
    } catch (e) {
      // Use locally cached feedback
      feedbackRows = Storage.getFeedback(slug) || [];
    }

    renderFeedbackTable(feedbackRows);
  }

  /**
   * Render feedback table
   */
  function renderFeedbackTable(rows) {
    const tableBody = document.getElementById('feedback-table-body');
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-lg text-muted">No feedback yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = rows.map(row => {
      const statusClass = {
        'new': 'chip-status-new',
        'edited': 'chip-status-edited',
        'deleted': 'chip-status-deleted'
      }[row.status || row[12]] || 'chip-status-new';

      // Handle both array and object format
      const timestamp = row.timestamp || row[0] || '';
      const viewer = row.viewerName || row[1] || '';
      const type = row.type || row[2] || '';
      const chapter = row.chapter || row[3] || '';
      const selectedText = row.selectedText || row[4] || '';
      const comment = row.comment || row[5] || '';
      const status = row.status || row[12] || 'new';

      return `
        <tr>
          <td>${Markdown.escapeHtml(viewer)}</td>
          <td><span class="chip chip-filled">${Markdown.escapeHtml(type)}</span></td>
          <td>${Markdown.escapeHtml(chapter)}</td>
          <td class="text-ellipsis" title="${Markdown.escapeHtml(selectedText)}">${Markdown.escapeHtml(selectedText.substring(0, 50))}${selectedText.length > 50 ? '…' : ''}</td>
          <td class="text-ellipsis" title="${Markdown.escapeHtml(comment)}">${Markdown.escapeHtml(comment.substring(0, 80))}${comment.length > 80 ? '…' : ''}</td>
          <td><span class="font-label-small">${new Date(timestamp).toLocaleString()}</span></td>
          <td><span class="chip ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join('');

    // Update count
    const countEl = document.getElementById('feedback-count');
    if (countEl) countEl.textContent = `${rows.length} item${rows.length !== 1 ? 's' : ''}`;
  }

  /**
   * Filter feedback table
   */
  function filterFeedbackTable() {
    const viewerFilter = document.getElementById('filter-viewer')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';

    const rows = document.querySelectorAll('#feedback-table-body tr');
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 7) return;

      const viewer = cells[0].textContent.toLowerCase();
      const type = cells[1].textContent.toLowerCase();
      const status = cells[6].textContent.toLowerCase();

      let show = true;
      if (viewerFilter && !viewer.includes(viewerFilter.toLowerCase())) show = false;
      if (typeFilter && !type.includes(typeFilter.toLowerCase())) show = false;
      if (statusFilter && !status.includes(statusFilter.toLowerCase())) show = false;

      tr.style.display = show ? '' : 'none';
    });
  }

  /**
   * Export feedback as CSV
   */
  function exportFeedbackCSV() {
    const table = document.getElementById('feedback-table');
    if (!table) return;

    const rows = [];
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
    rows.push(headers);

    table.querySelectorAll('tbody tr').forEach(tr => {
      if (tr.style.display === 'none') return;
      const cells = Array.from(tr.querySelectorAll('td')).map(td => `"${td.textContent.replace(/"/g, '""')}"`);
      rows.push(cells);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `betareads-feedback-${currentFeedbackSlug || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    App.showSnackbar('Feedback exported as CSV.');
  }

  /**
   * Open a modal
   */
  function openModal(modalId) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById(modalId);
    if (backdrop) backdrop.classList.add('open');
    if (modal) modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close a modal
   */
  function closeModal(modalId) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById(modalId);
    if (backdrop) backdrop.classList.remove('open');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  return {
    init,
    renderWritings,
    openAddWritingModal,
    editWriting,
    copyLink,
    togglePassword,
    deleteWriting,
    viewFeedback,
    openModal,
    closeModal,
    exportFeedbackCSV
  };
})();
