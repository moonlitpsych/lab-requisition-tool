// IntakeQ API Integration Service
// Handles patient search and data retrieval from IntakeQ

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

class IntakeQService {
    constructor() {
        this.apiKey = process.env.INTAKEQ_API_KEY;
        this.baseUrl = 'https://intakeq.com/api/v1';

        if (!this.apiKey) {
            logger.warn('INTAKEQ_API_KEY not configured - IntakeQ integration will not work');
        }
    }

    /**
     * Search for patients by name (fuzzy search)
     * @param {string} firstName - Patient first name
     * @param {string} lastName - Patient last name (optional)
     * @returns {Promise<Array>} - Array of matching patients
     */
    async searchPatients(firstName, lastName = null) {
        try {
            logger.info(`Searching IntakeQ for patient: ${firstName} ${lastName || ''}`);

            if (!this.apiKey) {
                throw new Error('IntakeQ API key not configured');
            }

            // IntakeQ v1 API - use includeProfile=true to get DateOfBirth and full details
            const url = `${this.baseUrl}/clients?includeProfile=true`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Auth-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`IntakeQ API error: ${response.status} - ${errorText}`);
                throw new Error(`IntakeQ API error: ${response.status}`);
            }

            const allClients = await response.json();

            // The response is directly an array of clients
            const clientsList = Array.isArray(allClients) ? allClients : (allClients.Clients || []);
            logger.debug(`Received ${clientsList.length} total clients from IntakeQ`);

            // Filter clients based on search criteria
            let filteredClients = clientsList;

            // If both firstName and lastName are the same, use OR logic (single name search)
            // Otherwise use AND logic (separate first/last name search)
            const isSingleNameSearch = firstName && lastName && firstName === lastName;

            if (isSingleNameSearch) {
                // Single name search - match against EITHER first OR last name
                filteredClients = filteredClients.filter(client => {
                    const clientName = client.Name || '';
                    const nameParts = clientName.split(' ');
                    const clientFirstName = nameParts[0] || '';
                    const clientLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

                    // Return true if matches EITHER first or last name
                    return this.fuzzyMatch(firstName, clientFirstName) ||
                           this.fuzzyMatch(firstName, clientLastName);
                });
            } else {
                // Separate first/last search - use AND logic
                if (firstName) {
                    filteredClients = filteredClients.filter(client => {
                        const clientName = client.Name || '';
                        const nameParts = clientName.split(' ');
                        const clientFirstName = nameParts[0] || '';
                        return this.fuzzyMatch(firstName, clientFirstName);
                    });
                }

                if (lastName) {
                    filteredClients = filteredClients.filter(client => {
                        const clientName = client.Name || '';
                        const nameParts = clientName.split(' ');
                        const clientLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
                        return this.fuzzyMatch(lastName, clientLastName);
                    });
                }
            }

            logger.info(`Found ${filteredClients.length} matching patients in IntakeQ`);

            // Transform IntakeQ data to our format
            return filteredClients.map(patient => this.transformPatientData(patient));

        } catch (error) {
            logger.error('Failed to search IntakeQ patients:', error);
            throw error;
        }
    }

    /**
     * Get patient by ID
     * @param {string} patientId - IntakeQ patient ID
     * @returns {Promise<Object>} - Patient data
     */
    async getPatientById(patientId) {
        try {
            logger.info(`Fetching IntakeQ patient by ID: ${patientId}`);

            if (!this.apiKey) {
                throw new Error('IntakeQ API key not configured');
            }

            const url = `${this.baseUrl}/clients/${patientId}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Auth-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            });

            logger.debug(`IntakeQ getPatientById response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`IntakeQ API error: ${response.status} - ${errorText.substring(0, 200)}`);
                throw new Error(`IntakeQ API error: ${response.status}`);
            }

            const responseText = await response.text();
            logger.debug(`IntakeQ getPatientById response (first 200 chars): ${responseText.substring(0, 200)}`);

            const patient = JSON.parse(responseText);
            return this.transformPatientData(patient);

        } catch (error) {
            logger.error('Failed to get IntakeQ patient:', error);
            throw error;
        }
    }

    /**
     * Get patient's diagnoses from IntakeQ
     * @param {string} patientId - IntakeQ patient ID
     * @returns {Promise<Array>} - Array of diagnosis codes
     */
    async getPatientDiagnoses(patientId) {
        try {
            logger.info(`Fetching diagnoses for patient: ${patientId}`);

            // IntakeQ may store diagnoses in custom fields or intake forms
            // This is a placeholder - you'll need to customize based on your IntakeQ setup
            const patient = await this.getPatientById(patientId);

            // Extract diagnoses from custom fields if they exist
            const diagnoses = [];
            if (patient.customFields) {
                // Look for diagnosis fields
                const diagnosisFields = patient.customFields.filter(field =>
                    field.name && field.name.toLowerCase().includes('diagnosis')
                );

                diagnosisFields.forEach(field => {
                    if (field.value) {
                        // Parse ICD-10 codes if formatted properly
                        const icd10Match = field.value.match(/[A-Z]\d{2}\.\d{1,2}/g);
                        if (icd10Match) {
                            diagnoses.push(...icd10Match);
                        }
                    }
                });
            }

            logger.info(`Found ${diagnoses.length} diagnoses for patient`);
            return diagnoses;

        } catch (error) {
            logger.error('Failed to get patient diagnoses:', error);
            return []; // Return empty array if we can't fetch diagnoses
        }
    }

    /**
     * Transform IntakeQ patient data to our standard format
     * @param {Object} intakeqPatient - Raw IntakeQ patient data
     * @returns {Object} - Standardized patient data
     */
    transformPatientData(intakeqPatient) {
        // Parse the Name field "FirstName LastName" format
        const fullName = intakeqPatient.Name || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // Convert Unix timestamp to YYYY-MM-DD format
        let dateOfBirth = '';
        if (intakeqPatient.DateOfBirth) {
            // IntakeQ returns DateOfBirth as Unix timestamp in milliseconds
            const dobDate = new Date(intakeqPatient.DateOfBirth);
            dateOfBirth = dobDate.toISOString().split('T')[0]; // YYYY-MM-DD
        }

        const email = intakeqPatient.Email || intakeqPatient.email || '';

        // Generate unique ID with multiple fallbacks
        // Priority: ClientNumber > Id > id > Email > Composite key (name+dob)
        let uniqueId = intakeqPatient.ClientNumber ||
                       intakeqPatient.Id ||
                       intakeqPatient.id ||
                       email;

        // If still no ID, create a composite key from name + DOB
        if (!uniqueId) {
            uniqueId = `${fullName.replace(/\s+/g, '_').toLowerCase()}_${dateOfBirth || 'no_dob'}`;
            logger.debug(`Generated composite ID for patient ${fullName}: ${uniqueId}`);
        }

        return {
            intakeqId: uniqueId,
            firstName: firstName,
            lastName: lastName,
            fullName: fullName,
            dateOfBirth: dateOfBirth,
            email: email,
            phone: intakeqPatient.Phone || intakeqPatient.phone || intakeqPatient.PhoneNumber || '',
            address: {
                street: intakeqPatient.Address || intakeqPatient.address?.street || '',
                city: intakeqPatient.City || intakeqPatient.address?.city || '',
                state: intakeqPatient.State || intakeqPatient.address?.state || '',
                zip: intakeqPatient.ZipCode || intakeqPatient.zipCode || intakeqPatient.address?.zip || ''
            },
            billingType: intakeqPatient.BillingType || '',
            linkedClients: intakeqPatient.LinkedClients || [],
            // Additional fields that might be useful
            customFields: intakeqPatient.CustomFields || intakeqPatient.customFields || [],
            source: 'intakeq'
        };
    }

    /**
     * Fuzzy match patient names (for forgiving search)
     * @param {string} search - Search string
     * @param {string} target - Target string
     * @returns {boolean} - True if fuzzy match
     */
    fuzzyMatch(search, target) {
        if (!search || !target) return false;

        const searchLower = search.toLowerCase().trim();
        const targetLower = target.toLowerCase().trim();

        // Exact match
        if (searchLower === targetLower) return true;

        // Contains match
        if (targetLower.includes(searchLower) || searchLower.includes(targetLower)) return true;

        // Levenshtein distance for minor typos (simplified)
        if (this.levenshteinDistance(searchLower, targetLower) <= 2) return true;

        return false;
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} - Distance
     */
    levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}

// Export singleton instance
module.exports = new IntakeQService();
