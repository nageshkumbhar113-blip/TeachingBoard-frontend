/* ════════════════════════════════════════
   teacherPaperBuilder.js — Teacher Dashboard, Paper Builder tab
   Cut-down version of admin-app/paperBuilder.js: teachers can only
   build/save papers from the existing (admin-curated) question bank —
   no question create/edit/delete here.
   Global: TEACHER_PAPER_BUILDER
════════════════════════════════════════ */

const TEACHER_PAPER_BUILDER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let _batch = '';
  let _subject = '';
  let _chapter = '';
  let _chapterId = '';
  let _initialized = false;
  let _selectedQuestions = [];
  let _searchDebounce = null;

  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
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
    $('tpb-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('tpb-chapter-sel')?.addEventListener('change', e => _onChapterChange(e.target.value));

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
    _subject = ''; _chapter = ''; _chapterId = '';
    _resetPaperState();

    const subjectSel = $('tpb-subject-sel');
    subjectSel.innerHTML = '<option value="">Select Subject</option>';
    subjectSel.disabled = true;
    $('tpb-chapter-sel').innerHTML = '<option value="">Select Chapter</option>';
    $('tpb-chapter-sel').disabled = true;

    if (!batch) return;
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        subjectSel.appendChild(opt);
      });
      subjectSel.disabled = false;
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  }

  async function _onSubjectChange(subject) {
    _subject = subject;
    _chapter = ''; _chapterId = '';
    _resetPaperState();

    const chapterSel = $('tpb-chapter-sel');
    chapterSel.innerHTML = '<option value="">Select Chapter</option>';
    chapterSel.disabled = true;

    if (!_batch || !subject) return;
    try {
      const chapters = await DB.getChaptersByBatchSubject(_batch, subject);
      chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = _makeChapterId(_batch, subject, ch.name);
        opt.textContent = ch.name;
        opt.dataset.name = ch.name;
        chapterSel.appendChild(opt);
      });
      chapterSel.disabled = false;
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  }

  function _onChapterChange(chapterId) {
    _chapterId = chapterId;
    const sel = $('tpb-chapter-sel');
    _chapter = sel.options[sel.selectedIndex]?.dataset.name || '';
    _resetPaperState();

    const hasChapter = !!chapterId;
    $('tpb-marks-section').style.display = hasChapter ? '' : 'none';
    $('tpb-selected-section').style.display = hasChapter ? '' : 'none';
  }

  function _resetPaperState() {
    _selectedQuestions = [];
    $('tpb-mark-picker')?.classList.add('hidden');
    _renderSelectedList();
  }

  async function _openMarkPicker(marks) {
    if (!_chapterId) return;
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
        chapterId: _chapterId, marks, status: 'published', q, sort: 'usageCount', limit: 50
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
          <div class="tpb-picker-meta">वापर: ${qq.usageCount || 0}x</div>
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
    _selectedQuestions.push({ _id: qq._id, marks: qq.marks, questionText: qq.questionText });
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
        <span class="tpb-selected-text">${i + 1}. ${_esc(text)}</span>
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
            chapterId: _chapterId, marks: m, status: 'published', sort: 'usageCount', limit: 20
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
    if (!_batch || !_subject || !_chapterId) {
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
      const paper = await API.createTeacherSlsPaperManual({
        batchId: _batch,
        chapterId: _chapterId,
        subjectId: _subject,
        paperTitle: title || undefined,
        questions: _selectedQuestions.map(q => ({ questionId: q._id, marks: q.marks }))
      });
      APP?.toast?.(`✅ Paper "${paper.paperTitle}" saved (Paper #${paper.paperNumber})`, 'success');
      _resetPaperState();
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

  return { init };
})();

window.TEACHER_PAPER_BUILDER = TEACHER_PAPER_BUILDER;
