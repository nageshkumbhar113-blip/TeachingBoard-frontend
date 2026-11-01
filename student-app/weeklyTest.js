/* ════════════════════════════════════════
   weeklyTest.js — Weekly महा-Test (automatic, every week)
   Global: WEEKLY

   The admin sets a class up once (Admin → Sync); the server makes a new test
   every week. Low server load by design: the encrypted paper is downloaded on
   the phone ahead of time, the test runs on the phone, and only three tiny
   calls happen — the key at start time, the submit, and the result.
════════════════════════════════════════ */

const WEEKLY = (() => {
  const DAY = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _toast = (m, t = 'info') => window.APP?.toast ? APP.toast(m, t) : console.log(m);
  const _paperKey = id => `weekly_paper_${id}`;
  const _stateKey = id => `weekly_state_${id}`;
  let _events = [];
  let _tick = null;

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

  // ── Home card ───────────────────────────────────────────────────
  async function renderHomeCard() {
    const home = document.getElementById('screen-home');
    if (!home || !window.API?.fetchWeeklyTests || !navigator.onLine) return;
    try { _events = await API.fetchWeeklyTests(); } catch { return; }
    home.querySelector('.wk-card')?.remove();
    clearInterval(_tick);
    // the most relevant one: live > upcoming > a closed one with my result
    const pick = _events.find(e => e.state === 'live')
      || _events.filter(e => e.state === 'upcoming').sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0]
      || _events.filter(e => e.state === 'closed' && (e.me.submitted || e.results)).sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))[0];
    if (!pick) return;
    const card = document.createElement('div');
    card.className = 'wk-card';
    home.insertBefore(card, home.querySelector('.gx-guide')?.nextSibling || home.firstElementChild);
    _paintCard(card, pick);
    _tick = setInterval(() => {
      if (!card.isConnected) return clearInterval(_tick);
      const target = pick.state === 'upcoming' ? pick.starts_at : pick.state === 'live' ? pick.ends_at : pick.reveal_at;
      const ms = new Date(target) - Date.now();
      const t = card.querySelector('.wk-count');
      if (t) t.textContent = _left(ms);
      if (ms <= 0) { clearInterval(_tick); renderHomeCard(); }
    }, 1000);
    // download the paper quietly so the test needs no big call at start time
    if (pick.state !== 'closed' && !pick.me.submitted) _ensurePaper(pick).catch(() => {});
    _retryPendingSubmit().catch(() => {});
  }

  function _paintCard(card, ev) {
    const head = `<div class="wk-tag">🏆 ${_esc(ev.title || 'महा-Test')}</div>
      <div class="wk-sub">${_esc(ev.subject)} · ${ev.question_count} प्रश्न · ${ev.duration_minutes} मिनिटं</div>`;
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
      el.querySelector('#wk-r-app')?.addEventListener('click', () => {
        const site = /^https?:$/.test(location.protocol) && !/localhost$/.test(location.hostname) ? location.origin : 'https://teachingboard-frontend.vercel.app';
        const q = new URLSearchParams(gs.gid ? { guest: gs.gid } : {});
        if (gs.src === 'teacher' && gs.ref) q.set('teacher', gs.ref);
        window.open(`${site}/get-app.html${q.toString() ? '?' + q : ''}`, '_blank', 'noopener');
      });
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
          await API.weeklyRegister(ev.event_id);
          await window.GUEST?.refresh?.();
          _toast('✅ Registered! वेळेवर इथे "सुरू करा" येईल', 'success');
          window.GUEST?.fireworks?.(.5);
          done(true);
        } catch (err) {
          e.target.disabled = false;
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
      _toast(err?.code === 'NOT_YET' ? 'Test अजून सुरू झाला नाही' : (err?.message || 'Test उघडता आला नाही'), 'error');
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
    const qs = questions.slice().sort((a, b) => ((h ^ _hash(a.q_id)) >>> 0) - ((h ^ _hash(b.q_id)) >>> 0));
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
      <button type="button" class="gx-btn gx-cool" id="wk-submit">✅ Test जमा करा</button>`;
    document.body.appendChild(el);
    const onHide = () => { if (document.hidden) { st.leave++; save(); } };
    document.addEventListener('visibilitychange', onHide);

    const paint = () => {
      const q = qs[st.i];
      const given = st.answers[q.q_id] || '';
      const opts = Object.entries(q.options || {}).filter(([, v]) => String(v ?? '').trim());
      el.querySelector('#wk-q').innerHTML = `
        <div class="wk-qn">प्रश्न ${st.i + 1} / ${qs.length}</div>
        <div class="wk-qt">${_esc(q.question)}</div>
        ${q.image ? `<img class="wk-img" src="${_esc(q.image)}" alt="">` : ''}
        ${q.type === 'fib'
          ? `<input class="gx-input" id="wk-fib" value="${_esc(given)}" placeholder="उत्तर लिहा" />`
          : opts.map(([k, v]) => `<button type="button" class="wk-opt${given === k ? ' on' : ''}" data-k="${_esc(k)}"><b>${_esc(k)}</b> ${_esc(v)}</button>`).join('')}`;
      el.querySelectorAll('.wk-opt').forEach(b => b.onclick = () => { st.answers[q.q_id] = b.dataset.k; save(); paint(); });
      el.querySelector('#wk-fib')?.addEventListener('input', e => { st.answers[q.q_id] = e.target.value; save(); palette(); });
      el.querySelector('#wk-prev').disabled = st.i === 0;
      el.querySelector('#wk-next').textContent = st.i === qs.length - 1 ? 'शेवटचा ✓' : 'पुढे →';
      palette();
      window.MATH?.renderElement?.(el.querySelector('#wk-q'));
    };
    const palette = () => {
      el.querySelector('#wk-pal').innerHTML = qs.map((q, k) => `<button type="button" class="wk-dot${String(st.answers[q.q_id] || '').trim() ? ' done' : ''}${k === st.i ? ' cur' : ''}" data-i="${k}">${k + 1}</button>`).join('');
      el.querySelectorAll('.wk-dot').forEach(b => b.onclick = () => { st.i = Number(b.dataset.i); paint(); });
    };
    el.querySelector('#wk-prev').onclick = () => { if (st.i > 0) { st.i--; paint(); } };
    el.querySelector('#wk-next').onclick = () => { if (st.i < qs.length - 1) { st.i++; paint(); } };

    let finished = false;
    const finish = async (auto) => {
      if (finished) return;
      const unanswered = qs.filter(q => !String(st.answers[q.q_id] || '').trim()).length;
      if (!auto && unanswered && window.UI?.confirmAsync && !(await UI.confirmAsync(`${unanswered} प्रश्न सोडले आहेत. Test जमा करायचा?`))) return;
      finished = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      const body = {
        answers: qs.map(q => ({ q_id: q.q_id, given: String(st.answers[q.q_id] || '').trim() })),
        time_taken: Math.round((Math.min(Date.now(), deadline) - st.startedAt) / 1000),
        leave_count: st.leave,
      };
      await DB.setSetting(`weekly_pending_${ev.event_id}`, body).catch(() => {});
      el.innerHTML = '<div class="gx-card" style="text-align:center"><div class="gx-logo">⏳</div><h2 class="gx-title">जमा होत आहे…</h2></div>';
      let res = null;
      try { res = (await API.weeklySubmit(ev.event_id, body))?.data; await DB.setSetting(`weekly_pending_${ev.event_id}`, null).catch(() => {}); } catch { /* retried from Home */ }
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
    el.className = 'gx-layer gx-hero';
    el.innerHTML = `
      <div class="gx-card">
        <div class="gx-logo">✅</div>
        <h2 class="gx-title">Test जमा झालं!</h2>
        ${res ? `<p class="gx-sub">तुमचे गुण: <b class="gx-grad-text" style="font-size:1.6rem">${res.score} / ${res.total}</b></p>` : '<p class="gx-sub">Internet आल्यावर आपोआप जमा होईल.</p>'}
        <p class="gx-sub">🏆 Rank list आणि बरोबर उत्तरं <b>${_esc(_when(ev.reveal_at || ev.ends_at))}</b> ला</p>
        <button type="button" class="gx-btn gx-big" id="wk-done">🏠 Home</button>
      </div>`;
    window.GUEST?.fireworks?.(.8);
    el.querySelector('#wk-done').onclick = () => { el.remove(); window.APP?.loadHome?.(); };
  }

  async function _retryPendingSubmit() {
    for (const ev of _events) {
      const body = await DB.getSetting(`weekly_pending_${ev.event_id}`, null).catch(() => null);
      if (!body) continue;
      try { await API.weeklySubmit(ev.event_id, body); await DB.setSetting(`weekly_pending_${ev.event_id}`, null); } catch { /* next time */ }
    }
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
        <div class="wk-tag" style="margin:0 auto 6px">🏆 महा-Test · ${_esc(d.subject)}</div>
        ${me ? `
          <div class="wk-rank-big">${me.rank ? medal(me.rank) : '—'}</div>
          <div class="gx-sub">${d.participants} students पैकी तुमचा क्रमांक</div>
          <div class="gx-stats"><div class="gx-stat">🎯 ${me.score}/${me.total}<small>गुण</small></div><div class="gx-stat">✅ ${me.correct}<small>बरोबर</small></div><div class="gx-stat">⏱ ${me.time_taken < 60 ? me.time_taken + ' से' : Math.round(me.time_taken / 60) + ' मि'}<small>वेळ</small></div></div>`
          : '<p class="gx-sub">तुम्ही हा test दिला नाही. पुढच्या आठवड्यात नक्की द्या!</p>'}
        <h3 class="wk-h">🏆 Rank Board · ${d.participants} students</h3>
        <ol class="wk-top10 wk-board">${d.top.map(t => `<li class="${t.me ? 'me' : ''}${t.rank <= 3 ? ' podium' : ''}"><span>${medal(t.rank)}</span><span>${_esc(t.name)}${t.me ? ' (तुम्ही)' : ''}</span><b>${t.score}/${t.total}</b></li>`).join('')}
          ${me?.rank && !d.top.some(t => t.me) ? `<li class="wk-gap">⋯</li><li class="me"><span>#${me.rank}</span><span>तुम्ही</span><b>${me.score}/${me.total}</b></li>` : ''}</ol>
        <div class="gx-row">
          <button type="button" class="gx-btn gx-wa" id="wk-share">📤 Share करा</button>
          ${me ? '<button type="button" class="gx-btn gx-cool" id="wk-photo">📸 Status photo</button>' : ''}
        </div>
        <details class="wk-review"><summary>📖 बरोबर उत्तरं बघा</summary>
          ${d.review.map((q, i) => {
            const ok = q.given && (q.given === q.answer || String((q.options || {})[q.given] ?? q.given).trim().toLowerCase() === String((q.options || {})[q.answer] ?? q.answer).trim().toLowerCase());
            return `<div class="wk-rv ${q.given ? (ok ? 'ok' : 'bad') : 'skip'}"><b>${i + 1}. ${_esc(q.question)}</b>
              <div>✅ ${_esc((q.options || {})[q.answer] ?? q.answer)}${q.given && !ok ? ` · ❌ तुमचं: ${_esc((q.options || {})[q.given] ?? q.given)}` : ''}${!q.given ? ' · ⏭ सोडला' : ''}</div>
              ${q.explanation ? `<small>${_esc(q.explanation)}</small>` : ''}</div>`;
          }).join('')}
        </details>
      </div>`;
    document.body.appendChild(el);
    if (me?.rank && me.rank <= 10) window.GUEST?.fireworks?.(me.rank <= 3 ? 1.6 : 1); else window.GUEST?.fireworks?.(.6);
    el.querySelector('.gx-close').onclick = () => el.remove();
    el.querySelector('#wk-photo')?.addEventListener('click', () => _sharePhoto(d).catch(() => _toast('Photo तयार करता आला नाही', 'error')));
    el.querySelector('#wk-share').onclick = () => {
      const text = me
        ? `🏆 NKs EduOrbit महा-Test (${d.subject}) मध्ये ${d.participants} students पैकी माझा क्रमांक *${me.rank ? '#' + me.rank : '-'}* — गुण ${me.score}/${me.total}!\nपुढच्या आठवड्यात तू पण ये 👉 https://teachingboard-frontend.vercel.app/student-app/?free=1`
        : `🏆 NKs EduOrbit चा दर आठवड्याचा महा-Test! 👉 https://teachingboard-frontend.vercel.app/student-app/?free=1`;
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
    g.fillStyle = '#3b1d00'; g.font = font(800, 58); g.fillText('🏆 महा-Test', W / 2, 138);
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
    g.fillText('पुढच्या आठवड्यात मला हरवून दाखव! 😎', W / 2, 1030);
    g.fillStyle = '#fff'; g.font = font(800, 50);
    g.fillText('दर आठवड्याला Free महा-Test', W / 2, 1180);
    g.font = font(700, 40); g.fillText('teachingboard-frontend.vercel.app', W / 2, 1255);
    return cv;
  }

  async function _sharePhoto(d) {
    await document.fonts?.ready;
    const cv = await _photoCanvas(d);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('no image');
    const text = `🏆 महा-Test (${d.subject}) मध्ये ${d.participants} students पैकी माझा क्रमांक #${d.me?.rank || '-'}! 👉 https://teachingboard-frontend.vercel.app/student-app/?free=1`;
    if (!window.Capacitor?.isNativePlatform?.()) {
      const file = new File([blob], 'maha-test.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
      }
    }
    await window.FILE_EXPORT?.saveAndShare(blob, 'maha-test.png');
    if (!window.Capacitor?.isNativePlatform?.()) _toast('📸 Photo save झाला — WhatsApp Status ला टाका', 'success');
  }

  return { renderHomeCard, start, showResult, __photoCanvas: _photoCanvas };
})();

window.WEEKLY = WEEKLY;
