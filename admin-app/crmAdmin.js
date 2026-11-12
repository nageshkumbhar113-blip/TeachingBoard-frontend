/* ════════════════════════════════════════
   crmAdmin.js — Admin › 📇 CRM
   Global: CRM_ADMIN

   The WhatsApp bot's families (Cloudflare Worker, TeachingBoard-backend/wa-worker). Render gives a
   12-hour token (/guest/admin/bot-token); every list / chat / action goes straight to the Worker.
   The day's work in order (1 → 7, each with its own colour, the "📋" guide on top); the rest are look-up
   lists. Own labels (like WhatsApp Business lists, each with a colour) on any family, and a label filter.
   Every family: "👉 पुढचं पाऊल", a message box (pick a ready message → edit → 💬 WhatsApp or ✉️ SMS from the
   team's own phone, ₹0; the bot's chat link inside, so the parent's Send opens the bot's free window),
   "🔑 Code + PIN" (the free account; Render makes it if missing), "पुढचा पालक →".
   📋 Follow-up on top: Step 1 → 6 (name, colour, message, days — ⚙️ to change), each with its count and "due today";
   "📤 आजचे पाठवा" goes through a step's due families one by one (message ready → WhatsApp / SMS → next) and each moves
   to the next step. A test, the app, or the bot's own answer moves a family on by itself; paid / closed leave.
   Top: ➕ a family by hand · 📤 Import (paste / CSV, sample file) · 🏷️ Labels · ✏️ Messages · 📥 old leads.
   Also: call results, a reply inside the open window, a note, and the bot-number template (paid, double tap).
════════════════════════════════════════ */

const CRM_ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ago = ms => {
    if (!ms) return '—';
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? 'आत्ता' : m < 60 ? `${m} मि. पूर्वी` : m < 1440 ? `${Math.round(m / 60)} तासांपूर्वी` : `${Math.round(m / 1440)} दिवसांपूर्वी`;
  };
  // time left on the offer: "3 तास 20 मि. बाकी"
  const left = iso => { const m = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} तास ${m % 60} मि. बाकी` : `${m} मि. बाकी`; };
  // the day's work, in this order (1 → 7); the rest are look-up lists. Each list (and family row) has its colour.
  const LISTS = [
    ['first', '1️⃣ ☀️ आधी call'], ['call', '2️⃣ 📞 Call मागितला'], ['noapp', '3️⃣ 📲 App नाही'], ['hot', '4️⃣ 🔥 गरम'], ['later', '5️⃣ ⏰ नंतर'], ['cold', '6️⃣ ❄️ थंड'], ['import', '7️⃣ 📥 Import / हाताने'],
    ['form', '📝 Form नंबर'], ['active', '💬 चालू'], ['paid', '✅ Paid'], ['closed', '❌ Closed'], ['nextyear', '📅 पुढचं वर्ष'],
  ];
  const COLOR = { first: '#e11d48', call: '#ea580c', noapp: '#7c3aed', hot: '#ca8a04', later: '#2563eb', cold: '#64748b', import: '#a16207',
    form: '#0891b2', active: '#16a34a', paid: '#15803d', closed: '#111827', nextyear: '#475569' };
  const rowColor = r => COLOR[r.crm || (r.paid ? 'paid' : r.closed ? 'closed' : 'active')] || COLOR.active;
  const STEPS = {
    first: 'सवलत संपत आलेले, महा-Test दिलेले आणि नंबर देऊन test न दिलेले. <b>Call करा</b>; उचलला नाही तर 💬 "👋 पहिला संपर्क" किंवा "🎁 सवलत".',
    call: 'पालकांनी स्वतः call मागितला — <b>लगेच call</b>.',
    noapp: 'App account (Code + PIN) बनलं पण app उघडलं नाही — <b>call करून install आणि login करायला मदत</b>, किंवा 💬 "🔑 Code + PIN".',
    hot: 'Tests देतात पण pay नाही — <b>call: फी आणि फायदे</b>, मग 💬 "📚 पूर्ण course".',
    later: '"नंतर call करा" म्हणालेले — <b>ठरलेल्या दिवशी call</b>.',
    cold: 'Reply बंद — एकदा 💬 "📝 पुढची free test", 2 दिवसांनी call → close किंवा नंतर.',
    import: 'तुम्ही टाकलेले / import केलेले नंबर — <b>💬 "👋 पहिला संपर्क"</b> पाठवा ("पुढचा पालक →" ने पटापट), किंवा call. दिवसाला 50–80 पेक्षा जास्त नवीन नंबर नको.',
  };
  const SITE = 'https://nkseduorbit.in', PLAY = 'https://play.google.com/store/apps/details?id=com.nkseduorbit.student';
  // the ready messages; {…} are filled for each family. Admin › ✏️ Messages can change them (kept in the bot).
  const DEFAULT_TPLS = [
    { id: 'hello', title: '👋 पहिला संपर्क + free test', when: 'नंबर दिला, test नाही (1️⃣ / 7️⃣)',
      text: 'नमस्कार 🙏 मी NKs EduOrbit मधून.\n{नाव} साठी {class} ची free test (10 मिनिटं, login नाही) 👇\n{test}{bot:TEST}' },
    { id: 'acct', title: '🔑 App चा Code + PIN', when: 'Account बनलं, app नाही (3️⃣)',
      text: 'नमस्कार 🙏 {नाव} चं NKs EduOrbit app account तयार आहे.\n👤 Code: *{code}*\n🔑 PIN: *{pin}*\n📲 App 👇\n{app}\nApp उघडा → Login → Code आणि PIN टाका → सगळ्या free tests.{bot:HELP}' },
    { id: 'remind', title: '📝 Test आठवण', when: 'Step 2: test दिली नाही',
      text: 'नमस्कार 🙏 {नाव} ने free test दिली का? फक्त 10 मिनिटं, login नाही 👇\n{test}{bot:TEST}' },
    { id: 'result', title: '🎯 Result + सवलत', when: 'Step 3: test दिली',
      text: 'नमस्कार 🙏 {नाव} ने {tests} free test दिल्या 👏\nपूर्ण result, कमकुवत भाग आणि सवलत{सवलत} 👇\n{pay}{bot:RESULT}' },
    { id: 'offer', title: '🎁 सवलत संपतेय', when: 'सवलत चालू (1️⃣ / 4️⃣)',
      text: 'नमस्कार 🙏 {नाव} साठी पहिल्या payment वर सूट{सवलत} आहे.\nसगळे tests, notes, स्वाध्याय उत्तरं आणि दर रविवारी महा-Test 👇\n{pay}{bot:OFFER}' },
    { id: 'course', title: '📚 पूर्ण course', when: 'Tests देतात, pay नाही (4️⃣)',
      text: 'नमस्कार 🙏 {नाव} ने {tests} free tests दिल्या 👏\nपूर्ण course मध्ये सगळ्या chapters चे tests, प्रत्येक प्रश्नाची युक्ती, notes आणि महा-Test 👇\n{pay}{bot:OFFER}' },
    { id: 'next', title: '📝 पुढची free test', when: 'Reply नाही (6️⃣)',
      text: 'नमस्कार 🙏 {नाव} साठी पुढची free test तयार आहे 👇\n{test}{bot:TEST}' },
    { id: 'missed', title: '📞 Call लागला नाही', when: 'Call उचलला नाही',
      text: 'नमस्कार 🙏 NKs EduOrbit मधून {नाव} बद्दल call केला होता. सोयीची वेळ सांगा, आम्ही परत call करू.{bot:HELP}' },
    { id: 'maha', title: '🏆 महा-Test आठवण', when: 'नोंदणी केलेले (🏆 महा-Test) — शनिवारी संध्याकाळी, रविवारी सकाळी',
      text: 'नमस्कार 🙏 {नाव} ची {महा-test वेळ} च्या {class} महा-Test साठी नोंदणी झाली आहे 🏆\nवेळेवर याच link वरून test द्या 👇\n{test}\nसगळ्या विद्यार्थ्यांमध्ये क्रमांक लगेच कळेल. माहिती: {महा-test}{bot:MTWANT}' },
  ];
  const PLACEHOLDERS = '{नाव} {class} {tests} {test} = मुलाची free test link · {pay} = pay link · {app} = Play Store · {code} {pin} = app account · {सवलत} = "… पर्यंत" · {महा-test} · {महा-test वेळ} · {bot:TEST} = bot ची link (TEST / HELP / OFFER / MAHATEST / MTWANT)';
  let _tpls = DEFAULT_TPLS;
  const _tplById = id => _tpls.find(t => t.id === id) || DEFAULT_TPLS.find(t => t.id === id) || null;
  let _fu = { steps: [], counts: [] }, _fuStep = 0;   // the follow-up steps; the step whose families are shown (0 = none)
  const _dueText = ms => { if (!ms) return 'आज'; const d = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5); return d <= 0 ? 'आज' : d === 1 ? 'उद्या' : new Date(ms).toLocaleDateString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short' }); };
  let _labels = [];              // [{ id, name, color }]
  let _botNum = '';
  const _acct = {};              // gid → { code, pin } fetched with "🔑 Code + PIN"
  const _kept = {};              // gid → { tpl, text? }: the message chosen / edited in the box
  const REASONS = ['फी जास्त', 'पाल्याला वेळ नाही', 'दुसरा क्लास', 'Phone नाही', 'इतर'];
  let _conn = null;              // { url, token, at }
  let _list = 'first', _label = '', _q = '', _open = '', _ready = false, _rowsCache = [], _teamToday = 0;
  let _waReady = null;
  let _byMob = {};               // mobile → how many families in the list share it (siblings, or one child twice)           // { gid, waMe, text }: a team message ready to open (a real tap opens WhatsApp)

  async function _connect(force) {
    if (!force && _conn && Date.now() - _conn.at < 10 * 3600e3) return _conn;
    const r = await API.botToken();
    if (!r?.data?.ready) { _conn = null; return null; }
    _conn = { url: r.data.url, token: r.data.token, at: Date.now() };
    return _conn;
  }
  async function _call(path, body) {
    const c = await _connect();
    if (!c) throw new Error('Bot अजून जोडलेला नाही');
    const r = await fetch(c.url + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + c.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { _conn = null; throw new Error('Login पुन्हा करा'); }
    if (!r.ok || j.success === false) throw new Error(j.message || 'काहीतरी चूक झाली');
    return j.data;
  }

  function _shell() {
    $('crm-admin').innerHTML = `
      <div class="crm-head"><h3>📇 CRM — पालक</h3><button type="button" class="admin-btn-secondary" id="crm-refresh" aria-label="पुन्हा उघडा">🔄</button></div>
      <div class="crm-tools">
        <button type="button" class="admin-btn-primary crm-mt-btn" data-panel="mt">🏆 महा-Test आठवण</button>
        <button type="button" class="admin-btn-primary" data-panel="add">➕ नवीन पालक</button>
        <button type="button" class="admin-btn-secondary" data-panel="import">📤 Import</button>
        <button type="button" class="admin-btn-secondary" data-panel="labels">🏷️ Labels</button>
        <button type="button" class="admin-btn-secondary" data-panel="tpls">✏️ Messages</button>
        <button type="button" class="admin-btn-secondary" data-panel="fusteps">⚙️ पायऱ्या</button>
        <button type="button" class="admin-btn-secondary" id="crm-backfill" title="Website वरचे जुने नंबर CRM मध्ये (कोणालाही message जात नाही)">📥 जुने leads आणा</button>
      </div>
      <div id="crm-panel" class="crm-panel hidden"></div>
      <div class="crm-fu" id="crm-fu" aria-label="Follow-up पायऱ्या"></div>
      <p class="crm-status" id="crm-status">⏳ उघडत आहे…</p>
      <details class="crm-guide" id="crm-guide"><summary>📋 रोजचं काम — क्रमाने (1 → 7) · 💬 तयार messages</summary><div id="crm-guide-body"></div></details>
      <div class="crm-chips" id="crm-chips" role="tablist" aria-label="याद्या"></div>
      <div class="crm-labelbar" id="crm-labelbar"></div>
      <p class="crm-meta" id="crm-label-stats"></p>
      <input class="admin-input crm-search" id="crm-q" type="search" placeholder="नाव / नंबर शोधा" aria-label="शोधा">
      <div id="crm-rows" class="crm-rows"></div>
      <div id="crm-lead" class="crm-lead hidden" aria-live="polite"></div>`;
    $('crm-refresh').onclick = () => _load(true);
    $('crm-backfill').onclick = () => _sure($('crm-backfill'), async () => {
      const r = await API.crmBackfill();
      APP.toast(`📥 ${r?.data?.sent || 0} नंबर CRM कडे पाठवले — 1-2 मिनिटांत याद्यांमध्ये दिसतील`, 'success');
      setTimeout(() => _load(), 60000);
    }, 'सगळे जुने नंबर आणायचे? पुन्हा दाबा');
    $('crm-admin').querySelectorAll('[data-panel]').forEach(b => b.onclick = () => _panel(b.dataset.panel));
    let t; $('crm-q').oninput = e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value.trim(); _rows(); }, 300); };
  }

  async function _load(force) {
    try {
      if (force) _conn = null;
      if (!(await _connect())) {
        $('crm-status').innerHTML = '⚠️ WhatsApp bot अजून जोडलेला नाही — Render मध्ये <b>WA_WORKER_URL</b> आणि <b>BOT_SHARED_SECRET</b> ठेवायचे आहेत.';
        $('crm-chips').innerHTML = ''; $('crm-rows').innerHTML = ''; return;
      }
      const [s, labels, tpls, fu] = await Promise.all([_call('/crm/summary'), _call('/crm/labels').catch(() => []), _call('/crm/templates').catch(() => null), _call('/crm/fu').catch(() => null)]);
      if (fu) _fu = fu;
      _drawFu();
      _labels = labels || []; _tpls = Array.isArray(tpls) && tpls.length ? tpls : DEFAULT_TPLS; _teamToday = s.counts.team_today || 0;
      _botNum = /^91\d{10}$/.test(String(s.bot_number || '')) ? s.bot_number : '';
      $('crm-guide-body').innerHTML = `<ol class="crm-steps">${LISTS.filter(([k]) => STEPS[k]).map(([k, label]) =>
        `<li><button type="button" class="crm-chip" style="--c:${COLOR[k]}" data-list="${k}"><i class="crm-dot"></i>${label} <b>${s.counts[k] || 0}</b></button> ${STEPS[k]}</li>`).join('')}</ol>
        <p class="crm-meta">💬 पालक उघडला की खाली <b>message box</b>: message निवडा → हवं तर बदला → <b>💬 WhatsApp</b> किंवा <b>✉️ SMS</b> → तुमच्या phone वर तयार मजकूर → <b>Send</b>. टीमच्या नंबरवरून, ₹0. त्यात bot ची link असते — पालकांनी ती दाबून Send केलं की bot पुढचं (result, tests, सवलत) स्वतः करतो.</p>
        <ul class="crm-tpl-list">${_tpls.map(t => `<li><b>${esc(t.title)}</b> — कधी: ${esc(t.when || '')}</li>`).join('')}</ul>`;
      $('crm-guide-body').querySelectorAll('[data-list]').forEach(b => b.onclick = () => { _list = b.dataset.list; _label = ''; _open = ''; _load(); });
      const tickAge = s.last_tick ? (Date.now() - s.last_tick) / 60000 : Infinity;
      $('crm-status').innerHTML = [
        s.bot_off ? '⛔ <b>Bot बंद (BOT_OFF)</b>' : !s.last_tick ? '⏳ Bot नवीन — पहिला tick 10 मिनिटांत' : tickAge < 25 ? '❤️ Bot चालू' : '⚠️ Bot चा tick थांबला आहे (25 मिनिटांपेक्षा जास्त)',
        `शेवटचा tick: ${ago(s.last_tick)}`, `शेवटचा मेसेज: ${ago(s.last_webhook)}`,
        `आजचा खर्च ₹${(s.cost_today || 0).toFixed(2)} / मर्यादा ₹${s.cap}`, `महिना ₹${(s.cost_month || 0).toFixed(2)}`,
        `📱 आज टीमचे WhatsApp: ${_teamToday}${_teamToday >= 80 ? ' ⚠️ जास्त — आज थांबा' : ''}`,
        s.jobs ? `⏳ Render कडे पाठवायची ${s.jobs} काम बाकी` : '',
      ].filter(Boolean).join(' · ');
      $('crm-chips').innerHTML = LISTS.map(([k, label]) =>
        `<button type="button" role="tab" class="crm-chip${k === _list && !_label && !_fuStep ? ' on' : ''}" style="--c:${COLOR[k]}" aria-selected="${k === _list && !_label}" data-list="${k}"><i class="crm-dot"></i>${label} <b>${s.counts[k] || 0}</b></button>`).join('');
      $('crm-chips').querySelectorAll('.crm-chip').forEach(b => b.onclick = () => { _list = b.dataset.list; _label = ''; _fuStep = 0; _open = ''; _load(); });
      $('crm-labelbar').innerHTML = _labels.length ? '🏷️ ' + _labels.map(l =>
        `<button type="button" class="crm-lbl${l.id === _label ? ' on' : ''}" style="--c:${esc(l.color)}" data-label="${esc(l.id)}">${esc(l.name)}</button>`).join('') : '';
      $('crm-labelbar').querySelectorAll('[data-label]').forEach(b => b.onclick = () => { _label = _label === b.dataset.label ? '' : b.dataset.label; _fuStep = 0; _open = ''; _load(); });
      $('crm-label-stats').textContent = '';
      if (_label) _call('/crm/label-stats?label=' + _label).then(st => {
        $('crm-label-stats').textContent = `📊 ${_labelName(_label)}: ${st.total} नंबर → ${st.sent} ला message → ${st.replied} reply → ${st.tested} test → ${st.app} App → ${st.paid} Paid`;
      }).catch(() => {});
      await _rows();
      if (_open) await _lead(_open);
    } catch (e) { $('crm-status').textContent = '⚠️ ' + e.message; }
  }
  const _labelName = id => (_labels.find(l => l.id === id) || {}).name || '';
  const _labelPills = ids => (ids || []).map(id => _labels.find(l => l.id === id)).filter(Boolean)
    .map(l => `<span class="crm-lbl on small" style="--c:${esc(l.color)}">${esc(l.name)}</span>`).join('');

  async function _rows() {
    // a label shows its families from every list
    const path = _fuStep ? `/crm/fu/list?step=${_fuStep}` : _label ? `/crm/list?list=all&label=${_label}&q=${encodeURIComponent(_q)}` : `/crm/list?list=${_list}&q=${encodeURIComponent(_q)}`;
    let rows = await _call(path).catch(e => { APP.toast(e.message, 'error'); return []; });
    // a list shows 50 at a time: "आणखी" brings the next ones
    if (!_fuStep && rows.length === 50) {
      for (let off = 50; off < 500; off += 50) {
        const more = await _call(path + '&offset=' + off).catch(() => []);
        rows = rows.concat(more);
        if (more.length < 50) break;
      }
    }
    if (_fuStep && _q) rows = rows.filter(r => `${r.name} ${r.mobile}`.toLowerCase().includes(_q.toLowerCase()));
    _rowsCache = rows;
    _byMob = {}; for (const r of rows) if (r.mobile) _byMob[r.mobile] = (_byMob[r.mobile] || 0) + 1;
    $('crm-rows').innerHTML = rows.length ? rows.map(r => `
      <button type="button" class="crm-row${r.gid === _open ? ' on' : ''}" style="--c:${rowColor(r)}" data-gid="${esc(r.gid)}">
        <span class="crm-name">${esc(r.name || '—')} <small>${esc(r.cls || '')}${r.place ? ' · ' + esc(r.place) : ''}</small> ${_labelPills(r.labels)}</span>
        <span class="crm-meta">${r.mobile ? '📱 ' + esc(r.mobile) : '—'} · 📝 ${r.tests || 0}/${r.free_total || 0}${r.no_test ? ' · ⚠️ test नाही' : ''}${r.open ? ' · 🟢 खिडकी उघडी' : ''}${r.app ? ' · 📲 app' : r.acct ? ' · 👤 Code आहे, app नाही' : ''}${r.push_on ? ' · 🔔' : ''}${r.sent ? ` · 💬 ${r.sent} message` : ''}</span>
        <span class="crm-meta">${r.fu_step ? `📋 Step ${r.fu_step} · पुढचा message: <b>${_dueText(r.fu_due)}</b> · ` : ''}${r.closed ? '❌ ' + esc(r.closed) + ' · ' : ''}शेवटचा reply ${ago(r.last_in)}</span>
        ${r.offer || r.mt ? `<span class="crm-meta crm-hot">${r.offer ? `🎁 ${r.offer.pct}% सूट · ${left(r.offer.end)}` : ''}${r.offer && r.mt ? ' · ' : ''}${r.mt ? `🏆 महा-Test ${r.mt.score}/${r.mt.total}${r.mt.rank ? ` · #${r.mt.rank}/${r.mt.of}` : ''}` : ''}</span>` : ''}
        ${r.mobile && _byMob[r.mobile] > 1 ? `<span class="crm-meta crm-dupe">🔁 हा नंबर ${_byMob[r.mobile]} नोंदींमध्ये — एकच मूल असेल तर एकालाच message / call</span>` : ''}
      </button>`).join('') : '<p class="crm-empty">या यादीत कोणी नाही.</p>';
    $('crm-rows').querySelectorAll('.crm-row').forEach(b => b.onclick = () => _lead(b.dataset.gid));
  }

  function _bubble(m) {
    const t = new Date(m.at).toLocaleString('mr-IN-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    let body = m.body || '';
    if (m.dir === 'out' && body.startsWith('{')) { try { const i = JSON.parse(body); body = (i.body?.text || '') + '\n[' + ((i.action?.buttons || []).map(b => b.reply.title).concat((i.action?.sections?.[0]?.rows || []).map(r => r.title)).join(' · ')) + ']'; } catch {} }
    const cls = { in: 'in', out: 'out', team: 'team', push: 'sys', app: 'sys', log: 'log', do: 'log' }[m.dir] || 'log';
    const tag = m.dir === 'team' ? '📱 टीम' : m.dir === 'push' ? '🔔 push' : m.dir === 'app' ? '📱 app' : m.dir === 'do' ? '⚙️ ' + (m.kind || '') : m.dir === 'log' ? (m.kind || '') : '';
    return `<div class="crm-msg ${cls}">${tag ? `<b>${esc(tag)}</b> ` : ''}${esc(body)}<small>${t}${m.cost ? ' · ₹' + m.cost : ''}${m.status && m.dir === 'out' ? ' · ' + esc(m.status) : ''}</small></div>`;
  }

  async function _lead(gid) {
    _open = gid;
    $('crm-rows').querySelectorAll('.crm-row').forEach(b => b.classList.toggle('on', b.dataset.gid === gid));
    const box = $('crm-lead'); box.classList.remove('hidden'); box.innerHTML = '⏳'; box.scrollTop = 0;
    document.body.classList.add('crm-lead-open');
    let d; try { d = await _call('/crm/lead/' + gid); } catch (e) { box.textContent = '⚠️ ' + e.message; return; }
    const L = d.lead; L._offer = d.offer || null;
    const idx = _rowsCache.findIndex(r => r.gid === gid), nextRow = idx >= 0 ? _rowsCache[idx + 1] : null;
    box.innerHTML = `
      <div class="crm-lead-head">
        <div><b>${esc(L.name || '—')}</b> · ${esc(L.cls || '')}${L.place ? ' · ' + esc(L.place) : ''} · ${L.mobile ? `<a href="tel:+91${esc(L.mobile)}">📞 ${esc(L.mobile)}</a>` : 'नंबर नाही'}
          <div class="crm-meta">📝 ${L.testsDone || 0}/${L.freeTotal || 0} tests · ${L.paid ? '✅ Paid' : 'pay नाही'} · ${d.open ? '🟢 खिडकी उघडी (मोफत)' : '⚪ खिडकी बंद'}${L.daily && L.daily !== 'no' ? ` · रोज ${Number(L.daily) - 12} वाजता` : ''}${L.teamSent ? ` · 💬 टीमचे ${L.teamSent} message` : ''}</div></div>
        <button type="button" class="admin-btn-secondary" id="crm-close" aria-label="बंद करा">✕</button>
      </div>
      <div class="crm-lbls" aria-label="Labels">🏷️ ${_labels.length ? _labels.map(l => `<button type="button" class="crm-lbl${(L.labels || []).includes(l.id) ? ' on' : ''}" style="--c:${esc(l.color)}" data-lbl="${esc(l.id)}">${esc(l.name)}</button>`).join('') : '<small>"🏷️ Labels" मधून label बनवा</small>'}</div>
      ${d.fu ? `<div class="crm-fu-now" style="--c:${esc((d.fu_steps[d.fu.step - 1] || {}).color || '#64748b')}">📋 <b>Step ${d.fu.step} · ${esc((d.fu_steps[d.fu.step - 1] || {}).name || '')}</b> · पुढचा message: ${_dueText(d.fu.due)}
        <select class="admin-input" id="crm-fu-set" aria-label="Step बदला">${d.fu_steps.map((st, i) => `<option value="${i + 1}"${i + 1 === d.fu.step ? ' selected' : ''}>Step ${i + 1} · ${esc(st.name)}</option>`).join('')}</select>
        <button type="button" class="admin-btn-primary" id="crm-fu-next">✅ झालं → पुढची Step</button><button type="button" class="admin-btn-secondary" id="crm-fu-later">⏰ उद्या</button><button type="button" class="admin-btn-secondary" id="crm-fu-done">🏁 Follow-up बंद</button></div>`
        : (L.paid || L.closed ? '' : `<div class="crm-fu-now">📋 Follow-up मध्ये नाही${d.open ? ' — bot शी बोलणं चालू आहे' : ''} <button type="button" class="admin-btn-secondary" id="crm-fu-restart">↩️ Step 1 पासून</button></div>`)}
      <p class="crm-next">👉 <b>पुढचं पाऊल:</b> ${_next(L)}</p>
      ${_msgBox(L, nextRow, d.fu ? (d.fu_steps[d.fu.step - 1] || {}).tpl : '')}
      <div class="crm-acts">
        <button type="button" class="admin-btn-secondary" id="crm-team">📱 टीमच्या WhatsApp वरून: bot ची link (₹0)</button>
        ${L.paid ? '' : `<span class="crm-paidbox"><select class="admin-input" id="crm-paid-period" aria-label="Plan"><option value="monthly">महिना</option><option value="yearly">वर्ष</option></select><input class="admin-input crm-days" id="crm-paid-amt" type="number" min="0" placeholder="₹" aria-label="किती भरले"><button type="button" class="admin-btn-primary" id="crm-paid">✅ Paid (हाताने)</button></span>`}
        ${L.closed ? '' : `<button type="button" class="admin-btn-secondary" id="crm-pay">✅ Call: pay करणार</button>
        <span class="crm-later"><input type="date" class="admin-input" id="crm-later-at" aria-label="पुढचा call"><button type="button" class="admin-btn-secondary" id="crm-later">⏰ नंतर</button></span>
        <span class="crm-ni"><select class="admin-input" id="crm-reason" aria-label="कारण">${REASONS.map(r => `<option>${r}</option>`).join('')}</select><button type="button" class="admin-btn-secondary" id="crm-ni">❌ Not interested → close</button></span>`}
        <button type="button" class="admin-btn-secondary crm-paid" id="crm-tpl">Bot नंबरवरून template (₹0.86)</button>
      </div>
      ${_waReady && _waReady.gid === gid ? `<div class="crm-wa"><a class="admin-btn-primary" id="crm-wa-open" href="${esc(_waReady.waMe)}" target="_blank" rel="noopener">📲 WhatsApp उघडा आणि Send करा</a><pre>${esc(_waReady.text)}</pre></div>` : ''}
      <div class="crm-chat" id="crm-chat">${d.msgs.map(_bubble).join('') || '<p class="crm-empty">अजून मेसेज नाहीत.</p>'}</div>
      <form class="crm-reply" id="crm-reply">
        <input class="admin-input" id="crm-reply-text" placeholder="${d.open ? 'Bot च्या chat मध्ये उत्तर (मोफत)' : 'खिडकी बंद — फक्त note'}" aria-label="उत्तर">
        ${d.open ? '<button type="submit" class="admin-btn-primary">पाठवा</button>' : ''}
        <button type="button" class="admin-btn-secondary" id="crm-note">📝 Note</button>
      </form>`;
    const chat = $('crm-chat'); chat.scrollTop = chat.scrollHeight;
    $('crm-close').onclick = () => { _open = ''; box.classList.add('hidden'); document.body.classList.remove('crm-lead-open'); _rows(); };
    const openTeam = r => { const t = r?.team?.[0]; _waReady = t?.waMe ? { gid, waMe: t.waMe, text: t.text } : null; };
    if ($('crm-wa-open')) $('crm-wa-open').onclick = () => { _waReady = null; setTimeout(() => _lead(gid), 300); };
    const act = (btn, fn) => async () => {
      btn.disabled = true;
      try { await fn(); await _load(); } catch (e) { APP.toast(e.message, 'error'); } finally { if (btn.isConnected) btn.disabled = false; }
    };
    // labels: a tap puts it on / takes it off
    box.querySelectorAll('[data-lbl]').forEach(b => b.onclick = async () => {
      b.classList.toggle('on');
      const ids = [...box.querySelectorAll('[data-lbl].on')].map(x => x.dataset.lbl);
      try { await _call(`/crm/lead/${gid}/labels`, { labels: ids }); const r = _rowsCache.find(x => x.gid === gid); if (r) r.labels = ids; }
      catch (e) { b.classList.toggle('on'); APP.toast(e.message, 'error'); }
    });
    _wireMsgBox(L, nextRow, d.fu ? (d.fu_steps[d.fu.step - 1] || {}).tpl : '');
    const fuAct = body => _call(`/crm/lead/${gid}/fu`, body).then(() => _load()).catch(e => APP.toast(e.message, 'error'));
    $('crm-fu-set')?.addEventListener('change', e => fuAct({ action: 'set', step: Number(e.target.value) }));
    $('crm-fu-later')?.addEventListener('click', () => fuAct({ action: 'snooze' }));
    $('crm-fu-next')?.addEventListener('click', () => fuAct({ action: 'next' }).then(() => APP.toast('✅ पुढच्या Step मध्ये गेला', 'success')));
    $('crm-fu-done')?.addEventListener('click', () => fuAct({ action: 'done' }));
    $('crm-fu-restart')?.addEventListener('click', () => fuAct({ action: 'restart' }));
    $('crm-team').onclick = act($('crm-team'), async () => openTeam(await _call(`/crm/lead/${gid}/team`, {})));
    if ($('crm-pay')) {
      $('crm-pay').onclick = act($('crm-pay'), async () => openTeam(await _call(`/crm/lead/${gid}/call`, { result: 'will_pay' })));
      $('crm-later').onclick = act($('crm-later'), async () => { await _call(`/crm/lead/${gid}/call`, { result: 'later', at: $('crm-later-at').value || 'लवकरच' }); APP.toast('⏰ नंतरच्या call ची नोंद', 'success'); });
      $('crm-ni').onclick = () => _sure($('crm-ni'), async () => { await _call(`/crm/lead/${gid}/call`, { result: 'not_interested', reason: $('crm-reason').value }); APP.toast('❌ Close — 1 जूनला पुन्हा यादीत', 'success'); });
    }
    $('crm-tpl').onclick = () => _sure($('crm-tpl'), async () => { await _call(`/crm/lead/${gid}/bot-template`, {}); APP.toast('Template पाठवायचा प्रयत्न केला — chat मध्ये निकाल पाहा', 'info'); }, '₹0.86 लागतील — पुन्हा दाबा');
    // ✅ paid outside our pay page (Razorpay payment link / UPI / cash): the course opens now, CRM Paid, the bot's 🎉
    $('crm-paid')?.addEventListener('click', () => _sure($('crm-paid'), async () => {
      const r = await API.crmLeadPaid(gid, $('crm-paid-period').value, $('crm-paid-amt').value);
      const d = r?.data || {};
      APP.toast(`✅ ${d.name || ''} Paid — course ${new Date(d.expiry).toLocaleDateString('mr-IN-u-nu-latn')} पर्यंत उघडा · Code ${d.code}${d.pin ? ' · PIN ' + d.pin : ''}`, 'success');
      setTimeout(() => _load(), 2500);
    }, 'पक्कं? पैसे आले आहेत का? — पुन्हा दाबा'));
    $('crm-note').onclick = act($('crm-note'), async () => { const t = $('crm-reply-text').value.trim(); if (!t) throw new Error('Note लिहा'); await _call(`/crm/lead/${gid}/note`, { text: t }); });
    $('crm-reply').onsubmit = e => { e.preventDefault(); const t = $('crm-reply-text').value.trim(); if (!t) return; act(e.submitter || $('crm-reply'), async () => { await _call(`/crm/lead/${gid}/reply`, { text: t }); })(); };
  }

  // 👉 what to do next with this family (and which message fits)
  function _next(L) {
    const acct = _acct[L.gid] || L.acct;
    if (L.paid) return '✅ Paid — काही करायचं नाही. App मध्ये अडचण असेल तरच मदत.';
    if (L.closed) return '❌ Closed — पालकांनी स्वतः message केला तरच पुन्हा.';
    if (L.crm === 'call') return '📞 पालकांनी call मागितला — <b>आत्ता call करा</b>.';
    const offer = !!L._offer;
    if (!L.testsDone) return '<b>Call करा</b>: "test दिली का?" उचलला नाही → 💬 "👋 पहिला संपर्क".';
    if (acct?.code && !L.app) return '📲 App नाही — <b>call करून install + login करायला मदत</b>, किंवा 💬 "🔑 Code + PIN".';
    if (offer) return `🎁 ${L._offer.pct}% सवलत ${left(L._offer.end)} — <b>call: फी आणि फायदे</b>, मग 💬 "🎁 सवलत".`;
    if (L.stopped) return '❄️ Reply नाही — 💬 "📝 पुढची free test", 2 दिवसांनी call.';
    return '🔥 Tests चालू — <b>call करून course बद्दल सांगा</b>, मग 💬 "📚 पूर्ण course".';
  }
  function _suggest(L) {
    const acct = _acct[L.gid] || L.acct;
    if (!L.testsDone) return 'hello';
    if (acct?.code && !L.app) return 'acct';
    if (L._offer) return 'offer';
    if (L.stopped) return 'next';
    return 'course';
  }

  // {…} → this family's details; null when the message needs the app account and there is none yet
  function _fill(text, L) {
    const acct = _acct[L.gid] || (L.acct?.code ? L.acct : null), g = L.gid;
    if (/\{(code|pin)\}/.test(text) && !(acct?.code && acct.pin)) return null;
    const offer = L._offer
      ? ` (${L._offer.pct}%) ` + new Date(L._offer.end).toLocaleString('mr-IN-u-nu-latn', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) + ' पर्यंत' : '';
    const bot = kw => _botNum ? `\n\n${String(kw).toUpperCase() === 'MTWANT' ? 'गुण आणि क्रमांक test संपताच WhatsApp वर हवे? इथे फक्त Send दाबा' : 'प्रश्न / पुढची test: आमच्या WhatsApp bot ला इथे message करा (फक्त Send दाबा)'} 👇\nhttps://wa.me/${_botNum}?text=${encodeURIComponent(String(kw || 'TEST').toUpperCase() + ' ' + g)}` : '';
    return text
      .replace(/\{bot(?::([A-Za-z]+))?\}/g, (_, kw) => bot(kw))
      .replace(/\{नाव\}/g, L.name || 'तुमचा पाल्य').replace(/\{class\}/g, L.cls || '').replace(/\{tests\}/g, String(L.testsDone || 0))
      .replace(/\{test\}/g, `${SITE}/student-app/?free=1&g=${g}`).replace(/\{pay\}/g, `${SITE}/parent-pay.html?g=${g}`).replace(/\{app\}/g, PLAY)
      .replace(/\{code\}/g, acct?.code || '').replace(/\{pin\}/g, acct?.pin || '').replace(/\{सवलत\}/g, offer)
      .replace(/\{महा-test वेळ\}/g, L.mtWhen || 'येत्या रविवारी').replace(/\{महा-test\}/g, `${SITE}/maha-test.html?class=${encodeURIComponent(L.cls || '')}`);
  }

  // 💬 the message box: pick → (edit) → WhatsApp / SMS from the team's phone
  function _msgBox(L, nextRow, stepTpl) {
    if (!L.mobile) return '<p class="crm-meta">💬 नंबर नाही — messages पाठवता येत नाहीत.</p>';
    // the message picked / edited for this family stays when the screen redraws (a sync, a refresh)
    const kept = _kept[L.gid];
    const pick = kept && _tplById(kept.tpl) ? kept.tpl : stepTpl && _tplById(stepTpl) ? stepTpl : _suggest(L);
    if (stepTpl && !_tpls.some(t => t.id === stepTpl) && _tplById(stepTpl)) _tpls = [..._tpls, _tplById(stepTpl)];
    return `<div class="crm-msgbox">
      <label class="crm-msgpick">💬 Message <select class="admin-input" id="crm-tsel">${_tpls.map(t => `<option value="${esc(t.id)}"${t.id === pick ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
      <small class="crm-meta" id="crm-twhen"></small>
      <textarea class="admin-input crm-ttext" id="crm-ttext" rows="7" aria-label="मजकूर"></textarea>
      <div class="crm-acts">
        <a class="admin-btn-primary" id="crm-send-wa" target="_blank" rel="noopener">💬 WhatsApp पाठवा</a>
        <a class="admin-btn-secondary" id="crm-send-sms">✉️ SMS पाठवा</a>
        <button type="button" class="admin-btn-secondary hidden" id="crm-pin" data-pin="get">🔑 Code + PIN ${L.acct?.code ? 'मिळवा' : 'बनवा'}</button>
        ${nextRow ? `<button type="button" class="admin-btn-secondary" id="crm-nextlead">पुढचा पालक → ${esc(nextRow.name || nextRow.mobile || '')}</button>` : ''}
      </div>
      <small class="crm-meta">📱 आज टीमचे WhatsApp: <b id="crm-team-today">${_teamToday}</b>${_teamToday >= 80 ? ' ⚠️ आज जास्त झाले — नवीन नंबरना उद्या पाठवा' : ''}</small>
    </div>`;
  }
  function _wireMsgBox(L, nextRow, stepTpl) {
    const sel = $('crm-tsel'); if (!sel) return;
    const gid = L.gid, ta = $('crm-ttext'), wa = $('crm-send-wa'), sms = $('crm-send-sms'), pin = $('crm-pin');
    const links = () => {
      const t = ta.value;
      wa.href = `https://wa.me/91${L.mobile}?text=${encodeURIComponent(t)}`;
      sms.href = `sms:+91${L.mobile}?body=${encodeURIComponent(t)}`;
    };
    const show = () => {
      const tpl = _tpls.find(t => t.id === sel.value) || _tpls[0];
      $('crm-twhen').textContent = tpl.when ? 'कधी: ' + tpl.when : '';
      const k = _kept[gid];
      const text = k && k.tpl === tpl.id && k.text != null ? k.text : _fill(tpl.text, L);
      const need = text === null;
      ta.value = need ? '' : text; ta.disabled = need;
      ta.placeholder = need ? 'या message साठी app account हवं — "🔑 Code + PIN" दाबा' : '';
      wa.classList.toggle('hidden', need); sms.classList.toggle('hidden', need); pin.classList.toggle('hidden', !need);
      links();
    };
    sel.onchange = () => { _kept[gid] = { tpl: sel.value }; show(); };
    ta.oninput = () => { _kept[gid] = { tpl: sel.value, text: ta.value }; links(); };
    show();
    const sent = via => () => {
      _call(`/crm/lead/${gid}/sent`, { via, tpl: sel.selectedOptions[0]?.textContent || '', tpl_id: sel.value, text: ta.value })
        .then(() => { if (stepTpl && sel.value === stepTpl) { delete _kept[gid]; setTimeout(() => _load(), 800); } }).catch(() => {});
      if (via === 'wa') { _teamToday++; const c = $('crm-team-today'); if (c) c.textContent = _teamToday; }
    };
    wa.addEventListener('click', sent('wa')); sms.addEventListener('click', sent('sms'));
    // 🔑 the free account's code + PIN (Render makes the account if there is none)
    pin.onclick = async () => {
      pin.disabled = true;
      try {
        const r = await API.crmLeadPin(gid, pin.dataset.pin === 'fresh');
        if (r?.data?.paid && !r.data.pin) { pin.dataset.pin = 'fresh'; pin.textContent = '🔄 नवीन PIN (जुना बंद होईल)'; APP.toast('Paid account — PIN पालकांनी ठेवलेला. बदलायचा असेल तरच "नवीन PIN".', 'info'); return; }
        _acct[gid] = { code: r.data.code, pin: r.data.pin };
        APP.toast('🔑 Code ' + r.data.code + ' · PIN ' + r.data.pin, 'success');
        show();
      } catch (e) { APP.toast(e.message, 'error'); } finally { if (pin.isConnected) pin.disabled = false; }
    };
    $('crm-nextlead')?.addEventListener('click', () => _lead(nextRow.gid).then(() => $('crm-lead')?.scrollIntoView({ block: 'start' })));
  }

  // ── the panels on top: ➕ / 📤 / 🏷️ / ✏️ ─────────────────────────────
  let _panelOpen = '', _batches = null;
  async function _classes() { if (!_batches) _batches = (await API.fetchGuestBatches().catch(() => [])).map(b => b.name); return _batches; }
  async function _panel(which) {
    const box = $('crm-panel');
    if (_panelOpen === which) { _panelOpen = ''; box.classList.add('hidden'); box.innerHTML = ''; return; }
    _panelOpen = which; box.classList.remove('hidden'); box.innerHTML = '⏳';
    if (which === 'add') return _panelAdd(box);
    if (which === 'import') return _panelImport(box);
    if (which === 'labels') return _panelLabels(box);
    if (which === 'tpls') return _panelTpls(box);
    if (which === 'fusteps') return _panelFuSteps(box);
    if (which === 'run') return _panelRun(box);
    if (which === 'mt') return _panelMt(box);
  }
  const _close = () => { _panelOpen = ''; $('crm-panel').classList.add('hidden'); $('crm-panel').innerHTML = ''; };
  const _labelList = () => `<datalist id="crm-label-names">${_labels.map(l => `<option value="${esc(l.name)}"></option>`).join('')}</datalist>`;

  // 📋 the steps on top
  function _drawFu() {
    const box = $('crm-fu'); if (!box) return;
    if (!_fu.steps.length) { box.innerHTML = ''; return; }
    const c = i => _fu.counts[i] || { total: 0, due: 0 };
    const cur = _fuStep ? c(_fuStep - 1) : null;
    box.innerHTML = `<div class="crm-fu-head"><b>📋 Follow-up</b> <small>message पाठवला की पालक पुढच्या Step मध्ये जातो</small></div>
      <div class="crm-fu-steps">${_fu.steps.map((st, i) => `<button type="button" class="crm-fu-chip${_fuStep === i + 1 ? ' on' : ''}" style="--c:${esc(st.color)}" data-fu="${i + 1}">
        <span>Step ${i + 1}</span><b>${esc(st.name)}</b><span class="crm-fu-n">${c(i).total}${c(i).due ? ` · <em>आज ${c(i).due}</em>` : ''}</span></button>`).join('')}</div>
      ${_fuStep ? `<div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-fu-run" ${cur.due ? '' : 'disabled'}>📤 आजचे पाठवा (${cur.due})</button><small class="crm-meta">Step ${_fuStep}: ${esc(_fu.steps[_fuStep - 1].name)} · message "${esc((_tplById(_fu.steps[_fuStep - 1].tpl) || {}).title || '')}" · नंतर ${_fu.steps[_fuStep - 1].wait || 0} दिवसांनी पुढची Step</small></div>` : ''}`;
    box.querySelectorAll('[data-fu]').forEach(b => b.onclick = () => { _fuStep = _fuStep === Number(b.dataset.fu) ? 0 : Number(b.dataset.fu); _label = ''; _open = ''; _load(); });
    $('crm-fu-run')?.addEventListener('click', () => { _panelOpen = ''; _panel('run'); });
  }

  // 📤 one step's due families, one after another
  async function _panelRun(box) {
    const step = _fuStep, st = _fu.steps[step - 1];
    if (!st) { _close(); return; }
    const queue = await _call(`/crm/fu/list?step=${step}&due=1`).catch(() => []);
    let i = 0, done = 0;
    const sentMob = new Set();   // numbers already sent in this round (one parent, two entries)
    const draw = async () => {
      if (i >= queue.length) {
        box.innerHTML = `<h4>✅ Step ${step} चे आजचे सगळे झाले (${done} पाठवले)</h4><div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-r-end">बंद</button></div>`;
        $('crm-r-end').onclick = () => { _close(); _load(); };
        return;
      }
      const r = queue[i];
      box.innerHTML = `<h4>📤 Step ${step} · ${esc(st.name)} — ${i + 1} / ${queue.length}</h4><p class="crm-meta">⏳ ${esc(r.name || r.mobile)}…</p>`;
      let d; try { d = await _call('/crm/lead/' + r.gid); } catch (e) { i++; return draw(); }
      const L = d.lead, tpl = _tplById(st.tpl) || _tpls[0]; L._offer = d.offer || null;
      const dupe = sentMob.has(L.mobile);
      let text = _fill(tpl.text, L);
      if (text === null) {                      // the message needs the app account: make it now
        try { const p = await API.crmLeadPin(L.gid); _acct[L.gid] = { code: p.data.code, pin: p.data.pin }; text = _fill(tpl.text, L); } catch { text = null; }
      }
      box.innerHTML = `<h4>📤 Step ${step} · ${esc(st.name)} — ${i + 1} / ${queue.length} <small>(${done} पाठवले)</small></h4>
        <p><b>${esc(L.name || '—')}</b> · ${esc(L.cls || '')}${L.place ? ' · ' + esc(L.place) : ''} · 📞 ${esc(L.mobile)} ${_labelPills(L.labels)}</p>
        ${dupe ? '<p class="crm-meta crm-dupe">🔁 या नंबरला आत्ताच message पाठवला — तेच मूल असेल तर "⏰ उद्या" किंवा "🏁" दाबा</p>' : ''}
        <textarea class="admin-input crm-ttext" id="crm-r-text" rows="7" aria-label="मजकूर">${esc(text || '')}</textarea>
        <div class="crm-acts">
          <a class="admin-btn-primary" id="crm-r-wa" target="_blank" rel="noopener">💬 WhatsApp पाठवा</a>
          <a class="admin-btn-secondary" id="crm-r-sms">✉️ SMS</a>
          <button type="button" class="admin-btn-secondary" id="crm-r-skip">⏭ उद्या</button>
          <button type="button" class="admin-btn-secondary" id="crm-r-stop">🏁 नको / नंबर चुकीचा</button>
          <button type="button" class="admin-btn-secondary" id="crm-r-close">बंद</button>
        </div>
        <small class="crm-meta">📱 आज टीमचे WhatsApp: <b>${_teamToday}</b>${_teamToday >= 80 ? ' ⚠️ आज जास्त झाले — उरलेले उद्या' : ''}</small>`;
      const ta = $('crm-r-text'), wa = $('crm-r-wa'), sms = $('crm-r-sms');
      const links = () => { wa.href = `https://wa.me/91${L.mobile}?text=${encodeURIComponent(ta.value)}`; sms.href = `sms:+91${L.mobile}?body=${encodeURIComponent(ta.value)}`; };
      ta.oninput = links; links();
      const sent = via => () => {
        _call(`/crm/lead/${L.gid}/sent`, { via, advance: true, tpl: tpl.title, tpl_id: tpl.id, text: ta.value }).catch(() => {});
        sentMob.add(L.mobile);
        if (via === 'wa') _teamToday++;
        done++; i++; setTimeout(draw, 700);   // WhatsApp opens; the next family is ready when they come back
      };
      wa.addEventListener('click', sent('wa')); sms.addEventListener('click', sent('sms'));
      $('crm-r-skip').onclick = async () => { await _call(`/crm/lead/${L.gid}/fu`, { action: 'snooze' }).catch(() => {}); i++; draw(); };
      $('crm-r-stop').onclick = async () => { await _call(`/crm/lead/${L.gid}/fu`, { action: 'done' }).catch(() => {}); await _call(`/crm/lead/${L.gid}/note`, { text: '🏁 Follow-up बंद (नको / नंबर चुकीचा)' }).catch(() => {}); i++; draw(); };
      $('crm-r-close').onclick = () => { _close(); _load(); };
    };
    draw();
  }

  // 🏆 the families registered for the coming महा-Tests: the bot may not write to them first, so the team sends the
  // reminder from its own WhatsApp / SMS (Saturday evening, Sunday morning) — one family after another, ₹0
  async function _panelMt(box) {
    let evs;
    try { evs = (await API.crmMtList())?.data || []; } catch (e) { box.innerHTML = `<p class="crm-meta">⚠️ ${esc(e.message)}</p>`; return; }
    if (_panelOpen !== 'mt') return;
    // "रविवारी सकाळी 10" (the parents' own words, not "10:00 AM")
    const whenOf = ev => {
      const d = new Date(ev.starts_at), h = d.getHours(), m = d.getMinutes();
      const day = d.toLocaleDateString('mr-IN-u-nu-latn', { weekday: 'long' }) + 'ी';
      return `${day} ${h < 12 ? 'सकाळी' : h < 17 ? 'दुपारी' : h < 21 ? 'संध्याकाळी' : 'रात्री'} ${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}`;
    };
    const today = new Date().toDateString();
    const sentToday = r => (r.reminders || []).some(t => new Date(t).toDateString() === today);
    const todoOf = ev => ev.rows.filter(r => !r.submitted && !sentToday(r));
    const draw = () => {
      box.innerHTML = `<h4>🏆 महा-Test — नोंदणी केलेले पालक</h4>
        <p class="crm-meta">Bot त्यांना स्वतःहून लिहू शकत नाही (पालकांनी 24 तासांत message केला नसेल तर) — म्हणून आठवण <b>टीमच्या WhatsApp वरून</b>: <b>शनिवारी संध्याकाळी</b> आणि <b>रविवारी सकाळी</b>. ₹0. एका दिवशी एकाला एकदाच.</p>
        ${evs.length ? evs.map((ev, i) => `<div class="crm-mt-ev">
          <div><b>${esc(ev.batch)}</b> · ${esc(whenOf(ev))} · नोंदणी <b>${ev.registered}</b> (पालकांचा नंबर असलेले ${ev.rows.length})</div>
          <div class="crm-acts"><button type="button" class="admin-btn-primary" data-mt-run="${i}" ${todoOf(ev).length ? '' : 'disabled'}>📤 आजची आठवण पाठवा (${todoOf(ev).length})</button></div>
          <ul class="crm-mt-rows">${ev.rows.map(r => `<li><b>${esc(r.name || '—')}</b> · 📱 ${esc(r.mobile)} · ${r.submitted ? '✅ test दिला' : r.reminders.length ? `🔔 ${r.reminders.length} वेळा आठवण${sentToday(r) ? ' (आज झाली)' : ''}` : '⏳ अजून आठवण नाही'}</li>`).join('') || '<li>पालकांचा नंबर असलेले कोणी नाही</li>'}</ul>
        </div>`).join('') : '<p class="crm-empty">पुढच्या 8 दिवसांत महा-Test नाही.</p>'}
        <div class="crm-acts"><button type="button" class="admin-btn-secondary" id="crm-mt-close">बंद</button></div>`;
      $('crm-mt-close').onclick = _close;
      box.querySelectorAll('[data-mt-run]').forEach(b => b.onclick = () => run(evs[Number(b.dataset.mtRun)]));
    };
    const run = ev => {
      const queue = todoOf(ev), tpl = _tplById('maha');
      let i = 0, done = 0;
      const step = () => {
        if (i >= queue.length) {
          box.innerHTML = `<h4>✅ ${esc(ev.batch)}: ${done} पालकांना आठवण पाठवली</h4><div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-mt-back">‹ यादी</button></div>`;
          $('crm-mt-back').onclick = draw;
          return;
        }
        const r = queue[i], L = { gid: r.gid, name: r.name, cls: r.cls, mobile: r.mobile, mtWhen: whenOf(ev) };
        box.innerHTML = `<h4>🏆 ${esc(ev.batch)} — ${i + 1} / ${queue.length} <small>(${done} पाठवले)</small></h4>
          <p><b>${esc(r.name || '—')}</b> · 📞 ${esc(r.mobile)}</p>
          <textarea class="admin-input crm-ttext" id="crm-m-text" rows="8" aria-label="मजकूर">${esc(_fill(tpl.text, L) || '')}</textarea>
          <div class="crm-acts">
            <a class="admin-btn-primary" id="crm-m-wa" target="_blank" rel="noopener">💬 WhatsApp पाठवा</a>
            <a class="admin-btn-secondary" id="crm-m-sms">✉️ SMS</a>
            <button type="button" class="admin-btn-secondary" id="crm-m-skip">⏭ सोडा</button>
            <button type="button" class="admin-btn-secondary" id="crm-m-close">‹ यादी</button>
          </div>
          <small class="crm-meta">📱 आज टीमचे WhatsApp: <b>${_teamToday}</b></small>`;
        const ta = $('crm-m-text'), wa = $('crm-m-wa'), sms = $('crm-m-sms');
        const links = () => { wa.href = `https://wa.me/91${r.mobile}?text=${encodeURIComponent(ta.value)}`; sms.href = `sms:+91${r.mobile}?body=${encodeURIComponent(ta.value)}`; };
        ta.oninput = links; links();
        const sent = via => () => {
          r.reminders.push(Date.now());
          API.crmMtReminded(ev.event_id, r.student_code).catch(() => {});
          _call(`/crm/lead/${r.gid}/sent`, { via, tpl: tpl.title, tpl_id: 'maha', text: ta.value }).catch(() => {});   // the bot's chat log (if the family is there)
          if (via === 'wa') _teamToday++;
          done++; i++; setTimeout(step, 700);   // WhatsApp opens; the next family is ready when they come back
        };
        wa.addEventListener('click', sent('wa')); sms.addEventListener('click', sent('sms'));
        $('crm-m-skip').onclick = () => { i++; step(); };
        $('crm-m-close').onclick = draw;
      };
      step();
    };
    draw();
  }

  // ⚙️ the steps: name, colour, message, days to the next step
  function _panelFuSteps(box) {
    let list = (_fu.steps || []).map(x => ({ ...x }));
    const all = [...new Map([..._tpls, ...DEFAULT_TPLS].map(t => [t.id, t])).values()];
    const draw = () => {
      box.innerHTML = `<h4>⚙️ Follow-up पायऱ्या</h4>
        <p class="crm-meta">क्रम = Step 1, 2, 3… · message पाठवला की पालक पुढच्या Step मध्ये जातो आणि "दिवस" नंतर पुन्हा "आज" यादीत येतो.</p>
        ${list.map((x, i) => `<div class="crm-lbl-row"><b>${i + 1}</b><input type="color" value="${esc(x.color)}" data-i="${i}" data-k="color" aria-label="रंग"><input class="admin-input" value="${esc(x.name)}" data-i="${i}" data-k="name" maxlength="40" aria-label="नाव">
          <select class="admin-input" data-i="${i}" data-k="tpl" aria-label="Message">${all.map(t => `<option value="${esc(t.id)}"${t.id === x.tpl ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
          <input class="admin-input crm-days" type="number" min="0" max="30" value="${Number(x.wait) || 0}" data-i="${i}" data-k="wait" aria-label="दिवस"><small>दिवस</small>
          <button type="button" class="admin-btn-secondary" data-del="${i}" aria-label="काढा">🗑️</button></div>`).join('')}
        <div class="crm-acts"><button type="button" class="admin-btn-secondary" id="crm-f-add">➕ Step</button></div>
        <div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-f-save">💾 Save</button><button type="button" class="admin-btn-secondary" id="crm-f-cancel">बंद</button></div>`;
      box.querySelectorAll('[data-k]').forEach(inp => inp.oninput = inp.onchange = () => { list[inp.dataset.i][inp.dataset.k] = inp.dataset.k === 'wait' ? Number(inp.value) : inp.value; });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { list.splice(Number(b.dataset.del), 1); draw(); });
      $('crm-f-add').onclick = () => { list.push({ name: 'नवीन Step', color: '#64748b', tpl: 'hello', wait: 2 }); draw(); };
      $('crm-f-cancel').onclick = _close;
      $('crm-f-save').onclick = async () => { try { await _call('/crm/fu/steps', { steps: list }); APP.toast('⚙️ पायऱ्या saved', 'success'); _close(); _load(); } catch (e) { APP.toast(e.message, 'error'); } };
    };
    draw();
  }

  // ➕ one family by hand
  async function _panelAdd(box) {
    const cls = await _classes();
    box.innerHTML = `<h4>➕ नवीन पालक</h4>
      <div class="crm-form">
        <label>पालकांचा नंबर *<input class="admin-input" id="crm-a-mob" type="tel" inputmode="tel" maxlength="16" placeholder="98XXXXXXXX"></label>
        <label>विद्यार्थ्याचं नाव<input class="admin-input" id="crm-a-name" maxlength="40"></label>
        <label>Class<select class="admin-input" id="crm-a-cls"><option value="">—</option>${cls.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <label>गाव / शाळा<input class="admin-input" id="crm-a-place" maxlength="80"></label>
        <label>Label<input class="admin-input" id="crm-a-label" list="crm-label-names" maxlength="40" placeholder="उदा. Final Interested"></label>${_labelList()}
        <label>नोंद<input class="admin-input" id="crm-a-note" maxlength="200"></label>
      </div>
      <label class="crm-check"><input type="checkbox" id="crm-a-ok"> पालकांनी संपर्कासाठी परवानगी दिली आहे</label>
      <p class="crm-meta" id="crm-a-msg" role="alert"></p>
      <div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-a-save">💾 Save</button><button type="button" class="admin-btn-secondary" id="crm-a-cancel">बंद</button></div>`;
    $('crm-a-cancel').onclick = _close;
    $('crm-a-save').onclick = async () => {
      const msg = $('crm-a-msg'), mob = $('crm-a-mob').value;
      if (!_mobile(mob)) { msg.textContent = 'योग्य 10 अंकी नंबर लिहा'; return; }
      if (!$('crm-a-ok').checked) { msg.textContent = 'परवानगीवर ✓ करा'; return; }
      $('crm-a-save').disabled = true; msg.textContent = '⏳';
      try {
        const r = await API.crmLeadsAdd({ source: 'manual', consent: true, label: $('crm-a-label').value.trim(),
          rows: [{ mobile: mob, name: $('crm-a-name').value.trim(), batch: $('crm-a-cls').value, place: $('crm-a-place').value.trim(), note: $('crm-a-note').value.trim() }] });
        const d = r?.data || {};
        APP.toast(d.added ? '✅ पालक CRM मध्ये आले' : d.updated ? '🔁 हा नंबर आधीच होता — रिकामी माहिती भरली' : '🔁 हा नंबर आधीच CRM मध्ये आहे', 'success');
        _close();
        setTimeout(() => { if (d.gids?.[0]) { _open = d.gids[0]; if (d.added) { _list = 'import'; _label = ''; } } _load(); }, 2500);
      } catch (e) { msg.textContent = e.message; $('crm-a-save').disabled = false; }
    };
  }

  // 📤 Import: paste from Excel / Google Sheet, or a CSV file
  const _mobile = raw => { let d = String(raw || '').replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d.startsWith('0')) d = d.slice(1); return /^[6-9]\d{9}$/.test(d) ? d : ''; };
  function _parse(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const tab = lines.some(l => l.includes('\t'));
    const cells = l => {
      if (tab) return l.split('\t').map(c => c.trim());
      const out = []; let cur = '', q = false;
      for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; }
      out.push(cur.trim()); return out;
    };
    const grid = lines.map(cells);
    const KEYS = { mobile: /नंबर|मोबाईल|mobile|phone|number|फोन|contact/i, name: /नाव|name|विद्यार्थी|student/i, batch: /class|वर्ग|इयत्ता|batch|standard/i, place: /गाव|शाळा|place|school|village|city/i, note: /नोंद|note|remark/i };
    let map = null;
    if (!grid[0].some(c => _mobile(c))) {        // a header row
      map = {}; grid[0].forEach((h, i) => { for (const [k, re] of Object.entries(KEYS)) if (!(k in map) && re.test(h)) { map[k] = i; break; } });
      grid.shift();
    }
    if (!map || !('mobile' in map)) {            // no header: the column with the most phone numbers is the number
      const width = Math.max(...grid.map(r => r.length));
      let best = 0, bestN = -1;
      for (let i = 0; i < width; i++) { const n = grid.filter(r => _mobile(r[i])).length; if (n > bestN) { best = i; bestN = n; } }
      const rest = [...Array(width).keys()].filter(i => i !== best);
      map = { mobile: best, name: rest[0], batch: rest[1], place: rest[2], note: rest[3], ...(map || {}) , mobile: best };
    }
    return grid.map(r => ({ mobile: r[map.mobile] || '', name: map.name != null ? r[map.name] || '' : '', batch: map.batch != null ? r[map.batch] || '' : '', place: map.place != null ? r[map.place] || '' : '', note: map.note != null ? r[map.note] || '' : '' }));
  }
  async function _panelImport(box) {
    const cls = await _classes();
    box.innerHTML = `<h4>📤 नंबर Import</h4>
      <p class="crm-meta">Excel / Google Sheet मधले cells <b>copy करून खाली paste</b> करा, किंवा CSV file निवडा. फक्त <b>पालकांचा नंबर</b> जरुरीचा; नाव, Class, गाव / शाळा, नोंद असले तर चांगलं. आधीच असलेला नंबर पुन्हा बनत नाही — फक्त रिकामी माहिती भरली जाते. कोणालाही message जात नाही.</p>
      <div class="crm-acts"><button type="button" class="admin-btn-secondary" id="crm-i-sample">⬇️ Sample file</button><label class="admin-btn-secondary crm-file">📄 CSV file<input type="file" id="crm-i-file" accept=".csv,text/csv,text/plain" hidden></label></div>
      <textarea class="admin-input crm-ttext" id="crm-i-text" rows="6" placeholder="पालकांचा नंबर	नाव	Class	गाव / शाळा	नोंद
9876543210	राहुल	8th	वडगाव"></textarea>
      <div class="crm-form">
        <label>या import चं नाव (label) *<input class="admin-input" id="crm-i-label" list="crm-label-names" maxlength="40" placeholder="उदा. Balinge highschool"></label>${_labelList()}
        <label>Class नसेल तर<select class="admin-input" id="crm-i-cls"><option value="">—</option>${cls.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <label class="crm-check"><input type="checkbox" id="crm-i-ok"> या सगळ्या पालकांनी संपर्कासाठी परवानगी दिली आहे</label>
      <div class="crm-acts"><button type="button" class="admin-btn-secondary" id="crm-i-preview">👀 Preview</button><button type="button" class="admin-btn-primary hidden" id="crm-i-go">✅ Import करा</button><button type="button" class="admin-btn-secondary" id="crm-i-cancel">बंद</button></div>
      <p class="crm-meta" id="crm-i-msg" role="alert"></p>
      <div id="crm-i-prev" class="crm-prev"></div>`;
    $('crm-i-cancel').onclick = _close;
    $('crm-i-sample').onclick = () => {
      const csv = '﻿पालकांचा नंबर,विद्यार्थ्याचं नाव,Class,गाव / शाळा,नोंद\n9876543210,राहुल पाटील,8th,जि.प. शाळा वडगाव,Seminar ला आले\n9822012345,Sai,8th,,\n';
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'crm-import-sample.csv';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    $('crm-i-file').onchange = async e => { const f = e.target.files?.[0]; if (f) $('crm-i-text').value = await f.text(); };
    let ready = [];
    $('crm-i-preview').onclick = () => {
      const rows = _parse($('crm-i-text').value), seen = new Set();
      const bad = [], dup = []; ready = [];
      rows.forEach((r, i) => { const m = _mobile(r.mobile); if (!m) bad.push(i + 1); else if (seen.has(m)) dup.push(i + 1); else { seen.add(m); ready.push({ ...r, mobile: m, batch: r.batch || $('crm-i-cls').value }); } });
      $('crm-i-msg').textContent = `✅ ${ready.length} नंबर तयार · ♊ file मध्ये दोनदा: ${dup.length} · ❌ चुकीचे: ${bad.length}${bad.length ? ' (row ' + bad.slice(0, 15).join(', ') + (bad.length > 15 ? '…' : '') + ')' : ''}${ready.length > 500 ? ' · ⚠️ एका वेळी 500 — पहिले 500 घेतले जातील' : ''}`;
      $('crm-i-prev').innerHTML = ready.length ? `<div class="crm-prev-scroll"><table><thead><tr><th>नंबर</th><th>नाव</th><th>Class</th><th>गाव / शाळा</th><th>नोंद</th></tr></thead><tbody>${ready.slice(0, 30).map(r => `<tr><td>${esc(r.mobile)}</td><td>${esc(r.name)}</td><td>${esc(r.batch)}</td><td>${esc(r.place)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table></div>${ready.length > 30 ? `<p class="crm-meta">… आणि ${ready.length - 30} आणखी</p>` : ''}` : '';
      $('crm-i-go').classList.toggle('hidden', !ready.length);
      $('crm-i-go').textContent = `✅ ${Math.min(ready.length, 500)} नंबर Import करा`;
    };
    $('crm-i-go').onclick = async () => {
      const label = $('crm-i-label').value.trim(), msg = $('crm-i-msg');
      if (!label) { msg.textContent = 'Import चं नाव (label) लिहा — निकाल त्याच नावाने दिसतील'; return; }
      if (!$('crm-i-ok').checked) { msg.textContent = 'परवानगीवर ✓ करा'; return; }
      const go = $('crm-i-go'); go.disabled = true;
      const all = ready.slice(0, 500), sum = { added: 0, updated: 0, same: 0, bad: 0 };
      try {
        for (let i = 0; i < all.length; i += 100) {
          msg.textContent = `⏳ ${Math.min(i + 100, all.length)} / ${all.length}…`;
          const r = await API.crmLeadsAdd({ source: 'import', consent: true, label, rows: all.slice(i, i + 100) });
          const d = r?.data || {}; sum.added += d.added || 0; sum.updated += d.updated || 0; sum.same += d.same || 0; sum.bad += (d.bad || []).length;
        }
        APP.toast(`📤 Import झालं: ${sum.added} नवीन · ${sum.updated} माहिती भरली · ${sum.same} आधीच होते${sum.bad ? ' · ' + sum.bad + ' चुकीचे' : ''}`, 'success');
        _close();
        setTimeout(() => { _list = 'import'; _label = ''; _open = ''; _load(); }, 3000);
      } catch (e) { msg.textContent = e.message; go.disabled = false; }
    };
  }

  // 🏷️ labels: name + colour (like WhatsApp Business lists)
  function _panelLabels(box) {
    const draw = () => {
      box.innerHTML = `<h4>🏷️ Labels</h4>
        <p class="crm-meta">तुमच्या याद्या — उदा. Pending to call, Final Interested, kandagaov, Balinge highschool. पालक उघडून label वर tap केलं की लागतो / निघतो; वरच्या label वर tap = फक्त ते पालक.</p>
        <div class="crm-lbl-edit">${_labels.map((l, i) => `<div class="crm-lbl-row"><input type="color" value="${esc(l.color)}" data-i="${i}" data-k="color" aria-label="रंग"><input class="admin-input" value="${esc(l.name)}" data-i="${i}" data-k="name" maxlength="40" aria-label="नाव"><button type="button" class="admin-btn-secondary" data-del="${i}" aria-label="काढा">🗑️</button></div>`).join('')}</div>
        <div class="crm-acts"><input class="admin-input" id="crm-l-new" maxlength="40" placeholder="नवीन label"><button type="button" class="admin-btn-secondary" id="crm-l-add">➕</button></div>
        <div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-l-save">💾 Save</button><button type="button" class="admin-btn-secondary" id="crm-l-cancel">बंद</button></div>`;
      box.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { _labels[inp.dataset.i][inp.dataset.k] = inp.value; });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { _labels.splice(Number(b.dataset.del), 1); draw(); });
      $('crm-l-add').onclick = () => { const n = $('crm-l-new').value.trim(); if (!n) return; const pal = Object.values(COLOR); _labels.push({ id: '', name: n, color: pal[_labels.length % pal.length] }); draw(); };
      $('crm-l-cancel').onclick = () => { _close(); _load(); };
      $('crm-l-save').onclick = async () => { try { _labels = await _call('/crm/labels', { labels: _labels }); APP.toast('🏷️ Labels saved', 'success'); _close(); _load(); } catch (e) { APP.toast(e.message, 'error'); } };
    };
    draw();
  }

  // ✏️ the ready messages: title, when, text with {…}
  function _panelTpls(box) {
    let list = _tpls.map(t => ({ ...t }));
    const draw = () => {
      box.innerHTML = `<h4>✏️ तयार messages</h4>
        <p class="crm-meta">जागा: ${esc(PLACEHOLDERS)}</p>
        ${list.map((t, i) => `<div class="crm-tpl-edit"><input class="admin-input" value="${esc(t.title)}" data-i="${i}" data-k="title" maxlength="60" aria-label="नाव"><input class="admin-input" value="${esc(t.when || '')}" data-i="${i}" data-k="when" maxlength="80" placeholder="कधी पाठवायचा" aria-label="कधी"><textarea class="admin-input crm-ttext" rows="4" data-i="${i}" data-k="text" aria-label="मजकूर">${esc(t.text)}</textarea><button type="button" class="admin-btn-secondary" data-del="${i}">🗑️ काढा</button></div>`).join('')}
        <div class="crm-acts"><button type="button" class="admin-btn-secondary" id="crm-t-add">➕ नवीन message</button><button type="button" class="admin-btn-secondary" id="crm-t-reset">↩️ मूळ messages</button></div>
        <div class="crm-acts"><button type="button" class="admin-btn-primary" id="crm-t-save">💾 Save</button><button type="button" class="admin-btn-secondary" id="crm-t-cancel">बंद</button></div>`;
      box.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => { list[inp.dataset.i][inp.dataset.k] = inp.value; });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { list.splice(Number(b.dataset.del), 1); draw(); });
      $('crm-t-add').onclick = () => { list.push({ id: 't' + Date.now().toString(36), title: 'नवीन message', when: '', text: 'नमस्कार 🙏 {नाव} साठी…{bot:TEST}' }); draw(); };
      $('crm-t-reset').onclick = () => { list = DEFAULT_TPLS.map(t => ({ ...t })); draw(); };
      $('crm-t-cancel').onclick = _close;
      $('crm-t-save').onclick = async () => {
        try { const saved = await _call('/crm/templates', { templates: list }); _tpls = saved?.length ? saved : DEFAULT_TPLS; APP.toast('✏️ Messages saved', 'success'); _close(); _load(); }
        catch (e) { APP.toast(e.message, 'error'); }
      };
    };
    draw();
  }

  // a risky button: the first tap asks, the second (within 5 s) does it
  function _sure(btn, run, ask = 'पक्कं? पुन्हा दाबा') {
    if (!btn.dataset.sure) {
      btn.dataset.label = btn.textContent; btn.dataset.sure = '1'; btn.textContent = ask;
      setTimeout(() => { if (btn.isConnected && btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = btn.dataset.label; } }, 5000);
      return;
    }
    btn.disabled = true; btn.textContent = '⏳';
    Promise.resolve().then(run).then(() => _load())
      .catch(err => { APP.toast(err?.message || 'झालं नाही', 'error'); })
      .finally(() => { if (btn.isConnected) { btn.disabled = false; delete btn.dataset.sure; btn.textContent = btn.dataset.label; } });
  }

  // Esc closes the open family's window
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _open) $('crm-close')?.click(); });
  function init() {
    if (!$('crm-admin')) return;
    if (!_ready) { _shell(); _ready = true; }
    _load();
  }
  return { init, _parse, _fill };
})();
window.CRM_ADMIN = CRM_ADMIN;
