# Question Bank UI + Paper Builder + PDF Export

**Date**: 2026-07-10
**Supersedes**: docs/PLAN_SLS_v2_Marks_QuestionBank_PracticePapers.md (that doc's schema
proposal diverged from what was actually built — this doc reflects verified reality.)

## What already exists (verified by reading the real code, not assumed)

**Backend — fully built, zero admin UI on top of it:**
- `SLSQuestion` model: conceptId, chapterId, subjectId, batchId, questionText{en,mr},
  answerText{en,mr}, marks(1-5), questionType, difficulty, boardFrequency, usageCount,
  usedInPapers[], status(draft/published).
- `PracticePaper` model: chapterId, batchId, totalMarks, questions[{questionId,marks,order}],
  status.
- Question CRUD: `POST/GET/PATCH/DELETE /api/sls/admin/questions`, `POST .../publish`.
  **`GET /admin/questions` already supports query filters**: conceptId, chapterId, batchId,
  marks, questionType, difficulty, status, page, limit — this is already the exact query the
  Paper Builder's mark-dropdowns and Question Bank search need. Only gap: no free-text search.
- Paper: `POST /admin/papers/generate` (**auto** — picks by marks distribution, least-used
  first), `GET /admin/papers`, `GET /admin/papers/:id`, `POST /admin/papers/:id/publish`.
- Student: `GET /student/papers`, `GET /student/papers/:id`, `POST .../submit`,
  `GET /student/attempts`. Batch-isolation already fixed (this session, commit 90c8fad).

**Missing (this is the actual work):**
1. No manual paper creation (only auto-`generate`) — teacher can't hand-pick questions.
2. No free-text search on questions.
3. No PDF generation anywhere in the codebase (confirmed via grep — only PDF *upload* exists
   for the old Notes-PDF feature). Needs a client-side PDF lib (jsPDF — pure JS, no native
   Android build change) + the existing `FILE_EXPORT.saveAndShare()` to save/share it.
4. Zero admin frontend: no Question Manager screen, no Paper Builder screen, no Answer
   Sheet/PDF view.
5. Exercise section inside the Concept (Notes) editor isn't wired to SLSQuestion at all yet.
6. Student-facing "take a practice paper" UI — need to check if `notesViewer.js`/a dedicated
   screen already renders `student/papers` or if that's also unbuilt (check in Phase 4).

## Phases (small, sequential, self-checked before moving on)

### Phase 1 — Exercise editor in Notes (admin-app/conceptManager.js)
- New "📝 Exercise" section in the concept editor, below Revision Box.
- Paste-box + "✨ Auto-fill Exercise" button — parses `Q<n>. ... Ans: ... Marks: <n>` blocks
  (reuse the existing `_AUTOFILL_SECTIONS` parser pattern already in this file).
- "+ मॅन्युअली प्रश्न जोडा" — manual question/answer/marks form.
- Each saved question → `POST /api/sls/admin/questions` with conceptId/chapterId/subjectId/
  batchId pulled from the concept currently being edited, status:'published' (so it's
  immediately usable in Paper Builder — matches how the rest of this editor auto-saves).
- List of this concept's own questions (`GET /admin/questions?conceptId=...`) shown below,
  edit/delete wired to the existing PATCH/DELETE endpoints.
- Self-check: create 2-3 questions on a real concept via the running admin app (CDP), confirm
  they appear in `GET /admin/questions?conceptId=X` afterward, confirm edit/delete work.

### Phase 2 — Backend: search + manual paper creation
- `getQuestions`: add optional `q` param → case-insensitive regex/text match on
  questionText.english/marathi. Small, additive, no breaking change.
- New `createPaperManual` controller + route (`POST /admin/papers`) — body:
  `{ batchId, chapterId, subjectId, title, questions: [{questionId, marks, order}] }` —
  writes a `PracticePaper` directly from the caller's explicit list (no auto-distribution),
  bumps `usageCount`/`usedInPapers` on each referenced SLSQuestion (same bookkeeping
  `generatePaper` already does — reuse that helper, don't duplicate it).
- Self-check: curl the new endpoints directly (with a real admin token) before touching any UI.

### Phase 3 — Paper Builder screen (new admin-app/paperBuilder.js + admin.html tab)
- Batch → Subject → Chapter → Paper title fields.
- 5 mark-buttons (1-5) → clicking one opens a dropdown of that chapter's questions at that
  marks value (via Phase 2's search-enabled `getQuestions`), sorted least-used-first (existing
  `usageCount` field — no new backend logic needed, just sort param).
- "⚡ उरलेलं Auto-fill करा" — calls the *existing* `generatePaper` for the remaining target
  marks, merges its picks into the manually-built list (best of both, no new backend code).
- Running "Paper मध्ये जोडलेले प्रश्न" list with running total marks, remove-per-row.
- "Save" → Phase 2's `createPaperManual`.
- Self-check: build one real paper end-to-end via CDP against the running admin app, confirm
  it's retrievable via `GET /admin/papers/:id` with the exact questions/order/marks saved.

### Phase 4 — PDF export (Question Paper + Answer Sheet)
- Add jsPDF (CDN script tag, matches how this codebase already loads other CDN libs like
  JSZip/QRCode in admin.js's `_loadScript` helper — same pattern, no build config change).
- Client-side function: fetch `getPaperWithQuestions`, render two PDF variants (paper-only,
  paper+answers) matching the layout style of the reference Unit-Test PDF (section grouping by
  marks, numbered questions).
- Save via the existing `FILE_EXPORT.saveAndShare()` (already fixed this session, v7.0.17 —
  the FileProvider cache-root bug).
- Self-check: generate both PDFs on the running admin app, confirm the file actually lands via
  Android's share sheet (the exact thing that was broken and fixed earlier this session for
  CSV exports) — this is the "does PDF actually save from the app" question, answered by
  construction once this reuses the already-fixed FILE_EXPORT path.

### Phase 5 — Final pass
- Re-check all 4 phases together on-device (not just individually).
- Confirm no `npx cap sync` / native Android build changes were needed (jsPDF and the
  Question/Paper Bank are pure JS + existing HTTP endpoints — expect **no** native dependency
  additions, unlike the payment-flow work earlier which needed `@capacitor/browser`).
- Version bump, build, commit, push — same release pipeline as the rest of this session.

## Access control (added mid-plan, before any route was written)
- **Admin** (admin-app): full access — create/edit/delete questions (Exercise editor +
  standalone), Paper Builder, PDF export. Routes stay under `requireAdmin`.
- **Teacher** (student-app/teacherDashboard.js — teachers already log in through the student
  app shell with role:'teacher', not a separate app): Paper Builder + PDF export **only** —
  reuses the same `SLSQuestion`/`PracticePaper` data, cannot create/edit/delete questions.
  Paper-related routes (list/generate/create-manual/get/publish) switch from `requireAdmin`
  to the existing `requireTeacherOrAdmin` middleware; question CRUD routes stay
  `requireAdmin`-only. A cut-down Paper Builder view gets added to teacherDashboard.js after
  the admin-side one is built and proven (reuses the same core/helpers.js API functions).

## Data-integrity safeguards (added mid-plan)
- New compound index `{chapterId, marks, status, usageCount}` on SLSQuestion — covers the
  Paper Builder's exact query (filter by chapter+marks+published, sort least-used-first) in
  one index instead of a partial match.
- Every question/paper query always passes batchId + subjectId + chapterId together (never
  chapterId alone) — chapterId already embeds batch (`_makeChapterId` format), so this is
  defense-in-depth, not the only safeguard, matching the batch-isolation pattern fixed
  elsewhere in the app this session.
- Auto-fill dedup: before creating a parsed question, check it against the concept's
  already-loaded question list (case-insensitive trimmed text match) and skip re-creating an
  exact duplicate — protects against pasting/running auto-fill on the same text twice.

## Explicit non-goals (to keep this shippable)
- Not rebuilding the student "take a paper" quiz-player UI unless Phase 4's check finds it's
  actually missing (need to verify, not assume).
- Not touching DOCX export (PDF only, per user's actual ask).
- Not migrating the old `docs/PLAN_SLS_v2...md` schema proposal — the real schema already
  diverged from it and works; that file is now historical only.
