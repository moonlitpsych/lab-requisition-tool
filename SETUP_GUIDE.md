# MOONLIT Smart Lab Order System - Setup Guide

## Overview

This is an intelligent lab automation system that:
1. Searches for patients in IntakeQ
2. Verifies Medicaid eligibility via X12 271
3. Auto-populates Labcorp Link orders with Medicaid address data (prevents address correction prompts!)
4. Submits orders automatically via browser automation
5. Sends email notifications to CMO if automation fails

## Prerequisites

- Node.js 16+ installed
- Labcorp Link account credentials
- IntakeQ API key
- Email account for SMTP notifications (Gmail recommended)
- Google Gemini API key (optional, for adaptive form filling)

## Installation Steps

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `backend/.env` with your credentials:

**Required:**
- `LABCORP_USERNAME` - Your Labcorp Link username
- `LABCORP_PASSWORD` - Your Labcorp Link password
- `INTAKEQ_API_KEY` - Get from IntakeQ Settings > API
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - For failure notifications

**Optional:**
- `GEMINI_API_KEY` - For LLM-assisted form filling (fallback)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - For order tracking database

**Pre-configured (don't change):**
- Office Ally credentials for Utah Medicaid X12 271

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
REACT_APP_API_URL=http://localhost:3001
```

### 4. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## Usage

### Provider Workflow (3 Steps, <2 Minutes)

1. **Search for Patient**
   - Enter patient first name (last name optional)
   - IntakeQ automatically searches with fuzzy matching
   - Select patient from results

2. **Select Lab Tests**
   - Updated test list includes:
     - Thyroid Cascade (TSH w/ Reflex)
     - Vitamin B12 + Folate (combined)
     - Clozapine and Metabolites
     - Thiamine
     - Plus all standard tests

3. **Select Diagnoses**
   - Choose from common psychiatry ICD-10 codes
   - Or pull from patient's IntakeQ record

4. **Submit**
   - System automatically:
     - Checks Medicaid eligibility via X12 271
     - Gets patient's exact address from Medicaid
     - Logs into Labcorp Link
     - Fills form with Medicaid data
     - Submits order

### What Happens Behind the Scenes

**Medicaid Integration:**
- Sends X12 270 eligibility request to Office Ally
- Receives X12 271 response with:
  - Eligibility status
  - Medicaid ID
  - **Patient's address exactly as Medicaid has it**
- Uses Medicaid address to populate Labcorp form
- **This prevents address correction prompts!**

**If Automation Fails:**
- Screenshot captured at failure point
- Email sent to `hello@trymoonlit.com` with:
  - Patient demographics
  - Lab tests ordered
  - Linked diagnoses
  - Full address
  - Error message
  - Screenshot attached
- Provider can continue working (not blocked)

## Key Features

### 1. Medicaid Address Auto-Population
The system uses the patient's address from Medicaid's X12 271 response, which is the EXACT address Labcorp expects. This eliminates address correction prompts entirely.

### 2. IntakeQ Integration
- Fuzzy patient search (forgiving of typos)
- Pulls demographics automatically
- Can pull existing diagnoses from IntakeQ records

### 3. Updated Lab Test List
Based on psychiatry practice needs:
- Thyroid Cascade Panel (not just TSH)
- Combined B12 + Folate
- Clozapine monitoring
- Thiamine levels

### 4. Failure Handling
- Email notification to CMO with ALL order details
- No manual data entry needed - copy from email
- Provider workflow not blocked

## Configuration

### SMTP Email Setup (Gmail)

1. Enable 2-factor authentication on Gmail
2. Generate App Password:
   - Google Account → Security → 2-Step Verification → App Passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy generated password

3. Update `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=generated_app_password
```

### IntakeQ API Key

1. Log into IntakeQ
2. Settings → Integrations → API
3. Generate new API key
4. Add to `.env`: `INTAKEQ_API_KEY=your_key`

### Headless vs Visible Mode

**Development (watch automation):**
```
HEADLESS_MODE=false
```

**Production (faster, background):**
```
HEADLESS_MODE=true
```

## API Endpoints

### Search Patients
```
GET /api/lab-orders/search-patients?firstName=Emily&lastName=Smith
```

### Check Medicaid Eligibility
```
POST /api/lab-orders/check-eligibility
{
  "firstName": "Emily",
  "lastName": "Smith",
  "dateOfBirth": "1990-01-15"
}
```

### Get Available Tests
```
GET /api/lab-orders/available-tests
```

### Get Available Diagnoses
```
GET /api/lab-orders/available-diagnoses
```

### Submit Lab Order
```
POST /api/lab-orders/submit
{
  "providerName": "Dr. Smith",
  "patient": {
    "firstName": "Emily",
    "lastName": "Smith",
    "dateOfBirth": "1990-01-15",
    "medicaidId": "UT123456789"
  },
  "tests": [
    { "code": "330015", "name": "Thyroid Cascade" }
  ],
  "diagnoses": ["F31.30"]
}
```

## Testing

### Test Email Notifications
```bash
curl -X POST http://localhost:3001/api/lab-orders/test-email
```

### Test Medicaid Eligibility
```bash
curl -X POST http://localhost:3001/api/lab-orders/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jeremy",
    "lastName": "Montoya",
    "dateOfBirth": "1984-07-17"
  }'
```

## Troubleshooting

### "IntakeQ API key not configured"
- Check `.env` has `INTAKEQ_API_KEY` set
- Verify API key is active in IntakeQ dashboard

### "SMTP not configured"
- Verify all SMTP variables in `.env`
- Test with Gmail App Password (not regular password)

### "Labcorp login failed"
- Check Labcorp credentials in `.env`
- Verify account is not locked
- Check screenshots in `backend/test-screenshots/`

### "Address correction prompt appears"
- Verify Medicaid eligibility check succeeded
- Check that patient has active Medicaid coverage
- Review logs for "Using Medicaid address data" message

## Success Metrics

**Target Performance:**
- Provider submission time: <2 minutes
- Automation success rate: >90%
- Address correction prompts: 0 (with Medicaid data)
- Failure notification delay: <1 minute

## Support

For issues or questions:
- Email: hello@trymoonlit.com
- Check logs: `backend/combined.log`
- Review screenshots: `backend/test-screenshots/`

## Architecture Diagram

```
Provider UI (React)
    ↓
API (Express.js)
    ↓
┌───────────────┬────────────────┬──────────────────┐
│               │                │                  │
IntakeQ API   Office Ally    Labcorp Link   Email SMTP
(Patient      (X12 271        (Browser       (Failure
 Search)       Medicaid)       Automation)    Alerts)
```

## Next Steps

1. Set up environment variables
2. Test with a known patient
3. Verify Medicaid eligibility check
4. Watch first automation run (headless=false)
5. Review success/failure emails
6. Switch to production (headless=true)
