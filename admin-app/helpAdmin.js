/* ════════════════════════════════════════
   helpAdmin.js - Admin > 🤖 Help
   PIN requests from the login help bot (new phone, teacher, shop): pick the
   account, one click makes a new PIN (and frees the phone) and WhatsApp sends
   it to that number. Below: the bot's questions/answers (edit, or go back to
   the built-in ones from core/helpBot.js) and how often each is asked.
   Server: TeachingBoard-backend /api/help/admin
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const when = d => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const ROLE = { student: '👨‍🎓 Student', teacher: '👩‍🏫 Teacher', shop: '🏪 Shop' };
  const REASON = { new_phone: 'नवीन phone', not_matched: 'phone वरून खात्री नाही', teacher: 'Teacher', shop: 'दुकान', device_move: '📱 जुन्या phone वरून स्वतः नवीन phone वर shift' };

  let _bound = false;
  let _status = 'open';
  let _data = { requests: [], open: 0, faq: null, stats: {} };
  let _faq = [];
  const _done = {};   // request id -> { pin, code, name, mobile, role }

  async function init() {
    if (!_bound) { _bind(); _bound = true; }
    await load();
  }

  function _bind() {
    $('hp-status')?.addEventListener('change', e => { _status = e.target.value; load(); });
    $('hp-requests')?.addEventListener('click', _onRequestClick);
    $('hp-faq')?.addEventListener('click', _onFaqClick);
    $('hp-faq-save')?.addEventListener('click', _saveFaq);
    $('hp-faq-reset')?.addEventListener('click', _resetFaq);
  }

  async function load() {
    try {
      _data = await API.fetchHelpAdmin(_status);
      _faq = JSON.parse(JSON.stringify(_data.faq || window.HELP_DEFAULTS || []));
      $('hp-open').textContent = String(_data.open || 0);
      _renderRequests();
      _renderFaq();
    } catch (err) {
      $('hp-requests').innerHTML = `<p class="import-hint">Load झालं नाही: ${esc(err.message)}</p>`;
    }
  }

  // ── PIN requests ────────────────────────────────────────
  function _waText(d) {
    const label = d.role === 'student' ? 'Student Code' : d.role === 'shop' ? 'दुकानाचा code' : 'Teacher code';
    const where = d.role === 'shop' ? 'https://teachingboard-frontend.vercel.app/shop' : 'NKs EduOrbit app';
    return `नमस्कार 🙏 ${d.name} साठी नवीन login माहिती:\n${label}: ${d.code}\nनवीन PIN: ${d.pin}\n\n${where} मध्ये login करा.${d.role === 'student' ? '\n(आता नवीन phone वर login करता येईल.)' : ''}`;
  }

  function _renderRequests() {
    const box = $('hp-requests');
    const list = _data.requests || [];
    if (!list.length) { box.innerHTML = `<p class="import-hint">${_status === 'open' ? '🎉 सध्या कोणतीही request नाही.' : 'काही नाही.'}</p>`; return; }
    box.innerHTML = list.map(r => {
      const id = String(r._id);
      const d = _done[id];
      const cands = r.candidates || [];
      return `<div class="sh-card" data-req="${esc(id)}">
        <div class="sh-head"><div><b>${ROLE[r.role] || esc(r.role)} · ${esc(r.name)}</b><br>
          <small><a href="https://wa.me/91${esc(r.mobile)}" target="_blank" rel="noopener">📱 ${esc(r.mobile)}</a>${r.code ? ` · सांगितलेला code ${esc(r.code)}` : ''} · ${esc(REASON[r.reason] || r.reason || '')} · ${esc(when(r.updated_at || r.created_at))}</small></div></div>
        ${d ? `<div class="sh-pin-box"><b>✅ नवीन PIN: <code>${esc(d.pin)}</code> · Code <code>${esc(d.code)}</code></b>
            <a class="admin-btn-primary" href="https://wa.me/91${esc(d.mobile)}?text=${encodeURIComponent(_waText(d))}" target="_blank" rel="noopener">💬 WhatsApp वर पाठवा</a></div>`
          : r.status !== 'open' ? `<p class="import-hint">${r.status === 'done' ? '✅ झालं' : '✕ नाकारलं'} · ${esc(when(r.done_at))}</p>`
          : !cands.length ? `<p class="import-hint pa-warn">या नंबरवर कोणतंही ${r.role === 'student' ? 'student' : r.role} account नाही. WhatsApp करून विचारा, किंवा नाकारा.</p>
              <div class="sh-actions"><button type="button" class="admin-btn-secondary" data-hp-act="reject" data-id="${esc(id)}">✕ नाकारा</button></div>`
          : `<div class="hp-cands">${cands.map((c, i) => `<label class="hp-cand"><input type="radio" name="hp-c-${esc(id)}" value="${esc(c.user_id)}"${i === 0 && cands.length === 1 ? ' checked' : ''} />
              <b>${esc(c.name)}</b> <small>${esc(c.code)}${c.class ? ' · ' + esc(c.class) : ''}</small></label>`).join('')}</div>
            ${r.role === 'student' ? '<label class="hp-cand"><input type="checkbox" data-hp-free checked /> जुना phone काढा (नवीन phone वर login होईल)</label>' : ''}
            <div class="sh-actions">
              <button type="button" class="admin-btn-primary" data-hp-act="resolve" data-id="${esc(id)}">🔑 नवीन PIN तयार करा</button>
              <button type="button" class="admin-btn-secondary" data-hp-act="reject" data-id="${esc(id)}">✕ नाकारा</button>
            </div>`}
      </div>`;
    }).join('');
  }

  async function _onRequestClick(e) {
    const btn = e.target.closest('[data-hp-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const card = btn.closest('[data-req]');
    if (btn.dataset.hpAct === 'reject') {
      btn.disabled = true;
      try { await API.rejectPinRequest(id); toast('नाकारलं', 'info'); await load(); }
      catch (err) { toast(err.message || 'झालं नाही', 'error'); btn.disabled = false; }
      return;
    }
    const userId = card.querySelector(`input[name="hp-c-${CSS.escape(id)}"]:checked`)?.value;
    if (!userId) { toast('आधी account निवडा', 'error'); return; }
    btn.disabled = true;
    try {
      const d = await API.resolvePinRequest(id, userId, !!card.querySelector('[data-hp-free]')?.checked);
      _done[id] = d;
      toast('✅ नवीन PIN तयार — WhatsApp वर पाठवा', 'success');
      _renderRequests();
      $('hp-open').textContent = String(Math.max(0, (Number($('hp-open').textContent) || 1) - 1));
    } catch (err) {
      toast(err.message || 'झालं नाही', 'error');
      btn.disabled = false;
    }
  }

  // ── FAQ editor ──────────────────────────────────────────
  function _renderFaq() {
    const stats = _data.stats || {};
    $('hp-faq-note').textContent = _data.faq ? 'तुम्ही बदललेली उत्तरं वापरात आहेत.' : 'सध्या app ची मूळ उत्तरं वापरात आहेत.';
    $('hp-faq').innerHTML = _faq.map((s, si) => `<div class="hp-sec">
      <h4>${esc(s.icon || '')} ${esc(s.title)}${s.title_en && s.title_en !== s.title ? ` <small>/ ${esc(s.title_en)}</small>` : ''}</h4>
      ${s.items.map((it, ii) => {
        const st = stats[`${s.id}_${it.id}`] || {};
        return `<div class="hp-item">
          <div class="hp-item-head"><input class="admin-input" data-f="q" data-s="${si}" data-i="${ii}" value="${esc(it.q)}" placeholder="प्रश्न (मराठी)" />
            <small class="hp-stat">👁 ${st.asked || 0}${st.unresolved ? ` · ❌ ${st.unresolved}` : ''}</small>
            <button type="button" class="admin-btn-secondary" data-hp-faq="del" data-s="${si}" data-i="${ii}" title="काढा">🗑️</button></div>
          <textarea class="admin-input" rows="2" data-f="a" data-s="${si}" data-i="${ii}" placeholder="उत्तर (मराठी)">${esc(it.a)}</textarea>
          <div class="hp-en"><input class="admin-input" data-f="q_en" data-s="${si}" data-i="${ii}" value="${esc(it.q_en || '')}" placeholder="Question (English)" />
            <textarea class="admin-input" rows="2" data-f="a_en" data-s="${si}" data-i="${ii}" placeholder="Answer (English) — रिकामं ठेवलं तर मराठी उत्तर दिसेल">${esc(it.a_en || '')}</textarea></div>
          ${it.action ? `<small class="import-hint">बटण: ${esc(it.action)}</small>` : ''}
        </div>`;
      }).join('')}
      <button type="button" class="admin-btn-secondary" data-hp-faq="add" data-s="${si}">+ प्रश्न जोडा</button>
    </div>`).join('');
  }

  function _readFaq() {
    document.querySelectorAll('#hp-faq [data-f]').forEach(el => {
      const it = _faq[Number(el.dataset.s)]?.items[Number(el.dataset.i)];
      if (it) it[el.dataset.f] = el.value.trim();
    });
  }

  function _onFaqClick(e) {
    const b = e.target.closest('[data-hp-faq]');
    if (!b) return;
    _readFaq();
    const s = _faq[Number(b.dataset.s)];
    if (b.dataset.hpFaq === 'add') s.items.push({ id: 'q' + Date.now().toString(36), q: 'नवीन प्रश्न', a: 'उत्तर', q_en: '', a_en: '' });
    else s.items.splice(Number(b.dataset.i), 1);
    _renderFaq();
  }

  async function _saveFaq() {
    _readFaq();
    if (_faq.some(s => s.items.some(it => !it.q || !it.a))) { toast('प्रत्येक प्रश्नाला उत्तर हवं', 'error'); return; }
    try { await API.saveHelpFaq(_faq); toast('✅ उत्तरं save झाली — app मध्ये 5 मिनिटांत दिसतील', 'success'); await load(); }
    catch (err) { toast(err.message || 'Save झालं नाही', 'error'); }
  }

  async function _resetFaq(e) {
    const btn = e.currentTarget;
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.textContent = '⚠️ खात्री? पुन्हा दाबा';
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = '↩ मूळ उत्तरं परत'; } }, 3500);
      return;
    }
    btn.dataset.armed = ''; btn.textContent = '↩ मूळ उत्तरं परत';
    try { await API.saveHelpFaq(null); toast('मूळ उत्तरं परत आली', 'success'); await load(); }
    catch (err) { toast(err.message || 'झालं नाही', 'error'); }
  }

  window.HELP_ADMIN = { init, load };
})();
