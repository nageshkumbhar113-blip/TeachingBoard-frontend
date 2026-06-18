/* ════════════════════════════════════════
   testPlayer.js — Student Test Player
   Modes : Practice (instant feedback)
           Exam    (locked, no back-nav)
   Timers: per-question ring  |  full-test bar
   Global: TEST_PLAYER
════════════════════════════════════════ */

const TEST_PLAYER = (() => {
  const $ = id => document.getElementById(id);
  const _setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '';
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

  // ════════════════════════
  // STATE
  // ════════════════════════

  let state = {
    quiz         : null,
    questions    : [],
    current      : 0,
    answers      : {},     // { q_id: { given, correct, time_ms, skipped } }
    mode         : 'practice',
    answered     : false,
    qStartTime   : null,
    startTime    : null,

    perQInterval : null,
    perQRemaining: 0,

    fullInterval : null,
    fullRemaining: 0,
    fullTotal    : 0,

    locked          : false,
    _lockBefore     : null,
    _lockPop        : null,
    _lockKeydown    : null,
    _lockVis        : null,
    _lockContext    : null,
    _tabSwitchCount : 0,
    actionLocked    : false,
    actionLockTimer : null,
  };

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

  // ════════════════════════
  // START TEST
  // ════════════════════════

  async function _resolveQuizForStart(quiz_id) {
    const cachedQuiz = await DB.getQuiz(quiz_id).catch(() => null);

    if (cachedQuiz) {
      // Background-refresh so next open gets latest — don't wait for it
      if (window.SYNC?.refreshQuiz && navigator.onLine) {
        SYNC.refreshQuiz(quiz_id).catch(() => {});
      }
      return cachedQuiz;
    }

    // No cache — try server
    if (navigator.onLine && window.SYNC?.refreshQuiz) {
      return SYNC.refreshQuiz(quiz_id);
    }

    // Offline + no cache → clear error
    const fallback = await DB.getQuiz(quiz_id).catch(() => null);
    if (!fallback) {
      throw new Error('Internet नाही! हा quiz offline साठी download झालेला नाही. एकदा online होऊन quiz उघडा म्हणजे पुढच्या वेळी offline पण चालेल.');
    }
    return fallback;
  }

  async function startTest(quiz_id, mode = 'practice') {
    let quiz = null;
    try {
      quiz = await _resolveQuizForStart(quiz_id);
    } catch (err) {
      console.warn('Quiz refresh failed:', err.message);
      APP.toast(`Could not load quiz: ${err.message}`, 'error');
      return;
    }

    if (!quiz) { APP.toast('Quiz not found', 'error'); return; }

    const hasEmbeddedQuestions = Array.isArray(quiz.questions) && quiz.questions.length > 0;
    const hasSectionRefs = (quiz.sections || []).some(section => section.question_ids?.length);
    if (!hasEmbeddedQuestions && !hasSectionRefs) {
      APP.toast('This quiz has no questions yet', 'error');
      return;
    }

    const questions = await _loadQuizQuestions(quiz);

    if (!questions.length) { APP.toast('Could not load questions', 'error'); return; }

    // Reset state — stop any timers from a previous session first
    _stopAllTimers();
    state.quiz          = quiz;
    state.questions     = questions;
    state.current       = 0;
    state.answers       = {};
    state.mode          = mode;
    state.answered      = false;
    state.qStartTime    = null;
    state.startTime     = Date.now();
    state.locked          = false;
    state.perQInterval    = null;
    state.fullInterval    = null;
    state.perQRemaining   = 0;
    state.fullRemaining   = 0;
    state.fullTotal       = 0;
    state._lockBefore     = null;
    state._lockPop        = null;
    state._lockKeydown    = null;
    state._lockVis        = null;
    state._lockContext    = null;
    state._tabSwitchCount = 0;
    state.actionLocked    = false;

    // Header
    _setText('tp-quiz-title', quiz.title || 'Quiz');
    const badge      = $('tp-mode-badge');
    if (badge) {
    badge.textContent = mode === 'exam' ? '🔒 Exam' : '📖 Practice';
    badge.className   = `quiz-mode-badge tp-mode-${mode}`;
    }

    // Show quiz view, hide results
    $('tp-quiz-view')?.classList.remove('hidden');
    $('tp-results-view')?.classList.add('hidden');

    // Prev / Skip buttons — hidden in exam mode
    $('tp-prev')?.classList.toggle('hidden', mode === 'exam');
    $('tp-skip')?.classList.toggle('hidden', mode === 'exam');

    if (mode === 'exam') _lockExamMode();

    APP.showScreen('test-player');
    APP.setBreadcrumb(quiz.title || 'Test');

    // Full-test timer
    if (quiz.timer_mode === 'full_test' && quiz.timer_value > 0) {
      state.fullTotal = quiz.timer_value;
      _startFullTimer(quiz.timer_value);
    }

    _renderQuestion();
  }

  // ════════════════════════
  // LOAD QUESTIONS
  // ════════════════════════

  function _decorateQuestionForPlay(question, quiz, section = {}, sectionIndex = 0) {
    const posMarks = section.positive_marks ?? quiz.positive_marks ?? 1;
    const negMarks = section.negative_marks ?? quiz.negative_marks ?? 0;
    const secTimer = section.timer ?? quiz.timer_value ?? 30;

    return {
      ...question,
      _secIdx  : sectionIndex,
      _secLabel: section.label || `Section ${sectionIndex + 1}`,
      _secType : section.type || question.type || 'mcq',
      _posMarks: posMarks,
      _negMarks: negMarks,
      _secTimer: secTimer,
    };
  }

  async function _loadQuizQuestions(quiz) {
    const embeddedQuestions = Array.isArray(quiz.questions)
      ? quiz.questions.filter(Boolean)
      : [];

    if (embeddedQuestions.length) {
      const qMap = new Map(embeddedQuestions.map(question => [question.q_id, question]));
      const sections = Array.isArray(quiz.sections) && quiz.sections.length
        ? quiz.sections
        : [{
            id           : `sec_${quiz.quiz_id}_1`,
            label        : 'Section A',
            type         : embeddedQuestions.every(question => question.type === embeddedQuestions[0]?.type)
              ? embeddedQuestions[0]?.type || 'mcq'
              : 'mcq',
            question_ids : embeddedQuestions.map(question => question.q_id),
            timer        : quiz.timer_value ?? 30,
            positive_marks: quiz.positive_marks ?? 1,
            negative_marks: quiz.negative_marks ?? 0,
          }];

      const flat = [];
      sections.forEach((section, sectionIndex) => {
        const ids = Array.isArray(section.question_ids) && section.question_ids.length
          ? section.question_ids
          : embeddedQuestions.map(question => question.q_id);

        ids.forEach(q_id => {
          const question = qMap.get(q_id);
          if (!question) return;
          flat.push(_decorateQuestionForPlay(question, quiz, section, sectionIndex));
        });
      });

      const uniqueFlat = flat.length
        ? flat
        : embeddedQuestions.map((question, index) =>
            _decorateQuestionForPlay(question, quiz, { label: 'Section A', type: question.type || 'mcq' }, index)
          );

      return quiz.shuffle ? _shuffle(uniqueFlat) : uniqueFlat;
    }

    const batchQs = await DB.getQuestionsByBatch(quiz.batch || '');
    const allQs   = batchQs.length ? batchQs : await DB.getAllQuestions();
    const qMap    = Object.fromEntries(allQs.map(q => [q.q_id, q]));
    const flat    = [];

    (quiz.sections || []).forEach((section, sectionIndex) => {
      (section.question_ids || []).forEach(q_id => {
        const question = qMap[q_id];
        if (!question) return;
        flat.push(_decorateQuestionForPlay(question, quiz, section, sectionIndex));
      });
    });

    return quiz.shuffle ? _shuffle(flat) : flat;
  }

  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ════════════════════════
  // RENDER QUESTION
  // ════════════════════════

  async function _renderQuestion() {
    _stopPerQTimer();
    state.answered   = false;
    state.qStartTime = Date.now();

    const q     = state.questions[state.current];
    const total = state.questions.length;
    if (!q) {
      console.warn('Missing question at index:', state.current);
      if (state.current < state.questions.length - 1) {
        state.current++;
        _renderQuestion();
      } else {
        _submitTest();
      }
      return;
    }

    // Progress
    const pct = (state.current / total) * 100;
    const progressFill = $('tp-progress-fill');
    if (progressFill) {
      progressFill.style.width = `${pct}%`;
      progressFill.setAttribute('aria-valuenow', Math.round(pct));
    }
    _setText('tp-progress-text', `${state.current + 1} / ${total}`);
    _setText('tp-q-number', `Q${state.current + 1}`);

    // Section + marks
    _setText('tp-section-label', q._secLabel || '');
    $('tp-q-marks').textContent       = `+${q._posMarks} / −${q._negMarks}`;

    // Difficulty badge
    const diff = $('tp-diff-badge');
    if (diff) {
      diff.textContent = q.difficulty
        ? q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1) : '';
      diff.className = `diff-badge ${q.difficulty || ''}`;
    }

    // Question text
    _setText('tp-q-text', q.question || '');

    // Image
    const imgWrap = $('tp-q-image-wrap');
    if (q.image) {
      const qAtLoad = q;   // capture to detect stale render
      _resolveImageSrc(q.image).then(url => {
        if (state.questions[state.current] !== qAtLoad) return; // navigated away
        const src = url || null;
        const img = $('tp-q-image');
        if (src && img) {
          img.src = src;
          imgWrap?.classList.remove('hidden');
        } else {
          imgWrap?.classList.add('hidden');
        }
      }).catch(() => imgWrap?.classList.add('hidden'));
    } else {
      imgWrap?.classList.add('hidden');
    }

    // Live score
    _updateLiveScore();

    // Clear inputs + feedback
    _hideAllInputs();

    // Render by type
    const type = q.type || q._secType || 'mcq';
    if      (type === 'mcq') await _renderMCQ(q);
    else if (type === 'tf')  _renderTF(q);
    else if (type === 'fib') _renderFIB(q);
    else                     await _renderMCQ(q);

    // Restore previous answer on back-nav
    const prev = state.answers[q.q_id];
    if (prev) {
      state.answered = true;
      if (state.mode === 'practice' && !prev.skipped) {
        _showFeedback(prev.correct, q.answer, _getAnswerFeedbackText(q, q.answer));
      }
    }

    // Card animation
    const card = $('tp-question-card');
    if (card) {
      card.style.animation = 'none';
      void card.offsetHeight;
      card.style.animation = 'cardIn 0.25s ease';
    }

    // Per-question timer
    if (!prev && state.quiz?.timer_mode === 'per_question') {
      const secs = q._secTimer > 0 ? q._secTimer : 0;
      if (secs > 0) _startPerQTimer(secs);
    }
  }

  function _hideAllInputs() {
    $('tp-options-grid')?.classList.add('hidden');
    $('tp-tf-grid')?.classList.add('hidden');
    $('tp-fib-wrap')?.classList.add('hidden');
    $('tp-feedback-bar')?.classList.add('hidden');
  }

  // ════════════════════════
  // MCQ
  // ════════════════════════

  async function _renderMCQ(q) {
    const grid = $('tp-options-grid');
    if (!grid) return;
    grid.classList.remove('hidden');
    grid.innerHTML = '';

    const prev = state.answers[q.q_id];
    for (const [key] of Object.entries(q.options || {})) {
      if (!_hasOptionContent(q, key)) continue;
      const btn = document.createElement('button');
      btn.className       = 'option-btn';
      btn.dataset.key     = key;
      btn.dataset.kbIndex = grid.children.length + 1;
      btn.innerHTML = await _buildOptionMarkup(q, key);

      if (prev) {
        btn.disabled = true;
        if (key === q.answer)                          btn.classList.add('correct');
        else if (key === prev.given && !prev.correct)  btn.classList.add('wrong');
      } else {
        btn.addEventListener('click', () => _selectMCQ(btn, key, q));
      }
      grid.appendChild(btn);
    }
  }

  function _selectMCQ(btn, selected, q) {
    if (state.answered || _beginActionLock()) return;
    state.answered = true;
    _stopPerQTimer();

    const isCorrect = selected === q.answer;
    $('tp-options-grid')?.querySelectorAll('.option-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.key === q.answer)                        b.classList.add('correct');
      else if (b.dataset.key === selected && !isCorrect)     b.classList.add('wrong');
    });

    _recordAnswer(q, selected, isCorrect);
    if (state.mode === 'practice') _showFeedback(isCorrect, q.answer, _getAnswerFeedbackText(q, q.answer));
    if (state.mode === 'exam')     setTimeout(_nextQ, 700);
  }

  // ════════════════════════
  // TRUE / FALSE
  // ════════════════════════

  function _renderTF(q) {
    const grid = $('tp-tf-grid');
    if (!grid) return;
    grid?.classList.remove('hidden');
    const prev = state.answers[q.q_id];

    const tfAnswerText = q.options?.[q.answer] || q.answer;
    grid?.querySelectorAll('.tf-btn').forEach(btn => {
      btn.disabled  = !!prev;
      btn.className = 'tf-btn';
      if (prev) {
        if (btn.dataset.val === tfAnswerText)                     btn.classList.add('correct');
        else if (btn.dataset.val === prev.given && !prev.correct) btn.classList.add('wrong');
      } else {
        btn.onclick = () => _selectTF(btn, btn.dataset.val, q);
      }
    });
  }

  function _selectTF(btn, selected, q) {
    if (state.answered || _beginActionLock()) return;
    state.answered = true;
    _stopPerQTimer();

    const tfAnswerText = q.options?.[q.answer] || q.answer;
    const isCorrect = selected === tfAnswerText;
    $('tp-tf-grid')?.querySelectorAll('.tf-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.val === tfAnswerText)                   b.classList.add('correct');
      else if (b.dataset.val === selected && !isCorrect)    b.classList.add('wrong');
    });

    _recordAnswer(q, selected, isCorrect);
    if (state.mode === 'practice') _showFeedback(isCorrect, tfAnswerText);
    if (state.mode === 'exam')     setTimeout(_nextQ, 700);
  }

  // ════════════════════════
  // FILL IN BLANK
  // ════════════════════════

  function _renderFIB(q) {
    $('tp-fib-wrap')?.classList.remove('hidden');
    const inp  = $('tp-fib-input');
    const prev = state.answers[q.q_id];
    if (!inp) return;

    if (prev) {
      inp.value    = prev.given || '';
      inp.disabled = true;
      inp.style.borderColor = prev.correct ? 'var(--correct)' : 'var(--wrong)';
    } else {
      inp.value             = '';
      inp.disabled          = false;
      inp.style.borderColor = '';
      inp.focus();
      $('tp-fib-submit').onclick = () => _submitFIB(q);
      inp.onkeydown = e => { if (e.key === 'Enter') _submitFIB(q); };
    }
  }

  function _submitFIB(q) {
    if (state.answered || _beginActionLock()) return;
    const val = $('tp-fib-input')?.value.trim();
    if (!val) return;
    state.answered = true;
    _stopPerQTimer();

    const isCorrect = val.toLowerCase() === String(q.answer || '').toLowerCase().trim();
    const inp = $('tp-fib-input');
    inp.disabled          = true;
    inp.style.borderColor = isCorrect ? 'var(--correct)' : 'var(--wrong)';

    _recordAnswer(q, val, isCorrect);
    if (state.mode === 'practice') _showFeedback(isCorrect, q.answer);
  }

  // ════════════════════════
  // ANSWER RECORDING
  // ════════════════════════

  function _recordAnswer(q, given, isCorrect) {
    const time_ms = Date.now() - (state.qStartTime || Date.now());
    state.answers[q.q_id] = { given, correct: isCorrect, time_ms };
    _updateLiveScore();
  }

  async function _persistQuizQuestionUpdate(q_id, updater) {
    if (!state.quiz || !Array.isArray(state.quiz.questions)) return null;

    let updatedQuestion = null;
    const nextQuestions = state.quiz.questions.map(question => {
      if (question.q_id !== q_id) return question;
      updatedQuestion = { ...question, ...updater(question) };
      return updatedQuestion;
    });

    if (!updatedQuestion) return null;

    state.quiz = { ...state.quiz, questions: nextQuestions };
    state.questions = state.questions.map(question =>
      question.q_id === q_id ? { ...question, ...updatedQuestion } : question
    );

    await DB.saveQuiz({
      ...state.quiz,
      questions: nextQuestions,
    }, { queueOnFailure: false }).catch(() => {});

    return updatedQuestion;
  }

  function _showFeedback(isCorrect, correctAns, correctText) {
    const bar = $('tp-feedback-bar');
    const icon = $('tp-feedback-icon');
    const text = $('tp-feedback-text');
    if (!bar || !icon || !text) return;
    bar.className = `feedback-bar ${isCorrect ? 'correct-fb' : 'wrong-fb'}`;
    $('tp-feedback-icon').textContent = isCorrect ? '✅' : '❌';
    $('tp-feedback-text').textContent = isCorrect
      ? 'Correct!'
      : `Wrong — Answer: ${correctAns}${correctText ? ` (${correctText})` : ''}`;
    bar.classList.remove('hidden');
  }

  function _updateLiveScore() {
    const score = _calcRawScore();
    const el    = $('tp-live-score');
    if (el) el.textContent = `${score} pts`;
  }

  function _calcRawScore() {
    let score = 0;
    state.questions.forEach(q => {
      const a = state.answers[q.q_id];
      if (!a || a.skipped) return;
      if (a.correct) score += (q._posMarks ?? 1);
      else           score -= (q._negMarks ?? 0);
    });
    return Math.round(score * 100) / 100;
  }

  // ════════════════════════
  // NAVIGATION
  // ════════════════════════

  function _nextQ() {
    if (_beginActionLock()) return;
    if (!state.answered) {
      const q = state.questions[state.current];
      if (q) state.answers[q.q_id] = { given: null, correct: false, time_ms: 0, skipped: true };
    }
    _advanceToNext();
  }

  function _prevQ() {
    if (_beginActionLock()) return;
    if (state.mode === 'exam') return;
    if (state.current > 0) { state.current--; _renderQuestion(); }
  }

  function _skipQ() {
    if (_beginActionLock()) return;
    // Only record skip if not already answered — prevents overwriting a real answer
    if (!state.answered) {
      const q = state.questions[state.current];
      if (q) state.answers[q.q_id] = { given: null, correct: false, time_ms: 0, skipped: true };
      state.answered = true;
      _updateLiveScore();
    }
    _advanceToNext();
  }

  function _advanceToNext() {
    if (state.current < state.questions.length - 1) {
      state.current++;
      _renderQuestion();
    } else {
      _submitTest();
    }
  }

  // ════════════════════════
  // PER-QUESTION RING TIMER
  // ════════════════════════

  function _startPerQTimer(seconds) {
    if (seconds <= 0) return;
    _stopPerQTimer();  // clear any existing interval before starting a new one
    const ring  = $('tp-ring-fill');
    const wrap  = $('tp-timer-wrap');
    const count = $('tp-timer-count');
    const circ  = 2 * Math.PI * 28;

    state.perQRemaining = seconds;
    wrap?.classList.remove('hidden');
    if (count) count.textContent = _formatTimerValue(seconds);
    if (ring) {
      ring.style.strokeDasharray  = circ;
      ring.style.strokeDashoffset = 0;
      ring.classList.remove('urgent');
    }

    state.perQInterval = setInterval(() => {
      state.perQRemaining--;
      if (count) count.textContent = _formatTimerValue(state.perQRemaining);
      if (ring) {
        ring.style.strokeDashoffset = circ * (1 - state.perQRemaining / seconds);
        if (state.perQRemaining <= 5) ring.classList.add('urgent');
      }
      if (state.perQRemaining <= 0) {
        _stopPerQTimer();
        if (!state.answered) _onPerQTimeout();
      }
    }, 1000);
  }

  function _stopPerQTimer() {
    if (state.perQInterval) { clearInterval(state.perQInterval); state.perQInterval = null; }
    if (!state.fullInterval) $('tp-timer-wrap')?.classList.add('hidden');
  }

  function _onPerQTimeout() {
    state.answered = true;
    const q = state.questions[state.current];

    // Lock MCQ options
    $('tp-options-grid')?.querySelectorAll('.option-btn').forEach(b => {
      b.disabled = true;
      if (b.dataset.key === q?.answer) b.classList.add('correct');
    });

    // Lock TF buttons
    $('tp-tf-grid')?.querySelectorAll('.tf-btn').forEach(b => {
      b.disabled = true;
      const tfAns = q?.options?.[q?.answer] || q?.answer;
      if (b.dataset.val === tfAns) b.classList.add('correct');
    });

    // Lock FIB input
    const fibInp = $('tp-fib-input');
    if (fibInp) fibInp.disabled = true;

    const bar = $('tp-feedback-bar');
    const icon = $('tp-feedback-icon');
    const text = $('tp-feedback-text');
    if (!bar || !icon || !text) return;
    bar.className = 'feedback-bar wrong-fb';
    $('tp-feedback-icon').textContent = '⏰';
    const answerText = _getAnswerFeedbackText(q, q?.answer);
    $('tp-feedback-text').textContent = `Time up! Answer: ${q?.answer || ''}${answerText ? ` (${answerText})` : ''}`;
    bar.classList.remove('hidden');

    if (q) state.answers[q.q_id] = { given: null, correct: false, time_ms: 0, skipped: true };

    // Strict timer: in exam mode auto-advance after showing the time-up message
    if (state.mode === 'exam') {
      setTimeout(_advanceToNext, 1500);
    }
  }

  // ════════════════════════
  // FULL-TEST BAR TIMER
  // ════════════════════════

  function _startFullTimer(seconds) {
    if (state.fullInterval) {
      clearInterval(state.fullInterval);
      state.fullInterval = null;
    }
    state.fullRemaining = seconds;
    state.fullTotal     = seconds;
    $('tp-full-timer-wrap')?.classList.remove('hidden');
    $('tp-timer-wrap')?.classList.add('hidden');

    const fill = $('tp-full-timer-fill');
    const text = $('tp-full-timer-text');

    const refresh = () => {
      const m   = Math.floor(state.fullRemaining / 60);
      const s   = state.fullRemaining % 60;
      const pct = (state.fullRemaining / state.fullTotal) * 100;
      if (text) text.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (fill) {
        fill.style.width = pct + '%';
        fill.classList.toggle('urgent', state.fullRemaining <= 60);
      }
    };

    refresh();
    state.fullInterval = setInterval(() => {
      state.fullRemaining--;
      refresh();
      if (state.fullRemaining <= 0) {
        _stopAllTimers();
        APP.toast('⏰ Time up! Auto-submitting…', 'info');
        _submitTest();
      }
    }, 1000);
  }

  function _stopAllTimers() {
    _stopPerQTimer();
    if (state.fullInterval) { clearInterval(state.fullInterval); state.fullInterval = null; }
    $('tp-full-timer-wrap')?.classList.add('hidden');
  }

  // ════════════════════════
  // EXAM LOCK
  // ════════════════════════

  function _lockExamMode() {
    state.locked = true;
    document.documentElement.requestFullscreen?.().catch(() => {});

    // 1. Prevent tab/window close and reload via browser UI
    state._lockBefore = e => {
      e.preventDefault();
      e.returnValue = 'Exam in progress! Leaving will submit your test.';
      return e.returnValue;
    };

    // 2. Trap browser back button — re-push the current URL each time
    state._lockPop = () => {
      history.pushState(null, '', window.location.href);
      APP.toast('⚠️ Back navigation is locked during exam', 'error');
    };

    // 3. Block F5, Ctrl+R (keyboard reload) and devtools shortcuts
    state._lockKeydown = e => {
      const key = e.key;
      if (
        key === 'F5' ||
        (e.ctrlKey && (key === 'r' || key === 'R')) ||
        key === 'F12' ||
        (e.ctrlKey && e.shiftKey && 'ijcIJC'.includes(key))
      ) {
        e.preventDefault();
        if (key === 'F5' || key === 'r' || key === 'R') {
          APP.toast('⚠️ Reload is blocked during exam', 'error');
        }
      }
    };

    // 4. Detect tab switching — warn on first two, auto-submit on third
    state._tabSwitchCount = 0;
    state._lastTabSwitchAt = 0;
    state._lockVis = () => {
      if (!document.hidden || !state.locked) return;
      // Debounce: ignore rapid re-fires within 2 seconds (keyboard/dialog events)
      const now = Date.now();
      if (now - state._lastTabSwitchAt < 2000) return;
      state._lastTabSwitchAt = now;
      state._tabSwitchCount++;
      const remaining = 3 - state._tabSwitchCount;
      if (state._tabSwitchCount >= 3) {
        APP.toast('⚠️ Tab switching limit reached — submitting exam', 'error');
        setTimeout(_submitTest, 1500);
      } else {
        APP.toast(
          `⚠️ Tab switch detected (${state._tabSwitchCount}/3) — ${remaining} more switch${remaining === 1 ? '' : 'es'} will auto-submit`,
          'error'
        );
      }
    };

    // 5. Block right-click context menu
    state._lockContext = e => e.preventDefault();

    window.addEventListener('beforeunload',       state._lockBefore);
    window.addEventListener('popstate',           state._lockPop);
    document.addEventListener('keydown',          state._lockKeydown, true);
    document.addEventListener('visibilitychange', state._lockVis);
    document.addEventListener('contextmenu',      state._lockContext);

    // Seed the history stack so the first back press is trapped
    history.pushState(null, '', window.location.href);
  }

  function _unlockExamMode() {
    if (!state.locked) return;
    state.locked = false;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    if (state._lockBefore)  window.removeEventListener('beforeunload',       state._lockBefore);
    if (state._lockPop)     window.removeEventListener('popstate',           state._lockPop);
    if (state._lockKeydown) document.removeEventListener('keydown',          state._lockKeydown, true);
    if (state._lockVis)     document.removeEventListener('visibilitychange', state._lockVis);
    if (state._lockContext) document.removeEventListener('contextmenu',      state._lockContext);
  }

  // ════════════════════════
  // SUBMIT & RESULTS
  // ════════════════════════

  async function _submitTest() {
    _stopAllTimers();
    _unlockExamMode();

    const qs        = state.questions;
    const quiz      = state.quiz;
    const timeTaken = Math.round((Date.now() - state.startTime) / 1000);

    let rawScore = 0, correct = 0, wrong = 0, skipped = 0;
    const answerLog = [];

    qs.forEach(q => {
      const a = state.answers[q.q_id];
      if (!a || a.skipped || a.given === null) {
        skipped++;
        answerLog.push({ q_id: q.q_id, given: null, correct: false, time_ms: 0 });
      } else if (a.correct) {
        correct++;
        rawScore += (q._posMarks ?? 1);
        answerLog.push({ q_id: q.q_id, given: a.given, correct: true,  time_ms: a.time_ms || 0 });
      } else {
        wrong++;
        rawScore -= (q._negMarks ?? 0);
        answerLog.push({ q_id: q.q_id, given: a.given, correct: false, time_ms: a.time_ms || 0 });
      }
    });

    const score    = Math.max(0, Math.round(rawScore * 100) / 100);
    const maxScore = qs.reduce((s, q) => s + (q._posMarks ?? 1), 0);
    const percent  = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    const [studentName, studentProfile] = await Promise.all([
      DB.getSetting('student_name', '').catch(() => ''),
      DB.getSetting('student_profile', null).catch(() => null),
    ]);

    const attempt = {
      quiz_id     : quiz.quiz_id,
      quiz_title  : quiz.title    || 'Quiz',
      batch       : quiz.batch    || '',
      subject     : quiz.subject  || '',
      chapter     : quiz.chapter  || '',
      student_name: String(studentName || '').trim(),
      student_code: String(studentProfile?.student_code || '').trim().toUpperCase(),
      mode        : state.mode,
      answers     : answerLog,
      score, max_score: maxScore, percent,
      correct, wrong, skipped,
      time_taken  : timeTaken,
      date        : new Date().toISOString(),
      synced      : false,
      pending_sync: navigator.onLine,
      sync_error  : '',
    };

    let storedAttempt = attempt;
    try {
      storedAttempt = await DB.saveTestAttempt(attempt);
    } catch (err) {
      console.error('DB write failed:', err);
      APP.toast('Offline save failed', 'error');
    }

    // Push to server (non-blocking — queued if offline)
    SYNC.submitAttempt(storedAttempt).catch(err => {
      console.warn('Submit attempt sync failed:', err?.message);
      APP.toast('Result save pending — Internet आल्यावर sync होईल', 'info');
    });

    _showResults(storedAttempt, qs);
  }

  function _showResults(attempt, questions) {
    $('tp-quiz-view')?.classList.add('hidden');
    $('tp-results-view')?.classList.remove('hidden');

    const { correct, wrong, skipped, score, max_score, percent, time_taken } = attempt;
    const emoji = percent >= 80 ? '🏆' : percent >= 60 ? '⭐' : percent >= 40 ? '📚' : '💪';

    _setText('tp-res-emoji', emoji);
    _setText('tp-res-title', state.quiz?.title || 'Quiz');
    _setText('tp-res-correct', correct);
    _setText('tp-res-wrong', wrong);
    _setText('tp-res-skip', skipped);
    _setText('tp-res-score', `${score} / ${max_score}`);
    _setText('tp-res-time', _fmtTime(time_taken));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = $('tp-score-fill');
        if (fill) fill.style.width = percent + '%';
        _setText('tp-score-pct', percent + '%');
      });
    });

    _renderSectionChart(attempt, questions);

    const reviewWrap = $('tp-wrong-review-wrap');
    if (reviewWrap) {
      if (state.mode === 'practice') {
        reviewWrap.classList.remove('hidden');
        _renderWrongReview(attempt, questions);
      } else {
        reviewWrap.classList.add('hidden');
      }
    }

    $('tp-btn-retry').onclick = () => startTest(state.quiz.quiz_id, state.mode);
    $('tp-btn-home').onclick  = () => { APP.showScreen('home'); APP.loadHome(); };
    $('tp-btn-weak').onclick  = async () => {
      const weakAnswers = attempt.answers.filter(a => !a.correct && a.given !== null);
      if (!weakAnswers.length) { APP.toast('No wrong answers — great job!', 'success'); return; }

      const saves = weakAnswers.map(answer =>
        _persistQuizQuestionUpdate(answer.q_id, () => ({ flagged: true }))
      );
      await Promise.all(saves);
      APP.toast(`${weakAnswers.length} weak question${weakAnswers.length > 1 ? 's' : ''} flagged for revision`, 'info');
      APP.showScreen('home');
    };
  }

  async function _flagCurrentQuestion() {
    const q = state.questions[state.current];
    if (!q?.q_id) return;
    const updated = await _persistQuizQuestionUpdate(q.q_id, question => ({
      flagged: !question.flagged,
    }));
    const isFlagged = !!updated?.flagged;
    q.flagged = isFlagged;
    APP.toast(isFlagged ? '🚩 Flagged for revision' : 'Flag removed', 'info');
  }

  function _renderSectionChart(attempt, questions) {
    const container = $('tp-section-chart');
    if (!container) return;
    container.innerHTML = '';

    const ansMap = new Map(attempt.answers.map(a => [a.q_id, a]));

    const secData = {};
    questions.forEach(q => {
      const lbl = q._secLabel || 'Section';
      if (!secData[lbl]) secData[lbl] = { correct: 0, total: 0 };
      secData[lbl].total++;
      if (ansMap.get(q.q_id)?.correct) secData[lbl].correct++;
    });

    Object.entries(secData).forEach(([label, { correct, total }]) => {
      const pct   = total > 0 ? Math.round((correct / total) * 100) : 0;
      const level = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
      const row   = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <div class="chart-label">${label}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar ${level}" style="width:0%" data-pct="${pct}"></div>
        </div>
        <div class="chart-val">${pct}%</div>
      `;
      container.appendChild(row);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          row.querySelector('.chart-bar')?.style.setProperty('width', pct + '%');
        });
      });
    });
  }

  function _renderWrongReview(attempt, questions) {
    const container = $('tp-wrong-list');
    if (!container) return;

    const wrongs = attempt.answers.filter(a => !a.correct && a.given !== null);
    if (!wrongs.length) {
      container.innerHTML = '<p style="color:var(--correct);font-weight:600;padding:10px 0">🎉 Perfect — no wrong answers!</p>';
      return;
    }

    const qMap = new Map(questions.map(q => [q.q_id, q]));

    container.innerHTML = '';
    wrongs.forEach((a, i) => {
      const q = qMap.get(a.q_id);
      if (!q) return;
      const div = document.createElement('div');
      div.className = 'tp-wrong-item';
      div.innerHTML = `
        <div class="tp-wrong-header">
          <span class="tp-wrong-num">✗ ${i + 1}</span>
          <span class="tp-wrong-sec">${q._secLabel || ''}</span>
        </div>
        <div class="tp-wrong-qtext">${q.question || (q.image ? '[Image Question]' : '')}</div>
        <div class="tp-wrong-ans-row">
          <span class="tp-ans-given">Your: ${a.given || '—'}</span>
          <span class="tp-ans-correct">
            Correct: ${q.answer}${_getAnswerFeedbackText(q, q.answer) ? ` — ${_getAnswerFeedbackText(q, q.answer)}` : ''}
          </span>
        </div>
      `;
      container.appendChild(div);
    });
  }

  function _fmtTime(sec) {
    if (!sec) return '0s';
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  // ════════════════════════
  // KEYBOARD SHORTCUTS
  // ════════════════════════

  function _initKeyboard() {
    document.addEventListener('keydown', e => {
      const screen = document.querySelector('.screen:not(.hidden)')?.id;
      if (screen !== 'screen-test-player') return;
      if ($('tp-quiz-view')?.classList.contains('hidden')) return;
      if (document.querySelector('.modal-overlay:not(.hidden)')) return;
      if (_isTypingTarget(e.target)) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'Enter'     : _nextQ(); break;
        case 'ArrowLeft' : _prevQ(); break;
        case 'n':
        case 'N':
          _nextQ();
          break;
        case 'p':
        case 'P':
          _prevQ();
          break;
        case '1': _clickOptionByIdx(0); break;
        case '2': _clickOptionByIdx(1); break;
        case '3': _clickOptionByIdx(2); break;
        case '4': _clickOptionByIdx(3); break;
        case 's':
        case 'S':
          _skipQ();
          break;
        case 'f':
        case 'F':
          _flagCurrentQuestion();
          break;
        case ' ':
          e.preventDefault();
          if (!state.answered) _onPerQTimeout();
          break;
      }
    });
  }

  function _clickOptionByIdx(i) {
    if (state.answered) return;
    const btns = $('tp-options-grid')?.querySelectorAll('.option-btn:not(:disabled)');
    if (btns?.[i]) btns[i].click();
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
    $('tp-next')?.addEventListener('click', _nextQ);
    $('tp-prev')?.addEventListener('click', _prevQ);
    $('tp-skip')?.addEventListener('click', _skipQ);

    // Cleanup timers + exam lock if user navigates away mid-test via the top Home button
    $('btn-home')?.addEventListener('click', () => {
      if (APP.currentScreen() === 'test-player') {
        _stopAllTimers();
        _unlockExamMode();
      }
    });
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, startTest };
})();

window.TEST_PLAYER = TEST_PLAYER;
