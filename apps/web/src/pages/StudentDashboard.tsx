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
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedBill, setSelectedBill] = useState<any>(null);
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
      if (profile?.id) {
      loadFees();
    }
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

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        const approvalStatus = profileData.profile?.approval_status;
        const role = profileData.profile?.role;

        console.log('[StudentDashboard] Profile check:', { role, approval_status: approvalStatus });

        // If not approved, redirect to pending approval
        if (approvalStatus !== 'approved' && role !== 'principal') {
          console.log('[StudentDashboard] Student not approved, redirecting to pending approval');
          navigate('/pending-approval');
          return;
        }
      }

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
          // Student record not found - but profile is approved
          // This might mean student record wasn't created properly
          console.error('[StudentDashboard] Student record not found but profile is approved:', errorMessage);
          // Don't redirect to pending-approval if already approved
          // Just show an error message
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

      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData.bills || []);
        
        // Calculate summary
        const totalAssigned = (billsData.bills || []).reduce((sum: number, b: any) => sum + parseFloat(b.net_amount || 0), 0);
        const totalPaid = (billsData.bills || []).reduce((sum: number, b: any) => sum + parseFloat(b.total_paid || 0), 0);
        const totalPending = (billsData.bills || []).reduce((sum: number, b: any) => sum + parseFloat(b.balance || 0), 0);
        const transportFee = (billsData.bills || []).reduce((sum: number, b: any) => sum + parseFloat(b.transport_fee_total || 0), 0);
        
        setFeeSummary({
          totalAssigned,
          totalPaid,
          totalPending,
          transportFee
        });
      }

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
    } catch (error) {
      console.error('Error loading fees:', error);
    }
  };

  const viewBill = async (billId: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/fees/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
      const data = await response.json();
        setSelectedBill(data.bill);
      }
    } catch (error) {
      console.error('Error loading bill details:', error);
    }
  };

  const downloadInvoice = (bill: any) => {
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${bill.bill_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .student-info, .bill-info { width: 48%; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .summary { float: right; width: 300px; margin-top: 20px; }
          .summary div { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FEE INVOICE</h1>
          <h2>Bill Number: ${bill.bill_number}</h2>
        </div>
        <div class="invoice-details">
          <div class="student-info">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${bill.students?.profile?.full_name || '-'}</p>
            <p><strong>Roll Number:</strong> ${bill.students?.roll_number || '-'}</p>
            <p><strong>Class:</strong> ${bill.students?.class_groups?.name || '-'}</p>
          </div>
          <div class="bill-info">
            <h3>Bill Information</h3>
            <p><strong>Bill Date:</strong> ${new Date(bill.bill_date).toLocaleDateString()}</p>
            <p><strong>Period:</strong> ${new Date(bill.bill_period_start).toLocaleDateString()} - ${new Date(bill.bill_period_end).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(bill.due_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${bill.status}</p>
          </div>
        </div>
        <h3>Bill Items</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(bill.items || []).map((item: any) => `
              <tr>
                <td>${item.item_name}</td>
                <td class="text-right">${item.amount < 0 ? '-' : ''}₹${Math.abs(parseFloat(item.amount || 0)).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="summary">
          <div><span>Class Fees:</span><span>₹${parseFloat(bill.class_fees_total || 0).toLocaleString()}</span></div>
          ${bill.transport_fee_total > 0 ? `<div><span>Transport Fee:</span><span>₹${parseFloat(bill.transport_fee_total || 0).toLocaleString()}</span></div>` : ''}
          ${bill.optional_fees_total > 0 ? `<div><span>Optional Fees:</span><span>₹${parseFloat(bill.optional_fees_total || 0).toLocaleString()}</span></div>` : ''}
          ${bill.custom_fees_total !== 0 ? `<div><span>Custom Fees:</span><span>${bill.custom_fees_total < 0 ? '-' : '+'}₹${Math.abs(parseFloat(bill.custom_fees_total || 0)).toLocaleString()}</span></div>` : ''}
          ${bill.fine_total > 0 ? `<div><span>Fine:</span><span>₹${parseFloat(bill.fine_total || 0).toLocaleString()}</span></div>` : ''}
          <div class="total-row"><span>Gross Amount:</span><span>₹${parseFloat(bill.gross_amount || 0).toLocaleString()}</span></div>
          ${bill.discount_amount > 0 ? `<div><span>Discount:</span><span>-₹${parseFloat(bill.discount_amount || 0).toLocaleString()}</span></div>` : ''}
          ${bill.scholarship_amount > 0 ? `<div><span>Scholarship:</span><span>-₹${parseFloat(bill.scholarship_amount || 0).toLocaleString()}</span></div>` : ''}
          <div class="total-row" style="font-size: 1.2em; border-top: 2px solid #000; padding-top: 10px;">
            <span>Net Amount:</span><span>₹${parseFloat(bill.net_amount || 0).toLocaleString()}</span>
          </div>
          <div><span>Paid:</span><span>₹${parseFloat(bill.total_paid || 0).toLocaleString()}</span></div>
          <div class="total-row" style="border-top: 2px solid #000; padding-top: 10px;">
            <span>Balance:</span><span>₹${parseFloat(bill.balance || 0).toLocaleString()}</span>
          </div>
        </div>
        ${bill.payments && bill.payments.length > 0 ? `
          <h3 style="clear: both; margin-top: 50px;">Payment History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment Number</th>
                <th>Amount</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${bill.payments.map((payment: any) => `
                <tr>
                  <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td>${payment.payment_number}</td>
                  <td>₹${parseFloat(payment.amount_paid || 0).toLocaleString()}</td>
                  <td>${payment.payment_mode}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
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
                  {marks.map((examMark, index) => (
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
                                {examMark.total} / {examMark.totalMax}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Average</p>
                              <p className="text-lg font-bold text-gray-900">{examMark.average}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Percentage</p>
                              <p className="text-lg font-bold text-blue-600">{examMark.overallPercentage}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600">Grade</p>
                              <p className="text-lg font-bold text-green-600">{examMark.grade}</p>
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
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'fees' && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Fees & Payments</h2>
              {feeSummary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Assigned</p>
                    <p className="text-2xl font-bold">₹{feeSummary.totalAssigned.toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Paid</p>
                    <p className="text-2xl font-bold text-green-600">₹{feeSummary.totalPaid.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-red-600">₹{feeSummary.totalPending.toLocaleString()}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Transport Fee</p>
                    <p className="text-2xl font-bold text-yellow-600">₹{feeSummary.transportFee.toLocaleString()}</p>
                  </div>
                </div>
              )}
              
              {/* Bills */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4">Fee Bills</h3>
                {bills.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    No bills found.
                  </div>
                ) : (
              <div className="space-y-4">
                      {bills.map((bill: any) => (
                  <div
                          key={bill.id}
                    className={`border rounded-lg p-6 ${
                            bill.status === 'overdue' ? 'border-red-300 bg-red-50' :
                            bill.status === 'paid' ? 'border-green-300 bg-green-50' :
                            bill.status === 'partially-paid' ? 'border-yellow-300 bg-yellow-50' :
                            'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                              <h3 className="text-xl font-bold">Bill: {bill.bill_number}</h3>
                              <p className="text-gray-600">Period: {new Date(bill.bill_period_start).toLocaleDateString()} - {new Date(bill.bill_period_end).toLocaleDateString()}</p>
                              <p className="text-gray-600 text-sm mt-1">
                                Due Date: {new Date(bill.due_date).toLocaleDateString()}
                          </p>
                              <p className="text-gray-600 text-sm mt-2">
                                Net Amount: ₹{parseFloat(bill.net_amount || 0).toLocaleString()}
                              </p>
                              {bill.transport_fee_total > 0 && (
                                <p className="text-gray-600 text-sm">Transport Fee: ₹{parseFloat(bill.transport_fee_total || 0).toLocaleString()}</p>
                              )}
                              {bill.discount_amount > 0 && (
                                <p className="text-green-600 text-sm">Discount: -₹{parseFloat(bill.discount_amount || 0).toLocaleString()}</p>
                              )}
                              {bill.scholarship_amount > 0 && (
                                <p className="text-green-600 text-sm">Scholarship: -₹{parseFloat(bill.scholarship_amount || 0).toLocaleString()}</p>
                              )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                                  bill.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                                    : bill.status === 'overdue'
                              ? 'bg-red-100 text-red-800'
                                    : bill.status === 'partially-paid'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                                {bill.status || 'Pending'}
                        </span>
                        <p className="text-sm text-gray-600 mt-2">
                                Paid: ₹{parseFloat(bill.total_paid || 0).toLocaleString()} / ₹{parseFloat(bill.net_amount || 0).toLocaleString()}
                        </p>
                              {bill.balance > 0 && (
                                <p className="text-sm text-red-600 mt-1 font-semibold">
                                  Balance: ₹{parseFloat(bill.balance || 0).toLocaleString()}
                                </p>
                        )}
                      </div>
                    </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => viewBill(bill.id)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => downloadInvoice(bill)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                              Download/Print
                            </button>
                            {bill.balance > 0 && (
                              <button
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                                onClick={() => alert('Online payment integration coming soon!')}
                              >
                                Pay Online
                              </button>
                            )}
                          </div>
                          {bill.payments && bill.payments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Payment History</h4>
                        <div className="space-y-2">
                                {bill.payments.map((payment: any) => (
                            <div key={payment.id} className="bg-white rounded p-3 text-sm">
                              <div className="flex justify-between">
                                <span>
                                        ₹{parseFloat(payment.amount_paid || 0).toLocaleString()} on{' '}
                                  {new Date(payment.payment_date).toLocaleDateString()}
                                </span>
                                <span className="text-gray-600">{payment.payment_mode}</span>
                              </div>
                              {payment.transaction_id && (
                                <p className="text-gray-500 text-xs mt-1">Txn ID: {payment.transaction_id}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                    </div>
                  )}
              </div>

              {/* Payment History Summary */}
              {payments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold mb-4">All Payments</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Number</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map((payment: any) => (
                          <tr key={payment.id}>
                            <td className="px-6 py-4">{new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-medium">{payment.payment_number}</td>
                            <td className="px-6 py-4 text-right font-semibold">₹{parseFloat(payment.amount_paid || 0).toLocaleString()}</td>
                            <td className="px-6 py-4">{payment.payment_mode}</td>
                            <td className="px-6 py-4">{payment.fee_bills?.bill_number || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              </div>
            </div>
          )}
        </div>
          )}
      </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Bill Details</h3>
              <button
                onClick={() => setSelectedBill(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Bill Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Bill Number</p>
                    <p className="font-semibold">{selectedBill.bill_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Period</p>
                    <p className="font-semibold">
                      {new Date(selectedBill.bill_period_start).toLocaleDateString()} - {new Date(selectedBill.bill_period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="font-semibold">{new Date(selectedBill.due_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      selectedBill.status === 'paid' ? 'bg-green-100 text-green-800' :
                      selectedBill.status === 'partially-paid' ? 'bg-yellow-100 text-yellow-800' :
                      selectedBill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedBill.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bill Items */}
              <div>
                <h4 className="text-lg font-bold mb-3">Bill Items</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedBill.items && selectedBill.items.length > 0 ? (
                        selectedBill.items.map((item: any, index: number) => (
                          <tr key={index}>
                            <td className="px-6 py-4">{item.item_name}</td>
                            <td className={`px-6 py-4 text-right font-semibold ${
                              item.amount < 0 ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {item.amount < 0 ? '-' : ''}₹{Math.abs(parseFloat(item.amount || 0)).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                            No items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Class Fees:</span>
                    <span className="font-semibold">₹{parseFloat(selectedBill.class_fees_total || 0).toLocaleString()}</span>
                  </div>
                  {selectedBill.transport_fee_total > 0 && (
                    <div className="flex justify-between">
                      <span>Transport Fee:</span>
                      <span className="font-semibold">₹{parseFloat(selectedBill.transport_fee_total || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedBill.optional_fees_total > 0 && (
                    <div className="flex justify-between">
                      <span>Optional Fees:</span>
                      <span className="font-semibold">₹{parseFloat(selectedBill.optional_fees_total || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedBill.custom_fees_total !== 0 && (
                    <div className="flex justify-between">
                      <span>Custom Fees:</span>
                      <span className={`font-semibold ${selectedBill.custom_fees_total < 0 ? 'text-green-600' : ''}`}>
                        {selectedBill.custom_fees_total < 0 ? '-' : '+'}₹{Math.abs(parseFloat(selectedBill.custom_fees_total || 0)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedBill.fine_total > 0 && (
                    <div className="flex justify-between">
                      <span>Fine:</span>
                      <span className="font-semibold text-red-600">+₹{parseFloat(selectedBill.fine_total || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between">
                    <span className="font-semibold">Gross Amount:</span>
                    <span className="font-semibold">₹{parseFloat(selectedBill.gross_amount || 0).toLocaleString()}</span>
                  </div>
                  {selectedBill.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-₹{parseFloat(selectedBill.discount_amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedBill.scholarship_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Scholarship:</span>
                      <span className="font-semibold">-₹{parseFloat(selectedBill.scholarship_amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t-2 border-gray-400 pt-2 flex justify-between text-lg">
                    <span className="font-bold">Net Amount:</span>
                    <span className="font-bold">₹{parseFloat(selectedBill.net_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid:</span>
                    <span className="font-semibold">₹{parseFloat(selectedBill.total_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 flex justify-between text-lg">
                    <span className="font-bold">Balance:</span>
                    <span className={`font-bold ${parseFloat(selectedBill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{parseFloat(selectedBill.balance || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payments History */}
              {selectedBill.payments && selectedBill.payments.length > 0 && (
                <div>
                  <h4 className="text-lg font-bold mb-3">Payment History</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Number</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedBill.payments.map((payment: any) => (
                          <tr key={payment.id}>
                            <td className="px-6 py-4">{new Date(payment.payment_date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 font-medium">{payment.payment_number}</td>
                            <td className="px-6 py-4 text-right font-semibold">₹{parseFloat(payment.amount_paid || 0).toLocaleString()}</td>
                            <td className="px-6 py-4">{payment.payment_mode}</td>
                            <td className="px-6 py-4">{payment.transaction_id || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => downloadInvoice(selectedBill)}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Download/Print Invoice
                </button>
                {selectedBill.balance > 0 && (
                  <button
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                    onClick={() => alert('Online payment integration coming soon!')}
                  >
                    Pay Online
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

