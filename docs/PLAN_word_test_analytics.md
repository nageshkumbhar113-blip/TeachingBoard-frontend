# Word Test Intelligence Analytics — Senior Implementation Plan

**Author:** Jyotika Kumbhar  
**Created:** 2026-06-25  
**Status:** APPROVED — Ready to implement  
**Scope:** Student + Teacher + Parent analytics for Word Tests  
**Target:** Listening · Vocabulary · Spelling · Pronunciation scores + AI-style insights  

---

## 1. Problem Statement

Currently the Word Test system records only an overall score per attempt.  
No one — student, parent, or teacher — can see *which skill* is weak.  
The analytics screen (`analytics.js`) covers MCQ tests only and ignores Word Tests entirely.

**Goal:** Add section-wise skill scores + an intelligent insight engine that tells each role exactly what to do next — with zero new MongoDB collections and minimal DB growth.

---

## 2. Skill Taxonomy

Each Word Test question has a `type` field. Map these to four skills:

| Question Type | Skill | What it tests |
|---|---|---|
| `listen_choose_word` | **Listening** | Hear a word → pick correct word from options |
| `listen_pick_picture` | **Listening** | Hear a word → pick correct picture |
| `listen_meaning_mr` | **Vocabulary** | Hear a word → pick Marathi meaning |
| `listen_spelling` | **Spelling** | Hear a word → pick correct spelling from options |
| `listen_type_word` | **Spelling** | Hear a word → type it correctly |

> **Pronunciation** score = `listen_type_word` accuracy only.  
> Typing a word correctly requires knowing its phonetic structure → proxy for pronunciation.  
> Full pronunciation (audio recording + AI grading) is out of scope for this plan.

```js
// Central map — defined once, used everywhere
const SKILL_MAP = {
  listen_choose_word:  'listening',
  listen_pick_picture: 'listening',
  listen_meaning_mr:   'vocabulary',
  listen_spelling:     'spelling',
  listen_type_word:    'spelling',
};
```

---

## 3. Architecture Decisions

| Decision | Reason |
|---|---|
| Compute `section_scores` server-side at submit time | All data (question types + graded answers) is available at submit. Never needs re-computation. |
| Store `section_scores` on the `WordTestAttempt` document | ~200 bytes extra per attempt. Avoids aggregating raw answers every time analytics is requested. |
| Insight engine = 100% client-side JS | Thresholds and text are not AI — they are rules. Zero server compute. Works offline. |
| Cache analytics in IDB `settings` store (15-min TTL) | No new IDB store. One key per student. Reuses existing infrastructure. |
| One analytics endpoint per role (not three) | Keeps routes clean. Each endpoint shapes the same data differently. |
| No new MongoDB collection | All data comes from existing `word_test_attempts` collection with two new fields. |

---

## 4. Data Model Changes

### 4.1 `WordTestAttempt` — two new fields

**File:** `TeachingBoard-backend/src/models/WordTestAttempt.js`

```js
// ADD to wordTestAttemptSchema:
section_scores: {
  listening:  { score: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  vocabulary: { score: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
  spelling:   { score: { type: Number, default: 0 }, total: { type: Number, default: 0 } },
},
weak_word_ids: { type: [String], default: [] },  // word_ids where is_correct=false, max 20
```

**Migration:** Not needed. Old attempts will have `section_scores = {}` (MongoDB default).  
Analytics code handles missing `section_scores` gracefully: if `total === 0`, exclude that attempt from section averages.

**Storage impact:**
- `section_scores`: 3 objects × 2 numbers = 6 numbers → ~100 bytes
- `weak_word_ids`: up to 20 UUID strings × ~36 chars = ~720 bytes (worst case; average 5–8 words = ~250 bytes)
- **Net addition per attempt: ~350 bytes** (was ~480 bytes → ~830 bytes total)

---

## 5. Backend — Phase 1 (Data Foundation)

**File:** `TeachingBoard-backend/src/controllers/wordTestController.js`

### 5.1 Update `submitAttempt`

After `scoredAnswers` is built, compute section scores before calling `WordTestAttempt.create()`:

```js
// Step 1: Build question type lookup from test.questions
const qTypeMap = Object.fromEntries(
  test.questions.map(q => [q.question_id, { type: q.type, word_id: q.word_id }])
);

// Step 2: Compute section_scores and weak_word_ids
const sections = {
  listening:  { score: 0, total: 0 },
  vocabulary: { score: 0, total: 0 },
  spelling:   { score: 0, total: 0 },
};
const weakWordSet = new Set();

scoredAnswers.forEach(a => {
  const meta  = qTypeMap[a.question_id];
  if (!meta) return;
  const skill = SKILL_MAP[meta.type];
  if (!skill) return;
  sections[skill].total++;
  if (a.is_correct) {
    sections[skill].score++;
  } else {
    if (meta.word_id) weakWordSet.add(meta.word_id);
  }
});

const weak_word_ids = [...weakWordSet].slice(0, 20);
```

Then pass `section_scores: sections, weak_word_ids` to `WordTestAttempt.create()`.

---

## 6. Backend — Phase 2 (Analytics Endpoints)

### 6.1 Student Analytics

**Route:** `GET /api/word-tests/analytics`  
**Auth:** `requireStudent`  
**Query params:** `batch` (optional), `subject` (optional)

**Logic:**
1. Find last 20 attempts for `student_code` (sorted `submitted_at: -1`)
2. Aggregate: overall avg %, section avgs, pass rate
3. Collect `weak_word_ids` across all attempts → count frequency → top 5
4. Build `recent_tests` array (last 10, lightweight)
5. Fetch word names for weak_word_ids from `Word` model (for display)

**Response shape:**
```json
{
  "summary": {
    "attempts": 8,
    "avg_percent": 71,
    "pass_rate": 75,
    "total_words_tested": 160
  },
  "sections": {
    "listening":  { "avg": 82, "attempts_with_data": 8 },
    "vocabulary": { "avg": 65, "attempts_with_data": 8 },
    "spelling":   { "avg": 48, "attempts_with_data": 8 }
  },
  "weak_words": [
    { "word_id": "abc", "word": "butterfly", "miss_count": 5 }
  ],
  "recent_tests": [
    {
      "test_id": "...", "title": "Animals Set 1", "subject": "Animals",
      "percent": 75, "passed": true, "submitted_at": "...",
      "sections": { "listening": 80, "vocabulary": 70, "spelling": 60 }
    }
  ]
}
```

### 6.2 Teacher / Admin Class Analytics

**Route:** `GET /api/admin/word-tests/analytics?batch=&subject=`  
**Auth:** `requireAdmin`

**Logic:**
1. Find all attempts for `batch` + `subject`
2. Group by `student_code`
3. Per student: avg overall, per-section avg, `attention` flag (avg < 50% OR any section < 40%)
4. Class-wide section averages
5. Common weak words (union of all `weak_word_ids`, sorted by frequency)
6. Join with `User` model for student names

**Response shape:**
```json
{
  "class_summary": {
    "students_attempted": 20,
    "avg_percent": 66,
    "pass_rate": 70,
    "sections": {
      "listening":  { "avg": 74 },
      "vocabulary": { "avg": 61 },
      "spelling":   { "avg": 52 }
    }
  },
  "students": [
    {
      "student_code": "S001", "name": "Priya S.",
      "attempts": 3, "avg_percent": 38, "passed_count": 0,
      "sections": { "listening": 45, "vocabulary": 40, "spelling": 28 },
      "weakest_section": "spelling",
      "attention": true
    }
  ],
  "common_weak_words": [
    { "word_id": "...", "word": "butterfly", "miss_count": 18 }
  ]
}
```

### 6.3 Route File Changes

**File:** `TeachingBoard-backend/src/routes/wordTestRoutes.js`

```js
// ADD (student router)
studentRouter.get('/analytics', requireStudent, ctrl.studentAnalytics);

// ADD (admin router)
adminRouter.get('/analytics', requireAdmin, ctrl.classAnalytics);
```

> ⚠️ `studentRouter.get('/analytics', ...)` must be declared **before** `studentRouter.get('/:test_id', ...)` to avoid Express matching `/analytics` as a test_id param.

---

## 7. Frontend — Phase 3 (Insight Engine)

**New file:** `student-app/wordTestInsights.js`

### 7.1 Score Thresholds

```
< 40%   → CRITICAL   🔴  तातडीने सराव हवा
40–59%  → WEAK       🟠  सुधारणा गरजेची
60–79%  → GOOD       🟡  ठीक आहे, अजून सराव करा
≥ 80%   → EXCELLENT  🟢  उत्तम!
```

### 7.2 Advice Map (Marathi + English)

Each skill × level combination has:
- `badge`: emoji + label
- `mr`: Marathi advice text
- `en`: English advice text
- `action`: specific study tip

```js
const ADVICE = {
  listening: {
    critical: {
      badge: '🔴 कमकुवत',
      mr:     'शब्द ऐकताना नीट लक्ष द्या.',
      action: 'रोज 10 मिनिटे flashcard audio ऐका.',
    },
    weak: {
      badge: '🟠 सुधारणा गरजेची',
      mr:     'Listening practice वाढवा.',
      action: 'Word Bank मधून शब्द ऐका आणि repeat करा.',
    },
    good: {
      badge: '🟡 ठीक',
      mr:     'Listening चांगले आहे.',
      action: 'नवीन sets try करा.',
    },
    excellent: {
      badge: '🟢 उत्तम',
      mr:     'Listening excellent! सुरू ठेवा.',
      action: null,
    },
  },
  vocabulary: { /* ... */ },
  spelling: {
    critical: {
      badge: '🔴 कमकुवत',
      mr:     'स्पेलिंग खूप कमकुवत आहे.',
      action: 'रोज झोपण्यापूर्वी 5 शब्द वहीत लिहा.',
    },
    // ...
  },
};
```

### 7.3 `compute(analytics)` function

```js
function compute(analytics) {
  const insights = [];
  const sections = analytics.sections || {};

  // 1. Per-skill status cards
  for (const [skill, data] of Object.entries(sections)) {
    if (data.attempts_with_data === 0) continue;
    const level  = _level(data.avg);
    const advice = ADVICE[skill]?.[level];
    insights.push({ type: 'skill', skill, pct: data.avg, level, ...advice });
  }

  // 2. Priority action — worst skill below 60%
  const sorted    = insights.filter(i => i.type === 'skill').sort((a, b) => a.pct - b.pct);
  const needsWork = sorted.filter(i => i.pct < 60);
  if (needsWork.length) {
    insights.unshift({
      type:   'priority',
      skill:  needsWork[0].skill,
      pct:    needsWork[0].pct,
      action: needsWork[0].action,
    });
  }

  // 3. Trend (last 3 test percents)
  const recent = (analytics.recent_tests || []).slice(-3).map(t => t.percent);
  if (recent.length >= 2) {
    const delta = recent[recent.length - 1] - recent[0];
    insights.push({
      type:      'trend',
      direction: delta > 3 ? 'up' : delta < -3 ? 'down' : 'stable',
      delta:     Math.abs(delta),
    });
  }

  // 4. Weak words (top 3 for display)
  const weakWords = (analytics.weak_words || []).slice(0, 3);
  if (weakWords.length) {
    insights.push({ type: 'weak_words', words: weakWords });
  }

  return insights;
}
```

### 7.4 `renderInsightsCard(insights, container)` function

Renders a card with:
- Priority action box (orange border) at the top
- Skill bars (3 rows: Listening / Vocabulary / Spelling)
- Trend chip (↑ सुधारणा / ↓ घट / → स्थिर)
- Weak words chips

---

## 8. Frontend — Phase 4 (Student Analytics Tab)

**File:** `student-app/analytics.js`

### 8.1 Add Tab 6

```js
const TABS = [
  { id: 'overview',    label: '📈 Overview'    },
  { id: 'performance', label: '🎯 Performance' },
  { id: 'history',     label: '📋 History'     },
  { id: 'subjects',    label: '📚 Subjects'    },
  { id: 'weak',        label: '⚠️ Weak Qs'    },
  { id: 'wordtests',   label: '📝 Word Tests'  },  // NEW
];
```

### 8.2 `_renderWordTestsTab()` layout

```
┌─────────────────────────────────────────┐
│  📝 Word Tests                          │
│  8 tests · 71% avg · 75% pass rate      │
├─────────────────────────────────────────┤
│  Skills                                 │
│  🎧 Listening   ████████░░  82%  🟢    │
│  📖 Vocabulary  ██████░░░░  65%  🟡    │
│  ✏️  Spelling    ████░░░░░░  48%  🔴    │
├─────────────────────────────────────────┤
│  🤖 Insights                            │
│  ⚠️  स्पेलिंग कमकुवत आहे (48%)        │
│  💡 रोज झोपण्यापूर्वी 5 शब्द लिहा     │
│  📈 मागील 3 tests मध्ये सुधारणा        │
│  🔤 Practice करा: butterfly · cat      │
├─────────────────────────────────────────┤
│  Recent Tests (last 5)                  │
│  Animals Set 1   75%  ✅  Jun 20       │
│  Animals Set 2   60%  ✅  Jun 18       │
│  Animals Set 3   45%  ❌  Jun 15       │
└─────────────────────────────────────────┘
```

### 8.3 Offline + Caching strategy

```js
const CACHE_KEY = `wt_analytics_v1_${studentCode}`;
const CACHE_TTL = 15 * 60 * 1000;  // 15 minutes

async function _fetchWordTestAnalytics(studentCode) {
  // Try cache first
  const cached = await DB.getSetting(CACHE_KEY);
  if (cached && (Date.now() - cached.cached_at < CACHE_TTL)) {
    return cached.data;
  }
  // Fetch fresh (fails gracefully if offline)
  try {
    const data = await API.fetchWordTestAnalytics();
    await DB.setSetting(CACHE_KEY, { data, cached_at: Date.now() });
    return data;
  } catch (_) {
    return cached?.data || null;  // serve stale cache if offline
  }
}
```

---

## 9. Frontend — Phase 5 (Teacher View in Admin)

**File:** `admin-app/admin.js`  
**Location:** Inside Tests tab, new sub-section after word test list

### 9.1 UI Layout

```
Word Test Class Analytics  [Batch ▼] [Subject ▼] [🔄 Refresh]
──────────────────────────────────────────────────────────────
Class: 20 students · 66% avg · 70% pass rate

Section Averages:
  🎧 Listening   74%  ████████░░
  📖 Vocabulary  61%  ██████░░░░
  ✏️  Spelling    52%  █████░░░░░

⚠️ Needs Attention (3 students — avg < 50% OR any section < 40%):
  Priya S.    38%   Spelling 28%  🔴
  Rohan M.    42%   Vocabulary 35%  🔴
  Anita K.    31%   Listening 30%  🔴

All Students                         [Export CSV]
  Name         Attempts  Avg   Listen  Vocab  Spell
  ──────────── ────────  ───   ──────  ─────  ─────
  Priya S.     3         38%   45%     40%    28%   🔴
  Rohan M.     5         42%   55%     35%    40%   🔴
  ...

🔤 Most missed words (class-wide):
  butterfly (18 misses) · helicopter (14) · caterpillar (11)
```

### 9.2 No framework needed — plain DOM rendering inside existing admin tab pattern.

---

## 10. Frontend — Phase 6 (Parent / Simplified View)

**Parent = student analytics with simplified language cards.**  
No new backend work. Same `fetchWordTestAnalytics()` API call.  
`wordTestInsights.js` has a second render function: `renderParentCard(insights, container)`.

```
┌──────────────────────────────────────┐
│  तुमच्या मुलाची/मुलीची प्रगती 📊   │
│  Word Tests — June 2026              │
│                                      │
│  🎧 ऐकणे          उत्तम  🟢        │
│  📖 शब्दांचा अर्थ  ठीक    🟡        │
│  ✏️  स्पेलिंग       कमकुवत 🔴       │
│                                      │
│  ────────────────────────────────    │
│  💡 घरी काय करावे:                  │
│  रोज झोपण्यापूर्वी 5 शब्द           │
│  वहीत लिहायला सांगा.                 │
│                                      │
│  हे शब्द practice करा:              │
│  butterfly · helicopter              │
└──────────────────────────────────────┘
```

---

## 11. `helpers.js` — New API Functions

**File:** `core/helpers.js`

```js
// Student: fetch own word test analytics
async function fetchWordTestAnalytics({ batch, subject } = {}) {
  const token  = await ensureStudentSession();
  const params = new URLSearchParams();
  if (batch)   params.set('batch',   batch);
  if (subject) params.set('subject', subject);
  const qs = params.toString() ? '?' + params : '';
  return request(`/word-tests/analytics${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Admin: fetch class analytics
async function fetchClassWordTestAnalytics({ batch, subject } = {}) {
  const token  = await ensureAdminSession();
  const params = new URLSearchParams();
  if (batch)   params.set('batch',   batch);
  if (subject) params.set('subject', subject);
  const qs = params.toString() ? '?' + params : '';
  return request(`/admin/word-tests/analytics${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

Add both to the `return { ... }` exports block.

---

## 12. Complete File Change Map

| # | File | Type | Change Summary |
|---|------|------|----------------|
| 1 | `backend/models/WordTestAttempt.js` | Edit | Add `section_scores`, `weak_word_ids` fields |
| 2 | `backend/controllers/wordTestController.js` | Edit | Compute section scores in `submitAttempt`; add `studentAnalytics`, `classAnalytics` |
| 3 | `backend/routes/wordTestRoutes.js` | Edit | Add 2 GET `/analytics` routes (student + admin) |
| 4 | `core/helpers.js` | Edit | Add `fetchWordTestAnalytics`, `fetchClassWordTestAnalytics` |
| 5 | `student-app/wordTestInsights.js` | **New** | Insight engine — `compute()` + `renderInsightsCard()` + `renderParentCard()` |
| 6 | `student-app/analytics.js` | Edit | Add Tab 6 `wordtests`, `_renderWordTestsTab()`, caching logic |
| 7 | `student-app/index.html` | Edit | Add `<script src="wordTestInsights.js" defer>` |
| 8 | `admin-app/admin.js` | Edit | Add class analytics sub-panel inside Tests tab |

**Total: 7 edits + 1 new file. No new MongoDB collections. No new IDB stores.**

---

## 13. Storage Impact Summary

| Item | Per attempt | Notes |
|------|-------------|-------|
| `section_scores` | +100 bytes | 3 objects × 2 ints |
| `weak_word_ids` | +180 bytes avg | avg 5 UUIDs × 36 chars |
| **Total per attempt** | **+280 bytes** | Was ~480B → now ~760B |
| IDB analytics cache | ~1 KB per student | 15-min TTL, auto-overwrites |
| Old attempts migration | 0 | `section_scores: {}` by Mongo default |

---

## 14. Implementation Phases + Order

```
Phase 1 — Backend: Data model + submitAttempt update
  Files: WordTestAttempt.js, wordTestController.js
  Time: 1 day
  Deploy: git push → Render auto-deploys
  Test: Submit a word test → check attempt has section_scores

Phase 2 — Backend: Analytics endpoints
  Files: wordTestController.js (+2 functions), wordTestRoutes.js
  Time: 1 day
  Deploy: same Render push
  Test: curl /api/word-tests/analytics with student token

Phase 3 — Frontend: helpers.js + insight engine
  Files: helpers.js, wordTestInsights.js (new), index.html
  Time: 1 day
  Test: Open browser console, call API, run compute()

Phase 4 — Student UI: Word Tests analytics tab
  Files: analytics.js
  Time: 2 days
  Test: Take 2–3 word tests → open Analytics → Word Tests tab

Phase 5 — Teacher UI: Class analytics in admin
  Files: admin.js
  Time: 1 day
  Test: Admin → Tests tab → Analytics sub-panel

Phase 6 — Parent simplified view
  Files: wordTestInsights.js (add renderParentCard)
  Time: 0.5 day
  Test: Parent login → analytics screen
```

**Total estimated time: 6.5 days**

---

## 15. Edge Cases + Guardrails

| Scenario | Handling |
|----------|----------|
| Old attempt has no `section_scores` | Analytics code checks `total > 0` before computing avg; old attempts excluded from section stats |
| Student has 0 attempts | Analytics returns `{ summary: { attempts: 0 } }`; UI shows "No word tests taken yet" |
| All questions are one type (e.g., all spelling) | Other section `total = 0`; those sections not shown in UI |
| Offline — analytics API fails | Serve cached IDB data; show "Last updated X min ago" badge |
| Student cache stale (> 15 min) and offline | Show stale data with warning toast |
| Teacher view — no students have attempted | Show "No attempts yet" state in class analytics |
| `weak_word_ids` word deleted from Word Bank | API joins on `Word` model; missing word silently excluded from display |

---

## 16. Version Bump

After all phases complete:
- Frontend: **v4.4.0** — `Word Test Analytics + Intelligent Insights`
- SW: bump to `v36`
- Backend: no version field, just deploy

---

## 17. Out of Scope (Future)

- Pronunciation via audio recording + speech-to-text grading
- Parent push notifications ("Priya ne aaj test dili")
- Weekly email report to teacher
- Gamification badges for skill improvement

---

*Plan saved: 2026-06-25. Implementation begins on approval.*
