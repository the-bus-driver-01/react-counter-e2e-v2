/**
 * Fake Claude API Dashboard — vanilla JS controller
 * Handles form validation, status polling, request log, and toast notifications.
 */
(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const statusDot = $('#statusDot');
  const statusText = $('#statusText');
  const configForm = $('#configForm');
  const portInput = $('#portInput');
  const portError = $('#portError');
  const baseUrlInput = $('#baseUrlInput');
  const baseUrlError = $('#baseUrlError');
  const checkBtn = $('#checkBtn');
  const clearLogBtn = $('#clearLogBtn');
  const requestLog = $('#requestLog');
  const logEmpty = $('#logEmpty');
  const toastContainer = $('#toastContainer');

  // Stat elements
  const totalRequestsEl = $('#totalRequests');
  const successCountEl = $('#successCount');
  const errorCountEl = $('#errorCount');
  const avgLatencyEl = $('#avgLatency');

  // ── State ─────────────────────────────────────────────────────
  const state = {
    baseUrl: 'http://localhost:4321',
    online: false,
    logs: [],
    stats: { total: 0, success: 0, errors: 0, latencies: [] },
  };

  const MAX_LOG_ENTRIES = 200;

  // ── Validation ────────────────────────────────────────────────

  function validatePort(value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 65535) {
      return 'Port must be 1–65535';
    }
    return '';
  }

  function validateUrl(value) {
    if (!value.trim()) return 'URL is required';
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'Must be http or https';
      }
    } catch {
      return 'Invalid URL';
    }
    return '';
  }

  function showFieldError(input, errorEl, message) {
    errorEl.textContent = message;
    input.classList.toggle('invalid', !!message);
  }

  // Validate on input (debounced for responsiveness)
  let portTimer, urlTimer;

  portInput.addEventListener('input', () => {
    clearTimeout(portTimer);
    portTimer = setTimeout(() => {
      showFieldError(portInput, portError, validatePort(portInput.value));
    }, 300);
  });

  baseUrlInput.addEventListener('input', () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      showFieldError(baseUrlInput, baseUrlError, validateUrl(baseUrlInput.value));
    }, 300);
  });

  // Sync port into base URL
  portInput.addEventListener('change', () => {
    const portErr = validatePort(portInput.value);
    if (!portErr) {
      try {
        const url = new URL(baseUrlInput.value || 'http://localhost');
        url.port = portInput.value;
        baseUrlInput.value = url.toString().replace(/\/$/, '');
        showFieldError(baseUrlInput, baseUrlError, '');
      } catch { /* ignore */ }
    }
  });

  // ── Form Submit ───────────────────────────────────────────────

  configForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const portErr = validatePort(portInput.value);
    const urlErr = validateUrl(baseUrlInput.value);

    showFieldError(portInput, portError, portErr);
    showFieldError(baseUrlInput, baseUrlError, urlErr);

    if (portErr || urlErr) {
      toast('Fix validation errors before saving.', 'error');
      return;
    }

    state.baseUrl = baseUrlInput.value.replace(/\/$/, '');
    toast('Configuration saved.', 'success');
    checkStatus();
  });

  // ── Status Check ──────────────────────────────────────────────

  async function checkStatus() {
    statusText.textContent = 'Checking...';
    statusDot.className = 'status-badge__dot';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(state.baseUrl + '/v1/models', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      state.online = res.ok;
      statusDot.classList.add(state.online ? 'online' : 'offline');
      statusText.textContent = state.online ? 'Online' : `Error (${res.status})`;
    } catch (err) {
      state.online = false;
      statusDot.classList.add('offline');
      statusText.textContent = err.name === 'AbortError' ? 'Timeout' : 'Offline';
    }
  }

  checkBtn.addEventListener('click', checkStatus);

  // ── Request Log ───────────────────────────────────────────────

  function addLogEntry(entry) {
    state.logs.push(entry);
    if (state.logs.length > MAX_LOG_ENTRIES) {
      state.logs.shift();
    }

    // Update stats
    state.stats.total++;
    if (entry.status < 400) {
      state.stats.success++;
    } else {
      state.stats.errors++;
    }
    if (typeof entry.latency === 'number') {
      state.stats.latencies.push(entry.latency);
      if (state.stats.latencies.length > 100) state.stats.latencies.shift();
    }

    renderStats();
    renderLogEntry(entry);
  }

  function renderLogEntry(entry) {
    if (logEmpty) logEmpty.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'log__entry';
    div.innerHTML = `
      <span class="log__time">${escapeHtml(entry.time)}</span>
      <span class="log__method ${escapeHtml(entry.method)}">${escapeHtml(entry.method)}</span>
      <span class="log__path">${escapeHtml(entry.path)}</span>
      <span class="log__status ${entry.status < 400 ? 'ok' : 'error'}">${entry.status}</span>
    `;

    requestLog.appendChild(div);

    // Keep log scrolled to bottom if user is near bottom
    const isNearBottom =
      requestLog.scrollHeight - requestLog.scrollTop - requestLog.clientHeight < 60;
    if (isNearBottom) {
      requestLog.scrollTop = requestLog.scrollHeight;
    }
  }

  function renderStats() {
    totalRequestsEl.textContent = state.stats.total;
    successCountEl.textContent = state.stats.success;
    errorCountEl.textContent = state.stats.errors;

    if (state.stats.latencies.length > 0) {
      const avg =
        state.stats.latencies.reduce((a, b) => a + b, 0) /
        state.stats.latencies.length;
      avgLatencyEl.textContent = avg < 1000 ? `${Math.round(avg)}ms` : `${(avg / 1000).toFixed(1)}s`;
    }
  }

  clearLogBtn.addEventListener('click', () => {
    state.logs = [];
    state.stats = { total: 0, success: 0, errors: 0, latencies: [] };
    requestLog.innerHTML = '<div class="log__empty">No requests yet. Start your app to see traffic.</div>';
    renderStats();
    totalRequestsEl.textContent = '0';
    successCountEl.textContent = '0';
    errorCountEl.textContent = '0';
    avgLatencyEl.textContent = '-';
  });

  // ── Toast Notifications ───────────────────────────────────────

  function toast(message, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer.appendChild(el);

    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, 3000);
  }

  // ── HTML Escaping ─────────────────────────────────────────────

  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => escapeMap[c]);
  }

  // ── Demo: simulate some log entries for visual testing ────────

  function simulateTraffic() {
    const methods = ['POST', 'GET'];
    const paths = ['/v1/messages', '/v1/models', '/v1/messages?stream=true'];
    const statuses = [200, 200, 200, 200, 400, 500];

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });

    addLogEntry({
      time,
      method: methods[Math.floor(Math.random() * methods.length)],
      path: paths[Math.floor(Math.random() * paths.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      latency: Math.floor(Math.random() * 3000) + 100,
    });
  }

  // Expose for external use (e.g., server could inject entries)
  window.fakeClaude = {
    addLogEntry,
    toast,
    checkStatus,
    simulateTraffic,
  };

  // ── Init ──────────────────────────────────────────────────────
  checkStatus();
})();