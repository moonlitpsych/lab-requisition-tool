// frontend/src/components/LabTestManager.js
import React, { useState } from 'react';

const LabTestManager = ({ labTests, selectedTests, onTestAdd, onTestRemove }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const filteredTests = labTests.filter(test =>
        test.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedTests.find(selected => selected.lab_test_id === test.id)
    );

    const handleTestSelect = (test) => {
        onTestAdd(test);
        setSearchTerm('');
        setShowDropdown(false);
    };

    const getTestCategory = (testName) => {
        const name = testName.toLowerCase();
        if (name.includes('metabolic') || name.includes('cmp') || name.includes('bmp')) return 'Chemistry';
        if (name.includes('blood count') || name.includes('cbc') || name.includes('hematology')) return 'Hematology';
        if (name.includes('lipid') || name.includes('cholesterol')) return 'Lipids';
        if (name.includes('thyroid') || name.includes('tsh') || name.includes('t4') || name.includes('t3')) return 'Endocrine';
        if (name.includes('lithium') || name.includes('valproic') || name.includes('level')) return 'Drug Levels';
        if (name.includes('vitamin') || name.includes('b12') || name.includes('folate')) return 'Vitamins';
        if (name.includes('prolactin') || name.includes('hormone')) return 'Hormones';
        return 'Other';
    };

    const getCategoryColor = (category) => {
        const colorMap = {
            'Chemistry': 'bg-blue-100 text-blue-800',
            'Hematology': 'bg-red-100 text-red-800',
            'Lipids': 'bg-yellow-100 text-yellow-800',
            'Endocrine': 'bg-green-100 text-green-800',
            'Drug Levels': 'bg-purple-100 text-purple-800',
            'Vitamins': 'bg-orange-100 text-orange-800',
            'Hormones': 'bg-pink-100 text-pink-800',
            'Other': 'bg-gray-100 text-gray-800'
        };
        return colorMap[category] || colorMap['Other'];
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lab Tests</h3>
                <div className="text-sm text-gray-500">
                    {selectedTests.length} tests selected
                </div>
            </div>

            {/* Test Search/Add */}
            <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Lab Test
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
                        placeholder="Search for lab tests..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                </div>

                {/* Dropdown */}
                {showDropdown && searchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredTests.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500">No tests found</div>
                        ) : (
                            filteredTests.map(test => {
                                const category = getTestCategory(test.name);
                                const categoryColor = getCategoryColor(category);

                                return (
                                    <button
                                        key={test.id}
                                        onClick={() => handleTestSelect(test)}
                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{test.name}</div>
                                                <div className="text-sm text-gray-500 mt-1">
                                                    Labcorp: {test.labcorp_code || 'N/A'} | Quest: {test.quest_code || 'N/A'}
                                                </div>
                                            </div>
                                            <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${categoryColor}`}>
                                                {category}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Selected Tests */}
            {selectedTests.length > 0 ? (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Selected Tests</h4>
                    <div className="space-y-2">
                        {selectedTests.map((test, index) => {
                            const category = getTestCategory(test.name);
                            const categoryColor = getCategoryColor(category);

                            return (
                                <div
                                    key={`${test.lab_test_id}-${index}`}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <span className="font-medium text-gray-900">{test.name}</span>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${categoryColor}`}>
                                                {category}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            Code: {test.code}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onTestRemove(test.lab_test_id)}
                                        className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                        title="Remove test"
                                    >
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-4xl mb-4">🧪</div>
                    <p className="text-lg font-medium">No tests selected</p>
                    <p className="text-sm">Search and add lab tests above, or use a quick template</p>
                </div>
            )}

            {/* Quick Add Common Tests */}
            <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-3">Common Psychiatric Lab Tests</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['Comprehensive Metabolic Panel (CMP)', 'Complete Blood Count with Differential', 'Thyroid Stimulating Hormone (TSH)', 'Lipid Panel', 'Hemoglobin A1c', 'Lithium Level'].map(testName => {
                        const test = labTests.find(t => t.name === testName);
                        const isSelected = test && selectedTests.find(s => s.lab_test_id === test.id);

                        if (!test || isSelected) return null;

                        return (
                            <button
                                key={test.id}
                                onClick={() => handleTestSelect(test)}
                                className="text-xs px-3 py-2 bg-white border border-blue-200 rounded-md hover:bg-blue-50 text-blue-800 font-medium transition-colors"
                            >
                                + {test.name.split(' ').slice(0, 2).join(' ')}
                            </button>
                        );
                    })}
                </div>
            </div>

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

export default LabTestManager;