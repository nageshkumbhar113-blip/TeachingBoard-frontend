/* global API, DB, APP, MATH */
'use strict';

const EXERCISE_MANAGER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const _richText = s => _esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const _norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  // ════════════════════════════════════════════════════════════════════════════
  // STATE — fully independent of Concept/Notes. Grouping key is
  // chapterId + exerciseNo (textbook-style "1.1", "1.2"), not conceptId.
  // ════════════════════════════════════════════════════════════════════════════

  let _batch = '';
  let _subject = '';
  let _chapter = '';
  let _chapterId = '';
  let _exerciseNos = [];   // distinct exercise numbers seen for this chapter
  let _activeExerciseNo = '';
  let _exerciseQuestions = [];
  let _initialized = false;

  // Same deterministic chapterId builder used across conceptManager.js /
  // paperBuilder.js — must match exactly.
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
    $('em-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    $('em-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('em-chapter-sel')?.addEventListener('change', e => _onChapterChange(e.target.value));
    $('em-add-exno-btn')?.addEventListener('click', () => _promptNewExerciseNo());
    $('em-autofill-btn')?.addEventListener('click', () => _runAutoFill());
    $('em-manual-btn')?.addEventListener('click', () => _showManualForm());
    $('em-copy-format-btn')?.addEventListener('click', () => _copyFormat());
    $('em-preview-btn')?.addEventListener('click', () => _previewExercise());
    $('em-publish-btn')?.addEventListener('click', () => _publishExercise());
    $('em-pdf-btn')?.addEventListener('click', () => _exportPdf(false));
    $('em-pdf-answers-btn')?.addEventListener('click', () => _exportPdf(true));
    $('em-preview-close')?.addEventListener('click', () => $('em-preview-overlay')?.classList.add('hidden'));
    $('em-preview-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'em-preview-overlay') $('em-preview-overlay').classList.add('hidden');
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DROPDOWNS
  // ════════════════════════════════════════════════════════════════════════════

  async function _populateBatches() {
    const sel = $('em-batch-sel');
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
    _subject = ''; _chapter = ''; _chapterId = '';
    _resetBelowChapter();

    const subjectSel = $('em-subject-sel');
    subjectSel.innerHTML = '<option value="">Select Subject</option>';
    subjectSel.disabled = true;
    $('em-chapter-sel').innerHTML = '<option value="">Select Chapter</option>';
    $('em-chapter-sel').disabled = true;

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
    _resetBelowChapter();

    const chapterSel = $('em-chapter-sel');
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

  async function _onChapterChange(chapterId) {
    _chapterId = chapterId;
    const sel = $('em-chapter-sel');
    _chapter = sel.options[sel.selectedIndex]?.dataset.name || '';
    _resetBelowChapter();

    const hasChapter = !!chapterId;
    $('em-exno-section').style.display = hasChapter ? '' : 'none';
    if (hasChapter) await _loadExerciseNos();
  }

  function _resetBelowChapter() {
    _exerciseNos = [];
    _activeExerciseNo = '';
    _exerciseQuestions = [];
    $('em-exno-section').style.display = 'none';
    $('em-work-section').style.display = 'none';
    $('em-exercise-manual-form').innerHTML = '';
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXERCISE NO. (chips: existing numbers for this chapter + add new)
  // ════════════════════════════════════════════════════════════════════════════

  async function _loadExerciseNos() {
    try {
      // status:'' = no filter, admin sees draft + published.
      const all = await API.fetchAdminSlsQuestions({ chapterId: _chapterId, status: '', limit: 500 });
      const seen = new Map(); // exerciseNo -> count
      all.forEach(q => {
        const no = q.exerciseNo || '(No.शिवाय)';
        seen.set(no, (seen.get(no) || 0) + 1);
      });
      _exerciseNos = Array.from(seen.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      _renderExerciseNoChips();
    } catch (err) {
      console.error('Failed to load exercise numbers:', err);
    }
  }

  function _renderExerciseNoChips() {
    const row = $('em-exno-chips');
    if (!row) return;
    row.innerHTML = _exerciseNos.map(no => `
      <button type="button" class="em-exno-chip ${no === _activeExerciseNo ? 'active' : ''}" data-no="${_esc(no)}">
        Exercise ${_esc(no)}
      </button>
    `).join('');
    row.querySelectorAll('.em-exno-chip').forEach(btn =>
      btn.addEventListener('click', () => _selectExerciseNo(btn.dataset.no)));
  }

  async function _promptNewExerciseNo() {
    const no = await APP.promptAsync('नवीन Exercise No. टाका (उदा. 1.1, 1.2):');
    const trimmed = String(no || '').trim();
    if (!trimmed) return;
    if (!_exerciseNos.includes(trimmed)) {
      _exerciseNos.push(trimmed);
      _exerciseNos.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
    _selectExerciseNo(trimmed);
  }

  function _selectExerciseNo(no) {
    _activeExerciseNo = no;
    _renderExerciseNoChips();
    $('em-work-section').style.display = '';
    $('em-work-title').textContent = `Exercise ${no} चे प्रश्न`;
    _loadExerciseQuestions();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXERCISE QUESTIONS — scoped by chapterId + exerciseNo
  // ════════════════════════════════════════════════════════════════════════════

  // Splits pasted text into "Q<n>. ... Ans: ... Marks: <n>" blocks. Not a
  // general parser — matches the exact template shown in the textarea
  // placeholder. Supports $...$ / $$...$$ math (rendered via MATH below).
  function _parseExerciseText(raw) {
    const text = String(raw || '').replace(/\r\n/g, '\n');
    const blocks = text.split(/(?=^\s*Q(?:uestion)?\s*\d+\s*[.):])/im).map(b => b.trim()).filter(Boolean);
    const parsed = [];
    for (const block of blocks) {
      const qMatch = block.match(/^Q(?:uestion)?\s*\d+\s*[.):]\s*([\s\S]*?)(?=\n\s*(?:Ans(?:wer)?)\s*[:.]|$)/i);
      const aMatch = block.match(/(?:Ans(?:wer)?)\s*[:.]\s*([\s\S]*?)(?=\n\s*Marks?\s*[:.]|$)/i);
      const mMatch = block.match(/Marks?\s*[:.]\s*(\d)/i);
      const question = qMatch ? qMatch[1].trim() : '';
      const answer   = aMatch ? aMatch[1].trim() : '';
      const marks    = mMatch ? Math.min(5, Math.max(1, parseInt(mMatch[1], 10))) : 1;
      if (question && answer) parsed.push({ question, answer, marks });
    }
    return parsed;
  }

  async function _loadExerciseQuestions() {
    if (!_chapterId || !_activeExerciseNo) { _exerciseQuestions = []; _renderExerciseList(); return; }
    try {
      _exerciseQuestions = await API.fetchAdminSlsQuestions({ chapterId: _chapterId, exerciseNo: _activeExerciseNo, status: '' });
    } catch (err) {
      console.warn('load exercise questions failed', err);
      _exerciseQuestions = [];
    }
    _renderExerciseList();
  }

  function _renderExerciseList() {
    const list = $('em-exercise-list');
    if (!list) return;
    if (!_exerciseQuestions.length) {
      list.innerHTML = '<p class="empty-hint">अजून या Exercise No. साठी प्रश्न नाहीत.</p>';
      return;
    }
    list.innerHTML = _exerciseQuestions.map((q, i) => `
      <div class="cm-qitem" data-id="${_esc(q._id)}">
        <div class="cm-qitem-top">
          <b>प्रश्न ${i + 1}</b>
          <span class="em-status-chip ${q.status === 'published' ? 'published' : 'draft'}">${q.status === 'published' ? '✅ Published' : '📝 Draft'}</span>
          <!-- Inline marks edit — right where marks are shown, no need to
               open the full Edit form just to bump 1→2 marks. -->
          <select class="cm-marks-chip em-marks-select" data-id="${_esc(q._id)}">
            ${[1,2,3,4,5].map(m => `<option value="${m}" ${q.marks === m ? 'selected' : ''}>${m} ${m === 1 ? 'mark' : 'marks'}</option>`).join('')}
          </select>
        </div>
        <div class="cm-qtext">${_richText(q.questionText?.marathi || q.questionText?.english || '')}</div>
        <div class="cm-atext">${_richText(q.answerText?.marathi || q.answerText?.english || '')}</div>
        <div class="cm-qactions">
          <button type="button" class="btn btn-small em-edit-btn" data-id="${_esc(q._id)}">✏️ Edit</button>
          <button type="button" class="btn btn-small em-delete-btn" data-id="${_esc(q._id)}">🗑 Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.em-edit-btn').forEach(btn =>
      btn.addEventListener('click', () => _showManualForm(btn.dataset.id)));
    list.querySelectorAll('.em-delete-btn').forEach(btn =>
      btn.addEventListener('click', () => _deleteQuestion(btn.dataset.id)));
    list.querySelectorAll('.em-marks-select').forEach(sel =>
      sel.addEventListener('change', () => _updateMarksInline(sel.dataset.id, parseInt(sel.value, 10))));
    // Math ($...$ / $$...$$) — same convention as the rest of the app.
    MATH?.renderElement(list);
  }

  async function _updateMarksInline(id, marks) {
    try {
      await API.updateAdminSlsQuestion(id, { marks });
      const q = _exerciseQuestions.find(item => item._id === id);
      if (q) q.marks = marks;
      APP.toast('✅ Marks updated', 'success');
    } catch (err) {
      APP.toast(err?.message || 'Marks update अयशस्वी', 'error');
      await _loadExerciseQuestions(); // revert the select to the real saved value
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PREVIEW & PUBLISH — whole active Exercise No. at once
  // ════════════════════════════════════════════════════════════════════════════

  function _previewExercise() {
    const body = $('em-preview-body');
    const title = $('em-preview-title');
    if (!body) return;
    title.textContent = `Exercise ${_activeExerciseNo} — Preview (${_exerciseQuestions.length} प्रश्न)`;

    if (!_exerciseQuestions.length) {
      body.innerHTML = '<p class="empty-hint">अजून या Exercise No. साठी प्रश्न नाहीत.</p>';
    } else {
      body.innerHTML = _exerciseQuestions.map((q, i) => `
        <div class="cm-qitem" style="margin-bottom:12px">
          <div class="cm-qitem-top">
            <b>प्रश्न ${i + 1}</b>
            <span class="em-status-chip ${q.status === 'published' ? 'published' : 'draft'}">${q.status === 'published' ? '✅ Published' : '📝 Draft'}</span>
            <span class="cm-marks-chip">${q.marks} ${q.marks === 1 ? 'mark' : 'marks'}</span>
          </div>
          <div class="cm-qtext">${_richText(q.questionText?.marathi || q.questionText?.english || '')}</div>
          <div class="cm-atext">${_richText(q.answerText?.marathi || q.answerText?.english || '')}</div>
        </div>
      `).join('');
    }
    $('em-preview-overlay')?.classList.remove('hidden');
    MATH?.renderElement(body);
  }

  async function _exportPdf(withAnswers) {
    if (!_exerciseQuestions.length) {
      APP.toast('या Exercise मध्ये अजून प्रश्न नाहीत', 'error');
      return;
    }
    try {
      await EXERCISE_PDF.exportExercisePdf({
        batch: _batch,
        subject: _subject,
        chapter: _chapter,
        exerciseNo: _activeExerciseNo,
        questions: _exerciseQuestions,
      }, { withAnswers });
    } catch (err) {
      APP.toast(err?.message || 'PDF export अयशस्वी', 'error');
    }
  }

  async function _publishExercise() {
    const drafts = _exerciseQuestions.filter(q => q.status !== 'published');
    if (!drafts.length) {
      APP.toast('सगळे प्रश्न आधीच Published आहेत', 'info');
      return;
    }
    if (!await APP.confirmAsync(`${drafts.length} प्रश्न Publish करायचे? Publish केल्यावर ते students/teachers ला दिसू लागतील.`)) return;

    let published = 0, failed = 0;
    for (const q of drafts) {
      try {
        await API.publishAdminSlsQuestion(q._id);
        published++;
      } catch (err) {
        console.warn('publish failed for', q._id, err);
        failed++;
      }
    }
    await _loadExerciseQuestions();
    if (failed) {
      APP.toast(`${published} प्रश्न published, ${failed} अयशस्वी`, 'error');
    } else {
      APP.toast(`🚀 ${published} प्रश्न published — आता students/teachers ला दिसतील`, 'success');
    }
  }

  async function _runAutoFill() {
    if (!_chapterId || !_activeExerciseNo) {
      APP.toast('आधी Exercise No. निवडा', 'error');
      return;
    }
    const input = $('em-autofill-input');
    if (!input || !input.value.trim()) {
      APP.toast('आधी मजकूर paste करा', 'error');
      return;
    }
    const parsed = _parseExerciseText(input.value);
    if (!parsed.length) {
      APP.toast('कुठलाही प्रश्न ओळखता आला नाही — format तपासा', 'error');
      return;
    }

    const existingNorm = new Set(_exerciseQuestions.map(q => _norm(q.questionText?.marathi || q.questionText?.english)));
    let created = 0, skipped = 0;
    for (const item of parsed) {
      if (existingNorm.has(_norm(item.question))) { skipped++; continue; }
      try {
        await API.createAdminSlsQuestion({
          exerciseNo: _activeExerciseNo,
          chapterId: _chapterId,
          subjectId: _subject,
          batchId: _batch,
          questionText: { english: item.question, marathi: item.question },
          answerText: { english: item.answer, marathi: item.answer },
          marks: item.marks,
          questionType: 'short_answer',
          difficulty: 'medium',
          status: 'published',
        });
        existingNorm.add(_norm(item.question));
        created++;
      } catch (err) {
        console.warn('create exercise question failed', err);
      }
    }

    input.value = '';
    await _loadExerciseQuestions();
    if (skipped) {
      APP.toast(`${created} प्रश्न जोडले, ${skipped} आधीच होते (duplicate वगळले)`, 'info');
    } else {
      APP.toast(`✅ ${created} प्रश्न जोडले`, 'success');
    }
  }

  function _showManualForm(editId = null) {
    const existing = editId ? _exerciseQuestions.find(q => q._id === editId) : null;
    const host = $('em-exercise-manual-form');
    if (!host) return;
    host.innerHTML = `
      <div class="cm-qitem" style="margin-top:10px">
        <label class="form-label">Question ($...$ math OK)</label>
        <textarea id="em-ex-question" class="form-input" rows="2">${_esc(existing?.questionText?.marathi || existing?.questionText?.english || '')}</textarea>
        <label class="form-label">Answer</label>
        <textarea id="em-ex-answer" class="form-input" rows="2">${_esc(existing?.answerText?.marathi || existing?.answerText?.english || '')}</textarea>
        <label class="form-label">Marks</label>
        <select id="em-ex-marks" class="form-input">
          ${[1,2,3,4,5].map(m => `<option value="${m}" ${existing?.marks === m ? 'selected' : ''}>${m} ${m === 1 ? 'Mark' : 'Marks'}</option>`).join('')}
        </select>
        <div class="cm-qactions" style="margin-top:8px">
          <button type="button" id="em-ex-save-btn" class="btn btn-small btn-primary">💾 Save</button>
          <button type="button" id="em-ex-cancel-btn" class="btn btn-small">Cancel</button>
        </div>
      </div>
    `;
    $('em-ex-save-btn')?.addEventListener('click', () => _saveManual(editId));
    $('em-ex-cancel-btn')?.addEventListener('click', () => { host.innerHTML = ''; });
  }

  async function _saveManual(editId) {
    const question = $('em-ex-question')?.value.trim() || '';
    const answer   = $('em-ex-answer')?.value.trim() || '';
    const marks    = parseInt($('em-ex-marks')?.value, 10) || 1;
    if (!question || !answer) {
      APP.toast('Question आणि Answer दोन्ही लागतील', 'error');
      return;
    }

    if (!editId) {
      const existingNorm = new Set(_exerciseQuestions.map(q => _norm(q.questionText?.marathi || q.questionText?.english)));
      if (existingNorm.has(_norm(question))) {
        APP.toast('हा प्रश्न आधीच जोडलेला आहे', 'info');
        return;
      }
    }

    try {
      const payload = {
        questionText: { english: question, marathi: question },
        answerText: { english: answer, marathi: answer },
        marks,
      };
      if (editId) {
        await API.updateAdminSlsQuestion(editId, payload);
      } else {
        await API.createAdminSlsQuestion({
          ...payload,
          exerciseNo: _activeExerciseNo,
          chapterId: _chapterId,
          subjectId: _subject,
          batchId: _batch,
          questionType: 'short_answer',
          difficulty: 'medium',
          status: 'published',
        });
      }
      $('em-exercise-manual-form').innerHTML = '';
      await _loadExerciseQuestions();
      APP.toast('✅ Saved', 'success');
    } catch (err) {
      APP.toast(err?.message || 'Save अयशस्वी', 'error');
    }
  }

  async function _deleteQuestion(id) {
    if (!await APP.confirmAsync('हा Exercise प्रश्न delete करायचा?')) return;
    try {
      await API.deleteAdminSlsQuestion(id);
      await _loadExerciseQuestions();
      APP.toast('Deleted', 'success');
    } catch (err) {
      APP.toast(err?.message || 'Delete अयशस्वी', 'error');
    }
  }

  const EXERCISE_FORMAT_PROMPT = `Ya chapter वरून सराव प्रश्न (Exercise) तयार कर, Marathi मध्ये, exact ह्याच format मध्ये — एकही ओळ इकडे-तिकडे न करता, प्रत्येक प्रश्नानंतर एक रिकामी ओळ सोड. गणितीय सूत्र/चिन्हं असतील तर $...$ (एका ओळीत) किंवा $$...$$ (स्वतंत्र ओळीत) असं LaTeX मध्ये लिही:

Q1. [प्रश्न]
Ans: [उत्तर]
Marks: [1 ते 5 मधला आकडा]

Q2. [प्रश्न]
Ans: [उत्तर]
Marks: [1 ते 5 मधला आकडा]

...अशा पद्धतीने १ mark, २ marks, ३ marks, ४ marks, ५ marks — प्रत्येक प्रकारचे किमान १-२ प्रश्न बनव, वेगवेगळ्या अडचण पातळीचे (सोपे/मध्यम/कठीण मिसळून). खालील विषयाचा मजकूर आधार म्हणून वापर:

[इथे chapter चा मजकूर paste करा]`;

  function _copyFormat() {
    navigator.clipboard?.writeText(EXERCISE_FORMAT_PROMPT)
      .then(() => APP.toast('Prompt copy झाला — ChatGPT/Claude ला paste करा', 'success'))
      .catch(() => APP.toast('Copy करता आलं नाही', 'error'));
  }

  // Test-only hook — injects state directly and exposes the render/preview/
  // publish internals so they can be exercised without a full DB-backed
  // batch→subject→chapter→exerciseNo click-through. Not used by any
  // production code path.
  function _setTestState(exerciseNo, questions, meta = {}) {
    _activeExerciseNo = exerciseNo;
    _exerciseQuestions = questions;
    if (meta.batch   !== undefined) _batch   = meta.batch;
    if (meta.subject !== undefined) _subject = meta.subject;
    if (meta.chapter !== undefined) _chapter = meta.chapter;
    _renderExerciseList();
  }

  return {
    init,
    __test: {
      setState: _setTestState,
      renderList: _renderExerciseList,
      preview: _previewExercise,
      publish: _publishExercise,
      exportPdf: _exportPdf,
      updateMarks: _updateMarksInline,
      getQuestions: () => _exerciseQuestions,
    },
  };
})();

window.EXERCISE_MANAGER = EXERCISE_MANAGER;
