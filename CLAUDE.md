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