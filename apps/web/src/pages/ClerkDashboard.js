import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { FeeManagement } from './PrincipalDashboard';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
const tabRouteMap = {
    overview: '/clerk',
    fees: '/clerk/fees',
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
    const [pendingMarks, setPendingMarks] = useState([]);
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
            await Promise.all([loadClasses(), loadPendingMarks()]);
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
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400", children: "Logged in as" }), _jsx("div", { className: "font-semibold", children: profile?.full_name || 'Clerk' }), _jsx("div", { className: "text-sm text-gray-400", children: profile?.email })] }), _jsxs("nav", { className: "space-y-2", children: [_jsx("button", { onClick: () => {
                                        setActiveTab('overview');
                                        navigate(tabRouteMap.overview, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'overview' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCCA Overview" }), _jsx("button", { onClick: () => {
                                        setActiveTab('fees');
                                        navigate(tabRouteMap.fees, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'fees' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCB0 Fee Management" }), _jsx("button", { onClick: () => {
                                        setActiveTab('marks');
                                        navigate(tabRouteMap.marks, { replace: true });
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\u2705 Verify Marks" })] }), _jsx("button", { onClick: handleLogout, className: "mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDEAA Logout" })] }) }), _jsx("div", { className: "ml-64 flex-1", children: _jsx("div", { className: "p-6", children: loadingData ? (_jsx("div", { className: "bg-white rounded-lg shadow-sm p-12 text-center text-gray-500", children: "Loading dashboard data..." })) : (_jsxs(_Fragment, { children: [activeTab === 'overview' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Clerk Overview" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Total Classes" }), _jsx("p", { className: "text-3xl font-bold text-blue-600", children: classes.length }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Active classes" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Pending Marks" }), _jsx("p", { className: "text-3xl font-bold text-orange-500", children: pendingMarks.length }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Marks waiting for verification" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-500 uppercase mb-2", children: "Fee Management" }), _jsx("p", { className: "text-3xl font-bold text-blue-600", children: "\u2014" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "View in Fee Management tab" })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Classes" }), classes.length === 0 ? (_jsx("div", { className: "text-gray-500 py-6 text-center", children: "No classes available." })) : (_jsx("div", { className: "space-y-4", children: classes.map((cls) => (_jsx("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded-lg", children: _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900", children: cls.name }), cls.description && (_jsx("p", { className: "text-sm text-gray-500", children: cls.description }))] }) }, cls.id))) }))] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("button", { onClick: () => {
                                                                    setActiveTab('fees');
                                                                    navigate(tabRouteMap.fees, { replace: true });
                                                                }, className: "w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition", children: [_jsx("div", { className: "font-medium text-blue-900", children: "\uD83D\uDCB0 Manage Fees" }), _jsx("div", { className: "text-sm text-blue-700", children: "Generate bills & record payments" })] }), _jsxs("button", { onClick: () => {
                                                                    setActiveTab('marks');
                                                                    navigate(tabRouteMap.marks, { replace: true });
                                                                }, className: "w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition", children: [_jsx("div", { className: "font-medium text-green-900", children: "\u2705 Verify Marks" }), _jsxs("div", { className: "text-sm text-green-700", children: [pendingMarks.length, " marks pending verification"] })] })] })] })] })] })), activeTab === 'fees' && (_jsx(FeeManagement, { userRole: "clerk" })), activeTab === 'marks' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Verify Marks" }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Exam" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Subject" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Marks" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: pendingMarks.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-6 text-center text-gray-500", children: "All marks are verified. Great job!" }) })) : (pendingMarks.map((mark) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: mark.students?.profile?.full_name || 'Student' }), _jsx("div", { className: "text-xs text-gray-500", children: mark.students?.roll_number ? `Roll ${mark.students?.roll_number}` : '' })] }), _jsxs("td", { className: "px-6 py-4 text-sm text-gray-900", children: [_jsx("div", { className: "font-medium", children: mark.exams?.name || 'Exam' }), _jsx("div", { className: "text-xs text-gray-500", children: mark.exams?.term || '' })] }), _jsxs("td", { className: "px-6 py-4 text-sm text-gray-900", children: [mark.subjects?.name || 'Subject', mark.subjects?.code && (_jsxs("span", { className: "text-xs text-gray-500", children: [" (", mark.subjects.code, ")"] }))] }), _jsxs("td", { className: "px-6 py-4 text-sm font-semibold text-blue-600", children: [mark.marks_obtained, " / ", mark.max_marks] }), _jsx("td", { className: "px-6 py-4 text-right", children: _jsx("button", { onClick: () => handleVerifyMark(mark.id), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Verify" }) })] }, mark.id)))) })] }) })] }))] })) }) })] }));
}
