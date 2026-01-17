import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import FeeCollection from '../components/FeeCollection.js';
import UnpaidFeeAnalytics from '../components/UnpaidFeeAnalytics';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
export default function ClerkDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = useState(null);
    const [checkingRole, setCheckingRole] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dashboardStats, setDashboardStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    // Sync activeTab with URL path
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/clerk/fees') || path.includes('/clerk/payments')) {
            setActiveTab('fee-collection');
        }
        else if (path.includes('/clerk/salary')) {
            setActiveTab('salary-payment');
        }
        else if (path === '/clerk' || path === '/clerk/') {
            setActiveTab('dashboard');
        }
    }, [location.pathname]);
    // Load dashboard statistics
    useEffect(() => {
        if (activeTab === 'dashboard' && profile) {
            loadDashboardStats();
        }
    }, [activeTab, profile]);
    const loadDashboardStats = async () => {
        setLoadingStats(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token)
                return;
            // Get students list
            const studentsRes = await fetch(`${API_URL}/students`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const studentsData = studentsRes.ok ? await studentsRes.json() : { students: [] };
            // Get statistics from Supabase (using RLS)
            let recentPayments = [];
            let todayPayments = [];
            let pendingComponents = [];
            try {
                const { data, error } = await supabase
                    .from('monthly_fee_payments')
                    .select('payment_amount, payment_date, payment_mode')
                    .order('payment_date', { ascending: false })
                    .limit(10);
                if (!error && data)
                    recentPayments = data;
            }
            catch (err) {
                console.error('Error loading recent payments:', err);
            }
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await supabase
                    .from('monthly_fee_payments')
                    .select('payment_amount')
                    .gte('payment_date', today);
                if (!error && data)
                    todayPayments = data;
            }
            catch (err) {
                console.error('Error loading today payments:', err);
            }
            try {
                const { data, error } = await supabase
                    .from('monthly_fee_components')
                    .select('pending_amount')
                    .in('status', ['pending', 'partially-paid', 'overdue'])
                    .gt('pending_amount', 0);
                if (!error && data)
                    pendingComponents = data;
            }
            catch (err) {
                console.error('Error loading pending components:', err);
            }
            const todayTotal = todayPayments.reduce((sum, p) => sum + parseFloat(p.payment_amount || 0), 0);
            const totalPending = pendingComponents.reduce((sum, c) => sum + parseFloat(c.pending_amount || 0), 0);
            setDashboardStats({
                totalStudents: studentsData.students?.length || 0,
                todayCollection: todayTotal,
                totalPending,
                recentPayments: recentPayments
            });
        }
        catch (error) {
            console.error('Error loading dashboard stats:', error);
            // Set default stats on error
            setDashboardStats({
                totalStudents: 0,
                todayCollection: 0,
                totalPending: 0,
                recentPayments: []
            });
        }
        finally {
            setLoadingStats(false);
        }
    };
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
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400", children: "Logged in as" }), _jsx("div", { className: "font-semibold", children: profile?.full_name || 'Clerk' }), _jsx("div", { className: "text-sm text-gray-400", children: profile?.email })] }), _jsxs("nav", { className: "space-y-2", children: [_jsx("button", { onClick: () => {
                                        setActiveTab('dashboard');
                                        navigate('/clerk');
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'dashboard'
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-800 text-gray-300'}`, children: "\uD83D\uDCCA Dashboard" }), _jsx("button", { onClick: () => {
                                        setActiveTab('fee-collection');
                                        navigate('/clerk/fees');
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'fee-collection'
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-800 text-gray-300'}`, children: "\uD83D\uDCB0 Fee Collection" }), _jsx("button", { onClick: () => {
                                        setActiveTab('salary-payment');
                                        navigate('/clerk/salary');
                                    }, className: `w-full text-left px-4 py-2 rounded-lg transition ${activeTab === 'salary-payment'
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-800 text-gray-300'}`, children: "\uD83D\uDCB5 Pay Salary" })] }), _jsx("button", { onClick: handleLogout, className: "mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDEAA Logout" })] }) }), _jsx("div", { className: "ml-64 flex-1", children: _jsxs("div", { className: "p-6", children: [activeTab === 'dashboard' && (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Dashboard Overview" }), loadingStats ? (_jsx("div", { className: "text-center py-8", children: "Loading statistics..." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsx("div", { className: "bg-white rounded-lg shadow-md p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-sm", children: "Total Students" }), _jsx("p", { className: "text-3xl font-bold text-gray-900 mt-2", children: dashboardStats?.totalStudents || 0 })] }), _jsx("div", { className: "text-4xl", children: "\uD83D\uDC65" })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-sm", children: "Today's Collection" }), _jsxs("p", { className: "text-3xl font-bold text-green-600 mt-2", children: ["\u20B9", dashboardStats?.todayCollection?.toFixed(2) || '0.00'] })] }), _jsx("div", { className: "text-4xl", children: "\uD83D\uDCB0" })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-6", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-sm", children: "Total Pending" }), _jsxs("p", { className: "text-3xl font-bold text-red-600 mt-2", children: ["\u20B9", dashboardStats?.totalPending?.toFixed(2) || '0.00'] })] }), _jsx("div", { className: "text-4xl", children: "\uD83D\uDCCB" })] }) })] }), _jsx(UnpaidFeeAnalytics, { userRole: "clerk", onCollectFee: (studentId) => {
                                                // Navigate to fee collection with student pre-selected
                                                setActiveTab('fee-collection');
                                                navigate(`/clerk/fees?student=${studentId}`);
                                            } }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Recent Payments" }), dashboardStats?.recentPayments?.length > 0 ? (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-200", children: dashboardStats.recentPayments.slice(0, 10).map((payment, idx) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-3 text-sm", children: new Date(payment.payment_date).toLocaleDateString() }), _jsxs("td", { className: "px-4 py-3 text-sm font-semibold text-green-600", children: ["\u20B9", parseFloat(payment.payment_amount || 0).toFixed(2)] }), _jsx("td", { className: "px-4 py-3 text-sm uppercase text-gray-600", children: payment.payment_mode })] }, idx))) })] }) })) : (_jsx("p", { className: "text-gray-500 text-center py-8", children: "No recent payments" }))] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("button", { onClick: () => {
                                                                setActiveTab('fee-collection');
                                                                navigate('/clerk/fees');
                                                            }, className: "p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition text-left", children: [_jsx("div", { className: "font-semibold text-lg", children: "\uD83D\uDCB0 Collect Fees" }), _jsx("div", { className: "text-sm text-gray-600 mt-1", children: "Record fee payments from students" })] }), _jsxs("button", { onClick: () => {
                                                                setActiveTab('fee-collection');
                                                                navigate('/clerk/fees');
                                                            }, className: "p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition text-left", children: [_jsx("div", { className: "font-semibold text-lg", children: "\uD83D\uDCCA View Reports" }), _jsx("div", { className: "text-sm text-gray-600 mt-1", children: "View payment history and analytics" })] })] })] })] }))] })), activeTab === 'fee-collection' && _jsx(FeeCollection, {}), activeTab === 'salary-payment' && _jsx(SalaryPaymentSection, {})] }) })] }));
}
// Salary Payment Section - Clerk can record payments directly (simplified system)
function SalaryPaymentSection() {
    const [teacherSummaries, setTeacherSummaries] = useState([]);
    const [unpaidTeachers, setUnpaidTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedTeachers, setExpandedTeachers] = useState(new Set());
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_mode: 'bank',
        payment_proof: '',
        notes: '',
        salary_month: new Date().getMonth() + 1,
        salary_year: new Date().getFullYear()
    });
    useEffect(() => {
        loadUnpaidSalaries();
    }, []);
    const loadUnpaidSalaries = async () => {
        try {
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                console.error('No authentication token found');
                setLoading(false);
                return;
            }
            // Load unpaid salaries with month-wise breakdown
            const unpaidResponse = await fetch(`${API_URL}/salary/unpaid?time_scope=last_12_months`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (unpaidResponse.ok) {
                const unpaidData = await unpaidResponse.json();
                setUnpaidTeachers(unpaidData.teachers || []);
            }
            else {
                console.error('Error loading unpaid salaries:', await unpaidResponse.json().catch(() => ({})));
            }
            // Also load summary for backward compatibility
            const summaryResponse = await fetch(`${API_URL}/salary/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                const summariesWithPending = (summaryData.summaries || []).filter((s) => s.pending_salary > 0);
                setTeacherSummaries(summariesWithPending);
            }
            else {
                const errorData = await summaryResponse.json().catch(() => ({ error: 'Failed to load salary summaries' }));
                console.error('Error loading salary summaries:', errorData);
                setTeacherSummaries([]);
            }
        }
        catch (error) {
            console.error('Error loading salary data:', error);
            setUnpaidTeachers([]);
            setTeacherSummaries([]);
        }
        finally {
            setLoading(false);
        }
    };
    const toggleTeacherExpansion = (teacherId) => {
        const newExpanded = new Set(expandedTeachers);
        if (newExpanded.has(teacherId)) {
            newExpanded.delete(teacherId);
        }
        else {
            newExpanded.add(teacherId);
        }
        setExpandedTeachers(newExpanded);
    };
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedTeacher)
            return;
        // Validate amount
        const amount = parseFloat(paymentForm.amount);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid payment amount');
            return;
        }
        // Check if amount exceeds pending salary
        if (amount > selectedTeacher.pending_salary) {
            if (!confirm(`Payment amount (₹${amount.toLocaleString()}) exceeds pending salary (₹${selectedTeacher.pending_salary.toLocaleString()}). This will be recorded as an advance payment. Continue?`)) {
                return;
            }
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    teacher_id: selectedTeacher.teacher.id,
                    payment_date: paymentForm.payment_date,
                    amount: amount,
                    payment_mode: paymentForm.payment_mode,
                    payment_proof: paymentForm.payment_proof || null,
                    notes: paymentForm.notes || null,
                    salary_month: paymentForm.salary_month,
                    salary_year: paymentForm.salary_year
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to record payment');
            }
            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            setSelectedTeacher(null);
            setPaymentForm({
                payment_date: new Date().toISOString().split('T')[0],
                amount: '',
                payment_mode: 'bank',
                payment_proof: '',
                notes: '',
                salary_month: new Date().getMonth() + 1,
                salary_year: new Date().getFullYear()
            });
            loadUnpaidSalaries();
        }
        catch (error) {
            alert(error.message || 'Failed to record payment');
        }
    };
    if (loading) {
        return (_jsx("div", { children: _jsx("div", { className: "text-center py-8", children: "Loading teacher salary information..." }) }));
    }
    return (_jsxs("div", { children: [_jsx("div", { className: "flex justify-between items-center mb-6", children: _jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold", children: "Pay Salary" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Record salary payments directly. You can pay full, partial, or advance payments to teachers." })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Unpaid Months" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Total Unpaid" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: unpaidTeachers.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No teachers with pending salary. All teachers are up to date with their payments." }) })) : (unpaidTeachers.map((teacher) => {
                                const isExpanded = expandedTeachers.has(teacher.teacher_id);
                                // Find matching summary for total due/paid info
                                const summary = teacherSummaries.find((s) => s.teacher?.id === teacher.teacher_id);
                                return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4", children: teacher.unpaid_months_count > 0 && (_jsx("button", { onClick: () => toggleTeacherExpansion(teacher.teacher_id), className: "text-gray-500 hover:text-gray-700", children: isExpanded ? (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })) : (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })) })) }), _jsx("td", { className: "px-6 py-4 font-medium", children: teacher.teacher_name || 'Unknown' }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-600", children: teacher.teacher_email || '-' }), _jsx("td", { className: "px-6 py-4", children: _jsxs("span", { className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800", children: [teacher.unpaid_months_count, " ", teacher.unpaid_months_count === 1 ? 'month' : 'months'] }) }), _jsxs("td", { className: "px-6 py-4 font-semibold text-orange-600", children: ["\u20B9", teacher.total_unpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => {
                                                            setSelectedTeacher({
                                                                teacher: { id: teacher.teacher_id, full_name: teacher.teacher_name, email: teacher.teacher_email },
                                                                total_salary_due: summary?.total_salary_due || 0,
                                                                total_salary_paid: summary?.total_salary_paid || 0,
                                                                pending_salary: teacher.total_unpaid_amount,
                                                                unpaid_months: teacher.unpaid_months || []
                                                            });
                                                            // Pre-fill with oldest unpaid month if available
                                                            const oldestMonth = teacher.unpaid_months && teacher.unpaid_months.length > 0
                                                                ? teacher.unpaid_months[teacher.unpaid_months.length - 1]
                                                                : null;
                                                            setPaymentForm({
                                                                payment_date: new Date().toISOString().split('T')[0],
                                                                amount: oldestMonth ? oldestMonth.pending_amount.toFixed(2) : teacher.total_unpaid_amount.toFixed(2),
                                                                payment_mode: 'bank',
                                                                payment_proof: '',
                                                                notes: '',
                                                                salary_month: oldestMonth ? oldestMonth.month : new Date().getMonth() + 1,
                                                                salary_year: oldestMonth ? oldestMonth.year : new Date().getFullYear()
                                                            });
                                                            setShowPaymentModal(true);
                                                        }, className: "text-blue-600 hover:text-blue-900 font-medium", children: "Record Payment" }) })] }, teacher.teacher_id), isExpanded && teacher.unpaid_months && teacher.unpaid_months.length > 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 bg-gray-50", children: _jsxs("div", { className: "ml-8", children: [_jsx("h4", { className: "text-sm font-semibold text-gray-700 mb-3", children: "Monthly Breakdown:" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-100", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Month" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Days Overdue" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Notes" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Action" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: teacher.unpaid_months.map((month, idx) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm font-medium", children: month.period_label }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${month.payment_status === 'paid'
                                                                                            ? 'bg-green-100 text-green-800'
                                                                                            : month.payment_status === 'partially-paid'
                                                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                                                : 'bg-orange-100 text-orange-800'}`, children: month.payment_status === 'paid' ? 'Paid' :
                                                                                            month.payment_status === 'partially-paid' ? 'Partially Paid' :
                                                                                                'Unpaid' }) }), _jsxs("td", { className: "px-4 py-2 text-sm", children: [_jsxs("div", { className: "font-semibold", children: ["\u20B9", month.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), month.paid_amount > 0 && (_jsxs("div", { className: "text-xs text-green-600", children: ["Paid: \u20B9", month.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })), month.pending_amount > 0 && (_jsxs("div", { className: "text-xs text-orange-600", children: ["Pending: \u20B9", month.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }))] }), _jsx("td", { className: "px-4 py-2 text-sm", children: month.days_since_period_start > 0 ? (_jsxs("span", { className: "text-red-600 font-medium", children: [month.days_since_period_start, " days"] })) : (_jsx("span", { className: "text-gray-500", children: "-" })) }), _jsxs("td", { className: "px-4 py-2 text-xs text-gray-500", children: [month.payment_date && (_jsxs("span", { children: ["Last payment: ", new Date(month.payment_date).toLocaleDateString()] })), !month.payment_date && month.payment_status === 'unpaid' && (_jsx("span", { className: "text-orange-600", children: "No payment recorded" }))] }), _jsx("td", { className: "px-4 py-2", children: _jsx("button", { onClick: () => {
                                                                                            setSelectedTeacher({
                                                                                                teacher: { id: teacher.teacher_id, full_name: teacher.teacher_name, email: teacher.teacher_email },
                                                                                                total_salary_due: summary?.total_salary_due || 0,
                                                                                                total_salary_paid: summary?.total_salary_paid || 0,
                                                                                                pending_salary: month.pending_amount,
                                                                                                unpaid_months: teacher.unpaid_months || [],
                                                                                                selectedMonth: month
                                                                                            });
                                                                                            setPaymentForm({
                                                                                                payment_date: new Date().toISOString().split('T')[0],
                                                                                                amount: month.pending_amount > 0 ? month.pending_amount.toFixed(2) : month.net_salary.toFixed(2),
                                                                                                payment_mode: 'bank',
                                                                                                payment_proof: '',
                                                                                                notes: '',
                                                                                                salary_month: month.month,
                                                                                                salary_year: month.year
                                                                                            });
                                                                                            setShowPaymentModal(true);
                                                                                        }, className: "text-xs text-blue-600 hover:text-blue-900 font-medium px-2 py-1 border border-blue-300 rounded hover:bg-blue-50", children: "Pay" }) })] }, `${month.year}-${month.month}-${idx}`))) })] }) })] }) }) }))] }));
                            })) })] }) }), showPaymentModal && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Record Salary Payment" }), _jsxs("p", { className: "text-sm text-gray-600 mb-2", children: ["Teacher: ", _jsx("strong", { children: selectedTeacher.teacher?.full_name })] }), selectedTeacher.selectedMonth && (_jsxs("p", { className: "text-sm text-blue-600 mb-2 font-medium", children: ["Paying for: ", selectedTeacher.selectedMonth.period_label] })), _jsx("div", { className: "bg-gray-50 p-3 rounded-lg mb-4", children: selectedTeacher.selectedMonth ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Month Salary:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", selectedTeacher.selectedMonth.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] }), selectedTeacher.selectedMonth.paid_amount > 0 && (_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Already Paid:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", selectedTeacher.selectedMonth.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] })), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-2 border-t", children: [_jsx("span", { children: "Pending for this month:" }), _jsxs("span", { className: "text-orange-600", children: ["\u20B9", selectedTeacher.selectedMonth.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Total Due:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", selectedTeacher.total_salary_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] }), _jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "text-gray-600", children: "Total Paid:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", selectedTeacher.total_salary_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-2 border-t", children: [_jsx("span", { children: "Pending:" }), _jsxs("span", { className: "text-orange-600", children: ["\u20B9", selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] })] })) }), _jsxs("form", { onSubmit: handleRecordPayment, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Amount (\u20B9) *" }), _jsx("input", { type: "number", required: true, step: "0.01", min: "0.01", value: paymentForm.amount, onChange: (e) => setPaymentForm({ ...paymentForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "Enter payment amount" }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["You can pay full, partial, or advance amounts. Pending: \u20B9", selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Salary Month *" }), _jsx("select", { required: true, value: paymentForm.salary_month, onChange: (e) => setPaymentForm({ ...paymentForm, salary_month: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (_jsx("option", { value: month, children: new Date(2000, month - 1).toLocaleString('default', { month: 'long' }) }, month))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Salary Year *" }), _jsx("select", { required: true, value: paymentForm.salary_year, onChange: (e) => setPaymentForm({ ...paymentForm, salary_year: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (_jsx("option", { value: year, children: year }, year))) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Date *" }), _jsx("input", { type: "date", required: true, value: paymentForm.payment_date, onChange: (e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Date when the payment was actually made" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Mode *" }), _jsxs("select", { required: true, value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "bank", children: "Bank Transfer" }), _jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Proof (Optional)" }), _jsx("input", { type: "text", value: paymentForm.payment_proof, onChange: (e) => setPaymentForm({ ...paymentForm, payment_proof: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "URL or file path to payment proof" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Upload proof document and paste URL here, or leave empty" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3, placeholder: "Additional notes about this payment" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Record Payment" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowPaymentModal(false);
                                                setSelectedTeacher(null);
                                                setPaymentForm({
                                                    payment_date: new Date().toISOString().split('T')[0],
                                                    amount: '',
                                                    payment_mode: 'bank',
                                                    payment_proof: '',
                                                    notes: '',
                                                    salary_month: new Date().getMonth() + 1,
                                                    salary_year: new Date().getFullYear()
                                                });
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
}
