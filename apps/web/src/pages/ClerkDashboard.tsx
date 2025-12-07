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
  const [stats, setStats] = useState<any>(null);

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
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      // Load stats
      const response = await fetch(`${API_URL}/clerk-fees/stats`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
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
            <button
              onClick={() => navigate('/clerk/fee-collection')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
            >
              💰 Collect Fees
            </button>
            <button
              onClick={() => navigate('/clerk/payment-history')}
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
            >
              📜 Payment History
            </button>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Clerk Dashboard</h1>
          
          {loadingData ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              Loading dashboard data...
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Today's Collection</div>
                  <div className="text-2xl font-bold text-green-600">
                    ₹{stats?.todayTotal?.toFixed(2) || '0.00'}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">This Month</div>
                  <div className="text-2xl font-bold text-blue-600">
                    ₹{stats?.monthTotal?.toFixed(2) || '0.00'}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Total Pending</div>
                  <div className="text-2xl font-bold text-orange-600">
                    ₹{stats?.totalPending?.toFixed(2) || '0.00'}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm text-gray-600 mb-1">Overdue Fees</div>
                  <div className="text-2xl font-bold text-red-600">
                    {stats?.overdueCount || 0}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => navigate('/clerk/fee-collection')}
                    className="p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 text-left"
                  >
                    <div className="text-2xl mb-2">💰</div>
                    <div className="font-semibold">Collect Student Fees</div>
                    <div className="text-sm text-gray-600">Record fee payments</div>
                  </button>
                  
                  <button
                    onClick={() => navigate('/clerk/payment-history')}
                    className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 text-left"
                  >
                    <div className="text-2xl mb-2">📜</div>
                    <div className="font-semibold">Payment History</div>
                    <div className="text-sm text-gray-600">View all transactions</div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

