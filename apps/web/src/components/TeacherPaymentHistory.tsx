import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api';

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_type: 'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other';
  payment_type_label: string;
  payment_mode: 'bank' | 'cash' | 'upi';
  payment_proof: string | null;
  notes: string | null;
  salary_month: number | null;
  salary_year: number | null;
  salary_period_label: string | null;
  paid_by_name: string | null;
  paid_by_email: string | null;
  running_total: number;
  created_at: string;
}

interface PaymentSummary {
  total_paid: number;
  total_payments: number;
  average_payment: number;
  pending_amount: number;
  total_paid_till_date: number;
  by_type: Record<string, number>;
  by_mode: Record<string, number>;
  date_range: {
    first_payment_date: string | null;
    last_payment_date: string | null;
  };
}

interface TeacherPaymentHistoryProps {
  teacherId: string;
  teacherName?: string;
  onClose?: () => void;
  showHeader?: boolean;
}

export default function TeacherPaymentHistory({
  teacherId,
  teacherName,
  onClose,
  showHeader = true
}: TeacherPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  // Ref to track if component is mounted (for async operations)
  const isMountedRef = useRef(true);

  // Extract loadPaymentHistory as a useCallback so it can be called from both useEffect and retry button
  const loadPaymentHistory = useCallback(async () => {
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);
      
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        if (!isMountedRef.current) return;
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (paymentTypeFilter !== 'all') params.append('payment_type', paymentTypeFilter);
      if (paymentModeFilter !== 'all') params.append('payment_mode', paymentModeFilter);

      const response = await fetch(`${API_URL}/salary/history/${teacherId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load payment history');
      }

      const data = await response.json();
      if (!isMountedRef.current) return;
      
      setPayments(data.payments || []);
      setSummary(data.summary || null);
      setTotalPages(data.pagination?.total_pages || 1);
      setTotalCount(data.pagination?.total || 0);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('Error loading payment history:', err);
      setError(err.message || 'Failed to load payment history');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [teacherId, currentPage, startDate, endDate, paymentTypeFilter, paymentModeFilter]);

  useEffect(() => {
    isMountedRef.current = true;
    loadPaymentHistory();

    // Always return cleanup function to avoid React error #310
    return () => {
      isMountedRef.current = false;
    };
  }, [loadPaymentHistory]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPaymentTypeColor = (type: string) => {
    switch (type) {
      case 'salary': return 'bg-blue-100 text-blue-800';
      case 'advance': return 'bg-yellow-100 text-yellow-800';
      case 'adjustment': return 'bg-purple-100 text-purple-800';
      case 'bonus': return 'bg-green-100 text-green-800';
      case 'loan': return 'bg-orange-100 text-orange-800';
      case 'other': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentModeLabel = (mode: string) => {
    switch (mode) {
      case 'bank': return 'Bank Transfer';
      case 'cash': return 'Cash';
      case 'upi': return 'UPI';
      default: return mode;
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPaymentTypeFilter('all');
    setPaymentModeFilter('all');
    setCurrentPage(1);
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment history...</p>
        </div>
      </div>
    );
  }

  if (error && payments.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-semibold mb-2">Error</p>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadPaymentHistory}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Payment History
              {teacherName && <span className="text-gray-600 font-normal"> - {teacherName}</span>}
            </h2>
            <p className="text-gray-600 mt-1">Complete salary and payment history</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_paid_till_date)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.total_payments} payments</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Pending Amount</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.pending_amount)}</p>
            <p className="text-xs text-gray-500 mt-1">Unpaid salaries</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Average Payment</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(summary.average_payment)}</p>
            <p className="text-xs text-gray-500 mt-1">Per payment</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Date Range</p>
            <p className="text-sm font-semibold text-gray-900">
              {summary.date_range.first_payment_date 
                ? formatDate(summary.date_range.first_payment_date)
                : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              to {summary.date_range.last_payment_date 
                ? formatDate(summary.date_range.last_payment_date)
                : 'N/A'}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
            <select
              value={paymentTypeFilter}
              onChange={(e) => {
                setPaymentTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="salary">Salary</option>
              <option value="advance">Advance</option>
              <option value="adjustment">Adjustment</option>
              <option value="bonus">Bonus</option>
              <option value="loan">Loan/Extra</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select
              value={paymentModeFilter}
              onChange={(e) => {
                setPaymentModeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Modes</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Paid By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Running Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">No payments found</p>
                      <p className="text-sm mt-1">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(payment.payment_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {payment.salary_period_label || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentTypeColor(payment.payment_type)}`}>
                        {payment.payment_type_label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {getPaymentModeLabel(payment.payment_mode)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {payment.paid_by_name || 'System'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {formatCurrency(payment.running_total)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate" title={payment.notes || ''}>
                        {payment.notes || '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {currentPage} of {totalPages} ({totalCount} total payments)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
