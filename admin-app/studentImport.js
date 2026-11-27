// Admin › Students › 📥 Import — many student accounts at once (backend: controllers/studentImportController.js).
// List from an Excel / CSV file or pasted text → preview (nothing saved) → create / update →
// a printable PDF per teacher (codes, PINs, expiry + the rules page, watermarked), a CSV, and a
// ready WhatsApp message (sent from the admin's own WhatsApp — no API verification needed).
const STUDENT_IMPORT = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const COLUMNS = ['name', 'mobile', 'school', 'courses', 'plan', 'expiry', 'amount', 'teacher_code'];
  const HEADER_ALIASES = {
    name: ['name', 'student', 'student name', 'नाव', 'विद्यार्थी'],
    mobile: ['mobile', 'phone', 'mobile no', 'mobile number', 'मोबाईल', 'मोबाइल', 'फोन'],
    school: ['school', 'school name', 'शाळा'],
    courses: ['courses', 'course', 'batch', 'class', 'कोर्स', 'वर्ग'],
    plan: ['plan'],
    expiry: ['expiry', 'expiry date', 'valid till', 'मुदत'],
    amount: ['amount', 'fee', 'रक्कम', 'फी'],
    teacher_code: ['teacher_code', 'teacher code', 'teacher', 'शिक्षक'],
  };
  const AI_PROMPT = `खालील student list ला CSV मध्ये बदल. पहिली ओळ नेमकी हीच: name,mobile,school,courses,plan,expiry,amount,teacher_code
नियम:
- name: विद्यार्थ्याचं पूर्ण नाव (English अक्षरांत असेल तर उत्तम).
- mobile: फक्त 10 अंक (+91, space, - काढ).
- school: माहीत असेल तर, नाहीतर रिकामं.
- courses: माहीत नसेल तर रिकामं ठेव.
- plan: monthly किंवा yearly, माहीत नसेल तर रिकामं.
- expiry: YYYY-MM-DD, माहीत नसेल तर रिकामं.
- amount, teacher_code: माहीत नसेल तर रिकामं.
- एखाद्या मजकुरात comma असेल तर तो "दुहेरी अवतरणात" ठेव.
फक्त CSV दे, दुसरं काही लिहू नकोस.

[इथे तुमची list paste करा]`;
  const SAMPLE = '﻿name,mobile,school,courses,plan,expiry,amount,teacher_code\nManish Rajan Deshpande,9856234589,ZP School Ichalkaranji,10th - Semi English,yearly,,,T1234\nPriya Sunil Patil,9822001122,,9th - English Medium,monthly,,,\n';

  let _preview = null;
  let _rows = [];
  let _importId = '';

  // ── code rule (same as backend utils/studentCode.js) for the single Save Student form ──
  const CONS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l' };
  const VOW = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ru', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ॲ': 'a' };
  const MAT = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ru', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'a' };
  function transliterate(text) {
    const ch = [...String(text || '').normalize('NFC')];
    let out = '';
    for (let i = 0; i < ch.length; i += 1) {
      if (ch[i] === 'ज' && ch[i + 1] === '्' && ch[i + 2] === 'ञ') { out += 'dny'; i += 2; if (MAT[ch[i + 1]]) { out += MAT[ch[i + 1]]; i += 1; } else if (ch[i + 1] && ch[i + 1] !== '्') out += 'a'; continue; }
      const c = ch[i].replace('़', '');
      if (CONS[c]) {
        out += CONS[c];
        const n = ch[i + 1];
        if (n === '्') { i += 1; continue; }
        if (MAT[n]) { out += MAT[n]; i += 1; continue; }
        if (n && (CONS[n] || VOW[n])) out += 'a';
        continue;
      }
      if (VOW[c]) { out += VOW[c]; continue; }
      if (c === 'ं' || c === 'ँ') { out += 'n'; continue; }
      out += c;
    }
    return out;
  }
  const namePrefix = name => (transliterate(name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'STU').padEnd(3, 'X');

  // ── reading the list ──
  function parseDelimited(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const split = line => {
      const out = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (q) {
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (c === '"') q = false; else cur += c;
        } else if (c === '"') q = true;
        else if (c === delim) { out.push(cur); cur = ''; } else cur += c;
      }
      out.push(cur);
      return out.map(v => v.trim());
    };
    return lines.map(split);
  }

  function tableToRows(table) {
    if (!table.length) return [];
    const head = table[0].map(h => String(h || '').trim().toLowerCase());
    const map = {};
    head.forEach((h, i) => {
      for (const [key, names] of Object.entries(HEADER_ALIASES)) if (names.includes(h) && map[key] === undefined) map[key] = i;
    });
    const hasHeader = map.name !== undefined && map.mobile !== undefined;
    const body = hasHeader ? table.slice(1) : table;
    const idx = hasHeader ? map : Object.fromEntries(COLUMNS.map((c, i) => [c, i]));
    return body
      .map(cells => Object.fromEntries(COLUMNS.map(c => [c, idx[c] === undefined ? '' : String(cells[idx[c]] ?? '').trim()])))
      .filter(r => r.name || r.mobile);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (window.XLSX) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Excel reader load झाला नाही — file CSV म्हणून save करून टाका'));
      document.head.appendChild(s);
    });
  }

  async function readFile(file) {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      await loadScript(XLSX_CDN);
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const table = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
      return table.map(r => r.map(v => String(v ?? '')));
    }
    return parseDelimited(await file.text());
  }

  // ── defaults ──
  const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  function nextAprilThirty(from = new Date()) {
    const y = from.getFullYear();
    const thisYear = `${y}-04-30`;
    return istToday() <= thisYear ? thisYear : `${y + 1}-04-30`;
  }
  function planExpiry(plan) {
    if (plan === 'yearly') return nextAprilThirty();
    if (plan === 'monthly') {
      const d = new Date(Date.now() + 30 * 864e5 + 5.5 * 3600e3).toISOString().slice(0, 10);
      const cap = nextAprilThirty();
      return d > cap ? cap : d;
    }
    return '';
  }

  // 👩‍🏫 the teacher dropdown (here and the one-student form in admin.js): active teachers only; the 🔍 box filters it
  let _tList = null;
  async function activeTeachers(fresh) {
    if (!_tList || fresh) {
      const all = await API.fetchTeachers().catch(() => null);
      if (all) _tList = all.filter(t => (t.status || 'active') === 'active' && t.teacher_code).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return _tList || [];
  }
  const teacherLabel = t => `${t.name || '—'} — ${t.teacher_code}${t.institute_name ? ' · ' + t.institute_name : ''}`;
  async function teacherPicker(selId, qId, fresh) {
    const sel = $(selId), q = $(qId);
    if (!sel) return;
    const list = await activeTeachers(fresh);
    const paint = () => {
      const keep = sel.value, s = String(q?.value || '').trim().toLowerCase();
      const shown = list.filter(t => !s || t.teacher_code === keep || teacherLabel(t).toLowerCase().includes(s));
      sel.innerHTML = `<option value="">— शिक्षक नाही —${s ? ` (${shown.length} सापडले)` : ''}</option>` + shown.map(t => `<option value="${esc(t.teacher_code)}">${esc(teacherLabel(t))}</option>`).join('');
      sel.value = keep;
    };
    sel._paint = paint;   // the latest list (the first call may run before login, with none)
    paint();
    if (q && !q.dataset.on) { q.dataset.on = '1'; q.addEventListener('input', () => sel._paint && sel._paint()); }
  }
  const teacherName = code => { const t = (_tList || []).find(x => x.teacher_code === code); return t ? teacherLabel(t) : code; };

  async function renderBatches() {
    const box = $('simp-batches');
    if (!box) return;
    const batches = await DB.getAllBatches().catch(() => []);
    const picked = new Set([...box.querySelectorAll('input:checked')].map(i => i.value));
    box.innerHTML = batches.length
      ? batches.map(b => `<label class="student-batch-item"><input type="checkbox" value="${esc(b.name)}" ${picked.has(b.name) ? 'checked' : ''}/><span>${esc(b.name)}</span></label>`).join('')
      : '<p class="empty-hint">आधी Classes मध्ये courses बनवा.</p>';
  }

  function body() {
    const discount = String($('simp-discount')?.value || '').trim();
    return {
      import_id: _importId,
      defaults: {
        batches: [...document.querySelectorAll('#simp-batches input:checked')].map(i => i.value),
        plan: $('simp-plan')?.value || 'yearly',
        expiry: $('simp-expiry')?.value || '',
        teacher_code: String($('simp-teacher')?.value || '').trim().toUpperCase(),
        ...(discount !== '' ? { discount_percent: Number(discount) } : {}),
      },
      rows: _rows,
    };
  }

  const money = n => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const showDay = d => (d ? d.split('-').reverse().join('-') : '');
  const ACTION = { create: '🆕 नवीन', update: '🔄 Update', error: '❌ चूक', created: '✅ बनला', updated: '🔄 Update झाला' };

  function renderTable(rows, done = false) {
    const head = '<tr><th>#</th><th>स्थिती</th><th>नाव</th><th>Mobile</th><th>Code</th><th>PIN</th><th>Course</th><th>Expiry</th><th>रक्कम</th><th>सूचना</th></tr>';
    const body = rows.map(r => {
      const status = done ? (r.status || r.action) : r.action;
      const bg = status === 'error' ? '#fef2f2' : status.startsWith('update') ? '#eff6ff' : '#f0fdf4';
      const notes = [...(r.errors || []), ...(r.warnings || [])].filter(Boolean).join(' · ');
      return `<tr style="background:${bg}"><td>${r.line}</td><td>${ACTION[status] || esc(status)}</td><td>${esc(r.name)}</td><td>${esc(r.mobile)}</td>
        <td><b>${esc(r.student_code)}</b></td><td>${r.pin ? `<b>${esc(r.pin)}</b>` : (status !== 'error' ? 'जुना' : '')}</td>
        <td>${esc((r.courses || []).join(', '))}</td><td>${showDay(r.expiry)}</td>
        <td>${status === 'error' ? '' : `${money(r.amount)}${r.discount_percent ? ` <small>(−${r.discount_percent}%)</small>` : ''}`}</td>
        <td style="color:${status === 'error' ? '#b91c1c' : '#92400e'}">${esc(notes)}</td></tr>`;
    }).join('');
    $('simp-table').innerHTML = `<table class="admin-table" style="width:100%;font-size:0.8rem;border-collapse:collapse"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }

  function renderSummary(data, done = false) {
    const s = data.summary;
    const t = (data.teachers || []).map(x => `👨‍🏫 <b>${esc(x.name)}</b> (${esc(x.teacher_code)}) — ${x.students} विद्यार्थी`).join('<br>');
    $('simp-summary').innerHTML = `<div style="display:block;padding:10px 12px;margin:8px 0;border:1px solid #e5e7eb;border-radius:12px;background:#fff;line-height:1.7">
      ${done ? `<b>✅ झालं:</b> ${s.created} नवीन · ${s.updated} update · ${s.failed} चूक` : `<b>Preview:</b> ${s.create} नवीन · ${s.update} update · <span style="color:#b91c1c">${s.errors} चूक</span>`}
      <br>एकूण रक्कम <b>${money(s.amount)}</b> (सूट ${money(s.discount)})
      ${t ? `<br>${t}` : ''}</div>`;
  }

  async function doPreview() {
    try {
      const text = String($('simp-paste')?.value || '');
      _rows = tableToRows(parseDelimited(text));
      if (!_rows.length) { APP.toast('List रिकामी आहे — file निवडा किंवा paste करा', 'error'); return; }
      _importId = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      $('simp-preview-btn').disabled = true;
      _preview = await API.previewStudentImport(body());
      renderSummary(_preview);
      renderTable(_preview.rows);
      $('simp-result').innerHTML = '';
      const okCount = _preview.summary.create + _preview.summary.update;
      $('simp-run-btn').disabled = okCount === 0;
      $('simp-run-btn').textContent = `✅ ${okCount} accounts बनवा / update करा`;
      const t = _preview.teachers?.[0];
      $('simp-teacher-info').textContent = t ? `${t.name}${t.rules_pending ? ' · 📜 नियम अजून मान्य केलेले नाहीत' : ''}` : '';
    } catch (err) {
      APP.toast(err.message || 'Preview झाला नाही', 'error');
    } finally {
      $('simp-preview-btn').disabled = false;
    }
  }

  async function doRun() {
    if (!_preview) return;
    const s = _preview.summary;
    if (!confirm(`${s.create} नवीन + ${s.update} update · एकूण ${money(s.amount)} paid म्हणून नोंदवायचे?`)) return;
    try {
      $('simp-run-btn').disabled = true;
      $('simp-run-btn').textContent = '⏳ बनत आहे…';
      const res = await API.runStudentImport(body());
      renderSummary(res, true);
      renderTable(res.rows, true);
      await renderResult(res);
      _preview = null;
      $('simp-run-btn').textContent = '✅ Accounts बनवा';
      $('btn-refresh-students')?.click();
      APP.toast(`✅ ${res.summary.created} नवीन, ${res.summary.updated} update`, 'success');
    } catch (err) {
      APP.toast(err.message || 'Import झाला नाही', 'error');
      $('simp-run-btn').disabled = false;
      $('simp-run-btn').textContent = '✅ परत प्रयत्न करा (दुप्पट होणार नाही)';
    }
  }

  // ── after the import: PDF per teacher, CSV, WhatsApp ──
  async function renderResult(res) {
    const ok = res.rows.filter(r => r.status === 'created' || r.status === 'updated');
    const groups = new Map();
    ok.forEach(r => { const k = r.teacher_code || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const blocks = [...groups].map(([code, rows], gi) => {
      const t = (res.teachers || []).find(x => x.teacher_code === code);
      const wa = t?.mobile ? `https://wa.me/91${t.mobile}?text=${encodeURIComponent(t.whatsapp_text)}` : '';
      return `<div style="display:block;padding:10px 12px;margin:8px 0;border:1px solid #e5e7eb;border-radius:12px;background:#fff;line-height:1.7">
        <b>${t ? `👨‍🏫 ${esc(t.name)} (${esc(code)})` : 'Teacher शिवाय'}</b> — ${rows.length} विद्यार्थी
        <div class="admin-toolbar" style="flex-wrap:wrap;margin-top:6px">
          <button class="admin-btn-primary" type="button" data-simp-pdf="${gi}">📄 PDF (code, PIN + नियम)</button>
          <button class="admin-btn-secondary" type="button" data-simp-csv="${gi}">⬇ Excel / CSV</button>
          ${wa ? `<a class="admin-btn-secondary" href="${wa}" target="_blank" rel="noopener">📲 WhatsApp वर पाठवा</a>` : ''}
          ${t && t.rules_pending ? `<button class="admin-btn-secondary" type="button" data-simp-copy="${esc(t.rules_url)}">🔗 नियमांची link copy</button>` : t ? '<span class="import-hint">✅ नियम आधीच मान्य</span>' : ''}
        </div>
        ${t ? `<p class="import-hint">${t.pushed ? '🔔 Teacher ला app notification गेलं.' : '🔔 Teacher चं app notification चालू नाही — WhatsApp वर पाठवा.'} ${t.rules_pending ? '📜 नियम मान्य होईपर्यंत Paper save थांबेल.' : '📜 नियम आधीच मान्य.'}</p>` : ''}
      </div>`;
    });
    $('simp-result').innerHTML = blocks.join('');
    const list = [...groups];
    document.querySelectorAll('[data-simp-pdf]').forEach(b => b.addEventListener('click', () => {
      const [code, rows] = list[Number(b.dataset.simpPdf)];
      printPdf(rows, (res.teachers || []).find(x => x.teacher_code === code));
    }));
    document.querySelectorAll('[data-simp-csv]').forEach(b => b.addEventListener('click', () => {
      const [code, rows] = list[Number(b.dataset.simpCsv)];
      downloadCsv(rows, code);
    }));
    document.querySelectorAll('[data-simp-copy]').forEach(b => b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.simpCopy); APP.toast('Link copy झाली', 'success'); } catch { prompt('Link copy करा:', b.dataset.simpCopy); }
    }));
  }

  function downloadCsv(rows, code) {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['name', 'mobile', 'student_code', 'pin', 'courses', 'expiry', 'status', 'teacher_code'].join(',')]
      .concat(rows.map(r => [r.name, r.mobile, r.student_code, r.pin || 'जुना PIN', (r.courses || []).join('; '), r.expiry, r.status, r.teacher_code].map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `students-${code || 'list'}-${istToday()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Printable page → the browser's "Save as PDF" (Devanagari prints correctly, unlike font-less PDF libraries)
  async function printPdf(rows, teacher) {
    const w = window.open('', '_blank');
    if (!w) { APP.toast('Popup blocked — popups allow करा', 'error'); return; }
    w.document.write('<p style="font-family:sans-serif">PDF तयार होत आहे…</p>');
    const rules = await API.fetchTeacherRules().catch(() => null);
    const courses = [...new Set(rows.flatMap(r => r.courses || []))];
    const expiry = rows.map(r => r.expiry).sort().pop();
    const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
    const mark = teacher ? `${teacher.name} (${teacher.teacher_code}) · NKs EduOrbit` : 'NKs EduOrbit';
    const notice = 'NKs EduOrbit — केवळ वर्गात शिकवण्यासाठी · विक्री / पुस्तक बनवणे मना';
    const rulesHtml = rules ? `<section class="page"><h2>📜 ${esc(rules.title)}</h2><p class="muted">${esc(rules.owner)} · Version ${esc(rules.version)} · ${esc(rules.updated)}</p>
      ${rules.sections.map(s => `<h3>${esc(s.title)}</h3><ul>${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
      <p class="agree">✍️ हे accounts वापरल्यास वरील नियम मान्य आहेत असे समजले जाईल. नियम online मान्य करा: <b>${esc(teacher?.rules_url || 'https://nkseduorbit.in/teacher-rules')}</b></p></section>` : '';
    w.document.open();
    w.document.write(`<!doctype html><html lang="mr"><head><meta charset="utf-8"><title>Students ${esc(teacher?.teacher_code || '')}</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  body { font-family: "Noto Sans Devanagari", "Mangal", "Nirmala UI", Arial, sans-serif; color: #111; font-size: 12px; }
  .wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
  .wm span { transform: rotate(-30deg); font-size: 38px; color: rgba(0,31,92,0.07); font-weight: 800; white-space: nowrap; }
  .foot { position: fixed; bottom: -10mm; left: 0; right: 0; text-align: center; font-size: 9px; color: #555; }
  .page { position: relative; z-index: 1; }
  .page + .page { page-break-before: always; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #001F5C; } h2 { color: #001F5C; font-size: 17px; } h3 { font-size: 13px; margin: 12px 0 4px; }
  .muted { color: #555; } .box { border: 1px solid #ccd; border-radius: 8px; padding: 10px; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #bbb; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #001F5C; color: #fff; } tr:nth-child(even) td { background: #f5f7fb; }
  td.code, td.pin { font-family: Consolas, monospace; font-weight: 700; font-size: 13px; }
  li { margin: 3px 0; } .agree { margin-top: 14px; padding: 8px; border: 1px dashed #001F5C; }
</style></head><body>
<div class="wm"><span>${esc(mark)}</span></div>
<div class="foot">${esc(notice)} · ${esc(mark)}</div>
<section class="page">
  <h1>विद्यार्थी Login माहिती</h1>
  <p class="muted">NKs EduOrbit (TeachingBoard) · ${showDay(istToday())}</p>
  <div class="box">
    ${teacher ? `<b>शिक्षक:</b> ${esc(teacher.name)} (${esc(teacher.teacher_code)})<br>` : ''}
    <b>Course:</b> ${esc(courses.join(', '))}<br>
    <b>मुदत:</b> ${showDay(expiry)} पर्यंत · <b>विद्यार्थी:</b> ${rows.length} · <b>एकूण रक्कम:</b> ${money(total)}<br>
    <b>Login:</b> App मध्ये Student code आणि PIN टाका. PIN = mobile चे शेवटचे 4 अंक (आधीच्या विद्यार्थ्यांचा जुना PIN तसाच).
  </div>
  <table><thead><tr><th>#</th><th>नाव</th><th>Mobile</th><th>Student code</th><th>PIN</th><th>मुदत</th><th>Course</th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.mobile)}</td><td class="code">${esc(r.student_code)}</td><td class="pin">${esc(r.pin || 'जुना')}</td><td>${showDay(r.expiry)}</td><td>${esc((r.courses || []).join(', '))}</td></tr>`).join('')}
  </tbody></table>
</section>
${rulesHtml}
<script>setTimeout(function(){ window.print(); }, 400);<\/script>
</body></html>`);
    w.document.close();
  }

  // ── wiring ──
  function init() {
    if (!$('student-import-section') || init.done) return;
    init.done = true;
    $('simp-expiry').value = planExpiry('yearly');
    $('simp-plan').addEventListener('change', e => { const v = planExpiry(e.target.value); if (v || e.target.value === 'custom') $('simp-expiry').value = v; });
    $('simp-file').addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const table = await readFile(file);
        $('simp-paste').value = table.map(r => r.map(v => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');
        APP.toast(`${Math.max(0, table.length - 1)} ओळी वाचल्या — आता Preview करा`, 'success');
      } catch (err) { APP.toast(err.message || 'File वाचता आली नाही', 'error'); }
    });
    $('simp-sample').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv;charset=utf-8' }));
      a.download = 'students-sample.csv';
      a.click();
    });
    $('simp-prompt').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(AI_PROMPT); APP.toast('AI prompt copy झाला — AI मध्ये paste करा आणि list जोडा', 'success'); } catch { prompt('हा prompt copy करा:', AI_PROMPT); }
    });
    $('simp-preview-btn').addEventListener('click', doPreview);
    $('simp-run-btn').addEventListener('click', doRun);
    ['simp-paste', 'simp-plan', 'simp-expiry', 'simp-teacher', 'simp-discount'].forEach(id => $(id).addEventListener('input', () => { _preview = null; $('simp-run-btn').disabled = true; }));
    $('simp-batches').addEventListener('change', () => { _preview = null; $('simp-run-btn').disabled = true; });
    renderBatches();
    teacherPicker('simp-teacher', 'simp-teacher-q');
    // courses are added / renamed in the Classes tab (teachers in Teachers): refresh when Students opens
    document.addEventListener('click', e => { if (e.target.closest?.('.atab[data-tab="students"]')) { renderBatches(); teacherPicker('simp-teacher', 'simp-teacher-q', true).then(() => teacherPicker('student-teacher', 'student-teacher-q')); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);

  return { init, namePrefix, transliterate, parseDelimited, tableToRows, planExpiry, teacherPicker, teacherName };
})();
window.STUDENT_IMPORT = STUDENT_IMPORT;
