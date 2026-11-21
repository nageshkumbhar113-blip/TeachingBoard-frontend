/* ═══════════════════════════════════════════════════════════════
   core/qbank.js — the question bank, one chapter at a time (owner 2026-11-22)

   Before: the app downloaded the newest 1000 bank questions of all the student's
   classes, again every hour; a class can have 20,000+, so most never reached the phone.
   Now:
   • the phone keeps the bank's index (every chapter the student may open, its question
     count and version) — backend GET /api/student/qbank/index;
   • the chapter a child opens is downloaded at once (ensureChapter);
   • the other chapters come quietly in the background, one at a time, only while the
     internet is on, the app is in front, data saver / 2G is off and no test or paper is
     being written — the last-opened subject's chapters first;
   • afterwards only a chapter whose version changed is downloaded again (the index
     fingerprint rides on /api/student/sync-state as `qbank`);
   • a chapter that left the index (deleted, or no longer open to this student) is removed.
   An older server (no index, 404) or a guest keeps the old whole-bank sync (usable() false).
═══════════════════════════════════════════════════════════════ */
const QBANK = (() => {
  'use strict';
  const IDX_KEY = 'qbank_index', ST_KEY = 'qbank_state';
  const SEP = '\u0001';
  const K = (b, s, c) => `${b}${SEP}${s || ''}${SEP}${c}`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let _code = null;          // whose index / state is loaded
  let _idx = null;           // { code, fp, at, chapters: [{ b, s, c, n, v }] }
  let _map = new Map();      // K → index entry
  let _st = null;            // { code, ch: { K: version on the phone } }
  let _usable = null;        // false: this server / account has no chapter-wise bank
  const _inflight = new Map();

  async function _me() {
    const p = await API.getStudentProfile?.().catch(() => null);
    return p?.student_code && !p.guest ? String(p.student_code).toUpperCase() : '';
  }

  async function _load() {
    const code = await _me();
    if (code === _code && _st) return code;
    _code = code; _idx = null; _map = new Map(); _st = { code, ch: {} }; _usable = null;
    if (!code) return code;
    const [i, s] = await Promise.all([DB.getSetting(IDX_KEY, null).catch(() => null), DB.getSetting(ST_KEY, null).catch(() => null)]);
    if (i && i.code === code && Array.isArray(i.chapters)) { _idx = i; _map = new Map(i.chapters.map(x => [K(x.b, x.s, x.c), x])); }
    if (s && s.code === code && s.ch) _st = s;
    return code;
  }

  let _saveT = null;
  function _saveStateSoon() { clearTimeout(_saveT); _saveT = setTimeout(() => DB.setSetting(ST_KEY, _st).catch(() => {}), 400); }

  // false only once the server said it has no chapter-wise bank (or a guest)
  function usable() { return _usable; }
  async function fp() { await _load(); return _idx?.fp || null; }

  /**
   * Fetch the index (when `serverFp` differs from the one kept, or always without it),
   * remove chapters that left it, and let the background downloads continue.
   * Resolves true (index ready), false (not available here → use the old sync).
   */
  async function refresh(serverFp) {
    const code = await _load();
    if (!code) { _usable = false; return false; }
    if (serverFp && _idx && _idx.fp === serverFp) { _usable = true; kick(); return true; }
    let res;
    try { res = await API.fetchQBankIndex(); }
    catch (err) {
      if ([401, 403, 404].includes(err?.status)) { _usable = false; return false; }
      if (_idx) { _usable = true; return true; }   // offline / slow: keep the index we have
      throw err;
    }
    if (!res || res.success !== true || !Array.isArray(res.chapters)) { _usable = false; return false; }
    if (code !== _code) return false;   // the account changed meanwhile
    _usable = true;
    _idx = { code, fp: res.fp, at: Date.now(), chapters: res.chapters };
    _map = new Map(res.chapters.map(x => [K(x.b, x.s, x.c), x]));
    await DB.setSetting(IDX_KEY, _idx).catch(() => {});
    for (const k of Object.keys(_st.ch)) {
      if (_map.has(k)) continue;
      const [b, s, c] = k.split(SEP);
      await DB.deleteChapterQuestions(b, s, c).catch(() => {});
      delete _st.ch[k];
    }
    _saveStateSoon();
    window.dispatchEvent(new Event('qbank-index'));
    _ensureHierarchy().catch(() => {});
    kick();
    return true;
  }

  // a chapter whose questions are not downloaded yet must still be listed under its class and subject
  async function _ensureHierarchy() {
    _st.h = _st.h || {};
    const todo = (_idx?.chapters || []).filter(x => !_st.h[K(x.b, x.s, x.c)]);
    if (!todo.length) return;
    const added = DB.ensureHierarchyMany
      ? await DB.ensureHierarchyMany(todo).catch(() => 0)
      : 0;
    todo.forEach(x => { _st.h[K(x.b, x.s, x.c)] = 1; });
    _saveStateSoon();
    if (added) window.dispatchEvent(new Event('qbank-index'));
  }

  // ── what the screens ask ──
  function _entry(b, s, c) { return _map.get(K(b, s, c)) || null; }
  function isReady(b, s, c) { const e = _entry(b, s, c); return !!e && _st?.ch[K(b, s, c)] === e.v; }
  // chapter → question count of one subject, from the index (null: no index yet)
  function counts(b, s) {
    if (!_idx) return null;
    const m = new Map();
    for (const x of _idx.chapters) if (x.b === b && (x.s || '') === (s || '')) m.set(x.c, x.n);
    return m;
  }
  function subjectsOf(b) {
    if (!_idx) return [];
    return [...new Set(_idx.chapters.filter(x => x.b === b && x.s).map(x => x.s))].sort((x, y) => x.localeCompare(y));
  }
  function count(b, s, c) { return _entry(b, s, c)?.n ?? null; }
  function total(batches) {
    if (!_idx) return null;
    const set = new Set(batches || []);
    return _idx.chapters.reduce((sum, x) => sum + (set.has(x.b) ? x.n : 0), 0);
  }
  function ready() { return !!_idx; }

  /**
   * Make one chapter's questions ready on the phone. Resolves 'ready', 'none' (no bank
   * questions in it), 'offline' (not on the phone and no internet) or 'old' (an older copy
   * is on the phone, the new one could not come). Never throws.
   */
  async function ensureChapter(b, s, c, { timeoutMs = 15000 } = {}) {
    try {
      await _load();
      if (_usable === false || !_idx) return 'legacy';
      const k = K(b, s, c), e = _map.get(k);
      if (!e) return 'none';
      if (_st.ch[k] === e.v) return 'ready';
      if (!navigator.onLine) return _st.ch[k] ? 'old' : 'offline';
      if (!_inflight.has(k)) {
        const code = _code;
        _inflight.set(k, (async () => {
          const r = await API.fetchQBankChapter(b, s, c, { timeoutMs });
          if (code !== _code || !r) return 'old';
          await DB.replaceChapterQuestions(b, s, c, r.rows);
          _st.ch[k] = r.v || e.v;
          _saveStateSoon();
          window.dispatchEvent(new CustomEvent('qbank-chapter', { detail: { b, s, c } }));
          return 'ready';
        })().finally(() => _inflight.delete(k)));
      }
      return await _inflight.get(k);
    } catch (err) {
      console.warn('qbank chapter', c, err?.message);
      return _st?.ch[K(b, s, c)] ? 'old' : 'offline';
    }
  }

  // ── quietly, one chapter at a time ──
  let _bgT = null, _bgRunning = false;
  function kick(delay = 8000 + Math.random() * 20000) { clearTimeout(_bgT); _bgT = setTimeout(_bg, delay); }

  function _canWork() {
    const c = navigator.connection || {};
    if (!navigator.onLine || document.hidden || c.saveData || /(^|-)2g$/.test(c.effectiveType || '')) return false;
    const scr = (typeof APP !== 'undefined' && APP.currentScreen?.()) || '';
    if (['quiz', 'test-player', 'deep-study'].includes(scr)) return false;
    if (document.querySelector('.wk-play, .gx-layer')) return false;   // a paper / the free part's test
    return true;
  }

  async function _nextTodo() {
    const pref = new Set();
    for (const b of new Set(_idx.chapters.map(x => x.b))) {
      const s = await DB.getSetting(`course_subject|${b}`, '').catch(() => '');
      if (s) pref.add(K(b, s, ''));
    }
    // 1) a chapter already on the phone that changed (keep the child's offline copy right),
    // 2) the last-picked subject's chapters, 3) the rest
    const stale = [], first = [], rest = [];
    for (const x of _idx.chapters) {
      const have = _st.ch[K(x.b, x.s, x.c)];
      if (have === x.v) continue;
      (have ? stale : pref.has(K(x.b, x.s, '')) ? first : rest).push(x);
    }
    return stale[0] || first[0] || rest[0] || null;
  }

  async function _bg() {
    if (_bgRunning) return;
    _bgRunning = true;
    try {
      await _load();
      if (_usable === false || !_idx) return;
      for (;;) {
        if (!_canWork()) { kick(30000); return; }
        const next = await _nextTodo();
        if (!next) return;   // everything is on the phone
        const r = await ensureChapter(next.b, next.s, next.c, { timeoutMs: 60000 });
        if (r !== 'ready' && r !== 'none') { kick(60000); return; }
        await sleep(1500);
      }
    } finally { _bgRunning = false; }
  }

  window.addEventListener('online', () => kick(4000));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(6000); });

  return { usable, fp, refresh, ensureChapter, isReady, counts, count, subjectsOf, total, ready, kick };
})();
window.QBANK = QBANK;
