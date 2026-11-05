// The public exam pages of nkseduorbit.in, as plain HTML strings.
// Used by site-build/build.mjs (on Vercel, from GET /api/site/exams) and by Admin › Site / Exams
// (👁 Preview, in the browser) — so the preview is exactly what Google will see.
// Everything important is real text in the HTML; the canvas animation (/site/promo.js) only decorates.

export const SITE = 'https://nkseduorbit.in';
const BRAND = 'NKs EduOrbit';
const WHATSAPP = '918390484545';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean);
const fmtDate = d => {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(t)) return '';
  return t.toLocaleDateString('mr-IN-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const isoDay = d => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toISOString().slice(0, 10) : ''; };
const nextDate = e => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (e.dates || []).filter(d => d.date && new Date(d.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
};
export const freeLink = e => e.batch
  ? `${SITE}/student-app/?free=1&batch=${encodeURIComponent(e.batch)}&src=web&ad=web-${encodeURIComponent(e.slug)}`
  : '';
const notifyLink = e => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`नमस्कार, ${e.name} चा course सुरू झाला की मला कळवा.`)}`;

const CSS = `
:root{--ink:#1d1640;--muted:#6b6490;--line:#e6e1f7;--bg:#f7f5ff;--card:#fff;--v:#6d3cf0;--p:#ff4d8d;--ok:#15803d;--warn:#b45309}
@media (prefers-color-scheme:dark){:root{--ink:#f1eeff;--muted:#b3acd6;--line:#332b5c;--bg:#120e24;--card:#1c1636}}
[hidden]{display:none!important}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Devanagari","Noto Sans",sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--v)}img{max-width:100%}
.wrap{max-width:960px;margin:0 auto;padding:0 16px}
header.top{background:linear-gradient(90deg,#2a0e6b,#6d3cf0 60%,#ff4d8d);color:#fff}
header.top .wrap{display:flex;align-items:center;gap:12px;min-height:60px;flex-wrap:wrap}
header.top a{color:#fff;text-decoration:none}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.1rem;margin-right:auto}
.brand img{width:34px;height:34px;border-radius:9px;background:#fff}
.nav a{font-weight:700;padding:6px 10px;border-radius:10px}
.nav a.app{background:#fff;color:#5b21d6}
.crumb{font-size:.85rem;color:var(--muted);margin:14px 0 4px}.crumb a{color:var(--muted)}
h1{font-size:1.7rem;line-height:1.3;margin:6px 0 10px}h2{font-size:1.25rem;margin:28px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:.9rem;font-weight:700}
.chip.gold{background:#fff3c4;border-color:#f5d36b;color:#5a3b00}
.hero{display:grid;gap:18px;grid-template-columns:1fr}
@media (min-width:760px){.hero{grid-template-columns:1.2fr .8fr;align-items:start}}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
.cta{display:flex;flex-direction:column;gap:10px}
.btn{display:inline-block;text-align:center;font-weight:800;text-decoration:none;border-radius:14px;padding:12px 18px;background:linear-gradient(90deg,#6d3cf0,#ff4d8d);color:#fff}
.btn.alt{background:var(--card);color:var(--v);border:2px solid var(--v)}
.days{font-size:1.05rem;font-weight:800;color:var(--p)}
canvas.promo{width:100%;max-width:420px;aspect-ratio:1;border-radius:18px;display:block;margin:0 auto;background:#2a0e6b}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden}
th,td{border-bottom:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}
th{background:rgba(109,60,240,.08);font-size:.9rem}
.tablebox{overflow-x:auto}
ul{padding-left:22px}li{margin:4px 0}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 14px;margin:8px 0}
summary{font-weight:700;cursor:pointer}
.note{font-size:.85rem;color:var(--muted)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.exam{display:flex;flex-direction:column;gap:6px}
.exam h3{margin:0;font-size:1.1rem}.exam h3 a{color:var(--ink);text-decoration:none}
.exam .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
.exam .row a{flex:1;padding:9px 10px;font-size:.92rem}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px}
.tab{border:2px solid var(--v);background:var(--card);color:var(--v);font:inherit;font-weight:800;border-radius:999px;padding:6px 14px;cursor:pointer}
.tab[aria-selected=true]{background:var(--v);color:#fff}
.big{background:linear-gradient(135deg,#2a0e6b,#5b21d6 60%,#ff4d8d);color:#fff;border-radius:22px;padding:22px 18px;margin:16px 0}
.big h1{margin-top:0}.big p{opacity:.95}
.feat{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
footer{margin:40px 0 0;padding:20px 0 30px;border-top:1px solid var(--line);font-size:.9rem;color:var(--muted)}
footer a{color:var(--muted);margin-right:12px}
`;

function shell({ title, description, canonical, body, jsonld = [], promo = false }) {
  return `<!doctype html>
<html lang="mr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/icons/icon-512.png">
<meta name="theme-color" content="#5b21d6">
<link rel="icon" href="/icons/icon-72.png">
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><img src="/icons/icon-72.png" alt="" width="34" height="34">${BRAND}</a>
  <nav class="nav"><a href="/exams">सर्व परीक्षा</a><a class="app" href="/student-app/">App उघडा</a></nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">
  <p>© ${new Date().getFullYear()} ${BRAND} · Kolhapur, Maharashtra · <a href="mailto:nkseducation60@gmail.com">nkseducation60@gmail.com</a></p>
  <p><a href="/exams">परीक्षा</a><a href="/get-app.html">App</a><a href="/contact-us.html">संपर्क</a><a href="/privacy-policy.html">Privacy</a><a href="/terms-and-conditions.html">Terms</a><a href="/refund-policy.html">Refund</a></p>
</div></footer>
${promo ? '<script src="/site/promo.js" defer></script>' : ''}
<script>document.querySelectorAll('[data-days-to]').forEach(function(el){var t=new Date(el.getAttribute('data-days-to')+'T00:00:00'),n=new Date();n.setHours(0,0,0,0);var d=Math.round((t-n)/864e5);el.textContent=d>0?'⏰ '+d+' दिवस बाकी':d===0?'⏰ आज':'';});</script>
</body>
</html>`;
}

// what the canvas animation gets (no secrets — only what the page already says)
function promoData(e) {
  const nd = nextDate(e);
  const mode = e.animation || 'auto';
  if (mode === 'none') return null;
  const sample = (e.samples || [])[0] || null;
  const d = {
    name: e.name, benefit: e.benefit || '', cls: e.class_label || '',
    date: nd ? isoDay(nd.date) : '', dateLabel: nd ? nd.label : '',
    q: mode === 'days' ? null : sample, cta: e.batch ? '▶ आधी Free Test द्या' : '🔔 लवकरच येत आहे',
  };
  if (mode === 'days' && !d.date) d.q = sample;   // no date yet → show the question instead
  if (mode === 'question' && !sample) d.q = null;
  return d;
}

function patternTable(e) {
  const rows = lines(e.pattern).map(l => l.split('|').map(c => c.trim()));
  if (!rows.length) return '';
  const head = ['भाग', 'प्रश्न', 'गुण', 'वेळ'];
  const used = head.map((_, i) => rows.some(r => r[i]));
  const th = head.filter((_, i) => used[i]).map(h => `<th>${h}</th>`).join('');
  const tr = rows.map(r => `<tr>${head.map((_, i) => used[i] ? `<td>${esc(r[i] || '')}</td>` : '').join('')}</tr>`).join('');
  return `<div class="tablebox"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

export function examPage(e, { preview = false } = {}) {
  const url = `${SITE}/exams/${e.slug}`;
  const nd = nextDate(e);
  const fl = freeLink(e);
  const pd = promoData(e);
  const title = `${e.name} — पात्रता, पेपर पद्धत, अभ्यासक्रम आणि तयारी | ${BRAND}`;
  const description = [e.purpose, e.benefit && `फायदा: ${e.benefit}.`, fl && 'आधी Free Test द्या.'].filter(Boolean).join(' ').slice(0, 160);
  const faq = (e.faq || []).filter(f => f.q && f.a);
  const dates = (e.dates || []).filter(d => d.label);
  const body = `
<p class="crumb"><a href="/">मुख्यपृष्ठ</a> › <a href="/exams">परीक्षा</a> › ${esc(e.name)}</p>
<div class="hero">
  <div>
    <h1>${esc(e.name)}: संपूर्ण माहिती आणि तयारी</h1>
    <div class="chips">${e.class_label ? `<span class="chip">🎓 ${esc(e.class_label)}</span>` : ''}${e.benefit ? `<span class="chip gold">🏆 ${esc(e.benefit)}</span>` : ''}</div>
    ${e.purpose ? `<p>${esc(e.purpose)}</p>` : ''}
    <div class="card cta">
      ${nd ? `<div><b>${esc(nd.label)}:</b> ${esc(fmtDate(nd.date))} <span class="days" data-days-to="${isoDay(nd.date)}"></span></div>` : ''}
      ${fl ? `<a class="btn" href="${esc(fl)}">▶ आधी Free Test द्या</a><span class="note">Login नाही · लगेच Result आणि क्रमांक · प्रत्येक उत्तराची युक्ती</span>`
           : `<b>हा course लवकरच येत आहे.</b><a class="btn alt" href="${esc(notifyLink(e))}" rel="noopener">🔔 सुरू झाला की WhatsApp वर कळवा</a>`}
    </div>
  </div>
  ${pd ? `<canvas class="promo" width="720" height="720" aria-hidden="true" data-promo="${esc(JSON.stringify(pd))}"></canvas>` : ''}
</div>

<h2>📅 महत्त्वाच्या तारखा</h2>
${dates.length ? `<div class="tablebox"><table><tbody>${dates.map(d => `<tr><th>${esc(d.label)}</th><td>${d.date ? esc(fmtDate(d.date)) : 'अजून जाहीर नाही'}${d.note ? ` <span class="note">(${esc(d.note)})</span>` : ''}</td></tr>`).join('')}</tbody></table></div>`
  : '<p>या वर्षीच्या तारखा अजून जाहीर झालेल्या नाहीत. जाहीर होताच इथे दिसतील.</p>'}

${lines(e.eligibility).length ? `<h2>✅ पात्रता</h2><ul>${lines(e.eligibility).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
${e.pattern ? `<h2>📝 पेपरची रचना</h2>${patternTable(e)}` : ''}
${lines(e.syllabus).length ? `<h2>📚 अभ्यासक्रम</h2><ul>${lines(e.syllabus).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}

${fl ? `<h2>📱 ${BRAND} App कशी मदत करते</h2>
<div class="feat">
  <div class="card">✅ <b>Free Tests</b><br>आधी मोफत test देऊन पाहा — login नाही.</div>
  <div class="card">💡 <b>प्रत्येक उत्तराची युक्ती</b><br>चुकलेला प्रश्न पुन्हा का चुकणार नाही ते समजतं.</div>
  <div class="card">🏆 <b>दर रविवारी महा-Test</b><br>पूर्ण पेपरसारखा test आणि तुमचा क्रमांक.</div>
  <div class="card">✈️ <b>Internet शिवाय पण</b><br>एकदा उघडलेलं offline पण चालतं.</div>
</div>
<p><a class="btn" href="${esc(fl)}">▶ ${esc(e.name)} चा Free Test द्या</a></p>` : ''}

${faq.length ? `<h2>❓ नेहमीचे प्रश्न</h2>${faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}` : ''}

<p class="note">${e.official_url ? `अधिकृत माहिती: <a href="${esc(e.official_url)}" rel="noopener nofollow" target="_blank">${esc(e.official_url.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a>. ` : ''}${e.verified_on ? `ही माहिती ${esc(fmtDate(e.verified_on))} रोजी तपासली. ` : ''}अंतिम निर्णयासाठी नेहमी अधिकृत अधिसूचना पाहा.</p>
${preview ? '<p class="note" style="color:#b91c3c;font-weight:700">PREVIEW — अजून publish झालेलं नाही.</p>' : ''}`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'मुख्यपृष्ठ', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'परीक्षा', item: `${SITE}/exams` },
      { '@type': 'ListItem', position: 3, name: e.name, item: url },
    ] },
  ];
  if (faq.length) jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return shell({ title, description, canonical: url, body, jsonld, promo: !!pd });
}

function examCard(e) {
  const nd = nextDate(e), fl = freeLink(e);
  return `<article class="card exam" data-group="${esc(e.group || 'school')}">
  <h3><a href="/exams/${esc(e.slug)}">${esc(e.name)}</a></h3>
  <div class="chips">${e.class_label ? `<span class="chip">🎓 ${esc(e.class_label)}</span>` : ''}${e.benefit ? `<span class="chip gold">🏆 ${esc(e.benefit)}</span>` : ''}</div>
  ${nd ? `<div class="note">${esc(nd.label)}: ${esc(fmtDate(nd.date))} <span class="days" data-days-to="${isoDay(nd.date)}"></span></div>` : ''}
  <div class="row"><a class="btn alt" href="/exams/${esc(e.slug)}">माहिती</a>${fl ? `<a class="btn" href="${esc(fl)}">▶ Free Test</a>` : '<span class="chip">🔔 लवकरच</span>'}</div>
</article>`;
}
const GROUPS = [['school', '🏫 शाळा स्तर (4थी–8वी)'], ['senior', '🎓 11वी–12वी']];

export function hubPage(exams) {
  const body = `
<p class="crumb"><a href="/">मुख्यपृष्ठ</a> › परीक्षा</p>
<h1>स्पर्धा परीक्षा: माहिती, पेपर पद्धत आणि Free Tests</h1>
<p>शिष्यवृत्ती, नवोदय, सैनिक स्कूल, NMMS पासून JEE, NEET, MHT-CET, CUET आणि NDA पर्यंत — प्रत्येक परीक्षेची पात्रता, पेपरची रचना, अभ्यासक्रम आणि तयारी.</p>
${GROUPS.map(([g, t]) => { const list = exams.filter(e => (e.group || 'school') === g); return list.length ? `<h2>${t}</h2><div class="grid">${list.map(examCard).join('')}</div>` : ''; }).join('')}`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: exams.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/exams/${e.slug}`, name: e.name })) }];
  return shell({ title: `स्पर्धा परीक्षा — NMMS, शिष्यवृत्ती, नवोदय, JEE, NEET | ${BRAND}`, description: 'शिष्यवृत्ती, NMMS, नवोदय, सैनिक स्कूल, JEE, NEET, MHT-CET, CUET, NDA — पात्रता, पेपर पद्धत, अभ्यासक्रम आणि Free Tests.', canonical: `${SITE}/exams`, body, jsonld });
}

// "/" — the one master page: tabs by level, each exam links to its own page
export function landingPage(exams) {
  const groups = GROUPS.filter(([g]) => exams.some(e => (e.group || 'school') === g));
  const body = `
<section class="big">
  <h1>4थी ते 12वी: स्पर्धा परीक्षांची तयारी, आधी मोफत Test</h1>
  <p>NMMS, शिष्यवृत्ती, नवोदय, सैनिक स्कूल, JEE, NEET आणि इतर परीक्षा — प्रश्न, प्रत्येक उत्तराची युक्ती, दर रविवारी महा-Test आणि क्रमांक. Notes आणि स्वाध्याय उत्तरं पण.</p>
  <p style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn" style="background:#fff;color:#5b21d6" href="/student-app/">▶ App उघडा</a><a class="btn alt" style="background:transparent;color:#fff;border-color:#fff" href="/get-app.html">📲 App डाउनलोड</a></p>
</section>
<h2>तुमची परीक्षा निवडा</h2>
<div class="tabs" role="tablist" aria-label="परीक्षा">
  <button class="tab" role="tab" type="button" data-g="all" aria-selected="true">सर्व</button>
  ${groups.map(([g, t]) => `<button class="tab" role="tab" type="button" data-g="${g}" aria-selected="false">${t}</button>`).join('')}
</div>
<div class="grid" id="exam-grid">${exams.map(examCard).join('')}</div>
<p><a href="/exams">सर्व परीक्षांची यादी →</a></p>
<h2>का ${BRAND}?</h2>
<div class="feat">
  <div class="card">✅ <b>आधी Free Test</b><br>Login नाही, फॉर्म नाही.</div>
  <div class="card">💡 <b>युक्तीसह उत्तरं</b><br>प्रत्येक प्रश्नाचं सोपं स्पष्टीकरण.</div>
  <div class="card">🏆 <b>महा-Test आणि क्रमांक</b><br>दर रविवारी पूर्ण पेपरसारखा.</div>
  <div class="card">📚 <b>Notes आणि स्वाध्याय</b><br>Guide ची गरज नाही.</div>
</div>
<script>(function(){
  try{ if (matchMedia('(display-mode: standalone)').matches) { location.replace('/student-app/'); return; } }catch(e){}
  var tabs=document.querySelectorAll('.tab'),cards=document.querySelectorAll('#exam-grid .exam');
  tabs.forEach(function(t){t.addEventListener('click',function(){
    tabs.forEach(function(x){x.setAttribute('aria-selected',String(x===t));});
    var g=t.getAttribute('data-g');cards.forEach(function(c){c.hidden=g!=='all'&&c.getAttribute('data-group')!==g;});
  });});
})();</script>`;
  const jsonld = [{ '@context': 'https://schema.org', '@type': 'Organization', name: BRAND, url: `${SITE}/`, logo: `${SITE}/icons/icon-512.png`, email: 'nkseducation60@gmail.com', address: { '@type': 'PostalAddress', addressLocality: 'Kolhapur', addressRegion: 'Maharashtra', addressCountry: 'IN' } }];
  return shell({ title: `${BRAND} — NMMS, शिष्यवृत्ती, नवोदय, JEE, NEET तयारी · Free Test`, description: '4थी ते 12वी: NMMS, शिष्यवृत्ती, नवोदय, सैनिक स्कूल, JEE, NEET, MHT-CET — प्रश्न, युक्ती, महा-Test आणि क्रमांक. आधी मोफत Test द्या.', canonical: `${SITE}/`, body, jsonld });
}

export function sitemap(exams) {
  const day = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);
  const newest = exams.reduce((t, e) => Math.max(t, new Date(e.verified_on || 0).getTime()), 0);
  const urls = [
    [`${SITE}/`, day(newest || null)], [`${SITE}/exams`, day(newest || null)],
    ...exams.map(e => [`${SITE}/exams/${e.slug}`, day(e.verified_on)]),
    [`${SITE}/get-app.html`, null], [`${SITE}/contact-us.html`, null],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, d]) => `  <url><loc>${esc(u)}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}

export function robots() {
  return `User-agent: *\nAllow: /\nDisallow: /admin-app/\nDisallow: /admin\nDisallow: /teacher-portal/\nDisallow: /dist-admin/\nDisallow: /dist-student/\nDisallow: /site-build/\n\nSitemap: ${SITE}/sitemap.xml\n`;
}
