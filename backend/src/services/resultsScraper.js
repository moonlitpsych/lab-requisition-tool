// Results Scraper Service
// Automated service to fetch lab results from portals

const cron = require('node-cron');
const winston = require('winston');
const LabcorpAgent = require('./portalAgents/labcorpAgent');
const QuestAgent = require('./portalAgents/questAgent');
const { getLLMHelper } = require('./portalAgents/llmHelper');
const {
    getSupabase,
    savePortalResult,
    createNotification,
    logAutomation
} = require('./supabase');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
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

class ResultsScraper {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.llmHelper = getLLMHelper();
    }

    /**
     * Start the cron job for results scraping
     */
    startCron() {
        // Run every 2 hours during business hours (9 AM - 6 PM)
        // Format: '0 */2 9-18 * * *' = At minute 0 past every 2nd hour from 9 through 18
        const schedule = process.env.RESULTS_CRON_SCHEDULE || '0 */2 9-18 * * *';

        cron.schedule(schedule, async () => {
            await this.scrapeAllResults();
        });

        logger.info(`Results scraper scheduled: ${schedule}`);

        // Run immediately on startup if in development
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => this.scrapeAllResults(), 5000);
        }
    }

    /**
     * Scrape results from all configured portals
     */
    async scrapeAllResults() {
        if (this.isRunning) {
            logger.warn('Results scraper already running, skipping...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        logger.info('Starting results scraping...');

        try {
            const results = {
                labcorp: { success: false, count: 0, error: null },
                quest: { success: false, count: 0, error: null }
            };

            // Scrape from Labcorp
            if (process.env.LABCORP_USERNAME && process.env.LABCORP_PASSWORD) {
                try {
                    results.labcorp = await this.scrapeLabcorpResults();
                } catch (error) {
                    results.labcorp.error = error.message;
                    logger.error('Labcorp scraping failed:', error);
                }
            }

            // Wait a bit between portals to avoid looking suspicious
            await this.delay(5000);

            // Scrape from Quest
            if (process.env.QUEST_USERNAME && process.env.QUEST_PASSWORD) {
                try {
                    results.quest = await this.scrapeQuestResults();
                } catch (error) {
                    results.quest.error = error.message;
                    logger.error('Quest scraping failed:', error);
                }
            }

            // Log summary
            const duration = Date.now() - startTime;
            const totalResults = results.labcorp.count + results.quest.count;

            logger.info(`Results scraping completed in ${duration}ms`, {
                labcorp: results.labcorp.count,
                quest: results.quest.count,
                total: totalResults
            });

            this.lastRun = new Date();

            // Create notification if new results found
            if (totalResults > 0) {
                await this.createResultsNotification(totalResults, results);
            }

            return results;
        } catch (error) {
            logger.error('Results scraper error:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Scrape results from Labcorp
     */
    async scrapeLabcorpResults() {
        const agent = new LabcorpAgent();
        const results = [];

        try {
            await agent.initialize();
            await agent.login();

            // Navigate to results section
            await this.navigateToLabcorpResults(agent);

            // Get list of recent orders with results
            const orders = await this.getLabcorpOrdersWithResults(agent);

            // Process each order
            for (const order of orders) {
                try {
                    const orderResults = await this.processLabcorpOrder(agent, order);
                    results.push(...orderResults);
                } catch (error) {
                    logger.error(`Failed to process Labcorp order ${order.id}:`, error);
                }
            }

            // Save all results to database
            for (const result of results) {
                await this.saveResult('labcorp', result);
            }

            return {
                success: true,
                count: results.length,
                error: null
            };

        } catch (error) {
            logger.error('Labcorp results scraping failed:', error);
            throw error;
        } finally {
            await agent.cleanup();
        }
    }

    /**
     * Navigate to Labcorp results section
     */
    async navigateToLabcorpResults(agent) {
        try {
            // Look for Results or Reports link
            const resultsSelectors = [
                'a:has-text("Results")',
                'button:has-text("Results")',
                'a:has-text("Reports")',
                'a:has-text("View Results")',
                '[aria-label*="Results"]'
            ];

            let clicked = false;
            for (const selector of resultsSelectors) {
                try {
                    const element = await agent.page.waitForSelector(selector, { timeout: 3000 });
                    if (element) {
                        await element.click();
                        clicked = true;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!clicked) {
                throw new Error('Could not find Results section');
            }

            await agent.page.waitForLoadState('networkidle');
            await agent.delay(2000);

        } catch (error) {
            logger.error('Failed to navigate to Labcorp results:', error);
            throw error;
        }
    }

    /**
     * Get list of Labcorp orders with available results
     */
    async getLabcorpOrdersWithResults(agent) {
        try {
            // Look for result rows or cards
            const orders = [];

            // Try to find result elements
            const resultElements = await agent.page.$$('[class*="result"], [class*="order"], tr[class*="row"]');

            for (const element of resultElements) {
                try {
                    const text = await element.textContent();

                    // Look for patterns indicating results are ready
                    if (text.includes('Ready') || text.includes('Complete') || text.includes('Final')) {
                        const orderId = await this.extractOrderId(text);
                        const patientName = await this.extractPatientName(text);
                        const date = await this.extractDate(text);

                        if (orderId) {
                            orders.push({
                                id: orderId,
                                patient: patientName,
                                date: date,
                                element: element
                            });
                        }
                    }
                } catch (e) {
                    continue;
                }
            }

            logger.info(`Found ${orders.length} Labcorp orders with results`);
            return orders;

        } catch (error) {
            logger.error('Failed to get Labcorp orders:', error);
            return [];
        }
    }

    /**
     * Process a single Labcorp order to extract results
     */
    async processLabcorpOrder(agent, order) {
        const results = [];

        try {
            // Click on the order to view details
            await order.element.click();
            await agent.page.waitForLoadState('networkidle');
            await agent.delay(1000);

            // Extract result data from the page
            const pageContent = await agent.page.content();
            const resultData = await this.extractLabcorpResults(pageContent);

            // Check for PDF download link
            const pdfUrl = await this.findPdfLink(agent.page);

            // Format results for database
            for (const test of resultData.tests) {
                results.push({
                    orderId: order.id,
                    patientName: order.patient,
                    testName: test.name,
                    testCode: test.code,
                    resultValue: test.value,
                    resultUnit: test.unit,
                    referenceRange: test.range,
                    resultStatus: test.status,
                    resultDate: order.date,
                    pdfUrl: pdfUrl,
                    rawData: test
                });
            }

            // Go back to results list
            await agent.page.goBack();
            await agent.delay(1000);

        } catch (error) {
            logger.error(`Failed to process Labcorp order ${order.id}:`, error);
        }

        return results;
    }

    /**
     * Extract Labcorp results from page content
     */
    async extractLabcorpResults(htmlContent) {
        // Use LLM to parse results if configured
        if (this.llmHelper.isConfigured) {
            const parsed = await this.llmHelper.parseLabResults(htmlContent);
            if (parsed.parsed) {
                return parsed;
            }
        }

        // Fallback to manual parsing
        const tests = [];
        const lines = htmlContent.split('\n');

        for (const line of lines) {
            // Look for patterns like: "Test Name: Value Unit (Range)"
            const testPattern = /([A-Za-z\s]+):\s*([\d.]+)\s*([A-Za-z/%]*)\s*\(([\d.-]+)\)/;
            const match = line.match(testPattern);

            if (match) {
                tests.push({
                    name: match[1].trim(),
                    value: match[2],
                    unit: match[3] || '',
                    range: match[4],
                    status: 'normal' // Would need more logic to determine
                });
            }
        }

        return { tests };
    }

    /**
     * Scrape results from Quest
     */
    async scrapeQuestResults() {
        const agent = new QuestAgent();
        const results = [];

        try {
            await agent.initialize();
            await agent.login();

            // Navigate to results section
            await this.navigateToQuestResults(agent);

            // Get list of recent results
            const orders = await this.getQuestOrdersWithResults(agent);

            // Process each order
            for (const order of orders) {
                try {
                    const orderResults = await this.processQuestOrder(agent, order);
                    results.push(...orderResults);
                } catch (error) {
                    logger.error(`Failed to process Quest order ${order.id}:`, error);
                }
            }

            // Save all results
            for (const result of results) {
                await this.saveResult('quest', result);
            }

            return {
                success: true,
                count: results.length,
                error: null
            };

        } catch (error) {
            logger.error('Quest results scraping failed:', error);
            throw error;
        } finally {
            await agent.cleanup();
        }
    }

    /**
     * Navigate to Quest results section
     */
    async navigateToQuestResults(agent) {
        // Similar to Labcorp but with Quest-specific selectors
        const resultsSelectors = [
            'a:has-text("Results")',
            'a:has-text("Lab Results")',
            'button:has-text("View Results")',
            '[aria-label*="Results"]'
        ];

        for (const selector of resultsSelectors) {
            try {
                const element = await agent.page.waitForSelector(selector, { timeout: 3000 });
                if (element) {
                    await element.click();
                    await agent.page.waitForLoadState('networkidle');
                    return;
                }
            } catch (e) {
                continue;
            }
        }

        throw new Error('Could not navigate to Quest results');
    }

    /**
     * Get Quest orders with results (simplified)
     */
    async getQuestOrdersWithResults(agent) {
        // Similar to Labcorp implementation
        return [];
    }

    /**
     * Process Quest order (simplified)
     */
    async processQuestOrder(agent, order) {
        // Similar to Labcorp implementation
        return [];
    }

    /**
     * Save result to database
     */
    async saveResult(portal, resultData) {
        try {
            // Find matching patient
            const { data: patients } = await getSupabase()
                .from('patients')
                .select('id')
                .ilike('last_name', `%${resultData.patientName?.split(' ')[1]}%`)
                .ilike('first_name', `%${resultData.patientName?.split(' ')[0]}%`)
                .limit(1);

            const patientId = patients?.[0]?.id;

            if (!patientId) {
                logger.warn(`Could not find patient for result: ${resultData.patientName}`);
                return;
            }

            // Save result
            await savePortalResult({
                portal: portal,
                patientId: patientId,
                testName: resultData.testName,
                testCode: resultData.testCode,
                resultValue: resultData.resultValue,
                resultUnit: resultData.resultUnit,
                referenceRange: resultData.referenceRange,
                resultStatus: resultData.resultStatus || 'normal',
                resultDate: resultData.resultDate,
                pdfUrl: resultData.pdfUrl,
                rawData: resultData.rawData
            });

            logger.debug(`Saved result: ${resultData.testName} for ${resultData.patientName}`);

        } catch (error) {
            logger.error('Failed to save result:', error);
        }
    }

    /**
     * Create notification for new results
     */
    async createResultsNotification(count, results) {
        await createNotification({
            type: 'info',
            title: `${count} New Lab Results Available`,
            message: `Fetched ${results.labcorp.count} from Labcorp and ${results.quest.count} from Quest`
        });
    }

    /**
     * Utility functions
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    extractOrderId(text) {
        const match = text.match(/\d{6,}/);
        return match ? match[0] : null;
    }

    extractPatientName(text) {
        // Look for name patterns
        const match = text.match(/([A-Z][a-z]+),?\s+([A-Z][a-z]+)/);
        return match ? `${match[2]} ${match[1]}` : null;
    }

    extractDate(text) {
        const match = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
        return match ? match[0] : null;
    }

    async findPdfLink(page) {
        try {
            const pdfLink = await page.$('a[href*=".pdf"], a:has-text("Download"), a:has-text("PDF")');
            if (pdfLink) {
                return await pdfLink.getAttribute('href');
            }
        } catch (e) {
            return null;
        }
        return null;
    }
}

// Create singleton instance
let scraperInstance = null;

function getResultsScraper() {
    if (!scraperInstance) {
        scraperInstance = new ResultsScraper();
    }
    return scraperInstance;
}

function startResultsCron() {
    const scraper = getResultsScraper();
    scraper.startCron();
}

module.exports = {
    ResultsScraper,
    getResultsScraper,
    startResultsCron
};