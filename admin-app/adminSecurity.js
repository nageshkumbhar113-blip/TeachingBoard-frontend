/* ═══════════════════════════════════════════════════════════════
   admin-app/adminSecurity.js — Admin › Settings › 🔐 Admin सुरक्षा (security audit 2026-11-22)
   • the admin PIN → 6 digits
   • Google Authenticator: QR to scan, first code confirms, 10 one-time backup codes (shown once)
   • "login ला code" on / off (the owner turns it on after installing the new Admin APK)
   • remembered devices (30 days) — forget one / all
   • the login log: wrong PINs / codes, blocked tries, devices added
   Backend: routes/adminSecurityRoutes.js, utils/adminSecurity.js
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const QR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => window.APP?.toast?.(m, t);
  const when = d => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const KIND = {
    wrong_pin: '⚠️ चुकीचा PIN', wrong_code: '⚠️ PIN बरोबर, code चुकीचा', pin_ok_code_asked: '🔐 PIN बरोबर — code विचारला',
    blocked: '⛔ खूप प्रयत्न — थांबवलं', device_added: '💻 नवीन साधन लक्षात ठेवलं', backup_code_used: '🗝️ राखीव code वापरला',
    authenticator_added: '✅ Authenticator जोडलं', authenticator_removed: '🗑️ Authenticator काढलं', enforce_on: '🟢 Login ला code चालू',
    enforce_off: '⚪ Login ला code बंद', backup_codes_new: '🗝️ नवीन राखीव codes', device_forgotten: '💻 एक साधन विसरलं',
    all_devices_forgotten: '💻 सगळी साधनं विसरली', pin_changed: '🔑 PIN बदलला',
  };
  const WARN = new Set(['wrong_pin', 'wrong_code', 'pin_ok_code_asked', 'blocked', 'backup_code_used']);

  let host = null, data = null;

  function loadQr() {
    if (window.QRCode) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = QR_CDN; s.onload = res; s.onerror = () => rej(new Error('QR बनवता आला नाही')); document.head.appendChild(s); });
  }
  const call = (m, p, b) => window.API.adminSecurity(m, p, b).then(r => r?.data ?? r);
  const codeBox = (id, label = 'Authenticator चा आत्ताचा code') => `<input id="${id}" class="admin-input short" inputmode="numeric" maxlength="11" placeholder="${esc(label)}" aria-label="${esc(label)}" />`;

  function recoveryBox(list) {
    return `<div class="asec-rec"><b>🗝️ राखीव codes — आत्ताच कागदावर लिहून घरी सुरक्षित ठेवा</b>
      <p class="import-hint">Phone हरवला / बदलला तर यातला एक code Authenticator ऐवजी चालतो. प्रत्येक code एकदाच. हे पुन्हा दिसणार नाहीत.</p>
      <ol class="asec-rec-list">${list.map(c => `<li><code>${esc(c)}</code></li>`).join('')}</ol>
      <button type="button" class="admin-btn-secondary" id="asec-rec-copy">📋 Copy</button></div>`;
  }

  function render(extraHtml = '') {
    if (!host || !data) return;
    const d = data;
    host.innerHTML = `
      <h3 class="asec-title">🔐 Admin सुरक्षा</h3>
      <div class="asec-chips">
        <span class="asec-chip ${d.totp_on ? 'ok' : ''}">Authenticator: ${d.totp_on ? '✅ जोडलेलं' : '❌ नाही'}</span>
        <span class="asec-chip ${d.enforce ? 'ok' : 'warn'}">Login ला code: ${d.enforce ? '🟢 चालू' : '⚪ बंद'}</span>
        ${d.totp_on ? `<span class="asec-chip">राखीव codes उरले: ${d.recovery_left}</span>` : ''}
      </div>
      ${d.kill_switch ? '<p class="asec-warn">⚠️ Server वर ADMIN_2FA_OFF=1 आहे — code सध्या मागितला जात नाही. काम झालं की Render मधून ते काढा.</p>' : ''}
      ${extraHtml}

      <section class="asec-sec"><h4>1) Admin PIN — 6 अंकी</h4>
        <div class="asec-row">
          <input id="asec-pin-cur" type="password" class="admin-input short" inputmode="numeric" maxlength="6" placeholder="सध्याचा PIN" aria-label="सध्याचा PIN" />
          <input id="asec-pin-new" type="password" class="admin-input short" inputmode="numeric" maxlength="6" placeholder="नवीन 6 अंकी PIN" aria-label="नवीन PIN" />
          <input id="asec-pin-new2" type="password" class="admin-input short" inputmode="numeric" maxlength="6" placeholder="नवीन PIN पुन्हा" aria-label="नवीन PIN पुन्हा" />
          ${d.totp_on ? codeBox('asec-pin-code') : ''}
          <button type="button" class="admin-btn-primary" id="asec-pin-save">PIN बदला</button>
        </div>
        <p class="import-hint">111111 / 123456 असा सोपा PIN चालत नाही. नवीन PIN कोणालाही सांगू नका.</p>
      </section>

      <section class="asec-sec"><h4>2) Google Authenticator</h4>
        ${!d.totp_on ? `
          <ol class="import-hint asec-steps"><li>तुमच्या phone वर Play Store मधून <b>Google Authenticator</b> install करा.</li><li>खालचं बटण दाबा → QR येईल → Authenticator मध्ये <b>+</b> → "QR code scan करा".</li><li>Authenticator मध्ये आलेला 6 अंकी code इथे टाकून "जोडा" दाबा.</li></ol>
          <button type="button" class="admin-btn-primary" id="asec-totp-start">➕ Authenticator जोडा</button>
          <div id="asec-totp-setup"></div>` : `
          <div class="asec-row">${codeBox('asec-code')}
            ${d.enforce
              ? '<button type="button" class="admin-btn-secondary" id="asec-enforce-off">⚪ Login ला code बंद करा</button>'
              : '<button type="button" class="admin-btn-primary" id="asec-enforce-on">🟢 Login ला code चालू करा</button>'}
            <button type="button" class="admin-btn-secondary" id="asec-rec-new">🗝️ नवीन राखीव codes</button>
            <button type="button" class="admin-btn-secondary" id="asec-totp-remove">🗑️ Authenticator काढा</button>
          </div>
          ${d.enforce ? '' : '<p class="asec-warn">"चालू" करण्याआधी: (1) राखीव codes लिहून ठेवले आहेत, (2) तुमच्या phone वर <b>नवीन Admin APK</b> आहे (जुन्या APK मध्ये code टाकायची जागा नाही).</p>'}`}
      </section>

      <section class="asec-sec"><h4>3) लक्षात ठेवलेली साधनं (30 दिवस)</h4>
        ${d.devices.length ? `<table class="wka-table"><thead><tr><th>साधन</th><th>जोडलं</th><th>शेवटचं वापरलं</th><th>पर्यंत</th><th></th></tr></thead><tbody>
          ${d.devices.map(x => `<tr><td>${esc(x.name)}</td><td>${when(x.created_at)}</td><td>${when(x.last_used)}</td><td>${when(x.expires)}</td><td><button type="button" class="admin-btn-secondary" data-forget="${esc(x.id)}">विसरा</button></td></tr>`).join('')}
          </tbody></table><button type="button" class="admin-btn-secondary" id="asec-forget-all">💻 सगळी साधनं विसरा (उदा. laptop हरवला)</button>`
          : '<p class="import-hint">अजून कोणतंही नाही. Login ला code चालू असताना "हे साधन 30 दिवस लक्षात ठेवा" निवडलं की इथे दिसेल.</p>'}
      </section>

      <section class="asec-sec"><h4>4) Login नोंद</h4>
        ${d.events.length ? `<table class="wka-table"><thead><tr><th>केव्हा</th><th>काय</th><th>Network</th><th>साधन</th></tr></thead><tbody>
          ${d.events.map(e => `<tr class="${WARN.has(e.kind) ? 'asec-ev-warn' : ''}"><td>${when(e.at)}</td><td>${esc(KIND[e.kind] || e.kind)}</td><td>${esc(e.ip || '')}</td><td><small>${esc(String(e.ua || '').slice(0, 60))}</small></td></tr>`).join('')}
          </tbody></table>` : '<p class="import-hint">अजून नोंद नाही.</p>'}
      </section>`;
    bind();
  }

  const val = id => String(host.querySelector('#' + id)?.value || '').trim();
  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (err) { toast(err?.message || 'जमलं नाही', 'error'); } finally { if (btn?.isConnected) btn.disabled = false; }
  }

  function bind() {
    const $ = id => host.querySelector('#' + id);
    $('asec-rec-copy')?.addEventListener('click', () => {
      const t = [...host.querySelectorAll('.asec-rec-list code')].map(c => c.textContent).join('\n');
      navigator.clipboard?.writeText(t).then(() => toast('Copy झालं — कागदावर पण लिहा', 'success'), () => toast('Copy जमलं नाही — हाताने लिहा', 'error'));
    });
    $('asec-pin-save')?.addEventListener('click', e => act(e.currentTarget, async () => {
      const cur = val('asec-pin-cur'), n1 = val('asec-pin-new'), n2 = val('asec-pin-new2');
      if (!/^\d{6}$/.test(n1)) throw new Error('नवीन PIN 6 अंकी हवा');
      if (n1 !== n2) throw new Error('दोन्ही नवीन PIN सारखे नाहीत');
      await call('POST', '/pin', { current: cur, next: n1, code: val('asec-pin-code') });
      toast('✅ PIN बदलला — पुढच्या login ला नवीन 6 अंकी PIN', 'success');
      await refresh();
    }));
    $('asec-totp-start')?.addEventListener('click', e => act(e.currentTarget, async () => {
      const r = await call('POST', '/totp/start', {});
      const box = $('asec-totp-setup');
      box.innerHTML = `<div class="asec-qr-wrap"><div id="asec-qr" class="asec-qr" aria-label="Authenticator QR"></div>
        <div><p class="import-hint">QR scan होत नसेल तर Authenticator मध्ये "setup key टाका" → नाव <b>NKs Admin</b>, key:</p><code class="asec-secret">${esc(r.secret.replace(/(.{4})/g, '$1 ').trim())}</code>
        <div class="asec-row" style="margin-top:10px">${codeBox('asec-confirm-code', 'Authenticator मधला code')}<button type="button" class="admin-btn-primary" id="asec-totp-confirm">✅ जोडा</button></div></div></div>`;
      await loadQr();
      new window.QRCode(box.querySelector('#asec-qr'), { text: r.otpauth, width: 200, height: 200, correctLevel: window.QRCode.CorrectLevel.M });
      box.querySelector('#asec-totp-confirm').addEventListener('click', ev => act(ev.currentTarget, async () => {
        const d = await call('POST', '/totp/confirm', { code: val('asec-confirm-code') });
        data = d; render(recoveryBox(d.recovery));
        toast('✅ Authenticator जोडलं — आता राखीव codes लिहून ठेवा', 'success');
      }));
    }));
    $('asec-enforce-on')?.addEventListener('click', e => act(e.currentTarget, async () => {
      if (!(await window.UI?.confirmAsync?.('Login ला code चालू करायचा? राखीव codes लिहून ठेवले आहेत आणि phone वर नवीन Admin APK आहे ना?') ?? true)) return;
      data = await call('POST', '/enforce', { on: true, code: val('asec-code') }); render(); toast('🟢 आता नवीन साधनावर login ला Authenticator चा code लागेल', 'success');
    }));
    $('asec-enforce-off')?.addEventListener('click', e => act(e.currentTarget, async () => {
      data = await call('POST', '/enforce', { on: false, code: val('asec-code') }); render(); toast('⚪ Login ला code बंद', 'info');
    }));
    $('asec-rec-new')?.addEventListener('click', e => act(e.currentTarget, async () => {
      const d = await call('POST', '/recovery/new', { code: val('asec-code') }); data = d; render(recoveryBox(d.recovery));
      toast('🗝️ नवीन राखीव codes — जुने आता चालणार नाहीत', 'success');
    }));
    $('asec-totp-remove')?.addEventListener('click', e => act(e.currentTarget, async () => {
      if (!(await window.UI?.confirmAsync?.('Authenticator काढायचं? मग login फक्त PIN ने होईल.') ?? true)) return;
      data = await call('POST', '/totp/remove', { code: val('asec-code') }); render(); toast('Authenticator काढलं', 'info');
    }));
    host.querySelectorAll('[data-forget]').forEach(b => b.addEventListener('click', () => act(b, async () => { data = await call('POST', '/devices/forget', { id: b.dataset.forget }); render(); })));
    $('asec-forget-all')?.addEventListener('click', e => act(e.currentTarget, async () => { data = await call('POST', '/devices/forget', {}); render(); toast('सगळ्या साधनांवर पुन्हा code लागेल', 'info'); }));
  }

  async function refresh() {
    data = await call('GET', '');
    render();
  }

  async function mount(el) {
    host = el;
    if (!host) return;
    try { await refresh(); }
    catch (err) { host.innerHTML = `<p class="import-hint">🔐 सुरक्षा माहिती आली नाही: ${esc(err?.message || '')}</p>`; }
  }

  // fresh every time Settings is opened (a login on another device shows up in the log)
  document.addEventListener('click', e => { if (host && e.target.closest?.('.atab[data-tab="settings"], [data-tab="settings"]')) setTimeout(() => refresh().catch(() => {}), 50); }, true);

  window.ADMIN_SECURITY = { mount };
})();
