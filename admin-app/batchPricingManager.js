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

  let _batches = [];
  let _editingBatch = null;

  // ════════════════════════
  // INITIALIZATION
  // ════════════════════════

  async function init() {
    console.log('🎓 Initializing Batch Pricing Manager');
    _setupEventListeners();
    await loadBatches();
  }

  function _setupEventListeners() {
    // New batch button
    const newBatchBtn = $('bp-new-batch-btn');
    if (newBatchBtn) {
      newBatchBtn.addEventListener('click', () => {
        _showBatchForm(null);
      });
    }

    // Form submission
    const form = $('bp-batch-form');
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        _submitBatchForm();
      });
    }

    // Cancel button
    const cancelBtn = $('bp-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        _hideBatchForm();
      });
    }

    // Pricing type change
    const pricingTypeRadios = document.querySelectorAll('input[name="bp-pricing-type"]');
    pricingTypeRadios.forEach(radio => {
      radio.addEventListener('change', _updatePricingFieldsVisibility);
    });

    // Discount type change
    const discountTypeSelect = $('bp-discount-type');
    if (discountTypeSelect) {
      discountTypeSelect.addEventListener('change', _calculateDiscountedPrice);
    }

    // Discount value change
    const discountValueInput = $('bp-discount-value');
    if (discountValueInput) {
      discountValueInput.addEventListener('input', _calculateDiscountedPrice);
    }

    // Base price change
    const basePriceInput = $('bp-base-price');
    if (basePriceInput) {
      basePriceInput.addEventListener('input', _calculateDiscountedPrice);
    }
  }

  // ════════════════════════
  // LOAD BATCHES
  // ════════════════════════

  async function loadBatches() {
    try {
      const response = await fetch(
        `${window.TEACHINGBOARD_API_URL}/batches`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Process batches - ensure all have pricing fields (with defaults)
      _batches = (result.data || []).map(batch => ({
        name: batch.name,
        icon: batch.icon || '📚',
        subjects: batch.subjects || [],
        chapters: batch.chapters || [],

        // Pricing fields (with smart defaults)
        pricing_type: batch.pricing_type || 'paid',
        base_price: batch.base_price !== undefined ? batch.base_price : 0,
        discount: batch.discount || null,
        discounted_price: batch.discounted_price !== undefined ? batch.discounted_price : 0,
        description: batch.description || '',
        is_active: batch.is_active !== false
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
        </div>
      `;
      return;
    }

    container.innerHTML = _batches.map(batch => {
      const isFree = batch.pricing_type === 'free';
      const isPriced = batch.pricing_type !== null && batch.pricing_type !== undefined;

      // Determine status badge
      let statusBadge = '';
      let statusClass = '';
      let priceDisplay = '';
      let editButtonText = '';

      if (!isPriced) {
        statusBadge = '⚠️ Unpriced';
        statusClass = 'bp-warning';
        priceDisplay = 'Not configured yet';
        editButtonText = '⚙️ Setup Pricing';
      } else if (isFree) {
        statusBadge = '🆓 Free';
        statusClass = 'bp-free';
        priceDisplay = 'No charge for students';
        editButtonText = '✏️ Edit';
      } else {
        statusBadge = '💳 Paid';
        statusClass = 'bp-paid';
        const discountText = batch.discount
          ? `${batch.discount.type === 'percentage' ? batch.discount.value + '%' : '₹' + batch.discount.value} off`
          : 'No discount';
        priceDisplay = `₹${batch.base_price} → ${discountText} → ₹${batch.discounted_price}`;
        editButtonText = '✏️ Edit';
      }

      return `
        <div class="bp-batch-card" data-batch="${batch.name}">
          <div class="bp-batch-header">
            <span class="bp-batch-icon">${batch.icon}</span>
            <span class="bp-batch-name">${batch.name}</span>
            <span class="bp-badge ${statusClass}">${statusBadge}</span>
          </div>

          <div class="bp-batch-details">
            <div class="bp-detail-row">
              <span class="bp-label">Status:</span>
              <span class="bp-value">${priceDisplay}</span>
            </div>

            ${batch.description ? `
              <div class="bp-detail-row">
                <span class="bp-label">Description:</span>
                <span class="bp-value">${batch.description}</span>
              </div>
            ` : ''}
          </div>

          <div class="bp-batch-actions">
            <button class="bp-btn bp-btn-edit" onclick="BATCH_PRICING.editBatch('${batch.name}')">
              ${editButtonText}
            </button>
            <button class="bp-btn bp-btn-delete" onclick="BATCH_PRICING.deleteBatch('${batch.name}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ════════════════════════
  // BATCH FORM MANAGEMENT
  // ════════════════════════

  async function editBatch(batchName) {
    try {
      const response = await fetch(
        `${window.TEACHINGBOARD_API_URL}/batches/${encodeURIComponent(batchName)}/pricing`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      _editingBatch = result.data;
      _showBatchForm(result.data);
    } catch (err) {
      console.error('❌ Failed to load batch:', err);
      APP.toast('Failed to load batch details', 'error');
    }
  }

  function _showBatchForm(batch) {
    const modal = $('bp-batch-modal');
    if (!modal) return;

    const isNewBatch = !batch;
    _setText('bp-modal-title', isNewBatch ? '➕ Create New Batch' : '✏️ Edit Batch');

    // Set form values
    const batchNameInput = $('bp-batch-name');
    const pricingTypeRadios = document.querySelectorAll('input[name="bp-pricing-type"]');
    const basePriceInput = $('bp-base-price');
    const discountTypeSelect = $('bp-discount-type');
    const discountValueInput = $('bp-discount-value');
    const discountedPriceDisplay = $('bp-discounted-price');
    const descriptionInput = $('bp-description');

    if (isNewBatch) {
      batchNameInput.value = '';
      pricingTypeRadios[1].checked = true; // paid by default
      basePriceInput.value = '';
      discountTypeSelect.value = 'fixed';
      discountValueInput.value = '';
      discountedPriceDisplay.textContent = '₹0';
      descriptionInput.value = '';
      batchNameInput.disabled = false;
    } else {
      batchNameInput.value = batch.name;
      batchNameInput.disabled = true;
      pricingTypeRadios.forEach(r => {
        r.checked = r.value === batch.pricing_type;
      });
      basePriceInput.value = batch.base_price || '';
      discountTypeSelect.value = batch.discount?.type || 'fixed';
      discountValueInput.value = batch.discount?.value || '';
      discountedPriceDisplay.textContent = `₹${batch.discounted_price}`;
      descriptionInput.value = batch.description || '';
    }

    _updatePricingFieldsVisibility();
    modal.classList.remove('hidden');
    modal.classList.add('visible');
  }

  function _hideBatchForm() {
    const modal = $('bp-batch-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible');
    }
    _editingBatch = null;
  }

  function _updatePricingFieldsVisibility() {
    const pricingType = document.querySelector('input[name="bp-pricing-type"]:checked')?.value;
    const pricingFields = $('bp-pricing-fields');

    if (pricingFields) {
      if (pricingType === 'free') {
        pricingFields.style.display = 'none';
        $('bp-base-price').value = '';
        $('bp-discount-value').value = '';
      } else {
        pricingFields.style.display = 'block';
      }
    }
  }

  function _calculateDiscountedPrice() {
    const basePriceInput = $('bp-base-price');
    const discountTypeSelect = $('bp-discount-type');
    const discountValueInput = $('bp-discount-value');
    const discountedPriceDisplay = $('bp-discounted-price');

    const basePrice = parseFloat(basePriceInput.value) || 0;
    const discountType = discountTypeSelect.value;
    const discountValue = parseFloat(discountValueInput.value) || 0;

    let discountedPrice = basePrice;

    if (discountType === 'fixed') {
      discountedPrice = Math.max(0, basePrice - discountValue);
    } else if (discountType === 'percentage') {
      const percentage = Math.min(100, Math.max(0, discountValue));
      discountedPrice = basePrice * (1 - percentage / 100);
    }

    discountedPrice = Math.round(discountedPrice * 100) / 100;
    discountedPriceDisplay.textContent = `₹${discountedPrice}`;
  }

  async function _submitBatchForm() {
    const batchNameInput = $('bp-batch-name');
    const pricingTypeRadio = document.querySelector('input[name="bp-pricing-type"]:checked');
    const basePriceInput = $('bp-base-price');
    const discountTypeSelect = $('bp-discount-type');
    const discountValueInput = $('bp-discount-value');
    const descriptionInput = $('bp-description');

    // Validation
    const batchName = batchNameInput.value.trim();
    if (!batchName) {
      APP.toast('Batch name is required', 'error');
      return;
    }

    const pricingType = pricingTypeRadio?.value;
    if (!pricingType) {
      APP.toast('Please select pricing type', 'error');
      return;
    }

    const payload = {
      pricing_type: pricingType,
      description: descriptionInput.value.trim(),
    };

    if (pricingType === 'paid') {
      const basePrice = parseFloat(basePriceInput.value);
      if (isNaN(basePrice) || basePrice < 0) {
        APP.toast('Please enter a valid price', 'error');
        return;
      }
      payload.base_price = basePrice;

      const discountValue = parseFloat(discountValueInput.value);
      if (discountValue > 0) {
        payload.discount = {
          type: discountTypeSelect.value,
          value: discountValue,
        };
      }
    }

    try {
      const isNew = !_editingBatch;
      const url = isNew
        ? `${window.TEACHINGBOARD_API_URL}/batches`
        : `${window.TEACHINGBOARD_API_URL}/batches/${encodeURIComponent(batchName)}/pricing`;

      const method = isNew ? 'POST' : 'PUT';

      if (isNew) {
        payload.name = batchName;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      APP.toast(isNew ? 'Batch created successfully! 🎉' : 'Pricing updated successfully! ✅', 'success');
      _hideBatchForm();
      await loadBatches();
    } catch (err) {
      console.error('❌ Failed to save batch:', err);
      APP.toast(err.message || 'Failed to save batch', 'error');
    }
  }

  // ════════════════════════
  // DELETE BATCH
  // ════════════════════════

  async function deleteBatch(batchName) {
    if (!confirm(`Are you sure you want to delete "${batchName}"? This will affect all enrolled students.`)) {
      return;
    }

    try {
      const response = await fetch(
        `${window.TEACHINGBOARD_API_URL}/batches/${encodeURIComponent(batchName)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

  return {
    init,
    loadBatches,
    editBatch,
    deleteBatch,
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BATCH_PRICING.init());
} else {
  BATCH_PRICING.init();
}
