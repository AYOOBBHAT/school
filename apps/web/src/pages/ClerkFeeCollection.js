import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
export default function ClerkFeeCollection() {
    const navigate = useNavigate();
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [monthlyComponents, setMonthlyComponents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        payment_amount: '',
        payment_mode: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        transaction_id: '',
        cheque_number: '',
        bank_name: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [showReceipt, setShowReceipt] = useState(false);
    const [receiptData, setReceiptData] = useState(null);
    useEffect(() => {
        loadStudents();
    }, []);
    const loadStudents = async () => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                navigate('/login');
                return;
            }
            const response = await fetch(`${API_URL}/students-admin`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (!response.ok)
                throw new Error('Failed to load students');
            const data = await response.json();
            setStudents(data.students || []);
        }
        catch (error) {
            console.error('Error loading students:', error);
        }
    };
    const loadStudentFeeStructure = async (studentId) => {
        try {
            setLoading(true);
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                navigate('/login');
                return;
            }
            const response = await fetch(`${API_URL}/clerk-fees/students/${studentId}/fee-structure`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (!response.ok)
                throw new Error('Failed to load fee structure');
            const data = await response.json();
            if (data.monthlyComponents && data.monthlyComponents.length === 0) {
                alert(data.message || 'No fee structure assigned for this student.');
            }
            setMonthlyComponents(data.monthlyComponents || []);
        }
        catch (error) {
            console.error('Error loading fee structure:', error);
            alert('Failed to load fee structure');
        }
        finally {
            setLoading(false);
        }
    };
    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        loadStudentFeeStructure(student.id);
    };
    const handlePaymentClick = (component) => {
        setSelectedComponent(component);
        setPaymentForm({
            payment_amount: component.pending_amount.toString(),
            payment_mode: 'cash',
            payment_date: new Date().toISOString().split('T')[0],
            transaction_id: '',
            cheque_number: '',
            bank_name: '',
            notes: ''
        });
        setShowPaymentModal(true);
    };
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedComponent)
            return;
        try {
            setSubmitting(true);
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                navigate('/login');
                return;
            }
            const response = await fetch(`${API_URL}/clerk-fees/record-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    monthly_fee_component_id: selectedComponent.id,
                    payment_amount: parseFloat(paymentForm.payment_amount),
                    payment_date: paymentForm.payment_date,
                    payment_mode: paymentForm.payment_mode,
                    transaction_id: paymentForm.transaction_id || null,
                    cheque_number: paymentForm.cheque_number || null,
                    bank_name: paymentForm.bank_name || null,
                    notes: paymentForm.notes || null
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to record payment');
            }
            const data = await response.json();
            // Show receipt
            setReceiptData(data);
            setShowPaymentModal(false);
            setShowReceipt(true);
            // Reload fee structure
            if (selectedStudent) {
                loadStudentFeeStructure(selectedStudent.id);
            }
            alert(`Payment recorded successfully! Receipt #${data.receipt_number}`);
        }
        catch (error) {
            console.error('Error recording payment:', error);
            alert(error.message || 'Failed to record payment');
        }
        finally {
            setSubmitting(false);
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return 'bg-green-100 text-green-800';
            case 'partially-paid':
                return 'bg-yellow-100 text-yellow-800';
            case 'overdue':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    const getStatusLabel = (status) => {
        switch (status) {
            case 'paid':
                return '✓ Paid';
            case 'partially-paid':
                return '⚠ Partial';
            case 'overdue':
                return '✕ Overdue';
            default:
                return '○ Pending';
        }
    };
    const getMonthName = (month) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[month - 1];
    };
    const filteredStudents = students.filter(s => s.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roll_number?.toLowerCase().includes(searchTerm.toLowerCase()));
    return (_jsxs("div", { className: "min-h-screen bg-gray-50 p-6", children: [_jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("button", { onClick: () => navigate('/clerk/dashboard'), className: "text-blue-600 hover:text-blue-800 mb-4", children: "\u2190 Back to Dashboard" }), _jsx("h1", { className: "text-3xl font-bold text-gray-900", children: "Fee Collection" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Record student fee payments" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsxs("div", { className: "p-4 border-b", children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: "Select Student" }), _jsx("input", { type: "text", placeholder: "Search by name or roll number...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), className: "w-full px-3 py-2 border rounded-lg" })] }), _jsx("div", { className: "max-h-[600px] overflow-y-auto", children: filteredStudents.length === 0 ? (_jsx("div", { className: "p-4 text-center text-gray-500", children: "No students found" })) : (filteredStudents.map(student => (_jsxs("div", { onClick: () => handleStudentSelect(student), className: `p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedStudent?.id === student.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`, children: [_jsx("div", { className: "font-medium", children: student.profile?.full_name || 'N/A' }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Roll: ", student.roll_number] }), _jsx("div", { className: "text-sm text-gray-600", children: student.class?.name })] }, student.id)))) })] }) }), _jsx("div", { className: "lg:col-span-2", children: !selectedStudent ? (_jsx("div", { className: "bg-white rounded-lg shadow p-12 text-center", children: _jsx("div", { className: "text-gray-400 text-lg", children: "\u2190 Select a student to view their fee structure" }) })) : loading ? (_jsx("div", { className: "bg-white rounded-lg shadow p-12 text-center", children: _jsx("div", { className: "text-gray-500", children: "Loading fee structure..." }) })) : monthlyComponents.length === 0 ? (_jsxs("div", { className: "bg-white rounded-lg shadow p-12 text-center", children: [_jsx("div", { className: "text-gray-500", children: "No fee structure assigned for this student." }), _jsx("div", { className: "text-sm text-gray-400 mt-2", children: "Principal needs to configure fees." })] })) : (_jsxs("div", { className: "bg-white rounded-lg shadow", children: [_jsxs("div", { className: "p-4 border-b", children: [_jsxs("h2", { className: "text-lg font-semibold", children: ["Fee Ledger - ", selectedStudent.profile?.full_name] }), _jsxs("p", { className: "text-sm text-gray-600", children: ["Roll: ", selectedStudent.roll_number, " | Class: ", selectedStudent.class?.name] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Type" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Paid" }), _jsx("th", { className: "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pending" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Action" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: monthlyComponents.map(component => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-4 py-3 text-sm", children: [getMonthName(component.period_month), " ", component.period_year] }), _jsx("td", { className: "px-4 py-3 text-sm", children: component.fee_name }), _jsxs("td", { className: "px-4 py-3 text-sm text-right", children: ["\u20B9", component.fee_amount.toFixed(2)] }), _jsxs("td", { className: "px-4 py-3 text-sm text-right text-green-600", children: ["\u20B9", component.paid_amount.toFixed(2)] }), _jsxs("td", { className: "px-4 py-3 text-sm text-right text-red-600", children: ["\u20B9", component.pending_amount.toFixed(2)] }), _jsx("td", { className: "px-4 py-3", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${getStatusColor(component.status)}`, children: getStatusLabel(component.status) }) }), _jsx("td", { className: "px-4 py-3", children: component.status !== 'paid' && (_jsx("button", { onClick: () => handlePaymentClick(component), className: "text-blue-600 hover:text-blue-800 text-sm font-medium", children: "Collect" })) })] }, component.id))) })] }) }), _jsx("div", { className: "p-4 bg-gray-50 border-t", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-medium", children: "Total Pending:" }), _jsxs("span", { className: "text-xl font-bold text-red-600", children: ["\u20B9", monthlyComponents.reduce((sum, c) => sum + c.pending_amount, 0).toFixed(2)] })] }) })] })) })] })] }), showPaymentModal && selectedComponent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "bg-white rounded-lg max-w-md w-full p-6", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Record Payment" }), _jsxs("div", { className: "mb-4 p-3 bg-gray-50 rounded", children: [_jsxs("div", { className: "text-sm text-gray-600", children: ["Fee: ", selectedComponent.fee_name] }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Period: ", getMonthName(selectedComponent.period_month), " ", selectedComponent.period_year] }), _jsxs("div", { className: "text-lg font-bold mt-1", children: ["Pending: \u20B9", selectedComponent.pending_amount.toFixed(2)] })] }), _jsxs("form", { onSubmit: handleRecordPayment, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Payment Amount *" }), _jsx("input", { type: "number", step: "0.01", required: true, value: paymentForm.payment_amount, onChange: (e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value }), className: "w-full px-3 py-2 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Payment Mode *" }), _jsxs("select", { required: true, value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full px-3 py-2 border rounded-lg", children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "online", children: "Online Transfer" }), _jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "cheque", children: "Cheque" }), _jsx("option", { value: "bank_transfer", children: "Bank Transfer" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Payment Date *" }), _jsx("input", { type: "date", required: true, value: paymentForm.payment_date, onChange: (e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value }), className: "w-full px-3 py-2 border rounded-lg" })] }), ['upi', 'online', 'card'].includes(paymentForm.payment_mode) && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Transaction ID" }), _jsx("input", { type: "text", value: paymentForm.transaction_id, onChange: (e) => setPaymentForm({ ...paymentForm, transaction_id: e.target.value }), className: "w-full px-3 py-2 border rounded-lg" })] })), paymentForm.payment_mode === 'cheque' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Cheque Number" }), _jsx("input", { type: "text", value: paymentForm.cheque_number, onChange: (e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value }), className: "w-full px-3 py-2 border rounded-lg" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full px-3 py-2 border rounded-lg" })] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Notes" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full px-3 py-2 border rounded-lg", rows: 2 })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "button", onClick: () => setShowPaymentModal(false), className: "flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50", disabled: submitting, children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50", children: submitting ? 'Recording...' : 'Record Payment' })] })] })] }) }))] }));
}
