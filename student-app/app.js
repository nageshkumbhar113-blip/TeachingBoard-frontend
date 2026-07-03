/* ════════════════════════════════════════
   app.js — Main App Controller
   Handles: Init, Routing, Theme,
            Language, Home, PWA
   Global: APP
   Note: Toast implemented in ui.js (UI.toast)
════════════════════════════════════════ */

const APP = (() => {
  const $ = id => document.getElementById(id);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const ADMIN_APP_URL = '/admin';
  const UPDATE_EVENT_KEY = 'teachingboard_last_update';
  const UPDATE_CHANNEL_NAME = 'teachingboard_updates';

  // ════════════════════════
  // STATE
  // ════════════════════════

  const STANDARD_THEMES = ['theme-dark', 'theme-light', 'theme-contrast'];

  function _getDeviceId() {
    let id = localStorage.getItem('_tbDevice');
    if (!id) {
      id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2));
      localStorage.setItem('_tbDevice', id);
    }
    return id;
  }
  const BOARD_THEMES    = ['theme-board-dark', 'theme-board-light'];
  const ALL_THEME_PRESETS = [...STANDARD_THEMES, ...BOARD_THEMES];
  const THEME_CLASSES     = [...STANDARD_THEMES, ...BOARD_THEMES];
  const BOARD_ZOOM_MIN = 75;
  const BOARD_ZOOM_MAX = 125;
  const BOARD_ZOOM_STEP = 5;
  const BOARD_ZOOM_DEFAULT = 100;
  const THEME_LABELS = {
    'theme-dark'       : 'Dark',
    'theme-light'      : 'Light',
    'theme-contrast'   : 'High Contrast',
    'theme-board-dark' : 'Board Dark',
    'theme-board-light': 'Board Light',
  };

  const UI_MODES = ['normal', 'board'];

  let _currentScreen = 'home';
  let _screenHistory = [];          // back-stack: list of previous screen names
  let _homeBatch     = null;
  let _homeSubject   = null;
  let _homeChapter   = null;
  let _boardZoom     = BOARD_ZOOM_DEFAULT;
  let _globalGuardsInstalled = false;
  let _updatesChannel = null;
  let _swRefreshing = false;
  let _hadServiceWorkerController = !!navigator.serviceWorker?.controller;
  let _screenEls = [];
  let _screenMap = new Map();
  let _activeScreenEl = null;
  let _appShellRevealed = false;

  // ════════════════════════
  // INIT
  // ════════════════════════

  async function init() {
    // Server wake-up ping — सर्वात पहिले fire करा (fire-and-forget)
    // Render free tier 15 min idle नंतर झोपतो; login form दिसण्यापूर्वी server जागा व्हायला वेळ मिळतो
    fetch(API.getApiUrl() + '/health').catch(() => {});

    _installGlobalGuards();
    _applyDeviceFlags();
    console.log('🚀 Nks EduOrbit starting…');

    try {
      // 1. Storage — must be first
      await DB.open();
      await DB.initDefaultBatches();
      DB.flushPendingWrites?.().catch(err => console.warn('pending write flush failed', err));
      _registerSW();

      // 2. Onboarding — reveal shell first so setup modal is visible on fresh installs
      await _runOnboardingIfNeeded({ beforePrompt: _revealAppShell });

      // 3. Appearance — apply before any render to avoid flash
      const uiMode = await DB.getSetting('ui_mode', 'normal');
      setUiMode(uiMode, { silent: true });
      await _applyStoredBoardZoom({ silent: true });
      await _applyStoredThemeForMode({ silent: true });

      // 4. i18n — before any UI text is rendered
      await I18N.init();

      // 6. Wire nav
      _bindNav();
      _wireSharedUpdates();
      _cacheScreens();

      // 7. Init feature modules (DB must be open)
      _initModules();

      // 8. Reveal app shell before home rendering so one failing widget does not trap the user on splash
      _revealAppShell();

      // 9. Render from IndexedDB first — skip for teacher/parent (they have their own dashboard)
      if (!_isTeacherOrParentMode) {
        await loadHome();
        await _handleInitialRoute();
      }

      // 10. Background tasks — non-blocking
      _startBackground();

      // 11. Suggest board mode on very large screens (non-blocking)
      if (window.innerWidth > 2000 && _activeUiMode() === 'normal') {
        setTimeout(() => toast('🖥️ Large screen detected — try Board Mode', 'info'), 2000);
      }

      console.log('✅ App ready');
      window.SPLASH?.done();
    } catch (err) {
      window.SPLASH?.done();   // dismiss splash even on error
      _handleInitError(err);
    }
  }

  function _installGlobalGuards() {
    if (_globalGuardsInstalled) return;
    _globalGuardsInstalled = true;

    // Show/hide toggle for PIN fields (login, registration, lock-screen) —
    // one delegated listener covers all of them, present or added later.
    document.addEventListener('click', e => {
      const btn = e.target.closest('.pin-toggle-btn');
      if (!btn) return;
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? '👁' : '🙈';
      btn.setAttribute('aria-label', showing ? 'Show PIN' : 'Hide PIN');
    });

    window.addEventListener('error', e => {
      console.error('GLOBAL ERROR:', e.error || e.message || e);
      try { toast('System error occurred. Recovering...', 'error'); } catch {}
    });

    window.addEventListener('unhandledrejection', e => {
      console.error('PROMISE ERROR:', e.reason);
      try { toast('Background task failed. Retrying when possible...', 'error'); } catch {}
    });

    window.addEventListener('online', () => {
      DB.flushPendingWrites?.().catch(err => console.warn('online flush failed', err));
    });

    window.addEventListener('teachingboard:expired', event => {
      // Subscription expired → offer renewal (pay) instead of a dead-end.
      _offerRenewal(event?.detail || {}).catch(err => console.warn('renewal offer failed', err));
    });

    let _reloginPending = false;
    window.addEventListener('teachingboard:unauthorized', () => {
      if (_reloginPending) return;
      _reloginPending = true;
      _showOnboarding(async () => {
        _reloginPending = false;
        await _refreshProfileAfterLogin();
        loadHome();
      }, { force: true });
    });
  }

  function _applyDeviceFlags() {
    document.body?.classList.toggle('touch-device', isTouchDevice);
    if (document.body) document.body.dataset.touchDevice = String(isTouchDevice);
  }

  function _initModules() {
    const modules = [
      { name: 'QUIZ',               mod: window.QUIZ },
      { name: 'TEST_PLAYER',        mod: window.TEST_PLAYER },
      { name: 'ANALYTICS',          mod: window.ANALYTICS },
      { name: 'TEACHER_DASHBOARD',  mod: window.TEACHER_DASHBOARD },
      { name: 'PARENT_DASHBOARD',   mod: window.PARENT_DASHBOARD },
    ];
    for (const { name, mod } of modules) {
      if (mod?.init) {
        try { mod.init(); }
        catch (err) { console.error(`❌ ${name}.init() failed`, err); }
      } else {
        console.warn(`⚠️ Module ${name} not found`);
      }
    }
  }

  function _startBackground() {
    _runWhenIdle(() => {
      _primeQuizCache().catch(err => console.warn('initial quiz cache warm failed', err));
    });

    // Version check — runs 3 seconds after app ready so it doesn't block startup
    setTimeout(() => {
      _checkAppUpdate().catch(err => console.warn('version check failed', err));
    }, 3000);

    // Student auto-sync: replay attempts + refresh published quizzes (students only)
    if (!_isTeacherOrParentMode) {
      if (window.SYNC?.autoSyncStudent) {
        SYNC.autoSyncStudent().catch(err => console.warn('student autoSync error', err));
      } else if (window.SYNC?.fetchQuizzes && navigator.onLine) {
        SYNC.fetchQuizzes({ silent: true, status: 'published' }).catch(err => console.warn('student fetchQuizzes error', err));
      }
    }
  }

  // ════════════════════════
  // APP UPDATE
  // ════════════════════════

  let _pendingUpdate = null;

  function _isNewerVersion(remote, local) {
    const parse = v => String(v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
    const [rMaj, rMin, rPatch] = parse(remote);
    const [lMaj, lMin, lPatch] = parse(local);
    if (rMaj !== lMaj) return rMaj > lMaj;
    if (rMin !== lMin) return rMin > lMin;
    return rPatch > lPatch;
  }

  async function _checkAppUpdate() {
    if (!navigator.onLine) return;
    const localVersion = String(window.APP_VERSION || '').trim();
    if (!localVersion) return;

    const remote = await API.fetchLatestAppVersion().catch(() => null);
    if (!remote?.version) return;
    if (!_isNewerVersion(remote.version, localVersion)) return;

    _pendingUpdate = remote;
    _showUpdateBanner(localVersion, remote);
  }

  function _showUpdateBanner(currentVersion, remote) {
    const banner = $('update-banner');
    if (!banner) return;
    const textEl = $('update-banner-text');
    if (textEl) textEl.textContent = `🚀 Update v${remote.version} आले आहे!`;
    banner.classList.remove('hidden');

    $('update-banner-btn')?.addEventListener('click', () => {
      _openUpdateSheet(currentVersion, remote);
    }, { once: true });
  }

  function _openUpdateSheet(currentVersion, remote) {
    const backdrop = $('update-sheet-backdrop');
    const sheet    = $('update-sheet');
    if (!sheet) return;

    const curEl = $('update-cur-ver');
    const newEl = $('update-new-ver');
    if (curEl) curEl.textContent = `v${currentVersion}`;
    if (newEl) newEl.textContent = `v${remote.version}`;

    const notesEl = $('update-notes');
    if (notesEl) notesEl.textContent = remote.release_notes || 'Bug fixes and improvements.';

    backdrop?.classList.remove('hidden');
    sheet.classList.remove('hidden');

    $('btn-download-update')?.addEventListener('click', () => _startDownload(remote), { once: true });
    $('update-sheet-close')?.addEventListener('click', _closeUpdateSheet, { once: true });
    backdrop?.addEventListener('click', _closeUpdateSheet, { once: true });
  }

  function _closeUpdateSheet() {
    $('update-sheet-backdrop')?.classList.add('hidden');
    $('update-sheet')?.classList.add('hidden');
  }

  function _showInstallGuide() {
    const existing = $('install-guide');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'install-guide';
    div.className = 'install-guide';
    div.innerHTML = `
      <div class="install-guide-inner">
        <div class="install-guide-title">📲 Install Steps</div>
        <ol class="install-guide-steps">
          <li>Chrome madhe APK <strong>download</strong> hote aahe</li>
          <li>Screen varun <strong>swipe down</strong> kara</li>
          <li>Download notification var <strong>"Open" tap</strong> kara</li>
          <li><strong>"Install"</strong> button tap kara</li>
        </ol>
        <button class="install-guide-close" id="install-guide-close">Samjhle ✓</button>
      </div>`;
    document.body.appendChild(div);
    $('install-guide-close')?.addEventListener('click', () => div.remove());
  }

  function _startDownload(remote) {
    const url = String(remote?.apk_url || '').trim();
    if (!url) { toast('Download link उपलब्ध नाही.', 'error'); return; }

    _closeUpdateSheet();

    try {
      if (!window.open(url, '_system')) { window.open(url, '_blank'); }
    } catch { window.open(url, '_blank'); }

    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) { _showInstallGuide(); }
  }

  async function _primeQuizCache() {
    if (!navigator.onLine || !window.SYNC?.fetchQuizzes) return;
    try {
      await SYNC.fetchQuizzes({ silent: true, status: 'published' });
    } catch (err) {
      console.warn('initial quiz cache warm failed', err);
    }
  }

  function _runWhenIdle(task, timeout = 1200) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => task(), { timeout });
      return;
    }
    window.setTimeout(task, 0);
  }

  // ════════════════════════
  // ONBOARDING
  // ════════════════════════

  async function _runOnboardingIfNeeded({ beforePrompt } = {}) {
    // ?server=https://... QR scan से auto-save
    const urlParams = new URLSearchParams(window.location.search);
    const qrServer = urlParams.get('server');
    if (qrServer) {
      try {
        API.setApiUrl(qrServer);
        await DB.setSetting('api_url', qrServer).catch(() => {});
      } catch {}
      history.replaceState(null, '', window.location.pathname);
    }

    const savedUrl = await DB.getSetting('api_url', API.DEFAULT_API_URL).catch(() => API.DEFAULT_API_URL);
    if (window.API?.setApiUrl) {
      try { API.setApiUrl(savedUrl || API.DEFAULT_API_URL); } catch {}
    }

    const profile = window.API?.getStudentProfile
      ? await API.getStudentProfile().catch(() => null)
      : null;

    // ── Returning Teacher ──────────────────────────────────────────────────────
    const teacherProfile = window.API?.getTeacherProfile
      ? await API.getTeacherProfile().catch(() => null)
      : null;
    if (teacherProfile?.teacher_code) {
      beforePrompt?.();
      const unlocked = await _showPinLock(teacherProfile, 'teacher');
      if (!unlocked) return;
      _updateProfileButton(teacherProfile.name || teacherProfile.teacher_code);
      _showTeacherDashboard();
      return;
    }

    // ── Returning Parent ───────────────────────────────────────────────────────
    const parentProfile = window.API?.getParentProfile
      ? await API.getParentProfile().catch(() => null)
      : null;
    if (parentProfile?.parent_code) {
      beforePrompt?.();
      const unlocked = await _showPinLock(parentProfile, 'parent');
      if (!unlocked) return;
      _updateProfileButton(parentProfile.name || parentProfile.parent_code);
      _showParentDashboard();
      return;
    }

    // ── Returning Student ──────────────────────────────────────────────────────
    if (profile?.student_code) {
      // ── Returning user: show PIN lock ──
      beforePrompt?.();
      const unlocked = await _showPinLock(profile, 'student');
      if (!unlocked) return;  // switched account — _showPinLock handles the rest

      // ── PIN correct: refresh profile from server ──
      _updateProfileButton(profile.name || profile.student_code);
      if (navigator.onLine && window.API?.fetchStudentMe) {
        try {
          const refreshed = await API.fetchStudentMe();
          _updateProfileButton(refreshed?.name || refreshed?.student_code || profile.student_code);
        } catch (err) {
          const msg = String(err?.message || '').toLowerCase();
          // Expired → markExpired() already fired teachingboard:expired, which
          // drives the renewal flow. Don't also force a re-login here.
          if (msg.includes('expired')) {
            window.SYNC?.stopStudentAutoSync?.();
            return;
          }
          const isAuthError = msg.includes('unauthorized') || msg.includes('blocked') || msg.includes('pending');
          if (isAuthError) {
            // खरोखर auth fail (401/403) — forced re-login mandatory
            window.SYNC?.stopStudentAutoSync?.();
            await API.clearStudentProfile?.().catch(() => {});
            return new Promise(resolve => _showOnboarding(async () => {
              await _refreshProfileAfterLogin();
              resolve();
            }, { force: true }));
          }
          // Network error / server sleeping / timeout — cached profile वापरत राहा
          console.warn('fetchStudentMe failed (network/server), continuing with cached profile', err?.message);
        }
      }
      return;
    }
    beforePrompt?.();
    return new Promise(resolve => _showOnboarding(async () => {
      await _refreshProfileAfterLogin();
      resolve();
    }));
  }

  // ── PIN LOCK SCREEN ─────────────────────────────────────────
  // Returns true if unlocked, false if user chose "switch account"
  async function _showPinLock(profile, role = 'student') {
    return new Promise(async resolve => {
      const screen    = $('pin-lock-screen');
      const nameEl    = $('pin-lock-name');
      const avatarEl  = $('pin-lock-avatar');
      const input     = $('pin-lock-input');
      const errorEl   = $('pin-lock-error');
      const submitBtn = $('pin-lock-submit');
      const switchBtn = $('pin-lock-switch');

      if (!screen) { resolve(true); return; }

      const displayName = profile.name || profile.teacher_code || profile.parent_code || profile.student_code || 'User';
      if (nameEl)   nameEl.textContent   = displayName;
      if (avatarEl) avatarEl.textContent = (displayName[0] || 'U').toUpperCase();
      if (input)    input.value          = '';
      if (errorEl)  errorEl.classList.add('hidden');

      screen.classList.remove('hidden');
      setTimeout(() => input?.focus(), 100);

      const pinKey = role === 'teacher' ? 'teacher_pin' : role === 'parent' ? 'parent_pin' : 'student_pin';
      const wrongCountKey = role === 'teacher' ? 'teacher_pin_wrong_count' : role === 'parent' ? 'parent_pin_wrong_count' : 'student_pin_wrong_count';
      const lockoutKey = role === 'teacher' ? 'teacher_pin_lockout_until' : role === 'parent' ? 'parent_pin_lockout_until' : 'student_pin_lockout_until';
      const [storedPin, rawWrong, rawLockout] = await Promise.all([
        DB.getSetting(pinKey, '').catch(() => ''),
        DB.getSetting(wrongCountKey, 0).catch(() => 0),
        DB.getSetting(lockoutKey, 0).catch(() => 0),
      ]);
      const _storedPin = String(storedPin || '').trim();
      let _wrongCount   = Number(rawWrong)   || 0;
      let _lockoutUntil = Number(rawLockout) || 0;

      const ac = new AbortController();

      function _unlock() {
        ac.abort();
        screen.classList.add('hidden');
        resolve(true);
      }

      async function _attempt() {
        const now = Date.now();
        // Check lockout
        if (_lockoutUntil > now) {
          const secsLeft = Math.ceil((_lockoutUntil - now) / 1000);
          const mins = Math.floor(secsLeft / 60), secs = secsLeft % 60;
          if (errorEl) {
            errorEl.textContent = `बरेच चुकीचे प्रयत्न. ${mins}m ${secs}s नंतर पुन्हा प्रयत्न करा.`;
            errorEl.classList.remove('hidden');
          }
          if (input) { input.value = ''; input.blur(); }
          return;
        }
        // Lockout expired — reset counter
        if (_lockoutUntil > 0 && _lockoutUntil <= now) {
          _wrongCount   = 0;
          _lockoutUntil = 0;
          await Promise.all([
            DB.setSetting(wrongCountKey, 0).catch(() => {}),
            DB.setSetting(lockoutKey, 0).catch(() => {}),
          ]);
        }

        const entered = String(input?.value || '').trim();
        if (!entered) { input?.focus(); return; }
        if (!_storedPin) {
          // DB मध्ये PIN नाही — re-login आवश्यक
          if (errorEl) {
            errorEl.textContent = 'PIN सापडला नाही. "Switch Account" करून पुन्हा login करा.';
            errorEl.classList.remove('hidden');
          }
          return;
        }
        if (entered === _storedPin) {
          // Correct — reset rate-limit state
          _wrongCount   = 0;
          _lockoutUntil = 0;
          await Promise.all([
            DB.setSetting(wrongCountKey, 0).catch(() => {}),
            DB.setSetting(lockoutKey, 0).catch(() => {}),
          ]);
          _unlock();
          return;
        }
        // Wrong PIN
        _wrongCount++;
        if (_wrongCount >= 5) {
          _lockoutUntil = Date.now() + 30 * 60 * 1000;
          await Promise.all([
            DB.setSetting(wrongCountKey, _wrongCount).catch(() => {}),
            DB.setSetting(lockoutKey, _lockoutUntil).catch(() => {}),
          ]);
          if (errorEl) {
            errorEl.textContent = '5 चुकीचे प्रयत्न — 30 मिनिटांसाठी locked.';
            errorEl.classList.remove('hidden');
          }
          if (input) { input.value = ''; input.blur(); }
          return;
        }
        await DB.setSetting(wrongCountKey, _wrongCount).catch(() => {});
        const remaining = 5 - _wrongCount;
        if (errorEl) {
          errorEl.textContent = `चुकीचा PIN (${remaining} प्रयत्न शिल्लक)`;
          errorEl.classList.remove('hidden');
        }
        if (input) {
          input.classList.add('shake');
          input.value = '';
          setTimeout(() => { input.classList.remove('shake'); input.focus(); }, 450);
        }
      }

      async function _switchAccount() {
        ac.abort();
        screen.classList.add('hidden');
        _isTeacherOrParentMode = false;
        _dashboardRole = null;
        // Stop sync before clearing session so cycle doesn't fire with empty credentials
        window.SYNC?.stopStudentAutoSync?.();
        // Clear all per-student IDB data (sessions, attempts, sync queue, notes cache)
        await DB.clearStudentLocalData?.().catch(() => {});
        // Clear current session regardless of role
        await API.clearStudentProfile?.().catch(() => {});
        await API.clearTeacherProfile?.().catch(() => {});
        await API.clearParentProfile?.().catch(() => {});
        API.clearStudentToken?.();
        API.clearTeacherToken?.();
        API.clearParentToken?.();
        API.clearAdminToken?.();
        resolve(false);
        setTimeout(() => _showOnboarding(async () => {
          await _refreshProfileAfterLogin();
          loadHome();
        }, { force: true }), 50);
      }

      submitBtn?.addEventListener('click', () => _attempt().catch(console.error), { signal: ac.signal });
      input?.addEventListener('keydown', e => { if (e.key === 'Enter') _attempt().catch(console.error); }, { signal: ac.signal });
      switchBtn?.addEventListener('click', _switchAccount, { signal: ac.signal });
      // Block Android back button on PIN screen
      history.pushState(null, '');
      window.addEventListener('popstate', () => { history.pushState(null, ''); }, { signal: ac.signal });
    });
  }

  // Refresh profile + allowed batches from server after any login
  async function _refreshProfileAfterLogin() {
    _updateProfileButton('');
    if (navigator.onLine && window.API?.fetchStudentMe) {
      try {
        const p = await API.fetchStudentMe();
        _updateProfileButton(p?.name || p?.student_code || '');
      } catch {}
    } else {
      const p = await API.getStudentProfile().catch(() => null);
      if (p) _updateProfileButton(p.name || p.student_code || '');
    }
  }

  // Expired subscription → offer renewal via the plan-select/checkout flow.
  // code + PIN are still in DB (markExpired only clears the profile), so the
  // student can pay without re-typing anything.
  let _renewalOffering = false;
  async function _offerRenewal(payload = {}) {
    const code = String(await DB.getSetting('student_code', '').catch(() => '') || '').trim();
    const pin  = String(await DB.getSetting('student_pin', '').catch(() => '') || '').trim();

    // Fallback to the login screen if we can't auto-fill or payments aren't loaded
    if (!code || !pin || !window.PAYMENT?.openPlanSelect) {
      _showOnboarding(async () => { await _refreshProfileAfterLogin(); loadHome(); }, {
        force: true,
        message: payload.expiryDate
          ? `${payload.message || 'Subscription expired'} (${payload.expiryDate})`
          : (payload.message || 'Subscription expired'),
      });
      return;
    }

    if (_renewalOffering) return;
    _renewalOffering = true;
    window.SYNC?.stopStudentAutoSync?.();
    toast('⏳ Subscription संपलं — renew करा', 'info');

    PAYMENT.openPlanSelect({ student_code: code, pin, name: '', contact: '' }, async () => {
      _renewalOffering = false;
      try {
        await API.loginStudent({ student_code: code, pin, device_id: _getDeviceId() });
        API.clearExpiredState?.();
        // Dismiss any login / PIN-lock screen left underneath the plan sheet
        $('onboarding-screen')?.classList.add('hidden');
        $('pin-lock-screen')?.classList.add('hidden');
        await _refreshProfileAfterLogin();
        showScreen('home');
        loadHome();
      } catch {
        _showOnboarding(async () => { await _refreshProfileAfterLogin(); loadHome(); }, { force: true });
      }
    });
  }

  function _initRegistration() {
    const loginCard = document.querySelector('#onboarding-screen .onboarding-card:first-of-type') ||
                      document.getElementById('onboarding-screen')?.querySelector('.onboarding-card');
    const regCard   = document.getElementById('reg-card');

    $('ob-goto-register')?.addEventListener('click', () => {
      if (loginCard) loginCard.classList.add('hidden');
      regCard?.classList.remove('hidden');
      document.getElementById('reg-name')?.focus();
    });

    $('reg-back')?.addEventListener('click', () => {
      regCard?.classList.add('hidden');
      if (loginCard) loginCard.classList.remove('hidden');
      document.getElementById('reg-success')?.classList.add('hidden');
      ['reg-name','reg-mobile','reg-school','reg-pin'].forEach(id => { const el = $(id); if (el) el.value = ''; });
      const consentEl = document.getElementById('reg-consent');
      if (consentEl) consentEl.checked = false;
      const err = document.getElementById('reg-error-msg');
      if (err) { err.textContent = ''; err.classList.add('hidden'); }
      const sb = document.getElementById('reg-submit');
      if (sb) { sb.style.display = ''; sb.disabled = false; }
      const backBtn = document.getElementById('reg-back');
      if (backBtn) backBtn.textContent = '← Login कडे परत जा';
    });

    $('reg-submit')?.addEventListener('click', async () => {
      const name        = (document.getElementById('reg-name')?.value   || '').trim();
      const mobile      = (document.getElementById('reg-mobile')?.value || '').trim();
      const school_name = (document.getElementById('reg-school')?.value || '').trim();
      const pin         = (document.getElementById('reg-pin')?.value    || '').trim();
      const consent     = !!document.getElementById('reg-consent')?.checked;
      const errEl       = document.getElementById('reg-error-msg');
      const successEl   = document.getElementById('reg-success');
      const submitBtn   = document.getElementById('reg-submit');

      const _showErr = msg => {
        if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
      };
      if (errEl) errEl.classList.add('hidden');

      if (!name)        return _showErr('पूर्ण नाव टाका');
      if (!school_name) return _showErr('शाळेचे नाव टाका');
      if (mobile && !_isValidMobile(mobile)) return _showErr('वैध 10 अंकी mobile number टाका (6-9 ने सुरू)');
      if (!/^\d{4}$/.test(pin)) return _showErr('PIN 4 अंकी असणे आवश्यक आहे');
      if (_isWeakPin(pin)) return _showErr('हा PIN खूप सोपा आहे (उदा. 0000, 1234). वेगळा PIN निवडा');
      if (!consent) return _showErr('पुढे जाण्यासाठी संमती checkbox निवडा');

      submitBtn.disabled = true;
      try {
        const server = (document.getElementById('ob-server')?.value || '').trim() || API.DEFAULT_API_URL;
        if (server && window.API?.setApiUrl) API.setApiUrl(server);

        const res = await API.selfRegister({ name, mobile, school_name, pin });
        const code = res?.student_code || '';
        const codeEl = document.getElementById('reg-success-code');
        if (codeEl) codeEl.textContent = `तुमचा Student Code: ${code}`;
        const detailEl = document.getElementById('reg-success-detail');
        if (detailEl) {
          detailEl.innerHTML =
            '<button type="button" id="reg-copy-code" class="onboarding-skip" style="margin:6px 0">📋 Code Copy करा</button>' +
            '<br>💾 <strong>हा code जपून ठेवा</strong> — login साठी लागेल.' +
            '<br><button type="button" id="reg-choose-plan" class="onboarding-btn" style="margin-top:10px">🎟️ Plan निवडा & सुरू करा →</button>';
          detailEl.querySelector('#reg-copy-code')?.addEventListener('click', () => {
            navigator.clipboard?.writeText(code)
              .then(() => toast('Code copy झाला ✓', 'success'))
              .catch(() => toast('Copy करता आले नाही', 'error'));
          });
          const _goLogin = () => {
            regCard?.classList.add('hidden');
            if (loginCard) loginCard.classList.remove('hidden');
            const codeIn = document.getElementById('ob-student-code');
            if (codeIn) codeIn.value = code;
            document.getElementById('ob-pin')?.focus();
            toast('आता तुमचा PIN टाकून login करा', 'info');
          };
          detailEl.querySelector('#reg-choose-plan')?.addEventListener('click', () => {
            if (window.PAYMENT?.openPlanSelect) {
              PAYMENT.openPlanSelect({ student_code: code, pin, name, contact: mobile }, _goLogin);
            } else {
              toast('Payment system उपलब्ध नाही', 'error');
            }
          });
        }
        if (successEl) successEl.classList.remove('hidden');
        submitBtn.style.display = 'none';
        document.getElementById('reg-back').textContent = '← Login कडे जा';
      } catch (err) {
        _showErr(err?.message || 'Registration failed — पुन्हा प्रयत्न करा');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Reject trivially-guessable 4-digit PINs (all-same, sequential, repeating pairs)
  function _isWeakPin(pin) {
    if (!/^\d{4}$/.test(pin)) return true;
    if (/^(\d)\1{3}$/.test(pin)) return true;            // 0000, 1111…
    const [a, b, c, d] = pin.split('').map(Number);
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;  // 1234, 2345…
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;  // 4321, 9876…
    if (a === c && b === d) return true;                  // 1212, 5656…
    return false;
  }

  // Basic Indian mobile sanity: 10 digits, starts 6-9, not all-same / sequential
  function _isValidMobile(mobile) {
    if (!/^\d{10}$/.test(mobile)) return false;
    if (/^(\d)\1{9}$/.test(mobile)) return false;
    if (parseInt(mobile[0], 10) < 6) return false;
    return true;
  }

  function _revealAppShell() {
    if (_appShellRevealed) return;
    _appShellRevealed = true;
    $('screen-home')?.classList.remove('hidden');
    UI.hideSplash();
    window.SPLASH?.done();
  }

  function _showOnboarding(onDone, opts = {}) {
    const screen = document.getElementById('onboarding-screen');
    if (!screen) { onDone?.(); return; }

    screen.classList.remove('hidden');
    _initRegistration();

    const codeInput      = document.getElementById('ob-student-code');
    const pinInput       = document.getElementById('ob-pin');
    const serverInput    = document.getElementById('ob-server');
    const serverField    = document.getElementById('ob-server-field');
    const serverHint     = document.getElementById('ob-server-hint');
    const changeBtn      = document.getElementById('ob-change-server');
    const continueBtn    = document.getElementById('ob-continue');
    const skipBtn        = document.getElementById('ob-skip');
    const errorEl        = document.getElementById('ob-error-msg');
    const subEl          = document.getElementById('ob-role-sub');
    const codeLabelEl    = document.getElementById('ob-code-label');
    const roleTabs       = document.querySelectorAll('.ob-role-tab');

    // Role state — tracks which role is selected in the onboarding form
    let _selectedRole = 'student';

    const ROLE_META = {
      student: { sub: 'Student access साठी code आणि PIN टाका', label: 'Student Code', placeholder: 'उदा. STU001' },
      teacher: { sub: 'Teacher login — teacher code आणि PIN टाका', label: 'Teacher Code', placeholder: 'उदा. TCH123' },
      parent:  { sub: 'Parent login — parent code आणि PIN टाका', label: 'Parent Code', placeholder: 'उदा. PAR123' },
    };

    function _applyRole(role) {
      _selectedRole = role;
      const meta = ROLE_META[role] || ROLE_META.student;
      if (subEl) subEl.textContent = opts.force ? 'पुन्हा authenticate करा' : meta.sub;
      if (codeLabelEl) codeLabelEl.firstChild.textContent = meta.label + ' ';
      if (codeInput) codeInput.placeholder = meta.placeholder;
      roleTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.role === role));
    }

    roleTabs.forEach(tab => {
      tab.addEventListener('click', () => _applyRole(tab.dataset.role));
    });

    _applyRole('student');

    // Pre-fill server URL with the auto-detected default
    const defaultUrl = window.API?.DEFAULT_API_URL || '';
    const isProduction = defaultUrl.includes('onrender.com') || defaultUrl.includes('render.com');

    if (serverInput && !serverInput.value) {
      serverInput.value = defaultUrl;
    }

    if (errorEl) {
      errorEl.textContent = opts.message || '';
      errorEl.classList.toggle('hidden', !opts.message);
    }

    // Production mode: hide URL field — server is auto-configured
    // Show a "change" link for advanced users who want to override
    if (isProduction && serverField) {
      serverInput.style.display = 'none';
      if (serverHint) serverHint.textContent = `Server: ${defaultUrl.replace('https://', '')}`;
      if (changeBtn) {
        changeBtn.style.display = 'inline-block';
        changeBtn.addEventListener('click', () => {
          serverInput.style.display = '';
          changeBtn.style.display = 'none';
          serverInput.focus();
        }, { once: true });
      }
      // "Offline" skip button hidden — production always has server
      if (skipBtn) skipBtn.style.display = 'none';
    }

    const ac = new AbortController();
    const { signal } = ac;

    async function _save() {
      const code   = (codeInput?.value || '').trim().toUpperCase();
      const pin    = (pinInput?.value || '').trim();
      const server = (serverInput?.value || '').trim() || defaultUrl;

      if (!code) {
        codeInput?.classList.add('ob-error');
        codeInput?.focus();
        codeInput?.setAttribute('aria-invalid', 'true');
        return;
      }
      if (!pin || !/^\d{4}$/.test(pin)) {
        pinInput?.classList.add('ob-error');
        pinInput?.focus();
        pinInput?.setAttribute('aria-invalid', 'true');
        return;
      }
      codeInput?.classList.remove('ob-error');
      pinInput?.classList.remove('ob-error');

      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }

      continueBtn.disabled = true;
      try {
        if (server) {
          await DB.setSetting('api_url', server).catch(() => {});
          if (window.API?.setApiUrl) {
            try { API.setApiUrl(server); } catch {}
          }
        }

        if (_selectedRole === 'teacher') {
          const payload = await API.loginTeacher(code, pin);
          _updateProfileButton(payload?.user?.name || payload?.user?.teacher_code || code);
          ac.abort();
          screen.classList.add('hidden');
          _showTeacherDashboard();
          return;
        }

        if (_selectedRole === 'parent') {
          const payload = await API.loginParent(code, pin);
          _updateProfileButton(payload?.user?.name || payload?.user?.parent_code || code);
          ac.abort();
          screen.classList.add('hidden');
          _showParentDashboard();
          return;
        }

        // Student login (default)
        const deviceId = _getDeviceId();
        const payload = await API.loginStudent({ student_code: code, pin, device_id: deviceId });
        _updateProfileButton(payload?.user?.name || payload?.user?.student_code || code);
        ac.abort();
        screen.classList.add('hidden');
        onDone?.();
      } catch (err) {
        let msg = err?.message || 'Login failed';
        if (err?.code === 'DEVICE_MISMATCH') {
          msg = 'हे account दुसऱ्या device वर registered आहे. Admin ला reset करायला सांगा.';
        } else if (err?.code === 'ACCOUNT_PENDING') {
          // No admin approval anymore — pending means "not subscribed yet".
          // Offer the plan-select / payment flow directly.
          msg = '⏳ Subscription active नाही — Plan निवडून सुरू करा.';
          if (window.PAYMENT?.openPlanSelect && code) {
            setTimeout(() => PAYMENT.openPlanSelect(
              { student_code: code, pin, name: '', contact: '' },
              () => _save()
            ), 400);
          }
        } else if (err?.code === 'ACCOUNT_BLOCKED') {
          msg = '🚫 तुमचा account block केला आहे. Admin ला संपर्क करा.';
        } else if (/invalid credentials/i.test(msg) || /unauthorized/i.test(msg)) {
          if (_selectedRole === 'parent') {
            msg = 'चुकीचा Parent Code किंवा PIN. Admin ने दिलेला code आणि PIN वापरा.';
          } else if (_selectedRole === 'teacher') {
            msg = 'चुकीचा Teacher Code किंवा PIN. पुन्हा check करा.';
          } else {
            msg = 'चुकीचा Student Code किंवा PIN. पुन्हा try करा.';
          }
        }
        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
        }
      } finally {
        continueBtn.disabled = false;
      }
    }

    continueBtn?.addEventListener('click', () => _save(), { signal });
    skipBtn?.addEventListener('click', async () => {
      if (!navigator.onLine) {
        const savedCode = String(await DB.getSetting('student_code', '').catch(() => '') || '').trim();
        const savedPin  = String(await DB.getSetting('student_pin', '').catch(() => '') || '').trim();
        // Require both code AND pin to be saved (means they've successfully logged in before)
        if (!savedCode || !savedPin) {
          if (errorEl) {
            errorEl.textContent = 'First login online करणे आवश्यक आहे';
            errorEl.classList.remove('hidden');
          }
          return;
        }
        screen.classList.add('hidden');
        onDone?.();
        return;
      }
      if (errorEl) {
        errorEl.textContent = 'Cached access फक्त offline mode मध्ये available आहे';
        errorEl.classList.remove('hidden');
      }
    }, { signal });
    codeInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') pinInput?.focus();
    }, { signal });
    pinInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') isProduction ? _save() : serverInput?.focus();
    }, { signal });
    serverInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _save();
    }, { signal });

    Promise.all([
      DB.getSetting('student_code', '').catch(() => ''),
      DB.getSetting('api_url', defaultUrl).catch(() => defaultUrl),
    ]).then(([studentCode, savedServer]) => {
      // Only pre-fill code for student role (teacher/parent enter their own code)
      if (codeInput && _selectedRole === 'student') codeInput.value = String(studentCode || '').trim().toUpperCase();
      if (serverInput) serverInput.value = String(savedServer || defaultUrl).trim() || defaultUrl;
      if (pinInput) pinInput.value = '';
    }).catch(() => {});

    if (skipBtn) skipBtn.style.display = navigator.onLine ? 'none' : 'inline-block';
    codeInput?.focus();
  }

  function _showTeacherDashboard() {
    _isTeacherOrParentMode = true;
    _dashboardRole = 'teacher';
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const screen = $('screen-teacher-dashboard');
    if (screen) screen.classList.remove('hidden');
    const bnav = $('bottom-nav');
    if (bnav) bnav.style.display = 'none';
    if (window.TEACHER_DASHBOARD?.loadDashboard) {
      TEACHER_DASHBOARD.loadDashboard().catch(err => console.warn('teacher dashboard load failed', err));
    }
    _setupPushNotifications('teacher');
  }

  function _showParentDashboard() {
    _isTeacherOrParentMode = true;
    _dashboardRole = 'parent';
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const screen = $('screen-parent-dashboard');
    if (screen) screen.classList.remove('hidden');
    const bnav = $('bottom-nav');
    if (bnav) bnav.style.display = 'none';
    if (window.PARENT_DASHBOARD?.loadDashboard) {
      PARENT_DASHBOARD.loadDashboard().catch(err => console.warn('parent dashboard load failed', err));
    }
    _setupPushNotifications('parent');
  }

  let _pushSetupDone = false;
  let _isTeacherOrParentMode = false;
  let _dashboardRole = null; // 'teacher' | 'parent' | null

  function _goHomeRoleAware() {
    if (_dashboardRole === 'teacher') { _showTeacherDashboard(); return; }
    if (_dashboardRole === 'parent')  { _showParentDashboard();  return; }
    loadHome();
  }

  async function _setupPushNotifications(role) {
    if (_pushSetupDone) return;
    if (!window.Capacitor?.isNativePlatform()) return;
    const Push = window.Capacitor?.Plugins?.PushNotifications;
    if (!Push) return;
    _pushSetupDone = true;

    try {
      const perm = await Push.requestPermissions();
      if (perm.receive !== 'granted') return;
      await Push.register();

      Push.addListener('registration', async ({ value: deviceToken }) => {
        if (!deviceToken) return;
        try {
          if (role === 'teacher') await API.updateTeacherDeviceToken(deviceToken);
          else if (role === 'parent') await API.updateParentDeviceToken(deviceToken);
        } catch (e) { console.warn('FCM token register failed', e); }
      });

      Push.addListener('notificationActionPerformed', action => {
        const data        = action.notification?.data || {};
        const studentCode = data.student_code || '';
        if (role === 'teacher') {
          _showTeacherDashboard();
          if (studentCode) {
            setTimeout(() => window.TEACHER_DASHBOARD?.openStudent?.(studentCode), 600);
          }
        } else if (role === 'parent') {
          _showParentDashboard();
          if (data.type === 'fee_reminder' && data.upi_link) {
            setTimeout(() => window.open(data.upi_link, '_system'), 400);
          }
        }
      });
    } catch (e) {
      console.warn('Push notification setup failed', e);
    }
  }

  function _updateProfileButton(name) {
    const label = document.getElementById('nav-student-name');
    const safeName = String(name || '');
    if (label) label.textContent = safeName.length > 10 ? safeName.slice(0, 10) + '…' : safeName;
  }

  async function _openProfileSettings() {
    document.getElementById('profile-settings-overlay')?.remove();

    const profile = await API.getStudentProfile().catch(() => null);
    const name    = profile?.name || profile?.student_code || 'Student';
    const code    = profile?.student_code || '';
    const batches = (profile?.assigned_batches || []).join(', ') || 'None';

    // Profile info modal with Switch Account option
    const overlay = document.createElement('div');
    overlay.id = 'profile-settings-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9997;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.innerHTML = `
      <div style="background:var(--surface,#fff);border-radius:20px;padding:28px 24px;max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);animation:splashFadeIn 0.25s ease">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--accent,#e74c3c);color:#fff;font-size:1.5rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">
          ${_escHtml((name[0] || 'S').toUpperCase())}
        </div>
        <h2 style="margin:0 0 4px;font-size:1.1rem;color:var(--text1);text-align:center">${_escHtml(name)}</h2>
        <p style="margin:0 0 2px;font-size:0.8rem;color:var(--text2);text-align:center">Code: <b>${_escHtml(code)}</b></p>
        <p style="margin:0 0 20px;font-size:0.8rem;color:var(--text2);text-align:center">Classes: <b>${_escHtml(batches)}</b></p>
        <button id="ps-switch-btn" style="width:100%;padding:12px;border:2px solid var(--border,#ddd);border-radius:10px;background:transparent;color:var(--text1,#333);font-weight:600;cursor:pointer;margin-bottom:8px">↔ Switch Account</button>
        <button id="ps-close-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:var(--accent,#e74c3c);color:#fff;font-weight:600;cursor:pointer">Close</button>
      </div>
    `;
    document.body.appendChild(overlay);

    function _close() { overlay.remove(); }
    overlay.querySelector('#ps-close-btn')?.addEventListener('click', _close);
    overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

    overlay.querySelector('#ps-switch-btn')?.addEventListener('click', async () => {
      _close();
      // Stop sync before clearing session so cycle doesn't fire with empty credentials
      window.SYNC?.stopStudentAutoSync?.();
      // Clear current session; show login for new student
      await API.clearStudentProfile?.().catch(() => {});
      API.clearStudentToken?.();
      _updateProfileButton('');
      _screenHistory = [];
      _showOnboarding(async () => {
        await _refreshProfileAfterLogin();
        loadHome();
      }, { force: true });
    });
  }

  function _escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _handleInitError(err) {
    console.error('❌ App init error', err);
    _revealAppShell();
    showScreen('home');
    // Show native alert as last resort when toast container may not exist
    const msg = 'App failed to start. Please refresh the page.';
    if ($('toast-container')) {
      toast(msg, 'error');
    } else {
      // Minimal inline error banner
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:16px;background:#c0392b;color:#fff;font:14px/1.4 sans-serif;z-index:9999;text-align:center';
      banner.textContent = msg;
      document.body?.appendChild(banner);
    }
  }

  // ════════════════════════
  // NAV BINDINGS
  // ════════════════════════

  function _bindNav() {
    $('btn-back')?.addEventListener('click', goBack);

    // Android hardware/gesture back button
    window.addEventListener('popstate', e => {
      e.preventDefault();
      goBack();
    });
    // Push a dummy state so popstate fires on Android back
    if (typeof history.pushState === 'function') {
      history.pushState({ tb: true }, '');
    }

    $('btn-home')?.addEventListener('click', () => _goHomeRoleAware());

    $('btn-theme')?.addEventListener('click', async () => {
      const cur  = _activeTheme();
      const themes = _themesForActiveMode();
      const idx    = themes.indexOf(cur);
      const next   = themes[(idx + 1 + themes.length) % themes.length];
      setTheme(next);
      await DB.setSetting(_themeSettingKey(), next);
    });

    $('btn-lang')?.addEventListener('click', () => {
      if (!window.I18N) return;
      const next = I18N.cycleLang();
      toast(`Language: ${next.label}`, 'info');
    });

    $('btn-tts')?.addEventListener('click', () => {
      try {
        if (!window.TTS) { toast('Text-to-Speech उपलब्ध नाही', 'error'); return; }
        TTS.toggle();
      } catch {
        toast('Text-to-Speech browser मध्ये support नाही', 'error');
      }
    });

    $('btn-profile')?.addEventListener('click', () => {
      _openProfileSettings();
    });

    $('btn-admin')?.addEventListener('click', () => {
      openAdminApp();
    });

    $('btn-analytics')?.addEventListener('click', () => {
      window.ANALYTICS?.open();
    });

    $('btn-ui-mode')?.addEventListener('click', async () => {
      const next = _activeUiMode() === 'board' ? 'normal' : 'board';
      setUiMode(next);
      await DB.setSetting('ui_mode', next);
      await _applyStoredThemeForMode({ silent: true });
    });

    $('btn-board-zoom-out')?.addEventListener('click', async () => {
      await setBoardZoom(_boardZoom - BOARD_ZOOM_STEP);
    });

    $('btn-board-zoom-in')?.addEventListener('click', async () => {
      await setBoardZoom(_boardZoom + BOARD_ZOOM_STEP);
    });

    // ── Bottom Navigation ────────────────────────────
    $('bnav-home')?.addEventListener('click', () => _goHomeRoleAware());
    $('bnav-analytics')?.addEventListener('click', () => window.ANALYTICS?.open());
    $('bnav-mode')?.addEventListener('click', async () => {
      const next = _activeUiMode() === 'board' ? 'normal' : 'board';
      setUiMode(next);
      await DB.setSetting('ui_mode', next);
      await _applyStoredThemeForMode({ silent: true });
    });
    $('bnav-me')?.addEventListener('click', () => _openProfileSettings());
  }

  // ════════════════════════
  // SCREEN ROUTING
  // ════════════════════════

  function showScreen(name, { addToHistory = true } = {}) {
    if (!name) return;

    // Stop quiz timer when navigating away from quiz screen
    if (_currentScreen === 'quiz' && name !== 'quiz' && window.QUIZ?.stopTimer) {
      window.QUIZ.stopTimer();
    }

    // Push current screen to history before switching (skip 'home' as base)
    if (addToHistory && _currentScreen && _currentScreen !== name) {
      _screenHistory.push(_currentScreen);
      if (_screenHistory.length > 10) _screenHistory.shift(); // cap stack
    }

    _currentScreen = name;

    if (!_screenEls.length) _cacheScreens();
    const el = _screenMap.get(name) || $('screen-' + name);
    if (el) {
      _screenEls.forEach(screen => {
        if (screen !== el) screen.classList.add('hidden');
      });
      el.classList.remove('hidden');
      if (_activeScreenEl !== el) {
        el.classList.remove('anim-fade-in');
        requestAnimationFrame(() => {
          if (_currentScreen === name) el.classList.add('anim-fade-in');
        });
      }
      _activeScreenEl = el;
    } else {
      console.warn(`showScreen: no element #screen-${name}`);
    }

    // Show/hide back button — always hide on home; show when there's history
    const backBtn = $('btn-back');
    if (backBtn) {
      const showBack = name !== 'home' && _screenHistory.length > 0;
      backBtn.classList.toggle('hidden', !showBack);
    }

    const labels = {
      home: 'Home', quiz: 'Practice', results: 'Results',
      'test-player': 'Test', analytics: 'Analytics', 'deep-study': 'Deep Study',
    };
    UI.setBreadcrumb(labels[name] || name);
    _updateBottomNav(name);
  }

  function _updateBottomNav(screen) {
    const tabMap = {
      home: 'bnav-home',
      analytics: 'bnav-analytics',
      quiz: null,
      'test-player': null,
      results: 'bnav-home',
      'deep-study': 'bnav-home',
      vocab: 'bnav-vocab',
    };
    document.querySelectorAll('.bnav-btn').forEach(btn => btn.classList.remove('bnav-active'));
    const activeId = tabMap[screen] ?? 'bnav-home';
    if (activeId) $(activeId)?.classList.add('bnav-active');

    const navEl = $('bottom-nav');
    if (navEl) navEl.style.display = ['quiz', 'test-player'].includes(screen) ? 'none' : '';
  }

  function goBack() {
    if (_screenHistory.length === 0) { showScreen('home', { addToHistory: false }); return; }
    const prev = _screenHistory.pop();
    showScreen(prev, { addToHistory: false });
  }

  // Alias kept for backward compat (quiz.js, etc.)
  function navigate(name) { showScreen(name); }

  function setBreadcrumb(text) { UI.setBreadcrumb(text); }

  function currentScreen() { return _currentScreen; }

  function openAdminApp() {
    window.location.href = `${ADMIN_APP_URL}?source=student`;
  }

  // ════════════════════════
  // HOME
  // ════════════════════════

  function _homeQuizHandlers(batchName, subject, chapter) {
    return {
      onStart: quiz => TEST_PLAYER.startTest(quiz.quiz_id, quiz.default_mode || 'practice'),
      onPractice: () => QUIZ.startQuiz(batchName, subject, chapter, 'practice'),
    };
  }

  function _activateHomeChoice(selector, selectedText, childSelector) {
    if (!selectedText) return;
    document.querySelectorAll(selector).forEach(el => {
      const matchText = childSelector
        ? (el.querySelector(childSelector)?.textContent || '').trim()
        : (el.textContent || '').trim();
      el.classList.toggle('active', matchText === selectedText);
    });
  }

  function _bindChapterFlow(batchName, subject) {
    return async chapter => {
      _homeChapter = chapter;

      // Show Deep Study launch button for this chapter
      const dsBtn = $('btn-deep-study');
      if (dsBtn) {
        dsBtn.classList.remove('hidden');
        dsBtn.onclick = null;
        dsBtn.addEventListener('click', () => {
          window.DEEP_STUDY?.open(batchName, subject, chapter);
        }, { once: false });
      }

      await UI.renderAvailableQuizzes({
        batch: batchName,
        subject,
        chapter,
        ..._homeQuizHandlers(batchName, subject, chapter),
      });
    };
  }

  function _bindSubjectFlow(batchName) {
    return async subject => {
      _homeSubject = subject;
      _homeChapter = null;
      $('btn-deep-study')?.classList.add('hidden');
      await UI.renderChapterList(batchName, subject, _bindChapterFlow(batchName, subject));
    };
  }

  async function _renderHomeHierarchy({ preserveSelection = false } = {}) {
    await UI.renderBatchGrid(async batch => {
      _homeBatch = batch;
      _homeSubject = null;
      _homeChapter = null;
      await UI.renderSubjectGrid(batch.name, _bindSubjectFlow(batch.name));
    });

    if (!preserveSelection || !_homeBatch?.name) return;

    _activateHomeChoice('.batch-card', _homeBatch.name, '.batch-name');
    await UI.renderSubjectGrid(_homeBatch.name, _bindSubjectFlow(_homeBatch.name));

    if (!_homeSubject) return;

    _activateHomeChoice('.subject-card', _homeSubject, '.subject-name');
    await UI.renderChapterList(_homeBatch.name, _homeSubject, _bindChapterFlow(_homeBatch.name, _homeSubject));

    if (!_homeChapter) return;

    _activateHomeChoice('.chapter-item', _homeChapter, '.chapter-name');
    await UI.renderAvailableQuizzes({
      batch: _homeBatch.name,
      subject: _homeSubject,
      chapter: _homeChapter,
      ..._homeQuizHandlers(_homeBatch.name, _homeSubject, _homeChapter),
    });
  }

  async function loadHome() {
    _screenHistory = [];   // clear back-stack when going to home
    showScreen('home', { addToHistory: false });
    await DB.syncHierarchyFromExisting?.();

    // Hide drill-down sections immediately
    ['subject-section', 'chapter-section', 'lesson-section', 'available-tests-section']
      .forEach(id => $( id)?.classList.add('hidden'));

    _homeBatch = null;
    _homeSubject = null;
    _homeChapter = null;
    $('btn-deep-study')?.classList.add('hidden');

    await UI.renderHomeStats();
    await UI.renderRecentAttempts();
    await UI.renderAvailableQuizzes({
      showAll: false,
      onStart: quiz => TEST_PLAYER.startTest(quiz.quiz_id, quiz.default_mode || 'practice'),
    });
    await _renderHomeHierarchy();
  }

  // Lightweight stats refresh — called after quiz end, admin changes, etc.
  async function refreshHome() {
    // Keep profile button in sync with latest stored name (updated by auto-sync)
    const _latestProfile = await DB.getSetting('student_profile', null).catch(() => null);
    if (_latestProfile?.name || _latestProfile?.student_code) {
      _updateProfileButton(_latestProfile.name || _latestProfile.student_code);
    }
    await DB.syncHierarchyFromExisting?.();
    await UI.renderHomeStats();
    await UI.renderRecentAttempts();
    await _renderHomeHierarchy({ preserveSelection: true });
    if (!_homeBatch?.name || !_homeSubject || !_homeChapter) {
      await UI.renderAvailableQuizzes({
        showAll: false,
        onStart: quiz => TEST_PLAYER.startTest(quiz.quiz_id, quiz.default_mode || 'practice'),
      });
    }
  }

  function _cacheScreens() {
    _screenEls = [...document.querySelectorAll('.screen')];
    _screenMap = new Map(
      _screenEls
        .filter(screen => screen.id?.startsWith('screen-'))
        .map(screen => [screen.id.slice(7), screen])
    );
  }

  function _wireSharedUpdates() {
    if ('BroadcastChannel' in window) {
      _updatesChannel = new BroadcastChannel(UPDATE_CHANNEL_NAME);
      _updatesChannel.addEventListener('message', () => _refreshVisibleScreen());
    }

    window.addEventListener('storage', e => {
      if (e.key === UPDATE_EVENT_KEY) _refreshVisibleScreen();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) _refreshVisibleScreen();
    });
  }

  function _refreshVisibleScreen() {
    if (_currentScreen === 'home') {
      refreshHome().catch(err => console.warn('home refresh failed', err));
      return;
    }

    if (_currentScreen === 'analytics' && window.ANALYTICS?.open) {
      ANALYTICS.open().catch(err => console.warn('analytics refresh failed', err));
    }
  }

  async function _handleInitialRoute() {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('quiz');
    const mode   = params.get('mode') || 'practice';
    const focus  = params.get('focus');

    if (focus === 'analytics' && window.ANALYTICS?.open) {
      await ANALYTICS.open();
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (!quizId || !window.TEST_PLAYER?.startTest) return;

    await TEST_PLAYER.startTest(quizId, mode);
    window.history.replaceState({}, '', window.location.pathname);
  }

  // ════════════════════════
  // THEME
  // ════════════════════════

  function _activeTheme() {
    const preset = document.body.dataset.themePreset;
    if (ALL_THEME_PRESETS.includes(preset)) return preset;
    return ALL_THEME_PRESETS.find(t => document.body.classList.contains(t)) || 'theme-dark';
  }

  function _themesForActiveMode() {
    return _activeUiMode() === 'board' ? BOARD_THEMES : STANDARD_THEMES;
  }

  function _themeSettingKey() {
    return _activeUiMode() === 'board' ? 'board_theme' : 'theme';
  }

  function _themeFallbackForMode(mode = _activeUiMode()) {
    return mode === 'board' ? 'theme-board-dark' : 'theme-dark';
  }

  function _themeButtonMeta(theme) {
    if (theme === 'theme-board-light') return { icon: '☀️', label: 'Board Light' };
    if (theme === 'theme-board-dark')  return { icon: '🌙', label: 'Board Dark' };
    if (theme === 'theme-light')       return { icon: '☀️', label: 'Light' };
    if (theme === 'theme-contrast')    return { icon: '◐', label: 'Contrast' };
    return { icon: '🌙', label: 'Dark' };
  }

  function _setThemeButtonState(theme) {
    const btn = $('btn-theme');
    if (!btn) return;

    const iconEl  = btn.querySelector('.nav-btn-icon');
    const labelEl = btn.querySelector('.nav-btn-label');
    const meta    = _themeButtonMeta(theme);

    if (iconEl)  iconEl.textContent  = meta.icon;
    if (labelEl) labelEl.textContent = meta.label;

    btn.title = `Theme: ${THEME_LABELS[theme] || meta.label}`;
  }

  async function _applyStoredThemeForMode({ silent = true } = {}) {
    const theme = await DB.getSetting(_themeSettingKey(), _themeFallbackForMode());
    setTheme(theme, { silent });
  }

  function setTheme(theme, { silent = false } = {}) {
    if (!ALL_THEME_PRESETS.includes(theme)) {
      console.warn(`setTheme: unknown theme "${theme}", falling back to theme-dark`);
      theme = 'theme-dark';
    }

    const baseTheme = theme === 'theme-board-light'
      ? 'theme-light'
      : theme === 'theme-board-dark'
        ? 'theme-dark'
        : theme;

    document.body.classList.remove(...THEME_CLASSES);
    document.body.classList.add(baseTheme);
    if (theme.startsWith('theme-board-')) document.body.classList.add(theme);
    document.body.dataset.themePreset = theme;
    _setThemeButtonState(theme);

    if (!silent) {
      toast(`Theme: ${THEME_LABELS[theme]}`, 'info');
    }
  }

  // ════════════════════════
  // UI MODE  (normal / board)
  // ════════════════════════

  function _activeUiMode() {
    return document.body.classList.contains('mode-board') ? 'board' : 'normal';
  }

  function _sanitizeBoardZoom(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return BOARD_ZOOM_DEFAULT;
    return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, Math.round(num / BOARD_ZOOM_STEP) * BOARD_ZOOM_STEP));
  }

  function _updateBoardZoomUi() {
    const control = $('board-zoom-control');
    const valueEl = $('board-zoom-value');
    const minusBtn = $('btn-board-zoom-out');
    const plusBtn = $('btn-board-zoom-in');
    const isBoard = _activeUiMode() === 'board';

    if (control) control.classList.toggle('hidden', !isBoard);
    if (valueEl) valueEl.textContent = `${_boardZoom}%`;
    if (minusBtn) minusBtn.disabled = _boardZoom <= BOARD_ZOOM_MIN;
    if (plusBtn) plusBtn.disabled = _boardZoom >= BOARD_ZOOM_MAX;
  }

  async function _applyStoredBoardZoom({ silent = false } = {}) {
    const saved = await DB.getSetting('board_zoom', BOARD_ZOOM_DEFAULT).catch(() => BOARD_ZOOM_DEFAULT);
    await setBoardZoom(saved, { persist: false, silent });
  }

  async function setBoardZoom(value, { persist = true, silent = false } = {}) {
    _boardZoom = _sanitizeBoardZoom(value);
    document.body.style.setProperty('--board-zoom', String(_boardZoom / 100));
    _updateBoardZoomUi();

    if (persist) {
      await DB.setSetting('board_zoom', _boardZoom).catch(() => {});
    }

    if (!silent && _activeUiMode() === 'board') {
      toast(`Board zoom: ${_boardZoom}%`, 'info');
    }
  }

  function _setModeButtonState(btn, isBoard) {
    if (!btn) return;
    const icon  = btn.querySelector('.nav-btn-icon, .bnav-icon');
    const label = btn.querySelector('.nav-btn-label, .bnav-label');

    if (icon && label) {
      icon.textContent  = isBoard ? '📱' : '🖥️';
      label.textContent = isBoard ? 'Normal' : 'Board';
    } else {
      btn.textContent = isBoard ? '📱 Normal' : '🖥️ Board';
    }
  }

  function setUiMode(mode, { silent = false } = {}) {
    if (!UI_MODES.includes(mode)) mode = 'normal';
    const isBoard = mode === 'board';

    document.body.classList.toggle('mode-board', isBoard);

    const btn = $('btn-ui-mode');
    if (btn) {
      _setModeButtonState(btn, isBoard);
      btn.title       = isBoard ? 'Switch to Normal Mode' : 'Switch to Board Mode (4K display)';
      btn.setAttribute('aria-pressed', String(isBoard));
    }
    _setModeButtonState($('bnav-mode'), isBoard);

    _updateBoardZoomUi();
    _setThemeButtonState(_activeTheme());

    if (!silent) {
      toast(isBoard ? '🖥️ Board Mode ON' : '📱 Normal Mode ON', 'info');
    }
  }

  // ════════════════════════
  // TOAST  (delegates to UI)
  // ════════════════════════

  /** Thin wrapper so all modules can keep calling APP.toast(). */
  function toast(msg, type = 'info', duration = 2800) {
    UI.toast(msg, type, duration);
  }

  // ════════════════════════
  // SERVICE WORKER
  // ════════════════════════

  function _registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('../sw.js')
      .then(reg => {
        console.log('SW registered', reg.scope);

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Update available — refresh to apply', 'info');
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed', err));

    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SYNC_READY') {
        _startBackground();
      } else if (e.data?.type === 'SW_UPDATED') {
        toast('App updated. Refreshing...', 'info');
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_hadServiceWorkerController) {
        _hadServiceWorkerController = true;
        return;
      }
      if (_swRefreshing) return;
      _swRefreshing = true;
      window.location.reload();
    });
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return {
    init,
    // Routing
    showScreen,
    goBack,
    navigate,         // alias — kept for quiz.js / other callers
    currentScreen,
    setBreadcrumb,
    openAdminApp,
    // Home
    loadHome,
    refreshHome,
    // Appearance
    setTheme,
    setUiMode,
    setBoardZoom,
    // Notifications
    toast,
    isTouchDevice,
    // Profile
    openProfileSettings: _openProfileSettings,
  };
})();

// ── Auto-start ──────────────────────────
document.addEventListener('DOMContentLoaded', APP.init);
