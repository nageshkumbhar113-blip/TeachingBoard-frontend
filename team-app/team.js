/* ════════════════════════════════════════
   NKs Team — the team's CRM app (mobile first)
   Login: mobile + PIN (Admin › CRM › 👥 Team makes members). Render gives a token; the bot's CRM (Cloudflare
   Worker) is called with a short "staff" token that names the member, so every action is counted for them.
   Screens: 🏠 आज (today's work, one family after another) · 🔍 शोध · ❓ प्रश्न · 📊 माझं · ➕ नवीन.
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
  function logout(why) { tok = null; me = null; bot = null; ls.set('nks_team_token', null); ls.set('nks_team_me', null); ls.set('nks_team_bot', null); ls.set('nks_team_home', null); showLogin(why); }

  // ── ready messages (the admin's own from the bot, else these) ──
  const DEFAULT_TPLS = [
    { id: 'hello', title: '👋 पहिला संपर्क + free test', text: 'नमस्कार 🙏 मी NKs EduOrbit मधून.\n{नाव} साठी {class} ची free test (10 मिनिटं, login नाही) 👇\n{test}{bot:TEST}' },
    { id: 'acct', title: '🔑 App चा Code + PIN', text: 'नमस्कार 🙏 {नाव} चं NKs EduOrbit app account तयार आहे.\n👤 Code: *{code}*\n🔑 PIN: *{pin}*\n📲 App 👇\n{app}\nApp उघडा → Login → Code आणि PIN टाका → सगळ्या free tests.{bot:HELP}' },
    { id: 'remind', title: '📝 Test आठवण', text: 'नमस्कार 🙏 {नाव} ने free test दिली का? फक्त 10 मिनिटं, login नाही 👇\n{test}{bot:TEST}' },
    { id: 'result', title: '🎯 Result + सवलत', text: 'नमस्कार 🙏 {नाव} ने {tests} free test दिल्या 👏\nपूर्ण result, कमकुवत भाग आणि सवलत{सवलत} 👇\n{pay}{bot:RESULT}' },
    { id: 'offer', title: '🎁 सवलत संपतेय', text: 'नमस्कार 🙏 {नाव} साठी पहिल्या payment वर सूट{सवलत} आहे.\nसगळे tests, notes, स्वाध्याय उत्तरं आणि दर रविवारी महा-Test 👇\n{pay}{bot:OFFER}' },
    { id: 'course', title: '📚 पूर्ण course', text: 'नमस्कार 🙏 {नाव} ने {tests} free tests दिल्या 👏\nपूर्ण course मध्ये सगळ्या chapters चे tests, प्रत्येक प्रश्नाची युक्ती, notes आणि महा-Test 👇\n{pay}{bot:OFFER}' },
    { id: 'next', title: '📝 पुढची free test', text: 'नमस्कार 🙏 {नाव} साठी पुढची free test तयार आहे 👇\n{test}{bot:TEST}' },
    { id: 'missed', title: '📞 Call लागला नाही', text: 'नमस्कार 🙏 NKs EduOrbit मधून {नाव} बद्दल call केला होता. सोयीची वेळ सांगा, आम्ही परत call करू.{bot:HELP}' },
  ];
  let tpls = DEFAULT_TPLS, botNum = '', steps = [], acct = {};
  const tplById = id => tpls.find(t => t.id === id) || DEFAULT_TPLS.find(t => t.id === id) || null;
  function fill(text, L, offer) {
    const a = acct[L.gid] || (L.acct?.code ? L.acct : null), g = L.gid;
    if (/\{(code|pin)\}/.test(text) && !(a?.code && a.pin)) return null;
    const off = offer ? ` (${offer.pct}%) ` + new Date(offer.end).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) + ' पर्यंत' : '';
    const b = kw => botNum ? `\n\nप्रश्न / पुढची test: आमच्या WhatsApp bot ला इथे message करा (फक्त Send दाबा) 👇\nhttps://wa.me/${botNum}?text=${encodeURIComponent(String(kw || 'TEST').toUpperCase() + ' ' + g)}` : '';
    return text.replace(/\{bot(?::([A-Za-z]+))?\}/g, (_, kw) => b(kw))
      .replace(/\{नाव\}/g, L.name || 'तुमचा पाल्य').replace(/\{class\}/g, L.cls || '').replace(/\{tests\}/g, String(L.testsDone || 0))
      .replace(/\{test\}/g, `${SITE}/student-app/?free=1&g=${g}`).replace(/\{pay\}/g, `${SITE}/parent-pay.html?g=${g}`).replace(/\{app\}/g, PLAY)
      .replace(/\{code\}/g, a?.code || '').replace(/\{pin\}/g, a?.pin || '').replace(/\{सवलत\}/g, off)
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

  async function home() {
    const kept = JSON.parse(ls.get('nks_team_home') || 'null');
    if (kept) drawHome(kept.sum, kept.fu, true); else shell('<p class="empty">⏳ उघडत आहे…</p>', 'आजचं काम');
    const [sum, fu, tp] = await Promise.all([crm('/crm/summary'), crm('/crm/fu'), crm('/crm/templates').catch(() => null)]);
    if (Array.isArray(tp) && tp.length) tpls = tp;
    ls.set('nks_team_home', JSON.stringify({ sum, fu }));
    if (tab === 'home' && !queue) drawHome(sum, fu, false);
  }
  function drawHome(sum, fu, stale) {
    botNum = /^91\d{10}$/.test(String(sum.bot_number || '')) ? sum.bot_number : '';
    steps = fu.steps || []; qCount = sum.counts.q || 0;
    const due = fu.counts.reduce((t, c) => t + c.due, 0);
    const sat = [0, 6].includes(new Date().getDay());
    shell(`
      <div class="grid">
        <button type="button" class="big wide" style="--c:#059669" data-go="new"><span class="n">${sum.counts.new || 0}</span><span class="t">🆕 नवीन पालक (48 तास)</span><span class="s">${sum.counts.new_untouched ? `<b>${sum.counts.new_untouched} ना अजून संपर्क नाही</b> — लगेच call` : 'सगळ्यांना संपर्क झाला ✅'}</span></button>
        <button type="button" class="big wide" style="--c:#4338ca" data-go="all"><span class="n">${due}</span><span class="t">📋 आज पाठवायचे / call</span><span class="s">एकामागून एक — Step प्रमाणे message तयार</span></button>
        <button type="button" class="big" style="--c:#be123c" data-go="q"><span class="n">${qCount}</span><span class="t">❓ प्रश्न</span><span class="s">पालकांनी विचारलेलं</span></button>
        <button type="button" class="big" style="--c:#e11d48" data-go="first"><span class="n">${sum.counts.first || 0}</span><span class="t">☀️ आधी call</span><span class="s">सूट संपतेय / test नाही</span></button>
        <button type="button" class="big" style="--c:#ea580c" data-go="call"><span class="n">${sum.counts.call || 0}</span><span class="t">📞 Call मागितला</span><span class="s">लगेच call</span></button>
        <button type="button" class="big wide" style="--c:#0e7490" data-go="appfree"><span class="n">${sum.counts.appfree || 0}</span><span class="t">📲 App वापरतात · pay नाही</span><span class="s">सगळ्यात जास्त वापरणारे आधी — course बद्दल call</span></button>
        <button type="button" class="big" style="--c:#7c3aed" data-go="noapp"><span class="n">${sum.counts.noapp || 0}</span><span class="t">📲 App नाही</span><span class="s">install मदत</span></button>
        ${sat ? '<button type="button" class="big wide" style="--c:#b45309" data-go="mt"><span class="n">🏆</span><span class="t">महा-Test आठवण</span><span class="s">नोंदणी केलेल्या पालकांना</span></button>' : ''}
      </div>
      <div class="h2">📋 Steps</div>
      ${steps.map((st, i) => { const c = fu.counts[i] || { total: 0, due: 0 }; return `<button type="button" class="row" style="--c:${esc(st.color)}" data-step="${i + 1}"><span class="nm">Step ${i + 1} · ${esc(st.name)}</span><span class="mt">${c.total} पालक · <b>आज ${c.due}</b></span></button>`; }).join('')}`, 'आजचं काम', stale ? '⏳ ताजे आकडे येत आहेत…' : '');
    app.querySelectorAll('[data-step]').forEach(b => b.onclick = () => startQueue(`Step ${b.dataset.step}`, `/crm/fu/list?step=${b.dataset.step}&due=1`, Number(b.dataset.step)));
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = async () => {
      const g = b.dataset.go;
      if (g === 'all') {
        return startQueue('आजचे सगळे', '/crm/fu/list?step=all&due=1', 0);
      }
      if (g === 'q') { tab = 'q'; return route(); }
      if (g === 'mt') return mtQueue();
      return startQueue({ new: '🆕 नवीन पालक', first: '☀️ आधी call', call: '📞 Call मागितला', noapp: '📲 App नाही', appfree: '📲 App · free' }[g], `/crm/list?list=${g}`, 0);
    });
  }

  async function startQueue(title, path, step, rows) {
    rows = rows || await crm(path).catch(e => { toast(e.message, true); return []; });
    if (!rows.length) { toast('या यादीत आत्ता कोणी नाही'); return; }
    queue = { title, rows, i: 0, step, done: 0, sentMob: new Set() };
    openCard(rows[0].gid);
  }
  function nextInQueue() {
    if (!queue) return route();
    queue.i++; queue.done++;
    if (queue.i >= queue.rows.length) { const n = queue.done; queue = null; toast(`✅ यादी पूर्ण — ${n} पालक`); return route(); }
    openCard(queue.rows[queue.i].gid);
  }

  // 👨‍👩‍👧 one family
  const ahead = new Map();   // gid → Promise of the card's data, fetched while the previous family is on screen
  const fetchCard = gid => { const p = crm('/crm/lead/' + gid); ahead.set(gid, { p, at: Date.now() }); p.catch(() => ahead.delete(gid)); return p; };
  async function openCard(gid) {
    const pre = ahead.get(gid); ahead.delete(gid);
    if (!pre) shell('<p class="empty">⏳</p>', queue ? `${queue.title} · ${queue.i + 1}/${queue.rows.length}` : 'पालक');
    let d; try { d = await (pre && Date.now() - pre.at < 120e3 ? pre.p : crm('/crm/lead/' + gid)); } catch (e) { toast(e.message, true); return queue ? nextInQueue() : route(); }
    if (queue && queue.rows[queue.i + 1]) fetchCard(queue.rows[queue.i + 1].gid);
    const L = d.lead, offer = d.offer, st = d.fu ? (d.fu_steps || [])[d.fu.step - 1] : null;
    steps = d.fu_steps || steps;
    const pick = st && tplById(st.tpl) ? st.tpl : suggest(L, offer);
    const q = L.question && !L.question.answered ? L.question : null;
    const dupe = queue && queue.sentMob.has(L.mobile);
    shell(`
      <div class="fam-h">
        <div class="nm">${esc(L.name || '—')}</div>
        <div class="mt">${esc(L.cls || '')}${L.place ? ' · ' + esc(L.place) : ''} · 📱 ${esc(L.mobile || '—')}</div>
        <div class="mt">📝 ${L.testsDone || 0}/${L.freeTotal || 0} tests · ${L.app ? '📲 app ✓' : (L.acct?.code ? '👤 Code आहे, app नाही' : 'app नाही')}${offer ? ` · <span class="pill offer">🎁 ${offer.pct}% सूट · ${left(offer.end)}</span>` : ''}${L.paid ? ' · ✅ Paid' : ''}</div>
        ${d.fu ? `<span class="step" style="--c:${esc(st?.color || '#4338ca')}">📋 Step ${d.fu.step} · ${esc(st?.name || '')} · ${dueText(d.fu.due)}</span>` : (L.closed ? `<span class="step" style="--c:#64748b">❌ ${esc(L.closed)}</span>` : '')}
        ${d.usage && (d.usage.last || d.usage.tests) ? `<div class="mt" style="color:#0e7490;font-weight:600">${usageText(d.usage)}</div>` : ''}
        ${L.lastTeam ? `<div class="mt">शेवटचं: ${esc(L.lastTeam.by)} — ${esc(L.lastTeam.reason || L.lastTeam.result)} (${ago(Date.parse(L.lastTeam.at))})</div>` : ''}
        ${d.open && L.mobile ? `<div class="mt"><span class="pill open">🟢 Bot chat उघडी — bot मधून मोफत message पाठवता येतो</span></div>` : ''}
        ${dupe ? '<div class="mt"><span class="pill dupe">🔁 या नंबरला आत्ताच message पाठवला</span></div>' : ''}
      </div>
      ${q ? `<div class="box qbox"><h3>❓ पालकांचा प्रश्न <small>${ago(Date.parse(q.at))}</small></h3><div class="qt">"${esc(q.text)}"</div>
        ${d.open ? '<label class="f">उत्तर (bot च्या chat मध्ये, मोफत)<textarea class="in" id="q-ans" rows="3" placeholder="उत्तर लिहा…"></textarea></label><button type="button" class="btn pri" id="q-send">📤 उत्तर पाठवा</button>' : '<p class="mt">Call करा किंवा खालच्या 💬 WhatsApp ने उत्तर द्या.</p>'}
        <button type="button" class="btn ghost" id="q-done" style="margin-top:8px;width:100%">✅ उत्तर दिलं</button></div>` : ''}
      ${L.mobile ? `<div class="acts3">
        <a class="btn call" id="c-call" href="tel:+91${esc(L.mobile)}">📞 Call</a>
        <a class="btn wa" id="c-wa" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="btn sms" id="c-sms">✉️ SMS</a>
      </div>
      <div class="box"><h3>💬 Message</h3>
        <select class="in" id="c-tpl" aria-label="Message">${tpls.map(t => `<option value="${esc(t.id)}"${t.id === pick ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
        <textarea class="in" id="c-text" aria-label="मजकूर" style="margin-top:8px"></textarea>
        ${d.open ? '<button type="button" class="btn pri" id="c-bot" style="width:100%;margin-top:8px">🤖 Bot च्या WhatsApp मधून पाठवा (मोफत)</button><p class="mt">पालकांना हा message NKs च्या bot नंबरवरून जातो — त्यांनी उत्तर दिलं की ते इथे 💬 Chat मध्ये दिसतं.</p>' : ''}
        <button type="button" class="btn ghost hidden" id="c-pin" style="width:100%;margin-top:8px">🔑 Code + PIN बनवा / मिळवा</button>
      </div>` : '<p class="empty">या पालकांचा नंबर नाही.</p>'}
      ${!L.paid && !L.closed ? `<div class="box"><h3>📞 Call / message नंतर — निकाल निवडा</h3>
        <div class="outs">
          <button type="button" class="btn ok wide" data-out="next">✅ बोललो → पुढची Step</button>
          <button type="button" class="btn pri" data-out="paying">💳 Pay करणार</button>
          <button type="button" class="btn warn" data-out="later">⏰ नंतर</button>
          <button type="button" class="btn ghost" data-out="noanswer">📵 उचलला नाही</button>
          <button type="button" class="btn bad" data-out="close">❌ नको</button>
        </div></div>` : ''}
      ${queue ? '<button type="button" class="btn ghost" id="c-skip" style="width:100%">⏭ हा नंतर — पुढचा पालक</button>' : ''}
      <details class="box"${d.open ? ' open' : ''}><summary><b>💬 Chat (${(d.msgs || []).filter(m => m.dir === 'in').length} messages)</b></summary>
        <div class="chat">${(d.msgs || []).slice(-60).map(m => { let b = m.body || ''; if (m.dir === 'out' && b.startsWith('{')) { try { b = JSON.parse(b).body?.text || b; } catch {} } const c = { in: 'in', out: 'out', team: 'team' }[m.dir] || 'log'; return `<div class="cm ${c}">${esc(b)}<small>${new Date(m.at).toLocaleString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></div>`; }).join('') || '<p class="mt">अजून नाही</p>'}</div>
      </details>`, queue ? `${queue.title} · ${queue.i + 1}/${queue.rows.length}` : 'पालक', L.name || '');

    $('fab')?.classList.add('hidden');   // the card's own buttons stay free
    // the message box
    const sel = $('c-tpl'), ta = $('c-text'), wa = $('c-wa'), sms = $('c-sms'), pin = $('c-pin');
    const links = () => { if (!wa) return; wa.href = `https://wa.me/91${L.mobile}?text=${encodeURIComponent(ta.value)}`; sms.href = `sms:+91${L.mobile}?body=${encodeURIComponent(ta.value)}`; };
    const show = () => { if (!sel) return; const t = tplById(sel.value) || tpls[0]; const text = fill(t.text, L, offer); ta.value = text || ''; ta.disabled = text === null; ta.placeholder = text === null ? 'या message साठी Code + PIN हवा — खालचं बटण' : ''; pin.classList.toggle('hidden', text !== null); wa.classList.toggle('hidden', text === null); links(); };
    if (sel) { sel.onchange = show; ta.oninput = links; show(); }
    const sent = via => () => {
      const t = tplById(sel.value);
      crm(`/crm/lead/${gid}/sent`, { via, advance: !!queue && !!d.fu && t && st && t.id === st.tpl, tpl: t?.title || '', tpl_id: sel.value, text: ta.value }).catch(() => {});
      if (queue) { queue.sentMob.add(L.mobile); setTimeout(nextInQueue, 900); }
    };
    wa?.addEventListener('click', sent('wa')); sms?.addEventListener('click', sent('sms'));
    // 🤖 inside the bot's chat (the window is open: free)
    $('c-bot')?.addEventListener('click', async () => {
      const b = $('c-bot'), text = ta.value.trim();
      if (!text) return toast('Message लिहा', true);
      b.disabled = true;
      try {
        await crm(`/crm/lead/${gid}/reply`, { text });
        toast('📤 Bot मधून गेलं');
        if (queue) { queue.sentMob.add(L.mobile); setTimeout(nextInQueue, 900); } else openCard(gid);
      } catch (e) { toast(e.message, true); b.disabled = false; }
    });
    pin?.addEventListener('click', async () => {
      pin.disabled = true;
      try { const r = await rq('/guest/admin/lead-pin', { body: { gid } }); acct[gid] = { code: r.data.code, pin: r.data.pin }; crm(`/crm/lead/${gid}/act`, { action: 'acct', detail: r.data.code }).catch(() => {}); toast(`🔑 Code ${r.data.code} · PIN ${r.data.pin || '(पालकांचा)'}`); show(); }
      catch (e) { toast(e.message, true); } finally { pin.disabled = false; }
    });
    // the question
    $('q-send')?.addEventListener('click', async () => { const t = $('q-ans').value.trim(); if (!t) return toast('उत्तर लिहा', true); try { await crm(`/crm/lead/${gid}/reply`, { text: t }); toast('📤 उत्तर गेलं'); openCard(gid); } catch (e) { toast(e.message, true); } });
    $('q-done')?.addEventListener('click', async () => { try { await crm(`/crm/lead/${gid}/answered`, {}); toast('✅ प्रश्न सुटला'); openCard(gid); } catch (e) { toast(e.message, true); } });
    $('c-skip')?.addEventListener('click', () => { queue.i++; if (queue.i >= queue.rows.length) { queue = null; return route(); } openCard(queue.rows[queue.i].gid); });
    // the result, with a reason
    app.querySelectorAll('[data-out]').forEach(b => b.onclick = () => outcomeSheet(b.dataset.out, L));
  }

  const REASONS = {
    next: ['पालक बोलले — test देणार', 'Code + PIN दिला', 'माहिती पाठवली', 'नंतर विचार करणार'],
    close: ['फी जास्त', 'दुसरा क्लास', 'पाल्याला वेळ नाही', 'Phone नाही', 'नंबर चुकीचा', 'इतर'],
  };
  function outcomeSheet(res, L) {
    const titles = { next: '✅ बोललो → पुढची Step', paying: '💳 Pay करणार', later: '⏰ नंतर call', noanswer: '📵 उचलला नाही', close: '❌ नको — बंद' };
    const bg = document.createElement('div'); bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(titles[res])}">
      <h3>${titles[res]} — ${esc(L.name || '')}</h3>
      ${REASONS[res] ? `<div class="reasons">${REASONS[res].map(r => `<button type="button">${esc(r)}</button>`).join('')}</div>` : ''}
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
      <span class="mt">📱 ${esc(r.mobile || '—')} · 📝 ${r.tests || 0}/${r.free_total || 0}${r.open ? ' · 🟢 Bot chat' : ''}${r.app ? ' · 📲 app' : ''}${r.paid ? ' · ✅ Paid' : ''}${r.fu_step ? ` · 📋 Step ${r.fu_step} · ${dueText(r.fu_due)}` : ''}</span>
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
        <div class="big" style="--c:#15803d"><span class="n">${n('next') + n('paying')}</span><span class="t">✅ बोललो</span></div>
        <div class="big" style="--c:#128c4a"><span class="n">${n('wa') + n('sms')}</span><span class="t">💬 Messages</span></div>
        <div class="big" style="--c:#64748b"><span class="n">${n('noanswer')}</span><span class="t">📵 उचलला नाही</span></div>
        <div class="big" style="--c:#4338ca"><span class="n">${n('paying')}</span><span class="t">💳 Pay करणार</span></div>
        <div class="big" style="--c:#be123c"><span class="n">${n('reply') + n('answered')}</span><span class="t">❓ उत्तरं</span></div>
        <div class="big" style="--c:#7c3aed"><span class="n">${n('add') + n('acct')}</span><span class="t">➕ / 🔑 accounts</span></div>
        <div class="big" style="--c:#b45309"><span class="n">${n('later')}</span><span class="t">⏰ नंतर</span></div>
        <div class="big" style="--c:#111827"><span class="n">${n('close')}</span><span class="t">❌ नको</span></div>
      </div>
      <p class="mt" style="margin:14px 2px">आज (${esc(m.day)}) · ${esc(me?.name || '')}</p>
      <button type="button" class="btn ghost" id="lo" style="width:100%">🚪 Logout</button>`, 'माझं काम');
    $('lo').onclick = () => logout();
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
  const back = () => { const s = document.querySelector('.sheet-bg'); if (s) { s.remove(); return true; } if (queue || tab !== 'home' || !document.querySelector('.big')) { queue = null; tab = 'home'; route(); return true; } return false; };
  document.addEventListener('backbutton', back);
  try { window.Capacitor?.Plugins?.App?.addListener?.('backButton', () => { if (!back()) window.Capacitor.Plugins.App.exitApp?.(); }); } catch { /* the browser */ }
  window.TEAM_APP = { route };
  route();
})();
