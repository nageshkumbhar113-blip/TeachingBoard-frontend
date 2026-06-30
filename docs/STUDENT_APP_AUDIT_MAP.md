# TeachingBoard — Student App Audit Map

> **Purpose:** Page-by-page reference for auditing the student app.  
> Every screen, module, function, API call, DB call, and key HTML element is listed.  
> Use this to verify wiring, catch regressions, and onboard new developers.  
> **Last updated:** 2026-06-30  
> **App entry:** `student-app/index.html`

---

## Script Load Order (`index.html`)

```
core/db.js          → DB
core/helpers.js     → API
core/sync.js        → SYNC
core/i18n.js        → I18N
student-app/splash.js           → SPLASH
student-app/tts.js              → TTS
student-app/ui.js               → UI
student-app/quiz.js             → QUIZ, RESULTS
student-app/testPlayer.js       → TEST_PLAYER
student-app/analytics.js        → ANALYTICS
student-app/deepStudy.js        → DEEP_STUDY
student-app/dictionary.js       → DICT
student-app/vocabPlayer.js      → VOCAB
student-app/wordTestPlayer.js   → WORD_TEST_PLAYER
student-app/wordTestInsights.js → WORD_TEST_INSIGHTS
student-app/notesPlayer.js      → NOTES_PLAYER
student-app/parentDashboard.js  → PARENT_DASHBOARD
student-app/teacherDashboard.js → TEACHER_DASHBOARD
student-app/student-mobile.js   → (bottom nav wiring, no global)
student-app/app.js              → APP   ← init trigger
```

**Init trigger:** `document.addEventListener('DOMContentLoaded', APP.init)` in `app.js`

---

## Global Routing

| Function | File:Line | Description |
|---|---|---|
| `APP.showScreen(name)` | app.js:1027 | Show `#screen-{name}`, push history |
| `APP.goBack()` | app.js:1094 | Pop history stack, go to prev screen |
| `APP.navigate(name)` | app.js:1101 | Alias for `showScreen` |
| `APP.loadHome()` | app.js:1193 | Clear history + show home screen |
| `APP.refreshHome()` | app.js:~1250 | Re-render home without clearing history |

---

---

## Screen 1 — Splash

**HTML Element:** `#app-splash`  
**Module:** `splash.js` → `SPLASH`  
**Trigger:** Auto-shown on load, dismissed by `SPLASH.done()`

### Key Elements
| ID | Purpose |
|---|---|
| `#app-splash` | Full-screen logo overlay |
| `.splash-logo` | NK Top Education logo image |
| `.splash-dots` | Loading animation dots |

### Functions
| Function | File:Line | Notes |
|---|---|---|
| `SPLASH.done()` | splash.js | Fades out splash, called from `APP.init()` |

### API Calls
- `fetch(API.getApiUrl() + '/health')` — app.js:71 — server wake-up ping (fire-and-forget)

---

## Screen 2 — PIN Lock

**HTML Element:** `#pin-lock-screen`  
**Module:** `app.js` → `APP`  
**Trigger:** `_showPinLock(profile, role)` called from `_runOnboardingIfNeeded()`

### Key Elements
| ID | Purpose |
|---|---|
| `#pin-lock-screen` | PIN lock overlay dialog |
| `#pin-lock-avatar` | First letter of student name |
| `#pin-lock-name` | Student/Teacher/Parent display name |
| `#pin-lock-input` | Password input (numeric) |
| `#pin-lock-error` | Error message (wrong PIN) |
| `#pin-lock-submit` | Unlock button |
| `#pin-lock-switch` | Switch Account button |

### Functions
| Function | File:Line | Notes |
|---|---|---|
| `_showPinLock(profile, role)` | app.js:423 | Shows PIN screen, returns Promise<boolean> |
| `_attempt()` | app.js:455 | Validates entered PIN vs stored PIN |
| `_unlock()` | app.js:449 | Hides screen, resolves promise true |
| `_switchAccount()` | app.js:479 | Clears all profiles, opens Onboarding |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getSetting('student_pin' / 'teacher_pin' / 'parent_pin')` | Fetch stored PIN for comparison |

### Known Issues / Gaps
- No rate limiting on PIN attempts (infinite tries allowed locally)
- `#pin-lock-error` text is hardcoded Marathi — no i18n

---

## Screen 3 — Onboarding (Login / Registration)

**HTML Element:** `#onboarding-screen`  
**Module:** `app.js` → `APP`  
**Trigger:** `_showOnboarding(callback)` — shown for new users or after switch-account

### Key Elements
| ID | Purpose |
|---|---|
| `#onboarding-screen` | Full-screen login card |
| `#ob-role-sub` | Dynamic subtitle per role |
| `.ob-role-tab[data-role]` | Student / Teacher / Parent tab buttons |
| `#ob-student-code` | Student/Teacher/Parent code input |
| `#ob-pin` | PIN input |
| `#ob-server` | Server URL input |
| `#ob-server-field` | Server URL field wrapper (shown/hidden) |
| `#ob-login-btn` | Login / Submit button |
| `#ob-error` | Error message display |
| `#ob-goto-register` | Go to self-registration card link |
| `#reg-card` | Self-registration card (hidden by default) |
| `#reg-name`, `#reg-mobile`, `#reg-school`, `#reg-pin` | Registration form fields |
| `#reg-submit` | Submit registration button |
| `#reg-back` | Back to login link |
| `#reg-error-msg` | Registration error message |
| `#reg-success` | Success message after registration |

### Functions
| Function | File:Line | Notes |
|---|---|---|
| `_showOnboarding(cb, opts)` | app.js:~620 | Renders onboarding modal |
| `_initRegistration()` | app.js:523 | Wires registration card events |
| `_runOnboardingIfNeeded()` | app.js:335 | Checks if onboarding needed, runs login flow |
| `_refreshProfileAfterLogin()` | app.js:510 | Fetches fresh profile after login |

### API Calls
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.loginStudent({student_code, pin, device_id})` | app.js:725 | POST | `/auth/login` |
| `API.loginTeacher(code, pin)` | app.js:706 | POST | `/auth/login` (role=teacher) |
| `API.loginParent(code, pin)` | app.js:715 | POST | `/auth/login` (role=parent) |
| `API.selfRegister({name, mobile, school_name, pin})` | app.js:571 | POST | `/auth/self-register` |
| `API.fetchStudentMe()` | app.js:393 | GET | `/auth/me` |
| `API.updateTeacherDeviceToken(token)` | app.js:846 | PATCH | `/teachers/me/device-token` |
| `API.updateParentDeviceToken(token)` | app.js:847 | PATCH | `/parents/me/device-token` |

### Flow
1. QR scan `?server=<url>` → auto-save server URL
2. Role tab select → adjust label + code placeholder
3. Submit → login API → store profile + PIN in IDB → close onboarding → `loadHome()`
4. Self-register → `selfRegister()` → show "Pending admin approval" message

---

## Screen 4 — Home

**HTML Element:** `#screen-home`  
**Module:** `app.js` → `APP`  
**Trigger:** `APP.loadHome()` — on init, on login, on back-nav

### Key Elements
| ID | Purpose |
|---|---|
| `#home-total-q` | Total questions count stat |
| `#home-total-batch` | Total batches count stat |
| `#home-total-tests` | Total attempts count stat |
| `#batch-grid` | Batch/Class cards grid |
| `#subject-section` | Subject section (hidden until batch selected) |
| `#subject-grid` | Subject cards grid |
| `#chapter-section` | Chapter section (hidden until subject selected) |
| `#chapter-list` | Chapter list items |
| `#btn-deep-study` | Deep Study launch button (hidden until chapter selected) |
| `#lesson-section` | Latest Lessons section |
| `#lesson-list` | Lesson cards |
| `#available-tests-section` | Published Quizzes section |
| `#available-tests-list` | Published quiz cards |
| `#home-recent` | Recent attempts list |
| `#btn-analytics` | Analytics shortcut button |

### Functions (app.js)
| Function | File:Line | Notes |
|---|---|---|
| `loadHome()` | app.js:1193 | Entry point — clears history, shows home |
| `refreshHome()` | app.js:~1250 | Re-renders home stats and batch grid |
| `_renderBatchGrid(batches)` | app.js:~1280 | Renders batch cards in `#batch-grid` |
| `_selectBatch(batch)` | app.js:~1310 | Selects batch, loads subjects |
| `_selectSubject(batch, subject)` | app.js:~1340 | Selects subject, loads chapters |
| `_selectChapter(batch, subject, chapter)` | app.js:~1370 | Selects chapter, shows quiz button |
| `_renderAvailableTests(batch, subject)` | app.js:~1400 | Renders published quizzes for selection |
| `_renderRecentAttempts()` | app.js:~1440 | Renders last N attempts in `#home-recent` |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getAllBatches()` | Batch grid |
| `DB.getSubjectsByBatch(batch)` | Subject grid |
| `DB.getSubjectChapters(batch, subject)` | Chapter list |
| `DB.getQuestionsByBatch(batch)` | Home stats |
| `DB.getAllSessions()` | Recent attempts |
| `DB.getSetting('student_allowed_batches')` | Filter to student's assigned batches |

### Navigation Triggers on Home
| Action | Navigates to |
|---|---|
| Tap batch card | Subject grid (within Home) |
| Tap subject card | Chapter list (within Home) |
| Tap chapter → Start Quiz | `screen-quiz` via `QUIZ.startQuiz()` |
| Tap published quiz | `screen-test-player` via `TEST_PLAYER.startTest()` |
| Tap Deep Study button | `screen-deep-study` via `DEEP_STUDY.open()` |
| Tap Analytics button | `screen-analytics` via `ANALYTICS.open()` |
| Tap lesson card | Opens lesson viewer (inline) |

---

## Screen 5 — Quiz (Practice Mode)

**HTML Element:** `#screen-quiz`  
**Module:** `quiz.js` → `QUIZ`  
**Trigger:** `QUIZ.startQuiz(batch, subject, chapter, mode)` — from Home chapter selection

### Key Elements
| ID | Purpose |
|---|---|
| `#quiz-chapter-name` | Chapter/subject breadcrumb |
| `#quiz-mode-badge` | "Practice" / "Revision" badge |
| `#current-diff-badge` | Difficulty indicator (Easy/Med/Hard) |
| `#quiz-timer` | Per-question countdown timer |
| `#quiz-question-text` | Question body text |
| `#quiz-image-wrap` | Question image container |
| `#quiz-options` | MCQ option buttons container |
| `#quiz-tf-wrap` | True/False buttons |
| `#quiz-fib-wrap` | Fill-in-blank input |
| `#quiz-mtp-wrap` | Match-the-pairs container |
| `#quiz-feedback` | Correct/Wrong feedback bar |
| `#quiz-score` | Live score display |
| `#btn-next-q` | Next question button |
| `#btn-prev-q` | Previous question button |
| `#btn-flag` | Flag question button |
| `#btn-shuffle` | Shuffle toggle |
| `#btn-revision` | Revision mode toggle |
| `#btn-end-quiz` | End session button |
| `#quiz-progress` | Question X of Y indicator |

### Functions (quiz.js)
| Function | File:Line | Notes |
|---|---|---|
| `startQuiz(batch, subject, chapter, mode)` | quiz.js:116 | Entry — loads questions, renders first |
| `loadRemoteQuiz(limit)` | quiz.js:163 | Fallback: fetch from API if DB empty |
| `_renderQuestion()` | quiz.js:172 | Routes to MCQ/TF/FIB/MTP renderer |
| `_renderMCQ(q)` | quiz.js:253 | Renders MCQ options |
| `_selectMCQ(btn, selected, q)` | quiz.js:273 | Handles MCQ selection + feedback |
| `_renderTF(q)` | quiz.js:295 | Renders True/False buttons |
| `_selectTF(btn, selected, q)` | quiz.js:304 | Handles TF selection |
| `_renderFIB(q)` | quiz.js:326 | Renders fill-in-blank input |
| `_submitFIB(q)` | quiz.js:338 | Validates FIB answer |
| `_renderMTP(q)` | quiz.js:360 | Renders match-the-pairs |
| `_startTimer()` | quiz.js:438 | Per-question 30-second countdown |
| `_stopTimer()` | quiz.js:473 | Clears timer interval |
| `_revealAnswer()` | quiz.js:477 | Shows correct answer on timeout |
| `_showFeedback(isCorrect, ...)` | quiz.js:513 | Green/red feedback bar |
| `_recordAnswer(q, given, isCorrect)` | quiz.js:526 | Saves answer to session state |
| `nextQuestion()` | quiz.js:547 | Advances to next question |
| `prevQuestion()` | quiz.js:554 | Goes back one question |
| `flagCurrent()` | quiz.js:559 | Toggles flag on current question |
| `toggleShuffle()` | quiz.js:569 | Shuffles remaining questions |
| `toggleRevision()` | quiz.js:577 | Filters to wrong/flagged only |
| `_endSession()` | quiz.js:586 | Saves session, navigates to Results |
| `_submitSessionToBackend(session)` | quiz.js:606 | Posts attempt to backend |
| `init()` | quiz.js:719 | Wires all button event listeners |

### API Calls
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchQuiz(limit)` | quiz.js:164 | GET | `/questions?limit=N` |
| `API.submitQuiz(session)` | quiz.js:619 | POST | `/attempts` |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getImage(ref)` | Load local question images |
| `DB.getQuestionsByBatch(batch)` | Primary question source |
| `DB.saveSession(session)` | Persist completed session |

---

## Screen 6 — Results

**HTML Element:** `#screen-results`  
**Module:** `quiz.js` → `RESULTS`  
**Trigger:** `RESULTS.show(session, questions)` — called by `QUIZ._endSession()`

### Key Elements
| ID | Purpose |
|---|---|
| `#screen-results` | Results screen container |
| `#results-correct` | Correct count |
| `#results-wrong` | Wrong count |
| `#results-skipped` | Skipped count |
| `#results-score-pct` | Percentage score |
| `#results-time` | Total time taken |
| `#results-chart` | Bar chart SVG/canvas |
| `#results-history` | Previous sessions list |
| `#btn-results-home` | Back to Home button |
| `#btn-retry-quiz` | Retry same chapter button |

### Functions (quiz.js — RESULTS)
| Function | File:Line | Notes |
|---|---|---|
| `show(session, questions)` | quiz.js:762 | Entry — renders complete results |
| `_renderChart(session, questions)` | quiz.js:795 | Subject/chapter performance bar chart |
| `_renderHistory(sessions)` | quiz.js:831 | Lists past sessions |
| `_formatTime(seconds)` | quiz.js:856 | "2m 30s" format |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getAllSessions()` | Recent attempts history in results |

---

## Screen 7 — Test Player (Exam Lock Mode)

**HTML Element:** `#screen-test-player`  
**Module:** `testPlayer.js` → `TEST_PLAYER`  
**Trigger:** `TEST_PLAYER.startTest(quiz_id, mode)` — from published quiz card on Home

### Key Elements
| ID | Purpose |
|---|---|
| `#screen-test-player` | Exam player container |
| `#tp-quiz-title` | Quiz/Exam name |
| `#tp-question-text` | Question body |
| `#tp-image-wrap` | Question image |
| `#tp-options` | MCQ options |
| `#tp-tf-wrap` | True/False buttons |
| `#tp-fib-wrap` | Fill-in-blank input |
| `#tp-mtp-wrap` | Match-the-pairs |
| `#tp-progress` | Q X of Y |
| `#tp-section-badge` | Current section name |
| `#tp-full-timer` | Full exam countdown (hh:mm:ss) |
| `#tp-per-timer` | Per-question timer |
| `#tp-live-score` | Live score (if shown) |
| `#tp-score-display` | Score after submit |
| `#tp-section-chart` | Per-section chart after submit |
| `#tp-wrong-review` | Wrong answers review list |
| `#tp-back-btn` | Back (blocked during exam lock) |
| `#tp-flag-btn` | Flag question |
| `#tp-submit-btn` | Submit test |

### Functions (testPlayer.js)
| Function | File:Line | Notes |
|---|---|---|
| `startTest(quiz_id, mode)` | testPlayer.js:137 | Entry — loads quiz, starts timer |
| `_resolveQuizForStart(quiz_id)` | testPlayer.js:113 | Loads quiz from IDB or API |
| `_loadQuizQuestions(quiz)` | testPlayer.js:234 | Decorates questions for play |
| `_renderQuestion()` | testPlayer.js:306 | Routes to MCQ/TF/FIB/MTP |
| `_renderMCQ(q)` | testPlayer.js:419 | MCQ options |
| `_selectMCQ(btn, selected, q)` | testPlayer.js:445 | MCQ answer selection |
| `_renderTF(q)` | testPlayer.js:466 | T/F rendering |
| `_renderFIB(q)` | testPlayer.js:507 | FIB rendering |
| `_lockExamMode()` | testPlayer.js:777 | Fullscreen + tab-switch 3-strike guard |
| `_unlockExamMode()` | testPlayer.js:845 | Restore normal mode after submit |
| `_startFullTimer(sec)` | testPlayer.js:731 | Full exam countdown |
| `_startPerQTimer(sec)` | testPlayer.js:652 | Per-question countdown |
| `_submitTest()` | testPlayer.js:862 | Calculates score, posts attempt |
| `_showResults(attempt, questions)` | testPlayer.js:934 | Inline results within screen |
| `_renderSectionChart(attempt, questions)` | testPlayer.js:995 | Bar chart by section |
| `_renderWrongReview(attempt, questions)` | testPlayer.js:1031 | Wrong answer review list |
| `_flagCurrentQuestion()` | testPlayer.js:984 | Toggle flag |
| `init()` | testPlayer.js:1132 | Wire all events |

### API Calls
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchPublishedQuizzes()` | (via SYNC) | GET | `/quizzes?status=published` |
| `API.fetchQuizById(quiz_id)` | testPlayer.js:~120 | GET | `/quizzes/:id` |
| `API.submitAttempt(payload)` | testPlayer.js:~900 | POST | `/attempts` |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getImage(ref)` | Question images |
| `DB.getQuizById(quiz_id)` | Load quiz from local cache |
| `DB.saveTestAttempt(attempt)` | Persist attempt locally |

### Special Behaviors
- **Exam Lock:** Fullscreen request + `visibilitychange` listener → 3 tab-switches = auto-submit
- **Per-section timer:** Each section has its own time limit if configured
- **Section navigation:** Only advances forward, cannot go back to previous section

---

## Screen 8 — Analytics

**HTML Element:** `#screen-analytics`  
**Module:** `analytics.js` → `ANALYTICS`  
**Trigger:** `ANALYTICS.open()` — from Home `#btn-analytics` or bottom nav

### Tabs
| Tab | ID | Description |
|---|---|---|
| Overview | `#tab-overview` | Score summary, streak, total stats |
| Performance | `#tab-performance` | Subject-wise performance bars |
| History | `#tab-history` | All past attempt cards |
| Subjects | `#tab-subjects` | Per-subject breakdown |
| Weak Qs | `#tab-weak` | Flagged/weak question list |

### Functions (analytics.js)
| Function | File:Line | Notes |
|---|---|---|
| `open()` | analytics.js:56 | Entry — loads data, renders shell |
| `_loadData()` | analytics.js:64 | Fetches attempts from IDB + syncs |
| `_renderShell()` | analytics.js:84 | Tab bar + container layout |
| `_renderTab(tab)` | analytics.js:117 | Delegates to tab-specific renderer |
| `_renderOverview()` | analytics.js:132 | Stats cards, streak, top subjects |
| `_renderPerformance()` | analytics.js:229 | Per-subject bar charts |
| `_renderHistory()` | analytics.js:373 | All attempts list with delete option |
| `_renderSubjects()` | analytics.js:450 | Subject-level drill-down |
| `_renderWeakQs()` | analytics.js:521 | Wrong/flagged questions with review |
| `_renderWordTestsTab()` | analytics.js:646 | Word test performance (6th tab) |
| `_buildAttemptStats(attempts)` | analytics.js:24 | Aggregates attempt data |
| `init()` | analytics.js:799 | Sets up tab listeners |

### API Calls
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.syncMyAttempts()` | analytics.js:67 | GET | `/attempts/mine` |
| `API.fetchWordTestAnalytics()` | analytics.js:663 | GET | `/word-tests/analytics` |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getAllSessions()` | Local practice attempts |
| `DB.getTestAttempts()` | Exam/published quiz attempts |

### Known Issues
- `APP.confirmAsync` was used for delete — **FIXED** → now `UI.confirmAsync`

---

## Screen 9 — Deep Study (Flashcard Mode)

**HTML Element:** `#screen-deep-study`  
**Module:** `deepStudy.js` → `DEEP_STUDY`  
**Trigger:** `DEEP_STUDY.open(batch, subject, chapter)` — from `#btn-deep-study` on Home

### Key Elements
| ID | Purpose |
|---|---|
| `#ds-breadcrumb` | Batch / Subject / Chapter path |
| `#ds-card-wrap` | Flashcard container (swipeable) |
| `#ds-front` | Card front (question/term) |
| `#ds-back` | Card back (answer/definition) |
| `#ds-reveal-btn` | Reveal answer button |
| `#ds-known-btn` | Mark as Known (right swipe) |
| `#ds-review-btn` | Mark for Review (left swipe) |
| `#ds-progress` | X of Y cards progress |
| `#ds-stats-known` | Known count |
| `#ds-stats-review` | Review count |
| `#ds-minimap` | Dot minimap (known/review/pending) |
| `#ds-summary` | End-of-deck summary card |
| `#ds-retry-weak` | Retry only Review cards button |
| `#ds-restart` | Restart all cards button |
| `#ds-back-btn` | Back to Home |

### Functions (deepStudy.js)
| Function | File:Line | Notes |
|---|---|---|
| `open(batch, subject, chapter)` | deepStudy.js:23 | Entry — loads questions, first card |
| `_renderBreadcrumb()` | deepStudy.js:74 | Shows batch/subject/chapter path |
| `_renderCard()` | deepStudy.js:81 | Renders current flashcard front |
| `_reveal()` | deepStudy.js:163 | Shows card back (answer) |
| `_markKnown()` | deepStudy.js:170 | Marks card Known, advances |
| `_markReview()` | deepStudy.js:176 | Marks card Review, advances |
| `_flyCard(cls, done)` | deepStudy.js:182 | CSS swipe-out animation |
| `_advance()` | deepStudy.js:189 | Moves to next card or summary |
| `_updateProgress()` | deepStudy.js:207 | Updates X/Y counter |
| `_renderMinimap()` | deepStudy.js:247 | Renders dot row status |
| `_showSummary()` | deepStudy.js:265 | End-of-deck stats screen |
| `_retryWeak()` | deepStudy.js:293 | Reloads only Review-marked cards |
| `_restart()` | deepStudy.js:306 | Reset all cards to pending |
| `_setupSwipe(el, signal)` | deepStudy.js:346 | Touch swipe gesture handler |
| `_bindEvents()` | deepStudy.js:318 | Wire all buttons |

### DB Calls
| Call | Purpose |
|---|---|
| `DB.getQuestionsByChapter(batch, subject, chapter)` | Load flashcard questions |

---

## Screen 10 — Vocab / Word Learning

**HTML Element:** `#screen-vocab`  
**Module:** `vocabPlayer.js` → `VOCAB`, `dictionary.js` → `DICT`, `notesPlayer.js` → `NOTES_PLAYER`  
**Trigger:** Bottom nav `#bnav-vocab`, or batch grid card for vocab batch

### Sub-Views (within `#screen-vocab`)
| View | Container | Default |
|---|---|---|
| Test List | `#vocab-test-list-view` | Visible |
| Test Player | `#vocab-player-view` | Hidden |
| Score | `#vocab-score-view` | Hidden |

### Tabs (within Test List view)
| Tab Button | Content Shown |
|---|---|
| `#vocab-tab-learn` (📖 Learn) | `#vocab-dict-view` — Dictionary |
| `#vocab-tab-tests` (📝 Tests) | `#vocab-test-grid` — Vocab test cards |
| `#vocab-tab-word-tests` (🎯 Word Tests) | Routes to `#screen-word-test` |
| `#vocab-tab-notes` (📄 Notes) | `#vocab-notes-panel` — Notes list |

### Key Elements — Vocab Screen
| ID | Purpose |
|---|---|
| `#vocab-back-btn` | Back to Home |
| `#vocab-batch-select` | Course/Batch selector (shown only for multi-batch students) |
| `#vocab-subject-select` | Subject selector dropdown |
| `#vocab-list-title` | Screen title (e.g. "English — Words") |
| `#vocab-test-grid` | Vocab test cards (Test 1, Test 2…) |
| `#vocab-list-empty` | "No words found" empty state |
| `#vocab-add-word-btn` | FAB (+) — Add Unknown Word |

### Key Elements — Vocab Player
| ID | Purpose |
|---|---|
| `#vocab-player-back` | Back to test list |
| `#vocab-player-title` | "Test N" |
| `#vocab-section-label` | "Section 1: Listen" etc. |
| `#vocab-progress-label` | "3 / 20" |
| `#vocab-tts-btn` | Listen button (Section 1) |
| `#vocab-word-display` | Word shown to student |
| `#vocab-phonics-display` | Pronunciation hint |
| `#vocab-options` | MCQ options (Meaning / Picture sections) |
| `#vocab-spelling-input-wrap` | Spelling input (Section 4) |
| `#vocab-spelling-input` | Typing input for spelling |
| `#vocab-feedback` | Correct/Wrong feedback |
| `#vocab-next-btn` | Next question button |

### Key Elements — Add Word Modal
| ID | Purpose |
|---|---|
| `#vocab-add-word-backdrop` | Modal overlay |
| `#vocab-add-context` | "Adding to: Batch / Subject" context label |
| `#vocab-add-subject-row` | Subject selector row (shown when no subject selected) |
| `#vocab-add-subject-sel` | Subject dropdown inside modal |
| `#vocab-add-word-input` | Word text input |
| `#vocab-add-word-autofill` | Auto-fill button |
| `#vocab-add-word-preview` | Shows meaning/phonics preview |
| `#vocab-add-word-err` | Error message |
| `#vocab-add-submit` | "Add to Bank" submit button |
| `#vocab-add-cancel` | Cancel button |

### Functions (vocabPlayer.js)
| Function | File:Line | Notes |
|---|---|---|
| `openVocabScreen(batch, subject)` | vocabPlayer.js:35 | Entry — sets batch/subject, loads test list |
| `_loadTestList()` | vocabPlayer.js:56 | Fetches vocab tests for batch+subject |
| `_populateSubjectSelect()` | vocabPlayer.js:116 | Fills batch + subject dropdowns |
| `_startTest(testNum)` | vocabPlayer.js:190 | Loads test words, shows player |
| `_renderCurrentQuestion()` | vocabPlayer.js:228 | Routes to section renderer |
| `_renderListenQuestion(word)` | vocabPlayer.js:279 | TTS + MCQ meaning options |
| `_renderMeaningQuestion(word)` | vocabPlayer.js:302 | Show word, pick meaning |
| `_renderPictureQuestion(word)` | vocabPlayer.js:312 | Show picture, pick word |
| `_renderSpellingQuestion(word)` | vocabPlayer.js:324 | Type the word |
| `_renderMCQOptions(correctWord, field)` | vocabPlayer.js:348 | 4-option MCQ buttons |
| `_checkMCQ(selected, correct, btn)` | vocabPlayer.js:390 | Validate MCQ answer |
| `_checkSpelling(word)` | vocabPlayer.js:405 | Validate spelling input |
| `_recordAnswer(isCorrect)` | vocabPlayer.js:419 | Track per-word score |
| `_showFeedback(isCorrect, correctAnswer)` | vocabPlayer.js:426 | Feedback text |
| `_nextSection() / _advance()` | vocabPlayer.js:457/466 | Progress through sections |
| `_submitTest()` | vocabPlayer.js:479 | Post attempt to backend |
| `_openAddWord()` | vocabPlayer.js:522 | Opens Add Word modal (async) |
| `_autoFillAddWord()` | vocabPlayer.js:563 | AI auto-fill meaning/phonics |
| `_submitAddWord()` | vocabPlayer.js:592 | Saves word to word bank |
| `_showView(name)` | vocabPlayer.js:676 | Switch between test-list/player/score |
| `init()` | vocabPlayer.js:696 | Wire all events |

### API Calls — vocabPlayer.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.getStudentProfile()` | :117 | IDB | Local cache |
| `API.fetchStudentMe()` | :123 | GET | `/auth/me` |
| `API.fetchVocabSubjects(batch)` | :153 | GET | `/vocab/subjects?batch=` |
| `API.fetchVocabTestList(batch, subject)` | :85 | GET | `/vocab/tests?batch=&subject=` |
| `API.fetchVocabTest(testNum, batch, subject, lang)` | :205 | GET | `/vocab/tests/:num?batch=&subject=` |
| `API.submitVocabAttempt(payload)` | :504 | POST | `/vocab/attempt` |
| `API.fetchVocabSubjects(batch)` | :539 | GET | `/vocab/subjects?batch=` (modal) |
| `API.autoFillWordForStudent(word)` | :574 | GET | `/vocab/auto-fill?word=` |
| `API.addStudentWord(data)` | :597 | POST | `/student/words` |

---

### Sub-screen 10a — Dictionary (Learn Tab)

**Module:** `dictionary.js` → `DICT`  
**Container:** `#vocab-dict-view`

| ID | Purpose |
|---|---|
| `#dict-search-input` | Search/filter input |
| `#dict-search-clear` | Clear search button |
| `#dict-word-list` | Word cards list |
| `#dict-empty` | Empty state message |
| `#dict-pagination` | Prev/Next page navigation |

### Functions (dictionary.js)
| Function | File:Line | Notes |
|---|---|---|
| `openDictScreen(batch, subject)` | dictionary.js:23 | Entry — loads first page |
| `_loadPage(page, query)` | dictionary.js:38 | Fetches paginated word list |
| `_makeCard(word)` | dictionary.js:82 | Renders individual word card |
| `_renderVisual(el, word)` | dictionary.js:126 | Image/emoji visual for word |
| `_renderPagination(...)` | dictionary.js:169 | Prev/Next page buttons |
| `_openAddWord(word)` | dictionary.js:240 | Opens Add Word modal for specific word |
| `_onSearchInput(e)` | dictionary.js:260 | Debounced search handler |
| `init()` | dictionary.js:270 | Wire search events |

### API Calls — dictionary.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchVocabDictionary(batch, subject, page, q)` | :57 | GET | `/vocab/dictionary?batch=&subject=&page=&q=` |

---

### Sub-screen 10b — Notes (Notes Tab)

**Module:** `notesPlayer.js` → `NOTES_PLAYER`  
**Container:** `#vocab-notes-panel`

| ID | Purpose |
|---|---|
| `#vocab-notes-panel` | Notes list panel |
| `#notes-viewer-overlay` | Full-screen PDF viewer overlay |
| `#notes-viewer-title` | Note title in viewer |
| `#notes-canvas` | PDF render canvas |
| `#notes-prev-page` | Previous page button |
| `#notes-next-page` | Next page button |
| `#notes-page-label` | "Page X of Y" |
| `#notes-close` | Close PDF viewer |

### Functions (notesPlayer.js)
| Function | File:Line | Notes |
|---|---|---|
| `loadNotesList(batch, subject)` | notesPlayer.js:299 | Fetches and renders notes list |
| `openNote(noteId, title, studentCode)` | notesPlayer.js:241 | Opens PDF viewer |
| `_loadPdf(noteId, studentCode)` | notesPlayer.js:178 | Downloads + decrypts PDF |
| `_renderPage(num)` | notesPlayer.js:97 | Renders one PDF page to canvas |
| `_setupPinchZoom(canvas)` | notesPlayer.js:124 | Touch pinch-zoom on canvas |
| `_setupSwipe(el)` | notesPlayer.js:158 | Swipe left/right to turn pages |
| `_addWatermark(canvas)` | notesPlayer.js:69 | Student name + date watermark |
| `_closeViewer()` | notesPlayer.js:290 | Closes PDF overlay |
| `init()` | notesPlayer.js:355 | Wire close/page buttons |

### API Calls — notesPlayer.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchStudentNotes(batch, subject)` | :306 | GET | `/notes?batch=&subject=` |
| `API.fetchNoteView(noteId)` | :207 | GET | `/notes/:id/view` |
| `API.getStudentProfile()` | :272,:315 | IDB | Local cache |

---

## Screen 11 — Word Tests

**HTML Element:** `#screen-word-test`  
**Module:** `wordTestPlayer.js` → `WORD_TEST_PLAYER`  
**Trigger:** `WORD_TEST_PLAYER.openWordTestScreen(batch, subject)` — from `#vocab-tab-word-tests` tab

### Sub-Views
| View | Container | Default |
|---|---|---|
| List | `#wtp-list-view` | Visible |
| Player | `#wtp-player-view` | Hidden |
| Score | `#wtp-score-view` | Hidden |

### Key Elements — List View
| ID | Purpose |
|---|---|
| `#wtp-back-btn` | Back to Vocab screen |
| `#wtp-list-title` | "Word Tests" title |
| `#wtp-test-grid` | Test cards grid |
| `#wtp-list-empty` | Empty state |

### Key Elements — Player View
| ID | Purpose |
|---|---|
| `#wtp-player-back` | Back (with progress-loss confirm) |
| `#wtp-player-title` | Test name |
| `#wtp-progress` | "Q 1 / 10" |
| `#wtp-type-label` | Question type label |
| `#wtp-question-text` | Question text |
| `#wtp-audio-area` | TTS listen button area |
| `#wtp-tts-btn` | Listen button |
| `#wtp-options-area` | MCQ options |
| `#wtp-typing-area` | Typing input area |
| `#wtp-type-input` | Typing input field |
| `#wtp-type-submit` | Submit typed answer |
| `#wtp-next-btn` | Next question |

### Key Elements — Score View
| ID | Purpose |
|---|---|
| `#wtp-score-back` | Back to list |
| `#wtp-score-total` | "8 / 10" score |
| `#wtp-pass-badge` | "🎉 Passed!" (if ≥ pass threshold) |
| `#wtp-fail-badge` | "📚 Keep Practicing!" |
| `#wtp-review-list` | Wrong answers review |
| `#wtp-score-home-btn` | Back to Tests button |

### Functions (wordTestPlayer.js)
| Function | File:Line | Notes |
|---|---|---|
| `openWordTestScreen(batch, subject)` | wordTestPlayer.js:55 | Entry — loads test list |
| `_loadList()` | wordTestPlayer.js:64 | Fetches available word tests |
| `_startTest(testId, title)` | wordTestPlayer.js:118 | Loads test, renders first question |
| `_renderQuestion()` | wordTestPlayer.js:145 | Routes by question type |
| `_renderOptions(q)` | wordTestPlayer.js:199 | MCQ options |
| `_renderVisual(opt)` | wordTestPlayer.js:228 | Image/emoji/colour for option |
| `_selectOption(btn, optId, q)` | wordTestPlayer.js:243 | MCQ selection + feedback |
| `_submitTyping(q)` | wordTestPlayer.js:256 | Validates typed answer |
| `_nextQuestion()` | wordTestPlayer.js:283 | Advance or submit |
| `_doSubmitTest()` | wordTestPlayer.js:290 | Posts attempt, shows score |
| `_showScoreView()` | wordTestPlayer.js:306 | Renders final score card |
| `_renderReview(correctAnswers)` | wordTestPlayer.js:321 | Wrong answers with correct shown |
| `_speakWord(word)` | wordTestPlayer.js:355 | TTS for audio questions |
| `_init()` | wordTestPlayer.js:377 | Wire all events |

### API Calls — wordTestPlayer.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchStudentWordTests(batch, subject)` | :83 | GET | `/word-tests?batch=&subject=` |
| `API.fetchStudentWordTest(testId)` | :129 | GET | `/word-tests/:id` |
| `API.submitWordTestAttempt(payload)` | :296 | POST | `/word-tests/:id/attempt` |

### Known Issues
- `APP.confirmAsync` for back-button confirm — **FIXED** → now `UI.confirmAsync`

---

## Screen 12 — Parent Dashboard

**HTML Element:** `#screen-parent-dashboard`  
**Module:** `parentDashboard.js` → `PARENT_DASHBOARD`  
**Trigger:** Auto-shown if `parentProfile` found in `_runOnboardingIfNeeded()` → `_showParentDashboard()`

### Tabs
| Tab | Content |
|---|---|
| Children | List of children linked to parent |
| Analytics | Child's attempt history + stats |
| Fee | Fee records for child |

### Functions (parentDashboard.js)
| Function | File:Line | Notes |
|---|---|---|
| `init()` | parentDashboard.js:15 | Wire tab clicks, back button |
| `loadDashboard()` | parentDashboard.js:25 | Entry — fetches children list |
| `_showChildList()` | parentDashboard.js:45 | Renders children cards |
| `_renderChildList()` | parentDashboard.js:56 | HTML for each child card |
| `_openChildDetail(studentCode)` | parentDashboard.js:95 | Open tabs for specific child |
| `_loadTab(studentCode)` | parentDashboard.js:128 | Loads active tab data |
| `_loadAnalytics(studentCode)` | parentDashboard.js:135 | Fetches child's attempts |
| `_buildAnalytics(attempts)` | parentDashboard.js:153 | Stats + chart rendering |
| `_loadFee(studentCode)` | parentDashboard.js:223 | Fetches fee records |
| `_buildFeeCard(r)` | parentDashboard.js:240 | Renders fee record card |

### API Calls — parentDashboard.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchParentChildren()` | :34 | GET | `/parents/me/children` |
| `API.fetchChildAttempts(studentCode)` | :141 | GET | `/parents/me/children/:code/attempts` |
| `API.fetchChildFee(studentCode)` | :229 | GET | `/parents/me/children/:code/fee` |

---

## Screen 13 — Teacher Dashboard

**HTML Element:** `#screen-teacher-dashboard`  
**Module:** `teacherDashboard.js` → `TEACHER_DASHBOARD`  
**Trigger:** Auto-shown if `teacherProfile` found → `_showTeacherDashboard()`

### Tabs
| Tab ID | Content |
|---|---|
| `td-tab-students` | Student list + detail + notifications |
| `td-tab-analytics` | Teacher analytics (weekly/monthly/ranking) |
| `td-tab-vocab` | Vocab scores per student/batch |
| `td-tab-fee` | Fee management (configs, records, UPI) |

### Functions (teacherDashboard.js)
| Function | File:Line | Notes |
|---|---|---|
| `init()` | teacherDashboard.js:19 | Wire tabs, back, refresh |
| `loadDashboard()` | teacherDashboard.js:115 | Entry — fetches student list |
| `_switchTab(tab)` | teacherDashboard.js:45 | Switch active tab |
| `_showStudentList()` | teacherDashboard.js:131 | Render all students |
| `_renderStudentList()` | teacherDashboard.js:139 | Student cards HTML |
| `_openStudentDetail(studentCode)` | teacherDashboard.js:178 | Student attempt history |
| `_loadStudentNotifHistory(code)` | teacherDashboard.js:230 | Notification history for student |
| `_loadAllNotifHistory()` | teacherDashboard.js:252 | All notifications history |
| `_openModal(mode, studentCode)` | teacherDashboard.js:287 | Open send-notification modal |
| `_populateBatchSelect()` | teacherDashboard.js:327 | Fill batch selector in modal |
| `_handleSend()` | teacherDashboard.js:343 | Send push notification |
| `_loadAnalytics()` | teacherDashboard.js:393 | Fetch teacher analytics |
| `_renderAnalytics(...)` | teacherDashboard.js:413 | Bar charts + topic lists |
| `_initVocabTab()` | teacherDashboard.js:540 | Wire vocab tab selectors |
| `_loadVocabScores()` | teacherDashboard.js:576 | Fetch vocab scores table |
| `_initFeeTab()` | teacherDashboard.js:634 | Wire fee tab buttons |
| `_loadFeeConfigs()` | teacherDashboard.js:705 | Fetch all fee configs |
| `_renderFeeConfigs()` | teacherDashboard.js:718 | Render fee config cards |
| `_openFeeRecords(feeConfigId)` | teacherDashboard.js:771 | Open records for a config |
| `_addFeePayment(recordId, configId)` | teacherDashboard.js:977 | Mark payment received |
| `_closeFeeConfig(feeConfigId)` | teacherDashboard.js:1011 | Close/archive fee config |
| `_openUpdateDueDateModal(feeConfigId)` | teacherDashboard.js:1022 | Update due date |
| `_openFeeCreateModal()` | teacherDashboard.js:1030 | Create new fee config |

### API Calls — teacherDashboard.js
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchTeacherStudents()` | :121 | GET | `/teachers/me/students` |
| `API.fetchStudentAttemptsForTeacher(code)` | :197 | GET | `/teachers/me/students/:code/attempts` |
| `API.fetchTeacherNotificationHistory(...)` | :239,:258 | GET | `/teachers/me/notifications` |
| `API.sendTeacherNotification(payload)` | :373 | POST | `/teachers/me/notifications` |
| `API.fetchTeacherWeekly()` | :400 | GET | `/teachers/me/analytics/weekly` |
| `API.fetchTeacherMonthly()` | :401 | GET | `/teachers/me/analytics/monthly` |
| `API.fetchTeacherWeakTopics()` | :402 | GET | `/teachers/me/analytics/weak-topics` |
| `API.fetchTeacherStrongTopics()` | :403 | GET | `/teachers/me/analytics/strong-topics` |
| `API.fetchTeacherRanking()` | :404 | GET | `/teachers/me/analytics/ranking` |
| `API.fetchTeacherVocabScores(...)` | :585 | GET | `/teachers/me/vocab-scores` |
| `API.fetchFeeUpiConfig()` | :647 | GET | `/fee/upi-config` |
| `API.updateFeeUpiSettings(data)` | :693 | PATCH | `/fee/upi-config` |
| `API.listFeeConfigs()` | :710 | GET | `/fee/configs` |
| `API.getFeeRecords(feeConfigId)` | :786 | GET | `/fee/configs/:id/records` |
| `API.addFeePayment(recordId, ...)` | :986 | POST | `/fee/records/:id/payments` |
| `API.updateFeeNextInstallment(...)` | :970 | PATCH | `/fee/records/:id/next-installment` |
| `API.closeFeeConfig(feeConfigId)` | :1014 | PATCH | `/fee/configs/:id/close` |
| `API.updateFeeDueDate(...)` | :1025 | PATCH | `/fee/configs/:id/due-date` |
| `API.createFeeConfig(payload)` | :1117 | POST | `/fee/configs` |

### Known Issues
- `APP.confirmAsync` / `APP.promptAsync` — **FIXED** → `UI.confirmAsync` / `UI.promptAsync`

---

## Overlay — Profile / Account Settings

**Not a screen — rendered as dynamic overlay**  
**Module:** `app.js` → `APP`  
**Trigger:** Profile button in top-right header

### Key Elements (dynamically created)
| Class | Purpose |
|---|---|
| `.profile-overlay` | Full overlay backdrop |
| `.profile-sheet` | Bottom sheet card |

### Functions
| Function | File:Line | Notes |
|---|---|---|
| `_openProfileSettings()` | app.js:877 | Creates + shows profile overlay |

### Info Shown
- Student name + code + batch(es)
- Switch Account button → clears session → Onboarding

---

## Overlay — App Update Banner + Sheet

**Not a screen — injected into DOM**  
**Module:** `app.js` → `APP`

| ID | Purpose |
|---|---|
| `#update-banner` | Top update notification strip |
| `#update-banner-text` | "Update v5.x available" |
| `#update-banner-btn` | Opens update sheet |
| `#update-sheet-backdrop` | Sheet backdrop |
| `#update-sheet` | Update details bottom sheet |
| `#update-cur-ver` | Current version display |
| `#update-new-ver` | New version display |
| `#update-notes` | Release notes text |
| `#btn-download-update` | Download APK button |
| `#update-sheet-close` | Close sheet button |

### API Calls
| Call | File:Line | HTTP | Endpoint |
|---|---|---|---|
| `API.fetchLatestAppVersion()` | app.js:232 | GET | `/app-versions/latest` |

---

## Bottom Navigation (student-mobile.js)

| Button ID | Action |
|---|---|
| `#bnav-home` | `APP.loadHome()` |
| `#bnav-analytics` | `ANALYTICS.open()` |
| `#bnav-vocab` | `VOCAB.openVocabScreen(batch, subject)` |
| `#bnav-mode` | Toggle Normal ↔ Board mode |

---

## Word Test Insights Module

**Module:** `wordTestInsights.js` → `WORD_TEST_INSIGHTS`  
**Used by:** `analytics.js` `_renderWordTestsTab()` — renders insight cards inside Analytics screen

### Functions (wordTestInsights.js)
| Function | File:Line | Notes |
|---|---|---|
| `compute(analytics)` | wordTestInsights.js:57 | Compute skill bars from attempt data |
| `renderInsightsCard(insights, container)` | wordTestInsights.js:156 | Render skill card into container |
| `renderParentCard(insights, analytics, container)` | wordTestInsights.js:203 | Parent-friendly summary card |

---

## Background / Sync (SYNC module)

**Module:** `core/sync.js` → `SYNC`  
**Called by:** `APP._startBackground()`

| Function | Trigger | What it does |
|---|---|---|
| `SYNC.autoSyncStudent()` | App start | Replay pending attempts + fetch new quizzes |
| `SYNC.fetchQuizzes({status:'published'})` | App start fallback | Fetch published quizzes to IDB |
| `SYNC.stopStudentAutoSync()` | Switch account | Stop sync cycle |

---

## Known Issues & Security Gaps

> Found during 2026-06-30 audit. Sorted by severity.

| # | Severity | Issue | Location | Notes |
|---|---|---|---|---|
| 1 | 🔴 HIGH | **Exam lock bypassable** via browser DevTools — state variables modifiable from console | testPlayer.js | No server-side enforcement of exam rules |
| 2 | 🔴 HIGH | **Notes encryption uses `student_code` as key** — leakable if student_code is known | notesPlayer.js:41 | AES-GCM key derived from student_code + note_id |
| 3 | 🔴 HIGH | **PDF watermark is client-side only** — no server-side watermarking, removable | notesPlayer.js:69 | Canvas overlay only; original PDF unmodified |
| 4 | 🟠 WARN | **Tab blur detection unreliable** — triggers on browser extensions, system notifications | testPlayer.js:777 | `visibilitychange` + `blur` both fire on extension popups |
| 5 | 🟠 WARN | **Multi-student cache not cleared on switch** — some session/IDB data may persist across Switch Account | app.js:479 | Only profile + token cleared; questions/sessions remain |
| 6 | 🟠 WARN | **PIN has no rate-limit** — infinite local attempts, no lockout after N wrong tries | app.js:455 | Server not involved in PIN check |
| 7 | 🟠 WARN | **No offline pre-download for quizzes** — first access requires internet | testPlayer.js | Quiz only cached after first `fetchQuizById` succeeds |
| 8 | 🟡 INFO | **Touch targets < 48px** on some quiz option buttons — accessibility failure on small phones | student-ui.css | WCAG 2.1 minimum is 44×44px |
| 9 | 🟡 INFO | **FIB exact-match only** — no fuzzy/partial matching, typos counted wrong | quiz.js:338 | Case-insensitive but whitespace-sensitive |
| 10 | 🟡 INFO | **No spaced repetition** in Deep Study — simple Known/Review without SRS scheduling | deepStudy.js | All cards reset on restart |
| 11 | 🟡 INFO | **Subjects/chapters load from local IDB only** on Home screen — no server fallback if stale | app.js:~1280 | Stale data until next full sync |

---

## Quick Audit Checklist

Use this for every page/feature audit:

- [ ] HTML ID exists for every `$id('...')` call in that module
- [ ] Every `API.xxx()` call has a matching export in `core/helpers.js`
- [ ] Every `DB.xxx()` call has a matching export in `core/db.js`
- [ ] Every `MODULE.fn()` call is in that module's `return {}` block
- [ ] `APP.confirmAsync` / `APP.promptAsync` NOT used in student-app → use `UI.*` instead
- [ ] All screen names in `showScreen('name')` match an existing `#screen-name` element
- [ ] New JS/CSS files added to `sw.js` STATIC_FILES cache list
- [ ] Multi-batch students: `#vocab-batch-select` shown, subjects reload on batch change
- [ ] Add Word modal: `#vocab-add-subject-row` shown when no subject pre-selected
- [ ] Batch delete: server cascade confirmed — words, users, fee configs all cleaned
- [ ] Batch rename: all 10 collections updated via `PUT /api/batches/:name`
- [ ] After account switch: confirm IDB questions/sessions don't bleed to next user
