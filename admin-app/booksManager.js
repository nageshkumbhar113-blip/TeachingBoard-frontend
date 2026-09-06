/* global API, DB, APP, QUIZ_PDF, NOTES_PDF, EXERCISE_PDF */
'use strict';

/* ════════════════════════════════════════
   booksManager.js — 📚 Books admin tab
   5 Book types, each combining Chapter/Subject content into one PDF.
   Nothing is saved/stored — every click generates fresh and downloads
   immediately (confirmed with the user: ephemeral by design).
   Global: BOOKS_MANAGER
════════════════════════════════════════ */

const BOOKS_MANAGER = (() => {
  const $ = id => document.getElementById(id);
  let _initialized = false;

  // Same deterministic chapterId builder used across conceptManager.js /
  // exerciseManager.js / paperBuilder.js — must match exactly.
  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  async function init() {
    if (_initialized) return;
    _initialized = true;
    _setupNav();
    _setupNotesWizard();
    _setupExerciseWizard();
    _setupSubjectWizard();
    _setupChapterWizard();
    _setupPatternWizard();
    await _populateAllBatchSelects();
  }

  // ════════════════════════════════════════════════════════════════════════
  // GRID <-> WIZARD NAV
  // ════════════════════════════════════════════════════════════════════════

  function _setupNav() {
    document.querySelectorAll('.bk-tile').forEach(tile => {
      tile.addEventListener('click', () => _showWizard(tile.dataset.wizard));
    });
    $('bk-crumb')?.addEventListener('click', _showGrid);
  }

  function _showWizard(name) {
    $('bk-grid').style.display = 'none';
    document.querySelectorAll('.bk-wizard').forEach(w => w.classList.remove('show'));
    $('bk-wizard-' + name)?.classList.add('show');
    $('bk-crumb')?.classList.remove('hidden');
  }

  function _showGrid() {
    document.querySelectorAll('.bk-wizard').forEach(w => w.classList.remove('show'));
    $('bk-grid').style.display = '';
    $('bk-crumb')?.classList.add('hidden');
  }

  // ════════════════════════════════════════════════════════════════════════
  // SHARED batch/subject/chapter dropdown helpers
  // ════════════════════════════════════════════════════════════════════════

  async function _populateAllBatchSelects() {
    const batches = await DB.getAllBatches();
    ['bk-notes-batch', 'bk-ex-batch', 'bk-subj-batch', 'bk-chap-batch', 'bk-pat-batch'].forEach(id => {
      const sel = $(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = `${b.icon || ''} ${b.name}`.trim();
        sel.appendChild(opt);
      });
    });
  }

  async function _populateSubjectSelect(batch, sel) {
    sel.innerHTML = '<option value="">Select Subject</option>';
    sel.disabled = true;
    if (!batch) return [];
    const subs = await DB.getSubjectsByBatch(batch);
    subs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    return subs;
  }

  async function _populateChapterSelect(batch, subject, sel, { wholeSubjectOption = false } = {}) {
    sel.innerHTML = wholeSubjectOption
      ? '<option value="">संपूर्ण Subject (सर्व Chapters)</option>'
      : '<option value="">Select Chapter</option>';
    sel.disabled = true;
    if (!batch || !subject) return [];
    const chapters = await DB.getChaptersByBatchSubject(batch, subject);
    chapters.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.name;
      opt.textContent = ch.name;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    return chapters;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. NOTES BOOK
  // ════════════════════════════════════════════════════════════════════════

  // User-requested: Notes Book's section headers (Learning Outcomes/Key
  // Points/etc, see core/notesPdf.js's _notesChromeText) were always
  // hardcoded English regardless of the batch's medium. Same local-
  // persistence pattern as Paper Builder's institution-name/PDF-language.
  const NOTES_LANGUAGE_KEY = 'notes_pdf_language';

  async function _setupNotesWizard() {
    $('bk-notes-batch')?.addEventListener('change', async e => {
      await _populateSubjectSelect(e.target.value, $('bk-notes-subject'));
      $('bk-notes-chapter').innerHTML = '<option value="">Select Chapter</option>';
      $('bk-notes-chapter').disabled = true;
    });
    $('bk-notes-subject')?.addEventListener('change', () => {
      _populateChapterSelect($('bk-notes-batch').value, $('bk-notes-subject').value, $('bk-notes-chapter'));
    });
    $('bk-notes-generate')?.addEventListener('click', _generateNotesBook);
    const savedLang = await DB.getSetting?.(NOTES_LANGUAGE_KEY, 'english').catch(() => 'english') || 'english';
    if ($('bk-notes-language')) $('bk-notes-language').value = savedLang;
  }

  async function _generateNotesBook() {
    const batch = $('bk-notes-batch')?.value;
    const subject = $('bk-notes-subject')?.value;
    const chapter = $('bk-notes-chapter')?.value;
    const language = $('bk-notes-language')?.value || 'english';
    if (!batch || !subject || !chapter) {
      APP.toast('Batch, Subject आणि Chapter तिन्ही निवडा', 'error');
      return;
    }
    await DB.setSetting?.(NOTES_LANGUAGE_KEY, language).catch(() => {});
    const statusEl = $('bk-notes-status');
    if (statusEl) statusEl.textContent = 'Notes आणत आहे...';
    try {
      const chapterId = _makeChapterId(batch, subject, chapter);
      // fetchAdminChapterConcepts is the CHAPTER LIST endpoint — the
      // backend deliberately projects only title/order/difficulty/
      // examTags/status there (.select(...) on the Mongo query, for a
      // fast-loading list), so description/learningOutcomes/shortNotes/
      // revisionBox are never present on these. Real bug found live: a
      // Notes Book generated from this list alone came out as titles +
      // an "Exam Tags" line only, even though the actual Notes had real
      // content — because that content was never in this response to
      // begin with. Each concept's FULL content only comes from the
      // single-concept detail endpoint (fetchAdminConcept), so fetch
      // that per concept before handing off to the PDF.
      const summaries = await API.fetchAdminChapterConcepts(chapterId, 'published');
      if (statusEl) statusEl.textContent = `Notes आढळले: ${summaries.length} — content आणत आहे...`;
      const concepts = await Promise.all(summaries.map(s => API.fetchAdminConcept(s._id)));
      const validConcepts = concepts.filter(Boolean);
      if (statusEl) statusEl.textContent = `Notes आढळले: ${validConcepts.length}`;
      await NOTES_PDF.exportNotesBookPdf({ batch, subject, chapter, language }, validConcepts);
    } catch (err) {
      APP.toast(err?.message || 'Notes Book तयार करता आलं नाही', 'error');
      if (statusEl) statusEl.textContent = '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. EXERCISE BOOK
  // ════════════════════════════════════════════════════════════════════════

  function _setupExerciseWizard() {
    $('bk-ex-batch')?.addEventListener('change', async e => {
      await _populateSubjectSelect(e.target.value, $('bk-ex-subject'));
      $('bk-ex-chapter').innerHTML = '<option value="">Select Chapter</option>';
      $('bk-ex-chapter').disabled = true;
    });
    $('bk-ex-subject')?.addEventListener('change', () => {
      _populateChapterSelect($('bk-ex-batch').value, $('bk-ex-subject').value, $('bk-ex-chapter'));
    });
    $('bk-ex-generate-q')?.addEventListener('click', () => _generateExerciseBook(false));
    $('bk-ex-generate-a')?.addEventListener('click', () => _generateExerciseBook(true));
  }

  async function _fetchExerciseGroups(batch, subject, chapter) {
    const chapterId = _makeChapterId(batch, subject, chapter);
    // No exerciseNo filter -> every Exercise No. under this chapter, same as
    // exerciseManager.js's _loadExerciseNos but grouped client-side here.
    // limit:500 -- the backend defaults to limit=20 per page when omitted
    // (a real bug found live: a chapter's several exercises together can
    // easily exceed 20 questions, silently truncating the Book). 500 is
    // exerciseManager.js's own existing safety margin for this same
    // whole-chapter query, reused here for consistency.
    const all = await API.fetchAdminSlsQuestions({ chapterId, status: 'published', limit: 500 });
    const byNo = new Map();
    all.forEach(q => {
      const no = q.exerciseNo || '(No.शिवाय)';
      if (!byNo.has(no)) byNo.set(no, []);
      byNo.get(no).push(q);
    });
    return Array.from(byNo.keys())
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(no => ({ exerciseNo: no, questions: byNo.get(no) }));
  }

  async function _generateExerciseBook(withAnswers) {
    const batch = $('bk-ex-batch')?.value;
    const subject = $('bk-ex-subject')?.value;
    const chapter = $('bk-ex-chapter')?.value;
    if (!batch || !subject || !chapter) {
      APP.toast('Batch, Subject आणि Chapter तिन्ही निवडा', 'error');
      return;
    }
    const statusEl = $('bk-ex-status');
    if (statusEl) statusEl.textContent = 'Exercises आणत आहे...';
    try {
      const groups = await _fetchExerciseGroups(batch, subject, chapter);
      const totalQ = groups.reduce((s, g) => s + g.questions.length, 0);
      if (statusEl) statusEl.textContent = `Exercises: ${groups.length} · एकूण प्रश्न: ${totalQ}`;
      await EXERCISE_PDF.exportExerciseBookPdf({ batch, subject, chapter }, groups, { withAnswers });
    } catch (err) {
      APP.toast(err?.message || 'Exercise Book तयार करता आलं नाही', 'error');
      if (statusEl) statusEl.textContent = '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. SUBJECT-WISE TEST BOOK — repeatable Subject+Count rows
  // ════════════════════════════════════════════════════════════════════════

  let _subjRows = []; // { id, subject, count }
  let _subjAvailableSubjects = [];

  function _setupSubjectWizard() {
    $('bk-subj-batch')?.addEventListener('change', async e => {
      _subjAvailableSubjects = await _populateSubjectSelectRaw(e.target.value);
      _subjRows = [];
      if (_subjAvailableSubjects.length) _addSubjRow();
      _renderSubjRows();
    });
    $('bk-subj-add-row')?.addEventListener('click', () => { _addSubjRow(); _renderSubjRows(); });
    $('bk-subj-select-all')?.addEventListener('click', () => {
      if (!_subjAvailableSubjects.length) { APP.toast('आधी Batch निवडा', 'error'); return; }
      _subjRows = _subjAvailableSubjects.map(s => ({ id: `r_${Date.now()}_${Math.random()}`, subject: s.name, count: 10 }));
      _renderSubjRows();
    });
    $('bk-subj-generate')?.addEventListener('click', _generateSubjectBook);
  }

  async function _populateSubjectSelectRaw(batch) {
    if (!batch) return [];
    return DB.getSubjectsByBatch(batch);
  }

  function _addSubjRow() {
    _subjRows.push({ id: `r_${Date.now()}_${Math.random()}`, subject: _subjAvailableSubjects[0]?.name || '', count: 10 });
  }

  function _renderSubjRows() {
    const host = $('bk-subj-rows');
    if (!host) return;
    host.innerHTML = _subjRows.map(row => `
      <div class="bk-row" data-id="${row.id}">
        <select class="form-select bk-subj-row-subject">
          ${_subjAvailableSubjects.map(s => `<option value="${s.name}" ${s.name === row.subject ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <input type="number" class="admin-input bk-subj-row-count" min="1" value="${row.count}" placeholder="Questions">
        <button type="button" class="bk-row-remove" title="Remove">✕</button>
      </div>`).join('');

    host.querySelectorAll('.bk-row').forEach(rowEl => {
      const id = rowEl.dataset.id;
      const row = _subjRows.find(r => r.id === id);
      rowEl.querySelector('.bk-subj-row-subject')?.addEventListener('change', e => { row.subject = e.target.value; });
      rowEl.querySelector('.bk-subj-row-count')?.addEventListener('input', e => { row.count = parseInt(e.target.value, 10) || 0; _renderSubjTotals(); });
      rowEl.querySelector('.bk-row-remove')?.addEventListener('click', () => {
        _subjRows = _subjRows.filter(r => r.id !== id);
        _renderSubjRows();
      });
    });
    _renderSubjTotals();
  }

  function _renderSubjTotals() {
    const el = $('bk-subj-totals');
    if (!el) return;
    const total = _subjRows.reduce((s, r) => s + (r.count || 0), 0);
    el.innerHTML = `<span>एकूण प्रश्न: <b>${total}</b></span>`;
  }

  async function _generateSubjectBook() {
    const batch = $('bk-subj-batch')?.value;
    if (!batch) { APP.toast('Batch निवडा', 'error'); return; }
    if (!_subjRows.length) { APP.toast('किमान एक Subject जोडा', 'error'); return; }

    const specs = _subjRows
      .filter(r => r.subject && r.count > 0)
      .map(r => ({ label: r.subject, subject: r.subject, chapter: '', count: r.count, marks: 1 }));
    if (!specs.length) { APP.toast('प्रत्येक Subject साठी बरोबर question count द्या', 'error'); return; }

    try {
      await QUIZ_PDF.exportTestBookPdf({ title: `${batch} — Subject-wise Test Book`, batch }, specs);
    } catch (err) {
      APP.toast(err?.message || 'Test Book तयार करता आलं नाही', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. CHAPTER-WISE TEST BOOK — single scope, single count
  // ════════════════════════════════════════════════════════════════════════

  function _setupChapterWizard() {
    $('bk-chap-batch')?.addEventListener('change', async e => {
      await _populateSubjectSelect(e.target.value, $('bk-chap-subject'));
      $('bk-chap-chapter').innerHTML = '<option value="">Select Chapter</option>';
      $('bk-chap-chapter').disabled = true;
    });
    $('bk-chap-subject')?.addEventListener('change', () => {
      _populateChapterSelect($('bk-chap-batch').value, $('bk-chap-subject').value, $('bk-chap-chapter'));
    });
    $('bk-chap-generate')?.addEventListener('click', _generateChapterBook);
  }

  async function _generateChapterBook() {
    const batch = $('bk-chap-batch')?.value;
    const subject = $('bk-chap-subject')?.value;
    const chapter = $('bk-chap-chapter')?.value;
    const count = parseInt($('bk-chap-count')?.value, 10) || 0;
    if (!batch || !subject || !chapter) { APP.toast('Batch, Subject आणि Chapter तिन्ही निवडा', 'error'); return; }
    if (count <= 0) { APP.toast('Question count बरोबर द्या', 'error'); return; }

    try {
      await QUIZ_PDF.exportTestBookPdf(
        { title: chapter, batch },
        [{ label: chapter, subject, chapter, count, marks: 1 }]
      );
    } catch (err) {
      APP.toast(err?.message || 'Test Book तयार करता आलं नाही', 'error');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. PAPER PATTERN BOOK — repeatable Subject+Chapter+Marks+Count sections
  // ════════════════════════════════════════════════════════════════════════

  let _patRows = []; // { id, subject, chapter, marks, count }
  let _patAvailableSubjects = [];
  let _patBatch = '';

  function _setupPatternWizard() {
    $('bk-pat-batch')?.addEventListener('change', async e => {
      _patBatch = e.target.value;
      _patAvailableSubjects = await _populateSubjectSelectRaw(_patBatch);
      _patRows = [];
      if (_patAvailableSubjects.length) _addPatRow();
      _renderPatRows();
    });
    $('bk-pat-add-row')?.addEventListener('click', () => { _addPatRow(); _renderPatRows(); });
    $('bk-pat-generate')?.addEventListener('click', _generatePatternBook);
  }

  function _addPatRow() {
    _patRows.push({
      id: `r_${Date.now()}_${Math.random()}`,
      subject: _patAvailableSubjects[0]?.name || '',
      chapter: '', // '' = whole subject
      marks: 1,
      count: 10,
    });
  }

  async function _renderPatRows() {
    const host = $('bk-pat-rows');
    if (!host) return;
    host.innerHTML = _patRows.map(row => `
      <div class="bk-row bk-row-pattern" data-id="${row.id}">
        <select class="form-select bk-pat-row-subject">
          ${_patAvailableSubjects.map(s => `<option value="${s.name}" ${s.name === row.subject ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <select class="form-select bk-pat-row-chapter"><option value="">संपूर्ण Subject (सर्व Chapters)</option></select>
        <input type="number" class="admin-input bk-pat-row-marks" min="0.25" step="0.25" value="${row.marks}" placeholder="Marks/Q">
        <input type="number" class="admin-input bk-pat-row-count" min="1" value="${row.count}" placeholder="Count">
        <button type="button" class="bk-row-remove" title="Remove">✕</button>
      </div>`).join('');

    for (const row of _patRows) {
      const rowEl = host.querySelector(`.bk-row[data-id="${row.id}"]`);
      if (!rowEl) continue;
      const chapterSel = rowEl.querySelector('.bk-pat-row-chapter');
      if (row.subject) await _populateChapterSelect(_patBatch, row.subject, chapterSel, { wholeSubjectOption: true });
      chapterSel.value = row.chapter || '';

      rowEl.querySelector('.bk-pat-row-subject')?.addEventListener('change', async e => {
        row.subject = e.target.value;
        row.chapter = '';
        await _populateChapterSelect(_patBatch, row.subject, chapterSel, { wholeSubjectOption: true });
      });
      chapterSel.addEventListener('change', e => { row.chapter = e.target.value; });
      rowEl.querySelector('.bk-pat-row-marks')?.addEventListener('input', e => { row.marks = parseFloat(e.target.value) || 1; _renderPatTotals(); });
      rowEl.querySelector('.bk-pat-row-count')?.addEventListener('input', e => { row.count = parseInt(e.target.value, 10) || 0; _renderPatTotals(); });
      rowEl.querySelector('.bk-row-remove')?.addEventListener('click', () => {
        _patRows = _patRows.filter(r => r.id !== row.id);
        _renderPatRows();
      });
    }
    _renderPatTotals();
  }

  function _renderPatTotals() {
    const el = $('bk-pat-totals');
    if (!el) return;
    const totalQ = _patRows.reduce((s, r) => s + (r.count || 0), 0);
    const totalMarks = _patRows.reduce((s, r) => s + (r.count || 0) * (r.marks || 0), 0);
    el.innerHTML = `<span>एकूण Sections: <b>${_patRows.length}</b></span><span>एकूण प्रश्न: <b>${totalQ}</b></span><span>एकूण marks: <b>${totalMarks}</b></span>`;
  }

  async function _generatePatternBook() {
    if (!_patBatch) { APP.toast('Batch निवडा', 'error'); return; }
    if (!_patRows.length) { APP.toast('किमान एक Section जोडा', 'error'); return; }

    const specs = _patRows
      .filter(r => r.subject && r.count > 0)
      .map(r => ({
        label: r.subject + (r.chapter ? ` — ${r.chapter}` : ''),
        subject: r.subject, chapter: r.chapter, count: r.count, marks: r.marks,
      }));
    if (!specs.length) { APP.toast('प्रत्येक Section साठी बरोबर values द्या', 'error'); return; }

    try {
      await QUIZ_PDF.exportTestBookPdf({ title: `${_patBatch} — Paper Pattern Book`, batch: _patBatch }, specs);
    } catch (err) {
      APP.toast(err?.message || 'Pattern Book तयार करता आलं नाही', 'error');
    }
  }

  return { init };
})();

window.BOOKS_MANAGER = BOOKS_MANAGER;
