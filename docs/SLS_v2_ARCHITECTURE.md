# SLS v2 — Complete Architecture & Data Flow

---

## **DATABASE SCHEMA DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB COLLECTIONS                      │
└─────────────────────────────────────────────────────────────┘

Existing Collections (v1):
┌────────────────────┐    ┌──────────────────────┐
│    Concept         │    │  ConceptVersion      │
├────────────────────┤    ├──────────────────────┤
│ _id                │    │ _id                  │
│ chapterId          │    │ conceptId ──┐        │
│ language           │    │ versionNum  │        │
│ title              │    │ snapshot    │        │
│ description        │    │ changedBy   │        │
│ marks ⭐NEW        │◄───┤ changedAt   │        │
│ status             │    │             │        │
│ createdAt          │    └──────────────────────┘
└────────────────────┘
         │
         │
         ▼
┌────────────────────┐
│     Question ⭐NEW │
├────────────────────┤
│ _id                │
│ conceptId ────────┐│
│ questionText      ││
│ answerText        ││
│ marks (1-5)       ││
│ difficulty        ││
│ questionType      ││
│ hasDiagram        ││
│ usageCount        ││
│ usedInPapers      ││
│ status            ││
│ createdAt         ││
└────────────────────┘│
                      │
                      ▼
            ┌──────────────────────────┐
            │    PracticePaper ⭐NEW  │
            ├──────────────────────────┤
            │ _id                      │
            │ chapterId ───────────────┐
            │ paperNumber              │
            │ totalMarks               │
            │ questions: [{            │
            │   questionId,            │
            │   marks,                 │
            │   order                  │
            │ }]                       │
            │ marksBreakdown           │
            │ filters                  │
            │ createdAt                │
            └──────────────────────────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │ StudentPaperAttempt ⭐NEW    │
        ├──────────────────────────────┤
        │ _id                          │
        │ studentCode                  │
        │ paperId ──────────┐          │
        │ answers: [{       │          │
        │   questionId,     │          │
        │   studentAnswer,  │          │
        │   marksAwarded    │          │
        │ }]                │          │
        │ totalObtained     │          │
        │ submittedAt       │          │
        │ evaluatedBy       │          │
        └──────────────────────────────┘
```

---

## **COMPLETE DATA FLOW**

```
═══════════════════════════════════════════════════════════════════
                        ADMIN WORKFLOW
═══════════════════════════════════════════════════════════════════

STEP 1: CREATE CONCEPT
┌─────────────┐
│ Admin Panel │ ──> POST /api/admin/sls/
└─────────────┘
     │
     ├─ Title: "What is Force?"
     ├─ Content: EditorJS blocks
     ├─ ✅ Marks: [2marks, 3marks] ⭐NEW
     └─ Status: draft
            │
            ▼
     Saved to Concept collection with marks array


STEP 2: CREATE QUESTIONS FOR CONCEPT
┌────────────────────────┐
│ Question Manager Tab   │ ──> POST /api/admin/sls/questions
└────────────────────────┘
     │
     ├─ Q1: "Define Force"
     │   └─ Marks: 2, Difficulty: easy, Type: definition
     │       Stored with conceptId reference
     │
     ├─ Q2: "State SI Unit"
     │   └─ Marks: 1, Difficulty: easy, Type: definition
     │
     ├─ Q3: "Explain Balanced Force"
     │   └─ Marks: 3, Difficulty: medium, Type: long-answer
     │
     ├─ Q4: "Differentiate Balanced vs Unbalanced"
     │   └─ Marks: 5, Difficulty: hard, Type: comparison
     │
     └─ Q5: "Numerical Problem"
         └─ Marks: 4, Difficulty: medium, Type: numerical
                │
                ▼
        Saved to Question collection
        usageCount = 0 (new)


STEP 3: GENERATE PRACTICE PAPER
┌─────────────────────────────┐
│ Practice Paper Generator    │ ──> POST /api/admin/sls/papers/generate
└─────────────────────────────┘
     │
     ├─ Input:
     │   ├─ Chapter: "Force & Motion"
     │   ├─ Total Marks: 20
     │   ├─ Difficulty: Mixed
     │   └─ Filters: None
     │
     ▼ SMART SELECTION ALGORITHM
     ┌─────────────────────────────┐
     │ 1. Fetch all questions      │
     │ 2. Sort by usageCount ⬆     │
     │ 3. Select to match marks:   │
     │    ├─ 2marks × 1 = 2        │
     │    ├─ 3marks × 2 = 6        │
     │    ├─ 5marks × 2 = 10       │
     │    └─ 4marks × 0.5 = 2      │
     │    = 20 Total ✓             │
     │ 4. Check no duplicates      │
     │ 5. Create paper             │
     └─────────────────────────────┘
            │
            ▼
     Paper Created:
     ├─ Q1 (2 marks) - "Define Force"
     ├─ Q3 (3 marks) - "Explain Balanced Force"
     ├─ Q2 (1 mark)  - "State SI Unit"  ← BONUS (total 21)
     ├─ Q4 (5 marks) - "Differentiate..."
     └─ Q5 (4 marks) - "Numerical"
            │
            ▼
     Update usageCount in Question collection:
     Q1: 0→1, Q2: 0→1, Q3: 0→1, Q4: 0→1, Q5: 0→1


STEP 4: DOWNLOAD OPTIONS
┌──────────────────────┐
│ Teacher selects      │
└──────────────────────┘
     │
     ├─ 📋 PDF (with answers)
     │   ├─ Question + Marks
     │   ├─ Model Answer
     │   ├─ Keywords
     │   └─ Answer Sheet
     │
     └─ 📋 PDF (student copy - no answers)
         ├─ Question + Marks
         └─ Space for writing


═══════════════════════════════════════════════════════════════════
                      STUDENT WORKFLOW
═══════════════════════════════════════════════════════════════════

STEP 1: BROWSE CHAPTERS
┌──────────────────┐
│ Student Home     │
└──────────────────┘
     │
     ├─ Chapter List
     └─ Click: "Force & Motion" ──> Load concept list


STEP 2: READ CONCEPT
┌──────────────────────────┐
│ Notes Viewer (v1)        │ ──> GET /api/sls/:conceptId/view
└──────────────────────────┘
     │
     ├─ Full Content (EditorJS blocks)
     ├─ Learning Outcomes
     ├─ Short Notes
     └─ Revision Box
            │
            ▼
     Student reads and understands


STEP 3: PRACTICE QUESTIONS
┌─────────────────────────────┐
│ Practice MCQ (future)       │
└─────────────────────────────┘
     │
     └─ Random question from this concept
        GET /api/sls/questions/concept/:conceptId/random


STEP 4: PRACTICE PAPERS
┌──────────────────────────────┐
│ Practice Papers List         │ ──> GET /api/sls/papers/chapter/:id
└──────────────────────────────┘
     │
     ├─ Practice Paper 01 (20 marks, Mixed)
     ├─ Practice Paper 02 (15 marks, Easy)
     └─ Practice Paper 03 (25 marks, Hard)
            │
            ▼
     Click Paper 01 ──> POST /api/sls/papers/:paperId/start
            │
            ▼
     ┌──────────────────────────────────┐
     │ Practice Paper Player            │
     ├──────────────────────────────────┤
     │ Q1/5: Define Force       (2)     │
     │ [Text input for answer]          │
     │ [Next] [Previous] [Submit]       │
     └──────────────────────────────────┘
            │
            ▼
     Student answers all 5 questions
            │
            ▼
     Click "Submit Paper" ──> POST /api/sls/papers/:paperId/submit
            │
            ▼
     ┌──────────────────────────────────┐
     │ Results Page                     │
     ├──────────────────────────────────┤
     │ Score: 16/20 (80%)               │
     │                                  │
     │ Q1: 2/2 ✓                        │
     │ Q2: 1/1 ✓                        │
     │ Q3: 2/3 (feedback provided)      │
     │ Q4: 5/5 ✓                        │
     │ Q5: 3/4 (calculation error)      │
     │                                  │
     │ [View Model Answers]             │
     │ [Practice Again]                 │
     └──────────────────────────────────┘
```

---

## **API ENDPOINT STRUCTURE**

```
═══════════════════════════════════════════════════════════════════
                    BACKEND API ROUTES
═══════════════════════════════════════════════════════════════════

EXISTING (v1): /api/sls/
├─ GET    /chapters/:id/concepts        [List concepts]
├─ GET    /:conceptId/view              [View published concept]
└─ GET    /search?q=...                 [Search concepts]

NEW (v2): /api/admin/sls/questions
├─ POST   /                             [Create question]
├─ GET    /:questionId                  [Get question]
├─ PATCH  /:questionId                  [Update question]
├─ DELETE /:questionId                  [Delete question]
├─ GET    /concept/:conceptId           [List questions]
└─ POST   /bulk-create                  [Bulk upload CSV]

NEW (v2): /api/admin/sls/papers
├─ POST   /                             [Create manual paper]
├─ POST   /generate                     [Auto-generate paper]
├─ GET    /:paperId                     [Get paper details]
├─ PATCH  /:paperId                     [Update paper]
├─ DELETE /:paperId                     [Delete paper]
├─ GET    /chapter/:chapterId           [List papers in chapter]
├─ POST   /:paperId/download/pdf        [Download PDF]
├─ POST   /:paperId/download/docx       [Download DOCX]
└─ POST   /:paperId/answer-key          [Generate answer sheet]

NEW (v2): /api/sls/papers
├─ GET    /chapter/:chapterId           [List available papers]
├─ POST   /:paperId/start               [Start paper attempt]
├─ POST   /:paperId/submit              [Submit answers]
├─ GET    /:paperId/result/:attemptId   [View results]
└─ GET    /:paperId/attempt/:id         [View previous attempt]
```

---

## **FRONTEND MODULE STRUCTURE**

```
═══════════════════════════════════════════════════════════════════
                      ADMIN PANEL (v2)
═══════════════════════════════════════════════════════════════════

admin.html
├─ Tab: Concepts (v1)
│  └─ conceptManager.js + concept-manager.css
│
├─ Tab: Questions ⭐NEW
│  └─ questionManager.js + question-manager.css
│     ├─ Batch → Subject → Chapter → Concept
│     ├─ Questions list for concept
│     ├─ Create/Edit/Delete questions
│     ├─ Bulk upload CSV
│     ├─ Filters
│     └─ Usage count display
│
├─ Tab: Practice Papers ⭐NEW
│  └─ practicepaperGenerator.js + paper-generator.css
│     ├─ Select chapter
│     ├─ Set total marks
│     ├─ Choose difficulty
│     ├─ Apply filters
│     ├─ Generate paper
│     ├─ Preview
│     ├─ Download (PDF/DOCX)
│     └─ Save to database
│
└─ Other existing tabs...

═══════════════════════════════════════════════════════════════════
                    STUDENT APP (v2)
═══════════════════════════════════════════════════════════════════

index.html
├─ Screen: Home
│  └─ Chapter list + Navigation
│
├─ Screen: Notes Viewer (v1)
│  └─ notesViewer.js + notesViewer.css
│     ├─ 3 Study Modes (Read/Exam/Revision)
│     ├─ Language toggle
│     └─ Attachment downloads
│
├─ Screen: Practice ⭐NEW
│  └─ practicePanel.js + practice.css
│     ├─ Papers list for chapter
│     ├─ Paper player UI
│     ├─ Question display
│     ├─ Answer input
│     ├─ Timer display
│     ├─ Results display
│     └─ Model answers
│
└─ Other screens...
```

---

## **QUESTION BANK STRUCTURE PER CONCEPT**

```
┌─────────────────────────────────┐
│   CONCEPT: "What is Force?"     │
└─────────────────────────────────┘

Content Structure (v1):
├─ Title: "What is Force?"
├─ Learning Outcomes
├─ Description (EditorJS blocks)
├─ Short Notes
├─ Revision Box
├─ Attachments
├─ Exam Tags
└─ Marks: [2, 3, 5] ⭐NEW

Question Bank (v2) - UNLIMITED:
├─ Q1: "Define Force" (1 mark, definition, easy)
├─ Q2: "State SI Unit" (2 marks, definition, easy)
├─ Q3: "Explain Balanced Force" (3 marks, long-answer, medium)
├─ Q4: "Differentiate Forces" (5 marks, comparison, hard)
├─ Q5: "Numerical: Calculate Force" (4 marks, numerical, medium)
├─ Q6: "Draw Force Diagram" (5 marks, diagram, medium)
├─ Q7: "Describe friction effects" (3 marks, theory, easy)
├─ Q8: "Viva Question 1" (viva, easy)
├─ Q9: "Viva Question 2" (viva, medium)
├─ Q10: "Practical: Measure Force" (practical, medium)
└─ ... (unlimited more)

Usage Tracking:
├─ Q1: Used 3 times (Paper 1, Paper 4, Paper 9)
├─ Q2: Used 0 times (preferred for next paper)
├─ Q3: Used 2 times
├─ Q4: Used 1 time
└─ Q5: Used 2 times
```

---

## **PRACTICE PAPER GENERATION ALGORITHM**

```
Input:
├─ Chapter: "Force & Motion"
├─ Total Marks: 20
├─ Difficulty: Mixed
└─ Filters: None

Step 1: Fetch Questions
   SELECT * FROM Question 
   WHERE chapterId = X AND status = 'published'
   ↓ Result: 10 questions

Step 2: Apply Filters (optional)
   if filter.onlyDiagrams: keep only Q with diagramUrl
   if filter.onlyNumericals: keep only Q with type='numerical'
   ... (8 filter types)
   ↓ Result: 10 questions (no filters)

Step 3: Sort by Usage Count (SMART!)
   Sort ascending by usageCount
   ↓ Result: [Q2(0), Q4(1), Q7(1), Q1(2), Q3(2), Q5(2), Q8(2), Q6(3), Q9(3), Q10(4)]
   
   This ensures lesser-used questions get picked first
   So every paper feels different!

Step 4: Calculate Target Marks Distribution
   For 20 marks, mixed difficulty:
   ├─ 1 mark: 2 questions (2 marks)
   ├─ 2 marks: 2 questions (4 marks)
   ├─ 3 marks: 2 questions (6 marks)
   ├─ 4 marks: 1 question (4 marks)
   └─ 5 marks: 1 question (5 marks)
   
   Total = 21 marks (approx)

Step 5: Select Questions Matching Marks
   Loop through sorted questions:
   ├─ Q2 (1 mark) ← need 1marks → Add ✓
   ├─ Q4 (1 mark) ← need 1marks → Skip (have 1)
   ├─ Q7 (1 mark) ← need 1marks → Skip
   ├─ Q1 (2 marks) ← need 2marks → Add ✓
   ├─ Q3 (2 marks) ← need 2marks → Add ✓
   ├─ Q5 (3 marks) ← need 3marks → Add ✓
   ├─ Q8 (3 marks) ← need 3marks → Add ✓
   ├─ Q6 (4 marks) ← need 4marks → Add ✓
   └─ (have 20 marks, stop)

Step 6: Create Paper
   INSERT INTO PracticePaper {
     paperNumber: "01",
     totalMarks: 20,
     questions: [Q2, Q1, Q3, Q5, Q8, Q6],
     marksBreakdown: {...},
     createdAt: now
   }

Step 7: Update Usage Count
   UPDATE Question SET usageCount = usageCount + 1
   WHERE _id IN [Q2, Q1, Q3, Q5, Q8, Q6]
   
   Add to usedInPapers array for each question

Output:
✓ Practice Paper Ready!
  6 questions, 20 marks, no duplicates
  Every question used minimally
  Different paper on each generation
```

---

## **PERFORMANCE CHARACTERISTICS**

```
Database Indexes:
├─ Question: (conceptId, marks)
├─ Question: (chapterId, difficulty)
├─ PracticePaper: (chapterId, createdAt DESC)
├─ StudentPaperAttempt: (studentCode, paperId)
└─ StudentPaperAttempt: (paperId)

Query Performance:
├─ Generate 20-mark paper: ~50ms (10 questions searched)
├─ Load paper list: ~30ms
├─ Submit paper: ~100ms (20 questions scoring)
└─ View results: ~50ms

Storage:
├─ 1000 questions × 500 bytes = 500 KB
├─ 100 papers × 2 KB = 200 KB
├─ 10,000 attempts × 3 KB = 30 MB
└─ Total: ~31 MB (negligible)
```

---

## **BACKWARD COMPATIBILITY**

✅ **Zero Breaking Changes**
- Concept schema: only adds marks array (existing fields untouched)
- API endpoints: all new, no modifications to v1 endpoints
- Student app: adds new screen, existing screens work unchanged
- Admin panel: adds new tabs, existing tabs work unchanged

✅ **Can Run Both Systems**
- PDF notes system continues to work
- SLS notes system works alongside
- Practice papers are optional feature
- Student can choose: read notes OR practice papers

✅ **Gradual Migration**
- Concepts can have marks without questions
- Questions are optional
- Papers are optional
- Students can use any combination

---

## **IMPLEMENTATION CHECKLIST**

```
WEEK 1: Database & Backend
├─ [ ] Concept schema: Add marks field
├─ [ ] Question model created
├─ [ ] PracticePaper model created
├─ [ ] StudentPaperAttempt model created
├─ [ ] Question controller (10 functions)
├─ [ ] Paper generator algorithm
├─ [ ] Paper controller (8 functions)
├─ [ ] All API routes defined
├─ [ ] Unit tests written
└─ [ ] Integration tests passed

WEEK 2: Admin Panel
├─ [ ] Question Manager module created
├─ [ ] Paper Generator module created
├─ [ ] Admin HTML updated (2 new tabs)
├─ [ ] CSS styling for both modules
├─ [ ] Init code in admin.js
├─ [ ] CRUD operations working
├─ [ ] Bulk upload working
├─ [ ] PDF/DOCX generation working
└─ [ ] Admin testing passed

WEEK 3: Student App & Polish
├─ [ ] Practice Panel module created
├─ [ ] Student HTML updated (new screen)
├─ [ ] CSS styling
├─ [ ] Paper playing working
├─ [ ] Answer submission working
├─ [ ] Results display working
├─ [ ] Navigation integrated
├─ [ ] Mobile responsive
├─ [ ] Student testing passed
└─ [ ] Full system integration tested
```

---

**ARCHITECTURE COMPLETE & READY FOR EXECUTION!** 🚀

