/* ════════════════════════════════════════
   wordTestPlayer.js — Admin Word Test Player
   Students take admin-created vocabulary tests.
   Flow: List → Play (Q by Q) → Submit → Score Review
════════════════════════════════════════ */

const WORD_TEST_PLAYER = (() => {
  let _batch   = '';
  let _subject = '';
  let _testId  = null;
  let _test    = null;   // full test object from API (questions stripped of correct_id)
  let _qIdx    = 0;      // current question index (0-based)
  let _answers = [];     // [{ question_id, selected_id }] indexed by _qIdx
  let _result  = null;   // server response after submit

  function $id(id) { return document.getElementById(id); }
  const _esc = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // ─── Screen / view helpers ───────────────────────────────────────────────────

  function _showScreen() {
    const screen = $id('screen-word-test');
    if (!screen) return;
    screen.classList.remove('hidden');
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id !== 'screen-word-test') s.classList.add('hidden');
    });
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('bnav-active'));
    $id('bnav-vocab')?.classList.add('bnav-active');
  }

  function _showView(view) {
    const ids = ['wtp-list-view', 'wtp-player-view', 'wtp-score-view'];
    ids.forEach(id => {
      const el = $id(id);
      if (el) el.classList.toggle('hidden', id !== view);
    });
  }

  function _backToVocab() {
    const vocab = $id('screen-vocab');
    if (!vocab) return;
    vocab.classList.remove('hidden');
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id !== 'screen-vocab') s.classList.add('hidden');
    });
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('bnav-active'));
    $id('bnav-vocab')?.classList.add('bnav-active');
  }

  // ─── Public entry ──────────────────────────────────────────────────────────

  async function openWordTestScreen(batch, subject) {
    _batch   = batch   || '';
    _subject = subject || '';
    _showScreen();
    await _loadList();
  }

  // ─── Test list ──────────────────────────────────────────────────────────────

  async function _loadList() {
    _showView('wtp-list-view');

    const titleEl = $id('wtp-list-title');
    if (titleEl) titleEl.textContent = _subject ? `${_subject} — Word Tests` : 'Word Tests';

    const grid  = $id('wtp-test-grid');
    const empty = $id('wtp-list-empty');

    if (!_subject) {
      if (grid)  grid.innerHTML = '';
      if (empty) { empty.textContent = 'Please select a subject first.'; empty.classList.remove('hidden'); }
      return;
    }

    if (grid)  grid.innerHTML = '<div class="wtp-loading">Loading...</div>';
    if (empty) empty.classList.add('hidden');

    try {
      const res   = await API.fetchStudentWordTests(_batch, _subject);
      const tests = Array.isArray(res?.tests) ? res.tests : [];

      if (!tests.length) {
        if (grid)  grid.innerHTML = '';
        if (empty) { empty.textContent = 'No word tests available yet.'; empty.classList.remove('hidden'); }
        return;
      }
      if (empty) empty.classList.add('hidden');

      if (grid) {
        grid.innerHTML = '';
        tests.forEach(t => {
          const att = t.my_attempt;
          const pct = att ? Math.round((att.score / att.total) * 100) : null;
          const cls = att ? (att.passed ? 'wtp-card-pass' : 'wtp-card-done') : 'wtp-card-new';
          const card = document.createElement('div');
          card.className = `wtp-test-card ${cls}`;
          card.innerHTML = `
            <div class="wtp-card-title">${_esc(t.title)}</div>
            <div class="wtp-card-meta">${t.total_questions} Questions</div>
            <div class="wtp-card-status">
              ${att ? `${pct}% ${att.passed ? '✅ Passed' : '📝 Done'}` : '🆕 New'}
            </div>`;
          card.addEventListener('click', () => _startTest(t.test_id, t.title));
          grid.appendChild(card);
        });
      }
    } catch (err) {
      if (grid) grid.innerHTML = `<div class="wtp-error">${_esc(err.message)}</div>`;
    }
  }

  // ─── Start test ──────────────────────────────────────────────────────────────

  async function _startTest(testId, title) {
    _testId  = testId;
    _qIdx    = 0;
    _answers = [];
    _result  = null;

    _showView('wtp-player-view');
    const titleEl = $id('wtp-player-title');
    if (titleEl) titleEl.textContent = title || 'Word Test';

    try {
      const res = await API.fetchStudentWordTest(testId);
      _test = res?.test || null;
      if (!_test?.questions?.length) {
        APP?.toast?.('Test has no questions', 'error');
        _showView('wtp-list-view');
        return;
      }
      _renderQuestion();
    } catch (err) {
      APP?.toast?.(err.message, 'error');
      _showView('wtp-list-view');
    }
  }

  // ─── Question rendering ──────────────────────────────────────────────────────

  function _renderQuestion() {
    const q = _test.questions[_qIdx];
    if (!q) { _doSubmitTest(); return; }

    // Progress indicator
    const prog = $id('wtp-progress');
    if (prog) prog.textContent = `${_qIdx + 1} / ${_test.questions.length}`;

    // Question type label and prompt text
    const typeLabel = $id('wtp-type-label');
    if (typeLabel) typeLabel.textContent = q.question_label || '';

    const qtpl = $id('wtp-question-text');
    if (qtpl) qtpl.textContent = q.question_template || '';

    // Reset all interactive areas
    const audioArea   = $id('wtp-audio-area');
    const optionsArea = $id('wtp-options-area');
    const typingArea  = $id('wtp-typing-area');
    const nextBtn     = $id('wtp-next-btn');

    if (optionsArea) { optionsArea.innerHTML = ''; optionsArea.className = 'wtp-options'; }
    if (typingArea)  typingArea.classList.add('hidden');
    if (nextBtn)     nextBtn.classList.add('hidden');

    // Audio button (manual — no autoplay)
    if (audioArea) {
      audioArea.classList.toggle('hidden', !q.audio);
      if (q.audio) {
        const ttsBtn = $id('wtp-tts-btn');
        if (ttsBtn) {
          ttsBtn.className = 'wtp-tts-btn';
          ttsBtn.onclick = () => {
            _speakWord(q.audio_word || '');
            ttsBtn.classList.add('wtp-tts-used');
          };
        }
      }
    }

    // Render options or typing input based on question type
    if (q.option_type === 'typing') {
      if (typingArea) typingArea.classList.remove('hidden');
      const input = $id('wtp-type-input');
      const sub   = $id('wtp-type-submit');
      if (input) { input.value = ''; input.disabled = false; }
      if (sub)   { sub.disabled = false; sub.onclick = () => _submitTyping(q); }
      if (input) input.onkeydown = e => { if (e.key === 'Enter') _submitTyping(q); };
      setTimeout(() => input?.focus(), 50);
    } else {
      _renderOptions(q);
    }
  }

  function _renderOptions(q) {
    const area = $id('wtp-options-area');
    if (!area) return;

    area.className = `wtp-options wtp-options-${q.option_type}`;

    (q.options || []).forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'wtp-opt-btn';
      btn.dataset.id = opt.id;

      switch (q.option_type) {
        case 'image':
          btn.innerHTML = _renderVisual(opt);
          break;
        case 'colour':
          btn.innerHTML = `
            <span class="wtp-colour-swatch" style="background:${_esc(opt.colour || '#ccc')}"></span>
            <span class="wtp-colour-label">${_esc(opt.text || '')}</span>`;
          break;
        default: // text
          btn.textContent = opt.text || opt.id;
      }

      btn.addEventListener('click', () => _selectOption(btn, opt.id, q));
      area.appendChild(btn);
    });
  }

  function _renderVisual(opt) {
    if (opt.emoji_svg) {
      return `<span class="wtp-opt-visual" aria-hidden="true">${opt.emoji_svg}</span>`;
    }
    if (opt.image_url) {
      return `<img class="wtp-opt-img" src="${_esc(opt.image_url)}" alt="${_esc(opt.text || '')}" loading="lazy" />`;
    }
    if (opt.emoji) {
      return `<span class="wtp-opt-visual" aria-hidden="true">${_esc(opt.emoji)}</span>`;
    }
    return `<span class="wtp-opt-label">${_esc(opt.text || '')}</span>`;
  }

  // ─── Answer selection ─────────────────────────────────────────────────────────

  function _selectOption(btn, optId, q) {
    // Disable all options + highlight selection
    const area = btn.closest('.wtp-options');
    area?.querySelectorAll('.wtp-opt-btn').forEach(b => {
      b.disabled = true;
      b.classList.remove('wtp-opt-selected');
    });
    btn.classList.add('wtp-opt-selected');

    _answers[_qIdx] = { question_id: q.question_id, selected_id: optId };
    _showNextBtn();
  }

  function _submitTyping(q) {
    const input = $id('wtp-type-input');
    const typed = (input?.value || '').trim();
    if (!typed) {
      input?.classList.add('wtp-input-shake');
      setTimeout(() => input?.classList.remove('wtp-input-shake'), 500);
      return;
    }

    if (input) input.disabled = true;
    const sub = $id('wtp-type-submit');
    if (sub) sub.disabled = true;

    _answers[_qIdx] = { question_id: q.question_id, selected_id: typed };
    _showNextBtn();
  }

  function _showNextBtn() {
    const btn = $id('wtp-next-btn');
    if (!btn) return;
    btn.classList.remove('hidden');
    btn.disabled = false;
    const isLast = _qIdx >= _test.questions.length - 1;
    btn.textContent = isLast ? 'Submit Test' : 'Next →';
    btn.onclick     = isLast ? _doSubmitTest : _nextQuestion;
  }

  function _nextQuestion() {
    _qIdx++;
    _renderQuestion();
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function _doSubmitTest() {
    const btn = $id('wtp-next-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
      const answers = _answers.filter(Boolean);
      _result = await API.submitWordTestAttempt(_testId, answers);
      _showScoreView();
    } catch (err) {
      APP?.toast?.(err.message || 'Submit failed', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Test'; }
    }
  }

  // ─── Score view ──────────────────────────────────────────────────────────────

  function _showScoreView() {
    _showView('wtp-score-view');

    const r   = _result || {};
    const pct = r.percent ?? (r.total ? Math.round((r.score / r.total) * 100) : 0);

    const scoreEl = $id('wtp-score-total');
    if (scoreEl) scoreEl.textContent = `${r.score ?? 0} / ${r.total ?? 0} (${pct}%)`;

    $id('wtp-pass-badge')?.classList.toggle('hidden', !r.passed);
    $id('wtp-fail-badge')?.classList.toggle('hidden', !!r.passed);

    _renderReview(r.correct_answers || {});
  }

  function _renderReview(correctAnswers) {
    const el = $id('wtp-review-list');
    if (!el || !_test?.questions) return;

    el.innerHTML = _test.questions.map((q, i) => {
      const myAns     = _answers[i];
      const correctId = correctAnswers[q.question_id];
      const isRight   = _isCorrect(q, myAns?.selected_id, correctId);

      const correctOpt  = q.options?.find(o => o.id === correctId);
      const correctText = correctOpt?.text || correctId || '—';

      return `<div class="wtp-review-row ${isRight ? 'wtp-review-right' : 'wtp-review-wrong'}">
        <span class="wtp-review-num">${i + 1}</span>
        <span class="wtp-review-icon">${isRight ? '✅' : '❌'}</span>
        <div class="wtp-review-detail">
          <div class="wtp-review-q">${_esc(q.question_label || q.type || '')}</div>
          <div class="wtp-review-word">${_esc(q.audio_word || '')}</div>
          ${!isRight ? `<div class="wtp-review-correct">✓ ${_esc(correctText)}</div>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function _isCorrect(q, selected, correctId) {
    if (!selected || !correctId) return false;
    if (q.option_type === 'typing') {
      return String(selected).trim().toLowerCase() === String(correctId).trim().toLowerCase();
    }
    return selected === correctId;
  }

  // ─── TTS ────────────────────────────────────────────────────────────────────

  async function _speakWord(word) {
    const w = String(word || '').trim();
    if (!w) return;
    const CapTTS = window.Capacitor?.Plugins?.TextToSpeech;
    if (CapTTS) {
      try {
        await CapTTS.speak({ text: w, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0 });
        return;
      } catch {}
    }
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const utt = new SpeechSynthesisUtterance(w);
      utt.lang = 'en-US';
      utt.rate = 0.9;
      synth.speak(utt);
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function _init() {
    $id('wtp-back-btn')?.addEventListener('click', _backToVocab);

    $id('wtp-player-back')?.addEventListener('click', async () => {
      if (_answers.filter(Boolean).length > 0) {
        if (!await UI.confirmAsync('Progress जाईल. मागे जायचे?')) return;
      }
      _showView('wtp-list-view');
    });

    $id('wtp-score-back')?.addEventListener('click', () => _loadList());
    $id('wtp-score-home-btn')?.addEventListener('click', () => _loadList());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  return { openWordTestScreen };
})();

window.WORD_TEST_PLAYER = WORD_TEST_PLAYER;
