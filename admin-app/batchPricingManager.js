/* ════════════════════════════════════════
   batchPricingManager.js — Batch Pricing Admin
   Free/Paid course management, discount handling
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

  // Always returns a valid admin token (refreshes via stored PIN if expired)
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

    document.querySelectorAll('input[name="bp-pricing-type"]').forEach(radio => {
      radio.addEventListener('change', _updatePricingFieldsVisibility);
    });
    $('bp-discount-type')?.addEventListener('change', _calculateDiscountedPrice);
    $('bp-discount-value')?.addEventListener('input', _calculateDiscountedPrice);
    $('bp-base-price')?.addEventListener('input', _calculateDiscountedPrice);

    // Close modal on Escape
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
      const response = await fetch(`${_apiBase()}/batches`, {
        headers: await _authHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      _batches = (result.data || []).map(batch => ({
        name: batch.name,
        icon: batch.icon || '📚',
        subjects: batch.subjects || [],
        chapters: batch.chapters || [],
        pricing_type: batch.pricing_type || 'paid',
        base_price: batch.base_price !== undefined ? batch.base_price : 0,
        discount: batch.discount || null,
        discounted_price: batch.discounted_price !== undefined ? batch.discounted_price : 0,
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
      const isFree = batch.pricing_type === 'free';
      const isPriced = batch.pricing_type !== null && batch.pricing_type !== undefined;

      let statusBadge = '', statusClass = '', priceDisplay = '', editButtonText = '';

      if (!isPriced) {
        statusBadge = '⚠️ Unpriced'; statusClass = 'bp-warning';
        priceDisplay = 'Not configured yet'; editButtonText = '⚙️ Setup Pricing';
      } else if (isFree) {
        statusBadge = '🆓 Free'; statusClass = 'bp-free';
        priceDisplay = 'No charge for students'; editButtonText = '✏️ Edit';
      } else {
        statusBadge = '💳 Paid'; statusClass = 'bp-paid';
        const discountText = batch.discount
          ? `${batch.discount.type === 'percentage' ? batch.discount.value + '%' : '₹' + batch.discount.value} off`
          : 'No discount';
        priceDisplay = `₹${batch.base_price} → ${discountText} → ₹${batch.discounted_price}`;
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
              <span class="bp-label">Status:</span>
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

  // Reset every form field to a clean default state
  function _resetForm() {
    const nameInput = $('bp-batch-name');
    if (nameInput) { nameInput.value = ''; nameInput.disabled = false; }
    const paidRadio = document.querySelector('input[name="bp-pricing-type"][value="paid"]');
    if (paidRadio) paidRadio.checked = true;
    if ($('bp-base-price'))      $('bp-base-price').value = '';
    if ($('bp-discount-type'))   $('bp-discount-type').value = 'fixed';
    if ($('bp-discount-value'))  $('bp-discount-value').value = '';
    if ($('bp-discounted-price'))$('bp-discounted-price').textContent = '₹0';
    if ($('bp-description'))      $('bp-description').value = '';
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

    // Always start from a clean slate so stale values never leak across edits
    _resetForm();

    if (!isNewBatch) {
      const batchNameInput = $('bp-batch-name');
      batchNameInput.value = batch.name;
      batchNameInput.disabled = true;
      document.querySelectorAll('input[name="bp-pricing-type"]').forEach(r => {
        r.checked = r.value === batch.pricing_type;
      });
      $('bp-base-price').value = batch.base_price || '';
      $('bp-discount-type').value = batch.discount?.type || 'fixed';
      $('bp-discount-value').value = batch.discount?.value || '';
      $('bp-discounted-price').textContent = `₹${batch.discounted_price ?? 0}`;
      $('bp-description').value = batch.description || '';
    }

    _updatePricingFieldsVisibility();
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

  function _updatePricingFieldsVisibility() {
    const pricingType = document.querySelector('input[name="bp-pricing-type"]:checked')?.value;
    const pricingFields = $('bp-pricing-fields');
    if (!pricingFields) return;
    if (pricingType === 'free') {
      pricingFields.style.display = 'none';
      if ($('bp-base-price'))     $('bp-base-price').value = '';
      if ($('bp-discount-value')) $('bp-discount-value').value = '';
    } else {
      pricingFields.style.display = 'block';
    }
  }

  function _calculateDiscountedPrice() {
    const basePrice = parseFloat($('bp-base-price')?.value) || 0;
    const discountType = $('bp-discount-type')?.value;
    const discountValue = parseFloat($('bp-discount-value')?.value) || 0;

    let discountedPrice = basePrice;
    if (discountType === 'fixed') {
      discountedPrice = Math.max(0, basePrice - Math.max(0, discountValue));
    } else if (discountType === 'percentage') {
      const percentage = Math.min(100, Math.max(0, discountValue));
      discountedPrice = basePrice * (1 - percentage / 100);
    }
    discountedPrice = Math.round(discountedPrice * 100) / 100;
    if ($('bp-discounted-price')) $('bp-discounted-price').textContent = `₹${discountedPrice}`;
  }

  async function _submitBatchForm() {
    if (_submitting) return;

    const batchName = ($('bp-batch-name')?.value || '').trim();
    if (!batchName) return _showError('Batch name is required');

    const pricingType = document.querySelector('input[name="bp-pricing-type"]:checked')?.value;
    if (!pricingType) return _showError('Please select pricing type');

    const payload = {
      pricing_type: pricingType,
      description: ($('bp-description')?.value || '').trim(),
    };

    if (pricingType === 'paid') {
      const basePrice = parseFloat($('bp-base-price')?.value);
      if (isNaN(basePrice) || basePrice < 0) return _showError('Please enter a valid price');
      payload.base_price = basePrice;

      const discountValue = parseFloat($('bp-discount-value')?.value);
      if (!isNaN(discountValue) && discountValue !== 0) {
        if (discountValue < 0) return _showError('Discount value must be 0 or greater');
        const discountType = $('bp-discount-type')?.value;
        if (discountType === 'percentage' && discountValue > 100) {
          return _showError('Discount percentage must be between 0 and 100');
        }
        payload.discount = { type: discountType, value: discountValue };
      }
    }

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
