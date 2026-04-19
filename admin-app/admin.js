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

  let _unlocked    = false;
  let _editingQId  = null;
  let _questionBankLimit = 150;
  let _questionSearchTimer = null;

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
        _showPinError(err?.message?.includes('Invalid') ? 'Wrong PIN' : 'Server unreachable — try offline mode');
        return;
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
    _questionBankLimit = QUESTION_BANK_PAGE_SIZE;
    await Promise.all([
      _loadBatchOptions(),
      loadQuestionBank({ resetLimit: true }),
      _loadLessonAdmin(),
      _loadBatchAdmin(),
      _loadSettings(),
      loadQuizList(),
    ]);
    APP.renderDashboardStats?.();
  }

  // ════════════════════════
  // TABS
  // ════════════════════════

  function _initTabs() {
    document.querySelectorAll('.atab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.atab-content').forEach(t => t.classList.add('hidden'));
        tab.classList.add('active');
        const content = $('atab-' + tab.dataset.tab);
        if (content) content.classList.remove('hidden');
      });
    });
  }

  // ════════════════════════
  // BATCH OPTIONS (selects)
  // ════════════════════════

  async function _loadBatchOptions() {
    const batches = await DB.getAllBatches();
    const selects = [
      $('admin-batch-filter'), $('import-batch'), $('qe-batch'),
    ];
    selects.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">All Classes</option>';
      batches.forEach(b => {
        const o = document.createElement('option');
        o.value = b.name;
        o.textContent = `${b.icon || ''} ${b.name}`;
        sel.appendChild(o);
      });
    });
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
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionValue;
      select.appendChild(option);
    });

    select.value = options.includes(currentValue) ? currentValue : '';
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
          <div class="qb-text">${_escHtml(q.question)}</div>
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
        if (!confirm(`Delete: "${q.question.slice(0, 60)}…"?`)) return;
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
  }

  // ════════════════════════
  // QUESTION EDITOR
  // ════════════════════════

  function _openQEditor(q = null) {
    _editingQId = q?.q_id || null;
    _setText('qedit-title', q ? 'Edit Question' : 'Add Question');
    $('btn-qe-delete')?.classList.toggle('hidden', !q);

    if (q) {
      _setValue('qe-batch', q.batch || '');
      _setValue('qe-subject', q.subject || '');
      _setValue('qe-chapter', q.chapter || '');
      _setValue('qe-type', q.type || 'mcq');
      _setValue('qe-difficulty', q.difficulty || 'medium');
      _setValue('qe-question', q.question || '');
      _setValue('qe-a', q.options?.A || '');
      _setValue('qe-b', q.options?.B || '');
      _setValue('qe-c', q.options?.C || '');
      _setValue('qe-d', q.options?.D || '');
      _setValue('qe-answer', q.type === 'mcq' ? (q.answer || 'A') : 'A');
      _setValue('qe-fib-answer', q.type === 'fib' ? (q.answer || '') : '');
      if ($('qe-tf-answer')) _setValue('qe-tf-answer', q.type === 'tf' ? (q.answer || 'True') : 'True');
      _setValue('qe-tags', (q.tags || []).join(', '));
    } else {
      $('qedit-overlay')?.querySelectorAll('input,textarea,select').forEach(el => {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
      });
    }

    _updateQETypeView();
    $('qedit-overlay')?.classList.remove('hidden');
    $('qe-question')?.focus();
  }

  function _updateQETypeView() {
    const type = $('qe-type').value;
    $('qe-mcq-opts')?.classList.toggle('hidden', type !== 'mcq');
    $('qe-fib-opts')?.classList.toggle('hidden', type !== 'fib');
    $('qe-tf-opts')?.classList.toggle('hidden', type !== 'tf');
  }

  function _validateQ(type, q) {
    if (!q.batch)    return 'Select a class / batch';
    if (!q.subject)  return 'Subject is required';
    if (!q.chapter)  return 'Chapter is required';
    if (!q.question) return 'Question text is required';

    if (type === 'mcq') {
      const a = $('qe-a').value.trim(), b = $('qe-b').value.trim();
      const c = $('qe-c').value.trim(), d = $('qe-d').value.trim();
      if (!a || !b || !c || !d) return 'All four MCQ options (A–D) are required';
    }

    if (type === 'fib' && !$('qe-fib-answer').value.trim()) {
      return 'Correct answer is required for Fill-in-the-Blank';
    }

    return null; // valid
  }

  async function _saveQEditor() {
    const type = $('qe-type').value;
    const q = {
      q_id      : _editingQId || undefined,
      batch     : $('qe-batch').value,
      subject   : $('qe-subject').value.trim(),
      chapter   : $('qe-chapter').value.trim(),
      type,
      difficulty: $('qe-difficulty').value,
      question  : $('qe-question').value.trim(),
      tags      : $('qe-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    };

    const validationError = _validateQ(type, q);
    if (validationError) { APP.toast(validationError, 'error'); return; }

    if (type === 'mcq') {
      q.options = {
        A: $('qe-a').value.trim(),
        B: $('qe-b').value.trim(),
        C: $('qe-c').value.trim(),
        D: $('qe-d').value.trim(),
      };
      q.answer = $('qe-answer').value;
    } else if (type === 'fib') {
      q.answer = $('qe-fib-answer').value.trim();
    } else if (type === 'tf') {
      q.answer  = $('qe-tf-answer')?.value || 'True';
      q.options = { A: 'True', B: 'False' };
    }

    // Image upload
    const imgFile = $('qe-image')?.files?.[0];
    if (imgFile) {
      await DB.saveImage(imgFile.name, imgFile);
      q.image = imgFile.name;
    }

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
      const bid = res?.data?.id || saved.backend_id;
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
            <div class="lesson-admin-title">${lesson.title || 'Untitled'}</div>
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
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ════════════════════════
  // CSV IMPORT
  // ════════════════════════

  async function _importCSV() {
    const file    = $('csv-file-input').files[0];
    if (!file) { APP.toast('Select a CSV file first', 'error'); return; }

    const batch   = $('import-batch').value;
    const subject = $('import-subject').value.trim();
    const chapter = $('import-chapter').value.trim();
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
    await loadQuestionBank({ resetLimit: true });
    APP.refreshHome();
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
        await _loadBatchAdmin();
        await _loadBatchOptions();
        APP.refreshHome();
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
    await _loadBatchAdmin();
    await _loadBatchOptions();
    APP.refreshHome();
    APP.toast(`✅ Class "${name}" added`, 'success');
  }

  // ════════════════════════
  // TEST PORTAL — QUIZ LIST
  // ════════════════════════

  async function loadQuizList() {
    const all      = await DB.getAllQuizzes();
    const drafts   = all.filter(q => q.status === 'draft');
    const published = all.filter(q => q.status === 'published');

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

    // Question editor
    $('btn-add-question')?.addEventListener('click', () => _openQEditor());
    $('qedit-close')?.addEventListener('click', () => $('qedit-overlay')?.classList.add('hidden'));
    $('btn-qe-save')?.addEventListener('click', _saveQEditor);
    $('btn-qe-delete')?.addEventListener('click', _deleteCurrentQ);
    $('qe-type')?.addEventListener('change', _updateQETypeView);

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

    // Batch
    $('btn-add-batch')?.addEventListener('click', _addBatch);

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
  // PUBLIC API
  // ════════════════════════

  return { init, open, close, loadQuestionBank, loadQuizList };
})();

window.ADMIN = ADMIN;
