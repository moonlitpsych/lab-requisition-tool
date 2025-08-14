// frontend/src/components/RequisitionList.js
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const RequisitionList = () => {
    const [requisitions, setRequisitions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filterStatus, setFilterStatus] = useState('all');

    useEffect(() => {
        loadRequisitions();
    }, []);

    const loadRequisitions = async () => {
        setIsLoading(true);
        try {
            const data = await api.getRequisitions();
            setRequisitions(data);
            setError('');
        } catch (error) {
            console.error('Error loading requisitions:', error);
            setError('Failed to load requisitions');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'submitted':
                return 'bg-blue-100 text-blue-800';
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getLabCompanyLogo = (labCompany) => {
        if (labCompany?.toLowerCase() === 'labcorp') {
            return '🔬'; // Labcorp icon
        } else if (labCompany?.toLowerCase() === 'quest') {
            return '⚗️'; // Quest icon
        }
        return '🧪'; // Default lab icon
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const sortedAndFilteredRequisitions = requisitions
        .filter(req => filterStatus === 'all' || req.status === filterStatus)
        .sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            if (sortBy === 'created_at') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading requisitions...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <p className="text-red-600 font-medium">{error}</p>
                <button
                    onClick={loadRequisitions}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">Lab Requisitions</h3>
                <button
                    onClick={loadRequisitions}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center space-x-2"
                >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                    <span>Refresh</span>
                </button>
            </div>

            {/* Filters and Sorting */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
                        <select
                            value={`${sortBy}-${sortOrder}`}
                            onChange={(e) => {
                                const [field, order] = e.target.value.split('-');
                                setSortBy(field);
                                setSortOrder(order);
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="created_at-desc">Newest First</option>
                            <option value="created_at-asc">Oldest First</option>
                            <option value="patient_name-asc">Patient Name A-Z</option>
                            <option value="patient_name-desc">Patient Name Z-A</option>
                            <option value="status-asc">Status A-Z</option>
                        </select>
                    </div>
                </div>

                <div className="text-sm text-gray-600">
                    {sortedAndFilteredRequisitions.length} of {requisitions.length} requisitions
                </div>
            </div>

            {/* Requisitions List */}
            {sortedAndFilteredRequisitions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-6xl mb-4">📋</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No requisitions found</h4>
                    <p className="text-gray-500">
                        {filterStatus === 'all'
                            ? "No lab requisitions have been created yet."
                            : `No requisitions with status "${filterStatus}" found.`
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {sortedAndFilteredRequisitions.map((requisition) => (
                        <div
                            key={requisition.id}
                            className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        {/* Header */}
                                        <div className="flex items-center space-x-3 mb-3">
                                            <span className="text-2xl">{getLabCompanyLogo(requisition.lab_company)}</span>
                                            <div>
                                                <h4 className="text-lg font-semibold text-gray-900">
                                                    {requisition.requisition_number || `REQ-${requisition.id?.slice(-8)}`}
                                                </h4>
                                                <p className="text-sm text-gray-500">
                                                    {formatDate(requisition.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Patient Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Patient</p>
                                                <p className="text-sm font-medium text-gray-900">{requisition.patient_name}</p>
                                                <p className="text-xs text-gray-500">DOB: {requisition.patient_dob}</p>
                                            </div>

                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Diagnosis</p>
                                                <p className="text-sm font-medium text-gray-900">{requisition.diagnosis_code}</p>
                                                {requisition.diagnosis_description && (
                                                    <p className="text-xs text-gray-500 truncate">{requisition.diagnosis_description}</p>
                                                )}
                                            </div>

                                            <div>
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lab Company</p>
                                                <p className="text-sm font-medium text-gray-900 capitalize">
                                                    {requisition.lab_company || 'Labcorp'}
                                                </p>
                                                <p className="text-xs text-gray-500">Medicaid: {requisition.medicaid_id}</p>
                                            </div>
                                        </div>

                                        {/* Tests */}
                                        {requisition.tests && requisition.tests.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                                    Tests Ordered ({requisition.tests.length})
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {requisition.tests.slice(0, 3).map((test, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                                        >
                                                            {test.name || test.code}
                                                        </span>
                                                    ))}
                                                    {requisition.tests.length > 3 && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            +{requisition.tests.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Special Instructions */}
                                        {requisition.special_instructions && (
                                            <div className="mb-4">
                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Special Instructions</p>
                                                <p className="text-sm text-gray-700">{requisition.special_instructions}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex flex-col items-end space-y-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(requisition.status)}`}>
                                            {requisition.status || 'pending'}
                                        </span>

                                        {/* Action Menu */}
                                        <div className="flex space-x-2">
                                            <button
                                                className="text-gray-400 hover:text-gray-600 p-1"
                                                title="View Details"
                                            >
                                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button
                                                className="text-gray-400 hover:text-gray-600 p-1"
                                                title="Download PDF"
                                            >
                                                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RequisitionList;