/* ════════════════════════════════════════
   db.js — IndexedDB Storage Layer
   TeachingBoard PWA — Complete CRUD
   Stores: questions, batches, batch_subjects,
           subject_chapters, sessions, settings,
           images, lessons, quizzes, test_attempts
════════════════════════════════════════ */

const DB = (() => {
  const DB_NAME    = 'TeachingBoardDB';
  const DB_VERSION = 15;
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

        // sls_chapters — encrypted offline cache of the student's chapter list
        if (!db.objectStoreNames.contains('sls_chapters')) {
          db.createObjectStore('sls_chapters', { keyPath: 'chapterId' });
        }

        // sls_concepts — encrypted offline cache of concept list/detail per chapter
        if (!db.objectStoreNames.contains('sls_concepts')) {
          const cn = db.createObjectStore('sls_concepts', { keyPath: '_id' });
          cn.createIndex('chapterId', 'chapterId');
        }

        // word_test_attempts — encrypted local record of a completed word
        // test, submitted live or queued for later sync if offline at the
        // moment of submission (mirrors test_attempts/sync_queue's role for
        // the classic quiz, but a separate store since payload shape/
        // idempotency key differ — see core/sync.js submitWordTestAttempt).
        if (!db.objectStoreNames.contains('word_test_attempts')) {
          const wt = db.createObjectStore('word_test_attempts', { keyPath: 'local_id' });
          wt.createIndex('test_id', 'test_id');
        }

        // exercise_questions_cache — encrypted offline cache of Exercise
        // questions per chapter. Separate from sls_concepts/sls_chapters:
        // different backend model (SLSQuestion vs Concept), different
        // natural cache key (chapterId alone, no per-concept granularity).
        if (!db.objectStoreNames.contains('exercise_questions_cache')) {
          db.createObjectStore('exercise_questions_cache', { keyPath: 'chapter_id' });
        }

        // words_cache — encrypted offline cache of the word-bank dictionary,
        // keyed per (batch, subject, page, search-query) since the server
        // paginates/searches server-side — caching per-query is simpler and
        // safer than fetching+merging every page just to cache "everything".
        if (!db.objectStoreNames.contains('words_cache')) {
          db.createObjectStore('words_cache', { keyPath: 'cache_key' });
        }

        // teacher_dashboard_cache / parent_dashboard_cache — generic
        // encrypted key→response cache, one row per distinct read call
        // (student list, analytics, notification history, fee configs,
        // children list, etc.) — see DB.getGenericCache/putGenericCache.
        if (!db.objectStoreNames.contains('teacher_dashboard_cache')) {
          db.createObjectStore('teacher_dashboard_cache', { keyPath: 'cache_key' });
        }
        if (!db.objectStoreNames.contains('parent_dashboard_cache')) {
          db.createObjectStore('parent_dashboard_cache', { keyPath: 'cache_key' });
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
      await _noteFlag(normalized.q_id, normalized.flagged).catch(() => {});
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
      // _ensureHierarchyEntry does the same incremental batch/subject/chapter
      // maintenance the full rescan does — no need to invalidate the rescan's
      // "already synced" flag here, it stays correct.
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
    // one chapter: read it through the chapter index, not the whole class (a class can
    // have 20,000+ bank questions — reading all of them took seconds on a cheap phone)
    if (batch && chapter) {
      return (await _getAll('questions', 'chapter', chapter)).filter(q =>
        q.batch === batch && (!subject || q.subject === subject));
    }
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

  // ── The bank one chapter at a time (core/qbank.js, 2026-11-22) ──
  // Puts a chapter's questions as the server sent them, in one transaction: questions the
  // server no longer has in that chapter are removed, and the child's own counters on a
  // question (wrong / correct / weak, flagged) are kept.
  const _KEEP_FIELDS = ['wrong_count', 'correct_count', 'weak_count', 'flagged'];
  async function replaceChapterQuestions(batch, subject, chapter, rows = []) {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('questions', 'readwrite');
      const st = tx.objectStore('questions');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
      const req = st.index('chapter').getAll(IDBKeyRange.only(chapter));
      req.onsuccess = () => {
        const old = new Map(req.result.filter(q => q.batch === batch && (q.subject || '') === (subject || '')).map(q => [q.q_id, q]));
        const keep = new Set();
        for (const r of rows) {
          const prev = old.get(r.q_id) || {};
          const q = _normalizeQuestion({ ...r });
          for (const f of _KEEP_FIELDS) if (prev[f] !== undefined) q[f] = prev[f];
          keep.add(q.q_id);
          st.put(q);
        }
        for (const id of old.keys()) if (!keep.has(id)) st.delete(id);
      };
    });
    _questionCache = null;
    if (rows.length) await _ensureHierarchyEntry(batch, subject, chapter).catch(() => {});
    return rows.length;
  }

  // Many class / subject / chapter entries at once (the bank's index, 500+ chapters): the
  // existing lists are read once and only the missing entries are written.
  async function ensureHierarchyMany(list = []) {
    const low = v => _cleanText(v).toLowerCase();
    const [batches, subjects, chapters] = await Promise.all([getAllBatches(), getAllBatchSubjects(), getAllSubjectChapters()]);
    const hb = new Set(batches.map(x => low(x.name)));
    const hs = new Set(subjects.map(x => `${low(x.batch)}|${low(x.name)}`));
    const hc = new Set(chapters.map(x => `${low(x.batch)}|${low(x.subject)}|${low(x.name)}`));
    let added = 0;
    for (const { b, s, c } of list) {
      const B = _cleanText(b), S = _cleanText(s), C = _cleanText(c);
      if (!B) continue;
      if (!hb.has(low(B))) { await _put('batches', { name: B, icon: '📚' }); hb.add(low(B)); added++; }
      if (S && !hs.has(`${low(B)}|${low(S)}`)) { await _put('batch_subjects', { batch: B, name: S, updated_at: Date.now() }); hs.add(`${low(B)}|${low(S)}`); added++; }
      if (S && C && !hc.has(`${low(B)}|${low(S)}|${low(C)}`)) { await _put('subject_chapters', { batch: B, subject: S, name: C, updated_at: Date.now() }); hc.add(`${low(B)}|${low(S)}|${low(C)}`); added++; }
    }
    return added;
  }

  // removes one chapter's bank questions (the chapter left the student's index)
  async function deleteChapterQuestions(batch, subject, chapter) {
    return replaceChapterQuestions(batch, subject, chapter, []);
  }

  // how many questions of a class are on the phone (without reading them)
  async function countQuestionsByBatch(batch) {
    try {
      const s = await _store('questions');
      return await _p(s.index('batch').count(IDBKeyRange.only(batch)));
    } catch { return 0; }
  }

  // walks every stored question without keeping them all in memory at once
  async function forEachQuestion(fn) {
    const db = await open();
    await new Promise((resolve, reject) => {
      const req = db.transaction('questions', 'readonly').objectStore('questions').openCursor();
      req.onsuccess = () => { const c = req.result; if (!c) return resolve(); try { fn(c.value); } catch { /* */ } c.continue(); };
      req.onerror = () => reject(req.error);
    });
  }

  async function toggleFlag(q_id) {
    const q = await _get('questions', q_id);
    if (!q) return false;
    q.flagged = !q.flagged;
    await _put('questions', q);
    await _noteFlag(q_id, q.flagged).catch(() => {});
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

  // Weak (wrong twice or more) + flagged questions, without reading the whole bank (20,000+
  // took 15 s on a cheap phone): weak ones from the 'weak' index, flagged ones from a small
  // list of ids kept beside them (made once from the stored questions, then kept by saves).
  const FLAGGED_KEY = 'flagged_qids';
  async function _flaggedIds() {
    let ids = await getSetting(FLAGGED_KEY, null).catch(() => null);
    if (!Array.isArray(ids)) {
      ids = (await _getAll('questions')).filter(q => q.flagged).map(q => q.q_id);
      await setSetting(FLAGGED_KEY, ids).catch(() => {});
    }
    return ids;
  }
  async function _noteFlag(q_id, flagged) {
    const ids = await _flaggedIds();
    const has = ids.includes(q_id);
    if (flagged && !has) await setSetting(FLAGGED_KEY, [...ids, q_id]).catch(() => {});
    if (!flagged && has) await setSetting(FLAGGED_KEY, ids.filter(x => x !== q_id)).catch(() => {});
  }
  async function getWeakQuestions() {
    const [weak, flagged] = await Promise.all([getWeakByIndex(2), _flaggedIds().then(getQuestionsByIds).catch(() => [])]);
    const seen = new Set(), out = [];
    for (const q of [...weak, ...flagged]) {
      if (seen.has(q.q_id) || !((q.weak_count || 0) >= 2 || q.flagged)) continue;
      seen.add(q.q_id); out.push(q);
    }
    return out;
  }

  // questions answered wrong at least twice, straight from the 'weak' index (fast, any bank size)
  async function getWeakByIndex(min = 2) {
    try {
      const s = await _store('questions');
      return await _p(s.index('weak').getAll(IDBKeyRange.lowerBound(min)));
    } catch { return []; }
  }

  // the questions with these ids (e.g. the ones in the student's attempts)
  async function getQuestionsByIds(ids = []) {
    const want = [...new Set(ids.filter(Boolean))];
    if (!want.length) return [];
    const db = await open();
    return new Promise(resolve => {
      const st = db.transaction('questions', 'readonly').objectStore('questions');
      const out = []; let left = want.length;
      for (const id of want) {
        const r = st.get(id);
        r.onsuccess = () => { if (r.result) out.push(r.result); if (!--left) resolve(out); };
        r.onerror = () => { if (!--left) resolve(out); };
      }
    });
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

    const [subjects, chapters, questions, quizzes] = await Promise.all([
      getSubjectsByBatch(batch.name),
      getAllSubjectChapters(),
      getAllQuestions(),
      getAllQuizzes(),
    ]);

    // Delete subjects and chapters
    await Promise.all(subjects.map(item => _del('batch_subjects', item.id)));
    await Promise.all(
      chapters
        .filter(item => _cleanText(item.batch).toLowerCase() === _cleanText(batch.name).toLowerCase())
        .map(item => _del('subject_chapters', item.id))
    );

    // Unlink questions AND quizzes (set batch to empty string, matching
    // backend behavior). Quizzes were previously left untouched here, which
    // meant syncHierarchyFromExisting() — run on next login/sync — would
    // scan the still-cached quiz's stale batch name and silently recreate
    // the "deleted" batch from it.
    const cleanName = _cleanText(batch.name).toLowerCase();
    const questionsToUnlink = questions.filter(q => _cleanText(q.batch || '').toLowerCase() === cleanName);
    const quizzesToUnlink   = quizzes.filter(q => _cleanText(q.batch || '').toLowerCase() === cleanName);
    await Promise.all([
      ...questionsToUnlink.map(q => _put('questions', { ...q, batch: '' })),
      ...quizzesToUnlink.map(q => _put('quizzes', { ...q, batch: '' })),
    ]);
  }

  const DEFAULT_BATCHES_SEEDED_KEY = 'teachingboard_default_batches_seeded';

  // Real bug found live: admin deletes a demo "Std N" batch, it comes back
  // later. Root cause — this used to seed 6 hardcoded demo batches (Std
  // 5-10) on first run, guarded by a ONE-TIME flag stored in the SAME local
  // IndexedDB it's seeding into. Any time that local storage gets cleared
  // (reinstall, "clear app cache" troubleshooting, new device) the guard
  // flag is wiped right along with everything else, so the next boot reads
  // it as a genuinely fresh install and reseeds the demo batches again —
  // "delete doesn't stick" was really "reseeded on every cache-clear".
  // The app now has real, admin-managed batches synced from the server;
  // demo placeholders serve no purpose and only cause this confusion, so
  // this is now a permanent no-op. Kept as a function (not removed) since
  // it's called from admin-shell.js/app.js/db.js's own init — no call sites
  // need to change.
  async function initDefaultBatches() {
    return;
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
      .sort((a, b) => {
        const oa = typeof a.order === 'number' ? a.order : Infinity;
        const ob = typeof b.order === 'number' ? b.order : Infinity;
        if (oa !== ob) return oa - ob;
        return _cleanText(a.name).localeCompare(_cleanText(b.name));
      });
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
    // New chapters are appended after existing ones so they don't jump ahead
    // of an already-set manual order; existing chapters keep whatever order
    // (or lack of one) they already had unless the caller explicitly changes it.
    if (payload.order == null) {
      payload.order = match?.order ?? existing.length;
    }
    try {
      await _put('subject_chapters', payload);
      return payload;
    } catch (err) {
      if (queueOnFailure) _queuePendingWrite('saveSubjectChapter', payload, err);
      throw err;
    }
  }

  async function reorderSubjectChapters(batch, subject, orderedIds) {
    const existing = await getChaptersByBatchSubject(batch, subject);
    const byId = new Map(existing.map(item => [String(item.id), item]));
    const updated = [];
    for (let i = 0; i < orderedIds.length; i++) {
      const item = byId.get(String(orderedIds[i]));
      if (!item) continue;
      const payload = { ...item, order: i, updated_at: Date.now() };
      await _put('subject_chapters', payload);
      updated.push(payload);
    }
    return updated;
  }

  async function deleteSubjectChapter(id) {
    return _del('subject_chapters', id);
  }

  // _ensureHierarchyEntry() (called from saveQuestion/saveQuestionsBatch/saveQuiz)
  // already keeps batch/subject/chapter tables correct incrementally as content
  // is written. This full rescan is only a repair pass for data that predates
  // that incremental logic — running it on every loadHome()/refreshHome() means
  // re-scanning the ENTIRE local questions+quizzes cache on nearly every
  // navigation, which gets slower as more content syncs locally over time.
  // Run it once per session and skip on subsequent calls.
  let _hierarchySynced = false;

  async function syncHierarchyFromExisting({ force = false } = {}) {
    if (_hierarchySynced && !force) return;

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

    _hierarchySynced = true;
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

  // ── Login PINs on the WEBSITE (security audit 2026-11-22) ──
  // On a shared computer (school, cyber café) a PIN kept in the browser could be read by the next
  // person. On the website the PIN now lives only for the open browser session (sessionStorage);
  // what stays is a slow salted hash, enough for the PIN-lock screen to check a typed PIN (which then
  // brings the session copy back). The installed app (a child's own phone) keeps it as before.
  const _PIN_KEYS = new Set(['student_pin', 'teacher_pin', 'parent_pin']);
  const _isNative = () => !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
  const _webPin = key => _PIN_KEYS.has(key) && !_isNative() && typeof sessionStorage !== 'undefined' && !!window.crypto?.subtle;
  const _ss = { get: k => { try { return sessionStorage.getItem('tb_' + k) || ''; } catch { return ''; } }, set: (k, v) => { try { v ? sessionStorage.setItem('tb_' + k, v) : sessionStorage.removeItem('tb_' + k); } catch { /* blocked */ } } };
  const _u8b64 = u8 => btoa(String.fromCharCode(...u8));
  async function _pinDigest(pin, saltB64) {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, k, 256);
    return _u8b64(new Uint8Array(bits));
  }
  async function _webPinSet(key, value) {
    const v = String(value || '').trim();
    _ss.set(key, v);
    if (!v) return _put('settings', { key: key + '_check', value: null });
    const s = _u8b64(crypto.getRandomValues(new Uint8Array(16)));
    return _put('settings', { key: key + '_check', value: { s, h: await _pinDigest(v, s) } });
  }
  // an older version kept the PIN itself in the browser store: moved to this session + a hash, then removed
  async function _migrateWebPin(key) {
    const old = await _get('settings', key);
    if (old?.value) { await _webPinSet(key, old.value).catch(() => {}); await _del('settings', key); }
  }
  // a PIN typed on the lock screen: right? (website: checked against the hash; app: the stored PIN)
  async function checkSavedPin(key, typed) {
    const t = String(typed || '').trim();
    if (!t) return false;
    if (!_webPin(key)) return t === String(await getSetting(key, '') || '').trim();
    await _migrateWebPin(key);
    const c = (await _get('settings', key + '_check'))?.value;
    if (!c?.s || !c?.h) return false;
    const ok = (await _pinDigest(t, c.s)) === c.h;
    if (ok) _ss.set(key, t);   // this session can log in again on its own
    return ok;
  }
  async function hasSavedPin(key) {
    if (!_webPin(key)) return !!String(await getSetting(key, '') || '').trim();
    await _migrateWebPin(key);
    return !!_ss.get(key) || !!(await _get('settings', key + '_check'))?.value?.h;
  }

  async function getSetting(key, def) {
    if (_webPin(key)) {
      await _migrateWebPin(key);
      return _ss.get(key) || def;
    }
    const r = await _get('settings', key);
    return r != null ? r.value : def;
  }

  async function setSetting(key, value) {
    if (_webPin(key)) return _webPinSet(key, value);
    return _put('settings', { key, value });
  }

  // ════════════════════════
  // IMAGES
  // ════════════════════════

  async function saveImage(name, blob) {
    return _put('images', { name, blob });
  }

  // Pictures saved for offline use are kept encrypted like the notes
  // (CRYPTO, per-device key); the admin app's own images stay plain blobs.
  async function saveImageEncrypted(name, blob) {
    const enc = await CRYPTO.encryptBytes(await blob.arrayBuffer());
    return _put('images', { name, enc, type: blob.type || 'image/*', size: blob.size });
  }

  async function getImage(name) {
    if (!name) return null;
    const rec = await _get('images', name);
    if (!rec) return null;
    if (rec.blob instanceof Blob) return URL.createObjectURL(rec.blob);
    if (rec.enc) {
      const plain = await CRYPTO.decryptBytes(rec.enc);
      return plain ? URL.createObjectURL(new Blob([plain], { type: rec.type || 'image/*' })) : null;
    }
    return null;
  }

  async function getAllImageNames() {
    return _getAllKeys('images');
  }

  // Everything stored for offline notes and exercises, decrypted — for the
  // offline picture cache (core/imageCache.js) to find picture links in.
  async function getAllOfflineStudyContent() {
    const [concepts, exercises] = await Promise.all([_getAll('sls_concepts'), _getAll('exercise_questions_cache')]);
    const open = rows => Promise.all(rows.map(r => CRYPTO.decrypt(r).catch(() => null)));
    return { concepts: (await open(concepts)).filter(Boolean), exercises: (await open(exercises)).filter(Boolean) };
  }

  // Offline image cache (core/imageCache.js) drops old pictures when full.
  async function deleteImage(name) {
    if (!name) return;
    return _del('images', name);
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

  async function deleteAttempt(attemptId) {
    if (attemptId == null) return;
    return _del('test_attempts', attemptId);
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
  // keepQueue: leave the offline upload queue alone — its result entries are
  // tagged with the student who made them (core/sync.js _enqueue) and only
  // upload while that student is logged in, so another student's login must
  // not throw them away.
  async function clearStudentLocalData({ keepQueue = false } = {}) {
    const stores = ['sessions', 'test_attempts', 'sync_queue', 'notes_cache', 'sls_chapters', 'sls_concepts', 'word_test_attempts', 'exercise_questions_cache', 'words_cache', 'teacher_dashboard_cache', 'parent_dashboard_cache']
      .filter(name => !(keepQueue && name === 'sync_queue'));
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
  // SLS NOTES CACHE (chapters/concepts — encrypted, offline reading)
  // ════════════════════════

  async function saveChaptersCache(chapters = []) {
    if (!chapters.length) return [];
    await Promise.all(chapters.map(async ch => {
      const packed = await CRYPTO.encrypt({ ...ch, cached_at: Date.now() });
      return _put('sls_chapters', { chapterId: ch.chapterId, ...packed });
    }));
    return chapters;
  }

  async function getCachedChapters() {
    const rows = await _getAll('sls_chapters');
    if (!rows.length) return null;
    const decrypted = await Promise.all(rows.map(r => CRYPTO.decrypt(r)));
    const valid = decrypted.filter(Boolean);
    return valid.length ? valid : null;
  }

  async function saveConceptsCache(chapterId, concepts = []) {
    if (!concepts.length) return [];
    await Promise.all(concepts.map(async c => {
      // Real bug found live: this list endpoint's shape has no actual
      // content (title/order/difficulty/examTags only) — writing it always
      // silently downgraded an already-fully-cached concept (full:true,
      // real content — from viewConcept() or the full offline sync) back
      // to this stripped shape, since both write the same sls_concepts row
      // keyed by _id. That made "Note works offline once, then stops"
      // trivially reproducible: this runs as a background refresh every
      // single time a chapter's concept list is opened while online (see
      // notesViewer.js's _loadConcepts + SYNC.refreshSlsConcepts), which
      // kept clobbering the full content the offline sync had just built.
      // Skip the write entirely when a full version is already cached —
      // never downgrade richer data with a lighter one.
      const existing = await _get('sls_concepts', c._id).catch(() => null);
      const existingDecrypted = existing ? await CRYPTO.decrypt(existing).catch(() => null) : null;
      if (existingDecrypted?.full) return;

      const payload = { ...c, chapterId, cached_at: Date.now(), full: c.full ?? false };
      const packed = await CRYPTO.encrypt(payload);
      return _put('sls_concepts', { _id: c._id, chapterId, ...packed });
    }));
    return concepts;
  }

  async function getCachedConcepts(chapterId) {
    const rows = await _getAll('sls_concepts', 'chapterId', chapterId);
    if (!rows.length) return null;
    const decrypted = await Promise.all(rows.map(r => CRYPTO.decrypt(r)));
    const valid = decrypted.filter(Boolean);
    return valid.length ? valid : null;
  }

  async function saveConceptCache(concept) {
    const payload = { ...concept, cached_at: Date.now(), full: true };
    const packed = await CRYPTO.encrypt(payload);
    await _put('sls_concepts', { _id: concept._id, chapterId: concept.chapterId, ...packed });
    return payload;
  }

  async function getCachedConcept(conceptId) {
    const row = await _get('sls_concepts', conceptId);
    if (!row) return null;
    const decrypted = await CRYPTO.decrypt(row);
    return decrypted && decrypted.full ? decrypted : null;
  }

  async function deleteSlsCacheForChapter(chapterId) {
    const rows = await _getAll('sls_concepts', 'chapterId', chapterId);
    await Promise.all(rows.map(r => _del('sls_concepts', r._id)));
    await _del('sls_chapters', chapterId);
  }

  // ════════════════════════
  // WORD TEST ATTEMPTS (encrypted, submit-queue-safe)
  // ════════════════════════

  async function saveWordTestAttempt(attempt) {
    const packed = await CRYPTO.encrypt(attempt);
    await _put('word_test_attempts', { local_id: attempt.local_id, test_id: attempt.test_id, ...packed });
    return attempt;
  }

  async function getWordTestAttempt(localId) {
    const row = await _get('word_test_attempts', localId);
    if (!row) return null;
    return CRYPTO.decrypt(row);
  }

  async function getWordTestAttemptsByTest(testId) {
    const rows = await _getAll('word_test_attempts', 'test_id', testId);
    const decrypted = await Promise.all(rows.map(r => CRYPTO.decrypt(r)));
    return decrypted.filter(Boolean);
  }

  // ════════════════════════
  // EXERCISE QUESTIONS CACHE (encrypted, offline reading)
  // ════════════════════════

  async function putExerciseQuestionsCache(chapterId, questions = []) {
    const packed = await CRYPTO.encrypt({ questions, cached_at: Date.now() });
    await _put('exercise_questions_cache', { chapter_id: chapterId, ...packed });
    return questions;
  }

  async function getExerciseQuestionsCache(chapterId) {
    const row = await _get('exercise_questions_cache', chapterId);
    if (!row) return null;
    const decrypted = await CRYPTO.decrypt(row);
    return decrypted?.questions?.length ? decrypted.questions : null;
  }

  // ════════════════════════
  // WORDS / DICTIONARY CACHE (encrypted, per batch+subject+page+query)
  // ════════════════════════

  function _wordsCacheKey(batch, subject, page, q) {
    return `${batch}::${subject}::${page}::${q || ''}`;
  }

  async function putWordsPageCache(batch, subject, page, q, payload) {
    const key = _wordsCacheKey(batch, subject, page, q);
    const packed = await CRYPTO.encrypt({ ...payload, cached_at: Date.now() });
    await _put('words_cache', { cache_key: key, ...packed });
    return payload;
  }

  async function getWordsPageCache(batch, subject, page, q) {
    const key = _wordsCacheKey(batch, subject, page, q);
    const row = await _get('words_cache', key);
    if (!row) return null;
    return CRYPTO.decrypt(row);
  }

  // ════════════════════════
  // GENERIC ENCRYPTED CACHE (Teacher/Parent dashboards — one row per
  // distinct read call, keyed by whatever string the caller builds from
  // its own function name + args, e.g. 'students', 'weekly:TCH123')
  // ════════════════════════

  async function putGenericCache(storeName, key, payload) {
    const packed = await CRYPTO.encrypt({ payload, cached_at: Date.now() });
    await _put(storeName, { cache_key: key, ...packed });
    return payload;
  }

  async function getGenericCache(storeName, key) {
    const row = await _get(storeName, key);
    if (!row) return null;
    const decrypted = await CRYPTO.decrypt(row);
    return decrypted ? decrypted.payload : null;
  }

  // ════════════════════════
  // RESET ALL
  // ════════════════════════

  async function resetAll() {
    const db = await open();
    const stores = ['questions','batches','batch_subjects','subject_chapters','sessions','settings',
                    'images','lessons','quizzes','test_attempts','sync_queue','notes_cache',
                    'sls_chapters','sls_concepts','word_test_attempts','exercise_questions_cache','words_cache',
                    'teacher_dashboard_cache','parent_dashboard_cache'];
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
    replaceChapterQuestions,
    deleteChapterQuestions,
    getQuestionsByIds,
    getWeakByIndex,
    ensureHierarchyEntry: (b, s, c) => _ensureHierarchyEntry(b, s, c),
    ensureHierarchyMany,
    countQuestionsByBatch,
    forEachQuestion,
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
    reorderSubjectChapters,
    deleteSubjectChapter,
    syncHierarchyFromExisting,

    // Sessions
    saveSession,
    getRecentSessions,

    // Settings
    getSetting,
    setSetting,
    checkSavedPin,
    hasSavedPin,

    // Images
    saveImage,
    saveImageEncrypted,
    getImage,
    getAllImageNames,
    deleteImage,
    getAllOfflineStudyContent,

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
    deleteAttempt,
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

    // SLS notes cache (chapters/concepts, encrypted, offline reading)
    saveChaptersCache,
    getCachedChapters,
    saveConceptsCache,
    getCachedConcepts,
    saveConceptCache,
    getCachedConcept,
    deleteSlsCacheForChapter,

    // Word Test attempts (encrypted, submit-queue-safe)
    saveWordTestAttempt,
    getWordTestAttempt,
    getWordTestAttemptsByTest,

    // Exercise questions cache (encrypted, offline reading)
    putExerciseQuestionsCache,
    getExerciseQuestionsCache,

    // Words/Dictionary cache (encrypted, offline reading)
    putWordsPageCache,
    getWordsPageCache,

    // Generic cache (Teacher/Parent dashboards)
    putGenericCache,
    getGenericCache,

    // Reset
    resetAll,
  };
})();
