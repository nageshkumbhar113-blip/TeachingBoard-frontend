/* ════════════════════════════════════════
   videoTeacherSelect.js — YouTube Teacher Partner videos, student side
   Two-step flow: Exercise "🎬 N Videos" button → teacher cards (Step 1)
   → that teacher's parts if >1 (Step 2) → in-app embedded player.
   Student never leaves the app (no Browser.open(), no redirect to YouTube).
   Global: VIDEO_TEACHER_SELECT
   Additive-only — does not touch exerciseViewer.js's existing rendering,
   testPlayer.js/quiz.js untouched, existing showScreen()/navigate() reused
   as-is (see app.js:1256/1332).
════════════════════════════════════════ */

const VIDEO_TEACHER_SELECT = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let _ctx = null; // { type:'exercise', batch, subject, chapter, exercise } | { type:'concept', conceptId }
  let _orientationMql = null;
  let _orientationHandler = null;
  let _playerObserver = null;

  // ── Exercise-screen inline button ────────────────────────────────────────
  // Called by exerciseViewer.js right before showing a group's questions.
  // Best-effort: any failure (offline, no videos) just hides the button —
  // never blocks the existing questions view.
  async function checkAndShowButton(batch, subject, chapter, exercise) {
    return _checkAndShowButton('ev-videos-btn', { type: 'exercise', batch, subject, chapter, exercise },
      cards => `🎬 ${cards.length} Video${cards.length > 1 ? 's' : ''} Available`);
  }

  // ── Notes-screen inline button (concept detail) ──────────────────────────
  // Called by notesViewer.js right after rendering a concept. Same
  // best-effort contract as checkAndShowButton — never blocks the note.
  async function checkAndShowButtonForConcept(conceptId, conceptTitle) {
    return _checkAndShowButton('nv-videos-btn', { type: 'concept', conceptId, conceptTitle },
      cards => `🎬 ${cards.length} Video${cards.length > 1 ? 's' : ''} Available`);
  }

  async function _checkAndShowButton(btnId, ctx, labelFor) {
    const btn = $(btnId);
    if (!btn) return;
    btn.classList.add('hidden');
    if (!navigator.onLine) return;
    try {
      const cards = await _fetchCards(ctx);
      if (!cards.length) return;
      btn.textContent = labelFor(cards);
      btn.classList.remove('hidden');
      btn.onclick = () => open(ctx);
    } catch (err) {
      console.warn('VIDEO_TEACHER_SELECT: video-count check failed (non-critical)', err);
    }
  }

  function _fetchCards(ctx, teacherId) {
    return ctx.type === 'concept'
      ? API.fetchYoutubeVideosForExercise({ contentType: 'concept', conceptId: ctx.conceptId, teacherId })
      : API.fetchYoutubeVideosForExercise({ batch: ctx.batch, subject: ctx.subject, chapter: ctx.chapter, exercise: ctx.exercise, teacherId });
  }

  // ── Step 1: teacher cards ────────────────────────────────────────────────
  // Accepts either the new ctx object ({type, ...}) or the old positional
  // (batch, subject, chapter, exercise) form — exerciseViewer.js's existing
  // callers keep working unchanged.
  async function open(batchOrCtx, subject, chapter, exercise) {
    const ctx = (typeof batchOrCtx === 'object' && batchOrCtx !== null)
      ? batchOrCtx
      : { type: 'exercise', batch: batchOrCtx, subject, chapter, exercise };
    _ctx = ctx;
    APP?.navigate?.('video-teachers');
    $('vts-title').textContent = ctx.type === 'concept' ? `🎬 ${ctx.conceptTitle || 'Concept'} — Videos` : `🎬 Exercise ${ctx.exercise} — Videos`;
    const list = $('vts-list');
    list.innerHTML = '<p class="vts-empty">Loading…</p>';
    try {
      const cards = await _fetchCards(ctx);
      if (!cards.length) {
        list.innerHTML = '<p class="vts-empty">या Exercise साठी सध्या कुठलाही video उपलब्ध नाही.</p>';
        return;
      }
      list.innerHTML = cards.map(c => `
        <button type="button" class="vts-card" data-teacher="${_esc(c.teacher_id)}" data-name="${_esc(c.name)}">
          <span class="vts-thumb">${c.profile_photo ? `<img src="${_esc(c.profile_photo)}" alt="">` : '👤'}</span>
          <span class="vts-info">
            <strong>${_esc(c.name)}${c.is_premium ? ' ⭐' : ''}</strong>
            <small>${_esc(c.teaching_subject || '')}${c.teaching_subject ? ' · ' : ''}${c.video_count} video${c.video_count > 1 ? 's' : ''}${c.open_count ? ` · ${c.open_count} वेळा पाहिलं` : ''}</small>
          </span>
          ${c.is_premium ? '<span class="vts-badge">⭐ Featured</span>' : ''}
        </button>
      `).join('');
      list.querySelectorAll('.vts-card').forEach(card => {
        card.addEventListener('click', () => _openParts(card.dataset.teacher, card.dataset.name));
      });
    } catch (err) {
      list.innerHTML = `<p class="vts-empty">Videos load करता आले नाहीत — internet तपासा.</p>`;
    }
  }

  // ── Step 2: chosen teacher's parts (skip straight to player if just 1) ──
  async function _openParts(teacherId, teacherName) {
    if (!_ctx) return;
    try {
      const parts = await _fetchCards(_ctx, teacherId);
      if (!parts.length) return; // shouldn't happen (card implies ≥1), fail quiet
      if (parts.length === 1) {
        _openPlayer(parts[0].id, parts[0].video_id, parts[0].part_label || teacherName);
        return;
      }
      APP?.navigate?.('video-teachers');
      $('vts-title').textContent = `🎬 ${teacherName} — Parts`;
      const list = $('vts-list');
      list.innerHTML = parts.map(p => `
        <button type="button" class="vts-part-card" data-id="${_esc(p.id)}" data-video="${_esc(p.video_id)}" data-label="${_esc(p.part_label || 'Part')}">
          ▶ ${_esc(p.part_label || 'Video')}
        </button>
      `).join('');
      list.querySelectorAll('.vts-part-card').forEach(card => {
        card.addEventListener('click', () => _openPlayer(card.dataset.id, card.dataset.video, card.dataset.label));
      });
    } catch (err) {
      console.warn('VIDEO_TEACHER_SELECT: failed to load parts', err);
    }
  }

  // ── Embedded player ───────────────────────────────────────────────────────
  // dbId = the YoutubeTeacherVideo document _id (for the open-count metric),
  // youtubeId = the actual YouTube video ID (for the iframe embed) — these
  // are two different IDs, must not be conflated (see backend's
  // /video-open/:videoId route, which expects the Mongo _id).
  function _openPlayer(dbId, youtubeId, label) {
    const iframe = $('vp-iframe');
    if (!iframe || !youtubeId) return;
    // No autoplay — YouTube policy + student explicitly presses ▶ inside the
    // iframe itself once it loads.
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0`;
    $('vp-title').textContent = `▶ ${label || 'Video'}`;
    APP?.navigate?.('video-player');
    _bindRotateToFill();
    _watchPlayerScreenClose(iframe);
    if (dbId) API.recordYoutubeVideoOpen(dbId).catch(() => {}); // best-effort metric
  }

  // Rotate-to-fill: fills the viewport in landscape, pure CSS/JS (no native
  // Android change needed). A true HTML5-Fullscreen ⛶ button inside the
  // YouTube player needs a small native WebChromeClient change in
  // MainActivity.java — deliberately NOT done here (needs an on-device
  // build+test pass, out of scope for this web-layer change).
  function _bindRotateToFill() {
    if (_orientationMql) return; // already bound
    _orientationMql = window.matchMedia('(orientation: landscape)');
    _orientationHandler = e => document.body.classList.toggle('vp-landscape-fill', e.matches);
    _orientationHandler(_orientationMql);
    _orientationMql.addEventListener('change', _orientationHandler);
  }
  function _unbindRotateToFill() {
    if (_orientationMql && _orientationHandler) {
      _orientationMql.removeEventListener('change', _orientationHandler);
    }
    _orientationMql = null;
    _orientationHandler = null;
    document.body.classList.remove('vp-landscape-fill');
  }

  // Stop playback (and clean up the orientation listener) the moment the
  // player screen is navigated away from, however that happens (back
  // button, bottom-nav tap, etc) — MutationObserver on the screen's own
  // hidden-class instead of hooking into showScreen()/navigate(), so this
  // stays purely additive and never touches the shared navigation code.
  function _watchPlayerScreenClose(iframe) {
    _playerObserver?.disconnect();
    const screenEl = $('screen-video-player');
    if (!screenEl) return;
    _playerObserver = new MutationObserver(() => {
      if (screenEl.classList.contains('hidden')) {
        iframe.src = '';
        _unbindRotateToFill();
        _playerObserver.disconnect();
        _playerObserver = null;
      }
    });
    _playerObserver.observe(screenEl, { attributes: true, attributeFilter: ['class'] });
  }

  return { checkAndShowButton, checkAndShowButtonForConcept, open };
})();

window.VIDEO_TEACHER_SELECT = VIDEO_TEACHER_SELECT;
