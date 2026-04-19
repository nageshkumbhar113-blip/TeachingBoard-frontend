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

  // ════════════════════════
  // STATE
  // ════════════════════════

  const THEMES      = ['theme-dark', 'theme-light', 'theme-contrast'];
  const THEME_LABELS = { 'theme-dark': 'Dark', 'theme-light': 'Light', 'theme-contrast': 'High Contrast' };

  const UI_MODES = ['normal', 'board'];

  let _currentScreen = 'home';
  let _homeBatch     = null;
  let _homeSubject   = null;
  let _globalGuardsInstalled = false;

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

      // 2. Appearance — apply before any render to avoid flash
      const theme  = await DB.getSetting('theme', 'theme-dark');
      setTheme(theme, { silent: true });

      const uiMode = await DB.getSetting('ui_mode', 'normal');
      setUiMode(uiMode, { silent: true });

      // 3. i18n — before any UI text is rendered
      await I18N.init();

      // 4. Service worker
      _registerSW();

      // 5. Wire nav
      _bindNav();

      // 6. Init feature modules (DB must be open)
      _initModules();

      // 7. Render home
      await loadHome();

      // 8. Reveal app
      UI.hideSplash();

      // 9. Background tasks — non-blocking
      _startBackground();

      // 10. Suggest board mode on very large screens (non-blocking)
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
      { name: 'ADMIN',        mod: window.ADMIN },
      { name: 'TEST_BUILDER', mod: window.TEST_BUILDER },
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
    // Auto-sync: upload pending, fetch remote — runs silently
    if (window.SYNC?.autoSync) {
      SYNC.autoSync().catch(err => console.warn('autoSync error', err));
    } else if (window.SYNC?.preloadRemoteQuiz) {
      SYNC.preloadRemoteQuiz().catch(() => {});
    }
  }

  function _handleInitError(err) {
    console.error('❌ App init error', err);
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
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      setTheme(next);
      await DB.setSetting('theme', next);
    });

    $('btn-lang')?.addEventListener('click', () => {
      if (!window.I18N) return;
      const next = I18N.cycleLang();
      toast(`Language: ${next.label}`, 'info');
    });

    $('btn-tts')?.addEventListener('click', () => {
      window.TTS?.toggle();
    });

    $('btn-admin')?.addEventListener('click', () => {
      window.ADMIN?.open();
    });

    $('btn-analytics')?.addEventListener('click', () => {
      window.ANALYTICS?.open();
    });

    $('btn-ui-mode')?.addEventListener('click', async () => {
      const next = _activeUiMode() === 'board' ? 'normal' : 'board';
      setUiMode(next);
      await DB.setSetting('ui_mode', next);
    });
  }

  // ════════════════════════
  // SCREEN ROUTING
  // ════════════════════════

  function showScreen(name) {
    if (!name) return;
    _currentScreen = name;

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    const el = $('screen-' + name);
    if (el) {
      el.classList.remove('hidden');
      // Trigger entrance animation if screen uses anim-fade-in
      el.classList.remove('anim-fade-in');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('anim-fade-in');
    } else {
      console.warn(`showScreen: no element #screen-${name}`);
    }

    UI.setBreadcrumb(name === 'home' ? 'Home' : null);
  }

  // Alias kept for backward compat (quiz.js, etc.)
  function navigate(name) { showScreen(name); }

  function setBreadcrumb(text) { UI.setBreadcrumb(text); }

  function currentScreen() { return _currentScreen; }

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

  // ════════════════════════
  // THEME
  // ════════════════════════

  function _activeTheme() {
    return THEMES.find(t => document.body.classList.contains(t)) || 'theme-dark';
  }

  function setTheme(theme, { silent = false } = {}) {
    if (!THEMES.includes(theme)) {
      console.warn(`setTheme: unknown theme "${theme}", falling back to theme-dark`);
      theme = 'theme-dark';
    }
    document.body.classList.remove(...THEMES);
    document.body.classList.add(theme);

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

  function setUiMode(mode, { silent = false } = {}) {
    if (!UI_MODES.includes(mode)) mode = 'normal';
    const isBoard = mode === 'board';

    document.body.classList.toggle('mode-board', isBoard);

    const btn = $('btn-ui-mode');
    if (btn) {
      btn.textContent = isBoard ? '📱 Normal' : '🖥️ Board';
      btn.title       = isBoard ? 'Switch to Normal Mode' : 'Switch to Board Mode (4K display)';
      btn.setAttribute('aria-pressed', String(isBoard));
    }

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

    navigator.serviceWorker.register('./sw.js')
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
      }
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
    // Home
    loadHome,
    refreshHome,
    // Appearance
    setTheme,
    setUiMode,
    // Notifications
    toast,
    isTouchDevice,
  };
})();

// ── Auto-start ──────────────────────────
document.addEventListener('DOMContentLoaded', APP.init);
