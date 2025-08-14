// frontend/src/components/QuickTemplates.js
import React from 'react';

const QuickTemplates = ({ templates, onTemplateSelect }) => {
    const getTemplateColor = (templateName) => {
        const name = templateName.toLowerCase();
        if (name.includes('lithium')) return 'purple';
        if (name.includes('antipsychotic')) return 'pink';
        if (name.includes('stimulant') || name.includes('adhd')) return 'blue';
        if (name.includes('mood') || name.includes('stabilizer')) return 'green';
        if (name.includes('annual') || name.includes('baseline')) return 'orange';
        return 'gray';
    };

    const getColorClasses = (color) => {
        const colorMap = {
            purple: 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white',
            pink: 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white',
            blue: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white',
            green: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white',
            orange: 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white',
            gray: 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white'
        };
        return colorMap[color] || colorMap.gray;
    };

    const getTemplateIcon = (templateName) => {
        const name = templateName.toLowerCase();
        if (name.includes('lithium')) return '🔬';
        if (name.includes('antipsychotic')) return '💊';
        if (name.includes('stimulant') || name.includes('adhd')) return '⚡';
        if (name.includes('mood') || name.includes('stabilizer')) return '🧠';
        if (name.includes('annual') || name.includes('baseline')) return '📋';
        return '🧪';
    };

    const getTemplateDescription = (templateName) => {
        const name = templateName.toLowerCase();
        if (name.includes('lithium')) return 'Monitor lithium levels and kidney function';
        if (name.includes('antipsychotic')) return 'Metabolic monitoring for antipsychotic medications';
        if (name.includes('stimulant') || name.includes('adhd')) return 'Baseline labs before starting stimulants';
        if (name.includes('mood') || name.includes('stabilizer')) return 'Comprehensive mood stabilizer monitoring';
        if (name.includes('annual') || name.includes('baseline')) return 'Annual psychiatric lab panel';
        return 'Quick order template for psychiatric monitoring';
    };

    if (!templates || templates.length === 0) {
        return (
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Quick Order Templates</h3>
                <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-4">⏳</div>
                    <p>Loading templates...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Quick Order Templates</h3>
                <div className="text-sm text-gray-500">
                    {templates.length} templates available
                </div>
            </div>

            <p className="text-sm text-gray-600">
                Click a template to automatically add the recommended lab tests and diagnosis
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                    const color = getTemplateColor(template.name);
                    const colorClasses = getColorClasses(color);
                    const icon = getTemplateIcon(template.name);
                    const description = getTemplateDescription(template.name);

                    return (
                        <button
                            key={template.id}
                            onClick={() => onTemplateSelect(template.id)}
                            className={`${colorClasses} p-6 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl text-left`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="text-2xl">{icon}</div>
                                <div className="bg-white bg-opacity-20 rounded-full px-2 py-1">
                                    <span className="text-xs font-medium">Quick Order</span>
                                </div>
                            </div>

                            <h4 className="font-semibold text-lg mb-2 leading-tight">
                                {template.name}
                            </h4>

                            <p className="text-sm opacity-90 mb-4">
                                {description}
                            </p>

                            {template.suggested_dx_code && (
                                <div className="bg-white bg-opacity-20 rounded-lg p-2">
                                    <p className="text-xs font-medium">Default Diagnosis:</p>
                                    <p className="text-xs">{template.suggested_dx_code}</p>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-blue-800">How Templates Work</h4>
                        <p className="text-xs text-blue-700 mt-1">
                            Templates automatically populate lab tests and suggested diagnoses based on psychiatric monitoring protocols.
                            You can modify the tests after applying a template.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickTemplates;