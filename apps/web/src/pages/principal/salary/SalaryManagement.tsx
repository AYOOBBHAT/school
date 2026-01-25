import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadStaff,
  loadSalaryStructures,
  loadUnpaidSalaries,
  createSalaryStructure
} from '../../../services/principal.service';
import { Profile, ClassGroup } from '../types';

export default function SalaryManagement() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<any[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'structure' | 'records' | 'reports' | 'unpaid'>('structure');
  const [unpaidTeachers, setUnpaidTeachers] = useState<any[]>([]);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  
  // Structure form
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState<any>(null); // Track if editing existing structure
  const [structureForm, setStructureForm] = useState({
    teacher_id: '',
    base_salary: '',
    hra: '',
    other_allowances: '',
    fixed_deductions: '',
    salary_cycle: 'monthly' as 'monthly' | 'weekly' | 'biweekly',
    attendance_based_deduction: false,
    effective_from_date: '' // Effective from date for new/edited structure
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'unpaid') {
      loadUnpaidSalariesData();
    }
    // Always return cleanup function (even if empty) to avoid React error #310
    return () => {
      // No cleanup needed
    };
  }, [activeTab]);

  const loadData = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const [teachersData, structuresData] = await Promise.all([
        loadStaff(token),
        loadSalaryStructures(token)
      ]);

      setTeachers(teachersData.staff?.filter((s: any) => s.role === 'teacher') || []);
      setSalaryStructures(structuresData.structures || []);
    } catch (error) {
      console.error('Error loading salary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnpaidSalariesData = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadUnpaidSalaries(token, 'last_12_months');
      setUnpaidTeachers(data.teachers || []);
    } catch (error) {
      console.error('Error loading unpaid salaries:', error);
      setUnpaidTeachers([]);
    }
  };

  const toggleTeacherExpansion = (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const handleSaveStructure = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate effective_from_date is provided
    if (!structureForm.effective_from_date || structureForm.effective_from_date.trim() === '') {
      alert('Please select an effective from date. The salary structure must have a start date.');
      return;
    }

    // Validate date is not in the past when creating new structure (not editing)
    if (!selectedTeacherForEdit) {
      const selectedDate = new Date(structureForm.effective_from_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        alert('Effective from date cannot be in the past for new salary structures.');
        return;
      }
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createSalaryStructure(token, {
        ...structureForm,
        base_salary: parseFloat(structureForm.base_salary),
        hra: parseFloat(structureForm.hra) || 0,
        other_allowances: parseFloat(structureForm.other_allowances) || 0,
        fixed_deductions: parseFloat(structureForm.fixed_deductions) || 0,
        effective_from_date: structureForm.effective_from_date
      });

      alert('Salary structure saved successfully!');
      setShowStructureModal(false);
      setSelectedTeacherForEdit(null);
      setStructureForm({
        teacher_id: '',
        base_salary: '',
        hra: '',
        other_allowances: '',
        fixed_deductions: '',
        salary_cycle: 'monthly',
        attendance_based_deduction: false,
        effective_from_date: ''
      });
      loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to save structure');
    }
  };


  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Salary Management</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b">
        {[
          { id: 'structure', label: 'Salary Structure' },
          { id: 'unpaid', label: 'Unpaid Salaries' },
          { id: 'records', label: 'All Records' },
          { id: 'reports', label: 'Reports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Salary Structure Tab */}
      {activeTab === 'structure' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Teacher Salary Structures</h3>
            <button
              onClick={() => {
                setStructureForm({
                  teacher_id: '',
                  base_salary: '',
                  hra: '',
                  other_allowances: '',
                  fixed_deductions: '',
                  salary_cycle: 'monthly',
                  attendance_based_deduction: false,
                  effective_from_date: ''
                });
                setSelectedTeacherForEdit(null);
                setShowStructureModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Set Salary Structure
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance Deduction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryStructures.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No salary structures set. Click "Set Salary Structure" to get started.
                    </td>
                  </tr>
                ) : (
                  salaryStructures.map((structure) => (
                    <tr key={structure.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {structure.teacher?.full_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">₹{structure.base_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.hra.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.other_allowances.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.fixed_deductions.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {structure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setStructureForm({
                              teacher_id: structure.teacher_id,
                              base_salary: structure.base_salary.toString(),
                              hra: structure.hra.toString(),
                              other_allowances: structure.other_allowances.toString(),
                              fixed_deductions: structure.fixed_deductions.toString(),
                              salary_cycle: structure.salary_cycle,
                              attendance_based_deduction: structure.attendance_based_deduction,
                              effective_from_date: '' // Will be set by user
                            });
                            setSelectedTeacherForEdit(structure);
                            setShowStructureModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* All Records Tab */}
      {activeTab === 'records' && (
        <div>
          <h3 className="text-xl font-bold mb-4">All Salary Records</h3>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No salary records found
                    </td>
                  </tr>
                ) : (
                  salaryRecords.map((record: any) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4">{record.teacher?.full_name || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        {new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' })} {record.year}
                      </td>
                      <td className="px-6 py-4">₹{record.gross_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{record.total_deductions.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold">₹{record.net_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.payment_date ? new Date(record.payment_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unpaid Salaries Tab */}
      {activeTab === 'unpaid' && (
        <div>
          <h3 className="text-xl font-bold mb-4">Unpaid Teacher Salaries (Month-wise)</h3>
          <p className="text-gray-600 mb-6">
            View all unpaid salary months for teachers, including months where salary records were not generated.
          </p>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unpaid Months</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Unpaid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oldest Unpaid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unpaidTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No teachers with unpaid salaries. All teachers are up to date with their payments.
                    </td>
                  </tr>
                ) : (
                  unpaidTeachers.map((teacher: any) => {
                    const isExpanded = expandedTeachers.has(teacher.teacher_id);
                    
                    return (
                      <>
                        <tr key={teacher.teacher_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            {teacher.unpaid_months_count > 0 && (
                              <button
                                onClick={() => toggleTeacherExpansion(teacher.teacher_id)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isExpanded ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium">{teacher.teacher_name || 'Unknown'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{teacher.teacher_email || '-'}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              {teacher.unpaid_months_count} {teacher.unpaid_months_count === 1 ? 'month' : 'months'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-orange-600">
                            ₹{teacher.total_unpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {teacher.oldest_unpaid_month ? (
                              <div>
                                <div>{teacher.oldest_unpaid_month.period_label}</div>
                                <div className="text-xs text-red-600">
                                  {teacher.oldest_unpaid_month.days_since_period_start} days overdue
                                </div>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                        {isExpanded && teacher.unpaid_months && teacher.unpaid_months.length > 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-gray-50">
                              <div className="ml-8">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Breakdown:</h4>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Month</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Days Overdue</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {teacher.unpaid_months.map((month: any, idx: number) => (
                                        <tr key={`${month.year}-${month.month}-${idx}`}>
                                          <td className="px-4 py-2 text-sm font-medium">{month.period_label}</td>
                                          <td className="px-4 py-2">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                              month.payment_status === 'paid'
                                                ? 'bg-green-100 text-green-800'
                                                : month.payment_status === 'partially-paid'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-orange-100 text-orange-800'
                                            }`}>
                                              {month.payment_status === 'paid' ? 'Paid' : 
                                               month.payment_status === 'partially-paid' ? 'Partially Paid' : 
                                               'Unpaid'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            <div className="font-semibold">₹{month.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            {month.paid_amount > 0 && (
                                              <div className="text-xs text-green-600">Cash: ₹{month.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            )}
                                            {month.credit_applied > 0 && (
                                              <div className="text-xs text-blue-600">Credit: ₹{month.credit_applied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            )}
                                            {month.effective_paid_amount > 0 && month.effective_paid_amount !== month.paid_amount && (
                                              <div className="text-xs text-gray-600 font-medium">Total: ₹{month.effective_paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            )}
                                            {month.pending_amount > 0 && (
                                              <div className="text-xs text-orange-600">Pending: ₹{month.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            {month.days_since_period_start > 0 ? (
                                              <span className="text-red-600 font-medium">{month.days_since_period_start} days</span>
                                            ) : (
                                              <span className="text-gray-500">-</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2 text-xs text-gray-500">
                                            {month.payment_date && (
                                              <span>Last payment: {new Date(month.payment_date).toLocaleDateString()}</span>
                                            )}
                                            {!month.payment_date && month.payment_status === 'unpaid' && (
                                              <span className="text-orange-600">No payment recorded</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          <h3 className="text-xl font-bold mb-4">Salary Reports & Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-lg font-semibold mb-4">Monthly Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-semibold text-green-600">₹{(salaryRecords.filter((r: any) => r.status === 'paid').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pending:</span>
                  <span className="font-semibold text-yellow-600">₹{(salaryRecords.filter((r: any) => r.status === 'pending').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Approved:</span>
                  <span className="font-semibold text-blue-600">₹{(salaryRecords.filter((r: any) => r.status === 'approved').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Attendance Deduction:</span>
                  <span className="font-semibold text-red-600">₹{(salaryRecords.reduce((sum: number, r: any) => sum + parseFloat(r.attendance_deduction || 0), 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-lg font-semibold mb-4">Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Records:</span>
                  <span className="font-semibold">{salaryRecords.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'paid').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'approved').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {selectedTeacherForEdit ? 'Edit Salary Structure' : 'Set Salary Structure'}
            </h3>
            <form onSubmit={handleSaveStructure} className="space-y-4">
              {/* Effective From Date - Always required for both new and edit */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  required
                  value={structureForm.effective_from_date || ''}
                  onChange={(e) => setStructureForm({ ...structureForm, effective_from_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min={selectedTeacherForEdit ? undefined : new Date().toISOString().split('T')[0]} // Prevent past dates only for new structures
                />
                <p className="text-xs text-gray-600 mt-1">
                  {selectedTeacherForEdit 
                    ? 'The new salary structure will be effective from this date. Previous salary structure remains unchanged for all months before this date.'
                    : 'The salary structure will be effective from this date. Choose the date from which salary should start.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Teacher *</label>
                <select
                  value={structureForm.teacher_id}
                  onChange={(e) => setStructureForm({ ...structureForm, teacher_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Base Salary (₹) *</label>
                <input
                  type="number"
                  value={structureForm.base_salary}
                  onChange={(e) => setStructureForm({ ...structureForm, base_salary: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">HRA (₹)</label>
                <input
                  type="number"
                  value={structureForm.hra}
                  onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Other Allowances (₹)</label>
                <input
                  type="number"
                  value={structureForm.other_allowances}
                  onChange={(e) => setStructureForm({ ...structureForm, other_allowances: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fixed Deductions (₹)</label>
                <input
                  type="number"
                  value={structureForm.fixed_deductions}
                  onChange={(e) => setStructureForm({ ...structureForm, fixed_deductions: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Salary Cycle</label>
                <select
                  value={structureForm.salary_cycle}
                  onChange={(e) => setStructureForm({ ...structureForm, salary_cycle: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={structureForm.attendance_based_deduction}
                    onChange={(e) => setStructureForm({ ...structureForm, attendance_based_deduction: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Enable Attendance-Based Deduction</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save Structure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowStructureModal(false);
                    setSelectedTeacherForEdit(null);
                    setStructureForm({
                      teacher_id: '',
                      base_salary: '',
                      hra: '',
                      other_allowances: '',
                      fixed_deductions: '',
                      salary_cycle: 'monthly',
                      attendance_based_deduction: false,
                      effective_from_date: ''
                    });
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
        )}
      </div>
    );
}