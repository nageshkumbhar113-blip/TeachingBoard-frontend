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

  function _buildHtml(paper, withAnswers) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
        return `
          <div style="margin-bottom:14px;page-break-inside:avoid">
            <div style="font-size:14px;line-height:1.5"><b>${qNum}.</b> ${_esc(qText)} <span style="color:#e16b13;font-weight:600;font-size:12px">[${marks} ${marks === 1 ? 'गुण' : 'गुण'}]</span></div>
            ${withAnswers ? `<div style="margin-top:4px;padding:8px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:13px;color:#166534"><b>उत्तर:</b> ${_esc(aText)}</div>` : ''}
          </div>`;
      }).join('');
      return `
        <div style="margin-bottom:18px">
          <div style="font-weight:700;font-size:13px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-bottom:10px">
            विभाग — ${marks} गुणांचे प्रश्न (प्रत्येकी ${marks} गुण)
          </div>
          ${items}
        </div>`;
    }).join('');

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666">NKS EDUORBIT</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${_esc(paper.paperTitle || 'Practice Paper')}</div>
          <div style="font-size:13px;color:#333">${_esc(subjectLabel)} • ${_esc(paper.batchId || '')}</div>
          ${withAnswers ? '<div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:4px">— उत्तरपत्रिका (Answer Sheet) —</div>' : ''}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>दिनांक: ${dateStr}</span>
          <span>एकूण गुण: <b>${paper.totalMarks || 0}</b></span>
          <span>Paper #${paper.paperNumber || ''}</span>
        </div>
        ${sections}
        <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px solid #ddd;padding-top:8px">
          Generated by Nks EduOrbit
        </div>
      </div>`;
  }

  function _drawWatermark(pdf, pageWidth, pageHeight) {
    pdf.saveGraphicsState?.();
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(48);
    const text = 'Nks EduOrbit';
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

  async function _renderToBlob(paper, withAnswers) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = _buildHtml(paper, withAnswers);
    document.body.appendChild(container);

    let canvas;
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
      // NOTE: foreignObjectRendering:true was tried here as an extra fix
      // for KaTeX fraction mis-rendering, but caused a worse regression —
      // it silently produces a BLANK canvas for content positioned this
      // far off-screen (left:-99999px, as this container is, a few lines
      // up). Confirmed via a direct reproduction using real chapter
      // content: the font-ready wait above is sufficient on its own —
      // do not re-add foreignObjectRendering without first re-testing
      // against real off-screen content, not just an on-screen sample.
      canvas = await window.html2canvas(container.firstElementChild, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    } finally {
      container.remove();
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    _drawWatermark(pdf, pageWidth, pageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      _drawWatermark(pdf, pageWidth, pageHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  }

  function _safeFilename(paper, suffix) {
    const base = String(paper.paperTitle || 'Paper').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Paper'}_${suffix}.pdf`;
  }

  async function exportQuestionPaper(paper) {
    const blob = await _renderToBlob(paper, false);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, 'Question_Paper'));
  }

  async function exportAnswerSheet(paper) {
    const blob = await _renderToBlob(paper, true);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, 'Answer_Sheet'));
  }

  return { exportQuestionPaper, exportAnswerSheet };
})();

window.PAPER_PDF = PAPER_PDF;
