/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Practice Panel - SLS Student Module
 * Paper taking, answer submission, and results view
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const PracticePanel = (() => {
  let currentPaper = null;
  let currentAttempt = null;
  let papersList = [];
  let isAnswerMode = false;
  let answers = {};
  let startTime = null;

  // ─── Initialize Module ───────────────────────────────────────
  function init() {
    setupEventListeners();
    loadPapers();
  }

  // ─── Setup Event Listeners ───────────────────────────────────
  function setupEventListeners() {
    document.getElementById('btn-start-paper')?.addEventListener('click', startPaper);
    document.getElementById('btn-submit-answers')?.addEventListener('click', submitAnswers);
    document.getElementById('btn-back-to-papers')?.addEventListener('click', () => {
      loadPapers();
    });

    document.getElementById('filter-status')?.addEventListener('change', loadPapers);
  }

  // ─── Load Available Papers ──────────────────────────────────
  async function loadPapers() {
    try {
      const response = await fetch('/api/sls/student/papers', {
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
      <div class="paper-card">
        <div class="paper-header">
          <h3>📋 ${p.paperTitle || `Practice Paper ${p.paperNumber}`}</h3>
          <span class="badge badge-${p.status}">${p.status}</span>
        </div>

        <div class="paper-details">
          <div class="detail-item">
            <span class="label">Marks:</span>
            <span class="value">${p.totalMarks}</span>
          </div>
          <div class="detail-item">
            <span class="label">Questions:</span>
            <span class="value">${p.totalQuestions}</span>
          </div>
          <div class="detail-item">
            <span class="label">Time:</span>
            <span class="value">${p.timeLimit} min</span>
          </div>
          <div class="detail-item">
            <span class="label">Difficulty:</span>
            <span class="value">${p.generationFilters?.difficulty || 'Mixed'}</span>
          </div>
        </div>

        <div class="paper-actions">
          <button class="btn btn-primary" onclick="PracticePanel.startPaper('${p._id}')">
            🎯 Take Test
          </button>
          <button class="btn btn-secondary" onclick="PracticePanel.viewResults('${p._id}')">
            📊 View Results
          </button>
        </div>
      </div>
    `).join('');
  }

  // ─── Start Paper (Load Questions) ────────────────────────────
  async function startPaper(paperId) {
    try {
      const response = await fetch(`/api/sls/student/papers/${paperId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load paper');

      const data = await response.json();
      currentPaper = data.data;
      answers = {};
      startTime = new Date();
      isAnswerMode = true;

      renderPaperInterface();
      APP.toast(`Starting Practice Paper ${currentPaper.paperNumber}...`, 'info');
    } catch (error) {
      APP.toast(`Error loading paper: ${error.message}`, 'error');
    }
  }

  // ─── Render Paper Interface ──────────────────────────────────
  function renderPaperInterface() {
    const container = document.getElementById('paper-container');
    if (!container || !currentPaper) return;

    container.innerHTML = `
      <div class="paper-interface">
        <div class="paper-header-bar">
          <div class="paper-info">
            <h2>${currentPaper.paperTitle || `Practice Paper ${currentPaper.paperNumber}`}</h2>
            <p>${currentPaper.totalMarks} Marks | ${currentPaper.totalQuestions} Questions</p>
          </div>
          <div class="timer">
            <span id="timer-display">${currentPaper.timeLimit}:00</span>
            <p>Time Left</p>
          </div>
        </div>

        <div class="questions-container">
          ${currentPaper.questions.map((q, idx) => `
            <div class="question-block" data-question-id="${q.questionId}">
              <div class="question-number">
                Q${idx + 1}. (${q.marks} marks)
              </div>

              <div class="question-content">
                <h4>${q.questionText?.english || 'Question ' + (idx + 1)}</h4>
                ${q.questionDiagrams && q.questionDiagrams.length > 0 ? `
                  <div class="diagrams">
                    ${q.questionDiagrams.map(d => `
                      <img src="${d.url}" alt="${d.caption}" class="diagram" />
                      ${d.caption ? `<p class="caption">${d.caption}</p>` : ''}
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              <div class="answer-input">
                ${['numerical', 'short_answer', 'long_answer'].includes(q.questionType) ? `
                  <textarea
                    id="answer-${q.questionId}"
                    placeholder="Write your answer here..."
                    class="answer-textarea"
                    data-question-id="${q.questionId}"
                  ></textarea>
                ` : q.questionType === 'mcq' ? `
                  <div class="mcq-options">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                      <label class="mcq-option">
                        <input type="radio" name="q-${q.questionId}" value="${opt}" />
                        <span>${opt}</span>
                      </label>
                    `).join('')}
                  </div>
                ` : `
                  <textarea
                    id="answer-${q.questionId}"
                    placeholder="Write your answer here..."
                    class="answer-textarea"
                    data-question-id="${q.questionId}"
                  ></textarea>
                `}
              </div>

              <div class="question-status">
                <span class="status-label">Status:</span>
                <span class="status-value" id="status-${q.questionId}">Not Attempted</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="paper-footer">
          <button class="btn btn-secondary" id="btn-back-to-papers">← Back</button>
          <button class="btn btn-primary btn-large" id="btn-submit-answers">
            ✓ Submit Answers
          </button>
        </div>
      </div>
    `;

    // Setup answer tracking
    setupAnswerTracking();

    // Start timer
    startTimer();
  }

  // ─── Setup Answer Tracking ──────────────────────────────────
  function setupAnswerTracking() {
    document.querySelectorAll('.answer-textarea').forEach(el => {
      el.addEventListener('input', (e) => {
        const questionId = e.target.dataset.questionId;
        answers[questionId] = e.target.value;

        // Update status
        const statusEl = document.getElementById(`status-${questionId}`);
        if (statusEl) {
          statusEl.textContent = e.target.value ? '✓ Attempted' : 'Not Attempted';
        }
      });
    });

    // MCQ tracking
    document.querySelectorAll('input[type="radio"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const questionId = e.target.name.replace('q-', '');
        answers[questionId] = e.target.value;

        const statusEl = document.getElementById(`status-${questionId}`);
        if (statusEl) {
          statusEl.textContent = '✓ Attempted';
        }
      });
    });
  }

  // ─── Start Timer ─────────────────────────────────────────────
  function startTimer() {
    const display = document.getElementById('timer-display');
    const endTime = new Date(startTime.getTime() + currentPaper.timeLimit * 60 * 1000);

    const timerInterval = setInterval(() => {
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        clearInterval(timerInterval);
        submitAnswers();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (display) {
        display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Warn when time is running out
        if (diff < 60000) {
          display.style.color = '#ff4444';
        }
      }
    }, 1000);
  }

  // ─── Submit Answers ──────────────────────────────────────────
  async function submitAnswers() {
    if (!currentPaper) return;

    try {
      const endTime = new Date();
      const timeSpent = Math.round((endTime - startTime) / 1000 / 60);

      const answersList = currentPaper.questions.map(q => ({
        questionId: q.questionId,
        marks: q.marks,
        answer: {
          text: answers[q.questionId] || ''
        }
      }));

      const response = await fetch(`/api/sls/student/papers/${currentPaper._id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          studentId: getStudentId(),
          studentCode: getStudentCode(),
          answers: answersList,
          startTime,
          timeSpent
        })
      });

      if (!response.ok) throw new Error('Failed to submit answers');

      const data = await response.json();
      currentAttempt = data.data;

      APP.toast('Answers submitted successfully! ✓', 'success');
      showResultsSummary();
    } catch (error) {
      APP.toast(`Error submitting answers: ${error.message}`, 'error');
    }
  }

  // ─── Show Results Summary ────────────────────────────────────
  function showResultsSummary() {
    const container = document.getElementById('paper-container');
    if (!container) return;

    container.innerHTML = `
      <div class="results-summary">
        <div class="results-header">
          <h2>✓ Answers Submitted</h2>
          <p>Your paper has been submitted for evaluation</p>
        </div>

        <div class="attempt-details">
          <div class="detail-row">
            <span>Paper:</span>
            <span>${currentPaper.paperTitle || `Paper ${currentPaper.paperNumber}`}</span>
          </div>
          <div class="detail-row">
            <span>Total Questions:</span>
            <span>${currentPaper.totalQuestions}</span>
          </div>
          <div class="detail-row">
            <span>Attempted:</span>
            <span>${Object.keys(answers).filter(k => answers[k]).length}</span>
          </div>
          <div class="detail-row">
            <span>Status:</span>
            <span class="badge badge-submitted">Submitted - Awaiting Evaluation</span>
          </div>
        </div>

        <div class="next-steps">
          <h4>What's Next?</h4>
          <ul>
            <li>Your teacher will evaluate your answers</li>
            <li>You'll receive marks and feedback</li>
            <li>Check your dashboard for results</li>
            <li>Review model answers and weak areas</li>
          </ul>
        </div>

        <div class="actions">
          <button class="btn btn-primary" onclick="PracticePanel.loadPapers()">
            ← Back to Papers
          </button>
        </div>
      </div>
    `;
  }

  // ─── View Results (After Evaluation) ─────────────────────────
  async function viewResults(attemptId) {
    try {
      const response = await fetch(`/api/sls/student/attempts/${attemptId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load attempt');

      const data = await response.json();
      currentAttempt = data.data;

      renderResultsView();
    } catch (error) {
      APP.toast(`Error loading results: ${error.message}`, 'error');
    }
  }

  // ─── Render Results View ─────────────────────────────────────
  function renderResultsView() {
    const container = document.getElementById('paper-container');
    if (!container || !currentAttempt) return;

    container.innerHTML = `
      <div class="results-view">
        <div class="results-header">
          <h2>📊 Practice Paper Results</h2>
          <div class="score-display">
            <div class="score-box">
              <span class="score-value">${currentAttempt.totalMarksObtained}/${currentAttempt.totalMarks}</span>
              <span class="score-percentage">${currentAttempt.percentage}%</span>
              <span class="grade">Grade: ${currentAttempt.grade}</span>
            </div>
          </div>
        </div>

        <div class="attempt-info">
          <div class="info-row">
            <span>Date:</span>
            <span>${new Date(currentAttempt.created_at).toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span>Time Spent:</span>
            <span>${currentAttempt.timeSpent} minutes</span>
          </div>
          <div class="info-row">
            <span>Questions Attempted:</span>
            <span>${currentAttempt.questionsAttempted}/${currentAttempt.totalQuestions}</span>
          </div>
          <div class="info-row">
            <span>Correct:</span>
            <span>${currentAttempt.correctAnswers} | Partial: ${currentAttempt.partialAnswers}</span>
          </div>
        </div>

        <div class="performance-analysis">
          ${currentAttempt.weakAreas && currentAttempt.weakAreas.length > 0 ? `
            <div class="weak-areas">
              <h4>⚠️ Areas to Focus</h4>
              ${currentAttempt.weakAreas.map(w => `
                <div class="area-item">
                  <span>${w.type}</span>
                  <span class="percentage">${w.performancePercentage.toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${currentAttempt.strongAreas && currentAttempt.strongAreas.length > 0 ? `
            <div class="strong-areas">
              <h4>✓ Strong Areas</h4>
              ${currentAttempt.strongAreas.map(s => `
                <div class="area-item">
                  <span>${s.type}</span>
                  <span class="percentage">${s.performancePercentage.toFixed(1)}%</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        ${currentAttempt.evaluationNotes ? `
          <div class="teacher-feedback">
            <h4>👨‍🏫 Teacher's Feedback</h4>
            <p>${currentAttempt.evaluationNotes}</p>
          </div>
        ` : ''}

        <div class="actions">
          <button class="btn btn-secondary" onclick="PracticePanel.loadPapers()">
            ← Back to Papers
          </button>
        </div>
      </div>
    `;
  }

  // ─── Helper: Get Token ───────────────────────────────────────
  function getToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
  }

  // ─── Helper: Get Student ID ──────────────────────────────────
  function getStudentId() {
    return localStorage.getItem('studentId') || localStorage.getItem('user_id') || 'unknown';
  }

  // ─── Helper: Get Student Code ────────────────────────────────
  function getStudentCode() {
    return localStorage.getItem('studentCode') || localStorage.getItem('student_code') || 'UNKNOWN';
  }

  // ─── Public API ──────────────────────────────────────────────
  return {
    init,
    startPaper,
    submitAnswers,
    viewResults,
    loadPapers
  };
})();

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  PracticePanel.init();
});
