import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

import { API_URL } from '../utils/api.js';

interface MonthlyFeeComponent {
  id: string;
  student_id: string;
  fee_type: string;
  fee_name: string;
  period_year: number;
  period_month: number;
  fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: 'pending' | 'partially-paid' | 'paid' | 'overdue';
  due_date: string;
}

interface Student {
  id: string;
  roll_number: string;
  profile: {
    full_name: string;
  };
  class: {
    name: string;
  };
}

export default function ClerkFeeCollection() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [monthlyComponents, setMonthlyComponents] = useState<MonthlyFeeComponent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<MonthlyFeeComponent | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_mode: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    transaction_id: '',
    cheque_number: '',
    bank_name: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/students-admin`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load students');

      const data = await response.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadStudentFeeStructure = async (studentId: string) => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/clerk-fees/students/${studentId}/fee-structure`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load fee structure');

      const data = await response.json();
      
      if (data.monthlyComponents && data.monthlyComponents.length === 0) {
        alert(data.message || 'No fee structure assigned for this student.');
      }
      
      setMonthlyComponents(data.monthlyComponents || []);
    } catch (error) {
      console.error('Error loading fee structure:', error);
      alert('Failed to load fee structure');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    loadStudentFeeStructure(student.id);
  };

  const handlePaymentClick = (component: MonthlyFeeComponent) => {
    setSelectedComponent(component);
    setPaymentForm({
      payment_amount: component.pending_amount.toString(),
      payment_mode: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      transaction_id: '',
      cheque_number: '',
      bank_name: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedComponent) return;

    try {
      setSubmitting(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/clerk-fees/record-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          monthly_fee_component_id: selectedComponent.id,
          payment_amount: parseFloat(paymentForm.payment_amount),
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          transaction_id: paymentForm.transaction_id || null,
          cheque_number: paymentForm.cheque_number || null,
          bank_name: paymentForm.bank_name || null,
          notes: paymentForm.notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record payment');
      }

      const data = await response.json();
      
      // Show receipt
      setReceiptData(data);
      setShowPaymentModal(false);
      setShowReceipt(true);
      
      // Reload fee structure
      if (selectedStudent) {
        loadStudentFeeStructure(selectedStudent.id);
      }
      
      alert(`Payment recorded successfully! Receipt #${data.receipt_number}`);
    } catch (error: any) {
      console.error('Error recording payment:', error);
      alert(error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partially-paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid':
        return '✓ Paid';
      case 'partially-paid':
        return '⚠ Partial';
      case 'overdue':
        return '✕ Overdue';
      default:
        return '○ Pending';
    }
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1];
  };

  const filteredStudents = students.filter(s => 
    s.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.roll_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/clerk/dashboard')}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Fee Collection</h1>
          <p className="text-gray-600 mt-1">Record student fee payments</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold mb-3">Select Student</h2>
                <input
                  type="text"
                  placeholder="Search by name or roll number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No students found
                  </div>
                ) : (
                  filteredStudents.map(student => (
                    <div
                      key={student.id}
                      onClick={() => handleStudentSelect(student)}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                        selectedStudent?.id === student.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="font-medium">{student.profile?.full_name || 'N/A'}</div>
                      <div className="text-sm text-gray-600">Roll: {student.roll_number}</div>
                      <div className="text-sm text-gray-600">{student.class?.name}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Fee Components */}
          <div className="lg:col-span-2">
            {!selectedStudent ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-400 text-lg">
                  ← Select a student to view their fee structure
                </div>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-500">Loading fee structure...</div>
              </div>
            ) : monthlyComponents.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-gray-500">No fee structure assigned for this student.</div>
                <div className="text-sm text-gray-400 mt-2">Principal needs to configure fees.</div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-semibold">
                    Fee Ledger - {selectedStudent.profile?.full_name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Roll: {selectedStudent.roll_number} | Class: {selectedStudent.class?.name}
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyComponents.map(component => (
                        <tr key={component.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {getMonthName(component.period_month)} {component.period_year}
                          </td>
                          <td className="px-4 py-3 text-sm">{component.fee_name}</td>
                          <td className="px-4 py-3 text-sm text-right">₹{component.fee_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-green-600">
                            ₹{component.paid_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600">
                            ₹{component.pending_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(component.status)}`}>
                              {getStatusLabel(component.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {component.status !== 'paid' && (
                              <button
                                onClick={() => handlePaymentClick(component)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Collect
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Pending:</span>
                    <span className="text-xl font-bold text-red-600">
                      ₹{monthlyComponents.reduce((sum, c) => sum + c.pending_amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedComponent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Record Payment</h2>
            
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">Fee: {selectedComponent.fee_name}</div>
              <div className="text-sm text-gray-600">
                Period: {getMonthName(selectedComponent.period_month)} {selectedComponent.period_year}
              </div>
              <div className="text-lg font-bold mt-1">
                Pending: ₹{selectedComponent.pending_amount.toFixed(2)}
              </div>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.payment_amount}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_amount: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Payment Mode *</label>
                  <select
                    required
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_mode: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="online">Online Transfer</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                {['upi', 'online', 'card'].includes(paymentForm.payment_mode) && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Transaction ID</label>
                    <input
                      type="text"
                      value={paymentForm.transaction_id}
                      onChange={(e) => setPaymentForm({...paymentForm, transaction_id: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                )}

                {paymentForm.payment_mode === 'cheque' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Cheque Number</label>
                      <input
                        type="text"
                        value={paymentForm.cheque_number}
                        onChange={(e) => setPaymentForm({...paymentForm, cheque_number: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={paymentForm.bank_name}
                        onChange={(e) => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
