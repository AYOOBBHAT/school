import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
const tabRouteMap = {
    overview: '/clerk',
    fees: '/clerk/fees',
    payments: '/clerk/payments',
    marks: '/clerk/marks'
};
export default function ClerkDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = useState(null);
    const [checkingRole, setCheckingRole] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [loadingData, setLoadingData] = useState(true);
    const [classes, setClasses] = useState([]);
    const [fees, setFees] = useState([]);
    const [payments, setPayments] = useState([]);
    const [pendingMarks, setPendingMarks] = useState([]);
    const [students, setStudents] = useState([]);
    // Fee form state
    const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
    const [feeForm, setFeeForm] = useState({
        class_group_id: '',
        name: '',
        amount: '',
        due_date: '',
        description: ''
    });
    const [creatingFee, setCreatingFee] = useState(false);
    // Payment form state
    const [paymentClassId, setPaymentClassId] = useState('');
    const [paymentStudentId, setPaymentStudentId] = useState('');
    const [paymentFeeId, setPaymentFeeId] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMode, setPaymentMode] = useState('cash');
    const [paymentTransactionId, setPaymentTransactionId] = useState('');
    const [recordingPayment, setRecordingPayment] = useState(false);
    useEffect(() => {
        const verifyRole = async () => {
            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                if (!token) {
                    navigate('/login');
                    return;
                }
                const response = await fetch(`${API_URL}/auth/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (!response.ok) {
                    navigate('/login');
                    return;
                }
                const data = await response.json();
                const role = data.profile?.role;
                if (role !== 'clerk' && role !== 'principal') {
                    const redirectMap = {
                        teacher: '/teacher/classes',
                        student: '/student/home',
                        parent: '/parent'
                    };
                    const redirectPath = redirectMap[role] || '/login';
                    navigate(redirectPath, { replace: true });
                    return;
                }
                setProfile(data.profile);
                await loadInitialData();
            }
            catch (error) {
                console.error('[ClerkDashboard] Error verifying role:', error);
                navigate('/login');
            }
            finally {
                setCheckingRole(false);
            }
        };
        verifyRole();
    }, [navigate]);
    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith(tabRouteMap.fees)) {
            setActiveTab('fees');
        }
        else if (path.startsWith(tabRouteMap.payments)) {
            setActiveTab('payments');
        }
        else if (path.startsWith(tabRouteMap.marks)) {
            setActiveTab('marks');
        }
        else {
            setActiveTab('overview');
        }
    }, [location.pathname]);
    const loadInitialData = async () => {
        try {
            setLoadingData(true);
            await Promise.all([loadClasses(), loadFees(), loadPayments(), loadPendingMarks()]);
        }
        catch (error) {
            console.error('[ClerkDashboard] Failed to load initial data:', error);
        }
        finally {
            setLoadingData(false);
        }
    };
    const getToken = async () => {
        const session = await supabase.auth.getSession();
        return session.data.session?.access_token;
    };
    const loadClasses = async () => {
        try {
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok)
                throw new Error('Failed to load classes');
            const data = await response.json();
            setClasses(data.classes || []);
        }
        catch (error) {
            console.error('[ClerkDashboard] Error loading classes:', error);
        }
    };
    const loadFees = async () => {
        try {
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok)
                throw new Error('Failed to load fees');
            const data = await response.json();
            setFees(data.fees || []);
        }
        catch (error) {
            console.error('[ClerkDashboard] Error loading fees:', error);
        }
    };
    const loadPayments = async () => {
        try {
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/payments/report`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok)
                throw new Error('Failed to load payments report');
            const data = await response.json();
            setPayments(data.report || []);
        }
        catch (error) {
            console.error('[ClerkDashboard] Error loading payments:', error);
        }
    };
    const loadPendingMarks = async () => {
        try {
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/marks/pending`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok)
                throw new Error('Failed to load pending marks');
            const data = await response.json();
            setPendingMarks(data.marks || []);
        }
        catch (error) {
            console.error('[ClerkDashboard] Error loading pending marks:', error);
        }
    };
    const loadStudentsForClass = async (classId) => {
        try {
            const token = await getToken();
            if (!token || !classId) {
                setStudents([]);
                return;
            }
            const response = await fetch(`${API_URL}/students-admin?class_group_id=${classId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok)
                throw new Error('Failed to load students');
            const data = await response.json();
            const allStudents = [];
            if (data.classes) {
                data.classes.forEach((cls) => {
                    if (cls.id === classId) {
                        cls.students.forEach((student) => {
                            allStudents.push(student);
                        });
                    }
                });
            }
            setStudents(allStudents);
        }
        catch (error) {
            console.error('[ClerkDashboard] Error loading students:', error);
            setStudents([]);
        }
    };
    useEffect(() => {
        if (paymentClassId) {
            loadStudentsForClass(paymentClassId);
        }
        else {
            setStudents([]);
            setPaymentStudentId('');
            setPaymentFeeId('');
        }
    }, [paymentClassId]);
    useEffect(() => {
        if (!paymentFeeId) {
            setPaymentAmount('');
            return;
        }
        const selectedFee = fees.find((f) => f.id === paymentFeeId);
        if (!selectedFee) {
            setPaymentAmount('');
            return;
        }
        if (!paymentStudentId) {
            setPaymentAmount(selectedFee.amount.toString());
            return;
        }
        const paid = calculatePaidAmount(paymentStudentId, paymentFeeId);
        const remaining = Math.max(0, selectedFee.amount - paid);
        setPaymentAmount((remaining || selectedFee.amount).toString());
    }, [paymentFeeId, paymentStudentId, fees, payments]);
    const calculatePaidAmount = (studentId, feeId) => {
        return payments
            .filter((payment) => payment.student_id === studentId && payment.fee_structure_id === feeId)
            .reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
    };
    const handleCreateFee = async (event) => {
        event.preventDefault();
        if (!feeForm.class_group_id || !feeForm.name || !feeForm.amount) {
            alert('Please fill in all required fields');
            return;
        }
        try {
            setCreatingFee(true);
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    class_group_id: feeForm.class_group_id,
                    name: feeForm.name,
                    amount: parseFloat(feeForm.amount),
                    due_date: feeForm.due_date || null,
                    description: feeForm.description || null
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create fee');
            }
            setFeeForm({
                class_group_id: '',
                name: '',
                amount: '',
                due_date: '',
                description: ''
            });
            setIsFeeModalOpen(false);
            await loadFees();
            alert('Fee structure created successfully');
        }
        catch (error) {
            alert(error.message || 'Failed to create fee');
        }
        finally {
            setCreatingFee(false);
        }
    };
    const handleRecordPayment = async (event) => {
        event.preventDefault();
        if (!paymentClassId || !paymentStudentId || !paymentFeeId || !paymentAmount) {
            alert('Please fill in all required fields');
            return;
        }
        try {
            setRecordingPayment(true);
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    student_id: paymentStudentId,
                    fee_structure_id: paymentFeeId,
                    amount_paid: parseFloat(paymentAmount),
                    payment_mode: paymentMode,
                    transaction_id: paymentTransactionId || null
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to record payment');
            }
            setPaymentStudentId('');
            setPaymentFeeId('');
            setPaymentAmount('');
            setPaymentMode('cash');
            setPaymentTransactionId('');
            await loadPayments();
            alert('Payment recorded successfully');
        }
        catch (error) {
            alert(error.message || 'Failed to record payment');
        }
        finally {
            setRecordingPayment(false);
        }
    };
    const handleVerifyMark = async (markId) => {
        try {
            const token = await getToken();
            if (!token)
                return;
            const response = await fetch(`${API_URL}/marks/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ marks_id: markId })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to verify mark');
            }
            setPendingMarks((prev) => prev.filter((mark) => mark.id !== markId));
            alert('Mark verified successfully');
        }
        catch (error) {
            alert(error.message || 'Failed to verify mark');
        }
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    const filteredFeesForPayment = useMemo(() => {
        if (!paymentClassId)
            return [];
        return fees.filter((fee) => fee.class_group_id === paymentClassId);
    }, [fees, paymentClassId]);
    const recentPayments = useMemo(() => {
        return payments.slice(0, 5);
    }, [payments]);
    const totalCollected = useMemo(() => {
        return payments.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
    }, [payments]);
    const feeTotalsByClass = useMemo(() => {
        const map = new Map();
        fees.forEach((fee) => {
            const current = map.get(fee.class_group_id) || 0;
            map.set(fee.class_group_id, current + (fee.amount || 0));
        });
        return map;
    }, [fees]);
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400", children: "Logged in as" }), _jsx("div", { className: "font-semibold", children: profile?.full_name || 'Clerk' }), _jsx("div", { className: "text-sm text-gray-400", children: profile?.email })] }), _jsxs("nav", { className: "space-y-2", children: [_jsx("button", { onClick: () => {
                                        setActiveTab('overview');
                                        navigate(tabRouteMap.overview, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'overview' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCCA Overview" }), _jsx("button", { onClick: () => {
                                        setActiveTab('fees');
                                        navigate(tabRouteMap.fees, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'fees' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCB0 Fee Structures" }), _jsx("button", { onClick: () => {
                                        setActiveTab('payments');
                                        navigate(tabRouteMap.payments, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'payments' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83E\uDDFE Payments" }), _jsx("button", { onClick: () => {
                                        setActiveTab('marks');
                                        navigate(tabRouteMap.marks, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\u2705 Verify Marks" })] }), _jsx("button", { onClick: handleLogout, className: "mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDEAA Logout" })] }) }), _jsx("div", { className: "ml-64 flex-1", children: _jsx("div", { className: "p-6", children: loadingData ? (_jsx("div", { className: "bg-white rounded-lg shadow-sm p-12 text-center text-gray-500", children: "Loading dashboard data..." })) : (_jsxs(_Fragment, { children: [activeTab === 'overview' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Clerk Overview" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Total Fee Structures" }), _jsx("p", { className: "text-3xl font-bold text-blue-600", children: fees.length }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: ["Across ", classes.length, " classes"] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Payments Recorded" }), _jsx("p", { className: "text-3xl font-bold text-green-600", children: payments.length }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: ["Total Collected: \u20B9", totalCollected.toLocaleString()] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Pending Marks" }), _jsx("p", { className: "text-3xl font-bold text-orange-500", children: pendingMarks.length }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Marks waiting for verification" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Fee Amounts by Class" }), classes.length === 0 ? (_jsx("div", { className: "text-gray-500 py-6 text-center", children: "No classes available." })) : (_jsx("div", { className: "space-y-4", children: classes.map((cls) => (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: cls.name }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Fee Structures:", ' ', fees.filter((fee) => fee.class_group_id === cls.id).length] })] }), _jsx("div", { className: "text-right", children: _jsxs("p", { className: "text-lg font-semibold text-blue-600", children: ["\u20B9", (feeTotalsByClass.get(cls.id) || 0).toLocaleString()] }) })] }, cls.id))) }))] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Recent Payments" }), recentPayments.length === 0 ? (_jsx("div", { className: "text-gray-500 py-6 text-center", children: "No payments recorded yet." })) : (_jsx("div", { className: "space-y-4", children: recentPayments.map((payment) => (_jsxs("div", { className: "flex items-center justify-between border-b pb-3 last:border-none", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: payment.students?.profile?.full_name || 'Unknown Student' }), _jsxs("p", { className: "text-sm text-gray-500", children: [payment.fee_structures?.name, " \u2022 ", new Date(payment.payment_date).toLocaleString()] })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-lg font-semibold text-green-600", children: ["\u20B9", payment.amount_paid.toLocaleString()] }), _jsx("p", { className: "text-xs text-gray-500 uppercase", children: payment.payment_mode })] })] }, payment.id))) }))] })] })] })), activeTab === 'fees' && (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Fee Structures" }), _jsx("button", { onClick: () => setIsFeeModalOpen(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Create Fee Structure" })] }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Due Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Description" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: fees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-6 text-center text-gray-500", children: "No fee structures created yet." }) })) : (fees.map((fee) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: fee.name }), fee.created_at && (_jsxs("div", { className: "text-xs text-gray-500", children: ["Created on ", new Date(fee.created_at).toLocaleDateString()] }))] }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-900", children: fee.class_groups?.name ||
                                                                    classes.find((cls) => cls.id === fee.class_group_id)?.name ||
                                                                    'Class' }), _jsxs("td", { className: "px-6 py-4 text-sm font-semibold text-blue-600", children: ["\u20B9", fee.amount.toLocaleString()] }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-900", children: fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—' }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-500", children: fee.description || '—' })] }, fee.id)))) })] }) })] })), activeTab === 'payments' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Payments" }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Record Payment" }), _jsxs("form", { onSubmit: handleRecordPayment, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Class *" }), _jsxs("select", { value: paymentClassId, onChange: (event) => {
                                                                            setPaymentClassId(event.target.value);
                                                                            setPaymentStudentId('');
                                                                            setPaymentFeeId('');
                                                                        }, className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classes.map((cls) => (_jsx("option", { value: cls.id, children: cls.name }, cls.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Student *" }), _jsxs("select", { value: paymentStudentId, onChange: (event) => setPaymentStudentId(event.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, disabled: !paymentClassId, children: [_jsx("option", { value: "", children: "Select Student" }), students.map((student) => (_jsxs("option", { value: student.id, children: [student.profile.full_name, student.roll_number ? ` (Roll ${student.roll_number})` : ''] }, student.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Fee Structure *" }), _jsxs("select", { value: paymentFeeId, onChange: (event) => setPaymentFeeId(event.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, disabled: !paymentClassId, children: [_jsx("option", { value: "", children: "Select Fee" }), filteredFeesForPayment.map((fee) => (_jsxs("option", { value: fee.id, children: [fee.name, " \u2022 \u20B9", fee.amount.toLocaleString()] }, fee.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Amount *" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: paymentAmount, onChange: (event) => setPaymentAmount(event.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true }), paymentStudentId && paymentFeeId && (_jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["Remaining balance: \u20B9", Math.max(0, (fees.find((fee) => fee.id === paymentFeeId)?.amount || 0) -
                                                                                calculatePaidAmount(paymentStudentId, paymentFeeId)).toLocaleString()] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Payment Mode *" }), _jsxs("select", { value: paymentMode, onChange: (event) => setPaymentMode(event.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "online", children: "Online" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "card", children: "Card" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Transaction ID" }), _jsx("input", { type: "text", value: paymentTransactionId, onChange: (event) => setPaymentTransactionId(event.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Optional" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "submit", disabled: recordingPayment, className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50", children: recordingPayment ? 'Recording...' : 'Record Payment' }), _jsx("button", { type: "button", onClick: () => {
                                                                            setPaymentClassId('');
                                                                            setPaymentStudentId('');
                                                                            setPaymentFeeId('');
                                                                            setPaymentAmount('');
                                                                            setPaymentMode('cash');
                                                                            setPaymentTransactionId('');
                                                                        }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Reset" })] })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Payments Report" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Transaction" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: payments.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-4 py-6 text-center text-gray-500", children: "No payments recorded yet." }) })) : (payments.map((payment) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3 text-sm", children: [_jsx("div", { className: "font-medium text-gray-900", children: payment.students?.profile?.full_name || 'Student' }), _jsx("div", { className: "text-xs text-gray-500", children: payment.students?.roll_number ? `Roll ${payment.students?.roll_number}` : '' })] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900", children: payment.fee_structures?.name || 'Fee' }), _jsxs("td", { className: "px-4 py-3 text-sm font-semibold text-green-600", children: ["\u20B9", payment.amount_paid.toLocaleString()] }), _jsx("td", { className: "px-4 py-3 text-xs font-medium text-gray-500 uppercase", children: payment.payment_mode }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900", children: new Date(payment.payment_date).toLocaleString() }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-500", children: payment.transaction_id || '—' })] }, payment.id)))) })] }) })] })] })] })), activeTab === 'marks' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Verify Marks" }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Exam" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Subject" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Marks" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: pendingMarks.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-6 text-center text-gray-500", children: "All marks are verified. Great job!" }) })) : (pendingMarks.map((mark) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: mark.students?.profile?.full_name || 'Student' }), _jsx("div", { className: "text-xs text-gray-500", children: mark.students?.roll_number ? `Roll ${mark.students?.roll_number}` : '' })] }), _jsxs("td", { className: "px-6 py-4 text-sm text-gray-900", children: [_jsx("div", { className: "font-medium", children: mark.exams?.name || 'Exam' }), _jsx("div", { className: "text-xs text-gray-500", children: mark.exams?.term || '' })] }), _jsxs("td", { className: "px-6 py-4 text-sm text-gray-900", children: [mark.subjects?.name || 'Subject', mark.subjects?.code && (_jsxs("span", { className: "text-xs text-gray-500", children: [" (", mark.subjects.code, ")"] }))] }), _jsxs("td", { className: "px-6 py-4 text-sm font-semibold text-blue-600", children: [mark.marks_obtained, " / ", mark.max_marks] }), _jsx("td", { className: "px-6 py-4 text-right", children: _jsx("button", { onClick: () => handleVerifyMark(mark.id), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Verify" }) })] }, mark.id)))) })] }) })] }))] })) }) }), isFeeModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Create Fee Structure" }), _jsxs("form", { onSubmit: handleCreateFee, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Class *" }), _jsxs("select", { value: feeForm.class_group_id, onChange: (event) => setFeeForm((prev) => ({ ...prev, class_group_id: event.target.value })), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classes.map((cls) => (_jsx("option", { value: cls.id, children: cls.name }, cls.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Fee Name *" }), _jsx("input", { type: "text", value: feeForm.name, onChange: (event) => setFeeForm((prev) => ({ ...prev, name: event.target.value })), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Amount *" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: feeForm.amount, onChange: (event) => setFeeForm((prev) => ({ ...prev, amount: event.target.value })), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Due Date" }), _jsx("input", { type: "date", value: feeForm.due_date, onChange: (event) => setFeeForm((prev) => ({ ...prev, due_date: event.target.value })), className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: feeForm.description, onChange: (event) => setFeeForm((prev) => ({ ...prev, description: event.target.value })), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3, placeholder: "Optional details about the fee structure" })] }), _jsxs("div", { className: "flex gap-3 justify-end", children: [_jsx("button", { type: "button", onClick: () => setIsFeeModalOpen(false), className: "px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300", children: "Cancel" }), _jsx("button", { type: "submit", disabled: creatingFee, className: "px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50", children: creatingFee ? 'Creating...' : 'Create Fee' })] })] })] }) }))] }));
}
