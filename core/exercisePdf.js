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

  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

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

  function _buildHtml(paper, withAnswers) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = paper.questions.length;
    const totalMarks = paper.questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
    const subtitle = [paper.batch, paper.subject, paper.chapter].filter(Boolean).join(' • ');

    const itemsHtml = paper.questions.map((q, i) => {
      const qText = _questionText(q);
      const qDiagramsHtml = (q.questionDiagrams || []).map(d => `
        <div style="margin-top:6px">
          <img src="${_esc(d.url)}" crossorigin="anonymous" style="max-width:100%;max-height:260px;display:block;border:1px solid #ddd;border-radius:4px"/>
          ${d.caption ? `<div style="font-size:11px;color:#666;margin-top:2px">${_esc(d.caption)}</div>` : ''}
        </div>`).join('');

      const answerHtml = withAnswers ? `
        <div style="margin-top:8px;padding:8px 12px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px">
          <div style="font-size:11px;font-weight:700;color:#166534;margin-bottom:2px">Answer</div>
          <div style="font-size:13px;color:#166534;line-height:1.6;white-space:pre-line">${_esc(_answerText(q))}</div>
          ${(q.answerDiagrams || []).map(d => `
            <div style="margin-top:6px">
              <img src="${_esc(d.url)}" crossorigin="anonymous" style="max-width:100%;max-height:260px;display:block;border:1px solid #cde9d3;border-radius:4px"/>
              ${d.caption ? `<div style="font-size:11px;color:#166534;margin-top:2px">${_esc(d.caption)}</div>` : ''}
            </div>`).join('')}
        </div>` : '';

      return `
        <div style="margin-bottom:16px;break-inside:avoid;page-break-inside:avoid">
          <div style="font-size:14px;line-height:1.6"><b>प्रश्न ${i + 1}.</b> ${_esc(qText)} <span style="color:#e16b13;font-weight:600;font-size:12px">[${_formatMarks(q.marks)} ${q.marks === 1 ? 'mark' : 'marks'}]</span></div>
          ${qDiagramsHtml}
          ${answerHtml}
        </div>`;
    }).join('');

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
    const blob = await _renderToBlob(paper, withAnswers);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, withAnswers ? 'Answer_Key' : 'Question_Sheet'));
  }

  return { exportExercisePdf, _buildHtml, _renderToBlob };
})();

window.EXERCISE_PDF = EXERCISE_PDF;
