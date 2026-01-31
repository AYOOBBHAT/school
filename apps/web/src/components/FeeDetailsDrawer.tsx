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
        student_id: student.id,
        component_ids: selectedComponents,
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[460px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{student.name}</h2>
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

      {/* Payment Modal - Reuse existing modal logic from FeeCollection */}
      {/* Payment History Modal - Reuse existing modal logic from FeeCollection */}
      {/* Receipt Modal - Reuse existing modal logic from FeeCollection */}
    </>
  );
}
