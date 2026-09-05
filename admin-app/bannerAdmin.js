/* ════════════════════════════════════════
   bannerAdmin.js — Home Banners Admin
   Student Home screen promo carousel — create/edit/delete,
   scoped per-batch or all-batches.
   Global: BANNER_ADMIN
════════════════════════════════════════ */

const BANNER_ADMIN = (() => {
  const $ = id => document.getElementById(id);

  // HTML-escape — same convention as batchPricingManager.js's own _esc.
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let _banners = [];
  let _editingId = null;
  let _listenersBound = false;
  let _submitting = false;
  let _quotes = [];

  function _apiBase() {
    return (window.API?.getApiUrl?.() || window.TEACHINGBOARD_API_URL || '').replace(/\/+$/, '');
  }

  async function _authHeaders(extra = {}) {
    let token = '';
    try {
      token = await API.ensureAdminSession();
    } catch {
      token = API.getAdminToken?.() || '';
    }
    return { Authorization: `Bearer ${token}`, ...extra };
  }

  // ════════════════════════
  // INITIALIZATION
  // ════════════════════════

  async function init() {
    console.log('🎯 Initializing Banner Admin');
    if (!_listenersBound) {
      _setupEventListeners();
      _listenersBound = true;
    }
    await _populateBatchOptions();
    await loadBanners();
    await loadQuotes();
  }

  function _setupEventListeners() {
    $('banner-new-btn')?.addEventListener('click', () => _showForm(null));
    $('banner-form')?.addEventListener('submit', e => { e.preventDefault(); _submitForm(); });
    $('banner-cancel-btn')?.addEventListener('click', () => _hideForm());
    $('banner-close-btn')?.addEventListener('click', () => _hideForm());
    $('quote-new-btn')?.addEventListener('click', () => _newQuote());

    $('banner-link-type')?.addEventListener('change', _syncLinkFieldsVisibility);
    document.querySelectorAll('input[name="banner-scope"]').forEach(r => {
      r.addEventListener('change', _syncScopeFieldsVisibility);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('banner-modal')?.classList.contains('hidden')) _hideForm();
    });
  }

  // ════════════════════════
  // BATCH OPTIONS — reused for both the "link to a batch" select and the
  // "specific batches" scope checklist (same source, DB.getAllBatches —
  // already the shared local catalog admin.js itself uses).
  // ════════════════════════

  async function _populateBatchOptions() {
    const batches = await DB.getAllBatches();

    const linkSelect = $('banner-link-batch');
    if (linkSelect) {
      linkSelect.innerHTML = batches.length
        ? batches.map(b => `<option value="${_esc(b.name)}">${_esc(b.icon || '')} ${_esc(b.name)}</option>`).join('')
        : '<option value="">कुठलाही Batch नाही — आधी Classes tab मध्ये तयार करा</option>';
    }

    const checklist = $('banner-batch-checklist');
    if (checklist) {
      checklist.innerHTML = batches.length
        ? batches.map(b => `
            <label class="student-batch-item">
              <input type="checkbox" class="banner-batch-cb" value="${_esc(b.name)}" />
              <span>${_esc(b.icon || '')} ${_esc(b.name)}</span>
            </label>`).join('')
        : '<p class="empty-hint">आधी Classes tab मध्ये batch तयार करा.</p>';
    }
  }

  function _selectedScopeBatches() {
    return [...document.querySelectorAll('#banner-batch-checklist input.banner-batch-cb:checked')]
      .map(inp => String(inp.value || '').trim())
      .filter(Boolean);
  }

  function _setSelectedScopeBatches(names) {
    const set = new Set(Array.isArray(names) ? names : []);
    document.querySelectorAll('#banner-batch-checklist input.banner-batch-cb').forEach(inp => {
      inp.checked = set.has(inp.value);
    });
  }

  // ════════════════════════
  // FORM FIELD VISIBILITY
  // ════════════════════════

  function _syncLinkFieldsVisibility() {
    const type = $('banner-link-type')?.value || 'none';
    $('banner-link-batch-group')?.classList.toggle('hidden', type !== 'batch');
    $('banner-link-url-group')?.classList.toggle('hidden', type !== 'url');
  }

  function _syncScopeFieldsVisibility() {
    const scope = document.querySelector('input[name="banner-scope"]:checked')?.value || 'all';
    $('banner-scope-batches-group')?.classList.toggle('hidden', scope !== 'batches');
  }

  // ════════════════════════
  // LOAD + RENDER LIST
  // ════════════════════════

  async function loadBanners() {
    try {
      const response = await fetch(`${_apiBase()}/admin/banners`, { headers: await _authHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      _banners = result.banners || [];
      _renderList();
    } catch (err) {
      console.error('❌ Failed to load banners:', err);
      APP.toast('Banners load करता आले नाहीत', 'error');
    }
  }

  function _renderList() {
    const container = $('banner-list');
    if (!container) return;

    if (_banners.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:2rem;color:#666;">
          <p>🎯 अजून एकही banner नाही. वर "नवीन Banner" ने सुरुवात करा!</p>
        </div>`;
      return;
    }

    container.innerHTML = _banners.map(b => {
      const scopeLabel = b.scope === 'all'
        ? '🌐 All Batches'
        : `🎯 ${(b.batchNames || []).map(_esc).join(', ') || '(कुठलाही batch निवडलेला नाही)'}`;
      const statusBadge = b.active ? '✅ Active' : '⏸️ Off';
      const statusClass = b.active ? 'bp-paid' : 'bp-warning';
      const linkLabel = b.linkType === 'batch' ? `Batch: ${_esc(b.linkValue)}`
        : b.linkType === 'url' ? `Link: ${_esc(b.linkValue)}`
        : 'फक्त माहितीसाठी';

      return `
        <div class="bp-batch-card" data-banner-id="${_esc(b.banner_id)}">
          <div class="bp-batch-header">
            ${b.imageUrl ? `<img src="${_esc(b.imageUrl)}" alt="" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;" />` : `<span class="bp-batch-icon">🎯</span>`}
            <span class="bp-batch-name">${_esc(b.title)}</span>
            <span class="bp-badge ${statusClass}">${statusBadge}</span>
          </div>
          <div class="bp-batch-details">
            ${b.subtitle ? `<div class="bp-detail-row"><span class="bp-label">Subtitle:</span><span class="bp-value">${_esc(b.subtitle)}</span></div>` : ''}
            <div class="bp-detail-row"><span class="bp-label">दिसेल:</span><span class="bp-value">${scopeLabel}</span></div>
            <div class="bp-detail-row"><span class="bp-label">Tap:</span><span class="bp-value">${linkLabel}</span></div>
            <div class="bp-detail-row"><span class="bp-label">क्रम:</span><span class="bp-value">${Number(b.order) || 0}</span></div>
            <div class="bp-detail-row"><span class="bp-label">👁️ किती वेळा उघडलं:</span><span class="bp-value">${Number(b.openCount) || 0}</span></div>
          </div>
          <div class="bp-batch-actions">
            <button class="bp-btn bp-btn-edit" onclick="BANNER_ADMIN.editBanner('${_esc(b.banner_id)}')">✏️ Edit</button>
            <button class="bp-btn bp-btn-delete" onclick="BANNER_ADMIN.deleteBanner('${_esc(b.banner_id)}')">🗑️ Delete</button>
          </div>
        </div>`;
    }).join('');
  }

  // ════════════════════════
  // FORM
  // ════════════════════════

  function _resetForm() {
    if ($('banner-title'))     $('banner-title').value = '';
    if ($('banner-subtitle'))  $('banner-subtitle').value = '';
    if ($('banner-image-url')) $('banner-image-url').value = '';
    if ($('banner-link-type')) $('banner-link-type').value = 'none';
    if ($('banner-link-batch')) $('banner-link-batch').value = '';
    if ($('banner-link-url'))  $('banner-link-url').value = '';
    if ($('banner-order'))     $('banner-order').value = '0';
    if ($('banner-active'))    $('banner-active').checked = true;
    const allRadio = document.querySelector('input[name="banner-scope"][value="all"]');
    if (allRadio) allRadio.checked = true;
    _setSelectedScopeBatches([]);
    _syncLinkFieldsVisibility();
    _syncScopeFieldsVisibility();
    const errEl = $('banner-error-msg');
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
  }

  function _showError(msg) {
    const errEl = $('banner-error-msg');
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    else APP.toast(msg, 'error');
  }

  function _showForm(banner) {
    const modal = $('banner-modal');
    if (!modal) return;

    _resetForm();
    const isNew = !banner;
    $('banner-modal-title') && ($('banner-modal-title').textContent = isNew ? '➕ नवीन Banner' : '✏️ Banner Edit करा');

    if (!isNew) {
      _editingId = banner.banner_id;
      if ($('banner-title'))     $('banner-title').value = banner.title || '';
      if ($('banner-subtitle'))  $('banner-subtitle').value = banner.subtitle || '';
      if ($('banner-image-url')) $('banner-image-url').value = banner.imageUrl || '';
      if ($('banner-link-type')) $('banner-link-type').value = banner.linkType || 'none';
      if (banner.linkType === 'batch' && $('banner-link-batch')) $('banner-link-batch').value = banner.linkValue || '';
      if (banner.linkType === 'url'   && $('banner-link-url'))   $('banner-link-url').value = banner.linkValue || '';
      if ($('banner-order'))  $('banner-order').value = Number(banner.order) || 0;
      if ($('banner-active')) $('banner-active').checked = !!banner.active;
      const scopeRadio = document.querySelector(`input[name="banner-scope"][value="${banner.scope === 'batches' ? 'batches' : 'all'}"]`);
      if (scopeRadio) scopeRadio.checked = true;
      _setSelectedScopeBatches(banner.batchNames || []);
      _syncLinkFieldsVisibility();
      _syncScopeFieldsVisibility();
    } else {
      _editingId = null;
    }

    modal.classList.remove('hidden');
    modal.classList.add('visible');
    setTimeout(() => $('banner-title')?.focus(), 50);
  }

  function _hideForm() {
    const modal = $('banner-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('visible'); }
    _resetForm();
    _editingId = null;
  }

  async function editBanner(bannerId) {
    const banner = _banners.find(b => b.banner_id === bannerId);
    if (!banner) return APP.toast('Banner सापडला नाही', 'error');
    _showForm(banner);
  }

  async function _submitForm() {
    if (_submitting) return;

    const title = ($('banner-title')?.value || '').trim();
    if (!title) return _showError('Title आवश्यक आहे');

    const linkType = $('banner-link-type')?.value || 'none';
    let linkValue = '';
    if (linkType === 'batch') {
      linkValue = $('banner-link-batch')?.value || '';
      if (!linkValue) return _showError('Batch निवडा');
    } else if (linkType === 'url') {
      linkValue = ($('banner-link-url')?.value || '').trim();
      if (!linkValue) return _showError('Link (URL) टाका');
    }

    const scope = document.querySelector('input[name="banner-scope"]:checked')?.value || 'all';
    const batchNames = scope === 'batches' ? _selectedScopeBatches() : [];
    if (scope === 'batches' && batchNames.length === 0) return _showError('कमीत कमी एक Batch निवडा');

    const payload = {
      title,
      subtitle:  ($('banner-subtitle')?.value || '').trim(),
      imageUrl:  ($('banner-image-url')?.value || '').trim(),
      linkType,
      linkValue,
      scope,
      batchNames,
      order:  parseInt($('banner-order')?.value, 10) || 0,
      active: !!$('banner-active')?.checked,
    };

    const submitBtn = $('banner-submit-btn');
    const originalText = submitBtn?.textContent;
    _submitting = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Saving...'; }

    try {
      const isNew = !_editingId;
      const url = isNew ? `${_apiBase()}/admin/banners` : `${_apiBase()}/admin/banners/${encodeURIComponent(_editingId)}`;
      const response = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: await _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { errMsg = (await response.json())?.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      APP.toast(isNew ? 'Banner तयार झाला! 🎉' : 'Banner update झाला! ✅', 'success');
      _hideForm();
      await loadBanners();
    } catch (err) {
      console.error('❌ Failed to save banner:', err);
      _showError(err.message || 'Banner save करता आला नाही');
    } finally {
      _submitting = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText || '💾 Save Banner'; }
    }
  }

  // ════════════════════════
  // DELETE
  // ════════════════════════

  async function deleteBanner(bannerId) {
    const banner = _banners.find(b => b.banner_id === bannerId);
    const confirmed = await APP.confirmAsync(`"${banner?.title || 'हा banner'}" कायमचं delete करायचं?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${_apiBase()}/admin/banners/${encodeURIComponent(bannerId)}`, {
        method: 'DELETE',
        headers: await _authHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      APP.toast('Banner delete झाला 🗑️', 'success');
      await loadBanners();
    } catch (err) {
      console.error('❌ Failed to delete banner:', err);
      APP.toast('Banner delete करता आला नाही', 'error');
    }
  }

  // ════════════════════════
  // DEFAULT QUOTES — admin-editable fallback text shown on the student
  // Home carousel only when that student has zero active Banners (see
  // this file's own comment header + bannerController.js).
  // ════════════════════════

  async function loadQuotes() {
    try {
      const response = await fetch(`${_apiBase()}/admin/banners/default-quotes`, { headers: await _authHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      _quotes = result.quotes || [];
      _renderQuotesList();
    } catch (err) {
      console.error('❌ Failed to load default quotes:', err);
      APP.toast('Quotes load करता आले नाहीत', 'error');
    }
  }

  function _renderQuotesList() {
    const container = $('quote-list');
    if (!container) return;

    if (_quotes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:2rem;color:#666;">
          <p>💬 अजून custom quote नाही — Banner नसेल तेव्हा app मधलं built-in वाक्य दिसेल.</p>
        </div>`;
      return;
    }

    container.innerHTML = _quotes.map(q => {
      const statusBadge = q.active ? '✅ Active' : '⏸️ Off';
      const statusClass = q.active ? 'bp-paid' : 'bp-warning';
      return `
        <div class="bp-batch-card" data-quote-id="${_esc(q.quote_id)}">
          <div class="bp-batch-header">
            <span class="bp-batch-icon">💬</span>
            <span class="bp-batch-name">${_esc(q.text)}</span>
            <span class="bp-badge ${statusClass}">${statusBadge}</span>
          </div>
          <div class="bp-batch-details">
            <div class="bp-detail-row"><span class="bp-label">क्रम:</span><span class="bp-value">${Number(q.order) || 0}</span></div>
          </div>
          <div class="bp-batch-actions">
            <button class="bp-btn bp-btn-edit" onclick="BANNER_ADMIN.editQuote('${_esc(q.quote_id)}')">✏️ Edit</button>
            <button class="bp-btn" onclick="BANNER_ADMIN.toggleQuoteActive('${_esc(q.quote_id)}')">${q.active ? '⏸️ Off करा' : '▶️ Active करा'}</button>
            <button class="bp-btn bp-btn-delete" onclick="BANNER_ADMIN.deleteQuote('${_esc(q.quote_id)}')">🗑️ Delete</button>
          </div>
        </div>`;
    }).join('');
  }

  async function _newQuote() {
    const text = await APP.promptAsync('नवीन Quote (वाक्य):', 'text', '');
    if (!text || !text.trim()) return;
    try {
      const response = await fetch(`${_apiBase()}/admin/banners/default-quotes`, {
        method: 'POST',
        headers: await _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      APP.toast('Quote तयार झाला! 🎉', 'success');
      await loadQuotes();
    } catch (err) {
      console.error('❌ Failed to create quote:', err);
      APP.toast('Quote save करता आला नाही', 'error');
    }
  }

  async function editQuote(quoteId) {
    const quote = _quotes.find(q => q.quote_id === quoteId);
    if (!quote) return APP.toast('Quote सापडला नाही', 'error');
    const text = await APP.promptAsync('Quote edit करा:', 'text', quote.text);
    if (!text || !text.trim() || text.trim() === quote.text) return;
    try {
      const response = await fetch(`${_apiBase()}/admin/banners/default-quotes/${encodeURIComponent(quoteId)}`, {
        method: 'PUT',
        headers: await _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      APP.toast('Quote update झाला ✅', 'success');
      await loadQuotes();
    } catch (err) {
      console.error('❌ Failed to update quote:', err);
      APP.toast('Quote update करता आला नाही', 'error');
    }
  }

  async function toggleQuoteActive(quoteId) {
    const quote = _quotes.find(q => q.quote_id === quoteId);
    if (!quote) return APP.toast('Quote सापडला नाही', 'error');
    try {
      const response = await fetch(`${_apiBase()}/admin/banners/default-quotes/${encodeURIComponent(quoteId)}`, {
        method: 'PUT',
        headers: await _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ active: !quote.active }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadQuotes();
    } catch (err) {
      console.error('❌ Failed to toggle quote:', err);
      APP.toast('Quote update करता आला नाही', 'error');
    }
  }

  async function deleteQuote(quoteId) {
    const quote = _quotes.find(q => q.quote_id === quoteId);
    const confirmed = await APP.confirmAsync(`"${quote?.text || 'हा quote'}" कायमचं delete करायचं?`);
    if (!confirmed) return;
    try {
      const response = await fetch(`${_apiBase()}/admin/banners/default-quotes/${encodeURIComponent(quoteId)}`, {
        method: 'DELETE',
        headers: await _authHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      APP.toast('Quote delete झाला 🗑️', 'success');
      await loadQuotes();
    } catch (err) {
      console.error('❌ Failed to delete quote:', err);
      APP.toast('Quote delete करता आला नाही', 'error');
    }
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, loadBanners, editBanner, deleteBanner, loadQuotes, editQuote, toggleQuoteActive, deleteQuote };
})();

window.BANNER_ADMIN = BANNER_ADMIN;
