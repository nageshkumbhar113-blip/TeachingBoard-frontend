/* ════════════════════════════════════════
   notesPdf.js — Concept/Note (SLS notes) → real PDF
   Global: NOTES_PDF

   Same proven pattern as core/quizPdf.js / core/exercisePdf.js
   (html2canvas + jsPDF, margin-safe page slicing from day one). Notes are
   prose-heavy (paragraphs, learning outcomes, key points, revision box),
   so this stays single-column like exercisePdf.js.
════════════════════════════════════════ */

const NOTES_PDF = (() => {
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
  // Same markdown-lite convention as conceptManager.js's admin preview —
  // escape first, then turn **bold** into <strong>.
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

  function _blocksHtml(blocks) {
    return (blocks || []).map(block => {
      if (block.type === 'paragraph') {
        return `<p style="font-size:13px;line-height:1.7;margin:0 0 10px">${_richText(block.data?.text || '')}</p>`;
      }
      if (block.type === 'image') {
        return `
          <div style="margin:0 0 12px">
            <img src="${_esc(block.data?.url || '')}" crossorigin="anonymous" style="max-width:100%;max-height:320px;display:block;border:1px solid #ddd;border-radius:4px"/>
            ${block.data?.caption ? `<div style="font-size:11px;color:#666;margin-top:2px;text-align:center">${_esc(block.data.caption)}</div>` : ''}
          </div>`;
      }
      return '';
    }).join('');
  }

  function _listSection(title, items) {
    if (!items || !items.length) return '';
    return `
      <div style="margin-bottom:14px;break-inside:avoid;page-break-inside:avoid">
        <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:6px">${_esc(title)}</div>
        <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.8">
          ${items.map(i => `<li>${_richText(i)}</li>`).join('')}
        </ul>
      </div>`;
  }

  function _buildHtml(paper) {
    const subtitle = [paper.batch, paper.subject, paper.chapter].filter(Boolean).join(' • ');

    const revSections = [
      { key: 'remember',  icon: '🧠', label: 'Remember' },
      { key: 'mistakes',  icon: '❌', label: 'Mistakes to Avoid' },
      { key: 'formulas',  icon: '📐', label: 'Formulas' },
      { key: 'examTips',  icon: '⭐', label: 'Exam Tips' },
    ];
    const revHtml = revSections.map(({ key, icon, label }) => _listSection(`${icon} ${label}`, paper.revisionBox?.[key])).join('');

    const tagsHtml = (paper.examTags || []).length ? `
      <div style="margin-bottom:14px">
        <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:6px">🏷️ Exam Tags</div>
        <div>${paper.examTags.map(t => `<span style="display:inline-block;background:#eef1fb;color:#1e3a8a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin:2px 4px 2px 0">${_esc(t)}</span>`).join('')}</div>
      </div>` : '';

    return `
      <div style="font-family:'Noto Sans Devanagari','Mangal',Arial,sans-serif;width:754px;padding:36px;color:#111;background:#fff">
        <div style="text-align:center;border-bottom:3px double #1e3a8a;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1px;color:#666">NKS EDUORBIT</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${_esc(paper.title)}</div>
          ${subtitle ? `<div style="font-size:13px;color:#333">${_esc(subtitle)}</div>` : ''}
        </div>
        ${_listSection('📚 Learning Outcomes', paper.learningOutcomes)}
        <div style="margin-bottom:16px">
          <div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:8px">📚 Content</div>
          ${paper.blocks.length ? _blocksHtml(paper.blocks) : '<p style="font-size:13px;color:#888">No content yet.</p>'}
        </div>
        ${_listSection('🔑 Key Points', paper.shortNotes)}
        ${revHtml ? `<div style="margin-bottom:6px"><div style="font-weight:700;font-size:13px;color:#1e3a8a;margin-bottom:6px">📦 Revision Box</div>${revHtml}</div>` : ''}
        ${tagsHtml}
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

  async function _renderToBlob(paper) {
    await _ensureLibs();
    const { jsPDF } = window.jspdf;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.innerHTML = _buildHtml(paper);
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

    // Real print margin on every side — see quizPdf.js for the history of
    // why edge-to-edge drawing fails to print reliably. Same 12mm margin,
    // same per-page canvas-slicing approach, built in from day one here.
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

  function _safeFilename(paper) {
    const base = String(paper.title || 'Notes').replace(/[^a-zA-Z0-9ऀ-ॿ ]/g, '').trim().replace(/\s+/g, '_');
    return `${base || 'Notes'}.pdf`;
  }

  // Marathi is the primary language throughout this app's PDFs (quizPdf.js/
  // exercisePdf.js) — falls back to English only when a Marathi field is
  // genuinely empty, same per-field fallback conceptManager.js's own admin
  // preview already relies on for title.
  function _pickList(field) {
    const mr = field?.marathi;
    if (Array.isArray(mr) && mr.length) return mr;
    return Array.isArray(field?.english) ? field.english : [];
  }
  function _pickRevisionBox(field) {
    const mr = field?.marathi;
    if (mr && Object.values(mr).some(arr => Array.isArray(arr) && arr.length)) return mr;
    return field?.english || {};
  }
  function _pickBlocks(description) {
    const mrBlocks = description?.marathi?.blocks;
    if (Array.isArray(mrBlocks) && mrBlocks.length) return mrBlocks;
    return Array.isArray(description?.english?.blocks) ? description.english.blocks : [];
  }

  /**
   * @param {object} concept — full concept object (title/description/
   *   learningOutcomes/shortNotes/revisionBox/examTags), same shape
   *   API.fetchAdminConcept returns.
   * @param {{batch,subject,chapter}} context — display-only subtitle,
   *   not stored on the concept itself (chapterId is a composite key, not
   *   human-readable — same situation as exerciseManager.js).
   */
  async function exportNotePdf(concept, context = {}) {
    if (!concept) { APP.toast('Note सापडली नाही', 'error'); return; }

    const title = concept.title?.marathi || concept.title?.english || 'Untitled Note';
    const blocks = _pickBlocks(concept.description);
    const learningOutcomes = _pickList(concept.learningOutcomes);
    const shortNotes = _pickList(concept.shortNotes);
    const revisionBox = _pickRevisionBox(concept.revisionBox);
    const examTags = concept.examTags || [];

    if (!blocks.length && !learningOutcomes.length && !shortNotes.length) {
      APP.toast('या Note मध्ये अजून content नाही', 'error');
      return;
    }

    const paper = {
      batch: context.batch || '',
      subject: context.subject || '',
      chapter: context.chapter || '',
      title, blocks, learningOutcomes, shortNotes, revisionBox, examTags,
    };
    const blob = await _renderToBlob(paper);
    await FILE_EXPORT.saveAndShare(blob, _safeFilename(paper));
  }

  return { exportNotePdf, _buildHtml, _renderToBlob };
})();

window.NOTES_PDF = NOTES_PDF;
