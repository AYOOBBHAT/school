import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
export default function ClerkDashboard() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [checkingRole, setCheckingRole] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [stats, setStats] = useState(null);
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
    const loadInitialData = async () => {
        try {
            setLoadingData(true);
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token)
                return;
            // Load stats
            const response = await fetch(`${API_URL}/clerk-fees/stats`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        }
        catch (error) {
            console.error('[ClerkDashboard] Failed to load initial data:', error);
        }
        finally {
            setLoadingData(false);
        }
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400", children: "Logged in as" }), _jsx("div", { className: "font-semibold", children: profile?.full_name || 'Clerk' }), _jsx("div", { className: "text-sm text-gray-400", children: profile?.email })] }), _jsxs("nav", { className: "space-y-2", children: [_jsx("button", { onClick: () => navigate('/clerk/fee-collection'), className: "w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDCB0 Collect Fees" }), _jsx("button", { onClick: () => navigate('/clerk/payment-history'), className: "w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDCDC Payment History" })] }), _jsx("button", { onClick: handleLogout, className: "mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDEAA Logout" })] }) }), _jsx("div", { className: "ml-64 flex-1", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-6", children: "Clerk Dashboard" }), loadingData ? (_jsx("div", { className: "bg-white rounded-lg shadow-sm p-12 text-center text-gray-500", children: "Loading dashboard data..." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("div", { className: "text-sm text-gray-600 mb-1", children: "Today's Collection" }), _jsxs("div", { className: "text-2xl font-bold text-green-600", children: ["\u20B9", stats?.todayTotal?.toFixed(2) || '0.00'] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("div", { className: "text-sm text-gray-600 mb-1", children: "This Month" }), _jsxs("div", { className: "text-2xl font-bold text-blue-600", children: ["\u20B9", stats?.monthTotal?.toFixed(2) || '0.00'] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("div", { className: "text-sm text-gray-600 mb-1", children: "Total Pending" }), _jsxs("div", { className: "text-2xl font-bold text-orange-600", children: ["\u20B9", stats?.totalPending?.toFixed(2) || '0.00'] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("div", { className: "text-sm text-gray-600 mb-1", children: "Overdue Fees" }), _jsx("div", { className: "text-2xl font-bold text-red-600", children: stats?.overdueCount || 0 })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("button", { onClick: () => navigate('/clerk/fee-collection'), className: "p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 text-left", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83D\uDCB0" }), _jsx("div", { className: "font-semibold", children: "Collect Student Fees" }), _jsx("div", { className: "text-sm text-gray-600", children: "Record fee payments" })] }), _jsxs("button", { onClick: () => navigate('/clerk/payment-history'), className: "p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 text-left", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83D\uDCDC" }), _jsx("div", { className: "font-semibold", children: "Payment History" }), _jsx("div", { className: "text-sm text-gray-600", children: "View all transactions" })] })] })] })] }))] }) })] }));
}
