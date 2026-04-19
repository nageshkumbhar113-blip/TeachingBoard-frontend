/* ════════════════════════════════════════
   testBuilder.js — Quiz / Test Builder
   3-Step Wizard: Meta → Questions → Preview
   Global: TEST_BUILDER
════════════════════════════════════════ */

const TEST_BUILDER = (() => {
  const $ = id => document.getElementById(id);

  // ════════════════════════
  // STATE
  // ════════════════════════

  let state = {
    quiz              : null,
    step              : 1,
    sections          : [],
    activeSection     : 0,
    bankQuestions     : [],
    filters           : { subject: '', chapter: '', difficulty: '' },
    previewShowAnswers: true,
  };

  // ════════════════════════
  // OPEN / CLOSE
  // ════════════════════════

  async function open(quiz_id = null) {
    if (quiz_id) {
      const existing = await DB.getQuiz(quiz_id);
      if (!existing) { APP.toast('Quiz not found', 'error'); return; }
      state.quiz     = existing;
      state.sections = JSON.parse(JSON.stringify(existing.sections || []));
    } else {
      state.quiz     = null;
      state.sections = [
        { id: 'sec_1', label: 'Section A', type: 'mcq',
          question_ids: [], timer: 30, positive_marks: 1, negative_marks: 0 },
      ];
    }

    state.step               = 1;
    state.activeSection      = 0;
    state.bankQuestions      = [];
    state.filters            = { subject: '', chapter: '', difficulty: '' };
    state.previewShowAnswers = true;

    $('tb-heading').textContent = quiz_id ? 'Edit Quiz' : 'Create Quiz';
    $('test-builder-overlay').classList.remove('hidden');
    _renderStep(1);
  }

  function close() {
    $('test-builder-overlay').classList.add('hidden');
    state.quiz     = null;
    state.sections = [];
  }

  // ════════════════════════
  // STEP ROUTER
  // ════════════════════════

  function _renderStep(n) {
    state.step = n;
    document.querySelectorAll('.tb-step-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 === n);
      dot.classList.toggle('done',   i + 1 <  n);
    });
    if      (n === 1) _renderStep1();
    else if (n === 2) _renderStep2();
    else if (n === 3) _renderStep3();
  }

  // ════════════════════════
  // STEP 1 — Quiz Meta
  // ════════════════════════

  function _renderStep1() {
    const q = state.quiz;

    $('tb-body').innerHTML = `
      <div class="tb-form">
        <p class="tb-step-label">📋 Quiz Details</p>
        <div class="tb-form-grid">
          <div class="tb-field">
            <label>Quiz Title *</label>
            <input id="tb-title" class="admin-input"
              placeholder="e.g. Chapter 3 — Photosynthesis Test"
              value="${_esc(q?.title)}">
          </div>
          <div class="tb-field">
            <label>School Name</label>
            <input id="tb-school" class="admin-input"
              placeholder="e.g. Bal Vidya Mandir"
              value="${_esc(q?.school_name)}">
          </div>
          <div class="tb-field">
            <label>Class / Batch *</label>
            <select id="tb-batch" class="admin-select">
              <option value="">Select Class</option>
            </select>
          </div>
          <div class="tb-field">
            <label>Subject *</label>
            <input id="tb-subject" class="admin-input"
              placeholder="e.g. Science"
              value="${_esc(q?.subject)}">
          </div>
          <div class="tb-field">
            <label>Chapter</label>
            <input id="tb-chapter" class="admin-input"
              placeholder="e.g. Chapter 3"
              value="${_esc(q?.chapter)}">
          </div>
        </div>

        <p class="tb-step-label">⏱️ Timer &amp; Marks</p>
        <div class="tb-form-grid">
          <div class="tb-field">
            <label>Timer Mode</label>
            <select id="tb-timer-mode" class="admin-select">
              <option value="per_question" ${(q?.timer_mode || 'per_question') === 'per_question' ? 'selected' : ''}>Per Question</option>
              <option value="full_test"    ${q?.timer_mode === 'full_test' ? 'selected' : ''}>Full Test</option>
            </select>
          </div>
          <div class="tb-field">
            <label>Timer Value (seconds)</label>
            <input id="tb-timer-value" type="number" min="0" max="7200"
              class="admin-input" value="${q?.timer_value ?? 30}">
          </div>
          <div class="tb-field">
            <label>Positive Marks (per Q)</label>
            <input id="tb-pos-marks" type="number" min="0" step="0.25"
              class="admin-input" value="${q?.positive_marks ?? 1}">
          </div>
          <div class="tb-field">
            <label>Negative Marks (per wrong)</label>
            <input id="tb-neg-marks" type="number" min="0" step="0.25"
              class="admin-input" value="${q?.negative_marks ?? 0}">
          </div>
        </div>

        <div class="tb-field tb-field-inline">
          <input type="checkbox" id="tb-shuffle" ${q?.shuffle ? 'checked' : ''}>
          <label for="tb-shuffle">Auto-shuffle questions</label>
        </div>

        <p class="tb-step-label">📂 Sections</p>
        <div id="tb-sections-list"></div>
        <button class="admin-btn-secondary" id="tb-add-section" style="margin-top:6px">+ Add Section</button>
      </div>
    `;

    _loadBatchSelect();
    _renderSectionsList();

    $('tb-footer').innerHTML = `
      <div class="tb-footer-actions">
        <button class="admin-btn-secondary" id="tb-save-draft">💾 Save Draft</button>
        <button class="admin-btn-primary"   id="tb-next-1">Next: Questions →</button>
      </div>
    `;

    $('tb-add-section').addEventListener('click', _addSection);
    $('tb-save-draft').addEventListener('click', () => _saveQuiz('draft'));
    $('tb-next-1').addEventListener('click', async () => {
      if (await _commitStep1()) _renderStep(2);
    });
  }

  async function _loadBatchSelect() {
    const batches = await DB.getAllBatches();
    const sel     = $('tb-batch');
    if (!sel) return;
    batches.forEach(b => {
      const o = document.createElement('option');
      o.value       = b.name;
      o.textContent = `${b.icon || ''} ${b.name}`;
      if (state.quiz?.batch === b.name) o.selected = true;
      sel.appendChild(o);
    });
  }

  function _renderSectionsList() {
    const list = $('tb-sections-list');
    if (!list) return;
    list.innerHTML = '';

    state.sections.forEach((sec, i) => {
      const row = document.createElement('div');
      row.className = 'tb-section-row';
      row.innerHTML = `
        <input class="admin-input tb-sec-label"
          value="${_esc(sec.label)}" placeholder="Label" data-idx="${i}">
        <select class="admin-select tb-sec-type" data-idx="${i}">
          <option value="mcq" ${sec.type === 'mcq' ? 'selected' : ''}>MCQ</option>
          <option value="tf"  ${sec.type === 'tf'  ? 'selected' : ''}>True/False</option>
          <option value="fib" ${sec.type === 'fib' ? 'selected' : ''}>Fill in Blank</option>
        </select>
        <span class="tb-sec-count">${sec.question_ids.length} Q</span>
        ${state.sections.length > 1
          ? `<button class="tb-sec-del" data-idx="${i}" title="Remove">✕</button>`
          : ''}
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('.tb-sec-label').forEach(inp =>
      inp.addEventListener('change', e => { state.sections[+e.target.dataset.idx].label = e.target.value; })
    );
    list.querySelectorAll('.tb-sec-type').forEach(sel =>
      sel.addEventListener('change', e => { state.sections[+e.target.dataset.idx].type = e.target.value; })
    );
    list.querySelectorAll('.tb-sec-del').forEach(btn =>
      btn.addEventListener('click', e => {
        state.sections.splice(+e.target.dataset.idx, 1);
        if (state.activeSection >= state.sections.length)
          state.activeSection = state.sections.length - 1;
        _renderSectionsList();
      })
    );
  }

  function _addSection() {
    const labels = ['A','B','C','D','E','F'];
    const label  = `Section ${labels[state.sections.length] || state.sections.length + 1}`;
    state.sections.push({
      id: `sec_${Date.now()}`, label, type: 'mcq',
      question_ids: [], timer: 30, positive_marks: 1, negative_marks: 0,
    });
    _renderSectionsList();
  }

  async function _commitStep1() {
    const title   = $('tb-title')?.value.trim();
    const batch   = $('tb-batch')?.value;
    const subject = $('tb-subject')?.value.trim();

    if (!title)   { APP.toast('Quiz title is required', 'error');      return false; }
    if (!batch)   { APP.toast('Please select a class/batch', 'error'); return false; }
    if (!subject) { APP.toast('Subject is required', 'error');         return false; }

    state.quiz = {
      ...(state.quiz || {}),
      title,
      batch,
      subject,
      chapter       : $('tb-chapter')?.value.trim()       || '',
      school_name   : $('tb-school')?.value.trim()        || '',
      timer_mode    : $('tb-timer-mode')?.value            || 'per_question',
      timer_value   : parseInt($('tb-timer-value')?.value) || 30,
      positive_marks: parseFloat($('tb-pos-marks')?.value) ?? 1,
      negative_marks: parseFloat($('tb-neg-marks')?.value) ?? 0,
      shuffle       : $('tb-shuffle')?.checked             || false,
      sections      : state.sections,
    };
    return true;
  }

  // ════════════════════════
  // STEP 2 — Add Questions
  // ════════════════════════

  async function _renderStep2() {
    $('tb-body').innerHTML = `
      <div class="tb-q-layout">

        <div class="tb-bank-panel">
          <div class="tb-bank-header">
            <span class="tb-panel-title">📚 Question Bank</span>
            <div class="tb-bank-filters">
              <select id="tb-f-subject" class="admin-select tb-filter"><option value="">All Subjects</option></select>
              <select id="tb-f-chapter" class="admin-select tb-filter"><option value="">All Chapters</option></select>
              <select id="tb-f-diff"    class="admin-select tb-filter">
                <option value="">All Levels</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>
          <div class="tb-section-tabs" id="tb-section-tabs"></div>
          <div class="tb-bank-list" id="tb-bank-list">
            <p class="tb-empty-hint">Loading questions…</p>
          </div>

          <!-- ── Auto-Mix ── -->
          <div class="tb-automix">
            <p class="tb-sub-label">🎯 Auto-Mix by Difficulty</p>
            <div class="tb-automix-row">
              <label>Easy   <input type="number" id="tb-mix-easy"   class="admin-input tb-mix-inp" min="0" value="0"></label>
              <label>Med    <input type="number" id="tb-mix-medium" class="admin-input tb-mix-inp" min="0" value="0"></label>
              <label>Hard   <input type="number" id="tb-mix-hard"   class="admin-input tb-mix-inp" min="0" value="0"></label>
              <button class="admin-btn-secondary" id="tb-do-automix">Auto Pick</button>
            </div>
          </div>

          <!-- ── Bulk Paste ── -->
          <div class="tb-bulk">
            <p class="tb-sub-label">📋 Bulk Paste (Q&amp;A format)</p>
            <p class="tb-sub-hint">Supports MCQ, True/False, and Fill-in-the-Blank</p>
            <textarea id="tb-bulk-text" class="admin-textarea" rows="5"
              placeholder="Q1. What is photosynthesis?&#10;A) Making food  B) Breathing  C) Digestion  D) Excretion&#10;Ans: A&#10;&#10;Q2. The sun is a star. (True/False)&#10;Ans: True&#10;&#10;Q3. Water formula is ___&#10;Ans: H2O"></textarea>
            <button class="admin-btn-secondary" id="tb-bulk-parse" style="margin-top:6px">
              Parse &amp; Add →
            </button>
          </div>

          <!-- ── Manual Add ── -->
          <div class="tb-manual-add">
            <p class="tb-sub-label">✏️ Quick Add Question</p>
            <textarea id="tb-manual-q" class="admin-textarea" rows="2"
              placeholder="Type question text…"></textarea>

            <div class="tb-manual-meta">
              <select id="tb-manual-type" class="admin-select">
                <option value="mcq">MCQ</option>
                <option value="tf">True / False</option>
                <option value="fib">Fill in Blank</option>
              </select>
              <select id="tb-manual-diff" class="admin-select">
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <!-- MCQ options (shown by default) -->
            <div id="tb-manual-mcq-opts" class="tb-manual-opts">
              <div class="tb-manual-opts-grid">
                <input id="tb-manual-a" class="admin-input" placeholder="Option A">
                <input id="tb-manual-b" class="admin-input" placeholder="Option B">
                <input id="tb-manual-c" class="admin-input" placeholder="Option C (optional)">
                <input id="tb-manual-d" class="admin-input" placeholder="Option D (optional)">
              </div>
              <div class="tb-manual-answer-row">
                <label for="tb-manual-answer">Correct:</label>
                <select id="tb-manual-answer" class="admin-select">
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </div>
            </div>

            <!-- TF answer (hidden until type = tf) -->
            <div id="tb-manual-tf-opts" class="tb-manual-opts hidden">
              <div class="tb-manual-answer-row">
                <label for="tb-manual-tf-ans">Correct:</label>
                <select id="tb-manual-tf-ans" class="admin-select">
                  <option value="True">True</option>
                  <option value="False">False</option>
                </select>
              </div>
            </div>

            <!-- FIB answer (hidden until type = fib) -->
            <div id="tb-manual-fib-opts" class="tb-manual-opts hidden">
              <input id="tb-manual-fib-ans" class="admin-input"
                placeholder="Correct answer text">
            </div>

            <button class="admin-btn-secondary" id="tb-manual-submit">+ Add to Section</button>
          </div>
        </div>

        <div class="tb-selected-panel">
          <span class="tb-panel-title">✅ Selected <span id="tb-sel-count">(0)</span></span>
          <div class="tb-selected-list" id="tb-selected-list">
            <p class="tb-empty-hint">Select questions from the bank ←</p>
          </div>
        </div>

      </div>
    `;

    $('tb-footer').innerHTML = `
      <div class="tb-footer-actions">
        <button class="admin-btn-secondary" id="tb-back-1">← Back</button>
        <button class="admin-btn-secondary" id="tb-save-draft2">💾 Save Draft</button>
        <button class="admin-btn-primary"   id="tb-next-2">Preview →</button>
      </div>
    `;

    // Footer nav
    $('tb-back-1').addEventListener('click', () => _renderStep(1));
    $('tb-save-draft2').addEventListener('click', () => _saveQuiz('draft'));
    $('tb-next-2').addEventListener('click', () => { _syncSectionsToQuiz(); _renderStep(3); });

    // Bank filters
    ['tb-f-subject', 'tb-f-chapter', 'tb-f-diff'].forEach(id => {
      $(id)?.addEventListener('change', e => {
        const key = id === 'tb-f-subject' ? 'subject'
                  : id === 'tb-f-chapter' ? 'chapter' : 'difficulty';
        state.filters[key] = e.target.value;
        _renderBankList();
      });
    });

    // Auto-mix & bulk parse
    $('tb-do-automix').addEventListener('click', _doAutoMix);
    $('tb-bulk-parse').addEventListener('click', _doBulkParse);

    // Manual add — type toggle
    $('tb-manual-type').addEventListener('change', _updateManualTypeView);

    // Manual add — submit
    $('tb-manual-submit').addEventListener('click', _doManualAdd);

    await _loadBankQuestions();
    _buildFilterOptions();
    _renderSectionTabs();
    _renderBankList();
    _renderSelectedList();
  }

  async function _loadBankQuestions() {
    const batch = state.quiz?.batch || '';
    state.bankQuestions = batch
      ? await DB.getQuestionsByBatch(batch)
      : await DB.getAllQuestions();
  }

  function _buildFilterOptions() {
    const subjects = [...new Set(state.bankQuestions.map(q => q.subject).filter(Boolean))];
    subjects.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s;
      $('tb-f-subject')?.appendChild(o);
    });
    const chapters = [...new Set(state.bankQuestions.map(q => q.chapter).filter(Boolean))];
    chapters.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      $('tb-f-chapter')?.appendChild(o);
    });
  }

  function _renderSectionTabs() {
    const tabs = $('tb-section-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    state.sections.forEach((sec, i) => {
      const btn = document.createElement('button');
      btn.className   = `tb-sec-tab${i === state.activeSection ? ' active' : ''}`;
      btn.textContent = `${sec.label} (${sec.question_ids.length})`;
      btn.addEventListener('click', () => {
        state.activeSection = i;
        _renderSectionTabs();
        _renderSelectedList();
        _renderBankList();
      });
      tabs.appendChild(btn);
    });
  }

  function _renderBankList() {
    const list = $('tb-bank-list');
    if (!list) return;

    const { subject, chapter, difficulty } = state.filters;
    let filtered = state.bankQuestions;
    if (subject)    filtered = filtered.filter(q => q.subject    === subject);
    if (chapter)    filtered = filtered.filter(q => q.chapter    === chapter);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);

    const allSelected = _getAllSelectedQIds();

    if (!filtered.length) {
      list.innerHTML = '<p class="tb-empty-hint">No questions match the filter</p>';
      return;
    }

    list.innerHTML = '';
    filtered.forEach(q => {
      const isSel = allSelected.includes(q.q_id);
      const item  = document.createElement('div');
      item.className = `tb-bank-item${isSel ? ' selected' : ''}`;
      item.innerHTML = `
        <div class="tb-bank-item-body">
          <div class="tb-bank-item-text">${_esc(q.question.slice(0, 90))}${q.question.length > 90 ? '…' : ''}</div>
          <div class="tb-bank-item-meta">
            <span class="qb-badge ${q.difficulty || 'medium'}">${q.difficulty || 'med'}</span>
            <span class="tb-q-type">${(q.type || 'mcq').toUpperCase()}</span>
          </div>
        </div>
        <button class="tb-add-btn${isSel ? ' remove' : ''}" data-id="${q.q_id}"
          aria-label="${isSel ? 'Remove from section' : 'Add to section'}">${isSel ? '✕' : '+'}</button>
      `;
      item.querySelector('.tb-add-btn').addEventListener('click', () => {
        isSel ? _removeFromSection(q.q_id) : _addToSection(q.q_id);
      });
      list.appendChild(item);
    });
  }

  function _renderSelectedList() {
    const list    = $('tb-selected-list');
    const countEl = $('tb-sel-count');
    if (!list) return;

    const sec   = state.sections[state.activeSection];
    const total = _getAllSelectedQIds().length;
    if (countEl) countEl.textContent = `(${total})`;

    if (!sec || !sec.question_ids.length) {
      list.innerHTML = `<p class="tb-empty-hint">No questions in "${sec?.label || ''}" yet</p>`;
      return;
    }

    list.innerHTML = '';
    sec.question_ids.forEach((qid, idx) => {
      const q    = state.bankQuestions.find(bq => bq.q_id === qid);
      const item = document.createElement('div');
      item.className = 'tb-selected-item';
      item.innerHTML = `
        <span class="tb-sel-num">${idx + 1}</span>
        <span class="tb-sel-text">${q
          ? _esc(q.question.slice(0, 65)) + (q.question.length > 65 ? '…' : '')
          : qid}</span>
        <button class="tb-remove-btn" data-id="${qid}" title="Remove" aria-label="Remove question">✕</button>
      `;
      item.querySelector('.tb-remove-btn').addEventListener('click', () => _removeFromSection(qid));
      list.appendChild(item);
    });
  }

  function _addToSection(q_id) {
    const sec = state.sections[state.activeSection];
    if (!sec || sec.question_ids.includes(q_id)) return;
    sec.question_ids.push(q_id);
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
  }

  function _removeFromSection(q_id) {
    state.sections.forEach(sec => {
      sec.question_ids = sec.question_ids.filter(id => id !== q_id);
    });
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
  }

  function _getAllSelectedQIds() {
    return state.sections.flatMap(sec => sec.question_ids);
  }

  // ── Auto-Mix ──────────────────────────────

  async function _doAutoMix() {
    const easy   = Math.max(0, parseInt($('tb-mix-easy')?.value)   || 0);
    const medium = Math.max(0, parseInt($('tb-mix-medium')?.value) || 0);
    const hard   = Math.max(0, parseInt($('tb-mix-hard')?.value)   || 0);

    if (!easy && !medium && !hard) { APP.toast('Enter at least one count', 'error'); return; }

    const sec      = state.sections[state.activeSection];
    const selected = _getAllSelectedQIds();
    const pool     = state.bankQuestions.filter(q => !selected.includes(q.q_id));

    const pick = (diff, count) => {
      const bucket = pool.filter(q => q.difficulty === diff);
      return [...bucket].sort(() => Math.random() - 0.5).slice(0, count).map(q => q.q_id);
    };

    const picked = [...pick('easy', easy), ...pick('medium', medium), ...pick('hard', hard)];
    if (!picked.length) { APP.toast('No matching questions available in bank', 'info'); return; }

    picked.forEach(id => { if (!sec.question_ids.includes(id)) sec.question_ids.push(id); });
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
    APP.toast(`✅ ${picked.length} questions auto-selected`, 'success');
  }

  // ── Manual Add ────────────────────────────

  function _updateManualTypeView() {
    const type = $('tb-manual-type')?.value;
    $('tb-manual-mcq-opts')?.classList.toggle('hidden', type !== 'mcq');
    $('tb-manual-tf-opts') ?.classList.toggle('hidden', type !== 'tf');
    $('tb-manual-fib-opts')?.classList.toggle('hidden', type !== 'fib');
  }

  async function _doManualAdd() {
    const qText = $('tb-manual-q')?.value.trim();
    const type  = $('tb-manual-type')?.value || 'mcq';
    const diff  = $('tb-manual-diff')?.value || 'medium';

    if (!qText) { APP.toast('Question text is required', 'error'); return; }

    const q = {
      question  : qText,
      type,
      difficulty: diff,
      batch     : state.quiz?.batch   || '',
      subject   : state.quiz?.subject || '',
      chapter   : state.quiz?.chapter || '',
      tags      : [],
    };

    if (type === 'mcq') {
      const a = $('tb-manual-a')?.value.trim();
      const b = $('tb-manual-b')?.value.trim();
      if (!a || !b) { APP.toast('At least options A and B are required', 'error'); return; }
      q.options = {
        A: a,
        B: b,
        C: $('tb-manual-c')?.value.trim() || '',
        D: $('tb-manual-d')?.value.trim() || '',
      };
      q.answer = $('tb-manual-answer')?.value || 'A';

    } else if (type === 'tf') {
      q.options = { A: 'True', B: 'False' };
      q.answer  = $('tb-manual-tf-ans')?.value || 'True';

    } else if (type === 'fib') {
      q.answer = $('tb-manual-fib-ans')?.value.trim();
      if (!q.answer) { APP.toast('Correct answer is required for FIB', 'error'); return; }
    }

    const saved = await DB.saveQuestion(q);
    const sec   = state.sections[state.activeSection];
    if (!sec.question_ids.includes(saved.q_id)) sec.question_ids.push(saved.q_id);

    // Reset form
    if ($('tb-manual-q'))       $('tb-manual-q').value       = '';
    if ($('tb-manual-a'))       $('tb-manual-a').value       = '';
    if ($('tb-manual-b'))       $('tb-manual-b').value       = '';
    if ($('tb-manual-c'))       $('tb-manual-c').value       = '';
    if ($('tb-manual-d'))       $('tb-manual-d').value       = '';
    if ($('tb-manual-fib-ans')) $('tb-manual-fib-ans').value = '';

    await _loadBankQuestions();
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
    APP.toast('✅ Question created and added to section', 'success');
  }

  // ── Bulk Paste Parser ──────────────────────

  /**
   * Thin wrapper: delegates to PARSER.parse() and returns the array of
   * question objects (backward-compatible with external callers).
   *
   * @param   {string} rawText
   * @returns {Object[]}
   */
  function parseBulkText(rawText) {
    return PARSER.parse(rawText).parsed;
  }

  async function _doBulkParse() {
    const text = $('tb-bulk-text')?.value.trim();
    if (!text) { APP.toast('Paste some questions first', 'error'); return; }

    const result = PARSER.parse(text);
    const parsed = result.parsed;

    if (result.errors.length && !parsed.length) {
      APP.toast('Could not parse — check the Q / A) / Ans: format', 'error');
      console.warn('Parser errors:', result.errors);
      return;
    }

    if (result.errors.length) {
      console.warn(`Parser: ${result.errors.length} block(s) failed`, result.errors);
    }

    const batch   = state.quiz?.batch   || '';
    const subject = state.quiz?.subject || 'Bulk';
    const chapter = state.quiz?.chapter || 'Bulk Import';
    const newIds  = [];

    for (const q of parsed) {
      const saved = await DB.saveQuestion({ ...q, batch, subject, chapter });
      newIds.push(saved.q_id);
    }

    const sec = state.sections[state.activeSection];
    newIds.forEach(id => { if (!sec.question_ids.includes(id)) sec.question_ids.push(id); });

    await _loadBankQuestions();
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
    if ($('tb-bulk-text')) $('tb-bulk-text').value = '';

    const typeCounts = parsed.reduce((acc, q) => {
      acc[q.type] = (acc[q.type] || 0) + 1; return acc;
    }, {});
    const summary = Object.entries(typeCounts)
      .map(([t, n]) => `${n} ${t.toUpperCase()}`).join(', ');
    APP.toast(`✅ ${parsed.length} questions added (${summary})`, 'success');
  }

  function _syncSectionsToQuiz() {
    if (state.quiz) state.quiz.sections = state.sections;
  }

  // ════════════════════════
  // STEP 3 — Preview
  // ════════════════════════

  async function _renderStep3() {
    _syncSectionsToQuiz();

    const quiz       = state.quiz;
    const allQIds    = _getAllSelectedQIds();
    const totalMarks = allQIds.length * (quiz?.positive_marks ?? 1);
    const timerLabel = quiz?.timer_mode === 'full_test'
      ? `${quiz.timer_value}s total` : `${quiz.timer_value}s / question`;

    $('tb-body').innerHTML = `
      <div class="tb-preview-wrap">
        <div class="tb-preview-header">
          ${quiz?.school_name ? `<div class="tb-preview-school">${_esc(quiz.school_name)}</div>` : ''}
          <h2 class="tb-preview-title">${_esc(quiz?.title || 'Untitled Quiz')}</h2>
          <div class="tb-preview-meta">
            ${[quiz?.batch, quiz?.subject, quiz?.chapter].filter(Boolean).join(' › ')}
            &nbsp;|&nbsp; ${allQIds.length} Questions
            &nbsp;|&nbsp; Total Marks: ${totalMarks}
            &nbsp;|&nbsp; Timer: ${timerLabel}
          </div>
          ${quiz?.negative_marks
            ? `<div class="tb-preview-neg-warn">⚠️ Negative marking: −${quiz.negative_marks} per wrong answer</div>`
            : ''}
        </div>
        ${allQIds.length
          ? _buildPreviewSectionsHtml()
          : `<p class="tb-empty-hint" style="padding:32px;text-align:center">No questions selected. Go back and add questions.</p>`}
      </div>
    `;

    // Apply current show/hide state immediately
    _applyAnswerVisibility();

    $('tb-footer').innerHTML = `
      <div class="tb-footer-actions">
        <button class="admin-btn-secondary" id="tb-back-2">← Back</button>
        <button class="admin-btn-secondary" id="tb-print-quiz">Print / PDF</button>
        <button class="admin-btn-secondary" id="tb-toggle-answers">
          ${state.previewShowAnswers ? '🙈 Hide Answers' : '👁 Show Answers'}
        </button>
        <button class="admin-btn-secondary" id="tb-save-draft3">💾 Save Draft</button>
        <button class="admin-btn-primary"   id="tb-publish">🚀 Publish Quiz</button>
      </div>
    `;

    $('tb-back-2').addEventListener('click', () => _renderStep(2));
    $('tb-print-quiz').addEventListener('click', () => PDF.exportQuizPaper(state.quiz));
    $('tb-save-draft3').addEventListener('click', () => _saveQuiz('draft'));
    $('tb-publish').addEventListener('click', () => _saveQuiz('published'));

    $('tb-toggle-answers').addEventListener('click', () => {
      state.previewShowAnswers = !state.previewShowAnswers;
      $('tb-toggle-answers').textContent =
        state.previewShowAnswers ? '🙈 Hide Answers' : '👁 Show Answers';
      _applyAnswerVisibility();
    });
  }

  function _buildPreviewSectionsHtml() {
    return state.sections.map(sec => {
      const sQs = sec.question_ids
        .map(id => state.bankQuestions.find(bq => bq.q_id === id))
        .filter(Boolean);
      if (!sQs.length) return '';

      const posM = sec.positive_marks ?? state.quiz?.positive_marks ?? 1;
      const negM = sec.negative_marks ?? state.quiz?.negative_marks ?? 0;

      return `
        <div class="tb-preview-section">
          <h3 class="tb-preview-sec-label">
            ${_esc(sec.label)}
            <small>(${sec.type.toUpperCase()} · ${sQs.length} Q · +${posM} / −${negM})</small>
          </h3>
          ${sQs.map((q, qIdx) => _buildPreviewQHtml(q, qIdx)).join('')}
        </div>
      `;
    }).join('');
  }

  function _buildPreviewQHtml(q, qIdx) {
    let answersHtml = '';

    if (q.type === 'fib') {
      answersHtml = `
        <div class="tb-preview-fib-blank">____________</div>
        <div class="tb-preview-fib-key preview-answer">Answer: ${_esc(q.answer || '')}</div>
      `;
    } else {
      const opts = q.options || {};
      answersHtml = `
        <div class="tb-preview-opts">
          ${Object.entries(opts).filter(([, v]) => v).map(([k, v]) => `
            <span class="tb-preview-opt${q.answer === k ? ' correct-ans preview-answer' : ''}">
              <b>${k})</b> ${_esc(v)}
            </span>`).join('')}
        </div>
      `;
    }

    return `
      <div class="tb-preview-q">
        <div class="tb-preview-qnum">Q${qIdx + 1}.</div>
        <div class="tb-preview-qbody">
          <div class="tb-preview-qtext">${_esc(q.question)}</div>
          ${answersHtml}
        </div>
      </div>
    `;
  }

  function _applyAnswerVisibility() {
    document.querySelectorAll('.preview-answer').forEach(el => {
      el.classList.toggle('tb-answer-hidden', !state.previewShowAnswers);
    });
  }

  // ════════════════════════
  // SAVE / PUBLISH
  // ════════════════════════

  async function _saveQuiz(status = 'draft') {
    _syncSectionsToQuiz();

    if (!state.quiz?.title) {
      APP.toast('Go to Step 1 and fill quiz details first', 'error');
      return;
    }

    const totalQ = _getAllSelectedQIds().length;
    if (totalQ === 0 && status === 'published') {
      APP.toast('Add at least 1 question before publishing', 'error');
      return;
    }

    state.quiz.sections = state.sections;
    state.quiz.status   = status;

    const saved = await DB.saveQuiz(state.quiz);
    state.quiz  = saved;

    if (status === 'published') {
      APP.toast(`🚀 "${saved.title}" published successfully!`, 'success');
      close();
    } else {
      APP.toast(`💾 Draft saved — "${saved.title}"`, 'info');
    }

    if (typeof ADMIN !== 'undefined' && typeof ADMIN.loadQuizList === 'function') {
      ADMIN.loadQuizList();
    }
  }

  // ════════════════════════
  // HELPERS
  // ════════════════════════

  function _esc(val) {
    return String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ════════════════════════
  // INIT
  // ════════════════════════

  function init() {
    $('tb-close')?.addEventListener('click', close);
    $('test-builder-overlay')?.addEventListener('click', e => {
      if (e.target === $('test-builder-overlay')) close();
    });
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, open, close, parseBulkText };
})();

window.TEST_BUILDER = TEST_BUILDER;
