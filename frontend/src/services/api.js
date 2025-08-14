// frontend/src/services/api.js
const API_BASE = 'http://localhost:3001/api';

const handleResponse = async (response) => {
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
    }
    return response.json();
};

export const api = {
    // Provider endpoints
    getProviders: async () => {
        const response = await fetch(`${API_BASE}/providers`);
        return handleResponse(response);
    },

    // Lab tests endpoints
    getLabTests: async () => {
        const response = await fetch(`${API_BASE}/lab-tests`);
        return handleResponse(response);
    },

    // Templates endpoints
    getTemplates: async () => {
        const response = await fetch(`${API_BASE}/templates`);
        return handleResponse(response);
    },

    applyTemplate: async (templateId, labCompany = 'labcorp') => {
        const response = await fetch(`${API_BASE}/templates/${templateId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lab_company: labCompany })
        });
        return handleResponse(response);
    },

    // ICD-10 diagnosis endpoints
    searchICD10: async (query) => {
        if (!query || query.length < 2) return [];
        const response = await fetch(`${API_BASE}/icd10/search?query=${encodeURIComponent(query)}`);
        return handleResponse(response);
    },

    getPsychiatricDiagnoses: async () => {
        const response = await fetch(`${API_BASE}/icd10/psychiatric`);
        return handleResponse(response);
    },

    // Payers endpoints
    getPayers: async () => {
        const response = await fetch(`${API_BASE}/payers`);
        return handleResponse(response);
    },

    getMedicaidPayers: async () => {
        const response = await fetch(`${API_BASE}/payers/medicaid`);
        return handleResponse(response);
    },

    // Locations endpoints
    getLocations: async (labCompany = null) => {
        const url = labCompany
            ? `${API_BASE}/locations?lab_company=${labCompany}`
            : `${API_BASE}/locations`;
        const response = await fetch(url);
        return handleResponse(response);
    },

    // Requisitions endpoints
    getRequisitions: async () => {
        const response = await fetch(`${API_BASE}/requisitions`);
        return handleResponse(response);
    },

    createRequisition: async (requisitionData) => {
        const response = await fetch(`${API_BASE}/requisitions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requisitionData)
        });
        return handleResponse(response);
    },

    // Health check
    healthCheck: async () => {
        const response = await fetch(`${API_BASE.replace('/api', '')}/health`);
        return handleResponse(response);
    }
};