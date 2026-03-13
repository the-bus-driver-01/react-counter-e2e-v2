/**
 * Data Export Tool — app.js
 *
 * Manages data entries and provides export in CSV, JSON, TSV, and XML formats.
 * Pure vanilla JS, no dependencies.
 */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────

/** @type {Array<{id: string, name: string, email: string, role: string, added: string}>} */
let entries = [];

// ── DOM References ───────────────────────────────────────────────────────────

const form = document.getElementById('data-form');
const tableBody = document.getElementById('table-body');
const entryCount = document.getElementById('entry-count');
const btnClear = document.getElementById('btn-clear');
const exportButtons = document.querySelectorAll('.btn-export');
const toastEl = document.getElementById('toast');

const fieldName = document.getElementById('field-name');
const fieldEmail = document.getElementById('field-email');
const fieldRole = document.getElementById('field-role');

const chkHeaders = document.getElementById('include-headers');
const chkTimestamp = document.getElementById('include-timestamp');
const chkPretty = document.getElementById('pretty-print');

// ── Utility ──────────────────────────────────────────────────────────────────

/** Generate a short unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Format a date string for display */
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Escape a value for CSV (handles commas, quotes, newlines) */
function csvEscape(val) {
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** Escape special XML characters */
function xmlEscape(val) {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── Toast Notifications ──────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = '') {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = 'toast' + (type ? ` ${type}` : '');
  // Force reflow for re-trigger animation
  void toastEl.offsetWidth;
  toastEl.classList.add('visible');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
  }, 3000);
}

// ── Data Management ──────────────────────────────────────────────────────────

function addEntry(name, email, role) {
  const entry = {
    id: uid(),
    name: name.trim(),
    email: email.trim(),
    role: role.trim() || '—',
    added: new Date().toISOString(),
  };
  entries.push(entry);
  updateUI();
  showToast('Entry added', 'success');
}

function removeEntry(id) {
  entries = entries.filter((e) => e.id !== id);
  updateUI();
  showToast('Entry removed');
}

function clearAll() {
  if (entries.length === 0) return;
  entries = [];
  updateUI();
  showToast('All entries cleared');
}

// ── UI Rendering ─────────────────────────────────────────────────────────────

function updateUI() {
  renderTable();
  updateControls();
}

function renderTable() {
  if (entries.length === 0) {
    tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">No data yet. Add an entry above to get started.</td></tr>';
    return;
  }

  tableBody.innerHTML = entries
    .map(
      (entry, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.email)}</td>
        <td>${escapeHtml(entry.role)}</td>
        <td>${formatDate(entry.added)}</td>
        <td><button class="btn-delete" data-id="${entry.id}" title="Remove entry">Remove</button></td>
      </tr>`
    )
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateControls() {
  const hasData = entries.length > 0;
  entryCount.textContent = entries.length;
  btnClear.disabled = !hasData;
  exportButtons.forEach((btn) => (btn.disabled = !hasData));
}

// ── Export Functions ─────────────────────────────────────────────────────────

/** Get column config based on user settings */
function getColumns() {
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
  ];
  if (chkTimestamp.checked) {
    cols.push({ key: 'added', label: 'Added' });
  }
  return cols;
}

/** Export data as CSV */
function exportCSV() {
  const cols = getColumns();
  const lines = [];

  if (chkHeaders.checked) {
    lines.push(cols.map((c) => csvEscape(c.label)).join(','));
  }

  for (const entry of entries) {
    const row = cols.map((c) => csvEscape(entry[c.key]));
    lines.push(row.join(','));
  }

  downloadFile(lines.join('\n'), 'data-export.csv', 'text/csv');
  showToast(`Exported ${entries.length} entries as CSV`, 'success');
}

/** Export data as JSON */
function exportJSON() {
  const cols = getColumns();
  const data = entries.map((entry) => {
    const obj = {};
    for (const col of cols) {
      obj[col.key] = entry[col.key];
    }
    return obj;
  });

  const indent = chkPretty.checked ? 2 : 0;
  const json = JSON.stringify(data, null, indent);

  downloadFile(json, 'data-export.json', 'application/json');
  showToast(`Exported ${entries.length} entries as JSON`, 'success');
}

/** Export data as TSV */
function exportTSV() {
  const cols = getColumns();
  const lines = [];

  if (chkHeaders.checked) {
    lines.push(cols.map((c) => c.label).join('\t'));
  }

  for (const entry of entries) {
    const row = cols.map((c) => String(entry[c.key]).replace(/\t/g, ' '));
    lines.push(row.join('\t'));
  }

  downloadFile(lines.join('\n'), 'data-export.tsv', 'text/tab-separated-values');
  showToast(`Exported ${entries.length} entries as TSV`, 'success');
}

/** Export data as XML */
function exportXML() {
  const cols = getColumns();
  const indent = chkPretty.checked;
  const nl = indent ? '\n' : '';
  const t1 = indent ? '  ' : '';
  const t2 = indent ? '    ' : '';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>' + nl;
  xml += '<data>' + nl;

  for (const entry of entries) {
    xml += t1 + '<entry>' + nl;
    for (const col of cols) {
      xml += t2 + `<${col.key}>${xmlEscape(entry[col.key])}</${col.key}>` + nl;
    }
    xml += t1 + '</entry>' + nl;
  }

  xml += '</data>';

  downloadFile(xml, 'data-export.xml', 'application/xml');
  showToast(`Exported ${entries.length} entries as XML`, 'success');
}

// ── File Download Helper ─────────────────────────────────────────────────────

/**
 * Trigger a browser file download.
 * Creates a temporary Blob URL and clicks a hidden anchor element.
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Event Listeners ──────────────────────────────────────────────────────────

// Form submission — add new entry
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = fieldName.value;
  const email = fieldEmail.value;
  const role = fieldRole.value;

  if (!name || !email) return;

  addEntry(name, email, role);
  form.reset();
  fieldName.focus();
});

// Delete entry — event delegation on table body
tableBody.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  removeEntry(btn.dataset.id);
});

// Clear all entries
btnClear.addEventListener('click', () => {
  if (confirm('Remove all entries? This cannot be undone.')) {
    clearAll();
  }
});

// Export buttons — dispatch based on data-format attribute
document.querySelectorAll('.btn-export').forEach((btn) => {
  btn.addEventListener('click', () => {
    const format = btn.dataset.format;
    const exporters = {
      csv: exportCSV,
      json: exportJSON,
      tsv: exportTSV,
      xml: exportXML,
    };
    if (exporters[format]) {
      exporters[format]();
    }
  });
});

// ── Initialize ───────────────────────────────────────────────────────────────

updateUI();