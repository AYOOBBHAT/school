import { useEffect } from 'react';
import { useStudentFees } from '../hooks/useStudentFees';

export default function StudentFeesView() {
  const { summary, bills, payments, loading, loadFees } = useStudentFees();

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  if (loading) {
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

      {/* Bills Table */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Bills</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bill No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bill.bill_no}
                  </td>
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
            <div className="text-center py-12 text-gray-500">No bills found.</div>
          )}
        </div>
      </div>

      {/* Payments Table */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Payment History</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Method
                </th>
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
