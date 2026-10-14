/* ════════════════════════════════════════
   ui.js — UI Utilities + Rendering Module
   Handles: Toast, Modal, Loader,
            Splash, Home renders,
            Nav score, Breadcrumb
   Global: UI
════════════════════════════════════════ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  async function _getAllowedBatches() {
    const saved = await DB.getSetting('student_allowed_batches', []).catch(() => []);
    return Array.isArray(saved)
      ? [...new Set(saved.map(item => String(item || '').trim()).filter(Boolean))]
      : [];
  }

  function _filterByAllowedBatches(items, allowedBatches, key = 'batch') {
    if (!Array.isArray(items)) return [];
    if (!allowedBatches.length) return [];
    return items.filter(item => allowedBatches.includes(String(item?.[key] || '').trim()));
  }

  async function _getCurrentStudentProfile() {
    return await DB.getSetting('student_profile', null).catch(() => null);
  }

  function _filterAttemptsForCurrentStudent(attempts, profile) {
    if (!Array.isArray(attempts)) return [];
    if (!profile) return [];

    const studentCode = String(profile.student_code || '').trim().toUpperCase();
    const studentName = String(profile.name || '').trim();
    return attempts.filter(attempt => {
      const attemptCode = String(attempt.student_code || '').trim().toUpperCase();
      if (studentCode && attemptCode) return attemptCode === studentCode;
      return studentName && String(attempt.student_name || '').trim() === studentName;
    });
  }

  // ════════════════════════
  // REMOTE / KEYBOARD (TV D-pad) NAVIGATION
  // ════════════════════════
  // Custom clickable <div> "cards" (batch/subject/chapter/student cards etc.)
  // aren't natively focusable or keyboard-activatable like <button>/<a>.
  // makeFocusable() marks such an element so a TV remote's D-pad can tab onto
  // it, and the global keydown listener below fires its existing click
  // handler on Enter/Space — the click handler itself is never touched.

  function makeFocusable(el) {
    if (!el) return el;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    return el;
  }

  // Single app-wide listener: Enter/Space/NumpadEnter on a focused element
  // triggers a synthetic click on that same element. Text inputs, textareas,
  // selects and contenteditable are excluded so normal typing/form-submit
  // behavior (e.g. the login/onboarding fields) is completely unaffected.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.code !== 'NumpadEnter') return;
    const target = e.target;
    if (!target || target === document.body) return;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
    if (tag === 'BUTTON' || tag === 'A') return; // native elements already handle this themselves
    if (target.getAttribute('tabindex') === null) return; // only elements we explicitly made focusable
    e.preventDefault();
    target.click();
  });

  // ════════════════════════
  // GRID ARROW-KEY NAVIGATION (TV D-pad)
  // ════════════════════════
  // Lets Up/Down/Left/Right move focus between sibling "cards"/answer
  // buttons in a grid, instead of only linear Tab order. Delegated +
  // geometry-based (nearest neighbour in the pressed direction), so it
  // needs no per-screen wiring and keeps working after re-renders.
  //
  // .option-btn/.tf-btn (quiz + test-player answer grids) intentionally
  // only get Up/Down here — quiz.js/testPlayer.js already bind
  // ArrowLeft/ArrowRight globally to prev/next-question, a pre-existing
  // shortcut this must not override.
  const _GRID_ALL_DIRS_SELECTOR = '.batch-card, .subject-card, .chapter-item, .mtp-item, .vocab-test-card, .wtp-test-card';
  const _GRID_VERT_ONLY_SELECTOR = '.option-btn, .tf-btn';
  const _GRID_ITEM_SELECTOR = `${_GRID_ALL_DIRS_SELECTOR}, ${_GRID_VERT_ONLY_SELECTOR}`;

  document.addEventListener('keydown', e => {
    const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
    if (!dir) return;

    const active = document.activeElement;
    if (!active || !active.matches?.(_GRID_ITEM_SELECTOR)) return;
    if ((dir === 'left' || dir === 'right') && active.matches(_GRID_VERT_ONLY_SELECTOR)) return;

    const container = active.parentElement;
    if (!container) return;
    const items = Array.from(container.children).filter(el =>
      el !== active && el.matches(_GRID_ITEM_SELECTOR) && !el.disabled && el.offsetParent !== null
    );
    if (!items.length) return;

    const a  = active.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;

    let best = null, bestScore = Infinity;
    for (const el of items) {
      const r  = el.getBoundingClientRect();
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = ex - ax, dy = ey - ay;
      let primary, cross;
      if (dir === 'up')    { if (dy >= -1) continue; primary = -dy; cross = Math.abs(dx); }
      if (dir === 'down')  { if (dy <=  1) continue; primary =  dy; cross = Math.abs(dx); }
      if (dir === 'left')  { if (dx >= -1) continue; primary = -dx; cross = Math.abs(dy); }
      if (dir === 'right') { if (dx <=  1) continue; primary =  dx; cross = Math.abs(dy); }
      const score = primary + cross * 2; // prioritize staying aligned over pure closeness
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      e.preventDefault();
      best.focus();
      // Unlike native Tab, a scripted .focus() doesn't always scroll the
      // target into view on its own — make sure the newly focused card
      // is actually visible after the jump.
      best.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  // ════════════════════════
  // TOAST SYSTEM
  // ════════════════════════

  let _toastQueue = [];
  let _toastBusy  = false;

  /**
   * Show a queued dismissible toast.
   * @param {string} msg
   * @param {'info'|'success'|'error'|'warning'} [type='info']
   * @param {number} [duration=2800]
   */
  function toast(msg, type = 'info', duration = 2800) {
    if (_toastQueue.length >= 8) _toastQueue.shift(); // prevent runaway queue
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

  // ════════════════════════
  // MODAL
  // ════════════════════════

  /**
   * Open a modal overlay by element ID.
   * Adds body.modal-open scroll lock.
   * @param {string} id  — element id of the .modal-overlay
   */
  function openModal(id) {
    const el = $(id);
    if (!el) { console.warn(`openModal: #${id} not found`); return; }
    el.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  /**
   * Close a modal overlay by element ID.
   * Removes body.modal-open only when no other modals remain open.
   * @param {string} id
   */
  function closeModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('hidden');
    // Only remove scroll lock once all overlays are closed
    const anyOpen = document.querySelector('.modal-overlay:not(.hidden)');
    if (!anyOpen) document.body.classList.remove('modal-open');
  }

  // ════════════════════════
  // LOADER
  // ════════════════════════

  /**
   * Show a loader element (removes 'hidden').
   * @param {string} [id='global-loader']
   */
  function showLoader(id = 'global-loader') {
    const el = $(id);
    if (el) el.classList.remove('hidden');
  }

  /**
   * Hide a loader element (adds 'hidden').
   * @param {string} [id='global-loader']
   */
  function hideLoader(id = 'global-loader') {
    const el = $(id);
    if (el) el.classList.add('hidden');
  }

  /**
   * Runs an action started by a button tap. The button is locked at once (no
   * double start); if the action takes longer than a blink it shows a turning
   * spinner and the label (default "उघडत आहे"), then the original look returns.
   * @param {HTMLElement} btn
   * @param {() => any} action  may return a promise
   * @param {string} [label]
   */
  async function withBusy(btn, action, label = 'उघडत आहे') {
    if (!btn) return action();
    if (btn.dataset.busy === '1') return undefined;
    btn.dataset.busy = '1';
    btn.setAttribute('aria-busy', 'true');
    const original = btn.innerHTML;
    const width = btn.offsetWidth;
    const showTimer = setTimeout(() => {
      if (btn.dataset.busy !== '1') return;
      btn.style.minWidth = width ? `${width}px` : '';
      btn.classList.add('is-busy');
      btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span class="btn-busy-label">${_escHtml(label)}</span>`;
    }, 150);
    try {
      return await action();
    } finally {
      clearTimeout(showTimer);
      if (btn.classList.contains('is-busy')) {
        btn.classList.remove('is-busy');
        btn.innerHTML = original;
        btn.style.minWidth = '';
      }
      btn.removeAttribute('aria-busy');
      delete btn.dataset.busy;
    }
  }

  /**
   * Placeholder rows with a soft moving shine, shown while content loads
   * from the server (a plain "Loading…" line looked like an empty page).
   * @param {number} [rows=4]
   * @returns {string} HTML
   */
  function skeletonHTML(rows = 4) {
    const row = '<div class="skel-row"><span class="skel-line skel-w70"></span><span class="skel-line skel-w40"></span></div>';
    return `<div class="skel-list" role="status" aria-label="लोड होत आहे">${row.repeat(rows)}</div>`;
  }

  // ════════════════════════
  // GENERIC LIST RENDERER
  // ════════════════════════

  /**
   * Render an array of items into a container.
   *
   * @param {string}   containerId   — target element id
   * @param {Array}    items         — data array
   * @param {Function} renderFn      — (item, index) → HTMLElement | null
   * @param {string}   [emptyMsg]    — text shown when items is empty
   */
  function renderList(containerId, items, renderFn, emptyMsg = 'No items') {
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = '';

    if (!items || !items.length) {
      const p = document.createElement('p');
      p.className = 'empty-hint';
      p.textContent = emptyMsg;
      el.appendChild(p);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item, i) => {
      const node = renderFn(item, i);
      if (node instanceof Node) fragment.appendChild(node);
    });
    el.appendChild(fragment);
  }

  // ════════════════════════
  // SPLASH SCREEN
  // ════════════════════════

  function showSplash() {
    const splash = $('splash');
    if (splash) splash.classList.remove('hidden');
  }

  function hideSplash() {
    const splash = $('splash');
    const app    = $('app');
    if (!splash) return;
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.add('hidden');
      if (app) app.classList.remove('hidden');
    }, 500);
  }

  // ════════════════════════
  // HOME STATS (header cards)
  // ════════════════════════

  async function renderHomeStats() {
    try {
      const [questions, batches, attempts, allowedBatches, profile] = await Promise.all([
        DB.getAllQuestions(),
        DB.getAllBatches(),
        DB.getAllAttempts(),
        _getAllowedBatches(),
        _getCurrentStudentProfile(),
      ]);
      const filteredQuestions = _filterByAllowedBatches(questions, allowedBatches);
      const filteredBatches = batches.filter(batch => allowedBatches.includes(String(batch?.name || '').trim()));
      const filteredAttempts = _filterAttemptsForCurrentStudent(attempts, profile);
      if ($('home-total-q'))     $('home-total-q').textContent     = filteredQuestions.length;
      if ($('home-total-batch')) $('home-total-batch').textContent = filteredBatches.length;
      if ($('home-total-tests')) $('home-total-tests').textContent = filteredAttempts.length;
    } catch (e) {
      console.warn('renderHomeStats failed', e);
    }
  }

  // ════════════════════════
  // BATCH GRID
  // ════════════════════════

  const BATCH_COVERS_KEY = 'batch_covers_cache';
  let _batchCoversChecked = false;

  const _batchVisual = c => (c.cover_image
    ? `<div class="batch-cover"><img src="${(window.IMAGE_CACHE ? IMAGE_CACHE.lightUrl(c.cover_image) : c.cover_image)}" alt="" loading="lazy"></div>`
    : `<div class="batch-icon">${c.icon || '📚'}</div>`);

  // Background, once per session: fetch the admin's class icons/covers, save
  // them on the phone, and update the cards already on screen if they differ.
  function _refreshBatchCoversOnce(grid) {
    if (_batchCoversChecked || !navigator.onLine) return;
    _batchCoversChecked = true;
    API.getBatchPlans().then(async remote => {
      const fresh = {};
      (remote || []).forEach(rb => {
        const name = String(rb?.name || '').trim();
        if (name) fresh[name] = { icon: rb.icon || '📚', cover_image: rb.cover_image || '' };
      });
      const saved = await DB.getSetting(BATCH_COVERS_KEY, {}).catch(() => ({})) || {};
      if (JSON.stringify(saved) === JSON.stringify(fresh)) return;
      await DB.setSetting(BATCH_COVERS_KEY, fresh).catch(() => {});
      grid.querySelectorAll('.batch-card').forEach(card => {
        const name = card.querySelector('.batch-name')?.textContent.trim();
        const c = fresh[name];
        const visual = card.querySelector('.batch-cover, .batch-icon');
        if (c && visual) visual.outerHTML = _batchVisual(c);
      });
    }).catch(e => { _batchCoversChecked = false; console.warn('batch cover fetch failed', e); });
  }

  async function renderBatchGrid(onBatchClick) {
    const grid = $('batch-grid');
    if (!grid) return;

    const [batches, questions, allowedBatches] = await Promise.all([
      DB.getAllBatches(),
      DB.getAllQuestions(),
      _getAllowedBatches(),
    ]);

    grid.innerHTML = '';

    if (!allowedBatches.length) {
      grid.innerHTML = '<p class="empty-hint" style="grid-column:1/-1">No classes assigned yet. Contact your admin.</p>';
      return;
    }

    // Use allowedBatches as source of truth — show class even if local DB has no questions yet
    const batchMeta = new Map(batches.map(b => [String(b?.name || '').trim(), b]));

    // The locally-cached `batches` table is built incrementally from synced
    // question/quiz content (core/db.js's _ensureHierarchyEntry), which only
    // ever writes a generic 📚 icon — it never carries the admin's real
    // icon/cover_image. Those live on the backend Batch catalog. They are
    // kept on the phone and used at once; the server copy is checked in the
    // background once per session (the grid used to wait for it on every
    // Home visit, a full server round trip before any class showed).
    const covers = await DB.getSetting(BATCH_COVERS_KEY, {}).catch(() => ({})) || {};
    const applyCover = (name, c) => {
      const existing = batchMeta.get(name);
      if (existing) {
        existing.icon = c.icon || existing.icon;
        existing.cover_image = c.cover_image || '';
      } else {
        batchMeta.set(name, { name, icon: c.icon || '📚', cover_image: c.cover_image || '' });
      }
    };
    Object.entries(covers).forEach(([name, c]) => applyCover(name, c));
    _refreshBatchCoversOnce(grid);

    const visibleQuestions = _filterByAllowedBatches(questions, allowedBatches);
    const questionCounts = visibleQuestions.reduce((counts, q) => {
      counts[q.batch] = (counts[q.batch] || 0) + 1;
      return counts;
    }, {});

    const fragment = document.createDocumentFragment();
    allowedBatches.forEach(batchName => {
      const meta  = batchMeta.get(batchName) || { name: batchName, icon: '📚' };
      const count = questionCounts[batchName] || 0;
      const card  = document.createElement('div');
      card.className = 'batch-card';
      card.setAttribute('role', 'listitem');
      makeFocusable(card);
      card.innerHTML = `
        ${_batchVisual(meta)}
        <div class="batch-name">${batchName}</div>
        <div class="batch-count">${count} questions</div>
      `;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.batch-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (onBatchClick) onBatchClick(meta);
      });
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);
  }

  // ════════════════════════
  // SUBJECT GRID
  // ════════════════════════

  const _subjectIcons = {
    maths: '🧮', math: '🧮', science: '🔬', english: '📖',
    history: '🏛️', geography: '🌍', hindi: '🇮🇳', marathi: '🏵️',
    social: '🌐', physics: '⚡', chemistry: '🧪', biology: '🌱',
  };

  // ════════════════════════
  // CHAPTER LIST
  // ════════════════════════

  async function renderChapterList(batchName, subjectName, onChapterClick) {
    const section = $('chapter-section');
    const list    = $('chapter-list');
    if (!section || !list) return;

    const questions = await DB.getQuestionsByChapter(batchName, subjectName, '');
    const chapMap   = {};

    questions.forEach(q => {
      if (!q.chapter) return;
      if (!chapMap[q.chapter]) chapMap[q.chapter] = { total: 0, weak: 0 };
      chapMap[q.chapter].total++;
      if ((q.weak_count || 0) >= 2 || q.flagged) chapMap[q.chapter].weak++;
    });

    const chapters = Object.keys(chapMap);
    list.innerHTML = '';

    if (!chapters.length) { section.classList.add('hidden'); return; }

    const fragment = document.createDocumentFragment();
    chapters.forEach(ch => {
      const { total, weak } = chapMap[ch];
      const pct  = total > 0 ? Math.round((weak / total) * 100) : 0;
      const item = document.createElement('div');
      item.className = 'chapter-item';
      item.setAttribute('role', 'listitem');
      makeFocusable(item);
      item.innerHTML = `
        <div class="chapter-info">
          <div class="chapter-name">${ch}</div>
          <div class="chapter-meta">${total} questions${weak ? ` · ${weak} weak` : ''}</div>
        </div>
        <div class="chapter-stats">
          ${weak ? `<span class="chapter-pct" style="color:var(--wrong)">${pct}% weak</span>` : ''}
        </div>
        <span class="chapter-arrow" aria-hidden="true">›</span>
      `;
      item.addEventListener('click', () => {
        if (onChapterClick) onChapterClick(ch);
      });
      fragment.appendChild(item);
    });
    list.appendChild(fragment);

    section.classList.remove('hidden');
    await renderLessons();
  }

  // ════════════════════════
  // LESSON LIST (home)
  // ════════════════════════

  async function renderLessons() {
    const section = $('lesson-section');
    const list    = $('lesson-list');
    if (!section || !list) return;

    const [lessons, allowedBatches] = await Promise.all([
      DB.getAllLessons(),
      _getAllowedBatches(),
    ]);
    const visibleLessons = _filterByAllowedBatches(lessons, allowedBatches);

    if (!visibleLessons.length) { section.classList.add('hidden'); return; }

    section.classList.remove('hidden');
    renderList('lesson-list', visibleLessons.slice(0, 5), lesson => {
      const bodyStr = _lessonBodyStr(lesson.content);
      const card    = document.createElement('div');
      card.className = 'lesson-card';
      card.innerHTML = `
        <div class="lesson-card-header">
          <div class="lesson-card-title">${lesson.title || 'Untitled'}</div>
          <div class="lesson-card-meta">
            ${lesson.updated_at ? new Date(lesson.updated_at).toLocaleDateString() : ''}
          </div>
        </div>
        <div class="lesson-card-body">${_escHtml(bodyStr.slice(0, 200))}${bodyStr.length > 200 ? '…' : ''}</div>
      `;
      return card;
    });
  }

  // ════════════════════════
  // RECENT ATTEMPTS (home)
  // ════════════════════════

  async function renderRecentAttempts() {
    const [recent, profile] = await Promise.all([
      DB.getAllAttempts(),
      _getCurrentStudentProfile(),
    ]);
    const visibleAttempts = _filterAttemptsForCurrentStudent(recent, profile);

    renderList('home-recent', visibleAttempts.slice(0, 5), a => {
      const pct   = a.percent || 0;
      const color = pct >= 70 ? 'var(--correct)' : pct >= 40 ? 'var(--medium)' : 'var(--wrong)';
      const item  = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-info">
          <div class="history-title">${_escHtml(a.quiz_title || 'Test')}</div>
          <div class="history-meta">${new Date(a.date).toLocaleDateString()} · ${a.mode || 'practice'}</div>
        </div>
        <div class="history-score" style="color:${color}">${pct}%</div>
      `;
      return item;
    }, 'No test attempts yet');
  }

  // ════════════════════════
  // AVAILABLE TESTS (home)
  // ════════════════════════

  async function renderAvailableQuizzes(onStart) {
    const section = $('available-tests-section');
    const list    = $('available-tests-list');
    if (!section || !list) return;

    const [publishedRaw, allowedBatches] = await Promise.all([
      DB.getQuizzesByStatus('published'),
      _getAllowedBatches(),
    ]);
    const published = _filterByAllowedBatches(publishedRaw, allowedBatches);

    if (!published.length) { section.classList.add('hidden'); return; }

    section.classList.remove('hidden');
    list.innerHTML = '';

    // Pre-check which quizzes have questions cached locally
    const cachedQIds = new Set(
      (await DB.getAllQuestions().catch(() => [])).map(q => q.quiz_id).filter(Boolean)
    );

    const fragment = document.createDocumentFragment();
    published.forEach(quiz => {
      const totalQ = Array.isArray(quiz.questions) && quiz.questions.length
        ? quiz.questions.length
        : (quiz.sections || []).reduce((s, sec) => s + (sec.question_ids?.length || 0), 0);

      const isOfflineReady = cachedQIds.has(quiz.quiz_id) ||
        (Array.isArray(quiz.questions) && quiz.questions.length > 0);

      const card   = document.createElement('div');
      card.className = 'quiz-portal-card';
      card.innerHTML = `
        <div class="quiz-portal-info">
          <div class="quiz-portal-title">${_escHtml(quiz.title || 'Untitled Quiz')}</div>
          <div class="quiz-portal-meta">
            ${_escHtml(quiz.batch || '')}${quiz.subject ? ' · ' + _escHtml(quiz.subject) : ''}
            · ${totalQ} questions
            ${isOfflineReady ? '<span class="offline-badge" title="Offline उपलब्ध">📶✓</span>' : ''}
          </div>
        </div>
        <button class="quiz-portal-btn" aria-label="Start ${_escHtml(quiz.title)}">Start</button>
      `;
      card.querySelector('.quiz-portal-btn').addEventListener('click', e => {
        if (!navigator.onLine && !isOfflineReady) {
          APP.toast('Internet नाही! एकदा online होऊन हा quiz उघडा, मग offline पण चालेल.', 'error');
          return;
        }
        if (onStart) withBusy(e.currentTarget, () => onStart(quiz));
      });
      fragment.appendChild(card);
    });
    list.appendChild(fragment);
  }

  // Hierarchy-aware overrides: class -> subject -> chapter -> tests
  async function renderSubjectGrid(batchName, onSubjectClick) {
    const section = $('subject-section');
    const grid    = $('subject-grid');
    if (!section || !grid) return;

    const questions = await DB.getQuestionsByBatch(batchName);
    const storedSubjects = await DB.getSubjectsByBatch(batchName);
    const fallbackSubjects = [...new Set(
      questions.map(q => q.subject).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    const subjects = storedSubjects.length
      ? storedSubjects.map(item => item.name)
      : fallbackSubjects;

    grid.innerHTML = '';
    if (!subjects.length) { section.classList.add('hidden'); return; }

    const fragment = document.createDocumentFragment();
    for (const sub of subjects) {
      const chapters = await DB.getChaptersByBatchSubject(batchName, sub);
      const icon  = _subjectIcons[sub.toLowerCase()] || '📝';
      const count = chapters.length;
      const card  = document.createElement('div');
      card.className = 'subject-card';
      card.setAttribute('role', 'listitem');
      makeFocusable(card);
      card.innerHTML = `
        <div class="subject-icon">${icon}</div>
        <div class="subject-name">${sub}</div>
        <div class="batch-count">${count} chapter${count === 1 ? '' : 's'}</div>
      `;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.subject-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (onSubjectClick) onSubjectClick(sub);
      });
      fragment.appendChild(card);
    }
    grid.appendChild(fragment);

    section.classList.remove('hidden');
    $('chapter-section')?.classList.add('hidden');
    $('lesson-section')?.classList.add('hidden');
    $('available-tests-section')?.classList.add('hidden');
  }

  // Mixed / Paper Pattern tests (e.g. NMMS-style multi-subject papers) —
  // these publish with quiz.subject === 'Mixed', so they never match the
  // normal Subject → Chapter drill-down's exact-subject filter and would
  // otherwise be unreachable. Shown as its own section right under the
  // Batch grid, hidden entirely when the selected batch has none.
  // ── Test cards: what the button does, and the facts a student decides by ──
  // "Start" never said whether it opens an exam or practice; the line under
  // the title now does (and time limit / best earlier score when known).
  const _isExamQuiz = quiz => (quiz.default_mode || 'practice') === 'exam';
  const _startLabel = quiz => (_isExamQuiz(quiz) ? 'Exam द्या' : 'सुरू करा');

  function _quizFacts(quiz, totalQ, bestPct, extra = []) {
    const mins = quiz.timer_mode === 'full_test' && quiz.timer_value > 0 ? Math.max(1, Math.round(quiz.timer_value / 60)) : 0;
    return [
      ...extra,
      `${totalQ} प्रश्न`,
      _isExamQuiz(quiz) ? '🔒 Exam' : '📖 Practice',
      mins ? `⏱ ${mins} मि.` : (quiz.timer_mode === 'per_question' ? '⏱ प्रत्येक प्रश्नाला वेळ' : ''),
      bestPct != null ? `✔ आधी: ${bestPct}%` : '',
    ].filter(Boolean).map(_escHtml).join(' · ');
  }

  // Best % per quiz from this student's own attempts on this phone.
  async function _bestPercentByQuiz() {
    const [all, profile] = await Promise.all([DB.getAllAttempts().catch(() => []), _getCurrentStudentProfile()]);
    const best = new Map();
    for (const a of _filterAttemptsForCurrentStudent(all, profile)) {
      const pct = Number(a.percent);
      if (!a.quiz_id || !Number.isFinite(pct)) continue;
      best.set(a.quiz_id, Math.max(best.get(a.quiz_id) ?? -1, Math.round(pct)));
    }
    return best;
  }

  async function renderMixedTestsSection(batchName, onStart) {
    const section = $('mixed-tests-section');
    const list    = $('mixed-tests-list');
    if (!section || !list) return;

    const allowedBatches = await _getAllowedBatches();
    const published = _filterByAllowedBatches(await DB.getQuizzesByStatus('published'), allowedBatches).filter(quiz =>
      quiz.batch === batchName && quiz.subject === 'Mixed'
    );

    if (!published.length) {
      section.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    list.innerHTML = '';
    const best = await _bestPercentByQuiz();
    const fragment = document.createDocumentFragment();
    published.forEach(quiz => {
      const totalQ = Array.isArray(quiz.questions) && quiz.questions.length
        ? quiz.questions.length
        : (quiz.sections || []).reduce((s, sec) => s + (sec.question_ids?.length || 0), 0);
      const sectionCount = (quiz.sections || []).length;
      const card = document.createElement('div');
      card.className = 'quiz-portal-card';
      card.innerHTML = `
        <div class="quiz-portal-info">
          <div class="quiz-portal-title">${_escHtml(quiz.title || 'Untitled Quiz')}</div>
          <div class="quiz-portal-meta">${_quizFacts(quiz, totalQ, best.get(quiz.quiz_id), [`${sectionCount} section${sectionCount === 1 ? '' : 's'}`])}</div>
        </div>
        <button class="quiz-portal-btn" aria-label="${_escHtml(_startLabel(quiz))}: ${_escHtml(quiz.title)}">${_startLabel(quiz)}</button>
      `;
      card.querySelector('.quiz-portal-btn').addEventListener('click', e => {
        if (onStart) withBusy(e.currentTarget, () => onStart(quiz));
      });
      fragment.appendChild(card);
    });
    list.appendChild(fragment);

    section.classList.remove('hidden');
  }

  async function renderChapterList(batchName, subjectName, onChapterClick) {
    const section = $('chapter-section');
    const list    = $('chapter-list');
    if (!section || !list) return;

    const questions = await DB.getQuestionsByChapter(batchName, subjectName, '');
    const storedChapters = await API.getOrderedChapters(batchName, subjectName);
    const fallbackChapters = [...new Set(
      questions.map(q => q.chapter).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
    const chapters = storedChapters.length
      ? storedChapters.map(item => item.name)
      : fallbackChapters;
    const [publishedRaw, allowedBatches] = await Promise.all([
      DB.getQuizzesByStatus('published'),
      _getAllowedBatches(),
    ]);
    const published = _filterByAllowedBatches(publishedRaw, allowedBatches);

    list.innerHTML = '';
    if (!chapters.length) { section.classList.add('hidden'); return; }

    const lockedFlags = await Promise.all(
      chapters.map(ch => Promise.resolve(APP?.isChapterLocked?.(batchName, subjectName, ch)).catch(() => false))
    );

    const fragment = document.createDocumentFragment();
    chapters.forEach((ch, chIdx) => {
      const isLocked = !!lockedFlags[chIdx];
      const totalQuestions = questions.filter(q => q.chapter === ch).length;
      const testCount = published.filter(quiz =>
        quiz.batch === batchName &&
        quiz.subject === subjectName &&
        quiz.chapter === ch
      ).length;
      const item = document.createElement('div');
      item.className = 'chapter-item';
      item.setAttribute('role', 'listitem');
      makeFocusable(item);
      item.innerHTML = `
        <div class="chapter-info">
          <div class="chapter-name">${isLocked ? '🔒 ' : ''}${ch}</div>
          <div class="chapter-meta">${isLocked ? 'Subscribe to unlock' : `${testCount} test${testCount === 1 ? '' : 's'}${totalQuestions ? ` · ${totalQuestions} questions` : ''}`}</div>
        </div>
        <div class="chapter-stats"></div>
        <span class="chapter-arrow" aria-hidden="true">›</span>
      `;
      if (isLocked) item.classList.add('chapter-locked');
      item.addEventListener('click', () => {
        if (onChapterClick) onChapterClick(ch);
      });
      fragment.appendChild(item);
    });
    list.appendChild(fragment);

    section.classList.remove('hidden');
    $('available-tests-section')?.classList.add('hidden');
    $('chapter-hub-section')?.classList.add('hidden');
    await renderLessons();
  }

  // ════════════════════════
  // CHAPTER HUB (Test / Notes / Exercise)
  // ════════════════════════
  // Shown after a chapter is picked, instead of immediately revealing the
  // tests list — one clear choice screen. All 3 options are native
  // <button> elements, so keyboard/TV D-pad support (Tab + Enter) works
  // automatically, no extra remote-nav wiring needed here.

  function renderChapterHub({ chapter = '', onTest = null, onNotes = null, onExercise = null } = {}) {
    const grid  = $('chapter-hub-grid');
    const title = $('chapter-hub-title');
    if (!grid) return;

    if (title) title.textContent = chapter || 'Chapter';
    grid.innerHTML = '';

    const options = [
      { icon: '📝', label: 'Test',     meta: 'चाचणी द्या',        handler: onTest },
      { icon: '📓', label: 'Notes',    meta: 'वाचन साहित्य',       handler: onNotes },
      { icon: '📄', label: 'Exercise', meta: 'सराव प्रश्न',        handler: onExercise },
    ];

    const fragment = document.createDocumentFragment();
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chapter-hub-btn';
      btn.setAttribute('aria-label', opt.label);
      btn.innerHTML = `
        <span class="chapter-hub-icon">${opt.icon}</span>
        <span class="chapter-hub-text">
          <strong>${opt.label}</strong>
          <small>${opt.meta}</small>
        </span>
        <span class="chapter-hub-arrow" aria-hidden="true">›</span>
      `;
      if (opt.handler) btn.addEventListener('click', opt.handler);
      fragment.appendChild(btn);
    });
    grid.appendChild(fragment);

    $('available-tests-section')?.classList.add('hidden');
    // Chapter Hub is its own screen (not another inline home-page section),
    // so a chapter click actually navigates instead of just revealing more
    // content to scroll to.
    APP?.showScreen?.('chapter-hub');
  }

  // Chapter screen: replace the generic line under Test / Notes / Exercise
  // with what this chapter actually has ("3 tests · 1 दिली", "5 notes",
  // "2 exercises"). Only facts known on the phone; otherwise the generic
  // line stays. Runs after the screen is shown, so it never delays it.
  async function fillChapterHubFacts(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    const chapterId = `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
    const setMeta = (label, text) => {
      const el = document.querySelector(`#chapter-hub-grid .chapter-hub-btn[aria-label="${label}"] small`);
      if (el && text) el.textContent = text;
    };
    const [published, best, concepts, exercise] = await Promise.all([
      _getAllowedBatches().then(async allowed => _filterByAllowedBatches(await DB.getQuizzesByStatus('published'), allowed)).catch(() => []),
      _bestPercentByQuiz().catch(() => new Map()),
      DB.getCachedConcepts?.(chapterId).catch(() => null),
      DB.getExerciseQuestionsCache?.(chapterId).catch(() => null),
    ]);
    if ($('chapter-hub-title')?.textContent !== chapter) return;   // student moved on
    const tests = published.filter(q => q.batch === batch && q.subject === subject && q.chapter === chapter);
    if (tests.length) {
      const done = tests.filter(q => best.has(q.quiz_id)).length;
      setMeta('Test', `${tests.length} test${tests.length === 1 ? '' : 's'}${done ? ` · ${done} दिली` : ''}`);
    }
    if (Array.isArray(concepts) && concepts.length) setMeta('Notes', `${concepts.length} note${concepts.length === 1 ? '' : 's'}`);
    if (Array.isArray(exercise) && exercise.length) {
      const groups = new Set(exercise.map(q => q.exerciseNo ?? q.exercise_no ?? '')).size;
      setMeta('Exercise', `${groups} exercise${groups === 1 ? '' : 's'} · ${exercise.length} प्रश्न`);
    }
  }

  async function renderAvailableQuizzes({
    batch = '',
    subject = '',
    chapter = '',
    onStart = null,
    onPractice = null,
    showAll = false,
  } = {}) {
    const section = $('available-tests-section');
    const list    = $('available-tests-list');
    if (!section || !list) return;

    const titleEl = section.querySelector('.section-label');
    if (titleEl) {
      titleEl.textContent = chapter ? `${chapter} Tests` : 'Published Quizzes';
    }

    if (!showAll && (!batch || !subject || !chapter)) {
      section.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    const allowedBatches = await _getAllowedBatches();
    const published = _filterByAllowedBatches(await DB.getQuizzesByStatus('published'), allowedBatches).filter(quiz =>
      (!batch || quiz.batch === batch) &&
      (!subject || quiz.subject === subject) &&
      (!chapter || quiz.chapter === chapter)
    );
    const chapterQuestions = (batch && subject && chapter)
      ? await DB.getQuestionsByChapter(batch, subject, chapter)
      : [];

    if (!published.length && !(chapterQuestions.length && onPractice)) {
      section.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';
    const best = await _bestPercentByQuiz();

    const fragment = document.createDocumentFragment();
    if (chapterQuestions.length && onPractice) {
      const practiceCard = document.createElement('div');
      practiceCard.className = 'quiz-portal-card';
      practiceCard.innerHTML = `
        <div class="quiz-portal-info">
          <div class="quiz-portal-title">Practice Questions</div>
          <div class="quiz-portal-meta">${chapterQuestions.length} प्रश्न · 📖 chapter चा सराव</div>
        </div>
        <button class="quiz-portal-btn" aria-label="सराव करा">सराव करा</button>
      `;
      practiceCard.querySelector('.quiz-portal-btn').addEventListener('click', e => withBusy(e.currentTarget, () => onPractice()));
      fragment.appendChild(practiceCard);
    }

    published.forEach(quiz => {
      const totalQ = Array.isArray(quiz.questions) && quiz.questions.length
        ? quiz.questions.length
        : (quiz.sections || []).reduce((s, sec) => s + (sec.question_ids?.length || 0), 0);
      const card   = document.createElement('div');
      card.className = 'quiz-portal-card';
      // Inside one chapter its name is already the heading; a wider list
      // still says where each test belongs.
      const where = chapter ? [] : [quiz.subject, quiz.chapter].filter(Boolean);
      card.innerHTML = `
        <div class="quiz-portal-info">
          <div class="quiz-portal-title">${_escHtml(quiz.title || 'Untitled Quiz')}</div>
          <div class="quiz-portal-meta">${_quizFacts(quiz, totalQ, best.get(quiz.quiz_id), where)}</div>
        </div>
        <button class="quiz-portal-video-btn" aria-label="${_escHtml(quiz.title)} साठी Teacher Video" title="Teacher's Video">▶ Video</button>
        <button class="quiz-portal-btn" aria-label="${_escHtml(_startLabel(quiz))}: ${_escHtml(quiz.title)}">${_startLabel(quiz)}</button>
      `;
      card.querySelector('.quiz-portal-btn').addEventListener('click', e => {
        if (onStart) withBusy(e.currentTarget, () => onStart(quiz));
      });
      // No pre-check network call per card (would mean N calls for N tests on
      // screen) — always show the button, Step 1's own empty-state handles
      // the no-video case gracefully.
      card.querySelector('.quiz-portal-video-btn').addEventListener('click', () => {
        window.VIDEO_TEACHER_SELECT?.open({ type: 'quiz_test', quizId: quiz.quiz_id, quizTitle: quiz.title });
      });
      fragment.appendChild(card);
    });
    list.appendChild(fragment);
  }

  // ════════════════════════
  // NAV SCORE (quiz screen)
  // ════════════════════════

  function updateNavScore(correct, wrong, skip) {
    if ($('nav-correct')) $('nav-correct').textContent = correct || 0;
    if ($('nav-wrong'))   $('nav-wrong').textContent   = wrong   || 0;
    if ($('nav-skip'))    $('nav-skip').textContent    = skip    || 0;
  }

  function resetNavScore() { updateNavScore(0, 0, 0); }

  // ════════════════════════
  // BREADCRUMB
  // ════════════════════════

  function setBreadcrumb(text) {
    const el = $('breadcrumb');
    if (el) el.textContent = text || 'Home';
  }

  // ════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════

  function _lessonBodyStr(content) {
    if (!content)                         return '';
    if (typeof content === 'string')      return content;
    if (typeof content.body === 'string') return content.body;
    return JSON.stringify(content);
  }

  function _escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ════════════════════════
  // CONFIRM / PROMPT (no native dialogs — safe on Android WebView)
  // ════════════════════════

  // labels: optional { yes, no } button texts (default होय / रद्द करा).
  function confirmAsync(message, labels = {}) {
    return new Promise(resolve => {
      const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const overlay = document.createElement('div');
      overlay.className = 'td-dialog-overlay';
      overlay.innerHTML = `<div class="td-dialog-box">
        <p class="td-dialog-msg">${esc(message)}</p>
        <div class="td-dialog-btns">
          <button class="td-dialog-no">${esc(labels.no || 'रद्द करा')}</button>
          <button class="td-dialog-yes">${esc(labels.yes || 'होय')}</button>
        </div></div>`;
      document.body.appendChild(overlay);
      const done = r => { overlay.remove(); resolve(r); };
      overlay.querySelector('.td-dialog-yes').addEventListener('click', () => done(true));
      overlay.querySelector('.td-dialog-no').addEventListener('click',  () => done(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
    });
  }

  function promptAsync(message, inputType = 'text', defaultValue = '') {
    return new Promise(resolve => {
      const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const overlay = document.createElement('div');
      overlay.className = 'td-dialog-overlay';
      overlay.innerHTML = `<div class="td-dialog-box">
        <p class="td-dialog-msg">${esc(message)}</p>
        <input class="td-dialog-input" type="${esc(inputType)}" value="${esc(defaultValue)}">
        <div class="td-dialog-btns">
          <button class="td-dialog-no">रद्द करा</button>
          <button class="td-dialog-yes">Save</button>
        </div></div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('.td-dialog-input');
      setTimeout(() => input.focus(), 50);
      const done = r => { overlay.remove(); resolve(r); };
      overlay.querySelector('.td-dialog-yes').addEventListener('click', () => done(input.value.trim() || null));
      overlay.querySelector('.td-dialog-no').addEventListener('click',  () => done(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) done(null); });
    });
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return {
    // Toast
    toast,
    // Modal
    openModal,
    closeModal,
    // Loader
    showLoader,
    hideLoader,
    withBusy,
    skeletonHTML,
    // Generic list
    renderList,
    // Splash
    showSplash,
    hideSplash,
    // Home
    renderHomeStats,
    renderBatchGrid,
    renderSubjectGrid,
    renderMixedTestsSection,
    renderChapterList,
    renderChapterHub,
    renderLessons,
    renderRecentAttempts,
    renderAvailableQuizzes,
    fillChapterHubFacts,
    // Nav
    updateNavScore,
    resetNavScore,
    setBreadcrumb,
    // Dialogs (Android-safe replacements for confirm/prompt)
    confirmAsync,
    promptAsync,
    // Remote/keyboard (TV D-pad) navigation
    makeFocusable,
  };
})();
