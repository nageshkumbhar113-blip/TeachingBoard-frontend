/* ════════════════════════════════════════
   guest.js — Free part without login → guide → subscription
   Global: GUEST   (docs/PLAN_guest_funnel.md)

   A shared link (…/student-app/?free=1) opens a welcome screen; the student
   picks a class and uses every FREE chapter (notes, exercise, tests) with a
   server-issued guest token. The app keeps showing ONE next step: next free
   test, retry, share with friends / parents, and — after a test — a real,
   12-hour first-month offer. Paying happens on pay.html (the parent's page,
   also used from the app), which creates the account and keeps the tests.
════════════════════════════════════════ */

const GUEST = (() => {
  const $ = id => document.getElementById(id);
  const SITE = 'https://nkseduorbit.in';
  const OFFER_POPUP_GAP_MS = 24 * 3600 * 1000;   // automatic "all tests?" popup: once a day

  let _active = false;
  let _state = {};

  // ── basics ────────────────────────────────────────────────────────
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _isNative = () => !!window.Capacitor?.isNativePlatform?.();
  // Links we send to other people must open the public site, also from the app.
  const _site = () => (!_isNative() && /^https?:$/.test(location.protocol) && !/localhost$/.test(location.hostname) ? location.origin : SITE);
  const _reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const _toast = (m, t = 'info') => window.APP?.toast ? APP.toast(m, t) : console.log(m);

  async function refresh() {
    const profile = await API.getStudentProfile?.().catch(() => null);
    _active = !!profile?.guest;
    _state = _active ? await API.getGuestState() : {};
    document.body.classList.toggle('is-guest', _active);
    return _active;
  }
  function isActive() { return _active; }

  async function _saveState(patch) { _state = await API.setGuestState(patch); return _state; }

  function _layer(cls, html) {
    const el = document.createElement('div');
    el.className = `gx-layer ${cls}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }
  function _close(el) {
    if (!el || !el.isConnected) return;
    el.classList.add('gx-leaving');
    setTimeout(() => el.remove(), 220);
  }

  function _countUp(el, to, ms = 1100, suffix = '') {
    if (!el) return;
    if (_reduced()) { el.textContent = to + suffix; return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function _vibrate(p) { try { navigator.vibrate?.(p); } catch {} }

  // ── Fireworks + confetti (canvas, ~3 s) ─────────────────────────────
  function fireworks(power = 1) {
    if (_reduced()) return;
    const cv = document.createElement('canvas');
    cv.className = 'gx-fx';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const colors = ['#ff7a18', '#ff3d77', '#7b2ff7', '#ffc83d', '#22c55e', '#38bdf8', '#ffffff'];
    const parts = [];
    const burst = (x, y) => {
      const n = 46 + Math.round(30 * power);
      const c1 = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n, v = (2.2 + Math.random() * 3.4) * dpr;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 60 + Math.random() * 30, c: Math.random() < .7 ? c1 : colors[i % colors.length], r: (1.6 + Math.random() * 1.6) * dpr, kind: 'spark' });
      }
    };
    const confetti = () => {
      for (let i = 0; i < 70 * power; i++) {
        parts.push({ x: Math.random() * W, y: -20 * dpr - Math.random() * H * .4, vx: (Math.random() - .5) * 1.2 * dpr, vy: (1.5 + Math.random() * 2.5) * dpr, life: 200, c: colors[i % colors.length], r: (3 + Math.random() * 3) * dpr, rot: Math.random() * 6, kind: 'paper' });
      }
    };
    const shots = Math.round(3 + 4 * power);
    for (let i = 0; i < shots; i++) setTimeout(() => { burst(W * (.15 + Math.random() * .7), H * (.12 + Math.random() * .38)); _vibrate(18); }, i * 320);
    confetti();
    const t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life--;
        if (p.kind === 'spark') { p.vx *= .985; p.vy = p.vy * .985 + .045 * dpr; }
        else { p.rot += .1; p.vx += Math.sin(p.rot) * .02 * dpr; }
        p.x += p.vx; p.y += p.vy;
        if (p.life <= 0 || p.y > H + 30) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = p.kind === 'spark' ? Math.max(0, p.life / 70) : 1;
        ctx.fillStyle = p.c;
        if (p.kind === 'spark') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      }
      if (now - t0 < 4200 + 1200 * power && (parts.length || now - t0 < shots * 320 + 200)) requestAnimationFrame(frame);
      else cv.remove();
    })(t0);
  }

  // ── Entry: welcome → class → session ───────────────────────────────
  function entryParams() {
    const q = new URLSearchParams(location.search);
    return {
      free: q.has('free'),
      quiz: q.get('quiz') || '',
      batch: q.get('batch') || '',
      from: (q.get('from') || '').slice(0, 30),
      fp: parseInt(q.get('fp'), 10) || 0,
      ref: (q.get('ref') || '').slice(0, 40),
      teacher: (q.get('teacher') || '').slice(0, 40),
      shop: (q.get('shop') || '').slice(0, 40),
      // a Facebook / Instagram ad's own link (Admin › Sync › Ads): ?src=meta&ad=ID
      ad: (q.get('ad') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40),
      // k=r: a regular class's ad (notes + exercise answers, not MCQ tests)
      regular: q.get('k') === 'r',
      // g=GID: the link a parent sent their child — the same visitor (name, result) continues
      g: (q.get('g') || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 10),
      // pe=1: straight to the parent's "register + send the child the link" (from the महा-Test page)
      pe: q.get('pe') === '1',
    };
  }
  function wantsEntry() { return entryParams().free; }

  // The welcome animation must play after the splash has faded, not under it.
  function _afterSplash(maxMs = 3500) {
    return new Promise(resolve => {
      const t0 = Date.now();
      (function check() {
        const s = document.getElementById('app-splash');
        if (!s || s.classList.contains('splash-hiding') || Date.now() - t0 > maxMs) return resolve();
        setTimeout(check, 80);
      })();
    });
  }

  // a parent ad (not a student / teacher ad): the same rule the server uses for Meta's "Lead"
  const _STUDENT_ADS = ['challenge', 'rank', 'beat', 'r-shw', 'r-srev'];
  const _isParentAd = ad => !!ad && !/^(yt-)?t-/.test(ad) && !/^web-/.test(ad) && !/(^|-)vs-[a-z0-9]+$/.test(ad)
    && (ad.endsWith('-demo-rank') || !_STUDENT_ADS.some(v => ad.endsWith('-' + v)));
  const _childLink = gid => `${_site()}/student-app/?free=1&g=${encodeURIComponent(gid || '')}`;
  const _mtPage = batch => `${_site()}/maha-test.html?class=${encodeURIComponent(batch || '')}`;

  // Resolves true once a guest session exists, false if they chose to log in.
  async function start() {
    await _afterSplash();
    const p = entryParams();
    // the child opens the link a parent sent: straight in, their name already there
    if (p.g && await resume(p.g)) {
      const prof = await API.getStudentProfile?.().catch(() => null);
      if (prof?.name) await _saveState({ name: prof.name });
      _toast(`👋 ${prof?.name || 'नमस्कार'}, तुझी Free test उघडत आहे…`, 'success');
      _auto = true;
      return true;
    }
    const challenge = p.quiz && p.batch ? { quiz: p.quiz, batch: p.batch, from: p.from, fp: p.fp, ref: p.ref } : null;
    // ?ref=CODE without a test = a student's own share link (Refer & Earn)
    // ?shop=CODE = a guide / book shop's link or QR poster
    const src = challenge ? 'friend' : p.ad ? 'ad' : p.shop ? 'shop' : p.teacher ? 'teacher' : p.ref ? 'student' : p.free ? 'admin' : '';
    const ref = challenge ? p.ref : p.ad || p.shop || p.teacher || p.ref;
    // a test starts by itself once they are in (a friend's challenge opens its own test through ?quiz=; notes ads read notes)
    _auto = !challenge && !p.regular;
    // the class is in the link: its tests come down now, while the page is being read
    if (challenge) _prefetch({ batch: challenge.batch, src, ref });
    else if (p.batch && !p.regular) _prefetch({ batch: p.batch, src, ref, link_batch: p.batch });

    if (!challenge && p.batch && (p.pe || _isParentAd(p.ad))) return _parentEntry(p, src, ref);
    return new Promise(resolve => {
      const floaters = ['📚', '🏆', '✏️', '🎯', '⭐', '🚀', '🧠', '📝', '🎉', '💡']
        .map((e, i) => `<span style="left:${(i * 37) % 92 + 3}%;top:${(i * 53) % 86 + 5}%;animation-delay:${(i % 5) * .6}s;font-size:${1.6 + (i % 3) * .5}rem">${e}</span>`).join('');
      const el = _layer('gx-hero', `
        <div class="gx-floaters" aria-hidden="true">${floaters}</div>
        <div class="gx-card gx-glass">
          <div class="gx-logo" aria-hidden="true">🚀</div>
          <h1 class="gx-title gx-welcome-title">NKs EduOrbit<b>Free अभ्यास!</b></h1>
          ${challenge && challenge.from ? `<div class="gx-challenge">🏁 ${_esc(challenge.from)} चे ${challenge.fp}% — त्याला मागे टाका!</div>` : ''}
          ${!challenge && p.teacher ? '<div class="gx-challenge">👩‍🏫 तुमच्या सरांनी सुचवलेले Free tests</div>' : ''}
          ${!challenge && p.shop ? '<div class="gx-challenge">🏪 तुमच्या पुस्तक दुकानाकडून Free tests</div>' : ''}
          ${!challenge && p.batch ? `<div class="gx-challenge">🎯 ${_esc(p.batch)} साठी Free tests</div>` : ''}
          <p class="gx-sub">4थी पासून पुढे आणि स्पर्धा परीक्षा: सगळ्या विषयांचे Free Tests, Notes आणि सराव</p>
          <div class="gx-chips">${!challenge && p.regular ? `
            <span class="gx-chip" style="animation-delay:.1s">📒 धड्यानुसार Notes</span>
            <span class="gx-chip" style="animation-delay:.2s">✍️ स्वाध्याय उत्तरं</span>
            <span class="gx-chip" style="animation-delay:.3s">✈️ Internet शिवाय पण</span>
            <span class="gx-chip" style="animation-delay:.4s">✅ Login नाही</span>
          </div><div hidden>` : ''}
            <span class="gx-chip" style="animation-delay:.1s">✅ Login नाही</span>
            <span class="gx-chip" style="animation-delay:.2s">🎁 पूर्ण Free</span>
            <span class="gx-chip" style="animation-delay:.3s">⚡ लगेच Result</span>
            <span class="gx-chip" style="animation-delay:.4s">🏆 तुमचा क्रमांक</span>
          </div>
          <button type="button" class="gx-btn gx-big gx-shine" id="gx-go">${!challenge && p.batch ? (p.regular ? `▶ ${_esc(p.batch)} चा Free धडा पाहा` : `▶ ${_esc(p.batch)} चे Free tests सुरू करा`) : '▶ सुरू करा'}</button>
          ${!challenge && p.batch ? '<button type="button" class="gx-link" id="gx-other">🔄 दुसरा class निवडा</button>' : ''}
          <button type="button" class="gx-link" id="gx-login">माझं account आहे — Login करा</button>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
        </div>`);
      el.querySelector('#gx-login').onclick = () => { _close(el); resolve(false); };
      el.querySelector('#gx-other')?.addEventListener('click', () => { _close(el); _pickClass({ src, ref }).then(resolve); });
      el.querySelector('#gx-go').onclick = async () => {
        if (challenge) {
          const ok = await _openSession(el, { batch: challenge.batch, src, ref }, { challenge });
          if (ok) { _close(el); resolve(true); }
          return;
        }
        // a per-class link (Admin › Free link › class): straight into that class
        if (p.batch) {
          const ok = await _openSession(el, { batch: p.batch, src, ref, link_batch: p.batch });
          if (ok) { _close(el); resolve(true); return; }
          if (!navigator.onLine) return;          // the message says so; they can try again
          _close(el); _pickClass({ src, ref }).then(resolve);   // that class is gone: pick one
          return;
        }
        _close(el);
        _pickClass({ src, ref }).then(resolve);
      };
    });
  }

  // 👨‍👩‍👧 a parent from a parent ad. Owner (2026-11-12): parents opened the page and left without a number, so the
  // child's name + the parent's WhatsApp number come first, on this screen. Then: the child is here → "give the
  // phone to the child" → ▶ (the test starts only on that tap), or the child is not here → the child's link on
  // WhatsApp. "नंबर नंतर" still lets them in — the sheet after question 3 asks then.
  function _parentEntry(p, src, ref) {
    return new Promise(resolve => {
      const el = _layer('gx-hero', `
        <div class="gx-card gx-glass">
          <div class="gx-logo" aria-hidden="true">👨‍👩‍👧</div>
          <h1 class="gx-title gx-welcome-title">पालकांनो,<b>पाल्याची तयारी तपासा</b></h1>
          <div class="gx-challenge">🎯 ${_esc(p.batch)} — Free test, 10 मिनिटं</div>
          <div id="gx-pe-form">
            <p class="gx-sub">Test <b>तुमच्या पाल्याने</b> सोडवायची. <b>Result, क्रमांक आणि कुठे सराव हवा</b> ते तुमच्या WhatsApp वर पाठवतो.</p>
            <label class="gx-field"><span>मुलाचं / मुलीचं नाव</span><input class="gx-input" id="gx-pe-name" maxlength="30" autocomplete="given-name" placeholder="उदा. राहुल" /></label>
            <label class="gx-field"><span>तुमचा WhatsApp नंबर</span><input class="gx-input" id="gx-pe-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX" /></label>
            <label class="gx-check"><input type="checkbox" id="gx-pe-mt" checked /> <span>🏆 रविवारच्या <b>महा-Test</b> साठी पण नोंदणी करा — सगळ्या विद्यार्थ्यांमध्ये क्रमांक</span></label>
            <label class="gx-check"><input type="checkbox" id="gx-pe-ok" /> <span>Result, महा-Test ची आठवण आणि अभ्यासाबद्दल NKs EduOrbit ने WhatsApp / call करायला माझी संमती आहे</span></label>
            <button type="button" class="gx-btn gx-big gx-shine" id="gx-go">👦 पाल्य जवळ आहे — test सुरू करा</button>
            <button type="button" class="gx-btn gx-wa" id="gx-send">📲 पाल्य जवळ नाही — link WhatsApp वर</button>
            <button type="button" class="gx-link" id="gx-pe-later">नंबर नंतर देतो — आधी test पाहू</button>
          </div>
          <div id="gx-pe-done" hidden></div>
          <button type="button" class="gx-link" id="gx-login">माझं account आहे — Login करा</button>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
        </div>`);
      const $e = s => el.querySelector(s), msg = $e('#gx-msg'), nameIn = $e('#gx-pe-name'), mobIn = $e('#gx-pe-mob');
      const enable = () => el.querySelectorAll('button').forEach(b => { b.disabled = false; });
      const bad = inp => { inp.classList.remove('gx-bad'); void inp.offsetWidth; inp.classList.add('gx-bad'); inp.focus(); };
      $e('#gx-login').onclick = () => { _close(el); resolve(false); };
      _hintOnFocus(mobIn);
      _bot();   // the bot's number, ready for the WhatsApp button
      const body = extra => ({ batch: p.batch, src, ref, link_batch: p.batch, ...extra });
      // the महा-Test line on the next view
      const mtLine = (name, mt) => mt ? `<div class="gx-pe-mt">🏆 ${_esc(name)} ची <b>${_esc(new Date(mt.starts_at).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</b> च्या महा-Test साठी नोंदणी झाली${mt.registered_count ? ` (${mt.registered_count + 1} विद्यार्थी)` : ''}. आठवण WhatsApp वर येईल.</div>` : '';

      // name + number + consent → the session, the number (the server also makes the free account), the महा-Test
      async function register() {
        const name = nameIn.value.trim(), mob = mobIn.value.replace(/\D/g, '').slice(-10);
        msg.style.color = '';
        if (name.length < 2) { msg.textContent = 'पाल्याचं नाव लिहा'; bad(nameIn); return null; }
        if (!/^[6-9]\d{9}$/.test(mob)) { msg.textContent = 'तुमचा 10 अंकी WhatsApp नंबर लिहा'; bad(mobIn); return null; }
        if (!$e('#gx-pe-ok').checked) { msg.textContent = 'संमतीवर ✓ करा'; return null; }
        if (!(await _openSession(el, body({ name })))) return null;
        try {
          await _saveState({ name });
          await _saveContact(mob);
          _state.has_parent_mobile = true;
        } catch (err) {
          enable();
          msg.textContent = !navigator.onLine ? 'Internet चालू करून पुन्हा प्रयत्न करा' : (err?.message || 'नंबर तपासा');
          bad(mobIn);
          return null;
        }
        let mt = null;
        if ($e('#gx-pe-mt').checked) {
          try {
            const ev = (await API.fetchWeeklyTests()).find(x => x.state === 'upcoming' && x.open_to !== 'paid');
            if (ev) { if (!ev.me?.registered) await API.weeklyRegister(ev.event_id, { show_name: false }); mt = ev; }
          } catch { /* the test still goes on; the महा-Test can be joined later */ }
        }
        msg.textContent = ''; enable();
        return { name, mt };
      }
      // the child holds the phone now: the test starts only on this tap
      function handOver(name, mt) {
        $e('#gx-pe-form').hidden = true;
        const box = $e('#gx-pe-done'); box.hidden = false;
        box.innerHTML = `
          ${name ? '<p class="gx-sub">✅ नोंद झाली! Result <b>तुमच्या WhatsApp</b> वर येईल.</p>' : ''}
          ${mtLine(name, mt)}
          <div class="gx-pe-hand">📱 आता phone <b>${name ? _esc(name) + ' च्या' : 'पाल्याच्या'} हातात</b> द्या</div>
          <button type="button" class="gx-btn gx-big gx-shine" id="gx-pe-start">▶ ${name ? _esc(name) + ', ' : ''}test सुरू कर</button>`;
        $e('#gx-pe-start').onclick = () => { _close(el); resolve(true); };
      }

      $e('#gx-go').onclick = async () => { const r = await register(); if (r) handOver(r.name, r.mt); };
      $e('#gx-pe-later').onclick = async () => {
        const name = nameIn.value.trim();
        if (!(await _openSession(el, body(name.length >= 2 ? { name } : {})))) return;
        if (name.length >= 2) await _saveState({ name }).catch(() => {});
        enable(); msg.textContent = '';
        handOver(name.length >= 2 ? name : '', null);
      };
      $e('#gx-send').onclick = async () => {
        const r = await register(); if (!r) return;
        API.guestEvent('link_sent');
        const bot = await _bot();
        const link = _childLink(_state.gid);
        const childText = `${r.name}, ${p.batch} ची ही Free test दे — फक्त 10 मिनिटं 📝\nलगेच result आणि क्रमांक मिळेल 🏆\n👇\n${link}`;
        $e('#gx-pe-form').hidden = true;
        const box = $e('#gx-pe-done'); box.hidden = false;
        box.innerHTML = `
          <p class="gx-sub">✅ नोंद झाली! आता ${_esc(r.name)} ला test ची link पाठवा:</p>
          ${mtLine(r.name, r.mt)}
          <button type="button" class="gx-btn gx-wa gx-big" id="gx-pe-wa">📲 WhatsApp उघडा</button>
          <p class="gx-sub">${bot ? 'WhatsApp उघडल्यावर <b>Send</b> दाबा — आमचा bot लगेच link देईल, ती पाल्याला <b>forward</b> करा. Result पण तिथेच येईल.' : 'WhatsApp मध्ये पाल्याला किंवा घरच्या नंबरवर पाठवा.'}</p>
          <button type="button" class="gx-btn gx-ghost" id="gx-pe-result">📊 Result पाहा (ही link जपून ठेवा)</button>
          <button type="button" class="gx-btn gx-ghost" id="gx-pe-mtinfo">🏆 महा-Test ची माहिती</button>
          <button type="button" class="gx-link" id="gx-pe-here">👦 पाल्य आला / आली — याच phone वर test सुरू करा</button>`;
        // a real tap opens WhatsApp (an automatic open after the wait is blocked by browsers)
        $e('#gx-pe-wa').onclick = () => (bot ? _waBot('LINK', r.name) : _wa(childText));
        $e('#gx-pe-result').onclick = () => window.open(_payUrl(), '_blank', 'noopener');
        $e('#gx-pe-mtinfo').onclick = () => window.open(_mtPage(p.batch), '_blank', 'noopener');
        $e('#gx-pe-here').onclick = () => handOver(r.name, null);
      };
    });
  }

  // App installed from the website with the visitor's id: same lead, same tests.
  async function resume(gid) {
    try {
      await API.startGuestSession({ resume_gid: gid, app: _isNative() });
      await _saveState({ started_at: Date.now() });
      await refresh();
      _toast('👋 परत स्वागत! तुमचे free tests इथे आहेत', 'success');
      return true;
    } catch { return false; }
  }

  // the session (and the class's tests) started as soon as the page opened, before any tap
  let _pre = null;
  function _prefetch(body) {
    if (_pre || !navigator.onLine) return;
    _pre = (async () => {
      await API.startGuestSession(body);
      window.SYNC?.fetchQuizzes?.({ silent: true, status: 'published' })?.catch?.(() => {});
    })().catch(() => {});   // a tap tries again and shows the error
  }
  async function _openSession(el, body, extra = {}) {
    const msg = el.querySelector('#gx-msg');
    const btns = el.querySelectorAll('button');
    btns.forEach(b => { b.disabled = true; });
    if (msg) { msg.style.color = ''; msg.textContent = '⏳ उघडत आहे…'; }
    try {
      if (_pre) await _pre;
      await API.startGuestSession(body);
      await _saveState({ challenge: extra.challenge || null, started_at: _state.started_at || Date.now() });
      await refresh();
      return true;
    } catch (err) {
      if (msg) msg.textContent = navigator.onLine ? (err?.message || 'काहीतरी चूक झाली, पुन्हा प्रयत्न करा') : 'Internet चालू करून पुन्हा प्रयत्न करा';
      btns.forEach(b => { b.disabled = false; });
      return false;
    }
  }

  function _pickClass({ src, ref }) {
    return new Promise(resolve => {
      const el = _layer('gx-hero', `
        <div class="gx-card">
          <h2 class="gx-title">तुमचा <span class="gx-grad-text">Class</span> निवडा 🎯</h2>
          <p class="gx-sub">त्या class चे सगळे free tests, notes आणि सराव उघडतील</p>
          <div class="gx-pick-list" id="gx-list"><p class="gx-sub">⏳ उघडत आहे…</p></div>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
          <button type="button" class="gx-link" id="gx-login">माझं account आहे — Login करा</button>
        </div>`);
      el.querySelector('#gx-login').onclick = () => { _close(el); resolve(false); };
      const list = el.querySelector('#gx-list');
      const load = async () => {
        try {
          const batches = await API.fetchGuestBatches();
          if (!batches.length) { list.innerHTML = '<p class="gx-sub">अजून कोणताही class उपलब्ध नाही.</p>'; return; }
          list.innerHTML = batches.map((b, i) => `
            <button type="button" class="gx-pick" data-batch="${_esc(b.name)}" style="animation-delay:${i * 60}ms">
              <span class="gx-pick-icon">${_esc(b.icon || '📚')}</span>
              <span>${_esc(b.name)}<span class="gx-pick-meta">${_esc([b.board, b.medium].filter(Boolean).join(' · ') || `${b.subjects.length} विषय`)}</span></span>
              <span class="gx-pick-go" aria-hidden="true">➜</span>
            </button>`).join('');
          list.querySelectorAll('.gx-pick').forEach(btn => {
            btn.onclick = async () => {
              const ok = await _openSession(el, { batch: btn.dataset.batch, src, ref });
              if (ok) { _close(el); resolve(true); }
            };
          });
        } catch {
          list.innerHTML = `<p class="gx-sub">${navigator.onLine ? 'Server ला जोडता आलं नाही.' : 'Internet नाही.'}</p><button type="button" class="gx-btn gx-ghost" id="gx-retry">🔄 पुन्हा प्रयत्न करा</button>`;
          list.querySelector('#gx-retry').onclick = () => { list.innerHTML = '<p class="gx-sub">⏳ उघडत आहे…</p>'; load(); };
        }
      };
      load();
    });
  }

  // ── Name before the first test ─────────────────────────────────────
  function ensureName() {
    // no number yet: the name comes with it on the sheet inside the test (midTestGate), so the test opens at once
    if (!_active || _state.name || !_state.has_parent_mobile) return Promise.resolve(true);
    return new Promise(resolve => {
      const el = _layer('gx-dim', `
        <div class="gx-card">
          <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
          <div class="gx-logo" aria-hidden="true">✍️</div>
          <h2 class="gx-title">विद्यार्थ्याचं <span class="gx-grad-text">नाव</span>?</h2>
          <p class="gx-sub">Test देणाऱ्या मुलाचं / मुलीचं नाव — result वर आणि share card वर दिसेल. Test नंतर result पाहण्यासाठी पालकांचा WhatsApp नंबर लागेल.</p>
          <label class="gx-field"><span>विद्यार्थ्याचं नाव</span>
            <input class="gx-input" id="gx-name" maxlength="30" autocomplete="given-name" placeholder="उदा. राहुल" /></label>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
          <button type="button" class="gx-btn gx-big" id="gx-ok">▶ Test सुरू करा</button>
        </div>`);
      const input = el.querySelector('#gx-name');
      setTimeout(() => input.focus(), 250);
      el.querySelector('.gx-close').onclick = () => { _close(el); resolve(false); };
      const go = async () => {
        const name = input.value.trim();
        if (name.length < 2) { input.classList.remove('gx-bad'); void input.offsetWidth; input.classList.add('gx-bad'); return; }
        el.querySelector('#gx-ok').disabled = true;
        try { await API.startGuestSession({ name }); } catch { /* the name still lives on the phone */ }
        await _saveState({ name });
        _close(el);
        resolve(true);
      };
      el.querySelector('#gx-ok').onclick = go;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  // the parent's number → the server also makes the free account (code + PIN, free tests only); kept on this
  // phone so the result can show it
  async function _saveContact(mobile) {
    const r = await API.saveGuestContact(mobile);
    if (r?.account?.code) await _saveState({ acct: { code: r.account.code, pin: r.account.pin || '' } }).catch(() => {});
    return r;
  }

  // ── Inside the test (after the 3rd question): the child's name + the parent's number ──
  // Owner's rule (2026-11-08): children who leave half-way must not be lost, so this is not skippable.
  // The test's timers wait while it is open. No internet / server asleep: the test goes on, and the
  // result asks again (the number typed here is filled in there).
  const needsContact = () => _active && !_state.has_parent_mobile;
  function midTestGate() {
    if (!needsContact()) return Promise.resolve(true);
    window.TOUR?.done?.('test-player');   // the test's tour must not sit over this sheet or come after it
    return new Promise(resolve => {
      const el = _layer('gx-hero', `
        <div class="gx-card">
          <div class="gx-logo" aria-hidden="true">📲</div>
          <h2 class="gx-title">छान! <span class="gx-grad-text">3 प्रश्न</span> झाले 👍</h2>
          <p class="gx-sub">Test संपली की <b>result आणि क्रमांक पालकांच्या WhatsApp वर</b> पाठवतो. Test मध्येच बंद झाली तरी पुढची test तिथे मिळेल.</p>
          <label class="gx-field"><span>विद्यार्थ्याचं नाव</span>
            <input class="gx-input" id="gx-mt-name" maxlength="30" autocomplete="given-name" placeholder="उदा. राहुल" /></label>
          <label class="gx-field"><span>पालकांचा WhatsApp नंबर</span>
            <input class="gx-input" id="gx-mt-mob" type="tel" inputmode="tel" autocomplete="tel" placeholder="98XXXXXXXX" maxlength="16" /></label>
          <label class="gx-check"><input type="checkbox" id="gx-mt-ok" /> <span>NKs EduOrbit कडून result व अभ्यासाबद्दल संपर्कास पालकांची संमती आहे</span></label>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
          <button type="button" class="gx-btn gx-big gx-shine" id="gx-mt-go">▶ Test पुढे सुरू करा</button>
        </div>`);
      const $e = s => el.querySelector(s), name = $e('#gx-mt-name'), mob = $e('#gx-mt-mob'), msg = $e('#gx-msg'), go = $e('#gx-mt-go');
      name.value = _state.name || '';
      _hintOnFocus(mob);
      setTimeout(() => (name.value ? mob : name).focus(), 250);
      const bad = inp => { inp.classList.remove('gx-bad'); void inp.offsetWidth; inp.classList.add('gx-bad'); };
      const done = () => { _close(el); resolve(true); };
      go.onclick = async () => {
        const n = name.value.trim(), m = mob.value.replace(/\D/g, '').slice(-10);
        if (n.length < 2) { msg.textContent = 'विद्यार्थ्याचं नाव लिहा'; bad(name); return; }
        if (!/^[6-9]\d{9}$/.test(m)) { msg.textContent = 'पालकांचा 10 अंकी mobile नंबर लिहा'; bad(mob); return; }
        if (!$e('#gx-mt-ok').checked) { msg.textContent = 'पालकांच्या संमतीवर ✓ करा'; return; }
        go.disabled = true; msg.style.color = ''; msg.textContent = '⏳ …';
        if (n !== _state.name) {
          try { await API.startGuestSession({ name: n }); } catch { /* the name still lives on the phone */ }
          await _saveState({ name: n }).catch(() => {});
        }
        try {
          await _saveContact(m);
          _state.has_parent_mobile = true;
          done();
        } catch (err) {
          if (!navigator.onLine || /fetch|network|timeout|failed/i.test(String(err?.message || ''))) {
            await _saveState({ mob_try: m }).catch(() => {});   // asked again with the result, already filled in
            done();
            return;
          }
          go.disabled = false;
          msg.textContent = err?.message || 'योग्य 10 अंकी नंबर द्या';
          bad(mob);
        }
      };
      [name, mob].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); }));
    });
  }

  // ── Result: "Result बघा" → marking → score, fireworks, rank, offer ──
  async function onResult({ attempt, questions = [], quiz = {}, submitted }) {
    if (!_active) return;
    const pct = Number(attempt.percent) || 0;
    const scores = { ...(_state.scores || {}) };
    const prev = scores[quiz.quiz_id];
    scores[quiz.quiz_id] = { first: prev ? prev.first : pct, best: Math.max(prev?.best || 0, pct), last: pct };
    const testsDone = Object.keys(scores).length;
    await _saveState({ scores, tests_done: testsDone, last: { quiz_id: quiz.quiz_id, title: quiz.title || '', subject: quiz.subject || '', chapter: quiz.chapter || '', pct, score: attempt.score, max: attempt.max_score } });

    // 1. The button with the pointing hand
    const gate = _layer('gx-dim', `
      <div class="gx-reveal">
        <h2 class="gx-title">Test पूर्ण! 🎉</h2>
        <p class="gx-sub" style="color:#fff">${_esc(quiz.title || '')}</p>
        <button type="button" class="gx-btn gx-big gx-shine" id="gx-see" style="max-width:320px;margin:18px auto 0">🎯 तुमचा Result बघा</button>
        <div class="gx-hand" aria-hidden="true">👆</div>
      </div>`);
    _vibrate([30, 40, 30]);
    await new Promise(r => { gate.querySelector('#gx-see').onclick = r; });
    _close(gate);
    // The result opens after the parent's number (once; never asked again).
    if (!_state.has_parent_mobile) await contactGate({ forResult: true });

    // 2. Marking → ring → verdict
    const ans = Array.isArray(attempt.answers) ? attempt.answers : [];
    const dots = ans.slice(0, 60).map((a, i) => `<div class="gx-dot" data-k="${a.given === null || a.given === undefined ? 'skip' : a.correct ? 'ok' : 'bad'}">${i + 1}</div>`).join('');
    const R = 70, C = 2 * Math.PI * R;
    const weak = ans.map((a, i) => (!a.correct && a.given !== null && a.given !== undefined ? i + 1 : 0)).filter(Boolean).slice(0, 6);
    const ch = _state.challenge && _state.challenge.quiz === quiz.quiz_id ? _state.challenge : null;
    const improved = prev && pct > prev.last ? { from: prev.last, to: pct } : null;
    // the bot can only write after the parent writes first (free messages): one tap opens WhatsApp with
    // "RESULT <code>" already typed, they press Send, and the result, the offer and the next tests come there
    const bot = await _bot();
    const verdict = pct >= 90 ? '🏆 जबरदस्त!' : pct >= 75 ? '🔥 खूप छान!' : pct >= 50 ? '⭐ छान प्रयत्न!' : '💪 पुन्हा प्रयत्न करा!';

    const el = _layer('gx-dim', `
      <div class="gx-card" id="gx-res">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <p class="gx-sub" style="margin:0 0 4px">${_esc(quiz.subject || '')}${quiz.chapter ? ' — ' + _esc(quiz.chapter) : ''}</p>
        <div class="gx-marking" id="gx-mark">${dots}</div>
        <div class="gx-score-ring">
          <svg viewBox="0 0 168 168" aria-hidden="true">
            <defs><linearGradient id="gxRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a18"/><stop offset=".5" stop-color="#ff3d77"/><stop offset="1" stop-color="#7b2ff7"/></linearGradient></defs>
            <circle class="gx-ring-bg" cx="84" cy="84" r="${R}"/>
            <circle class="gx-ring-fg" id="gx-ring" cx="84" cy="84" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
          </svg>
          <div class="gx-score-num"><b id="gx-pct">0%</b><small>${_esc(attempt.score)} / ${_esc(attempt.max_score)} गुण</small></div>
        </div>
        <div id="gx-after" hidden>
          <div class="gx-verdict">${verdict}</div>
          ${improved ? `<div class="gx-compare">🚀 ${improved.from}% → ${improved.to}% (+${improved.to - improved.from}%)</div>` : ''}
          ${ch && ch.from ? `<div class="gx-compare">${pct >= ch.fp ? '🏆' : '⚔️'} तुम्ही ${pct}% vs ${_esc(ch.from)} ${ch.fp}%</div>` : ''}
          <div class="gx-stats">
            <div class="gx-stat">✅ ${_esc(attempt.correct)}<small>बरोबर</small></div>
            <div class="gx-stat">❌ ${_esc(attempt.wrong)}<small>चूक</small></div>
            <div class="gx-stat">⏭ ${_esc(attempt.skipped)}<small>सोडले</small></div>
          </div>
          <div class="gx-rank" id="gx-rank" hidden></div>
          ${weak.length ? `<p class="gx-weak">📌 अजून सराव हवा: प्रश्न ${weak.join(', ')}</p>` : ''}
          ${_state.acct?.code ? `<div class="gx-acct">
            <b>📲 ${_esc(_state.name || 'तुमचं')} चं app account तयार!</b>
            <div class="gx-acct-code">Code: <b>${_esc(_state.acct.code)}</b> · PIN: <b>${_esc(_state.acct.pin || 'तुमचाच')}</b>
              <button type="button" class="gx-acct-copy" id="gx-acct-copy" aria-label="Code आणि PIN copy करा">📋 Copy</button></div>
            <p>${_isNative() ? 'Profile › Logout → Login मध्ये हा Code आणि PIN टाका' : 'App उघडा → Login → Code आणि PIN टाका'} → बाकीच्या free tests सोडवा</p>
            ${_isNative() ? '' : `<a class="gx-btn gx-big gx-shine" id="gx-acct-app" href="${PLAY}" target="_blank" rel="noopener">📲 App उघडा</a>`}
            <small>✍️ Code आणि PIN लिहून ठेवा किंवा screenshot घ्या</small>
          </div>` : ''}
          ${bot ? '<button type="button" class="gx-btn gx-big gx-wa gx-shine" id="gx-res-wa">📩 Result आणि सवलत WhatsApp वर मिळवा</button><p class="gx-sub" style="margin-top:4px">WhatsApp उघडेल, फक्त <b>Send</b> दाबा. पुढच्या tests पण तिथेच मिळतील.</p>' : ''}
          <div id="gx-offer-box"></div>
          <button type="button" class="gx-btn gx-big" id="gx-primary"></button>
          <div class="gx-row">
            <button type="button" class="gx-btn gx-wa" id="gx-share-f">👫 मित्रांना</button>
            <button type="button" class="gx-btn gx-wa" id="gx-share-p">👨‍👩‍👧 पालकांना</button>
          </div>
          <button type="button" class="gx-btn gx-cool" id="gx-photo">📸 Status साठी Result photo</button>
          <p class="gx-sub gx-refer-note">🎁 Account असलेल्या students ना मित्र जोडल्यावर बक्षिसं मिळतात (Refer &amp; Earn). Account बनवा आणि तिथून मित्रांना share करा!</p>
          ${_isNative() ? '' : '<button type="button" class="gx-btn gx-ghost" id="gx-getapp">📲 App मध्ये पुढचे tests (offline पण चालतात)</button>'}
          <button type="button" class="gx-btn gx-ghost" id="gx-secondary"></button>
          <button type="button" class="gx-btn gx-ghost" id="gx-analysis">📊 पूर्ण analysis बघा</button>
        </div>
      </div>`);

    const close = () => _close(el);
    el.querySelector('.gx-close').onclick = close;
    el.querySelector('#gx-res-wa')?.addEventListener('click', () => _waBot('RESULT'));
    el.querySelector('#gx-acct-copy')?.addEventListener('click', async e => {
      const t = `NKs EduOrbit · Code: ${_state.acct.code} · PIN: ${_state.acct.pin || ''}`;
      try { await navigator.clipboard.writeText(t); e.target.textContent = '✅ Copied'; } catch { _toast(t, 'info'); }
    });
    el.querySelector('#gx-acct-app')?.addEventListener('click', () => API.guestEvent('app_click'));

    const dotEls = [...el.querySelectorAll('.gx-dot')];
    const stepMs = _reduced() ? 0 : Math.max(35, Math.min(110, 1400 / Math.max(1, dotEls.length)));
    for (const d of dotEls) {
      d.classList.add(`gx-${d.dataset.k}`);
      d.textContent = d.dataset.k === 'ok' ? '✓' : d.dataset.k === 'bad' ? '✗' : '–';
      if (stepMs) { _vibrate(d.dataset.k === 'ok' ? 8 : 0); await new Promise(r => setTimeout(r, stepMs)); }
    }
    el.querySelector('#gx-ring').style.strokeDashoffset = String(C * (1 - pct / 100));
    _countUp(el.querySelector('#gx-pct'), pct, 1300, '%');
    await new Promise(r => setTimeout(r, _reduced() ? 0 : 1100));
    el.querySelector('#gx-after').hidden = false;
    fireworks(pct >= 90 ? 1.6 : pct >= 75 ? 1.2 : pct >= 50 ? .9 : .5);

    // buttons
    const primary = el.querySelector('#gx-primary'), secondary = el.querySelector('#gx-secondary');
    const retry = () => { close(); window.TEST_PLAYER?.startTest(quiz.quiz_id, attempt.mode || 'practice'); };
    const next = () => { close(); goNext(); };
    const nextLabel = !_isNative() && _state.web_day === _istDay() ? '📩 पुढची free test' : '➡ पुढचा Free भाग';
    if (pct < 50) {
      primary.textContent = '🔁 पुन्हा प्रयत्न करा'; primary.onclick = retry;
      secondary.textContent = nextLabel; secondary.onclick = next;
    } else {
      primary.textContent = nextLabel; primary.onclick = next;
      secondary.textContent = '🔁 पुन्हा प्रयत्न करा'; secondary.onclick = retry;
    }
    const ctx = { quiz, pct, score: attempt.score, max: attempt.max_score, improved, weak };
    el.querySelector('#gx-share-f').onclick = () => shareFriend(ctx);
    el.querySelector('#gx-share-p').onclick = () => shareParent(ctx);
    el.querySelector('#gx-photo').onclick = () => shareResultImage(ctx).catch(() => _toast('Photo तयार करता आला नाही', 'error'));
    el.querySelector('#gx-getapp')?.addEventListener('click', () => {
      const q = new URLSearchParams({ guest: _state.gid || '' });
      if ((_state.src === 'teacher' || _state.src === 'shop') && _state.ref) q.set('teacher', _state.ref);
      window.open(`${_site()}/get-app.html?${q.toString()}`, '_blank', 'noopener');
    });
    el.querySelector('#gx-analysis').onclick = async () => {
      if (!_state.has_parent_mobile && !(await contactGate())) return;
      close();   // the detailed review underneath (testPlayer results view)
    };

    // rank (after the attempt reached the server) and the offer
    Promise.resolve(submitted).catch(() => {}).then(async () => {
      try {
        const rank = await API.fetchGuestRank(quiz.quiz_id);
        if (rank?.rank && el.isConnected) {
          const box = el.querySelector('#gx-rank');
          box.hidden = false;
          if (rank.total <= 1) {
            box.innerHTML = '🥇 हा test देणारे <b>पहिले</b> तुम्ही! मित्रांना challenge द्या';
          } else {
            box.innerHTML = `🏆 ${rank.total} students पैकी तुमचा क्रमांक <b id="gx-rank-n">#${rank.total}</b>`;
            const n = box.querySelector('#gx-rank-n');
            let k = rank.total;
            const t = setInterval(() => { k = Math.max(rank.rank, k - Math.max(1, Math.ceil((k - rank.rank) / 4))); n.textContent = '#' + k; if (k <= rank.rank) clearInterval(t); }, 70);
          }
          ctx.rank = rank;
        }
      } catch { /* offline — rank later */ }
      try {
        const offer = await API.claimGuestOffer();
        if (offer && el.isConnected) _renderOfferBox(el.querySelector('#gx-offer-box'), offer);
      } catch { /* offline */ }
    });
  }

  // ── Offer (12-hour first-month discount) ───────────────────────────
  async function _prices() {
    try {
      const r = await API.request(`/guest/public/${encodeURIComponent(_state.gid || '')}`);
      _lastInfo = r?.data || _lastInfo;
      return r?.data || null;
    } catch { return null; }
  }

  function _timer(el, expiresAt, onEnd) {
    const tick = () => {
      if (!el.isConnected) return clearInterval(id);
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { clearInterval(id); onEnd?.(); return; }
      const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      el.innerHTML = [h, m, s].map(v => `<span>${String(v).padStart(2, '0')}</span>`).join(':');
    };
    const id = setInterval(tick, 1000);
    tick();
  }

  async function _renderOfferBox(host, offer, { button = true } = {}) {
    if (!host || !offer?.active) return;
    const info = await _prices();
    const monthly = info?.prices?.monthly || 0, yearly = info?.prices?.yearly || 0;
    const cut = v => Math.round(v * (1 - (offer.percent || 50) / 100));
    host.innerHTML = `
      <div class="gx-offer">
        <span class="gx-offer-tag">🎁 Test पूर्ण केल्याबद्दल</span>
        <div class="gx-offer-head">पहिल्या payment वर ${offer.percent}% सवलत!</div>
        ${(offer.steps || []).length === 2 ? `<div class="gx-sub" style="font-size:.8rem">${offer.steps[0].percent}% → ${new Date(offer.steps[0].ends).toLocaleString('mr-IN-u-nu-latn', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} पर्यंत · नंतर ${offer.steps[1].percent}% → ${new Date(offer.steps[1].ends).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' })} पर्यंत</div>` : ''}
        ${monthly ? `<div class="gx-offer-price">Monthly: <s>₹${monthly}</s><b>₹${cut(monthly)}</b></div>` : ''}
        ${yearly ? `<div class="gx-offer-price">Yearly: <s>₹${yearly}</s><b>₹${cut(yearly)}</b></div>` : ''}
        <div>⏳ फक्त <span class="gx-timer" id="gx-timer"></span> बाकी</div>
        <div class="gx-offer-fine">फक्त पहिल्या payment वर. नंतरचे payments पूर्ण किमतीत${monthly ? ` (Monthly ₹${monthly}` : ''}${monthly && yearly ? ',' : ''}${yearly ? `${monthly ? '' : ' ('} Yearly ₹${yearly}` : ''}${monthly || yearly ? ')' : ''}.</div>
        ${button ? '<button type="button" class="gx-btn gx-shine" id="gx-unlock">🔓 सगळे tests उघडा</button>' : ''}
      </div>`;
    _timer(host.querySelector('#gx-timer'), offer.expires_at, () => { host.innerHTML = ''; });
    host.querySelector('#gx-unlock')?.addEventListener('click', () => openPay());
    API.guestEvent('offer_seen');
  }

  // "सगळे tests हवेत का?" — from a 🔒 tap (always) or the guide (once a day).
  async function showOffer(reason = 'locked') {
    if (!_active) return;
    if (reason !== 'locked' && Date.now() - (_state.offer_popup_at || 0) < OFFER_POPUP_GAP_MS) return;
    if (document.querySelector('.gx-layer:not(.gx-leaving)')) return;
    // regular-class visitors read notes and may never take a test: the number comes here
    // (asked at most once a day: "नंतर" is respected)
    if (reason === 'locked' && !_state.has_parent_mobile && Date.now() - (_state.mob_ask_at || 0) > 864e5) {
      await _saveState({ mob_ask_at: Date.now() });
      await contactGate({ forLocked: true });
      await new Promise(r => setTimeout(r, 260));
    }
    await _saveState({ offer_popup_at: Date.now() });
    const info = await _prices();
    const offer = info?.offer?.active ? info.offer : null;
    const monthly = info?.prices?.monthly || 0, yearly = info?.prices?.yearly || 0;
    const perDay = yearly ? Math.max(1, Math.round(yearly / 365)) : monthly ? Math.max(1, Math.round(monthly / 30)) : 0;
    const el = _layer('gx-dim', `
      <div class="gx-card">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="gx-logo" aria-hidden="true">${reason === 'locked' ? '🔒' : '🎯'}</div>
        <h2 class="gx-title">सगळे tests <span class="gx-grad-text">सोडवायचे</span> आहेत का?</h2>
        <ul class="gx-feats">
          <li style="animation-delay:.05s">📝 सगळ्या chapters चे सगळे tests</li>
          <li style="animation-delay:.1s">💡 प्रत्येक प्रश्नाचं स्पष्टीकरण</li>
          <li style="animation-delay:.15s">📖 Notes, Exercise आणि सराव</li>
          <li style="animation-delay:.2s">👨‍👩‍👧 पालकांना weekly progress report</li>
        </ul>
        ${perDay ? `<p class="gx-sub" style="margin:6px 0 0">दिवसाला फक्त <b class="gx-grad-text" style="font-size:1.4rem">₹${perDay}</b>${yearly ? ' (Yearly)' : ''}</p>` : ''}
        <p class="gx-sub" id="gx-exam" style="margin:6px 0 0"></p>
        <div id="gx-offer-box"></div>
        <button type="button" class="gx-btn gx-big" id="gx-yes">हो, सगळे हवेत 🚀</button>
        <button type="button" class="gx-btn gx-wa" id="gx-ask">👨‍👩‍👧 पालकांना विचारा</button>
        <button type="button" class="gx-link" id="gx-later">आत्ता नको</button>
      </div>`);
    const close = () => _close(el);
    el.querySelector('.gx-close').onclick = close;
    el.querySelector('#gx-later').onclick = async () => { await _saveState({ offer_snooze_tests: (_state.tests_done || 0) + 2 }); close(); };
    el.querySelector('#gx-yes').onclick = () => { close(); openPay(); };
    el.querySelector('#gx-ask').onclick = () => shareAskParents(info);
    if (offer) _renderOfferBox(el.querySelector('#gx-offer-box'), offer, { button: false });
    _examLine().then(line => { const x = el.querySelector('#gx-exam'); if (x && line) x.innerHTML = line; });
    API.guestEvent('offer_seen');
  }

  // ── Pay (pay.html — the same page the parent gets) ─────────────────
  function _payUrl() { return `${_site()}/parent-pay.html?g=${encodeURIComponent(_state.gid || '')}`; }

  function openPay() {
    const url = _payUrl();
    API.guestEvent('checkout');
    const Browser = window.Capacitor?.Plugins?.Browser;
    if (Browser) Browser.open({ url });
    else window.open(url, '_blank', 'noopener');
    _waitForPayment();
  }

  function _waitForPayment() {
    if (document.querySelector('#gx-wait')) return;
    const el = _layer('gx-dim', `
      <div class="gx-card" id="gx-wait">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="gx-logo" aria-hidden="true">💳</div>
        <h2 class="gx-title">Payment पूर्ण झालं?</h2>
        <p class="gx-sub">Payment page वर account तयार होईल. पूर्ण झाल्यावर इथे परत येऊन हे बटण दाबा.</p>
        <button type="button" class="gx-btn gx-big" id="gx-done">✅ Payment झालं — पुढे चला</button>
        <button type="button" class="gx-link" id="gx-again">Payment page पुन्हा उघडा</button>
        <p class="gx-msg" id="gx-msg" role="alert"></p>
      </div>`);
    el.querySelector('.gx-close').onclick = () => _close(el);
    el.querySelector('#gx-again').onclick = () => { _close(el); openPay(); };
    el.querySelector('#gx-done').onclick = async () => {
      const msg = el.querySelector('#gx-msg');
      msg.style.color = ''; msg.textContent = '⏳ तपासत आहे…';
      const info = await _prices();
      if (!info?.paid || !info.student_code) {
        msg.textContent = 'अजून payment दिसत नाही. पूर्ण केलं असेल तर 1 मिनिटाने पुन्हा दाबा.';
        return;
      }
      _close(el);
      _loginAfterPay(info.student_code, info.name);
    };
  }

  function _loginAfterPay(code, name) {
    const el = _layer('gx-hero', `
      <div class="gx-card">
        <div class="gx-logo" aria-hidden="true">🎉</div>
        <h2 class="gx-title">अभिनंदन${name ? ', ' + _esc(name) : ''}!</h2>
        <p class="gx-sub">तुमचं account तयार आहे. Payment page वर ठेवलेला PIN टाका.</p>
        <label class="gx-field"><span>Student Code</span><input class="gx-input" id="gx-code" value="${_esc(code)}" readonly /></label>
        <label class="gx-field"><span>PIN</span><input class="gx-input" id="gx-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" /></label>
        <p class="gx-msg" id="gx-msg" role="alert"></p>
        <button type="button" class="gx-btn gx-big gx-shine" id="gx-in">🚀 सुरू करा</button>
      </div>`);
    fireworks(1.4);
    el.querySelector('#gx-in').onclick = async () => {
      const pin = el.querySelector('#gx-pin').value.trim();
      const msg = el.querySelector('#gx-msg');
      if (!/^\d{4}$/.test(pin)) { msg.textContent = '4 अंकी PIN टाका'; return; }
      msg.style.color = ''; msg.textContent = '⏳ उघडत आहे…';
      try {
        await API.loginStudent({ student_code: code, pin, device_id: window.APP?.deviceId?.() || '' });
        await API.setGuestState({});
        // the PIN was just checked: the reload must not ask for it again (app.js reads this once)
        try { sessionStorage.setItem('tb_pin_ok', code); } catch { /* then the PIN is asked once more */ }
        location.reload();
      } catch (err) {
        msg.textContent = err?.message || 'PIN चुकीचा आहे';
      }
    };
  }

  // ── WhatsApp share ─────────────────────────────────────────────────
  function _wa(text) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (_isNative()) window.open(url, '_system');
    else window.open(url, '_blank', 'noopener');
  }
  // the WhatsApp bot: its number from the server ('' = no bot yet → the forms stay as they are)
  let _botNum = null;
  async function _bot() {
    if (_botNum === null) { try { _botNum = (await API.fetchBotConfig())?.data?.number || ''; } catch { _botNum = ''; } }
    return _botNum;
  }
  // open the bot's chat with "<KEYWORD> <gid>" ready — the parent only taps Send
  function _waBot(keyword, extra = '') {
    const url = `https://wa.me/${_botNum}?text=${encodeURIComponent(`${keyword} ${_state.gid || ''} ${extra}`.replace(/\s+/g, ' ').trim())}`;
    API.guestEvent('wa_bot');
    if (_isNative()) window.open(url, '_system');
    else window.open(url, '_blank', 'noopener');
  }

  function _friendLink(quiz, pct) {
    const q = new URLSearchParams({ free: '1', quiz: quiz.quiz_id, batch: quiz.batch || _state.batch || '', from: _state.name || '', fp: String(pct), ref: _state.gid || '' });
    return `${_site()}/student-app/?${q.toString()}`;
  }

  function _lesson(quiz) {
    return [quiz.subject, quiz.chapter || quiz.title].filter(Boolean).join(' — ');
  }

  function shareFriend(ctx) {
    const { quiz, pct, score, max, improved, rank } = ctx;
    const link = _friendLink(quiz, pct);
    const text = improved
      ? `🚀 मी पुन्हा प्रयत्न केला: *${_lesson(quiz)}* मध्ये ${improved.from}% → *${improved.to}%*!\nतू किती मिळवतोस? 👉 ${link}`
      : `🎉 मी *${_lesson(quiz)}* च्या test मध्ये *${score}/${max} (${pct}%)* मिळवले!\n` +
        (rank?.rank ? `🏆 ${rank.total} students मध्ये माझा क्रमांक *#${rank.rank}*\n` : '') +
        `तू मला मागे टाकू शकतोस का? 😎\n👉 हाच test द्या (Free, login नाही): ${link}`;
    _wa(text);
    API.guestEvent('shared_friend');
  }

  // "🎁 आज 50% सूट — रात्री 9:30 पर्यंत" while the visitor's offer runs
  let _lastInfo = null;
  function _offerLine(info) {
    const o = info?.offer;
    if (!o?.active || !o.expires_at || new Date(o.expires_at) <= new Date()) return '';
    const t = new Date(o.expires_at), today = t.toDateString() === new Date().toDateString();
    const hm = t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `
🎁 पहिल्या payment वर ${o.percent || 50}% सूट — ${today ? 'आज ' : 'उद्या '}${hm} पर्यंतच!
`;
  }
  // the app line in the WhatsApp messages to parents (the same line as Admin's messages)
  const _APP_LINE = '📲 App मध्ये उपलब्ध असलेले free tests सोडवा (login नाही): https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  function shareParent(ctx) {
    const { quiz, pct, score, max, rank, weak } = ctx;
    const text = `नमस्कार आई/बाबा 🙏\nमी NKs EduOrbit वर *${_lesson(quiz)}* चा test दिला.\n` +
      `📊 गुण: *${score}/${max} (${pct}%)*\n` +
      (rank?.rank ? `🏆 ${rank.total} students मध्ये क्रमांक: *#${rank.rank}*\n` : '') +
      (weak?.length ? `📌 अजून सराव हवा: प्रश्न ${weak.join(', ')}\n` : '') +
      _offerLine(_lastInfo) + `माझे सगळे chapters चे tests, notes आणि weekly report इथे 👇\n${_payUrl()}\n${_APP_LINE}`;
    _wa(text);
    API.guestEvent('shared_parent');
  }

  function shareAskParents(info) {
    const scores = Object.values(_state.scores || {});
    const avg = scores.length ? Math.round(scores.reduce((s, x) => s + (x.best || 0), 0) / scores.length) : 0;
    const yearly = info?.prices?.yearly || 0, monthly = info?.prices?.monthly || 0;
    const perDay = yearly ? Math.max(1, Math.round(yearly / 365)) : monthly ? Math.max(1, Math.round(monthly / 30)) : 0;
    const text = `आई/बाबा, मला NKs EduOrbit वर *${_state.batch || ''}* चे सगळे tests सोडवायचे आहेत 📚\n` +
      (scores.length ? `आत्तापर्यंत मी ${scores.length} tests दिले, सरासरी ${avg}%.\n` : '') +
      (perDay ? `दिवसाला फक्त ₹${perDay}. ` : '') + _offerLine(info) + `इथे बघा 👇\n${_payUrl()}\n${_APP_LINE}`;
    _wa(text);
    API.guestEvent('shared_parent');
  }

  // Result card as a picture (1080×1350) for WhatsApp Status — free publicity.
  function _resultCanvas(ctx) {
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#ff7a18'); bg.addColorStop(.5, '#ff3d77'); bg.addColorStop(1, '#7b2ff7');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // confetti
    const cols = ['#ffc83d', '#ffffff', '#22c55e', '#38bdf8', '#1b1340'];
    for (let i = 0; i < 70; i++) {
      g.save(); g.globalAlpha = .55; g.fillStyle = cols[i % cols.length];
      g.translate((i * 157) % W, (i * 263) % H); g.rotate(i);
      g.fillRect(-9, -4, 18, 8); g.restore();
    }
    const font = (w, px) => `${w} ${px}px "Baloo 2", "Noto Sans Devanagari", sans-serif`;
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.font = font(800, 64); g.fillText('🚀 NKs EduOrbit', W / 2, 130);
    // card
    g.fillStyle = '#ffffff';
    const x = 90, y = 200, w = W - 180, h = 900, r = 60;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill();
    g.fillStyle = '#6b6690'; g.font = font(700, 46);
    g.fillText((_state.name || 'मी') + ' चा Result', W / 2, 300);
    g.fillStyle = '#1b1340'; g.font = font(700, 44);
    g.fillText(_lesson(ctx.quiz).slice(0, 34), W / 2, 370);
    // ring
    const cx = W / 2, cy = 640, R = 190;
    g.lineWidth = 46; g.strokeStyle = '#efeaff'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    const rg = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rg.addColorStop(0, '#ff7a18'); rg.addColorStop(.5, '#ff3d77'); rg.addColorStop(1, '#7b2ff7');
    g.strokeStyle = rg; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.01, ctx.pct / 100)); g.stroke();
    g.fillStyle = '#1b1340'; g.font = font(800, 150); g.fillText(`${ctx.pct}%`, cx, cy + 50);
    g.fillStyle = '#6b6690'; g.font = font(700, 48); g.fillText(`${ctx.score} / ${ctx.max} गुण`, cx, cy + 120);
    g.fillStyle = '#7a4b00'; g.font = font(800, 50);
    g.fillText(ctx.rank?.rank && ctx.rank.total > 1 ? `🏆 ${ctx.rank.total} students मध्ये #${ctx.rank.rank}` : ctx.pct >= 75 ? '🔥 खूप छान!' : '💪 सराव चालू!', W / 2, 960);
    g.fillStyle = '#ff3d77'; g.font = font(800, 54);
    g.fillText('तू मला मागे टाकू शकतोस? 😎', W / 2, 1050);
    g.fillStyle = '#fff'; g.font = font(800, 52);
    g.fillText('Free test द्या — login नाही', W / 2, 1200);
    g.font = font(700, 40); g.fillText('nkseduorbit.in', W / 2, 1270);
    return cv;
  }

  async function shareResultImage(ctx) {
    await document.fonts?.ready;
    const cv = _resultCanvas(ctx);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    if (!blob) throw new Error('no image');
    const text = `🎉 ${_lesson(ctx.quiz)} मध्ये ${ctx.pct}%! तू पण करून बघ 👉 ${_friendLink(ctx.quiz, ctx.pct)}`;
    API.guestEvent('shared_friend');
    if (!_isNative()) {
      const file = new File([blob], 'nks-result.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
      }
    }
    await window.FILE_EXPORT?.saveAndShare(blob, 'nks-result.png');
    if (!_isNative()) _toast('📸 Photo save झाला — WhatsApp Status ला टाका', 'success');
  }

  // ── Phone Number Hint (app only): the SIM's number in one tap ───────
  function _phonePlugin() {
    if (!_isNative()) return null;
    return window.Capacitor?.Plugins?.PhoneHint || window.Capacitor?.registerPlugin?.('PhoneHint') || null;
  }
  async function phoneHint() {
    const plugin = _phonePlugin();
    if (!plugin?.pick) return '';
    try { return String((await plugin.pick())?.phone || ''); } catch { return ''; }
  }
  // Offer it once when an empty mobile box gets focus (guest contact, registration).
  async function _tryHint(input) {
    if (!input || input.value.trim() || input.dataset.gxHinted || !_phonePlugin()) return;
    input.dataset.gxHinted = '1';
    const phone = await phoneHint();
    if (phone && !input.value.trim()) { input.value = phone; input.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  function _hintOnFocus(input) { input?.addEventListener('focus', () => _tryHint(input)); }
  document.addEventListener('focusin', e => { if (e.target?.id === 'reg-mobile') _tryHint(e.target); }, true);

  // ── Parent mobile (unlocks the detailed analysis) ──────────────────
  // forResult: asked right after "Result बघा" (owner's choice, 2026-11-01) —
  // no close / later; the student was told before the test (ensureName).
  async function contactGate({ forResult = false, forLocked = false } = {}) {
    const bot = await _bot();
    return new Promise(resolve => {
      const canPick = 'contacts' in navigator && 'select' in (navigator.contacts || {});
      const el = _layer(forResult ? 'gx-hero' : 'gx-dim', `
        <div class="gx-card">
          ${forResult ? '' : '<button type="button" class="gx-close" aria-label="बंद करा">✕</button>'}
          <div class="gx-logo" aria-hidden="true">${forResult ? '🎯' : forLocked ? '🔓' : '📊'}</div>
          ${forResult
            ? '<h2 class="gx-title">तुमचा <span class="gx-grad-text">Result</span> तयार आहे!</h2><p class="gx-sub">पालकांचा WhatsApp नंबर द्या — result लगेच दिसेल आणि पालकांनाही तुमची प्रगती कळेल</p>'
            : forLocked ? '<h2 class="gx-title">पुढचे <span class="gx-grad-text">धडे</span> उघडायचे?</h2><p class="gx-sub">पालकांचा WhatsApp नंबर द्या — मग सगळे धडे उघडण्याचे पर्याय आणि किंमत दिसेल</p>'
            : '<h2 class="gx-title">पूर्ण <span class="gx-grad-text">analysis</span></h2><p class="gx-sub">पालकांचा WhatsApp नंबर द्या — प्रत्येक प्रश्नाचं analysis लगेच उघडेल</p>'}
          ${bot ? `<button type="button" class="gx-btn gx-big gx-wa" id="gx-wa-bot">📩 ${forLocked ? 'सूट आणि पर्याय' : forResult ? 'पूर्ण result, युक्त्या आणि क्रमांक' : 'पूर्ण analysis'} WhatsApp वर</button>
          <p class="gx-sub gx-or">WhatsApp नाही? पालकांचा नंबर टाइप करा:</p>` : ''}
          <label class="gx-field"><span>पालकांचा mobile</span>
            <input class="gx-input" id="gx-mob" type="tel" inputmode="tel" autocomplete="tel" placeholder="98XXXXXXXX" maxlength="16" /></label>
          ${canPick ? '<button type="button" class="gx-btn gx-ghost" id="gx-pick">📇 Contacts मधून निवडा</button>' : ''}
          <label class="gx-check"><input type="checkbox" id="gx-ok" /> <span>NKs EduOrbit कडून result व अभ्यासाबद्दल संपर्कास पालकांची संमती आहे</span></label>
          <p class="gx-msg" id="gx-msg" role="alert"></p>
          <button type="button" class="gx-btn gx-big gx-shine" id="gx-save">${forResult ? '🎯 Result बघा' : forLocked ? '▶ पुढे चला' : '📊 Analysis बघा'}</button>
          ${bot && !_isNative() ? `<a class="gx-btn gx-ghost" id="gx-play" href="https://play.google.com/store/apps/details?id=com.nkseduorbit.student" target="_blank" rel="noopener">📲 App मध्ये उपलब्ध असलेले free tests सोडवा</a>` : ''}
          ${forResult ? '' : '<button type="button" class="gx-link" id="gx-later">नंतर</button>'}
        </div>`);
      const mob = el.querySelector('#gx-mob'), msg = el.querySelector('#gx-msg');
      if (_state.mob_try) mob.value = _state.mob_try;   // typed inside the test but not saved then (no internet)
      // WhatsApp: the parent's own message gives the number (and the consent); the result opens at once
      el.querySelector('#gx-wa-bot')?.addEventListener('click', () => { _waBot(forLocked ? 'OFFER' : 'RESULT'); _close(el); resolve(true); });
      _hintOnFocus(mob);
      const done = v => { _close(el); resolve(v); };
      el.querySelector('.gx-close')?.addEventListener('click', () => done(false));
      el.querySelector('#gx-later')?.addEventListener('click', () => done(false));
      el.querySelector('#gx-pick')?.addEventListener('click', async () => {
        try {
          const [c] = await navigator.contacts.select(['tel'], { multiple: false });
          const tel = c?.tel?.[0];
          if (tel) mob.value = tel;
        } catch { /* cancelled */ }
      });
      el.querySelector('#gx-save').onclick = async () => {
        if (!el.querySelector('#gx-ok').checked) { msg.textContent = 'पालकांच्या संमतीवर ✓ करा'; return; }
        msg.style.color = ''; msg.textContent = '⏳ …';
        try {
          await _saveContact(mob.value);
          _state.has_parent_mobile = true;
          done(true);
        } catch (err) {
          // No internet / server asleep: never trap the result behind it.
          if (!navigator.onLine || /fetch|network|timeout|failed/i.test(String(err?.message || ''))) { done(true); return; }
          msg.textContent = err?.message || 'योग्य 10 अंकी नंबर द्या';
          mob.classList.remove('gx-bad'); void mob.offsetWidth; mob.classList.add('gx-bad');
        }
      };
    });
  }

  // ── Guide: next free step ──────────────────────────────────────────
  async function _freeTests() {
    const quizzes = await DB.getQuizzesByStatus('published').catch(() => []);
    const batch = _state.batch;
    const list = [];
    for (const q of quizzes) {
      if (batch && q.batch !== batch) continue;
      if (q.locked || (await window.APP?.isQuizLocked?.(q))) continue;
      list.push(q);
    }
    list.sort((a, b) => String(a.subject).localeCompare(String(b.subject)) || String(a.chapter).localeCompare(String(b.chapter)) || String(a.title).localeCompare(String(b.title)));
    return list;
  }

  // ── Regular class: free chapters ("धडे") instead of free tests ──
  let _kindP = null, _kindFor = '';
  function _kind() {
    if (!_kindP || _kindFor !== _state.batch) {
      _kindFor = _state.batch || '';
      _kindP = API.fetchGuestBatches().then(list => {
        const b = (list || []).find(x => x.name === _kindFor) || { name: _kindFor };
        return b.kind || window.COURSE_CARD?.kindOf?.(b) || 'exam';
      }).catch(() => window.COURSE_CARD?.kindOf?.({ name: _kindFor }) || 'exam');
    }
    return _kindP;
  }
  const _lessonKey = (s, c) => `${String(s || '').trim()}|${String(c || '').trim()}`;
  // the class's free chapters, in the class's order
  async function _freeLessons() {
    const list = await API.fetchStudentFreeChapters().catch(() => []);
    const mine = (list || []).filter(f => String(f.batch).trim().toLowerCase() === String(_state.batch || '').trim().toLowerCase());
    if (mine.length) await DB.setSetting('guest_free_lessons', mine).catch(() => {});
    return mine.length ? mine : (await DB.getSetting('guest_free_lessons', []).catch(() => []) || []);
  }
  // the hub screen asks before a chapter opens: a chapter seen before is always fine; one new chapter a day on the website
  async function mayOpenLesson(batch, subject, chapter) {
    if (!_active || _isNative() || (await _kind()) !== 'regular') return true;
    const k = 'L:' + _lessonKey(subject, chapter);
    if ((_state.lessons || {})[_lessonKey(subject, chapter)]) return true;
    if (_todayUsed(k)) { nextTestSheet(); return false; }
    const lessons = { ...(_state.lessons || {}), [_lessonKey(subject, chapter)]: Date.now() };
    const first = !Object.keys(_state.lessons || {}).length;
    await _saveState({ web_day: _istDay(), web_quiz: k, lessons });
    API.guestEvent('lesson');
    if (first) API.claimGuestOffer().catch(() => {});   // the same first-payment offer as after a free test
    return true;
  }
  // the next free lesson: opens the chapter and its Notes
  async function _goNextLesson() {
    let lessons = await _freeLessons();
    if (!lessons.length) {
      const prep = _prepScreen('धडा');
      for (let i = 0; i < 15 && !lessons.length; i++) { await new Promise(r => setTimeout(r, 2000)); lessons = await _freeLessons(); }
      prep.done();
      if (!lessons.length) { _toast('या class चे free धडे अजून ठेवलेले नाहीत', 'info'); return; }
    }
    const seen = _state.lessons || {};
    const next = lessons.find(l => !seen[_lessonKey(l.subject, l.chapter)]) || lessons[0];
    if (!seen[_lessonKey(next.subject, next.chapter)] && _todayUsed('L:' + _lessonKey(next.subject, next.chapter))) { nextTestSheet(); return; }
    await (window.APP || (typeof APP !== 'undefined' ? APP : null))?.openChapter?.(next.batch, next.subject, next.chapter, { notes: true });
    // the Notes are open: the chapter screen's next glowing step is the Exercise
    const hub = { ...(_state.hub || {}) };
    hub[next.chapter] = { ...(hub[next.chapter] || {}), Notes: true };
    _state = { ..._state, hub }; _saveState({ hub });
  }

  // ── a push from the WhatsApp bot (app): its text and its buttons — "💬 WhatsApp वर …" opens the bot's chat ──
  async function botPushSheet(data = {}) {
    let buttons = [];
    try { buttons = JSON.parse(data.buttons || '[]'); } catch { buttons = []; }
    const wa = buttons.filter(b => /^push:[A-Z]+$/.test(String(b.id || '')));
    if (!wa.length || document.querySelector('.gx-layer.gx-botpush')) return;
    const bot = await _bot();
    if (!bot) return;
    const el = _layer('gx-dim gx-botpush', `
      <div class="gx-card">
        <button type="button" class="gx-close" aria-label="बंद करा">✕</button>
        <div class="gx-logo" aria-hidden="true">🔔</div>
        <p class="gx-sub" style="font-weight:700">${_esc(data.body || data.text || '')}</p>
        ${wa.map((b, i) => `<button type="button" class="gx-btn ${i ? 'gx-ghost' : 'gx-big gx-wa'}" data-k="${_esc(b.id.slice(5))}">${_esc(b.label || '💬 WhatsApp')}</button>`).join('')}
      </div>`);
    el.querySelector('.gx-close').onclick = () => _close(el);
    el.querySelectorAll('[data-k]').forEach(b => { b.onclick = () => { _waBot(b.dataset.k); _close(el); }; });
  }

  // ── one new free test a day on the website (the app has them all) ──
  const PLAY = 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  let _auto = false;
  // the test starts by itself only once the app has finished starting (its first-visit "offline" sync screen and
  // the home load after it): a test started earlier was covered by that screen and then closed by the home load
  // (live 8–10 Nov: parents tapped "child is here", saw the test flash, and landed on Home)
  const _bootDone = () => !!window.__tbBooted;
  const _istDay = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  // true = today's new test on the website is already taken, and this would be another new one
  function _todayUsed(quizId) {
    if (!_active || _isNative()) return false;
    return _state.web_day === _istDay() && !!_state.web_quiz && _state.web_quiz !== quizId;
  }
  // testPlayer asks before a test starts: a test taken before (a retry) is always fine
  async function mayStartTest(quiz) {
    if (!_active || _isNative() || !quiz) return true;
    if ((_state.scores || {})[quiz.quiz_id]) return true;
    if (_todayUsed(quiz.quiz_id)) { nextTestSheet(); return false; }
    if (_state.web_day !== _istDay() || _state.web_quiz !== quiz.quiz_id) await _saveState({ web_day: _istDay(), web_quiz: quiz.quiz_id });
    return true;
  }
  // "today's free test is done": the next one by WhatsApp (one a day) or all of them in the app
  async function nextTestSheet() {
    if (document.querySelector('.gx-layer.gx-nextday')) return;
    const bot = await _bot();
    const L = (await _kind()) === 'regular';
    const el = _layer('gx-dim gx-nextday', `
      <div class="gx-card">
        <button type="button" class="gx-close" id="gx-x" aria-label="बंद करा">✕</button>
        <h2 class="gx-title">✅ आजचा free ${L ? 'धडा' : 'test'} <span class="gx-grad-text">झाला!</span></h2>
        <p class="gx-sub">पुढचा ${L ? 'धडा' : 'test'} उद्या.${bot ? ` WhatsApp वर <b>TEST</b> पाठवा — रोज 1 ${L ? 'धडा' : 'test'} तिथे येईल.` : ''}</p>
        ${bot ? `<button type="button" class="gx-btn gx-big gx-wa" id="gx-n-wa">📩 WhatsApp वर रोज 1 free ${L ? 'धडा' : 'test'} — TEST पाठवा</button>` : ''}
        ${_isNative() ? '' : `<a class="gx-btn gx-ghost" id="gx-n-app" href="${PLAY}" target="_blank" rel="noopener">📲 App मध्ये उपलब्ध असलेले सगळे free ${L ? 'धडे' : 'tests'}</a>`}
        <button type="button" class="gx-link" id="gx-n-all">🔓 सगळे tests आत्ताच उघडा</button>
      </div>`);
    API.guestEvent('offer_seen');
    el.querySelector('#gx-x').onclick = () => _close(el);
    el.querySelector('#gx-n-wa')?.addEventListener('click', () => { _waBot('TEST'); _close(el); });
    el.querySelector('#gx-n-all').onclick = () => { _close(el); showOffer('locked'); };
  }

  // ⏳ "your test is getting ready" while the class's tests come down (a waking server can take half a minute)
  function _prepScreen(what = 'test') {
    const lines = what === 'धडा' ? ['Notes उघडत आहे…', 'स्वाध्याय उत्तरं तयार…', 'जवळजवळ झालं…'] : ['प्रश्न निवडत आहे…', 'उत्तरं तपासायची तयारी…', 'जवळजवळ झालं…'];
    const el = _layer('gx-hero gx-prep', `
      <div class="gx-card gx-glass">
        <div class="gx-prep-icon" aria-hidden="true">📝</div>
        <h2 class="gx-title">तुमचा ${what === 'धडा' ? 'free धडा' : 'test'} <span class="gx-grad-text">तयार होत आहे</span></h2>
        <p class="gx-sub">लगेच मिळेल 🙂</p>
        <div class="gx-prep-bar" aria-hidden="true"><i></i></div>
        <p class="gx-sub gx-prep-line" id="gx-prep-line">${lines[0]}</p>
        <p class="gx-msg" id="gx-msg" role="alert"></p>
      </div>`);
    let i = 0;
    const timer = setInterval(() => { const l = el.querySelector('#gx-prep-line'); if (l) l.textContent = lines[++i % lines.length]; }, 2200);
    return { el, done: () => { clearInterval(timer); _close(el); } };
  }
  async function goNext() {
    if ((await _kind()) === 'regular') return _goNextLesson();
    let tests = await _freeTests();
    if (!tests.length) {
      const prep = _prepScreen();
      for (let i = 0; !tests.length && i < 20; i++) { await new Promise(r => setTimeout(r, 2000)); tests = await _freeTests(); }
      prep.done();
      if (!tests.length) { _toast('Internet हळू आहे — थोड्या वेळाने "▶ सुरू करा" दाबा', 'error'); window.APP?.showScreen?.('home'); window.APP?.loadHome?.(); return; }
    }
    const done = _state.scores || {};
    const next = tests.find(q => !done[q.quiz_id]);
    if (next && _todayUsed(next.quiz_id)) { nextTestSheet(); return; }
    if (next) { window.TEST_PLAYER?.startTest(next.quiz_id, 'practice'); return; }
    window.APP?.showScreen?.('home');
    window.APP?.loadHome?.();
    showOffer('done');
  }

  // Real exam date from the admin → "📅 सहामाही: 23 दिवस बाकी" (nothing if none).
  async function _examLine() {
    try {
      const e = await API.fetchNextExam(_state.batch || '');
      if (!e) return '';
      const days = Math.max(0, Math.ceil((new Date(e.date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5));
      return `📅 ${_esc(e.title)}: ${days ? `<b>${days} दिवस</b> बाकी` : '<b>आज!</b>'}`;
    } catch { return ''; }
  }

  // the class's tests come down in the background after the start: until they are on the phone the
  // guide says "loading" (not "all done") and looks again every few seconds
  let _guideWait = null;
  async function renderHomeGuide() {
    const home = $('screen-home');
    if (!home) return;
    if (!_active) { home.querySelector('.gx-guide')?.remove(); return; }
    if ((await _kind()) === 'regular') return _renderLessonGuide(home);
    const tests = await _freeTests();
    home.querySelector('.gx-guide')?.remove();
    clearTimeout(_guideWait);
    // a visitor who is already in (same phone) and opens a free link again — e.g. the bot's daily link: start too
    if (!renderHomeGuide._seenLink) {
      renderHomeGuide._seenLink = true;
      const p = entryParams();
      if (p.free && !p.quiz && !p.regular) _auto = true;
    }
    if (!tests.length && _auto && _bootDone()) { _auto = false; goNext().catch(() => {}); }
    if (!tests.length) {
      const strip = document.createElement('div');
      strip.className = 'gx-guide';
      strip.innerHTML = `
        <div class="gx-guide-hi">${_state.name ? `👋 ${_esc(_state.name)}, तुमचा Free अभ्यास` : '👋 नमस्कार! तुमचा Free अभ्यास'}</div>
        <div class="gx-guide-next">⏳ Free tests येत आहेत…</div>`;
      home.insertBefore(strip, home.firstElementChild);
      const tries = (renderHomeGuide._tries = (renderHomeGuide._tries || 0) + 1);
      if (tries <= 40) _guideWait = setTimeout(() => { if (strip.isConnected) renderHomeGuide().catch(() => {}); }, 3000);
      return;
    }
    renderHomeGuide._tries = 0;
    const done = _state.scores || {};
    const doneN = tests.filter(q => done[q.quiz_id]).length;
    const next = tests.find(q => !done[q.quiz_id]);
    const used = !!next && _todayUsed(next.quiz_id);
    const bot = used ? await _bot() : '';
    home.querySelector('.gx-guide')?.remove();
    const strip = document.createElement('div');
    strip.className = 'gx-guide';
    strip.innerHTML = `
      <div class="gx-guide-hi">${_state.name ? `👋 ${_esc(_state.name)}, तुमचा Free अभ्यास` : '👋 नमस्कार! तुमचा Free अभ्यास'}</div>
      <div class="gx-guide-next">${used ? '✅ आजची free test झाली! पुढची उद्या — WhatsApp वर रोज 1, किंवा App मध्ये सगळ्या.' : next ? `पुढचा test: <b>${_esc(_lesson(next))}</b>` : '🎉 सगळे free tests पूर्ण! आता पुढचे chapters उघडा.'}</div>
      ${tests.length ? `<div class="gx-guide-progress" aria-label="${doneN}/${tests.length}"><i style="width:${Math.round((doneN / tests.length) * 100)}%"></i></div>` : ''}
      <div class="gx-row">
        ${used && bot ? '<button type="button" class="gx-btn gx-wa" id="gx-g-wa">📩 WhatsApp वर रोज 1 test</button>' : ''}
        ${used ? `<a class="gx-btn gx-go" id="gx-g-app" href="${PLAY}" target="_blank" rel="noopener">📲 App मध्ये सगळ्या</a>` : ''}
        ${next && !used ? '<button type="button" class="gx-btn gx-go" id="gx-next">▶ सुरू करा</button>' : ''}
        <button type="button" class="gx-btn gx-unlock" id="gx-all">🔓 सगळे उघडा</button>
      </div>
      ${!used && !_isNative() && Object.keys(done).length >= 2 ? '<button type="button" class="gx-link" id="gx-app" style="color:#fff">📱 App मध्ये पुढे चला — tests offline पण चालतात</button>' : ''}`;
    home.insertBefore(strip, home.firstElementChild);
    strip.querySelector('#gx-g-wa')?.addEventListener('click', () => _waBot('TEST'));
    // they just came in (welcome / parent page / the bot's link): the test starts by itself
    if (_auto && _bootDone()) { _auto = false; if (next) goNext().catch(() => {}); }
    _examLine().then(line => {
      if (!line || !strip.isConnected) return;
      const el = document.createElement('div');
      el.className = 'gx-guide-exam';
      el.innerHTML = line;
      strip.querySelector('.gx-guide-next')?.after(el);
    });
    strip.querySelector('#gx-next')?.addEventListener('click', () => { API.guestEvent('engaged'); goNext(); });
    strip.querySelector('#gx-all').addEventListener('click', () => showOffer('locked'));
    strip.querySelector('#gx-app')?.addEventListener('click', () => {
      const q = new URLSearchParams({ guest: _state.gid || '' });
      if ((_state.src === 'teacher' || _state.src === 'shop') && _state.ref) q.set('teacher', _state.ref);
      window.open(`${_site()}/get-app.html?${q.toString()}`, '_blank', 'noopener');
    });
    API.guestEvent('browsed');

    const n = Object.keys(done).length;
    if (!next && n) setTimeout(() => showOffer('done'), 900);
    else if (n >= 3 && n >= (_state.offer_snooze_tests || 0)) setTimeout(() => showOffer('third'), 900);
  }

  // Home guide for a Regular class: the next free lesson, or (today's taken) WhatsApp / App
  async function _renderLessonGuide(home) {
    if (!renderHomeGuide._seenLink) { renderHomeGuide._seenLink = true; const p = entryParams(); if (p.free && !p.quiz) _auto = true; }
    const lessons = await _freeLessons();
    home.querySelector('.gx-guide')?.remove();
    const seen = _state.lessons || {};
    const doneN = lessons.filter(l => seen[_lessonKey(l.subject, l.chapter)]).length;
    const next = lessons.find(l => !seen[_lessonKey(l.subject, l.chapter)]);
    const used = !!next && _todayUsed('L:' + _lessonKey(next.subject, next.chapter));
    const bot = used ? await _bot() : '';
    const strip = document.createElement('div');
    strip.className = 'gx-guide';
    strip.innerHTML = `
      <div class="gx-guide-hi">${_state.name ? `👋 ${_esc(_state.name)}, तुमचा Free अभ्यास` : '👋 नमस्कार! तुमचा Free अभ्यास'}</div>
      <div class="gx-guide-next">${!lessons.length ? '⏳ Free धडे येत आहेत…' : used ? '✅ आजचा free धडा झाला! पुढचा उद्या — WhatsApp वर रोज 1, किंवा App मध्ये सगळे.'
        : next ? `पुढचा धडा: <b>${_esc(next.subject)} — ${_esc(next.chapter)}</b><br><small>📒 Notes · ✍️ स्वाध्याय उत्तरं · 📝 सराव</small>` : '🎉 सगळे free धडे पाहिले! आता पुढचे धडे उघडा.'}</div>
      ${lessons.length ? `<div class="gx-guide-progress" aria-label="${doneN}/${lessons.length}"><i style="width:${Math.round((doneN / lessons.length) * 100)}%"></i></div>` : ''}
      <div class="gx-row">
        ${used && bot ? '<button type="button" class="gx-btn gx-wa" id="gx-g-wa">📩 WhatsApp वर रोज 1 धडा</button>' : ''}
        ${used ? `<a class="gx-btn gx-go" id="gx-g-app" href="${PLAY}" target="_blank" rel="noopener">📲 App मध्ये सगळे</a>` : ''}
        ${next && !used ? '<button type="button" class="gx-btn gx-go" id="gx-next">▶ धडा उघडा</button>' : ''}
        <button type="button" class="gx-btn gx-unlock" id="gx-all">🔓 सगळे उघडा</button>
      </div>`;
    home.insertBefore(strip, home.firstElementChild);
    strip.querySelector('#gx-g-wa')?.addEventListener('click', () => _waBot('TEST'));
    strip.querySelector('#gx-next')?.addEventListener('click', () => { API.guestEvent('engaged'); goNext(); });
    strip.querySelector('#gx-all').addEventListener('click', () => showOffer('locked'));
    API.guestEvent('browsed');
    clearTimeout(_guideWait);
    if (!lessons.length) { _guideWait = setTimeout(() => { if (strip.isConnected) renderHomeGuide().catch(() => {}); }, 3000); return; }
    if (_auto && _bootDone()) { _auto = false; if (next && !used) setTimeout(() => goNext().catch(() => {}), 1500); return; }
    // today's lesson seen (notes + exercise opened): once a day, the "next lesson on WhatsApp / App" sheet
    const today = Object.entries(seen).find(([k]) => _state.web_quiz === 'L:' + k);
    const hub = today ? ((_state.hub || {})[today[0].split('|')[1]] || {}) : {};
    if (today && hub.Notes && hub.Exercise && _state.lesson_sheet_day !== _istDay()) {
      await _saveState({ lesson_sheet_day: _istDay() });
      setTimeout(() => nextTestSheet(), 700);
    }
  }

  // Chapter screen: the next step pulses — Notes, then Exercise, then Test.
  function decorateHub(grid, chapter) {
    if (!_active || !grid) return;
    const key = String(chapter || '');
    const seen = (_state.hub || {})[key] || {};
    const order = ['Notes', 'Exercise', 'Test'];
    const next = order.find(l => !seen[l]) || 'Test';
    if (next === 'Test' && _kindFor === _state.batch && _kindP) _kindP.then(k => { if (k === 'regular') grid.querySelectorAll('.chapter-hub-btn.gx-glow').forEach(b => b.classList.remove('gx-glow')); });
    grid.querySelectorAll('.chapter-hub-btn').forEach(btn => {
      const label = btn.getAttribute('aria-label');
      btn.classList.toggle('gx-glow', label === next);
      btn.addEventListener('click', () => {
        const hub = { ...(_state.hub || {}) };
        hub[key] = { ...(hub[key] || {}), [label]: true };
        _state = { ..._state, hub };   // the next render must see it at once
        _saveState({ hub });
        API.guestEvent('engaged');
      });
    });
  }

  // A feature that needs a real account (Words, Study Plan, …).
  let _signupAt = 0;
  function onSignupRequired() {
    if (!_active || Date.now() - _signupAt < 60_000) return;
    _signupAt = Date.now();
    _toast('🔒 हे वापरण्यासाठी account लागेल', 'info');
    showOffer('locked');
  }

  return {
    refresh, isActive, wantsEntry, entryParams, start, resume, ensureName, needsContact, midTestGate, onResult,
    showOffer, openPay, goNext, renderHomeGuide, mayStartTest, nextTestSheet, mayOpenLesson, botPushSheet, botNumber: _bot, waBot: _waBot, onSignupRequired, contactGate, fireworks,
    __resultCanvas: _resultCanvas,
    decorateHub, phoneHint,
  };
})();

window.GUEST = GUEST;
