/* ════════════════════════════════════════
   passageBlockAdmin.js — Admin > Passages
   Language-paper content (comprehension / poetry / nonverbal / writing) — a passage or
   prompt plus its sub-questions, imported as one JSON array (Claude-generated, see
   docs/PASSAGE_BLOCK_SPEC or the shared spec artifact). Server: /api/passage-blocks
════════════════════════════════════════ */

(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => (typeof APP !== 'undefined' && APP?.toast) ? APP.toast(m, t) : console.log(m);

  const TYPE_LABEL = { comprehension: '📖 Comprehension', poetry: '📜 Poetry', nonverbal: '📊 Non-verbal', writing: '✍️ Writing' };

  let _loaded = false;
  let _batches = [];
  let _blocks = [];

  async function init() {
    if (!_loaded) { _bind(); _loaded = true; }
    await _loadBatches();
    await _refresh();
  }

  function _bind() {
    $('pab-batch')?.addEventListener('change', _onBatchChange);
    $('pab-subject')?.addEventListener('change', async () => { await _onSubjectChangeForChapters(); await _refresh(); });
    $('pab-chapter')?.addEventListener('change', _refresh);
    $('pab-type')?.addEventListener('change', _refresh);
    $('pab-search')?.addEventListener('input', () => { clearTimeout(_bind._t); _bind._t = setTimeout(_refresh, 300); });
    $('pab-preview-btn')?.addEventListener('click', _preview);
    $('pab-run-btn')?.addEventListener('click', _run);
    $('pab-list')?.addEventListener('click', _onListClick);
    $('pab-prompt-btn')?.addEventListener('click', _copyAiPrompt);
    $('pab-prompt-type')?.addEventListener('change', _showPrompt);
    _showPrompt();
    $('pab-file-btn')?.addEventListener('click', () => $('pab-file')?.click());
    $('pab-file')?.addEventListener('change', _loadFiles);
  }

  // One or more .json files (each an array or a single block) are merged into the textarea, so the
  // usual Check → Save blocks flow (and the batch/subject/chapter pickers) applies unchanged.
  async function _loadFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const all = [];
    for (const f of files) {
      let parsed;
      try { parsed = JSON.parse((await f.text()).replace(/^﻿/, '')); }
      catch (err) { toast(`${f.name}: not valid JSON (${err.message})`, 'error'); return; }
      all.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    }
    $('pab-json').value = JSON.stringify(all, null, 2);
    if ($('pab-run-btn')) $('pab-run-btn').disabled = true;
    toast(`${all.length} block(s) loaded from ${files.length} file(s) — press Check`, 'success');
  }

  // ── "Copy AI prompt" — a self-contained instruction block the admin can paste into Claude/ChatGPT
  // along with source material (a textbook chapter, a poem, an image description) to get back a
  // JSON array in exactly the shape _run()/_preview() expect. Kept in code (not a separate doc) so it
  // can never silently drift out of sync with the actual schema in models/PassageBlock.js.
  const AI_PROMPT = `Generate a JSON array of "Passage Block" objects for a Maharashtra-board-style language paper. Return ONLY the JSON array — no markdown fences, no commentary.

Each object in the array is one of these 4 types. Do NOT include batchId/subjectId/chapterId — the admin panel fills those in from its own pickers.

──────────────────────────────────────────────
1) type: "comprehension" | "poetry" | "nonverbal"  (all three share this exact shape)
{
  "type": "comprehension",
  "title": "short title for this block, e.g. 'Unseen Passage: The Old Clock'",
  "language": "english",                 // "english" | "marathi" | "hindi"
  "passage": "the full passage/poem text the student reads",
  "passageImage": "",                    // optional image URL, mainly for "nonverbal" (a chart/diagram); leave "" otherwise
  "subQuestions": [
    {
      "marks": 2,
      "format": "short_answer",          // one of: fill_blanks | true_false | web_diagram | tree_diagram | match | short_answer | rearrange
      "prompt": "the question text shown above this sub-question",
      "center": "",                      // ONLY for format:"web_diagram" — the word printed in the middle circle
      "items": [
        { "text": "one line of the question/blank/statement", "answer": "the correct answer", "given": "" }
        // "given" is ONLY used by web_diagram/tree_diagram items — the spoke/branch label that's
        // already printed on the diagram (not something the student fills in).
        // For format:"fill_blanks", put the blank inside "text" using double square brackets, e.g.
        //   "text": "The clock struck [[ ]] o'clock."   and "answer": "twelve"
        // For format:"true_false", "text" is the statement and "answer" is "True" or "False".
        // For format:"match" or "rearrange", one "items" entry per line to match/reorder.
      ]
    }
    // add as many sub-questions as the real exam section has, with real per-question marks
  ]
}

2) type: "writing"   (letter / essay / speech / story / news report / dialogue / ad — NO passage, NO fixed answer)
{
  "type": "writing",
  "title": "short title, e.g. 'Formal Letter: Complaint to Municipal Corporation'",
  "language": "english",
  "format": "formal_letter",             // one of: formal_letter | informal_letter | speech | story | news_report | essay | dialogue | ad
  "marks": 5,
  "wordLimit": "100-120 words",
  "scenario": "the situation/prompt the student is given, in full",
  "passage": "optional: the advertisement / notice / table / headline printed in a box under the task (one printed line per line, joined with \n)",
  "points": ["point the student should cover 1", "point 2", "point 3"],
  "rubric": ["what an examiner checks 1", "what an examiner checks 2"],
  "modelAnswer": "a complete model answer (e.g. the full letter) — see below; use \\n for line breaks"
}

HOW TO WRITE A "writing" BLOCK (letters etc.) — this is the QUESTION the student gets, not the finished letter:
- "scenario" = the exact board-style task, written as the paper prints it. For a LETTER include: who the student is (use the board's gender-neutral pair, e.g. "Kamal/Kamlesh Kale"), the sender's full address (flat, society/road, area, city), WHO the letter goes to (designation + organisation + address, or the friend/relative's name and town) and the PURPOSE (complaint / request / invitation / congratulation / thanks / enquiry / apology). Ends with a line such as "You are Kamal/Kamlesh Kale, A-254 'River View', Karve Nagar, Pune. Write a letter to the Commissioner, Pune Municipal Corporation, about ..." Never leave the sender/receiver vague and never write the letter itself.
- "points" = 3 to 5 short content cues the letter must cover (e.g. "State the problem and since when", "Mention the inconvenience caused", "Request prompt action"). For a story: the outline hints in order. For a speech/news report/dialogue/ad: the key facts (who, what, when, where, why) the student must use.
- "rubric" = the marking scheme, listed so the numbers ADD UP to "marks". Typical letter (5 marks): "Format (address, date, salutation, subscription) - 1", "Content (all points covered) - 2", "Language (grammar, spelling, style) - 2". Typical 8/10-mark essay/story: "Format/Title - 1", "Content and ideas - 4", "Organisation - 2", "Language accuracy - 1..3".
- "modelAnswer" = ONE complete, exam-quality sample answer that scores full marks, inside the word limit, written from the scenario's own names/addresses/points and using \\n for line breaks. LETTER layout (follow this exactly, one element per line, blank line between blocks), e.g. for a formal letter: "From: Akash, X Std\\nGovernment Pre University College\\nThekkatte.\\n15 May 2025\\n\\nTo,\\nThe Headmaster\\nGovernment Pre University College\\nThekkatte\\n\\nDear Sir/Madam,\\nSub: Request to help my friend to pay the school fees.\\n\\nI am a student of class X of your institution. ... (body paragraphs covering every point, in order)\\n\\nThanking you,\\nYours obediently,\\nAkash". Formal letters: From, date, To (designation + organisation + place), salutation, "Sub: ...", body, "Thanking you,", closing ("Yours faithfully," / "Yours obediently,"), name. Informal letters (to a friend/relative): sender's address + date at top, "Dear Rohan," / "Dear Father,", body, closing ("Yours loving son/daughter," / "Yours affectionately,"), name — no "Sub:" line and no receiver's address. Speech: greeting + body + thanks. News report: headline, dateline, body. Story: title, story, moral. Essay: title + intro, body, conclusion.
- "format" must match the task: formal_letter (to an authority/editor/principal) or informal_letter (to a friend/relative); speech; story; news_report; essay; dialogue; ad. Set "wordLimit" as printed (e.g. "100-120 words") and "marks" from the paper.
- Marathi/Hindi papers: write the whole scenario, points and rubric in that language (पत्रलेखन: औपचारिक/अनौपचारिक; वृत्तांतलेखन, जाहिरातलेखन, कथालेखन, निबंधलेखन), still using the English "format" values above.
- If a real board paper/PDF is attached, copy its writing task word-for-word (names, addresses, bullet cues) instead of inventing one.
──────────────────────────────────────────────

Rules:
- Every block needs "type" and "title". A comprehension/poetry/nonverbal block also needs "passage" (non-empty) and at least one subQuestion with marks > 0. A writing block needs "scenario" instead of passage/subQuestions.
- Keep marks realistic for the board level given (e.g. a 9th/10th std unseen passage is usually worth 8-10 marks total across its sub-questions).
- Use real board-paper phrasing for prompts (e.g. "Complete the following activities.", "Do as directed.") — not generic placeholders.
- If asked for Marathi/Hindi content, write the passage/prompts/answers in that language and set "language" accordingly, but keep all JSON field NAMES in English exactly as shown above.

Now generate the JSON array for: `;

  // ── One focused prompt per question type (pick it in the dropdown next to the Copy button) ──
  const _HEAD = 'Generate a JSON array of "Passage Block" objects for a Maharashtra-board-style language paper. Return ONLY the JSON array - no markdown fences, no commentary. Do NOT include batchId/subjectId/chapterId - the admin panel fills those in. Use \\n for line breaks inside strings. If a real board paper is attached, copy its task word-for-word (names, addresses, cues, marks) instead of inventing one. For Marathi/Hindi write all content in that language and set "language" accordingly, but keep every JSON field NAME and every "format" value in English.\n\n';
  const _TAIL = '\n\nEvery block needs "type" and "title". Keep marks and word limits exactly as the paper prints them. Rubric numbers must add up to "marks". Tables go in the text as pipe rows, one row per line: | Column A | Column B |.\n\nNow generate the JSON array for: ';
  const _WSHAPE = (format, marks, word, task) => `Output ONE object for the whole question. If the paper offers alternatives (A1 OR A2 / B1 OR B2), keep BOTH inside this same block exactly as the paper prints them: scenario = the shared intro, then "A1. <name>: <task>", a blank line, "OR", a blank line, "A2. <name>: <task>"; modelAnswer = both model answers, each headed "A1." / "A2."; rubric per alternative; "format" = the first alternative's format; "marks" = the marks for ONE attempted alternative. Shape:
{
  "type": "writing",
  "title": "short title",
  "language": "english",
  "format": "${format}",
  "marks": ${marks},
  "wordLimit": "${word}",
  "scenario": "${task}",
  "diagram": null,   // optional empty tree/flow/web skeleton the student fills in (see the Information-transfer prompt for the shape)
  "passage": "SOURCE MATERIAL printed in a box under the task (advertisement / notice / table / headline / given paragraph), one printed line per line joined with \n; \"\" if the task has none",
  "points": ["content cue 1", "content cue 2", "content cue 3"],
  "rubric": ["mark split that adds up to ${marks}"],
  "modelAnswer": "a full-marks model answer, exactly in the layout described below"
}
`;
  const _PPASS = (type, what) => `Output ONE object per ${what} in this shape:
{
  "type": "${type}",
  "title": "short title",
  "language": "english",
  "passage": "the full text exactly as printed",
  "passageImage": "",
  "subQuestions": [
    { "marks": 2, "format": "fill_blanks | true_false | web_diagram | tree_diagram | match | short_answer | rearrange", "prompt": "activity heading as printed, e.g. Complete the following sentences", "center": "", "items": [ { "text": "line (use [[ ]] for a blank)", "answer": "correct answer", "given": "" } ] }
  ]
}
"center" only for web_diagram; "given" only for web/tree diagram spokes. true_false answers are "True"/"False". For personal-response / open questions still put a short sample answer in "answer".
`;
  const PROMPTS = {
    comprehension: _HEAD + 'Type: comprehension (Q2 textual passages, Q4 non-textual passage: A1..A5 activities, each usually 2 marks).\n' + _PPASS('comprehension', 'passage') + _TAIL,
    poetry: _HEAD + 'Type: poetry (stanzas + activities such as true/false, web, rhyming words) AND "Appreciation of the poem" (give the poem as "passage"; ONE sub-question, format short_answer, marks 5, prompt "Read the following poem and write an appreciation of it with the help of the points given below", items = the points with their marks, e.g. "Title (1/2)", "Name of the poet (1/2)", "Rhyme scheme (1)", "Figure of speech - any one (1)", "Theme/Central idea in 2/3 lines (2)" with a model answer for each).\n' + _PPASS('poetry', 'poem') + _TAIL,
    nonverbal: _HEAD + 'Type: nonverbal (a table/chart/diagram/advertisement is the source; sub-questions ask the student to read or complete it). If it is a picture, leave "passage" as a short description of it and put the image URL in "passageImage". A table goes in "passage" as pipe rows.\n' + _PPASS('nonverbal', 'table/chart') + _TAIL,
    letter: _HEAD + 'Type: LETTER WRITING (Q5A: A1 informal letter OR A2 formal letter from the SAME advertisement/situation = ONE block holding both alternatives, format "informal_letter", 5 marks, wordLimit as printed).\n' + _WSHAPE('formal_letter', 5, '100-120', 'Suppose you are Kamal/Kamlesh Kale from A-254, River View, Karve Nagar, Pune. Read the following advertisement ... Write to the President of Youth Club. Thank him/her for organising the exhibition. Ask more about the entry fee and timing. You may add your own points.') + `
scenario: the TASK only - who the writer is (gender-neutral pair like Kamal/Kamlesh Kale), full sender address, who the letter goes to (designation + organisation + place, or a friend's name/town) and the purpose. Never write the letter in the scenario.
passage: the advertisement/notice exactly as printed in its box, one printed line per line (\n), title lines first, bullets written as "• Duration : 2nd to 8th May, 2025", contact block last. Do NOT use pipe rows here - only for a genuine multi-column table.
rubric: "Format - 1", "Content - 2", "Language - 2".
modelAnswer FORMAL layout (one element per line, blank line between blocks): "From: Kamal Kale\\nA-254, River View\\nKarve Nagar, Pune.\\n2 May 2025\\n\\nTo,\\nThe President\\nYouth Club\\nGandhi Corner, Pune\\n\\nDear Sir/Madam,\\nSub: Thanks for organising the exhibition and query about entry fee\\n\\nbody paragraphs covering every point in order\\n\\nThanking you,\\nYours faithfully,\\nKamal Kale".
modelAnswer INFORMAL layout: sender address + date at the top, "Dear Rohan,", warm body using the advertisement's points (duration, venue, what is on offer, why to come), "Yours lovingly,", name - no "Sub:" line and no receiver address.` + _TAIL,
    dialogue: _HEAD + 'Type: DIALOGUE WRITING (Q5B1 = 5 marks: (a) arrange jumbled sentences into a dialogue (1), (b) complete a given dialogue (1), (c) write a new dialogue of at least three exchanges on a topic (3)). ONE block, format "dialogue", marks 5.\n' + _WSHAPE('dialogue', 5, 'minimum three exchanges', '(a) Prepare a dialogue from the jumbled sentences: (i) ... (ii) ... (iii) ... (iv) ... (b) Complete the following dialogue: A: ... B: ...... A: ... B: ...... (c) Write a dialogue between two friends about ...') + `
rubric: "(a) 1", "(b) 1", "(c) 3".
modelAnswer: three labelled parts, dialogue lines as "A: ...\\nB: ..." alternating, the (a) sentences in the correct order.` + _TAIL,
    speech: _HEAD + 'Type: DRAFTING A SPEECH (Q5B2, 5 marks). ONE block, format "speech".\n' + _WSHAPE('speech', 5, '', "Imagine that you are going to deliver a speech on 'Books are our real friends' in the elocution competition. Write a speech using the following points:") + `
points: the bullet cues exactly as printed, plus "Add your own points".
rubric: "Format (greeting, closing) - 1", "Content - 2", "Language - 2".
modelAnswer: "Good morning to the Principal, respected teachers and my dear friends,\\n\\n(introduce topic)\\n\\n(one paragraph per point)\\n\\n(strong conclusion)\\n\\nThank you." Keep it within the word limit.` + _TAIL,
    info_transfer: _HEAD + 'Type: INFORMATION TRANSFER (Q6A, 5 marks; A1 non-verbal -> verbal = table to two paragraphs, OR A2 verbal -> non-verbal = paragraph to tree diagram/flow chart). Output ONE block holding both alternatives (A1 table -> paragraphs OR A2 paragraph -> tree diagram), format "information_transfer". For the empty diagram the student must fill in (A2 tree diagram / flow chart / web) add a "diagram" object - NO image needed, the app draws it: {"kind":"tree","levels":[{"label":"Title","boxes":[""]},{"label":"Types","boxes":["Kinetic energy","Potential energy"]},{"label":"Sub-types","boxes":["","","",""]},{"label":"Example","boxes":["","","",""],"lines":true}]}. kind "tree" or "flow" = stacked levels (a box with "" is an empty box to fill, text is printed inside it, "lines":true prints numbered answer lines); kind "web" = {"kind":"web","center":"hibiscus flower","boxes":["blooms ...","smiles ...","withers ...","falls ..."]}. Copy the levels/labels/given boxes exactly from the diagram printed in the paper.\n' + _WSHAPE('information_transfer', 5, 'two paragraphs', 'Read the information given in the following table. Write two paragraphs based on it. Give a suitable title to it:\\n| Effective Communication | Ineffective Communication |\\n| Use of body language | Lack of interest |') + `
A1 (table -> paragraphs): scenario = the task; put the table in "passage" as pipe rows (a real table). modelAnswer = "Title: ...\\n\\nParagraph 1 ...\\n\\nParagraph 2 ...".
A2 (paragraph -> tree diagram): scenario = "Read the information given below and represent it in the form of a tree-diagram. Give a suitable title to it:" and the paragraph goes in "passage". modelAnswer = the completed diagram as indented text, one node per line: "Title: Forms of Energy\\nTypes: Kinetic energy | Potential energy\\n  Kinetic sub-types: Mechanical | Electrical\\n    Examples: leaping frog / lightning\\n  Potential sub-types: Nuclear | Chemical\\n    Examples: fusion in the sun / a matchstick".
rubric: "Title - 1", "Content/organisation - 3", "Language - 1".
TREE DIAGRAM RULES (very important, follow exactly):
1. The block "type" is "writing" and "format" is "information_transfer". NEVER use type "nonverbal", NEVER use subQuestions or format "tree_diagram", NEVER draw the skeleton with ASCII/arrows/text inside "passage", and leave "passageImage" empty. "subQuestions" must be [].
2. The empty diagram goes ONLY in the "diagram" field. Read the printed skeleton in the paper from TOP to BOTTOM, one entry in "levels" per horizontal row:
   - "label" = the bullet word printed at the left of that row (Title, Types, Sub-types, Example ...).
   - "boxes" = one entry per box in that row, left to right. A box already printed in the paper keeps its text (e.g. "Kinetic energy"); an EMPTY box the student must fill is "" (empty string). Never put the answer in a box.
   - "lines": true ONLY for a row of blank answer lines ("1. ______") instead of boxes (the Example row); still give one "" per line.
3. Count the boxes exactly as in the paper: Title row 1 box; Types row 2 printed boxes; Sub-types row 4 empty boxes (2 under each Types box, in left-to-right order); Example row 4 lines (one under each Sub-types box).
4. The ANSWER (filled diagram) goes in "modelAnswer" as indented text, so it shows on the answer sheet only.
5. For a flow chart use "kind":"flow" (same levels, one box per step); for a spider/web map use "kind":"web" with "center" and the 4 "boxes".
Complete example for the energy tree (Title / Types / Sub-types / Example):
"diagram":{"kind":"tree","levels":[{"label":"Title","boxes":[""]},{"label":"Types","boxes":["Kinetic energy","Potential energy"]},{"label":"Sub-types","boxes":["","","",""]},{"label":"Example","boxes":["","","",""],"lines":true}]}
"modelAnswer":"A2.\\nTitle: Types of Energy\\nTypes: Kinetic energy | Potential energy\\n  Sub-types under Kinetic: Mechanical energy | Electrical energy\\n  Sub-types under Potential: Nuclear energy | Chemical energy\\n  Examples: 1. leaping frog, moving car  2. lightning, power lines  3. fusion in the Earth's core/sun  4. striking a match, the food we eat".` + _TAIL,
    verbal_to_nonverbal: _HEAD + 'Type: VERBAL -> NON-VERBAL (information transfer where the student reads a PARAGRAPH and fills an empty tree diagram / flow chart / web). ONE alternative only (no A1/A2), 5 marks, block "type" "writing", "format" "information_transfer", "subQuestions" []. NEVER use type "nonverbal" or format "tree_diagram", NEVER draw the skeleton as ASCII in "passage", leave "passageImage" empty.\n' + _WSHAPE('information_transfer', 5, '', 'Read the information given below and represent it in the form of a tree-diagram. Give a suitable title to it:') + `
scenario = the task line exactly as printed. passage = the paragraph the student reads (exact text, keep the original wording). The empty diagram goes ONLY in "diagram", read from TOP to BOTTOM, one entry in "levels" per row: "label" = the bullet word at the left of the row (Title, Types, Sub-types, Example), "boxes" = one entry per box left to right ("" = empty box to fill, text = box already printed in the paper), "lines": true for a row of blank answer lines. Count boxes exactly as the paper. Never put answers inside "boxes".
Tree/flow: {"kind":"tree" or "flow","levels":[{"label":"Title","boxes":[""]},{"label":"Types","boxes":["Kinetic energy","Potential energy"]},{"label":"Sub-types","boxes":["","","",""]},{"label":"Example","boxes":["","","",""],"lines":true}]}. Web: {"kind":"web","center":"hibiscus flower","boxes":["","","",""]}.
modelAnswer = the completed diagram as indented text, one node per line, e.g. "Title: Types of Energy\\nTypes: Kinetic energy | Potential energy\\n  Kinetic sub-types: Mechanical | Electrical\\n  Potential sub-types: Nuclear | Chemical\\n  Examples: 1. leaping frog 2. lightning 3. fusion in the sun 4. a matchstick".
rubric: "Title - 1", "Content/organisation - 3", "Language - 1".` + _TAIL,
    nonverbal_to_verbal: _HEAD + 'Type: NON-VERBAL -> VERBAL (information transfer where the student reads a TABLE / chart / diagram and writes paragraphs). ONE alternative only, 5 marks, block "type" "writing", "format" "information_transfer", "subQuestions" [].\n' + _WSHAPE('information_transfer', 5, 'two paragraphs', 'Read the information given in the following table. Write two paragraphs based on it. Give a suitable title to it:\\n| Effective Communication | Ineffective Communication |\\n| Use of body language | Lack of interest |') + `
scenario = the task line. The table/chart goes in "passage" as pipe rows (first row = column headings, one "| a | b |" line per row) so it prints as a real table; a chart may be described as rows of "label | value". Leave "diagram" null. modelAnswer = "Title: ...\\n\\nParagraph 1 ...\\n\\nParagraph 2 ..." using every point from the table.
rubric: "Title - 1", "Content - 3", "Language - 1".` + _TAIL,
    news_report: _HEAD + 'Type: NEWS REPORT (Q6B1, 5 marks). ONE block, format "news_report".\n' + _WSHAPE('news_report', 5, '', "Read the following headline and prepare a news report with the help of the given points: 'Nav Bharat School Celebrates Science Day'") + `
points: "Headline", "Dateline", "Lead/Introduction", "Short continuing paragraph" (as printed). passage: the given headline exactly as printed in its box.
rubric: "Headline - 1", "Dateline - 1", "Lead - 1", "Body paragraph - 2".
modelAnswer: "NAV BHARAT SCHOOL CELEBRATES SCIENCE DAY\\n\\nPune, 28 February 2025: (lead - who, what, when, where)\\n\\n(continuing paragraph with details, quotes from the principal/students, prizes)".` + _TAIL,
    story: _HEAD + 'Type: STORY WRITING from a given beginning (Q6B2, 5 marks). ONE block, format "story".\n' + _WSHAPE('story', 5, '', 'Develop a story with the help of the given beginning. Suggest a suitable title: In the last summer vacation, I visited ......') + `
rubric: "Title - 1", "Content/plot - 2", "Language - 2".
modelAnswer: "Title: ...\\n\\n(story that continues the given beginning smoothly: setting, problem, climax, ending)\\n\\nMoral: ..." within the word limit.` + _TAIL,
    summary: _HEAD + 'Type: SUMMARY WRITING (Q4B, 5 marks). ONE block, format "summary". The full passage to be summarised MUST be in "passage" (the paper refers to the passage of Q4A) so the block stands alone.\n' + _WSHAPE('summary', 5, 'about one-third of the passage', 'Read the following passage and write a summary of it. Suggest a suitable title to the summary.') + `
rubric: "Title - 1", "Main points covered - 3", "Language and brevity - 1".
modelAnswer: "Title: ...\\n\\n(summary of about one-third length, in the student's own words, past-tense-consistent, no examples or quotes)".` + _TAIL,
  };

  function _showPrompt() {
    const box = $('pab-prompt-view');
    if (box) box.value = PROMPTS[$('pab-prompt-type')?.value || ''] || AI_PROMPT;
  }

  async function _copyAiPrompt() {
    const text = $('pab-prompt-view')?.value || PROMPTS[$('pab-prompt-type')?.value || ''] || AI_PROMPT;
    try {
      await navigator.clipboard.writeText(text);
      toast('AI prompt copied — paste it into Claude/ChatGPT along with your source material', 'success');
    } catch {
      // Clipboard API unavailable (older WebView, no HTTPS, etc.) — fall back to a manual-copy textarea.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('AI prompt copied', 'success'); }
      catch { toast('Could not copy automatically — select and copy the prompt shown', 'error'); }
      document.body.removeChild(ta);
    }
  }

  async function _loadBatches() {
    if (_batches.length) return;
    try { _batches = await DB.getAllBatches(); } catch { _batches = []; }
    const sel = $('pab-batch');
    if (sel) sel.innerHTML = '<option value="">Select batch</option>' + _batches.map(b => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
  }

  async function _onBatchChange() {
    const batch = $('pab-batch')?.value || '';
    const subjSel = $('pab-subject'), chSel = $('pab-chapter');
    subjSel.innerHTML = '<option value="">All subjects</option>';
    chSel.innerHTML = '<option value="">All chapters / unseen pool</option>';
    if (!batch) { _refresh(); return; }
    try {
      const subs = await DB.getSubjectsByBatch(batch);
      subjSel.innerHTML += subs.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
    } catch { /* keep the base option */ }
    _refresh();
  }

  async function _onSubjectChangeForChapters() {
    const batch = $('pab-batch')?.value || '', subj = $('pab-subject')?.value || '';
    const chSel = $('pab-chapter');
    chSel.innerHTML = '<option value="">All chapters / unseen pool</option>';
    if (!batch || !subj) return;
    try {
      const chs = await DB.getChaptersByBatchSubject(batch, subj);
      chSel.innerHTML += chs.map(c => `<option value="${esc(_chapterId(batch, subj, c.name))}">${esc(c.name)}</option>`).join('');
    } catch { /* no chapters yet */ }
  }

  function _chapterId(batch, subject, chapter) {
    const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-');
    return `${norm(batch)}::${norm(subject)}::${norm(chapter)}`;
  }

  async function _refresh() {
    await _refreshBlockList();
  }

  // ── list / delete ────────────────────────────────────────────────────────
  async function _refreshBlockList() {
    const box = $('pab-list');
    if (!box) return;
    const batch = $('pab-batch')?.value || '';
    if (!batch) { box.innerHTML = '<p class="import-hint">Select a batch to see its passage blocks.</p>'; return; }
    box.innerHTML = '<p class="import-hint">Loading…</p>';
    try {
      _blocks = await API.fetchPassageBlocks({
        batchId: batch,
        subjectId: $('pab-subject')?.value || undefined,
        chapterId: $('pab-chapter')?.value || undefined,
        type: $('pab-type')?.value || undefined,
        q: $('pab-search')?.value || undefined,
      });
    } catch (err) {
      box.innerHTML = `<p class="import-hint">Could not load: ${esc(err.message || '')}</p>`;
      return;
    }
    if (!_blocks.length) { box.innerHTML = '<p class="import-hint">No passage blocks yet for this filter.</p>'; return; }
    box.innerHTML = _blocks.map(b => `
      <div class="pab-card" data-id="${esc(b.id)}">
        <div class="pab-card-head">
          <span class="pab-pill">${TYPE_LABEL[b.type] || b.type}</span>
          <b>${esc(b.title)}</b>
          <span class="pab-meta">${esc(b.subjectId)}${b.chapterId ? '' : ' · unseen pool'} · ${b.totalMarks} marks · used ${b.usageCount}x</span>
          <span class="pab-actions">
            <button type="button" class="admin-btn-secondary" data-prev="${esc(b.id)}">👁 Preview</button>
            <button type="button" class="admin-btn-secondary" data-edit="${esc(b.id)}">✏️ Edit</button>
            <button type="button" class="admin-btn-danger" data-del="${esc(b.id)}">Delete</button>
          </span>
        </div>
        ${b.type === 'writing'
          ? `<div class="pab-body">${esc(b.scenario).slice(0, 220)}${b.scenario.length > 220 ? '…' : ''}</div>`
          : `<div class="pab-body">${esc(b.passage).slice(0, 220)}${b.passage.length > 220 ? '…' : ''} <small>(${(b.subQuestions || []).length} sub-questions)</small></div>`}
        <div class="pab-card-view hidden"></div>
      </div>`).join('');
  }

  // Edit = the block's own JSON in a textarea (same shape as import), saved via PATCH. Placement
  // (batch/subject/chapter) is kept from the saved block, not re-read from the pickers above.
  const EDIT_FIELDS = ['type', 'title', 'language', 'passage', 'passageImage', 'subQuestions', 'format', 'marks', 'wordLimit', 'scenario', 'diagram', 'modelAnswer', 'points', 'rubric', 'status'];

  async function _onListClick(e) {
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const card = edit.closest('.pab-card');
      const view = card.querySelector('.pab-card-view');
      const b = _blocks.find(x => String(x.id) === edit.dataset.edit);
      if (!b) return;
      const editable = {};
      for (const k of EDIT_FIELDS) if (b[k] !== undefined) editable[k] = b[k];
      view.innerHTML = `<textarea class="admin-input pab-json pab-edit-json" rows="16">${esc(JSON.stringify(editable, null, 2))}</textarea>
        <div class="pab-row"><button type="button" class="admin-btn-primary" data-save-edit="${esc(b.id)}">Save changes</button>
        <button type="button" class="admin-btn-secondary" data-cancel-edit="1">Cancel</button></div>`;
      view.classList.remove('hidden');
      card.querySelector('.pab-body')?.classList.add('hidden');
      return;
    }
    if (e.target.closest('[data-cancel-edit]')) { await _refreshBlockList(); return; }
    const saveBtn = e.target.closest('[data-save-edit]');
    if (saveBtn) {
      const b = _blocks.find(x => String(x.id) === saveBtn.dataset.saveEdit);
      const ta = saveBtn.closest('.pab-card-view').querySelector('.pab-edit-json');
      let parsed;
      try { parsed = JSON.parse(ta.value); } catch (err) { toast('Not valid JSON: ' + err.message, 'error'); return; }
      saveBtn.disabled = true;
      try {
        await API.updatePassageBlock(b.id, { ...parsed, batchId: b.batchId, subjectId: b.subjectId, chapterId: b.chapterId || '' });
        toast('Saved', 'success');
        await _refreshBlockList();
      } catch (err) {
        toast(err.message || 'Could not save', 'error');
        saveBtn.disabled = false;
      }
      return;
    }
    const prev = e.target.closest('[data-prev]');
    if (prev) {
      const card = prev.closest('.pab-card');
      const view = card.querySelector('.pab-card-view');
      if (view.classList.contains('hidden')) {
        view.innerHTML = _blockPreviewHtml(_blocks.find(x => String(x.id) === prev.dataset.prev));
        view.classList.remove('hidden');
        card.querySelector('.pab-body')?.classList.add('hidden');
      } else {
        view.classList.add('hidden');
        card.querySelector('.pab-body')?.classList.remove('hidden');
      }
      return;
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    if (!await APP.confirmAsync('Delete this passage block? Papers already built from it keep their own copy.')) return;
    try {
      await API.deletePassageBlock(btn.dataset.del);
      toast('Deleted', 'success');
      await _refreshBlockList();
    } catch (err) {
      toast(err.message || 'Could not delete', 'error');
    }
  }

  // ── import (paste JSON) ──────────────────────────────────────────────────
  // The batch/subject/chapter pickers above the textarea set every pasted block's placement —
  // a block's own batchId/subjectId (if the JSON happened to include one) is always overridden,
  // so importing the same JSON against a different batch just needs the picker changed, not the text.
  function _parseInput() {
    const raw = $('pab-json')?.value?.trim();
    if (!raw) { toast('Paste the JSON array first', 'error'); return null; }
    let arr;
    try { arr = JSON.parse(raw); } catch (e) { toast('Not valid JSON: ' + e.message, 'error'); return null; }
    if (!Array.isArray(arr)) arr = [arr];
    const batchId = $('pab-batch')?.value || '';
    const subjectId = $('pab-subject')?.value || '';
    const chapterId = $('pab-chapter')?.value || '';
    return arr.map(b => ({ ...b, batchId, ...(subjectId ? { subjectId } : {}), chapterId: chapterId || b.chapterId || '' }));
  }

  // ── visual preview: roughly how a student sees the block (answers shown in green for the admin) ──
  const _blanks = t => esc(t).replace(/\[\[[^\]]*\]\]/g, '<span class="pab-blank"></span>');
  const _ans = a => a ? `<div class="pab-ans">✔ ${esc(a)}</div>` : '';

  function _subQuestionPreview(sq, n) {
    const items = Array.isArray(sq.items) ? sq.items : [];
    let body;
    if (sq.format === 'web_diagram') {
      body = `<div class="pab-web"><span class="pab-web-center">${esc(sq.center || '?')}</span>` +
        items.map(it => `<div class="pab-diag-row"><span class="pab-diag-given">${esc(it.given || '')}</span> → <span class="pab-diag-box">${it.answer ? esc(it.answer) : ''}</span></div>`).join('') + '</div>';
    } else if (sq.format === 'tree_diagram') {
      body = items.map(it => `<div class="pab-diag-row"><span class="pab-diag-given">${esc(it.given || it.text || '')}</span> → <span class="pab-diag-box">${it.answer ? esc(it.answer) : ''}</span></div>`).join('');
    } else {
      body = '<ol class="pab-items">' + items.map(it => `<li>${_blanks(it.text || '')}${_ans(it.answer)}</li>`).join('') + '</ol>';
    }
    return `<div class="pab-sq"><div class="pab-sq-head"><b>Q${n}.</b> ${_blanks(sq.prompt || '')} <span class="pab-fmt">${esc(sq.format || 'short_answer')} · ${Number(sq.marks) || 0}m</span></div>${body}</div>`;
  }

  function _blockPreviewHtml(b) {
    if (!b) return '';
    if (b.type === 'writing') {
      return `<div class="pab-view">
        <div class="pab-view-meta">${esc((b.format || '').replace(/_/g, ' '))}${b.marks ? ` · ${Number(b.marks)} marks` : ''}${b.wordLimit ? ` · ${esc(b.wordLimit)}` : ''}</div>
        <div class="pab-task">${esc(b.scenario || '')}</div>
        ${b.passage ? `<div class="pab-passage">${esc(b.passage)}</div>` : ''}
        ${b.passageImage ? `<img class="pab-img" src="${esc(b.passageImage)}" alt="" />` : ''}
        ${b.diagram && window.DIAGRAM_SKELETON ? window.DIAGRAM_SKELETON.html(b.diagram) : ''}
        ${(b.points || []).length ? `<ul class="pab-points">${b.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        ${(b.rubric || []).length ? `<div class="pab-rubric"><b>Marking scheme</b><ul>${b.rubric.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
        ${b.modelAnswer ? `<div class="pab-rubric"><b>Model answer</b><div style="white-space:pre-wrap">${esc(b.modelAnswer)}</div></div>` : ''}
      </div>`;
    }
    return `<div class="pab-view">
      ${b.passageImage ? `<img class="pab-img" src="${esc(b.passageImage)}" alt="" />` : ''}
      <div class="pab-passage">${esc(b.passage || '')}</div>
      ${(b.subQuestions || []).map((sq, i) => _subQuestionPreview(sq, i + 1)).join('')}
    </div>`;
  }

  async function _preview() {
    const blocks = _parseInput();
    if (!blocks) return;
    if (!$('pab-batch')?.value) { toast('Select a batch first', 'error'); return; }
    const box = $('pab-preview');
    box.innerHTML = '<p class="import-hint">Checking…</p>';
    try {
      const res = await API.previewPassageImport(blocks);
      box.innerHTML = `<p class="import-hint"><b>${res.valid} valid</b>, <b>${res.invalid} invalid</b> of ${res.results.length}.</p>` +
        res.results.map(r => r.ok
          ? `<details class="pab-prev-detail" ${res.results.length === 1 ? 'open' : ''}><summary class="pab-prev ok">✓ Block ${r.index + 1}: ${esc(r.preview.title)} (${TYPE_LABEL[r.preview.type] || r.preview.type}) — tap to see how it looks</summary>${_blockPreviewHtml(blocks[r.index])}</details>`
          : `<div class="pab-prev bad">✕ ${esc(r.error)}</div>`).join('');
      $('pab-run-btn').disabled = res.invalid > 0 || res.valid === 0;
    } catch (err) {
      box.innerHTML = `<p class="import-hint">${esc(err.message || 'Could not check')}</p>`;
    }
  }

  async function _run() {
    const blocks = _parseInput();
    if (!blocks) return;
    const btn = $('pab-run-btn');
    btn.disabled = true;
    try {
      const res = await API.runPassageImport(blocks);
      toast(`Saved ${res.count} block(s)`, 'success');
      $('pab-json').value = '';
      $('pab-preview').innerHTML = '';
      await _refreshBlockList();
    } catch (err) {
      toast(err.message || 'Import failed', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  window.PASSAGE_BLOCK_ADMIN = { init };
})();
