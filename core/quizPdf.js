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
  // Same KaTeX build core/math.js's MATH.renderElement() uses for the
  // student-side quiz/testPlayer question display — question text is
  // authored with $...$/$$...$$ LaTeX math. The PDF pipeline never ran
  // this, so math printed as literal dollar-sign text (real bug, found
  // live in the Exercise PDF; MCQ questions go through the identical
  // authoring convention, same fix needed here).
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

  // Decorative chapter/paper banner — dark rounded bar, title + batch/
  // subject subtitle, matching the printed workbook style referenced (real
  // coaching-class book photo: dark banner, bold chapter/paper name, small
  // caps context line underneath). Shared with notesPdf.js/exercisePdf.js.
  function _bannerHtml(title, subtitle) {
    return `
      <div style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#1f2328,#3a3f47);border-radius:16px;padding:14px 22px;margin-bottom:18px">
        <div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#e16b13,#f0883e);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">📐</div>
        <div>
          <div style="color:#fff;font-size:19px;font-weight:800;line-height:1.3">${_esc(title)}</div>
          ${subtitle ? `<div style="color:#c9ccd1;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;margin-top:2px">${_esc(subtitle)}</div>` : ''}
        </div>
      </div>`;
  }

  // Same resolution order student-app/testPlayer.js uses for question/option
  // images: local IDB-cached blob first (offline-safe, works in a native
  // WebView with no network), falling back to the ref itself (a remote URL)
  // when nothing is cached locally.
  async function _resolveImageSrc(ref) {
    const clean = String(ref || '').trim();
    if (!clean) return null;
    if (typeof DB === 'undefined') return clean;
    const localSrc = await DB.getImage(clean).catch(() => null);
    return localSrc || clean;
  }

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
   * (server response with no local sections cached, or a legacy quiz) — OR
   * a pre-publish DRAFT quiz from testBuilder.js Step 3, which never has a
   * flat `questions[]` at all, only `sections[].question_ids` pointing into
   * the local question bank (DB). Always returns
   * { title, batch, subject, chapter, sections[] } where each section has
   * resolved marks and its own question list. Per-question marks
   * (denormalized at publish time) win over section/quiz-level marks, same
   * resolution order as student-app/testPlayer.js.
   */
  async function _normalizeQuizForPdf(quiz) {
    const embedded = (quiz.questions || []).filter(q => q?.q_id);
    // Draft/pre-publish quiz — quiz.questions is empty, resolve section
    // question_ids from the local bank instead (same fallback core/pdf.js
    // already uses for exportQuizPaper).
    const bankQuestions = (!embedded.length && typeof DB !== 'undefined')
      ? await (async () => {
          const byBatch = await DB.getQuestionsByBatch(quiz.batch || '');
          return byBatch.length ? byBatch : await DB.getAllQuestions();
        })()
      : [];
    const questionMap = new Map([
      ...bankQuestions.map(q => [q.q_id, q]),
      ...embedded.map(q => [q.q_id, q]),
    ]);

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

    // Resolve question/option image refs to actual displayable src (blob
    // URL or remote URL) up front — _buildHtml is synchronous string-
    // building, so this can't happen lazily there. Stored on namespaced
    // _pdf* keys rather than overwriting the original fields, since these
    // question objects are shared references (from questionMap / the
    // quiz's own embedded questions), not copies.
    for (const section of sections) {
      for (const question of section.questions) {
        question._pdfImageSrc = await _resolveImageSrc(question.image);
        if (question.option_images) {
          question._pdfOptionImageSrc = {};
          for (const [key, ref] of Object.entries(question.option_images)) {
            question._pdfOptionImageSrc[key] = await _resolveImageSrc(ref);
          }
        }
      }
    }

    return {
      title: quiz.title || 'Untitled Quiz',
      batch: quiz.batch || '',
      subject: quiz.subject || '',
      chapter: quiz.chapter || '',
      instructions: quiz.instructions || '',
      sections,
    };
  }

  function _getOptionEntries(question) {
    const rawOptions = question.options || {};
    const rawOptionImages = question._pdfOptionImageSrc || {};
    // An option can be image-only (no text) — include it if either side has
    // content, not just text, or an image-only option silently disappears.
    const hasContent = key => !!rawOptions[key] || !!rawOptionImages[key];
    const preferredOrder = ['A', 'B', 'C', 'D'];
    const entries = [];
    preferredOrder.forEach(key => {
      if (hasContent(key)) entries.push([key, rawOptions[key] || '']);
    });
    const seen = new Set(preferredOrder);
    [...Object.keys(rawOptions), ...Object.keys(rawOptionImages)].forEach(key => {
      if (!seen.has(key) && hasContent(key)) { seen.add(key); entries.push([key, rawOptions[key] || '']); }
    });
    return entries;
  }

  // Compact "Q.No -> Answer" grid for the end-of-book Answer Key (Books #3/
  // #4/#5 — Subject-wise/Chapter-wise/Pattern Test Books) — one page-worth
  // of tiny cells instead of repeating every question, since the questions
  // already appeared once earlier in the same document.
  function _answerKeyGridHtml(flatAnswers) {
    const cellsHtml = flatAnswers.map(({ num, answer }) =>
      `<span style="display:inline-block;min-width:52px">${num}-<b style="color:#16a34a">${_esc(answer)}</b></span>`
    ).join('');
    return `
      <div style="margin-top:20px;padding-top:14px;border-top:3px double #1e3a8a">
        <div style="font-size:16px;font-weight:800;color:#1e3a8a;margin-bottom:10px;text-align:center">🔑 Answer Key</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 4px;font-size:12px">${cellsHtml}</div>
      </div>`;
  }

  // One question item — extracted so both the single continuous _buildHtml
  // and the per-section grouped book renderer below build identical markup.
  function _questionItemHtml(question, qNum, section, withAnswers) {
    const options = _getOptionEntries(question);
    const questionImageHtml = question._pdfImageSrc
      ? `<div style="margin-top:6px"><img src="${_esc(question._pdfImageSrc)}" crossorigin="anonymous" style="max-width:100%;max-height:220px;display:block;border:1px solid #ddd;border-radius:4px"/></div>`
      : '';
    const optionsHtml = options.length ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-top:6px;font-size:13px">
        ${options.map(([key, value]) => {
          const optImg = question._pdfOptionImageSrc?.[key];
          return `
          <div style="display:flex;gap:6px;align-items:flex-start">
            <span style="font-weight:700;min-width:16px">${_esc(key)})</span>
            <span>
              ${value ? `<span>${_esc(value)}</span>` : ''}
              ${optImg ? `<img src="${_esc(optImg)}" crossorigin="anonymous" style="max-width:120px;max-height:90px;display:block;margin-top:${value ? '4px' : '0'};border:1px solid #ddd;border-radius:4px"/>` : ''}
            </span>
          </div>`;
        }).join('')}
      </div>` : '';
    const answerHtml = withAnswers
      ? `<div style="margin-top:4px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12px;color:#166534">
           <b>Answer:</b> ${_esc(question.answer)}${options.find(([k]) => k === question.answer)?.[1] ? ` — ${_esc(options.find(([k]) => k === question.answer)[1])}` : ''}
         </div>`
      : '';
    return `
      <div style="margin-bottom:14px;break-inside:avoid;page-break-inside:avoid">
        <div style="font-size:14px;line-height:1.5"><b>${qNum}.</b> ${_esc(question.question)} <span style="color:#e16b13;font-weight:600;font-size:12px">[${_formatMarks(section.marks)}]</span></div>
        ${questionImageHtml}
        ${optionsHtml}
        ${answerHtml}
      </div>`;
  }

  function _sectionBlockHtml(section, qNumStart, withAnswers) {
    let qNum = qNumStart;
    const flatAnswers = [];
    const itemsHtml = section.questions.map(question => {
      qNum++;
      flatAnswers.push({ num: qNum, answer: question.answer });
      return _questionItemHtml(question, qNum, section, withAnswers);
    }).join('');
    const totalSectionMarks = section.questions.length * section.marks;
    const html = `
      <div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:13px;color:#1e3a8a;border-bottom:2px solid #1e3a8a;padding-bottom:4px;margin-bottom:10px">
          <span>${_esc(section.label)}</span>
          <span style="font-weight:600;font-size:11px;color:#555">${section.questions.length} questions | ${_formatMarks(section.marks)} each | ${_formatMarks(totalSectionMarks)} total</span>
        </div>
        <div style="column-count:2;column-gap:28px">${itemsHtml}</div>
      </div>`;
    return { html, qNumEnd: qNum, flatAnswers };
  }

  const _PAGE_WRAP_OPEN  = `<div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">`;
  const _PAGE_WRAP_CLOSE = `</div>`;

  /**
   * @param {object} paper
   * @param {boolean} withAnswers — inline "Answer: ..." under every
   *   question (the existing separate Answer Key PDF export).
   * @param {boolean} answersAtEnd — Books mode: no inline answers, instead
   *   one compact Q.No->Answer grid appended after all sections. Mutually
   *   exclusive with withAnswers in practice (Books never use withAnswers).
   */
  function _buildHtml(paper, withAnswers, answersAtEnd) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = paper.sections.reduce((sum, s) => sum + s.questions.length, 0);
    const totalMarks = paper.sections.reduce((sum, s) => sum + s.questions.length * s.marks, 0);
    const subtitle = [paper.batch, paper.subject, paper.chapter].filter(Boolean).join(' • ');

    let qNum = 0;
    const flatAnswers = [];
    const sectionsHtml = paper.sections.map(section => {
      const block = _sectionBlockHtml(section, qNum, withAnswers);
      qNum = block.qNumEnd;
      flatAnswers.push(...block.flatAnswers);
      return block.html;
    }).join('');

    return `
      ${_PAGE_WRAP_OPEN}
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666">NKS EDUORBIT</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${_esc(paper.title)}</div>
          ${subtitle ? `<div style="font-size:13px;color:#333">${_esc(subtitle)}</div>` : ''}
          ${withAnswers ? '<div style="font-size:12px;color:#16a34a;font-weight:700;margin-top:4px">— Answer Key —</div>' : ''}
        </div>
        ${(!withAnswers && !answersAtEnd) ? `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0 16px;border:1px solid #999;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px">
          <div>Name: <span style="display:inline-block;border-bottom:1px solid #333;min-width:180px">&nbsp;</span></div>
          <div>Roll No: <span style="display:inline-block;border-bottom:1px solid #333;min-width:70px">&nbsp;</span></div>
          <div>Seat No: <span style="display:inline-block;border-bottom:1px solid #333;min-width:70px">&nbsp;</span></div>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
          <span>Date: ${dateStr}</span>
          <span>Questions: <b>${totalQuestions}</b></span>
          <span>Total Marks: <b>${_formatMarks(totalMarks)}</b></span>
        </div>
        ${paper.instructions ? `
        <div style="margin-bottom:20px;padding:12px 16px;border:1px solid #1e3a8a;border-radius:6px;background:#f8faff;page-break-inside:avoid">
          <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:8px">Instructions to Candidates</div>
          <div style="font-size:12px;line-height:1.7;white-space:pre-line">${_esc(paper.instructions)}</div>
        </div>` : ''}
        ${sectionsHtml}
        ${answersAtEnd ? _answerKeyGridHtml(flatAnswers) : ''}
        <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px solid #ddd;padding-top:8px">
          Generated by Nks EduOrbit
        </div>
      ${_PAGE_WRAP_CLOSE}`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // BOOK GROUPS — Paper Pattern Book (#5), where sections span multiple
  // subjects/chapters: each section after the first must start on a fresh
  // page (user-confirmed: "प्रत्येक chapter नवीन page वर start होईल"), not
  // just flow on wherever the previous one ended. Splits the document into
  // independently-rendered "groups" (header+instructions+section 1, then
  // section 2 alone, section 3 alone, ..., then the answer key alone) — see
  // _renderGroupsToBlob, which forces a page break between groups while
  // still letting a single long section flow across multiple pages
  // internally exactly like before.
  // ════════════════════════════════════════════════════════════════════════

  function _buildBookGroups(paper, answersAtEnd) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalQuestions = paper.sections.reduce((sum, s) => sum + s.questions.length, 0);
    const totalMarks = paper.sections.reduce((sum, s) => sum + s.questions.length * s.marks, 0);
    // Books' titles already read "<batch> — X Book" or the chapter name
    // itself — skip a subtitle line that would just repeat the batch name
    // with nothing new (subject/chapter only appear here when the title
    // doesn't already carry them, e.g. this ever had per-section subjects).
    const subtitle = [paper.subject, paper.chapter].filter(Boolean).join(' • ');

    const headerHtml = `
      ${_bannerHtml(paper.title, subtitle)}
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:18px;color:#333">
        <span>Date: ${dateStr}</span>
        <span>Questions: <b>${totalQuestions}</b></span>
        <span>Total Marks: <b>${_formatMarks(totalMarks)}</b></span>
      </div>
      ${paper.instructions ? `
      <div style="margin-bottom:20px;padding:12px 16px;border:1px solid #1e3a8a;border-radius:6px;background:#f8faff">
        <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:8px">Instructions to Candidates</div>
        <div style="font-size:12px;line-height:1.7;white-space:pre-line">${_esc(paper.instructions)}</div>
      </div>` : ''}`;

    const footerHtml = `
      <div style="text-align:center;font-size:10px;color:#999;margin-top:24px;border-top:1px solid #ddd;padding-top:8px">
        Generated by Nks EduOrbit
      </div>`;

    const groups = [];
    let qNum = 0;
    const flatAnswers = [];
    paper.sections.forEach((section, i) => {
      const block = _sectionBlockHtml(section, qNum, false);
      qNum = block.qNumEnd;
      flatAnswers.push(...block.flatAnswers);
      const isLast = i === paper.sections.length - 1;
      const inner = i === 0
        ? `${headerHtml}${block.html}${(isLast && !answersAtEnd) ? footerHtml : ''}`
        : `${block.html}${(isLast && !answersAtEnd) ? footerHtml : ''}`;
      groups.push(`${_PAGE_WRAP_OPEN}${inner}${_PAGE_WRAP_CLOSE}`);
    });

    if (answersAtEnd) {
      groups.push(`${_PAGE_WRAP_OPEN}${_answerKeyGridHtml(flatAnswers)}${footerHtml}${_PAGE_WRAP_CLOSE}`);
    }

    return groups;
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

  // Vertical side tab + "Batch / page-no" footer, drawn directly on every
  // physical page (like the watermark) rather than baked into the flowing
  // HTML content — a page-edge label has to repeat on every page, but the
  // source HTML is one continuous flow rendered once, so it can only be
  // positioned this way, per finished page. Shared pattern with
  // notesPdf.js/exercisePdf.js.
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

  async function _renderToBlob(paper, withAnswers, answersAtEnd) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = _buildHtml(paper, withAnswers, answersAtEnd);
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
      // line, looking "struck through" (real bug, found live). Force a
      // reflow so the browser actually starts loading whatever fonts the
      // just-rendered markup needs, then wait for them.
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

    // Real print margin on every side. The old code drew the image
    // edge-to-edge (0,0 to pageWidth,pageHeight) — most printers have a
    // physical unprintable border, so edge-to-edge content gets clipped or
    // refused outright ("margin not set, can't print"). 12mm all round
    // keeps every page inside a printer-safe area.
    const MARGIN = 12;
    const contentWidthMm  = pageWidth  - MARGIN * 2;
    const contentHeightMm = pageHeight - MARGIN * 2;

    // Slice the tall rendered canvas into exact per-page pixel chunks sized
    // to the content box, instead of drawing one huge image and letting it
    // overflow past the margin into cropped-by-page-edge territory — this
    // way every page (not just the physical paper edge) respects the
    // margin on all four sides, top/bottom included.
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

  // Renders each group (see _buildBookGroups) as its own independent
  // canvas + page-slice run, forcing a page break BETWEEN groups while a
  // single group spanning multiple pages still paginates internally exactly
  // like _renderToBlob above (the per-group slicing loop is identical) —
  // the only difference is a new page always starts at the first slice of
  // every group after the first.
  async function _renderGroupsToBlob(groups, chrome = {}) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;
    try { await _ensureKatex(); } catch (e) { console.warn('KaTeX unavailable, math will show as raw text:', e.message); }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const MARGIN = 12;
    const contentWidthMm  = pageWidth  - MARGIN * 2;
    const contentHeightMm = pageHeight - MARGIN * 2;

    let isVeryFirstSlice = true;
    let pageNum = 0;
    for (const html of groups) {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-99999px';
      container.style.top = '0';
      container.innerHTML = html;
      document.body.appendChild(container);

      let canvas;
      try {
        _renderMath(container);
        // See _renderToBlob's own comment: html2canvas can snapshot before
        // KaTeX's web fonts actually finish loading/painting, mis-measuring
        // fractions/exponents into a "struck through" look even though
        // _renderMath ran correctly. Force a reflow, then wait for fonts.
        void container.offsetHeight;
        try { await document.fonts.ready; } catch (e) { /* older WebView without Font Loading API — best effort */ }
        // See _renderToBlob's own NOTE: foreignObjectRendering:true was
        // tried and reverted — it blanks the canvas for content this far
        // off-screen. Do not re-add it here either.
        canvas = await window.html2canvas(container.firstElementChild, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      } finally {
        container.remove();
      }

      const pxPerMm = canvas.width / contentWidthMm;
      const pageSliceHeightPx = Math.floor(contentHeightMm * pxPerMm);
      let renderedPx = 0;

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

        if (!isVeryFirstSlice) pdf.addPage();
        pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, contentWidthMm, sliceHeightMm);
        _drawWatermark(pdf, pageWidth, pageHeight);
        pageNum++;
        _drawPageChrome(pdf, pageWidth, pageHeight, pageNum, chrome.sideLabel, chrome.footerLabel);

        renderedPx += sliceHeightPx;
        isVeryFirstSlice = false;
      }
    }

    return pdf.output('blob');
  }

  function _safeFilename(paper, suffix) {
    const base = String(paper.title || 'Quiz').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Quiz'}_${suffix}.pdf`;
  }

  async function exportQuizPaper(quiz, { withAnswers = false } = {}) {
    const paper = await _normalizeQuizForPdf(quiz || {});
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

  // ════════════════════════════════════════════════════════════════════════
  // TEST BOOKS — Books #3 (Subject-wise), #4 (Chapter-wise) and #5 (Paper
  // Pattern) all funnel through here. No new backend endpoint: every
  // section is a random-pick request through the exact same
  // API.generateQuizQuestions the live Paper Pattern/Random Test Builder
  // already uses (source_batch/subject/chapter/count) — a Book is just N of
  // those requests combined into one PDF instead of published as a live
  // quiz. Answers never go inline; they're always the end-of-book grid.
  // ════════════════════════════════════════════════════════════════════════

  /**
   * @param {{title, batch, instructions}} meta
   * @param {{label, subject, chapter, count, marks}[]} sectionSpecs — chapter
   *   omitted/empty = subject-wide random pick (Book #3's default, per
   *   "selected subject = all its chapters"); one entry = Chapter-wise
   *   Book #4; multiple entries with per-section marks = Pattern Book #5.
   */
  async function exportTestBookPdf(meta, sectionSpecs) {
    const specs = (sectionSpecs || []).filter(s => s?.subject && s?.count > 0);
    if (!specs.length) {
      APP.toast('किमान एक Subject + question count द्या', 'error');
      return;
    }

    let results;
    try {
      results = await API.generateQuizQuestions(specs.map((s, i) => ({
        key: `sec_${i}`,
        source_batch: meta.batch || '',
        subject: s.subject,
        chapter: s.chapter || '',
        count: s.count,
      })));
    } catch (err) {
      APP.toast(err?.message || 'Questions fetch करता आले नाहीत', 'error');
      return;
    }

    const sections = [];
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const result = results.find(r => r.key === `sec_${i}`) || results[i];
      const questions = result?.questions || [];
      if (!questions.length) continue;
      for (const q of questions) {
        q._pdfImageSrc = await _resolveImageSrc(q.image);
        if (q.option_images) {
          q._pdfOptionImageSrc = {};
          for (const [key, ref] of Object.entries(q.option_images)) {
            q._pdfOptionImageSrc[key] = await _resolveImageSrc(ref);
          }
        }
      }
      sections.push({
        label: spec.label || spec.subject + (spec.chapter ? ` — ${spec.chapter}` : ''),
        marks: spec.marks ?? 1,
        negativeMarks: 0,
        questions,
      });
    }

    if (!sections.length) {
      APP.toast('कुठल्याही Subject/Chapter साठी प्रश्न सापडले नाहीत', 'error');
      return;
    }

    const paper = {
      title: meta.title || 'Test Book',
      batch: meta.batch || '',
      subject: '', chapter: '',
      instructions: meta.instructions || '',
      sections,
    };
    // Multiple sections (Paper Pattern Book spanning several subjects/
    // chapters) -> each section after the first starts on its own fresh
    // page (user-confirmed). A single-section book (Chapter-wise) has
    // nothing to break between, so the grouped renderer degenerates to the
    // same output as before for that case.
    const groups = _buildBookGroups(paper, true);
    const blob = await _renderGroupsToBlob(groups, { sideLabel: meta.batch });
    // Title already ends in "... Book" (Subject-wise/Chapter-wise/Pattern
    // Book titles are built with that suffix) — no extra "_Book" needed.
    const base = String(paper.title || 'Test Book').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    await FILE_EXPORT.saveAndShare(blob, `${base || 'Test_Book'}.pdf`);
  }

  return { exportQuizPaper, exportById, exportTestBookPdf, _normalizeQuizForPdf, _renderToBlob, _buildHtml, _buildBookGroups, _renderGroupsToBlob };
})();

window.QUIZ_PDF = QUIZ_PDF;
