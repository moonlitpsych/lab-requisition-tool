// frontend/src/components/PatientForm.js
import React from 'react';

const PatientForm = ({ patientData, onPatientDataChange }) => {
    const handleChange = (field, value) => {
        onPatientDataChange({
            ...patientData,
            [field]: value
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
                <div className="text-sm text-gray-500">
                    * Required fields
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Patient Name *
                    </label>
                    <input
                        type="text"
                        value={patientData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        placeholder="Last, First"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    />
                    <p className="mt-1 text-xs text-gray-500">Format: Smith, John</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth *
                    </label>
                    <input
                        type="date"
                        value={patientData.dob}
                        onChange={(e) => handleChange('dob', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sex *
                    </label>
                    <select
                        value={patientData.sex}
                        onChange={(e) => handleChange('sex', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    >
                        <option value="">Select...</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Medicaid ID Number *
                    </label>
                    <input
                        type="text"
                        value={patientData.medicaidId}
                        onChange={(e) => handleChange('medicaidId', e.target.value)}
                        placeholder="Enter Medicaid ID"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Patient Phone
                    </label>
                    <input
                        type="tel"
                        value={patientData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="(555) 555-5555"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Insurance Information Section */}
            <div className="bg-blue-50 rounded-lg p-6 mt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Insurance Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Insurance Provider *</label>
                        <select
                            value={patientData.insuranceProvider || 'UTAH MEDICAID FFS'}
                            onChange={(e) => handleChange('insuranceProvider', e.target.value)}
                            className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="UTAH MEDICAID FFS">UTAH MEDICAID FFS</option>
                            <option value="OPTUM MEDICAID">OPTUM MEDICAID</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Member ID</label>
                        <input
                            type="text"
                            value={patientData.medicaidId}
                            readOnly
                            className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                        />
                    </div>
                </div>
                <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-md">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-green-800">
                                ✓ BILL INSURANCE - DO NOT BILL PATIENT
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lab Location Information */}
            <div className="bg-purple-50 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Lab Location</h4>
                <div className="space-y-2">
                    <p className="font-medium text-purple-800">Labcorp - Murray Location</p>
                    <p className="text-sm text-gray-600">5126 S State St, Murray, UT 84107</p>
                    <p className="text-sm text-gray-600">Phone: (801) 268-2552</p>
                    <p className="text-xs text-gray-500">Default location for all orders</p>
                </div>
            </div>
        </div>
    );
};

export default PatientForm;