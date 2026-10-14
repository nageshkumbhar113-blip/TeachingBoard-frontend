const APP = (() => {
  const $ = id => document.getElementById(id);
  const THEMES = ['theme-dark', 'theme-light', 'theme-contrast'];
  const THEME_LABELS = {
    'theme-dark': 'Dark',
    'theme-light': 'Light',
    'theme-contrast': 'High Contrast',
  };
  const ADMIN_THEME_KEY = 'admin_theme';
  const ADMIN_THEME_DEFAULT = 'theme-light';
  const STUDENT_APP_URL = '/student';
  const UPDATE_EVENT_KEY = 'teachingboard_last_update';
  const UPDATE_CHANNEL_NAME = 'teachingboard_updates';

  let _toastQueue = [];
  let _toastBusy = false;
  let _updatesChannel = null;
  let _swRefreshing = false;
  let _hadServiceWorkerController = !!navigator.serviceWorker?.controller;

  async function init() {
    _installGlobalGuards();
    _installBackHandling();

    try {
      await DB.open();
      await DB.initDefaultBatches();
      DB.flushPendingWrites?.().catch(err => console.warn('pending write flush failed', err));

      await I18N.init();
      setTheme(await DB.getSetting(ADMIN_THEME_KEY, ADMIN_THEME_DEFAULT), { silent: true });

      _registerSW();
      _bindActions();
      _initModules();
      await renderDashboardStats();
      ADMIN.open();
      _startBackground();
      window.SPLASH?.done();
    } catch (err) {
      window.SPLASH?.done();
      console.error('Admin app init error', err);
      toast('Admin app failed to start. Please refresh the page.', 'error');
    }
  }

  function _installGlobalGuards() {
    window.addEventListener('error', e => {
      console.error('GLOBAL ERROR:', e.error || e.message || e);
      toast('System error occurred. Recovering...', 'error');
    });

    window.addEventListener('unhandledrejection', e => {
      console.error('PROMISE ERROR:', e.reason);
      toast('Background task failed. Retrying when possible...', 'error');
    });
  }

  // ════════════════════════
  // BACK (phone Back button / gesture, browser Back)
  // ════════════════════════
  // Order: close the side menu or the "More" sheet -> close the top popup (as tapping outside
  // it does) -> from any tab go to Dashboard -> on Dashboard or the PIN
  // screen a 2nd Back within 2 s leaves the app. Android's Back reaches
  // this only through @capacitor/app's backButton event: with no listener,
  // Capacitor closed the app on the first press.
  const EXIT_WINDOW_MS = 2000;
  let _exitArmedAt = 0;
  let _webLeaving = false;

  const _isShown = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

  // Popups are fixed layers covering the screen (the admin shell itself is
  // one too, so it is skipped); the top one has the highest z-index.
  function _topPopup() {
    const skip = new Set(['admin-overlay', 'admin-sidebar-backdrop', 'app-splash', 'splash']);
    let top = null, topZ = -Infinity;
    for (const el of document.body.querySelectorAll('*')) {
      if (skip.has(el.id)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.offsetWidth < innerWidth * 0.9 || el.offsetHeight < innerHeight * 0.9) continue;
      const z = Number(cs.zIndex) || 0;
      if (z >= topZ) { top = el; topZ = z; }
    }
    return top;
  }

  function _closePopup(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // "tap outside"
    if (!_isShown(el)) return true;
    const x = el.querySelector('[aria-label="Close"], [aria-label="close"], [id$="-close"], [id$="-close-btn"], .modal-close, .cm-preview-close');
    if (x && _isShown(x)) { x.click(); return !_isShown(el); }
    return false;
  }

  function _leaveApp() {
    _exitArmedAt = 0;
    const App = window.Capacitor?.Plugins?.App;
    if (window.Capacitor?.isNativePlatform?.() && App) {
      (App.minimizeApp?.() || Promise.reject()).catch(() => App.exitApp?.());
      return;
    }
    _webLeaving = true;
    history.back();
    setTimeout(() => {
      if (!_webLeaving) return;
      _webLeaving = false;
      history.pushState({ tbBack: true }, '');
    }, 1000);
  }

  function _armOrLeave() {
    if (Date.now() - _exitArmedAt < EXIT_WINDOW_MS) { _leaveApp(); return; }
    _exitArmedAt = Date.now();
    toast('बाहेर पडण्यासाठी पुन्हा Back दाबा', 'info', EXIT_WINDOW_MS);
  }

  function handleBack() {
    const sidebar = $('admin-sidebar');
    if (sidebar?.classList.contains('sidebar-open')) { $('admin-menu-btn')?.click(); return; }
    // Phone "More" sheet: close it the way tapping outside it does.
    if (_isShown($('admin-more-drawer'))) { $('admin-more-backdrop')?.click(); return; }

    const popup = _topPopup();
    if (popup) { if (!_closePopup(popup)) _armOrLeave(); return; }

    if (_isShown($('admin-pin-gate'))) { _armOrLeave(); return; }

    const dashboardTab = document.querySelector('.atab[data-tab="dashboard"]');
    if (dashboardTab && !dashboardTab.classList.contains('active')) {
      dashboardTab.click();
      window.scrollTo?.(0, 0);
      return;
    }
    _armOrLeave();
  }

  function _installBackHandling() {
    const App = window.Capacitor?.Plugins?.App;
    if (window.Capacitor?.isNativePlatform?.() && App?.addListener) {
      App.addListener('backButton', () => handleBack());
      return;
    }
    // Browser: one guard entry on top of the history, so Back arrives here.
    history.pushState({ tbBack: true }, '');
    window.addEventListener('popstate', () => {
      if (_webLeaving) { history.back(); return; }
      history.pushState({ tbBack: true }, '');
      handleBack();
    });
  }

  function _bindActions() {
    $('btn-open-student')?.addEventListener('click', exitAdmin);
  }

  function _initModules() {
    const modules = [
      { name: 'ADMIN', mod: window.ADMIN },
      { name: 'TEST_BUILDER', mod: window.TEST_BUILDER },
    ];

    for (const { name, mod } of modules) {
      if (!mod?.init) {
        console.warn(`Module ${name} not found`);
        continue;
      }
      try {
        mod.init();
      } catch (err) {
        console.error(`${name}.init() failed`, err);
      }
    }
  }

  function _startBackground() {
    SYNC.autoSync?.().catch(err => console.warn('autoSync error', err));
  }

  async function renderDashboardStats() {
    const [questions, quizzes, published, attempts] = await Promise.all([
      DB.getAllQuestions(),
      DB.getAllQuizzes(),
      DB.getQuizzesByStatus('published'),
      DB.getAllAttempts(),
    ]);

    _setText('admin-stat-questions', questions.length);
    _setText('admin-stat-quizzes', quizzes.length);
    _setText('admin-stat-published', published.length);
    _setText('admin-stat-attempts', attempts.length);
  }

  async function refreshHome() {
    await renderDashboardStats();
    _broadcastUpdate();
  }

  function _broadcastUpdate() {
    const stamp = String(Date.now());
    try { localStorage.setItem(UPDATE_EVENT_KEY, stamp); } catch {}

    if (!_updatesChannel && 'BroadcastChannel' in window) {
      _updatesChannel = new BroadcastChannel(UPDATE_CHANNEL_NAME);
    }
    _updatesChannel?.postMessage({ type: 'db-updated', at: stamp });
  }

  function _setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text ?? '';
  }

  function setTheme(theme, { silent = false } = {}) {
    if (!THEMES.includes(theme)) theme = ADMIN_THEME_DEFAULT;
    document.body.classList.remove(...THEMES);
    document.body.classList.add(theme);
    if (!silent) toast(`Theme: ${THEME_LABELS[theme]}`, 'info');
  }

  function exitAdmin() {
    window.location.href = `${STUDENT_APP_URL}?source=admin`;
  }

  function openStudentQuiz(quizId, mode = 'practice') {
    const url = `${STUDENT_APP_URL}?quiz=${encodeURIComponent(quizId)}&mode=${encodeURIComponent(mode)}&source=admin`;
    window.location.href = url;
  }

  function toast(msg, type = 'info', duration = 2800) {
    if (_toastQueue.length >= 8) _toastQueue.shift();
    _toastQueue.push({ msg, type, duration });
    _drainToastQueue();
  }

  function _drainToastQueue() {
    if (_toastBusy || !_toastQueue.length) return;
    const { msg, type, duration } = _toastQueue.shift();
    _showToast(msg, type, duration);
  }

  function _showToast(msg, type, duration) {
    _toastBusy = true;
    const container = $('toast-container') || document.body;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.addEventListener('click', () => _dismissToast(el), { once: true });
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => _dismissToast(el), duration);
  }

  function _dismissToast(el) {
    if (!el.isConnected) return;
    el.classList.add('fade-out');
    setTimeout(() => {
      el.remove();
      _toastBusy = false;
      _drainToastQueue();
    }, 350);
  }

  function _registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('../sw.js')
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              toast('Update available - refresh to apply', 'info');
            }
          });
        });
      })
      .catch(err => console.warn('SW registration failed', err));

    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'SW_UPDATED') {
        toast('Admin app updated. Refreshing...', 'info');
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

  // Android-safe confirm/prompt (native dialogs blocked on WebView)
  function confirmAsync(message) {
    return new Promise(resolve => {
      const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const overlay = document.createElement('div');
      overlay.className = 'admin-dialog-overlay';
      overlay.innerHTML = `<div class="admin-dialog-box">
        <p class="admin-dialog-msg">${esc(message)}</p>
        <div class="admin-dialog-btns">
          <button class="admin-dialog-no">रद्द करा</button>
          <button class="admin-dialog-yes">होय, पुढे जा</button>
        </div></div>`;
      document.body.appendChild(overlay);
      const done = r => { overlay.remove(); resolve(r); };
      overlay.querySelector('.admin-dialog-yes').addEventListener('click', () => done(true));
      overlay.querySelector('.admin-dialog-no').addEventListener('click',  () => done(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
    });
  }

  function promptAsync(message, inputType = 'text', defaultValue = '') {
    return new Promise(resolve => {
      const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const overlay = document.createElement('div');
      overlay.className = 'admin-dialog-overlay';
      overlay.innerHTML = `<div class="admin-dialog-box">
        <p class="admin-dialog-msg">${esc(message)}</p>
        <input class="admin-dialog-input" type="${esc(inputType)}" value="${esc(defaultValue)}">
        <div class="admin-dialog-btns">
          <button class="admin-dialog-no">रद्द करा</button>
          <button class="admin-dialog-yes">OK</button>
        </div></div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('.admin-dialog-input');
      setTimeout(() => input.focus(), 50);
      const done = r => { overlay.remove(); resolve(r); };
      overlay.querySelector('.admin-dialog-yes').addEventListener('click', () => done(input.value.trim() || null));
      overlay.querySelector('.admin-dialog-no').addEventListener('click',  () => done(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
    });
  }

  return {
    init,
    toast,
    refreshHome,
    renderDashboardStats,
    setTheme,
    exitAdmin,
    openStudentQuiz,
    confirmAsync,
    promptAsync,
    handleBack,
  };
})();

document.addEventListener('DOMContentLoaded', APP.init);
