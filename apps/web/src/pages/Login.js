import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (authError) {
                // Handle email confirmation error with helpful message
                if (authError.message?.toLowerCase().includes('email') &&
                    authError.message?.toLowerCase().includes('confirm')) {
                    throw new Error('Email not confirmed. Please check your email for a confirmation link, or contact your administrator.');
                }
                throw authError;
            }
            if (!data.user)
                throw new Error('Login failed');
            // Get user profile to determine role and approval status
            // Try direct Supabase query first
            let profile = null;
            let profileError = null;
            const { data: profileData, error: directProfileError } = await supabase
                .from('profiles')
                .select('id, role, approval_status, school_id, full_name, email')
                .eq('id', data.user.id)
                .single();
            if (directProfileError) {
                console.error('[Login] Direct profile fetch error:', directProfileError);
                profileError = directProfileError;
            }
            else {
                profile = profileData;
            }
            // If direct query failed, try backend API (bypasses RLS)
            if (profileError || !profile) {
                console.log('[Login] Trying backend API to fetch profile...');
                try {
                    const token = data.session?.access_token;
                    if (token) {
                        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                        // Try to get profile via backend
                        const response = await fetch(`${API_URL}/auth/profile`, {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });
                        if (response.ok) {
                            const profileResponse = await response.json();
                            profile = profileResponse.profile;
                            console.log('[Login] Profile fetched from backend API:', profile);
                        }
                        else {
                            // If student, try student profile endpoint
                            if (data.user.user_metadata?.role === 'student') {
                                const studentResponse = await fetch(`${API_URL}/students/profile`, {
                                    headers: {
                                        Authorization: `Bearer ${token}`,
                                    },
                                });
                                if (studentResponse.ok) {
                                    const studentData = await studentResponse.json();
                                    // If we got student data, they're approved and have a student record
                                    console.log('[Login] Student profile found via API, redirecting to dashboard');
                                    navigate('/student/home');
                                    return;
                                }
                            }
                        }
                    }
                }
                catch (apiError) {
                    console.error('[Login] Error fetching profile from API:', apiError);
                }
            }
            if (!profile) {
                throw new Error('Failed to load user profile. Please contact support or try logging in again.');
            }
            console.log('[Login] User profile loaded:', {
                id: profile.id,
                role: profile.role,
                approval_status: profile.approval_status,
                school_id: profile.school_id
            });
            // Check approval status (principals are always approved)
            if (profile.approval_status !== 'approved' && profile.role !== 'principal') {
                console.warn('[Login] User not approved:', {
                    role: profile.role,
                    approval_status: profile.approval_status,
                    profile_id: profile.id
                });
                navigate('/pending-approval');
                return;
            }
            // Role-based redirects
            const redirectMap = {
                principal: '/principal/dashboard',
                clerk: '/clerk/fees',
                teacher: '/teacher/classes',
                student: '/student/home',
                parent: '/parent/home'
            };
            const redirectPath = redirectMap[profile.role] || '/';
            navigate(redirectPath);
        }
        catch (err) {
            setError(err.message || 'Login failed');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"Education is the most powerful weapon which you can use to change the world.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Nelson Mandela" })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Welcome Back" }), _jsx("p", { className: "text-gray-600", children: "Sign in to your school account" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-red-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-red-700 text-sm font-medium", children: error })] }) })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Email Address" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" }) }) }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your email" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("input", { type: "password", required: true, value: password, onChange: (e) => setPassword(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your password" })] })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Logging in..."] })) : ('Sign In') })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-gray-600 text-sm", children: ["Don't have an account?", ' ', _jsx(Link, { to: "/signup", className: "text-blue-600 hover:text-blue-700 font-semibold hover:underline transition", children: "Sign up" })] }) })] })] }) }));
}
