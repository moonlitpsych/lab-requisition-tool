// frontend/src/components/ProviderSelect.js
import React from 'react';

const ProviderSelect = ({ providers, selectedProvider, onProviderChange }) => {
    const selectedProviderData = providers.find(p => p.id === selectedProvider);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Provider Selection</h3>
                <div className="text-sm text-gray-500">
                    {providers.length} providers available
                </div>
            </div>

            {/* Provider Dropdown */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Provider *
                </label>
                <select
                    value={selectedProvider}
                    onChange={(e) => onProviderChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                    required
                >
                    <option value="">Choose a provider...</option>
                    {providers.map(provider => (
                        <option key={provider.id} value={provider.id}>
                            {provider.first_name} {provider.last_name}, {provider.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Provider Details */}
            {selectedProviderData && (
                <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Provider & Clinic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Provider Name</label>
                            <input
                                type="text"
                                value={`${selectedProviderData.first_name} ${selectedProviderData.last_name}`}
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Provider NPI</label>
                            <input
                                type="text"
                                value={selectedProviderData.npi || 'N/A'}
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Clinic Name</label>
                            <input
                                type="text"
                                value="MOONLIT"
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Clinic Phone</label>
                            <input
                                type="text"
                                value="385-246-2522"
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Clinic Address</label>
                            <input
                                type="text"
                                value="6211 S Highland Drive, Holladay, UT 84121"
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Clinic Fax</label>
                            <input
                                type="text"
                                value="801-810-1343"
                                readOnly
                                className="mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-500"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderSelect;