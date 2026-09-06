/* ════════════════════════════════════════
   teacherPaperBuilder.js — Teacher Dashboard, Paper Builder tab
   Cut-down version of admin-app/paperBuilder.js: teachers can only
   build/save papers from the existing (admin-curated) question bank —
   no question create/edit/delete here. Supports the same multi-Subject/
   multi-Chapter selection as the admin version (the backend already
   treats teacher and admin identically for these routes — requireTeacherOrAdmin).
   Global: TEACHER_PAPER_BUILDER
════════════════════════════════════════ */

const TEACHER_PAPER_BUILDER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let _batch = '';
  // Multi-select: a single paper can span multiple Subjects/Chapters.
  // _subjects is a plain array of subject names (checked boxes); _chapters
  // is an array of { chapterId, chapter, subject } for every CHECKED
  // chapter, combined across all checked subjects.
  let _subjects = [];
  let _chapters = [];
  let _initialized = false;
  let _selectedQuestions = [];
  let _searchDebounce = null;

  const INSTITUTION_NAME_KEY = 'paper_builder_institution_name';

  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  // Comma-joined chapterId list for the question-search/auto-fill API (see
  // slsController.js's getQuestions — a single chapterId still behaves
  // exactly as before; more than one uses $in server-side).
  function _chapterIdsParam() {
    return _chapters.map(c => c.chapterId).join(',');
  }

  // Chapter/subject label for a question, shown only once multiple chapters
  // are selected (a single-chapter selection stays exactly as clean as before).
  function _chapterLabelFor(chapterId) {
    if (_chapters.length < 2) return '';
    const ch = _chapters.find(c => c.chapterId === chapterId);
    return ch ? ` · ${ch.subject} — ${ch.chapter}` : '';
  }

  async function init() {
    if (_initialized) return;
    _initialized = true;
    _setupEventListeners();
    // A teacher session never ran the admin sync flow, so the local
    // batch/subject/chapter catalog is empty on first use — pull it once.
    await API.syncServerBatches().catch(() => {});
    _populateBatches();
  }

  function _setupEventListeners() {
    $('tpb-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    // Subject/Chapter checklists re-bind their own change listeners each
    // time they're re-rendered (see _renderSubjectChecklist/_renderChapterChecklist).

    document.querySelectorAll('.tpb-mark-btn').forEach(btn => {
      btn.addEventListener('click', () => _openMarkPicker(parseInt(btn.dataset.marks, 10)));
    });

    $('tpb-autofill-btn')?.addEventListener('click', () => _runAutoFill());
    $('tpb-save-btn')?.addEventListener('click', () => _savePaper());
  }

  async function _populateBatches() {
    const sel = $('tpb-batch-sel');
    if (!sel || !window.DB?.getAllBatches) return;
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
    }
  }

  async function _onBatchChange(batch) {
    _batch = batch;
    _subjects = [];
    _chapters = [];
    _resetPaperState();

    const subjectList = $('tpb-subject-list');
    const chapterList = $('tpb-chapter-list');
    if (subjectList) subjectList.innerHTML = '<p class="td-hint td-hint-sm">आधी Batch निवडा.</p>';
    if (chapterList) chapterList.innerHTML = '<p class="td-hint td-hint-sm">आधी Subject निवडा.</p>';

    if (!batch) return;
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      _renderSubjectChecklist(subs.map(s => s.name));
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  }

  function _renderSubjectChecklist(subjectNames) {
    const list = $('tpb-subject-list');
    if (!list) return;
    if (!subjectNames.length) {
      list.innerHTML = '<p class="td-hint td-hint-sm">या Batch मध्ये अजून Subject नाही.</p>';
      return;
    }
    list.innerHTML = subjectNames.map(name => `
      <label class="student-batch-item">
        <input type="checkbox" class="tpb-subject-cb" value="${_esc(name)}" />
        <span>${_esc(name)}</span>
      </label>`).join('');
    list.querySelectorAll('.tpb-subject-cb').forEach(cb => {
      cb.addEventListener('change', _onSubjectsChanged);
    });
  }

  async function _onSubjectsChanged() {
    _subjects = [...document.querySelectorAll('#tpb-subject-list input.tpb-subject-cb:checked')].map(cb => cb.value);
    _chapters = [];
    _resetPaperState();

    const chapterList = $('tpb-chapter-list');
    if (!_subjects.length) {
      if (chapterList) chapterList.innerHTML = '<p class="td-hint td-hint-sm">आधी Subject निवडा.</p>';
      return;
    }
    if (chapterList) chapterList.innerHTML = '<p class="td-hint td-hint-sm">Loading…</p>';
    try {
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
    const list = $('tpb-chapter-list');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="td-hint td-hint-sm">या Subject(s) मध्ये अजून Chapter नाही.</p>';
      return;
    }
    list.innerHTML = items.map(it => `
      <label class="student-batch-item">
        <input type="checkbox" class="tpb-chapter-cb" value="${_esc(it.chapterId)}" data-subject="${_esc(it.subject)}" data-chapter="${_esc(it.chapter)}" />
        <span>${_esc(it.chapter)}<span class="pb-chapter-subject-tag">(${_esc(it.subject)})</span></span>
      </label>`).join('');
    list.querySelectorAll('.tpb-chapter-cb').forEach(cb => {
      cb.addEventListener('change', _onChaptersChanged);
    });
  }

  function _onChaptersChanged() {
    _chapters = [...document.querySelectorAll('#tpb-chapter-list input.tpb-chapter-cb:checked')].map(cb => ({
      chapterId: cb.value,
      chapter: cb.dataset.chapter,
      subject: cb.dataset.subject,
    }));
    _resetPaperState();

    const hasChapter = _chapters.length > 0;
    $('tpb-marks-section').style.display = hasChapter ? '' : 'none';
    $('tpb-selected-section').style.display = hasChapter ? '' : 'none';
  }

  function _resetPaperState(hidePdfPanel = true) {
    _selectedQuestions = [];
    $('tpb-mark-picker')?.classList.add('hidden');
    _renderSelectedList();
    if (hidePdfPanel) {
      const panel = $('tpb-pdf-section');
      if (panel) panel.style.display = 'none';
    }
  }

  async function _openMarkPicker(marks) {
    if (!_chapters.length) return;
    const picker = $('tpb-mark-picker');
    picker.classList.remove('hidden');
    picker.innerHTML = `
      <div class="tpb-picker-head">
        <b>${marks} Mark प्रश्न निवडा</b>
        <button type="button" class="btn-icon" id="tpb-picker-close">✕</button>
      </div>
      <input id="tpb-picker-search" class="td-modal-select" style="width:100%" type="search" placeholder="प्रश्न शोधा..." />
      <div id="tpb-picker-list" class="tpb-picker-list"><p class="td-hint td-hint-sm">Loading…</p></div>
    `;
    $('tpb-picker-close').addEventListener('click', () => picker.classList.add('hidden'));
    $('tpb-picker-search').addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => _loadPickerQuestions(marks, $('tpb-picker-search').value), 300);
    });
    await _loadPickerQuestions(marks, '');
  }

  async function _loadPickerQuestions(marks, q) {
    const list = $('tpb-picker-list');
    if (!list) return;
    list.innerHTML = '<p class="td-hint td-hint-sm">Loading…</p>';
    try {
      const questions = await API.fetchTeacherSlsQuestions({
        chapterId: _chapterIdsParam(), marks, status: 'published', q, sort: 'usageCount', limit: 50
      });
      if (!questions.length) {
        list.innerHTML = '<p class="td-hint td-hint-sm">या chapter/marks साठी published प्रश्न नाहीत.</p>';
        return;
      }
      list.innerHTML = questions.map(qq => {
        const already = _selectedQuestions.some(s => s._id === qq._id);
        const text = qq.questionText?.marathi || qq.questionText?.english || '';
        return `
        <div class="tpb-picker-item">
          <div class="tpb-picker-qtext">${_esc(text)}</div>
          <div class="tpb-picker-meta">वापर: ${qq.usageCount || 0}x${_esc(_chapterLabelFor(qq.chapterId))}</div>
          <button type="button" class="td-send-notif-btn tpb-picker-add-btn" data-id="${qq._id}" ${already ? 'disabled' : ''}>
            ${already ? '✓ जोडलं' : '+ जोडा'}
          </button>
        </div>`;
      }).join('');
      list.querySelectorAll('.tpb-picker-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const qq = questions.find(x => x._id === btn.dataset.id);
          if (qq) _addSelectedQuestion(qq);
          btn.disabled = true;
          btn.textContent = '✓ जोडलं';
        });
      });
    } catch (err) {
      console.error('Failed to load questions:', err);
      list.innerHTML = '<p class="td-hint td-hint-sm">Error — पुन्हा प्रयत्न करा.</p>';
    }
  }

  function _addSelectedQuestion(qq) {
    if (_selectedQuestions.some(s => s._id === qq._id)) return;
    _selectedQuestions.push({ _id: qq._id, marks: qq.marks, questionText: qq.questionText, chapterId: qq.chapterId });
    _renderSelectedList();
  }

  function _removeSelectedQuestion(id) {
    _selectedQuestions = _selectedQuestions.filter(s => s._id !== id);
    _renderSelectedList();
  }

  function _renderSelectedList() {
    const list = $('tpb-selected-list');
    const chip = $('tpb-total-marks');
    if (!list || !chip) return;

    const total = _selectedQuestions.reduce((sum, q) => sum + q.marks, 0);
    chip.textContent = `Total: ${total} marks (${_selectedQuestions.length} प्रश्न)`;

    if (!_selectedQuestions.length) {
      list.innerHTML = '<p class="td-hint td-hint-sm">अजून प्रश्न जोडलेले नाहीत.</p>';
      return;
    }
    list.innerHTML = _selectedQuestions.map((q, i) => {
      const text = q.questionText?.marathi || q.questionText?.english || '';
      return `
      <div class="tpb-selected-item" data-id="${q._id}">
        <span class="tpb-marks-chip">${q.marks} marks</span>
        <span class="tpb-selected-text">${i + 1}. ${_esc(text)}${_esc(_chapterLabelFor(q.chapterId))}</span>
        <button type="button" class="btn-icon tpb-remove-btn" data-id="${q._id}" title="काढा">🗑</button>
      </div>`;
    }).join('');
    list.querySelectorAll('.tpb-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => _removeSelectedQuestion(btn.dataset.id));
    });
  }

  async function _runAutoFill() {
    const target = parseInt($('tpb-autofill-target')?.value, 10);
    if (!target || target <= 0) {
      APP?.toast?.('आधी Target Marks टाका', 'error');
      return;
    }
    let remaining = target - _selectedQuestions.reduce((s, q) => s + q.marks, 0);
    if (remaining <= 0) {
      APP?.toast?.('Target आधीच पूर्ण झालं आहे', 'info');
      return;
    }

    const btn = $('tpb-autofill-btn');
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
          const candidates = await API.fetchTeacherSlsQuestions({
            chapterId: _chapterIdsParam(), marks: m, status: 'published', sort: 'usageCount', limit: 20
          });
          picked = candidates.find(c => !_selectedQuestions.some(s => s._id === c._id));
          if (picked) {
            _addSelectedQuestion(picked);
            remaining -= picked.marks;
            addedCount++;
          }
        }
        if (!picked) break;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = '⚡ उरलेलं Auto-fill करा';
    }

    if (addedCount === 0) {
      APP?.toast?.('अजून प्रश्न सापडले नाहीत', 'error');
    } else if (remaining > 0) {
      APP?.toast?.(`${addedCount} प्रश्न जोडले, पण ${remaining} marks अजून बाकी`, 'info');
    } else {
      APP?.toast?.(`✅ ${addedCount} प्रश्न auto-fill झाले, target पूर्ण!`, 'success');
    }
  }

  async function _savePaper() {
    if (!_batch || !_subjects.length || !_chapters.length) {
      APP?.toast?.('आधी Batch/Subject/Chapter निवडा', 'error');
      return;
    }
    if (!_selectedQuestions.length) {
      APP?.toast?.('किमान एक प्रश्न जोडा', 'error');
      return;
    }
    const title = $('tpb-title')?.value?.trim();

    const btn = $('tpb-save-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';
    try {
      const chapterIds = _chapters.map(c => c.chapterId);
      const paper = await API.createTeacherSlsPaperManual({
        batchId: _batch,
        // Singular fields = first selected one, for any older reader that
        // still expects a single chapterId/subjectId. chapterIds/subjectIds
        // carry the FULL selection.
        chapterId: chapterIds[0],
        subjectId: _subjects[0],
        chapterIds,
        subjectIds: _subjects,
        paperTitle: title || undefined,
        questions: _selectedQuestions.map(q => ({ questionId: q._id, marks: q.marks }))
      });
      APP?.toast?.(`✅ Paper "${paper.paperTitle}" saved (Paper #${paper.paperNumber})`, 'success');
      _showPdfExportPanel(paper);
      _resetPaperState(false);
      if ($('tpb-title')) $('tpb-title').value = '';
      if ($('tpb-autofill-target')) $('tpb-autofill-target').value = '';
    } catch (err) {
      console.error('Failed to save paper:', err);
      APP?.toast?.('Paper save करताना error आला', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Paper Save करा';
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PDF EXPORT (Phase 4 — core/paperPdf.js, shared with admin paperBuilder.js)
  // ════════════════════════════════════════════════════════════════════════════

  async function _showPdfExportPanel(paper) {
    const panel = $('tpb-pdf-section');
    if (!panel) return;
    const savedName = await DB.getSetting?.(INSTITUTION_NAME_KEY, '').catch(() => '') || '';
    panel.style.display = '';
    panel.innerHTML = `
      <h4>📄 "${_esc(paper.paperTitle)}" तयार झाला</h4>
      <div class="tpb-form-section">
        <label class="pb-multi-label" for="tpb-institution-name">Institution Name (PDF वर दिसेल — रिकामं ठेवल्यास "Nks EduOrbit" दिसेल)</label>
        <input id="tpb-institution-name" class="td-modal-select" type="text" placeholder="उदा. तुमच्या Coaching Class चं नाव" value="${_esc(savedName)}" />
      </div>
      <div class="tpb-pdf-actions">
        <button type="button" class="td-send-notif-btn" id="tpb-pdf-qp-btn">📄 Question Paper PDF</button>
        <button type="button" class="td-send-notif-btn" id="tpb-pdf-ans-btn">📝 Answer Sheet PDF</button>
      </div>
      <p class="td-hint td-hint-sm" id="tpb-pdf-status"></p>
    `;
    $('tpb-pdf-qp-btn').addEventListener('click', () => _exportPdf(paper, false, $('tpb-pdf-qp-btn')));
    $('tpb-pdf-ans-btn').addEventListener('click', () => _exportPdf(paper, true, $('tpb-pdf-ans-btn')));
  }

  async function _exportPdf(paper, withAnswers, btn) {
    const status = $('tpb-pdf-status');
    const original = btn.textContent;
    const institutionName = $('tpb-institution-name')?.value?.trim() || '';
    btn.disabled = true;
    btn.textContent = '⏳ तयार करत आहे...';
    if (status) status.textContent = '';
    try {
      await DB.setSetting?.(INSTITUTION_NAME_KEY, institutionName).catch(() => {});
      const full = await API.fetchTeacherSlsPaper(paper._id);
      if (withAnswers) await PAPER_PDF.exportAnswerSheet(full, { institutionName });
      else await PAPER_PDF.exportQuestionPaper(full, { institutionName });
      if (status) status.textContent = '✅ PDF तयार झाला — share sheet उघडलं आहे.';
    } catch (err) {
      console.error('PDF export failed:', err);
      if (status) status.textContent = '❌ PDF तयार करताना error आला.';
      APP?.toast?.('PDF export failed', 'error');
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
      showPdfExportPanel: _showPdfExportPanel,
      exportPdf: _exportPdf,
    },
  };
})();

window.TEACHER_PAPER_BUILDER = TEACHER_PAPER_BUILDER;
