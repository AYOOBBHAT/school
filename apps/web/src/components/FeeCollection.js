import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
export default function FeeCollection() {
    const [students, setStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [feeStructure, setFeeStructure] = useState(null);
    const [monthlyLedger, setMonthlyLedger] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [paymentForm, setPaymentForm] = useState({
        payment_amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'cash',
        transaction_id: '',
        cheque_number: '',
        bank_name: '',
        notes: ''
    });
    const [processingPayment, setProcessingPayment] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPaymentHistory, setShowPaymentHistory] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    useEffect(() => {
        loadStudents();
    }, []);
    const loadStudents = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/students`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const studentsList = (data.students || []).map((s) => ({
                    id: s.id,
                    name: s.profile?.full_name || 'Unknown',
                    roll_number: s.roll_number || 'N/A',
                    class: s.class_groups?.name || 'N/A'
                }));
                setStudents(studentsList);
            }
        }
        catch (error) {
            console.error('Error loading students:', error);
        }
    };
    const loadStudentFeeData = async (studentId) => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/clerk-fees/student/${studentId}/fee-structure`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.message && data.message === 'No fee configured for this student') {
                    setFeeStructure(null);
                    setMonthlyLedger([]);
                }
                else {
                    setFeeStructure(data.fee_structure);
                    setMonthlyLedger(data.monthly_ledger || []);
                }
            }
            else {
                const errorData = await response.json().catch(() => ({}));
                if (errorData.error && errorData.error.includes('No fee configured')) {
                    setFeeStructure(null);
                    setMonthlyLedger([]);
                }
                else {
                    alert(errorData.error || 'Failed to load fee data');
                }
            }
        }
        catch (error) {
            console.error('Error loading fee data:', error);
            alert('Error loading fee data');
        }
        finally {
            setLoading(false);
        }
    };
    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        loadStudentFeeData(student.id);
        setSelectedComponents([]);
        setShowPaymentHistory(false);
    };
    const loadPaymentHistory = async () => {
        if (!selectedStudent)
            return;
        setLoadingHistory(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/clerk-fees/student/${selectedStudent.id}/payments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPaymentHistory(data.payments || []);
                setShowPaymentHistory(true);
            }
        }
        catch (error) {
            console.error('Error loading payment history:', error);
        }
        finally {
            setLoadingHistory(false);
        }
    };
    const handleComponentToggle = (componentId) => {
        setSelectedComponents(prev => prev.includes(componentId)
            ? prev.filter(id => id !== componentId)
            : [...prev, componentId]);
    };
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (selectedComponents.length === 0) {
            alert('Please select at least one fee component');
            return;
        }
        if (!selectedStudent)
            return;
        setProcessingPayment(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/clerk-fees/collect`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    monthly_fee_component_ids: selectedComponents,
                    payment_amount: parseFloat(paymentForm.payment_amount),
                    payment_date: paymentForm.payment_date,
                    payment_mode: paymentForm.payment_mode,
                    transaction_id: paymentForm.transaction_id || null,
                    cheque_number: paymentForm.cheque_number || null,
                    bank_name: paymentForm.bank_name || null,
                    notes: paymentForm.notes || null
                })
            });
            if (response.ok) {
                const data = await response.json();
                // Store full payment data for receipt
                const receiptPayload = {
                    ...data,
                    payment: {
                        ...data.payment,
                        amount_paid: data.payment?.amount_paid || data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
                        payment_amount: data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
                        payment_date: data.payment?.payment_date || paymentForm.payment_date,
                        payment_mode: data.payment?.payment_mode || paymentForm.payment_mode,
                        transaction_id: data.payment?.transaction_id || paymentForm.transaction_id,
                        cheque_number: data.payment?.cheque_number || paymentForm.cheque_number,
                        bank_name: data.payment?.bank_name || paymentForm.bank_name,
                        notes: data.payment?.notes || paymentForm.notes
                    },
                    selectedComponents: selectedComponentsData
                };
                setReceiptData(receiptPayload);
                setShowReceipt(true);
                setShowPaymentModal(false);
                // Reload student data
                if (selectedStudent) {
                    loadStudentFeeData(selectedStudent.id);
                }
                // Reset form
                setPaymentForm({
                    payment_amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_mode: 'cash',
                    transaction_id: '',
                    cheque_number: '',
                    bank_name: '',
                    notes: ''
                });
                setSelectedComponents([]);
            }
            else {
                const error = await response.json();
                alert(error.error || 'Failed to process payment');
            }
        }
        catch (error) {
            console.error('Error processing payment:', error);
            alert('Error processing payment');
        }
        finally {
            setProcessingPayment(false);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'partially-paid': return 'bg-yellow-100 text-yellow-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()));
    const selectedComponentsData = monthlyLedger
        .flatMap(month => month.components)
        .filter(comp => selectedComponents.includes(comp.id));
    const totalPending = selectedComponentsData.reduce((sum, comp) => sum + comp.pending_amount, 0);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsx("h2", { className: "text-3xl font-bold", children: "Fee Collection" }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Search Student" }), _jsx("input", { type: "text", placeholder: "Search by name or roll number...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full border border-gray-300 rounded-lg px-4 py-2 mb-4" }), searchQuery && (_jsx("div", { className: "border border-gray-200 rounded-lg max-h-64 overflow-y-auto", children: filteredStudents.length === 0 ? (_jsx("div", { className: "p-4 text-gray-500 text-center", children: "No students found" })) : (filteredStudents.map(student => (_jsxs("div", { onClick: () => handleStudentSelect(student), className: `p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${selectedStudent?.id === student.id ? 'bg-blue-50' : ''}`, children: [_jsx("div", { className: "font-semibold", children: student.name }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Roll: ", student.roll_number, " | Class: ", student.class] })] }, student.id)))) }))] }), selectedStudent && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold", children: selectedStudent.name }), _jsxs("p", { className: "text-gray-600", children: ["Roll: ", selectedStudent.roll_number, " | Class: ", selectedStudent.class] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: loadPaymentHistory, className: "px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700", children: "View Payment History" }), _jsxs("button", { onClick: () => setShowPaymentModal(true), disabled: selectedComponents.length === 0, className: `px-4 py-2 rounded-lg font-semibold ${selectedComponents.length === 0
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: ["Collect Payment (", selectedComponents.length, ")"] })] })] }), loading ? (_jsx("div", { className: "text-center py-8", children: "Loading fee data..." })) : feeStructure === null ? (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center", children: [_jsx("p", { className: "text-yellow-800 font-semibold text-lg", children: "\u26A0\uFE0F No fee configured for this student" }), _jsx("p", { className: "text-yellow-700 mt-2", children: "Please contact Principal to assign fee structure." })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-semibold mb-3", children: "Assigned Fee Structure" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 text-sm", children: [feeStructure?.class_fee && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsx("div", { className: "font-semibold text-blue-700", children: "Class Fee" }), _jsxs("div", { children: ["\u20B9", feeStructure.class_fee.amount.toFixed(2)] }), _jsx("div", { className: "text-xs text-gray-600", children: feeStructure.class_fee.billing_frequency })] })), feeStructure?.transport_fee && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsx("div", { className: "font-semibold text-blue-700", children: "Transport Fee" }), _jsxs("div", { children: ["\u20B9", feeStructure.transport_fee.amount.toFixed(2)] }), _jsxs("div", { className: "text-xs text-gray-600", children: [feeStructure.transport_fee.route_name, " | ", feeStructure.transport_fee.billing_frequency] })] })), feeStructure?.custom_fees && feeStructure.custom_fees.length > 0 && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsxs("div", { className: "font-semibold text-blue-700", children: ["Custom Fees (", feeStructure.custom_fees.length, ")"] }), feeStructure.custom_fees.map((cf, idx) => (_jsxs("div", { className: "text-xs", children: [cf.category_name, ": \u20B9", cf.amount.toFixed(2), " (", cf.billing_frequency, ")"] }, idx)))] }))] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-3", children: "Monthly Fee Status Ledger" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Month" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Fee Type" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Fee Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Paid Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Pending Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Due Date" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b", children: "Select" })] }) }), _jsxs("tbody", { className: "divide-y divide-gray-200", children: [monthlyLedger.map((monthEntry, monthIdx) => monthEntry.components.map((comp, compIdx) => {
                                                            const isOverdue = comp.status === 'overdue' ||
                                                                (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                                                            const rowBgColor = comp.status === 'paid'
                                                                ? 'bg-green-50'
                                                                : isOverdue
                                                                    ? 'bg-red-50'
                                                                    : comp.status === 'partially-paid'
                                                                        ? 'bg-yellow-50'
                                                                        : 'bg-white';
                                                            return (_jsxs("tr", { className: `${rowBgColor} ${isOverdue ? 'border-l-4 border-red-500' : ''}`, children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: compIdx === 0 ? monthEntry.month : '' }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-700", children: [_jsx("div", { className: "font-medium", children: comp.fee_name }), _jsx("div", { className: "text-xs text-gray-500 capitalize", children: comp.fee_type.replace('-', ' ') })] }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-700", children: ["\u20B9", comp.fee_amount.toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-700", children: _jsxs("span", { className: comp.paid_amount > 0 ? 'text-green-600 font-semibold' : '', children: ["\u20B9", comp.paid_amount.toFixed(2)] }) }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-700", children: _jsxs("span", { className: comp.pending_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500', children: ["\u20B9", comp.pending_amount.toFixed(2)] }) }), _jsx("td", { className: "px-4 py-3 text-sm", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`, children: comp.status === 'paid' ? '🟢 PAID' :
                                                                                isOverdue ? '🔴 OVERDUE' :
                                                                                    comp.status === 'partially-paid' ? '🟡 PARTIALLY PAID' :
                                                                                        '⚪ PENDING' }) }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-600", children: [comp.due_date ? new Date(comp.due_date).toLocaleDateString() : 'N/A', isOverdue && comp.due_date && (_jsxs("div", { className: "text-xs text-red-600 mt-1", children: [Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24)), " days overdue"] }))] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("input", { type: "checkbox", checked: selectedComponents.includes(comp.id), onChange: () => handleComponentToggle(comp.id), disabled: comp.status === 'paid' || comp.pending_amount === 0, className: "w-5 h-5 cursor-pointer disabled:cursor-not-allowed" }) })] }, `${monthIdx}-${compIdx}`));
                                                        })), monthlyLedger.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-8 text-center text-gray-500", children: "No fee data available for this student" }) })), monthlyLedger.length > 0 && monthlyLedger.every(m => m.components.length === 0) && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-8 text-center text-gray-500", children: "No fee components found" }) }))] })] }) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-4 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-green-100 border border-green-300 rounded" }), _jsx("span", { children: "Paid" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" }), _jsx("span", { children: "Partially Paid" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-red-100 border border-red-300 rounded" }), _jsx("span", { children: "Pending/Overdue" })] })] })] })] }))] })), showPaymentModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-2xl font-bold mb-4", children: "Collect Payment" }), _jsxs("div", { className: "mb-4 p-4 bg-blue-50 rounded-lg", children: [_jsx("div", { className: "font-semibold", children: "Selected Components:" }), selectedComponentsData.map(comp => (_jsxs("div", { className: "text-sm text-gray-700 mt-1", children: [comp.fee_name, ": \u20B9", comp.pending_amount.toFixed(2), " pending"] }, comp.id))), _jsxs("div", { className: "font-bold text-lg mt-2", children: ["Total Pending: \u20B9", totalPending.toFixed(2)] })] }), _jsxs("form", { onSubmit: handlePaymentSubmit, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Amount *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: paymentForm.payment_amount, onChange: (e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, placeholder: `Max: ₹${totalPending.toFixed(2)}` })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Date *" }), _jsx("input", { type: "date", value: paymentForm.payment_date, onChange: (e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Mode *" }), _jsxs("select", { value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "online", children: "Online" }), _jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "cheque", children: "Cheque" }), _jsx("option", { value: "bank_transfer", children: "Bank Transfer" })] })] }), (paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'card') && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Transaction ID" }), _jsx("input", { type: "text", value: paymentForm.transaction_id, onChange: (e) => setPaymentForm({ ...paymentForm, transaction_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter transaction ID" })] })), paymentForm.payment_mode === 'cheque' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Cheque Number" }), _jsx("input", { type: "text", value: paymentForm.cheque_number, onChange: (e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter cheque number" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter bank name" })] })] })), paymentForm.payment_mode === 'bank_transfer' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter bank name" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3, placeholder: "Additional notes..." })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", disabled: processingPayment, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400", children: processingPayment ? 'Processing...' : 'Record Payment' }), _jsx("button", { type: "button", onClick: () => setShowPaymentModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showReceipt && receiptData && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-2xl font-bold", children: "Payment Receipt" }), _jsx("button", { onClick: () => {
                                        window.print();
                                    }, className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700", children: "Print" }), _jsx("button", { onClick: () => {
                                        setShowReceipt(false);
                                        setReceiptData(null);
                                    }, className: "px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300", children: "Close" })] }), _jsxs("div", { className: "border-2 border-gray-300 rounded-lg p-8 space-y-6 print:border-0", children: [_jsxs("div", { className: "text-center border-b-2 border-gray-400 pb-4", children: [_jsx("h4", { className: "text-3xl font-bold mb-2", children: "FEE PAYMENT RECEIPT" }), _jsxs("div", { className: "space-y-1 text-gray-700", children: [_jsxs("p", { className: "font-semibold", children: ["Receipt No: ", receiptData.receipt_number || receiptData.payment?.receipt_number] }), _jsxs("p", { children: ["Date: ", new Date(receiptData.payment?.payment_date || receiptData.payment_date || new Date()).toLocaleDateString('en-IN', {
                                                            weekday: 'long',
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric'
                                                        })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-gray-700 mb-1", children: "Student Name:" }), _jsx("div", { className: "text-lg", children: selectedStudent?.name })] }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-gray-700 mb-1", children: "Roll Number:" }), _jsx("div", { className: "text-lg", children: selectedStudent?.roll_number })] }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-gray-700 mb-1", children: "Class:" }), _jsx("div", { className: "text-lg", children: selectedStudent?.class })] }), _jsxs("div", { children: [_jsx("div", { className: "font-semibold text-gray-700 mb-1", children: "Payment Mode:" }), _jsx("div", { className: "text-lg uppercase", children: receiptData.payment?.payment_mode || 'CASH' })] })] }), _jsxs("div", { className: "border-t border-b border-gray-300 py-4", children: [_jsx("h5", { className: "font-semibold mb-3 text-gray-700", children: "Payment Details:" }), _jsx("div", { className: "space-y-2", children: (receiptData.selectedComponents || selectedComponentsData).map((comp, idx) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: comp.fee_name }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", comp.pending_amount.toFixed(2)] })] }, idx))) })] }), ((receiptData.payment?.transaction_id) || (receiptData.payment?.cheque_number) || (receiptData.payment?.bank_name)) && (_jsxs("div", { className: "border-b border-gray-300 pb-4", children: [_jsx("h5", { className: "font-semibold mb-2 text-gray-700", children: "Transaction Details:" }), receiptData.payment?.transaction_id && (_jsxs("div", { className: "text-sm", children: ["Transaction ID: ", receiptData.payment.transaction_id] })), receiptData.payment?.cheque_number && (_jsxs("div", { className: "text-sm", children: ["Cheque Number: ", receiptData.payment.cheque_number] })), receiptData.payment?.bank_name && (_jsxs("div", { className: "text-sm", children: ["Bank: ", receiptData.payment.bank_name] }))] })), _jsx("div", { className: "border-t-2 border-gray-400 pt-4", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "text-xl font-semibold", children: "Total Amount Paid:" }), _jsxs("span", { className: "text-2xl font-bold text-blue-600", children: ["\u20B9", receiptData.payment?.amount_paid?.toFixed(2) ||
                                                        receiptData.payment?.payment_amount?.toFixed(2) ||
                                                        (typeof receiptData.payment_amount === 'number' ? receiptData.payment_amount.toFixed(2) : '0.00')] })] }) }), receiptData.payment?.notes && (_jsxs("div", { className: "bg-gray-50 p-3 rounded-lg", children: [_jsx("div", { className: "font-semibold text-sm text-gray-700 mb-1", children: "Notes:" }), _jsx("div", { className: "text-sm text-gray-600", children: receiptData.payment.notes })] })), receiptData.message && (_jsxs("div", { className: "bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800", children: [_jsx("div", { className: "font-semibold mb-1", children: "Note:" }), receiptData.message] })), _jsxs("div", { className: "border-t border-gray-300 pt-4 mt-8 text-center text-xs text-gray-500", children: [_jsx("p", { children: "This is a computer-generated receipt." }), _jsx("p", { className: "mt-2", children: "Collected by: Clerk" })] })] })] }) })), showPaymentHistory && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-2xl font-bold", children: ["Payment History - ", selectedStudent?.name] }), _jsx("button", { onClick: () => {
                                        setShowPaymentHistory(false);
                                        setPaymentHistory([]);
                                    }, className: "px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300", children: "Close" })] }), loadingHistory ? (_jsx("div", { className: "text-center py-8", children: "Loading payment history..." })) : paymentHistory.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No payment records found" })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Date" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Fee Component" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Period" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Mode" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Receipt No" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Collected By" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: paymentHistory.map((payment, idx) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-3 text-sm", children: new Date(payment.payment_date).toLocaleDateString() }), _jsxs("td", { className: "px-4 py-3 text-sm", children: [_jsx("div", { className: "font-medium", children: payment.monthly_fee_components?.fee_name || 'N/A' }), _jsx("div", { className: "text-xs text-gray-500 capitalize", children: payment.monthly_fee_components?.fee_type?.replace('-', ' ') || '' })] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: payment.monthly_fee_components?.period_month && payment.monthly_fee_components?.period_year
                                                        ? `${new Date(2000, payment.monthly_fee_components.period_month - 1).toLocaleString('default', { month: 'short' })} ${payment.monthly_fee_components.period_year}`
                                                        : 'N/A' }), _jsxs("td", { className: "px-4 py-3 text-sm font-semibold text-green-600", children: ["\u20B9", parseFloat(payment.payment_amount || 0).toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-sm uppercase text-gray-600", children: payment.payment_mode }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: payment.receipt_number || 'N/A' }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: payment.received_by_profile?.full_name || 'Clerk' })] }, idx))) }), _jsx("tfoot", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("td", { colSpan: 3, className: "px-4 py-3 text-sm font-semibold text-right", children: "Total Payments:" }), _jsxs("td", { className: "px-4 py-3 text-sm font-bold text-green-600", children: ["\u20B9", paymentHistory.reduce((sum, p) => sum + parseFloat(p.payment_amount || 0), 0).toFixed(2)] }), _jsx("td", { colSpan: 3 })] }) })] }) }))] }) }))] }));
}
