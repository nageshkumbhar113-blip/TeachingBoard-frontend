/* ════════════════════════════════════════
   homeSearch.js — Home screen search: Notes concepts + Exercise questions
   Combines the existing API.searchSlsConcepts (Notes) with the new
   API.searchExerciseQuestions (Exercise) into one input, one results list.
   Global: HOME_SEARCH
   Additive-only — doesn't touch app.js's home-rendering logic or any
   existing screen; the results block only appears once the student
   actually types 2+ characters, and disappears when cleared.
════════════════════════════════════════ */

const HOME_SEARCH = (() => {
  const $ = id => document.getElementById(id);
  const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  let _debounceTimer = null;
  let _seq = 0; // guards a slower, now-stale request from overwriting a newer one

  function init() {
    const input = $('home-search-input');
    const clearBtn = $('home-search-clear');
    if (!input) return;

    input.addEventListener('input', () => {
      if (clearBtn) clearBtn.style.display = input.value ? '' : 'none';
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => _runSearch(input.value.trim()), 350);
    });
    clearBtn?.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      _seq++; // invalidate any in-flight search
      _renderResults(null, null);
    });
  }

  async function _runSearch(query) {
    const results = $('home-search-results');
    if (!results) return;
    if (query.length < 2) { _seq++; _renderResults(null, null); return; }
    if (!navigator.onLine) {
      results.classList.remove('hidden');
      results.innerHTML = '<div class="home-search-empty">Internet नाही — search साठी online असणं आवश्यक आहे.</div>';
      return;
    }

    const mySeq = ++_seq;
    results.classList.remove('hidden');
    results.innerHTML = '<div class="home-search-loading">शोधत आहे…</div>';

    try {
      const [concepts, questions] = await Promise.all([
        API.searchSlsConcepts(query, 8).catch(() => []),
        API.searchExerciseQuestions(query, 8).catch(() => []),
      ]);
      if (mySeq !== _seq) return; // a newer search superseded this one
      _renderResults(concepts, questions);
    } catch {
      if (mySeq !== _seq) return;
      results.innerHTML = '<div class="home-search-empty">Search करता आलं नाही — पुन्हा प्रयत्न करा.</div>';
    }
  }

  function _renderResults(concepts, questions) {
    const results = $('home-search-results');
    if (!results) return;
    if (concepts === null) { results.classList.add('hidden'); results.innerHTML = ''; return; }

    if (!concepts.length && !questions.length) {
      results.innerHTML = '<div class="home-search-empty">काहीही सापडलं नाही.</div>';
      return;
    }

    let html = '';
    if (concepts.length) {
      html += '<div class="home-search-group-label">📓 Notes</div>';
      html += concepts.map(c => `
        <button type="button" class="home-search-result" data-type="concept"
          data-id="${_esc(c._id)}" data-chapter-id="${_esc(c.chapterId)}">
          <div class="home-search-result-title">${_esc(c.title?.english || c.title?.marathi || '')}</div>
        </button>`).join('');
    }
    if (questions.length) {
      html += '<div class="home-search-group-label">📝 Exercise</div>';
      html += questions.map(q => {
        const qText = (q.questionText?.marathi || q.questionText?.english || '');
        return `
        <button type="button" class="home-search-result" data-type="question"
          data-id="${_esc(q.id)}" data-batch="${_esc(q.batchName)}" data-subject="${_esc(q.subjectName)}"
          data-chapter="${_esc(q.chapterName)}" data-exercise="${_esc(q.exerciseNo)}">
          <div class="home-search-result-title">${_esc(qText.length > 90 ? qText.slice(0, 90) + '…' : qText)}</div>
          <div class="home-search-result-meta">${_esc(q.chapterName)} · Exercise ${_esc(q.exerciseNo)}</div>
        </button>`;
      }).join('');
    }
    results.innerHTML = html;

    results.querySelectorAll('.home-search-result').forEach(btn => {
      btn.addEventListener('click', () => _openResult(btn.dataset));
    });
  }

  async function _openResult(data) {
    if (data.type === 'concept') {
      await window.NOTES_VIEWER?.init();
      // NOTE: APP is a top-level `const` in app.js, not `window.APP` —
      // bare identifier, same convention used throughout student-app/*.js.
      APP?.navigate?.('notes');
      await window.NOTES_VIEWER?.selectChapter(data.chapterId);
      await window.NOTES_VIEWER?.viewConcept(data.id);
    } else if (data.type === 'question') {
      await window.EXERCISE_VIEWER?.openQuestion(data.batch, data.subject, data.chapter, data.exercise, data.id);
    }
  }

  return { init };
})();

window.HOME_SEARCH = HOME_SEARCH;
document.addEventListener('DOMContentLoaded', () => HOME_SEARCH.init());
