# TeachingBoard — Master Feature Plan
_Last updated: 2026-06-21_

---

## Already Completed ✅

| Feature | Files |
|---|---|
| FCM push notifications (teacher + parent) | `fcm.js`, `server.js`, `attemptController.js` |
| Teacher device token | `teacherController.js`, `teacherRoutes.js` |
| Parent device token | `parentController.js`, `parentRoutes.js` |
| Attempt complete → FCM to teacher + parent | `attemptController.js` |
| Teacher batch/individual notification + history | `notificationController.js`, `teacherRoutes.js` |
| Teacher dashboard notification tab (send + history) | `teacherDashboard.js`, `index.html` |
| KaTeX math rendering (all 4 question types) | `core/math.js`, `testPlayer.js`, `quiz.js`, `deepStudy.js`, `admin.js` |
| Admin question editor live preview | `admin.js`, `admin.html`, `admin-ui.css` |
| Bug: teacher PIN → student dashboard fix | `app.js` (`_isTeacherOrParentMode`) |
| Bug: student sync in teacher mode fix | `app.js` (`_startBackground`) |
| Bug: math symbols in bulk import | `admin-app/parser.js` (`_stripMd`) |
| KaTeX ChatGPT delimiter support (`\(...\)`) | `core/math.js` |

---

## Vocabulary / Word Learning — Full Plan

### Architecture

```
Admin adds words  ──┐
Student adds words ──┤──► words collection (per batch+subject)
                     │
                     ▼
         Sequential 20-word batches
         Test 1: words 1-20
         Test 2: words 21-40
         ...
         10,000 words → 500 tests

Student takes test → vocab_attempts collection
                   → FCM to teacher + parent

Teacher sees:
  Vocab Scores tab → Listen% | Meaning% | Picture% | Spelling%
```

---

## Phase 1 — Backend (5 files) `[PENDING]`

### 1a. `src/models/Word.js` (NEW)
```
word_id, word, batch, subject,
meaning_mr, meaning_en, pronunciation, phonics,
image_url, difficulty, tags,
added_by ('admin'|'student'), added_by_code,
seq_num (auto-assign order), created_at
```
Indexes: `{ batch, subject }`, `{ word: 'text' }`, `{ batch, subject, seq_num }`

### 1b. `src/models/VocabAttempt.js` (NEW)
```
attempt_id, student_code, student_name,
batch, subject, test_num,
word_from, word_to,
score_listen, score_meaning, score_picture, score_spelling,
total_score, total_possible,
passed (≥60%), submitted_at
```
Indexes: `{ student_code }`, `{ batch, subject }`, `{ student_code, test_num, batch, subject }`

### 1c. `src/controllers/wordController.js` (NEW)
Routes (all require auth):

| Method | Path | Auth | Action |
|---|---|---|---|
| GET | `/api/admin/words` | admin | list words (paginated, search, filter) |
| POST | `/api/admin/words` | admin | add single word |
| PATCH | `/api/admin/words/:id` | admin | update word |
| DELETE | `/api/admin/words/:id` | admin | delete word |
| POST | `/api/admin/words/bulk` | admin | bulk add (array of words) |
| POST | `/api/admin/words/auto-fill` | admin | proxy → Free Dict + MyMemory |
| GET | `/api/vocab/test-list` | student | list available tests for batch+subject |
| GET | `/api/vocab/test/:num` | student | generate 20 Qs on-demand |
| POST | `/api/vocab/attempt` | student | submit score → FCM notify |
| POST | `/api/student/words` | student | add unknown word to bank |
| GET | `/api/teacher/vocab-scores` | teacher | per-student vocab breakdown |

### 1d. `src/routes/wordRoutes.js` (NEW)
Three routers: `adminWordRouter`, `vocabRouter`, `studentWordRouter`

### 1e. `src/app.js` (EDIT — 3 lines)
```js
const { adminWordRouter, vocabRouter, studentWordRouter } = require('./routes/wordRoutes');
app.use('/api/admin/words', adminWordRouter);
app.use('/api/vocab',       vocabRouter);
app.use('/api/student',     studentWordRouter);
```

---

## Phase 2 — Admin UI (2 files) `[PENDING]`

### 2a. `admin-app/admin.html` (EDIT)
Add **📚 Words** tab (4th tab) with 3 sub-sections:

**Word Bank sub-tab:**
- Search + batch/subject filter
- Word list (50/page, paginated)
- Edit/Delete per row

**Bulk Import sub-tab:**
- Textarea: paste words (one per line OR `word | meaning_mr | phonics`)
- [🔍 Auto-fill All] → progress bar → preview table → [💾 Save All]

**Generate Test sub-tab:**
- Batch + Subject select
- Shows: total words, tests available (word_count ÷ 20)
- [⚡ Generate Test List] → shows test 1, 2, 3... with status

### 2b. `admin-app/admin.js` (EDIT)
- `_loadWordBank()` — paginated list
- `_openWordEditor(word)` — add/edit modal
- `_autoFillWord(word)` — call `/api/admin/words/auto-fill`
- `_bulkImportWords()` — parse paste, auto-fill loop with progress
- `_generateVocabTests()` — show test list

---

## Phase 3 — Student App (3 files) `[PENDING]`

### 3a. `student-app/index.html` (EDIT)
Add **Word Learning** screen:
- Subject + batch selector
- Test list grid (Test 1 ✅, Test 2 ▶, Test 3 🔒...)
- Vocab question card (reuses question-card styling)
- 🔊 TTS button for listen type
- "Word Add" modal (type word → auto-fill → submit)

### 3b. `student-app/vocabPlayer.js` (NEW)
- `loadTestList(batch, subject)` — fetch + render test grid
- `startTest(testNum)` — fetch 20 Qs, render one by one
- `_renderVocabQuestion(q)` — handle 4 sub-types
  - `listen`: TTS.speak(word) auto + 🔊 replay
  - `meaning`: standard MCQ
  - `picture`: image_url show (if null → word large)
  - `spelling`: phonics styled display
- `submitVocabTest(answers)` — POST attempt → show score breakdown
- `addUnknownWord(word)` — auto-fill → POST to student words

### 3c. `student-app/app.js` (EDIT — minimal)
- Wire vocab screen into navigation
- Add `loadVocabSection()` call

---

## Phase 4 — Vocab Push Notifications `[PENDING]`

**In `wordController.js` → `submitVocabAttempt()`:**

```
Student submits vocab test score
→ Find teacher(s) assigned to student (device_token)
→ Find parent(s) linked to student (device_token)
→ FCM message:
   Title: "📚 Vocabulary Test ${testNum} Complete"
   Body:  "${studentName} — ${totalScore}/${totalPossible} (${pct}%)"
   Data:  { student_code, test_num, batch, subject, type: 'vocab' }
→ sendToMany(tokens, title, body, data)
→ Save to notifications collection (type: 'vocab')
```

**Teacher dashboard notification history** — vocab attempts also show with 📚 tag.

---

## Phase 5 — Teacher Vocab Dashboard `[PENDING]`

### `student-app/teacherDashboard.js` (EDIT)
Add **📚 Vocab** tab (4th tab after Notifications):

Per-student vocab card shows:
```
Rahul Sharma
Listen   ████████░░ 80%
Meaning  ██████████ 95%
Picture  ███████░░░ 70%
Spelling ████████░░ 82%

Tests completed: 5/10 available
```

Backend aggregates last N attempts per student per sub-type.

---

## Phase 6 — `core/helpers.js` (EDIT) `[PENDING]`

New API functions:
```js
// Admin
autoFillWord(word)
fetchAdminWords({ batch, subject, search, skip, limit })
createAdminWord(data)
updateAdminWord(id, data)
deleteAdminWord(id)
bulkCreateAdminWords(words[])

// Student
fetchVocabTestList(batch, subject)
fetchVocabTest(testNum, batch, subject)
submitVocabAttempt(payload)
addStudentWord(data)

// Teacher
fetchTeacherVocabScores()
```

---

## Notification Analytics — Summary

| Event | Who gets notified | Channel |
|---|---|---|
| Student completes quiz/test | Teacher + Parent | FCM push |
| Student completes vocab test | Teacher + Parent | FCM push |
| Teacher sends batch notification | All batch parents | FCM push |
| Teacher sends individual notification | Specific student's parent | FCM push |

All notifications stored in `notifications` collection.
Teacher can view history in Notifications tab (existing).
Vocab notifications show with 📚 tag.

---

## File Change Summary

### New Files (7)
```
TeachingBoard-backend/src/models/Word.js
TeachingBoard-backend/src/models/VocabAttempt.js
TeachingBoard-backend/src/controllers/wordController.js
TeachingBoard-backend/src/routes/wordRoutes.js
student-app/vocabPlayer.js
```

### Edited Files (7)
```
TeachingBoard-backend/src/app.js          (+3 lines)
admin-app/admin.html                       (Words tab)
admin-app/admin.js                         (word CRUD + bulk + auto-fill)
student-app/index.html                     (vocab screen)
student-app/app.js                         (vocab nav wire)
student-app/teacherDashboard.js            (vocab scores tab)
core/helpers.js                            (vocab API functions)
```

---

## Implementation Order

```
Phase 1 → Backend (models + controller + routes)   ← START HERE
Phase 2 → Admin UI (word bank + bulk import)
Phase 6 → core/helpers.js (API functions)          ← alongside Phase 2
Phase 3 → Student vocab player
Phase 4 → FCM notifications (inside Phase 1 submit)
Phase 5 → Teacher vocab dashboard
```

---

## Progress Tracker

- [x] Phase 1 — Backend (Word.js, VocabAttempt.js, wordController.js, wordRoutes.js, app.js)
- [x] Phase 2 — Admin UI (Words tab + word editor modal + bulk import in admin.html + admin.js + admin-ui.css)
- [x] Phase 3 — Student Vocab Player (vocabPlayer.js + vocab screen in index.html + CSS)
- [x] Phase 4 — Vocab Push Notifications (inside wordController.js submitAttempt → FCM)
- [x] Phase 5 — Teacher Vocab Dashboard (vocab tab in teacherDashboard.js + index.html + CSS)
- [x] Phase 6 — helpers.js API functions (all vocab + admin word + teacher vocab score functions)
- [x] meaning_lang option (English/Marathi) — on test-list screen + stored in VocabAttempt

---

## Notes Feature — Secure PDF Viewer with Local Cache
_Last updated: 2026-06-24_

### Goal
Admin PDF upload करतो → Cloudinary वर store होतो → Student mobile वर beautifully reads it,
page-by-page, pinch zoom, repeated watermark. **Student ला कधीही Cloudinary URL दिसत नाही.**
**Second open onwards: IndexedDB encrypted cache वापरतो — bandwidth zero.**

---

### Complete Architecture (Upload + Proxy + Local Cache)

#### Admin Upload Flow
```
Admin selects PDF  (browser file input, 10 MB max)
  ↓
FileReader.readAsDataURL()  → base64 string in browser RAM
  ↓
POST /api/admin/notes/upload   { title, batch, subject, data: "data:application/pdf;base64,..." }
  ↓  (express.json limit 10MB on this route only)
Backend:
  • validate size < 10MB
  • cloudinary.uploader.upload(base64, { resource_type:'raw', folder:'teachingboard/notes' })
  • Note.create({ title, batch, subject, cloudinary_url, cloudinary_public_id, file_size_bytes })
  ↓
Response → { success: true, note_id, title }   ← NO URL in response
```

#### Student View Flow — First Open (Download & Cache)
```
Student taps note  (note_id known from list)
  ↓
notesPlayer.js: check IndexedDB 'notes_cache' for note_id
  ↓ MISS
helpers.fetchNoteView(note_id)
  ↓
GET /api/notes/:id/view   (student JWT)
  Backend:
    1. requireStudent → req.userDoc from DB
    2. Note.findOne({ note_id, status:'active' })
    3. BATCH GATE: if req.userDoc.batch !== note.batch → 403
    4. Note.updateOne({ $inc: { view_count: 1 } })
    5. fetch(note.cloudinary_url)  ← server-side only, URL never leaves server
    6. Stream to student:
         Content-Type: application/pdf
         Content-Disposition: inline
         Cache-Control: private, no-store
  ↓
Student receives ArrayBuffer (raw PDF bytes)
  ↓
Encrypt with AES-256-GCM   (key = PBKDF2 of student_code + note_id)
  ↓
Store in IndexedDB 'notes_cache':
  { note_id, data: encryptedBuffer, iv: Uint8Array(12), cached_at, expires_at: +7days }
  ↓
PDF.js: getDocument({ data: decryptedBuffer }).promise
  ↓
Canvas render + watermark + pinch zoom
```

#### Student View Flow — Second Open (From Cache)
```
Student taps note  (note_id known)
  ↓
notesPlayer.js: check IndexedDB 'notes_cache' for note_id
  ↓ HIT (expires_at > now)
Decrypt: AES-256-GCM (same derived key)
  ↓
PDF.js: getDocument({ data: decryptedBuffer }).promise
  ↓
Canvas render + watermark    ← NO network request, ZERO bandwidth
```

#### Cache Expiry & Invalidation
```
Cache entry expires:   7 days after download  (expires_at field)
Note deleted by admin: note_id removed from list → student UI has no path to open it
                        Cached data is orphaned but expires naturally in 7 days
Note re-uploaded:      New note_id (UUID) → cache miss → fresh download
```

**Key security guarantees:**
- Cloudinary URL: DB only, **never** in any API response
- Batch gate: Std 6 student → 403 if tries Std 7 note
- Local cache: AES-256-GCM encrypted → raw bytes unreadable without derived key
- Key derived from: student_code + note_id → unique per student per note
- Canvas rendering: no text selection, no copy-paste
- No download button in UI
- Content-Disposition: inline → no browser download dialog
- Cache-Control: private, no-store → no unencrypted browser/SW cache

---

### MongoDB Schema — `Note`

```js
{
  note_id:              String  (UUID, unique index)
  title:                String  (required, trimmed)
  batch:                String  (required)
  subject:              String  (required)
  cloudinary_url:       String  (server-only — NEVER in student API response)
  cloudinary_public_id: String  (for Cloudinary destroy on delete)
  file_size_bytes:      Number
  view_count:           Number  (default 0, $inc on every /view call)
  status:               'active' | 'archived'  (default 'active')
  created_by:           String
  created_at:           Date
}
```

### IndexedDB Store — `notes_cache` (DB_VERSION 9 → 10)

```js
// Store name: 'notes_cache'
// keyPath: 'note_id'
{
  note_id:    String       // key
  data:       ArrayBuffer  // AES-256-GCM encrypted PDF bytes
  iv:         Uint8Array   // 12-byte random IV (stored alongside data)
  cached_at:  Number       // Date.now() when downloaded
  expires_at: Number       // cached_at + 7 * 24 * 60 * 60 * 1000
}
```

### Encryption — AES-256-GCM via Web Crypto (zero dependencies)

```js
// Key derivation — PBKDF2 (unique per student per note)
async function _deriveKey(noteId, studentCode) {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(studentCode + '|' + noteId),
    { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('TB-Notes-v1'),
      iterations: 10000,
      hash: 'SHA-256',
    },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt before IDB store
async function _encrypt(buffer, key) {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buffer);
  return { data: encrypted, iv };
}

// Decrypt after IDB read
async function _decrypt(entry, key) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, key, entry.data);
}
```

**Why this key is safe enough for school use:**
- Key = PBKDF2(student_code + note_id) → unique per student per note
- Even if someone extracts IDB bytes → unreadable without code + student_code + note_id
- PBKDF2 10k iterations → brute-force costly for low-value school content

---

### API Routes

```
Admin (all require admin JWT):
  POST   /api/admin/notes/upload     uploadNote
  GET    /api/admin/notes            listNotesAdmin   (?batch=&subject=)
  DELETE /api/admin/notes/:id        deleteNote       (Cloudinary destroy + DB delete)

Student (all require student JWT):
  GET    /api/notes                  listNotesStudent  (?batch=&subject=, NO URL in response)
  GET    /api/notes/:id/view         viewNoteStudent   (batch validate → proxy stream)
```

---

### Student API Response (no URL)

```json
{
  "notes": [
    {
      "note_id": "abc-123",
      "title": "Chapter 3 Notes",
      "batch": "Std 6",
      "subject": "English",
      "file_size_bytes": 512000,
      "view_count": 47,
      "created_at": "2026-06-24T10:00:00Z"
    }
  ]
}
```

---

### Batch Validation (view endpoint)

```js
// req.userDoc is set by requireStudent middleware (full User doc from DB)
const studentBatch = req.userDoc?.batch;
if (studentBatch && note.batch !== studentBatch) {
  throw new AppError('Access denied — this note is not for your batch', 403);
}
await Note.updateOne({ note_id: req.params.id }, { $inc: { view_count: 1 } });
```

---

### PDF.js — Canvas Render + Watermark

```js
// Load from ArrayBuffer (not URL)
const buffer = await API.fetchNoteView(noteId);
const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
_totalPages  = pdf.numPages;

// Render page
async function _renderPage(num) {
  const page     = await _pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: window.devicePixelRatio || 1.5 });
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  _addWatermark(canvas);  // after render
}

// Watermark — repeated diagonal, 3 rows
function _addWatermark(canvas) {
  const ctx    = canvas.getContext('2d');
  const size   = Math.max(14, canvas.width / 22);
  const name   = APP.getStudentName?.() || 'Student';
  const batch  = APP.getStudentBatch?.() || '';
  const date   = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle   = '#000000';
  ctx.font        = `bold ${size}px Arial`;
  ctx.textAlign   = 'center';

  for (let r = 0; r < 3; r++) {
    ctx.save();
    ctx.translate(canvas.width / 2, (canvas.height / 3) * r + canvas.height / 6);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText(name,              0, 0);
    ctx.fillText('Teaching Board',  0, size * 1.8);
    ctx.fillText(batch,             0, size * 3.6);
    ctx.fillText(date,              0, size * 5.4);
    ctx.restore();
  }
  ctx.restore();
}
```

**Watermark preview (per page, 3 rows):**
```
   ╲ Jyotika Kumbhar ╲   ╲ Jyotika Kumbhar ╲
    ╲ Teaching Board  ╲    ╲ Teaching Board  ╲
     ╲ Std 6          ╲     ╲ Std 6          ╲
      ╲ 24-Jun-2026   ╲      ╲ 24-Jun-2026   ╲
```

---

### Pinch Zoom (CSS transform — no re-render)

```js
let _scale = 1;
let _lastDist = 0;

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2)
    _lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
});

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist  = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    _scale = Math.min(3.0, Math.max(0.8, _scale * (dist / _lastDist)));
    canvas.style.transform       = `scale(${_scale})`;
    canvas.style.transformOrigin = 'top center';
    _lastDist = dist;
  }
}, { passive: false });
```

---

### No-Copy Layers (Defense-in-Depth)

| Layer | Implementation | Blocks |
|-------|---------------|--------|
| Canvas render | PDF.js → `<canvas>` | Text selection, Ctrl+C |
| CSS | `user-select: none` on viewer | Drag-select |
| JS | `canvas.oncontextmenu = () => false` | Right-click Save |
| UI | No download button | Accidental download |
| Backend | `Content-Disposition: inline` | Browser download dialog |
| Backend | `Cache-Control: private, no-store` | Browser cache copy |
| Backend | URL never in response | Direct URL sharing |
| Watermark | Canvas 2D, 7% opacity, 3 rows | Screenshot deterrence |

> **Cannot block:** Android OS volume+power screenshot. Watermark is the only deterrent here.

---

### Admin UI — Notes Tab

```
Sidebar tab (desktop): 📄 Notes
More drawer (mobile):  📄 Notes

Layout:
┌─────────────────────────────────────────────┐
│  📄 Notes                                   │
│  [Batch ▼] [Subject ▼]  [🔍 Filter]  [+ Upload] │
├─────────────────────────────────────────────┤
│  📄 Chapter 3 Notes       Std 6 / English   │
│  500 KB  •  Jun 24  •  47 views  [🗑️ Delete] │
├─────────────────────────────────────────────┤
│  📄 Algebra Unit 2        Std 7 / Maths     │
│  1.1 MB  •  Jun 23  •  12 views  [🗑️ Delete] │
└─────────────────────────────────────────────┘

Upload form (inline modal):
┌──────────────────────────────────────────┐
│  Title:    [Chapter 3 Notes           ]  │
│  Batch:    [Std 6 ▼]                    │
│  Subject:  [English ▼]                  │
│  PDF file: [Choose File]  notes.pdf      │
│            Max 10 MB • PDF only          │
│                                          │
│  ████████████░░░░  72% uploading...      │
│                                          │
│  [Cancel]              [📤 Upload PDF]   │
└──────────────────────────────────────────┘
```

---

### Student UI — Notes Viewer

```
Vocab screen → "📄 Notes" tab

Notes list:
┌────────────────────────────┐
│ 📄 Chapter 3 Notes         │
│ English • 500 KB           │  ← tap
├────────────────────────────┤
│ 📄 Grammar Rules           │
│ English • 320 KB           │
└────────────────────────────┘

Full-screen viewer:
┌──────────────────────────┐
│ ← Chapter 3 Notes   2/8  │  ← top bar (hides after 3s)
├──────────────────────────┤
│                          │
│    [Canvas — page 2]     │  ← pinch zoom
│                          │     swipe L/R = next/prev page
│  Jyotika Kumbhar         │  ← watermark
│  Teaching Board          │
│  Std 6                   │
│  24-Jun-2026             │
├──────────────────────────┤
│  ← Prev          Next →  │
└──────────────────────────┘
```

---

### Cloudinary Cost Analysis — WITH Local Cache

#### Storage (negligible)
```
50 notes × 500 KB avg = 24.4 MB storage
Free tier: 25 GB → 0.1% used → ✅ no issue ever
```

#### Bandwidth — WITHOUT Cache (old plan, rejected)
```
Every view → Cloudinary fetch by backend

100 students × 5 views/day × 500 KB = 244 MB/day = 7.1 GB/month  ← wasteful
```

#### Bandwidth — WITH Encrypted Local Cache (new plan)
```
Rule: 1 note → downloaded ONCE per student device, cached 7 days

Actual Cloudinary fetch per student per note = 1 download only

Scenario    Students  Notes  Cloudinary fetch    Monthly bandwidth
──────────────────────────────────────────────────────────────────
Small       100       20     100 × 20 × 500KB    = 1 GB  total ✅ excellent
Medium      250       30     250 × 30 × 500KB    = 3.7 GB total ✅ excellent
Large       500       50     500 × 50 × 500KB    = 12.5 GB total ✅ fits free tier

After initial download: 0 Cloudinary bandwidth per view
```

**Bandwidth reduction: ~95% compared to no-cache plan**
**Free tier (25 GB/month) now comfortably handles even large schools**

#### Render Bandwidth (backend proxy streams PDF to student on first download)
```
Render free tier: 100 GB/month outgoing
First-download traffic = same as Cloudinary numbers above → well within Render free tier
```

#### Real-World Timeline Example
```
June 24:  Admin uploads 5 notes for Std 6 English
June 24:  100 students open each note once
          → 100 × 5 × 500KB = 250 MB Cloudinary bandwidth (one-time)
June 25-30: Students re-read same notes
          → 0 MB Cloudinary (all from local cache)
July 1:   Cache expires (7 days) → students auto-refresh on next open
          → 250 MB again (once per 7 days)
Monthly Cloudinary = 250 MB × ~4 refreshes = ~1 GB  ← trivial
```

---

### PDF Compression Strategy

**Cloudinary does NOT compress raw PDFs** (only images/videos get auto-compression).

**Why compression matters:**
```
500 KB PDF × 100 students × 5 views = 244 MB/day bandwidth
1.5 MB PDF × 100 students × 5 views = 732 MB/day  (3× more)
```

**Our approach (zero new npm packages):**

1. **Frontend size check**: Before upload, check `file.size`. If > 3MB → show warning:
   ```
   ⚠️ This PDF is 4.2 MB. For best performance, compress it first.
   Free tools: ilovepdf.com, smallpdf.com
   Max allowed: 10 MB
   [Upload Anyway]  [Cancel]
   ```

2. **Admin pre-compress** (recommended tools):
   - [ilovepdf.com/compress-pdf](https://ilovepdf.com/compress-pdf) — free, no login
   - [smallpdf.com](https://smallpdf.com) — free tier available
   - Typical reduction: **2 MB → 400 KB** (typed notes), **5 MB → 1.2 MB** (scanned)

3. **Hard limit**: 10 MB — backend rejects if exceeded (AppError 400)

**Realistic note sizes (typed/exported PDF):**
```
Teacher-typed chapter notes (5 pages)    → 80–200 KB   ✅ perfect
Scanned handwritten notes (5 pages)      → 500 KB–2 MB  ✅ fine
Scanned textbook pages (5 pages, color)  → 2–8 MB       ⚠️ compress first
```

---

### Student UX — Cache Status Indicator

```
Notes list (student sees):

📄 Chapter 3 Notes     ✅ Saved        ← cached, green tick
📄 Grammar Rules       ☁️ Tap to open  ← not cached, cloud icon
📄 Algebra Unit 2      🔄 Updating...  ← cache expired, re-downloading

Viewer loading states:
"Loading from saved copy..."   ← cache hit
"Downloading... 1st time"      ← cache miss, shows progress
"No internet — connect to download this note"  ← offline + no cache
```

---

### File Changes Summary

#### Backend — 3 new files, 1 modified
```
NEW  TeachingBoard-backend/src/models/Note.js
NEW  TeachingBoard-backend/src/controllers/noteController.js
NEW  TeachingBoard-backend/src/routes/noteRoutes.js
MOD  TeachingBoard-backend/src/app.js    (+10MB limit for upload + 2 route lines)
```

#### Frontend — 2 new files, 4 modified
```
NEW  admin-app/notesManager.js
NEW  student-app/notesPlayer.js          (PDF viewer + AES-GCM cache)
MOD  core/db.js               (add 'notes_cache' store, DB_VERSION 9→10)
MOD  core/helpers.js          (uploadNote, fetchAdminNotes, deleteNote,
                                fetchStudentNotes, fetchNoteView)
MOD  admin-app/admin.html     (sidebar tab + More drawer + HTML section)
MOD  student-app/index.html   (notes list + viewer overlay)
MOD  sw.js                    (cache notesManager.js + notesPlayer.js)
```

**Total: 5 new files, 5 modified. Zero new npm packages.**

---

### Implementation Order (safe, one step at a time)

```
Step 1  →  Note.js model                    (backend)
Step 2  →  noteController.js                (backend: upload, list, delete, proxy stream)
Step 3  →  noteRoutes.js                    (backend)
Step 4  →  app.js update                    (backend: register routes + 10MB body limit)
Step 5  →  core/db.js                       (frontend: notes_cache store, DB_VERSION→10)
Step 6  →  core/helpers.js                  (frontend: 5 API functions + fetchNoteView)
Step 7  →  admin-app/notesManager.js        (frontend: IIFE upload + list + delete)
Step 8  →  admin-app/admin.html             (frontend: tab + drawer + HTML)
Step 9  →  student-app/notesPlayer.js       (frontend: PDF.js + cache + encrypt + watermark)
Step 10 →  student-app/index.html           (frontend: notes screen + viewer overlay)
Step 11 →  sw.js cache update               (cache new JS files)
Step 12 →  git commit + push                (backend first → Render deploy → then frontend)
```

---

## Notes Feature Progress
- [ ] Step 1  — Note.js model
- [ ] Step 2  — noteController.js
- [ ] Step 3  — noteRoutes.js
- [ ] Step 4  — app.js update
- [ ] Step 5  — core/db.js (notes_cache store, DB_VERSION 9→10)
- [ ] Step 6  — core/helpers.js
- [ ] Step 7  — admin-app/notesManager.js
- [ ] Step 8  — admin-app/admin.html
- [ ] Step 9  — student-app/notesPlayer.js
- [ ] Step 10 — student-app/index.html
- [ ] Step 11 — sw.js cache update
- [ ] Step 12 — git commit + push
