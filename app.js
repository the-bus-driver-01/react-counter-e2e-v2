/**
 * Interactive UI Components — Vanilla JS
 * No dependencies, no build step.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initAccordion();
  initModal();
  initDropdown();
  initFormValidation();
  initToasts();
  initToggles();
  initProgressBar();
  initTooltips();
});

/* ============================================
   Tabs
   ============================================ */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deactivate all
      buttons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => { p.classList.remove('active'); p.hidden = true; });

      // Activate clicked
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(btn.getAttribute('aria-controls'));
      panel.classList.add('active');
      panel.hidden = false;
    });

    // Arrow key navigation
    btn.addEventListener('keydown', e => {
      const btns = [...buttons];
      const idx = btns.indexOf(btn);
      let target;
      if (e.key === 'ArrowRight') target = btns[(idx + 1) % btns.length];
      else if (e.key === 'ArrowLeft') target = btns[(idx - 1 + btns.length) % btns.length];
      if (target) { e.preventDefault(); target.focus(); target.click(); }
    });
  });
}

/* ============================================
   Accordion
   ============================================ */
function initAccordion() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const expanded = header.getAttribute('aria-expanded') === 'true';
      const body = document.getElementById(header.getAttribute('aria-controls'));

      // Collapse all others in the same accordion
      const accordion = header.closest('.accordion');
      accordion.querySelectorAll('.accordion-header').forEach(h => {
        h.setAttribute('aria-expanded', 'false');
        document.getElementById(h.getAttribute('aria-controls')).hidden = true;
      });

      // Toggle current
      if (!expanded) {
        header.setAttribute('aria-expanded', 'true');
        body.hidden = false;
      }
    });
  });
}

/* ============================================
   Modal
   ============================================ */
function initModal() {
  const overlay = document.getElementById('modal-overlay');
  const openBtn = document.getElementById('open-modal-btn');
  const closeBtn = overlay.querySelector('.modal-close');
  const form = document.getElementById('modal-form');
  let previousFocus;

  function openModal() {
    previousFocus = document.activeElement;
    overlay.hidden = false;
    // Focus first input
    overlay.querySelector('input, textarea').focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (previousFocus) previousFocus.focus();
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  // Trap focus inside modal
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = overlay.querySelectorAll('input, textarea, button, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Form submit
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('modal-name').value.trim();
    if (!name) return;
    showToast('success', `Thanks, ${name}! Your message has been sent.`);
    form.reset();
    closeModal();
  });
}

/* ============================================
   Dropdown
   ============================================ */
function initDropdown() {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    const items = menu.querySelectorAll('li[role="menuitem"]');

    function open() {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      items[0]?.focus();
    }

    function close() {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', () => {
      menu.hidden ? open() : close();
    });

    // Keyboard navigation in menu
    menu.addEventListener('keydown', e => {
      const focusable = [...items];
      const idx = focusable.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusable[(idx + 1) % focusable.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusable[(idx - 1 + focusable.length) % focusable.length].focus(); }
      else if (e.key === 'Escape') { close(); toggle.focus(); }
    });

    // Select item
    items.forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        showToast('info', `Action: ${action}`);
        close();
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
      });
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target)) close();
    });
  });
}

/* ============================================
   Form Validation
   ============================================ */
function initFormValidation() {
  const form = document.getElementById('validated-form');
  const fields = {
    username: { el: form.querySelector('#v-username'), validate: validateUsername },
    email: { el: form.querySelector('#v-email'), validate: validateEmail },
    password: { el: form.querySelector('#v-password'), validate: validatePassword },
    confirm: { el: form.querySelector('#v-confirm'), validate: validateConfirm },
  };

  // Real-time validation on input
  Object.values(fields).forEach(({ el, validate }) => {
    el.addEventListener('input', () => validate());
  });

  // Password strength meter
  const strengthBar = form.querySelector('.password-strength-bar');
  fields.password.el.addEventListener('input', () => {
    const val = fields.password.el.value;
    const score = getPasswordStrength(val);
    const pct = score * 25;
    const colors = ['var(--color-danger)', 'var(--color-warning)', '#eab308', 'var(--color-success)'];
    strengthBar.style.width = pct + '%';
    strengthBar.style.background = score > 0 ? colors[score - 1] : 'transparent';
  });

  function validateUsername() {
    const val = fields.username.el.value.trim();
    if (!val) return setError(fields.username.el, 'Username is required');
    if (val.length < 3) return setError(fields.username.el, 'At least 3 characters');
    if (!/^[a-zA-Z0-9_]+$/.test(val)) return setError(fields.username.el, 'Letters, numbers, underscores only');
    return setValid(fields.username.el);
  }

  function validateEmail() {
    const val = fields.email.el.value.trim();
    if (!val) return setError(fields.email.el, 'Email is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return setError(fields.email.el, 'Enter a valid email');
    return setValid(fields.email.el);
  }

  function validatePassword() {
    const val = fields.password.el.value;
    if (!val) return setError(fields.password.el, 'Password is required');
    if (val.length < 8) return setError(fields.password.el, 'At least 8 characters');
    // Re-validate confirm if it has a value
    if (fields.confirm.el.value) validateConfirm();
    return setValid(fields.password.el);
  }

  function validateConfirm() {
    const val = fields.confirm.el.value;
    if (!val) return setError(fields.confirm.el, 'Please confirm your password');
    if (val !== fields.password.el.value) return setError(fields.confirm.el, 'Passwords do not match');
    return setValid(fields.confirm.el);
  }

  function setError(el, msg) {
    el.classList.remove('valid');
    el.classList.add('invalid');
    el.closest('.form-group').querySelector('.form-error').textContent = msg;
    return false;
  }

  function setValid(el) {
    el.classList.remove('invalid');
    el.classList.add('valid');
    el.closest('.form-group').querySelector('.form-error').textContent = '';
    return true;
  }

  function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const results = Object.values(fields).map(f => f.validate());
    if (results.every(Boolean)) {
      showToast('success', 'Account created successfully!');
      form.reset();
      form.querySelectorAll('input').forEach(i => { i.classList.remove('valid', 'invalid'); });
      strengthBar.style.width = '0';
      form.querySelectorAll('.form-error').forEach(e => e.textContent = '');
    } else {
      showToast('error', 'Please fix the errors above.');
    }
  });
}

/* ============================================
   Toast Notifications
   ============================================ */
const TOAST_ICONS = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0',
};

function initToasts() {
  document.querySelectorAll('[data-toast]').forEach(btn => {
    btn.addEventListener('click', () => {
      showToast(btn.dataset.toast, btn.dataset.msg);
    });
  });
}

function showToast(type, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || ''}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove());
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}

/* ============================================
   Toggle Switch
   ============================================ */
function initToggles() {
  const status = document.getElementById('toggle-status');
  document.querySelectorAll('.toggle-switch input').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const label = toggle.closest('.toggle-label').textContent.trim();
      const state = toggle.checked ? 'ON' : 'OFF';
      status.textContent = `${label}: ${state}`;

      // Dark mode toggle
      if (toggle.id === 'toggle-darkmode') {
        document.body.classList.toggle('dark-mode', toggle.checked);
      }
    });
  });
}

/* ============================================
   Progress Bar
   ============================================ */
function initProgressBar() {
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const bar = document.getElementById('progress-bar');
  const startBtn = document.getElementById('progress-start');
  const resetBtn = document.getElementById('progress-reset');
  let interval;

  startBtn.addEventListener('click', () => {
    let pct = 0;
    startBtn.disabled = true;
    clearInterval(interval);

    interval = setInterval(() => {
      // Simulate variable upload speed
      pct += Math.random() * 8 + 2;
      if (pct >= 100) {
        pct = 100;
        clearInterval(interval);
        startBtn.disabled = false;
        showToast('success', 'Upload complete!');
      }
      fill.style.width = pct + '%';
      text.textContent = Math.round(pct) + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
    }, 200);
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(interval);
    fill.style.width = '0';
    text.textContent = '0%';
    bar.setAttribute('aria-valuenow', '0');
    startBtn.disabled = false;
  });
}

/* ============================================
   Tooltips
   ============================================ */
function initTooltips() {
  document.querySelectorAll('.tooltip-trigger').forEach(trigger => {
    let tooltipEl;

    const show = () => {
      if (tooltipEl) return;
      tooltipEl = document.createElement('div');
      tooltipEl.className = `tooltip ${trigger.dataset.tooltipPos || 'top'}`;
      tooltipEl.textContent = trigger.dataset.tooltip;
      trigger.appendChild(tooltipEl);
    };

    const hide = () => {
      if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
    };

    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', hide);
    trigger.addEventListener('focusin', show);
    trigger.addEventListener('focusout', hide);
  });
}