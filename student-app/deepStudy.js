/* ════════════════════════════════════════════════
   deepStudy.js — Premium Flashcard Study Mode
   Global: DEEP_STUDY
════════════════════════════════════════════════ */

const DEEP_STUDY = (() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const _esc = s => String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ─── State ────────────────────────────────────────────────
  let _questions  = [];
  let _states     = [];  // 'pending' | 'known' | 'review'
  let _idx        = 0;
  let _revealed   = false;
  let _batch      = '';
  let _subject    = '';
  let _chapter    = '';
  let _sessionAC  = null;

  // ─── Entry Point ─────────────────────────────────────────
  async function open(batch, subject, chapter) {
    _batch   = batch   || '';
    _subject = subject || '';
    _chapter = chapter || '';

    APP.showScreen('deep-study');
    _showLoading(true);

    const allQ = await DB.getAllQuestions().catch(() => []);
    let pool = allQ.filter(q =>
      (!_batch   || q.batch   === _batch) &&
      (!_subject || q.subject === _subject) &&
      (!_chapter || q.chapter === _chapter)
    );

    if (!pool.length) {
      APP.toast('या chapter मध्ये questions नाहीत', 'info');
      APP.goBack();
      return;
    }

    // Shuffle
    pool = [...pool].sort(() => Math.random() - 0.5);
    _questions = pool;
    _states    = new Array(pool.length).fill('pending');
    _idx       = 0;
    _revealed  = false;

    _showLoading(false);
    _resetLayout();
    _renderBreadcrumb();
    _renderCard();
    _renderMinimap();
    _updateStats();
    _bindEvents();
  }

  // ─── Layout helpers ──────────────────────────────────────
  function _showLoading(on) {
    $('ds-loading')?.classList.toggle('hidden', !on);
    $('ds-content')?.classList.toggle('hidden', on);
  }

  function _resetLayout() {
    $('ds-card-area')?.classList.remove('hidden');
    $('ds-action-bar')?.classList.remove('hidden');
    $('ds-minimap-wrap')?.classList.remove('hidden');
    $('ds-progress-wrap')?.classList.remove('hidden');
    $('ds-summary')?.classList.add('hidden');
  }

  function _renderBreadcrumb() {
    const parts = [_batch, _subject, _chapter].filter(Boolean);
    const el = $('ds-breadcrumb');
    if (el) el.textContent = parts.join(' › ') || 'Deep Study';
  }

  // ─── Card Rendering ───────────────────────────────────────
  function _renderCard() {
    const card = $('ds-card');
    if (!card) return;

    // Snap back to front without animation
    card.classList.remove('is-flipped', 'ds-swipe-right', 'ds-swipe-left');
    _revealed = false;

    const q = _questions[_idx];

    // ── Front face ──
    const numEl = $('ds-q-num');
    if (numEl) numEl.textContent = _idx + 1;

    const totalEl = $('ds-q-num-total');
    if (totalEl) totalEl.textContent = _questions.length;

    const textEl = $('ds-q-text');
    if (textEl) textEl.textContent = q.question || '(no question text)';

    const imgWrap = $('ds-q-img-wrap');
    const img     = $('ds-q-img');
    if (q.image && img && imgWrap) {
      img.src = q.image;
      imgWrap.classList.remove('hidden');
    } else {
      imgWrap?.classList.add('hidden');
    }

    // ── Back face — answer + options review ──
    const correct = String(q.correct_answer || q.answer || '').trim();
    const answerEl = $('ds-answer-text');
    if (answerEl) answerEl.textContent = correct || '—';

    // Options list
    const optionsEl = $('ds-options-review');
    if (optionsEl) {
      const opts = [
        { label: 'A', text: q.options?.A },
        { label: 'B', text: q.options?.B },
        { label: 'C', text: q.options?.C },
        { label: 'D', text: q.options?.D },
      ].filter(o => o.text);

      if (opts.length) {
        optionsEl.innerHTML = opts.map(o => {
          const isCorrect = correct.toUpperCase() === o.label ||
            _normalize(correct) === _normalize(o.text);
          return `<div class="ds-opt ${isCorrect ? 'ds-opt-correct' : ''}">
            <span class="ds-opt-label">${_esc(o.label)}</span>
            <span class="ds-opt-text">${_esc(o.text)}</span>
          </div>`;
        }).join('');
        optionsEl.classList.remove('hidden');
      } else {
        optionsEl.classList.add('hidden');
      }
    }

    // Explanation
    const expWrap = $('ds-exp-wrap');
    const expText = $('ds-exp-text');
    if (q.explanation && expText && expWrap) {
      expText.textContent = q.explanation;
      expWrap.classList.remove('hidden');
    } else {
      expWrap?.classList.add('hidden');
    }

    _updateActionBar();
    _updateProgress();
    _highlightMinimap();

    // Render math symbols on both card faces (KaTeX)
    if (window.MATH) MATH.renderElement($('ds-card'));
  }

  function _normalize(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // ─── Card Actions ─────────────────────────────────────────
  function _reveal() {
    if (_revealed) return;
    _revealed = true;
    $('ds-card')?.classList.add('is-flipped');
    _updateActionBar();
  }

  function _markKnown() {
    if (!_revealed) { _reveal(); return; }
    _states[_idx] = 'known';
    _flyCard('ds-swipe-right', _advance);
  }

  function _markReview() {
    if (!_revealed) { _reveal(); return; }
    _states[_idx] = 'review';
    _flyCard('ds-swipe-left', _advance);
  }

  function _flyCard(cls, done) {
    const card = $('ds-card');
    if (!card) { done(); return; }
    card.classList.add(cls);
    setTimeout(done, 320);
  }

  function _advance() {
    _renderMinimap();
    _updateStats();

    const allDone = _states.every(s => s !== 'pending');
    if (allDone) { _showSummary(); return; }

    // Find next pending
    let next = _idx;
    for (let i = 1; i <= _questions.length; i++) {
      next = (_idx + i) % _questions.length;
      if (_states[next] === 'pending') break;
    }
    _idx = next;
    _renderCard();
  }

  // ─── Progress & Stats ─────────────────────────────────────
  function _updateProgress() {
    const done  = _states.filter(s => s !== 'pending').length;
    const total = _questions.length;
    const pct   = total ? (done / total) * 100 : 0;
    const fill  = $('ds-progress-fill');
    const text  = $('ds-progress-text');
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${done} / ${total}`;
  }

  function _updateStats() {
    const known  = _states.filter(s => s === 'known').length;
    const review = _states.filter(s => s === 'review').length;
    const el = {
      known:  $('ds-stat-known'),
      review: $('ds-stat-review'),
      total:  $('ds-stat-total'),
    };
    if (el.known)  el.known.textContent  = `${known} ✓`;
    if (el.review) el.review.textContent = `${review} ↺`;
    if (el.total)  el.total.textContent  = `${_questions.length}`;
    _updateProgress();
  }

  function _updateActionBar() {
    const reveal = $('ds-btn-reveal');
    const known  = $('ds-btn-known');
    const hard   = $('ds-btn-hard');
    if (_revealed) {
      reveal?.classList.add('hidden');
      known?.classList.remove('hidden');
      hard?.classList.remove('hidden');
    } else {
      reveal?.classList.remove('hidden');
      known?.classList.add('hidden');
      hard?.classList.add('hidden');
    }
  }

  // ─── Minimap ──────────────────────────────────────────────
  function _renderMinimap() {
    const el = $('ds-minimap');
    if (!el) return;
    el.innerHTML = '';
    _questions.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = `ds-dot ds-dot-${_states[i]} ${i === _idx ? 'ds-dot-active' : ''}`;
      el.appendChild(dot);
    });
  }

  function _highlightMinimap() {
    document.querySelectorAll('.ds-dot').forEach((dot, i) => {
      dot.className = `ds-dot ds-dot-${_states[i]} ${i === _idx ? 'ds-dot-active' : ''}`;
    });
  }

  // ─── Summary ──────────────────────────────────────────────
  function _showSummary() {
    const known  = _states.filter(s => s === 'known').length;
    const review = _states.filter(s => s === 'review').length;
    const total  = _questions.length;

    $('ds-sum-known').textContent  = known;
    $('ds-sum-review').textContent = review;

    const pct = Math.round((known / total) * 100);
    $('ds-sum-pct').textContent = `${pct}%`;
    $('ds-summary-emoji').textContent =
      pct === 100 ? '🏆' : pct >= 70 ? '🎉' : pct >= 40 ? '📖' : '💪';
    $('ds-summary-title').textContent =
      pct === 100 ? 'Perfect! सर्व माहित आहेत!' :
      pct >= 70   ? `छान! ${known}/${total} known` :
      pct >= 40   ? `ठीक आहे. सराव करत राहा.` :
                    `अजून अभ्यास करा — ${review} cards review करा`;

    $('ds-card-area')?.classList.add('hidden');
    $('ds-action-bar')?.classList.add('hidden');
    $('ds-minimap-wrap')?.classList.add('hidden');
    $('ds-progress-wrap')?.classList.add('hidden');
    $('ds-summary')?.classList.remove('hidden');

    const retryBtn = $('ds-btn-retry-weak');
    if (retryBtn) retryBtn.classList.toggle('hidden', review === 0);
  }

  function _retryWeak() {
    const weakIdxs = _states.map((s, i) => s === 'review' ? i : -1).filter(i => i >= 0);
    _questions = weakIdxs.map(i => _questions[i]);
    _questions = [..._questions].sort(() => Math.random() - 0.5);
    _states    = new Array(_questions.length).fill('pending');
    _idx       = 0;
    _revealed  = false;
    _resetLayout();
    _renderCard();
    _renderMinimap();
    _updateStats();
  }

  function _restart() {
    _questions = [..._questions].sort(() => Math.random() - 0.5);
    _states    = new Array(_questions.length).fill('pending');
    _idx       = 0;
    _revealed  = false;
    _resetLayout();
    _renderCard();
    _renderMinimap();
    _updateStats();
  }

  // ─── Events ───────────────────────────────────────────────
  function _bindEvents() {
    // Abort previous session's listeners before re-adding (prevents accumulation on re-open)
    if (_sessionAC) _sessionAC.abort();
    _sessionAC = new AbortController();
    const sig = _sessionAC.signal;

    $('ds-card')?.addEventListener('click', () => {
      if (!$('ds-card')?.classList.contains('is-flipped')) _reveal();
    }, { signal: sig });

    $('ds-btn-reveal')?.addEventListener('click', _reveal, { signal: sig });
    $('ds-btn-known')?.addEventListener('click', _markKnown, { signal: sig });
    $('ds-btn-hard')?.addEventListener('click', _markReview, { signal: sig });
    $('ds-btn-retry-weak')?.addEventListener('click', _retryWeak, { signal: sig });
    $('ds-btn-restart')?.addEventListener('click', _restart, { signal: sig });
    $('ds-btn-ds-done')?.addEventListener('click', () => APP.loadHome(), { signal: sig });

    document.addEventListener('keydown', e => {
      if (APP.currentScreen() !== 'deep-study') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'ArrowUp')   { _reveal(); e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'k') { _markKnown(); e.preventDefault(); }
      if (e.key === 'ArrowLeft'  || e.key === 'r') { _markReview(); e.preventDefault(); }
    }, { signal: sig });

    _setupSwipe($('ds-card-area'), sig);
  }

  function _setupSwipe(el, signal) {
    if (!el) return;
    let sx = 0, sy = 0;
    el.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true, signal });
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 55) return;
      if (!_revealed) { _reveal(); return; }
      if (dx > 0) _markKnown(); else _markReview();
    }, { passive: true, signal });
  }

  return { open };
})();

window.DEEP_STUDY = DEEP_STUDY;
