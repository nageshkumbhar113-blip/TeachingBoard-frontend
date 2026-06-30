# 🔧 Batch Pricing - Subscription Implementation Guide

**Status:** Code-Ready Implementation  
**Effort:** 3-4 hours  
**Files to Update:** 3 (Model + Controller + UI)

---

## 1️⃣ Backend: Update Batch Model

### File: `TeachingBoard-backend/src/models/Batch.js`

**Current Schema:**
```javascript
const batchSchema = new mongoose.Schema({
  name: String,
  icon: String,
  pricing_type: String,      // "free" or "paid"
  base_price: Number,        // Single price
  discount: Object,
  discounted_price: Number,  // Single calculated price
  subjects: Array
});
```

**New Schema:**
```javascript
const subscriptionPeriodSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    price: { type: Number, default: 0, min: 0 },
    discount: {
      type: { type: String, enum: ['fixed', 'percentage'] },
      value: { type: Number, min: 0, default: 0 }
    },
    discounted_price: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: '📚', trim: true },
    subjects: { type: [subjectSchema], default: [] },

    // Pricing Type
    pricing_type: { 
      type: String, 
      enum: ['free', 'paid'], 
      default: 'paid' 
    },

    // Subscription Periods
    monthly: { type: subscriptionPeriodSchema, default: {} },
    yearly: { type: subscriptionPeriodSchema, default: {} },

    // Default subscription when student enrolls
    default_period: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },

    // Metadata
    description: { type: String, default: '', trim: true },
    is_active: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  }
);
```

---

## 2️⃣ Backend: Update Controller

### File: `TeachingBoard-backend/src/controllers/batchController.js`

**New Function: updateBatchSubscriptionPricing**

```javascript
/**
 * PUT /api/batches/:name/pricing
 * Update batch subscription pricing (monthly/yearly)
 * Body: {
 *   pricing_type: 'free' | 'paid',
 *   monthly?: { enabled, price, discount: { type, value } },
 *   yearly?: { enabled, price, discount: { type, value } },
 *   default_period?: 'monthly' | 'yearly',
 *   description?: string
 * }
 */
exports.updateBatchSubscriptionPricing = asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name || '').trim();
  if (!name) throw new AppError('batch name is required', 400);

  const { 
    pricing_type, 
    monthly, 
    yearly, 
    default_period, 
    description 
  } = req.body;

  if (!pricing_type || !['free', 'paid'].includes(pricing_type)) {
    throw new AppError('pricing_type must be "free" or "paid"', 400);
  }

  const updateData = { pricing_type };

  if (pricing_type === 'paid') {
    // Validate and process monthly subscription
    if (monthly && monthly.enabled) {
      if (monthly.price === undefined || monthly.price < 0) {
        throw new AppError('monthly.price is required and must be >= 0', 400);
      }

      let monthlyDiscountedPrice = monthly.price;
      if (monthly.discount && monthly.discount.type && monthly.discount.value) {
        monthlyDiscountedPrice = _calculateDiscountedPrice(
          monthly.price,
          monthly.discount.type,
          monthly.discount.value
        );
      }

      updateData.monthly = {
        enabled: true,
        price: monthly.price,
        discount: monthly.discount || null,
        discounted_price: monthlyDiscountedPrice
      };
    } else {
      updateData.monthly = { enabled: false, price: 0, discount: null, discounted_price: 0 };
    }

    // Validate and process yearly subscription
    if (yearly && yearly.enabled) {
      if (yearly.price === undefined || yearly.price < 0) {
        throw new AppError('yearly.price is required and must be >= 0', 400);
      }

      let yearlyDiscountedPrice = yearly.price;
      if (yearly.discount && yearly.discount.type && yearly.discount.value) {
        yearlyDiscountedPrice = _calculateDiscountedPrice(
          yearly.price,
          yearly.discount.type,
          yearly.discount.value
        );
      }

      updateData.yearly = {
        enabled: true,
        price: yearly.price,
        discount: yearly.discount || null,
        discounted_price: yearlyDiscountedPrice
      };
    } else {
      updateData.yearly = { enabled: false, price: 0, discount: null, discounted_price: 0 };
    }

    // Must have at least one period enabled
    if (!updateData.monthly.enabled && !updateData.yearly.enabled) {
      throw new AppError('At least one subscription period (monthly or yearly) must be enabled', 400);
    }

    // Set default period
    if (default_period) {
      if (!['monthly', 'yearly'].includes(default_period)) {
        throw new AppError('default_period must be "monthly" or "yearly"', 400);
      }
      // Validate default period is enabled
      if (default_period === 'monthly' && !updateData.monthly.enabled) {
        throw new AppError('cannot set default_period to monthly if monthly is not enabled', 400);
      }
      if (default_period === 'yearly' && !updateData.yearly.enabled) {
        throw new AppError('cannot set default_period to yearly if yearly is not enabled', 400);
      }
      updateData.default_period = default_period;
    } else {
      // Auto-set default to first enabled period
      updateData.default_period = updateData.monthly.enabled ? 'monthly' : 'yearly';
    }
  } else {
    // Free batch - no subscriptions
    updateData.monthly = { enabled: false, price: 0, discount: null, discounted_price: 0 };
    updateData.yearly = { enabled: false, price: 0, discount: null, discounted_price: 0 };
    updateData.default_period = 'monthly';
  }

  if (description !== undefined) {
    updateData.description = String(description).trim();
  }

  const batch = await Batch.findOneAndUpdate(
    { name },
    { $set: updateData },
    { new: true, lean: true }
  );

  if (!batch) {
    throw new AppError(`Batch "${name}" not found`, 404);
  }

  res.json({
    success: true,
    data: _formatBatchPricingResponse(batch)
  });
});

// Helper function to calculate discounted price
function _calculateDiscountedPrice(basePrice, discountType, discountValue) {
  let discountedPrice = basePrice;

  if (discountType === 'fixed') {
    discountedPrice = Math.max(0, basePrice - discountValue);
  } else if (discountType === 'percentage') {
    if (discountValue < 0 || discountValue > 100) {
      throw new Error('Discount percentage must be between 0-100');
    }
    discountedPrice = basePrice * (1 - discountValue / 100);
  }

  return Math.round(discountedPrice * 100) / 100;
}

// Helper function to format response
function _formatBatchPricingResponse(batch) {
  return {
    name: batch.name,
    icon: batch.icon,
    pricing_type: batch.pricing_type,
    monthly: {
      enabled: batch.monthly?.enabled || false,
      price: batch.monthly?.price || 0,
      discount: batch.monthly?.discount || null,
      discounted_price: batch.monthly?.discounted_price || 0
    },
    yearly: {
      enabled: batch.yearly?.enabled || false,
      price: batch.yearly?.price || 0,
      discount: batch.yearly?.discount || null,
      discounted_price: batch.yearly?.discounted_price || 0
    },
    default_period: batch.default_period || 'monthly',
    description: batch.description || '',
    is_active: batch.is_active
  };
}

/**
 * GET /api/batches/:name/pricing
 * Get batch pricing with subscription details
 */
exports.getBatchSubscriptionPricing = asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name || '').trim();
  if (!name) throw new AppError('batch name is required', 400);

  const batch = await Batch.findOne({ name }).lean();
  if (!batch) {
    throw new AppError(`Batch "${name}" not found`, 404);
  }

  res.json({
    success: true,
    data: _formatBatchPricingResponse(batch)
  });
});

/**
 * GET /api/batches/pricing/all
 * Get all batches with subscription pricing (for student view)
 */
exports.getAllBatchesSubscriptionPricing = asyncHandler(async (req, res) => {
  const batches = await Batch.find({ is_active: true }).lean();

  const data = batches.map(batch => _formatBatchPricingResponse(batch));

  res.json({ success: true, data });
});
```

---

## 3️⃣ Admin UI: Update Modal Form

### File: `admin-app/batch-pricing-ui.html`

**Add this inside `<form id="bp-batch-form">`:**

```html
<!-- After Pricing Type radio buttons -->

<!-- Pricing Fields Container -->
<div id="bp-pricing-fields" class="bp-pricing-fields">
  
  <!-- MONTHLY SUBSCRIPTION -->
  <div class="bp-subscription-section">
    <h4>📅 Monthly Subscription</h4>
    
    <div class="bp-form-group">
      <label>
        <input type="checkbox" id="bp-monthly-enabled" />
        Enable Monthly Plan
      </label>
    </div>

    <div id="bp-monthly-fields" class="bp-subscription-fields" style="display: none;">
      <div class="bp-form-group">
        <label for="bp-monthly-price">Price (₹)</label>
        <input
          id="bp-monthly-price"
          type="number"
          min="0"
          step="1"
          placeholder="e.g., 499"
        />
      </div>

      <div class="bp-form-group">
        <label for="bp-monthly-discount-type">Discount Type</label>
        <select id="bp-monthly-discount-type">
          <option value="">No Discount</option>
          <option value="fixed">Fixed Amount (₹)</option>
          <option value="percentage">Percentage (%)</option>
        </select>
      </div>

      <div class="bp-form-group">
        <label for="bp-monthly-discount-value">Discount Value</label>
        <input
          id="bp-monthly-discount-value"
          type="number"
          min="0"
          step="1"
          placeholder="e.g., 50 or 10"
        />
      </div>

      <div class="bp-form-group">
        <label>Final Price</label>
        <div class="bp-price-display">
          <span id="bp-monthly-final-price">₹0</span>/month
        </div>
      </div>
    </div>
  </div>

  <!-- YEARLY SUBSCRIPTION -->
  <div class="bp-subscription-section">
    <h4>📅 Yearly Subscription</h4>
    
    <div class="bp-form-group">
      <label>
        <input type="checkbox" id="bp-yearly-enabled" />
        Enable Yearly Plan
      </label>
    </div>

    <div id="bp-yearly-fields" class="bp-subscription-fields" style="display: none;">
      <div class="bp-form-group">
        <label for="bp-yearly-price">Price (₹)</label>
        <input
          id="bp-yearly-price"
          type="number"
          min="0"
          step="1"
          placeholder="e.g., 4990"
        />
      </div>

      <div class="bp-form-group">
        <label for="bp-yearly-discount-type">Discount Type</label>
        <select id="bp-yearly-discount-type">
          <option value="">No Discount</option>
          <option value="fixed">Fixed Amount (₹)</option>
          <option value="percentage">Percentage (%)</option>
        </select>
      </div>

      <div class="bp-form-group">
        <label for="bp-yearly-discount-value">Discount Value</label>
        <input
          id="bp-yearly-discount-value"
          type="number"
          min="0"
          step="1"
          placeholder="e.g., 990 or 15"
        />
      </div>

      <div class="bp-form-group">
        <label>Final Price</label>
        <div class="bp-price-display">
          <span id="bp-yearly-final-price">₹0</span>/year
        </div>
      </div>

      <!-- Savings Calculation -->
      <div class="bp-savings-info">
        <div id="bp-savings-comparison" style="display: none;">
          <span id="bp-savings-text"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- DEFAULT PERIOD -->
  <div class="bp-form-group">
    <label for="bp-default-period">Default Subscription Period</label>
    <select id="bp-default-period">
      <option value="monthly">Monthly (recommended)</option>
      <option value="yearly">Yearly (premium)</option>
    </select>
  </div>

</div>
```

---

## 4️⃣ Admin UI: Update JavaScript Logic

### File: `admin-app/batchPricingManager.js`

**Add event listeners in `_setupEventListeners()`:**

```javascript
// Monthly subscription checkbox
document.getElementById('bp-monthly-enabled')?.addEventListener('change', () => {
  const monthlyFields = document.getElementById('bp-monthly-fields');
  if (monthlyFields) {
    monthlyFields.style.display = document.getElementById('bp-monthly-enabled').checked 
      ? 'block' 
      : 'none';
  }
  _calculateSubscriptionPrices();
});

// Yearly subscription checkbox
document.getElementById('bp-yearly-enabled')?.addEventListener('change', () => {
  const yearlyFields = document.getElementById('bp-yearly-fields');
  if (yearlyFields) {
    yearlyFields.style.display = document.getElementById('bp-yearly-enabled').checked 
      ? 'block' 
      : 'none';
  }
  _calculateSubscriptionPrices();
});

// Monthly price/discount changes
['bp-monthly-price', 'bp-monthly-discount-type', 'bp-monthly-discount-value'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', _calculateSubscriptionPrices);
});

// Yearly price/discount changes
['bp-yearly-price', 'bp-yearly-discount-type', 'bp-yearly-discount-value'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', _calculateSubscriptionPrices);
});
```

**Add calculation function:**

```javascript
function _calculateSubscriptionPrices() {
  // Monthly calculation
  const monthlyEnabled = document.getElementById('bp-monthly-enabled').checked;
  if (monthlyEnabled) {
    const monthlyPrice = parseFloat(document.getElementById('bp-monthly-price').value) || 0;
    const monthlyDiscountType = document.getElementById('bp-monthly-discount-type').value;
    const monthlyDiscountValue = parseFloat(document.getElementById('bp-monthly-discount-value').value) || 0;

    let monthlyFinal = monthlyPrice;
    if (monthlyDiscountType === 'fixed') {
      monthlyFinal = Math.max(0, monthlyPrice - monthlyDiscountValue);
    } else if (monthlyDiscountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, monthlyDiscountValue));
      monthlyFinal = monthlyPrice * (1 - pct / 100);
    }

    document.getElementById('bp-monthly-final-price').textContent = 
      '₹' + Math.round(monthlyFinal * 100) / 100;
  }

  // Yearly calculation
  const yearlyEnabled = document.getElementById('bp-yearly-enabled').checked;
  if (yearlyEnabled) {
    const yearlyPrice = parseFloat(document.getElementById('bp-yearly-price').value) || 0;
    const yearlyDiscountType = document.getElementById('bp-yearly-discount-type').value;
    const yearlyDiscountValue = parseFloat(document.getElementById('bp-yearly-discount-value').value) || 0;

    let yearlyFinal = yearlyPrice;
    if (yearlyDiscountType === 'fixed') {
      yearlyFinal = Math.max(0, yearlyPrice - yearlyDiscountValue);
    } else if (yearlyDiscountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, yearlyDiscountValue));
      yearlyFinal = yearlyPrice * (1 - pct / 100);
    }

    document.getElementById('bp-yearly-final-price').textContent = 
      '₹' + Math.round(yearlyFinal * 100) / 100;

    // Show savings if both are available
    if (monthlyEnabled) {
      const monthlyFinal = parseFloat(document.getElementById('bp-monthly-final-price').textContent.replace('₹', '')) || 0;
      const yearlyMonthlyEquivalent = monthlyFinal * 12;
      const savings = yearlyMonthlyEquivalent - yearlyFinal;

      if (savings > 0) {
        document.getElementById('bp-savings-comparison').style.display = 'block';
        document.getElementById('bp-savings-text').textContent = 
          `💡 Save ₹${Math.round(savings)} per year by choosing yearly!`;
      } else {
        document.getElementById('bp-savings-comparison').style.display = 'none';
      }
    }
  }
}
```

**Update form submission:**

```javascript
async function _submitBatchForm() {
  const batchName = document.getElementById('bp-batch-name').value.trim();
  const pricingType = document.querySelector('input[name="bp-pricing-type"]:checked').value;

  const payload = {
    pricing_type: pricingType,
    description: document.getElementById('bp-description').value.trim()
  };

  if (pricingType === 'paid') {
    // Monthly subscription
    if (document.getElementById('bp-monthly-enabled').checked) {
      const monthlyPrice = parseFloat(document.getElementById('bp-monthly-price').value);
      if (isNaN(monthlyPrice) || monthlyPrice < 0) {
        APP.toast('Invalid monthly price', 'error');
        return;
      }

      payload.monthly = {
        enabled: true,
        price: monthlyPrice,
        discount: null
      };

      const discountType = document.getElementById('bp-monthly-discount-type').value;
      if (discountType) {
        payload.monthly.discount = {
          type: discountType,
          value: parseFloat(document.getElementById('bp-monthly-discount-value').value) || 0
        };
      }
    }

    // Yearly subscription
    if (document.getElementById('bp-yearly-enabled').checked) {
      const yearlyPrice = parseFloat(document.getElementById('bp-yearly-price').value);
      if (isNaN(yearlyPrice) || yearlyPrice < 0) {
        APP.toast('Invalid yearly price', 'error');
        return;
      }

      payload.yearly = {
        enabled: true,
        price: yearlyPrice,
        discount: null
      };

      const discountType = document.getElementById('bp-yearly-discount-type').value;
      if (discountType) {
        payload.yearly.discount = {
          type: discountType,
          value: parseFloat(document.getElementById('bp-yearly-discount-value').value) || 0
        };
      }
    }

    // Must have at least one period
    if (!payload.monthly?.enabled && !payload.yearly?.enabled) {
      APP.toast('Enable at least one subscription period', 'error');
      return;
    }

    payload.default_period = document.getElementById('bp-default-period').value;
  }

  // Send to API...
  // ... rest of submission code
}
```

---

## 5️⃣ Update Display Function

### In `batchPricingManager.js` - `_renderBatchesList()`

```javascript
function _renderBatchesList() {
  const container = $('bp-batches-list');
  
  // ... existing code ...

  container.innerHTML = _batches.map(batch => {
    let priceDisplay = '';
    
    if (batch.pricing_type === 'free') {
      priceDisplay = '🆓 Free (No charge)';
    } else {
      const periods = [];
      
      if (batch.monthly?.enabled) {
        periods.push(`₹${batch.monthly.discounted_price}/month`);
      }
      
      if (batch.yearly?.enabled) {
        periods.push(`₹${batch.yearly.discounted_price}/year`);
        
        // Show savings if both available
        if (batch.monthly?.enabled) {
          const savings = (batch.monthly.discounted_price * 12) - batch.yearly.discounted_price;
          if (savings > 0) {
            periods.push(`<span style="color: green;">💡 Save ₹${Math.round(savings)}/year</span>`);
          }
        }
      }
      
      priceDisplay = periods.join(' or ');
    }

    return `
      <div class="bp-batch-card">
        <!-- ... existing header ... -->
        <div class="bp-batch-details">
          <div class="bp-detail-row">
            <span class="bp-label">Pricing:</span>
            <span class="bp-value">${priceDisplay}</span>
          </div>
        </div>
        <!-- ... rest of card ... -->
      </div>
    `;
  }).join('');
}
```

---

## ✅ Testing Scenarios

### Test Case 1: Monthly Only
```
Input:
- Monthly enabled: ₹499 (10% off → ₹449)
- Yearly enabled: No
- Default: Monthly

Expected:
- Show: "₹449/month"
- Save button disabled if only one
```

### Test Case 2: Yearly Only
```
Input:
- Monthly enabled: No
- Yearly enabled: ₹4990 (₹990 off → ₹4000)
- Default: Yearly

Expected:
- Show: "₹4000/year"
```

### Test Case 3: Both with Savings
```
Input:
- Monthly: ₹599 → 10% → ₹539/month
- Yearly: ₹5990 → ₹990 → ₹5000/year
- Default: Yearly

Expected:
- Show: "₹539/month or ₹5000/year"
- Show: "💡 Save ₹488/year!"
```

---

## 🚀 Deployment Order

1. ✅ Update Batch model schema
2. ✅ Update controller functions
3. ✅ Update API routes
4. ✅ Update admin UI form
5. ✅ Update JavaScript logic
6. ✅ Update display function
7. ✅ Test all scenarios
8. ✅ Update student registration
9. ✅ Test end-to-end

---

**Status:** Ready for Implementation ✅  
**Files to Change:** 3  
**Estimated Time:** 3-4 hours  
**Difficulty:** Medium
