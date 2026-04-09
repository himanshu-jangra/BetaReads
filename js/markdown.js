// ============================================================
// BetaReads — Markdown Parser & Chapter Detection
// ============================================================

const Markdown = (() => {
  /**
   * Parse content into chapters based on mode
   * @param {string} content - Raw text/markdown content
   * @param {string} mode - 'auto' or 'manual'
   * @returns {Array<{title: string, content: string, index: number}>}
   */
  function parseChapters(content, mode = 'auto') {
    if (mode === 'manual') {
      return parseManualChapters(content);
    }
    return parseAutoChapters(content);
  }

  /**
   * Auto mode: detect chapters from headings or "Chapter" lines
   */
  function parseAutoChapters(content) {
    const lines = content.split('\n');
    const chapters = [];
    let currentChapter = { title: 'Introduction', content: '', index: 0 };
    let foundFirstHeading = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for # heading (only top-level # for chapters)
      const headingMatch = trimmed.match(/^#\s+(.+)$/);
      // Check for "Chapter" pattern
      const chapterMatch = trimmed.match(/^Chapter\s+\d+/i);

      if (headingMatch || chapterMatch) {
        // Save previous chapter if it has content
        if (foundFirstHeading || currentChapter.content.trim()) {
          chapters.push({ ...currentChapter, content: currentChapter.content.trim() });
        }

        foundFirstHeading = true;
        const title = headingMatch ? headingMatch[1] : trimmed;
        currentChapter = {
          title,
          content: '',
          index: chapters.length
        };
      } else {
        currentChapter.content += line + '\n';
      }
    }

    // Push last chapter
    if (currentChapter.content.trim() || foundFirstHeading) {
      chapters.push({ ...currentChapter, content: currentChapter.content.trim() });
    }

    // If no chapters found, treat entire content as one chapter
    if (chapters.length === 0) {
      chapters.push({ title: 'Chapter 1', content: content.trim(), index: 0 });
    }

    // Re-index
    chapters.forEach((ch, i) => { ch.index = i; });

    return chapters;
  }

  /**
   * Manual mode: split on break markers
   */
  function parseManualChapters(content) {
    const BREAK_MARKER = '---CHAPTER BREAK---';
    const parts = content.split(BREAK_MARKER);
    const chapters = [];

    parts.forEach((part, i) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      // Try to extract title from first heading
      const lines = trimmed.split('\n');
      let title = `Chapter ${i + 1}`;
      let chapterContent = trimmed;

      if (lines[0].trim().startsWith('#')) {
        title = lines[0].replace(/^#+\s*/, '').trim();
        chapterContent = lines.slice(1).join('\n').trim();
      }

      chapters.push({ title, content: chapterContent, index: chapters.length });
    });

    if (chapters.length === 0) {
      chapters.push({ title: 'Chapter 1', content: content.trim(), index: 0 });
    }

    return chapters;
  }

  /**
   * Render markdown to HTML using marked.js
   */
  function render(markdownText) {
    if (typeof marked !== 'undefined') {
      // Configure marked for safe rendering
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      return marked.parse(markdownText);
    }
    // Fallback: basic rendering
    return basicRender(markdownText);
  }

  /**
   * Basic fallback renderer if marked.js isn't loaded
   */
  function basicRender(text) {
    let html = escapeHtml(text);

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Headings
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  /**
   * Escape HTML entities
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate slug from title
   */
  function slugify(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }

  /**
   * Insert a chapter break marker at cursor position in a textarea
   */
  function insertBreakMarker(textarea) {
    const BREAK_MARKER = '\n---CHAPTER BREAK---\n';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + BREAK_MARKER + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + BREAK_MARKER.length;
    textarea.focus();
  }

  return {
    parseChapters,
    render,
    slugify,
    insertBreakMarker,
    escapeHtml
  };
})();
