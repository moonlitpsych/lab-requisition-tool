// Smart Lab Order Page
// Provider interface with IntakeQ patient search, Medicaid auto-population, and automated submission

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import './SmartLabOrder.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

interface Patient {
    intakeqId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email?: string;
    phone?: string;
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
}

interface LabTest {
    code: string;
    name: string;
    category: string;
    description?: string;
}

interface Diagnosis {
    code: string;
    description: string;
}

interface OrderStatus {
    orderId: string;
    status: string;
    message?: string;
}

const SmartLabOrder: React.FC = () => {
    const navigate = useNavigate();

    // State management
    const [step, setStep] = useState<number>(1);
    const [providerName, setProviderName] = useState<string>('');

    // Patient search - single field
    const [searchName, setSearchName] = useState<string>('');
    const [searchResults, setSearchResults] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    // Medicaid eligibility
    const [medicaidEligibility, setMedicaidEligibility] = useState<any>(null);
    const [isCheckingEligibility, setIsCheckingEligibility] = useState<boolean>(false);

    // Available options
    const [availableTests, setAvailableTests] = useState<LabTest[]>([]);
    const [groupedTests, setGroupedTests] = useState<{ [category: string]: LabTest[] }>({});
    const [availableDiagnoses, setAvailableDiagnoses] = useState<Diagnosis[]>([]);

    // Selected items
    const [selectedTests, setSelectedTests] = useState<LabTest[]>([]);
    const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

    // Search for tests and diagnoses (fuzzy search)
    const [testSearch, setTestSearch] = useState<string>('');
    const [diagnosisSearch, setDiagnosisSearch] = useState<string>('');
    const [filteredTests, setFilteredTests] = useState<LabTest[]>([]);
    const [filteredDiagnoses, setFilteredDiagnoses] = useState<Diagnosis[]>([]);

    // Order submission
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    // Load available tests and diagnoses on mount
    useEffect(() => {
        loadAvailableTests();
        loadAvailableDiagnoses();
    }, []);

    // Setup Socket.io for real-time updates
    useEffect(() => {
        const newSocket = io(API_URL);
        setSocket(newSocket);

        newSocket.on('order-status', (status: OrderStatus) => {
            console.log('Order status update:', status);
            setOrderStatus(status);
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const loadAvailableTests = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/lab-orders/available-tests`);
            setAvailableTests(response.data.tests || []);
            setGroupedTests(response.data.groupedTests || {});
        } catch (error) {
            console.error('Failed to load available tests:', error);
            alert('Failed to load available tests');
        }
    };

    const loadAvailableDiagnoses = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/lab-orders/available-diagnoses`);
            setAvailableDiagnoses(response.data.diagnoses || []);
        } catch (error) {
            console.error('Failed to load available diagnoses:', error);
            alert('Failed to load available diagnoses');
        }
    };

    const handleSearchPatients = async () => {
        if (!searchName.trim()) {
            alert('Please enter a patient name to search');
            return;
        }

        setIsSearching(true);
        try {
            const response = await axios.get(`${API_URL}/api/lab-orders/search-patients`, {
                params: {
                    name: searchName.trim()
                }
            });
            const patients = response.data.patients || [];
            setSearchResults(patients);

            if (patients.length === 0) {
                alert('No patients found matching your search');
            } else if (patients.length === 1) {
                // Auto-select if only one patient found
                setSelectedPatient(patients[0]);
            }
        } catch (error) {
            console.error('Patient search failed:', error);
            alert('Failed to search patients');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectPatient = async (patient: Patient) => {
        if (!patient.dateOfBirth) {
            alert('Patient missing date of birth - cannot check eligibility');
            return;
        }

        setSelectedPatient(patient);
        setIsCheckingEligibility(true);

        try {
            const response = await axios.post(`${API_URL}/api/lab-orders/check-eligibility`, {
                firstName: patient.firstName,
                lastName: patient.lastName,
                dateOfBirth: patient.dateOfBirth,
                intakeqPhone: patient.phone
            });
            setMedicaidEligibility(response.data);

            // Move to test/diagnosis selection after eligibility check
            setStep(2);
        } catch (error) {
            console.error('Eligibility check failed:', error);
            setMedicaidEligibility({ isEligible: false, error: 'Failed to check eligibility' });
            alert('Failed to check Medicaid eligibility. You can still continue with the order.');
            setStep(2);
        } finally {
            setIsCheckingEligibility(false);
        }
    };

    // Fuzzy search filter for tests
    const filterTests = (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setFilteredTests([]);
            return;
        }

        const term = searchTerm.toLowerCase();
        const results = availableTests.filter(test =>
            test.name.toLowerCase().includes(term) ||
            test.code.toLowerCase().includes(term) ||
            (test.description && test.description.toLowerCase().includes(term))
        ).slice(0, 10); // Limit to 10 results

        setFilteredTests(results);
    };

    // Fuzzy search filter for diagnoses
    const filterDiagnoses = (searchTerm: string) => {
        if (!searchTerm.trim()) {
            setFilteredDiagnoses([]);
            return;
        }

        const term = searchTerm.toLowerCase();
        const results = availableDiagnoses.filter(diagnosis =>
            diagnosis.code.toLowerCase().includes(term) ||
            diagnosis.description.toLowerCase().includes(term)
        ).slice(0, 10); // Limit to 10 results

        setFilteredDiagnoses(results);
    };

    const handleTestSearchChange = (value: string) => {
        setTestSearch(value);
        filterTests(value);
    };

    const handleDiagnosisSearchChange = (value: string) => {
        setDiagnosisSearch(value);
        filterDiagnoses(value);
    };

    const handleAddTest = (test: LabTest) => {
        const isSelected = selectedTests.find(t => t.code === test.code);
        if (!isSelected) {
            setSelectedTests([...selectedTests, test]);
        }
        setTestSearch(''); // Clear search after adding
        setFilteredTests([]);
    };

    const handleRemoveTest = (testCode: string) => {
        setSelectedTests(selectedTests.filter(t => t.code !== testCode));
    };

    const handleAddDiagnosis = (diagnosis: Diagnosis) => {
        if (!selectedDiagnoses.includes(diagnosis.code)) {
            setSelectedDiagnoses([...selectedDiagnoses, diagnosis.code]);
        }
        setDiagnosisSearch(''); // Clear search after adding
        setFilteredDiagnoses([]);
    };

    const handleRemoveDiagnosis = (diagnosisCode: string) => {
        setSelectedDiagnoses(selectedDiagnoses.filter(d => d !== diagnosisCode));
    };

    const handleReviewOrder = () => {
        if (selectedTests.length === 0) {
            alert('Please select at least one test');
            return;
        }

        if (selectedDiagnoses.length === 0) {
            alert('Please select at least one diagnosis');
            return;
        }

        setStep(3); // Move to confirmation page
    };

    const handleSubmitOrder = async () => {
        if (!selectedPatient) {
            alert('Please select a patient');
            return;
        }

        setIsSubmitting(true);

        try {
            const orderData = {
                providerName: providerName || 'MOONLIT Provider',
                patient: {
                    firstName: selectedPatient.firstName,
                    lastName: selectedPatient.lastName,
                    dateOfBirth: selectedPatient.dateOfBirth,
                    phone: medicaidEligibility?.demographics?.phone || selectedPatient.phone,
                    medicaidId: medicaidEligibility?.medicaidId || null,
                    address: medicaidEligibility?.demographics?.address || selectedPatient.address
                },
                tests: selectedTests,
                diagnoses: selectedDiagnoses,
                useMedicaidData: medicaidEligibility?.isEligible || false
            };

            const response = await axios.post(`${API_URL}/api/lab-orders/submit`, orderData);

            setOrderStatus(response.data);
            setStep(4); // Move to status page

            // Join Socket.io room for real-time updates
            if (socket && response.data.orderId) {
                socket.emit('join-order-room', response.data.orderId);
            }

        } catch (error) {
            console.error('Failed to submit order:', error);
            alert('Failed to submit lab order. Please try again or submit manually.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStartNew = () => {
        setStep(1);
        setSearchName('');
        setSearchResults([]);
        setSelectedPatient(null);
        setMedicaidEligibility(null);
        setSelectedTests([]);
        setSelectedDiagnoses([]);
        setOrderStatus(null);
    };

    const handleEditSelection = () => {
        setStep(2);
    };

    return (
        <div className="smart-lab-order">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: '#6366f1',
                            color: 'white',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '1rem',
                            transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#4f46e5'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#6366f1'}
                    >
                        ← Back to Classic View
                    </button>
                </div>
                <h1>Smart Lab Order</h1>
                <p>Submit lab orders with automatic Medicaid verification and Labcorp integration</p>
            </div>

            <div className="progress-steps">
                <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                    <span className="step-number">1</span>
                    <span className="step-label">Select Patient</span>
                </div>
                <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                    <span className="step-number">2</span>
                    <span className="step-label">Tests & Diagnoses</span>
                </div>
                <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                    <span className="step-number">3</span>
                    <span className="step-label">Review & Confirm</span>
                </div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>
                    <span className="step-number">4</span>
                    <span className="step-label">Status</span>
                </div>
            </div>

            <div className="order-content">
                {/* Step 1: Patient Search & Selection */}
                {step === 1 && (
                    <div className="step-content">
                        <h2>Step 1: Select Patient</h2>

                        <div className="search-section">
                            <div className="form-group">
                                <label>Patient Name *</label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            type="text"
                                            value={searchName}
                                            onChange={(e) => setSearchName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSearchPatients()}
                                            placeholder="Enter patient first or last name"
                                            style={{ fontSize: '1rem', padding: '0.75rem', width: '100%' }}
                                        />
                                        <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                                            Searches both first and last names
                                        </small>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSearchPatients}
                                        disabled={isSearching || !searchName.trim()}
                                        style={{
                                            fontSize: '1rem',
                                            padding: '0.75rem 1.5rem',
                                            height: '3rem',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="search-results">
                                <h3>Search Results ({searchResults.length})</h3>
                                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                                    Select a patient, then click "Select Patient & Continue"
                                </p>
                                <div className="patient-list">
                                    {searchResults.map((patient) => (
                                        <label
                                            key={patient.intakeqId}
                                            className={`patient-card ${selectedPatient?.intakeqId === patient.intakeqId ? 'selected' : ''}`}
                                            style={{
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem'
                                            }}
                                        >
                                            <input
                                                type="radio"
                                                name="patient-selection"
                                                checked={selectedPatient?.intakeqId === patient.intakeqId}
                                                onChange={() => setSelectedPatient(patient)}
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <div className="patient-info" style={{ flex: 1 }}>
                                                <h4>{patient.firstName} {patient.lastName}</h4>
                                                <p>DOB: {patient.dateOfBirth || 'N/A'}</p>
                                                <p>Phone: {patient.phone || 'N/A'}</p>
                                                {patient.email && <p>Email: {patient.email}</p>}
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => selectedPatient && handleSelectPatient(selectedPatient)}
                                        disabled={!selectedPatient || isCheckingEligibility}
                                        style={{
                                            fontSize: '1.1rem',
                                            padding: '1rem 2rem',
                                            opacity: !selectedPatient ? 0.5 : 1,
                                            cursor: !selectedPatient ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isCheckingEligibility ? 'Checking Eligibility...' : 'Select Patient & Continue'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Select Tests & Diagnoses (Combined) */}
                {step === 2 && (
                    <div className="step-content">
                        <h2>Step 2: Select Tests & Diagnoses</h2>

                        {/* Show patient info banner */}
                        {selectedPatient && (
                            <div className="patient-banner" style={{
                                background: '#f3f4f6',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                marginBottom: '2rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <strong>{selectedPatient.firstName} {selectedPatient.lastName}</strong>
                                    <span style={{ marginLeft: '1rem', color: '#6b7280' }}>
                                        DOB: {selectedPatient.dateOfBirth}
                                    </span>
                                    {medicaidEligibility?.isEligible && (
                                        <span style={{ marginLeft: '1rem', color: '#10b981', fontWeight: '500' }}>
                                            ✓ Medicaid Eligible
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setStep(1)}
                                    style={{
                                        background: 'none',
                                        border: '1px solid #d1d5db',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.375rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Change Patient
                                </button>
                            </div>
                        )}

                        {/* Tests Section */}
                        <div className="tests-section" style={{ marginBottom: '3rem' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Select Lab Tests</h3>
                            <div className="selected-summary" style={{
                                background: '#eff6ff',
                                padding: '0.75rem',
                                borderRadius: '0.375rem',
                                marginBottom: '1rem'
                            }}>
                                <strong>{selectedTests.length}</strong> test(s) selected
                            </div>

                            {Object.entries(groupedTests).map(([category, tests]) => (
                                <div key={category} className="test-category" style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{
                                        background: '#f9fafb',
                                        padding: '0.75rem',
                                        marginBottom: '0.5rem',
                                        borderRadius: '0.375rem',
                                        fontWeight: '600'
                                    }}>
                                        {category}
                                    </h4>
                                    <div className="test-list">
                                        {tests.map((test) => (
                                            <label
                                                key={test.code}
                                                className="test-checkbox"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '0.75rem',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #e5e7eb'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTests.some(t => t.code === test.code)}
                                                    onChange={() => handleToggleTest(test)}
                                                    style={{ marginRight: '0.75rem', width: '18px', height: '18px' }}
                                                />
                                                <div>
                                                    <strong>{test.name}</strong>
                                                    <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                                                        (Code: {test.code})
                                                    </span>
                                                    {test.description && (
                                                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                                            {test.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Diagnoses Section */}
                        <div className="diagnoses-section">
                            <h3 style={{ marginBottom: '1rem' }}>Select Diagnoses (ICD-10 Codes)</h3>
                            <div className="selected-summary" style={{
                                background: '#fef3c7',
                                padding: '0.75rem',
                                borderRadius: '0.375rem',
                                marginBottom: '1rem'
                            }}>
                                <strong>{selectedDiagnoses.length}</strong> diagnosis/diagnoses selected
                            </div>

                            <div className="diagnosis-list">
                                {availableDiagnoses.map((diagnosis) => (
                                    <label
                                        key={diagnosis.code}
                                        className="diagnosis-checkbox"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.75rem',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #e5e7eb'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedDiagnoses.includes(diagnosis.code)}
                                            onChange={() => handleToggleDiagnosis(diagnosis.code)}
                                            style={{ marginRight: '0.75rem', width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <strong>{diagnosis.code}</strong>
                                            <span style={{ marginLeft: '0.75rem' }}>{diagnosis.description}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Navigation buttons */}
                        <div className="step-navigation" style={{
                            marginTop: '2rem',
                            display: 'flex',
                            justifyContent: 'space-between'
                        }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setStep(1)}
                            >
                                ← Back to Patient Selection
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleReviewOrder}
                                disabled={selectedTests.length === 0 || selectedDiagnoses.length === 0}
                                style={{ fontSize: '1.1rem', padding: '0.75rem 1.5rem' }}
                            >
                                Review Order →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review & Confirm */}
                {step === 3 && (
                    <div className="step-content">
                        <h2>Step 3: Review & Confirm Order</h2>

                        <div className="confirmation-review">
                            {/* Patient Information */}
                            <div className="review-section" style={{
                                background: '#f9fafb',
                                padding: '1.5rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                                    Patient Information
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <strong>Name:</strong> {selectedPatient?.firstName} {selectedPatient?.lastName}
                                    </div>
                                    <div>
                                        <strong>DOB:</strong> {selectedPatient?.dateOfBirth}
                                    </div>
                                    <div>
                                        <strong>Phone:</strong> {medicaidEligibility?.demographics?.phone || selectedPatient?.phone || 'N/A'}
                                    </div>
                                    {medicaidEligibility?.medicaidId && (
                                        <div>
                                            <strong>Medicaid ID:</strong> {medicaidEligibility.medicaidId}
                                        </div>
                                    )}
                                    {medicaidEligibility?.demographics?.address && (
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <strong>Address:</strong> {medicaidEligibility.demographics.address.street}, {medicaidEligibility.demographics.address.city}, {medicaidEligibility.demographics.address.state} {medicaidEligibility.demographics.address.zip}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Selected Tests */}
                            <div className="review-section" style={{
                                background: '#eff6ff',
                                padding: '1.5rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #bfdbfe', paddingBottom: '0.5rem' }}>
                                    Selected Tests ({selectedTests.length})
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {selectedTests.map((test, index) => (
                                        <li key={test.code} style={{
                                            padding: '0.75rem',
                                            background: 'white',
                                            marginBottom: '0.5rem',
                                            borderRadius: '0.375rem',
                                            display: 'flex',
                                            justifyContent: 'space-between'
                                        }}>
                                            <span>
                                                <strong>{index + 1}.</strong> {test.name}
                                            </span>
                                            <span style={{ color: '#6b7280' }}>Code: {test.code}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Selected Diagnoses */}
                            <div className="review-section" style={{
                                background: '#fef9e7',
                                padding: '1.5rem',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            }}>
                                <h3 style={{ marginBottom: '1rem', borderBottom: '2px solid #fde68a', paddingBottom: '0.5rem' }}>
                                    Selected Diagnoses ({selectedDiagnoses.length})
                                </h3>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {selectedDiagnoses.map((code, index) => {
                                        const diagnosis = availableDiagnoses.find(d => d.code === code);
                                        return (
                                            <li key={code} style={{
                                                padding: '0.75rem',
                                                background: 'white',
                                                marginBottom: '0.5rem',
                                                borderRadius: '0.375rem'
                                            }}>
                                                <strong>{index + 1}.</strong> {code} - {diagnosis?.description}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </div>

                        {/* Navigation buttons */}
                        <div className="step-navigation" style={{
                            marginTop: '2rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '1rem'
                        }}>
                            <button
                                className="btn btn-secondary"
                                onClick={handleEditSelection}
                                disabled={isSubmitting}
                            >
                                ← Edit Tests & Diagnoses
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={handleSubmitOrder}
                                disabled={isSubmitting}
                                style={{
                                    background: '#10b981',
                                    fontSize: '1.1rem',
                                    padding: '1rem 2rem',
                                    fontWeight: '600'
                                }}
                            >
                                {isSubmitting ? 'Submitting to Labcorp...' : 'Confirm & Submit Order'}
                            </button>
                        </div>

                        <div style={{ marginTop: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                            By submitting, the order will be automatically sent to Labcorp Link
                        </div>
                    </div>
                )}

                {/* Step 4: Order Status */}
                {step === 4 && (
                    <div className="step-content">
                        <h2>Order Status</h2>

                        {orderStatus && (
                            <div className={`status-card ${orderStatus.status}`} style={{
                                padding: '2rem',
                                borderRadius: '0.5rem',
                                background: orderStatus.status === 'processing' ? '#eff6ff' : orderStatus.status === 'completed' ? '#ecfdf5' : '#fef2f2',
                                border: `2px solid ${orderStatus.status === 'processing' ? '#3b82f6' : orderStatus.status === 'completed' ? '#10b981' : '#ef4444'}`,
                                marginBottom: '2rem'
                            }}>
                                <h3 style={{ marginBottom: '1rem' }}>
                                    {orderStatus.status === 'processing' && '⏳ Processing Order...'}
                                    {orderStatus.status === 'completed' && '✓ Order Submitted Successfully'}
                                    {orderStatus.status === 'failed' && '✗ Order Submission Failed'}
                                </h3>
                                <p><strong>Order ID:</strong> {orderStatus.orderId}</p>
                                {orderStatus.message && <p>{orderStatus.message}</p>}
                            </div>
                        )}

                        <div className="status-actions" style={{ textAlign: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleStartNew}
                                style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
                            >
                                Submit Another Order
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartLabOrder;
