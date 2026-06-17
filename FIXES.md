# TeachingBoard — Full Bug Fix Plan

## Status Legend
- ✅ DONE
- 🔄 IN PROGRESS
- ⏳ PENDING
- ❌ FALSE POSITIVE (audit चुकीचा होता)
- ⚠️ DESIGN DECISION (bug नाही, trade-off आहे)

---

## TIER 1 — Critical / High Priority

| # | File | Line | Bug | Status |
|---|------|------|-----|--------|
| 1 | student-app/analytics.js | 435 | Delete button `{ once: true }` — पहिल्या click नंतर listener जातो, पुढचे deletes काम करत नाहीत | ✅ DONE |
| 2 | student-app/ui.js | 282–324 | `renderSubjectGrid` duplicate dead code — `subjectCounts` undefined वापरतो | ✅ DONE |
| 3 | TeachingBoard-backend/src/app.js | startup | JWT_SECRET नसेल तर server start नाही होणार — silent security hole बंद | ✅ DONE |
| 4 | student-app/testPlayer.js + attemptController.js | 463,487,694 + 75 | TF questions — `data-val="True/False"` vs answer letter `"A/B"` → scoring नेहमी चुकत होते | ✅ DONE |
| 5 | student-app/testPlayer.js | 809 | Tab switch — 2s debounce add, message clearer | ✅ DONE |

---

## TIER 2 — Medium Priority

| # | File | Line | Bug | Status |
|---|------|------|-----|--------|
| 6 | core/sync.js | 159 | Queue deduplication `JSON.stringify` — property order वेगळा असेल तर duplicate entry | ✅ DONE |
| 7 | student-app/analytics.js | 611 | Weak question flag toggle — पूर्ण list re-render, flicker | ✅ DONE |
| 8 | TeachingBoard-backend/src/routes/studentRoutes.js | — | Self-registration ला rate limiting नाही | ✅ DONE |
| 9 | student-app/app.js | 473 | Profile button name — login नंतर update नाही | ✅ DONE |
| 10 | student-app/quiz.js | 591 | _endSession DB fail → toast दाखवतो पण results दिसतात (verify केला — ❌ FALSE POSITIVE) | ❌ |

---

## TIER 3 — Low Priority / UX

| # | File | Line | Bug | Status |
|---|------|------|-----|--------|
| 11 | core/helpers.js | 210 | Token refresh loop — ❌ FALSE POSITIVE (`path !== '/auth/login'` guard आहे) | ❌ |
| 12 | student-app/quiz.js | 434 | Timer multiple intervals — ❌ FALSE POSITIVE (`_stopTimer()` आधीच आहे line 435) | ❌ |
| 13 | student-app/ui.js | 282 | Home double render — ❌ FALSE POSITIVE (एकच call आहे) | ❌ |
| 14 | TeachingBoard-backend/src/controllers/quizController.js | 93 | Answers students ला जातात — ⚠️ DESIGN: offline scoring साठी आवश्यक | ⚠️ |
| 15 | TeachingBoard-backend/src/models/User.js | 4 | PIN HMAC not bcrypt — ⚠️ existing PINs invalid होतील, skip | ⚠️ |

---

## Already Fixed Today
- ✅ core/sync.js — Student profile दर 45s refresh (batch sync fix)
- ✅ student-app/app.js — Registration submit button restore
- ✅ student-app/app.js — Mobile number validation
- ✅ student-app/testPlayer.js — Sync error toast message

---

## Notes
- False positives: 4 bugs (audit चे चुकीचे होते — code actually correct आहे)
- Design decisions: 2 items (quiz answers + PIN hashing — बदलणे risky)
- Total actual fixes needed: 9
