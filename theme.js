/**
 * Theme Switcher — vanilla JS, no dependencies.
 *
 * Supports three modes:
 *   "light"  — force light theme
 *   "dark"   — force dark theme
 *   "system" — follow OS prefers-color-scheme
 *
 * Persists the user's choice in localStorage under "theme".
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'theme';
  const THEMES = ['light', 'dark', 'system'];

  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const select = document.getElementById('theme-select');

  // OS-level dark mode media query
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  /**
   * Resolve the effective theme ("light" or "dark") for a given mode.
   */
  function resolveTheme(mode) {
    if (mode === 'system') {
      return prefersDark.matches ? 'dark' : 'light';
    }
    return mode;
  }

  /**
   * Apply a theme mode. Updates the DOM attribute, the select control,
   * and persists the choice.
   */
  function applyTheme(mode) {
    if (!THEMES.includes(mode)) {
      mode = 'light';
    }

    const effective = resolveTheme(mode);
    root.setAttribute('data-theme', effective);

    // Keep dropdown in sync
    select.value = mode;

    // Persist
    localStorage.setItem(STORAGE_KEY, mode);
  }

  /**
   * Return the stored mode, falling back to "system".
   */
  function getSavedMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  }

  /**
   * Toggle cycles: light → dark → system → light …
   */
  function cycleTheme() {
    const current = getSavedMode();
    const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
    applyTheme(THEMES[nextIndex]);
  }

  // --- Event listeners ---

  toggle.addEventListener('click', cycleTheme);

  select.addEventListener('change', function () {
    applyTheme(this.value);
  });

  // Re-evaluate when OS color scheme changes (matters in "system" mode)
  prefersDark.addEventListener('change', function () {
    if (getSavedMode() === 'system') {
      applyTheme('system');
    }
  });

  // --- Initialise on load ---
  applyTheme(getSavedMode());
})();