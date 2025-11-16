import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export default function Signup() {
    const navigate = useNavigate();
    const [step, setStep] = useState('role');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Principal form state
    const [principalForm, setPrincipalForm] = useState({
        email: '',
        password: '',
        full_name: '',
        school_name: '',
        school_address: '',
        contact_phone: '',
        contact_email: ''
    });
    // Join form state
    const [joinForm, setJoinForm] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'teacher',
        school_id: '',
        join_code: '',
        roll_number: '',
        child_student_id: ''
    });
    const [signupSuccess, setSignupSuccess] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [schools, setSchools] = useState([]);
    const [loadingSchools, setLoadingSchools] = useState(false);
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
    // Load schools list for student signup
    useEffect(() => {
        if (step === 'join') {
            loadSchools();
        }
    }, [step]);
    const loadSchools = async () => {
        setLoadingSchools(true);
        try {
            const response = await fetch(`${API_URL}/auth/schools`);
            if (!response.ok) {
                console.error('Failed to load schools');
                return;
            }
            const data = await response.json();
            setSchools(data.schools || []);
        }
        catch (err) {
            console.error('Error loading schools:', err);
        }
        finally {
            setLoadingSchools(false);
        }
    };
    const handleSchoolChange = (schoolId) => {
        const selectedSchool = schools.find(s => s.id === schoolId);
        if (selectedSchool) {
            setJoinForm({
                ...joinForm,
                school_id: schoolId,
                join_code: selectedSchool.join_code
            });
        }
        else {
            setJoinForm({
                ...joinForm,
                school_id: '',
                join_code: ''
            });
        }
    };
    const handleRoleChange = (role) => {
        // Reset school selection when role changes
        setJoinForm({
            ...joinForm,
            role,
            school_id: '',
            join_code: ''
        });
    };
    const handleJoinSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // For students, validate that school is selected
            if (joinForm.role === 'student' && !joinForm.school_id) {
                setError('Please select a school');
                setLoading(false);
                return;
            }
            // Validate join code is provided
            if (!joinForm.join_code) {
                setError('Join code is required');
                setLoading(false);
                return;
            }
            const res = await fetch(`${API_URL}/auth/signup-join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: joinForm.email,
                    password: joinForm.password,
                    full_name: joinForm.full_name,
                    role: joinForm.role,
                    join_code: joinForm.join_code.toUpperCase().replace(/\s/g, ''),
                    roll_number: joinForm.roll_number || null,
                    child_student_id: joinForm.child_student_id || null
                })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Signup failed');
            }
            if (data.approval_required) {
                navigate('/pending-approval');
            }
            else {
                if (data.token)
                    localStorage.setItem('token', data.token);
                navigate(data.redirect || '/');
            }
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    };
    if (step === 'role') {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full space-y-8", children: [_jsx("div", { className: "text-center", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"The beautiful thing about learning is that no one can take it away from you.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 B.B. King" })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Get Started" }), _jsx("p", { className: "text-gray-600", children: "Choose your role to continue" })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("button", { onClick: () => setStep('principal'), className: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-left group", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-bold text-lg mb-1", children: "Principal / School Admin" }), _jsx("div", { className: "text-sm opacity-90", children: "Create a new school" })] }), _jsx("svg", { className: "w-6 h-6 opacity-80 group-hover:translate-x-1 transition-transform", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] }) }), _jsx("button", { onClick: () => setStep('join'), className: "w-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 p-5 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg text-left group border-2 border-gray-200", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-bold text-lg mb-1", children: "Join Existing School" }), _jsx("div", { className: "text-sm opacity-70", children: "Clerk, Teacher, Student, or Parent" })] }), _jsx("svg", { className: "w-6 h-6 opacity-60 group-hover:translate-x-1 transition-transform", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] }) })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-gray-600 text-sm", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-blue-600 hover:text-blue-700 font-semibold hover:underline transition", children: "Login" })] }) })] })] }) }));
    }
    if (signupSuccess && joinCode) {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"The roots of education are bitter, but the fruit is sweet.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Aristotle" })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6", children: _jsx("svg", { className: "w-10 h-10 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-3", children: "School Created Successfully!" }), _jsx("p", { className: "text-gray-600 mb-8", children: "Your school has been created. Here is your join code to share with teachers, students, and parents:" }), _jsxs("div", { className: "bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg", children: [_jsx("p", { className: "text-sm opacity-90 mb-3 font-medium", children: "School Join Code" }), _jsx("code", { className: "text-4xl font-bold font-mono block mb-6 tracking-wider", children: joinCode }), _jsx("button", { onClick: copyJoinCode, className: "bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition transform hover:scale-105 shadow-md", children: _jsxs("span", { className: "flex items-center justify-center", children: [_jsx("svg", { className: "w-5 h-5 mr-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) }), "Copy Join Code"] }) })] }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "Please log in with your credentials to access your dashboard." }), _jsx(Link, { to: "/login", className: "inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition transform hover:scale-105 shadow-lg hover:shadow-xl", children: "Go to Login" }), _jsx("div", { className: "mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100", children: _jsxs("p", { className: "text-xs text-blue-800 flex items-center justify-center", children: [_jsx("svg", { className: "w-4 h-4 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z", clipRule: "evenodd" }) }), "Tip: Save this join code! You can also find it in your dashboard after logging in."] }) })] })] }) }));
    }
    if (step === 'principal') {
        return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"The function of education is to teach one to think intensively and to think critically.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Martin Luther King Jr." })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Create Your School" }), _jsx("p", { className: "text-gray-600", children: "Set up your school management system" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-red-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-red-700 text-sm font-medium", children: error })] }) })), _jsxs("form", { onSubmit: handlePrincipalSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Full Name" }), _jsx("input", { type: "text", required: true, value: principalForm.full_name, onChange: (e) => setPrincipalForm({ ...principalForm, full_name: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your full name" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Email Address" }), _jsx("input", { type: "email", required: true, value: principalForm.email, onChange: (e) => setPrincipalForm({ ...principalForm, email: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your email" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", required: true, minLength: 8, value: principalForm.password, onChange: (e) => setPrincipalForm({ ...principalForm, password: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Name" }), _jsx("input", { type: "text", required: true, value: principalForm.school_name, onChange: (e) => setPrincipalForm({ ...principalForm, school_name: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter school name" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Address" }), _jsx("textarea", { value: principalForm.school_address, onChange: (e) => setPrincipalForm({ ...principalForm, school_address: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none", rows: 3, placeholder: "Enter school address" })] }), _jsxs("div", { className: "flex gap-4 pt-2", children: [_jsx("button", { type: "button", onClick: () => setStep('role'), className: "flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700 transition-all", children: "Back" }), _jsx("button", { type: "submit", disabled: loading, className: "flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Creating..."] })) : ('Create School') })] })] })] })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsxs("div", { className: "max-w-md w-full", children: [_jsx("div", { className: "text-center mb-8", children: _jsxs("div", { className: "inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20", children: [_jsx("p", { className: "text-lg font-semibold text-gray-800 italic", children: "\"Learning never exhausts the mind.\"" }), _jsx("p", { className: "text-sm text-gray-600 mt-2", children: "\u2014 Leonardo da Vinci" })] }) }), _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Join Your School" }), _jsx("p", { className: "text-gray-600", children: "Connect with your educational community" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-red-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-red-700 text-sm font-medium", children: error })] }) })), _jsxs("form", { onSubmit: handleJoinSubmit, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Full Name" }), _jsx("input", { type: "text", required: true, value: joinForm.full_name, onChange: (e) => setJoinForm({ ...joinForm, full_name: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your full name" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Email Address" }), _jsx("input", { type: "email", required: true, value: joinForm.email, onChange: (e) => setJoinForm({ ...joinForm, email: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your email" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Password" }), _jsx("input", { type: "password", required: true, minLength: 8, value: joinForm.password, onChange: (e) => setJoinForm({ ...joinForm, password: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Role" }), _jsxs("select", { value: joinForm.role, onChange: (e) => handleRoleChange(e.target.value), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white", children: [_jsx("option", { value: "clerk", children: "Clerk / Accountant" }), _jsx("option", { value: "teacher", children: "Teacher" }), _jsx("option", { value: "student", children: "Student" }), _jsx("option", { value: "parent", children: "Parent" })] })] }), joinForm.role === 'student' ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School" }), _jsxs("select", { value: joinForm.school_id, onChange: (e) => handleSchoolChange(e.target.value), required: true, disabled: loadingSchools, className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white", children: [_jsx("option", { value: "", children: "Select a school" }), schools.map((school) => (_jsx("option", { value: school.id, children: school.name }, school.id)))] }), loadingSchools && (_jsxs("p", { className: "text-xs text-gray-500 mt-2 flex items-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Loading schools..."] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Join Code" }), _jsx("input", { type: "text", required: true, placeholder: "Will be auto-filled when you select a school", value: joinForm.join_code, readOnly: true, className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500" }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Join code is automatically filled when you select a school" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Roll Number (Optional)" }), _jsx("input", { type: "text", value: joinForm.roll_number, onChange: (e) => setJoinForm({ ...joinForm, roll_number: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your roll number" })] })] })) : (
                                /* Manual Join Code Entry for Non-Students */
                                _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "School Join Code" }), _jsx("input", { type: "text", required: true, placeholder: "XXXX-XXXX-XXXX", value: joinForm.join_code, onChange: (e) => setJoinForm({ ...joinForm, join_code: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", maxLength: 14 }), _jsx("p", { className: "text-xs text-gray-500 mt-2", children: "Get this code from your school administrator" })] })), joinForm.role === 'parent' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Child Student ID (Optional)" }), _jsx("input", { type: "text", value: joinForm.child_student_id, onChange: (e) => setJoinForm({ ...joinForm, child_student_id: e.target.value }), className: "w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "UUID of student" })] })), _jsxs("div", { className: "flex gap-4 pt-2", children: [_jsx("button", { type: "button", onClick: () => setStep('role'), className: "flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700 transition-all", children: "Back" }), _jsx("button", { type: "submit", disabled: loading, className: "flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Joining..."] })) : ('Join School') })] })] }), _jsx("div", { className: "mt-6 text-center", children: _jsxs("p", { className: "text-gray-600 text-sm", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-blue-600 hover:text-blue-700 font-semibold hover:underline transition", children: "Login" })] }) })] })] }) }));
}
