# Phase 2 - Database Models Summary

## Overview
Phase 2 introduces 4 new MongoDB models to support the Smart Learning System with Practice Papers and Question Banks.

---

## 1. SLSQuestion Model
**File:** `TeachingBoard-backend/src/models/SLSQuestion.js`

### Purpose
Stores all practice questions for a concept with multilingual support, diagrams, and usage tracking.

### Key Fields
```javascript
{
  // Relationship
  conceptId: String (required, indexed),
  chapterId: String (required, indexed),
  subjectId: String,
  batchId: String,

  // Content (Bilingual)
  questionText: {
    english: String,
    marathi: String
  },
  questionDiagrams: [{url, caption, uploadedAt}],

  // Answer (Bilingual)
  answerText: {
    english: String,
    marathi: String
  },
  answerDiagrams: [{url, caption, stepNumber}],

  // Marks & Properties
  marks: Number (enum: 1,2,3,4,5),
  questionType: String (enum: definition, short_answer, long_answer, numerical, diagram, viva, practical, mcq),
  difficulty: String (enum: easy, medium, hard),
  boardFrequency: String (enum: important, frequently_asked, rarely_asked),

  // Usage Tracking
  usageCount: Number,
  usedInPapers: [{paperId, usedDate, studentAttempts, averageScore}],

  // Analytics
  averageStudentScore: Number,
  totalAttempts: Number,
  correctAttempts: Number,

  // Metadata
  status: String (enum: draft, published, archived),
  createdBy: String,
  created_at: Date
}
```

### Indexes
- `{conceptId, marks}`
- `{chapterId, difficulty}`
- `{batchId, status}`
- `{questionType, boardFrequency}`
- `{usageCount, marks}`
- `{status, chapterId}`

---

## 2. PracticePaper Model
**File:** `TeachingBoard-backend/src/models/PracticePaper.js`

### Purpose
Stores generated practice papers with smart algorithm details and performance analytics.

### Key Fields
```javascript
{
  // Basic Info
  chapterId: String (required, indexed),
  batchId: String,
  subjectId: String,

  // Paper Details
  paperNumber: Number,
  paperTitle: String,
  totalMarks: Number,
  totalQuestions: Number,
  timeLimit: Number (default: 60),

  // Questions in Paper
  questions: [{
    questionId: String,
    marks: Number,
    difficulty: String,
    questionType: String,
    displayOrder: Number,
    totalAttempts: Number,
    correctAttempts: Number,
    averageScore: Number
  }],

  // Generation Details
  generationFilters: {
    difficulty: String (enum: easy, medium, hard, mixed),
    questionTypes: [String],
    boardFrequency: [String],
    usageFilters: {
      includeRecent: Boolean,
      includeFrequent: Boolean,
      includeRare: Boolean
    }
  },

  // Marks Breakdown (Algorithm Accuracy)
  marksBreakdown: [{marks, count, totalMarksForThisValue}],

  // PDF Options
  showAnswersInPaper: Boolean,

  // Algorithm Info
  algorithmVersion: String,
  generatedAt: Date,

  // Analytics
  totalAttempts: Number,
  averageScore: Number,
  averageTimeSpent: Number,
  completionRate: Number,

  // Metadata
  status: String (enum: draft, published, archived),
  createdBy: String,
  created_at: Date
}
```

### Indexes
- `{chapterId, paperNumber}`
- `{batchId, status}`
- `{status, created_at}`
- `{questions.questionId}`

---

## 3. StudentPaperAttempt Model
**File:** `TeachingBoard-backend/src/models/StudentPaperAttempt.js`

### Purpose
Tracks student attempts on practice papers, including answers, marks, and performance analysis.

### Key Fields
```javascript
{
  // Basic Info
  paperId: String (required, indexed),
  studentId: String (required, indexed),
  studentCode: String,
  batchId: String,

  // Paper Details
  totalMarks: Number,
  totalQuestions: Number,

  // Student Answers
  answers: [{
    questionId: String,
    marks: Number,
    studentAnswer: {text, diagrams[]},
    marksAwarded: Number,
    maxMarks: Number,
    feedback: String,
    isCorrect: Boolean,
    evaluatedAt: Date,
    evaluatedBy: String
  }],

  // Scoring
  totalMarksObtained: Number,
  percentage: Number,
  grade: String (enum: A+, A, B+, B, C+, C, D, F),

  // Attempt Timeline
  attemptStartTime: Date,
  attemptEndTime: Date,
  timeSpent: Number,

  // Attempt Statistics
  questionsAttempted: Number,
  correctAnswers: Number,
  partialAnswers: Number,

  // Status
  status: String (enum: in_progress, submitted, evaluated, archived),

  // Evaluation
  evaluatedBy: String,
  evaluatedAt: Date,
  evaluationNotes: String,
  autoEvaluated: Boolean,

  // Performance Analysis
  performanceBreakdown: [{
    questionId: String,
    marks: Number,
    awarded: Number,
    percentage: Number,
    difficulty: String,
    questionType: String
  }],

  // Learning Insights
  weakAreas: [{type, category, performancePercentage}],
  strongAreas: [{type, category, performancePercentage}],

  // Metadata
  created_at: Date,
  updated_at: Date
}
```

### Indexes
- `{paperId, studentId}`
- `{batchId, status}`
- `{studentId, status}`
- `{status, created_at}`
- `{paperId, status}`

---

## 4. ConceptMarks Model
**File:** `TeachingBoard-backend/src/models/ConceptMarks.js`

### Purpose
Maps concepts to their assigned marks (1-5) and tracks question availability for smart paper generation algorithm.

### Key Fields
```javascript
{
  // Basic Info
  conceptId: String (required, unique, indexed),
  chapterId: String (required, indexed),
  batchId: String,

  // Marks Assignment
  assignedMarks: [Number] (enum: 1,2,3,4,5),

  // Question Availability by Marks
  questionsByMarks: {
    1: Number (count of 1-mark questions),
    2: Number (count of 2-mark questions),
    3: Number (count of 3-mark questions),
    4: Number (count of 4-mark questions),
    5: Number (count of 5-mark questions)
  },

  // Special Question Types
  hasViva: Boolean,
  hasPractical: Boolean,
  hasMCQ: Boolean,

  // Weight for Smart Algorithm
  conceptWeight: Number (default: 1.0),
    // Higher weight = selected more often in papers
    // Lower weight = selected less often
    // Used for balancing curriculum emphasis

  // Metadata
  lastUpdatedBy: String,
  created_at: Date,
  updated_at: Date
}
```

### Indexes
- `{conceptId}`
- `{chapterId}`
- `{batchId}`

---

## How They Work Together

```
Teacher Creates Question (SLSQuestion)
    ↓
    Admin assigns marks to concept (updates ConceptMarks)
    ↓
    Admin generates paper (PracticePaper created)
    ├─ Algorithm reads ConceptMarks
    ├─ Queries SLSQuestion by marks/difficulty
    └─ Creates paper with perfect distribution
    ↓
Student attempts paper (StudentPaperAttempt created)
    ├─ Records answers in progress
    └─ Submits when done
    ↓
Teacher evaluates (updates StudentPaperAttempt)
    └─ Marks awarded → Dashboard sync
```

---

## Example Data Flow

### Creating a Question
```javascript
const question = new SLSQuestion({
  conceptId: 'balanced-force-001',
  chapterId: 'ch-3-force',
  questionText: {
    english: 'Define balanced force',
    marathi: 'संतुलित बल परिभाषित करा'
  },
  answerText: {
    english: 'Two equal and opposite forces...',
    marathi: 'दोन समान आणि विरुद्ध बल...'
  },
  marks: 2,
  questionType: 'definition',
  difficulty: 'easy',
  boardFrequency: 'frequently_asked',
  status: 'published'
});
```

### Generating a Paper (Smart Algorithm)
```javascript
// Algorithm reads ConceptMarks
// For chapter with 20 marks:
// - Need 4x(1-mark), 4x(2-mark), 2x(3-mark), 1x(5-mark)
// - Queries SLSQuestion.find({conceptId, marks: 1, status: 'published'})
// - Weights by usageCount to prevent repetition
// - Returns diverse, non-repeated questions
```

### Recording Student Attempt
```javascript
const attempt = new StudentPaperAttempt({
  paperId: 'paper-05',
  studentId: 'student-001',
  studentCode: 'RAJ123',
  totalMarks: 20,
  answers: [
    {
      questionId: 'q-1',
      studentAnswer: {text: 'Two opposite forces...'},
      // Teacher fills in:
      marksAwarded: 1,
      feedback: 'Good, but add SI units'
    },
    // ... more answers
  ]
  // After all marks awarded:
  status: 'evaluated'
  // → Triggers Dashboard Sync
});
```

---

## Database Optimization Notes

1. **Indexes on frequently queried fields:**
   - `conceptId` (for filtering questions by concept)
   - `batchId` (for multi-batch support)
   - `status` (for filtering draft/published)
   - `created_at` (for sorting by date)

2. **Usage Tracking:**
   - `usageCount` indexed for smart algorithm
   - Prevents repetitive questions in papers

3. **Performance:**
   - All relationship fields are strings (not ObjectIds)
   - Avoids expensive `.populate()` calls
   - Improves sync speed to offline mode

4. **Analytics:**
   - Counters (totalAttempts, correctAttempts) denormalized
   - Avoids aggregation queries for dashboards
   - Real-time stats available

---

## Batch Operations

### Bulk Upload Questions
```
Teacher uploads CSV:
Concept, Question (En), Answer (En), Marks, Type, Difficulty, Board Frequency

↓ API processes each row:
- Creates SLSQuestion document
- Increments ConceptMarks.questionsByMarks[marks]
- Handles duplicates gracefully
```

### Bulk Evaluation
```
Teacher uploads marks CSV:
StudentID, QuestionID, MarksAwarded

↓ API processes:
- Updates StudentPaperAttempt.answers[].marksAwarded
- Recalculates percentage & grade
- Updates StudentPaperAttempt.performanceBreakdown
- Triggers Dashboard Sync
```

---

## Next Steps

1. ✅ Models Created
2. ⏳ API Endpoints (CRUD for all 4 models)
3. ⏳ Smart Paper Generation Algorithm
4. ⏳ Admin Modules (Question Manager, Paper Generator)
5. ⏳ Student Modules (Paper Player, Dashboard)
6. ⏳ Parent Dashboard Integration
7. ⏳ PDF/DOCX Generation
8. ⏳ Notification System
9. ⏳ Dashboard Sync Engine
10. ⏳ CSV Bulk Upload

---

**Status:** Models Complete ✅
**Date:** June 30, 2026
**Ready for:** API Endpoint Development
