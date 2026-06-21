/* ════════════════════════════════════════
   parser.js — Robust Question Parser
   Handles: plain text, ChatGPT markdown,
            numbered lists, MCQ / TF / FIB,
            multi-line questions, symbols,
            inline multi-option lines
   Global: PARSER

   Output schema per question:
   {
     question    : string,
     type        : 'mcq' | 'tf' | 'fib',
     options     : { A, B, C, D }   (mcq / tf only),
     answer      : string,           A/B/C/D | 'True' | 'False' | freetext
     explanation : string?           (when present in source)
     difficulty  : 'medium',         (caller may override)
     tags        : []
   }
════════════════════════════════════════ */

const PARSER = (() => {

  // ════════════════════════
  // PATTERNS
  // ════════════════════════

  /*
   * Question-start line — matches all of:
   *   1.  |  1)  |  Q1.  |  Q1)  |  Q.1  |  Question 1:
   *   **1.**  |  **Question 1:**  |  ### 1.
   */
  const RE_Q_START =
    /^(?:#{1,4}\s*)?(?:\*{0,2})\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[\.\):\-](?:\*{0,2})\s*/i;

  /*
   * Single-option line — matches all of:
   *   A)  |  A.  |  A-  |  (A)  |  [A]  |  **A)**  |  - A)  |  • A)
   *   a)  |  a.  (lowercase accepted)
   */
  const RE_OPTION =
    /^(?:[-*•]\s*)?(?:\*{0,2})[\(\[]?([A-Da-d])[\)\]\.:\-\s](?:\*{0,2})\s*(.+)/;

  /*
   * Multi-option on ONE line — "(A) text (B) text ..."
   * Captured lazily so each chunk ends before the next letter-marker.
   */
  const RE_MULTI_OPT_DETECT = /\([A-Da-d]\)/gi;
  const RE_MULTI_OPT_SPLIT  =
    /\(([A-Da-d])\)\s*([\s\S]+?)(?=\s*\([A-Da-d]\)|$)/gi;

  /*
   * Answer declaration lines — matches all of:
   *   Ans: A  |  Answer: A  |  Correct Answer: A  |  Key: A
   *   **Answer:** A  |  **Correct Answer:** B) text
   */
  const RE_ANSWER =
    /^(?:\*{0,2})(?:(?:correct|right)\s+)?(?:ans(?:wer)?|key|solution)(?:\*{0,2})\s*[:\.\-]\s*(?:\*{0,2})\s*(.+?)(?:\*{0,2})\s*$/i;

  /*
   * "The correct/right answer is X" — ChatGPT sentence form
   */
  const RE_ANSWER_SENT =
    /^(?:the\s+)?(?:correct|right)\s+answer\s+is\s+(?:\*{0,2})([A-Da-d\w\s\(\)\.]+?)(?:\*{0,2})[\.!\s]*$/i;

  /*
   * Explanation / rationale line
   */
  const RE_EXPL =
    /^(?:\*{0,2})(?:explanation|reason|note|hint|rationale)(?:\*{0,2})\s*[:\.\-]\s*(?:\*{0,2})\s*(.+)/i;

  // ════════════════════════
  // PUBLIC: parse()
  // ════════════════════════

  /**
   * Parse raw question text (any common format) into structured objects.
   *
   * @param   {string} rawText
   * @returns {{ parsed: Object[], stats: Object, errors: Object[] }}
   *
   * @example
   *   const { parsed, stats, errors } = PARSER.parse(text);
   *   // parsed[0] → { question, type, options, answer, explanation, difficulty, tags }
   *   // stats     → { total, mcq, tf, fib, failed }
   *   // errors    → [{ block, preview, reason }]
   */
  function parse(rawText) {
    if (!rawText || !rawText.trim()) {
      return { parsed: [], stats: _makeStats([]), errors: [] };
    }

    const errors = [];
    const blocks = _splitBlocks(rawText);
    const parsed = [];

    blocks.forEach((block, bi) => {
      try {
        const q = _parseBlock(block);
        if (q) {
          parsed.push(q);
        } else {
          errors.push({
            block  : bi + 1,
            preview: block.slice(0, 2).join(' ').slice(0, 80),
            reason : 'Could not extract a valid question from this block',
          });
        }
      } catch (err) {
        errors.push({
          block  : bi + 1,
          preview: block[0]?.slice(0, 80) || '',
          reason : err.message,
        });
      }
    });

    const stats   = _makeStats(parsed);
    stats.failed  = errors.length;
    stats.blocks  = blocks.length;

    return { parsed, stats, errors };
  }

  // ════════════════════════
  // BLOCK SPLITTER
  // ════════════════════════

  function _splitBlocks(text) {
    const allLines = text.split('\n').map(l => l.trim());
    const nonEmpty = allLines.filter(Boolean);

    // Find candidate question-start lines
    const qStarts = nonEmpty.reduce((acc, line, i) => {
      if (RE_Q_START.test(line)) acc.push(i);
      return acc;
    }, []);

    // No numbered markers → fall back to blank-line splitting
    if (!qStarts.length) {
      const byBlank = text.trim()
        .split(/\n\s*\n+/)
        .map(b => b.split('\n').map(l => l.trim()).filter(Boolean))
        .filter(b => b.length > 0);
      return byBlank.length ? byBlank : [nonEmpty];
    }

    /*
     * Smart splitting: only break at a new Q-start when the accumulated
     * block already has options OR an answer line.  This prevents numbered
     * sub-lists inside a question (e.g. "1. The Earth is round") from
     * triggering a false split.
     */
    const blocks = [];
    let start = qStarts[0];

    for (let k = 1; k < qStarts.length; k++) {
      const candidateEnd = qStarts[k];
      const block = nonEmpty.slice(start, candidateEnd);

      const hasOpts = block.some(l =>
        RE_OPTION.test(l) || _isMultiOptLine(l));
      const hasAns  = block.some(l =>
        RE_ANSWER.test(l) || RE_ANSWER_SENT.test(l));

      if (hasOpts || hasAns) {
        blocks.push(block);
        start = candidateEnd;
      }
      // else: numbered line is a sub-list — stays in current block
    }

    const tail = nonEmpty.slice(start);
    if (tail.length) blocks.push(tail);

    return blocks;
  }

  // ════════════════════════
  // BLOCK → QUESTION
  // ════════════════════════

  function _parseBlock(lines) {
    if (!lines || !lines.length) return null;

    const qLines = [];  // accumulate question text
    const opts   = {};  // { A: '...', B: '...', ... }
    let rawAnswer   = '';
    let explanation = '';
    let phase       = 'question'; // 'question' | 'options' | 'done'

    for (let li = 0; li < lines.length; li++) {
      let line = lines[li];

      // Strip question-number prefix only on the very first line
      if (li === 0) {
        const stripped = line.replace(RE_Q_START, '').trim();
        line = stripped || line;
      }

      if (!line) continue;

      // ── Explanation ──────────────────────────
      const explM = line.match(RE_EXPL);
      if (explM) {
        explanation = _stripMd(explM[1]);
        continue;
      }

      // ── Answer ───────────────────────────────
      const ansM = line.match(RE_ANSWER) || line.match(RE_ANSWER_SENT);
      if (ansM) {
        rawAnswer = _stripMd(ansM[1]).trim();
        phase     = 'done';
        continue;
      }

      // ── Multi-option line ─────────────────────
      if (_isMultiOptLine(line)) {
        const parsed = _parseMultiOptLine(line);
        Object.assign(opts, parsed);
        phase = 'options';
        continue;
      }

      // ── Single option ────────────────────────
      const optM = line.match(RE_OPTION);
      if (optM) {
        opts[optM[1].toUpperCase()] = _stripMd(optM[2]);
        phase = 'options';
        continue;
      }

      // ── Question text / continuation ─────────
      if (phase === 'question') {
        qLines.push(_stripMd(line));
      } else if (phase === 'options') {
        // Wrapped option text: append to last option
        const lastKey = Object.keys(opts).at(-1);
        if (lastKey) opts[lastKey] += ' ' + _stripMd(line);
      }
      // phase === 'done': trailing commentary — ignore
    }

    const question = qLines.join(' ').trim();
    if (!question) return null;

    const type   = _detectType(question, opts, rawAnswer);
    const answer = _normalizeAnswer(rawAnswer, opts, type);

    const result = { question, type, difficulty: 'medium', tags: [] };

    if (type === 'fib') {
      result.answer = answer;
    } else {
      result.options = type === 'tf'
        ? { A: 'True', B: 'False' }
        : { A: opts.A || '', B: opts.B || '', C: opts.C || '', D: opts.D || '' };
      result.answer = answer;
    }

    if (explanation) result.explanation = explanation;

    return result;
  }

  // ════════════════════════
  // MULTI-OPTION LINE HELPERS
  // ════════════════════════

  /** True when a single line contains 2+ inline option markers like (A) or A) */
  function _isMultiOptLine(line) {
    // Count occurrences of (A) / (B) / etc.
    const parenMatches = (line.match(/\([A-Da-d]\)/gi) || []).length;
    if (parenMatches >= 2) return true;

    // Count occurrences of "A) " / "B) " etc. (with a space or end after the closing paren)
    const bareMatches = (line.match(/\b[A-Da-d]\)\s/gi) || []).length;
    return bareMatches >= 2;
  }

  /** Split "(A) text (B) text …" or "A) text  B) text …" into { A, B, … } */
  function _parseMultiOptLine(line) {
    const result = {};

    // Prefer parenthesised form first
    const parenRe = /\(([A-Da-d])\)\s*([\s\S]+?)(?=\s*\([A-Da-d]\)|$)/gi;
    let m;
    while ((m = parenRe.exec(line)) !== null) {
      result[m[1].toUpperCase()] = _stripMd(m[2].trim());
    }
    if (Object.keys(result).length >= 2) return result;

    // Bare form: A) text  B) text
    const bareRe = /\b([A-Da-d])\)\s*([\s\S]+?)(?=\s*\b[A-Da-d]\)\s|$)/gi;
    while ((m = bareRe.exec(line)) !== null) {
      result[m[1].toUpperCase()] = _stripMd(m[2].trim());
    }

    return result;
  }

  // ════════════════════════
  // TYPE DETECTION
  // ════════════════════════

  function _detectType(question, opts, rawAnswer) {
    const lAns = rawAnswer.toLowerCase().trim();

    // ── True / False ─────────────────────────

    // Answer text is literally "true" or "false"
    if (lAns === 'true' || lAns === 'false') return 'tf';

    // Question contains explicit (True/False) annotation
    if (/\(\s*t(?:rue)?\s*\/\s*f(?:alse)?\s*\)/i.test(question))  return 'tf';
    if (/\btrue\s+or\s+false\b/i.test(question))                   return 'tf';
    if (/\bstate\s+(?:whether|if).*(?:true|false)\b/i.test(question)) return 'tf';

    // Options are exactly [ True, False ]
    const optVals = Object.values(opts).map(v => v.trim().toLowerCase());
    if (optVals.length === 2 &&
        optVals[0] === 'true' && optVals[1] === 'false') return 'tf';

    // ── Fill in the Blank ────────────────────

    // Question contains a blank placeholder
    if (/_{2,}|\.{3,}|\[_+\]|\[\s*blank\s*\]/i.test(question)) return 'fib';

    // Has a non-letter answer with fewer than 2 MCQ options
    if (rawAnswer &&
        Object.keys(opts).length < 2 &&
        !/^[A-D]$/i.test(rawAnswer))   return 'fib';

    // ── MCQ (default) ────────────────────────
    return 'mcq';
  }

  // ════════════════════════
  // ANSWER NORMALISER
  // ════════════════════════

  function _normalizeAnswer(raw, opts, type) {
    const trimmed = (raw || '').trim();

    if (type === 'tf') {
      // Anything starting with 'f' → False; otherwise True
      return /^f/i.test(trimmed) ? 'False' : 'True';
    }

    if (type === 'fib') return trimmed;

    // ── MCQ ──────────────────────────────────

    // Plain letter: A / B / C / D
    if (/^[A-D]$/i.test(trimmed)) return trimmed.toUpperCase();

    // "A) text"  or  "A. text"  or  "A - text" — extract letter
    const leadM = trimmed.match(/^([A-D])[\)\.\s\-]/i);
    if (leadM) return leadM[1].toUpperCase();

    // Full option text — exact match (case-insensitive)
    const exact = Object.entries(opts).find(
      ([, v]) => v && v.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exact) return exact[0];

    // Partial match: answer starts with the option's first 20 characters
    if (trimmed.length > 4) {
      const partial = Object.entries(opts).find(([, v]) => {
        if (!v || v.length < 4) return false;
        const prefix = v.toLowerCase().slice(0, 20);
        return trimmed.toLowerCase().startsWith(prefix);
      });
      if (partial) return partial[0];
    }

    // Contains option letter anywhere: "option A" / "choice B"
    const containsM = trimmed.match(/\b([A-D])\b/i);
    if (containsM) return containsM[1].toUpperCase();

    return 'A'; // last-resort
  }

  // ════════════════════════
  // MARKDOWN STRIPPER
  // ════════════════════════

  /**
   * Remove markdown formatting while preserving meaningful content:
   *  - Keeps Unicode symbols: ², ³, ₂, ₃, °, ×, ÷, √, π, ₹, etc.
   *  - Keeps underscores within words (H_2O, snake_case)
   *  - Keeps backtick content (code / formula)
   *  - Strips: **bold**, *italic*, _standalone italic_, ~~strike~~, ## headings
   */
  function _stripMd(text) {
    return String(text || '')
      // bold/italic — only strip when NOT adjacent to alphanumeric chars
      // Preserves math symbols: 3*4, x*y, 2**3, E=mc*c, H2SO4*2 etc.
      .replace(/(?<![A-Za-z0-9\u0080-\uFFFF])\*{1,3}([^*\n]+?)\*{1,3}(?![A-Za-z0-9\u0080-\uFFFF])/g, '$1')
      // _italic_ — only when NOT flanked by alphanumeric (preserves H_2O, x_1, subscripts)
      .replace(/(?<![A-Za-z0-9\u0080-\uFFFF])_([^_\n]+?)_(?![A-Za-z0-9\u0080-\uFFFF])/g, '$1')
      // `inline code` — keep content (useful for formula notation)
      .replace(/`([^`\n]+?)`/g, '$1')
      // ~~strikethrough~~
      .replace(/~~([^~\n]+?)~~/g, '$1')
      // ## heading prefix
      .replace(/^#{1,6}\s+/gm, '')
      // Stray leading asterisk only when followed by space (not math like *3 or *x)
      .replace(/^\*+(?=\s)/, '')
      .trim();
  }

  // ════════════════════════
  // STATS
  // ════════════════════════

  function _makeStats(parsed) {
    return {
      total  : parsed.length,
      mcq    : parsed.filter(q => q.type === 'mcq').length,
      tf     : parsed.filter(q => q.type === 'tf').length,
      fib    : parsed.filter(q => q.type === 'fib').length,
      failed : 0,
      blocks : 0,
    };
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { parse };

})();
