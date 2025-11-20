import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@school/ui';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

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

      // Set session if provided (user is automatically logged in)
      if (data.session) {
        await supabase.auth.setSession(data.session);
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

  if (!signupSuccess) {
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
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
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

  return null;
}
