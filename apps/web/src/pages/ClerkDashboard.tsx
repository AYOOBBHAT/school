import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { FeeManagement } from './PrincipalDashboard';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

import { API_URL } from '../utils/api.js';

interface ClassGroup {
  id: string;
  name: string;
  description?: string | null;
}


interface PendingMark {
  id: string;
  marks_obtained: number;
  max_marks: number;
  exams: {
    id: string;
    name: string;
    term: string | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
  subjects: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  students: {
    id: string;
    roll_number: string | null;
    profile: {
      id: string;
      full_name: string;
      email: string | null;
    } | null;
  } | null;
}

const tabRouteMap = {
  overview: '/clerk',
  fees: '/clerk/fees',
  marks: '/clerk/marks'
} as const;

type ClerkTab = keyof typeof tabRouteMap;

export default function ClerkDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [activeTab, setActiveTab] = useState<ClerkTab>('overview');
  const [loadingData, setLoadingData] = useState(true);

  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [pendingMarks, setPendingMarks] = useState<PendingMark[]>([]);

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

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith(tabRouteMap.fees)) {
      setActiveTab('fees');
    } else if (path.startsWith(tabRouteMap.marks)) {
      setActiveTab('marks');
    } else {
      setActiveTab('overview');
    }
  }, [location.pathname]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      await Promise.all([loadClasses(), loadPendingMarks()]);
    } catch (error) {
      console.error('[ClerkDashboard] Failed to load initial data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const getToken = async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token;
  };

  const loadClasses = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load classes');
      const data = await response.json();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('[ClerkDashboard] Error loading classes:', error);
    }
  };



  const loadPendingMarks = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/marks/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load pending marks');
      const data = await response.json();
      setPendingMarks(data.marks || []);
    } catch (error) {
      console.error('[ClerkDashboard] Error loading pending marks:', error);
    }
  };


  const handleVerifyMark = async (markId: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/marks/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ marks_id: markId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to verify mark');
      }

      setPendingMarks((prev) => prev.filter((mark) => mark.id !== markId));
      alert('Mark verified successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to verify mark');
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
              onClick={() => {
                setActiveTab('overview');
                navigate(tabRouteMap.overview, { replace: true });
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'overview' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => {
                setActiveTab('fees');
                navigate(tabRouteMap.fees, { replace: true });
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'fees' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              💰 Fee Management
            </button>
            <button
              onClick={() => {
                setActiveTab('marks');
                navigate(tabRouteMap.marks, { replace: true });
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              ✅ Verify Marks
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
          {loadingData ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              Loading dashboard data...
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">Clerk Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Total Classes</h3>
                      <p className="text-3xl font-bold text-blue-600">{classes.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Active classes</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pending Marks</h3>
                      <p className="text-3xl font-bold text-orange-500">{pendingMarks.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Marks waiting for verification</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Fee Management</h3>
                      <p className="text-3xl font-bold text-blue-600">—</p>
                      <p className="text-sm text-gray-500 mt-1">View in Fee Management tab</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Classes</h3>
                      {classes.length === 0 ? (
                        <div className="text-gray-500 py-6 text-center">No classes available.</div>
                      ) : (
                        <div className="space-y-4">
                          {classes.map((cls) => (
                            <div key={cls.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-900">{cls.name}</p>
                                {cls.description && (
                                  <p className="text-sm text-gray-500">{cls.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            setActiveTab('fees');
                            navigate(tabRouteMap.fees, { replace: true });
                          }}
                          className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          <div className="font-medium text-blue-900">💰 Manage Fees</div>
                          <div className="text-sm text-blue-700">Generate bills & record payments</div>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('marks');
                            navigate(tabRouteMap.marks, { replace: true });
                          }}
                          className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition"
                        >
                          <div className="font-medium text-green-900">✅ Verify Marks</div>
                          <div className="text-sm text-green-700">
                            {pendingMarks.length} marks pending verification
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fees' && (
                <FeeManagement userRole="clerk" />
              )}


              {activeTab === 'marks' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">Verify Marks</h2>
                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Exam
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Marks
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingMarks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                              All marks are verified. Great job!
                            </td>
                          </tr>
                        ) : (
                          pendingMarks.map((mark) => (
                            <tr key={mark.id}>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {mark.students?.profile?.full_name || 'Student'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {mark.students?.roll_number ? `Roll ${mark.students?.roll_number}` : ''}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                <div className="font-medium">{mark.exams?.name || 'Exam'}</div>
                                <div className="text-xs text-gray-500">
                                  {mark.exams?.term || ''}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {mark.subjects?.name || 'Subject'}
                                {mark.subjects?.code && (
                                  <span className="text-xs text-gray-500"> ({mark.subjects.code})</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                                {mark.marks_obtained} / {mark.max_marks}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => handleVerifyMark(mark.id)}
                                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                                >
                                  Verify
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
            </>
          )}
        </div>
      </div>

    </div>
  );
}

