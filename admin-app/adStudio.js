/* ════════════════════════════════════════
   adStudio.js — Admin › Sync › 📣 Ads (Facebook / Instagram)
   Global: AD_STUDIO

   Video ads for four audiences — 👨‍👩‍👧 parents (most of the budget), 🎓 students,
   🏫 school teachers / tutors and ▶️ YouTube teachers. Within an audience the ads
   differ only in their first seconds (the hook), for A/B testing. Parent and
   student ads open a free test of the class; teacher ads open the teacher
   registration (?treg=school|youtube) with the commission from Admin › Partners.
   Real numbers:
   the class's free tests (/guest/batches), the next exam date, the last
   महा-Test (participants, topper — first name + initial, only when the
   family let the name show). Drawn on a canvas and recorded in this browser
   (MediaRecorder → MP4 where the browser can, else WebM): nothing goes
   through our server or Cloudinary.

   Each ad has its own link (?free=1&batch=…&src=meta&ad=ID); the funnel
   counts visitors per ad (/guest/admin/funnel → by_ad) and the leaderboard
   turns the spend the admin types in (kept on this device) into ₹ per test
   taker / per paid student and says which ad to stop and which to grow.
════════════════════════════════════════ */

const AD_STUDIO = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SITE = 'https://teachingboard-frontend.vercel.app';
  const FMT = { 916: [1080, 1920], 45: [1080, 1350], 11: [1080, 1080] };
  const SPEND_KEY = 'ad_spend';   // { [adId]: rupees } on this admin device
  // who the ad is for, and the share of the daily budget (parents first: they pay)
  const AUD = {
    parent:  { name: '👨‍👩‍👧 पालक', share: 70 },
    student: { name: '🎓 विद्यार्थी', share: 15 },
    school:  { name: '🏫 School teacher / Tutor', share: 10 },
    youtube: { name: '▶️ YouTube teacher', share: 5 },
  };
  const isTeacher = a => a === 'school' || a === 'youtube';

  let _batches = [], _exams = [], _events = [], _cfg = {}, _ready = false;
  // what a class is: 'comp' = स्पर्धा परीक्षा (MCQ ads), 'reg' = regular class (notes + exercise
  // answers ads). Guessed from the name, the admin's choice kept on this device.
  const KIND_KEY = 'ad_kind';
  let _kinds = {}, _content = {};
  const _autoKind = n => /nmms|scholar|शिष्यवृत्ती|navodaya|नवोदय|ntse|olymp|mts|स्पर्धा|competitive/i.test(String(n || '')) ? 'comp' : 'reg';
  const _kindOf = b => _kinds[b] || _autoKind(b);
  const st = { aud: 'parent', kind: 'comp', batch: '', label: '', v: 'loss', lang: 'both', fmt: '916', t0: 0, paused: false, pausedAt: 0, rec: null };

  // ── what the ads say (filled per class) ──
  const T = {
    head: ['🏆 NMMS · बुद्धिमत्ता चाचणी', '🏆 NMMS · Mental Ability'],
    q: ['पुढे कोणती आकृती येईल?', 'Which figure comes next?'],
    ok: ['बरोबर! ✅', 'Correct! ✅'],
    tip: ['💡 युक्ती: बाण दर वेळी 90° फिरतो', '💡 Trick: the arrow turns 90° each time'],
    res: ['तुमचा क्रमांक', 'Your rank'], marks: ['गुण', 'Score'],
    resCap: ['🎯 लगेच Result आणि क्रमांक', '🎯 Instant result & rank'],
    get: ['काय मिळतं?', 'What you get'],
    free: ['आधी Free Test द्या', 'Start with a Free Test'],
    sub: ['Login नाही · लगेच Result · Offline पण', 'No login · Instant result · Works offline'],
    off: ['पहिल्या महिन्यावर 50% सूट*', '50% off the first month*'],
    btn: ['▶ आत्ताच Test द्या', '▶ Take the test now'],
    note: ['*Free test दिल्यावर 12 तास', '*for 12 hours after a free test'],
  };
  function _facts() {
    const b = _batches.find(x => x.name === st.batch) || {};
    const nmms = /nmms/i.test(st.batch);
    const exam = _nextExam();
    const ev = _lastWeekly();
    const top = ev?.toppers?.find(t => !t.hidden) || null;
    const short = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };
    return {
      nmms, label: st.label || st.batch, freeTests: Number(b.free_tests) || 0,
      days: exam ? Math.max(0, Math.ceil((new Date(exam.date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5)) : null,
      examTitle: exam?.title || '',
      players: ev ? (ev.participants || ev.submitted || 0) : 0,
      topName: top ? short(top.name) : '', topScore: top ? `${top.score}/${top.total}` : '',
      pct: Number(_cfg.school_percent ?? 15), flat: Number(_cfg.youtube_flat ?? 30),
      reg: _regFacts(),
    };
  }
  // a regular class's real content: subjects with notes / answers, one real chapter's notes
  // and one real exercise question + answer for the demo screens
  function _regFacts() {
    // विज्ञान and गणित first (on the subjects screen and for the two demo screens)
    const SCI = /sci|विज्ञान|phys|chem|bio/i, MATH = /math|गणित|algebra|geometry|बीजगणित|भूमिती/i;
    const rank = s => SCI.test(s.subject) ? 0 : MATH.test(s.subject) ? 1 : 2;
    const subs = (_content[st.batch]?.subjects || []).filter(s => s.notes || s.answers).sort((a, b) => rank(a) - rank(b));
    const sum = k => subs.reduce((t, s) => t + (s[k] || 0), 0);
    const withNotes = subs.filter(s => s.notes && s.demo_chapter);
    const ns = withNotes.find(s => SCI.test(s.subject)) || withNotes.find(s => MATH.test(s.subject)) || withNotes.sort((a, b) => b.notes - a.notes)[0];
    const note = ns ? { subject: ns.subject, chapter: ns.demo_chapter.name, title: ns.demo_chapter.note_title } : null;
    // exercise demo: गणित (so notes = विज्ञान, exercise = गणित), else विज्ञान, else any
    const es = subs.find(s => s.sample && MATH.test(s.subject)) || subs.find(s => s.sample && SCI.test(s.subject)) || subs.find(s => s.sample);
    const ex = es ? { subject: es.subject, chapter: es.demo_chapter?.name || '', ...es.sample } : null;
    return { subs, notes: sum('notes'), answers: sum('answers'), chapters: sum('chapters'), note, ex, has: subs.length > 0 };
  }
  function _nextExam() {
    const now = new Date().setHours(0, 0, 0, 0);
    return _exams.filter(e => (!e.batch || e.batch === st.batch) && new Date(e.date).getTime() >= now).sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  }
  function _lastWeekly() {
    return _events.filter(e => e.batch === st.batch && !e.is_trial && e.status === 'results' && (e.participants || e.submitted)).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))[0] || null;
  }

  // the six ads; `ok(f)` says whether the class has what the ad needs
  function _variants(f) {
    const L = f.label, R = f.reg, NO_REG = 'या class मध्ये अजून Notes / स्वाध्याय उत्तरं नाहीत';
    // a demo screen only when the class has that content
    const rs = list => list.filter(k => (k !== 'notes' || R.note) && (k !== 'exdemo' || R.ex));
    const regLine = [
      [R.subs.length && `${R.subs.length} विषय`, R.notes && `${R.notes} Notes`, R.answers && `${R.answers} स्वाध्याय उत्तरं`].filter(Boolean).join(', '),
      [R.subs.length && `${R.subs.length} subjects`, R.notes && `${R.notes} notes`, R.answers && `${R.answers} exercise answers`].filter(Boolean).join(', '),
    ];
    return {
      loss: {
        aud: 'parent', kind: 'comp', name: '💰 नुकसानाची भीती', ok: true,
        hook: f.nmms ? ['फक्त 2 गुण कमी पडले…', 'Missed by just 2 marks…'] : [`${L}: फक्त 2 गुण कमी पडले…`, `${L}: missed by just 2 marks…`],
        hook2: f.nmms ? ['…आणि ₹48,000 ची NMMS शिष्यवृत्ती गेली', '…and lost the ₹48,000 NMMS scholarship'] : ['…आणि मेरिट लिस्ट हुकली', '…and missed the merit list'],
        scenes: ['hook', 'question', 'result', 'features', 'offer'],
        copy: [`${f.nmms ? 'NMMS मध्ये फक्त 2 गुण कमी पडले आणि ₹48,000 ची शिष्यवृत्ती गेली' : 'फक्त 2 गुणांनी मेरिट लिस्ट हुकली'} — असं तुमच्या मुलाचं होऊ नये.\n${L}: प्रश्न + सोपी युक्ती, दर रविवारी महा-Test आणि क्रमांक.\n✅ आधी Free test · Login नाही`,
          `${f.nmms ? 'Missed NMMS by 2 marks and lost a ₹48,000 scholarship' : 'Missed the merit list by 2 marks'}? Don't let that be your child.\n${L}: questions with easy tricks, a weekly Maha-Test with ranks.\n✅ Free test first · No login`],
        headline: [f.nmms ? 'NMMS: 2 गुणांनी शिष्यवृत्ती जाऊ देऊ नका' : `${L}: 2 गुणांनी मागे पडू नका`, f.nmms ? 'Don\'t lose NMMS by 2 marks' : `${L}: don't miss by 2 marks`],
      },
      challenge: {
        aud: 'student', kind: 'comp', name: '🧩 10 सेकंद challenge', ok: true,
        hook: [`हा ${f.nmms ? 'NMMS ' : ''}प्रश्न 10 सेकंदात सोडवा!`, `Solve this ${f.nmms ? 'NMMS ' : ''}question in 10 seconds!`],
        scenes: ['challenge', 'question', 'features', 'offer'],
        copy: [`🧩 हा प्रश्न 10 सेकंदात सोडवता येतो का?\nउत्तर आणि युक्ती video मध्ये. ${f.freeTests ? f.freeTests + ' ' : ''}Free tests, दर रविवारी महा-Test आणि तुमचा क्रमांक.\n✅ Login नाही`,
          `🧩 Can you solve this in 10 seconds?\nAnswer and trick in the video. ${f.freeTests ? f.freeTests + ' ' : ''}free tests, a weekly Maha-Test and your rank.\n✅ No login`],
        headline: ['10 सेकंदात सोडवा 🧩', 'Solve it in 10 seconds 🧩'],
      },
      proof: {
        aud: 'parent', kind: 'comp', name: '🏆 या आठवड्याचा Topper', ok: !!(f.players && f.topScore), why: 'आधी या class चा एक महा-Test होऊन result लागायला हवा',
        scenes: ['topper', 'question', 'features', 'offer'],
        copy: [`🏆 या रविवारी ${f.players} मुलांनी महा-Test दिला. Topper${f.topName ? ': ' + f.topName : ''} — ${f.topScore}!\nतुमचं मूल कितव्या क्रमांकावर? आधी Free test द्या.\n✅ Login नाही · लगेच Result`,
          `🏆 ${f.players} students took the Maha-Test this Sunday. Topper${f.topName ? ': ' + f.topName : ''} — ${f.topScore}!\nWhere does your child stand? Start with a free test.\n✅ No login · Instant result`],
        headline: [`या आठवड्याचा Topper ${f.topScore}`, `This week's topper: ${f.topScore}`],
      },
      days: {
        aud: 'parent', kind: 'comp', name: '⏰ परीक्षेला दिवस बाकी', ok: f.days !== null && f.days > 0, why: 'Sync › परीक्षेच्या तारखा मध्ये या class ची तारीख टाका',
        hook: [`${f.examTitle || 'परीक्षेला'} फक्त`, `${f.examTitle || 'Exam'} in just`], hook2: ['दिवस बाकी', 'days'],
        scenes: ['days', 'features', 'question', 'offer'],
        copy: [`⏰ ${f.examTitle || 'परीक्षेला'} फक्त ${f.days} दिवस बाकी.\nरोज 20 मिनिटं: प्रश्न + युक्ती, सराव tests, दर रविवारी महा-Test.\n✅ आजच Free test द्या`,
          `⏰ Only ${f.days} days left for ${f.examTitle || 'the exam'}.\n20 minutes a day: questions with tricks, practice tests, a weekly Maha-Test.\n✅ Take a free test today`],
        headline: [`${f.days} दिवस बाकी ⏰`, `${f.days} days left ⏰`],
      },
      free: {
        aud: 'parent', kind: 'comp', name: '🎁 धोका नाही', ok: true,
        hook: ['आधी Free Test द्या, मग ठरवा', 'Try a free test first, then decide'],
        scenes: ['free', 'question', 'result', 'offer'],
        copy: [`🎁 आधी Free test द्या, मग ठरवा.\nLogin नाही, फॉर्म नाही. ${L} चे प्रश्न, लगेच गुण आणि क्रमांक.`, `🎁 Take a free test first, then decide.\nNo login, no form. ${L} questions, instant score and rank.`],
        headline: [`Free ${L} Test`, `Free ${L} Test`],
      },
      paper: {
        aud: 'parent', kind: 'comp', name: '📄 खऱ्या पेपरसारखे', ok: true,
        hook: [f.nmms ? 'NMMS च्या खऱ्या पेपरसारखे प्रश्न' : `${L}: खऱ्या पेपरसारखे प्रश्न`, f.nmms ? 'Questions like the real NMMS paper' : `${L}: questions like the real paper`],
        scenes: ['paper', 'question', 'features', 'offer'],
        copy: [`📄 मागील ${f.nmms ? 'NMMS ' : ''}प्रश्नपत्रिकांच्या पद्धतीचे प्रश्न, प्रत्येक उत्तराची युक्तीसह.\nदर रविवारी पूर्ण पेपरसारखा महा-Test आणि क्रमांक.\n✅ आधी Free test`,
          `📄 Questions in the pattern of past ${f.nmms ? 'NMMS ' : ''}papers, every answer with a trick.\nA full-paper Maha-Test every Sunday with ranks.\n✅ Free test first`],
        headline: ['खऱ्या पेपरसारखा सराव', 'Practice like the real paper'],
      },
      // ── students ──
      rank: {
        aud: 'student', kind: 'comp', name: '🏅 तुझा क्रमांक कितवा?', ok: true,
        hook: ['या रविवारी तुझा क्रमांक कितवा?', 'What will your rank be this Sunday?'],
        hook2: [`${L} · महा-Test`, `${L} · Maha-Test`],
        scenes: ['hook', 'question', 'result', 'offer'],
        copy: [`🏅 दर रविवारी महा-Test — ${f.players ? f.players + ' मुलांमध्ये ' : ''}तुझा क्रमांक लगेच.\nआधी Free test देऊन सराव कर. Login नाही.`, `🏅 A Maha-Test every Sunday — your rank${f.players ? ' among ' + f.players + ' students' : ''} right away.\nPractise with a free test first. No login.`],
        headline: ['तुझा क्रमांक पाहा 🏅', 'See your rank 🏅'],
      },
      beat: {
        aud: 'student', kind: 'comp', name: '⚔️ मित्राला हरव', ok: true,
        hook: ['तुझ्या मित्रापेक्षा जास्त गुण मिळवशील?', 'Can you beat your friend’s score?'],
        hook2: ['Test दे · Link पाठव · हरव!', 'Take it · Send the link · Win!'],
        scenes: ['hook', 'question', 'result', 'offer'],
        copy: [`⚔️ Free test दे, तुझे गुण मित्राला पाठव आणि बघ कोण जिंकतं!\n${L} चे प्रश्न, लगेच Result.`, `⚔️ Take the free test, send your score to a friend and see who wins!\n${L} questions, instant result.`],
        headline: ['मित्राला हरव ⚔️', 'Beat your friend ⚔️'],
      },
      // ── regular classes: notes + exercise answers + offline (parents) ──
      'r-guide': {
        aud: 'parent', kind: 'reg', name: '📚 Guide ची गरज नाही', ok: R.has, why: NO_REG,
        hook: ['Guide विकत घ्यायची गरज नाही!', 'No need to buy guides!'],
        hook2: [`${L}: सगळे विषय · Notes + स्वाध्याय उत्तरं`, `${L}: every subject · notes + exercise answers`],
        scenes: rs(['hook', 'notes', 'exdemo', 'subjects', 'offer']),
        copy: [`📚 Guide विकत घ्यायची गरज नाही!\n${L}: ${regLine[0]} — धड्यानुसार.\n✈️ Internet नसलं तरी चालतं (Offline).\n✅ आधी Free धडा पाहा`,
          `📚 No need to buy guides!\n${L}: ${regLine[1]} — chapter by chapter.\n✈️ Works without internet (offline).\n✅ See a free chapter first`],
        headline: ['Guide ची गरज नाही 📚', 'No guide needed 📚'],
      },
      'r-offline': {
        aud: 'parent', kind: 'reg', name: '✈️ Internet शिवाय', ok: R.has, why: NO_REG,
        scenes: rs(['offline', 'notes', 'exdemo', 'subjects', 'offer']),
        copy: [`✈️ Internet नाही? तरीही अभ्यास चालू!\nएकदा download केलं की ${L} चे Notes आणि स्वाध्याय उत्तरं Offline उघडतात.\n${regLine[0]}.\n✅ आधी Free धडा पाहा`,
          `✈️ No internet? Studying goes on!\nDownload once and ${L} notes and exercise answers open offline.\n${regLine[1]}.\n✅ See a free chapter first`],
        headline: ['Internet शिवाय अभ्यास ✈️', 'Study without internet ✈️'],
      },
      'r-hw': {
        aud: 'parent', kind: 'reg', name: '📝 स्वाध्यायात अडलं?', ok: R.has, why: NO_REG,
        hook: ['स्वाध्यायात अडलं? उत्तर इथे आहे', 'Stuck on an exercise? The answer is here'],
        hook2: ['धड्यानुसार · step-by-step', 'Chapter by chapter · step by step'],
        scenes: rs(['hook', 'exdemo', 'notes', 'subjects', 'offer']),
        copy: [`📝 मुलाचा स्वाध्याय अडला? पुस्तकातल्या प्रत्येक धड्याच्या स्वाध्यायाची उत्तरं app मध्ये.\n${L}: ${regLine[0]}.\n✈️ Offline पण चालतं.\n✅ आधी Free धडा पाहा`,
          `📝 Child stuck on homework? Answers to every chapter's textbook exercise, in the app.\n${L}: ${regLine[1]}.\n✈️ Works offline too.\n✅ See a free chapter first`],
        headline: ['स्वाध्यायाची उत्तरं एका app मध्ये', 'Exercise answers in one app'],
      },
      'r-cost': {
        aud: 'parent', kind: 'reg', name: '💰 प्रत्येक विषयाची guide?', ok: R.has, why: NO_REG,
        hook: ['प्रत्येक विषयाची वेगळी guide?', 'A separate guide for every subject?'],
        hook2: [`${R.subs.length || ''} विषय · एकच app`.trim(), `${R.subs.length || ''} subjects · one app`.trim()],
        scenes: rs(['hook', 'subjects', 'notes', 'exdemo', 'offer']),
        copy: [`💰 प्रत्येक विषयाची वेगळी guide घेण्यापेक्षा: ${L} चे सगळे विषय एकाच app मध्ये.\n${regLine[0]}.\n✈️ Offline पण चालतं.\n✅ आधी Free धडा पाहा`,
          `💰 Instead of a guide for every subject: all ${L} subjects in one app.\n${regLine[1]}.\n✈️ Works offline too.\n✅ See a free chapter first`],
        headline: ['सगळे विषय · एकच app', 'All subjects · one app'],
      },
      // ── regular classes (students) ──
      'r-shw': {
        aud: 'student', kind: 'reg', name: '✍️ स्वाध्याय समजला नाही?', ok: R.has, why: NO_REG,
        hook: ['स्वाध्याय समजला नाही?', "Didn't get the exercise?"],
        hook2: ['उत्तर पाहा · समजून घे', 'See the answer · understand it'],
        scenes: rs(['hook', 'exdemo', 'notes', 'offer']),
        copy: [`✍️ स्वाध्याय समजला नाही? प्रत्येक धड्याचं उत्तर app मध्ये.\n${L}: ${regLine[0]}. Offline पण.`, `✍️ Didn't get the exercise? Every chapter's answers are in the app.\n${L}: ${regLine[1]}. Offline too.`],
        headline: ['स्वाध्यायाची उत्तरं ✍️', 'Exercise answers ✍️'],
      },
      'r-srev': {
        aud: 'student', kind: 'reg', name: '🌙 परीक्षेआधी revision', ok: R.has, why: NO_REG,
        hook: ['परीक्षेआधी झटपट revision', 'Quick revision before the exam'],
        hook2: ['धड्याचे Notes · Internet शिवाय', 'Chapter notes · no internet needed'],
        scenes: rs(['hook', 'notes', 'offline', 'offer']),
        copy: [`🌙 परीक्षेआधी झटपट revision: ${L} चे धड्यानुसार Notes, Internet शिवाय पण.\n${regLine[0]}.`, `🌙 Quick revision before the exam: ${L} chapter notes, even without internet.\n${regLine[1]}.`],
        headline: ['झटपट revision 🌙', 'Quick revision 🌙'],
      },
      // ── school teachers / tutors (registration; commission from Admin › Partners) ──
      'sc-tools': {
        aud: 'school', name: '📄 पेपर 2 मिनिटात', ok: true,
        hook: ['उद्याचा पेपर 2 मिनिटात तयार', 'Tomorrow’s paper ready in 2 minutes'],
        hook2: ['प्रश्न निवडा · PDF · Answer key', 'Pick questions · PDF · Answer key'],
        scenes: ['hook', 'paper', 'tools', 'earn', 'toffer'],
        copy: [`📄 Class / Tuition साठी: तयार प्रश्नांमधून पेपर 2 मिनिटात, PDF आणि Answer key.\nमुलांचे tests, गुण एका ठिकाणी, Board pen.\n💰 तुमच्या मुलांनी app घेतलं तर ${f.pct}% तुम्हाला.\n✅ नोंदणी Free`,
          `📄 For your class / tuition: a paper in 2 minutes from ready questions, PDF and answer key.\nStudents' tests and marks in one place, a board pen.\n💰 Earn ${f.pct}% when your students subscribe.\n✅ Free registration`],
        headline: ['पेपर 2 मिनिटात · Free', 'Papers in 2 minutes · Free'],
      },
      'sc-earn': {
        aud: 'school', name: `💰 ${f.pct}% कमाई`, ok: true,
        hook: [`तुमच्या मुलांच्या app मधून तुम्हाला ${f.pct}%`, `Earn ${f.pct}% from your students' app`],
        hook2: ['काम नाही · फक्त तुमची link', 'No extra work · just your link'],
        scenes: ['hook', 'earn', 'tools', 'toffer'],
        copy: [`💰 तुमच्या class link मधून मुलांनी app घेतलं की प्रत्येक पहिल्या payment वर ${f.pct}% तुम्हाला, दर महिन्याला UPI वर.\nसोबत Free: पेपर, tests, गुण.\n✅ आजच नोंदणी करा`,
          `💰 When students join through your class link, you get ${f.pct}% of each first payment, monthly by UPI.\nFree tools too: papers, tests, marks.\n✅ Register today`],
        headline: [`${f.pct}% कमाई + Free tools`, `${f.pct}% earnings + free tools`],
      },
      // ── YouTube teachers ──
      'yt-earn': {
        aud: 'youtube', name: `▶️ ₹${f.flat} प्रति student`, ok: true,
        hook: ['Video खाली एक link = कमाई', 'One link under your video = earnings'],
        hook2: [`प्रत्येक paid student मागे ₹${f.flat}`, `₹${f.flat} for every paying student`],
        scenes: ['hook', 'earn', 'tools', 'toffer'],
        copy: [`▶️ YouTube वर शिकवता? Video च्या description मध्ये तुमची link द्या.\nतुमच्या viewers नी app घेतलं की प्रत्येक student मागे ₹${f.flat}, दर महिन्याला UPI वर.\n✅ नोंदणी Free`,
          `▶️ Teach on YouTube? Put your link in the video description.\nEarn ₹${f.flat} for every viewer who subscribes, paid monthly by UPI.\n✅ Free registration`],
        headline: [`₹${f.flat} प्रति student`, `₹${f.flat} per student`],
      },
      'yt-viewers': {
        aud: 'youtube', name: '🎯 Viewers ना Free tests', ok: true,
        hook: ['तुमच्या viewers ना Free tests द्या', 'Give your viewers free tests'],
        hook2: ['Video पाहिला → Test दिला → Rank', 'Watched → Tested → Ranked'],
        scenes: ['hook', 'question', 'earn', 'toffer'],
        copy: [`🎯 तुमच्या video नंतर viewers ना लगेच सराव: Free tests, लगेच Result आणि क्रमांक.\nतुम्हाला प्रत्येक paid student मागे ₹${f.flat}.\n✅ नोंदणी Free`,
          `🎯 Give your viewers practice right after the video: free tests, instant result and rank.\nYou earn ₹${f.flat} per paying student.\n✅ Free registration`],
        headline: ['Viewers ना Free tests', 'Free tests for your viewers'],
      },
    };
  }
  const DUR = { notes: 3500, exdemo: 4500, subjects: 3500, offline: 3500, tools: 4000, earn: 3500, toffer: 3500, hook: 3000, challenge: 4500, topper: 3500, days: 3000, free: 3000, paper: 3000, question: 8000, result: 4000, features: 4000, offer: 4000 };

  // ── drawing ──
  let cv = null, x = null;
  const LL = a => st.lang === 'en' ? a[1] : a[0];
  const L2 = a => st.lang === 'both' ? a[1] : '';
  const cl = v => Math.max(0, Math.min(1, v));
  const p = (t, a, b) => cl((t - a) / (b - a));
  const outBack = s => { const c = 1.70158; return 1 + (c + 1) * Math.pow(s - 1, 3) + c * Math.pow(s - 1, 2); };
  const outCubic = s => 1 - Math.pow(1 - s, 3);
  const C = { ink: '#1d1838', violet: '#6d3cf0', pink: '#ff4d8d', gold: '#ffc83d', green: '#22c55e', sky: '#38bdf8', white: '#ffffff', red: '#ef4444' };
  const font = (w, px) => `${w} ${px}px "Baloo 2", Mukta, "Nirmala UI", sans-serif`;
  function rr(x0, y0, w, h, r) { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); }
  function text(s, X, Y, px, color = C.white, w = 800, align = 'center', maxW = 960) {
    x.font = font(w, px); x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle';
    let size = px; while (x.measureText(s).width > maxW && size > 20) { size -= 2; x.font = font(w, size); }
    x.fillText(s, X, Y);
  }
  const both = (a, X, Y, px, gap, color = C.white, maxW = 960) => { text(LL(a), X, Y, px, color, 800, 'center', maxW); if (L2(a)) text(a[1], X, Y + gap, Math.round(px * .55), '#ffd6e7', 700, 'center', maxW); };
  function bg(W, H, t, warm) {
    const g = x.createLinearGradient(0, 0, W, H);
    if (warm) { g.addColorStop(0, '#3b0a14'); g.addColorStop(.55, '#b91c3c'); g.addColorStop(1, '#ff8a3d'); }
    else { g.addColorStop(0, '#2a0e6b'); g.addColorStop(.55, '#5b21d6'); g.addColorStop(1, '#ff4d8d'); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save(); x.globalAlpha = .12; x.strokeStyle = C.white; x.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      const px = (i * 241 + t * .02 * (i % 2 ? 1 : -1)) % (W + 200) - 100, py = (i * 397 + t * .015) % (H + 200) - 100, s = 60 + (i % 3) * 30;
      x.save(); x.translate(px, py); x.rotate(t / 4000 + i);
      if (i % 3 === 0) { x.beginPath(); x.moveTo(0, -s); x.lineTo(s * .87, s / 2); x.lineTo(-s * .87, s / 2); x.closePath(); x.stroke(); }
      else if (i % 3 === 1) x.strokeRect(-s / 2, -s / 2, s, s);
      else { x.beginPath(); x.arc(0, 0, s / 2, 0, 7); x.stroke(); }
      x.restore();
    }
    x.restore();
  }
  function arrowBox(cx, cy, s, deg, stroke = C.ink, fill = C.white) {
    x.save(); x.fillStyle = fill; x.strokeStyle = stroke; x.lineWidth = 4;
    rr(cx - s / 2, cy - s / 2, s, s, 10); x.fill(); x.stroke();
    x.translate(cx, cy); x.rotate(deg * Math.PI / 180);
    x.strokeStyle = C.ink; x.lineWidth = s * .07; x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, s * .28); x.lineTo(0, -s * .28); x.moveTo(-s * .16, -s * .12); x.lineTo(0, -s * .3); x.lineTo(s * .16, -s * .12); x.stroke();
    x.beginPath(); x.arc(s * .22, s * .22, s * .06, 0, 7); x.fillStyle = C.pink; x.fill();
    x.restore();
  }
  function wrapText(s, X, Y, maxW, lineH, px, color, w = 700, maxLines = 4, align = 'left') {
    x.font = font(w, px); x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle';
    const words = String(s || '').split(/\s+/); let line = '', n = 0;
    for (let i = 0; i < words.length; i++) {
      const tryL = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(tryL).width > maxW && line) {
        if (n === maxLines - 1) { x.fillText(line + ' …', X, Y + n * lineH); return n + 1; }
        x.fillText(line, X, Y + n * lineH); n++; line = words[i];
      } else line = tryL;
    }
    if (line) { x.fillText(line, X, Y + n * lineH); n++; }
    return n;
  }
  const ICONS = [[/math|गणित|algebra|geometry|बीजगणित|भूमिती/i, '➗'], [/sci|विज्ञान|phys|chem|bio/i, '🔬'], [/hist|इतिहास|civic|राज्यशास्त्र|पौर/i, '🏛️'], [/geo|भूगोल/i, '🌍'], [/eng/i, '🔤'], [/marathi|मराठी/i, '📝'], [/hindi|हिंदी/i, '📖'], [/sanskrit|संस्कृत/i, '🕉️']];
  const subjIcon = n => (ICONS.find(([re]) => re.test(n)) || [0, '📘'])[1];
  // the notes screen of a real chapter (also the "offline" screen: Internet off, notes still open)
  function notesScreen(f, lt, offline) {
    const n = f.reg.note || { subject: '', chapter: '', title: '' };
    phoneShell(f, () => {
      if (offline) {
        x.save(); x.fillStyle = '#0d0b18'; rr(380, 196, 160, 44, 22); x.fill(); x.restore();
        text('✈️  📶', 460, 219, 24, C.white, 700);
        const k = p(lt, 400, 800);
        if (k > 0) { x.save(); x.strokeStyle = C.red; x.lineWidth = 5; x.beginPath(); x.moveTo(470, 202); x.lineTo(470 + 36 * k, 236); x.stroke(); x.restore(); }
      }
      text(`${subjIcon(n.subject)} ${n.subject}`, 80, 225, 26, C.violet, 800, 'left', offline ? 290 : 460);
      wrapText(n.chapter, 80, 290, 450, 40, 34, C.ink, 800, 2);
      if (n.title && n.title !== n.chapter) text(n.title, 80, 380, 22, '#8a83b3', 600, 'left', 450);
      const shown = Math.min(11, Math.floor(p(lt, 300, 2300) * 11) + 1);
      for (let i = 0; i < shown; i++) {
        const y = 430 + i * 50, w0 = [440, 400, 450, 330, 420, 380, 445, 300, 410, 430, 360][i];
        if (i === 6) { x.save(); x.strokeStyle = C.violet; x.lineWidth = 4; rr(80, y - 20, 200, 120, 14); x.stroke(); x.beginPath(); x.arc(140, y + 40, 28, 0, 7); x.stroke(); x.beginPath(); x.moveTo(180, y + 40); x.lineTo(260, y + 40); x.stroke(); x.restore(); i += 2; continue; }
        if (i === 2) { x.save(); x.fillStyle = '#fff3a8'; rr(76, y - 16, w0 * outCubic(p(lt, 900, 1700)) + 8, 32, 8); x.fill(); x.restore(); }
        x.fillStyle = i === 0 || i === 4 ? '#3b2d6b' : '#d9d3ee'; rr(80, y - 9, w0, 18, 9); x.fill();
      }
      const b = outBack(p(lt, offline ? 1200 : 2000, offline ? 1700 : 2500));
      if (b > 0) {
        x.save(); x.translate(300, 1060); x.scale(b, b); x.fillStyle = C.green; rr(-210, -38, 420, 76, 38); x.fill();
        text(st.lang === 'en' ? '✈️ Opens offline' : '✈️ Offline पण उघडतं', 0, 2, 30, C.white, 800, 'center', 400);
        x.restore();
      }
    }, `📘 ${f.label}`);
  }
  // a real exercise question; "answer" is tapped and the real answer appears
  function exScreen(f, lt) {
    const e = f.reg.ex || { subject: '', chapter: '', exercise_no: '', question: '', answer: '' };
    phoneShell(f, () => {
      text(`${subjIcon(e.subject)} ${e.subject}${e.exercise_no ? ' · स्वाध्याय ' + e.exercise_no : ''}`, 80, 225, 24, C.violet, 800, 'left', 460);
      text(e.chapter, 80, 265, 22, '#8a83b3', 600, 'left', 460);
      x.save(); x.fillStyle = '#f6f3ff'; rr(60, 295, 480, 250, 20); x.fill(); x.restore();
      text(st.lang === 'en' ? 'Q.' : 'प्रश्न', 84, 325, 24, C.pink, 800, 'left');
      wrapText(e.question, 84, 365, 430, 38, 28, C.ink, 700, 4);
      const tapAt = 1300, tap = lt > tapAt;
      x.save(); x.fillStyle = tap ? '#dcfce7' : C.violet; rr(170, 570, 260, 64, 32); x.fill(); x.restore();
      text(tap ? (st.lang === 'en' ? 'Answer ✓' : 'उत्तर ✓') : (st.lang === 'en' ? 'Show answer' : 'उत्तर पाहा'), 300, 603, 28, tap ? C.green : C.white, 800);
      if (lt > 300 && lt < tapAt + 400) {
        const a = outCubic(p(lt, 300, tapAt)), X = 520 + (330 - 520) * a, Y = 1100 + (640 - 1100) * a;
        x.save(); x.font = font(800, 88); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('👆', X, Y); x.restore();
      }
      if (tap) {
        const k = p(lt, tapAt + 200, tapAt + 2400), full = String(e.answer || '');
        x.save(); x.fillStyle = '#ecfdf3'; x.strokeStyle = C.green; x.lineWidth = 3; rr(60, 660, 480, 440, 20); x.fill(); x.stroke(); x.restore();
        text(st.lang === 'en' ? 'Answer' : 'उत्तर', 84, 690, 24, C.green, 800, 'left');
        wrapText(full.slice(0, Math.max(1, Math.round(full.length * k))), 84, 730, 430, 38, 27, '#14532d', 700, 9);
      }
    }, `📘 ${f.label}`);
  }
  function phoneShell(f, draw, title) {
    x.save();
    x.fillStyle = '#0d0b18'; rr(0, 0, 600, 1200, 70); x.fill();
    x.fillStyle = '#f6f4ff'; rr(18, 18, 564, 1164, 54); x.fill();
    x.fillStyle = '#0d0b18'; rr(230, 34, 140, 30, 15); x.fill();
    x.save(); rr(18, 18, 564, 1164, 54); x.clip();
    const g = x.createLinearGradient(18, 0, 582, 0); g.addColorStop(0, '#6d3cf0'); g.addColorStop(1, '#ff4d8d');
    x.fillStyle = g; x.fillRect(18, 18, 564, 150);
    text(title || (f.nmms ? LL(T.head) : `🏆 ${f.label}`), 300, 120, 30, C.white, 800, 'center', 520);
    x.fillStyle = C.white; rr(40, 190, 520, 940, 34); x.fill();
    draw();
    x.restore(); x.restore();
  }
  function questionScreen(f, lt, { tapAt = 4000, tipAt = 5200, timer = 0 } = {}) {
    phoneShell(f, () => {
      text('Q 7 / 20', 80, 235, 24, '#8a83b3', 700, 'left');
      if (timer) {
        const left = Math.max(0, Math.ceil((timer - lt) / 1000));
        x.save(); x.fillStyle = left <= 3 ? C.red : C.violet; rr(420, 210, 120, 50, 25); x.fill(); x.restore();
        text(`⏱ ${left}s`, 480, 236, 26, C.white, 800);
      }
      text(LL(T.q), 300, 290, 34, C.ink, 800, 'center', 480);
      if (L2(T.q)) text(T.q[1], 300, 335, 22, '#8a83b3', 600, 'center', 480);
      [0, 90, 180].forEach((d, i) => arrowBox(105 + i * 130, 450, 104, d));
      x.save(); x.fillStyle = '#efe9ff'; x.strokeStyle = C.violet; x.lineWidth = 4; x.setLineDash([10, 8]); rr(443, 398, 104, 104, 10); x.fill(); x.stroke(); x.restore();
      text('?', 495, 452, 64, C.violet, 800);
      const tap = lt > tapAt;
      [['A', 45], ['B', 270], ['C', 180], ['D', 90]].forEach(([k, d], i) => {
        const ox = 70 + (i % 2) * 245, oy = 560 + Math.floor(i / 2) * 200, on = tap && i === 1;
        x.save(); x.fillStyle = on ? '#dcfce7' : '#faf8ff'; x.strokeStyle = on ? C.green : '#e2dcf7'; x.lineWidth = on ? 6 : 3;
        rr(ox, oy, 215, 175, 24); x.fill(); x.stroke(); x.restore();
        text(k, ox + 34, oy + 34, 28, on ? C.green : C.violet, 800);
        arrowBox(ox + 125, oy + 92, 96, d, '#cfc6f2');
      });
      if (tap && lt < tipAt) {
        const s = outBack(p(lt, tapAt, tapAt + 400));
        x.save(); x.translate(300, 1000); x.scale(s, s); x.fillStyle = C.green; rr(-150, -40, 300, 80, 40); x.fill(); text(LL(T.ok), 0, 2, 36, C.white, 800); x.restore();
      }
      const fx = 440, fy = 680, a = outCubic(p(lt, tapAt - 1400, tapAt - 200));
      if (lt > tapAt - 1600 && lt < tapAt + 700) {
        const X = 520 + (fx - 520) * a, Y = 1150 + (fy - 1150) * a, press = lt > tapAt - 200 && lt < tapAt + 200;
        x.save(); x.globalAlpha = .9; x.font = font(800, press ? 84 : 96); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('👆', X + 10, Y + 40); x.restore();
      }
      const tp = outCubic(p(lt, tipAt, tipAt + 600));
      if (tp > 0) {
        x.save(); x.translate(0, (1 - tp) * 300); x.globalAlpha = tp;
        x.fillStyle = '#fff7d6'; x.strokeStyle = C.gold; x.lineWidth = 4; rr(40, 955, 520, 150, 26); x.fill(); x.stroke();
        text(LL(T.tip), 300, L2(T.tip) ? 1010 : 1030, 28, '#5a3b00', 800, 'center', 480);
        if (L2(T.tip)) text(T.tip[1], 300, 1060, 22, '#8a6a1f', 600, 'center', 480);
        x.restore();
      }
    });
  }
  function confetti(ct, x0, y0, w) {
    for (let i = 0; i < 70; i++) {
      const cx = x0 + (i * 73) % w, cy = y0 + ((i * 131) % 300) + ct * (.25 + (i % 5) * .08);
      if (cy > 1900) continue;
      x.save(); x.translate(cx, cy); x.rotate(ct / 300 + i); x.fillStyle = [C.gold, C.pink, C.sky, C.green, C.violet][i % 5]; x.fillRect(-9, -4, 18, 8); x.restore();
    }
  }
  function resultScreen(f, lt) {
    phoneShell(f, () => {
      const rp = p(lt, 300, 1600);
      x.save(); x.lineWidth = 34; x.strokeStyle = '#eee8ff'; x.beginPath(); x.arc(300, 470, 170, 0, 7); x.stroke();
      x.strokeStyle = C.green; x.lineCap = 'round'; x.beginPath(); x.arc(300, 470, 170, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * .9 * outCubic(rp)); x.stroke(); x.restore();
      text(`${Math.round(18 * outCubic(rp))}/20`, 300, 455, 92, C.ink, 800);
      text(LL(T.marks), 300, 535, 30, '#8a83b3', 700);
      const k = outBack(p(lt, 1600, 2100));
      x.save(); x.translate(300, 790); x.scale(k, k);
      text(LL(T.res), 0, -110, 34, '#8a83b3', 700); text('🥉 #3', 0, 0, 110, C.violet, 800);
      if (f.players) text(st.lang === 'en' ? `out of ${f.players}` : `${f.players} मुलांमध्ये`, 0, 105, 34, C.ink, 700);
      x.restore();
      if (lt > 1600) confetti(lt - 1600, 40, 200, 520);
    });
  }
  function placePhone(W, H, lt, slideIn, draw, caption) {
    const tall = st.fmt === '916', sq = st.fmt === '11';
    const ph = tall ? 1250 : sq ? 760 : 900, sc = ph / 1200, pw = 600 * sc, topY = tall ? 250 : 130;
    if (caption && !sq) {
      text(LL(caption), W / 2, topY - (tall ? 110 : 70), tall ? 58 : 46, C.white, 800, 'center', W - 100);
      if (st.lang === 'both') text(caption[1], W / 2, topY - (tall ? 45 : 22), tall ? 36 : 30, '#ffd6e7', 700, 'center', W - 100);
    }
    const slide = slideIn ? outCubic(p(lt, 0, 700)) : 1;
    x.save(); x.translate((W - pw) / 2, topY + (tall ? 40 : sq ? -20 : 40) + (1 - slide) * H * .7); x.scale(sc, sc); draw(); x.restore();
  }
  const S = {
    hook(W, H, lt, v) {
      const tall = st.fmt === '916', a = outBack(p(lt, 200, 900)), b = outBack(p(lt, 900, 1600));
      x.save(); x.translate(W / 2, H * .36); x.scale(a, a); both(v.hook, 0, 0, tall ? 92 : 76, tall ? 90 : 72); x.restore();
      if (v.hook2) {
        x.save(); x.translate(W / 2, H * .36 + (tall ? 260 : 200)); x.scale(b, b); x.fillStyle = C.gold; rr(-470, -70, 940, 140, 60); x.fill(); text(LL(v.hook2), 0, 2, tall ? 50 : 44, '#3b1d00', 800, 'center', 880); x.restore();
        if (L2(v.hook2)) text(v.hook2[1], W / 2, H * .36 + (tall ? 370 : 300), 38, C.white, 700, 'center', W - 120);
      }
    },
    challenge(W, H, lt, v, f) { placePhone(W, H, lt, true, () => questionScreen(f, lt, { tapAt: 3600, tipAt: 99999, timer: 4400 }), v.hook); },
    question(W, H, lt, v, f, after) { placePhone(W, H, lt, !after, () => questionScreen(f, lt, after ? { tapAt: -1, tipAt: 200 } : {}), lt < 5200 && !after ? T.q : T.tip); },
    result(W, H, lt, v, f) { placePhone(W, H, lt, false, () => resultScreen(f, lt), T.resCap); },
    features(W, H, lt, v, f) {
      const tall = st.fmt === '916', sq = st.fmt === '11';
      both(T.get, W / 2, tall ? 330 : 140, tall ? 84 : 66, tall ? 80 : 65);
      const rows = [['✅', `${f.freeTests || ''} Free Tests`.trim(), `${f.freeTests || ''} Free Tests`.trim()], ['📚', 'Notes + सराव प्रश्न', 'Notes + Practice'], ['🏆', 'दर रविवारी महा-Test', 'Weekly Maha-Test'], ['💡', 'प्रत्येक उत्तराची युक्ती', 'A trick with every answer'], ['✈️', 'Internet शिवाय पण चालतं', 'Works without internet']];
      rows.forEach(([ic, mr, en], i) => {
        const a = outBack(p(lt, 300 + i * 380, 800 + i * 380)); if (a <= 0) return;
        const rowH = tall ? 210 : sq ? 150 : 175, y0 = (tall ? 540 : sq ? 240 : 280) + i * rowH;
        x.save(); x.translate(W / 2, y0); x.scale(a, a);
        x.fillStyle = 'rgba(255,255,255,.95)'; rr(-450, -rowH / 2 + 14, 900, rowH - 28, 40); x.fill();
        text(ic, -360, 0, tall ? 80 : 64, C.ink, 800);
        text(st.lang === 'en' ? en : mr, 40, st.lang === 'both' ? -22 : 0, tall ? 54 : 46, C.ink, 800, 'center', 640);
        if (st.lang === 'both') text(en, 40, 36, 32, '#8a83b3', 700, 'center', 640);
        x.restore();
      });
    },
    topper(W, H, lt, v, f) {
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), cy = H * (tall ? .42 : .45);
      both(['🏆 या रविवारचा महा-Test', "🏆 This Sunday's Maha-Test"], W / 2, tall ? 260 : 110, tall ? 64 : 54, tall ? 70 : 56);
      x.save(); x.translate(W / 2, cy); x.scale(a, a);
      x.fillStyle = C.white; rr(-420, -330, 840, 660, 60); x.fill();
      x.fillStyle = C.gold; x.beginPath(); x.arc(0, -170, 110, 0, 7); x.fill();
      text(f.topName ? f.topName.split(/\s+/).map(w => w[0]).join('').slice(0, 2) : '🏆', 0, -168, 90, '#3b1d00', 800);
      text(`${f.topName || 'Topper'} · ${f.label}`, 0, 10, 56, C.ink, 800, 'center', 760);
      text(f.topScore, 0, 110, 96, C.violet, 800);
      text(st.lang === 'en' ? `Rank #1 of ${f.players}` : `${f.players} मुलांमध्ये #1`, 0, 215, 44, '#8a83b3', 700, 'center', 760);
      x.restore();
      if (lt > 700) confetti(lt - 700, 0, 0, W);
      const b = outBack(p(lt, 1500, 2100));
      x.save(); x.translate(W / 2, cy + (tall ? 470 : 380)); x.scale(b, b);
      x.fillStyle = C.gold; rr(-430, -60, 860, 120, 60); x.fill();
      text(st.lang === 'en' ? 'Where does your child stand?' : 'तुमचं मूल कितव्या क्रमांकावर?', 0, 2, 46, '#3b1d00', 800, 'center', 820);
      x.restore();
    },
    days(W, H, lt, v, f) {
      const tall = st.fmt === '916', start = Math.max(f.days + 40, 60), n = Math.round(start - (start - f.days) * outCubic(p(lt, 300, 1600)));
      both(v.hook, W / 2, H * .24, tall ? 70 : 58, tall ? 70 : 56);
      const s = 1 + Math.sin(lt / 160) * .03;
      x.save(); x.translate(W / 2, H * .47); x.scale(s, s); text(String(n), 0, 0, tall ? 380 : 300, C.gold, 800); x.restore();
      both(v.hook2, W / 2, H * .47 + (tall ? 250 : 190), tall ? 80 : 64, tall ? 80 : 64);
    },
    free(W, H, lt, v) {
      const tall = st.fmt === '916';
      both(v.hook, W / 2, H * .25, tall ? 78 : 64, tall ? 78 : 62, C.white, W - 100);
      [['✅', 'Login नाही', 'No login'], ['✅', 'फॉर्म नाही', 'No form'], ['✅', 'पैसे नाही', 'No payment'], ['⚡', 'लगेच Result', 'Instant result']].forEach(([ic, mr, en], i) => {
        const a = outBack(p(lt, 400 + i * 380, 850 + i * 380)); if (a <= 0) return;
        x.save(); x.translate(W / 2, H * .42 + i * (tall ? 190 : 140)); x.scale(a, a);
        x.fillStyle = 'rgba(255,255,255,.95)'; rr(-360, -65, 720, 130, 65); x.fill();
        text(`${ic} ${st.lang === 'en' ? en : mr}${st.lang === 'both' ? ' · ' + en : ''}`, 0, 2, tall ? 52 : 44, C.ink, 800, 'center', 680);
        x.restore();
      });
    },
    paper(W, H, lt, v, f) {
      const tall = st.fmt === '916', a = outCubic(p(lt, 100, 800)), pw = tall ? 760 : 620, ph2 = tall ? 980 : 700;
      both(v.hook, W / 2, H * (tall ? .17 : .12), tall ? 70 : 56, tall ? 70 : 54, C.white, W - 100);
      x.save(); x.translate(W / 2, H * .52 + (1 - a) * 300); x.rotate(-.04);
      x.fillStyle = '#fffdf6'; rr(-pw / 2, -ph2 / 2, pw, ph2, 18); x.fill();
      text(f.nmms ? 'NMMS · MAT' : f.label, 0, -ph2 / 2 + 70, 52, C.ink, 800, 'center', pw - 60);
      for (let i = 0; i < 6; i++) {
        const y = -ph2 / 2 + 200 + i * (tall ? 120 : 80);
        text(`${i + 1}.`, -pw / 2 + 60, y, 30, C.ink, 800);
        x.fillStyle = '#d9d3ee'; rr(-pw / 2 + 100, y - 10, pw - 300, 20, 10); x.fill();
        arrowBox(pw / 2 - 110, y, tall ? 70 : 54, i * 90);
      }
      x.restore();
      const b = outBack(p(lt, 1300, 1900));
      x.save(); x.translate(W / 2 + (tall ? 300 : 250), H * .52 - ph2 / 2 - 30); x.rotate(.18); x.scale(b, b);
      x.fillStyle = C.red; rr(-170, -55, 340, 110, 20); x.fill(); text(st.lang === 'en' ? 'Real pattern' : 'खरी पद्धत', 0, 2, 44, C.white, 800);
      x.restore();
    },
    notes(W, H, lt, v, f) { placePhone(W, H, lt, true, () => notesScreen(f, lt, false), ['📒 धड्यानुसार Notes', '📒 Chapter-wise notes']); },
    exdemo(W, H, lt, v, f) { placePhone(W, H, lt, true, () => exScreen(f, lt), ['✍️ पुस्तकातल्या स्वाध्यायाची उत्तरं', '✍️ Textbook exercise answers']); },
    offline(W, H, lt, v, f) { placePhone(W, H, lt, true, () => notesScreen(f, lt, true), ['Internet नाही? तरीही अभ्यास ✈️', 'No internet? Still studying ✈️']); },
    subjects(W, H, lt, v, f) {
      const tall = st.fmt === '916', sq = st.fmt === '11', subs = f.reg.subs.slice(0, 8);
      both(['सगळे विषय एकाच app मध्ये', 'Every subject in one app'], W / 2, tall ? 250 : sq ? 95 : 120, tall ? 72 : 56, tall ? 70 : 52, C.white, W - 100);
      const cols = 2, rows = Math.max(1, Math.ceil(subs.length / cols));
      const top = tall ? 400 : sq ? 200 : 240, bottom = H - (tall ? 330 : sq ? 170 : 200);
      const th = Math.min(tall ? 260 : 200, (bottom - top) / rows), tw = 470;
      subs.forEach((s, i) => {
        const a = outBack(p(lt, 200 + i * 160, 600 + i * 160)); if (a <= 0) return;
        // the grid sits in the middle of the free space (few subjects = not stuck at the top)
        const y0 = top + Math.max(0, (bottom - top - rows * th) / 2);
        const cx = W / 2 + (i % cols ? 1 : -1) * (tw / 2 + 10), cy = y0 + Math.floor(i / cols) * th + th / 2;
        x.save(); x.translate(cx, cy); x.scale(a, a);
        x.fillStyle = 'rgba(255,255,255,.96)'; rr(-tw / 2, -th / 2 + 8, tw, th - 16, 30); x.fill();
        const big = th > 170;
        text(subjIcon(s.subject), -tw / 2 + 60, big ? -20 : 0, big ? 64 : 48, C.ink, 800);
        text(s.subject, 40, big ? -32 : -22, big ? 42 : 34, C.ink, 800, 'center', tw - 150);
        const stat = st.lang === 'en' ? `📒 ${s.notes} · ✍️ ${s.answers}` : `📒 ${s.notes} Notes · ✍️ ${s.answers} उत्तरं`;
        text(stat, 40, big ? 30 : 22, big ? 30 : 24, '#6b6290', 700, 'center', tw - 150);
        x.restore();
      });
      const b = outBack(p(lt, 1600, 2100));
      x.save(); x.translate(W / 2, H - (tall ? 230 : sq ? 120 : 140)); x.scale(b, b);
      x.fillStyle = C.gold; rr(-380, -50, 760, 100, 50); x.fill();
      text(st.lang === 'en' ? '✈️ Works without internet' : '✈️ Internet शिवाय पण चालतं', 0, 2, 40, '#3b1d00', 800, 'center', 720);
      x.restore();
    },
    tools(W, H, lt) {
      const tall = st.fmt === '916', sq = st.fmt === '11';
      both(['काय मिळतं? (Free)', 'What you get (free)'], W / 2, tall ? 330 : 140, tall ? 76 : 60, tall ? 76 : 60);
      const rows = [['📄', 'पेपर + PDF + Answer key', 'Paper + PDF + answer key'], ['📝', 'मुलांचे tests आणि गुण', "Students' tests & marks"], ['🖊️', 'Board pen / Whiteboard', 'Board pen / whiteboard'], ['🏆', 'दर रविवारी महा-Test', 'Weekly Maha-Test']];
      rows.forEach(([ic, mr, en], i) => {
        const a = outBack(p(lt, 300 + i * 450, 800 + i * 450)); if (a <= 0) return;
        const rowH = tall ? 230 : sq ? 165 : 190, y0 = (tall ? 560 : sq ? 260 : 300) + i * rowH;
        x.save(); x.translate(W / 2, y0); x.scale(a, a);
        x.fillStyle = 'rgba(255,255,255,.95)'; rr(-450, -rowH / 2 + 14, 900, rowH - 28, 40); x.fill();
        text(ic, -360, 0, tall ? 80 : 64, C.ink, 800);
        text(st.lang === 'en' ? en : mr, 40, st.lang === 'both' ? -22 : 0, tall ? 50 : 44, C.ink, 800, 'center', 640);
        if (st.lang === 'both') text(en, 40, 36, 32, '#8a83b3', 700, 'center', 640);
        x.restore();
      });
    },
    earn(W, H, lt, v, f) {
      const tall = st.fmt === '916', yt = v.aud === 'youtube';
      both(yt ? ['प्रत्येक paid student मागे', 'For every paying student'] : ['प्रत्येक पहिल्या payment वर', 'On every first payment'], W / 2, H * .22, tall ? 64 : 52, tall ? 66 : 54, C.white, W - 100);
      const goal = yt ? f.flat : f.pct, n = Math.round(goal * outCubic(p(lt, 200, 1400)));
      const s = 1 + Math.sin(lt / 160) * .03;
      x.save(); x.translate(W / 2, H * .45); x.scale(s, s); text(yt ? `₹${n}` : `${n}%`, 0, 0, tall ? 330 : 260, C.gold, 800); x.restore();
      both(['दर महिन्याला UPI वर', 'Paid monthly by UPI'], W / 2, H * .45 + (tall ? 240 : 180), tall ? 58 : 48, tall ? 60 : 50);
      if (lt > 900) confetti(lt - 900, 0, 0, W);
    },
    toffer(W, H, lt) {
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), c = outBack(p(lt, 900, 1500)), cy = tall ? H * .3 : H * .24;
      x.save(); x.translate(W / 2, cy); x.scale(a, a);
      both(['नोंदणी Free', 'Free registration'], 0, 0, tall ? 96 : 76, tall ? 90 : 72);
      text(st.lang === 'en' ? 'Commission rules: in the app' : 'Commission चे नियम app मध्ये', 0, tall ? 170 : 135, 38, C.white, 700, 'center', W - 100);
      x.restore();
      x.save(); x.translate(W / 2, cy + (tall ? 520 : 360)); const pulse = 1 + Math.sin(lt / 180) * .03; x.scale(c * pulse, c * pulse);
      x.fillStyle = C.white; rr(-400, -75, 800, 150, 75); x.fill(); text(st.lang === 'en' ? '▶ Become a partner' : '▶ Partner व्हा', 0, 2, 58, C.violet, 800, 'center', 740);
      x.restore();
    },
    offer(W, H, lt, v) {
      const reg = v?.kind === 'reg';
      const FREE = reg ? ['आधी Free धडा पाहा', 'See a free chapter first'] : T.free;
      const SUB = reg ? ['Notes + स्वाध्याय · Offline पण', 'Notes + answers · Works offline'] : T.sub;
      const BTN = reg ? ['▶ Free धडा पाहा', '▶ See a free chapter'] : T.btn;
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), b = outBack(p(lt, 800, 1400)), c = outBack(p(lt, 1500, 2100)), cy = tall ? H * .27 : H * .2;
      x.save(); x.translate(W / 2, cy); x.scale(a, a);
      both(FREE, 0, 0, tall ? 88 : 72, tall ? 84 : 68, C.white, W - 100);
      text(LL(SUB), 0, tall ? 165 : 130, 40, C.white, 700, 'center', W - 100);
      x.restore();
      x.save(); x.translate(W / 2, cy + (tall ? 460 : 300)); x.rotate(-.05 + Math.sin(lt / 300) * .02); x.scale(b, b);
      x.fillStyle = C.gold; rr(-430, -110, 860, 220, 50); x.fill();
      text('50% OFF', 0, -38, 100, '#3b1d00', 800); text(LL(T.off), 0, 58, 42, '#3b1d00', 800, 'center', 800);
      x.restore();
      x.save(); x.translate(W / 2, cy + (tall ? 790 : 560)); const pulse = 1 + Math.sin(lt / 180) * .03; x.scale(c * pulse, c * pulse);
      x.fillStyle = C.white; rr(-400, -75, 800, 150, 75); x.fill(); text(LL(BTN), 0, 2, 58, C.violet, 800, 'center', 740);
      x.restore();
      if (c > .5) { text(SITE.replace(/^https:\/\//, ''), W / 2, cy + (tall ? 930 : 680), 38, C.white, 700); text(LL(T.note), W / 2, cy + (tall ? 990 : 730), 30, '#ffd6e7', 600); }
    },
  };
  const timeline = v => { let at = 0; return v.scenes.map(k => { const s = { k, at, d: DUR[k] }; at += s.d; return s; }); };
  const lengthOf = v => v.scenes.reduce((n, k) => n + DUR[k], 0);

  function drawAt(t) {
    if (!cv) return;
    const [W, H] = FMT[st.fmt];
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const f = _facts(), v = _variants(f)[st.v], tl = timeline(v), cur = tl.find(s => t >= s.at && t < s.at + s.d) || tl[tl.length - 1];
    bg(W, H, t, st.v === 'loss' && cur.k === 'hook');
    const prev = tl[tl.indexOf(cur) - 1];
    S[cur.k](W, H, t - cur.at, v, f, cur.k === 'question' && prev?.k === 'challenge');
    text('🚀 NKs EduOrbit', W / 2, H - (st.fmt === '916' ? 80 : 45), 44, C.white, 800);
  }

  // ── ad id + link + text ──
  const _slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'class';
  const _audOf = v => _variants(_facts())[v]?.aud || 'parent';
  // teacher ads are not tied to a class: t-<variant>
  const adId = (v = st.v) => isTeacher(_audOf(v)) ? `t-${v}` : `${_slug(st.batch)}-${v}`;
  const adLink = (v = st.v) => isTeacher(_audOf(v))
    ? `${SITE}/student-app/?treg=${_audOf(v)}&src=meta&ad=${encodeURIComponent(adId(v))}`
    : `${SITE}/student-app/?free=1&batch=${encodeURIComponent(st.batch)}${_variants(_facts())[v]?.kind === 'reg' ? '&k=r' : ''}&src=meta&ad=${encodeURIComponent(adId(v))}`;
  function adText(v = st.v) {
    const f = _facts(), a = _variants(f)[v];
    const body = st.lang === 'mr' ? a.copy[0] : st.lang === 'en' ? a.copy[1] : `${a.copy[0]}\n\n${a.copy[1]}`;
    return `Primary text:\n${body}\n\nHeadline: ${st.lang === 'en' ? a.headline[1] : a.headline[0]}\nButton: ${isTeacher(a.aud) ? 'Sign up' : 'Learn more'}\nLink: ${adLink(v)}`;
  }

  // ── recording: the canvas as a video, in this browser ──
  function _mime() {
    const want = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    return want.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  }
  async function record(v, fmt) {
    const mime = _mime();
    if (!mime || !cv.captureStream) throw new Error('हा browser video बनवू शकत नाही — Chrome वापरा');
    const keep = { v: st.v, fmt: st.fmt, paused: st.paused };
    st.v = v; st.fmt = fmt; st.paused = false; st.t0 = performance.now();
    drawAt(0);
    const stream = cv.captureStream(30), chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    st.rec = rec; rec.start(500);
    const f = _facts(), len = lengthOf(_variants(f)[v]);
    st.t0 = performance.now();
    await new Promise(r => setTimeout(r, len + 300));
    rec.stop(); await done; st.rec = null;
    Object.assign(st, keep, { t0: performance.now() });
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    return { blob: new Blob(chunks, { type: mime.split(';')[0] }), name: `${adId(v)}-${fmt === '916' ? '9x16' : fmt === '45' ? '4x5' : '1x1'}.${ext}`, ext };
  }

  // ── leaderboard: which ad brings test takers / paying students cheapest ──
  async function _spend() { return (await DB.getSetting(SPEND_KEY, {}).catch(() => ({}))) || {}; }
  async function _saveSpend(id, rupees) { const s = await _spend(); s[id] = Math.max(0, Number(rupees) || 0); await DB.setSetting(SPEND_KEY, s).catch(() => {}); }
  // the decision rules (documented for the admin in the panel)
  function verdicts(rows) {
    const enough = r => r.spend >= 500 || r.opened >= 30;
    const cpt = r => r.tested ? r.spend / r.tested : Infinity;
    const cpp = r => r.paid ? r.spend / r.paid : Infinity;
    const usePaid = rows.filter(r => r.paid >= 3).length >= 2;
    const cost = usePaid ? cpp : cpt;
    const judged = rows.filter(r => enough(r) && r.spend > 0);
    const best = Math.min(...judged.map(cost).filter(Number.isFinite));
    return rows.map(r => {
      let v = '▶ चालू ठेवा', tone = '';
      if (!r.spend) { v = '₹ खर्च लिहा'; tone = 'muted'; }
      else if (!enough(r)) { v = '⏳ अजून data कमी'; tone = 'muted'; }
      else if (!(usePaid ? r.paid : r.tested)) { v = '⏸ बंद करा (काहीच येत नाही)'; tone = 'bad'; }
      else if (Number.isFinite(best) && cost(r) === best) { v = '🏆 जिंकतेय — बजेट 20–25% वाढवा'; tone = 'good'; }
      else if (Number.isFinite(best) && cost(r) > best * 1.5) { v = '⏸ बंद करा (दीडपट महाग)'; tone = 'bad'; }
      return { ...r, cpt: cpt(r), cpp: cpp(r), verdict: v, tone, by: usePaid ? 'paid' : 'test' };
    });
  }
  async function _loadBoard(fresh = false) {
    const box = $('ads-board'); if (!box) return;
    box.innerHTML = '<p class="import-hint">⏳ उघडत आहे…</p>';
    try {
      const days = Number($('ads-days')?.value || 30);
      // Meta's own numbers (spend, views, link clicks) when Meta is connected on the server
      const [f, meta] = await Promise.all([
        API.fetchGuestFunnel(days),
        Promise.resolve(API.fetchMetaAds?.(days, { fresh })).catch(err => ({ connected: false, error: err?.message || '' })),
      ]);
      const M = meta?.connected ? (meta.by_name || {}) : {};
      const spend = await _spend();
      const V = _variants(_facts());
      // which audience an ad id belongs to: t-<variant> = teacher ads, <class>-<variant> otherwise
      const ours = id => /^t-/.test(id) || Object.keys(V).some(v => id.endsWith('-' + v));
      const audOfId = id => { const m = /^t-(.+)$/.exec(id); if (m) return V[m[1]]?.aud || 'school'; const k = Object.keys(V).find(v => id.endsWith('-' + v)); return V[k]?.aud || 'parent'; };
      const ids = new Set([...Object.keys(f.by_ad || {}), ...Object.keys(f.by_teacher_ad || {}), ...Object.keys(spend), ...Object.keys(M).filter(ours)]);
      const odd = Object.values(M).filter(m => !ours(m.name.toLowerCase()));
      const rs = n => Number.isFinite(n) ? '₹' + Math.round(n) : '—';
      const num = n => n >= 1e5 ? (n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);
      // spend: from Meta when the ad is there (read-only), else typed by the admin
      const spendCell = r => M[r.id] ? `<b>₹${Math.round(r.spend)}</b> <small class="ads-meta">Meta</small>`
        : `<input type="number" min="0" step="50" class="admin-input ads-spend" data-id="${_esc(r.id)}" value="${r.spend || ''}" aria-label="${_esc(r.id)} खर्च" />`;
      const metaCell = id => M[id] ? `${num(M[id].impressions)} · ${M[id].clicks}${M[id].clicks ? ` <small>(₹${Math.round(M[id].spend / M[id].clicks)}/click)</small>` : ''}` : '—';
      const status = !meta ? '' : meta.connected
        ? `<p class="ads-meta-line ok">🔗 Meta जोडलं: <b>${_esc(meta.account?.name || '')}</b> · ${_esc(meta.account?.currency || '')} · ${_esc(meta.since || '')} ते ${_esc(meta.until || '')} · ${Object.keys(M).length} ads</p>`
        : meta.error ? `<p class="ads-meta-line bad">⚠️ ${_esc(meta.error)}</p>`
        : '<p class="ads-meta-line">🔗 Meta जोडलेलं नाही — खर्च हाताने लिहा.</p>';
      const groups = Object.keys(AUD).map(aud => {
        const mine = [...ids].filter(id => audOfId(id) === aud);
        if (!mine.length) return '';
        const sp = id => M[id] ? M[id].spend : (Number(spend[id]) || 0);
        if (isTeacher(aud)) {
          const rows = verdicts(mine.map(id => { const t = f.by_teacher_ad?.[id] || {}; return { id, opened: 0, tested: t.registered || 0, paid: t.paid || 0, spend: sp(id), approved: t.approved || 0, students: t.students || 0 }; }))
            .sort((a, b) => (a.by === 'paid' ? a.cpp - b.cpp : a.cpt - b.cpt));
          return `<h5 class="ads-aud-h">${AUD[aud].name}</h5><table class="ads-table"><thead><tr><th>Ad</th><th>Meta: पाहिली · click</th><th>नोंदणी</th><th>Approve</th><th>त्यांनी आणलेली मुलं</th><th>Pay केलं</th><th>खर्च ₹</th><th>₹ / नोंदणी</th><th>₹ / paid</th><th>काय करायचं</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="${r.tone}"><td>${_esc(r.id)}</td><td>${metaCell(r.id)}</td><td>${r.tested}</td><td>${r.approved}</td><td>${r.students}</td><td>${r.paid}</td>
              <td>${spendCell(r)}</td>
              <td>${rs(r.cpt)}</td><td>${rs(r.cpp)}</td><td><b>${r.verdict}</b></td></tr>`).join('')}</tbody></table>`;
        }
        const rows = verdicts(mine.map(id => ({ id, opened: f.by_ad?.[id]?.opened || 0, tested: f.by_ad?.[id]?.tested || 0, paid: f.by_ad?.[id]?.paid || 0, spend: sp(id) })))
          .sort((a, b) => (a.by === 'paid' ? a.cpp - b.cpp : a.cpt - b.cpt) || b.opened - a.opened);
        return `<h5 class="ads-aud-h">${AUD[aud].name}</h5><table class="ads-table"><thead><tr><th>Ad</th><th>Meta: पाहिली · click</th><th>Link उघडली</th><th>Test दिली</th><th>Pay केलं</th><th>खर्च ₹</th><th>₹ / test</th><th>₹ / paid</th><th>काय करायचं</th></tr></thead><tbody>
          ${rows.map(r => `<tr class="${r.tone}"><td>${_esc(r.id)}</td><td>${metaCell(r.id)}</td><td>${r.opened}</td><td>${r.tested}</td><td>${r.paid}</td>
            <td>${spendCell(r)}</td>
            <td>${rs(r.cpt)}</td><td>${rs(r.cpp)}</td><td><b>${r.verdict}</b></td></tr>`).join('')}</tbody></table>`;
      }).join('');
      // Meta ads whose name is not one of our ad ids: their numbers can't be matched
      const oddHtml = odd.length ? `<p class="ads-meta-line bad">ℹ️ Meta मधल्या या ads चं नाव आपल्या ad id सारखं नाही, म्हणून त्यांचे आकडे जुळत नाहीत: ${odd.map(m => `<b>${_esc(m.name)}</b> (₹${Math.round(m.spend)})`).join(', ')}. Ads Manager मध्ये ad चं नाव ad id सारखं ठेवा (उदा. 10th-r-guide).</p>` : '';
      if (!groups) { box.innerHTML = `${status}${oddHtml}<p class="import-hint">अजून कोणत्याही ad मधून कोणी आलं नाही. Ad चालू केल्यावर इथे आकडे येतील.</p>`; return; }
      box.innerHTML = `${status}${groups}${oddHtml}
      <p class="import-hint">प्रत्येक गटातल्या ads ची तुलना त्याच गटातल्या ads शी. पालक / विद्यार्थी: "₹ प्रति test", teachers: "₹ प्रति नोंदणी"; 2 ads ना 3+ paid झाले की "₹ प्रति paid" वरून. ₹500 खर्च किंवा 30 जणांनी link उघडल्यावरच निर्णय. ${meta?.connected ? 'खर्च Meta कडून आपोआप येतो (10 मिनिटांत एकदा ताजा).' : 'Meta मधला खर्च इथे लिहा.'}</p>`;
      box.querySelectorAll('.ads-spend').forEach(inp => inp.addEventListener('change', async () => { await _saveSpend(inp.dataset.id, inp.value); _loadBoard(); }));
    } catch (err) { box.innerHTML = `<p class="import-hint">आकडे आणता आले नाहीत: ${_esc(err?.message || '')}</p>`; }
  }

  // ── panel ──
  function _paintSide() {
    const f = _facts(), V = _variants(f);
    const mine = Object.entries(V).filter(([, a]) => a.aud === st.aud && (isTeacher(st.aud) || (a.kind || 'comp') === st.kind));
    if (!V[st.v] || V[st.v].aud !== st.aud || !V[st.v].ok) st.v = (mine.find(([, a]) => a.ok) || mine[0])[0];
    document.querySelectorAll('.ads-aud').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.aud === st.aud)));
    $('ads-variants').innerHTML = mine.map(([k, a]) => `<button type="button" class="ads-var" data-v="${k}" aria-pressed="${k === st.v}" ${a.ok ? '' : 'disabled'} title="${_esc(a.ok ? '' : a.why)}"><b>${a.name}</b><small>${a.ok ? (st.v === k ? '▶ पाहत आहात' : '') : _esc(a.why)}</small></button>`).join('');
    $('ads-recvars').innerHTML = mine.map(([k, a]) => `<label><input type="checkbox" class="ads-var-rec" value="${k}" ${a.ok ? 'checked' : 'disabled'} /> ${_esc(a.name)}</label>`).join(' ');
    const teach = isTeacher(st.aud);
    $('ads-class-row').hidden = teach;
    $('ads-teacher-warn').hidden = !teach;
    const tl = $('ads-teacher-warn').querySelector('a'); if (tl) tl.href = `../partner-terms.html?type=${st.aud === 'youtube' ? 'youtube' : 'school'}`;
    $('ads-copy').textContent = adText();
    if ($('ads-kind')) $('ads-kind').value = st.kind;
    const R = f.reg;
    $('ads-facts').textContent = teach ? `Commission (Admin › Partners): School ${f.pct}% · YouTube ₹${f.flat} प्रति paid student`
      : st.kind === 'reg' ? (_content[st.batch] ? (R.has ? `${R.subs.length} विषय (${R.subs.map(s => s.subject).join(', ')}) · ${R.notes} Notes · ${R.answers} स्वाध्याय उत्तरं${R.note ? ' · Notes demo: ' + R.note.chapter : ''}${R.ex ? ' · स्वाध्याय demo: ' + R.ex.chapter : ''}` : 'या class मध्ये अजून Notes / स्वाध्याय उत्तरं नाहीत') : '⏳ उघडत आहे…')
      : [`Free tests: ${f.freeTests}`, f.days !== null ? `परीक्षा: ${f.days} दिवस` : 'परीक्षेची तारीख नाही', f.players ? `महा-Test: ${f.players} मुलं, topper ${f.topScore}${f.topName ? ' (' + f.topName + ')' : ''}` : 'महा-Test result नाही'].join(' · ');
  }
  function _paintBudget() {
    const total = Math.max(0, Number($('ads-budget')?.value) || 0);
    $('ads-split').innerHTML = Object.values(AUD).map(a => `<span class="ads-split-i">${a.name}: <b>${a.share}%${total ? ` = ₹${Math.round(total * a.share / 100)}` : ''}</b></span>`).join('');
  }
  let _raf = 0;
  function _loop(now) {
    _raf = requestAnimationFrame(_loop);
    if (!cv || !cv.isConnected || st.rec) { if (st.rec) drawAt(now - st.t0); return; }
    const f = _facts(), len = lengthOf(_variants(f)[st.v]);
    drawAt(st.paused ? st.pausedAt : (now - st.t0) % len);
  }
  async function _downloadSelected() {
    const btn = $('ads-rec'), msg = $('ads-msg');
    const fmts = [...document.querySelectorAll('.ads-fmt-rec')].filter(c => c.checked).map(c => c.value);
    const vars = [...document.querySelectorAll('.ads-var-rec')].filter(c => c.checked).map(c => c.value);
    if (!fmts.length || !vars.length) { msg.textContent = 'किमान एक ad आणि एक आकार निवडा'; return; }
    btn.disabled = true;
    try {
      let n = 0;
      for (const v of vars) for (const fm of fmts) {
        n++; msg.textContent = `⏳ video ${n} / ${vars.length * fmts.length} बनत आहे… (हे tab उघडं ठेवा)`;
        const r = await record(v, fm);
        await FILE_EXPORT.saveAndShare(r.blob, r.name);
        if (r.ext !== 'mp4') msg.textContent = 'हा browser WebM देतो; Meta ला MP4 हवं — Chrome / Edge वापरा';
      }
      msg.textContent = `✅ ${n} video download झाले`;
    } catch (err) { msg.textContent = err?.message || 'Video बनला नाही'; }
    btn.disabled = false;
  }

  async function init() {
    const host = $('ad-studio'); if (!host) return;
    if (!_ready) {
      _ready = true;
      host.innerHTML = `
        <h3 class="admin-section-title">📣 Facebook / Instagram Ads</h3>
        <p class="import-hint">प्रत्येक गटाच्या ads — फक्त सुरुवात वेगळी. एका गटाच्या सगळ्या ads एकदम चालवा, सगळ्यात स्वस्तात test / नोंदणी / paid आणणारी ठेवा, बाकी बंद. Video इथेच (या browser मध्ये) बनतो; server / Cloudinary वर काही जात नाही.</p>
        <div class="ads-auds" role="group" aria-label="कोणासाठी">${Object.entries(AUD).map(([k, a]) => `<button type="button" class="ads-aud" data-aud="${k}" aria-pressed="${k === st.aud}">${a.name}<small>बजेट ${a.share}%</small></button>`).join('')}</div>
        <div class="ads-budget">रोजचं एकूण बजेट ₹ <input id="ads-budget" type="number" min="0" step="50" class="admin-input" placeholder="उदा. 500" aria-label="रोजचं बजेट" /> <span id="ads-split"></span>
          <p class="import-hint">पैसे मुख्यतः पालकांच्या ads वर: पैसे पालक भरतात, आणि 13–17 वयाच्या मुलांना Meta फक्त वय / ठिकाणावरून ad दाखवू देतं.</p></div>
        <p class="ads-warn" id="ads-teacher-warn" hidden>ℹ️ Teacher ads मध्ये कमाईचा उल्लेख आहे — नियम: <a href="../partner-terms.html?type=${st.aud === 'youtube' ? 'youtube' : 'school'}" target="_blank" rel="noopener">Partner terms</a>. Commission चे आकडे बदलले तर ads आपोआप बदलतात.</p>
        <div class="ads-row">
          <span class="ads-row" id="ads-class-row" style="margin:0">
          <label>Class <select id="ads-batch" class="admin-input"></select></label>
          <label>प्रकार <select id="ads-kind" class="admin-input"><option value="comp">🏆 स्पर्धा परीक्षा (MCQ)</option><option value="reg">📘 Regular (Notes + स्वाध्याय)</option></select></label>
          <label>Ad मध्ये नाव <input id="ads-label" class="admin-input" maxlength="30" placeholder="उदा. 8वी NMMS" /></label>
          </span>
          <label>भाषा <select id="ads-lang" class="admin-input"><option value="both">मराठी + English</option><option value="mr">मराठी</option><option value="en">English</option></select></label>
          <label>पाहा <select id="ads-fmt" class="admin-input"><option value="916">9:16 Reels / Stories</option><option value="45">4:5 Feed</option><option value="11">1:1</option></select></label>
        </div>
        <p class="import-hint" id="ads-facts"></p>
        <div class="ads-vars" id="ads-variants" role="group" aria-label="Ads"></div>
        <div class="ads-stage">
          <canvas id="ads-cv" width="1080" height="1920" aria-label="Ad preview"></canvas>
          <div class="ads-side">
            <pre class="gxa-msg" id="ads-copy"></pre>
            <div class="admin-toolbar"><button type="button" class="admin-btn-secondary" id="ads-copy-btn">📋 मजकूर Copy</button></div>
            <div class="ads-recbox">
              <b>📥 Video download</b>
              <div id="ads-recvars"></div>
              <div><label><input type="checkbox" class="ads-fmt-rec" value="916" checked /> 9:16</label> <label><input type="checkbox" class="ads-fmt-rec" value="45" checked /> 4:5</label> <label><input type="checkbox" class="ads-fmt-rec" value="11" /> 1:1</label></div>
              <button type="button" class="admin-btn-primary" id="ads-rec">🎬 निवडलेले video बनवा</button>
              <p class="import-hint" id="ads-msg">प्रत्येक video त्याच्या लांबीइतका (≈20 सेकंद) वेळ घेतो.</p>
            </div>
          </div>
        </div>
        <h4 class="admin-section-title" style="margin-top:14px">🏁 कोणती ad जिंकतेय?</h4>
        <div class="admin-toolbar"><select id="ads-days" class="admin-input" aria-label="दिवस"><option value="7">7 दिवस</option><option value="30" selected>30 दिवस</option></select><button type="button" class="admin-btn-secondary" id="ads-refresh">Refresh</button></div>
        <div id="ads-board"></div>`;
      cv = $('ads-cv'); x = cv.getContext('2d');
      $('ads-batch').addEventListener('change', e => { st.batch = e.target.value; st.label = ''; $('ads-label').value = _defaultLabel(); _setBatchKind(); });
      $('ads-kind').addEventListener('change', async e => {
        _kinds[st.batch] = e.target.value;
        await DB.setSetting(KIND_KEY, _kinds).catch(() => {});
        _setBatchKind();
      });
      $('ads-label').addEventListener('input', e => { st.label = e.target.value.trim(); _paintSide(); });
      $('ads-lang').addEventListener('change', e => { st.lang = e.target.value; _paintSide(); });
      $('ads-fmt').addEventListener('change', e => { st.fmt = e.target.value; });
      host.querySelectorAll('.ads-aud').forEach(b => b.addEventListener('click', () => { st.aud = b.dataset.aud; st.t0 = performance.now(); _paintSide(); }));
      $('ads-budget').addEventListener('input', _paintBudget);
      _paintBudget();
      $('ads-variants').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; st.v = b.dataset.v; st.t0 = performance.now(); _paintSide(); });
      $('ads-copy-btn').addEventListener('click', () => { navigator.clipboard?.writeText(adText()).catch(() => {}); APP.toast('Copied!', 'success'); });
      $('ads-rec').addEventListener('click', _downloadSelected);
      $('ads-refresh').addEventListener('click', () => _loadBoard(true));
      $('ads-days').addEventListener('change', () => _loadBoard());
      st.t0 = performance.now();
      _raf = requestAnimationFrame(_loop);
    }
    const [b, ex, ev, cfgRes] = await Promise.all([
      API.fetchGuestBatches().catch(() => []),
      API.fetchExamDates().catch(() => []),
      API.adminWeekly('GET', '/events').then(r => r?.data || []).catch(() => []),
      Promise.resolve(API.fetchPartnerConfig?.()).catch(() => ({})),
    ]);
    _batches = b; _exams = ex; _events = ev; _cfg = cfgRes || {};
    const sel = $('ads-batch');
    sel.innerHTML = _batches.map(x0 => `<option value="${_esc(x0.name)}">${_esc(x0.name)} (${Number(x0.free_tests) || 0} free tests)</option>`).join('');
    if (!st.batch || !_batches.some(x0 => x0.name === st.batch)) st.batch = (_batches.find(x0 => /nmms/i.test(x0.name)) || _batches[0] || {}).name || '';
    sel.value = st.batch;
    if (!st.label) $('ads-label').value = _defaultLabel();
    st.label = $('ads-label').value.trim();
    _kinds = (await DB.getSetting(KIND_KEY, {}).catch(() => ({}))) || {};
    _setBatchKind();
    _loadBoard();
  }
  // the class's kind (guessed / chosen) and, for a regular class, its real content
  function _setBatchKind() {
    st.kind = _kindOf(st.batch);
    st.t0 = performance.now();
    _paintSide();
    if (st.kind === 'reg' && st.batch && !_content[st.batch]) {
      const b = st.batch;
      API.fetchAdContent(b).then(r => { _content[b] = r || { subjects: [] }; if (st.batch === b) _paintSide(); })
        .catch(() => { _content[b] = { subjects: [] }; if (st.batch === b) _paintSide(); });
    }
  }
  // "8th NMMS EXAM 26-27 BATCH" → "8th NMMS"
  function _defaultLabel() { return String(st.batch || '').replace(/\b(batch|exam|class)\b/gi, '').replace(/\d{2}\s*-\s*\d{2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }

  return { init, verdicts, adLink, adText, record, drawAt, __st: st, __content: _content };
})();

window.AD_STUDIO = AD_STUDIO;
