import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';
// Import recharts components
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

interface UnpaidFeeAnalyticsProps {
  userRole: 'clerk' | 'principal';
  onCollectFee?: (studentId: string) => void;
}

interface Student {
  student_id: string;
  student_name: string;
  roll_number: string;
  class_name: string;
  parent_name: string;
  parent_phone: string;
  parent_address: string;
  pending_months: number;
  total_pending: number;
  total_fee: number;
  total_paid: number;
  payment_status: 'paid' | 'unpaid' | 'partially-paid';
}

interface AnalyticsData {
  summary: {
    total_students: number;
    unpaid_count: number;
    partially_paid_count: number;
    paid_count: number;
    total_unpaid_amount: number;
  };
  chart_data: {
    paid: number;
    unpaid: number;
    partially_paid: number;
  };
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const COLORS = {
  paid: '#3B82F6',      // Blue
  unpaid: '#EF4444',    // Red
  partially_paid: '#F59E0B' // Yellow/Orange
};

export default function UnpaidFeeAnalytics({ userRole, onCollectFee }: UnpaidFeeAnalyticsProps) {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [timeScope, setTimeScope] = useState<string>('last_month');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Load classes
  useEffect(() => {
    loadClasses();
  }, []);

  // Load analytics when filters change
  useEffect(() => {
    // Load analytics when timeScope is set (always true) or when class is selected
    if (timeScope) {
      loadAnalytics();
    }
  }, [selectedClass, timeScope, currentPage]);

  const loadClasses = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setClasses(result.classes || []);
        // Auto-select first class if available
        if (result.classes && result.classes.length > 0 && !selectedClass) {
          setSelectedClass(result.classes[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams({
        time_scope: timeScope,
        page: currentPage.toString(),
        limit: pageSize.toString()
      });

      if (selectedClass) {
        params.append('class_group_id', selectedClass);
      }

      const response = await fetch(`${API_URL}/clerk-fees/analytics/unpaid?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        const error = await response.json();
        console.error('Error loading analytics:', error);
        alert(error.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      alert('Error loading analytics');
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Paid', value: data.chart_data.paid, color: COLORS.paid },
      { name: 'Unpaid', value: data.chart_data.unpaid, color: COLORS.unpaid },
      { name: 'Partially Paid', value: data.chart_data.partially_paid, color: COLORS.partially_paid }
    ].filter(item => item.value > 0);
  }, [data]);

  const handleExportCSV = () => {
    if (!data || data.students.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Student Name', 'Roll Number', 'Class', 'Parent Name', 'Parent Phone', 'Parent Address', 'Pending Months', 'Total Pending Amount'];
    const rows = data.students.map(s => [
      s.student_name,
      s.roll_number,
      s.class_name,
      s.parent_name,
      s.parent_phone,
      s.parent_address,
      s.pending_months,
      s.total_pending.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unpaid_fees_${selectedClass || 'all'}_${timeScope}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    // Simple PDF export using window.print() - can be enhanced with a PDF library
    window.print();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold">Unpaid Fee Analytics</h3>
        {userRole === 'principal' && data && data.students.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Class</label>
          <select
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">All Classes</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Time Scope</label>
          <select
            value={timeScope}
            onChange={(e) => {
              setTimeScope(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="last_month">Last Month</option>
            <option value="last_2_months">Last 2 Months</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="current_academic_year">Current Academic Year</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading analytics...</div>
        </div>
      ) : data ? (
        <>
          {/* Summary Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total Students</div>
              <div className="text-2xl font-bold text-blue-900">{data.summary.total_students}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium">Unpaid</div>
              <div className="text-2xl font-bold text-red-900">{data.summary.unpaid_count}</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm text-yellow-600 font-medium">Partially Paid</div>
              <div className="text-2xl font-bold text-yellow-900">{data.summary.partially_paid_count}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Total Unpaid Amount</div>
              <div className="text-2xl font-bold text-gray-900">₹{data.summary.total_unpaid_amount.toFixed(2)}</div>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-4">Payment Status Distribution</h4>
              <div className="bg-gray-50 rounded-lg p-4" style={{ height: '300px' }}>
                {ResponsiveContainer ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-gray-500 mb-2">Chart library not installed</p>
                      <p className="text-sm text-gray-400">Run: npm install recharts</p>
                      <div className="mt-4 flex justify-center gap-4">
                        {chartData.map((item, idx) => (
                          <div key={idx} className="text-center">
                            <div className="w-16 h-16 rounded-full mx-auto mb-2" style={{ backgroundColor: item.color }}></div>
                            <div className="text-sm font-semibold">{item.name}</div>
                            <div className="text-xs text-gray-600">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Students Table */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Unpaid Students List</h4>
            {data.students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No unpaid students found for the selected filters.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Student Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Roll Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Parent Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Address</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Pending Months</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Total Pending</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.students.map((student) => (
                        <tr key={student.student_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{student.student_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.roll_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.parent_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.parent_phone}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.parent_address || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{student.pending_months}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">₹{student.total_pending.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            {userRole === 'clerk' && onCollectFee ? (
                              <button
                                onClick={() => onCollectFee(student.student_id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
                              >
                                Collect Fee
                              </button>
                            ) : (
                              <span className="text-sm text-gray-500">View Only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.pagination.total_pages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.pagination.total)} of {data.pagination.total} students
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(data.pagination.total_pages, prev + 1))}
                        disabled={currentPage === data.pagination.total_pages}
                        className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Select a class and time scope to view analytics
        </div>
      )}
    </div>
  );
}

