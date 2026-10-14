/* ════════════════════════════════════════
   core/imageCache.js — pictures that work offline
   Global: IMAGE_CACHE

   Question / option / note / exercise / passage pictures, banners and class
   covers are Cloudinary links. Before this, "offline ready" stored only the
   text: a picture showed offline only if the WebView's small HTTP cache still
   happened to have it, so a diagram question could not be answered offline.

   - fillFromContent(): in the background (online, not in data-saver mode),
     collects the picture links in this student's stored content and saves
     a phone-sized copy of each in IndexedDB ('images' store, keyed by the
     ORIGINAL link — testPlayer/quiz already look pictures up that way).
   - Every <img> the app shows (and banner backgrounds) is watched: a saved
     copy is used when there is one; a picture seen online is saved too; a
     picture that can't load shows a short note instead of a broken icon.
   - At most MAX_BYTES; the least recently used pictures go first.
════════════════════════════════════════ */

const IMAGE_CACHE = (() => {
  const MAX_BYTES   = 150 * 1024 * 1024;
  const INDEX_KEY   = 'img_cache_index';          // { url: { s: bytes, t: lastUsedMs } }
  const PARALLEL    = 3;
  const URL_RE      = /https?:\/\/[^\s"'<>()\\]+?\.(?:png|jpe?g|gif|webp|svg|avif)(?:\?[^\s"'<>()\\]*)?(?=["'\s<>()\\]|$)|https?:\/\/res\.cloudinary\.com\/[^\s"'<>()\\/]+\/image\/upload\/[^\s"'<>()\\]+/gi;
  const OFFLINE_NOTE = '📷 ही image internet आल्यावर दिसेल';

  const _objectUrls = new Map();                   // url -> blob: URL (this session)
  let _index = null;
  let _indexDirty = false;
  let _indexTimer = null;
  let _filling = false;
  let _maxBytes = MAX_BYTES;

  const _isRemote = u => /^https?:\/\//i.test(String(u || ''));

  // Cloudinary: ask for a phone-sized, compressed copy (max 1000 px wide).
  // Links that already carry their own size/quality settings are left alone.
  function _downloadUrl(url) {
    const m = String(url).match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/i);
    if (!m) return url;
    const rest = m[2];
    if (/^(?:[a-z]{1,3}_[^/,]+,?)+\//i.test(rest) && !/^v\d+\//.test(rest)) return url;
    return `${m[1]}c_limit,w_1000,q_auto/${rest}`;
  }

  async function _loadIndex() {
    if (_index) return _index;
    _index = (await DB.getSetting(INDEX_KEY, {}).catch(() => ({}))) || {};
    return _index;
  }

  function _saveIndexSoon() {
    _indexDirty = true;
    if (_indexTimer) return;
    _indexTimer = setTimeout(async () => {
      _indexTimer = null;
      if (!_indexDirty) return;
      _indexDirty = false;
      await DB.setSetting(INDEX_KEY, _index).catch(() => {});
    }, 1500);
  }

  async function _touch(url) {
    const idx = await _loadIndex();
    if (idx[url]) { idx[url].t = Date.now(); _saveIndexSoon(); }
  }

  /** blob: URL of the saved copy, or null. */
  async function urlFor(url) {
    if (!_isRemote(url)) return null;
    if (_objectUrls.has(url)) { _touch(url); return _objectUrls.get(url); }
    const idx = await _loadIndex();
    if (!idx[url]) return null;
    const local = await DB.getImage(url).catch(() => null);
    if (!local) { delete idx[url]; _saveIndexSoon(); return null; }
    _objectUrls.set(url, local);
    _touch(url);
    return local;
  }

  async function _evictFor(bytes) {
    const idx = await _loadIndex();
    let total = Object.values(idx).reduce((s, e) => s + (e.s || 0), 0);
    if (total + bytes <= _maxBytes) return true;
    const oldest = Object.entries(idx).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
    for (const [url, e] of oldest) {
      if (total + bytes <= _maxBytes) break;
      await DB.deleteImage(url).catch(() => {});
      delete idx[url];
      const obj = _objectUrls.get(url);
      if (obj) { URL.revokeObjectURL(obj); _objectUrls.delete(url); }
      total -= e.s || 0;
    }
    _saveIndexSoon();
    return total + bytes <= _maxBytes;
  }

  /** Download one picture and keep it. True if it is saved (now or before). */
  async function save(url) {
    if (!_isRemote(url) || !navigator.onLine) return false;
    const idx = await _loadIndex();
    if (idx[url]) return true;
    try {
      const res = await fetch(_downloadUrl(url), { credentials: 'omit' });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob.size || !/^image\//.test(blob.type || 'image/')) return false;
      if (!(await _evictFor(blob.size))) return false;
      await DB.saveImageEncrypted(url, blob);   // encrypted at rest, like the notes
      idx[url] = { s: blob.size, t: Date.now() };
      _saveIndexSoon();
      return true;
    } catch {
      return false;   // offline, no CORS, blocked — try again another time
    }
  }

  function _linksIn(value, into) {
    const text = typeof value === 'string' ? value : JSON.stringify(value || '');
    for (const m of text.matchAll(URL_RE)) into.add(m[0].replace(/[.,;]+$/, ''));
  }

  // Every picture link in this student's stored content.
  async function _contentLinks() {
    const links = new Set();
    const [quizzes, questions, study, banners, covers] = await Promise.all([
      DB.getAllQuizzes().catch(() => []),
      DB.getAllQuestions().catch(() => []),
      DB.getAllOfflineStudyContent().catch(() => ({ concepts: [], exercises: [] })),
      DB.getSetting('home_banners_cache', []).catch(() => []),
      DB.getSetting('batch_covers_cache', {}).catch(() => ({})),
    ]);
    _linksIn(quizzes.filter(q => q.source === 'api' && !q.locked), links);
    _linksIn(questions, links);
    _linksIn(study.concepts, links);
    _linksIn(study.exercises, links);
    _linksIn(banners, links);
    _linksIn(covers, links);
    return [...links];
  }

  /**
   * Background download of every picture in the stored content that isn't on
   * the phone yet. Online only, skipped in data-saver mode; a few at a time;
   * stops as soon as the connection drops. Resolves to the number saved.
   */
  async function fillFromContent() {
    if (_filling || !navigator.onLine || navigator.connection?.saveData) return 0;
    _filling = true;
    let saved = 0;
    try {
      const idx = await _loadIndex();
      const todo = (await _contentLinks()).filter(u => !idx[u]);
      let next = 0;
      const worker = async () => {
        while (next < todo.length && navigator.onLine) {
          const url = todo[next++];
          if (await save(url)) saved++;
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
    } finally {
      _filling = false;
    }
    return saved;
  }

  // ── Showing pictures ────────────────────────────────────────────────────

  function _showOfflineNote(img) {
    if (img.dataset.icNote || img.nextElementSibling?.classList?.contains('img-offline-note')) return;
    img.dataset.icNote = '1';
    img.style.display = 'none';
    const note = document.createElement('span');
    note.className = 'img-offline-note';
    note.textContent = OFFLINE_NOTE;
    img.insertAdjacentElement('afterend', note);
    // Back online: try the picture again.
    window.addEventListener('online', () => {
      note.remove();
      img.style.display = '';
      delete img.dataset.icNote;
      const src = img.dataset.icOrig || img.getAttribute('src');
      img.removeAttribute('src');
      img.setAttribute('src', src);
    }, { once: true });
  }

  async function _handleImg(img) {
    const src = img.getAttribute('src');
    if (!_isRemote(src) || img.dataset.icSrc === src) return;
    img.dataset.icSrc = src;
    img.addEventListener('error', () => {
      if (img.getAttribute('src') === src) _showOfflineNote(img);
    }, { once: true });
    const local = await urlFor(src);
    if (local && img.getAttribute('src') === src) {
      img.dataset.icOrig = src;
      img.dataset.icSrc = local;
      img.src = local;
      return;
    }
    // Failed before we were listening (e.g. offline, answered from cache).
    if (!local && img.complete && img.naturalWidth === 0 && img.getAttribute('src') === src) {
      _showOfflineNote(img);
      return;
    }
    if (!local && navigator.onLine) {
      // Seen online: keep it for later (usually straight from the HTTP cache).
      img.addEventListener('load', () => { save(src).catch(() => {}); }, { once: true });
    }
  }

  async function _handleBg(el) {
    const m = (el.getAttribute('style') || '').match(/background-image:\s*url\(['"]?(https?:[^'")]+)['"]?\)/i);
    if (!m || el.dataset.icBg === m[1]) return;
    el.dataset.icBg = m[1];
    const local = await urlFor(m[1]);
    if (local) el.style.backgroundImage = `url('${local}')`;
    else if (navigator.onLine) save(m[1]).catch(() => {});
  }

  function _scan(node) {
    if (!(node instanceof Element)) return;
    if (node.tagName === 'IMG') _handleImg(node);
    else if (node.matches?.('[style*="background-image"]')) _handleBg(node);
    node.querySelectorAll?.('img').forEach(_handleImg);
    node.querySelectorAll?.('[style*="background-image"]').forEach(_handleBg);
  }

  function init() {
    if (typeof DB === 'undefined' || !document.body) return;
    _scan(document.body);
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'attributes') _scan(r.target);
        else r.addedNodes.forEach(_scan);
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'style'] });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { fillFromContent, save, urlFor, __test: { downloadUrl: _downloadUrl, contentLinks: _contentLinks, setMaxBytes: n => { _maxBytes = n; } } };
})();

window.IMAGE_CACHE = IMAGE_CACHE;
