/* ════════════════════════════════════════
   paperPdf.js — Practice Paper → PDF (Question Paper / Answer Sheet)
   Global: PAPER_PDF
   Shared by admin-app/paperBuilder.js and student-app/teacherPaperBuilder.js
   (core/ is copied into both build variants).

   Why html2canvas + jsPDF instead of jsPDF text() alone: the question/
   answer content is Marathi (Devanagari). jsPDF's built-in fonts only
   cover Latin-1 — embedding a Devanagari-capable TTF as a base64 VFS font
   would work but adds a large (500KB+) blob to every build. Instead we
   render the paper as real HTML (the WebView's own font stack already
   renders Devanagari correctly everywhere else in this app), rasterize it
   with html2canvas, and slice the resulting image across A4 pages. The
   "Nks EduOrbit" watermark is plain ASCII, so it's drawn natively via
   jsPDF's own text()+rotation on top of each page — no image needed for
   that part, and it stays crisp at any zoom level.

   No native Android build changes needed: both libraries are pure JS,
   loaded via CDN <script> tag as the app already does for JSZip/QRCode
   (see admin-app/admin.js's _loadScript pattern).
════════════════════════════════════════ */

const PAPER_PDF = (() => {
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const H2C_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  // Same KaTeX build core/notesPdf.js / core/exercisePdf.js / core/quizPdf.js
  // use — question/answer text here is authored with the same $...$/$$...$$
  // LaTeX convention (SLSQuestion), but this file never rendered it (real
  // bug found live: Paper Builder PDFs showed literal "$...$" text).
  const KATEX_CSS  = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  const KATEX_JS   = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
  const KATEX_AUTORENDER = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js';
  const _loaders = new Map();

  function _loadScript(src, checkGlobal) {
    if (checkGlobal && checkGlobal()) return Promise.resolve();
    if (_loaders.has(src)) return _loaders.get(src);
    const p = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
    _loaders.set(src, p);
    return p;
  }

  async function _ensureLibs() {
    await _loadScript(JSPDF_CDN, () => window.jspdf?.jsPDF);
    await _loadScript(H2C_CDN, () => window.html2canvas);
    if (!window.jspdf?.jsPDF) throw new Error('jsPDF failed to load');
    if (!window.html2canvas) throw new Error('html2canvas failed to load');
  }

  function _loadStylesheet(href) {
    if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load ${href}`));
      document.head.appendChild(link);
    });
  }

  async function _ensureKatex() {
    await _loadStylesheet(KATEX_CSS);
    await _loadScript(KATEX_JS, () => window.katex);
    await _loadScript(KATEX_AUTORENDER, () => window.renderMathInElement);
  }

  function _renderMath(el) {
    if (!window.renderMathInElement) return;
    try {
      window.MATH?.normalizeBlanks?.(el);
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$',  right: '$$',  display: true  },
          { left: '\\[', right: '\\]', display: true  },
          { left: '$',   right: '$',   display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        output: 'html',
      });
    } catch (e) { console.warn('KaTeX render error:', e.message); }
  }

  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  // Same markdown-lite + table convention as notesPdf.js/exercisePdf.js —
  // escape first, then turn **bold** into <strong> and GitHub-style pipe
  // tables (a header row + a |---|---| separator row) into a real <table>.
  // Real bug found live: this file never had this at all, so a question
  // authored as a pipe-table (e.g. a "match the columns" question) printed
  // as literal "| col | col |" text instead of an actual table.
  // "[[ ]]" (or [[s]] small / [[l]] large) marks an empty box a student fills in, as in
  // board "complete the activity" questions. It becomes a KaTeX \boxed{\phantom{..}} so it
  // works standalone AND inside fractions/exponents (e.g. 5 x [[ ]]^2, P(A) = n(A)/[[ ]]).
  const _BLANK_RE = /\[\[\s*([sl]?)\s*\]\]/g;
  const _blankBox = size => `\\boxed{\\phantom{${size === 's' ? '00' : size === 'l' ? '00000000' : '0000'}}}`;

  const _UNDERSCORE_BLANK_RE = /\\text\{\s*_{2,}\s*\}|(?:\\_){2,}/g;

  function _expandBlanks(text) {
    const s = String(text ?? '');
    if (!s.includes('[[') && !s.includes('_')) return s;
    const outside = t => t.replace(_BLANK_RE, (_m, size) => `$${_blankBox(size)}$`);
    const mathRe = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g;
    const out = [];
    let last = 0;
    let m;
    while ((m = mathRe.exec(s))) {
      out.push(outside(s.slice(last, m.index)));
      out.push(m[0].replace(_UNDERSCORE_BLANK_RE, _blankBox()).replace(_BLANK_RE, (_x, size) => _blankBox(size)));
      last = m.index + m[0].length;
    }
    out.push(outside(s.slice(last)));
    return out.join('');
  }

  // ── PDF-safe math ─────────────────────────────────────────────────────────────
  // html2canvas cannot draw KaTeX's stretchy delimiters (the bars of a determinant come out as
  // tiny marks at the bottom), so a vmatrix / |matrix| is written as an array with drawn column rules.
  function _pdfSafeMath(s) {
    const asArray = (_m, body) => {
      const first = String(body).split('\\\\')[0];
      const cols = (first.match(/&/g) || []).length + 1;
      return '\\begin{array}{|' + 'c'.repeat(cols) + '|}' + body + '\\end{array}';
    };
    return String(s)
      .replace(/\\begin\{[vV]matrix\}([\s\S]*?)\\end\{[vV]matrix\}/g, asArray)
      .replace(/\\left\|\s*\\begin\{matrix\}([\s\S]*?)\\end\{matrix\}\s*\\right\|/g, asArray);
  }

  // ── Board paper question text clean-up ────────────────────────────────────────
  // Bank questions carry helper text that does not belong on an exam paper: the repeated
  // instruction ("Choose the correct alternative: (i)"), the board-year tag "(JULY 2024)" and a
  // "Given: ..." hint. Activity bodies and tables that follow "Given:" are real content and stay.
  const _BOARD_PREFIX_RE = /^\s*(?:Choose the correct alternative|Solve the following (?:sub-?questions?)|Complete the following activity(?: and rewrite it)?)\s*:\s*\(\s*(?:[ivx]+|[a-e])\s*\)\s*/i;
  const _BOARD_YEAR_RE = /\s*\(\s*(?:(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+)?\d{4}\s*\)\s*$/i;
  const _MCQ_RE = /^([\s\S]*?)\s*\(\s*[Aa]\s*\)\s*([\s\S]*?)\s*\(\s*[Bb]\s*\)\s*([\s\S]*?)\s*\(\s*[Cc]\s*\)\s*([\s\S]*?)\s*\(\s*[Dd]\s*\)\s*([\s\S]*)$/;

  function _boardParts(raw) {
    const s = String(raw ?? '').replace(/\r/g, '');
    let main = s;
    let given = '';
    const gm = s.match(/\n\s*Given:\s*/);
    if (gm) { main = s.slice(0, gm.index); given = s.slice(gm.index + gm[0].length).trim(); }
    main = main.replace(_BOARD_PREFIX_RE, '').replace(_BOARD_YEAR_RE, '').trim();

    let extra = '';
    if (/^Activity\b[^\n]*:/i.test(given)) extra = given.replace(/^Activity\b[^\n]*:\s*/i, '');
    else if (given.includes('|---') || given.includes('| ---')) extra = given;

    let options = null;
    const mm = main.match(_MCQ_RE);
    if (mm && mm[1].trim() && [2, 3, 4, 5].every(i => mm[i].trim() && mm[i].length < 220)) {
      main = mm[1].trim();
      options = [mm[2], mm[3], mm[4], mm[5]].map(x => x.trim());
    }
    extra = extra.split('\n').filter(l => !/^\s*Activity\b[^\n]*:\s*$/i.test(l)).join('\n');
    return { stem: main.replace(/\n{2,}/g, '\n'), extra: extra.replace(/\n{2,}/g, '\n').trim(), options };
  }

  // Splits text into blocks that may be moved to the next page as a whole: each line, with a
  // pipe table kept as one block.
  function _blocks(text) {
    const lines = String(text || '').split('\n').filter(l => l.trim() !== '');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\|.*\|\s*$/.test(lines[i])) {
        const tbl = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) tbl.push(lines[i++]);
        i--;
        out.push(tbl.join('\n'));
      } else {
        out.push(lines[i]);
      }
    }
    return out;
  }

  function _richText(raw) {
    const bolded = _esc(_pdfSafeMath(_expandBlanks(raw))).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = bolded.split('\n');
    const out = [];
    let textBuf = [];
    const flushText = () => { if (textBuf.length) { out.push(textBuf.join('<br>')); textBuf = []; } };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const isRow = /^\s*\|.*\|\s*$/.test(line);
      const sepLine = lines[i + 1] || '';
      const isSep = isRow && /^\s*\|?[\s:|-]+\|?\s*$/.test(sepLine) && sepLine.includes('-');
      if (isRow && isSep) {
        flushText();
        const block = [line, sepLine];
        let j = i + 2;
        while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { block.push(lines[j]); j++; }
        out.push(_mdTableToHtml(block));
        i = j;
      } else {
        textBuf.push(line);
        i++;
      }
    }
    flushText();
    return out.join('');
  }

  function _mdTableToHtml(lines) {
    const parseRow = row => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const header = parseRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseRow);
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:0.95em">';
    html += '<thead><tr>' + header.map(h => `<th style="border:1px solid #ccc;padding:6px 8px;background:rgba(30,58,138,0.08);text-align:left">${h}</th>`).join('') + '</tr></thead>';
    html += '<tbody>' + bodyRows.map(row => '<tr>' + row.map(cell => `<td style="border:1px solid #ddd;padding:6px 8px">${cell}</td>`).join('') + '</tr>').join('') + '</tbody>';
    html += '</table>';
    return html;
  }

  // Diagrams (questionDiagrams[]/answerDiagrams[]) carry absolute,
  // backend-hosted URLs (Cloudinary-style) — same shape/convention as
  // exercisePdf.js. Real bug found live: this file never rendered these at
  // all, so a question with an attached diagram silently dropped it.
  function _diagramsHtml(diagrams, borderColor) {
    return (diagrams || []).map(d => `
      <div style="margin-top:6px">
        <img src="${_esc(d.url)}" crossorigin="anonymous" style="max-width:100%;max-height:260px;display:block;border:1px solid ${borderColor};border-radius:4px"/>
        ${d.caption ? `<div style="font-size:11px;color:#666;margin-top:2px">${_esc(d.caption)}</div>` : ''}
      </div>`).join('');
  }

  // User-requested: the surrounding chrome text (Date/Total Marks/Section
  // headers/Answer labels) was always Marathi regardless of the batch's
  // medium — an English/Semi-English medium batch needs English chrome.
  // The actual question/answer TEXT is untouched by this — that's already
  // separately bilingual per question (questionText.marathi/english).
  const _CHROME_TEXT = {
    marathi: {
      dateLabel: 'दिनांक', totalMarksLabel: 'एकूण गुण',
      sectionLabel: (m) => `विभाग — ${m} गुणांचे प्रश्न (प्रत्येकी ${m} गुण)`,
      marksTag: (m) => `[${m} गुण]`,
      answerLabel: 'उत्तर', answerSheetLabel: '— उत्तरपत्रिका (Answer Sheet) —',
    },
    english: {
      dateLabel: 'Date', totalMarksLabel: 'Total Marks',
      sectionLabel: (m) => `Section — ${m} Marks Questions (${m} marks each)`,
      marksTag: (m) => `[${m} Marks]`,
      answerLabel: 'Answer', answerSheetLabel: '— Answer Sheet —',
    },
  };
  function _chromeText(language) {
    return _CHROME_TEXT[language] || _CHROME_TEXT.marathi;
  }

  const _NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const _ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];

  function _isBoard(paper) {
    return paper?.layout === 'board' && Array.isArray(paper.sections) && paper.sections.length > 0;
  }

  // Paper total for a board paper = sum of (attempt x marks each) per section.
  function boardTotalMarks(sections) {
    return (sections || []).reduce((s, x) => s + (Number(x.attempt) || 0) * (Number(x.marksEach) || 0), 0);
  }

  // Board-style paper: header block, notes, then sections "1. (A) instruction ..... marks"
  // with (i), (ii)... sub-questions. Shared by Question Paper and Answer Sheet.
  // ── Passage sections (models/PassageBlock.js) ────────────────────────────────
  // A passage section prints its snapshot once (comprehension/poetry/nonverbal passage, or a
  // writing prompt's scenario) followed by its sub-questions, in the same "(i) ... (ii) ..."
  // numbered layout as a normal board section — [[ ]] already renders as a KaTeX answer box via
  // _richText/_expandBlanks, so fill-in-the-blank sub-questions need no separate handling.
  function _subQuestionBodyHtml(sq, withAnswers, t) {
    const items = Array.isArray(sq.items) ? sq.items : [];
    if (sq.format === 'web_diagram' || sq.format === 'tree_diagram') {
      const centerHtml = sq.center ? `<div class="pp-atom" style="font-weight:700;margin-bottom:4px">${_richText(sq.center)}</div>` : '';
      const rows = items.map((it, i) => `
        <div class="pp-atom" style="display:flex;gap:8px;margin:3px 0;font-size:14px">
          <span style="min-width:120px">${_richText(it.given || `(${_ROMAN[i] || i + 1})`)}</span>
          <span>&rarr;</span>
          <span>${withAnswers ? `<b>${_richText(it.answer)}</b>` : _richText('[[ ]]')}</span>
        </div>`).join('');
      return centerHtml + rows;
    }
    return items.map((it, i) => `
      <div class="pp-atom" style="display:flex;margin:6px 0;font-size:14px;line-height:1.6">
        <span style="width:30px;font-style:italic;flex-shrink:0">(${_ROMAN[i] || i + 1})</span>
        <div style="flex:1">${_richText(it.text)}
          ${withAnswers ? `<div class="pp-atom" style="margin-top:4px;padding:6px 9px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#166534"><b>${t.answerLabel}:</b> ${_richText(it.answer)}</div>` : ''}
        </div>
      </div>`).join('');
  }

  function _passageSectionHtml(sec, withAnswers, t) {
    const b = sec.passageSnapshot;
    if (!b) return ''; // block was deleted after the paper was already saved elsewhere — skip quietly
    const marks = (Number(sec.attempt) || 0) * (Number(sec.marksEach) || 0);
    const head = `
      <div class="pp-atom" data-pp-keep="1" style="display:flex;justify-content:space-between;align-items:flex-start;font-size:14.5px;font-weight:700;margin-top:16px">
        <span style="display:flex;flex:1"><span style="width:30px">${_esc(sec.qNo)}.</span><span style="width:40px">${sec.part ? `(${_esc(sec.part)})` : ''}</span><span style="flex:1">${_richText(sec.instruction || '')}</span></span>
        <span style="margin-left:14px">${marks}</span>
      </div>`;

    if (b.type === 'writing') {
      const points = (b.points || []).map(p => `<div class="pp-atom" style="margin:3px 0 3px 30px;font-size:14px">* ${_richText(p)}</div>`).join('');
      const rubric = withAnswers && (b.rubric || []).length
        ? `<div class="pp-atom" style="margin-top:6px;padding:7px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-family:Arial,sans-serif;font-size:12px;color:#166534"><b>Marking scheme:</b> ${b.rubric.map(_esc).join(' | ')}</div>` : '';
      const model = withAnswers && b.modelAnswer
        ? `<div class="pp-atom" style="margin-top:6px;padding:8px 12px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:13px;line-height:1.6;color:#166534"><b style="font-family:Arial,sans-serif">${_esc(t.answerLabel || 'Answer')} (model):</b><br>${_richText(b.modelAnswer)}</div>` : '';
      const source = b.passage && b.format === 'news_report' && window.DIAGRAM_SKELETON ? window.DIAGRAM_SKELETON.cloud(_richText(b.passage)) : b.passage ? `<div class="pp-atom" style="margin:8px 0;padding:10px 14px;border:1.5px solid #333;border-radius:6px;font-size:13.5px;line-height:1.75;background:#fff">${_richText(b.passage)}</div>` : '';
      const sourceImg = b.passageImage ? `<div class="pp-atom">${_diagramsHtml([{ url: b.passageImage }], '#ddd')}</div>` : '';
      return head + `
        <div class="pp-atom" style="margin:6px 0;font-size:14px;line-height:1.7">${_richText(b.scenario)}${b.wordLimit ? ` <i>(${_esc(b.wordLimit)} words)</i>` : ''}</div>
        ${source}${sourceImg}${b.diagram && window.DIAGRAM_SKELETON ? window.DIAGRAM_SKELETON.html(b.diagram) : ''}${points}${rubric}${model}`;
    }

    const passageHtml = b.passage ? `
      <div class="pp-atom" style="margin:8px 0;padding:10px 14px;border:1px solid #999;border-radius:4px;font-size:13.5px;line-height:1.75;background:#fafafa">${_richText(b.passage)}</div>` : '';
    const passageImg = b.passageImage ? `<div class="pp-atom">${_diagramsHtml([{ url: b.passageImage }], '#ddd')}</div>` : '';
    const subs = (b.subQuestions || []).map((sq, i) => `
      <div class="pp-atom" data-pp-keep="1" style="margin:10px 0 4px 30px;font-size:14px;font-weight:700">${sq.prompt ? _richText(sq.prompt) : `Question ${i + 1}`} <span style="font-weight:400">(${sq.marks})</span></div>
      <div style="margin-left:60px">${_subQuestionBodyHtml(sq, withAnswers, t)}</div>`).join('');
    return head + passageHtml + passageImg + subs;
  }

  function _buildBoardHtml(paper, withAnswers, institutionName, language) {
    const t = _chromeText(language);
    const h = paper.header || {};
    const total = boardTotalMarks(paper.sections);
    const brandName = String(institutionName || '').trim();
    const code = _esc(h.paperCode || '');

    const byId = new Map();
    for (const s of paper.sections) byId.set(s.id, []);
    const stray = [];
    const ordered = [...(paper.questions || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    for (const q of ordered) {
      if (byId.has(q.sectionId)) byId.get(q.sectionId).push(q); else stray.push(q);
    }

    const seatBoxes = `<span style="display:inline-flex;border:2px solid #111;vertical-align:middle">${
      Array.from({ length: 6 }, (_, i) => `<span style="width:24px;height:26px;${i < 5 ? 'border-right:2px solid #111;' : ''}"></span>`).join('')}</span>`;

    const notes = (h.notes || []).filter(Boolean);
    const notesHtml = notes.length ? `
      <div class="pp-atom" style="font-size:14px;margin:6px 0 4px"><b><i>Note :</i></b></div>
      ${notes.map((n, i) => `<div class="pp-atom" style="display:flex;font-size:14px;margin:2px 0 2px 26px"><span style="width:34px;font-style:italic">(${_ROMAN[i] || i + 1})</span><span style="flex:1">${_richText(n)}</span></div>`).join('')}` : '';

    const sectionsHtml = paper.sections.map(sec => {
      if (sec.passageBlockId) return _passageSectionHtml(sec, withAnswers, t);
      const qs = byId.get(sec.id) || [];
      if (!qs.length) return '';
      const marks = (Number(sec.attempt) || 0) * (Number(sec.marksEach) || 0);
      let instruction = String(sec.instruction || '').trim();
      if (sec.attempt < qs.length && !/\bany\b|\battempt\b/i.test(instruction)) {
        instruction += ` (any ${_NUM_WORDS[sec.attempt] || sec.attempt})`;
      }
      const head = `
        <div class="pp-atom" data-pp-keep="1" style="display:flex;justify-content:space-between;align-items:flex-start;font-size:14.5px;font-weight:700;margin-top:16px">
          <span style="display:flex;flex:1"><span style="width:30px">${_esc(sec.qNo)}.</span><span style="width:40px">${sec.part ? `(${_esc(sec.part)})` : ''}</span><span style="flex:1">${_richText(instruction)}</span></span>
          <span style="margin-left:14px">${marks}</span>
        </div>`;
      const items = qs.map((q, idx) => {
        const qText = q.questionText?.marathi || q.questionText?.english || '';
        const aText = q.answerText?.marathi || q.answerText?.english || '';
        const { stem, extra, options } = _boardParts(qText);
        const blocks = _blocks(extra ? `${stem}\n${extra}` : stem)
          .map((b, bi) => `<div class="pp-atom"${bi === 0 ? ' data-pp-keep="1"' : ''} style="margin:${bi === 0 ? 0 : 4}px 0">${_richText(b)}</div>`).join('');
        const plainLen = o => String(o).replace(/\$[^$]*\$/g, 'xxxx').length;
        const cols = options && options.every(o => plainLen(o) <= 16) ? 4 : 2;
        const optsHtml = options ? `
          <div class="pp-atom" style="display:grid;grid-template-columns:repeat(${cols},auto);justify-content:start;gap:4px 34px;margin:6px 0 2px">
            ${options.map((o, k) => `<div style="display:flex;gap:6px"><span>(${'ABCD'[k]})</span><span>${_richText(o)}</span></div>`).join('')}
          </div>` : '';
        const diag = _diagramsHtml(q.questionDiagrams, '#ddd');
        return `
          <div class="pp-item" style="display:flex;margin:9px 0 9px 70px;font-size:14px;line-height:1.7">
            <span style="width:34px;font-style:italic;flex-shrink:0">(${_ROMAN[idx] || idx + 1})</span>
            <div style="flex:1">${blocks}${optsHtml}${diag ? `<div class="pp-atom">${diag}</div>` : ''}
              ${withAnswers ? `<div class="pp-atom" style="margin-top:5px;padding:7px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.5;color:#166534"><b>${t.answerLabel}:</b> ${_richText(String(aText).replace(/\n{2,}/g, '\n'))}${_diagramsHtml(q.answerDiagrams, '#cde9d3')}</div>` : ''}
            </div>
          </div>`;
      }).join('');
      return head + items;
    }).join('');

    const strayHtml = stray.length ? `
      <div class="pp-atom" style="font-weight:700;margin-top:16px;font-size:14px">Other questions</div>
      ${stray.map((q, i) => `<div class="pp-atom" style="margin:8px 0 8px 70px;font-size:14px">(${_ROMAN[i] || i + 1}) ${_richText(q.questionText?.marathi || q.questionText?.english || '')}</div>`).join('')}` : '';

    return `
      <div style="font-family:'Times New Roman',Times,'Noto Serif Devanagari','Mangal',serif;width:754px;padding:10px 36px 30px;color:#111;background:#fff">
        <style>.katex-display{margin:10px 0 !important}</style>
        ${h.mock ? `<div class="pp-atom" style="text-align:center;font-size:11px;font-style:italic;font-family:Arial,sans-serif;color:#555">Practice / Mock Paper - not an official board paper${brandName ? ' - ' + _esc(brandName) : ''}</div>` : ''}
        ${code ? `<div class="pp-atom" style="text-align:center;font-size:46px;font-weight:800;letter-spacing:2px;line-height:1.1;margin-top:18px">${code}</div>` : ''}
        <div class="pp-atom" style="text-align:right;font-size:14px;font-weight:700;margin:2px 0 14px">Seat Number ${seatBoxes}</div>
        ${(h.examLine || h.subjectLine) ? `<div class="pp-atom" style="display:flex;justify-content:space-between;font-size:13px;font-weight:700"><span>${_esc(h.examLine || '')}</span><span>${_esc(h.subjectLine || '')}</span></div>` : ''}
        ${h.courseLine ? `<div class="pp-atom" style="text-align:center;font-size:13px;font-weight:700;margin-top:6px">${_esc(h.courseLine)}</div>` : ''}
        <div class="pp-atom" style="display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:700;border-bottom:2px solid #111;padding:8px 0 8px;margin:8px 0 12px">
          <span>${_esc(h.timeText || '')}</span><span data-pp-pages style="display:inline-block;min-width:90px;height:16px"></span><span>Max. Marks : ${total}</span>
        </div>
        ${withAnswers ? `<div class="pp-atom" style="font-size:12px;color:#16a34a;font-weight:700;font-family:Arial,sans-serif;margin-bottom:6px">${t.answerSheetLabel}</div>` : ''}
        ${notesHtml}
        ${sectionsHtml}
        ${strayHtml}
      </div>`;
  }

  function _buildHtml(paper, withAnswers, institutionName, language) {
    if (_isBoard(paper)) return _buildBoardHtml(paper, withAnswers, institutionName, language);
    const t = _chromeText(language);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    // User-requested: a teacher downloading their own paper can put their
    // institute's name here instead of the app's own branding. Optional —
    // defaults to the original "Nks EduOrbit" when left blank, so nothing
    // changes for anyone who doesn't fill it in.
    const brandName = String(institutionName || '').trim() || 'Nks EduOrbit';
    // Multi-subject papers (Paper Builder's multi-select) carry the full
    // set in subjectIds — join them; an ordinary single-subject paper has
    // subjectIds empty, so this falls back to subjectId unchanged.
    const subjectLabel = Array.isArray(paper.subjectIds) && paper.subjectIds.length
      ? paper.subjectIds.join(', ')
      : (paper.subjectId || '');
    const byMarks = new Map();
    for (const q of paper.questions || []) {
      const m = q.marks;
      if (!byMarks.has(m)) byMarks.set(m, []);
      byMarks.get(m).push(q);
    }
    const sortedMarks = Array.from(byMarks.keys()).sort((a, b) => a - b);

    let qNum = 0;
    const sections = sortedMarks.map(marks => {
      const qs = byMarks.get(marks);
      const items = qs.map(q => {
        qNum++;
        const qText = q.questionText?.marathi || q.questionText?.english || '';
        const aText = q.answerText?.marathi || q.answerText?.english || '';
        const qDiagramsHtml = _diagramsHtml(q.questionDiagrams, '#ddd');
        const aDiagramsHtml = _diagramsHtml(q.answerDiagrams, '#cde9d3');
        return `
          <div class="pp-atom" style="margin-bottom:14px;page-break-inside:avoid">
            <div style="font-size:14px;line-height:1.5"><b>${qNum}.</b> ${_richText(qText)} <span style="color:#e16b13;font-weight:600;font-size:12px">${t.marksTag(marks)}</span></div>
            ${qDiagramsHtml}
            ${withAnswers ? `<div style="margin-top:4px;padding:8px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:13px;color:#166534"><b>${t.answerLabel}:</b> ${_richText(aText)}${aDiagramsHtml}</div>` : ''}
          </div>`;
      }).join('');
      return `
        <div style="margin-bottom:18px">
          <div style="font-weight:700;font-size:13px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-bottom:10px">
            ${t.sectionLabel(marks)}
          </div>
          ${items}
        </div>`;
    }).join('');

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666;text-transform:uppercase">${_esc(brandName)}</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${_esc(paper.paperTitle || 'Practice Paper')}</div>
          <div style="font-size:13px;color:#333">${_esc(subjectLabel)} • ${_esc(paper.batchId || '')}</div>
          ${withAnswers ? `<div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:4px">${t.answerSheetLabel}</div>` : ''}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>${t.dateLabel}: ${dateStr}</span>
          <span>${t.totalMarksLabel}: <b>${paper.totalMarks || 0}</b></span>
          <span>Paper #${paper.paperNumber || ''}</span>
        </div>
        ${sections}
        <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px solid #ddd;padding-top:8px">
          Generated by Nks EduOrbit
        </div>
      </div>`;
  }

  function _drawWatermark(pdf, pageWidth, pageHeight, institutionName) {
    pdf.saveGraphicsState?.();
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(48);
    const text = String(institutionName || '').trim() || 'Nks EduOrbit';
    // jsPDF text() rotation angle is in degrees, counter-clockwise
    try {
      pdf.text(text, pageWidth / 2, pageHeight / 2, { angle: 35, align: 'center' });
    } catch (e) {
      // Fallback for older jsPDF builds without the options-object signature
      pdf.text(text, pageWidth / 2 - 40, pageHeight / 2, 35);
    }
    pdf.restoreGraphicsState?.();
    pdf.setTextColor(0, 0, 0);
  }

  // Running header/footer of a board paper, drawn as real PDF text on top of each page:
  // page 1 gets "(Pages N)"; later pages get "n/CODE" and (optionally) the seat-number
  // box at the top; every page but the last gets "P.T.O." at the bottom right.
  function _drawBoardPageChrome(pdf, o) {
    const { pageNo, totalPages, codeText, header, pageWidth, pageHeight, topMm, MARGIN_MM, pagesSpot, cssPerMm, institutionName } = o;
    pdf.setTextColor(0, 0, 0);
    if (pageNo === 1) {
      if (pagesSpot) {
        pdf.setFont('times', 'bold');
        pdf.setFontSize(11);
        pdf.text(`(Pages ${totalPages})`, MARGIN_MM + (pagesSpot.left + pagesSpot.width / 2) / cssPerMm, topMm + (pagesSpot.top + pagesSpot.height - 3) / cssPerMm, { align: 'center' });
      }
    } else {
      pdf.setFont('times', 'bold');
      pdf.setFontSize(15);
      pdf.text(codeText ? `${pageNo}/${codeText}` : String(pageNo), pageWidth / 2, 14, { align: 'center' });
      if (header.seatOnEveryPage !== false) {
        const boxW = 6.2, boxH = 6.8, n = 6;
        const right = pageWidth - MARGIN_MM;
        const left = right - boxW * n;
        pdf.setFontSize(11);
        pdf.text('Seat Number', left - 2, 20.5, { align: 'right' });
        pdf.setLineWidth(0.5);
        pdf.rect(left, 14.5, boxW * n, boxH);
        for (let i = 1; i < n; i++) pdf.line(left + boxW * i, 14.5, left + boxW * i, 14.5 + boxH);
      }
    }
    // Small credit on every page, bottom-left (P.T.O. sits bottom-right).
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Generated by Nks EduOrbit', MARGIN_MM, pageHeight - 8);
    if (String(institutionName || '').trim()) pdf.text(String(institutionName).trim(), pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    if (pageNo < totalPages) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      pdf.text('P.T.O.', pageWidth - MARGIN_MM, pageHeight - 8, { align: 'right' });
    }
    pdf.setFont('helvetica', 'normal');
  }

  async function _renderToBlob(paper, withAnswers, institutionName, language) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = _buildHtml(paper, withAnswers, institutionName, language);
    document.body.appendChild(container);

    let canvas;
    let atoms = [];
    let rootCssWidth = 754;
    let rootCssHeight = 0;
    let pagesSpot = null;
    try {
      // KaTeX must finish rendering ($...$ math -> real DOM markup) before
      // the snapshot — html2canvas only ever captures what's already in
      // the DOM at capture time.
      try { await _ensureKatex(); _renderMath(container); } catch (e) { console.warn('KaTeX unavailable, math will show as raw text:', e.message); }
      // A second, subtler bug even when KaTeX DOES run: html2canvas can
      // still snapshot before KaTeX's own @font-face web fonts have
      // actually finished loading/painting, which badly mis-measures
      // fractions/exponents — numerator and denominator collapse onto one
      // line, looking "struck through" (real bug, found live in Notes/
      // Exercise/Test Book PDFs). Force a reflow so the browser actually
      // starts loading whatever fonts the just-rendered markup needs, then
      // wait for them.
      void container.offsetHeight;
      try { await document.fonts.ready; } catch (e) { /* older WebView without Font Loading API — best effort */ }
      // Real bug found live (core/exercisePdf.js — this file's diagrams were
      // ported from there): question/answer diagram <img>s (Cloudinary-
      // hosted, real network latency) can still be mid-download when
      // html2canvas snapshots the container — the font-ready wait above
      // only covers KaTeX's web fonts, never <img> loads. Wait for every
      // image to finish (load OR error, so one bad URL can't hang the
      // whole export) before capturing.
      await Promise.all(Array.from(container.querySelectorAll('img')).map(img => img.complete
        ? Promise.resolve()
        : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })));
      // NOTE: foreignObjectRendering:true was tried here as an extra fix
      // for KaTeX fraction mis-rendering, but caused a worse regression —
      // it silently produces a BLANK canvas for content positioned this
      // far off-screen (left:-99999px, as this container is, a few lines
      // up). Confirmed via a direct reproduction using real chapter
      // content: the font-ready wait above is sufficient on its own —
      // do not re-add foreignObjectRendering without first re-testing
      // against real off-screen content, not just an on-screen sample.
      // Block positions (CSS px, relative to the paper root) so pages can break BETWEEN
      // questions instead of through the middle of one. Measured while still attached.
      const root = container.firstElementChild;
      const rootRect = root.getBoundingClientRect();
      rootCssWidth = rootRect.width || 754;
      rootCssHeight = rootRect.height;
      atoms = Array.from(root.querySelectorAll('.pp-atom, .pp-item')).map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top - rootRect.top, bottom: r.bottom - rootRect.top, keep: el.hasAttribute('data-pp-keep'), item: el.classList.contains('pp-item') };
      }).filter(a => !a.item || (a.bottom - a.top) <= 620);
      const spot = root.querySelector('[data-pp-pages]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        pagesSpot = { top: r.top - rootRect.top, left: r.left - rootRect.left, width: r.width, height: r.height };
      }
      canvas = await window.html2canvas(root, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    } finally {
      container.remove();
    }
    const board = _isBoard(paper);

    // compress:true matters a lot: without it jsPDF stores every page image as raw pixels
    // (~12 MB per A4 page); with it a normal paper is around 1 MB per page.
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Real print margin, found live: the old code placed the image at
    // (0,0) full page width/height with no border at all — fine on
    // screen, but real printers can't print to the physical edge of the
    // sheet (their own hardware margin), so anything near an edge got
    // clipped when actually printed. 12mm is a safe, standard margin for
    // exam-paper printing on any common printer.
    const MARGIN_MM = 12;
    // Board papers reserve room for the running header (page/paper code, seat number)
    // and the "P.T.O." footer.
    const topMm = board ? 24 : MARGIN_MM;
    const botMm = board ? 16 : MARGIN_MM;
    const contentWidthMm  = pageWidth  - 2 * MARGIN_MM;
    const contentHeightMm = pageHeight - topMm - botMm;

    // mm-per-source-pixel, derived from how the full canvas maps onto the
    // (now narrower) content width — needed to crop the canvas into exact
    // per-page slices in source-pixel units.
    const pxPerMm = canvas.width / contentWidthMm;
    const sliceHeightPx = Math.round(contentHeightMm * pxPerMm);

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    const sliceCtx = sliceCanvas.getContext('2d');

    // Page breaks (in canvas px): normally one page of content, but if a question block
    // straddles the page end, the whole block moves to the next page.
    const canvasPerCss = canvas.height / (rootCssHeight || canvas.height);
    const cssPerMm = rootCssWidth / contentWidthMm;
    const pageCss = contentHeightMm * cssPerMm;
    const cssBreaks = [];
    {
      let start = 0;
      const total = rootCssHeight || canvas.height / canvasPerCss;
      while (total - start > pageCss + 0.5) {
        let end = start + pageCss;
        const straddle = atoms.find(a => a.top < end && a.bottom > end && a.top > start + 24);
        if (straddle) end = straddle.top;
        // Never leave a section heading (keep-with-next) stranded at the bottom of a page.
        for (let guard = 0; guard < 4; guard++) {
          const last = atoms.filter(a => a.bottom <= end + 0.5 && a.top > start).pop();
          if (last && last.keep && last.top > start + 24) end = last.top; else break;
        }
        cssBreaks.push([start, end]);
        start = end;
      }
      cssBreaks.push([start, total]);
    }
    const totalPages = cssBreaks.length;
    const codeText = String(paper.header?.paperCode || '').trim();

    let sourceY = 0;
    let firstPage = true;
    let pageIdx = 0;
    while (sourceY < canvas.height) {
      const [cs, ce] = cssBreaks[pageIdx] || [0, 0];
      const isLast = pageIdx >= totalPages - 1;
      const thisSliceHeightPx = isLast
        ? canvas.height - sourceY
        : Math.min(Math.round((ce - cs) * canvasPerCss), canvas.height - sourceY);
      sliceCanvas.height = thisSliceHeightPx;
      sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        canvas,
        0, sourceY, canvas.width, thisSliceHeightPx,
        0, 0, canvas.width, thisSliceHeightPx
      );

      if (!firstPage) pdf.addPage();
      firstPage = false;

      // Bottom-margin-safe: this slice's own height (not the full page's
      // contentHeightMm) so a short final slice doesn't get stretched down
      // into where the bottom margin should be.
      const thisSliceHeightMm = (thisSliceHeightPx / pxPerMm);
      pdf.addImage(
        sliceCanvas.toDataURL('image/png'), 'PNG',
        MARGIN_MM, topMm, contentWidthMm, thisSliceHeightMm, undefined, 'FAST'
      );
      // A board-style exam paper stays clean: no diagonal watermark over the questions. An
      // institute name, if given, is printed in the page footer instead.
      if (!board) _drawWatermark(pdf, pageWidth, pageHeight, institutionName);
      if (board) _drawBoardPageChrome(pdf, { institutionName, pageNo: pageIdx + 1, totalPages, codeText, header: paper.header || {}, pageWidth, pageHeight, topMm, MARGIN_MM, pagesSpot, cssPerMm });

      sourceY += thisSliceHeightPx;
      pageIdx++;
    }

    return pdf.output('blob');
  }

  function _safeFilename(paper, suffix) {
    const base = String(paper.paperTitle || 'Paper').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Paper'}_${suffix}.pdf`;
  }

  // opts.institutionName — optional, shown instead of "Nks EduOrbit" in the
  // page header + diagonal watermark (see _buildHtml/_drawWatermark).
  // opts.language — 'marathi' (default, unchanged) or 'english' — only
  // switches the surrounding chrome text (Date/Total Marks/Section/Answer
  // labels), never the question/answer content itself (see _chromeText).
  async function exportQuestionPaper(paper, opts = {}) {
    const blob = await _renderToBlob(paper, false, opts.institutionName, opts.language);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, 'Question_Paper'));
  }

  async function exportAnswerSheet(paper, opts = {}) {
    const blob = await _renderToBlob(paper, true, opts.institutionName, opts.language);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, 'Answer_Sheet'));
  }

  // User-requested: let a teacher check a paper looks right BEFORE saving
  // it (and before spending the time on the heavier html2canvas/jsPDF PDF
  // pipeline). Returns the same chrome + question/answer HTML the PDF
  // export renders, with KaTeX math already processed — the caller shows
  // it in an on-screen modal (or anywhere else); this function has no
  // opinion on presentation, unlike exportQuestionPaper/exportAnswerSheet
  // which go straight to a saved file.
  async function previewHtml(paper, withAnswers, opts = {}) {
    await _ensureKatex();
    const container = document.createElement('div');
    container.innerHTML = _buildHtml(paper, withAnswers, opts.institutionName, opts.language);
    try { _renderMath(container); } catch (e) { console.warn('KaTeX preview render error:', e.message); }
    try { await document.fonts.ready; } catch (e) { /* best effort, same as _renderToBlob */ }
    return container.innerHTML;
  }

  // Exposed for other screens that show raw question/answer text and want
  // it readable (math rendered) rather than literal "$...$" — e.g. the
  // question picker lists in admin-app/paperBuilder.js and
  // student-app/teacherPaperBuilder.js. Same loader/renderer the PDF
  // export itself uses, just callable standalone.
  return { exportQuestionPaper, exportAnswerSheet, previewHtml, ensureKatex: _ensureKatex, renderMath: _renderMath, boardTotalMarks };
})();

window.PAPER_PDF = PAPER_PDF;
