/* ════════════════════════════════════════
   crmAdmin.js — Admin › 📇 CRM
   Global: CRM_ADMIN

   The WhatsApp bot's families (Cloudflare Worker, TeachingBoard-backend/wa-worker). Render gives a
   12-hour token (/guest/admin/bot-token); every list / chat / action goes straight to the Worker.
   Lists: 🔥 hot (tests, not paid) · ❄️ cold (no reply) · 📞 asked for a call · 📝 form number ·
   ⏰ call later · 💬 active · ✅ paid · ❌ closed · 📅 next year (closed, back on 1 June).
   Actions: call, "📱 टीमच्या WhatsApp वरून" (free: the team's own WhatsApp opens with the text and the
   bot's chat link), the call result, a reply inside the open window, a note, and — only when really
   needed — the bot-number template (paid, double tap).
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
  const LISTS = [
    ['first', '☀️ आधी call'], ['hot', '🔥 गरम'], ['cold', '❄️ थंड'], ['call', '📞 Call मागितला'], ['form', '📝 Form नंबर'], ['later', '⏰ नंतर'],
    ['active', '💬 चालू'], ['paid', '✅ Paid'], ['closed', '❌ Closed'], ['nextyear', '📅 पुढचं वर्ष'],
  ];
  const REASONS = ['फी जास्त', 'पाल्याला वेळ नाही', 'दुसरा क्लास', 'Phone नाही', 'इतर'];
  let _conn = null;              // { url, token, at }
  let _list = 'first', _q = '', _open = '', _ready = false;
  let _waReady = null;           // { gid, waMe, text }: a team message ready to open (a real tap opens WhatsApp)

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
      <div class="crm-head"><h3>📇 CRM — WhatsApp पालक</h3><button type="button" class="admin-btn-secondary" id="crm-refresh">🔄</button></div>
      <p class="crm-status" id="crm-status">⏳ उघडत आहे…</p>
      <div class="crm-chips" id="crm-chips" role="tablist" aria-label="याद्या"></div>
      <input class="admin-input crm-search" id="crm-q" type="search" placeholder="नाव / नंबर शोधा" aria-label="शोधा">
      <div id="crm-rows" class="crm-rows"></div>
      <div id="crm-lead" class="crm-lead hidden" aria-live="polite"></div>`;
    $('crm-refresh').onclick = () => _load(true);
    let t; $('crm-q').oninput = e => { clearTimeout(t); t = setTimeout(() => { _q = e.target.value.trim(); _rows(); }, 300); };
  }

  async function _load(force) {
    try {
      if (force) _conn = null;
      if (!(await _connect())) {
        $('crm-status').innerHTML = '⚠️ WhatsApp bot अजून जोडलेला नाही — Render मध्ये <b>WA_WORKER_URL</b> आणि <b>BOT_SHARED_SECRET</b> ठेवायचे आहेत.';
        $('crm-chips').innerHTML = ''; $('crm-rows').innerHTML = ''; return;
      }
      const s = await _call('/crm/summary');
      const tickAge = s.last_tick ? (Date.now() - s.last_tick) / 60000 : Infinity;
      $('crm-status').innerHTML = [
        s.bot_off ? '⛔ <b>Bot बंद (BOT_OFF)</b>' : !s.last_tick ? '⏳ Bot नवीन — पहिला tick 10 मिनिटांत' : tickAge < 25 ? '❤️ Bot चालू' : '⚠️ Bot चा tick थांबला आहे (25 मिनिटांपेक्षा जास्त)',
        `शेवटचा tick: ${ago(s.last_tick)}`, `शेवटचा मेसेज: ${ago(s.last_webhook)}`,
        `आजचा खर्च ₹${(s.cost_today || 0).toFixed(2)} / मर्यादा ₹${s.cap}`, `महिना ₹${(s.cost_month || 0).toFixed(2)}`,
        s.jobs ? `⏳ Render कडे पाठवायची ${s.jobs} काम बाकी` : '',
      ].filter(Boolean).join(' · ');
      $('crm-chips').innerHTML = LISTS.map(([k, label]) =>
        `<button type="button" role="tab" class="crm-chip${k === _list ? ' on' : ''}" aria-selected="${k === _list}" data-list="${k}">${label} <b>${s.counts[k] || 0}</b></button>`).join('');
      $('crm-chips').querySelectorAll('.crm-chip').forEach(b => b.onclick = () => { _list = b.dataset.list; _open = ''; _load(); });
      await _rows();
      if (_open) await _lead(_open);
    } catch (e) { $('crm-status').textContent = '⚠️ ' + e.message; }
  }

  async function _rows() {
    const rows = await _call(`/crm/list?list=${_list}&q=${encodeURIComponent(_q)}`).catch(e => { APP.toast(e.message, 'error'); return []; });
    $('crm-rows').innerHTML = rows.length ? rows.map(r => `
      <button type="button" class="crm-row${r.gid === _open ? ' on' : ''}" data-gid="${esc(r.gid)}">
        <span class="crm-name">${esc(r.name || '—')} <small>${esc(r.cls || '')}</small></span>
        <span class="crm-meta">${r.mobile ? '📱 ' + esc(r.mobile) : '—'} · 📝 ${r.tests || 0}/${r.free_total || 0}${r.open ? ' · 🟢 खिडकी उघडी' : ''}${r.app ? ' · 📲 app' : ''}</span>
        <span class="crm-meta">${r.closed ? '❌ ' + esc(r.closed) + ' · ' : ''}शेवटचा reply ${ago(r.last_in)}</span>
        ${r.offer_end || r.mt ? `<span class="crm-meta crm-hot">${r.offer_end ? `🎁 सूट ${left(r.offer_end)}` : ''}${r.offer_end && r.mt ? ' · ' : ''}${r.mt ? `🏆 महा-Test ${r.mt.score}/${r.mt.total}${r.mt.rank ? ` · #${r.mt.rank}/${r.mt.of}` : ''}` : ''}</span>` : ''}
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
    const box = $('crm-lead'); box.classList.remove('hidden'); box.innerHTML = '⏳';
    let d; try { d = await _call('/crm/lead/' + gid); } catch (e) { box.textContent = '⚠️ ' + e.message; return; }
    const L = d.lead;
    box.innerHTML = `
      <div class="crm-lead-head">
        <div><b>${esc(L.name || '—')}</b> · ${esc(L.cls || '')} · ${L.mobile ? `<a href="tel:+91${esc(L.mobile)}">📞 ${esc(L.mobile)}</a>` : 'नंबर नाही'}
          <div class="crm-meta">📝 ${L.testsDone || 0}/${L.freeTotal || 0} tests · ${L.paid ? '✅ Paid' : 'pay नाही'} · ${d.open ? '🟢 खिडकी उघडी (मोफत)' : '⚪ खिडकी बंद'}${L.daily && L.daily !== 'no' ? ` · रोज ${Number(L.daily) - 12} वाजता` : ''}</div></div>
        <button type="button" class="admin-btn-secondary" id="crm-close" aria-label="बंद करा">✕</button>
      </div>
      <div class="crm-acts">
        <button type="button" class="admin-btn-primary" id="crm-team">📱 टीमच्या WhatsApp वरून (₹0)</button>
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
    $('crm-close').onclick = () => { _open = ''; box.classList.add('hidden'); _rows(); };
    // the message is ready: show a real link (a window opened after a network wait is often blocked)
    const openTeam = r => { const t = r?.team?.[0]; _waReady = t?.waMe ? { gid, waMe: t.waMe, text: t.text } : null; };
    if ($('crm-wa-open')) $('crm-wa-open').onclick = () => { _waReady = null; setTimeout(() => _lead(gid), 300); };
    const act = (btn, fn) => async () => {
      btn.disabled = true;
      try { await fn(); await _load(); } catch (e) { APP.toast(e.message, 'error'); } finally { if (btn.isConnected) btn.disabled = false; }
    };
    $('crm-team').onclick = act($('crm-team'), async () => openTeam(await _call(`/crm/lead/${gid}/team`, {})));
    if ($('crm-pay')) {
      $('crm-pay').onclick = act($('crm-pay'), async () => openTeam(await _call(`/crm/lead/${gid}/call`, { result: 'will_pay' })));
      $('crm-later').onclick = act($('crm-later'), async () => { await _call(`/crm/lead/${gid}/call`, { result: 'later', at: $('crm-later-at').value || 'लवकरच' }); APP.toast('⏰ नंतरच्या call ची नोंद', 'success'); });
      $('crm-ni').onclick = () => _sure($('crm-ni'), async () => { await _call(`/crm/lead/${gid}/call`, { result: 'not_interested', reason: $('crm-reason').value }); APP.toast('❌ Close — 1 जूनला पुन्हा यादीत', 'success'); });
    }
    $('crm-tpl').onclick = () => _sure($('crm-tpl'), async () => { await _call(`/crm/lead/${gid}/bot-template`, {}); APP.toast('Template पाठवायचा प्रयत्न केला — chat मध्ये निकाल पाहा', 'info'); }, '₹0.86 लागतील — पुन्हा दाबा');
    $('crm-note').onclick = act($('crm-note'), async () => { const t = $('crm-reply-text').value.trim(); if (!t) throw new Error('Note लिहा'); await _call(`/crm/lead/${gid}/note`, { text: t }); });
    $('crm-reply').onsubmit = e => { e.preventDefault(); const t = $('crm-reply-text').value.trim(); if (!t) return; act(e.submitter || $('crm-reply'), async () => { await _call(`/crm/lead/${gid}/reply`, { text: t }); })(); };
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
      .catch(err => { APP.toast(err?.message || 'झालं नाही', 'error'); if (btn.isConnected) { btn.disabled = false; delete btn.dataset.sure; btn.textContent = btn.dataset.label; } });
  }

  function init() {
    if (!$('crm-admin')) return;
    if (!_ready) { _shell(); _ready = true; }
    _load();
  }
  return { init };
})();
window.CRM_ADMIN = CRM_ADMIN;
