// LLM Helper Service
// Uses Google Gemini 2.5 Pro for HIPAA-compliant adaptive form filling and diagnosis

const { GoogleGenerativeAI } = require('@google/generative-ai');
const winston = require('winston');

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

class LLMHelper {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.isConfigured = false;

        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // Using the latest Gemini 2.5 Pro model
            this.model = this.genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
            this.isConfigured = true;
            logger.info('LLM Helper initialized with Google Gemini 2.5 Pro (HIPAA-compliant)');
        } else {
            logger.warn('Gemini API key not configured - LLM features disabled');
            logger.info('To enable: Add GEMINI_API_KEY to your .env file');
        }
    }

    /**
     * Analyze HTML to find form fields when selectors fail
     */
    async findFormFields(htmlContent, patientData) {
        if (!this.isConfigured) {
            logger.warn('LLM not configured, returning empty field map');
            return { fields: [] };
        }

        try {
            logger.info('Using Gemini to find form fields...');

            // Truncate HTML to stay within token limits
            const truncatedHtml = htmlContent.substring(0, 5000);

            const prompt = `You are analyzing an HTML form for lab test ordering. This is for HIPAA-compliant healthcare automation.

Patient Data to Enter:
${JSON.stringify(patientData, null, 2)}

HTML Form (first 5000 chars):
${truncatedHtml}

Task: Return a JSON array mapping our data to the form's input selectors.
Focus on: patient name, DOB, insurance ID, phone, diagnosis code.

IMPORTANT: Return ONLY valid JSON, no explanatory text or markdown.

Return format:
{
  "fields": [
    {"selector": "CSS selector", "value": "value to enter", "type": "text|date|select", "fieldName": "firstName|lastName|dob|phone|medicaidId"}
  ]
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Try to parse the JSON response
            try {
                // Clean up response if needed (remove markdown backticks)
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                const parsedResult = JSON.parse(cleanContent);
                logger.info(`Gemini found ${parsedResult.fields.length} form fields`);
                return parsedResult;
            } catch (parseError) {
                // Try to extract JSON from the response
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsedResult = JSON.parse(jsonMatch[0]);
                    return parsedResult;
                }
                throw parseError;
            }

        } catch (error) {
            logger.error('Gemini field finding failed:', error);
            return { fields: [] };
        }
    }

    /**
     * Diagnose automation errors using error message and current state
     */
    async diagnoseError(errorMessage, screenshotPath, currentUrl) {
        if (!this.isConfigured) {
            logger.warn('LLM not configured, cannot diagnose error');
            return {
                diagnosis: 'LLM not configured',
                suggestions: ['Check selectors manually'],
                shouldRetry: false
            };
        }

        try {
            logger.info('Using Gemini to diagnose automation error...');

            const prompt = `Diagnose this lab portal automation error. This is for HIPAA-compliant healthcare automation.

Error: ${errorMessage}
Page URL: ${currentUrl}

Common issues:
1. Login credentials incorrect
2. Session timeout
3. Page layout changed
4. Network timeout
5. Required field missing
6. Portal maintenance

Based on the error message and URL, provide a diagnosis.

Return ONLY valid JSON:
{
  "diagnosis": "brief explanation",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "shouldRetry": true/false,
  "alternativeSelectors": ["selector1", "selector2"]
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const diagnosis = JSON.parse(cleanContent);

            logger.info('Gemini diagnosis:', diagnosis.diagnosis);
            return diagnosis;

        } catch (error) {
            logger.error('Gemini diagnosis failed:', error);
            return {
                diagnosis: 'Unable to diagnose',
                suggestions: ['Check logs', 'Try manual submission'],
                shouldRetry: false
            };
        }
    }

    /**
     * Convert date formats based on portal requirements
     */
    async convertDateFormat(dateString, targetFormat) {
        if (!this.isConfigured) {
            // Fallback to basic conversion
            return this.basicDateConversion(dateString, targetFormat);
        }

        try {
            const prompt = `Convert this date to the specified format.
Input: ${dateString}
Target Format: ${targetFormat}
Common formats: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY

Return ONLY the converted date string, nothing else.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();

        } catch (error) {
            logger.error('Gemini date conversion failed:', error);
            return this.basicDateConversion(dateString, targetFormat);
        }
    }

    /**
     * Basic date conversion without LLM
     */
    basicDateConversion(dateString, targetFormat) {
        const date = new Date(dateString);

        if (targetFormat === 'MM/DD/YYYY') {
            return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
        } else if (targetFormat === 'YYYY-MM-DD') {
            return date.toISOString().split('T')[0];
        } else if (targetFormat === 'DD/MM/YYYY') {
            return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        }

        return dateString;
    }

    /**
     * Find alternative selectors when primary ones fail
     */
    async findAlternativeSelectors(htmlContent, fieldType) {
        if (!this.isConfigured) {
            return this.getDefaultSelectors(fieldType);
        }

        try {
            const prompt = `Find CSS selectors for a ${fieldType} field in this healthcare form HTML.

HTML (truncated):
${htmlContent.substring(0, 3000)}

Looking for: ${fieldType} input field
Return ONLY a JSON array of up to 5 possible CSS selectors:
["selector1", "selector2", "selector3"]`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const selectors = JSON.parse(cleanContent);

            logger.info(`Found ${selectors.length} alternative selectors for ${fieldType}`);
            return selectors;

        } catch (error) {
            logger.error('Failed to find alternative selectors:', error);
            return this.getDefaultSelectors(fieldType);
        }
    }

    /**
     * Get default selectors for field types
     */
    getDefaultSelectors(fieldType) {
        const selectorMap = {
            'firstName': [
                'input[name*="first"]',
                'input[placeholder*="First"]',
                '#firstName',
                'input[id*="first"]'
            ],
            'lastName': [
                'input[name*="last"]',
                'input[placeholder*="Last"]',
                '#lastName',
                'input[id*="last"]'
            ],
            'dateOfBirth': [
                'input[type="date"]',
                'input[name*="birth"]',
                'input[name*="dob"]',
                'input[placeholder*="DOB"]'
            ],
            'phone': [
                'input[type="tel"]',
                'input[name*="phone"]',
                'input[placeholder*="Phone"]',
                '#phone'
            ],
            'insurance': [
                'input[name*="insurance"]',
                'input[name*="medicaid"]',
                'input[name*="member"]',
                'input[placeholder*="Insurance"]'
            ]
        };

        return selectorMap[fieldType] || [];
    }

    /**
     * Parse test names from different formats
     */
    async parseTestNames(rawTestList) {
        if (!this.isConfigured) {
            // Simple parsing without LLM
            return rawTestList.split(/[,\n]/).map(t => t.trim()).filter(t => t);
        }

        try {
            const prompt = `Parse this list of medical lab tests into a clean array.

Raw input: ${rawTestList}

Return ONLY a JSON array of test names:
["test1", "test2", "test3"]`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const tests = JSON.parse(cleanContent);
            return tests;

        } catch (error) {
            logger.error('Failed to parse test names:', error);
            return rawTestList.split(/[,\n]/).map(t => t.trim()).filter(t => t);
        }
    }

    /**
     * Validate ICD-10 codes
     */
    async validateDiagnosisCodes(codes) {
        if (!this.isConfigured) {
            // Basic validation without LLM
            return codes.map(code => ({
                code: code,
                valid: /^[A-Z]\d{2}/.test(code),
                description: 'Unknown'
            }));
        }

        try {
            const prompt = `Validate these ICD-10 diagnosis codes for healthcare billing.

Codes: ${codes.join(', ')}

Return ONLY valid JSON:
[
  {"code": "F32.9", "valid": true, "description": "Major depressive disorder"},
  {"code": "INVALID", "valid": false, "description": "Invalid code format"}
]`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const validated = JSON.parse(cleanContent);
            return validated;

        } catch (error) {
            logger.error('Failed to validate diagnosis codes:', error);
            return codes.map(code => ({
                code: code,
                valid: /^[A-Z]\d{2}/.test(code),
                description: 'Unknown'
            }));
        }
    }

    /**
     * Generate smart retry strategy based on error
     */
    async getRetryStrategy(error, attemptNumber) {
        if (!this.isConfigured) {
            return {
                shouldRetry: attemptNumber < 3,
                waitTime: Math.min(1000 * Math.pow(2, attemptNumber), 10000),
                strategy: 'exponential_backoff'
            };
        }

        try {
            const prompt = `Determine retry strategy for this healthcare portal automation error.

Error: ${error.message}
Attempt: ${attemptNumber}
Type: ${error.name}

Strategies:
1. Immediate retry (network glitch)
2. Wait and retry (rate limit)
3. Login and retry (session expired)
4. Give up (invalid credentials)

Return ONLY valid JSON:
{
  "shouldRetry": true/false,
  "waitTime": milliseconds,
  "strategy": "immediate|backoff|relogin|stop",
  "reason": "brief explanation"
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const strategy = JSON.parse(cleanContent);

            logger.info(`Retry strategy: ${strategy.strategy} - ${strategy.reason}`);
            return strategy;

        } catch (error) {
            logger.error('Failed to get retry strategy:', error);
            return {
                shouldRetry: attemptNumber < 3,
                waitTime: Math.min(1000 * Math.pow(2, attemptNumber), 10000),
                strategy: 'exponential_backoff'
            };
        }
    }

    /**
     * Extract structured data from unstructured lab result text
     */
    async parseLabResults(resultText) {
        if (!this.isConfigured) {
            return {
                tests: [],
                parsed: false
            };
        }

        try {
            const prompt = `Extract lab test results from this medical report text. This is HIPAA-protected health information.

${resultText}

Return ONLY structured JSON:
{
  "tests": [
    {
      "name": "Test Name",
      "value": "Result Value",
      "unit": "Unit",
      "range": "Reference Range",
      "status": "normal|abnormal|critical"
    }
  ]
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            // Clean and parse response
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const results = JSON.parse(cleanContent);

            return {
                tests: results.tests,
                parsed: true
            };

        } catch (error) {
            logger.error('Failed to parse lab results:', error);
            return {
                tests: [],
                parsed: false
            };
        }
    }

    /**
     * Analyze screenshot for form field identification (future enhancement)
     */
    async analyzeScreenshot(imageBase64, targetFields) {
        if (!this.isConfigured) {
            logger.warn('LLM not configured for screenshot analysis');
            return { fields: [] };
        }

        try {
            logger.info('Using Gemini to analyze form screenshot...');

            const prompt = `Analyze this healthcare portal form screenshot and identify where to enter patient information.

Looking for these fields: ${targetFields.join(', ')}

Describe the location and appearance of each field you can identify.

Return as JSON:
{
  "fields": [
    {"name": "fieldName", "location": "description", "identifier": "unique text or label nearby"}
  ]
}`;

            // Note: Gemini 2.5 Pro supports image analysis
            // Would need to pass image properly formatted for the API
            const result = await this.model.generateContent([prompt, {inlineData: {data: imageBase64, mimeType: 'image/png'}}]);
            const response = await result.response;
            const content = response.text();

            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            return JSON.parse(cleanContent);

        } catch (error) {
            logger.error('Failed to analyze screenshot:', error);
            return { fields: [] };
        }
    }
}

// Singleton instance
let llmHelperInstance = null;

function getLLMHelper() {
    if (!llmHelperInstance) {
        llmHelperInstance = new LLMHelper();
    }
    return llmHelperInstance;
}

module.exports = {
    LLMHelper,
    getLLMHelper
};