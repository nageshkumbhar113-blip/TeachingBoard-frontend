/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Practice Paper Generator - SLS Phase 2 Admin Module
 * Smart paper generation with marks distribution algorithm
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const PaperGenerator = (() => {
  let generatedPaper = null;
  let papersList = [];

  // ─── Initialize Module ───────────────────────────────────────
  function init() {
    setupEventListeners();
    loadPapers();
  }

  // ─── Setup Event Listeners ───────────────────────────────────
  function setupEventListeners() {
    document.getElementById('btn-generate-paper')?.addEventListener('click', generatePaper);
    document.getElementById('btn-publish-paper')?.addEventListener('click', publishPaper);
    document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPDF);
  }

  // ─── Generate Paper (Smart Algorithm) ────────────────────────
  async function generatePaper() {
    try {
      const chapterId = document.getElementById('select-chapter').value;
      const totalMarks = parseInt(document.getElementById('input-total-marks').value) || 20;
      const difficulty = document.getElementById('select-difficulty').value || 'mixed';
      const paperTitle = document.getElementById('input-paper-title').value || '';

      if (!chapterId) {
        APP.toast('Please select a chapter', 'error');
        return;
      }

      // Show loading state
      document.getElementById('btn-generate-paper').disabled = true;
      document.getElementById('btn-generate-paper').textContent = '🔄 Generating...';

      const response = await fetch('/api/sls/admin/papers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          chapterId,
          totalMarks,
          difficulty,
          paperTitle,
          batchId: document.getElementById('select-batch').value,
          subjectId: document.getElementById('select-subject').value
        })
      });

      if (!response.ok) throw new Error('Failed to generate paper');

      const data = await response.json();
      generatedPaper = data.data;

      renderPaperPreview();
      APP.toast('Paper generated successfully! ✨', 'success');
    } catch (error) {
      APP.toast(`Error generating paper: ${error.message}`, 'error');
    } finally {
      document.getElementById('btn-generate-paper').disabled = false;
      document.getElementById('btn-generate-paper').textContent = '🎲 Generate Paper';
    }
  }

  // ─── Render Paper Preview ───────────────────────────────────
  async function renderPaperPreview() {
    if (!generatedPaper) return;

    const preview = document.getElementById('paper-preview');
    if (!preview) return;

    // Get full question details
    const questionIds = generatedPaper.questions.map(q => q.questionId);
    const params = new URLSearchParams();
    questionIds.forEach(id => params.append('ids', id));

    try {
      const response = await fetch(`/api/sls/admin/questions?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      const data = await response.json();
      const questionsMap = {};
      (data.data || []).forEach(q => {
        questionsMap[q._id] = q;
      });

      const marksDistribution = {};
      generatedPaper.questions.forEach(q => {
        marksDistribution[q.marks] = (marksDistribution[q.marks] || 0) + 1;
      });

      preview.innerHTML = `
        <div class="paper-header">
          <h3>✅ Practice Paper Generated!</h3>
          <p><strong>${generatedPaper.totalMarks} Marks | ${generatedPaper.totalQuestions} Questions | ${generatedPaper.generationFilters.difficulty}</strong></p>
        </div>

        <div class="marks-breakdown">
          <h4>Marks Breakdown</h4>
          <div class="breakdown-grid">
            ${Object.entries(marksDistribution).map(([marks, count]) => `
              <div class="breakdown-item">
                <span>${count}x ${marks}-mark</span>
                <span class="total">${count * marks} marks</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="questions-preview">
          <h4>Questions in Paper</h4>
          ${generatedPaper.questions.map((q, idx) => {
            const fullQ = questionsMap[q.questionId];
            return `
              <div class="preview-question">
                <strong>Q${idx + 1} (${q.marks} marks):</strong>
                ${fullQ?.questionText?.english || 'Loading...'}
                <span class="badge">${q.difficulty} | ${q.questionType}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="paper-actions">
          <button class="btn btn-secondary" onclick="location.reload()">🔄 Generate Again</button>
          <button class="btn btn-primary" onclick="PaperGenerator.publishPaper()">📤 Publish Paper</button>
          <button class="btn btn-secondary" onclick="PaperGenerator.downloadPDF()">📥 Download PDF</button>
        </div>
      `;

      // Show action buttons
      document.getElementById('btn-publish-paper').style.display = 'inline-block';
      document.getElementById('btn-download-pdf').style.display = 'inline-block';
    } catch (error) {
      APP.toast(`Error rendering preview: ${error.message}`, 'error');
    }
  }

  // ─── Load Papers List ────────────────────────────────────────
  async function loadPapers() {
    try {
      const response = await fetch('/api/sls/admin/papers', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load papers');

      const data = await response.json();
      papersList = data.data || [];
      renderPapersList();
    } catch (error) {
      APP.toast(`Error loading papers: ${error.message}`, 'error');
    }
  }

  // ─── Render Papers List ──────────────────────────────────────
  function renderPapersList() {
    const container = document.getElementById('papers-list');
    if (!container || papersList.length === 0) return;

    container.innerHTML = papersList.map(p => `
      <div class="paper-item" data-id="${p._id}">
        <div class="paper-info">
          <strong>${p.paperTitle || `Paper ${p.paperNumber}`}</strong>
          <div class="paper-meta">
            <span class="badge">${p.totalMarks} marks</span>
            <span class="badge">${p.totalQuestions} questions</span>
            <span class="badge">${p.status}</span>
            <span class="badge">Attempts: ${p.totalAttempts || 0}</span>
          </div>
        </div>
        <div class="paper-actions">
          <button class="btn-sm" onclick="PaperGenerator.viewPaper('${p._id}')">👁️ View</button>
          <button class="btn-sm" onclick="PaperGenerator.downloadPaperPDF('${p._id}')">📥 PDF</button>
          ${p.status === 'draft' ? `<button class="btn-sm" onclick="PaperGenerator.publishSavedPaper('${p._id}')">📤 Publish</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ─── Publish Paper ──────────────────────────────────────────
  async function publishPaper() {
    if (!generatedPaper) {
      APP.toast('No paper to publish', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/sls/admin/papers/${generatedPaper._id}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to publish paper');

      APP.toast('Paper published successfully! 🎉', 'success');
      loadPapers();
      generatedPaper = null;
    } catch (error) {
      APP.toast(`Error publishing paper: ${error.message}`, 'error');
    }
  }

  // ─── Publish Saved Paper ────────────────────────────────────
  async function publishSavedPaper(paperId) {
    try {
      const response = await fetch(`/api/sls/admin/papers/${paperId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to publish paper');

      APP.toast('Paper published successfully!', 'success');
      loadPapers();
    } catch (error) {
      APP.toast(`Error publishing paper: ${error.message}`, 'error');
    }
  }

  // ─── Download PDF ───────────────────────────────────────────
  async function downloadPDF() {
    if (!generatedPaper) {
      APP.toast('No paper to download', 'error');
      return;
    }

    try {
      // Generate PDF from paper data
      const pdf = generatePDFContent(generatedPaper);
      downloadFile(pdf, `paper-${generatedPaper.paperNumber}.pdf`);
      APP.toast('PDF downloaded successfully!', 'success');
    } catch (error) {
      APP.toast(`Error downloading PDF: ${error.message}`, 'error');
    }
  }

  // ─── Download Paper PDF ─────────────────────────────────────
  async function downloadPaperPDF(paperId) {
    try {
      const response = await fetch(`/api/sls/admin/papers/${paperId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load paper');

      const data = await response.json();
      const pdf = generatePDFContent(data.data);
      downloadFile(pdf, `paper-${data.data.paperNumber}.pdf`);
      APP.toast('PDF downloaded!', 'success');
    } catch (error) {
      APP.toast(`Error downloading PDF: ${error.message}`, 'error');
    }
  }

  // ─── View Paper ──────────────────────────────────────────────
  async function viewPaper(paperId) {
    try {
      const response = await fetch(`/api/sls/admin/papers/${paperId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load paper');

      const data = await response.json();
      generatedPaper = data.data;
      renderPaperPreview();
    } catch (error) {
      APP.toast(`Error loading paper: ${error.message}`, 'error');
    }
  }

  // ─── Generate PDF Content ───────────────────────────────────
  function generatePDFContent(paper) {
    let content = `
PRACTICE PAPER ${paper.paperNumber}
${paper.paperTitle || 'Smart Generated Paper'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Marks: ${paper.totalMarks}
Total Questions: ${paper.totalQuestions}
Time Limit: ${paper.timeLimit} minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    `;

    paper.questions.forEach((q, idx) => {
      content += `\nQ${idx + 1}. (${q.marks} marks)\n`;
      content += `[Question text will appear here]\n`;
      content += `\n\n`;
    });

    return content;
  }

  // ─── Download File Helper ────────────────────────────────────
  function downloadFile(content, filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  // ─── Helper: Get Token ───────────────────────────────────────
  function getToken() {
    return localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
  }

  // ─── Public API ──────────────────────────────────────────────
  return {
    init,
    generatePaper,
    publishPaper,
    publishSavedPaper,
    downloadPDF,
    downloadPaperPDF,
    viewPaper,
    loadPapers
  };
})();

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PaperGenerator.init();
});
