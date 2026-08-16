/* ════════════════════════════════════════
   exercisePdf.js — Exercise (SLS question bank) → real PDF
   Global: EXERCISE_PDF

   Same proven pattern as core/quizPdf.js (html2canvas + jsPDF, margin-safe
   page slicing from day one — see quizPdf.js's own history for why the
   naive "draw one giant image" approach fails to print). Exercise content
   is bilingual (Marathi primary, English fallback) and can carry longer
   written answers (short/long-answer, numerical, diagram types) rather
   than short MCQ options, so this stays single-column instead of
   quizPdf.js's 2-column MCQ layout.
════════════════════════════════════════ */

const EXERCISE_PDF = (() => {
  const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const H2C_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  // Same KaTeX build core/math.js's MATH.renderElement() uses for the admin
  // preview — question/answer text is authored with $...$/$$...$$ LaTeX
  // math (exerciseManager.js's own bulk-paste format explicitly asks for
  // it). The PDF pipeline never ran this, so a question like "$2,m/s^2$"
  // printed as literal dollar-sign text instead of formatted math (real
  // bug, found live from an actual exported PDF). html2canvas captures
  // whatever's in the DOM at capture time, so KaTeX just needs to run on
  // the container *before* the canvas snapshot — no image conversion
  // needed, this renders real math markup into real DOM/CSS first.
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

  async function _ensureLibs() {
    await _loadScript(JSPDF_CDN, () => window.jspdf?.jsPDF);
    await _loadScript(H2C_CDN, () => window.html2canvas);
    if (!window.jspdf?.jsPDF) throw new Error('jsPDF failed to load');
    if (!window.html2canvas) throw new Error('html2canvas failed to load');
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

  // Escapes HTML, then applies light markdown: **bold** -> <strong>, and
  // GitHub-style pipe tables (a header row + a |---|---| separator row,
  // as ChatGPT/Claude commonly paste) -> a real <table>. Runs on the
  // already-escaped string, since | and - are never touched by _esc.
  function _richText(raw) {
    const bolded = _esc(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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

  // Decorative chapter banner — dark rounded bar, chapter name + batch/
  // subject subtitle, matching the printed workbook style referenced (real
  // coaching-class notes/exercise book photo: dark banner, bold chapter
  // name, small caps context line underneath).
  function _bannerHtml(title, subtitle) {
    return `
      <div style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#1f2328,#3a3f47);border-radius:16px;padding:14px 22px;margin-bottom:18px">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#e16b13,#f0883e);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">📝</div>
        <div>
          <div style="color:#fff;font-size:19px;font-weight:800;line-height:1.3">${_esc(title)}</div>
          ${subtitle ? `<div style="color:#c9ccd1;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;margin-top:2px">${_esc(subtitle)}</div>` : ''}
        </div>
      </div>`;
  }

  function _formatMarks(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, '');
  }

  // Exercise diagrams (questionDiagrams[]/answerDiagrams[]) already carry
  // absolute, backend-hosted URLs (Cloudinary-style) — unlike quizPdf.js's
  // question images, there's no local-IDB-blob resolution step needed here.
  function _questionText(q) {
    return String(q?.questionText?.marathi || q?.questionText?.english || '').trim();
  }
  function _answerText(q) {
    return String(q?.answerText?.marathi || q?.answerText?.english || '').trim();
  }

  // One question item — shared by the single-exercise export and the
  // multi-exercise Book export. numLabel is the continuous question number
  // across the whole document (book numbering doesn't restart per exercise).
  function _itemHtml(q, numLabel, withAnswers) {
    const qText = _questionText(q);
    const qDiagramsHtml = (q.questionDiagrams || []).map(d => `
      <div style="margin-top:6px">
        <img src="${_esc(d.url)}" crossorigin="anonymous" style="max-width:100%;max-height:260px;display:block;border:1px solid #ddd;border-radius:4px"/>
        ${d.caption ? `<div style="font-size:11px;color:#666;margin-top:2px">${_esc(d.caption)}</div>` : ''}
      </div>`).join('');

    const answerHtml = withAnswers ? `
      <div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px">
        <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:2px">Answer</div>
        <div style="font-size:13px;color:#166534;line-height:1.6">${_richText(_answerText(q))}</div>
        ${(q.answerDiagrams || []).map(d => `
          <div style="margin-top:6px">
            <img src="${_esc(d.url)}" crossorigin="anonymous" style="max-width:100%;max-height:260px;display:block;border:1px solid #cde9d3;border-radius:4px"/>
            ${d.caption ? `<div style="font-size:11px;color:#166534;margin-top:2px">${_esc(d.caption)}</div>` : ''}
          </div>`).join('')}
      </div>` : '';

    return `
      <div style="margin-bottom:16px;break-inside:avoid;page-break-inside:avoid">
        <div style="font-size:14px;line-height:1.6"><b>प्रश्न ${numLabel}.</b> ${_richText(qText)} <span style="color:#e16b13;font-weight:600;font-size:12px">[${_formatMarks(q.marks)} ${q.marks === 1 ? 'mark' : 'marks'}]</span></div>
        ${qDiagramsHtml}
        ${answerHtml}
      </div>`;
  }

  function _buildHtml(paper, withAnswers) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = paper.questions.length;
    const totalMarks = paper.questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
    const subtitle = [paper.batch, paper.subject, paper.chapter].filter(Boolean).join(' • ');

    const itemsHtml = paper.questions.map((q, i) => _itemHtml(q, i + 1, withAnswers)).join('');

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666">NKS EDUORBIT</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">Exercise ${_esc(paper.exerciseNo)}</div>
          ${subtitle ? `<div style="font-size:13px;color:#333">${_esc(subtitle)}</div>` : ''}
          ${withAnswers ? '<div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:4px">— Answer Key —</div>' : ''}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>Date: ${dateStr}</span>
          <span>Questions: <b>${totalQuestions}</b></span>
          <span>Total Marks: <b>${_formatMarks(totalMarks)}</b></span>
        </div>
        ${itemsHtml}
        <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px solid #ddd;padding-top:8px">
          Generated by Nks EduOrbit
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // EXERCISE BOOK — every Exercise No. under one Chapter, combined into a
  // single continuously-numbered PDF (not restarting the question number at
  // each Exercise), so the total marks add up to the whole chapter.
  // ════════════════════════════════════════════════════════════════════════

  function _buildBookHtml(meta, groups, withAnswers) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = groups.reduce((sum, g) => sum + g.questions.length, 0);
    const totalMarks = groups.reduce((sum, g) => sum + g.questions.reduce((s, q) => s + Number(q.marks || 0), 0), 0);
    const subtitle = [meta.batch, meta.subject, meta.chapter].filter(Boolean).join(' • ');

    let qNum = 0;
    const groupsHtml = groups.map(group => {
      const groupMarks = group.questions.reduce((s, q) => s + Number(q.marks || 0), 0);
      const itemsHtml = group.questions.map(q => { qNum++; return _itemHtml(q, qNum, withAnswers); }).join('');
      return `
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:13px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-bottom:10px">
            <span>Exercise ${_esc(group.exerciseNo)}</span>
            <span style="font-weight:600;font-size:11px;color:#555">${group.questions.length} questions | ${_formatMarks(groupMarks)} marks</span>
          </div>
          ${itemsHtml}
        </div>`;
    }).join('');

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        ${_bannerHtml(meta.chapter || 'Exercise', subtitle)}
        ${withAnswers ? '<div style="font-size:12px;color:#16a34a;font-weight:700;margin-bottom:8px">— Answer Key —</div>' : ''}
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>Date: ${dateStr}</span>
          <span>Exercises: <b>${groups.length}</b></span>
          <span>Questions: <b>${totalQuestions}</b></span>
          <span>Total Marks: <b>${_formatMarks(totalMarks)}</b></span>
        </div>
        ${groupsHtml}
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
    try {
      pdf.text(text, pageWidth / 2, pageHeight / 2, { angle: 35, align: 'center' });
    } catch (e) {
      pdf.text(text, pageWidth / 2 - 40, pageHeight / 2, 35);
    }
    pdf.restoreGraphicsState?.();
    pdf.setTextColor(0, 0, 0);
  }

  // Vertical chapter-name side tab + "Subject / page-no" footer, drawn
  // directly on every physical page (like the watermark) rather than baked
  // into the flowing HTML content — a page-edge label has to repeat on
  // every page, but the source HTML is one continuous flow rendered once,
  // so it can only be positioned this way, per finished page.
  function _drawPageChrome(pdf, pageWidth, pageHeight, pageNum, sideLabel, footerLabel) {
    if (sideLabel) {
      pdf.saveGraphicsState?.();
      pdf.setFillColor(240, 136, 62);
      pdf.rect(pageWidth - 7, 40, 7, 60, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      try {
        pdf.text(sideLabel, pageWidth - 3.5, 95, { angle: 90, align: 'left' });
      } catch (e) { /* older jsPDF without object-form angle — skip silently */ }
      pdf.restoreGraphicsState?.();
      pdf.setTextColor(0, 0, 0);
    }
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${footerLabel ? footerLabel + ' / ' : ''}${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
  }

  // Takes a pre-built HTML string (from _buildHtml or _buildBookHtml) rather
  // than a paper object, so both the single-exercise export and the
  // multi-exercise Book export share one renderer.
  async function _renderToBlob(html, chrome = {}) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = html;
    document.body.appendChild(container);

    let canvas;
    try {
      // KaTeX must run and finish BEFORE the canvas snapshot — it mutates
      // the DOM (the $...$ text nodes become real rendered math markup),
      // and html2canvas only ever captures whatever's already in the DOM
      // at the moment it's called.
      try { await _ensureKatex(); _renderMath(container); } catch (e) { console.warn('KaTeX unavailable, math will show as raw text:', e.message); }
      canvas = await window.html2canvas(container.firstElementChild, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    } finally {
      container.remove();
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Real print margin on every side — see quizPdf.js for why edge-to-edge
    // drawing fails to print reliably. Same 12mm margin, same per-page
    // canvas-slicing approach so every page (not just the last) respects it.
    const MARGIN = 12;
    const contentWidthMm  = pageWidth  - MARGIN * 2;
    const contentHeightMm = pageHeight - MARGIN * 2;

    const pxPerMm = canvas.width / contentWidthMm;
    const pageSliceHeightPx = Math.floor(contentHeightMm * pxPerMm);

    let renderedPx = 0;
    let firstPage = true;
    let pageNum = 0;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageSliceHeightPx, canvas.height - renderedPx);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width  = canvas.width;
      pageCanvas.height = sliceHeightPx;
      const ctx = pageCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

      const sliceHeightMm = sliceHeightPx / pxPerMm;
      const imgData = pageCanvas.toDataURL('image/png');

      if (!firstPage) pdf.addPage();
      pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, contentWidthMm, sliceHeightMm);
      _drawWatermark(pdf, pageWidth, pageHeight);
      pageNum++;
      _drawPageChrome(pdf, pageWidth, pageHeight, pageNum, chrome.sideLabel, chrome.footerLabel);

      renderedPx += sliceHeightPx;
      firstPage = false;
    }

    return pdf.output('blob');
  }

  function _safeFilename(paper, suffix) {
    const base = [paper.chapter, `Ex${paper.exerciseNo}`].filter(Boolean).join('_')
      .replace(/[^a-zA-Z0-9ऀ-ॿ_ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Exercise'}_${suffix}.pdf`;
  }

  /**
   * @param {{batch, subject, chapter, exerciseNo, questions}} data — questions
   *   is the array already fetched for that chapterId+exerciseNo (same shape
   *   API.fetchAdminSlsQuestions/fetchStudentExerciseQuestions returns).
   */
  async function exportExercisePdf(data, { withAnswers = false } = {}) {
    const questions = (data?.questions || []).filter(Boolean);
    if (!questions.length) {
      APP.toast('या Exercise मध्ये अजून प्रश्न नाहीत', 'error');
      return;
    }
    const paper = {
      batch: data.batch || '',
      subject: data.subject || '',
      chapter: data.chapter || '',
      exerciseNo: data.exerciseNo || '',
      questions,
    };
    const blob = await _renderToBlob(_buildHtml(paper, withAnswers), { sideLabel: paper.chapter, footerLabel: paper.subject });
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, withAnswers ? 'Answer_Key' : 'Question_Sheet'));
  }

  /**
   * @param {{batch, subject, chapter}} meta
   * @param {{exerciseNo, questions}[]} groups — every Exercise No. under
   *   this chapter (API.fetchAdminSlsQuestions({chapterId}), grouped by
   *   exerciseNo client-side), sorted in the order they should print.
   */
  async function exportExerciseBookPdf(meta, groups, { withAnswers = false } = {}) {
    const nonEmpty = (groups || []).filter(g => g?.questions?.length);
    if (!nonEmpty.length) {
      APP.toast('या Chapter मध्ये अजून प्रश्न नाहीत', 'error');
      return;
    }
    const filename = [meta.chapter, 'Book', withAnswers ? 'Answer_Key' : 'Question_Sheet']
      .filter(Boolean).join('_').replace(/[^a-zA-Z0-9ऀ-ॿ_ ]/g, '').trim().replace(/\s+/g, '_') + '.pdf';
    const blob = await _renderToBlob(_buildBookHtml(meta, nonEmpty, withAnswers), { sideLabel: meta.chapter, footerLabel: meta.subject });
    await FILE_EXPORT.saveAndShare(blob, filename || 'Exercise_Book.pdf');
  }

  return { exportExercisePdf, exportExerciseBookPdf, _buildHtml, _buildBookHtml, _renderToBlob };
})();

window.EXERCISE_PDF = EXERCISE_PDF;
