// Medicaid Eligibility Service - X12 270/271 Integration
// Uses Office Ally API to verify Utah Medicaid eligibility
// Returns patient demographics exactly as Medicaid has them (for Labcorp auto-population)
// Updated to use database-driven approach from medicaid-eligibility-checker

const winston = require('winston');
const { createClient } = require('@supabase/supabase-js');

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

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    logger.info('Supabase client initialized for Medicaid eligibility service');
} else {
    logger.warn('Supabase not configured - will use fallback provider config');
}

// Office Ally Configuration
const OFFICE_ALLY_CONFIG = {
    endpoint: process.env.OFFICE_ALLY_ENDPOINT || 'https://wsd.officeally.com/TransactionService/rtx.svc',
    receiverID: 'OFFALLY',
    senderID: process.env.OFFICE_ALLY_SENDER_ID || '1161680',
    username: process.env.OFFICE_ALLY_USERNAME,
    password: process.env.OFFICE_ALLY_PASSWORD,
    providerNPI: process.env.OFFICE_ALLY_PROVIDER_NPI || '1275348807',
    providerName: 'MOONLIT_PLLC',
    payerID: 'UTMCD' // Utah Medicaid Office Ally payer ID
};

class MedicaidEligibilityService {
    constructor() {
        this.config = OFFICE_ALLY_CONFIG;
    }

    /**
     * Check Medicaid eligibility for a patient
     * @param {Object} patientInfo - Patient demographic info
     * @param {string} patientInfo.firstName
     * @param {string} patientInfo.lastName
     * @param {string} patientInfo.dateOfBirth - Format: YYYY-MM-DD or MM/DD/YYYY
     * @param {string} patientInfo.medicaidId - Optional Medicaid ID
     * @returns {Promise<Object>} - Eligibility response with demographics
     */
    async checkEligibility(patientInfo) {
        try {
            // Validate Office Ally credentials are configured
            if (!this.config.username || !this.config.password) {
                throw new Error('Office Ally credentials not configured. Please set OFFICE_ALLY_USERNAME and OFFICE_ALLY_PASSWORD environment variables.');
            }

            logger.info(`Checking Medicaid eligibility for: ${patientInfo.firstName} ${patientInfo.lastName}`);

            // Generate X12 270 request using database-driven approach
            const x12Request = await this.generateX12_270Request(patientInfo);
            logger.debug('Generated X12 270 request');

            // Send to Office Ally using CORE envelope
            const x12Response = await this.sendToOfficeAlly(x12Request);
            logger.debug('Received X12 271 response from Office Ally');

            // Parse X12 271 response
            const eligibilityData = this.parseX12_271Response(x12Response);

            logger.info(`Eligibility check complete: ${eligibilityData.isEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);

            return eligibilityData;

        } catch (error) {
            logger.error('Medicaid eligibility check failed:', error);
            throw error;
        }
    }

    /**
     * Get preferred provider for Utah Medicaid from database
     */
    async getPreferredProvider() {
        // Try to get from database first
        if (supabase) {
            try {
                const { data: provider, error } = await supabase
                    .from('v_provider_office_ally_configs')
                    .select('*')
                    .contains('supported_office_ally_payer_ids', ['UTMCD'])
                    .eq('is_active', true)
                    .limit(1)
                    .single();

                if (!error && provider) {
                    logger.debug(`Using database provider: ${provider.office_ally_provider_name}`);
                    return {
                        name: provider.office_ally_provider_name,
                        npi: provider.provider_npi
                    };
                }
            } catch (error) {
                logger.warn('Failed to fetch provider from database:', error);
            }
        }

        // Fallback to configured provider
        return {
            name: this.config.providerName,
            npi: this.config.providerNPI
        };
    }

    /**
     * Generate X12 270 eligibility inquiry using database-driven approach
     */
    async generateX12_270Request(patientData) {
        const providerInfo = await this.getPreferredProvider();

        const now = new Date();
        const ctrl = Date.now().toString().slice(-9);

        // Use LOCAL time for dates (not UTC) to avoid "future date" errors
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const yymmdd = `${String(year).slice(2)}${month}${day}`;
        const hhmm = `${hours}${minutes}`;
        const ccyymmdd = `${year}${month}${day}`;

        // Format date of birth
        const dob = (patientData.dateOfBirth || '').replace(/-/g, '').replace(/\//g, '');

        // Pad ISA fields to 15 characters
        const pad15 = s => (s ?? '').toString().padEnd(15, ' ');
        const ISA06 = pad15(this.config.senderID);
        const ISA08 = pad15(this.config.receiverID);

        const seg = [];

        // ISA - Interchange Control Header
        seg.push(`ISA*00*          *00*          *ZZ*${ISA06}*01*${ISA08}*${yymmdd}*${hhmm}*^*00501*${ctrl}*0*P*:`);

        // GS - Functional Group Header
        seg.push(`GS*HS*${this.config.senderID}*${this.config.receiverID}*${ccyymmdd}*${hhmm}*${ctrl}*X*005010X279A1`);

        // ST - Transaction Set Header
        seg.push(`ST*270*0001*005010X279A1`);

        // BHT - Beginning of Hierarchical Transaction
        seg.push(`BHT*0022*13*${providerInfo.name.replace(/\s/g, '')}-${ctrl}*20${yymmdd}*${hhmm}`);

        // 2100A: Information Source (Payer - Utah Medicaid)
        seg.push(`HL*1**20*1`);
        seg.push(`NM1*PR*2*MEDICAID UTAH*****PI*${this.config.payerID}`);

        // 2100B: Information Receiver (Provider)
        seg.push(`HL*2*1*21*1`);
        seg.push(`NM1*1P*2*${providerInfo.name}*****XX*${providerInfo.npi}`);

        // 2100C: Subscriber (Patient)
        seg.push(`HL*3*2*22*0`);
        seg.push(`TRN*1*${ctrl}*${providerInfo.npi}*ELIGIBILITY`);

        // NM1 - Patient Name segment
        seg.push(`NM1*IL*1*${(patientData.lastName||'').toUpperCase()}*${(patientData.firstName||'').toUpperCase()}`);

        // DMG - Demographics segment
        if (dob) {
            seg.push(`DMG*D8*${dob}`);
        }

        // DTP - Date segment (Utah Medicaid uses RD8 range format)
        if (dob) {
            seg.push(`DTP*291*RD8*${ccyymmdd}-${ccyymmdd}`);
        }

        // EQ - Eligibility or Benefit Inquiry
        seg.push(`EQ*30`); // 30 = Health Benefit Plan Coverage

        // SE - Transaction Set Trailer
        const stIndex = seg.findIndex(s => s.startsWith('ST*'));
        const count = seg.length - stIndex + 1;
        seg.push(`SE*${count}*0001`);

        // GE - Functional Group Trailer
        seg.push(`GE*1*${ctrl}`);

        // IEA - Interchange Control Trailer
        seg.push(`IEA*1*${ctrl}`);

        return seg.join('~') + '~';
    }

    /**
     * Generate UUID for SOAP request
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Send X12 request to Office Ally using CORE envelope format
     */
    async sendToOfficeAlly(x12Payload) {
        try {
            const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            const payloadID = this.generateUUID();

            // Build CORE SOAP envelope (correct format for Office Ally)
            const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope">
<soapenv:Header>
<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
<wsse:UsernameToken>
<wsse:Username>${this.config.username}</wsse:Username>
<wsse:Password>${this.config.password}</wsse:Password>
</wsse:UsernameToken>
</wsse:Security>
</soapenv:Header>
<soapenv:Body>
<ns1:COREEnvelopeRealTimeRequest xmlns:ns1="http://www.caqh.org/SOAP/WSDL/CORERule2.2.0.xsd">
<PayloadType>X12_270_Request_005010X279A1</PayloadType>
<ProcessingMode>RealTime</ProcessingMode>
<PayloadID>${payloadID}</PayloadID>
<TimeStamp>${timestamp}</TimeStamp>
<SenderID>${this.config.senderID}</SenderID>
<ReceiverID>${this.config.receiverID}</ReceiverID>
<CORERuleVersion>2.2.0</CORERuleVersion>
<Payload>
<![CDATA[${x12Payload}]]>
</Payload>
</ns1:COREEnvelopeRealTimeRequest>
</soapenv:Body>
</soapenv:Envelope>`;

            logger.debug('Sending SOAP request to Office Ally...');
            logger.debug(`Endpoint: ${this.config.endpoint}`);
            logger.debug(`Username: ${this.config.username}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            try {
                const response = await fetch(this.config.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/soap+xml; charset=utf-8;action=RealTimeTransaction;',
                        'Action': 'RealTimeTransaction'
                    },
                    body: soapEnvelope,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    logger.error(`Office Ally API error response: ${errorText.substring(0, 500)}`);
                    throw new Error(`Office Ally API error: ${response.status} ${response.statusText}`);
                }

                const responseText = await response.text();
                logger.debug('Received SOAP response from Office Ally');
                logger.debug('Response length:', responseText.length);

                // Save response to file for debugging (optional - don't fail if directory doesn't exist)
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const debugTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const debugDir = path.join(__dirname, '../..', 'test-screenshots');
                    const debugFile = path.join(debugDir, `soap-response-${debugTimestamp}.xml`);

                    // Create directory if it doesn't exist
                    if (!fs.existsSync(debugDir)) {
                        fs.mkdirSync(debugDir, { recursive: true });
                    }

                    fs.writeFileSync(debugFile, responseText);
                    logger.debug(`SOAP response saved to: ${debugFile}`);
                } catch (debugError) {
                    // Don't fail eligibility check if we can't save debug file
                    logger.warn('Could not save SOAP response to file:', debugError.message);
                }

                // Extract X12 271 from CORE SOAP response
                // Try multiple patterns: with CDATA, without CDATA, with xmlns="", etc.
                const payloadMatch = responseText.match(/<Payload[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/Payload>/s) ||
                                    responseText.match(/<Payload[^>]*>(.*?)<\/Payload>/s) ||
                                    responseText.match(/<ns1:Payload[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/ns1:Payload>/s) ||
                                    responseText.match(/<ns1:Payload[^>]*>(.*?)<\/ns1:Payload>/s) ||
                                    responseText.match(/<ns:Payload[^>]*>(.*?)<\/ns:Payload>/s) ||
                                    responseText.match(/<ns2:Payload[^>]*>(.*?)<\/ns2:Payload>/s);

                if (!payloadMatch) {
                    logger.error('SOAP response (first 1000 chars):', responseText.substring(0, 1000));
                    throw new Error('No X12 271 payload found in SOAP response');
                }

                return payloadMatch[1].trim();

            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    logger.error('Office Ally request timed out after 30 seconds');
                    throw new Error('Office Ally request timed out - please try again');
                }
                logger.error('Office Ally API request failed:', error.message);
                throw error;
            }
        } catch (error) {
            logger.error('Failed to send X12 270 request:', error.message);
            throw error;
        }
    }

    /**
     * Parse X12 271 eligibility response
     */
    parseX12_271Response(x12Data) {
        logger.debug('Parsing X12 271 response...');

        const result = {
            isEligible: false,
            isTraditionalFFS: false,
            planType: 'UNKNOWN',
            medicaidId: null,
            demographics: {
                firstName: null,
                lastName: null,
                dateOfBirth: null,
                phone: null,
                address: {
                    street: null,
                    city: null,
                    state: null,
                    zip: null
                }
            },
            rawX12: x12Data
        };

        // Split into segments
        const segments = x12Data.split(/[~\n]/);

        let inPatientSection = false; // Track if we're in the patient (IL) section
        let inLoopSection = false; // Track if we've entered LS loop (other entities)

        for (const segment of segments) {
            const fields = segment.split('*');
            const segmentId = fields[0];

            // LS - Start of loop (additional entities like transportation providers)
            // Stop capturing address/phone after this point
            if (segmentId === 'LS') {
                inLoopSection = true;
                logger.debug('Entered LS loop section - ignoring subsequent N3/N4/PER segments');
            }

            // NM1 - Name segments
            if (segmentId === 'NM1') {
                const entityType = fields[1];

                // PR = Payer - check if Utah Medicaid
                if (entityType === 'PR' && segment.includes('MEDICAID UTAH')) {
                    logger.debug('Confirmed Utah Medicaid as payer');
                }

                // IL = Insured/Patient
                if (entityType === 'IL') {
                    result.demographics.lastName = fields[3];
                    result.demographics.firstName = fields[4];
                    result.medicaidId = fields[9]; // Member ID
                    inPatientSection = true;
                    logger.debug(`Patient: ${fields[4]} ${fields[3]}, ID: ${fields[9]}`);
                }
            }

            // N3 - Address Line (only capture if in patient section and not in loop)
            if (segmentId === 'N3' && inPatientSection && !inLoopSection) {
                result.demographics.address.street = fields[1];
                if (fields[2]) {
                    result.demographics.address.street += ' ' + fields[2]; // Address line 2
                }
                logger.debug(`Patient Address: ${result.demographics.address.street}`);
            }

            // N4 - City, State, ZIP (only capture if in patient section and not in loop)
            if (segmentId === 'N4' && inPatientSection && !inLoopSection) {
                result.demographics.address.city = fields[1];
                result.demographics.address.state = fields[2];
                result.demographics.address.zip = fields[3];
                logger.debug(`Patient City/State/ZIP: ${fields[1]}, ${fields[2]} ${fields[3]}`);
            }

            // PER - Contact Information (only capture if in patient section and not in loop)
            if (segmentId === 'PER' && inPatientSection && !inLoopSection) {
                // PER*IC*Contact Name*TE*Phone Number
                for (let i = 3; i < fields.length; i += 2) {
                    if (fields[i] === 'TE' && fields[i + 1]) {
                        result.demographics.phone = fields[i + 1];
                        logger.debug(`Patient Phone: ${result.demographics.phone}`);
                        break;
                    }
                }
            }

            // DMG - Demographics (Date of Birth)
            if (segmentId === 'DMG') {
                const dob = fields[2]; // Format: YYYYMMDD
                if (dob && dob.length === 8) {
                    result.demographics.dateOfBirth = `${dob.substring(4, 6)}/${dob.substring(6, 8)}/${dob.substring(0, 4)}`;
                    logger.debug(`DOB: ${result.demographics.dateOfBirth}`);
                }
            }

            // EB - Eligibility or Benefit Information
            if (segmentId === 'EB') {
                const eligibilityCode = fields[1]; // 1 = Active Coverage
                const planDescription = fields[3];

                if (eligibilityCode === '1') {
                    result.isEligible = true;
                    logger.debug('Patient has active coverage');
                }

                // Check for Traditional Medicaid FFS vs Managed Care
                if (planDescription && planDescription.includes('TARGETED ADULT MEDICAID')) {
                    result.isTraditionalFFS = true;
                    result.planType = 'TRADITIONAL_FFS';
                    logger.debug('Plan type: Traditional FFS (Targeted Adult Medicaid)');
                } else if (planDescription && (planDescription.includes('HM') || planDescription.includes('MOLINA') ||
                           planDescription.includes('SELECTHEALTH') || planDescription.includes('ANTHEM'))) {
                    result.planType = 'MANAGED_CARE';
                    logger.debug('Plan type: Managed Care');
                }
            }
        }

        return result;
    }
}

// Export singleton instance
module.exports = new MedicaidEligibilityService();
