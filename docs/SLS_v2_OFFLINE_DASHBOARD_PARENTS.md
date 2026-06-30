# SLS v2 — Offline Practice Papers + Dashboard + Parent Visibility

**Critical Addition**: Complete offline workflow with parent transparency

---

## **OFFLINE PRACTICE PAPER WORKFLOW**

```
═══════════════════════════════════════════════════════════════════════════════
                        TEACHER SIDE - PAPER CREATION
═══════════════════════════════════════════════════════════════════════════════

Step 1: Generate Paper in Admin Panel
   POST /api/admin/sls/papers/generate
   └─ 20 marks, mixed difficulty, no filters
        ↓
   System creates paper in database

Step 2: Download Paper
   POST /api/admin/sls/papers/:paperId/download/pdf
   └─ Teacher clicks: "📥 Download PDF (Student Copy)"
        ↓
   PDF Generated with:
   ├─ Paper number
   ├─ Total marks & time limit
   ├─ Questions only (NO ANSWERS)
   ├─ Space for writing answers
   └─ QR Code linking to online submission (optional)
        ↓
   PDF File: "Practice_Paper_01_StudentCopy.pdf" (100 KB)

Step 3: Print/Email to Students
   ├─ Email PDF to students
   ├─ Print 30 copies for class
   └─ Distribute to students

═══════════════════════════════════════════════════════════════════════════════
                       STUDENT SIDE - OFFLINE ATTEMPT
═══════════════════════════════════════════════════════════════════════════════

Step 1: Student Gets Paper
   ├─ Downloads PDF from email
   ├─ Prints it (or digital)
   └─ Has pen + paper ready

Step 2: Student Takes Paper (OFFLINE ⚡)
   ├─ Reads questions
   ├─ Writes answers on paper
   ├─ Solves numericals
   ├─ Draws diagrams
   ├─ Submits within time limit
   └─ NO INTERNET NEEDED! ✓

Step 3: Teacher Evaluates (OFFLINE ⚡)
   ├─ Teacher reads written answers
   ├─ Marks each answer
   ├─ Writes feedback
   └─ NO INTERNET NEEDED! ✓

═══════════════════════════════════════════════════════════════════════════════
                    MARKS ENTRY - ONLINE OR OFFLINE
═══════════════════════════════════════════════════════════════════════════════

Option 1: ONLINE ENTRY (Real-time Dashboard Update)
   Teacher App → Practice Papers → Paper 01
   ├─ See list of students (30 students)
   ├─ Click on each student
   ├─ Mark submission form:
   │  ├─ Q1: [2/2]
   │  ├─ Q2: [1/1]
   │  ├─ Q3: [2/3] (with feedback)
   │  ├─ Q4: [5/5]
   │  └─ Submit
   └─ Marks saved instantly
        ↓
   Dashboard updates in real-time
   Student sees marks immediately
   Parent gets notification

Option 2: BULK OFFLINE ENTRY (Excel/CSV Upload)
   Teacher creates Excel:
   ├─ Student Name | Q1 | Q2 | Q3 | Q4 | Q5 | Total
   ├─ Raj | 2 | 1 | 2 | 5 | 3 | 13
   ├─ Priya | 2 | 1 | 3 | 5 | 4 | 15
   └─ ... 28 more students
        ↓
   Teacher App:
   ├─ Practice Papers → Paper 01 → Bulk Upload
   ├─ Select Excel file
   ├─ Preview matches
   └─ Upload
        ↓
   All marks synced to dashboard
   All students notified

═══════════════════════════════════════════════════════════════════════════════
                      MARKS SYNC TO DASHBOARD
═══════════════════════════════════════════════════════════════════════════════

When Teacher Enters Marks:
   POST /api/admin/sls/papers/:paperId/mark-student
   {
     studentCode: "RAJ001",
     paperId: "paper_123",
     answers: [
       { questionId: "q1", marksAwarded: 2, feedback: "Correct definition" },
       { questionId: "q2", marksAwarded: 1, feedback: "" },
       { questionId: "q3", marksAwarded: 2, feedback: "Missing one point" },
       { questionId: "q4", marksAwarded: 5, feedback: "Excellent explanation" },
       { questionId: "q5", marksAwarded: 3, feedback: "Calculation error" }
     ]
   }
        ↓
   System:
   ├─ Creates StudentPaperAttempt record
   ├─ Calculates total: 13/20 (65%)
   ├─ Assigns grade: B
   ├─ Updates student dashboard
   ├─ Updates parent dashboard
   ├─ Sends notification to student
   ├─ Sends notification to parent
   └─ Stores in DB for analytics

Result in Database:
   {
     studentCode: "RAJ001",
     paperId: "paper_123",
     totalMarksObtained: 13,
     totalMarksAllotted: 20,
     percentage: 65,
     grade: "B",
     status: "evaluated",
     evaluatedBy: "TEACHER001",
     evaluatedAt: "2026-07-01T14:30:00Z"
   }
```

---

## **STUDENT DASHBOARD - NEW SCREEN**

```
═══════════════════════════════════════════════════════════════════════════════
                   STUDENT APP - PRACTICE DASHBOARD
═══════════════════════════════════════════════════════════════════════════════

Student Login → Home → 📊 Practice Dashboard

┌──────────────────────────────────────────────────────────────┐
│                    PRACTICE DASHBOARD                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📈 Overall Performance                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Papers Completed: 5                                 │   │
│  │ Average Score: 72%                                  │   │
│  │ Total Marks: 324/500                                │   │
│  │ Improvement: ↑ 8% (last month)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  📋 Recent Practice Papers                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Practice Paper 05 - Force & Motion                │    │
│  │ Attempted: 2026-06-30  |  Score: 15/20 (75%)     │    │
│  │ [View Results] [View Model Answers]               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Practice Paper 04 - Waves & Sound                 │    │
│  │ Attempted: 2026-06-25  |  Score: 13/20 (65%)     │    │
│  │ [View Results] [View Model Answers]               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Practice Paper 03 - Magnetism                     │    │
│  │ Attempted: 2026-06-20  |  Score: 17/20 (85%)     │    │
│  │ [View Results] [View Model Answers]               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  📊 Performance by Chapter                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │                                                    │    │
│  │ Force & Motion         ████████░░ 75%            │    │
│  │ Waves & Sound          █████░░░░░ 65%            │    │
│  │ Magnetism              █████████░ 85%            │    │
│  │ Optics                 ██████░░░░ 70%            │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  🎯 Weak Topics (Need Practice)                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ • Numerical problems (avg 60%)                     │    │
│  │ • Diagram-based questions (avg 65%)               │    │
│  │ • Long answer questions (avg 68%)                 │    │
│  │ [Suggested Papers: 2, 7, 9]                       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  💡 Recommendations                                         │
│  ✓ Attempt Paper 06 (focuses on numericals)                │
│  ✓ Review model answers from Paper 03 (best performance)   │
│  ✓ Practice long-answer questions (improvement needed)     │
│                                                              │
│  [📥 Download Practice Papers] [📝 Take New Paper]         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## **STUDENT RESULT VIEW - DETAILED**

```
┌──────────────────────────────────────────────────────────────┐
│                   PAPER RESULTS (DETAILED)                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Practice Paper 05 - Force & Motion                          │
│  Date: June 30, 2026  |  Time: 45 minutes  |  Marks: 20     │
│                                                              │
│  ┌────────────────────────────────────┐                     │
│  │ SCORE: 15/20 (75%)  Grade: A       │                     │
│  │ Improvement: +10% from last paper   │                     │
│  └────────────────────────────────────┘                     │
│                                                              │
│  Question-wise Breakdown:                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │                                              │           │
│  │ Q1: Define Force           [2/2] ✓          │           │
│  │ Your Answer: "A push or pull..."            │           │
│  │ Feedback: Perfect definition                │           │
│  │                                              │           │
│  │ Q2: SI Unit of Force       [1/1] ✓          │           │
│  │ Your Answer: "Newton (N)"                   │           │
│  │ Feedback: Correct                           │           │
│  │                                              │           │
│  │ Q3: Explain Balanced Force [2/3] ⚠          │           │
│  │ Your Answer: "Equal forces..."              │           │
│  │ Model Answer: "Equal forces in opposite..." │           │
│  │ Feedback: Good but incomplete. Missing:     │           │
│  │           - Direction aspect                │           │
│  │           - Real-world example              │           │
│  │                                              │           │
│  │ Q4: Differentiate Forces  [5/5] ✓          │           │
│  │ Your Answer: [Long answer provided]        │           │
│  │ Feedback: Excellent analysis!               │           │
│  │                                              │           │
│  │ Q5: Numerical Problem      [3/4] ⚠          │           │
│  │ Your Answer: "F = 500 N"                    │           │
│  │ Model Answer: "F = 500 N (correct working)" │           │
│  │ Feedback: Correct answer but show working:  │           │
│  │           F = ma = 100 × 5 = 500 N          │           │
│  │                                              │           │
│  │ Q6: Draw Diagram          [2/5] ✗ (Extra)  │           │
│  │ Your Answer: [Simple diagram]               │           │
│  │ Feedback: Missing labels and title          │           │
│  │                                              │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  📊 Performance Analytics:                                  │
│  ├─ Strongest: Q1, Q2, Q4 (100%)                            │
│  ├─ Weak areas: Diagrams (40%), Long answers (67%)          │
│  ├─ Mistakes made: 3 (all minor calculation/explanation)    │
│  └─ Effort shown: Excellent working in Q5                   │
│                                                              │
│  💡 Personalized Feedback:                                  │
│  ├─ You're strong in conceptual understanding (A grade)     │
│  ├─ Work on diagram labeling (attempted but incomplete)     │
│  ├─ Practice: Balanced vs Unbalanced forces                 │
│  ├─ Next: Attempt Paper 06 (force & friction focus)         │
│  └─ Study: Review model answers for Q3 and Q5              │
│                                                              │
│  📚 Model Answers Available:                                │
│  [📖 View Model Answers] [⬇ Download Answer Sheet]          │
│                                                              │
│  🔄 Actions:                                                │
│  [← Back to Dashboard] [📋 Take Another Paper]              │
│  [📤 Share with Parent] [💬 Message Teacher]                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## **PARENT DASHBOARD - COMPLETE VISIBILITY**

```
═══════════════════════════════════════════════════════════════════════════════
                     PARENT APP - CHILD PROGRESS
═══════════════════════════════════════════════════════════════════════════════

Parent Login → Dashboard

┌──────────────────────────────────────────────────────────────┐
│                    CHILD'S PROGRESS DASHBOARD                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  👤 Child: Raj Kumar (Class 10-B, Roll 15)                  │
│                                                              │
│  📈 Overall Performance                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ School Target: 75%                                  │   │
│  │ Child's Current: 72%  (3% behind) ↓                 │   │
│  │ Subject Average: 70%                                │   │
│  │ Board Expectations: 80% (trend needed)              │   │
│  │ Latest Paper Score: 75%  (improvement ↑)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  📊 Practice Paper Performance (Last 5 Papers)              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Score Trend:                                       │    │
│  │ Paper 01: 60% ██████░░░░░░░░░░░░░░░░░░░░░░░░     │    │
│  │ Paper 02: 65% ██████░░░░░░░░░░░░░░░░░░░░░░░░     │    │
│  │ Paper 03: 75% ███████░░░░░░░░░░░░░░░░░░░░░░░░    │    │
│  │ Paper 04: 72% ███████░░░░░░░░░░░░░░░░░░░░░░░░    │    │
│  │ Paper 05: 75% ███████░░░░░░░░░░░░░░░░░░░░░░░░    │    │
│  │                                                    │    │
│  │ Trend: Improving ↗  (Good!)                        │    │
│  │ Pattern: Consistent practice paying off            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ✅ Strengths (Score > 80%):                                │
│  ├─ Conceptual questions (85%)                              │
│  ├─ Theory-based answers (82%)                              │
│  └─ Drawing diagrams (80%)                                  │
│                                                              │
│  ⚠️  Areas Needing Attention (Score < 70%):                 │
│  ├─ Numerical problems (68%) - practice recommended         │
│  ├─ Long-form answers (65%) - needs structuring             │
│  └─ Time management (60%) - 2 questions incomplete          │
│                                                              │
│  📋 Recent Activities:                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Jun 30: Completed Practice Paper 05 - 75% ✓       │    │
│  │ Jun 25: Completed Practice Paper 04 - 72%         │    │
│  │ Jun 20: Reviewed model answers from Paper 03       │    │
│  │ Jun 15: Teacher gave feedback on numericals        │    │
│  │ Jun 10: Completed Practice Paper 03 - 75%         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  🎯 Teacher's Recommendations:                              │
│  "Good progress! Raj's conceptual understanding is strong.  │
│   Recommend focusing on numerical problem-solving and time  │
│   management. With consistent practice, should reach 80%+   │
│   by final exams. Keep up the good work!"                   │
│                                                              │
│  📞 Parent Actions:                                         │
│  [📬 Message Teacher] [💬 Message Child]                    │
│  [📖 Download Results] [📧 Email Summary]                   │
│  [⚙️  Notification Settings]                                │
│                                                              │
│  🔔 Notifications Enabled:                                  │
│  ✓ When paper is completed                                  │
│  ✓ When results are evaluated                               │
│  ✓ When score < 70%                                         │
│  ✓ Weekly progress summary                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## **PARENT DETAILED VIEW - ONE PAPER**

```
┌──────────────────────────────────────────────────────────────┐
│              PARENT VIEW - PAPER RESULT DETAIL                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Practice Paper 05 - Force & Motion                          │
│  Student: Raj Kumar  |  Date: June 30, 2026                 │
│  Teacher: Mr. Sharma                                         │
│                                                              │
│  ┌────────────────────────────────────┐                     │
│  │ SCORE: 15/20 (75%)                 │                     │
│  │ Grade: A  (Expected: 85%+)          │                     │
│  │ Status: 3% Below Target             │                     │
│  │ Trend: ↗ Improving (+10% from last) │                     │
│  └────────────────────────────────────┘                     │
│                                                              │
│  Question-wise Marks:                                        │
│  ┌──────────────────────────────────────────────┐           │
│  │ Q1: Define Force           2/2 ✓ (100%)     │           │
│  │ Q2: SI Unit               1/1 ✓ (100%)     │           │
│  │ Q3: Explain Balanced      2/3 ⚠ (67%)      │           │
│  │ Q4: Differentiate         5/5 ✓ (100%)     │           │
│  │ Q5: Numerical Problem     3/4 ⚠ (75%)      │           │
│  │ Q6: Diagram (bonus)       2/5 (40%)        │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  Teacher's Feedback:                                         │
│  "Excellent work, Raj! Your conceptual understanding is     │
│   strong, especially in Q4 where you provided a detailed    │
│   comparison. Work on Q3 - remember to include real-world   │
│   examples. For Q5, always show your working step-by-step.  │
│   Keep practicing and you'll reach 85%+ soon!"              │
│                                                              │
│  Parent Insights:                                            │
│  • Child scored above class average (75% vs 70%)             │
│  • Improvement trend: +15% over 5 papers (good progress!)   │
│  • Weak area identified: Numerical problems (68% avg)       │
│  • Recommendation: 1 extra tutoring session/week on maths    │
│                                                              │
│  📚 Resources Suggested by Teacher:                          │
│  • YouTube: "Numerical problem solving tricks" (link)       │
│  • Practice Paper 06 (focuses on numericals)                │
│  • Study group with Priya (strong in numericals)            │
│                                                              │
│  [🔗 Share with Child] [📧 Email to Self] [💬 Reply]        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## **DATABASE SCHEMA UPDATES**

```javascript
// Update StudentPaperAttempt Model

{
  studentCode: String,           // "RAJ001"
  studentName: String,           // "Raj Kumar"
  
  paperId: String,              // Paper reference
  paperNumber: String,          // "Paper 05"
  chapterId: String,
  
  // Attempt Details
  attemptNumber: Number,
  startedAt: Date,
  submittedAt: Date,
  duration: Number,             // in minutes
  
  // Answers & Marks
  answers: [{
    questionId: String,
    studentAnswer: String,
    marksAwarded: Number,
    maxMarks: Number,
    feedback: String,
    isCorrect: Boolean
  }],
  
  // Scoring
  totalMarksObtained: Number,    // 15
  totalMarksAllotted: Number,    // 20
  percentage: Number,            // 75
  grade: String,                 // "A"
  
  // Evaluation
  status: String,                // "evaluated", "pending", "submitted"
  evaluatedBy: String,           // Teacher ID
  evaluatedAt: Date,
  
  // Parent Visibility
  parentNotificationSent: Boolean,
  studentNotificationSent: Boolean,
  
  // Analytics
  timePerQuestion: [{            // For tracking time management
    questionId: String,
    timeSpent: Number            // in seconds
  }],
  
  revisedAnswers: Number,        // How many times student changed answer
  markedAsUncertain: [String],   // Questions student felt uncertain about
  
  // Progress Tracking
  previousAttemptScore: Number,  // For trend calculation
  scoreImprovement: Number,      // Percentage change
  
  createdAt: Date
}
```

---

## **NEW API ENDPOINTS FOR DASHBOARD**

```
STUDENT ROUTES: /api/sls/student/dashboard

  GET    /dashboard/summary           [Overall stats]
  GET    /papers/history              [All paper attempts]
  GET    /papers/:paperId/result      [Single paper result]
  GET    /papers/:paperId/model-answers [Model solutions]
  GET    /chapter/:id/performance     [Performance by chapter]
  GET    /weak-topics                 [Identified weak areas]
  POST   /papers/:paperId/share-parent [Send to parent]

PARENT ROUTES: /api/parent/dashboard

  GET    /children/:studentCode/dashboard    [Child overview]
  GET    /children/:studentCode/papers       [All paper results]
  GET    /children/:studentCode/performance  [Detailed performance]
  GET    /children/:studentCode/recommendations [AI suggestions]
  POST   /notification-settings              [Customize alerts]

TEACHER ROUTES: /api/admin/sls/papers/mark

  POST   /:paperId/mark-student              [Enter marks]
  POST   /:paperId/bulk-mark-upload          [CSV upload]
  POST   /:paperId/send-to-parent            [Notify parent]
  GET    /class-performance/:paperId         [Class analytics]
  GET    /student-performance/:studentCode   [Individual tracking]
```

---

## **OFFLINE + DASHBOARD FLOW**

```
Teacher Creates Paper (Online or Offline):
   ├─ Generate in admin panel ──> PDF created
   ├─ Download PDF file ──> 100 KB PDF
   └─ Print or email to students ──> OFFLINE

Student Takes Paper (100% Offline ⚡):
   ├─ No internet needed
   ├─ Writes answers on paper
   ├─ NO digital submission during exam
   └─ Physical papers collected

Teacher Evaluates (Can be Offline):
   ├─ Reads handwritten answers
   ├─ Marks on paper OR
   ├─ Later enters marks online
   └─ Any schedule, any device

Marks Entry (Online - Syncs to Dashboard):
   ├─ Teacher opens admin panel
   ├─ Enters marks for all 30 students
   ├─ Saves to database
   └─ Instant sync to:
      ├─ Student dashboard (student sees results)
      ├─ Parent dashboard (parent notified)
      ├─ Analytics (performance tracking)
      └─ Progress view (trend analysis)

Results Available:
   ├─ Student: View scores, feedback, model answers
   ├─ Parent: See performance, trends, recommendations
   ├─ Teacher: Class analytics, student comparison
   └─ System: Track progress for AI recommendations
```

---

## **PARENT NOTIFICATION SYSTEM**

```javascript
// When marks are entered, parent gets notification:

Notification Types:
├─ Paper Submitted
│  "Raj submitted Practice Paper 05. Results coming soon."
│
├─ Results Available ✓
│  "Raj's results are ready! Score: 15/20 (75%) - Good work!"
│
├─ Score Alert (if below 70%)
│  "Raj's score (65%) is below target. Check dashboard for details."
│
├─ Weekly Summary
│  "Weekly Update: Raj completed 2 papers, average score 73%,
│   trending upward. Weak area: Numericals. Continue practice!"
│
├─ Achievement
│  "Great news! Raj improved by 10% in last paper. Keep going!"
│
└─ Teacher Comment
│  "Teacher feedback: Raj is doing well in conceptual questions.
│   Work on numerical problem-solving. Keep up the effort!"

Notification Channels:
├─ In-app push notification
├─ Email notification
├─ SMS (optional)
└─ WhatsApp (if integrated)

Parent Can:
├─ View full results immediately
├─ See detailed feedback
├─ Compare with previous papers
├─ Check teacher recommendations
├─ Message teacher with questions
└─ Download result PDF
```

---

## **IMPLEMENTATION ADDITION**

```
EXTRA MODULES NEEDED:

1. StudentDashboard.js (300 lines)
   ├─ Fetch paper history
   ├─ Calculate statistics
   ├─ Display performance charts
   ├─ Show weak areas
   └─ Provide recommendations

2. ParentDashboard.js (300 lines)
   ├─ Show child's progress
   ├─ Display performance trend
   ├─ Show teacher feedback
   ├─ Alert on weak performance
   └─ Provide study resources

3. Dashboard CSS (200 lines)
   ├─ Responsive charts
   ├─ Performance visualizations
   ├─ Mobile-friendly design
   ├─ Notification cards
   └─ Download buttons

4. Notification Service (150 lines)
   ├─ Generate notifications
   ├─ Send via multiple channels
   ├─ Track read status
   └─ Archive notifications

5. Analytics Engine (200 lines)
   ├─ Calculate trends
   ├─ Identify weak topics
   ├─ Generate recommendations
   ├─ Compare class performance
   └─ Export reports
```

---

## **COMPLETE WORKFLOW - VISUAL**

```
TEACHER ──> Generate ──> Download ──> Print/Email ──> STUDENTS (Offline)
            Paper         PDF            Papers          Take Paper
                                                             ↓
                                                         Write Answers
                                                         (NO INTERNET)
                                                             ↓
                                                         Submit Papers
                                                             ↓
TEACHER ──> Evaluate ──> Enter Marks ──> Save to DB ──> Sync Dashboards
            Papers       (Admin/CSV)      (Online)           ↓
                                                          ╔═══════════════╗
                                                          ║ DASHBOARDS    ║
                                                          ╠═══════════════╣
                                                          │ STUDENT:      │
                                                          │ • Results     │
                                                          │ • Feedback    │
                                                          │ • Model Ans   │
                                                          │ • Trends      │
                                                          ├───────────────┤
                                                          │ PARENT:       │
                                                          │ • Child score │
                                                          │ • Performance │
                                                          │ • Alerts      │
                                                          │ • Recommends  │
                                                          ├───────────────┤
                                                          │ TEACHER:      │
                                                          │ • Class stats │
                                                          │ • Trends      │
                                                          │ • Analytics   │
                                                          └═══════════════┘
```

---

**COMPLETE SLS v2 READY FOR IMPLEMENTATION!** 🚀

- ✅ Offline practice papers (PDF/DOCX)
- ✅ Marks entry (online or bulk CSV)
- ✅ Sync to student dashboard
- ✅ Sync to parent dashboard
- ✅ Full transparency & feedback
- ✅ Personalized recommendations
- ✅ Teacher insights & analytics

**Total Addition Time: 3-4 days**
- Dashboard modules: 2 days
- Notifications: 1 day
- CSS + Testing: 1 day

