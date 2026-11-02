/* ════════════════════════════════════════
   teacherConnect.js — "🔗 Connect student"
   Global: TEACHER_CONNECT

   Teacher side (Share tab): a join link + QR (phone camera / Google Lens scan
   it — no scanner inside the app). Student side: opening the link while
   logged in asks "join Sir?" and joins at once (the teacher shared it, so no
   approval); Home shows "👩‍🏫 माझे Teachers" (add by code). Only the admin
   can remove a student from a teacher (owner's choice). A new
   visitor gets the Register form with the teacher code already filled.
   Only school teachers (not YouTube partners / shops). Joining later is for
   teaching only — see backend teacherConnectController for the commission rule.
════════════════════════════════════════ */

const TEACHER_CONNECT = (() => {
  const SITE = 'https://teachingboard-frontend.vercel.app';
  const PENDING = 'tb_pending_join';
  const QR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => window.APP?.toast ? APP.toast(m, t) : console.log(m);
  const joinLink = code => `${SITE}/student-app/?join=${encodeURIComponent(code)}`;
  const _get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const _set = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* ignore */ } };

  // ── the ?join=CODE link ──────────────────────────────────
  (function readLink() {
    try {
      const code = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
      if (code) _set(PENDING, code);
    } catch { /* ignore */ }
  })();

  // Login screen: a new student gets the code in the Register form; an old one logs in first.
  function onLoginScreen() {
    const code = _get(PENDING);
    if (!code) return;
    const t = $('reg-teacher');
    if (t && !t.value) t.value = code;
    const sub = $('ob-role-sub');
    if (sub && !document.getElementById('tc-login-note')) {
      const n = document.createElement('p');
      n.id = 'tc-login-note';
      n.className = 'onboarding-sub';
      n.style.cssText = 'margin-top:4px;color:#ffc83d;font-weight:700';
      n.textContent = `👩‍🏫 Teacher शी connect (${code}): account असेल तर login करा, नवीन असाल तर Register करा — code भरलेला आहे.`;
      sub.after(n);
    }
  }

  async function _api(method, path, body) {
    const token = await API.ensureStudentSession().catch(() => '');
    const r = await fetch(`${API.getApiUrl()}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || b.success === false) throw new Error(b.message || 'काहीतरी चूक झाली');
    return b;
  }

  // After a student's Home loads: a pending link -> confirm and join.
  async function afterLogin() {
    const code = _get(PENDING);
    if (!code || window.GUEST?.isActive?.()) return;
    let t;
    try { t = (await _api('GET', `/teacher-connect/info/${encodeURIComponent(code)}`)).data; }
    catch { _set(PENDING, ''); toast('हा teacher code सापडला नाही', 'error'); return; }
    const mine = await _api('GET', '/teacher-connect/mine').then(b => b.data.teachers).catch(() => []);
    if (mine.some(x => x.code === t.code)) { _set(PENDING, ''); return; }
    _confirm(t);
  }

  function _confirm(t) {
    const el = document.createElement('div');
    el.className = 'gx-layer gx-dim';
    el.setAttribute('role', 'dialog');
    el.innerHTML = `<div class="gx-card">
      <button type="button" class="gx-close" aria-label="Close">✕</button>
      <div class="gx-logo" aria-hidden="true">👩‍🏫</div>
      <h2 class="gx-title"><span class="gx-grad-text">${esc(t.name)}</span></h2>
      ${t.institute ? `<p class="gx-sub">${esc(t.institute)}</p>` : ''}
      <p class="gx-sub">तुम्हाला आपल्या वर्गात जोडू इच्छितात. जोडल्यावर ते तुमचे tests आणि progress पाहू शकतील आणि तुम्हाला सूचना / papers पाठवू शकतील.</p>
      <p class="gx-msg" id="tc-msg" role="alert"></p>
      <button type="button" class="gx-btn gx-big gx-shine" id="tc-yes">✅ हो, जोडा</button>
      <button type="button" class="gx-link" id="tc-no">आत्ता नको</button>
    </div>`;
    document.body.appendChild(el);
    const done = () => { el.remove(); _set(PENDING, ''); };
    el.querySelector('.gx-close').onclick = done;
    el.querySelector('#tc-no').onclick = done;
    el.querySelector('#tc-yes').onclick = async e => {
      e.target.disabled = true;
      try {
        await _api('POST', '/teacher-connect/join', { teacher_code: t.code, via: 'link' });
        done();
        toast(`✅ ${t.name} यांच्या वर्गात जोडलं`, 'success');
        window.GUEST?.fireworks?.(.5);
        renderHomeCard();
      } catch (err) {
        e.target.disabled = false;
        el.querySelector('#tc-msg').textContent = err.message;
      }
    };
  }

  // ── Home: "👩‍🏫 माझे Teachers" ─────────────────────────────
  async function renderHomeCard() {
    const home = $('screen-home');
    if (!home || window.GUEST?.isActive?.() || !navigator.onLine) return;
    let teachers;
    try { teachers = (await _api('GET', '/teacher-connect/mine')).data.teachers; } catch { return; }
    let card = home.querySelector('.tc-card');
    if (!card) {
      card = document.createElement('div');
      card.className = 're-card tc-card';
      const refer = $('home-refer-card');
      if (refer) refer.after(card); else home.appendChild(card);
    }
    card.innerHTML = `<div class="re-card-head"><b>👩‍🏫 माझे Teachers</b></div>
      ${teachers.length ? teachers.map(t => `<div class="tc-row"><span><b>${esc(t.name)}</b>${t.institute ? ` <small>${esc(t.institute)}</small>` : ''}</span><span>✅</span></div>`).join('')
        : '<div class="re-card-line">अजून कोणी नाही. Sir / Madam नी दिलेली link उघडा, किंवा त्यांचा code टाका.</div>'}
      <div class="tc-add"><input class="tc-input" id="tc-code" maxlength="20" placeholder="Teacher code" autocapitalize="characters" />
        <button type="button" class="re-open-btn" id="tc-add">➕ जोडा</button></div>`;
    card.querySelector('#tc-add').onclick = async e => {
      const code = card.querySelector('#tc-code').value.trim().toUpperCase();
      if (!code) { toast('Teacher code टाका', 'error'); return; }
      e.target.disabled = true;
      try {
        const r = await _api('POST', '/teacher-connect/join', { teacher_code: code, via: 'code' });
        toast(`✅ ${r.teacher.name} यांच्या वर्गात जोडलं`, 'success');
        renderHomeCard();
      } catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
    };
  }

  // ── Teacher: Share tab box ─────────────────────────────────
  function _loadQR() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = QR_CDN; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  async function _qrCard(t) {
    await _loadQR();
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(box);
    // eslint-disable-next-line no-new
    new window.QRCode(box, { text: joinLink(t.code), width: 640, height: 640, colorDark: '#1b1340', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    const qr = box.querySelector('canvas');
    box.remove();
    await document.fonts?.ready;
    const W = 1000, H = 1300, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1473ff'); bg.addColorStop(1, '#7b2ff7');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const F = (w, px) => `${w} ${px}px "Baloo 2","Noto Sans Devanagari",sans-serif`;
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.font = F(800, 44); g.fillText('NKs EduOrbit', W / 2, 80);
    g.font = F(800, 68); g.fillText('👩‍🏫 ' + String(t.name).slice(0, 22), W / 2, 180);
    if (t.institute) { g.font = F(700, 40); g.fillText(String(t.institute).slice(0, 34), W / 2, 240); }
    g.fillStyle = '#fff'; g.beginPath(); if (g.roundRect) g.roundRect(170, 290, 660, 700, 40); else g.rect(170, 290, 660, 700); g.fill();
    g.imageSmoothingEnabled = false; g.drawImage(qr, 200, 320, 600, 600);
    g.fillStyle = '#7b2ff7'; g.font = F(800, 40); g.fillText('📱 Scan करा → वर्गात जोडा', W / 2, 965);
    g.fillStyle = '#fff'; g.font = F(700, 42); g.fillText(`किंवा app मध्ये code टाका: ${t.code}`, W / 2, 1080);
    g.font = F(600, 32); g.fillText('Phone च्या camera ने किंवा Google Lens ने scan करा', W / 2, 1150);
    return cv;
  }

  async function renderTeacherBox(host) {
    if (!host) return;
    const p = await API.getTeacherProfile().catch(() => null);
    const t = { code: String(p?.teacher_code || '').toUpperCase(), name: p?.name || '', institute: p?.institute_name || '' };
    if (!t.code || (p?.partner_type && p.partner_type !== 'school')) { host.classList.add('hidden'); return; }
    const link = joinLink(t.code);
    host.innerHTML = `<h4>🔗 Connect student</h4>
      <p class="td-share-hint">ही link किंवा QR students ना द्या. आधीपासून app वापरणारे students उघडून "हो, जोडा" दाबतील आणि लगेच तुमच्या Students यादीत येतील. नवीन students ना Register मध्ये तुमचा code आधीच भरलेला मिळेल.</p>
      <div class="td-share-code" style="word-break:break-all"><small>${esc(link)}</small></div>
      <div class="tc-qr" id="tc-qr"><small>QR तयार होत आहे…</small></div>
      <button type="button" class="td-send-notif-btn" id="tc-wa">💬 WhatsApp वर पाठवा</button>
      <button type="button" class="td-send-notif-btn" id="tc-copy" style="margin-top:8px">📋 Link copy करा</button>
      <button type="button" class="td-send-notif-btn" id="tc-dl" style="margin-top:8px">⬇️ QR download (वर्गात लावा)</button>
      <p class="td-share-hint" id="tc-status" role="status"></p>`;
    const status = host.querySelector('#tc-status');
    const msg = `👩‍🏫 ${t.name}${t.institute ? ` (${t.institute})` : ''} — माझ्या वर्गात NKs EduOrbit वर जोडा:\n${link}\n\nApp नसेल तर याच link वरून Register करा (माझा code आपोआप भरेल: *${t.code}*).`;
    host.querySelector('#tc-wa').onclick = () => {
      const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      try { if (!window.open(url, '_system')) window.open(url, '_blank'); } catch { window.open(url, '_blank'); }
    };
    host.querySelector('#tc-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(msg); status.textContent = '✅ Copy झालं'; } catch { status.textContent = link; }
    };
    let card = null;
    host.querySelector('#tc-dl').onclick = async () => {
      try {
        card = card || await _qrCard(t);
        const blob = await new Promise(r => card.toBlob(r, 'image/png'));
        if (window.FILE_EXPORT?.saveAndShare) await FILE_EXPORT.saveAndShare(blob, `connect-${t.code}.png`);
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `connect-${t.code}.png`; a.click(); }
      } catch { status.textContent = 'QR तयार झाला नाही — internet तपासा.'; }
    };
    try {
      card = await _qrCard(t);
      const img = document.createElement('img');
      img.src = card.toDataURL('image/jpeg', .8); img.alt = 'Connect QR'; img.style.cssText = 'width:60%;max-width:240px;border-radius:12px;display:block;margin:8px auto';
      host.querySelector('#tc-qr').replaceChildren(img);
    } catch { host.querySelector('#tc-qr').innerHTML = '<small>QR साठी internet लागेल.</small>'; }
  }

  return { onLoginScreen, afterLogin, renderHomeCard, renderTeacherBox, joinLink };
})();
window.TEACHER_CONNECT = TEACHER_CONNECT;
