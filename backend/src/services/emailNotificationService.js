// Email Notification Service
// Sends failure notifications to CMO when automation fails

const nodemailer = require('nodemailer');
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

class EmailNotificationService {
    constructor() {
        // Configure email transporter
        this.transporter = null;
        this.cmoEmail = 'hello@trymoonlit.com';
        this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@trymoonlit.com';

        this.initializeTransporter();
    }

    /**
     * Initialize email transporter
     */
    initializeTransporter() {
        try {
            // Check if SMTP credentials are configured
            if (!process.env.SMTP_HOST) {
                logger.warn('SMTP credentials not configured - email notifications will not work');
                logger.warn('Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
                return;
            }

            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            logger.info('Email transporter initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize email transporter:', error);
        }
    }

    /**
     * Send automation failure notification to CMO
     * @param {Object} failureData - Data about the failed automation
     */
    async sendAutomationFailureNotification(failureData) {
        try {
            if (!this.transporter) {
                logger.warn('Email transporter not configured - skipping notification');
                return false;
            }

            const {
                providerName,
                patientData,
                tests,
                diagnoses,
                errorMessage,
                screenshotUrl
            } = failureData;

            // Build HTML email body
            const htmlBody = this.buildFailureEmailHTML(failureData);

            // Build plain text version
            const textBody = this.buildFailureEmailText(failureData);

            // Send email
            const info = await this.transporter.sendMail({
                from: `"MOONLIT Lab Automation" <${this.fromEmail}>`,
                to: this.cmoEmail,
                subject: `Lab Automation Failed - ${providerName}`,
                text: textBody,
                html: htmlBody,
                attachments: screenshotUrl ? [{
                    filename: 'automation-failure-screenshot.png',
                    path: screenshotUrl
                }] : []
            });

            logger.info(`Failure notification email sent: ${info.messageId}`);
            return true;

        } catch (error) {
            logger.error('Failed to send failure notification email:', error);
            return false;
        }
    }

    /**
     * Build HTML email body for failure notification
     */
    buildFailureEmailHTML(data) {
        const {
            providerName,
            patientData,
            tests,
            diagnoses,
            errorMessage,
            screenshotUrl,
            timestamp
        } = data;

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc3545; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #495057; }
        .data-row { margin: 5px 0; }
        .label { font-weight: bold; display: inline-block; width: 150px; }
        .value { color: #212529; }
        .error-box { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; color: #721c24; margin: 20px 0; }
        .test-list { list-style-type: none; padding-left: 0; }
        .test-item { padding: 5px 10px; margin: 5px 0; background-color: white; border-left: 3px solid #007bff; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🚨 Lab Automation Failed - Manual Submission Required</h2>
        </div>

        <div class="section">
            <div class="section-title">Provider Information</div>
            <div class="data-row">
                <span class="label">Provider Name:</span>
                <span class="value">${providerName || 'Unknown'}</span>
            </div>
            <div class="data-row">
                <span class="label">Timestamp:</span>
                <span class="value">${timestamp || new Date().toLocaleString()}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Patient Demographics</div>
            <div class="data-row">
                <span class="label">Name:</span>
                <span class="value">${patientData.firstName} ${patientData.lastName}</span>
            </div>
            <div class="data-row">
                <span class="label">Date of Birth:</span>
                <span class="value">${patientData.dateOfBirth}</span>
            </div>
            ${patientData.medicaidId ? `
            <div class="data-row">
                <span class="label">Medicaid ID:</span>
                <span class="value">${patientData.medicaidId}</span>
            </div>
            ` : ''}
            ${patientData.phone ? `
            <div class="data-row">
                <span class="label">Phone:</span>
                <span class="value">${patientData.phone}</span>
            </div>
            ` : ''}
            ${patientData.address ? `
            <div class="data-row">
                <span class="label">Address:</span>
                <span class="value">${patientData.address.street}, ${patientData.address.city}, ${patientData.address.state} ${patientData.address.zip}</span>
            </div>
            ` : ''}
        </div>

        <div class="section">
            <div class="section-title">Lab Tests Ordered</div>
            <ul class="test-list">
                ${tests.map(test => `
                    <li class="test-item">
                        <strong>${test.name}</strong>
                        ${test.code ? ` (Code: ${test.code})` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>

        ${diagnoses && diagnoses.length > 0 ? `
        <div class="section">
            <div class="section-title">Linked Diagnoses (ICD-10)</div>
            <ul class="test-list">
                ${diagnoses.map(dx => `
                    <li class="test-item">${dx}</li>
                `).join('')}
            </ul>
        </div>
        ` : ''}

        <div class="error-box">
            <strong>Error Message:</strong><br>
            ${errorMessage || 'Unknown error occurred during automation'}
        </div>

        <div class="section">
            <div class="section-title">Action Required</div>
            <p>Please manually submit this lab order via <a href="https://link.labcorp.com">Labcorp Link</a>.</p>
            <p>All necessary information has been provided above. ${screenshotUrl ? 'A screenshot of the failed automation attempt is attached.' : ''}</p>
        </div>

        <div class="footer">
            <p>This is an automated notification from the MOONLIT Lab Portal Automation System.</p>
            <p>If you receive multiple failure notifications, please check the automation configuration.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Build plain text email body for failure notification
     */
    buildFailureEmailText(data) {
        const {
            providerName,
            patientData,
            tests,
            diagnoses,
            errorMessage,
            timestamp
        } = data;

        return `
LAB AUTOMATION FAILED - MANUAL SUBMISSION REQUIRED
=================================================

PROVIDER INFORMATION
-------------------
Provider Name: ${providerName || 'Unknown'}
Timestamp: ${timestamp || new Date().toLocaleString()}

PATIENT DEMOGRAPHICS
-------------------
Name: ${patientData.firstName} ${patientData.lastName}
Date of Birth: ${patientData.dateOfBirth}
${patientData.medicaidId ? `Medicaid ID: ${patientData.medicaidId}\n` : ''}
${patientData.phone ? `Phone: ${patientData.phone}\n` : ''}
${patientData.address ? `Address: ${patientData.address.street}, ${patientData.address.city}, ${patientData.address.state} ${patientData.address.zip}\n` : ''}

LAB TESTS ORDERED
----------------
${tests.map(test => `- ${test.name}${test.code ? ` (Code: ${test.code})` : ''}`).join('\n')}

${diagnoses && diagnoses.length > 0 ? `
LINKED DIAGNOSES (ICD-10)
------------------------
${diagnoses.map(dx => `- ${dx}`).join('\n')}
` : ''}

ERROR MESSAGE
------------
${errorMessage || 'Unknown error occurred during automation'}

ACTION REQUIRED
--------------
Please manually submit this lab order via Labcorp Link (https://link.labcorp.com).
All necessary information has been provided above.

---
This is an automated notification from the MOONLIT Lab Portal Automation System.
        `;
    }

    /**
     * Send test email to verify configuration
     */
    async sendTestEmail() {
        try {
            if (!this.transporter) {
                throw new Error('Email transporter not configured');
            }

            const info = await this.transporter.sendMail({
                from: `"MOONLIT Lab Automation" <${this.fromEmail}>`,
                to: this.cmoEmail,
                subject: 'Test Email - Lab Automation System',
                text: 'This is a test email from the MOONLIT Lab Automation System. If you received this, email notifications are working correctly.',
                html: '<p>This is a test email from the <strong>MOONLIT Lab Automation System</strong>.</p><p>If you received this, email notifications are working correctly.</p>'
            });

            logger.info(`Test email sent: ${info.messageId}`);
            return true;

        } catch (error) {
            logger.error('Failed to send test email:', error);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new EmailNotificationService();
