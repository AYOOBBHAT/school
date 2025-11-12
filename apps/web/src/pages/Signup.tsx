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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Create Account</h2>
            <p className="mt-2 text-gray-600">Choose your role</p>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => setStep('principal')}
              className="w-full bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition text-left"
            >
              <div className="font-semibold">Principal / School Admin</div>
              <div className="text-sm opacity-90">Create a new school</div>
            </button>
            <button
              onClick={() => setStep('join')}
              className="w-full bg-gray-200 text-gray-900 p-4 rounded-lg hover:bg-gray-300 transition text-left"
            >
              <div className="font-semibold">Join Existing School</div>
              <div className="text-sm opacity-70">Clerk, Teacher, Student, or Parent</div>
            </button>
          </div>
          <div className="text-center">
            <Link to="/login" className="text-blue-600 hover:underline">
              Already have an account? Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (signupSuccess && joinCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-4">School Created Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your school has been created. Here is your join code to share with teachers, students, and parents:
          </p>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 mb-6 text-white">
            <p className="text-sm opacity-90 mb-2">School Join Code</p>
            <code className="text-3xl font-bold font-mono block mb-4">{joinCode}</code>
            <button
              onClick={copyJoinCode}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              📋 Copy Join Code
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Please log in with your credentials to access your dashboard.
          </p>
          <Link
            to="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Login
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            💡 Tip: Save this join code! You can also find it in your dashboard after logging in.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'principal') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6">Create School</h2>
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          <form onSubmit={handlePrincipalSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                value={principalForm.full_name}
                onChange={(e) => setPrincipalForm({ ...principalForm, full_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={principalForm.email}
                onChange={(e) => setPrincipalForm({ ...principalForm, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={principalForm.password}
                onChange={(e) => setPrincipalForm({ ...principalForm, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">School Name</label>
              <input
                type="text"
                required
                value={principalForm.school_name}
                onChange={(e) => setPrincipalForm({ ...principalForm, school_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">School Address</label>
              <textarea
                value={principalForm.school_address}
                onChange={(e) => setPrincipalForm({ ...principalForm, school_address: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                rows={2}
              />
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep('role')}
                className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create School'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Join School</h2>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              required
              value={joinForm.full_name}
              onChange={(e) => setJoinForm({ ...joinForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={joinForm.email}
              onChange={(e) => setJoinForm({ ...joinForm, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={joinForm.password}
              onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={joinForm.role}
              onChange={(e) => handleRoleChange(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-md"
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
                <label className="block text-sm font-medium mb-1">School</label>
                <select
                  value={joinForm.school_id}
                  onChange={(e) => handleSchoolChange(e.target.value)}
                  required
                  disabled={loadingSchools}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                {loadingSchools && (
                  <p className="text-xs text-gray-500 mt-1">Loading schools...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Join Code</label>
                <input
                  type="text"
                  required
                  placeholder="Will be auto-filled when you select a school"
                  value={joinForm.join_code}
                  readOnly
                  className="w-full px-3 py-2 border rounded-md bg-gray-50 uppercase"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Join code is automatically filled when you select a school
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Roll Number (Optional)</label>
                <input
                  type="text"
                  value={joinForm.roll_number}
                  onChange={(e) => setJoinForm({ ...joinForm, roll_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter your roll number"
                />
              </div>
            </>
          ) : (
            /* Manual Join Code Entry for Non-Students */
            <div>
              <label className="block text-sm font-medium mb-1">School Join Code</label>
              <input
                type="text"
                required
                placeholder="XXXX-XXXX-XXXX"
                value={joinForm.join_code}
                onChange={(e) => setJoinForm({ ...joinForm, join_code: e.target.value })}
                className="w-full px-3 py-2 border rounded-md uppercase"
                maxLength={14}
              />
              <p className="text-xs text-gray-500 mt-1">Get this code from your school administrator</p>
            </div>
          )}
          {joinForm.role === 'parent' && (
            <div>
              <label className="block text-sm font-medium mb-1">Child Student ID (Optional)</label>
              <input
                type="text"
                value={joinForm.child_student_id}
                onChange={(e) => setJoinForm({ ...joinForm, child_student_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="UUID of student"
              />
            </div>
          )}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStep('role')}
              className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join School'}
            </button>
          </div>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" className="text-blue-600 hover:underline text-sm">
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}



