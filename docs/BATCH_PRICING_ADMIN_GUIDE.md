# 🎓 Batch Pricing Admin Guide

## Overview

The **Batch Pricing Manager** is a complete admin interface for managing course/batch pricing with support for:
- ✅ Free and Paid courses
- ✅ Fixed and percentage-based discounts
- ✅ Real-time price calculation
- ✅ Batch management (Create, Edit, Delete)

---

## 📋 Features

### 1. **Create New Batch**
- Set batch name (e.g., "Physics Class 12")
- Choose pricing type: Free or Paid
- Set base price for paid batches
- Add discount (optional)
- Add description

### 2. **Pricing Types**

#### 🆓 Free Course
- No payment required
- Students get immediate access
- Perfect for trial or introduction courses

#### 💳 Paid Course
- Set base price in rupees (₹)
- Optional discount:
  - **Fixed Amount**: e.g., ₹100 off → Price becomes ₹899
  - **Percentage**: e.g., 10% off → Price becomes ₹900
- Final price calculated automatically

### 3. **Discount Examples**

| Base Price | Discount Type | Discount Value | Final Price |
|-----------|---------------|-----------------|------------|
| ₹1000 | None | - | ₹1000 |
| ₹1000 | Fixed | ₹100 | ₹900 |
| ₹1000 | Percentage | 10% | ₹900 |
| ₹999 | Fixed | ₹50 | ₹949 |
| ₹1299 | Percentage | 15% | ₹1104 |

---

## 🚀 Integration Steps

### Step 1: Add Files to Admin App

```bash
# Copy batch pricing module
cp admin-app/batchPricingManager.js ./admin-app/
cp admin-app/batch-pricing-ui.html ./admin-app/
```

### Step 2: Update Admin HTML File

Add this to your main admin HTML file (e.g., `admin-app/index.html`):

```html
<!-- Add script after other admin scripts -->
<script src="./batchPricingManager.js"></script>

<!-- Add UI in admin tabs section -->
<div id="admin-tab-batch-pricing" class="admin-tab">
  <!-- Content will be loaded from batch-pricing-ui.html -->
  <div id="bp-container"></div>
</div>
```

### Step 3: Load UI Template

In your admin.js, add this to load the batch pricing UI:

```javascript
// When initializing admin tabs
async function loadBatchPricingUI() {
  try {
    const response = await fetch('./batch-pricing-ui.html');
    const html = await response.text();
    const container = document.getElementById('bp-container');
    if (container) {
      container.innerHTML = html;
      // Re-initialize event listeners
      BATCH_PRICING.init();
    }
  } catch (err) {
    console.error('Failed to load batch pricing UI:', err);
  }
}
```

### Step 4: Backend API Check

Ensure these backend endpoints are available:

```
GET    /api/batches                          → Get all batches
POST   /api/batches                          → Create new batch
GET    /api/batches/:name/pricing            → Get batch pricing
PUT    /api/batches/:name/pricing            → Update batch pricing
GET    /api/batches/pricing/all              → Get all pricing (for students)
DELETE /api/batches/:name                    → Delete batch
```

---

## 📱 Frontend Integration (Student App)

### Display Batch Options During Registration

```javascript
// student-app/app.js or registration module

async function loadBatchPricingOptions() {
  try {
    const response = await fetch(
      `${window.TEACHINGBOARD_API_URL}/batches/pricing/all`
    );
    const result = await response.json();
    const batches = result.data;

    // Render batch selection
    batches.forEach(batch => {
      const isFree = batch.pricing_type === 'free';
      const price = isFree ? 'Free' : `₹${batch.discounted_price}`;
      
      console.log(`${batch.name}: ${price}`);
      // Display in UI...
    });
  } catch (err) {
    console.error('Failed to load batches:', err);
  }
}
```

---

## 🎨 Admin UI Layout

### Main Page
```
┌─────────────────────────────────────┐
│ 🎓 Batch Pricing Management         │
│                    [➕ Create New]   │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📚 Physics Class 12      Active│  │
│  │ Type: 💰 Paid                 │  │
│  │ Price: ₹999                   │  │
│  │ Discount: 10% off → ₹899      │  │
│  │ Final: ₹899                   │  │
│  │ [✏️ Edit] [🗑️ Delete]          │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📚 Chemistry Class 12   Active │  │
│  │ Type: 🆓 Free                  │  │
│  │ [✏️ Edit] [🗑️ Delete]          │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

### Edit Modal
```
┌──────────────────────────────────────────┐
│ ✏️ Edit Batch                          ✕ │
├──────────────────────────────────────────┤
│                                          │
│ 📚 Batch Name                            │
│ [Physics Class 12___________________]    │
│                                          │
│ 💰 Pricing Type                          │
│ ○ 🆓 Free  ○ 💳 Paid (selected)        │
│                                          │
│ Base Price (₹)                           │
│ [999________________________]             │
│                                          │
│ 🎁 Discount (Optional)                   │
│ Discount Type: [Fixed Amount ▼]          │
│ Discount Value: [100____________]        │
│ 💵 Final Price: ₹899                     │
│                                          │
│ 📝 Description                           │
│ [Physics course for JEE prep____]        │
│ [________________________]               │
│                                          │
│ [💾 Save] [Cancel]                      │
└──────────────────────────────────────────┘
```

---

## 🔧 API Reference

### Create Batch

**Endpoint:** `POST /api/batches/pricing`

**Request:**
```json
{
  "name": "Physics Class 12",
  "pricing_type": "paid",
  "base_price": 999,
  "discount": {
    "type": "percentage",
    "value": 10
  },
  "description": "Complete JEE Physics preparation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Physics Class 12",
    "pricing_type": "paid",
    "base_price": 999,
    "discount": { "type": "percentage", "value": 10 },
    "discounted_price": 899.1,
    "description": "Complete JEE Physics preparation"
  }
}
```

### Update Pricing

**Endpoint:** `PUT /api/batches/:name/pricing`

**Request:**
```json
{
  "pricing_type": "paid",
  "base_price": 1299,
  "discount": {
    "type": "fixed",
    "value": 100
  }
}
```

### Get Batch Pricing

**Endpoint:** `GET /api/batches/:name/pricing`

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Physics Class 12",
    "icon": "📚",
    "pricing_type": "paid",
    "base_price": 999,
    "discount": { "type": "percentage", "value": 10 },
    "discounted_price": 899.1,
    "description": "Complete JEE Physics preparation",
    "is_active": true
  }
}
```

### Get All Batches Pricing (Student View)

**Endpoint:** `GET /api/batches/pricing/all`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Physics Class 12",
      "icon": "📚",
      "pricing_type": "paid",
      "base_price": 999,
      "discount": { "type": "percentage", "value": 10 },
      "discounted_price": 899.1,
      "description": "Complete JEE Physics preparation"
    },
    {
      "name": "Chemistry Class 12",
      "icon": "⚗️",
      "pricing_type": "free",
      "base_price": 0,
      "discount": null,
      "discounted_price": 0,
      "description": ""
    }
  ]
}
```

---

## 💡 Usage Tips

### Discount Calculation

**Fixed Discount:**
- Use for standard price reductions
- Example: ₹100 off on ₹1000 = ₹900

**Percentage Discount:**
- Use for promotional offers
- Example: 20% off on ₹1000 = ₹800

### Best Practices

✅ **DO:**
- Set realistic prices based on course content
- Update discounts for seasonal offers
- Keep descriptions brief and informative
- Regularly review pricing competitiveness
- Test payment flow before going live

❌ **DON'T:**
- Set negative prices
- Create duplicate batches with same name
- Change pricing frequently (confuses students)
- Offer discounts > 100% (will be clamped)
- Forget to test on actual devices

---

## 🔗 Integration with Razorpay

When displaying batch selection to students:

```javascript
// Get batch pricing
const batch = await fetch(
  `${API_URL}/batches/pricing/all`
).then(r => r.json());

// Student selects batches and proceeds to Razorpay
const selectedBatches = [
  { name: 'Physics', price: 899 },
  { name: 'Chemistry', price: 0 }  // Free
];

// Calculate total (only paid batches)
const totalAmount = selectedBatches
  .filter(b => b.price > 0)
  .reduce((sum, b) => sum + b.price, 0);

// If totalAmount = 0, no payment needed
// Otherwise, show Razorpay checkout with this amount
```

---

## 📊 Database Schema

### Batch Model
```javascript
{
  _id: ObjectId,
  name: String,              // Unique batch name
  icon: String,              // e.g., "📚"
  pricing_type: String,      // "free" or "paid"
  base_price: Number,        // Original price
  discount: {
    type: String,            // "fixed" or "percentage"
    value: Number            // Discount amount/percentage
  },
  discounted_price: Number,  // Final price after discount
  description: String,       // Batch description
  is_active: Boolean,        // Active/Inactive status
  subjects: Array,           // Subjects in batch
  created_at: Date,
  updated_at: Date
}
```

---

## ❓ FAQ

**Q: Can I make a course both free and paid?**
- A: No, choose one type. For limited free access, use free trial instead.

**Q: What if I want to offer coupon codes?**
- A: This is planned for Phase 3. Use fixed/percentage discounts for now.

**Q: Can multiple students have different prices?**
- A: No, prices are batch-wide. Contact admin for custom pricing.

**Q: How do I handle seasonal discounts?**
- A: Update the discount field in batch pricing.

**Q: Can I delete a batch with enrolled students?**
- A: Yes, but it will remove access for all enrolled students. Confirm before deleting.

---

## 🆘 Troubleshooting

**Issue: Batches not loading**
- Check if admin token is valid
- Verify API endpoint is correct
- Check browser console for errors

**Issue: Discount not calculating**
- Ensure discount type and value are valid
- Base price must be > 0
- Percentage must be 0-100

**Issue: Modal won't close**
- Check if button ID matches HTML
- Ensure JavaScript is loaded

---

## 📝 Example Workflow

### Step 1: Create Physics Batch
1. Click "➕ Create New Batch"
2. Name: "Physics Class 12"
3. Type: Paid
4. Base Price: ₹999
5. Discount: 10% → Final: ₹899
6. Save

### Step 2: Create Chemistry Batch
1. Click "➕ Create New Batch"
2. Name: "Chemistry Class 12"
3. Type: Free
4. Save

### Step 3: Student Registration
- Student sees: Physics (₹899) and Chemistry (Free)
- Student selects both batches
- Total: ₹899 (Chemistry is free)
- Proceeds to Razorpay for payment

### Step 4: Update Pricing (Later)
1. Click "✏️ Edit" on Physics batch
2. Change discount to 20% → Final: ₹799
3. Save
4. Students see updated price: ₹799

---

## 🚀 Next Steps

After setting up batch pricing:

1. ✅ Integrate with student registration
2. ✅ Setup Razorpay payment gateway
3. ✅ Create payment validation
4. ✅ Setup subscription renewal
5. ✅ Create payment receipts
6. ✅ Setup refund process

---

**Version:** 1.0  
**Last Updated:** 2026-06-30  
**Status:** Production Ready 🎉
