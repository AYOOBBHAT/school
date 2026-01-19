import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api.js';
// Import recharts components
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
const COLORS = {
    paid: '#3B82F6', // Blue
    unpaid: '#EF4444', // Red
    partially_paid: '#F59E0B' // Yellow/Orange
};
export default function UnpaidFeeAnalytics({ userRole, onCollectFee }) {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [timeScope, setTimeScope] = useState('last_month');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [expandedStudents, setExpandedStudents] = useState(new Set());
    // Load classes
    useEffect(() => {
        loadClasses();
    }, []);
    // Load analytics when filters change
    useEffect(() => {
        // Load analytics when timeScope is set (always true) or when class is selected
        if (timeScope) {
            loadAnalytics();
        }
    }, [selectedClass, timeScope, currentPage]);
    const loadClasses = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setClasses(result.classes || []);
                // Auto-select first class if available
                if (result.classes && result.classes.length > 0 && !selectedClass) {
                    setSelectedClass(result.classes[0].id);
                }
            }
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
    };
    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const params = new URLSearchParams({
                time_scope: timeScope,
                page: currentPage.toString(),
                limit: pageSize.toString()
            });
            if (selectedClass) {
                params.append('class_group_id', selectedClass);
            }
            const response = await fetch(`${API_URL}/clerk-fees/analytics/unpaid?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
            else {
                const error = await response.json();
                console.error('Error loading analytics:', error);
                alert(error.error || 'Failed to load analytics');
            }
        }
        catch (error) {
            console.error('Error loading analytics:', error);
            alert('Error loading analytics');
        }
        finally {
            setLoading(false);
        }
    };
    // Prepare chart data
    const chartData = useMemo(() => {
        if (!data)
            return [];
        return [
            { name: 'Paid', value: data.chart_data.paid, color: COLORS.paid },
            { name: 'Unpaid', value: data.chart_data.unpaid, color: COLORS.unpaid },
            { name: 'Partially Paid', value: data.chart_data.partially_paid, color: COLORS.partially_paid }
        ].filter(item => item.value > 0);
    }, [data]);
    const handleExportCSV = () => {
        if (!data || data.students.length === 0) {
            alert('No data to export');
            return;
        }
        const headers = ['Student Name', 'Roll Number', 'Class', 'Parent Name', 'Parent Phone', 'Parent Address', 'Pending Months', 'Total Pending Amount'];
        const rows = data.students.map(s => [
            s.student_name,
            s.roll_number,
            s.class_name,
            s.parent_name,
            s.parent_phone,
            s.parent_address,
            s.pending_months,
            s.total_pending.toFixed(2)
        ]);
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unpaid_fees_${selectedClass || 'all'}_${timeScope}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };
    const handleExportPDF = () => {
        // Simple PDF export using window.print() - can be enhanced with a PDF library
        window.print();
    };
    return (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h3", { className: "text-2xl font-bold", children: "Unpaid Fee Analytics" }), userRole === 'principal' && data && data.students.length > 0 && (_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleExportCSV, className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold", children: "Export CSV" }), _jsx("button", { onClick: handleExportPDF, className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold", children: "Export PDF" })] }))] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Select Class" }), _jsxs("select", { value: selectedClass, onChange: (e) => {
                                    setSelectedClass(e.target.value);
                                    setCurrentPage(1);
                                }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classes.map(cls => (_jsx("option", { value: cls.id, children: cls.name }, cls.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Time Scope" }), _jsxs("select", { value: timeScope, onChange: (e) => {
                                    setTimeScope(e.target.value);
                                    setCurrentPage(1);
                                }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "last_month", children: "Last Month" }), _jsx("option", { value: "last_2_months", children: "Last 2 Months" }), _jsx("option", { value: "last_3_months", children: "Last 3 Months" }), _jsx("option", { value: "last_6_months", children: "Last 6 Months" }), _jsx("option", { value: "current_academic_year", children: "Current Academic Year" })] })] })] }), loading ? (_jsx("div", { className: "text-center py-12", children: _jsx("div", { className: "text-gray-500", children: "Loading analytics..." }) })) : data ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-blue-600 font-medium", children: "Total Students" }), _jsx("div", { className: "text-2xl font-bold text-blue-900", children: data.summary.total_students })] }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-red-600 font-medium", children: "Unpaid" }), _jsx("div", { className: "text-2xl font-bold text-red-900", children: data.summary.unpaid_count })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-yellow-600 font-medium", children: "Partially Paid" }), _jsx("div", { className: "text-2xl font-bold text-yellow-900", children: data.summary.partially_paid_count })] }), _jsxs("div", { className: "bg-gray-50 border border-gray-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-gray-600 font-medium", children: "Total Unpaid Amount" }), _jsxs("div", { className: "text-2xl font-bold text-gray-900", children: ["\u20B9", data.summary.total_unpaid_amount.toFixed(2)] })] })] }), chartData.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Payment Status Distribution" }), _jsx("div", { className: "bg-gray-50 rounded-lg p-4", style: { height: '300px' }, children: ResponsiveContainer ? (_jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: chartData, cx: "50%", cy: "50%", labelLine: false, label: ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`, outerRadius: 100, fill: "#8884d8", dataKey: "value", children: chartData.map((entry, index) => (_jsx(Cell, { fill: entry.color }, `cell-${index}`))) }), _jsx(Tooltip, {}), _jsx(Legend, {})] }) })) : (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "text-gray-500 mb-2", children: "Chart library not installed" }), _jsx("p", { className: "text-sm text-gray-400", children: "Run: npm install recharts" }), _jsx("div", { className: "mt-4 flex justify-center gap-4", children: chartData.map((item, idx) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-16 h-16 rounded-full mx-auto mb-2", style: { backgroundColor: item.color } }), _jsx("div", { className: "text-sm font-semibold", children: item.name }), _jsx("div", { className: "text-xs text-gray-600", children: item.value })] }, idx))) })] }) })) })] })), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Unpaid Students List" }), data.students.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No unpaid students found for the selected filters." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Student Name" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Roll Number" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Parent Name" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Phone" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Address" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Pending Months" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Total Pending" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b", children: "Action" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: data.students.map((student) => {
                                                        const isExpanded = expandedStudents.has(student.student_id);
                                                        const hasBreakdown = student.fee_component_breakdown && student.fee_component_breakdown.length > 0;
                                                        return (_jsxs(React.Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50 cursor-pointer", onClick: () => {
                                                                        if (hasBreakdown) {
                                                                            setExpandedStudents(prev => {
                                                                                const newSet = new Set(prev);
                                                                                if (newSet.has(student.student_id)) {
                                                                                    newSet.delete(student.student_id);
                                                                                }
                                                                                else {
                                                                                    newSet.add(student.student_id);
                                                                                }
                                                                                return newSet;
                                                                            });
                                                                        }
                                                                    }, children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium", children: _jsxs("div", { className: "flex items-center gap-2", children: [hasBreakdown && (_jsx("span", { className: "text-gray-400", children: isExpanded ? '▼' : '▶' })), student.student_name] }) }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: student.roll_number }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: student.parent_name }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: student.parent_phone }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: student.parent_address || 'N/A' }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: student.pending_months }), _jsxs("td", { className: "px-4 py-3 text-sm font-semibold text-red-600", children: ["\u20B9", student.total_pending.toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-center", onClick: (e) => e.stopPropagation(), children: userRole === 'clerk' && onCollectFee ? (_jsx("button", { onClick: () => onCollectFee(student.student_id), className: "px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold", children: "Collect Fee" })) : (_jsx("span", { className: "text-sm text-gray-500", children: "View Only" })) })] }), isExpanded && hasBreakdown && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-4 bg-gray-50", children: _jsxs("div", { className: "ml-6", children: [_jsx("h5", { className: "text-sm font-semibold text-gray-700 mb-3", children: "Fee Component Breakdown" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: student.fee_component_breakdown.map((component, idx) => (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-4", children: [_jsx("div", { className: "font-semibold text-gray-900 mb-3", children: component.fee_name }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Total Months Due:" }), _jsx("span", { className: "font-medium", children: component.total_months_due })] }), component.total_months_due_names && component.total_months_due_names.length > 0 && (_jsx("div", { className: "text-xs text-gray-500 pl-2", children: component.total_months_due_names.join(', ') }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Paid Months:" }), _jsx("span", { className: "font-medium text-green-600", children: component.paid_months })] }), component.paid_months_names && component.paid_months_names.length > 0 && (_jsx("div", { className: "text-xs text-green-600 pl-2", children: component.paid_months_names.join(', ') }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Pending Months:" }), _jsx("span", { className: "font-medium text-red-600", children: component.pending_months })] }), component.pending_months_names && component.pending_months_names.length > 0 && (_jsx("div", { className: "text-xs text-red-600 pl-2", children: component.pending_months_names.join(', ') }))] }), _jsxs("div", { className: "border-t border-gray-200 pt-2 mt-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Fee:" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", component.total_fee_amount.toFixed(2)] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Paid:" }), _jsxs("span", { className: "font-medium text-green-600", children: ["\u20B9", component.total_paid_amount.toFixed(2)] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Pending:" }), _jsxs("span", { className: "font-medium text-red-600", children: ["\u20B9", component.total_pending_amount.toFixed(2)] })] })] })] })] }, idx))) })] }) }) }))] }, student.student_id));
                                                    }) })] }) }), data.pagination.total_pages > 1 && (_jsxs("div", { className: "flex justify-between items-center mt-4", children: [_jsxs("div", { className: "text-sm text-gray-600", children: ["Showing ", ((currentPage - 1) * pageSize) + 1, " to ", Math.min(currentPage * pageSize, data.pagination.total), " of ", data.pagination.total, " students"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setCurrentPage(prev => Math.max(1, prev - 1)), disabled: currentPage === 1, className: "px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Previous" }), _jsx("button", { onClick: () => setCurrentPage(prev => Math.min(data.pagination.total_pages, prev + 1)), disabled: currentPage === data.pagination.total_pages, className: "px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50", children: "Next" })] })] }))] }))] })] })) : (_jsx("div", { className: "text-center py-12 text-gray-500", children: "Select a class and time scope to view analytics" }))] }));
}
