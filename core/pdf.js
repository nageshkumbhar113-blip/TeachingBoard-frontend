const PDF = (() => {
  async function exportQuestionPaper(questions, meta = {}) {
    if (!Array.isArray(questions) || !questions.length) {
      APP.toast("No questions to export", "error");
      return;
    }

    const sections = _normalizeSections(
      meta.sections && meta.sections.length ? meta.sections : _groupQuestionsByType(questions),
      meta
    );

    if (!sections.length) {
      APP.toast("No questions to export", "error");
      return;
    }

    _openPrintWindow(_buildPrintHtml(sections, meta));
  }

  async function exportQuizPaper(quiz) {
    if (!quiz) {
      APP.toast("No quiz to export", "error");
      return;
    }

    const batchQuestions = await DB.getQuestionsByBatch(quiz.batch || "");
    const allQuestions = batchQuestions.length ? batchQuestions : await DB.getAllQuestions();
    // Merge embedded questions (backend/remote quizzes) so export works without
    // requiring questions to be in the standalone IDB store
    const embedded = (quiz.questions || []).filter(q => q.q_id);
    const questionMap = Object.fromEntries([
      ...allQuestions.map(q => [q.q_id, q]),
      ...embedded.map(q => [q.q_id, q]),
    ]);

    const sections = (quiz.sections || [])
      .map((section, index) => {
        const sectionQuestions = (section.question_ids || [])
          .map((questionId) => questionMap[questionId])
          .filter(Boolean);

        if (!sectionQuestions.length) {
          return null;
        }

        return {
          label: section.label || `Section ${String.fromCharCode(65 + index)}`,
          type: section.type || sectionQuestions[0]?.type || "mcq",
          marks: _toNumber(section.positive_marks, quiz.positive_marks, 1),
          negativeMarks: _toNumber(section.negative_marks, quiz.negative_marks, 0),
          questions: sectionQuestions
        };
      })
      .filter(Boolean);

    if (!sections.length) {
      APP.toast("No questions in this quiz", "error");
      return;
    }

    _openPrintWindow(
      _buildPrintHtml(sections, {
        ...quiz,
        title: quiz.title || "Quiz Paper",
        includeAnswerKey: true
      })
    );
  }

  function _buildPrintHtml(rawSections, meta = {}) {
    const sections = _normalizeSections(rawSections, meta);
    const date = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);
    const totalMarks = sections.reduce(
      (sum, section) => sum + section.questions.length * section.marks,
      0
    );
    const instructions = _buildInstructions(meta, totalQuestions);
    const paperTitle = meta.title || "Question Paper";
    const paperMeta = [meta.batch, meta.subject, meta.chapter].filter(Boolean).join(" > ");
    const sectionHtml = _renderSections(sections);
    const answerKeyHtml = meta.includeAnswerKey === false ? "" : _renderAnswerKey(sections);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${_esc(paperTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --border: #1f2937;
      --muted: #5b6472;
      --soft: #eef2f7;
      --soft-border: #cbd5e1;
      --paper: #ffffff;
      --ink: #111827;
    }
    body {
      margin: 0;
      color: var(--ink);
      background: #f3f4f6;
      font-family: "Georgia", "Times New Roman", serif;
      line-height: 1.5;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 16mm 14mm 18mm;
      background: var(--paper);
    }
    .page + .page {
      margin-top: 12px;
    }
    .header {
      border: 2px solid var(--border);
      padding: 14px 16px 12px;
      margin-bottom: 14px;
    }
    .school-name {
      font-size: 20pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .paper-title {
      margin-top: 4px;
      font-size: 15pt;
      font-weight: 700;
      text-align: center;
    }
    .paper-subtitle {
      margin-top: 6px;
      text-align: center;
      font-size: 10.5pt;
      color: var(--muted);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 12px;
      font-size: 10.5pt;
    }
    .meta-box {
      padding: 8px 10px;
      border: 1px solid var(--soft-border);
      background: var(--soft);
    }
    .meta-label {
      display: block;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 2px;
    }
    .instructions {
      border: 1px solid var(--soft-border);
      background: #fafafa;
      padding: 10px 12px;
      margin-bottom: 14px;
    }
    .instructions h3 {
      margin: 0 0 6px;
      font-size: 11pt;
    }
    .instructions ul {
      margin: 0;
      padding-left: 18px;
      font-size: 10.5pt;
    }
    .section {
      margin-top: 18px;
      page-break-inside: avoid;
    }
    .section:first-of-type {
      margin-top: 0;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      padding-bottom: 6px;
      border-bottom: 2px solid var(--border);
      margin-bottom: 10px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
    }
    .section-meta {
      text-align: right;
      font-size: 9.5pt;
      color: var(--muted);
      white-space: nowrap;
    }
    .section-note {
      margin-bottom: 10px;
      font-size: 10pt;
      color: var(--muted);
    }
    .question {
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .question-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .question-number {
      width: 26px;
      font-weight: 700;
      flex: 0 0 26px;
    }
    .question-body {
      flex: 1;
      min-width: 0;
    }
    .question-text {
      font-size: 11pt;
      white-space: pre-wrap;
    }
    .marks {
      margin-left: 8px;
      font-size: 9pt;
      color: var(--muted);
    }
    .options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 16px;
      margin: 8px 0 0 0;
      padding-left: 0;
      list-style: none;
      font-size: 10.5pt;
    }
    .option {
      display: flex;
      gap: 8px;
    }
    .option-key {
      min-width: 18px;
      font-weight: 700;
    }
    .inline-choice {
      margin-top: 8px;
      font-size: 10.5pt;
      color: var(--muted);
    }
    .blank-line {
      display: inline-block;
      min-width: 180px;
      border-bottom: 1px solid #374151;
      transform: translateY(-2px);
    }
    .pair-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px 18px;
      margin-top: 8px;
      font-size: 10.5pt;
    }
    .pair-col {
      border: 1px solid var(--soft-border);
      padding: 8px 10px;
      background: #fafafa;
    }
    .pair-col h4 {
      margin: 0 0 6px;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .pair-item {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
    }
    .pair-item:last-child {
      margin-bottom: 0;
    }
    .answer-key-page {
      page-break-before: always;
    }
    .answer-key-title {
      font-size: 14pt;
      font-weight: 700;
      margin-bottom: 4px;
      text-align: center;
    }
    .answer-key-sub {
      margin-bottom: 14px;
      text-align: center;
      color: var(--muted);
      font-size: 10pt;
    }
    .answer-key-section {
      margin-top: 16px;
    }
    .answer-key-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 14px;
      margin-top: 8px;
    }
    .answer-key-item {
      border: 1px solid var(--soft-border);
      background: #fafafa;
      padding: 8px 10px;
      font-size: 10pt;
      break-inside: avoid;
    }
    .answer-key-item strong {
      display: inline-block;
      min-width: 30px;
    }
    .print-hint {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      padding: 12px;
      background: rgba(17, 24, 39, 0.92);
      color: #fff;
      font: 600 14px/1.4 Arial, sans-serif;
    }
    @page {
      size: A4;
      margin: 12mm;
    }
    @media print {
      body {
        background: #fff;
      }
      .print-hint {
        display: none;
      }
      .page,
      .page + .page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="print-hint">Opening print dialog...</div>
  <main class="page">
    <header class="header">
      ${meta.school_name || meta.schoolName ? `<div class="school-name">${_esc(meta.school_name || meta.schoolName)}</div>` : ""}
      <div class="paper-title">${_esc(paperTitle)}</div>
      ${paperMeta ? `<div class="paper-subtitle">${_esc(paperMeta)}</div>` : ""}
      <div class="meta-grid">
        <div class="meta-box">
          <span class="meta-label">Date</span>
          ${_esc(date)}
        </div>
        <div class="meta-box">
          <span class="meta-label">Questions</span>
          ${totalQuestions}
        </div>
        <div class="meta-box">
          <span class="meta-label">Total Marks</span>
          ${_formatMarks(totalMarks)}
        </div>
      </div>
    </header>

    <section class="instructions">
      <h3>Instructions</h3>
      <ul>
        ${instructions.map((instruction) => `<li>${_esc(instruction)}</li>`).join("")}
      </ul>
    </section>

    ${sectionHtml}
  </main>

  ${answerKeyHtml}
</body>
</html>`;
  }

  function _renderSections(sections) {
    let questionNumber = 0;

    return sections
      .map((section, sectionIndex) => {
        const startNumber = questionNumber + 1;
        const questionsHtml = section.questions
          .map((question) => {
            questionNumber += 1;
            return _renderQuestion(question, questionNumber, section.marks);
          })
          .join("");
        const endNumber = questionNumber;
        const questionRange = startNumber === endNumber ? `${startNumber}` : `${startNumber}-${endNumber}`;
        const totalSectionMarks = section.questions.length * section.marks;

        return `
          <section class="section">
            <div class="section-header">
              <div class="section-title">${_esc(section.label || `Section ${sectionIndex + 1}`)}</div>
              <div class="section-meta">
                ${section.questions.length} questions | ${_formatMarks(section.marks)} each | ${_formatMarks(totalSectionMarks)} total
              </div>
            </div>
            <div class="section-note">
              Attempt questions ${_esc(questionRange)}. Type: ${_esc(_typeLabel(section.type))}
            </div>
            ${questionsHtml}
          </section>
        `;
      })
      .join("");
  }

  function _renderQuestion(question, number, marks) {
    const type = String(question.type || "mcq").toLowerCase();
    const questionText = _esc(question.question || "");
    let extraHtml = "";

    if (type === "mcq") {
      const options = _getOptionEntries(question);
      extraHtml = options.length
        ? `
          <ul class="options">
            ${options
              .map(
                ([key, value]) => `
                  <li class="option">
                    <span class="option-key">${_esc(key)})</span>
                    <span>${_esc(value)}</span>
                  </li>
                `
              )
              .join("")}
          </ul>
        `
        : "";
    } else if (type === "tf") {
      extraHtml = `<div class="inline-choice">True / False</div>`;
    } else if (type === "fib") {
      extraHtml = `<div class="inline-choice">Answer: <span class="blank-line"></span></div>`;
    } else if (type === "mtp") {
      const pairs = Array.isArray(question.pairs) ? question.pairs : [];
      extraHtml = `
        <div class="pair-grid">
          <div class="pair-col">
            <h4>Column A</h4>
            ${pairs
              .map(
                (pair, index) => `
                  <div class="pair-item">
                    <span class="option-key">${index + 1}.</span>
                    <span>${_esc(pair?.[0])}</span>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="pair-col">
            <h4>Column B</h4>
            ${pairs
              .map(
                (pair, index) => `
                  <div class="pair-item">
                    <span class="option-key">${String.fromCharCode(65 + index)}.</span>
                    <span>${_esc(pair?.[1])}</span>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    return `
      <article class="question">
        <div class="question-row">
          <div class="question-number">${number}.</div>
          <div class="question-body">
            <div class="question-text">${questionText}<span class="marks">[${_formatMarks(marks)}]</span></div>
            ${extraHtml}
          </div>
        </div>
      </article>
    `;
  }

  function _renderAnswerKey(sections) {
    let questionNumber = 0;

    return `
      <section class="page answer-key-page">
        <div class="answer-key-title">Answer Key</div>
        <div class="answer-key-sub">Use this page for review or teacher reference.</div>
        ${sections
          .map((section) => {
            const items = section.questions
              .map((question) => {
                questionNumber += 1;
                return `
                  <div class="answer-key-item">
                    <strong>Q${questionNumber}</strong>
                    <span>${_esc(_formatAnswer(question))}</span>
                  </div>
                `;
              })
              .join("");

            return `
              <div class="answer-key-section">
                <div class="section-header">
                  <div class="section-title">${_esc(section.label)}</div>
                  <div class="section-meta">${section.questions.length} answers</div>
                </div>
                <div class="answer-key-grid">
                  ${items}
                </div>
              </div>
            `;
          })
          .join("")}
      </section>
    `;
  }

  function _normalizeSections(rawSections, meta) {
    return (rawSections || [])
      .map((section, index) => ({
        label: section.label || `Section ${String.fromCharCode(65 + index)}`,
        type: String(section.type || section.questions?.[0]?.type || "mcq").toLowerCase(),
        marks: _toNumber(section.marks, section.positive_marks, meta.positive_marks, 1),
        negativeMarks: _toNumber(section.negativeMarks, section.negative_marks, meta.negative_marks, 0),
        questions: Array.isArray(section.questions) ? section.questions.filter(Boolean) : []
      }))
      .filter((section) => section.questions.length);
  }

  function _groupQuestionsByType(questions) {
    const groups = new Map();

    questions.forEach((question) => {
      const type = String(question._secType || question.type || "mcq").toLowerCase();
      const label = question._secLabel || _typeLabel(type);

      if (!groups.has(label)) {
        groups.set(label, {
          label,
          type,
          marks: _toNumber(question._posMarks, question.positive_marks, 1),
          negativeMarks: _toNumber(question._negMarks, question.negative_marks, 0),
          questions: []
        });
      }

      groups.get(label).questions.push(question);
    });

    return Array.from(groups.values());
  }

  function _buildInstructions(meta, totalQuestions) {
    const instructions = [
      "All questions are compulsory.",
      `Total questions: ${totalQuestions}.`,
      "Use the browser print dialog to save as PDF or print on paper."
    ];

    if (_toNumber(meta.negative_marks, 0) > 0) {
      instructions.push(`Negative marking applies: ${_formatMarks(meta.negative_marks)} per wrong answer.`);
    }

    if (meta.timer_mode === "full_test" && meta.timer_value) {
      instructions.push(`Time allowed: ${meta.timer_value} seconds for the full test.`);
    } else if (meta.timer_mode === "per_question" && meta.timer_value) {
      instructions.push(`Suggested time: ${meta.timer_value} seconds per question.`);
    }

    return instructions;
  }

  function _getOptionEntries(question) {
    const rawOptions = question.options || {};
    const preferredOrder = ["A", "B", "C", "D"];
    const entries = [];

    preferredOrder.forEach((key) => {
      if (rawOptions[key]) {
        entries.push([key, rawOptions[key]]);
      }
    });

    Object.entries(rawOptions).forEach(([key, value]) => {
      if (!preferredOrder.includes(key) && value) {
        entries.push([key, value]);
      }
    });

    return entries;
  }

  function _formatAnswer(question) {
    const type = String(question.type || "mcq").toLowerCase();

    if (type === "mcq") {
      const answer = String(question.answer || "");
      const optionText = question.options?.[answer];
      return optionText ? `${answer}) ${optionText}` : answer;
    }

    if (type === "mtp") {
      const pairs = Array.isArray(question.pairs) ? question.pairs : [];
      return pairs
        .map((pair) => `${pair?.[0] || ""} -> ${pair?.[1] || ""}`)
        .join("; ");
    }

    return String(question.answer || "");
  }

  function _typeLabel(type) {
    const labels = {
      mcq: "Multiple Choice Questions",
      tf: "True / False",
      fib: "Fill in the Blanks",
      mtp: "Match the Pairs"
    };

    return labels[type] || String(type || "Questions").toUpperCase();
  }

  function _formatMarks(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, "");
  }

  function _toNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return number;
      }
    }

    return 0;
  }

  function _openPrintWindow(html) {
    const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=900");

    if (!win) {
      APP.toast("Allow popups to export PDF", "error");
      return;
    }

    const printNow = () => {
      win.focus();
      win.print();
    };

    win.onload = () => {
      setTimeout(printNow, 150);
    };

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function _esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { exportQuestionPaper, exportQuizPaper };
})();
