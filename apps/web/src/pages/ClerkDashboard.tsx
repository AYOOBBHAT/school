import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface ClassGroup {
  id: string;
  name: string;
  description?: string | null;
}

interface FeeStructure {
  id: string;
  class_group_id: string;
  name: string;
  amount: number;
  due_date?: string | null;
  description?: string | null;
  created_at?: string;
  class_groups?: {
    id: string;
    name: string;
  } | null;
}

interface Student {
  id: string;
  roll_number: string | null;
  profile: {
    id: string;
    full_name: string;
    email?: string;
  };
}

interface PaymentReportEntry {
  id: string;
  amount_paid: number;
  payment_date: string;
  payment_mode: 'cash' | 'online' | 'upi' | 'card';
  transaction_id?: string | null;
  student_id: string;
  fee_structure_id: string;
  fee_structures: {
    id: string;
    name: string;
    amount: number;
  };
  students: {
    id: string;
    roll_number: string | null;
    profile: {
      id: string;
      full_name: string;
    };
  } | null;
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
  payments: '/clerk/payments',
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
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [payments, setPayments] = useState<PaymentReportEntry[]>([]);
  const [pendingMarks, setPendingMarks] = useState<PendingMark[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Fee form state
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({
    class_group_id: '',
    name: '',
    amount: '',
    due_date: '',
    description: ''
  });
  const [creatingFee, setCreatingFee] = useState(false);

  // Payment form state
  const [paymentClassId, setPaymentClassId] = useState('');
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentFeeId, setPaymentFeeId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'upi' | 'card'>('cash');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

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
    } else if (path.startsWith(tabRouteMap.payments)) {
      setActiveTab('payments');
    } else if (path.startsWith(tabRouteMap.marks)) {
      setActiveTab('marks');
    } else {
      setActiveTab('overview');
    }
  }, [location.pathname]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      await Promise.all([loadClasses(), loadFees(), loadPayments(), loadPendingMarks()]);
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

  const loadFees = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/fees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load fees');
      const data = await response.json();
      setFees(data.fees || []);
    } catch (error) {
      console.error('[ClerkDashboard] Error loading fees:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/payments/report`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load payments report');
      const data = await response.json();
      setPayments(data.report || []);
    } catch (error) {
      console.error('[ClerkDashboard] Error loading payments:', error);
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

  const loadStudentsForClass = async (classId: string) => {
    try {
      const token = await getToken();
      if (!token || !classId) {
        setStudents([]);
        return;
      }
      const response = await fetch(`${API_URL}/students-admin?class_group_id=${classId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load students');
      const data = await response.json();
      const allStudents: Student[] = [];
      if (data.classes) {
        data.classes.forEach((cls: any) => {
          if (cls.id === classId) {
            cls.students.forEach((student: Student) => {
              allStudents.push(student);
            });
          }
        });
      }
      setStudents(allStudents);
    } catch (error) {
      console.error('[ClerkDashboard] Error loading students:', error);
      setStudents([]);
    }
  };

  useEffect(() => {
    if (paymentClassId) {
      loadStudentsForClass(paymentClassId);
    } else {
      setStudents([]);
      setPaymentStudentId('');
      setPaymentFeeId('');
    }
  }, [paymentClassId]);

  useEffect(() => {
    if (!paymentFeeId) {
      setPaymentAmount('');
      return;
    }
    const selectedFee = fees.find((f) => f.id === paymentFeeId);
    if (!selectedFee) {
      setPaymentAmount('');
      return;
    }

    if (!paymentStudentId) {
      setPaymentAmount(selectedFee.amount.toString());
      return;
    }

    const paid = calculatePaidAmount(paymentStudentId, paymentFeeId);
    const remaining = Math.max(0, selectedFee.amount - paid);
    setPaymentAmount((remaining || selectedFee.amount).toString());
  }, [paymentFeeId, paymentStudentId, fees, payments]);

  const calculatePaidAmount = (studentId: string, feeId: string) => {
    return payments
      .filter((payment) => payment.student_id === studentId && payment.fee_structure_id === feeId)
      .reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
  };

  const handleCreateFee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!feeForm.class_group_id || !feeForm.name || !feeForm.amount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setCreatingFee(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/fees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          class_group_id: feeForm.class_group_id,
          name: feeForm.name,
          amount: parseFloat(feeForm.amount),
          due_date: feeForm.due_date || null,
          description: feeForm.description || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create fee');
      }

      setFeeForm({
        class_group_id: '',
        name: '',
        amount: '',
        due_date: '',
        description: ''
      });
      setIsFeeModalOpen(false);
      await loadFees();
      alert('Fee structure created successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to create fee');
    } finally {
      setCreatingFee(false);
    }
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!paymentClassId || !paymentStudentId || !paymentFeeId || !paymentAmount) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setRecordingPayment(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: paymentStudentId,
          fee_structure_id: paymentFeeId,
          amount_paid: parseFloat(paymentAmount),
          payment_mode: paymentMode,
          transaction_id: paymentTransactionId || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      setPaymentStudentId('');
      setPaymentFeeId('');
      setPaymentAmount('');
      setPaymentMode('cash');
      setPaymentTransactionId('');
      await loadPayments();
      alert('Payment recorded successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
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

  const filteredFeesForPayment = useMemo(() => {
    if (!paymentClassId) return [];
    return fees.filter((fee) => fee.class_group_id === paymentClassId);
  }, [fees, paymentClassId]);

  const recentPayments = useMemo(() => {
    return payments.slice(0, 5);
  }, [payments]);

  const totalCollected = useMemo(() => {
    return payments.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
  }, [payments]);

  const feeTotalsByClass = useMemo(() => {
    const map = new Map<string, number>();
    fees.forEach((fee) => {
      const current = map.get(fee.class_group_id) || 0;
      map.set(fee.class_group_id, current + (fee.amount || 0));
    });
    return map;
  }, [fees]);

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
          <h1 className="text-2xl font-bold mb-8">SchoolSaaS</h1>
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
              💰 Fee Structures
            </button>
            <button
              onClick={() => {
                setActiveTab('payments');
                navigate(tabRouteMap.payments, { replace: true });
              }}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                activeTab === 'payments' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              🧾 Payments
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
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Total Fee Structures</h3>
                      <p className="text-3xl font-bold text-blue-600">{fees.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Across {classes.length} classes</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Payments Recorded</h3>
                      <p className="text-3xl font-bold text-green-600">{payments.length}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Total Collected: ₹{totalCollected.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pending Marks</h3>
                      <p className="text-3xl font-bold text-orange-500">{pendingMarks.length}</p>
                      <p className="text-sm text-gray-500 mt-1">Marks waiting for verification</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Fee Amounts by Class</h3>
                      {classes.length === 0 ? (
                        <div className="text-gray-500 py-6 text-center">No classes available.</div>
                      ) : (
                        <div className="space-y-4">
                          {classes.map((cls) => (
                            <div key={cls.id} className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900">{cls.name}</p>
                                <p className="text-sm text-gray-500">
                                  Fee Structures:{' '}
                                  {fees.filter((fee) => fee.class_group_id === cls.id).length}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-blue-600">
                                  ₹{(feeTotalsByClass.get(cls.id) || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Recent Payments</h3>
                      {recentPayments.length === 0 ? (
                        <div className="text-gray-500 py-6 text-center">No payments recorded yet.</div>
                      ) : (
                        <div className="space-y-4">
                          {recentPayments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-none">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {payment.students?.profile?.full_name || 'Unknown Student'}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {payment.fee_structures?.name} • {new Date(payment.payment_date).toLocaleString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-green-600">
                                  ₹{payment.amount_paid.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 uppercase">{payment.payment_mode}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fees' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Fee Structures</h2>
                    <button
                      onClick={() => setIsFeeModalOpen(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      + Create Fee Structure
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fee Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Class
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {fees.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-6 text-center text-gray-500">
                              No fee structures created yet.
                            </td>
                          </tr>
                        ) : (
                          fees.map((fee) => (
                            <tr key={fee.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{fee.name}</div>
                                {fee.created_at && (
                                  <div className="text-xs text-gray-500">
                                    Created on {new Date(fee.created_at).toLocaleDateString()}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {fee.class_groups?.name ||
                                  classes.find((cls) => cls.id === fee.class_group_id)?.name ||
                                  'Class'}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                                ₹{fee.amount.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {fee.description || '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'payments' && (
                <div>
                  <h2 className="text-3xl font-bold mb-6">Payments</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Record Payment</h3>
                      <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                          <select
                            value={paymentClassId}
                            onChange={(event) => {
                              setPaymentClassId(event.target.value);
                              setPaymentStudentId('');
                              setPaymentFeeId('');
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          >
                            <option value="">Select Class</option>
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Student *</label>
                          <select
                            value={paymentStudentId}
                            onChange={(event) => setPaymentStudentId(event.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                            disabled={!paymentClassId}
                          >
                            <option value="">Select Student</option>
                            {students.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.profile.full_name}
                                {student.roll_number ? ` (Roll ${student.roll_number})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Fee Structure *</label>
                          <select
                            value={paymentFeeId}
                            onChange={(event) => setPaymentFeeId(event.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                            disabled={!paymentClassId}
                          >
                            <option value="">Select Fee</option>
                            {filteredFeesForPayment.map((fee) => (
                              <option key={fee.id} value={fee.id}>
                                {fee.name} • ₹{fee.amount.toLocaleString()}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          />
                          {paymentStudentId && paymentFeeId && (
                            <p className="text-xs text-gray-500 mt-1">
                              Remaining balance: ₹
                              {Math.max(
                                0,
                                (fees.find((fee) => fee.id === paymentFeeId)?.amount || 0) -
                                  calculatePaidAmount(paymentStudentId, paymentFeeId)
                              ).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode *</label>
                          <select
                            value={paymentMode}
                            onChange={(event) => setPaymentMode(event.target.value as any)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          >
                            <option value="cash">Cash</option>
                            <option value="online">Online</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
                          <input
                            type="text"
                            value={paymentTransactionId}
                            onChange={(event) => setPaymentTransactionId(event.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="submit"
                            disabled={recordingPayment}
                            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {recordingPayment ? 'Recording...' : 'Record Payment'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentClassId('');
                              setPaymentStudentId('');
                              setPaymentFeeId('');
                              setPaymentAmount('');
                              setPaymentMode('cash');
                              setPaymentTransactionId('');
                            }}
                            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                          >
                            Reset
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-xl font-semibold mb-4">Payments Report</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Student
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Fee
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Amount
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Mode
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Date
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Transaction
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payments.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                                  No payments recorded yet.
                                </td>
                              </tr>
                            ) : (
                              payments.map((payment) => (
                                <tr key={payment.id}>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="font-medium text-gray-900">
                                      {payment.students?.profile?.full_name || 'Student'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {payment.students?.roll_number ? `Roll ${payment.students?.roll_number}` : ''}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {payment.fee_structures?.name || 'Fee'}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                    ₹{payment.amount_paid.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                                    {payment.payment_mode}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {new Date(payment.payment_date).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {payment.transaction_id || '—'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
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

      {/* Fee creation modal */}
      {isFeeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">Create Fee Structure</h3>
            <form onSubmit={handleCreateFee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class *</label>
                <select
                  value={feeForm.class_group_id}
                  onChange={(event) =>
                    setFeeForm((prev) => ({ ...prev, class_group_id: event.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fee Name *</label>
                <input
                  type="text"
                  value={feeForm.name}
                  onChange={(event) => setFeeForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={feeForm.amount}
                    onChange={(event) => setFeeForm((prev) => ({ ...prev, amount: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    value={feeForm.due_date}
                    onChange={(event) => setFeeForm((prev) => ({ ...prev, due_date: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={feeForm.description}
                  onChange={(event) => setFeeForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Optional details about the fee structure"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsFeeModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFee}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingFee ? 'Creating...' : 'Create Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

