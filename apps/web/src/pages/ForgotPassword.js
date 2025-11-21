import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../utils/api.js';
export default function ForgotPassword() {
    const navigate = useNavigate();
    const [mode, setMode] = useState('student');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    // Step 1: Request OTP
    const [username, setUsername] = useState('');
    const [schoolCode, setSchoolCode] = useState('');
    const [useRegistrationNumber, setUseRegistrationNumber] = useState(false);
    const [email, setEmail] = useState('');
    // Step 2: Verify OTP
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const handleRequestOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            let endpoint = '';
            let requestBody = {};
            if (mode === 'student') {
                // Student flow: username + school code
                if (!username.trim() || !schoolCode.trim()) {
                    throw new Error('Username and school code are required');
                }
                endpoint = `${API_URL}/auth/forgot-password-request`;
                requestBody = {
                    username: username.trim()
                };
                if (useRegistrationNumber) {
                    requestBody.registration_number = schoolCode;
                }
                else {
                    requestBody.join_code = schoolCode.toUpperCase();
                }
            }
            else {
                // Email flow: just email
                if (!email.trim()) {
                    throw new Error('Email is required');
                }
                endpoint = `${API_URL}/auth/forgot-password-request-email`;
                requestBody = {
                    email: email.trim()
                };
            }
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to request OTP');
            }
            setSuccess(result.message);
            setStep(2);
        }
        catch (err) {
            setError(err.message || 'Failed to request OTP');
        }
        finally {
            setLoading(false);
        }
    };
    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        // Validation
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            setLoading(false);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }
        if (otp.length !== 6) {
            setError('OTP must be 6 digits');
            setLoading(false);
            return;
        }
        try {
            const requestBody = {
                otp: otp.trim(),
                new_password: newPassword
            };
            if (mode === 'student') {
                // Student flow: username + school code
                requestBody.username = username.trim();
                if (useRegistrationNumber) {
                    requestBody.registration_number = schoolCode;
                }
                else {
                    requestBody.join_code = schoolCode.toUpperCase();
                }
            }
            else {
                // Email flow: just email
                requestBody.email = email.trim();
            }
            const response = await fetch(`${API_URL}/auth/forgot-password-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to reset password');
            }
            setSuccess('Password reset successfully! Redirecting to login...');
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        }
        catch (err) {
            setError(err.message || 'Failed to reset password');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4", children: _jsx("div", { className: "max-w-md w-full", children: _jsxs("div", { className: "bg-white p-8 rounded-2xl shadow-2xl border border-gray-100", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4", children: _jsx("svg", { className: "w-8 h-8 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-gray-800 mb-2", children: "Reset Password" }), _jsx("p", { className: "text-gray-600", children: step === 1
                                    ? (mode === 'student'
                                        ? 'Enter your username and school code to receive an OTP'
                                        : 'Enter your email to receive an OTP')
                                    : 'Enter the OTP sent to your email and set a new password' })] }), step === 1 && (_jsxs("div", { className: "mb-6 flex gap-2 bg-gray-100 p-1 rounded-lg", children: [_jsx("button", { type: "button", onClick: () => {
                                    setMode('student');
                                    setUsername('');
                                    setSchoolCode('');
                                    setEmail('');
                                    setError('');
                                    setSuccess('');
                                }, className: `flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'student'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'}`, children: "Student" }), _jsx("button", { type: "button", onClick: () => {
                                    setMode('email');
                                    setUsername('');
                                    setSchoolCode('');
                                    setEmail('');
                                    setError('');
                                    setSuccess('');
                                }, className: `flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${mode === 'email'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-800'}`, children: "Principal/Teacher" })] })), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-red-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-red-700 text-sm font-medium", children: error })] }) })), success && (_jsx("div", { className: "mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg", children: _jsxs("div", { className: "flex items-center", children: [_jsx("svg", { className: "w-5 h-5 text-green-500 mr-2", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }), _jsx("p", { className: "text-green-700 text-sm font-medium", children: success })] }) })), step === 1 ? (_jsxs("form", { onSubmit: handleRequestOTP, className: "space-y-5", children: [mode === 'student' ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Username" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }) }) }), _jsx("input", { type: "text", required: true, value: username, onChange: (e) => setUsername(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your username" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700", children: "School Code" }), _jsxs("button", { type: "button", onClick: () => {
                                                            setUseRegistrationNumber(!useRegistrationNumber);
                                                            setSchoolCode('');
                                                        }, className: "text-xs text-blue-600 hover:text-blue-700 underline", children: ["Use ", useRegistrationNumber ? 'Join Code' : 'Registration Number', " instead"] })] }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" }) }) }), _jsx("input", { type: "text", required: true, value: schoolCode, onChange: (e) => setSchoolCode(e.target.value.toUpperCase()), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: useRegistrationNumber ? "Enter school registration number" : "Enter school join code" })] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: useRegistrationNumber
                                                    ? "Enter your school's registration number"
                                                    : "Enter your school's join code" })] })] })) : (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Email Address" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" }) }) }), _jsx("input", { type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter your email address" })] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Enter the email address associated with your principal or teacher account" })] })), _jsx("button", { type: "submit", disabled: loading, className: "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Sending OTP..."] })) : ('Send OTP') })] })) : (_jsxs("form", { onSubmit: handleVerifyOTP, className: "space-y-5", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "OTP Code" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("input", { type: "text", required: true, maxLength: 6, value: otp, onChange: (e) => setOtp(e.target.value.replace(/\D/g, '')), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-center text-2xl font-mono tracking-widest", placeholder: "000000" })] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Enter the 6-digit code sent to your email" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "New Password" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("input", { type: "password", required: true, value: newPassword, onChange: (e) => setNewPassword(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Enter new password (min. 8 characters)", minLength: 8 })] }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Password must be at least 8 characters long" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold text-gray-700 mb-2", children: "Confirm Password" }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: _jsx("svg", { className: "h-5 w-5 text-gray-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("input", { type: "password", required: true, value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), className: "w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none", placeholder: "Confirm new password", minLength: 8 })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: () => {
                                            setStep(1);
                                            setOtp('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                            setError('');
                                            setSuccess('');
                                        }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-all", children: "Back" }), _jsx("button", { type: "submit", disabled: loading, className: "flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl", children: loading ? (_jsxs("span", { className: "flex items-center justify-center", children: [_jsxs("svg", { className: "animate-spin -ml-1 mr-3 h-5 w-5 text-white", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Resetting Password..."] })) : ('Reset Password') })] })] })), _jsx("div", { className: "mt-6 text-center", children: _jsx(Link, { to: "/login", className: "text-blue-600 hover:text-blue-700 font-semibold hover:underline transition text-sm", children: "\u2190 Back to Login" }) })] }) }) }));
}
