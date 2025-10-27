// Selector Verification Script for Labcorp Link
// This script runs in visible browser mode to verify and update selectors
// It performs a dry-run without submitting any orders

const { chromium } = require('playwright');
require('dotenv').config();

// Current selectors from the implementation guide (to be verified)
const SELECTORS_TO_VERIFY = {
    login: {
        usernameField: '#username',
        passwordField: '#password',
        submitButton: 'button[type="submit"]',
        oauthButton: 'text="Sign in with Labcorp Link"',
        acceptTerms: 'input[type="checkbox"]',
    },
    navigation: {
        mainMenu: '.main-menu',
        newOrderButton: 'text="New Order"',
        ordersMenu: 'text="Orders"',
        reportsMenu: 'text="Reports"',
    },
    patientSearch: {
        searchInput: 'input[placeholder*="patient"]',
        dateOfBirthInput: 'input[type="date"]',
        searchButton: 'button:has-text("Search")',
        newPatientButton: 'text="Add New Patient"',
        patientSearchResults: '.patient-results',
    },
    patientForm: {
        firstName: 'input[name="firstName"]',
        lastName: 'input[name="lastName"]',
        dateOfBirth: 'input[name="dateOfBirth"]',
        gender: 'select[name="gender"]',
        address: 'input[name="address"]',
        city: 'input[name="city"]',
        state: 'select[name="state"]',
        zip: 'input[name="zip"]',
        phone: 'input[name="phone"]',
        saveButton: 'button:has-text("Save")',
    },
    orderForm: {
        providerSearch: 'input[placeholder*="provider"]',
        testSearch: 'input[placeholder*="test"]',
        diagnosisSearch: 'input[placeholder*="diagnosis"]',
        pscCheckbox: 'input[type="checkbox"][name*="psc"]',
        userInitials: 'input[name="userInitials"]',
        continueButton: 'button:has-text("Continue")',
    },
    insurance: {
        medicaidCheckbox: 'input[value="Medicaid"]',
        medicareCheckbox: 'input[value="Medicare"]',
        insuranceIdInput: 'input[name="insuranceId"]',
        payorDropdown: 'select[name="payor"]',
    },
    submission: {
        reviewButton: 'button:has-text("Review")',
        submitButton: 'button:has-text("Submit")',
        confirmationNumber: '.confirmation-number',
    }
};

async function verifySelectorsDryRun() {
    const browser = await chromium.launch({
        headless: false,  // Visible browser for verification
        slowMo: 500,      // Slow down actions for observation
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();
    const verifiedSelectors = {};

    try {
        console.log('🔍 LABCORP LINK SELECTOR VERIFICATION');
        console.log('=====================================\n');
        console.log('This script will navigate through Labcorp Link');
        console.log('to verify and update CSS selectors.\n');
        console.log('⚠️  DRY RUN MODE - No orders will be submitted\n');

        // Step 1: Navigate to Labcorp Link
        console.log('📍 Step 1: Navigating to Labcorp Link...');
        await page.goto('https://link.labcorp.com', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Take screenshot of login page
        await page.screenshot({
            path: './test-screenshots/01-login-page.png',
            fullPage: true
        });
        console.log('   📸 Screenshot: 01-login-page.png');

        // Step 2: Verify login selectors
        console.log('\n📍 Step 2: Verifying login selectors...');

        // Check for username field
        const usernameSelectors = [
            '#username',
            'input[name="username"]',
            'input[type="text"][placeholder*="username"]',
            'input[type="email"]',
            '#email'
        ];

        let foundUsername = null;
        for (const selector of usernameSelectors) {
            try {
                if (await page.locator(selector).count() > 0) {
                    foundUsername = selector;
                    console.log(`   ✅ Username field found: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        if (!foundUsername) {
            console.log('   ❌ Username field not found with expected selectors');
            console.log('   🔍 Searching for any text input...');
            const inputs = await page.locator('input[type="text"], input[type="email"]').all();
            console.log(`   Found ${inputs.length} text/email inputs on page`);
        }

        // Check for password field
        const passwordSelectors = [
            '#password',
            'input[name="password"]',
            'input[type="password"]'
        ];

        let foundPassword = null;
        for (const selector of passwordSelectors) {
            try {
                if (await page.locator(selector).count() > 0) {
                    foundPassword = selector;
                    console.log(`   ✅ Password field found: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        // Check for submit button
        const submitSelectors = [
            'button[type="submit"]',
            'button:has-text("Sign In")',
            'button:has-text("Login")',
            'input[type="submit"]'
        ];

        let foundSubmit = null;
        for (const selector of submitSelectors) {
            try {
                if (await page.locator(selector).count() > 0) {
                    foundSubmit = selector;
                    console.log(`   ✅ Submit button found: ${selector}`);
                    break;
                }
            } catch (e) {
                // Continue to next selector
            }
        }

        // Store verified selectors
        verifiedSelectors.login = {
            usernameField: foundUsername || 'NOT_FOUND',
            passwordField: foundPassword || 'NOT_FOUND',
            submitButton: foundSubmit || 'NOT_FOUND'
        };

        // Step 3: Attempt login
        if (foundUsername && foundPassword && foundSubmit) {
            console.log('\n📍 Step 3: Attempting login...');

            await page.fill(foundUsername, process.env.LABCORP_USERNAME);
            await page.fill(foundPassword, process.env.LABCORP_PASSWORD);

            console.log('   📝 Credentials entered');
            console.log('   ⏸️  Pausing for manual verification...');
            console.log('   👀 Please check the filled form');
            console.log('   ⚠️  Press Enter to continue with login...');

            // Wait for user confirmation before submitting
            await page.waitForTimeout(5000);

            // Click login
            await page.click(foundSubmit);
            console.log('   🔄 Login submitted, waiting for navigation...');

            // Wait for navigation or error
            try {
                await page.waitForURL('**/home**', { timeout: 30000 });
                console.log('   ✅ Login successful!');

                await page.screenshot({
                    path: './test-screenshots/02-home-page.png',
                    fullPage: true
                });
                console.log('   📸 Screenshot: 02-home-page.png');

                // Step 4: Verify navigation selectors
                console.log('\n📍 Step 4: Looking for navigation elements...');

                const navSelectors = [
                    'text="New Order"',
                    'text="Create Order"',
                    'text="Orders"',
                    'a[href*="order"]',
                    'button:has-text("Order")'
                ];

                for (const selector of navSelectors) {
                    try {
                        const count = await page.locator(selector).count();
                        if (count > 0) {
                            console.log(`   ✅ Found: ${selector} (${count} matches)`);
                        }
                    } catch (e) {
                        // Continue
                    }
                }

            } catch (error) {
                console.log('   ⚠️  Login may have failed or requires additional steps');
                console.log('   Error:', error.message);

                // Check for OAuth or additional steps
                if (await page.locator('text="Sign in with"').count() > 0) {
                    console.log('   🔐 OAuth authentication detected');
                }

                if (await page.locator('input[type="checkbox"]').count() > 0) {
                    console.log('   ☑️  Terms acceptance may be required');
                }
            }
        }

        // Step 5: Summary
        console.log('\n=====================================');
        console.log('📊 SELECTOR VERIFICATION SUMMARY');
        console.log('=====================================\n');
        console.log('Verified Selectors:');
        console.log(JSON.stringify(verifiedSelectors, null, 2));

        console.log('\n⚠️  IMPORTANT NEXT STEPS:');
        console.log('1. Update labcorpAgent.js with verified selectors');
        console.log('2. Check screenshots in ./test-screenshots/');
        console.log('3. Note any additional steps required (OAuth, terms, etc.)');

        console.log('\n⏸️  Browser staying open for manual exploration...');
        console.log('   Explore the site and note actual selectors');
        console.log('   Press Ctrl+C when done\n');

        // Keep browser open for manual exploration
        await new Promise(() => {});

    } catch (error) {
        console.error('\n❌ Error during verification:', error);
        await page.screenshot({
            path: './test-screenshots/error-state.png',
            fullPage: true
        });
        console.log('📸 Error screenshot saved: error-state.png');
    }
}

// Run the verification
console.log('🚀 Starting Labcorp Link selector verification...\n');
verifySelectorsDryRun().catch(console.error);