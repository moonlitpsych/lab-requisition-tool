# Labcorp Link Order Automation - Complete Implementation Guide

**Based on Official Labcorp Link Quick Reference Guide**

## Overview

This guide provides the exact implementation for automating lab orders through Labcorp Link, based on the official workflow documentation. The automation follows a 4-step process:

1. **Patient Search/Creation** 
2. **Order Details** (Provider, Tests, Diagnosis)
3. **Additional Information** (ABN, Body Sites, Clinical Questions)
4. **Submit & Print Requisition**

---

## Table of Contents

1. [Workflow Summary](#workflow-summary)
2. [Field Selectors Reference](#field-selectors-reference)
3. [Updated labcorpAgent.js](#updated-labcorpagentjs)
4. [Insurance Helper Module](#insurance-helper-module)
5. [Payor Code Database](#payor-code-database)
6. [Test Script](#test-script)
7. [Troubleshooting Guide](#troubleshooting-guide)

---

## Workflow Summary

### Step 1: Dashboard → Lab Orders
- Click "Lab Orders" card on dashboard
- Navigates to patient search page

### Step 2A: Patient Search
- **Must search before "Create New Patient" button enables**
- Search by: Last Name, First Name, DOB
- Select existing patient OR create new

### Step 2B: Create New Patient (if needed)
- Select Account (defaults to last used)
- Select Bill Method (Client/Private Insurance/Medicare/Medicaid)
- Fill Patient Information (name, DOB, address, phone)
- Click "Confirm" to validate address
- Fill Insurance Information (if not Client bill)
- Click "Save & Create Order"

### Step 3: Order Details
- Select Provider (or "Add Temporary Provider")
- Select Tests (search by name/code, can select multiple)
- Check PSC box for tests collected at Labcorp
- Select Diagnosis Codes (required)
- Fill Order Information (Order Date, Collection Date/Time, User Initials)
- Click "Validate" to check for issues

### Step 4: Additional Information
- Handle ABN warnings (Medicare only)
- Add Body Site if required
- Fill Clinical Questions if required
- Review AccuDraw specimen requirements
- Click "Create Order" to submit
- Print requisition and ABN (if required)

---

## Field Selectors Reference

**IMPORTANT:** These are ESTIMATED selectors based on the PDF screenshots. You MUST verify these using browser inspector during implementation.

```javascript
// Selectors based on Labcorp Link PDF guide
const LABCORP_SELECTORS = {
    // Dashboard
    labOrdersCard: 'text="Lab Orders"',
    
    // Patient Search
    searchLastName: 'input[name="lastName"]', // May need to inspect actual name
    searchFirstName: 'input[name="firstName"]',
    searchDOB: 'input[placeholder*="Date of Birth"], input[name*="dob"]',
    searchButton: 'button:has-text("Search")',
    createNewPatientButton: 'button:has-text("Create New Patient")',
    patientSearchResults: 'table tbody tr', // Results table
    
    // Create New Patient
    accountDropdown: 'select:has-text("Account"), [name*="account"]',
    billMethodDropdown: 'select:has-text("Bill Method")',
    patientFirstName: 'input[name*="firstName"]:not([placeholder*="Search"])',
    patientLastName: 'input[name*="lastName"]:not([placeholder*="Search"])',
    patientDOB: 'input[name*="dateOfBirth"], input[placeholder*="MM/DD/YYYY"]',
    patientGender: 'select[name*="gender"]',
    patientAddress1: 'input[name*="address"][name*="line1"], input[placeholder*="Address Line 1"]',
    patientCity: 'input[name*="city"]',
    patientState: 'select[name*="state"]',
    patientZip: 'input[name*="postal"], input[name*="zip"]',
    patientPhone: 'input[name*="phone"][type="tel"]',
    confirmButton: 'button:has-text("Confirm")',
    
    // Insurance Information
    payorCodeInput: 'input[placeholder*="Payor Code"]',
    payorNameLookup: 'text="Payor Name Lookup"',
    insuranceIdInput: 'input[name*="insuranceId"]',
    groupNumberInput: 'input[name*="groupNumber"]',
    saveAndCreateOrderButton: 'button:has-text("Save & Create Order")',
    
    // Order Details - Patient Details Page
    createNewOrderButton: 'button:has-text("Create New Order")',
    
    // Order Details - Provider
    providerDropdown: 'select:has-text("Select Provider")',
    addTemporaryProvider: 'text="Add Temporary Provider"',
    
    // Order Details - Tests
    testSearchInput: 'input[placeholder*="Enter Test Number or Test Name"]',
    testPicklist: 'text="Search for or Select a Picklist"',
    pscCheckbox: 'input[type="checkbox"]', // Near test name
    
    // Order Details - Diagnosis
    diagnosisSearchInput: 'input[placeholder*="x00"]',
    selectedDiagnosisList: 'text="Selected Diagnosis Code(s)"',
    
    // Order Details - Order Information
    orderDateInput: 'input[name*="orderDate"]',
    collectionDateInput: 'input[name*="collectionDate"]',
    collectionTimeInput: 'input[name*="collectionTime"]',
    userInitialsInput: 'input[name*="userInitials"]',
    
    // Validate & Submit
    validateButton: 'button:has-text("Validate")',
    saveButton: 'button:has-text("Save")',
    createOrderButton: 'button:has-text("Create Order")',
    cancelButton: 'button:has-text("Cancel")',
    
    // Additional Information
    abnDetail: 'text="ABN Detail"',
    bodyMappingSite: 'text="Add a Body Site"',
    clinicalQuestions: 'text="Clinical Questions"',
    accuDrawInfo: 'text="AccuDraw Information"',
    
    // Confirmation
    requisitionNumber: '[data-test*="requisition"], text=/L\d{10}/',
    printButton: 'button:has-text("Print")'
};
```

---

## Updated labcorpAgent.js

Create this as: `backend/src/services/portalAgents/labcorpAgent_v2.js`

```javascript
// Labcorp Link Portal Automation Agent v2
// Based on Official Labcorp Link Quick Reference Guide

const { chromium } = require('playwright');
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const { getPayorCode, getBillMethod, formatDOB } = require('./insuranceHelper');

// Configure logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Selector constants
const SELECTORS = {
    // Dashboard
    labOrdersCard: 'text="Lab Orders"',
    
    // Patient Search
    searchLastName: 'input[name="lastName"]',
    searchFirstName: 'input[name="firstName"]',
    searchDOB: 'input[placeholder*="Date of Birth"]',
    searchButton: 'button:has-text("Search")',
    createNewPatientButton: 'button:has-text("Create New Patient")',
    
    // Create New Patient
    billMethodDropdown: 'select:has-text("Bill Method")',
    patientFirstName: 'input[name*="firstName"]:not([placeholder*="Search"])',
    patientLastName: 'input[name*="lastName"]:not([placeholder*="Search"])',
    patientDOB: 'input[placeholder*="MM/DD/YYYY"]',
    patientGender: 'select[name*="gender"]',
    patientAddress1: 'input[placeholder*="Address Line 1"]',
    patientCity: 'input[name*="city"]',
    patientState: 'select[name*="state"]',
    patientZip: 'input[name*="postal"]',
    patientPhone: 'input[type="tel"]',
    confirmButton: 'button:has-text("Confirm")',
    
    // Insurance
    payorCodeInput: 'input[placeholder*="Payor Code"]',
    payorNameLookup: 'text="Payor Name Lookup"',
    insuranceIdInput: 'input[name*="insuranceId"]',
    saveAndCreateOrderButton: 'button:has-text("Save & Create Order")',
    
    // Order Details
    createNewOrderButton: 'button:has-text("Create New Order")',
    providerDropdown: 'select:has-text("Select Provider")',
    testSearchInput: 'input[placeholder*="Enter Test Number or Test Name"]',
    diagnosisSearchInput: 'input[placeholder*="x00"]',
    userInitialsInput: 'input[name*="userInitials"]',
    validateButton: 'button:has-text("Validate")',
    createOrderButton: 'button:has-text("Create Order")'
};

class LabcorpAgentV2 {
    constructor(options = {}) {
        this.portal = 'labcorp';
        this.loginUrl = 'https://link.labcorp.com';
        this.headless = process.env.HEADLESS_MODE === 'true';
        this.screenshotPath = process.env.SCREENSHOT_PATH || './automation-screenshots';
        this.automationDelay = 1000; // 1 second between actions

        this.browser = null;
        this.context = null;
        this.page = null;
        this.orderId = null;
        this.currentStep = 'initialized';
    }

    /**
     * Initialize browser and page
     */
    async initialize() {
        try {
            logger.info('Initializing Labcorp automation browser...');

            this.browser = await chromium.launch({
                headless: this.headless,
                slowMo: 100,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.context = await this.browser.newContext({
                viewport: { width: 1920, height: 1080 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            this.page = await this.context.newPage();

            // Ensure screenshot directory exists
            await fs.mkdir(this.screenshotPath, { recursive: true });

            logger.info('Browser initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    /**
     * Login to Labcorp Link
     */
    async login() {
        try {
            logger.info('Starting Labcorp Link login...');
            this.currentStep = 'login';

            // Navigate to main page
            await this.page.goto(this.loginUrl);
            await this.page.waitForLoadState('networkidle');
            await this.takeScreenshot('01-main-page');

            // Click Sign In button
            const signInButton = await this.page.$('button:has-text("Sign In")');
            if (signInButton) {
                await signInButton.click();
                await this.page.waitForLoadState('networkidle');
            }

            await this.takeScreenshot('02-login-page');

            // Fill username
            await this.page.fill('input[name="identifier"], input[name="username"]', 
                process.env.LABCORP_USERNAME);

            // Click Next
            const nextButton = await this.page.$('input[type="submit"][value="Next"]');
            if (nextButton) {
                await nextButton.click();
                await this.page.waitForSelector('input[name="credentials.passcode"], input[name="password"]', 
                    { timeout: 10000 });
            }

            // Fill password
            await this.page.fill('input[name="credentials.passcode"], input[name="password"]', 
                process.env.LABCORP_PASSWORD);

            await this.takeScreenshot('03-credentials-filled');

            // Click Verify
            const submitButton = await this.page.$('input[type="submit"][value="Verify"]');
            if (submitButton) {
                await submitButton.click();
            }

            // Wait for dashboard
            await this.page.waitForURL('**/dashboard**', { timeout: 30000 });
            await this.delay(2000);

            await this.takeScreenshot('04-dashboard');
            logger.info('✅ Successfully logged into Labcorp Link');
            this.currentStep = 'logged_in';

            return true;
        } catch (error) {
            logger.error('Login failed:', error);
            await this.takeScreenshot('ERROR-login-failed');
            throw error;
        }
    }

    /**
     * Navigate to Lab Orders section
     */
    async navigateToLabOrders() {
        try {
            logger.info('Navigating to Lab Orders...');
            this.currentStep = 'navigating_to_orders';

            // Click Lab Orders card
            await this.page.click(SELECTORS.labOrdersCard);
            await this.page.waitForLoadState('networkidle');
            await this.delay(1000);

            await this.takeScreenshot('05-lab-orders-page');
            logger.info('Reached Lab Orders page');
            this.currentStep = 'lab_orders_page';

            return true;
        } catch (error) {
            logger.error('Failed to navigate to Lab Orders:', error);
            await this.takeScreenshot('ERROR-nav-to-orders');
            throw error;
        }
    }

    /**
     * Search for existing patient
     * Returns: { found: boolean, patientId?: string }
     */
    async searchPatient(patientData) {
        try {
            logger.info(`Searching for patient: ${patientData.lastName}, ${patientData.firstName}`);
            this.currentStep = 'searching_patient';

            // Fill search fields
            await this.page.fill(SELECTORS.searchLastName, patientData.lastName);
            await this.page.fill(SELECTORS.searchFirstName, patientData.firstName);
            await this.page.fill(SELECTORS.searchDOB, formatDOB(patientData.dateOfBirth)); // MM/DD/YYYY

            await this.takeScreenshot('06-patient-search-filled');

            // Click Search
            await this.page.click(SELECTORS.searchButton);
            await this.delay(2000);

            await this.takeScreenshot('07-patient-search-results');

            // Check for results
            const resultsTable = await this.page.$('table tbody tr');
            
            if (resultsTable) {
                logger.info('Patient found in system');
                // Click first result
                await resultsTable.click();
                await this.delay(1000);
                await this.takeScreenshot('08-patient-selected');
                
                return { found: true };
            } else {
                logger.info('Patient not found - will create new');
                return { found: false };
            }
        } catch (error) {
            logger.error('Patient search failed:', error);
            await this.takeScreenshot('ERROR-patient-search');
            throw error;
        }
    }

    /**
     * Create new patient
     */
    async createNewPatient(patientData) {
        try {
            logger.info('Creating new patient...');
            this.currentStep = 'creating_patient';

            // Click Create New Patient button (should be enabled after search)
            await this.page.click(SELECTORS.createNewPatientButton);
            await this.delay(1000);

            await this.takeScreenshot('09-create-patient-form');

            // Select Bill Method
            const billMethod = getBillMethod(patientData);
            logger.info(`Bill Method: ${billMethod}`);
            await this.page.selectOption(SELECTORS.billMethodDropdown, { label: billMethod });

            // Fill Patient Information
            await this.page.fill(SELECTORS.patientFirstName, patientData.firstName);
            await this.page.fill(SELECTORS.patientLastName, patientData.lastName);
            await this.page.fill(SELECTORS.patientDOB, formatDOB(patientData.dateOfBirth));
            
            if (patientData.gender) {
                await this.page.selectOption(SELECTORS.patientGender, patientData.gender);
            }

            // Address information
            if (patientData.address) {
                await this.page.fill(SELECTORS.patientAddress1, patientData.address);
            }
            if (patientData.city) {
                await this.page.fill(SELECTORS.patientCity, patientData.city);
            }
            if (patientData.state) {
                await this.page.selectOption(SELECTORS.patientState, patientData.state);
            }
            if (patientData.zip) {
                await this.page.fill(SELECTORS.patientZip, patientData.zip);
            }

            // Phone
            if (patientData.phone) {
                await this.page.fill(SELECTORS.patientPhone, patientData.phone);
            }

            await this.takeScreenshot('10-patient-info-filled');

            // Click Confirm to validate address
            await this.page.click(SELECTORS.confirmButton);
            await this.delay(2000);

            // Handle address validation warning if it appears
            const confirmAgainButton = await this.page.$('button:has-text("Confirm")');
            if (confirmAgainButton) {
                logger.info('Address validation warning - confirming anyway');
                await confirmAgainButton.click();
                await this.delay(1000);
            }

            await this.takeScreenshot('11-patient-confirmed');

            // Fill Insurance Information if needed
            if (billMethod !== 'Client') {
                await this.fillInsuranceInfo(patientData);
            }

            // Click Save & Create Order
            await this.page.click(SELECTORS.saveAndCreateOrderButton);
            await this.page.waitForLoadState('networkidle');
            await this.delay(1000);

            await this.takeScreenshot('12-order-details-page');
            logger.info('✅ Patient created successfully');
            this.currentStep = 'order_details';

            return true;
        } catch (error) {
            logger.error('Failed to create patient:', error);
            await this.takeScreenshot('ERROR-create-patient');
            throw error;
        }
    }

    /**
     * Fill insurance information
     */
    async fillInsuranceInfo(patientData) {
        try {
            logger.info('Filling insurance information...');

            const payorCode = getPayorCode(patientData.insuranceProvider, patientData.medicaidId);

            if (payorCode) {
                // Direct payor code entry
                logger.info(`Using payor code: ${payorCode}`);
                await this.page.fill(SELECTORS.payorCodeInput, payorCode);
            } else {
                // Use Payor Name Lookup
                logger.warn('Payor code unknown - using lookup feature');
                await this.page.click(SELECTORS.payorNameLookup);
                await this.delay(1000);

                // Fill insurance name and search
                await this.page.fill('input[placeholder*="Insurance Name"]', 
                    patientData.insuranceProvider);
                await this.page.selectOption('select[name*="state"]', 'UT');
                await this.page.click('button:has-text("Search")');
                await this.delay(2000);

                // Select first result
                await this.page.click('table tbody tr:first-child');
                await this.delay(1000);
            }

            // Insurance ID
            const insuranceId = patientData.medicaidId || patientData.insuranceId;
            if (insuranceId) {
                await this.page.fill(SELECTORS.insuranceIdInput, insuranceId);
            }

            // Group Number (if applicable)
            if (patientData.groupNumber) {
                await this.page.fill(SELECTORS.groupNumberInput, patientData.groupNumber);
            }

            await this.takeScreenshot('11-insurance-filled');
            logger.info('Insurance information completed');

            return true;
        } catch (error) {
            logger.error('Failed to fill insurance info:', error);
            throw error;
        }
    }

    /**
     * Navigate to Create New Order (for existing patients)
     */
    async clickCreateNewOrder() {
        try {
            logger.info('Clicking Create New Order for existing patient...');
            
            await this.page.click(SELECTORS.createNewOrderButton);
            await this.page.waitForLoadState('networkidle');
            await this.delay(1000);

            await this.takeScreenshot('12-order-details-page');
            this.currentStep = 'order_details';

            return true;
        } catch (error) {
            logger.error('Failed to click Create New Order:', error);
            throw error;
        }
    }

    /**
     * Fill order details (Provider, Tests, Diagnosis)
     */
    async fillOrderDetails(orderData) {
        try {
            logger.info('Filling order details...');
            this.currentStep = 'filling_order';

            // Select Provider
            if (orderData.providerName) {
                logger.info(`Selecting provider: ${orderData.providerName}`);
                await this.page.selectOption(SELECTORS.providerDropdown, 
                    { label: orderData.providerName });
            }

            await this.takeScreenshot('13-provider-selected');

            // Select Tests
            for (const test of orderData.tests) {
                await this.addTest(test);
            }

            await this.takeScreenshot('14-tests-added');

            // Add Diagnosis Codes
            for (const diagnosisCode of orderData.diagnosisCodes) {
                await this.addDiagnosis(diagnosisCode);
            }

            await this.takeScreenshot('15-diagnosis-added');

            // Fill Order Information
            await this.page.fill(SELECTORS.userInitialsInput, orderData.userInitials || 'UN');

            await this.takeScreenshot('16-order-info-complete');

            // Click Validate
            logger.info('Validating order...');
            await this.page.click(SELECTORS.validateButton);
            await this.delay(3000); // Wait for validation

            await this.takeScreenshot('17-order-validated');
            logger.info('✅ Order details filled and validated');
            this.currentStep = 'order_validated';

            return true;
        } catch (error) {
            logger.error('Failed to fill order details:', error);
            await this.takeScreenshot('ERROR-order-details');
            throw error;
        }
    }

    /**
     * Add a single test
     */
    async addTest(test) {
        try {
            logger.info(`Adding test: ${test.name} (${test.code})`);

            // Type test name or code into search
            await this.page.fill(SELECTORS.testSearchInput, test.name || test.code);
            await this.delay(1500); // Wait for autocomplete

            // Click the test from autocomplete suggestions
            const testOption = await this.page.$(`text="${test.name}"`);
            if (testOption) {
                await testOption.click();
            } else {
                // Try pressing Enter if no suggestion appears
                await this.page.keyboard.press('Enter');
            }

            await this.delay(500);
            logger.debug(`Test added: ${test.name}`);

            return true;
        } catch (error) {
            logger.error(`Failed to add test ${test.name}:`, error);
            throw error;
        }
    }

    /**
     * Add a diagnosis code
     */
    async addDiagnosis(diagnosisCode) {
        try {
            logger.info(`Adding diagnosis code: ${diagnosisCode}`);

            // Type diagnosis code
            await this.page.fill(SELECTORS.diagnosisSearchInput, diagnosisCode);
            await this.delay(1000); // Wait for autocomplete

            // Click the diagnosis from suggestions
            const diagnosisOption = await this.page.$(`text="${diagnosisCode}"`);
            if (diagnosisOption) {
                await diagnosisOption.click();
            } else {
                // Try pressing Enter
                await this.page.keyboard.press('Enter');
            }

            await this.delay(500);
            logger.debug(`Diagnosis added: ${diagnosisCode}`);

            return true;
        } catch (error) {
            logger.error(`Failed to add diagnosis ${diagnosisCode}:`, error);
            throw error;
        }
    }

    /**
     * Handle additional information and submit
     */
    async submitOrder() {
        try {
            logger.info('Submitting order...');
            this.currentStep = 'submitting';

            // Check for ABN warnings (Medicare)
            const abnDetail = await this.page.$('text="ABN Detail"');
            if (abnDetail) {
                logger.warn('ABN notice present - may require manual review');
                await this.takeScreenshot('18-abn-notice');
            }

            // Check for Clinical Questions
            const clinicalQuestions = await this.page.$('text="Clinical Questions"');
            if (clinicalQuestions) {
                logger.info('Clinical questions present - filling if required');
                // TODO: Handle clinical questions if needed
            }

            await this.takeScreenshot('19-ready-to-submit');

            // Click Create Order
            await this.page.click(SELECTORS.createOrderButton);
            await this.delay(3000);

            // Wait for confirmation
            await this.page.waitForLoadState('networkidle');
            await this.delay(2000);

            await this.takeScreenshot('20-order-submitted');

            // Try to get requisition number
            const requisitionNumber = await this.getRequisitionNumber();
            if (requisitionNumber) {
                logger.info(`✅ Order submitted successfully! Requisition: ${requisitionNumber}`);
                this.currentStep = 'completed';
                return { success: true, requisitionNumber };
            } else {
                logger.warn('Order submitted but could not find requisition number');
                return { success: true, requisitionNumber: null };
            }
        } catch (error) {
            logger.error('Failed to submit order:', error);
            await this.takeScreenshot('ERROR-submit-order');
            throw error;
        }
    }

    /**
     * Extract requisition number from confirmation page
     */
    async getRequisitionNumber() {
        try {
            // Look for requisition number pattern: L followed by 10 digits
            const pageText = await this.page.textContent('body');
            const match = pageText.match(/L\d{10}/);
            
            if (match) {
                return match[0];
            }

            return null;
        } catch (error) {
            logger.error('Failed to extract requisition number:', error);
            return null;
        }
    }

    /**
     * Complete order flow - main orchestration method
     */
    async submitLabOrder(orderData) {
        try {
            logger.info('=== Starting Labcorp Lab Order Submission ===');
            logger.info(`Patient: ${orderData.patient.firstName} ${orderData.patient.lastName}`);
            logger.info(`Tests: ${orderData.tests.map(t => t.name).join(', ')}`);

            // Step 1: Navigate to Lab Orders
            await this.navigateToLabOrders();

            // Step 2: Search for patient
            const searchResult = await this.searchPatient(orderData.patient);

            // Step 3: Create patient if not found, or click Create New Order if found
            if (!searchResult.found) {
                await this.createNewPatient(orderData.patient);
                // Patient creation leads directly to order details page
            } else {
                await this.clickCreateNewOrder();
            }

            // Step 4: Fill order details
            await this.fillOrderDetails(orderData);

            // Step 5: Submit order
            const result = await this.submitOrder();

            logger.info('=== Order Submission Complete ===');

            return result;
        } catch (error) {
            logger.error('Lab order submission failed:', error);
            throw error;
        }
    }

    /**
     * Utility: Take screenshot
     */
    async takeScreenshot(name) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${timestamp}_${name}.png`;
            const filepath = path.join(this.screenshotPath, filename);
            
            await this.page.screenshot({ path: filepath, fullPage: true });
            logger.debug(`Screenshot saved: ${filename}`);
            
            return filepath;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
        }
    }

    /**
     * Utility: Delay
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms || this.automationDelay));
    }

    /**
     * Cleanup
     */
    async cleanup() {
        try {
            if (this.browser) {
                await this.browser.close();
                logger.info('Browser closed');
            }
        } catch (error) {
            logger.error('Cleanup error:', error);
        }
    }
}

module.exports = LabcorpAgentV2;
```

**Continue in next file due to length...**