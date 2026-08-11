/* ════════════════════════════════════════
   exerciseViewer.js — Student Exercise tab
   Independent of Notes/Concepts — own bottom-nav entry.
   Global: EXERCISE_VIEWER
════════════════════════════════════════ */

const EXERCISE_VIEWER = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let _batch = '';
  let _subject = '';
  let _chapter = '';
  let _chapterId = '';
  let _exerciseGroups = new Map(); // exerciseNo -> questions[]
  let _activeExerciseNo = '';
  let _initialized = false;

  function _makeChapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    $('ev-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    $('ev-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('ev-chapter-sel')?.addEventListener('change', e => _onChapterChange(e.target.value));
    $('ev-back-btn')?.addEventListener('click', () => _showGroupList());
    $('bnav-exercise')?.addEventListener('click', () => {
      // NOTE: APP is a top-level `const` in app.js, not `window.APP` — using
      // the bare identifier here (same convention as vocabPlayer.js etc).
      APP?.navigate?.('exercise');
      _populateBatches();
    });
  }

  async function _populateBatches() {
    const sel = $('ev-batch-sel');
    if (!sel) return;
    try {
      const allowed = await DB.getSetting('student_allowed_batches', []).catch(() => []);
      const batches = Array.isArray(allowed) ? [...new Set(allowed.map(b => String(b || '').trim()).filter(Boolean))] : [];
      sel.innerHTML = '<option value="">Select Batch</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        sel.appendChild(opt);
      });
      // Most students have exactly one batch — auto-select it.
      if (batches.length === 1) {
        sel.value = batches[0];
        _onBatchChange(batches[0]);
      }
    } catch (err) {
      console.error('Failed to load allowed batches:', err);
    }
  }

  async function _onBatchChange(batch) {
    _batch = batch;
    _subject = ''; _chapter = ''; _chapterId = '';
    _resetBelowChapter();

    const subjectSel = $('ev-subject-sel');
    subjectSel.innerHTML = '<option value="">Select Subject</option>';
    subjectSel.disabled = true;
    $('ev-chapter-sel').innerHTML = '<option value="">Select Chapter</option>';
    $('ev-chapter-sel').disabled = true;

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

    const chapterSel = $('ev-chapter-sel');
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
    const sel = $('ev-chapter-sel');
    _chapter = sel.options[sel.selectedIndex]?.dataset.name || '';
    _resetBelowChapter();
    if (!chapterId) return;
    await _loadExerciseGroups();
  }

  function _resetBelowChapter() {
    _exerciseGroups = new Map();
    _activeExerciseNo = '';
    $('ev-groups-section').style.display = 'none';
    $('ev-questions-section').style.display = 'none';
  }

  async function _loadExerciseGroups() {
    const section = $('ev-groups-section');
    const list = $('ev-groups-list');
    section.style.display = '';
    list.innerHTML = '<p class="empty-hint">Loading…</p>';
    try {
      const questions = await _resolveExerciseQuestions(_chapterId);
      _groupQuestions(questions);
      _renderGroupList();
    } catch (err) {
      console.error('Failed to load exercise groups:', err);
      list.innerHTML = '<p class="empty-hint">Internet नाही आणि हे Exercise offline साठी अजून download झालेले नाही. एकदा online होऊन उघडा.</p>';
    }
  }

  function _groupQuestions(questions) {
    _exerciseGroups = new Map();
    questions.forEach(q => {
      const no = q.exerciseNo || '(No.शिवाय)';
      if (!_exerciseGroups.has(no)) _exerciseGroups.set(no, []);
      _exerciseGroups.get(no).push(q);
    });
  }

  // Cache-first, background-refresh, offline-clear-error — same pattern as
  // notesViewer.js. Encrypted at rest via core/crypto.js.
  async function _resolveExerciseQuestions(chapterId) {
    const cached = await DB.getExerciseQuestionsCache(chapterId).catch(() => null);
    if (cached) {
      if (navigator.onLine) {
        API.fetchStudentExerciseQuestions(chapterId)
          .then(fresh => DB.putExerciseQuestionsCache(chapterId, fresh).catch(() => {}))
          .catch(() => {});
      }
      return cached;
    }
    if (navigator.onLine) {
      const fresh = await API.fetchStudentExerciseQuestions(chapterId);
      await DB.putExerciseQuestionsCache(chapterId, fresh).catch(() => {});
      return fresh;
    }
    throw new Error('offline, no cache');
  }

  function _renderGroupList() {
    const list = $('ev-groups-list');
    if (!_exerciseGroups.size) {
      list.innerHTML = '<p class="empty-hint">या Chapter साठी अजून Exercise नाही.</p>';
      return;
    }
    const nos = Array.from(_exerciseGroups.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    list.innerHTML = nos.map(no => {
      const qs = _exerciseGroups.get(no);
      const totalMarks = qs.reduce((s, q) => s + (q.marks || 0), 0);
      return `
        <div class="ev-group-card" data-no="${_esc(no)}">
          <b>Exercise ${_esc(no)}</b>
          <span>${qs.length} प्रश्न · ${totalMarks} गुण</span>
        </div>`;
    }).join('');
    list.querySelectorAll('.ev-group-card').forEach(card => {
      UI.makeFocusable(card);
      card.addEventListener('click', () => _showQuestions(card.dataset.no));
    });
  }

  function _showQuestions(no) {
    _activeExerciseNo = no;
    $('ev-groups-section').style.display = 'none';
    $('ev-questions-section').style.display = '';
    $('ev-questions-title').textContent = `Exercise ${no}`;

    const qs = _exerciseGroups.get(no) || [];
    const list = $('ev-questions-list');
    list.innerHTML = qs.map((q, i) => {
      const qText = q.questionText?.marathi || q.questionText?.english || '';
      const aText = q.answerText?.marathi || q.answerText?.english || '';
      return `
        <div class="ev-qcard">
          <div class="ev-qtop">
            <span class="ev-qnum">${i + 1}.</span>
            <span class="cm-marks-chip">${q.marks} marks</span>
          </div>
          <div class="ev-qtext">${_esc(qText)}</div>
          <button type="button" class="ev-reveal-btn" data-idx="${i}">उत्तर दाखवा</button>
          <div class="ev-atext hidden" id="ev-atext-${i}">${_esc(aText)}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.ev-reveal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.dataset.idx;
        const el = $('ev-atext-' + idx);
        const hidden = el.classList.toggle('hidden');
        btn.textContent = hidden ? 'उत्तर दाखवा' : 'उत्तर लपवा';
      });
    });

    // Math ($...$ / $$...$$) — same convention as Notes/Word Tests.
    window.MATH?.renderElement(list);
  }

  function _showGroupList() {
    $('ev-questions-section').style.display = 'none';
    $('ev-groups-section').style.display = '';
  }

  return { init };
})();

window.EXERCISE_VIEWER = EXERCISE_VIEWER;
document.addEventListener('DOMContentLoaded', () => EXERCISE_VIEWER.init());
