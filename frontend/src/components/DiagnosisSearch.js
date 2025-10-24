// frontend/src/components/DiagnosisSearch.js
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const DiagnosisSearch = ({ selectedDiagnosis, onDiagnosisChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [psychiatricDiagnoses, setPsychiatricDiagnoses] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadPsychiatricDiagnoses();
    }, []);

    const loadPsychiatricDiagnoses = async () => {
        try {
            const data = await api.getPsychiatricDiagnoses();
            // Extract array from wrapped API response
            setPsychiatricDiagnoses(data.diagnoses || data || []);
        } catch (error) {
            console.error('Error loading psychiatric diagnoses:', error);
            setPsychiatricDiagnoses([]);
        }
    };

    const performSearch = async () => {
        setIsLoading(true);
        try {
            const results = await api.searchICD10(searchTerm);
            setSearchResults(results);
        } catch (error) {
            console.error('Error searching diagnoses:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (searchTerm.length >= 2) {
            performSearch();
        } else {
            setSearchResults([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const handleDiagnosisSelect = (diagnosis) => {
        onDiagnosisChange({
            code: diagnosis.code,
            description: diagnosis.description
        });
        setSearchTerm('');
        setShowDropdown(false);
    };

    const getDiagnosisCategory = (code) => {
        if (code.startsWith('F2')) return 'Psychotic Disorders';
        if (code.startsWith('F3')) return 'Mood Disorders';
        if (code.startsWith('F4')) return 'Anxiety Disorders';
        if (code.startsWith('F9')) return 'ADHD/Childhood Disorders';
        if (code.startsWith('F6')) return 'Personality Disorders';
        if (code.startsWith('F1')) return 'Substance Use Disorders';
        if (code.startsWith('Z')) return 'Monitoring/Other';
        return 'Other';
    };

    const getCategoryColor = (category) => {
        const colorMap = {
            'Psychotic Disorders': 'bg-red-100 text-red-800',
            'Mood Disorders': 'bg-blue-100 text-blue-800',
            'Anxiety Disorders': 'bg-yellow-100 text-yellow-800',
            'ADHD/Childhood Disorders': 'bg-green-100 text-green-800',
            'Personality Disorders': 'bg-purple-100 text-purple-800',
            'Substance Use Disorders': 'bg-orange-100 text-orange-800',
            'Monitoring/Other': 'bg-gray-100 text-gray-800',
            'Other': 'bg-gray-100 text-gray-800'
        };
        return colorMap[category] || colorMap['Other'];
    };

    const groupedPsychiatricDiagnoses = psychiatricDiagnoses.reduce((groups, diagnosis) => {
        const category = getDiagnosisCategory(diagnosis.code);
        if (!groups[category]) groups[category] = [];
        groups[category].push(diagnosis);
        return groups;
    }, {});

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Diagnosis Information</h3>
                {selectedDiagnosis.code && (
                    <div className="text-sm text-green-600 font-medium">
                        ✓ Diagnosis selected
                    </div>
                )}
            </div>

            {/* Search Input */}
            <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search ICD-10 Diagnosis *
                </label>
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search by code or description (e.g., F32.9 or depression)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {isLoading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
                        ) : (
                            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* Search Results Dropdown */}
                {showDropdown && searchTerm && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map(diagnosis => {
                            const category = getDiagnosisCategory(diagnosis.code);
                            const categoryColor = getCategoryColor(category);

                            return (
                                <button
                                    key={`${diagnosis.code}-search`}
                                    onClick={() => handleDiagnosisSelect(diagnosis)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">{diagnosis.code}</div>
                                            <div className="text-sm text-gray-600 mt-1">{diagnosis.description}</div>
                                        </div>
                                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${categoryColor}`}>
                                            {category}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Selected Diagnosis Display */}
            {selectedDiagnosis.code && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h4 className="font-medium text-green-900">Selected Diagnosis</h4>
                            <div className="mt-2">
                                <span className="font-mono text-lg font-semibold text-green-800">
                                    {selectedDiagnosis.code}
                                </span>
                                {selectedDiagnosis.description && (
                                    <p className="text-green-700 mt-1">{selectedDiagnosis.description}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => onDiagnosisChange({ code: '', description: '' })}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full transition-colors"
                            title="Clear diagnosis"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Common Psychiatric Diagnoses */}
            {!selectedDiagnosis.code && (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Common Psychiatric Diagnoses</h4>

                    {Object.entries(groupedPsychiatricDiagnoses).map(([category, diagnoses]) => {
                        const categoryColor = getCategoryColor(category);

                        return (
                            <div key={category} className="space-y-2">
                                <h5 className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${categoryColor}`}>
                                    {category}
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {diagnoses.slice(0, 6).map(diagnosis => (
                                        <button
                                            key={`${diagnosis.code}-common`}
                                            onClick={() => handleDiagnosisSelect(diagnosis)}
                                            className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                                        >
                                            <div className="font-mono font-semibold text-gray-900">{diagnosis.code}</div>
                                            <div className="text-sm text-gray-600 truncate">{diagnosis.description}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Click outside to close dropdown */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
};

export default DiagnosisSearch;