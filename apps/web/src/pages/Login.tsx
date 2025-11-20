import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function Login() {
  const navigate = useNavigate();
  const [loginMode, setLoginMode] = useState<'email' | 'username'>('email');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [useRegistrationNumber, setUseRegistrationNumber] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let data: any;
      let authError: any;

      if (loginMode === 'username') {
        // Username-based login for students
        if (!username || !password || !schoolCode) {
          throw new Error('Username, password, and school code are required');
        }

        const requestBody: any = {
          username,
          password
        };

        if (useRegistrationNumber) {
          requestBody.registration_number = schoolCode;
        } else {
          requestBody.join_code = schoolCode;
        }

        const response = await fetch(`${API_URL}/auth/login-username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Invalid username or password');
        }

        // Set session in Supabase client
        if (result.session) {
          await supabase.auth.setSession(result.session);
        }

        data = { user: result.user, session: result.session };

        // Check if password reset is required
        if (result.password_reset_required) {
          navigate('/reset-password');
          return;
        }
      } else {
        // Email-based login (existing flow)
        const authResult = await supabase.auth.signInWithPassword({
          email,
          password
        });

        data = authResult.data;
        authError = authResult.error;

        if (authError) {
          // Handle email confirmation error with helpful message
          if (authError.message?.toLowerCase().includes('email') && 
              authError.message?.toLowerCase().includes('confirm')) {
            throw new Error('Email not confirmed. Please check your email for a confirmation link, or contact your administrator.');
          }
          throw authError;
        }
      }

      if (!data.user) throw new Error('Login failed');

      // Get user profile to determine role and approval status
      // Try direct Supabase query first
      let profile: any = null;
      let profileError: any = null;

      const { data: profileData, error: directProfileError } = await supabase
        .from('profiles')
        .select('id, role, approval_status, school_id, full_name, email, password_reset_required')
        .eq('id', data.user.id)
        .single();

      if (directProfileError) {
        console.error('[Login] Direct profile fetch error:', directProfileError);
        profileError = directProfileError;
      } else {
        profile = profileData;
      }

      // If direct query failed, try backend API (bypasses RLS)
      if (profileError || !profile) {
        console.log('[Login] Trying backend API to fetch profile...');
        try {
          const token = data.session?.access_token;
          if (token) {
            
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
            } else {
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
        } catch (apiError) {
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
        school_id: profile.school_id,
        password_reset_required: profile.password_reset_required
      });

      // Check if password reset is required
      if (profile.password_reset_required) {
        navigate('/reset-password');
        return;
      }

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
      const redirectMap: Record<string, string> = {
        principal: '/principal/dashboard',
        clerk: '/clerk/fees',
        teacher: '/teacher/classes',
        student: '/student/home',
        parent: '/parent/home'
      };

      const redirectPath = redirectMap[profile.role] || '/';
      navigate(redirectPath);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Inspirational Quote */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-white/20">
            <p className="text-lg font-semibold text-gray-800 italic">
              "Education is the most powerful weapon which you can use to change the world."
            </p>
            <p className="text-sm text-gray-600 mt-2">— Nelson Mandela</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your school account</p>
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

          {/* Login Mode Toggle */}
          <div className="mb-6 flex gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setLoginMode('email');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                loginMode === 'email'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Principal/Staff Login
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('username');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                loginMode === 'username'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Student Login
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {loginMode === 'email' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    placeholder="Enter your email"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">School Code</label>
                    <button
                      type="button"
                      onClick={() => {
                        setUseRegistrationNumber(!useRegistrationNumber);
                        setSchoolCode('');
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 underline"
                    >
                      Use {useRegistrationNumber ? 'Join Code' : 'Registration Number'} instead
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      required
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      placeholder={useRegistrationNumber ? "Enter school registration number" : "Enter school join code"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {useRegistrationNumber 
                      ? "Enter your school's registration number" 
                      : "Enter your school's join code (usually provided by your administrator)"}
                  </p>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Enter your password"
                />
              </div>
            </div>
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
                  Logging in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



