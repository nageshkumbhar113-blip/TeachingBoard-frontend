/* splash.js — NK Top Education splash screen controller */
(function () {
  'use strict';

  var MIN_SHOW_MS = 2200;   // minimum time splash stays visible
  var _startTime  = Date.now();
  var _appReady   = false;
  var _timerDone  = false;

  function _dismiss() {
    var el = document.getElementById('app-splash');
    if (!el || el.classList.contains('splash-hiding')) return;
    el.classList.add('splash-hiding');
    setTimeout(function () { el.classList.add('splash-gone'); }, 600);
  }

  function _tryDismiss() {
    if (_appReady && _timerDone) _dismiss();
  }

  // Minimum display timer
  var elapsed = Date.now() - _startTime;
  var remaining = Math.max(0, MIN_SHOW_MS - elapsed);
  setTimeout(function () { _timerDone = true; _tryDismiss(); }, remaining);

  // Called by app when ready to show UI
  window.SPLASH = {
    done: function () { _appReady = true; _tryDismiss(); }
  };
})();
