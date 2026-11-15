/* ════════════════════════════════════════
   digitalTeacher.js — "Personal Digital Teacher" (owner 2026-11-15)
   A floating teacher on Home opens a chat-style window that runs the day's study:
   greeting, exam countdown / free days, today's Study Plan tasks, new class tests,
   Refer & Earn (every 2 days), Share (once a day). A task opens the app's existing
   viewer (Notes / Exercise / Test player — unchanged); when the student comes back
   to Home the teacher reacts to the result and the window opens again.
   No AI: fixed Marathi lines picked by rules. Server: only calls the app already
   makes (Study Plan today / tick, exam date); the chat itself lives on the phone.
   Global: DIGITAL_TEACHER
════════════════════════════════════════ */

const DIGITAL_TEACHER = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 864e5;
  const KEY = 'dt_state';              // per-day chat + flags (phone only)
  const CACHE = 'dt_today_cache';      // last Study Plan answer, for offline
  const TYPE = { notes: { ic: '📓', label: 'Notes', btn: 'उघडा' }, exercise: { ic: '📄', label: 'Exercise', btn: 'उघडा' }, passage: { ic: '📖', label: 'Passage', btn: 'उघडा' }, mcq: { ic: '📝', label: 'Test', btn: 'सुरू करा' } };
  const FACE = '<svg viewBox="0 0 64 64" aria-hidden="true" class="dt-svg"><circle cx="32" cy="32" r="32" fill="#fde2c8"/><path d="M10 64c2-13 11-19 22-19s20 6 22 19z" fill="#e16b13"/><path d="M26 45l6 7 6-7z" fill="#fff"/><rect x="28" y="38" width="8" height="8" rx="3" fill="#f2b98d"/><path d="M17 30c0-11 7-18 15-18s15 7 15 18c0 3-1 6-2 8-1-7-4-12-13-14-6 3-10 7-13 14-1-2-2-5-2-8z" fill="#3b2418"/><ellipse cx="32" cy="30" rx="11" ry="12.5" fill="#f6c39b"/><path d="M21 27c3-6 8-9 14-9 4 1 7 4 8 9-6-1-11-3-14-6-2 3-5 5-8 6z" fill="#3b2418"/><circle cx="32" cy="12" r="5" fill="#3b2418"/><g fill="none" stroke="#3b2418" stroke-width="1.6"><circle cx="27.5" cy="31" r="3.4"/><circle cx="36.5" cy="31" r="3.4"/><path d="M30.9 31h2.2"/></g><circle cx="27.5" cy="31" r="1.1" fill="#3b2418"/><circle cx="36.5" cy="31" r="1.1" fill="#3b2418"/><path d="M28.5 37q3.5 3 7 0" fill="none" stroke="#b4533a" stroke-width="1.6" stroke-linecap="round"/><circle cx="32" cy="26.5" r=".9" fill="#c0392b"/></svg>';

  let S = null;            // { date, log:[{k,h}], opened, shared, referAt, pending, planAsked }
  let D = { tasks: [], plan: null, profile: null, newTests: [], weekly: null, loadedAt: 0 };
  let _onHome = false;

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const kam = n => n === 1 ? 'काम' : 'कामं';
  const firstName = () => String(D.profile?.name || '').trim().split(/\s+/)[0] || '';
  async function _load() {
    if (S && S.date === today()) return;
    const saved = await DB.getSetting(KEY, null).catch(() => null);
    S = saved && saved.date === today() ? saved : { date: today(), log: [], opened: false, shared: false, referAt: saved?.referAt || 0, pending: saved?.pending || null, planAsked: false };
  }
  const _save = () => DB.setSetting(KEY, S).catch(() => {});

  // a logged-in student (not a free-part visitor, not teacher / parent)
  async function isActive() {
    if (window.GUEST?.isActive?.()) return false;
    if (document.body.classList.contains('teacher-mode') || document.body.classList.contains('parent-mode')) return false;
    const p = await API.getStudentProfile?.().catch(() => null);
    return !!(p && p.student_code && !p.guest);
  }

  // ── data (Study Plan today + plan; cached for offline) ──
  async function _fetch(force = false) {
    D.profile = await API.getStudentProfile().catch(() => null);
    const fresh = Date.now() - D.loadedAt < 10 * 60 * 1000;
    if (!force && fresh && D.tasks) return;
    let got = false;
    if (navigator.onLine) {
      try {
        const [plan, td] = await Promise.all([API.fetchMyStudyPlan(), API.fetchMyStudyToday()]);
        D.plan = plan; D.tasks = plan ? (td.tasks || []) : [];
        got = true;
        DB.setSetting(CACHE, { date: today(), plan: D.plan, tasks: D.tasks }).catch(() => {});
      } catch { /* offline / server asleep: cache below */ }
    }
    if (!got) {
      const c = await DB.getSetting(CACHE, null).catch(() => null);
      if (c && c.date === today()) { D.plan = c.plan; D.tasks = c.tasks || []; }
      else { D.plan = c?.plan || null; D.tasks = []; }
    }
    D.loadedAt = Date.now();
    D.newTests = await _newTests().catch(() => []);
    D.weekly = await _weekly().catch(() => null);
  }
  // tests published for the class in the last 7 days, not attempted yet, not locked, not already a task today
  async function _newTests() {
    const batches = new Set(D.profile?.assigned_batches || []);
    const tried = new Set((await DB.getAllAttempts().catch(() => [])).map(a => a.quiz_id));
    const inPlan = new Set(D.tasks.map(t => t.refId));
    const out = [];
    for (const q of await DB.getAllQuizzes().catch(() => [])) {
      if (q.source !== 'api' || !batches.has(q.batch) || tried.has(q.quiz_id) || inPlan.has(q.quiz_id)) continue;
      const at = Date.parse(q.created_at || q.updated_at || '') || 0;
      if (Date.now() - at > 7 * DAY) continue;
      if (await APP.isQuizLocked?.(q)) continue;
      out.push(q);
    }
    return out.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)).slice(0, 2);
  }
  async function _weekly() {
    const ev = await DB.getSetting('weekly_events_cache', null).catch(() => null);
    const list = Array.isArray(ev) ? ev : [];
    return list.find(e => e.state === 'live') || list.filter(e => e.state === 'upcoming').sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] || null;
  }
  const pending = () => D.tasks.filter(t => t.status === 'pending');
  const examDays = () => D.plan?.progress?.examCountdownDays ?? null;
  const examName = () => D.plan?.plan?.examName || 'परीक्षा';
  function freeDaysLeft() {
    const p = D.profile;
    if (!p || p.access_level !== 'free' || !p.free_until) return null;
    return Math.max(0, Math.ceil((Date.parse(p.free_until) - Date.now()) / DAY));
  }

  // ── floating teacher on Home ──
  function _fab() {
    let f = $('dt-fab');
    if (!f) {
      f = document.createElement('button');
      f.type = 'button'; f.id = 'dt-fab'; f.className = 'dt-fab hidden';
      f.setAttribute('aria-label', 'Personal Digital Teacher उघडा');
      f.innerHTML = `<span class="dt-bub" id="dt-bub"></span><span class="dt-face">${FACE}<span class="dt-badge" id="dt-badge"></span></span>`;
      f.addEventListener('click', () => open());
      document.body.appendChild(f);
    }
    return f;
  }
  function _paintFab() {
    const f = _fab();
    const n = pending().length + D.newTests.length;
    $('dt-badge').textContent = n; $('dt-badge').classList.toggle('hidden', !n);
    const name = firstName();
    $('dt-bub').textContent = !D.plan && !S?.planAsked ? `${name ? name + ', ' : ''}चला अभ्यास सुरू करूया 👋`
      : n ? `${S?.opened ? 'चला पुढे!' : 'Welcome back!'} आज ${n} ${kam(n)} 👋` : 'आजचं सगळं पूर्ण 🔥';
    f.classList.toggle('hidden', !_onHome || !!$('dt-sheet'));
  }

  // ── chat window ──
  function _sheet() {
    let m = $('dt-sheet');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'dt-sheet'; m.className = 'dt-sheet';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Personal Digital Teacher');
    m.innerHTML = `<div class="dt-head"><span class="dt-hface">${FACE}</span><div><b>Personal Digital Teacher</b><small id="dt-sub"></small></div><button type="button" class="dt-x" id="dt-x" aria-label="बंद करा">✕</button></div><div class="dt-log" id="dt-log" aria-live="polite"></div>`;
    document.body.appendChild(m);
    $('dt-x').onclick = close;
    $('dt-log').addEventListener('click', _onLogClick);
    return m;
  }
  function close() { $('dt-sheet')?.remove(); _paintFab(); }
  const _scroll = () => requestAnimationFrame(() => { const l = $('dt-log'); if (l) l.scrollTop = l.scrollHeight; });
  const _add = h => { $('dt-log')?.insertAdjacentHTML('beforeend', h); _scroll(); };
  const say = h => _add(`<div class="dt-msg dt-t">${h}</div>`);
  const me = s => _add(`<div class="dt-msg dt-me">${esc(s)}</div>`);
  // reactions are kept for the day so the window shows the day's conversation
  function remember(h) { S.log.push(h); if (S.log.length > 12) S.log.shift(); _save(); }
  function buttons(list) {
    const id = 'dtb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    _add(`<div class="dt-row" id="${id}">${list.map((x, i) => `<button type="button" class="dt-pill${i ? ' alt' : ''}" data-i="${i}">${esc(x[0])}</button>`).join('')}</div>`);
    $(id).onclick = e => { const b = e.target.closest('button'); if (!b) return; $(id).remove(); me(list[+b.dataset.i][0]); setTimeout(list[+b.dataset.i][1], 300); };
  }
  function taskCard(t) {
    const ty = TYPE[t.itemType] || { ic: '📌', label: t.itemType, btn: 'उघडा' };
    const done = t.status !== 'pending';
    _add(`<div class="dt-task${done ? ' done' : ''}"><span class="dt-ic">${ty.ic}</span><div><b>${esc(t.label || ty.label)}</b><small>${esc(t.subjectId || '')}${t.chapterName ? ' · ' + esc(t.chapterName) : ''} · ${ty.label}</small></div><button type="button" class="dt-go" data-task="${esc(t.id)}"${done ? ' disabled' : ''}>${done ? '✓ झालं' : ty.btn}</button></div>`);
  }
  function testCard(q) {
    _add(`<div class="dt-task"><span class="dt-ic">📌</span><div><b>नवीन test: ${esc(q.title || '')}</b><small>${esc(q.subject || '')}${q.chapter ? ' · ' + esc(q.chapter) : ''} · Class साठी नवीन</small></div><button type="button" class="dt-go" data-quiz="${esc(q.quiz_id)}">सुरू करा</button></div>`);
  }
  function _onLogClick(e) {
    const b = e.target.closest('.dt-go');
    if (!b || b.disabled) return;
    if (b.dataset.task) { const t = D.tasks.find(x => x.id === b.dataset.task); if (t) _openTask(t); }
    if (b.dataset.quiz) _openQuiz(b.dataset.quiz);
    if (b.dataset.act === 'refer') { S.referAt = Date.now(); _save(); window.REFER_EARN?.openModal?.(); }
    if (b.dataset.act === 'share') window.APP?.shareApp?.();
  }

  const MONTHS = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
  const dmy = iso => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const greetWord = () => { const h = new Date().getHours(); return h < 12 ? '☀️ सुप्रभात' : h < 17 ? '🙏 नमस्कार' : h < 21 ? '🌇 शुभ संध्या' : '🌙 शुभरात्री'; };
  async function open() {
    if (!(await isActive())) return;
    await _load();
    window.TOUR?.stop?.(false);   // a running Home tour waits (it comes back later)
    const m = _sheet();
    $('dt-log').innerHTML = '';
    $('dt-fab')?.classList.add('hidden');
    await _fetch();
    _render();
    void m;
  }
  function _sub() { const n = D.tasks.length, d = n - pending().length; $('dt-sub') && ($('dt-sub').textContent = n ? `आजचा अभ्यास · ${d}/${n}` : 'तुमचा अभ्यास-साथी'); }
  function _render() {
    _sub();
    const name = firstName();
    const n = pending().length;
    // first time: the teacher makes the Study Plan
    if (!D.plan) return _askPlan(name);
    say(S.opened ? `पुन्हा आलात${name ? ' ' + esc(name) : ''}! 👍` : `${greetWord()}${name ? ' ' + esc(name) : ''}! Welcome back 👋 ${n ? `आज ${n} ${kam(n)} ${n === 1 ? 'आहे' : 'आहेत'}.` : D.tasks.length ? 'आजचं सगळं झालं आहे 🔥' : 'आज Study Plan मध्ये सुट्टी आहे 😊'}`);
    if (!S.opened) { S.opened = true; _save(); }
    _tiles();
    S.log.forEach(h => say(h));
    if (D.tasks.length) {
      say(n ? (D.tasks.length > n ? 'उरलेली कामं 👇' : 'चला, आजचा अभ्यास सुरू करूया 👇') : 'आजची कामं ✓');
      D.tasks.forEach(taskCard);
    }
    D.newTests.forEach(testCard);
    if (!S.referToday && Date.now() - (S.referAt || 0) > 2 * DAY) { S.referToday = true; S.referAt = Date.now(); _save(); }
    if (S.referToday) _refer();   // Refer & Earn: one day in two
    if (!n) _dayDone();
    else if (D.weekly) _weeklyLine();
  }
  function _tiles() {
    const ed = examDays(), fd = freeDaysLeft(), st = D.plan?.progress?.streak || 0;
    const a = ed != null ? `<div><b>${ed}</b><small>${esc(examName())} ला दिवस</small></div>` : '';
    const b = fd != null ? `<div><b>${fd}</b><small>मोफत दिवस उरले</small></div>` : st ? `<div><b>🔥 ${st}</b><small>दिवस सलग अभ्यास</small></div>` : '<div><b>🎯</b><small>आजपासून रोज अभ्यास</small></div>';
    _add(`<div class="dt-tiles">${a}${b}</div>`);
  }
  function _refer() {
    say('🎁 एक गोष्ट सांगू? मित्रांनी तुमच्या code ने app घेतलं तर बक्षीस मिळतं!');
    _add('<div class="dt-card"><b>🎁 Refer &amp; Earn</b><small>मित्रांना सांगा, बक्षीस मिळवा</small><div class="dt-row"><button type="button" class="dt-pill alt dt-go" data-act="refer">See prizes &amp; share</button></div></div>');
  }
  function _weeklyLine() {
    const w = D.weekly; if (!w) return;
    say(w.state === 'live' ? '🔴 महा-Test आत्ता चालू आहे! Home वर "▶ सुरू करा" दाबा.' : `🏆 महा-Test ${esc(_when(w.starts_at))} आहे. ${w.me?.registered ? 'तुम्ही registered आहात 👍' : 'Home वर Register करा (Free).'}`);
  }
  const _when = iso => { const d = new Date(iso), n = new Date(); const days = ['रविवारी', 'सोमवारी', 'मंगळवारी', 'बुधवारी', 'गुरुवारी', 'शुक्रवारी', 'शनिवारी']; const same = (a, b) => a.toDateString() === b.toDateString(); const day = same(d, n) ? 'आज' : same(d, new Date(n.getTime() + DAY)) ? 'उद्या' : days[d.getDay()]; return `${day} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} वाजता`; };
  function _dayDone() {
    if (D.tasks.length) say(`आजचं सगळं पूर्ण! 🔥${D.plan?.progress?.streak ? ` सलग ${D.plan.progress.streak} दिवस.` : ''} उद्या पुन्हा भेटू.`);
    const ed = examDays();
    if (ed != null && D.plan?.progress) say(`📅 ${esc(examName())} ला ${ed} दिवस. अभ्यास ${D.plan.progress.overallPercent}% पूर्ण.`);
    const fd = freeDaysLeft();
    if (fd != null && fd <= 1) {
      say('🎁 मोफत दिवस संपत आले आहेत! असाच अभ्यास पुढे चालू ठेवायचा?');
      return buttons([['🔓 Course पाहा', () => window.APP?.offerSubscribe?.()], ['नंतर', () => say('ठीक आहे. मोफत दिवस संपल्यावर Notes आणि Tests lock होतील, महा-Test मात्र मोफत.')]]);
    }
    if (!S.shared && D.tasks.length) {
      S.shared = true; _save();
      say('आज छान अभ्यास केलात! मित्रांनाही हे app दाखवा? 📤');
      _add('<div class="dt-row"><button type="button" class="dt-pill dt-go" data-act="share">📤 मित्रांना App Share करा</button></div>');
    }
    if (D.weekly) _weeklyLine();
  }

  // ── the teacher makes the Study Plan ──
  async function _askPlan(name) {
    say(`नमस्कार${name ? ' ' + esc(name) : ''}! 😊 मी तुमचा Personal Digital Teacher. रोज काय अभ्यास करायचा ते मी सांगेन आणि तुमचा Study Plan मीच सांभाळेन.`);
    _tiles();
    if (!navigator.onLine) { say('Plan बनवण्यासाठी Internet सुरू करा, मग पुन्हा मला उघडा.'); return; }
    const batch = (D.profile?.assigned_batches || [])[0] || '';
    const exam = await API.fetchNextExam?.(batch).catch(() => null);
    const date = exam?.date ? String(exam.date).slice(0, 10) : '';
    if (date && Date.parse(date) > Date.now()) {
      say(`तुमची परीक्षा <b>${esc(exam.title || 'परीक्षा')}, ${dmy(date)}</b> ला आहे ना?`);
      buttons([['हो, बरोबर', () => _makePlan(exam.title || 'परीक्षा', date)], ['दुसरी तारीख', () => _pickDate()]]);
    } else {
      say('तुमची परीक्षा कधी आहे? तारीख निवडा, मी रोजचा अभ्यास ठरवतो.');
      _pickDate();
    }
  }
  function _pickDate() {
    const min = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    const id = 'dtd' + Date.now().toString(36);
    _add(`<div class="dt-card" id="${id}"><label class="dt-lab">परीक्षेची तारीख<input type="date" min="${min}" id="${id}-d"></label><button type="button" class="dt-pill" id="${id}-go">Plan बनवा</button></div>`);
    $(id + '-go').onclick = () => { const v = $(id + '-d').value; if (!v) return APP.toast?.('तारीख निवडा', 'error'); $(id).remove(); me(`${dmy(v)} ${new Date(v).getFullYear()}`); _makePlan('परीक्षा', v); };
  }
  async function _makePlan(examName, targetDate) {
    S.planAsked = true; _save();
    try {
      const all = await API.fetchStudyHierarchy();
      const batch = (D.profile?.assigned_batches || [])[0];
      const b = all.find(x => x.name === batch) || all[0];
      const subjects = (b?.subjects || []).map(s => ({ subjectId: s }));
      if (!subjects.length) throw new Error('विषय सापडले नाहीत');
      const body = { examName, targetDate, subjects, offDaysOfWeek: [], maxNotesPerDay: 3, maxItemsPerDay: 2, maxPassagesPerDay: 1, maxMcqPerDay: 2, force: true };
      await API.createStudyPlan(body);
      await _fetch(true);
      say(`Plan तयार ✓ रोज ${pending().length || 'काही'} कामं. परीक्षेपर्यंत सगळे धडे पूर्ण होतील. 💪`);
      remember('Plan तयार ✓ आजपासून रोज मी कामं सांगेन.');
      _sub();
      if (D.tasks.length) { say('चला, आजचा अभ्यास सुरू करूया 👇'); D.tasks.forEach(taskCard); }
      _paintFab();
    } catch (e) {
      say(`Plan बनवता आला नाही (${esc(e?.message || 'Internet')}). थोड्या वेळाने पुन्हा मला उघडा.`);
    }
  }

  // ── open a task in the existing viewer; remember it for the way back ──
  async function _openTask(t) {
    const batch = (D.profile?.assigned_batches || [])[0] || '';
    S.pending = { kind: 'task', id: t.id, type: t.itemType, refId: t.refId || '', at: Date.now(), label: t.label || '' };
    _save();
    close();
    if (t.itemType === 'notes') {
      APP.showScreen('notes');
      window.NOTES_VIEWER?.openChapter?.(batch, t.subjectId, t.chapterName);
    } else if (t.itemType === 'mcq') {
      if (!String(t.refId || '').includes('::') && window.TEST_PLAYER?.startTest) await TEST_PLAYER.startTest(t.refId, 'practice');
      else if (window.QUIZ?.startQuiz) await QUIZ.startQuiz(batch, t.subjectId, t.chapterName, 'practice');
    } else {
      window.EXERCISE_VIEWER?.openChapter?.(batch, t.subjectId, t.chapterName);
    }
  }
  async function _openQuiz(id) {
    S.pending = { kind: 'quiz', refId: id, type: 'mcq', at: Date.now() };
    _save();
    close();
    await TEST_PLAYER?.startTest?.(id, 'practice');
  }

  // back on Home after a viewer: react, tick the Study Plan, open the window again
  async function _back() {
    const p = S.pending; S.pending = null; _save();
    const secs = (Date.now() - p.at) / 1000;
    let line = '', done = false;
    const isTest = p.type === 'mcq' && !String(p.refId).includes('::');
    if (isTest) {
      const a = (await DB.getAllAttempts().catch(() => [])).find(x => x.quiz_id === p.refId && Date.parse(x.date) >= p.at - 1000);
      if (!a) line = 'ठीक आहे, test नंतर पूर्ण करू. ते काम इथेच आहे 👇';
      else {
        const pc = a.percent || 0, sc = `${a.score}/${a.max_score}`;
        if (pc >= 80) { line = `शाब्बास! 🎉 ${sc} गुण.`; done = true; }
        else if (pc >= 50) { line = `छान प्रयत्न! ${sc}. Test च्या शेवटी चुकलेले प्रश्न एकदा पाहिले तर पुढच्या वेळी अजून गुण नक्की 💪`; done = true; }
        else line = `हरकत नाही. ${sc}. आधी त्या धड्याचे Notes पुन्हा वाचू, मग हा test परत देऊ 👇`;
      }
    } else if (secs >= 20) {
      line = p.type === 'notes' ? 'Notes झाले ✓ छान! आता पुढचं काम 👇' : p.type === 'mcq' ? 'सराव झाला ✓ छान!' : 'Exercise झाला ✓ छान! आता पुढचं काम 👇';
      done = true;
    } else line = 'ठीक आहे, नंतर पूर्ण करू. ते काम इथेच आहे 👇';
    if (done && p.kind === 'task') await _tick(p.id);
    if (p.kind === 'quiz') D.newTests = D.newTests.filter(q => q.quiz_id !== p.refId);
    remember(line);
    D.loadedAt = 0;
    await open();
  }
  async function _tick(id) {
    const t = D.tasks.find(x => x.id === id);
    if (t) t.status = 'completed';
    DB.setSetting(CACHE, { date: today(), plan: D.plan, tasks: D.tasks }).catch(() => {});
    try { await API.updateStudyTask(id, 'completed'); } catch { /* offline: the cached tick stays; Study Plan shows it next time online */ }
  }

  // ── hooks from app.js ──
  async function onScreen(name) {
    _onHome = name === 'home';
    if (!_onHome) { $('dt-fab')?.classList.add('hidden'); return; }
    if (!(await isActive())) { $('dt-fab')?.classList.add('hidden'); return; }
    await _load();
    if (S.pending) return _back();
    _paintFab();
  }
  async function refresh() {
    if (!(await isActive())) { $('dt-fab')?.remove(); return false; }
    await _load();
    await _fetch();
    _paintFab();
    return true;
  }
  return { refresh, open, close, onScreen, isActive };
})();

window.DIGITAL_TEACHER = DIGITAL_TEACHER;
