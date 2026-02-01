import { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import { supabase } from '../utils/supabase';
import {
  loadStudentFeeStructure,
  loadStudentPayments,
  collectFee
} from '../services/clerk.service';
import type { MonthlyLedgerEntry } from '../services/types';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  class_group_id?: string;
}

interface FeeDetailsDrawerProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: () => void;
}

export default function FeeDetailsDrawer({ 
  student, 
  isOpen, 
  onClose,
  onPaymentSuccess 
}: FeeDetailsDrawerProps) {
  const [feeStructure, setFeeStructure] = useState<any>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<MonthlyLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [activeFeeTab, setActiveFeeTab] = useState<'class-fee' | 'transport-fee' | 'custom-fee'>('class-fee');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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

  // Lazy load fee data when drawer opens
  useEffect(() => {
    if (isOpen && student) {
      loadStudentFeeData(student.id);
    } else {
      // Reset state when drawer closes
      setFeeStructure(null);
      setMonthlyLedger([]);
      setSelectedComponents([]);
      setShowPaymentModal(false);
      setShowPaymentHistory(false);
    }
  }, [isOpen, student]);

  // Lock body scroll when drawer is open (production-grade UX)
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position when drawer closes
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Close drawer on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const loadStudentFeeData = async (studentId: string) => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      try {
        const data = await loadStudentFeeStructure(token, studentId);
        if (data.message && data.message === 'No fee configured for this student') {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          setFeeStructure(data.fee_structure);
          setMonthlyLedger(data.monthly_ledger || []);
        }
      } catch (error: any) {
        if (error.message && error.message.includes('No fee configured')) {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          console.error('Error loading fee data:', error);
        }
      }
    } catch (error) {
      console.error('Error loading fee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    if (!student) return;
    setLoadingHistory(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadStudentPayments(token, student.id);
      setPaymentHistory(data.payments || []);
      setShowPaymentHistory(true);
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

  const handleComponentToggle = useCallback((componentId: string, monthYear: number, monthNumber: number) => {
    if (isFutureMonth(monthYear, monthNumber)) {
      alert('Cannot select future months for payment. Advance payments require Principal approval.');
      return;
    }
    setSelectedComponents(prev => {
      const newSelection = prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId];
      return newSelection;
    });
  }, []);

  // Memoize selected components data
  const selectedComponentsData = useMemo(() => {
    if (selectedComponents.length === 0) return [];
    return monthlyLedger
      .flatMap(month => month.components || [])
      .filter(comp => selectedComponents.includes(comp.id));
  }, [selectedComponents, monthlyLedger]);

  // Memoize total pending amount
  const totalPending = useMemo(() => {
    return selectedComponentsData.reduce((sum, comp) => sum + comp.pending_amount, 0);
  }, [selectedComponentsData]);

  // Auto-update payment amount when selection changes
  useEffect(() => {
    if (showPaymentModal && selectedComponents.length > 0 && totalPending > 0) {
      setPaymentForm(prevForm => ({
        ...prevForm,
        payment_amount: totalPending.toFixed(2)
      }));
    } else if (showPaymentModal && selectedComponents.length === 0) {
      setPaymentForm(prevForm => ({
        ...prevForm,
        payment_amount: ''
      }));
    }
  }, [showPaymentModal, selectedComponents, totalPending]);

  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedComponents.length === 0) {
      alert('Please select at least one fee component');
      return;
    }

    if (!student) return;

    const selectedComponentsDataForValidation = monthlyLedger
      .flatMap(month => month.components || [])
      .filter(comp => selectedComponents.includes(comp.id));
    const totalPendingForValidation = selectedComponentsDataForValidation.reduce(
      (sum, comp) => sum + comp.pending_amount, 
      0
    );

    const paymentAmount = parseFloat(paymentForm.payment_amount || '0');
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    if (paymentAmount > totalPendingForValidation) {
      alert(`Payment amount (₹${paymentAmount.toFixed(2)}) cannot exceed total pending (₹${totalPendingForValidation.toFixed(2)})`);
      return;
    }

    setProcessingPayment(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Authentication required');
        return;
      }

      const paymentData = {
        monthly_fee_component_ids: selectedComponents,
        payment_amount: paymentAmount,
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        transaction_id: paymentForm.transaction_id || undefined,
        cheque_number: paymentForm.cheque_number || undefined,
        bank_name: paymentForm.bank_name || undefined,
        notes: paymentForm.notes || undefined
      };

      const result = await collectFee(token, paymentData);
      setReceiptData(result);
      setShowReceipt(true);
      setShowPaymentModal(false);
      setSelectedComponents([]);
      
      // Reload fee data to reflect payment
      await loadStudentFeeData(student.id);
      
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to process payment');
    } finally {
      setProcessingPayment(false);
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

  // Calculate total pending across all months
  const totalPendingAll = useMemo(() => {
    return monthlyLedger
      .flatMap(month => month.components || [])
      .reduce((sum, comp) => sum + comp.pending_amount, 0);
  }, [monthlyLedger]);

  if (!isOpen || !student) return null;

  return (
    <>
      {/* Backdrop with smooth fade-in animation */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer with smooth slide-in animation */}
      <div
        className={`fixed top-0 right-0 h-full w-[460px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex-1">
            <h2 id="drawer-title" className="text-xl font-bold text-gray-900">{student.name}</h2>
            <div className="text-sm text-gray-600 mt-1">
              Roll: {student.roll_number} | Class: {student.class}
            </div>
            {totalPendingAll > 0 && (
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                  Total Pending: ₹{totalPendingAll.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading fee data...</div>
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
                <div className="grid grid-cols-1 gap-4 text-sm">
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
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Month</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Amount</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Paid</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Pending</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Status</th>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase border-b">✓</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyLedger.map((monthEntry, monthIdx) => 
                        (monthEntry.components || []).map((comp, compIdx) => {
                          const isOverdue = comp.status === 'overdue' || 
                            (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                          const isFuture = isFutureMonth(monthEntry.year || 0, monthEntry.monthNumber || 0);
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
                              <td className="px-2 py-2 text-xs font-medium text-gray-900">
                                {compIdx === 0 ? monthEntry.month : ''}
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-700">
                                <div className="font-medium">{comp.fee_name}</div>
                                <div className="text-xs text-gray-500 capitalize">{comp.fee_type.replace('-', ' ')}</div>
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-700">
                                ₹{comp.fee_amount.toFixed(2)}
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-700">
                                <span className={comp.paid_amount > 0 ? 'text-green-600 font-semibold' : ''}>
                                  ₹{comp.paid_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-xs text-gray-700">
                                <span className={comp.pending_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                  ₹{comp.pending_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-xs">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`}>
                                  {comp.status === 'paid' ? '🟢' : 
                                   isOverdue ? '🔴' : 
                                   comp.status === 'partially-paid' ? '🟡' : 
                                   isFuture ? '🔵' :
                                   '⚪'}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedComponents.includes(comp.id)}
                                  onChange={() => handleComponentToggle(comp.id, monthEntry.year || 0, monthEntry.monthNumber || 0)}
                                  disabled={isDisabled}
                                  title={isFuture ? 'Future months require Principal approval' : (comp.status === 'paid' ? 'Already paid' : comp.pending_amount === 0 ? 'No pending amount' : '')}
                                  className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {monthlyLedger.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No fee data available for this student
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

        {/* Footer Actions */}
        <div className="border-t p-4 bg-gray-50 flex gap-2">
          <button
            onClick={loadPaymentHistory}
            className="flex-1 px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 text-sm"
          >
            View History
          </button>
          <button
            onClick={() => {
              setShowPaymentModal(true);
              setActiveFeeTab('class-fee');
            }}
            disabled={selectedComponents.length === 0}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm ${
              selectedComponents.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Collect ({selectedComponents.length})
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && student && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <div>
                <h3 className="text-2xl font-bold">Collect Fee</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {student.name} · {student.class}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedComponents([]);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {selectedComponents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Please select fee components from the ledger table above
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit}>
                  <div className="space-y-4">
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

                    <div>
                      <label className="block text-sm font-medium mb-2">Payment Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={totalPending}
                        value={paymentForm.payment_amount || (selectedComponents.length > 0 ? totalPending.toFixed(2) : '')}
                        onChange={(e) => setPaymentForm({...paymentForm, payment_amount: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        required
                      />
                      <p className="text-xs mt-1 text-gray-500">
                        Max: ₹{totalPending.toFixed(2)} (Total Pending)
                      </p>
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
                        rows={2}
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setSelectedComponents([]);
                        }}
                        className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={processingPayment || selectedComponents.length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                      >
                        {processingPayment ? 'Processing...' : 'Save & Print Receipt'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && student && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-2xl font-bold">Payment History - {student.name}</h3>
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

            <div className="p-6">
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
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && student && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Payment Receipt</h3>
              <div className="flex gap-2">
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
            </div>
            
            <div className="border-2 border-gray-300 rounded-lg p-8 space-y-6 print:border-0">
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
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Student Name:</div>
                  <div className="text-lg">{student.name}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Roll Number:</div>
                  <div className="text-lg">{student.roll_number}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Class:</div>
                  <div className="text-lg">{student.class}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Payment Mode:</div>
                  <div className="text-lg uppercase">{receiptData.payment?.payment_mode || 'CASH'}</div>
                </div>
              </div>

              <div className="border-t border-b border-gray-300 py-4">
                <h5 className="font-semibold mb-3 text-gray-700">Payment Details:</h5>
                <div className="space-y-2">
                  {(receiptData.selectedComponents || selectedComponentsData).map((comp: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{comp.fee_name}</span>
                      <span className="font-semibold">₹{comp.pending_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

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

              {receiptData.payment?.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold text-sm text-gray-700 mb-1">Notes:</div>
                  <div className="text-sm text-gray-600">{receiptData.payment.notes}</div>
                </div>
              )}

              {receiptData.message && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                  <div className="font-semibold mb-1">Note:</div>
                  {receiptData.message}
                </div>
              )}

              <div className="border-t border-gray-300 pt-4 mt-8 text-center text-xs text-gray-500">
                <p>This is a computer-generated receipt.</p>
                <p className="mt-2">Collected by: Clerk</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
