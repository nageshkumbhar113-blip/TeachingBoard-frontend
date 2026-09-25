/* ════════════════════════════════════════
   studyPlan.js - Student Home > Study Plan
   Create a plan up to an exam date, see today's tasks, tick them off, see progress / streak / countdown.
   Server: /api/study-plan/* (see TeachingBoard-backend utils/studyPlan.js)
════════════════════════════════════════ */

const STUDY_PLAN = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);

  const TYPE = {
    notes: { icon: '📓', label: 'Notes' },
    exercise: { icon: '📄', label: 'Exercise' },
    passage: { icon: '📖', label: 'Passage' },
    mcq: { icon: '📝', label: 'MCQ test' },
  };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let _plan = null;      // { plan, progress } from /me, or null
  let _tasks = [];       // today's tasks
  let _batch = '';

  async function _batchName() {
    if (_batch) return _batch;
    const p = await API.getStudentProfile?.().catch(() => null);
    _batch = (p?.assigned_batches || [])[0] || '';
    return _batch;
  }

  async function _load() {
    _plan = await API.fetchMyStudyPlan();
    _tasks = _plan ? (await API.fetchMyStudyToday()).tasks || [] : [];
  }

  const _statusText = s => ({ ahead: 'Ahead 🚀', on_track: 'On track ✅', behind: 'Behind ⚠️' }[s] || '');

  async function refresh() {
    const card = $('home-plan-card');
    if (!card) return;
    try { await _load(); } catch { card.classList.add('hidden'); return; }
    if (!_plan) {
      card.innerHTML = `
        <div class="re-card-head"><b>📅 Study Plan</b></div>
        <div class="re-card-line">Exam chi tayari plan kara: dararoj kiti abhyas karaycha te app sangel.</div>
        <button type="button" class="re-open-btn" id="sp-open">Create my plan</button>`;
    } else {
      const pr = _plan.progress, pl = _plan.plan;
      card.innerHTML = `
        <div class="re-card-head"><b>📅 ${esc(pl.examName)}</b><span class="re-badge">${pr.examCountdownDays} days left</span></div>
        <div class="re-card-line">Today ${pr.today.completed}/${pr.today.total} done &middot; 🔥 ${pr.streak}-day streak &middot; ${_statusText(pr.onTrack.status)}</div>
        <div class="re-bar"><span style="width:${pr.overallPercent}%"></span></div>
        <button type="button" class="re-open-btn" id="sp-open">Today's study</button>`;
    }
    card.classList.remove('hidden');
    $('sp-open')?.addEventListener('click', openModal);
  }

  function _close() { $('sp-modal')?.remove(); }

  function _sheet() {
    let m = $('sp-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'sp-modal';
      m.className = 're-modal';
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) _close(); });
    }
    return m;
  }

  // ── Today view ──────────────────────────────────────────────
  function _renderToday() {
    const m = _sheet();
    const pr = _plan.progress, pl = _plan.plan;
    const pending = _tasks.filter(t => t.status === 'pending').length;
    m.innerHTML = `
      <div class="re-sheet">
        <div class="re-sheet-head"><h3>📅 ${esc(pl.examName)}</h3><button type="button" class="re-x" id="sp-close" aria-label="Close">✕</button></div>
        <div class="re-counts">
          <div><b>${pr.overallPercent}%</b><small>done</small></div>
          <div><b>${pr.streak}</b><small>day streak</small></div>
          <div><b>${pr.examCountdownDays}</b><small>days left</small></div>
        </div>
        <div class="re-bar"><span style="width:${pr.overallPercent}%"></span></div>
        <p class="re-hint">${_statusText(pr.onTrack.status)} &middot; expected ${pr.onTrack.expectedPercent}%, you are at ${pr.onTrack.actualPercent}%.</p>
        <h4>Today (${pr.today.completed}/${pr.today.total})</h4>
        ${_tasks.length ? _tasks.map(_taskRow).join('') : '<p class="re-hint">No tasks for today. Rest day or all done 🎉</p>'}
        ${pending === 0 && _tasks.length ? '<p class="re-hint">Great, all of today\'s tasks are handled. 👏</p>' : ''}
        <h4>Subjects</h4>
        ${pr.bySubject.map(s => `
          <div class="sp-sub"><span>${esc(s.subjectId)}</span><small>${s.completed}/${s.totalItems}</small></div>
          <div class="re-bar"><span style="width:${s.percent}%"></span></div>`).join('')}
        <p class="re-hint">${esc(pl.startDate)} to ${esc(pl.targetDate)}</p>
        <p class="re-hint">✅ Tumcha plan save aahe. Parat ughadla tar hach plan disel.</p>
        <div class="sp-row"><button type="button" class="re-open-btn sp-primary" id="sp-save">✔ Save &amp; close</button><button type="button" class="re-open-btn" id="sp-edit">✏️ Edit plan</button></div>
      </div>`;
    $('sp-close')?.addEventListener('click', _close);
    $('sp-save')?.addEventListener('click', () => { _close(); toast('Plan saved ✅', 'success'); });
    $('sp-edit')?.addEventListener('click', () => _renderCreate(true));
    m.querySelectorAll('[data-sp-done]').forEach(b => b.addEventListener('click', () => _toggle(b.dataset.spDone, b.dataset.now)));
    m.querySelectorAll('[data-sp-skip]').forEach(b => b.addEventListener('click', () => _setStatus(b.dataset.spSkip, 'skipped')));
    m.querySelectorAll('[data-sp-open]').forEach(b => b.addEventListener('click', () => _openTask(b.dataset.spOpen)));
  }

  function _taskRow(t) {
    const ty = TYPE[t.itemType] || { icon: '📌', label: t.itemType };
    const done = t.status === 'completed', skipped = t.status === 'skipped';
    return `
      <div class="sp-task ${done ? 'sp-done' : ''} ${skipped ? 'sp-skipped' : ''}">
        <button type="button" class="sp-check" data-sp-done="${esc(t.id)}" data-now="${done ? 'pending' : 'completed'}" aria-label="${done ? 'Mark not done' : 'Mark done'}">${done ? '✔' : ''}</button>
        <div class="sp-task-main">
          <b>${ty.icon} ${esc(t.label || ty.label)}</b>
          <small>${esc(t.subjectId)} &middot; ${esc(t.chapterName || '')} &middot; ${ty.label}${skipped ? ' &middot; skipped' : ''}</small>
        </div>
        <div class="sp-task-btns">
          <button type="button" class="re-open-btn" data-sp-open="${esc(t.id)}">Open</button>
          ${t.status === 'pending' ? `<button type="button" class="re-x" data-sp-skip="${esc(t.id)}" title="Skip" aria-label="Skip">⏭</button>` : ''}
        </div>
      </div>`;
  }

  async function _setStatus(id, status) {
    try {
      await API.updateStudyTask(id, status);
      await _load();
      _renderToday();
      refresh();
    } catch (e) { toast(e?.message || 'Could not update. Check your internet.', 'error'); }
  }
  const _toggle = (id, now) => _setStatus(id, now);

  async function _openTask(id) {
    const t = _tasks.find(x => x.id === id);
    if (!t) return;
    const batch = await _batchName();
    _close();
    if (t.itemType === 'notes') {
      APP.showScreen('notes');
      window.NOTES_VIEWER?.openChapter?.(batch, t.subjectId, t.chapterName);
    } else if (t.itemType === 'mcq') {
      APP.showScreen('home');
      toast(`Open ${t.subjectId} > ${t.chapterName} > Test`, 'info');
    } else {
      window.EXERCISE_VIEWER?.openChapter?.(batch, t.subjectId, t.chapterName);
    }
  }

  async function _endPlan() {
    if (!(await UI.confirmAsync?.('End this plan? Your progress history stays saved.'))) return;
    try {
      await API.abandonStudyPlan();
      await _load();
      await refresh();
      _close();
      toast('Plan ended', 'success');
    } catch (e) { toast(e?.message || 'Could not end the plan', 'error'); }
  }

  // ── Create view ─────────────────────────────────────────────
  async function _renderCreate(edit = false) {
    const pre = edit && _plan ? _plan.plan : null;
    const preSubj = pre ? pre.subjects.map(x => x.subjectId) : null;
    const m = _sheet();
    m.innerHTML = '<div class="re-sheet"><p class="re-hint">Loading subjects…</p></div>';
    const batch = await _batchName();
    let subjects = [];
    try {
      const all = await API.fetchStudyHierarchy();
      const b = all.find(x => x.name === batch) || all[0];
      subjects = b?.subjects || [];
      if (b && !_batch) _batch = b.name;
    } catch { /* handled below */ }
    if (!subjects.length) {
      m.innerHTML = `<div class="re-sheet"><div class="re-sheet-head"><h3>📅 Study Plan</h3><button type="button" class="re-x" id="sp-close">✕</button></div>
        <p class="re-hint">Could not load your subjects. Check your internet and try again.</p></div>`;
      $('sp-close')?.addEventListener('click', _close);
      return;
    }
    const tomorrow = new Date(Date.now() + 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
    m.innerHTML = `
      <div class="re-sheet">
        <div class="re-sheet-head"><h3>${pre ? '✏️ Edit study plan' : '📅 Create study plan'}</h3><button type="button" class="re-x" id="sp-close" aria-label="Close">✕</button></div>
        <label class="sp-lab">Exam name<input id="sp-name" type="text" maxlength="100" placeholder="e.g. Semester 1 exam" value="${esc(pre?.examName || '')}" /></label>
        <label class="sp-lab">Exam date<input id="sp-date" type="date" min="${tomorrow}" value="${esc(pre?.targetDate || '')}" /></label>
        <h4>Subjects</h4>
        <div class="sp-chips">${subjects.map((s, i) => `<label class="sp-chip"><input type="checkbox" class="sp-subj" value="${esc(s)}" ${!preSubj || preSubj.includes(s) ? 'checked' : ''} /> ${esc(s)}</label>`).join('')}</div>
        <h4>Rest days</h4>
        <div class="sp-chips">${DAYS.map((d, i) => `<label class="sp-chip"><input type="checkbox" class="sp-off" value="${i}" ${pre?.offDaysOfWeek?.includes(i) ? 'checked' : ''} /> ${d}</label>`).join('')}</div>
        <details class="sp-more"><summary>Daily limits (optional)</summary>
          <div class="sp-limits">
            <label>Notes<input id="sp-l-notes" type="number" min="1" max="20" value="${pre?.maxNotesPerDay || 8}" /></label>
            <label>Exercise<input id="sp-l-ex" type="number" min="1" max="10" value="${pre?.maxItemsPerDay || 4}" /></label>
            <label>Passages<input id="sp-l-pa" type="number" min="1" max="10" value="${pre?.maxPassagesPerDay || 3}" /></label>
            <label>MCQ<input id="sp-l-mcq" type="number" min="1" max="20" value="${pre?.maxMcqPerDay || 6}" /></label>
          </div>
          <p class="re-hint">Maximum items per day. If the plan is too heavy for the days left, you will be told.</p>
        </details>
        <p id="sp-err" class="re-err hidden" role="alert"></p>
        <div id="sp-warn" class="re-hint hidden"></div>
        ${pre ? '<p class="re-hint">Plan badalla tar naveen plan suru hoto; jyach kaam jhale tyacha progress navin plan madhe jat nahi.</p>' : ''}
        <button type="button" class="re-open-btn" id="sp-submit">${pre ? 'Save changes' : 'Create plan'}</button>
      </div>`;
    $('sp-close')?.addEventListener('click', _close);
    $('sp-submit')?.addEventListener('click', () => _submit(false));
  }

  async function _submit(force) {
    const err = $('sp-err'), warn = $('sp-warn');
    const show = t => { err.textContent = t; err.classList.remove('hidden'); };
    err.classList.add('hidden'); warn.classList.add('hidden');
    const examName = $('sp-name').value.trim();
    const targetDate = $('sp-date').value;
    const subjects = [...document.querySelectorAll('.sp-subj:checked')].map(c => ({ subjectId: c.value }));
    if (!examName) return show('Enter the exam name');
    if (!targetDate) return show('Choose the exam date');
    if (!subjects.length) return show('Choose at least one subject');
    const body = {
      examName, targetDate, subjects,
      offDaysOfWeek: [...document.querySelectorAll('.sp-off:checked')].map(c => Number(c.value)),
      maxNotesPerDay: Number($('sp-l-notes').value) || 8,
      maxItemsPerDay: Number($('sp-l-ex').value) || 4,
      maxPassagesPerDay: Number($('sp-l-pa').value) || 3,
      maxMcqPerDay: Number($('sp-l-mcq').value) || 6,
      force,
    };
    const btn = $('sp-submit');
    btn.disabled = true;
    try {
      const r = await API.createStudyPlan(body);
      if (r?.warning) {
        btn.disabled = false;
        warn.innerHTML = `⚠️ ${esc(r.message || 'This plan is very heavy for the days left.')}<br><button type="button" class="re-open-btn" id="sp-force">Create anyway</button>`;
        warn.classList.remove('hidden');
        $('sp-force')?.addEventListener('click', () => _submit(true));
        return;
      }
      toast('Study plan created 🎯', 'success');
      await _load();
      _renderToday();
      refresh();
    } catch (e) {
      btn.disabled = false;
      show(e?.message || 'Could not create the plan');
    }
  }

  async function openModal() {
    try { await _load(); } catch { toast('Could not load Study Plan. Check your internet.', 'error'); return; }
    if (_plan) _renderToday(); else _renderCreate();
  }

  return { refresh, openModal };
})();

window.STUDY_PLAN = STUDY_PLAN;
