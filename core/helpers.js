/* ════════════════════════════════════════
   helpers.js — API & Backend Wiring
   Handles: auth tokens, fetch wrapper,
            question/lesson sync helpers
   Global: API
════════════════════════════════════════ */

const API = (() => {
  const DEFAULT_RENDER_API_URL = 'https://teachingboard-backend.onrender.com/api';
  const DEFAULT_API_URL   = resolveDefaultApiUrl();
  const ADMIN_TOKEN_KEY   = 'teachingboard_admin_token';
  const STUDENT_TOKEN_KEY = 'teachingboard_student_token';
  const EXPIRED_STATE_KEY = 'teachingboard_expired_state';
  const REMOTE_BATCH      = 'Live Server';
  const REMOTE_SUBJECT    = 'General';
  const REMOTE_CHAPTER    = 'Online Quiz';

  function isCapacitorNative() {
    // Capacitor injects window.Capacitor before JS runs
    if (window.Capacitor?.isNativePlatform?.()) return true;
    // Fallback: Capacitor androidScheme:'https' serves from https://localhost
    if (window.location?.protocol === 'https:' && window.location?.hostname === 'localhost') return true;
    return false;
  }

  function resolveDefaultApiUrl() {
    const runtimeUrl = String(window.TEACHINGBOARD_API_URL || '').trim();
    const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location?.hostname || '');
    const sameOriginUrl = window.location?.origin && !/^file:$/i.test(window.location?.protocol || '')
      ? `${window.location.origin}/api`
      : '';

    if (runtimeUrl) {
      return runtimeUrl.replace(/\/+$/, '');
    }

    // Capacitor Android/iOS: https://localhost is WebView host, not a real local server
    if (isCapacitorNative()) {
      return DEFAULT_RENDER_API_URL.replace(/\/+$/, '');
    }

    if (isLocalHost) {
      return 'http://localhost:4000/api';
    }

    if (window.location?.origin === 'https://teachingboard-backend.onrender.com') {
      return sameOriginUrl.replace(/\/+$/, '');
    }

    return DEFAULT_RENDER_API_URL.replace(/\/+$/, '');
  }

  // ════════════════════════
  // URL / TOKEN MANAGEMENT
  // ════════════════════════

  function getApiUrl() {
    const saved = localStorage.getItem('teachingboard_api_url');
    // On Capacitor native, ignore stale localhost URLs saved from dev builds
    if (saved && /localhost|127\.0\.0\.1/.test(saved) && isCapacitorNative()) {
      localStorage.removeItem('teachingboard_api_url');
      return DEFAULT_API_URL.replace(/\/+$/, '');
    }
    return (saved || DEFAULT_API_URL).replace(/\/+$/, '');
  }

  function setApiUrl(url) {
    const clean = String(url || '').trim().replace(/\/+$/, '');
    if (!clean) return;
    localStorage.setItem('teachingboard_api_url', clean);
  }

  function getAdminToken()   { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
  function getStudentToken() { return localStorage.getItem(STUDENT_TOKEN_KEY) || ''; }

  function setAdminToken(token)   { if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token); }
  function setStudentToken(token) { if (token) localStorage.setItem(STUDENT_TOKEN_KEY, token); }

  function clearAdminToken()   { localStorage.removeItem(ADMIN_TOKEN_KEY); }
  function clearStudentToken() { localStorage.removeItem(STUDENT_TOKEN_KEY); }

  function getExpiredState() {
    try { return JSON.parse(localStorage.getItem(EXPIRED_STATE_KEY) || 'null'); }
    catch { return null; }
  }

  function isExpiredLocally() { return !!getExpiredState(); }
  function clearExpiredState() { localStorage.removeItem(EXPIRED_STATE_KEY); }

  function _decodeTokenPayload(token) {
    try {
      const [encodedPayload] = String(token || '').split('.');
      if (!encodedPayload) return null;

      const normalized = encodedPayload
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
      return JSON.parse(atob(normalized + padding));
    } catch {
      return null;
    }
  }

  function _isTokenExpired(token, skewSeconds = 30) {
    const payload = _decodeTokenPayload(token);
    if (!payload?.exp) return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
  }

  function _getAuthHeader(headers = {}) {
    return headers.Authorization || headers.authorization || '';
  }

  async function _resolveAdminPin(pin) {
    const savedPin = String(await DB.getSetting('admin_pin', '1234').catch(() => '1234') || '1234').trim() || '1234';
    const preferredPin = String(pin || '').trim();
    if (preferredPin && (preferredPin !== '1234' || savedPin === '1234')) {
      return preferredPin;
    }
    return savedPin || preferredPin || '1234';
  }

  async function _resolveStudentName(name) {
    const preferredName = String(name || '').trim();
    if (preferredName) return preferredName;
    return String(await DB.getSetting('student_name', '').catch(() => '') || '').trim();
  }

  function markExpired(message, expiryDate = '') {
    const payload = { message: message || 'Account expired', expiryDate, at: Date.now() };
    clearAdminToken();
    clearStudentToken();
    localStorage.setItem(EXPIRED_STATE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('teachingboard:expired', { detail: payload }));
  }

  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function safeFetch(url, options = {}, retries = 3) {
    try {
      const response = await fetch(url, options);
      if (retries > 0 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
        await _sleep((4 - retries) * 250);
        return safeFetch(url, options, retries - 1);
      }
      return response;
    } catch (err) {
      if (retries > 0) {
        await _sleep((4 - retries) * 250);
        return safeFetch(url, options, retries - 1);
      }
      throw err;
    }
  }

  // ════════════════════════
  // FETCH WRAPPER
  // ════════════════════════

  async function _refreshSessionForToken(token) {
    const payload = _decodeTokenPayload(token);
    if (!payload?.role) return '';

    if (payload.role === 'admin') {
      clearAdminToken();
      const adminPin = await _resolveAdminPin();
      const loginPayload = await loginAdmin(adminPin);
      return loginPayload?.token || '';
    }

    if (payload.role === 'student') {
      clearStudentToken();
      const studentName = await _resolveStudentName(payload.name);
      if (!studentName) return '';
      const loginPayload = await loginStudent(studentName);
      return loginPayload?.token || '';
    }

    return '';
  }

  async function request(path, options = {}, authRetry = true) {
    const url     = `${getApiUrl()}${path}`;
    const headers = { ...(options.headers || {}) };
    if (!headers['Content-Type'] && options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await safeFetch(url, { ...options, headers });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }

    if (response.status === 401 && authRetry && path !== '/auth/login') {
      const authHeader = _getAuthHeader(headers);
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

      if (token) {
        try {
          const refreshedToken = await _refreshSessionForToken(token);
          if (refreshedToken) {
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${refreshedToken}`,
            };
            delete retryHeaders.authorization;
            return request(path, { ...options, headers: retryHeaders }, false);
          }
        } catch {
          // Fall through to the original 401 below.
        }
      }
    }

    if (!response.ok) {
      if (response.status === 403 && payload?.code === 'ACCOUNT_EXPIRED') {
        markExpired(payload.message, payload.expiryDate);
      }
      throw new Error(payload?.message || `Request failed: ${response.status}`);
    }
    return payload;
  }

  // ════════════════════════
  // AUTH
  // ════════════════════════

  async function loginAdmin(pin) {
    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin', pin }),
    });
    clearExpiredState();
    if (payload?.token) setAdminToken(payload.token);
    return payload;
  }

  async function loginStudent(name) {
    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'student', name }),
    });
    clearExpiredState();
    if (payload?.token) setStudentToken(payload.token);
    return payload;
  }

  async function ensureAdminSession(pin = '') {
    const existing = getAdminToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearAdminToken();

    const payload = await loginAdmin(await _resolveAdminPin(pin));
    return payload.token;
  }

  async function ensureStudentSession(name = '') {
    const existing = getStudentToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearStudentToken();

    const payload = await loginStudent(await _resolveStudentName(name));
    return payload.token;
  }

  // ════════════════════════
  // DATA MAPPERS
  // ════════════════════════

  function backendAnswerToFrontend(answer) {
    const map = { option1: 'A', option2: 'B', option3: 'C', option4: 'D' };
    return map[String(answer || '').trim()] || 'A';
  }

  function frontendAnswerToBackend(answer) {
    const map = {
      A: 'option1', B: 'option2', C: 'option3', D: 'option4',
      option1: 'option1', option2: 'option2', option3: 'option3', option4: 'option4',
    };
    return map[String(answer || '').trim()] || 'option1';
  }

  function normalizeOptionImages(optionImages = {}) {
    if (!optionImages || typeof optionImages !== 'object') {
      return { A: null, B: null, C: null, D: null };
    }
    return {
      A: String(optionImages.A || '').trim() || null,
      B: String(optionImages.B || '').trim() || null,
      C: String(optionImages.C || '').trim() || null,
      D: String(optionImages.D || '').trim() || null,
    };
  }

  function normalizeBackendOptionImages(question = {}) {
    if (Array.isArray(question.option_images)) {
      return {
        A: String(question.option_images[0] || '').trim() || null,
        B: String(question.option_images[1] || '').trim() || null,
        C: String(question.option_images[2] || '').trim() || null,
        D: String(question.option_images[3] || '').trim() || null,
      };
    }
    return normalizeOptionImages(question.option_images);
  }

  function toFrontendQuestion(question, meta = {}) {
    const type = (['mcq','tf','fib','mtp'].includes(question.type) ? question.type : 'mcq');
    const base = {
      q_id      : meta.q_id || question.q_id || `api_${question.id}`,
      backend_id: question.id || question._id || question.q_id || null,
      batch     : meta.batch      || question.batch      || REMOTE_BATCH,
      subject   : meta.subject    || question.subject    || REMOTE_SUBJECT,
      chapter   : meta.chapter    || question.chapter    || REMOTE_CHAPTER,
      question  : question.question,
      difficulty: meta.difficulty || question.difficulty || 'medium',
      type,
      tags      : question.tags   || [],
      image     : question.image  || null,
      option_images: normalizeBackendOptionImages(question),
      source    : 'api',
      synced_at : Date.now(),
    };

    if (type === 'mcq') {
      if (question.options && typeof question.options === 'object' && !Array.isArray(question.options)) {
        base.options = {
          A: question.options.A || '',
          B: question.options.B || '',
          C: question.options.C || '',
          D: question.options.D || '',
        };
        const normalizedAnswer = String(question.answer || '').trim().toUpperCase();
        base.answer = ['A', 'B', 'C', 'D'].includes(normalizedAnswer)
          ? normalizedAnswer
          : backendAnswerToFrontend(question.answer);
      } else {
        base.options = { A: question.option1 || '', B: question.option2 || '', C: question.option3 || '', D: question.option4 || '' };
        base.answer  = backendAnswerToFrontend(question.answer);
      }
    } else if (type === 'tf') {
      base.options = { A: 'True', B: 'False' };
      base.answer  = question.answer || 'True';
    } else if (type === 'fib') {
      base.answer  = question.answer || '';
    } else if (type === 'mtp') {
      base.pairs   = question.pairs || [];
      base.answer  = question.answer || '';
    }

    return base;
  }

  function toBackendQuestion(question) {
    const type = question.type || 'mcq';
    const base = {
      question  : question.question,
      type,
      difficulty: question.difficulty || 'medium',
      batch     : question.batch      || '',
      subject   : question.subject    || '',
      chapter   : question.chapter    || '',
      tags      : question.tags       || [],
      image     : question.image      || null,
      option_images: normalizeOptionImages(question.option_images),
    };

    if (type === 'mcq') {
      base.options = {
        A: question.options?.A || '',
        B: question.options?.B || '',
        C: question.options?.C || '',
        D: question.options?.D || '',
      };
      base.option1 = question.options?.A || '';
      base.option2 = question.options?.B || '';
      base.option3 = question.options?.C || '';
      base.option4 = question.options?.D || '';
      base.option1_image = base.option_images.A;
      base.option2_image = base.option_images.B;
      base.option3_image = base.option_images.C;
      base.option4_image = base.option_images.D;
      base.answer  = question.answer || 'A';
    } else if (type === 'tf') {
      base.options = { A: 'True', B: 'False' };
      base.option1 = 'True';
      base.option2 = 'False';
      base.answer  = question.answer || 'True';
    } else if (type === 'fib') {
      base.answer  = question.answer || '';
    } else if (type === 'mtp') {
      base.pairs   = question.pairs || [];
      base.answer  = question.answer || '';
    }

    return base;
  }

  function normalizeLessonContent(content) {
    if (content && typeof content === 'object') return content;
    return { body: String(content || '').trim() };
  }

  function _toBackendSubmittedAnswer(question, givenAnswer) {
    if (givenAnswer === undefined || givenAnswer === null) return '';

    const normalizedGiven = String(givenAnswer).trim();
    if (!normalizedGiven) return '';

    if (question?.type === 'fib') {
      return normalizedGiven;
    }

    if (question?.options && typeof question.options === 'object' && !Array.isArray(question.options)) {
      return String(question.options[normalizedGiven] || normalizedGiven).trim();
    }

    return normalizedGiven;
  }

  // ════════════════════════
  // FETCH ENDPOINTS
  // ════════════════════════

  async function fetchQuiz(limit = 20) {
    const studentName = String(await DB.getSetting('student_name', '') || '').trim();
    const token       = studentName ? await ensureStudentSession(studentName) : '';
    const query       = studentName
      ? `/quiz?limit=${limit}&studentName=${encodeURIComponent(studentName)}`
      : `/quiz?limit=${limit}`;
    const payload = await request(query, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchPublishedQuizzes() {
    const studentName = String(await DB.getSetting('student_name', '') || '').trim();
    const token       = studentName ? await ensureStudentSession(studentName).catch(() => '') : '';
    const payload = await request('/quizzes?status=published', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchQuizById(quizId) {
    const cleanId = String(quizId || '').trim();
    if (!cleanId) throw new Error('quiz id is required');

    const studentName = String(await DB.getSetting('student_name', '') || '').trim();
    const token       = studentName ? await ensureStudentSession(studentName).catch(() => '') : '';
    const payload = await request(`/quizzes/${encodeURIComponent(cleanId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || null;
  }

  async function fetchLessons(limit = 50) {
    const studentName = String(await DB.getSetting('student_name', '') || '').trim();
    const token       = studentName ? await ensureStudentSession(studentName) : '';
    const query       = studentName
      ? `/lessons?limit=${limit}&studentName=${encodeURIComponent(studentName)}`
      : `/lessons?limit=${limit}`;
    const payload = await request(query, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchQuestions(pin = '1234') {
    const token   = await ensureAdminSession(pin);
    const payload = await request('/questions', { headers: { Authorization: `Bearer ${token}` } });
    return payload?.data || [];
  }

  // ════════════════════════
  // WRITE ENDPOINTS
  // ════════════════════════

  async function addQuestion(question, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(toBackendQuestion(question)),
    });
  }

  async function updateQuestion(backendId, question, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request(`/questions/${backendId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(toBackendQuestion(question)),
    });
  }

  async function deleteQuestion(backendId, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request(`/questions/${backendId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function deleteQuiz(backendId, pin = '1234') {
    const token = await ensureAdminSession(pin);
    const rawId = String(backendId || '').trim();
    if (!rawId) throw new Error('quiz id is required');
    const cleanId = encodeURIComponent(rawId);
    return request(`/quizzes/${cleanId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function createLesson(lesson, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request('/lessons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title  : String(lesson.title || '').trim(),
        content: normalizeLessonContent(lesson.content),
      }),
    });
  }

  async function updateLesson(lessonId, lesson, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request(`/lessons/${lessonId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title  : String(lesson.title || '').trim(),
        content: normalizeLessonContent(lesson.content),
      }),
    });
  }

  async function deleteLesson(lessonId, pin = '1234') {
    const token = await ensureAdminSession(pin);
    return request(`/lessons/${lessonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function submitQuiz(studentName, answers) {
    const token = studentName ? await ensureStudentSession(studentName) : '';
    return request('/submit', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ studentName, answers }),
    });
  }

  async function submitAttempt(attempt) {
    const studentName = attempt.student_name || String(await DB.getSetting('student_name', '') || '').trim();
    const token = studentName ? await ensureStudentSession(studentName) : '';

    const cachedQuiz = attempt.quiz_id ? await DB.getQuiz(attempt.quiz_id).catch(() => null) : null;
    const quizQuestions = Array.isArray(cachedQuiz?.questions) ? cachedQuiz.questions : [];
    const questionMap = new Map(quizQuestions.map(question => [question.q_id, question]));
    const answers = Array.isArray(attempt.answers)
      ? attempt.answers.map(answer => {
          const question = questionMap.get(answer.q_id);
          return {
            q_id            : answer.q_id,
            submitted_answer: _toBackendSubmittedAnswer(question, answer.given),
          };
        })
      : [];

    return request('/attempts', {
      method : 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body   : JSON.stringify({
        quiz_id     : attempt.quiz_id,
        student_name: studentName,
        answers,
      }),
    });
  }

  async function fetchAttempts({ quiz_id, student_name, batch } = {}) {
    const token = await ensureAdminSession().catch(() => '');
    const params = new URLSearchParams();
    if (quiz_id)      params.set('quiz_id',      quiz_id);
    if (student_name) params.set('student_name', student_name);
    if (batch)        params.set('batch',        batch);
    const query   = `/attempts${params.toString() ? '?' + params.toString() : ''}`;
    const payload = await request(query, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  // ════════════════════════
  // CACHE HELPERS
  // ════════════════════════

  async function ensureRemoteBatch() {
    const batches  = await DB.getAllBatches();
    const existing = batches.find(b => b.name === REMOTE_BATCH);
    if (existing) return existing;
    const remoteBatch = { name: REMOTE_BATCH, icon: '☁️', color: '#f0883e' };
    await DB.saveBatch(remoteBatch);
    const updated = await DB.getAllBatches();
    return updated.find(b => b.name === REMOTE_BATCH) || remoteBatch;
  }

  async function cacheQuizQuestions(questions, meta = {}) {
    await ensureRemoteBatch();
    const normalized = questions.map(q => toFrontendQuestion(q, meta));
    if (!normalized.length) return [];
    if (DB.saveQuestionsBatch) await DB.saveQuestionsBatch(normalized);
    else await Promise.all(normalized.map(q => DB.saveQuestion(q)));
    return normalized;
  }

  async function cacheLessons(lessons = []) {
    const normalized = lessons.map(l => ({
      id        : l.id,
      title     : l.title,
      content   : normalizeLessonContent(l.content),
      created_at: l.created_at || new Date().toISOString(),
      updated_at: l.updated_at || l.created_at || new Date().toISOString(),
      source    : 'api',
    }));
    if (normalized.length) await DB.saveLessons(normalized);
    return normalized;
  }

  async function syncServerQuestions(pin = '1234') {
    const questions = await fetchQuestions(pin);
    return cacheQuizQuestions(questions);
  }

  async function syncStudentQuestions() {
    const studentName = String(await DB.getSetting('student_name', '') || '').trim();
    if (!studentName) return [];
    const token   = await ensureStudentSession(studentName).catch(() => '');
    if (!token) return [];
    const payload = await request('/questions', { headers: { Authorization: `Bearer ${token}` } });
    const rows    = payload?.data || [];
    return cacheQuizQuestions(rows);
  }

  async function syncServerLessons() {
    const lessons = await fetchLessons();
    return cacheLessons(lessons);
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return {
    DEFAULT_API_URL, REMOTE_BATCH, REMOTE_SUBJECT, REMOTE_CHAPTER,
    getApiUrl, setApiUrl,
    getAdminToken, getStudentToken, clearAdminToken, clearStudentToken,
    getExpiredState, isExpiredLocally, clearExpiredState, markExpired,
    loginAdmin, loginStudent, ensureAdminSession, ensureStudentSession,
    fetchQuiz, fetchPublishedQuizzes, fetchQuizById, fetchLessons, fetchQuestions, fetchAttempts,
    addQuestion, updateQuestion, deleteQuestion, deleteQuiz,
    createLesson, updateLesson, deleteLesson,
    submitQuiz, submitAttempt,
    request,
    safeFetch,
    toFrontendQuestion, toBackendQuestion,
    cacheQuizQuestions, cacheLessons,
    syncServerQuestions, syncStudentQuestions, syncServerLessons,
  };
})();

window.API = API;
