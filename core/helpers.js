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
  const TEACHER_TOKEN_KEY = 'teachingboard_teacher_token';
  const PARENT_TOKEN_KEY  = 'teachingboard_parent_token';
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
  function getTeacherToken() { return localStorage.getItem(TEACHER_TOKEN_KEY) || ''; }
  function getParentToken()  { return localStorage.getItem(PARENT_TOKEN_KEY) || ''; }

  function setAdminToken(token)   { if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token); }
  function setStudentToken(token) { if (token) localStorage.setItem(STUDENT_TOKEN_KEY, token); }
  function setTeacherToken(token) { if (token) localStorage.setItem(TEACHER_TOKEN_KEY, token); }
  function setParentToken(token)  { if (token) localStorage.setItem(PARENT_TOKEN_KEY, token); }

  function clearAdminToken()   { localStorage.removeItem(ADMIN_TOKEN_KEY); }
  function clearStudentToken() { localStorage.removeItem(STUDENT_TOKEN_KEY); }
  function clearTeacherToken() { localStorage.removeItem(TEACHER_TOKEN_KEY); }
  function clearParentToken()  { localStorage.removeItem(PARENT_TOKEN_KEY); }

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
    const savedPin = String(await DB.getSetting('admin_pin', '').catch(() => '') || '').trim();
    const preferredPin = String(pin || '').trim();
    const resolved = preferredPin || savedPin;
    if (!resolved) throw new Error('Admin PIN not set — please log in first');
    return resolved;
  }

  async function _resolveStudentCredentials(input = {}) {
    const source = input && typeof input === 'object'
      ? input
      : { student_code: input };

    const preferredCode = String(source.student_code || source.studentCode || '').trim().toUpperCase();
    const preferredPin  = String(source.pin || '').trim();
    const savedCode     = String(await DB.getSetting('student_code', '').catch(() => '') || '').trim().toUpperCase();
    const savedPin      = String(await DB.getSetting('student_pin', '').catch(() => '') || '').trim();

    return {
      student_code: preferredCode || savedCode,
      pin: preferredPin || savedPin,
    };
  }

  async function _storeStudentProfile(user = {}, credentials = {}) {
    const studentCode = String(user.student_code || credentials.student_code || '').trim().toUpperCase();
    const profile = {
      id: user.id || '',
      name: String(user.name || '').trim(),
      student_code: studentCode,
      mobile: String(user.mobile || '').trim(),
      status: String(user.status || 'active').trim(),
      assigned_batches: Array.isArray(user.assigned_batches)
        ? [...new Set(user.assigned_batches.map(item => String(item || '').trim()).filter(Boolean))]
        : [],
      expiry_date: String(user.expiry_date || '').trim(),
    };

    await Promise.all([
      DB.setSetting('student_profile', profile).catch(() => {}),
      DB.setSetting('student_name', profile.name).catch(() => {}),
      DB.setSetting('student_code', profile.student_code).catch(() => {}),
      DB.setSetting('student_allowed_batches', profile.assigned_batches).catch(() => {}),
    ]);
  }

  async function getStudentProfile() {
    return await DB.getSetting('student_profile', null).catch(() => null);
  }

  async function clearStudentProfile() {
    await Promise.all([
      DB.setSetting('student_profile', null).catch(() => {}),
      DB.setSetting('student_name', '').catch(() => {}),
      DB.setSetting('student_code', '').catch(() => {}),
      DB.setSetting('student_pin', '').catch(() => {}),
      DB.setSetting('student_allowed_batches', []).catch(() => {}),
    ]);
  }

  async function _storeTeacherProfile(user = {}, credentials = {}) {
    const profile = {
      id: user.id || '',
      name: String(user.name || '').trim(),
      teacher_code: String(user.teacher_code || credentials.teacher_code || '').trim().toUpperCase(),
      mobile: String(user.mobile || '').trim(),
      assigned_students: Array.isArray(user.assigned_students) ? user.assigned_students : [],
    };
    await Promise.all([
      DB.setSetting('teacher_profile', profile).catch(() => {}),
      DB.setSetting('teacher_code', profile.teacher_code).catch(() => {}),
    ]);
    return profile;
  }

  async function getTeacherProfile() {
    return await DB.getSetting('teacher_profile', null).catch(() => null);
  }

  async function clearTeacherProfile() {
    await Promise.all([
      DB.setSetting('teacher_profile', null).catch(() => {}),
      DB.setSetting('teacher_code', '').catch(() => {}),
      DB.setSetting('teacher_pin', '').catch(() => {}),
    ]);
  }

  async function _storeParentProfile(user = {}, credentials = {}) {
    const profile = {
      id: user.id || '',
      name: String(user.name || '').trim(),
      parent_code: String(user.parent_code || credentials.parent_code || '').trim().toUpperCase(),
      mobile: String(user.mobile || '').trim(),
      children: Array.isArray(user.children) ? user.children : [],
    };
    await Promise.all([
      DB.setSetting('parent_profile', profile).catch(() => {}),
      DB.setSetting('parent_code', profile.parent_code).catch(() => {}),
    ]);
    return profile;
  }

  async function getParentProfile() {
    return await DB.getSetting('parent_profile', null).catch(() => null);
  }

  async function clearParentProfile() {
    await Promise.all([
      DB.setSetting('parent_profile', null).catch(() => {}),
      DB.setSetting('parent_code', '').catch(() => {}),
      DB.setSetting('parent_pin', '').catch(() => {}),
    ]);
  }

  function markExpired(message, expiryDate = '') {
    const payload = { message: message || 'Account expired', expiryDate, at: Date.now() };
    clearAdminToken();
    clearStudentToken();
    clearTeacherToken();
    clearParentToken();
    localStorage.setItem(EXPIRED_STATE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('teachingboard:expired', { detail: payload }));
    DB.setSetting('student_profile', null).catch(() => {});
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
      const loginPayload = await loginStudent({ student_code: payload.student_code || '' });
      return loginPayload?.token || '';
    }

    if (payload.role === 'teacher') {
      clearTeacherToken();
      const savedPin = String(await DB.getSetting('teacher_pin', '').catch(() => '') || '').trim();
      if (!savedPin) return '';
      const loginPayload = await loginTeacher(payload.teacher_code || '', savedPin);
      return loginPayload?.token || '';
    }

    if (payload.role === 'parent') {
      clearParentToken();
      const savedPin = String(await DB.getSetting('parent_pin', '').catch(() => '') || '').trim();
      if (!savedPin) return '';
      const loginPayload = await loginParent(payload.parent_code || '', savedPin);
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
      } else if (response.status === 403 && ['ACCOUNT_BLOCKED', 'ACCOUNT_PENDING'].includes(payload?.code)) {
        clearStudentToken();
      } else if (response.status === 401 && path !== '/auth/login') {
        window.dispatchEvent(new CustomEvent('teachingboard:unauthorized', { detail: { path } }));
      }
      const err = new Error(payload?.message || `Request failed: ${response.status}`);
      if (payload?.code) err.code = payload.code;
      throw err;
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

  async function loginStudent(input = {}) {
    const credentials = await _resolveStudentCredentials(input);
    if (!credentials.student_code) throw new Error('Student code is required');
    if (!credentials.pin) throw new Error('Student PIN is required');

    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'student', student_code: credentials.student_code, pin: credentials.pin, device_id: input.device_id || '' }),
    });
    clearExpiredState();
    if (payload?.token) setStudentToken(payload.token);
    await Promise.all([
      DB.setSetting('student_pin', credentials.pin).catch(() => {}),
      _storeStudentProfile(payload?.user || {}, credentials),
    ]);
    return payload;
  }

  async function ensureAdminSession(pin = '') {
    const existing = getAdminToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearAdminToken();

    const payload = await loginAdmin(await _resolveAdminPin(pin));
    return payload.token;
  }

  async function ensureStudentSession(input = {}) {
    const existing = getStudentToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearStudentToken();

    const payload = await loginStudent(input);
    return payload.token;
  }

  async function fetchStudentMe() {
    const token = await ensureStudentSession();
    const payload = await request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (payload?.user) {
      await _storeStudentProfile(payload.user);
    }
    return payload?.user || null;
  }

  async function loginTeacher(teacher_code, pin) {
    const code = String(teacher_code || '').trim().toUpperCase();
    const p    = String(pin || '').trim();
    if (!code) throw new Error('Teacher code is required');
    if (!p)    throw new Error('Teacher PIN is required');

    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'teacher', teacher_code: code, pin: p }),
    });
    if (payload?.token) setTeacherToken(payload.token);
    await Promise.all([
      DB.setSetting('teacher_pin', p).catch(() => {}),
      _storeTeacherProfile(payload?.user || {}, { teacher_code: code }),
    ]);
    return payload;
  }

  async function loginParent(parent_code, pin) {
    const code = String(parent_code || '').trim().toUpperCase();
    const p    = String(pin || '').trim();
    if (!code) throw new Error('Parent code is required');
    if (!p)    throw new Error('Parent PIN is required');

    const payload = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'parent', parent_code: code, pin: p }),
    });
    if (payload?.token) setParentToken(payload.token);
    await Promise.all([
      DB.setSetting('parent_pin', p).catch(() => {}),
      _storeParentProfile(payload?.user || {}, { parent_code: code }),
    ]);
    return payload;
  }

  async function ensureTeacherSession() {
    const existing = getTeacherToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearTeacherToken();
    const profile = await getTeacherProfile().catch(() => null);
    const code    = String(profile?.teacher_code || '').trim();
    const pin     = String(await DB.getSetting('teacher_pin', '').catch(() => '') || '').trim();
    if (!code || !pin) throw new Error('Teacher session expired — please log in again');
    const payload = await loginTeacher(code, pin);
    return payload.token;
  }

  async function ensureParentSession() {
    const existing = getParentToken();
    if (existing && !_isTokenExpired(existing)) return existing;
    clearParentToken();
    const profile = await getParentProfile().catch(() => null);
    const code    = String(profile?.parent_code || '').trim();
    const pin     = String(await DB.getSetting('parent_pin', '').catch(() => '') || '').trim();
    if (!code || !pin) throw new Error('Parent session expired — please log in again');
    const payload = await loginParent(code, pin);
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
      // '' means "explicitly unlinked from a deleted batch" (server's
      // intentional unlink-don't-delete design) — that must stay empty, not
      // fall back to REMOTE_BATCH. Only missing (undefined/null) fields —
      // truly legacy questions that never had one — get the fallback.
      batch     : meta.batch      ?? question.batch      ?? REMOTE_BATCH,
      subject   : meta.subject    ?? question.subject    ?? REMOTE_SUBJECT,
      chapter   : meta.chapter    ?? question.chapter    ?? REMOTE_CHAPTER,
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
    const profile = await getStudentProfile();
    const token   = profile?.student_code ? await ensureStudentSession().catch(() => '') : '';
    const query   = `/questions?limit=${limit}`;
    const payload = await request(query, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchPublishedQuizzes() {
    const profile = await getStudentProfile();
    const token   = profile?.student_code ? await ensureStudentSession().catch(() => '') : '';
    const payload = await request('/quizzes?status=published', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchQuizById(quizId) {
    const cleanId = String(quizId || '').trim();
    if (!cleanId) throw new Error('quiz id is required');

    const profile = await getStudentProfile();
    const token   = profile?.student_code ? await ensureStudentSession().catch(() => '') : '';
    const payload = await request(`/quizzes/${encodeURIComponent(cleanId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || null;
  }

  async function fetchLessons(limit = 50) {
    const profile = await getStudentProfile();
    const token   = profile?.student_code ? await ensureStudentSession() : '';
    const query   = `/lessons?limit=${limit}`;
    const payload = await request(query, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return payload?.data || [];
  }

  async function fetchQuestions(pin = '') {
    const token   = await ensureAdminSession(pin);
    const payload = await request('/questions', { headers: { Authorization: `Bearer ${token}` } });
    return payload?.data || [];
  }

  // ════════════════════════
  // WRITE ENDPOINTS
  // ════════════════════════

  async function addQuestion(question, pin = '') {
    const token = await ensureAdminSession(pin);
    return request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(toBackendQuestion(question)),
    });
  }

  async function updateQuestion(backendId, question, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/questions/${backendId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(toBackendQuestion(question)),
    });
  }

  async function deleteQuestion(backendId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/questions/${backendId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function deleteQuiz(backendId, pin = '') {
    const token = await ensureAdminSession(pin);
    const rawId = String(backendId || '').trim();
    if (!rawId) throw new Error('quiz id is required');
    const cleanId = encodeURIComponent(rawId);
    return request(`/quizzes/${cleanId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function createLesson(lesson, pin = '') {
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

  async function updateLesson(lessonId, lesson, pin = '') {
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

  async function deleteLesson(lessonId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/lessons/${lessonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── Teacher dashboard ────────────────────────────────────────────────────────

  // ── Teacher: Analytics ────────────────────────────────────────────────────────

  async function fetchTeacherWeekly() {
    const token = await ensureTeacherSession();
    const res = await request('/teacher/analytics/weekly', { headers: { Authorization: `Bearer ${token}` } });
    return res?.data || [];
  }

  async function fetchTeacherMonthly() {
    const token = await ensureTeacherSession();
    const res = await request('/teacher/analytics/monthly', { headers: { Authorization: `Bearer ${token}` } });
    return res?.data || [];
  }

  async function fetchTeacherWeakTopics() {
    const token = await ensureTeacherSession();
    const res = await request('/teacher/analytics/weak-topics', { headers: { Authorization: `Bearer ${token}` } });
    return res?.data || [];
  }

  async function fetchTeacherStrongTopics() {
    const token = await ensureTeacherSession();
    const res = await request('/teacher/analytics/strong-topics', { headers: { Authorization: `Bearer ${token}` } });
    return res?.data || [];
  }

  async function fetchTeacherRanking() {
    const token = await ensureTeacherSession();
    const res = await request('/teacher/analytics/ranking', { headers: { Authorization: `Bearer ${token}` } });
    return res?.data || [];
  }

  async function fetchTeacherStudents() {
    const token = await ensureTeacherSession();
    const payload = await request('/teacher/students', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchStudentAttemptsForTeacher(studentCode) {
    const token = await ensureTeacherSession();
    const code  = encodeURIComponent(String(studentCode || '').trim().toUpperCase());
    const payload = await request(`/teacher/students/${code}/attempts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function updateTeacherDeviceToken(deviceToken) {
    const token = await ensureTeacherSession();
    return request('/teacher/device-token', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_token: deviceToken }),
    });
  }

  async function sendTeacherNotification({ type, batch, student_code, title, body }) {
    const token = await ensureTeacherSession();
    return request('/teacher/send-notification', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type, batch, student_code, title, body }),
    });
  }

  async function fetchTeacherNotificationHistory(studentCode) {
    const token = await ensureTeacherSession();
    const qs    = studentCode ? `?student_code=${encodeURIComponent(studentCode)}` : '';
    const res   = await request(`/teacher/notification-history${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res?.data || [];
  }

  // ── Vocabulary: Admin ────────────────────────────────────────────────────────

  async function autoFillWord(word) {
    const token = await ensureAdminSession();
    return request('/admin/words/auto-fill', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ word }),
    });
  }

  async function suggestEmoji(word) {
    const token = await ensureAdminSession();
    return request(`/admin/words/suggest-emoji?word=${encodeURIComponent(word)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function uploadWordImage(base64DataUrl) {
    const token = await ensureAdminSession();
    return request('/admin/words/upload-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: base64DataUrl }),
    });
  }

  async function fetchAdminWords({ batch = '', subject = '', search = '', skip = 0, limit = 50 } = {}) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams();
    if (batch)   qs.set('batch',   batch);
    if (subject) qs.set('subject', subject);
    if (search)  qs.set('search',  search);
    if (skip)    qs.set('skip',    skip);
    if (limit)   qs.set('limit',   limit);
    const res = await request(`/admin/words${qs.toString() ? '?' + qs.toString() : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res;
  }

  async function resequenceAdminWords({ batch, subject }) {
    const token = await ensureAdminSession();
    return request('/admin/words/resequence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, subject }),
    });
  }

  async function fetchAdminTestWords({ batch, subject, testNum }) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams({ batch, subject, test_num: testNum });
    return request(`/admin/words/test-words?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function createAdminWord(data) {
    const token = await ensureAdminSession();
    return request('/admin/words', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async function updateAdminWord(wordId, data) {
    const token = await ensureAdminSession();
    return request(`/admin/words/${encodeURIComponent(wordId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async function deleteAdminWord(wordId) {
    const token = await ensureAdminSession();
    return request(`/admin/words/${encodeURIComponent(wordId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function bulkCreateAdminWords(words) {
    const token = await ensureAdminSession();
    return request('/admin/words/bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ words }),
    });
  }

  async function getVocabConfig(batch, subject) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams({ batch, subject });
    return request(`/admin/words/vocab-config?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function saveVocabConfig(batch, subject, active_sections) {
    const token = await ensureAdminSession();
    return request('/admin/words/vocab-config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, subject, active_sections }),
    });
  }

  // ── Vocabulary: Student ───────────────────────────────────────────────────────

  async function autoFillWordForStudent(word) {
    const token = await ensureStudentSession();
    return request(`/vocab/auto-fill?word=${encodeURIComponent(word)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function fetchVocabSubjects(batch) {
    const token = await ensureStudentSession();
    return request(`/vocab/subjects?batch=${encodeURIComponent(batch)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function fetchVocabTestList(batch, subject) {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ batch, subject });
    return request(`/vocab/test-list?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function fetchVocabDictionary(batch, subject, page = 1, q = '') {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ batch, subject, page });
    if (q) qs.set('q', q);
    return request(`/vocab/dictionary?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function fetchVocabTest(testNum, batch, subject, meaningLang = 'marathi') {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ batch, subject, meaning_lang: meaningLang });
    return request(`/vocab/test/${testNum}?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function submitVocabAttempt(payload) {
    const token = await ensureStudentSession();
    return request('/vocab/attempt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  }

  async function addStudentWord(data) {
    const token = await ensureStudentSession();
    return request('/student/words', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  // ── Vocabulary: Teacher ───────────────────────────────────────────────────────

  async function fetchTeacherVocabScores({ batch = '', subject = '' } = {}) {
    const token = await ensureTeacherSession();
    const qs = new URLSearchParams();
    if (batch)   qs.set('batch',   batch);
    if (subject) qs.set('subject', subject);
    const res = await request(`/teacher/vocab-scores${qs.toString() ? '?' + qs.toString() : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res?.data || [];
  }

  // ── Parent dashboard ──────────────────────────────────────────────────────────

  async function fetchParentChildren() {
    const token = await ensureParentSession();
    const payload = await request('/parent/children', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchChildAttempts(studentCode) {
    const token = await ensureParentSession();
    const code  = encodeURIComponent(String(studentCode || '').trim().toUpperCase());
    const payload = await request(`/parent/children/${code}/attempts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchChildFee(studentCode) {
    const token = await ensureParentSession();
    const code  = encodeURIComponent(String(studentCode || '').trim().toUpperCase());
    const payload = await request(`/parent/children/${code}/fee`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function updateParentDeviceToken(deviceToken) {
    const token = await ensureParentSession();
    return request('/parent/device-token', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ device_token: deviceToken }),
    });
  }

  // ── Admin: Teacher CRUD ───────────────────────────────────────────────────────

  async function fetchTeachers(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/teachers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchUnassignedStudents(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/teachers/unassigned-students', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function createTeacher(teacher, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/teachers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(teacher),
    });
    return payload;
  }

  async function updateTeacher(teacherId, teacher, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request(`/teachers/${encodeURIComponent(teacherId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(teacher),
    });
    return payload?.data || null;
  }

  async function deleteTeacher(teacherId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/teachers/${encodeURIComponent(teacherId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── Admin: Parent CRUD ────────────────────────────────────────────────────────

  async function fetchParents(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/parents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function createParent(parent, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/parents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(parent),
    });
    return payload;
  }

  async function updateParent(parentId, parent, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request(`/parents/${encodeURIComponent(parentId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(parent),
    });
    return payload?.data || null;
  }

  async function deleteParent(parentId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/parents/${encodeURIComponent(parentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── App Version ───────────────────────────────────────────────────────────────

  async function fetchLatestAppVersion() {
    try {
      return await request('/app-version/latest');
    } catch {
      return null;
    }
  }

  async function fetchAllAppVersions(pin = '') {
    const token = await ensureAdminSession(pin);
    return request('/app-version', { headers: { Authorization: `Bearer ${token}` } });
  }

  async function createAppVersion(data, pin = '') {
    const token = await ensureAdminSession(pin);
    return request('/app-version', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async function activateAppVersion(versionId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/app-version/${encodeURIComponent(versionId)}/activate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function deleteAppVersion(versionId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/app-version/${encodeURIComponent(versionId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ── Admin: Students ───────────────────────────────────────────────────────────

  async function fetchStudents(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/students', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function createStudent(student, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(student),
    });
    return payload?.data || null;
  }

  async function updateStudent(studentId, student, pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request(`/students/${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(student),
    });
    return payload?.data || null;
  }

  async function selfRegister(data = {}) {
    return request('/students/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Payments / Subscriptions (public, student_code + PIN auth) ───────────────

  async function getPaymentConfig() {
    return request('/payment/config').catch(() => ({ configured: false, key_id: '' }));
  }

  async function getBatchPlans() {
    const payload = await request('/batches/pricing/all');
    return payload?.data || [];
  }

  async function createPaymentOrder({ student_code, pin, batch, period }) {
    return request('/payment/order', {
      method: 'POST',
      body: JSON.stringify({ student_code, pin, batch, period }),
    });
  }

  async function startTrial({ student_code, pin, batch }) {
    return request('/payment/trial', {
      method: 'POST',
      body: JSON.stringify({ student_code, pin, batch }),
    });
  }

  async function getSubscriptionStatus({ student_code, pin }) {
    return request('/payment/status', {
      method: 'POST',
      body: JSON.stringify({ student_code, pin }),
    });
  }

  async function verifyPayment({ student_code, pin, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    return request('/payment/verify', {
      method: 'POST',
      body: JSON.stringify({ student_code, pin, razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    });
  }

  async function resetStudentDevice(studentId, pin = '') {
    const token = await ensureAdminSession(pin);
    return request(`/students/${encodeURIComponent(studentId)}/reset-device`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function deleteStudent(studentId) {
    const token = await ensureAdminSession();
    return request(`/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function submitQuiz(studentName, answers) {
    const token = studentName ? await ensureStudentSession() : '';
    return request('/submit', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ studentName, answers }),
    });
  }

  async function submitAttempt(attempt) {
    const studentName = attempt.student_name || String(await DB.getSetting('student_name', '') || '').trim();
    const token = studentName ? await ensureStudentSession() : '';

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
      id        : l.id || l.lesson_id,
      title     : l.title,
      content   : normalizeLessonContent(l.content),
      batch     : l.batch || '',
      subject   : l.subject || '',
      created_at: l.created_at || new Date().toISOString(),
      updated_at: l.updated_at || l.created_at || new Date().toISOString(),
      source    : 'api',
    }));
    if (normalized.length) await DB.saveLessons(normalized);
    return normalized;
  }

  async function syncServerQuestions(pin = '') {
    const questions = await fetchQuestions(pin);
    return cacheQuizQuestions(questions);
  }

  async function syncStudentQuestions() {
    const profile = await getStudentProfile();
    if (!profile?.student_code) return [];
    const token   = await ensureStudentSession().catch(() => '');
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
  // BATCH HIERARCHY SYNC
  // ════════════════════════

  // ════════════════════════
  // STUDENT ATTEMPT SYNC
  // ════════════════════════

  async function fetchMyAttempts() {
    const token = await ensureStudentSession().catch(() => '');
    if (!token) return [];
    const payload = await request('/attempts/my', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function syncMyAttempts() {
    const remote = await fetchMyAttempts();
    if (!remote.length) return [];
    // Save remote attempts that aren't in local DB yet
    const local = await DB.getAllAttempts().catch(() => []);
    const localIds = new Set(local.map(a => a.attempt_id).filter(Boolean));
    const toSave = remote.filter(a => a.attempt_id && !localIds.has(a.attempt_id));
    for (const a of toSave) {
      await DB.saveAttempt(a).catch(() => {});
    }
    return remote;
  }

  async function syncServerBatches() {
    // Admin sessions use their own cached token; a teacher (no admin login)
    // falls back to their own session — GET /batches is read-only (no
    // pricing) and now open to requireTeacherOrAdmin server-side.
    const token = await ensureAdminSession().catch(() => '')
      || await ensureTeacherSession().catch(() => '');
    if (!token) return;
    const payload = await request('/batches', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const batches = payload?.data || [];
    // Merge into local IndexedDB hierarchy
    for (const b of batches) {
      await DB.saveBatch({ name: b.name, icon: b.icon || '📚' }).catch(() => {});
      for (const subject of (b.subjects || [])) {
        await DB.saveBatchSubject({ batch: b.name, name: subject }, { queueOnFailure: false }).catch(() => {});
        const chapters = (b.chapters || []).filter(c => c.subject === subject);
        for (const ch of chapters) {
          await DB.saveSubjectChapter(
            { batch: b.name, subject, name: ch.name }, { queueOnFailure: false }
          ).catch(() => {});
        }
      }
    }
    return batches;
  }

  // ════════════════════════
  // BATCH CATALOG CRUD
  // ════════════════════════

  async function createBatchCatalog(name, icon = '📚') {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request('/batches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, icon }),
    }).catch(() => {});
  }

  async function deleteBatchCatalog(name) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function renameBatchCatalog(oldName, newName, icon) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName, ...(icon !== undefined ? { icon } : {}) }),
    });
  }

  async function setBatchCoverImage(name, coverImageUrl) {
    const token = await ensureAdminSession();
    return request(`/batches/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, cover_image: coverImageUrl }),
    });
  }

  async function addCatalogSubject(batch, subject) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(batch)}/subjects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject }),
    }).catch(() => {});
  }

  async function deleteCatalogSubject(batch, subject) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(batch)}/subjects/${encodeURIComponent(subject)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function addCatalogChapter(batch, subject, chapter) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(batch)}/subjects/${encodeURIComponent(subject)}/chapters`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chapter }),
    }).catch(() => {});
  }

  async function deleteCatalogChapter(batch, subject, chapter) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(batch)}/subjects/${encodeURIComponent(subject)}/chapters/${encodeURIComponent(chapter)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  async function reorderCatalogChapters(batch, subject, orderedNames) {
    const token = await ensureAdminSession().catch(() => '');
    if (!token) return;
    return request(`/batches/${encodeURIComponent(batch)}/subjects/${encodeURIComponent(subject)}/chapters/reorder`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order: orderedNames }),
    }).catch(() => {});
  }

  // Public — no admin session needed, so students can also fetch the
  // admin-chosen chapter order (their local subject_chapters table has no
  // order info of its own; it's derived alphabetically from synced content).
  async function fetchChapterOrder(batch, subject) {
    const payload = await request(`/batches/${encodeURIComponent(batch)}/subjects/${encodeURIComponent(subject)}/chapters`);
    return payload?.data || [];
  }

  // Admin: students who picked a paid plan and started Razorpay checkout
  // but never completed payment — real buying intent, worth a follow-up call.
  async function fetchPendingPayments(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/payment/admin/pending', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  // Admin: total / today / this-month revenue (sum of verified payments).
  async function fetchRevenueSummary(pin = '') {
    const token = await ensureAdminSession(pin);
    const payload = await request('/payment/admin/revenue', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || { total: 0, today: 0, month: 0 };
  }

  // Returns the locally-known chapters for a batch/subject, re-sorted to
  // match the admin's saved order when reachable. Falls back to the plain
  // alphabetical local list when offline or if the backend has no order info.
  async function getOrderedChapters(batch, subject) {
    const local = await DB.getChaptersByBatchSubject(batch, subject);
    if (!navigator.onLine) return local;
    try {
      const remote = await fetchChapterOrder(batch, subject);
      if (!remote.length) return local;
      const orderMap = new Map(remote.map(c => [c.name, c.order]));
      return [...local].sort((a, b) => {
        const oa = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity;
        const ob = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name);
      });
    } catch {
      return local;
    }
  }

  // ════════════════════════
  // SLS CONCEPT — ADMIN API
  // ════════════════════════

  // status='' (default) means "no filter" — sends `?status=` explicitly so
  // the backend's `status = 'published'` destructuring default doesn't kick
  // in; admin needs to see draft/archived concepts too, not just published.
  async function fetchAdminChapterConcepts(chapterId, status = '') {
    const token = await ensureAdminSession();
    const payload = await request(`/admin/sls/chapters/${encodeURIComponent(chapterId)}/concepts?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data?.concepts || [];
  }

  async function fetchAdminConcept(conceptId) {
    const token = await ensureAdminSession();
    const payload = await request(`/admin/sls/${encodeURIComponent(conceptId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  async function createAdminConcept(concept) {
    const token = await ensureAdminSession();
    const payload = await request('/admin/sls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(concept),
    });
    return payload?.data || null;
  }

  async function updateAdminConcept(conceptId, concept) {
    const token = await ensureAdminSession();
    const payload = await request(`/admin/sls/${encodeURIComponent(conceptId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(concept),
    });
    return payload?.data || null;
  }

  async function deleteAdminConcept(conceptId) {
    const token = await ensureAdminSession();
    return request(`/admin/sls/${encodeURIComponent(conceptId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function publishAdminConcept(conceptId) {
    const token = await ensureAdminSession();
    const payload = await request(`/admin/sls/${encodeURIComponent(conceptId)}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  async function translateAdminConcept(conceptId) {
    const token = await ensureAdminSession();
    const payload = await request(`/admin/sls/${encodeURIComponent(conceptId)}/translate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  // ════════════════════════
  // SLS QUESTION BANK — ADMIN API (mounted at /api/sls, not /api/admin/sls —
  // slsRouter, a separate router from the concept CRUD above)
  // ════════════════════════

  async function fetchAdminSlsQuestions(params = {}) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== undefined && v !== null && (v !== '' || k === 'status')))
    );
    const payload = await request(`/sls/admin/questions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function createAdminSlsQuestion(question) {
    const token = await ensureAdminSession();
    const payload = await request('/sls/admin/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(question),
    });
    return payload?.data || null;
  }

  async function updateAdminSlsQuestion(id, question) {
    const token = await ensureAdminSession();
    const payload = await request(`/sls/admin/questions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(question),
    });
    return payload?.data || null;
  }

  async function deleteAdminSlsQuestion(id) {
    const token = await ensureAdminSession();
    return request(`/sls/admin/questions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function publishAdminSlsQuestion(id) {
    const token = await ensureAdminSession();
    const payload = await request(`/sls/admin/questions/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  // ════════════════════════
  // SLS PRACTICE PAPERS — ADMIN API
  // ════════════════════════

  async function createAdminSlsPaperManual(paper) {
    const token = await ensureAdminSession();
    const payload = await request('/sls/admin/papers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(paper),
    });
    return payload?.data || null;
  }

  async function generateAdminSlsPaper(config) {
    const token = await ensureAdminSession();
    const payload = await request('/sls/admin/papers/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(config),
    });
    return payload?.data || null;
  }

  async function fetchAdminSlsPapers(params = {}) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    );
    const payload = await request(`/sls/admin/papers?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchAdminSlsPaper(id) {
    const token = await ensureAdminSession();
    const payload = await request(`/sls/admin/papers/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  async function publishAdminSlsPaper(id) {
    const token = await ensureAdminSession();
    const payload = await request(`/sls/admin/papers/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  // ════════════════════════
  // SLS QUESTIONS/PAPERS — TEACHER API (same /sls/admin/* routes as above,
  // now open to requireTeacherOrAdmin server-side — teachers get read-only
  // question access + full paper CRUD, no question create/edit/delete.
  // Uses ensureTeacherSession(), not ensureAdminSession() — a teacher is
  // never logged in as admin, so the admin-token wrappers above would
  // always fail for a teacher caller.)
  // ════════════════════════

  async function fetchTeacherSlsQuestions(params = {}) {
    const token = await ensureTeacherSession();
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== undefined && v !== null && (v !== '' || k === 'status')))
    );
    const payload = await request(`/sls/admin/questions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function createTeacherSlsPaperManual(paper) {
    const token = await ensureTeacherSession();
    const payload = await request('/sls/admin/papers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(paper),
    });
    return payload?.data || null;
  }

  async function fetchTeacherSlsPapers(params = {}) {
    const token = await ensureTeacherSession();
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== undefined && v !== null && (v !== '' || k === 'status')))
    );
    const payload = await request(`/sls/admin/papers?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchTeacherSlsPaper(id) {
    const token = await ensureTeacherSession();
    const payload = await request(`/sls/admin/papers/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════
  // WORD TEST — ADMIN API
  // ════════════════════════

  async function fetchWordTestStats(batch, subject) {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams({ batch, subject });
    return request(`/admin/word-tests/stats?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  async function generateWordTestPreview(batch, subject, title, questionConfigs) {
    const token = await ensureAdminSession();
    return request('/admin/word-tests/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, subject, title, question_configs: questionConfigs }),
    });
  }

  async function saveWordTestDraft(batch, subject, title, questions, passPercent = 60) {
    const token = await ensureAdminSession();
    return request('/admin/word-tests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, subject, title, questions, pass_percent: passPercent }),
    });
  }

  async function autoGenerateWordTests({ batch, subject, words_per_test, question_configs, overwrite } = {}) {
    const token = await ensureAdminSession();
    return request('/admin/word-tests/auto-generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, subject, words_per_test, question_configs, overwrite }),
    });
  }

  async function listAdminWordTests(batch = '', subject = '') {
    const token = await ensureAdminSession();
    const qs = new URLSearchParams();
    if (batch)   qs.set('batch', batch);
    if (subject) qs.set('subject', subject);
    return request(`/admin/word-tests?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  async function getAdminWordTest(testId) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function updateWordTest(testId, data) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async function publishWordTest(testId) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function unpublishWordTest(testId) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}/unpublish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function deleteWordTest(testId) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function getWordTestResults(testId) {
    const token = await ensureAdminSession();
    return request(`/admin/word-tests/${encodeURIComponent(testId)}/results`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ════════════════════════
  // WORD TEST — STUDENT API
  // ════════════════════════

  async function fetchStudentWordTests(batch, subject) {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ batch, subject });
    return request(`/word-tests?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  async function fetchStudentWordTest(testId) {
    const token = await ensureStudentSession();
    return request(`/word-tests/${encodeURIComponent(testId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function submitWordTestAttempt(testId, answers) {
    const token = await ensureStudentSession();
    return request(`/word-tests/${encodeURIComponent(testId)}/attempt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers }),
    });
  }

  async function fetchWordTestAnalytics({ batch, subject } = {}) {
    const token  = await ensureStudentSession();
    const params = new URLSearchParams();
    if (batch)   params.set('batch',   batch);
    if (subject) params.set('subject', subject);
    const qs = params.toString() ? '?' + params : '';
    return request(`/word-tests/analytics${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function fetchClassWordTestAnalytics({ batch, subject } = {}) {
    const token  = await ensureAdminSession();
    const params = new URLSearchParams();
    if (batch)   params.set('batch',   batch);
    if (subject) params.set('subject', subject);
    const qs = params.toString() ? '?' + params : '';
    return request(`/admin/word-tests/analytics${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ════════════════════════
  // FEE MANAGEMENT (Teacher)
  // ════════════════════════

  async function createFeeConfig({ batch, fee_type, label, total_amount, due_date, student_code }) {
    const token = await ensureTeacherSession();
    return request('/fee', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, fee_type, label, total_amount, due_date, student_code }),
    });
  }

  async function listFeeConfigs({ status } = {}) {
    const token = await ensureTeacherSession();
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/fee${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  async function getFeeRecords(feeConfigId) {
    const token = await ensureTeacherSession();
    return request(`/fee/${encodeURIComponent(feeConfigId)}/records`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function addFeePayment(feeRecordId, { amount, note = '', payment_mode = 'cash', paid_date = '' }) {
    const token = await ensureTeacherSession();
    return request(`/fee/records/${encodeURIComponent(feeRecordId)}/payment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, note, payment_mode, paid_date }),
    });
  }

  async function updateFeeDueDate(feeConfigId, due_date) {
    const token = await ensureTeacherSession();
    return request(`/fee/${encodeURIComponent(feeConfigId)}/due-date`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ due_date }),
    });
  }

  async function closeFeeConfig(feeConfigId) {
    const token = await ensureTeacherSession();
    return request(`/fee/${encodeURIComponent(feeConfigId)}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function updateFeeNextInstallment(feeRecordId, { amount, date }) {
    const token = await ensureTeacherSession();
    return request(`/fee/records/${encodeURIComponent(feeRecordId)}/next-installment`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, date }),
    });
  }

  async function fetchFeeUpiConfig() {
    const token = await ensureTeacherSession();
    return request('/fee/upi-config', { headers: { Authorization: `Bearer ${token}` } });
  }

  async function updateFeeUpiSettings({ upi_id, upi_name }) {
    const token = await ensureTeacherSession();
    return request('/fee/settings/upi', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ upi_id, upi_name }),
    });
  }

  // ─── Notes (Admin) ────────────────────────────────────────────────────────

  // Upload PDF note; data = "data:application/pdf;base64,..."
  async function uploadNote({ title, batch, subject, chapter, data }) {
    const token = await ensureAdminSession();
    return request('/admin/notes/upload', {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ title, batch, subject, chapter: chapter || '', data }),
    });
  }

  // List notes (admin) — optional batch/subject/chapter filter
  async function fetchAdminNotes({ batch, subject, chapter } = {}) {
    const token  = await ensureAdminSession();
    const params = new URLSearchParams();
    if (batch)   params.set('batch',   batch);
    if (subject) params.set('subject', subject);
    if (chapter) params.set('chapter', chapter);
    const qs = params.toString() ? '?' + params : '';
    return request(`/admin/notes${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Update note metadata (title, batch, subject, chapter)
  async function updateNote(noteId, { title, batch, subject, chapter }) {
    const token = await ensureAdminSession();
    return request(`/admin/notes/${encodeURIComponent(noteId)}`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ title, batch, subject, chapter: chapter || '' }),
    });
  }

  // Delete note by note_id
  async function deleteNote(noteId) {
    const token = await ensureAdminSession();
    return request(`/admin/notes/${encodeURIComponent(noteId)}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // ─── Notes (Student) ──────────────────────────────────────────────────────

  // List notes metadata (no URL) — optional batch/subject filter
  async function fetchStudentNotes({ batch, subject } = {}) {
    const token  = await ensureStudentSession();
    const params = new URLSearchParams();
    if (batch)   params.set('batch',   batch);
    if (subject) params.set('subject', subject);
    const qs = params.toString() ? '?' + params : '';
    return request(`/notes${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Fetch PDF binary as ArrayBuffer — for PDF.js (note URL never exposed to client)
  async function fetchNoteView(noteId) {
    const token = await ensureStudentSession();
    const url   = getApiUrl() + `/notes/${encodeURIComponent(noteId)}/view`;
    const resp  = await safeFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      if (resp.status === 403) {
        let body = null;
        try { body = await resp.json(); } catch {}
        if (body?.code === 'ACCOUNT_EXPIRED') markExpired(body.message, body.expiryDate);
        else if (['ACCOUNT_BLOCKED', 'ACCOUNT_PENDING'].includes(body?.code)) clearStudentToken();
      }
      throw new Error(`PDF load failed (${resp.status})`);
    }
    return resp.arrayBuffer();
  }

  // ─── SLS concept notes (student) — via API wrapper so it works on Android ──
  async function fetchSlsChapters() {
    const token = await ensureStudentSession();
    const payload = await request('/sls/chapters', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchSlsConcepts(chapterId) {
    const token = await ensureStudentSession();
    const payload = await request(`/sls/chapters/${encodeURIComponent(chapterId)}/concepts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data?.concepts || [];
  }

  async function searchSlsConcepts(query, limit = 20) {
    const token = await ensureStudentSession();
    const payload = await request(`/sls/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  async function fetchSlsConcept(conceptId) {
    const token = await ensureStudentSession();
    const payload = await request(`/sls/${encodeURIComponent(conceptId)}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || null;
  }

  // Exercise (independent of Notes/Concepts) — chapterId required, exerciseNo
  // optional (omit to get every exercise for the chapter, grouped client-side).
  async function fetchStudentExerciseQuestions(chapterId, exerciseNo) {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ chapterId });
    if (exerciseNo) qs.set('exerciseNo', exerciseNo);
    const payload = await request(`/sls/student/exercise-questions?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  // YouTube Teacher Partner videos for an exercise — two-step: omit
  // teacherId for the Step-1 card list (all approved+live teachers for this
  // exercise), pass teacherId for Step-2 (that teacher's parts).
  async function fetchYoutubeVideosForExercise({ batch, subject, chapter, exercise, teacherId }) {
    const token = await ensureStudentSession();
    const qs = new URLSearchParams({ batch, subject, chapter, exercise });
    if (teacherId) qs.set('teacher_id', teacherId);
    const payload = await request(`/youtube-teacher/videos-for-exercise?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return payload?.data || [];
  }

  // "Video Opens" counter — best-effort, never blocks playback if it fails.
  async function recordYoutubeVideoOpen(videoId) {
    const token = await ensureStudentSession();
    return request(`/youtube-teacher/video-open/${encodeURIComponent(videoId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
  }

  // ════════════════════════

  return {
    DEFAULT_API_URL, REMOTE_BATCH, REMOTE_SUBJECT, REMOTE_CHAPTER,
    getApiUrl, setApiUrl,
    getAdminToken, getStudentToken, getTeacherToken, getParentToken,
    clearAdminToken, clearStudentToken, clearTeacherToken, clearParentToken,
    setTeacherToken, setParentToken,
    getExpiredState, isExpiredLocally, clearExpiredState, markExpired,
    loginAdmin, loginStudent, loginTeacher, loginParent,
    ensureAdminSession, ensureStudentSession, ensureTeacherSession, ensureParentSession,
    fetchStudentMe,
    getStudentProfile, clearStudentProfile,
    getTeacherProfile, clearTeacherProfile,
    getParentProfile, clearParentProfile,
    fetchQuiz, fetchPublishedQuizzes, fetchQuizById, fetchLessons, fetchQuestions, fetchAttempts,
    addQuestion, updateQuestion, deleteQuestion, deleteQuiz,
    fetchStudents, createStudent, updateStudent, resetStudentDevice, deleteStudent, selfRegister,
    getPaymentConfig, getBatchPlans, createPaymentOrder, startTrial, getSubscriptionStatus, verifyPayment,
    fetchPendingPayments, fetchRevenueSummary,
    fetchTeachers, createTeacher, updateTeacher, deleteTeacher, fetchUnassignedStudents,
    fetchParents, createParent, updateParent, deleteParent,
    fetchTeacherWeekly, fetchTeacherMonthly, fetchTeacherWeakTopics, fetchTeacherStrongTopics, fetchTeacherRanking,
    fetchTeacherStudents, fetchStudentAttemptsForTeacher, updateTeacherDeviceToken,
    sendTeacherNotification, fetchTeacherNotificationHistory,
    autoFillWord, suggestEmoji, uploadWordImage, fetchAdminWords, fetchAdminTestWords, resequenceAdminWords, createAdminWord, updateAdminWord, deleteAdminWord, bulkCreateAdminWords,
    getVocabConfig, saveVocabConfig,
    // ─── Word Tests (Admin) ───────────────────────────────────────
    fetchWordTestStats, generateWordTestPreview, saveWordTestDraft, autoGenerateWordTests, listAdminWordTests, getAdminWordTest,
    updateWordTest, publishWordTest, unpublishWordTest, deleteWordTest, getWordTestResults,
    // ─── Word Tests (Student) ─────────────────────────────────────
    fetchStudentWordTests, fetchStudentWordTest, submitWordTestAttempt,
    fetchWordTestAnalytics, fetchClassWordTestAnalytics,
    autoFillWordForStudent, fetchVocabSubjects, fetchVocabDictionary, addStudentWord,
    fetchVocabTestList, fetchVocabTest, submitVocabAttempt,
    fetchTeacherVocabScores,
    fetchParentChildren, fetchChildAttempts, fetchChildFee, updateParentDeviceToken,
    createLesson, updateLesson, deleteLesson,
    submitQuiz, submitAttempt,
    request,
    safeFetch,
    toFrontendQuestion, toBackendQuestion,
    cacheQuizQuestions, cacheLessons,
    syncServerQuestions, syncStudentQuestions, syncServerLessons, syncServerBatches,
    fetchMyAttempts, syncMyAttempts,
    createBatchCatalog, deleteBatchCatalog, renameBatchCatalog, setBatchCoverImage,
    addCatalogSubject, deleteCatalogSubject,
    addCatalogChapter, deleteCatalogChapter, reorderCatalogChapters,
    fetchChapterOrder, getOrderedChapters,
    fetchLatestAppVersion, fetchAllAppVersions, createAppVersion, activateAppVersion, deleteAppVersion,
    // ─── Fee Management (Teacher) ─────────────────────────────────
    createFeeConfig, listFeeConfigs, getFeeRecords, addFeePayment, updateFeeDueDate, closeFeeConfig,
    updateFeeNextInstallment, fetchFeeUpiConfig, updateFeeUpiSettings,
    // ─── Notes (Admin) ────────────────────────────────────────────
    uploadNote, fetchAdminNotes, updateNote, deleteNote,
    // ─── Notes (Student) ─────────────────────────────────────────
    fetchStudentNotes, fetchNoteView,
    fetchSlsChapters, fetchSlsConcepts, searchSlsConcepts, fetchSlsConcept,
    fetchAdminChapterConcepts, fetchAdminConcept, createAdminConcept, updateAdminConcept,
    deleteAdminConcept, publishAdminConcept, translateAdminConcept,
    fetchAdminSlsQuestions, createAdminSlsQuestion, updateAdminSlsQuestion,
    deleteAdminSlsQuestion, publishAdminSlsQuestion,
    createAdminSlsPaperManual, generateAdminSlsPaper, fetchAdminSlsPapers,
    fetchAdminSlsPaper, publishAdminSlsPaper,
    fetchTeacherSlsQuestions, createTeacherSlsPaperManual,
    fetchTeacherSlsPapers, fetchTeacherSlsPaper,
    fetchStudentExerciseQuestions,
    fetchYoutubeVideosForExercise, recordYoutubeVideoOpen,
  };
})();

window.API = API;
