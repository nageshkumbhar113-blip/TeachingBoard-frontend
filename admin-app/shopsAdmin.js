/* ════════════════════════════════════════
   shopsAdmin.js - Admin > Partners > 🏪 Shops
   Guide / book shops (docs/PLAN_shop_partners.md): create a shop with its own
   commission %, send its login on WhatsApp, print its QR poster (A5/A4/A3/stickers),
   see its numbers and students. Payouts use the partner statements below.
   Server: TeachingBoard-backend /api/shop/admin
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const rs = n => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;
  const SITE = 'https://teachingboard-frontend.vercel.app';

  let _bound = false;
  let _shops = [];
  let _editId = '';
  let _openStudents = '';
  const _students = {};
  const _pinFor = {};   // PINs shown once in this session (create / reset)

  async function init() {
    if (!_bound) { _bind(); _bound = true; }
    await refresh();
  }

  function _bind() {
    $('sh-new')?.addEventListener('click', () => _openForm(null));
    $('sh-cancel')?.addEventListener('click', _closeForm);
    $('sh-save')?.addEventListener('click', _save);
    $('sh-list')?.addEventListener('click', _onListClick);
    $('sh-created')?.addEventListener('click', _onListClick);
  }

  async function refresh() {
    const box = $('sh-list');
    if (!box) return;
    try {
      _shops = await API.fetchShops();
      _render();
    } catch (err) {
      box.innerHTML = `<p class="import-hint">Shops load झाले नाहीत: ${esc(err.message)}</p>`;
    }
  }

  // ── form ──────────────────────────────────────────────────────────────────
  function _openForm(shop) {
    _editId = shop?.id || '';
    $('sh-name').value = shop?.shop_name || '';
    $('sh-owner').value = shop?.owner || '';
    $('sh-mobile').value = shop?.mobile || '';
    $('sh-area').value = shop?.area || '';
    $('sh-first').value = shop ? shop.first_percent : 30;
    $('sh-renew').value = shop ? shop.renewal_percent : 0;
    $('sh-upi').value = shop?.upi_id || '';
    $('sh-save').textContent = shop ? '💾 बदल Save करा' : '💾 दुकान तयार करा';
    $('sh-form').classList.remove('hidden');
    $('sh-name').focus();
  }

  function _closeForm() { _editId = ''; $('sh-form').classList.add('hidden'); }

  async function _save() {
    const body = {
      shop_name: $('sh-name').value.trim(),
      owner: $('sh-owner').value.trim(),
      mobile: $('sh-mobile').value.trim(),
      area: $('sh-area').value.trim(),
      first_percent: Number($('sh-first').value),
      renewal_percent: Number($('sh-renew').value || 0),
      upi_id: $('sh-upi').value.trim(),
    };
    if (!body.shop_name || !body.owner) { toast('दुकानाचं आणि मालकाचं नाव लिहा', 'error'); return; }
    if (!(body.first_percent >= 0 && body.first_percent <= 100) || !(body.renewal_percent >= 0 && body.renewal_percent <= 100)) { toast('% 0 ते 100 मध्ये हवा', 'error'); return; }
    const btn = $('sh-save');
    btn.disabled = true;
    try {
      if (_editId) {
        await API.updateShop(_editId, body);
        toast('✅ दुकान update झालं', 'success');
      } else {
        const r = await API.createShop(body);
        _pinFor[r.data.id] = r.pin;
        _showCreated(r.data, r.pin);
        toast('✅ दुकान तयार झालं', 'success');
      }
      _closeForm();
      await refresh();
    } catch (err) {
      toast(err.message || 'Save झालं नाही', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function _loginText(shop, pin) {
    return [
      `नमस्कार ${shop.owner} 🙏`,
      `NKs EduOrbit मध्ये तुमचं दुकान (${shop.shop_name}) जोडलं आहे.`,
      '',
      `🏪 तुमचं Panel: ${SITE}/shop`,
      `📱 Mobile: ${shop.mobile}`,
      `🔑 PIN: ${pin}`,
      `🎟️ तुमचा code: ${shop.code}`,
      '',
      `💰 तुमच्या code ने आलेल्या student च्या पहिल्या payment वर ${shop.first_percent}%${shop.renewal_percent > 0 ? `, पुढच्या payments वर ${shop.renewal_percent}%` : ''}.`,
      'Panel मधून पालकांना Free Test पाठवा आणि QR poster download करा.',
    ].join('\n');
  }

  function _showCreated(shop, pin) {
    const box = $('sh-created');
    box.innerHTML = `<div class="sh-pin-box">
      <b>🎉 ${esc(shop.shop_name)} तयार — Code <code>${esc(shop.code)}</code> · PIN <code>${esc(pin)}</code></b>
      <p class="import-hint">PIN फक्त आत्ताच दिसेल. दुकानदाराला WhatsApp वर पाठवा.</p>
      <div class="pa-row-actions">
        <button type="button" class="admin-btn-primary" data-sh-act="send-login" data-id="${esc(shop.id)}">💬 Login दुकानदाराला पाठवा</button>
        <button type="button" class="admin-btn-secondary" data-sh-act="hide-created">✕</button>
      </div></div>`;
    box.classList.remove('hidden');
  }

  // ── list ──────────────────────────────────────────────────────────────────
  function _sizeOptions() {
    const sizes = window.SHOP_POSTER?.SIZES || { A4: { label: 'A4' } };
    return Object.entries(sizes).map(([k, v]) => `<option value="${k}"${k === 'A4' ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
  }

  function _render() {
    const box = $('sh-list');
    if (!_shops.length) {
      box.innerHTML = '<p class="import-hint">अजून एकही दुकान नाही. "+ नवीन दुकान" दाबा.</p>';
      return;
    }
    box.innerHTML = _shops.map(s => {
      const m = s.summary || {};
      const blocked = s.status === 'blocked';
      return `<div class="sh-card${blocked ? ' sh-blocked' : ''}">
        <div class="sh-head">
          <div><b>🏪 ${esc(s.shop_name)}</b>${blocked ? ' <span class="pa-badge">Blocked</span>' : ''}<br>
            <small>${esc(s.owner)} · <a href="https://wa.me/91${esc(s.mobile)}" target="_blank" rel="noopener">📱 ${esc(s.mobile)}</a>${s.area ? ' · ' + esc(s.area) : ''} · Code <code>${esc(s.code)}</code></small></div>
          <div class="sh-rate">${esc(s.first_percent)}%<small>${s.renewal_percent > 0 ? ` + renewal ${esc(s.renewal_percent)}%` : ' पहिलं payment'}</small></div>
        </div>
        <div class="sh-chips">
          <span>📨 पाठवले ${m.invites || 0}</span><span>👀 आले ${m.visitors || 0}</span><span>📝 Test ${m.tested || 0}</span>
          <span>👤 Account ${m.accounts || 0}</span><span class="ok">✅ Paid ${m.paid || 0}</span><span class="ok">💰 ${rs(m.earned)}</span>
          ${s.upi_id ? '' : '<span class="pa-warn">UPI नाही</span>'}
        </div>
        <div class="sh-actions">
          <select class="admin-input sh-size" data-size-for="${esc(s.id)}" aria-label="Poster size">${_sizeOptions()}</select>
          <button type="button" class="admin-btn-primary" data-sh-act="print" data-id="${esc(s.id)}">🖨️ Poster Print</button>
          <button type="button" class="admin-btn-secondary" data-sh-act="download" data-id="${esc(s.id)}">⬇️ Poster</button>
          <button type="button" class="admin-btn-secondary" data-sh-act="students" data-id="${esc(s.id)}">👥 Students</button>
          <button type="button" class="admin-btn-secondary" data-sh-act="edit" data-id="${esc(s.id)}">✏️ Edit</button>
          <button type="button" class="admin-btn-secondary" data-sh-act="pin" data-id="${esc(s.id)}">🔑 नवीन PIN</button>
          <button type="button" class="admin-btn-secondary" data-sh-act="block" data-id="${esc(s.id)}">${blocked ? '✅ चालू करा' : '🚫 Block'}</button>
        </div>
        ${_pinFor[s.id] ? `<div class="sh-pin-box">PIN <code>${esc(_pinFor[s.id])}</code> <button type="button" class="admin-btn-secondary" data-sh-act="send-login" data-id="${esc(s.id)}">💬 Login पाठवा</button></div>` : ''}
        ${_openStudents === s.id ? `<div class="sh-students">${_studentsHtml(s.id)}</div>` : ''}
      </div>`;
    }).join('');
  }

  function _studentsHtml(id) {
    const rows = _students[id];
    if (!rows) return '<p class="import-hint">⏳ उघडत आहे…</p>';
    if (!rows.length) return '<p class="import-hint">अजून कोणी student नाही.</p>';
    return `<div class="pa-table-wrap"><table class="pa-table"><thead><tr><th>Student</th><th>Class</th><th>Mobile</th><th>Paid</th><th>दुकानाची कमाई</th></tr></thead><tbody>${
      rows.map(r => `<tr><td><b>${esc(r.name)}</b><br><small>${esc(r.code)}</small></td><td>${esc(r.class)}</td>
        <td><a href="https://wa.me/91${esc(r.mobile)}" target="_blank" rel="noopener">${esc(r.mobile)}</a></td>
        <td>${r.paid ? `✅ ${rs(r.paid_amount)}<br><small>${esc(r.period)}</small>` : '—'}</td><td>${r.earned ? rs(r.earned) : '—'}</td></tr>`).join('')
    }</tbody></table></div>`;
  }

  async function _onListClick(e) {
    const btn = e.target.closest('[data-sh-act]');
    if (!btn) return;
    const act = btn.dataset.shAct;
    if (act === 'hide-created') { $('sh-created').classList.add('hidden'); return; }
    const shop = _shops.find(s => s.id === btn.dataset.id);
    if (!shop) return;
    const size = document.querySelector(`[data-size-for="${CSS.escape(shop.id)}"]`)?.value || 'A4';

    if (act === 'print' || act === 'download') {
      if (!window.SHOP_POSTER) { toast('Poster tool load झालं नाही', 'error'); return; }
      btn.disabled = true;
      try { await window.SHOP_POSTER[act](shop, size); }
      catch { toast('Poster तयार झाला नाही. Internet तपासा.', 'error'); }
      finally { btn.disabled = false; }
      return;
    }
    if (act === 'edit') { _openForm(shop); $('sh-section')?.scrollIntoView({ behavior: 'smooth' }); return; }
    if (act === 'send-login') {
      const pin = _pinFor[shop.id];
      if (!pin) { toast('आधी "🔑 नवीन PIN" दाबा', 'info'); return; }
      window.open(`https://wa.me/91${shop.mobile}?text=${encodeURIComponent(_loginText(shop, pin))}`, '_blank', 'noopener');
      return;
    }
    if (act === 'students') {
      _openStudents = _openStudents === shop.id ? '' : shop.id;
      _render();
      if (_openStudents) {
        try { _students[shop.id] = await API.fetchShopStudents(shop.id); }
        catch (err) { _students[shop.id] = []; toast(err.message || 'Students load झाले नाहीत', 'error'); }
        _render();
      }
      return;
    }
    // A second tap confirms (no dialogs in the app).
    if (act === 'pin' || act === 'block') {
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1';
        const old = btn.textContent;
        btn.textContent = act === 'pin' ? '⚠️ खात्री? पुन्हा दाबा' : '⚠️ पुन्हा दाबा';
        setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = old; } }, 3500);
        return;
      }
      btn.disabled = true;
      try {
        if (act === 'pin') {
          const r = await API.updateShop(shop.id, { reset_pin: true });
          _pinFor[shop.id] = r.pin;
          toast(`नवीन PIN: ${r.pin}`, 'success');
        } else {
          await API.updateShop(shop.id, { status: shop.status === 'blocked' ? 'active' : 'blocked' });
          toast(shop.status === 'blocked' ? '✅ दुकान चालू केलं' : '🚫 दुकान block केलं', 'success');
        }
        await refresh();
      } catch (err) {
        toast(err.message || 'झालं नाही', 'error');
        btn.disabled = false;
      }
    }
  }

  window.SHOPS_ADMIN = { init, refresh };
})();
