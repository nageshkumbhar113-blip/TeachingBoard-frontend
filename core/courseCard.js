/* ═══════════════════════════════════════════════════════════════
   core/courseCard.js — a course's card picture, drawn by the app itself
   (no image download): class, medium, board, the subjects there are now,
   and the course type (🏆 Competitive Exam / 📚 Regular class).
   An uploaded cover (Admin › 🖼️ Cover) still wins where there is one.
   Also: the type of a course, and the usual subjects for a new course.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // the course type: set in Admin, or guessed from the name (exam-prep names), else a regular class
  const EXAM_RX = /nmms|scholar|शिष्यवृत्ती|navodaya|नवोदय|olymp|ntse|\bmts\b|exam|परीक्षा|police|पोलीस|भरती|\btet\b|competitive|स्पर्धा/i;
  function kindOf(c) {
    if (c && (c.kind === 'exam' || c.kind === 'regular')) return c.kind;
    return EXAM_RX.test(`${c?.name || ''} ${c?.standard || ''}`) ? 'exam' : 'regular';
  }

  // a subject's picture
  const ICONS = [
    [/math|गणित|algebra|geometry|भूमिती|बीजगणित/i, '🧮'], [/physics|भौतिक/i, '⚡'], [/chem|रसायन/i, '🧪'], [/bio|जीव/i, '🌱'],
    [/science|विज्ञान/i, '🔬'], [/english|इंग्रजी/i, '📖'], [/hindi|हिंदी/i, '🪔'], [/marathi|मराठी/i, '🏵️'], [/sanskrit|संस्कृत/i, '📜'],
    [/history|इतिहास/i, '🏛️'], [/geograph|भूगोल/i, '🌍'], [/civics|political|नागरिक|राज्यशास्त्र/i, '⚖️'], [/परिसर|evs|environment/i, '🌳'],
    [/बुद्धिमत्ता|reasoning|mat\b|mental/i, '🧠'], [/paper|सराव|practice/i, '📝'], [/grammar|व्याकरण/i, '✍️'], [/computer|it\b/i, '💻'],
  ];
  function subjectIcon(name) {
    for (const [rx, ic] of ICONS) if (rx.test(String(name || ''))) return ic;
    return '📘';
  }

  // "10th", "8th", "NMMS": the big word on the card
  function bigWord(c) {
    const s = `${c?.standard || ''} ${c?.name || ''}`;
    const m = s.match(/\b(\d{1,2})\s*(st|nd|rd|th)\b/i) || s.match(/(\d{1,2})\s*वी/);
    if (m) return m[2] && /[a-z]/i.test(m[2]) ? `${m[1]}${m[2].toLowerCase()}` : `${m[1]}वी`;
    const w = String(c?.standard || c?.name || '').trim().split(/\s+/)[0] || '📚';
    return w.length > 8 ? w.slice(0, 8) : w;
  }

  // every course its own colours: one of 8 gradients, chosen by the course name (the same name → the same colours)
  const PALETTES = [['#ff7a18', '#f43f5e', '#be185d'], ['#38bdf8', '#2563eb', '#1e3a8a'], ['#34d399', '#059669', '#065f46'], ['#a78bfa', '#7c3aed', '#4c1d95'],
    ['#22d3ee', '#0891b2', '#155e75'], ['#f472b6', '#db2777', '#831843'], ['#94a3b8', '#475569', '#1e293b'], ['#818cf8', '#4f46e5', '#312e81']];
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
  function palette(c) {
    const set = Number(c?.card_color);
    const p = PALETTES[set >= 0 && set < PALETTES.length ? set : hash(String(c?.name || '').replace(/\s+/g, ' ').trim().toLowerCase()) % PALETTES.length];
    return `--c1:${p[0]};--c2:${p[1]};--c3:${p[2]}`;
  }

  // the moving line: what the course holds, from the real content counts (server: utils/courseFacts.js)
  function factLines(c, subjects) {
    const f = c?.facts || {}, kind = kindOf(c), L = [];
    const nSub = f.subjects || subjects.length;
    if (kind === 'exam' && f.free_tests) L.push(`📝 ${f.free_tests} free tests`);
    if (nSub) L.push(`📚 ${nSub} विषय${f.chapters ? ` · ${f.chapters} धडे` : ''}`);
    (f.top_notes || []).forEach(t => L.push(`📒 ${t.subject}: ${t.n} धड्यांच्या Notes`));
    (f.top_answers || []).forEach(t => L.push(`✍️ ${t.subject}: ${t.n} स्वाध्याय उत्तरं`));
    if (kind === 'regular' && f.free_chapters) L.push(`🎁 ${f.free_chapters} धडे free`);
    if (kind === 'exam') L.push('🏆 दर रविवारी महा-Test');
    if (f.notes || f.answers) L.push('✈️ Internet शिवाय पण चालतं');
    if (!L.length) L.push(nSub ? `📚 ${nSub} विषय` : '📚 विषय लवकरच येत आहेत');
    return L;
  }

  // the card: a 16:9 box drawn with HTML + CSS (sharp on every screen, offline, no download).
  // The course's full name stays still; the line under it changes every 2.5 s.
  function html(c, opts = {}) {
    const kind = kindOf(c);
    const subjects = (opts.subjects || c?.subjects || []).map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
    const meta = [c?.medium, c?.board && c.board.replace(/Maharashtra State Board/i, 'State Board')].filter(Boolean).join(' · ');
    const lines = factLines(c, subjects);
    // coloured letters: the class word in the name and every number in the moving line in a warm yellow
    const name = esc(String(c?.name || '').replace(/\s+/g, ' ').trim()).replace(/^(\d{1,2}\s*(st|nd|rd|th|वी)|nmms)/i, '<b class="cc-hl">$1</b>');
    const nums = t => esc(t).replace(/(\d+)/g, '<b class="cc-hl">$1</b>');
    // the whole card for one thing at a time: first the course's name, then what it holds, one line after another
    const slides = [`<span class="on cc-name">${name}</span>`, ...lines.map(t => `<span>${nums(t)}</span>`)];
    return `<div class="batch-cover cc" style="${palette(c)}" aria-hidden="true">
      <div class="cc-top"><span class="cc-meta">${esc(meta)}</span><span class="cc-type">${kind === 'exam' ? '🏆 Competitive' : '📚 Regular'}</span></div>
      <div class="cc-rail">${slides.join('')}</div>
      <div class="cc-bar"><i class="run"></i></div>
    </div>`;
  }

  // one timer for every card on the page: only cards on screen move; none when the phone asks for less motion
  let _timer = null;
  function _tick() {
    if (document.hidden) return;
    const vh = window.innerHeight || 800;
    document.querySelectorAll('.cc-rail').forEach(rail => {
      const items = rail.children;
      if (items.length < 2) return;
      const r = rail.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > vh) return;
      let cur = 0; for (let i = 0; i < items.length; i++) { items[i].classList.remove('out'); if (items[i].classList.contains('on')) cur = i; }
      items[cur].classList.replace('on', 'out');
      items[(cur + 1) % items.length].classList.add('on');
      const bar = rail.parentElement?.querySelector('.cc-bar i');
      if (bar) { bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
    });
  }
  function _start() {
    if (_timer || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    _timer = setInterval(_tick, 2500);
  }

  // the usual subjects of a new course (Admin › new course: one tap adds them; untick what is not needed)
  function suggestSubjects({ board = '', medium = '', standard = '', name = '' } = {}) {
    const all = `${standard} ${name}`;
    if (/nmms/i.test(all)) return ['बुद्धिमत्ता', 'गणित', 'विज्ञान', 'इतिहास', 'भूगोल', 'नागरिक शास्त्र', 'Practice Paper'];
    if (/scholar|शिष्यवृत्ती/i.test(all)) return ['मराठी', 'गणित', 'इंग्रजी', 'बुद्धिमत्ता'];
    if (board && !/maharashtra|state/i.test(board)) return [];
    const n = parseInt((all.match(/(\d{1,2})\s*(st|nd|rd|th|वी)/i) || [])[1], 10);
    if (!n) return [];
    const en = /^english/i.test(medium), semi = /semi/i.test(medium);
    if (n <= 4) return en ? ['English', 'Marathi', 'Mathematics', 'EVS'] : ['मराठी', 'English', 'गणित', ...(n >= 3 ? ['परिसर अभ्यास'] : [])];
    if (n === 5) return en ? ['English', 'Hindi', 'Marathi', 'Mathematics', 'EVS Part 1', 'EVS Part 2']
      : ['मराठी', 'हिंदी', 'English', semi ? 'Mathematics' : 'गणित', 'परिसर अभ्यास भाग 1', 'परिसर अभ्यास भाग 2'];
    if (n <= 8) return en ? ['English', 'Hindi', 'Marathi', 'Mathematics', 'General Science', 'History and Civics', 'Geography']
      : ['मराठी', 'हिंदी', 'English', semi ? 'Mathematics' : 'गणित', semi ? 'General Science' : 'सामान्य विज्ञान', 'इतिहास व नागरिकशास्त्र', 'भूगोल'];
    if (n <= 10) return en ? ['English', 'Hindi', 'Marathi', 'Mathematics Part 1', 'Mathematics Part 2', 'Science Part 1', 'Science Part 2', 'History and Political Science', 'Geography']
      : ['मराठी', 'हिंदी', 'English', ...(semi ? ['Mathematics Part 1', 'Mathematics Part 2', 'Science Part 1', 'Science Part 2'] : ['गणित भाग 1', 'गणित भाग 2', 'विज्ञान भाग 1', 'विज्ञान भाग 2']), 'इतिहास व राज्यशास्त्र', 'भूगोल'];
    return [];
  }

  // the card's look (once per page)
  const CSS = `
.cc { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; aspect-ratio: 16/9; width: 100%; max-width: 100%;
  border-radius: 10px; padding: 7% 8% 6%; box-sizing: border-box; color: #fff; overflow: hidden; isolation: isolate; container-type: inline-size; text-align: left;
  background: linear-gradient(135deg, var(--c1, #2563eb), var(--c2, #4f46e5) 60%, var(--c3, #7c3aed)); }
.cc::after { content: ''; position: absolute; width: 60%; aspect-ratio: 1; right: -18%; top: -32%; border-radius: 50%; background: rgba(255,255,255,.14); z-index: -1; }
.cc::before { content: ''; position: absolute; width: 45%; aspect-ratio: 1; left: -14%; bottom: -40%; border-radius: 50%; background: rgba(0,0,0,.10); z-index: -1; }
.cc-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.cc-meta { min-width: 0; font-size: 9px; font-size: clamp(8px, 5cqi, 14px); font-weight: 600; color: rgba(255,255,255,.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cc-type { flex: 0 0 auto; font-size: 8px; font-size: clamp(7px, 4.6cqi, 13px); font-weight: 800; background: rgba(255,255,255,.2); border-radius: 99px; padding: 0 6px; line-height: 1.6; }
/* the middle of the card: one slide at a time (the name, then each fact), up to 2 lines, nothing cut */
.cc-rail { flex: 1 1 auto; display: grid; align-items: center; overflow: hidden; font-size: 14px; font-size: clamp(11px, 9cqi, 28px); font-weight: 800; line-height: 1.2; text-shadow: 0 1px 6px rgba(0,0,0,.18); }
.cc-rail span { grid-area: 1 / 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere;
  transform: translateY(60%); opacity: 0; transition: transform .45s ease, opacity .45s ease; }
.cc-rail span.on { transform: none; opacity: 1; }
.cc-rail span.out { transform: translateY(-60%); opacity: 0; }
.cc-hl { color: #ffe45c; font-weight: 900; }
.cc-bar { height: 3px; border-radius: 3px; background: rgba(255,255,255,.25); overflow: hidden; }
.cc-bar i { display: block; height: 100%; width: 0; background: #fff; }
.cc-bar i.run { animation: cc-fill 2.5s linear forwards; }
@keyframes cc-fill { to { width: 100% } }
@media (prefers-reduced-motion: reduce) { .cc-rail span { transition: none; } .cc-bar i.run { animation: none; width: 100%; } }
`;
  function injectCss() {
    if (document.getElementById('cc-style')) return;
    const st = document.createElement('style'); st.id = 'cc-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { injectCss(); _start(); }); else { injectCss(); _start(); }

  // the uploaded cover only when Admin set this course to "picture" (the drawn card is the default)
  const useImage = c => !!(c?.cover_image && c?.card_mode === 'image');

  window.COURSE_CARD = { useImage, html, kindOf, subjectIcon, suggestSubjects, bigWord, palette, factLines, PALETTES };
})();
