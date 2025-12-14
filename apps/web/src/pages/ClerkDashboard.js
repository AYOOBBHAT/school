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
// Salary Payment Section - Clerk can only pay approved salaries
function SalaryPaymentSection() {
    const [approvedSalaries, setApprovedSalaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedSalary, setSelectedSalary] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'bank',
        payment_proof: '',
        notes: ''
    });
    useEffect(() => {
        loadApprovedSalaries();
    }, []);
    const loadApprovedSalaries = async () => {
        try {
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                console.error('No authentication token found');
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/salary/records?status=approved`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setApprovedSalaries(data.records || []);
            }
            else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load salaries' }));
                console.error('Error loading approved salaries:', errorData);
                setApprovedSalaries([]);
            }
        }
        catch (error) {
            console.error('Error loading approved salaries:', error);
            setApprovedSalaries([]);
        }
        finally {
            setLoading(false);
        }
    };
    const handleMarkPaid = async (e) => {
        e.preventDefault();
        if (!selectedSalary)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/records/${selectedSalary.id}/mark-paid`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    payment_date: paymentForm.payment_date,
                    payment_mode: paymentForm.payment_mode,
                    payment_proof: paymentForm.payment_proof || null,
                    notes: paymentForm.notes || null
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to mark salary as paid');
            }
            alert('Salary marked as paid successfully!');
            setShowPaymentModal(false);
            setSelectedSalary(null);
            setPaymentForm({
                payment_date: new Date().toISOString().split('T')[0],
                payment_mode: 'bank',
                payment_proof: '',
                notes: ''
            });
            loadApprovedSalaries();
        }
        catch (error) {
            alert(error.message || 'Failed to mark salary as paid');
        }
    };
    if (loading) {
        return (_jsx("div", { className: "p-6", children: _jsx("div", { className: "text-center py-8", children: "Loading approved salaries..." }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex justify-between items-center mb-6", children: _jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold", children: "Pay Salary" }), _jsx("p", { className: "text-gray-600 mt-2", children: "Only approved salaries can be paid. All salaries shown here have been approved by the Principal." })] }) }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month/Year" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Gross" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net Salary" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Approved By" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: approvedSalaries.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No approved salaries available for payment" }) })) : (approvedSalaries.map((salary) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: salary.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: [new Date(2000, salary.month - 1).toLocaleString('default', { month: 'long' }), " ", salary.year] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(salary.gross_salary || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(salary.total_deductions || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold text-green-600", children: ["\u20B9", parseFloat(salary.net_salary || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-sm text-gray-600", children: [salary.approved_by_profile?.full_name || 'Principal', salary.approved_at && (_jsx("div", { className: "text-xs text-gray-500", children: new Date(salary.approved_at).toLocaleDateString() }))] }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => {
                                                setSelectedSalary(salary);
                                                setShowPaymentModal(true);
                                            }, className: "text-blue-600 hover:text-blue-900 font-medium", children: "Mark as Paid" }) })] }, salary.id)))) })] }) }), showPaymentModal && selectedSalary && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Mark Salary as Paid" }), _jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Recording payment for ", _jsx("strong", { children: selectedSalary.teacher?.full_name }), " - ", new Date(2000, selectedSalary.month - 1).toLocaleString('default', { month: 'long' }), " ", selectedSalary.year] }), _jsxs("p", { className: "text-sm font-semibold mb-4", children: ["Net Salary: \u20B9", parseFloat(selectedSalary.net_salary || 0).toLocaleString()] }), _jsxs("form", { onSubmit: handleMarkPaid, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Date *" }), _jsx("input", { type: "date", required: true, value: paymentForm.payment_date, onChange: (e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Mode *" }), _jsxs("select", { required: true, value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "bank", children: "Bank Transfer" }), _jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "upi", children: "UPI" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Proof (Optional)" }), _jsx("input", { type: "text", value: paymentForm.payment_proof, onChange: (e) => setPaymentForm({ ...paymentForm, payment_proof: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "URL or file path to payment proof" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Upload proof document and paste URL here, or leave empty" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3, placeholder: "Additional notes about this payment" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Mark as Paid" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowPaymentModal(false);
                                                setSelectedSalary(null);
                                                setPaymentForm({
                                                    payment_date: new Date().toISOString().split('T')[0],
                                                    payment_mode: 'bank',
                                                    payment_proof: '',
                                                    notes: ''
                                                });
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
}
