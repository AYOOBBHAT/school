import { useNavigate } from 'react-router-dom';
import UnpaidFeeAnalytics from '../../../components/UnpaidFeeAnalytics';

interface DashboardOverviewProps {
  dashboardStats: any;
  loadingStats: boolean;
  setActiveTab: (tab: 'dashboard' | 'fee-collection' | 'salary-payment') => void;
}

export function DashboardOverview({ dashboardStats, loadingStats, setActiveTab }: DashboardOverviewProps) {
  const navigate = useNavigate();

  if (loadingStats) {
    return (
      <div className="text-center py-8">Loading statistics...</div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Dashboard Overview</h2>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Students</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {dashboardStats?.totalStudents || 0}
              </p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Today's Collection</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                ₹{dashboardStats?.todayCollection?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Pending</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                ₹{dashboardStats?.totalPending?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-4xl">📋</div>
          </div>
        </div>
      </div>

      {/* Unpaid Fee Analytics */}
      <UnpaidFeeAnalytics
        userRole="clerk"
        onCollectFee={(studentId) => {
          // Navigate to fee collection with student pre-selected
          setActiveTab('fee-collection');
          navigate(`/clerk/fees?student=${studentId}`);
        }}
      />

      {/* Recent Payments */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Payments</h3>
        {dashboardStats?.recentPayments?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dashboardStats.recentPayments.slice(0, 10).map((payment: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600">
                      ₹{parseFloat(payment.payment_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm uppercase text-gray-600">
                      {payment.payment_mode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No recent payments</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => {
              setActiveTab('fee-collection');
              navigate('/clerk/fees');
            }}
            className="p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition text-left"
          >
            <div className="font-semibold text-lg">💰 Collect Fees</div>
            <div className="text-sm text-gray-600 mt-1">Record fee payments from students</div>
          </button>
          <button
            onClick={() => {
              setActiveTab('fee-collection');
              navigate('/clerk/fees');
            }}
            className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition text-left"
          >
            <div className="font-semibold text-lg">📊 View Reports</div>
            <div className="text-sm text-gray-600 mt-1">View payment history and analytics</div>
          </button>
        </div>
      </div>
    </div>
  );
}
