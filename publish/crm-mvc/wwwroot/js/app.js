/**
 * VITALOOP CRM — app.js
 * Handles: mobile nav, org switcher, modals, toasts, form UX
 */
(() => {
  'use strict';

  // ─── Mobile sidebar ──────────────────────────────────────────────
  const sidebar  = document.getElementById('vo-sidebar');
  const overlay  = document.getElementById('vo-sidebar-overlay');
  const menuBtn  = document.getElementById('vo-mobile-menu-btn');

  function openSidebar() {
    sidebar?.classList.add('is-open');
    overlay?.classList.add('is-visible');
    menuBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar?.classList.remove('is-open');
    overlay?.classList.remove('is-visible');
    menuBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  menuBtn?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.contains('is-open');
    if (isOpen) { closeSidebar(); } else { openSidebar(); }
  });

  overlay?.addEventListener('click', closeSidebar);

  // Close sidebar on desktop resize (avoid stuck state)
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) { closeSidebar(); }
  });

  // ─── Sidebar desktop close button ────────────────────────────────
  const sidebarToggle = sidebar?.querySelector('.vo-sidebar-toggle');
  sidebarToggle?.addEventListener('click', closeSidebar);

  // ─── Org switcher dropdown ────────────────────────────────────────
  const orgSwitcher    = document.getElementById('vo-org-switcher');
  const orgSwitcherBtn = document.getElementById('vo-org-switcher-btn');
  const orgSwitcherList= document.getElementById('vo-org-switcher-list');

  function closeOrgDropdown() {
    orgSwitcherList?.classList.remove('is-open');
    orgSwitcherBtn?.setAttribute('aria-expanded', 'false');
  }

  orgSwitcherBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = orgSwitcherList?.classList.contains('is-open');
    if (isOpen) {
      closeOrgDropdown();
    } else {
      orgSwitcherList?.classList.add('is-open');
      orgSwitcherBtn.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('click', (e) => {
    if (orgSwitcher && !orgSwitcher.contains(/** @type {Node} */ (e.target))) {
      closeOrgDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeOrgDropdown();
      dismissModal(document.querySelector('.vo-modal:not([hidden])'));
    }
  });

  // ─── Modals ───────────────────────────────────────────────────────
  function openModal(modal) {
    if (!modal) return;
    modal.removeAttribute('hidden');
    modal.querySelector('[autofocus], input, button')?.focus();
  }

  function dismissModal(modal) {
    if (!modal) return;
    modal.setAttribute('hidden', 'hidden');
  }

  document.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement} */ (e.target);

    // open
    const openId = t.getAttribute('data-open-modal');
    if (openId) {
      e.preventDefault();
      openModal(document.getElementById(openId));
      return;
    }

    // close
    const closeId = t.getAttribute('data-close-modal') ??
                    t.closest('[data-close-modal]')?.getAttribute('data-close-modal');
    if (closeId) {
      dismissModal(document.getElementById(closeId));
      return;
    }

    // click backdrop
    if (t.classList.contains('vo-modal')) {
      dismissModal(t);
    }
  });

  // ─── Toast system ─────────────────────────────────────────────────
  function dismissToast(toast) {
    if (!toast || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // fallback in case animation doesn't fire
    setTimeout(() => toast.remove(), 400);
  }

  // Wire up close buttons on server-rendered toasts
  document.querySelectorAll('.vo-toast-close').forEach((btn) => {
    btn.addEventListener('click', () => dismissToast(btn.closest('.vo-toast')));
  });

  // Auto-dismiss toasts with data-auto-dismiss attribute
  document.querySelectorAll('.vo-toast[data-auto-dismiss]').forEach((toast) => {
    const delay = parseInt(toast.getAttribute('data-auto-dismiss') ?? '4000', 10);
    setTimeout(() => dismissToast(/** @type {HTMLElement} */ (toast)), delay);
  });

  /**
   * Programmatically show a toast.
   * @param {string}  message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number}  [duration]
   */
  function showToast(message, type = 'info', duration = 4000) {
    const region = document.getElementById('vo-toast-region');
    if (!region) return;

    const icons = { success: '✓', error: '⚠', info: 'ℹ', warning: '⚠' };

    const toast = document.createElement('div');
    toast.className = `vo-toast is-${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="vo-toast-icon" aria-hidden="true">${icons[type]}</span>
      <span class="vo-toast-msg">${message}</span>
      <button type="button" class="vo-toast-close" aria-label="Dismiss">×</button>
    `;

    toast.querySelector('.vo-toast-close')?.addEventListener('click', () => dismissToast(toast));
    region.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => dismissToast(toast), duration);
    }
    return toast;
  }

  // Expose for inline use
  window.voToast = showToast;

  // ─── Form submit loading state ────────────────────────────────────
  document.querySelectorAll('form[method="post"]').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"], button:not([type])');
      if (btn && !btn.classList.contains('vo-btn-danger')) {
        btn.classList.add('is-loading');
        btn.setAttribute('disabled', 'disabled');
      }
    });
  });

  // ─── Confirm on danger buttons ───────────────────────────────────
  document.querySelectorAll('.vo-btn-danger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = btn.textContent?.trim() ?? 'this action';
      if (!confirm(`Are you sure you want to ${action.toLowerCase()}? This cannot be undone.`)) {
        e.preventDefault();
      }
    });
  });

})();
