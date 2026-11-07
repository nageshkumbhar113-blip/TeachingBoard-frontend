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

  // the card: a 16:9 box drawn with HTML + CSS (sharp on every screen, offline, no download)
  function html(c, opts = {}) {
    const kind = kindOf(c);
    const subjects = (opts.subjects || c?.subjects || []).map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
    const shown = subjects.slice(0, 4), more = subjects.length - shown.length;
    const tags = [c?.medium, c?.board && c.board.replace(/Maharashtra State Board/i, 'State Board')].filter(Boolean);
    const foot = opts.foot || (kind === 'exam' ? '🏆 Competitive Exam' : '📚 Notes · उत्तरं · सराव');
    return `<div class="batch-cover cc cc-${kind}" aria-hidden="true">
      <div class="cc-top"><span class="cc-big">${esc(bigWord(c))}</span>${tags.length ? `<span class="cc-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</span>` : ''}</div>
      <div class="cc-subs">${shown.length
        ? shown.map(s => `<span title="${esc(s)}">${subjectIcon(s)}</span>`).join('') + (more > 0 ? `<b>+${more}</b>` : '')
        : '<em>📚 विषय लवकरच येत आहेत</em>'}</div>
      <div class="cc-foot">${esc(foot)}</div>
    </div>`;
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
.cc { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; aspect-ratio: 16/9; width: 100%;
  border-radius: 10px; padding: 7% 7% 5%; box-sizing: border-box; color: #fff; overflow: hidden; container-type: inline-size; text-align: left; }
.cc-exam { background: radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,.18), transparent 55%), linear-gradient(135deg, #ff7a18 0%, #e8365d 55%, #7b2ff7 100%); }
.cc-regular { background: radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,.2), transparent 55%), linear-gradient(135deg, #0ea5e9 0%, #2563eb 55%, #10b981 130%); }
.cc::after { content: ''; position: absolute; right: -12%; bottom: -30%; width: 55%; aspect-ratio: 1; border-radius: 50%; background: rgba(255,255,255,.1); }
.cc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; position: relative; z-index: 1; }
.cc-big { font-weight: 900; line-height: 1; font-size: 20px; font-size: clamp(16px, 17cqi, 64px); letter-spacing: -.02em; text-shadow: 0 2px 8px rgba(0,0,0,.18); }
.cc-tags { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.cc-tags span { background: rgba(255,255,255,.22); border-radius: 99px; padding: 1px 7px; font-weight: 700; white-space: nowrap; font-size: 10px; font-size: clamp(8px, 5.2cqi, 16px); }
.cc-subs { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; position: relative; z-index: 1; font-size: 16px; font-size: clamp(12px, 9cqi, 34px); }
.cc-subs span { background: rgba(255,255,255,.2); border-radius: 8px; padding: 0 3px; line-height: 1.25; }
.cc-subs b { font-size: .6em; font-weight: 800; }
.cc-subs em { font-style: normal; font-weight: 700; font-size: .55em; opacity: .95; }
.cc-foot { position: relative; z-index: 1; font-weight: 800; font-size: 10px; font-size: clamp(8px, 5.6cqi, 18px); opacity: .95; }
@media (prefers-reduced-motion: no-preference) { .batch-card:hover .cc { filter: saturate(1.1); } }
`;
  function injectCss() {
    if (document.getElementById('cc-style')) return;
    const st = document.createElement('style'); st.id = 'cc-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCss); else injectCss();

  window.COURSE_CARD = { html, kindOf, subjectIcon, suggestSubjects, bigWord };
})();
