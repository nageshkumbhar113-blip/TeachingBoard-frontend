/* ════════════════════════════════════════
   db.js — IndexedDB Storage Layer
   TeachingBoard PWA — Complete CRUD
   Stores: questions, batches, batch_subjects,
           subject_chapters, sessions, settings,
           images, lessons, quizzes, test_attempts
════════════════════════════════════════ */

const DB = (() => {
  const DB_NAME    = 'TeachingBoardDB';
  const DB_VERSION = 10;
  const PENDING_WRITE_KEY = 'teachingboard_pending_writes';

  let _db = null;
  let _questionCache = null;

  // ════════════════════════
  // OPEN / UPGRADE
  // ════════════════════════

  function open() {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = e => {
        const db  = e.target.result;
        const old = e.oldVersion;

        // questions
        if (!db.objectStoreNames.contains('questions')) {
          const qs = db.createObjectStore('questions', { keyPath: 'q_id' });
          qs.createIndex('batch',   'batch');
          qs.createIndex('subject', 'subject');
          qs.createIndex('chapter', 'chapter');
          qs.createIndex('weak',    'weak_count');
        }

        // batches
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id', autoIncrement: true });
        }

        // batch_subjects
        if (!db.objectStoreNames.contains('batch_subjects')) {
          const bs = db.createObjectStore('batch_subjects', { keyPath: 'id', autoIncrement: true });
          bs.createIndex('batch', 'batch');
        }

        // subject_chapters
        if (!db.objectStoreNames.contains('subject_chapters')) {
          const sc = db.createObjectStore('subject_chapters', { keyPath: 'id', autoIncrement: true });
          sc.createIndex('batch', 'batch');
          sc.createIndex('subject', 'subject');
        }

        // sessions
        if (!db.objectStoreNames.contains('sessions')) {
          const ss = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          ss.createIndex('date', 'date');
        }

        // settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // images
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'name' });
        }

        // lessons
        if (!db.objectStoreNames.contains('lessons')) {
          const ls = db.createObjectStore('lessons', { keyPath: 'id', autoIncrement: true });
          ls.createIndex('updated_at', 'updated_at');
        }

        // quizzes  (Test Portal)
        if (!db.objectStoreNames.contains('quizzes')) {
          const qz = db.createObjectStore('quizzes', { keyPath: 'quiz_id' });
          qz.createIndex('batch',      'batch');
          qz.createIndex('subject',    'subject');
          qz.createIndex('status',     'status');
          qz.createIndex('created_at', 'created_at');
        }

        // test_attempts
        if (!db.objectStoreNames.contains('test_attempts')) {
          const ta = db.createObjectStore('test_attempts', { keyPath: 'attempt_id', autoIncrement: true });
          ta.createIndex('quiz_id', 'quiz_id');
          ta.createIndex('date',    'date');
        }

        // sync_queue — persists offline operations across crashes (replaces localStorage queue)
        if (!db.objectStoreNames.contains('sync_queue')) {
          const sq = db.createObjectStore('sync_queue', { keyPath: 'id' });
          sq.createIndex('at', 'at');
        }

        // notes_cache — encrypted PDF cache (AES-256-GCM, 7-day expiry)
        if (!db.objectStoreNames.contains('notes_cache')) {
          const nc = db.createObjectStore('notes_cache', { keyPath: 'note_id' });
          nc.createIndex('expires_at', 'expires_at');
        }
      };

      req.onsuccess = e => {
        _db = e.target.result;
        _db.onclose = () => { _db = null; };
        resolve(_db);
      };

      req.onerror = () => {
        console.error('DB open error', req.error);
        reject(req.error);
      };
    });
  }

  // ════════════════════════
  // LOW-LEVEL HELPERS
  // ════════════════════════

  function _p(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }

  async function _store(name, mode = 'readonly') {
    const db = await open();
    return db.transaction(name, mode).objectStore(name);
  }

  async function _getAll(store, indexName, value) {
    try {
      const db = await open();
      const tx = db.transaction(store, 'readonly');
      const s  = indexName ? tx.objectStore(store).index(indexName) : tx.objectStore(store);
      const r  = value !== undefined ? s.getAll(IDBKeyRange.only(value)) : s.getAll();
      return await _p(r);
    } catch { return []; }
  }

  async function _put(store, data) {
    try {
      const s   = await _store(store, 'readwrite');
      const res = await _p(s.put(data));
      if (store === 'questions') _questionCache = null;
      return res;
    } catch (err) {
      console.error('DB put error', store, err);
      throw err;
    }
  }

  async function _get(store, key) {
    try {
      const s = await _store(store);
      return await _p(s.get(key));
    } catch { return null; }
  }

  async function _del(store, key) {
    try {
      const s = await _store(store, 'readwrite');
      return await _p(s.delete(key));
    } catch {}
  }

  async function _getAllKeys(store) {
    try {
      const s = await _store(store);
      return await _p(s.getAllKeys());
    } catch { return []; }
  }

  function _loadPendingWrites() {
    try { return JSON.parse(localStorage.getItem(PENDING_WRITE_KEY) || '[]'); }
    catch { return []; }
  }

  function _savePendingWrites(queue) {
    try { localStorage.setItem(PENDING_WRITE_KEY, JSON.stringify(queue)); } catch {}
  }

  function _queuePendingWrite(op, payload, err) {
    const queue = _loadPendingWrites();
    const key = JSON.stringify({ op, payload });
    const exists = queue.some(item => JSON.stringify({ op: item.op, payload: item.payload }) === key);
    if (exists) return;

    queue.push({
      id    : `pw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      op,
      payload,
      at    : Date.now(),
      error : String(err?.message || err || 'Unknown write error'),
    });
    _savePendingWrites(queue);
  }

  function _cleanText(value) {
    return String(value || '').trim();
  }

  function _pairKey(a, b) {
    return `${_cleanText(a).toLowerCase()}::${_cleanText(b).toLowerCase()}`;
  }

  function _tripleKey(a, b, c) {
    return `${_pairKey(a, b)}::${_cleanText(c).toLowerCase()}`;
  }

  async function _ensureHierarchyEntry(batch, subject, chapter) {
    const cleanBatch = _cleanText(batch);
    const cleanSubject = _cleanText(subject);
    const cleanChapter = _cleanText(chapter);
    if (!cleanBatch) return;

    const batches = await getAllBatches();
    if (!batches.some(item => _cleanText(item.name).toLowerCase() === cleanBatch.toLowerCase())) {
      await saveBatch({ name: cleanBatch, icon: '📚' });
    }
    if (cleanSubject) {
      await saveBatchSubject({ batch: cleanBatch, name: cleanSubject });
    }
    if (cleanSubject && cleanChapter) {
      await saveSubjectChapter({ batch: cleanBatch, subject: cleanSubject, name: cleanChapter });
    }
  }

  // ════════════════════════
  // QUESTIONS
  // ════════════════════════

  function _genQId() {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function _normalizeQuestion(q) {
    return {
      ...q,
      q_id          : q.q_id || _genQId(),
      updated_at    : Date.now(),
      wrong_count   : q.wrong_count   || 0,
      correct_count : q.correct_count || 0,
      weak_count    : q.weak_count    || 0,
      flagged       : !!q.flagged,
    };
  }

  async function saveQuestion(q, { queueOnFailure = true } = {}) {
    const normalized = _normalizeQuestion({ ...q });
    try {
      await _put('questions', normalized);
      await _ensureHierarchyEntry(normalized.batch, normalized.subject, normalized.chapter);
      return normalized;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveQuestion', normalized, err);
      throw err;
    }
  }

  async function saveQuestionsBatch(questions = [], { queueOnFailure = true } = {}) {
    const normalized = questions.map(q => _normalizeQuestion({ ...q }));
    if (!normalized.length) return [];

    try {
      await Promise.all(normalized.map(q => _put('questions', q)));
      _questionCache = null;
      for (const item of normalized) {
        await _ensureHierarchyEntry(item.batch, item.subject, item.chapter);
      }
      return normalized;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveQuestionsBatch', normalized, err);
      throw err;
    }
  }

  async function getAllQuestions() {
    if (_questionCache) return _questionCache;
    _questionCache = await _getAll('questions');
    return _questionCache;
  }

  async function getQuestionsByBatch(batch) {
    return _getAll('questions', 'batch', batch);
  }

  async function getQuestionsByChapter(batch, subject, chapter) {
    const all = batch ? await getQuestionsByBatch(batch) : await getAllQuestions();
    return all.filter(q =>
      (!subject || q.subject === subject) &&
      (!chapter || q.chapter === chapter)
    );
  }

  async function deleteQuestion(q_id) {
    await _del('questions', q_id);
    _questionCache = null;
  }

  async function toggleFlag(q_id) {
    const q = await _get('questions', q_id);
    if (!q) return false;
    q.flagged = !q.flagged;
    await _put('questions', q);
    return q.flagged;
  }

  async function incrementWrong(q_id) {
    const q = await _get('questions', q_id);
    if (!q) return;
    q.wrong_count = (q.wrong_count || 0) + 1;
    q.weak_count = Math.max(q.weak_count || 0, q.wrong_count);
    await _put('questions', q);
  }

  async function incrementCorrect(q_id) {
    const q = await _get('questions', q_id);
    if (!q) return;
    q.correct_count = (q.correct_count || 0) + 1;
    q.wrong_count = Math.max(0, (q.wrong_count || 0) - 1);
    if (q.weak_count > 0) {
      q.weak_count = Math.max(0, q.weak_count - 1);
    }
    await _put('questions', q);
  }

  async function getWeakQuestions() {
    const all = await getAllQuestions();
    return all.filter(q => (q.weak_count || 0) >= 2 || q.flagged);
  }

  // ════════════════════════
  // CSV / JSON IMPORT-EXPORT
  // ════════════════════════

  async function importFromCSV(csvText, batch, subject, chapter) {
    const lines   = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    let added = 0, skipped = 0;
    const errors  = [];
    const existing = await getAllQuestions();
    const existing_set = new Set(existing.map(q => q.question?.trim().toLowerCase()));
    const toSave = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        // Skip header row
        if (i === 0 && /question/i.test(lines[i])) continue;

        const cols = _parseCSVLine(lines[i]);
        if (cols.length < 6) { errors.push(`Row ${i+1}: not enough columns`); continue; }

        const [question, A, B, C, D, answer, image, difficulty, type] = cols;
        if (!question.trim()) continue;

        const key = question.trim().toLowerCase();
        if (existing_set.has(key)) { skipped++; continue; }

        const q = {
          batch, subject, chapter,
          question: question.trim(),
          options: { A: A.trim(), B: B.trim(), C: C.trim(), D: D.trim() },
          answer:  (answer || 'A').trim().toUpperCase(),
          image:   (image  || '').trim() || null,
          difficulty: (['easy','medium','hard'].includes((difficulty||'').toLowerCase())
            ? difficulty.toLowerCase() : 'medium'),
          type: (['mcq','tf','fib','mtp'].includes((type||'').toLowerCase())
            ? type.toLowerCase() : 'mcq'),
          tags: [],
        };

        existing_set.add(key);
        toSave.push(q);
        added++;
      } catch (err) {
        errors.push(`Row ${i+1}: ${err.message}`);
      }
    }
    if (toSave.length) {
      try { await saveQuestionsBatch(toSave); }
      catch (err) { errors.push(`Batch save failed: ${err.message}`); }
    }
    return { added, skipped, errors };
  }

  function _parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
      cur += ch;
    }
    result.push(cur);
    return result;
  }

  async function importJSON(payload) {
    const questions = payload.questions || payload || [];
    const batches = Array.isArray(payload.batches) ? payload.batches : [];
    const batchSubjects = Array.isArray(payload.batchSubjects) ? payload.batchSubjects : [];
    const subjectChapters = Array.isArray(payload.subjectChapters) ? payload.subjectChapters : [];

    if (batches.length) {
      await Promise.all(batches.map(batch => saveBatch(batch)));
    }
    if (batchSubjects.length) {
      await Promise.all(batchSubjects.map(subject => saveBatchSubject(subject)));
    }
    if (subjectChapters.length) {
      await Promise.all(subjectChapters.map(chapter => saveSubjectChapter(chapter)));
    }

    const saved = await saveQuestionsBatch(questions);
    return saved.length;
  }

  async function exportJSON() {
    const questions = await getAllQuestions();
    const batches   = await getAllBatches();
    const batchSubjects = await getAllBatchSubjects();
    const subjectChapters = await getAllSubjectChapters();
    const lessons   = await getAllLessons();
    return {
      questions,
      batches,
      batchSubjects,
      subjectChapters,
      lessons,
      exported_at: new Date().toISOString(),
    };
  }

  // ════════════════════════
  // BATCHES
  // ════════════════════════

  async function getAllBatches() {
    return _getAll('batches');
  }

  async function saveBatch(b) {
    const name = _cleanText(b?.name);
    if (!name) throw new Error('Class name is required');

    const existing = await getAllBatches();
    const match = existing.find(item => _cleanText(item.name).toLowerCase() === name.toLowerCase());
    const resolvedId = match?.id ?? b?.id;
    const payload = {
      ...b,
      name,
      icon: b?.icon || match?.icon || '📚',
    };
    if (resolvedId != null) payload.id = resolvedId;
    await _put('batches', payload);
    return payload;
  }

  async function deleteBatch(id) {
    const batch = await _get('batches', id);
    await _del('batches', id);
    if (!batch?.name) return;

    const [subjects, chapters, questions] = await Promise.all([
      getSubjectsByBatch(batch.name),
      getAllSubjectChapters(),
      getAllQuestions(),
    ]);

    // Delete subjects and chapters
    await Promise.all(subjects.map(item => _del('batch_subjects', item.id)));
    await Promise.all(
      chapters
        .filter(item => _cleanText(item.batch).toLowerCase() === _cleanText(batch.name).toLowerCase())
        .map(item => _del('subject_chapters', item.id))
    );

    // Unlink questions (set batch to empty string, matching backend behavior)
    const questionsToUnlink = questions.filter(
      q => _cleanText(q.batch || '').toLowerCase() === _cleanText(batch.name).toLowerCase()
    );
    await Promise.all(questionsToUnlink.map(q => _put('questions', { ...q, batch: '' })));
  }

  async function initDefaultBatches() {
    const existing = await getAllBatches();
    if (existing.length) return;
    const defaults = [
      { id: 1, name: 'Std 5',  icon: '📚' },
      { id: 2, name: 'Std 6',  icon: '🌱' },
      { id: 3, name: 'Std 7',  icon: '🔬' },
      { id: 4, name: 'Std 8',  icon: '🧮' },
      { id: 5, name: 'Std 9',  icon: '🏛️' },
      { id: 6, name: 'Std 10', icon: '🎯' },
    ];
    await Promise.all(defaults.map(b => _put('batches', b)));
  }

  async function getAllBatchSubjects() {
    return _getAll('batch_subjects');
  }

  async function getSubjectsByBatch(batch) {
    const cleanBatch = _cleanText(batch);
    const all = await getAllBatchSubjects();
    return all
      .filter(item => _cleanText(item.batch).toLowerCase() === cleanBatch.toLowerCase())
      .sort((a, b) => _cleanText(a.name).localeCompare(_cleanText(b.name)));
  }

  async function saveBatchSubject(subject, { queueOnFailure = true } = {}) {
    const batch = _cleanText(subject?.batch);
    const name = _cleanText(subject?.name);
    if (!batch) throw new Error('Class is required');
    if (!name) throw new Error('Subject name is required');

    const existing = await getSubjectsByBatch(batch);
    const match = existing.find(item => _cleanText(item.name).toLowerCase() === name.toLowerCase());
    const resolvedId = match?.id ?? subject?.id;
    const payload = {
      ...subject,
      batch,
      name,
      updated_at: Date.now(),
    };
    if (resolvedId != null) payload.id = resolvedId;
    try {
      await _put('batch_subjects', payload);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveBatchSubject', payload, err);
      throw err;
    }
  }

  async function deleteBatchSubject(id) {
    const subject = await _get('batch_subjects', id);
    await _del('batch_subjects', id);
    if (!subject?.batch || !subject?.name) return;
    const chapters = await getChaptersByBatchSubject(subject.batch, subject.name);
    await Promise.all(chapters.map(item => _del('subject_chapters', item.id)));
  }

  async function getAllSubjectChapters() {
    return _getAll('subject_chapters');
  }

  async function getChaptersByBatchSubject(batch, subject) {
    const cleanBatch = _cleanText(batch);
    const cleanSubject = _cleanText(subject);
    const all = await getAllSubjectChapters();
    return all
      .filter(item =>
        _cleanText(item.batch).toLowerCase() === cleanBatch.toLowerCase() &&
        _cleanText(item.subject).toLowerCase() === cleanSubject.toLowerCase()
      )
      .sort((a, b) => _cleanText(a.name).localeCompare(_cleanText(b.name)));
  }

  async function saveSubjectChapter(chapter, { queueOnFailure = true } = {}) {
    const batch = _cleanText(chapter?.batch);
    const subject = _cleanText(chapter?.subject);
    const name = _cleanText(chapter?.name);
    if (!batch) throw new Error('Class is required');
    if (!subject) throw new Error('Subject is required');
    if (!name) throw new Error('Chapter name is required');

    const existing = await getChaptersByBatchSubject(batch, subject);
    const match = existing.find(item => _cleanText(item.name).toLowerCase() === name.toLowerCase());
    const resolvedId = match?.id ?? chapter?.id;
    const payload = {
      ...chapter,
      batch,
      subject,
      name,
      updated_at: Date.now(),
    };
    if (resolvedId != null) payload.id = resolvedId;
    try {
      await _put('subject_chapters', payload);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveSubjectChapter', payload, err);
      throw err;
    }
  }

  async function deleteSubjectChapter(id) {
    return _del('subject_chapters', id);
  }

  async function syncHierarchyFromExisting() {
    const [questions, quizzes, batches, batchSubjects, subjectChapters] = await Promise.all([
      getAllQuestions(),
      getAllQuizzes(),
      getAllBatches(),
      getAllBatchSubjects(),
      getAllSubjectChapters(),
    ]);

    const batchMap = new Map(
      batches.map(item => [_cleanText(item.name).toLowerCase(), item])
    );
    const subjectKeys = new Set(
      batchSubjects.map(item => _pairKey(item.batch, item.name))
    );
    const chapterKeys = new Set(
      subjectChapters.map(item => _tripleKey(item.batch, item.subject, item.name))
    );

    for (const item of [...questions, ...quizzes]) {
      const batch = _cleanText(item.batch);
      const subject = _cleanText(item.subject);
      const chapter = _cleanText(item.chapter);
      if (!batch) continue;

      const batchKey = batch.toLowerCase();
      if (!batchMap.has(batchKey)) {
        const savedBatch = await saveBatch({ name: batch, icon: '📚' });
        batchMap.set(batchKey, savedBatch);
      }

      if (subject) {
        const subjectKey = _pairKey(batch, subject);
        if (!subjectKeys.has(subjectKey)) {
          await _put('batch_subjects', { batch, name: subject, updated_at: Date.now() });
          subjectKeys.add(subjectKey);
        }
      }

      if (subject && chapter) {
        const chapterKey = _tripleKey(batch, subject, chapter);
        if (!chapterKeys.has(chapterKey)) {
          await _put('subject_chapters', { batch, subject, name: chapter, updated_at: Date.now() });
          chapterKeys.add(chapterKey);
        }
      }
    }
  }

  // ════════════════════════
  // SESSIONS (Quiz history)
  // ════════════════════════

  async function saveSession(s, { queueOnFailure = true } = {}) {
    const payload = { ...s, date: s.date || new Date().toISOString() };
    try {
      await _put('sessions', payload);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveSession', payload, err);
      throw err;
    }
  }

  async function getRecentSessions(n = 8) {
    const all = await _getAll('sessions');
    return all
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, n);
  }

  // ════════════════════════
  // SETTINGS
  // ════════════════════════

  async function getSetting(key, def) {
    const r = await _get('settings', key);
    return r != null ? r.value : def;
  }

  async function setSetting(key, value) {
    return _put('settings', { key, value });
  }

  // ════════════════════════
  // IMAGES
  // ════════════════════════

  async function saveImage(name, blob) {
    return _put('images', { name, blob });
  }

  async function getImage(name) {
    if (!name) return null;
    const rec = await _get('images', name);
    if (!rec) return null;
    if (rec.blob instanceof Blob) return URL.createObjectURL(rec.blob);
    return null;
  }

  async function getAllImageNames() {
    return _getAllKeys('images');
  }

  // ════════════════════════
  // LESSONS
  // ════════════════════════

  async function saveLesson(lesson, { queueOnFailure = true } = {}) {
    const payload = { ...lesson, updated_at: lesson.updated_at || new Date().toISOString() };
    if (!payload.id) payload.id = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await _put('lessons', payload);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveLesson', payload, err);
      throw err;
    }
  }

  async function saveLessons(arr, { queueOnFailure = true } = {}) {
    const lessons = arr.map(lesson => {
      const payload = { ...lesson, updated_at: lesson.updated_at || new Date().toISOString() };
      if (!payload.id) payload.id = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      return payload;
    });
    if (!lessons.length) return [];

    try {
      await Promise.all(lessons.map(lesson => saveLesson(lesson, { queueOnFailure: false })));
      return lessons;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveLessonsBatch', lessons, err);
      throw err;
    }
  }

  async function getAllLessons() {
    const all = await _getAll('lessons');
    return all.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  async function deleteLesson(id) {
    return _del('lessons', id);
  }

  // ════════════════════════
  // QUIZZES (Test Portal)
  // ════════════════════════

  function _genQuizId() {
    return `quiz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  }

  async function saveQuiz(quiz, { queueOnFailure = true } = {}) {
    const payload = {
      ...quiz,
      quiz_id    : quiz.quiz_id    || _genQuizId(),
      created_at : quiz.created_at || new Date().toISOString(),
      updated_at : quiz.updated_at || new Date().toISOString(),
    };
    try {
      await _put('quizzes', payload);
      await _ensureHierarchyEntry(payload.batch, payload.subject, payload.chapter);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveQuiz', payload, err);
      throw err;
    }
  }

  async function getQuiz(quiz_id) {
    return _get('quizzes', quiz_id);
  }

  async function getAllQuizzes() {
    return _getAll('quizzes');
  }

  async function getQuizzesByStatus(status) {
    return _getAll('quizzes', 'status', status);
  }

  async function deleteQuiz(quiz_id) {
    return _del('quizzes', quiz_id);
  }

  // ════════════════════════
  // TEST ATTEMPTS
  // ════════════════════════

  async function saveTestAttempt(a, { queueOnFailure = true } = {}) {
    const payload = { ...a, date: a.date || new Date().toISOString() };
    if (payload.percent == null && payload.max_score) {
      payload.percent = Math.round((payload.score / payload.max_score) * 100);
    }
    try {
      const attemptId = await _put('test_attempts', payload);
      if (payload.attempt_id == null && attemptId != null) {
        payload.attempt_id = attemptId;
      }
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveTestAttempt', payload, err);
      throw err;
    }
  }

  async function getAttemptsByQuiz(quiz_id) {
    return _getAll('test_attempts', 'quiz_id', quiz_id);
  }

  async function getAllAttempts() {
    const all = await _getAll('test_attempts');
    return all.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function getAttemptStats() {
    const attempts = await getAllAttempts();
    if (!attempts.length) return { total: 0, avgPercent: 0, bestPercent: 0, totalTime: 0 };
    const total       = attempts.length;
    const avgPercent  = Math.round(attempts.reduce((s, a) => s + (a.percent || 0), 0) / total);
    const bestPercent = Math.max(...attempts.map(a => a.percent || 0));
    const totalTime   = attempts.reduce((s, a) => s + (a.time_taken || 0), 0);
    return { total, avgPercent, bestPercent, totalTime };
  }

  // ════════════════════════
  // SYNC QUEUE  (IDB-backed, crash-safe)
  // ════════════════════════

  async function getSyncQueue() {
    const items = await _getAll('sync_queue');
    return items.sort((a, b) => a.at - b.at);
  }

  async function enqueueSyncItem(item) {
    return _put('sync_queue', item);
  }

  async function removeSyncItem(id) {
    return _del('sync_queue', id);
  }

  async function updateSyncItem(item) {
    return _put('sync_queue', item);
  }

  async function clearSyncQueue() {
    try {
      const db = await open();
      const tx = db.transaction('sync_queue', 'readwrite');
      await _p(tx.objectStore('sync_queue').clear());
    } catch {}
  }

  // Clear all IDB stores that hold per-student data (call on account switch)
  async function clearStudentLocalData() {
    const stores = ['sessions', 'test_attempts', 'sync_queue', 'notes_cache'];
    const db = await open();
    for (const name of stores) {
      try {
        if (db.objectStoreNames.contains(name)) {
          const tx = db.transaction(name, 'readwrite');
          await _p(tx.objectStore(name).clear());
        }
      } catch {}
    }
  }

  async function flushPendingWrites() {
    const queue = _loadPendingWrites();
    if (!queue.length) return { flushed: 0, remaining: 0 };

    const remaining = [];
    let flushed = 0;

    for (const item of queue) {
      try {
        if (item.op === 'saveQuestion') {
          await saveQuestion(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveQuestionsBatch') {
          await saveQuestionsBatch(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveBatchSubject') {
          await saveBatchSubject(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveSubjectChapter') {
          await saveSubjectChapter(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveLesson') {
          await saveLesson(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveLessonsBatch') {
          await saveLessons(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveQuiz') {
          await saveQuiz(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveSession') {
          await saveSession(item.payload, { queueOnFailure: false });
        } else if (item.op === 'saveTestAttempt') {
          await saveTestAttempt(item.payload, { queueOnFailure: false });
        } else {
          remaining.push(item);
          continue;
        }
        flushed++;
      } catch (err) {
        const retries = (item.retries || 0) + 1;
        if (retries < 5) {
          console.warn('Pending DB write retry failed', item.op, err);
          remaining.push({ ...item, retries, error: String(err?.message || err) });
        } else {
          console.error('Pending DB write dropped after 5 retries', item.op, item.payload);
        }
      }
    }

    _savePendingWrites(remaining);
    return { flushed, remaining: remaining.length };
  }

  function getPendingWriteCount() {
    return _loadPendingWrites().length;
  }

  // ════════════════════════
  // NOTES CACHE (encrypted PDF, 7-day TTL)
  // ════════════════════════

  const NOTE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  async function getNoteCache(noteId) {
    const db    = await open();
    const tx    = db.transaction('notes_cache', 'readonly');
    const entry = await _p(tx.objectStore('notes_cache').get(noteId));
    if (!entry) return null;
    if (Date.now() > entry.expires_at) {
      // Expired — delete and return null
      const dtx = db.transaction('notes_cache', 'readwrite');
      dtx.objectStore('notes_cache').delete(noteId);
      return null;
    }
    return entry;
  }

  async function putNoteCache(noteId, encryptedData, iv) {
    const db  = await open();
    const tx  = db.transaction('notes_cache', 'readwrite');
    const now = Date.now();
    await _p(tx.objectStore('notes_cache').put({
      note_id:    noteId,
      data:       encryptedData,
      iv:         iv,
      cached_at:  now,
      expires_at: now + NOTE_CACHE_TTL,
    }));
  }

  async function deleteNoteCache(noteId) {
    const db = await open();
    const tx = db.transaction('notes_cache', 'readwrite');
    await _p(tx.objectStore('notes_cache').delete(noteId));
  }

  async function clearExpiredNoteCache() {
    const db      = await open();
    const tx      = db.transaction('notes_cache', 'readwrite');
    const store   = tx.objectStore('notes_cache');
    const index   = store.index('expires_at');
    const range   = IDBKeyRange.upperBound(Date.now());
    const expired = await _p(index.getAllKeys(range));
    for (const key of expired) store.delete(key);
  }

  // ════════════════════════
  // RESET ALL
  // ════════════════════════

  async function resetAll() {
    const db = await open();
    const stores = ['questions','batches','batch_subjects','subject_chapters','sessions','settings',
                    'images','lessons','quizzes','test_attempts','sync_queue','notes_cache'];
    for (const name of stores) {
      if (db.objectStoreNames.contains(name)) {
        const tx = db.transaction(name, 'readwrite');
        await _p(tx.objectStore(name).clear());
      }
    }
    _questionCache = null;
    await initDefaultBatches();
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return {
    open,

    // Questions
    saveQuestion,
    saveQuestionsBatch,
    getAllQuestions,
    getQuestionsByBatch,
    getQuestionsByChapter,
    deleteQuestion,
    toggleFlag,
    incrementWrong,
    incrementCorrect,
    getWeakQuestions,

    // CSV / JSON
    importFromCSV,
    importJSON,
    exportJSON,

    // Batches
    getAllBatches,
    saveBatch,
    deleteBatch,
    initDefaultBatches,
    getAllBatchSubjects,
    getSubjectsByBatch,
    saveBatchSubject,
    deleteBatchSubject,
    getAllSubjectChapters,
    getChaptersByBatchSubject,
    saveSubjectChapter,
    deleteSubjectChapter,
    syncHierarchyFromExisting,

    // Sessions
    saveSession,
    getRecentSessions,

    // Settings
    getSetting,
    setSetting,

    // Images
    saveImage,
    getImage,
    getAllImageNames,

    // Lessons
    saveLesson,
    saveLessons,
    getAllLessons,
    deleteLesson,

    // Quizzes
    saveQuiz,
    getQuiz,
    getAllQuizzes,
    getQuizzesByStatus,
    deleteQuiz,

    // Test Attempts
    saveTestAttempt,
    saveAttempt: saveTestAttempt,   // alias
    getAttemptsByQuiz,
    getAttempts: getAllAttempts,     // alias — returns all, sorted newest-first
    getAllAttempts,
    getAttemptStats,
    flushPendingWrites,
    getPendingWriteCount,

    // Sync queue (IDB-backed)
    getSyncQueue,
    enqueueSyncItem,
    removeSyncItem,
    updateSyncItem,
    clearSyncQueue,
    clearStudentLocalData,

    // Notes cache (encrypted PDF, 7-day TTL)
    getNoteCache,
    putNoteCache,
    deleteNoteCache,
    clearExpiredNoteCache,

    // Reset
    resetAll,
  };
})();
