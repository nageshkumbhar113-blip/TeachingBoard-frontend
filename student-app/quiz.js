/* ════════════════════════════════════════
   quiz.js — Quiz Engine
   Handles: MCQ, T/F, FIB, MTP, Timer,
            Shuffle, Revision mode, Sessions
   Globals: QUIZ, RESULTS
════════════════════════════════════════ */

const QUIZ = (() => {
  // ── State ─────────────────────────────────
  let state = {
    questions    : [],
    current      : 0,
    session      : {
      batch: '', subject: '', chapter: '',
      correct: 0, wrong: 0, skipped: 0,
      startTime: null, answers: [], mode: 'practice'
    },
    answered     : false,
    timerVal     : 30,
    timerInterval: null,
    timerRemaining: 0,
    shuffleOn    : false,
    revisionMode : false,
    mtpState     : { leftSel: null, matched: [] },
    actionLocked : false,
    actionLockTimer: null,
  };

  const $ = id => document.getElementById(id);
  const _setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '';
    return el;
  };
  const _setValue = (id, value) => {
    const el = $(id);
    if (el) el.value = value;
    return el;
  };
  const _escHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  async function _resolveImageSrc(ref) {
    if (!ref) return null;
    const localSrc = await DB.getImage(ref).catch(() => null);
    return localSrc || String(ref || '').trim() || null;
  }

  function _getOptionText(q, key) {
    return String(q?.options?.[key] || '').trim();
  }

  function _getOptionImageRef(q, key) {
    return String(q?.option_images?.[key] || '').trim() || null;
  }

  function _hasOptionContent(q, key) {
    return !!_getOptionText(q, key) || !!_getOptionImageRef(q, key);
  }

  function _getAnswerFeedbackText(q, key) {
    const text = _getOptionText(q, key);
    if (text) return text;
    if (_getOptionImageRef(q, key)) return 'Image option';
    return '';
  }

  async function _buildOptionMarkup(q, key) {
    const text = _getOptionText(q, key);
    const imageSrc = await _resolveImageSrc(_getOptionImageRef(q, key));
    return `
      <span class="option-key">${_escHtml(key)})</span>
      <span class="option-body">
        ${text ? `<span class="option-text${imageSrc ? ' option-text-with-media' : ''}">${_escHtml(text)}</span>` : ''}
        ${imageSrc ? `<span class="option-media"><img src="${_escHtml(imageSrc)}" alt="Option ${_escHtml(key)} image" loading="lazy" decoding="async" /></span>` : ''}
      </span>
    `;
  }

  function _formatTimerValue(seconds) {
    if (!document.body.classList.contains('mode-board')) return String(seconds);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function _beginActionLock(delay = 300) {
    if (state.actionLocked) return true;
    state.actionLocked = true;
    if (state.actionLockTimer) clearTimeout(state.actionLockTimer);
    state.actionLockTimer = setTimeout(() => {
      state.actionLocked = false;
      state.actionLockTimer = null;
    }, delay);
    return false;
  }

  function _recoverMissingQuestion() {
    console.warn('Missing question at index:', state.current);
    if (state.current < state.questions.length - 1) {
      state.current++;
      _renderQuestion();
    } else {
      _endSession();
    }
  }

  // ════════════════════════
  // START QUIZ
  // ════════════════════════

  async function startQuiz(batch, subject, chapter, mode = 'practice') {
    let qs = await DB.getQuestionsByChapter(batch, subject, chapter);

    if (qs.length === 0 && navigator.onLine && batch === API.REMOTE_BATCH) {
      await loadRemoteQuiz();
      qs = await DB.getQuestionsByChapter(batch, subject, chapter);
    }

    if (mode === 'revision') {
      qs = qs.filter(q => q.weak_count >= 2 || q.flagged);
      if (!qs.length) { APP.toast(I18N.t('no.questions'), 'info'); return; }
    }

    if (!qs.length) { APP.toast(I18N.t('no.questions'), 'info'); return; }

    state.questions    = [...qs];
    state.current      = 0;
    state.answered     = false;
    state.actionLocked = false;
    state.revisionMode = mode === 'revision';
    state.session      = {
      batch, subject, chapter,
      correct: 0, wrong: 0, skipped: 0,
      startTime: Date.now(), answers: [], mode
    };

    if (state.shuffleOn) _shuffleQuestions();

    _setText('quiz-chapter-name', chapter);
    _setText('quiz-mode-badge', state.revisionMode ? I18N.t('revision.mode') : I18N.t('practice.mode'));
    $('btn-revision')?.classList.toggle('active', state.revisionMode);

    const savedTimer = await DB.getSetting('timer', 30);
    _setValue('timer-select', savedTimer);
    state.timerVal = parseInt(savedTimer, 10) || 0;

    _updateNavScore();
    _renderQuestion();
    APP.showScreen('quiz');
  }

  async function loadRemoteQuiz(limit = 20) {
    const remoteQuestions = await API.fetchQuiz(limit);
    return API.cacheQuizQuestions(remoteQuestions);
  }

  // ════════════════════════
  // RENDER QUESTION
  // ════════════════════════

  async function _renderQuestion() {
    _stopTimer();
    $('feedback-bar')?.classList.add('hidden');
    state.answered = false;

    const q = state.questions[state.current];
    if (!q) { _recoverMissingQuestion(); return; }

    // Progress
    const total = state.questions.length;
    const pct   = total > 0 ? Math.round((state.current / total) * 100) : 0;
    const pFill = $('progress-fill');
    if (pFill) {
      pFill.style.width = pct + '%';
      pFill.parentElement?.setAttribute('aria-valuenow', pct);
    }
    _setText('progress-text', `${state.current + 1} / ${total}`);
    _setText('q-number', `Q${state.current + 1}`);

    // Difficulty badge
    const diffBadge = $('current-diff-badge');
    if (diffBadge) {
      diffBadge.textContent = q.difficulty
        ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : '';
      diffBadge.className = 'diff-badge ' + (q.difficulty || '');
    }

    _setText('q-text', q.question || '');

    // Image
    const imgWrap = $('q-image-wrap');
    if (q.image) {
      const imgUrl = await _resolveImageSrc(q.image);
      if (imgUrl) {
        const img = $('q-image');
        if (img) img.src = imgUrl;
        imgWrap?.classList.remove('hidden');
      } else {
        imgWrap?.classList.add('hidden');
      }
    } else {
      imgWrap?.classList.add('hidden');
    }

    $('btn-flag')?.classList.toggle('flagged', !!q.flagged);

    // Render by type
    _hideAllInputs();
    const type = q.type || 'mcq';
    if      (type === 'mcq') await _renderMCQ(q);
    else if (type === 'tf')  _renderTF(q);
    else if (type === 'fib') _renderFIB(q);
    else if (type === 'mtp') _renderMTP(q);

    // Card animation
    const card = $('question-card');
    if (card) {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = 'cardIn 0.25s ease';
    }

    if (window.TTS && TTS.isEnabled()) TTS.read(q.question);
    _startTimer();
    APP.setBreadcrumb(`${state.session.batch} › ${state.session.subject} › ${state.session.chapter}`);
  }

  function _hideAllInputs() {
    $('options-grid')?.classList.add('hidden');
    $('tf-grid')?.classList.add('hidden');
    $('fib-wrap')?.classList.add('hidden');
    $('mtp-wrap')?.classList.add('hidden');
  }

  // ════════════════════════
  // MCQ
  // ════════════════════════

  async function _renderMCQ(q) {
    const grid = $('options-grid');
    grid.classList.remove('hidden');
    grid.innerHTML = '';

    let opts = Object.entries(q.options || {});
    if (state.shuffleOn) opts = _shuffleArray(opts);

    for (const [key] of opts) {
      if (!_hasOptionContent(q, key)) continue;
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.key     = key;
      btn.dataset.kbIndex = grid.children.length + 1;
      btn.innerHTML = await _buildOptionMarkup(q, key);
      btn.addEventListener('click', () => _selectMCQ(btn, key, q));
      grid.appendChild(btn);
    }
  }

  function _selectMCQ(btn, selected, q) {
    if (state.answered || _beginActionLock()) return;
    state.answered = true;
    _stopTimer();

    const correct   = q.answer;
    const isCorrect = selected === correct;

    $('options-grid')?.querySelectorAll('.option-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.key === correct)                 b.classList.add('correct');
      else if (b.dataset.key === selected && !isCorrect) b.classList.add('wrong');
    });

    _recordAnswer(q, selected, isCorrect);
    _showFeedback(isCorrect, correct, _getAnswerFeedbackText(q, correct));
  }

  // ════════════════════════
  // TRUE / FALSE
  // ════════════════════════

  function _renderTF(q) {
    $('tf-grid')?.classList.remove('hidden');
    $('tf-grid')?.querySelectorAll('.tf-btn').forEach(btn => {
      btn.disabled  = false;
      btn.className = 'tf-btn';
      btn.onclick   = () => _selectTF(btn, btn.dataset.val, q);
    });
  }

  function _selectTF(btn, selected, q) {
    if (state.answered || _beginActionLock()) return;
    state.answered = true;
    _stopTimer();

    const correct   = q.answer;
    const isCorrect = selected === correct;

    $('tf-grid')?.querySelectorAll('.tf-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.val === correct)                    b.classList.add('correct');
      else if (b.dataset.val === selected && !isCorrect) b.classList.add('wrong');
    });

    _recordAnswer(q, selected, isCorrect);
    _showFeedback(isCorrect, correct);
  }

  // ════════════════════════
  // FILL IN BLANK
  // ════════════════════════

  function _renderFIB(q) {
    $('fib-wrap')?.classList.remove('hidden');
    const input = $('fib-input');
    if (!input) return;
    input.value       = '';
    input.placeholder = I18N.t('fib.placeholder');
    input.disabled    = false;
    input.focus();
    $('fib-submit').onclick = () => _submitFIB(q);
    input.onkeydown = e => { if (e.key === 'Enter') _submitFIB(q); };
  }

  function _submitFIB(q) {
    const input = $('fib-input');
    if (!input || state.answered || _beginActionLock()) return;
    const val = input.value.trim();
    if (!val) return;
    state.answered = true;
    _stopTimer();

    const correct   = (q.answer || '').toString().trim().toLowerCase();
    const isCorrect = val.toLowerCase() === correct;

    input.disabled = true;
    input.style.borderColor = isCorrect ? 'var(--correct)' : 'var(--wrong)';

    _recordAnswer(q, val, isCorrect);
    _showFeedback(isCorrect, q.answer);
  }

  // ════════════════════════
  // MATCH THE PAIR
  // ════════════════════════

  function _renderMTP(q) {
    const wrap = $('mtp-wrap');
    if (!wrap) return;
    wrap.classList.remove('hidden');
    state.mtpState = { leftSel: null, matched: [] };
    wrap.innerHTML = '';

    const pairs   = q.pairs || [];
    const left    = pairs.map(p => p[0]);
    const right   = _shuffleArray(pairs.map(p => p[1]));
    const leftDiv = document.createElement('div');
    leftDiv.className = 'mtp-left';
    const rightDiv = document.createElement('div');
    rightDiv.className = 'mtp-right';

    left.forEach((item, i) => {
      const el = document.createElement('div');
      el.className  = 'mtp-item';
      el.textContent = item;
      el.dataset.idx  = i;
      el.dataset.side = 'left';
      el.addEventListener('click', () => _mtpClick(el, q, pairs, right));
      leftDiv.appendChild(el);
    });

    right.forEach((item, i) => {
      const el = document.createElement('div');
      el.className  = 'mtp-item';
      el.textContent = item;
      el.dataset.idx  = i;
      el.dataset.side = 'right';
      el.addEventListener('click', () => _mtpClick(el, q, pairs, right));
      rightDiv.appendChild(el);
    });

    wrap.appendChild(leftDiv);
    wrap.appendChild(rightDiv);
  }

  function _mtpClick(el, q, pairs, right) {
    if (state.answered) return;
    const side = el.dataset.side;
    const ms   = state.mtpState;

    if (side === 'left') {
      $('mtp-wrap').querySelectorAll('.mtp-item[data-side="left"]').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      ms.leftSel = el;
    } else if (ms.leftSel) {
      const leftIdx    = parseInt(ms.leftSel.dataset.idx);
      const rightVal   = right[parseInt(el.dataset.idx)];
      const correctRight = pairs[leftIdx][1];
      const isMatch    = rightVal === correctRight;

      ms.leftSel.classList.remove('selected');
      ms.leftSel.classList.add(isMatch ? 'matched' : 'wrong');
      el.classList.add(isMatch ? 'matched' : 'wrong');

      if (isMatch) {
        ms.matched.push(leftIdx);
        ms.leftSel.style.pointerEvents = 'none';
        el.style.pointerEvents = 'none';
      }
      ms.leftSel = null;

      if (ms.matched.length === pairs.length) {
        state.answered = true;
        _stopTimer();
        _recordAnswer(q, 'all_matched', true);
        _showFeedback(true);
      }
    }
  }

  // ════════════════════════
  // TIMER
  // ════════════════════════

  function _startTimer() {
    _stopTimer();
    const val = parseInt($('timer-select')?.value, 10) || 0;
    state.timerVal = val;
    if (val === 0) { $('timer-wrap')?.classList.add('hidden'); return; }

    $('timer-wrap')?.classList.remove('hidden');
    state.timerRemaining = val;
    _setText('timer-count', _formatTimerValue(val));

    const circumference = 2 * Math.PI * 28;
    const ring = $('ring-fill');
    if (ring) {
      ring.style.strokeDasharray  = circumference;
      ring.style.strokeDashoffset = 0;
      ring.classList.remove('urgent');
    }

    state.timerInterval = setInterval(() => {
      state.timerRemaining--;
      _setText('timer-count', _formatTimerValue(state.timerRemaining));
      if (ring) {
        ring.style.strokeDashoffset  = circumference * (1 - state.timerRemaining / val);
        if (state.timerRemaining <= 5) ring.classList.add('urgent');
      }
      if (state.timerRemaining <= 0) {
        _stopTimer();
        if (!state.answered) {
          APP.toast(I18N.t('timer.reveal'), 'info');
          _revealAnswer();
        }
      }
    }, 1000);
  }

  function _stopTimer() {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  }

  function _revealAnswer() {
    state.answered = true;
    const q    = state.questions[state.current];
    if (!q) { _recoverMissingQuestion(); return; }
    const type = q.type || 'mcq';

    if (type === 'mcq') {
      $('options-grid')?.querySelectorAll('.option-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.key === q.answer) b.classList.add('correct');
      });
    } else if (type === 'tf') {
      $('tf-grid')?.querySelectorAll('.tf-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.val === q.answer) b.classList.add('correct');
      });
    }

    state.session.skipped++;
    _updateNavScore();

    const feedback = $('feedback-bar');
    const feedbackIcon = $('feedback-icon');
    const feedbackText = $('feedback-text');
    if (!feedback || !feedbackIcon || !feedbackText) return;
    feedback.className = 'feedback-bar wrong-fb';
    $('feedback-icon').textContent = '⏰';
    const answerText = _getAnswerFeedbackText(q, q.answer);
    _setText('feedback-text', `${I18N.t('wrong')} ${q.answer}${answerText ? ` — ${answerText}` : ''}`);
    feedback.classList.remove('hidden');
  }

  // ════════════════════════
  // FEEDBACK & SCORE
  // ════════════════════════

  function _showFeedback(isCorrect, answer, ansText) {
    const feedback = $('feedback-bar');
    const feedbackIcon = $('feedback-icon');
    const feedbackText = $('feedback-text');
    if (!feedback || !feedbackIcon || !feedbackText) return;
    feedback.className = 'feedback-bar ' + (isCorrect ? 'correct-fb' : 'wrong-fb');
    $('feedback-icon').textContent = isCorrect ? '✅' : '❌';
    $('feedback-text').textContent = isCorrect
      ? I18N.t('correct')
      : `${I18N.t('wrong')} ${answer}${ansText ? ` — ${ansText}` : ''}`;
    feedback.classList.remove('hidden');
  }

  function _recordAnswer(q, given, isCorrect) {
    if (isCorrect) { state.session.correct++; DB.incrementCorrect(q.q_id); }
    else           { state.session.wrong++;   DB.incrementWrong(q.q_id); }
    state.session.answers.push({ q_id: q.q_id, given, correct: isCorrect, time: Date.now() });
    _updateNavScore();
  }

  function _updateNavScore() {
    const s = state.session;
    const nc = document.getElementById('nav-correct');
    const nw = document.getElementById('nav-wrong');
    const ns = document.getElementById('nav-skip');
    if (nc) nc.textContent = s.correct;
    if (nw) nw.textContent = s.wrong;
    if (ns) ns.textContent = s.skipped;
  }

  // ════════════════════════
  // NAVIGATION
  // ════════════════════════

  function nextQuestion() {
    if (_beginActionLock()) return;
    if (!state.answered) { state.session.skipped++; _updateNavScore(); }
    if (state.current < state.questions.length - 1) { state.current++; _renderQuestion(); }
    else { _endSession(); }
  }

  function prevQuestion() {
    if (_beginActionLock()) return;
    if (state.current > 0) { state.current--; _renderQuestion(); }
  }

  async function flagCurrent() {
    if (_beginActionLock()) return;
    const q = state.questions[state.current];
    if (!q) return;
    const isFlagged = await DB.toggleFlag(q.q_id);
    q.flagged = isFlagged;
    $('btn-flag')?.classList.toggle('flagged', isFlagged);
    APP.toast(I18N.t(isFlagged ? 'flagged' : 'unflagged'), 'info');
  }

  function toggleShuffle() {
    state.shuffleOn = !state.shuffleOn;
    $('btn-shuffle')?.classList.toggle('active', state.shuffleOn);
    APP.toast(I18N.t(state.shuffleOn ? 'shuffle.on' : 'shuffle.off'), 'info');
    DB.setSetting('shuffle', state.shuffleOn);
    if (state.shuffleOn) _shuffleQuestions();
  }

  function toggleRevision() {
    const s = state.session;
    startQuiz(s.batch, s.subject, s.chapter, state.revisionMode ? 'practice' : 'revision');
  }

  // ════════════════════════
  // SESSION END
  // ════════════════════════

  async function _endSession() {
    _stopTimer();
    const s    = state.session;
    s.endTime  = Date.now();
    s.duration = Math.round((s.endTime - s.startTime) / 1000);
    s.total    = state.questions.length;
    s.score    = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;

    try {
      await DB.saveSession({ ...s });
    } catch (err) {
      console.error('DB write failed:', err);
      APP.toast('Offline save failed', 'error');
    }
    await _submitSessionToBackend(s);

    RESULTS.show(s, state.questions);
    APP.showScreen('results');
  }

  async function _submitSessionToBackend(session) {
    const backendAnswers = session.answers.map(a => {
      const q = state.questions.find(item => item.q_id === a.q_id);
      if (!q?.backend_id) return null;
      const norm = _normalizeAnswerForApi(a.given);
      if (!norm) return null;
      return { questionId: q.backend_id, answer: norm };
    }).filter(Boolean);

    if (!backendAnswers.length) return;

    try {
      const studentName = await _getStudentName();
      await API.submitQuiz(studentName, backendAnswers);
    } catch (err) {
      APP.toast(`Result sync failed: ${err.message}`, 'error');
    }
  }

  function _normalizeAnswerForApi(answer) {
    const map = {
      A: 'option1', B: 'option2', C: 'option3', D: 'option4',
      option1: 'option1', option2: 'option2', option3: 'option3', option4: 'option4',
    };
    return map[String(answer || '').trim()] || '';
  }

  async function _getStudentName() {
    let name = await DB.getSetting('student_name', '');
    if (name) return name;
    name = prompt('Enter student name for server result sync:')?.trim() || '';
    if (!name) return 'Student';
    await DB.setSetting('student_name', name);
    return name;
  }

  // ════════════════════════
  // HELPERS
  // ════════════════════════

  function _shuffleQuestions() {
    for (let i = state.questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.questions[i], state.questions[j]] = [state.questions[j], state.questions[i]];
    }
  }

  function _shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ════════════════════════
  // KEYBOARD
  // ════════════════════════

  function _initKeyboard() {
    document.addEventListener('keydown', e => {
      if (document.querySelector('.screen:not(.hidden)')?.id !== 'screen-quiz') return;
      if (document.querySelector('.modal-overlay:not(.hidden)')) return;
      if (_isTypingTarget(e.target)) return;

      switch (e.key) {
        case 'ArrowRight': nextQuestion(); break;
        case 'ArrowLeft':  prevQuestion(); break;
        case 'Enter':
        case 'n':
        case 'N':
          nextQuestion();
          break;
        case 'p':
        case 'P':
          prevQuestion();
          break;
        case ' ':
          e.preventDefault();
          if (!state.answered) _revealAnswer();
          break;
        case '1': _clickOptionByIndex(0); break;
        case '2': _clickOptionByIndex(1); break;
        case '3': _clickOptionByIndex(2); break;
        case '4': _clickOptionByIndex(3); break;
        case 'f':
        case 'F':
          flagCurrent();
          break;
        case 'r':
        case 'R':
          toggleRevision();
          break;
        case 's':
        case 'S':
          toggleShuffle();
          break;
      }
    });
  }

  function _clickOptionByIndex(i) {
    const btns = $('options-grid')?.querySelectorAll('.option-btn:not(:disabled)');
    if (btns[i] && !state.answered) btns[i].click();
  }

  function _isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  // ════════════════════════
  // INIT
  // ════════════════════════

  function init() {
    _initKeyboard();

    $('btn-next')?.addEventListener('click', nextQuestion);
    $('btn-prev')?.addEventListener('click', prevQuestion);
    $('btn-flag')?.addEventListener('click', flagCurrent);
    $('btn-skip')?.addEventListener('click', nextQuestion);
    $('btn-shuffle')?.addEventListener('click', toggleShuffle);
    $('btn-revision')?.addEventListener('click', toggleRevision);

    $('timer-select')?.addEventListener('change', e => {
      state.timerVal = parseInt(e.target.value);
      DB.setSetting('timer', state.timerVal);
    });

    DB.getSetting('shuffle', false).then(v => {
      state.shuffleOn = v;
      $('btn-shuffle')?.classList.toggle('active', v);
    });
  }

  function getSession()   { return state.session; }
  function getQuestions() { return state.questions; }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, startQuiz, loadRemoteQuiz, nextQuestion, prevQuestion, getSession, getQuestions };
})();

// ════════════════════════════════════════
// RESULTS — session results screen
// ════════════════════════════════════════

const RESULTS = (() => {
  const $ = id => document.getElementById(id);
  const _setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '';
    return el;
  };

  async function show(session, questions) {
    const { correct, wrong, skipped, total, score, duration } = session;

    const emoji = score >= 80 ? '🏆' : score >= 60 ? '⭐' : score >= 40 ? '📚' : '💪';
    _setText('results-emoji', emoji);
    _setText('results-title', I18N.t('results.title'));

    _setText('res-correct', correct);
    _setText('res-wrong', wrong);
    _setText('res-skip', skipped);
    _setText('res-time', _formatTime(duration));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = $('score-fill');
        if (fill) fill.style.width = score + '%';
        _setText('score-pct', score + '%');
      });
    });

    _renderChart(session, questions);

    const sessions = await DB.getRecentSessions(8);
    _renderHistory(sessions);

    if ($('btn-retry')) $('btn-retry').onclick = () =>
      QUIZ.startQuiz(session.batch, session.subject, session.chapter, session.mode);
    if ($('btn-revision-mode')) $('btn-revision-mode').onclick = () =>
      QUIZ.startQuiz(session.batch, session.subject, session.chapter, 'revision');
    if ($('btn-pdf-export')) $('btn-pdf-export').onclick = () => PDF.exportQuestionPaper(questions, session);
    if ($('btn-home-from-results')) $('btn-home-from-results').onclick = () => APP.showScreen('home');
  }

  function _renderChart(session, questions) {
    const chart  = $('chapter-chart');
    if (!chart) return;
    chart.innerHTML = '';

    const byDiff = { easy: { c: 0, t: 0 }, medium: { c: 0, t: 0 }, hard: { c: 0, t: 0 } };
    session.answers.forEach(a => {
      const q = questions.find(q => q.q_id === a.q_id);
      if (!q) return;
      const d = q.difficulty || 'medium';
      byDiff[d].t++;
      if (a.correct) byDiff[d].c++;
    });

    Object.entries(byDiff).forEach(([diff, { c, t }]) => {
      if (!t) return;
      const pct   = Math.round((c / t) * 100);
      const level = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
      const row   = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-label">${diff.charAt(0).toUpperCase() + diff.slice(1)}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar ${level}" style="width:0%" data-pct="${pct}"></div>
        </div>
        <div class="chart-val">${pct}%</div>
      `;
      chart.appendChild(row);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          row.querySelector('.chart-bar')?.style.setProperty('width', pct + '%');
        });
      });
    });
  }

  function _renderHistory(sessions) {
    const list = $('history-list');
    if (!list) return;
    list.innerHTML = '';
    if (!sessions.length) {
      list.innerHTML = '<p style="color:var(--text2);font-size:0.85rem;padding:8px">No history yet</p>';
      return;
    }
    sessions.forEach(s => {
      const item  = document.createElement('div');
      item.className = 'history-item';
      const date  = new Date(s.date).toLocaleDateString();
      const score = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const color = score >= 70 ? 'var(--correct)' : score >= 40 ? 'var(--medium)' : 'var(--wrong)';
      item.innerHTML = `
        <div class="history-info">
          <div class="history-title">${s.subject} › ${s.chapter}</div>
          <div class="history-meta">${date} · ${s.batch} · ${_formatTime(s.duration)}</div>
        </div>
        <div class="history-score" style="color:${color}">${score}%</div>
      `;
      list.appendChild(item);
    });
  }

  function _formatTime(seconds) {
    if (!seconds) return '0m';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  return { show };
})();

window.QUIZ    = QUIZ;
window.RESULTS = RESULTS;
