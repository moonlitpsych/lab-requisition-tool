// Labcorp Link OAuth Flow Explorer
// This script navigates through the full OAuth login flow

const { chromium } = require('playwright');
require('dotenv').config();

async function exploreLabcorpOAuth() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000,  // Slow down for observation
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    try {
        console.log('🚀 LABCORP LINK OAUTH EXPLORER');
        console.log('=====================================\n');

        // Step 1: Navigate to main page
        console.log('📍 Step 1: Navigating to Labcorp Link...');
        await page.goto('https://link.labcorp.com', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.screenshot({
            path: './test-screenshots/oauth-01-landing.png',
            fullPage: true
        });
        console.log('   📸 Screenshot: oauth-01-landing.png');

        // Step 2: Click Sign In button
        console.log('\n📍 Step 2: Looking for Sign In button...');
        const signInButton = await page.locator('button:has-text("Sign In"), a:has-text("Sign In")').first();

        if (await signInButton.count() > 0) {
            console.log('   ✅ Found Sign In button, clicking...');
            await signInButton.click();

            // Wait for navigation
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            const newUrl = page.url();
            console.log(`   📍 Navigated to: ${newUrl}`);

            await page.screenshot({
                path: './test-screenshots/oauth-02-login-form.png',
                fullPage: true
            });
            console.log('   📸 Screenshot: oauth-02-login-form.png');
        } else {
            console.log('   ❌ Sign In button not found');
        }

        // Step 3: Look for login form fields
        console.log('\n📍 Step 3: Analyzing login form...');

        // Check all possible username selectors
        const usernameSelectors = [
            '#okta-signin-username',
            'input[name="identifier"]',
            'input[name="username"]',
            '#username',
            'input[type="text"]',
            'input[type="email"]',
            'input[data-se="userIdentifier"]',
            '#j_username',
            'input[name="j_username"]'
        ];

        let foundUsername = null;
        for (const selector of usernameSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                foundUsername = selector;
                console.log(`   ✅ Username field found: ${selector} (${count} matches)`);

                // Get more details about the field
                const fieldInfo = await page.locator(selector).first().evaluate(el => ({
                    id: el.id,
                    name: el.name,
                    placeholder: el.placeholder,
                    type: el.type,
                    visible: el.offsetParent !== null
                }));
                console.log(`      Details:`, fieldInfo);
                break;
            }
        }

        if (!foundUsername) {
            console.log('   ❌ No username field found with standard selectors');

            // Try to find any text inputs
            const textInputs = await page.locator('input[type="text"], input[type="email"]').all();
            console.log(`   🔍 Found ${textInputs.length} text/email inputs total`);

            for (let i = 0; i < textInputs.length; i++) {
                const info = await textInputs[i].evaluate(el => ({
                    id: el.id,
                    name: el.name,
                    placeholder: el.placeholder,
                    type: el.type,
                    visible: el.offsetParent !== null
                }));
                console.log(`      Input ${i + 1}:`, info);
            }
        }

        // Check for password field
        console.log('\n📍 Step 4: Looking for password field...');
        const passwordSelectors = [
            '#okta-signin-password',
            'input[name="credentials.passcode"]',
            'input[name="password"]',
            '#password',
            'input[type="password"]',
            'input[data-se="passcode"]',
            '#pass-signin'
        ];

        let foundPassword = null;
        for (const selector of passwordSelectors) {
            const count = await page.locator(selector).count();
            if (count > 0) {
                foundPassword = selector;
                console.log(`   ✅ Password field found: ${selector} (${count} matches)`);
                break;
            }
        }

        // Step 5: Try to login if fields found
        if (foundUsername && foundPassword) {
            console.log('\n📍 Step 5: Attempting to fill login form...');

            // Fill username
            await page.fill(foundUsername, process.env.LABCORP_USERNAME);
            console.log('   ✅ Username filled');

            // Check if there's a Next button (two-step login)
            const nextButton = await page.locator('input[value="Next"], button:has-text("Next")').first();
            if (await nextButton.count() > 0) {
                console.log('   🔄 Two-step login detected, clicking Next...');
                await nextButton.click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);
            }

            // Fill password
            await page.fill(foundPassword, process.env.LABCORP_PASSWORD);
            console.log('   ✅ Password filled');

            await page.screenshot({
                path: './test-screenshots/oauth-03-filled-form.png',
                fullPage: true
            });
            console.log('   📸 Screenshot: oauth-03-filled-form.png');

            // Look for submit button
            const submitSelectors = [
                'input[type="submit"][value="Sign In"]',
                'button:has-text("Sign In")',
                'input[type="submit"][value="Verify"]',
                'button[type="submit"]',
                '#okta-signin-submit'
            ];

            let submitButton = null;
            for (const selector of submitSelectors) {
                const btn = await page.locator(selector).first();
                if (await btn.count() > 0) {
                    submitButton = btn;
                    console.log(`   ✅ Submit button found: ${selector}`);
                    break;
                }
            }

            if (submitButton) {
                console.log('\n📍 Step 6: Submitting login form...');
                console.log('   ⚠️  Press Enter to submit login, or Ctrl+C to abort');

                // Wait for manual confirmation
                await page.waitForTimeout(5000);

                await submitButton.click();
                console.log('   🔄 Login submitted, waiting for response...');

                // Wait for navigation
                try {
                    await page.waitForURL('**/home**', { timeout: 30000 });
                    console.log('   ✅ Login successful! Reached home page');

                    await page.screenshot({
                        path: './test-screenshots/oauth-04-home.png',
                        fullPage: true
                    });
                    console.log('   📸 Screenshot: oauth-04-home.png');

                    // Look for navigation elements
                    console.log('\n📍 Step 7: Exploring navigation menu...');
                    const navElements = [
                        'text="New Order"',
                        'text="Create Order"',
                        'text="Place Order"',
                        'text="Orders"',
                        'text="Results"',
                        'text="Patients"'
                    ];

                    for (const selector of navElements) {
                        const count = await page.locator(selector).count();
                        if (count > 0) {
                            console.log(`   ✅ Found navigation: ${selector}`);
                        }
                    }

                } catch (error) {
                    console.log('   ⚠️  Login might have failed or requires additional steps');

                    // Check for MFA
                    if (await page.locator('text="verification"').count() > 0) {
                        console.log('   🔐 MFA verification required');
                    }

                    // Check for terms
                    if (await page.locator('input[type="checkbox"]').count() > 0) {
                        console.log('   ☑️  Terms acceptance may be required');
                    }

                    await page.screenshot({
                        path: './test-screenshots/oauth-error.png',
                        fullPage: true
                    });
                    console.log('   📸 Error screenshot: oauth-error.png');
                }
            }
        } else {
            console.log('\n⚠️  Could not find both username and password fields');
        }

        console.log('\n=====================================');
        console.log('📊 EXPLORATION COMPLETE');
        console.log('=====================================');
        console.log('Check ./test-screenshots/ for captured screens');
        console.log('\n⏸️  Browser staying open for manual exploration...');
        console.log('   Press Ctrl+C when done\n');

        // Keep browser open
        await new Promise(() => {});

    } catch (error) {
        console.error('\n❌ Error during exploration:', error);
        await page.screenshot({
            path: './test-screenshots/oauth-fatal-error.png',
            fullPage: true
        });
    }
}

// Run the explorer
console.log('🚀 Starting Labcorp Link OAuth exploration...\n');
exploreLabcorpOAuth().catch(console.error);