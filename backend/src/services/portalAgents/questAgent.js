// Quest Quanum Portal Automation Agent
// Handles automated order submission to Quest Quanum with preview mode

const { chromium } = require('playwright');
const winston = require('winston');
const path = require('path');
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

class QuestAgent {
    constructor(options = {}) {
        this.portal = 'quest';
        // Quest login URL provided by user
        this.loginUrl = 'https://auth2.questdiagnostics.com/cas/login?service=https%3A%2F%2Fphysician.quanum.questdiagnostics.com%2Fhcp-server-web%2Flogin%2Fcas';
        this.baseUrl = 'https://physician.quanum.questdiagnostics.com';
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
        this.actualUrl = null; // Track which URL worked
    }

    /**
     * Initialize browser and page
     */
    async initialize() {
        try {
            logger.info('Initializing Quest automation browser...');

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
     * Login to Quest Quanum portal
     */
    async login() {
        try {
            logger.info('Attempting to login to Quest Quanum...');
            this.emitStatus('Navigating to Quest portal...');

            // Go directly to the login URL
            logger.info(`Navigating to ${this.loginUrl}...`);
            await this.page.goto(this.loginUrl, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Take screenshot of login page
            await this.takeScreenshot('01-quest-login-page');

            // Check if we're on the login page
            const passwordField = await this.page.$('input[type="password"]');
            if (!passwordField) {
                throw new Error('Could not find Quest login form');
            }

            logger.info('Found Quest login page, performing login...');
            const loginSuccessful = await this.performLogin();

            if (!loginSuccessful) {
                throw new Error('Failed to login to Quest Quanum portal');
            }

            return true;
        } catch (error) {
            logger.error('Login failed:', error);
            await this.takeScreenshot('login-error');
            throw error;
        }
    }

    /**
     * Perform actual login once we found the right page
     */
    async performLogin() {
        try {
            this.emitStatus('Logging into Quest Quanum...');

            // Take screenshot of login page
            await this.takeScreenshot('01-login-page');

            // Find and fill username field
            const usernameSelectors = [
                'input[name="username"]',
                'input[name="user"]',
                'input[type="text"]:not([type="password"])',
                '#username'
            ];

            let usernameField = null;
            for (const selector of usernameSelectors) {
                usernameField = await this.page.$(selector);
                if (usernameField) {
                    logger.debug(`Found username field: ${selector}`);
                    break;
                }
            }

            if (!usernameField) {
                throw new Error('Could not find username field on Quest login page');
            }

            await usernameField.fill(process.env.QUEST_USERNAME);
            await this.delay(500);

            // Fill password
            const passwordField = await this.page.waitForSelector('input[type="password"]');
            const password = process.env.QUEST_PASSWORD;
            logger.info(`Password length: ${password.length} characters`);

            // Clear the field first and use type instead of fill to avoid truncation
            await passwordField.click({ clickCount: 3 }); // Triple-click to select all
            await this.page.keyboard.press('Backspace');
            await passwordField.type(password, { delay: 50 }); // Type each character with delay

            // Verify the password was entered correctly
            const enteredPassword = await passwordField.evaluate(el => el.value);
            logger.info(`Entered password length: ${enteredPassword.length} characters`);

            await this.delay(500);

            await this.takeScreenshot('02-filled-login');

            // Submit login - look for the Sign In button
            const submitButton = await this.page.$('button:has-text("Sign In"), button[type="submit"], input[type="submit"]');
            if (submitButton) {
                logger.info('Found submit button, clicking it...');
                await submitButton.click();
            } else {
                // Try pressing Enter as fallback
                logger.info('No submit button found, pressing Enter...');
                await this.page.keyboard.press('Enter');
            }

            this.emitStatus('Waiting for login to complete...');

            // Wait for navigation
            await this.page.waitForLoadState('networkidle', { timeout: 15000 });

            // Verify login success
            const loggedIn = await this.verifyLogin();
            if (!loggedIn) {
                throw new Error('Login verification failed');
            }

            await this.saveSession();
            await this.takeScreenshot('03-dashboard');

            logger.info('Successfully logged into Quest Quanum');
            this.emitStatus('Login successful');

            return true;
        } catch (error) {
            logger.error('Quest login failed:', error);
            return false;
        }
    }

    /**
     * Verify login was successful
     */
    async verifyLogin() {
        // First check if we're still on the login page (login failed)
        const currentUrl = this.page.url();
        logger.info(`Current URL after login attempt: ${currentUrl}`);

        if (currentUrl.includes('/cas/login')) {
            // Check for error message on login page
            const errorMessage = await this.page.$('div.errors, div.alert-danger, .error-message');
            if (errorMessage) {
                const errorText = await errorMessage.textContent();
                logger.error(`Login error message: ${errorText}`);
            }
            return false;
        }

        // Quest-specific dashboard elements
        const dashboardSelectors = [
            'text=Order',
            'text=Patient',
            'text=Results',
            'text=Lab Order',
            'button:has-text("Order")',
            'a:has-text("New")',
            'text=Quanum'
        ];

        for (const selector of dashboardSelectors) {
            try {
                const element = await this.page.waitForSelector(selector, { timeout: 3000 });
                if (element) {
                    logger.debug(`Found Quest dashboard element: ${selector}`);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        // If we navigated away from login page, consider it successful
        if (!currentUrl.includes('/login') && !currentUrl.includes('/cas')) {
            logger.info('Successfully navigated away from login page');
            return true;
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
            logger.debug('Quest session saved for reuse');
        } catch (error) {
            logger.warn('Failed to save Quest session:', error);
        }
    }

    /**
     * Navigate to new order form
     */
    async navigateToOrderForm() {
        try {
            logger.info('Navigating to Quest order form...');
            this.emitStatus('Opening new order form...');

            // Quest-specific order button selectors
            const newOrderSelectors = [
                'button:has-text("New Order")',
                'button:has-text("Order")',
                'a:has-text("Lab Order")',
                'a:has-text("Create Order")',
                '[aria-label*="Order"]'
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
                throw new Error('Could not find New Order button on Quest');
            }

            await this.page.waitForLoadState('networkidle');
            await this.delay(2000);

            await this.takeScreenshot('04-order-form');
            logger.info('Quest order form loaded');

            return true;
        } catch (error) {
            logger.error('Failed to navigate to Quest order form:', error);
            throw error;
        }
    }

    /**
     * Fill patient information (Quest-specific)
     */
    async fillPatientInfo(patientData) {
        try {
            logger.info('Filling patient information on Quest...');
            this.emitStatus('Entering patient details...');

            // Quest often uses dropdowns and different field layouts

            // Fill first name
            const firstNameField = await this.page.$('input[name*="first"], input[placeholder*="First"]');
            if (firstNameField) {
                await firstNameField.fill(patientData.firstName);
            }

            // Fill last name
            const lastNameField = await this.page.$('input[name*="last"], input[placeholder*="Last"]');
            if (lastNameField) {
                await lastNameField.fill(patientData.lastName);
            }

            // Fill date of birth - Quest may use date picker widget
            const dobField = await this.page.$('input[type="date"], input[name*="birth"], input[name*="dob"]');
            if (dobField) {
                // Format date for Quest (may need MM/DD/YYYY)
                const date = new Date(patientData.dateOfBirth);
                const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
                await dobField.fill(formattedDate);
            }

            // Fill phone
            if (patientData.phone) {
                const phoneField = await this.page.$('input[type="tel"], input[name*="phone"]');
                if (phoneField) {
                    await phoneField.fill(patientData.phone);
                }
            }

            // Fill insurance ID
            if (patientData.medicaidId) {
                const idField = await this.page.$('input[name*="insurance"], input[name*="member"]');
                if (idField) {
                    await idField.fill(patientData.medicaidId);
                }
            }

            await this.takeScreenshot('05-patient-info');
            logger.info('Patient information filled on Quest');

            return true;
        } catch (error) {
            logger.error('Failed to fill Quest patient info:', error);
            throw error;
        }
    }

    /**
     * Select lab tests (Quest-specific)
     */
    async selectTests(tests) {
        try {
            logger.info(`Selecting ${tests.length} tests on Quest...`);
            this.emitStatus(`Adding ${tests.length} lab tests...`);

            // Quest often uses dropdowns or different selection methods
            const testSelectors = [
                'input[placeholder*="test"]',
                'input[name*="test"]',
                'select[name*="test"]', // Quest may use dropdowns
                'input[aria-label*="test"]'
            ];

            let testField = null;
            for (const selector of testSelectors) {
                testField = await this.page.$(selector);
                if (testField) break;
            }

            if (!testField) {
                throw new Error('Could not find test selection field on Quest');
            }

            // Check if it's a select dropdown
            const tagName = await testField.evaluate(el => el.tagName.toLowerCase());

            for (const test of tests) {
                if (tagName === 'select') {
                    // Handle dropdown selection
                    await testField.selectOption({ label: test.name });
                } else {
                    // Handle text input with autocomplete
                    await testField.fill(test.name || test.code);
                    await this.delay(1000);

                    // Look for and click suggestion
                    const suggestion = await this.page.$(`text="${test.name}"`);
                    if (suggestion) {
                        await suggestion.click();
                    } else {
                        await this.page.keyboard.press('Enter');
                    }
                }

                await this.delay(500);
                logger.debug(`Added Quest test: ${test.name}`);
            }

            await this.takeScreenshot('06-tests-selected');
            logger.info(`Successfully selected ${tests.length} tests on Quest`);

            return true;
        } catch (error) {
            logger.error('Failed to select tests on Quest:', error);
            throw error;
        }
    }

    /**
     * Add diagnosis codes (Quest-specific)
     */
    async addDiagnosisCodes(codes) {
        try {
            if (!codes || codes.length === 0) {
                logger.info('No diagnosis codes to add');
                return true;
            }

            logger.info(`Adding ${codes.length} diagnosis codes to Quest...`);
            this.emitStatus('Adding diagnosis codes...');

            // Quest diagnosis field selectors
            const diagnosisField = await this.page.$('input[name*="diagnosis"], input[name*="icd"], textarea[name*="diagnosis"]');

            if (diagnosisField) {
                const diagnosisString = codes.join(', ');
                await diagnosisField.fill(diagnosisString);
                logger.info(`Added Quest diagnosis codes: ${diagnosisString}`);
            } else {
                logger.warn('Could not find diagnosis field on Quest - skipping');
            }

            return true;
        } catch (error) {
            logger.error('Failed to add diagnosis codes on Quest:', error);
            throw error;
        }
    }

    /**
     * Preview order before submission
     */
    async previewOrder() {
        try {
            logger.info('Generating Quest order preview...');
            this.emitStatus('Generating preview...');

            await this.delay(2000); // Let form fully render

            const screenshotPath = await this.takeScreenshot('order-preview', true);

            // Update order status to preview
            await updateOrderStatus(this.orderId, 'preview', {
                preview_screenshot_url: screenshotPath
            });

            logger.info('Quest order preview generated');
            this.emitStatus('Preview ready - awaiting confirmation');

            return screenshotPath;
        } catch (error) {
            logger.error('Failed to generate Quest preview:', error);
            throw error;
        }
    }

    /**
     * Submit order (after preview confirmation)
     */
    async submitOrder() {
        try {
            logger.info('Submitting order to Quest...');
            this.emitStatus('Submitting order...');

            // Quest submit button selectors
            const submitSelectors = [
                'button:has-text("Submit")',
                'button:has-text("Send")',
                'button:has-text("Place Order")',
                'button[type="submit"]'
            ];

            let submitButton = null;
            for (const selector of submitSelectors) {
                submitButton = await this.page.$(selector);
                if (submitButton) break;
            }

            if (!submitButton) {
                throw new Error('Could not find submit button on Quest');
            }

            await submitButton.click();

            await this.page.waitForLoadState('networkidle');
            await this.delay(3000);

            // Look for confirmation
            const confirmationNumber = await this.extractConfirmationNumber();

            if (confirmationNumber) {
                logger.info(`Quest order submitted successfully: ${confirmationNumber}`);

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
                throw new Error('Quest order submitted but no confirmation number received');
            }
        } catch (error) {
            logger.error('Failed to submit Quest order:', error);
            throw error;
        }
    }

    /**
     * Extract confirmation number from Quest page
     */
    async extractConfirmationNumber() {
        try {
            // Quest confirmation patterns
            const pageText = await this.page.textContent('body');
            const patterns = [
                /Confirmation.*?(\d{6,})/i,
                /Order.*?(\d{6,})/i,
                /Reference.*?(\d{6,})/i,
                /Accession.*?(\d{6,})/i
            ];

            for (const pattern of patterns) {
                const match = pageText.match(pattern);
                if (match) {
                    return match[1];
                }
            }

            return null;
        } catch (error) {
            logger.error('Failed to extract Quest confirmation number:', error);
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
                action: 'quest_order_processing_started',
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

            // If preview mode is enabled, stop here
            if (this.previewMode) {
                logger.info('Preview mode - waiting for user confirmation');
                return {
                    success: true,
                    status: 'preview',
                    previewUrl: previewPath,
                    message: 'Quest order preview ready for confirmation'
                };
            } else {
                // Auto-submit if preview mode is disabled
                return await this.submitOrder();
            }

        } catch (error) {
            logger.error('Quest order processing failed:', error);

            // Update order status
            await updateOrderStatus(this.orderId, 'failed', {
                error_message: error.message,
                retry_count: orderData.retry_count + 1
            });

            // Create notification
            await createNotification({
                portalOrderId: this.orderId,
                type: 'error',
                title: 'Quest Order Failed',
                message: `Failed to process order: ${error.message}`
            });

            // Log failure
            await logAutomation({
                portalOrderId: this.orderId,
                action: 'quest_order_processing_failed',
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
            logger.error('Failed to confirm Quest order:', error);
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
            const filename = `quest-${this.orderId}-${name}-${Date.now()}.png`;
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

module.exports = QuestAgent;