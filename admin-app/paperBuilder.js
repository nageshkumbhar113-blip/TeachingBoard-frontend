/* global API, DB, APP */
'use strict';

const PAPER_BUILDER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // ════════════════════════════════════════════════════════════════════════════
  // STATE
  // ════════════════════════════════════════════════════════════════════════════

  let _batch = '';
  // Multi-select: a single paper can now span multiple Subjects/Chapters
  // (user-requested). _subjects is a plain array of subject names (checked
  // boxes); _chapters is an array of { chapterId, chapter, subject } for
  // every CHECKED chapter, combined across all checked subjects.
  let _subjects = [];
  let _chapters = [];
  let _initialized = false;
  let _selectedQuestions = []; // [{_id, marks, questionText, usageCount, chapterId}]
  let _activeMarks = null;
  let _searchDebounce = null;

  // Comma-joined chapterId list for the question-search/auto-fill API (see
  // slsController.js's getQuestions — a single chapterId still behaves
  // exactly as before; more than one uses $in server-side).
  function _chapterIdsParam() {
    return _chapters.map(c => c.chapterId).join(',');
  }

  // Same deterministic chapterId builder as conceptManager.js — must match
  // exactly, since Exercise questions are created against that chapterId.
  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════════════════

  async function init() {
    if (_initialized) return;
    _initialized = true;
    _setupEventListeners();
    _populateBatches();
  }

  function _setupEventListeners() {
    $('pb-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    // Subject/Chapter checklists are re-rendered whenever their options
    // change, so their change listeners are (re-)bound in the render
    // functions themselves (_renderSubjectChecklist/_renderChapterChecklist)
    // rather than once here.

    document.querySelectorAll('.pb-mark-btn').forEach(btn => {
      btn.addEventListener('click', () => _openMarkPicker(parseInt(btn.dataset.marks, 10)));
    });

    $('pb-autofill-btn')?.addEventListener('click', () => _runAutoFill());
    $('pb-save-btn')?.addEventListener('click', () => _savePaper());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DROPDOWNS / CHECKLISTS (same pattern as CONCEPT_MANAGER, plus a
  // multi-select checklist for Subject/Chapter — see this file's header)
  // ════════════════════════════════════════════════════════════════════════════

  async function _populateBatches() {
    const sel = $('pb-batch-sel');
    if (!sel) return;
    try {
      const batches = await DB.getAllBatches();
      sel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = b.name;
        sel.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load batches:', err);
      APP.toast('Failed to load batches', 'error');
    }
  }

  async function _onBatchChange(batch) {
    _batch = batch;
    _subjects = [];
    _chapters = [];
    _resetPaperState();

    const subjectList = $('pb-subject-list');
    const chapterList = $('pb-chapter-list');
    if (subjectList) subjectList.innerHTML = '<p class="empty-hint">आधी Batch निवडा.</p>';
    if (chapterList) chapterList.innerHTML = '<p class="empty-hint">आधी Subject निवडा.</p>';

    if (!batch) return;
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      _renderSubjectChecklist(subs.map(s => s.name));
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  }

  function _renderSubjectChecklist(subjectNames) {
    const list = $('pb-subject-list');
    if (!list) return;
    if (!subjectNames.length) {
      list.innerHTML = '<p class="empty-hint">या Batch मध्ये अजून Subject नाही.</p>';
      return;
    }
    list.innerHTML = subjectNames.map(name => `
      <label class="student-batch-item">
        <input type="checkbox" class="pb-subject-cb" value="${_esc(name)}" />
        <span>${_esc(name)}</span>
      </label>`).join('');
    list.querySelectorAll('.pb-subject-cb').forEach(cb => {
      cb.addEventListener('change', _onSubjectsChanged);
    });
  }

  async function _onSubjectsChanged() {
    _subjects = [...document.querySelectorAll('#pb-subject-list input.pb-subject-cb:checked')].map(cb => cb.value);
    _chapters = [];
    _resetPaperState();

    const chapterList = $('pb-chapter-list');
    if (!_subjects.length) {
      if (chapterList) chapterList.innerHTML = '<p class="empty-hint">आधी Subject निवडा.</p>';
      return;
    }
    if (chapterList) chapterList.innerHTML = '<p class="empty-hint">Loading…</p>';
    try {
      // One request per selected Subject (there are only ever a handful of
      // Subjects per Batch) — merged into a single combined checklist,
      // each item still labeled with its own Subject.
      const perSubject = await Promise.all(
        _subjects.map(async subject => {
          const chapters = await DB.getChaptersByBatchSubject(_batch, subject);
          return chapters.map(ch => ({ subject, chapter: ch.name, chapterId: _makeChapterId(_batch, subject, ch.name) }));
        })
      );
      _renderChapterChecklist(perSubject.flat());
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }

  function _renderChapterChecklist(items) {
    const list = $('pb-chapter-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="empty-hint">या Subject(s) मध्ये अजून Chapter नाही.</p>';
      return;
    }
    list.innerHTML = items.map(it => `
      <label class="student-batch-item">
        <input type="checkbox" class="pb-chapter-cb" value="${_esc(it.chapterId)}" data-subject="${_esc(it.subject)}" data-chapter="${_esc(it.chapter)}" />
        <span>${_esc(it.chapter)}<span class="pb-chapter-subject-tag">(${_esc(it.subject)})</span></span>
      </label>`).join('');
    list.querySelectorAll('.pb-chapter-cb').forEach(cb => {
      cb.addEventListener('change', _onChaptersChanged);
    });
  }

  function _onChaptersChanged() {
    _chapters = [...document.querySelectorAll('#pb-chapter-list input.pb-chapter-cb:checked')].map(cb => ({
      chapterId: cb.value,
      chapter: cb.dataset.chapter,
      subject: cb.dataset.subject,
    }));
    _resetPaperState();

    const hasChapter = _chapters.length > 0;
    $('pb-marks-section').style.display = hasChapter ? '' : 'none';
    $('pb-selected-section').style.display = hasChapter ? '' : 'none';
  }

  function _resetPaperState(hidePdfPanel = true) {
    _selectedQuestions = [];
    _activeMarks = null;
    $('pb-mark-picker')?.classList.add('hidden');
    _renderSelectedList();
    if (hidePdfPanel) {
      const panel = $('pb-pdf-section');
      if (panel) panel.style.display = 'none';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MARK PICKER (search + least-used-first dropdown)
  // ════════════════════════════════════════════════════════════════════════════

  // Chapter/subject label for a question, shown only once multiple chapters
  // are selected (a single-chapter selection stays exactly as clean as before).
  function _chapterLabelFor(chapterId) {
    if (_chapters.length < 2) return '';
    const ch = _chapters.find(c => c.chapterId === chapterId);
    return ch ? ` · ${ch.subject} — ${ch.chapter}` : '';
  }

  async function _openMarkPicker(marks) {
    if (!_chapters.length) return;
    _activeMarks = marks;
    const picker = $('pb-mark-picker');
    picker.classList.remove('hidden');
    picker.innerHTML = `
      <div class="pb-picker-head">
        <b>${marks} Mark प्रश्न निवडा</b>
        <button type="button" class="btn-icon" id="pb-picker-close">✕</button>
      </div>
      <input id="pb-picker-search" class="admin-input" type="search" placeholder="प्रश्न शोधा..." />
      <div id="pb-picker-list" class="pb-picker-list"><p class="empty-hint">Loading…</p></div>
    `;
    $('pb-picker-close').addEventListener('click', () => picker.classList.add('hidden'));
    $('pb-picker-search').addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => _loadPickerQuestions(marks, $('pb-picker-search').value), 300);
    });
    await _loadPickerQuestions(marks, '');
  }

  async function _loadPickerQuestions(marks, q) {
    const list = $('pb-picker-list');
    if (!list) return;
    list.innerHTML = '<p class="empty-hint">Loading…</p>';
    try {
      const questions = await API.fetchAdminSlsQuestions({
        chapterId: _chapterIdsParam(), marks, status: 'published', q, sort: 'usageCount', limit: 50
      });
      if (!questions.length) {
        list.innerHTML = '<p class="empty-hint">या chapter/marks साठी published प्रश्न नाहीत.</p>';
        return;
      }
      list.innerHTML = questions.map(qq => {
        const already = _selectedQuestions.some(s => s._id === qq._id);
        const text = qq.questionText?.marathi || qq.questionText?.english || '';
        return `
        <div class="pb-picker-item">
          <div class="pb-picker-qtext">${_esc(text)}</div>
          <div class="pb-picker-meta">वापर: ${qq.usageCount || 0}x${_esc(_chapterLabelFor(qq.chapterId))}</div>
          <button type="button" class="btn btn-small pb-picker-add-btn" data-id="${qq._id}" ${already ? 'disabled' : ''}>
            ${already ? '✓ जोडलं' : '+ जोडा'}
          </button>
        </div>`;
      }).join('');
      list.querySelectorAll('.pb-picker-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const qq = questions.find(x => x._id === btn.dataset.id);
          if (qq) _addSelectedQuestion(qq);
          btn.disabled = true;
          btn.textContent = '✓ जोडलं';
        });
      });
    } catch (err) {
      console.error('Failed to load questions:', err);
      list.innerHTML = '<p class="empty-hint">Error — पुन्हा प्रयत्न करा.</p>';
    }
  }

  function _addSelectedQuestion(qq) {
    if (_selectedQuestions.some(s => s._id === qq._id)) return;
    _selectedQuestions.push({
      _id: qq._id,
      marks: qq.marks,
      questionText: qq.questionText,
      usageCount: qq.usageCount || 0,
      chapterId: qq.chapterId,
    });
    _renderSelectedList();
  }

  function _removeSelectedQuestion(id) {
    _selectedQuestions = _selectedQuestions.filter(s => s._id !== id);
    _renderSelectedList();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SELECTED LIST + TOTAL
  // ════════════════════════════════════════════════════════════════════════════

  function _renderSelectedList() {
    const list = $('pb-selected-list');
    const chip = $('pb-total-marks');
    if (!list || !chip) return;

    const total = _selectedQuestions.reduce((sum, q) => sum + q.marks, 0);
    chip.textContent = `Total: ${total} marks (${_selectedQuestions.length} प्रश्न)`;

    if (!_selectedQuestions.length) {
      list.innerHTML = '<p class="empty-hint">अजून प्रश्न जोडलेले नाहीत — वरील marks button दाबून प्रश्न निवडा.</p>';
      return;
    }

    list.innerHTML = _selectedQuestions.map((q, i) => {
      const text = q.questionText?.marathi || q.questionText?.english || '';
      return `
      <div class="pb-selected-item" data-id="${q._id}">
        <span class="cm-marks-chip">${q.marks} marks</span>
        <span class="pb-selected-text">${i + 1}. ${_esc(text)}${_esc(_chapterLabelFor(q.chapterId))}</span>
        <button type="button" class="btn-icon pb-remove-btn" data-id="${q._id}" title="काढा">🗑</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.pb-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => _removeSelectedQuestion(btn.dataset.id));
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // AUTO-FILL REMAINING (client-side greedy least-used-first — does NOT call
  // the generate endpoint, since that endpoint persists a whole extra paper
  // as a side effect; this only reads via GET, then the normal Save persists
  // exactly one paper)
  // ════════════════════════════════════════════════════════════════════════════

  async function _runAutoFill() {
    const targetInput = $('pb-autofill-target');
    const target = parseInt(targetInput?.value, 10);
    if (!target || target <= 0) {
      APP.toast('आधी Target Marks टाका', 'error');
      return;
    }
    let remaining = target - _selectedQuestions.reduce((s, q) => s + q.marks, 0);
    if (remaining <= 0) {
      APP.toast('Target आधीच पूर्ण झालं आहे', 'info');
      return;
    }

    const btn = $('pb-autofill-btn');
    btn.disabled = true;
    btn.textContent = '⏳ शोधत आहे...';

    let addedCount = 0;
    let guard = 0;
    try {
      while (remaining > 0 && guard < 30) {
        guard++;
        const tryMarks = Math.min(5, remaining);
        let picked = null;
        for (let m = tryMarks; m >= 1 && !picked; m--) {
          const candidates = await API.fetchAdminSlsQuestions({
            chapterId: _chapterIdsParam(), marks: m, status: 'published', sort: 'usageCount', limit: 20
          });
          picked = candidates.find(c => !_selectedQuestions.some(s => s._id === c._id));
          if (picked) {
            _addSelectedQuestion(picked);
            remaining -= picked.marks;
            addedCount++;
          }
        }
        if (!picked) break; // nothing left to add at any marks value <= remaining
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '⚡ उरलेलं Auto-fill करा';
    }

    if (addedCount === 0) {
      APP.toast('अजून प्रश्न सापडले नाहीत (question bank मध्ये पुरेसे प्रश्न नाहीत)', 'error');
    } else if (remaining > 0) {
      APP.toast(`${addedCount} प्रश्न जोडले, पण ${remaining} marks अजून बाकी (प्रश्न अपुरे)`, 'info');
    } else {
      APP.toast(`✅ ${addedCount} प्रश्न auto-fill झाले, target पूर्ण!`, 'success');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SAVE
  // ════════════════════════════════════════════════════════════════════════════

  async function _savePaper() {
    if (!_batch || !_subjects.length || !_chapters.length) {
      APP.toast('आधी Batch/Subject/Chapter निवडा', 'error');
      return;
    }
    if (!_selectedQuestions.length) {
      APP.toast('किमान एक प्रश्न जोडा', 'error');
      return;
    }
    const title = $('pb-title')?.value?.trim();

    const btn = $('pb-save-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';
    try {
      const chapterIds = _chapters.map(c => c.chapterId);
      const paper = await API.createAdminSlsPaperManual({
        batchId: _batch,
        // Singular fields = first selected one, for any older reader that
        // still expects a single chapterId/subjectId (see PracticePaper's
        // own comment). chapterIds/subjectIds carry the FULL selection.
        chapterId: chapterIds[0],
        subjectId: _subjects[0],
        chapterIds,
        subjectIds: _subjects,
        paperTitle: title || undefined,
        questions: _selectedQuestions.map(q => ({ questionId: q._id, marks: q.marks }))
      });
      APP.toast(`✅ Paper "${paper.paperTitle}" saved (Paper #${paper.paperNumber})`, 'success');
      _showPdfExportPanel(paper);
      _resetPaperState(false);
      if ($('pb-title')) $('pb-title').value = '';
      if ($('pb-autofill-target')) $('pb-autofill-target').value = '';
    } catch (err) {
      console.error('Failed to save paper:', err);
      APP.toast('Paper save करताना error आला', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Paper Save करा';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PDF EXPORT (Phase 4 — jsPDF + html2canvas, see core/paperPdf.js)
  // ════════════════════════════════════════════════════════════════════════════

  function _showPdfExportPanel(paper) {
    const panel = $('pb-pdf-section');
    if (!panel) return;
    panel.style.display = '';
    panel.innerHTML = `
      <h3>📄 "${_esc(paper.paperTitle)}" तयार झाला</h3>
      <div class="pb-pdf-actions">
        <button type="button" class="btn btn-secondary" id="pb-pdf-qp-btn">📄 Question Paper PDF</button>
        <button type="button" class="btn btn-secondary" id="pb-pdf-ans-btn">📝 Answer Sheet PDF</button>
      </div>
      <p class="empty-hint" id="pb-pdf-status"></p>
    `;
    $('pb-pdf-qp-btn').addEventListener('click', () => _exportPdf(paper, false, $('pb-pdf-qp-btn')));
    $('pb-pdf-ans-btn').addEventListener('click', () => _exportPdf(paper, true, $('pb-pdf-ans-btn')));
  }

  async function _exportPdf(paper, withAnswers, btn) {
    const status = $('pb-pdf-status');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ तयार करत आहे...';
    if (status) status.textContent = '';
    try {
      // Paper object from create response doesn't have hydrated question
      // text (only questionId) — fetch the full paper with question details.
      const full = await API.fetchAdminSlsPaper(paper._id);
      if (withAnswers) await PAPER_PDF.exportAnswerSheet(full);
      else await PAPER_PDF.exportQuestionPaper(full);
      if (status) status.textContent = '✅ PDF तयार झाला — share sheet उघडलं आहे.';
    } catch (err) {
      console.error('PDF export failed:', err);
      if (status) status.textContent = '❌ PDF तयार करताना error आला.';
      APP.toast('PDF export failed', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  return {
    init,
    __test: {
      setState: ({ batch, subjects, chapters } = {}) => {
        if (batch !== undefined) _batch = batch;
        if (subjects !== undefined) _subjects = subjects;
        if (chapters !== undefined) _chapters = chapters;
      },
      getState: () => ({ batch: _batch, subjects: _subjects, chapters: _chapters, selectedQuestions: _selectedQuestions }),
      onBatchChange: _onBatchChange,
      onSubjectsChanged: _onSubjectsChanged,
      onChaptersChanged: _onChaptersChanged,
      chapterIdsParam: _chapterIdsParam,
      chapterLabelFor: _chapterLabelFor,
      openMarkPicker: _openMarkPicker,
      runAutoFill: _runAutoFill,
      savePaper: _savePaper,
      addSelectedQuestion: _addSelectedQuestion,
    },
  };
})();

window.PAPER_BUILDER = PAPER_BUILDER;
