# Smart Learning System (SLS) — Comprehensive Test Plan

**Test Date**: 2026-06-30  
**Version**: 1.0  
**Status**: READY TO EXECUTE

---

## **SECTION 1: BACKEND API TESTING**

### **Test 1.1: Authentication & Authorization**

#### Test Case 1.1.1: Admin Access
```
Endpoint: POST /api/admin/sls/
Headers: Authorization: Bearer <admin-token>
Expected: ✅ 201 Created
```

#### Test Case 1.1.2: Student Access to Admin Endpoint
```
Endpoint: POST /api/admin/sls/
Headers: Authorization: Bearer <student-token>
Expected: ❌ 403 Forbidden
```

---

### **Test 1.2: Create Concept**

#### Test Case 1.2.1: Valid Concept Creation
```json
POST /api/admin/sls/
{
  "chapterId": "ch123",
  "language": "english",
  "title": {
    "english": "Introduction to Photosynthesis",
    "marathi": ""
  },
  "learningOutcomes": {
    "english": ["Understand light reactions", "Know Calvin cycle"],
    "marathi": []
  },
  "description": {
    "english": {
      "blocks": [
        {
          "type": "heading",
          "data": { "text": "Photosynthesis", "level": 2 }
        },
        {
          "type": "paragraph",
          "data": { "text": "Photosynthesis is the process..." }
        }
      ]
    },
    "marathi": { "blocks": [] }
  },
  "shortNotes": {
    "english": ["Light reactions occur in thylakoids", "Calvin cycle in stroma"],
    "marathi": []
  },
  "revisionBox": {
    "english": {
      "remember": ["6CO2 + 6H2O → C6H12O6 + 6O2"],
      "mistakes": ["Don't confuse light reactions with Calvin cycle"],
      "formulas": ["C3 → C6 → G3P"],
      "examTips": ["Always mention chloroplast location"]
    },
    "marathi": { "remember": [], "mistakes": [], "formulas": [], "examTips": [] }
  },
  "examTags": ["board_exam", "important", "numerical"],
  "difficulty": "easy"
}

Expected Response:
{
  "success": true,
  "message": "Concept created successfully",
  "data": {
    "_id": "ObjectId",
    "chapterId": "ch123",
    "status": "draft",
    "order": 1,
    "createdAt": "2026-06-30T...",
    ...
  }
}
Status: ✅ 201 Created
```

#### Test Case 1.2.2: Missing Required Fields
```json
POST /api/admin/sls/
{
  "chapterId": "ch123"
  // Missing title.english
}

Expected: ❌ 400 Bad Request
Message: "Missing required fields: chapterId, title.english"
```

#### Test Case 1.2.3: Invalid EditorJS Blocks
```json
{
  ...
  "description": {
    "english": {
      "blocks": [
        {
          "type": "invalid_type",  // Not in enum
          "data": { "text": "..." }
        }
      ]
    }
  }
}

Expected: ❌ 400 Bad Request
Message: "Invalid English content blocks"
```

---

### **Test 1.3: Get Concepts (List)**

#### Test Case 1.3.1: Get All Concepts in Chapter
```
GET /api/sls/chapters/ch123/concepts?status=published

Expected: ✅ 200 OK
Response:
{
  "success": true,
  "data": {
    "concepts": [
      {
        "_id": "...",
        "title": { "english": "...", "marathi": "..." },
        "difficulty": "easy",
        "examTags": ["board_exam", "important"],
        "analytics": { "totalViews": 42 },
        "status": "published"
      }
    ],
    "total": 1
  }
}
```

#### Test Case 1.3.2: Get Draft Concepts (Admin)
```
GET /api/admin/sls/ch123/concepts?status=draft

Expected: ✅ 200 OK
Returns only draft concepts
```

---

### **Test 1.4: Get Single Concept**

#### Test Case 1.4.1: Admin Editing a Concept
```
GET /api/admin/sls/conceptId123

Expected: ✅ 200 OK
Returns full concept with:
- Complete description blocks
- All revisions
- Version history
```

#### Test Case 1.4.2: Student Viewing Published Concept
```
GET /api/sls/conceptId123/view

Expected: ✅ 200 OK
Returns only if status === "published"
```

#### Test Case 1.4.3: Student Tries to View Draft Concept
```
GET /api/sls/draftConceptId/view

Expected: ❌ 404 Not Found (filtered by status)
```

---

### **Test 1.5: Update Concept**

#### Test Case 1.5.1: Update Title and Difficulty
```json
PATCH /api/admin/sls/conceptId123
{
  "title": {
    "english": "Updated Title",
    "marathi": "अद्यतनित शीर्षक"
  },
  "difficulty": "hard",
  "changesSummary": "Updated difficulty level"
}

Expected: ✅ 200 OK
- Creates new version
- Stores snapshot of old version
- Returns updated concept
```

#### Test Case 1.5.2: Verify Version History Created
```
Check ConceptVersion collection:
{
  "conceptId": "conceptId123",
  "versionNumber": 1,
  "snapshot": { /* old data */ },
  "changesSummary": "Updated difficulty level",
  "changedBy": "admin_id"
}

Expected: ✅ Version record exists
```

---

### **Test 1.6: Publish Concept**

#### Test Case 1.6.1: Publish Draft Concept
```
POST /api/admin/sls/conceptId123/publish

Expected: ✅ 200 OK
{
  "success": true,
  "message": "Concept published successfully",
  "data": {
    "status": "published",
    "publishedAt": "2026-06-30T..."
  }
}
```

#### Test Case 1.6.2: Publish Already Published Concept
```
POST /api/admin/sls/publishedConceptId/publish

Expected: ✅ 200 OK (idempotent, updates publishedAt timestamp)
```

---

### **Test 1.7: Restore Version**

#### Test Case 1.7.1: Restore Previous Version
```json
POST /api/admin/sls/conceptId123/restore
{
  "versionNumber": 1
}

Expected: ✅ 200 OK
- Concept data reverts to version 1
- New version created (version 2) with "Restored from version 1"
- Original version 1 untouched
```

---

### **Test 1.8: Search Concepts**

#### Test Case 1.8.1: Search by Keyword
```
GET /api/sls/search?q=photosynthesis&limit=20

Expected: ✅ 200 OK
Returns concepts where title matches "photosynthesis"
Sorted by relevance score
```

#### Test Case 1.8.2: Search Too Short
```
GET /api/sls/search?q=a

Expected: ❌ 400 Bad Request
Message: "Search query must be at least 2 characters"
```

#### Test Case 1.8.3: Only Published Concepts Returned
```
Search for "photosynthesis"

Expected: ✅ Returns only concepts with status === "published"
Draft/archived concepts excluded
```

---

### **Test 1.9: Delete Concept**

#### Test Case 1.9.1: Delete Concept (Cascading)
```
DELETE /api/admin/sls/conceptId123

Expected: ✅ 200 OK
Verify cascade deletes:
- Concept record deleted
- ConceptVersion records deleted
- StudentProgress records deleted
- ConceptAnalytics record deleted
```

#### Test Case 1.9.2: Delete Non-Existent Concept
```
DELETE /api/admin/sls/nonExistentId

Expected: ❌ 404 Not Found
```

---

### **Test 1.10: Auto-Translate**

#### Test Case 1.10.1: Mark for Translation
```
POST /api/admin/sls/conceptId123/translate

Expected: ✅ 200 OK
- language field changed to "bilingual"
- title.marathi gets "[मराठी] English Title"
- Stored for future AI translation
```

---

## **SECTION 2: ADMIN PANEL UI TESTING**

### **Test 2.1: Tab Navigation**

#### Test Case 2.1.1: Click "Concepts (SLS)" Tab
```
Action: Click "📚 Concepts (SLS)" tab in admin
Expected:
  ✅ Tab becomes active
  ✅ HTML id="atab-concepts" shows
  ✅ CONCEPT_MANAGER.init() called
  ✅ Batch dropdown populated
```

---

### **Test 2.2: Batch Selection**

#### Test Case 2.2.1: Select Batch from Dropdown
```
Action:
  1. Click cm-batch-sel
  2. Select "X-Science-2024"
Expected:
  ✅ Subject dropdown becomes enabled
  ✅ Subjects for batch loaded
  ✅ Concepts list cleared
  ✅ Batch stored in state
```

---

### **Test 2.3: Subject Selection**

#### Test Case 2.3.1: Select Subject
```
Action:
  1. Select batch "X-Science-2024"
  2. Click cm-subject-sel
  3. Select "Physics"
Expected:
  ✅ Chapter dropdown enabled
  ✅ Chapters for Physics loaded
  ✅ Shows chapter names
```

---

### **Test 2.4: Chapter Selection**

#### Test Case 2.4.1: Load Concepts for Chapter
```
Action:
  1. Select batch, subject, chapter
Expected:
  ✅ GET /api/sls/chapters/{chapterId}/concepts called
  ✅ Concept list rendered in sidebar
  ✅ Shows title, order, status badge
  ✅ Each has ✏️ and 🗑️ buttons
```

#### Test Case 2.4.2: Empty Chapter
```
Action: Select chapter with no concepts
Expected:
  ✅ "No concepts yet. Create one to begin." message
  ✅ "New Concept" button visible
```

---

### **Test 2.5: Create New Concept**

#### Test Case 2.5.1: Open New Concept Form
```
Action: Click "+ New Concept"
Expected:
  ✅ Editor form appears
  ✅ All fields empty/default
  ✅ Title inputs focused
  ✅ Language selector shows "english"
```

#### Test Case 2.5.2: Fill Concept Form
```
Actions:
  1. Enter title "Gravitation"
  2. Enter 2 learning outcomes
  3. Enter content in EditorJS textarea
  4. Add 3 short notes
  5. Select exam tags: board_exam, numerical, important
  6. Set difficulty: medium

Expected:
  ✅ All fields accept input
  ✅ Tags toggle visually
  ✅ Short notes list grows
  ✅ Revision box items manageable
```

---

### **Test 2.6: Save & Publish**

#### Test Case 2.6.1: Save as Draft
```
Action: Click "Save Draft"
Expected:
  ✅ POST /api/admin/sls/ called
  ✅ Response: 201 Created
  ✅ Toast: "Concept saved!"
  ✅ Concept appears in list with status "draft"
```

#### Test Case 2.6.2: Publish Concept
```
Action: Click "Publish"
Expected:
  ✅ Concept saved first
  ✅ POST /api/admin/sls/{id}/publish called
  ✅ Status changes to "published"
  ✅ Toast: "Concept published!"
  ✅ List item badge shows "published"
```

---

### **Test 2.7: Edit Concept**

#### Test Case 2.7.1: Click Edit Button
```
Action: Click ✏️ on concept in list
Expected:
  ✅ GET /api/admin/sls/{conceptId} called
  ✅ Form populates with all data
  ✅ Editor shows content
  ✅ Learning outcomes listed
  ✅ Exam tags checked
```

#### Test Case 2.7.2: Modify and Save
```
Action:
  1. Change title
  2. Add learning outcome
  3. Click "Save Draft"
Expected:
  ✅ PATCH /api/admin/sls/{id} called
  ✅ Version created in history
  ✅ Toast: "Concept updated!"
  ✅ List refreshes
```

---

### **Test 2.8: Delete Concept**

#### Test Case 2.8.1: Delete from List
```
Action: Click 🗑️ on concept
Expected:
  ✅ Confirmation dialog appears
  ✅ Message: "Are you sure?"
```

#### Test Case 2.8.2: Confirm Delete
```
Action: Click "Delete" in confirmation
Expected:
  ✅ DELETE /api/admin/sls/{id} called
  ✅ Toast: "Concept deleted"
  ✅ Concept removed from list
  ✅ Editor hidden
```

---

## **SECTION 3: STUDENT APP TESTING**

### **Test 3.1: Load Notes Screen**

#### Test Case 3.1.1: Navigate to Notes (Future Implementation)
```
Action: Click "Notes" in home menu
Expected:
  ✅ NOTES_VIEWER.init() called
  ✅ screen-notes becomes active
  ✅ Chapter list loaded
  ✅ All chapters displayed in grid
```

---

### **Test 3.2: Chapter List**

#### Test Case 3.2.1: View Chapters
```
Expected Display:
  ✅ Grid of chapter cards
  ✅ Each shows: Chapter name, Batch code
  ✅ Cards clickable
  ✅ Responsive on mobile
```

#### Test Case 3.2.2: Click Chapter
```
Action: Click chapter card
Expected:
  ✅ GET /api/sls/chapters/{chapterId}/concepts called
  ✅ Concepts list appears
  ✅ Back button visible
  ✅ Search bar visible
```

---

### **Test 3.3: Concepts List**

#### Test Case 3.3.1: View Concepts
```
Expected Display:
  ✅ List of concept cards
  ✅ Shows title, difficulty badge, tags
  ✅ Color-coded difficulty (green=easy, yellow=medium, red=hard)
  ✅ Tag badges with colors
```

#### Test Case 3.3.2: Click Concept
```
Action: Click concept
Expected:
  ✅ GET /api/sls/{conceptId}/view called
  ✅ Full concept content displays
  ✅ Back button visible
  ✅ Mode selector visible (📖, 🎯, ⚡)
  ✅ Language buttons visible (🇬🇧, 🇮🇳)
```

---

### **Test 3.4: Study Modes**

#### Test Case 3.4.1: Read Mode (Default)
```
Action: Open concept in Read mode
Expected Display:
  ✅ Learning Outcomes section (if any)
  ✅ Full description content
  ✅ All EditorJS blocks rendered
  ✅ Images with captions
  ✅ Tables formatted
  ✅ Attachments section at bottom
```

#### Test Case 3.4.2: Exam Mode
```
Action: Click 🎯 (Exam Mode)
Expected Display:
  ✅ Key Points section (from shortNotes)
  ✅ Important Formulas section
  ✅ No full description
  ✅ No attachments
  ✅ Focused on essentials
```

#### Test Case 3.4.3: Revision Mode
```
Action: Click ⚡ (Revision Mode)
Expected Display:
  ✅ Quick Revision box (yellow background)
  ✅ Remember section (🔑)
  ✅ Mistakes to Avoid section (❌)
  ✅ Formulas section (📐)
  ✅ Exam Tips section (💡)
  ✅ Compact, scannable format
```

---

### **Test 3.5: Language Toggle**

#### Test Case 3.5.1: Switch to Marathi
```
Action: Click 🇮🇳 (Marathi)
Expected:
  ✅ Button becomes active
  ✅ Content switches to Marathi
  ✅ title.marathi displays
  ✅ description.marathi.blocks render
  ✅ Preference saved in localStorage
```

#### Test Case 3.5.2: Missing Marathi Content
```
Scenario: Concept has only English
Action: Click 🇮🇳
Expected:
  ✅ Shows English content (fallback)
  ✅ No error
  ✅ Gracefully handles missing translation
```

---

### **Test 3.6: EditorJS Block Rendering**

#### Test Case 3.6.1: Paragraph Block
```
Block Data: { "type": "paragraph", "data": { "text": "Text here" } }
Expected: ✅ <p class="nv-paragraph">Text here</p>
```

#### Test Case 3.6.2: Heading Block
```
Block Data: { "type": "heading", "data": { "text": "Title", "level": 2 } }
Expected: ✅ <h2 class="nv-heading">Title</h2>
```

#### Test Case 3.6.3: Image Block
```
Block Data: { "type": "image", "data": { "url": "...", "caption": "..." } }
Expected:
  ✅ <img> with src
  ✅ <figcaption> below
  ✅ Responsive image
  ✅ Border and styling
```

#### Test Case 3.6.4: Table Block
```
Block Data: { "type": "table", "data": { "content": [[cells...]] } }
Expected:
  ✅ <table> with <td> cells
  ✅ Alternating row colors
  ✅ Scrollable on mobile
```

#### Test Case 3.6.5: Note Box (Info)
```
Block Data: { "type": "note_box", "data": { "text": "..." } }
Expected:
  ✅ Blue background
  ✅ Left border (blue)
  ✅ Text colored appropriately
```

#### Test Case 3.6.6: Warning Box
```
Block Data: { "type": "warning_box", "data": { "text": "..." } }
Expected:
  ✅ Yellow/orange background
  ✅ Warning border
  ✅ Stands out from info boxes
```

#### Test Case 3.6.7: Quote Block
```
Block Data: { "type": "quote", "data": { "text": "...", "caption": "..." } }
Expected:
  ✅ Blockquote with left border
  ✅ Italic text
  ✅ Author attribution below
```

#### Test Case 3.6.8: Checklist Block
```
Block Data: { "type": "checklist", "data": { "items": [{text, checked}] } }
Expected:
  ✅ <ul class="nv-checklist">
  ✅ Checkboxes show checked state
  ✅ Checkboxes disabled (read-only)
```

#### Test Case 3.6.9: Divider Block
```
Block Data: { "type": "divider" }
Expected: ✅ <hr class="nv-divider">
```

---

### **Test 3.7: Attachments**

#### Test Case 3.7.1: Display Attachments
```
Attachments Array:
[
  { type: "pdf", title: "Worksheet.pdf", url: "..." },
  { type: "audio", title: "Explanation.mp3", url: "..." },
  { type: "video", title: "Tutorial.mp4", url: "..." },
  { type: "external_link", title: "Wikipedia Link", url: "..." }
]

Expected:
  ✅ Section titled "📎 Resources"
  ✅ Each attachment is a clickable link
  ✅ Icons: 📄 (PDF), 🖼️ (Image), 🔊 (Audio), 🎬 (Video), 🔗 (Link)
  ✅ Title displayed
  ✅ Opens in new tab
```

---

### **Test 3.8: Search**

#### Test Case 3.8.1: Search Concepts (In Chapter)
```
Action:
  1. In chapter list, type "graviton" in search
  2. Wait 300ms
Expected:
  ✅ Filters concepts to matching titles
  ✅ Shows only "gravitation" concept
  ✅ Real-time filtering
```

#### Test Case 3.8.2: Search Global
```
Action: Type search query (when not in chapter)
Expected:
  ✅ GET /api/sls/search?q=query called
  ✅ Results show across all chapters
  ✅ Sorted by relevance
```

---

### **Test 3.9: Navigation**

#### Test Case 3.9.1: Back Button
```
Action:
  1. Click chapter
  2. Click concept
  3. Click Back button
Expected:
  ✅ Returns to chapter list
  ✅ Concepts list visible again
```

#### Test Case 3.9.2: Breadcrumb Navigation
```
Expected Flow:
  Chapters → Chapter → Concept
  
Verify back/forward works correctly
```

---

### **Test 3.10: Responsive Design**

#### Test Case 3.10.1: Mobile Display (< 600px)
```
Test on: iPhone 12, Samsung Galaxy S21

Expected:
  ✅ Toolbar stacks properly
  ✅ Chapter grid single column
  ✅ Content readable
  ✅ Buttons touch-friendly (>44px)
  ✅ Images responsive
  ✅ Tables scrollable
```

#### Test Case 3.10.2: Tablet Display (600px - 1024px)
```
Test on: iPad, Android tablet

Expected:
  ✅ 2-column grid for chapters
  ✅ Toolbar responsive
  ✅ Readable font sizes
  ✅ Touch gestures work
```

#### Test Case 3.10.3: Desktop Display (> 1024px)
```
Test on: Chrome, Firefox, Safari on desktop

Expected:
  ✅ Multi-column layouts
  ✅ All features visible
  ✅ Hover states work
  ✅ Scrolling smooth
```

---

## **SECTION 4: DATA INTEGRITY TESTING**

### **Test 4.1: Version History**

#### Test Case 4.1.1: Multiple Edits Create Versions
```
Actions:
  1. Create concept (version 1)
  2. Edit title (creates version 2)
  3. Edit difficulty (creates version 3)
  4. Edit content (creates version 4)

Expected:
  ✅ 4 versions in ConceptVersion collection
  ✅ Each has correct snapshot
  ✅ Each has correct versionNumber
  ✅ All snapshots different
```

#### Test Case 4.1.2: Restore Preserves Original
```
Actions:
  1. Create concept (v1)
  2. Edit (v2)
  3. Restore v1 (creates v3 with "Restored from version 1")

Expected:
  ✅ v1 unchanged
  ✅ v2 unchanged
  ✅ v3 is copy of v1
  ✅ Current concept = v3
  ✅ Can restore v2 again
```

---

### **Test 4.2: Bilingual Data**

#### Test Case 4.2.1: English-Only Concept
```
language: "english"
title: { english: "...", marathi: "" }

Expected:
  ✅ Student can view in English
  ✅ Marathi toggle available but shows English (fallback)
  ✅ No errors
```

#### Test Case 4.2.2: Bilingual Concept
```
language: "bilingual"
title: { english: "...", marathi: "..." }
description: { english: {...}, marathi: {...} }

Expected:
  ✅ Both languages fully supported
  ✅ Toggle switches between them
  ✅ All content translates
  ✅ Learning outcomes in both languages
```

---

### **Test 4.3: Exam Tags**

#### Test Case 4.3.1: Tag Storage and Retrieval
```
Tags: ["board_exam", "important", "numerical"]

Expected:
  ✅ Stored in MongoDB
  ✅ Retrieved correctly
  ✅ Displayed with correct icons/colors
  ✅ Searchable by tag
```

---

### **Test 4.4: Cascading Deletes**

#### Test Case 4.4.1: Delete Concept Cleans Up
```
Concept "C1" has:
- 3 versions in ConceptVersion
- 5 student progress records in StudentProgress
- 1 analytics record in ConceptAnalytics

Action: DELETE /api/admin/sls/C1

Expected:
  ✅ Concept document deleted
  ✅ 3 ConceptVersion records deleted
  ✅ 5 StudentProgress records deleted
  ✅ 1 ConceptAnalytics record deleted
  ✅ No orphaned data
```

---

## **SECTION 5: PERFORMANCE TESTING**

### **Test 5.1: Load Times**

#### Test Case 5.1.1: Get Concepts List (100 concepts)
```
GET /api/sls/chapters/ch123/concepts

Expected: ✅ < 500ms response time
```

#### Test Case 5.1.2: Search (1000 published concepts)
```
GET /api/sls/search?q=photosynthesis

Expected: ✅ < 1000ms response time
```

#### Test Case 5.1.3: Admin Load Concept for Editing
```
GET /api/admin/sls/conceptId

Expected: ✅ < 300ms response time
```

---

### **Test 5.2: Memory Usage**

#### Test Case 5.2.1: Large EditorJS Content
```
Concept with:
- 50 paragraph blocks
- 20 images
- 10 tables
- 50 attachments

Expected:
  ✅ Loads without hanging
  ✅ Scrolling smooth (60fps)
  ✅ No memory leaks on navigation
```

---

## **SECTION 6: ERROR HANDLING & EDGE CASES**

### **Test 6.1: Network Errors**

#### Test Case 6.1.1: API Timeout
```
Scenario: Slow network, 10s timeout
Action: Load concepts list

Expected:
  ✅ Toast: "Failed to load concepts"
  ✅ Graceful error, no crash
  ✅ Can retry
```

#### Test Case 6.1.2: 404 Response
```
GET /api/sls/nonExistentConceptId/view

Expected: ✅ 404 Not Found, handled gracefully
```

---

### **Test 6.2: Data Edge Cases**

#### Test Case 6.2.1: Empty Description Blocks
```
description: { english: { blocks: [] } }

Expected: ✅ Renders without error, message "No content"
```

#### Test Case 6.2.2: Missing Optional Fields
```
Concept missing:
- attachment
- revisionBox
- relatedConceptIds

Expected: ✅ Renders correctly, optional sections hidden
```

#### Test Case 6.2.3: Very Long Title
```
title: "This is an extremely long title that should wrap and not break the layout because we need to handle all possible edge cases gracefully"

Expected:
  ✅ Text wraps properly
  ✅ Layout not broken
  ✅ Readable on all screen sizes
```

---

### **Test 6.3: XSS Prevention**

#### Test Case 6.3.1: Malicious Content in Title
```
title: "<img src=x onerror='alert(\"XSS\")'>"

Expected:
  ✅ Stored as escaped text
  ✅ Rendered as text, not HTML
  ✅ No alert triggered
  ✅ Shows: "<img src=x...>"
```

#### Test Case 6.3.2: Script Tags in Notes
```
shortNotes: ["<script>alert('hack')</script>"]

Expected:
  ✅ Escaped by _esc function
  ✅ Rendered as plain text
  ✅ No script execution
```

---

## **SECTION 7: ACCESSIBILITY TESTING**

### **Test 7.1: Keyboard Navigation**

#### Test Case 7.1.1: Tab Through Concepts
```
Action: Press Tab repeatedly
Expected:
  ✅ Can tab through all buttons
  ✅ Visible focus indicators
  ✅ Logical tab order
  ✅ Can select concepts with Enter
```

---

### **Test 7.2: Screen Reader Testing**

#### Test Case 7.2.1: Announce Section Titles
```
Screen reader should read:
- "📚 Learning Outcomes" header
- "📖 Key Points" header
- "⚡ Exam Tips" header

Expected: ✅ Screen reader announces structure
```

---

## **SECTION 8: BROWSER COMPATIBILITY**

### **Test 8.1: Modern Browsers**

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 120+ | ✅ Test | Latest |
| Firefox | 120+ | ✅ Test | Latest |
| Safari | 16+ | ✅ Test | iOS + macOS |
| Edge | 120+ | ✅ Test | Chromium-based |

---

## **TEST EXECUTION CHECKLIST**

```
BACKEND TESTS:
  [ ] 1.1: Auth & Authorization
  [ ] 1.2: Create Concept
  [ ] 1.3: Get Concepts
  [ ] 1.4: Get Single Concept
  [ ] 1.5: Update Concept
  [ ] 1.6: Publish Concept
  [ ] 1.7: Restore Version
  [ ] 1.8: Search Concepts
  [ ] 1.9: Delete Concept
  [ ] 1.10: Auto-Translate

ADMIN PANEL TESTS:
  [ ] 2.1: Tab Navigation
  [ ] 2.2: Batch Selection
  [ ] 2.3: Subject Selection
  [ ] 2.4: Chapter Selection
  [ ] 2.5: Create New Concept
  [ ] 2.6: Save & Publish
  [ ] 2.7: Edit Concept
  [ ] 2.8: Delete Concept

STUDENT APP TESTS:
  [ ] 3.1: Load Notes Screen
  [ ] 3.2: Chapter List
  [ ] 3.3: Concepts List
  [ ] 3.4: Study Modes (Read/Exam/Revision)
  [ ] 3.5: Language Toggle
  [ ] 3.6: EditorJS Blocks (all 9 types)
  [ ] 3.7: Attachments
  [ ] 3.8: Search
  [ ] 3.9: Navigation
  [ ] 3.10: Responsive Design

DATA INTEGRITY TESTS:
  [ ] 4.1: Version History
  [ ] 4.2: Bilingual Data
  [ ] 4.3: Exam Tags
  [ ] 4.4: Cascading Deletes

PERFORMANCE TESTS:
  [ ] 5.1: Load Times
  [ ] 5.2: Memory Usage

ERROR HANDLING TESTS:
  [ ] 6.1: Network Errors
  [ ] 6.2: Data Edge Cases
  [ ] 6.3: XSS Prevention

ACCESSIBILITY TESTS:
  [ ] 7.1: Keyboard Navigation
  [ ] 7.2: Screen Reader Testing

BROWSER COMPATIBILITY TESTS:
  [ ] 8.1: Chrome
  [ ] 8.1: Firefox
  [ ] 8.1: Safari
  [ ] 8.1: Edge
```

---

**Total Test Cases: 80+**  
**Estimated Time: 6-8 hours**

---

