/**
 * Fake Claude API — Dashboard client
 *
 * Handles navigation, server health polling, and request log display.
 * Vanilla JS, no dependencies.
 */

'use strict';

// ── DOM References ──────────────────────────────────────────────────────────
const statusBadge   = document.getElementById('status-badge');
const requestsTable = document.getElementById('requests-table');
const logOutput     = document.getElementById('log-output');
const clearLogsBtn  = document.getElementById('clear-logs-btn');
const navLinks      = document.querySelectorAll('.nav-link');

// ── State ───────────────────────────────────────────────────────────────────
const state = {
  online: false,
  requests: [],
  logs: [],
};

// ── Navigation ──────────────────────────────────────────────────────────────
/** Switch visible section based on nav link clicks */
function initNavigation() {
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;

      // Update active nav link
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      // Show/hide sections
      document.querySelectorAll('.section').forEach((section) => {
        section.classList.toggle('hidden', section.id !== `section-${target}`);
      });
    });
  });
}

// ── Server Health ───────────────────────────────────────────────────────────
/** Ping the server and update the status badge */
async function checkServerHealth() {
  try {
    const res = await fetch('/health', { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      setOnline(true);
    } else {
      setOnline(false);
    }
  } catch {
    setOnline(false);
  }
}

function setOnline(online) {
  state.online = online;
  statusBadge.textContent = online ? 'Online' : 'Offline';
  statusBadge.classList.toggle('online', online);
}

// ── Request Log ─────────────────────────────────────────────────────────────
/**
 * Add a request entry to the dashboard table.
 * @param {{ time: string, method: string, path: string, model: string, status: number }} entry
 */
function addRequestRow(entry) {
  const tbody = requestsTable.querySelector('tbody');

  // Remove the empty-state row if present
  const emptyRow = tbody.querySelector('.table__empty-row');
  if (emptyRow) emptyRow.remove();

  const tr = document.createElement('tr');

  const statusClass = entry.status < 400 ? 'ok' : 'error';

  tr.innerHTML = `
    <td>${escapeHtml(entry.time)}</td>
    <td>${escapeHtml(entry.method)}</td>
    <td>${escapeHtml(entry.path)}</td>
    <td>${escapeHtml(entry.model || '—')}</td>
    <td><span class="status-dot status-dot--${statusClass}"></span>${entry.status}</td>
  `;

  // Prepend so newest is at top
  tbody.prepend(tr);

  // Keep max 50 rows
  while (tbody.children.length > 50) {
    tbody.lastElementChild.remove();
  }

  state.requests.push(entry);
  document.getElementById('stat-requests').textContent = state.requests.length;
}

// ── Log Output ──────────────────────────────────────────────────────────────
function appendLog(message) {
  state.logs.push(message);
  logOutput.textContent = state.logs.join('\n');
  logOutput.scrollTop = logOutput.scrollHeight;
}

function clearLogs() {
  state.logs = [];
  logOutput.textContent = 'Logs cleared.';
}

// ── Uptime Display ──────────────────────────────────────────────────────────
const startTime = Date.now();

function updateUptime() {
  if (!state.online) {
    document.getElementById('stat-uptime').textContent = '—';
    return;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  document.getElementById('stat-uptime').textContent = parts.join(' ');
}

// ── Utilities ───────────────────────────────────────────────────────────────
/** Escape HTML to prevent XSS when inserting user-provided values */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Init ────────────────────────────────────────────────────────────────────
function init() {
  initNavigation();
  clearLogsBtn.addEventListener('click', clearLogs);

  // Poll server health every 5 seconds
  checkServerHealth();
  setInterval(checkServerHealth, 5000);

  // Update uptime display every second
  setInterval(updateUptime, 1000);
}

document.addEventListener('DOMContentLoaded', init);