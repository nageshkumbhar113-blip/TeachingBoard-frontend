/* ════════════════════════════════════════
   sync.js — Backend Sync & Offline Bridge

   Features
   ────────
   setApiUrl      — validate + persist server URL
   publishQuiz    — upload local quiz to server; queue when offline
   fetchQuizzes   — pull remote quizzes into local DB
   deltaSync      — manual full sync (admin panel button)
   autoSync       — startup entry point: restores URL, drains queue,
                    starts periodic background sync

   Offline handling
   ────────────────
   All write ops enqueue when offline (localStorage).
   Queue is drained automatically on reconnect and on each auto-sync tick.
   Items are retried up to MAX_RETRY times, then dropped with a warning.

   Error handling
   ──────────────
   Network errors  → offline status + queue
   4xx client err  → toast + throw (no retry — bad data)
   5xx / unknown   → toast + throw
   404 on /quizzes → silent skip (endpoint optional)
   Expired account → API.markExpired() (handled in helpers.js)

   Global: SYNC
════════════════════════════════════════ */

const SYNC = (() => {

  // ════════════════════════
  // CONSTANTS / STATE
  // ════════════════════════

  const QUEUE_KEY  = 'teachingboard_sync_queue';
  const MAX_RETRY  = 3;
  const AUTO_MS    = 5 * 60 * 1000;   // 5 minutes between background cycles
  const STUDENT_AUTO_MS = 45 * 1000;

  let _autoInterval       = null;
  let _isSyncing          = false;
  let _lastSyncAt         = 0;
  let _onlineWired        = false;      // guard: wire online/offline once
  let _studentAutoInterval = null;
  let _studentSyncing     = false;
  let _studentOnlineWired = false;
  let _statusListeners    = [];         // callbacks for sync status bar updates
  let _onlineDebounce     = null;       // debounce timer for rapid online events

  // ════════════════════════
  // STATUS DOT
  // ════════════════════════

  /**
   * @param {'online'|'offline'|'syncing'} s
   */
  function _setStatus(s) {
    const dot = document.querySelector('.status-dot');
    if (!dot) return;
    dot.classList.remove('online', 'offline', 'syncing');
    dot.classList.add(s);

    // Propagate text next to dot if the element exists
    const label = document.querySelector('.status-label');
    if (label) {
      label.textContent = s === 'syncing' ? 'Syncing…'
                        : s === 'online'  ? 'Online'
                                          : 'Offline';
    }
  }

  // ════════════════════════
  // HELPERS
  // ════════════════════════

  const _isOnline = () => navigator.onLine;

  function _notifyStatusListeners() {
    const status = _buildSyncStatus();
    for (const cb of _statusListeners) {
      try { cb(status); } catch {}
    }
  }

  function _buildSyncStatus() {
    const queue   = _loadQueue();
    const pending = queue.filter(i => i.attempts < MAX_RETRY).length;
    const failed  = queue.filter(i => i.attempts >= MAX_RETRY).length;
    return {
      pending,
      failed,
      syncing : _isSyncing,
      online  : _isOnline(),
      lastSync: _lastSyncAt,
      locked  : _isSyncing,     // UI should disable publish while syncing
    };
  }

  /** Throws a user-readable error if `url` is not a valid absolute URL. */
  function _validateUrl(url) {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    if (!clean) throw new Error('API URL cannot be empty');
    try { new URL(clean); }
    catch { throw new Error(`Invalid URL: "${clean}"`); }
    return clean;
  }

  /** True when an error looks like a network/connection failure. */
  function _isNetworkError(err) {
    if (!_isOnline()) return true;
    return /failed to fetch|network|connection|timeout/i.test(err?.message || '');
  }

  // ════════════════════════
  // OFFLINE QUEUE  (IDB-backed, crash-safe)
  // localStorage is kept only for migration of existing items on first load
  // ════════════════════════

  let _queueCache   = null;   // in-memory mirror so getSyncStatus() stays sync
  let _queueReady   = false;

  async function _initQueue() {
    if (_queueReady) return;
    _queueReady = true;

    // One-time migration: pull any items from old localStorage queue into IDB
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) {
        const old = JSON.parse(raw);
        if (Array.isArray(old) && old.length) {
          for (const item of old) {
            const id = item.id || `q_${item.at || Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            await DB.enqueueSyncItem({ ...item, id }).catch(() => {});
          }
          localStorage.removeItem(QUEUE_KEY);
          console.info(`SYNC: migrated ${old.length} queue item(s) from localStorage → IDB`);
        } else {
          localStorage.removeItem(QUEUE_KEY);
        }
      }
    } catch {}

    _queueCache = await DB.getSyncQueue().catch(() => []);
  }

  /** Sync-safe read: returns in-memory cache (may be null before _initQueue resolves) */
  function _loadQueue() {
    return _queueCache || [];
  }

  /**
   * Add an operation to the IDB-backed offline queue.
   * Deduplicates by (op, serialised payload) to prevent repeated queuing.
   */
  async function _enqueue(op, payload) {
    if (!_queueReady) await _initQueue();
    const key  = JSON.stringify(payload);
    const dupe = _loadQueue().some(i => i.op === op && JSON.stringify(i.payload) === key);
    if (!dupe) {
      const item = { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, op, payload, at: Date.now(), attempts: 0 };
      await DB.enqueueSyncItem(item).catch(err => console.warn('SYNC enqueue failed:', err.message));
      _queueCache = await DB.getSyncQueue().catch(() => _queueCache || []);
      console.info(`SYNC queue: +${op}`);
      _notifyStatusListeners();
    }
  }

  function _getQuizId(quizOrId) {
    if (typeof quizOrId === 'string') return quizOrId;
    return String(quizOrId?.quiz_id || '').trim();
  }

  async function _loadQuizSnapshot(quizOrId) {
    const quizId = _getQuizId(quizOrId);
    if (!quizId) return null;

    const stored = await DB.getQuiz(quizId).catch(() => null);
    if (stored) return stored;
    if (quizOrId && typeof quizOrId === 'object') return quizOrId;
    return null;
  }

  function _normalizeQueuePublishPayload(payload = {}) {
    return {
      quizId: String(payload.quizId || '').trim(),
      opts  : payload.opts || {},
    };
  }

  function _toBackendQuizQuestion(question, quizTitle) {
    if (!question?.question) {
      throw new Error(`Quiz "${quizTitle}" contains an empty question`);
    }

    const optionEntries = Object.entries(question.options || {})
      .filter(([key, value]) => String(value || '').trim() || question.option_images?.[key])
      .sort(([a], [b]) => a.localeCompare(b));

    if (optionEntries.length < 2) {
      throw new Error(
        `Question "${String(question.question).slice(0, 48)}" cannot be published because it does not have at least 2 options`
      );
    }

    const normalizedAnswer = String(question.answer || '').trim().toUpperCase();
    if (!normalizedAnswer || !optionEntries.some(([key]) => key === normalizedAnswer)) {
      throw new Error(
        `Question "${String(question.question).slice(0, 48)}" has an answer that does not match its options`
      );
    }

    return {
      q_id         : question.q_id,
      question     : String(question.question).trim(),
      options      : Object.fromEntries(optionEntries.map(([key, value]) => [key, String(value || '').trim()])),
      option_images: Object.fromEntries(optionEntries.map(([key]) => [key, question.option_images?.[key] || null])),
      answer       : normalizedAnswer,
      image        : question.image || null,
    };
  }

  async function _buildPublishPayload(quiz) {
    const allQIds = (quiz.sections || []).flatMap(section => section.question_ids || []);
    const allQs   = await DB.getAllQuestions();
    const qMap    = new Map(allQs.map(question => [question.q_id, question]));

    const questions = allQIds.map(qId => qMap.get(qId)).filter(Boolean);

    if (!questions.length) {
      throw new Error(`Quiz "${quiz.title || quiz.quiz_id}" has no questions to publish`);
    }

    if (questions.length !== allQIds.length) {
      throw new Error(`Quiz "${quiz.title || quiz.quiz_id}" is missing ${allQIds.length - questions.length} local question(s)`);
    }

    return {
      quiz_id    : quiz.quiz_id,
      title      : quiz.title || 'Untitled Quiz',
      subject    : quiz.subject || '',
      chapter    : quiz.chapter || '',
      batch      : quiz.batch || '',
      status     : 'published',
      timer_mode : quiz.timer_mode || 'none',
      timer_value: Number(quiz.timer_value || 0) || 0,
      shuffle    : !!quiz.shuffle,
      questions  : questions.map(question => _toBackendQuizQuestion(question, quiz.title || quiz.quiz_id)),
    };
  }

  async function _markQuizQueued(quizOrId) {
    const quiz = await _loadQuizSnapshot(quizOrId);
    if (!quiz) return null;

    return DB.saveQuiz({
      ...quiz,
      status            : 'draft',
      synced            : false,
      pending_publish   : true,
      last_publish_error: '',
      queued_at         : Date.now(),
    });
  }

  async function _markPublishFailed(quizOrId, message) {
    const quiz = await _loadQuizSnapshot(quizOrId);
    if (!quiz) return null;

    return DB.saveQuiz({
      ...quiz,
      status            : 'draft',
      synced            : false,
      pending_publish   : false,
      last_publish_error: String(message || 'Publish failed'),
    });
  }

  function _toLocalQuizQuestion(remoteQuestion, quizMeta, index) {
    const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
    const optionMap = {};
    const optionImages = {};

    if (remoteQuestion?.options && typeof remoteQuestion.options === 'object' && !Array.isArray(remoteQuestion.options)) {
      Object.entries(remoteQuestion.options).forEach(([key, value]) => {
        optionMap[key] = String(value || '').trim();
      });
      const images = remoteQuestion.option_images && typeof remoteQuestion.option_images === 'object'
        ? remoteQuestion.option_images
        : {};
      Object.keys(optionMap).forEach(key => {
        optionImages[key] = String(images[key] || '').trim() || null;
      });
    } else {
      const options = Array.isArray(remoteQuestion?.options)
        ? remoteQuestion.options.map(option => String(option || '').trim())
        : [];
      options.forEach((option, optionIndex) => {
        optionMap[optionKeys[optionIndex] || `O${optionIndex + 1}`] = option;
      });
      const images = Array.isArray(remoteQuestion?.option_images) ? remoteQuestion.option_images : [];
      Object.keys(optionMap).forEach((key, optionIndex) => {
        optionImages[key] = String(images[optionIndex] || '').trim() || null;
      });
    }

    const populatedKeys = Object.keys(optionMap).filter(key => optionMap[key] || optionImages[key]);
    if (populatedKeys.length < 2) return null;

    const rawAnswer = String(remoteQuestion?.answer || '').trim();
    const upperAnswer = rawAnswer.toUpperCase();
    const answerKey = populatedKeys.includes(upperAnswer)
      ? upperAnswer
      : populatedKeys.find(key => optionMap[key] === rawAnswer);
    if (!answerKey) return null;

    const optionValues = populatedKeys.map(key => optionMap[key]);
    const isTrueFalse =
      populatedKeys.length === 2 &&
      optionValues.some(option => /^true$/i.test(option)) &&
      optionValues.some(option => /^false$/i.test(option));

    return {
      q_id      : remoteQuestion.q_id || `${quizMeta.quiz_id}_q_${index + 1}`,
      batch     : quizMeta.batch || '',
      subject   : quizMeta.subject || '',
      chapter   : quizMeta.chapter || '',
      question  : String(remoteQuestion.question || '').trim(),
      options   : optionMap,
      option_images: optionImages,
      answer    : answerKey,
      type      : isTrueFalse ? 'tf' : 'mcq',
      image     : remoteQuestion.image || null,
      source    : 'api',
      synced    : true,
      synced_at : Date.now(),
      difficulty: 'medium',
      tags      : [],
    };
  }

  function _buildFallbackSections(quizId, questions, timerValue = 0) {
    if (!questions.length) return [];

    const uniformType = questions.every(question => question.type === questions[0].type)
      ? questions[0].type
      : 'mcq';

    return [{
      id            : `sec_${quizId}_1`,
      label         : 'Section A',
      type          : uniformType,
      question_ids  : questions.map(question => question.q_id),
      timer         : Number(timerValue || 0) || 0,
      positive_marks: 1,
      negative_marks: 0,
    }];
  }

  async function _cacheRemoteQuiz(remoteQuiz) {
    const localId  = remoteQuiz?.quiz_id || `remote_${remoteQuiz?.id || Date.now()}`;
    const existing = await DB.getQuiz(localId).catch(() => null);
    const remoteQuestions = Array.isArray(remoteQuiz?.questions)
      ? remoteQuiz.questions
          .map((question, index) => _toLocalQuizQuestion(question, remoteQuiz, index))
          .filter(Boolean)
      : [];

    const resolvedQuestions = remoteQuestions.length
      ? remoteQuestions
      : Array.isArray(existing?.questions)
        ? existing.questions
        : [];

    const resolvedSections = Array.isArray(remoteQuiz?.sections) && remoteQuiz.sections.length
      ? remoteQuiz.sections
      : resolvedQuestions.length
        ? _buildFallbackSections(localId, resolvedQuestions, remoteQuiz?.timer_value)
        : Array.isArray(existing?.sections)
          ? existing.sections
          : [];

    return DB.saveQuiz({
      ...(existing || {}),
      quiz_id        : localId,
      title          : remoteQuiz?.title || existing?.title || 'Remote Quiz',
      subject        : remoteQuiz?.subject || existing?.subject || '',
      chapter        : remoteQuiz?.chapter || existing?.chapter || '',
      batch          : remoteQuiz?.batch || existing?.batch || API.REMOTE_BATCH,
      sections       : resolvedSections,
      questions      : resolvedQuestions,
      status         : remoteQuiz?.status || existing?.status || 'published',
      shuffle        : !!remoteQuiz?.shuffle,
      timer_mode     : remoteQuiz?.timer_mode || existing?.timer_mode || 'none',
      timer_value    : Number(remoteQuiz?.timer_value || existing?.timer_value || 0) || 0,
      source         : 'api',
      synced         : true,
      synced_at      : Date.now(),
      backend_id     : remoteQuiz?.quiz_id || remoteQuiz?.id || existing?.backend_id || localId,
      pending_publish: false,
      last_publish_error: '',
      created_at     : remoteQuiz?.created_at || existing?.created_at,
      updated_at     : remoteQuiz?.updated_at || existing?.updated_at,
      version        : remoteQuiz?.version || existing?.version,
    });
  }

  async function _markAttemptState(attempt, patch = {}) {
    if (!attempt) return null;
    const merged = {
      ...attempt,
      ...patch,
    };

    if (!merged.attempt_id) return merged;
    return DB.saveTestAttempt(merged, { queueOnFailure: false }).catch(() => merged);
  }

  async function _doSubmitAttempt(attempt) {
    // Idempotency guard: re-read IDB state; skip if already synced (drain retry race)
    const current = attempt?.attempt_id
      ? await DB.getAttemptsByQuiz(attempt.quiz_id).then(list =>
          list.find(a => a.attempt_id === attempt.attempt_id)
        ).catch(() => null)
      : null;
    if ((current ?? attempt)?.synced === true) {
      return { synced: true, attempt: current || attempt, skipped: true };
    }

    const response = await API.submitAttempt(attempt);
    const storedAttempt = await _markAttemptState(attempt, {
      synced        : true,
      synced_at     : Date.now(),
      pending_sync  : false,
      sync_error    : '',
      backend_result: response?.data || response || null,
    });

    return {
      synced : true,
      attempt: storedAttempt,
      response,
    };
  }

  /**
   * Replay queued operations now that we're online.
   * Each successful item is removed; failed items increment their attempt counter
   * and are removed after MAX_RETRY failures.
   */
  async function _drainQueue() {
    if (!_queueReady) await _initQueue();
    const queue = _loadQueue();
    if (!queue.length) return { drained: 0, remaining: 0 };

    let drained = 0;

    for (const item of queue) {
      if (item.attempts >= MAX_RETRY) {
        console.warn(`SYNC queue: dropping "${item.op}" after ${MAX_RETRY} failures`);
        await DB.removeSyncItem(item.id).catch(() => {});
        continue;
      }

      try {
        if (item.op === 'publishQuiz') {
          const payload = _normalizeQueuePublishPayload(item.payload);
          await _doPublishQuiz(payload.quizId, payload.opts || {});
        } else if (item.op === 'deltaSync') {
          await _doSyncAll();
        } else if (item.op === 'submitAttempt') {
          await _doSubmitAttempt(item.payload);
        }
        await DB.removeSyncItem(item.id).catch(() => {});
        drained++;
      } catch (err) {
        const updated = { ...item, attempts: item.attempts + 1 };
        await DB.updateSyncItem(updated).catch(() => {});
        console.warn(`SYNC queue: "${item.op}" attempt ${updated.attempts} failed — ${err.message}`);
      }
    }

    _queueCache = await DB.getSyncQueue().catch(() => []);
    _notifyStatusListeners();

    if (drained > 0) {
      APP.toast(`${drained} queued item${drained > 1 ? 's' : ''} synced`, 'success');
      if (typeof ADMIN !== 'undefined' && typeof ADMIN.loadQuizList === 'function') {
        Promise.resolve(ADMIN.loadQuizList()).catch(() => {});
      }
      APP.refreshHome().catch(() => {});
    }

    return { drained, remaining: remaining.length };
  }

  // ════════════════════════
  // SET / GET API URL
  // ════════════════════════

  /**
   * Validate and persist a new API server URL.
   * Saves to both localStorage (via API module) and IndexedDB settings.
   *
   * @param   {string} url
   * @returns {string} The normalised URL
   * @throws  {Error}  If url is empty or not a valid absolute URL
   */
  function setApiUrl(url) {
    const clean = _validateUrl(url);
    API.setApiUrl(clean);
    DB.setSetting('api_url', clean).catch(() => {});
    _setStatus(_isOnline() ? 'online' : 'offline');
    return clean;
  }

  /** Return the currently configured API base URL. */
  function getApiUrl() {
    return API.getApiUrl();
  }

  // ════════════════════════
  // PUBLISH QUIZ  (internal)
  // ════════════════════════

  /**
   * Core publish logic — no queue wrapping, called by both the
   * public publishQuiz() and the queue drainer.
   */
  async function _doPublishQuiz(quizOrId, opts = {}) {
    const quiz = await _loadQuizSnapshot(quizOrId);
    if (!quiz) throw new Error(`Quiz "${_getQuizId(quizOrId)}" not found`);

    // Idempotency guard: skip if already synced (queue retry race condition)
    if (quiz.synced === true && quiz.status === 'published' && !opts.force) {
      return {
        synced    : true,
        backend_id: quiz.backend_id || quiz.quiz_id,
        status    : 'published',
        quiz,
        skipped   : true,
      };
    }

    const body  = await _buildPublishPayload(quiz);
    const pin   = opts.pin || String(await DB.getSetting('admin_pin', '1234').catch(() => '1234') || '1234');
    const token = await API.ensureAdminSession(pin);
    const result = await API.request('/quizzes', {
      method : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body   : JSON.stringify(body),
    });

    const response  = result?.data || result || {};
    const backendId = response.quiz_id || result?.quiz_id || response.id || result?.id || quiz.quiz_id;

    const publishedQuiz = await DB.saveQuiz({
      ...quiz,
      status            : 'published',
      synced            : true,
      synced_at         : Date.now(),
      backend_id        : backendId,
      pending_publish   : false,
      last_publish_error: '',
    });

    return {
      synced    : true,
      backend_id: backendId,
      status    : 'published',
      quiz      : publishedQuiz,
      response,
    };
  }

  // ════════════════════════
  // PUBLISH QUIZ  (public)
  // ════════════════════════

  /**
   * Upload a local quiz to the server.
   * When offline, the operation is queued and replayed on reconnect.
   *
   * @param   {Object|string} quizOrId
   * @param   {Object}  [options]
   * @param   {string}  [options.pin]  Admin PIN (defaults to saved setting)
   * @returns {Object}  Server response, or { queued: true } when offline
   */
  async function publishQuiz(quizOrId, options = {}) {
    const quizId = _getQuizId(quizOrId);
    if (!quizId) throw new Error('Quiz must be saved locally before it can be published');

    if (!_isOnline()) {
      const queuedQuiz = await _markQuizQueued(quizOrId);
      await _enqueue('publishQuiz', { quizId, opts: { pin: options.pin } });
      APP.toast('Offline — quiz queued, will sync on reconnect', 'info');
      return {
        queued: true,
        synced: false,
        status: queuedQuiz?.status || 'draft',
        quiz  : queuedQuiz,
      };
    }

    _setStatus('syncing');
    try {
      const result = await _doPublishQuiz(quizOrId, options);
      _setStatus('online');
      return result;
    } catch (err) {
      if (_isNetworkError(err)) {
        const queuedQuiz = await _markQuizQueued(quizOrId);
        _setStatus('offline');
        await _enqueue('publishQuiz', { quizId, opts: { pin: options.pin } });
        APP.toast('Connection lost — quiz queued for sync', 'info');
        return {
          queued: true,
          synced: false,
          status: queuedQuiz?.status || 'draft',
          quiz  : queuedQuiz,
        };
      }
      await _markPublishFailed(quizOrId, err.message);
      _setStatus('online');
      const msg = err.message || 'Publish failed';
      APP.toast(`Publish failed: ${msg}`, 'error');
      throw err;
    }
  }

  async function retryQueue() {
    if (!_isOnline()) {
      _setStatus('offline');
      return { drained: 0, remaining: _loadQueue().length, offline: true };
    }

    _setStatus('syncing');
    try {
      const result = await _drainQueue();
      _setStatus('online');
      return result;
    } catch (err) {
      _setStatus('offline');
      throw err;
    }
  }

  // ════════════════════════
  // SUBMIT ATTEMPT
  // ════════════════════════

  /**
   * Push a finished test attempt to the server.
   * Queued automatically when offline — drained on next sync cycle.
   */
  async function submitAttempt(attempt) {
    if (!_isOnline()) {
      const queuedAttempt = await _markAttemptState(attempt, {
        synced      : false,
        pending_sync: true,
        sync_error  : '',
      });
      await _enqueue('submitAttempt', attempt);
      return { queued: true, attempt: queuedAttempt };
    }
    try {
      return await _doSubmitAttempt(attempt);
    } catch (err) {
      if (_isNetworkError(err)) {
        const queuedAttempt = await _markAttemptState(attempt, {
          synced      : false,
          pending_sync: true,
          sync_error  : '',
        });
        await _enqueue('submitAttempt', attempt);
        return { queued: true, attempt: queuedAttempt };
      }
      await _markAttemptState(attempt, {
        synced      : false,
        pending_sync: false,
        sync_error  : String(err?.message || 'Attempt sync failed'),
      });
      throw err;
    }
  }

  // ════════════════════════
  // FETCH QUIZZES
  // ════════════════════════

  /**
   * Pull published quizzes from the server and upsert them into local DB.
   * Silently skips if the `/quizzes` endpoint returns 404 (not yet implemented).
   *
   * @param   {Object}  [options]
   * @param   {boolean} [options.silent=false]  Suppress console warnings
   * @returns {{ fetched: number }}
   */
  async function fetchQuizzes(options = {}) {
    if (!_isOnline()) return { fetched: 0 };

    let payload;
    const requestedStatus = options.status !== undefined
      ? String(options.status || '').trim().toLowerCase()
      : (API.getAdminToken() ? '' : 'published');
    try {
      if (requestedStatus === 'published') {
        payload = await API.fetchPublishedQuizzes();
      } else {
        const profile = typeof API.getStudentProfile === 'function'
          ? await API.getStudentProfile().catch(() => null)
          : null;
        const adminToken = API.getAdminToken();
        const studentToken = profile?.student_code
          ? await API.ensureStudentSession().catch(() => '')
          : '';
        const token = adminToken || studentToken;
        const query = requestedStatus
          ? `/quizzes?status=${encodeURIComponent(requestedStatus)}`
          : '/quizzes';
        payload = await API.request(query, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
    } catch (err) {
      // 404 means the endpoint isn't live yet — skip silently
      if (/404|not found/i.test(err.message)) return { fetched: 0 };
      if (!options.silent) console.warn('fetchQuizzes:', err.message);
      throw err;
    }

    const remoteList = Array.isArray(payload) ? payload : (payload?.data || []);
    let fetched = 0;
    const seenIds = new Set();

    for (const rq of remoteList) {
      const cachedQuiz = await _cacheRemoteQuiz(rq);
      seenIds.add(cachedQuiz.quiz_id);
      if (cachedQuiz.backend_id) seenIds.add(String(cachedQuiz.backend_id));
      fetched++;
    }

    const cachedQuizzes = await DB.getAllQuizzes().catch(() => []);
    let removed = 0;
    for (const cachedQuiz of cachedQuizzes) {
      if (cachedQuiz?.source !== 'api') continue;

      const localId = String(cachedQuiz.quiz_id || '');
      const backendId = String(cachedQuiz.backend_id || '');
      if (seenIds.has(localId) || (backendId && seenIds.has(backendId))) continue;

      await DB.deleteQuiz(localId);
      removed++;
    }

    return { fetched, removed };
  }

  async function refreshQuiz(quizId, options = {}) {
    const cleanId = String(quizId || '').trim();
    if (!cleanId) throw new Error('Quiz id is required');

    let remoteError = null;
    if (_isOnline() && !options.cacheOnly) {
      try {
        const remoteQuiz = await API.fetchQuizById(cleanId);
        return await _cacheRemoteQuiz(remoteQuiz);
      } catch (err) {
        remoteError = err;
        if (!_isNetworkError(err)) {
          throw err;
        }
      }
    }

    const cachedQuiz = await DB.getQuiz(cleanId).catch(() => null);
    if (cachedQuiz) return cachedQuiz;
    if (remoteError) throw remoteError;
    return null;
  }

  // ════════════════════════
  // FULL SYNC  (internal)
  // ════════════════════════

  /**
   * Runs all three sync streams in parallel.
   * Individual failures are caught and logged but do NOT abort the others.
   */
  async function _doSyncAll(apiUrl) {
    if (apiUrl) setApiUrl(apiUrl);   // throws on invalid URL, intentional

    // Use admin question sync when admin token is present; fall back to student sync
    const questionSync = API.getAdminToken()
      ? API.syncServerQuestions().catch(err => { console.warn('SYNC questions:', err.message); return []; })
      : API.syncStudentQuestions().catch(err => { console.warn('SYNC questions (student):', err.message); return []; });

    const [syncedQ, syncedL, { fetched: syncedQz }] = await Promise.all([
      questionSync,
      API.syncServerLessons()
        .catch(err => { console.warn('SYNC lessons:',   err.message); return []; }),
      fetchQuizzes({ silent: true })
        .catch(err => { console.warn('SYNC quizzes:',   err.message); return { fetched: 0 }; }),
    ]);

    _lastSyncAt = Date.now();
    DB.setSetting('last_sync_at', _lastSyncAt).catch(() => {});

    return { questions: syncedQ, lessons: syncedL, quizzes: syncedQz };
  }

  // ════════════════════════
  // DELTA SYNC  (admin panel)
  // ════════════════════════

  /**
   * Full sync triggered from the admin panel's "Delta Sync" button.
   * Optionally sets a new API URL first.
   *
   * @param {string} [apiUrl]  If provided, validates + saves before syncing
   */
  async function deltaSync(apiUrl) {
    if (!_isOnline()) {
      _setStatus('offline');
      APP.toast('Offline — connect to the internet and retry', 'error');
      return;
    }

    if (apiUrl) {
      try { setApiUrl(apiUrl); }
      catch (err) { APP.toast(err.message, 'error'); return; }
    }

    _setStatus('syncing');
    try {
      const { questions, lessons, quizzes } = await _doSyncAll();
      _setStatus('online');

      const parts = [];
      if (questions.length) parts.push(`${questions.length} question${questions.length !== 1 ? 's' : ''}`);
      if (lessons.length)   parts.push(`${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}`);
      if (quizzes)          parts.push(`${quizzes} quiz${quizzes !== 1 ? 'zes' : ''}`);

      APP.toast(parts.length ? `Synced: ${parts.join(', ')}` : 'Already up to date', 'success');
      APP.refreshHome().catch(() => {});
      return { questions, lessons, quizzes };
    } catch (err) {
      _setStatus('offline');
      APP.toast(`Sync failed: ${err.message}`, 'error');
      throw err;
    }
  }

  // ════════════════════════
  // AUTO-SYNC CYCLE
  // ════════════════════════

  function _runCycle() {
    if (_isSyncing || !_isOnline()) return;
    _isSyncing = true;
    _setStatus('syncing');
    _notifyStatusListeners();

    Promise.resolve()
      .then(() => DB.flushPendingWrites?.())
      .then(result => {
        if (result?.flushed) {
          APP.toast(`${result.flushed} pending local write${result.flushed !== 1 ? 's' : ''} recovered`, 'success');
        }
      })
      .then(() => _drainQueue())
      .then(() => _doSyncAll())
      .then(() => APP.refreshHome().catch(() => {}))
      .catch(err => console.warn('SYNC cycle:', err.message))
      .finally(() => {
        _isSyncing = false;
        _setStatus(_isOnline() ? 'online' : 'offline');
        _notifyStatusListeners();
      });
  }

  function _runStudentCycle() {
    if (_studentSyncing || !_isOnline()) return;
    _studentSyncing = true;
    _setStatus('syncing');

    Promise.resolve()
      .then(() => _drainQueue())
      .then(() => Promise.all([
        fetchQuizzes({ silent: true, status: 'published' }),
        API.syncStudentQuestions().catch(err => {
          console.warn('SYNC questions (student cycle):', err.message);
          return [];
        }),
      ]))
      .then(() => {
        if (typeof APP !== 'undefined' && typeof APP.refreshHome === 'function') {
          return Promise.resolve(APP.refreshHome()).catch(() => {});
        }
        return null;
      })
      .catch(err => console.warn('SYNC student cycle:', err.message))
      .finally(() => {
        _studentSyncing = false;
        _setStatus(_isOnline() ? 'online' : 'offline');
      });
  }

  // ════════════════════════
  // AUTO-SYNC  (public entry point)
  // ════════════════════════

  /**
   * Called once by app.js on startup.
   * Restores the saved API URL, sets up periodic sync, and wires
   * the online/offline events exactly once.
   */
  async function autoSync() {
    await _initQueue();   // migrate localStorage queue → IDB, warm cache

    // Restore persisted API URL — ignore stale localhost URLs on Capacitor native
    const savedUrl = await DB.getSetting('api_url', '').catch(() => '');
    const isNative = !!(window.Capacitor?.isNativePlatform?.() || (window.location?.protocol === 'https:' && window.location?.hostname === 'localhost'));
    const isStaleLocal = isNative && /localhost|127\.0\.0\.1/.test(savedUrl);
    try { setApiUrl((!isStaleLocal && savedUrl) || API.DEFAULT_API_URL); } catch { /* ignore stale bad URL */ }

    _lastSyncAt = Number(await DB.getSetting('last_sync_at', 0).catch(() => 0)) || 0;

    _setStatus(_isOnline() ? 'online' : 'offline');

    // Start the repeating interval
    startAutoSync();

    // Wire online/offline exactly once; debounce rapid on/off/on flapping
    if (!_onlineWired) {
      _onlineWired = true;
      window.addEventListener('online', () => {
        _setStatus('online');
        clearTimeout(_onlineDebounce);
        _onlineDebounce = setTimeout(_runCycle, 2500);
      });
      window.addEventListener('offline', () => {
        clearTimeout(_onlineDebounce);
        _setStatus('offline');
        _notifyStatusListeners();
      });
    }

    // Fire an immediate background cycle without blocking app startup
    if (_isOnline()) {
      setTimeout(_runCycle, 0);
    }
  }

  async function autoSyncStudent() {
    await _initQueue();

    const savedUrl = await DB.getSetting('api_url', '').catch(() => '');
    const isNative2 = !!(window.Capacitor?.isNativePlatform?.() || (window.location?.protocol === 'https:' && window.location?.hostname === 'localhost'));
    const isStaleLocal2 = isNative2 && /localhost|127\.0\.0\.1/.test(savedUrl);
    try { setApiUrl((!isStaleLocal2 && savedUrl) || API.DEFAULT_API_URL); } catch {}

    _setStatus(_isOnline() ? 'online' : 'offline');

    startStudentAutoSync();

    if (!_studentOnlineWired) {
      _studentOnlineWired = true;
      window.addEventListener('online', () => {
        _setStatus('online');
        clearTimeout(_onlineDebounce);
        _onlineDebounce = setTimeout(_runStudentCycle, 2500);
      });
      window.addEventListener('offline', () => {
        clearTimeout(_onlineDebounce);
        _setStatus('offline');
      });
    }

    if (_isOnline()) {
      setTimeout(_runStudentCycle, 0);
    }
  }

  // ════════════════════════
  // INTERVAL MANAGEMENT
  // ════════════════════════

  function startAutoSync() {
    if (_autoInterval) return;
    _autoInterval = setInterval(_runCycle, AUTO_MS);
  }

  function stopAutoSync() {
    if (_autoInterval) { clearInterval(_autoInterval); _autoInterval = null; }
  }

  function startStudentAutoSync() {
    if (_studentAutoInterval) return;
    _studentAutoInterval = setInterval(_runStudentCycle, STUDENT_AUTO_MS);
  }

  function stopStudentAutoSync() {
    if (_studentAutoInterval) {
      clearInterval(_studentAutoInterval);
      _studentAutoInterval = null;
    }
  }

  // ════════════════════════
  // LEGACY ALIAS
  // ════════════════════════

  /** @deprecated  Use autoSync() — kept so older callers don't break. */
  async function preloadRemoteQuiz() {
    return autoSync();
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  function getSyncStatus() {
    return _buildSyncStatus();
  }

  function onSyncStatusChange(cb) {
    if (typeof cb === 'function' && !_statusListeners.includes(cb)) {
      _statusListeners.push(cb);
    }
    return () => { _statusListeners = _statusListeners.filter(l => l !== cb); };
  }

  return {
    // Configuration
    setApiUrl,
    getApiUrl,

    // Quiz sync
    publishQuiz,
    retryQueue,
    fetchQuizzes,
    refreshQuiz,

    // Attempt sync
    submitAttempt,

    // Full sync
    deltaSync,

    // Lifecycle
    autoSync,
    autoSyncStudent,
    startAutoSync,
    stopAutoSync,
    startStudentAutoSync,
    stopStudentAutoSync,

    // Sync status
    getSyncStatus,
    onSyncStatusChange,

    // Legacy
    preloadRemoteQuiz,
  };

})();

window.SYNC = SYNC;
