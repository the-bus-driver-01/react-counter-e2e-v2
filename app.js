/**
 * Dashboard UI for Fake Claude API
 * Vanilla JS — no dependencies
 */
(function () {
  "use strict";

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    requests: 0,
    tokens: 0,
    errors: 0,
    log: [],
  };

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const els = {
    statRequests: document.getElementById("stat-requests"),
    statTokens: document.getElementById("stat-tokens"),
    statErrors: document.getElementById("stat-errors"),
    logContainer: document.getElementById("log-container"),
    copyBtn: document.getElementById("copy-config"),
    clearBtn: document.getElementById("clear-log"),
    configBlock: document.getElementById("config-block"),
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  /** Update the stat counters in the DOM */
  function renderStats() {
    els.statRequests.textContent = state.requests.toLocaleString();
    els.statTokens.textContent = state.tokens.toLocaleString();
    els.statErrors.textContent = state.errors.toLocaleString();
  }

  /** Render the request log list */
  function renderLog() {
    if (state.log.length === 0) {
      els.logContainer.innerHTML = `
        <div class="empty">
          <div class="empty__icon">~</div>
          <p class="empty__text">No requests yet. Point your app at this server to get started.</p>
        </div>`;
      return;
    }

    const list = document.createElement("ul");
    list.className = "log-list";

    // Show newest first, cap at 50
    const items = state.log.slice(-50).reverse();
    for (const entry of items) {
      const li = document.createElement("li");
      li.className = "log-item animate-in";

      const statusClass =
        entry.status < 400
          ? "log-item__status--ok"
          : "log-item__status--err";

      li.innerHTML = `
        <span class="log-item__method">${escapeHtml(entry.method)}</span>
        <span class="log-item__path">${escapeHtml(entry.path)}</span>
        <span class="log-item__status ${statusClass}">${entry.status}</span>
        <span class="log-item__time">${entry.time}</span>`;
      list.appendChild(li);
    }

    els.logContainer.replaceChildren(list);
  }

  /** Minimal HTML escaping */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Add a mock request entry (used for demo / wired to real server later) */
  function addRequest(method, path, status) {
    const now = new Date();
    const time = now.toLocaleTimeString();
    state.requests++;
    state.tokens += Math.floor(Math.random() * 500) + 50;
    if (status >= 400) state.errors++;
    state.log.push({ method, path, status, time });
    renderStats();
    renderLog();
  }

  /** Copy config to clipboard */
  function copyConfig() {
    const text =
      "export ANTHROPIC_BASE_URL=http://localhost:4321\nexport ANTHROPIC_API_KEY=fake-key";
    navigator.clipboard.writeText(text).then(() => {
      els.copyBtn.textContent = "Copied!";
      setTimeout(() => {
        els.copyBtn.textContent = "Copy";
      }, 2000);
    });
  }

  /** Clear the log */
  function clearLog() {
    state.log = [];
    state.requests = 0;
    state.tokens = 0;
    state.errors = 0;
    renderStats();
    renderLog();
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  els.copyBtn.addEventListener("click", copyConfig);
  els.clearBtn.addEventListener("click", clearLog);

  // ── Expose for external use ──────────────────────────────────────────────
  window.fakeClaude = { addRequest };

  // ── Initial render ───────────────────────────────────────────────────────
  renderStats();
})();