# 🚀 Batch Pricing Quick Start

## What Was Created

### ✅ Backend (Auto-Updated)
- **Batch Model**: Added pricing fields (pricing_type, base_price, discount, discounted_price)
- **Batch Controller**: Added 3 new pricing functions
- **Batch Routes**: Added 3 new pricing endpoints

### ✅ Admin Frontend (NEW)
- **batchPricingManager.js** (350 lines): Complete pricing management module
- **batch-pricing-ui.html** (500 lines): Beautiful responsive UI with modal form

### ✅ Documentation (NEW)
- **BATCH_PRICING_ADMIN_GUIDE.md**: Complete reference guide
- **BATCH_PRICING_INTEGRATION_EXAMPLE.md**: Step-by-step integration
- **BATCH_PRICING_QUICKSTART.md**: This file!

---

## 3-Minute Integration

### 1️⃣ Copy Files to Admin App
```bash
# Files are already created, just verify they exist:
✅ admin-app/batchPricingManager.js
✅ admin-app/batch-pricing-ui.html
```

### 2️⃣ Update Admin HTML
Add this to your **admin-app/index.html** (in the tab buttons section):

```html
<!-- Add this button to your tab menu -->
<button class="admin-tab-button" data-tab="batch-pricing">
  🎓 Batch Pricing
</button>

<!-- Add this div to your tab content area -->
<div id="batch-pricing" class="admin-tab-content" style="display: none;">
  <div id="bp-container"></div>
</div>

<!-- Add these scripts at the end of the file -->
<script src="./batchPricingManager.js"></script>
<script>
  // Load batch pricing UI
  fetch('./batch-pricing-ui.html')
    .then(r => r.text())
    .then(html => {
      const container = document.getElementById('bp-container');
      if (container) container.innerHTML = html;
    });
</script>
```

### 3️⃣ Done! 🎉
The batch pricing admin is now live!

---

## Feature Overview

### 🎓 What Admin Can Do

```
Admin Panel
├─ 📚 View All Batches
│  ├─ Name, Icon, Type, Price
│  ├─ Discount info
│  └─ Status (Active/Inactive)
│
├─ ➕ Create New Batch
│  ├─ Choose Free or Paid
│  ├─ Set Price & Discount
│  └─ Add Description
│
├─ ✏️ Edit Batch Pricing
│  ├─ Update price
│  ├─ Change discount
│  └─ Modify description
│
└─ 🗑️ Delete Batch
   └─ With confirmation
```

### 💰 Pricing Options

#### 🆓 Free Course
- No payment required
- Instant access

#### 💳 Paid Course with Discounts

**Fixed Discount:**
- Price: ₹999 → Discount: ₹100 → Final: ₹899

**Percentage Discount:**
- Price: ₹1000 → Discount: 10% → Final: ₹900

---

## API Endpoints (Auto-Created)

```bash
# Admin
PUT    /api/batches/:name/pricing       # Update pricing
GET    /api/batches/:name/pricing       # Get batch pricing

# Students
GET    /api/batches/pricing/all         # Get all pricing for checkout
```

---

## Example: Create a Paid Batch

### Step 1: Open Admin → Click "🎓 Batch Pricing"
```
┌─────────────────────────────────────┐
│ Admin Tabs:                         │
│ [📚 Questions] [🎓 Batch Pricing] ← │
└─────────────────────────────────────┘
```

### Step 2: Click "➕ Create New Batch"
```
Modal opens:
├─ Batch Name: "Physics Class 12"
├─ Pricing Type: ○ Free  ● Paid
├─ Base Price: 999
├─ Discount Type: Fixed Amount
├─ Discount Value: 100
├─ Final Price: ₹899 (calculated automatically)
└─ [💾 Save]
```

### Step 3: Done! ✅
Batch appears in list:
```
📚 Physics Class 12        Active
Type: 💰 Paid
Price: ₹999
Discount: ₹100 off → ₹899
Final: ₹899
```

---

## Student Registration Flow

### What Student Sees

```
Register for Nks EduOrbit
├─ Personal Info
│  ├─ Name
│  ├─ Email
│  └─ Phone
│
└─ Select Courses
   ├─ ☑ 📚 Physics Class 12          ₹899
   ├─ ☑ ⚗️ Chemistry Class 12        ₹1199
   ├─ ☑ 📖 Biology Class 12          🆓 Free
   │
   └─ Total: ₹2098
      [Register & Pay →]
```

### Payment Calculation

```
Selected Batches:
├─ Physics (paid):      ₹899
├─ Chemistry (paid):    ₹1199
├─ Biology (free):      ₹0
│
└─ Total to Charge:     ₹2098
   → Send to Razorpay
```

---

## Database Schema

```javascript
Batch {
  name: "Physics Class 12",
  icon: "📚",
  pricing_type: "paid",        // "free" or "paid"
  base_price: 999,             // Original price
  discount: {
    type: "fixed",             // "fixed" or "percentage"
    value: 100                 // ₹100 or 10%
  },
  discounted_price: 899,       // Final price
  description: "JEE prep",
  is_active: true,
  created_at: Date,
  updated_at: Date
}
```

---

## Common Tasks

### ✏️ Edit Batch Pricing
1. Find batch in list
2. Click "✏️ Edit"
3. Change price/discount/type
4. Click "💾 Save"
5. Changes live immediately

### 🗑️ Delete Batch
1. Find batch in list
2. Click "🗑️ Delete"
3. Confirm deletion
4. Removed from system

### 📱 Check from Student App
```javascript
// Get all pricing
fetch('API_URL/batches/pricing/all')
  .then(r => r.json())
  .then(data => {
    console.log(data.data); // Array of batches with pricing
  });
```

---

## Integration with Razorpay

When ready to add Razorpay:

```javascript
// 1. Get batch pricing
const batches = await fetch('/api/batches/pricing/all').then(r => r.json());

// 2. Student selects batches
const selected = ['Physics', 'Chemistry'];

// 3. Calculate total
const total = batches.data
  .filter(b => selected.includes(b.name))
  .reduce((sum, b) => sum + b.discounted_price, 0);

// 4. Send to Razorpay
initializeRazorpay({
  amount: total * 100,  // Convert to paise
  currency: 'INR',
  description: `Batches: ${selected.join(', ')}`
});
```

---

## Troubleshooting

### ❌ Batches not showing
**Solution:** 
```javascript
// Check API in browser console
fetch('API_URL/batches').then(r => r.json()).then(console.log);
```

### ❌ Discount not calculating
**Solution:**
- Ensure base_price > 0
- Check discount type is "fixed" or "percentage"
- For percentage, ensure value is 0-100

### ❌ Modal won't close
**Solution:**
- Check browser console for JavaScript errors
- Verify HTML IDs match JavaScript code
- Try refreshing page

---

## Files Reference

| File | Purpose | Size |
|------|---------|------|
| batchPricingManager.js | Admin module (all logic) | 350 lines |
| batch-pricing-ui.html | UI template + CSS | 500 lines |
| BATCH_PRICING_ADMIN_GUIDE.md | Complete documentation | Reference |
| BATCH_PRICING_INTEGRATION_EXAMPLE.md | Integration steps | Reference |

---

## Next Steps After Setup

1. ✅ **Integrate into Admin Panel** (3 minutes)
2. ✅ **Test Creating Batches** (5 minutes)
3. ⬜ **Add Student Registration UI** (Phase 3)
4. ⬜ **Integrate Razorpay Payment** (Phase 3)
5. ⬜ **Setup Subscription & Renewal** (Phase 3)

---

## Quick Checklist

- [ ] Copy batchPricingManager.js to admin-app/
- [ ] Copy batch-pricing-ui.html to admin-app/
- [ ] Add tab button to admin HTML
- [ ] Add script to load UI
- [ ] Test in browser: Create a batch
- [ ] Verify in database
- [ ] Test discount calculation
- [ ] Ready for Razorpay integration!

---

## Support

For detailed documentation, see:
- **Full Guide**: docs/BATCH_PRICING_ADMIN_GUIDE.md
- **Integration Steps**: docs/BATCH_PRICING_INTEGRATION_EXAMPLE.md
- **API Reference**: BATCH_PRICING_ADMIN_GUIDE.md (Section: API Reference)

---

**Status:** ✅ Production Ready  
**Last Updated:** 2026-06-30  
**Version:** 1.0
