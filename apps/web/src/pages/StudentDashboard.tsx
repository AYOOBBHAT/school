import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface StudentProfile {
  id: string;
  roll_number: string;
  status: string;
  admission_date: string;
  class_groups?: {
    id: string;
    name: string;
    description: string;
  };
  sections?: {
    id: string;
    name: string;
  };
  profiles?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  created_at: string;
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendancePercentage: number;
}

interface Mark {
  exam: {
    id: string;
    name: string;
    term: string;
    start_date: string;
    end_date: string;
  };
  subjects: Array<{
    subject: {
      id: string;
      name: string;
      code: string;
    };
    marks_obtained: number;
    max_marks: number;
    percentage: string;
  }>;
  overallPercentage: string;
  total?: number;
  totalMax?: number;
  average?: number;
  grade?: string;
}

interface FeeStructure {
  id: string;
  name: string;
  amount: number;
  due_date: string;
  description: string;
  totalPaid: number;
  remaining: number;
  isPaid: boolean;
  isOverdue: boolean;
  payments: Array<{
    id: string;
    amount_paid: number;
    payment_date: string;
    payment_mode: string;
    transaction_id: string;
  }>;
}

interface FeeSummary {
  totalFees: number;
  totalPaid: number;
  totalRemaining: number;
  overdueFees: number;
  paidFees: number;
  totalFeeStructures: number;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'fees'>('overview');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [feeSummary, setFeeSummary] = useState<{
    totalAssigned: number;
    totalPaid: number;
    totalPending: number;
    transportFee: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendance();
    } else if (activeTab === 'marks') {
      loadMarks();
    } else if (activeTab === 'fees') {
      // Fees tab removed - billing feature disabled
    }
  }, [activeTab, profile]);

  const loadProfile = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        navigate('/login');
        return;
      }

      // First, check approval status via profile endpoint
      const profileResponse = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // All users are approved by default (principals add users directly)

      // Now try to load student profile
      const response = await fetch(`${API_URL}/students/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load profile' }));
        const errorMessage = errorData.error || 'Failed to load profile';
        
        if (response.status === 404) {
          // Student record not found - this might mean student record wasn't created properly
          console.error('[StudentDashboard] Student record not found:', errorMessage);
          setLoading(false);
          return;
        }
        
        console.error('[StudentDashboard] Error loading student profile:', {
          status: response.status,
          error: errorMessage
        });
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setProfile(data.student);
    } catch (error: any) {
      console.error('[StudentDashboard] Error loading profile:', error);
      // Don't redirect on error - just show error state
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('[StudentDashboard] No token available');
        return;
      }

      const response = await fetch(`${API_URL}/students/attendance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[StudentDashboard] Failed to load attendance:', errorData);
        throw new Error(errorData.error || 'Failed to load attendance');
      }

      const data = await response.json();
      console.log('[StudentDashboard] Attendance loaded:', {
        records: data.attendance?.length || 0,
        summary: data.summary
      });
      setAttendance(data.attendance || []);
      setAttendanceSummary(data.summary || null);
    } catch (error) {
      console.error('[StudentDashboard] Error loading attendance:', error);
      // Show user-friendly error message
      setAttendance([]);
      setAttendanceSummary(null);
    }
  };

  const loadMarks = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/students/marks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load marks');

      const data = await response.json();
      setMarks(data.marks || []);
    } catch (error) {
      console.error('Error loading marks:', error);
    }
  };

  const loadFees = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get student ID from profile
      if (!profile?.id) return;

      const [billsRes, paymentsRes] = await Promise.all([
        fetch(`${API_URL}/fees/bills?student_id=${profile.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/fees/payments?student_id=${profile.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Bills and payments removed - no longer loading
    } catch (error) {
      console.error('Error loading fees:', error);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Profile not found</div>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
              <p className="text-gray-600">
                {profile.profiles?.full_name || 'Student'}
                {profile.roll_number && ` • Roll No: ${profile.roll_number}`}
                {profile.class_groups && ` • ${profile.class_groups.name}`}
                {profile.sections && ` - ${profile.sections.name}`}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'attendance'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab('marks')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'marks'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Marks
            </button>
            {false && (
              <button
                onClick={() => setActiveTab('fees')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'fees'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Fees
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-2">Profile</h3>
                  <p className="text-gray-600">{profile.profiles?.full_name || 'N/A'}</p>
                  <p className="text-gray-600 text-sm">{profile.profiles?.email || 'N/A'}</p>
                  {profile.roll_number && (
                    <p className="text-gray-600 text-sm">Roll No: {profile.roll_number}</p>
                  )}
                  {profile.class_groups && (
                    <p className="text-gray-600 text-sm">Class: {profile.class_groups.name}</p>
                  )}
                  {profile.sections && (
                    <p className="text-gray-600 text-sm">Section: {profile.sections.name}</p>
                  )}
                </div>

                {/* Quick Stats */}
                {attendanceSummary && (
                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-2">Attendance</h3>
                    <p className="text-3xl font-bold text-green-600">
                      {attendanceSummary.attendancePercentage.toFixed(1)}%
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {attendanceSummary.presentDays} present / {attendanceSummary.totalDays} total
                    </p>
                  </div>
                )}

                {feeSummary && (
                  <div className="bg-purple-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-2">Fees</h3>
                    <p className="text-3xl font-bold text-purple-600">
                      ₹{feeSummary.totalPending.toLocaleString()}
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {feeSummary.totalPaid.toLocaleString()} / {feeSummary.totalAssigned.toLocaleString()} paid
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Attendance</h2>
              {attendanceSummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Days</p>
                    <p className="text-2xl font-bold">{attendanceSummary.totalDays}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Present</p>
                    <p className="text-2xl font-bold text-green-600">{attendanceSummary.presentDays}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Absent</p>
                    <p className="text-2xl font-bold text-red-600">{attendanceSummary.absentDays}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Percentage</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {attendanceSummary.attendancePercentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendance.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              record.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : record.status === 'late'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {attendance.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No attendance records yet.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'marks' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Marks & Grades</h2>
              {marks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-2">No verified marks available yet.</p>
                  <p className="text-sm text-gray-400">Marks will appear here once they are verified by the principal or clerk.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {marks.map((examMark, index) => {
                    // Calculate totals if not provided
                    const total = examMark.total ?? examMark.subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
                    const totalMax = examMark.totalMax ?? examMark.subjects.reduce((sum, s) => sum + s.max_marks, 0);
                    const average = examMark.average ?? (examMark.subjects.length > 0 ? total / examMark.subjects.length : 0);
                    const percentage = parseFloat(examMark.overallPercentage) || (totalMax > 0 ? (total / totalMax) * 100 : 0);
                    const grade = examMark.grade ?? (
                      percentage >= 90 ? 'A+' :
                      percentage >= 80 ? 'A' :
                      percentage >= 70 ? 'B+' :
                      percentage >= 60 ? 'B' :
                      percentage >= 50 ? 'C+' :
                      percentage >= 40 ? 'C' :
                      'F'
                    );

                    return (
                    <div key={index} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{examMark.exam.name}</h3>
                          <p className="text-gray-600">{examMark.exam.term}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(examMark.exam.start_date).toLocaleDateString()} - {new Date(examMark.exam.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <p className="text-xs text-gray-600">Total</p>
                              <p className="text-lg font-bold text-gray-900">
                                {total.toFixed(0)} / {totalMax.toFixed(0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Average</p>
                              <p className="text-lg font-bold text-gray-900">{average.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Percentage</p>
                              <p className="text-lg font-bold text-blue-600">{percentage.toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Grade</p>
                              <p className="text-lg font-bold text-green-600">{grade}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Subject
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Marks Obtained
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Max Marks
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Percentage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {examMark.subjects.map((subjectMark, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {subjectMark.subject.name}
                                  {subjectMark.subject.code && (
                                    <span className="text-gray-500"> ({subjectMark.subject.code})</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.marks_obtained}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.max_marks}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{subjectMark.percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Fees & Payments</h2>
              <div className="text-center py-12 text-gray-600">
                Billing has been removed from this deployment.
              </div>
              {false && (
                <>
                  {feeSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Assigned</p>
                        <p className="text-2xl font-bold">₹{feeSummary?.totalAssigned.toLocaleString() || '0'}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Total Paid</p>
                        <p className="text-2xl font-bold text-green-600">₹{feeSummary?.totalPaid.toLocaleString() || '0'}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Pending</p>
                        <p className="text-2xl font-bold text-red-600">₹{feeSummary?.totalPending.toLocaleString() || '0'}</p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600">Transport Fee</p>
                        <p className="text-2xl font-bold text-yellow-600">₹{feeSummary?.transportFee.toLocaleString() || '0'}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Bills - REMOVED */}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-4">Fee Bills</h3>
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      Fee bills have been removed from this deployment.
                    </div>
                  </div>

                  {/* Payment History Summary - REMOVED */}
                  <div className="mt-6">
                    <h3 className="text-xl font-bold mb-4">All Payments</h3>
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      Payment tracking has been removed from this deployment.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
      </div>
      </div>

      {/* Bill Detail Modal - REMOVED */}
    </div>
  );
}

