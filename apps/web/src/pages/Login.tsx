import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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

      if (!data.user) throw new Error('Login failed');

      // Get user profile to determine role and approval status
      // Try direct Supabase query first
      let profile: any = null;
      let profileError: any = null;

      const { data: profileData, error: directProfileError } = await supabase
        .from('profiles')
        .select('id, role, approval_status, school_id, full_name, email')
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Login</h2>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/signup" className="text-blue-600 hover:underline text-sm">
            Don't have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}



