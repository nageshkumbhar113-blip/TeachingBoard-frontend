/* ════════════════════════════════════════
   teacherCreateStudents.js — Teacher Dashboard › "➕ Students" (owner 2026-11-19)
   The teacher makes their students' accounts and pays for them:
     1. 📜 rules — read and accept once (per rules version), right here with their own login
     2. course + plan (Monthly / Yearly); the price shows the सूट (discount) the admin set for this teacher
     3. students — one by one, or a list pasted / an Excel or CSV file (नाव, mobile, शाळा)
     4. 👁 check → 💳 pay (pay.html, like a parent's payment) → accounts made, joined to this teacher
     5. 📄 PDF (codes, PINs, the app link, the rules) and a ready WhatsApp text; past orders keep their PDF
   A student who already has the course running is only joined (no money). The teacher cannot edit or
   delete a student afterwards (the admin can).
   Global: TEACHER_CREATE_STUDENTS
════════════════════════════════════════ */
const TEACHER_CREATE_STUDENTS = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.APP?.toast || (() => {}))(m, t);
  const money = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const showDay = d => (d ? String(d).split('-').reverse().join('-') : '');
  const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const H2C_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  const call = (method, path = '', body) => API.teacherOrders(method, path, body);

  let _setup = null, _list = [], _preview = null, _waiting = null;

  async function init() {
    const host = $('td-tab-create');
    if (!host) return;
    host.innerHTML = '<p class="td-hint">लोड होत आहे…</p>';
    try { _setup = (await call('GET', '/setup'))?.data; }
    catch (err) { host.innerHTML = `<p class="td-hint">${esc(err.message || 'उघडता आलं नाही')}</p>`; return; }
    paint();
  }

  // ── 1. rules ──
  function rulesHtml(r) {
    return `<div class="tcs-rules">${(r.sections || []).map(s => `<h5>${esc(s.title)}</h5><ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}</div>`;
  }
  function paintRules(host) {
    const r = _setup.rules.text;
    host.innerHTML = `
      <div class="tv-box">
        <h4 class="tv-h">📜 ${esc(r.title)}</h4>
        <p class="td-hint td-hint-sm">विद्यार्थी बनवण्याआधी हे नियम एकदा वाचून मान्य करा. (Version ${esc(r.version)})</p>
        ${rulesHtml(r)}
        <label class="tv-chk"><input type="checkbox" id="tcs-agree" /> ${esc(r.agreeText || 'मी हे सर्व नियम वाचले आहेत आणि ते मला मान्य आहेत.')}</label>
        <button type="button" class="td-send-notif-btn" id="tcs-accept">✅ नियम मान्य करा</button>
        <p class="td-hint td-hint-sm" id="tcs-rmsg" role="status"></p>
      </div>`;
    $('tcs-accept').onclick = async () => {
      if (!$('tcs-agree').checked) { $('tcs-rmsg').textContent = '⚠️ आधी ☑ करा'; return; }
      $('tcs-accept').disabled = true;
      try { await call('POST', '/accept-rules', { version: _setup.rules.version, agree: true }); toast('✅ नियम मान्य केले', 'success'); await init(); }
      catch (err) { $('tcs-rmsg').textContent = '⚠️ ' + (err.message || 'झालं नाही'); $('tcs-accept').disabled = false; }
    };
  }

  // ── 2–5. the form ──
  function priceLine(p) {
    if (!p || !(p.list > 0)) return 'किंमत ठरलेली नाही';
    return p.discount > 0
      ? `${money(p.list)} − सूट ${esc(p.rule)} (${money(p.discount)}) = <b>${money(p.unit)}</b> / विद्यार्थी`
      : `<b>${money(p.unit)}</b> / विद्यार्थी`;
  }
  function course() { return _setup.courses.find(c => c.name === $('tcs-course')?.value) || null; }
  function plan() { return document.querySelector('input[name="tcs-plan"]:checked')?.value || 'yearly'; }

  function paint() {
    const host = $('td-tab-create');
    if (!_setup.rules.accepted) { paintRules(host); return; }
    const d = _setup.discount;
    host.innerHTML = `
      <div class="tv-box">
        <h4 class="tv-h">➕ विद्यार्थ्यांची accounts बनवा</h4>
        <p class="td-hint td-hint-sm">पैसे भरल्यावर accounts लगेच तयार होतात आणि सगळे विद्यार्थी तुमच्याशी जोडले जातात. Code आणि PIN चा PDF मिळतो.</p>
        <div class="tcs-discount">🎁 तुमची सूट: <b>${d ? (d.mode === 'percent' ? `${d.value}%` : `${money(d.value)} / विद्यार्थी`) : 'नाही'}</b>${d ? '' : ' <small>(admin ठरवतो)</small>'}</div>
      </div>
      <div class="tv-box">
        <label class="tv-l">Course<select id="tcs-course" class="td-modal-select">${_setup.courses.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}</select></label>
        <div class="tcs-plans">
          <label class="tcs-plan"><input type="radio" name="tcs-plan" value="yearly" checked /> <b>Yearly</b> <small>(30 एप्रिल पर्यंत)</small><span id="tcs-p-yearly"></span></label>
          <label class="tcs-plan"><input type="radio" name="tcs-plan" value="monthly" /> <b>Monthly</b> <small>(30 दिवस)</small><span id="tcs-p-monthly"></span></label>
        </div>
      </div>
      <div class="tv-box">
        <h4 class="tv-h">👩‍🎓 विद्यार्थी जोडा</h4>
        <div class="tcs-one">
          <input id="tcs-name" class="td-modal-select" placeholder="विद्यार्थ्याचं पूर्ण नाव" autocomplete="off" />
          <input id="tcs-mobile" class="td-modal-select" placeholder="Mobile (10 अंकी)" inputmode="numeric" maxlength="10" />
          <input id="tcs-school" class="td-modal-select" placeholder="शाळा (हवं असेल तर)" />
          <button type="button" class="admin-btn-secondary" id="tcs-add">➕ यादीत जोडा</button>
        </div>
        <details class="tcs-bulk"><summary>📋 एकदम अनेक (list paste करा / Excel / CSV)</summary>
          <p class="td-hint td-hint-sm">एका ओळीत एक विद्यार्थी: <b>नाव, mobile, शाळा</b> (शाळा हवी तर).</p>
          <textarea id="tcs-paste" class="td-modal-select" rows="5" placeholder="आर्या पाटील, 9876543210, जि.प. शाळा&#10;ओम जाधव, 9123456789"></textarea>
          <div class="tv-actions">
            <button type="button" class="admin-btn-secondary" id="tcs-paste-add">➕ ही list जोडा</button>
            <label class="admin-btn-secondary tcs-file">📂 Excel / CSV निवडा<input type="file" id="tcs-file" accept=".xlsx,.xls,.csv,.txt" hidden /></label>
            <button type="button" class="admin-btn-secondary" id="tcs-sample">⬇️ नमुना file</button>
          </div>
        </details>
        <div id="tcs-list"></div>
      </div>
      <div class="tv-box" id="tcs-pay-box"></div>
      <div class="tv-box"><h4 class="tv-h">🧾 माझ्या मागच्या orders</h4><div id="tcs-orders"></div></div>`;
    const prices = () => {
      const c = course();
      $('tcs-p-yearly').innerHTML = '<br>' + priceLine(c?.yearly);
      $('tcs-p-monthly').innerHTML = '<br>' + priceLine(c?.monthly);
      _preview = null; paintPay();
    };
    $('tcs-course').onchange = prices;
    document.querySelectorAll('input[name="tcs-plan"]').forEach(r => { r.onchange = () => { _preview = null; paintPay(); }; });
    $('tcs-add').onclick = () => {
      const name = $('tcs-name').value.trim(), mobile = $('tcs-mobile').value.replace(/\D/g, '').slice(-10), school = $('tcs-school').value.trim();
      if (!name) return toast('नाव लिहा', 'error');
      if (!/^[6-9]\d{9}$/.test(mobile)) return toast('10 अंकी mobile लिहा', 'error');
      addRows([{ name, mobile, school }]);
      $('tcs-name').value = ''; $('tcs-mobile').value = ''; $('tcs-name').focus();
    };
    $('tcs-paste-add').onclick = () => { const rows = parseLines($('tcs-paste').value); if (!rows.length) return toast('list रिकामी आहे', 'error'); addRows(rows); $('tcs-paste').value = ''; };
    $('tcs-file').onchange = async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addRows(await readFile(f).catch(err => { toast(err.message, 'error'); return []; })); };
    $('tcs-sample').onclick = sample;
    prices();
    paintList();
    paintOrders();
  }

  // "नाव, mobile, शाळा" lines (comma / tab / semicolon); a header line is skipped
  function parseLines(text) {
    return String(text || '').split(/\r?\n/).map(l => l.split(/[,\t;]/).map(x => x.trim())).filter(c => c[0] && !/^(name|नाव)$/i.test(c[0]))
      .map(c => {
        const mi = c.findIndex(x => /\d{10}/.test(x.replace(/\D/g, '')));
        const mobile = mi >= 0 ? c[mi].replace(/\D/g, '').slice(-10) : '';
        const rest = c.filter((_, i) => i !== mi);
        return { name: rest[0] || '', mobile, school: rest[1] || '' };
      });
  }
  async function readFile(file) {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      await loadScript(XLSX_CDN, () => window.XLSX);
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const table = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      return parseLines(table.map(r => r.join('\t')).join('\n'));
    }
    return parseLines(await file.text());
  }
  function sample() {
    const csv = '﻿नाव,mobile,शाळा\nआर्या पाटील,9876543210,जि.प. शाळा\nओम जाधव,9123456789,\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (window.FILE_EXPORT?.saveAndShare) FILE_EXPORT.saveAndShare(blob, 'students-namuna.csv').catch(() => {});
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students-namuna.csv'; a.click(); }
  }
  function addRows(rows) {
    const seen = new Set(_list.map(r => r.mobile + '|' + r.name.toLowerCase()));
    let n = 0;
    for (const r of rows) {
      const k = r.mobile + '|' + String(r.name).toLowerCase();
      if (!r.name || seen.has(k)) continue;
      seen.add(k); _list.push({ name: r.name, mobile: r.mobile, school: r.school || '' }); n++;
    }
    if (_list.length > 200) { _list = _list.slice(0, 200); toast('एका वेळी 200 पर्यंत', 'error'); }
    if (n) toast(`${n} विद्यार्थी यादीत जोडले`, 'success');
    _preview = null;
    paintList(); paintPay();
  }
  function paintList() {
    const box = $('tcs-list');
    if (!_list.length) { box.innerHTML = '<p class="td-hint td-hint-sm">अजून कोणी नाही.</p>'; return; }
    const pv = _preview ? new Map(_preview.rows.map((r, i) => [i, r])) : null;
    const tag = r => !r ? '' : r.action === 'error' ? `<span class="tcs-bad">❌ ${esc((r.errors || []).join(', '))}</span>`
      : r.action === 'join' ? '<span class="tcs-join">🔗 आधीच आहे — फक्त जोडला जाईल (पैसे नाहीत)</span>'
      : r.action === 'update' ? '<span class="tcs-upd">🔄 आधीचा विद्यार्थी — course जोडला जाईल</span>' : '<span class="tcs-new">🆕 नवीन</span>';
    box.innerHTML = `<p class="td-hint td-hint-sm">यादी: <b>${_list.length}</b> विद्यार्थी</p>` + _list.map((r, i) => `
      <div class="tcs-row"><span><b>${esc(r.name)}</b> · ${esc(r.mobile)}${r.school ? ` · <small>${esc(r.school)}</small>` : ''}<br>${tag(pv?.get(i))}</span>
      <button type="button" class="admin-btn-secondary" data-rm="${i}" aria-label="काढा">✕</button></div>`).join('');
    box.querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => { _list.splice(Number(b.dataset.rm), 1); _preview = null; paintList(); paintPay(); }; });
  }

  function paintPay() {
    const box = $('tcs-pay-box');
    if (!box) return;
    if (_waiting) {
      box.innerHTML = `<h4 class="tv-h">💳 Payment</h4>
        <p class="td-hint">Payment साठी browser उघडला आहे (${money(_waiting.amount)}). पैसे भरून झाल्यावर इथे परत या.</p>
        <button type="button" class="td-send-notif-btn" id="tcs-check">✅ मी पैसे भरले — तपासा</button>
        <button type="button" class="admin-btn-secondary" id="tcs-cancel">रद्द</button>
        <p class="td-hint td-hint-sm" id="tcs-pmsg" role="status"></p>`;
      $('tcs-check').onclick = () => poll(_waiting.order_no, 0, true);
      $('tcs-cancel').onclick = () => { _waiting = null; paintPay(); };
      return;
    }
    const c = course(), p = c?.[plan()];
    if (!_list.length) { box.innerHTML = '<p class="td-hint td-hint-sm">विद्यार्थी जोडल्यावर इथे एकूण रक्कम दिसेल.</p>'; return; }
    if (!_preview) {
      box.innerHTML = `<p class="td-hint">${_list.length} विद्यार्थी · ${priceLine(p)}</p>
        <button type="button" class="td-send-notif-btn" id="tcs-check-list">👁 यादी तपासा</button>`;
      $('tcs-check-list').onclick = check;
      return;
    }
    const s = _preview.summary;
    box.innerHTML = `<h4 class="tv-h">🧾 सारांश</h4>
      <p>🆕 नवीन ${s.create} · 🔄 आधीचे ${s.update} · 🔗 फक्त जोडायचे ${s.join}${s.errors ? ` · <span class="tcs-bad">❌ चूक ${s.errors}</span>` : ''}</p>
      <p>${s.charged} विद्यार्थी × ${money(_preview.price.unit)}${_preview.price.discount > 0 ? ` <small>(${money(_preview.price.list)} − सूट ${esc(_preview.price.rule)})</small>` : ''} = <b class="tcs-total">${money(s.amount)}</b></p>
      <p class="td-hint td-hint-sm">मुदत: ${showDay(_preview.expiry)} पर्यंत · ${esc(_preview.batch)} · ${_preview.plan === 'monthly' ? 'Monthly' : 'Yearly'}</p>
      ${s.errors ? '<p class="tcs-bad">आधी ❌ असलेले विद्यार्थी दुरुस्त करा किंवा ✕ ने काढा.</p>'
        : `<button type="button" class="td-send-notif-btn" id="tcs-pay">${s.amount > 0 ? `💳 ${money(s.amount)} भरा` : '✅ जोडा (पैसे नाहीत)'}</button>`}
      ${s.amount > 100000 ? '<p class="td-hint td-hint-sm">⚠️ ₹1 लाखापेक्षा जास्त — UPI ची मर्यादा येऊ शकते; card / net banking वापरा किंवा यादी 2 भागात करा.</p>' : ''}`;
    $('tcs-pay')?.addEventListener('click', pay);
  }

  async function check() {
    const btn = $('tcs-check-list'); if (btn) btn.disabled = true;
    try { _preview = (await call('POST', '/preview', { batch: $('tcs-course').value, plan: plan(), rows: _list }))?.data; }
    catch (err) { toast(err.message || 'तपासता आलं नाही', 'error'); if (btn) btn.disabled = false; return; }
    paintList(); paintPay();
  }

  async function pay() {
    const btn = $('tcs-pay'); btn.disabled = true;
    let r;
    try { r = (await call('POST', '', { batch: $('tcs-course').value, plan: plan(), rows: _list }))?.data; }
    catch (err) { toast(err.message || 'झालं नाही', 'error'); btn.disabled = false; return; }
    if (r.status === 'done') { done(r); return; }
    const c = r.checkout;
    const params = new URLSearchParams({ order_id: c.order_id, amount: String(c.amount), currency: c.currency || 'INR', key_id: c.key_id, batch: c.label, period: r.plan, name: c.name || '', contact: c.contact || '' });
    const url = `https://nkseduorbit.in/pay.html?${params}`;
    const Browser = window.Capacitor?.Plugins?.Browser;
    if (Browser) Browser.open({ url }); else window.open(url, '_blank', 'noopener');
    _waiting = { order_no: r.order_no, amount: r.amount };
    paintPay();
    poll(r.order_no, 0, false);
  }

  async function poll(no, tries, loud) {
    if (!_waiting || _waiting.order_no !== no) return;
    if (loud) { const m = $('tcs-pmsg'); if (m) m.textContent = '⏳ तपासत आहे…'; }
    try {
      const o = (await call('GET', '/' + encodeURIComponent(no)))?.data;
      if (o?.status === 'done') { _waiting = null; done(o); return; }
    } catch { /* keep waiting */ }
    if (loud && tries >= 5) { const m = $('tcs-pmsg'); if (m) m.textContent = 'अजून payment दिसत नाही. पैसे भरले असतील तर 1 मिनिटाने परत तपासा.'; return; }
    setTimeout(() => poll(no, tries + 1, loud), loud ? 2000 : 5000 + Math.min(tries, 60) * 500);
  }

  function done(o) {
    _list = []; _preview = null;
    window.TEACHER_DASHBOARD?.refreshStudents?.();   // the Students tab shows them at once
    toast(`🎉 ${o.rows?.filter(r => r.status !== 'error').length || o.students} विद्यार्थी तयार!`, 'success');
    init().then(() => showDone(o));
  }
  function showDone(o) {
    const box = $('tcs-pay-box'); if (!box) return;
    const ok = (o.rows || []).filter(r => r.status !== 'error'), bad = (o.rows || []).filter(r => r.status === 'error');
    box.innerHTML = `<h4 class="tv-h">🎉 ${ok.length} विद्यार्थी तयार आणि तुमच्याशी जोडले</h4>
      ${bad.length ? `<p class="tcs-bad">❌ ${bad.length} झाले नाहीत: ${esc(bad.map(r => r.name + ' (' + r.error + ')').join(', '))} — admin ला सांगा.</p>` : ''}
      <div class="tv-actions"><button type="button" class="td-send-notif-btn" data-pdf="${esc(o.order_no)}">📄 PDF (Code, PIN)</button>
      <button type="button" class="admin-btn-secondary" data-wa="${esc(o.order_no)}">📲 WhatsApp संदेश</button></div>`;
    bindOrderButtons(box);
  }

  function paintOrders() {
    const box = $('tcs-orders'); if (!box) return;
    const list = _setup.orders || [];
    if (!list.length) { box.innerHTML = '<p class="td-hint td-hint-sm">अजून नाही.</p>'; return; }
    const st = { done: '✅ झालं', paid: '⏳ बनत आहे', created: '💳 पैसे बाकी', failed: '❌' };
    box.innerHTML = list.map(o => `<div class="tcs-row"><span><b>${esc(o.batch)}</b> · ${o.students} विद्यार्थी · ${money(o.amount)}<br><small>${new Date(o.created_at).toLocaleDateString('en-IN')} · ${o.plan === 'monthly' ? 'Monthly' : 'Yearly'} · मुदत ${showDay(o.expiry)} · ${st[o.status] || o.status}</small></span>
      ${o.status === 'done' ? `<span class="tv-btns"><button type="button" class="admin-btn-secondary" data-pdf="${esc(o.order_no)}">📄 PDF</button><button type="button" class="admin-btn-secondary" data-wa="${esc(o.order_no)}">📲</button></span>` : ''}</div>`).join('');
    bindOrderButtons(box);
  }
  function bindOrderButtons(box) {
    box.querySelectorAll('[data-pdf]').forEach(b => { b.onclick = async () => { b.disabled = true; try { await pdf(await order(b.dataset.pdf)); } catch (err) { toast(err.message || 'PDF झाला नाही', 'error'); } b.disabled = false; }; });
    box.querySelectorAll('[data-wa]').forEach(b => { b.onclick = async () => { try { await share(await order(b.dataset.wa)); } catch (err) { toast(err.message || 'झालं नाही', 'error'); } }; });
  }
  const order = async no => (await call('GET', '/' + encodeURIComponent(no)))?.data;

  // the message for the students (each one's code + PIN, the app link)
  function waText(o) {
    const ok = (o.rows || []).filter(r => r.status !== 'error');
    return [`📚 NKs EduOrbit — ${o.batch}`, `App: ${_setup.app_link}`, 'App मध्ये Student code आणि PIN टाकून login करा:', '',
      ...ok.map(r => `${r.name}: Code ${r.student_code} · PIN ${r.pin || '(जुनाच)'}`), '', `— ${_setup.teacher.name}${_setup.teacher.institute ? ', ' + _setup.teacher.institute : ''}`].join('\n');
  }
  async function share(o) {
    const text = waText(o);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* closed */ } }
    try { await navigator.clipboard.writeText(text); toast('📋 संदेश copy झाला — WhatsApp मध्ये paste करा', 'success'); }
    catch { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }
  }

  // ── PDF: the page drawn here, then html2canvas + jsPDF (Devanagari prints right) ──
  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => (ready() ? res() : rej(new Error('PDF tool load झालं नाही'))); s.onerror = () => rej(new Error('Internet तपासा')); document.head.appendChild(s); });
  }
  function pdfHtml(o) {
    const t = _setup.teacher, rules = _setup.rules.text, ok = (o.rows || []).filter(r => r.status !== 'error');
    return `<div style="width:760px;padding:24px;background:#fff;color:#111;font-family:'Noto Sans Devanagari','Baloo 2',Mukta,sans-serif;font-size:13px;line-height:1.45">
      <h1 style="font-size:22px;margin:0 0 4px;color:#001F5C">विद्यार्थी Login माहिती</h1>
      <div style="color:#555">NKs EduOrbit · ${new Date().toLocaleDateString('en-IN')} · Order ${esc(o.order_no)}</div>
      <div style="border:1px solid #ccd;border-radius:8px;padding:10px;margin:10px 0">
        <b>शिक्षक:</b> ${esc(t.name)} (${esc(t.code)})${t.institute ? ' · ' + esc(t.institute) : ''}<br>
        <b>Course:</b> ${esc(o.batch)} · ${o.plan === 'monthly' ? 'Monthly' : 'Yearly'} · <b>मुदत:</b> ${showDay(o.expiry)} पर्यंत · <b>विद्यार्थी:</b> ${ok.length}<br>
        <b>App:</b> ${esc(_setup.app_link)} — App मध्ये Student code आणि PIN टाका. PIN = mobile चे शेवटचे 4 अंक (आधीच्या विद्यार्थ्यांचा जुना PIN तसाच).
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr>${['#', 'नाव', 'Mobile', 'Student code', 'PIN'].map(h => `<th style="background:#001F5C;color:#fff;padding:6px;border:1px solid #bbb;text-align:left">${h}</th>`).join('')}</tr>
        ${ok.map((r, i) => `<tr style="background:${i % 2 ? '#f5f7fb' : '#fff'}"><td style="border:1px solid #bbb;padding:5px">${i + 1}</td><td style="border:1px solid #bbb;padding:5px">${esc(r.name)}</td><td style="border:1px solid #bbb;padding:5px">${esc(r.mobile)}</td><td style="border:1px solid #bbb;padding:5px;font-family:Consolas,monospace;font-weight:700">${esc(r.student_code)}</td><td style="border:1px solid #bbb;padding:5px;font-family:Consolas,monospace;font-weight:700">${esc(r.pin || 'जुना')}</td></tr>`).join('')}
      </table>
      <h2 style="font-size:17px;color:#001F5C;margin:22px 0 4px">📜 ${esc(rules.title)}</h2>
      <div style="color:#555;font-size:11px">Version ${esc(rules.version)} · मान्य केले: ${_setup.rules.accepted_at ? new Date(_setup.rules.accepted_at).toLocaleString('en-IN') : ''}</div>
      ${(rules.sections || []).map(s => `<h3 style="font-size:13px;margin:10px 0 2px">${esc(s.title)}</h3><ul style="margin:0;padding-left:18px">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
      <div style="margin-top:14px;color:#555;font-size:11px;text-align:center">NKs EduOrbit — केवळ वर्गात शिकवण्यासाठी · ${esc(t.name)} (${esc(t.code)})</div>
    </div>`;
  }
  async function pdf(o) {
    toast('📄 PDF तयार होत आहे…');
    await loadScript(JSPDF_CDN, () => window.jspdf?.jsPDF);
    await loadScript(H2C_CDN, () => window.html2canvas);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-99999px;top:0';
    holder.innerHTML = pdfHtml(o);
    document.body.appendChild(holder);
    let canvas;
    try { try { await document.fonts.ready; } catch { /* old WebView */ } canvas = await window.html2canvas(holder.firstElementChild, { scale: 2, backgroundColor: '#ffffff' }); }
    finally { holder.remove(); }
    const doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10, cw = W - 2 * M, ch = H - 2 * M;
    const pxPerMm = canvas.width / cw, slice = Math.floor(ch * pxPerMm);
    for (let y = 0, first = true; y < canvas.height; y += slice, first = false) {
      const h = Math.min(slice, canvas.height - y), part = document.createElement('canvas');
      part.width = canvas.width; part.height = h;
      const g = part.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, part.width, h); g.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!first) doc.addPage();
      doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, cw, h / pxPerMm);
    }
    const blob = doc.output('blob'), name = `students-${o.batch.replace(/[^\wऀ-ॿ]+/g, '-').slice(0, 30)}-${o.order_no}.pdf`;
    if (window.FILE_EXPORT?.saveAndShare) await FILE_EXPORT.saveAndShare(blob, name);
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  }

  return { init, _test: { parseLines, pdfHtml: o => pdfHtml(o) } };
})();
window.TEACHER_CREATE_STUDENTS = TEACHER_CREATE_STUDENTS;
