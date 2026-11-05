/* ════════════════════════════════════════
   siteAdmin.js — Admin › 🗺️ Site / Exams
   Global: SITE_ADMIN

   The public exam pages on nkseduorbit.in (/, /exams, /exams/<slug>, sitemap.xml).
   Each exam: facts (purpose, eligibility, paper pattern, syllabus, dates, FAQ, official link),
   the app class it sells, the page animation, and the ads' "loss" line. "✅ तपासलं" marks the
   facts as checked against the official site (180 days later it turns red). "🚀 Publish" puts
   every enabled + checked exam live and asks Vercel to rebuild the site. Preview uses the same
   renderer as the real build (site-build/render.mjs).
════════════════════════════════════════ */

const SITE_ADMIN = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const day = d => d ? new Date(d).toISOString().slice(0, 10) : '';
  let _data = null, _open = '', _ready = false, _pubArm = 0;

  function _status(e) {
    if (!e.enabled) return '<span class="site-chip off">⏸ बंद</span>';
    const out = [];
    if (!e.verified_on) out.push('<span class="site-chip warn">⚠️ तपासा</span>');
    else if (e.stale) out.push('<span class="site-chip bad">🔴 माहिती जुनी — पुन्हा तपासा</span>');
    if (e.is_live) out.push(e.changed ? '<span class="site-chip edit">✏️ बदल publish बाकी</span>' : '<span class="site-chip ok">🟢 Live</span>');
    else if (e.verified_on) out.push('<span class="site-chip edit">⏳ Publish बाकी</span>');
    return out.join(' ');
  }
  function _next(e) {
    const today = new Date().setHours(0, 0, 0, 0);
    const n = (e.dates || []).filter(d => d.date && new Date(d.date).getTime() >= today).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    return n ? `${_esc(n.label)}: ${fmt(n.date)}` : '<span class="site-muted">तारीख नाही</span>';
  }

  function _paintList() {
    const d = _data; if (!d) return;
    const missing = d.seed_count - d.exams.length;
    $('site-status').innerHTML = [
      d.hook ? '✅ Vercel जोडलेलं (Publish दाबलं की site 1–2 मिनिटांत बदलते)' : '⚠️ Render मध्ये <b>VERCEL_DEPLOY_HOOK</b> नाही — Publish नंतर pages पुढच्या push ला बदलतील',
      `Live: <b>${d.exams.filter(e => e.is_live && e.enabled).length}</b> / ${d.exams.length}`,
      d.last_publish ? `शेवटचं Publish: ${fmt(d.last_publish)}` : 'अजून Publish नाही',
      `<a href="${_esc(d.site)}/exams" target="_blank" rel="noopener">${_esc(d.site.replace(/^https:\/\//, ''))}/exams ↗</a>`,
    ].join(' · ');
    $('site-seed').hidden = !(missing > 0);
    $('site-seed').textContent = `➕ सुरुवातीची माहिती भरा (${missing} परीक्षा)`;
    $('site-list').innerHTML = d.exams.length ? `<table class="ads-table site-table"><thead><tr><th>परीक्षा</th><th>App class</th><th>पुढची तारीख</th><th>स्थिती</th><th></th></tr></thead><tbody>${
      d.exams.map(e => `<tr${e.slug === _open ? ' class="site-open"' : ''}><td><b>${_esc(e.name)}</b><small class="ads-set">/exams/${_esc(e.slug)} · ${e.group === 'senior' ? '11वी–12वी' : 'शाळा'}</small></td>
        <td>${e.batch ? _esc(e.batch) : '<span class="site-muted">— (लवकरच)</span>'}</td><td>${_next(e)}</td><td>${_status(e)}</td>
        <td><button type="button" class="admin-btn-secondary" data-open="${_esc(e.slug)}">${e.slug === _open ? 'बंद' : 'उघडा'}</button></td></tr>`).join('')
    }</tbody></table>` : '<p class="import-hint">अजून एकही परीक्षा नाही. "सुरुवातीची माहिती भरा" दाबा.</p>';
  }

  const row = (k, label, inner, hint = '') => `<label class="site-f" data-k="${k}"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const inp = (k, v, ph = '', max = 80) => `<input class="admin-input" data-f="${k}" value="${_esc(v)}" placeholder="${_esc(ph)}" maxlength="${max}">`;
  const area = (k, v, rows = 3, ph = '', max = 2000) => `<textarea class="admin-input" data-f="${k}" rows="${rows}" placeholder="${_esc(ph)}" maxlength="${max}">${_esc(v)}</textarea>`;
  const dateRow = (d = {}) => `<div class="site-date"><input class="admin-input" data-d="label" value="${_esc(d.label || '')}" placeholder="उदा. परीक्षा / Form शेवटची तारीख" maxlength="60">
    <input class="admin-input" type="date" data-d="date" value="${day(d.date)}" title="रिकामं = अजून जाहीर नाही">
    <input class="admin-input" data-d="note" value="${_esc(d.note || '')}" placeholder="टीप (ऐच्छिक)" maxlength="80">
    <button type="button" class="admin-btn-secondary" data-del-row aria-label="काढा">✕</button></div>`;
  const faqRow = (f = {}) => `<div class="site-faq"><input class="admin-input" data-q value="${_esc(f.q || '')}" placeholder="प्रश्न" maxlength="200">
    <textarea class="admin-input" data-a rows="2" placeholder="उत्तर" maxlength="1200">${_esc(f.a || '')}</textarea>
    <button type="button" class="admin-btn-secondary" data-del-row aria-label="काढा">✕</button></div>`;

  // ── 🤖 AI कडून माहिती: a ready prompt for ChatGPT / Claude; its answer (JSON) fills the form ──
  function _aiPrompt() {
    const box = $('site-editor'), v = k => box.querySelector('[data-f="' + k + '"]')?.value?.trim() || '';
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();
    return [
      'तू भारतातील स्पर्धा परीक्षांचा माहितीतज्ज्ञ आणि मराठी SEO writer आहेस. खालील परीक्षेची या वर्षाची ताजी, अचूक माहिती दे —',
      'ती एका वेबसाइटच्या परीक्षा-page वर जाईल; पालक Google वर मराठीत / English मध्ये जे शोधतात त्याला या page ने थेट उत्तर द्यायला हवं.',
      '',
      'परीक्षा: ' + (v('name') || v('name_en')) + (v('name_en') && v('name') ? ' (' + v('name_en') + ')' : ''),
      'इयत्ता: ' + (v('class_label') || '—'),
      'Official site: ' + (v('official_url') || '—'),
      'आजची तारीख: ' + today,
      '',
      'अचूकतेचे नियम (काटेकोर):',
      '1. फक्त official notification / official website वरची माहिती दे. अंदाज करू नकोस. Coaching / blog sites वर विश्वास ठेवू नकोस.',
      '2. एखादी तारीख अजून जाहीर झाली नसेल किंवा खात्री नसेल तर "date": null ठेव आणि "note" मध्ये "अजून जाहीर नाही" लिही.',
      '3. आकडे (गुण, प्रश्न, वेळ, शिष्यवृत्तीची रक्कम, उत्पन्न मर्यादा) official notification मधलेच दे.',
      '4. "sources" मध्ये तू वापरलेल्या official pages / PDF चे पूर्ण links दे.',
      '',
      'Google साठी लिहिण्याचे नियम:',
      '5. "name": लहान, 40 अक्षरांपेक्षा कमी, परीक्षेचा लोक शोधतात तो शब्द सुरुवातीला. उदा. "NMMS शिष्यवृत्ती परीक्षा (8वी)". पूर्ण अधिकृत लांब नाव "full_name" मध्ये दे (उदा. "राष्ट्रीय आर्थिक दुर्बल घटक गुणवत्ता शिष्यवृत्ती परीक्षा (NMMS)").',
      '6. "purpose": 2 वाक्यं, एकूण 120–155 अक्षरं (हेच Google च्या निकालात खाली दिसतं). परीक्षेचं नाव, ' + year + ', इयत्ता आणि मुख्य फायदा त्यात हवा.',
      '7. "faq": 5 ते 8 प्रश्न — पालक Google वर जसे टाइप करतात तसे (उदा. "NMMS ' + year + ' परीक्षा कधी आहे?", "NMMS साठी पात्रता काय?", "NMMS form कसा भरायचा?", "NMMS निकाल कधी लागतो?", "NMMS पास होण्यासाठी किती गुण लागतात?"). प्रत्येक उत्तर 1–3 वाक्यांत, स्वतंत्रपणे वाचलं तरी समजेल असं, आकड्यांसह.',
      '8. तारखांची "label" ही साधी, नेहमीची नावं: "Online अर्ज सुरू", "अर्जाची शेवटची तारीख", "प्रवेशपत्र (Admit card)", "परीक्षा", "निकाल".',
      '9. पात्रता / अभ्यासक्रम: प्रत्येक मुद्दा एक छोटं वाक्य (एका ओळीत एक).',
      '10. दुसऱ्या वेबसाइटचा मजकूर जसाच्या तसा copy करू नकोस — स्वतःच्या सोप्या शब्दांत लिही. "सर्वोत्तम", "100% निवड" असे दावे नकोत.',
      '11. उत्तरात फक्त खालील JSON दे — त्याआधी किंवा नंतर एकही शब्द नको.',
      '',
      JSON.stringify({
        name: 'लहान नाव (इयत्ता) — 40 अक्षरांपेक्षा कमी', full_name: 'पूर्ण अधिकृत नाव (लांब असलं तरी चालेल)', name_en: 'Short English name', class_label: 'उदा. 8वी',
        purpose: '2 वाक्यं, 120–155 अक्षरं: नाव + वर्ष + इयत्ता + फायदा', benefit: 'मुख्य फायदा, 6-8 शब्दांत',
        eligibility: ['पात्रतेचा एक मुद्दा', 'दुसरा मुद्दा'],
        pattern: [{ part: 'पेपर / विषय', questions: 90, marks: 90, time: '90 मिनिटे' }],
        syllabus: ['अभ्यासक्रमाचा एक मुद्दा', 'दुसरा'],
        official_url: 'https://…',
        dates: [{ label: 'अर्जाची शेवटची तारीख', date: 'YYYY-MM-DD', note: '' }, { label: 'परीक्षा', date: null, note: 'अजून जाहीर नाही' }],
        faq: [{ q: 'पालक Google वर टाइप करतात तसा प्रश्न', a: '1–3 वाक्यांत उत्तर, आकड्यांसह' }],
        ad_loss_mr: '…आणि [फायदा] गेला / गेली (ad साठी, 8-10 शब्द)', ad_loss_en: '…and lost [benefit]',
        sources: ['https://…'],
      }, null, 2),
    ].join('\n');
  }
  function _aiFill() {
    const box = $('site-editor'), msg = $('site-ai-msg');
    const raw = $('site-ai-in').value.trim();
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    let j;
    try { j = JSON.parse(raw.slice(a, b + 1)); } catch { msg.innerHTML = '⚠️ उत्तर JSON मध्ये नाही. AI ला सांगा: "फक्त JSON दे" आणि पुन्हा paste करा.'; return; }
    const lines = x => Array.isArray(x) ? x.map(t => String(t).trim()).filter(Boolean).join('\n') : String(x || '').trim();
    const set = (k, val) => {
      const el = box.querySelector('[data-f="' + k + '"]');
      if (!el || val === undefined || val === null || String(val).trim() === '') return 0;
      el.value = String(val).trim().slice(0, Number(el.maxLength) > 0 ? el.maxLength : 5000); return 1;
    };
    let n = 0;
    for (const k of ['name', 'full_name', 'name_en', 'class_label', 'purpose', 'benefit', 'ad_loss_mr', 'ad_loss_en']) n += set(k, j[k]);
    if (/^https:\/\//.test(String(j.official_url || ''))) n += set('official_url', j.official_url);
    n += set('eligibility', lines(j.eligibility));
    n += set('syllabus', lines(j.syllabus));
    n += set('pattern', Array.isArray(j.pattern)
      ? j.pattern.map(p => typeof p === 'string' ? p : [p.part, p.questions, p.marks, p.time].map(c => String(c ?? '').trim()).join(' | ')).join('\n')
      : lines(j.pattern));
    if (Array.isArray(j.dates) && j.dates.length) {
      $('site-dates').innerHTML = j.dates.slice(0, 8).filter(d => d && d.label).map(d => dateRow({ label: d.label, date: /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? d.date : null, note: d.note || (d.date ? '' : 'अजून जाहीर नाही') })).join('');
      n++;
    }
    if (Array.isArray(j.faq) && j.faq.length) { $('site-faqs').innerHTML = j.faq.slice(0, 12).filter(x => x && x.q && x.a).map(faqRow).join(''); n++; }
    const src = (Array.isArray(j.sources) ? j.sources : []).filter(u => /^https?:\/\//.test(u)).slice(0, 8);
    msg.innerHTML = '✅ ' + n + ' भाग भरले. <b>अजून Save केलेलं नाही</b> — खाली वाचा, official site शी जुळवा, मग "✅ Official site वर तपासलं — Save" दाबा.'
      + (src.length ? '<br>AI ने वापरलेले links (हे उघडून तारखा तपासा):<br>' + src.map(u => '<a href="' + _esc(u) + '" target="_blank" rel="noopener">' + _esc(u) + '</a>').join('<br>')
        : '<br>⚠️ AI ने links (sources) दिले नाहीत — तारखा official site वर नक्की तपासा.');
  }

  // Google: a short name (the search title), a 120–155 letter description, 4+ FAQ
  function _seoHints() {
    const box = $('site-editor'); if (!box || box.hidden) return;
    const hint = (k, html) => {
      const lab = box.querySelector('.site-f[data-k="' + k + '"]'); if (!lab) return;
      let el = lab.querySelector('.site-seo'); if (!el) { el = document.createElement('small'); el.className = 'site-seo'; lab.appendChild(el); }
      el.textContent = html;
    };
    const v = k => (box.querySelector('[data-f="' + k + '"]')?.value || '').trim();
    const n = [...v('name')].length, p = [...v('purpose')].length, fq = box.querySelectorAll('.site-faq').length;
    hint('name', n <= 40 ? `✅ Google साठी योग्य (${n} अक्षरं)` : `⚠️ ${n} अक्षरं — Google मध्ये कापलं जाईल; 40 पेक्षा कमी ठेवा, लोक शोधतात तो शब्द (उदा. NMMS) आधी`);
    hint('purpose', p >= 120 && p <= 160 ? `✅ Google च्या निकालात हेच दिसेल (${p} अक्षरं)` : `⚠️ ${p} अक्षरं — 120–155 योग्य (Google च्या निकालात हेच दिसतं)`);
    const add = $('site-add-faq');
    if (add) {
      let el = add.parentElement.querySelector(':scope > .site-seo');
      if (!el) { el = document.createElement('small'); el.className = 'site-seo'; add.parentElement.insertBefore(el, add); }
      el.textContent = fq >= 4 ? `✅ ${fq} प्रश्न` : `⚠️ ${fq} प्रश्न — किमान 4–5 ठेवा (पालक Google वर विचारतात तसे)`;
    }
  }

  function _paintEditor() {
    const box = $('site-editor');
    const e = _open === '+new' ? { slug: '', name: '', group: 'school', enabled: true, animation: 'auto', dates: [{ label: 'परीक्षा' }], faq: [], order: 100 }
      : _data?.exams.find(x => x.slug === _open);
    if (!e) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    const batches = _data.batches || [];
    box.innerHTML = `
      <h4 class="site-h">${e.slug ? '✏️ ' + _esc(e.name) : '➕ नवीन परीक्षा'}</h4>
      ${e.verified_on ? `<p class="${e.stale ? 'site-bad' : 'import-hint'}">माहिती तपासली: <b>${fmt(e.verified_on)}</b>${e.stale ? ' — 6 महिन्यांपेक्षा जुनी, official site वर पुन्हा तपासा' : ''}</p>`
        : '<p class="site-bad">⚠️ ही माहिती अजून कोणी तपासलेली नाही (सुरुवातीची माहिती सर्वसाधारण माहितीवरून भरली आहे). Official site वर तपासून "✅ तपासलं" दाबा — त्याशिवाय ही परीक्षा website वर जाणार नाही.</p>'}
      <details class="site-ai">
        <summary>🤖 AI (ChatGPT / Claude) कडून ताजी माहिती भरा</summary>
        <ol class="import-hint">
          <li>"📋 Prompt copy करा" दाबा आणि ChatGPT / Claude मध्ये paste करा (शक्यतो web search चालू ठेवून).</li>
          <li>AI चं पूर्ण उत्तर खालच्या box मध्ये paste करा आणि "⬇ Form मध्ये भरा" दाबा.</li>
          <li>भरलेली माहिती official site शी जुळवा, मग "✅ तपासलं — Save" आणि 🚀 Publish.</li>
        </ol>
        <div class="site-btns"><button type="button" class="admin-btn-secondary" id="site-ai-copy">📋 Prompt copy करा</button><span id="site-ai-copied" class="import-hint" role="status"></span></div>
        <textarea id="site-ai-in" class="admin-input" rows="6" placeholder="AI चं उत्तर (JSON) इथे paste करा"></textarea>
        <div class="site-btns"><button type="button" class="admin-btn-primary" id="site-ai-fill">⬇ Form मध्ये भरा</button></div>
        <p id="site-ai-msg" class="import-hint" role="status"></p>
      </details>
      <div class="site-grid">
        ${row('slug', 'Link (slug)', `<input class="admin-input" data-f="slug" value="${_esc(e.slug)}" placeholder="उदा. nmms" maxlength="40" ${e.slug ? 'readonly' : ''}>`, 'nkseduorbit.in/exams/… — नंतर बदलत नाही')}
        ${row('name', 'नाव', inp('name', e.name, 'उदा. NMMS (8वी)'))}
        ${row('full_name', 'पूर्ण अधिकृत नाव', inp('full_name', e.full_name, 'उदा. राष्ट्रीय आर्थिक दुर्बल घटक गुणवत्ता शिष्यवृत्ती परीक्षा', 200), 'Page वर नावाखाली दिसतं (Google ला दोन्ही नावं कळतात)')}
        ${row('name_en', 'English नाव', inp('name_en', e.name_en, 'NMMS (Class 8)'))}
        ${row('class_label', 'कोणती इयत्ता देते', inp('class_label', e.class_label, 'उदा. 8वी', 40))}
        ${row('group', 'Landing page tab', `<select class="admin-input" data-f="group"><option value="school"${e.group !== 'senior' ? ' selected' : ''}>🏫 शाळा स्तर (4थी–8वी)</option><option value="senior"${e.group === 'senior' ? ' selected' : ''}>🎓 11वी–12वी</option></select>`)}
        ${row('order', 'क्रम', `<input class="admin-input" type="number" data-f="order" value="${_esc(e.order ?? 100)}" min="0" max="9999">`, 'लहान आकडा आधी')}
        ${row('batch', 'App मधील class', `<select class="admin-input" data-f="batch"><option value="">— अजून नाही (लवकरच + WhatsApp वर कळवा)</option>${batches.map(b => `<option${b === e.batch ? ' selected' : ''}>${_esc(b)}</option>`).join('')}</select>`, 'निवडलं की page वर "▶ Free Test" येतं, आणि Ads पण याच परीक्षेची माहिती वापरतात')}
        ${row('animation', 'Page वरचं animation', `<select class="admin-input" data-f="animation">${[['auto', 'आपोआप (तारीख असेल तर दिवस बाकी, नाहीतर प्रश्न)'], ['days', '⏰ दिवस बाकी'], ['question', '🧩 Free test मधला खरा प्रश्न'], ['none', 'काहीच नको']].map(([v, t]) => `<option value="${v}"${v === (e.animation || 'auto') ? ' selected' : ''}>${t}</option>`).join('')}</select>`)}
        ${row('benefit', 'फायदा (छोटं)', inp('benefit', e.benefit, 'उदा. ₹48,000 शिष्यवृत्ती (9वी–12वी)'))}
        ${row('official_url', 'Official link', inp('official_url', e.official_url, 'https://…', 300))}
      </div>
      ${row('purpose', 'परीक्षा कशासाठी (एक परिच्छेद)', area('purpose', e.purpose, 3, '', 400))}
      ${row('eligibility', 'पात्रता', area('eligibility', e.eligibility, 3, '', 1500), 'प्रत्येक मुद्दा नवीन ओळीवर')}
      ${row('pattern', 'पेपरची रचना', area('pattern', e.pattern, 4), 'प्रत्येक ओळ: भाग | प्रश्न | गुण | वेळ (उदा. MAT | 90 | 90 | 90 मिनिटे)')}
      ${row('syllabus', 'अभ्यासक्रम', area('syllabus', e.syllabus, 3), 'प्रत्येक मुद्दा नवीन ओळीवर')}
      <div class="site-f"><span>📅 तारखा (दर वर्षी बदला; तारीख रिकामी = "अजून जाहीर नाही")</span><div id="site-dates">${(e.dates || []).map(dateRow).join('')}</div>
        <button type="button" class="admin-btn-secondary" id="site-add-date">+ तारीख</button></div>
      <div class="site-f"><span>❓ नेहमीचे प्रश्न (Google मध्ये प्रश्न-उत्तर म्हणून दिसू शकतात)</span><div id="site-faqs">${(e.faq || []).map(faqRow).join('')}</div>
        <button type="button" class="admin-btn-secondary" id="site-add-faq">+ प्रश्न</button></div>
      <div class="site-grid">
        ${row('ad_loss_mr', 'Ads: "नुकसान" ओळ (मराठी)', inp('ad_loss_mr', e.ad_loss_mr, '…आणि ₹48,000 ची शिष्यवृत्ती गेली'), 'रिकामं = "…आणि मेरिट लिस्ट हुकली"')}
        ${row('ad_loss_en', 'Ads: "loss" line (English)', inp('ad_loss_en', e.ad_loss_en, '…and lost the ₹48,000 scholarship'))}
      </div>
      <label class="site-check"><input type="checkbox" data-f="enabled"${e.enabled !== false ? ' checked' : ''}> Website वर दाखवा</label>
      <div class="site-btns">
        <button type="button" class="admin-btn-primary" data-save="1">💾 Save</button>
        <button type="button" class="admin-btn-secondary" data-save="verify">✅ Official site वर तपासलं — Save</button>
        <button type="button" class="admin-btn-secondary" id="site-preview">👁 Preview</button>
        <span id="site-msg" class="import-hint" role="status"></span>
      </div>
      <div id="site-preview-box" hidden><iframe id="site-frame" title="Preview"></iframe></div>`;
    _seoHints();
  }

  function _collect() {
    const box = $('site-editor'), o = {};
    box.querySelectorAll('[data-f]').forEach(el => { o[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
    o.dates = [...box.querySelectorAll('.site-date')].map(r => ({ label: r.querySelector('[data-d="label"]').value.trim(), date: r.querySelector('[data-d="date"]').value || null, note: r.querySelector('[data-d="note"]').value.trim() })).filter(d => d.label);
    o.faq = [...box.querySelectorAll('.site-faq')].map(r => ({ q: r.querySelector('[data-q]').value.trim(), a: r.querySelector('[data-a]').value.trim() })).filter(f => f.q && f.a);
    return o;
  }

  async function _save(verify) {
    const msg = $('site-msg'), body = _collect();
    const slug = String(body.slug || '').trim().toLowerCase();
    if (!slug) { msg.textContent = 'Link (slug) टाका, उदा. nmms'; return; }
    if (verify) body.verified = true;
    msg.textContent = '⏳ Save होत आहे…';
    try {
      const r = await API.siteSave(slug, body);
      const i = _data.exams.findIndex(x => x.slug === slug);
      if (i >= 0) _data.exams[i] = r.exam; else _data.exams.push(r.exam);
      _open = slug; _paintList(); _paintEditor();
      $('site-msg').textContent = verify ? '✅ Save केलं आणि "तपासलं" अशी खूण केली. Website वर नेण्यासाठी वरचं 🚀 Publish दाबा.' : '✅ Save केलं. Website वर नेण्यासाठी 🚀 Publish दाबा.';
    } catch (err) { msg.textContent = '⚠️ ' + (err?.message || 'Save झालं नाही'); }
  }

  async function _preview() {
    const box = $('site-preview-box'), msg = $('site-msg');
    try {
      const R = await import('../site-build/render.mjs');
      const e = { ..._collect(), samples: [] };
      e.slug = e.slug || 'preview';
      const cur = _data.exams.find(x => x.slug === e.slug);
      e.verified_on = cur?.verified_on || null;
      $('site-frame').srcdoc = R.examPage(e, { preview: true });
      box.hidden = false;
      msg.textContent = 'Preview खाली (Free test चा खरा प्रश्न Publish नंतर दिसतो)';
    } catch (err) { msg.textContent = '⚠️ Preview उघडलं नाही: ' + (err?.message || ''); }
  }

  async function _publish() {
    const b = $('site-publish'), msg = $('site-pub-msg');
    if (Date.now() - _pubArm > 6000) { _pubArm = Date.now(); b.textContent = '🚀 पक्कं? पुन्हा दाबा'; msg.textContent = 'तपासलेल्या आणि चालू असलेल्या सगळ्या परीक्षा website वर जातील.'; return; }
    _pubArm = 0; b.disabled = true; b.textContent = '⏳ Publish…';
    try {
      const r = await API.sitePublish();
      const dep = { started: '✅ Site 1–2 मिनिटांत बदलेल.', 'no-hook': '⚠️ VERCEL_DEPLOY_HOOK नाही — pages पुढच्या frontend push ला बदलतील.', 'bad-hook': '⚠️ VERCEL_DEPLOY_HOOK चुकीचा आहे (https://api.vercel.com/v1/integrations/deploy/… हवा).' }[r.deploy] || `⚠️ Vercel ला सांगता आलं नाही (${_esc(r.deploy)}) — थोड्या वेळाने पुन्हा Publish करा.`;
      msg.innerHTML = `Live: <b>${r.live}</b>${r.off ? ` · बंद केल्या: ${r.off}` : ''}. ${dep}${r.unchecked?.length ? `<br>⚠️ तपासल्या नाहीत म्हणून गेल्या नाहीत: ${r.unchecked.map(_esc).join(', ')}` : ''}`;
      await _load();
    } catch (err) { msg.textContent = '⚠️ ' + (err?.message || 'Publish झालं नाही'); }
    b.disabled = false; b.textContent = '🚀 Publish (website वर)';
  }

  async function _load() {
    $('site-list').innerHTML = '<p class="import-hint">⏳ उघडत आहे…</p>';
    try { _data = await API.siteExams(); _paintList(); _paintEditor(); }
    catch (err) { $('site-list').innerHTML = `<p class="import-hint">⚠️ ${_esc(err?.message || 'उघडलं नाही')}</p>`; }
  }

  function init() {
    const host = $('site-admin'); if (!host) return;
    if (!_ready) {
      _ready = true;
      host.innerHTML = `
        <h3 class="admin-section-title">🗺️ Site / Exams — nkseduorbit.in</h3>
        <p class="import-hint">प्रत्येक परीक्षेचं स्वतःचं page (Google साठी) + मुख्य page वर tabs. दर वर्षी फक्त तारखा बदला आणि Publish दाबा. तपासलेली (✅) माहितीच website वर जाते. Ads पण याच माहितीतून बनतात.</p>
        <p class="import-hint" id="site-status"></p>
        <div class="site-btns">
          <button type="button" class="admin-btn-secondary" id="site-seed" hidden></button>
          <button type="button" class="admin-btn-secondary" id="site-new">➕ नवीन परीक्षा</button>
          <button type="button" class="admin-btn-primary" id="site-publish">🚀 Publish (website वर)</button>
          <span id="site-pub-msg" class="import-hint" role="status"></span>
        </div>
        <div id="site-list"></div>
        <div id="site-editor" class="site-editor" hidden></div>`;
      host.addEventListener('input', ev => { if (ev.target.closest('#site-editor')) _seoHints(); });
      host.addEventListener('click', ev => {
        const t = ev.target;
        const op = t.closest('[data-open]');
        if (op) { _open = _open === op.dataset.open ? '' : op.dataset.open; _paintList(); _paintEditor(); if (_open) $('site-editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (t.closest('[data-del-row]')) { t.closest('.site-date, .site-faq')?.remove(); _seoHints(); return; }
        if (t.id === 'site-add-date') { $('site-dates').insertAdjacentHTML('beforeend', dateRow()); return; }
        if (t.id === 'site-add-faq') { $('site-faqs').insertAdjacentHTML('beforeend', faqRow()); _seoHints(); return; }
        if (t.closest('[data-save]')) { _save(t.closest('[data-save]').dataset.save === 'verify'); return; }
        if (t.id === 'site-preview') { _preview(); return; }
        if (t.id === 'site-ai-fill') { _aiFill(); _seoHints(); return; }
        if (t.id === 'site-ai-copy') {
          const p = _aiPrompt();
          const done = ok => {
            $('site-ai-copied').textContent = ok ? '✅ Copy झालं — आता AI मध्ये paste करा' : 'Copy झालं नाही — खालच्या box मधला prompt select करून copy करा';
            if (!ok) { $('site-ai-in').value = p; $('site-ai-in').select(); }
          };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p).then(() => done(true), () => done(false)); else done(false);
          return;
        }
        if (t.id === 'site-new') { _open = '+new'; _paintList(); _paintEditor(); return; }
        if (t.id === 'site-publish') { _publish(); return; }
        if (t.id === 'site-seed') {
          t.disabled = true;
          API.siteSeed().then(r => { $('site-pub-msg').textContent = `✅ ${r.added} परीक्षा भरल्या — प्रत्येक official site वर तपासा.`; return _load(); })
            .catch(err => { $('site-pub-msg').textContent = '⚠️ ' + (err?.message || ''); }).finally(() => { t.disabled = false; });
        }
      });
    }
    _load();
  }

  return { init };
})();

window.SITE_ADMIN = SITE_ADMIN;
