import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import FeeCollection from '../components/FeeCollection.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

import { API_URL } from '../utils/api.js';

export default function ClerkDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fee-collection'>('dashboard');
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sync activeTab with URL path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/clerk/fees') || path.includes('/clerk/payments')) {
      setActiveTab('fee-collection');
    } else if (path === '/clerk') {
      setActiveTab('dashboard');
    }
  }, [location.pathname]);

  // Load dashboard statistics
  useEffect(() => {
    if (activeTab === 'dashboard' && profile) {
      loadDashboardStats();
    }
  }, [activeTab, profile]);

  const loadDashboardStats = async () => {
    setLoadingStats(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      // Get students list
      const studentsRes = await fetch(`${API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const studentsData = studentsRes.ok ? await studentsRes.json() : { students: [] };

      // Get statistics from Supabase (using RLS)
      let recentPayments: any[] = [];
      let todayPayments: any[] = [];
      let pendingComponents: any[] = [];

      try {
        const { data, error } = await supabase
          .from('monthly_fee_payments')
          .select('payment_amount, payment_date, payment_mode')
          .order('payment_date', { ascending: false })
          .limit(10);
        if (!error && data) recentPayments = data;
      } catch (err) {
        console.error('Error loading recent payments:', err);
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('monthly_fee_payments')
          .select('payment_amount')
          .gte('payment_date', today);
        if (!error && data) todayPayments = data;
      } catch (err) {
        console.error('Error loading today payments:', err);
      }

      try {
        const { data, error } = await supabase
          .from('monthly_fee_components')
          .select('pending_amount')
          .in('status', ['pending', 'partially-paid', 'overdue'])
          .gt('pending_amount', 0);
        if (!error && data) pendingComponents = data;
      } catch (err) {
        console.error('Error loading pending components:', err);
      }

      const todayTotal = todayPayments.reduce((sum: number, p: any) => 
        sum + parseFloat(p.payment_amount || 0), 0);
      const totalPending = pendingComponents.reduce((sum: number, c: any) => 
        sum + parseFloat(c.pending_amount || 0), 0);

      setDashboardStats({
        totalStudents: studentsData.students?.length || 0,
        todayCollection: todayTotal,
        totalPending,
        recentPayments: recentPayments
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Set default stats on error
      setDashboardStats({
        totalStudents: 0,
        todayCollection: 0,
        totalPending: 0,
        recentPayments: []
      });
    } finally {
      setLoadingStats(false);
    }
  };

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
      } catch (error) {
        console.error('[ClerkDashboard] Error verifying role:', error);
        navigate('/login');
      } finally {
        setCheckingRole(false);
      }
    };

    verifyRole();
  }, [navigate]);

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
              onClick={() => {
                setActiveTab('dashboard');
                navigate('/clerk');
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => {
                setActiveTab('fee-collection');
                navigate('/clerk/fees');
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'fee-collection'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              }`}
            >
              💰 Fee Collection
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
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">Dashboard Overview</h2>
              
              {loadingStats ? (
                <div className="text-center py-8">Loading statistics...</div>
              ) : (
                <>
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-600 text-sm">Total Students</p>
                          <p className="text-3xl font-bold text-gray-900 mt-2">
                            {dashboardStats?.totalStudents || 0}
                          </p>
                        </div>
                        <div className="text-4xl">👥</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-600 text-sm">Today's Collection</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">
                            ₹{dashboardStats?.todayCollection?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="text-4xl">💰</div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-600 text-sm">Total Pending</p>
                          <p className="text-3xl font-bold text-red-600 mt-2">
                            ₹{dashboardStats?.totalPending?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                        <div className="text-4xl">📋</div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Payments */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-xl font-semibold mb-4">Recent Payments</h3>
                    {dashboardStats?.recentPayments?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {dashboardStats.recentPayments.slice(0, 10).map((payment: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm">
                                  {new Date(payment.payment_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                  ₹{parseFloat(payment.payment_amount || 0).toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-sm uppercase text-gray-600">
                                  {payment.payment_mode}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No recent payments</p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => {
                          setActiveTab('fee-collection');
                          navigate('/clerk/fees');
                        }}
                        className="p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition text-left"
                      >
                        <div className="font-semibold text-lg">💰 Collect Fees</div>
                        <div className="text-sm text-gray-600 mt-1">Record fee payments from students</div>
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('fee-collection');
                          navigate('/clerk/fees');
                        }}
                        className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition text-left"
                      >
                        <div className="font-semibold text-lg">📊 View Reports</div>
                        <div className="text-sm text-gray-600 mt-1">View payment history and analytics</div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === 'fee-collection' && <FeeCollection />}
        </div>
      </div>
    </div>
  );
}

