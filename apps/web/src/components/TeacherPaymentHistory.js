import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api';
export default function TeacherPaymentHistory({ teacherId, teacherName, onClose, showHeader = true }) {
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
    const [paymentModeFilter, setPaymentModeFilter] = useState('all');
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const itemsPerPage = 20;
    // Ref to track if component is mounted (for async operations)
    const isMountedRef = useRef(true);
    // Extract loadPaymentHistory as a useCallback so it can be called from both useEffect and retry button
    const loadPaymentHistory = useCallback(async () => {
        try {
            if (!isMountedRef.current)
                return;
            setLoading(true);
            setError(null);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                if (!isMountedRef.current)
                    return;
                setError('Authentication required');
                setLoading(false);
                return;
            }
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: itemsPerPage.toString()
            });
            if (startDate)
                params.append('start_date', startDate);
            if (endDate)
                params.append('end_date', endDate);
            if (paymentTypeFilter !== 'all')
                params.append('payment_type', paymentTypeFilter);
            if (paymentModeFilter !== 'all')
                params.append('payment_mode', paymentModeFilter);
            const response = await fetch(`${API_URL}/salary/history/${teacherId}?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!isMountedRef.current)
                return;
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to load payment history');
            }
            const data = await response.json();
            if (!isMountedRef.current)
                return;
            setPayments(data.payments || []);
            setSummary(data.summary || null);
            setTotalPages(data.pagination?.total_pages || 1);
            setTotalCount(data.pagination?.total || 0);
        }
        catch (err) {
            if (!isMountedRef.current)
                return;
            console.error('Error loading payment history:', err);
            setError(err.message || 'Failed to load payment history');
        }
        finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [teacherId, currentPage, startDate, endDate, paymentTypeFilter, paymentModeFilter]);
    useEffect(() => {
        isMountedRef.current = true;
        loadPaymentHistory();
        // Always return cleanup function to avoid React error #310
        return () => {
            isMountedRef.current = false;
        };
    }, [loadPaymentHistory]);
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
    const getPaymentTypeColor = (type) => {
        switch (type) {
            case 'salary': return 'bg-blue-100 text-blue-800';
            case 'advance': return 'bg-yellow-100 text-yellow-800';
            case 'adjustment': return 'bg-purple-100 text-purple-800';
            case 'bonus': return 'bg-green-100 text-green-800';
            case 'loan': return 'bg-orange-100 text-orange-800';
            case 'other': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const getPaymentModeLabel = (mode) => {
        switch (mode) {
            case 'bank': return 'Bank Transfer';
            case 'cash': return 'Cash';
            case 'upi': return 'UPI';
            default: return mode;
        }
    };
    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setPaymentTypeFilter('all');
        setPaymentModeFilter('all');
        setCurrentPage(1);
    };
    if (loading && payments.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center p-8", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "Loading payment history..." })] }) }));
    }
    if (error && payments.length === 0) {
        return (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-6 text-center", children: [_jsx("p", { className: "text-red-800 font-semibold mb-2", children: "Error" }), _jsx("p", { className: "text-red-600", children: error }), _jsx("button", { onClick: loadPaymentHistory, className: "mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [showHeader && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("h2", { className: "text-2xl font-bold text-gray-900", children: ["Payment History", teacherName && _jsxs("span", { className: "text-gray-600 font-normal", children: [" - ", teacherName] })] }), _jsx("p", { className: "text-gray-600 mt-1", children: "Complete salary and payment history" })] }), onClose && (_jsx("button", { onClick: onClose, className: "text-gray-500 hover:text-gray-700 text-2xl font-bold", children: "\u00D7" }))] })), summary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-sm p-4 border border-gray-200", children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Total Paid" }), _jsx("p", { className: "text-2xl font-bold text-green-600", children: formatCurrency(summary.total_paid_till_date) }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [summary.total_payments, " payments"] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-4 border border-gray-200", children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Pending Amount" }), _jsx("p", { className: "text-2xl font-bold text-red-600", children: formatCurrency(summary.pending_amount) }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Unpaid salaries" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-4 border border-gray-200", children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Average Payment" }), _jsx("p", { className: "text-2xl font-bold text-blue-600", children: formatCurrency(summary.average_payment) }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Per payment" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-4 border border-gray-200", children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: "Date Range" }), _jsx("p", { className: "text-sm font-semibold text-gray-900", children: summary.date_range.first_payment_date
                                    ? formatDate(summary.date_range.first_payment_date)
                                    : 'N/A' }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["to ", summary.date_range.last_payment_date
                                        ? formatDate(summary.date_range.last_payment_date)
                                        : 'N/A'] })] })] })), _jsx("div", { className: "bg-white rounded-lg shadow-sm p-4 border border-gray-200", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Start Date" }), _jsx("input", { type: "date", value: startDate, onChange: (e) => {
                                        setStartDate(e.target.value);
                                        setCurrentPage(1);
                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "End Date" }), _jsx("input", { type: "date", value: endDate, onChange: (e) => {
                                        setEndDate(e.target.value);
                                        setCurrentPage(1);
                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Payment Type" }), _jsxs("select", { value: paymentTypeFilter, onChange: (e) => {
                                        setPaymentTypeFilter(e.target.value);
                                        setCurrentPage(1);
                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", children: [_jsx("option", { value: "all", children: "All Types" }), _jsx("option", { value: "salary", children: "Salary" }), _jsx("option", { value: "advance", children: "Advance" }), _jsx("option", { value: "adjustment", children: "Adjustment" }), _jsx("option", { value: "bonus", children: "Bonus" }), _jsx("option", { value: "loan", children: "Loan/Extra" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Payment Mode" }), _jsxs("select", { value: paymentModeFilter, onChange: (e) => {
                                        setPaymentModeFilter(e.target.value);
                                        setCurrentPage(1);
                                    }, className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", children: [_jsx("option", { value: "all", children: "All Modes" }), _jsx("option", { value: "bank", children: "Bank" }), _jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" })] })] }), _jsx("div", { className: "flex items-end", children: _jsx("button", { onClick: clearFilters, className: "w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium", children: "Clear Filters" }) })] }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gradient-to-r from-blue-50 to-indigo-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Period" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Paid By" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Running Total" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Notes" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: payments.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-12 text-center text-gray-500", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("svg", { className: "w-12 h-12 text-gray-400 mb-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), _jsx("p", { className: "text-lg font-medium", children: "No payments found" }), _jsx("p", { className: "text-sm mt-1", children: "Try adjusting your filters" })] }) }) })) : (payments.map((payment) => (_jsxs("tr", { className: "hover:bg-gray-50 transition-colors", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: formatDate(payment.payment_date) }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-600", children: payment.salary_period_label || 'N/A' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-semibold text-green-600", children: formatCurrency(payment.amount) }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentTypeColor(payment.payment_type)}`, children: payment.payment_type_label }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-600", children: getPaymentModeLabel(payment.payment_mode) }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-600", children: payment.paid_by_name || 'System' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-blue-600", children: formatCurrency(payment.running_total) }) }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "text-sm text-gray-600 max-w-xs truncate", title: payment.notes || '', children: payment.notes || '-' }) })] }, payment.id)))) })] }) }), totalPages > 1 && (_jsxs("div", { className: "bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-700", children: ["Showing page ", currentPage, " of ", totalPages, " (", totalCount, " total payments)"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1, className: "px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Previous" }), _jsx("button", { onClick: () => setCurrentPage(p => Math.min(totalPages, p + 1)), disabled: currentPage === totalPages, className: "px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", children: "Next" })] })] }))] })] }));
}
