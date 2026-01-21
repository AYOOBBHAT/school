import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  class_group_id?: string;
}

interface ClassGroup {
  id: string;
  name: string;
}

interface FeeComponent {
  id: string;
  fee_type: string;
  fee_name: string;
  fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: string;
  due_date?: string;
}

interface MonthlyLedgerEntry {
  month: string;
  year: number;
  monthNumber: number;
  components: FeeComponent[];
}

export default function FeeCollection() {
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]); // Store all students for filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(''); // Empty = all classes
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [feeStructure, setFeeStructure] = useState<any>(null);
  const [monthlyLedger, setMonthlyLedger] = useState<MonthlyLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const [activeFeeTab, setActiveFeeTab] = useState<'class-fee' | 'transport-fee' | 'custom-fee'>('class-fee');
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

  useEffect(() => {
    loadClasses();
    loadStudents();
  }, []);

  // Reload students when class filter changes
  useEffect(() => {
    loadStudents();
    // Keep search query but it will be re-applied to the new filtered list
  }, [selectedClass]);

  // Memoize selected components data to avoid recalculating on every render
  const selectedComponentsData = useMemo(() => {
    if (selectedComponents.length === 0) return [];
    return monthlyLedger
      .flatMap(month => month.components)
      .filter(comp => selectedComponents.includes(comp.id));
  }, [selectedComponents, monthlyLedger]);

  // Memoize total pending amount calculation
  const totalPending = useMemo(() => {
    return selectedComponentsData.reduce((sum, comp) => sum + comp.pending_amount, 0);
  }, [selectedComponentsData]);

  // Auto-update payment amount when selection changes (if modal is open)
  // Use totalPending (pending_amount) instead of fee_amount
  useEffect(() => {
    if (showPaymentModal && selectedComponents.length > 0 && totalPending > 0) {
      setPaymentForm(prevForm => ({
        ...prevForm,
        payment_amount: totalPending.toFixed(2)
      }));
    } else if (showPaymentModal && selectedComponents.length === 0) {
      // Clear payment amount when no components selected
      setPaymentForm(prevForm => ({
        ...prevForm,
        payment_amount: ''
      }));
    }
  }, [selectedComponents.length, showPaymentModal, totalPending]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadStudents = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Build URL with class filter if selected
      let url = `${API_URL}/students-admin`;
      if (selectedClass) {
        url += `?class_group_id=${selectedClass}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // The /students-admin endpoint returns { classes: [...], unassigned: [...] }
        // Extract students from classes array
        let studentsList: Student[] = [];
        
        if (data.classes && Array.isArray(data.classes)) {
          // Extract students from all classes (or just the selected class if filtered)
          data.classes.forEach((cls: any) => {
            if (cls.students && Array.isArray(cls.students)) {
              cls.students.forEach((s: any) => {
                studentsList.push({
                  id: s.id,
                  name: s.profile?.full_name || 'Unknown',
                  roll_number: s.roll_number || 'N/A',
                  class: cls.name || 'N/A',
                  class_group_id: cls.id
                });
              });
            }
          });
        }
        
        // Also include unassigned students if no class filter is selected
        if (!selectedClass && data.unassigned && Array.isArray(data.unassigned)) {
          data.unassigned.forEach((s: any) => {
            studentsList.push({
              id: s.id,
              name: s.profile?.full_name || 'Unknown',
              roll_number: s.roll_number || 'N/A',
              class: 'Unassigned',
              class_group_id: undefined
            });
          });
        }
        
        setAllStudents(studentsList);
        // Apply search filter immediately on the newly loaded students
        // Note: The debounced effect will also handle this, but this ensures immediate update
        if (searchQuery.trim()) {
          applySearchFilter(studentsList, searchQuery);
        } else {
          setStudents(studentsList);
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  // Apply search filter (predictive - starts with, but also includes partial matches)
  const applySearchFilter = (studentList: Student[], query: string) => {
    if (!query.trim()) {
      setStudents(studentList);
      return;
    }

    const queryLower = query.toLowerCase().trim();
    const filtered = studentList.filter(s => {
      const nameLower = (s.name || '').toLowerCase();
      const rollNumberLower = (s.roll_number || '').toLowerCase();
      // Predictive search: name starts with query (preferred) or contains query
      const nameStartsWith = nameLower.startsWith(queryLower);
      const nameContains = nameLower.includes(queryLower);
      const rollMatches = rollNumberLower.includes(queryLower);
      return nameStartsWith || nameContains || rollMatches;
    });
    setStudents(filtered);
  };

  // Debounced search handler - re-applies when search query or students list changes
  // Note: allStudents is already filtered by class from the backend when selectedClass changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // allStudents is already filtered by class from loadStudents() if selectedClass is set
      // So we just need to apply the search filter
      applySearchFilter(allStudents, searchQuery);
    }, 150); // 150ms debounce for better performance

    return () => clearTimeout(timeoutId);
  }, [searchQuery, allStudents]);

  const loadStudentFeeData = async (studentId: string) => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/student/${studentId}/fee-structure`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.message && data.message === 'No fee configured for this student') {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          setFeeStructure(data.fee_structure);
          setMonthlyLedger(data.monthly_ledger || []);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error && errorData.error.includes('No fee configured')) {
          setFeeStructure(null);
          setMonthlyLedger([]);
        } else {
          alert(errorData.error || 'Failed to load fee data');
        }
      }
    } catch (error) {
      console.error('Error loading fee data:', error);
      alert('Error loading fee data');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    loadStudentFeeData(student.id);
    setSelectedComponents([]);
    setShowPaymentHistory(false);
  };

  const loadPaymentHistory = async () => {
    if (!selectedStudent) return;
    setLoadingHistory(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/student/${selectedStudent.id}/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payments || []);
        setShowPaymentHistory(true);
      }
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
    // Prevent selecting future months
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

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedComponents.length === 0) {
      alert('Please select at least one fee component');
      return;
    }

    if (!selectedStudent) return;

    // Calculate total pending for selected components
    const selectedComponentsDataForValidation = monthlyLedger
      .flatMap(month => month.components)
      .filter(comp => selectedComponents.includes(comp.id));
    const totalPendingForValidation = selectedComponentsDataForValidation.reduce(
      (sum, comp) => sum + comp.pending_amount, 
      0
    );

    // Validate payment amount
    const paymentAmount = parseFloat(paymentForm.payment_amount || '0');
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }
    if (paymentAmount > totalPendingForValidation) {
      alert(`Payment amount (₹${paymentAmount.toFixed(2)}) cannot exceed total pending amount (₹${totalPendingForValidation.toFixed(2)})`);
      return;
    }

    // Client-side validation: Check for future months
    const futureComponents = selectedComponentsDataForValidation.filter(comp => {
      // Find the month entry for this component
      const monthEntry = monthlyLedger.find(month => 
        month.components.some(c => c.id === comp.id)
      );
      if (!monthEntry) return false;
      return isFutureMonth(monthEntry.year, monthEntry.monthNumber);
    });

    if (futureComponents.length > 0) {
      alert('Cannot record payment for future months. Advance payments require Principal approval. Please contact Principal to enable advance payments.');
      return;
    }

    setProcessingPayment(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/clerk-fees/collect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monthly_fee_component_ids: selectedComponents,
          payment_amount: parseFloat(paymentForm.payment_amount),
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          transaction_id: paymentForm.transaction_id || null,
          cheque_number: paymentForm.cheque_number || null,
          bank_name: paymentForm.bank_name || null,
          notes: paymentForm.notes || null
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Store full payment data for receipt
        const receiptPayload = {
          ...data,
          payment: {
            ...data.payment,
            amount_paid: data.payment?.amount_paid || data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
            payment_amount: data.payment?.payment_amount || parseFloat(paymentForm.payment_amount),
            payment_date: data.payment?.payment_date || paymentForm.payment_date,
            payment_mode: data.payment?.payment_mode || paymentForm.payment_mode,
            transaction_id: data.payment?.transaction_id || paymentForm.transaction_id,
            cheque_number: data.payment?.cheque_number || paymentForm.cheque_number,
            bank_name: data.payment?.bank_name || paymentForm.bank_name,
            notes: data.payment?.notes || paymentForm.notes
          },
          selectedComponents: selectedComponentsData
        };
        setReceiptData(receiptPayload);
        setShowReceipt(true);
        setShowPaymentModal(false);
        // Reload student data
        if (selectedStudent) {
          loadStudentFeeData(selectedStudent.id);
        }
        // Reset form
        setPaymentForm({
          payment_amount: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'cash',
          transaction_id: '',
          cheque_number: '',
          bank_name: '',
          notes: ''
        });
        setSelectedComponents([]);
      } else {
        const error = await response.json();
        // Show better error message
        const errorMessage = error.error || 'Failed to process payment';
        alert(errorMessage);
        
        // If it's a future month error, clear selection
        if (errorMessage.includes('future months') || errorMessage.includes('Advance payments')) {
          setSelectedComponents([]);
        }
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Error processing payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partially-paid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Students are already filtered by applySearchFilter, no need for additional filtering

  // Group components by fee type for tabs
  const componentsByType = {
    'class-fee': monthlyLedger.flatMap(month => 
      month.components.filter(c => c.fee_type === 'class-fee')
    ),
    'transport-fee': monthlyLedger.flatMap(month => 
      month.components.filter(c => c.fee_type === 'transport-fee')
    ),
    'custom-fee': monthlyLedger.flatMap(month => 
      month.components.filter(c => c.fee_type === 'custom-fee')
    )
  };

  // Get components for active tab, grouped by month
  const activeTabByMonth = monthlyLedger.map(monthEntry => ({
    ...monthEntry,
    components: monthEntry.components.filter(c => c.fee_type === activeFeeTab)
  })).filter(month => month.components.length > 0);

  // Get fee component name and amount for active tab
  const getActiveTabInfo = () => {
    if (activeTabByMonth.length === 0) return null;
    const firstComp = activeTabByMonth[0].components[0];
    return {
      name: firstComp.fee_name,
      amount: firstComp.fee_amount,
      cycle: feeStructure?.class_fee?.billing_frequency || 
             feeStructure?.transport_fee?.billing_frequency || 
             feeStructure?.custom_fees?.[0]?.billing_frequency || 'monthly'
    };
  };

  const activeTabInfo = getActiveTabInfo();
  
  // Calculate summary for selected components (memoized)
  const selectedMonths = useMemo(() => {
    const selectedMonthsSet = new Set<string>();
    selectedComponentsData.forEach(comp => {
      const monthEntry = monthlyLedger.find(m => 
        m.components.some(c => c.id === comp.id)
      );
      if (monthEntry) selectedMonthsSet.add(monthEntry.month);
    });
    return Array.from(selectedMonthsSet);
  }, [selectedComponentsData, monthlyLedger]);

  // Memoize summary calculations
  const baseFeeTotal = useMemo(() => 
    selectedComponentsData.reduce((sum, comp) => sum + comp.fee_amount, 0),
    [selectedComponentsData]
  );
  
  const previousBalance = useMemo(() => {
    // Previous balance would be from earlier unpaid months - simplified for now
    return 0;
  }, []);
  
  const lateFee = useMemo(() => {
    return selectedComponentsData.reduce((sum, comp) => {
      // Calculate late fee for overdue components
      if (comp.status === 'overdue' && comp.due_date) {
        const daysOverdue = Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24));
        // TODO: Apply fine rules from fine_rules table
        return sum; // Placeholder
      }
      return sum;
    }, 0);
  }, [selectedComponentsData]);
  
  const discount = useMemo(() => 0, []); // TODO: Get from principal-approved discounts
  
  const finalAmount = useMemo(() => 
    baseFeeTotal + previousBalance + lateFee - discount,
    [baseFeeTotal, previousBalance, lateFee, discount]
  );
  
  // Check if all months are paid for active tab
  const allPaidForActiveTab = activeTabByMonth.every(month => 
    month.components.every(c => c.status === 'paid' || c.pending_amount === 0)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Fee Collection</h2>
      </div>

      {/* Student Search */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Search Student</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Class Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Filter by Class (Optional)</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSearchQuery(''); // Clear search when class changes
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Search by Name</label>
            <input
              type="text"
              placeholder={selectedClass ? `Search in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}...` : "Type student name (predictive search)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {selectedClass 
                ? `Searching in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'} - names starting with your input`
                : 'Search shows students whose names start with your input'}
            </p>
          </div>
        </div>
        
        {/* Search Results */}
        {searchQuery && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">
                {searchQuery ? (
                  <div>
                    <p>No students found matching "{searchQuery}"</p>
                    {selectedClass && (
                      <p className="text-xs mt-1">in {classes.find(c => c.id === selectedClass)?.name || 'selected class'}</p>
                    )}
                    {allStudents.length > 0 && (
                      <p className="text-xs mt-1 text-gray-400">Total students available: {allStudents.length}</p>
                    )}
                  </div>
                ) : (
                  'Start typing to search for students'
                )}
              </div>
            ) : (
              <>
                <div className="p-2 bg-gray-50 text-xs text-gray-600 border-b">
                  Found {students.length} student{students.length !== 1 ? 's' : ''} matching "{searchQuery}"
                  {selectedClass && ` in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}`}
                </div>
                {students.slice(0, 50).map(student => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                      selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-600">
                      Roll: {student.roll_number} | Class: {student.class}
                    </div>
                  </div>
                ))}
                {students.length > 50 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                    Showing first 50 results. Refine your search for more specific results.
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Show all students when no search query but class is selected */}
        {!searchQuery && selectedClass && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            <div className="p-2 bg-gray-50 text-xs text-gray-600 border-b">
              All students in {classes.find(c => c.id === selectedClass)?.name || 'selected class'} ({students.length})
            </div>
            {students.slice(0, 50).map(student => (
              <div
                key={student.id}
                onClick={() => handleStudentSelect(student)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                  selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''
                }`}
              >
                <div className="font-semibold text-gray-900">{student.name}</div>
                <div className="text-sm text-gray-600">
                  Roll: {student.roll_number} | Class: {student.class}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Student Info */}
      {selectedStudent && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-semibold">{selectedStudent.name}</h3>
              <p className="text-gray-600">Roll: {selectedStudent.roll_number} | Class: {selectedStudent.class}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadPaymentHistory}
                className="px-4 py-2 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700"
              >
                View Payment History
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(true);
                  setActiveFeeTab('class-fee');
                  // Payment amount will be auto-filled by useEffect when modal opens
                  // using totalPending (which is already memoized)
                }}
                disabled={selectedComponents.length === 0}
                className={`px-4 py-2 rounded-lg font-semibold ${
                  selectedComponents.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Collect Payment ({selectedComponents.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading fee data...</div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Month</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Paid Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Pending Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Due Date</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border-b">Select</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {monthlyLedger.map((monthEntry, monthIdx) => 
                        monthEntry.components.map((comp, compIdx) => {
                          const isOverdue = comp.status === 'overdue' || 
                            (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                          const isFuture = isFutureMonth(monthEntry.year, monthEntry.monthNumber);
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
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {compIdx === 0 ? monthEntry.month : ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <div className="font-medium">{comp.fee_name}</div>
                                <div className="text-xs text-gray-500 capitalize">{comp.fee_type.replace('-', ' ')}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                ₹{comp.fee_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={comp.paid_amount > 0 ? 'text-green-600 font-semibold' : ''}>
                                  ₹{comp.paid_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">
                                <span className={comp.pending_amount > 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                                  ₹{comp.pending_amount.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(comp.status)}`}>
                                  {comp.status === 'paid' ? '🟢 PAID' : 
                                   isOverdue ? '🔴 OVERDUE' : 
                                   comp.status === 'partially-paid' ? '🟡 PARTIALLY PAID' : 
                                   isFuture ? '🔵 FUTURE' :
                                   '⚪ PENDING'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {comp.due_date ? new Date(comp.due_date).toLocaleDateString() : 'N/A'}
                                {isOverdue && comp.due_date && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {Math.floor((new Date().getTime() - new Date(comp.due_date).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                                  </div>
                                )}
                                {isFuture && (
                                  <div className="text-xs text-blue-600 mt-1">Future month</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedComponents.includes(comp.id)}
                                  onChange={() => handleComponentToggle(comp.id, monthEntry.year, monthEntry.monthNumber)}
                                  disabled={isDisabled}
                                  title={isFuture ? 'Future months require Principal approval' : (comp.status === 'paid' ? 'Already paid' : comp.pending_amount === 0 ? 'No pending amount' : '')}
                                  className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {monthlyLedger.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No fee data available for this student
                          </td>
                        </tr>
                      )}
                      {monthlyLedger.length > 0 && monthlyLedger.every(m => m.components.length === 0) && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            No fee components found
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
      )}

      {/* Enhanced Payment Modal */}
      {showPaymentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* 1. Header */}
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <div>
                <h3 className="text-2xl font-bold">Collect Fee</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedStudent.name} · {selectedStudent.class}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedComponents([]);
                  setActiveFeeTab('class-fee');
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* 2. Student Summary Section */}
            <div className="p-4 border-b bg-white">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Student:</span>
                    <span className="font-semibold ml-2">{selectedStudent.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Class:</span>
                    <span className="font-semibold ml-2">{selectedStudent.class}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Roll No:</span>
                    <span className="font-semibold ml-2">{selectedStudent.roll_number}</span>
                  </div>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-gray-600">Total Pending:</span>
                    <span className={`font-bold ml-2 ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{totalPending.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Transport:</span>
                    <span className="font-semibold ml-2">
                      {feeStructure?.transport_fee ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="font-semibold ml-2 text-green-600">Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* 3. Fee Components Tabs */}
              <div className="flex gap-2 mb-6 border-b">
                {feeStructure?.class_fee && (
                  <button
                    onClick={() => {
                      setActiveFeeTab('class-fee');
                      setSelectedComponents([]);
                    }}
                    className={`px-4 py-2 font-semibold border-b-2 transition ${
                      activeFeeTab === 'class-fee'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Class Fee
                  </button>
                )}
                {feeStructure?.transport_fee && (
                  <button
                    onClick={() => {
                      setActiveFeeTab('transport-fee');
                      setSelectedComponents([]);
                    }}
                    className={`px-4 py-2 font-semibold border-b-2 transition ${
                      activeFeeTab === 'transport-fee'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Transport Fee
                  </button>
                )}
                {feeStructure?.custom_fees && feeStructure.custom_fees.length > 0 && (
                  <button
                    onClick={() => {
                      setActiveFeeTab('custom-fee');
                      setSelectedComponents([]);
                    }}
                    className={`px-4 py-2 font-semibold border-b-2 transition ${
                      activeFeeTab === 'custom-fee'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Custom Fees ({feeStructure.custom_fees.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 4. Month-wise Fee Grid (Left - 2 columns) */}
                <div className="lg:col-span-2">
                  {activeTabInfo && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <div className="font-semibold text-blue-900">{activeTabInfo.name} – {activeTabInfo.cycle}</div>
                      <div className="text-sm text-blue-700">Per Month: ₹{activeTabInfo.amount.toFixed(2)}</div>
                    </div>
                  )}

                  {allPaidForActiveTab ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                      <p className="text-green-800 font-semibold text-lg">✅ All months paid for this category</p>
                      <p className="text-green-700 mt-2">No pending fees available.</p>
                    </div>
                  ) : activeTabByMonth.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                      <p className="text-gray-600">No fee data available for this category</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Select</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {activeTabByMonth.map((monthEntry) => 
                            monthEntry.components.map((comp, compIdx) => {
                              const isOverdue = comp.status === 'overdue' || 
                                (comp.due_date && new Date(comp.due_date) < new Date() && comp.status !== 'paid');
                              const isFuture = isFutureMonth(monthEntry.year, monthEntry.monthNumber);
                              const isDisabled = comp.status === 'paid' || comp.pending_amount === 0 || isFuture;
                              const statusColor = comp.status === 'paid' 
                                ? 'text-green-600' 
                                : isOverdue 
                                ? 'text-red-600' 
                                : comp.status === 'partially-paid'
                                ? 'text-yellow-600'
                                : 'text-gray-600';
                              const statusIcon = comp.status === 'paid' 
                                ? '🟢' 
                                : isOverdue 
                                ? '🔴' 
                                : comp.status === 'partially-paid'
                                ? '🟡'
                                : '⚪';
                              
                              return (
                                <tr 
                                  key={`${monthEntry.year}-${monthEntry.monthNumber}-${compIdx}`}
                                  className={`hover:bg-gray-50 ${comp.status === 'paid' ? 'bg-green-50' : isOverdue ? 'bg-red-50' : ''}`}
                                >
                                  <td className="px-4 py-3 text-sm font-medium">
                                    {compIdx === 0 ? monthEntry.month : ''}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className={statusColor}>
                                      {statusIcon} {comp.status === 'paid' ? 'Paid' : 
                                       isOverdue ? 'Overdue' : 
                                       comp.status === 'partially-paid' ? 'Partially Paid' : 
                                       'Pending'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-semibold">
                                    ₹{comp.fee_amount.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedComponents.includes(comp.id)}
                                      onChange={() => handleComponentToggle(comp.id, monthEntry.year, monthEntry.monthNumber)}
                                      disabled={isDisabled}
                                      className="w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 5. Selected Summary Panel (Right - 1 column) */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sticky top-4">
                    <h4 className="font-semibold mb-4">Payment Summary</h4>
                    
                    {selectedComponents.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Select months to collect payment
                      </p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-gray-600">Selected Months:</span>
                          <div className="mt-1 font-medium">
                            {selectedMonths.length > 0 ? selectedMonths.join(', ') : 'None'}
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex justify-between mb-2">
                            <span className="text-gray-600">Base Fee Total:</span>
                            <span className="font-semibold">₹{baseFeeTotal.toFixed(2)}</span>
                          </div>
                          {previousBalance > 0 && (
                            <div className="flex justify-between mb-2 text-orange-600">
                              <span>Previous Balance:</span>
                              <span>₹{previousBalance.toFixed(2)}</span>
                            </div>
                          )}
                          {lateFee > 0 && (
                            <div className="flex justify-between mb-2 text-red-600">
                              <span>Late Fee / Fine:</span>
                              <span>₹{lateFee.toFixed(2)}</span>
                            </div>
                          )}
                          {discount > 0 && (
                            <div className="flex justify-between mb-2 text-green-600">
                              <span>Discount:</span>
                              <span>-₹{discount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between">
                              <span className="font-semibold">Final Amount:</span>
                              <span className="font-bold text-lg text-blue-600">₹{finalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        {parseFloat(paymentForm.payment_amount || '0') < finalAmount && parseFloat(paymentForm.payment_amount || '0') > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
                            ⚠️ This will mark selected months as Partially Paid
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 6. Payment Details Section */}
              {selectedComponents.length > 0 && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="font-semibold mb-4">Payment Details</h4>
                  <form onSubmit={handlePaymentSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Payment Mode *</label>
                        <select
                          value={paymentForm.payment_mode}
                          onChange={(e) => setPaymentForm({...paymentForm, payment_mode: e.target.value as any})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="online">Online</option>
                          <option value="card">Card</option>
                          <option value="cheque">Cheque</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Payment Amount *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={totalPending}
                          value={paymentForm.payment_amount || (selectedComponents.length > 0 ? totalPending.toFixed(2) : '')}
                          onChange={(e) => {
                            // Optimized: Allow any input, validate only on blur/submit
                            setPaymentForm({...paymentForm, payment_amount: e.target.value});
                          }}
                          onBlur={(e) => {
                            // Validate on blur instead of every keystroke
                            const value = e.target.value;
                            const numValue = parseFloat(value);
                            if (value && (numValue < 0 || numValue > totalPending)) {
                              // Reset to totalPending if invalid
                              setPaymentForm({...paymentForm, payment_amount: totalPending.toFixed(2)});
                            }
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        />
                        <p className={`text-xs mt-1 ${parseFloat(paymentForm.payment_amount || '0') > totalPending ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          Max: ₹{totalPending.toFixed(2)} (Total Pending) {selectedComponents.length === 0 && '- Select months first'}
                        </p>
                        {parseFloat(paymentForm.payment_amount || '0') > totalPending && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Payment amount cannot exceed total pending amount
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Payment Date *</label>
                        <input
                          type="date"
                          value={paymentForm.payment_date}
                          onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          required
                        />
                      </div>

                      {(paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'card') && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Transaction ID</label>
                          <input
                            type="text"
                            value={paymentForm.transaction_id}
                            onChange={(e) => setPaymentForm({...paymentForm, transaction_id: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Enter transaction ID"
                          />
                        </div>
                      )}

                      {paymentForm.payment_mode === 'cheque' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-2">Cheque Number</label>
                            <input
                              type="text"
                              value={paymentForm.cheque_number}
                              onChange={(e) => setPaymentForm({...paymentForm, cheque_number: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Enter cheque number"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Bank Name</label>
                            <input
                              type="text"
                              value={paymentForm.bank_name}
                              onChange={(e) => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Enter bank name"
                            />
                          </div>
                        </>
                      )}

                      {paymentForm.payment_mode === 'bank_transfer' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Bank Name</label>
                          <input
                            type="text"
                            value={paymentForm.bank_name}
                            onChange={(e) => setPaymentForm({...paymentForm, bank_name: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            placeholder="Enter bank name"
                          />
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                        <textarea
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          rows={2}
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>

                    {/* 7. Footer Actions */}
                    <div className="flex justify-between items-center mt-6 pt-6 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setSelectedComponents([]);
                          setActiveFeeTab('class-fee');
                        }}
                        className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
                      >
                        Cancel
                      </button>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={processingPayment || selectedComponents.length === 0}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
                        >
                          {processingPayment ? 'Processing...' : 'Save & Print Receipt'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Payment Receipt</h3>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Print
              </button>
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setReceiptData(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
            
            <div className="border-2 border-gray-300 rounded-lg p-8 space-y-6 print:border-0">
              {/* Header */}
              <div className="text-center border-b-2 border-gray-400 pb-4">
                <h4 className="text-3xl font-bold mb-2">FEE PAYMENT RECEIPT</h4>
                <div className="space-y-1 text-gray-700">
                  <p className="font-semibold">Receipt No: {receiptData.receipt_number || receiptData.payment?.receipt_number}</p>
                  <p>Date: {new Date(receiptData.payment?.payment_date || receiptData.payment_date || new Date()).toLocaleDateString('en-IN', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>
              </div>
              
              {/* Student Details */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Student Name:</div>
                  <div className="text-lg">{selectedStudent?.name}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Roll Number:</div>
                  <div className="text-lg">{selectedStudent?.roll_number}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Class:</div>
                  <div className="text-lg">{selectedStudent?.class}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 mb-1">Payment Mode:</div>
                  <div className="text-lg uppercase">{receiptData.payment?.payment_mode || 'CASH'}</div>
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="border-t border-b border-gray-300 py-4">
                <h5 className="font-semibold mb-3 text-gray-700">Payment Details:</h5>
                <div className="space-y-2">
                  {(receiptData.selectedComponents || selectedComponentsData).map((comp: FeeComponent, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">{comp.fee_name}</span>
                      <span className="font-semibold">₹{comp.pending_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction Details */}
              {((receiptData.payment?.transaction_id) || (receiptData.payment?.cheque_number) || (receiptData.payment?.bank_name)) && (
                <div className="border-b border-gray-300 pb-4">
                  <h5 className="font-semibold mb-2 text-gray-700">Transaction Details:</h5>
                  {receiptData.payment?.transaction_id && (
                    <div className="text-sm">Transaction ID: {receiptData.payment.transaction_id}</div>
                  )}
                  {receiptData.payment?.cheque_number && (
                    <div className="text-sm">Cheque Number: {receiptData.payment.cheque_number}</div>
                  )}
                  {receiptData.payment?.bank_name && (
                    <div className="text-sm">Bank: {receiptData.payment.bank_name}</div>
                  )}
                </div>
              )}

              {/* Total Amount */}
              <div className="border-t-2 border-gray-400 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold">Total Amount Paid:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₹{receiptData.payment?.amount_paid?.toFixed(2) || 
                       receiptData.payment?.payment_amount?.toFixed(2) || 
                       (typeof receiptData.payment_amount === 'number' ? receiptData.payment_amount.toFixed(2) : '0.00')}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {receiptData.payment?.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-semibold text-sm text-gray-700 mb-1">Notes:</div>
                  <div className="text-sm text-gray-600">{receiptData.payment.notes}</div>
                </div>
              )}

              {/* Message */}
              {receiptData.message && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                  <div className="font-semibold mb-1">Note:</div>
                  {receiptData.message}
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-gray-300 pt-4 mt-8 text-center text-xs text-gray-500">
                <p>This is a computer-generated receipt.</p>
                <p className="mt-2">Collected by: Clerk</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {showPaymentHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Payment History - {selectedStudent?.name}</h3>
              <button
                onClick={() => {
                  setShowPaymentHistory(false);
                  setPaymentHistory([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No payment records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Fee Component</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Period</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Mode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Receipt No</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border-b">Collected By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentHistory.map((payment: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium">{payment.monthly_fee_components?.fee_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {payment.monthly_fee_components?.fee_type?.replace('-', ' ') || ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.monthly_fee_components?.period_month && payment.monthly_fee_components?.period_year
                            ? `${new Date(2000, payment.monthly_fee_components.period_month - 1).toLocaleString('default', { month: 'short' })} ${payment.monthly_fee_components.period_year}`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">
                          ₹{parseFloat(payment.payment_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm uppercase text-gray-600">
                          {payment.payment_mode}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.receipt_number || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {payment.received_by_profile?.full_name || 'Clerk'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-right">
                        Total Payments:
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        ₹{paymentHistory.reduce((sum: number, p: any) => sum + parseFloat(p.payment_amount || 0), 0).toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

