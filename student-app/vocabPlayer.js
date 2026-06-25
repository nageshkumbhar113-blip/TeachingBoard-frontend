/* ════════════════════════════════════════
   vocabPlayer.js — Vocabulary Test Player
   4 sections per test: Listen, Meaning, Picture, Spelling
   Sequential 20-word batches per batch+subject
════════════════════════════════════════ */

const VOCAB = (() => {
  const ALL_SECTIONS = ['listen', 'meaning', 'picture', 'spelling'];
  let   SECTIONS = [...ALL_SECTIONS];
  const SECTION_LABELS = {
    listen:   'Section 1: Listen',
    meaning:  'Section 2: Meaning',
    picture:  'Section 3: Picture',
    spelling: 'Section 4: Spelling',
  };

  let _batch        = '';
  let _subject      = '';
  let _testNum      = 0;
  let _words        = [];
  let _meaningLang  = 'marathi';
  let _section      = 'listen';
  let _wordIdx      = 0;
  let _scores       = { listen: 0, meaning: 0, picture: 0, spelling: 0 };
  let _wordScores   = {};  // { wordId: { listen: bool, meaning: bool, picture: bool, spelling: bool } }
  let _addWordFillData = null;

  function $id(id) { return document.getElementById(id); }
  const _escHtml = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // ─── Public entry ──────────────────────────────────────────────────────────

  async function openVocabScreen(batch, subject) {
    _batch   = batch   || '';
    _subject = subject || '';

    const screen = $id('screen-vocab');
    if (screen) {
      screen.classList.remove('hidden');
      document.querySelectorAll('.screen').forEach(s => {
        if (s.id !== 'screen-vocab') s.classList.add('hidden');
      });
    }

    // Highlight vocab bottom nav button
    document.querySelectorAll('.bnav-btn').forEach(btn => btn.classList.remove('bnav-active'));
    $id('bnav-vocab')?.classList.add('bnav-active');

    await _loadTestList();
  }

  // ─── Test list ──────────────────────────────────────────────────────────────

  async function _loadTestList() {
    _showView('test-list');

    await _populateSubjectSelect();

    // Update title AFTER subject is resolved
    const titleEl = $id('vocab-list-title');
    if (titleEl) titleEl.textContent = _subject ? `${_subject} — Words` : 'Word Learning';

    // If Learn tab is active, delegate to DICT module
    const dictView = $id('vocab-dict-view');
    if (dictView && !dictView.classList.contains('hidden')) {
      if (window.DICT) await DICT.openDictScreen(_batch, _subject);
      return;
    }

    const grid = $id('vocab-test-grid');
    const empty = $id('vocab-list-empty');

    if (!_subject) {
      if (grid) grid.innerHTML = '';
      if (empty) { empty.textContent = 'Please select a subject.'; empty.classList.remove('hidden'); }
      return;
    }

    if (grid) grid.innerHTML = '<div class="vocab-loading">Loading...</div>';
    if (empty) empty.classList.add('hidden');

    try {
      const res = await API.fetchVocabTestList(_batch, _subject);
      const tests = res.tests || [];

      if (!tests.length) {
        if (grid) grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');

      if (grid) {
        grid.innerHTML = '';
        tests.forEach(t => {
          const card = document.createElement('div');
          card.className = `vocab-test-card ${t.attempted ? (t.passed ? 'vocab-card-pass' : 'vocab-card-done') : 'vocab-card-new'}`;
          const pct = t.total_possible ? Math.round((t.total_score / t.total_possible) * 100) : null;
          card.innerHTML = `
            <div class="vocab-test-num">Test ${t.test_num}</div>
            <div class="vocab-test-range">Words ${t.word_from}–${t.word_to}</div>
            <div class="vocab-test-status">
              ${t.attempted ? `${pct}% ${t.passed ? 'Passed' : 'Done'}` : 'New'}
            </div>`;
          card.addEventListener('click', () => _startTest(t.test_num));
          grid.appendChild(card);
        });
      }
    } catch (err) {
      if (grid) grid.innerHTML = `<div class="vocab-error">${String(err.message||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`;
    }
  }

  async function _populateSubjectSelect() {
    let profile = await API.getStudentProfile().catch(() => null);
    let batches = Array.isArray(profile?.assigned_batches) ? profile.assigned_batches : [];

    // Local profile may be stale (batch assigned after last login) — refresh from server
    if (!batches.length && navigator.onLine && window.API?.fetchStudentMe) {
      try {
        const fresh = await API.fetchStudentMe();
        batches = Array.isArray(fresh?.assigned_batches) ? fresh.assigned_batches : [];
      } catch {}
    }

    if (!_batch && batches.length) _batch = batches[0];

    const sel = $id('vocab-subject-select');
    if (!sel || !_batch) return;

    let subjects = [];
    try {
      const res = await API.fetchVocabSubjects(_batch);
      subjects = res.subjects || [];
    } catch {
      // fallback: local DB (works if admin synced subjects)
      if (window.DB?.getSubjectsByBatch) {
        const rows = await DB.getSubjectsByBatch(_batch).catch(() => []);
        subjects = rows.map(s => s.name).filter(Boolean);
      }
    }

    sel.innerHTML = '<option value="">Select Subject</option>';
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === _subject) opt.selected = true;
      sel.appendChild(opt);
    });

    if (!_subject && subjects.length) {
      _subject = subjects[0];
      sel.value = _subject;
    }
  }

  // ─── Start test ──────────────────────────────────────────────────────────────

  async function _startTest(testNum) {
    _testNum     = testNum;
    _section     = 'listen';
    _wordIdx     = 0;
    _scores      = { listen: 0, meaning: 0, picture: 0, spelling: 0 };
    _wordScores  = {};
    _meaningLang = document.querySelector('input[name="meaning-lang"]:checked')?.value || 'marathi';

    _showView('player');
    const titleEl = $id('vocab-player-title');
    if (titleEl) titleEl.textContent = `Test ${testNum}`;
    $id('vocab-feedback')?.classList.add('hidden');
    $id('vocab-next-btn')?.classList.add('hidden');

    try {
      const res = await API.fetchVocabTest(testNum, _batch, _subject, _meaningLang);
      _words = res.words || [];
      if (!_words.length) {
        APP.toast('No words found for this test', 'error');
        _showView('test-list');
        return;
      }
      const serverSections = Array.isArray(res.active_sections) ? res.active_sections : [];
      SECTIONS = serverSections.filter(s => ALL_SECTIONS.includes(s));
      if (!SECTIONS.length) SECTIONS = [...ALL_SECTIONS];
      _section = SECTIONS[0];
      _wordIdx = 0;
      _scores  = { listen: 0, meaning: 0, picture: 0, spelling: 0 };
      _wordScores = {};
      _renderCurrentQuestion();
    } catch (err) {
      APP.toast(err.message, 'error');
      _showView('test-list');
    }
  }

  // ─── Question rendering ──────────────────────────────────────────────────────

  function _renderCurrentQuestion() {
    const word = _words[_wordIdx];
    if (!word) { _nextSection(); return; }

    const label = $id('vocab-section-label');
    if (label) label.textContent = SECTION_LABELS[_section];

    const progress = $id('vocab-progress-label');
    if (progress) {
      const sectionIdx = SECTIONS.indexOf(_section);
      const total = _words.length * SECTIONS.length;
      const done  = sectionIdx * _words.length + _wordIdx + 1;
      progress.textContent = `${done} / ${total}`;
    }

    $id('vocab-feedback')?.classList.add('hidden');
    $id('vocab-next-btn')?.classList.add('hidden');

    const wordDisplay   = $id('vocab-word-display');
    const phonicsDisplay = $id('vocab-phonics-display');
    const ttsBtn        = $id('vocab-tts-btn');
    const optionsEl     = $id('vocab-options');
    const spellingWrap  = $id('vocab-spelling-input-wrap');

    // Reset
    if (wordDisplay)    wordDisplay.textContent    = '';
    if (phonicsDisplay) phonicsDisplay.textContent = '';
    if (ttsBtn) {
      ttsBtn.classList.add('hidden');
      ttsBtn.classList.remove('vocab-tts-prominent', 'vocab-tts-pulse');
      ttsBtn.innerHTML = '<span aria-hidden="true">&#128264;</span> Listen';
    }
    if (optionsEl) optionsEl.innerHTML = '';
    if (spellingWrap) spellingWrap.classList.add('hidden');

    switch (_section) {
      case 'listen':
        _renderListenQuestion(word);
        break;
      case 'meaning':
        _renderMeaningQuestion(word);
        break;
      case 'picture':
        _renderPictureQuestion(word);
        break;
      case 'spelling':
        _renderSpellingQuestion(word);
        break;
    }
  }

  function _renderListenQuestion(word) {
    const ttsBtn = $id('vocab-tts-btn');
    if (ttsBtn) {
      ttsBtn.classList.remove('hidden');
      ttsBtn.classList.add('vocab-tts-prominent');
      ttsBtn.innerHTML = '<span style="font-size:1.4em">🔊</span> Word ऐका';
      ttsBtn.onclick = () => {
        _speakWord(word.word);
        ttsBtn.classList.remove('vocab-tts-pulse');
      };
    }

    _renderWordVisual($id('vocab-word-display'), word);

    const phonicsDisplay = $id('vocab-phonics-display');
    if (phonicsDisplay) phonicsDisplay.textContent = '👆 वरील button tap करा';

    // Start pulse animation to draw attention to the button
    setTimeout(() => ttsBtn?.classList.add('vocab-tts-pulse'), 100);

    _renderMCQOptions(word, 'meaning');
  }

  function _renderMeaningQuestion(word) {
    const wordDisplay = $id('vocab-word-display');
    if (wordDisplay) wordDisplay.textContent = word.word;

    const phonicsDisplay = $id('vocab-phonics-display');
    if (phonicsDisplay) phonicsDisplay.textContent = word.pronunciation || '';

    _renderMCQOptions(word, 'meaning');
  }

  function _renderPictureQuestion(word) {
    _renderWordVisual($id('vocab-word-display'), word);

    const question = _meaningLang === 'english'
      ? 'What is the correct meaning?'
      : 'योग्य अर्थ निवडा';
    const phonicsDisplay = $id('vocab-phonics-display');
    if (phonicsDisplay) phonicsDisplay.textContent = question;

    _renderMCQOptions(word, 'meaning');
  }

  function _renderSpellingQuestion(word) {
    const wordDisplay = $id('vocab-word-display');
    const meaningText = _meaningLang === 'english' ? word.meaning_en : word.meaning_mr;
    if (wordDisplay) wordDisplay.textContent = meaningText || word.word;

    const phonicsDisplay = $id('vocab-phonics-display');
    if (phonicsDisplay) phonicsDisplay.textContent = word.phonics || '';

    const spellingWrap = $id('vocab-spelling-input-wrap');
    if (spellingWrap) spellingWrap.classList.remove('hidden');

    const input = $id('vocab-spelling-input');
    if (input) { input.disabled = false; input.value = ''; input.focus(); }

    const submitBtn = $id('vocab-spelling-submit');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.onclick = () => _checkSpelling(word);
    }
    if (input) {
      input.onkeydown = e => { if (e.key === 'Enter') _checkSpelling(word); };
    }
  }

  function _renderMCQOptions(correctWord, field) {
    const optionsEl = $id('vocab-options');
    if (!optionsEl) return;

    const getVal = w => (field === 'meaning'
      ? (_meaningLang === 'english' ? w.meaning_en : w.meaning_mr)
      : w.word) || w.word;

    const correctVal = getVal(correctWord);
    const seen = new Set([correctVal]);
    const distractors = [];
    const pool = _words.filter(w => w.word_id !== correctWord.word_id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const shuffled = pool;

    for (const w of shuffled) {
      if (distractors.length >= 3) break;
      const val = getVal(w);
      if (!val || seen.has(val)) continue;
      seen.add(val);
      distractors.push(val);
    }

    while (distractors.length < 3) distractors.push('—');

    const options = [correctVal, ...distractors].sort(() => Math.random() - 0.5);

    optionsEl.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'vocab-option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => _checkMCQ(opt, correctVal, btn));
      optionsEl.appendChild(btn);
    });
  }

  // ─── Answer checking ─────────────────────────────────────────────────────────

  function _checkMCQ(selected, correct, btn) {
    const isCorrect = selected === correct;
    _recordAnswer(isCorrect);

    const optionsEl = $id('vocab-options');
    optionsEl?.querySelectorAll('.vocab-option-btn').forEach(b => {
      b.disabled = true;
      if (b.textContent === correct) b.classList.add('vocab-opt-correct');
      else if (b === btn && !isCorrect) b.classList.add('vocab-opt-wrong');
    });

    _showFeedback(isCorrect, correct);
    _showNextBtn();
  }

  function _checkSpelling(word) {
    const input = $id('vocab-spelling-input');
    const typed = (input?.value || '').trim().toLowerCase();
    const isCorrect = typed === word.word.toLowerCase();
    _recordAnswer(isCorrect);

    if (input) input.disabled = true;
    const submitBtn = $id('vocab-spelling-submit');
    if (submitBtn) submitBtn.disabled = true;

    _showFeedback(isCorrect, word.word);
    _showNextBtn();
  }

  function _recordAnswer(isCorrect) {
    const word = _words[_wordIdx];
    if (!_wordScores[word.word_id]) _wordScores[word.word_id] = {};
    _wordScores[word.word_id][_section] = isCorrect;
    if (isCorrect) _scores[_section]++;
  }

  function _showFeedback(isCorrect, correctAnswer) {
    const fb = $id('vocab-feedback');
    if (!fb) return;
    fb.textContent = isCorrect
      ? 'Correct!'
      : `Correct answer: ${correctAnswer}`;
    fb.className = `vocab-feedback ${isCorrect ? 'vocab-fb-correct' : 'vocab-fb-wrong'}`;
    fb.classList.remove('hidden');
  }

  function _showNextBtn() {
    const btn = $id('vocab-next-btn');
    if (!btn) return;
    btn.classList.remove('hidden');
    btn.textContent = _isLastQuestion() ? 'See Score' : 'Next';
    btn.onclick = _onNext;
  }

  function _isLastQuestion() {
    return _wordIdx >= _words.length - 1 && _section === SECTIONS[SECTIONS.length - 1];
  }

  function _onNext() {
    if (_isLastQuestion()) {
      _submitTest();
    } else {
      _advance();
      _renderCurrentQuestion();
    }
  }

  function _advance() {
    _wordIdx++;
    if (_wordIdx >= _words.length) {
      _wordIdx = 0;
      const sIdx = SECTIONS.indexOf(_section);
      _section = SECTIONS[sIdx + 1] || SECTIONS[SECTIONS.length - 1];
    }
  }

  function _nextSection() {
    const sIdx = SECTIONS.indexOf(_section);
    if (sIdx < SECTIONS.length - 1) {
      _section = SECTIONS[sIdx + 1];
      _wordIdx = 0;
      _renderCurrentQuestion();
    } else {
      _submitTest();
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function _submitTest() {
    _showView('score');

    const totalPossible = _words.length * SECTIONS.length;
    const totalScore = SECTIONS.reduce((sum, s) => sum + _scores[s], 0);
    const pct = Math.round((totalScore / totalPossible) * 100);
    const passed = pct >= 60;

    const totalEl = $id('vocab-score-total');
    if (totalEl) totalEl.textContent = `${totalScore} / ${totalPossible} (${pct}%)`;

    const breakdownEl = $id('vocab-score-breakdown');
    if (breakdownEl) {
      breakdownEl.innerHTML = SECTIONS.map(s => `
        <div class="vocab-breakdown-row">
          <span>${SECTION_LABELS[s]}</span>
          <span>${_scores[s]} / ${_words.length}</span>
        </div>`).join('');
    }

    $id('vocab-pass-badge')?.classList.toggle('hidden', !passed);
    $id('vocab-fail-badge')?.classList.toggle('hidden', passed);

    // Submit to backend (non-blocking)
    try {
      await API.submitVocabAttempt({
        batch:          _batch,
        subject:        _subject,
        test_num:       _testNum,
        meaning_lang:   _meaningLang,
        score_listen:   _scores.listen,
        score_meaning:  _scores.meaning,
        score_picture:  _scores.picture,
        score_spelling: _scores.spelling,
        total_possible: totalPossible,
      });
    } catch (err) {
      console.warn('Vocab attempt submit failed:', err.message);
    }
  }

  // ─── Add unknown word ────────────────────────────────────────────────────────

  function _openAddWord() {
    if (!_subject) {
      APP.toast('Please select a subject first', 'error');
      return;
    }
    const ctx = $id('vocab-add-context');
    if (ctx) ctx.textContent = `Adding to: ${_batch} / ${_subject}`;
    $id('vocab-add-word-backdrop')?.classList.remove('hidden');
    const addInput = $id('vocab-add-word-input');
    if (addInput) addInput.value = '';
    $id('vocab-add-word-err')?.classList.add('hidden');
    $id('vocab-add-word-preview')?.classList.add('hidden');
    const addSubmit = $id('vocab-add-submit');
    if (addSubmit) addSubmit.disabled = true;
    _addWordFillData = null;
    setTimeout(() => $id('vocab-add-word-input')?.focus(), 100);
  }

  async function _autoFillAddWord() {
    const word = ($id('vocab-add-word-input')?.value || '').trim();
    if (!word) return;
    try {
      const res = await API.autoFillWordForStudent(word);
      _addWordFillData = { ...res.data, batch: _batch, subject: _subject };
      const prev = $id('vocab-add-word-preview');
      if (prev) {
        prev.innerHTML = `
          <div><b>Meaning (MR):</b> ${_escHtml(_addWordFillData.meaning_mr || '—')}</div>
          <div><b>Meaning (EN):</b> ${_escHtml(_addWordFillData.meaning_en || '—')}</div>
          <div><b>Phonics:</b> ${_escHtml(_addWordFillData.phonics || '—')}</div>`;
        prev.classList.remove('hidden');
      }
      $id('vocab-add-submit').disabled = false;
    } catch (err) {
      const errEl = $id('vocab-add-word-err');
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
  }

  async function _submitAddWord() {
    if (!_addWordFillData) return;
    const btn = $id('vocab-add-submit');
    if (btn) btn.disabled = true;
    try {
      await API.addStudentWord(_addWordFillData);
      APP.toast('Word added to bank', 'success');
      $id('vocab-add-word-backdrop')?.classList.add('hidden');
    } catch (err) {
      const errEl = $id('vocab-add-word-err');
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
      if (btn) btn.disabled = false;
    }
  }

  // ─── Word visual helper ──────────────────────────────────────────────────────

  function _renderWordVisual(el, word) {
    if (!el) return;
    const vt = word.visual_type || 'word';

    if (vt === 'image' && word.image_url) {
      const img = document.createElement('img');
      img.src = word.image_url;
      img.className = 'vocab-word-img';
      img.alt = word.word;
      img.onerror = () => {
        // Image broken — fall back to emoji SVG, then Unicode, then word text
        if (word.emoji_svg) {
          el.innerHTML = '';
          const ei = document.createElement('img');
          ei.src = word.emoji_svg;
          ei.className = 'vocab-emoji-img';
          ei.alt = word.emoji || word.word;
          el.appendChild(ei);
        } else if (word.emoji) {
          el.innerHTML = `<span class="vocab-word-emoji">${_escHtml(word.emoji)}</span>`;
        } else {
          img.replaceWith(document.createTextNode(word.word));
        }
      };
      el.innerHTML = '';
      el.appendChild(img);

    } else if (vt === 'emoji') {
      if (word.emoji_svg) {
        // OpenEmoji SVG — consistent across all devices
        const img = document.createElement('img');
        img.src = word.emoji_svg;
        img.className = 'vocab-emoji-img';
        img.alt = word.emoji || word.word;
        img.onerror = () => {
          // SVG data URL shouldn't fail, but fallback just in case
          el.innerHTML = `<span class="vocab-word-emoji">${_escHtml(word.emoji || word.word)}</span>`;
        };
        el.innerHTML = '';
        el.appendChild(img);
      } else if (word.emoji) {
        // Emoji set but SVG not cached yet — show Unicode character
        el.innerHTML = `<span class="vocab-word-emoji">${_escHtml(word.emoji)}</span>`;
      } else {
        el.textContent = word.word;
      }

    } else {
      // visual_type === 'word' (default)
      el.textContent = word.word;
    }
  }

  // ─── TTS ────────────────────────────────────────────────────────────────────

  async function _speakWord(text) {
    const str = String(text || '').trim();
    if (!str) return;
    const TTS = window.Capacitor?.Plugins?.TextToSpeech;
    if (!TTS) return;
    try {
      await TTS.speak({ text: str, lang: 'en-US', rate: 1.0, pitch: 1.0, volume: 1.0 });
    } catch (e) {}
  }

  // ─── View management ─────────────────────────────────────────────────────────

  function _showView(name) {
    ['vocab-test-list-view', 'vocab-player-view', 'vocab-score-view'].forEach(id => {
      const el = $id(id);
      if (el) el.classList.toggle('hidden', !id.includes(name));
    });
    // Notes panel is managed by its own tab — always hide when switching views
    $id('vocab-notes-panel')?.classList.add('hidden');
    // When returning to test-list, restore the Learn tab as default
    if (name === 'test-list') {
      $id('vocab-dict-view')?.classList.remove('hidden');
      ['vocab-tab-learn','vocab-tab-tests','vocab-tab-word-tests','vocab-tab-notes']
        .forEach(id => $id(id)?.classList.toggle('vocab-tab-active', id === 'vocab-tab-learn'));
    }
    // FAB only on test-list view
    const fab = $id('vocab-add-word-btn');
    if (fab) fab.classList.toggle('vocab-fab-visible', name === 'test-list');
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function init() {
    // Back button on test list → go home
    $id('vocab-back-btn')?.addEventListener('click', () => {
      if (window.APP?.loadHome) APP.loadHome();
    });

    // Subject select → reload test list
    $id('vocab-subject-select')?.addEventListener('change', async e => {
      _subject = e.target.value;
      if (_subject) await _loadTestList();
    });

    // Meaning language radios
    document.querySelectorAll('input[name="meaning-lang"]').forEach(radio => {
      radio.addEventListener('change', () => {
        _meaningLang = radio.value;
      });
    });

    // Player back
    $id('vocab-player-back')?.addEventListener('click', async () => {
      _showView('test-list');
      await _loadTestList();
    });

    // Score view back
    $id('vocab-score-back')?.addEventListener('click', async () => {
      _showView('test-list');
      await _loadTestList();
    });

    // Retry
    $id('vocab-retry-btn')?.addEventListener('click', () => _startTest(_testNum));

    // Score home
    $id('vocab-score-home-btn')?.addEventListener('click', async () => {
      _showView('test-list');
      await _loadTestList();
    });

    // FAB add-word
    $id('vocab-add-word-btn')?.addEventListener('click', _openAddWord);
    $id('vocab-add-cancel')?.addEventListener('click', () => {
      $id('vocab-add-word-backdrop')?.classList.add('hidden');
    });
    $id('vocab-add-word-autofill')?.addEventListener('click', _autoFillAddWord);
    $id('vocab-add-submit')?.addEventListener('click', _submitAddWord);

    // Tab: Learn ↔ Tests
    function _setVocabTab(activeId) {
      ['vocab-tab-learn','vocab-tab-tests','vocab-tab-word-tests','vocab-tab-notes']
        .forEach(id => $id(id)?.classList.toggle('vocab-tab-active', id === activeId));
    }

    $id('vocab-tab-learn')?.addEventListener('click', () => {
      _setVocabTab('vocab-tab-learn');
      $id('vocab-dict-view')?.classList.remove('hidden');
      $id('vocab-test-grid')?.classList.add('hidden');
      $id('vocab-list-empty')?.classList.add('hidden');
      $id('vocab-notes-panel')?.classList.add('hidden');
      if (window.DICT && _subject) DICT.openDictScreen(_batch, _subject);
    });

    $id('vocab-tab-tests')?.addEventListener('click', () => {
      // Old vocab test system retired — redirect to new Word Tests
      window.WORD_TEST_PLAYER?.openWordTestScreen(_batch, _subject);
    });

    $id('vocab-tab-word-tests')?.addEventListener('click', () => {
      _setVocabTab('vocab-tab-word-tests');
      $id('vocab-notes-panel')?.classList.add('hidden');
      window.WORD_TEST_PLAYER?.openWordTestScreen(_batch, _subject);
    });

    $id('vocab-tab-notes')?.addEventListener('click', () => {
      _setVocabTab('vocab-tab-notes');
      $id('vocab-dict-view')?.classList.add('hidden');
      $id('vocab-test-grid')?.classList.add('hidden');
      $id('vocab-notes-panel')?.classList.remove('hidden');
      if (window.NOTES_PLAYER) {
        window.NOTES_PLAYER.init();
        window.NOTES_PLAYER.loadNotesList(_batch, _subject);
      }
    });

    // Bottom nav Words button — always fetch fresh profile from server so
    // batch is correct even if assigned after last login
    $id('bnav-vocab')?.addEventListener('click', async () => {
      let batches = [];
      if (navigator.onLine && window.API?.fetchStudentMe) {
        try {
          const fresh = await API.fetchStudentMe();
          batches = Array.isArray(fresh?.assigned_batches) ? fresh.assigned_batches : [];
        } catch {}
      }
      if (!batches.length) {
        const profile = await API.getStudentProfile().catch(() => null);
        batches = Array.isArray(profile?.assigned_batches) ? profile.assigned_batches : [];
      }
      const batch = batches[0] || '';
      await openVocabScreen(batch, _subject || '');
    });
  }

  return { init, openVocabScreen, startTest: _startTest };
})();

window.VOCAB = VOCAB;

document.addEventListener('DOMContentLoaded', () => VOCAB.init());
