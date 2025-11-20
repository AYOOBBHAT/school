import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
export default function Signup() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Principal form state
    const [principalForm, setPrincipalForm] = useState({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        school_name: '',
        school_address: '',
        school_registration_number: '',
        contact_phone: '',
        contact_email: ''
    });
    const [signupSuccess, setSignupSuccess] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const handlePrincipalSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/auth/signup-principal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(principalForm)
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Signup failed');
            }
            // Set session if provided (user is automatically logged in)
            if (data.session) {
                await supabase.auth.setSession(data.session);
            }
            // Show success message with join code
            if (data.school?.join_code) {
                setJoinCode(data.school.join_code);
                setSignupSuccess(true);
            }
            else {
                // If no join code in response, redirect to login
                navigate('/login');
            }
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    const copyJoinCode = async () => {
        if (joinCode) {
            try {
                await navigator.clipboard.writeText(joinCode);
                alert('Join code copied to clipboard!');
            }
            catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    };
    if (signupSuccess && joinCode) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"The roots of education are bitter, but the fruit is sweet.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Aristotle" })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6", children: _jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-3", children: "School Created Successfully!" }), _jsx("p", { className: "text-gray-600 mb-8", children: "Your school has been created. Here is your join code to share with teachers, students, and parents:" }), _jsxs("div", { className: "bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg", children: [_jsx("p", { className: "text-sm opacity-90 mb-3 font-medium", children: "School Join Code" }), _jsx("code", { className: "text-4xl font-bold font-mono block mb-6 tracking-wider", children: joinCode }), _jsx("button", { onClick: copyJoinCode, className: "bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition transform hover:scale-105 shadow-md", children: _jsxs("span", { className: "flex items-center justify-center", children: [_jsx("svg", { className: "w-5 h-5 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), "Copy Join Code"] }) })] }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "Please log in with your credentials to access your dashboard." }), _jsx(Link, { to: "/login", className: "inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition transform hover:scale-105 shadow-lg hover:shadow-xl", children: "Go to Login" }), _jsx("div", { className: "mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100", children: _jsxs("p", { className: "text-xs text-blue-800 flex items-center justify-center", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z", clipRule: "evenodd" }) }), "Tip: Save this join code! You can also find it in your dashboard after logging in."] }) })] })] }) }));
    }
    if (!signupSuccess) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"The function of education is to teach one to think intensively and to think critically.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Martin Luther King Jr." })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Create Your School" }), _jsx("p", { className: "text-gray-600", children: "Set up your school management system" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-red-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-red-700 text-sm font-medium", children: error })] }) })), _jsxs("form", { onSubmit: handlePrincipalSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Full Name" }), _jsx("input", { type: "text", required: true, value: principalForm.full_name, onChange: (e) => setPrincipalForm({ ...principalForm, full_name: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your full name" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Email Address" }), _jsx("input", { type: "email", required: true, value: principalForm.email, onChange: (e) => setPrincipalForm({ ...principalForm, email: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your email" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", required: true, minLength: 8, value: principalForm.password, onChange: (e) => setPrincipalForm({ ...principalForm, password: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Phone Number" }), _jsx("input", { type: "tel", required: true, value: principalForm.phone, onChange: (e) => setPrincipalForm({ ...principalForm, phone: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your phone number" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Name" }), _jsx("input", { type: "text", required: true, value: principalForm.school_name, onChange: (e) => setPrincipalForm({ ...principalForm, school_name: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter school name" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Registration Number" }), _jsx("input", { type: "text", required: true, value: principalForm.school_registration_number, onChange: (e) => setPrincipalForm({ ...principalForm, school_registration_number: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter school registration number (unique)" }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "This must be unique for each school" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Address" }), _jsx("textarea", { value: principalForm.school_address, onChange: (e) => setPrincipalForm({ ...principalForm, school_address: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none", rows: 3, placeholder: "Enter school address" })] }), _jsx("div", { className: "pt-2", children: _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Creating..."] })) : ('Create School') }) })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-gray-600 text-sm", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-blue-600 hover:text-blue-700 font-semibold hover:underline transition", children: "Login" })] }) })] })] }) }));
    }
    return null;
}
