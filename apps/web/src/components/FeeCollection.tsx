import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
}

interface FeeComponent {
  id: string;
  fee_type: string;
  fee_name: string;
  fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: string;
  due_date?: string;
}

interface MonthlyLedgerEntry {
  month: string;
  year: number;
  monthNumber: number;
  components: FeeComponent[];
}

export default function FeeCollection() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [feeStructure, setFeeStructure] = useState<any>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<MonthlyLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash' as 'cash' | 'upi' | 'online' | 'card' | 'cheque' | 'bank_transfer',
    transaction_id: '',
    cheque_number: '',
    bank_name: '',
    notes: ''
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const studentsList = (data.students || []).map((s: any) => ({
          id: s.id,
          name: s.profile?.full_name || 'Unknown',
          roll_number: s.roll_number || 'N/A',
          class: s.class_groups?.name || 'N/A'
        }));
        setStudents(studentsList);
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadStudentFeeData = async (studentId: string) => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/student/${studentId}/fee-structure`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message && data.message === 'No fee configured for this student') {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          setFeeStructure(data.fee_structure);
          setMonthlyLedger(data.monthly_ledger || []);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error && errorData.error.includes('No fee configured')) {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          alert(errorData.error || 'Failed to load fee data');
        }
      }
    } catch (error) {
      console.error('Error loading fee data:', error);
      alert('Error loading fee data');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    loadStudentFeeData(student.id);
    setSelectedComponents([]);
    setShowPaymentHistory(false);
  };

  const loadPaymentHistory = async () => {
    if (!selectedStudent) return;
    setLoadingHistory(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/student/${selectedStudent.id}/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payments || []);
        setShowPaymentHistory(true);
      }
    } catch (error) {
      console.error('Error loading payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const isFutureMonth = (year: number, month: number): boolean => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    return year > currentYear || (year === currentYear && month > currentMonth);
  };

  const handleComponentToggle = (componentId: string, monthYear: number, monthNumber: number) => {
    // Prevent selecting future months
    if (isFutureMonth(monthYear, monthNumber)) {
      alert('Cannot select future months for payment. Advance payments require Principal approval.');
      return;
    }
    setSelectedComponents(prev => 
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedComponents.length === 0) {
      alert('Please select at least one fee component');
      return;
    }

    if (!selectedStudent) return;

    // Client-side validation: Check for future months
    const futureComponents = selectedComponentsData.filter(comp => {
      // Find the month entry for this component
      const monthEntry = monthlyLedger.find(month => 
        month.components.some(c => c.id === comp.id)
      );
      if (!monthEntry) return false;
      return isFutureMonth(monthEntry.year, monthEntry.monthNumber);
    });

    if (futureComponents.length > 0) {
      alert('Cannot record payment for future months. Advance payments require Principal approval. Please contact Principal to enable advance payments.');
      return;
    }

    setProcessingPayment(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/collect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monthly_fee_component_ids: selectedComponents,
          payment_amount: parseFloat(paymentForm.payment_amount),
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          transaction_id: paymentForm.transaction_id || null,
          cheque_number: paymentForm.cheque_number || null,
          bank_name: paymentForm.bank_name || null,
          notes: paymentForm.notes || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Store full payment data for receipt
        const receiptPayload = {
          ...data,
          payment: {
            ...data.payment,
            amount_paid: data.payment?.amount_paid || data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
            payment_amount: data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
            payment_date: data.payment?.payment_date || paymentForm.payment_date,
            payment_mode: data.payment?.payment_mode || paymentForm.payment_mode,
            transaction_id: data.payment?.transaction_id || paymentForm.transaction_id,
            cheque_number: data.payment?.cheque_number || paymentForm.cheque_number,
            bank_name: data.payment?.bank_name || paymentForm.bank_name,
            notes: data.payment?.notes || paymentForm.notes
          },
          selectedComponents: selectedComponentsData
        };
        setReceiptData(receiptPayload);
        setShowReceipt(true);
        setShowPaymentModal(false);
        // Reload student data
        if (selectedStudent) {
          loadStudentFeeData(selectedStudent.id);
        }
        // Reset form
        setPaymentForm({
          payment_amount: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'cash',
          transaction_id: '',
          cheque_number: '',
          bank_name: '',
          notes: ''
        });
        setSelectedComponents([]);
      } else {
        const error = await response.json();
        // Show better error message
        const errorMessage = error.error || 'Failed to process payment';
        alert(errorMessage);
        
        // If it's a future month error, clear selection
        if (errorMessage.includes('future months') || errorMessage.includes('Advance payments')) {
          setSelectedComponents([]);
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error processing payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially-paid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedComponentsData = monthlyLedger
    .flatMap(month => month.components)
    .filter(comp => selectedComponents.includes(comp.id));

  const totalPending = selectedComponentsData.reduce((sum, comp) => sum + comp.pending_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Fee Collection</h2>
      </div>

      {/* Student Search */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Search Student</h3>
        <input
          type="text"
          placeholder="Search by name or roll number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4"
        />
        
        {searchQuery && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">No students found</div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                    selectedStudent?.id === student.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-semibold">{student.name}</div>
                  <div className="text-sm text-gray-600">
                    Roll: {student.roll_number} | Class: {student.class}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected Student Info */}
      {selectedStudent && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-semibold">{selectedStudent.name}</h3>
              <p className="text-gray-600">Roll: {selectedStudent.roll_number} | Class: {selectedStudent.class}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadPaymentHistory}
                className="px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700"
              >
                View Payment History
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={selectedComponents.length === 0}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  selectedComponents.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Collect Payment ({selectedComponents.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading fee data...</div>
          ) : feeStructure === null ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-yellow-800 font-semibold text-lg">⚠️ No fee configured for this student</p>
              <p className="text-yellow-700 mt-2">Please contact Principal to assign fee structure.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Fee Structure Overview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Assigned Fee Structure</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {feeStructure?.class_fee && (
                    <div className="bg-white rounded p-3">
                      <div className="font-semibold text-blue-700">Class Fee</div>
                      <div>₹{feeStructure.class_fee.amount.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">{feeStructure.class_fee.billing_frequency}</div>
                    </div>
                  )}
                  {feeStructure?.transport_fee && (
                    <div className="bg-white rounded p-3">
                      <div className="font-semibold text-blue-700">Transport Fee</div>
                      <div>₹{feeStructure.transport_fee.amount.toFixed(2)}</div>
                      <div className="text-xs text-gray-600">{feeStructure.transport_fee.route_name} | {feeStructure.transport_fee.billing_frequency}</div>
                    </div>
                  )}
                  {feeStructure?.custom_fees && feeStructure.custom_fees.length > 0 && (
                    <div className="bg-white rounded p-3">
                      <div className="font-semibold text-blue-700">Custom Fees ({feeStructure.custom_fees.length})</div>
                      {feeStructure.custom_fees.map((cf: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          {cf.category_name}: ₹{cf.amount.toFixed(2)} ({cf.billing_frequency})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Fee Ledger - Table Format */}
              <div>
                <h4 className="font-semibold mb-3">Monthly Fee Status Ledger</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Month</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Paid Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Pending Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Due Date</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b">Select</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyLedger.map((monthEntry, monthIdx) => 
                        monthEntry.components.map((comp, compIdx) => {
                          const isOverdue = comp.status === 'overdue' || 
                            (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                          const isFuture = isFutureMonth(monthEntry.year, monthEntry.monthNumber);
                          const isDisabled = comp.status === 'paid' || comp.pending_amount === 0 || isFuture;
                          const rowBgColor = comp.status === 'paid' 
                            ? 'bg-green-50' 
                            : isOverdue 
                            ? 'bg-red-50' 
                            : comp.status === 'partially-paid'
                            ? 'bg-yellow-50'
                            : 'bg-white';
                          
                          return (
                            <tr 
                              key={`${monthIdx}-${compIdx}`}
                              className={`${rowBgColor} ${isOverdue ? 'border-l-4 border-red-500' : ''} ${isFuture ? 'opacity-60' : ''}`}
                            >
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {compIdx === 0 ? monthEntry.month : ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="font-medium">{comp.fee_name}</div>
                                <div className="text-xs text-gray-500 capitalize">{comp.fee_type.replace('-', ' ')}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                ₹{comp.fee_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={comp.paid_amount > 0 ? 'text-green-600 font-semibold' : ''}>
                                  ₹{comp.paid_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={comp.pending_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                  ₹{comp.pending_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`}>
                                  {comp.status === 'paid' ? '🟢 PAID' : 
                                   isOverdue ? '🔴 OVERDUE' : 
                                   comp.status === 'partially-paid' ? '🟡 PARTIALLY PAID' : 
                                   isFuture ? '🔵 FUTURE' :
                                   '⚪ PENDING'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {comp.due_date ? new Date(comp.due_date).toLocaleDateString() : 'N/A'}
                                {isOverdue && comp.due_date && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                                  </div>
                                )}
                                {isFuture && (
                                  <div className="text-xs text-blue-600 mt-1">Future month</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedComponents.includes(comp.id)}
                                  onChange={() => handleComponentToggle(comp.id, monthEntry.year, monthEntry.monthNumber)}
                                  disabled={isDisabled}
                                  title={isFuture ? 'Future months require Principal approval' : (comp.status === 'paid' ? 'Already paid' : comp.pending_amount === 0 ? 'No pending amount' : '')}
                                  className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {monthlyLedger.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No fee data available for this student
                          </td>
                        </tr>
                      )}
                      {monthlyLedger.length > 0 && monthlyLedger.every(m => m.components.length === 0) && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No fee components found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                    <span>Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
                    <span>Partially Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                    <span>Pending/Overdue</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Collect Payment</h3>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="font-semibold">Selected Components:</div>
              {selectedComponentsData.map(comp => (
                <div key={comp.id} className="text-sm text-gray-700 mt-1">
                  {comp.fee_name}: ₹{comp.pending_amount.toFixed(2)} pending
                </div>
              ))}
              <div className="font-bold text-lg mt-2">
                Total Pending: ₹{totalPending.toFixed(2)}
              </div>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentForm.payment_amount}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_amount: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                    placeholder={`Max: ₹${totalPending.toFixed(2)}`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Payment Mode *</label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_mode: e.target.value as any})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="online">Online</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                {(paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'card') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Transaction ID</label>
                    <input
                      type="text"
                      value={paymentForm.transaction_id}
                      onChange={(e) => setPaymentForm({...paymentForm, transaction_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Enter transaction ID"
                    />
                  </div>
                )}

                {paymentForm.payment_mode === 'cheque' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Cheque Number</label>
                      <input
                        type="text"
                        value={paymentForm.cheque_number}
                        onChange={(e) => setPaymentForm({...paymentForm, cheque_number: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Enter cheque number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Bank Name</label>
                      <input
                        type="text"
                        value={paymentForm.bank_name}
                        onChange={(e) => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="Enter bank name"
                      />
                    </div>
                  </>
                )}

                {paymentForm.payment_mode === 'bank_transfer' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={paymentForm.bank_name}
                      onChange={(e) => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Enter bank name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  disabled={processingPayment}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {processingPayment ? 'Processing...' : 'Record Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Payment Receipt</h3>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Print
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setReceiptData(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
            
            <div className="border-2 border-gray-300 rounded-lg p-8 space-y-6 print:border-0">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-400 pb-4">
                <h4 className="text-3xl font-bold mb-2">FEE PAYMENT RECEIPT</h4>
                <div className="space-y-1 text-gray-700">
                  <p className="font-semibold">Receipt No: {receiptData.receipt_number || receiptData.payment?.receipt_number}</p>
                  <p>Date: {new Date(receiptData.payment?.payment_date || receiptData.payment_date || new Date()).toLocaleDateString('en-IN', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>
              </div>
              
              {/* Student Details */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Student Name:</div>
                  <div className="text-lg">{selectedStudent?.name}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Roll Number:</div>
                  <div className="text-lg">{selectedStudent?.roll_number}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Class:</div>
                  <div className="text-lg">{selectedStudent?.class}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Payment Mode:</div>
                  <div className="text-lg uppercase">{receiptData.payment?.payment_mode || 'CASH'}</div>
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="border-t border-b border-gray-300 py-4">
                <h5 className="font-semibold mb-3 text-gray-700">Payment Details:</h5>
                <div className="space-y-2">
                  {(receiptData.selectedComponents || selectedComponentsData).map((comp: FeeComponent, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{comp.fee_name}</span>
                      <span className="font-semibold">₹{comp.pending_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction Details */}
              {((receiptData.payment?.transaction_id) || (receiptData.payment?.cheque_number) || (receiptData.payment?.bank_name)) && (
                <div className="border-b border-gray-300 pb-4">
                  <h5 className="font-semibold mb-2 text-gray-700">Transaction Details:</h5>
                  {receiptData.payment?.transaction_id && (
                    <div className="text-sm">Transaction ID: {receiptData.payment.transaction_id}</div>
                  )}
                  {receiptData.payment?.cheque_number && (
                    <div className="text-sm">Cheque Number: {receiptData.payment.cheque_number}</div>
                  )}
                  {receiptData.payment?.bank_name && (
                    <div className="text-sm">Bank: {receiptData.payment.bank_name}</div>
                  )}
                </div>
              )}

              {/* Total Amount */}
              <div className="border-t-2 border-gray-400 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold">Total Amount Paid:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₹{receiptData.payment?.amount_paid?.toFixed(2) || 
                       receiptData.payment?.payment_amount?.toFixed(2) || 
                       (typeof receiptData.payment_amount === 'number' ? receiptData.payment_amount.toFixed(2) : '0.00')}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {receiptData.payment?.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold text-sm text-gray-700 mb-1">Notes:</div>
                  <div className="text-sm text-gray-600">{receiptData.payment.notes}</div>
                </div>
              )}

              {/* Message */}
              {receiptData.message && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                  <div className="font-semibold mb-1">Note:</div>
                  {receiptData.message}
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-300 pt-4 mt-8 text-center text-xs text-gray-500">
                <p>This is a computer-generated receipt.</p>
                <p className="mt-2">Collected by: Clerk</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Payment History - {selectedStudent?.name}</h3>
              <button
                onClick={() => {
                  setShowPaymentHistory(false);
                  setPaymentHistory([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No payment records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Component</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Period</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Mode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Receipt No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Collected By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentHistory.map((payment: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{payment.monthly_fee_components?.fee_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {payment.monthly_fee_components?.fee_type?.replace('-', ' ') || ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.monthly_fee_components?.period_month && payment.monthly_fee_components?.period_year
                            ? `${new Date(2000, payment.monthly_fee_components.period_month - 1).toLocaleString('default', { month: 'short' })} ${payment.monthly_fee_components.period_year}`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">
                          ₹{parseFloat(payment.payment_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm uppercase text-gray-600">
                          {payment.payment_mode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.receipt_number || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.received_by_profile?.full_name || 'Clerk'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-right">
                        Total Payments:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        ₹{paymentHistory.reduce((sum: number, p: any) => sum + parseFloat(p.payment_amount || 0), 0).toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

