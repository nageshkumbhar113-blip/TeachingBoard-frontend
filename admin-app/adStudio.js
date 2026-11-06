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
  const SITE = 'https://nkseduorbit.in';
  const FMT = { 916: [1080, 1920], 45: [1080, 1350], 11: [1080, 1080], 169: [1920, 1080] };   // 16:9 = YouTube
  const FMT_TAG = { 916: '9x16', 45: '4x5', 11: '1x1', 169: '16x9' };
  const SPEND_KEY = 'ad_spend';   // { [adId]: rupees } on this admin device
  // who the ad is for, and the share of the daily budget (parents first: they pay)
  const AUD = {
    parent:  { name: '👨‍👩‍👧 पालक', share: 70, ages: [28, 50] },
    student: { name: '🎓 विद्यार्थी', share: 15, ages: [13, 17] },
    school:  { name: '🏫 School teacher / Tutor', share: 10, ages: [22, 55] },
    youtube: { name: '▶️ YouTube teacher', share: 5, ages: [20, 50] },
  };
  const isTeacher = a => a === 'school' || a === 'youtube';
  // 11वी–12वी (JEE / NEET / CET / CUET / NDA): the student chooses as much as the parent
  const SENIOR = { parent: { share: 45, ages: [38, 55] }, student: { share: 40, ages: [16, 21] } };
  const _senior = () => (_content[st.batch]?.exam?.group === 'senior') || /\b(11|12)(th|वी)?\b|\bjee\b|neet|\bcet\b|cuet|\bnda\b/i.test(st.batch || '');
  const _share = k => (_senior() && SENIOR[k]?.share) || AUD[k].share;
  const _ages = k => (_senior() && SENIOR[k]?.ages) || AUD[k].ages;

  let _batches = [], _exams = [], _events = [], _cfg = {}, _ready = false;
  // what a class is: 'comp' = स्पर्धा परीक्षा (MCQ ads), 'reg' = regular class (notes + exercise
  // answers ads). Guessed from the name, the admin's choice kept on this device.
  const KIND_KEY = 'ad_kind';
  let _kinds = {}, _content = {};
  const _autoKind = n => /nmms|scholar|शिष्यवृत्ती|navodaya|नवोदय|ntse|olymp|mts|स्पर्धा|competitive|\bjee\b|neet|\bcet\b|cuet|\bnda\b|sainik|सैनिक|aissee|\brms\b|rimc|military|lateral/i.test(String(n || '')) ? 'comp' : 'reg';
  const _kindOf = b => _kinds[b] || _autoKind(b);
  const st = { plat: 'meta', aud: 'parent', kind: 'comp', batch: '', label: '', v: 'loss', lang: 'both', fmt: '916', t0: 0, paused: false, pausedAt: 0, rec: null };

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
    const C = _content[st.batch] || {}, sx = C.exam || null;
    // an ability-test exam (NMMS, शिष्यवृत्ती, नवोदय…): a बुद्धिमत्ता question first, if the free tests have one
    const ABILITY = /बुद्धिमत्ता|बौद्धिक|mental|reason|\bmat\b/i;
    const mcqs = /nmms|navodaya|नवोदय|scholar|शिष्यवृत्ती/i.test(st.batch || '') ? [...(C.mcqs || [])].sort((a, b) => (ABILITY.test(b.subject) ? 1 : 0) - (ABILITY.test(a.subject) ? 1 : 0)) : (C.mcqs || []);
    // Sync › परीक्षेच्या तारखा first, else the date in Site / Exams
    const exam = _nextExam() || (sx?.next_date ? { title: sx.name, date: sx.next_date.date } : null);
    const ev = _lastWeekly();
    const top = ev?.toppers?.find(t => !t.hidden) || null;
    const short = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };
    return {
      nmms, label: st.label || st.batch, freeTests: Number(b.free_tests) || 0,
      mcqs, mcq: mcqs.length ? mcqs[(st.qi || 0) % mcqs.length] : null, site: sx, loaded: !!_content[st.batch],
      trio: _trio(mcqs),
      // the figure question (बाण फिरतो) fits only school-level ability tests
      matType: /nmms|navodaya|नवोदय|scholar|शिष्यवृत्ती|aissee|sainik|सैनिक|\brms\b|rimc|mts|olymp|ntse/i.test(st.batch || ''),
      loss: sx?.ad_loss_mr ? [sx.ad_loss_mr, sx.ad_loss_en || sx.ad_loss_mr] : nmms ? ['…आणि ₹48,000 ची NMMS शिष्यवृत्ती गेली', '…and lost the ₹48,000 NMMS scholarship'] : null,
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
  // the 3 question screens: one बुद्धिमत्ता, one इतिहास, one गणित when the free tests have them,
  // else three different subjects; null when the class has fewer than 3 subjects in its free tests.
  // "🔄 दुसरा प्रश्न" moves each screen to that subject's next question.
  const TRIO_WANT = [/बुद्धिमत्ता|बौद्धिक|mental|reason|\bmat\b/i, /इतिहास|history/i, /गणित|math/i];
  function _trio(mcqs) {
    const bySub = new Map();
    for (const m of mcqs || []) { const k = m.subject || '—'; if (!bySub.has(k)) bySub.set(k, []); bySub.get(k).push(m); }
    if (bySub.size < 3) return null;
    const subs = [...bySub.keys()], picked = [];
    for (const re of TRIO_WANT) { const k = subs.find(x => re.test(x) && !picked.includes(x)); if (k) picked.push(k); }
    for (const k of subs) if (picked.length < 3 && !picked.includes(k)) picked.push(k);
    return picked.slice(0, 3).map(k => { const l = bySub.get(k); return l[(st.qi || 0) % l.length]; });
  }
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
  // ── 🎬 the admin's own videos (AI scripts, adScript.js) ──
  // _scripts: [{ sid, raw }] (saved on the server, Admin › Ads › 🎬); _shots: sid → { scene index: Image }
  const _scripts = [], _shots = {}, _parsed = new Map();
  const AUD_LETTER = { parent: 'p', student: 's', school: 't', youtube: 'y' };
  const LETTER_AUD = { p: 'parent', s: 'student', t: 'school', y: 'youtube' };
  // the app's real numbers for the { } placeholders
  function _phValues(f) {
    return {
      youtube_commission: f.flat, school_commission: f.pct, student_discount: Number(_cfg.student_discount_percent ?? 50),
      free_tests: f.freeTests || null, days_left: f.days || null, offer_percent: 50,
      exam_name: f.site?.name || f.examTitle || null, class_name: f.label || null,
    };
  }
  function _scriptOf(sid, f) {
    const sc = _scripts.find(x => x.sid === sid); if (!sc || !window.AD_SCRIPT) return null;
    const vals = _phValues(f), key = sc.raw + '|' + JSON.stringify(vals) + '|' + Object.keys(_shots[sid] || {}).length;
    if (!_parsed.has(key)) { _parsed.set(key, AD_SCRIPT.parse(sc.raw, vals, { shots: Object.keys(_shots[sid] || {}).length })); if (_parsed.size > 60) _parsed.delete(_parsed.keys().next().value); }
    return _parsed.get(key);
  }
  function _scriptVariants(f) {
    const out = {};
    for (const sc of _scripts) {
      const r = _scriptOf(sc.sid, f); if (!r) continue;
      const S0 = r.script, aud = AUD_LETTER[S0.audience] ? S0.audience : 'parent';
      let ok = r.ok, why = r.errors[0] || '';
      if (ok && S0.scenes.some(x => x.type === 'question' && x.use === 'class') && !f.mcq) { ok = false; why = 'या class च्या free test मध्ये ad साठी योग्य प्रश्न नाही ("use": "class")'; }
      const scenes = S0.scenes.length ? S0.scenes.map((x, i) => ({ k: 'x_' + x.type, d: x.ms, data: { ...x, i } })) : [{ k: 'x_hook', d: 3000, data: { text: '⚠️ script मध्ये चूक', i: 0 } }];
      const copy = S0.copy.text || `${S0.title} — NKs EduOrbit`;
      out['s:' + sc.sid] = { aud, custom: true, sid: sc.sid, name: '🎬 ' + S0.title, ok, why, style: S0.style, link: S0.link, scenes,
        copy: [copy, copy], headline: [S0.copy.headline || S0.title, S0.copy.headline || S0.title], errors: r.errors, warnings: r.warnings, ms: r.ms };
    }
    return out;
  }
  const _shotImg = (v, d) => _shots[v?.sid]?.[d?.i] || null;
  function _variants(f) {
    const V = Object.assign(_variants0(f), _scriptVariants(f));
    if (f.trio) for (const v of Object.values(V)) {
      if (v.kind !== 'comp' || isTeacher(v.aud)) continue;
      v.scenes = v.scenes.map((k, i) => (k === 'question' && v.scenes[i - 1] !== 'challenge' ? 'trio' : k));
    }
    // ✍️ every ad gets the pen screen: after the question(s) (or the exercise demo) on the phone;
    // teachers: the class smart board before the tools
    for (const v of Object.values(V)) {
      if (v.custom || v.scenes.some(k => k === 'penphone' || k === 'penboard')) continue;
      if (isTeacher(v.aud)) { const i = v.scenes.indexOf('tools'); v.scenes.splice(i >= 0 ? i : v.scenes.length - 1, 0, 'penboard'); continue; }
      let i = v.scenes.findIndex(k => k === 'trio' || k === 'question');
      if (i < 0) i = v.scenes.indexOf('exdemo'); if (i < 0) i = v.scenes.indexOf('notes');
      v.scenes.splice(i >= 0 ? i + 1 : v.scenes.length - 1, 0, 'penphone');
    }
    if (!f.mcq && !f.matType) {
      const why = !f.loaded ? '⏳ उघडत आहे…' : 'या class च्या free test मध्ये अजून ad साठी योग्य प्रश्न नाही (चित्र / सूत्र नसलेला, 4 पर्यायांचा)';
      for (const v of Object.values(V)) if (v.kind === 'comp' && !isTeacher(v.aud) && v.scenes.some(k => k === 'question' || k === 'challenge')) { v.ok = false; v.why = why; }
    }
    return V;
  }
  function _variants0(f) {
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
        hook2: f.loss || ['…आणि मेरिट लिस्ट हुकली', '…and missed the merit list'],
        scenes: ['hook', 'question', 'result', 'features', 'offer'],
        copy: [`${f.loss ? 'फक्त 2 गुण कमी पडले ' + f.loss[0].replace(/^…\s*/, '') : 'फक्त 2 गुणांनी मेरिट लिस्ट हुकली'} — असं तुमच्या मुलाचं होऊ नये.\n${L}: प्रश्न + सोपी युक्ती, दर रविवारी महा-Test आणि क्रमांक.\n✅ आधी Free test · Login नाही`,
          `${f.loss ? 'Missed by just 2 marks ' + f.loss[1].replace(/^…\s*/, '') : 'Missed the merit list by 2 marks'}? Don't let that be your child.\n${L}: questions with easy tricks, a weekly Maha-Test with ranks.\n✅ Free test first · No login`],
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
      'demo-rank': {
        aud: 'parent', kind: 'comp', name: '🏅 Rank कसा दिसतो (नमुना)', ok: true, demo: true,
        scenes: ['topper', 'question', 'result', 'offer'],
        copy: [`🏅 दर रविवारी महा-Test: तुमच्या मुलाचे गुण आणि ${f.label} मधला क्रमांक लगेच app मध्ये.\n(Video मधली rank screen नमुना आहे.)\n✅ आधी Free test · Login नाही`,
          `🏅 A Maha-Test every Sunday: your child's score and rank in ${f.label}, right away in the app.\n(The rank screen in the video is a sample.)\n✅ Free test first · No login`],
        headline: ['तुमच्या मुलाचा क्रमांक पाहा 🏅', "See your child's rank 🏅"],
      },
      days: {
        aud: 'parent', kind: 'comp', name: '⏰ परीक्षेला दिवस बाकी', ok: f.days !== null && f.days > 0, why: 'Sync › परीक्षेच्या तारखा किंवा Site / Exams मध्ये या class च्या परीक्षेची तारीख टाका',
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
      'sc-board': {
        aud: 'school', name: '🏫 Smart board वर शिकवा', ok: true,
        hook: ['वर्गात smart board वर थेट solution', 'Solve it live on the class smart board'],
        hook2: ['तयार प्रश्न · pen · laser', 'Ready questions · pen · laser'],
        scenes: ['hook', 'penboard', 'tools', 'earn', 'toffer'],
        copy: [`🏫 वर्गात smart board वर थेट शिकवा: तयार प्रश्न उघडा, pen ने solution लिहा, laser ने दाखवा, पुसा.\nपेपर, tests आणि गुण पण Free.\n💰 तुमच्या मुलांनी app घेतलं तर ${f.pct}% तुम्हाला.\n✅ नोंदणी Free`,
          `🏫 Teach live on the class smart board: open a ready question, write the solution with a pen, point with the laser, erase.\nPapers, tests and marks free too.\n💰 Earn ${f.pct}% when your students subscribe.\n✅ Free registration`],
        headline: ['Smart board वर शिकवा · Free', 'Teach on a smart board · free'],
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
  const DUR = { penphone: 4900, penboard: 5400, notes: 3500, exdemo: 4500, subjects: 3500, offline: 3500, tools: 4000, earn: 3500, toffer: 3500, hook: 3000, challenge: 4500, topper: 3500, days: 3000, free: 3000, paper: 3000, question: 8000, trio: 10500, result: 4000, features: 4000, offer: 4000 };

  // ── drawing ──
  let cv = null, x = null;
  // the app's logo (same site, so the canvas can still be recorded): small in the corner all
  // through the ad, big on the last card
  const LOGO = new Image();
  LOGO.src = '../icons/icon-512.png';
  const logoOk = () => LOGO.complete && LOGO.naturalWidth > 0;
  function logo(cx, cy, size) {
    if (!logoOk()) return;
    x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = size * .12; x.shadowOffsetY = size * .04;
    x.drawImage(LOGO, cx - size / 2, cy - size / 2, size, size); x.restore();
  }
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
  const THEME = { violet: ['#2a0e6b', '#5b21d6', '#ff4d8d'], orange: ['#4a1300', '#e8590c', '#ffb02e'], green: ['#03341f', '#0f9d58', '#38bdf8'], dark: ['#07060f', '#1d1838', '#6d3cf0'], warm: ['#3b0a14', '#b91c3c', '#ff8a3d'] };
  function bg(W, H, t, warm, theme) {
    const g = x.createLinearGradient(0, 0, W, H), c = THEME[warm ? 'warm' : theme] || THEME.violet;
    g.addColorStop(0, c[0]); g.addColorStop(.55, c[1]); g.addColorStop(1, c[2]);
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
  function phoneShell(f, draw, title, bare) {
    x.save();
    x.fillStyle = '#0d0b18'; rr(0, 0, 600, 1200, 70); x.fill();
    x.fillStyle = '#f6f4ff'; rr(18, 18, 564, 1164, 54); x.fill();
    x.fillStyle = '#0d0b18'; rr(230, 34, 140, 30, 15); x.fill();
    x.save(); rr(18, 18, 564, 1164, 54); x.clip();
    const g = x.createLinearGradient(18, 0, 582, 0); g.addColorStop(0, '#6d3cf0'); g.addColorStop(1, '#ff4d8d');
    x.fillStyle = g; x.fillRect(18, 18, 564, 150);
    // the header names the subject of the question really shown (a free-test question can be इतिहास,
    // गणित…); 'बुद्धिमत्ता चाचणी' only for the built-in figure question
    const head = f.mcq ? `🏆 ${f.nmms ? 'NMMS' : f.label}${f.mcq.subject ? ' · ' + f.mcq.subject : ''}` : f.nmms ? LL(T.head) : `🏆 ${f.label}`;
    text(title || head, 300, 120, 30, C.white, 800, 'center', 520);
    x.fillStyle = C.white; rr(40, 190, 520, 940, 34); x.fill();
    draw();
    x.restore(); x.restore();
  }
  function mcqScreen(f, lt, { tapAt = 4000, tipAt = 5200, timer = 0 } = {}) {
    const m = f.mcq;
    phoneShell(f, () => {
      text('Q 7 / 20', 80, 235, 24, '#8a83b3', 700, 'left', 320);   // the subject is in the header
      if (timer) {
        const left = Math.max(0, Math.ceil((timer - lt) / 1000));
        x.save(); x.fillStyle = left <= 3 ? C.red : C.violet; rr(420, 210, 120, 50, 25); x.fill(); x.restore();
        text(`⏱ ${left}s`, 480, 236, 26, C.white, 800);
      }
      const n = wrapText(m.q, 300, 310, 470, 44, 32, C.ink, 800, 4, 'center');
      const tap = lt > tapAt, top = 330 + n * 44;
      m.options.forEach((o, i) => {
        const oy = top + i * 120, on = tap && i === m.answer;
        x.save(); x.fillStyle = on ? '#dcfce7' : '#faf8ff'; x.strokeStyle = on ? C.green : '#e2dcf7'; x.lineWidth = on ? 6 : 3;
        rr(70, oy, 460, 100, 22); x.fill(); x.stroke(); x.restore();
        text('ABCD'[i], 110, oy + 50, 28, on ? C.green : C.violet, 800);
        text(o, 330, oy + 50, 28, C.ink, 700, 'center', 360);
      });
      const okY = Math.min(1010, top + 4 * 120 + 30);
      if (tap && lt < tipAt) {
        const sc = outBack(p(lt, tapAt, tapAt + 400));
        x.save(); x.translate(300, okY); x.scale(sc, sc); x.fillStyle = C.green; rr(-150, -40, 300, 80, 40); x.fill(); text(LL(T.ok), 0, 2, 36, C.white, 800); x.restore();
      }
      const fy = top + m.answer * 120 + 50, a = outCubic(p(lt, tapAt - 1400, tapAt - 200));
      if (lt > tapAt - 1600 && lt < tapAt + 700) {
        const X = 520 + (440 - 520) * a, Y = 1150 + (fy - 1150) * a, press = lt > tapAt - 200 && lt < tapAt + 200;
        x.save(); x.globalAlpha = .9; x.font = font(800, press ? 84 : 96); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('👆', X + 10, Y + 40); x.restore();
      }
      const tp = outCubic(p(lt, tipAt, tipAt + 600));
      if (tp > 0) {
        x.save(); x.translate(0, (1 - tp) * 300); x.globalAlpha = tp;
        x.fillStyle = '#fff7d6'; x.strokeStyle = C.gold; x.lineWidth = 4; rr(40, 925, 520, 190, 26); x.fill(); x.stroke();
        const why = m.why || `बरोबर उत्तर: ${'ABCD'[m.answer]}) ${m.options[m.answer]}`;
        wrapText('💡 ' + why, 300, 970, 470, 36, 26, '#5a3b00', 800, 4, 'center');
        x.restore();
      }
    });
  }
  const MCQ_CAP = { q: ['हा प्रश्न सोडवा', 'Solve this question'], tip: ['💡 उत्तर आणि युक्ती', '💡 Answer and trick'] };
  function questionScreen(f, lt, opts = {}) {
    if (f.mcq) return mcqScreen(f, lt, opts);
    const { tapAt = 4000, tipAt = 5200, timer = 0 } = opts;
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
  // the smart board (pen tools) inside the phone, for the app scene "smartboard"
  function boardScreen(f, lt) {
    phoneShell(f, () => {
      x.save(); x.fillStyle = '#10301f'; rr(50, 200, 500, 700, 24); x.fill(); x.restore();
      // tool bar
      const tools = ['✏️', '🖍️', '⬛', '⭕', '↩️'];
      tools.forEach((t0, i) => { x.save(); x.fillStyle = i === 0 ? '#ffd23f' : '#ffffff'; rr(70 + i * 96, 920, 80, 80, 20); x.fill(); x.restore(); text(t0, 110 + i * 96, 960, 40, C.ink, 800); });
      // the pen writes: a heading, an underline, a circle, an arrow
      const k = p(lt, 200, 2600);
      x.save(); x.strokeStyle = '#ffffff'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
      x.save(); x.beginPath(); x.rect(70, 220, 460 * Math.min(1, k * 2), 120); x.clip();
      text(st.lang === 'en' ? 'a² + b² = c²' : 'a² + b² = c²', 300, 280, 56, '#ffffff', 700, 'center', 440); x.restore();
      if (k > .45) { x.beginPath(); x.moveTo(120, 340); x.lineTo(120 + 360 * p(k, .45, .6), 340); x.stroke(); }
      if (k > .6) { x.strokeStyle = '#ffd23f'; x.beginPath(); x.arc(200, 560, 90, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * p(k, .6, .8)); x.stroke(); }
      if (k > .8) { x.strokeStyle = '#ff6b9a'; const e = p(k, .8, 1); x.beginPath(); x.moveTo(310, 560); x.lineTo(310 + 160 * e, 560 - 120 * e); x.stroke();
        if (e > .95) { x.beginPath(); x.moveTo(470, 440); x.lineTo(440, 448); x.moveTo(470, 440); x.lineTo(462, 470); x.stroke(); } }
      x.restore();
      // the pen tip follows the writing
      const px0 = k < .45 ? 90 + 900 * k : k < .6 ? 120 + 360 * p(k, .45, .6) : k < .8 ? 200 + 90 * Math.cos(-Math.PI / 2 + 2 * Math.PI * p(k, .6, .8)) : 310 + 160 * p(k, .8, 1);
      const py0 = k < .45 ? 280 : k < .6 ? 340 : k < .8 ? 560 + 90 * Math.sin(-Math.PI / 2 + 2 * Math.PI * p(k, .6, .8)) : 560 - 120 * p(k, .8, 1);
      if (k < 1) { x.save(); x.font = font(800, 64); x.textAlign = 'left'; x.textBaseline = 'bottom'; x.fillText('✏️', px0 - 6, py0 + 6); x.restore(); }
    }, '🖊️ Smart Board');
  }
  // the admin's own screenshot inside the phone (slow zoom); a placeholder until one is added
  function shotScreen(f, lt, img) {
    phoneShell(f, () => {
      if (img && img.naturalWidth) {
        const z = 1 + .06 * p(lt, 0, 3800), w0 = 564, h0 = 1014, r = Math.max(w0 / img.naturalWidth, h0 / img.naturalHeight) * z;
        const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
        x.save(); x.beginPath(); x.rect(18, 168, w0, h0); x.clip(); x.drawImage(img, 18 + (w0 - dw) / 2, 168 + (h0 - dh) / 2 * .4, dw, dh); x.restore();
      } else {
        x.save(); x.strokeStyle = '#c9bdf5'; x.setLineDash([16, 12]); x.lineWidth = 5; rr(70, 300, 460, 620, 30); x.stroke(); x.restore();
        text('🖼️', 300, 540, 120, C.violet, 800); text(st.lang === 'en' ? 'Add a screenshot' : 'Screenshot जोडा', 300, 680, 36, C.violet, 800);
      }
    }, '📱 NKs EduOrbit', !!(img && img.naturalWidth));
  }
  // ── ✍️ the pen writes a solution, fast: on the student's phone (board mode) or the class smart board ──
  // built-in example: a² − b²; a 🎬 script gives its own { q, lines }
  const PEN_DEMO = { q: ['सोडवा: 47² − 43² = ?', 'Solve: 47² − 43² = ?'], lines: ['a² − b² = (a + b)(a − b)', '= (47 + 43)(47 − 43)', '= 90 × 4', '= 360'], done: ['5 सेकंदात सुटलं!', 'Solved in 5 seconds!'] };
  const PEN = { start: 700, line: 650, gap: 100, hold: 1200 };
  const penMs = n => PEN.start + n * (PEN.line + PEN.gap) + PEN.hold;
  const HAND = px => `700 ${px}px Kalam, "Baloo 2", Mukta, "Nirmala UI", cursive`;
  const _penData = d => (d && d.lines ? { q: d.q || '', lines: d.lines, done: '' } : { q: LL(PEN_DEMO.q), lines: PEN_DEMO.lines, done: LL(PEN_DEMO.done) });
  // which line the pen is on (i) and how far along it (k); i = n when all are written
  function penAt(lt, n) {
    const t = lt - PEN.start; if (t < 0) return { i: -1, k: 0 };
    const i = Math.floor(t / (PEN.line + PEN.gap)); if (i >= n) return { i: n, k: 1 };
    return { i, k: Math.min(1, (t - i * (PEN.line + PEN.gap)) / PEN.line) };
  }
  // write the lines left → right (a moving clip = handwriting); returns the pen tip + each line's box
  function handLines(lines, lt, X, Y0, lineH, px, colors, maxW) {
    const at = penAt(lt, lines.length), boxes = []; let tip = null;
    x.save(); x.textBaseline = 'middle'; x.textAlign = 'left';
    lines.forEach((s, i) => {
      let size = px; x.font = HAND(size); while (x.measureText(s).width > maxW && size > 18) { size -= 2; x.font = HAND(size); }
      const w = x.measureText(s).width, y = Y0 + i * lineH; boxes.push({ x: X, y, w, h: size });
      if (i > at.i) return;
      const k = i < at.i ? 1 : at.k;
      x.save(); x.beginPath(); x.rect(X - 12, y - lineH / 2, (w + 24) * k, lineH); x.clip();
      x.fillStyle = colors[Math.min(i, colors.length - 1)] || colors[0]; if (i === lines.length - 1 && colors.last) x.fillStyle = colors.last;
      x.fillText(s, X, y); x.restore();
      if (i === at.i && k < 1) tip = { x: X + w * k, y: y + Math.sin(lt / 35) * size * .12 };
    });
    x.restore();
    return { tip, at, boxes };
  }
  function penTip(tip, px) {
    if (!tip) return;
    x.save(); x.font = font(800, px); x.textAlign = 'left'; x.textBaseline = 'bottom'; x.fillText('✏️', tip.x - px * .08, tip.y + px * .12); x.restore();
  }
  // after the writing: the formula underlined, the answer circled (+ a "solved" badge)
  function penMarks(lt, n, boxes, ul, ring) {
    const end = PEN.start + n * (PEN.line + PEN.gap);
    if (boxes[0] && lt > PEN.start + PEN.line) {
      const b = boxes[0], k = outCubic(p(lt, PEN.start + PEN.line, PEN.start + PEN.line + 300));
      x.save(); x.strokeStyle = ul; x.globalAlpha = .85; x.lineWidth = Math.max(5, b.h * .14); x.lineCap = 'round';
      x.beginPath(); x.moveTo(b.x, b.y + b.h * .62); x.lineTo(b.x + b.w * k, b.y + b.h * .62); x.stroke(); x.restore();
    }
    const last = boxes[n - 1];
    if (last && lt > end) {
      const k = outCubic(p(lt, end, end + 450));
      x.save(); x.strokeStyle = ring; x.lineWidth = Math.max(5, last.h * .12); x.lineCap = 'round';
      x.beginPath(); x.ellipse(last.x + last.w / 2, last.y, last.w / 2 + 28, last.h * .75, -.05, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); x.stroke(); x.restore();
    }
    return end;
  }
  // 📱 the student's phone in board mode (the app's real look: question card, lined page, pen bar)
  function penPhone(f, lt, d) {
    const P = _penData(d);
    phoneShell(f, () => {
      x.save(); x.fillStyle = '#ffffff'; x.fillRect(18, 168, 564, 1014); x.restore();
      x.save(); x.strokeStyle = '#e3e7ef'; x.lineWidth = 2; for (let y = 420; y < 1040; y += 72) { x.beginPath(); x.moveTo(18, y); x.lineTo(582, y); x.stroke(); } x.restore();
      x.save(); x.fillStyle = '#ffffff'; x.strokeStyle = '#dcdcf0'; x.lineWidth = 3; rr(40, 190, 520, 200, 26); x.fill(); x.stroke(); x.restore();
      text(st.lang === 'en' ? '1 mark' : '1 गुण', 66, 222, 22, '#6b6890', 600, 'left');
      wrapText(P.q, 66, 270, 470, 40, 32, C.ink, 700, 3);
      const n = P.lines.length, lh = Math.min(118, 560 / Math.max(1, n));
      const r = handLines(P.lines, lt, 60, 470, lh, Math.min(46, lh * .5), Object.assign(['#1d4ed8'], { last: '#15803d' }), 480);
      const end = penMarks(lt, n, r.boxes, '#facc15', '#ef4444');
      penTip(r.tip, 72);
      // the pen bar (✏️ picked)
      x.save(); x.fillStyle = '#1d1b2e'; rr(30, 1060, 540, 100, 34); x.fill(); x.restore();
      ['✋', '👆', '✏️', '🖍️', '🎨', '🧽', '🔴'].forEach((ic, i) => {
        const cx = 75 + i * 75;
        if (i === 2) { x.save(); x.fillStyle = '#3b82f6'; rr(cx - 34, 1072, 68, 76, 18); x.fill(); x.restore(); }
        text(ic, cx, 1112, 40, C.ink, 800);
      });
      const b = outBack(p(lt, end + 300, end + 800));
      if (b > 0 && P.done) { x.save(); x.translate(300, 1000); x.scale(b, b); x.fillStyle = C.green; rr(-210, -36, 420, 72, 36); x.fill(); text('✅ ' + P.done, 0, 2, 30, C.white, 800, 'center', 400); x.restore(); }
    }, st.lang === 'en' ? '✍️ Board mode' : '✍️ Board mode — pen ने सोडव', true);
  }
  // 🏫 the class smart board: printed question, the teacher's pen writes, laser points
  function penBoard(W, H, lt, d, caption) {
    const P = _penData(d), tall = st.fmt === '916', sq = st.fmt === '11';
    if (caption && !sq) {
      text(LL(caption), W / 2, tall ? 230 : sq ? 95 : 120, tall ? 60 : 46, C.white, 800, 'center', W - 100);
      if (st.lang === 'both') text(caption[1], W / 2, tall ? 300 : sq ? 145 : 175, tall ? 36 : 30, '#ffd6e7', 700, 'center', W - 100);
    }
    const a = outCubic(p(lt, 0, 600)), bx = 40, bw = W - 80, by = (tall ? 400 : sq ? 140 : 230) + (1 - a) * 80, bh = tall ? 860 : sq ? 740 : 860;
    x.save(); x.globalAlpha = a;
    x.fillStyle = '#c9ccd3'; rr(bx - 14, by - 14, bw + 28, bh + 28, 26); x.fill();
    const g = x.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#16324a'); g.addColorStop(1, '#0d2235');
    x.fillStyle = g; rr(bx, by, bw, bh, 16); x.fill();
    // the board's own tool column (pen picked)
    x.fillStyle = 'rgba(255,255,255,.1)'; rr(bx + 14, by + 20, 86, 380, 20); x.fill();
    ['✏️', '🖍️', '🧽', '🔴', '↩️'].forEach((ic, i) => { if (i === 0) { x.fillStyle = '#3b82f6'; rr(bx + 20, by + 26 + i * 72, 74, 66, 14); x.fill(); } text(ic, bx + 57, by + 59 + i * 72, 38, C.white, 800); });
    x.restore();
    if (a < 1) return;
    const L0 = bx + 130, maxW = bw - 170;
    wrapText(P.q, L0, by + 60, maxW, 50, 42, '#ffffff', 700, 2);
    const n = P.lines.length, lh = Math.min(tall ? 150 : 128, (bh - 190) / Math.max(1, n));
    const r = handLines(P.lines, lt, L0, by + 170 + lh / 2, lh, Math.min(tall ? 70 : 60, lh * .55), Object.assign(['#fde047', '#ffffff'], { last: '#86efac' }), maxW);
    const end = penMarks(lt, n, r.boxes, '#f472b6', '#f472b6');
    penTip(r.tip, tall ? 96 : 84);
    // the laser dot runs over the formula, then rests on the answer
    if (lt > end + 400) {
      const k = outCubic(p(lt, end + 400, end + 1100)), f0 = r.boxes[0], l0 = r.boxes[n - 1];
      const lx = f0.x + (l0.x + l0.w / 2 - f0.x) * k, ly = f0.y + (l0.y - f0.y) * k;
      x.save(); x.fillStyle = 'rgba(239,68,68,.35)'; x.beginPath(); x.arc(lx, ly, 26, 0, 7); x.fill(); x.fillStyle = '#ef4444'; x.beginPath(); x.arc(lx, ly, 12, 0, 7); x.fill(); x.restore();
    }
    if (tall || st.fmt === '45') {
      const b = outBack(p(lt, 300, 900)), y = by + bh + (tall ? 170 : 90);
      if (b > 0) { x.save(); x.translate(W / 2, y); x.scale(b, b); x.fillStyle = 'rgba(255,255,255,.95)'; rr(-440, -62, 880, 124, 62); x.fill();
        text(st.lang === 'en' ? '👩‍🏫 Ready questions + pen, live in class' : '👩‍🏫 तयार प्रश्न + pen, थेट वर्गात', 0, 2, 42, C.ink, 800, 'center', 820); x.restore(); }
    }
  }
  const PEN_CAP = { parent: ['मूल mobile वरच pen ने सोडवतं', 'Your child solves it with a pen, on the phone'], phone: ['Mobile वरच board — pen ने सोडव!', 'Your phone is a board — solve with a pen!'], board: ['वर्गात smart board वर थेट solution', 'Solve it live on the class smart board'] };
  // one line of the script's text, in the chosen language (scripts are written in one language)
  const capOf = s0 => (s0 ? [s0, s0] : null);
  const S = {
    // ── 🎬 script scenes (adScript.js format) ──
    x_hook(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', a = outBack(p(lt, 150, 800)), b = outBack(p(lt, 800, 1500));
      x.save(); x.translate(W / 2, H * .38); x.scale(a, a); wrapText(d.text, 0, -40, W - 140, tall ? 110 : 88, tall ? 96 : 78, C.white, 800, 3, 'center'); x.restore();
      if (d.sub) { x.save(); x.translate(W / 2, H * .38 + (tall ? 300 : 230)); x.scale(b, b); x.fillStyle = C.gold; rr(-460, -66, 920, 132, 60); x.fill(); text(d.sub, 0, 2, tall ? 54 : 46, '#3b1d00', 800, 'center', 860); x.restore(); }
    },
    x_points(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', sq = st.fmt === '11';
      text(d.title, W / 2, tall ? 330 : 140, tall ? 80 : 64, C.white, 800, 'center', W - 100);
      const n = d.items.length, rowH = tall ? 230 : sq ? 170 : 200, y0 = (tall ? 560 : sq ? 300 : 330);
      d.items.forEach((it, i) => {
        const a = outBack(p(lt, 400 + i * 700, 900 + i * 700)); if (a <= 0) return;
        const y = y0 + i * rowH;
        x.save(); x.translate(W / 2, y); x.scale(a, a);
        x.fillStyle = 'rgba(255,255,255,.95)'; rr(-460, -rowH / 2 + 16, 920, rowH - 32, 36); x.fill();
        text('✅', -380, 0, tall ? 64 : 52, C.green, 800);
        text(it, 40, 2, tall ? 54 : 46, C.ink, 800, 'center', 700);
        x.restore();
      });
      if (n === 0) text('—', W / 2, H / 2, 60);
    },
    x_number(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', k = outCubic(p(lt, 200, 1600)), shown = Math.round(d.value * k);
      const a = outBack(p(lt, 0, 500));
      x.save(); x.translate(W / 2, H * (tall ? .42 : .4)); x.scale(a, a);
      x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(0, 0, tall ? 330 : 270, 0, 7); x.fill();
      text(`${d.prefix || ''}${shown.toLocaleString('en-IN')}${d.suffix || ''}`, 0, 0, tall ? 220 : 180, C.gold, 800, 'center', W - 160);
      x.restore();
      const b = outBack(p(lt, 1500, 2100)); if (b > 0) { x.save(); x.translate(W / 2, H * (tall ? .42 : .4) + (tall ? 420 : 330)); x.scale(b, b); wrapText(d.label, 0, 0, W - 160, tall ? 70 : 60, tall ? 60 : 50, C.white, 800, 2, 'center'); x.restore(); }
    },
    x_question(W, H, lt, v, f, after, d) {
      const m = d.use === 'class' ? f.mcq : { q: d.q, options: d.options, answer: d.answer, why: d.why || '', subject: '' };
      if (!m) { text(st.lang === 'en' ? 'No question for this class' : 'या class चा प्रश्न नाही', W / 2, H / 2, 56); return; }
      placePhone(W, H, lt, true, () => mcqScreen({ ...f, mcq: m }, lt, {}), lt < 5200 ? MCQ_CAP.q : MCQ_CAP.tip);
    },
    x_steps(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', n = d.items.length, gap = tall ? 300 : 210, y0 = H / 2 - (n - 1) * gap / 2;
      d.items.forEach((it, i) => {
        const a = outBack(p(lt, 300 + i * 800, 800 + i * 800)); if (a <= 0) return;
        const y = y0 + i * gap;
        x.save(); x.translate(W / 2, y); x.scale(a, a);
        x.fillStyle = C.gold; x.beginPath(); x.arc(-360, 0, tall ? 70 : 58, 0, 7); x.fill();
        text(String(i + 1), -360, 4, tall ? 80 : 64, '#3b1d00', 800);
        x.fillStyle = 'rgba(255,255,255,.95)'; rr(-260, -60, 680, 120, 40); x.fill();
        text(it, 80, 2, tall ? 54 : 46, C.ink, 800, 'center', 640);
        x.restore();
        if (i < n - 1 && lt > 700 + i * 800) { x.save(); x.strokeStyle = C.gold; x.lineWidth = 8; x.beginPath(); x.moveTo(W / 2 - 360, y + 80); x.lineTo(W / 2 - 360, y + gap - 80); x.stroke(); x.restore(); }
      });
    },
    x_compare(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916';
      if (d.title) text(d.title, W / 2, tall ? 300 : 120, tall ? 72 : 58, C.white, 800, 'center', W - 100);
      const a = outBack(p(lt, 200, 800)), b = outBack(p(lt, 1500, 2100));
      const cardW = W - 140, cardH = tall ? 420 : 300, y1 = tall ? 620 : H * .38, y2 = tall ? 1160 : H * .72;
      x.save(); x.translate(W / 2, y1); x.scale(a, a); x.fillStyle = 'rgba(255,255,255,.9)'; rr(-cardW / 2, -cardH / 2, cardW, cardH, 40); x.fill();
      text('❌', -cardW / 2 + 80, -cardH / 2 + 80, 64, C.red, 800); wrapText(d.before, 0, -30, cardW - 160, 64, 54, '#7f1d1d', 800, 3, 'center'); x.restore();
      if (b > 0) { x.save(); x.translate(W / 2, y2); x.scale(b, b); x.fillStyle = '#dcfce7'; rr(-cardW / 2, -cardH / 2, cardW, cardH, 40); x.fill();
        text('✅', -cardW / 2 + 80, -cardH / 2 + 80, 64, C.green, 800); wrapText(d.after, 0, -30, cardW - 160, 64, 54, '#14532d', 800, 3, 'center'); x.restore(); }
    },
    x_quote(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', a = outBack(p(lt, 150, 800));
      x.save(); x.translate(W / 2, H / 2); x.scale(a, a);
      text('❝', -W / 2 + 140, -260, 200, C.gold, 800);
      wrapText(d.text, 0, -80, W - 200, tall ? 90 : 76, tall ? 72 : 60, C.white, 800, 4, 'center');
      x.restore();
    },
    x_app(W, H, lt, v, f, after, d) {
      const cap = capOf(d.caption);
      const draw = { notes: () => notesScreen(f, lt, false), offline: () => notesScreen(f, lt, true), exercise: () => exScreen(f, lt),
        test: () => (f.mcq ? mcqScreen(f, lt, { tapAt: 1600, tipAt: 2400 }) : questionScreen(f, lt, { tapAt: 1600, tipAt: 2400 })),
        rank: () => resultScreen(f, lt), smartboard: () => boardScreen(f, lt) }[d.screen];
      if (d.screen === 'subjects') { S.subjects(W, H, lt, v, f); return; }
      placePhone(W, H, lt, true, draw || (() => boardScreen(f, lt)), cap);
    },
    x_screenshot(W, H, lt, v, f, after, d) {
      placePhone(W, H, lt, true, () => shotScreen(f, lt, _shotImg(v, d)), capOf(d.caption));
    },
    x_cta(W, H, lt, v, f, after, d) {
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), c = outBack(p(lt, 900, 1500)), cy = tall ? H * .3 : H * .24 + 40;
      if (logoOk()) { x.save(); x.translate(W / 2, cy); x.scale(a, a); logo(0, 0, tall ? 300 : 220); x.restore(); }
      wrapText(d.text, W / 2, cy + (tall ? 280 : 210), W - 140, tall ? 92 : 76, tall ? 80 : 64, C.white, 800, 2, 'center');
      if (c > 0) { x.save(); x.translate(W / 2, cy + (tall ? 560 : 420)); x.scale(c, c); x.fillStyle = C.gold; rr(-420, -76, 840, 152, 76); x.fill();
        text(d.button || (isTeacher(v.aud) ? '▶ नोंदणी करा' : '▶ आधी Free Test द्या'), 0, 4, tall ? 62 : 52, '#3b1d00', 800, 'center', 780); x.restore(); }
      if (c > .5) text(SITE.replace(/^https:\/\//, ''), W / 2, cy + (tall ? 720 : 560), 40, C.white, 700);
    },
    x_pen(W, H, lt, v, f, after, d) {
      const board = d.board ? d.board === 'class' : isTeacher(v.aud);
      if (board) penBoard(W, H, lt, d, capOf(d.caption) || PEN_CAP.board);
      else placePhone(W, H, lt, true, () => penPhone(f, lt, d), capOf(d.caption) || (v.aud === 'parent' ? PEN_CAP.parent : PEN_CAP.phone));
    },
    // ✍️ built-in: a² − b² written fast by the pen
    penphone(W, H, lt, v, f) { placePhone(W, H, lt, true, () => penPhone(f, lt, null), v.aud === 'parent' ? PEN_CAP.parent : PEN_CAP.phone); },
    penboard(W, H, lt) { penBoard(W, H, lt, null, PEN_CAP.board); },
    hook(W, H, lt, v) {
      const tall = st.fmt === '916', a = outBack(p(lt, 200, 900)), b = outBack(p(lt, 900, 1600));
      x.save(); x.translate(W / 2, H * .36); x.scale(a, a); both(v.hook, 0, 0, tall ? 92 : 76, tall ? 90 : 72); x.restore();
      if (v.hook2) {
        x.save(); x.translate(W / 2, H * .36 + (tall ? 260 : 200)); x.scale(b, b); x.fillStyle = C.gold; rr(-470, -70, 940, 140, 60); x.fill(); text(LL(v.hook2), 0, 2, tall ? 50 : 44, '#3b1d00', 800, 'center', 880); x.restore();
        if (L2(v.hook2)) text(v.hook2[1], W / 2, H * .36 + (tall ? 370 : 300), 38, C.white, 700, 'center', W - 120);
      }
    },
    challenge(W, H, lt, v, f) { placePhone(W, H, lt, true, () => questionScreen(f, lt, { tapAt: 3600, tipAt: 99999, timer: 4400 }), v.hook); },
    trio(W, H, lt, v, f) {
      const i = Math.min(2, Math.floor(lt / 3500)), local = lt - i * 3500, m = f.trio[i];
      const cap = [`प्रश्न ${i + 1}/3 · ${m.subject || ''}`, `Question ${i + 1}/3 · ${m.subject || ''}`];
      placePhone(W, H, local, true, () => mcqScreen({ ...f, mcq: m }, local, { tapAt: 1700, tipAt: 2400 }), cap);
    },
    question(W, H, lt, v, f, after) { const cap = f.mcq ? MCQ_CAP : T; placePhone(W, H, lt, !after, () => questionScreen(f, lt, after ? { tapAt: -1, tipAt: 200 } : {}), lt < 5200 && !after ? cap.q : cap.tip); },
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
      // a sample screen (v.demo): example name + score, stamped नमुना / SAMPLE — never shown as a real result
      if (v.demo) f = { ...f, topName: 'Rahul P.', topScore: '92/100', players: 0 };
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), cy = H * (tall ? .42 : .45);
      both(v.demo ? ['📱 App मध्ये असा दिसतो क्रमांक', '📱 How the rank looks in the app'] : ['🏆 या रविवारचा महा-Test', "🏆 This Sunday's Maha-Test"], W / 2, tall ? 260 : 110, tall ? 64 : 54, tall ? 70 : 56, C.white, W - 100);
      x.save(); x.translate(W / 2, cy); x.scale(a, a);
      x.fillStyle = C.white; rr(-420, -330, 840, 660, 60); x.fill();
      x.fillStyle = C.gold; x.beginPath(); x.arc(0, -170, 110, 0, 7); x.fill();
      text(f.topName ? f.topName.split(/\s+/).map(w => w[0]).join('').slice(0, 2) : '🏆', 0, -168, 90, '#3b1d00', 800);
      text(`${f.topName || 'Topper'} · ${f.label}`, 0, 10, 56, C.ink, 800, 'center', 760);
      text(f.topScore, 0, 110, 96, C.violet, 800);
      text(f.players ? (st.lang === 'en' ? `Rank #1 of ${f.players}` : `${f.players} मुलांमध्ये #1`) : (st.lang === 'en' ? 'Rank #1' : 'क्रमांक #1'), 0, 215, 44, '#8a83b3', 700, 'center', 760);
      if (v.demo) {
        x.save(); x.translate(300, -270); x.rotate(.2);
        x.fillStyle = C.red; rr(-150, -42, 300, 84, 18); x.fill();
        text(st.lang === 'en' ? 'SAMPLE' : st.lang === 'both' ? 'नमुना · SAMPLE' : 'नमुना', 0, 2, 38, C.white, 800, 'center', 280);
        x.restore();
      }
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
      text(f.nmms ? (f.mcq ? 'NMMS · MAT + SAT' : 'NMMS · MAT') : f.label, 0, -ph2 / 2 + 70, 52, C.ink, 800, 'center', pw - 60);
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
      const tall = st.fmt === '916', a = outBack(p(lt, 100, 700)), c = outBack(p(lt, 900, 1500)), cy = tall ? H * .3 : H * .24 + 40;
      const lg = outBack(p(lt, 0, 500));
      x.save(); x.translate(W / 2, cy - (tall ? 290 : 190)); x.scale(lg, lg); logo(0, 0, tall ? 240 : 150); x.restore();
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
      const tall = st.fmt === '916', sq = st.fmt === '11', a = outBack(p(lt, 100, 700)), b = outBack(p(lt, 800, 1400)), c = outBack(p(lt, 1500, 2100)), cy = tall ? H * .27 : H * .2 + (sq ? 30 : 40);
      const lg = outBack(p(lt, 0, 500));
      x.save(); x.translate(W / 2, cy - (tall ? 270 : sq ? 135 : 160)); x.scale(lg, lg); logo(0, 0, tall ? 230 : sq ? 110 : 140); x.restore();
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
  const _sk = sc => (typeof sc === 'string' ? sc : sc.k), _sd = sc => (typeof sc === 'string' ? DUR[sc] : sc.d);
  const timeline = v => { let at = 0; return v.scenes.map(sc => { const s = { k: _sk(sc), at, d: _sd(sc), data: typeof sc === 'string' ? null : sc.data }; at += s.d; return s; }); };
  const lengthOf = v => v.scenes.reduce((n, sc) => n + _sd(sc), 0);

  let _sq = null, _wide = false;   // _wide: drawing the square half of a 16:9 ad
  function drawAt(t) {
    if (!cv) return;
    cv.classList.toggle('wide', st.fmt === '169');
    if (st.fmt === '169') return _drawWide(t);
    const [W, H] = FMT[st.fmt];
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    _drawAd(W, H, t);
  }
  function _drawWide(t) {
    if (cv.width !== 1920 || cv.height !== 1080) { cv.width = 1920; cv.height = 1080; }
    if (!_sq) { _sq = document.createElement('canvas'); _sq.width = 1080; _sq.height = 1080; }
    const main = x;
    const f0 = _facts(), cur0 = timeline(_variants(f0)[st.v] || { scenes: [] }).find(s0 => t >= s0.at && t < s0.at + s0.d);
    bg(1920, 1080, t, st.v === 'loss' && cur0?.k === 'hook', _variants(f0)[st.v]?.style?.theme);   // one background under both halves
    x = _sq.getContext('2d'); st.fmt = '11'; _wide = true;
    try { x.clearRect(0, 0, 1080, 1080); _drawAd(1080, 1080, t); } finally { st.fmt = '169'; x = main; _wide = false; }
    x.drawImage(_sq, 840, 0);
    x.save(); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, 840, 1080); x.restore();
    const f = _facts(), a = _variants(f)[st.v], p0 = adParts(st.v);
    if (logoOk()) logo(420, 190, 150); else text('🚀', 420, 190, 120, C.white, 800);
    text('NKs EduOrbit', 420, 320, 64, C.white, 800, 'center', 760);
    if (!isTeacher(a.aud)) text(f.label, 420, 400, 44, '#ffd6e7', 700, 'center', 760);
    wrapText(p0.headline, 420, 520, 740, 70, 58, C.white, 800, 3, 'center');
    x.save(); x.fillStyle = C.gold; rr(130, 760, 580, 110, 55); x.fill(); x.restore();
    text(isTeacher(a.aud) ? '▶ नोंदणी Free' : '▶ आधी Free Test', 420, 816, 46, '#3b1d00', 800, 'center', 540);
    text(SITE.replace(/^https:\/\//, ''), 420, 940, 38, C.white, 700, 'center', 760);
  }
  function _drawAd(W, H, t) {
    const f = _facts(), v = _variants(f)[st.v];
    if (!v) return;   // the shown video is being swapped (see _loop)
    const tl = timeline(v), cur = tl.find(s => t >= s.at && t < s.at + s.d) || tl[tl.length - 1];
    if (!_wide) bg(W, H, t, st.v === 'loss' && cur.k === 'hook', v.style?.theme);
    const prev = tl[tl.indexOf(cur) - 1];
    S[cur.k](W, H, t - cur.at, v, f, cur.k === 'question' && prev?.k === 'challenge', cur.data);
    const last = cur.k === 'offer' || cur.k === 'toffer' || cur.k === 'x_cta';
    if (!last && logoOk() && !_wide) {
      // small logo + name, top-left, from the first second (brand recall without stealing the hook)
      const sz = st.fmt === '916' ? 84 : 64, m = st.fmt === '916' ? 36 : 22;
      x.save(); x.globalAlpha = .95; x.fillStyle = 'rgba(0,0,0,.28)'; rr(m, m, sz + 250, sz + 16, (sz + 16) / 2); x.fill(); x.restore();
      logo(m + 8 + sz / 2, m + 8 + sz / 2, sz);
      text('NKs EduOrbit', m + sz + 24, m + 8 + sz / 2 + 2, sz * .42, C.white, 800, 'left', 230);
    }
    const fy = H - (st.fmt === '916' ? 80 : 45);
    // the last card ends with the call to action: tap the ad's button (Meta "Learn more" / "Sign up", YouTube's button)
    if (last && t - cur.at > 1400) {
      const k = outBack(p(t - cur.at, 1400, 1800)), bob = Math.sin((t - cur.at) / 140) * 8, tall = st.fmt === '916', y = H - (tall ? 110 : 52);
      x.save(); x.translate(W / 2, y + bob); x.scale(k, k);
      x.fillStyle = C.white; rr(-400, -40, 800, 80, 40); x.fill();
      text(LL(isTeacher(v.aud) ? ['👇 खालच्या बटणावर टॅप करा — नोंदणी करा', '👇 Tap the button below to register'] : ['👇 खालच्या बटणावर टॅप करा — Free Test', '👇 Tap the button below — free test']), 0, 2, 38, C.violet, 800, 'center', 760);
      x.restore();
      return;
    }
    if (logoOk()) { logo(W / 2 - 170, fy, 58); text('NKs EduOrbit', W / 2 + 34, fy, 44, C.white, 800); }
    else text('🚀 NKs EduOrbit', W / 2, fy, 44, C.white, 800);
  }

  // ── ad id + link + text ──
  const _slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'class';
  const _audOf = v => _variants(_facts())[v]?.aud || 'parent';
  // teacher ads are not tied to a class: t-<variant>
  // YouTube ads: the same id with yt- in front (its own row on the leaderboard)
  const _vkey = v => (String(v).startsWith('s:') ? `v${AUD_LETTER[_audOf(v)] || 'p'}-${String(v).slice(2)}` : v);
  const adId = (v = st.v) => (st.plat === 'yt' ? 'yt-' : '') + (isTeacher(_audOf(v)) ? `t-${_vkey(v)}` : `${_slug(st.batch)}-${_vkey(v)}`);
  const _src = () => (st.plat === 'yt' ? 'yt' : 'meta');
  const adLink = (v = st.v) => isTeacher(_audOf(v))
    ? `${SITE}/student-app/?treg=${_audOf(v)}&src=${_src()}&ad=${encodeURIComponent(adId(v))}`
    : `${SITE}/student-app/?free=1&batch=${encodeURIComponent(st.batch)}${_variants(_facts())[v]?.kind === 'reg' ? '&k=r' : ''}&src=${_src()}&ad=${encodeURIComponent(adId(v))}`;
  // the ad's parts (also what goes to Meta)
  function adParts(v = st.v) {
    const f = _facts(), a = _variants(f)[v];
    return {
      // a 🎬 script is written in one language: its text once
      message: st.lang === 'mr' || a.copy[0] === a.copy[1] ? a.copy[0] : st.lang === 'en' ? a.copy[1] : `${a.copy[0]}\n\n${a.copy[1]}`,
      headline: st.lang === 'en' ? a.headline[1] : a.headline[0],
      cta: isTeacher(a.aud) ? 'SIGN_UP' : 'LEARN_MORE',
      link: adLink(v), aud: a.aud,
    };
  }
  function adText(v = st.v) {
    const p0 = adParts(v);
    if (st.plat === 'yt') return ytKit(v);
    return `Primary text:\n${p0.message}\n\nHeadline: ${p0.headline}\nButton: ${p0.cta === 'SIGN_UP' ? 'Sign up' : 'Learn more'}\nLink: ${p0.link}`;
  }
  // what to type in YouTube Studio + Google Ads (limits: headline 15, long headline 90, description 70, button 10)
  function ytKit(v = st.v) {
    const p0 = adParts(v), id = adId(v), teach = isTeacher(p0.aud);
    const cut = (t, n) => { const a = [...String(t).replace(/\s+/g, ' ').trim()]; return a.length <= n ? a.join('') : a.slice(0, n - 1).join('') + '…'; };
    const first = String(p0.message).split('\n')[0];
    return [
      '▶️ YouTube Studio (upload):',
      `  File: ${id}-16x9.mp4  (Shorts साठी: ${id}-9x16.mp4)`,
      `  Title: ${cut(p0.headline + ' | NKs EduOrbit', 100)}`,
      '  Visibility: Unlisted',
      '',
      '📣 Google Ads (Video campaign):',
      `  Ad name: ${id}`,
      `  Final URL: ${p0.link}`,
      `  Call to action: ${teach ? 'Sign up' : 'Free Test'}`,
      `  Headline (15): ${cut(teach ? 'नोंदणी Free' : 'Free Test द्या', 15)}`,
      `  Long headline (90): ${cut(p0.headline, 90)}`,
      `  Description (70): ${cut(first, 70)}`,
    ].join('\n');
  }
  // the Meta ad set an ad goes into: one per class + kind + audience (teachers: one per audience)
  const adsetName = (v = st.v) => { const a = _audOf(v); return isTeacher(a) ? `t-${a}` : `${_slug(st.batch)}-${st.kind === 'reg' ? 'r' : 'c'}-${a}`; };

  // ── "📤 Meta वर पाठवा": record the 9:16 video here, send it + a thumbnail through our server to
  // Meta, which makes the ad PAUSED (the admin checks it in Ads Manager and turns it on) ──
  let _metaOk = false;
  const _sent = {};   // ad id → { video_id, image_hash } (a retry does not upload again)
  async function _thumb(v) {
    const keep = { v: st.v, fmt: st.fmt, paused: st.paused, pausedAt: st.pausedAt };
    Object.assign(st, { v, fmt: '916', paused: true, pausedAt: 1600 });
    drawAt(1600);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
    Object.assign(st, keep);
    return blob;
  }
  async function sendToMeta(v = st.v) {
    const btn = $('ads-meta-send'), msg = $('ads-meta-msg'), id = adId(v), parts = adParts(v);
    const budget = Math.max(100, Number($('ads-meta-budget')?.value) || 0);
    const ageMin = parseInt($('ads-meta-age-min')?.value, 10), ageMax = parseInt($('ads-meta-age-max')?.value, 10);
    if (!(ageMin >= 13 && ageMax <= 65 && ageMin <= ageMax)) { $('ads-meta-msg').textContent = '⚠️ वय 13 ते 65 मध्ये, आणि पहिलं वय दुसऱ्यापेक्षा लहान हवं'; return null; }
    btn.disabled = true;
    try {
      let up = _sent[id];
      if (!up) {
        msg.textContent = '⏳ 9:16 video बनत आहे (≈20 सेकंद, हे tab उघडं ठेवा)…';
        const r = await record(v, '916');
        if (r.ext !== 'mp4') throw new Error('हा browser MP4 बनवत नाही — Chrome / Edge वापरा');
        const thumb = await _thumb(v);
        msg.textContent = '⏳ Video Meta वर जात आहे…';
        const vid = await API.metaUpload('video', r.blob, id);
        const img = await API.metaUpload('image', thumb, id);
        up = _sent[id] = { video_id: vid.video_id, image_hash: img.image_hash };
      }
      msg.textContent = '⏳ Meta मध्ये ad बनत आहे (video तयार व्हायला 1–2 मिनिटं लागू शकतात)…';
      const out = await API.metaCreateAd({ name: id, adset: adsetName(v), audience: parts.aud, daily_budget: budget, age_min: ageMin, age_max: ageMax, ...up, message: parts.message, headline: parts.headline, cta: parts.cta, link: parts.link });
      if (out.exists) msg.innerHTML = `ℹ️ <b>${_esc(id)}</b> ही ad Meta मध्ये आधीच आहे — दुसरी बनवली नाही.`;
      else if (out.pending) msg.textContent = (out.note ? out.note + ' · ' : '') + '⏳ Meta अजून video तयार करत आहे. 2 मिनिटांनी पुन्हा "Meta वर पाठवा" दाबा (video पुन्हा जाणार नाही).';
      else {
        msg.innerHTML = (out.note ? `⚠️ ${_esc(out.note)}<br>` : '') + `✅ <b>${_esc(id)}</b> Meta मध्ये बनली${out.mode === 'lead' ? ' ("Free test" वर चालणाऱ्या ad set मध्ये)' : ''} — <b>बंद (Paused)</b> आहे. <a href="${_esc(out.manager)}" target="_blank" rel="noopener">Ads Manager मध्ये पाहा</a> किंवा इथूनच
          <button type="button" class="ads-act good" id="ads-meta-on">▶ आत्ता चालू करा</button>`;
        const on = $('ads-meta-on');
        on.addEventListener('click', async () => {
          if (!on.dataset.sure) { on.dataset.sure = '1'; on.textContent = 'पक्कं? पुन्हा दाबा (आजपासून खर्च सुरू)'; return; }
          on.disabled = true;
          try { await API.metaAction({ action: 'resume', ad_id: out.ad_id }); msg.innerHTML = `✅ <b>${_esc(id)}</b> चालू झाली. Meta ती तपासून (साधारण काही तासांत) दाखवायला सुरू करेल.`; _loadBoard(true); }
          catch (err) { on.disabled = false; delete on.dataset.sure; on.textContent = '▶ आत्ता चालू करा'; APP.toast(err?.message || 'चालू झाली नाही', 'error'); }
        });
      }
      return out;
    } catch (err) {
      msg.textContent = `⚠️ ${err?.message || 'Meta वर पाठवता आलं नाही'}`;
      return null;
    } finally { btn.disabled = false; }
  }
  // all ads ticked under "Video download" (this audience), one after another; then one "turn all on"
  async function sendAllToMeta() {
    const all = $('ads-meta-send-all'), box = $('ads-meta-bulk');
    const vars = _recPicked();
    if (!vars.length) { box.textContent = 'खाली "Video download" मध्ये किमान एका ad ला खूण करा'; return; }
    all.disabled = true;
    const done = [];
    for (let i = 0; i < vars.length; i++) {
      box.innerHTML = `⏳ ${i + 1} / ${vars.length}: <b>${_esc(adId(vars[i]))}</b>… (हे tab उघडं ठेवा)`;
      const out = await sendToMeta(vars[i]);
      done.push({ id: adId(vars[i]), out });
    }
    all.disabled = false;
    const made = done.filter(d => d.out && (d.out.created || d.out.exists) && d.out.ad_id);
    box.innerHTML = done.map(d => `${d.out?.created ? '✅' : d.out?.exists ? 'ℹ️' : d.out?.pending ? '⏳' : '⚠️'} ${_esc(d.id)}`).join(' · ')
      + (made.length ? ` <button type="button" class="ads-act good" id="ads-meta-on-all">▶ या ${made.length} ads एकदम चालू करा</button>` : '');
    const on = $('ads-meta-on-all');
    on?.addEventListener('click', async () => {
      if (!on.dataset.sure) { on.dataset.sure = '1'; on.textContent = 'पक्कं? पुन्हा दाबा (आजपासून खर्च सुरू)'; return; }
      on.disabled = true;
      let ok = 0;
      for (const d of made) { try { await API.metaAction({ action: 'resume', ad_id: d.out.ad_id }); ok++; } catch (err) { APP.toast(`${d.id}: ${err?.message || 'चालू झाली नाही'}`, 'error'); } }
      box.innerHTML += `<br>✅ ${ok} ads चालू झाल्या. Meta त्या तपासून (साधारण काही तासांत) दाखवायला सुरू करेल.`;
      on.remove();
      _loadBoard(true);
    });
  }
  function _paintMetaBox() {
    const box = $('ads-metabox'); if (!box) return;
    box.hidden = !_metaOk || st.plat !== 'meta';
    if ($('ads-ytbox')) { $('ads-ytbox').hidden = st.plat !== 'yt'; $('ads-yt-name').textContent = `Ad: ${adId()}`; }
    const total = Math.max(0, Number($('ads-budget')?.value) || 0);
    const inp = $('ads-meta-budget');
    if (inp && !inp.dataset.touched) inp.value = Math.max(100, Math.round(total ? total * _share(st.aud) / 100 : 150));
    const n = $('ads-meta-name'); if (n) n.textContent = `Ad: ${adId()} · Ad set: ${adsetName()}`;
    // ages: the audience's, until the admin changes them (per audience)
    const [lo, hi] = _ages(st.aud), a1 = $('ads-meta-age-min'), a2 = $('ads-meta-age-max');
    if (a1 && a1.dataset.aud !== st.aud) { a1.value = lo; a2.value = hi; a1.dataset.aud = st.aud; }
  }

  // ── sound: music + effects made in this browser (Web Audio), following the animation ──
  // Each scene has its own loudness (calm while the question is read, full on the hook / result /
  // offer) and its own effects (whoosh on every cut, ✅ ding on the right answer, ticks while the
  // timer / day counter runs, pop + sparkle on the rank, ta-da on the offer). Nothing is downloaded:
  // no copyright music. The admin's own voice (🎤) can go on top; the music then stays low.
  // the energetic track runs from the first frame to the last; scenes only move it a little
  const LEVEL = { x_hook: .95, x_points: .85, x_number: .9, x_question: .72, x_steps: .85, x_compare: .85, x_quote: .75, x_app: .8, x_screenshot: .8, x_cta: 1, x_pen: .7, penphone: .7, penboard: .7,
    hook: .95, challenge: .75, question: .72, trio: .8, result: 1, features: .85, offer: 1, topper: .95, days: .8, free: .85, paper: .85,
    notes: .75, exdemo: .72, subjects: .8, offline: .78, tools: .85, earn: .9, toffer: 1 };
  const _voice = {};   // ad id → { buf: ArrayBuffer, name, secs }
  // the admin's mix: 1 = as made; 0 … 1.5 (kept on this device)
  const MIX_KEY = 'ad_mix', _mix = { bed: 1, anim: 1, voice: 1 };
  st.sound = true;
  // what happens when (ms from the start) — also used by the test
  function audioPlan(v = st.v) {
    const a = _variants(_facts())[v], tl = timeline(a), ev = [];
    tl.forEach((s, i) => {
      const prev = tl[i - 1]?.k;
      ev.push({ at: s.at, k: 'level', level: LEVEL[s.k] ?? .6, ramp: i ? 350 : 10 });
      if (i) ev.push({ at: s.at, k: 'whoosh' });
      ev.push({ at: s.at + 60, k: 'stab', n: i });   // animation layer: a chord hit on every new card
      if (s.k === 'hook' && v === 'loss') ev.push({ at: s.at + 150, k: 'boom' });
      if (s.k === 'hook' || s.k === 'topper') ev.push({ at: s.at + 200, k: 'pop' });
      if (s.k === 'challenge') { for (let t = 0; t < 3600; t += 1000) ev.push({ at: s.at + t, k: 'tick' }); ev.push({ at: s.at + 3600, k: 'ding' }); }
      const d = s.data || {};
      if (s.k === 'x_hook') { ev.push({ at: s.at + 150, k: 'boom' }); ev.push({ at: s.at + 800, k: 'pop' }); }
      if (s.k === 'x_points') (d.items || []).forEach((_, j) => ev.push({ at: s.at + 400 + j * 700, k: 'blip', n: j }));
      if (s.k === 'x_number') { for (let t = 200; t < 1600; t += 100) ev.push({ at: s.at + t, k: 'tick', soft: true }); ev.push({ at: s.at + 1600, k: 'ding' }); }
      if (s.k === 'x_question') { ev.push({ at: s.at + 4000, k: 'ding' }); ev.push({ at: s.at + 5200, k: 'chime' }); }
      if (s.k === 'x_steps') (d.items || []).forEach((_, j) => ev.push({ at: s.at + 300 + j * 800, k: 'pop' }));
      if (s.k === 'x_compare') { ev.push({ at: s.at + 200, k: 'pop' }); ev.push({ at: s.at + 1500, k: 'whoosh' }); ev.push({ at: s.at + 1600, k: 'ding' }); }
      if (s.k === 'x_quote') ev.push({ at: s.at + 300, k: 'chime' });
      if (s.k === 'x_app' || s.k === 'x_screenshot') ev.push({ at: s.at + 200, k: 'pop' });
      if (s.k === 'x_cta') { ev.push({ at: s.at + 100, k: 'tada' }); ev.push({ at: s.at + 900, k: 'sparkle' }); }
      // ✍️ the pen: a scratch while each line is written, a ding when the answer is circled
      if (s.k === 'x_pen' || s.k === 'penphone' || s.k === 'penboard') {
        const n = (d.lines || PEN_DEMO.lines).length;
        for (let j = 0; j < n; j++) ev.push({ at: s.at + PEN.start + j * (PEN.line + PEN.gap), k: 'scribble', d: PEN.line });
        ev.push({ at: s.at + PEN.start + n * (PEN.line + PEN.gap), k: 'ding' });
      }
      if (s.k === 'trio') for (let k = 0; k < 3; k++) {
        if (k) ev.push({ at: s.at + k * 3500, k: 'whoosh' });
        ev.push({ at: s.at + k * 3500 + 60, k: 'stab', n: k + 1 });
        ev.push({ at: s.at + k * 3500 + 1700, k: 'ding' });
        ev.push({ at: s.at + k * 3500 + 2400, k: 'chime' });
      }
      if (s.k === 'question') {
        if (prev === 'challenge') ev.push({ at: s.at + 200, k: 'chime' });
        else { ev.push({ at: s.at + 4000, k: 'ding' }); ev.push({ at: s.at + 5200, k: 'chime' }); ev.push({ at: s.at + 4000, k: 'level', level: .9, ramp: 300 }); }
      }
      if (s.k === 'days') for (let t = 300; t < 1600; t += 100) ev.push({ at: s.at + t, k: 'tick', soft: true });
      if (s.k === 'result') { ev.push({ at: s.at + 300, k: 'riser', d: 1300 }); ev.push({ at: s.at + 1600, k: 'pop' }); ev.push({ at: s.at + 1650, k: 'sparkle' }); }
      if (s.k === 'exdemo') ev.push({ at: s.at + 1300, k: 'ding' });
      if (s.k === 'features') for (let j = 0; j < 5; j++) ev.push({ at: s.at + 300 + j * 380, k: 'blip', n: j });
      if (s.k === 'offer' || s.k === 'toffer') { ev.push({ at: s.at + 100, k: 'tada' }); ev.push({ at: s.at + 900, k: 'sparkle' }); }
    });
    return { len: lengthOf(a), events: ev.sort((p0, q) => p0.at - q.at) };
  }
  // schedule everything on `ctx` into `out`, starting at ctx time `t0` (seconds)
  function _score(ctx, out, v, t0) {
    const { len, events } = audioPlan(v), end = t0 + len / 1000;
    const voice = _voice[adId(v)];
    const master = ctx.createGain(); master.gain.value = .9; master.connect(out);
    // two layers of music:
    //  • bed  — the energetic background track (drums, bass, chords): the same low level from the
    //           first frame to the last, never follows the cards;
    //  • anim — the animation layer (bright arpeggio, claps, a chord stab on every card): its
    //           loudness follows the scenes. Both stay lower under the admin's own voice.
    const duck = voice ? .4 : 1;
    const bed = ctx.createGain();
    const light = _variants(_facts())[v]?.style?.music === 'light', bedLv = (light ? .17 : .3) * duck * _mix.bed;
    bed.gain.setValueAtTime(0, t0); bed.gain.linearRampToValueAtTime(bedLv, t0 + .08);
    bed.gain.setValueAtTime(bedLv, end - .8); bed.gain.linearRampToValueAtTime(0, end);
    bed.connect(master);
    const music = ctx.createGain();   // = the animation layer
    const an = .45 * duck * _mix.anim;
    music.gain.setValueAtTime(an, t0); music.connect(master);
    // (gain.value is not the scheduled level — keep our own, or each new card jumped to full volume)
    let lvNow = an;
    for (const e of events.filter(x => x.k === 'level')) {
      const at = t0 + e.at / 1000;
      music.gain.setValueAtTime(lvNow, at);
      lvNow = e.level * an;
      music.gain.linearRampToValueAtTime(lvNow, at + e.ramp / 1000);
    }
    music.gain.setValueAtTime(lvNow, end - .8); music.gain.linearRampToValueAtTime(0, end);
    const fx = ctx.createGain(); fx.gain.value = (voice ? .6 : .9) * _mix.anim; fx.connect(master);
    const osc = (type, f, at, d, gain, dest = fx, glideTo) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, at); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + d);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + .01); g.gain.exponentialRampToValueAtTime(.0005, at + d);
      o.connect(g); g.connect(dest); o.start(at); o.stop(at + d + .05);
    };
    let _nb = null;
    const noise = () => { if (_nb) return _nb; _nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = _nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return _nb; };
    const hiss = (at, d, gain, from, to, type = 'bandpass', dest = fx) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise(); s.loop = true; f.type = type; f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + d); f.Q.value = 1.2;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + d * .4); g.gain.linearRampToValueAtTime(0, at + d);
      s.connect(f); f.connect(g); g.connect(dest); s.start(at); s.stop(at + d + .05);
    };
    // the music: 112 bpm, C – G – Am – F; kick + off-beat hats, bass, soft chords
    const beat = 60 / 112, bars = Math.ceil(len / 1000 / (beat * 4)) + 1;
    const CH = [[261.6, 329.6, 392], [196, 246.9, 293.7], [220, 261.6, 329.6], [174.6, 220, 261.6]], BASS = [65.4, 49, 55, 43.7];
    const pad = ctx.createBiquadFilter(); pad.type = 'lowpass'; pad.frequency.value = 1400; pad.connect(bed);
    const arp = ctx.createBiquadFilter(); arp.type = 'lowpass'; arp.frequency.value = 3200; arp.connect(music);
    for (let b = 0; b < bars; b++) {
      const bt = t0 + b * beat * 4, ch = CH[b % 4];
      if (bt >= end) break;
      ch.forEach(f => osc('triangle', f, bt, beat * 4, .05, pad));       // bed: chords
      for (let q = 0; q < 4; q++) {
        const at = bt + q * beat; if (at >= end) break;
        osc('sine', 120, at, .22, .55, bed, 45);                          // bed: kick
        osc('triangle', BASS[b % 4] * (q % 2 ? 2 : 1), at, beat * .9, .18, bed);   // bed: bass
        hiss(at + beat / 2, .06, .09, 7000, 9000, 'highpass', bed);      // bed: hat
        if (q % 2 && !light) hiss(at, .12, .22, 1500, 1200, 'bandpass', music);     // anim: clap on 2 and 4
        for (let x16 = 0; x16 < 4; x16++) {                              // the bright 16th-note arpeggio
          const t16 = at + x16 * beat / 4; if (t16 >= end) break;
          osc('square', ch[(q * 4 + x16) % 3] * 2, t16, beat / 5, light ? .014 : .028, arp);
        }
      }
    }
    // the effects
    for (const e of events) {
      const at = t0 + e.at / 1000;
      if (e.k === 'whoosh') hiss(at - .12, .45, .35, 400, 5000);
      if (e.k === 'stab') CH[e.n % 4].forEach(f => { osc('sawtooth', f, at, .35, .05, arp); osc('triangle', f * 2, at, .25, .05, music); });
      if (e.k === 'boom') { osc('sine', 90, at, .9, .9, fx, 35); hiss(at, .5, .25, 200, 80, 'lowpass'); }
      if (e.k === 'pop') osc('sine', 600, at, .12, .5, fx, 1200);
      if (e.k === 'tick') osc('square', e.soft ? 1800 : 1100, at, .03, e.soft ? .06 : .14);
      if (e.k === 'ding') { osc('sine', 1318.5, at, .7, .35); osc('sine', 1975.5, at + .08, .8, .25); }
      if (e.k === 'chime') [880, 1108.7, 1318.5].forEach((f, i) => osc('sine', f, at + i * .07, .6, .18));
      if (e.k === 'blip') osc('sine', 660 * Math.pow(1.122, e.n), at, .12, .18);
      if (e.k === 'riser') hiss(at, e.d / 1000, .3, 300, 6000);
      if (e.k === 'scribble') for (let j = 0; j * .11 < e.d / 1000; j++) hiss(at + j * .11, .08 + (j % 3) * .015, .1 + (j % 2) * .04, 2600 + (j % 4) * 400, 3600 + (j % 3) * 500);
      if (e.k === 'sparkle') for (let i = 0; i < 8; i++) osc('sine', 2000 + ((i * 337) % 1500), at + i * .05, .15, .08);
      if (e.k === 'tada') [523.3, 659.3, 784, 1046.5].forEach((f, i) => { osc('triangle', f, at + i * .09, i === 3 ? 1.2 : .25, .3); osc('sine', f * 2, at + i * .09, .3, .08); });
    }
    // the admin's own voice, a little after the start
    if (voice?.decoded) {
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = voice.decoded; g.gain.value = _mix.voice; s.connect(g); g.connect(master);
      s.start(t0 + .3, 0, Math.max(0, len / 1000 - .4));
    }
    return end;
  }
  async function _decodeVoice(ctx, v) {
    const vo = _voice[adId(v)];
    if (vo && !vo.decoded) vo.decoded = await ctx.decodeAudioData(vo.buf.slice(0));
  }
  // preview with sound (one play from the start)
  let _playCtx = null;
  async function playWithSound() {
    try { await _playCtx?.close(); } catch { /* ignore */ }
    const ctx = _playCtx = new (window.AudioContext || window.webkitAudioContext)();
    await _decodeVoice(ctx, st.v);
    st.paused = false;
    const start = ctx.currentTime + .1;
    st.t0 = performance.now() + 100;
    _score(ctx, ctx.destination, st.v, start);
    const len = lengthOf(_variants(_facts())[st.v]);
    setTimeout(() => { if (_playCtx === ctx) { ctx.close().catch(() => {}); _playCtx = null; } }, len + 600);
  }

  // ── recording: the canvas as a video (+ the sound), in this browser ──
  function _mime(audio) {
    const want = audio
      ? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      : ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    return want.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  }
  async function record(v, fmt) {
    const audio = st.sound !== false && !!(window.AudioContext || window.webkitAudioContext);
    const mime = _mime(audio);
    if (!mime || !cv.captureStream) throw new Error('हा browser video बनवू शकत नाही — Chrome वापरा');
    const keep = { v: st.v, fmt: st.fmt, paused: st.paused };
    st.v = v; st.fmt = fmt; st.paused = false; st.t0 = performance.now();
    drawAt(0);
    let actx = null, dest = null;
    if (audio) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      await actx.resume().catch(() => {});
      await _decodeVoice(actx, v);
      dest = actx.createMediaStreamDestination();
    }
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...(dest ? dest.stream.getAudioTracks() : [])]), chunks = [];
    st.lastTracks = stream.getTracks().map(t => t.kind);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000, ...(audio ? { audioBitsPerSecond: 128_000 } : {}) });
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(r => { rec.onstop = r; });
    st.rec = rec; rec.start(500);
    const f = _facts(), len = lengthOf(_variants(f)[v]);
    st.t0 = performance.now();
    if (actx) _score(actx, dest, v, actx.currentTime);
    await new Promise(r => setTimeout(r, len + 300));
    rec.stop(); await done; st.rec = null;
    if (actx) actx.close().catch(() => {});
    Object.assign(st, keep, { t0: performance.now() });
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    return { blob: new Blob(chunks, { type: mime.split(';')[0] }), name: `${adId(v)}-${FMT_TAG[fmt] || fmt}.${ext}`, ext };
  }

  // ── leaderboard: which ad brings test takers / paying students cheapest ──
  async function _spend() { return (await DB.getSetting(SPEND_KEY, {}).catch(() => ({}))) || {}; }
  async function _saveSpend(id, rupees) { const s = await _spend(); s[id] = Math.max(0, Number(rupees) || 0); await DB.setSetting(SPEND_KEY, s).catch(() => {}); }
  // the decision rules (documented for the admin in the panel)
  // the admin's targets: what one test taker / one paying student may cost (kept on this device).
  // An ad alone in its ad set (e.g. just one NMMS ad) has nothing to be compared with — it is judged
  // against these; with several ads the cheapest only "wins" if it is also near the target.
  const TARGET_KEY = 'ad_targets';
  let _targets = { test: 50, paid: 400 };
  function verdicts(rows, tgt = _targets) {
    const enough = r => r.spend >= 500 || r.opened >= 30;
    const cpt = r => r.tested ? r.spend / r.tested : Infinity;
    const cpp = r => r.paid ? r.spend / r.paid : Infinity;
    const judged = rows.filter(r => enough(r) && r.spend > 0);
    const alone = judged.length <= 1;
    const usePaid = alone ? rows.some(r => r.paid >= 3) : rows.filter(r => r.paid >= 3).length >= 2;
    const cost = usePaid ? cpp : cpt, target = usePaid ? tgt.paid : tgt.test;
    const best = Math.min(...judged.map(cost).filter(Number.isFinite));
    return rows.map(r => {
      let v = '▶ चालू ठेवा', tone = '';
      if (!r.spend) { v = r.meta ? '⏳ Meta मध्ये अजून खर्च सुरू नाही' : '₹ खर्च लिहा'; tone = 'muted'; }
      else if (!enough(r)) { v = '⏳ अजून data कमी'; tone = 'muted'; }
      else if (!(usePaid ? r.paid : r.tested)) { v = '⏸ बंद करा (काहीच येत नाही)'; tone = 'bad'; }
      else if (alone) {
        // nothing to compare with: against the target
        if (target && cost(r) <= target) { v = `🏆 लक्ष्यापेक्षा स्वस्त (₹${target}) — बजेट 20% वाढवा`; tone = 'good'; }
        else if (target && cost(r) > target * 1.5) { v = `⏸ बंद करा (लक्ष्य ₹${target} च्या दीडपटपेक्षा महाग) — नवीन ad करून पाहा`; tone = 'bad'; }
        else v = `▶ चालू ठेवा (लक्ष्य ₹${target} च्या जवळ)`;
      }
      else if (Number.isFinite(best) && cost(r) === best) {
        if (!target || cost(r) <= target * 1.5) { v = '🏆 जिंकतेय — बजेट 20–25% वाढवा'; tone = 'good'; }
        else v = `▶ सगळ्यात स्वस्त, पण लक्ष्य ₹${target} पेक्षा महाग — बजेट वाढवू नका`;
      }
      else if (Number.isFinite(best) && cost(r) > best * 1.5) { v = '⏸ बंद करा (दीडपट महाग)'; tone = 'bad'; }
      return { ...r, cpt: cpt(r), cpp: cpp(r), verdict: v, tone, by: usePaid ? 'paid' : 'test' };
    });
  }
  // verdicts inside each Meta ad set (ads compete with the ads they share a budget with)
  function verdictsBy(rows, keyOf) {
    const g = new Map();
    for (const r of rows) { const k = keyOf(r.id) || '·'; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    return [...g.values()].flatMap(rows0 => verdicts(rows0));
  }
  // 💰 the Meta account's money: prepaid balance (and how many days it lasts at the running
  // ad sets' daily budgets) or the amount due, and the lifetime spend
  const BILLING = 'https://business.facebook.com/billing_hub/accounts/details?asset_id=536773299299931&business_id=411214578749736';
  // the places the admin starts / watches ads (our own accounts only)
  const ADS_LINKS = [
    ['📘 Meta Ads Manager (Facebook / Instagram ads)', 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=536773299299931&business_id=411214578749736'],
    ['💰 Meta Billing (पैसे भरा)', BILLING],
    ['▶️ Google Ads (YouTube ads)', 'https://ads.google.com/aw/campaigns?ocid=8650274639'],
    ['🎬 YouTube Studio (video upload)', 'https://studio.youtube.com/'],
  ];
  function _moneyLine(acc, S) {
    if (!acc) return '';
    const rs = n => '₹' + Math.round(n).toLocaleString('en-IN');
    const perDay = [...new Map(Object.values(S || {}).filter(a => a.status === 'ACTIVE' && a.adset_id).map(a => [a.adset_id, Number(a.budget) || 0])).values()].reduce((t, b) => t + b, 0);
    const parts = [];
    if (acc.prepay && acc.funds !== null && acc.funds !== undefined) {
      const days = perDay ? acc.funds / perDay : null;
      const low = days !== null && days < 2;
      parts.push(`<b class="${low ? 'ads-low' : ''}">💰 शिल्लक: ${rs(acc.funds)}</b>${perDay ? ` (आत्ताच्या ₹${Math.round(perDay)}/दिवस खर्चाने ≈ ${days < 1 ? 'आजच संपेल' : Math.floor(days) + ' दिवस पुरेल'})` : ''}${low ? ' ⚠️ पैसे संपत आले — आज भरा, नाहीतर ads थांबतील' : ''}`);
    } else if (acc.funds_text) parts.push(`💰 ${_esc(acc.funds_text)}`);
    else if (acc.due) parts.push(`💰 देय रक्कम: ${rs(acc.due)}`);
    if (acc.spent_total !== null && acc.spent_total !== undefined) parts.push(`आत्तापर्यंत एकूण खर्च ${rs(acc.spent_total)}`);
    if (acc.spend_cap) parts.push(`खर्च मर्यादा ${rs(acc.spend_cap)}`);
    return parts.length ? `<br>${parts.join(' · ')} · <a href="${BILLING}" target="_blank" rel="noopener">पैसे भरा / Billing ↗</a>` : '';
  }
  // 💰 Google Ads: Google's API has no prepaid balance — an estimate from what the admin paid
  // (less 18% GST) minus Google's own spend since the first payment
  const G_BILLING = 'https://ads.google.com/aw/billing/summary?ocid=8650274639';
  function _gMoneyLine(gads) {
    const m = gads.money || {}, rs = n => '₹' + Math.round(n).toLocaleString('en-IN');
    const perDay = Number(gads.active_budget) || 0;
    let head;
    if (m.error) head = `💰 शिल्लक काढता आली नाही: ${_esc(m.error)}`;
    else if (!m.topups?.length) head = '💰 Google शिल्लक API मधून देत नाही — Google Ads मध्ये पैसे भरले की इथे लिहा, मग अंदाजे शिल्लक दिसेल';
    else {
      const days = perDay ? m.est_balance / perDay : null, low = m.est_balance <= 0 || (days !== null && days < 2);
      head = `<b class="${low ? 'ads-low' : ''}">💰 अंदाजे शिल्लक: ${rs(Math.max(0, m.est_balance))}</b>${perDay ? ` (आत्ताच्या ₹${Math.round(perDay)}/दिवस खर्चाने ≈ ${days < 1 ? 'आजच संपेल' : Math.floor(days) + ' दिवस पुरेल'})` : ''}${low ? ' ⚠️ पैसे संपत आले — Google Ads मध्ये भरा' : ''}
        <br><small>भरले ${rs(m.paid)} (18% GST वजा धरून) · ${_esc(m.since)} पासून Google चा खर्च ${rs(m.spent)} · अंदाज आहे, अचूक आकडा Billing मध्ये</small>`;
    }
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const list = (m.topups || []).map((t, i) => `<span class="ads-topup">${rs(t.amount)} · ${_esc(t.date)} <button type="button" class="ads-mini" data-gtop-del="${i}" aria-label="काढा">✕</button></span>`).join(' ');
    return `${head}
      <span class="ads-topup-form">भरलेले पैसे: ₹ <input id="gads-amt" type="number" min="1" step="100" class="admin-input" aria-label="रक्कम" />
        <input id="gads-date" type="date" class="admin-input" value="${today}" max="${today}" aria-label="तारीख" />
        <button type="button" class="ads-mini good" id="gads-add">+ लिहा</button> ${list}
        <a href="${G_BILLING}" target="_blank" rel="noopener">Billing ↗</a></span>`;
  }
  async function _loadBoard(fresh = false) {
    const box = $('ads-board'); if (!box) return;
    _loadLive();   // 📡 the state of every ad, always fresh
    box.innerHTML = '<p class="import-hint">⏳ उघडत आहे…</p>';
    try {
      const days = Number($('ads-days')?.value || 30);
      // Meta's own numbers (spend, views, link clicks) when Meta is connected on the server
      const [f, meta, gads] = await Promise.all([
        API.fetchGuestFunnel(days),
        Promise.resolve(API.fetchMetaAds?.(days, { fresh })).catch(err => ({ connected: false, error: err?.message || '' })),
        Promise.resolve(API.fetchGoogleAds?.(days, { fresh })).catch(err => ({ connected: false, error: err?.message || '' })),
      ]);
      const G = gads?.connected ? (gads.by_name || {}) : {}, GS = gads?.connected ? (gads.ads || {}) : {};
      const M = { ...(meta?.connected ? (meta.by_name || {}) : {}), ...Object.fromEntries(Object.entries(G).map(([k, g]) => [k, { ...g, google: true }])) };
      _metaOk = !!meta?.connected; _paintMetaBox();
      const spend = await _spend();
      const V = _variants(_facts());
      // which audience an ad id belongs to: t-<variant> = teacher ads, <class>-<variant> otherwise
      const ours = id => /^(yt-)?t-/.test(id) || /(^|-)v[psty]-[a-z0-9]+$/.test(id) || Object.keys(V).some(v => id.endsWith('-' + v));
      const audOfId = id => { const vm = /(?:^|-)v([psty])-[a-z0-9]+$/.exec(id); if (vm) return LETTER_AUD[vm[1]];
        const m = /^(?:yt-)?t-(.+)$/.exec(id); if (m) return V[m[1]]?.aud || 'school'; const k = Object.keys(V).filter(v => id.endsWith('-' + v)).sort((a, b) => b.length - a.length)[0]; return V[k]?.aud || 'parent'; };
      // every ad that is in Meta under our name shows up (also a new one with no spend yet)
      const inMeta = [...(meta?.connected ? Object.keys(meta.ads || {}) : []), ...Object.keys(GS)].filter(ours);
      // web-<exam>: visitors from our own exam pages (Sync › Leads shows them) — not an ad, no spend
      const ids = new Set([...Object.keys(f.by_ad || {}), ...Object.keys(f.by_teacher_ad || {}), ...Object.keys(spend), ...Object.keys(M).filter(ours), ...inMeta].filter(id => !/^web-/.test(id)));
      const odd = Object.values(M).filter(m => !ours(m.name.toLowerCase()));
      const rs = n => Number.isFinite(n) ? '₹' + Math.round(n) : '—';
      const num = n => n >= 1e5 ? (n / 1e5).toFixed(1) + 'L' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n);
      // spend: from Meta when the ad is there (read-only), else typed by the admin
      const spendCell = r => M[r.id] ? `<b>₹${Math.round(r.spend)}</b> <small class="ads-meta">${M[r.id].google ? 'Google' : 'Meta'}</small>`
        : `<input type="number" min="0" step="50" class="admin-input ads-spend" data-id="${_esc(r.id)}" value="${r.spend || ''}" aria-label="${_esc(r.id)} खर्च" />`;
      // the ad's state in Meta + the buttons: ⏸ / ▶ for the ad, 🏆 +20% for a winning ad set
      const S = meta?.connected ? (meta.ads || {}) : {};
      if (meta?.account?.id) _liveAcc = String(meta.account.id).replace(/^act_/, '');
      // 💡 advice from the results so far (one press applies it)
      if (meta?.connected) _paintAdvice(_advice(f, S, id => (M[id] && !M[id].google ? M[id].spend : Number(spend[id]) || 0),
        id => (isTeacher(audOfId(id)) ? (f.by_teacher_ad?.[id]?.registered || 0) : (f.by_ad?.[id]?.tested || 0))));
      const actCell = r => {
        const g = GS[r.id];
        if (g) {
          const on = g.status === 'ENABLED';
          // Google's own review first (in review / refused / limited), then on / off
          const gst = g.review === 'REVIEW_IN_PROGRESS' ? ['🔍 Google तपासत आहे', 'wait'] : g.approval === 'DISAPPROVED' ? ['❌ Google ने नाकारली', 'bad']
            : g.approval === 'APPROVED_LIMITED' ? ['⚠️ मर्यादित मंजुरी', 'bad'] : on ? ['🟢 चालू', 'on'] : ['⏸ बंद', 'off'];
          const btns = [`<span class="lv-chip ${gst[1]}">${gst[0]}${g.campaign_status && g.campaign_status !== 'ENABLED' ? ' (campaign बंद)' : ''}</span>`,
            '<a class="ads-act" href="https://ads.google.com/aw/ads" target="_blank" rel="noopener" title="Google Ads मध्ये उघडा (नाकारली असेल तर तिथे कारण दिसतं)">🔗</a>'];
          btns.push(on ? `<button type="button" class="ads-act${r.tone === 'bad' ? ' warn' : ''}" data-gact="pause" data-ad="${_esc(g.ad)}">⏸ बंद करा</button>`
            : `<button type="button" class="ads-act" data-gact="resume" data-ad="${_esc(g.ad)}">▶ चालू करा</button>`);
          if (r.tone === 'good' && g.budget && g.budget_id) btns.push(`<button type="button" class="ads-act good" data-gact="budget" data-budget="${_esc(g.budget_id)}">🏆 बजेट ₹${Math.round(g.budget)} → ₹${Math.round(g.budget * 1.2)}</button>`);
          return `<div class="ads-acts">${btns.join('')}</div>`;
        }
        const a = S[r.id]; if (!a) return '';
        const on = a.status === 'ACTIVE';
        const btns = [`<span class="lv-chip ${_stOf(a)[1]}">${_stOf(a)[0]}</span>`, `<a class="ads-act" href="${_amLink('ads', a.ad_id)}" target="_blank" rel="noopener" title="Ads Manager मध्ये उघडा">🔗</a>`];
        if (on) btns.push(`<button type="button" class="ads-act${r.tone === 'bad' ? ' warn' : ''}" data-act="pause" data-ad="${_esc(a.ad_id)}">⏸ बंद करा</button>`);
        else btns.push(`<button type="button" class="ads-act" data-act="resume" data-ad="${_esc(a.ad_id)}">▶ चालू करा</button>`);
        if (r.tone === 'good' && a.budget) btns.push(`<button type="button" class="ads-act good" data-act="budget" data-adset="${_esc(a.adset_id)}">🏆 बजेट ₹${Math.round(a.budget)} → ₹${Math.round(a.budget * 1.2)}</button>`);
        return `<div class="ads-acts">${btns.join('')}</div>`;
      };
      const setName = id => GS[id] ? `<small class="ads-set">▶️ YouTube · ${_esc(GS[id].campaign)}${GS[id].budget ? ` · ₹${Math.round(GS[id].budget)}/दिवस` : ''}</small>` : /^yt-/.test(id) ? '<small class="ads-set">▶️ YouTube</small>' : S[id]?.adset ? `<small class="ads-set">${_esc(S[id].adset)}${S[id].budget ? ` · ₹${Math.round(S[id].budget)}/दिवस` : ''}</small>` : '';
      const metaCell = id => M[id] ? `${num(M[id].impressions)}${M[id].google && M[id].views ? ` (${num(M[id].views)} views)` : ''} · ${M[id].clicks}${M[id].clicks ? ` <small>(₹${Math.round(M[id].spend / M[id].clicks)}/click)</small>` : ''}` : '—';
      const status = !meta ? '' : meta.connected
        ? `<p class="ads-meta-line ok">🔗 Meta जोडलं: <b>${_esc(meta.account?.name || '')}</b> · ${_esc(meta.account?.currency || '')} · ${_esc(meta.since || '')} ते ${_esc(meta.until || '')} · ${Object.keys(M).length} ads
            <br>${meta.config?.dataset ? `🎯 Free test चा निकाल Meta ला जातो: ${meta.capi?.leads || 0} Free test (नवीन ad sets "Free test" वर चालतात; payment ची माहिती जात नाही)` : '🎯 निकाल अजून Meta ला जात नाहीत — Render मध्ये META_DATASET_ID टाका (ad sets सध्या "click" वर चालतात)'}
            ${_moneyLine(meta.account, S)}</p>`
        : meta.error ? `<p class="ads-meta-line bad">⚠️ ${_esc(meta.error)}</p>`
        : '<p class="ads-meta-line">🔗 Meta जोडलेलं नाही — खर्च हाताने लिहा.</p>';
      const gStatus = !gads ? '' : gads.connected
        ? `<p class="ads-meta-line ok">▶️ Google Ads (YouTube) जोडलं: <b>${_esc(gads.account?.name || '')}</b> · ${_esc(gads.account?.currency || '')} · ${Object.keys(G).length} ads${gads.config?.lead_action ? ` · 🎯 Free test Google ला जातो: ${gads.leads || 0}` : ' · 🎯 Google ला निकाल अजून जात नाहीत (GOOGLE_ADS_LEAD_ACTION_ID नाही)'}
            <br>${_gMoneyLine(gads)}</p>`
        : gads.error ? `<p class="ads-meta-line bad">▶️ Google Ads: ⚠️ ${_esc(gads.error)}</p>`
        : (Object.keys(f.by_ad || {}).some(k => k.startsWith('yt-')) || Object.keys(spend).some(k => k.startsWith('yt-'))) ? '<p class="ads-meta-line">▶️ Google Ads जोडलेलं नाही — YouTube ads चा खर्च हाताने लिहा.</p>' : '';
      // ads compete inside their own Meta ad set / YouTube campaign (Meta and YouTube never against each other)
      const keyOf = id => GS[id] ? 'yt:' + GS[id].campaign_id : /^yt-/.test(id) ? 'yt:' : S[id]?.adset;
      const groups = Object.keys(AUD).map(aud => {
        const mine = [...ids].filter(id => audOfId(id) === aud);
        if (!mine.length) return '';
        const sp = id => M[id] ? M[id].spend : (Number(spend[id]) || 0);
        if (isTeacher(aud)) {
          const rows = verdictsBy(mine.map(id => { const t = f.by_teacher_ad?.[id] || {}; return { id, opened: 0, tested: t.registered || 0, paid: t.paid || 0, spend: sp(id), approved: t.approved || 0, students: t.students || 0, meta: !!(S[id] || M[id] || GS[id]) }; }), keyOf)
            .sort((a, b) => (a.by === 'paid' ? a.cpp - b.cpp : a.cpt - b.cpt));
          return `<h5 class="ads-aud-h">${AUD[aud].name}</h5><table class="ads-table"><thead><tr><th>Ad</th><th>Meta: पाहिली · click</th><th>नोंदणी</th><th>Approve</th><th>त्यांनी आणलेली मुलं</th><th>Pay केलं</th><th>खर्च ₹</th><th>₹ / नोंदणी</th><th>₹ / paid</th><th>काय करायचं</th></tr></thead><tbody>
            ${rows.map(r => `<tr class="${r.tone}"><td>${_esc(r.id)}${setName(r.id)}</td><td>${metaCell(r.id)}</td><td>${r.tested}</td><td>${r.approved}</td><td>${r.students}</td><td>${r.paid}</td>
              <td>${spendCell(r)}</td>
              <td>${rs(r.cpt)}</td><td>${rs(r.cpp)}</td><td><b>${r.verdict}</b>${actCell(r)}</td></tr>`).join('')}</tbody></table>`;
        }
        const rows = verdictsBy(mine.map(id => ({ id, opened: f.by_ad?.[id]?.opened || 0, tested: f.by_ad?.[id]?.tested || 0, paid: f.by_ad?.[id]?.paid || 0, spend: sp(id), meta: !!(S[id] || M[id] || GS[id]) })), keyOf)
          .sort((a, b) => (a.by === 'paid' ? a.cpp - b.cpp : a.cpt - b.cpt) || b.opened - a.opened);
        return `<h5 class="ads-aud-h">${AUD[aud].name}</h5><table class="ads-table"><thead><tr><th>Ad</th><th>Meta: पाहिली · click</th><th>Link उघडली</th><th>Test दिली</th><th>Pay केलं</th><th>खर्च ₹</th><th>₹ / test</th><th>₹ / paid</th><th>काय करायचं</th></tr></thead><tbody>
          ${rows.map(r => `<tr class="${r.tone}"><td>${_esc(r.id)}${setName(r.id)}</td><td>${metaCell(r.id)}</td><td>${r.opened}</td><td>${r.tested}</td><td>${r.paid}</td>
            <td>${spendCell(r)}</td>
            <td>${rs(r.cpt)}</td><td>${rs(r.cpp)}</td><td><b>${r.verdict}</b>${actCell(r)}</td></tr>`).join('')}</tbody></table>`;
      }).join('');
      // Meta ads whose name is not one of our ad ids: their numbers can't be matched
      const oddHtml = odd.length ? `<p class="ads-meta-line bad">ℹ️ Meta मधल्या या ads चं नाव आपल्या ad id सारखं नाही, म्हणून त्यांचे आकडे जुळत नाहीत: ${odd.map(m => `<b>${_esc(m.name)}</b> (₹${Math.round(m.spend)})`).join(', ')}. Ads Manager मध्ये ad चं नाव ad id सारखं ठेवा (उदा. 10th-r-guide).</p>` : '';
      if (!groups) { box.innerHTML = `${status}${gStatus}${oddHtml}<p class="import-hint">अजून कोणत्याही ad मधून कोणी आलं नाही. Ad चालू केल्यावर इथे आकडे येतील.</p>`; return; }
      box.innerHTML = `${status}${gStatus}${groups}${oddHtml}
      <p class="import-hint">प्रत्येक गटातल्या ads ची तुलना त्याच गटातल्या ads शी. पालक / विद्यार्थी: "₹ प्रति test", teachers: "₹ प्रति नोंदणी"; 2 ads ना 3+ paid झाले की "₹ प्रति paid" वरून. ₹500 खर्च किंवा 30 जणांनी link उघडल्यावरच निर्णय. ${meta?.connected ? 'खर्च Meta कडून आपोआप येतो (10 मिनिटांत एकदा ताजा).' : 'Meta मधला खर्च इथे लिहा.'}</p>`;
      // buttons act in Meta: first press asks "पक्कं?", the second does it
      box.querySelectorAll('.ads-act').forEach(btn => btn.addEventListener('click', async () => {
        if (!btn.dataset.sure) {
          btn.dataset.label = btn.textContent; btn.dataset.sure = '1'; btn.textContent = 'पक्कं? पुन्हा दाबा';
          setTimeout(() => { if (btn.isConnected && btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = btn.dataset.label; } }, 4000);
          return;
        }
        btn.disabled = true; btn.textContent = '⏳';
        try {
          const ga = btn.dataset.gact;
          if (ga) {
            const out = ga === 'budget' ? await API.googleAction({ action: 'budget', budget: btn.dataset.budget }) : await API.googleAction({ action: ga, ad: btn.dataset.ad });
            APP.toast(ga === 'budget' ? `YouTube: बजेट ₹${out.from} → ₹${out.to}` : `YouTube ad ${out.status === 'PAUSED' ? 'बंद केली' : 'चालू केली'}`, 'success');
            _loadBoard(true);
            return;
          }
          const out = btn.dataset.act === 'budget' ? await API.metaAction({ action: 'budget', adset_id: btn.dataset.adset })
            : await API.metaAction({ action: btn.dataset.act, ad_id: btn.dataset.ad });
          APP.toast(btn.dataset.act === 'budget' ? `${out.name}: बजेट ₹${out.from} → ₹${out.to}` : `${out.name}: ${out.status === 'PAUSED' ? 'बंद केली' : 'चालू केली'}${out.note === 'adset' ? ' — ही ad set मधली एकटी चालू ad होती, म्हणून ad set पण बंद केला (खर्च थांबला)' : ''}`, 'success');
          _loadBoard(true);
        } catch (err) {
          APP.toast(err?.message || (btn.dataset.gact ? 'Google Ads मध्ये बदल झाला नाही' : 'Meta मध्ये बदल झाला नाही'), 'error');
          btn.disabled = false; delete btn.dataset.sure; btn.textContent = btn.dataset.label;
        }
      }));
      // Google Ads: write down a payment / remove a wrong one
      $('gads-add')?.addEventListener('click', async () => {
        try { await API.googleTopup({ amount: Number($('gads-amt').value), date: $('gads-date').value }); APP.toast('लिहिलं', 'success'); _loadBoard(true); }
        catch (err) { APP.toast(err?.message || 'लिहिता आलं नाही', 'error'); }
      });
      box.querySelectorAll('[data-gtop-del]').forEach(b => b.addEventListener('click', async () => {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'पक्कं?'; return; }
        try { await API.googleTopupDelete(b.dataset.gtopDel); _loadBoard(true); } catch (err) { APP.toast(err?.message || '', 'error'); }
      }));
      box.querySelectorAll('.ads-spend').forEach(inp => inp.addEventListener('change', async () => { await _saveSpend(inp.dataset.id, inp.value); _loadBoard(); }));
    } catch (err) { box.innerHTML = `<p class="import-hint">आकडे आणता आले नाहीत: ${_esc(err?.message || '')}</p>`; }
  }

  // ── 📡 Meta control panel: every ad's real state (upload / review / running / refused + why),
  // links into Ads Manager, ⏸ / ▶ per ad and per ad set, each ad set's daily budget, and 💡 advice
  // ("pause the losing ad, give its money to the winner") that the admin applies with one press.
  const ST = {
    ACTIVE: ['🟢 चालू — लोकांना दिसत आहे', 'on'], PAUSED: ['⏸ बंद', 'off'], ADSET_PAUSED: ['⏸ ad set बंद', 'off'], CAMPAIGN_PAUSED: ['⏸ campaign बंद', 'off'],
    IN_PROCESS: ['⏳ Video तयार होत आहे', 'wait'], PENDING_REVIEW: ['🔍 Meta तपासत आहे (review)', 'wait'], PREAPPROVED: ['🔍 तपासणी जवळजवळ पूर्ण', 'wait'],
    DISAPPROVED: ['❌ Meta ने नाकारली', 'bad'], WITH_ISSUES: ['⚠️ अडचण आहे', 'bad'], PENDING_BILLING_INFO: ['💳 Payment ची माहिती हवी', 'bad'],
    ARCHIVED: ['🗃 Archive', 'off'], DELETED: ['🗑 काढली', 'off'],
  };
  const _stOf = a => {
    const e = a.effective || a.status || '';
    // turned on but Meta still checking → the review is what matters
    return ST[e] || [e || '—', 'off'];
  };
  let _liveAcc = '', _liveTimer = 0, _liveAt = 0, _liveTick = 0, _liveSeq = 0;
  const _amLink = (kind, id) => `https://adsmanager.facebook.com/adsmanager/manage/${kind}?act=${_liveAcc}&selected_${kind === 'ads' ? 'ad' : kind === 'adsets' ? 'adset' : 'campaign'}_ids=${id}`;
  async function _loadLive() {
    const box = $('ads-live'); if (!box) return;
    clearTimeout(_liveTimer);
    let r;
    const seq = ++_liveSeq;
    try { r = await API.fetchMetaStatus(); } catch (err) { r = { connected: false, error: err?.message || '' }; }
    if (seq !== _liveSeq) return;   // a newer check is on its way
    // the admin is typing a budget: don't wipe it — look again a little later
    const ed = document.activeElement;
    if (box.contains(ed) && ed.classList.contains('lv-amt') && ed.value !== ed.dataset.old) { _liveTimer = setTimeout(_loadLive, 30000); return; }
    if (!r?.connected) { box.hidden = !r?.error; box.innerHTML = r?.error ? `<p class="ads-meta-line bad">📡 Meta: ${_esc(r.error)}</p>` : ''; return; }
    box.hidden = false;
    _liveAcc = r.account_id || ''; _liveAt = Date.now();
    const all = Object.entries(r.ads || {}).map(([id, a]) => ({ id, ...a })).filter(a => !['ARCHIVED', 'DELETED'].includes(a.effective));
    const n = k => all.filter(a => _stOf(a)[1] === k).length;
    // campaign → ad set → ads
    const camps = {};
    for (const a of all) {
      const c = camps[a.campaign_id || '-'] ||= { id: a.campaign_id, name: a.campaign || '—', status: a.campaign_status, sets: {} };
      (c.sets[a.adset_id || '-'] ||= { id: a.adset_id, name: a.adset || '—', budget: a.budget, status: a.adset_status, ads: [] }).ads.push(a);
    }
    const adRow = a => {
      const [label, tone] = _stOf(a), on = a.status === 'ACTIVE';
      return `<div class="lv-ad ${tone}">
        <span class="lv-chip ${tone}">${label}</span>
        <b class="lv-name">${_esc(a.id)}</b>
        ${a.why?.length ? `<span class="lv-why">कारण: ${a.why.map(_esc).join(' · ')}</span>` : ''}
        ${a.effective === 'DISAPPROVED' ? '<span class="lv-why">👉 Meta मध्ये उघडा → "Request review" (चूक वाटत असेल तर) किंवा ad चा मजकूर / video बदलून नवीन पाठवा.</span>' : a.effective === 'PENDING_BILLING_INFO' ? '<span class="lv-why">👉 Meta Billing मध्ये payment पद्धत / balance तपासा.</span>' : ''}
        <span class="lv-btns">
          ${on ? `<button type="button" class="ads-act lv-do" data-act="pause" data-ad="${_esc(a.ad_id)}">⏸ बंद</button>` : `<button type="button" class="ads-act good lv-do" data-act="resume" data-ad="${_esc(a.ad_id)}">▶ चालू</button>`}
          <a class="ads-act" href="${_amLink('ads', a.ad_id)}" target="_blank" rel="noopener">🔗 Meta मध्ये उघडा</a>
          ${a.fb_post ? `<a class="ads-act good" href="${_esc(a.fb_post)}" target="_blank" rel="noopener" title="लोकांना दिसणारी post — share करा, comments ना उत्तर द्या">👁 Facebook post + comments</a><button type="button" class="ads-act" data-copy="${_esc(a.fb_post)}" title="Post ची link copy">📋 post link</button>` : ''}
          ${a.ig_post ? `<a class="ads-act good" href="${_esc(a.ig_post)}" target="_blank" rel="noopener">📸 Instagram post</a>` : ''}
          <button type="button" class="ads-act" data-copy="${_amLink('ads', a.ad_id)}">📋</button>
        </span></div>`;
    };
    const setBox = s => `<div class="lv-set">
        <div class="lv-set-h"><b>📦 ${_esc(s.name)}</b> <small>${_esc(ST[s.status]?.[0] || s.status || '')}</small>
          <span class="lv-budget">रोज ₹ <input type="number" min="100" step="10" class="admin-input lv-amt" value="${s.budget || ''}" data-old="${s.budget || ''}" ${s.budget ? '' : 'disabled'} />
          <button type="button" class="ads-act lv-setb" data-adset="${_esc(s.id)}" ${s.budget ? '' : 'disabled'}>💾 बजेट बदला</button></span>
          <a class="ads-act" href="${_amLink('adsets', s.id)}" target="_blank" rel="noopener">🔗</a></div>
        ${s.ads.map(adRow).join('')}
        <small class="lv-note">बजेट या ad set मधल्या ${s.ads.length} ads मिळून आहे — Meta तो चांगल्या ad कडे आपोआप जास्त वळवतो.</small>
      </div>`;
    const waitN = n('wait');
    box.innerHTML = `
      <div class="lv-head">
        <b>📡 Meta मधल्या ads</b>
        <span class="lv-sum"><span class="lv-chip on">🟢 ${n('on')} चालू</span><span class="lv-chip wait">🔍 ${waitN} तपासणीत / तयार होत</span><span class="lv-chip off">⏸ ${n('off')} बंद</span><span class="lv-chip bad">❌ ${n('bad')} अडचण</span></span>
        <span class="lv-tools"><button type="button" class="ads-act" id="lv-refresh">🔄 आत्ता तपासा</button>
          <a class="ads-act" href="https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${_liveAcc}" target="_blank" rel="noopener">🔗 Ads Manager</a>
          <a class="ads-act" href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noopener" title="सगळ्या ads वरचे comments आणि messages एका ठिकाणी — उत्तर द्या">💬 Comments / Inbox</a>
          <small id="lv-at">आत्ता तपासलं</small></span>
      </div>
      <div id="ads-advice"></div>
      ${all.length ? Object.values(camps).map(c => `<div class="lv-camp"><div class="lv-camp-h">📣 ${_esc(c.name)} <small>${c.status === 'ACTIVE' ? '🟢' : '⏸'} campaign</small> <a class="ads-act" href="${_amLink('campaigns', c.id)}" target="_blank" rel="noopener">🔗</a></div>${Object.values(c.sets).map(setBox).join('')}</div>`).join('')
        : '<p class="import-hint">Meta मध्ये अजून आपली एकही ad नाही. वरच्या "📤 Meta वर पाठवा" ने पाठवा.</p>'}
      ${waitN ? '<p class="import-hint">🔍 Review ला साधारण काही तास ते 24 तास लागतात. हे पान उघडं असेल तर दर 2 मिनिटांनी आपोआप तपासतं.</p>' : ''}`;
    if (_lastAdvice) _paintAdvice(_lastAdvice);
    $('lv-refresh').addEventListener('click', () => _loadBoard(true));
    box.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => navigator.clipboard?.writeText(b.dataset.copy).then(() => APP.toast('Link copy झाली', 'success'))));
    box.querySelectorAll('.lv-do').forEach(btn => btn.addEventListener('click', () => _sure(btn, async () => {
      const out = await API.metaAction({ action: btn.dataset.act, ad_id: btn.dataset.ad });
      APP.toast(`${out.name}: ${out.status === 'PAUSED' ? 'बंद केली' : 'चालू केली'}${out.note === 'adset' ? ' (ad set मधली शेवटची चालू ad — ad set पण बंद, खर्च थांबला)' : ''}`, 'success');
    })));
    box.querySelectorAll('.lv-setb').forEach(btn => btn.addEventListener('click', () => {
      const inp = btn.parentElement.querySelector('.lv-amt'), old = Number(inp.dataset.old), want = Math.round(Number(inp.value));
      if (!(want >= 100)) { APP.toast('रोजचं बजेट किमान ₹100', 'error'); return; }
      if (want === old) { APP.toast('बजेट तेच आहे', 'info'); return; }
      const big = want > old * 1.2;
      _sure(btn, async () => {
        const out = await API.metaAction({ action: 'set_budget', adset_id: btn.dataset.adset, amount: want, big });
        APP.toast(`${out.name}: रोजचं बजेट ₹${out.from} → ₹${out.to}`, 'success');
      }, big ? `₹${old} → ₹${want} (+${Math.round((want / old - 1) * 100)}%): मोठी वाढ — Meta पुन्हा शिकेल. पक्कं? पुन्हा दाबा` : `₹${old} → ₹${want} पक्कं? पुन्हा दाबा`);
    }));
    const tick = () => { const el = $('lv-at'); if (!el) return; const m = Math.floor((Date.now() - _liveAt) / 60000); el.textContent = m ? `${m} मिनिटांपूर्वी तपासलं` : 'आत्ता तपासलं'; };
    if (!_liveTick) _liveTick = setInterval(tick, 30000);
    // while something is uploading / in review: look again every 2 minutes (only while the panel is on screen)
    if (waitN) _liveTimer = setTimeout(() => { if (box.isConnected && box.offsetParent) _loadLive(); }, 120000);
  }
  // first press asks, the second does it (then everything is read again)
  function _sure(btn, run, ask = 'पक्कं? पुन्हा दाबा') {
    if (!btn.dataset.sure) {
      btn.dataset.label = btn.textContent; btn.dataset.sure = '1'; btn.textContent = ask;
      setTimeout(() => { if (btn.isConnected && btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = btn.dataset.label; } }, 5000);
      return;
    }
    btn.disabled = true; btn.textContent = '⏳';
    Promise.resolve().then(run).then(() => _loadBoard(true))
      .catch(err => { APP.toast(err?.message || 'Meta मध्ये बदल झाला नाही', 'error'); btn.disabled = false; delete btn.dataset.sure; btn.textContent = btn.dataset.label; });
  }

  // 💡 advice from the real results: inside an ad set, pause an ad that costs ≥1.6× the best per
  // result (after 3 days and ₹300 each) and give the ad set +20%; between ad sets of one campaign, move
  // money from the costly one to the cheap one. Never pauses an ad set's last running ad.
  let _lastAdvice = null;
  function _advice(f, S, spendOf, resultOf) {
    const sets = {};
    for (const [id, a] of Object.entries(S || {})) {
      if (!a.adset_id || a.google) continue;
      (sets[a.adset_id] ||= { id: a.adset_id, name: a.adset, budget: a.budget, created: a.adset_created, campaign: a.campaign_id, ads: [] })
        .ads.push({ id, ad_id: a.ad_id, on: a.status === 'ACTIVE', spend: spendOf(id), res: resultOf(id) });
    }
    const days = s => (Date.now() - new Date(s.created || Date.now()).getTime()) / 864e5;
    const per = (sp, n) => (n ? sp / n : Infinity);
    const tips = [];
    for (const s of Object.values(sets)) {
      const live = s.ads.filter(a => a.on);
      if (live.length < 2 || days(s) < 3) continue;
      const ok = live.filter(a => a.spend >= 300);
      const best = ok.filter(a => a.res).sort((a, b) => per(a.spend, a.res) - per(b.spend, b.res))[0];
      if (!best || ok.length < 2) continue;
      const bc = per(best.spend, best.res);
      const losers = ok.filter(a => a !== best && per(a.spend, a.res) >= bc * 1.6).slice(0, live.length - 1);
      if (!losers.length) continue;
      const up = s.budget ? Math.round(s.budget * 1.2) : 0;
      tips.push({ title: `📦 ${s.name}`, text: `<b>${_esc(best.id)}</b> जिंकतेय (₹${Math.round(bc)} / निकाल). ${losers.map(a => `<b>${_esc(a.id)}</b> ${a.res ? `₹${Math.round(per(a.spend, a.res))} / निकाल` : `₹${Math.round(a.spend)} खर्च, 0 निकाल`}`).join(', ')} — बंद करून तो पैसा जिंकणाऱ्या ad ला${up ? `; ad set चं बजेट ₹${s.budget} → ₹${up}` : ''}.`,
        acts: [...losers.map(a => ({ action: 'pause', ad_id: a.ad_id })), ...(up ? [{ action: 'set_budget', adset_id: s.id, amount: up }] : [])] });
    }
    // between ad sets of the same campaign (e.g. 8th NMMS parents vs 10th parents)
    const byCamp = {};
    for (const s of Object.values(sets)) {
      const sp = s.ads.reduce((t, a) => t + a.spend, 0), res = s.ads.reduce((t, a) => t + a.res, 0);
      if (s.budget && sp >= 500 && days(s) >= 3 && s.ads.some(a => a.on)) (byCamp[s.campaign] ||= []).push({ ...s, cost: per(sp, res) });
    }
    for (const list of Object.values(byCamp)) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.cost - b.cost);
      const good = list[0], bad = list[list.length - 1];
      if (!(bad.cost >= good.cost * 1.6)) continue;
      const x = Math.min(Math.round(good.budget * 0.2), bad.budget - 100);
      if (x < 20) continue;
      tips.push({ title: '🔀 ad sets मध्ये पैसा वळवा', text: `<b>${_esc(good.name)}</b> ₹${Math.round(good.cost)} / निकाल, <b>${_esc(bad.name)}</b> ${Number.isFinite(bad.cost) ? `₹${Math.round(bad.cost)}` : '0 निकाल'} — ${_esc(bad.name)} चं ₹${bad.budget} → ₹${bad.budget - x}, ${_esc(good.name)} चं ₹${good.budget} → ₹${good.budget + x} (एकूण खर्च तेवढाच).`,
        acts: [{ action: 'set_budget', adset_id: bad.id, amount: bad.budget - x }, { action: 'set_budget', adset_id: good.id, amount: good.budget + x }] });
    }
    return tips;
  }
  function _paintAdvice(tips) {
    _lastAdvice = tips;
    const box = $('ads-advice'); if (!box) return;
    box.innerHTML = tips.length
      ? `<div class="lv-adv"><b>💡 आजचा सल्ला</b>${tips.map((t, i) => `<div class="lv-tip"><span>${t.title}: ${t.text}</span><button type="button" class="ads-act good" data-tip="${i}">✅ हे करा</button></div>`).join('')}</div>`
      : '<p class="lv-adv-none">💡 अजून बदल सुचवण्याइतका data नाही (प्रत्येक ad वर किमान ₹300 आणि ad set 3 दिवस जुना हवा) — Meta स्वतः ad set मधल्या चांगल्या ad ला जास्त पैसा देत आहे.</p>';
    box.querySelectorAll('[data-tip]').forEach(btn => btn.addEventListener('click', () => _sure(btn, async () => {
      for (const a of tips[Number(btn.dataset.tip)].acts) await API.metaAction({ ...a, ...(a.action === 'set_budget' ? { big: true } : {}) });
      APP.toast('✅ सल्ल्याप्रमाणे बदल केले', 'success');
    }, 'पक्कं? पुन्हा दाबा (Meta मध्ये लगेच बदलेल)')));
  }

  // ── panel ──
  // ads the admin un-ticked under "Video download" (per class, so another class starts with all ticked)
  const _untick = new Set();
  const _tickKey = k => `${isTeacher(_audOf(k)) ? 't' : st.batch}|${k}`;
  const _recPicked = () => [...document.querySelectorAll('.ads-var-rec')].filter(c => c.checked && !c.disabled).map(c => c.value);
  function _paintPicked() {
    const n = _recPicked().length, fm = [...document.querySelectorAll('.ads-fmt-rec')].filter(c => c.checked).length;
    if ($('ads-rec')) $('ads-rec').textContent = n && fm ? `🎬 निवडलेले ${n * fm} video बनवा (${n} ads × ${fm} आकार)` : '🎬 निवडलेले video बनवा';
    if ($('ads-meta-send-all')) $('ads-meta-send-all').textContent = n ? `📤 खाली खूण केलेल्या ${n} ads च पाठवा` : '📤 खाली खूण केलेल्या ads पाठवा';
  }
  function _paintSide() {
    const f = _facts(), V = _variants(f);
    const mine = Object.entries(V).filter(([, a]) => a.aud === st.aud && (a.custom || isTeacher(st.aud) || (a.kind || 'comp') === st.kind));
    if (!V[st.v] || V[st.v].aud !== st.aud || (!V[st.v].ok && !V[st.v].custom) || (!V[st.v].custom && !isTeacher(st.aud) && (V[st.v].kind || 'comp') !== st.kind)) st.v = (mine.find(([, a]) => a.ok) || mine[0])[0];
    document.querySelectorAll('.ads-aud').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.aud === st.aud)); const sm = b.querySelector('small'); if (sm) sm.textContent = `बजेट ${_share(b.dataset.aud)}%`; });
    _paintBudget();
    $('ads-variants').innerHTML = mine.map(([k, a]) => `<button type="button" class="ads-var" data-v="${k}" aria-pressed="${k === st.v}" ${a.ok ? '' : 'disabled'} title="${_esc(a.ok ? '' : a.why)}"><b>${a.name}</b><small>${a.ok ? (st.v === k ? '▶ पाहत आहात' : '') : _esc(a.why)}</small></button>`).join('');
    // the admin's ticks survive every repaint (they were reset to "all" on each click before)
    $('ads-recvars').innerHTML = mine.map(([k, a]) => `<label><input type="checkbox" class="ads-var-rec" value="${k}" ${a.ok ? (_untick.has(_tickKey(k)) ? '' : 'checked') : 'disabled'} /> ${_esc(a.name)}</label>`).join(' ');
    _paintPicked();
    const teach = isTeacher(st.aud);
    $('ads-class-row').hidden = teach;
    $('ads-teacher-warn').hidden = !teach;
    const tl = $('ads-teacher-warn').querySelector('a'); if (tl) tl.href = `../partner-terms.html?type=${st.aud === 'youtube' ? 'youtube' : 'school'}`;
    $('ads-copy').textContent = adText();
    _paintMetaBox();
    _paintVoice();
    if ($('ads-kind')) $('ads-kind').value = st.kind;
    const R = f.reg;
    if ($('ads-nextq')) $('ads-nextq').hidden = teach || st.kind !== 'comp' || (f.mcqs || []).length < 2;
    $('ads-facts').textContent = teach ? `Commission (Admin › Partners): School ${f.pct}% · YouTube ₹${f.flat} प्रति paid student`
      : st.kind === 'reg' ? (_content[st.batch] ? (R.has ? `${R.subs.length} विषय (${R.subs.map(s => s.subject).join(', ')}) · ${R.notes} Notes · ${R.answers} स्वाध्याय उत्तरं${R.note ? ' · Notes demo: ' + R.note.chapter : ''}${R.ex ? ' · स्वाध्याय demo: ' + R.ex.chapter : ''}` : 'या class मध्ये अजून Notes / स्वाध्याय उत्तरं नाहीत') : '⏳ उघडत आहे…')
      : [`Free tests: ${f.freeTests}`, f.days !== null ? `परीक्षा: ${f.days} दिवस` : 'परीक्षेची तारीख नाही',
        !f.loaded ? '⏳ उघडत आहे…' : f.trio ? `3 प्रश्न: ${f.trio.map(m => m.subject || '—').join(' → ')} (free test मधले खरे)` : f.mcq ? `प्रश्न ${((st.qi || 0) % f.mcqs.length) + 1}/${f.mcqs.length} (free test मधला खरा)` : f.matType ? 'प्रश्न: आकृतीचा नमुना (free test मध्ये योग्य प्रश्न नाही)' : 'ad साठी योग्य प्रश्न नाही',
        f.site ? `🗺️ ${f.site.name}` : '🗺️ Site / Exams मध्ये जोडलेली नाही', f.players ? `महा-Test: ${f.players} मुलं, topper ${f.topScore}${f.topName ? ' (' + f.topName + ')' : ''}` : 'महा-Test result नाही'].join(' · ');
  }
  // the 🎤 line: this ad's voice (if any) and whether it fits the video
  function _paintVoice() {
    const m = $('ads-voice-msg'), del = $('ads-voice-del'); if (!m) return;
    const vo = _voice[adId()], len = lengthOf(_variants(_facts())[st.v]) / 1000;
    del.hidden = !vo;
    m.textContent = !vo ? 'आवाज phone वर रेकॉर्ड करा (उदा. "NMMS ला फक्त 45 दिवस बाकी…") — असेल तर music आपोआप हळू होतं.'
      : `🎤 ${vo.name} · ${vo.secs.toFixed(1)} सेकंद${vo.secs > len - .4 ? ` ⚠️ video ${len.toFixed(0)} सेकंदांचा आहे — शेवटचा भाग कापला जाईल` : ' ✅'}`;
  }
  function _paintBudget() {
    const total = Math.max(0, Number($('ads-budget')?.value) || 0);
    $('ads-split').innerHTML = Object.entries(AUD).map(([k, a]) => `<span class="ads-split-i">${a.name}: <b>${_share(k)}%${total ? ` = ₹${Math.round(total * _share(k) / 100)}` : ''}</b></span>`).join('') + (_senior() ? ' <small>(11वी–12वी: विद्यार्थी स्वतः ठरवतात, म्हणून त्यांचा वाटा जास्त)</small>' : '');
  }
  let _raf = 0;
  function _loop(now) {
    _raf = requestAnimationFrame(_loop);
    if (!cv || !cv.isConnected || st.rec) { if (st.rec) drawAt(now - st.t0); return; }
    const f = _facts(), V = _variants(f);
    // the shown video was removed (a draft saved / deleted): show this audience's first ad instead
    if (!V[st.v]) { st.v = Object.keys(V).find(k => V[k].aud === st.aud && V[k].ok) || 'loss'; st.t0 = now; }
    const len = lengthOf(V[st.v]);
    drawAt(st.paused ? st.pausedAt : (now - st.t0) % len);
  }
  async function _downloadSelected() {
    const btn = $('ads-rec'), msg = $('ads-msg');
    const fmts = [...document.querySelectorAll('.ads-fmt-rec')].filter(c => c.checked).map(c => c.value);
    const vars = _recPicked();
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

  // ── 🎬 माझा video: prompt → paste the AI's JSON → check → preview → save ──
  const SHOTS_KEY = 'ad_shots';   // { sid: { scene index: dataURL } } on this device (never uploaded)
  let _editing = '';               // the saved script being edited ('' = a new one)
  async function _loadScripts() {
    try {
      const list = await API.adScripts();
      _scripts.length = 0; for (const v of list) _scripts.push({ sid: v.sid, raw: v.raw, at: v.at });
    } catch { /* offline: keep what we have */ }
    const saved = (await DB.getSetting(SHOTS_KEY, {}).catch(() => ({}))) || {};
    for (const [sid, m] of Object.entries(saved)) for (const [i, url] of Object.entries(m || {})) {
      const img = new Image(); img.src = url; (_shots[sid] = _shots[sid] || {})[i] = img;
    }
    _paintVidList();
  }
  function _vidMsg(results) {
    const box = $('vid-msg'); if (!box) return;
    if (!results || !results.length) { box.innerHTML = ''; return; }
    const many = results.length > 1;
    box.innerHTML = results.map(({ r, sid }, k) => {
      const head = many ? `<button type="button" class="ads-mini" data-vid-peek="${sid}">▶ Video ${k + 1}</button> ` : '';
      return `<div class="vid-one">${head}` + (r.errors.length
        ? `<div class="vid-bad"><b>❌ ${many ? `Video ${k + 1}: ` : ''}${r.errors.length} चुका — AI ला सांगा किंवा हाताने दुरुस्त करा:</b><ul>${r.errors.map(e => `<li>${_esc(e)}</li>`).join('')}</ul></div>`
        : `<span class="vid-ok">✅ ${many ? `Video ${k + 1} · ` : ''}${_esc(r.script.title)} — ${r.script.scenes.length} scenes · ≈ ${Math.round(r.ms / 1000)} सेकंद · ${_esc(r.script.audience)} · ${_esc(r.script.style.theme)} / ${_esc(r.script.style.pace)} / ${_esc(r.script.style.music)}</span>`)
        + (r.warnings.length ? `<div class="vid-warn"><b>⚠️ लक्षात घ्या:</b><ul>${r.warnings.map(e => `<li>${_esc(e)}</li>`).join('')}</ul></div>` : '') + '</div>';
    }).join('');
    box.querySelectorAll('[data-vid-peek]').forEach(b => b.addEventListener('click', () => _showVid(b.dataset.vidPeek)));
  }
  function _showVid(sid) {
    const a = _scriptVariants(_facts())['s:' + sid]; if (!a) return;
    st.aud = a.aud; st.v = 's:' + sid; st.t0 = performance.now(); st.paused = false; _paintSide();
  }
  // screenshot scenes: a file picker for each (kept on this device only)
  function _paintShots(items) {
    const box = $('vid-shots'); if (!box) return;
    const many = items.length > 1;
    box.innerHTML = items.flatMap(({ sid, r }, k) => (r?.script?.scenes || []).map((sc, i) => ({ sc, i })).filter(o => o.sc.type === 'screenshot')
      .map(({ sc, i }) => `<label class="vid-shot">🖼️ ${many ? `Video ${k + 1} · ` : ''}Scene ${i + 1}${sc.note ? ' — ' + _esc(sc.note) : ''}: ${_shots[sid]?.[i] ? '✅ जोडला' : '<b>screenshot जोडा</b>'} <input type="file" accept="image/*" data-shot-sid="${sid}" data-shot="${i}" /></label>`)).join('');
    box.querySelectorAll('[data-shot]').forEach(inp => inp.addEventListener('change', async () => {
      const file = inp.files?.[0]; if (!file) return;
      const url = await _shrink(file).catch(() => '');
      if (!url) { APP.toast('हे चित्र उघडलं नाही', 'error'); return; }
      const sid = inp.dataset.shotSid, img = new Image(); img.src = url; await img.decode().catch(() => {});
      (_shots[sid] = _shots[sid] || {})[inp.dataset.shot] = img;
      const saved = (await DB.getSetting(SHOTS_KEY, {}).catch(() => ({}))) || {};
      (saved[sid] = saved[sid] || {})[inp.dataset.shot] = url;
      await DB.setSetting(SHOTS_KEY, saved).catch(() => {});
      _vidCheck(false); _showVid(sid);
    }));
  }
  // a phone screenshot, made small (≤ 720 px wide JPEG) before it is kept
  function _shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const r = Math.min(1, 720 / img.naturalWidth), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', .85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }
  // check what is in the box (one video, or { videos: [ … ] }); show the first right one on the canvas
  function _vidCheck(show = true) {
    const raw = $('vid-in').value.trim();
    for (let i = _scripts.length - 1; i >= 0; i--) if (_scripts[i].draft) _scripts.splice(i, 1);
    if (!raw) { _vidMsg(null); $('vid-shots').innerHTML = ''; return []; }
    const parts = _editing ? [AD_SCRIPT.split(raw)[0]] : AD_SCRIPT.split(raw);
    _parsed.clear();
    const items = parts.map((part, k) => {
      const sid = _editing || 'draft' + k;
      const i = _scripts.findIndex(x => x.sid === sid);
      if (i >= 0) _scripts[i].raw = part; else _scripts.push({ sid, raw: part, draft: !_editing });
      return { sid, part, r: _scriptOf(sid, _facts()) };
    });
    _vidMsg(items); _paintShots(items);
    const first = items.find(o => o.r?.ok) || items[0];
    if (show && first?.r?.script) _showVid(first.sid);
    return items;
  }
  async function _vidSave() {
    const items = _vidCheck(false);
    if (!items.length) { $('vid-msg').textContent = 'आधी AI चं उत्तर paste करा'; return; }
    const good = items.filter(o => o.r?.ok);
    if (!good.length) { APP.toast('आधी चुका दुरुस्त करा', 'error'); return; }
    const bad = items.length - good.length;
    try {
      const saved = (await DB.getSetting(SHOTS_KEY, {}).catch(() => ({}))) || {};
      const sids = [];
      for (const o of good) {
        const out = await API.adScriptSave({ sid: _editing || undefined, raw: o.part });
        sids.push(out.sid);
        // a draft's screenshots move to the saved id
        if (!_editing && _shots[o.sid]) { _shots[out.sid] = _shots[o.sid]; delete _shots[o.sid]; }
        if (!_editing && saved[o.sid]) { saved[out.sid] = saved[o.sid]; delete saved[o.sid]; }
      }
      await DB.setSetting(SHOTS_KEY, saved).catch(() => {});
      for (let i = _scripts.length - 1; i >= 0; i--) if (_scripts[i].draft) _scripts.splice(i, 1);
      if (_editing) _editing = sids[0];
      _picked.clear(); sids.forEach(s0 => _picked.add(s0));
      await _loadScripts();
      _showVid(sids[0]);
      APP.toast(`💾 ${sids.length} video save केले${bad ? ` (${bad} मध्ये चुका होत्या — ते राहिले)` : ''} — खाली खूण केलेले आहेत: Meta ला पाठवा / Download`, 'success');
    } catch (err) { APP.toast(err?.message || 'Save झालं नाही', 'error'); }
  }
  // the saved videos: ▶ / ✏️ / 🗑, and a tick to send / download several together
  const _picked = new Set();
  function _paintVidList() {
    const box = $('vid-list'); if (!box) return;
    const f = _facts(), V = _scriptVariants(f);
    const saved = _scripts.filter(x => !x.draft);
    for (const s0 of [..._picked]) if (!saved.some(x => x.sid === s0)) _picked.delete(s0);
    box.innerHTML = saved.length ? saved.map(x => {
      const a = V['s:' + x.sid]; if (!a) return '';
      return `<div class="vid-item"><input type="checkbox" data-vid-pick="${x.sid}" ${_picked.has(x.sid) ? 'checked' : ''} ${a.ok ? '' : 'disabled'} aria-label="निवडा" />
        <span><b>${_esc(a.name)}</b> <small>${_esc(AUD[a.aud]?.name || a.aud)} · ≈ ${Math.round((a.ms || 0) / 1000)} से · ${_esc(adId('s:' + x.sid))}${a.ok ? '' : ' · ⚠️ ' + _esc(a.why)}</small></span>
        <button type="button" class="ads-mini" data-vid-show="${x.sid}">▶ पाहा</button><button type="button" class="ads-mini" data-vid-edit="${x.sid}">✏️ बदला</button><button type="button" class="ads-mini" data-vid-del="${x.sid}">🗑</button></div>`;
    }).join('') : '<p class="import-hint">अजून save केलेले videos नाहीत.</p>';
    $('vid-set').hidden = !saved.length;
    $('vid-set-n').textContent = _picked.size ? `${_picked.size} निवडले` : 'वरच्या यादीत खूण करा';
    box.querySelectorAll('[data-vid-pick]').forEach(c => c.addEventListener('change', () => { c.checked ? _picked.add(c.dataset.vidPick) : _picked.delete(c.dataset.vidPick); $('vid-set-n').textContent = _picked.size ? `${_picked.size} निवडले` : 'वरच्या यादीत खूण करा'; }));
    box.querySelectorAll('[data-vid-show]').forEach(b => b.addEventListener('click', () => { _showVid(b.dataset.vidShow); $('ads-cv')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    box.querySelectorAll('[data-vid-edit]').forEach(b => b.addEventListener('click', () => { const sc = _scripts.find(x => x.sid === b.dataset.vidEdit); if (!sc) return; _editing = sc.sid; $('vid-in').value = sc.raw; $('ads-vid').open = true; $('vid-editing').textContent = '✏️ बदलत आहात — Save केल्यावर हाच video बदलेल'; _vidCheck(true); }));
    box.querySelectorAll('[data-vid-del]').forEach(b => b.addEventListener('click', async () => {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'पक्कं?'; return; }
      try { await API.adScriptDelete(b.dataset.vidDel); if (_editing === b.dataset.vidDel) _vidNew(); _picked.delete(b.dataset.vidDel); await _loadScripts(); _paintSide(); } catch (err) { APP.toast(err?.message || '', 'error'); }
    }));
  }
  const _pickedKeys = () => [..._picked].map(s0 => 's:' + s0).filter(k => _scriptVariants(_facts())[k]?.ok);
  // the ticked videos → Meta, one after another (same audience = the same ad set), then one "turn all on"
  async function _vidSend() {
    const keys = _pickedKeys(), box = $('vid-set-msg'), btn = $('vid-send');
    if (!keys.length) { box.textContent = 'आधी videos वर खूण करा'; return; }
    if (!_metaOk) { box.textContent = '⚠️ Meta जोडलेलं नाही — खाली leaderboard मध्ये Refresh करून पाहा'; return; }
    btn.disabled = true;
    const done = [];
    for (let i = 0; i < keys.length; i++) {
      box.innerHTML = `⏳ ${i + 1} / ${keys.length}: <b>${_esc(adId(keys[i]))}</b>… (video बनतो आणि जातो — हे tab उघडं ठेवा)`;
      done.push({ id: adId(keys[i]), out: await sendToMeta(keys[i]) });
    }
    btn.disabled = false;
    const made = done.filter(d => d.out && (d.out.created || d.out.exists) && d.out.ad_id);
    box.innerHTML = done.map(d => `${d.out?.created ? '✅' : d.out?.exists ? 'ℹ️' : d.out?.pending ? '⏳' : '⚠️'} ${_esc(d.id)}`).join(' · ')
      + `<br><small>ad set: ${_esc([...new Set(keys.map(k => adsetName(k)))].join(', '))} — Meta चांगल्या video ला आपोआप जास्त दाखवतं</small>`
      + (made.length ? ` <button type="button" class="ads-act good" id="vid-on-all">▶ या ${made.length} ads एकदम चालू करा</button>` : '');
    const on = $('vid-on-all');
    on?.addEventListener('click', async () => {
      if (!on.dataset.sure) { on.dataset.sure = '1'; on.textContent = 'पक्कं? पुन्हा दाबा (आजपासून खर्च सुरू)'; return; }
      on.disabled = true; let ok = 0;
      for (const d of made) { try { await API.metaAction({ action: 'resume', ad_id: d.out.ad_id }); ok++; } catch (err) { APP.toast(`${d.id}: ${err?.message || 'चालू झाली नाही'}`, 'error'); } }
      box.innerHTML += `<br>✅ ${ok} ads चालू झाल्या. Meta त्या तपासून (साधारण काही तासांत) दाखवायला सुरू करेल.`; on.remove(); _loadBoard(true);
    });
  }
  // the ticked videos → files, in the sizes ticked under "Video download"
  async function _vidDownload() {
    const keys = _pickedKeys(), box = $('vid-set-msg'), btn = $('vid-dl');
    const fmts = [...document.querySelectorAll('.ads-fmt-rec')].filter(c => c.checked).map(c => c.value);
    if (!keys.length) { box.textContent = 'आधी videos वर खूण करा'; return; }
    if (!fmts.length) { box.textContent = 'खाली "Video download" मध्ये किमान एक आकार निवडा'; return; }
    btn.disabled = true;
    try {
      let n = 0;
      for (const k of keys) for (const fm of fmts) {
        n++; box.textContent = `⏳ video ${n} / ${keys.length * fmts.length} बनत आहे… (हे tab उघडं ठेवा)`;
        const r = await record(k, fm);
        await FILE_EXPORT.saveAndShare(r.blob, r.name);
      }
      box.textContent = `✅ ${n} video download झाले`;
    } catch (err) { box.textContent = err?.message || 'Video बनला नाही'; }
    btn.disabled = false;
  }
  function _vidNew() { _editing = ''; $('vid-in').value = ''; $('vid-editing').textContent = ''; _vidMsg(null); $('vid-shots').innerHTML = ''; for (let i = _scripts.length - 1; i >= 0; i--) if (_scripts[i].draft) _scripts.splice(i, 1); }
  function _vidPrompt() {
    const f = _facts();
    const p0 = AD_SCRIPT.prompt({ want: $('vid-want').value.trim(), audience: st.aud, className: isTeacher(st.aud) ? '' : f.label, values: _phValues(f), count: Number($('vid-count').value) || 1 });
    const done = ok => { $('vid-copied').textContent = ok ? '✅ Copy झालं — ChatGPT / Claude मध्ये paste करा' : 'Copy झालं नाही — खालच्या box मधून copy करा'; if (!ok) { $('vid-in').value = p0; $('vid-in').select(); } };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(p0).then(() => done(true), () => done(false)); else done(false);
  }

  async function init() {
    const host = $('ad-studio'); if (!host) return;
    if (!_ready) {
      _ready = true;
      try { document.fonts?.load('700 40px Kalam', 'a² − b² = 360 सोडवा').catch(() => {}); } catch (e) { /* the pen then writes in the normal font */ }
      host.innerHTML = `
        <h3 class="admin-section-title">📣 Ads — Facebook / Instagram आणि YouTube</h3>
        <div class="ads-plats" role="group" aria-label="कुठे">
          <button type="button" class="ads-plat" data-plat="meta" aria-pressed="true">📘 Facebook / Instagram</button>
          <button type="button" class="ads-plat" data-plat="yt" aria-pressed="false">▶️ YouTube</button>
        </div>
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
          <label>पाहा <select id="ads-fmt" class="admin-input"><option value="916">9:16 Reels / Stories</option><option value="45">4:5 Feed</option><option value="11">1:1</option><option value="169">16:9 YouTube</option></select></label>
        </div>
        <p class="import-hint" id="ads-facts"></p>
        <details class="ads-vid" id="ads-vid">
          <summary>🎬 माझा video — ChatGPT / Claude कडून script, app मध्ये आवाजासह video</summary>
          <ol class="import-hint">
            <li>खाली लिहा तुम्हाला कसा video हवा (कोणासाठी, काय सांगायचं, किती सेकंद) → <b>📋 Prompt copy करा</b> → ChatGPT / Claude मध्ये paste.</li>
            <li>AI चं पूर्ण उत्तर खालच्या box मध्ये paste करा → <b>✅ तपासा आणि पाहा</b>. चुका असतील तर app सांगतो.</li>
            <li>आवडला तर <b>💾 Save</b> — मग तो ads च्या यादीत येतो: Download, Meta ला पाठवा, YouTube kit, leaderboard सगळं तसंच.</li>
          </ol>
          <p class="import-hint">आकडे (commission, सूट, free tests, दिवस) AI लिहीत नाही — <code>{ }</code> खुणा app स्वतः खऱ्या आकड्यांनी भरतो.</p>
          <textarea id="vid-want" class="admin-input" rows="2" placeholder="उदा. YouTube शिक्षकांसाठी 20 सेकंदांचा video: स्वतःचं panel, subscribers ना सूट, प्रत्येक paid मागे कमाई"></textarea>
          <div class="site-btns"><label class="ads-target">किती videos <select id="vid-count" class="admin-input"><option value="1">1</option><option value="3" selected>3 (A/B साठी)</option></select></label>
            <button type="button" class="admin-btn-secondary" id="vid-prompt">📋 Prompt copy करा</button><span id="vid-copied" class="import-hint"></span></div>
          <textarea id="vid-in" class="admin-input" rows="8" placeholder="AI चं उत्तर (JSON) इथे paste करा"></textarea>
          <p class="import-hint" id="vid-editing"></p>
          <div class="site-btns">
            <button type="button" class="admin-btn-primary" id="vid-check">✅ तपासा आणि पाहा</button>
            <button type="button" class="admin-btn-primary" id="vid-save">💾 Save</button>
            <button type="button" class="admin-btn-secondary" id="vid-new">+ नवीन</button>
          </div>
          <div id="vid-msg"></div>
          <div id="vid-shots"></div>
          <h5 class="ads-aud-h">💾 Save केलेले videos</h5>
          <div id="vid-list"></div>
          <div class="vid-set" id="vid-set" hidden>
            <b id="vid-set-n"></b>
            <button type="button" class="admin-btn-primary" id="vid-send">📤 निवडलेले Meta ला पाठवा (एकाच ad set मध्ये, बंद स्थितीत)</button>
            <button type="button" class="admin-btn-secondary" id="vid-dl">⬇ निवडलेले Download</button>
            <p class="import-hint">Meta: बजेट / वय वरच्या "📤 Meta वर पाठवा" box मधले वापरले जातात. Download: खाली "Video download" मध्ये खूण केलेले आकार.</p>
            <p class="import-hint" id="vid-set-msg"></p>
          </div>
        </details>
        <button type="button" class="admin-btn-secondary" id="ads-nextq" hidden>🔄 दुसरा प्रश्न</button>
        <div class="ads-vars" id="ads-variants" role="group" aria-label="Ads"></div>
        <div class="ads-stage">
          <canvas id="ads-cv" width="1080" height="1920" aria-label="Ad preview"></canvas>
          <div class="ads-side">
            <pre class="gxa-msg" id="ads-copy"></pre>
            <div class="admin-toolbar"><button type="button" class="admin-btn-secondary" id="ads-copy-btn">📋 मजकूर Copy</button></div>
            <div class="ads-recbox ads-soundbox">
              <b>🔊 आवाज</b>
              <label><input type="checkbox" id="ads-sound" checked /> सगळ्या video मध्ये music + आवाज (Facebook, Instagram, YouTube)</label>
              <button type="button" class="admin-btn-secondary" id="ads-play">▶ आवाजासह पाहा</button>
              <div class="ads-mix">
                <label>🎵 Background music <input type="range" min="0" max="150" step="5" data-mix="bed" /> <output data-mix-out="bed"></output></label>
                <label>✨ Animation आवाज <input type="range" min="0" max="150" step="5" data-mix="anim" /> <output data-mix-out="anim"></output></label>
                <label>🎤 माझा आवाज <input type="range" min="0" max="150" step="5" data-mix="voice" /> <output data-mix-out="voice"></output></label>
              </div>
              <label class="ads-voice">🎤 माझा आवाज (या ad साठी, ऐच्छिक) <input type="file" id="ads-voice" accept="audio/*" /></label>
              <small id="ads-voice-msg" class="import-hint">आवाज phone वर रेकॉर्ड करा (उदा. "NMMS ला फक्त 45 दिवस बाकी…") — असेल तर music आपोआप हळू होतं.</small>
              <button type="button" class="admin-btn-secondary" id="ads-voice-del" hidden>✕ आवाज काढा</button>
            </div>
            <div class="ads-recbox ads-metabox" id="ads-metabox" hidden>
              <b>📤 Meta वर पाठवा</b>
              <small id="ads-meta-name"></small>
              <label>या ad set चं रोजचं बजेट ₹ <input id="ads-meta-budget" type="number" min="100" step="50" class="admin-input" /></label>
              <label>वय <input id="ads-meta-age-min" type="number" min="13" max="65" class="admin-input ads-age" aria-label="किमान वय" /> ते <input id="ads-meta-age-max" type="number" min="13" max="65" class="admin-input ads-age" aria-label="कमाल वय" /></label>
              <small class="ads-age-note">वय आणि बजेट नवीन ad set बनताना लागतात — तो ad set आधीच बनला असेल तर Ads Manager मध्ये बदला.</small>
              <button type="button" class="admin-btn-primary" id="ads-meta-send">📤 ही ad Meta वर पाठवा (बंद स्थितीत)</button>
              <button type="button" class="admin-btn-secondary" id="ads-meta-send-all">📤 खाली खूण केलेल्या सगळ्या ads पाठवा</button>
              <div id="ads-meta-bulk" class="import-hint"></div>
              <p class="import-hint" id="ads-meta-msg">9:16 video इथे बनतो आणि Meta वर जातो. Ad <b>बंद (Paused)</b> बनते — Ads Manager मध्ये तपासून तुम्ही चालू करायची.</p>
            </div>
            <div class="ads-recbox ads-ytbox" id="ads-ytbox" hidden>
              <b>▶️ YouTube ad</b>
              <small id="ads-yt-name"></small>
              <button type="button" class="admin-btn-primary" id="ads-yt-rec">🎬 16:9 + 9:16 (Shorts) video बनवा</button>
              <ol class="import-hint">
                <li>दोन्ही video YouTube Studio मध्ये <b>Unlisted</b> म्हणून upload करा (title वरच्या मजकुरात).</li>
                <li>Google Ads › नवीन Video campaign: ad चं <b>नाव = ad id</b>, Final URL = वरचा link (त्यात <code>ad=yt-…</code> आहे — त्यावरून आकडे जुळतात).</li>
                <li>Google Ads जोडलं (Render मध्ये GOOGLE_ADS_*) की खर्च / views आपोआप खाली येतात; तोपर्यंत खर्च हाताने लिहा.</li>
              </ol>
              <p class="import-hint" id="ads-yt-msg"></p>
            </div>
            <div class="ads-recbox">
              <b>📥 Video download</b>
              <div id="ads-recvars"></div>
              <div><label><input type="checkbox" class="ads-fmt-rec" value="916" checked /> 9:16</label> <label><input type="checkbox" class="ads-fmt-rec" value="45" checked /> 4:5</label> <label><input type="checkbox" class="ads-fmt-rec" value="11" /> 1:1</label> <label><input type="checkbox" class="ads-fmt-rec" value="169" /> 16:9 YouTube</label></div>
              <button type="button" class="admin-btn-primary" id="ads-rec">🎬 निवडलेले video बनवा</button>
              <p class="import-hint" id="ads-msg">प्रत्येक video त्याच्या लांबीइतका (≈20 सेकंद) वेळ घेतो.</p>
            </div>
          </div>
        </div>
        <div id="ads-live" class="ads-live" hidden></div>
        <h4 class="admin-section-title" style="margin-top:14px">🏁 कोणती ad जिंकतेय?</h4>
        <div class="admin-toolbar"><select id="ads-days" class="admin-input" aria-label="दिवस"><option value="7">7 दिवस</option><option value="30" selected>30 दिवस</option></select><button type="button" class="admin-btn-secondary" id="ads-refresh">Refresh</button>
          <label class="ads-target">लक्ष्य: ₹ <input id="ads-tgt-test" type="number" min="1" step="5" class="admin-input" aria-label="एका test चा खर्च" /> / test</label>
          <label class="ads-target">₹ <input id="ads-tgt-paid" type="number" min="1" step="50" class="admin-input" aria-label="एका paid चा खर्च" /> / paid</label></div>
        <p class="import-hint">लक्ष्य = एका test देणाऱ्यासाठी / एका pay करणाऱ्यासाठी किती खर्च चालेल. एकटी ad (उदा. फक्त NMMS) याच लक्ष्याशी तपासली जाते.</p>
        <div id="ads-board"></div>
        <h4 class="admin-section-title" style="margin-top:14px">🔗 Ads चालवण्याच्या links</h4>
        <div class="ads-links">${ADS_LINKS.map(([n, u]) => `<div class="ads-link"><span>${n}</span><a href="${u}" target="_blank" rel="noopener">उघडा ↗</a><button type="button" class="admin-btn-secondary" data-copy="${u}">📋 Copy</button></div>`).join('')}</div>`;
      cv = $('ads-cv'); x = cv.getContext('2d');
      $('ads-batch').addEventListener('change', e => { st.batch = e.target.value; st.label = ''; $('ads-label').value = _defaultLabel(); _setBatchKind(); });
      $('ads-kind').addEventListener('change', async e => {
        _kinds[st.batch] = e.target.value;
        await DB.setSetting(KIND_KEY, _kinds).catch(() => {});
        _setBatchKind();
      });
      $('ads-label').addEventListener('input', e => { st.label = e.target.value.trim(); _paintSide(); });
      $('ads-nextq').addEventListener('click', () => { st.qi = (st.qi || 0) + 1; st.t0 = performance.now(); _paintSide(); });
      $('ads-lang').addEventListener('change', e => { st.lang = e.target.value; _paintSide(); });
      $('ads-fmt').addEventListener('change', e => { st.fmt = e.target.value; });
      host.querySelectorAll('.ads-aud').forEach(b => b.addEventListener('click', () => { st.aud = b.dataset.aud; st.t0 = performance.now(); _paintSide(); }));
      host.querySelectorAll('.ads-plat').forEach(b => b.addEventListener('click', () => {
        st.plat = b.dataset.plat;
        host.querySelectorAll('.ads-plat').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
        st.fmt = st.plat === 'yt' ? '169' : '916'; $('ads-fmt').value = st.fmt; st.t0 = performance.now();
        _paintSide();
      }));
      $('ads-yt-rec').addEventListener('click', async () => {
        const btn = $('ads-yt-rec'), msg = $('ads-yt-msg');
        btn.disabled = true;
        try {
          for (const [i, fm] of [['1', '169'], ['2', '916']]) {
            msg.textContent = `⏳ video ${i} / 2 बनत आहे… (हे tab उघडं ठेवा)`;
            const r = await record(st.v, fm);
            await FILE_EXPORT.saveAndShare(r.blob, r.name);
            if (r.ext !== 'mp4') msg.textContent = 'हा browser WebM देतो — Chrome / Edge वापरा';
          }
          msg.textContent = '✅ दोन्ही video download झाले — आता YouTube Studio मध्ये upload करा';
        } catch (err) { msg.textContent = err?.message || 'Video बनला नाही'; }
        btn.disabled = false;
      });
      $('ads-budget').addEventListener('input', () => { _paintBudget(); _paintMetaBox(); });
      _paintBudget();
      $('ads-variants').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || b.disabled) return; st.v = b.dataset.v; st.t0 = performance.now(); _paintSide(); });
      $('ads-copy-btn').addEventListener('click', () => { navigator.clipboard?.writeText(adText()).catch(() => {}); APP.toast('Copied!', 'success'); });
      $('ads-rec').addEventListener('click', _downloadSelected);
      $('ads-recvars').addEventListener('change', e => { const c = e.target.closest('.ads-var-rec'); if (!c) return; const k = _tickKey(c.value); if (c.checked) _untick.delete(k); else _untick.add(k); _paintPicked(); });
      host.querySelectorAll('.ads-fmt-rec').forEach(c => c.addEventListener('change', _paintPicked));
      $('vid-prompt').addEventListener('click', _vidPrompt);
      $('vid-check').addEventListener('click', () => _vidCheck(true));
      $('vid-save').addEventListener('click', _vidSave);
      $('vid-new').addEventListener('click', () => { _vidNew(); _paintSide(); });
      $('vid-send').addEventListener('click', _vidSend);
      $('vid-dl').addEventListener('click', _vidDownload);
      host.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copy).then(() => APP.toast('Link copy झाली', 'success'), () => APP.toast(b.dataset.copy, 'info')); }));
      $('ads-sound').addEventListener('change', e => { st.sound = e.target.checked; });
      Object.assign(_mix, (await DB.getSetting(MIX_KEY, null).catch(() => null)) || {});
      host.querySelectorAll('[data-mix]').forEach(r => {
        const k = r.dataset.mix, out = host.querySelector(`[data-mix-out="${k}"]`);
        r.value = Math.round(_mix[k] * 100); out.textContent = r.value + '%';
        r.addEventListener('input', () => { _mix[k] = Number(r.value) / 100; out.textContent = r.value + '%'; });
        r.addEventListener('change', () => DB.setSetting(MIX_KEY, { ..._mix }).catch(() => {}));
      });
      $('ads-play').addEventListener('click', () => playWithSound().catch(err => APP.toast(err?.message || 'आवाज चालला नाही', 'error')));
      $('ads-voice').addEventListener('change', async e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 15 * 1024 * 1024) { $('ads-voice-msg').textContent = '⚠️ File 15 MB पेक्षा मोठी आहे'; return; }
        const buf = await file.arrayBuffer(), id = adId();
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const decoded = await ctx.decodeAudioData(buf.slice(0)); ctx.close().catch(() => {});
          _voice[id] = { buf, name: file.name, secs: decoded.duration, decoded };
        } catch { $('ads-voice-msg').textContent = '⚠️ ही audio file उघडली नाही — MP3 / M4A / WAV वापरा'; return; }
        e.target.value = '';
        _paintVoice();
      });
      $('ads-voice-del').addEventListener('click', () => { delete _voice[adId()]; _paintVoice(); });
      $('ads-meta-send').addEventListener('click', () => sendToMeta());
      $('ads-meta-send-all').addEventListener('click', sendAllToMeta);
      $('ads-meta-budget').addEventListener('input', e => { e.target.dataset.touched = '1'; });
      $('ads-refresh').addEventListener('click', () => _loadBoard(true));
      $('ads-days').addEventListener('change', () => _loadBoard());
      for (const k of ['test', 'paid']) $('ads-tgt-' + k).addEventListener('change', async e => {
        _targets[k] = Math.max(1, Number(e.target.value) || _targets[k]);
        await DB.setSetting(TARGET_KEY, _targets).catch(() => {});
        _loadBoard();
      });
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
    Object.assign(_targets, (await DB.getSetting(TARGET_KEY, null).catch(() => null)) || {});
    $('ads-tgt-test').value = _targets.test; $('ads-tgt-paid').value = _targets.paid;
    _setBatchKind();
    _loadBoard();
    _loadScripts().then(() => _paintSide());
  }
  // the class's kind (guessed / chosen) and, for a regular class, its real content
  function _setBatchKind() {
    st.kind = _kindOf(st.batch);
    st.t0 = performance.now();
    _paintSide();
    if (st.batch && !_content[st.batch]) {
      const b = st.batch;
      API.fetchAdContent(b).then(r => { _content[b] = r || { subjects: [] }; if (st.batch === b) { st.qi = 0; _paintSide(); } })
        .catch(() => { _content[b] = { subjects: [] }; if (st.batch === b) _paintSide(); });
    }
  }
  // "8th NMMS EXAM 26-27 BATCH" → "8th NMMS"
  function _defaultLabel() { return String(st.batch || '').replace(/\b(batch|exam|class)\b/gi, '').replace(/\d{2}\s*-\s*\d{2}/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }

  return { init, verdicts, adLink, adText, adParts, record, drawAt, sendToMeta, sendAllToMeta, audioPlan, playWithSound, __mix: _mix, __score: (...a) => _score(...a), __scripts: _scripts, __shots: _shots, __phValues: () => _phValues(_facts()), __st: st, __content: _content, __voice: _voice };
})();

window.AD_STUDIO = AD_STUDIO;
