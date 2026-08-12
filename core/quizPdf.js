/* ════════════════════════════════════════
   quizPdf.js — MCQ Quiz/Test → real PDF (Mixed/section-wise paper export)
   Global: QUIZ_PDF

   Why a new file instead of extending core/pdf.js: core/pdf.js opens a
   print-dialog HTML page (window.print / "open in Chrome and Print → Save
   as PDF" on native) — reliable enough as a fallback, but not a real
   downloadable PDF file on Android. This module follows the exact proven
   pattern from core/paperPdf.js (html2canvas + jsPDF, same CDN libs, same
   watermark) to produce a genuine PDF blob via FILE_EXPORT.saveAndShare,
   already known to render Devanagari correctly in the Capacitor WebView.

   Works from either a local quiz object (sections present) or a bare
   server response (sections absent, or IDB cleared) — both normalize to
   the same shape via _normalizeQuizForPdf, so export never depends on the
   authoring browser's IDB state.
════════════════════════════════════════ */

const QUIZ_PDF = (() => {
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

  function _toNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  function _formatMarks(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, '');
  }

  /**
   * Accepts either shape — a quiz with real `sections[]` (each carrying its
   * own question_ids/marks) or a bare quiz with only a flat `questions[]`
   * (server response with no local sections cached, or a legacy quiz) —
   * and always returns { title, batch, subject, chapter, sections[] } where
   * each section has resolved marks and its own question list. Per-question
   * marks (denormalized at publish time) win over section/quiz-level marks,
   * same resolution order as student-app/testPlayer.js.
   */
  function _normalizeQuizForPdf(quiz) {
    const questionMap = new Map((quiz.questions || []).filter(q => q?.q_id).map(q => [q.q_id, q]));

    let sections = Array.isArray(quiz.sections) && quiz.sections.length
      ? quiz.sections
          .map((section, index) => {
            const sectionQuestions = (section.question_ids || [])
              .map(qId => questionMap.get(qId))
              .filter(Boolean);
            if (!sectionQuestions.length) return null;
            return {
              label: section.label || `Section ${String.fromCharCode(65 + index)}`,
              marks: _toNumber(section.positive_marks, quiz.positive_marks, 1),
              negativeMarks: _toNumber(section.negative_marks, quiz.negative_marks, 0),
              questions: sectionQuestions,
            };
          })
          .filter(Boolean)
      : [];

    if (!sections.length && Array.isArray(quiz.questions) && quiz.questions.length) {
      sections = [{
        label: 'Section A',
        marks: _toNumber(quiz.positive_marks, 1),
        negativeMarks: _toNumber(quiz.negative_marks, 0),
        questions: quiz.questions,
      }];
    }

    return {
      title: quiz.title || 'Untitled Quiz',
      batch: quiz.batch || '',
      subject: quiz.subject || '',
      chapter: quiz.chapter || '',
      sections,
    };
  }

  function _getOptionEntries(question) {
    const rawOptions = question.options || {};
    const preferredOrder = ['A', 'B', 'C', 'D'];
    const entries = [];
    preferredOrder.forEach(key => {
      if (rawOptions[key]) entries.push([key, rawOptions[key]]);
    });
    Object.entries(rawOptions).forEach(([key, value]) => {
      if (!preferredOrder.includes(key) && value) entries.push([key, value]);
    });
    return entries;
  }

  function _buildHtml(paper, withAnswers) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = paper.sections.reduce((sum, s) => sum + s.questions.length, 0);
    const totalMarks = paper.sections.reduce((sum, s) => sum + s.questions.length * s.marks, 0);
    const subtitle = [paper.batch, paper.subject, paper.chapter].filter(Boolean).join(' • ');

    let qNum = 0;
    const sectionsHtml = paper.sections.map(section => {
      const itemsHtml = section.questions.map(question => {
        qNum++;
        const options = _getOptionEntries(question);
        const optionsHtml = options.length ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:6px;font-size:13px">
            ${options.map(([key, value]) => `
              <div style="display:flex;gap:6px">
                <span style="font-weight:700;min-width:16px">${_esc(key)})</span>
                <span>${_esc(value)}</span>
              </div>`).join('')}
          </div>` : '';
        const answerHtml = withAnswers
          ? `<div style="margin-top:4px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px;color:#166534">
               <b>Answer:</b> ${_esc(question.answer)}${options.find(([k]) => k === question.answer) ? ` — ${_esc(options.find(([k]) => k === question.answer)[1])}` : ''}
             </div>`
          : '';
        return `
          <div style="margin-bottom:14px;page-break-inside:avoid">
            <div style="font-size:14px;line-height:1.5"><b>${qNum}.</b> ${_esc(question.question)} <span style="color:#e16b13;font-weight:600;font-size:12px">[${_formatMarks(section.marks)}]</span></div>
            ${optionsHtml}
            ${answerHtml}
          </div>`;
      }).join('');

      const totalSectionMarks = section.questions.length * section.marks;
      return `
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:13px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-bottom:10px">
            <span>${_esc(section.label)}</span>
            <span style="font-weight:600;font-size:11px;color:#555">${section.questions.length} questions | ${_formatMarks(section.marks)} each | ${_formatMarks(totalSectionMarks)} total</span>
          </div>
          ${itemsHtml}
        </div>`;
    }).join('');

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666">NKS EDUORBIT</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${_esc(paper.title)}</div>
          ${subtitle ? `<div style="font-size:13px;color:#333">${_esc(subtitle)}</div>` : ''}
          ${withAnswers ? '<div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:4px">— Answer Key —</div>' : ''}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>Date: ${dateStr}</span>
          <span>Questions: <b>${totalQuestions}</b></span>
          <span>Total Marks: <b>${_formatMarks(totalMarks)}</b></span>
        </div>
        ${sectionsHtml}
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
    const base = String(paper.title || 'Quiz').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Quiz'}_${suffix}.pdf`;
  }

  async function exportQuizPaper(quiz, { withAnswers = false } = {}) {
    const paper = _normalizeQuizForPdf(quiz || {});
    if (!paper.sections.length) {
      APP.toast('No questions in this quiz', 'error');
      return;
    }
    const blob = await _renderToBlob(paper, withAnswers);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper, withAnswers ? 'Answer_Key' : 'Question_Paper'));
  }

  /**
   * Fetches the quiz fresh from the server and exports it — never touches
   * IDB, so it works even if the authoring browser's local cache is empty
   * or stale (e.g. exporting from the admin quiz list on a different
   * device/session than the one the quiz was built on).
   */
  async function exportById(quizId, opts = {}) {
    const quiz = await API.fetchQuizById(quizId);
    if (!quiz) {
      APP.toast('Quiz not found on server', 'error');
      return;
    }
    return exportQuizPaper(quiz, opts);
  }

  return { exportQuizPaper, exportById, _normalizeQuizForPdf };
})();

window.QUIZ_PDF = QUIZ_PDF;
