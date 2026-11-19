/* ════════════════════════════════════════
   notifyAdmin.js — Admin › 🔔 Notifications (owner 2026-11-19)
   The automatic notifications: on / off and their IST time. The admin's own notifications: a message,
   who gets it (all students / one batch / paid / parents / teachers), when (once on a date / daily / weekly).
   The free server sleeps when idle; the WhatsApp bot wakes it a few minutes before each time ("gajar"),
   listed at the bottom. Paper reminders and results keep their own times (from the Paper Practice timetable).
   Global: NOTIFY_ADMIN
════════════════════════════════════════ */
const NOTIFY_ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AUD = { all: '🎓 सगळे विद्यार्थी', batch: '📚 एक batch', paid: '💳 फक्त paid विद्यार्थी', parents: '👨‍👩‍👧 पालक', teachers: '👩‍🏫 शिक्षक' };
  const DOW = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
  let _data = null, _batches = [];
  const istDate = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

  async function init() {
    const box = $('notify-admin');
    if (!box) return;
    box.innerHTML = '<p class="import-hint">Loading…</p>';
    try {
      const [r, batches] = await Promise.all([API.adminNotifySchedule('GET'), API.syncServerBatches().catch(() => [])]);
      _data = r?.data; _batches = (batches || []).map(b => b.name).filter(Boolean).sort();
    } catch (err) { box.innerHTML = `<p class="import-hint">${esc(err.message || 'Load failed')}</p>`; return; }
    paint();
  }

  function customRow(n, i) {
    return `<div class="admin-card na-custom" data-i="${i}" style="padding:10px;margin:8px 0;display:grid;gap:6px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label><input type="checkbox" data-f="on" ${n.on !== false ? 'checked' : ''}/> चालू</label>
        <input class="admin-input" data-f="title" maxlength="80" placeholder="शीर्षक, उदा. 📢 उद्या महा-Test" value="${esc(n.title || '')}" style="flex:1;min-width:200px" />
        <button type="button" class="admin-btn-secondary" data-del>🗑️</button>
      </div>
      <textarea class="admin-input" data-f="body" maxlength="300" rows="2" placeholder="मजकूर">${esc(n.body || '')}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="admin-input" data-f="audience" style="max-width:200px">${Object.entries(AUD).map(([k, v]) => `<option value="${k}" ${n.audience === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="admin-input" data-f="batch" style="max-width:240px;${n.audience === 'batch' ? '' : 'display:none'}"><option value="">— batch —</option>${_batches.map(b => `<option ${n.batch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <select class="admin-input" data-f="repeat" style="max-width:160px">
          <option value="once" ${n.repeat === 'once' ? 'selected' : ''}>एकदा</option><option value="daily" ${n.repeat === 'daily' ? 'selected' : ''}>रोज</option><option value="weekly" ${n.repeat === 'weekly' ? 'selected' : ''}>दर आठवड्याला</option></select>
        <input class="admin-input" type="date" data-f="date" value="${esc(n.date || istDate())}" style="max-width:160px;${n.repeat === 'once' ? '' : 'display:none'}" />
        <select class="admin-input" data-f="dow" style="max-width:140px;${n.repeat === 'weekly' ? '' : 'display:none'}">${DOW.map((d, k) => `<option value="${k}" ${Number(n.dow) === k ? 'selected' : ''}>${d}</option>`).join('')}</select>
        <input class="admin-input" type="time" data-f="time" value="${esc(n.time || '19:00')}" style="max-width:120px" />
      </div>
      ${n.last_key ? `<small class="import-hint">शेवटची पाठवली: ${esc(n.last_key)} · ${n.last_sent || 0} phones</small>` : ''}
    </div>`;
  }

  function paint() {
    const d = _data, box = $('notify-admin');
    const wake = (d.wake || []).map(t => new Date(t).toLocaleString('mr-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }));
    box.innerHTML = `
      <h2>🔔 Notifications</h2>
      <p class="import-hint">आपोआप जाणाऱ्या notifications ची वेळ (भारतीय वेळ) आणि चालू / बंद. Server झोपलेला असतो; WhatsApp bot प्रत्येक वेळेच्या थोडं आधी त्याला उठवतो. एखादी वेळ चुकली तर 3 तासांपेक्षा उशिरा पाठवली जात नाही.</p>
      <table class="ads-table" style="width:100%"><thead><tr><th>चालू</th><th>Notification</th><th>वेळ</th></tr></thead><tbody>
      ${d.jobs.map(j => `<tr data-job="${j.key}"><td><input type="checkbox" data-f="on" ${j.on ? 'checked' : ''}/></td><td>${esc(j.name)}</td><td><input class="admin-input" type="time" data-f="time" value="${esc(j.time)}" style="max-width:120px" /></td></tr>`).join('')}
      <tr><td>✅</td><td>📝 पेपरची आठवण (15 मिनिटं आधी) आणि 🏆 गुण / rank (पेपर संपल्यावर)</td><td><small>पेपरच्या वेळेप्रमाणे</small></td></tr>
      </tbody></table>
      <h3 style="margin-top:18px">📣 आपली notification</h3>
      <p class="import-hint">ठरलेल्या दिवशी / वेळी तुमचा संदेश. उदा. "उद्या शाळेला सुट्टी आहे — महा-Test नेहमीप्रमाणे" शनिवारी रात्री 8 ला.</p>
      <div id="na-custom">${d.custom.map(customRow).join('')}</div>
      <button type="button" class="admin-btn-secondary" id="na-add">➕ Notification जोडा</button>
      <div style="margin-top:14px"><button type="button" class="admin-btn-primary" id="na-save">💾 Save</button> <span id="na-msg" class="import-hint" role="status"></span></div>
      <h3 style="margin-top:18px">⏰ Server उठवण्याच्या वेळा (पुढचे 26 तास)</h3>
      <p class="import-hint">${wake.length ? esc(wake.join(' · ')) : 'काही नाही'}</p>`;
    $('na-add').onclick = () => {
      _collect();
      _data.custom.push({ on: true, title: '', body: '', audience: 'all', repeat: 'once', date: istDate(), dow: new Date().getDay(), time: '19:00' });
      paint();
    };
    $('na-save').onclick = save;
    box.querySelectorAll('.na-custom').forEach(row => {
      row.querySelector('[data-del]').onclick = () => { _collect(); _data.custom.splice(Number(row.dataset.i), 1); paint(); };
      const sync = () => {
        row.querySelector('[data-f="batch"]').style.display = row.querySelector('[data-f="audience"]').value === 'batch' ? '' : 'none';
        const rep = row.querySelector('[data-f="repeat"]').value;
        row.querySelector('[data-f="date"]').style.display = rep === 'once' ? '' : 'none';
        row.querySelector('[data-f="dow"]').style.display = rep === 'weekly' ? '' : 'none';
      };
      row.querySelectorAll('select').forEach(s => s.addEventListener('change', sync));
    });
  }

  // the page → _data (keeps ids, so a notification already sent today is not sent again)
  function _collect() {
    const box = $('notify-admin');
    _data.jobs = _data.jobs.map(j => {
      const tr = box.querySelector(`tr[data-job="${j.key}"]`);
      return tr ? { ...j, on: tr.querySelector('[data-f="on"]').checked, time: tr.querySelector('[data-f="time"]').value } : j;
    });
    _data.custom = [...box.querySelectorAll('.na-custom')].map(row => {
      const f = k => row.querySelector(`[data-f="${k}"]`);
      const old = _data.custom[Number(row.dataset.i)] || {};
      return { id: old.id, last_key: old.last_key, last_sent: old.last_sent, on: f('on').checked, title: f('title').value.trim(), body: f('body').value.trim(),
        audience: f('audience').value, batch: f('batch').value, repeat: f('repeat').value, date: f('date').value, dow: Number(f('dow').value), time: f('time').value };
    });
  }

  async function save() {
    _collect();
    const msg = $('na-msg');
    msg.textContent = '⏳ Save करत आहे…';
    try {
      const body = { jobs: Object.fromEntries(_data.jobs.map(j => [j.key, { on: j.on, time: j.time }])), custom: _data.custom };
      _data = (await API.adminNotifySchedule('PUT', body))?.data || _data;
      paint();
      $('na-msg').textContent = '✅ Save झालं — bot ला नवीन वेळा कळवल्या';
    } catch (err) { msg.textContent = '⚠️ ' + (err.message || 'Save झालं नाही'); }
  }

  return { init };
})();
window.NOTIFY_ADMIN = NOTIFY_ADMIN;
