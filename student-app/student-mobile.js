/* ════════════════════════════════════════════════
   student-mobile.js  —  Mobile UX Enhancements
   Completely isolated. Safe to remove.
════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Haptic feedback ───────────────────────────────────────
  function _setupHaptic() {
    if (!navigator.vibrate) return;
    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.matches('.option-btn'))                      navigator.vibrate(8);
      else if (btn.matches('.nav-arrow, .action-btn'))     navigator.vibrate(10);
      else if (btn.matches('.nav-btn'))                    navigator.vibrate(5);
    }, { passive: true });
  }

  // ── Init ─────────────────────────────────────────────────
  function _init() {
    _setupHaptic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
