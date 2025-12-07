import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
import { API_URL } from '../utils/api.js';
function Sidebar() {
    const navigate = useNavigate();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    return (_jsxs("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: [_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "Admin Panel" }), _jsx("nav", { className: "space-y-2", children: _jsx("button", { onClick: () => navigate('/admin/dashboard'), className: "w-full text-left px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition", children: "\uD83D\uDCCA All Schools" }) })] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 p-6", children: _jsx("button", { onClick: handleLogout, className: "w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition", children: "Logout" }) })] }));
}
export default function AdminDashboard() {
    const navigate = useNavigate();
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkingRole, setCheckingRole] = useState(true);
    useEffect(() => {
        const verifyRole = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    navigate('/login');
                    return;
                }
                const token = session.access_token;
                if (!token) {
                    navigate('/login');
                    return;
                }
                // Fetch profile from backend to verify admin role
                const response = await fetch(`${API_URL}/auth/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    console.error('[AdminDashboard] Failed to fetch profile');
                    navigate('/login');
                    return;
                }
                const data = await response.json();
                const profile = data.profile;
                // Check if user is admin
                if (profile?.role !== 'admin') {
                    console.warn('[AdminDashboard] User is not an admin, role:', profile?.role);
                    // Redirect based on role
                    const redirectMap = {
                        principal: '/principal/dashboard',
                        clerk: '/clerk/fees',
                        teacher: '/teacher/classes',
                        student: '/student/home',
                        parent: '/parent',
                    };
                    const redirectPath = redirectMap[profile?.role] || '/login';
                    navigate(redirectPath);
                    return;
                }
                setCheckingRole(false);
                loadSchools();
            }
            catch (err) {
                console.error('Error verifying role:', err);
                navigate('/login');
            }
        };
        verifyRole();
    }, [navigate]);
    const loadSchools = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/login');
                return;
            }
            const token = session.access_token;
            const response = await fetch(`${API_URL}/admin/schools`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load schools');
            }
            const data = await response.json();
            setSchools(data.schools || []);
        }
        catch (err) {
            console.error('Error loading schools:', err);
            setError(err.message || 'Failed to load schools');
        }
        finally {
            setLoading(false);
        }
    };
    const updatePaymentStatus = async (schoolId, newStatus) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session)
                return;
            const token = session.access_token;
            const response = await fetch(`${API_URL}/admin/schools/${schoolId}/payment-status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ payment_status: newStatus }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update payment status');
            }
            // Reload schools
            await loadSchools();
            alert('Payment status updated successfully');
        }
        catch (err) {
            console.error('Error updating payment status:', err);
            alert(err.message || 'Failed to update payment status');
        }
    };
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx(Sidebar, {}), _jsx("div", { className: "ml-64 flex-1 p-8", children: _jsxs("div", { className: "max-w-7xl mx-auto", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-6", children: "All Schools" }), error && (_jsx("div", { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4", children: error })), loading ? (_jsx("div", { className: "text-center py-12", children: _jsx("div", { className: "text-gray-600", children: "Loading schools..." }) })) : (_jsx("div", { className: "bg-white rounded-lg shadow overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "School Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Principal" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Total Students" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Payment Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Contact" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: schools.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No schools found" }) })) : (schools.map((school) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: school.name }), school.registration_number && (_jsxs("div", { className: "text-sm text-gray-500", children: ["Reg: ", school.registration_number] })), school.join_code && (_jsxs("div", { className: "text-sm text-gray-500", children: ["Code: ", school.join_code] }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: school.principal ? (_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-gray-900", children: school.principal.name }), _jsx("div", { className: "text-sm text-gray-500", children: school.principal.email }), school.principal.phone && (_jsx("div", { className: "text-sm text-gray-500", children: school.principal.phone }))] })) : (_jsx("span", { className: "text-sm text-gray-400", children: "No principal found" })) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: school.total_students }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${school.payment_status === 'paid'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-red-100 text-red-800'}`, children: school.payment_status === 'paid' ? 'Paid' : 'Unpaid' }) }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: [school.contact_email && (_jsx("div", { children: school.contact_email })), school.contact_phone && (_jsx("div", { children: school.contact_phone }))] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsx("button", { onClick: () => updatePaymentStatus(school.id, school.payment_status === 'paid' ? 'unpaid' : 'paid'), className: `mr-2 px-3 py-1 rounded ${school.payment_status === 'paid'
                                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200'}`, children: school.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark Paid' }) })] }, school.id)))) })] }) }) })), !loading && schools.length > 0 && (_jsxs("div", { className: "mt-4 text-sm text-gray-600", children: ["Total Schools: ", schools.length] }))] }) })] }));
}
