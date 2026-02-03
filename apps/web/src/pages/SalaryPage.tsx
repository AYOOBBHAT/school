import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api';
import { ROUTES } from '../utils/apiRoutes';

interface SalaryRecord {
  id: string;
  teacher_id: string;
  month: number;
  year: number;
  net_salary: number;
  status: string;
  payment_date?: string | null;
  teacher?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

interface SalaryPageProps {
  role?: string; // This is the viewer's role (principal/clerk), not the teacher role to filter by
}

export default function SalaryPage({ role }: SalaryPageProps) {
  // Get authentication token
  const getToken = async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token || '';
  };

  // Fetch salary data
  // Note: For principals and clerks, we want to see ALL salary records (all teachers)
  // The /api/salary/:role endpoint filters by teacher role, which is not what we want here
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['salary', role],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Always use the base endpoint to get all salary records
      // The backend will filter by school_id automatically via RLS
      const endpoint = `${API_URL}${ROUTES.salary}`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch salary data' }));
        throw new Error(errorData.error || 'Failed to fetch salary data');
      }

      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  const records: SalaryRecord[] = data?.records || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading salary data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <div className="text-red-600 text-xl font-semibold mb-2">Error</div>
          <div className="text-gray-700 mb-4">{error instanceof Error ? error.message : 'Failed to load salary data'}</div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (month: number, year: number) => {
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalAmount = records.reduce((sum, record) => sum + (record.net_salary || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Salary Management
                {role && <span className="text-lg text-gray-600 ml-2">({role})</span>}
              </h1>
              <p className="text-gray-600 mt-2">
                {records.length} salary record{records.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Card */}
        {records.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Records</div>
                <div className="text-2xl font-bold text-blue-600">{records.length}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Amount</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Average Salary</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(records.length > 0 ? totalAmount / records.length : 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Salary Records Table */}
        {records.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">💰</div>
            <div className="text-xl font-semibold text-gray-600 mb-2">No salary records found</div>
            <div className="text-gray-500">
              {role 
                ? `No salary records found for ${role} role.`
                : 'No salary records available.'}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Net Salary
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {record.teacher?.full_name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {record.teacher?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(record.month, record.year)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(record.net_salary || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.payment_date 
                          ? new Date(record.payment_date).toLocaleDateString('en-IN')
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
