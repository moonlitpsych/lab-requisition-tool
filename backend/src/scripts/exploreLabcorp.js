// Script to explore Labcorp portal and find lab order creation workflow
const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function exploreLabcorp() {
    const browser = await chromium.launch({
        headless: false, // Show browser for exploration
        slowMo: 1000 // Slow down actions to observe
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🔍 Starting Labcorp exploration...\n');

    try {
        // Step 1: Navigate to main page
        console.log('1. Navigating to Labcorp Link...');
        await page.goto('https://link.labcorp.com');
        await page.waitForLoadState('networkidle');

        // Step 2: Click Sign In
        console.log('2. Looking for Sign In button...');
        const signInButton = await page.$('button:has-text("Sign In")');
        if (signInButton) {
            await signInButton.click();
            await page.waitForLoadState('networkidle');
        }

        // Step 3: Login
        console.log('3. Logging in...');
        await page.fill('input[name="identifier"], input[name="username"]', process.env.LABCORP_USERNAME);

        // Click Next button
        const nextButton = await page.$('input[type="submit"][value="Next"]');
        if (nextButton) {
            await nextButton.click();
            await page.waitForSelector('input[name="credentials.passcode"], input[name="password"]', { timeout: 10000 });
        }

        // Fill password
        await page.fill('input[name="credentials.passcode"], input[name="password"]', process.env.LABCORP_PASSWORD);

        // Submit
        const submitButton = await page.$('input[type="submit"][value="Verify"]');
        if (submitButton) {
            await submitButton.click();
        }

        // Wait for dashboard
        await page.waitForURL('**/dashboard**', { timeout: 30000 });
        console.log('✅ Successfully logged in!\n');

        // Step 4: Explore dashboard
        console.log('4. Exploring dashboard options...');
        await page.screenshot({ path: 'test-screenshots/labcorp-dashboard.png' });

        // Look for order-related buttons/links
        const orderElements = await page.$$eval('a, button, [role="button"], [role="link"]', elements => {
            return elements.map(el => {
                const text = el.textContent?.trim() || '';
                const href = el.href || '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                return { text, href, ariaLabel };
            }).filter(item => {
                const combined = (item.text + item.ariaLabel).toLowerCase();
                return combined.includes('order') ||
                       combined.includes('requisition') ||
                       combined.includes('test') ||
                       combined.includes('patient') ||
                       combined.includes('new') ||
                       combined.includes('create') ||
                       combined.includes('submit');
            });
        });

        console.log('\n📋 Found order-related elements:');
        orderElements.forEach(el => {
            if (el.text) console.log(`  - "${el.text}"`);
            if (el.href && !el.text) console.log(`  - Link: ${el.href}`);
        });

        // Look for navigation menu items
        const menuItems = await page.$$eval('[role="navigation"] a, nav a, .menu a, .nav a', elements => {
            return elements.map(el => ({
                text: el.textContent?.trim() || '',
                href: el.href || ''
            })).filter(item => item.text);
        });

        if (menuItems.length > 0) {
            console.log('\n📁 Navigation menu items:');
            menuItems.forEach(item => {
                console.log(`  - "${item.text}"`);
            });
        }

        // Try to find "Test Directory" or "Order Tests" or similar
        const testOrderLink = await page.$('a:has-text("Test Directory"), a:has-text("Order Test"), a:has-text("Order Lab"), button:has-text("Order"), a:has-text("New Order")');
        if (testOrderLink) {
            console.log('\n🎯 Found potential order link! Clicking it...');
            await testOrderLink.click();
            await page.waitForLoadState('networkidle');
            await page.screenshot({ path: 'test-screenshots/labcorp-order-page.png' });

            // Analyze the new page
            const currentUrl = page.url();
            console.log(`📍 Current URL: ${currentUrl}`);

            // Look for form elements
            const formElements = await page.$$eval('input, select, textarea', elements => {
                return elements.map(el => ({
                    type: el.type || el.tagName.toLowerCase(),
                    name: el.name || '',
                    placeholder: el.placeholder || '',
                    label: el.getAttribute('aria-label') || ''
                })).filter(el => el.name || el.placeholder || el.label);
            });

            if (formElements.length > 0) {
                console.log('\n📝 Found form fields:');
                formElements.slice(0, 10).forEach(field => {
                    console.log(`  - ${field.type}: ${field.name || field.placeholder || field.label}`);
                });
            }
        }

        // Save exploration results
        const results = {
            timestamp: new Date().toISOString(),
            dashboardElements: orderElements,
            navigationMenu: menuItems,
            currentUrl: page.url()
        };

        await fs.writeFile(
            'test-screenshots/labcorp-exploration-results.json',
            JSON.stringify(results, null, 2)
        );

        console.log('\n💾 Results saved to test-screenshots/labcorp-exploration-results.json');
        console.log('\n🎉 Exploration complete! Browser will stay open for manual exploration.');
        console.log('Press Ctrl+C to exit when done.');

        // Keep browser open for manual exploration
        await new Promise(() => {}); // Infinite wait

    } catch (error) {
        console.error('❌ Error during exploration:', error.message);
        await page.screenshot({ path: 'test-screenshots/labcorp-error.png' });
    }
}

// Run the exploration
exploreLabcorp().catch(console.error);