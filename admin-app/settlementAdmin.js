/* ════════════════════════════════════════
   settlementAdmin.js - Admin > 💸 Settlement
   One place for every payout (school teachers, YouTube partners, shops):
   money in vs out, who has to be paid for a month (UPI + UTR + Paid), each
   person's all-time account (earned = paid + to pay + carried + running),
   the financial year (Apr–Mar, TDS hint), students' prizes, a person's full
   history, WhatsApp receipt and CSV download for the CA.
   Server: TeachingBoard-backend GET /api/partners/settlement(/:id)
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  const rs = n => `₹${r2(n).toLocaleString('en-IN')}`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = m => { const [y, mo] = String(m).split('-'); return `${MONTHS[Number(mo) - 1] || mo} ${y}`; };
  const dateText = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const TYPES = { school: '👩‍🏫 Teacher', youtube: '🎬 YouTube', shop: '🏪 Shop' };
  const TYPE_TEXT = { school: 'Teacher', youtube: 'YouTube', shop: 'Shop' };

  let _bound = false;
  let _data = null;
  let _month = '';
  let _fy = '';
  let _type = 'all';
  let _view = 'month';
  let _open = '';            // person whose history is open
  const _history = {};

  async function init() {
    if (!_bound) { _bind(); _bound = true; }
    await load();
  }

  function _bind() {
    $('st-month')?.addEventListener('change', e => { _month = e.target.value; load(); });
    $('st-fy')?.addEventListener('change', e => { _fy = e.target.value; load(); });
    $('st-search')?.addEventListener('input', _render);
    $('st-types')?.addEventListener('click', e => {
      const b = e.target.closest('[data-st-type]');
      if (!b) return;
      _type = b.dataset.stType;
      $('st-types').querySelectorAll('[data-st-type]').forEach(x => x.classList.toggle('on', x === b));
      _render();
    });
    $('st-views')?.addEventListener('click', e => {
      const b = e.target.closest('[data-st-view]');
      if (!b) return;
      _view = b.dataset.stView;
      $('st-views').querySelectorAll('[data-st-view]').forEach(x => x.classList.toggle('on', x === b));
      _render();
    });
    $('st-csv')?.addEventListener('click', _downloadCsv);
    $('st-refresh')?.addEventListener('click', load);
    $('st-body')?.addEventListener('click', _onClick);
  }

  function _fillPickers(d) {
    const ms = $('st-month');
    if (ms && !ms.dataset.filled) {
      const [cy, cm] = d.current_month.split('-').map(Number);
      const opts = [];
      for (let i = 1; i <= 24; i++) {
        const dt = new Date(Date.UTC(cy, cm - 1 - i, 1));
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        opts.push(`<option value="${key}">${monthLabel(key)}${i === 1 ? ' (मागचा महिना)' : ''}</option>`);
      }
      ms.innerHTML = opts.join('');
      ms.dataset.filled = '1';
    }
    if (ms) ms.value = d.month;
    const fs = $('st-fy');
    if (fs && !fs.dataset.filled) {
      const opts = [];
      for (let y = d.fy; y >= d.fy - 4; y--) opts.push(`<option value="${y}">${y}-${String(y + 1).slice(2)} (एप्रिल–मार्च)</option>`);
      fs.innerHTML = opts.join('');
      fs.dataset.filled = '1';
    }
    if (fs) fs.value = String(d.fy);
  }

  async function load() {
    const body = $('st-body');
    if (body && !_data) body.innerHTML = '<p class="import-hint">⏳ उघडत आहे…</p>';
    try {
      _data = await API.fetchSettlement(_month, _fy);
      _month = _data.month;
      _fy = String(_data.fy);
      _fillPickers(_data);
      Object.keys(_history).forEach(k => delete _history[k]);
      _render();
      if (_open) _loadHistory(_open);
    } catch (err) {
      if (body) body.innerHTML = `<p class="import-hint">Settlement load झालं नाही: ${esc(err.message)}</p>`;
    }
  }

  // ── top: money in / out + payouts ─────────────────────────────────────────
  function _cards(d) {
    const t = d.totals, mm = d.money.month, yy = d.money.year;
    const moneyBox = (title, m) => `<div class="st-money">
      <div class="st-money-title">${title}</div>
      <div class="st-money-row"><span>⬇️ आले (payments)</span><b class="st-in">${rs(m.in_total)}</b></div>
      <small>Students ${m.in_students_count} · ${rs(m.in_students)}${m.in_teachers ? ` · Teachers ${m.in_teachers_count} · ${rs(m.in_teachers)}` : ''}</small>
      <div class="st-money-row"><span>⬆️ गेले (payout दिले)</span><b class="st-out">${rs(m.paid_out)}</b></div>
      <small>${m.paid_out_count} payouts · या काळातल्या payments वरचं commission ${rs(m.commission_earned)}</small>
      <div class="st-money-row st-net"><span>= शिल्लक</span><b>${rs(m.net)}</b></div></div>`;
    $('st-money').innerHTML = moneyBox(`📅 ${esc(monthLabel(d.month))}`, mm) + moneyBox(`📆 वर्ष ${esc(d.fy_label)}`, yy);
    $('st-cards').innerHTML = `
      <div class="pa-card st-due"><small>${esc(monthLabel(d.month))} — द्यायचे</small><b>${rs(t.month_due)}</b><small>2–5 तारखेला UPI ने</small></div>
      <div class="pa-card st-paid"><small>${esc(monthLabel(d.month))} — दिले</small><b>${rs(t.month_paid)}</b><small>${t.month_carried ? `${rs(t.month_carried)} पुढे गेले (किमान ₹${d.min_payout})` : 'UTR सह'}</small></div>
      <div class="pa-card"><small>सगळे बाकी (बंद महिने)</small><b>${rs(t.all_due)}</b><small>जुने पण, न दिलेले</small></div>
      <div class="pa-card"><small>चालू महिना (${esc(monthLabel(d.current_month))})</small><b>${rs(t.running)}</b><small>1 तारखेला हिशोब बंद</small></div>
      <div class="pa-card"><small>आतापर्यंत एकूण दिले</small><b>${rs(t.life_paid)}</b><small>एकूण देणं बाकी ${rs(t.life_owed)}</small></div>
      <div class="pa-card"><small>Students बक्षीस</small><b>${t.prizes_to_send}</b><small>पाठवायचे · ${t.prizes_sent} पाठवले</small></div>
      ${t.balanced ? '' : '<div class="pa-card st-warn"><small>⚠️ हिशोब जुळत नाही</small><b>तपासा</b><small>एखाद्याची बेरीज वेगळी आहे</small></div>'}`;
  }

  function _match(p, q) {
    if (!q) return true;
    return [p.name, p.owner, p.code, p.mobile, p.area, p.upi_id].some(v => String(v || '').toLowerCase().includes(q));
  }

  function _rows() {
    const q = ($('st-search')?.value || '').trim().toLowerCase();
    return _data.partners.filter(p => (_type === 'all' || p.type === _type) && _match(p, q));
  }

  function _students() {
    const q = ($('st-search')?.value || '').trim().toLowerCase();
    return _data.students.filter(s => !q || [s.name, s.code, s.mobile].some(v => String(v || '').toLowerCase().includes(q)));
  }

  function _render() {
    if (!_data) return;
    _cards(_data);
    const body = $('st-body');
    if (_type === 'students') { body.innerHTML = _studentsHtml(_students()); return; }
    const rows = _rows();
    body.innerHTML = _view === 'year' ? _yearHtml(rows) : _view === 'all' ? _lifeHtml(rows) : _monthHtml(rows);
  }

  // ── pieces ────────────────────────────────────────────────────────────────
  function _upiLink(p, amount, month) {
    const q = new URLSearchParams({ pa: p.upi_id, pn: p.upi_name || p.name, am: String(amount), cu: 'INR', tn: `NksEduOrbit ${month}` });
    return `upi://pay?${q.toString()}`;
  }

  function _receiptLink(p, m, month) {
    const text = [
      `नमस्कार ${p.owner || p.name} 🙏`,
      `NKs EduOrbit कडून ${monthLabel(month)} चं commission ${rs(m.net)} UPI ने पाठवलं आहे ✅`,
      `UTR: ${m.utr}`,
      `UPI: ${p.upi_id}`,
      `धन्यवाद! पुढच्या महिन्यासाठी शुभेच्छा 🎉`,
    ].join('\n');
    return `https://wa.me/91${p.mobile}?text=${encodeURIComponent(text)}`;
  }

  function _who(p) {
    return `<button type="button" class="st-who" data-st-act="history" data-id="${esc(p.id)}" title="पूर्ण हिशोब पाहा">
      <b>${esc(p.name)}</b>${p.status !== 'active' ? ` <span class="pa-badge">${esc(p.status)}</span>` : ''} <span class="st-more">${_open === p.id ? '▲' : '▼'}</span></button><br>
      <small>${TYPES[p.type] || esc(p.type)} · ${esc(p.code)}${p.mobile ? ` · <a href="https://wa.me/91${esc(p.mobile)}" target="_blank" rel="noopener">${esc(p.mobile)}</a>` : ''}${p.area ? ' · ' + esc(p.area) : ''}</small>
      ${p.tds_warn ? '<br><small class="pa-warn">⚠️ वर्षात ₹15,000+ आणि PAN नाही (TDS)</small>' : ''}
      ${p.lifetime.balanced ? '' : '<br><small class="pa-warn">⚠️ बेरीज जुळत नाही</small>'}`;
  }

  function _status(p) {
    const m = p.month;
    if (!m) return '<span class="pa-badge">या महिन्यात काही नाही</span>';
    if (m.status === 'paid') {
      return `<span class="pa-badge st-ok">✅ दिले ${esc(dateText(m.paid_at))}</span><br><small>UTR ${esc(m.utr)}</small>
        ${p.mobile ? `<br><a class="admin-btn-secondary st-wa" href="${esc(_receiptLink(p, m, _data.month))}" target="_blank" rel="noopener">💬 पावती पाठवा</a>` : ''}`;
    }
    if (m.status === 'carried') return `<span class="pa-badge">➡ पुढच्या महिन्यात (किमान ₹${_data.min_payout})</span>`;
    return `<div class="sh-pay">
      ${p.upi_id ? `<a class="admin-btn-secondary" href="${esc(_upiLink(p, m.net, _data.month))}">💸 ${rs(m.net)} UPI</a>` : '<span class="pa-warn">UPI नाही</span>'}
      <input class="admin-input pa-utr" data-utr-for="${esc(m.id)}" placeholder="UTR / reference" maxlength="40" />
      <button type="button" class="admin-btn-primary" data-st-act="paid" data-stmt="${esc(m.id)}" data-id="${esc(p.id)}">✅ Paid</button></div>`;
  }

  function _lifeCells(p) {
    const L = p.lifetime;
    return `<td><b class="st-in">${rs(L.paid)}</b></td><td><b class="${L.owed > 0 ? 'st-out' : ''}">${rs(L.owed)}</b>${L.owed ? `<br><small>${[L.due ? `बंद ${rs(L.due)}` : '', L.carried ? `पुढे ${rs(L.carried)}` : '', L.running ? `चालू ${rs(L.running)}` : ''].filter(Boolean).join(' · ')}</small>` : ''}</td>`;
  }

  function _historyRow(p, cols) {
    if (_open !== p.id) return '';
    return `<tr class="st-history"><td colspan="${cols}">${_historyHtml(p)}</td></tr>`;
  }

  // ── month view ────────────────────────────────────────────────────────────
  function _monthHtml(rows) {
    const sorted = rows.slice().sort((a, b) => {
      const w = p => (p.month?.status === 'closed' ? 3 : p.due_total > 0 ? 2 : p.month ? 1 : 0);
      return w(b) - w(a) || (b.month?.net || 0) - (a.month?.net || 0) || (b.lifetime.owed - a.lifetime.owed);
    });
    if (!sorted.length) return '<p class="import-hint">कोणी सापडलं नाही.</p>';
    return `<div class="pa-table-wrap"><table class="pa-table st-table"><thead><tr>
      <th>कोण</th><th>दर</th><th>${esc(monthLabel(_data.month))}<br><small>payments · commission</small></th><th>Refund / मागचे</th><th>या महिन्याचे देय</th><th>स्थिती / द्या</th><th>जुने बाकी</th><th>चालू महिना</th><th>एकूण दिले</th><th>एकूण बाकी</th></tr></thead><tbody>${
      sorted.map(p => {
        const m = p.month;
        const oldDue = p.due.filter(x => x.month !== _data.month);
        return `<tr class="${m?.status === 'closed' ? 'st-row-due' : ''}">
          <td>${_who(p)}</td>
          <td>${esc(p.rate)}</td>
          <td>${m ? `${m.count} · ${rs(m.amount)}` : '—'}</td>
          <td>${m && (m.adjust || m.carried_in) ? [m.adjust ? rs(m.adjust) : '', m.carried_in ? '+' + rs(m.carried_in) : ''].filter(Boolean).join(' / ') : '—'}</td>
          <td><b>${m ? rs(m.net) : '—'}</b></td>
          <td>${_status(p)}</td>
          <td>${oldDue.length ? oldDue.map(x => `<small>${esc(monthLabel(x.month))}: <b>${rs(x.net)}</b></small>`).join('<br>') : '—'}</td>
          <td>${p.running.amount ? `${p.running.count} · ${rs(p.running.amount)}${p.running.hold ? `<br><small>${rs(p.running.hold)} hold</small>` : ''}` : '—'}</td>
          ${_lifeCells(p)}</tr>${_historyRow(p, 10)}`;
      }).join('')
    }</tbody></table></div>
    <p class="import-hint">1 तारखेला मागचा महिना आपोआप बंद होतो. UPI ने पैसे पाठवा, UTR टाका आणि ✅ Paid दाबा — सगळे आकडे आपोआप बदलतात आणि त्या व्यक्तीच्या panel मध्ये "दिले" दिसतं. नावावर click केल्यावर त्या व्यक्तीचा पूर्ण हिशोब दिसतो.</p>`;
  }

  // ── all-time view ─────────────────────────────────────────────────────────
  function _lifeHtml(rows) {
    const sorted = rows.filter(p => p.lifetime.earned || p.lifetime.paid || p.lifetime.owed).sort((a, b) => b.lifetime.owed - a.lifetime.owed || b.lifetime.paid - a.lifetime.paid);
    if (!sorted.length) return '<p class="import-hint">अजून कोणाची कमाई नाही.</p>';
    const tot = k => r2(sorted.reduce((t, p) => t + p.lifetime[k], 0));
    return `<div class="pa-table-wrap"><table class="pa-table st-table"><thead><tr>
      <th>कोण</th><th>एकूण कमाई</th><th>दिले</th><th>बंद, द्यायचे</th><th>पुढे गेलेले</th><th>चालू महिना</th><th>एकूण बाकी</th></tr></thead><tbody>${
      sorted.map(p => { const L = p.lifetime; return `<tr${L.due ? ' class="st-row-due"' : ''}><td>${_who(p)}</td><td><b>${rs(L.earned)}</b></td><td class="st-in">${rs(L.paid)}</td><td>${rs(L.due)}</td><td>${rs(L.carried)}</td><td>${rs(L.running)}</td><td><b class="${L.owed > 0 ? 'st-out' : ''}">${rs(L.owed)}</b></td></tr>${_historyRow(p, 7)}`; }).join('')
    }<tr class="st-total"><td><b>एकूण</b></td><td><b>${rs(tot('earned'))}</b></td><td><b>${rs(tot('paid'))}</b></td><td>${rs(tot('due'))}</td><td>${rs(tot('carried'))}</td><td>${rs(tot('running'))}</td><td><b>${rs(tot('owed'))}</b></td></tr>
    </tbody></table></div>
    <p class="import-hint">प्रत्येक ओळीत: एकूण कमाई = दिले + बंद द्यायचे + पुढे गेलेले + चालू महिना. Refund झाला तर तो पुढच्या हिशोबात वजा होतो (चालू महिन्यात minus दिसतो).</p>`;
  }

  // ── financial year view ───────────────────────────────────────────────────
  function _yearHtml(rows) {
    const sorted = rows.filter(p => p.fy.earned || p.fy.paid).sort((a, b) => b.fy.earned - a.fy.earned);
    if (!sorted.length) return `<p class="import-hint">${esc(_data.fy_label)} मध्ये कोणाची कमाई नाही.</p>`;
    const tot = k => r2(sorted.reduce((t, p) => t + p.fy[k], 0));
    return `<div class="pa-table-wrap"><table class="pa-table st-table"><thead><tr>
      <th>कोण</th><th>Payments</th><th>वर्षातली कमाई</th><th>वर्षात दिले</th><th>महिने दिले</th><th>PAN</th><th>आतापर्यंत एकूण दिले</th><th>एकूण बाकी</th></tr></thead><tbody>${
      sorted.map(p => `<tr>
        <td>${_who(p)}</td><td>${p.fy.payments}</td><td><b>${rs(p.fy.earned)}</b></td><td>${rs(p.fy.paid)}</td><td>${p.fy.months_paid}</td>
        <td>${p.pan ? '✅' : p.tds_warn ? '<span class="pa-warn">⚠️ हवा</span>' : '—'}</td>${_lifeCells(p)}</tr>${_historyRow(p, 8)}`).join('')
    }<tr class="st-total"><td><b>एकूण</b></td><td>${tot('payments')}</td><td><b>${rs(tot('earned'))}</b></td><td><b>${rs(tot('paid'))}</b></td><td></td><td></td><td></td><td></td></tr>
    </tbody></table></div>
    <p class="import-hint">आर्थिक वर्ष ${esc(_data.fy_label)} (एप्रिल–मार्च). "कमाई" = त्या वर्षात झालेल्या payments वरचं commission (refund वजा). "दिले" = त्या वर्षाच्या महिन्यांचे दिलेले statements. वर्षात ₹15,000 पेक्षा जास्त झाल्यास TDS (194H) लागू होऊ शकतो — PAN घ्या आणि CA ला विचारा.</p>`;
  }

  // ── one person's history ──────────────────────────────────────────────────
  async function _loadHistory(id) {
    try { _history[id] = await API.fetchSettlementHistory(id); }
    catch (err) { _history[id] = { statements: [], lines: [] }; toast(err.message || 'हिशोब load झाला नाही', 'error'); }
    _render();
  }

  function _historyHtml(p) {
    const h = _history[p.id];
    if (!h) return '<p class="import-hint">⏳ उघडत आहे…</p>';
    const ST = { closed: '⏳ द्यायचे', paid: '✅ दिले', carried: '➡ पुढे' };
    const months = h.statements.length ? `<table class="pa-table"><thead><tr><th>महिना</th><th>Payments</th><th>Commission</th><th>Refund</th><th>मागचे</th><th>देय</th><th>स्थिती</th></tr></thead><tbody>${
      h.statements.map(s => `<tr><td>${esc(monthLabel(s.month))}</td><td>${s.new_count}</td><td>${rs(s.new_amount)}</td><td>${s.adjust_amount ? rs(s.adjust_amount) : '—'}</td><td>${s.carried_in ? rs(s.carried_in) : '—'}</td><td><b>${rs(s.net)}</b></td>
        <td>${ST[s.status] || esc(s.status)}${s.status === 'paid' ? ` ${esc(dateText(s.paid_at))} · UTR ${esc(s.utr)}` : s.status === 'carried' && s.carried_to ? ` (${esc(monthLabel(s.carried_to))})` : ''}</td></tr>`).join('')
    }</tbody></table>` : '<p class="import-hint">अजून एकही महिना बंद झालेला नाही.</p>';
    const lines = h.lines.length ? `<table class="pa-table"><thead><tr><th>तारीख</th><th>Student</th><th>भरले</th><th>दर</th><th>Commission</th><th>स्थिती</th></tr></thead><tbody>${
      h.lines.map(e => `<tr><td>${esc(dateText(e.paid_at))}</td><td>${esc(e.student_name || e.student_code)}<br><small>${esc(e.student_code)}${e.class ? ' · ' + esc(e.class) : ''}</small></td>
        <td>${e.amount_paid ? rs(e.amount_paid) : '—'}</td><td>${e.type === 'adjustment' ? '—' : e.mode === 'percent' ? `${e.rate}%` : rs(e.rate)}</td>
        <td><b>${rs(e.amount)}</b>${e.type === 'adjustment' ? '<br><small>refund</small>' : e.note === 'renewal' ? '<br><small>renewal</small>' : ''}</td>
        <td>${e.status === 'reversed' ? '✕ रद्द' : e.in_statement ? esc(monthLabel(e.payable_month)) + ' हिशोबात' : new Date(e.payable_at) > new Date() ? '⏳ hold' : 'चालू महिना'}</td></tr>`).join('')
    }</tbody></table>` : '';
    return `<div class="st-hist"><h4>📒 ${esc(h.name)} — महिन्यांचा हिशोब</h4>${months}${lines ? `<h4>प्रत्येक payment</h4>${lines}` : ''}</div>`;
  }

  // ── students (prizes) ─────────────────────────────────────────────────────
  function _studentsHtml(list) {
    if (!list.length) return `<p class="import-hint">${esc(_data.fy_label)} मध्ये कोणत्याही student ने बक्षीस मागितलं नाही.</p>`;
    const ST = { requested: '📦 पाठवायचे', shipped: '✅ पाठवले', rejected: '✕ नाही' };
    return `<div class="pa-table-wrap"><table class="pa-table st-table"><thead><tr><th>Student</th><th>बक्षीस</th><th>पत्ता</th><th>स्थिती / पाठवा</th></tr></thead><tbody>${
      list.flatMap(s => s.claims.map(c => `<tr${c.status === 'requested' ? ' class="st-row-due"' : ''}>
        <td><b>${esc(s.name)}</b><br><small>${esc(s.code)}${c.phone || s.mobile ? ' · ' + esc(c.phone || s.mobile) : ''}</small></td>
        <td>🎁 ${esc(c.title)}<br><small>मागितलं ${esc(dateText(c.requested_at))}</small></td>
        <td><small>${esc(c.recipient)}${c.address ? '<br>' + esc(c.address) : ''}${c.pincode ? ' — ' + esc(c.pincode) : ''}</small></td>
        <td>${c.status === 'requested' ? `<div class="sh-pay">
            <input class="admin-input pa-utr" data-track-for="${esc(c.id)}" placeholder="Courier / tracking (optional)" maxlength="100" />
            <button type="button" class="admin-btn-primary" data-st-act="ship" data-claim="${esc(c.id)}">📦 पाठवले</button>
            <button type="button" class="admin-btn-secondary" data-st-act="reject" data-claim="${esc(c.id)}">✕ नाही</button></div>`
          : `${ST[c.status] || esc(c.status)}${c.status === 'shipped' ? ` ${esc(dateText(c.shipped_at))}${c.tracking ? '<br><small>' + esc(c.tracking) + '</small>' : ''}` : ''}`}</td></tr>`)).join('')
    }</tbody></table></div>
    <p class="import-hint">Students ना पैसे नाहीत, वस्तू बक्षीस. "📦 पाठवले" दाबल्यावर student ला app मध्ये सूचना जाते.</p>`;
  }

  // ── CSV for the CA (opens in Excel) ───────────────────────────────────────
  function _downloadCsv() {
    if (!_data) return;
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let head, rows, name;
    if (_type === 'students') {
      head = ['Student', 'Code', 'Mobile', 'Prize', 'Status', 'Requested', 'Sent', 'Tracking'];
      rows = _students().flatMap(s => s.claims.map(c => [s.name, s.code, c.phone || s.mobile, c.title, c.status, dateText(c.requested_at), dateText(c.shipped_at), c.tracking]));
      name = `prizes-${_data.fy_label}.csv`;
    } else if (_view === 'year') {
      head = ['Name', 'Owner', 'Type', 'Code', 'Mobile', 'PAN given', 'Payments', 'FY earned', 'FY paid', 'Months paid', 'All-time paid', 'All-time owed'];
      rows = _rows().filter(p => p.fy.earned || p.fy.paid).map(p => [p.name, p.owner, TYPE_TEXT[p.type] || p.type, p.code, p.mobile, p.pan ? 'yes' : 'no', p.fy.payments, p.fy.earned, p.fy.paid, p.fy.months_paid, p.lifetime.paid, p.lifetime.owed]);
      name = `settlement-FY-${_data.fy_label}.csv`;
    } else if (_view === 'all') {
      head = ['Name', 'Owner', 'Type', 'Code', 'Mobile', 'Earned', 'Paid', 'Closed to pay', 'Carried', 'Running', 'Owed'];
      rows = _rows().map(p => { const L = p.lifetime; return [p.name, p.owner, TYPE_TEXT[p.type] || p.type, p.code, p.mobile, L.earned, L.paid, L.due, L.carried, L.running, L.owed]; });
      name = 'settlement-all-time.csv';
    } else {
      head = ['Month', 'Name', 'Owner', 'Type', 'Code', 'Mobile', 'UPI', 'Rate', 'Payments', 'Commission', 'Refund', 'Carried in', 'Net', 'Status', 'Paid on', 'UTR', 'All-time paid', 'All-time owed'];
      rows = _rows().filter(p => p.month).map(p => { const m = p.month; return [_data.month, p.name, p.owner, TYPE_TEXT[p.type] || p.type, p.code, p.mobile, p.upi_id, p.rate, m.count, m.amount, m.adjust, m.carried_in, m.net, m.status, dateText(m.paid_at), m.utr, p.lifetime.paid, p.lifetime.owed]; });
      name = `settlement-${_data.month}.csv`;
    }
    const csv = '﻿' + [head, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (window.FILE_EXPORT?.saveAndShare) { window.FILE_EXPORT.saveAndShare(blob, name).catch(() => toast('Download झालं नाही', 'error')); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ── clicks ────────────────────────────────────────────────────────────────
  async function _onClick(e) {
    const btn = e.target.closest('[data-st-act]');
    if (!btn) return;
    const act = btn.dataset.stAct;
    if (act === 'history') {
      const id = btn.dataset.id;
      _open = _open === id ? '' : id;
      _render();
      if (_open && !_history[id]) await _loadHistory(id);
      return;
    }
    if (act === 'paid') {
      const utr = document.querySelector(`[data-utr-for="${CSS.escape(btn.dataset.stmt)}"]`)?.value.trim() || '';
      if (utr.length < 6) { toast('UPI चा UTR / reference नंबर लिहा', 'error'); return; }
      btn.disabled = true;
      try {
        await API.markPartnerStatementPaid(btn.dataset.stmt, utr);
        toast('✅ Paid — आता "💬 पावती पाठवा" दाबा', 'success');
        await load();
      } catch (err) {
        toast(err.message || 'झालं नाही', 'error');
        btn.disabled = false;
      }
      return;
    }
    if (act === 'ship' || act === 'reject') {
      btn.disabled = true;
      try {
        const tracking = document.querySelector(`[data-track-for="${CSS.escape(btn.dataset.claim)}"]`)?.value.trim() || '';
        await API.updateReferralClaim(btn.dataset.claim, { status: act === 'ship' ? 'shipped' : 'rejected', tracking });
        toast(act === 'ship' ? '📦 पाठवले — student ला सूचना गेली' : 'नाही केलं — student ला सूचना गेली', 'success');
        await load();
      } catch (err) {
        toast(err.message || 'झालं नाही', 'error');
        btn.disabled = false;
      }
    }
  }

  window.SETTLEMENT_ADMIN = { init, load };
})();
