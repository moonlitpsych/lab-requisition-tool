import React, { useState, useEffect } from 'react';
import './App.css';
import { api } from './services/api';
import ProviderSelect from './components/ProviderSelect';
import PatientForm from './components/PatientForm';
import QuickTemplates from './components/QuickTemplates';
import LabTestManager from './components/LabTestManager';
import DiagnosisSearch from './components/DiagnosisSearch';
import RequisitionList from './components/RequisitionList';
import { downloadPDF, printPDF } from './services/pdfGenerator';

function App() {
    const [currentView, setCurrentView] = useState('create');
    const [providers, setProviders] = useState([]);
    const [labTests, setLabTests] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [patientData, setPatientData] = useState({
        name: '',
        dob: '',
        medicaidId: '',
        phone: ''
    });
    const [selectedTests, setSelectedTests] = useState([]);
    const [selectedDiagnosis, setSelectedDiagnosis] = useState({
        code: '',
        description: ''
    });
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [lastRequisition, setLastRequisition] = useState(null);
    const [showPDFOptions, setShowPDFOptions] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [providersData, labTestsData, templatesData] = await Promise.all([
                api.getProviders(),
                api.getLabTests(),
                api.getTemplates()
            ]);
            setProviders(providersData);
            setLabTests(labTestsData);
            setTemplates(templatesData);
        } catch (error) {
            console.error('Error loading initial data:', error);
            setErrorMessage('Failed to load data. Please refresh the page.');
        }
    };

    const handleTemplateSelect = async (templateId) => {
        try {
            const templateData = await api.applyTemplate(templateId, 'labcorp');
            setSelectedTests(templateData.tests || []);
            if (templateData.suggested_diagnosis) {
                setSelectedDiagnosis(templateData.suggested_diagnosis);
            }
            setSuccessMessage(`Applied template: ${templateData.template_name}`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error applying template:', error);
            setErrorMessage('Failed to apply template');
            setTimeout(() => setErrorMessage(''), 3000);
        }
    };

    const handleTestAdd = (test) => {
        if (!selectedTests.find(t => t.lab_test_id === test.id)) {
            setSelectedTests([...selectedTests, {
                lab_test_id: test.id,
                name: test.name,
                code: test.labcorp_code
            }]);
        }
    };

    const handleTestRemove = (testId) => {
        setSelectedTests(selectedTests.filter(t => t.lab_test_id !== testId));
    };

    const validateForm = () => {
        if (!selectedProvider) {
            setErrorMessage('Please select a provider');
            return false;
        }
        if (!patientData.name || !patientData.dob || !patientData.medicaidId) {
            setErrorMessage('Please fill in all required patient information');
            return false;
        }
        if (selectedTests.length === 0) {
            setErrorMessage('Please add at least one lab test');
            return false;
        }
        if (!selectedDiagnosis.code) {
            setErrorMessage('Please select a diagnosis');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            setTimeout(() => setErrorMessage(''), 5000);
            return;
        }

        setIsSubmitting(true);
        try {
            const requisitionData = {
                provider_id: selectedProvider,
                patient_name: patientData.name,
                patient_dob: patientData.dob,
                patient_phone: patientData.phone,
                medicaid_id: patientData.medicaidId,
                lab_company: 'labcorp',
                location_id: 'ecc663ed-3a8a-4c8d-a2a1-5bf5041daed5', // Murray Labcorp
                payer_id: 'dcf21dac-2711-4940-8b44-742045fc7235', // Default to Southwest Behavioral Health
                diagnosis_code: selectedDiagnosis.code,
                diagnosis_description: selectedDiagnosis.description,
                tests: selectedTests,
                special_instructions: specialInstructions,
                created_by: 'bc0fc904-7cc9-4d22-a094-6a0eb482128d', // System user ID
                status: 'pending'
            };

            const result = await api.createRequisition(requisitionData);
            setSuccessMessage(`✅ Requisition created successfully! ID: ${result.requisition_number}`);

            // Clear form
            setPatientData({ name: '', dob: '', medicaidId: '', phone: '' });
            setSelectedTests([]);
            setSelectedDiagnosis({ code: '', description: '' });
            setSpecialInstructions('');

        } catch (error) {
            console.error('Error creating requisition:', error);
            setErrorMessage('Failed to create requisition. Please try again.');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => {
                setSuccessMessage('');
                setErrorMessage('');
            }, 10000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 to-indigo-700">
            <div className="container mx-auto px-4 py-6">
                {/* Header */}
                <div className="bg-white rounded-t-2xl shadow-xl">
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 text-white p-8 rounded-t-2xl">
                        <h1 className="text-3xl font-bold text-center mb-2">MOONLIT Lab Requisition Tool</h1>
                        <p className="text-center text-gray-200">Modern Lab Ordering for Psychiatric Care</p>
                    </div>

                    {/* Lab Provider Selection */}
                    <div className="bg-indigo-600 text-white p-6 text-center">
                        <span className="text-lg font-medium mr-6">Lab Provider:</span>
                        <label className="mr-8">
                            <input type="radio" name="labProvider" value="labcorp" defaultChecked className="mr-2 scale-125" />
                            Labcorp
                        </label>
                        <label>
                            <input type="radio" name="labProvider" value="quest" className="mr-2 scale-125" />
                            Quest Diagnostics
                        </label>
                    </div>

                    {/* Navigation */}
                    <div className="border-b border-gray-200">
                        <nav className="flex">
                            <button
                                onClick={() => setCurrentView('create')}
                                className={`px-6 py-4 font-medium ${currentView === 'create'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Create Requisition
                            </button>
                            <button
                                onClick={() => setCurrentView('list')}
                                className={`px-6 py-4 font-medium ${currentView === 'list'
                                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                                    : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                View Requisitions
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-b-2xl shadow-xl">
                    {currentView === 'create' ? (
                        <div className="p-8">
                            {/* Success/Error Messages */}
                            {successMessage && (
                                <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                                    {successMessage}
                                </div>
                            )}
                            {errorMessage && (
                                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                                    {errorMessage}
                                </div>
                            )}

                            {/* Provider Selection */}
                            <div className="mb-8">
                                <ProviderSelect
                                    providers={providers}
                                    selectedProvider={selectedProvider}
                                    onProviderChange={setSelectedProvider}
                                />
                            </div>

                            {/* Patient Information */}
                            <div className="mb-8">
                                <PatientForm
                                    patientData={patientData}
                                    onPatientDataChange={setPatientData}
                                />
                            </div>

                            {/* Quick Templates */}
                            <div className="mb-8">
                                <QuickTemplates
                                    templates={templates}
                                    onTemplateSelect={handleTemplateSelect}
                                />
                            </div>

                            {/* Lab Tests */}
                            <div className="mb-8">
                                <LabTestManager
                                    labTests={labTests}
                                    selectedTests={selectedTests}
                                    onTestAdd={handleTestAdd}
                                    onTestRemove={handleTestRemove}
                                />
                            </div>

                            {/* Diagnosis Search */}
                            <div className="mb-8">
                                <DiagnosisSearch
                                    selectedDiagnosis={selectedDiagnosis}
                                    onDiagnosisChange={setSelectedDiagnosis}
                                />
                            </div>

                            {/* Special Instructions */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Instructions</h3>
                                <textarea
                                    value={specialInstructions}
                                    onChange={(e) => setSpecialInstructions(e.target.value)}
                                    placeholder="Fasting required, specific handling instructions, etc."
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-indigo-700 transform hover:-translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Creating Requisition...' : 'Generate Requisition'}
                            </button>
                        </div>
                    ) : (
                        <div className="p-8">
                            <RequisitionList />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;