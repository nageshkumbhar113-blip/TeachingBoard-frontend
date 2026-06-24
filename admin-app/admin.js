/* ════════════════════════════════════════
   admin.js — Admin Panel
   PIN gate, Question bank, CSV/ZIP import,
   Lesson editor, Batch management,
   Settings, Test Portal quiz list
   Global: ADMIN
════════════════════════════════════════ */

const ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const _setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '';
    return el;
  };
  const _setValue = (id, value) => {
    const el = $(id);
    if (el) el.value = value ?? '';
    return el;
  };
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

  let _unlocked    = false;
  let _editingQId  = null;
  let _questionBankLimit = 150;
  let _questionSearchTimer = null;
  let _quizSearchTimer = null;
  let _studentsCache = [];
  let _studentSearchTimer = null;

  function _autoStudentCode(name) {
    const prefix = String(name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'STU';
    const num = String(Math.floor(100 + Math.random() * 900));
    return prefix + num;
  }

  function _genPin() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  const QUESTION_BANK_PAGE_SIZE = 150;
  const SCRIPT_LOADERS = new Map();
  const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const QRCODE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

  // ════════════════════════
  // PIN GATE
  // ════════════════════════

  function open() {
    _unlocked = false;
    $('admin-pin-gate')?.classList.remove('hidden');
    $('admin-content')?.classList.add('hidden');
    $('pin-error')?.classList.add('hidden');
    document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
    document.querySelector('.pin-digit')?.focus();
    $('admin-overlay')?.classList.remove('hidden');
  }

  function close() {
    if (typeof APP?.exitAdmin === 'function') {
      APP.exitAdmin();
      return;
    }
    $('admin-overlay')?.classList.add('hidden');
    _unlocked = false;
  }

  async function _checkPin() {
    const digits = [...document.querySelectorAll('.pin-digit')].map(i => i.value).join('');
    if (digits.length < 4) return;

    function _showPinError(msg) {
      _setText('pin-error', msg || I18N.t('admin.pin.error'));
      $('pin-error')?.classList.remove('hidden');
      document.querySelectorAll('.pin-digit').forEach(i => { i.value = ''; });
      document.querySelector('.pin-digit')?.focus();
    }

    if (navigator.onLine) {
      try {
        await API.loginAdmin(digits);
        await DB.setSetting('admin_pin', digits);
      } catch (err) {
        const message = String(err?.message || '').trim();
        const savedPin = await DB.getSetting('admin_pin', null);
        const canUseCachedPin = savedPin && digits === savedPin;
        const canFallbackOffline = canUseCachedPin && (
          /too many login attempts/i.test(message) ||
          /fetch|network|timeout|unreachable|failed/i.test(message)
        );

        if (canFallbackOffline) {
          APP.toast?.('Server temporarily unavailable — using cached credentials', 'info');
        } else {
          _showPinError(message || 'PIN check failed');
          return;
        }
      }
    } else {
      const savedPin = await DB.getSetting('admin_pin', null);
      if (!savedPin) {
        _showPinError('Offline: no cached PIN. Connect once to authenticate.');
        return;
      }
      if (digits !== savedPin) {
        _showPinError(I18N.t('admin.pin.error'));
        return;
      }
      APP.toast?.('Offline mode — using cached credentials', 'info');
    }

    _unlocked = true;
    $('admin-pin-gate')?.classList.add('hidden');
    $('admin-content')?.classList.remove('hidden');
    await _loadAdminContent();
  }

  function _initPinInputs() {
    document.querySelectorAll('.pin-digit').forEach((inp, i, all) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/, '');
        if (inp.value && i < all.length - 1) all[i + 1].focus();
        if ([...all].every(d => d.value)) _checkPin();
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !inp.value && i > 0) all[i - 1].focus();
      });
    });
  }

  function _loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
    if (SCRIPT_LOADERS.has(src)) return SCRIPT_LOADERS.get(src);

    const loader = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(globalName ? window[globalName] : true);
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

    SCRIPT_LOADERS.set(src, loader);
    return loader;
  }

  function _ensureJSZip() {
    return _loadScript(JSZIP_CDN, 'JSZip');
  }

  function _ensureQRCode() {
    return _loadScript(QRCODE_CDN, 'QRCode');
  }

  // ════════════════════════
  // LOAD ADMIN CONTENT
  // ════════════════════════

  async function _loadAdminContent() {
    const savedApiUrl = await DB.getSetting('api_url', API.DEFAULT_API_URL);
    try { API.setApiUrl(savedApiUrl || API.DEFAULT_API_URL); } catch {}

    // If online, fetch questions + batch hierarchy from backend
    if (navigator.onLine && API.getAdminToken()) {
      await Promise.allSettled([
        API.syncServerQuestions(),
        API.syncServerBatches(),
      ]);
    }

    await DB.syncHierarchyFromExisting?.();
    _questionBankLimit = QUESTION_BANK_PAGE_SIZE;
    await Promise.all([
      _loadBatchOptions(),
      loadQuestionBank({ resetLimit: true }),
      _loadLessonAdmin(),
      _loadBatchAdmin(),
      _loadSubjectAdmin(),
      _loadChapterAdmin(),
      _renderStudentBatchOptions(),
      _loadStudentsAdmin(),
      _loadTeachersAdmin(),
      _loadParentsAdmin(),
      _loadVersionsAdmin(),
      _loadSettings(),
      loadQuizList(),
    ]);
    _resetStudentForm();
    _resetTeacherForm();
    _resetParentForm();
    APP.renderDashboardStats?.();
  }

  // ════════════════════════
  // TABS
  // ════════════════════════

  function _initTabs() {
    document.querySelectorAll('.atab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.atab-content').forEach(t => {
          t.classList.add('hidden');
          t.classList.remove('active');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const content = $('atab-' + tab.dataset.tab);
        if (content) { content.classList.remove('hidden'); content.classList.add('active'); }
        if (tab.dataset.tab === 'words')       _loadWordBank();
        if (tab.dataset.tab === 'word-tests')  window.WORD_TEST_BUILDER?.onTabActivated();
      });
    });
  }

  // ════════════════════════
  // BATCH OPTIONS (selects)
  // ════════════════════════

  async function _loadBatchOptions() {
    const batches = await DB.getAllBatches();
    const batchOptions = batches.map(batch => ({
      value: batch.name,
      label: `${batch.icon || ''} ${batch.name}`.trim(),
    }));
    const selectConfigs = [
      { id: 'admin-batch-filter', placeholder: 'All Classes' },
      { id: 'import-batch', placeholder: 'Select Class' },
      { id: 'bulk-batch', placeholder: 'Select Class' },
      { id: 'qe-batch', placeholder: 'Select Class' },
      { id: 'class-subject-batch', placeholder: 'Select Class' },
      { id: 'class-chapter-batch', placeholder: 'Select Class' },
      { id: 'words-filter-batch', placeholder: 'All Batches' },
      { id: 'word-bulk-batch',    placeholder: 'Select Batch' },
      { id: 'we-batch',           placeholder: 'Select Batch' },
    ];

    selectConfigs.forEach(({ id, placeholder }) => {
      _setSelectOptions($(id), batchOptions, placeholder);
    });

    const defaultBatch = $('class-subject-batch')?.value || $('class-chapter-batch')?.value || batchOptions[0]?.value || '';
    if ($('class-subject-batch') && !$('class-subject-batch').value && defaultBatch) {
      $('class-subject-batch').value = defaultBatch;
    }
    if ($('class-chapter-batch') && !$('class-chapter-batch').value && defaultBatch) {
      $('class-chapter-batch').value = defaultBatch;
    }

    await Promise.all([
      _refreshFormHierarchy({ batchId: 'qe-batch', subjectId: 'qe-subject', chapterId: 'qe-chapter' }),
      _refreshFormHierarchy({ batchId: 'import-batch', subjectId: 'import-subject', chapterId: 'import-chapter' }),
      _refreshFormHierarchy({ batchId: 'bulk-batch', subjectId: 'bulk-subject', chapterId: 'bulk-chapter' }),
      _refreshFormHierarchy({
        batchId: 'class-chapter-batch',
        subjectId: 'class-chapter-subject',
        chapterId: null,
        chapterPlaceholder: 'Select Chapter',
      }),
    ]);
    await _renderStudentBatchOptions();
  }

  function _setSelectOptions(select, options, placeholder) {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '';

    const base = document.createElement('option');
    base.value = '';
    base.textContent = placeholder;
    select.appendChild(base);

    options.forEach(optionValue => {
      const value = typeof optionValue === 'object' ? optionValue.value : optionValue;
      const label = typeof optionValue === 'object' ? (optionValue.label || optionValue.value) : optionValue;
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });

    const values = options.map(optionValue => (
      typeof optionValue === 'object' ? optionValue.value : optionValue
    ));
    select.value = values.includes(currentValue) ? currentValue : '';
  }

  async function _refreshFormHierarchy({
    batchId,
    subjectId,
    chapterId,
    subjectValue,
    chapterValue,
    subjectPlaceholder = 'Select Subject',
    chapterPlaceholder = 'Select Chapter',
  }) {
    const batch = $(batchId)?.value || '';
    const subjectSelect = $(subjectId);
    const chapterSelect = chapterId ? $(chapterId) : null;

    const subjects = batch
      ? (await DB.getSubjectsByBatch(batch)).map(item => item.name)
      : [];
    _setSelectOptions(subjectSelect, subjects, subjectPlaceholder);
    if (subjectSelect) {
      const nextSubject = subjectValue ?? subjectSelect.value;
      subjectSelect.value = subjects.includes(nextSubject) ? nextSubject : '';
    }

    if (!chapterSelect) return;

    const subject = subjectSelect?.value || subjectValue || '';
    const chapters = (batch && subject)
      ? (await DB.getChaptersByBatchSubject(batch, subject)).map(item => item.name)
      : [];
    _setSelectOptions(chapterSelect, chapters, chapterPlaceholder);
    const nextChapter = chapterValue ?? chapterSelect.value;
    chapterSelect.value = chapters.includes(nextChapter) ? nextChapter : '';
  }

  function _countPublishedQuizzes(batch, subject, chapter) {
    return DB.getAllQuizzes().then(quizzes =>
      quizzes.filter(quiz =>
        quiz.status === 'published' &&
        (!batch || quiz.batch === batch) &&
        (!subject || quiz.subject === subject) &&
        (!chapter || quiz.chapter === chapter)
      ).length
    );
  }

  async function _loadSubjectAdmin() {
    const batch = $('class-subject-batch')?.value || '';
    const list = $('subject-admin-list');
    if (!list) return;

    if (!batch) {
      list.innerHTML = '<p class="empty-hint">Select a class to manage subjects.</p>';
      return;
    }

    const subjects = await DB.getSubjectsByBatch(batch);
    if (!subjects.length) {
      list.innerHTML = '<p class="empty-hint">No subjects yet for this class.</p>';
      return;
    }

    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const subject of subjects) {
      const chapters = await DB.getChaptersByBatchSubject(batch, subject.name);
      const item = document.createElement('div');
      item.className = 'batch-admin-item';
      item.innerHTML = `
        <div>
          <div class="batch-admin-name">${_escHtml(subject.name)}</div>
          <div class="batch-admin-meta">${chapters.length} chapter${chapters.length === 1 ? '' : 's'}</div>
        </div>
        <div class="batch-admin-actions">
          <button class="admin-btn-secondary" data-action="use">Use</button>
          <button class="admin-btn-danger" data-action="delete">Delete</button>
        </div>
      `;
      item.querySelector('[data-action="use"]').addEventListener('click', async () => {
        if ($('class-chapter-batch')) $('class-chapter-batch').value = batch;
        await _refreshFormHierarchy({
          batchId: 'class-chapter-batch',
          subjectId: 'class-chapter-subject',
          chapterId: null,
        });
        if ($('class-chapter-subject')) $('class-chapter-subject').value = subject.name;
        await _loadChapterAdmin();
      });
      item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm(`Delete subject "${subject.name}" from "${batch}"?`)) return;
        await DB.deleteBatchSubject(subject.id);
        await Promise.all([
          _loadSubjectAdmin(),
          _loadChapterAdmin(),
          _loadBatchOptions(),
        ]);
        if (navigator.onLine) API.deleteCatalogSubject(batch, subject.name).catch(() => {});
      });
      fragment.appendChild(item);
    }
    list.appendChild(fragment);
  }

  async function _loadChapterAdmin() {
    const batch = $('class-chapter-batch')?.value || '';
    const subject = $('class-chapter-subject')?.value || '';
    const list = $('chapter-admin-list');
    if (!list) return;

    if (!batch) {
      list.innerHTML = '<p class="empty-hint">Select a class to manage chapters.</p>';
      return;
    }
    if (!subject) {
      list.innerHTML = '<p class="empty-hint">Select a subject to manage chapters.</p>';
      return;
    }

    const chapters = await DB.getChaptersByBatchSubject(batch, subject);
    if (!chapters.length) {
      list.innerHTML = '<p class="empty-hint">No chapters yet for this subject.</p>';
      return;
    }

    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const chapter of chapters) {
      const quizCount = await _countPublishedQuizzes(batch, subject, chapter.name);
      const item = document.createElement('div');
      item.className = 'batch-admin-item';
      item.innerHTML = `
        <div>
          <div class="batch-admin-name">${_escHtml(chapter.name)}</div>
          <div class="batch-admin-meta">${quizCount} published test${quizCount === 1 ? '' : 's'}</div>
        </div>
        <div class="batch-admin-actions">
          <button class="admin-btn-danger" data-action="delete">Delete</button>
        </div>
      `;
      item.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        if (!confirm(`Delete chapter "${chapter.name}" from "${subject}"?`)) return;
        await DB.deleteSubjectChapter(chapter.id);
        await Promise.all([
          _loadChapterAdmin(),
          _loadBatchOptions(),
        ]);
        if (navigator.onLine) API.deleteCatalogChapter(batch, subject, chapter.name).catch(() => {});
      });
      fragment.appendChild(item);
    }
    list.appendChild(fragment);
  }

  async function _addBatchSubject() {
    const batch = $('class-subject-batch')?.value || '';
    const name = $('class-subject-name')?.value.trim() || '';
    if (!batch || !name) {
      APP.toast('Select class and enter subject name', 'error');
      return;
    }

    await DB.saveBatchSubject({ batch, name });
    $('class-subject-name').value = '';
    await Promise.all([
      _loadSubjectAdmin(),
      _loadBatchOptions(),
    ]);
    // Sync to backend (silent fail if offline)
    if (navigator.onLine) API.addCatalogSubject(batch, name).catch(() => {});
    APP.toast(`Subject "${name}" added to ${batch}`, 'success');
  }

  async function _addSubjectChapter() {
    const batch = $('class-chapter-batch')?.value || '';
    const subject = $('class-chapter-subject')?.value || '';
    const name = $('class-chapter-name')?.value.trim() || '';
    if (!batch || !subject || !name) {
      APP.toast('Select class, subject, and chapter name', 'error');
      return;
    }

    await DB.saveSubjectChapter({ batch, subject, name });
    $('class-chapter-name').value = '';
    await Promise.all([
      _loadChapterAdmin(),
      _loadBatchOptions(),
    ]);
    // Sync to backend (silent fail if offline)
    if (navigator.onLine) API.addCatalogChapter(batch, subject, name).catch(() => {});
    APP.toast(`Chapter "${name}" added to ${subject}`, 'success');
  }

  function _refreshQuestionFilterOptions(allQuestions, { batch, subject }) {
    const subjects = [...new Set(
      allQuestions
        .filter(q => !batch || q.batch === batch)
        .map(q => q.subject)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    const chapters = [...new Set(
      allQuestions
        .filter(q => (!batch || q.batch === batch) && (!subject || q.subject === subject))
        .map(q => q.chapter)
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    _setSelectOptions($('admin-subject-filter'), subjects, 'All Subjects');
    _setSelectOptions($('admin-chapter-filter'), chapters, 'All Chapters');
  }

  // ════════════════════════
  // QUESTION BANK
  // ════════════════════════

  async function loadQuestionBank({ resetLimit = false } = {}) {
    if (resetLimit) _questionBankLimit = QUESTION_BANK_PAGE_SIZE;

    const all     = await DB.getAllQuestions();
    const batch   = $('admin-batch-filter')?.value   || '';
    let subject = $('admin-subject-filter')?.value || '';
    let chapter = $('admin-chapter-filter')?.value || '';
    const search  = ($('admin-search-filter')?.value || '').trim().toLowerCase();

    _refreshQuestionFilterOptions(all, { batch, subject });
    subject = $('admin-subject-filter')?.value || '';
    chapter = $('admin-chapter-filter')?.value || '';

    let filtered = all;
    if (batch)   filtered = filtered.filter(q => q.batch   === batch);
    if (subject) filtered = filtered.filter(q => q.subject === subject);
    if (chapter) filtered = filtered.filter(q => q.chapter === chapter);
    if (search) {
      filtered = filtered.filter(q => {
        const haystack = [
          q.question,
          q.batch,
          q.subject,
          q.chapter,
          q.difficulty,
          q.type,
          ...(q.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }
    filtered = [...filtered].sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

    const visible = filtered.slice(0, _questionBankLimit);
    const list = $('q-bank-list');
    const summary = $('q-bank-summary');
    const loadMoreBtn = $('btn-q-bank-more');
    if (!list) return;
    list.innerHTML = '';

    if (summary) {
      summary.textContent = filtered.length > visible.length
        ? `Showing ${visible.length} of ${filtered.length} questions`
        : `${filtered.length} question${filtered.length === 1 ? '' : 's'}`;
    }
    if (loadMoreBtn) {
      loadMoreBtn.classList.toggle('hidden', visible.length >= filtered.length);
      if (visible.length < filtered.length) {
        loadMoreBtn.textContent = `Show ${Math.min(QUESTION_BANK_PAGE_SIZE, filtered.length - visible.length)} More`;
      }
    }

    if (!filtered.length) {
      list.innerHTML = '<p class="empty-hint">No questions found</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    visible.forEach(q => {
      const item = document.createElement('div');
      item.className = 'qb-item' + ((q.weak_count >= 2 || q.flagged) ? ' weak-flag' : '');
      item.innerHTML = `
        <div class="qb-info">
          <div class="qb-text">${_escHtml(_questionSummary(q, 140))}</div>
          <div class="qb-meta">${q.batch} › ${q.subject} › ${q.chapter} · ${(q.type || 'MCQ').toUpperCase()}</div>
        </div>
        <div class="qb-badges">
          ${q.difficulty ? `<span class="qb-badge ${q.difficulty}">${q.difficulty}</span>` : ''}
          ${(q.weak_count >= 2 || q.flagged) ? '<span class="qb-badge weak">🚩 weak</span>' : ''}
          <button class="qb-edit-btn" data-id="${q.q_id}" aria-label="Edit question">✏️</button>
          <button class="qb-del-btn"  data-id="${q.q_id}" aria-label="Delete question">🗑️</button>
        </div>
      `;
      item.querySelector('.qb-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        _openQEditor(q);
      });
      item.querySelector('.qb-del-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete: "${_questionSummary(q, 60)}"?`)) return;
        if (q.backend_id) {
          try { await API.deleteQuestion(q.backend_id); } catch {}
        }
        await DB.deleteQuestion(q.q_id);
        await loadQuestionBank({ resetLimit: true });
        APP.toast('Question deleted', 'info');
        APP.refreshHome();
      });
      fragment.appendChild(item);
    });
    list.appendChild(fragment);
    // Render math symbols in question list (KaTeX)
    if (window.MATH) MATH.renderElement(list);
  }

  // ════════════════════════
  // QUESTION EDITOR
  // ════════════════════════

  async function _openQEditor(q = null) {
    _editingQId = q?.q_id || null;
    _setText('qedit-title', q ? 'Edit Question' : 'Add Question');
    $('btn-qe-delete')?.classList.toggle('hidden', !q);

    if (q) {
      _setValue('qe-batch', q.batch || '');
      await _refreshFormHierarchy({
        batchId: 'qe-batch',
        subjectId: 'qe-subject',
        chapterId: 'qe-chapter',
        subjectValue: q.subject || '',
        chapterValue: q.chapter || '',
      });
      _setValue('qe-type', q.type || 'mcq');
      _setValue('qe-difficulty', q.difficulty || 'medium');
      _setValue('qe-question', q.question || '');
      _setValue('qe-image', q.image || '');
      _setValue('qe-a', q.options?.A || '');
      _setValue('qe-b', q.options?.B || '');
      _setValue('qe-c', q.options?.C || '');
      _setValue('qe-d', q.options?.D || '');
      _setValue('qe-a-image', q.option_images?.A || '');
      _setValue('qe-b-image', q.option_images?.B || '');
      _setValue('qe-c-image', q.option_images?.C || '');
      _setValue('qe-d-image', q.option_images?.D || '');
      _setValue('qe-answer', q.type === 'mcq' ? (q.answer || 'A') : 'A');
      _setValue('qe-fib-answer', q.type === 'fib' ? (q.answer || '') : '');
      if ($('qe-tf-answer')) _setValue('qe-tf-answer', q.type === 'tf' ? (q.answer || 'True') : 'True');
      _setValue('qe-tags', (q.tags || []).join(', '));
    } else {
      $('qedit-overlay')?.querySelectorAll('input,textarea,select').forEach(el => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
      });
      await _refreshFormHierarchy({
        batchId: 'qe-batch',
        subjectId: 'qe-subject',
        chapterId: 'qe-chapter',
      });
    }

    _updateQETypeView();
    _updateQEPreview();
    $('qedit-overlay')?.classList.remove('hidden');
    $('qe-question')?.focus();
  }

  function _updateQETypeView() {
    const type = $('qe-type').value;
    $('qe-mcq-opts')?.classList.toggle('hidden', type !== 'mcq');
    $('qe-fib-opts')?.classList.toggle('hidden', type !== 'fib');
    $('qe-tf-opts')?.classList.toggle('hidden', type !== 'tf');
  }

  function _updateQEPreview() {
    const qEl   = $('qe-preview-q');
    const optsEl = $('qe-preview-opts');
    const box   = $('qe-preview-box');
    if (!qEl || !optsEl || !box) return;

    const qText = ($('qe-question')?.value || '').trim();
    const type  = $('qe-type')?.value || 'mcq';

    qEl.textContent = qText || '(question text येथे दिसेल…)';
    qEl.classList.toggle('qe-preview-placeholder', !qText);

    if (type === 'mcq') {
      const opts = [
        { k: 'A', v: ($('qe-a')?.value || '').trim() },
        { k: 'B', v: ($('qe-b')?.value || '').trim() },
        { k: 'C', v: ($('qe-c')?.value || '').trim() },
        { k: 'D', v: ($('qe-d')?.value || '').trim() },
      ].filter(o => o.v);
      optsEl.innerHTML = opts.map(o =>
        `<div class="qe-prev-opt"><span class="qe-prev-key">${o.k})</span><span class="qe-prev-val"></span></div>`
      ).join('');
      // Set text via textContent to keep it XSS-safe, KaTeX will render in-place
      optsEl.querySelectorAll('.qe-prev-val').forEach((el, i) => {
        el.textContent = opts[i].v;
      });
    } else if (type === 'fib') {
      const ans = ($('qe-fib-answer')?.value || '').trim();
      optsEl.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'qe-prev-opt';
      d.textContent = ans ? `Answer: ${ans}` : '';
      optsEl.appendChild(d);
    } else {
      optsEl.innerHTML = '<div class="qe-prev-opt">A) True &nbsp;&nbsp; B) False</div>';
    }

    if (window.MATH) MATH.renderElement(box);
  }

  function _validateQ(type, q) {
    if (!q.batch)    return 'Select a class / batch';
    if (!q.subject)  return 'Subject is required';
    if (!q.chapter)  return 'Chapter is required';
    if (!q.question && !q.image) return 'Question text or question image URL is required';

    if (type === 'mcq') {
      const populated = ['A', 'B', 'C', 'D'].filter(key =>
        _hasOptionContent(q.options?.[key], q.option_images?.[key])
      );
      if (populated.length < 2) return 'Add at least two MCQ options using text or image URL';
      if (!populated.includes(q.answer)) return 'Correct answer must point to an option with text or image';
    }

    if (type === 'fib' && !$('qe-fib-answer').value.trim()) {
      return 'Correct answer is required for Fill-in-the-Blank';
    }

    return null; // valid
  }

  async function _saveQEditor(event) {
    event?.preventDefault?.();
    const type = $('qe-type').value;
    const q = {
      q_id      : _editingQId || undefined,
      batch     : $('qe-batch').value,
      subject   : $('qe-subject').value,
      chapter   : $('qe-chapter').value,
      type,
      difficulty: $('qe-difficulty').value,
      question  : $('qe-question').value.trim(),
      image     : _cleanUrl($('qe-image')?.value),
      tags      : $('qe-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    if (type === 'mcq') {
      q.options = {
        A: $('qe-a').value.trim(),
        B: $('qe-b').value.trim(),
        C: $('qe-c').value.trim(),
        D: $('qe-d').value.trim(),
      };
      q.option_images = {
        A: _cleanUrl($('qe-a-image')?.value),
        B: _cleanUrl($('qe-b-image')?.value),
        C: _cleanUrl($('qe-c-image')?.value),
        D: _cleanUrl($('qe-d-image')?.value),
      };
      q.answer = $('qe-answer').value;
    } else if (type === 'fib') {
      q.answer = $('qe-fib-answer').value.trim();
    } else if (type === 'tf') {
      q.answer  = $('qe-tf-answer')?.value || 'True';
      q.options = { A: 'True', B: 'False' };
    }

    const validationError = _validateQ(type, q);
    if (validationError) { APP.toast(validationError, 'error'); return; }

    let saved;
    try {
      saved = await DB.saveQuestion(q);
    } catch (err) {
      console.error('DB write failed:', err);
      APP.toast('Offline save failed', 'error');
      return;
    }

    // Sync to backend (non-blocking) — all question types
    try {
      const res = saved.backend_id
        ? await API.updateQuestion(saved.backend_id, saved)
        : await API.addQuestion(saved);
      const bid = res?.data?.id || res?.data?._id || res?.data?.q_id || saved.backend_id;
      if (bid) {
        saved.backend_id = bid;
        try { await DB.saveQuestion(saved); } catch (err) { console.error('DB write failed:', err); }
      }
      APP.toast('Question synced', 'info');
    } catch (err) {
      APP.toast('Saved locally — will sync when online', 'info');
    }

    $('qedit-overlay')?.classList.add('hidden');
    await loadQuestionBank({ resetLimit: true });
    APP.toast(I18N.t('save.success'), 'success');
    APP.refreshHome();
  }

  async function _deleteCurrentQ() {
    if (!_editingQId) return;
    if (!confirm(I18N.t('delete.confirm'))) return;

    const all      = await DB.getAllQuestions();
    const existing = all.find(q => q.q_id === _editingQId);

    if (existing?.backend_id) {
      try { await API.deleteQuestion(existing.backend_id); } catch {}
    }

    await DB.deleteQuestion(_editingQId);
    $('qedit-overlay')?.classList.add('hidden');
    await loadQuestionBank({ resetLimit: true });
    APP.toast('Question deleted', 'info');
    APP.refreshHome();
  }

  // ════════════════════════
  // LESSON ADMIN
  // ════════════════════════

  async function _loadLessonAdmin() {
    if (navigator.onLine) {
      try { await API.syncServerLessons(); } catch {}
    }
    const lessons = await DB.getAllLessons();
    const list    = $('lesson-admin-list');
    if (!list) return;

    list.innerHTML = '';
    if (!lessons.length) {
      list.innerHTML = '<p class="lesson-card-empty">No lessons yet.</p>'; return;
    }

    lessons.forEach(lesson => {
      const item = document.createElement('div');
      item.className = 'lesson-admin-item';
      const bodyStr  = _lessonBodyStr(lesson.content);
      item.innerHTML = `
        <div class="lesson-admin-header">
          <div>
            <div class="lesson-admin-title">${_escHtml(lesson.title || 'Untitled')}</div>
            <div class="lesson-admin-meta">Updated ${lesson.updated_at
              ? new Date(lesson.updated_at).toLocaleString() : 'now'}</div>
          </div>
          <div class="lesson-admin-actions">
            <button class="admin-btn-secondary" data-action="edit"   data-id="${lesson.id}">Edit</button>
            <button class="admin-btn-danger"    data-action="delete" data-id="${lesson.id}">Delete</button>
          </div>
        </div>
        <div class="lesson-admin-body">${_escHtml(bodyStr)}</div>
      `;
      item.querySelector('[data-action="edit"]').addEventListener('click', () => _editLesson(lesson));
      item.querySelector('[data-action="delete"]').addEventListener('click', () => _deleteLessonItem(lesson));
      list.appendChild(item);
    });
  }

  function _editLesson(lesson) {
    $('lesson-id').value    = lesson.id  || '';
    $('lesson-title').value = lesson.title || '';
    $('lesson-body').value  = _lessonBodyStr(lesson.content);
    $('btn-cancel-lesson')?.classList.remove('hidden');
    $('lesson-title').focus();
  }

  function _resetLessonEditor() {
    $('lesson-id').value    = '';
    $('lesson-title').value = '';
    $('lesson-body').value  = '';
    $('btn-cancel-lesson')?.classList.add('hidden');
  }

  async function _saveLessonItem() {
    const id    = $('lesson-id').value.trim() || null;
    const title = $('lesson-title').value.trim();
    const body  = $('lesson-body').value.trim();

    if (!title || !body) { APP.toast('Title and content required', 'error'); return; }

    const payload = { title, content: _parseLessonContent(body) };

    try {
      const res = id
        ? await API.updateLesson(id, payload)
        : await API.createLesson(payload);
      if (res?.data) await DB.saveLesson(res.data);
      else            await DB.saveLesson({ ...payload, ...(id ? { id } : {}) });
      _resetLessonEditor();
      await _loadLessonAdmin();
      APP.refreshHome();
      APP.toast(id ? 'Lesson updated' : 'Lesson saved', 'success');
    } catch (err) {
      // API unreachable — persist locally so work is never lost
      try {
        await DB.saveLesson({ ...payload, ...(id ? { id } : {}) });
        _resetLessonEditor();
        await _loadLessonAdmin();
        APP.refreshHome();
        APP.toast('Saved locally — will sync when online', 'info');
      } catch {
        APP.toast('Save failed: ' + err.message, 'error');
      }
    }
  }

  async function _deleteLessonItem(lesson) {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    try {
      await API.deleteLesson(lesson.id);
      await DB.deleteLesson(lesson.id);
      await _loadLessonAdmin();
      APP.refreshHome();
      APP.toast('Lesson deleted', 'info');
    } catch (err) {
      APP.toast('Delete failed: ' + err.message, 'error');
    }
  }

  function _parseLessonContent(val) {
    const t = String(val || '').trim();
    if (!t) return { body: '' };
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.parse(t); } catch {}
    }
    return { body: t };
  }

  function _lessonBodyStr(content) {
    if (!content)                       return '';
    if (typeof content === 'string')    return content;
    if (typeof content.body === 'string' && content.body.trim()) return content.body.trim();
    return JSON.stringify(content, null, 2);
  }

  function _escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ════════════════════════
  // CSV IMPORT
  // ════════════════════════

  // ════════════════════════
  // SAMPLE CSV DOWNLOAD
  // ════════════════════════

  function _downloadSampleCSV() {
    const rows = [
      ['Question', 'A', 'B', 'C', 'D', 'Answer', 'Image', 'Difficulty', 'Type'],
      ['भारताची राजधानी कोणती आहे?', 'मुंबई', 'दिल्ली', 'पुणे', 'कोलकाता', 'B', '', 'easy', 'mcq'],
      ['पृथ्वी गोल आहे का?', 'True', 'False', '', '', 'A', '', 'easy', 'tf'],
      ['पाण्याचे रासायनिक सूत्र ___ आहे.', 'H2O', 'CO2', 'O2', 'N2', 'A', '', 'medium', 'mcq'],
      ['भारतात ___ राज्ये आहेत.', '28', '29', '30', '31', 'A', '', 'medium', 'fib'],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sample_questions.csv';
    a.click();
    APP.toast('Sample CSV downloaded', 'info');
  }

  // ════════════════════════
  // BULK PASTE IMPORT (AI format)
  // ════════════════════════

  async function _bulkImport() {
    const text    = $('bulk-paste-input')?.value?.trim() || '';
    const batch   = $('bulk-batch')?.value || '';
    const subject = $('bulk-subject')?.value || '';
    const chapter = $('bulk-chapter')?.value || '';
    const log     = $('bulk-import-log');

    if (!text) { APP.toast('AI output paste करा', 'error'); return; }
    if (!batch || !subject || !chapter) { APP.toast('Class, Subject, Chapter निवडा', 'error'); return; }

    log.innerHTML = 'Parsing…'; log.classList.add('visible');

    let parsed;
    try {
      parsed = PARSER.parse(text);
    } catch (err) {
      log.innerHTML = `<span class="log-error">Parse error: ${err.message}</span>`;
      APP.toast('Parse failed', 'error');
      return;
    }

    if (!parsed || parsed.length === 0) {
      log.innerHTML = '<span class="log-error">❌ कोणतेही questions सापडले नाहीत. Format तपासा.</span>';
      APP.toast('No questions found — check format', 'error');
      return;
    }

    log.innerHTML = `<span class="log-info">📋 ${parsed.length} questions सापडले. Saving…</span>`;

    let added = 0, failed = 0, syncOk = 0, syncFail = 0;
    for (const q of parsed) {
      const qObj = {
        batch, subject, chapter,
        question  : q.question,
        type      : q.type || 'mcq',
        options   : q.options || { A: '', B: '', C: '', D: '' },
        answer    : q.answer || 'A',
        difficulty: q.difficulty || 'medium',
        tags      : q.tags || [],
      };
      try {
        const saved = await DB.saveQuestion(qObj);
        added++;
        // Sync to backend immediately
        try {
          const res = await API.addQuestion(saved);
          const bid = res?.data?.id || res?.data?._id || res?.data?.q_id;
          if (bid) { saved.backend_id = bid; await DB.saveQuestion(saved); }
          syncOk++;
        } catch { syncFail++; }
      } catch { failed++; }
    }

    let html = `<span class="log-success">✅ Saved: ${added}${failed ? ` ❌ Failed: ${failed}` : ''}</span>\n`;
    html += `<span class="log-info">⏫ Synced to server: ${syncOk}${syncFail ? ` ⚠️ Pending: ${syncFail}` : ''}</span>`;
    log.innerHTML = html;

    if (added > 0) {
      $('bulk-paste-input').value = '';
      APP.toast(`✅ ${added} questions imported`, 'success');
      await loadQuestionBank({ resetLimit: true });
      APP.refreshHome();
    }
  }

  // ════════════════════════
  // COPY AI PROMPT
  // ════════════════════════

  function _copyAIPrompt() {
    const text = $('bulk-sample-prompt')?.textContent || '';
    if (!text) return;
    navigator.clipboard.writeText(text.trim())
      .then(() => APP.toast('✅ Prompt copied! Paste it in ChatGPT/Gemini', 'success'))
      .catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text.trim();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        APP.toast('✅ Prompt copied!', 'success');
      });
  }

  async function _importCSV() {
    const file    = $('csv-file-input').files[0];
    if (!file) { APP.toast('Select a CSV file first', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { APP.toast('CSV file too large (max 5 MB)', 'error'); return; }

    const batch   = $('import-batch').value;
    const subject = $('import-subject').value;
    const chapter = $('import-chapter').value;
    if (!batch || !subject || !chapter) {
      APP.toast('Fill Class, Subject, Chapter fields', 'error'); return;
    }

    const text    = await file.text();
    const log     = $('import-log');
    log.innerHTML = 'Importing…'; log.classList.add('visible');

    const res = await DB.importFromCSV(text, batch, subject, chapter);
    let html  = `<span class="log-success">✅ Added: ${res.added}</span>\n`;
    if (res.skipped) html += `<span class="log-warn">⚠️ Duplicates skipped: ${res.skipped}</span>\n`;
    if (res.errors.length) html += `<span class="log-error">Errors:\n${res.errors.join('\n')}</span>`;
    log.innerHTML = html;

    APP.toast(I18N.t('import.success', { n: res.added }), 'success');
    if (res.skipped) APP.toast(I18N.t('import.dup', { n: res.skipped }), 'info');

    // Sync imported questions to backend
    if (res.added > 0) {
      log.innerHTML += '\n<span class="log-info">⏫ Syncing to server…</span>';
      await _syncNewQuestionsToBackend(log);
    }

    await loadQuestionBank({ resetLimit: true });
    APP.refreshHome();
  }

  // Sync any locally-saved questions that have no backend_id to the server
  async function _syncNewQuestionsToBackend(logEl) {
    const all = await DB.getAllQuestions();
    const unsynced = all.filter(q => !q.backend_id);
    let synced = 0, failed = 0;
    for (const q of unsynced) {
      try {
        const res = await API.addQuestion(q);
        const bid = res?.data?.id || res?.data?._id || res?.data?.q_id;
        if (bid) {
          q.backend_id = bid;
          await DB.saveQuestion(q);
        }
        synced++;
      } catch { failed++; }
    }
    if (logEl) {
      logEl.innerHTML += `\n<span class="log-success">✅ Synced: ${synced}${failed ? ` ⚠️ Failed: ${failed}` : ''}</span>`;
    }
    return { synced, failed };
  }

  // ════════════════════════
  // ZIP IMPORT / EXPORT
  // ════════════════════════

  async function _importZIP() {
    const file = $('zip-file-input').files[0];
    if (!file) { APP.toast('Select a ZIP file', 'error'); return; }

    await _ensureJSZip().catch(err => {
      APP.toast(err.message, 'error');
    });
    if (typeof JSZip === 'undefined') return;
    APP.toast('Reading ZIP…', 'info');

    try {
      const zip     = await JSZip.loadAsync(file);
      const jsonFile = zip.file('questions.json');
      if (!jsonFile) { APP.toast('questions.json not found in ZIP', 'error'); return; }

      const payload    = JSON.parse(await jsonFile.async('text'));
      const imageFiles = Object.keys(zip.files).filter(n => /\.(jpg|jpeg|png|gif|webp)$/i.test(n));

      for (const imgPath of imageFiles) {
        const blob = await zip.file(imgPath).async('blob');
        await DB.saveImage(imgPath.split('/').pop(), blob);
      }

      const count = await DB.importJSON(payload);
      APP.toast(`✅ Imported ${count} questions + ${imageFiles.length} images`, 'success');
      await _syncNewQuestionsToBackend(null);
      await loadQuestionBank({ resetLimit: true });
      APP.refreshHome();
    } catch (err) {
      APP.toast('ZIP import error: ' + err.message, 'error');
    }
  }

  async function _exportZIP() {
    await _ensureJSZip().catch(err => {
      APP.toast(err.message, 'error');
    });
    if (typeof JSZip === 'undefined') return;
    APP.toast('Building ZIP…', 'info');

    const payload    = await DB.exportJSON();
    const zip        = new JSZip();
    zip.file('questions.json', JSON.stringify(payload, null, 2));

    const imgNames = await DB.getAllImageNames();
    const imgFolder = zip.folder('images');
    for (const name of imgNames) {
      const db   = await DB.open();
      const tx   = db.transaction('images', 'readonly');
      const rec  = await new Promise(r => { const req = tx.objectStore('images').get(name); req.onsuccess = () => r(req.result); });
      if (rec?.blob) imgFolder.file(name, rec.blob);
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    _downloadBlob(blob, `teachingboard_${Date.now()}.zip`);
    APP.toast('✅ ZIP exported', 'success');
  }

  function _downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  // ════════════════════════
  // BATCH ADMIN
  // ════════════════════════

  async function _loadBatchAdmin() {
    const batches = await DB.getAllBatches();
    const list    = $('batch-admin-list');
    if (!list) return;
    list.innerHTML = '';

    // Fetch question counts for all batches in parallel
    const qCounts = await Promise.all(batches.map(b => DB.getQuestionsByBatch(b.name)));

    for (let i = 0; i < batches.length; i++) {
      const b  = batches[i];
      const qs = qCounts[i];
      const item = document.createElement('div');
      item.className = 'batch-admin-item';
      item.innerHTML = `
        <div>
          <div class="batch-admin-name">${b.icon || '📚'} ${b.name}</div>
          <div class="batch-admin-meta">${qs.length} questions</div>
        </div>
        <div class="batch-admin-actions">
          <button class="admin-btn-danger" data-id="${b.id}" data-name="${b.name}">🗑️ Delete</button>
        </div>
      `;
      item.querySelector('.admin-btn-danger').addEventListener('click', async e => {
        const { id, name } = e.target.dataset;
        if (!confirm(`Delete batch "${name}"?`)) return;
        await DB.deleteBatch(parseInt(id));
        await Promise.all([
          _loadBatchAdmin(),
          _loadSubjectAdmin(),
          _loadChapterAdmin(),
          _loadBatchOptions(),
        ]);
        if (navigator.onLine) API.deleteBatchCatalog(name).catch(() => {});
        APP.refreshHome();
      });
      item.addEventListener('click', async e => {
        if (e.target.closest('button')) return;
        if ($('class-subject-batch')) $('class-subject-batch').value = b.name;
        if ($('class-chapter-batch')) $('class-chapter-batch').value = b.name;
        await _refreshFormHierarchy({
          batchId: 'class-chapter-batch',
          subjectId: 'class-chapter-subject',
          chapterId: null,
        });
        await Promise.all([
          _loadSubjectAdmin(),
          _loadChapterAdmin(),
        ]);
      });
      list.appendChild(item);
    }
  }

  async function _addBatch() {
    const name = prompt('Class/Batch name (e.g. Std 8):');
    if (!name) return;
    const icons = ['📚','🌱','🔬','🧮','🏛️','🎯','⚡','🌍'];
    const icon  = icons[Math.floor(Math.random() * icons.length)];
    await DB.saveBatch({ name: name.trim(), icon });
    await Promise.all([
      _loadBatchAdmin(),
      _loadSubjectAdmin(),
      _loadChapterAdmin(),
      _loadBatchOptions(),
    ]);
    // Sync to backend (silent fail if offline)
    if (navigator.onLine) API.createBatchCatalog(name.trim(), icon).catch(() => {});
    APP.refreshHome();
    APP.toast(`✅ Class "${name}" added`, 'success');
  }

  // ════════════════════════
  // TEST PORTAL — QUIZ LIST
  // ════════════════════════

  function _populateQuizBatchFilter(quizzes) {
    const batchSel   = $('quiz-batch-filter');
    const subjectSel = $('quiz-subject-filter');
    const chapterSel = $('quiz-chapter-filter');

    const batchVal   = batchSel?.value   || '';
    const subjectVal = subjectSel?.value || '';
    const chapterVal = chapterSel?.value || '';

    const batches = [...new Set(quizzes.map(q => q.batch).filter(Boolean))].sort();
    if (batchSel) {
      batchSel.innerHTML = '<option value="">All Classes</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b;
        if (b === batchVal) opt.selected = true;
        batchSel.appendChild(opt);
      });
    }

    const byBatch   = batchVal   ? quizzes.filter(q => q.batch   === batchVal)   : quizzes;
    const subjects  = [...new Set(byBatch.map(q => q.subject).filter(Boolean))].sort();
    if (subjectSel) {
      subjectSel.innerHTML = '<option value="">All Subjects</option>';
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        if (s === subjectVal) opt.selected = true;
        subjectSel.appendChild(opt);
      });
    }

    const bySubject  = subjectVal ? byBatch.filter(q => q.subject === subjectVal) : byBatch;
    const chapters   = [...new Set(bySubject.map(q => q.chapter).filter(Boolean))].sort();
    if (chapterSel) {
      chapterSel.innerHTML = '<option value="">All Chapters</option>';
      chapters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        if (c === chapterVal) opt.selected = true;
        chapterSel.appendChild(opt);
      });
    }
  }

  async function loadQuizList() {
    const all = await DB.getAllQuizzes();

    await _populateQuizBatchFilter(all);

    const search        = ($('quiz-search')?.value        || '').trim().toLowerCase();
    const batchFilter   = $('quiz-batch-filter')?.value   || '';
    const subjectFilter = $('quiz-subject-filter')?.value || '';
    const chapterFilter = $('quiz-chapter-filter')?.value || '';
    const statusFilter  = $('quiz-status-filter')?.value  || '';

    let filtered = all;
    if (batchFilter)   filtered = filtered.filter(q => q.batch   === batchFilter);
    if (subjectFilter) filtered = filtered.filter(q => q.subject === subjectFilter);
    if (chapterFilter) filtered = filtered.filter(q => q.chapter === chapterFilter);
    if (search) filtered = filtered.filter(q =>
      (q.title   || '').toLowerCase().includes(search) ||
      (q.subject || '').toLowerCase().includes(search) ||
      (q.chapter || '').toLowerCase().includes(search)
    );

    const drafts    = filtered.filter(q => q.status === 'draft');
    const published = filtered.filter(q => q.status === 'published');

    const draftSection     = $('quiz-list-draft-section');
    const publishedSection = $('quiz-list-published-section');

    if (statusFilter === 'draft') {
      if (draftSection)     draftSection.style.display = '';
      if (publishedSection) publishedSection.style.display = 'none';
    } else if (statusFilter === 'published') {
      if (draftSection)     draftSection.style.display = 'none';
      if (publishedSection) publishedSection.style.display = '';
    } else {
      if (draftSection)     draftSection.style.display = '';
      if (publishedSection) publishedSection.style.display = '';
    }

    _renderQuizGroup('quiz-list-draft',     drafts);
    _renderQuizGroup('quiz-list-published', published);
  }

  function _renderQuizGroup(containerId, quizzes) {
    const el = $(containerId);
    if (!el) return;

    if (!quizzes.length) {
      el.innerHTML = '<p style="color:var(--text2);font-size:0.82rem;padding:8px">None yet</p>';
      return;
    }

    el.innerHTML = '';
    quizzes.forEach(quiz => {
      const totalQ = (quiz.sections || []).reduce((s, sec) => s + sec.question_ids.length, 0);
      const date   = new Date(quiz.updated_at || quiz.created_at || 0).toLocaleDateString();
      const item   = document.createElement('div');
      item.className = 'quiz-item';
      item.innerHTML = `
        <div class="quiz-item-info">
          <div class="quiz-item-title">${_escHtml(quiz.title)}</div>
          <div class="quiz-item-meta">
            ${_escHtml(quiz.batch || '')} › ${_escHtml(quiz.subject || '')}
            · ${totalQ} Q · ${date}
          </div>
        </div>
        <span class="quiz-status-badge ${quiz.status}">${quiz.status}</span>
        <div class="quiz-item-actions">
          <button class="admin-btn-secondary quiz-edit-btn" data-id="${quiz.quiz_id}"
            style="padding:4px 10px;font-size:0.8rem">✏️ Edit</button>
          <button class="admin-btn-secondary quiz-export-btn" data-id="${quiz.quiz_id}"
            style="padding:4px 10px;font-size:0.8rem">🖨 Export</button>
          ${quiz.status === 'published'
            ? `<button class="admin-btn-secondary quiz-play-btn" data-id="${quiz.quiz_id}"
                style="padding:4px 10px;font-size:0.8rem;color:var(--correct)">▶ Start</button>`
            : ''}
          <button class="admin-btn-danger quiz-del-btn" data-id="${quiz.quiz_id}"
            style="padding:4px 10px;font-size:0.8rem">🗑️</button>
        </div>
      `;

      item.querySelector('.quiz-edit-btn').addEventListener('click', () => {
        TEST_BUILDER.open(quiz.quiz_id);
      });
      item.querySelector('.quiz-export-btn').addEventListener('click', () => {
        PDF.exportQuizPaper(quiz);
      });
      item.querySelector('.quiz-play-btn')?.addEventListener('click', () => {
        APP.openStudentQuiz?.(quiz.quiz_id, 'practice');
      });
      item.querySelector('.quiz-del-btn').addEventListener('click', async () => {
        if (!confirm(`Delete quiz "${quiz.title}"?`)) return;
        const remoteId = String(quiz.backend_id || quiz.quiz_id || '').trim();
        const needsRemoteDelete = quiz.status === 'published' || quiz.source === 'api' || !!quiz.backend_id;

        if (needsRemoteDelete && !navigator.onLine) {
          APP.toast('Connect to internet to delete published quiz', 'error');
          return;
        }

        if (needsRemoteDelete && remoteId) {
          try {
            await API.deleteQuiz(remoteId);
          } catch (err) {
            if (!/404|not found/i.test(err.message || '')) {
              APP.toast(`Could not delete quiz: ${err.message}`, 'error');
              return;
            }
          }
        }

        await DB.deleteQuiz(quiz.quiz_id);
        await loadQuizList();
        APP.toast('Quiz deleted', 'info');
        APP.refreshHome?.();
      });

      el.appendChild(item);
    });
  }

  // ════════════════════════
  // QR CODE
  // ════════════════════════

  async function _generateServerUrlQR() {
    const serverUrl = API.getApiUrl() || API.DEFAULT_API_URL;
    const out = document.getElementById('url-qr-output');
    const textEl = document.getElementById('url-qr-text');
    if (!out) return;

    out.innerHTML = '';
    out.classList.add('visible');

    await _ensureQRCode().catch(() => {});

    // Deep-link: student app reads ?server= on startup and auto-saves the URL
    // If on same Vercel origin, build full student-app URL; else just the raw API URL
    const origin = window.location?.origin || '';
    const studentBase = origin && !origin.startsWith('file:')
      ? `${origin}/student-app/`
      : serverUrl;
    const qrText = studentBase !== serverUrl
      ? `${studentBase}?server=${encodeURIComponent(serverUrl)}`
      : serverUrl;

    if (typeof QRCode !== 'undefined') {
      new QRCode(out, {
        text: qrText,
        width: 200, height: 200,
        colorDark: '#000000', colorLight: '#ffffff',
      });
      if (textEl) { textEl.style.display = 'block'; textEl.textContent = serverUrl; }
      APP.toast('QR तयार आहे — Students ना scan करायला सांगा', 'success');
    } else {
      out.innerHTML = `<p style="font-size:0.85rem;padding:8px">QR library load झाली नाही.<br>URL share करा:<br><strong>${serverUrl}</strong></p>`;
    }
  }

  async function _generateQR() {
    const payload = await DB.exportJSON();
    const jsonStr = JSON.stringify(payload);
    const out     = $('qr-output');
    out.innerHTML = ''; out.classList.add('visible');

    await _ensureQRCode().catch(() => {});

    if (typeof QRCode !== 'undefined') {
      new QRCode(out, {
        text: jsonStr.slice(0, 2000),
        width: 200, height: 200,
        colorDark: '#000000', colorLight: '#ffffff',
      });
      APP.toast('QR generated — scan with mobile', 'success');
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      out.innerHTML = `<p style="font-size:0.8rem">QR library not loaded.<br>
        <a href="${URL.createObjectURL(blob)}" download="backup.json" style="color:var(--accent)">
        Download JSON instead</a></p>`;
    }
  }

  // ════════════════════════
  // SETTINGS
  // ════════════════════════

  function _selectedStudentBatches() {
    return [...document.querySelectorAll('#student-batch-list input[type="checkbox"]:checked')]
      .map(inp => String(inp.value || '').trim())
      .filter(Boolean);
  }

  async function _renderStudentBatchOptions(selected = null) {
    const list = $('student-batch-list');
    if (!list) return;

    const batches = await DB.getAllBatches();
    const selectedSet = new Set(Array.isArray(selected) ? selected : _selectedStudentBatches());
    list.innerHTML = '';

    if (!batches.length) {
      list.innerHTML = '<p class="empty-hint">Add classes first to assign student access.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    batches.forEach(batch => {
      const label = document.createElement('label');
      label.className = 'student-batch-item';
      label.innerHTML = `
        <input type="checkbox" value="${_escHtml(batch.name)}" ${selectedSet.has(batch.name) ? 'checked' : ''} />
        <span>${_escHtml(batch.name)}</span>
      `;
      fragment.appendChild(label);
    });
    list.appendChild(fragment);
  }

  function _resetStudentForm() {
    _setValue('student-edit-id', '');
    _setValue('student-code', '');
    _setValue('student-name', '');
    _setValue('student-mobile', '');
    _setValue('student-pin', '');
    _setValue('student-expiry', '');
    _setValue('student-status', 'active');
    _renderStudentBatchOptions([]);
  }

  function _studentFormPayload({ requirePin = true } = {}) {
    const student_code = String($('student-code')?.value || '').trim().toUpperCase();
    const name = String($('student-name')?.value || '').trim();
    const mobile = String($('student-mobile')?.value || '').trim();
    const pin = String($('student-pin')?.value || '').trim();
    const expiry_date = String($('student-expiry')?.value || '').trim();
    const status = String($('student-status')?.value || 'active').trim();
    const assigned_batches = _selectedStudentBatches();

    if (!student_code) throw new Error('Student code is required');
    if (!name) throw new Error('Student name is required');
    if (requirePin && !/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
    if (!assigned_batches.length) throw new Error('Assign at least one class');

    return {
      student_code,
      name,
      mobile,
      status,
      assigned_batches,
      expiry_date: expiry_date || '',
      ...(pin ? { pin } : {}),
    };
  }

  function _closeStudentDrawer() {
    const overlay = $('student-action-overlay');
    const drawer  = $('student-action-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    setTimeout(() => overlay?.classList.add('hidden'), 260);
  }

  function _openStudentDrawer(student) {
    const overlay = $('student-action-overlay');
    const drawer  = $('student-action-drawer');
    const nameEl  = $('drawer-student-name');
    const codeEl  = $('drawer-student-code');
    const actions = $('drawer-actions');
    if (!drawer || !overlay || !actions) return;

    if (nameEl) nameEl.textContent = student.name;
    if (codeEl) codeEl.textContent = student.student_code || '';

    const isShared = !!student.shared_device;

    function _mkBtn(icon, label, dangerClass) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'drawer-action-btn' + (dangerClass ? ' danger' : '');
      b.innerHTML = `<span style="font-size:1.1em">${icon}</span><span>${label}</span>`;
      return b;
    }

    actions.innerHTML = '';

    // Edit
    const editBtn = _mkBtn('✏️', 'Edit');
    editBtn.addEventListener('click', () => { _closeStudentDrawer(); _fillStudentForm(student); });
    actions.appendChild(editBtn);

    // Block / Activate
    const isBlocked = student.status === 'blocked';
    const toggleBtn = _mkBtn(isBlocked ? '✅' : '🚫', isBlocked ? 'Activate' : 'Block');
    toggleBtn.addEventListener('click', async () => {
      _closeStudentDrawer();
      const nextStatus = isBlocked ? 'active' : 'blocked';
      try {
        await API.updateStudent(student.id, { status: nextStatus });
        APP.toast(`Student ${nextStatus === 'blocked' ? 'blocked' : 'activated'}`, 'success');
        await _loadStudentsAdmin();
      } catch (err) { APP.toast(err.message || 'Could not update student', 'error'); }
    });
    actions.appendChild(toggleBtn);

    // Shared Device toggle
    const sharedBtn = _mkBtn(
      isShared ? '🔒' : '👨‍👩‍👧',
      isShared ? 'Single Device वर lock करा' : 'Shared Device चालू करा'
    );
    sharedBtn.addEventListener('click', async () => {
      _closeStudentDrawer();
      const nextShared = !isShared;
      if (!confirm(nextShared
        ? `"${student.name}" ला Shared Device चालू करायचं?`
        : `"${student.name}" ला Single Device वर lock करायचं?`)) return;
      try {
        await API.updateStudent(student.id, { shared_device: nextShared });
        APP.toast(nextShared ? 'Shared device enabled ✅' : 'Single device mode set 🔒', 'success');
        await _loadStudentsAdmin();
      } catch (err) { APP.toast(err.message || 'Update failed', 'error'); }
    });
    actions.appendChild(sharedBtn);

    // Reset Device (only if bound and not shared)
    if (student.device_bound && !isShared) {
      const resetBtn = _mkBtn('🔓', 'Reset Device Binding');
      resetBtn.addEventListener('click', async () => {
        _closeStudentDrawer();
        if (!confirm(`"${student.name}" चं device binding reset करायचं?`)) return;
        try {
          await API.resetStudentDevice(student.id);
          APP.toast('Device binding reset झालं', 'success');
          await _loadStudentsAdmin();
        } catch (err) { APP.toast(err.message || 'Device reset failed', 'error'); }
      });
      actions.appendChild(resetBtn);
    }

    // Delete
    const deleteBtn = _mkBtn('🗑️', 'Delete Student', true);
    deleteBtn.addEventListener('click', async () => {
      _closeStudentDrawer();
      if (!confirm(`"${student.name}" (${student.student_code}) ला permanently delete करायचं?\n\nहे action undo होणार नाही!`)) return;
      try {
        await API.deleteStudent(student.id);
        APP.toast(`${student.name} deleted ✅`, 'success');
        await _loadStudentsAdmin();
      } catch (err) { APP.toast(err.message || 'Delete failed', 'error'); }
    });
    actions.appendChild(deleteBtn);

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => drawer.classList.add('open'));
  }

  function _fillStudentForm(student) {
    _setValue('student-edit-id', student?.id || '');
    _setValue('student-code', student?.student_code || '');
    _setValue('student-name', student?.name || '');
    _setValue('student-mobile', student?.mobile || '');
    _setValue('student-pin', '');
    _setValue('student-expiry', student?.expiry_date || '');
    _setValue('student-status', student?.status || 'active');
    _renderStudentBatchOptions(student?.assigned_batches || []);
  }

  function _renderStudentList(query = '', courseFilter = '') {
    const list = $('student-admin-list');
    if (!list) return;

    const cleanQuery = String(query || '').trim().toLowerCase();
    const cleanCourse = String(courseFilter !== undefined ? courseFilter : ($('student-course-filter')?.value || '')).trim();

    let students = _studentsCache;
    if (cleanQuery) {
      students = students.filter(s =>
        [s.student_code, s.name, s.mobile, ...(s.assigned_batches || [])]
          .some(v => String(v || '').toLowerCase().includes(cleanQuery))
      );
    }
    if (cleanCourse) {
      students = students.filter(s => (s.assigned_batches || []).includes(cleanCourse));
    }

    if (!students.length) {
      list.innerHTML = '<p class="empty-hint">No student accounts found.</p>';
      return;
    }

    list.innerHTML = '';
    students.forEach(student => {
      const isShared = !!student.shared_device;
      const deviceBadge = isShared
        ? '<span class="device-badge shared" title="Shared device — multiple students allowed">👨‍👩‍👧 Shared</span>'
        : student.device_bound
          ? '<span class="device-badge bound" title="Device bound — one device only">🔒 Bound</span>'
          : '<span class="device-badge free" title="No device bound yet">🔓</span>';

      let expiryBadge = '';
      if (student.expiry_date) {
        const daysLeft = Math.ceil((new Date(student.expiry_date) - Date.now()) / 86400000);
        if (daysLeft < 0)       expiryBadge = '<span class="expiry-badge expired" title="Access expired">🔴 Expired</span>';
        else if (daysLeft <= 7) expiryBadge = `<span class="expiry-badge soon" title="Expiring soon">🟡 ${daysLeft}d left</span>`;
      }

      const item = document.createElement('div');
      item.className = 'batch-admin-item';
      item.innerHTML = `
        <div class="student-card-info">
          <div class="batch-admin-name">
            ${_escHtml(student.name)}
            <span class="student-status-badge ${_escHtml(student.status || 'active')}">${_escHtml(student.status || 'active')}</span>
            ${deviceBadge}
          </div>
          <div class="student-meta-row">
            <span>${_escHtml(student.student_code || '')}</span>
            ${student.mobile ? `<span>${_escHtml(student.mobile)}</span>` : ''}
            ${student.expiry_date ? `<span>Expiry: ${_escHtml(student.expiry_date)}</span>` : '<span>No expiry</span>'}
            ${expiryBadge}
          </div>
          <div class="batch-admin-meta">${_escHtml((student.assigned_batches || []).join(', ') || 'No courses')}</div>
        </div>
        <button class="student-menu-btn" type="button" aria-label="Actions for ${_escHtml(student.name)}">⋮</button>
      `;

      item.querySelector('.student-menu-btn').addEventListener('click', () => _openStudentDrawer(student));

      list.appendChild(item);
    });
  }

  async function _populateCourseFilter() {
    const sel = $('student-course-filter');
    if (!sel) return;
    try {
      const batches = await DB.getAllBatches();
      const current = sel.value;
      sel.innerHTML = '<option value="">All Courses</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.name;
        opt.textContent = `${b.icon || ''} ${b.name}`.trim();
        if (b.name === current) opt.selected = true;
        sel.appendChild(opt);
      });
    } catch {}
  }

  async function _renderPendingStudents(pending) {
    const section = $('pending-requests-section');
    const list    = $('pending-student-list');
    const badge   = $('pending-count-badge');
    if (!section || !list) return;

    if (!pending.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    if (badge) badge.textContent = pending.length;
    list.innerHTML = '';

    const batches = await DB.getAllBatches().catch(() => []);
    const batchOptions = batches.map(b =>
      `<option value="${_escHtml(b.name)}">${_escHtml((b.icon || '') + ' ' + b.name)}</option>`
    ).join('');

    pending.forEach(student => {
      const item = document.createElement('div');
      item.className = 'batch-admin-item';
      item.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="batch-admin-name">${_escHtml(student.name)}</div>
          <div class="student-meta-row">
            <span>📞 ${_escHtml(student.mobile || '—')}</span>
            <span>🏫 ${_escHtml(student.school_name || '—')}</span>
            <span>Code: ${_escHtml(student.student_code)}</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <select class="admin-select pending-course-select" style="flex:1;min-width:120px">
              <option value="">-- Course निवडा --</option>
              ${batchOptions}
            </select>
            <button class="admin-btn-primary pending-approve-btn" type="button">✅ Approve</button>
            <button class="admin-btn-danger pending-reject-btn" type="button">🗑 Reject</button>
          </div>
        </div>
      `;

      item.querySelector('.pending-approve-btn')?.addEventListener('click', async () => {
        const course = item.querySelector('.pending-course-select')?.value;
        if (!course) { APP.toast('Course निवडा', 'error'); return; }
        try {
          await API.updateStudent(student.id, {
            status: 'active',
            assigned_batches: [course],
          });
          APP.toast(`${student.name} approved ✅`, 'success');
          await _loadStudentsAdmin();
        } catch (err) {
          APP.toast(err.message || 'Approve failed', 'error');
        }
      });

      item.querySelector('.pending-reject-btn')?.addEventListener('click', async () => {
        if (!confirm(`"${student.name}" चा request reject करायचा?`)) return;
        try {
          await API.updateStudent(student.id, { status: 'blocked' });
          APP.toast(`${student.name} rejected`, 'info');
          await _loadStudentsAdmin();
        } catch (err) {
          APP.toast(err.message || 'Reject failed', 'error');
        }
      });

      list.appendChild(item);
    });
  }

  async function _loadStudentsAdmin() {
    const list = $('student-admin-list');
    if (!list) return;

    list.innerHTML = '<p class="empty-hint">Loading students...</p>';
    try {
      _studentsCache = await API.fetchStudents();
      // Separate pending self-registrations
      const pending = _studentsCache.filter(s => s.status === 'pending' && s.request_source === 'self');
      const active  = _studentsCache.filter(s => !(s.status === 'pending' && s.request_source === 'self'));
      _studentsCache = active;
      await _renderPendingStudents(pending);
      await _populateCourseFilter();
      _renderStudentList($('student-search')?.value || '');
    } catch (err) {
      list.innerHTML = `<p class="empty-hint">${_escHtml(err.message || 'Could not load students')}</p>`;
    }
  }

  function _showCredsModal(code, pin, courses, expiry) {
    const modal = $('creds-modal');
    if (!modal) return;
    const el = id => document.getElementById(id);
    if (el('creds-code'))    el('creds-code').textContent    = code;
    if (el('creds-pin'))     el('creds-pin').textContent     = pin;
    if (el('creds-courses')) el('creds-courses').textContent = courses.join(', ') || '—';
    if (el('creds-expiry'))  el('creds-expiry').textContent  = expiry || 'No expiry';
    modal.classList.remove('hidden');

    const expiryLine = expiry ? `\nExpiry: ${expiry}` : '';
    const msg = `📚 TeachingBoard Login\nCode: ${code}\nPIN: ${pin}\nCourses: ${courses.join(', ')}${expiryLine}`;
    $('btn-copy-creds').onclick = () => {
      navigator.clipboard?.writeText(msg).catch(() => {});
      APP.toast('Copied!', 'success');
    };
    $('btn-wa-creds').onclick = () => {
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    };
    $('btn-close-creds').onclick = () => modal.classList.add('hidden');
  }

  async function _saveStudentAccount() {
    try {
      const studentId = String($('student-edit-id')?.value || '').trim();
      const pinVal    = String($('student-pin')?.value || '').trim();
      const expiryVal = String($('student-expiry')?.value || '').trim();
      const payload   = _studentFormPayload({ requirePin: !studentId });
      if (studentId) {
        await API.updateStudent(studentId, payload);
        APP.toast('Student updated', 'success');
      } else {
        await API.createStudent(payload);
        _showCredsModal(payload.student_code, pinVal, payload.assigned_batches, expiryVal);
      }
      _resetStudentForm();
      await _loadStudentsAdmin();
    } catch (err) {
      APP.toast(err.message || 'Could not save student', 'error');
    }
  }

  // ════════════════════════
  // TEACHER MANAGEMENT
  // ════════════════════════

  let _teachersCache = [];
  let _teacherSearchTimer = null;

  function _autoTeacherCode(name) {
    const prefix = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'TCH';
    return prefix + String(Math.floor(100 + Math.random() * 900));
  }

  function _resetTeacherForm() {
    _setValue('teacher-edit-id', '');
    _setValue('teacher-name', '');
    _setValue('teacher-code', '');
    _setValue('teacher-mobile', '');
    _setValue('teacher-pin', '');
    _setValue('teacher-assigned-students', '');
  }

  function _renderTeacherList(search = '') {
    const list = $('teacher-admin-list');
    if (!list) return;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? _teachersCache.filter(t =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.teacher_code || '').toLowerCase().includes(q)
        )
      : _teachersCache;

    if (!filtered.length) {
      list.innerHTML = '<p class="empty-hint">No teachers found</p>';
      return;
    }

    list.innerHTML = filtered.map(t => {
      const stuCount = Array.isArray(t.assigned_students) ? t.assigned_students.length : 0;
      return `<div class="student-row" data-id="${_escHtml(t.id)}">
        <div class="student-row-main">
          <span class="student-row-code">${_escHtml(t.teacher_code || '—')}</span>
          <span class="student-row-name">${_escHtml(t.name)}</span>
          <span class="student-status-badge active">${stuCount} students</span>
        </div>
        <div class="student-row-actions">
          <button class="admin-btn-secondary" data-teacher-edit="${_escHtml(t.id)}">Edit</button>
          <button class="admin-btn-danger" data-teacher-delete="${_escHtml(t.id)}">Delete</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-teacher-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = _teachersCache.find(x => x.id === btn.dataset.teacherEdit);
        if (!t) return;
        _setValue('teacher-edit-id', t.id);
        _setValue('teacher-name', t.name);
        _setValue('teacher-code', t.teacher_code || '');
        _setValue('teacher-mobile', t.mobile || '');
        _setValue('teacher-assigned-students', (t.assigned_students || []).join(', '));
        $('atab-teachers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    list.querySelectorAll('[data-teacher-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = _teachersCache.find(x => x.id === btn.dataset.teacherDelete);
        if (!t) return;
        if (!confirm(`Delete teacher "${t.name}"?`)) return;
        try {
          await API.deleteTeacher(t.id);
          APP.toast('Teacher deleted', 'success');
          await _loadTeachersAdmin();
        } catch (err) {
          APP.toast(err.message || 'Could not delete teacher', 'error');
        }
      });
    });
  }

  async function _loadTeachersAdmin() {
    const list = $('teacher-admin-list');
    if (!list) return;
    list.innerHTML = '<p class="empty-hint">Loading...</p>';
    try {
      _teachersCache = await API.fetchTeachers();
      _renderTeacherList($('teacher-search')?.value || '');
    } catch (err) {
      list.innerHTML = `<p class="empty-hint">${_escHtml(err.message || 'Could not load teachers')}</p>`;
    }
  }

  function _showTeacherCredsModal(code, pin, students) {
    const modal = $('teacher-creds-modal');
    if (!modal) return;
    document.getElementById('teacher-creds-code').textContent    = code;
    document.getElementById('teacher-creds-pin').textContent     = pin;
    document.getElementById('teacher-creds-students').textContent = students.join(', ') || '—';
    modal.classList.remove('hidden');
    const msg = `👩‍🏫 TeachingBoard Teacher Login\nCode: ${code}\nPIN: ${pin}\nStudents: ${students.join(', ')}`;
    $('btn-copy-teacher-creds').onclick = () => { navigator.clipboard?.writeText(msg).catch(() => {}); APP.toast('Copied!', 'success'); };
    $('btn-wa-teacher-creds').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    $('btn-close-teacher-creds').onclick = () => modal.classList.add('hidden');
  }

  async function _saveTeacherAccount() {
    try {
      const teacherId = String($('teacher-edit-id')?.value || '').trim();
      const name      = String($('teacher-name')?.value || '').trim();
      const code      = String($('teacher-code')?.value || '').trim().toUpperCase();
      const pin       = String($('teacher-pin')?.value || '').trim();
      const mobile    = String($('teacher-mobile')?.value || '').trim();
      const rawStudents = String($('teacher-assigned-students')?.value || '').split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);

      if (!name) { APP.toast('Name is required', 'error'); return; }

      const payload = { name, mobile, assigned_students: rawStudents };
      if (code)  payload.teacher_code = code;
      if (pin) {
        if (!/^\d{4}$/.test(pin)) { APP.toast('PIN must be 4 digits', 'error'); return; }
        payload.pin = pin;
      }

      if (teacherId) {
        await API.updateTeacher(teacherId, payload);
        APP.toast('Teacher updated', 'success');
      } else {
        if (!pin) { APP.toast('PIN is required for new teacher', 'error'); return; }
        const result = await API.createTeacher(payload);
        const created = result?.data || {};
        _showTeacherCredsModal(created.teacher_code || code, result?.pin || pin, rawStudents);
      }
      _resetTeacherForm();
      await _loadTeachersAdmin();
    } catch (err) {
      APP.toast(err.message || 'Could not save teacher', 'error');
    }
  }

  // ════════════════════════
  // PARENT MANAGEMENT
  // ════════════════════════

  let _parentsCache = [];
  let _parentSearchTimer = null;

  function _autoParentCode(name) {
    const prefix = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'PA';
    return 'P' + prefix + String(Math.floor(100 + Math.random() * 900));
  }

  function _resetParentForm() {
    _setValue('parent-edit-id', '');
    _setValue('parent-name', '');
    _setValue('parent-code', '');
    _setValue('parent-mobile', '');
    _setValue('parent-pin', '');
    _setValue('parent-children', '');
  }

  function _renderParentList(search = '') {
    const list = $('parent-admin-list');
    if (!list) return;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? _parentsCache.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.parent_code || '').toLowerCase().includes(q)
        )
      : _parentsCache;

    if (!filtered.length) {
      list.innerHTML = '<p class="empty-hint">No parents found</p>';
      return;
    }

    list.innerHTML = filtered.map(p => {
      const childCount = Array.isArray(p.children) ? p.children.length : 0;
      return `<div class="student-row" data-id="${_escHtml(p.id)}">
        <div class="student-row-main">
          <span class="student-row-code">${_escHtml(p.parent_code || '—')}</span>
          <span class="student-row-name">${_escHtml(p.name)}</span>
          <span class="student-status-badge active">${childCount} children</span>
        </div>
        <div class="student-row-actions">
          <button class="admin-btn-secondary" data-parent-edit="${_escHtml(p.id)}">Edit</button>
          <button class="admin-btn-danger" data-parent-delete="${_escHtml(p.id)}">Delete</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-parent-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = _parentsCache.find(x => x.id === btn.dataset.parentEdit);
        if (!p) return;
        _setValue('parent-edit-id', p.id);
        _setValue('parent-name', p.name);
        _setValue('parent-code', p.parent_code || '');
        _setValue('parent-mobile', p.mobile || '');
        _setValue('parent-children', (p.children || []).join(', '));
        $('atab-parents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    list.querySelectorAll('[data-parent-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = _parentsCache.find(x => x.id === btn.dataset.parentDelete);
        if (!p) return;
        if (!confirm(`Delete parent "${p.name}"?`)) return;
        try {
          await API.deleteParent(p.id);
          APP.toast('Parent deleted', 'success');
          await _loadParentsAdmin();
        } catch (err) {
          APP.toast(err.message || 'Could not delete parent', 'error');
        }
      });
    });
  }

  async function _loadParentsAdmin() {
    const list = $('parent-admin-list');
    if (!list) return;
    list.innerHTML = '<p class="empty-hint">Loading...</p>';
    try {
      _parentsCache = await API.fetchParents();
      _renderParentList($('parent-search')?.value || '');
    } catch (err) {
      list.innerHTML = `<p class="empty-hint">${_escHtml(err.message || 'Could not load parents')}</p>`;
    }
  }

  function _showParentCredsModal(code, pin, children) {
    const modal = $('parent-creds-modal');
    if (!modal) return;
    document.getElementById('parent-creds-code').textContent    = code;
    document.getElementById('parent-creds-pin').textContent     = pin;
    document.getElementById('parent-creds-children').textContent = children.join(', ') || '—';
    modal.classList.remove('hidden');
    const msg = `👨‍👩‍👧 TeachingBoard Parent Login\nCode: ${code}\nPIN: ${pin}\nChildren: ${children.join(', ')}`;
    $('btn-copy-parent-creds').onclick = () => { navigator.clipboard?.writeText(msg).catch(() => {}); APP.toast('Copied!', 'success'); };
    $('btn-wa-parent-creds').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    $('btn-close-parent-creds').onclick = () => modal.classList.add('hidden');
  }

  async function _saveParentAccount() {
    try {
      const parentId = String($('parent-edit-id')?.value || '').trim();
      const name     = String($('parent-name')?.value || '').trim();
      const code     = String($('parent-code')?.value || '').trim().toUpperCase();
      const pin      = String($('parent-pin')?.value || '').trim();
      const mobile   = String($('parent-mobile')?.value || '').trim();
      const rawChildren = String($('parent-children')?.value || '').split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);

      if (!name) { APP.toast('Name is required', 'error'); return; }

      const payload = { name, mobile, children: rawChildren };
      if (code)  payload.parent_code = code;
      if (pin) {
        if (!/^\d{4}$/.test(pin)) { APP.toast('PIN must be 4 digits', 'error'); return; }
        payload.pin = pin;
      }

      if (parentId) {
        await API.updateParent(parentId, payload);
        APP.toast('Parent updated', 'success');
      } else {
        if (!pin) { APP.toast('PIN is required for new parent', 'error'); return; }
        const result = await API.createParent(payload);
        const created = result?.data || {};
        _showParentCredsModal(created.parent_code || code, result?.pin || pin, rawChildren);
      }
      _resetParentForm();
      await _loadParentsAdmin();
    } catch (err) {
      APP.toast(err.message || 'Could not save parent', 'error');
    }
  }

  // ════════════════════════
  // APP VERSIONS
  // ════════════════════════

  let _versionsCache = [];

  async function _loadVersionsAdmin() {
    const listEl = $('version-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="empty-hint">Loading…</p>';
    try {
      _versionsCache = await API.fetchAllAppVersions();
      _renderVersionList();
    } catch (err) {
      listEl.innerHTML = `<p class="empty-hint">${String(err?.message || 'Failed to load versions')}</p>`;
    }
  }

  function _renderVersionList() {
    const listEl = $('version-list');
    if (!listEl) return;
    if (!_versionsCache.length) {
      listEl.innerHTML = '<p class="empty-hint">कोणतेही versions नाहीत. वर form भरा.</p>';
      return;
    }
    listEl.innerHTML = _versionsCache.map(v => {
      const badge = v.is_latest
        ? '<span class="ver-badge-latest">● LATEST</span>'
        : '';
      const date = v.created_at
        ? new Date(v.created_at).toLocaleDateString('mr-IN')
        : '';
      const platformLabel = { android: '🤖 Android', web: '🌐 Web', all: '📱 All' }[v.platform] || v.platform;
      return `<div class="student-card ver-card">
        <div class="student-card-main">
          <div class="student-card-name">v${_esc(v.version)} ${badge}</div>
          <div class="student-card-meta">${platformLabel} · ${date}</div>
          ${v.release_notes ? `<div class="student-card-meta ver-notes">${_esc(v.release_notes)}</div>` : ''}
          ${v.apk_url ? `<div class="student-card-meta"><a href="${_esc(v.apk_url)}" target="_blank" rel="noopener" class="ver-link">🔗 Download URL</a></div>` : ''}
        </div>
        <div class="student-card-actions">
          ${!v.is_latest
            ? `<button class="admin-btn-secondary btn-activate-ver" data-id="${_esc(v.version_id)}">✓ Activate</button>`
            : ''}
          <button class="admin-btn-danger btn-delete-ver" data-id="${_esc(v.version_id)}">🗑️</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.btn-activate-ver').forEach(btn => {
      btn.addEventListener('click', () => _activateVersion(btn.dataset.id));
    });
    listEl.querySelectorAll('.btn-delete-ver').forEach(btn => {
      btn.addEventListener('click', () => _deleteVersion(btn.dataset.id));
    });
  }

  async function _saveVersion() {
    const version  = String($('ver-version')?.value  || '').trim();
    const apk_url  = String($('ver-apk-url')?.value  || '').trim();
    const notes    = String($('ver-notes')?.value     || '').trim();
    const platform = $('ver-platform')?.value || 'android';
    const activate = $('ver-activate')?.checked ?? true;

    if (!version) { APP.toast('Version number आवश्यक आहे (उदा. 1.2.0)', 'error'); return; }
    if (!/^\d+\.\d+\.\d+$/.test(version)) { APP.toast('Format: 1.2.0 असा असावा', 'error'); return; }
    if (apk_url && !/^https?:\/\/.+/.test(apk_url)) { APP.toast('APK URL https:// ने सुरू असावा', 'error'); return; }

    try {
      await API.createAppVersion({ version, apk_url, release_notes: notes, platform, activate });
      APP.toast(`v${version} added${activate ? ' and activated' : ''}`, 'success');
      if ($('ver-version'))  $('ver-version').value  = '';
      if ($('ver-apk-url'))  $('ver-apk-url').value  = '';
      if ($('ver-notes'))    $('ver-notes').value    = '';
      if ($('ver-activate')) $('ver-activate').checked = true;
      await _loadVersionsAdmin();
    } catch (err) {
      APP.toast(err.message || 'Version save failed', 'error');
    }
  }

  async function _fetchFromGitHub() {
    const btn = $('btn-fetch-github');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Fetching...'; }
    try {
      const REPO = 'nageshkumbhar113-blip/TeachingBoard-frontend';
      const res  = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const data = await res.json();

      const apkAsset = (data.assets || []).find(a => a.name.endsWith('.apk'));
      const version  = String(data.tag_name || '').replace(/^v/i, '').trim();
      const apkUrl   = apkAsset?.browser_download_url || '';
      const notes    = String(data.body || '').trim().slice(0, 500);

      if (!version) throw new Error('GitHub release tag सापडला नाही');

      if ($('ver-version'))  $('ver-version').value  = version;
      if ($('ver-apk-url'))  $('ver-apk-url').value  = apkUrl;
      if ($('ver-notes'))    $('ver-notes').value    = notes;
      if ($('ver-platform')) $('ver-platform').value = 'android';

      const sizeKb = apkAsset ? Math.round(apkAsset.size / 1024) : 0;
      APP.toast(`v${version} fetch झाले${sizeKb ? ` (${sizeKb} KB)` : ''} — खाली Save करा`, 'success');
    } catch (err) {
      APP.toast('GitHub fetch failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📦 GitHub वरून Fetch करा'; }
    }
  }

  async function _activateVersion(versionId) {
    if (!versionId) return;
    try {
      await API.activateAppVersion(versionId);
      APP.toast('Version activated — students ला update दिसेल', 'success');
      await _loadVersionsAdmin();
    } catch (err) {
      APP.toast(err.message || 'Activation failed', 'error');
    }
  }

  async function _deleteVersion(versionId) {
    if (!versionId) return;
    if (!confirm('हे version delete करायचे आहे का?')) return;
    try {
      await API.deleteAppVersion(versionId);
      APP.toast('Version deleted', 'success');
      await _loadVersionsAdmin();
    } catch (err) {
      APP.toast(err.message || 'Delete failed', 'error');
    }
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Compress image file using Canvas API → returns base64 WebP data URL
  // maxW/maxH: max dimensions; quality: 0-1 WebP quality
  function _compressImage(file, maxW, maxH, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File read failed'));
      reader.onload = ev => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image decode failed'));
        img.onload = () => {
          let { width: w, height: h } = img;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // Try WebP; fall back to JPEG if browser doesn't support WebP output
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function _loadSettings() {
    _setValue('default-timer', await DB.getSetting('timer', '30'));
    _setValue('default-theme', await DB.getSetting('admin_theme', 'theme-light'));
    if ($('setting-shuffle')) $('setting-shuffle').checked = await DB.getSetting('shuffle', false);
    _setValue('api-url', await DB.getSetting('api_url', API.DEFAULT_API_URL));
  }

  async function _savePin() {
    const pin = $('new-pin').value.trim();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      APP.toast('PIN must be 4 digits', 'error'); return;
    }
    await DB.setSetting('admin_pin', pin);
    $('new-pin').value = '';
    APP.toast(I18N.t('pin.saved'), 'success');
  }

  // ════════════════════════
  // INIT
  // ════════════════════════
  // SYNC STATUS BAR
  // ════════════════════════

  function _formatLastSync(ts) {
    if (!ts) return '';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1)  return ' · just now';
    if (mins < 60) return ` · ${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return ` · ${hrs}h ago`;
  }

  function _renderSyncStatus({ pending = 0, failed = 0, syncing = false, online = true, lastSync = 0, locked = false } = {}) {
    const bar      = $('sync-status-bar');
    const iconEl   = $('sync-status-icon');
    const textEl   = $('sync-status-text');
    const retryBtn = $('sync-retry-btn');
    if (!bar) return;

    bar.classList.remove('sync-all-synced', 'sync-pending', 'sync-syncing', 'sync-failed', 'sync-offline');

    let icon, text, cls, showRetry = false;

    if (!online) {
      cls = 'sync-offline'; icon = '⚪'; text = 'Offline — changes queued';
    } else if (syncing) {
      cls = 'sync-syncing'; icon = '🔄'; text = 'Syncing…';
    } else if (failed > 0) {
      cls = 'sync-failed'; icon = '🔴';
      text = `${failed} item${failed > 1 ? 's' : ''} failed to sync`;
      showRetry = true;
    } else if (pending > 0) {
      cls = 'sync-pending'; icon = '🟡';
      text = `${pending} item${pending > 1 ? 's' : ''} pending sync`;
      showRetry = true;
    } else {
      cls = 'sync-all-synced'; icon = '🟢';
      text = 'All synced' + _formatLastSync(lastSync);
    }

    bar.classList.add(cls);
    if (iconEl) iconEl.textContent = icon;
    if (textEl) textEl.textContent = text;
    if (retryBtn) retryBtn.classList.toggle('hidden', !showRetry);

    // Disable publish button while sync is in progress to prevent double-publish
    const publishBtn = document.getElementById('tb-publish');
    if (publishBtn) publishBtn.disabled = locked;
  }

  // ════════════════════════

  function init() {
    _initPinInputs();
    _initTabs();

    // Overlay / close
    $('admin-close')?.addEventListener('click', close);
    $('admin-overlay')?.addEventListener('click', e => {
      if (e.target === $('admin-overlay')) close();
    });
    $('qedit-overlay')?.addEventListener('click', e => {
      if (e.target === $('qedit-overlay')) $('qedit-overlay')?.classList.add('hidden');
    });
    $('word-edit-overlay')?.addEventListener('click', e => {
      if (e.target === $('word-edit-overlay')) $('word-edit-overlay')?.classList.add('hidden');
    });

    _initWordsTab();

    // Question editor
    $('btn-add-question')?.addEventListener('click', () => _openQEditor());
    $('qedit-close')?.addEventListener('click', () => $('qedit-overlay')?.classList.add('hidden'));
    $('qedit-form')?.addEventListener('submit', _saveQEditor);
    $('btn-qe-delete')?.addEventListener('click', _deleteCurrentQ);
    $('qe-type')?.addEventListener('change', _updateQETypeView);
    // Live preview — delegation on form catches all input/change inside it
    $('qedit-form')?.addEventListener('input',  _updateQEPreview);
    $('qedit-form')?.addEventListener('change', _updateQEPreview);
    $('qe-batch')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'qe-batch',
      subjectId: 'qe-subject',
      chapterId: 'qe-chapter',
    }));
    $('qe-subject')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'qe-batch',
      subjectId: 'qe-subject',
      chapterId: 'qe-chapter',
      subjectValue: $('qe-subject')?.value || '',
    }));

    // Question filters
    ['admin-batch-filter','admin-subject-filter','admin-chapter-filter'].forEach(id => {
      $(id)?.addEventListener('change', () => loadQuestionBank({ resetLimit: true }));
    });
    $('admin-search-filter')?.addEventListener('input', () => {
      clearTimeout(_questionSearchTimer);
      _questionSearchTimer = setTimeout(() => loadQuestionBank({ resetLimit: true }), 160);
    });
    $('btn-q-bank-more')?.addEventListener('click', () => {
      _questionBankLimit += QUESTION_BANK_PAGE_SIZE;
      loadQuestionBank();
    });

    // Lesson editor
    $('btn-save-lesson')?.addEventListener('click', _saveLessonItem);
    $('btn-cancel-lesson')?.addEventListener('click', _resetLessonEditor);

    // CSV drop zone
    const dropZone = $('csv-drop-zone');
    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) $('csv-file-input').files = e.dataTransfer.files;
    });

    // Import / export
    $('import-batch')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'import-batch',
      subjectId: 'import-subject',
      chapterId: 'import-chapter',
    }));
    $('import-subject')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'import-batch',
      subjectId: 'import-subject',
      chapterId: 'import-chapter',
      subjectValue: $('import-subject')?.value || '',
    }));
    $('bulk-batch')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'bulk-batch',
      subjectId: 'bulk-subject',
      chapterId: 'bulk-chapter',
    }));
    $('bulk-subject')?.addEventListener('change', () => _refreshFormHierarchy({
      batchId: 'bulk-batch',
      subjectId: 'bulk-subject',
      chapterId: 'bulk-chapter',
      subjectValue: $('bulk-subject')?.value || '',
    }));
    $('btn-sample-csv')?.addEventListener('click', _downloadSampleCSV);
    $('btn-copy-prompt')?.addEventListener('click', _copyAIPrompt);
    $('btn-bulk-import')?.addEventListener('click', _bulkImport);
    $('btn-csv-import')?.addEventListener('click', _importCSV);
    $('btn-zip-import')?.addEventListener('click', _importZIP);
    $('btn-export-zip')?.addEventListener('click', _exportZIP);
    $('btn-export-pdf')?.addEventListener('click', async () => {
      const qs = await DB.getAllQuestions();
      PDF.exportQuestionPaper(qs, {});
    });
    $('btn-gdrive-backup')?.addEventListener('click', async () => {
      APP.toast('Google Drive integration — add gapi.js for full support', 'info');
      const payload = await DB.exportJSON();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `teachingboard_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });

    // Test portal
    $('btn-create-quiz')?.addEventListener('click', () => TEST_BUILDER.open());
    $('quiz-search')?.addEventListener('input', () => {
      clearTimeout(_quizSearchTimer);
      _quizSearchTimer = setTimeout(() => loadQuizList(), 200);
    });
    $('quiz-batch-filter')?.addEventListener('change', () => {
      const sub = $('quiz-subject-filter'); if (sub) sub.value = '';
      const ch  = $('quiz-chapter-filter'); if (ch)  ch.value  = '';
      loadQuizList();
    });
    $('quiz-subject-filter')?.addEventListener('change', () => {
      const ch = $('quiz-chapter-filter'); if (ch) ch.value = '';
      loadQuizList();
    });
    $('quiz-chapter-filter')?.addEventListener('change', () => loadQuizList());
    $('quiz-status-filter')?.addEventListener('change',  () => loadQuizList());

    // Batch
    $('btn-add-batch')?.addEventListener('click', _addBatch);
    $('btn-add-class-subject')?.addEventListener('click', _addBatchSubject);
    $('btn-add-subject-chapter')?.addEventListener('click', _addSubjectChapter);
    $('class-subject-batch')?.addEventListener('change', _loadSubjectAdmin);
    $('class-chapter-batch')?.addEventListener('change', async () => {
      await _refreshFormHierarchy({
        batchId: 'class-chapter-batch',
        subjectId: 'class-chapter-subject',
        chapterId: null,
      });
      await _loadChapterAdmin();
    });
    $('class-chapter-subject')?.addEventListener('change', _loadChapterAdmin);

    // Students
    $('btn-save-student')?.addEventListener('click', _saveStudentAccount);
    $('btn-reset-student')?.addEventListener('click', _resetStudentForm);
    $('btn-refresh-students')?.addEventListener('click', _loadStudentsAdmin);
    $('btn-gen-code')?.addEventListener('click', () => {
      const name = String($('student-name')?.value || '').trim();
      const code = _autoStudentCode(name);
      if ($('student-code')) $('student-code').value = code;
    });
    $('btn-gen-pin')?.addEventListener('click', () => {
      const pin = _genPin();
      if ($('student-pin')) {
        $('student-pin').value = pin;
        $('student-pin').type = 'text';
      }
    });
    $('btn-toggle-pin')?.addEventListener('click', () => {
      const inp = $('student-pin');
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    $('student-search')?.addEventListener('input', e => {
      clearTimeout(_studentSearchTimer);
      _studentSearchTimer = setTimeout(() => _renderStudentList(e.target.value), 120);
    });
    $('student-course-filter')?.addEventListener('change', () => {
      clearTimeout(_studentSearchTimer);
      _renderStudentList($('student-search')?.value || '');
    });

    // Student drawer close
    $('student-action-overlay')?.addEventListener('click', _closeStudentDrawer);
    $('drawer-cancel-btn')?.addEventListener('click', _closeStudentDrawer);

    // Teachers
    $('btn-save-teacher')?.addEventListener('click', _saveTeacherAccount);
    $('btn-reset-teacher')?.addEventListener('click', _resetTeacherForm);
    $('btn-refresh-teachers')?.addEventListener('click', _loadTeachersAdmin);
    $('btn-gen-teacher-code')?.addEventListener('click', () => {
      const name = String($('teacher-name')?.value || '').trim();
      if ($('teacher-code')) $('teacher-code').value = _autoTeacherCode(name);
    });
    $('btn-gen-teacher-pin')?.addEventListener('click', () => {
      const pin = _genPin();
      if ($('teacher-pin')) { $('teacher-pin').value = pin; $('teacher-pin').type = 'text'; }
    });
    $('teacher-search')?.addEventListener('input', e => {
      clearTimeout(_teacherSearchTimer);
      _teacherSearchTimer = setTimeout(() => _renderTeacherList(e.target.value), 120);
    });

    // Parents
    $('btn-save-parent')?.addEventListener('click', _saveParentAccount);
    $('btn-reset-parent')?.addEventListener('click', _resetParentForm);
    $('btn-refresh-parents')?.addEventListener('click', _loadParentsAdmin);
    $('btn-gen-parent-code')?.addEventListener('click', () => {
      const name = String($('parent-name')?.value || '').trim();
      if ($('parent-code')) $('parent-code').value = _autoParentCode(name);
    });
    $('btn-gen-parent-pin')?.addEventListener('click', () => {
      const pin = _genPin();
      if ($('parent-pin')) { $('parent-pin').value = pin; $('parent-pin').type = 'text'; }
    });
    $('parent-search')?.addEventListener('input', e => {
      clearTimeout(_parentSearchTimer);
      _parentSearchTimer = setTimeout(() => _renderParentList(e.target.value), 120);
    });

    // App Versions
    $('btn-save-version')?.addEventListener('click', _saveVersion);
    $('btn-refresh-versions')?.addEventListener('click', _loadVersionsAdmin);
    $('btn-fetch-github')?.addEventListener('click', _fetchFromGitHub);

    // Sync
    $('btn-share-url-qr')?.addEventListener('click', _generateServerUrlQR);
    $('btn-gen-qr')?.addEventListener('click', _generateQR);
    $('btn-api-sync')?.addEventListener('click', () => SYNC.deltaSync($('api-url').value));

    // Sync status bar
    _renderSyncStatus(SYNC.getSyncStatus());
    SYNC.onSyncStatusChange(_renderSyncStatus);
    $('sync-retry-btn')?.addEventListener('click', () => SYNC.retryQueue());

    // Settings
    $('btn-save-pin')?.addEventListener('click', _savePin);
    $('default-timer')?.addEventListener('change', e => DB.setSetting('timer', e.target.value));
    $('default-theme')?.addEventListener('change', e => {
      APP.setTheme(e.target.value);
      DB.setSetting('admin_theme', e.target.value);
    });
    $('setting-shuffle')?.addEventListener('change', e => DB.setSetting('shuffle', e.target.checked));
    $('btn-reset-data')?.addEventListener('click', async () => {
      if (confirm(I18N.t('reset.confirm'))) {
        await DB.resetAll();
        APP.toast('✅ Data reset complete', 'info');
        APP.refreshHome();
        await _loadAdminContent();
      }
    });
  }

  // ════════════════════════
  // WORDS / VOCABULARY
  // ════════════════════════

  let _wordsSkip = 0;
  const _wordsLimit = 50;
  let _wordsTotal   = 0;
  let _bulkPreviewData = [];

  async function _loadWordBank() {
    const batch   = $('words-filter-batch')?.value || '';
    const subject = $('words-filter-subject')?.value || '';
    const search  = $('words-search')?.value || '';
    const tbody   = $('words-table-body');
    const pagination = $('words-pagination');
    if (!tbody) return;

    try {
      const res = await API.fetchAdminWords({ batch, subject, search, skip: _wordsSkip, limit: _wordsLimit });
      _wordsTotal = res.total || 0;
      const words = res.data || [];

      tbody.innerHTML = '';
      if (!words.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">No words found</td></tr>`;
      } else {
        words.forEach(w => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="words-seq">${w.seq_num}</td>
            <td class="words-word-cell">${_esc(w.word)}</td>
            <td class="words-meaning-cell">${_esc(w.meaning_mr)}</td>
            <td class="words-meaning-cell">${_esc(w.meaning_en)}</td>
            <td class="words-phonics-cell">${_esc(w.phonics)}</td>
            <td><span class="words-diff-badge words-diff-${w.difficulty}">${w.difficulty}</span></td>
            <td class="words-addedby-badge">${w.added_by}</td>
            <td class="words-actions">
              <button class="admin-btn-secondary words-btn-edit"
                data-wid="${_esc(w.word_id)}"
                data-emoji="${_esc(w.emoji || '')}"
                data-image-url="${_esc(w.image_url || '')}"
                data-visual-type="${_esc(w.visual_type || 'word')}">Edit</button>
              <button class="admin-btn-secondary words-btn-delete" data-wid="${_esc(w.word_id)}" data-wname="${_esc(w.word)}">Del</button>
            </td>`;
          tbody.appendChild(tr);
        });
      }

      if (pagination) {
        const page = Math.floor(_wordsSkip / _wordsLimit) + 1;
        const pages = Math.ceil(_wordsTotal / _wordsLimit) || 1;
        pagination.innerHTML = `
          <button class="admin-btn-secondary" id="words-prev" ${_wordsSkip === 0 ? 'disabled' : ''}>&#8249;</button>
          <span>Page ${page} / ${pages} &nbsp;(${_wordsTotal} words)</span>
          <button class="admin-btn-secondary" id="words-next" ${_wordsSkip + _wordsLimit >= _wordsTotal ? 'disabled' : ''}>&#8250;</button>`;
        $('words-prev')?.addEventListener('click', () => { _wordsSkip = Math.max(0, _wordsSkip - _wordsLimit); _loadWordBank(); });
        $('words-next')?.addEventListener('click', () => { _wordsSkip += _wordsLimit; _loadWordBank(); });
      }

      // Test info bar — show how many tests are ready for this batch+subject
      _updateTestInfoBar(batch, subject, _wordsTotal);

    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="color:#f87171;padding:12px">${_esc(err.message)}</td></tr>`;
    }
  }

  function _updateTestInfoBar(batch, subject, total) {
    const bar     = $('words-test-info-bar');
    const text    = $('words-test-info-text');
    const btn     = $('btn-words-test-info');
    const reseqBtn = $('btn-resequence-words');
    if (!bar || !text) return;

    if (reseqBtn) reseqBtn.style.display = (batch && subject) ? '' : 'none';

    if (batch && subject && total > 0) {
      const tc = Math.ceil(total / 20);
      let chips = '';
      for (let i = 1; i <= tc; i++) {
        const from = (i - 1) * 20 + 1;
        const to   = Math.min(i * 20, total);
        chips += `<span class="tpi-chip" data-testnum="${i}" data-from="${from}" data-to="${to}" title="Preview Test ${i}">Test ${i} (${from}–${to})</span>`;
      }
      text.innerHTML = `📝 <strong>${tc} test${tc !== 1 ? 's' : ''} ready</strong> — ${total} words &nbsp;|&nbsp; <span class="tpi-chips">${chips}</span>`;

      // Chip click → open preview
      text.querySelectorAll('.tpi-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          _openTestPreview(
            parseInt(chip.dataset.testnum),
            batch, subject,
            parseInt(chip.dataset.from),
            parseInt(chip.dataset.to)
          );
        });
      });

      bar.classList.remove('hidden');
      if (btn) btn.style.display = '';
    } else {
      bar.classList.add('hidden');
      if (btn) btn.style.display = 'none';
    }
  }

  async function _openTestPreview(testNum, batch, subject, wordFrom, wordTo) {
    const overlay = $('test-preview-overlay');
    const title   = $('test-preview-title');
    const meta    = $('test-preview-meta');
    const body    = $('test-preview-body');
    if (!overlay) return;

    if (title) title.textContent = `Test ${testNum} — Preview`;
    if (meta)  meta.textContent  = `${batch} / ${subject} · Words ${wordFrom}–${wordTo}`;
    if (body)  body.innerHTML    = '<div class="test-preview-loading">Loading…</div>';
    overlay.classList.remove('hidden');

    // Store context for re-load after word edit
    overlay.dataset.testNum  = testNum;
    overlay.dataset.batch    = batch;
    overlay.dataset.subject  = subject;
    overlay.dataset.wordFrom = wordFrom;
    overlay.dataset.wordTo   = wordTo;

    await _refreshTestPreview();
  }

  async function _refreshTestPreview() {
    const overlay = $('test-preview-overlay');
    const body    = $('test-preview-body');
    if (!overlay || !body) return;

    const batch   = overlay.dataset.batch    || '';
    const subject = overlay.dataset.subject  || '';
    const testNum = parseInt(overlay.dataset.testNum) || 1;

    try {
      const res   = await API.fetchAdminTestWords({ batch, subject, testNum });
      const words = res.data || [];

      if (!words.length) {
        body.innerHTML = '<div class="test-preview-loading">No words found.</div>';
        return;
      }

      let rows = '';
      words.forEach(w => {
        rows += `
          <tr>
            <td class="tp-seq">${w.seq_num}</td>
            <td class="tp-word">${_esc(w.word)}</td>
            <td class="tp-meaning">${_esc(w.meaning_mr || '—')}</td>
            <td class="tp-meaning">${_esc(w.meaning_en || '—')}</td>
            <td class="tp-phonics">${_esc(w.phonics || '—')}</td>
            <td class="tp-actions">
              <button class="admin-btn-secondary admin-btn-sm tp-edit-btn"
                data-wid="${_esc(w.word_id)}"
                data-word="${_esc(w.word)}"
                data-meaning-mr="${_esc(w.meaning_mr || '')}"
                data-meaning-en="${_esc(w.meaning_en || '')}"
                data-phonics="${_esc(w.phonics || '')}"
                data-image-url="${_esc(w.image_url || '')}"
                data-emoji="${_esc(w.emoji || '')}"
                data-visual-type="${_esc(w.visual_type || 'word')}"
                data-difficulty="${_esc(w.difficulty || 'medium')}"
                data-batch="${_esc(batch)}"
                data-subject="${_esc(subject)}">Edit</button>
            </td>
          </tr>`;
      });

      body.innerHTML = `
        <table class="test-preview-table">
          <thead>
            <tr>
              <th class="tp-seq">#</th>
              <th>Word</th>
              <th>Meaning (MR)</th>
              <th>Meaning (EN)</th>
              <th>Phonics</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

      // Edit button delegation inside preview
      body.querySelectorAll('.tp-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await _openWordEditor({
            word_id:     btn.dataset.wid,
            word:        btn.dataset.word,
            meaning_mr:  btn.dataset.meaningMr,
            meaning_en:  btn.dataset.meaningEn,
            phonics:     btn.dataset.phonics,
            image_url:   btn.dataset.imageUrl,
            emoji:       btn.dataset.emoji,
            visual_type: btn.dataset.visualType || 'word',
            difficulty:  btn.dataset.difficulty,
            batch:       btn.dataset.batch,
            subject:     btn.dataset.subject,
          });
          // After editor closes, refresh preview automatically
          _schedulePreviewRefresh();
        });
      });
    } catch (err) {
      body.innerHTML = `<div class="test-preview-loading" style="color:#f87171">${_esc(err.message)}</div>`;
    }
  }

  let _previewRefreshTimer = null;
  function _schedulePreviewRefresh() {
    // Refresh preview 400ms after word-edit-overlay closes
    const observer = new MutationObserver(() => {
      const overlay = $('word-edit-overlay');
      if (overlay?.classList.contains('hidden')) {
        observer.disconnect();
        clearTimeout(_previewRefreshTimer);
        _previewRefreshTimer = setTimeout(() => _refreshTestPreview(), 300);
      }
    });
    const target = $('word-edit-overlay');
    if (target) observer.observe(target, { attributes: true, attributeFilter: ['class'] });
  }

  function _weSetVisualType(vt) {
    const valid = ['word', 'emoji', 'image'].includes(vt) ? vt : 'word';
    document.querySelectorAll('input[name="we-visual-type"]').forEach(r => {
      r.checked = (r.value === valid);
    });
    const emojiRow = $('we-emoji-row');
    const imageRow = $('we-image-row');
    if (emojiRow) emojiRow.style.display = valid === 'emoji' ? '' : 'none';
    if (imageRow) imageRow.style.display = valid === 'image' ? '' : 'none';
  }

  function _weGetVisualType() {
    return document.querySelector('input[name="we-visual-type"]:checked')?.value || 'word';
  }

  async function _openWordEditor(wordData) {
    const overlay = $('word-edit-overlay');
    const title   = $('word-edit-title');
    if (!overlay) return;

    $('we-word-id').value    = wordData?.word_id || '';
    $('we-word').value       = wordData?.word       || '';
    $('we-meaning-mr').value = wordData?.meaning_mr || '';
    $('we-meaning-en').value = wordData?.meaning_en || '';
    $('we-phonics').value    = wordData?.phonics     || '';
    $('we-image-url').value  = wordData?.image_url   || '';
    $('we-emoji').value      = wordData?.emoji        || '';
    $('we-emoji-preview').textContent = wordData?.emoji || '';
    $('we-difficulty').value = wordData?.difficulty  || 'medium';
    _weSetVisualType(wordData?.visual_type || 'word');

    // Image preview for existing image_url
    const imgUrl = wordData?.image_url || '';
    const imgPreviewWrap = $('we-image-preview-wrap');
    const imgPreviewEl   = $('we-image-preview-img');
    const uploadStatus   = $('we-upload-status');
    if (imgUrl && imgPreviewWrap && imgPreviewEl) {
      imgPreviewEl.src = imgUrl;
      imgPreviewWrap.style.display = '';
    } else if (imgPreviewWrap) {
      imgPreviewWrap.style.display = 'none';
    }
    if (uploadStatus) uploadStatus.textContent = '';

    // Clear previous emoji suggestions
    const sugBox = $('we-emoji-suggestions');
    if (sugBox) { sugBox.innerHTML = ''; sugBox.style.display = 'none'; }

    // Populate batch options then subject options
    const weBatch = $('we-batch');
    if (weBatch) {
      const filterBatch = $('words-filter-batch');
      if (filterBatch) weBatch.innerHTML = filterBatch.innerHTML;
      if (wordData?.batch) weBatch.value = wordData.batch;

      const batch = weBatch.value;
      const subjects = batch ? (await DB.getSubjectsByBatch(batch).catch(() => [])).map(s => s.name) : [];
      _setSelectOptions($('we-subject'), subjects, 'Select Subject');
      if (wordData?.subject) $('we-subject').value = wordData.subject;
    }

    if (title) title.textContent = wordData?.word_id ? 'Edit Word' : 'Add Word';
    $('we-error').classList.add('hidden');
    $('we-autofill-status').classList.add('hidden');
    overlay.classList.remove('hidden');
    $('we-word').focus();
  }

  async function _weAutoFill() {
    const word = ($('we-word')?.value || '').trim();
    if (!word) return APP.toast('Enter a word first', 'error');
    const status = $('we-autofill-status');
    if (status) { status.textContent = 'Fetching...'; status.classList.remove('hidden'); }
    try {
      const res = await API.autoFillWord(word);
      const d = res.data || {};
      if (d.meaning_mr && !$('we-meaning-mr')?.value) $('we-meaning-mr').value = d.meaning_mr;
      if (d.meaning_en && !$('we-meaning-en')?.value) $('we-meaning-en').value = d.meaning_en;
      if (d.phonics    && !$('we-phonics')?.value)    $('we-phonics').value    = d.phonics;
      if (status) status.textContent = 'Auto-fill complete';
    } catch (err) {
      if (status) status.textContent = 'Auto-fill failed: ' + err.message;
    }
  }

  async function _weSubmit(e) {
    e.preventDefault();
    const wordId  = $('we-word-id')?.value || '';
    const errEl   = $('we-error');

    const data = {
      word:         ($('we-word')?.value       || '').trim(),
      batch:        ($('we-batch')?.value      || '').trim(),
      subject:      ($('we-subject')?.value    || '').trim(),
      meaning_mr:   ($('we-meaning-mr')?.value || '').trim(),
      meaning_en:   ($('we-meaning-en')?.value || '').trim(),
      phonics:      ($('we-phonics')?.value    || '').trim(),
      image_url:    ($('we-image-url')?.value  || '').trim(),
      emoji:        ($('we-emoji')?.value      || '').trim(),
      visual_type:  _weGetVisualType(),
      difficulty:   $('we-difficulty')?.value  || 'medium',
    };

    if (!data.word)    { if (errEl) { errEl.textContent = 'Word is required'; errEl.classList.remove('hidden'); } return; }
    if (!data.batch)   { if (errEl) { errEl.textContent = 'Batch is required'; errEl.classList.remove('hidden'); } return; }
    if (!data.subject) { if (errEl) { errEl.textContent = 'Subject is required'; errEl.classList.remove('hidden'); } return; }

    const btn = $('btn-we-save');
    if (btn) btn.disabled = true;
    try {
      if (wordId) {
        await API.updateAdminWord(wordId, data);
        APP.toast('Word updated', 'success');
      } else {
        await API.createAdminWord(data);
        APP.toast('Word added', 'success');
      }
      $('word-edit-overlay').classList.add('hidden');
      _wordsSkip = 0;
      _loadWordBank();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function _bulkAutoFill() {
    const batch   = $('word-bulk-batch')?.value?.trim();
    const subject = $('word-bulk-subject')?.value?.trim();
    if (!batch || !subject) return APP.toast('Select batch and subject first', 'error');

    const raw  = $('bulk-words-textarea')?.value || '';

    // Parse: comma-separated on one line → split into multiple words
    //        pipe-separated → word | meaning_mr | phonics
    //        plain line     → single word
    const entries = [];
    for (const line of raw.split('\n').map(l => l.trim()).filter(Boolean)) {
      if (line.includes('|')) {
        entries.push(line); // pipe format — keep as-is
      } else {
        // comma-separated or single word
        for (const w of line.split(',').map(w => w.trim()).filter(Boolean)) {
          entries.push(w);
        }
      }
    }
    if (!entries.length) return APP.toast('Paste some words first', 'error');

    const progress = $('bulk-progress-wrap');
    const bar      = $('bulk-progress-bar');
    const txt      = $('bulk-progress-text');
    const btn      = $('btn-bulk-autofill');
    const previewWrap = $('bulk-preview-wrap');
    const previewBody = $('bulk-preview-body');

    if (progress) progress.classList.remove('hidden');
    if (btn) btn.disabled = true;
    _bulkPreviewData = [];
    if (previewBody) previewBody.innerHTML = '';

    for (let i = 0; i < entries.length; i++) {
      const parts = entries[i].split('|').map(p => p.trim());
      const word  = parts[0];
      let row = {
        word,
        batch,
        subject,
        meaning_mr: parts[1] || '',
        meaning_en: '',
        phonics:    parts[2] || '',
        status: 'pending',
      };

      if (!row.meaning_mr || !row.phonics) {
        try {
          const res = await API.autoFillWord(word);
          const d = res.data || {};
          if (!row.meaning_mr) row.meaning_mr = d.meaning_mr || '';
          if (!row.meaning_en) row.meaning_en = d.meaning_en || '';
          if (!row.phonics)    row.phonics    = d.phonics    || '';
          row.status = 'ok';
        } catch {
          row.status = 'skip';
        }
      } else {
        row.status = 'ok';
      }

      _bulkPreviewData.push(row);

      const pct = Math.round(((i + 1) / entries.length) * 100);
      if (bar) bar.style.width = pct + '%';
      if (txt) txt.textContent = `${i + 1} / ${entries.length}`;

      // Render preview row
      if (previewBody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${_esc(row.word)}</td>
          <td>${_esc(row.meaning_mr)}</td>
          <td>${_esc(row.meaning_en)}</td>
          <td>${_esc(row.phonics)}</td>
          <td class="${row.status === 'ok' ? 'words-preview-ok' : 'words-preview-skip'}">${row.status}</td>`;
        previewBody.appendChild(tr);
      }

      await new Promise(r => setTimeout(r, 120)); // brief pause between API calls
    }

    if (previewWrap) previewWrap.classList.remove('hidden');
    const saveBtn = $('btn-bulk-save');
    if (saveBtn) saveBtn.disabled = false;
    if (btn) btn.disabled = false;
    APP.toast(`${_bulkPreviewData.filter(r => r.status === 'ok').length} words ready to save`, 'info');
  }

  async function _bulkSave() {
    const toSave = _bulkPreviewData.filter(r => r.status === 'ok');
    if (!toSave.length) return APP.toast('Nothing to save', 'error');
    const btn     = $('btn-bulk-save');
    if (btn) btn.disabled = true;
    const batch   = $('word-bulk-batch')?.value   || '';
    const subject = $('word-bulk-subject')?.value || '';
    try {
      await API.bulkCreateAdminWords(toSave);
      $('bulk-words-textarea').value = '';
      $('bulk-preview-wrap').classList.add('hidden');
      $('bulk-progress-wrap').classList.add('hidden');
      _bulkPreviewData = [];
      _wordsSkip = 0;

      // Sync filter bar to the saved batch+subject so test info shows
      if (batch && $('words-filter-batch')) {
        $('words-filter-batch').value = batch;
        const subjects = batch ? (await DB.getSubjectsByBatch(batch).catch(() => [])).map(s => s.name) : [];
        _setSelectOptions($('words-filter-subject'), subjects, 'All Subjects');
        if (subject) {
          const subSel = $('words-filter-subject');
          if (subSel && !subSel.querySelector(`option[value="${subject}"]`)) {
            const opt = document.createElement('option');
            opt.value = subject;
            opt.textContent = subject;
            subSel.appendChild(opt);
          }
          if (subSel) subSel.value = subject;
        }
      }

      await _loadWordBank();
      const tc = Math.ceil(_wordsTotal / 20);
      APP.toast(`${toSave.length} words saved · ${tc} test${tc !== 1 ? 's' : ''} ready for students ✓`, 'success');
    } catch (err) {
      APP.toast('Save failed: ' + err.message, 'error');
      if (btn) btn.disabled = false;
    }
  }

  async function _loadVocabSectionsCard() {
    const batch   = $('words-filter-batch')?.value  || '';
    const subject = $('words-filter-subject')?.value || '';
    const card    = $('vocab-sections-card');
    if (!card) return;
    if (!batch || !subject) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const status = $('vocab-sections-status');
    if (status) status.textContent = 'Loading…';
    try {
      const res = await API.getVocabConfig(batch, subject);
      const active = res?.data?.active_sections || ['listen','meaning','picture','spelling'];
      card.querySelectorAll('input[name="vsec"]').forEach(cb => {
        cb.checked = active.includes(cb.value);
      });
      if (status) status.textContent = '';
    } catch (e) {
      if (status) status.textContent = 'Could not load sections config.';
    }
  }

  function _initWordsTab() {
    // Filter events
    $('btn-words-search')?.addEventListener('click', () => { _wordsSkip = 0; _loadWordBank(); });
    $('words-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') { _wordsSkip = 0; _loadWordBank(); } });
    $('words-filter-batch')?.addEventListener('change', async () => {
      const batch = $('words-filter-batch')?.value || '';
      const subjects = batch ? (await DB.getSubjectsByBatch(batch).catch(() => [])).map(s => s.name) : [];
      _setSelectOptions($('words-filter-subject'), subjects, 'All Subjects');
      _wordsSkip = 0;
      _loadWordBank();
      _loadVocabSectionsCard();
    });

    // "Tests" button — scroll to / highlight the test info bar
    $('btn-words-test-info')?.addEventListener('click', () => {
      const bar = $('words-test-info-bar');
      if (bar) {
        bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        bar.style.outline = '2px solid #60a5fa';
        setTimeout(() => { bar.style.outline = ''; }, 1800);
      }
    });

    // "Re-sequence" button — renumber seq_num 1,2,3… for current batch+subject
    $('btn-resequence-words')?.addEventListener('click', async () => {
      const batch   = $('words-filter-batch')?.value  || '';
      const subject = $('words-filter-subject')?.value || '';
      if (!batch || !subject) {
        alert('Please select a Batch and Subject first.');
        return;
      }
      if (!confirm(`Re-sequence all words in "${batch} / ${subject}"?\nThis renumbers seq_num 1,2,3… in current order and fixes test boundaries.`)) return;
      try {
        const res = await API.resequenceAdminWords({ batch, subject });
        alert(`✅ Re-sequenced ${res.count} words.`);
        _loadWordBank();
      } catch (err) {
        alert('Re-sequence failed: ' + (err?.message || 'unknown error'));
      }
    });

    $('words-filter-subject')?.addEventListener('change', () => {
      _wordsSkip = 0;
      _loadWordBank();
      _loadVocabSectionsCard();
    });

    // Save sections config
    $('btn-save-sections')?.addEventListener('click', async () => {
      const batch   = $('words-filter-batch')?.value  || '';
      const subject = $('words-filter-subject')?.value || '';
      if (!batch || !subject) return;
      const active_sections = [...document.querySelectorAll('input[name="vsec"]:checked')].map(cb => cb.value);
      if (!active_sections.length) { alert('At least one section must be selected.'); return; }
      const status = $('vocab-sections-status');
      if (status) status.textContent = 'Saving…';
      try {
        await API.saveVocabConfig(batch, subject, active_sections);
        if (status) status.textContent = 'Saved!';
        setTimeout(() => { if (status) status.textContent = ''; }, 2000);
      } catch (e) {
        if (status) status.textContent = 'Save failed: ' + (e?.message || 'error');
      }
    });

    // Word list delegation (edit/delete)
    $('words-table-body')?.addEventListener('click', async e => {
      const editBtn = e.target.closest('.words-btn-edit');
      const delBtn  = e.target.closest('.words-btn-delete');
      if (editBtn) {
        const wid = editBtn.dataset.wid;
        const tbody = $('words-table-body');
        const row = tbody?.querySelector(`[data-wid="${wid}"]`)?.closest('tr');
        if (!row) return;
        const cells = row.querySelectorAll('td');
        await _openWordEditor({
          word_id:     wid,
          batch:       $('words-filter-batch')?.value   || '',
          subject:     $('words-filter-subject')?.value || '',
          word:        cells[1]?.textContent || '',
          meaning_mr:  cells[2]?.textContent || '',
          meaning_en:  cells[3]?.textContent || '',
          phonics:     cells[4]?.textContent || '',
          difficulty:  cells[5]?.querySelector('span')?.textContent?.trim() || 'medium',
          emoji:       editBtn.dataset.emoji      || '',
          image_url:   editBtn.dataset.imageUrl   || '',
          visual_type: editBtn.dataset.visualType || 'word',
        });
      }
      if (delBtn) {
        const wid  = delBtn.dataset.wid;
        const name = delBtn.dataset.wname;
        if (!confirm(`Delete word "${name}"?`)) return;
        try {
          await API.deleteAdminWord(wid);
          APP.toast('Word deleted', 'success');
          _loadWordBank();
        } catch (err) {
          APP.toast('Delete failed: ' + err.message, 'error');
        }
      }
    });

    // Add word button
    $('btn-add-word')?.addEventListener('click', () => _openWordEditor(null));

    // Test preview modal
    $('test-preview-close')?.addEventListener('click', () => $('test-preview-overlay')?.classList.add('hidden'));
    $('test-preview-overlay')?.addEventListener('click', e => {
      if (e.target === $('test-preview-overlay')) $('test-preview-overlay').classList.add('hidden');
    });

    // Word editor modal
    $('word-edit-close')?.addEventListener('click', () => $('word-edit-overlay')?.classList.add('hidden'));
    $('btn-we-cancel')?.addEventListener('click', () => $('word-edit-overlay')?.classList.add('hidden'));
    $('btn-we-autofill')?.addEventListener('click', _weAutoFill);
    $('word-edit-form')?.addEventListener('submit', _weSubmit);

    // Visual type radio → show/hide emoji & image rows
    $('we-visual-type-group')?.addEventListener('change', () => {
      _weSetVisualType(_weGetVisualType());
    });

    // Emoji input → live preview
    $('we-emoji')?.addEventListener('input', e => {
      const preview = $('we-emoji-preview');
      if (preview) preview.textContent = e.target.value.trim();
    });

    // Emoji suggest button
    $('btn-we-suggest-emoji')?.addEventListener('click', async () => {
      const word = ($('we-word')?.value || '').trim();
      if (!word) return APP.toast('Word field रिकामे आहे', 'error');
      const btn = $('btn-we-suggest-emoji');
      if (btn) btn.disabled = true;
      try {
        const res = await API.suggestEmoji(word);
        const suggestions = res.suggestions || [];
        const sugBox = $('we-emoji-suggestions');
        if (!sugBox) return;
        if (!suggestions.length) {
          sugBox.innerHTML = '<span style="font-size:0.8rem;color:var(--text2)">कोणताही emoji सापडला नाही</span>';
          sugBox.style.display = 'flex';
          return;
        }
        sugBox.innerHTML = suggestions.map(s =>
          `<button type="button" class="we-emoji-chip" data-emoji="${_esc(s.emoji)}" title="${_esc(s.annotation)}">
            ${s.emoji}<span>${_esc(s.annotation)}</span>
           </button>`
        ).join('');
        sugBox.style.display = 'flex';
        sugBox.querySelectorAll('.we-emoji-chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const emoji = chip.dataset.emoji;
            const input = $('we-emoji');
            if (input) { input.value = emoji; }
            const preview = $('we-emoji-preview');
            if (preview) preview.textContent = emoji;
            // Auto-select emoji visual type
            _weSetVisualType('emoji');
          });
        });
      } catch (err) {
        APP.toast('Emoji suggest failed: ' + err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    // Image upload button
    $('btn-we-upload-image')?.addEventListener('click', () => {
      $('we-image-file')?.click();
    });

    $('we-image-url')?.addEventListener('input', e => {
      const url = e.target.value.trim();
      const wrap = $('we-image-preview-wrap');
      const img  = $('we-image-preview-img');
      if (url && wrap && img) {
        img.src = url;
        wrap.style.display = '';
      } else if (wrap) {
        wrap.style.display = 'none';
      }
    });

    $('btn-we-remove-image')?.addEventListener('click', () => {
      const urlInput = $('we-image-url');
      const wrap = $('we-image-preview-wrap');
      if (urlInput) urlInput.value = '';
      if (wrap) wrap.style.display = 'none';
    });

    $('we-image-file')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      const status = $('we-upload-status');
      const uploadBtn = $('btn-we-upload-image');
      if (status) status.textContent = 'Compressing...';
      if (uploadBtn) uploadBtn.disabled = true;

      try {
        // Client-side compression via Canvas — target max 200KB, WebP
        const base64 = await _compressImage(file, 1200, 900, 0.80);

        if (status) status.textContent = 'Uploading...';
        const res = await API.uploadWordImage(base64);
        const url = res.url;

        const urlInput = $('we-image-url');
        if (urlInput) urlInput.value = url;

        const wrap = $('we-image-preview-wrap');
        const img  = $('we-image-preview-img');
        if (wrap && img) { img.src = url; wrap.style.display = ''; }

        if (status) status.textContent = '✓ Uploaded';
        APP.toast('Image uploaded', 'success');
      } catch (err) {
        APP.toast('Upload failed: ' + err.message, 'error');
        if (status) status.textContent = 'Upload failed';
      } finally {
        if (uploadBtn) uploadBtn.disabled = false;
      }
    });

    // we-batch → populate we-subject
    $('we-batch')?.addEventListener('change', async () => {
      const batch = $('we-batch')?.value || '';
      const subjects = batch ? (await DB.getSubjectsByBatch(batch)).map(s => s.name) : [];
      _setSelectOptions($('we-subject'), subjects, 'Select Subject');
    });

    // Bulk import
    $('btn-bulk-autofill')?.addEventListener('click', _bulkAutoFill);
    $('btn-bulk-save')?.addEventListener('click', _bulkSave);

    // word-bulk-batch → populate word-bulk-subject
    $('word-bulk-batch')?.addEventListener('change', async () => {
      const batch = $('word-bulk-batch')?.value || '';
      const subjects = batch ? (await DB.getSubjectsByBatch(batch)).map(s => s.name) : [];
      _setSelectOptions($('word-bulk-subject'), subjects, 'Select Subject');
    });
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, open, close, loadQuestionBank, loadQuizList };
})();

window.ADMIN_UTILS = { compressImage: _compressImage };
window.ADMIN = ADMIN;
