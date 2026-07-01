/* global API, DB, APP, pdfjsLib */
'use strict';

const NOTES_PLAYER = (() => {
  const $ = id => document.getElementById(id);

  // ── State ─────────────────────────────────────────────────────────────────
  let _pdfDoc      = null;
  let _totalPages  = 0;
  let _currentPage = 1;
  let _scale       = 1;
  let _rendering   = false;
  let _currentNoteId = null;

  let _cachedProfile   = null;

  // Pinch zoom state
  let _pinchStartDist = 0;
  let _pinchStartScale = 1;
  let _cssScale = 1;

  // Swipe state
  let _swipeStartX = 0;
  let _swipeStartY = 0;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _show(id) { const el = $(id); if (el) el.classList.remove('hidden'); }
  function _hide(id) { const el = $(id); if (el) el.classList.add('hidden');    }
  function _setText(id, t) { const el = $(id); if (el) el.textContent = t;     }
  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                           .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function _fmtSize(b) {
    if (!b) return '';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── AES-256-GCM Encryption (Web Crypto) ──────────────────────────────────
  async function _deriveKey(noteId, studentCode) {
    const raw = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(studentCode + '|' + noteId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('TB-Notes-v1'), iterations: 10000, hash: 'SHA-256' },
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function _encrypt(buffer, key) {
    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);
    return { data: encrypted, iv };
  }

  async function _decrypt(entry, key) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, key, entry.data);
  }

  // ── Watermark ─────────────────────────────────────────────────────────────
  function _addWatermark(canvas) {
    const ctx   = canvas.getContext('2d');
    const name  = _cachedProfile?.name || _cachedProfile?.student_code || 'Student';
    const batch = (_cachedProfile?.assigned_batches || [])[0] || '';
    const date  = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const size  = Math.max(14, Math.floor(canvas.width / 22));

    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle   = '#000000';
    ctx.font        = `bold ${size}px Arial, sans-serif`;
    ctx.textAlign   = 'center';

    const rows = 3;
    for (let r = 0; r < rows; r++) {
      ctx.save();
      ctx.translate(canvas.width / 2, (canvas.height / rows) * r + canvas.height / (rows * 2));
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(name,             0, 0);
      ctx.fillText('Nks EduOrbit', 0, size * 1.8);
      ctx.fillText(batch,            0, size * 3.6);
      ctx.fillText(date,             0, size * 5.4);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── PDF Rendering ─────────────────────────────────────────────────────────
  async function _renderPage(num) {
    if (_rendering || !_pdfDoc) return;
    _rendering = true;
    const canvas = $('np-canvas');
    if (!canvas) { _rendering = false; return; }

    try {
      const page     = await _pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });
      canvas.width   = viewport.width;
      canvas.height  = viewport.height;
      canvas.style.width  = '100%';
      canvas.style.height = 'auto';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      _addWatermark(canvas);
    } catch (e) {
      console.error('PDF render error', e);
    }

    _currentPage = num;
    _setText('np-page-info', `${_currentPage} / ${_totalPages}`);
    $('np-prev')?.toggleAttribute('disabled', _currentPage <= 1);
    $('np-next')?.toggleAttribute('disabled', _currentPage >= _totalPages);
    _rendering = false;
  }

  // ── Pinch Zoom ────────────────────────────────────────────────────────────
  function _setupPinchZoom(canvas) {
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        _pinchStartDist  = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        _pinchStartScale = _cssScale;
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        _cssScale = Math.min(3.0, Math.max(0.8, _pinchStartScale * (dist / _pinchStartDist)));
        canvas.style.transform       = `scale(${_cssScale})`;
        canvas.style.transformOrigin = 'top center';
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) {
        // Clamp to sensible range
        _cssScale = Math.min(3.0, Math.max(0.8, _cssScale));
      }
    });
  }

  // ── Swipe Navigation ─────────────────────────────────────────────────────
  function _setupSwipe(el) {
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      _swipeStartX = e.touches[0].clientX;
      _swipeStartY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchend', e => {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - _swipeStartX;
      const dy = e.changedTouches[0].clientY - _swipeStartY;
      // Only horizontal swipe (dx dominant, >50px)
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && _cssScale <= 1.1) {
        if (dx < 0 && _currentPage < _totalPages) _renderPage(_currentPage + 1);
        if (dx > 0 && _currentPage > 1)           _renderPage(_currentPage - 1);
      }
    }, { passive: true });
  }

  // ── Load PDF (with cache) ─────────────────────────────────────────────────
  async function _loadPdf(noteId, studentCode) {
    _currentNoteId = noteId;
    _cssScale = 1;
    const canvas = $('np-canvas');
    if (canvas) { canvas.style.transform = ''; }

    _show('np-loader');
    _hide('np-canvas');
    _hide('np-error');

    let buffer;

    // 1. Check IndexedDB cache first
    try {
      const cached = await DB.getNoteCache(noteId);
      if (cached) {
        _setText('np-loader-msg', 'Loading from saved copy…');
        const key = await _deriveKey(noteId, studentCode);
        buffer    = await _decrypt(cached, key);
        _setText('np-cache-badge', '✅ Offline');
        _show('np-cache-badge');
      }
    } catch (_) { /* cache miss or decryption error — fall through to network */ }

    // 2. Network fetch if not in cache
    if (!buffer) {
      _setText('np-loader-msg', 'Downloading…');
      _hide('np-cache-badge');
      try {
        buffer = await API.fetchNoteView(noteId);
      } catch (e) {
        _hide('np-loader');
        _show('np-error');
        _setText('np-error-msg', 'Could not load note. Check your connection and try again.');
        return;
      }

      // Encrypt and store in IDB for future use
      try {
        const key       = await _deriveKey(noteId, studentCode);
        const encrypted = await _encrypt(buffer, key);
        await DB.putNoteCache(noteId, encrypted.data, encrypted.iv);
      } catch (_) { /* cache write failure is non-fatal */ }
    }

    // 3. Load into PDF.js
    _setText('np-loader-msg', 'Rendering…');
    try {
      _pdfDoc     = await pdfjsLib.getDocument({ data: buffer }).promise;
      _totalPages = _pdfDoc.numPages;
    } catch (e) {
      _hide('np-loader');
      _show('np-error');
      _setText('np-error-msg', 'Could not read PDF. It may be corrupted.');
      return;
    }

    _hide('np-loader');
    _show('np-canvas');
    await _renderPage(1);
  }

  // ── Open viewer ───────────────────────────────────────────────────────────
  async function openNote(noteId, title, studentCode) {
    const overlay = $('np-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    _setText('np-title', title);
    _setText('np-page-info', '');
    _currentPage = 1;
    _pdfDoc      = null;
    _totalPages  = 0;

    _show('np-loader');
    _hide('np-canvas');
    _hide('np-error');
    _hide('np-cache-badge');

    // Ensure PDF.js is ready
    if (typeof pdfjsLib === 'undefined') {
      _setText('np-loader-msg', 'Loading PDF engine…');
      try {
        await _waitForPdfJs();
      } catch (e) {
        _hide('np-loader');
        _show('np-error');
        _setText('np-error-msg', e.message || 'PDF engine could not load. Check your internet connection.');
        return;
      }
    }

    // Ensure profile cached for watermark
    if (!_cachedProfile) _cachedProfile = await API.getStudentProfile().catch(() => null);

    await _loadPdf(noteId, studentCode);
  }

  function _waitForPdfJs(timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') return resolve();
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        if (typeof pdfjsLib !== 'undefined') return resolve();
        if (Date.now() >= deadline) return reject(new Error('PDF engine failed to load. Please check your internet connection and try again.'));
        setTimeout(check, 150);
      };
      setTimeout(check, 150);
    });
  }

  function _closeViewer() {
    const overlay = $('np-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
    _pdfDoc        = null;
    _currentNoteId = null;
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  async function loadNotesList(batch, subject) {
    const listEl = $('np-notes-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="np-list-msg">Loading…</p>';

    let result;
    try {
      result = await API.fetchStudentNotes({ batch, subject });
    } catch (e) {
      listEl.innerHTML = '<p class="np-list-msg">Could not load notes. Check your connection.</p>';
      return;
    }

    const notes = result.notes || [];

    // Cache student profile for encryption key + watermark
    if (!_cachedProfile) _cachedProfile = await API.getStudentProfile().catch(() => null);

    // Check which notes are cached
    const cacheStatus = {};
    for (const n of notes) {
      try {
        const c = await DB.getNoteCache(n.note_id);
        cacheStatus[n.note_id] = !!c;
      } catch (_) { cacheStatus[n.note_id] = false; }
    }

    if (!notes.length) {
      listEl.innerHTML = '<p class="np-list-msg">No notes available for this subject yet.</p>';
      return;
    }

    listEl.innerHTML = notes.map(n => `
      <div class="np-note-card" data-id="${_esc(n.note_id)}" data-title="${_esc(n.title)}" role="button" tabindex="0">
        <div class="np-note-icon">📄</div>
        <div class="np-note-info">
          <div class="np-note-title">${_esc(n.title)}</div>
          <div class="np-note-meta">${_esc(n.subject || '')} &nbsp;•&nbsp; ${_fmtSize(n.file_size_bytes)}</div>
        </div>
        <div class="np-note-status">${cacheStatus[n.note_id] ? '✅' : '☁️'}</div>
      </div>
    `).join('');

    const studentCode = _cachedProfile?.student_code || '';

    listEl.querySelectorAll('.np-note-card').forEach(card => {
      const open = () => openNote(card.dataset.id, card.dataset.title, studentCode);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    });

    // Clean expired cache entries in background
    DB.clearExpiredNoteCache().catch(() => {});
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    const canvas = $('np-canvas');
    if (canvas) {
      canvas.oncontextmenu = () => false;
      _setupPinchZoom(canvas);
    }

    const viewerBody = $('np-viewer-body');
    if (viewerBody) _setupSwipe(viewerBody);

    $('np-close')?.addEventListener('click', _closeViewer);
    $('np-prev')?.addEventListener('click',  () => { if (_currentPage > 1) _renderPage(_currentPage - 1); });
    $('np-next')?.addEventListener('click',  () => { if (_currentPage < _totalPages) _renderPage(_currentPage + 1); });

    // Close on overlay background tap
    $('np-overlay')?.addEventListener('click', e => {
      if (e.target === $('np-overlay')) _closeViewer();
    });
  }

  return { init, loadNotesList, openNote };
})();

window.NOTES_PLAYER = NOTES_PLAYER;
