/* ════════════════════════════════════════
   usage.js — how much the app is used (for Admin > 📊 Usage)
   Global: USAGE

   Counted on the phone (minutes while the app is on screen, tests, notes,
   exercise, words, महा-Test, papers, notifications) and KEPT ON THE PHONE
   (up to ~13 months). It is uploaded only when the admin asks ("collect"):
   the app checks for a request at most twice a day (a tiny cached call) and,
   if one is open, uploads its days once — so the server is touched only when
   the admin wants the numbers. Free visitors (guest) are not counted. Never throws.
════════════════════════════════════════ */

const USAGE = (() => {
  const KEY = 'tb_usage_days';
  const CHECKED = 'tb_usage_checked_at';
  const ANSWERED = 'tb_usage_answered';      // requested_at of the last request we answered
  const KEEP_DAYS = 400;
  const CHECK_EVERY_MS = 12 * 3600 * 1000;
  const CHUNK = 120;
  const TICK_MS = 30 * 1000;
  let _timer = null;
  let _busy = false;

  const _today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const _guest = () => !!window.GUEST?.isActive?.();
  const _get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const _set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

  function _load() {
    try { return JSON.parse(_get(KEY) || '{}') || {}; } catch { return {}; }
  }
  function _save(days) {
    const keep = Object.keys(days).sort().slice(-KEEP_DAYS);
    const out = {};
    keep.forEach(k => { out[k] = days[k]; });
    _set(KEY, JSON.stringify(out));
  }

  function bump(field, n = 1) {
    if (_guest()) return;
    const days = _load();
    const d = (days[_today()] = days[_today()] || {});
    d[field] = (d[field] || 0) + n;
    _save(days);
  }

  function _tick() {
    if (document.visibilityState === 'visible') bump('sec', TICK_MS / 1000);
  }

  // Upload only if the admin asked and this phone has not answered that request yet.
  async function check(force = false) {
    if (_busy) return;
    _busy = true;
    try {
      if (!navigator.onLine || _guest() || !window.API?.usageRequest) return;
      if (!force && Date.now() - (Number(_get(CHECKED)) || 0) < CHECK_EVERY_MS) return;
      const req = await API.usageRequest();
      if (req === null) return;                       // not logged in / offline
      _set(CHECKED, String(Date.now()));
      if (!req.requested_at || _get(ANSWERED) === String(req.requested_at)) return;
      const days = Object.entries(_load()).map(([date, d]) => {
        const { sec = 0, ...rest } = d;
        return { date, minutes: Math.round(sec / 60), ...rest };
      });
      for (let i = 0; i < days.length; i += CHUNK) {
        if (!(await API.sendUsage(days.slice(i, i + CHUNK)))) return;   // try again next time
      }
      _set(ANSWERED, String(req.requested_at));
    } catch { /* next time */ } finally {
      _busy = false;
    }
  }

  function start() {
    if (_timer) return;
    bump('opens');
    _timer = setInterval(_tick, TICK_MS);
    setTimeout(() => check(), 20000);
    setInterval(() => check(), CHECK_EVERY_MS);
  }

  return { start, bump, check };
})();
window.USAGE = USAGE;
document.addEventListener('DOMContentLoaded', () => USAGE.start());
