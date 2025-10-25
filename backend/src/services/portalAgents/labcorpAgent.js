// Labcorp Link Portal Automation Agent
// Handles automated order submission to Labcorp Link with preview mode

const { chromium } = require('playwright');
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const { getLLMHelper } = require('./llmHelper');
const insuranceHelper = require('./insuranceHelper');
const medicaidEligibilityService = require('../medicaidEligibilityService');
const emailNotificationService = require('../emailNotificationService');
const {
    updateOrderStatus,
    logAutomation,
    createNotification,
    getActiveSession,
    savePortalSession
} = require('../supabase');

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

class LabcorpAgent {
    constructor(options = {}) {
        this.portal = 'labcorp';
        // Start from the main page and let it redirect to OAuth naturally
        this.loginUrl = 'https://link.labcorp.com';
        this.baseUrl = 'https://link.labcorp.com';
        this.headless = process.env.HEADLESS_MODE === 'true';
        this.previewMode = process.env.ENABLE_PREVIEW_MODE === 'true';
        this.screenshotPath = process.env.SCREENSHOT_PATH || './test-screenshots';
        this.maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
        this.automationDelay = parseInt(process.env.AUTOMATION_DELAY_MS) || 1000;

        this.browser = null;
        this.context = null;
        this.page = null;
        this.orderId = null;
        this.io = options.io; // Socket.io instance for real-time updates
        this.llmHelper = getLLMHelper(); // Initialize LLM helper for adaptive form filling
    }

    /**
     * Initialize browser and page
     */
    async initialize() {
        try {
            logger.info('Initializing Labcorp automation browser...');

            this.browser = await chromium.launch({
                headless: this.headless,
                slowMo: 50, // Slow down for stability
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // Check for existing session
            const savedSession = await getActiveSession(this.portal);

            this.context = await this.browser.newContext({
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                // Load saved session if available
                storageState: savedSession ? JSON.parse(savedSession.session_data) : undefined
            });

            this.page = await this.context.newPage();

            // Set up request interception for debugging
            this.page.on('response', response => {
                if (response.status() >= 400) {
                    logger.warn(`HTTP ${response.status()} - ${response.url()}`);
                }
            });

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
            logger.info('Attempting to login to Labcorp Link...');
            this.emitStatus('Logging into Labcorp Link...');

            // Navigate to main page which will redirect to OAuth if needed
            await this.page.goto(this.loginUrl, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Check if already logged in
            const dashboardElement = await this.page.$('text=Dashboard');
            if (dashboardElement) {
                logger.info('Already logged in to Labcorp');
                await this.saveSession();
                return true;
            }

            // Check for Sign In button on landing page
            const signInButton = await this.page.$('button:has-text("Sign In"), a:has-text("Sign In")');
            if (signInButton) {
                logger.info('Found Sign In button on landing page, clicking it...');
                await signInButton.click();
                await this.page.waitForLoadState('networkidle');
                await this.delay(1000);
            }

            // Take screenshot of login page
            await this.takeScreenshot('01-login-page');

            // Try multiple selectors for username field (Okta uses specific patterns)
            const usernameSelectors = [
                '#okta-signin-username',  // Okta default username field
                'input[name="identifier"]',  // Common Okta identifier
                'input[name="username"]',
                '#username',
                'input[type="text"][placeholder*="Username"]',
                'input[type="email"]',  // Some portals use email type
                'input[data-se="userIdentifier"]',  // Okta data attribute
                '#j_username',  // Common Java portal selector
                'input[name="j_username"]',  // Another common pattern
                'input[type="text"]'
            ];

            let usernameField = null;
            for (const selector of usernameSelectors) {
                try {
                    usernameField = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (usernameField) {
                        logger.debug(`Found username field: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // If standard selectors fail, use LLM to find the field
            if (!usernameField) {
                logger.info('Standard selectors failed, using LLM to find login fields...');
                const pageContent = await this.page.content();
                const loginData = {
                    username: process.env.LABCORP_USERNAME,
                    password: 'hidden'
                };

                const llmResult = await this.llmHelper.findFormFields(pageContent, loginData);
                if (llmResult.fields && llmResult.fields.length > 0) {
                    const usernameFieldInfo = llmResult.fields.find(f =>
                        f.fieldName === 'username' || f.fieldName === 'email'
                    );

                    if (usernameFieldInfo) {
                        try {
                            usernameField = await this.page.waitForSelector(usernameFieldInfo.selector, { timeout: 3000 });
                            logger.info(`LLM found username field: ${usernameFieldInfo.selector}`);
                        } catch (e) {
                            logger.error('LLM selector failed:', e);
                        }
                    }
                }
            }

            if (!usernameField) {
                // Last resort: try to find any visible text input
                try {
                    const visibleInputs = await this.page.$$eval('input[type="text"], input[type="email"]',
                        els => els.map(el => ({
                            id: el.id,
                            name: el.name,
                            placeholder: el.placeholder,
                            type: el.type,
                            visible: el.offsetParent !== null
                        }))
                    );
                    logger.error('Could not find username field. All inputs found:', visibleInputs);

                    // Take a debug screenshot
                    await this.takeScreenshot('login-error-debug');

                    // Log the current URL
                    const currentUrl = await this.page.url();
                    logger.error('Current URL:', currentUrl);

                    // Log page title
                    const pageTitle = await this.page.title();
                    logger.error('Page title:', pageTitle);

                } catch (e) {
                    logger.error('Error checking for inputs:', e);
                }
                throw new Error('Could not find username field on login page. The portal may have changed.');
            }

            // Fill username first
            const username = process.env.LABCORP_USERNAME;
            logger.info(`Filling username field with: ${username}`);
            await usernameField.fill(username);
            await this.delay(500);

            // Take screenshot after username entry
            await this.takeScreenshot('02-after-username');

            // Check if there's a "Next" button (common in two-step Okta login)
            // First check if this is a two-step form by looking for Next button
            const nextButtonSelectors = [
                'input[type="submit"][value="Next"]',
                'input[value="Next"]',
                '#idp-discovery-submit',  // Okta identity provider discovery submit
                'input[data-se="next-button"]',
                'button[type="submit"]'  // Generic submit that might be "Next"
            ];

            let clickedNext = false;
            for (const selector of nextButtonSelectors) {
                try {
                    const nextButton = await this.page.$(selector);
                    if (nextButton) {
                        // Check if button text contains "Next" or if it's the primary submit
                        const buttonText = await nextButton.evaluate(el => el.value || el.textContent || '');
                        if (buttonText.toLowerCase().includes('next') || buttonText.toLowerCase().includes('continue')) {
                            logger.debug(`Found Next button: ${selector} with text: ${buttonText}`);
                            await nextButton.click();
                            await this.page.waitForLoadState('networkidle');
                            await this.delay(1000);
                            clickedNext = true;
                            break;
                        } else if (selector === '#idp-discovery-submit' || selector === 'button[type="submit"]') {
                            // For generic submit buttons, click if no password field is visible yet
                            const passwordVisible = await this.page.$('input[type="password"]');
                            if (!passwordVisible) {
                                logger.debug(`Clicking submit button to proceed: ${selector}`);
                                await nextButton.click();
                                await this.page.waitForLoadState('networkidle');
                                await this.delay(1000);
                                clickedNext = true;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            // Now try to find and fill the password field
            const passwordSelectors = [
                '#okta-signin-password',  // Okta default password field
                'input[name="credentials.passcode"]',  // Common Okta password
                'input[name="password"]',
                '#password',
                'input[type="password"]',
                'input[data-se="passcode"]',  // Okta data attribute
                '#pass-signin'
            ];

            let passwordField = null;
            for (const selector of passwordSelectors) {
                try {
                    passwordField = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (passwordField) {
                        logger.debug(`Found password field: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!passwordField) {
                // If still no password field, check if it's a single-page form
                logger.warn('Could not find password field after username entry');
                // Take a screenshot to debug
                await this.takeScreenshot('03-no-password-field');
                throw new Error('Could not find password field on login page. The form may have changed.');
            }

            const password = process.env.LABCORP_PASSWORD;
            logger.info(`Password length: ${password.length}, contains special chars: ${/[^a-zA-Z0-9]/.test(password)}`);

            // Clear the field first and type slowly to handle special characters
            await passwordField.click({ clickCount: 3 }); // Triple click to select all
            await this.page.keyboard.press('Backspace');
            await this.delay(200);

            // Type password character by character for better handling of special chars
            await passwordField.type(password, { delay: 100 });
            await this.delay(500);

            // Take screenshot after password entry
            await this.takeScreenshot('04-after-password');

            await this.takeScreenshot('02-filled-login');

            // Submit login - Okta uses various submit button patterns
            const submitSelectors = [
                '#okta-signin-submit',  // Okta default submit button
                'input[type="submit"][value="Sign In"]',
                'button[type="submit"]',
                'input[type="submit"]',
                'button[data-se="signin-button"]',  // Okta data attribute
                'input[value="Sign In"]'
            ];

            let submitButton = null;
            for (const selector of submitSelectors) {
                try {
                    submitButton = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (submitButton) {
                        logger.debug(`Found submit button: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!submitButton) {
                throw new Error('Could not find submit button on login page');
            }

            logger.info('Clicking submit button to login...');
            await submitButton.click();

            this.emitStatus('Waiting for login to complete...');
            logger.info('Waiting for navigation after login submit...');

            // Wait for navigation
            await this.page.waitForNavigation({
                waitUntil: 'networkidle',
                timeout: 15000
            });

            // Verify login success
            const loggedIn = await this.verifyLogin();
            if (!loggedIn) {
                throw new Error('Login verification failed');
            }

            await this.saveSession();
            await this.takeScreenshot('03-dashboard');

            // Dismiss any welcome popups or feature announcements
            await this.dismissPopups();

            logger.info('Successfully logged into Labcorp Link');
            this.emitStatus('Login successful');

            return true;
        } catch (error) {
            logger.error('Login failed:', error);
            await this.takeScreenshot('login-error');
            throw error;
        }
    }

    /**
     * Verify login was successful
     */
    async verifyLogin() {
        // First log the current URL
        const currentUrl = await this.page.url();
        logger.info(`Current URL after login: ${currentUrl}`);

        // Take screenshot to see what page we're on
        await this.takeScreenshot('05-after-login-page');

        // Check if we're on the dashboard page
        if (currentUrl.includes('/dashboard')) {
            logger.info('Successfully reached dashboard page');
            return true;
        }

        // Also check for dashboard elements
        const dashboardSelectors = [
            'text=Welcome',  // Welcome message
            'text=AccuDraw',  // AccuDraw option
            'text=Lab Orders',  // Lab Orders option
            'text=Results Inbox',  // Results option
            'text=Supply Ordering'  // Supply ordering option
        ];

        for (const selector of dashboardSelectors) {
            try {
                const element = await this.page.waitForSelector(selector, { timeout: 3000 });
                if (element) {
                    logger.debug(`Found dashboard element: ${selector}`);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        return false;
    }

    /**
     * Save browser session for reuse
     */
    async saveSession() {
        try {
            const state = await this.context.storageState();
            await savePortalSession({
                portal: this.portal,
                sessionData: JSON.stringify(state),
                validUntil: new Date(Date.now() + 14 * 60 * 1000).toISOString() // 14 minutes
            });
            logger.debug('Session saved for reuse');
        } catch (error) {
            logger.warn('Failed to save session:', error);
        }
    }

    /**
     * Dismiss any popups, announcements, or modal dialogs
     */
    async dismissPopups() {
        try {
            logger.debug('Checking for popups/announcements to dismiss...');

            // Common close button selectors
            const closeSelectors = [
                'button[aria-label*="Close"]',
                'button[aria-label*="close"]',
                'button[title*="Close"]',
                'button[title*="close"]',
                'button:has-text("Close")',
                'button:has-text("X")',
                'button:has-text("×")',
                '.close',
                '.modal-close',
                '[class*="close"]',
                '[data-dismiss="modal"]',
                '.MuiDialog-root button[aria-label="Close"]',
                'button.btn-close',
                // Feature announcement specific
                'button:has-text("Got it")',
                'button:has-text("OK")',
                'button:has-text("Dismiss")',
                'button:has-text("Later")',
                'button:has-text("Skip")',
                // Cookie banners
                'button:has-text("Accept")',
                'button:has-text("I Understand")'
            ];

            let dismissed = false;
            for (const selector of closeSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isVisible();
                        if (isVisible) {
                            await button.click();
                            logger.info(`Dismissed popup using selector: ${selector}`);
                            await this.delay(500);
                            dismissed = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Continue to next selector
                    continue;
                }
            }

            if (!dismissed) {
                logger.debug('No popups found to dismiss');
            }

            return dismissed;
        } catch (error) {
            logger.warn('Error while checking for popups:', error.message);
            return false;
        }
    }

    /**
     * Navigate to new order form
     */
    async navigateToOrderForm() {
        try {
            logger.info('Navigating to new order form...');
            this.emitStatus('Opening new order form...');

            // Dismiss any popups/announcements first
            await this.dismissPopups();

            // First, click on Lab Orders tile
            const labOrdersTileSelectors = [
                'text="Lab Orders"',
                'h3:has-text("Lab Orders")',
                'div:has-text("Lab Orders")',
                '[aria-label*="Lab Orders"]',
                '.card:has-text("Lab Orders")',
                'button:has-text("Lab Orders")'
            ];

            let labOrdersClicked = false;
            for (const selector of labOrdersTileSelectors) {
                try {
                    const tile = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (tile) {
                        await tile.click();
                        labOrdersClicked = true;
                        logger.debug(`Clicked Lab Orders tile: ${selector}`);
                        await this.page.waitForLoadState('networkidle');
                        await this.delay(2000);

                        // Dismiss any popups that might have appeared after clicking
                        await this.dismissPopups();

                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!labOrdersClicked) {
                logger.warn('Could not find Lab Orders tile, attempting direct New Order button search...');
            }

            // Take screenshot to see where we are
            await this.takeScreenshot('after-lab-orders');
            logger.info('Now on patient search page...');

            // IMPORTANT: The "Create New Patient" button is disabled until we perform a search
            // We need to do a dummy search first to enable the button
            logger.info('Performing dummy patient search to enable Create New Patient button...');

            try {
                // Fill in dummy search data (any values will do)
                const lastNameField = await this.page.waitForSelector('input[name*="lastName"], input[id*="lastName"], input[placeholder*="Last Name"]', { timeout: 5000 });
                if (lastNameField) {
                    await lastNameField.fill('TestPatient');
                    logger.debug('Filled last name field with dummy data');
                }

                // Click the Search button
                const searchButton = await this.page.waitForSelector('button:has-text("Search")', { timeout: 3000 });
                if (searchButton) {
                    await searchButton.click();
                    logger.debug('Clicked Search button');
                    await this.delay(2000); // Wait for search to complete
                }
            } catch (e) {
                logger.warn('Could not perform dummy search, trying to click button anyway:', e.message);
            }

            // Now the "Create New Patient" button should be enabled
            logger.info('Looking for Create New Patient button (should now be enabled)...');

            let clicked = false;
            try {
                // Wait for the button to be clickable
                await this.delay(1000);

                // Try to find and click the button using getByText
                logger.debug('Searching for Create New Patient button with text matcher...');
                await this.page.getByText('Create New Patient', { exact: true }).click({ timeout: 5000 });
                clicked = true;
                logger.info('Successfully clicked Create New Patient button using exact text match');
            } catch (e) {
                logger.warn('Exact text match failed, trying alternative selectors...');

                // Fallback to other methods
                const createNewPatientSelectors = [
                    'button:text-is("Create New Patient")',
                    'button:text("Create New Patient")',
                    'a:text("Create New Patient")',
                    'button[type="button"]:has-text("Create New Patient")',
                    '[aria-label*="Create New Patient"]',
                ];

                for (const selector of createNewPatientSelectors) {
                    try {
                        const button = await this.page.waitForSelector(selector, { timeout: 3000 });
                        if (button) {
                            await button.click();
                            clicked = true;
                            logger.debug(`Clicked Create New Patient button: ${selector}`);
                            break;
                        }
                    } catch (e2) {
                        continue;
                    }
                }
            }

            if (!clicked) {
                throw new Error('Could not find Create New Patient button after performing search');
            }

            // Wait for page to load
            await this.page.waitForLoadState('networkidle');
            await this.delay(2000);

            // Take a screenshot to see what page we're on
            await this.takeScreenshot('03-after-lab-orders');

            // After clicking Lab Orders, we're on the patient search page
            // Click "Create New Patient" button to get to the order form
            logger.info('Now on patient search page, looking for Create New Patient button...');

            const createPatientSelectors = [
                'button:has-text("Create New Patient")',
                'a:has-text("Create New Patient")',
                '[aria-label*="Create New Patient"]',
                'text="Create New Patient"',
                // More specific selectors based on the UI
                '.MuiButton-root:has-text("Create New Patient")',
                '[class*="Button"]:has-text("Create New Patient")',
                '//button[contains(text(), "Create New Patient")]',
                '//a[contains(text(), "Create New Patient")]'
            ];

            let createPatientClicked = false;
            for (const selector of createPatientSelectors) {
                try {
                    // Use a longer timeout since the button might take time to appear
                    const button = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (button) {
                        // Make sure button is visible and clickable
                        await button.scrollIntoViewIfNeeded();
                        await this.delay(500);
                        await button.click();
                        createPatientClicked = true;
                        logger.debug(`Clicked Create New Patient button: ${selector}`);
                        await this.page.waitForLoadState('networkidle');
                        await this.delay(2000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!createPatientClicked) {
                // Try one more time with a more aggressive approach
                try {
                    // Look for any element containing the text
                    await this.page.click('text="Create New Patient"', { timeout: 5000 });
                    createPatientClicked = true;
                    logger.info('Clicked Create New Patient using text selector');
                    await this.page.waitForLoadState('networkidle');
                    await this.delay(2000);
                } catch (e) {
                    logger.warn('Could not find Create New Patient button after multiple attempts');
                }
            }

            await this.takeScreenshot('04-order-form');
            logger.info('Order form loaded');

            return true;
        } catch (error) {
            logger.error('Failed to navigate to order form:', error);
            throw error;
        }
    }

    /**
     * Fill patient information with Medicaid data enrichment
     */
    async fillPatientInfo(patientData) {
        try {
            logger.info('Filling patient information...');
            this.emitStatus('Entering patient details...');

            // CRITICAL: If patient has Medicaid info, get demographics from Medicaid X12 271
            // This ensures we use the EXACT address that Labcorp expects (from Medicaid)
            let enrichedPatientData = { ...patientData };

            if (patientData.medicaidId || patientData.useMedicaidData) {
                try {
                    logger.info('Fetching patient demographics from Utah Medicaid...');
                    this.emitStatus('Verifying Medicaid eligibility...');

                    const medicaidData = await medicaidEligibilityService.checkEligibility({
                        firstName: patientData.firstName,
                        lastName: patientData.lastName,
                        dateOfBirth: patientData.dateOfBirth,
                        medicaidId: patientData.medicaidId
                    });

                    if (medicaidData.isEligible && medicaidData.demographics) {
                        logger.info('Using Medicaid demographics for form population (prevents address corrections!)');

                        // Use Medicaid data - this is what Labcorp expects!
                        enrichedPatientData = {
                            ...patientData,
                            // Override with Medicaid's exact data
                            firstName: medicaidData.demographics.firstName || patientData.firstName,
                            lastName: medicaidData.demographics.lastName || patientData.lastName,
                            dateOfBirth: medicaidData.demographics.dateOfBirth || patientData.dateOfBirth,
                            medicaidId: medicaidData.medicaidId || patientData.medicaidId,
                            address: medicaidData.demographics.address || patientData.address,
                            // Flag that we're using Medicaid data
                            usingMedicaidDemographics: true
                        };

                        logger.info(`Medicaid address: ${medicaidData.demographics.address.street}, ${medicaidData.demographics.address.city}, ${medicaidData.demographics.address.state} ${medicaidData.demographics.address.zip}`);
                    } else {
                        logger.warn('Medicaid eligibility check returned no data - using provided patient data');
                    }
                } catch (medicaidError) {
                    logger.warn('Medicaid eligibility check failed - proceeding with provided data:', medicaidError.message);
                    // Continue with original data if Medicaid check fails
                }
            }

            // Update reference to use enriched data
            patientData = enrichedPatientData;

            // IMPORTANT: First select Bill Method (required field)
            logger.info('Selecting Bill Method...');
            const billMethodSelectors = [
                'select[name*="billMethod"]',
                'select[name*="BillMethod"]',
                'select[id*="billMethod"]',
                'select:has-option:has-text("Medicaid")',
                'div:has-text("Bill Method") + select',
                'label:has-text("Bill Method") ~ select'
            ];

            let billMethodDropdown = null;
            for (const selector of billMethodSelectors) {
                try {
                    billMethodDropdown = await this.page.$(selector);
                    if (billMethodDropdown) {
                        logger.debug(`Found Bill Method dropdown: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (billMethodDropdown) {
                // Determine bill method based on insurance
                const billMethod = insuranceHelper.isMedicaid(patientData.insuranceProvider) ? 'Medicaid' :
                                 insuranceHelper.isMedicare(patientData.insuranceProvider) ? 'Medicare' :
                                 'Client';

                logger.info(`Selecting Bill Method: ${billMethod}`);

                try {
                    // Try selecting by label first
                    await billMethodDropdown.selectOption({ label: billMethod });
                } catch (e) {
                    // If that fails, try by value
                    try {
                        await billMethodDropdown.selectOption({ value: billMethod });
                    } catch (e2) {
                        logger.warn(`Could not select bill method ${billMethod}, trying first available option`);
                        // Select first non-empty option as fallback
                        await billMethodDropdown.selectOption({ index: 1 });
                    }
                }

                await this.delay(500);
            } else {
                logger.warn('Could not find Bill Method dropdown - form may have changed');
            }

            // Fill new patient form
            logger.info('Filling patient information fields...');

            // Fill first name - look for input near "First Name" label
            const firstNameField = await this.page.locator('input').filter({ hasText: /^$/ }).first();
            const firstNameByLabel = await this.page.locator('label:has-text("First Name")').locator('..').locator('input').first();

            try {
                // Try to find by looking for the label
                const firstNameInput = await this.page.$$('input');
                for (const input of firstNameInput) {
                    const id = await input.getAttribute('id');
                    const name = await input.getAttribute('name');
                    const placeholder = await input.getAttribute('placeholder');

                    if ((name && name.toLowerCase().includes('first')) ||
                        (id && id.toLowerCase().includes('first')) ||
                        (placeholder && placeholder.toLowerCase().includes('first'))) {
                        await input.fill(patientData.firstName);
                        logger.debug(`Filled first name: ${patientData.firstName}`);
                        break;
                    }
                }
            } catch (e) {
                logger.warn('Could not fill first name:', e.message);
            }

            // Fill last name
            try {
                const lastNameInput = await this.page.$$('input');
                for (const input of lastNameInput) {
                    const id = await input.getAttribute('id');
                    const name = await input.getAttribute('name');
                    const placeholder = await input.getAttribute('placeholder');

                    if ((name && name.toLowerCase().includes('last')) ||
                        (id && id.toLowerCase().includes('last')) ||
                        (placeholder && placeholder.toLowerCase().includes('last'))) {
                        await input.fill(patientData.lastName);
                        logger.debug(`Filled last name: ${patientData.lastName}`);
                        break;
                    }
                }
            } catch (e) {
                logger.warn('Could not fill last name:', e.message);
            }

            // Fill date of birth
            try {
                const dobInput = await this.page.$$('input');
                for (const input of dobInput) {
                    const id = await input.getAttribute('id');
                    const name = await input.getAttribute('name');
                    const placeholder = await input.getAttribute('placeholder');

                    if ((name && (name.toLowerCase().includes('birth') || name.toLowerCase().includes('dob'))) ||
                        (id && (id.toLowerCase().includes('birth') || id.toLowerCase().includes('dob'))) ||
                        (placeholder && (placeholder.toLowerCase().includes('mm/dd/yyyy') || placeholder.toLowerCase().includes('birth')))) {
                        // Format date as MM/DD/YYYY if needed
                        let formattedDate = patientData.dateOfBirth;
                        if (patientData.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const [year, month, day] = patientData.dateOfBirth.split('-');
                            formattedDate = `${month}/${day}/${year}`;
                        }
                        await input.fill(formattedDate);
                        logger.debug(`Filled date of birth: ${formattedDate}`);
                        break;
                    }
                }
            } catch (e) {
                logger.warn('Could not fill DOB:', e.message);
            }

            // Fill gender dropdown
            try {
                const genderSelect = await this.page.$$('select');
                for (const select of genderSelect) {
                    const id = await select.getAttribute('id');
                    const name = await select.getAttribute('name');

                    if ((name && name.toLowerCase().includes('gender')) ||
                        (id && id.toLowerCase().includes('gender'))) {
                        const gender = patientData.gender || 'Male';
                        await select.selectOption({ label: gender });
                        logger.debug(`Selected gender: ${gender}`);
                        break;
                    }
                }
            } catch (e) {
                logger.warn('Could not fill gender:', e.message);
            }

            // Fill address (CRITICAL: Use Medicaid address if available!)
            if (patientData.address) {
                // Street address
                try {
                    const addressInputs = await this.page.$$('input');
                    for (const input of addressInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const placeholder = await input.getAttribute('placeholder');

                        if ((name && (name.toLowerCase().includes('address') || name.toLowerCase().includes('street'))) ||
                            (id && (id.toLowerCase().includes('address') || id.toLowerCase().includes('street'))) ||
                            (placeholder && placeholder.toLowerCase().includes('address'))) {
                            if (patientData.address.street) {
                                await input.fill(patientData.address.street);
                                logger.debug(`Filled address: ${patientData.address.street}`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill address:', e.message);
                }

                // City
                try {
                    const cityInputs = await this.page.$$('input');
                    for (const input of cityInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const placeholder = await input.getAttribute('placeholder');

                        if ((name && name.toLowerCase().includes('city')) ||
                            (id && id.toLowerCase().includes('city')) ||
                            (placeholder && placeholder.toLowerCase().includes('city'))) {
                            if (patientData.address.city) {
                                await input.fill(patientData.address.city);
                                logger.debug(`Filled city: ${patientData.address.city}`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill city:', e.message);
                }

                // State
                try {
                    const stateSelects = await this.page.$$('select');
                    for (const select of stateSelects) {
                        const id = await select.getAttribute('id');
                        const name = await select.getAttribute('name');

                        if ((name && name.toLowerCase().includes('state')) ||
                            (id && id.toLowerCase().includes('state'))) {
                            if (patientData.address.state) {
                                await select.selectOption({ label: patientData.address.state });
                                logger.debug(`Filled state: ${patientData.address.state}`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill state:', e.message);
                }

                // ZIP code
                try {
                    const zipInputs = await this.page.$$('input');
                    for (const input of zipInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const placeholder = await input.getAttribute('placeholder');

                        if ((name && (name.toLowerCase().includes('zip') || name.toLowerCase().includes('postal'))) ||
                            (id && (id.toLowerCase().includes('zip') || id.toLowerCase().includes('postal'))) ||
                            (placeholder && placeholder.toLowerCase().includes('postal'))) {
                            if (patientData.address.zip) {
                                await input.fill(patientData.address.zip);
                                logger.debug(`Filled ZIP: ${patientData.address.zip}`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill ZIP:', e.message);
                }

                if (patientData.usingMedicaidDemographics) {
                    logger.info('✅ Used Medicaid address data - should prevent address correction prompts!');
                }
            }

            // Fill phone if provided
            if (patientData.phone) {
                try {
                    const phoneInputs = await this.page.$$('input');
                    for (const input of phoneInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const type = await input.getAttribute('type');

                        if ((name && name.toLowerCase().includes('phone')) ||
                            (id && id.toLowerCase().includes('phone')) ||
                            type === 'tel') {
                            await input.fill(patientData.phone);
                            logger.debug(`Filled phone: ${patientData.phone}`);
                            break;
                        }
                    }

                    // Also fill Phone Type dropdown
                    const phoneTypeSelects = await this.page.$$('select');
                    for (const select of phoneTypeSelects) {
                        const id = await select.getAttribute('id');
                        const name = await select.getAttribute('name');

                        if ((name && name.toLowerCase().includes('phonetype')) ||
                            (id && id.toLowerCase().includes('phonetype'))) {
                            // Try different phone type options
                            try {
                                await select.selectOption({ label: 'Mobile' });
                                logger.debug('Selected phone type: Mobile');
                            } catch (e) {
                                try {
                                    await select.selectOption({ label: 'Home' });
                                    logger.debug('Selected phone type: Home');
                                } catch (e2) {
                                    try {
                                        await select.selectOption({ label: 'Cell' });
                                        logger.debug('Selected phone type: Cell');
                                    } catch (e3) {
                                        logger.warn('Could not select phone type');
                                    }
                                }
                            }
                            break;
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill phone:', e.message);
                }
            }

            // Handle Phone Usage dropdown if visible
            try {
                const phoneUsageSelects = await this.page.$$('select');
                for (const select of phoneUsageSelects) {
                    const id = await select.getAttribute('id');
                    const name = await select.getAttribute('name');

                    if ((name && name.toLowerCase().includes('phoneusage')) ||
                        (id && id.toLowerCase().includes('phoneusage'))) {
                        try {
                            // Try to select "Landline" or first available option
                            await select.selectOption({ index: 1 }); // Skip "Select" and pick first real option
                            logger.debug('Selected phone usage (index 1)');
                        } catch (e) {
                            logger.warn('Could not select phone usage');
                        }
                        break;
                    }
                }
            } catch (e) {
                logger.warn('Could not fill phone usage:', e.message);
            }

            await this.delay(500);

            // Handle insurance information with intelligent helper
            // This section fills the Insurance Information/Responsible Party form at the bottom
            if (patientData.insuranceProvider || patientData.medicaidId || patientData.medicareId) {
                logger.info('Processing insurance information section...');

                // Determine insurance type and billing method
                const isMedicaid = insuranceHelper.isMedicaid(patientData.insuranceProvider);
                const isMedicare = insuranceHelper.isMedicare(patientData.insuranceProvider);
                const billMethod = insuranceHelper.getBillMethod(patientData.insuranceProvider);
                const payorCode = insuranceHelper.getPayorCode(patientData.insuranceProvider);

                logger.info(`Insurance: ${patientData.insuranceProvider}, Bill Method: ${billMethod}, Payor Code: ${payorCode}`);

                // For Medicaid, we need to fill: Payor Code, Insurance Name, Insurance ID
                // First, let's find and fill the Payor Code input (typically labeled "Enter Payor Code")
                try {
                    const payorCodeInputs = await this.page.$$('input');
                    for (const input of payorCodeInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const placeholder = await input.getAttribute('placeholder');

                        if ((name && name.toLowerCase().includes('payor')) ||
                            (id && id.toLowerCase().includes('payor')) ||
                            (placeholder && placeholder.toLowerCase().includes('payor'))) {
                            if (payorCode) {
                                await input.fill(payorCode);
                                logger.info(`Filled payor code: ${payorCode}`);
                                await this.delay(500);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill payor code:', e.message);
                }

                // Fill Insurance Name
                try {
                    const insuranceNameInputs = await this.page.$$('input');
                    for (const input of insuranceNameInputs) {
                        const id = await input.getAttribute('id');
                        const name = await input.getAttribute('name');
                        const placeholder = await input.getAttribute('placeholder');

                        if ((name && name.toLowerCase().includes('insurancename')) ||
                            (id && id.toLowerCase().includes('insurancename'))) {
                            if (patientData.insuranceProvider) {
                                await input.fill(patientData.insuranceProvider);
                                logger.info(`Filled insurance name: ${patientData.insuranceProvider}`);
                                await this.delay(500);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill insurance name:', e.message);
                }

                // Fill Insurance ID (member ID)
                const insuranceId = patientData.medicaidId || patientData.medicareId || patientData.insuranceId;
                if (insuranceId) {
                    try {
                        const insuranceIdInputs = await this.page.$$('input');
                        for (const input of insuranceIdInputs) {
                            const id = await input.getAttribute('id');
                            const name = await input.getAttribute('name');

                            if ((name && (name.toLowerCase().includes('insuranceid') || name.toLowerCase().includes('memberid'))) ||
                                (id && (id.toLowerCase().includes('insuranceid') || id.toLowerCase().includes('memberid')))) {
                                await input.fill(insuranceId);
                                logger.info(`Filled insurance ID: ${insuranceId}`);
                                await this.delay(500);
                                break;
                            }
                        }
                    } catch (e) {
                        logger.warn('Could not fill insurance ID:', e.message);
                    }
                }

                // Fill Responsible Party (typically defaults to "Self")
                try {
                    const responsiblePartySelects = await this.page.$$('select');
                    for (const select of responsiblePartySelects) {
                        const id = await select.getAttribute('id');
                        const name = await select.getAttribute('name');

                        if ((name && name.toLowerCase().includes('relationship')) ||
                            (id && id.toLowerCase().includes('relationship'))) {
                            try {
                                await select.selectOption({ label: 'Self' });
                                logger.info('Selected responsible party: Self');
                            } catch (e) {
                                // Try index 1 if "Self" not found
                                try {
                                    await select.selectOption({ index: 1 });
                                    logger.debug('Selected responsible party by index');
                                } catch (e2) {
                                    logger.warn('Could not select responsible party');
                                }
                            }
                            break;
                        }
                    }
                } catch (e) {
                    logger.warn('Could not fill responsible party:', e.message);
                }
            }

            await this.takeScreenshot('05-patient-info-filled');
            logger.info('Patient information filled');

            // Click the Confirm button to proceed to next step
            logger.info('Clicking Confirm to proceed to order form...');
            const confirmButtonSelectors = [
                'button:has-text("Confirm")',
                'button:has-text("Save & Create Order")',
                'button:has-text("Continue")',
                'button:has-text("Next")',
                'button[type="button"]:has-text("Confirm")',
                '.btn-primary:has-text("Confirm")'
            ];

            let confirmButton = null;
            for (const selector of confirmButtonSelectors) {
                try {
                    confirmButton = await this.page.$(selector);
                    if (confirmButton) {
                        const isVisible = await confirmButton.isVisible();
                        if (isVisible) {
                            logger.debug(`Found confirm button: ${selector}`);
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            if (confirmButton) {
                await confirmButton.click();
                logger.info('Clicked Confirm button');

                // Wait for validation
                await this.delay(3000);

                // Dismiss any popups that might appear
                await this.dismissPopups();

                await this.takeScreenshot('06-after-confirm');

                // Check for address validation dialog or confirmation button
                // If address validation appears, we may need to click Confirm again
                const secondConfirmSelectors = [
                    'button:has-text("Confirm")',
                    'button:has-text("Yes")',
                    'button:has-text("Continue")',
                    'button:has-text("Accept")'
                ];

                logger.info('Checking for address validation confirmation...');
                let secondConfirmButton = null;
                for (const selector of secondConfirmSelectors) {
                    try {
                        secondConfirmButton = await this.page.$(selector);
                        if (secondConfirmButton) {
                            const isVisible = await secondConfirmButton.isVisible();
                            if (isVisible) {
                                logger.info(`Found address confirmation button: ${selector}`);
                                await secondConfirmButton.click();
                                logger.info('Clicked address confirmation button');
                                await this.delay(2000);
                                await this.dismissPopups();
                                await this.takeScreenshot('06b-after-second-confirm');
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                // Check if there are validation errors visible
                const validationErrors = await this.page.$$('text=/Address entered is not a valid address/i');
                if (validationErrors && validationErrors.length > 0) {
                    logger.warn(`Found ${validationErrors.length} address validation errors - form may not proceed`);
                    logger.warn('Attempting to proceed anyway...');
                }

                // Now click "Save & Create Order" to proceed to Order Details page
                logger.info('Looking for Save & Create Order button...');
                const saveAndCreateSelectors = [
                    'button:has-text("Save & Create Order")',
                    'button:has-text("Save and Create Order")',
                    'button:has-text("Create Order")',
                    '.btn-primary:has-text("Save")',
                    'button[type="button"]:has-text("Save & Create")'
                ];

                let saveButton = null;
                for (const selector of saveAndCreateSelectors) {
                    try {
                        saveButton = await this.page.$(selector);
                        if (saveButton) {
                            const isVisible = await saveButton.isVisible();
                            const isEnabled = await saveButton.isEnabled();
                            if (isVisible && isEnabled) {
                                logger.debug(`Found Save & Create Order button: ${selector} (enabled: ${isEnabled})`);
                                break;
                            } else if (isVisible && !isEnabled) {
                                logger.warn(`Save & Create Order button is disabled - validation errors may exist`);
                                saveButton = null; // Don't try to click disabled button
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (saveButton) {
                    await saveButton.click();
                    logger.info('Clicked Save & Create Order button');

                    // Wait for Order Details page to load
                    await this.page.waitForLoadState('networkidle');
                    await this.delay(3000);

                    // Dismiss any popups
                    await this.dismissPopups();

                    await this.takeScreenshot('07-order-details-page');
                    logger.info('Now on Order Details page');
                } else {
                    logger.warn('Could not find enabled Save & Create Order button - form validation may have failed');
                    logger.warn('Check screenshot 06-after-confirm to see validation errors');
                }
            } else {
                logger.warn('Could not find Confirm button - may need to manually proceed');
            }

            return true;
        } catch (error) {
            logger.error('Failed to fill patient info:', error);
            throw error;
        }
    }

    /**
     * Select provider (required field)
     */
    async selectProvider(providerName) {
        try {
            logger.info('Selecting provider...');
            this.emitStatus('Selecting ordering provider...');

            // Find provider dropdown - it's usually a button/dropdown combo
            const providerSelectors = [
                'button:has-text("Select A Provider")',
                'div:has-text("Select A Provider") >> button',
                '[aria-label*="provider"] >> button',
                'button[aria-haspopup="listbox"]',
                'select:has-text("Select A Provider")',
                'select[id*="provider"]',
                'select[name*="provider"]'
            ];

            let providerDropdown = null;
            for (const selector of providerSelectors) {
                try {
                    providerDropdown = await this.page.$(selector);
                    if (providerDropdown) {
                        logger.debug(`Found provider dropdown: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Some selectors might fail, continue to next
                    continue;
                }
            }

            if (!providerDropdown) {
                logger.warn('Could not find provider dropdown with standard selectors');
                // Try a more specific search for the Provider Information section
                const providerSection = await this.page.$('text="Provider Information"');
                if (providerSection) {
                    // Look for any button in that section
                    providerDropdown = await this.page.$('text="Provider Information" >> .. >> button');
                    if (providerDropdown) {
                        logger.debug('Found provider dropdown in Provider Information section');
                    }
                }

                if (!providerDropdown) {
                    logger.warn('Could not find provider dropdown - may already be selected or missing');
                    return true;
                }
            }

            // Try to select first available provider
            const tagName = await providerDropdown.evaluate(el => el.tagName.toLowerCase());

            if (tagName === 'select') {
                // It's a regular select dropdown
                const options = await providerDropdown.$$('option');
                if (options.length > 1) {
                    // Select the first real provider (skip the placeholder at index 0)
                    await providerDropdown.selectOption({ index: 1 });
                    logger.info('Selected first available provider from select');
                    await this.delay(1000);
                } else {
                    logger.warn('No provider options available in dropdown');
                }
            } else if (tagName === 'button') {
                // It's a custom dropdown button - click to open
                await providerDropdown.click();
                await this.delay(1500);

                // Check if it opened a search form instead of a dropdown
                // Look for the NPI field in the Provider Information section
                const npiField = await this.page.$('text="Provider\'s NPI" >> .. >> input, input[id*="npi"], input[name*="npi"], label:has-text("NPI") >> .. >> input');
                if (npiField) {
                    // It's a provider search form - use NPI to search
                    logger.info('Found provider search form - searching by NPI');

                    // Use the provider NPI from config or a default
                    // Type 1 (individual provider) NPI required, not Type 2 (organization)
                    const providerNPI = providerName || '1023711348'; // Dr. Sweeney's NPI

                    await npiField.fill(providerNPI);
                    await this.delay(500);

                    // Click the Search button
                    const searchButton = await this.page.$('button:has-text("Search")');
                    if (searchButton) {
                        await searchButton.click();
                        logger.info('Clicked Search button for provider');

                        // Wait for the fields to auto-populate (no need to click anything)
                        await this.delay(3000);
                        logger.info('Waiting for provider fields to auto-populate from NPI search');

                        // Check if Last Name field got populated
                        const lastNameField = await this.page.$('input[name*="lastName"], input[id*="lastName"], label:has-text("Last Name") >> .. >> input');
                        if (lastNameField) {
                            const lastNameValue = await lastNameField.inputValue();
                            if (lastNameValue && lastNameValue.length > 0) {
                                logger.info(`Provider fields auto-populated successfully. Last Name: ${lastNameValue}`);
                            } else {
                                logger.warn('Last Name field still empty after search - NPI may not have returned results');
                            }
                        }

                        // Now click Confirm/Add Provider to finalize
                        const confirmButton = await this.page.$('button:has-text("Confirm/Add Provider"), button:has-text("Confirm"), button:has-text("Add Provider")');
                        if (confirmButton) {
                            await confirmButton.click();
                            logger.info('Clicked Confirm/Add Provider button to finalize');
                            await this.delay(2000);
                        } else {
                            logger.warn('Could not find Confirm/Add Provider button');
                            await this.takeScreenshot('provider-no-confirm-button');
                        }
                    } else {
                        logger.warn('Could not find Search button');
                    }
                } else {
                    // Look for provider options in dropdown
                    const optionSelectors = [
                        'li[role="option"]',
                        'div[role="option"]',
                        '[data-value]',
                        'li.dropdown-item',
                        'div.dropdown-item'
                    ];

                    let options = [];
                    for (const selector of optionSelectors) {
                        options = await this.page.$$(selector);
                        if (options.length > 0) {
                            logger.debug(`Found ${options.length} provider options with selector: ${selector}`);
                            break;
                        }
                    }

                    if (options.length > 0) {
                        // Click the first option (should be first real provider)
                        await options[0].click();
                        logger.info('Selected first available provider from custom dropdown');
                        await this.delay(1000);
                    } else {
                        logger.warn('Opened provider dropdown but could not find options or search form');
                        await this.takeScreenshot('error-provider-dropdown-open');
                    }
                }
            } else {
                logger.warn(`Unexpected provider element type: ${tagName}`);
            }

            await this.takeScreenshot('05a-provider-selected');
            return true;
        } catch (error) {
            logger.error('Failed to select provider:', error);
            // Don't throw - this is not critical enough to stop the whole flow
            return false;
        }
    }

    /**
     * Select lab tests
     */
    async selectTests(tests) {
        try {
            logger.info(`Selecting ${tests.length} tests...`);
            this.emitStatus(`Adding ${tests.length} lab tests...`);

            // First, check if we're on the Patient Details page and need to click "Create New Order"
            const createNewOrderButton = await this.page.$('button:has-text("Create New Order")');
            if (createNewOrderButton) {
                logger.info('Found "Create New Order" button - clicking to navigate to Order Details page...');
                await createNewOrderButton.click();
                await this.page.waitForLoadState('networkidle');
                await this.delay(2000);
                await this.dismissPopups();
                await this.takeScreenshot('08-after-create-new-order');
                logger.info('Navigated to Order Details page');
            }

            // Select provider first (required field)
            await this.selectProvider();

            // Find test search/selection field - updated based on actual UI
            const testSelectors = [
                'input[placeholder*="Enter Test Number or Test Name"]',
                'input[placeholder*="Test Number"]',
                'input[placeholder*="Test Name"]',
                'input[placeholder*="test"]',
                'input[placeholder*="Test"]',
                'input[aria-label*="test"]',
                'input[name*="test"]'
            ];

            let testField = null;
            for (const selector of testSelectors) {
                testField = await this.page.$(selector);
                if (testField) {
                    logger.debug(`Found test field: ${selector}`);
                    break;
                }
            }

            if (!testField) {
                // Log current URL and page title for debugging
                const currentUrl = this.page.url();
                const pageTitle = await this.page.title();
                logger.error(`Could not find test selection field. Current URL: ${currentUrl}, Title: ${pageTitle}`);
                await this.takeScreenshot('error-no-test-field');
                throw new Error('Could not find test selection field');
            }

            // Add each test
            for (const test of tests) {
                await testField.fill(test.name || test.code);
                await this.delay(1000);

                // Look for autocomplete suggestion
                const suggestion = await this.page.$(`text="${test.name}"`);
                if (suggestion) {
                    await suggestion.click();
                } else {
                    // Try pressing enter if no suggestion
                    await this.page.keyboard.press('Enter');
                }

                await this.delay(500);
                logger.debug(`Added test: ${test.name}`);
            }

            await this.takeScreenshot('06-tests-selected');
            logger.info(`Successfully selected ${tests.length} tests`);

            return true;
        } catch (error) {
            logger.error('Failed to select tests:', error);
            throw error;
        }
    }

    /**
     * Add diagnosis codes
     */
    async addDiagnosisCodes(codes) {
        try {
            if (!codes || codes.length === 0) {
                logger.info('No diagnosis codes to add');
                return true;
            }

            logger.info(`Adding ${codes.length} diagnosis codes...`);
            this.emitStatus('Adding diagnosis codes...');

            // Find diagnosis field - updated based on actual UI
            const diagnosisSelectors = [
                'input[placeholder*="Find by Diagnosis Code or Name"]',
                'input[placeholder*="Diagnosis Code"]',
                'input[placeholder*="diagnosis"]',
                'input[placeholder*="ICD"]',
                'input[name*="diagnosis"]',
                'input[name*="icd"]'
            ];

            let diagnosisField = null;
            for (const selector of diagnosisSelectors) {
                diagnosisField = await this.page.$(selector);
                if (diagnosisField) {
                    logger.debug(`Found diagnosis field: ${selector}`);
                    break;
                }
            }

            if (!diagnosisField) {
                logger.warn('Could not find diagnosis field - skipping');
                return true;
            }

            // Enter each diagnosis code separately (one at a time)
            for (let i = 0; i < codes.length; i++) {
                const code = codes[i];

                // Clear the field and enter the code
                await diagnosisField.fill(code);
                await this.delay(1000);

                // Look for autocomplete suggestion or press Enter
                const suggestion = await this.page.$(`text="${code}"`);
                if (suggestion) {
                    await suggestion.click();
                    logger.debug(`Selected diagnosis code from dropdown: ${code}`);
                } else {
                    await this.page.keyboard.press('Enter');
                    logger.debug(`Entered diagnosis code: ${code}`);
                }

                await this.delay(500);

                // If there are more codes, find the field again (it might have changed)
                if (i < codes.length - 1) {
                    await this.delay(500);
                    diagnosisField = await this.page.$(diagnosisSelectors[0]);
                    if (!diagnosisField) {
                        logger.warn(`Could not find diagnosis field for code ${i + 2}`);
                        break;
                    }
                }
            }

            logger.info(`Added diagnosis codes: ${codes.join(', ')}`);
            return true;
        } catch (error) {
            logger.error('Failed to add diagnosis codes:', error);
            throw error;
        }
    }

    /**
     * Validate order before submission
     */
    async validateOrder() {
        try {
            logger.info('Validating order...');
            this.emitStatus('Validating order details...');

            // First, handle the Workmans Comp dropdown (if present)
            const workmansCompSelectors = [
                'select:has-text("Workmans Comp")',
                'label:has-text("Workmans Comp") >> .. >> select',
                'select[id*="workman"], select[id*="comp"]',
                'div:has-text("Workmans Comp") >> select'
            ];

            for (const selector of workmansCompSelectors) {
                const workmansCompDropdown = await this.page.$(selector);
                if (workmansCompDropdown) {
                    logger.info('Found Workmans Comp dropdown, selecting "No"');
                    await workmansCompDropdown.selectOption({ label: 'No' });
                    await this.delay(500);
                    logger.debug('Selected "No" for Workmans Comp');
                    break;
                }
            }

            // Look for Validate button
            const validateSelectors = [
                'button:has-text("Validate")',
                'button[type="button"]:has-text("Validate")',
                '[aria-label*="Validate"]',
                'button.btn-primary:has-text("Validate")'
            ];

            let validateButton = null;
            for (const selector of validateSelectors) {
                validateButton = await this.page.$(selector);
                if (validateButton) {
                    logger.debug(`Found validate button: ${selector}`);
                    break;
                }
            }

            if (!validateButton) {
                logger.warn('Could not find Validate button, proceeding without validation');
                return false;
            }

            // Click validate
            await validateButton.click();
            logger.info('Clicked Validate button');

            // Wait for validation to complete
            await this.page.waitForLoadState('networkidle');
            await this.delay(3000);

            // Check for validation errors
            const errorElement = await this.page.$('.error, .alert-danger, [role="alert"]');
            if (errorElement) {
                const errorText = await errorElement.textContent();
                logger.warn(`Validation warning/error: ${errorText}`);
            }

            // Take screenshot after validation
            await this.takeScreenshot('06-order-validated');

            return true;
        } catch (error) {
            logger.error('Failed to validate order:', error);
            return false;
        }
    }

    /**
     * Preview order before submission
     */
    async previewOrder() {
        try {
            logger.info('Generating order preview...');
            this.emitStatus('Generating preview...');

            await this.delay(2000); // Let form fully render

            const screenshotPath = await this.takeScreenshot('order-preview', true);

            // Update order status to preview (if Supabase is available)
            try {
                await updateOrderStatus(this.orderId, 'preview', {
                    preview_screenshot_url: screenshotPath
                });
            } catch (dbError) {
                logger.warn('Could not update order status (Supabase not available):', dbError.message);
            }

            logger.info('Order preview generated');
            this.emitStatus('Preview ready - awaiting confirmation');

            return screenshotPath;
        } catch (error) {
            logger.error('Failed to generate preview:', error);
            throw error;
        }
    }

    /**
     * Submit order (after preview confirmation)
     */
    async submitOrder() {
        try {
            logger.info('Submitting order to Labcorp...');
            this.emitStatus('Submitting order...');

            // Find submit button
            const submitSelectors = [
                'button:has-text("Create Order")',
                'button:has-text("Submit")',
                'button:has-text("Place Order")',
                'button:has-text("Send Order")',
                'button[type="submit"]'
            ];

            let submitButton = null;
            for (const selector of submitSelectors) {
                submitButton = await this.page.$(selector);
                if (submitButton) break;
            }

            if (!submitButton) {
                throw new Error('Could not find submit button');
            }

            // Click submit
            await submitButton.click();

            // Wait for confirmation
            await this.page.waitForLoadState('networkidle');
            await this.delay(3000);

            // Look for confirmation number
            const confirmationNumber = await this.extractConfirmationNumber();

            if (confirmationNumber) {
                logger.info(`Order submitted successfully: ${confirmationNumber}`);

                const finalScreenshot = await this.takeScreenshot('order-confirmation', true);

                // Update order status (if Supabase is available)
                try {
                    await updateOrderStatus(this.orderId, 'completed', {
                        confirmation_number: confirmationNumber,
                        final_screenshot_url: finalScreenshot,
                        submitted_at: new Date().toISOString()
                    });
                } catch (dbError) {
                    logger.warn('Could not update order status (Supabase not available):', dbError.message);
                }

                this.emitStatus(`Order submitted - Confirmation: ${confirmationNumber}`);

                return {
                    success: true,
                    confirmationNumber,
                    screenshotUrl: finalScreenshot
                };
            } else {
                throw new Error('Order submitted but no confirmation number received');
            }
        } catch (error) {
            logger.error('Failed to submit order:', error);
            throw error;
        }
    }

    /**
     * Extract confirmation number from page
     */
    async extractConfirmationNumber() {
        try {
            // Look for confirmation number patterns
            const confirmationSelectors = [
                'text=/\\d{6,}/',  // 6+ digit number
                'text=/Order.*\\d{6,}/',
                'text=/Confirmation.*\\d{6,}/',
                '[class*="confirmation"]',
                '[id*="confirmation"]'
            ];

            for (const selector of confirmationSelectors) {
                const element = await this.page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    const match = text.match(/\d{6,}/);
                    if (match) {
                        return match[0];
                    }
                }
            }

            // Try getting all text and looking for patterns
            const pageText = await this.page.textContent('body');
            const patterns = [
                /Order #(\d{6,})/,
                /Confirmation: (\d{6,})/,
                /Reference: (\d{6,})/
            ];

            for (const pattern of patterns) {
                const match = pageText.match(pattern);
                if (match) {
                    return match[1];
                }
            }

            return null;
        } catch (error) {
            logger.error('Failed to extract confirmation number:', error);
            return null;
        }
    }

    /**
     * Process full order with preview mode
     */
    async processOrder(orderData) {
        this.orderId = orderData.id;
        const startTime = Date.now();

        try {
            await this.initialize();

            // Log automation start
            await logAutomation({
                portalOrderId: this.orderId,
                action: 'order_processing_started',
                status: 'in_progress',
                details: { portal: this.portal }
            });

            // Login
            await this.login();

            // Navigate to order form
            await this.navigateToOrderForm();

            // Fill order details
            await this.fillPatientInfo(orderData.patient);
            await this.selectTests(orderData.tests);
            await this.addDiagnosisCodes(orderData.diagnosisCodes);

            // Generate preview
            const previewPath = await this.previewOrder();

            // If preview mode is enabled, stop here and wait for confirmation
            if (this.previewMode) {
                logger.info('Preview mode - waiting for user confirmation');
                return {
                    success: true,
                    status: 'preview',
                    previewUrl: previewPath,
                    message: 'Order preview ready for confirmation'
                };
            } else {
                // Auto-submit if preview mode is disabled
                return await this.submitOrder();
            }

        } catch (error) {
            logger.error('Order processing failed:', error);

            // Update order status
            await updateOrderStatus(this.orderId, 'failed', {
                error_message: error.message,
                retry_count: orderData.retry_count + 1
            });

            // Create notification
            await createNotification({
                portalOrderId: this.orderId,
                type: 'error',
                title: 'Labcorp Order Failed',
                message: `Failed to process order: ${error.message}`
            });

            // Log failure
            await logAutomation({
                portalOrderId: this.orderId,
                action: 'order_processing_failed',
                status: 'failed',
                errorMessage: error.message,
                durationMs: Date.now() - startTime
            });

            // Send email notification to CMO with all order details
            try {
                logger.info('Sending failure notification email to CMO...');

                await emailNotificationService.sendAutomationFailureNotification({
                    providerName: orderData.providerName || 'Unknown Provider',
                    patientData: orderData.patient,
                    tests: orderData.tests,
                    diagnoses: orderData.diagnosisCodes || [],
                    errorMessage: error.message,
                    screenshotUrl: orderData.lastScreenshot || null,
                    timestamp: new Date().toLocaleString()
                });

                logger.info('✅ Failure notification email sent to CMO');
            } catch (emailError) {
                logger.error('Failed to send failure notification email:', emailError);
                // Don't throw - we already have the main error
            }

            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Confirm and submit a previewed order
     */
    async confirmOrder(orderId) {
        this.orderId = orderId;

        try {
            // Page should still be open with filled form
            if (!this.page) {
                throw new Error('Order session expired - please restart order');
            }

            const result = await this.submitOrder();
            return result;
        } catch (error) {
            logger.error('Failed to confirm order:', error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Utility functions
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async takeScreenshot(name, returnPath = false) {
        try {
            const filename = `labcorp-${this.orderId}-${name}-${Date.now()}.png`;
            const filepath = path.join(this.screenshotPath, filename);

            await this.page.screenshot({ path: filepath, fullPage: true });
            logger.debug(`Screenshot saved: ${filename}`);

            if (returnPath) {
                return `/screenshots/${filename}`;
            }
            return filename;
        } catch (error) {
            logger.error('Failed to take screenshot:', error);
            return null;
        }
    }

    emitStatus(status) {
        if (this.io && this.orderId) {
            this.io.to(`order-${this.orderId}`).emit('order-status', {
                orderId: this.orderId,
                portal: this.portal,
                status,
                timestamp: new Date().toISOString()
            });
        }
    }

    async cleanup() {
        try {
            if (this.page) await this.page.close();
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
        } catch (error) {
            logger.error('Cleanup error:', error);
        }
    }
}

module.exports = LabcorpAgent;