# 💳 Batch Pricing - Subscription Period Options

**Update:** 2026-06-30  
**Status:** Design & Implementation Plan

---

## 🎯 **Subscription Model**

### Three Pricing Tiers

```
Free Course
├─ No payment required
├─ Lifetime access
└─ Examples: Trial, Intro courses

Monthly Subscription
├─ Pay: ₹X per month
├─ Auto-renew every month
└─ Example: ₹499/month

Yearly Subscription  
├─ Pay: ₹Y per year (usually 20% less than 12×monthly)
├─ Auto-renew after 12 months
└─ Example: ₹4,990/year (vs ₹5,988 monthly)
```

---

## 📊 **Data Structure**

### Updated Batch Pricing Schema

```javascript
Batch {
  name: "Physics Class 12",
  icon: "📚",
  
  // Pricing Type
  pricing_type: "paid",  // "free", "paid"
  
  // Monthly Option
  monthly: {
    enabled: true,
    price: 499,          // ₹499/month
    discount: {
      type: "percentage",
      value: 10           // 10% off
    },
    discounted_price: 449  // Final: ₹449/month
  },
  
  // Yearly Option
  yearly: {
    enabled: true,
    price: 4990,         // ₹4990/year
    discount: {
      type: "fixed",
      value: 990         // ₹990 off
    },
    discounted_price: 4000  // Final: ₹4000/year
  },
  
  // Free Option
  free: {
    enabled: false,
    description: "Not available as free"
  },
  
  // Default subscription
  default_period: "monthly",  // "monthly" or "yearly"
  
  description: "Complete JEE preparation",
  is_active: true
}
```

---

## 🎨 **Admin UI Updates**

### Pricing Configuration Form

```
Batch Pricing Setup
│
├─ Batch Name: [Physics Class 12___]
│
├─ Pricing Type
│  ○ Free  ○ Paid (selected)
│
├─ 📅 Monthly Subscription (Optional)
│  ├─ ☑ Enable Monthly
│  ├─ Base Price: [499_______]
│  ├─ Discount Type: [Percentage ▼]
│  ├─ Discount Value: [10_____]
│  └─ Final Price: ₹449/month
│
├─ 📅 Yearly Subscription (Optional)
│  ├─ ☑ Enable Yearly
│  ├─ Base Price: [4990______]
│  ├─ Discount Type: [Fixed Amount ▼]
│  ├─ Discount Value: [990____]
│  └─ Final Price: ₹4000/year
│
├─ Default Period
│  ○ Monthly  ○ Yearly (radio button)
│
└─ [💾 Save Batch]
```

---

## 💰 **Pricing Examples**

### Example 1: Both Monthly & Yearly

```
Batch: Physics Class 12

Monthly:
├─ Base: ₹599
├─ Discount: 10% off
└─ Final: ₹539/month

Yearly:
├─ Base: ₹5,990
├─ Discount: ₹990 off
└─ Final: ₹5,000/year

Savings: Student saves ₹488/year by choosing yearly!
(₹539 × 12 = ₹6,468 vs ₹5,000/year)
```

### Example 2: Only Monthly

```
Batch: Chemistry Class 12

Monthly Only:
├─ Base: ₹699
├─ No Discount
└─ Final: ₹699/month

Yearly: Not available
```

### Example 3: Free Course

```
Batch: Biology Trial

Free:
├─ No payment required
├─ Lifetime access
└─ Final: ₹0 (always free)

Monthly/Yearly: Not applicable
```

---

## 📋 **API Schema Updates**

### PUT /api/batches/:name/pricing

**Request:**
```json
{
  "pricing_type": "paid",
  
  "monthly": {
    "enabled": true,
    "price": 499,
    "discount": {
      "type": "percentage",
      "value": 10
    }
  },
  
  "yearly": {
    "enabled": true,
    "price": 4990,
    "discount": {
      "type": "fixed",
      "value": 990
    }
  },
  
  "default_period": "monthly",
  "description": "JEE Physics Course"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Physics Class 12",
    "pricing_type": "paid",
    
    "monthly": {
      "enabled": true,
      "price": 499,
      "discount": { "type": "percentage", "value": 10 },
      "discounted_price": 449
    },
    
    "yearly": {
      "enabled": true,
      "price": 4990,
      "discount": { "type": "fixed", "value": 990 },
      "discounted_price": 4000
    },
    
    "default_period": "monthly"
  }
}
```

---

## 📱 **Student Registration UI**

### Batch Selection with Period Choice

```
Select Your Courses
│
├─ 📚 Physics Class 12 ($539/month or $5000/year)
│  ├─ ○ Monthly - ₹539/month (auto-renew)
│  └─ ◉ Yearly  - ₹5,000/year (auto-renew)
│  [Save ₹488/year!]
│
├─ ⚗️ Chemistry Class 12 ($699/month only)
│  └─ ◉ Monthly - ₹699/month (auto-renew)
│
├─ 📖 Biology Trial (FREE)
│  └─ ◉ Free - No charge (lifetime access)
│
└─ Price Summary
   ├─ Physics:    ₹5,000/year (12 months)
   ├─ Chemistry:  ₹699/month
   ├─ Biology:    ₹0 (free)
   │
   └─ Total Monthly: ₹699
      Total Yearly:  ₹5,000 (Physics)
      
   [Proceed to Payment]
```

---

## 🔄 **Subscription Renewal Flow**

### Monthly Subscription
```
Day 1: Student pays ₹449 for Physics (1 month)
       ↓
Day 30: Auto-renew reminder sent
        ↓
Day 31: Auto-charge ₹449 for next month
        ↓
Repeat monthly...
```

### Yearly Subscription
```
Day 1: Student pays ₹4000 for Physics (12 months)
       ↓
Day 364: Auto-renew reminder sent
         ↓
Day 365: Auto-charge ₹4000 for next 12 months
         ↓
Repeat yearly...
```

### Mixed Subscriptions
```
Student has:
├─ Physics: Yearly (₹4000/year)
├─ Chemistry: Monthly (₹699/month)
└─ Biology: Free (no charge)

Charges:
├─ Every 1st of month: ₹699 (Chemistry)
└─ Every 1st of year: ₹4000 (Physics renewal)
```

---

## 🎯 **Implementation Steps**

### Step 1: Update Batch Model

```javascript
// In Batch.js

const subscriptionPeriodSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  price: { type: Number, default: 0, min: 0 },
  discount: {
    type: { type: String, enum: ['fixed', 'percentage'] },
    value: { type: Number, min: 0 }
  },
  discounted_price: { type: Number, default: 0, min: 0 }
}, { _id: false });

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  icon: { type: String, default: '📚' },
  
  // Old single pricing (REMOVE)
  // pricing_type, base_price, discount, discounted_price
  
  // New subscription options
  pricing_type: { type: String, enum: ['free', 'paid'] },
  
  monthly: { type: subscriptionPeriodSchema, default: {} },
  yearly: { type: subscriptionPeriodSchema, default: {} },
  
  default_period: { 
    type: String, 
    enum: ['monthly', 'yearly'], 
    default: 'monthly' 
  },
  
  description: { type: String, default: '' },
  is_active: { type: Boolean, default: true }
});
```

### Step 2: Update Admin UI

**Add sections in modal form:**
```html
<!-- Monthly Option -->
<div class="bp-subscription-section">
  <h4>📅 Monthly Subscription</h4>
  <label><input type="checkbox" id="bp-monthly-enable"> Enable Monthly</label>
  <input type="number" id="bp-monthly-price" placeholder="Price">
  <input type="number" id="bp-monthly-discount" placeholder="Discount">
  <div>Final: <span id="bp-monthly-final">₹0</span>/month</div>
</div>

<!-- Yearly Option -->
<div class="bp-subscription-section">
  <h4>📅 Yearly Subscription</h4>
  <label><input type="checkbox" id="bp-yearly-enable"> Enable Yearly</label>
  <input type="number" id="bp-yearly-price" placeholder="Price">
  <input type="number" id="bp-yearly-discount" placeholder="Discount">
  <div>Final: <span id="bp-yearly-final">₹0</span>/year</div>
</div>

<!-- Default Period -->
<div class="bp-form-group">
  <label>Default Period</label>
  <select id="bp-default-period">
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
</div>
```

### Step 3: Update Display Logic

**Show pricing for each period:**
```javascript
function _renderBatchesList() {
  _batches.map(batch => {
    let priceDisplay = '';
    
    if (batch.pricing_type === 'free') {
      priceDisplay = '🆓 Free (No charge)';
    } else {
      const prices = [];
      if (batch.monthly?.enabled) {
        prices.push(`₹${batch.monthly.discounted_price}/month`);
      }
      if (batch.yearly?.enabled) {
        prices.push(`₹${batch.yearly.discounted_price}/year`);
      }
      priceDisplay = prices.join(' or ');
    }
    
    // Show in card...
  });
}
```

---

## 📊 **Admin Card Display**

### Before (Old)
```
┌─────────────────────────────┐
│ 📚 Physics          💳 Paid │
│ Price: ₹999                 │
│ Discount: 10% off → ₹899    │
│ [✏️ Edit] [🗑️ Delete]       │
└─────────────────────────────┘
```

### After (New)
```
┌─────────────────────────────┐
│ 📚 Physics          💳 Paid │
│ 📅 Monthly: ₹449/month      │
│ 📅 Yearly: ₹4000/year       │
│ [💡 Save ₹488/year!]        │
│ [✏️ Edit] [🗑️ Delete]       │
└─────────────────────────────┘
```

---

## 💾 **Payment Processing**

### Student Selects Plan

```
Student Action:
├─ Select: Physics + Yearly (₹4000/year)
├─ Select: Chemistry + Monthly (₹699/month)
└─ Select: Biology + Free

Total Charges:
├─ First payment: ₹4699 (₹4000 + ₹699)
├─ Next month: ₹699 (Chemistry auto-renew)
├─ Next year: ₹4000 (Physics auto-renew)

Razorpay Setup:
1. One-time charge: ₹4699
2. Setup monthly mandate for ₹699
3. Setup yearly mandate for ₹4000
```

---

## 🔐 **Subscription Management**

### Admin Can:
- ✅ Set different prices for monthly vs yearly
- ✅ Offer discounts per period
- ✅ Choose default period
- ✅ Enable/disable periods
- ✅ Show savings calculation

### Student Can:
- ✅ Choose period at checkout
- ✅ See savings clearly
- ✅ Change subscription later
- ✅ Pause/resume subscription
- ✅ View renewal dates

---

## 🎁 **Example Configurations**

### Config 1: Full Flexibility (Both Periods)
```
Physics:
├─ Monthly: ₹599 → 10% → ₹539
├─ Yearly: ₹5990 → ₹990 off → ₹5000
└─ Default: Yearly
```

### Config 2: Monthly Only
```
Chemistry:
├─ Monthly: ₹699 (no discount)
└─ Default: Monthly
```

### Config 3: Yearly Premium
```
JEE Complete:
├─ Yearly: ₹9999 → 20% → ₹7999
└─ Default: Yearly
```

### Config 4: Free Trial
```
Biology:
├─ Free: Always free
└─ Type: Free course
```

---

## 📋 **Implementation Checklist**

### Database
- [ ] Update Batch model schema
- [ ] Add monthly/yearly fields
- [ ] Add default_period field
- [ ] Run migration (if needed)

### Backend
- [ ] Update API endpoints
- [ ] Calculate discounted prices for each period
- [ ] Update validation logic
- [ ] Update response schema

### Admin UI
- [ ] Add monthly section to form
- [ ] Add yearly section to form
- [ ] Add default period selector
- [ ] Update pricing display
- [ ] Update card display
- [ ] Add savings calculation

### Student UI
- [ ] Show period options at checkout
- [ ] Calculate total for each period
- [ ] Show savings compared to monthly
- [ ] Setup Razorpay for recurring charges

### Testing
- [ ] Test monthly only config
- [ ] Test yearly only config
- [ ] Test both periods available
- [ ] Test free course
- [ ] Test mixed subscriptions
- [ ] Test savings calculation

---

## 📈 **Business Benefits**

```
Monthly Subscription:
├─ Lower barrier to entry
├─ Easier to try
├─ Higher churn risk
└─ More frequent charges

Yearly Subscription:
├─ Higher upfront cost
├─ Lower churn risk
├─ Better customer retention
├─ Can offer bigger discounts
└─ Predictable revenue

Combined:
✅ Flexibility for students
✅ Multiple revenue streams
✅ Better retention with discounts
✅ Higher yearly value
```

---

## 🚀 **Priority**

**HIGH** - This is critical for the pricing system.

Current system has flat pricing. With monthly/yearly, we get:
- More pricing flexibility
- Better student retention
- Higher revenue potential
- Industry-standard approach

---

## 📝 **Next Steps**

1. **Approve schema changes** (monthly/yearly fields)
2. **Update Batch model** (add subscriptions)
3. **Update Admin UI** (add period forms)
4. **Update display logic** (show both prices)
5. **Test configurations** (all combinations)
6. **Integrate with Razorpay** (recurring charges)

---

**Status:** Design Complete ✅  
**Ready for Implementation:** YES ✅  
**Estimated Effort:** 4-6 hours
