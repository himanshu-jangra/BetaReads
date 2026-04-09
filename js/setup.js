// ============================================================
// BetaReads — Setup Wizard (First-Run Configuration)
// ============================================================

const Setup = (() => {
  let currentStep = 1;

  // Apps Script code from PRD Section 9.4
  const APPS_SCRIPT_CODE = `// ============================================================
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
    sheet = ss.insertSheet(CONFIG_TAB, 0);
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
}`;

  /**
   * Initialize the setup wizard
   */
  function init() {
    currentStep = 1;
    renderStep(1);
    bindEvents();
  }

  /**
   * Render the current step
   */
  function renderStep(step) {
    document.querySelectorAll('.setup-step-content').forEach(el => {
      el.classList.remove('active');
    });
    const stepEl = document.getElementById(`setup-step-${step}`);
    if (stepEl) stepEl.classList.add('active');

    // Update stepper
    document.querySelectorAll('.stepper-step').forEach((el, i) => {
      el.classList.remove('active', 'completed');
      if (i + 1 === step) el.classList.add('active');
      if (i + 1 < step) el.classList.add('completed');
    });
  }

  /**
   * Bind wizard events
   */
  function bindEvents() {
    // Step 1: Validate Sheet URL
    const validateBtn = document.getElementById('setup-validate-url');
    if (validateBtn) {
      validateBtn.addEventListener('click', handleValidateUrl);
    }

    // Copy script button
    const copyScriptBtn = document.getElementById('setup-copy-script');
    if (copyScriptBtn) {
      copyScriptBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
          copyScriptBtn.textContent = '✓ Copied!';
          copyScriptBtn.classList.add('copied');
          setTimeout(() => {
            copyScriptBtn.textContent = '📋 Copy Script';
            copyScriptBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }

    // Step 2: Create Account
    const createBtn = document.getElementById('setup-create-account');
    if (createBtn) {
      createBtn.addEventListener('click', handleCreateAccount);
    }

    // Display the script code
    const scriptDisplay = document.getElementById('setup-script-code');
    if (scriptDisplay) {
      scriptDisplay.textContent = APPS_SCRIPT_CODE;
    }
  }

  /**
   * Handle URL validation
   */
  async function handleValidateUrl() {
    const urlInput = document.getElementById('setup-sheet-url');
    const statusEl = document.getElementById('setup-url-status');
    const validateBtn = document.getElementById('setup-validate-url');
    const nextBtn = document.getElementById('setup-step1-next');

    const url = urlInput.value.trim();

    if (!url) {
      statusEl.textContent = 'Please enter a URL.';
      statusEl.className = 'input-error';
      return;
    }

    if (!url.startsWith('https://script.google.com/')) {
      statusEl.textContent = 'URL should start with https://script.google.com/';
      statusEl.className = 'input-error';
      return;
    }

    validateBtn.disabled = true;
    validateBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Validating…';

    const isValid = await Auth.validateSheetUrl(url);

    if (isValid) {
      Storage.set(Storage.KEYS.SHEET_URL, url);
      statusEl.textContent = '✓ Connected successfully!';
      statusEl.className = 'input-helper text-success';
      urlInput.classList.remove('error');

      // Move to step 2
      setTimeout(() => {
        currentStep = 2;
        renderStep(2);
      }, 800);
    } else {
      statusEl.textContent = '✗ Could not connect. Make sure the script is deployed as a Web App with "Anyone" access.';
      statusEl.className = 'input-error';
      urlInput.classList.add('error');
    }

    validateBtn.disabled = false;
    validateBtn.textContent = 'Validate & Connect';
  }

  /**
   * Handle account creation
   */
  async function handleCreateAccount() {
    const form = {
      displayName: document.getElementById('setup-display-name').value.trim(),
      email: document.getElementById('setup-email').value.trim(),
      username: document.getElementById('setup-username').value.trim(),
      password: document.getElementById('setup-password').value
    };

    const errorEl = document.getElementById('setup-account-error');

    // Validate
    if (!form.displayName || !form.username || !form.password) {
      errorEl.textContent = 'Display Name, Username, and Password are required.';
      return;
    }

    if (form.password.length < 8) {
      errorEl.textContent = 'Password must be at least 8 characters.';
      return;
    }

    const createBtn = document.getElementById('setup-create-account');
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Creating account…';

    const result = await Auth.createAccount(form);

    if (result.success) {
      errorEl.textContent = '';
      App.showSnackbar('Account created! Redirecting to login…');
      setTimeout(() => {
        App.navigate('');
      }, 1000);
    } else {
      errorEl.textContent = result.error;
      createBtn.disabled = false;
      createBtn.textContent = 'Create Account';
    }
  }

  return { init, APPS_SCRIPT_CODE };
})();
