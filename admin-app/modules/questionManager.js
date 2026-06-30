/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Question Manager - SLS Phase 2 Admin Module
 * Manages question bank creation, editing, and publishing
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const QuestionManager = (() => {
  let currentQuestion = null;
  let questionsList = [];
  let filters = {
    conceptId: '',
    marks: '',
    questionType: '',
    difficulty: '',
    boardFrequency: '',
    status: 'published'
  };

  // ─── Initialize Module ───────────────────────────────────────
  function init() {
    setupEventListeners();
    loadQuestions();
  }

  // ─── Setup Event Listeners ───────────────────────────────────
  function setupEventListeners() {
    // Create Question Button
    document.getElementById('btn-new-question')?.addEventListener('click', showCreateForm);

    // Filter Buttons
    document.getElementById('filter-marks')?.addEventListener('change', (e) => {
      filters.marks = e.target.value;
      loadQuestions();
    });

    document.getElementById('filter-type')?.addEventListener('change', (e) => {
      filters.questionType = e.target.value;
      loadQuestions();
    });

    document.getElementById('filter-difficulty')?.addEventListener('change', (e) => {
      filters.difficulty = e.target.value;
      loadQuestions();
    });

    // Save Question Button
    document.getElementById('btn-save-question')?.addEventListener('click', saveQuestion);

    // Upload CSV Button
    document.getElementById('btn-upload-csv')?.addEventListener('click', () => {
      document.getElementById('csv-file-input').click();
    });

    document.getElementById('csv-file-input')?.addEventListener('change', handleCsvUpload);
  }

  // ─── Load Questions from API ────────────────────────────────
  async function loadQuestions() {
    try {
      const params = new URLSearchParams();
      if (filters.conceptId) params.append('conceptId', filters.conceptId);
      if (filters.marks) params.append('marks', filters.marks);
      if (filters.questionType) params.append('questionType', filters.questionType);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      if (filters.status) params.append('status', filters.status);

      const response = await fetch(`/api/sls/admin/questions?${params}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load questions');

      const data = await response.json();
      questionsList = data.data || [];
      renderQuestionsList();
    } catch (error) {
      APP.toast(`Error loading questions: ${error.message}`, 'error');
    }
  }

  // ─── Render Questions List ──────────────────────────────────
  function renderQuestionsList() {
    const container = document.getElementById('questions-list');
    if (!container || questionsList.length === 0) return;

    container.innerHTML = questionsList.map(q => `
      <div class="question-item" data-id="${q._id}">
        <div class="question-preview">
          <strong>${q.questionText.english.substring(0, 80)}...</strong>
          <div class="question-meta">
            <span class="badge marks">${q.marks} marks</span>
            <span class="badge type">${q.questionType}</span>
            <span class="badge difficulty">${q.difficulty}</span>
            <span class="badge status">${q.status}</span>
          </div>
        </div>
        <div class="question-actions">
          <button class="btn-sm" onclick="QuestionManager.editQuestion('${q._id}')">✏️ Edit</button>
          <button class="btn-sm danger" onclick="QuestionManager.deleteQuestion('${q._id}')">🗑️ Delete</button>
          ${q.status === 'draft' ? `<button class="btn-sm" onclick="QuestionManager.publishQuestion('${q._id}')">📤 Publish</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ─── Show Create Form ───────────────────────────────────────
  function showCreateForm() {
    currentQuestion = null;
    document.getElementById('form-title').textContent = 'Create New Question';
    clearForm();
    APP.toast('Ready to create new question', 'info');
  }

  // ─── Edit Question ──────────────────────────────────────────
  async function editQuestion(questionId) {
    try {
      const response = await fetch(`/api/sls/admin/questions/${questionId}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to load question');

      const data = await response.json();
      currentQuestion = data.data;

      populateForm(currentQuestion);
      document.getElementById('form-title').textContent = 'Edit Question';
      APP.toast('Question loaded for editing', 'success');
    } catch (error) {
      APP.toast(`Error loading question: ${error.message}`, 'error');
    }
  }

  // ─── Populate Form ──────────────────────────────────────────
  function populateForm(question) {
    document.getElementById('field-question-en').value = question.questionText.english;
    document.getElementById('field-question-mr').value = question.questionText.marathi || '';
    document.getElementById('field-answer-en').value = question.answerText.english;
    document.getElementById('field-answer-mr').value = question.answerText.marathi || '';
    document.getElementById('field-marks').value = question.marks;
    document.getElementById('field-type').value = question.questionType;
    document.getElementById('field-difficulty').value = question.difficulty;
    document.getElementById('field-board-frequency').value = question.boardFrequency;
  }

  // ─── Clear Form ──────────────────────────────────────────────
  function clearForm() {
    document.getElementById('field-question-en').value = '';
    document.getElementById('field-question-mr').value = '';
    document.getElementById('field-answer-en').value = '';
    document.getElementById('field-answer-mr').value = '';
    document.getElementById('field-marks').value = '1';
    document.getElementById('field-type').value = 'definition';
    document.getElementById('field-difficulty').value = 'easy';
    document.getElementById('field-board-frequency').value = 'important';
  }

  // ─── Save Question ──────────────────────────────────────────
  async function saveQuestion() {
    try {
      const questionData = {
        questionText: {
          english: document.getElementById('field-question-en').value,
          marathi: document.getElementById('field-question-mr').value
        },
        answerText: {
          english: document.getElementById('field-answer-en').value,
          marathi: document.getElementById('field-answer-mr').value
        },
        marks: parseInt(document.getElementById('field-marks').value),
        questionType: document.getElementById('field-type').value,
        difficulty: document.getElementById('field-difficulty').value,
        boardFrequency: document.getElementById('field-board-frequency').value,
        conceptId: document.getElementById('select-concept').value,
        chapterId: document.getElementById('select-chapter').value,
        batchId: document.getElementById('select-batch').value,
        subjectId: document.getElementById('select-subject').value
      };

      const method = currentQuestion ? 'PATCH' : 'POST';
      const url = currentQuestion
        ? `/api/sls/admin/questions/${currentQuestion._id}`
        : '/api/sls/admin/questions';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(questionData)
      });

      if (!response.ok) throw new Error('Failed to save question');

      APP.toast('Question saved successfully!', 'success');
      clearForm();
      loadQuestions();
    } catch (error) {
      APP.toast(`Error saving question: ${error.message}`, 'error');
    }
  }

  // ─── Delete Question ────────────────────────────────────────
  async function deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`/api/sls/admin/questions/${questionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to delete question');

      APP.toast('Question deleted successfully', 'success');
      loadQuestions();
    } catch (error) {
      APP.toast(`Error deleting question: ${error.message}`, 'error');
    }
  }

  // ─── Publish Question ───────────────────────────────────────
  async function publishQuestion(questionId) {
    try {
      const response = await fetch(`/api/sls/admin/questions/${questionId}/publish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) throw new Error('Failed to publish question');

      APP.toast('Question published successfully', 'success');
      loadQuestions();
    } catch (error) {
      APP.toast(`Error publishing question: ${error.message}`, 'error');
    }
  }

  // ─── Handle CSV Upload ──────────────────────────────────────
  async function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target.result;
        const questions = parseCSV(csv);

        for (const q of questions) {
          await saveQuestionFromCSV(q);
        }

        APP.toast(`Successfully uploaded ${questions.length} questions`, 'success');
        loadQuestions();
      } catch (error) {
        APP.toast(`Error uploading CSV: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ─── Parse CSV ──────────────────────────────────────────────
  function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const question = {};

      header.forEach((h, idx) => {
        question[h] = values[idx];
      });

      questions.push(question);
    }

    return questions;
  }

  // ─── Save Question from CSV ─────────────────────────────────
  async function saveQuestionFromCSV(questionData) {
    const payload = {
      conceptId: questionData.concept_id,
      chapterId: questionData.chapter_id,
      batchId: questionData.batch_id,
      subjectId: questionData.subject_id,
      questionText: {
        english: questionData.question_en,
        marathi: questionData.question_mr || ''
      },
      answerText: {
        english: questionData.answer_en,
        marathi: questionData.answer_mr || ''
      },
      marks: parseInt(questionData.marks),
      questionType: questionData.type,
      difficulty: questionData.difficulty,
      boardFrequency: questionData.board_frequency || 'important'
    };

    const response = await fetch('/api/sls/admin/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Failed to save question: ${questionData.question_en}`);
  }

  // ─── Helper: Get Token ───────────────────────────────────────
  function getToken() {
    return localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
  }

  // ─── Public API ──────────────────────────────────────────────
  return {
    init,
    editQuestion,
    deleteQuestion,
    publishQuestion,
    loadQuestions
  };
})();

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  QuestionManager.init();
});
