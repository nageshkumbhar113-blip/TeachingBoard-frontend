/* ════════════════════════════════════════
   helpBot.js — "❓ मदत" on the login pages (student app / website, shop panel)
   Global: HELP_BOT (and HELP_DEFAULTS for Admin > 🤖 Help)

   No AI and no paid service: ready answers with buttons. The admin can change
   the answers (Admin > 🤖 Help); the phone keeps the last copy for offline.
   "Code / PIN विसरलो": name + parent's mobile + THIS phone (the account must be
   bound to it) are checked on the server; then the code is shown and a new PIN
   can be set here. Otherwise (new phone, teacher, shop) a request goes to the admin.
════════════════════════════════════════ */

const HELP_DEFAULTS = [
  { id: 'login', icon: '🔑', title: 'Login / Code / PIN', items: [
    { id: 'forgot', q: 'Student Code / PIN विसरलो', a: 'नाव, पालकांचा नंबर आणि हा phone तपासून तुमचा code दाखवतो आणि नवीन PIN ठेवता येतो.', action: 'forgot' },
    { id: 'bound', q: '"दुसऱ्या phone ला जोडलेलं आहे" असं येतं', a: 'एक account एका phone वर चालतं. नवीन phone घेतला असेल तर खालचं "Admin ला request पाठवा" दाबा — admin जुना phone काढून नवीन PIN पाठवतील.', action: 'request' },
    { id: 'wrong', q: 'Login ला "चुकीचा code / PIN" येतं', a: 'Code मोठ्या इंग्रजी अक्षरात आहे का पाहा (उदा. RAH123). PIN 4 अंकी आहे. आठवत नसेल तर "Student Code / PIN विसरलो" वापरा.' },
    { id: 'parent', q: 'Parent म्हणून login कसं करायचं?', a: 'Login मध्ये "👨‍👩‍👧 Parent" निवडा आणि मुलाचाच Student Code आणि PIN टाका.', action: 'parent' },
    { id: 'teacher', q: 'Teacher / दुकानाचा PIN विसरलो', a: 'नाव आणि mobile नंबर पाठवा — admin नवीन PIN WhatsApp वर पाठवतील.', action: 'request_teacher' },
  ] },
  { id: 'register', icon: '🆕', title: 'Registration', items: [
    { id: 'how', q: 'Register कसं करायचं?', a: 'Login screen वर "🆕 Register" → नाव, पालकांचा नंबर, शाळा, class → 4 अंकी PIN ठेवा → Student Code मिळेल. तो code लिहून ठेवा.', action: 'register' },
    { id: 'exists', q: '"हा student आधीच registered आहे" येतं', a: 'याच नंबरवर हे नाव आधी registered आहे. "Student Code / PIN विसरलो" वापरून तुमचा code मिळवा.', action: 'forgot' },
    { id: 'code', q: 'Teacher / दुकानाचा code कुठे टाकायचा?', a: 'Register करताना "Teacher किंवा मित्राचा code" मध्ये टाका. नंतर बदलता येत नाही.' },
    { id: 'class', q: 'माझा class चुकला / बदलायचा आहे', a: 'Admin class बदलून देतील.', action: 'admin' },
  ] },
  { id: 'pay', icon: '💳', title: 'Payment / Subscription', items: [
    { id: 'price', q: 'किती पैसे आहेत? कोणते plans?', a: 'प्रत्येक class ची किंमत app मध्ये 🔒 chapter वर tap केल्यावर दिसते. Monthly आणि Yearly plans आहेत — Yearly स्वस्त पडतो.' },
    { id: 'free', q: 'काय free आहे?', a: 'प्रत्येक विषयाचा पहिला chapter free — notes, exercise आणि tests. दर आठवड्याचा महा-Test पण free. Login न करता "🎁 Free tests try करा" पण आहे.' },
    { id: 'howpay', q: 'Payment कसं करायचं?', a: '🔒 chapter → Plan निवडा → सुरक्षित payment page (Razorpay): UPI / Card / Net banking.' },
    { id: 'cut', q: 'पैसे कापले पण chapters उघडले नाहीत', a: 'बहुतेक वेळा काही मिनिटांत आपोआप उघडतं. Login करून Home खाली ओढा (refresh). 15 मिनिटांनी पण नाही उघडलं तर Admin ला कळवा — payment ची वेळ आणि रक्कम लिहा.', action: 'admin' },
    { id: 'expiry', q: 'Plan केव्हा संपतो?', a: 'Login केल्यावर Me → Profile मध्ये शेवटची तारीख दिसते. संपण्याआधी app आठवण करून देतं.' },
    { id: 'refund', q: 'Refund मिळेल का?', a: 'Refund चे नियम Refund Policy पानावर आहेत.', action: 'refund' },
    { id: 'offer', q: '50% offer कोणाला मिळतो?', a: 'Free test पूर्ण केल्यावर पहिल्या payment वर 12 तासांसाठी. नंतरचे payments पूर्ण किमतीत.' },
  ] },
  { id: 'app', icon: '📱', title: 'App वापर', items: [
    { id: 'offline', q: 'Internet नसताना चालतं का?', a: 'हो — एकदा उघडलेले notes आणि tests offline पण चालतात.' },
    { id: 'missing', q: 'Notes / tests दिसत नाहीत', a: 'Internet चालू करून Home खाली ओढा (refresh). App update आहे का ते Play Store वर पाहा.', action: 'play' },
    { id: 'update', q: 'App update कसा करायचा?', a: 'Play Store वर "Nks EduOrbit" उघडून Update दाबा.', action: 'play' },
    { id: 'notif', q: 'Notification येत नाहीत', a: 'Phone च्या Settings → Apps → Nks EduOrbit → Notifications चालू करा.' },
  ] },
  { id: 'weekly', icon: '🏆', title: 'महा-Test / Free test', items: [
    { id: 'what', q: 'महा-Test म्हणजे काय?', a: 'दर आठवड्याला ठराविक वेळी सगळ्या class चा free test. Result वेळी rank list आणि Top 10 Home वर दिसतात.' },
    { id: 'reg', q: 'महा-Test ला register कसं करायचं?', a: 'Home वरच्या 🏆 महा-Test card वर "Register करा". वेळ झाली की तिथे "सुरू करा" येईल.' },
    { id: 'hidden', q: 'माझं नाव toppers मध्ये लपवलेलं का?', a: 'पहिल्या registration वेळी "माझं नाव दाखवा" tick केलं नसेल तर नाव लपवलं जातं. बदलायचं असेल तर Admin ला सांगा.', action: 'admin' },
  ] },
  { id: 'refer', icon: '🎁', title: 'Refer & Earn', items: [
    { id: 'prize', q: 'मित्र जोडल्यावर काय मिळतं?', a: 'तुमच्या link ने आलेल्या मित्रांनी pay केलं की बक्षीस: उदा. 5 मित्र → Compass box, 8 → Stationery kit, 15 → School bag. सध्याचे आकडे login करून Me → Refer & Earn मध्ये दिसतात.' },
  ] },
];

const HELP_BOT = (() => {
  const WHATSAPP = '918390484545';
  const SITE = 'https://teachingboard-frontend.vercel.app';
  const PLAY = 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  const CACHE = 'tb_help_faq';
  let _opts = { role: 'student', api: () => 'https://teachingboard-backend.onrender.com/api' };
  let _faq = null;
  let _layer = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const _deviceId = () => { try { return localStorage.getItem('_tbDevice') || ''; } catch { return ''; } };
  const _native = () => !!window.Capacitor?.isNativePlatform?.();

  function _css() {
    if (document.getElementById('hb-css')) return;
    const st = document.createElement('style');
    st.id = 'hb-css';
    st.textContent = `
      .hb-link{position:absolute;top:10px;right:12px;z-index:5;background:none;border:0;padding:4px 6px;font:600 .78rem system-ui,sans-serif;color:inherit;opacity:.75;cursor:pointer;text-decoration:underline}
      .hb-link:hover{opacity:1}
      .hb-layer{position:fixed;inset:0;z-index:99990;background:rgba(15,10,40,.55);display:flex;align-items:flex-end;justify-content:center;animation:hbFade .18s ease both}
      .hb-panel{width:min(480px,100%);max-height:88vh;display:flex;flex-direction:column;background:#fff;color:#1b1340;border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.3);font-family:'Baloo 2','Noto Sans Devanagari',system-ui,sans-serif}
      @media (min-width:640px){.hb-layer{align-items:center}.hb-panel{border-radius:20px}}
      .hb-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #ece6ff}
      .hb-head b{flex:1;font-size:1.05rem}
      .hb-x,.hb-back{background:#f3efff;border:0;border-radius:10px;min-width:36px;height:36px;font-size:1rem;cursor:pointer;color:#5b3fd1}
      .hb-body{overflow-y:auto;padding:12px 14px 18px;display:flex;flex-direction:column;gap:8px}
      .hb-bot{align-self:flex-start;max-width:92%;background:#f3efff;border-radius:4px 16px 16px 16px;padding:9px 12px;line-height:1.45;font-weight:600}
      .hb-me{align-self:flex-end;max-width:85%;background:#7b2ff7;color:#fff;border-radius:16px 4px 16px 16px;padding:8px 12px;font-weight:700}
      .hb-opts{display:flex;flex-direction:column;gap:6px;margin-top:2px}
      .hb-opt{text-align:left;background:#fff;border:2px solid #e7e1ff;border-radius:14px;padding:10px 12px;font:700 .95rem inherit;font-family:inherit;color:#1b1340;cursor:pointer}
      .hb-opt:hover{border-color:#7b2ff7}
      .hb-opt.hb-main{background:linear-gradient(135deg,#ff7a18,#ff3d77 55%,#7b2ff7);color:#fff;border:0}
      .hb-opt.hb-wa{background:#25d366;color:#fff;border:0}
      .hb-field{display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:.9rem}
      .hb-field input{min-height:46px;border-radius:12px;border:2px solid #e7e1ff;padding:8px 12px;font:700 1.05rem inherit;font-family:inherit;background:#faf8ff;color:#1b1340}
      .hb-code{font:800 1.8rem monospace;letter-spacing:.08em;text-align:center;padding:8px;border:2px dashed #7b2ff7;border-radius:14px;background:#faf8ff}
      .hb-msg{color:#e11d48;font-weight:700;min-height:1.1em}
      .hb-ok{color:#16a34a;font-weight:800}
      @keyframes hbFade{from{opacity:0}to{opacity:1}}`;
    document.head.appendChild(st);
  }

  async function _loadFaq() {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || 'null'); if (Array.isArray(c)) _faq = c; } catch { /* ignore */ }
    if (!navigator.onLine) return;
    try {
      const r = await fetch(`${_opts.api()}/help/faq`);
      const b = await r.json();
      _faq = Array.isArray(b.faq) && b.faq.length ? b.faq : null;
      try { if (_faq) localStorage.setItem(CACHE, JSON.stringify(_faq)); else localStorage.removeItem(CACHE); } catch { /* ignore */ }
    } catch { /* offline: keep the copy */ }
  }
  const sections = () => {
    const all = _faq || HELP_DEFAULTS;
    // the shop panel only needs the login part
    return _opts.role === 'shop' ? all.filter(s => s.id === 'login').map(s => ({ ...s, items: s.items.filter(i => i.action === 'request_teacher') })) : all;
  };

  function _post(path, body) {
    return fetch(`${_opts.api()}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json().catch(() => ({})).then(b => { if (!r.ok) throw new Error(b.message || 'काहीतरी चूक झाली'); return b; }));
  }
  const _hit = (id, unresolved) => _post('/help/hit', { id, unresolved: !!unresolved }).catch(() => {});

  function _wa(text) {
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
    if (_native()) window.open(url, '_system'); else window.open(url, '_blank', 'noopener');
  }
  function _open(url) {
    const B = window.Capacitor?.Plugins?.Browser;
    if (B) B.open({ url }); else window.open(url, '_blank', 'noopener');
  }

  // ── chat panel ──────────────────────────────────────────
  function _body() { return _layer.querySelector('.hb-body'); }
  function _say(html, cls = 'hb-bot') {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = html;
    _body().appendChild(d);
    _body().scrollTop = _body().scrollHeight;
    return d;
  }
  function _options(list) {
    const box = document.createElement('div');
    box.className = 'hb-opts';
    list.forEach(([label, fn, cls]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hb-opt' + (cls ? ' ' + cls : ''); b.textContent = label;
      b.onclick = () => { box.querySelectorAll('button').forEach(x => { x.disabled = true; }); _say(esc(label), 'hb-me'); fn(); };
      box.appendChild(b);
    });
    _body().appendChild(box);
    _body().scrollTop = _body().scrollHeight;
  }

  function _menu() {
    _say('नमस्कार 🙏 कशात मदत हवी आहे? खालून निवडा.');
    _options(sections().map(s => [`${s.icon || '❓'} ${s.title}`, () => _section(s)]));
  }

  function _section(s) {
    _say(`${s.icon || ''} <b>${esc(s.title)}</b> — कोणता प्रश्न?`);
    _options([...s.items.map((it, i) => [`${i + 1}. ${it.q}`, () => _answer(s, it)]), ['⬅ मुख्य menu', _menu]]);
  }

  function _answer(s, it) {
    _hit(`${s.id}_${it.id}`);
    _say(esc(it.a));
    const after = () => _options([
      ['👍 झालं, धन्यवाद', () => { _say('😊 छान! अजून काही असेल तर menu उघडा.'); _options([['⬅ मुख्य menu', _menu]]); }],
      ['❌ अजून problem आहे → Admin ला कळवा', () => { _hit(`${s.id}_${it.id}`, true); _toAdmin(it.q); }, 'hb-wa'],
      ['⬅ मुख्य menu', _menu],
    ]);
    switch (it.action) {
      case 'forgot': return _options([['🔑 आत्ता करू', () => _forgot()], ['⬅ मुख्य menu', _menu]]);
      case 'request': return _options([['📨 Admin ला request पाठवा', () => _requestForm('student', 'new_phone')], ['⬅ मुख्य menu', _menu]]);
      case 'request_teacher': return _options([['📨 Teacher म्हणून request', () => _requestForm('teacher', 'teacher')], ['📨 दुकान म्हणून request', () => _requestForm('shop', 'shop')], ['⬅ मुख्य menu', _menu]]);
      case 'register': return _options([['🆕 Register उघडा', () => { close(); document.getElementById('ob-tab-register')?.click(); }], ['⬅ मुख्य menu', _menu]]);
      case 'parent': return _options([['👨‍👩‍👧 Parent login उघडा', () => { close(); document.querySelector('.ob-role-tab[data-role="parent"]')?.click(); }], ['⬅ मुख्य menu', _menu]]);
      case 'refund': _open(`${SITE}/refund-policy.html`); return after();
      case 'play': return _options([['📲 Play Store उघडा', () => { _open(PLAY); after(); }], ['⬅ मुख्य menu', _menu]]);
      case 'admin': return _options([['💬 Admin ला WhatsApp करा', () => _toAdmin(it.q), 'hb-wa'], ['⬅ मुख्य menu', _menu]]);
      default: return after();
    }
  }

  function _toAdmin(topic) {
    const code = (document.getElementById('ob-student-code')?.value || '').trim();
    _wa(`नमस्कार 🙏 मला NKs EduOrbit मध्ये मदत हवी आहे.\nप्रश्न: ${topic}${code ? `\nStudent Code: ${code}` : ''}\nनाव:\nनंबर:\n(थोडक्यात problem लिहा)`);
    _say('WhatsApp उघडलं — नाव, नंबर आणि problem लिहून पाठवा. Admin लवकरच उत्तर देतील.');
    _options([['⬅ मुख्य menu', _menu]]);
  }

  async function _phoneHint(input) {
    if (input.value.trim() || input.dataset.hinted) return;
    input.dataset.hinted = '1';
    try {
      const P = window.Capacitor?.Plugins?.PhoneHint;
      if (!P) return;
      const r = await P.pick();
      const d = String(r?.phone || '').replace(/\D/g, '').slice(-10);
      if (d.length === 10 && !input.value.trim()) input.value = d;
    } catch { /* type it */ }
  }

  function _form(html) {
    const d = _say(html);
    d.style.alignSelf = 'stretch'; d.style.maxWidth = '100%';
    return d;
  }

  // name + mobile + this phone -> code + new PIN
  function _forgot() {
    _say('ठीक आहे. विद्यार्थ्याचं नाव आणि पालकांचा mobile नंबर (register करताना दिलेला) लिहा. हा phone पण तपासला जाईल.');
    const f = _form(`<div class="hb-field">विद्यार्थ्याचं नाव<input id="hb-name" autocomplete="name" maxlength="40" placeholder="उदा. Rahul Patil" /></div>
      <div class="hb-field" style="margin-top:6px">पालकांचा mobile<input id="hb-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX" /></div>
      <p class="hb-msg" id="hb-msg"></p><button type="button" class="hb-opt hb-main" id="hb-go">🔍 तपासा</button>`);
    const mob = f.querySelector('#hb-mob');
    mob.addEventListener('focus', () => _phoneHint(mob));
    f.querySelector('#hb-go').onclick = async e => {
      const name = f.querySelector('#hb-name').value.trim();
      const m = mob.value.replace(/\D/g, '').slice(-10);
      const msg = f.querySelector('#hb-msg');
      if (name.length < 2) { msg.textContent = 'नाव लिहा'; return; }
      if (m.length !== 10) { msg.textContent = '10 अंकी नंबर लिहा'; return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        const r = await _post('/help/recover', { name, mobile: m, device_id: _deviceId() });
        f.querySelectorAll('input').forEach(x => { x.disabled = true; });
        if (r.ok) return _newPin(r);
        _say('😕 या phone वरून खात्री झाली नाही. (नवीन phone असेल, किंवा नाव / नंबर वेगळा दिला असेल.)');
        _options([['📨 Admin ला request पाठवा (नवीन PIN WhatsApp वर)', () => _requestForm('student', 'not_matched', { name, mobile: m })], ['🔁 पुन्हा प्रयत्न', _forgot], ['⬅ मुख्य menu', _menu]]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  function _newPin(r) {
    _say(`✅ खात्री झाली! <b>${esc(r.name)}</b> चा Student Code:`);
    const f = _form(`<div class="hb-code">${esc(r.student_code)}</div>
      <p style="margin:8px 0 4px;font-weight:700">नवीन 4 अंकी PIN ठेवा (10 मिनिटांत):</p>
      <div class="hb-field">नवीन PIN<input id="hb-p1" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" /></div>
      <div class="hb-field" style="margin-top:6px">PIN पुन्हा<input id="hb-p2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••" /></div>
      <p class="hb-msg" id="hb-msg2"></p><button type="button" class="hb-opt hb-main" id="hb-save">💾 PIN Save करा</button>`);
    f.querySelector('#hb-save').onclick = async e => {
      const p1 = f.querySelector('#hb-p1').value.trim(), p2 = f.querySelector('#hb-p2').value.trim();
      const msg = f.querySelector('#hb-msg2');
      if (!/^\d{4}$/.test(p1)) { msg.textContent = '4 अंकी PIN लिहा'; return; }
      if (p1 !== p2) { msg.textContent = 'दोन्ही PIN सारखे नाहीत'; return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        await _post('/help/reset-pin', { student_code: r.student_code, ticket: r.ticket, pin: p1 });
        _say('🎉 PIN बदलला! Code आणि PIN login मध्ये भरले आहेत — "Continue" दाबा.', 'hb-bot hb-ok');
        const code = document.getElementById('ob-student-code'), pin = document.getElementById('ob-pin');
        document.querySelector('.ob-role-tab[data-role="student"]')?.click();
        if (code) code.value = r.student_code;
        if (pin) pin.value = p1;
        _options([['✅ Login कडे जा', close, 'hb-main']]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  function _requestForm(role, reason, pre = {}) {
    const who = role === 'teacher' ? 'Teacher चं' : role === 'shop' ? 'दुकानाचं / मालकाचं' : 'विद्यार्थ्याचं';
    _say(`${who} नाव आणि ${role === 'student' ? 'पालकांचा' : 'तुमचा'} mobile नंबर लिहा. Admin तपासून नवीन PIN WhatsApp वर पाठवतील.`);
    const f = _form(`<div class="hb-field">${who} नाव<input id="hb-rn" maxlength="60" value="${esc(pre.name || '')}" /></div>
      <div class="hb-field" style="margin-top:6px">Mobile<input id="hb-rm" type="tel" inputmode="tel" maxlength="16" value="${esc(pre.mobile || '')}" placeholder="98XXXXXXXX" /></div>
      <div class="hb-field" style="margin-top:6px">Code आठवत असेल तर (optional)<input id="hb-rc" maxlength="20" /></div>
      <p class="hb-msg" id="hb-msg3"></p><button type="button" class="hb-opt hb-main" id="hb-send">📨 Request पाठवा</button>`);
    const mob = f.querySelector('#hb-rm');
    mob.addEventListener('focus', () => _phoneHint(mob));
    f.querySelector('#hb-send').onclick = async e => {
      const msg = f.querySelector('#hb-msg3');
      const name = f.querySelector('#hb-rn').value.trim(), m = mob.value.replace(/\D/g, '').slice(-10);
      if (name.length < 2) { msg.textContent = 'नाव लिहा'; return; }
      if (m.length !== 10) { msg.textContent = '10 अंकी नंबर लिहा'; return; }
      e.target.disabled = true; msg.textContent = '';
      try {
        await _post('/help/pin-request', { role, name, mobile: m, code: f.querySelector('#hb-rc').value.trim(), reason });
        f.querySelectorAll('input').forEach(x => { x.disabled = true; });
        _say('✅ Request गेली! Admin तपासून नवीन PIN या नंबरवर WhatsApp करतील.', 'hb-bot hb-ok');
        _options([['⬅ मुख्य menu', _menu]]);
      } catch (err) {
        e.target.disabled = false; msg.textContent = err.message;
      }
    };
  }

  function open() {
    _css();
    close();
    _layer = document.createElement('div');
    _layer.className = 'hb-layer';
    _layer.innerHTML = `<div class="hb-panel" role="dialog" aria-modal="true" aria-label="मदत">
      <div class="hb-head"><span style="font-size:1.4rem">🤖</span><b>मदत · Nks EduOrbit</b><button type="button" class="hb-x" aria-label="Close">✕</button></div>
      <div class="hb-body"></div></div>`;
    _layer.addEventListener('click', e => { if (e.target === _layer) close(); });
    _layer.querySelector('.hb-x').onclick = close;
    document.body.appendChild(_layer);
    _loadFaq().finally(() => { if (_layer) _menu(); });
  }

  function close() { _layer?.remove(); _layer = null; }

  // Adds the small "❓ मदत" link in the corner of `host`.
  function mount(host, opts = {}) {
    _opts = { ..._opts, ...opts };
    if (!host || host.querySelector('.hb-link')) return;
    _css();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hb-link'; b.textContent = '❓ मदत';
    b.onclick = open;
    host.appendChild(b);
  }

  return { mount, open, close };
})();
window.HELP_BOT = HELP_BOT;
window.HELP_DEFAULTS = HELP_DEFAULTS;
// Student app / website login screen: the corner link
document.addEventListener('DOMContentLoaded', () => {
  const card = document.querySelector('#onboarding-screen .onboarding-card');
  if (card) HELP_BOT.mount(card, { role: 'student', api: () => window.API?.getApiUrl?.() || 'https://teachingboard-backend.onrender.com/api' });
});
