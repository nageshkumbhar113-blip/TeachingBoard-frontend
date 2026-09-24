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

  async function _copyAiPrompt() {
    const text = AI_PROMPT;
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
  const EDIT_FIELDS = ['type', 'title', 'language', 'passage', 'passageImage', 'subQuestions', 'format', 'marks', 'wordLimit', 'scenario', 'modelAnswer', 'points', 'rubric', 'status'];

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
        <div class="pab-passage">${esc(b.scenario || '')}</div>
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
