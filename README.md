# BetaReads

> A self-hosted web app for authors to share unpublished writings with beta readers and collect rich, contextual feedback — powered by GitHub Pages + Google Sheets.

![BetaReads](https://img.shields.io/badge/version-1.1-44B186?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square) ![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-blue?style=flat-square)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📝 **Writing Manager** | Upload or paste `.txt` / `.md` files. Auto or manual chapter detection. |
| 💬 **Inline Comments** | Readers highlight text and leave contextual feedback. |
| 📝 **Chapter Comments** | General feedback box at the end of each chapter. |
| ⭐ **Star & Emoji Rating** | 1–5 star rating + emoji mood after reading. |
| 📊 **Structured Feedback** | Pacing, Clarity, Engagement, Character Dev sliders (1–10). |
| 🔒 **Password Protection** | Optional per-writing password gate. |
| 🛡️ **Content Protection** | Anti-copy, anti-print, DevTools detection (best-effort). |
| 🌙 **Dark / Light Mode** | Instant toggle with no flash. |
| 📱 **Fully Responsive** | Mobile (< 600px), Tablet (600–1024px), Desktop (> 1024px). |
| 🔄 **Auto-Sync** | Offline-first. Feedback syncs to Google Sheets on reconnect. |
| 📊 **Feedback Dashboard** | Filter, view, and export feedback as CSV. |
| 🔗 **Shareable Links** | Generate share URLs that work for anyone — no login needed for readers. |
| ☁️ **Cloud Content Hosting** | Writing content is stored in a dedicated `_content_db` Google Sheet tab. External readers fetch content on-demand. |
| 🎨 **Material 3 Design** | Expressive pastel theme with smooth animations. |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Hosting** | GitHub Pages (static) |
| **Frontend** | Vanilla HTML + CSS + JavaScript (no framework) |
| **Styling** | CSS Custom Properties (Material 3 design tokens) |
| **Fonts** | Google Fonts (Inter, Courier Prime) |
| **Markdown** | [marked.js](https://github.com/markedjs/marked) via CDN |
| **Password Hashing** | Web Crypto API (`SHA-256`) |
| **Backend / DB** | Google Sheets via [Apps Script](https://developers.google.com/apps-script) Web App |
| **Offline** | `localStorage` + `navigator.onLine` + `window online` event |

---

## 🚀 Deploy to GitHub Pages

### 1. Fork or Clone This Repo

```bash
git clone https://github.com/YOUR_USERNAME/BetaReads.git
cd BetaReads
```

### 2. Enable GitHub Pages

1. Go to your repo on GitHub.
2. Navigate to **Settings → Pages**.
3. Under **Source**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Click **Save**.
6. Your site will be live at `https://YOUR_USERNAME.github.io/BetaReads/` within a few minutes.

### 3. Set Up Google Sheets Backend

1. Create a new [Google Sheet](https://sheets.google.com).
2. Go to **Extensions → Apps Script**.
3. Delete any existing code and **paste the full script** (provided in the app's Setup Wizard — click **📋 Copy Script**).
4. Click **Save** (💾), then **Deploy → New Deployment**.
5. Set:
   - **Type**: Web App
   - **Execute as**: Me
   - **Who has access**: Anyone
6. Click **Deploy**, complete Google's authorisation prompt.
7. Copy the **Web App URL**.

> ⚠️ **Important:** Whenever BetaReads is updated, you must re-deploy the script:
> Open Apps Script → **Deploy → Manage Deployments** → click ✏️ → set **Version** to **New version** → **Deploy**.

### 4. Complete In-App Setup

1. Open your deployed site (or `localhost`).
2. Paste the Web App URL into the setup wizard.
3. Create your author account (username + password).
4. Start adding writings!

---

## 🔗 How Sharing Works

BetaReads uses your Google Sheet as a **content delivery backend**, so external readers can access your writing without any login or local data.

### Flow

1. **Author adds a writing** on the dashboard.
2. The app automatically uploads the full text to a `_content_db` tab in your Google Sheet (split into ≤40k-character chunks to bypass cell limits).
3. A **shareable URL** is generated: `https://yoursite.com/#/read/my-novel?db=<encoded-sheet-url>`
4. When a reader opens the link:
   - The `db` parameter tells the app where to fetch the content.
   - The app downloads the writing from Google Sheets and renders it instantly.
   - Readers can leave feedback, which syncs back to the same Google Sheet.

### No Server Required

- The Google Sheet acts as both the database and API.
- The reader's browser talks directly to your Google Apps Script.
- You never need a Node.js/Python backend.

---

## 💻 Run Locally

No build tools required — it's all static files.

### Option A: Python HTTP Server (recommended)

```bash
cd BetaReads
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

### Option B: Node.js

```bash
npx -y serve .
```

### Option C: VS Code Live Server

1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).
2. Right-click `index.html` → **Open with Live Server**.

### Option D: Just Open the File

You can open `index.html` directly in your browser. Some features like Google Sheets sync require a server (due to CORS), but the UI will work.

---

## 📁 Project Structure

```
BetaReads/
├── index.html              # SPA entry point (all views)
├── assets/
│   └── icon-1080.png       # Brand logo (favicon + PWA icon)
├── css/
│   ├── tokens.css          # Material 3 design tokens (colors, type, spacing)
│   ├── base.css            # CSS reset, utilities, global styles
│   ├── components.css      # Cards, buttons, chips, modals, forms
│   ├── dashboard.css       # Author dashboard layout
│   ├── reader.css          # Viewer reading page (3-panel layout)
│   └── responsive.css      # Mobile/tablet/desktop breakpoints
├── js/
│   ├── app.js              # SPA router, page lifecycle, init
│   ├── auth.js             # Login, SHA-256 hashing, lockout
│   ├── setup.js            # First-run wizard + Apps Script template
│   ├── dashboard.js        # Writing manager, feedback dashboard
│   ├── reader.js           # Viewer reading page, chapter navigation
│   ├── feedback.js         # All 4 feedback types, edit/delete
│   ├── sync.js             # Offline queue, auto-sync, content hosting
│   ├── storage.js          # localStorage helpers with TTL
│   ├── protection.js       # Content protection (best-effort)
│   ├── markdown.js         # Markdown parsing, chapter detection
│   └── theme.js            # Dark/light mode toggle
├── PRD.md                  # Product Requirements Document
└── README.md               # This file
```

---

## 🔐 How Auth Works

1. **Password hashing**: All passwords are SHA-256 hashed using the Web Crypto API before storage. Plaintext passwords are never stored.
2. **Credentials storage**: Your hashed credentials are stored in your own Google Sheet's `_config` tab. They're also cached in `localStorage` for offline login.
3. **Sessions**: Login sessions use `sessionStorage` (cleared when the tab closes).
4. **Lockout**: 3 failed login attempts → 30-second countdown lockout.

---

## 🔄 How Sync Works

### Feedback Sync
1. All feedback is saved **immediately** to `localStorage`.
2. Unsynced items are held in a **sync queue**.
3. Sync triggers automatically on:
   - Page load
   - `window online` event (network reconnect)
   - Every 60 seconds
4. Failed syncs retry with **exponential backoff** (up to 3 retries).
5. Sync status is shown in the UI: 🟢 Synced | 🟡 Syncing… | 🔴 Offline

### Content Publishing
1. When a writing is added or edited, the full chapter content is **automatically** pushed to the `_content_db` tab.
2. Large content is split into **≤40,000 character chunks** (Google Sheets limits cells to 50k characters).
3. The chunks are reassembled seamlessly when a reader fetches the writing.

---

## 🛡️ Content Protection

| Method | What It Does |
|--------|-------------|
| `user-select: none` | Prevents text selection on content |
| `copy` event block | Prevents Ctrl+C / Cmd+C |
| `contextmenu` block | Disables right-click |
| Keyboard shortcut block | Blocks Ctrl+C/S/P/U, F12, DevTools shortcuts |
| `@media print` | Hides content when printing |
| `mix-blend-mode` overlay | Best-effort anti-screenshot |
| DevTools detection | Dimension delta check + content blur |

> ⚠️ These are **client-side deterrents only**. Determined technical users can bypass them. There is no watermark — viewer privacy is respected.

---

## 📖 Writing Types & Typography

| Type | Font | Style |
|------|------|-------|
| **Novel** | Georgia (serif) | Justified, 1.8 line-height, drop-cap on chapter openings |
| **Script** | Courier Prime (mono) | Screenplay layout, centered character names, indented dialogue |
| **Blog Post** | Inter (sans-serif) | Left-aligned, 1.7 line-height, 65-75 char column |
| **Other** | Inter (sans-serif) | Same as Blog Post |

---

## 📊 Google Sheet Tab Structure

### `_config` tab (auto-created)

| Key | Value |
|-----|-------|
| `display_name` | Your display name |
| `username` | Login username |
| `password_hash` | SHA-256 hashed password |
| `created_at` | ISO timestamp |

### `_content_db` tab (auto-created on first publish)

This is the **dedicated content hosting** tab. Writing text is stored here so external readers can fetch it.

| Column | Content |
|--------|---------|
| A | Slug (unique writing identifier) |
| B | Metadata JSON (title, author, config, password) |
| C | Chunk Index (0, 1, 2…) |
| D | Total Chunks |
| E | Content Chunk (≤40k characters of the chapter JSON) |

### Feedback tabs (one per writing title)

| Column | Content |
|--------|---------|
| A | Timestamp |
| B | Viewer Name |
| C | Feedback Type |
| D | Chapter |
| E | Selected Text |
| F | Comment / Rating |
| G-K | Structured scores |
| L | Final Thoughts |
| M | Status (new/edited/deleted) |
| N | Original Comment ID |

---

## 📐 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `< 600px` | Single column. Drawer nav. Bottom sheet comments. |
| `600–1024px` | Two columns (nav + content). Bottom sheet comments. |
| `> 1024px` | Three columns (nav \| content \| comments side sheet). |

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

---

## 📄 License

MIT — Free to use, modify, and distribute.
