// ============================================================
// BetaReads — Feedback System (All 4 Types + Edit/Delete)
// ============================================================

const Feedback = (() => {
  let activeWritingSlug = null;
  let activeWritingTitle = null;
  let activeChapterIndex = 0;
  let viewerName = '';
  let feedbackConfig = {};
  let hasSubmittedRating = false;
  let hasSubmittedStructured = false;

  /**
   * Initialize feedback for a writing
   */
  function init(slug, title, config) {
    activeWritingSlug = slug;
    activeWritingTitle = title;
    feedbackConfig = config || { inline: true, general: true, rating: true, structured: true };

    // Load viewer name
    viewerName = Storage.get(Storage.KEYS.VIEWER_NAME) || 'Anonymous';

    // Load previous submissions
    const feedback = Storage.getFeedback(slug) || [];
    hasSubmittedRating = feedback.some(f => f.type === 'Rating');
    hasSubmittedStructured = feedback.some(f => f.type === 'Structured');

    if (feedbackConfig.inline) {
      initInlineComments();
    }
  }

  /**
   * Set active chapter
   */
  function setChapter(index) {
    activeChapterIndex = index;
    renderCommentPanel();
  }

  // ── Inline Highlight + Comment ─────────────────────────────

  /**
   * Initialize inline comment system
   */
  function initInlineComments() {
    const contentEl = document.querySelector('.reader-content-inner');
    if (!contentEl) return;

    // We need user-select enabled just for the inline comment selection,
    // even though protection disables it. We'll selectively enable it
    // for chapter text spans only when inline is enabled.

    contentEl.addEventListener('mouseup', handleTextSelection);
    contentEl.addEventListener('touchend', handleTextSelection);

    // Render existing highlights
    renderHighlights();
  }

  /**
   * Handle text selection for inline comments
   */
  function handleTextSelection(e) {
    removeSelectionPopover();

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) return;

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showSelectionPopover(rect, selectedText, range);
  }

  /**
   * Show floating tooltip for adding comment
   */
  function showSelectionPopover(rect, selectedText, range) {
    const popover = document.createElement('div');
    popover.className = 'selection-popover';
    popover.id = 'selection-popover';
    popover.innerHTML = `
      <button onclick="Feedback.openCommentPopover()" aria-label="Add comment">
        💬 Comment
      </button>
    `;

    // Store selection data for use in comment popover
    popover._selectedText = selectedText;
    popover._rect = rect;

    // Position above selection
    popover.style.top = `${window.scrollY + rect.top - 45}px`;
    popover.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    popover.style.transform = 'translateX(-50%)';

    document.body.appendChild(popover);

    // Auto-remove on click outside
    setTimeout(() => {
      document.addEventListener('mousedown', removeSelectionPopoverOnClick, { once: true });
    }, 100);
  }

  function removeSelectionPopoverOnClick(e) {
    const popover = document.getElementById('selection-popover');
    if (popover && !popover.contains(e.target)) {
      removeSelectionPopover();
    }
  }

  function removeSelectionPopover() {
    const existing = document.getElementById('selection-popover');
    if (existing) existing.remove();
  }

  /**
   * Open comment input popover
   */
  function openCommentPopover() {
    const selectionPopover = document.getElementById('selection-popover');
    if (!selectionPopover) return;

    const selectedText = selectionPopover._selectedText;
    const rect = selectionPopover._rect;
    removeSelectionPopover();

    const popover = document.createElement('div');
    popover.className = 'comment-popover';
    popover.id = 'comment-popover';
    popover.innerHTML = `
      <div class="font-label-medium text-muted">"${Markdown.escapeHtml(selectedText.substring(0, 60))}${selectedText.length > 60 ? '…' : ''}"</div>
      <textarea class="input-field" id="inline-comment-input" placeholder="Leave your feedback…" rows="3"></textarea>
      <div class="comment-popover-actions">
        <button class="btn btn-text btn-sm" onclick="Feedback.closeCommentPopover()">Cancel</button>
        <button class="btn btn-filled btn-sm" onclick="Feedback.submitInlineComment('${btoa(encodeURIComponent(selectedText))}')">Submit</button>
      </div>
    `;

    popover.style.top = `${window.scrollY + rect.bottom + 8}px`;
    popover.style.left = `${window.scrollX + rect.left}px`;

    document.body.appendChild(popover);
    document.getElementById('inline-comment-input').focus();
  }

  function closeCommentPopover() {
    const popover = document.getElementById('comment-popover');
    if (popover) popover.remove();
  }

  /**
   * Submit inline comment
   */
  function submitInlineComment(encodedText) {
    const selectedText = decodeURIComponent(atob(encodedText));
    const commentInput = document.getElementById('inline-comment-input');
    const comment = commentInput?.value.trim();

    if (!comment) {
      commentInput.classList.add('error');
      return;
    }

    const feedbackItem = {
      id: crypto.randomUUID(),
      type: 'Inline',
      chapter: `Chapter ${activeChapterIndex + 1}`,
      chapterIndex: activeChapterIndex,
      selectedText,
      comment,
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    saveFeedback(feedbackItem);
    closeCommentPopover();

    // Re-render highlights
    renderHighlights();
    renderCommentPanel();

    App.showSnackbar('Comment saved!');
  }

  /**
   * Submit general chapter comment
   */
  function submitGeneralComment() {
    const input = document.getElementById('general-comment-input');
    const comment = input?.value.trim();

    if (!comment) {
      input.classList.add('error');
      return;
    }
    input.classList.remove('error');

    const feedbackItem = {
      id: crypto.randomUUID(),
      type: 'General',
      chapter: `Chapter ${activeChapterIndex + 1}`,
      chapterIndex: activeChapterIndex,
      selectedText: '',
      comment,
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    saveFeedback(feedbackItem);
    renderCommentPanel();
    
    // Clear input
    input.value = '';
    App.showSnackbar('Comment posted!');

    // Close panel on mobile after posting
    if (window.innerWidth <= 1024 && window.Reader && window.Reader.closeCommentPanel) {
      window.Reader.closeCommentPanel();
    }
  }

  /**
   * Render inline highlights
   */
  function renderHighlights() {
    // This is a simplified version — in production you'd want
    // more sophisticated text range tracking
    const feedback = getChapterFeedback('Inline');
    const contentEl = document.querySelector('.reader-content-inner .chapter-section.active');
    if (!contentEl) return;

    // Remove existing highlights
    contentEl.querySelectorAll('.inline-highlight').forEach(el => {
      const text = el.textContent;
      el.replaceWith(document.createTextNode(text));
    });

    // We skip re-applying highlights to avoid complex DOM manipulation
    // In a full implementation, you'd store text ranges and re-apply them
  }

  // ── General End-of-Chapter Comment ─────────────────────────

  /**
   * Render general comment box at end of chapter
   */
  function renderChapterCommentBox(chapterEl, chapterIndex) {
    if (!feedbackConfig.general) return;

    const existing = chapterEl.querySelector('.chapter-end-comment');
    if (existing) return;

    const div = document.createElement('div');
    div.className = 'chapter-end-comment';
    div.innerHTML = `
      <h4>💭 Share your thoughts on this chapter</h4>
      <textarea class="input-field" id="chapter-comment-${chapterIndex}" placeholder="What did you think of this chapter?" rows="3"></textarea>
      <div style="margin-top:var(--space-sm);display:flex;justify-content:flex-end;">
        <button class="btn btn-filled btn-sm" onclick="Feedback.submitChapterComment(${chapterIndex})">Submit Comment</button>
      </div>
    `;
    chapterEl.appendChild(div);
  }

  /**
   * Submit general chapter comment
   */
  function submitChapterComment(chapterIndex) {
    const textarea = document.getElementById(`chapter-comment-${chapterIndex}`);
    const comment = textarea?.value.trim();

    if (!comment) {
      textarea.classList.add('error');
      return;
    }

    const feedbackItem = {
      id: crypto.randomUUID(),
      type: 'General',
      chapter: `Chapter ${chapterIndex + 1}`,
      chapterIndex,
      selectedText: '',
      comment,
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    saveFeedback(feedbackItem);
    textarea.value = '';
    renderCommentPanel();

    App.showSnackbar('Chapter comment saved!');
  }

  // ── Star / Emoji Rating ────────────────────────────────────

  /**
   * Show rating screen
   */
  function showRatingScreen(containerEl) {
    if (!feedbackConfig.rating || hasSubmittedRating) {
      if (feedbackConfig.structured && !hasSubmittedStructured) {
        showStructuredForm(containerEl);
      } else {
        showThankYou(containerEl);
      }
      return;
    }

    containerEl.innerHTML = `
      <div class="feedback-form-page">
        <div class="feedback-form-card">
          <div class="feedback-form-header">
            <div class="feedback-form-icon">🎉</div>
            <h2>You've finished reading!</h2>
            <p>How would you rate this work?</p>
          </div>

          <div class="feedback-form-body">
            <div class="star-rating" id="star-rating">
              ${[1,2,3,4,5].map(i => `
                <span class="star" data-value="${i}" onclick="Feedback.setRating(${i})" aria-label="${i} star${i > 1 ? 's' : ''}">★</span>
              `).join('')}
            </div>
            <div id="rating-value" class="font-label-large text-muted">Select a rating</div>

            <div class="feedback-form-section">
              <p class="font-body-medium text-muted">How did it make you feel?</p>
              <div class="emoji-picker" id="emoji-picker">
                ${['😐', '🤔', '😮', '😢', '😍'].map(e => `
                  <button class="emoji-option" data-emoji="${e}" onclick="Feedback.setEmoji('${e}')" aria-label="${e}">${e}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="feedback-form-actions">
            <button class="btn btn-text" onclick="Feedback.skipRating()">Skip</button>
            <button class="btn btn-filled" id="submit-rating-btn" onclick="Feedback.submitRating()" disabled>Submit Rating</button>
          </div>
        </div>
      </div>
    `;
  }

  let selectedRating = 0;
  let selectedEmoji = '';

  function setRating(value) {
    selectedRating = value;
    document.querySelectorAll('#star-rating .star').forEach(star => {
      const v = parseInt(star.getAttribute('data-value'));
      star.classList.toggle('active', v <= value);
    });
    document.getElementById('rating-value').textContent = `${value} / 5`;
    document.getElementById('submit-rating-btn').disabled = false;
  }

  function setEmoji(emoji) {
    selectedEmoji = emoji;
    document.querySelectorAll('#emoji-picker .emoji-option').forEach(opt => {
      opt.classList.toggle('selected', opt.getAttribute('data-emoji') === emoji);
    });
  }

  function submitRating() {
    if (selectedRating === 0) return;

    const feedbackItem = {
      id: crypto.randomUUID(),
      type: 'Rating',
      chapter: 'Overall',
      chapterIndex: -1,
      selectedText: '',
      comment: `${selectedRating}/5 ${selectedEmoji}`.trim(),
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    saveFeedback(feedbackItem);
    hasSubmittedRating = true;

    App.showSnackbar('Rating submitted! Thank you.');

    // Show structured form if enabled
    const container = document.getElementById('feedback-fullpage-content') || document.querySelector('.reading-end-container');
    if (feedbackConfig.structured && !hasSubmittedStructured && container) {
      showStructuredForm(container);
    } else if (container) {
      showThankYou(container);
    }
  }

  function skipRating() {
    hasSubmittedRating = true;
    const container = document.getElementById('feedback-fullpage-content') || document.querySelector('.reading-end-container');
    if (feedbackConfig.structured && !hasSubmittedStructured && container) {
      showStructuredForm(container);
    } else if (container) {
      showThankYou(container);
    }
  }

  // ── Structured Feedback Form ───────────────────────────────

  function showStructuredForm(containerEl) {
    if (!feedbackConfig.structured || hasSubmittedStructured) {
      showThankYou(containerEl);
      return;
    }

    containerEl.innerHTML = `
      <div class="feedback-form-page">
        <div class="feedback-form-card">
          <div class="feedback-form-header">
            <div class="feedback-form-icon">📊</div>
            <h2>Detailed Feedback</h2>
            <p>Help the author improve with specific feedback.</p>
          </div>

          <div class="feedback-form-body feedback-form-body--left">
            <div class="slider-group">
              <label>Pacing <span class="slider-value" id="pacing-value">5</span></label>
              <input type="range" min="1" max="10" value="5" id="feedback-pacing" oninput="document.getElementById('pacing-value').textContent=this.value">
            </div>

            <div class="slider-group">
              <label>Clarity <span class="slider-value" id="clarity-value">5</span></label>
              <input type="range" min="1" max="10" value="5" id="feedback-clarity" oninput="document.getElementById('clarity-value').textContent=this.value">
            </div>

            <div class="slider-group">
              <label>Engagement <span class="slider-value" id="engagement-value">5</span></label>
              <input type="range" min="1" max="10" value="5" id="feedback-engagement" oninput="document.getElementById('engagement-value').textContent=this.value">
            </div>

            <div class="slider-group">
              <label>Character Development <span class="slider-value" id="chardev-value">5</span></label>
              <input type="range" min="1" max="10" value="5" id="feedback-chardev" oninput="document.getElementById('chardev-value').textContent=this.value">
            </div>

            <div class="slider-group">
              <label>Overall Impression <span class="slider-value" id="overall-value">5</span></label>
              <input type="range" min="1" max="10" value="5" id="feedback-overall" oninput="document.getElementById('overall-value').textContent=this.value">
            </div>

            <div class="input-group">
              <label for="feedback-final-thoughts">Final Thoughts (Optional)</label>
              <textarea class="input-field" id="feedback-final-thoughts" placeholder="Any final thoughts or suggestions?" rows="4"></textarea>
            </div>
          </div>

          <div class="feedback-form-actions">
            <button class="btn btn-text" onclick="Feedback.skipStructured()">Skip</button>
            <button class="btn btn-filled" onclick="Feedback.submitStructured()">Submit Feedback</button>
          </div>
        </div>
      </div>
    `;
  }

  function submitStructured() {
    const feedbackItem = {
      id: crypto.randomUUID(),
      type: 'Structured',
      chapter: 'Overall',
      chapterIndex: -1,
      selectedText: '',
      comment: '',
      pacing: document.getElementById('feedback-pacing')?.value || '5',
      clarity: document.getElementById('feedback-clarity')?.value || '5',
      engagement: document.getElementById('feedback-engagement')?.value || '5',
      characterDev: document.getElementById('feedback-chardev')?.value || '5',
      overall: document.getElementById('feedback-overall')?.value || '5',
      finalThoughts: document.getElementById('feedback-final-thoughts')?.value.trim() || '',
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'new'
    };

    saveFeedback(feedbackItem);
    hasSubmittedStructured = true;

    const container = document.getElementById('feedback-fullpage-content') || document.querySelector('.reading-end-container');
    if (container) {
      showThankYou(container);
    }

    App.showSnackbar('Detailed feedback submitted! Thank you.');
  }

  function skipStructured() {
    hasSubmittedStructured = true;
    const container = document.getElementById('feedback-fullpage-content') || document.querySelector('.reading-end-container');
    if (container) {
      showThankYou(container);
    }
  }

  // ── Comment Panel ──────────────────────────────────────────

  /**
   * Render comment panel for active chapter
   */
  function renderCommentPanel() {
    const panel = document.getElementById('comment-list');
    if (!panel) return;

    const allFeedback = getChapterFeedback();
    const countEl = document.getElementById('comment-panel-count');
    if (countEl) countEl.textContent = `${allFeedback.length} comment${allFeedback.length !== 1 ? 's' : ''}`;

    if (allFeedback.length === 0) {
      panel.innerHTML = '<p class="text-muted font-body-medium p-md text-center">No comments yet for this chapter.</p>';
      return;
    }

    panel.innerHTML = allFeedback.map(fb => `
      <div class="comment-item" data-id="${fb.id}">
        <div class="comment-item-header">
          <span class="comment-item-type">${fb.type === 'Inline' ? '💬 Inline' : '📝 General'}</span>
          <div class="comment-item-actions">
            <button onclick="Feedback.editComment('${fb.id}')" aria-label="Edit comment" title="Edit">✏️</button>
            <button onclick="Feedback.deleteComment('${fb.id}')" aria-label="Delete comment" title="Delete">🗑️</button>
          </div>
        </div>
        ${fb.selectedText ? `<div class="comment-item-selected-text">"${Markdown.escapeHtml(fb.selectedText.substring(0, 100))}"</div>` : ''}
        <div class="comment-item-body" id="comment-body-${fb.id}">${Markdown.escapeHtml(fb.comment)}</div>
        <span class="comment-item-time">${new Date(fb.timestamp).toLocaleString()}</span>
      </div>
    `).join('');
  }

  /**
   * Get feedback for current chapter
   */
  function getChapterFeedback(typeFilter = null) {
    const allFeedback = Storage.getFeedback(activeWritingSlug) || [];
    return allFeedback.filter(fb => {
      if (fb.status === 'deleted') return false;
      if (fb.chapterIndex !== activeChapterIndex) return false;
      if (typeFilter && fb.type !== typeFilter) return false;
      return true;
    });
  }

  // ── Edit / Delete ──────────────────────────────────────────

  /**
   * Edit a comment
   */
  function editComment(commentId) {
    const feedback = Storage.getFeedback(activeWritingSlug) || [];
    const comment = feedback.find(f => f.id === commentId);
    if (!comment) return;

    const bodyEl = document.getElementById(`comment-body-${commentId}`);
    if (!bodyEl) return;

    // Replace with editing textarea
    bodyEl.innerHTML = `
      <textarea class="input-field" id="edit-comment-${commentId}" rows="3">${Markdown.escapeHtml(comment.comment)}</textarea>
      <div style="display:flex;gap:var(--space-xs);justify-content:flex-end;margin-top:var(--space-xs);">
        <button class="btn btn-text btn-sm" onclick="Feedback.cancelEdit('${commentId}', '${btoa(encodeURIComponent(comment.comment))}')">Cancel</button>
        <button class="btn btn-filled btn-sm" onclick="Feedback.saveEdit('${commentId}')">Save</button>
      </div>
    `;
  }

  function cancelEdit(commentId, encodedOriginal) {
    const original = decodeURIComponent(atob(encodedOriginal));
    const bodyEl = document.getElementById(`comment-body-${commentId}`);
    if (bodyEl) bodyEl.textContent = original;
  }

  function saveEdit(commentId) {
    const textarea = document.getElementById(`edit-comment-${commentId}`);
    const newComment = textarea?.value.trim();
    if (!newComment) return;

    const feedback = Storage.getFeedback(activeWritingSlug) || [];
    const original = feedback.find(f => f.id === commentId);
    if (!original) return;

    // Create new row with status: edited
    const editedItem = {
      id: crypto.randomUUID(),
      type: original.type,
      chapter: original.chapter,
      chapterIndex: original.chapterIndex,
      selectedText: original.selectedText,
      comment: newComment,
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'edited',
      originalCommentId: original.id
    };

    // Mark original as superseded locally
    original._superseded = true;

    feedback.push(editedItem);
    // Replace original comment text locally for display
    original.comment = newComment;
    original.timestamp = editedItem.timestamp;

    Storage.setFeedback(activeWritingSlug, feedback);

    // Queue the edit for sync
    Sync.queueFeedback(activeWritingTitle, {
      ...editedItem,
      selectedText: editedItem.selectedText || ''
    });

    renderCommentPanel();
    App.showSnackbar('Comment updated.');
  }

  /**
   * Delete a comment
   */
  function deleteComment(commentId) {
    if (!confirm('Remove this comment? This cannot be undone.')) return;

    const feedback = Storage.getFeedback(activeWritingSlug) || [];
    const comment = feedback.find(f => f.id === commentId);
    if (!comment) return;

    // Mark as deleted
    comment.status = 'deleted';

    // Create delete row for sheet
    const deleteItem = {
      id: crypto.randomUUID(),
      type: comment.type,
      chapter: comment.chapter,
      chapterIndex: comment.chapterIndex,
      selectedText: '',
      comment: '',
      viewerName,
      timestamp: new Date().toISOString(),
      status: 'deleted',
      originalCommentId: comment.id
    };

    feedback.push(deleteItem);
    Storage.setFeedback(activeWritingSlug, feedback);

    // Queue for sync
    Sync.queueFeedback(activeWritingTitle, deleteItem);

    renderCommentPanel();
    renderHighlights();
    App.showSnackbar('Comment removed.');
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Show thank you screen
   */
  function showThankYou(containerEl) {
    containerEl.innerHTML = `
      <div class="feedback-form-page">
        <div class="feedback-form-card">
          <div class="feedback-form-header">
            <div class="feedback-form-icon">📚</div>
            <h2>Thank you for your feedback!</h2>
            <p>Your insights will help the author improve their work.<br>Feedback syncs automatically when online.</p>
          </div>
          <div class="feedback-form-actions">
            <button class="btn btn-filled" onclick="Reader.closeEndScreen()">Back to Reading</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Save feedback item locally and queue for sync
   */
  function saveFeedback(item) {
    // Save to local feedback
    const feedback = Storage.getFeedback(activeWritingSlug) || [];
    feedback.push(item);
    Storage.setFeedback(activeWritingSlug, feedback);

    // Queue for sync
    Sync.queueFeedback(activeWritingTitle, {
      timestamp: item.timestamp,
      viewerName: item.viewerName,
      type: item.type,
      chapter: item.chapter,
      selectedText: item.selectedText || '',
      comment: item.comment || '',
      pacing: item.pacing || '',
      clarity: item.clarity || '',
      engagement: item.engagement || '',
      characterDev: item.characterDev || '',
      overall: item.overall || '',
      finalThoughts: item.finalThoughts || '',
      status: item.status || 'new',
      originalCommentId: item.originalCommentId || ''
    });

    if (window.Reader && window.Reader.updateCommentFabCount) {
      window.Reader.updateCommentFabCount();
    }
  }

  return {
    init,
    setChapter,
    renderChapterCommentBox,
    submitInlineComment,
    submitGeneralComment,
    openCommentPopover,
    closeCommentPopover,
    submitChapterComment,
    showRatingScreen,
    setRating,
    setEmoji,
    submitRating,
    skipRating,
    submitStructured,
    skipStructured,
    renderCommentPanel,
    editComment,
    cancelEdit,
    saveEdit,
    deleteComment
  };
})();
