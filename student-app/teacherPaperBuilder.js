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
  // Same key as admin-app/paperBuilder.js — DB.getSetting/setSetting is a
  // per-device local store, shared between the Admin and Student(Teacher)
  // apps only in the sense that both apps' users each have their own copy;
  // this constant just needs to match its own app's usage.
  const PDF_LANGUAGE_KEY = 'paper_builder_pdf_language';

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

    $('tpb-preview-btn')?.addEventListener('click', () => _previewPaper());
    $('tpb-preview-close')?.addEventListener('click', () => _closePreview());
    $('tpb-preview-modal')?.addEventListener('click', e => {
      if (e.target === $('tpb-preview-modal')) _closePreview();
    });
    document.querySelectorAll('.tpb-preview-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => _renderPreviewMode(btn.dataset.mode));
    });
  }

  async function _populateBatches() {
    const sel = $('tpb-batch-sel');
    // Second real bug found live, alongside the missing init() call: DB
    // (core/db.js) is a plain top-level `const`, never assigned to
    // `window.DB` — so this guard's `window.DB?.getAllBatches` was always
    // undefined and always bailed out here, even after the init()/sync fix
    // made local batches genuinely available. Confirmed via Playwright:
    // after fixing init(), local batch count was correct but the <select>
    // still had only the placeholder option until this line was fixed too.
    if (!sel || typeof DB === 'undefined' || !DB.getAllBatches) return;
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

  // Per-batch paper quota (server enforces it; this only shows progress and
  // avoids a pointless save attempt).
  let _quota = null;
  async function _refreshQuota() {
    const bar = $('tpb-quota-bar');
    _quota = null;
    if (!bar) return;
    if (!_batch) { bar.classList.add('hidden'); return; }
    try {
      const q = await API.fetchMyPaperQuota(_batch);
      if (!q || _batch !== q.batch) { bar.classList.add('hidden'); return; }
      _quota = q;
      bar.classList.remove('hidden', 'unlimited', 'exceeded');
      if (q.unlimited) {
        bar.classList.add('unlimited');
        bar.textContent = '🔓 Paper Builder is unlimited for this batch.';
      } else {
        if (!q.allowed) bar.classList.add('exceeded');
        bar.textContent = `📄 Papers: ${q.used} / ${q.limit} used · Paid students: ${q.paid} / ${q.need}` +
          (q.allowed ? ` - ${q.remaining_students} more paid students unlock unlimited.` : ' - free papers used up; ' + q.remaining_students + ' more paid students unlock unlimited.');
      }
    } catch {
      bar.classList.add('hidden');
    }
  }

  async function _onBatchChange(batch) {
    _batch = batch;
    _refreshQuota();
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
          <button type="button" class="tpb-picker-add-btn" data-id="${qq._id}" ${already ? 'disabled' : ''}>
            ${already ? '✓ जोडलं' : '+ जोडा'}
          </button>
        </div>`;
      }).join('');
      // Real bug found live: this list showed raw "$x^2-3x-2=0$" text
      // instead of rendered math — Preview already renders it correctly
      // (same PAPER_PDF/KaTeX pipeline), so a question was only actually
      // readable AFTER adding it and opening Preview. Render here too.
      window.PAPER_PDF?.ensureKatex().then(() => window.PAPER_PDF.renderMath(list)).catch(() => {});
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
    // answerText/diagrams kept too (previously dropped) — needed for the
    // "Preview" button to show a real Answer Sheet preview before saving,
    // without a second server round-trip.
    _selectedQuestions.push({
      _id: qq._id, marks: qq.marks, questionText: qq.questionText, chapterId: qq.chapterId,
      answerText: qq.answerText, questionDiagrams: qq.questionDiagrams, answerDiagrams: qq.answerDiagrams,
    });
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
    // Same raw-LaTeX-vs-rendered-math fix as the picker list above.
    window.PAPER_PDF?.ensureKatex().then(() => window.PAPER_PDF.renderMath(list)).catch(() => {});
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

  // Builds the same shape core/paperPdf.js's _buildHtml expects, straight
  // from current in-memory selection — no server round-trip, so Preview
  // works on a draft that hasn't been (and might never be) saved.
  function _draftPaperForPreview() {
    return {
      paperTitle: $('tpb-title')?.value?.trim() || 'Practice Paper',
      subjectIds: _subjects,
      subjectId: _subjects[0] || '',
      questions: _selectedQuestions,
    };
  }

  let _previewMode = 'question';

  async function _previewPaper() {
    if (!_selectedQuestions.length) {
      APP?.toast?.('आधी किमान एक प्रश्न जोडा', 'error');
      return;
    }
    const btn = $('tpb-preview-btn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ तयार करत आहे...';
    try {
      _previewMode = 'question';
      document.querySelectorAll('.tpb-preview-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'question'));
      await _renderPreviewMode('question');
      $('tpb-preview-modal')?.classList.remove('hidden');
    } catch (err) {
      console.error('Preview failed:', err);
      APP?.toast?.('Preview तयार करताना error आला', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function _renderPreviewMode(mode) {
    _previewMode = mode;
    document.querySelectorAll('.tpb-preview-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    const body = $('tpb-preview-body');
    if (body) body.innerHTML = '<p class="td-hint td-hint-sm">Loading…</p>';
    const html = await window.PAPER_PDF.previewHtml(_draftPaperForPreview(), mode === 'answer', {});
    if (body) body.innerHTML = html;
  }

  function _closePreview() {
    $('tpb-preview-modal')?.classList.add('hidden');
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
    if (_quota && !_quota.allowed) {
      APP?.toast?.(`You have used the ${_quota.limit} free papers for this batch. Unlimited unlocks when ${_quota.need} students of this batch have paid (${_quota.paid} / ${_quota.need}).`, 'error');
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
      _refreshQuota();
      if ($('tpb-title')) $('tpb-title').value = '';
      if ($('tpb-autofill-target')) $('tpb-autofill-target').value = '';
    } catch (err) {
      console.error('Failed to save paper:', err);
      if (err?.code === 'PAPER_LIMIT') {
        APP?.toast?.(err.message, 'error');
        _refreshQuota();
      } else {
        APP?.toast?.('Could not save the paper', 'error');
      }
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
    const savedName = (await DB.getSetting?.(INSTITUTION_NAME_KEY, '').catch(() => '') || '')
      || (await API.getTeacherProfile?.().catch(() => null))?.institute_name
      || '';
    const savedLang = await DB.getSetting?.(PDF_LANGUAGE_KEY, 'marathi').catch(() => 'marathi') || 'marathi';
    panel.style.display = '';
    panel.innerHTML = `
      <h4>📄 "${_esc(paper.paperTitle)}" तयार झाला</h4>
      <div class="tpb-form-section">
        <label class="pb-multi-label" for="tpb-institution-name">Institution Name (PDF वर दिसेल — रिकामं ठेवल्यास "Nks EduOrbit" दिसेल)</label>
        <input id="tpb-institution-name" class="td-modal-select" type="text" placeholder="उदा. तुमच्या Coaching Class चं नाव" value="${_esc(savedName)}" />
        <label class="pb-multi-label" for="tpb-pdf-language">PDF Language (फक्त Date/Total Marks/Section सारखे लेबल्स बदलतात)</label>
        <select id="tpb-pdf-language" class="td-modal-select">
          <option value="marathi" ${savedLang === 'marathi' ? 'selected' : ''}>🇮🇳 मराठी</option>
          <option value="english" ${savedLang === 'english' ? 'selected' : ''}>🇬🇧 English</option>
        </select>
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
    const language = $('tpb-pdf-language')?.value || 'marathi';
    btn.disabled = true;
    btn.textContent = '⏳ तयार करत आहे...';
    if (status) status.textContent = '';
    try {
      await DB.setSetting?.(INSTITUTION_NAME_KEY, institutionName).catch(() => {});
      await DB.setSetting?.(PDF_LANGUAGE_KEY, language).catch(() => {});
      const full = await API.fetchTeacherSlsPaper(paper._id);
      if (withAnswers) await PAPER_PDF.exportAnswerSheet(full, { institutionName, language });
      else await PAPER_PDF.exportQuestionPaper(full, { institutionName, language });
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
