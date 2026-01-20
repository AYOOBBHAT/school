import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api.js';

interface School {
  id: string;
  name: string;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  registration_number?: string | null;
  join_code?: string | null;
  payment_status: 'paid' | 'unpaid';
  created_at: string;
  principal: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  total_students: number;
}

function Sidebar() {
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">Admin Panel</h1>
        <nav className="space-y-2">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="w-full text-left px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
          >
            📊 All Schools
          </button>
        </nav>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const verifyRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        const token = session.access_token;
        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch profile from backend to verify admin role
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('[AdminDashboard] Failed to fetch profile');
          navigate('/login');
          return;
        }

        const data = await response.json();
        const profile = data.profile;

        // Check if user is admin
        if (profile?.role !== 'admin') {
          console.warn('[AdminDashboard] User is not an admin, role:', profile?.role);
          // Redirect based on role
          const redirectMap: Record<string, string> = {
            principal: '/principal/dashboard',
            clerk: '/clerk/fees',
            teacher: '/teacher/classes',
            student: '/student/home',
            parent: '/parent',
          };
          const redirectPath = redirectMap[profile?.role] || '/login';
          navigate(redirectPath);
          return;
        }

        setCheckingRole(false);
        loadSchools();
      } catch (err) {
        console.error('Error verifying role:', err);
        navigate('/login');
      }
    };

    verifyRole();
  }, [navigate]);

  const loadSchools = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const token = session.access_token;
      const response = await fetch(`${API_URL}/admin/schools`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load schools');
      }

      const data = await response.json();
      setSchools(data.schools || []);
    } catch (err: any) {
      console.error('Error loading schools:', err);
      setError(err.message || 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (schoolId: string, newStatus: 'paid' | 'unpaid') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const token = session.access_token;
      const response = await fetch(`${API_URL}/admin/schools/${schoolId}/payment-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment_status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update payment status');
      }

      // Reload schools
      await loadSchools();
      alert('Payment status updated successfully');
    } catch (err: any) {
      console.error('Error updating payment status:', err);
      alert(err.message || 'Failed to update payment status');
    }
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
      <Sidebar />
      <div className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">All Schools</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading schools...</div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        School Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Principal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schools.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No schools found
                        </td>
                      </tr>
                    ) : (
                      schools.map((school) => (
                        <tr key={school.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{school.name}</div>
                            {school.registration_number && (
                              <div className="text-sm text-gray-500">
                                Reg: {school.registration_number}
                              </div>
                            )}
                            {school.join_code && (
                              <div className="text-sm text-gray-500">
                                Code: {school.join_code}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {school.principal ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {school.principal.name}
                                </div>
                                <div className="text-sm text-gray-500">{school.principal.email}</div>
                                {school.principal.phone && (
                                  <div className="text-sm text-gray-500">{school.principal.phone}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">No principal found</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {school.total_students}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                school.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {school.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {school.contact_email && (
                              <div>{school.contact_email}</div>
                            )}
                            {school.contact_phone && (
                              <div>{school.contact_phone}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() =>
                                updatePaymentStatus(
                                  school.id,
                                  school.payment_status === 'paid' ? 'unpaid' : 'paid'
                                )
                              }
                              className={`mr-2 px-3 py-1 rounded ${
                                school.payment_status === 'paid'
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {school.payment_status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && schools.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              Total Schools: {schools.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

