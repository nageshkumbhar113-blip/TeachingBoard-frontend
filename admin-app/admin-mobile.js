/* ════════════════════════════════════════════════
   admin-mobile.js  —  Mobile UX Enhancements
   Completely isolated from admin.js.
   No changes to existing logic. Safe to remove.
════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── FAB: Floating Action Button ──────────────────────────
  function _setupFAB() {
    // Create FAB element
    const fab = document.createElement('button');
    fab.id = 'fab-add-student';
    fab.className = 'fab-btn hidden';
    fab.setAttribute('aria-label', 'Add student');
    fab.textContent = '➕';
    document.body.appendChild(fab);

    function _updateFAB() {
      const onStudents = document.querySelector('.atab[data-tab="students"]')
        ?.classList.contains('active');
      fab.classList.toggle('hidden', !onStudents);
    }

    // Click: reset form, scroll up, focus name field
    fab.addEventListener('click', () => {
      document.getElementById('btn-reset-student')?.click();
      const section = document.getElementById('atab-students');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        document.getElementById('student-name')?.focus();
      }, 380);
      navigator.vibrate?.(15);
    });

    // Show/hide on tab switch
    document.querySelector('.admin-tabs')?.addEventListener('click', () => {
      setTimeout(_updateFAB, 60);
    });

    _updateFAB();
  }

  // ── Hamburger sidebar toggle (mobile ≤768px) ──────────────
  function _setupSidebarToggle() {
    const menuBtn   = document.getElementById('admin-menu-btn');
    const sidebar   = document.getElementById('admin-sidebar');
    const backdrop  = document.getElementById('admin-sidebar-backdrop');
    if (!menuBtn || !sidebar) return;

    function _open() {
      sidebar.classList.add('sidebar-open');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.classList.add('sidebar-open');
      }
      menuBtn.setAttribute('aria-expanded', 'true');
    }

    function _close() {
      sidebar.classList.remove('sidebar-open');
      if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('sidebar-open');
      }
      menuBtn.setAttribute('aria-expanded', 'false');
    }

    menuBtn.addEventListener('click', () => {
      sidebar.classList.contains('sidebar-open') ? _close() : _open();
    });

    if (backdrop) backdrop.addEventListener('click', _close);

    // Close on tab select (mobile)
    document.querySelector('.admin-tabs')?.addEventListener('click', e => {
      if (e.target.closest('.atab') && window.innerWidth <= 768) {
        setTimeout(_close, 150);
      }
    });
  }

  // ── Header collapse on scroll (no-op — new design has fixed topbar) ─
  function _setupHeaderCollapse() {
    /* topbar is always fixed — nothing to collapse */
  }

  // ── Haptic feedback on key actions ───────────────────────
  function _setupHaptic() {
    if (!navigator.vibrate) return;

    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.matches('.admin-btn-danger')) {
        navigator.vibrate([15, 40, 15]);     // error pattern
      } else if (btn.matches('.admin-btn-primary')) {
        navigator.vibrate(10);               // soft confirm
      } else if (btn.matches('.atab')) {
        navigator.vibrate(6);                // subtle tab switch
      }
    }, { passive: true });
  }

  // ── PWA Install Button ────────────────────────────────────
  let _deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    const row = document.getElementById('pwa-install-row');
    if (row) row.style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    const row = document.getElementById('pwa-install-row');
    if (row) row.style.display = 'none';
    if (window.APP?.toast) APP.toast('App install झाला! 🎉', 'success');
  });

  function _setupInstallBtn() {
    document.getElementById('btn-install-pwa')?.addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') _deferredInstallPrompt = null;
    });
  }

  // ── Bottom Navigation Bar (mobile ≤768px) ────────────────
  function _setupBottomNav() {
    const bottomNav  = document.getElementById('admin-bottom-nav');
    const moreDrawer = document.getElementById('admin-more-drawer');
    const moreBackdrop = document.getElementById('admin-more-backdrop');
    if (!bottomNav) return;

    // Show bottom nav only on mobile
    function _checkMobile() {
      if (window.innerWidth <= 768) {
        bottomNav.classList.remove('hidden');
      } else {
        bottomNav.classList.add('hidden');
        _closeMore();
      }
    }
    _checkMobile();
    window.addEventListener('resize', _checkMobile);

    function _closeMore() {
      moreDrawer?.classList.add('hidden');
      moreBackdrop?.classList.add('hidden');
    }

    function _openMore() {
      moreDrawer?.classList.remove('hidden');
      moreBackdrop?.classList.remove('hidden');
    }

    // Sync active state between sidebar tabs and bottom nav
    function _syncActive(tab) {
      // Bottom nav tabs
      bottomNav.querySelectorAll('.abn-tab').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      // Sidebar tabs (keep in sync)
      document.querySelectorAll('.atab').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      // Panels
      document.querySelectorAll('.atab-content').forEach(panel => {
        const isActive = panel.id === `atab-${tab}`;
        panel.classList.toggle('active', isActive);
        panel.classList.toggle('hidden', !isActive);
      });
    }

    // Handle bottom nav tab clicks
    bottomNav.addEventListener('click', e => {
      const btn = e.target.closest('.abn-tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (tab === '__more__') {
        _openMore();
        return;
      }
      _syncActive(tab);
      navigator.vibrate?.(6);
    });

    // Handle more drawer items
    moreDrawer?.addEventListener('click', e => {
      const btn = e.target.closest('.abn-drawer-item');
      if (!btn) return;
      const tab = btn.dataset.tab;
      _syncActive(tab);
      // Mark "More" button as active in bottom nav
      bottomNav.querySelectorAll('.abn-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === '__more__');
        b.setAttribute('aria-selected', b.dataset.tab === '__more__' ? 'true' : 'false');
      });
      _closeMore();
      navigator.vibrate?.(6);
    });

    // Close more drawer on backdrop click
    moreBackdrop?.addEventListener('click', _closeMore);

    // Sync bottom nav when sidebar tab is clicked (desktop tabs still work)
    document.querySelector('.admin-tabs')?.addEventListener('click', e => {
      const btn = e.target.closest('.atab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      // Update bottom nav active state
      bottomNav.querySelectorAll('.abn-tab').forEach(b => {
        const mainTabs = ['questions', 'tests', 'students', 'import'];
        const isMain = mainTabs.includes(tab);
        const isActive = isMain
          ? b.dataset.tab === tab
          : b.dataset.tab === '__more__';
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    });
  }

  // ── Init: wait for admin unlock, then setup ───────────────
  function _init() {
    _setupHeaderCollapse();
    _setupSidebarToggle();
    _setupHaptic();
    _setupBottomNav();

    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    _setupInstallBtn();

    // Already unlocked (e.g. cached session)
    if (!adminContent.classList.contains('hidden')) {
      _setupFAB();
      return;
    }

    // Watch for unlock (PIN correct → hidden class removed)
    const mo = new MutationObserver(() => {
      if (!adminContent.classList.contains('hidden')) {
        mo.disconnect();
        _setupFAB();
      }
    });
    mo.observe(adminContent, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
