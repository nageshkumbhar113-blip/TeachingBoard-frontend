/* ════════════════════════════════════════
   adScript.js — Admin › Ads › 🎬 माझा video: the script format
   Global: AD_SCRIPT   (also require()-able, for tests)

   The admin asks ChatGPT / Claude for a video in this JSON format (the prompt is built here),
   pastes the answer, and Ad Studio draws + records it with our animation and sound.
   This file has no drawing: it reads the answer, checks it, fills the { } placeholders with the
   app's real numbers (commission, discount, free tests, days left…) and times the scenes.
   A number the AI wrote itself is never trusted for money: commission / discount must come
   through a placeholder.
════════════════════════════════════════ */

(function (root) {
  // scene types → fields (max letters), and the base length in ms
  const TYPES = {
    hook:       { need: ['text'], text: { text: 40, sub: 45 }, ms: () => 3000 },
    points:     { need: ['title', 'items'], text: { title: 32 }, list: { items: [1, 4, 30] }, ms: s => Math.min(5000, 1300 + 750 * (s.items?.length || 0)) },
    number:     { need: ['value', 'label'], text: { label: 45, prefix: 4, suffix: 6 }, ms: () => 3200 },
    question:   { need: [], text: { q: 110, why: 120 }, list: { options: [4, 4, 26] }, ms: () => 8000 },
    steps:      { need: ['items'], list: { items: [2, 4, 24] }, ms: s => 1000 + 800 * (s.items?.length || 0) },
    compare:    { need: ['before', 'after'], text: { before: 45, after: 45, title: 32 }, ms: () => 3800 },
    quote:      { need: ['text'], text: { text: 90 }, ms: () => 3600 },
    app:        { need: ['screen'], text: { caption: 45 }, ms: () => 3800 },
    screenshot: { need: [], text: { caption: 45, note: 60 }, ms: () => 3800 },
    cta:        { need: ['text'], text: { text: 32, button: 22 }, ms: () => 4000 },
  };
  const SCREENS = ['notes', 'exercise', 'test', 'rank', 'subjects', 'smartboard', 'offline'];
  const AUDIENCES = ['parent', 'student', 'school', 'youtube'];
  const THEMES = ['violet', 'orange', 'green', 'dark'];
  const PACES = { fast: 0.85, normal: 1, calm: 1.15 };
  const MUSIC = ['energetic', 'light'];
  const RECIPES = {
    1: { name: 'कमाई / फायदा', order: ['hook', 'points', 'number', 'app', 'steps', 'cta'] },
    2: { name: 'प्रश्न-आव्हान', order: ['hook', 'question', 'app', 'number', 'cta'] },
    3: { name: 'आधी / आता', order: ['hook', 'compare', 'points', 'app', 'cta'] },
  };
  // the placeholders the app fills from its own settings / data
  const PLACEHOLDERS = {
    youtube_commission: 'YouTube शिक्षकाला प्रत्येक paid student मागे ₹ (Admin › Partners)',
    school_commission: 'School शिक्षकाला commission % (Admin › Partners)',
    student_discount: 'YouTube subscriber students ना पहिल्या payment वर सूट % (Admin › Partners)',
    free_tests: 'निवडलेल्या class चे free tests',
    days_left: 'परीक्षेला दिवस बाकी (Sync / Site › Exams मधली तारीख)',
    offer_percent: 'Free test नंतर पहिल्या महिन्यावर सूट %',
    exam_name: 'परीक्षेचं नाव (Site › Exams)',
    class_name: 'Ad मधलं class चं नाव',
  };
  const MONEY_WORDS = /commission|कमिशन|कमाई|सूट|discount|%|₹|रुपये/i;

  const str = v => (v === undefined || v === null ? '' : String(v)).trim();
  const letters = s => [...String(s)].length;

  // the JSON inside whatever the AI wrote around it (``` fences, a sentence before…)
  function extract(raw) {
    const t = String(raw || '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('उत्तरात JSON सापडला नाही. AI ला सांगा: "फक्त JSON दे".');
    try { return JSON.parse(t.slice(a, b + 1)); }
    catch (e) { throw new Error('JSON चुकीचा आहे (' + e.message.replace(/^.*?:\s*/, '') + '). AI ला सांगा: "valid JSON दे".'); }
  }

  // replace {name} with the app's value; unknown / missing names are errors
  function fillText(s, values, where, errors) {
    return String(s).replace(/\{([a-z_]+)\}/g, (m, k) => {
      if (!(k in PLACEHOLDERS)) { errors.push(`${where}: "{${k}}" ही खूण app ला माहीत नाही`); return m; }
      const v = values?.[k];
      if (v === undefined || v === null || v === '') { errors.push(`${where}: {${k}} ची किंमत app मध्ये नाही (${PLACEHOLDERS[k]})`); return m; }
      return String(v);
    });
  }

  // read + check + fill. Returns { ok, script, errors[], warnings[], ms }
  function parse(raw, values = {}, opts = {}) {
    const errors = [], warnings = [];
    let j;
    try { j = typeof raw === 'string' ? extract(raw) : raw; } catch (e) { return { ok: false, errors: [e.message], warnings, ms: 0 }; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return { ok: false, errors: ['Script एक JSON object हवा ({ … })'], warnings, ms: 0 };
    const out = { title: str(j.title).slice(0, 60) || 'माझा video', audience: str(j.audience), link: str(j.link), recipe: str(j.recipe), style: {}, copy: {}, scenes: [] };
    if (!AUDIENCES.includes(out.audience)) errors.push(`"audience" यापैकी हवं: ${AUDIENCES.join(', ')}`);
    const teacher = out.audience === 'school' || out.audience === 'youtube';
    if (!out.link) out.link = teacher ? 'teacher' : 'free';
    if (!['teacher', 'free'].includes(out.link)) errors.push('"link" हवा: "teacher" (शिक्षकांची नोंदणी) किंवा "free" (class चा free test)');
    else if (teacher !== (out.link === 'teacher')) errors.push(teacher ? 'शिक्षकांच्या video चा "link" = "teacher" हवा' : 'पालक / विद्यार्थ्यांच्या video चा "link" = "free" हवा');
    const st = j.style || {};
    out.style = { theme: THEMES.includes(st.theme) ? st.theme : 'violet', pace: st.pace in PACES ? st.pace : 'normal', music: MUSIC.includes(st.music) ? st.music : 'energetic' };
    if (st.theme && !THEMES.includes(st.theme)) warnings.push(`style.theme "${st.theme}" माहीत नाही — violet वापरला`);
    // the Meta / YouTube text
    const cp = j.copy || {};
    out.copy = { text: fillText(str(cp.text).slice(0, 600), values, 'copy.text', errors), headline: fillText(str(cp.headline).slice(0, 60), values, 'copy.headline', errors) };
    if (!out.copy.text) warnings.push('"copy.text" (ad चा मजकूर) नाही — Meta साठी app स्वतःचा मजकूर वापरेल');

    const scenes = Array.isArray(j.scenes) ? j.scenes : [];
    if (scenes.length < 3) errors.push('किमान 3 scenes हवेत (hook … cta)');
    if (scenes.length > 12) errors.push('जास्तीत जास्त 12 scenes');
    const pace = PACES[out.style.pace];
    scenes.slice(0, 12).forEach((s0, i) => {
      const where = `Scene ${i + 1}`;
      const s = s0 && typeof s0 === 'object' ? s0 : {};
      const T = TYPES[s.type];
      if (!T) { errors.push(`${where}: "type" = "${str(s.type)}" चालत नाही. यापैकी: ${Object.keys(TYPES).join(', ')}`); return; }
      const sc = { type: s.type };
      for (const k of T.need) if (s[k] === undefined || s[k] === null || s[k] === '' || (Array.isArray(s[k]) && !s[k].length)) errors.push(`${where} (${s.type}): "${k}" हवं`);
      for (const [k, max] of Object.entries(T.text || {})) {
        if (s[k] === undefined || s[k] === null || s[k] === '') continue;
        const v = fillText(str(s[k]), values, `${where} ${k}`, errors);
        if (letters(v) > max) warnings.push(`${where} (${s.type}): "${k}" खूप लांब (${letters(v)}/${max} अक्षरं) — screen वर लहान होईल`);
        sc[k] = v;
      }
      for (const [k, [min, maxN, maxL]] of Object.entries(T.list || {})) {
        if (s[k] === undefined) continue;
        if (!Array.isArray(s[k])) { errors.push(`${where} (${s.type}): "${k}" यादी हवी [ … ]`); continue; }
        const l = s[k].map(x => fillText(str(x), values, `${where} ${k}`, errors)).filter(Boolean);
        if (l.length < min || l.length > maxN) errors.push(`${where} (${s.type}): "${k}" मध्ये ${min === maxN ? min : min + '–' + maxN} ओळी हव्यात (${l.length} आहेत)`);
        l.forEach(x => { if (letters(x) > maxL) warnings.push(`${where} (${s.type}): "${x}" खूप लांब (${letters(x)}/${maxL})`); });
        sc[k] = l.slice(0, maxN);
      }
      if (s.type === 'number') {
        const raw0 = str(s.value), filled = fillText(raw0, values, `${where} value`, errors);
        const n = Number(String(filled).replace(/[,₹%\s]/g, ''));
        if (!Number.isFinite(n)) errors.push(`${where} (number): "value" आकडा हवा (किंवा {खूण})`);
        // money / discount numbers only through a placeholder — never a figure the AI made up
        if (!/\{[a-z_]+\}/.test(raw0) && MONEY_WORDS.test(`${s.prefix || ''}${s.suffix || ''}${s.label || ''}`)) errors.push(`${where} (number): पैसे / सूट / commission चा आकडा AI ने लिहायचा नाही — {youtube_commission}, {student_discount} अशी खूण वापरा`);
        else if (!/{[a-z_]+}/.test(raw0)) warnings.push(`${where} (number): ${raw0} हा आकडा AI ने लिहिला आहे — app तो तपासत नाही, खरा आहे ना ते पाहा`);
        sc.value = n;
      }
      if (s.type === 'question') {
        if (s.use === 'class' || (!s.q && !s.options)) sc.use = 'class';   // the class's real free-test question
        else {
          if (!sc.q) errors.push(`${where} (question): "q" हवा (किंवा "use": "class")`);
          const a = Number(s.answer);
          if (!(Number.isInteger(a) && a >= 0 && a <= 3)) errors.push(`${where} (question): "answer" 0 ते 3 हवा (बरोबर पर्यायाचा क्रमांक)`);
          sc.answer = a;
        }
      }
      if (s.type === 'app') {
        if (!SCREENS.includes(s.screen)) errors.push(`${where} (app): "screen" यापैकी हवी: ${SCREENS.join(', ')}`);
        sc.screen = s.screen;
      }
      if (s.type === 'quote' && s.by) warnings.push(`${where} (quote): "by" काढला — quote आपलाच संदेश असतो, कोणाच्या नावाने नाही`);
      // a made-up money figure inside ordinary text
      for (const k of ['text', 'sub', 'label', 'title', 'before', 'after', 'caption']) {
        const rawT = str(s[k]);
        if (/₹\s*\d|\d+\s*%/.test(rawT) && !/\{[a-z_]+\}/.test(rawT)) errors.push(`${where} (${s.type}): "${k}" मध्ये ₹ / % चा आकडा थेट लिहिला आहे — { } खूण वापरा`);
      }
      sc.ms = Math.round(T.ms(sc) * (s.type === 'question' ? 1 : pace));
      out.scenes.push(sc);
    });
    if (out.scenes.length) {
      if (out.scenes[0].type !== 'hook') errors.push('पहिला scene "hook" हवा');
      if (out.scenes[out.scenes.length - 1].type !== 'cta') errors.push('शेवटचा scene "cta" हवा');
    }
    const shots = out.scenes.filter(s => s.type === 'screenshot').length;
    if (shots && opts.shots !== undefined && opts.shots < shots) warnings.push(`${shots - opts.shots} screenshot scene ला अजून चित्र जोडलेलं नाही`);
    const recipe = RECIPES[out.recipe];
    if (out.recipe && !recipe && out.recipe !== 'free') warnings.push(`recipe "${out.recipe}" माहीत नाही`);
    if (recipe) {
      const got = out.scenes.map(s => s.type).join(' → '), want = recipe.order.join(' → ');
      if (got !== want) warnings.push(`recipe ${out.recipe} (${recipe.name}) चा क्रम: ${want} — script: ${got}`);
    }
    const ms = out.scenes.reduce((t, s) => t + s.ms, 0);
    if (ms > 60000) errors.push(`Video ${Math.round(ms / 1000)} सेकंदांचा होतो — 60 पेक्षा कमी हवा (scenes कमी करा)`);
    else if (ms > 30000) warnings.push(`Video ${Math.round(ms / 1000)} सेकंदांचा होतो — ads साठी 15–30 चांगले. "${(out.scenes.find((s, i) => i && s.type !== 'cta' && s.type !== 'question') || {}).type || ''}" सारखा एखादा scene काढा`);
    return { ok: !errors.length, script: out, errors: [...new Set(errors)], warnings: [...new Set(warnings)], ms };
  }

  // the prompt for ChatGPT / Claude
  function prompt({ want = '', audience = '', className = '', values = {}, count = 1 } = {}) {
    const known = Object.entries(PLACEHOLDERS).map(([k, d]) => `  {${k}} — ${d}${values[k] !== undefined && values[k] !== null && values[k] !== '' ? ` (सध्या: ${values[k]})` : ''}`).join('\n');
    const example = {
      title: 'YouTube teachers – स्वतःचं पॅनल + कमाई', audience: 'youtube', link: 'teacher', recipe: '1',
      style: { theme: 'violet', pace: 'normal', music: 'energetic' },
      copy: { text: 'YouTube वर शिकवता? तुमच्या subscribers ना free tests, महा-Test आणि रँक — आणि तुम्हाला प्रत्येक paid student मागे ₹{youtube_commission}. नोंदणी Free.', headline: 'YouTube शिक्षकांसाठी कमाई' },
      scenes: [
        { type: 'hook', text: 'YouTube वर शिकवता?', sub: 'आता कमाई पण!' },
        { type: 'points', title: 'तुम्हाला काय मिळतं?', items: ['स्वतःचं Teacher Panel', 'Subscribers ना सूट', 'प्रत्येक paid मागे कमाई'] },
        { type: 'number', value: '{youtube_commission}', prefix: '₹', label: 'प्रत्येक paid student मागे' },
        { type: 'app', screen: 'smartboard', caption: 'Smart Board + Pen Tools' },
        { type: 'steps', items: ['नोंदणी करा', 'Link share करा', 'कमाई पाहा'] },
        { type: 'cta', text: 'आजच नोंदणी Free', button: '▶ नोंदणी करा' },
      ],
    };
    return [
      'तू NKs EduOrbit (महाराष्ट्रातलं शिक्षण app: Free tests, प्रत्येक उत्तराची युक्ती, दर रविवारी महा-Test व रँक, Notes, स्वाध्याय उत्तरं, Offline) साठी Facebook / Instagram / YouTube ad video चा script लिहितोस.',
      '',
      'मला हवा असलेला video: ' + (want || '(इथे लिहा: कोणासाठी, काय सांगायचं, किती सेकंद)'),
      audience ? 'कोणासाठी (audience): ' + audience : '',
      className ? 'Class: ' + className : '',
      '',
      'नियम (काटेकोर):',
      '1. उत्तरात फक्त valid JSON दे — markdown, ``` किंवा explanation नको.',
      '2. पहिला scene "hook", शेवटचा "cta". मध्ये खालच्यापैकी एक recipe निवड आणि "recipe" मध्ये तिचा नंबर लिही:',
      ...Object.entries(RECIPES).map(([k, r]) => `   ${k} = ${r.name}: ${r.order.join(' → ')}`),
      '   प्रत्येक वेळी वेगळी सुरुवात (hook) आणि वेगळे शब्द वापर — सगळे videos सारखे नकोत.',
      '3. फक्त हे scene types: ' + Object.keys(TYPES).join(', ') + '. नवीन type बनवू नकोस.',
      '   hook {text, sub} · points {title, items[1-4]} · number {value, prefix, suffix, label} · question {q, options[4], answer 0-3, why} किंवा {"use": "class"} (class च्या free test मधला खरा प्रश्न)',
      '   steps {items[2-4]} · compare {before, after} · quote {text} (आपलाच संदेश, कोणाचं नाव नाही) · app {screen, caption} · screenshot {caption, note} · cta {text, button}',
      '   app.screen यापैकी: ' + SCREENS.join(', '),
      '4. एका scene मध्ये थोडे शब्द: hook 40 अक्षरं, points ची प्रत्येक ओळ 30 अक्षरं (4 ओळी पर्यंत), cta 32.',
      '5. एकूण 15–30 सेकंद: 5 ते 7 scenes.',
      '6. पैसे / commission / सूट / free tests / दिवस यांचे आकडे कधीच स्वतः लिहू नकोस — फक्त या खुणा वापर (app खरे आकडे भरतो):',
      known,
      '7. खोटे दावे नकोत: "100% निवड", "सर्वोत्तम", खोटे topper, खोटे पालक / शिक्षक यांचे शब्द नकोत.',
      '8. "style": theme (violet / orange / green / dark), pace (fast / normal / calm), music (energetic / light).',
      '9. "copy": Facebook / Instagram ad चा मजकूर (text, 2-3 ओळी) आणि headline (6 शब्द) — त्यातही आकड्यांसाठी खुणा.',
      '10. audience: parent / student / school / youtube. link: शिक्षकांसाठी "teacher", पालक / विद्यार्थ्यांसाठी "free".',
      '',
      count > 1 ? `11. एकाच विषयावर ${count} वेगळे videos दे (A/B testing साठी): प्रत्येकाची recipe, सुरुवात (hook), शब्द आणि theme वेगळी. उत्तर असं: { "videos": [ {…video 1…}, {…video 2…}${count > 2 ? ', {…video 3…}' : ''} ] }` : '',
      '',
      count > 1 ? 'एका video चं उदाहरण ("videos" यादीतला प्रत्येक video याच format मध्ये, पण माझ्या मागणीनुसार नवीन मजकूर):' : 'हे उदाहरण आहे — याच format मध्ये, पण माझ्या मागणीनुसार नवीन मजकूर दे:',
      JSON.stringify(example, null, 2),
    ].filter(l => l !== '').join('\n');
  }

  // one answer may hold several videos: { videos: [ … ] } or [ … ] → the JSON text of each one
  function split(raw) {
    let j; try { j = typeof raw === 'string' ? extract(raw.trim().startsWith('[') ? '{"videos":' + raw.trim() + '}' : raw) : raw; } catch (e) { return [String(raw || '')]; }
    const list = Array.isArray(j) ? j : Array.isArray(j?.videos) ? j.videos : null;
    return list && list.length ? list.slice(0, 5).map(v => JSON.stringify(v, null, 2)) : [typeof raw === 'string' ? raw : JSON.stringify(raw)];
  }

  const api = { TYPES, SCREENS, AUDIENCES, THEMES, PACES, MUSIC, RECIPES, PLACEHOLDERS, extract, parse, prompt, split };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AD_SCRIPT = api;
})(typeof window !== 'undefined' ? window : null);
