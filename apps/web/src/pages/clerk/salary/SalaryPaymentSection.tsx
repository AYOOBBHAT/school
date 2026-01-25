import { useEffect, useState, FormEvent, Fragment } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadUnpaidSalaries as loadUnpaidSalariesService,
  loadSalarySummary,
  recordSalaryPayment
} from '../../../services/clerk.service';
import TeacherPaymentHistory from '../../../components/TeacherPaymentHistory';

export default function SalaryPaymentSection() {
  const [teacherSummaries, setTeacherSummaries] = useState<any[]>([]);
  const [unpaidTeachers, setUnpaidTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedTeacherForHistory, setSelectedTeacherForHistory] = useState<{ id: string; name: string } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_mode: 'bank' as 'bank' | 'cash' | 'upi',
    payment_proof: '',
    notes: '',
    salary_month: new Date().getMonth() + 1,
    salary_year: new Date().getFullYear(),
    payment_type: 'salary' as 'salary' | 'advance' | 'adjustment' | 'bonus' | 'loan' | 'other'
  });

  useEffect(() => {
    loadUnpaidSalaries();
  }, []);

  const loadUnpaidSalaries = async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }

      // Load unpaid salaries with month-wise breakdown
      const unpaidData = await loadUnpaidSalariesService(token, 'last_12_months');
      setUnpaidTeachers(unpaidData.teachers || []);

      // Also load summary for backward compatibility
      try {
        const summaryData = await loadSalarySummary(token);
        const summariesWithPending = (summaryData.summaries || []).filter((s: any) => s.pending_salary > 0);
        setTeacherSummaries(summariesWithPending);
      } catch (error) {
        console.error('Error loading salary summaries:', error);
        setTeacherSummaries([]);
      }
    } catch (error) {
      console.error('Error loading salary data:', error);
      setUnpaidTeachers([]);
      setTeacherSummaries([]);
    } finally {
      setLoading(false);
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

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;

    // Validate amount
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    // Check if amount exceeds expected salary for the month
    const expectedSalary = selectedTeacher.selectedMonth?.net_salary || selectedTeacher.pending_salary;
    if (amount > expectedSalary) {
      const excess = amount - expectedSalary;
      if (!confirm(
        `Payment amount (₹${amount.toLocaleString()}) exceeds expected salary (₹${expectedSalary.toLocaleString()}) for this month.\n\n` +
        `Excess amount (₹${excess.toLocaleString()}) will be automatically applied as credit to future unpaid months.\n\n` +
        `Continue?`
      )) {
        return;
      }
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const result = await recordSalaryPayment(token, {
        teacher_id: selectedTeacher.teacher.id,
        payment_date: paymentForm.payment_date,
        amount: amount,
        payment_mode: paymentForm.payment_mode,
        payment_proof: paymentForm.payment_proof || null,
        notes: paymentForm.notes || null,
        salary_month: paymentForm.salary_month,
        salary_year: paymentForm.salary_year,
        payment_type: paymentForm.payment_type
      });
      
      // Show success message with credit information if applicable
      if (result.excess_amount && result.excess_amount > 0) {
        const creditInfo = result.credit_applied || {};
        const message = `Payment recorded successfully!\n\n` +
          `Excess Amount: ₹${result.excess_amount.toFixed(2)}\n` +
          `Credit Applied: ₹${(creditInfo.applied_amount || 0).toFixed(2)}\n` +
          `Months Applied: ${creditInfo.months_applied || 0}\n` +
          `Remaining Credit: ₹${(creditInfo.remaining_credit || 0).toFixed(2)}`;
        alert(message);
      } else {
        alert('Payment recorded successfully!');
      }
      
      setShowPaymentModal(false);
      setSelectedTeacher(null);
      setPaymentForm({
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_mode: 'bank',
        payment_proof: '',
        notes: '',
        salary_month: new Date().getMonth() + 1,
        salary_year: new Date().getFullYear(),
        payment_type: 'salary'
      });
      loadUnpaidSalaries();
    } catch (error: any) {
      alert(error.message || 'Failed to record payment');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="text-center py-8">Loading teacher salary information...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Pay Salary</h2>
          <p className="text-gray-600 mt-2">
            Record salary payments directly. You can pay full, partial, or advance payments to teachers.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unpaid Months</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Unpaid</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unpaidTeachers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No teachers with pending salary. All teachers are up to date with their payments.
                </td>
              </tr>
            ) : (
              unpaidTeachers.map((teacher: any) => {
                const isExpanded = expandedTeachers.has(teacher.teacher_id);
                // Find matching summary for total due/paid info
                const summary = teacherSummaries.find((s: any) => s.teacher?.id === teacher.teacher_id);
                
                return (
                  <Fragment key={teacher.teacher_id}>
                    <tr className="hover:bg-gray-50">
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
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedTeacher({
                                teacher: { id: teacher.teacher_id, full_name: teacher.teacher_name, email: teacher.teacher_email },
                                total_salary_due: summary?.total_salary_due || 0,
                                total_salary_paid: summary?.total_salary_paid || 0,
                                pending_salary: teacher.total_unpaid_amount,
                                unpaid_months: teacher.unpaid_months || []
                              });
                              // Pre-fill with oldest unpaid month if available
                              const oldestMonth = teacher.unpaid_months && teacher.unpaid_months.length > 0
                                ? teacher.unpaid_months[teacher.unpaid_months.length - 1]
                                : null;
                              setPaymentForm({
                                payment_date: new Date().toISOString().split('T')[0],
                                amount: oldestMonth ? oldestMonth.pending_amount.toFixed(2) : teacher.total_unpaid_amount.toFixed(2),
                                payment_mode: 'bank',
                                payment_proof: '',
                                notes: '',
                                salary_month: oldestMonth ? oldestMonth.month : new Date().getMonth() + 1,
                                salary_year: oldestMonth ? oldestMonth.year : new Date().getFullYear(),
                                payment_type: 'salary'
                              });
                              setShowPaymentModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Record Payment
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTeacherForHistory({
                                id: teacher.teacher_id,
                                name: teacher.teacher_name || 'Unknown'
                              });
                              setShowPaymentHistoryModal(true);
                            }}
                            className="text-emerald-600 hover:text-emerald-900 font-medium"
                          >
                            View History
                          </button>
                        </div>
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
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
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
                                      <td className="px-4 py-2">
                                        <button
                                          onClick={() => {
                                            setSelectedTeacher({
                                              teacher: { id: teacher.teacher_id, full_name: teacher.teacher_name, email: teacher.teacher_email },
                                              total_salary_due: summary?.total_salary_due || 0,
                                              total_salary_paid: summary?.total_salary_paid || 0,
                                              pending_salary: month.pending_amount,
                                              unpaid_months: teacher.unpaid_months || [],
                                              selectedMonth: month
                                            });
                                            setPaymentForm({
                                              payment_date: new Date().toISOString().split('T')[0],
                                              amount: month.pending_amount > 0 ? month.pending_amount.toFixed(2) : month.net_salary.toFixed(2),
                                              payment_mode: 'bank',
                                              payment_proof: '',
                                              notes: '',
                                              salary_month: month.month,
                                              salary_year: month.year,
                                              payment_type: 'salary'
                                            });
                                            setShowPaymentModal(true);
                                          }}
                                          className="text-xs text-blue-600 hover:text-blue-900 font-medium px-2 py-1 border border-blue-300 rounded hover:bg-blue-50"
                                        >
                                          Pay
                                        </button>
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
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Record Salary Payment</h3>
            <p className="text-sm text-gray-600 mb-2">
              Teacher: <strong>{selectedTeacher.teacher?.full_name}</strong>
            </p>
            {selectedTeacher.selectedMonth && (
              <p className="text-sm text-blue-600 mb-2 font-medium">
                Paying for: {selectedTeacher.selectedMonth.period_label}
              </p>
            )}
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              {selectedTeacher.selectedMonth ? (
                <>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Month Salary:</span>
                    <span className="font-semibold">₹{selectedTeacher.selectedMonth.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {selectedTeacher.selectedMonth.paid_amount > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Cash Paid:</span>
                      <span className="text-green-600">₹{selectedTeacher.selectedMonth.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {selectedTeacher.selectedMonth.credit_applied > 0 && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Credit Applied:</span>
                      <span className="text-blue-600">₹{selectedTeacher.selectedMonth.credit_applied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {selectedTeacher.selectedMonth.effective_paid_amount > 0 && selectedTeacher.selectedMonth.effective_paid_amount !== selectedTeacher.selectedMonth.paid_amount && (
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Total Paid:</span>
                      <span className="text-gray-700 font-medium">₹{selectedTeacher.selectedMonth.effective_paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Pending for this month:</span>
                    <span className="text-orange-600">₹{selectedTeacher.selectedMonth.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Total Due:</span>
                    <span className="font-semibold">₹{selectedTeacher.total_salary_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="text-green-600">₹{selectedTeacher.total_salary_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                    <span>Pending:</span>
                    <span className="text-orange-600">₹{selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Amount (₹) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter payment amount"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can pay full, partial, or advance amounts. 
                  {selectedTeacher.selectedMonth ? (
                    <>
                      Expected: ₹{selectedTeacher.selectedMonth.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. 
                      {selectedTeacher.selectedMonth.pending_amount > 0 && (
                        <> Pending: ₹{selectedTeacher.selectedMonth.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</>
                      )}
                      {selectedTeacher.selectedMonth.credit_applied > 0 && (
                        <> Credit applied: ₹{selectedTeacher.selectedMonth.credit_applied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</>
                      )}
                    </>
                  ) : (
                    <> Pending: ₹{selectedTeacher.pending_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</>
                  )}
                  {selectedTeacher.selectedMonth && parseFloat(paymentForm.amount) > selectedTeacher.selectedMonth.net_salary && (
                    <span className="block mt-1 text-blue-600 font-medium">
                      ⓘ Excess amount will be applied as credit to future months automatically.
                    </span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Salary Month *</label>
                  <select
                    required
                    value={paymentForm.salary_month}
                    onChange={(e) => setPaymentForm({ ...paymentForm, salary_month: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                      <option key={month} value={month}>
                        {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Salary Year *</label>
                  <select
                    required
                    value={paymentForm.salary_year}
                    onChange={(e) => setPaymentForm({ ...paymentForm, salary_year: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-gray-500 mt-1">Date when the payment was actually made</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Mode *</label>
                  <select
                    required
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Type *</label>
                  <select
                    required
                    value={paymentForm.payment_type}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_type: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="salary">Monthly Salary</option>
                    <option value="advance">Advance Payment</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="bonus">Bonus</option>
                    <option value="loan">Loan/Extra Payment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Proof (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.payment_proof}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_proof: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="URL or file path to payment proof"
                />
                <p className="text-xs text-gray-500 mt-1">Upload proof document and paste URL here, or leave empty</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                  placeholder="Additional notes about this payment"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedTeacher(null);
                    setPaymentForm({
                      payment_date: new Date().toISOString().split('T')[0],
                      amount: '',
                      payment_mode: 'bank',
                      payment_proof: '',
                      notes: '',
                      salary_month: new Date().getMonth() + 1,
                      salary_year: new Date().getFullYear(),
                      payment_type: 'salary'
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

      {/* Payment History Modal */}
      {showPaymentHistoryModal && selectedTeacherForHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <TeacherPaymentHistory
              teacherId={selectedTeacherForHistory.id}
              teacherName={selectedTeacherForHistory.name}
              onClose={() => {
                setShowPaymentHistoryModal(false);
                setSelectedTeacherForHistory(null);
              }}
              showHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
