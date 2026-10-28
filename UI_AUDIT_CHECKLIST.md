# 🎨 Complete UI/UX Audit Checklist - Vitaloop Cabinet

**Audit Date:** May 27, 2026  
**Test User:** a@a.com / Aaaaaa  
**Objective:** Verify all pages meet professional service standards

---

## 📋 Audit Scope

### Pages to Audit (30 pages)
1. **Auth Pages**
   - [ ] Login.jsx
   - [ ] EmailConfirmation.jsx

2. **Main Cabinet/Dashboard**
   - [ ] UserDashboard.jsx (entry point after login)
   - [ ] Progress.jsx (progress tracking)
   - [ ] Results.jsx (lab results view)
   - [ ] Upload.jsx (file upload) ← NEWLY UPDATED

3. **Health & Onboarding**
   - [ ] Onboarding.jsx
   - [ ] HealthProfile.jsx
   - [ ] Questionnaire.jsx
   - [ ] WeeklyCheckIn.jsx
   - [ ] Avatar.jsx (profile picture)

4. **Protocols & Programs**
   - [ ] ProtocolPage.jsx
   - [ ] AssignmentDetails.jsx
   - [ ] PersonalizedHealthTips
   - [ ] Insights.jsx

5. **Account Management**
   - [ ] Subscription.jsx (billing)
   - [ ] BillingHistory.jsx
   - [ ] LabResultsList.jsx
   - [ ] ClientAdmin.jsx

6. **Information Pages**
   - [ ] Help.jsx
   - [ ] FAQ.jsx
   - [ ] Privacy.jsx
   - [ ] Terms.jsx

7. **Public Pages**
   - [ ] Landing.jsx
   - [ ] Features.jsx
   - [ ] Pricing.jsx
   - [ ] Product.jsx
   - [ ] About.jsx
   - [ ] ForNutritionists.jsx
   - [ ] ForInvestors.jsx
   - [ ] Stories.jsx

8. **Error Pages**
   - [ ] NotFound.jsx (404)
   - [ ] ExampleReport.jsx

---

## 🎯 Professional UI Standards to Check

### 1. Visual Hierarchy & Typography ✓
**Criteria:**
- [ ] Clear heading hierarchy (H1 > H2 > H3)
- [ ] Font sizes: Headings distinguishable from body text
- [ ] Font weights: Bold for emphasis, normal for body
- [ ] Line heights: Adequate spacing for readability
- [ ] Color contrast: WCAG AA standard (4.5:1 for text)
- [ ] Text alignment: Proper alignment (left for body, center for headers)

**Professional Standards:**
- H1: 28-32px, 600-700 weight
- H2: 20-24px, 600 weight
- H3: 16-18px, 600 weight
- Body: 14-16px, 400 weight
- Small text: 12-13px, 400 weight

### 2. Color Scheme & Branding ✓
**Criteria:**
- [ ] Consistent brand colors throughout
- [ ] Primary color: Emerald green (#10b981)
- [ ] Accent colors used appropriately
- [ ] Dark mode support (if applicable)
- [ ] Sufficient contrast ratios
- [ ] No color-only information conveying meaning

**Brand Colors:**
- Primary: #10b981 (Emerald)
- Dark BG: #0A0F1C
- White: #FFFFFF
- Text: #1F2937 (light), #F3F4F6 (dark)

### 3. Button Standards ✓
**All buttons should have:**
- [ ] Clear, action-oriented labels
- [ ] Proper sizing: Min 44x44px (touch target)
- [ ] Hover states (visible feedback)
- [ ] Active/pressed states
- [ ] Disabled states (grayed out, cursor: not-allowed)
- [ ] Focus states (for keyboard navigation)
- [ ] Consistent styling across app
- [ ] Loading states (if async)
- [ ] Success/error states (if applicable)

**Button Types:**
- [ ] Primary buttons: Filled, emerald green
- [ ] Secondary buttons: Outlined or subtle
- [ ] Danger buttons: Red/orange for destructive actions
- [ ] Icon buttons: Proper sizing & spacing
- [ ] Text buttons: Underline on hover

### 4. Input Fields ✓
**All inputs should have:**
- [ ] Clear labels (above or placeholder)
- [ ] Visible focus state (border highlight)
- [ ] Error states (red border + message)
- [ ] Success states (if applicable)
- [ ] Placeholder text (hint, not replacement for label)
- [ ] Proper spacing (label to field to button)
- [ ] Consistent height (44-48px recommended)
- [ ] Adequate padding (horizontal & vertical)
- [ ] Clear error messages

### 5. Cards & Container Styling ✓
**All cards should have:**
- [ ] Consistent border radius (16-24px)
- [ ] Proper shadow depth (not too dark/light)
- [ ] Padding consistency (16-24px)
- [ ] Hover effects (subtle elevation or background change)
- [ ] Spacing between cards (consistent gutters)
- [ ] Break points for responsive design

**Cabinet Card Style:**
- Border-radius: 24px
- Padding: 20-24px
- Shadow: Medium (0 4px 6px rgba(0,0,0,0.07))
- Border: Subtle emerald inset (optional)

### 6. Icons & Badges ✓
**All icons should:**
- [ ] Match design system (Lucide icons preferred)
- [ ] Proper sizing (16px-32px for UI, 48px+ for illustrations)
- [ ] Consistent stroke width
- [ ] Color matching (not too bright/dark)
- [ ] Proper spacing around icons
- [ ] Semantic meaning (appropriate icons for actions)

**Badges:**
- [ ] Clear status indicators (colors)
- [ ] Proper sizing & padding
- [ ] Readable text on background
- [ ] Consistent styling

### 7. Spacing & Layout ✓
**Consistent spacing system:**
- [ ] 4px grid system (or similar)
- [ ] Regular spacing increments: 4, 8, 12, 16, 20, 24, 32px
- [ ] Consistent margins/padding
- [ ] Proper gutters (16-24px)
- [ ] Vertical rhythm maintained
- [ ] Mobile padding (12-16px)
- [ ] Desktop padding (24-32px)

### 8. Responsive Design ✓
**All pages should work on:**
- [ ] Mobile: 320px - 480px (iPhone SE, small phones)
- [ ] Tablet: 481px - 768px (iPad mini)
- [ ] Desktop: 769px+ (larger screens)
- [ ] No horizontal scrolling on mobile
- [ ] Text readable without zoom
- [ ] Touch targets min 44x44px mobile
- [ ] Images responsive (no overflow)
- [ ] Proper stacking on mobile

### 9. Navigation ✓
**Navigation should be:**
- [ ] Clear and intuitive
- [ ] Consistent across pages
- [ ] Mobile-friendly (hamburger on small screens)
- [ ] Active state indicators
- [ ] Breadcrumbs (if needed)
- [ ] Back buttons (where appropriate)
- [ ] Footer links functional

### 10. Data Visualization ✓
**Charts, graphs, metrics:**
- [ ] Clear labels & legend
- [ ] Readable colors (colorblind friendly)
- [ ] Proper axis labels
- [ ] Data point hover tooltips
- [ ] Consistent styling
- [ ] No overlapping text
- [ ] Responsive sizing on mobile

### 11. Forms & Validation ✓
**Form elements:**
- [ ] Clear form structure
- [ ] Required field indicators (*)
- [ ] Helpful placeholder text
- [ ] Real-time validation (optional)
- [ ] Clear error messages (not "Error")
- [ ] Success messages
- [ ] Submit button clear & prominent
- [ ] Loading state during submission
- [ ] Form resets after success (if appropriate)

### 12. Loading States ✓
**Loading indicators:**
- [ ] Skeleton loaders (preferred) or spinners
- [ ] Clear indication of what's loading
- [ ] Not blocking entire page
- [ ] Proper timing (shouldn't flash)
- [ ] Animated smoothly
- [ ] Accessible (loading text for screen readers)

### 13. Empty States ✓
**Empty states:**
- [ ] Not just blank
- [ ] Helpful message
- [ ] Illustration or icon
- [ ] Call-to-action (e.g., "Upload first lab")
- [ ] Clear direction

### 14. Error & Success States ✓
**Error pages:**
- [ ] Clear error message
- [ ] What went wrong (specifics)
- [ ] How to fix it
- [ ] Contact support link (if appropriate)
- [ ] Home/back button

**Success states:**
- [ ] Confirmation message
- [ ] What to do next
- [ ] Next button/action

### 15. Accessibility ✓
**WCAG 2.1 AA compliance:**
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus visible on all interactive elements
- [ ] Semantic HTML (proper heading hierarchy)
- [ ] ARIA labels where needed
- [ ] Color not only way to convey info
- [ ] Proper alt text on images
- [ ] Form labels associated with inputs
- [ ] Sufficient color contrast (4.5:1)

### 16. Performance & Polish ✓
**Polish & performance:**
- [ ] No layout shift (CLS issues)
- [ ] Smooth animations (60fps)
- [ ] Fast load times (< 3 seconds)
- [ ] No broken images/links
- [ ] Proper error handling (no blank pages)
- [ ] Mobile touch-friendly (not laggy)
- [ ] Proper cursor (pointer on buttons, not on text)

---

## 📱 Page-by-Page Audit

### 1. Login Page
```
URL: /login
Credentials: a@a.com / Aaaaaa
```

**Elements to Check:**
- [ ] Email input field
  - [ ] Clear label "Email"
  - [ ] Placeholder text
  - [ ] Proper height (44-48px)
  - [ ] Focus state (blue border or similar)
  - [ ] Hover state
  - [ ] Error state (if wrong email entered)

- [ ] Password input field
  - [ ] Clear label "Password"
  - [ ] Password bullets (not visible)
  - [ ] Show/hide password toggle
  - [ ] Proper styling consistency with email
  - [ ] Error state

- [ ] Remember me checkbox
  - [ ] Proper checkbox style
  - [ ] Label clickable
  - [ ] Proper spacing

- [ ] Forgot password link
  - [ ] Visible & clickable
  - [ ] Proper color (emerald or primary)
  - [ ] Hover underline

- [ ] Login button
  - [ ] Clear "Sign In" label
  - [ ] Full width or proper size
  - [ ] Emerald green color
  - [ ] Loading state while signing in
  - [ ] Hover effect

- [ ] Sign up link
  - [ ] "Don't have an account? Sign up"
  - [ ] Proper color & underline
  - [ ] Clickable & functional

- [ ] Overall layout
  - [ ] Centered form
  - [ ] Brand logo/name visible
  - [ ] Proper spacing (top margin)
  - [ ] Mobile responsive (full width input)
  - [ ] Good typography hierarchy

---

### 2. User Dashboard (Main Page)
```
URL: /dashboard
Expected: Main entry point after login
```

**Top Section:**
- [ ] Greeting: "Welcome back, [Name]!"
  - [ ] Proper sizing
  - [ ] Current date/time (if shown)
  - [ ] Personalization working

- [ ] Quick stats cards
  - [ ] Biomarkers tracked
  - [ ] Progress percentage
  - [ ] Last update date
  - [ ] Proper colors/sizing

**Dashboard Sections:**

**A. Health Status Card**
- [ ] Overall health score
  - [ ] Clear number (0-100 scale)
  - [ ] Visual indicator (gauge/progress bar)
  - [ ] Color coding (red < 50, yellow 50-70, green 70+)
  - [ ] Explanation text

- [ ] Key metrics display
  - [ ] Vitamin D: Level + Status
  - [ ] Iron: Level + Status
  - [ ] B12: Level + Status
  - [ ] Other tracked markers
  - [ ] Proper formatting (value + unit)

**B. Progress Card**
- [ ] Journey steps visualization
  - [ ] Step 1: Account created ✓
  - [ ] Step 2: Upload first lab
  - [ ] Step 3: Complete health profile
  - [ ] Step 4: Add symptoms/check-in
  - [ ] Step 5: Unlock protocol
  - [ ] Completed steps: checkmark icon
  - [ ] Pending steps: circle icon
  - [ ] Clear visual distinction

**C. Recent Uploads**
- [ ] Latest upload card
  - [ ] File name/date
  - [ ] Analysis method (NEW: showing "openai_pdf_text", etc.)
  - [ ] Biomarker count
  - [ ] "View Results" button
  - [ ] "Upload New" button (NEW: should be visible)

**D. Current Protocol/Assignments**
- [ ] Active protocol card
  - [ ] Protocol name
  - [ ] Start date
  - [ ] Completion percentage
  - [ ] Next scheduled check-in
  - [ ] Supplement recommendations (1-3 top items)
  - [ ] "View Full Protocol" button

- [ ] Today's assignments
  - [ ] Clear task format
  - [ ] Checkbox for completion
  - [ ] Due date/time
  - [ ] Priority indicator (if any)

**E. Achievements/Streak**
- [ ] Streak counter (if implemented)
  - [ ] Number display
  - [ ] Fire icon ✓
  - [ ] Proper spacing

- [ ] Achievement badges
  - [ ] Badge icons
  - [ ] Badge names
  - [ ] Hover tooltips (for locked badges)
  - [ ] Proper grid layout

**F. Health Tips**
- [ ] Personalized tips card
  - [ ] "Today's Health Tip" header
  - [ ] Clear tip text
  - [ ] Related to user's biomarkers
  - [ ] Proper typography

**Overall Dashboard Layout:**
- [ ] Responsive grid (1 col mobile, 2 col tablet, 3+ col desktop)
- [ ] Proper spacing between cards
- [ ] Smooth animations (fade in)
- [ ] Mobile: Full-width cards with padding
- [ ] Tablet/Desktop: 2-3 column grid
- [ ] Sidebar (navigation) visible on desktop
- [ ] Mobile menu accessible

---

### 3. Upload Page (NEWLY UPDATED)
```
URL: /upload
Feature: Universal file format support
```

**Upload Zone:**
- [ ] Title: "📄 Upload Lab Report"
  - [ ] Clear icon
  - [ ] Proper sizing

- [ ] Drag & drop zone
  - [ ] Border visible (rounded, dashed or solid)
  - [ ] Hover state (highlight, color change)
  - [ ] Drop state (visual feedback)
  - [ ] "Drag and drop your lab report here" text
  - [ ] "or click to browse" text

- [ ] File picker button
  - [ ] "Choose File" button
  - [ ] Proper styling (emerald, rounded)
  - [ ] Hover effect
  - [ ] Icon (folder or upload icon)

- [ ] File types hint
  - [ ] "PDF, image, or spreadsheet. Max 20MB."
  - [ ] Clear text
  - [ ] Visible but not overwhelming
  - [ ] ✓ NEW: Should show all supported formats

- [ ] Security message
  - [ ] "Secure direct PDF analysis for comprehensive biomarker review."
  - [ ] Proper styling (smaller, subtle)

**Validation (Test with different files):**
- [ ] ✓ PDF upload accepted
- [ ] ✓ PNG upload accepted (NEW)
- [ ] ✓ JPG upload accepted (NEW)
- [ ] ✓ XLSX upload accepted (NEW)
- [ ] ✓ CSV upload accepted (NEW)
- [ ] ✓ File > 20MB rejected (error message)
- [ ] ✓ Unsupported format rejected (error message)
- [ ] ✓ Empty file rejected

**After Selection:**
- [ ] File name displayed
- [ ] Loading spinner while uploading
- [ ] Progress bar (if available)
- [ ] "Cancel" button visible
- [ ] No interaction during upload

**After Upload Success:**
- [ ] Success message displayed
- [ ] "View Results" button visible
- [ ] "Upload Another" button visible
- [ ] Results automatically load

---

### 4. Results Page
```
URL: /results/:uploadId
```

**Header:**
- [ ] "Lab Results" title
- [ ] Upload date
- [ ] Analysis method (NEW: Should show "openai_pdf_text", "openai_vision", etc.)
- [ ] Back button
- [ ] Print/Export button (if available)

**Biomarkers List:**
- [ ] Table or card layout
- [ ] Columns: Biomarker Name | Value | Unit | Status
- [ ] Each biomarker:
  - [ ] Name (clickable for details)
  - [ ] Current value
  - [ ] Unit (ng/mL, mg/dL, etc.)
  - [ ] Status badge: OPTIMAL (green), BORDERLINE (yellow), DEFICIENT (orange), ELEVATED (red)
  - [ ] Reference range shown (if available)
  - [ ] Trend indicator (if historical data available)

**Sorting/Filtering:**
- [ ] Sort by name
- [ ] Sort by status
- [ ] Filter by status (only deficient, etc.)
- [ ] Search biomarker name

**Protocol Recommendations:**
- [ ] "Recommended Protocol" section
- [ ] List of supplements:
  - [ ] Supplement name
  - [ ] Dosage
  - [ ] Frequency (daily, 2x daily, etc.)
  - [ ] Duration (weeks)
  - [ ] Reason/rationale
  - [ ] Priority indicator (HIGH/MEDIUM/LOW)

- [ ] Lifestyle recommendations (if provided)
- [ ] Follow-up testing dates

**Visual Elements:**
- [ ] Color coding consistent with dashboard
- [ ] Icons for biomarker categories (vitamins, minerals, etc.)
- [ ] Proper spacing & typography
- [ ] Mobile: Stack cards vertically
- [ ] Desktop: Side-by-side layout

---

### 5. Progress Page
```
URL: /progress
```

**Dashboard Summary:**
- [ ] Overall completion percentage
  - [ ] Progress bar
  - [ ] Percentage text
  - [ ] Color coding

- [ ] Timeline/Journey
  - [ ] Visual steps completed
  - [ ] Current step highlighted
  - [ ] Dates for each step
  - [ ] Clear visual hierarchy

**Protocol Progress:**
- [ ] Current protocol card
  - [ ] Protocol name
  - [ ] Start date
  - [ ] End date / Duration
  - [ ] Completion %
  - [ ] Progress bar
  - [ ] Days remaining

**Weekly Check-ins:**
- [ ] List of completed check-ins
  - [ ] Date
  - [ ] Symptoms reported
  - [ ] Check-in status
  - [ ] "View Details" link

- [ ] Next check-in
  - [ ] Scheduled date/time
  - [ ] Countdown ("Due in 3 days")
  - [ ] "Start Check-in" button

**Metrics Over Time:**
- [ ] Graph/chart showing biomarker trends
  - [ ] X-axis: Dates
  - [ ] Y-axis: Values
  - [ ] Multiple lines for different markers
  - [ ] Legend
  - [ ] Hover tooltips
  - [ ] Clear labeling

**Assignments:**
- [ ] Completed assignments
- [ ] Pending assignments
- [ ] Overdue assignments (highlighted in red)
- [ ] Completion status

**Overall Layout:**
- [ ] Smooth scrolling
- [ ] Proper spacing
- [ ] Mobile responsive
- [ ] No overlapping text/charts

---

### 6. Onboarding Page
```
URL: /onboarding
```

**Multi-step form:**
- [ ] Step indicator (1/3, 2/3, 3/3)
  - [ ] Completed steps highlighted
  - [ ] Current step emphasized
  - [ ] Next steps grayed out

**Step 1: Health Profile**
- [ ] Age input (number)
- [ ] Gender select (dropdown or radio)
- [ ] Health conditions checkboxes
- [ ] Current medications text area
- [ ] Allergies text area
- [ ] Proper labels & validation

**Step 2: Lifestyle**
- [ ] Exercise frequency
- [ ] Sleep hours
- [ ] Stress level
- [ ] Diet type
- [ ] Supplementation history
- [ ] Clear radio/checkbox options

**Step 3: Goals**
- [ ] Health goals checkboxes (energy, sleep, immunity, etc.)
- [ ] Priority ranking (if applicable)
- [ ] Additional notes textarea
- [ ] Clear, actionable goals

**Navigation:**
- [ ] Previous button (disabled on step 1)
- [ ] Next/Continue button
- [ ] Skip button (if applicable)
- [ ] Submit/Complete button on last step
- [ ] Clear labels

**Validation:**
- [ ] Required fields marked with *
- [ ] Error messages appear on invalid input
- [ ] Can't proceed to next step with errors
- [ ] Clear success after completion

---

### 7. Health Profile Page
```
URL: /profile or /health-profile
```

**Profile Information:**
- [ ] Profile picture (with upload option)
  - [ ] Circular or rounded image
  - [ ] Proper aspect ratio
  - [ ] "Change Photo" button on hover
  - [ ] Default avatar if no photo

- [ ] Name display
  - [ ] First & last name editable
  - [ ] Save button after edit
  - [ ] Cancel button

- [ ] Email display (usually not editable)

**Health Information:**
- [ ] Age (editable)
- [ ] Gender
- [ ] Health conditions (list or tags)
- [ ] Current medications (list)
- [ ] Allergies (list with clear warnings)
- [ ] Blood type (if relevant)
- [ ] Edit buttons for each section

**Goals & Preferences:**
- [ ] Selected health goals (tags or list)
- [ ] Fitness level
- [ ] Diet preferences
- [ ] Sleep goal (hours per night)

**Buttons:**
- [ ] Save Changes button (only if changes made)
- [ ] Edit button (on each section)
- [ ] Delete Account button (in danger zone, red)
- [ ] Change Password button (if applicable)

---

### 8. Subscription/Billing Page
```
URL: /subscription or /billing
```

**Current Plan:**
- [ ] Plan name (Free, Premium, etc.)
- [ ] Price displayed
- [ ] Billing cycle (monthly, annual)
- [ ] Next billing date
- [ ] Status (Active, Cancelled, etc.)

**Features Included:**
- [ ] Feature list for current plan
  - [ ] ✓ for included features
  - [ ] ✗ for excluded features
  - [ ] Clear visual distinction

**Upgrade Options:**
- [ ] Plan comparison table
  - [ ] Plan names
  - [ ] Prices
  - [ ] Features per plan
  - [ ] Upgrade button for each plan
  - [ ] Current plan highlighted

**Payment Methods:**
- [ ] Saved credit cards
  - [ ] Card type (Visa, Mastercard, etc.)
  - [ ] Last 4 digits
  - [ ] Expiration date
  - [ ] Edit/Delete buttons
  - [ ] Set as default

**Billing History:**
- [ ] Table of past invoices
  - [ ] Date
  - [ ] Amount
  - [ ] Status (Paid, Pending, etc.)
  - [ ] Download receipt button
  - [ ] Sortable by date

**Buttons:**
- [ ] "Upgrade" button (clear CTA)
- [ ] "Manage Payment Methods"
- [ ] "Downgrade" button (if applicable)
- [ ] "Cancel Subscription" (in danger zone, red)

---

### 9. Help/FAQ Page
```
URL: /help or /faq
```

**Search:**
- [ ] Search input field
- [ ] Real-time results filtering
- [ ] Clear placeholder text

**FAQ Categories:**
- [ ] Tab or accordion interface
- [ ] Clear category names
- [ ] Question text visible
- [ ] Answer expandable/collapsible

**Each Q&A:**
- [ ] Question in bold or larger text
- [ ] Clear, helpful answer
- [ ] Images/screenshots (if needed)
- [ ] Links to related articles
- [ ] "Was this helpful?" buttons (Yes/No)

**Contact Support:**
- [ ] Clear section at bottom
- [ ] Email address or contact form
- [ ] Support hours (if applicable)
- [ ] Chat button (if available)
- [ ] Button to submit ticket

**Overall:**
- [ ] Mobile accordion layout
- [ ] Desktop: Sidebar with categories
- [ ] Smooth expand/collapse animations
- [ ] Good use of whitespace

---

### 10. Navigation & Header

**Top Navigation (All Pages):**
- [ ] Logo/brand name (clickable to home)
- [ ] Main navigation items
- [ ] User menu (avatar dropdown)
  - [ ] Profile link
  - [ ] Settings link
  - [ ] Sign Out link
  - [ ] Clear divider before Sign Out

- [ ] Mobile hamburger menu
  - [ ] Visible on screens < 768px
  - [ ] Animated hamburger icon
  - [ ] Full-screen or slide-in menu
  - [ ] Close button visible

**Sidebar Navigation (Desktop Dashboard):**
- [ ] Dashboard
- [ ] Upload
- [ ] Results
- [ ] Progress
- [ ] Protocols
- [ ] Profile
- [ ] Subscription
- [ ] Help
- [ ] Settings (if applicable)

- [ ] Active page highlighted
- [ ] Hover effects on navigation items
- [ ] Icons with labels
- [ ] Collapsible on smaller screens

**Footer (Public Pages):**
- [ ] Links organized by category
- [ ] Contact information
- [ ] Social media links (if applicable)
- [ ] Copyright information
- [ ] Privacy & Terms links

---

## 🎨 Design System Consistency Check

**Color Consistency:**
- [ ] Primary green (#10b981) used for:
  - [ ] Buttons
  - [ ] Links
  - [ ] Active states
  - [ ] Success messages
  - [ ] Positive indicators

- [ ] Status colors:
  - [ ] Green (#10b981): OPTIMAL, Success, Active
  - [ ] Yellow (#F59E0B): BORDERLINE, Warning, Pending
  - [ ] Orange (#FF6B35): DEFICIENT, Alert, Important
  - [ ] Red (#EF4444): ELEVATED, Error, Danger
  - [ ] Gray (#9CA3AF): Inactive, Disabled, Neutral

**Typography Consistency:**
- [ ] Heading 1: 28-32px, 600-700 weight
- [ ] Heading 2: 20-24px, 600 weight
- [ ] Heading 3: 16-18px, 600 weight
- [ ] Body text: 14-16px, 400 weight
- [ ] Small text: 12-13px, 400 weight
- [ ] Consistent throughout all pages

**Spacing Consistency:**
- [ ] Cards: 20-24px padding
- [ ] Sections: 24-32px gap
- [ ] Rows: 8-16px gap
- [ ] Mobile padding: 12-16px
- [ ] Desktop padding: 24-32px

**Border Radius Consistency:**
- [ ] Large cards: 24px
- [ ] Buttons: 8-12px
- [ ] Input fields: 8-12px
- [ ] Small badges: 4-8px
- [ ] Images: 8-16px

---

## ✅ Interactive Elements Checklist

**All Interactive Elements Should Have:**

```
BUTTONS:
- [ ] Visual state: Default
- [ ] Visual state: Hover (darker, shadow, or background)
- [ ] Visual state: Active (pressed effect)
- [ ] Visual state: Disabled (grayed out)
- [ ] Visual state: Loading (spinner or animation)
- [ ] Keyboard focus visible (outline or border)
- [ ] Touch target: Min 44x44px

LINKS:
- [ ] Color: Primary green or underline
- [ ] Hover: Underline or darker color
- [ ] Visited: Different color (if distinguishable)
- [ ] Focus: Visible outline
- [ ] Active: Emphasize current page

INPUTS:
- [ ] Label visible (above or floating)
- [ ] Placeholder text clear
- [ ] Focus state: Border color change
- [ ] Hover state: Subtle background
- [ ] Disabled state: Grayed out
- [ ] Error state: Red border + message
- [ ] Character count (if applicable)
- [ ] Helper text visible

MODALS/OVERLAYS:
- [ ] Semi-transparent backdrop
- [ ] Modal centered on screen
- [ ] Close button visible (X or Cancel)
- [ ] Scrollable if content > viewport
- [ ] Keyboard escape to close
- [ ] Focus trapped inside modal

DROPDOWNS:
- [ ] Current selection visible
- [ ] Options list proper width
- [ ] Hover state on options
- [ ] Keyboard arrow navigation
- [ ] Search/filter (if many options)
- [ ] Clear button (if applicable)

CHECKBOXES/RADIO:
- [ ] Proper sizing (44x44px or larger)
- [ ] Label clickable (increases touch target)
- [ ] Checked state: Clear visual change
- [ ] Focus state: Visible outline
- [ ] Disabled state: Grayed out
```

---

## 🔍 Manual Testing Instructions

### 1. Test Login Flow
```
1. Navigate to vitaloop.today
2. Click "Sign In" or go to /login
3. Enter email: a@a.com
4. Enter password: Aaaaaa
5. Click "Sign In" button
6. Observe: Loading state, redirect to dashboard
```

### 2. Test Dashboard
```
1. After login, you should be on /dashboard
2. Check all sections visible:
   - Greeting with user name
   - Health stats cards
   - Progress steps
   - Recent uploads
   - Current protocol
   - Achievements/streak
3. Test responsive (resize window to mobile)
```

### 3. Test Upload (NEW FEATURE)
```
1. Navigate to /upload
2. Verify UI shows "Upload Lab Report" label
3. Test with different file types:
   - Try PDF file → should work ✓
   - Try PNG file → should work ✓ (NEW)
   - Try JPG file → should work ✓ (NEW)
   - Try XLSX file → should work ✓ (NEW)
   - Try CSV file → should work ✓ (NEW)
   - Try unsupported file (.docx) → should error
   - Try file > 20MB → should error
4. Verify response shows analysis_method field
```

### 4. Test Results
```
1. After upload, navigate to /results
2. Check all biomarkers displayed with:
   - Name
   - Value
   - Unit
   - Status badge (color coded)
3. Check protocol recommendations visible
4. Test sorting/filtering (if available)
```

### 5. Test Progress Page
```
1. Navigate to /progress
2. Check journey steps visualization
3. Verify progress percentage displayed
4. Check metrics chart (if applicable)
5. Test responsive layout on mobile
```

### 6. Test Profile/Settings
```
1. Navigate to profile or settings
2. Check profile information displayed
3. Test editing health information
4. Verify save/cancel buttons work
5. Check password change (if applicable)
```

### 7. Test Subscription Page
```
1. Navigate to /subscription
2. Check current plan displayed
3. Verify features list accurate
4. Check billing history table
5. Test plan comparison (if upgrading)
```

### 8. Test Navigation
```
1. Click all navigation items
2. Verify no broken links
3. Check mobile menu opens/closes
4. Test breadcrumb navigation (if present)
5. Verify back buttons work
```

---

## 📝 Issues to Document

### For Each Issue, Note:
```
Issue #[X]: [Title]
Severity: Critical / High / Medium / Low
Location: [Page/Component]
Expected: [What should happen]
Actual: [What happens instead]
Browser: [Chrome/Firefox/Safari/Mobile]
Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]
Screenshot: [If applicable]
```

---

## 🎯 Audit Sign-Off

**Auditor:** _________________  
**Date:** May 27, 2026  
**Pages Checked:** ___/30  
**Issues Found:** ___  
**Critical Issues:** ___  
**High Priority:** ___  
**Medium Priority:** ___  
**Low Priority:** ___  

**Overall Assessment:**
- [ ] ✅ Professional grade (all standards met)
- [ ] ⚠️ Good (minor issues only)
- [ ] ❌ Needs improvements (moderate issues)
- [ ] 🔴 Major issues (requires fixes)

**Recommendations:**
1. ...
2. ...
3. ...

**Sign-Off Status:**
- [ ] Ready for production
- [ ] Ready with minor fixes
- [ ] Requires significant updates

---

**Document Generated:** May 27, 2026  
**Audit Tool:** Complete UI/UX Checklist  
**Version:** 1.0
