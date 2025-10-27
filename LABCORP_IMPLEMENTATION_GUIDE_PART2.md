# Labcorp Link Order Automation - Implementation Guide (Part 2)

## Continued from LABCORP_IMPLEMENTATION_GUIDE.md

This file contains sections 4-7 of the complete implementation guide.

---

## 4. Insurance Helper Module

Create this as: `backend/src/services/portalAgents/insuranceHelper.js`

```javascript
// Insurance Helper Module
// Handles Utah Medicaid/Commercial insurance detection and payor code mapping

// Utah Medicaid MCOs (Managed Care Organizations)
const UTAH_MEDICAID_MCOS = [
    'Healthy U',
    'University of Utah Health Plans',
    'Molina Healthcare',
    'Select Health',
    'Health Choice Utah',
    'Anthem'
];

// Utah Medicaid FFS (Fee-for-Service)
const UTAH_MEDICAID_FFS = [
    'Targeted Adult Medicaid',
    'Traditional Medicaid',
    'Utah Medicaid'
];

// Payor Code Database
// Based on Labcorp documentation: Medicaid = state abbreviation
const PAYOR_CODES = {
    // Utah Medicaid - all use "UT"
    'Medicaid': 'UT',
    'Healthy U': 'UT',
    'Molina Healthcare of Utah': 'UT',
    'Select Health Community Care': 'UT',
    'Health Choice Utah': 'UT',
    'Targeted Adult Medicaid': 'UT',
    
    // Common Utah Commercial Plans (examples - need to be populated)
    'Select Health': null, // Will need lookup
    'Regence BlueCross BlueShield': null,
    'University of Utah Health Plans': null,
    'EMI Health': null,
    
    // Medicare
    'Medicare': '05' // Per Labcorp documentation
};

/**
 * Determine if insurance is Medicaid
 */
function isMedicaid(insuranceName, medicaidId) {
    if (medicaidId) {
        return true; // Has Medicaid ID
    }

    const name = insuranceName?.toLowerCase() || '';
    
    // Check MCOs
    for (const mco of UTAH_MEDICAID_MCOS) {
        if (name.includes(mco.toLowerCase())) {
            return true;
        }
    }
    
    // Check FFS
    for (const ffs of UTAH_MEDICAID_FFS) {
        if (name.includes(ffs.toLowerCase())) {
            return true;
        }
    }
    
    return false;
}

/**
 * Determine if insurance is Medicare
 */
function isMedicare(insuranceName, medicareId) {
    if (medicareId) {
        return true;
    }
    
    const name = insuranceName?.toLowerCase() || '';
    return name.includes('medicare');
}

/**
 * Get Labcorp payor code for insurance
 * Returns payor code string, or null if needs lookup
 */
function getPayorCode(insuranceName, medicaidId = null) {
    // Check Medicaid first
    if (isMedicaid(insuranceName, medicaidId)) {
        return 'UT'; // Utah Medicaid payor code
    }
    
    // Check Medicare
    if (isMedicare(insuranceName)) {
        return '05'; // Medicare payor code
    }
    
    // Try exact match in database
    if (insuranceName && PAYOR_CODES[insuranceName]) {
        return PAYOR_CODES[insuranceName];
    }
    
    // Try partial match
    for (const [name, code] of Object.entries(PAYOR_CODES)) {
        if (insuranceName?.includes(name) && code) {
            return code;
        }
    }
    
    // Unknown - will need Payor Name Lookup
    return null;
}

/**
 * Determine Bill Method for Labcorp Link
 */
function getBillMethod(patientData) {
    // Check Medicare first
    if (patientData.medicareId || isMedicare(patientData.insuranceProvider)) {
        return 'Medicare';
    }
    
    // Check Medicaid
    if (patientData.medicaidId || isMedicaid(patientData.insuranceProvider, patientData.medicaidId)) {
        // Note: Utah Medicaid MCOs might use "Private Insurance" bill method
        // Depends on Labcorp's specific implementation
        return 'Medicaid'; // Or 'Private Insurance' if MCO
    }
    
    // Check Private Insurance
    if (patientData.insuranceProvider && patientData.insuranceId) {
        return 'Private Insurance';
    }
    
    // Default to Client bill (practice pays)
    return 'Client';
}

/**
 * Format date of birth for Labcorp Link
 * Input: 'YYYY-MM-DD' or Date object
 * Output: 'MM/DD/YYYY'
 */
function formatDOB(dob) {
    if (!dob) return '';
    
    let date;
    if (typeof dob === 'string') {
        date = new Date(dob);
    } else if (dob instanceof Date) {
        date = dob;
    } else {
        return '';
    }
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
}

/**
 * Add a new payor code to the database (for learning)
 */
function addPayorCode(insuranceName, payorCode) {
    PAYOR_CODES[insuranceName] = payorCode;
    console.log(`Added payor code: ${insuranceName} -> ${payorCode}`);
    
    // TODO: Persist to database or file
}

module.exports = {
    isMedicaid,
    isMedicare,
    getPayorCode,
    getBillMethod,
    formatDOB,
    addPayorCode,
    PAYOR_CODES
};
```

---

## 5. Payor Code Database

Create this as: `backend/src/services/portalAgents/payorCodes.json`

```json
{
  "description": "Labcorp Payor Code Database for Utah",
  "lastUpdated": "2025-10-23",
  "codes": {
    "Medicaid": {
      "Utah Medicaid": "UT",
      "Healthy U (UUHP)": "UT",
      "Molina Healthcare of Utah": "UT",
      "Select Health Community Care": "UT",
      "Health Choice Utah (Anthem)": "UT",
      "Targeted Adult Medicaid": "UT"
    },
    "Medicare": {
      "Medicare": "05"
    },
    "Commercial": {
      "Select Health": "NEEDS_LOOKUP",
      "Regence BlueCross BlueShield of Utah": "NEEDS_LOOKUP",
      "University of Utah Health Plans": "NEEDS_LOOKUP",
      "EMI Health": "NEEDS_LOOKUP",
      "Cigna": "NEEDS_LOOKUP",
      "Aetna": "NEEDS_LOOKUP",
      "United Healthcare": "NEEDS_LOOKUP"
    }
  },
  "notes": {
    "medicaid": "All Utah Medicaid plans (both MCO and FFS) use payor code 'UT'",
    "medicare": "Medicare uses payor code '05' and is not editable in Labcorp Link",
    "commercial": "Commercial plans require lookup using 'Payor Name Lookup' feature",
    "billing": "For MCO Medicaid, may need to select 'Private Insurance' bill method instead of 'Medicaid'"
  }
}
```

---

## 6. Test Script

Create this as: `backend/src/scripts/testLabcorpOrderFlow.js`

```javascript
// Test script for Labcorp order automation
const LabcorpAgentV2 = require('../services/portalAgents/labcorpAgent_v2');
require('dotenv').config();

// Test data
const testOrderData = {
    patient: {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '1985-03-15',
        gender: 'Female',
        address: '123 Main Street',
        city: 'Salt Lake City',
        state: 'UT',
        zip: '84101',
        phone: '801-555-1234',
        medicaidId: 'UT123456789', // Utah Medicaid ID
        insuranceProvider: 'Molina Healthcare of Utah'
    },
    providerName: 'YOUR_PROVIDER_NAME', // Update with actual provider
    tests: [
        { code: '7600', name: 'CBC' },
        { code: '322000', name: 'Comprehensive Metabolic Panel' }
    ],
    diagnosisCodes: ['F32.9', 'Z79.899'],
    userInitials: 'UN'
};

async function runTest() {
    const agent = new LabcorpAgentV2();

    try {
        console.log('🧪 Starting Labcorp Order Flow Test\n');

        // Step 1: Initialize
        console.log('1️⃣ Initializing browser...');
        await agent.initialize();
        console.log('✅ Browser initialized\n');

        // Step 2: Login
        console.log('2️⃣ Logging in...');
        await agent.login();
        console.log('✅ Logged in successfully\n');

        // Step 3: Submit order
        console.log('3️⃣ Submitting lab order...');
        const result = await agent.submitLabOrder(testOrderData);
        
        if (result.success) {
            console.log('✅ ORDER SUBMITTED SUCCESSFULLY!');
            console.log(`Requisition Number: ${result.requisitionNumber || 'N/A'}`);
        } else {
            console.log('❌ Order submission failed');
        }

        console.log('\n✅ Test completed!');
        console.log('Check ./automation-screenshots/ for screenshots');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Check screenshots in ./automation-screenshots/ for details');
    } finally {
        // Keep browser open for inspection
        console.log('\n⏸️  Browser staying open for inspection...');
        console.log('Press Ctrl+C to close\n');
        
        // Wait indefinitely
        await new Promise(() => {});
    }
}

// Run the test
runTest().catch(console.error);
```

**To run the test:**
```bash
cd backend
node src/scripts/testLabcorpOrderFlow.js
```

---

## 7. Troubleshooting Guide

### Common Issues & Solutions

#### 1. **Selector Not Found**
**Error:** `Timeout waiting for selector...`

**Solution:**
1. Check the screenshot to see current page state
2. Use browser inspector to find actual selector
3. Update SELECTORS constant in labcorpAgent_v2.js
4. Common fixes:
   ```javascript
   // Try multiple selector strategies
   const field = await page.$(
       'input[name="firstName"],' +
       'input[placeholder*="First Name"],' +
       '[aria-label*="First Name"]'
   );
   ```

#### 2. **Address Validation Warning**
**Symptom:** Stuck on address confirmation

**Solution:**
```javascript
// Handle validation warning
const confirmAgainButton = await page.$('button:has-text("Confirm")');
if (confirmAgainButton) {
    await confirmAgainButton.click();
}
```

Already implemented in the code!

#### 3. **Payor Code Unknown**
**Symptom:** Can't find payor code for insurance

**Solution:**
1. Let automation use Payor Name Lookup (automated)
2. Manually lookup once, then add to payorCodes.json
3. Or pause automation and ask user:
   ```javascript
   if (!payorCode) {
       console.log(`⚠️ Unknown payor code for: ${insuranceName}`);
       console.log('Please lookup in Labcorp Link and enter here:');
       // Implement user input or manual lookup
   }
   ```

#### 4. **ABN Notice Blocks Submission**
**Symptom:** Medicare order shows ABN warning

**Solution:**
- Review ABN detail screen
- May need to change diagnosis code
- Or accept ABN and continue
- Current code logs warning but continues

#### 5. **Test Not Found**
**Symptom:** Test doesn't appear in search

**Solution:**
1. Verify test code is correct
2. Try test name instead of code
3. Use Labcorp Test Menu to confirm test availability
4. Check if test requires special ordering

#### 6. **"Create New Patient" Button Disabled**
**Symptom:** Can't click Create New Patient

**Solution:**
- MUST perform a search first (per PDF requirement)
- Button enables only after search is executed
- Even if search returns no results

#### 7. **Login Fails**
**Symptom:** Can't log into Labcorp Link

**Solution:**
1. Verify credentials in .env file
2. Check for account lockout (wait 30 minutes)
3. Verify username and password are correct
4. Check Labcorp Link status manually in browser

#### 8. **Provider Not Found**
**Symptom:** Provider name doesn't appear in dropdown

**Solution:**
1. Use exact provider name as it appears in Labcorp Link
2. Check provider is associated with your account
3. Try "Add Temporary Provider" if needed

---

## Debugging Tips

### Enable Detailed Logging
```javascript
// In labcorpAgent_v2.js, set logger level to 'debug'
logger.level = 'debug';
```

### Run in Non-Headless Mode
```bash
# In .env file
HEADLESS_MODE=false
```

### Pause at Specific Steps
```javascript
// Add breakpoints in code
await this.takeScreenshot('PAUSE-before-submit');
await new Promise(() => {}); // Infinite wait for inspection
```

### Inspect Page HTML
```javascript
// Add to any step
const html = await this.page.content();
await fs.writeFile('./debug-page.html', html);
console.log('Page HTML saved to debug-page.html');
```

### Verify Element Visibility
```javascript
// Check if element is visible before clicking
const element = await page.$('button:has-text("Submit")');
if (element) {
    const isVisible = await element.isVisible();
    console.log(`Element visible: ${isVisible}`);
}
```

### Wait for Specific Text
```javascript
// Wait for confirmation text
await page.waitForSelector('text="Order Created Successfully"', {
    timeout: 10000
});
```

---

## Next Steps for Claude Code

1. **Copy files to project:**
   - `labcorpAgent_v2.js` → `backend/src/services/portalAgents/`
   - `insuranceHelper.js` → `backend/src/services/portalAgents/`
   - `payorCodes.json` → `backend/src/services/portalAgents/`
   - `testLabcorpOrderFlow.js` → `backend/src/scripts/`

2. **Update selectors:**
   - Run test script with `HEADLESS_MODE=false`
   - Inspect actual selectors using browser developer tools
   - Update SELECTORS constant as needed

3. **Test with real data:**
   - Use actual patient data (or test patient)
   - Verify all fields map correctly
   - Capture any error messages

4. **Handle edge cases:**
   - Add error recovery logic
   - Implement retry mechanisms
   - Handle popup modals
   - Manage session timeouts

5. **Integration:**
   - Connect to existing backend API routes
   - Update database models for order tracking
   - Add WebSocket/polling for status updates

---

## Advanced Configuration

### Custom Screenshot Directory
```javascript
// In .env
SCREENSHOT_PATH=/path/to/screenshots
```

### Adjust Automation Speed
```javascript
// In labcorpAgent_v2.js constructor
this.automationDelay = 500; // Faster
// or
this.automationDelay = 2000; // Slower for stability
```

### Session Management
```javascript
// Save session for reuse
const cookies = await context.cookies();
await fs.writeFile('session.json', JSON.stringify(cookies));

// Restore session
const savedCookies = JSON.parse(await fs.readFile('session.json'));
await context.addCookies(savedCookies);
```

### Headless Mode in Production
```javascript
// In .env for production
HEADLESS_MODE=true
```

---

## Performance Optimization

### Reduce Screenshot Frequency
```javascript
// Only take screenshots on errors or key steps
if (this.currentStep === 'error' || this.currentStep === 'submitted') {
    await this.takeScreenshot(this.currentStep);
}
```

### Connection Pooling
```javascript
// Reuse browser instance for multiple orders
class LabcorpAgentPool {
    constructor() {
        this.agent = null;
    }
    
    async getAgent() {
        if (!this.agent) {
            this.agent = new LabcorpAgentV2();
            await this.agent.initialize();
            await this.agent.login();
        }
        return this.agent;
    }
}
```

### Parallel Processing
```javascript
// Submit multiple orders in parallel (use with caution)
const agents = await Promise.all([
    submitOrder(order1),
    submitOrder(order2),
    submitOrder(order3)
]);
```

---

## Security Best Practices

### 1. **Never Log Passwords**
```javascript
// Already implemented - passwords use [REDACTED] in logs
logger.debug(`Logging in as: ${username}`);
// NOT: logger.debug(`Password: ${password}`);
```

### 2. **Encrypt Stored Sessions**
```javascript
const crypto = require('crypto');

function encryptSession(sessionData) {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.SESSION_KEY);
    let encrypted = cipher.update(JSON.stringify(sessionData), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}
```

### 3. **Environment Variables**
```javascript
// Never commit .env file
// Use .env.example as template
// Rotate credentials regularly
```

### 4. **Screenshot Cleanup**
```javascript
// Delete old screenshots (7 days)
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const files = await fs.readdir(screenshotPath);
for (const file of files) {
    const stat = await fs.stat(path.join(screenshotPath, file));
    if (stat.mtime < sevenDaysAgo) {
        await fs.unlink(path.join(screenshotPath, file));
    }
}
```

---

## Production Deployment Checklist

- [ ] All selectors verified and working
- [ ] Error handling tested thoroughly
- [ ] Screenshots captured on errors only (not every step)
- [ ] Headless mode enabled
- [ ] Session management implemented
- [ ] Credentials secured in environment variables
- [ ] Logging configured appropriately
- [ ] Retry logic implemented
- [ ] Timeout values adjusted for production
- [ ] PDF fallback working
- [ ] Database integration complete
- [ ] API endpoints secured
- [ ] Monitoring and alerting set up

---

## Summary

This implementation provides:
- ✅ Complete workflow based on official Labcorp documentation
- ✅ Utah Medicaid/Commercial insurance handling
- ✅ Payor code database with learning capability
- ✅ Comprehensive error handling and logging
- ✅ Screenshot capture at every step
- ✅ Test script for validation

**Key Features:**
- Follows exact Labcorp Link workflow from PDF
- Handles patient search OR creation
- Smart insurance detection (Medicaid vs Commercial)
- Payor code lookup when needed
- Full order submission with validation
- Detailed logging and debugging support

**Critical Reminders:**
1. Selectors MUST be verified with browser inspector
2. Address validation warnings need confirmation (handled)
3. Payor codes for commercial insurance may need manual lookup
4. ABN handling for Medicare requires review
5. Keep browser in non-headless mode during development

---

## Additional Resources

### Labcorp Link Documentation
- Official Quick Reference Guide (PDF provided by user)
- Test Menu: https://www.labcorp.com/tests
- Provider Support: 1-800-222-7566

### Playwright Documentation
- Selectors: https://playwright.dev/docs/selectors
- API Reference: https://playwright.dev/docs/api/class-page
- Best Practices: https://playwright.dev/docs/best-practices

### Utah Medicaid Resources
- Utah Medicaid Portal: https://medicaid.utah.gov
- MCO Contact Information
- Provider Enrollment

---

**End of Implementation Guide - Good luck! 🚀**

This automation will save MOONLIT countless hours of manual lab ordering!