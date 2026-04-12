import { useEffect, useState } from 'react';
import { useStudentFees } from '../hooks/useStudentFees';
import { useStudentMonthlyLedger } from '../hooks/useStudentMonthlyLedger';
import { monthStatusBadgeClass } from '../../../utils/monthlyFeeLedger';

function formatMonthStatus(status: string): string {
  if (status === 'partially-paid') return 'Partially paid';
  if (status === 'paid') return 'Paid';
  return 'Unpaid';
}

export default function StudentFeesView() {
  const { summary, bills, payments, loading, loadFees } = useStudentFees();
  const { months, rpcSummary, ledgerError, loadingLedger, loadMonthlyLedger } = useStudentMonthlyLedger();
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFees();
    loadMonthlyLedger();
  }, [loadFees, loadMonthlyLedger]);

  const toggleMonth = (key: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const loadingAny = loading || loadingLedger;

  if (loadingAny && months.length === 0 && !summary && bills.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Fees & Payments</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-300 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Fees & Payments</h2>

      {ledgerError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Monthly fee status could not be loaded: {ledgerError}
        </div>
      )}

      {/* RPC summary from monthly ledger (when available) */}
      {rpcSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-gray-500">Components (window)</p>
            <p className="text-lg font-semibold">{rpcSummary.total_components ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-gray-600">Total fee</p>
            <p className="text-lg font-semibold text-blue-800">
              ₹{Number(rpcSummary.total_fee_amount ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-gray-600">Paid</p>
            <p className="text-lg font-semibold text-green-800">
              ₹{Number(rpcSummary.total_paid_amount ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-gray-600">Pending</p>
            <p className="text-lg font-semibold text-red-800">
              ₹{Number(rpcSummary.total_pending_amount ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Month-wise fee status (primary) */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold mb-3">Monthly fee status</h3>
        <p className="text-sm text-gray-600 mb-4">
          Status per month is based on all fee lines (class, transport, etc.) for that month.
        </p>
        {months.length === 0 && !loadingLedger ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No monthly fee records yet. When your school generates fee months, they will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {months.map((m, idx) => {
              const key = `${m.year ?? ''}-${m.monthNumber ?? idx}`;
              const open = expandedMonths.has(key);
              return (
                <div
                  key={key}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleMonth(key)}
                    className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold text-gray-900">{m.monthLabel || 'Month'}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${monthStatusBadgeClass(m.monthStatus)}`}>
                        {formatMonthStatus(m.monthStatus)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                      <span>
                        Fee: <strong>₹{m.totalFee.toFixed(2)}</strong>
                      </span>
                      <span>
                        Paid: <strong className="text-green-700">₹{m.totalPaid.toFixed(2)}</strong>
                      </span>
                      <span>
                        Pending: <strong className="text-red-700">₹{m.totalPending.toFixed(2)}</strong>
                      </span>
                      <span className="text-gray-400">{open ? '▼' : '▶'}</span>
                    </div>
                  </button>
                  {open && m.components.length > 0 && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/80">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="pb-2 pr-2">Fee</th>
                            <th className="pb-2 pr-2">Amount</th>
                            <th className="pb-2 pr-2">Paid</th>
                            <th className="pb-2 pr-2">Pending</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.components.map((c) => (
                            <tr key={c.id ?? `${c.fee_name}-${c.fee_type}`} className="border-t border-gray-200">
                              <td className="py-2 pr-2">
                                <div className="font-medium text-gray-900">{c.fee_name}</div>
                                <div className="text-xs text-gray-500 capitalize">
                                  {(c.fee_type || '').replace('-', ' ')}
                                </div>
                              </td>
                              <td className="py-2 pr-2">₹{Number(c.fee_amount ?? 0).toFixed(2)}</td>
                              <td className="py-2 pr-2 text-green-700">₹{Number(c.paid_amount ?? 0).toFixed(2)}</td>
                              <td className="py-2 pr-2 text-red-700">₹{Number(c.pending_amount ?? 0).toFixed(2)}</td>
                              <td className="py-2 capitalize">{c.status ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy bill-based records */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Bills (records)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bill.bill_no}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(bill.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{bill.total_amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        bill.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : bill.status === 'partial'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && (
            <div className="text-center py-8 text-gray-500">No bills found.</div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Summary (bills view)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Total Fee</p>
            <p className="text-3xl font-bold text-blue-600">
              ₹{summary?.total_fee?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Paid</p>
            <p className="text-3xl font-bold text-green-600">
              ₹{summary?.paid_amount?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-6">
            <p className="text-sm text-gray-600 mb-2">Pending</p>
            <p className="text-3xl font-bold text-red-600">
              ₹{summary?.pending_amount?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">Payment history (bills)</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                    {payment.method.replace('-', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments.length === 0 && (
            <div className="text-center py-12 text-gray-500">No payment records found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
