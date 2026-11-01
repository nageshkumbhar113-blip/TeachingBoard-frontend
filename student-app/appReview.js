/* ════════════════════════════════════════
   appReview.js — Google Play review after a good result
   Global: APP_REVIEW

   Owner's choice (2026-11-02): only the Play review, asked when a result is
   good (normal test or महा-Test). Google's own sheet takes the stars and the
   comment and posts them to the Play listing (InAppReviewPlugin.java).
   Play rules kept: no stars of our own first (no "review gating"), no reward,
   never during a test, and at most once in 30 days from our side (Google has
   its own quota on top). App only — the website has no Play review.
════════════════════════════════════════ */

const APP_REVIEW = (() => {
  const GOOD_PERCENT = 70;
  const GAP_DAYS = 30;
  const KEY = 'play_review_asked_at';

  function _plugin() {
    if (!window.Capacitor?.isNativePlatform?.()) return null;
    return window.Capacitor?.Plugins?.InAppReview || null;
  }

  // percent: the result just shown. Waits a moment so the result is seen first.
  async function afterResult(percent, delayMs = 2500) {
    try {
      const plugin = _plugin();
      if (!plugin || !(Number(percent) >= GOOD_PERCENT)) return false;
      const last = Number(await DB.getSetting?.(KEY, 0).catch(() => 0)) || 0;
      if (Date.now() - last < GAP_DAYS * 864e5) return false;
      await new Promise(r => setTimeout(r, delayMs));
      // the person may have left the result already (e.g. started the next test)
      const inTest = [...document.querySelectorAll('#tp-quiz-view, .wk-play')].some(el => el.offsetParent !== null && !el.classList.contains('hidden'));
      if (inTest) return false;
      await DB.setSetting?.(KEY, Date.now()).catch(() => {});
      const res = await plugin.request();
      return !!res?.shown;
    } catch {
      return false;
    }
  }

  return { afterResult };
})();
window.APP_REVIEW = APP_REVIEW;
