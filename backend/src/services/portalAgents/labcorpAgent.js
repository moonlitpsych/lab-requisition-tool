// Labcorp Link Portal Automation Agent
// Handles automated order submission to Labcorp Link with preview mode

const { chromium } = require('playwright');
const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const { getLLMHelper } = require('./llmHelper');
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
     * Navigate to new order form
     */
    async navigateToOrderForm() {
        try {
            logger.info('Navigating to new order form...');
            this.emitStatus('Opening new order form...');

            // Look for New Order button
            const newOrderSelectors = [
                'button:has-text("New Order")',
                'a:has-text("New Order")',
                'button:has-text("Create Order")',
                'a:has-text("Create Order")',
                '[aria-label*="New Order"]'
            ];

            let clicked = false;
            for (const selector of newOrderSelectors) {
                try {
                    const button = await this.page.waitForSelector(selector, { timeout: 3000 });
                    if (button) {
                        await button.click();
                        clicked = true;
                        logger.debug(`Clicked: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!clicked) {
                throw new Error('Could not find New Order button');
            }

            // Wait for order form to load
            await this.page.waitForLoadState('networkidle');
            await this.delay(2000);

            await this.takeScreenshot('04-order-form');
            logger.info('Order form loaded');

            return true;
        } catch (error) {
            logger.error('Failed to navigate to order form:', error);
            throw error;
        }
    }

    /**
     * Fill patient information
     */
    async fillPatientInfo(patientData) {
        try {
            logger.info('Filling patient information...');
            this.emitStatus('Entering patient details...');

            // First check if we need to search for existing patient
            const searchSelectors = [
                'input[placeholder*="patient"]',
                'input[placeholder*="Patient"]',
                'input[name*="patient"]',
                'input[aria-label*="patient"]'
            ];

            let searchField = null;
            for (const selector of searchSelectors) {
                searchField = await this.page.$(selector);
                if (searchField) break;
            }

            if (searchField) {
                // Try searching for existing patient first
                await searchField.fill(`${patientData.lastName}, ${patientData.firstName}`);
                await this.delay(1000);
                await this.page.keyboard.press('Enter');
                await this.delay(2000);

                // Check if patient was found
                const patientFound = await this.page.$(`text=${patientData.lastName}`);
                if (patientFound) {
                    await patientFound.click();
                    logger.info('Selected existing patient');
                    return true;
                }
            }

            // If not found or no search, fill new patient form
            logger.info('Creating new patient record...');

            // Fill first name
            const firstNameSelectors = [
                'input[name*="first"]',
                'input[placeholder*="First"]',
                'input[aria-label*="First Name"]'
            ];

            for (const selector of firstNameSelectors) {
                const field = await this.page.$(selector);
                if (field) {
                    await field.fill(patientData.firstName);
                    break;
                }
            }

            // Fill last name
            const lastNameSelectors = [
                'input[name*="last"]',
                'input[placeholder*="Last"]',
                'input[aria-label*="Last Name"]'
            ];

            for (const selector of lastNameSelectors) {
                const field = await this.page.$(selector);
                if (field) {
                    await field.fill(patientData.lastName);
                    break;
                }
            }

            // Fill date of birth
            const dobSelectors = [
                'input[type="date"]',
                'input[name*="birth"]',
                'input[name*="dob"]',
                'input[placeholder*="DOB"]'
            ];

            for (const selector of dobSelectors) {
                const field = await this.page.$(selector);
                if (field) {
                    await field.fill(patientData.dateOfBirth);
                    break;
                }
            }

            // Fill phone if provided
            if (patientData.phone) {
                const phoneField = await this.page.$('input[type="tel"], input[name*="phone"]');
                if (phoneField) {
                    await phoneField.fill(patientData.phone);
                }
            }

            // Fill Medicaid ID if provided
            if (patientData.medicaidId) {
                const idField = await this.page.$('input[name*="medicaid"], input[name*="insurance"]');
                if (idField) {
                    await idField.fill(patientData.medicaidId);
                }
            }

            await this.takeScreenshot('05-patient-info');
            logger.info('Patient information filled');

            return true;
        } catch (error) {
            logger.error('Failed to fill patient info:', error);
            throw error;
        }
    }

    /**
     * Select lab tests
     */
    async selectTests(tests) {
        try {
            logger.info(`Selecting ${tests.length} tests...`);
            this.emitStatus(`Adding ${tests.length} lab tests...`);

            // Find test search/selection field
            const testSelectors = [
                'input[placeholder*="test"]',
                'input[placeholder*="Test"]',
                'input[aria-label*="test"]',
                'input[name*="test"]'
            ];

            let testField = null;
            for (const selector of testSelectors) {
                testField = await this.page.$(selector);
                if (testField) break;
            }

            if (!testField) {
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

            // Find diagnosis field
            const diagnosisSelectors = [
                'input[placeholder*="diagnosis"]',
                'input[placeholder*="ICD"]',
                'input[name*="diagnosis"]',
                'input[name*="icd"]'
            ];

            let diagnosisField = null;
            for (const selector of diagnosisSelectors) {
                diagnosisField = await this.page.$(selector);
                if (diagnosisField) break;
            }

            if (diagnosisField) {
                const diagnosisString = codes.join(', ');
                await diagnosisField.fill(diagnosisString);
                logger.info(`Added diagnosis codes: ${diagnosisString}`);
            } else {
                logger.warn('Could not find diagnosis field - skipping');
            }

            return true;
        } catch (error) {
            logger.error('Failed to add diagnosis codes:', error);
            throw error;
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

            // Update order status to preview
            await updateOrderStatus(this.orderId, 'preview', {
                preview_screenshot_url: screenshotPath
            });

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

                await updateOrderStatus(this.orderId, 'completed', {
                    confirmation_number: confirmationNumber,
                    final_screenshot_url: finalScreenshot,
                    submitted_at: new Date().toISOString()
                });

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