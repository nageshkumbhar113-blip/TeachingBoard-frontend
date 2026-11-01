/* ════════════════════════════════════════
   usageAdmin.js - Admin > 📊 Usage
   Who uses the app and how much — students, teachers and shops — with ready
   target lists (next year's buyers, renewals, bring back) to plan whom to
   contact first. WhatsApp per row, CSV (English) for the list on screen.
   Server: TeachingBoard-backend GET /api/usage/admin
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);
  const rs = n => `₹${(Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN')}`;
  const MS_DAY = 864e5;
  const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const daysSince = d => (d ? Math.round((new Date(istToday()) - new Date(String(d).slice(0, 10))) / MS_DAY) : Infinity);
  const shortDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '');

  let _bound = false;
  let _role = 'student';
  let _days = 30;
  let _list = 'all';
  let _rows = [];
  let _collect = {};

  const PLAN = { free: '🆓 Free', paid: '✅ Paid', expiring: '⏳ संपत आलं', expired: '⌛ संपलं' };

  // Ready-made target lists per role
  const LISTS = {
    student: [
      ['all', 'सगळे'],
      ['buyers', '🎯 पुढच्या वर्षीचे खरेदीदार', r => r.plan === 'free' && (r.active_days >= 5 || r.tests >= 5)],
      ['renew', '🔁 Renewal', r => (r.plan === 'expired' || r.plan === 'expiring') && daysSince(r.last_used) <= 60],
      ['back', '😴 परत आणायचे', r => (r.plan === 'paid' || r.plan === 'expiring') && daysSince(r.last_used) > 14],
      ['top', '🔥 सगळ्यात active', r => r.active_days > 0],
    ],
    teacher: [
      ['all', 'सगळे'],
      ['active', '🔥 Active', r => r.active_days >= 5],
      ['idle', '😴 14 दिवस वापर नाही', r => daysSince(r.last_used) > 14],
    ],
    shop: [
      ['all', 'सगळे'],
      ['good', '🏆 चांगलं काम', r => (r.summary?.paid || 0) >= 1 || (r.summary?.invites || 0) >= 10],
      ['idle', '😴 काहीच नाही', r => !(r.summary?.invites) && daysSince(r.last_used || r.last_login) > 14],
    ],
  };

  const WA_TEXT = {
    buyers: n => `नमस्कार 🙏 ${n} NKs EduOrbit नियमित वापरतो/वापरते हे पाहून आनंद झाला! पुढच्या वर्षाच्या अभ्यासासाठी सगळे chapters, tests आणि notes उघडायचे असतील तर आम्हाला सांगा.`,
    renew: n => `नमस्कार 🙏 ${n} चा NKs EduOrbit plan संपला / संपत आला आहे. अभ्यास न थांबवता पुढे चालू ठेवण्यासाठी app मधून renew करा.`,
    back: n => `नमस्कार 🙏 ${n} ने काही दिवसांपासून NKs EduOrbit उघडलं नाही. रोज 15 मिनिटं सराव केला तर फरक नक्की दिसेल 💪`,
  };

  async function init() {
    if (!_bound) { _bind(); _bound = true; }
    await load();
  }

  function _bind() {
    $('us-roles')?.addEventListener('click', e => {
      const b = e.target.closest('[data-us-role]');
      if (!b) return;
      _role = b.dataset.usRole; _list = 'all';
      $('us-roles').querySelectorAll('[data-us-role]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });
    $('us-days')?.addEventListener('change', e => { _days = Number(e.target.value) || 30; load(); });
    $('us-class')?.addEventListener('change', _render);
    $('us-search')?.addEventListener('input', _render);
    $('us-lists')?.addEventListener('click', e => {
      const b = e.target.closest('[data-us-list]');
      if (!b) return;
      _list = b.dataset.usList;
      _render();
    });
    $('us-csv')?.addEventListener('click', _csv);
    $('us-collect')?.addEventListener('click', _askCollect);
  }

  async function load() {
    const body = $('us-body');
    if (body) body.innerHTML = '<p class="import-hint">⏳ उघडत आहे…</p>';
    try {
      const res = await API.fetchUsage(_role, _days);
      _rows = res.data;
      _collect = res.collect || {};
      _renderCollect();
      const cls = $('us-class');
      if (cls) {
        const classes = [...new Set(_rows.map(r => r.class).filter(Boolean))].sort();
        cls.innerHTML = '<option value="">सगळे classes</option>' + classes.map(c => `<option>${esc(c)}</option>`).join('');
        cls.closest('label').classList.toggle('hidden', _role !== 'student');
      }
      _render();
    } catch (err) {
      if (body) body.innerHTML = `<p class="import-hint">Usage load झालं नाही: ${esc(err.message)}</p>`;
    }
  }

  // Phones keep their usage; they upload only after this request (within 8 days).
  function _renderCollect() {
    const box = $('us-collect-status');
    if (!box) return;
    const c = _collect;
    if (!c.requested_at) { box.innerHTML = 'अजून data मागवलेला नाही. "📥 Data मागवा" दाबा — पुढच्या 8 दिवसांत app उघडणारे phones आपला data पाठवतील.'; return; }
    const open = c.until && new Date(c.until) > new Date();
    box.innerHTML = `📥 मागवलं: <b>${esc(shortDate(c.requested_at))}</b> · ${open ? `<b>${esc(shortDate(c.until))}</b> पर्यंत phones पाठवत राहतील` : 'मुदत संपली'} · आतापर्यंत <b>${c.answered || 0}</b> ${_role === 'student' ? 'students' : _role === 'teacher' ? 'teachers' : 'shops'} नी पाठवलं.`;
  }

  async function _askCollect(e) {
    const btn = e.currentTarget;
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = '⚠️ खात्री? पुन्हा दाबा';
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = '📥 Data मागवा'; } }, 3500);
      return;
    }
    btn.disabled = true;
    try {
      await API.requestUsageCollect();
      toast('📥 मागवलं — पुढच्या 8 दिवसांत phones data पाठवतील', 'success');
      await load();
    } catch (err) {
      toast(err.message || 'झालं नाही', 'error');
    } finally {
      btn.disabled = false; btn.dataset.armed = ''; btn.textContent = '📥 Data मागवा';
    }
  }

  function _score(r) {
    if (_role === 'shop') {
      const s = r.summary || {};
      return s.paid >= 1 ? ['🔥', 'जास्त'] : s.invites >= 10 ? ['🙂', 'मध्यम'] : s.invites ? ['😐', 'कमी'] : ['😴', 'नाही'];
    }
    const share = r.active_days / _days;
    return share >= 0.4 ? ['🔥', 'जास्त'] : share >= 0.1 ? ['🙂', 'मध्यम'] : r.active_days ? ['😐', 'कमी'] : ['😴', 'नाही'];
  }

  function _filtered() {
    const q = ($('us-search')?.value || '').trim().toLowerCase();
    const cls = _role === 'student' ? ($('us-class')?.value || '') : '';
    const def = LISTS[_role].find(l => l[0] === _list);
    let rows = _rows.filter(r => (!cls || r.class === cls) && (!q || [r.name, r.owner, r.code, r.mobile, r.class, r.place, r.via].some(v => String(v || '').toLowerCase().includes(q))));
    if (def?.[2]) rows = rows.filter(def[2]);
    return rows.sort((a, b) => b.active_days - a.active_days || b.minutes - a.minutes);
  }

  function _render() {
    const chips = LISTS[_role].map(([k, label, fn]) => {
      const n = fn ? _rows.filter(fn).length : _rows.length;
      return `<button type="button" class="st-chip${k === _list ? ' on' : ''}" data-us-list="${k}">${esc(label)} <small>(${n})</small></button>`;
    }).join('');
    $('us-lists').innerHTML = chips;
    const used = _role === 'shop' ? _rows.filter(r => (r.summary?.invites || 0) > 0) : _rows.filter(r => r.active_days > 0);
    const mins = used.reduce((t, r) => t + r.minutes, 0);
    const word = _role === 'student' ? 'students' : _role === 'teacher' ? 'teachers' : 'shops';
    $('us-cards').innerHTML = `
      <div class="pa-card"><small>एकूण ${word}</small><b>${_rows.length}</b><small>नोंदलेले</small></div>
      <div class="pa-card st-paid"><small>गेल्या ${_days} दिवसांत वापरलं</small><b>${used.length}</b><small>${_rows.length ? Math.round((used.length / _rows.length) * 100) : 0}% लोक</small></div>
      <div class="pa-card"><small>सरासरी वेळ (वापरणाऱ्यांची)</small><b>${used.length ? Math.round(mins / used.length) : 0} मि</b><small>${_days} दिवसांत</small></div>
      ${_role === 'student' ? `<div class="pa-card"><small>Free / Paid / संपलेले</small><b>${_rows.filter(r => r.plan === 'free').length} / ${_rows.filter(r => r.plan === 'paid' || r.plan === 'expiring').length} / ${_rows.filter(r => r.plan === 'expired').length}</b><small>आत्ताची स्थिती</small></div>` : ''}`;
    const rows = _filtered();
    const body = $('us-body');
    if (!rows.length) { body.innerHTML = '<p class="import-hint">या यादीत कोणी नाही.</p>'; return; }
    const wa = r => {
      const text = WA_TEXT[_list]?.(r.name) || '';
      return r.mobile ? `<a href="https://wa.me/91${esc(r.mobile)}${text ? `?text=${encodeURIComponent(text)}` : ''}" target="_blank" rel="noopener">📱 ${esc(r.mobile)}</a>` : '—';
    };
    const last = r => {
      const d = r.last_used || (r.last_login ? String(r.last_login).slice(0, 10) : '');
      const n = daysSince(d);
      return d ? `${esc(shortDate(d))}<br><small>${n === 0 ? 'आज' : n === 1 ? 'काल' : n + ' दिवसांपूर्वी'}</small>` : '<small>कधीच नाही</small>';
    };
    const scoreCell = r => { const [e, t] = _score(r); return `${e} <small>${t}</small>`; };
    let head, cells;
    if (_role === 'student') {
      head = '<th>Student</th><th>Plan</th><th>शेवटचं वापर</th><th>दिवस</th><th>मिनिटं</th><th>Tests</th><th>Notes</th><th>Exercise</th><th>Words</th><th>महा-Test</th><th>Score</th>';
      cells = r => `<td><b>${esc(r.name)}</b><br><small>${esc(r.code)} · ${esc(r.class)}${r.via ? ' · via ' + esc(r.via) : ''}</small><br><small>${wa(r)}</small></td>
        <td>${PLAN[r.plan] || esc(r.plan)}${r.expiry ? `<br><small>${esc(shortDate(r.expiry))}</small>` : ''}</td>
        <td>${last(r)}</td><td><b>${r.active_days}</b></td><td>${r.minutes}</td><td>${r.tests}</td><td>${r.notes}</td><td>${r.exercise}</td><td>${r.words}</td><td>${r.weekly}</td><td>${scoreCell(r)}</td>`;
    } else if (_role === 'teacher') {
      head = '<th>Teacher</th><th>Students</th><th>शेवटचं वापर</th><th>दिवस</th><th>मिनिटं</th><th>Papers</th><th>Notifications</th><th>Score</th>';
      cells = r => `<td><b>${esc(r.name)}</b>${r.status !== 'active' ? ` <span class="pa-badge">${esc(r.status)}</span>` : ''}<br><small>${esc(r.code)} · ${r.type === 'youtube' ? 'YouTube' : 'School'}${r.place ? ' · ' + esc(r.place) : ''}</small><br><small>${wa(r)}</small></td>
        <td>${r.students}</td><td>${last(r)}</td><td><b>${r.active_days}</b></td><td>${r.minutes}</td><td>${r.papers}</td><td>${r.notifs}</td><td>${scoreCell(r)}</td>`;
    } else {
      head = '<th>Shop</th><th>शेवटचं login</th><th>पालकांना पाठवले</th><th>आले / Test</th><th>Account</th><th>Paid</th><th>कमाई</th><th>Score</th>';
      cells = r => { const s = r.summary || {}; return `<td><b>${esc(r.name)}</b>${r.status !== 'active' ? ` <span class="pa-badge">${esc(r.status)}</span>` : ''}<br><small>${esc(r.owner)} · ${esc(r.code)}${r.place ? ' · ' + esc(r.place) : ''}</small><br><small>${wa(r)}</small></td>
        <td>${last(r)}</td><td><b>${s.invites || 0}</b></td><td>${s.visitors || 0} / ${s.tested || 0}</td><td>${s.accounts || 0}</td><td><b>${s.paid || 0}</b></td><td>${rs(s.earned)}</td><td>${scoreCell(r)}</td>`; };
    }
    body.innerHTML = `<div class="pa-table-wrap"><table class="pa-table st-table"><thead><tr>${head}</tr></thead><tbody>${rows.map(r => `<tr>${cells(r)}</tr>`).join('')}</tbody></table></div>
      <p class="import-hint">${_role === 'shop' ? 'Shops चे आकडे server च्या स्वतःच्या नोंदींमधून (पाठवलेले नंबर, आलेले, paid) — मागवायची गरज नाही.' : `"दिवस" = गेल्या ${_days} दिवसांपैकी किती दिवस app उघडलं. आकडे phones मध्ये साठवलेले असतात आणि "📥 Data मागवा" नंतर येतात. App 8.7.0 पासून मोजणी सुरू होते.`} Website वरचे free visitors इथे नाहीत — ते Sync → Leads मध्ये आहेत.</p>`;
  }

  function _csv() {
    const rows = _filtered();
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const PLAN_EN = { free: 'Free', paid: 'Paid', expiring: 'Expiring', expired: 'Expired' };
    const lastDay = r => r.last_used || (r.last_login ? String(r.last_login).slice(0, 10) : '');
    let head, out;
    if (_role === 'student') {
      head = ['Name', 'Code', 'Class', 'Mobile', 'Plan', 'Expiry', 'Last used', 'Active days', 'Minutes', 'Tests', 'Notes', 'Exercise', 'Words', 'Weekly tests', 'Came via'];
      out = rows.map(r => [r.name, r.code, r.class, r.mobile, PLAN_EN[r.plan] || r.plan, r.expiry ? String(r.expiry).slice(0, 10) : '', lastDay(r), r.active_days, r.minutes, r.tests, r.notes, r.exercise, r.words, r.weekly, r.via]);
    } else if (_role === 'teacher') {
      head = ['Name', 'Code', 'Type', 'Mobile', 'Students', 'Last used', 'Active days', 'Minutes', 'Papers', 'Notifications'];
      out = rows.map(r => [r.name, r.code, r.type === 'youtube' ? 'YouTube' : 'School', r.mobile, r.students, lastDay(r), r.active_days, r.minutes, r.papers, r.notifs]);
    } else {
      head = ['Shop', 'Owner', 'Code', 'Area', 'Mobile', 'Last login', 'Parents sent', 'Visitors', 'Tested', 'Accounts', 'Paid', 'Earned'];
      out = rows.map(r => { const s = r.summary || {}; return [r.name, r.owner, r.code, r.place, r.mobile, lastDay(r), s.invites || 0, s.visitors || 0, s.tested || 0, s.accounts || 0, s.paid || 0, s.earned || 0]; });
    }
    const csv = '﻿' + [head, ...out].map(r => r.map(cell).join(',')).join('\r\n');
    const name = `usage-${_role}-${_list}-${_days}d.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    if (window.FILE_EXPORT?.saveAndShare) { window.FILE_EXPORT.saveAndShare(blob, name).catch(() => toast('Download झालं नाही', 'error')); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  window.USAGE_ADMIN = { init, load };
})();
