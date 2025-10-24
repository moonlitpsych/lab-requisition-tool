// Insurance Helper Module for Labcorp Link Automation
// File: backend/src/services/portalAgents/insuranceHelper.js

const UTAH_MEDICAID_MCOS = [
    'Healthy U',
    'University of Utah Health Plans',
    'Molina Healthcare',
    'Select Health',
    'Health Choice Utah',
    'Anthem'
];

const UTAH_MEDICAID_FFS = [
    'Targeted Adult Medicaid',
    'Traditional Medicaid',
    'Utah Medicaid'
];

const PAYOR_CODES = {
    'Medicaid': 'UT',
    'Healthy U': 'UT',
    'Molina Healthcare of Utah': 'UT',
    'Select Health Community Care': 'UT',
    'Health Choice Utah': 'UT',
    'Targeted Adult Medicaid': 'UT',
    'Medicare': '05'
};

function isMedicaid(insuranceName, medicaidId) {
    if (medicaidId) return true;
    const name = insuranceName?.toLowerCase() || '';
    return UTAH_MEDICAID_MCOS.some(mco => name.includes(mco.toLowerCase())) ||
        UTAH_MEDICAID_FFS.some(ffs => name.includes(ffs.toLowerCase()));
}

function isMedicare(insuranceName, medicareId) {
    if (medicareId) return true;
    return insuranceName?.toLowerCase().includes('medicare');
}

function getPayorCode(insuranceName, medicaidId = null) {
    if (isMedicaid(insuranceName, medicaidId)) return 'UT';
    if (isMedicare(insuranceName)) return '05';
    if (insuranceName && PAYOR_CODES[insuranceName]) return PAYOR_CODES[insuranceName];
    for (const [name, code] of Object.entries(PAYOR_CODES)) {
        if (insuranceName?.includes(name) && code) return code;
    }
    return null;
}

function getBillMethod(patientData) {
    if (patientData.medicareId || isMedicare(patientData.insuranceProvider)) return 'Medicare';
    if (patientData.medicaidId || isMedicaid(patientData.insuranceProvider, patientData.medicaidId)) return 'Medicaid';
    if (patientData.insuranceProvider && patientData.insuranceId) return 'Private Insurance';
    return 'Client';
}

function formatDOB(dob) {
    if (!dob) return '';
    let date = typeof dob === 'string' ? new Date(dob) : dob;
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

module.exports = { isMedicaid, isMedicare, getPayorCode, getBillMethod, formatDOB, PAYOR_CODES };