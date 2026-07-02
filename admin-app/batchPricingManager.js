/* ════════════════════════════════════════
   batchPricingManager.js — Batch Pricing Admin
   Subscription pricing: monthly + yearly + free trial
   Global: BATCH_PRICING
════════════════════════════════════════ */

const BATCH_PRICING = (() => {
  const $ = id => document.getElementById(id);
  const _setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text ?? '';
    return el;
  };

  // HTML-escape to prevent XSS from batch name / description in innerHTML
  const _esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let _batches = [];
  let _editingBatch = null;
  let _listenersBound = false;
  let _submitting = false;

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
    console.log('🎓 Initializing Batch Pricing Manager');
    if (!_listenersBound) {
      _setupEventListeners();
      _listenersBound = true;
    }
    await loadBatches();
  }

  function _setupEventListeners() {
    $('bp-new-batch-btn')?.addEventListener('click', () => _showBatchForm(null));
    $('bp-batch-form')?.addEventListener('submit', e => { e.preventDefault(); _submitBatchForm(); });
    $('bp-cancel-btn')?.addEventListener('click', () => _hideBatchForm());
    $('bp-close-btn')?.addEventListener('click', () => _hideBatchForm());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('bp-batch-modal')?.classList.contains('hidden')) {
        _hideBatchForm();
      }
    });
  }

  // ════════════════════════
  // LOAD BATCHES
  // ════════════════════════

  async function loadBatches() {
    try {
      // Same endpoint Classes uses (/batches) — Pricing must show exactly
      // the batches created there, not a separate list. It now includes
      // monthly_price/yearly_price/trial_days in its response.
      const response = await fetch(`${_apiBase()}/batches`, {
        headers: await _authHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      _batches = (result.data || []).map(batch => ({
        name: batch.name,
        icon: batch.icon || '📚',
        monthly_price: batch.monthly_price || 0,
        yearly_price: batch.yearly_price || 0,
        trial_days: batch.trial_days != null ? batch.trial_days : 1,
        description: batch.description || '',
        is_active: batch.is_active !== false,
      }));

      _renderBatchesList();
    } catch (err) {
      console.error('❌ Failed to load batches:', err);
      APP.toast('Failed to load batches', 'error');
    }
  }

  // ════════════════════════
  // RENDER BATCHES LIST
  // ════════════════════════

  function _renderBatchesList() {
    const container = $('bp-batches-list');
    if (!container) return;

    if (_batches.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #666;">
          <p>📚 No batches yet. Create one to get started!</p>
        </div>`;
      return;
    }

    container.innerHTML = _batches.map(batch => {
      const hasPricing = batch.monthly_price > 0 || batch.yearly_price > 0;

      let statusBadge, statusClass, priceDisplay, editButtonText;
      if (!hasPricing) {
        statusBadge = '⚠️ Unpriced'; statusClass = 'bp-warning';
        priceDisplay = 'Not configured yet'; editButtonText = '⚙️ Setup Pricing';
      } else {
        statusBadge = '💳 Subscription'; statusClass = 'bp-paid';
        const parts = [];
        if (batch.monthly_price > 0) parts.push(`₹${batch.monthly_price}/mo`);
        if (batch.yearly_price > 0)  parts.push(`₹${batch.yearly_price}/yr`);
        if (batch.trial_days > 0)    parts.push(`${batch.trial_days}-day trial`);
        priceDisplay = parts.join('  •  ');
        editButtonText = '✏️ Edit';
      }

      const safeName = _esc(batch.name);
      const nameAttr = encodeURIComponent(batch.name);

      return `
        <div class="bp-batch-card" data-batch="${safeName}">
          <div class="bp-batch-header">
            <span class="bp-batch-icon">${_esc(batch.icon)}</span>
            <span class="bp-batch-name">${safeName}</span>
            <span class="bp-badge ${statusClass}">${statusBadge}</span>
          </div>
          <div class="bp-batch-details">
            <div class="bp-detail-row">
              <span class="bp-label">Plans:</span>
              <span class="bp-value">${_esc(priceDisplay)}</span>
            </div>
            ${batch.description ? `
              <div class="bp-detail-row">
                <span class="bp-label">Description:</span>
                <span class="bp-value">${_esc(batch.description)}</span>
              </div>` : ''}
          </div>
          <div class="bp-batch-actions">
            <button class="bp-btn bp-btn-edit" onclick="BATCH_PRICING.editBatch(decodeURIComponent('${nameAttr}'))">
              ${editButtonText}
            </button>
            <button class="bp-btn bp-btn-delete" onclick="BATCH_PRICING.deleteBatch(decodeURIComponent('${nameAttr}'))">
              🗑️ Delete
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ════════════════════════
  // BATCH FORM MANAGEMENT
  // ════════════════════════

  async function editBatch(batchName) {
    try {
      const response = await fetch(
        `${_apiBase()}/batches/${encodeURIComponent(batchName)}/pricing`,
        { headers: await _authHeaders() }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      _editingBatch = result.data;
      _showBatchForm(result.data);
    } catch (err) {
      console.error('❌ Failed to load batch:', err);
      APP.toast('Failed to load batch details', 'error');
    }
  }

  function _resetForm() {
    const nameInput = $('bp-batch-name');
    if (nameInput) { nameInput.value = ''; nameInput.disabled = false; }
    if ($('bp-monthly-price')) $('bp-monthly-price').value = '';
    if ($('bp-yearly-price'))  $('bp-yearly-price').value = '';
    if ($('bp-trial-days'))    $('bp-trial-days').value = '1';
    if ($('bp-description'))    $('bp-description').value = '';
    const errEl = $('bp-error-msg');
    if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
  }

  function _showError(msg) {
    const errEl = $('bp-error-msg');
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    else APP.toast(msg, 'error');
  }

  function _showBatchForm(batch) {
    const modal = $('bp-batch-modal');
    if (!modal) return;

    const isNewBatch = !batch;
    _setText('bp-modal-title', isNewBatch ? '➕ Create New Batch' : '✏️ Edit Batch');

    _resetForm();

    if (!isNewBatch) {
      const nameInput = $('bp-batch-name');
      nameInput.value = batch.name;
      nameInput.disabled = true;
      if ($('bp-monthly-price')) $('bp-monthly-price').value = batch.monthly_price || '';
      if ($('bp-yearly-price'))  $('bp-yearly-price').value = batch.yearly_price || '';
      if ($('bp-trial-days'))    $('bp-trial-days').value = batch.trial_days != null ? batch.trial_days : 1;
      if ($('bp-description'))    $('bp-description').value = batch.description || '';
    }

    modal.classList.remove('hidden');
    modal.classList.add('visible');
    setTimeout(() => $('bp-batch-name')?.focus(), 50);
  }

  function _hideBatchForm() {
    const modal = $('bp-batch-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible');
    }
    _resetForm();
    _editingBatch = null;
  }

  async function _submitBatchForm() {
    if (_submitting) return;

    const batchName = ($('bp-batch-name')?.value || '').trim();
    if (!batchName) return _showError('Batch name is required');

    const monthly = parseFloat($('bp-monthly-price')?.value) || 0;
    const yearly  = parseFloat($('bp-yearly-price')?.value) || 0;
    const trial   = parseInt($('bp-trial-days')?.value, 10);

    if (monthly < 0 || yearly < 0) return _showError('Prices cannot be negative');
    if (monthly <= 0 && yearly <= 0) return _showError('Set at least one of monthly or yearly price');
    if (isNaN(trial) || trial < 0) return _showError('Trial days must be 0 or greater');

    const payload = {
      monthly_price: monthly,
      yearly_price: yearly,
      trial_days: trial,
      description: ($('bp-description')?.value || '').trim(),
    };

    const submitBtn = $('bp-submit-btn');
    const originalText = submitBtn?.textContent;
    _submitting = true;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Saving...'; }

    try {
      const isNew = !_editingBatch;
      const url = isNew
        ? `${_apiBase()}/batches`
        : `${_apiBase()}/batches/${encodeURIComponent(batchName)}/pricing`;
      const method = isNew ? 'POST' : 'PUT';
      if (isNew) payload.name = batchName;

      const response = await fetch(url, {
        method,
        headers: await _authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try { errMsg = (await response.json())?.message || errMsg; } catch {}
        throw new Error(errMsg);
      }

      APP.toast(isNew ? 'Batch created successfully! 🎉' : 'Pricing updated successfully! ✅', 'success');
      _hideBatchForm();
      await loadBatches();
    } catch (err) {
      console.error('❌ Failed to save batch:', err);
      _showError(err.message || 'Failed to save batch');
    } finally {
      _submitting = false;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText || '💾 Save Batch'; }
    }
  }

  // ════════════════════════
  // DELETE BATCH
  // ════════════════════════

  async function deleteBatch(batchName) {
    const confirmed = await APP.confirmAsync(
      `Delete "${batchName}"? This will affect all enrolled students and remove related pricing.`
    );
    if (!confirmed) return;

    try {
      const response = await fetch(
        `${_apiBase()}/batches/${encodeURIComponent(batchName)}`,
        { method: 'DELETE', headers: await _authHeaders() }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      APP.toast('Batch deleted successfully! 🗑️', 'success');
      await loadBatches();
    } catch (err) {
      console.error('❌ Failed to delete batch:', err);
      APP.toast('Failed to delete batch', 'error');
    }
  }

  // ════════════════════════
  // PUBLIC API
  // ════════════════════════

  return { init, loadBatches, editBatch, deleteBatch };
})();

window.BATCH_PRICING = BATCH_PRICING;
