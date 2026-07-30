/* ════════════════════════════════════════
   dictionary.js — Student Dictionary
   Browse words by page, search, start test
════════════════════════════════════════ */

const DICT = (() => {
  const WORDS_PER_PAGE = 20;

  let _batch       = '';
  let _subject     = '';
  let _page        = 1;
  let _totalPages  = 1;
  let _searchTimer = null;

  function $id(id) { return document.getElementById(id); }

  const _esc = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // ─── Public entry ─────────────────────────────────────────────

  async function openDictScreen(batch, subject) {
    _batch   = batch   || '';
    _subject = subject || '';
    _page    = 1;

    const inp = $id('dict-search-input');
    if (inp) inp.value = '';
    const clr = $id('dict-search-clear');
    if (clr) clr.style.display = 'none';

    await _loadPage(1, '');
  }

  // ─── Load page ────────────────────────────────────────────────

  async function _loadPage(page, q) {
    _page = page;

    const listEl  = $id('dict-word-list');
    const emptyEl = $id('dict-empty');
    const pagEl   = $id('dict-pagination');

    if (!_subject) {
      if (listEl)  listEl.innerHTML = '';
      if (pagEl)   pagEl.classList.add('hidden');
      _showEmpty('Subject निवडा.', '');
      return;
    }

    if (listEl)  listEl.innerHTML = '<div class="dict-loading">Loading...</div>';
    if (emptyEl) emptyEl.classList.add('hidden');
    if (pagEl)   pagEl.classList.add('hidden');

    try {
      const res = await _resolveWordsPage(_batch, _subject, page, q);
      const words = res.words || [];
      _totalPages = res.total_pages || 1;

      if (!words.length) {
        if (listEl) listEl.innerHTML = '';
        _showEmpty(q ? `"${_esc(q)}" word bank मध्ये नाही.` : 'No words found.', q);
        return;
      }

      if (emptyEl) emptyEl.classList.add('hidden');
      if (listEl) {
        listEl.innerHTML = '';
        words.forEach(w => listEl.appendChild(_makeCard(w)));
      }

      _renderPagination(res.page || page, res.total_pages || 1, res.test_num, q, res.total);

    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="dict-error">⚠️ ${_esc(err.message)}</div>`;
    }
  }

  // Cache-first, background-refresh, offline-clear-error — same pattern as
  // Notes/Exercise. Cached per (batch, subject, page, query) since the
  // server paginates/searches server-side. Encrypted at rest.
  async function _resolveWordsPage(batch, subject, page, q) {
    const cached = await DB.getWordsPageCache(batch, subject, page, q).catch(() => null);
    if (cached) {
      if (navigator.onLine) {
        API.fetchVocabDictionary(batch, subject, page, q)
          .then(fresh => DB.putWordsPageCache(batch, subject, page, q, fresh).catch(() => {}))
          .catch(() => {});
      }
      return cached;
    }
    if (navigator.onLine) {
      const fresh = await API.fetchVocabDictionary(batch, subject, page, q);
      await DB.putWordsPageCache(batch, subject, page, q, fresh).catch(() => {});
      return fresh;
    }
    throw new Error('Internet नाही — हे पान offline साठी अजून पाहिलेले नाही.');
  }

  // ─── Word card ────────────────────────────────────────────────

  function _makeCard(word) {
    const card = document.createElement('div');
    card.className = 'dict-word-card';

    const vis = document.createElement('div');
    vis.className = 'dict-word-visual';
    _renderVisual(vis, word);

    const info = document.createElement('div');
    info.className = 'dict-word-info';

    const wordEl = document.createElement('div');
    wordEl.className = 'dict-word-text';
    wordEl.textContent = word.word;

    const meanings = document.createElement('div');
    meanings.className = 'dict-word-meanings';

    if (word.meaning_mr) {
      const mr = document.createElement('div');
      mr.className = 'dict-meaning';
      mr.innerHTML = `<span class="dict-lang-tag">मर</span>${_esc(word.meaning_mr)}`;
      meanings.appendChild(mr);
    }
    if (word.meaning_en) {
      const en = document.createElement('div');
      en.className = 'dict-meaning';
      en.innerHTML = `<span class="dict-lang-tag dict-lang-en">EN</span>${_esc(word.meaning_en)}`;
      meanings.appendChild(en);
    }
    if (word.pronunciation) {
      const ph = document.createElement('div');
      ph.className = 'dict-phonics';
      ph.textContent = word.pronunciation;
      meanings.appendChild(ph);
    }

    info.appendChild(wordEl);
    info.appendChild(meanings);
    card.appendChild(vis);
    card.appendChild(info);
    return card;
  }

  function _renderVisual(el, word) {
    const vt = word.visual_type || 'word';

    if (vt === 'image' && word.image_url) {
      const img = document.createElement('img');
      img.src = word.image_url;
      img.className = 'dict-visual-img';
      img.alt = word.word;
      img.onerror = () => {
        el.innerHTML = '';
        if (word.emoji_svg) {
          const ei = document.createElement('img');
          ei.src = word.emoji_svg;
          ei.className = 'dict-visual-emoji';
          el.appendChild(ei);
        } else {
          el.innerHTML = `<span class="dict-visual-letter">${_esc(word.word.charAt(0).toUpperCase())}</span>`;
        }
      };
      el.innerHTML = '';
      el.appendChild(img);

    } else if (vt === 'emoji') {
      if (word.emoji_svg) {
        const img = document.createElement('img');
        img.src = word.emoji_svg;
        img.className = 'dict-visual-emoji';
        img.alt = word.emoji || word.word;
        el.appendChild(img);
      } else if (word.emoji) {
        el.innerHTML = `<span class="dict-visual-unicode">${_esc(word.emoji)}</span>`;
      } else {
        el.innerHTML = `<span class="dict-visual-letter">${_esc(word.word.charAt(0).toUpperCase())}</span>`;
      }

    } else {
      // visual_type === 'word' — first-letter avatar
      el.innerHTML = `<span class="dict-visual-letter">${_esc(word.word.charAt(0).toUpperCase())}</span>`;
    }
  }

  // ─── Pagination + Start Test ──────────────────────────────────

  function _renderPagination(currentPage, totalPages, testNum, q, total) {
    const pagEl = $id('dict-pagination');
    if (!pagEl) return;

    pagEl.innerHTML = '';

    if (q) {
      // Search mode: no pagination
      pagEl.classList.add('hidden');
      return;
    }

    pagEl.classList.remove('hidden');

    const from = (currentPage - 1) * WORDS_PER_PAGE + 1;
    const to   = total ? Math.min(currentPage * WORDS_PER_PAGE, total) : currentPage * WORDS_PER_PAGE;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'dict-page-btn';
    prevBtn.textContent = '← Prev';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => _loadPage(currentPage - 1, ''));

    const center = document.createElement('div');
    center.className = 'dict-page-center';

    const info = document.createElement('div');
    info.className = 'dict-page-info';
    info.textContent = `${from}–${to} of ${total || '?'} words`;

    center.appendChild(info);

    if (testNum) {
      const testBtn = document.createElement('button');
      testBtn.className = 'dict-start-test-btn';
      testBtn.textContent = `📝 Test ${testNum} घ्या →`;
      testBtn.addEventListener('click', () => {
        if (window.VOCAB?.startTest) VOCAB.startTest(testNum);
      });
      center.appendChild(testBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'dict-page-btn';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = currentPage >= totalPages;
    nextBtn.addEventListener('click', () => _loadPage(currentPage + 1, ''));

    pagEl.appendChild(prevBtn);
    pagEl.appendChild(center);
    pagEl.appendChild(nextBtn);
  }

  // ─── Empty state ──────────────────────────────────────────────

  function _showEmpty(msg, searchQuery) {
    const emptyEl = $id('dict-empty');
    if (!emptyEl) return;
    emptyEl.classList.remove('hidden');

    if (searchQuery) {
      emptyEl.innerHTML = `
        <div class="dict-not-found-msg">📭 ${_esc(msg)}</div>
        <button id="dict-add-missing-btn" class="dict-add-missing-btn">+ Bank मध्ये Add करा</button>`;
      $id('dict-add-missing-btn')?.addEventListener('click', () => _openAddWord(searchQuery));
    } else {
      emptyEl.innerHTML = `<div class="dict-not-found-msg">${_esc(msg)}</div>`;
    }
  }

  // Reuse existing vocab add-word modal (already in index.html)
  function _openAddWord(word) {
    const backdrop = $id('vocab-add-word-backdrop');
    const input    = $id('vocab-add-word-input');
    const ctx      = $id('vocab-add-context');
    const errEl    = $id('vocab-add-word-err');
    const preview  = $id('vocab-add-word-preview');
    const submit   = $id('vocab-add-submit');
    if (!backdrop) return;

    if (ctx)     ctx.textContent = `Adding to: ${_batch} / ${_subject}`;
    if (input)   input.value = word || '';
    if (errEl)   errEl.classList.add('hidden');
    if (preview) preview.classList.add('hidden');
    if (submit)  submit.disabled = true;
    backdrop.classList.remove('hidden');
    setTimeout(() => input?.focus(), 100);
  }

  // ─── Search ───────────────────────────────────────────────────

  function _onSearchInput(e) {
    clearTimeout(_searchTimer);
    const q = (e.target.value || '').trim();
    const clr = $id('dict-search-clear');
    if (clr) clr.style.display = q ? 'flex' : 'none';
    _searchTimer = setTimeout(() => _loadPage(1, q), 300);
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    $id('dict-search-input')?.addEventListener('input', _onSearchInput);

    $id('dict-search-clear')?.addEventListener('click', () => {
      const inp = $id('dict-search-input');
      if (inp) inp.value = '';
      const clr = $id('dict-search-clear');
      if (clr) clr.style.display = 'none';
      _loadPage(1, '');
    });
  }

  return { init, openDictScreen };
})();

window.DICT = DICT;
document.addEventListener('DOMContentLoaded', () => DICT.init());
