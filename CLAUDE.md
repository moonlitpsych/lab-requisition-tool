# MOONLIT Lab Portal Automation - Claude Code Instructions

## Project Overview
MOONLIT is a psychiatry practice in Salt Lake City that needs to automate lab ordering through Labcorp Link and Quest Quanum portals. They currently have a working PDF requisition generator but want to eliminate manual fax/portal entry. This project builds intelligent automation agents that act like humans using these portals.

**Current Situation:**
- Manual PDF generation works but requires faxing
- Have Labcorp Link and Quest Quanum access (free portals)
- Need $400/month volume for Labcorp PWS API access
- Small practice, seeing ~20-30 patients requiring labs monthly
- Already have React frontend + Node.js/Express backend + Supabase database

## Project Goals
1. Build portal automation that submits orders directly to Labcorp/Quest websites
2. Create unified dashboard showing orders/results from both labs
3. Implement results scraping to pull data back into our system
4. Use LLM agents to handle UI changes and form variations
5. Keep costs under $35/month

---

## ✅ COMPLETED: Smart Lab Order Interface (October 2024)

### What's Working
The Smart Lab Order interface is now fully functional with the following features:

#### 1. **Patient Search with Fuzzy Matching** ✅
- Single "Patient Name" input field
- Searches BOTH first AND last names simultaneously (OR logic)
- Fuzzy matching handles misspellings (up to 2 character Levenshtein distance)
- Examples:
  - Search "Austin" → finds Austin Schneider (first name match)
  - Search "Schneider" → finds Austin Schneider (last name match)
  - Search "Shnider" → finds Austin Schneider (fuzzy match on last name)
  - Search "Montoya" → finds Jeremy Montoya (last name match)
- Auto-selects patient if only 1 result found
- Radio button selection for multiple results
- "Select Patient & Continue" button grayed out until selection made

#### 2. **Medicaid Eligibility Integration** ✅
- Real-time X12 270/271 eligibility verification via Office Ally
- 30-second timeout with proper error handling
- Correctly parses Utah Medicaid responses
- Extracts patient demographics:
  - Name, DOB, Medicaid ID
  - Address (correctly ignores LS*2120 loop addresses like Atlanta MODIVCARE)
  - Phone number with fallback logic:
    1. Primary: Medicaid (from PER segment)
    2. Fallback: IntakeQ patient record
    3. Final: null
- Automatic eligibility check when patient selected

#### 3. **Combined Test & Diagnosis Selection** ✅
- Single page for selecting both tests and diagnoses
- Lab tests grouped by category (Hematology, Endocrine, etc.)
- 25 psychiatry-relevant tests with 6-digit Labcorp codes
- ICD-10 diagnosis codes for common psychiatry conditions
- Real-time counter showing selections
- Patient info banner at top with "Change Patient" option

#### 4. **Review & Confirmation Page** ✅
- Dedicated confirmation step before submission
- Three sections:
  - Patient Information (with Medicaid data if available)
  - Selected Tests (numbered list with codes)
  - Selected Diagnoses (numbered list with descriptions)
- "Edit Tests & Diagnoses" button to go back
- Large green "Confirm & Submit Order" button

#### 5. **Order Submission & Status** ✅
- Submits to `/api/lab-orders/submit` endpoint
- Socket.io integration for real-time status updates
- Status page shows order ID and current state
- "Submit Another Order" button to restart flow

### Technical Details

#### Key Files
- **Frontend**: `/frontend/src/pages/SmartLabOrder.tsx` (720 lines)
- **Backend Routes**: `/backend/src/routes/labOrders.js`
- **IntakeQ Service**: `/backend/src/services/intakeqService.js`
- **Medicaid Service**: `/backend/src/services/medicaidEligibilityService.js`
- **Lab Codes Config**: `/backend/config/labTestCodes.json`

#### API Endpoints Working
- `GET /api/lab-orders/search-patients?name={name}` - Patient search (OR logic)
- `POST /api/lab-orders/check-eligibility` - Medicaid eligibility with phone fallback
- `GET /api/lab-orders/available-tests` - Lab test catalog
- `GET /api/lab-orders/available-diagnoses` - ICD-10 diagnosis codes
- `POST /api/lab-orders/submit` - Submit order for automation

#### Data Flow
1. User searches by single name (first OR last)
2. IntakeQ API returns matching patients with fuzzy search
3. User selects patient via radio button
4. System checks Medicaid eligibility (X12 271)
5. User selects tests and diagnoses on one page
6. User reviews all data on confirmation page
7. User confirms and order is submitted
8. Labcorp automation processes order in background

### Progress Steps (4-step flow)
1. **Select Patient** - Search, select, auto-check eligibility
2. **Tests & Diagnoses** - Combined selection page
3. **Review & Confirm** - Final verification before submission
4. **Status** - Order tracking and completion

## Technical Architecture

### Stack
- **Frontend**: React (existing) - Add UnifiedLabDashboard component
- **Backend**: Node.js/Express (existing) - Add automation services
- **Database**: Supabase (existing) - Add tables for tracking
- **Automation**: Playwright for browser automation
- **Intelligence**: OpenAI GPT-4 for adaptive form filling
- **File Structure**:
```
backend/
  src/
    services/
      labPortalAutomation.js    # Main automation class
      portalAgents/
        labcorpAgent.js         # Labcorp-specific logic
        questAgent.js           # Quest-specific logic
        llmHelper.js            # LLM integration for adaptability
    routes/
      portalAutomation.js       # API endpoints
    utils/
      screenshotManager.js      # Compliance/debugging
frontend/
  src/
    components/
      UnifiedLabDashboard.js    # New dashboard
      PortalStatus.js           # Real-time automation status
```

## Implementation Instructions

### Phase 1: Environment Setup

1. **Install Dependencies**
```bash
cd backend
npm install playwright @playwright/test openai dotenv node-cron
npx playwright install chromium  # Download browser
```

2. **Environment Variables** (Add to backend/.env)
```env
# Portal Credentials
LABCORP_USERNAME=
LABCORP_PASSWORD=
QUEST_USERNAME=
QUEST_PASSWORD=

# AI Integration
OPENAI_API_KEY=

# Automation Settings
HEADLESS_MODE=false  # Set true in production
SCREENSHOT_PATH=./automation-logs
MAX_RETRY_ATTEMPTS=3
```

3. **Database Schema** (Add to Supabase)
```sql
-- Portal automation tracking
CREATE TABLE portal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID REFERENCES lab_requisitions(id),
  portal VARCHAR(20) NOT NULL, -- 'labcorp' or 'quest'
  status VARCHAR(50) NOT NULL, -- 'pending', 'submitted', 'confirmed', 'failed'
  confirmation_number VARCHAR(100),
  screenshot_path TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Results tracking
CREATE TABLE portal_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(20) NOT NULL,
  patient_name VARCHAR(255),
  test_name VARCHAR(255),
  result_value TEXT,
  result_date DATE,
  status VARCHAR(50),
  raw_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- Portal session management
CREATE TABLE portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal VARCHAR(20) NOT NULL,
  session_data TEXT, -- Encrypted cookies/state
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 2: Core Automation Service

**File: backend/src/services/portalAgents/labcorpAgent.js**

Key implementation points:
1. Use Playwright in non-headless mode initially for debugging
2. Implement screenshot capture at every major step
3. Add comprehensive error handling with LLM diagnosis
4. Store session cookies to avoid frequent re-login
5. Implement retry logic with exponential backoff

**Critical Labcorp Link Elements** (as of Oct 2024):
- Login URL: https://link.labcorp.com
- Username field: `#username`
- Password field: `#password`
- Submit button: `button[type="submit"]`
- New Order button: Contains text "New Order" or "Create Order"
- Patient search: Usually `input[placeholder*="patient"]`
- Test search: Autocomplete field with `aria-label*="test"`

**File: backend/src/services/portalAgents/llmHelper.js**

This service should:
1. Analyze HTML to find form fields when selectors fail
2. Generate descriptions of screenshots for debugging
3. Map our data format to whatever the portal expects
4. Handle date format conversions (MM/DD/YYYY vs YYYY-MM-DD)
5. Identify error messages and suggest fixes

### Phase 3: API Endpoints

**File: backend/src/routes/portalAutomation.js**

Required endpoints:
```javascript
POST /api/portal-automation/order
  Body: { portal, patient, tests, diagnosis, provider }
  Returns: { success, confirmationNumber, screenshotUrl }

GET /api/portal-automation/results/:portal
  Returns: Array of new results since last fetch

POST /api/portal-automation/retry/:orderId
  Retries a failed order

GET /api/portal-automation/status/:orderId
  Returns current status of automation attempt

POST /api/portal-automation/test-connection/:portal
  Tests login credentials without placing order
```

### Phase 4: Frontend Dashboard

**File: frontend/src/components/UnifiedLabDashboard.js**

Features to implement:
1. Single form that routes to appropriate lab
2. Real-time status updates (use WebSocket or polling)
3. Results viewer combining both labs
4. Failure notifications with PDF fallback button
5. Order history with status indicators
6. Visual indicator showing which portal is being automated

### Phase 5: Results Scraping

Implement scheduled job (use node-cron) that:
1. Runs every 2 hours during business hours
2. Logs into each portal
3. Checks for new results
4. Downloads PDFs if available
5. Parses result values
6. Stores in database
7. Marks patient records for provider review

### Phase 6: Intelligence Layer

**LLM Prompt Templates:**

1. **Form Field Mapping**
```javascript
const FIELD_MAPPING_PROMPT = `
You are analyzing an HTML form for lab test ordering.

Patient Data:
${JSON.stringify(patientData)}

HTML Form (first 5000 chars):
${htmlContent}

Task: Return a JSON array mapping our data to the form's input selectors.
Focus on: patient name, DOB, insurance ID, phone, diagnosis code.

Return format:
{
  "fields": [
    {"selector": "CSS selector", "value": "value to enter", "type": "text|date|select"}
  ]
}
`;
```

2. **Error Diagnosis**
```javascript
const ERROR_DIAGNOSIS_PROMPT = `
Automation failed while trying to submit a lab order.

Error: ${error.message}
Page URL: ${currentUrl}
Screenshot: [base64 image attached]

Diagnose the issue and suggest:
1. What went wrong
2. Alternative selectors to try
3. Whether to retry or fallback to PDF
`;
```

### Phase 7: Testing Strategy

1. **Test Mode**: Add flag to submit to portal's test environment if available
2. **Dry Run**: Fill forms but don't submit, take screenshot for review
3. **Sandbox Patient**: Use test patient "Test, Patient" with DOB 01/01/2000
4. **Screenshot Archive**: Keep 30 days of screenshots for compliance

### Security Considerations

1. **Never log passwords** - Use `[REDACTED]` in logs
2. **Encrypt stored sessions** in portal_sessions table
3. **Rate limiting**: Max 1 order per 5 seconds to avoid detection
4. **User agent rotation**: Vary browser fingerprint
5. **IP considerations**: Run from consistent IP (your server)

### Fallback Strategy

When automation fails:
1. First retry: Use LLM to find alternative selectors
2. Second retry: Switch to visual recognition mode
3. Final fallback: Generate PDF and notify user to fax

### Success Metrics

Track and display on dashboard:
- Automation success rate (target: >90%)
- Average time per order (target: <30 seconds)
- Results retrieval latency (target: <4 hours)
- Cost per order (target: <$0.10 in API costs)

### Common Pitfalls to Avoid

1. **Don't parallelize** - Labs may flag concurrent sessions
2. **Don't skip waits** - Add realistic delays between actions
3. **Don't ignore popups** - Handle cookie banners, announcements
4. **Don't trust selectors** - They change; use multiple strategies
5. **Don't store PHI in logs** - Screenshots only, no console.logs with data

### Specific Quest Quanum Considerations

- URL: https://questdiagnostics.com/health-care-professionals/quanum
- May redirect through multiple domains
- Uses more JavaScript-heavy forms
- Often requires selecting from dropdown vs typing
- Date picker widget instead of text input

### Specific Labcorp Link Considerations

- More stable HTML structure
- Better for automation
- Has session timeout of 15 minutes
- Shows confirmation number immediately
- Can download requisition PDF after submission

### Testing Checklist

- [ ] Can log into both portals
- [ ] Can navigate to order form
- [ ] Can fill patient information
- [ ] Can search and select tests
- [ ] Can add diagnosis codes
- [ ] Can submit order
- [ ] Captures confirmation number
- [ ] Handles errors gracefully
- [ ] Falls back to PDF when needed
- [ ] Scrapes results successfully
- [ ] Stores everything in database
- [ ] Updates frontend in real-time

### MVP Definition

For the first version, focus on:
1. Labcorp automation only (it's more stable)
2. Submit orders (skip results initially)
3. Basic error handling (no LLM yet)
4. Simple status updates (no WebSocket)

This gets you 80% of value with 20% of complexity.

### Estimated Timeline

- Day 1-2: Environment setup, basic Playwright automation
- Day 3-4: Labcorp order submission working
- Day 5-6: Add Quest automation
- Day 7-8: Implement LLM adaptability
- Day 9-10: Results scraping
- Day 11-12: Frontend dashboard
- Day 13-14: Testing and refinement

### Cost Breakdown

Monthly costs at 30 orders/month:
- OpenAI API: ~$5 (300 API calls at $0.015 each)
- Server (if needed): $5 (DigitalOcean droplet)
- Screenshot storage: $1 (Supabase)
- Total: ~$11/month

### Support Resources

1. Playwright docs: https://playwright.dev/docs/intro
2. OpenAI API: https://platform.openai.com/docs
3. Supabase JS Client: https://supabase.com/docs/reference/javascript

### Questions to Ask User Before Starting

1. Do you want to start with Labcorp only or both labs?
2. Should we implement results scraping in MVP or just orders?
3. Do you want manual review before submission initially?
4. What's your preferred notification method for failures?
5. Should we archive screenshots for compliance? For how long?

### Final Notes

- Start simple, iterate based on what breaks
- The portals WILL change - that's why we use LLM
- Keep PDF fallback always available
- Document every portal quirk you discover
- Success is measured by time saved, not perfection

## Ready to Start

Claude Code, please begin by:
1. Setting up the environment and dependencies
2. Creating a simple Playwright script that logs into Labcorp Link
3. Taking a screenshot after successful login
4. Building from there based on what you observe

Remember: The goal is to eliminate manual data entry while maintaining reliability. Portal automation is brittle by nature, but LLM-assisted adaptation makes it resilient.

---

## CURRENT STATUS & NEXT STEPS (Updated: Oct 2024)

### What's Been Completed ✅

1. **Labcorp Link Automation Foundation**
   - ✅ OAuth login flow working perfectly (username → Next → password → Submit)
   - ✅ Dashboard navigation successful
   - ✅ Lab Orders tile click working
   - ✅ Patient search page reached
   - ✅ **CRITICAL DISCOVERY**: "Create New Patient" button is disabled until a search is performed
   - ✅ Implemented dummy patient search to enable the button
   - ✅ Successfully navigating to Patient Information form
   - ✅ Created `labTestCodes.json` with psychiatry-specific lab codes and ICD-10 diagnoses
   - ✅ Built `insuranceHelper.js` for intelligent Medicaid/Medicare/Commercial billing decisions

2. **Infrastructure**
   - ✅ Playwright browser automation setup
   - ✅ Google Gemini LLM integration for adaptive form filling
   - ✅ Screenshot capture at every step
   - ✅ Comprehensive logging system
   - ✅ Test script: `backend/src/scripts/testLabcorpOrderFlow.js`

3. **Key Files Created**
   - `/backend/src/services/portalAgents/labcorpAgent.js` - Main automation agent (~80% complete)
   - `/backend/src/services/portalAgents/llmHelper.js` - LLM integration for adaptive filling
   - `/backend/src/services/portalAgents/insuranceHelper.js` - Insurance billing logic
   - `/backend/config/labTestCodes.json` - Lab test codes and ICD-10 diagnoses
   - `/backend/src/scripts/testLabcorpOrderFlow.js` - Test runner

### Current Challenge 🎯

The automation is now on the **Patient Information form** with many fields including:
- Bill Method dropdown (Client, Medicare, Medicaid, Commercial)
- Patient demographics (name, DOB, address, phone, etc.)
- Insurance information
- Address verification/correction handling

### THE BIG VISION: Smart Interface + Auto-Population System

#### Phase 1: Build Simplified Provider Interface

**UI/UX Requirements:**

1. **Patient Search & Selection**
   - Use **IntakeQ Client API** (https://support.intakeq.com/article/251-intakeq-client-api)
   - Fuzzy search by first/last name (forgiving of minor misspellings)
   - Returns all patients matching search criteria
   - Only established patients (all have IntakeQ entries) can receive lab orders
   - Pull rich patient data from IntakeQ for downstream use

2. **Diagnosis Selection**
   - Option A: Provider selects from common psychiatry diagnoses list
   - Option B: Pull patient's existing diagnoses from IntakeQ API automatically
   - Provider links specific diagnosis to lab order

3. **Lab Test Selection Menu**
   - Simple checkbox/multi-select interface
   - Updated common tests list:
     - Comprehensive Metabolic Panel (CMP)
     - Complete Blood Count with Differential
     - **Thyroid Cascade Panel** (TSH w/ Reflex to T3/T4) ← Changed from standalone TSH
     - Lipid Panel
     - Hemoglobin A1c
     - Lithium Level
     - Valproic Acid Level
     - **Clozapine and Metabolites** ← New
     - Prolactin
     - Vitamin D, 25-Hydroxy
     - **Vitamin B12 + Folate** ← Combined test
     - **Thiamine** ← New
   - Reference: `/backend/config/labTestCodes.json`

4. **Submit & Trigger Automation**
   - One-click submission triggers the Labcorp automation
   - Real-time status updates during automation
   - Success/failure notifications

#### Phase 2: Auto-Population Backend Logic

**Patient Demographics from Medicaid Utah (Primary Source)**

Why Medicaid as primary source:
- Labcorp's "suggested address corrections" come directly from Medicaid's X12 271 response
- You already have Office Ally API integration in `medicaid-eligibility-checker` project
- Using Medicaid data pre-populates the form with the EXACT data Labcorp expects
- Eliminates address correction prompts entirely

**Integration Points:**

1. **Medicaid Eligibility Check (X12 270/271)**
   - Reuse existing `medicaid-eligibility-checker` infrastructure
   - Office Ally credentials already available
   - X12 270 request → X12 271 response contains:
     - Patient name (exactly as Medicaid has it)
     - Date of birth
     - **Address** (the same address Labcorp will suggest - use this!)
     - Medicaid ID
     - Coverage status
   - Parse 271 response and extract all demographic fields

2. **IntakeQ Client API Integration**
   - Use for initial patient search/selection
   - Backup data source if Medicaid unavailable
   - Provider preferences and clinical context
   - Diagnosis history

3. **Lab Test Code Mapping**
   - Provider selects "Thyroid Cascade Panel" in UI
   - Backend looks up Labcorp code in `labTestCodes.json`
   - Finds code `330015`
   - Automation searches for and selects this test in Labcorp Link

4. **ICD-10 Diagnosis Mapping**
   - Provider links diagnosis "Bipolar disorder, depressed" to lab order
   - Backend looks up ICD-10 code in `labTestCodes.json`
   - Finds `F31.30`
   - Automation enters this code in Labcorp Link diagnosis field

**Data Flow:**
```
Provider UI → Patient Search (IntakeQ) → Select Patient → Medicaid Eligibility Check (X12 271)
           ↓
Extract: Name, DOB, Address, Medicaid ID from 271 response
           ↓
Provider selects: Tests + Linked Diagnoses
           ↓
Backend maps: Test names → Labcorp codes, Diagnosis names → ICD-10 codes
           ↓
Automation fills Labcorp form with exact Medicaid data (no corrections needed!)
           ↓
Submit order → Confirmation number → Notify provider
```

#### Phase 3: Address Verification Intelligence

**The Discovery:**
Labcorp's "suggested address" = Data from Medicaid's X12 271 response

**The Solution:**
1. Always use Medicaid 271 address data to populate Labcorp form
2. This pre-empts any "address correction" prompts
3. Labcorp will see the address matches their Medicaid data exactly
4. No manual intervention needed

**Fallback:**
If address correction prompt still appears:
- Log the discrepancy for review
- Accept Labcorp's suggestion (it's from Medicaid anyway)
- Update local database with corrected address

#### Phase 4: Failure Handling & Notifications

**When Automation Fails:**

1. **Email Notification to CMO**
   - Send to: `hello@trymoonlit.com`
   - Subject: `"Lab Automation Failed - [Provider Name]"`
   - Body includes:
     - Patient name
     - Date of birth
     - Tests ordered
     - Linked diagnoses (ICD-10 codes)
     - Full address
     - Insurance information
     - Error message/screenshot
   - All information needed for manual Labcorp Link entry

2. **Retry Logic**
   - Attempt 1: Standard automation
   - Attempt 2: LLM-assisted selector finding
   - Attempt 3: Email CMO for manual intervention

3. **Fallback UI**
   - Provider sees "Automation pending..."
   - If failure: "Automation failed - CMO notified for manual submission"
   - Provider can continue working, not blocked

### Technical Implementation Notes

**Office Ally X12 Integration (Medicaid Eligibility)**

Located in existing project: `medicaid-eligibility-checker`

Key configuration:
```javascript
const OFFICE_ALLY_CONFIG = {
    endpoint: 'https://wsd.officeally.com/TransactionService/rtx.svc',
    receiverID: 'OFFALLY',
    senderID: '1161680',
    username: 'moonlit',
    password: 'h@i9hiS4}92PEwd5',
    providerNPI: '1275348807',
    providerName: 'MOONLIT_PLLC',
    payerID: 'SKUT0'  // Utah Medicaid
};
```

X12 271 Response parsing example (from `medicaid-eligibility-checker` project):
```javascript
// Sample 271 response showing patient data:
// NM1*IL*1*MONTOYA*JEREMY****MI*UT123456789
// N3*123 MAIN ST*APT 4
// N4*SALT LAKE CITY*UT*84101
// DMG*D8*19840717~
// EB*1*IND*30^1^45*MC*TARGETED ADULT MEDICAID
```

Extract:
- Name: MONTOYA, JEREMY
- Address: 123 MAIN ST APT 4, SALT LAKE CITY, UT 84101
- DOB: 07/17/1984
- Medicaid ID: UT123456789
- Plan: Targeted Adult Medicaid (Traditional FFS)

**IntakeQ Client API**

Endpoint: `https://intakeq.com/api/v1/clients/search`

Example request:
```javascript
fetch('https://intakeq.com/api/v1/clients/search?firstName=Emily', {
  headers: {
    'X-Auth-Key': process.env.INTAKEQ_API_KEY
  }
})
```

Returns: Array of matching clients with full demographic data

### Recommended Next Session Plan

**Session Goal:** Build the smart provider interface + backend auto-population system

**Step-by-Step:**

1. **Create Provider UI (2-3 hours)**
   - Patient search component using IntakeQ API
   - Diagnosis selection dropdown (with IntakeQ integration option)
   - Lab test multi-select menu (updated list)
   - Submit button with status indicator

2. **Build Backend Integration Layer (2-3 hours)**
   - IntakeQ API client
   - Medicaid eligibility checker integration (copy from `medicaid-eligibility-checker`)
   - X12 271 response parser
   - Data mapping service (test names → codes, diagnoses → ICD-10)

3. **Update Labcorp Agent (2-3 hours)**
   - Modify `fillPatientInfo()` to accept Medicaid 271 data
   - Implement intelligent field mapping
   - Handle Bill Method dropdown (Medicaid vs other)
   - Address pre-population with Medicaid data

4. **Implement Failure Notifications (1 hour)**
   - Email service integration
   - Error message templating
   - Screenshot attachment

5. **Testing & Refinement (2 hours)**
   - End-to-end test with real patient data
   - Verify Medicaid address prevents correction prompts
   - Test failure email notifications
   - Validate all lab codes map correctly

**Success Criteria:**
- Provider can search patient → select tests → submit → automation completes
- No address correction prompts (Medicaid data used)
- Failed orders send detailed email to CMO
- <2 minutes from provider submission to Labcorp confirmation

### Files to Reference

- `/backend/src/services/portalAgents/labcorpAgent.js` - Extend this
- `/backend/config/labTestCodes.json` - Lab codes reference
- `medicaid-eligibility-checker/` project - Copy X12 integration
- IntakeQ API docs - https://support.intakeq.com/article/251-intakeq-client-api

### Critical Reminders

1. **Medicaid address data = Labcorp's expected address** - use it!
2. **Only established patients** - all have IntakeQ entries
3. **Failure = email CMO** - never block provider workflow
4. **Keep PDF fallback** - always available as last resort
5. **Test with real data** - Medicaid eligibility checks must work in production

---

## 🎉 LABCORP AUTOMATION PROGRESS (Updated: October 24, 2025)

### ✅ AUTOMATION STATUS: 95% COMPLETE - MAJOR MILESTONE!

The Labcorp Link browser automation is **NEARLY COMPLETE** and successfully automates the entire order workflow!

#### What's Working (95% Complete):
1. **✅ Login & Authentication** - OAuth flow with Okta fully functional
2. **✅ Popup/Announcement Dismissal** - Automatic handling of all modal dialogs
3. **✅ Navigation** - Successfully reaches patient creation form
4. **✅ Patient Information Form** - ALL fields working:
   - Patient demographics (name, DOB, gender)
   - Address with validation handling
   - Phone with type (Mobile/Home/Cell) AND usage selection
   - **Insurance Information/Responsible Party** - Payor Code, Insurance Name, Insurance ID, Relationship
5. **✅ Bill Method Selection** - Medicaid/Medicare/Client properly selected
6. **✅ Form Validation & Submission** - Successfully navigates to Order Details page
7. **✅ Test Selection** - Successfully searches and selects multiple tests by name
8. **✅ Diagnosis Codes** - Successfully adds ICD-10 diagnosis codes
9. **✅ Order Preview** - Preview generated successfully

#### What's Left (5% Remaining):
1. **⏳ Fill Missing Required Fields** - Identify what's missing (Provider, Order Date, etc.) that's keeping Validate button disabled
2. **⏳ Click "Validate" Button** - Should work once required fields filled
3. **⏳ Final Submission** - Click "Create Order" and capture confirmation number

#### Key Files:
- **Main Agent**: `/backend/src/services/portalAgents/labcorpAgent.js` (1340 lines)
- **Test Script**: `/backend/src/scripts/testLabcorpOrderFlow.js`
- **Lab Codes**: `/backend/config/labTestCodes.json`
- **Documentation**: `/LABCORP_AUTOMATION_PROGRESS.md` (comprehensive progress report)
- **Labcorp Guide**: `ORDERS_ORDERS_REFGUIDE (9).pdf` (official workflow documentation)

#### Recent Fixes Applied (October 24, 2025):
- ✅ **Phone Usage dropdown** - Added selection logic (index 1)
- ✅ **Insurance Information section** - Complete implementation (Payor Code, Insurance Name, Insurance ID, Responsible Party)
- ✅ **Address validation handling** - Detects errors, waits for confirmation, checks button enabled state
- ✅ **Create New Order navigation** - Detects Patient Details page and clicks appropriate button
- ✅ **Test selection** - Working with autocomplete, successfully selects multiple tests
- ✅ **Diagnosis codes** - Successfully adds ICD-10 codes
- ✅ **Better test data** - Using real University of Utah Hospital address (50 N Medical Dr, SLC, UT 84132)
- ✅ **Enhanced error logging** - URLs, page titles, validation error detection

#### Test Results (Latest Run):
- **Login**: ✅ Success
- **Patient Creation**: ✅ Success (all fields filled including insurance)
- **Navigation to Order Details**: ✅ Success
- **Test Selection**: ✅ Successfully selected 3 tests (CBC, CMP, Thyroid)
- **Diagnosis Codes**: ✅ Successfully added F31.30, Z51.81
- **Validation**: ⚠️ Button exists but disabled (missing required fields)
- **Total Time**: ~2 minutes

#### Test Command:
```bash
cd backend && node src/scripts/testLabcorpOrderFlow.js
```

**Browser will stay open for inspection - press Ctrl+C to close.**

---

## 🚀 HANDOFF PROMPT FOR NEXT CLAUDE CODE SESSION

### Quick Start Instructions

Hey there! You're continuing the Labcorp Link automation. **Great news: 75% is done!**

**What's Already Working:**
- Complete Smart Lab Order UI (patient search, eligibility, test/diagnosis selection)
- Labcorp automation: login, navigation, patient form filling (all working!)

**Your Mission:**
Complete the final 25% - test selection, diagnosis codes, and order submission.

**Where to Start:**

1. **Read the progress report:**
   ```bash
   cat /Users/macsweeney/lab-requisition-app/LABCORP_AUTOMATION_PROGRESS.md
   ```

2. **Review Labcorp's official workflow:**
   - File: `ORDERS_ORDERS_REFGUIDE (9).pdf` (in Downloads or moonlit-claims folders)
   - Page 3 shows the Order Details page (where you need to implement test selection)
   - Page 5 shows validation and submission

3. **Test current state:**
   ```bash
   cd /Users/macsweeney/lab-requisition-app/backend
   node src/scripts/testLabcorpOrderFlow.js
   ```
   - Browser will open and run through the automation
   - It should fill patient form and attempt "Save & Create Order"
   - May fail if phone validation still has issues - check screenshot in `test-screenshots/`

4. **Key Implementation Needed:**

   **A. Complete Patient Form Submission** (15 min)
   - Verify phone type/number fixes work
   - Ensure "Save & Create Order" button clicks successfully
   - Reach Order Details page
   - Take screenshot to confirm

   **B. Implement Test Selection** (30 min)
   - Location: `labcorpAgent.js` line ~1132 (`selectTests()` method)
   - Find test search field: `input[placeholder*="Enter Test Number"]`
   - For each test: enter 6-digit code, wait for autocomplete, click suggestion
   - Test codes in `/backend/config/labTestCodes.json`
   - Example: `322000` = Comprehensive Metabolic Panel

   **C. Implement Diagnosis Selection** (20 min)
   - Location: `labcorpAgent.js` line ~1154 (`addDiagnosisCodes()` method)
   - Find diagnosis search field: `input[placeholder*="Diagnosis Code"]`
   - Enter ICD-10 codes (e.g., `F31.30`, `Z51.81`)
   - Select from dropdown

   **D. Validation & Submission** (15 min)
   - Click "Validate" button (checks diagnosis/coverage)
   - Handle any validation warnings
   - Click "Create Order" button
   - Extract confirmation/requisition number from page
   - Return success with confirmation number

**Success Criteria:**
- ✅ Order submitted to Labcorp successfully
- ✅ Confirmation number captured
- ✅ Screenshots saved at each step
- ✅ Test with 3 sample tests completes end-to-end

**Estimated Time:** 1.5-2 hours total

**Reference Files:**
- Main automation: `/backend/src/services/portalAgents/labcorpAgent.js`
- Test data: `/backend/src/scripts/testLabcorpOrderFlow.js`
- Lab codes: `/backend/config/labTestCodes.json`
- Progress report: `/LABCORP_AUTOMATION_PROGRESS.md`

**Tips:**
- The hard parts (login, navigation, form filling) are DONE ✅
- Remaining work follows documented Labcorp workflow
- Use screenshots liberally for debugging
- Test with `HEADLESS_MODE=false` to watch it work

**You've got this! The foundation is rock-solid. Just follow the Labcorp documentation pattern and you'll be done in no time.** 🚀

---

## 🚀 NEXT STEPS FOR NEXT CLAUDE CODE SESSION (LEGACY - See Handoff Above)

### Current Status Summary
✅ **Smart Lab Order UI is complete and working**
- Patient search with fuzzy matching (first OR last name)
- Radio button selection with auto-select for single results
- Medicaid eligibility verification with phone fallback
- Combined test/diagnosis selection page
- Confirmation page before submission
- Real-time status updates via Socket.io

❌ **Labcorp Automation is NOT complete**
- Orders are submitted to `/api/lab-orders/submit` endpoint
- But the actual Labcorp Link browser automation is not fully working
- Need to complete the `labcorpAgent.js` implementation

### Priority 1: Complete Labcorp Link Automation

**Goal:** Take the order data from the Smart Lab Order interface and automatically submit it to Labcorp Link website using Playwright.

**Current State:**
- File exists: `/backend/src/services/portalAgents/labcorpAgent.js`
- Login/navigation partially working
- Reached Patient Information form
- Need to complete form filling and submission

**What Needs to Be Done:**

#### Step 1: Test Current Automation State
```bash
cd backend
node src/scripts/testLabcorpOrderFlow.js
```
This will show you where the automation currently fails.

#### Step 2: Complete Patient Information Form Filling
The form requires:
- **Bill Method**: "Medicaid" (from dropdown)
- **Patient Name**: From Medicaid/IntakeQ data
- **Date of Birth**: MM/DD/YYYY format
- **Phone**: From Medicaid or IntakeQ (we have this working!)
- **Address**: From Medicaid X12 271 response (pre-populated to match Labcorp's expected format)
- **Medicaid ID**: From eligibility check

**Key Insight:** Use Medicaid address data to avoid address correction prompts!

#### Step 3: Test Selection
After patient info, need to:
1. Navigate to test selection page
2. Search for each test by 6-digit code (e.g., "004465" for Prolactin)
3. Select the test
4. Repeat for all selected tests

#### Step 4: Diagnosis Code Entry
- Add ICD-10 codes from the user's selection
- Link diagnoses to tests as required by Labcorp

#### Step 5: Review & Submit
- Navigate through Labcorp's review page
- Click final submit button
- Capture confirmation number
- Return success status

### Implementation Approach

**Use the LLM Helper for Adaptability:**
- File: `/backend/src/services/portalAgents/llmHelper.js`
- Uses Google Gemini to analyze HTML when selectors fail
- Handles form variations and UI changes
- Makes automation resilient to Labcorp portal updates

**Error Handling Strategy:**
1. **First attempt**: Standard automation with predefined selectors
2. **Retry with LLM**: If selectors fail, use LLM to find alternative selectors
3. **Email fallback**: If automation fails completely, email `hello@trymoonlit.com` with:
   - Patient name, DOB, phone, address
   - Medicaid ID
   - List of test codes and names
   - List of diagnosis codes
   - All data needed for manual entry

**Take Screenshots:**
- Screenshot after every major step
- Store in `/backend/test-screenshots/`
- Include timestamp in filename
- Helps with debugging and compliance

### Testing Strategy

**Test Patient Data:**
- Name: Austin Schneider
- DOB: 1991-08-08
- Phone: 8013598862 (from IntakeQ)
- Medicaid ID: 0601626420
- Address: PO BOX 1290, SLC, UT 84110 (from Medicaid)

**Test Order:**
```javascript
{
  providerName: "MOONLIT Provider",
  patient: {
    firstName: "Austin",
    lastName: "Schneider",
    dateOfBirth: "1991-08-08",
    phone: "8013598862",
    medicaidId: "0601626420",
    address: {
      street: "PO BOX 1290",
      city: "SLC",
      state: "UT",
      zip: "84110"
    }
  },
  tests: [
    { code: "004465", name: "Prolactin", category: "Endocrine" }
  ],
  diagnoses: ["F31.30"], // Bipolar disorder, depressed
  useMedicaidData: true
}
```

### Key Files to Work With

1. **`/backend/src/services/portalAgents/labcorpAgent.js`** - Main automation logic
2. **`/backend/src/services/portalAgents/llmHelper.js`** - LLM integration for adaptability
3. **`/backend/src/scripts/testLabcorpOrderFlow.js`** - Test script
4. **`/backend/src/routes/labOrders.js`** - API endpoint that calls the agent

### Success Criteria

✅ Provider submits order through Smart Lab Order interface
✅ Automation logs into Labcorp Link successfully
✅ Patient information form filled with Medicaid data (no address corrections)
✅ All selected tests added to order
✅ All diagnosis codes linked
✅ Order submitted successfully
✅ Confirmation number returned to user
✅ Screenshots saved for compliance
✅ If automation fails, email sent to CMO with all order details

### Expected Timeline

- **Day 1**: Test current state, complete patient info form filling
- **Day 2**: Implement test selection logic
- **Day 3**: Add diagnosis linking and final submission
- **Day 4**: Error handling, email notifications, testing

### Critical Reminders

1. **Run in non-headless mode initially** (`HEADLESS_MODE=false`) to see what's happening
2. **Use Medicaid address data** - it matches Labcorp's expected format exactly
3. **Take screenshots at every step** - helps debugging and compliance
4. **Test with real Labcorp credentials** - stored in `.env`
5. **Don't parallelize** - Labcorp may flag concurrent sessions
6. **Use realistic delays** - Add 1-2 second waits between actions
7. **Handle popups** - Cookie banners, announcements, etc.
8. **Keep PDF fallback** - Always available if automation fails

### Environment Variables

Make sure these are set in `/backend/.env`:
```bash
# Labcorp Link Credentials
LABCORP_USERNAME=your_username
LABCORP_PASSWORD=your_password

# Google Gemini for LLM Helper
GEMINI_API_KEY=your_gemini_key

# Email for Failure Notifications
NOTIFICATION_EMAIL=hello@trymoonlit.com

# Automation Settings
HEADLESS_MODE=false  # Set to true in production
SCREENSHOT_PATH=./test-screenshots
```

---

## HANDOFF PROMPT FOR NEXT CLAUDE CODE SESSION

Hey there! You're continuing work on the Labcorp Link automation for MOONLIT's psychiatry practice.

**✅ What's Already Working:**
- Complete Smart Lab Order UI with patient search, eligibility checking, and order submission
- Medicaid eligibility integration with X12 270/271 (Office Ally)
- IntakeQ patient search with fuzzy matching
- Phone number fallback logic (Medicaid → IntakeQ → null)
- All patient data, test codes, and diagnosis codes are being collected correctly

**❌ What Needs to Be Done:**
The Smart Lab Order interface submits orders, but the Labcorp Link automation (`labcorpAgent.js`) is NOT complete. Orders get stuck in the automation queue.

**Your Mission:**
Complete the Labcorp Link browser automation to automatically fill and submit lab orders.

**Where to Start:**
1. Read the "Next Steps" section above (everything marked 🚀)
2. Test the current automation state: `node backend/src/scripts/testLabcorpOrderFlow.js`
3. Review `/backend/src/services/portalAgents/labcorpAgent.js` to see what's done
4. Complete the missing pieces: patient form filling, test selection, diagnosis linking, submission
5. Test with Austin Schneider's data (see testing section above)

**Key Files:**
- `/backend/src/services/portalAgents/labcorpAgent.js` - Main automation (needs completion)
- `/backend/src/services/portalAgents/llmHelper.js` - LLM helper (already built)
- `/backend/src/routes/labOrders.js` - API endpoint (working, calls the agent)
- `/backend/config/labTestCodes.json` - Test codes (complete)

**Success = ** User submits order in UI → automation runs in background → Labcorp order submitted → confirmation number returned → user sees success message.

Good luck! The foundation is solid - now make the automation bulletproof. 🚀