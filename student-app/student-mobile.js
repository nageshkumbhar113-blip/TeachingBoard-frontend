/* ════════════════════════════════════════════════
   student-mobile.js  —  Mobile UX Enhancements
   Completely isolated. Safe to remove.
════════════════════════════════════════════════ */
(function () {
  'use strict';

  const isMobile = () => window.innerWidth <= 600 || navigator.maxTouchPoints > 0;

  // ── Auto-exit Board Mode on mobile ───────────────────────
  // Board mode is for projector/desktop only.
  // If it was saved from a previous desktop session,
  // mobile users get stuck with huge UI and no exit button.
  function _fixBoardMode() {
    if (!isMobile()) return;
    if (!document.body.classList.contains('mode-board')) return;

    document.body.classList.remove('mode-board');

    // Clear saved ui_mode so it doesn't restore board on next launch
    try {
      if (window.DB?.setSetting) {
        DB.setSetting('ui_mode', 'normal').catch(() => {});
      }
    } catch {}

    // Also update the button state if visible
    const btn = document.getElementById('btn-ui-mode');
    if (btn) {
      btn.textContent = '🖥️ Board';
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  // ── Haptic feedback ───────────────────────────────────────
  function _setupHaptic() {
    if (!navigator.vibrate) return;
    document.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.matches('.option-btn'))   navigator.vibrate(8);
      else if (btn.matches('.nav-arrow, .action-btn')) navigator.vibrate(10);
      else if (btn.matches('.nav-btn')) navigator.vibrate(5);
    }, { passive: true });
  }

  // ── Init ─────────────────────────────────────────────────
  function _init() {
    _setupHaptic();

    // Fix board mode immediately if DOM is ready
    _fixBoardMode();

    // Also fix after app fully loads (in case setUiMode runs after us)
    window.addEventListener('load', _fixBoardMode);

    // Watch for board mode being set after init
    if ('MutationObserver' in window && isMobile()) {
      const mo = new MutationObserver(() => _fixBoardMode());
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
