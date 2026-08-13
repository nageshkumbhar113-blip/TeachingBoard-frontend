/* ════════════════════════════════════════
   testBuilder.js — Quiz / Test Builder
   3-Step Wizard: Meta → Questions → Preview
   Global: TEST_BUILDER
════════════════════════════════════════ */

const TEST_BUILDER = (() => {
  const $ = id => document.getElementById(id);
  const _cleanUrl = value => {
    const trimmed = String(value || '').trim();
    return trimmed || null;
  };
  const _hasOptionContent = (text, imageUrl) => !!String(text || '').trim() || !!_cleanUrl(imageUrl);
  const _questionLabel = q => {
    const text = String(q?.question || '').trim();
    if (text) return text;
    if (q?.image) return '[Image Question]';
    return '[Untitled Question]';
  };
  const _questionSummary = (q, maxLen = 90) => {
    const label = _questionLabel(q);
    return label.length > maxLen ? `${label.slice(0, maxLen)}…` : label;
  };

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
    // 'manual' / 'random' / 'mixed' — all three share the exact same
    // state.sections array; 'mixed' is the only mode where each section
    // gets its own batch/subject/chapter instead of inheriting Step 1's.
    paperMode         : 'manual',
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
      state.paperMode = existing.paper_mode || 'manual';
    } else {
      state.quiz     = null;
      state.sections = [
        { id: 'sec_1', label: 'Section A', type: 'mcq',
          question_ids: [], timer: 30, positive_marks: 1, negative_marks: 0, mode: 'manual' },
      ];
      state.paperMode = 'manual';
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
            <select id="tb-subject" class="admin-select">
              <option value="">Select Subject</option>
            </select>
          </div>
          <div class="tb-field">
            <label>Chapter *</label>
            <select id="tb-chapter" class="admin-select">
              <option value="">Select Chapter</option>
            </select>
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

        <p class="tb-step-label">🧩 Paper Mode</p>
        <div class="tb-field-inline" style="gap:18px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:6px">
            <input type="radio" name="tb-paper-mode" value="manual" ${state.paperMode === 'manual' ? 'checked' : ''}>
            Regular Test (Chapter-wise, manual pick)
          </label>
          <label style="display:flex;align-items:center;gap:6px">
            <input type="radio" name="tb-paper-mode" value="chapter_random" ${state.paperMode === 'chapter_random' ? 'checked' : ''}>
            🎲 Whole Chapter Test (random, from all tests in that chapter)
          </label>
          <label style="display:flex;align-items:center;gap:6px">
            <input type="radio" name="tb-paper-mode" value="random" ${state.paperMode === 'random' ? 'checked' : ''}>
            🎲 Whole Subject Test (random, from all chapters/tests)
          </label>
          <label style="display:flex;align-items:center;gap:6px">
            <input type="radio" name="tb-paper-mode" value="mixed" ${state.paperMode === 'mixed' ? 'checked' : ''}>
            📐 Paper Pattern Test (Mixed sections)
          </label>
        </div>

        <div id="tb-pattern-panel"></div>

        <p class="tb-step-label">📂 Sections</p>
        <div id="tb-sections-list"></div>
        <button class="admin-btn-secondary" id="tb-add-section" style="margin-top:6px">+ Add Section</button>
      </div>
    `;

    _loadBatchSelect();
    _renderSectionsList();
    _renderPatternPanel();

    document.querySelectorAll('input[name="tb-paper-mode"]').forEach(radio => {
      radio.addEventListener('change', e => {
        state.paperMode = e.target.value;
        // Non-mixed modes have exactly one implicit section that inherits
        // Step 1's batch/subject/chapter — collapse down to it so a user
        // switching away from Mixed doesn't leave orphaned extra sections.
        if (state.paperMode !== 'mixed' && state.sections.length > 1) {
          state.sections = [state.sections[0]];
          state.activeSection = 0;
        }
        state.sections.forEach(sec => {
          sec.mode = (state.paperMode === 'random' || state.paperMode === 'chapter_random')
            ? 'random'
            : (state.paperMode === 'manual' ? 'manual' : (sec.mode || 'manual'));
          if (state.paperMode === 'mixed') sec.type = 'mcq';
        });
        _renderSectionsList();
        _renderPatternPanel();
      });
    });

    $('tb-footer').innerHTML = `
      <div class="tb-footer-actions">
        <button class="admin-btn-secondary" id="tb-save-draft">💾 Save Draft</button>
        <button class="admin-btn-primary"   id="tb-next-1">Next: Questions →</button>
      </div>
    `;

    $('tb-add-section').addEventListener('click', _addSection);
    $('tb-save-draft').addEventListener('click', () => _saveQuiz('draft'));
    $('tb-batch')?.addEventListener('change', () => _refreshQuizTopicSelectors());
    $('tb-subject')?.addEventListener('change', () => _refreshQuizTopicSelectors({
      subjectValue: $('tb-subject')?.value || '',
    }));
    $('tb-next-1').addEventListener('click', async () => {
      if (await _commitStep1()) _renderStep(2);
    });
  }

  async function _loadBatchSelect() {
    const batches = await DB.getAllBatches();
    const sel     = $('tb-batch');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Class</option>';
    batches.forEach(b => {
      const o = document.createElement('option');
      o.value       = b.name;
      o.textContent = `${b.icon || ''} ${b.name}`;
      if (state.quiz?.batch === b.name) o.selected = true;
      sel.appendChild(o);
    });
    await _refreshQuizTopicSelectors({
      subjectValue: state.quiz?.subject || '',
      chapterValue: state.quiz?.chapter || '',
    });
  }

  function _setTopicSelectOptions(select, values, placeholder) {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '';

    const base = document.createElement('option');
    base.value = '';
    base.textContent = placeholder;
    select.appendChild(base);

    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    select.value = values.includes(currentValue) ? currentValue : '';
  }

  async function _refreshQuizTopicSelectors({ subjectValue, chapterValue } = {}) {
    const batch = $('tb-batch')?.value || '';
    const subjectSelect = $('tb-subject');
    const chapterSelect = $('tb-chapter');
    if (!subjectSelect || !chapterSelect) return;

    const subjects = batch
      ? (await DB.getSubjectsByBatch(batch)).map(item => item.name)
      : [];
    _setTopicSelectOptions(subjectSelect, subjects, 'Select Subject');
    const nextSubject = subjectValue ?? subjectSelect.value;
    subjectSelect.value = subjects.includes(nextSubject) ? nextSubject : '';

    const subject = subjectSelect.value || subjectValue || '';
    const chapters = (batch && subject)
      ? (await DB.getChaptersByBatchSubject(batch, subject)).map(item => item.name)
      : [];
    _setTopicSelectOptions(chapterSelect, chapters, 'Select Chapter');
    const nextChapter = chapterValue ?? chapterSelect.value;
    chapterSelect.value = chapters.includes(nextChapter) ? nextChapter : '';
  }

  // Rapid sequential edits (batch → subject → chapter, the normal usage
  // pattern) each trigger their own async _renderSectionsList() call before
  // the previous one's DB lookups resolve — without a guard, whichever
  // render happens to finish last wins and can stomp a later selection with
  // stale data. Every await below re-checks this token and bails out the
  // instant a newer render has started.
  let _sectionsRenderToken = 0;

  async function _renderSectionsList() {
    const list = $('tb-sections-list');
    if (!list) return;
    const myToken = ++_sectionsRenderToken;
    const isMixed = state.paperMode === 'mixed';
    list.innerHTML = '';

    const batches = isMixed ? await DB.getAllBatches() : [];
    if (myToken !== _sectionsRenderToken) return;

    for (let i = 0; i < state.sections.length; i++) {
      const sec = state.sections[i];
      const row = document.createElement('div');
      row.className = 'tb-section-row';
      const field = (labelText, innerHtml, width) => `
        <div class="tb-sec-field" style="display:flex;flex-direction:column;gap:2px;${width ? `width:${width}` : ''}">
          <label style="font-size:10px;color:var(--text2,#888);text-transform:uppercase;letter-spacing:0.03em">${labelText}</label>
          ${innerHtml}
        </div>
      `;

      row.innerHTML = `
        ${field('Label', `<input class="admin-input tb-sec-label" value="${_esc(sec.label)}" placeholder="Label" data-idx="${i}">`)}
        ${field('Type', `
          <select class="admin-select tb-sec-type" data-idx="${i}" ${isMixed ? 'disabled' : ''}>
            <option value="mcq" ${sec.type === 'mcq' ? 'selected' : ''}>MCQ</option>
            ${isMixed ? '' : `
              <option value="tf"  ${sec.type === 'tf'  ? 'selected' : ''}>True/False</option>
              <option value="fib" ${sec.type === 'fib' ? 'selected' : ''}>Fill in Blank</option>
            `}
          </select>
        `)}
        ${isMixed ? `
          ${field('Batch', `
            <select class="admin-select tb-sec-batch" data-idx="${i}">
              <option value="">Select Batch</option>
              ${batches.map(b => `<option value="${_esc(b.name)}" ${sec.source_batch === b.name ? 'selected' : ''}>${_esc(b.name)}</option>`).join('')}
            </select>
          `)}
          ${field('Subject (all chapters/tests)', `<select class="admin-select tb-sec-subject" data-idx="${i}"><option value="">Select Subject</option></select>`)}
          ${field('Question Source', `
            <select class="admin-select tb-sec-mode" data-idx="${i}">
              <option value="manual" ${sec.mode !== 'random' ? 'selected' : ''}>Manual (pick myself)</option>
              <option value="random" ${sec.mode === 'random' ? 'selected' : ''}>🎲 Random (auto-pick)</option>
            </select>
          `)}
          ${sec.mode === 'random'
            ? field('How Many Questions?', `<input type="number" class="admin-input tb-sec-count" data-idx="${i}" min="1" max="200" placeholder="e.g. 25" value="${sec.count ?? ''}">`, '90px')
            : ''}
          ${field('Marks (correct)', `<input type="number" class="admin-input tb-sec-pos" data-idx="${i}" min="0" step="0.25" value="${sec.positive_marks ?? 1}">`, '80px')}
          ${field('Marks (wrong, −)', `<input type="number" class="admin-input tb-sec-neg" data-idx="${i}" min="0" step="0.25" value="${sec.negative_marks ?? 0}">`, '80px')}
        ` : ''}
        ${field('Selected', `<span class="tb-sec-count">${sec.question_ids.length} Q</span>`)}
        ${state.sections.length > 1
          ? `<button class="tb-sec-del" data-idx="${i}" title="Remove">✕</button>`
          : ''}
      `;
      list.appendChild(row);

      if (isMixed) {
        const subjectSel = row.querySelector('.tb-sec-subject');
        const subjects = sec.source_batch ? (await DB.getSubjectsByBatch(sec.source_batch)).map(s => s.name) : [];
        if (myToken !== _sectionsRenderToken) return;
        _setTopicSelectOptions(subjectSel, subjects, 'Subject');
        if (subjects.includes(sec.subject)) subjectSel.value = sec.subject;
      }
    }

    list.querySelectorAll('.tb-sec-label').forEach(inp =>
      inp.addEventListener('change', e => { state.sections[+e.target.dataset.idx].label = e.target.value; })
    );
    list.querySelectorAll('.tb-sec-type').forEach(sel =>
      sel.addEventListener('change', e => { state.sections[+e.target.dataset.idx].type = e.target.value; })
    );
    list.querySelectorAll('.tb-sec-batch').forEach(sel =>
      sel.addEventListener('change', e => {
        const sec = state.sections[+e.target.dataset.idx];
        sec.source_batch = e.target.value;
        sec.subject = '';
        _renderSectionsList();
      })
    );
    list.querySelectorAll('.tb-sec-subject').forEach(sel =>
      sel.addEventListener('change', e => {
        state.sections[+e.target.dataset.idx].subject = e.target.value;
      })
    );
    list.querySelectorAll('.tb-sec-mode').forEach(sel =>
      sel.addEventListener('change', e => {
        state.sections[+e.target.dataset.idx].mode = e.target.value;
        _renderSectionsList();
      })
    );
    list.querySelectorAll('.tb-sec-count').forEach(inp =>
      inp.addEventListener('change', e => {
        state.sections[+e.target.dataset.idx].count = Math.max(1, parseInt(e.target.value) || 0) || undefined;
      })
    );
    list.querySelectorAll('.tb-sec-pos').forEach(inp =>
      inp.addEventListener('change', e => { state.sections[+e.target.dataset.idx].positive_marks = parseFloat(e.target.value) || 0; })
    );
    list.querySelectorAll('.tb-sec-neg').forEach(inp =>
      inp.addEventListener('change', e => { state.sections[+e.target.dataset.idx].negative_marks = parseFloat(e.target.value) || 0; })
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
      mode: (state.paperMode === 'random' || state.paperMode === 'chapter_random') ? 'random' : 'manual',
      source_batch: $('tb-batch')?.value || '',
      subject: '',
    });
    _renderSectionsList();
  }

  // ── Paper Pattern (save/load reusable section structure) ─────

  let _patternCache = null;

  async function _renderPatternPanel() {
    const panel = $('tb-pattern-panel');
    if (!panel) return;
    if (state.paperMode !== 'mixed') { panel.innerHTML = ''; return; }

    if (!_patternCache) {
      try { _patternCache = await API.fetchQuizPatterns(); }
      catch (err) { console.warn('Failed to load patterns:', err?.message); _patternCache = []; }
    }

    panel.innerHTML = `
      <p class="tb-step-label">📐 Paper Pattern</p>
      <div class="tb-field-inline" style="gap:8px;flex-wrap:wrap">
        <select id="tb-pattern-select" class="admin-select" style="min-width:220px">
          <option value="">Load a saved pattern…</option>
          ${_patternCache.map(p => `<option value="${_esc(p.pattern_id)}">${_esc(p.name)} (${p.sections.length} sections)</option>`).join('')}
        </select>
        <button class="admin-btn-secondary" id="tb-pattern-load">📥 Load</button>
        <button class="admin-btn-secondary" id="tb-pattern-delete">🗑️ Delete</button>
      </div>
      <p class="tb-sub-hint">Load a pattern (e.g. "NMMS Pattern") to auto-fill the sections below — pick Batch, then Generate each section.</p>
      <div class="tb-field-inline" style="gap:8px;margin-top:8px">
        <input id="tb-pattern-name" class="admin-input" placeholder="Pattern name (e.g. &quot;NMMS Pattern&quot;)" style="flex:1;min-width:200px">
        <button class="admin-btn-secondary" id="tb-pattern-save">💾 Save current sections as this Pattern</button>
      </div>
    `;

    $('tb-pattern-load')?.addEventListener('click', _loadSelectedPattern);
    $('tb-pattern-save')?.addEventListener('click', _saveCurrentAsPattern);
    $('tb-pattern-delete')?.addEventListener('click', _deleteSelectedPattern);
  }

  function _loadSelectedPattern() {
    const patternId = $('tb-pattern-select')?.value;
    if (!patternId) { APP.toast('Select a pattern first', 'error'); return; }
    const pattern = _patternCache.find(p => p.pattern_id === patternId);
    if (!pattern) return;

    const batch = $('tb-batch')?.value || '';
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    state.sections = pattern.sections.map((ps, i) => ({
      id: `sec_${Date.now()}_${i}`,
      label: ps.label || `Section ${labels[i] || i + 1}`,
      type: 'mcq',
      question_ids: [],
      timer: 30,
      positive_marks: ps.positive_marks ?? 1,
      negative_marks: ps.negative_marks ?? 0,
      mode: ps.mode || 'random',
      source_batch: batch,
      subject: ps.subject || '',
      ...(ps.count ? { count: ps.count } : {}),
    }));
    state.activeSection = 0;
    _renderSectionsList();
    if ($('tb-pattern-name')) $('tb-pattern-name').value = pattern.name;
    APP.toast(`✅ "${pattern.name}" loaded — ${pattern.sections.length} sections`, 'success');
  }

  async function _saveCurrentAsPattern() {
    if (!state.sections.length) { APP.toast('No sections to save', 'error'); return; }
    const name = $('tb-pattern-name')?.value.trim();
    if (!name) { APP.toast('Enter a name for this pattern first', 'error'); return; }

    const sections = state.sections.map(sec => ({
      label: sec.label || '',
      // state.quiz isn't populated until Step 1 is committed (moving to
      // Step 2) — Save-as-Pattern lives on Step 1 itself, so fall back to
      // the live form field, not state.quiz.
      subject: sec.subject || $('tb-subject')?.value || '',
      count: sec.count || sec.question_ids.length || 10,
      mode: sec.mode === 'random' ? 'random' : 'manual',
      positive_marks: sec.positive_marks ?? 1,
      negative_marks: sec.negative_marks ?? 0,
    }));

    try {
      await API.saveQuizPattern({ name, sections });
      _patternCache = null; // force refresh
      await _renderPatternPanel();
      if ($('tb-pattern-name')) $('tb-pattern-name').value = name;
      APP.toast(`✅ Pattern "${name}" saved`, 'success');
    } catch (err) {
      APP.toast(err?.message || 'Failed to save pattern', 'error');
    }
  }

  async function _deleteSelectedPattern() {
    const patternId = $('tb-pattern-select')?.value;
    if (!patternId) { APP.toast('Select a pattern first', 'error'); return; }
    const pattern = _patternCache.find(p => p.pattern_id === patternId);
    if (!pattern) return;
    if (!await APP.confirmAsync(`Delete pattern "${pattern.name}"?`)) return;

    try {
      await API.deleteQuizPattern(patternId);
      _patternCache = null;
      await _renderPatternPanel();
      APP.toast('🗑️ Pattern deleted', 'info');
    } catch (err) {
      APP.toast(err?.message || 'Failed to delete pattern', 'error');
    }
  }

  async function _commitStep1() {
    const title   = $('tb-title')?.value.trim();
    const batch   = $('tb-batch')?.value;
    const subject = $('tb-subject')?.value;
    const chapter = $('tb-chapter')?.value;

    if (!title)   { APP.toast('Quiz title is required', 'error');      return false; }
    if (!batch)   { APP.toast('Please select a class/batch', 'error'); return false; }
    // Subject is required everywhere except 'mixed' — a Paper Pattern test
    // (e.g. NMMS-style: Maths + Science + Mental Ability combined) has each
    // section pick its own subject independently, so one single top-level
    // subject doesn't apply and would force an arbitrary choice.
    if (!subject && state.paperMode !== 'mixed') {
      APP.toast('Subject is required', 'error');
      return false;
    }
    // Chapter is required for 'manual' (Regular Test) and 'chapter_random'
    // (Whole Chapter Test) — both scope to one specific chapter. 'random'
    // (Whole Subject Test) and 'mixed' (Paper Pattern) are subject-wide by
    // design (scholarship/NMMS-style papers draw from a whole subject, not
    // one chapter) and never use this Step 1 chapter value.
    if (!chapter && (state.paperMode === 'manual' || state.paperMode === 'chapter_random')) {
      APP.toast('Chapter is required for this mode', 'error');
      return false;
    }

    // 'random' (Whole Subject) and 'mixed' (Paper Pattern) are always
    // subject-wide — never carry a chapter through for those, even if one
    // happens to be selected on the form, so scope resolution stays
    // unambiguous.
    const effectiveChapter = (state.paperMode === 'manual' || state.paperMode === 'chapter_random')
      ? chapter
      : '';

    state.quiz = {
      ...(state.quiz || {}),
      title,
      batch,
      subject,
      chapter: effectiveChapter,
      school_name   : $('tb-school')?.value.trim()        || '',
      timer_mode    : $('tb-timer-mode')?.value            || 'per_question',
      timer_value   : parseInt($('tb-timer-value')?.value) || 30,
      positive_marks: parseFloat($('tb-pos-marks')?.value) ?? 1,
      negative_marks: parseFloat($('tb-neg-marks')?.value) ?? 0,
      shuffle       : $('tb-shuffle')?.checked             || false,
      sections      : state.sections,
      paper_mode    : state.paperMode,
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
          <div id="tb-random-pick-panel"></div>
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
            <div class="bulk-prompt-box">
              <p class="tb-sub-hint">ChatGPT / Gemini ला खालील prompt द्या → output copy करा → खाली paste करा</p>
              <pre id="tb-bulk-sample-prompt" class="bulk-prompt-text">Generate 10 multiple choice questions on [TOPIC] in this exact format:

Q1. [Question text]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Ans: A

For True/False questions write "(True/False)" after the question and use Ans: True or Ans: False
For Fill in the blank put ___ in the question and Ans: [answer text]</pre>
              <button type="button" class="admin-btn-secondary" id="tb-copy-prompt">📋 Copy Prompt</button>
            </div>
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
            <div class="tb-img-upload-row" style="margin-top:8px">
              <input id="tb-manual-q-image" class="admin-input" placeholder="Question image URL (optional)">
              <button type="button" class="admin-btn-secondary tb-img-upload-btn" id="btn-tb-q-img" title="Upload image">📷</button>
              <input type="file" id="tb-q-img-file" accept="image/*" style="display:none">
            </div>
            <span id="tb-q-img-status" class="tb-img-status"></span>

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
                <div class="tb-img-upload-row">
                  <input id="tb-manual-a-image" class="admin-input" placeholder="Option A image URL (optional)">
                  <button type="button" class="admin-btn-secondary tb-img-upload-btn" id="btn-tb-a-img" title="Upload A">📷</button>
                  <input type="file" id="tb-a-img-file" accept="image/*" style="display:none">
                </div>
                <div class="tb-img-upload-row">
                  <input id="tb-manual-b-image" class="admin-input" placeholder="Option B image URL (optional)">
                  <button type="button" class="admin-btn-secondary tb-img-upload-btn" id="btn-tb-b-img" title="Upload B">📷</button>
                  <input type="file" id="tb-b-img-file" accept="image/*" style="display:none">
                </div>
                <div class="tb-img-upload-row">
                  <input id="tb-manual-c-image" class="admin-input" placeholder="Option C image URL (optional)">
                  <button type="button" class="admin-btn-secondary tb-img-upload-btn" id="btn-tb-c-img" title="Upload C">📷</button>
                  <input type="file" id="tb-c-img-file" accept="image/*" style="display:none">
                </div>
                <div class="tb-img-upload-row">
                  <input id="tb-manual-d-image" class="admin-input" placeholder="Option D image URL (optional)">
                  <button type="button" class="admin-btn-secondary tb-img-upload-btn" id="btn-tb-d-img" title="Upload D">📷</button>
                  <input type="file" id="tb-d-img-file" accept="image/*" style="display:none">
                </div>
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
    $('tb-copy-prompt').addEventListener('click', _copyBulkPrompt);

    // Manual add — type toggle
    $('tb-manual-type').addEventListener('change', _updateManualTypeView);

    // Manual add — submit
    $('tb-manual-submit').addEventListener('click', _doManualAdd);

    // Image upload buttons
    _setupImgUpload('tb-q-img-file', 'btn-tb-q-img', 'tb-manual-q-image', 'tb-q-img-status');
    _setupImgUpload('tb-a-img-file', 'btn-tb-a-img', 'tb-manual-a-image', null);
    _setupImgUpload('tb-b-img-file', 'btn-tb-b-img', 'tb-manual-b-image', null);
    _setupImgUpload('tb-c-img-file', 'btn-tb-c-img', 'tb-manual-c-image', null);
    _setupImgUpload('tb-d-img-file', 'btn-tb-d-img', 'tb-manual-d-image', null);

    await _loadBankQuestions();
    _buildFilterOptions();
    _renderSectionTabs();
    _renderRandomPickPanel();
    _renderBankList();
    _renderSelectedList();
  }

  async function _loadBankQuestions() {
    const sec = state.sections[state.activeSection];
    // Mixed-mode sections carry their own batch — the bank browser must show
    // what that section can actually draw from, not the whole quiz's batch.
    const batch = (state.paperMode === 'mixed' && sec?.source_batch)
      ? sec.source_batch
      : (state.quiz?.batch || '');
    state.bankQuestions = batch
      ? await DB.getQuestionsByBatch(batch)
      : await DB.getAllQuestions();
  }

  function _buildFilterOptions() {
    // Re-callable (Mixed mode reloads this on every section-tab switch,
    // since each section can draw from a different batch) — always rebuild
    // from scratch rather than appending on top of the previous section's options.
    const subjects = [...new Set(state.bankQuestions.map(q => q.subject).filter(Boolean))];
    const subjectSel = $('tb-f-subject');
    if (subjectSel) {
      subjectSel.innerHTML = '<option value="">All Subjects</option>';
      subjects.forEach(s => {
        const o = document.createElement('option'); o.value = s; o.textContent = s;
        subjectSel.appendChild(o);
      });
      subjectSel.value = subjects.includes(state.filters.subject) ? state.filters.subject : '';
    }
    const chapters = [...new Set(state.bankQuestions.map(q => q.chapter).filter(Boolean))];
    const chapterSel = $('tb-f-chapter');
    if (chapterSel) {
      chapterSel.innerHTML = '<option value="">All Chapters</option>';
      chapters.forEach(c => {
        const o = document.createElement('option'); o.value = c; o.textContent = c;
        chapterSel.appendChild(o);
      });
      chapterSel.value = chapters.includes(state.filters.chapter) ? state.filters.chapter : '';
    }
  }

  function _renderSectionTabs() {
    const tabs = $('tb-section-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    state.sections.forEach((sec, i) => {
      const btn = document.createElement('button');
      btn.className   = `tb-sec-tab${i === state.activeSection ? ' active' : ''}`;
      btn.textContent = `${sec.label} (${sec.question_ids.length})`;
      btn.addEventListener('click', async () => {
        state.activeSection = i;
        if (state.paperMode === 'mixed') {
          // Each mixed-mode section can draw from a different batch/subject —
          // reset the bank filters to the new section's own scope.
          state.filters = {
            subject: sec.subject || '',
            chapter: '',
            difficulty: '',
          };
          await _loadBankQuestions();
          _buildFilterOptions();
        }
        _renderSectionTabs();
        _renderRandomPickPanel();
        _renderSelectedList();
        _renderBankList();
      });
      tabs.appendChild(btn);
    });
  }

  // ── Random Pick (server-side $sample, for 'random'/'mixed' sections) ──

  function _sectionScope(sec) {
    // Mixed sections are always subject-wide (no chapter field at all —
    // see _renderSectionsList). Non-mixed: chapter only carries through for
    // 'manual'/'chapter_random' — _commitStep1 already clears it to '' for
    // 'random' (Whole Subject), so this just reflects that.
    return state.paperMode === 'mixed'
      ? { batch: sec?.source_batch || '', subject: sec?.subject || '', chapter: '' }
      : { batch: state.quiz?.batch || '', subject: state.quiz?.subject || '', chapter: state.quiz?.chapter || '' };
  }

  function _renderRandomPickPanel() {
    const panel = $('tb-random-pick-panel');
    if (!panel) return;
    const sec = state.sections[state.activeSection];
    if (!sec || sec.mode !== 'random') { panel.innerHTML = ''; return; }

    const scope = _sectionScope(sec);
    // chapter is optional here — omitted means subject-wide, pulling from
    // every existing test's questions in that subject (the normal case for
    // scholarship/NMMS-style sections). Only batch+subject are required.
    const scopeLabel = scope.chapter
      ? [scope.batch, scope.subject, scope.chapter].filter(Boolean).join(' › ')
      : [scope.batch, scope.subject].filter(Boolean).join(' › ') + (scope.batch && scope.subject ? ' (whole subject)' : '');

    panel.innerHTML = `
      <div class="tb-automix" style="border-color:#6366f1">
        <p class="tb-sub-label">🎲 Random Pick${scopeLabel.trim() ? ` — ${_esc(scopeLabel)}` : ''}</p>
        ${(!scope.batch || !scope.subject)
          ? `<p class="tb-sub-hint" style="color:#dc2626">Set this section's Batch/Subject first.</p>`
          : `
            <div class="tb-automix-row">
              <label>Count <input type="number" id="tb-rp-count" class="admin-input tb-mix-inp" min="1" max="200" value="${sec.count || 10}"></label>
              <button class="admin-btn-secondary" id="tb-rp-generate">🎲 Generate</button>
              <button class="admin-btn-secondary" id="tb-rp-reroll">🔄 Re-roll</button>
            </div>
            <p class="tb-sub-hint">Picks from questions already in your existing published tests for this ${scope.chapter ? 'chapter' : 'subject'}.</p>
            <p class="tb-sub-hint" id="tb-rp-status"></p>
          `}
      </div>
    `;

    $('tb-rp-generate')?.addEventListener('click', () => _doRandomPick({ replace: false }));
    $('tb-rp-reroll')?.addEventListener('click', () => _doRandomPick({ replace: true }));
  }

  async function _doRandomPick({ replace }) {
    const sec = state.sections[state.activeSection];
    if (!sec) return;
    const scope = _sectionScope(sec);
    if (!scope.batch || !scope.subject) return;

    const count = Math.max(1, parseInt($('tb-rp-count')?.value) || sec.count || 10);
    sec.count = count;

    // Generate (additive): never re-pick questions already in this section.
    // Re-roll: clear the section first, so a full fresh set is requested.
    const excludeIds = replace ? [] : sec.question_ids.slice();
    const statusEl = $('tb-rp-status');
    if (statusEl) statusEl.textContent = 'Fetching…';

    try {
      const results = await API.generateQuizQuestions([{
        key: sec.id, source_batch: scope.batch, subject: scope.subject, chapter: scope.chapter,
        count, exclude_q_ids: excludeIds,
      }]);
      const result = results[0];

      if (!result || !result.questions.length) {
        APP.toast(scope.chapter ? 'No matching questions found in that chapter' : 'No matching questions found in that subject', 'error');
        if (statusEl) statusEl.textContent = '';
        return;
      }

      for (const q of result.questions) {
        await DB.saveQuestion({ ...q, batch: scope.batch, subject: scope.subject, chapter: scope.chapter });
      }

      if (replace) sec.question_ids = [];
      result.questions.forEach(q => {
        if (!sec.question_ids.includes(q.q_id)) sec.question_ids.push(q.q_id);
      });

      await _loadBankQuestions();
      _renderBankList();
      _renderSelectedList();
      _renderSectionTabs();

      if (statusEl) {
        statusEl.textContent = result.returned < result.requested
          ? `⚠️ Only ${result.returned} of ${result.requested} available in this chapter`
          : `✅ ${result.returned} questions picked`;
      }
    } catch (err) {
      APP.toast(err?.message || 'Random pick failed', 'error');
      if (statusEl) statusEl.textContent = '';
    }
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
          <div class="tb-bank-item-text">${_esc(_questionSummary(q, 90))}</div>
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
          ? _esc(_questionSummary(q, 65))
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
    const counts = {
      easy  : Math.max(0, parseInt($('tb-mix-easy')?.value)   || 0),
      medium: Math.max(0, parseInt($('tb-mix-medium')?.value) || 0),
      hard  : Math.max(0, parseInt($('tb-mix-hard')?.value)   || 0),
    };
    if (!counts.easy && !counts.medium && !counts.hard) { APP.toast('Enter at least one count', 'error'); return; }

    const sec      = state.sections[state.activeSection];
    const selected = _getAllSelectedQIds();
    const scope    = _sectionScope(sec);

    // True server-side random pick (a real $sample from existing tests'
    // questions, not a client-side reshuffle of whatever happens to already
    // be loaded) whenever we know this section's batch+subject — chapter is
    // optional (subject-wide). Note: the source (existing quizzes'
    // questions[]) doesn't carry a difficulty tag, so the Easy/Med/Hard
    // buckets below no longer distinguish server-side — each bucket draws
    // from the same subject-wide pool; client-side dedup below still keeps
    // the final selection correct, just not difficulty-differentiated.
    if (scope.batch && scope.subject) {
      try {
        const reqSections = Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([difficulty, count]) => ({
            key: `${sec.id}_${difficulty}`, source_batch: scope.batch, subject: scope.subject, chapter: scope.chapter,
            count, exclude_q_ids: selected,
          }));
        const results = await API.generateQuizQuestions(reqSections);
        let pickedCount = 0;
        for (const result of results) {
          for (const q of result.questions) {
            await DB.saveQuestion({ ...q, batch: scope.batch, subject: scope.subject, chapter: scope.chapter });
            if (!sec.question_ids.includes(q.q_id)) { sec.question_ids.push(q.q_id); pickedCount++; }
          }
        }
        if (!pickedCount) { APP.toast('No matching questions available', 'info'); return; }
        await _loadBankQuestions();
        _renderBankList();
        _renderSelectedList();
        _renderSectionTabs();
        APP.toast(`✅ ${pickedCount} questions auto-selected`, 'success');
        return;
      } catch (err) {
        console.warn('Server auto-mix failed, falling back to local bank sampling:', err?.message);
        // fall through to the offline-safe client-side sampling below
      }
    }

    // Fallback: legacy client-side sampling from the already-loaded local
    // bank — used when this section's scope isn't set yet, or the server
    // call failed/is offline.
    const pool = state.bankQuestions.filter(q => !selected.includes(q.q_id));
    const pick = (diff, count) => {
      const bucket = pool.filter(q => q.difficulty === diff);
      return [...bucket].sort(() => Math.random() - 0.5).slice(0, count).map(q => q.q_id);
    };

    const picked = [...pick('easy', counts.easy), ...pick('medium', counts.medium), ...pick('hard', counts.hard)];
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
    const qImage = _cleanUrl($('tb-manual-q-image')?.value);
    const type  = $('tb-manual-type')?.value || 'mcq';
    const diff  = $('tb-manual-diff')?.value || 'medium';

    if (!qText && !qImage) { APP.toast('Question text or question image URL is required', 'error'); return; }

    const q = {
      question  : qText,
      image     : qImage,
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
      q.options = {
        A: a,
        B: b,
        C: $('tb-manual-c')?.value.trim() || '',
        D: $('tb-manual-d')?.value.trim() || '',
      };
      q.option_images = {
        A: _cleanUrl($('tb-manual-a-image')?.value),
        B: _cleanUrl($('tb-manual-b-image')?.value),
        C: _cleanUrl($('tb-manual-c-image')?.value),
        D: _cleanUrl($('tb-manual-d-image')?.value),
      };
      q.answer = $('tb-manual-answer')?.value || 'A';

      const populated = ['A', 'B', 'C', 'D'].filter(key =>
        _hasOptionContent(q.options[key], q.option_images[key])
      );
      if (populated.length < 2) { APP.toast('Add at least two MCQ options using text or image URL', 'error'); return; }
      if (!populated.includes(q.answer)) { APP.toast('Correct answer must point to an option with text or image', 'error'); return; }

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
    if ($('tb-manual-q-image')) $('tb-manual-q-image').value = '';
    if ($('tb-manual-a'))       $('tb-manual-a').value       = '';
    if ($('tb-manual-b'))       $('tb-manual-b').value       = '';
    if ($('tb-manual-c'))       $('tb-manual-c').value       = '';
    if ($('tb-manual-d'))       $('tb-manual-d').value       = '';
    if ($('tb-manual-a-image')) $('tb-manual-a-image').value = '';
    if ($('tb-manual-b-image')) $('tb-manual-b-image').value = '';
    if ($('tb-manual-c-image')) $('tb-manual-c-image').value = '';
    if ($('tb-manual-d-image')) $('tb-manual-d-image').value = '';
    if ($('tb-manual-fib-ans')) $('tb-manual-fib-ans').value = '';

    await _loadBankQuestions();
    _renderBankList();
    _renderSelectedList();
    _renderSectionTabs();
    APP.toast('✅ Question created and added to section', 'success');
  }

  // ── Bulk Paste Parser ──────────────────────

  function _copyBulkPrompt() {
    const text = $('tb-bulk-sample-prompt')?.textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text.trim())
      .then(() => APP.toast('✅ Prompt copied! Paste it in ChatGPT/Gemini', 'success'))
      .catch(() => {
        // Fallback for older browsers / WebViews without Clipboard API
        const ta = document.createElement('textarea');
        ta.value = text.trim();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        APP.toast('✅ Prompt copied!', 'success');
      });
  }

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
    const totalMarks = state.sections.reduce(
      (sum, sec) => sum + sec.question_ids.length * (sec.positive_marks ?? quiz?.positive_marks ?? 1),
      0
    );
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
        <button class="admin-btn-secondary" id="tb-export-pdf">📄 Download PDF</button>
        <button class="admin-btn-secondary" id="tb-print-quiz">🖨 Print</button>
        <button class="admin-btn-secondary" id="tb-toggle-answers">
          ${state.previewShowAnswers ? '🙈 Hide Answers' : '👁 Show Answers'}
        </button>
        <button class="admin-btn-secondary" id="tb-save-draft3">💾 Save Draft</button>
        <button class="admin-btn-primary"   id="tb-publish">🚀 Publish Quiz</button>
      </div>
    `;

    $('tb-back-2').addEventListener('click', () => _renderStep(2));
    $('tb-export-pdf').addEventListener('click', () => QUIZ_PDF.exportQuizPaper(state.quiz));
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
    const questionImage = q.image
      ? `<div class="tb-preview-qimg"><img src="${_esc(q.image)}" alt="Question image" loading="lazy" decoding="async" style="max-width:320px;width:100%;max-height:220px;object-fit:contain;border-radius:14px;border:1px solid rgba(0,0,0,0.12);padding:8px;margin:10px 0 14px;" /></div>`
      : '';

    if (q.type === 'fib') {
      answersHtml = `
        <div class="tb-preview-fib-blank">____________</div>
        <div class="tb-preview-fib-key preview-answer">Answer: ${_esc(q.answer || '')}</div>
      `;
    } else {
      const opts = q.options || {};
      const optionImages = q.option_images || {};
      answersHtml = `
        <div class="tb-preview-opts">
          ${Object.entries(opts).filter(([k, v]) => v || optionImages[k]).map(([k, v]) => `
            <span class="tb-preview-opt${q.answer === k ? ' correct-ans preview-answer' : ''}">
              <b>${k})</b>${v ? ` ${_esc(v)}` : ''}
              ${optionImages[k] ? `<img src="${_esc(optionImages[k])}" alt="Option ${_esc(k)} image" loading="lazy" decoding="async" style="display:block;max-width:180px;width:100%;max-height:120px;object-fit:contain;border-radius:10px;border:1px solid rgba(0,0,0,0.12);padding:6px;margin-top:8px;" />` : ''}
            </span>`).join('')}
        </div>
      `;
    }

    return `
      <div class="tb-preview-q">
        <div class="tb-preview-qnum">Q${qIdx + 1}.</div>
        <div class="tb-preview-qbody">
          <div class="tb-preview-qtext">${_esc(q.question || '')}</div>
          ${questionImage}
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

    const isPublish = status === 'published';
    const localQuiz = {
      ...state.quiz,
      sections          : state.sections,
      status            : 'draft',
      synced            : false,
      pending_publish   : isPublish,
      last_publish_error: '',
    };

    const saved = await DB.saveQuiz(localQuiz);
    state.quiz  = saved;

    if (isPublish) {
      try {
        const result = await SYNC.publishQuiz(saved);
        state.quiz = result?.quiz || await DB.getQuiz(saved.quiz_id) || saved;

        if (result?.synced) {
          APP.toast(`🚀 "${state.quiz.title}" published successfully!`, 'success');
          close();
        } else if (result?.queued) {
          close();
        }
      } catch {
        state.quiz = await DB.getQuiz(saved.quiz_id).catch(() => saved);
      }
    } else {
      APP.toast(`💾 Draft saved — "${saved.title}"`, 'info');
    }

    if (typeof ADMIN !== 'undefined' && typeof ADMIN.loadQuizList === 'function') {
      ADMIN.loadQuizList();
    }
    if (typeof APP !== 'undefined' && typeof APP.refreshHome === 'function') {
      APP.refreshHome();
    }
  }

  // ════════════════════════
  // IMAGE UPLOAD
  // ════════════════════════

  function _setupImgUpload(fileId, btnId, urlId, statusId) {
    const btn    = $(btnId);
    const fileEl = $(fileId);
    if (!btn || !fileEl) return;

    btn.addEventListener('click', () => fileEl.click());

    fileEl.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      const status = statusId ? $(statusId) : null;
      if (status) status.textContent = 'Compressing…';
      btn.disabled = true;

      try {
        const compress = window.ADMIN_UTILS?.compressImage;
        if (!compress) throw new Error('Compress not ready — reload page');
        const b64 = await compress(file, 1200, 900, 0.80);
        if (status) status.textContent = 'Uploading…';
        const res = await API.uploadWordImage(b64);
        const urlEl = $(urlId);
        if (urlEl) urlEl.value = res.url;
        if (status) {
          status.textContent = '✓ Done';
          setTimeout(() => { if (status) status.textContent = ''; }, 2000);
        }
        window.APP?.toast?.('Image uploaded', 'success');
      } catch (err) {
        if (status) status.textContent = '✗ Failed';
        window.APP?.toast?.('Upload failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
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
