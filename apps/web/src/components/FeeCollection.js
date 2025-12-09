import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
export default function FeeCollection() {
    const [students, setStudents] = useState([]);
    const [allStudents, setAllStudents] = useState([]); // Store all students for filtering
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClass, setSelectedClass] = useState(''); // Empty = all classes
    const [classes, setClasses] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [feeStructure, setFeeStructure] = useState(null);
    const [monthlyLedger, setMonthlyLedger] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedComponents, setSelectedComponents] = useState([]);
    const [activeFeeTab, setActiveFeeTab] = useState('class-fee');
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
        loadClasses();
        loadStudents();
    }, []);
    // Reload students when class filter changes
    useEffect(() => {
        loadStudents();
        // Keep search query but it will be re-applied to the new filtered list
    }, [selectedClass]);
    // Auto-update payment amount when selection changes (if modal is open)
    useEffect(() => {
        if (showPaymentModal && selectedComponents.length > 0) {
            const newTotal = monthlyLedger
                .flatMap(month => month.components)
                .filter(comp => selectedComponents.includes(comp.id))
                .reduce((sum, comp) => {
                const baseAmount = comp.fee_amount;
                // TODO: Add previous balance and late fee calculation
                return sum + baseAmount;
            }, 0);
            setPaymentForm(prevForm => ({
                ...prevForm,
                payment_amount: newTotal > 0 ? newTotal.toFixed(2) : prevForm.payment_amount
            }));
        }
        else if (showPaymentModal && selectedComponents.length === 0) {
            // Clear payment amount when no components selected
            setPaymentForm(prevForm => ({
                ...prevForm,
                payment_amount: ''
            }));
        }
    }, [selectedComponents, showPaymentModal, monthlyLedger]);
    const loadClasses = async () => {
        setLoadingClasses(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setClasses(data.classes || []);
            }
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
        finally {
            setLoadingClasses(false);
        }
    };
    const loadStudents = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Build URL with class filter if selected
            let url = `${API_URL}/students`;
            if (selectedClass) {
                url += `?class_group_id=${selectedClass}`;
            }
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const studentsList = (data.students || []).map((s) => ({
                    id: s.id,
                    name: s.profile?.full_name || 'Unknown',
                    roll_number: s.roll_number || 'N/A',
                    class: s.class_groups?.name || 'N/A',
                    class_group_id: s.class_group_id
                }));
                setAllStudents(studentsList);
                // Apply search filter immediately on the newly loaded students
                // Note: The debounced effect will also handle this, but this ensures immediate update
                if (searchQuery.trim()) {
                    applySearchFilter(studentsList, searchQuery);
                }
                else {
                    setStudents(studentsList);
                }
            }
        }
        catch (error) {
            console.error('Error loading students:', error);
        }
    };
    // Apply search filter (predictive - starts with)
    const applySearchFilter = (studentList, query) => {
        if (!query.trim()) {
            setStudents(studentList);
            return;
        }
        const queryLower = query.toLowerCase().trim();
        const filtered = studentList.filter(s => {
            const nameLower = s.name.toLowerCase();
            // Predictive search: name starts with query
            return nameLower.startsWith(queryLower) ||
                s.roll_number.toLowerCase().includes(queryLower);
        });
        setStudents(filtered);
    };
    // Debounced search handler - re-applies when search query or students list changes
    // Note: allStudents is already filtered by class from the backend when selectedClass changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // allStudents is already filtered by class from loadStudents() if selectedClass is set
            // So we just need to apply the search filter
            applySearchFilter(allStudents, searchQuery);
        }, 150); // 150ms debounce for better performance
        return () => clearTimeout(timeoutId);
    }, [searchQuery, allStudents]);
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
    const isFutureMonth = (year, month) => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        return year > currentYear || (year === currentYear && month > currentMonth);
    };
    const handleComponentToggle = (componentId, monthYear, monthNumber) => {
        // Prevent selecting future months
        if (isFutureMonth(monthYear, monthNumber)) {
            alert('Cannot select future months for payment. Advance payments require Principal approval.');
            return;
        }
        setSelectedComponents(prev => {
            const newSelection = prev.includes(componentId)
                ? prev.filter(id => id !== componentId)
                : [...prev, componentId];
            // Auto-update payment amount when selection changes (if modal is open)
            if (showPaymentModal) {
                const newTotal = monthlyLedger
                    .flatMap(month => month.components)
                    .filter(comp => newSelection.includes(comp.id))
                    .reduce((sum, comp) => {
                    const monthEntry = monthlyLedger.find(m => m.components.some(c => c.id === comp.id));
                    const baseAmount = comp.fee_amount;
                    // TODO: Add previous balance and late fee calculation
                    return sum + baseAmount;
                }, 0);
                setPaymentForm(prevForm => ({
                    ...prevForm,
                    payment_amount: newSelection.length > 0 ? newTotal.toFixed(2) : ''
                }));
            }
            return newSelection;
        });
    };
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (selectedComponents.length === 0) {
            alert('Please select at least one fee component');
            return;
        }
        if (!selectedStudent)
            return;
        // Client-side validation: Check for future months
        const futureComponents = selectedComponentsData.filter(comp => {
            // Find the month entry for this component
            const monthEntry = monthlyLedger.find(month => month.components.some(c => c.id === comp.id));
            if (!monthEntry)
                return false;
            return isFutureMonth(monthEntry.year, monthEntry.monthNumber);
        });
        if (futureComponents.length > 0) {
            alert('Cannot record payment for future months. Advance payments require Principal approval. Please contact Principal to enable advance payments.');
            return;
        }
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
                // Show better error message
                const errorMessage = error.error || 'Failed to process payment';
                alert(errorMessage);
                // If it's a future month error, clear selection
                if (errorMessage.includes('future months') || errorMessage.includes('Advance payments')) {
                    setSelectedComponents([]);
                }
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
    // Students are already filtered by applySearchFilter, no need for additional filtering
    // Group components by fee type for tabs
    const componentsByType = {
        'class-fee': monthlyLedger.flatMap(month => month.components.filter(c => c.fee_type === 'class-fee')),
        'transport-fee': monthlyLedger.flatMap(month => month.components.filter(c => c.fee_type === 'transport-fee')),
        'custom-fee': monthlyLedger.flatMap(month => month.components.filter(c => c.fee_type === 'custom-fee'))
    };
    // Get components for active tab, grouped by month
    const activeTabByMonth = monthlyLedger.map(monthEntry => ({
        ...monthEntry,
        components: monthEntry.components.filter(c => c.fee_type === activeFeeTab)
    })).filter(month => month.components.length > 0);
    // Get fee component name and amount for active tab
    const getActiveTabInfo = () => {
        if (activeTabByMonth.length === 0)
            return null;
        const firstComp = activeTabByMonth[0].components[0];
        return {
            name: firstComp.fee_name,
            amount: firstComp.fee_amount,
            cycle: feeStructure?.class_fee?.billing_frequency ||
                feeStructure?.transport_fee?.billing_frequency ||
                feeStructure?.custom_fees?.[0]?.billing_frequency || 'monthly'
        };
    };
    const activeTabInfo = getActiveTabInfo();
    const selectedComponentsData = monthlyLedger
        .flatMap(month => month.components)
        .filter(comp => selectedComponents.includes(comp.id));
    const totalPending = selectedComponentsData.reduce((sum, comp) => sum + comp.pending_amount, 0);
    // Calculate summary for selected components
    const selectedMonthsSet = new Set();
    selectedComponentsData.forEach(comp => {
        const monthEntry = monthlyLedger.find(m => m.components.some(c => c.id === comp.id));
        if (monthEntry)
            selectedMonthsSet.add(monthEntry.month);
    });
    const selectedMonths = Array.from(selectedMonthsSet);
    const baseFeeTotal = selectedComponentsData.reduce((sum, comp) => sum + comp.fee_amount, 0);
    const previousBalance = selectedComponentsData.reduce((sum, comp) => {
        // Previous balance would be from earlier unpaid months - simplified for now
        return sum;
    }, 0);
    const lateFee = selectedComponentsData.reduce((sum, comp) => {
        // Calculate late fee for overdue components
        if (comp.status === 'overdue' && comp.due_date) {
            const daysOverdue = Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24));
            // TODO: Apply fine rules from fine_rules table
            return sum; // Placeholder
        }
        return sum;
    }, 0);
    const discount = 0; // TODO: Get from principal-approved discounts
    const finalAmount = baseFeeTotal + previousBalance + lateFee - discount;
    // Check if all months are paid for active tab
    const allPaidForActiveTab = activeTabByMonth.every(month => month.components.every(c => c.status === 'paid' || c.pending_amount === 0));
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsx("h2", { className: "text-3xl font-bold", children: "Fee Collection" }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Search Student" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Filter by Class (Optional)" }), _jsxs("select", { value: selectedClass, onChange: (e) => {
                                            setSelectedClass(e.target.value);
                                            setSearchQuery(''); // Clear search when class changes
                                        }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classes.map(cls => (_jsx("option", { value: cls.id, children: cls.name }, cls.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Search by Name" }), _jsx("input", { type: "text", placeholder: selectedClass ? `Search in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}...` : "Type student name (predictive search)...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full border border-gray-300 rounded-lg px-4 py-2" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: selectedClass
                                            ? `Searching in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'} - names starting with your input`
                                            : 'Search shows students whose names start with your input' })] })] }), searchQuery && (_jsx("div", { className: "border border-gray-200 rounded-lg max-h-64 overflow-y-auto", children: students.length === 0 ? (_jsx("div", { className: "p-4 text-gray-500 text-center", children: searchQuery ? 'No students found matching your search' : 'Start typing to search for students' })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "p-2 bg-gray-50 text-xs text-gray-600 border-b", children: ["Found ", students.length, " student", students.length !== 1 ? 's' : '', selectedClass && ` in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}`] }), students.slice(0, 50).map(student => (_jsxs("div", { onClick: () => handleStudentSelect(student), className: `p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''}`, children: [_jsx("div", { className: "font-semibold text-gray-900", children: student.name }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Roll: ", student.roll_number, " | Class: ", student.class] })] }, student.id))), students.length > 50 && (_jsx("div", { className: "p-4 text-center text-sm text-gray-500 bg-gray-50", children: "Showing first 50 results. Refine your search for more specific results." }))] })) })), !searchQuery && selectedClass && (_jsxs("div", { className: "border border-gray-200 rounded-lg max-h-64 overflow-y-auto", children: [_jsxs("div", { className: "p-2 bg-gray-50 text-xs text-gray-600 border-b", children: ["All students in ", classes.find(c => c.id === selectedClass)?.name || 'selected class', " (", students.length, ")"] }), students.slice(0, 50).map(student => (_jsxs("div", { onClick: () => handleStudentSelect(student), className: `p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''}`, children: [_jsx("div", { className: "font-semibold text-gray-900", children: student.name }), _jsxs("div", { className: "text-sm text-gray-600", children: ["Roll: ", student.roll_number, " | Class: ", student.class] })] }, student.id)))] }))] }), selectedStudent && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold", children: selectedStudent.name }), _jsxs("p", { className: "text-gray-600", children: ["Roll: ", selectedStudent.roll_number, " | Class: ", selectedStudent.class] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: loadPaymentHistory, className: "px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700", children: "View Payment History" }), _jsxs("button", { onClick: () => {
                                            setShowPaymentModal(true);
                                            setActiveFeeTab('class-fee');
                                            // Pre-fill payment amount with total pending
                                            const total = monthlyLedger
                                                .flatMap(month => month.components)
                                                .filter(comp => selectedComponents.includes(comp.id))
                                                .reduce((sum, comp) => sum + comp.pending_amount, 0);
                                            setPaymentForm(prev => ({
                                                ...prev,
                                                payment_amount: total > 0 ? total.toFixed(2) : ''
                                            }));
                                        }, disabled: selectedComponents.length === 0, className: `px-4 py-2 rounded-lg font-semibold ${selectedComponents.length === 0
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: ["Collect Payment (", selectedComponents.length, ")"] })] })] }), loading ? (_jsx("div", { className: "text-center py-8", children: "Loading fee data..." })) : feeStructure === null ? (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center", children: [_jsx("p", { className: "text-yellow-800 font-semibold text-lg", children: "\u26A0\uFE0F No fee configured for this student" }), _jsx("p", { className: "text-yellow-700 mt-2", children: "Please contact Principal to assign fee structure." })] })) : (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("h4", { className: "font-semibold mb-3", children: "Assigned Fee Structure" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 text-sm", children: [feeStructure?.class_fee && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsx("div", { className: "font-semibold text-blue-700", children: "Class Fee" }), _jsxs("div", { children: ["\u20B9", feeStructure.class_fee.amount.toFixed(2)] }), _jsx("div", { className: "text-xs text-gray-600", children: feeStructure.class_fee.billing_frequency })] })), feeStructure?.transport_fee && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsx("div", { className: "font-semibold text-blue-700", children: "Transport Fee" }), _jsxs("div", { children: ["\u20B9", feeStructure.transport_fee.amount.toFixed(2)] }), _jsxs("div", { className: "text-xs text-gray-600", children: [feeStructure.transport_fee.route_name, " | ", feeStructure.transport_fee.billing_frequency] })] })), feeStructure?.custom_fees && feeStructure.custom_fees.length > 0 && (_jsxs("div", { className: "bg-white rounded p-3", children: [_jsxs("div", { className: "font-semibold text-blue-700", children: ["Custom Fees (", feeStructure.custom_fees.length, ")"] }), feeStructure.custom_fees.map((cf, idx) => (_jsxs("div", { className: "text-xs", children: [cf.category_name, ": \u20B9", cf.amount.toFixed(2), " (", cf.billing_frequency, ")"] }, idx)))] }))] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-3", children: "Monthly Fee Status Ledger" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full bg-white border border-gray-200 rounded-lg", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Month" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Fee Type" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Fee Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Paid Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Pending Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b", children: "Due Date" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b", children: "Select" })] }) }), _jsxs("tbody", { className: "divide-y divide-gray-200", children: [monthlyLedger.map((monthEntry, monthIdx) => monthEntry.components.map((comp, compIdx) => {
                                                            const isOverdue = comp.status === 'overdue' ||
                                                                (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                                                            const isFuture = isFutureMonth(monthEntry.year, monthEntry.monthNumber);
                                                            const isDisabled = comp.status === 'paid' || comp.pending_amount === 0 || isFuture;
                                                            const rowBgColor = comp.status === 'paid'
                                                                ? 'bg-green-50'
                                                                : isOverdue
                                                                    ? 'bg-red-50'
                                                                    : comp.status === 'partially-paid'
                                                                        ? 'bg-yellow-50'
                                                                        : 'bg-white';
                                                            return (_jsxs("tr", { className: `${rowBgColor} ${isOverdue ? 'border-l-4 border-red-500' : ''} ${isFuture ? 'opacity-60' : ''}`, children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: compIdx === 0 ? monthEntry.month : '' }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-700", children: [_jsx("div", { className: "font-medium", children: comp.fee_name }), _jsx("div", { className: "text-xs text-gray-500 capitalize", children: comp.fee_type.replace('-', ' ') })] }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-700", children: ["\u20B9", comp.fee_amount.toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-700", children: _jsxs("span", { className: comp.paid_amount > 0 ? 'text-green-600 font-semibold' : '', children: ["\u20B9", comp.paid_amount.toFixed(2)] }) }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-700", children: _jsxs("span", { className: comp.pending_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500', children: ["\u20B9", comp.pending_amount.toFixed(2)] }) }), _jsx("td", { className: "px-4 py-3 text-sm", children: _jsx("span", { className: `px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`, children: comp.status === 'paid' ? '🟢 PAID' :
                                                                                isOverdue ? '🔴 OVERDUE' :
                                                                                    comp.status === 'partially-paid' ? '🟡 PARTIALLY PAID' :
                                                                                        isFuture ? '🔵 FUTURE' :
                                                                                            '⚪ PENDING' }) }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-600", children: [comp.due_date ? new Date(comp.due_date).toLocaleDateString() : 'N/A', isOverdue && comp.due_date && (_jsxs("div", { className: "text-xs text-red-600 mt-1", children: [Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24)), " days overdue"] })), isFuture && (_jsx("div", { className: "text-xs text-blue-600 mt-1", children: "Future month" }))] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("input", { type: "checkbox", checked: selectedComponents.includes(comp.id), onChange: () => handleComponentToggle(comp.id, monthEntry.year, monthEntry.monthNumber), disabled: isDisabled, title: isFuture ? 'Future months require Principal approval' : (comp.status === 'paid' ? 'Already paid' : comp.pending_amount === 0 ? 'No pending amount' : ''), className: "w-5 h-5 cursor-pointer disabled:cursor-not-allowed" }) })] }, `${monthIdx}-${compIdx}`));
                                                        })), monthlyLedger.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-8 text-center text-gray-500", children: "No fee data available for this student" }) })), monthlyLedger.length > 0 && monthlyLedger.every(m => m.components.length === 0) && (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-4 py-8 text-center text-gray-500", children: "No fee components found" }) }))] })] }) }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-4 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-green-100 border border-green-300 rounded" }), _jsx("span", { children: "Paid" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" }), _jsx("span", { children: "Partially Paid" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-4 h-4 bg-red-100 border border-red-300 rounded" }), _jsx("span", { children: "Pending/Overdue" })] })] })] })] }))] })), showPaymentModal && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col", children: [_jsxs("div", { className: "flex justify-between items-center p-6 border-b bg-gray-50", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-2xl font-bold", children: "Collect Fee" }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: [selectedStudent.name, " \u00B7 ", selectedStudent.class] })] }), _jsx("button", { onClick: () => {
                                        setShowPaymentModal(false);
                                        setSelectedComponents([]);
                                        setActiveFeeTab('class-fee');
                                    }, className: "text-gray-500 hover:text-gray-700 text-2xl font-bold", children: "\u00D7" })] }), _jsx("div", { className: "p-4 border-b bg-white", children: _jsxs("div", { className: "flex justify-between items-center flex-wrap gap-4", children: [_jsxs("div", { className: "flex gap-6 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Student:" }), _jsx("span", { className: "font-semibold ml-2", children: selectedStudent.name })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Class:" }), _jsx("span", { className: "font-semibold ml-2", children: selectedStudent.class })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Roll No:" }), _jsx("span", { className: "font-semibold ml-2", children: selectedStudent.roll_number })] })] }), _jsxs("div", { className: "flex gap-6 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Total Pending:" }), _jsxs("span", { className: `font-bold ml-2 ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`, children: ["\u20B9", totalPending.toFixed(2)] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Transport:" }), _jsx("span", { className: "font-semibold ml-2", children: feeStructure?.transport_fee ? 'Yes' : 'No' })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Status:" }), _jsx("span", { className: "font-semibold ml-2 text-green-600", children: "Active" })] })] })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6", children: [_jsxs("div", { className: "flex gap-2 mb-6 border-b", children: [feeStructure?.class_fee && (_jsx("button", { onClick: () => {
                                                setActiveFeeTab('class-fee');
                                                setSelectedComponents([]);
                                            }, className: `px-4 py-2 font-semibold border-b-2 transition ${activeFeeTab === 'class-fee'
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-gray-600 hover:text-gray-800'}`, children: "Class Fee" })), feeStructure?.transport_fee && (_jsx("button", { onClick: () => {
                                                setActiveFeeTab('transport-fee');
                                                setSelectedComponents([]);
                                            }, className: `px-4 py-2 font-semibold border-b-2 transition ${activeFeeTab === 'transport-fee'
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-gray-600 hover:text-gray-800'}`, children: "Transport Fee" })), feeStructure?.custom_fees && feeStructure.custom_fees.length > 0 && (_jsxs("button", { onClick: () => {
                                                setActiveFeeTab('custom-fee');
                                                setSelectedComponents([]);
                                            }, className: `px-4 py-2 font-semibold border-b-2 transition ${activeFeeTab === 'custom-fee'
                                                ? 'border-blue-600 text-blue-600'
                                                : 'border-transparent text-gray-600 hover:text-gray-800'}`, children: ["Custom Fees (", feeStructure.custom_fees.length, ")"] }))] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2", children: [activeTabInfo && (_jsxs("div", { className: "mb-4 p-3 bg-blue-50 rounded-lg", children: [_jsxs("div", { className: "font-semibold text-blue-900", children: [activeTabInfo.name, " \u2013 ", activeTabInfo.cycle] }), _jsxs("div", { className: "text-sm text-blue-700", children: ["Per Month: \u20B9", activeTabInfo.amount.toFixed(2)] })] })), allPaidForActiveTab ? (_jsxs("div", { className: "bg-green-50 border border-green-200 rounded-lg p-8 text-center", children: [_jsx("p", { className: "text-green-800 font-semibold text-lg", children: "\u2705 All months paid for this category" }), _jsx("p", { className: "text-green-700 mt-2", children: "No pending fees available." })] })) : activeTabByMonth.length === 0 ? (_jsx("div", { className: "bg-gray-50 border border-gray-200 rounded-lg p-8 text-center", children: _jsx("p", { className: "text-gray-600", children: "No fee data available for this category" }) })) : (_jsx("div", { className: "bg-white border border-gray-200 rounded-lg overflow-hidden", children: _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase", children: "Select" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: activeTabByMonth.map((monthEntry) => monthEntry.components.map((comp, compIdx) => {
                                                                    const isOverdue = comp.status === 'overdue' ||
                                                                        (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                                                                    const isFuture = isFutureMonth(monthEntry.year, monthEntry.monthNumber);
                                                                    const isDisabled = comp.status === 'paid' || comp.pending_amount === 0 || isFuture;
                                                                    const statusColor = comp.status === 'paid'
                                                                        ? 'text-green-600'
                                                                        : isOverdue
                                                                            ? 'text-red-600'
                                                                            : comp.status === 'partially-paid'
                                                                                ? 'text-yellow-600'
                                                                                : 'text-gray-600';
                                                                    const statusIcon = comp.status === 'paid'
                                                                        ? '🟢'
                                                                        : isOverdue
                                                                            ? '🔴'
                                                                            : comp.status === 'partially-paid'
                                                                                ? '🟡'
                                                                                : '⚪';
                                                                    return (_jsxs("tr", { className: `hover:bg-gray-50 ${comp.status === 'paid' ? 'bg-green-50' : isOverdue ? 'bg-red-50' : ''}`, children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium", children: compIdx === 0 ? monthEntry.month : '' }), _jsx("td", { className: "px-4 py-3 text-sm", children: _jsxs("span", { className: statusColor, children: [statusIcon, " ", comp.status === 'paid' ? 'Paid' :
                                                                                            isOverdue ? 'Overdue' :
                                                                                                comp.status === 'partially-paid' ? 'Partially Paid' :
                                                                                                    'Pending'] }) }), _jsxs("td", { className: "px-4 py-3 text-sm font-semibold", children: ["\u20B9", comp.fee_amount.toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("input", { type: "checkbox", checked: selectedComponents.includes(comp.id), onChange: () => handleComponentToggle(comp.id, monthEntry.year, monthEntry.monthNumber), disabled: isDisabled, className: "w-5 h-5 cursor-pointer disabled:cursor-not-allowed" }) })] }, `${monthEntry.year}-${monthEntry.monthNumber}-${compIdx}`));
                                                                })) })] }) }))] }), _jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "bg-gray-50 border border-gray-200 rounded-lg p-4 sticky top-4", children: [_jsx("h4", { className: "font-semibold mb-4", children: "Payment Summary" }), selectedComponents.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 text-center py-4", children: "Select months to collect payment" })) : (_jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-600", children: "Selected Months:" }), _jsx("div", { className: "mt-1 font-medium", children: selectedMonths.length > 0 ? selectedMonths.join(', ') : 'None' })] }), _jsxs("div", { className: "border-t pt-3", children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsx("span", { className: "text-gray-600", children: "Base Fee Total:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", baseFeeTotal.toFixed(2)] })] }), previousBalance > 0 && (_jsxs("div", { className: "flex justify-between mb-2 text-orange-600", children: [_jsx("span", { children: "Previous Balance:" }), _jsxs("span", { children: ["\u20B9", previousBalance.toFixed(2)] })] })), lateFee > 0 && (_jsxs("div", { className: "flex justify-between mb-2 text-red-600", children: [_jsx("span", { children: "Late Fee / Fine:" }), _jsxs("span", { children: ["\u20B9", lateFee.toFixed(2)] })] })), discount > 0 && (_jsxs("div", { className: "flex justify-between mb-2 text-green-600", children: [_jsx("span", { children: "Discount:" }), _jsxs("span", { children: ["-\u20B9", discount.toFixed(2)] })] })), _jsx("div", { className: "border-t pt-2 mt-2", children: _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "font-semibold", children: "Final Amount:" }), _jsxs("span", { className: "font-bold text-lg text-blue-600", children: ["\u20B9", finalAmount.toFixed(2)] })] }) })] }), parseFloat(paymentForm.payment_amount || '0') < finalAmount && parseFloat(paymentForm.payment_amount || '0') > 0 && (_jsx("div", { className: "bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800", children: "\u26A0\uFE0F This will mark selected months as Partially Paid" }))] }))] }) })] }), selectedComponents.length > 0 && (_jsxs("div", { className: "mt-6 border-t pt-6", children: [_jsx("h4", { className: "font-semibold mb-4", children: "Payment Details" }), _jsxs("form", { onSubmit: handlePaymentSubmit, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Mode *" }), _jsxs("select", { value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "online", children: "Online" }), _jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "cheque", children: "Cheque" }), _jsx("option", { value: "bank_transfer", children: "Bank Transfer" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Amount *" }), _jsx("input", { type: "number", step: "0.01", min: "0", max: finalAmount, value: paymentForm.payment_amount || (selectedComponents.length > 0 ? finalAmount.toFixed(2) : ''), onChange: (e) => setPaymentForm({ ...paymentForm, payment_amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["Max: \u20B9", finalAmount.toFixed(2), " ", selectedComponents.length === 0 && '(Select months first)'] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Date *" }), _jsx("input", { type: "date", value: paymentForm.payment_date, onChange: (e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), (paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'card') && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Transaction ID" }), _jsx("input", { type: "text", value: paymentForm.transaction_id, onChange: (e) => setPaymentForm({ ...paymentForm, transaction_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter transaction ID" })] })), paymentForm.payment_mode === 'cheque' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Cheque Number" }), _jsx("input", { type: "text", value: paymentForm.cheque_number, onChange: (e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter cheque number" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter bank name" })] })] })), paymentForm.payment_mode === 'bank_transfer' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter bank name" })] })), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 2, placeholder: "Additional notes..." })] })] }), _jsxs("div", { className: "flex justify-between items-center mt-6 pt-6 border-t", children: [_jsx("button", { type: "button", onClick: () => {
                                                                setShowPaymentModal(false);
                                                                setSelectedComponents([]);
                                                                setActiveFeeTab('class-fee');
                                                            }, className: "px-6 py-2 text-gray-700 hover:text-gray-900 font-medium", children: "Cancel" }), _jsx("div", { className: "flex gap-3", children: _jsx("button", { type: "submit", disabled: processingPayment || selectedComponents.length === 0, className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold", children: processingPayment ? 'Processing...' : 'Save & Print Receipt' }) })] })] })] }))] })] }) })), showReceipt && receiptData && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-2xl font-bold", children: "Payment Receipt" }), _jsx("button", { onClick: () => {
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
