# SLS v2 — Marks + Question Bank + Practice Papers

**Current Date**: 2026-06-30  
**Implementation**: Smart, Phased, Zero-Breaking-Changes  
**Scope**: Add Marks to Concepts, Question Bank, Practice Paper Generation

---

## **PHASE 1: DATABASE SCHEMA UPDATES (Week 1)**

### **1.1: Update Concept Schema - Add Marks**

```javascript
// In Concept.js - ADD NEW FIELD

marks: {
  type: [
    {
      markType: {
        type: String,
        enum: ['1mark', '2marks', '3marks', '4marks', '5marks', 'viva', 'practical', 'mcq'],
        required: true
      },
      isSelected: {
        type: Boolean,
        default: false
      }
    }
  ],
  default: []
}

// Example:
{
  marks: [
    { markType: '2marks', isSelected: true },
    { markType: '3marks', isSelected: true },
    { markType: '5marks', isSelected: false }
  ]
}
```

### **1.2: Create Question Schema - NEW COLLECTION**

```javascript
// File: TeachingBoard-backend/src/models/Question.js

const questionSchema = new mongoose.Schema({
  conceptId: {
    type: String,
    required: true,
    index: true
  },
  
  chapterId: {
    type: String,
    required: true,
    index: true
  },
  
  // Question Details
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  
  answerText: {
    type: String,
    required: true
  },
  
  // Marks & Difficulty
  marks: {
    type: String,
    enum: ['1', '2', '3', '4', '5', 'viva', 'practical'],
    required: true,
    index: true
  },
  
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy',
    index: true
  },
  
  // Question Type
  questionType: {
    type: String,
    enum: ['definition', 'short-answer', 'long-answer', 'numerical', 'diagram', 'theory', 'mcq', 'viva', 'practical'],
    default: 'short-answer',
    index: true
  },
  
  // Board Frequency
  boardFrequency: {
    type: String,
    enum: ['frequently-asked', 'important', 'rarely-asked', 'once-asked'],
    default: 'important'
  },
  
  // Diagram Support
  diagramUrl: String,
  hasDiagram: Boolean,
  
  // Keywords for Matching
  keywords: [String],
  
  // Usage Tracking
  usageCount: {
    type: Number,
    default: 0
  },
  
  usedInPapers: [
    {
      paperIds: String,
      generatedAt: Date
    }
  ],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  
  createdBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
  strict: 'throw'
});

questionSchema.index({ conceptId: 1, marks: 1 });
questionSchema.index({ chapterId: 1, difficulty: 1 });
questionSchema.index({ questionType: 1 });
```

### **1.3: Create PracticePaper Schema - NEW COLLECTION**

```javascript
// File: TeachingBoard-backend/src/models/PracticePaper.js

const practicePaperSchema = new mongoose.Schema({
  paperNumber: {
    type: String,
    required: true
  },
  
  chapterId: {
    type: String,
    required: true,
    index: true
  },
  
  // Paper Details
  totalMarks: {
    type: Number,
    required: true
  },
  
  totalQuestions: {
    type: Number,
    required: true
  },
  
  timeLimit: {
    type: Number, // in minutes
    default: 30
  },
  
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed'
  },
  
  // Questions in Paper
  questions: [
    {
      questionId: String,
      marks: String,
      order: Number
    }
  ],
  
  // Generation Filters Applied
  filters: {
    onlyDiagrams: Boolean,
    onlyNumericals: Boolean,
    onlyTheory: Boolean,
    onlyDefinitions: Boolean,
    onlyBoardQuestions: Boolean,
    onlyImportantQuestions: Boolean
  },
  
  // Marks Breakdown
  marksBreakdown: {
    '1mark': { target: Number, actual: Number },
    '2marks': { target: Number, actual: Number },
    '3marks': { target: Number, actual: Number },
    '4marks': { target: Number, actual: Number },
    '5marks': { target: Number, actual: Number },
    'viva': { target: Number, actual: Number },
    'practical': { target: Number, actual: Number }
  },
  
  // Teacher Copy vs Student Copy
  showAnswersInPaper: Boolean, // true = teacher copy
  
  // Download Formats Available
  availableFormats: ['pdf', 'docx'],
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  
  createdBy: String,
  createdAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
  strict: 'throw'
});

practicePaperSchema.index({ chapterId: 1, createdAt: -1 });
```

### **1.4: Create StudentPaperAttempt Schema - NEW COLLECTION**

```javascript
// File: TeachingBoard-backend/src/models/StudentPaperAttempt.js

const studentPaperAttemptSchema = new mongoose.Schema({
  studentCode: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  
  paperId: {
    type: String,
    required: true,
    index: true
  },
  
  // Attempt Details
  attemptNumber: Number,
  startedAt: Date,
  submittedAt: Date,
  
  // Answers
  answers: [
    {
      questionId: String,
      studentAnswer: String,
      marksAwarded: Number,
      feedback: String,
      isCorrect: Boolean
    }
  ],
  
  // Scoring
  totalMarksObtained: Number,
  totalMarksAllotted: Number,
  percentage: Number,
  grade: String,
  
  // Status
  status: {
    type: String,
    enum: ['in-progress', 'submitted', 'evaluated'],
    default: 'in-progress'
  },
  
  evaluatedBy: String,
  evaluatedAt: Date,
  
  createdAt: { type: Date, default: Date.now }
}, {
  versionKey: false,
  strict: 'throw'
});

studentPaperAttemptSchema.index({ studentCode: 1, paperId: 1 });
```

---

## **PHASE 2: BACKEND API ENDPOINTS (Week 1-2)**

### **2.1: Question Management Endpoints**

```
ADMIN ROUTES: /api/admin/sls/questions

✅ POST   /                          - Create question
✅ GET    /:questionId               - Get question
✅ PATCH  /:questionId               - Update question
✅ DELETE /:questionId               - Delete question
✅ GET    /concept/:conceptId        - List questions in concept
✅ POST   /bulk-create               - Bulk upload questions (CSV)

STUDENT ROUTES: /api/sls/questions

✅ GET    /concept/:conceptId/random  - Get random question
✅ GET    /concept/:conceptId/all     - Get all questions (practice)
```

### **2.2: Practice Paper Endpoints**

```
ADMIN ROUTES: /api/admin/sls/papers

✅ POST   /                           - Create practice paper (manual)
✅ POST   /generate                   - Generate auto (smart system)
✅ GET    /:paperId                   - Get paper details
✅ PATCH  /:paperId                   - Update paper
✅ DELETE /:paperId                   - Delete paper
✅ GET    /chapter/:chapterId         - List papers in chapter
✅ POST   /:paperId/download/pdf      - Download as PDF
✅ POST   /:paperId/download/docx     - Download as DOCX
✅ POST   /:paperId/answer-key        - Generate answer sheet

STUDENT ROUTES: /api/sls/papers

✅ GET    /chapter/:chapterId         - List available papers
✅ POST   /:paperId/start             - Start practice paper
✅ POST   /:paperId/submit            - Submit answers
✅ GET    /:paperId/result            - View results
✅ GET    /:paperId/attempt/:id       - View previous attempt
```

### **2.3: Smart Paper Generation Algorithm**

```javascript
// File: TeachingBoard-backend/src/engine/PaperGenerator.js

class PaperGenerator {
  async generatePaper(config) {
    const {
      chapterId,
      totalMarks,
      difficulty,
      filters,
      paperNumber
    } = config;
    
    // Step 1: Fetch all published questions
    const allQuestions = await Question.find({
      chapterId,
      status: 'published'
    }).lean();
    
    // Step 2: Apply filters
    let filteredQuestions = this._applyFilters(allQuestions, filters);
    
    // Step 3: Sort by usage count (prefer less used)
    filteredQuestions = filteredQuestions.sort((a, b) => 
      a.usageCount - b.usageCount
    );
    
    // Step 4: Calculate marks distribution needed
    const marksTarget = this._calculateMarksDistribution(totalMarks);
    
    // Step 5: Select questions to match marks
    const selectedQuestions = this._selectQuestions(
      filteredQuestions,
      marksTarget,
      difficulty
    );
    
    // Step 6: Create paper
    const paper = await PracticePaper.create({
      paperNumber,
      chapterId,
      totalMarks,
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions,
      marksBreakdown: marksTarget
    });
    
    // Step 7: Update usage count
    await this._updateUsageCount(selectedQuestions, paper._id);
    
    return paper;
  }
  
  _applyFilters(questions, filters) {
    if (filters.onlyDiagrams) {
      questions = questions.filter(q => q.hasDiagram);
    }
    if (filters.onlyNumericals) {
      questions = questions.filter(q => q.questionType === 'numerical');
    }
    if (filters.onlyTheory) {
      questions = questions.filter(q => 
        ['theory', 'long-answer', 'short-answer'].includes(q.questionType)
      );
    }
    if (filters.onlyDefinitions) {
      questions = questions.filter(q => q.questionType === 'definition');
    }
    if (filters.onlyBoardQuestions) {
      questions = questions.filter(q => 
        q.boardFrequency !== 'rarely-asked'
      );
    }
    if (filters.onlyImportantQuestions) {
      questions = questions.filter(q => 
        ['important', 'frequently-asked'].includes(q.boardFrequency)
      );
    }
    return questions;
  }
  
  _calculateMarksDistribution(totalMarks) {
    // Example: For 20 marks with mixed difficulty
    // 2 x 1mark = 2
    // 2 x 2marks = 4
    // 2 x 3marks = 6
    // 2 x 4marks = 8
    // Total = 20
    
    const distribution = {
      '1mark': { target: Math.ceil(totalMarks * 0.10), actual: 0 },
      '2marks': { target: Math.ceil(totalMarks * 0.20), actual: 0 },
      '3marks': { target: Math.ceil(totalMarks * 0.30), actual: 0 },
      '4marks': { target: Math.ceil(totalMarks * 0.20), actual: 0 },
      '5marks': { target: Math.ceil(totalMarks * 0.20), actual: 0 }
    };
    
    return distribution;
  }
  
  _selectQuestions(questions, marksTarget, difficulty) {
    const selected = [];
    const marksTracker = { ...marksTarget };
    
    // Group questions by marks
    const questionsByMarks = {};
    ['1mark', '2marks', '3marks', '4marks', '5marks'].forEach(m => {
      questionsByMarks[m] = questions.filter(q => q.marks === m);
    });
    
    // Select questions to match target marks
    for (const [markType, target] of Object.entries(marksTarget)) {
      let needed = target.target;
      let count = 0;
      
      if (questionsByMarks[markType]) {
        for (const q of questionsByMarks[markType]) {
          if (count < needed) {
            selected.push({
              questionId: q._id,
              marks: q.marks,
              order: selected.length + 1
            });
            marksTracker[markType].actual += 1;
            count++;
          }
        }
      }
    }
    
    return selected;
  }
  
  async _updateUsageCount(selectedQuestions, paperId) {
    const questionIds = selectedQuestions.map(q => q.questionId);
    
    await Question.updateMany(
      { _id: { $in: questionIds } },
      {
        $inc: { usageCount: 1 },
        $push: {
          usedInPapers: {
            paperIds: paperId,
            generatedAt: new Date()
          }
        }
      }
    );
  }
}

module.exports = new PaperGenerator();
```

---

## **PHASE 3: ADMIN PANEL UPDATES (Week 2)**

### **3.1: Update Concept Editor - Add Marks Selection**

```javascript
// In conceptManager.js - ADD MARKS SELECTION UI

function _renderMarksSelection() {
  const marksOptions = [
    { value: '1mark', label: '1 Mark' },
    { value: '2marks', label: '2 Marks' },
    { value: '3marks', label: '3 Marks' },
    { value: '4marks', label: '4 Marks' },
    { value: '5marks', label: '5 Marks' },
    { value: 'viva', label: 'Viva' },
    { value: 'practical', label: 'Practical' },
    { value: 'mcq', label: 'MCQ' }
  ];
  
  const selectedMarks = _currentConcept.marks || [];
  
  const html = `
    <div class="editor-section">
      <h3>Exam Marks</h3>
      <div class="marks-checkboxes">
        ${marksOptions.map(mark => `
          <label class="checkbox-label">
            <input type="checkbox" value="${mark.value}" 
                   ${selectedMarks.some(m => m.markType === mark.value) ? 'checked' : ''}
                   onchange="CONCEPT_MANAGER._toggleMark('${mark.value}', this.checked)">
            ☐ ${mark.label}
          </label>
        `).join('')}
      </div>
    </div>
  `;
  
  return html;
}

function _toggleMark(markType, isChecked) {
  if (!_currentConcept.marks) {
    _currentConcept.marks = [];
  }
  
  const index = _currentConcept.marks.findIndex(m => m.markType === markType);
  
  if (isChecked && index === -1) {
    _currentConcept.marks.push({ markType, isSelected: true });
  } else if (!isChecked && index !== -1) {
    _currentConcept.marks.splice(index, 1);
  }
}
```

### **3.2: New Admin Module - Question Manager**

```javascript
// File: admin-app/questionManager.js (800+ lines)

const QUESTION_MANAGER = (() => {
  const $ = id => document.getElementById(id);
  
  let state = {
    batch: '',
    subject: '',
    chapter: '',
    chapterId: '',
    concept: '',
    conceptId: '',
    questions: [],
    currentQuestion: null,
    initialized: false
  };
  
  async function init() {
    if (state.initialized) return;
    state.initialized = true;
    
    _setupEventListeners();
    _populateBatches();
  }
  
  function _setupEventListeners() {
    $('qm-batch-sel')?.addEventListener('change', e => _onBatchChange(e.target.value));
    $('qm-subject-sel')?.addEventListener('change', e => _onSubjectChange(e.target.value));
    $('qm-chapter-sel')?.addEventListener('change', e => _onChapterChange(e.target.value));
    $('qm-concept-sel')?.addEventListener('change', e => _onConceptChange(e.target.value));
    $('qm-new-btn')?.addEventListener('click', () => _createNewQuestion());
    $('qm-save-btn')?.addEventListener('click', () => _saveQuestion());
    $('qm-bulk-upload-btn')?.addEventListener('click', () => _showBulkUpload());
  }
  
  async function _onConceptChange(conceptId) {
    state.conceptId = conceptId;
    
    if (!conceptId) {
      state.questions = [];
      _renderQuestionsList([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/sls/questions/concept/${conceptId}`);
      if (!response.ok) throw new Error('Failed to load questions');
      
      const data = await response.json();
      state.questions = data.data;
      _renderQuestionsList(state.questions);
    } catch (err) {
      console.error('Failed to load questions:', err);
      APP.toast('Failed to load questions', 'error');
    }
  }
  
  function _createNewQuestion() {
    if (!state.conceptId) {
      APP.toast('Please select a concept first', 'info');
      return;
    }
    
    state.currentQuestion = {
      _id: null,
      conceptId: state.conceptId,
      chapterId: state.chapterId,
      questionText: '',
      answerText: '',
      marks: '2',
      difficulty: 'easy',
      questionType: 'short-answer',
      hasDiagram: false,
      status: 'draft'
    };
    
    _renderQuestionForm();
  }
  
  function _renderQuestionForm() {
    const q = state.currentQuestion;
    const form = $('qm-form');
    
    form.innerHTML = `
      <div class="form-group">
        <label>Question *</label>
        <textarea id="qm-question" class="form-textarea" placeholder="Enter question">${q.questionText}</textarea>
      </div>
      
      <div class="form-group">
        <label>Answer *</label>
        <textarea id="qm-answer" class="form-textarea" placeholder="Enter answer">${q.answerText}</textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Marks *</label>
          <select id="qm-marks" class="form-select">
            <option value="1" ${q.marks === '1' ? 'selected' : ''}>1 Mark</option>
            <option value="2" ${q.marks === '2' ? 'selected' : ''}>2 Marks</option>
            <option value="3" ${q.marks === '3' ? 'selected' : ''}>3 Marks</option>
            <option value="4" ${q.marks === '4' ? 'selected' : ''}>4 Marks</option>
            <option value="5" ${q.marks === '5' ? 'selected' : ''}>5 Marks</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Difficulty</label>
          <select id="qm-difficulty" class="form-select">
            <option value="easy" ${q.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
            <option value="medium" ${q.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="hard" ${q.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Type</label>
          <select id="qm-type" class="form-select">
            <option value="definition">Definition</option>
            <option value="short-answer">Short Answer</option>
            <option value="long-answer">Long Answer</option>
            <option value="numerical">Numerical</option>
            <option value="diagram">Diagram</option>
            <option value="theory">Theory</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" id="qm-has-diagram" ${q.hasDiagram ? 'checked' : ''}>
          Has Diagram
        </label>
      </div>
      
      <div class="form-actions">
        <button class="btn btn-secondary" id="qm-cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="qm-save-btn">Save Question</button>
      </div>
    `;
    
    $('qm-cancel-btn')?.addEventListener('click', () => {
      state.currentQuestion = null;
      _renderQuestionsList(state.questions);
    });
    
    $('qm-save-btn')?.addEventListener('click', () => _saveQuestion());
  }
  
  async function _saveQuestion() {
    const q = state.currentQuestion;
    
    q.questionText = $('qm-question').value.trim();
    q.answerText = $('qm-answer').value.trim();
    q.marks = $('qm-marks').value;
    q.difficulty = $('qm-difficulty').value;
    q.questionType = $('qm-type').value;
    q.hasDiagram = $('qm-has-diagram').checked;
    
    if (!q.questionText || !q.answerText) {
      APP.toast('Question and answer are required', 'error');
      return;
    }
    
    try {
      const method = q._id ? 'PATCH' : 'POST';
      const endpoint = q._id 
        ? `/api/admin/sls/questions/${q._id}`
        : '/api/admin/sls/questions';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q)
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      APP.toast(q._id ? 'Question updated!' : 'Question created!', 'success');
      await _onConceptChange(state.conceptId);
    } catch (err) {
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }
  
  function _renderQuestionsList(questions) {
    const list = $('qm-questions-list');
    if (!list) return;
    
    if (!questions.length) {
      list.innerHTML = '<div class="empty-state">No questions yet</div>';
      return;
    }
    
    list.innerHTML = questions.map(q => `
      <div class="question-item">
        <div class="question-content">
          <p class="question-text">${q.questionText.substring(0, 80)}...</p>
          <div class="question-meta">
            <span class="badge marks">Marks: ${q.marks}</span>
            <span class="badge difficulty diff-${q.difficulty}">${q.difficulty}</span>
            <span class="badge type">${q.questionType}</span>
            ${q.hasDiagram ? '<span class="badge">📸 Diagram</span>' : ''}
          </div>
        </div>
        <div class="question-actions">
          <button class="btn-icon" onclick="QUESTION_MANAGER.editQuestion('${q._id}')">✏️</button>
          <button class="btn-icon" onclick="QUESTION_MANAGER.deleteQuestion('${q._id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }
  
  // Bulk upload CSV
  function _showBulkUpload() {
    // CSV format:
    // Question | Answer | Marks | Type | Difficulty
  }
  
  return {
    init,
    editQuestion,
    deleteQuestion
  };
})();
```

### **3.3: New Admin Module - Practice Paper Generator**

```javascript
// File: admin-app/practicepaperGenerator.js (600+ lines)

const PAPER_GENERATOR = (() => {
  const $ = id => document.getElementById(id);
  
  let state = {
    chapterId: '',
    totalMarks: 20,
    difficulty: 'mixed',
    filters: {},
    paperPreview: null
  };
  
  async function init() {
    _setupEventListeners();
  }
  
  function _setupEventListeners() {
    $('pg-chapter-sel')?.addEventListener('change', e => {
      state.chapterId = e.target.value;
    });
    
    $('pg-total-marks')?.addEventListener('change', e => {
      state.totalMarks = parseInt(e.target.value);
    });
    
    $('pg-difficulty-sel')?.addEventListener('change', e => {
      state.difficulty = e.target.value;
    });
    
    // Filters
    $('pg-filter-diagrams')?.addEventListener('change', e => {
      state.filters.onlyDiagrams = e.target.checked;
    });
    
    $('pg-filter-numericals')?.addEventListener('change', e => {
      state.filters.onlyNumericals = e.target.checked;
    });
    
    // Generate button
    $('pg-generate-btn')?.addEventListener('click', () => _generatePaper());
  }
  
  async function _generatePaper() {
    if (!state.chapterId) {
      APP.toast('Please select a chapter', 'info');
      return;
    }
    
    try {
      APP.toast('Generating paper...', 'info');
      
      const response = await fetch('/api/admin/sls/papers/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: state.chapterId,
          totalMarks: state.totalMarks,
          difficulty: state.difficulty,
          filters: state.filters
        })
      });
      
      if (!response.ok) throw new Error('Generation failed');
      
      const data = await response.json();
      state.paperPreview = data.data;
      
      _renderPaperPreview();
      APP.toast('Paper generated!', 'success');
    } catch (err) {
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }
  
  function _renderPaperPreview() {
    const paper = state.paperPreview;
    const preview = $('pg-preview');
    
    preview.innerHTML = `
      <div class="paper-preview">
        <div class="paper-header">
          <h2>Practice Paper ${paper.paperNumber}</h2>
          <p>Total Marks: ${paper.totalMarks} | Questions: ${paper.totalQuestions}</p>
        </div>
        
        <div class="paper-questions">
          ${paper.questions.map((q, idx) => `
            <div class="preview-question">
              <p><strong>${idx + 1}.</strong> ${q.question}</p>
              <span class="marks">(${q.marks})</span>
            </div>
          `).join('')}
        </div>
        
        <div class="paper-actions">
          <button class="btn btn-secondary" onclick="PAPER_GENERATOR.regenerate()">Generate Again</button>
          <button class="btn btn-primary" onclick="PAPER_GENERATOR.savePaper()">Save Paper</button>
        </div>
      </div>
    `;
  }
  
  async function savePaper() {
    // Save paper to database
  }
  
  return {
    init,
    savePaper,
    regenerate: _generatePaper
  };
})();
```

---

## **PHASE 4: STUDENT APP UPDATES (Week 2-3)**

### **4.1: New Student Flow - Practice Section**

```javascript
// File: student-app/practicePanel.js (600+ lines)

const PRACTICE_PANEL = (() => {
  const $ = id => document.getElementById(id);
  
  let state = {
    chapter: null,
    papers: [],
    currentPaper: null,
    currentQuestion: 0,
    answers: {},
    startTime: null
  };
  
  async function init() {
    _setupEventListeners();
  }
  
  async function loadPapers(chapterId) {
    try {
      const response = await fetch(`/api/sls/papers/chapter/${chapterId}`);
      if (!response.ok) throw new Error('Failed to load papers');
      
      const data = await response.json();
      state.papers = data.data;
      _renderPapersList();
    } catch (err) {
      APP.toast('Failed to load papers', 'error');
    }
  }
  
  async function startPaper(paperId) {
    try {
      const response = await fetch(`/api/sls/papers/${paperId}/start`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to start paper');
      
      const data = await response.json();
      state.currentPaper = data.data;
      state.startTime = Date.now();
      state.answers = {};
      state.currentQuestion = 0;
      
      _renderPaperPlayer();
    } catch (err) {
      APP.toast('Failed to start paper', 'error');
    }
  }
  
  function _renderPaperPlayer() {
    const paper = state.currentPaper;
    const question = paper.questions[state.currentQuestion];
    
    const html = `
      <div class="paper-player">
        <div class="paper-header">
          <div>Question ${state.currentQuestion + 1} of ${paper.totalQuestions}</div>
          <div class="marks">Marks: ${question.marks}</div>
          <div id="timer">Time: ${_getTimeRemaining()}</div>
        </div>
        
        <div class="question-section">
          <p class="question-text">${question.question}</p>
          ${question.diagramUrl ? `<img src="${question.diagramUrl}" alt="Diagram">` : ''}
        </div>
        
        <div class="answer-section">
          <textarea id="student-answer" placeholder="Write your answer..." 
                    value="${state.answers[question._id] || ''}"></textarea>
        </div>
        
        <div class="paper-actions">
          <button class="btn" onclick="PRACTICE_PANEL.previousQuestion()" 
                  ${state.currentQuestion === 0 ? 'disabled' : ''}>← Previous</button>
          <button class="btn" onclick="PRACTICE_PANEL.nextQuestion()">Next →</button>
          <button class="btn btn-danger" onclick="PRACTICE_PANEL.submitPaper()">Submit Paper</button>
        </div>
      </div>
    `;
    
    $('practice-container').innerHTML = html;
  }
  
  function nextQuestion() {
    // Save current answer
    const question = state.currentPaper.questions[state.currentQuestion];
    state.answers[question._id] = $('student-answer').value;
    
    if (state.currentQuestion < state.currentPaper.questions.length - 1) {
      state.currentQuestion++;
      _renderPaperPlayer();
    }
  }
  
  async function submitPaper() {
    if (!confirm('Are you sure? You cannot change answers after submission.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sls/papers/${state.currentPaper._id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: state.answers,
          timeTaken: Math.floor((Date.now() - state.startTime) / 1000)
        })
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      const data = await response.json();
      _renderResults(data.data);
    } catch (err) {
      APP.toast(`Error: ${err.message}`, 'error');
    }
  }
  
  function _renderResults(result) {
    const html = `
      <div class="results-panel">
        <h2>Your Results</h2>
        <div class="score-box">
          <div class="score-display">${result.totalMarksObtained}/${result.totalMarksAllotted}</div>
          <div class="percentage">${result.percentage}%</div>
          <div class="grade">${result.grade}</div>
        </div>
        
        <div class="detailed-results">
          ${result.answers.map((ans, idx) => `
            <div class="answer-review">
              <p><strong>Q${idx + 1}:</strong> ${ans.question}</p>
              <p><strong>Your Answer:</strong> ${ans.studentAnswer}</p>
              <p><strong>Model Answer:</strong> ${ans.modelAnswer}</p>
              <p><strong>Marks:</strong> ${ans.marksAwarded}/${ans.totalMarks}</p>
              <p><strong>Feedback:</strong> ${ans.feedback}</p>
            </div>
          `).join('')}
        </div>
        
        <div class="actions">
          <button class="btn" onclick="PRACTICE_PANEL.backToPapers()">Back to Papers</button>
        </div>
      </div>
    `;
    
    $('practice-container').innerHTML = html;
  }
  
  return {
    init,
    loadPapers,
    startPaper,
    nextQuestion,
    submitPaper,
    previousQuestion: () => {
      if (state.currentQuestion > 0) {
        state.currentQuestion--;
        _renderPaperPlayer();
      }
    }
  };
})();
```

---

## **PHASE 5: ADMIN UI INTEGRATION (Week 3)**

### **5.1: Update admin.html**

Add two new tabs:

```html
<!-- Question Manager Tab -->
<button class="atab" role="tab" data-tab="questions">
  <span class="atab-icon">❓</span>
  <span class="atab-label">Questions</span>
</button>

<!-- Practice Papers Tab -->
<button class="atab" role="tab" data-tab="practice-papers">
  <span class="atab-icon">📄</span>
  <span class="atab-label">Practice Papers</span>
</button>

<!-- Question Manager Content -->
<div class="atab-content hidden" id="atab-questions">
  <!-- Question manager UI -->
</div>

<!-- Practice Papers Content -->
<div class="atab-content hidden" id="atab-practice-papers">
  <!-- Paper generator UI -->
</div>
```

### **5.2: Update admin.js**

```javascript
// Add initialization for new modules
if (tab.dataset.tab === 'questions')          window.QUESTION_MANAGER?.init();
if (tab.dataset.tab === 'practice-papers')    window.PAPER_GENERATOR?.init();
```

---

## **PHASE 6: STUDENT APP INTEGRATION (Week 3)**

### **6.1: Update index.html - Add Practice Screen**

```html
<!-- Practice Papers Screen -->
<section id="screen-practice" class="screen hidden" aria-label="Practice Papers">
  <div id="practice-container"></div>
</section>
```

### **6.2: Update ui.js - Add Navigation**

```javascript
// Add button to access practice from chapter screen
document.getElementById('btn-practice')?.addEventListener('click', () => {
  APP.navigateTo('practice', { chapterId: currentChapter });
});
```

---

## **IMPLEMENTATION TIMELINE**

```
Week 1 (Database & Backend API)
  Day 1-2: Schema updates + models created
  Day 3-4: API endpoints implemented
  Day 5: Testing & debugging

Week 2 (Admin Panel)
  Day 1-2: Question Manager module
  Day 3-4: Paper Generator module
  Day 5: Integration & testing

Week 3 (Student App & Polish)
  Day 1-2: Practice Panel module
  Day 3-4: UI integration
  Day 5: Full testing

Total: 15 Days
Team: 1 Backend Dev + 1 Frontend Dev
```

---

## **FEATURES AT A GLANCE**

✅ **Concept-to-Question Linking**: Questions stored per concept
✅ **Auto Paper Generation**: Smart algorithm picks less-used questions
✅ **Marks Distribution**: Automatic marks calculation (no manual math)
✅ **Usage Tracking**: Every question tracked (prevents repetition)
✅ **Multiple Formats**: PDF & DOCX download
✅ **Teacher & Student Copies**: Answer key included
✅ **Student Practice Flow**: Attempt → Submit → View Results
✅ **Performance Analytics**: See which students struggle
✅ **Unlimited Questions**: No limit on questions per concept
✅ **Question Filters**: By type, difficulty, board frequency, etc.
✅ **Random Generation**: Different paper each time
✅ **Zero Breaking Changes**: Backward compatible with existing system

---

## **DATABASE SCHEMA SUMMARY**

```
Current Collections:
  - Concept (UPDATED: + marks field)
  - ConceptVersion
  - StudentProgress

New Collections:
  + Question (per concept, unlimited)
  + PracticePaper (auto-generated)
  + StudentPaperAttempt (tracking)
  + QuestionUsageLog (optional, for analytics)
```

---

**SMART PLAN READY FOR EXECUTION!** 🚀

