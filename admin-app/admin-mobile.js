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

  // ── Header collapse on scroll ─────────────────────────────
  function _setupHeaderCollapse() {
    const header = document.querySelector('.admin-shell-header');
    if (!header || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        document.body.classList.toggle('header-hidden', !entry.isIntersecting);
      },
      { threshold: 0 }
    );
    io.observe(header);
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

  // ── Init: wait for admin unlock, then setup ───────────────
  function _init() {
    _setupHeaderCollapse();
    _setupHaptic();

    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

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
