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
        setFeeStructure(data.fee_structure);
        setMonthlyLedger(data.monthly_ledger || []);
      } else {
        alert('Failed to load fee data');
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
  };

  const handleComponentToggle = (componentId: string) => {
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
        setReceiptData(data);
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
        alert(error.error || 'Failed to process payment');
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

          {loading ? (
            <div className="text-center py-8">Loading fee data...</div>
          ) : (
            <div className="space-y-4">
              {/* Monthly Ledger */}
              <div>
                <h4 className="font-semibold mb-3">Monthly Fee Ledger</h4>
                <div className="space-y-3">
                  {monthlyLedger.map((monthEntry, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <div className="font-semibold text-lg mb-3">{monthEntry.month}</div>
                      <div className="space-y-2">
                        {monthEntry.components.map(comp => (
                          <div
                            key={comp.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              comp.status === 'paid'
                                ? 'bg-green-50 border-green-200'
                                : comp.status === 'overdue'
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center space-x-4 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedComponents.includes(comp.id)}
                                onChange={() => handleComponentToggle(comp.id)}
                                disabled={comp.status === 'paid' || comp.pending_amount === 0}
                                className="w-5 h-5"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{comp.fee_name}</div>
                                <div className="text-sm text-gray-600">
                                  Amount: ₹{comp.fee_amount.toFixed(2)} | 
                                  Paid: ₹{comp.paid_amount.toFixed(2)} | 
                                  Pending: ₹{comp.pending_amount.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`}>
                                {comp.status.replace('-', ' ').toUpperCase()}
                              </span>
                              {comp.due_date && (
                                <span className="text-sm text-gray-600">
                                  Due: {new Date(comp.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {monthEntry.components.length === 0 && (
                        <div className="text-gray-500 text-center py-2">No fees for this month</div>
                      )}
                    </div>
                  ))}
                  {monthlyLedger.length === 0 && (
                    <div className="text-gray-500 text-center py-8">No fee data available</div>
                  )}
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
            
            <div className="border-2 border-gray-300 rounded-lg p-6 space-y-4">
              <div className="text-center border-b pb-4">
                <h4 className="text-2xl font-bold">FEE PAYMENT RECEIPT</h4>
                <p className="text-gray-600">Receipt No: {receiptData.receipt_number}</p>
                <p className="text-gray-600">Date: {receiptData.payment.payment_date}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold">Student:</div>
                  <div>{selectedStudent?.name}</div>
                </div>
                <div>
                  <div className="font-semibold">Roll Number:</div>
                  <div>{selectedStudent?.roll_number}</div>
                </div>
                <div>
                  <div className="font-semibold">Class:</div>
                  <div>{selectedStudent?.class}</div>
                </div>
                <div>
                  <div className="font-semibold">Payment Mode:</div>
                  <div>{receiptData.payment.payment_mode.toUpperCase()}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="font-semibold text-lg">Amount Paid: ₹{receiptData.payment.amount_paid.toFixed(2)}</div>
              </div>

              {receiptData.message && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  {receiptData.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

