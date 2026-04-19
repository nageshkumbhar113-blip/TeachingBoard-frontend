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
  const BOARD_THEMES    = ['theme-board-dark', 'theme-board-light'];
  const ALL_THEME_PRESETS = [...STANDARD_THEMES, ...BOARD_THEMES];
  const THEME_CLASSES     = [...STANDARD_THEMES, ...BOARD_THEMES];
  const THEME_LABELS = {
    'theme-dark'       : 'Dark',
    'theme-light'      : 'Light',
    'theme-contrast'   : 'High Contrast',
    'theme-board-dark' : 'Board Dark',
    'theme-board-light': 'Board Light',
  };

  const UI_MODES = ['normal', 'board'];

  let _currentScreen = 'home';
  let _homeBatch     = null;
  let _homeSubject   = null;
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
    _installGlobalGuards();
    _applyDeviceFlags();
    console.log('🚀 TeachingBoard starting…');

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

      // 9. Render from IndexedDB first so the app becomes interactive quickly
      await loadHome();

      await _handleInitialRoute();

      // 10. Background tasks — non-blocking
      _startBackground();

      // 11. Suggest board mode on very large screens (non-blocking)
      if (window.innerWidth > 2000 && _activeUiMode() === 'normal') {
        setTimeout(() => toast('🖥️ Large screen detected — try Board Mode', 'info'), 2000);
      }

      console.log('✅ App ready');
    } catch (err) {
      _handleInitError(err);
    }
  }

  function _installGlobalGuards() {
    if (_globalGuardsInstalled) return;
    _globalGuardsInstalled = true;

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
  }

  function _applyDeviceFlags() {
    document.body?.classList.toggle('touch-device', isTouchDevice);
    if (document.body) document.body.dataset.touchDevice = String(isTouchDevice);
  }

  function _initModules() {
    const modules = [
      { name: 'QUIZ',         mod: window.QUIZ },
      { name: 'TEST_PLAYER',  mod: window.TEST_PLAYER },
      { name: 'ANALYTICS',    mod: window.ANALYTICS },
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

    // Student auto-sync: replay attempts + refresh published quizzes
    if (window.SYNC?.autoSyncStudent) {
      SYNC.autoSyncStudent().catch(err => console.warn('student autoSync error', err));
    } else if (window.SYNC?.fetchQuizzes && navigator.onLine) {
      SYNC.fetchQuizzes({ silent: true, status: 'published' }).catch(err => console.warn('student fetchQuizzes error', err));
    }
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
      // Clean URL without reload
      history.replaceState(null, '', window.location.pathname);
    }

    const existing = await DB.getSetting('student_name', '').catch(() => '');
    if (existing && existing.trim()) {
      const savedUrl = await DB.getSetting('api_url', API.DEFAULT_API_URL).catch(() => API.DEFAULT_API_URL);
      if (window.API?.setApiUrl) {
        try { API.setApiUrl(savedUrl || API.DEFAULT_API_URL); } catch {}
      }
      _updateProfileButton(existing.trim());
      return;
    }
    beforePrompt?.();
    return new Promise(resolve => _showOnboarding(resolve));
  }

  function _revealAppShell() {
    if (_appShellRevealed) return;
    _appShellRevealed = true;
    $('screen-home')?.classList.remove('hidden');
    UI.hideSplash();
  }

  function _showOnboarding(onDone) {
    const screen = document.getElementById('onboarding-screen');
    if (!screen) { onDone?.(); return; }

    screen.classList.remove('hidden');

    const nameInput      = document.getElementById('ob-name');
    const serverInput    = document.getElementById('ob-server');
    const serverField    = document.getElementById('ob-server-field');
    const serverHint     = document.getElementById('ob-server-hint');
    const changeBtn      = document.getElementById('ob-change-server');
    const continueBtn    = document.getElementById('ob-continue');
    const skipBtn        = document.getElementById('ob-skip');

    // Pre-fill server URL with the auto-detected default
    const defaultUrl = window.API?.DEFAULT_API_URL || '';
    const isProduction = defaultUrl.includes('onrender.com') || defaultUrl.includes('render.com');

    if (serverInput && !serverInput.value) {
      serverInput.value = defaultUrl;
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
      const name   = (nameInput?.value || '').trim();
      const server = (serverInput?.value || '').trim() || defaultUrl;

      if (!name) {
        nameInput?.classList.add('ob-error');
        nameInput?.focus();
        nameInput?.setAttribute('aria-invalid', 'true');
        return;
      }
      nameInput?.classList.remove('ob-error');

      ac.abort();

      await DB.setSetting('student_name', name).catch(() => {});

      if (server) {
        await DB.setSetting('api_url', server).catch(() => {});
        if (window.API?.setApiUrl) {
          try { API.setApiUrl(server); } catch {}
        }
      }

      _updateProfileButton(name);
      screen.classList.add('hidden');
      onDone?.();
    }

    continueBtn?.addEventListener('click', () => _save(), { signal });
    skipBtn?.addEventListener('click', () => {
      const name = (nameInput?.value || '').trim();
      if (!name) { nameInput?.focus(); return; }
      _save();
    }, { signal });
    nameInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') isProduction ? _save() : serverInput?.focus();
    }, { signal });
    serverInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') _save();
    }, { signal });

    nameInput?.focus();
  }

  function _updateProfileButton(name) {
    const label = document.getElementById('nav-student-name');
    if (label) label.textContent = name.length > 10 ? name.slice(0, 10) + '…' : name;
  }

  async function _openProfileSettings() {
    const name      = await DB.getSetting('student_name', '').catch(() => '');
    const serverUrl = await DB.getSetting('api_url', API.DEFAULT_API_URL).catch(() => API.DEFAULT_API_URL);

    const nameInput   = document.getElementById('ob-name');
    const serverInput = document.getElementById('ob-server');

    if (nameInput)   nameInput.value   = name;
    if (serverInput) serverInput.value = serverUrl;

    return new Promise(resolve => _showOnboarding(() => {
      toast('Profile updated!', 'success');
      resolve();
    }));
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
    $('btn-home')?.addEventListener('click', () => loadHome());

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
      window.TTS?.toggle();
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
  }

  // ════════════════════════
  // SCREEN ROUTING
  // ════════════════════════

  function showScreen(name) {
    if (!name) return;
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

    UI.setBreadcrumb(name === 'home' ? 'Home' : null);
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

  async function loadHome() {
    showScreen('home');

    // Hide drill-down sections immediately
    ['subject-section', 'chapter-section', 'lesson-section']
      .forEach(id => $( id)?.classList.add('hidden'));

    await UI.renderHomeStats();
    await UI.renderRecentAttempts();
    await UI.renderAvailableQuizzes(quiz => TEST_PLAYER.startTest(quiz.quiz_id, quiz.default_mode || 'practice'));

    await UI.renderBatchGrid(async batch => {
      _homeBatch   = batch;
      _homeSubject = null;
      await UI.renderSubjectGrid(batch.name, async subject => {
        _homeSubject = subject;
        await UI.renderChapterList(batch.name, subject, chapter => {
          QUIZ.startQuiz(batch.name, subject, chapter, 'practice');
        });
      });
    });
  }

  // Lightweight stats refresh — called after quiz end, admin changes, etc.
  async function refreshHome() {
    await UI.renderHomeStats();
    await UI.renderRecentAttempts();
    await UI.renderAvailableQuizzes(quiz => TEST_PLAYER.startTest(quiz.quiz_id, quiz.default_mode || 'practice'));
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

  function _setModeButtonState(btn, isBoard) {
    if (!btn) return;
    const icon  = btn.querySelector('.nav-btn-icon');
    const label = btn.querySelector('.nav-btn-label');

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
    // Notifications
    toast,
    isTouchDevice,
    // Profile
    openProfileSettings: _openProfileSettings,
  };
})();

// ── Auto-start ──────────────────────────
document.addEventListener('DOMContentLoaded', APP.init);
