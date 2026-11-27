/* ════════════════════════════════════════
   NKs Team — the team's CRM app (mobile first)
   Login: mobile + PIN (Admin › CRM › 👥 Team makes members). Render gives a token; the bot's CRM (Cloudflare
   Worker) is called with a short "staff" token that names the member, so every action is counted for them.
   Screens: 🏠 आज (the call desk: new-family alert, numbered day list, callbacks) · 🔍 शोध · ❓ प्रश्न · 📊 माझं · ➕ नवीन.
   A family's card: 📞 Call / 💬 WhatsApp / ✉️ SMS, then its result in one tap — with a reason:
   ✅ बोललो → पुढची Step · 💳 Pay करणार · ⏰ नंतर · 📵 उचलला नाही · ❌ नको.
════════════════════════════════════════ */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const API = () => { try { return localStorage.getItem('teachingboard_api_url') || window.TEACHINGBOARD_API_URL; } catch { return window.TEACHINGBOARD_API_URL; } };
  const SITE = 'https://nkseduorbit.in', PLAY = 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const ago = ms => { if (!ms) return '—'; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? 'आत्ता' : m < 60 ? `${m} मि. पूर्वी` : m < 1440 ? `${Math.round(m / 60)} तासांपूर्वी` : `${Math.round(m / 1440)} दिवसांपूर्वी`; };
  const left = iso => { const m = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} तास बाकी` : `${m} मि. बाकी`; };
  const dueText = ms => { if (!ms) return 'आज'; const d = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5); return d <= 0 ? 'आज' : d === 1 ? 'उद्या' : new Date(ms).toLocaleDateString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short' }); };
  // "📲 शेवटचं app मध्ये: काल · 12 tests · 45 मि. (7 दिवस)"
  const usageText = u => { if (!u) return ''; const days = u.last ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(u.last).setHours(0, 0, 0, 0)) / 864e5) : null;
    return `📲 शेवटचं app मध्ये: ${days == null ? '—' : days <= 0 ? 'आज' : days === 1 ? 'काल' : days + ' दिवसांपूर्वी'} · ${u.tests || 0} tests${u.min7 ? ` · ${u.min7} मि. (7 दिवस)` : ''}`; };
  function toast(t, err) { const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); }

  // ── server calls ──
  let tok = ls.get('nks_team_token'), me = JSON.parse(ls.get('nks_team_me') || 'null'), bot = JSON.parse(ls.get('nks_team_bot') || 'null');
  async function rq(path, { body, method } = {}) {
    const r = await fetch(API() + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && tok) { logout(j.message); throw new Error(j.message || 'पुन्हा login करा'); }
    if (!r.ok || j.success === false) throw new Error(j.message || 'काहीतरी चूक झाली');
    return j;
  }
  async function crm(path, body) {
    if (!bot || Date.now() - bot.at > 10 * 3600e3) {
      const d = (await rq('/guest/admin/bot-token')).data;
      if (!d?.ready) throw new Error('Bot अजून जोडलेला नाही');
      bot = { url: d.url, token: d.token, at: Date.now() };
      ls.set('nks_team_bot', JSON.stringify(bot));
    }
    const r = await fetch(bot.url + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + bot.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { bot = null; ls.set('nks_team_bot', null); throw new Error('पुन्हा प्रयत्न करा'); }
    if (!r.ok || j.success === false) throw new Error(j.message || 'काहीतरी चूक झाली');
    return j.data;
  }
  // 🎁 the admin's offer settings (team on/off, its percents and hours) — Admin › Sync › 🎁 सूट settings
  let offerCfg = null;
  async function loadOfferCfg() {
    if (offerCfg && Date.now() - offerCfg.at < 5 * 60e3) return offerCfg.data;
    try { offerCfg = { at: Date.now(), data: (await rq('/guest/offer-config')).data }; } catch { /* keep the old one */ }
    return offerCfg?.data || null;
  }
  // 🔔 this phone gets a push for every new family (wa-worker desk.js teamNewPush → Render → FCM). The app only
  // (a browser has no push here); asked once per app start. A tap opens that family's card.
  let pushSet = false, pushTok = '', pushFor = '';
  // the phone's token → the member logged in now (once per member; again after a logout + another login)
  const sendPushTok = () => { if (!pushTok || !tok || !me || pushFor === me.id) return; pushFor = me.id; rq('/team/device-token', { method: 'PATCH', body: { token: pushTok } }).catch(() => { pushFor = ''; }); };
  async function setupPush() {
    const Push = window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.PushNotifications;
    if (!Push || !tok) return;
    if (pushSet) return sendPushTok();
    pushSet = true;
    try {
      Push.addListener('registration', ({ value }) => { if (value) { pushTok = value; pushFor = ''; sendPushTok(); } });
      Push.addListener('notificationActionPerformed', a => {
        const d = a?.notification?.data || {};
        if (d.kind !== 'team_new' || !tok) return;
        document.querySelector('.sheet-bg')?.remove();
        queue = null; tab = 'home';
        if (d.gid) openCard(d.gid); else route();
      });
      // the app is open (Android shows no notification then): a toast and fresh numbers
      Push.addListener('pushNotificationReceived', n => {
        if (n?.data?.kind !== 'team_new') return;
        toast(n.title || '🆕 नवीन पालक');
        if (tab === 'home' && !queue && !document.querySelector('.sheet-bg') && document.querySelector('.dk-home')) home().catch(() => {});
      });
      const p = await Push.requestPermissions();
      if (p.receive !== 'granted') return;
      await Push.register();
    } catch (e) { console.warn('push', e); }
  }
  function logout(why) { tok = null; me = null; bot = null; ls.set('nks_team_token', null); ls.set('nks_team_me', null); ls.set('nks_team_bot', null); ls.set('nks_team_home', null); showLogin(why); }

  // ── ready messages (the admin's own from the bot, else these) ──
const _ORD = { 1: '1ली', 2: '2री', 3: '3री', 4: '4थी' };
  // "8th NMMS EXAM 26-27 BATCH" → "8वी NMMS Test Series" (parents read "Test Series", never the batch's own name)
  const seriesName = n => { let x = String(n || '').replace(/\b(batch|exam|class)\b/gi, ' ').replace(/\b\d{2,4}\s*[-–]\s*\d{2,4}\b/g, ' ').replace(/\b(\d{1,2})\s*(st|nd|rd|th)\b/gi, (_, d) => _ORD[d] || d + 'वी').replace(/\s*\(\s*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim(); return x ? x + ' Test Series' : ''; };
  const DEFAULT_TPLS = [
    { id: 'hello', title: '👋 पहिला संपर्क + free test', text: 'नमस्कार 🙏 मी NKs EduOrbit मधून.\n{नाव} साठी {class} ची free test (10 मिनिटं, login नाही) 👇\n{test}{bot:TEST}' },
    { id: 'acct', title: '🔑 App चा Code + PIN', text: 'नमस्कार 🙏 {नाव} चं NKs EduOrbit app account तयार आहे.\n👤 Code: *{code}*\n🔑 PIN: *{pin}*\n📲 App 👇\n{app}\nApp उघडा → Login → Code आणि PIN टाका → सगळ्या free tests.{bot:HELP}' },
    { id: 'remind', title: '📝 Test आठवण', text: 'नमस्कार 🙏 {नाव} ने free test दिली का? फक्त 10 मिनिटं, login नाही 👇\n{test}{bot:TEST}' },
    { id: 'result', title: '🎯 Result + सवलत', text: 'नमस्कार 🙏 {नाव} ने {tests} free test दिल्या 👏\nपूर्ण result, कमकुवत भाग आणि सवलत{सवलत}:\n👇 या link वर दाबा आणि pay करा\n{pay}{bot:RESULT}' },
    { id: 'offer', title: '🎁 सवलत संपतेय', text: 'नमस्कार 🙏 {नाव} साठी पहिल्या payment वर सूट{सवलत} आहे.\n{class}: सगळे tests, स्पष्टीकरण आणि दर रविवारी महा-Test.\n👇 या link वर दाबा आणि pay करा\n{pay}{bot:OFFER}' },
    { id: 'course', title: '📚 पूर्ण Test Series', text: 'नमस्कार 🙏 {नाव} ने {tests} free tests दिल्या 👏\nपूर्ण {class} मध्ये सगळे tests, प्रत्येक प्रश्नाचं स्पष्टीकरण आणि महा-Test.\n👇 या link वर दाबा आणि pay करा\n{pay}{bot:OFFER}' },
    { id: 'next', title: '📝 पुढची free test', text: 'नमस्कार 🙏 {नाव} साठी पुढची free test तयार आहे 👇\n{test}{bot:TEST}' },
    { id: 'missed', title: '📞 Call लागला नाही', text: 'नमस्कार 🙏 NKs EduOrbit मधून {नाव} बद्दल call केला होता. सोयीची वेळ सांगा, आम्ही परत call करू.{bot:HELP}' },
  ];
  let tpls = DEFAULT_TPLS, botNum = '', steps = [], acct = {};
  const tplById = id => tpls.find(t => t.id === id) || DEFAULT_TPLS.find(t => t.id === id) || null;
  function fill(text, L, offer) {
    // the account's PIN not with us (the parent's own): the same code with "तुमचा आधीचाच PIN" — never a second account / PIN
    const a = acct[L.gid] || (L.acct?.code ? { ...L.acct, own: !L.acct.pin } : null), g = L.gid;
    if (/\{(code|pin)\}/.test(text) && !(a?.code && (a.pin || a.own))) return null;
    const off = offer ? ` (${offer.pct}%) ` + new Date(offer.end).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) + ' पर्यंत' : '';
    const b = kw => botNum ? `\n\nप्रश्न / पुढची test: आमच्या WhatsApp bot ला इथे message करा (फक्त Send दाबा) 👇\nhttps://wa.me/${botNum}?text=${encodeURIComponent(String(kw || 'TEST').toUpperCase() + ' ' + g)}` : '';
    return text.replace(/\{bot(?::([A-Za-z]+))?\}/g, (_, kw) => b(kw))
      .replace(/\{नाव\}/g, L.name || 'तुमचा पाल्य').replace(/\{class\}/g, seriesName(L.cls)).replace(/\{tests\}/g, String(L.testsDone || 0))
      .replace(/\{test\}/g, `${SITE}/student-app/?free=1&g=${g}`).replace(/\{pay\}/g, `${SITE}/p/${g}`).replace(/\{app\}/g, PLAY)
      .replace(/\{code\}/g, a?.code || '').replace(/\{pin\}/g, a?.pin || (a?.own ? 'तुमचा आधीचाच PIN (विसरलात तर App › Login › "📲 WhatsApp ने login")' : '')).replace(/\{सवलत\}/g, off)
      .replace(/\{महा-test वेळ\}/g, 'येत्या रविवारी').replace(/\{महा-test\}/g, `${SITE}/maha-test.html?class=${encodeURIComponent(L.cls || '')}`);
  }
  const suggest = (L, offer) => !L.testsDone ? 'hello' : (acct[L.gid] || L.acct)?.code && !L.app ? 'acct' : offer ? 'offer' : L.stopped ? 'next' : 'course';

  // ── screens ──
  const app = $('app');
  let tab = 'home', queue = null;   // queue: { title, rows, i } — today's families one after another
  function shell(inner, title, sub) {
    app.innerHTML = `
      <header class="tb"><h1>${esc(title || 'NKs Team')}<span class="sub">${esc(sub || (me ? '👤 ' + me.name : ''))}</span></h1>
        <button type="button" id="tb-refresh" aria-label="पुन्हा">🔄</button></header>
      <main id="main">${inner}</main>
      <button type="button" class="fab" id="fab" aria-label="नवीन पालक / विद्यार्थी">＋</button>
      <nav class="nav" aria-label="मेनू">
        ${[['home', '🏠', 'आज'], ['search', '🔍', 'शोध'], ['q', '❓', 'प्रश्न'], ['my', '📊', 'माझं']].map(([k, i, t]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}"><b>${i}</b>${t}${k === 'q' && qCount ? `<span class="dot">${qCount}</span>` : ''}</button>`).join('')}
      </nav>`;
    app.querySelectorAll('.nav [data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; queue = null; route(); });
    $('fab').onclick = addSheet;
    $('tb-refresh').onclick = () => route();
  }
  let qCount = 0;
  async function route() {
    if (!tok) return showLogin();
    try {
      if (tab === 'home') return await home();
      if (tab === 'search') return search();
      if (tab === 'q') return await questions();
      if (tab === 'my') return await mine();
    } catch (e) { shell(`<p class="empty">⚠️ ${esc(e.message)}</p>`); }
  }

  // ═══════════ 📞 Call desk (owner 2026-11-26) — the server side is wa-worker/src/desk.js ═══════════
  // 🏠 आज: the new-family alert (15 min), the numbered day list (#1…), today's callbacks, questions, teachers,
  // my numbers. A family's card → 📞 Call / 💬 Chat → "काय झालं?" (required) → the next family.
  let desk = null, deskTimer = null, pendingOutcome = null;   // pendingOutcome: { gid, L } after 📞 / 💬
  const HEAT = { hot: '🔥 गरम', warm: '🌤 कोमट', cold: '❄️ थंड' };
  const STAGES = ['संपर्क', 'test', 'app', 'pay करणार', 'paid'];
  const hm = ms => new Date(ms).toLocaleTimeString('mr-IN-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
  async function home() {
    clearInterval(deskTimer);
    const kept = JSON.parse(ls.get('nks_team_desk') || 'null');
    if (kept) drawHome(kept, true); else shell('<p class="empty">⏳ उघडत आहे…</p>', 'आजचं काम');
    const [d, tp] = await Promise.all([crm('/crm/desk/home'), crm('/crm/templates').catch(() => null)]);
    if (Array.isArray(tp) && tp.length) tpls = tp;
    desk = d; ls.set('nks_team_desk', JSON.stringify(d));
    if (tab === 'home' && !queue) drawHome(d, false);
    setTimeout(setupPush, 2000);   // after the screen settles (asking at once crashes some Android phones)
    // fresh numbers every minute while the home screen is open (a new family, a callback coming due)
    deskTimer = setInterval(() => { if (tab === 'home' && !queue && !document.querySelector('.sheet-bg') && document.querySelector('.dk-home')) home().catch(() => {}); }, 60e3);
  }
  function drawHome(d, stale) {
    qCount = d.q || 0;
    const day = d.day || { items: [], total: 0, done: 0 }, nx = day.next, t = d.today || {}, tot = d.totals || {};
    const sat = [0, 6].includes(new Date().getDay());
    shell(`<div class="dk-home">
      ${(d.alert || []).slice(0, 3).map(a => `<button type="button" class="dk-alert" data-gid="${esc(a.gid)}">
        <b>🆕 नवीन पालक — ${a.left_min > 0 ? `${a.left_min} मिनिटांत call करा` : `${-a.left_min} मिनिटं उशीर — आत्ताच call`}</b>
        <span>${esc(a.name || 'नाव नाही')} · ${esc(a.cls || '')} · ${esc(a.from || '')} · ${hm(a.created_at)}</span></button>`).join('')}
      ${(d.tStuck || []).length ? `<button type="button" class="dk-alert t" ${d.tStuck.length === 1 ? 'data-gid="' + esc(d.tStuck[0].gid) + '"' : 'data-go="teacher"'}><b>⚠️ ${d.tStuck.length} शिक्षक — आत्ता call करा</b>
        <span>${d.tStuck.slice(0, 3).map(x => esc((x.name || 'शिक्षक') + ' — ' + (x.why || x.stage || ''))).join(' · ')}</span></button>` : ''}
      ${d.meet && d.meet.teachers ? `<button type="button" class="dk-alert t" data-go="teacher"><b>📅 रविवार Live Demo — ${d.meet.booked} शिक्षक बुक</b>
        <span>${esc(d.meet.when || '')} · ${d.meet.teachers} पैकी · यादीत "📅 Demo बुक"</span></button>` : ''}
      <button type="button" class="dk-today" data-go="list">
        <span class="dk-top"><span>🎯 आजचं काम</span><b>${day.done}/${day.total}</b></span>
        <span class="dk-prog"><i style="width:${day.total ? day.done / day.total * 100 : 0}%"></i></span>
        <span class="dk-next">${nx ? `▶ पुढचा: #${nx.n} ${esc(nx.name || '')} — ${esc(nx.why || '')}` : day.total ? '✅ आजची यादी पूर्ण' : 'आज यादीत कोणी नाही'}</span>
      </button>
      ${(d.callbacks || []).length ? `<div class="box"><h3>⏰ आजचे callbacks</h3>${d.callbacks.map(c => `<button type="button" class="row" style="--c:#b45309" data-gid="${esc(c.gid)}"><span class="nm">${hm(c.at)} · ${esc(c.name || '—')} <small>${esc(c.cls || '')}</small></span><span class="mt">${esc(c.why || '')}</span></button>`).join('')}</div>` : ''}
      <div class="grid">
        <button type="button" class="big" style="--c:#be123c" data-go="q"><span class="n">${d.q || 0}</span><span class="t">❓ प्रश्न</span><span class="s">Bot ला उत्तर देता आलं नाही</span></button>
        <button type="button" class="big" style="--c:#6d3cf0" data-go="teacher"><span class="n">${d.teachers || 0}</span><span class="t">👩‍🏫 शिक्षक</span><span class="s">WhatsApp वरचे शिक्षक · 7 steps</span></button>
        ${sat ? '<button type="button" class="big wide" style="--c:#b45309" data-go="mt"><span class="n">🏆</span><span class="t">महा-Test आठवण</span><span class="s">नोंदणी केलेल्या पालकांना</span></button>' : ''}
      </div>
      <div class="h2">माझं आज</div>
      <div class="dk-kpi"><span><b>${t.calls || 0}</b>📞 call</span><span><b>${t.talk || 0}</b>✅ बोलणं</span><span><b>${t.paying || 0}</b>💳 करणार</span><span><b>${t.paid || 0}</b>✅ pay</span></div>
      <p class="mt" style="margin:8px 2px">एकूण कुटुंबं <b>${tot.all || 0}</b> · संपर्क झाले <b>${tot.touched || 0}</b> · बाकी <b>${tot.left || 0}</b> · paid <b>${tot.paid || 0}</b></p>
    </div>`, 'आजचं काम', stale ? '⏳ ताजे आकडे येत आहेत…' : (me ? '👤 ' + me.name : ''));
    app.querySelectorAll('.dk-home [data-gid]').forEach(b => b.onclick = () => { queue = null; openCard(b.dataset.gid); });
    app.querySelectorAll('.dk-home [data-go]').forEach(b => b.onclick = async () => {
      const g = b.dataset.go;
      if (g === 'list') return dayList();
      if (g === 'q') { tab = 'q'; return route(); }
      if (g === 'mt') return mtQueue();
      if (g === 'teacher') return startQueue('👩‍🏫 शिक्षक', '/crm/list?list=teacher', 0);
    });
  }
  // 🎯 the day list, numbered; "▶ पुढचा" opens the first one not done
  async function dayList() {
    const items = desk && desk.day ? desk.day.items : await crm('/crm/desk/day');
    const done = items.filter(x => x.status === 'done').length, nx = items.find(x => x.status !== 'done' && !x.lock);
    shell(`<div class="dk-prog light"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div>
      ${nx ? `<button type="button" class="btn pri" style="width:100%;margin:10px 0" data-gid="${esc(nx.gid)}">▶ पुढचा: #${nx.n} ${esc(nx.name || '')}</button>` : '<p class="empty">✅ आजची यादी पूर्ण</p>'}
      ${items.map(x => `<button type="button" class="row dk-row${x.status === 'done' ? ' done' : ''}" style="--c:${x.cat === 1 ? '#b91c1c' : x.cat <= 3 ? '#b45309' : '#4338ca'}" data-gid="${esc(x.gid)}"${x.lock ? ' data-lock="' + esc(x.lock) + '"' : ''}>
        <span class="nm"><span class="dk-n">#${x.n}</span> ${esc(x.name || '—')} <small>${esc(x.cls || '')}</small> <small>${HEAT[x.heat] || ''}</small></span>
        <span class="mt">${esc(x.why || '')}${x.status === 'done' ? ` · ✅ ${esc((OUTS.find(o => o[0] === x.outcome) || [0, x.outcome === 'teacher' ? '👩‍🏫 Admin कडे' : x.outcome || ''])[1])}` : ''}${x.lock ? ` · 🔒 ${esc(x.lock)} बोलत आहेत` : ''}</span></button>`).join('')}`,
      '🎯 आजचं काम', `✅ ${done} झाले · बाकी ${items.length - done}`);
    queue = { title: '🎯 आजचं काम', rows: items.filter(x => x.status !== 'done'), i: 0, step: 0, done: 0, sentMob: new Set(), desk: true };
    app.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => {
      if (b.dataset.lock) return toast(`🔒 ${b.dataset.lock} आत्ता बोलत आहेत`, true);
      const i = queue.rows.findIndex(r => r.gid === b.dataset.gid); if (i >= 0) queue.i = i;
      openCard(b.dataset.gid);
    });
  }
  async function startQueue(title, path, step, rows) {
    rows = rows || await crm(path).catch(e => { toast(e.message, true); return []; });
    if (!rows.length) { toast('या यादीत आत्ता कोणी नाही'); return; }
    queue = { title, rows, i: 0, step, done: 0, sentMob: new Set() };
    openCard(rows[0].gid);
  }
  async function nextInQueue() {
    if (!queue) return route();
    if (queue.desk) {   // the day list: fresh from the server (numbers stay), the next one not done
      try { desk = await crm('/crm/desk/home'); } catch { /* keep */ }
      const nx = desk && desk.day && desk.day.next;
      if (!nx) { queue = null; toast('✅ आजची यादी पूर्ण'); return route(); }
      return openCard(nx.gid);
    }
    queue.i++; queue.done++;
    if (queue.i >= queue.rows.length) { const n = queue.done; queue = null; toast(`✅ यादी पूर्ण — ${n}`); return route(); }
    openCard(queue.rows[queue.i].gid);
  }

  // 👨‍👩‍👧 one family — everything at a glance
  const objections = (L, offer) => {
    const p = L.prices || {}, cut = n => Math.round(n * (100 - (offer ? offer.pct : 0)) / 100);
    return [
      ['💸 "फी जास्त आहे"', `${p.yearly ? `वर्षभर ₹${p.yearly} म्हणजे दिवसाला ₹${(p.yearly / 365).toFixed(1)}.` : ''}${offer && p.yearly ? ` आत्ता ${offer.pct}% सूट: वर्षभर ₹${cut(p.yearly)}.` : ''}${p.monthly ? ` Monthly ₹${offer ? cut(p.monthly) : p.monthly} पासून सुरू करता येतं.` : ''}`],
      ['🏫 "क्लास लावलाय"', 'क्लासच्या सोबत रोजचा पेपर, मागच्या वर्षांचे पेपर आणि प्रत्येक प्रश्नाचं स्पष्टीकरण. क्लासमध्ये शिकवलेलं इथे सराव होतं.'],
      ['⏳ "नंतर बघू"', `${offer ? `${offer.pct}% सूट ${left(offer.end)}. ` : ''}आज Monthly घ्या, नंतर वर्षभर करता येतं.`],
      ['📱 "Phone नाही"', 'आई/बाबांच्या phone वर चालतं, internet नसतानाही. एकाच account वर.'],
    ];
  };
  function sayLine(L, offer) {
    const nm = L.name && L.name !== 'तुमचा पाल्य' ? L.name : 'तुमच्या पाल्या';
    const ts = (L.series && L.series.name ? L.series.name + ' Test Series' : seriesName(L.cls)) || 'Test Series';
    const parts = [];
    if (L.checkoutAt || L.paySeenAt) parts.push('Pay चं पान उघडलं होतं — काही अडचण आली का?');
    if (L.last) parts.push(nm + 'ने शेवटच्या test मध्ये ' + L.last.score + '/' + L.last.total + ' घेतले.' + (L.last.weak ? ' ' + L.last.weak + ' कमी पडतं.' : ''));
    else if (!L.testsDone) parts.push(nm + 'ची demo test अजून झाली नाही — आज 10 मिनिटं द्या.');
    parts.push('पूर्ण ' + ts + ' मध्ये रोज सराव आणि प्रत्येक प्रश्नाचं स्पष्टीकरण.');
    if (offer) parts.push(offer.pct + '% सूट ' + left(offer.end) + '.');
    return '"' + parts.join(' ') + '"';
  }
  async function openCard(gid) {
    clearInterval(deskTimer);
    shell('<p class="empty">⏳</p>', queue ? queue.title : 'पालक');
    let d; try { d = await crm('/crm/desk/lead/' + gid); } catch (e) { toast(e.message, true); return queue ? nextInQueue() : route(); }
    if (d.lead && d.lead.tdemo) { const old = await crm('/crm/lead/' + gid).catch(() => null); return old ? teacherCard(gid, old) : route(); }
    const L = d.lead, offer = d.offer, k = L.desk || {}, plan = k.plan || (L.paidInfo && L.paidInfo.amount ? { period: L.paidInfo.period, till: L.paidInfo.till, amount: L.paidInfo.amount } : null);
    const q = L.question && !L.question.answered ? L.question : null;
    const pos = queue && queue.desk && desk ? (desk.day.items.find(x => x.gid === gid) || {}).n : null;
    const lastUse = d.usage && d.usage.last ? ago(d.usage.last) : k.lastLogin ? ago(Date.parse(k.lastLogin)) : '—';
    const hist = [
      ...(d.history || []).map(h => ({ at: h.at, c: 'team', t: `${h.by_name}: ${(d.names && d.names[h.action]) || h.action}${h.detail ? ' — ' + h.detail : ''}` })),
      ...(d.msgs || []).filter(m => m.dir === 'in').slice(-8).map(m => ({ at: m.at, c: 'in', t: 'पालक: ' + String(m.body || '').slice(0, 80) })),
    ].sort((a, b) => b.at - a.at).slice(0, 14);
    shell(`
      <div class="fam-h">
        <div class="nm">${esc(L.name || '—')} <span class="pill">${HEAT[d.heat] || ''}</span></div>
        <div class="mt">${esc((L.series && L.series.name ? L.series.name + ' Test Series' : seriesName(L.cls)) || L.cls || '')}${L.place ? ' · ' + esc(L.place) : ''} · 📱 ${esc(L.mobile || '—')}</div>
        <div class="dk-stage">${STAGES.map((s, i) => `<span class="${i < d.stage ? 'on' : i === d.stage ? 'cur' : ''}" title="${s}"></span>`).join('')}</div>
        <div class="dk-stagel">${STAGES.map(s => `<span>${s}</span>`).join('')}</div>
        <div>${offer ? `<span class="pill offer">🎁 ${offer.pct}% सूट · ${left(offer.end)}</span>` : ''}${k.source || L.ctwaUntil ? `<span class="pill">📣 ${esc(L.ctwaUntil ? 'WhatsApp ad' : k.source)}</span>` : ''}${L.noCall ? '<span class="pill dupe">🔕 Call नको — फक्त WhatsApp</span>' : ''}${(d.siblings || []).map(s => `<span class="pill">👨‍👩‍👧‍👦 ${esc(s.name || '')} ${esc(s.cls || '')}${s.paid ? ' ✅' : ''}</span>`).join('')}</div>
        ${d.lock ? `<div class="dk-lock">🔒 ${esc(d.lock.name)} आत्ता बोलत आहेत — ${hm(d.lock.until)} पर्यंत</div>` : ''}
        ${L.lastTeam ? `<div class="mt">शेवटचं: ${esc(L.lastTeam.by)} — ${esc((d.names && d.names[L.lastTeam.result]) || L.lastTeam.result || '')}${L.lastTeam.reason ? ' · ' + esc(L.lastTeam.reason) : ''} (${ago(Date.parse(L.lastTeam.at))})</div>` : ''}
        ${d.discReq ? `<div class="mt">🎁 ${d.discReq.pct}% — Admin च्या परवानगीची वाट</div>` : ''}
      </div>
      <div class="dk-facts">
        <div><small>💳 Plan</small><b class="${L.paid ? 'good' : 'mid'}">${L.paid ? `${plan && plan.period === 'yearly' ? 'Yearly' : plan && plan.period === 'monthly' ? 'Monthly' : 'Paid'}${plan && plan.till ? ' · ' + new Date(plan.till).toLocaleDateString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short' }) + ' पर्यंत' : ''}${plan && plan.amount ? ' · ₹' + plan.amount : ''}` : 'Free (demo)'}</b></div>
        <div><small>📲 App</small><b class="${L.app ? 'good' : 'low'}">${L.app ? 'Install ✓' + (k.bound ? ' · phone शी जोडलेलं' : '') : (L.acct && L.acct.code ? 'Code आहे, app नाही' : 'नाही')}</b></div>
        <div><small>🕒 App शेवटचं</small><b>${esc(lastUse)}</b></div>
        <div><small>🔔 Notifications</small><b class="${L.pushOn ? 'good' : 'mid'}">${L.pushOn ? 'चालू' : 'बंद / माहीत नाही'}</b></div>
        <div><small>📝 Tests</small><b>${L.testsDone || 0}${L.last ? ' · शेवटचे ' + esc(L.last.score + '/' + L.last.total) : ''}</b></div>
        <div><small>📉 कमकुवत</small><b>${esc((L.last && L.last.weak) || '—')}</b></div>
        <div><small>👤 Code · PIN</small><b>${L.acct && L.acct.code ? esc(L.acct.code + ' · ' + (L.acct.pin || 'त्यांचा')) : '—'}</b></div>
        <div><small>🕗 Call ची योग्य वेळ</small><b>${esc(d.best || '—')}</b></div>
      </div>
      <div class="dk-say"><small>बोलताना सांगा</small>${esc(sayLine(L, offer))}</div>
      ${q ? `<div class="box qbox"><h3>❓ पालकांचा प्रश्न <small>${ago(Date.parse(q.at))}</small></h3><div class="qt">"${esc(q.text)}"</div><p class="mt">Call करून किंवा 💬 Chat मधून उत्तर द्या.</p></div>` : ''}
      <details class="box"><summary><b>💬 पालक म्हणाले तर… (तयार उत्तरं)</b></summary><div class="dk-obj">${objections(L, offer).map(o => `<details><summary>${o[0]}</summary><p>${esc(o[1])}</p></details>`).join('')}</div></details>
      ${L.mobile ? `<div class="acts3" style="grid-template-columns:1fr 1fr">
        <a class="btn call" id="c-call" href="tel:+91${esc(L.mobile)}">📞 Call</a>
        <button type="button" class="btn wa" id="c-chat">💬 Chat / Message</button>
      </div>` : '<p class="empty">या पालकांचा नंबर नाही.</p>'}
      ${!L.paid && !L.closed ? `<div class="outs" style="margin-top:8px"><button type="button" class="btn ghost" id="c-result">✅ निकाल लिहा</button><button type="button" class="btn ghost" id="c-teacher">👩‍🏫 हा शिक्षक आहे</button></div>` : ''}
      ${queue && queue.desk ? '<button type="button" class="btn ghost" id="c-skip" style="width:100%;margin-top:8px">⏭ नंतर (आज) — पुढचा</button>' : ''}
      <details class="box"><summary><b>🕒 इतिहास — कोणी, कधी, काय</b></summary><div class="dk-tl">${hist.map(h => `<div class="${h.c}"><time>${new Date(h.at).toLocaleString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>${esc(h.t)}</div>`).join('') || '<p class="mt">अजून नाही</p>'}</div></details>`,
      pos ? `#${pos} / ${desk.day.total}` : (queue ? queue.title : 'पालक'), L.name || '');
    $('fab')?.classList.add('hidden');
    // 📞: recorded at once (+ the lock); back in the app → "काय झालं?"
    $('c-call')?.addEventListener('click', async e => {
      try { await crm('/crm/desk/attempt/' + gid, { via: 'call' }); }
      catch (err) { e.preventDefault(); return toast(err.message, true); }
      pendingOutcome = { gid, L };
    });
    $('c-chat')?.addEventListener('click', () => chatScreen(gid, d));
    $('c-result')?.addEventListener('click', () => deskOutcome(gid, L));
    $('c-teacher')?.addEventListener('click', () => teacherFwd(gid, L));
    $('c-skip')?.addEventListener('click', async () => { await crm('/crm/desk/skip/' + gid, { why: 'नंतर' }).catch(() => {}); nextInQueue(); });
  }
  // back from the phone call / WhatsApp → the outcome is asked before anything else
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pendingOutcome && !document.querySelector('.sheet-bg')) { const p = pendingOutcome; setTimeout(() => deskOutcome(p.gid, p.L), 400); } });

  // 💬 the family's WhatsApp chat + ready messages (or ✍️ your own) + the discount
  function chatScreen(gid, d) {
    const L = d.lead, open = d.open, R = (desk && desk.rules) || { staffDisc: [20, 30] };
    let offer = d.offer, kind = 'pay', btn = 'pay';
    const nm = L.name && L.name !== 'तुमचा पाल्य' ? L.name : 'तुमच्या पाल्या';
    const ts = (L.series && L.series.name ? L.series.name + ' Test Series' : seriesName(L.cls)) || 'Test Series';
    const p = L.prices || {}, cut = n => Math.round(n * (100 - (offer ? offer.pct : 0)) / 100);
    const price = () => [p.monthly ? `Monthly ₹${p.monthly}${offer ? ' → ₹' + cut(p.monthly) : ''}` : '', p.yearly ? `Yearly ₹${p.yearly}${offer ? ' → ₹' + cut(p.yearly) : ''}` : ''].filter(Boolean).join(' · ');
    const link = `${SITE}/p/${gid}`, viaBot = () => open;
    const READY = {
      own: () => '',
      pay: () => `नमस्कार 🙏 ${nm}साठी पूर्ण ${ts}:\n${price()}${offer ? `\n🎁 ${offer.pct}% सूट — ${left(offer.end)}` : ''}\n👇 ${viaBot() ? 'खालचं बटण दाबा आणि pay करा' : 'या link वर दाबा आणि pay करा\n' + link}`,
      pin: () => L.acct && L.acct.code ? `नमस्कार 🙏 ${nm}चं app account:\n👤 Code: *${L.acct.code}*\n🔑 PIN: *${L.acct.pin || 'तुमचा आधीचाच'}*\nApp उघडा → Login → Code आणि PIN टाका.` : '',
      app: () => `नमस्कार 🙏 ${nm}साठी app मध्ये पुढच्या tests आणि रोजची आठवण.\n👇 ${viaBot() ? 'खालचं बटण दाबा आणि app download करा' : 'App: ' + PLAY}`,
      test: () => `नमस्कार 🙏 ${nm}साठी demo test (10 मिनिटं) 👇\n${SITE}/student-app/?free=1&g=${gid}`,
      info: () => `🎯 ${ts}\n${(L.series && L.series.lines ? L.series.lines.filter(x => !/^💳/.test(x)).slice(0, 6) : []).join('\n')}${price() ? '\n💳 ' + price() : ''}\n👇 ${viaBot() ? 'खालचं बटण दाबा आणि pay करा' : link}`,
      mt: () => `🏆 महा-Test ची link — याच link वरून द्यायचा 👇\n${SITE}/student-app/?free=1&g=${gid}`,
    };
    const BTN = { pay: 'pay', info: 'pay', app: 'app' };
    const bubbles = (d.msgs || []).filter(m => ['in', 'out', 'team'].includes(m.dir)).slice(-40).map(m => {
      let b = m.body || '', extra = '';
      if (m.dir === 'out' && b.startsWith('{')) { try { const i = JSON.parse(b); b = i.body?.text || b; extra = i.action?.parameters?.display_text ? `<span class="dk-mbtn">${esc(i.action.parameters.display_text)}</span>` : (i.action?.buttons || []).map(x => `<span class="dk-mbtn">${esc(x.reply.title)}</span>`).join(' '); } catch {} }
      return `<div class="dk-msg ${m.dir}">${esc(b)}${extra}<time>${new Date(m.at).toLocaleString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${m.dir === 'in' ? 'पालक' : m.dir === 'team' ? 'team' : '🤖 bot'}</time></div>`;
    }).join('');
    const teamPcts = () => { const o = (offerCfg && offerCfg.data && offerCfg.data.team_percents) || [20, 30, 50]; return [...new Set([...R.staffDisc, ...o])].sort((a, b) => a - b); };
    const draw = () => {
      shell(`
        <div class="dk-win ${open ? 'open' : 'shut'}">${open ? '🟢 Bot chat उघडी — bot च्या नंबरवरून मोफत, खऱ्या बटणासह' : '🔴 Bot chat बंद — फक्त माझ्या WhatsApp वरून'}</div>
        <div class="dk-chat" id="dk-chat">${bubbles || '<p class="mt">अजून chat नाही</p>'}</div>
        <div class="h2">तयार message — एक दाबा</div>
        <div class="dk-quick">${[['own', '✍️ स्वतः लिहा'], ['pay', '💳 Pay link'], ['pin', '🔑 Code + PIN'], ['app', '📲 App Download'], ['test', '📝 Test link'], ['info', 'ℹ️ माहिती'], ['mt', '🏆 महा-Test']].map(([k, l]) => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${!L.paid ? `<div class="h2">🎁 सूट (3 तास · पहिल्या payment वर)</div><div class="dk-disc">${teamPcts().map(x => `<button type="button" data-p="${x}" class="${R.staffDisc.includes(x) ? '' : 'ask'}${offer && offer.pct === x ? ' on' : ''}">${x}%${R.staffDisc.includes(x) ? '' : ' · Admin'}</button>`).join('')}</div>` : ''}
        <textarea class="in" id="dk-text" rows="6" placeholder="इथे लिहा…" style="margin-top:10px"></textarea>
        ${kind === 'pin' && !(L.acct && L.acct.code) ? '<button type="button" class="btn ghost" id="dk-pin" style="width:100%;margin-top:8px">🔑 Code + PIN बनवा / मिळवा</button>' : ''}
        <div class="outs" style="margin-top:8px">
          ${open ? '<button type="button" class="btn pri" id="dk-bot">🤖 Bot मधून (मोफत)</button>' : ''}
          <a class="btn wa" id="dk-wa" target="_blank" rel="noopener"${open ? '' : ' style="grid-column:1/-1"'}>💬 माझ्या WhatsApp वरून</a>
        </div>`, '💬 ' + (L.name || ''), L.mobile ? '📱 ' + L.mobile : '');
      $('fab')?.classList.add('hidden');
      const ta = $('dk-text'), wa = $('dk-wa');
      ta.value = READY[kind]();
      const links = () => { wa.href = `https://wa.me/91${L.mobile}?text=${encodeURIComponent(ta.value)}`; };
      ta.oninput = links; links();
      if (kind === 'own') setTimeout(() => ta.focus(), 50);   // ✍️ an empty box, the keyboard open
      const ch = $('dk-chat'); if (ch) ch.scrollTop = ch.scrollHeight;
      app.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kind = b.dataset.k; btn = BTN[kind] || ''; draw(); });
      app.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
        const pct = Number(b.dataset.p);
        if (!R.staffDisc.includes(pct)) { try { await crm('/crm/desk/disc/' + gid, { pct, why: 'card' }); toast(`🎁 ${pct}% — Admin ला विचारलं`); } catch (e) { toast(e.message, true); } return; }
        b.disabled = true;
        try {
          const r = (await rq('/guest/admin/team-offer', { body: { gid, percent: pct } })).data;
          offer = { pct, end: r.expires_at }; kind = 'pay'; btn = 'pay';
          crm(`/crm/lead/${gid}/act`, { action: 'offer', detail: `${pct}% · ${r.hours || 3} तास` }).catch(() => {});
          toast(`🎁 ${pct}% सूट — ${r.hours || 3} तास`); draw();
        } catch (e) { toast(e.message, true); b.disabled = false; }
      });
      $('dk-pin')?.addEventListener('click', async () => {
        try { const r = await rq('/guest/admin/lead-pin', { body: { gid } }); L.acct = { code: r.data.code, pin: r.data.pin }; crm(`/crm/lead/${gid}/act`, { action: 'acct', detail: r.data.code }).catch(() => {}); draw(); }
        catch (e) { toast(e.message, true); }
      });
      $('dk-bot')?.addEventListener('click', async () => {
        const text = ta.value.trim(); if (!text) return toast('Message लिहा', true);
        $('dk-bot').disabled = true;
        try { await crm('/crm/desk/attempt/' + gid, { via: 'wa' }).catch(() => {}); await crm(`/crm/lead/${gid}/reply`, { text, btn }); toast('📤 Bot मधून गेलं'); deskOutcome(gid, L); }
        catch (e) { toast(e.message, true); $('dk-bot').disabled = false; }
      });
      wa.addEventListener('click', () => {
        crm('/crm/desk/attempt/' + gid, { via: 'wa' }).catch(() => {});
        crm(`/crm/lead/${gid}/sent`, { via: 'wa', tpl: kind, tpl_id: kind, text: ta.value }).catch(() => {});
        pendingOutcome = { gid, L };
      });
    };
    loadOfferCfg().finally(draw);
  }

  // ✅ "काय झालं?" — required; the next contact is set by the server's rules
  const OUTS = [['talk', '✅ बोललो', 'पुन्हा 2 दिवसांनी'], ['paying', '💳 Pay करणार', 'pay link + उद्या तपासणी'], ['noanswer', '📵 उचलला नाही', 'संध्याकाळी / उद्या'], ['later', '⏰ नंतर', 'दिवस + वेळ'], ['nocall', '🔕 Call नको', 'फक्त WhatsApp'], ['wrong', '☎️ नंबर चुकीचा', 'बंद'], ['no', '❌ नको', 'कारण निवडा']];
  function deskOutcome(gid, L) {
    pendingOutcome = null;
    document.querySelector('.sheet-bg')?.remove();
    const R = (desk && desk.rules && desk.rules.reasons) || {};
    let pick = null, reason = '';
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    const draw = () => {
      const rs = pick && R[pick === 'talk' ? 'talk' : pick];
      bg.innerHTML = `<div class="sheet" role="dialog" aria-label="काय झालं?">
        <h3>📞 ${esc(L.name || '')} — काय झालं?</h3>
        <div class="outs">${OUTS.map(o => `<button type="button" class="btn ${pick === o[0] ? 'pri' : 'ghost'} dk-out" data-o="${o[0]}">${o[1]}<small>${o[2]}</small></button>`).join('')}</div>
        ${rs && rs.length ? `<div class="h2">${pick === 'no' ? 'कारण (बंधनकारक)' : 'काय ठरलं'}</div><div class="dk-reasons">${rs.map(r => `<button type="button" data-r="${esc(r)}" class="${reason === r ? 'on' : ''}">${esc(r)}</button>`).join('')}</div>` : ''}
        ${pick === 'later' ? '<label class="f">कधी<input class="in" id="o-at" type="datetime-local"></label>' : ''}
        <label class="f">एक ओळ (हवं तर)<input class="in" id="o-note" maxlength="200" placeholder="उदा. वडिलांशी बोलून सांगणार"></label>
        <p class="msg" id="o-msg"></p>
        <button type="button" class="btn pri" id="o-save" style="width:100%"${!pick || (pick === 'no' && !reason) ? ' disabled' : ''}>✅ Save करा</button>
        <p class="mt" style="text-align:center">निकाल दिल्याशिवाय पुढचं कुटुंब उघडत नाही.</p></div>`;
      bg.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { pick = b.dataset.o; reason = ''; draw(); });
      bg.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { reason = b.dataset.r; draw(); });
      const atEl = bg.querySelector('#o-at');
      if (atEl && !atEl.value) { const t = new Date(Date.now() + 864e5); t.setHours(11, 0, 0, 0); atEl.value = new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
      bg.querySelector('#o-save').onclick = async () => {
        const save = bg.querySelector('#o-save'); save.disabled = true;
        try {
          const at = atEl && atEl.value ? new Date(atEl.value).toISOString() : '';
          const r = await crm('/crm/desk/outcome/' + gid, { result: pick, reason, note: bg.querySelector('#o-note').value.trim(), at });
          bg.remove();
          toast({ talk: '✅ नोंद — पुन्हा 2 दिवसांनी', paying: '💳 नोंद — pay link पाठवा', noanswer: '📵 पुन्हा संध्याकाळी / उद्या', later: '⏰ आठवण लावली', nocall: '🔕 आता फक्त WhatsApp', wrong: '☎️ बंद केलं', no: '❌ बंद केलं' }[pick]);
          if (pick === 'paying' && r && r.team && r.team[0] && r.team[0].waMe) window.open(r.team[0].waMe, '_blank');
          if (queue) nextInQueue(); else route();
        } catch (e) { save.disabled = false; bg.querySelector('#o-msg').textContent = e.message; }
      };
    };
    draw();
    document.body.appendChild(bg);
  }
  // 👩‍🏫 a teacher, not a parent → the Admin
  function teacherFwd(gid, L) {
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="शिक्षक"><h3>👩‍🏫 ${esc(L.name || '')} — शिक्षक</h3>
      <label class="f">एक ओळ (Admin साठी)<input class="in" id="t-note" maxlength="200" placeholder="उदा. 8वी, 40 विद्यार्थी · पेपर बनवायचा"></label>
      <div class="outs"><button type="button" class="btn ghost" id="t-cancel">रद्द</button><button type="button" class="btn pri" id="t-go">👩‍🏫 Admin कडे पाठवा</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('#t-cancel').onclick = () => bg.remove();
    bg.querySelector('#t-go').onclick = async () => {
      try { await crm('/crm/desk/teacher/' + gid, { note: bg.querySelector('#t-note').value.trim() }); bg.remove(); toast('👩‍🏫 Admin कडे गेलं'); if (queue) nextInQueue(); else route(); }
      catch (e) { toast(e.message, true); }
    };
  }

  // ── 👩‍🏫 a teacher who booked a demo from a teacher ad (owner 2026-11-20) ──
  // the codes (to read out on the call), how far they got, teacher messages, and the call result
  // 👩‍🏫 Teacher Guide (wa-worker waFlow.js TSTEPS): the 7 steps, their pages, and what to say on a call
  const TSTEPS = [
    ['login', 'Login', 'App उघडा → वरती 👩‍🏫 Teacher निवडा → Code आणि PIN. Code मोठ्या अक्षरात.'],
    ['paper', 'पेपर', 'वरचं ▾ menu → 📄 Paper → आधी वर्ग, मग विषय — धडे येतील → पेपर बनवा → PDF + Answer key. 1 मिनिट.'],
    ['students', 'विद्यार्थी', '▾ → 👨‍🎓 Students मध्ये demo विद्यार्थी दिसतो. वर्गाची link / QR: ▾ → 📤 Share.'],
    ['student', 'विद्यार्थी test', 'वरती नाव (Profile) → ↔ Switch Account → 🎓 Student → demo विद्यार्थ्याचा Code + PIN → एक धडा → Test.'],
    ['analytics', 'Analytics', 'परत Switch Account → 👩‍🏫 Teacher → ▾ → 📊 Analytics — गुण आणि कमकुवत धडे.'],
    ['tour', 'Videos · Notify · Fee', '🎬 Videos — त्यांचे YouTube videos फक्त त्यांच्या मुलांना · 🔔 Notify — पालकांना सूचना · 💰 Fee.'],
    ['offer', 'खास सूट', '▾ → ➕ Students बनवा — शिक्षकांसाठी खास सूट. सूट किती ते Admin ने ठरवलेलं (Admin › Teachers).'],
  ];
  const TEACHER_TPLS = [
    { id: 't-step', title: '📷 पुढची step — चित्रांसह', text: 'नमस्कार {नाव} 🙏 पुढची step: *{step}* — कसं करायचं ते चित्रांसह 👇\nhttps://nkseduorbit.in/teacher-guide#{stepid}' },
    { id: 't-login', title: '🔑 Login मदत (codes)', text: 'नमस्कार {नाव} 🙏 NKs EduOrbit कडून.\nApp 👇 {app}\nApp उघडा › 👩‍🏫 Teacher › Code *{tcode}*{tpin}\nविद्यार्थी account (रविवारपर्यंत): Code *{scode}*{spin}\nकाही अडचण आली तर याच नंबरवर कळवा.' },
    { id: 't-sut', title: '🎁 शिक्षकांसाठी खास सूट', text: 'नमस्कार {नाव} 🙏 तुमच्या विद्यार्थ्यांची accounts ▾ → ➕ Students बनवा मधून घ्या — शिक्षकांसाठी *खास सूट*.\nमाहिती आणि मदत: 📞 8390484545' },
    { id: 't-paper', title: '📄 पेपर 1 मिनिटात', text: 'नमस्कार {नाव} 🙏 तुमच्या वर्गाचा पेपर 1 मिनिटात बनवा: Teacher › Paper › विषय आणि धडे निवडा › पेपर + Answer sheet. Print करून विद्यार्थ्यांना द्या.' },
    { id: 't-demo', title: '📝 Demo विद्यार्थ्याचा test', text: 'नमस्कार {नाव} 🙏 School demo विद्यार्थी (Code *{scode}*) ने एका धड्याचा test द्या — त्याचे गुण आणि कमकुवत धडे Teacher › Analytics मध्ये दिसतील. तुमच्या प्रत्येक विद्यार्थ्याचे असेच दिसतील.' },
    { id: 't-add', title: '👩‍🎓 विद्यार्थी जोडा', text: 'नमस्कार {नाव} 🙏 तुमच्या विद्यार्थ्यांची accounts: Teacher › ➕ Students बनवा — नावं आणि नंबर टाका, पैसे भरले की codes चा PDF लगेच. सूट साठी आमच्याशी बोला.' },
    { id: 't-link', title: '🔗 वर्गाची link / QR', text: 'नमस्कार {नाव} 🙏 Teacher › Share मधली तुमच्या वर्गाची link / QR विद्यार्थ्यांना पाठवा — ते थेट तुमच्याशी जोडले जातात.' },
  ];
  function teacherCard(gid, d) {
    const L = d.lead, t = L.tdemo || {};
    const when = x => (x ? new Date(x).toLocaleString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
    const step = (ok, text) => `<span class="pill" style="opacity:${ok ? 1 : .45}">${ok ? '✅' : '⬜'} ${esc(text)}</span>`;
    const qr = queue && queue.rows[queue.i] && queue.rows[queue.i].gid === gid ? queue.rows[queue.i] : null;
    const cur = t.doneAt || t.orderAt ? TSTEPS.length : Math.min(t.step || 0, TSTEPS.length);
    const inSteps = t.stage === 'steps' && !t.doneAt && !t.orderAt;
    const pick = inSteps ? (cur >= TSTEPS.length - 1 ? 't-sut' : 't-step') : t.orderAt ? 't-link' : t.paperAt ? 't-add' : t.tLogin ? 't-paper' : 't-login';
    const strip = TSTEPS.map(([, n], i) => `<span class="pill" style="opacity:${i < cur ? 1 : i === cur ? 1 : .45};${i === cur && inSteps ? 'outline:2px solid ' + (t.stuck ? '#b45309' : '#4338ca') : ''}">${i < cur ? '✅' : i === cur && inSteps ? (t.stuck ? '⚠️' : '⏳') : '⬜'} ${esc(n)}</span>`).join(' ');
    shell(`
      <div class="fam-h">
        <div class="nm">👩‍🏫 ${esc(L.name || '—')}</div>
        <div class="mt">🏫 ${esc(t.school || '—')} · 📱 ${esc(L.mobile || '—')}</div>
        <div class="mt">📚 ${esc(t.course || '')}${t.ad ? ' · 📣 ad ' + esc(t.ad) : ''} · बुक: ${esc(when(t.bookedAt))}</div>
        <div class="mt">👩‍🏫 शिक्षक code <b>${esc(t.tCode || '')}</b>${t.tPin ? ' · PIN <b>' + esc(t.tPin) + '</b>' : ''} · 🎓 demo विद्यार्थी <b>${esc(t.sCode || '')}</b>${t.sPin ? ' · PIN <b>' + esc(t.sPin) + '</b>' : ''}</div>
        <div class="mt" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${t.stage ? strip : `${step(t.welcomedAt, 'WhatsApp')} ${step(t.tLogin, 'शिक्षक login')} ${step(t.sLogin, 'demo विद्यार्थी login')} ${step(t.paperAt, 'पेपर' + (t.papers ? ' ' + t.papers : ''))} ${step(t.sTestAt, 'demo test')} ${step(t.orderAt, 'विद्यार्थी जोडले' + (t.added ? ' ' + t.added : ''))}`}</div>
        ${t.stage === 'cls' || t.stage === 'name' ? '<div class="mt">💬 Bot ला वर्ग / नाव सांगत आहेत</div>' : t.stage === 'making' ? '<div class="mt">⏳ Account बनत आहे</div>' : ''}
        ${t.until ? `<div class="mt">🎓 Demo विद्यार्थी ${new Date(t.until) > new Date() ? esc(when(t.until)) + ' पर्यंत' : 'बंद झाला'}${t.papers ? ' · 📄 ' + t.papers + ' पेपर' : ''}${t.added ? ' · 👨‍🎓 ' + t.added + ' विद्यार्थी' : ''}</div>` : ''}
        ${t.stuck && inSteps ? `<div class="why"><b>⚠️ Step ${t.stuck.step + 1} · ${esc(t.stuck.title || '')} — अडकले</b><span>${esc(t.callWhy || '')}</span></div>` : t.callWhy && L.crm === 'call' ? `<div class="why"><b>📞 ${esc(t.callWhy)}</b></div>` : ''}
        ${inSteps && TSTEPS[cur] ? `<div class="box" style="margin:8px 0 0"><h3>💡 बोलताना सांगा — Step ${cur + 1}: ${esc(TSTEPS[cur][1])}</h3><p class="mt">${esc(TSTEPS[cur][2])}</p></div>` : ''}
        ${L.lastTeam ? `<div class="mt">शेवटचं: ${esc(L.lastTeam.by)} — ${esc(L.lastTeam.reason || L.lastTeam.result)} (${ago(Date.parse(L.lastTeam.at))})</div>` : ''}
        ${qr && qr.why ? `<div class="why"><b>${esc(qr.why)}</b><span>⏰ ${esc(qr.when || '')}</span></div>` : ''}
        ${d.open ? '<div class="mt"><span class="pill open">🟢 Bot chat उघडी — bot मधून मोफत message पाठवता येतो</span></div>' : ''}
      </div>
      <div class="acts3">
        <a class="btn call" href="tel:+91${esc(L.mobile)}">📞 Call</a>
        <a class="btn wa" id="t-wa" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="btn sms" id="t-sms">✉️ SMS</a>
      </div>
      <div class="box"><h3>💬 Message</h3>
        <select class="in" id="t-tpl" aria-label="Message">${TEACHER_TPLS.map(x => `<option value="${x.id}"${x.id === pick ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
        <textarea class="in" id="t-text" style="margin-top:8px" aria-label="मजकूर"></textarea>
        ${d.open ? '<button type="button" class="btn pri" id="t-bot" style="width:100%;margin-top:8px">🤖 Bot च्या WhatsApp मधून पाठवा (मोफत)</button>' : ''}
      </div>
      ${L.closed ? '' : `<div class="box"><h3>📞 Call नंतर — निकाल</h3>
        <div class="outs">
          ${inSteps && cur < TSTEPS.length - 1 ? `<button type="button" class="btn ok wide" id="t-stepdone">✅ Step ${cur + 1} पूर्ण करून दिली → bot पुढची step पाठवेल</button>` : ''}
          <button type="button" class="btn ok wide" data-tout="next">✅ बोललो</button>
          <button type="button" class="btn warn" data-tout="later">⏰ नंतर</button>
          <button type="button" class="btn ghost" data-tout="noanswer">📵 उचलला नाही</button>
          <button type="button" class="btn bad" data-tout="close">❌ नको</button>
        </div></div>`}
      ${queue ? '<button type="button" class="btn ghost" id="t-skip" style="width:100%">⏭ हा नंतर — पुढचा शिक्षक</button>' : ''}
      <details class="box"><summary><b>💬 Chat / नोंदी</b></summary>
        <div class="chat">${(d.msgs || []).slice(-60).map(m => { let b = m.body || ''; if (m.dir === 'out' && b.startsWith('{')) { try { b = JSON.parse(b).body?.text || b; } catch {} } const c = { in: 'in', out: 'out', team: 'team' }[m.dir] || 'log'; return `<div class="cm ${c}">${esc(b)}<small>${esc(when(m.at))}</small></div>`; }).join('') || '<p class="mt">अजून नाही</p>'}</div>
      </details>`, queue ? `${queue.title} · ${queue.i + 1}/${queue.rows.length}` : 'शिक्षक', L.name || '');
    $('fab')?.classList.add('hidden');
    const sel = $('t-tpl'), ta = $('t-text'), wa = $('t-wa'), sms = $('t-sms');
    const fillT = x => x.replace(/\{step\}/g, TSTEPS[cur] ? `Step ${cur + 1} — ${TSTEPS[cur][1]}` : '').replace(/\{stepid\}/g, TSTEPS[cur] ? TSTEPS[cur][0] : 'login').replace(/\{नाव\}/g, L.name || 'सर / मॅडम').replace(/\{app\}/g, 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student')
      .replace(/\{tcode\}/g, t.tCode || '').replace(/\{scode\}/g, t.sCode || '')
      .replace(/\{tpin\}/g, t.tPin ? ' · PIN *' + t.tPin + '*' : ' · PIN: तुम्ही ठेवलेला').replace(/\{spin\}/g, t.sPin ? ' · PIN *' + t.sPin + '*' : '');
    const links = () => { wa.href = `https://wa.me/91${L.mobile}?text=${encodeURIComponent(ta.value)}`; sms.href = `sms:+91${L.mobile}?body=${encodeURIComponent(ta.value)}`; };
    const showT = () => { ta.value = fillT((TEACHER_TPLS.find(x => x.id === sel.value) || TEACHER_TPLS[0]).text); links(); };
    sel.onchange = showT; ta.oninput = links; showT();
    const sentT = via => () => { crm(`/crm/lead/${gid}/sent`, { via, tpl: sel.selectedOptions[0]?.textContent || '', tpl_id: sel.value, text: ta.value }).catch(() => {}); };
    wa.addEventListener('click', sentT('wa')); sms.addEventListener('click', sentT('sms'));
    $('t-bot')?.addEventListener('click', async () => { const b = $('t-bot'); b.disabled = true; try { await crm(`/crm/lead/${gid}/reply`, { text: ta.value.trim() }); toast('📤 Bot मधून गेलं'); teacherCard(gid, await crm('/crm/lead/' + gid)); } catch (e) { toast(e.message, true); b.disabled = false; } });
    $('t-skip')?.addEventListener('click', () => { queue.i++; if (queue.i >= queue.rows.length) { queue = null; return route(); } openCard(queue.rows[queue.i].gid); });
    app.querySelectorAll('[data-tout]').forEach(b => b.onclick = () => outcomeSheet(b.dataset.tout, L));
    $('t-stepdone')?.addEventListener('click', async () => {
      const b = $('t-stepdone'); b.disabled = true;
      try { await crm('/crm/desk/tstep/' + gid, {}); toast('✅ Bot ने पुढची step पाठवली'); teacherCard(gid, await crm('/crm/lead/' + gid)); }
      catch (e) { toast(e.message, true); b.disabled = false; }
    });
  }

  const REASONS_T = {
    next: ['App मध्ये login करून दाखवलं', 'पेपर बनवून दाखवला', 'विद्यार्थी जोडणार', 'नंतर विचार करणार'],
    close: ['गरज नाही', 'दुसरं app वापरतात', 'शिकवत नाहीत', 'नंबर चुकीचा', 'इतर'],
  };
  const REASONS = {
    next: ['पालक बोलले — test देणार', 'Code + PIN दिला', 'माहिती पाठवली', 'नंतर विचार करणार'],
    close: ['फी जास्त', 'दुसरा क्लास', 'पाल्याला वेळ नाही', 'Phone नाही', 'नंबर चुकीचा', 'इतर'],
  };
  function outcomeSheet(res, L) {
    const titles = { next: '✅ बोललो → पुढची Step', paying: '💳 Pay करणार', later: '⏰ नंतर call', noanswer: '📵 उचलला नाही', close: '❌ नको — बंद' };
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(titles[res])}">
      <h3>${titles[res]} — ${esc(L.name || '')}</h3>
      ${(L.tdemo ? REASONS_T : REASONS)[res] ? `<div class="reasons">${(L.tdemo ? REASONS_T : REASONS)[res].map(r => `<button type="button">${esc(r)}</button>`).join('')}</div>` : ''}
      ${res === 'later' ? '<label class="f">कधी call करायचा?<input type="date" class="in" id="o-at"></label>' : ''}
      <label class="f">${res === 'next' || res === 'close' ? 'कारण / काय बोललो *' : 'Note (हवं तर)'}<textarea class="in" id="o-reason" rows="3" maxlength="200"></textarea></label>
      <p class="msg" id="o-msg"></p>
      <div class="outs"><button type="button" class="btn ghost" id="o-cancel">रद्द</button><button type="button" class="btn pri" id="o-save">✅ Save</button></div></div>`;
    document.body.appendChild(bg);
    const ta = bg.querySelector('#o-reason');
    bg.querySelectorAll('.reasons button').forEach(b => b.onclick = () => { bg.querySelectorAll('.reasons button').forEach(x => x.classList.remove('on')); b.classList.add('on'); ta.value = b.textContent; bg.querySelector('#o-msg').textContent = ''; });
    bg.querySelector('#o-cancel').onclick = () => bg.remove();
    bg.onclick = e => { if (e.target === bg) bg.remove(); };
    if (res === 'later') { const t = new Date(Date.now() + 864e5); bg.querySelector('#o-at').value = t.toISOString().slice(0, 10); }
    bg.querySelector('#o-save').onclick = async () => {
      const reason = ta.value.trim();
      if ((res === 'next' || res === 'close') && reason.length < 2) { bg.querySelector('#o-msg').textContent = 'कारण / काय बोललो ते लिहा (वरचं एखादं निवडा)'; return; }
      const save = bg.querySelector('#o-save'); save.disabled = true;
      try {
        const at = res === 'later' ? bg.querySelector('#o-at').value : '';
        const r = await crm(`/crm/lead/${L.gid}/outcome`, { result: res, reason, at });
        bg.remove();
        toast({ next: '✅ पुढच्या Step मध्ये', paying: '💳 नोंद — pay link पाठवा', later: '⏰ नंतरच्या call ची नोंद', noanswer: '📵 उद्या पुन्हा', close: '❌ बंद केलं' }[res]);
        // "pay करणार": the pay link ready on WhatsApp
        if (res === 'paying' && r?.team?.[0]?.waMe) window.open(r.team[0].waMe, '_blank');
        if (queue) nextInQueue(); else openCard(L.gid);
      } catch (e) { save.disabled = false; bg.querySelector('#o-msg').textContent = e.message; }
    };
  }

  // 🔍 search
  function search() {
    shell(`<input class="in" id="s-q" type="search" placeholder="🔍 नाव किंवा नंबर" autofocus><div id="s-rows" style="margin-top:10px"></div>`, 'शोध');
    let t; $('s-q').oninput = e => { clearTimeout(t); t = setTimeout(async () => {
      const q = e.target.value.trim(); if (q.length < 2) { $('s-rows').innerHTML = ''; return; }
      const rows = await crm(`/crm/list?list=all&q=${encodeURIComponent(q)}`).catch(() => []);
      $('s-rows').innerHTML = rows.length ? rowsHtml(rows) : '<p class="empty">कोणी सापडलं नाही</p>';
      wireRows($('s-rows'));
    }, 350); };
  }
  function rowsHtml(rows) {
    const byMob = {}; rows.forEach(r => { if (r.mobile) byMob[r.mobile] = (byMob[r.mobile] || 0) + 1; });
    return rows.map(r => `<button type="button" class="row" style="--c:${r.question ? '#be123c' : r.paid ? '#15803d' : r.closed ? '#64748b' : '#4338ca'}" data-gid="${esc(r.gid)}">
      <span class="nm">${esc(r.name || '—')} <small>${esc(r.cls || '')}</small></span>
      <span class="mt">📱 ${esc(r.mobile || '—')} · 📝 ${r.tests || 0}/${r.free_total || 0}${r.pay ? ` · <b style="color:#b91c1c">💳 ${r.pay.checkout ? 'Pay दाबलं, पूर्ण नाही' : r.pay.bot ? 'Course मागितला' : 'Pay पान उघडलं' + (r.pay.n > 1 ? ' ' + r.pay.n + ' वेळा' : '')} · ${ago(Date.parse(r.pay.at))}</b>` : ''}${r.open ? ' · 🟢 Bot chat' : ''}${r.app ? ' · 📲 app' : ''}${r.paid ? ' · ✅ Paid' : ''}${r.fu_step ? ` · 📋 Step ${r.fu_step} · ${dueText(r.fu_due)}` : ''}</span>
      ${r.question ? `<span class="q">❓ "${esc(r.question.text)}" · ${ago(Date.parse(r.question.at))}</span>` : ''}
      ${r.offer ? `<span><span class="pill offer">🎁 ${r.offer.pct}% सूट · ${left(r.offer.end)}</span></span>` : ''}
      ${r.mobile && byMob[r.mobile] > 1 ? '<span><span class="pill dupe">🔁 हा नंबर दोन नोंदींमध्ये</span></span>' : ''}
    </button>`).join('');
  }
  function wireRows(box) { box.querySelectorAll('[data-gid]').forEach(b => b.onclick = () => { queue = null; openCard(b.dataset.gid); }); }

  // ❓ questions
  async function questions() {
    shell('<p class="empty">⏳</p>', 'प्रश्न');
    const rows = await crm('/crm/list?list=q');
    qCount = rows.length;
    shell(rows.length ? `<p class="mt" style="margin:0 2px 8px">पालकांनी bot ला विचारलेले प्रश्न — उघडा, उत्तर द्या.</p><div id="q-rows">${rowsHtml(rows)}</div>` : '<p class="empty">✅ एकही प्रश्न बाकी नाही</p>', 'प्रश्न');
    if (rows.length) wireRows($('q-rows'));
  }

  // 🏆 महा-Test reminders (one after another)
  async function mtQueue() {
    let evs; try { evs = (await rq('/guest/admin/mt-list')).data || []; } catch (e) { return toast(e.message, true); }
    const rows = []; for (const ev of evs) for (const r of ev.rows) if (!r.submitted) rows.push({ ...r, ev });
    if (!rows.length) return toast('पुढच्या महा-Test साठी नोंदणी केलेले कोणी नाही');
    let i = 0;
    const draw = () => {
      if (i >= rows.length) { toast('✅ महा-Test आठवण झाली'); return route(); }
      const r = rows[i], when = new Date(r.ev.starts_at).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
      const text = `नमस्कार 🙏 ${r.name || 'तुमच्या पाल्या'}ची ${when} च्या ${r.cls} महा-Test साठी नोंदणी झाली आहे 🏆\nवेळेवर याच link वरून test द्या 👇\n${SITE}/student-app/?free=1&g=${r.gid}\nसगळ्या विद्यार्थ्यांमध्ये क्रमांक लगेच कळेल.`;
      shell(`<div class="fam-h"><div class="nm">${esc(r.name || '—')}</div><div class="mt">${esc(r.cls)} · 📱 ${esc(r.mobile)}${r.reminders.length ? ` · 🔔 ${r.reminders.length} वेळा आठवण` : ''}</div></div>
        <div class="box"><textarea class="in" id="m-text">${esc(text)}</textarea></div>
        <div class="acts3"><a class="btn wa" id="m-wa" target="_blank" rel="noopener">💬 WhatsApp</a><a class="btn sms" id="m-sms">✉️ SMS</a><button type="button" class="btn ghost" id="m-skip">⏭ सोडा</button></div>`, `🏆 महा-Test · ${i + 1}/${rows.length}`);
      $('fab')?.classList.add('hidden');
      const ta = $('m-text'), wa = $('m-wa'), sms = $('m-sms');
      const links = () => { wa.href = `https://wa.me/91${r.mobile}?text=${encodeURIComponent(ta.value)}`; sms.href = `sms:+91${r.mobile}?body=${encodeURIComponent(ta.value)}`; };
      ta.oninput = links; links();
      const go = via => () => { rq('/guest/admin/mt-reminded', { body: { event_id: r.ev.event_id, student_code: r.student_code } }).catch(() => {}); crm(`/crm/lead/${r.gid}/act`, { action: 'mt', detail: via }).catch(() => {}); i++; setTimeout(draw, 900); };
      wa.addEventListener('click', go('wa')); sms.addEventListener('click', go('sms'));
      $('m-skip').onclick = () => { i++; draw(); };
    };
    draw();
  }

  // 📊 my day
  async function mine() {
    shell('<p class="empty">⏳</p>', 'माझं काम');
    const m = await crm('/crm/my');
    const c = m.counts || {}, n = k => c[k] || 0;
    shell(`<div class="stats">
        <div class="big" style="--c:#0e7490"><span class="n">${n('attempt')}</span><span class="t">📞 Call</span></div>
        <div class="big" style="--c:#15803d"><span class="n">${n('talk') + n('next') + n('paying')}</span><span class="t">✅ बोललो</span></div>
        <div class="big" style="--c:#128c4a"><span class="n">${n('wa') + n('sms')}</span><span class="t">💬 Messages</span></div>
        <div class="big" style="--c:#64748b"><span class="n">${n('noanswer')}</span><span class="t">📵 उचलला नाही</span></div>
        <div class="big" style="--c:#4338ca"><span class="n">${n('paying')}</span><span class="t">💳 Pay करणार</span></div>
        <div class="big" style="--c:#be123c"><span class="n">${n('reply') + n('answered')}</span><span class="t">❓ उत्तरं</span></div>
        <div class="big" style="--c:#7c3aed"><span class="n">${n('add') + n('acct')}</span><span class="t">➕ / 🔑 accounts</span></div>
        <div class="big" style="--c:#b45309"><span class="n">${n('later')}</span><span class="t">⏰ नंतर</span></div>
        <div class="big" style="--c:#111827"><span class="n">${n('close') + n('no') + n('wrong')}</span><span class="t">❌ नको / ☎️ चुकीचा</span></div>
        <div class="big" style="--c:#15803d"><span class="n">${n('paid')}</span><span class="t">✅ Pay झालं</span></div>
      </div>
      <p class="mt" style="margin:14px 2px">आज (${esc(m.day)}) · ${esc(me?.name || '')}</p>
      <button type="button" class="btn ghost" id="lo" style="width:100%">🚪 Logout</button>`, 'माझं काम');
    $('lo').onclick = () => { rq('/team/device-token', { method: 'PATCH', body: { token: '' } }).catch(() => {}); pushFor = ''; logout(); };   // 🔔 no pushes after logout
  }

  // ➕ a family / a student (free account)
  let classes = null;
  async function addSheet() {
    if (!classes) classes = ((await rq('/guest/batches').catch(() => ({ data: [] }))).data || []).map(b => b.name);
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="नवीन">
      <h3>➕ नवीन पालक / विद्यार्थी</h3>
      <label class="f">पालकांचा नंबर *<input class="in" id="a-mob" type="tel" inputmode="tel" maxlength="16" placeholder="98XXXXXXXX"></label>
      <label class="f">विद्यार्थ्याचं नाव<input class="in" id="a-name" maxlength="40"></label>
      <label class="f">Class<select class="in" id="a-cls"><option value="">—</option>${classes.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label class="f">गाव / शाळा<input class="in" id="a-place" maxlength="80"></label>
      <label class="chk"><input type="checkbox" id="a-acct" checked> <span>App चं free account (Code + PIN) पण बनवा</span></label>
      <label class="chk"><input type="checkbox" id="a-ok"> <span>पालकांनी संपर्कासाठी परवानगी दिली आहे</span></label>
      <p class="msg" id="a-msg"></p>
      <div class="outs"><button type="button" class="btn ghost" id="a-cancel">रद्द</button><button type="button" class="btn pri" id="a-save">💾 Save</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('#a-cancel').onclick = () => bg.remove();
    bg.querySelector('#a-save').onclick = async () => {
      const msg = bg.querySelector('#a-msg'), mob = bg.querySelector('#a-mob').value.replace(/\D/g, '').slice(-10);
      if (!/^[6-9]\d{9}$/.test(mob)) { msg.textContent = 'योग्य 10 अंकी नंबर'; return; }
      if (!bg.querySelector('#a-ok').checked) { msg.textContent = 'परवानगीवर ✓ करा'; return; }
      const wantAcct = bg.querySelector('#a-acct').checked, cls = bg.querySelector('#a-cls').value;
      if (wantAcct && !cls) { msg.textContent = 'Account साठी class निवडा'; return; }
      const save = bg.querySelector('#a-save'); save.disabled = true; msg.textContent = '⏳';
      try {
        const r = await rq('/guest/admin/leads-add', { body: { source: 'manual', consent: true, rows: [{ mobile: mob, name: bg.querySelector('#a-name').value.trim(), batch: cls, place: bg.querySelector('#a-place').value.trim() }] } });
        const gid = r.data?.gids?.[0];
        if (gid) await new Promise(res => setTimeout(res, 1500));
        if (gid) crm(`/crm/lead/${gid}/act`, { action: 'add', detail: r.data.added ? 'नवीन' : 'आधीच होता' }).catch(() => {});
        if (gid && wantAcct) {
          const p = await rq('/guest/admin/lead-pin', { body: { gid } });
          acct[gid] = { code: p.data.code, pin: p.data.pin };
          crm(`/crm/lead/${gid}/act`, { action: 'acct', detail: p.data.code }).catch(() => {});
          toast(`🔑 Code ${p.data.code} · PIN ${p.data.pin || '(पालकांचा)'}`);
        } else toast(r.data?.added ? '✅ पालक जोडले' : '🔁 हा नंबर आधीच होता');
        bg.remove();
        if (gid) { queue = null; await openCard(gid); if (wantAcct && $('c-tpl')) { $('c-tpl').value = 'acct'; $('c-tpl').dispatchEvent(new Event('change')); } }
      } catch (e) { save.disabled = false; msg.textContent = e.message; }
    };
  }

  // 🔐 login
  function showLogin(why) {
    app.innerHTML = `<div class="login"><form class="card" id="lg">
      <img class="logo" src="../icons/icon-192.png" alt="" />
      <h1>NKs Team</h1><p>पालकांशी संपर्क — फक्त team साठी</p>
      <label class="f">Mobile<input class="in" id="lg-mob" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="98XXXXXXXX"></label>
      <label class="f">PIN<input class="in" id="lg-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="4 अंकी"></label>
      <p class="msg" id="lg-msg">${esc(why || '')}</p>
      <button type="submit" class="btn pri" style="width:100%">🔐 Login</button>
      <p style="font-size:.85rem">Account नाही? Admin ला विचारा (Admin › CRM › 👥 Team).</p>
    </form></div>`;
    $('lg').onsubmit = async e => {
      e.preventDefault();
      const msg = $('lg-msg'); msg.textContent = '⏳';
      try {
        const r = await rq('/team/login', { body: { mobile: $('lg-mob').value, pin: $('lg-pin').value } });
        tok = r.token; me = { id: r.member.id, name: r.member.name };
        ls.set('nks_team_token', tok); ls.set('nks_team_me', JSON.stringify(me));
        tab = 'home'; route();
      } catch (err) { msg.textContent = err.message; }
    };
  }

  // Android back: a sheet closes, a card goes back to the list
  const back = () => { const s = document.querySelector('.sheet-bg'); if (s) { s.remove(); return true; } clearInterval(deskTimer); if (queue || tab !== 'home' || !document.querySelector('.big')) { queue = null; tab = 'home'; route(); return true; } return false; };
  document.addEventListener('backbutton', back);
  try { window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => { if (!back()) window.Capacitor.Plugins.App.exitApp?.(); }); } catch { /* the browser */ }
  window.TEAM_APP = { route };
  route();
})();
