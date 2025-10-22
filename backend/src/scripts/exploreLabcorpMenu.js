// Script to explore Labcorp menu and find lab order options
const { chromium } = require('playwright');
const fs = require('fs').promises;
require('dotenv').config();

async function exploreLabcorpMenu() {
    const browser = await chromium.launch({
        headless: false, // Show browser
        slowMo: 500 // Slow down for observation
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('🔍 Starting Labcorp menu exploration...\n');

    try {
        // Login flow
        console.log('1. Logging into Labcorp...');
        await page.goto('https://link.labcorp.com');

        // Click Sign In
        const signInButton = await page.$('button:has-text("Sign In")');
        if (signInButton) {
            await signInButton.click();
            await page.waitForLoadState('networkidle');
        }

        // Login
        await page.fill('input[name="identifier"], input[name="username"]', process.env.LABCORP_USERNAME);

        const nextButton = await page.$('input[type="submit"][value="Next"]');
        if (nextButton) {
            await nextButton.click();
            await page.waitForSelector('input[name="credentials.passcode"], input[name="password"]', { timeout: 10000 });
        }

        await page.fill('input[name="credentials.passcode"], input[name="password"]', process.env.LABCORP_PASSWORD);

        const submitButton = await page.$('input[type="submit"][value="Verify"]');
        if (submitButton) {
            await submitButton.click();
        }

        // Wait for dashboard
        await page.waitForURL('**/dashboard**', { timeout: 30000 });
        console.log('✅ Logged in successfully!\n');

        // Wait for dashboard to fully load
        console.log('2. Waiting for dashboard to fully load...');
        await page.waitForTimeout(5000); // Give it time to load

        // Try to wait for loading to complete
        try {
            await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 10000 });
        } catch (e) {
            console.log('   Dashboard may still be loading...');
        }

        await page.screenshot({ path: 'test-screenshots/labcorp-dashboard-loaded.png' });

        // Step 3: Click the MENU button
        console.log('3. Looking for MENU button...');
        const menuButton = await page.$('button:has-text("MENU"), [aria-label="Menu"], .menu-button, #menu-button');

        if (menuButton) {
            console.log('   Found MENU button! Clicking it...');
            await menuButton.click();
            await page.waitForTimeout(2000); // Wait for menu to open

            await page.screenshot({ path: 'test-screenshots/labcorp-menu-open.png' });

            // Get all menu items
            const menuItems = await page.$$eval('a, button, [role="menuitem"], [role="button"], .menu-item', elements => {
                return elements.map(el => {
                    const text = el.textContent?.trim() || '';
                    const href = el.href || '';
                    return { text, href };
                }).filter(item => item.text && item.text.length > 0);
            });

            console.log('\n📋 Menu items found:');
            menuItems.forEach(item => {
                console.log(`   • ${item.text}`);
                if (item.href) console.log(`     → ${item.href}`);
            });

            // Look specifically for order-related items
            const orderRelated = menuItems.filter(item => {
                const text = item.text.toLowerCase();
                return text.includes('order') ||
                       text.includes('test') ||
                       text.includes('requisition') ||
                       text.includes('lab') ||
                       text.includes('patient') ||
                       text.includes('new');
            });

            if (orderRelated.length > 0) {
                console.log('\n🎯 Potential order-related menu items:');
                orderRelated.forEach(item => {
                    console.log(`   ★ ${item.text}`);
                });

                // Try clicking the first order-related item
                const firstOrderItem = orderRelated[0];
                const orderElement = await page.$(`text="${firstOrderItem.text}"`);
                if (orderElement) {
                    console.log(`\n   Clicking "${firstOrderItem.text}"...`);
                    await orderElement.click();
                    await page.waitForLoadState('networkidle');
                    await page.waitForTimeout(3000);

                    const newUrl = page.url();
                    console.log(`   📍 Navigated to: ${newUrl}`);

                    await page.screenshot({ path: 'test-screenshots/labcorp-order-page.png' });

                    // Look for form fields on the new page
                    const formFields = await page.$$eval('input, select, textarea', elements => {
                        return elements.map(el => ({
                            type: el.type || el.tagName.toLowerCase(),
                            name: el.name || '',
                            id: el.id || '',
                            placeholder: el.placeholder || '',
                            label: el.getAttribute('aria-label') || ''
                        })).filter(el => el.name || el.placeholder || el.label);
                    });

                    if (formFields.length > 0) {
                        console.log('\n📝 Form fields found on order page:');
                        formFields.slice(0, 15).forEach(field => {
                            const identifier = field.name || field.placeholder || field.label || field.id;
                            console.log(`   • ${field.type}: ${identifier}`);
                        });
                    }
                }
            }

            // Save all findings
            const results = {
                timestamp: new Date().toISOString(),
                menuItems: menuItems,
                orderRelatedItems: orderRelated,
                dashboardUrl: 'https://link.labcorp.com/dashboard'
            };

            await fs.writeFile(
                'test-screenshots/labcorp-menu-exploration.json',
                JSON.stringify(results, null, 2)
            );
        } else {
            console.log('   ⚠️ Could not find MENU button. Dashboard might be different than expected.');

            // Try to find any clickable elements
            const clickables = await page.$$eval('a, button', elements => {
                return elements.map(el => el.textContent?.trim() || '').filter(text => text);
            });

            console.log('\n   All clickable elements on page:');
            clickables.forEach(text => {
                console.log(`   • ${text}`);
            });
        }

        console.log('\n💾 Results saved to test-screenshots/');
        console.log('🎉 Exploration complete! Browser will stay open for manual exploration.');
        console.log('\nYou can now manually explore the portal to find the order workflow.');
        console.log('Press Ctrl+C to exit when done.');

        // Keep browser open
        await new Promise(() => {});

    } catch (error) {
        console.error('❌ Error:', error.message);
        await page.screenshot({ path: 'test-screenshots/labcorp-error.png' });
    }
}

// Run exploration
exploreLabcorpMenu().catch(console.error);