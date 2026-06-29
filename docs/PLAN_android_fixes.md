# TeachingBoard — Android Bug Fix Plan
**Date:** 2026-06-29  
**Scope:** Student APK मध्ये Admin App येणे + Student Login Intermittent Problem

---

## सापडलेले Bugs (Deep Analysis)

### BUG 1 — CRITICAL: Student APK मध्ये Admin App दिसतो
| | |
|--|--|
| **कुठे** | `capacitor.config.ts` (root) |
| **कारण** | `build-admin.bat` `cap sync` नंतर interrupt झाला — Step [6/6] "Restoring configs" run झाला नाही |
| **State** | `capacitor.config.ts` = ADMIN config (modified), `.bak` = student config (untracked) |
| **Impact** | Android project मध्ये admin web files आहेत — Android Studio वरून build केला तर admin APK येतो |

**Root cause detail:**
```
build-admin.bat step [2/6]: capacitor.config.ts → .bak (student saved)
build-admin.bat step [2/6]: capacitor-admin.config.ts → capacitor.config.ts (admin set)
build-admin.bat step [5/6]: cap sync (admin files android मध्ये sync) ✓
build-admin.bat step [6/6]: INTERRUPTED — restore नाही झाला ❌
→ capacitor.config.ts = admin config (wrong)
→ .bak = student config (orphan, should not exist)
→ android assets = admin files (wrong for student build)
```

**Fix:**
1. `capacitor.config.ts` → student config restore करा
2. `.bak` delete करा  
3. `build-student.bat` run करा → student files android मध्ये sync होतील

**BAT improvement (prevent future):**
- Restore step मध्ये `.bak` वापरण्याऐवजी `capacitor-student.config.ts` directly वापरा
- `.bak` pattern eliminate करा — always end state = student config

---

### BUG 2 — CRITICAL: Student Login Intermittent ("कधी होतो कधी नाही")
| | |
|--|--|
| **कुठे** | `student-app/app.js` line ~395 (`_runOnboardingIfNeeded`) |
| **कारण** | `fetchStudentMe()` कोणत्याही error ने fail झाला तरी profile delete + forced re-login |
| **Impact** | PIN correct टाकल्यावर server sleeping असेल तर students ला student code + PIN परत टाकावा लागतो |

**Root cause detail:**
```
Student → correct PIN टाकतो
→ fetchStudentMe() call (server sleeping / network error)
→ catch {} — कोणताही error
  → clearStudentProfile() ← ❌ profile delete
  → _showOnboarding(force:true) ← ❌ login form परत
Student गोंधळतो — "login fail झाला?"
30-60 sec नंतर server जागा → code+pin टाकतो → success
```

**Fix:** Network error vs Auth error distinguish करा:
- `401 Unauthorized` / `expired` / `blocked` / `pending` → forced re-login (correct)
- Network error / timeout / server sleeping → cached profile वापरा, re-login नको

---

### BUG 3 — MODERATE: Render Server Cold Start = Login Fail
| | |
|--|--|
| **कुठे** | `student-app/app.js` `_startBackground()` function |
| **कारण** | Health ping `_startBackground()` मध्ये आहे — onboarding नंतर fire होतो, उशीर होतो |
| **Impact** | Login form वर असताना server झोपलेला असतो → first login fails |

**Fix:** `fetch('/health')` → `init()` च्या सुरुवातीला हलवा (before DB open, fire-and-forget)

---

### BUG 4 — MINOR: PIN Lock Security Issue
| | |
|--|--|
| **कुठे** | `student-app/app.js` line ~451 (`_attempt` in `_showPinLock`) |
| **कारण** | `if (!storedPin \|\| entered === storedPin)` — storedPin empty असेल तर कोणताही PIN unlock करतो |
| **Impact** | DB error झाली तर security bypass होतो |

**Fix:** `if (storedPin && entered === storedPin)` + empty storedPin साठी error message

---

## Implementation Steps (Order)

| Step | काय | File | Status |
|------|-----|------|--------|
| 1 | Plan MD तयार करा | `docs/PLAN_android_fixes.md` | ✅ Done |
| 2 | `capacitor.config.ts` restore (student) | `capacitor.config.ts` | ✅ Done |
| 3 | `.bak` delete करा | `capacitor.config.ts.bak` | ✅ Done |
| 4 | BUG 2 fix — login catch block | `student-app/app.js:395` | ✅ Done |
| 5 | BUG 3 fix — health ping early | `student-app/app.js:68` | ✅ Done |
| 6 | BUG 4 fix — PIN security | `student-app/app.js:451` | ✅ Done |
| 7 | `build-student.bat` improve | `build-student.bat` | ✅ Done |
| 8 | `build-admin.bat` improve | `build-admin.bat` | ✅ Done |
| 9 | `sw.js` SW_VERSION v42→v43 | `sw.js` | ✅ Done |

---

## BAT Files — नवीन Strategy

**Problem with old strategy:**
```
save current → .bak
use new config
cap sync
restore from .bak  ← if interrupted, .bak orphan + wrong config remains
```

**New strategy (bulletproof):**
```
PRE: if .bak exists → warn + delete (stale from previous interrupt)
use source config file directly (not .bak)
cap sync
restore FROM SOURCE FILE directly (capacitor-student.config.ts)
no .bak dependency for restore
```

**Benefit:** Even if interrupted, next run:
- PRE step deletes stale .bak
- Restore always uses `capacitor-student.config.ts` → always correct end state

---

## Post-Fix Verification Checklist

- [ ] `capacitor.config.ts` → student config (`com.teachingboard.student`, `dist-student`)
- [ ] `capacitor.config.ts.bak` → नाही असला पाहिजे
- [ ] `student-app/app.js` → fetchStudentMe catch block updated
- [ ] `student-app/app.js` → health ping init() च्या सुरुवातीला
- [ ] `student-app/app.js` → PIN lock storedPin check updated
- [ ] `build-student.bat` → restore from capacitor-student.config.ts
- [ ] `build-admin.bat` → restore from capacitor-student.config.ts
- [ ] `sw.js` → SW_VERSION bumped (v42 → v43)
- [ ] `build-student.bat` run करा → android sync verify
- [ ] Android Studio → Signed APK → install on device → verify Student app shows
