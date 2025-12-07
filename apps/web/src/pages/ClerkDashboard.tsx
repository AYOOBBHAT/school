import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

import { API_URL } from '../utils/api.js';

export default function ClerkDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const verifyRole = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          navigate('/login');
          return;
        }

        const data = await response.json();
        const role = data.profile?.role;

        if (role !== 'clerk' && role !== 'principal') {
          const redirectMap: Record<string, string> = {
            teacher: '/teacher/classes',
            student: '/student/home',
            parent: '/parent'
          };
          const redirectPath = redirectMap[role] || '/login';
          navigate(redirectPath, { replace: true });
          return;
        }

        setProfile(data.profile);
        await loadInitialData();
      } catch (error) {
        console.error('[ClerkDashboard] Error verifying role:', error);
        navigate('/login');
      } finally {
        setCheckingRole(false);
      }
    };

    verifyRole();
  }, [navigate]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      // Initial data loading will be added here later
    } catch (error) {
      console.error('[ClerkDashboard] Failed to load initial data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };


  if (checkingRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-8">JhelumVerse</h1>
          <div className="mb-6">
            <div className="text-sm text-gray-400">Logged in as</div>
            <div className="font-semibold">{profile?.full_name || 'Clerk'}</div>
            <div className="text-sm text-gray-400">{profile?.email}</div>
          </div>
          <nav className="space-y-2">
            {/* Navigation items will be added here later */}
          </nav>
          <button
            onClick={handleLogout}
            className="mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64 flex-1">
        <div className="p-6">
          {loadingData ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              Loading dashboard data...
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <p>New routes will be added here.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

