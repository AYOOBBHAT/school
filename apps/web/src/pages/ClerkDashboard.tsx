import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import FeeCollection from '../components/FeeCollection.js';
import UnpaidFeeAnalytics from '../components/UnpaidFeeAnalytics';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fee-collection' | 'salary-payment'>('dashboard');
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Sync activeTab with URL path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/clerk/fees') || path.includes('/clerk/payments')) {
      setActiveTab('fee-collection');
    } else if (path.includes('/clerk/salary')) {
      setActiveTab('salary-payment');
    } else if (path === '/clerk' || path === '/clerk/') {
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
            <button
              onClick={() => {
                setActiveTab('salary-payment');
                navigate('/clerk/salary');
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'salary-payment'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-800 text-gray-300'
              }`}
            >
              💵 Pay Salary
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

                  {/* Unpaid Fee Analytics */}
                  <UnpaidFeeAnalytics
                    userRole="clerk"
                    onCollectFee={(studentId) => {
                      // Navigate to fee collection with student pre-selected
                      setActiveTab('fee-collection');
                      navigate(`/clerk/fees?student=${studentId}`);
                    }}
                  />

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
          
          {activeTab === 'salary-payment' && <SalaryPaymentSection />}
        </div>
      </div>
    </div>
  );
}

// Salary Payment Section - Clerk can record payments directly (simplified system)
function SalaryPaymentSection() {
  const [teacherSummaries, setTeacherSummaries] = useState<any[]>([]);
  const [unpaidTeachers, setUnpaidTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'bank' as 'bank' | 'cash' | 'upi',
    payment_proof: '',
    notes: ''
  });

  useEffect(() => {
    loadUnpaidSalaries();
  }, []);

  const loadUnpaidSalaries = async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      // Load unpaid salaries with month-wise breakdown
      const unpaidResponse = await fetch(`${API_URL}/salary/unpaid?time_scope=last_12_months`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (unpaidResponse.ok) {
        const unpaidData = await unpaidResponse.json();
        setUnpaidTeachers(unpaidData.teachers || []);
      } else {
        console.error('Error loading unpaid salaries:', await unpaidResponse.json().catch(() => ({})));
      }

      // Also load summary for backward compatibility
      const summaryResponse = await fetch(`${API_URL}/salary/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        const summariesWithPending = (summaryData.summaries || []).filter((s: any) => s.pending_salary > 0);
        setTeacherSummaries(summariesWithPending);
      } else {
        const errorData = await summaryResponse.json().catch(() => ({ error: 'Failed to load salary summaries' }));
        console.error('Error loading salary summaries:', errorData);
        setTeacherSummaries([]);
      }
    } catch (error) {
      console.error('Error loading salary data:', error);
      setUnpaidTeachers([]);
      setTeacherSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleTeacherExpansion = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    // Validate amount
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    // Check if amount exceeds pending salary
    if (amount > selectedTeacher.pending_salary) {
      if (!confirm(`Payment amount (₹${amount.toLocaleString()}) exceeds pending salary (₹${selectedTeacher.pending_salary.toLocaleString()}). This will be recorded as an advance payment. Continue?`)) {
        return;
      }
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/salary/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teacher_id: selectedTeacher.teacher.id,
          payment_date: paymentForm.payment_date,
          amount: amount,
          payment_mode: paymentForm.payment_mode,
          payment_proof: paymentForm.payment_proof || null,
          notes: paymentForm.notes || null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      alert('Payment recorded successfully!');
      setShowPaymentModal(false);
      setSelectedTeacher(null);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_mode: 'bank',
        payment_proof: '',
        notes: ''
      });
      loadUnpaidSalaries();
    } catch (error: any) {
      alert(error.message || 'Failed to record payment');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="text-center py-8">Loading teacher salary information...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Pay Salary</h2>
          <p className="text-gray-600 mt-2">
            Record salary payments directly. You can pay full, partial, or advance payments to teachers.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unpaid Months</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Unpaid</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unpaidTeachers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No teachers with pending salary. All teachers are up to date with their payments.
                </td>
              </tr>
            ) : (
              unpaidTeachers.map((teacher: any) => {
                const isExpanded = expandedTeachers.has(teacher.teacher_id);
                // Find matching summary for total due/paid info
                const summary = teacherSummaries.find((s: any) => s.teacher?.id === teacher.teacher_id);
                
                return (
                  <>
                    <tr key={teacher.teacher_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        {teacher.unpaid_months_count > 0 && (
                          <button
                            onClick={() => toggleTeacherExpansion(teacher.teacher_id)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isExpanded ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium">{teacher.teacher_name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{teacher.teacher_email || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {teacher.unpaid_months_count} {teacher.unpaid_months_count === 1 ? 'month' : 'months'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-orange-600">
                        ₹{teacher.total_unpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedTeacher({
                              teacher: { id: teacher.teacher_id, full_name: teacher.teacher_name, email: teacher.teacher_email },
                              total_salary_due: summary?.total_salary_due || 0,
                              total_salary_paid: summary?.total_salary_paid || 0,
                              pending_salary: teacher.total_unpaid_amount
                            });
                            setPaymentForm({
                              payment_date: new Date().toISOString().split('T')[0],
                              amount: teacher.total_unpaid_amount.toFixed(2),
                              payment_mode: 'bank',
                              payment_proof: '',
                              notes: ''
                            });
                            setShowPaymentModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Record Payment
                        </button>
                      </td>
                    </tr>
                    {isExpanded && teacher.unpaid_months && teacher.unpaid_months.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="ml-8">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Breakdown:</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Month</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Days Overdue</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {teacher.unpaid_months.map((month: any, idx: number) => (
                                    <tr key={`${month.year}-${month.month}-${idx}`}>
                                      <td className="px-4 py-2 text-sm font-medium">{month.period_label}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                          month.payment_status === 'paid'
                                            ? 'bg-green-100 text-green-800'
                                            : month.payment_status === 'partially-paid'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-orange-100 text-orange-800'
                                        }`}>
                                          {month.payment_status === 'paid' ? 'Paid' : 
                                           month.payment_status === 'partially-paid' ? 'Partially Paid' : 
                                           'Unpaid'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        <div className="font-semibold">₹{month.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        {month.paid_amount > 0 && (
                                          <div className="text-xs text-green-600">Paid: ₹{month.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        )}
                                        {month.pending_amount > 0 && (
                                          <div className="text-xs text-orange-600">Pending: ₹{month.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        {month.days_since_period_start > 0 ? (
                                          <span className="text-red-600 font-medium">{month.days_since_period_start} days</span>
                                        ) : (
                                          <span className="text-gray-500">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-500">
                                        {month.payment_date && (
                                          <span>Last payment: {new Date(month.payment_date).toLocaleDateString()}</span>
                                        )}
                                        {!month.payment_date && month.payment_status === 'unpaid' && (
                                          <span className="text-orange-600">No payment recorded</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Record Salary Payment</h3>
            <p className="text-sm text-gray-600 mb-2">
              Teacher: <strong>{selectedTeacher.teacher?.full_name}</strong>
            </p>
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Total Due:</span>
                <span className="font-semibold">₹{selectedTeacher.total_salary_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Total Paid:</span>
                <span className="text-green-600">₹{selectedTeacher.total_salary_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Pending:</span>
                <span className="text-orange-600">₹{selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter payment amount"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can pay full, partial, or advance amounts. Pending: ₹{selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode *</label>
                <select
                  required
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Proof (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.payment_proof}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_proof: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="URL or file path to payment proof"
                />
                <p className="text-xs text-gray-500 mt-1">Upload proof document and paste URL here, or leave empty</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Additional notes about this payment"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedTeacher(null);
                    setPaymentForm({
                      payment_date: new Date().toISOString().split('T')[0],
                      amount: '',
                      payment_mode: 'bank',
                      payment_proof: '',
                      notes: ''
                    });
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

