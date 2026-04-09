# PRD — BetaReads
### Beta Reader Web App for Authors
**Version:** 1.0  
**Author:** Himanshu Jangra
**Platform:** GitHub Pages (Static frontend + Google Sheets backend)  
**Last Updated:** April 2026

---

## 1. Overview

BetaReads is a self-hosted, static web application deployed on GitHub Pages. It allows a single author (writer, scriptwriter, blogger) to share unpublished writings with beta readers (Viewers) in a controlled, feedback-friendly environment. Feedback is collected inline, stored in the browser, and synced to a connected Google Sheet — with no external server required.

---

## 2. Goals

- Give the author a private, shareable reading environment for beta testing their work.
- Allow viewers to leave rich, contextual feedback without friction.
- Protect content from copying and printing.
- Work fully offline-tolerant using browser storage, syncing when online.
- Require zero backend infrastructure — GitHub Pages + Google Sheets only.
- Respect Viewer privacy — no identifiable tracking beyond the name they choose to provide.

---

## 3. Non-Goals (v1.0)

- No multi-author support (single author per deployment).
- No real-time collaborative reading.
- No audio/video content support.
- No mobile app.
- No email notifications for new feedback.
- No Viewer identity verification (name is self-reported, for reference only).

---

## 4. Users & Roles

### 4.1 Author
The single owner of this BetaReads deployment. Accesses the **Author Dashboard** by logging in with username + password (credentials stored in Google Sheet Tab 1 — see Section 6.1). Manages all writings, sheet connection, and sharing settings.

### 4.2 Viewer (Beta Reader)
A person invited to read and give feedback. Accesses writing via a shared link. Identifies themselves with a self-chosen name (no account, no verification). Name and comments are stored in the browser for 30 days and synced to the Google Sheet.

---

## 5. Architecture Overview

```
GitHub Pages (Static)
│
├── index.html                  → Login screen → Author Dashboard
├── #/read/[slug]               → Viewer reading page (hash-based SPA routing)
│
└── Data Layer
    ├── localStorage             → Author session, Viewer name, comments, offline queue
    └── Google Sheets (via Apps Script Web App URL)
        ├── Tab 1: _config       → Author credentials + app settings
        ├── Tab 2: [Writing A]   → Feedback rows for Writing A
        ├── Tab 3: [Writing B]   → Feedback rows for Writing B
        └── ... one tab per writing
```

**Important constraint:** GitHub Pages is static. All dynamic behaviour — routing, page generation, auth, data sync — happens client-side in JavaScript. The Google Sheet is the only persistent store.

---

## 6. Feature Specification

---

### 6.1 Author Account & Setup

#### 6.1.1 First-Run Setup (One-Time Wizard)
On the very first load (no saved config detected), the app shows a two-step **Setup Wizard**:

**Step 1 — Connect Google Sheet**
- Author pastes their **Google Apps Script Web App URL**.
- App sends a validation `GET` ping to confirm the URL is live.
- URL saved to `localStorage` as `betareads_sheet_url`.
- Full copy-paste Apps Script shown on-screen (see Section 9).

**Step 2 — Create Author Account**

| Field | Notes |
|-------|-------|
| Display Name | Internal only (e.g. "Himanshu"). Not shown publicly. |
| Email | For reference only; stored in sheet; not used for sending mail. |
| Username | Used to log in to the dashboard. |
| Password | Min 8 characters; SHA-256 hashed before storing. Never stored in plaintext. |

On submission, the app writes these credentials into **Tab 1 (`_config`)** of the Google Sheet via Apps Script. They are also cached in `localStorage` for offline login.

**Security note shown in UI:**
> *Your credentials are stored in your own Google Sheet, which only you control. BetaReads never sends your data to any third-party server.*

#### 6.1.2 Login Screen
- Shown on every fresh session or after logout.
- Fields: **Username** + **Password**.
- On submit: SHA-256 hash of entered password compared against cached hash (or fetched from sheet if cache is cleared).
- On success: session token written to `sessionStorage` (cleared on tab close).
- On failure: error shown; after 3 failed attempts, 30-second lockout with countdown.

#### 6.1.3 Logout
- Clears `sessionStorage`.
- Returns to Login screen.
- Does not clear writing data or feedback from `localStorage`.

---

### 6.2 Author Dashboard

**Route:** `/` (post-login)

#### 6.2.1 Writing Manager
- Card grid of all writings.
- Each card shows: writing title, "Written by" credit, type badge (Novel / Script / Blog / Other), creation date, Viewer count (unique names in sheet tab), share link + copy button, password (masked, reveal on click).
- Enabled feedback type chips displayed on the card (e.g. 💬 Inline | 📝 General | ⭐ Rating | 📊 Structured).
- Button: **+ Add New Writing**

#### 6.2.2 Add New Writing Flow
A step-by-step modal:

| Field | Type | Notes |
|-------|------|-------|
| Title | Text input | Becomes the sheet tab name and URL slug. |
| Written by | Text input | Shown to Viewers on the reading page header. Supports pen names or multiple credits (e.g. "Riya Sharma & Dev Mehra"). Pre-filled with the author's Display Name; fully editable per writing. |
| Type | Dropdown | Novel, Script, Blog Post, Other. |
| Upload or Paste | Toggle | Upload `.txt` or `.md` file, OR paste text directly into a textarea. |
| Chapter Mode | Radio | Auto or Manual — see Section 6.2.3. |
| Feedback Controls | Multi-toggle | Enable/disable each feedback type independently — see Section 6.2.4. |
| Password Protection | Toggle + text | Optional. Viewer must enter password before reading. |
| Viewer Instructions | Textarea | Custom message shown to Viewers on the identity screen before they start reading. |

On submission:
- Slug generated from title (lowercase, hyphenated, e.g. `the-last-train`).
- Content, config, and metadata saved to `localStorage` under `betareads_writing_[slug]`.
- New tab created in Google Sheet via Apps Script.

#### 6.2.3 Chapter Mode — Instructions Shown to Author in UI

> **Auto Mode:** The app detects chapter breaks from Markdown headings (`#` for chapter, `##` for sub-section) or from lines beginning with the word "Chapter". Each heading becomes a navigable section. *Use this if your `.md` file already uses headings.*
>
> **Manual Mode:** You upload or paste the full text, then use a visual editor to place break markers by dragging them onto the text. Each marker defines where one chapter ends and the next begins. *Use this if your writing has no headings, or if you want precise control over where sections split.*
>
> **What Viewers see in both cases:** A collapsible chapter navigation panel (left panel on desktop, slide-out drawer on mobile), with per-chapter read-progress tracked visually.

#### 6.2.4 Feedback Type Controls (per Writing)

Author can independently toggle each feedback type ON or OFF at writing creation or any time after:

| Toggle | Feedback Type | Default |
|--------|--------------|---------|
| 💬 Inline Highlight + Comment | Viewer selects text and leaves a pinned comment | ✅ ON |
| 📝 General Chapter Comment | Open text box at the end of each chapter | ✅ ON |
| ⭐ Star / Emoji Rating | One-time rating shown after the final chapter | ✅ ON |
| 📊 Structured Feedback Form | Pacing/Clarity/etc. sliders shown at end of reading | ✅ ON |

Disabled types are hidden entirely from the Viewer. No placeholder or indication is shown.

#### 6.2.5 Feedback Dashboard (per Writing)
Accessible from each writing card → **View Feedback**.

- Table showing all rows from the corresponding Google Sheet tab.
- Columns: Viewer Name, Type, Chapter, Selected Text, Comment/Value, Timestamp, Status, Original Comment ID.
- `Status` column colour-coded: `new` (green chip) | `edited` (amber chip) | `deleted` (red chip).
- Filter by: Viewer, Chapter, Feedback Type, Status.
- Export to CSV button.

---

### 6.3 Viewer Reading Page

**Route:** `#/read/[slug]`
**Access:** Shared link. Password screen shown first if password is set.

#### 6.3.1 Viewer Identity Screen
Shown once per device per writing (re-shown after 30 days of inactivity).

- Field: **Your Name** — for reference only, shown next to comments. No account created.
- Checkbox: "I agree not to copy, share, or distribute this content."
- Author's custom instructions displayed below (if set).
- CTA: **Start Reading**

Name stored as `betareads_viewer_name` with 30-day TTL, refreshed on each visit.

#### 6.3.2 Reading Layout

- **Left panel (desktop) / Slide-out drawer (mobile):** Chapter list with read/unread indicators and scroll progress per chapter.
- **Center:** Writing content rendered from Markdown or plain text. Typography follows the writing type (see Section 7).
- **Right panel (desktop) / Bottom sheet (mobile):** Comment feed for the active chapter — shows all inline and general comments left by this Viewer, with edit/delete controls.
- **Top bar:** Writing title, "Written by" credit, Dark/Light mode toggle, chapter progress (e.g. "Chapter 3 of 11"), sync status indicator.

#### 6.3.3 Feedback Types

**A. Inline Highlight + Comment** *(if enabled)*
- Viewer selects any text passage.
- Floating tooltip appears: 💬 **Comment**
- Clicking opens a popover with a textarea. On submit, the highlighted text + comment is saved locally and queued for sync.
- Highlights render as a soft pastel underline. Hovering reveals the comment tooltip.
- Comment is editable and deletable from the comment panel (see Section 6.3.4).

**B. General End-of-Chapter Comment** *(if enabled)*
- Comment box pinned at the bottom of each chapter section.
- Viewer types a general note about the chapter.
- Editable and deletable from the comment panel (see Section 6.3.4).

**C. Star / Emoji Rating** *(if enabled — shown once, at end of reading)*
- Appears after the Viewer scrolls through the final chapter.
- Star rating (1–5) + optional emoji mood: 😐 🤔 😮 😢 😍
- Skippable via a "Skip" link.
- One-time only; cannot be edited after submission.

**D. Structured Feedback Form** *(if enabled — shown once, at end of reading)*
- Appears after the Star Rating (or directly after the final chapter if rating is disabled).
- Sliders (1–10): Pacing, Clarity, Engagement, Character Development, Overall Impression.
- Optional open text: **Final Thoughts**.
- One-time only; cannot be edited after submission.

#### 6.3.4 Comment Edit & Delete

Viewers can manage their own previously submitted **inline** and **general chapter** comments. Star ratings and structured forms are one-time submissions and cannot be modified.

**Edit flow:**
1. Viewer opens the comment panel, finds their comment, and clicks ✏️ **Edit**.
2. Comment text becomes an editable textarea pre-filled with the original.
3. On save: updated comment saved to `localStorage`. A **new row** is appended to the Google Sheet with `status: edited`, the new comment text, a new timestamp, and the `Original Comment ID` referencing the first row. The original row is never modified.
4. In the Author's Feedback Dashboard, both rows are visible; the `edited` row is treated as current.

**Delete flow:**
1. Viewer clicks 🗑️ **Delete** on their comment.
2. Confirmation: "Remove this comment? This cannot be undone."
3. On confirm: comment removed from Viewer's UI. A **new row** appended to the sheet with `status: deleted`, original comment ID, and timestamp. Original row preserved.
4. If the deleted comment was an inline highlight, the highlight underline fades from the text.

**Sheet impact:** Column M holds `status` (`new` / `edited` / `deleted`). Column N holds `Original Comment ID` to link edit/delete rows back to their origin row for the Author's reference.

#### 6.3.5 Dark / Light Mode
- Toggle in top bar. Default: **Light Mode**.
- Stored in `localStorage` as `betareads_theme`.
- CSS custom properties swap instantly — no flash, no reload.

---

### 6.4 Content Protection

Applied on the Viewer reading page only. The Author on the dashboard is unrestricted.

| Protection | Implementation |
|------------|----------------|
| **No text selection / copy** | `user-select: none` on content container + `copy` event blocked via JS |
| **No right-click** | `contextmenu` event suppressed |
| **No keyboard shortcuts** | Block `Ctrl+C`, `Ctrl+S`, `Ctrl+P`, `Ctrl+U`, `F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J` |
| **No printing** | `@media print { display: none }` on all content; `beforeprint` event triggers a full-page overlay |
| **Anti-screenshot (best-effort)** | CSS `mix-blend-mode` overlay + periodic DOM structure mutation. *Cannot block native OS screenshots — deters casual screen-capture tools only.* |
| **DevTools detection (best-effort)** | Window dimension delta check + `debugger` loop. On detection: content blurred, warning modal shown. *Determined technical users can bypass this.* |

**No watermark.** Viewer privacy is respected — no personal identifiers are embedded in or overlaid on the reading content.

**Disclaimer shown to Author in dashboard:**
> *Content protection uses client-side techniques that deter casual copying. They cannot prevent determined users with technical knowledge. There is no watermark — Viewer identity is kept private.*

---

### 6.5 Offline Support & Auto-Sync

- All feedback saved immediately to `localStorage` under `betareads_feedback_[slug]`.
- Unsynced items held in `betareads_sync_queue`.
- Sync triggers: page load, `window online` event, and every 60 seconds while the page is open.
- Sync is **automatic and forced** — no manual submit required. Offline feedback is pushed the moment connectivity returns.
- Sync status shown in top bar: 🟢 Synced | 🟡 Syncing… | 🔴 Offline (saved locally)
- **30-day TTL:** Viewer name and feedback in `localStorage` are timestamped. Data older than 30 days from last visit is purged. TTL resets on each visit.

---

## 7. Writing Format / Render Styles

| Type | Font | Line Height | Layout Notes |
|------|------|-------------|--------------|
| **Novel** | Georgia / serif | 1.8 | Justified text, generous side margins, drop-cap on chapter opening paragraph |
| **Script** | Courier Prime / monospace | 1.6 | Screenplay layout: action lines full-width, character names centred in caps, dialogue indented |
| **Blog Post** | Inter / sans-serif | 1.7 | Left-aligned, optimal reading column (65–75 chars wide) |
| **Other** | Inter / sans-serif | 1.7 | Same as Blog Post |

All styles inherit the active Material 3 theme and respect the OS-level font-size preference.

---

## 8. Design System — Material 3 Expressive Pastel

### 8.1 Colour Palette

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--md-primary` | `#7C5CBF` (soft violet) | `#CBBFFF` |
| `--md-on-primary` | `#FFFFFF` | `#3B1F7A` |
| `--md-primary-container` | `#EDE7FF` | `#523F8C` |
| `--md-secondary` | `#A0729A` (dusty rose) | `#E8B8E3` |
| `--md-tertiary` | `#6A8FBF` (powder blue) | `#B3CFEF` |
| `--md-surface` | `#FEFBFF` | `#1C1B1F` |
| `--md-on-surface` | `#1C1B1F` | `#E6E1E5` |
| `--md-surface-variant` | `#F3EDF7` | `#49454F` |
| `--md-error` | `#B3261E` | `#F2B8B5` |

### 8.2 Typography Scale

- **Display Large** (57px): Writing title on reading splash
- **Headline Medium** (28px): Chapter titles
- **Body Large** (16px): Reading body text
- **Label Large** (14px medium): Buttons, badges
- **Label Small** (11px): Timestamps, metadata

### 8.3 Components

- **Cards:** 16px border-radius, surface-variant fill, subtle elevation shadow
- **Buttons:** Filled (primary actions), Tonal (secondary), Text (skip/cancel)
- **FAB:** "+ Add New Writing" on dashboard
- **Chips:** Feedback type indicators, chapter labels, status tags
- **Snackbars:** Sync confirmation, copy-link success
- **Side Sheet (desktop) / Bottom Sheet (mobile):** Comment panel
- **Modal dialogs:** Setup wizard, add writing, login, edit/delete confirm

### 8.4 Motion & Animation

- Page transitions: Shared-axis slide (Material Motion spec)
- Chapter switch: Fade + 8px vertical translate
- Comment popover: Scale-in from text selection anchor
- Sync indicator: Pulse animation on 🟡 Syncing state
- All animations respect `prefers-reduced-motion: reduce`

### 8.5 Accessibility

- WCAG AA contrast minimum (4.5:1) on all text
- Visible focus rings for keyboard navigation
- ARIA labels on all icon-only buttons
- Screen reader live announcements for sync status changes
- Minimum 48×48px tap targets on mobile

---

## 9. Google Apps Script — Full Setup

### 9.1 What the Script Does
- Exposes `doPost(e)` and `doGet(e)` Web App endpoints.
- Handles four action types: `setup_account`, `create_tab`, `append_feedback`, `get_credentials`.
- Manages sheet tabs automatically (creates if missing, never deletes).
- Tab 1 (`_config`) stores author credentials. All other tabs are writing feedback tabs.

### 9.2 Sheet Tab Structure

**Tab 1 — `_config`** (always first, auto-created on setup)

| Column A | Column B |
|----------|----------|
| Key | Value |
| `display_name` | Author's display name |
| `email` | Author's email |
| `username` | Login username |
| `password_hash` | SHA-256 hash of password |
| `created_at` | ISO timestamp |
| `app_version` | `1.1` |

**Tab 2+ — `[Writing Title]`** (one per writing, named after the title)

| Col | Content |
|-----|---------|
| A | Timestamp |
| B | Viewer Name |
| C | Feedback Type (Inline / General / Rating / Structured) |
| D | Chapter |
| E | Selected Text (inline only) |
| F | Comment / Rating Value |
| G | Pacing |
| H | Clarity |
| I | Engagement |
| J | Character Development |
| K | Overall |
| L | Final Thoughts |
| M | Status (`new` / `edited` / `deleted`) |
| N | Original Comment ID |

### 9.3 Setup Instructions for Author

Shown in the dashboard's Setup Wizard with a **Copy Script** button:

1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Delete any existing code and paste the script below entirely.
4. Click **Save** (💾), then **Deploy → New Deployment**.
5. Set Type: **Web App** | Execute as: **Me** | Who has access: **Anyone**.
6. Click **Deploy**, complete Google's authorisation prompt.
7. Copy the **Web App URL** shown and paste it into BetaReads.

### 9.4 Apps Script Code

```javascript
// ============================================================
// BetaReads — Google Apps Script Backend v1.1
// Deploy as Web App | Execute as: Me | Access: Anyone
// ============================================================

const CONFIG_TAB = "_config";

const FEEDBACK_HEADERS = [
  "Timestamp", "Viewer Name", "Feedback Type", "Chapter",
  "Selected Text", "Comment / Rating",
  "Pacing", "Clarity", "Engagement", "Character Development", "Overall",
  "Final Thoughts", "Status", "Original Comment ID"
];

// ── Entry Points ─────────────────────────────────────────────

function doGet(e) {
  const action = e.parameter.action || "ping";
  if (action === "ping")            return json({ status: "betareads_ok" });
  if (action === "get_credentials") return json(getCredentials());
  return json({ status: "error", message: "Unknown GET action" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case "setup_account":   return json(setupAccount(data));
      case "create_tab":      return json(createWritingTab(data.writingTitle));
      case "append_feedback": return json(appendFeedback(data));
      default:
        return json({ status: "error", message: "Unknown action: " + data.action });
    }
  } catch (err) {
    return json({ status: "error", message: err.message });
  }
}

// ── Action Handlers ──────────────────────────────────────────

function setupAccount(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG_TAB);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_TAB, 0); // Force first position
    sheet.getRange(1, 1, 1, 2)
         .setValues([["Key", "Value"]])
         .setFontWeight("bold")
         .setBackground("#ede7ff");
    sheet.setFrozenRows(1);
  }

  const config = [
    ["display_name",  data.displayName  || ""],
    ["email",         data.email        || ""],
    ["username",      data.username     || ""],
    ["password_hash", data.passwordHash || ""],
    ["created_at",    new Date().toISOString()],
    ["app_version",   "1.1"]
  ];

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  sheet.getRange(2, 1, config.length, 2).setValues(config);

  return { status: "ok", message: "Account configured" };
}

function getCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG_TAB);
  if (!sheet) return { status: "error", message: "No _config tab found" };

  const data = sheet.getDataRange().getValues();
  const config = {};
  data.slice(1).forEach(row => { if (row[0]) config[row[0]] = row[1]; });
  return { status: "ok", config };
}

function createWritingTab(title) {
  if (!title) return { status: "error", message: "No title provided" };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(title);

  if (!sheet) {
    sheet = ss.insertSheet(title);
    sheet.appendRow(FEEDBACK_HEADERS);
    sheet.getRange(1, 1, 1, FEEDBACK_HEADERS.length)
         .setFontWeight("bold")
         .setBackground("#ede7ff");
    sheet.setFrozenRows(1);
  }

  return { status: "ok", tab: title };
}

function appendFeedback(data) {
  const tabName = data.writingTitle;
  if (!tabName) return { status: "error", message: "No writingTitle provided" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(tabName)) createWritingTab(tabName);
  const sheet = ss.getSheetByName(tabName);

  const rows = Array.isArray(data.feedback) ? data.feedback : [data.feedback];
  rows.forEach(fb => {
    sheet.appendRow([
      fb.timestamp         || new Date().toISOString(),
      fb.viewerName        || "",
      fb.type              || "",
      fb.chapter           || "",
      fb.selectedText      || "",
      fb.comment           || "",
      fb.pacing            || "",
      fb.clarity           || "",
      fb.engagement        || "",
      fb.characterDev      || "",
      fb.overall           || "",
      fb.finalThoughts     || "",
      fb.status            || "new",
      fb.originalCommentId || ""
    ]);
  });

  return { status: "ok", rows: rows.length };
}

// ── Utility ──────────────────────────────────────────────────

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## 10. URL & Routing Strategy

Hash-based SPA routing — no server-side redirect rules needed on GitHub Pages.

| URL | View |
|-----|------|
| `https://[username].github.io/betareads/` | Login screen (→ Dashboard on auth) |
| `https://[username].github.io/betareads/#/read/the-last-train` | Viewer reading page |
| `https://[username].github.io/betareads/#/read/the-last-train?pw=abc` | Password-protected reading page |

Passwords are SHA-256 hashed via Web Crypto API before storage and comparison. Never stored in plaintext anywhere.

---

## 11. Data Storage Map

| Key | Storage | Content | TTL |
|-----|---------|---------|-----|
| `betareads_sheet_url` | localStorage | Apps Script Web App URL | Forever |
| `betareads_auth` | localStorage | Cached username + password hash | Forever |
| `betareads_session` | sessionStorage | Active login token | Tab close |
| `betareads_writings` | localStorage | Array of writing metadata + per-writing feedback config | Forever |
| `betareads_writing_[slug]` | localStorage | Full content + chapter structure + config | Forever |
| `betareads_viewer_name` | localStorage | Self-reported name + last-seen timestamp | 30 days |
| `betareads_theme` | localStorage | `light` or `dark` | Forever |
| `betareads_feedback_[slug]` | localStorage | All this Viewer's feedback for this writing | 30 days |
| `betareads_sync_queue` | localStorage | Unsynced feedback items pending push | Cleared on sync |

---

## 12. Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 600px` (Mobile) | Single column. Chapter nav → slide-out drawer. Comment panel → bottom sheet. |
| `600–1024px` (Tablet) | Two columns: nav + content. Comment panel → bottom sheet. |
| `> 1024px` (Desktop) | Three columns: nav \| content \| comments side sheet. |

---

## 13. Technical Stack

| Layer | Technology |
|-------|-----------|
| Hosting | GitHub Pages |
| Frontend | Vanilla HTML + CSS + JavaScript (no framework required for v1) |
| Styling | CSS Custom Properties (Material 3 tokens) + Google Fonts |
| Markdown Rendering | `marked.js` (CDN) |
| Password Hashing | Web Crypto API — `SubtleCrypto.digest('SHA-256', ...)` |
| Backend / DB | Google Sheets via Apps Script Web App |
| Offline Queue | `localStorage` + `navigator.onLine` + `window online` event |

---

## 14. Out of Scope / Future Versions

- v2: Multi-device author login via Google OAuth (replaces local session).
- v2: Email notification on new feedback (requires EmailJS or similar lightweight service).
- v2: Writing version history with side-by-side diff view between drafts.
- v3: Export feedback as a formatted PDF annotation report.
- v3: Support for `.docx` file upload.
- v3: Named reader groups with individual reading progress tracking.

---

*End of PRD v1.1*
