# PLAN — Free Guest Mode → Guide → Subscription (NKs EduOrbit)

Status: owner-approved direction 2026-11-01, revised the same day. Nothing built yet.
Goal: maximum students reaching a PAID subscription, led step by step by the app itself.
No running costs: no external AI, no WhatsApp Business API, no OTP SMS (wa.me share links,
push notifications and the existing Render + Vercel only).

---

## 0. Owner decisions

1. Admin shares ONE general link. The student chooses batch and subject himself.
   (Only a friend's challenge link opens a test directly — see §3.4.)
2. Low score → "🔁 पुन्हा प्रयत्न करा" (retry the same test), not "next time".
3. Rank is always shown and changes as more students take the test
   ("12 students पैकी #3"). Rank uses each person's BEST score on that test.
4. Name before the first test (one field). Parent mobile after the result, optional,
   unlocks the detailed analysis, with consent (DPDP — minors).
   Web: autofill + Contact Picker. App: Google Phone Number Hint (AAB step).
5. Parent payment auto-creates the account and keeps everything done as a guest.
6. Whole free part on the current Vercel site.

7. **Test-completion offer (chosen 2026-11-01 — legal version, "Option 1")**:
   - Monthly keeps its REAL price ₹X (same price for renewals). Finishing a test gives
     **50 % off the first month only**, valid **12 hours** (real countdown, really ends).
   - The offer comes back at most **once a calendar month**, again only after finishing a
     new test (no "12 hours" offer that silently returns every few days).
   - One offer per parent mobile / guest; first payment only.
   - Yearly price is genuinely lower than 12 × monthly (40–50 % saving, always on, real).
   - Wording: "🎁 Test पूर्ण केल्याबद्दल पहिल्या महिन्यावर 50% सवलत" — never "you won a
     scholarship" (everyone gets it). Struck-through price = the real monthly price.
   - Reason: India's Guidelines for Prevention and Regulation of Dark Patterns, 2023
     (false urgency, fake discounts) and Play Families policy.
   - Suggestions accepted: result image card, real social proof, teacher endorsement,
     exam countdown (admin dates). Later: monthly Scholarship Test event (time window,
     questions pre-downloaded, single submit, server woken before), weekly leaderboard,
     daily question/streak. Rejected: ₹49 first month, money-back guarantee.

---

## 1. The funnel (each step and what we measure)

| # | Step | Student sees | Count |
|---|---|---|---|
| F1 | Link opened | Welcome popup | `opened` |
| F2 | Batch + subject chosen | Chapters (free ✅ / 🔒) | `browsed` |
| F3 | First free item used | Notes / Exercise / Test | `engaged` |
| F4 | First test finished | "🎯 Result बघा" → animation → result | `tested` |
| F5 | Shared | Friends / parents WhatsApp | `shared_friend`, `shared_parent` |
| F6 | Parent mobile given | Detailed analysis unlocked | `lead` |
| F7 | Saw "all tests" offer | Popup / 🔒 tap | `offer_seen` |
| F8 | Pay page opened | Parent pay page | `checkout` |
| F9 | Paid | Account created | `paid` |
| F10 | Brought a friend | Friend reached F4 | `viral` |

Admin sees these counts per day and per source (admin link / friend share / teacher code).
Industry rough guide for free-test funnels (Indian K-12 test-prep apps): 2–8 % of visitors
who finish a test eventually pay; the biggest drops are F1→F4 (start friction) and
F7→F9 (price/trust). Everything below targets those two drops.

---

## 2. Student journey — screen by screen

### 2.1 Link opens (F1)
Popup over the app (no login):
> 👋 **NKs EduOrbit मध्ये स्वागत!**
> 4थी पासून पुढे आणि स्पर्धा परीक्षा: सगळ्या विषयांचे Free Tests, Notes आणि सराव
> ✅ Login नाही ✅ पूर्ण Free ✅ लगेच Result
> **[ ▶ सुरू करा ]**

### 2.2 Batch → Subject (F2)
Big cards: batch list → subject list of that batch.
Social proof under each subject: "📝 1,240 students नी test दिला" (real count).

### 2.3 Chapters
- ✅ Free chapters (first chapter of each subject + admin-flagged free) — open.
- 🔒 Paid chapters — visible; tap → "सगळे chapters उघडा" offer (§2.8).
- Guide highlights the first free chapter with a pulsing ring + "इथून सुरू करा 👆".

### 2.4 Chapter hub (F3)
📖 Notes · ✏️ Exercise · 📝 Test — guide order: Notes → Exercise → Test.
Each finished item gets ✓; the next one pulses.

### 2.5 Before the first test
> तुमचं नाव: [______] **[ ▶ Test सुरू करा ]**
Asked once, remembered.

### 2.6 After the test (F4)
1. Screen dims; button bounces with a pointing hand: **"🎯 तुमचा Result बघा"**.
2. Marking animation: each question turns ✓/✗ in turn, score counts up 0 → 12/15.
3. Result card:
   - **12/15 · 80 %** (confetti 🎉 if ≥ 70 %)
   - 🏆 "37 students पैकी तुमचा क्रमांक **#5**" (live, best score per person)
   - Weak part: "Similarity — प्रश्न 4, 9"
   - 2 wrong answers explained free; the rest → "📊 पूर्ण analysis" (§2.7)
4. Buttons (one big, others small):
   - Score < 50 %: **[ 🔁 पुन्हा प्रयत्न करा ]** big; then "➡ पुढचा Free भाग".
   - Score ≥ 50 %: **[ ➡ पुढचा Free भाग ]** big; "🔁 पुन्हा प्रयत्न करा" small.
   - "👫 मित्रांना पाठवा" · "👨‍👩‍👧 पालकांना पाठवा"
5. Retry result shows improvement: "60 % → 85 % 🚀 +25 %" and a share button for it.

### 2.7 Detailed analysis = parent mobile (F6)
> 📊 पूर्ण analysis बघण्यासाठी पालकांचा WhatsApp नंबर द्या
> [ 98XXXXXXXX ] (autofill) **[ 📇 Contacts मधून निवडा ]**
> ☑ NKs EduOrbit कडून result व अभ्यासाबद्दल संपर्कास पालकांची संमती आहे
> **[ Analysis बघा ]** · नंतर
Number normalised to 10 digits, 6–9 start, obvious fakes rejected.

### 2.8 "All tests" offer (F7)
Shown at most once a day, at: score ≥ 70 %, 3rd test done, free part finished, any 🔒 tap
(🔒 tap always shows it). "आत्ता नको" hides the automatic ones for the next 2 tests.
> 🎯 **सगळे tests सोडवायचे आहेत का?**
> ✓ सगळ्या subjects चे 200+ tests ✓ प्रत्येक प्रश्नाचं स्पष्टीकरण
> ✓ Notes, Exercise, सराव ✓ पालकांना weekly progress report
> **दिवसाला फक्त ₹X** (yearly: "₹Y वाचवा")
> **[ हो, सगळे हवेत ]**  [ पालकांना विचारा 📤 ]  आत्ता नको
"हो" → pay page (§4). "पालकांना विचारा" → message §3.3.

### 2.9 Coming back
Guest progress is kept in the browser. Next visit: "👋 राहुल, परत स्वागत! पुढचा भाग:
Science 1 — Test 1 ▶" (guide resumes where he stopped).

---

## 3. Every WhatsApp message (exact text)

Placeholders: {name} {batch} {subject} {lesson} {test} {score} {total} {pct} {rank} {count}
{weak} {link} {direct} {pay} {price_day}. All sent through wa.me (free).

### 3.1 Admin general share (Admin → 📤)
```
📚 *NKs EduOrbit — Free Tests*
4थी पासून पुढे आणि स्पर्धा परीक्षा (NMMS, Scholarship…): सगळ्या विषयांचे
✅ Free Tests  ✅ Notes  ✅ सराव प्रश्न
🔓 Login नाही · लगेच Result · तुमचा क्रमांक कळेल
👉 आत्ताच test द्या: {link}
```

### 3.2 Student → friends (after a test)
```
🎉 मी *{subject} — {lesson}* च्या test मध्ये *{score}/{total} ({pct}%)* मिळवले!
🏆 {count} students मध्ये माझा क्रमांक *#{rank}*
तू मला मागे टाकू शकतोस का? 😎
👉 हाच test द्या (Free, login नाही): {direct}
```
{direct} opens THIS test directly (batch/subject/lesson pre-selected), with a banner:
"🏁 {name} चे {pct}% — त्याला मागे टाका!" → name → test. After it: "तुम्ही {my}% vs
{name} {pct}%" and the same share button — the chain continues.

Retry improvement version:
```
🚀 मी पुन्हा प्रयत्न केला: *{subject} — {lesson}* मध्ये {old}% → *{pct}%*!
तू किती मिळवतोस? 👉 {direct}
```

### 3.3 Student → parents (result)
```
नमस्कार आई/बाबा 🙏
मी NKs EduOrbit वर *{subject} — {lesson}* चा test दिला.
📊 गुण: *{score}/{total} ({pct}%)*
🏆 {count} students मध्ये क्रमांक: *#{rank}*
📌 अजून सराव हवा: {weak}
माझे सगळे chapters चे tests, notes आणि weekly report इथे 👇
{pay}
```
"पालकांना विचारा" (from the offer):
```
आई/बाबा, मला NKs EduOrbit वर *{batch}* चे सगळे tests सोडवायचे आहेत 📚
आत्तापर्यंत मी {tests_done} tests दिले, सरासरी {avg}%.
दिवसाला फक्त ₹{price_day}. इथे बघा 👇
{pay}
```

### 3.4 After payment (shown on screen + WhatsApp to the parent's number)
```
✅ अभिनंदन! *{name}* चं NKs EduOrbit account तयार झालं.
👤 Student Code: *{code}*
🔑 PIN: तुम्ही निवडलेला
📱 App: {play_link}
आत्तापर्यंत दिलेले सगळे tests account मध्ये आहेत. शुभेच्छा! 🎯
```
(PIN never written in the message.)

### 3.5 Admin follow-up to leads (one click each, Admin → Leads)
Day 1:
```
नमस्कार 🙏 {name} ने NKs EduOrbit वर *{subject} — {lesson}* test मध्ये {pct}% मिळवले.
{weak} चा सराव केला तर गुण आणखी वाढतील.
पूर्ण अभ्यासक्रम (सगळे tests + notes): {pay}
```
Day 3:
```
{name} ने आत्तापर्यंत {tests_done} free tests दिले 👏
सगळ्या chapters साठी दिवसाला फक्त ₹{price_day}: {pay}
काही प्रश्न असल्यास याच नंबरवर विचारा.
```
Day 7 / before exams:
```
📅 {exam} जवळ आली आहे. {name} साठी revision tests तयार आहेत: {pay}
```

---

## 4. Parent pay page (F8–F9)

1. Child's latest result + weak part + "{tests_done} tests दिले".
2. What is included (4 lines) + 2–3 real parent/student reviews (admin-entered).
3. Plans: monthly / yearly, "दिवसाला ₹X", yearly saving highlighted.
4. Form: child name (prefilled), parent mobile (prefilled), 4-digit PIN.
5. Razorpay → account created (student code), guest attempts moved to it, teacher /
   friend referral kept → message §3.4 → app link.

---

## 5. Admin

- 📤 Share: general link (§3.1), optional per batch.
- Leads: name, parent mobile, batch, tests, best %, last active, paid?; filters; one-click
  WhatsApp with §3.5 texts.
- Funnel: F1…F10 counts by day and source; top lessons by test count.
- Reviews / testimonials for the pay page; scholarship test setup (§7.1).

---

## 6. Build steps (each fully tested; screenshots before going live)

1. **Backend guest identity**: signed guest token, virtual student (free tier, chosen
   batch), allowlist (content read + attempt submit + contact only; everything else
   `GUEST_SIGNUP_REQUIRED`), guest attempts graded by server, rank endpoint (best score
   per person), funnel event endpoint.
2. **Student web — guest browse**: welcome popup, batch/subject choice, chapters with 🔒,
   chapter hub with guide order. Screenshots.
3. **Test experience**: name box, "Result बघा" animation, marking animation, result card
   with live rank, retry flow, share sheet with §3.2/§3.3, friend direct link + challenge
   banner, "all tests" offer rules. Screenshots / video.
4. **Leads + Admin**: parent mobile capture, Admin Leads / Share / Funnel.
5. **Pay page**: auto account creation, attempt migration, §3.4.
6. **App (AAB, ask first)**: claim web progress via Install Referrer, Phone Number Hint,
   daily push reminders for not-yet-paid students.

Regression after every step: full Playwright suite (123) + backend tests.

---

## 7. Suggestions from top-converting test-prep funnels (to decide)

1. **Monthly free "Scholarship Test"** (PW NSAT, Vedantu VSAT, Allen Tallentex style):
   one fixed date, all students together, rank list, discount by score
   (e.g. top 10 % → 50 % off). Biggest single conversion driver in Indian test prep.
2. **Low first price**: first month at ₹49 / first week ₹9, then normal price.
3. **Leaderboard of the week** per batch (names first-name only) — shared as a status image.
4. **Shareable result image** (PNG card for WhatsApp Status), not only text.
5. **Daily free question / streak** ("आजचा प्रश्न") — habit before payment.
6. **Exam countdown** from real exam dates (unit test, सहामाही, बोर्ड).
7. **Real social proof** on the pay page: student count, average improvement, reviews.
8. **Teacher endorsement**: link with teacher code shows "सरांनी सुचवलेला test".
9. **Optional guarantee**: "7 दिवसांत आवडलं नाही तर पैसे परत" (needs owner decision).

## 8. Risks / checks
- No paid content to guests (tests per content type).
- Existing students / teachers / parents untouched (allowlist + regression suite).
- Render load: guest gets only the chosen batch's free content, cached in the browser.
- Abuse: guest session limit per IP; guests can only submit attempts / contact.
- DPDP: only first name from the child; parent number with consent; delete leads on request.
