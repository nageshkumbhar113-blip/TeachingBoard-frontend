/* ════════════════════════════════════════
   weeklyTest.js — Weekly महा-Test (automatic, every week)
   Global: WEEKLY

   The admin sets a class up once (Admin → Sync); the server makes a new test
   every week. Low server load by design: the encrypted paper is downloaded on
   the phone ahead of time, the test runs on the phone, and only three tiny
   calls happen — the key at start time, the submit, and the result.

   📝 Paper Pattern Practice (kind 'daily', 9.0.1): the class's exam pattern every day (8th NMMS:
   MAT 7 am, SAT 7 pm), the whole class at one time, start only in the first minutes, marks at
   submit, the day total (MAT + SAT = 180) + toppers banner after the day's last paper.
════════════════════════════════════════ */

const WEEKLY = (() => {
  const DAY = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _toast = (m, t = 'info') => window.APP?.toast ? APP.toast(m, t) : console.log(m);
  const _paperKey = id => `weekly_paper_${id}`;
  const _stateKey = id => `weekly_state_${id}`;
  let _events = [];
  let _consent = true;     // "माझं नाव दाखवा" already answered? (asked once, at the first registration)
  let _autoAt = 0;
  let _homeTries = 0;   // Home card load retries after a failure   // last time the countdown itself asked the server again
  let _tick = null;

  // ── a paper handed in without internet (network audit 2026-11-21) ──
  // Its answers wait on the phone and are sent as soon as the internet is back: on 'online', when the app is
  // opened again, every 30 s, from Home and from the "🏠 Home" button. Before, they went only when Home was
  // built again on the next app start — and after the paper's last minute the server refused them, silently.
  const PENDING_IDS = 'weekly_pending_ids';
  let _pendingSet = new Set(), _retrying = false;
  async function _pendingIds() { return (await DB.getSetting(PENDING_IDS, []).catch(() => [])) || []; }
  async function _savePending(ev, body) {
    await DB.setSetting(`weekly_pending_${ev.event_id}`, body).catch(() => {});
    const ids = (await _pendingIds()).filter(x => x.id !== ev.event_id);
    ids.push({ id: ev.event_id, subject: ev.subject || '', title: ev.title || '' });
    await DB.setSetting(PENDING_IDS, ids).catch(() => {});
    _pendingSet.add(ev.event_id);
  }
  async function _clearPending(id) {
    await DB.setSetting(`weekly_pending_${id}`, null).catch(() => {});
    await DB.setSetting(PENDING_IDS, (await _pendingIds()).filter(x => x.id !== id)).catch(() => {});
    _pendingSet.delete(id);
  }
  const EVENTS_CACHE = 'weekly_events_cache';
  // who is logged in on this phone (student code, or the guest's id)
  const _owner = async () => String(await DB.getSetting?.('student_code', '').catch(() => '') || '') || (window.GUEST?.isActive?.() ? 'guest' : '');

  function _when(d) {
    const x = new Date(d);
    const t = x.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(x); day.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today) / 864e5);
    const label = diff === 0 ? 'आज' : diff === 1 ? 'उद्या' : DAY[x.getDay()];
    return `${label} ${t}`;
  }
  function _left(ms) {
    if (ms <= 0) return '0:00';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    if (d) return `${d} दिवस ${h} तास`;
    if (h) return `${h} तास ${m} मि`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Paper: downloaded ahead of time, opened with the key at start ──
  async function _ensurePaper(ev) {
    const saved = await DB.getSetting(_paperKey(ev.event_id), null).catch(() => null);
    if (saved?.data) return saved;
    const paper = await API.weeklyPaper(ev.event_id);
    if (paper) await DB.setSetting(_paperKey(ev.event_id), paper).catch(() => {});
    return paper;
  }
  async function _openPaper(paper, keyB64) {
    const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', b64(keyB64), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(paper.iv) }, key, b64(paper.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // ── Website: after the family's first महा-Test, the next ones are in the app only ──
  const _native = () => !!window.Capacitor?.isNativePlatform?.();
  async function _openGetApp() {
    const gs = window.GUEST?.isActive?.() ? await API.getGuestState().catch(() => ({})) : {};
    const site = /^https?:$/.test(location.protocol) && !/localhost$/.test(location.hostname) ? location.origin : 'https://nkseduorbit.in';
    const q = new URLSearchParams(gs.gid ? { guest: gs.gid } : {});
    if (gs.src === 'teacher' && gs.ref) q.set('teacher', gs.ref);
    window.GUEST?.isActive?.() && API.guestEvent?.('app_click');
    window.open(`${site}/get-app.html${q.toString() ? '?' + q : ''}`, '_blank', 'noopener');
  }
  const APP_ONLY_TEXT = '📲 पुढचे महा-Test फक्त NKs EduOrbit app मध्ये — app download करा, तिथेच महा-Test मिळेल.';
  function _appOnlySheet(msg) {
    const el = document.createElement('div');
    el.className = 'gx-layer gx-dim';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `
      <div class="gx-card" style="text-align:center">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="gx-logo" aria-hidden="true">📲</div>
        <h2 class="gx-title">महा-Test <span class="gx-grad-text">App मध्ये</span></h2>
        <p class="gx-sub">${_esc(msg || APP_ONLY_TEXT)}</p>
        <p class="gx-sub">पहिला महा-Test website वर दिलात 👏 आता पुढचे सगळे महा-Test, rank आणि उत्तरं app मध्ये.</p>
        <button type="button" class="gx-btn gx-big gx-shine" id="wk-ao-app">📲 App download करा</button>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.gx-close').onclick = () => el.remove();
    el.querySelector('#wk-ao-app').onclick = () => { _openGetApp(); };
  }

  // ── Home card ───────────────────────────────────────────────────
  async function renderHomeCard({ fresh = false } = {}) {
    const home = document.getElementById('screen-home');
    if (!home || !window.API?.fetchWeeklyTests || !navigator.onLine) return;
    try { _events = await API.fetchWeeklyTests({ fresh }); _homeTries = 0; }
    catch {   // slow / sleeping server: try the card again a little later (3 times)
      if (_homeTries++ < 3) setTimeout(() => { if (document.getElementById('screen-home')?.offsetParent) renderHomeCard().catch(() => {}); }, 20000);
      return;
    }
    _pendingSet = new Set((await _pendingIds()).map(x => x.id));
    _consent = _events.consent !== false;
    _owner().then(code => DB.setSetting?.(EVENTS_CACHE, { code, events: _events, consent: _events.consent, locked: _events.locked || [] })).catch(() => {});
    window.dispatchEvent(new Event('weekly-toppers'));
    home.querySelector('.wk-strip-wrap')?.remove();
    home.querySelector('.wk-card')?.remove();
    home.querySelector('.wk-lock')?.remove();
    clearInterval(_tick);
    // 🗂️ one swipeable row (owner 2026-11-20): the महा-Test card AND every practice paper (MAT / SAT,
    // पेपर 1 / पेपर 2) side by side — before, only the single "most relevant" one was shown, so the
    // practice paper hid behind the महा-Test (or the other way round).
    const byStart = (x, y) => new Date(x.starts_at) - new Date(y.starts_at);
    const best = list => list.find(e => e.state === 'live' && !e.me.submitted) || list.find(e => e.state === 'live')
      || list.filter(e => e.state === 'upcoming').sort(byStart)[0]
      || list.filter(e => e.state === 'closed' && (e.me.submitted || e.results)).sort((x, y) => new Date(y.ends_at) - new Date(x.ends_at))[0];
    const picks = [];
    const maha = best(_events.filter(e => !_isPractice(e)));
    if (maha) picks.push(maha);
    const prac = _events.filter(_isPractice);
    [...new Set(prac.map(e => e.subject))].forEach(name => { const e = best(prac.filter(x => x.subject === name)); if (e) picks.push(e); });
    // live first, then the next to start, then the closed ones
    const rankOf = e => e.state === 'live' && !e.me.submitted ? 0 : e.state === 'live' ? 1 : e.state === 'upcoming' ? 2 : 3;
    picks.sort((x, y) => rankOf(x) - rankOf(y) || byStart(x, y));
    const wrap = document.createElement('div');
    wrap.className = 'wk-strip-wrap';
    wrap.innerHTML = '<div class="wk-strip" role="region" aria-label="महा-Test आणि Paper Practice"></div><div class="wk-dots" aria-hidden="true"></div>';
    const strip = wrap.firstElementChild;
    const cards = picks.map(ev => {
      const card = document.createElement('div');
      card.className = 'wk-card' + (_isPractice(ev) ? ' wk-prac' : '');
      strip.appendChild(card);
      _paintCard(card, ev);
      if (_pendingSet.has(ev.event_id) && !ev.me?.submitted) _markPending(card, ev);
      return [card, ev];
    });
    _lockedCard(strip);
    const n = strip.children.length;
    if (!n) return;
    wrap.classList.toggle('wk-one', n === 1);
    const dots = wrap.lastElementChild;
    if (n > 1) {
      dots.innerHTML = Array.from({ length: n }, (_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('') + '<span>⇠ बाजूला सरकवा ⇢</span>';
      strip.addEventListener('scroll', () => {
        const i = Math.round(strip.scrollLeft / Math.max(1, strip.firstElementChild.offsetWidth + 10));
        dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === Math.abs(i)));
      }, { passive: true });
    }
    home.insertBefore(wrap, home.querySelector('.gx-guide')?.nextSibling || home.firstElementChild);
    _tick = setInterval(() => {
      if (!wrap.isConnected) return clearInterval(_tick);
      for (const [card, ev] of cards) {
        const target = ev.state === 'upcoming' ? ev.starts_at : ev.state === 'live' ? ev.ends_at : ev.reveal_at;
        const ms = new Date(target) - Date.now();
        const t = card.querySelector('.wk-count');
        if (t) t.textContent = _left(ms);
        if (ms <= 0 && !(ev.state === 'closed' && ev.results)) {
          // a phone whose clock runs ahead of the server reached 0 before the server changed the paper's state:
          // ask again at most every 20 s, not every second (audit 2026-11-21)
          if (Date.now() - _autoAt < 20000) continue;
          _autoAt = Date.now(); clearInterval(_tick); renderHomeCard({ fresh: true }); return;
        }
      }
    }, 1000);
    // every paper still to come is downloaded now, quietly (encrypted): at start time only the
    // ~50-byte key is fetched, so a whole class starting together puts no load on the server
    _events.filter(e => e.state !== 'closed' && !e.me.submitted && (_isPractice(e) || e.me.registered))
      .forEach(e => _ensurePaper(e).catch(() => {}));
    _retryPendingSubmit().catch(() => {});
  }

  // a free student: "🔒 रोजचा Paper Practice फक्त paid विद्यार्थ्यांसाठी"
  // free students and guests (owner 2026-11-21): the class's practice paper is shown, locked; a tap
  // anywhere on the card opens the subscription
  function _lockedCard(box) {
    for (const l of (_events.locked || [])) {
      const el = document.createElement('div');
      el.className = 'wk-card wk-prac wk-lock';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.innerHTML = `<div class="wk-tag">🔒 ${_esc(l.title || 'Paper Practice')}</div>
        <div class="wk-sub">रोज परीक्षेसारखा पूर्ण पेपर · ${l.question_count} प्रश्न · ${l.duration_minutes} मिनिटं</div>
        ${l.starts_at ? `<div class="wk-when">⏰ पुढचा पेपर: ${_esc(l.subject || '')} · ${_esc(_when(l.starts_at))}</div>` : ''}
        <div class="wk-ok">गुण, rank आणि प्रत्येक प्रश्नाची उकल — subscribe करा आणि रोज सराव करा</div>
        <button type="button" class="gx-btn gx-shine wk-btn" data-act="sub">⭐ Subscribe करा</button>`;
      box.appendChild(el);
      const open = () => window.dispatchEvent(new CustomEvent('teachingboard:locked', { detail: { code: 'CHAPTER_LOCKED', from: 'practice' } }));
      el.addEventListener('click', open);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
  }

  const _isPractice = ev => ev?.kind === 'daily';
  const _clock = d => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  // "आजचे: MAT 68/90 · SAT — · एकूण 68/180"
  function _dayLine(day) {
    if (!day?.papers?.length) return '';
    return `<div class="wk-meta">📅 आजचे: ${day.papers.map(x => `${_esc(x.subject)} ${x.score ?? '—'}/${x.total}`).join(' · ')} · <b>एकूण ${day.score}/${day.total}</b>${day.rank ? ` · #${day.rank}` : ''}</div>`;
  }
  async function _startedHere(ev) { return !!(await DB.getSetting(_stateKey(ev.event_id), null).catch(() => null))?.startedAt; }

  function _paintPractice(card, ev) {
    const head = `<div class="wk-tag">📝 ${_esc(ev.title || 'Paper Practice')} · ${_esc(ev.subject)}</div>
      <div class="wk-sub">${ev.question_count} प्रश्न · ${ev.duration_minutes} मिनिटं${(ev.sections || []).length > 1 ? ' · ' + ev.sections.map(x => `${_esc(x.subject)} ${x.count}`).join(' · ') : ''}${ev.negative ? ` · चुकीला −${ev.negative}` : ' · negative marking नाही'}</div>`;
    const join = ev.join_until ? ` · ${_esc(_clock(ev.join_until))} पर्यंत सुरू करा` : '';
    const mine = `<button type="button" class="gx-btn gx-ghost wk-btn" data-act="mine">📊 माझे सगळे गुण · 🔥 streak</button>`;
    if (ev.state === 'upcoming') {
      card.innerHTML = `${head}<div class="wk-when">⏰ ${_esc(_when(ev.starts_at))} · सुरू व्हायला <b class="wk-count">${_left(new Date(ev.starts_at) - Date.now())}</b></div>
        <div class="wk-meta">संपूर्ण class एकाच वेळी${join}</div>${_dayLine(ev.day)}${mine}`;
    } else if (ev.state === 'live') {
      if (ev.me.submitted) card.innerHTML = `${head}<div class="wk-ok">✅ जमा झालं! गुण ${ev.me.score}/${ev.me.total} · 🏆 Rank आणि उत्तरं ${_esc(_when(ev.reveal_at))} ला</div>${_dayLine(ev.day)}${mine}`;
      else {
        const late = ev.join_until && Date.now() > new Date(ev.join_until).getTime();
        card.innerHTML = `${head}<div class="wk-live">🔴 LIVE · संपायला <b class="wk-count">${_left(new Date(ev.ends_at) - Date.now())}</b>${join}</div>
          <div data-slot="go"></div>${_dayLine(ev.day)}${mine}`;
        const go = card.querySelector('[data-slot="go"]');
        const startBtn = '<button type="button" class="gx-btn gx-big gx-shine wk-btn" data-act="start">▶ आत्ता सुरू करा</button>';
        if (!late) go.innerHTML = startBtn;
        else _startedHere(ev).then(started => {
          go.innerHTML = started ? startBtn.replace('आत्ता सुरू करा', 'पेपर पुढे सोडवा') : `<div class="wk-ok">⌛ सुरू करायची वेळ (${_esc(_clock(ev.join_until))}) संपली — पुढचा paper वेळेवर द्या</div>`;
          go.querySelector('[data-act="start"]')?.addEventListener('click', () => start(ev));
        });
      }
    } else if (!ev.results) {
      card.innerHTML = `${head}<div class="wk-ok">${ev.me.submitted ? `✅ गुण ${ev.me.score}/${ev.me.total}. ` : ''}🏆 Rank आणि उत्तरं ${_esc(_when(ev.reveal_at))} ला · <b class="wk-count">${_left(new Date(ev.reveal_at) - Date.now())}</b></div>${_dayLine(ev.day)}${mine}`;
    } else {
      card.innerHTML = `${head}<div class="wk-ok">🎉 निकाल आला!${ev.me.submitted ? '' : ' (तुम्ही हा पेपर दिला नाही)'}</div>${_dayLine(ev.day)}
        <button type="button" class="gx-btn gx-shine wk-btn" data-act="result">🏆 निकाल आणि rank बघा</button>${mine}`;
    }
    card.querySelector('[data-act="start"]')?.addEventListener('click', () => start(ev));
    card.querySelector('[data-act="result"]')?.addEventListener('click', () => showResult(ev));
    card.querySelector('[data-act="mine"]')?.addEventListener('click', () => showPracticeHistory());
  }

  // 📊 every practice day: MAT / SAT / total / rank, and the streak
  async function showPracticeHistory() {
    let d;
    try { d = await API.weeklyPracticeMe(); } catch (err) { _toast(err?.message || 'गुण आणता आले नाहीत', 'error'); return; }
    const el = document.createElement('div');
    el.className = 'gx-layer gx-dim';
    const date = k => new Date(k + 'T12:00:00').toLocaleDateString('mr-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    el.innerHTML = `
      <div class="gx-card wk-res">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="wk-tag" style="margin:0 auto 6px">📊 माझा Paper Practice</div>
        <div class="gx-stats"><div class="gx-stat">🔥 ${d.streak || 0}<small>सलग दिवस</small></div><div class="gx-stat">📝 ${d.given || 0}/${d.held || 0}<small>दिवस दिले</small></div></div>
        ${(d.days || []).length ? `<table class="wk-bysub"><tbody>${d.days.map(x => `<tr><td>${_esc(date(x.day_key))}</td><td>${x.papers.map(p => `${_esc(p.subject)} <b>${p.score}/${p.total}</b>`).join('<br>')}</td><td><b>${x.score}/${x.total}</b>${x.rank ? `<br>#${x.rank}/${x.participants}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="gx-sub">अजून एकही पेपर दिला नाही. पुढचा पेपर वेळेवर द्या!</p>'}
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.gx-close').onclick = () => el.remove();
  }

  function _paintCard(card, ev) {
    if (_isPractice(ev)) { _paintPractice(card, ev); return; }
    const parts = (ev.sections || []).length
      ? `<div class="wk-meta">${ev.sections.map(s => `${_esc(s.subject)} ${s.count}`).join(' · ')}${ev.negative ? ` · चुकीला −${ev.negative}` : ''}</div>` : '';
    const head = `<div class="wk-tag">🏆 ${_esc(ev.title || 'महा-Test')}</div>
      <div class="wk-sub">${_esc(ev.subject)} · ${ev.question_count} प्रश्न · ${ev.duration_minutes} मिनिटं</div>${parts}`;
    if (_events.app_only && !_native() && ev.state !== 'closed' && !ev.me.submitted) {
      card.innerHTML = `${head}
        <div class="wk-when">📅 ${_esc(_when(ev.starts_at))}</div>
        <div class="wk-ok wk-apponly">${_esc(_events.app_only_msg || APP_ONLY_TEXT)}</div>
        <button type="button" class="gx-btn gx-big gx-shine wk-btn" data-act="app">📲 App download करा</button>`;
      card.querySelector('[data-act="app"]').addEventListener('click', () => _openGetApp());
      return;
    }
    if (ev.state === 'upcoming') {
      card.innerHTML = `${head}
        <div class="wk-when">📅 ${_esc(_when(ev.starts_at))} · सुरू व्हायला <b class="wk-count">${_left(new Date(ev.starts_at) - Date.now())}</b></div>
        ${ev.registered_count > 4 ? `<div class="wk-meta">👥 ${ev.registered_count} जण तयार</div>` : ''}
        ${ev.me.registered ? '<div class="wk-ok">✅ तुम्ही registered आहात — वेळ झाली की इथे "सुरू करा" येईल</div>' : '<button type="button" class="gx-btn gx-shine wk-btn" data-act="reg">✍️ Register करा (Free)</button>'}`;
    } else if (ev.state === 'live') {
      card.innerHTML = ev.me.submitted
        ? `${head}<div class="wk-ok">✅ जमा झालं! तुमचे गुण ${ev.me.score}/${ev.me.total}. 🏆 Rank list ${_esc(_when(ev.reveal_at))} ला</div>`
        : `${head}<div class="wk-live">🔴 LIVE · संपायला <b class="wk-count">${_left(new Date(ev.ends_at) - Date.now())}</b></div>
           <button type="button" class="gx-btn gx-big gx-shine wk-btn" data-act="start">▶ आत्ता सुरू करा</button>`;
    } else if (!ev.results) {
      card.innerHTML = `${head}<div class="wk-ok">${ev.me.submitted ? `✅ तुमचे गुण ${ev.me.score}/${ev.me.total}. ` : ''}🏆 Rank list ${_esc(_when(ev.reveal_at))} ला · <b class="wk-count">${_left(new Date(ev.reveal_at) - Date.now())}</b></div>`;
    } else {
      card.innerHTML = `${head}<div class="wk-ok">🎉 Result आला आहे!</div>
        <button type="button" class="gx-btn gx-shine wk-btn" data-act="result">🏆 Result आणि क्रमांक बघा</button>`;
    }
    card.querySelector('[data-act="reg"]')?.addEventListener('click', async () => {
      if (!(await _registerSheet(ev))) return;
      ev.me.registered = true;
      _paintCard(card, ev);
      _ensurePaper(ev).catch(() => {});
    });
    card.querySelector('[data-act="start"]')?.addEventListener('click', () => start(ev));
    card.querySelector('[data-act="result"]')?.addEventListener('click', () => showResult(ev));
  }

  // ── Registration: name + parent's mobile (free visitors), confirm (students) ──
  async function _registerSheet(ev) {
    const guest = !!window.GUEST?.isActive?.();
    const gs = guest ? await API.getGuestState().catch(() => ({})) : {};
    const profile = guest ? null : await API.getStudentProfile?.().catch(() => null);
    const needMobile = guest && !gs.has_parent_mobile;
    const name0 = guest ? (gs.name || '') : (profile?.name || '');
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'gx-layer gx-dim';
      el.setAttribute('role', 'dialog');
      el.innerHTML = `
        <div class="gx-card">
          <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
          <div class="gx-logo" aria-hidden="true">🏆</div>
          <h2 class="gx-title">महा-Test <span class="gx-grad-text">Registration</span></h2>
          <p class="gx-sub">${_esc(ev.subject)} · ${_esc(_when(ev.starts_at))} · ${ev.question_count} प्रश्न · Free</p>
          <label class="gx-field"><span>विद्यार्थ्याचं नाव</span>
            <input class="gx-input" id="wk-r-name" maxlength="30" autocomplete="name" value="${_esc(name0)}" ${guest ? '' : 'readonly'} placeholder="उदा. राहुल" /></label>
          ${guest
            ? (needMobile ? `<label class="gx-field"><span>पालकांचा WhatsApp नंबर</span>
                 <input class="gx-input" id="wk-r-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX" /></label>
                 <label class="gx-check"><input type="checkbox" id="wk-r-ok" /> <span>Test ची आठवण आणि result साठी NKs EduOrbit कडून संपर्कास पालकांची संमती आहे</span></label>` : '')
            : `<label class="gx-field"><span>Mobile</span><input class="gx-input" value="${_esc(profile?.mobile || '—')}" readonly /></label>`}
          <p class="gx-msg" id="wk-r-msg" role="alert"></p>
          <button type="button" class="gx-btn gx-big gx-shine" id="wk-r-go">✍️ Register करा</button>
          ${guest && !window.Capacitor?.isNativePlatform?.() ? `
          <div class="wk-appbox">
            <b>📱 महा-Test App मध्ये सोडवायचा आहे?</b>
            <ol>
              <li>खालील button ने <b>App download</b> करा</li>
              <li>App मध्ये <b>🆕 Register</b> करून तुमचा <b>Student Code</b> तयार करा</li>
              <li>त्या code ने login करा — Home वर 🏆 महा-Test दिसेल</li>
            </ol>
            <button type="button" class="gx-btn gx-cool" id="wk-r-app">📲 App download करा</button>
          </div>` : ''}
        </div>`;
      document.body.appendChild(el);
      const done = v => { el.remove(); resolve(v); };
      el.querySelector('.gx-close').onclick = () => done(false);
      el.querySelector('#wk-r-app')?.addEventListener('click', () => _openGetApp());
      const mob = el.querySelector('#wk-r-mob');
      mob?.addEventListener('focus', async () => {
        if (mob.value.trim() || mob.dataset.hinted) return;
        mob.dataset.hinted = '1';
        const phone = await window.GUEST?.phoneHint?.().catch?.(() => '');
        if (phone && !mob.value.trim()) mob.value = phone;
      });
      el.querySelector('#wk-r-go').onclick = async e => {
        const msg = el.querySelector('#wk-r-msg');
        const name = el.querySelector('#wk-r-name').value.trim();
        if (guest && name.length < 2) { msg.textContent = 'नाव लिहा'; return; }
        if (needMobile && !el.querySelector('#wk-r-ok').checked) { msg.textContent = 'पालकांच्या संमतीवर ✓ करा'; return; }
        e.target.disabled = true; msg.style.color = ''; msg.textContent = '⏳ …';
        try {
          if (guest && name !== gs.name) { await API.startGuestSession({ name }); await API.setGuestState({ name }); }
          if (needMobile) await API.saveGuestContact(mob.value);
          await API.weeklyRegister(ev.event_id, { show_name: true });
          _consent = true;
          await window.GUEST?.refresh?.();
          _toast('✅ Registered! वेळेवर इथे "सुरू करा" येईल', 'success');
          window.GUEST?.fireworks?.(.5);
          done(true);
        } catch (err) {
          e.target.disabled = false;
          if (err?.code === 'APP_ONLY') { done(false); _events.app_only = true; _appOnlySheet(err.message); renderHomeCard({ fresh: true }); return; }
          msg.textContent = err?.message || 'Register झालं नाही';
        }
      };
    });
  }

  // ── Player ──────────────────────────────────────────────────────
  async function start(ev) {
    const btn = document.querySelector('.wk-card [data-act="start"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ उघडत आहे…'; }
    try {
      const paper = await _ensurePaper(ev);
      const key = await API.weeklyKey(ev.event_id);
      const questions = await _openPaper(paper, key);
      _play(ev, questions);
    } catch (err) {
      if (err?.code === 'APP_ONLY') { _appOnlySheet(err.message); return; }
      _toast(err?.code === 'NOT_YET' ? 'Test अजून सुरू झाला नाही' : (err?.message || 'Test उघडता आला नाही'), 'error');
      if (err?.code === 'JOIN_CLOSED') renderHomeCard({ fresh: true });
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '▶ आत्ता सुरू करा'; }
    }
  }

  async function _play(ev, questions) {
    const saved = await DB.getSetting(_stateKey(ev.event_id), null).catch(() => null) || {};
    const st = {
      startedAt: saved.startedAt || Date.now(),
      answers: saved.answers || {},
      leave: saved.leave || 0,
      i: 0,
    };
    // same order every time for this person (seeded by their code)
    const seed = String((await API.getStudentProfile?.().catch(() => null))?.student_code || 'x');
    let h = 0; for (const c of seed + ev.event_id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const mix = arr => arr.slice().sort((a, b) => ((h ^ _hash(a.q_id)) >>> 0) - ((h ^ _hash(b.q_id)) >>> 0));
    let qs;
    if (ev.paper_order === 'sections') {
      const groups = new Map();
      questions.forEach(q => { const k = q.subject || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); });
      qs = [...groups.values()].flatMap(mix);
    } else qs = mix(questions);
    const paperMode = !!ev.paper_order;
    const deadline = Math.min(st.startedAt + ev.duration_minutes * 60000, new Date(ev.ends_at).getTime());
    const save = () => DB.setSetting(_stateKey(ev.event_id), { startedAt: st.startedAt, answers: st.answers, leave: st.leave }).catch(() => {});
    save();

    const el = document.createElement('div');
    el.className = 'gx-layer wk-play';
    el.innerHTML = `
      <div class="wk-top"><span>🏆 ${_esc(ev.subject)}</span><span class="wk-timer" id="wk-timer">--:--</span></div>
      <div class="wk-pal" id="wk-pal"></div>
      <div class="gx-card wk-q" id="wk-q"></div>
      <div class="gx-row wk-nav">
        <button type="button" class="gx-btn gx-ghost" id="wk-prev">← मागे</button>
        <button type="button" class="gx-btn" id="wk-next">पुढे →</button>
      </div>
      <div class="wk-left" id="wk-left" hidden></div>
      <button type="button" class="gx-btn gx-cool" id="wk-submit">✅ Test जमा करा</button>`;
    document.body.appendChild(el);
    const onHide = () => { if (document.hidden) { st.leave++; save(); } };
    document.addEventListener('visibilitychange', onHide);

    const paint = () => {
      const q = qs[st.i];
      const given = st.answers[q.q_id] || '';
      // an option may be text, a picture (figure questions) or both
      const oi = q.option_images || {}, opts = [...new Set([...Object.keys(q.options || {}), ...Object.keys(oi)])].sort()
        .map(k => [k, String((q.options || {})[k] ?? '').trim(), String(oi[k] || '').trim()]).filter(([, v, im]) => v || im);
      el.querySelector('#wk-q').innerHTML = `
        <div class="wk-qn">प्रश्न ${st.i + 1} / ${qs.length}${paperMode && q.subject ? ` · <span class="wk-subj">${_esc(q.subject)}</span>` : ''}${paperMode && q.marks && q.marks !== 1 ? ` · ${q.marks} गुण` : ''}</div>
        <div class="wk-qt">${_esc(q.question)}</div>
        ${q.image ? `<img class="wk-img" src="${_esc(q.image)}" alt="">` : ''}
        ${q.type === 'fib'
          ? `<input class="gx-input" id="wk-fib" value="${_esc(given)}" placeholder="उत्तर लिहा" />`
          : opts.map(([k, v, im]) => `<button type="button" class="wk-opt${given === k ? ' on' : ''}${im ? ' has-img' : ''}" data-k="${_esc(k)}"><b>${_esc(k)}</b> ${_esc(v)}${im ? `<img class="wk-oimg" src="${_esc(im)}" alt="पर्याय ${_esc(k)}">` : ''}</button>`).join('')}`;
      el.querySelectorAll('.wk-opt').forEach(b => b.onclick = () => { st.answers[q.q_id] = b.dataset.k; save(); paint(); });
      el.querySelector('#wk-fib')?.addEventListener('input', e => { st.answers[q.q_id] = e.target.value; save(); palette(); });
      el.querySelector('#wk-prev').disabled = st.i === 0;
      el.querySelector('#wk-next').textContent = st.i === qs.length - 1 ? 'शेवटचा ✓' : 'पुढे →';
      palette();
      window.MATH?.renderElement?.(el.querySelector('#wk-q'));
    };
    // रोजचा पेपर (owner 2026-11-27): "जमा करा" only once every question has an answer — a tap by mistake in the
    // middle no longer ends the paper. The time running out still hands it in. Papers with minus marks: as before.
    const mustAll = _isPractice(ev) && !(Number(ev.negative) > 0);
    const leftN = () => qs.filter(q => !String(st.answers[q.q_id] || '').trim()).length;
    const gate = () => {
      if (!mustAll) return;
      const n = leftN(), b = el.querySelector('#wk-submit'), info = el.querySelector('#wk-left');
      if (b) b.style.display = n > 0 ? 'none' : '';   // .gx-btn sets display, so not the hidden attribute
      if (info) { info.hidden = n === 0; info.textContent = `✍️ अजून ${n} प्रश्न सोडवायचे — सगळे सोडवल्यावर "Test जमा करा" दिसेल`; }
    };
    const palette = () => {
      gate();
      el.querySelector('#wk-pal').innerHTML = qs.map((q, k) => `${ev.paper_order === 'sections' && q.subject && (k === 0 || qs[k - 1].subject !== q.subject) ? `<span class="wk-sec">${_esc(q.subject)}</span>` : ''}<button type="button" class="wk-dot${String(st.answers[q.q_id] || '').trim() ? ' done' : ''}${k === st.i ? ' cur' : ''}" data-i="${k}">${k + 1}</button>`).join('');
      el.querySelectorAll('.wk-dot').forEach(b => b.onclick = () => { st.i = Number(b.dataset.i); paint(); });
    };
    el.querySelector('#wk-prev').onclick = () => { if (st.i > 0) { st.i--; paint(); } };
    el.querySelector('#wk-next').onclick = () => { if (st.i < qs.length - 1) { st.i++; paint(); } };

    let finished = false;
    const finish = async (auto) => {
      if (finished) return;
      const unanswered = qs.filter(q => !String(st.answers[q.q_id] || '').trim()).length;
      if (!auto && mustAll && unanswered) { gate(); _toast(`अजून ${unanswered} प्रश्न सोडवायचे आहेत`, 'info'); return; }
      if (!auto && mustAll && window.UI?.confirmAsync && !(await UI.confirmAsync('सगळे प्रश्न सोडवले ✅ Test जमा करायचा?'))) return;
      if (!auto && unanswered && window.UI?.confirmAsync && !(await UI.confirmAsync(`${unanswered} प्रश्न सोडले आहेत. Test जमा करायचा?`))) return;
      finished = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      const body = {
        answers: qs.map(q => ({ q_id: q.q_id, given: String(st.answers[q.q_id] || '').trim() })),
        time_taken: Math.round((Math.min(Date.now(), deadline) - st.startedAt) / 1000),
        leave_count: st.leave,
      };
      await _savePending(ev, body);
      el.innerHTML = '<div class="gx-card" style="text-align:center"><div class="gx-logo">⏳</div><h2 class="gx-title">जमा होत आहे…</h2></div>';
      let res = null;
      try { res = (await API.weeklySubmit(ev.event_id, body))?.data; await _clearPending(ev.event_id); }
      catch (err) {
        // refused by the server (time over …): say so; no answer (no internet): sent when it is back
        if (err?.status >= 400 && err?.status < 500) { await _clearPending(ev.event_id); _toast('⚠️ पेपर जमा होऊ शकला नाही: ' + (err.status === 404 ? 'हा पेपर आता उपलब्ध नाही' : (err.message || '')), 'error'); }
      }
      _submitted(el, ev, res);
    };
    el.querySelector('#wk-submit').onclick = () => finish(false);
    const timer = setInterval(() => {
      const ms = deadline - Date.now();
      const t = el.querySelector('#wk-timer');
      if (t) { t.textContent = _left(ms); t.classList.toggle('low', ms < 60000); }
      if (ms <= 0) { _toast('⏰ वेळ संपली — test आपोआप जमा होत आहे', 'info'); finish(true); }
    }, 500);
    paint();
  }

  function _hash(s) { let h = 0; for (const c of String(s)) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h; }

  function _submitted(el, ev, res) {
    window.USAGE?.bump('weekly');
    el.className = 'gx-layer gx-hero';
    el.innerHTML = `
      <div class="gx-card">
        <div class="gx-logo">✅</div>
        <h2 class="gx-title">Test जमा झालं!</h2>
        ${res ? `<p class="gx-sub">${_isPractice(ev) ? _esc(ev.subject) + ' चे ' : 'तुमचे '}गुण: <b class="gx-grad-text" style="font-size:1.6rem">${res.score} / ${res.total}</b></p>${_bySubject(res.by_subject)}${res.day?.papers?.length > 1 ? `<p class="gx-sub">📅 आजचे: ${res.day.papers.map(x => `${_esc(x.subject)} ${x.score ?? '—'}/${x.total}`).join(' + ')} = <b>${res.day.score}/${res.day.total}</b></p>` : ''}` : '<p class="gx-sub">Internet आल्यावर आपोआप जमा होईल.</p>'}
        <p class="gx-sub">🏆 Rank list आणि बरोबर उत्तरं <b>${_esc(_when(ev.reveal_at || ev.ends_at))}</b> ला</p>
        <button type="button" class="gx-btn gx-big gx-wa" id="wk-wa" style="display:none">📩 क्रमांक आणि पूर्ण result WhatsApp वर</button>
        <button type="button" class="gx-btn gx-big" id="wk-done">🏠 Home</button>
      </div>`;
    window.GUEST?.fireworks?.(.8);
    el.querySelector('#wk-done').onclick = () => { el.remove(); window.APP?.loadHome?.(); _retryPendingSubmit().catch(() => {}); };
    // a free visitor on the website: one tap opens our WhatsApp bot with "MAHA <id>" — the rank comes there (free)
    if (window.GUEST?.isActive?.() && !window.Capacitor?.isNativePlatform?.()) {
      window.GUEST.botNumber?.().then(n => {
        const b = el.querySelector('#wk-wa');
        if (!n || !b) return;
        b.style.display = "";
        b.onclick = () => { window.GUEST.waBot('MAHA'); b.textContent = '✅ WhatsApp उघडलं — Send दाबा'; };
      }).catch(() => {});
    }
  }

  // a mixed paper's marks, subject by subject
  function _bySubject(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return '';
    return `<table class="wk-bysub"><tbody>${rows.map(r => `<tr><td>${_esc(r.subject)}</td><td><b>${r.score}/${r.total}</b></td><td>✅ ${r.correct}${r.wrong ? ` · ❌ ${r.wrong}` : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  async function _retryPendingSubmit() {
    if (_retrying || !navigator.onLine) return;
    const ids = await _pendingIds(); if (!ids.length) return;
    _retrying = true;
    let sent = 0;
    try {
      for (const p of ids) {
        const body = await DB.getSetting(`weekly_pending_${p.id}`, null).catch(() => null);
        if (!body) { await _clearPending(p.id); continue; }
        try {
          await API.weeklySubmit(p.id, body); await _clearPending(p.id); sent++;
          _toast(`✅ ${p.subject || p.title || 'पेपर'} — उत्तरे जमा झाली`, 'success');
        } catch (err) {
          // the server refused it (time over, paper removed …): tell the child, do not try for ever
          if (err?.status >= 400 && err?.status < 500) { await _clearPending(p.id); _toast(`⚠️ ${p.subject || 'पेपर'} जमा होऊ शकला नाही: ${err.status === 404 ? 'हा पेपर आता उपलब्ध नाही' : (err.message || '')}`, 'error'); }
        }
      }
    } finally { _retrying = false; }
    if (sent && document.getElementById('screen-home')?.offsetParent) renderHomeCard().catch(() => {});
  }
  window.addEventListener('online', () => setTimeout(() => _retryPendingSubmit().catch(() => {}), 1500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _retryPendingSubmit().catch(() => {}); });
  setInterval(() => { if (_pendingSet.size) _retryPendingSubmit().catch(() => {}); }, 30000);
  setTimeout(() => _pendingIds().then(ids => ids.forEach(x => _pendingSet.add(x.id))).catch(() => {}), 0);

  // the Home card of a paper whose answers wait on the phone
  function _markPending(card, ev) {
    card.dataset.pending = '1';
    const box = document.createElement('div');
    box.className = 'wk-ok wk-pending';
    box.innerHTML = '⏳ तुमची उत्तरे phone वर सुरक्षित आहेत — internet आल्यावर आपोआप जमा होतील. <button type="button" class="gx-btn gx-ghost wk-btn" data-act="send">🔄 आत्ता पाठवा</button>';
    (card.querySelector('.wk-sub') || card.firstElementChild)?.after(box);
    box.querySelector('[data-act="send"]').onclick = async e => {
      e.target.disabled = true; e.target.textContent = '⏳ …';
      await _retryPendingSubmit().catch(() => {});
      if (_pendingSet.has(ev.event_id)) { e.target.disabled = false; e.target.textContent = '🔄 आत्ता पाठवा'; _toast('Internet मिळालं की आपोआप जाईल', 'info'); }
    };
  }


  // ── Result reveal ───────────────────────────────────────────────
  async function showResult(ev) {
    let r;
    try { r = await API.weeklyResult(ev.event_id); } catch (err) { _toast(err?.message || 'Result आणता आला नाही', 'error'); return; }
    if (r?.pending) { _toast(`Result ${_when(r.reveal_at)} ला`, 'info'); return; }
    const d = r?.data;
    if (!d) return;
    const me = d.me;
    const medal = n => n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `#${n}`;
    const el = document.createElement('div');
    el.className = 'gx-layer gx-dim';
    el.innerHTML = `
      <div class="gx-card wk-res">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="wk-tag" style="margin:0 auto 6px">${d.kind === 'daily' ? '📝 ' + _esc(d.title || 'Paper Practice') : '🏆 महा-Test'} · ${_esc(d.subject)}</div>
        ${d.day ? `<div class="wk-first">📅 दिवसाचे एकूण: ${d.day.papers.map(x => `${_esc(x.subject)} ${x.score}/${x.total}`).join(' + ')} = <b>${d.day.score}/${d.day.total}</b>${d.day.rank ? ` · एकूण rank <b>#${d.day.rank}</b> / ${d.day.participants}` : (d.day_final ? '' : ' · एकूण rank दिवसाच्या शेवटच्या पेपरनंतर')}</div>` : ''}
        ${(d.day_top || []).length ? `<h3 class="wk-h">🏆 दिवसाचा Rank Board (एकूण)</h3><ol class="wk-top10 wk-board">${d.day_top.map(t => `<li class="${t.me ? 'me' : ''}${t.rank <= 3 ? ' podium' : ''}"><span>${medal(t.rank)}</span><span>${_esc(t.name)}${t.me ? ' (तुम्ही)' : ''}<br><small>${t.papers.map(x => `${_esc(x.subject)} ${x.score}`).join(' · ')}</small></span><b>${t.score}/${t.total}</b></li>`).join('')}</ol>` : ''}
        ${me ? `
          <div class="wk-rank-big">${me.rank ? medal(me.rank) : '—'}</div>
          <div class="gx-sub">${d.participants} students पैकी तुमचा क्रमांक</div>
          <div class="gx-stats"><div class="gx-stat">🎯 ${me.score}/${me.total}<small>गुण</small></div><div class="gx-stat">✅ ${me.correct}<small>बरोबर</small></div><div class="gx-stat">⏱ ${me.time_taken < 60 ? me.time_taken + ' से' : Math.round(me.time_taken / 60) + ' मि'}<small>वेळ</small></div></div>
          ${_bySubject(me.by_subject)}`
          : `<p class="gx-sub">तुम्ही हा ${d.kind === 'daily' ? 'पेपर दिला नाही. पुढचा पेपर' : 'test दिला नाही. पुढच्या आठवड्यात'} नक्की द्या!</p>`}
        ${d.first_free ? '<div class="wk-first">🎁 पहिला महा-Test — सगळी बरोबर उत्तरं आणि उकल मोफत!</div>' : ''}
        <h3 class="wk-h">🏆 ${(d.day_top || []).length ? _esc(d.subject) + ' चा ' : ''}Rank Board · ${d.participants} students</h3>
        <ol class="wk-top10 wk-board">${d.top.map(t => `<li class="${t.me ? 'me' : ''}${t.rank <= 3 ? ' podium' : ''}"><span>${medal(t.rank)}</span><span>${_esc(t.name)}${t.me ? ' (तुम्ही)' : ''}</span><b>${t.score}/${t.total}</b></li>`).join('')}
          ${me?.rank && !d.top.some(t => t.me) ? `<li class="wk-gap">⋯</li><li class="me"><span>#${me.rank}</span><span>तुम्ही</span><b>${me.score}/${me.total}</b></li>` : ''}</ol>
        <div class="gx-row">
          <button type="button" class="gx-btn gx-wa" id="wk-share">📤 Share करा</button>
          ${me ? `<button type="button" class="gx-btn gx-cool" id="wk-photo">${me.rank && me.rank <= 10 ? '🏅 Topper certificate' : '📸 Status photo'}</button>` : ''}
        </div>
        ${d.review_locked ? `<button type="button" class="gx-btn gx-cool wk-review-lock" id="wk-unlock" style="width:100%;margin-top:10px">🔒 बरोबर उत्तरं आणि उकल पाहण्यासाठी Course घ्या</button>` : `<details class="wk-review"><summary>📖 बरोबर उत्तरं बघा</summary>
          ${d.review.map((q, i) => {
            const tx = k => String((q.options || {})[k] ?? k).trim().toLowerCase(), ok = q.given && (q.given === q.answer || (tx(q.given) !== '' && tx(q.given) === tx(q.answer)));
            const show = k => { const t = (q.options || {})[k] ?? k, im = (q.option_images || {})[k]; return `${String(t).trim() ? _esc(t) : _esc(k)}${im ? ` <img class="wk-oimg sm" src="${_esc(im)}" alt="">` : ''}`; };
            return `<div class="wk-rv ${q.given ? (ok ? 'ok' : 'bad') : 'skip'}">${q.subject && (i === 0 || d.review[i - 1].subject !== q.subject) && d.paper_order === 'sections' ? `<div class="wk-sec">${_esc(q.subject)}</div>` : ''}<b>${i + 1}. ${_esc(q.question)}</b>
              <div>✅ ${show(q.answer)}${q.given && !ok ? ` · ❌ तुमचं: ${show(q.given)}` : ''}${!q.given ? ' · ⏭ सोडला' : ''}</div>
              ${q.explanation ? `<small>${_esc(q.explanation).replace(/(^|\n)\s*🖼\s+(https:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif))[ \t]*(?=\n|$)/gi, '$1<img class="sol-fig" src="$2" alt="उकलीतील आकृती" loading="lazy">')}</small>` : ''}</div>`;
          }).join('')}
        </details>`}
      </div>`;
    document.body.appendChild(el);
    if (me?.rank && me.rank <= 10) window.GUEST?.fireworks?.(me.rank <= 3 ? 1.6 : 1); else window.GUEST?.fireworks?.(.6);
    // good marks -> Google Play review sheet (app only, at most once a month)
    if (me?.total) window.APP_REVIEW?.afterResult((me.score / me.total) * 100, 3500);
    el.querySelector('.gx-close').onclick = () => el.remove();
    // answers + उकल are for paid students: open the subscribe sheet (guests get the free-part offer)
    el.querySelector('#wk-unlock')?.addEventListener('click', () => { el.remove(); window.dispatchEvent(new CustomEvent('teachingboard:locked', { detail: { code: 'CHAPTER_LOCKED', from: 'weekly' } })); });
    el.querySelector('#wk-photo')?.addEventListener('click', () => _sharePhoto(d).catch(() => _toast('Photo तयार करता आला नाही', 'error')));
    el.querySelector('#wk-share').onclick = () => {
      const text = me
        ? `🏆 NKs EduOrbit महा-Test (${d.subject}) मध्ये ${d.participants} students पैकी माझा क्रमांक *${me.rank ? '#' + me.rank : '-'}* — गुण ${me.score}/${me.total}!\nपुढच्या आठवड्यात तू पण ये 👉 https://nkseduorbit.in/student-app/?free=1`
        : `🏆 NKs EduOrbit चा दर आठवड्याचा महा-Test! 👉 https://nkseduorbit.in/student-app/?free=1`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (window.Capacitor?.isNativePlatform?.()) window.open(url, '_system'); else window.open(url, '_blank', 'noopener');
    };
  }

  // महा-Test result as a picture (1080×1350) for WhatsApp Status.
  async function _photoCanvas(d) {
    const me = d.me || {};
    const name = (await API.getStudentProfile?.().catch(() => null))?.name || (await API.getGuestState?.().catch(() => ({})))?.name || '';
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1b1340'); bg.addColorStop(.55, '#3b1d86'); bg.addColorStop(1, '#7b2ff7');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const cols = ['#ffc83d', '#ff7a18', '#ff3d77', '#38bdf8', '#ffffff'];
    for (let i = 0; i < 80; i++) { g.save(); g.globalAlpha = .5; g.fillStyle = cols[i % cols.length]; g.translate((i * 157) % W, (i * 263) % H); g.rotate(i); g.fillRect(-9, -4, 18, 8); g.restore(); }
    const font = (w, px) => `${w} ${px}px "Baloo 2", "Noto Sans Devanagari", sans-serif`;
    g.textAlign = 'center';
    // gold ribbon title
    g.fillStyle = '#ffc83d'; g.beginPath(); if (g.roundRect) g.roundRect(240, 70, 600, 96, 48); else g.rect(240, 70, 600, 96); g.fill();
    const top10 = me.rank && me.rank <= 10;
    g.fillStyle = '#3b1d00'; g.font = font(800, 58); g.fillText(top10 ? '🏅 Top 10 Topper' : '🏆 महा-Test', W / 2, 138);
    g.fillStyle = '#fff'; g.font = font(700, 46); g.fillText(`${name ? name + ' · ' : ''}${d.subject}`.slice(0, 40), W / 2, 240);
    // medal / rank
    const rank = me.rank || 0;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(W / 2, 520, 220, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffc83d'; g.lineWidth = 14; g.beginPath(); g.arc(W / 2, 520, 220, 0, Math.PI * 2); g.stroke();
    if (medal) { g.fillStyle = '#ffffff'; g.font = font(800, 230); g.fillText(medal, W / 2, 600); }
    else { g.fillStyle = '#ffc83d'; g.font = font(800, 190); g.fillText(`#${rank || '—'}`, W / 2, 585); }
    g.fillStyle = '#fff'; g.font = font(800, 60);
    g.fillText(`${d.participants} students मध्ये #${rank || '—'}`, W / 2, 830);
    g.font = font(700, 50); g.fillStyle = '#ffd27a';
    g.fillText(`गुण ${me.score}/${me.total}`, W / 2, 905);
    g.fillStyle = '#ff9ec0'; g.font = font(800, 56);
    g.fillText(top10 ? `🎉 महा-Test (${String(d.subject).slice(0, 18)}) Topper!` : 'पुढच्या आठवड्यात मला हरवून दाखव! 😎', W / 2, 1030);
    g.fillStyle = '#fff'; g.font = font(800, 50);
    g.fillText('दर आठवड्याला Free महा-Test', W / 2, 1180);
    g.font = font(700, 40); g.fillText('nkseduorbit.in', W / 2, 1255);
    return cv;
  }

  async function _sharePhoto(d) {
    await document.fonts?.ready;
    const cv = await _photoCanvas(d);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('no image');
    const text = `🏆 महा-Test (${d.subject}) मध्ये ${d.participants} students पैकी माझा क्रमांक #${d.me?.rank || '-'}! 👉 https://nkseduorbit.in/student-app/?free=1`;
    if (!window.Capacitor?.isNativePlatform?.()) {
      const file = new File([blob], 'maha-test.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
      }
    }
    await window.FILE_EXPORT?.saveAndShare(blob, 'maha-test.png');
    if (!window.Capacitor?.isNativePlatform?.()) _toast('📸 Photo save झाला — WhatsApp Status ला टाका', 'success');
  }

  // ── Toppers banner (Home carousel): this class's top 10 until its next महा-Test ──
  async function bannerSlides() {
    if (!_events.length) {
      // only this student's own cache (an old plain-array cache has no owner: not used)
      const cached = await DB.getSetting?.(EVENTS_CACHE, null).catch(() => null);
      const me = await _owner();
      if (cached && !Array.isArray(cached) && cached.code && cached.code === me && Array.isArray(cached.events)) _events = cached.events;
    }
    const now = Date.now();
    const live = _events.filter(e => e.results && (e.toppers || []).length && e.banner_until && new Date(e.banner_until) > now)
      .sort((a, b) => new Date(b.reveal_at) - new Date(a.reveal_at));
    // one class's card per class (latest); a student in many classes sees a different one each day
    const byBatch = [...new Map(live.map(e => [e.batch, e])).values()];
    if (!byBatch.length) return [];
    const ev = byBatch[Math.floor(now / 864e5) % byBatch.length];
    const slides = [];
    if (ev.me?.submitted) slides.push({ banner_id: `wk-top-${ev.event_id}-m`, kind: 'toppers', part: 'mine', ev });
    slides.push({ banner_id: `wk-top-${ev.event_id}-a`, kind: 'toppers', part: 'podium', ev });
    if (ev.toppers.length > 3) slides.push({ banner_id: `wk-top-${ev.event_id}-b`, kind: 'toppers', part: 'list', ev });
    return slides;
  }

  function topperSlideHtml(b) {
    const ev = b.ev, t = ev.toppers;
    const daily = _isPractice(ev), dayTotal = ev.day?.total || ev.toppers?.[0]?.total;
    const head = daily
      ? `<div class="wkb-head">🏆 ${_esc(ev.title || 'Paper Practice')} Toppers · ${_esc(ev.batch)} · एकूण /${dayTotal}</div>`
      : `<div class="wkb-head">🏆 महा-Test Toppers · ${_esc(ev.batch)} · ${_esc(ev.subject)}</div>`;
    const mine = ev.me?.rank
      ? (ev.me.rank <= 10 ? `🎉 तुम्ही #${ev.me.rank}!` : `तुमचा क्रमांक #${ev.me.rank} · पुढच्या वेळी top 10 💪`)
      : '👆 Rank board बघा';
    if (b.part === 'mine') {
      const m = ev.me || {}, pct = m.total ? Math.round((m.score / m.total) * 100) : 0;
      const medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : m.rank && m.rank <= 10 ? '🏅' : '🎯';
      return `<div class="wkb-head">🏆 ${daily ? 'माझा आजचा निकाल · ' + _esc(ev.title || 'Paper Practice') : 'माझा महा-Test Result · ' + _esc(ev.subject)}</div>
        <div class="wkb-mine"><span class="wkb-mine-rank">${medal} ${m.rank ? '#' + m.rank : '—'}</span>
          <span class="wkb-mine-of">${ev.participants ? `${ev.participants} पैकी` : ''}</span>
          <span class="wkb-mine-score"><b>${m.score ?? '—'}/${m.total ?? '—'}</b><small>${pct}%</small></span></div>
        <div class="wkb-me">👆 पूर्ण result, उत्तरं आणि 📸 photo</div>`;
    }
    if (b.part === 'podium') {
      const cell = (x, cls, medal) => x ? `<div class="wkb-pod ${cls}"><span class="wkb-medal">${medal}</span><b>${_esc(x.name)}</b><small>${x.score}/${x.total}</small></div>` : '<div class="wkb-pod"></div>';
      return `${head}<div class="wkb-podium">${cell(t[1], 'p2', '🥈')}${cell(t[0], 'p1', '🥇')}${cell(t[2], 'p3', '🥉')}</div><div class="wkb-me">${mine}</div>`;
    }
    const rows = t.slice(3, 10).map(x => `<li><span>🎖️ #${x.rank}</span><b>${_esc(x.name)}</b><small>${x.score}/${x.total}</small></li>`).join('');
    return `${head}<ol class="wkb-list">${rows}</ol><div class="wkb-me">${ev.participants ? `${ev.participants} students · ` : ''}${mine}</div>`;
  }

  // Teacher (his students) / parent (the children): each practice day — every paper's marks
  // (MAT, SAT with its subjects), the day total, rank, 🔥 streak, and who did not give it.
  function practiceReportHtml(data, { parent = false } = {}) {
    const days = (data?.days || []).slice(0, 7);
    if (!days.length) return '';
    const date = k => new Date(k + 'T12:00:00').toLocaleDateString('mr-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const cell = p => p.score === null || p.score === undefined ? '—'
      : `<b>${p.score}/${p.total}</b>${(p.by_subject || []).length > 1 ? `<br><small>${p.by_subject.map(b => `${_esc(String(b.subject).split(' ')[0])} ${b.score}`).join(' · ')}</small>` : ''}`;
    return `<div class="td-analytics-section wk-report">
      <div class="td-analytics-header"><span class="td-analytics-icon">📝</span><h3 class="td-analytics-title">${_esc(days[0].title || 'Paper Practice')}</h3><span class="td-analytics-sub">${parent ? 'रोजचे गुण' : 'students चे रोजचे गुण'}</span></div>
      ${days.map(g => {
        const gave = g.students.filter(x => x.given).length;
        return `<details class="wk-rep-day"${g === days[0] ? ' open' : ''}><summary><b>${_esc(date(g.day_key))}</b> · ${_esc(g.batch)} · ${parent ? '' : `दिला ${gave}/${g.students.length}`}${g.final ? '' : ' · ⏳ निकाल बाकी'}</summary>
          <div style="overflow-x:auto"><table class="wk-bysub"><thead><tr><th>नाव</th>${g.papers.map(p => `<th>${_esc(p.subject)} /${p.total}</th>`).join('')}<th>एकूण /${g.total}</th><th>Rank</th><th>🔥</th></tr></thead><tbody>
          ${g.students.map(x => `<tr><td>${_esc(x.name || x.code)}</td>${x.given ? x.papers.map(p => `<td>${cell(p)}</td>`).join('') + `<td><b>${x.score}/${x.total}</b></td><td>${x.rank ? '#' + x.rank + (x.participants ? '/' + x.participants : '') : '—'}</td>`
            : `<td colspan="${g.papers.length + 2}">${x.paid === false ? '🔒 subscription नाही' : '❌ पेपर दिला नाही'}</td>`}<td>${x.streak || 0}</td></tr>`).join('')}
          </tbody></table></div></details>`;
      }).join('')}
    </div>`;
  }

  return { renderHomeCard, start, showResult, showPracticeHistory, practiceReportHtml, bannerSlides, topperSlideHtml, __photoCanvas: _photoCanvas };
})();

window.WEEKLY = WEEKLY;
