/**
 * Keyboard Shortcuts Editor
 * Vanilla JS implementation — no dependencies.
 */

// ── Shortcut definitions ──
const SHORTCUTS = [
  { group: 'Formatting', label: 'Bold',       key: 'b', ctrl: true, action: 'bold' },
  { group: 'Formatting', label: 'Italic',     key: 'i', ctrl: true, action: 'italic' },
  { group: 'Formatting', label: 'Underline',  key: 'u', ctrl: true, action: 'underline' },
  { group: 'Editing',    label: 'Save',       key: 's', ctrl: true, action: 'save' },
  { group: 'Editing',    label: 'Undo',       key: 'z', ctrl: true, action: 'undo' },
  { group: 'Editing',    label: 'Redo',       key: 'z', ctrl: true, shift: true, action: 'redo' },
  { group: 'Editing',    label: 'Select All', key: 'a', ctrl: true, action: 'selectAll' },
  { group: 'Navigation', label: 'Find',       key: 'f', ctrl: true, action: 'find' },
  { group: 'Navigation', label: 'Close Find', key: 'Escape', action: 'closeFindBar' },
  { group: 'General',    label: 'Show Shortcuts', key: '?', action: 'toggleHelp' },
];

// ── DOM refs ──
const editor        = document.getElementById('editor');
const charCount     = document.getElementById('char-count');
const statusMessage = document.getElementById('status-message');
const panel         = document.getElementById('shortcuts-panel');
const panelClose    = document.getElementById('panel-close');
const helpToggle    = document.getElementById('help-toggle');
const shortcutsList = document.getElementById('shortcuts-list');
const findBar       = document.getElementById('find-bar');
const findInput     = document.getElementById('find-input');
const findClose     = document.getElementById('find-close');
const toastContainer = document.getElementById('toast-container');

// ── Undo/Redo history ──
let history = [''];
let historyIndex = 0;
const MAX_HISTORY = 200;

// ── Build shortcuts panel ──
function renderShortcutsList() {
  const groups = {};
  for (const s of SHORTCUTS) {
    (groups[s.group] ??= []).push(s);
  }

  let html = '';
  for (const [group, items] of Object.entries(groups)) {
    html += `<div class="shortcut-group-title">${group}</div>`;
    for (const item of items) {
      html += `
        <div class="shortcut-item">
          <span class="shortcut-label">${item.label}</span>
          <span class="shortcut-keys">${formatKeys(item)}</span>
        </div>`;
    }
  }
  shortcutsList.innerHTML = html;
}

/** Format a shortcut definition into <kbd> elements */
function formatKeys(shortcut) {
  const parts = [];
  const modKey = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
  if (shortcut.ctrl) parts.push(modKey);
  if (shortcut.shift) parts.push('Shift');
  let display = shortcut.key;
  if (display === 'Escape') display = 'Esc';
  if (display === '?') display = '?';
  if (display.length === 1) display = display.toUpperCase();
  parts.push(display);
  return parts.map(k => `<kbd>${k}</kbd>`).join('');
}

// ── Toast notifications ──
function toast(message, duration = 2000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Status bar ──
function setStatus(msg) {
  statusMessage.textContent = msg;
}

function updateCharCount() {
  charCount.textContent = `${editor.value.length} chars`;
}

// ── History helpers ──
function pushHistory() {
  const val = editor.value;
  if (val === history[historyIndex]) return;
  // Discard any forward history
  history = history.slice(0, historyIndex + 1);
  history.push(val);
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    editor.value = history[historyIndex];
    updateCharCount();
    setStatus('Undo');
    toast('Undo');
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    editor.value = history[historyIndex];
    updateCharCount();
    setStatus('Redo');
    toast('Redo');
  }
}

// ── Wrap selected text with a marker (bold/italic/underline) ──
function wrapSelection(before, after) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const text = editor.value;
  const selected = text.slice(start, end);
  const replacement = before + selected + after;
  editor.value = text.slice(0, start) + replacement + text.slice(end);
  // Restore selection around the wrapped content
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selected.length;
  editor.focus();
  pushHistory();
  updateCharCount();
}

// ── Actions ──
const actions = {
  bold()       { wrapSelection('**', '**'); setStatus('Bold applied');       toast('Bold'); },
  italic()     { wrapSelection('_', '_');   setStatus('Italic applied');     toast('Italic'); },
  underline()  { wrapSelection('<u>', '</u>'); setStatus('Underline applied'); toast('Underline'); },
  save()       { setStatus('Saved'); toast('Document saved'); },
  undo()       { undo(); },
  redo()       { redo(); },
  selectAll()  { editor.select(); setStatus('All selected'); },
  find()       { findBar.classList.remove('hidden'); findInput.focus(); setStatus('Find'); },
  closeFindBar() {
    if (!findBar.classList.contains('hidden')) {
      findBar.classList.add('hidden');
      editor.focus();
      setStatus('Ready');
    }
  },
  toggleHelp() {
    panel.classList.toggle('hidden');
    setStatus(panel.classList.contains('hidden') ? 'Ready' : 'Shortcuts panel open');
  },
};

// ── Keyboard handler ──
function matchShortcut(e) {
  const key = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;

  for (const s of SHORTCUTS) {
    const sKey = s.key.toLowerCase();
    const needsCtrl = !!s.ctrl;
    const needsShift = !!s.shift;

    if (sKey === key && needsCtrl === ctrl && needsShift === shift) {
      return s;
    }
  }
  return null;
}

document.addEventListener('keydown', (e) => {
  const matched = matchShortcut(e);
  if (matched) {
    e.preventDefault();
    actions[matched.action]();
  }
});

// ── Editor input tracking ──
let debounceTimer;
editor.addEventListener('input', () => {
  updateCharCount();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(pushHistory, 400);
});

// ── Toolbar button clicks ──
document.getElementById('btn-bold').addEventListener('click', actions.bold);
document.getElementById('btn-italic').addEventListener('click', actions.italic);
document.getElementById('btn-underline').addEventListener('click', actions.underline);
document.getElementById('btn-save').addEventListener('click', actions.save);
document.getElementById('btn-undo').addEventListener('click', actions.undo);
document.getElementById('btn-redo').addEventListener('click', actions.redo);
document.getElementById('btn-find').addEventListener('click', actions.find);

// ── Panel controls ──
helpToggle.addEventListener('click', actions.toggleHelp);
panelClose.addEventListener('click', () => { panel.classList.add('hidden'); setStatus('Ready'); });
findClose.addEventListener('click', actions.closeFindBar);

// ── Simple find highlight ──
findInput.addEventListener('input', () => {
  const term = findInput.value;
  if (!term) return;
  const idx = editor.value.toLowerCase().indexOf(term.toLowerCase());
  if (idx !== -1) {
    editor.focus();
    editor.selectionStart = idx;
    editor.selectionEnd = idx + term.length;
    setStatus(`Found at position ${idx}`);
  } else {
    setStatus('No match found');
  }
});

// ── Init ──
renderShortcutsList();
updateCharCount();
editor.focus();