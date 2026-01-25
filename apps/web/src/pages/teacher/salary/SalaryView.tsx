import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import TeacherPaymentHistory from '../../../components/TeacherPaymentHistory';
import { loadSalaryData } from '../../../services/teacher.service';

interface SalaryViewProps {
  profile: any;
}

export default function SalaryView({ profile }: SalaryViewProps) {
  const [salaryStructure, setSalaryStructure] = useState<any>(null);
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingSalary(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      if (!token || !userId) return;

      const { structure, records } = await loadSalaryData(token, userId);
      setSalaryStructure(structure);
      setSalaryRecords(records);
    } catch (error) {
      console.error('Error loading salary data:', error);
    } finally {
      setLoadingSalary(false);
    }
  };

  if (loadingSalary) {
    return <div className="text-center py-8">Loading salary information...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">My Salary</h2>
        <button
          onClick={() => setShowPaymentHistory(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <span>💰</span>
          <span>View Payment History</span>
        </button>
      </div>
      
      {/* Salary Structure */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Salary Structure</h3>
        {salaryStructure ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">Base Salary</div>
              <div className="text-lg font-semibold">₹{parseFloat(salaryStructure.base_salary || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">HRA (House Rent Allowance)</div>
              <div className="text-lg font-semibold">₹{parseFloat(salaryStructure.hra || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Other Allowances</div>
              <div className="text-lg font-semibold">₹{parseFloat(salaryStructure.other_allowances || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Fixed Deductions</div>
              <div className="text-lg font-semibold text-red-600">₹{parseFloat(salaryStructure.fixed_deductions || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Salary Cycle</div>
              <div className="text-lg font-semibold capitalize">{salaryStructure.salary_cycle || 'monthly'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Attendance-Based Deduction</div>
              <div className="text-lg font-semibold">
                {salaryStructure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled'}
              </div>
            </div>
            <div className="md:col-span-2 pt-4 border-t">
              <div className="text-sm text-gray-600">Gross Salary (Base + HRA + Allowances)</div>
              <div className="text-2xl font-bold text-green-600">
                ₹{(salaryStructure.base_salary + salaryStructure.hra + salaryStructure.other_allowances).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Salary structure not set yet. Please contact your principal.
          </div>
        )}
      </div>

      {/* Salary Records */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Salary History</h3>
        {salaryRecords.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No salary records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance Deduction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryRecords
                  .sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year;
                    return b.month - a.month;
                  })
                  .map((record: any) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' })} {record.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{record.gross_salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ₹{record.total_deductions.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-red-600">
                        ₹{record.attendance_deduction.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-green-600">
                        ₹{record.net_salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'approved' ? 'bg-green-100 text-green-800' :
                          record.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          record.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status === 'pending' ? 'Pending Approval' :
                           record.status === 'approved' ? 'Approved' :
                           record.status === 'rejected' ? 'Rejected' :
                           record.status === 'paid' ? 'Paid' :
                           record.status}
                        </span>
                        {record.status === 'rejected' && record.rejection_reason && (
                          <div className="text-xs text-red-600 mt-1 max-w-xs">
                            Reason: {record.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.payment_date ? (
                          <div>
                            <span className="text-sm">
                              {new Date(record.payment_date).toLocaleDateString()}
                            </span>
                            {record.payment_mode && (
                              <div className="text-xs text-gray-500 capitalize">
                                {record.payment_mode}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.status === 'paid' && (
                          <button
                            onClick={() => {
                              const slipWindow = window.open('', '_blank');
                              if (slipWindow) {
                                slipWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>Salary Slip - ${new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' })} ${record.year}</title>
                                      <style>
                                        body { font-family: Arial, sans-serif; padding: 20px; }
                                        .header { text-align: center; margin-bottom: 30px; }
                                        .details { margin: 20px 0; }
                                        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                                        .label { font-weight: bold; }
                                        .amount { text-align: right; }
                                        .total { font-size: 18px; font-weight: bold; margin-top: 20px; padding-top: 20px; border-top: 2px solid #333; }
                                      </style>
                                    </head>
                                    <body>
                                      <div class="header">
                                        <h1>Salary Slip</h1>
                                        <p>${new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' })} ${record.year}</p>
                                      </div>
                                      <div class="details">
                                        <div class="row">
                                          <span class="label">Employee:</span>
                                          <span>${profile?.full_name || 'Teacher'}</span>
                                        </div>
                                        <div class="row">
                                          <span class="label">Gross Salary:</span>
                                          <span class="amount">₹${parseFloat(record.gross_salary || 0).toLocaleString()}</span>
                                        </div>
                                        <div class="row">
                                          <span class="label">Total Deductions:</span>
                                          <span class="amount">₹${parseFloat(record.total_deductions || 0).toLocaleString()}</span>
                                        </div>
                                        ${record.attendance_deduction > 0 ? `
                                        <div class="row">
                                          <span class="label">Attendance Deduction:</span>
                                          <span class="amount">₹${parseFloat(record.attendance_deduction || 0).toLocaleString()}</span>
                                        </div>
                                        ` : ''}
                                        <div class="row total">
                                          <span>Net Salary:</span>
                                          <span class="amount">₹${parseFloat(record.net_salary || 0).toLocaleString()}</span>
                                        </div>
                                        ${record.payment_date ? `
                                        <div class="row">
                                          <span class="label">Payment Date:</span>
                                          <span>${new Date(record.payment_date).toLocaleDateString()}</span>
                                        </div>
                                        <div class="row">
                                          <span class="label">Payment Mode:</span>
                                          <span>${(record.payment_mode || '').toUpperCase()}</span>
                                        </div>
                                        ` : ''}
                                      </div>
                                    </body>
                                  </html>
                                `);
                                slipWindow.document.close();
                              }
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                          >
                            View Slip
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Salary Slip Info */}
      {salaryRecords.some((r: any) => r.status === 'paid') && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Note:</strong> Click "View Slip" on paid salaries to view your salary slip. You can print it from the browser.
          </p>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && profile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <TeacherPaymentHistory
              teacherId={profile.id}
              teacherName={profile.full_name || undefined}
              onClose={() => setShowPaymentHistory(false)}
              showHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
