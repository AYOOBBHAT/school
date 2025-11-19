import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@school/ui';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'role' | 'principal' | 'join'>('role');
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

  // Join form state
  const [joinForm, setJoinForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'teacher' as 'clerk' | 'teacher' | 'student' | 'parent',
    school_id: '',
    join_code: '',
    roll_number: '',
    child_student_id: ''
  });

  const [signupSuccess, setSignupSuccess] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [schools, setSchools] = useState<Array<{ id: string; name: string; join_code: string }>>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const handlePrincipalSubmit = async (e: React.FormEvent) => {
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
      } else {
        // If no join code in response, redirect to login
        navigate('/login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyJoinCode = async () => {
    if (joinCode) {
      try {
        await navigator.clipboard.writeText(joinCode);
        alert('Join code copied to clipboard!');
      } catch (err) {
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
    } catch (err) {
      console.error('Error loading schools:', err);
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleSchoolChange = (schoolId: string) => {
    const selectedSchool = schools.find(s => s.id === schoolId);
    if (selectedSchool) {
      setJoinForm({
        ...joinForm,
        school_id: schoolId,
        join_code: selectedSchool.join_code
      });
    } else {
      setJoinForm({
        ...joinForm,
        school_id: '',
        join_code: ''
      });
    }
  };

  const handleRoleChange = (role: 'clerk' | 'teacher' | 'student' | 'parent') => {
    // Reset school selection when role changes
    setJoinForm({
      ...joinForm,
      role,
      school_id: '',
      join_code: ''
    });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
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
      } else {
        if (data.token) localStorage.setItem('token', data.token);
        navigate(data.redirect || '/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          {/* Inspirational Quote */}
          <div className="text-center">
            <div className="inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20">
              <p className="text-lg font-semibold text-gray-800 italic">
                "The beautiful thing about learning is that no one can take it away from you."
              </p>
              <p className="text-sm text-gray-600 mt-2">— B.B. King</p>
            </div>
          </div>

          {/* Role Selection Card */}
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Get Started</h2>
              <p className="text-gray-600">Choose your role to continue</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setStep('principal')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg mb-1">Principal / School Admin</div>
                    <div className="text-sm opacity-90">Create a new school</div>
                  </div>
                  <svg className="w-6 h-6 opacity-80 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <button
                onClick={() => setStep('join')}
                className="w-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 p-5 rounded-xl hover:from-gray-200 hover:to-gray-300 transition-all transform hover:scale-[1.02] shadow-md hover:shadow-lg text-left group border-2 border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg mb-1">Join Existing School</div>
                    <div className="text-sm opacity-70">Clerk, Teacher, Student, or Parent</div>
                  </div>
                  <svg className="w-6 h-6 opacity-60 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (signupSuccess && joinCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          {/* Inspirational Quote */}
          <div className="text-center mb-8">
            <div className="inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20">
              <p className="text-lg font-semibold text-gray-800 italic">
                "The roots of education are bitter, but the fruit is sweet."
              </p>
              <p className="text-sm text-gray-600 mt-2">— Aristotle</p>
            </div>
          </div>

          {/* Success Card */}
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">School Created Successfully!</h2>
            <p className="text-gray-600 mb-8">
              Your school has been created. Here is your join code to share with teachers, students, and parents:
            </p>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg">
              <p className="text-sm opacity-90 mb-3 font-medium">School Join Code</p>
              <code className="text-4xl font-bold font-mono block mb-6 tracking-wider">{joinCode}</code>
              <button
                onClick={copyJoinCode}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition transform hover:scale-105 shadow-md"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Join Code
                </span>
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Please log in with your credentials to access your dashboard.
            </p>
            <Link
              to="/login"
              className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Go to Login
            </Link>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800 flex items-center justify-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Tip: Save this join code! You can also find it in your dashboard after logging in.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'principal') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          {/* Inspirational Quote */}
          <div className="text-center mb-8">
            <div className="inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20">
              <p className="text-lg font-semibold text-gray-800 italic">
                "The function of education is to teach one to think intensively and to think critically."
              </p>
              <p className="text-sm text-gray-600 mt-2">— Martin Luther King Jr.</p>
            </div>
          </div>

          {/* Create School Card */}
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Create Your School</h2>
              <p className="text-gray-600">Set up your school management system</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-700 text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handlePrincipalSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={principalForm.full_name}
                  onChange={(e) => setPrincipalForm({ ...principalForm, full_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={principalForm.email}
                  onChange={(e) => setPrincipalForm({ ...principalForm, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={principalForm.password}
                  onChange={(e) => setPrincipalForm({ ...principalForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={principalForm.phone}
                  onChange={(e) => setPrincipalForm({ ...principalForm, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter your phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Name</label>
                <input
                  type="text"
                  required
                  value={principalForm.school_name}
                  onChange={(e) => setPrincipalForm({ ...principalForm, school_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter school name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Registration Number</label>
                <input
                  type="text"
                  required
                  value={principalForm.school_registration_number}
                  onChange={(e) => setPrincipalForm({ ...principalForm, school_registration_number: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter school registration number (unique)"
                />
                <p className="text-xs text-gray-500 mt-2">This must be unique for each school</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School Address</label>
                <textarea
                  value={principalForm.school_address}
                  onChange={(e) => setPrincipalForm({ ...principalForm, school_address: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none resize-none"
                  rows={3}
                  placeholder="Enter school address"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700 transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create School'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Inspirational Quote */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20">
            <p className="text-lg font-semibold text-gray-800 italic">
              "Learning never exhausts the mind."
            </p>
            <p className="text-sm text-gray-600 mt-2">— Leonardo da Vinci</p>
          </div>
        </div>

        {/* Join School Card */}
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Join Your School</h2>
            <p className="text-gray-600">Connect with your educational community</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              required
              value={joinForm.full_name}
              onChange={(e) => setJoinForm({ ...joinForm, full_name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              required
              value={joinForm.email}
              onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={joinForm.password}
              onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
            <select
              value={joinForm.role}
              onChange={(e) => handleRoleChange(e.target.value as any)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white"
            >
              <option value="clerk">Clerk / Accountant</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
            </select>
          </div>

          {/* School Selection for Students */}
          {joinForm.role === 'student' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">School</label>
                <select
                  value={joinForm.school_id}
                  onChange={(e) => handleSchoolChange(e.target.value)}
                  required
                  disabled={loadingSchools}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-white"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                {loadingSchools && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading schools...
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Join Code</label>
                <input
                  type="text"
                  required
                  placeholder="Will be auto-filled when you select a school"
                  value={joinForm.join_code}
                  readOnly
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg bg-gray-50 uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Join code is automatically filled when you select a school
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Roll Number (Optional)</label>
                <input
                  type="text"
                  value={joinForm.roll_number}
                  onChange={(e) => setJoinForm({ ...joinForm, roll_number: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter your roll number"
                />
              </div>
            </>
          ) : (
            /* Manual Join Code Entry for Non-Students */
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">School Join Code</label>
              <input
                type="text"
                required
                placeholder="XXXX-XXXX-XXXX"
                value={joinForm.join_code}
                onChange={(e) => setJoinForm({ ...joinForm, join_code: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg uppercase font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                maxLength={14}
              />
              <p className="text-xs text-gray-500 mt-2">Get this code from your school administrator</p>
            </div>
          )}
          {joinForm.role === 'parent' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Child Student ID (Optional)</label>
              <input
                type="text"
                value={joinForm.child_student_id}
                onChange={(e) => setJoinForm({ ...joinForm, child_student_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="UUID of student"
              />
            </div>
          )}
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => setStep('role')}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-gray-700 transition-all"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join School'
              )}
            </button>
          </div>
        </form>
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition">
              Login
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}



