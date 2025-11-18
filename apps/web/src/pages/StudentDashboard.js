import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export default function StudentDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [profile, setProfile] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [marks, setMarks] = useState([]);
    const [bills, setBills] = useState([]);
    const [payments, setPayments] = useState([]);
    const [selectedBill, setSelectedBill] = useState(null);
    const [feeSummary, setFeeSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        loadProfile();
    }, []);
    useEffect(() => {
        if (activeTab === 'attendance') {
            loadAttendance();
        }
        else if (activeTab === 'marks') {
            loadMarks();
        }
        else if (activeTab === 'fees') {
            if (profile?.id) {
                loadFees();
            }
        }
    }, [activeTab, profile]);
    const loadProfile = async () => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                navigate('/login');
                return;
            }
            // First, check approval status via profile endpoint
            const profileResponse = await fetch(`${API_URL}/auth/profile`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                const approvalStatus = profileData.profile?.approval_status;
                const role = profileData.profile?.role;
                console.log('[StudentDashboard] Profile check:', { role, approval_status: approvalStatus });
                // If not approved, redirect to pending approval
                if (approvalStatus !== 'approved' && role !== 'principal') {
                    console.log('[StudentDashboard] Student not approved, redirecting to pending approval');
                    navigate('/pending-approval');
                    return;
                }
            }
            // Now try to load student profile
            const response = await fetch(`${API_URL}/students/profile`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load profile' }));
                const errorMessage = errorData.error || 'Failed to load profile';
                if (response.status === 404) {
                    // Student record not found - but profile is approved
                    // This might mean student record wasn't created properly
                    console.error('[StudentDashboard] Student record not found but profile is approved:', errorMessage);
                    // Don't redirect to pending-approval if already approved
                    // Just show an error message
                    setLoading(false);
                    return;
                }
                console.error('[StudentDashboard] Error loading student profile:', {
                    status: response.status,
                    error: errorMessage
                });
                throw new Error(errorMessage);
            }
            const data = await response.json();
            setProfile(data.student);
        }
        catch (error) {
            console.error('[StudentDashboard] Error loading profile:', error);
            // Don't redirect on error - just show error state
        }
        finally {
            setLoading(false);
        }
    };
    const loadAttendance = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                console.error('[StudentDashboard] No token available');
                return;
            }
            const response = await fetch(`${API_URL}/students/attendance`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('[StudentDashboard] Failed to load attendance:', errorData);
                throw new Error(errorData.error || 'Failed to load attendance');
            }
            const data = await response.json();
            console.log('[StudentDashboard] Attendance loaded:', {
                records: data.attendance?.length || 0,
                summary: data.summary
            });
            setAttendance(data.attendance || []);
            setAttendanceSummary(data.summary || null);
        }
        catch (error) {
            console.error('[StudentDashboard] Error loading attendance:', error);
            // Show user-friendly error message
            setAttendance([]);
            setAttendanceSummary(null);
        }
    };
    const loadMarks = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/students/marks`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error('Failed to load marks');
            const data = await response.json();
            setMarks(data.marks || []);
        }
        catch (error) {
            console.error('Error loading marks:', error);
        }
    };
    const loadFees = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get student ID from profile
            if (!profile?.id)
                return;
            const [billsRes, paymentsRes] = await Promise.all([
                fetch(`${API_URL}/fees/bills?student_id=${profile.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/fees/payments?student_id=${profile.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (billsRes.ok) {
                const billsData = await billsRes.json();
                setBills(billsData.bills || []);
                // Calculate summary
                const totalAssigned = (billsData.bills || []).reduce((sum, b) => sum + parseFloat(b.net_amount || 0), 0);
                const totalPaid = (billsData.bills || []).reduce((sum, b) => sum + parseFloat(b.total_paid || 0), 0);
                const totalPending = (billsData.bills || []).reduce((sum, b) => sum + parseFloat(b.balance || 0), 0);
                const transportFee = (billsData.bills || []).reduce((sum, b) => sum + parseFloat(b.transport_fee_total || 0), 0);
                setFeeSummary({
                    totalAssigned,
                    totalPaid,
                    totalPending,
                    transportFee
                });
            }
            if (paymentsRes.ok) {
                const paymentsData = await paymentsRes.json();
                setPayments(paymentsData.payments || []);
            }
        }
        catch (error) {
            console.error('Error loading fees:', error);
        }
    };
    const viewBill = async (billId) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/bills/${billId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSelectedBill(data.bill);
            }
        }
        catch (error) {
            console.error('Error loading bill details:', error);
        }
    };
    const downloadInvoice = (bill) => {
        const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${bill.bill_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .student-info, .bill-info { width: 48%; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
          th { background-color: #f2f2f2; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .summary { float: right; width: 300px; margin-top: 20px; }
          .summary div { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FEE INVOICE</h1>
          <h2>Bill Number: ${bill.bill_number}</h2>
        </div>
        <div class="invoice-details">
          <div class="student-info">
            <h3>Student Information</h3>
            <p><strong>Name:</strong> ${bill.students?.profile?.full_name || '-'}</p>
            <p><strong>Roll Number:</strong> ${bill.students?.roll_number || '-'}</p>
            <p><strong>Class:</strong> ${bill.students?.class_groups?.name || '-'}</p>
          </div>
          <div class="bill-info">
            <h3>Bill Information</h3>
            <p><strong>Bill Date:</strong> ${new Date(bill.bill_date).toLocaleDateString()}</p>
            <p><strong>Period:</strong> ${new Date(bill.bill_period_start).toLocaleDateString()} - ${new Date(bill.bill_period_end).toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${new Date(bill.due_date).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${bill.status}</p>
          </div>
        </div>
        <h3>Bill Items</h3>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${(bill.items || []).map((item) => `
              <tr>
                <td>${item.item_name}</td>
                <td class="text-right">${item.amount < 0 ? '-' : ''}₹${Math.abs(parseFloat(item.amount || 0)).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="summary">
          <div><span>Class Fees:</span><span>₹${parseFloat(bill.class_fees_total || 0).toLocaleString()}</span></div>
          ${bill.transport_fee_total > 0 ? `<div><span>Transport Fee:</span><span>₹${parseFloat(bill.transport_fee_total || 0).toLocaleString()}</span></div>` : ''}
          ${bill.optional_fees_total > 0 ? `<div><span>Optional Fees:</span><span>₹${parseFloat(bill.optional_fees_total || 0).toLocaleString()}</span></div>` : ''}
          ${bill.custom_fees_total !== 0 ? `<div><span>Custom Fees:</span><span>${bill.custom_fees_total < 0 ? '-' : '+'}₹${Math.abs(parseFloat(bill.custom_fees_total || 0)).toLocaleString()}</span></div>` : ''}
          ${bill.fine_total > 0 ? `<div><span>Fine:</span><span>₹${parseFloat(bill.fine_total || 0).toLocaleString()}</span></div>` : ''}
          <div class="total-row"><span>Gross Amount:</span><span>₹${parseFloat(bill.gross_amount || 0).toLocaleString()}</span></div>
          ${bill.discount_amount > 0 ? `<div><span>Discount:</span><span>-₹${parseFloat(bill.discount_amount || 0).toLocaleString()}</span></div>` : ''}
          ${bill.scholarship_amount > 0 ? `<div><span>Scholarship:</span><span>-₹${parseFloat(bill.scholarship_amount || 0).toLocaleString()}</span></div>` : ''}
          <div class="total-row" style="font-size: 1.2em; border-top: 2px solid #000; padding-top: 10px;">
            <span>Net Amount:</span><span>₹${parseFloat(bill.net_amount || 0).toLocaleString()}</span>
          </div>
          <div><span>Paid:</span><span>₹${parseFloat(bill.total_paid || 0).toLocaleString()}</span></div>
          <div class="total-row" style="border-top: 2px solid #000; padding-top: 10px;">
            <span>Balance:</span><span>₹${parseFloat(bill.balance || 0).toLocaleString()}</span>
          </div>
        </div>
        ${bill.payments && bill.payments.length > 0 ? `
          <h3 style="clear: both; margin-top: 50px;">Payment History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment Number</th>
                <th>Amount</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${bill.payments.map((payment) => `
                <tr>
                  <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td>${payment.payment_number}</td>
                  <td>₹${parseFloat(payment.amount_paid || 0).toLocaleString()}</td>
                  <td>${payment.payment_mode}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </body>
      </html>
    `;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    if (loading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    if (!profile) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Profile not found" }), _jsx("button", { onClick: () => navigate('/login'), className: "mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Go to Login" })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("header", { className: "bg-white shadow-sm border-b", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Student Dashboard" }), _jsxs("p", { className: "text-gray-600", children: [profile.profiles?.full_name || 'Student', profile.roll_number && ` • Roll No: ${profile.roll_number}`, profile.class_groups && ` • ${profile.class_groups.name}`, profile.sections && ` - ${profile.sections.name}`] })] }), _jsx("button", { onClick: handleLogout, className: "bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Logout" })] }) }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", children: [_jsx("div", { className: "bg-white rounded-lg shadow-sm mb-6", children: _jsxs("div", { className: "flex border-b", children: [_jsx("button", { onClick: () => setActiveTab('overview'), className: `px-6 py-3 font-medium ${activeTab === 'overview'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Overview" }), _jsx("button", { onClick: () => setActiveTab('attendance'), className: `px-6 py-3 font-medium ${activeTab === 'attendance'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Attendance" }), _jsx("button", { onClick: () => setActiveTab('marks'), className: `px-6 py-3 font-medium ${activeTab === 'marks'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Marks" }), _jsx("button", { onClick: () => setActiveTab('fees'), className: `px-6 py-3 font-medium ${activeTab === 'fees'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Fees" })] }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-6", children: [activeTab === 'overview' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Overview" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Profile" }), _jsx("p", { className: "text-gray-600", children: profile.profiles?.full_name || 'N/A' }), _jsx("p", { className: "text-gray-600 text-sm", children: profile.profiles?.email || 'N/A' }), profile.roll_number && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Roll No: ", profile.roll_number] })), profile.class_groups && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Class: ", profile.class_groups.name] })), profile.sections && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Section: ", profile.sections.name] }))] }), attendanceSummary && (_jsxs("div", { className: "bg-green-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Attendance" }), _jsxs("p", { className: "text-3xl font-bold text-green-600", children: [attendanceSummary.attendancePercentage.toFixed(1), "%"] }), _jsxs("p", { className: "text-gray-600 text-sm mt-2", children: [attendanceSummary.presentDays, " present / ", attendanceSummary.totalDays, " total"] })] })), feeSummary && (_jsxs("div", { className: "bg-purple-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Fees" }), _jsxs("p", { className: "text-3xl font-bold text-purple-600", children: ["\u20B9", feeSummary.totalPending.toLocaleString()] }), _jsxs("p", { className: "text-gray-600 text-sm mt-2", children: [feeSummary.totalPaid.toLocaleString(), " / ", feeSummary.totalAssigned.toLocaleString(), " paid"] })] }))] })] })), activeTab === 'attendance' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Attendance" }), attendanceSummary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Days" }), _jsx("p", { className: "text-2xl font-bold", children: attendanceSummary.totalDays })] }), _jsxs("div", { className: "bg-green-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Present" }), _jsx("p", { className: "text-2xl font-bold text-green-600", children: attendanceSummary.presentDays })] }), _jsxs("div", { className: "bg-red-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Absent" }), _jsx("p", { className: "text-2xl font-bold text-red-600", children: attendanceSummary.absentDays })] }), _jsxs("div", { className: "bg-yellow-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Percentage" }), _jsxs("p", { className: "text-2xl font-bold text-yellow-600", children: [attendanceSummary.attendancePercentage.toFixed(1), "%"] })] })] })), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: attendance.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: new Date(record.date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${record.status === 'present'
                                                                            ? 'bg-green-100 text-green-800'
                                                                            : record.status === 'late'
                                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                                : 'bg-red-100 text-red-800'}`, children: record.status }) })] }, record.id))) })] }), attendance.length === 0 && (_jsx("div", { className: "text-center py-12 text-gray-500", children: "No attendance records yet." }))] })] })), activeTab === 'marks' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Marks & Grades" }), marks.length === 0 ? (_jsxs("div", { className: "text-center py-12 text-gray-500", children: [_jsx("p", { className: "mb-2", children: "No verified marks available yet." }), _jsx("p", { className: "text-sm text-gray-400", children: "Marks will appear here once they are verified by the principal or clerk." })] })) : (_jsx("div", { className: "space-y-6", children: marks.map((examMark, index) => {
                                            // Calculate totals if not provided
                                            const total = examMark.total ?? examMark.subjects.reduce((sum, s) => sum + s.marks_obtained, 0);
                                            const totalMax = examMark.totalMax ?? examMark.subjects.reduce((sum, s) => sum + s.max_marks, 0);
                                            const average = examMark.average ?? (examMark.subjects.length > 0 ? total / examMark.subjects.length : 0);
                                            const percentage = parseFloat(examMark.overallPercentage) || (totalMax > 0 ? (total / totalMax) * 100 : 0);
                                            const grade = examMark.grade ?? (percentage >= 90 ? 'A+' :
                                                percentage >= 80 ? 'A' :
                                                    percentage >= 70 ? 'B+' :
                                                        percentage >= 60 ? 'B' :
                                                            percentage >= 50 ? 'C+' :
                                                                percentage >= 40 ? 'C' :
                                                                    'F');
                                            return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold", children: examMark.exam.name }), _jsx("p", { className: "text-gray-600", children: examMark.exam.term }), _jsxs("p", { className: "text-sm text-gray-500 mt-1", children: [new Date(examMark.exam.start_date).toLocaleDateString(), " - ", new Date(examMark.exam.end_date).toLocaleDateString()] })] }), _jsx("div", { className: "text-right", children: _jsxs("div", { className: "grid grid-cols-2 gap-4 text-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "Total" }), _jsxs("p", { className: "text-lg font-bold text-gray-900", children: [total.toFixed(0), " / ", totalMax.toFixed(0)] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "Average" }), _jsx("p", { className: "text-lg font-bold text-gray-900", children: average.toFixed(2) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "Percentage" }), _jsxs("p", { className: "text-lg font-bold text-blue-600", children: [percentage.toFixed(2), "%"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-600", children: "Grade" }), _jsx("p", { className: "text-lg font-bold text-green-600", children: grade })] })] }) })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Subject" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Marks Obtained" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Max Marks" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Percentage" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: examMark.subjects.map((subjectMark, idx) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: [subjectMark.subject.name, subjectMark.subject.code && (_jsxs("span", { className: "text-gray-500", children: [" (", subjectMark.subject.code, ")"] }))] }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900", children: subjectMark.marks_obtained }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-900", children: subjectMark.max_marks }), _jsxs("td", { className: "px-4 py-3 text-sm text-gray-900", children: [subjectMark.percentage, "%"] })] }, idx))) })] }) })] }, index));
                                        }) }))] })), activeTab === 'fees' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Fees & Payments" }), feeSummary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Assigned" }), _jsxs("p", { className: "text-2xl font-bold", children: ["\u20B9", feeSummary.totalAssigned.toLocaleString()] })] }), _jsxs("div", { className: "bg-green-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Paid" }), _jsxs("p", { className: "text-2xl font-bold text-green-600", children: ["\u20B9", feeSummary.totalPaid.toLocaleString()] })] }), _jsxs("div", { className: "bg-red-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Pending" }), _jsxs("p", { className: "text-2xl font-bold text-red-600", children: ["\u20B9", feeSummary.totalPending.toLocaleString()] })] }), _jsxs("div", { className: "bg-yellow-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Transport Fee" }), _jsxs("p", { className: "text-2xl font-bold text-yellow-600", children: ["\u20B9", feeSummary.transportFee.toLocaleString()] })] })] })), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Fee Bills" }), bills.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500 bg-gray-50 rounded-lg", children: "No bills found." })) : (_jsx("div", { className: "space-y-4", children: bills.map((bill) => (_jsxs("div", { className: `border rounded-lg p-6 ${bill.status === 'overdue' ? 'border-red-300 bg-red-50' :
                                                        bill.status === 'paid' ? 'border-green-300 bg-green-50' :
                                                            bill.status === 'partially-paid' ? 'border-yellow-300 bg-yellow-50' :
                                                                'border-gray-200'}`, children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-xl font-bold", children: ["Bill: ", bill.bill_number] }), _jsxs("p", { className: "text-gray-600", children: ["Period: ", new Date(bill.bill_period_start).toLocaleDateString(), " - ", new Date(bill.bill_period_end).toLocaleDateString()] }), _jsxs("p", { className: "text-gray-600 text-sm mt-1", children: ["Due Date: ", new Date(bill.due_date).toLocaleDateString()] }), _jsxs("p", { className: "text-gray-600 text-sm mt-2", children: ["Net Amount: \u20B9", parseFloat(bill.net_amount || 0).toLocaleString()] }), bill.transport_fee_total > 0 && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Transport Fee: \u20B9", parseFloat(bill.transport_fee_total || 0).toLocaleString()] })), bill.discount_amount > 0 && (_jsxs("p", { className: "text-green-600 text-sm", children: ["Discount: -\u20B9", parseFloat(bill.discount_amount || 0).toLocaleString()] })), bill.scholarship_amount > 0 && (_jsxs("p", { className: "text-green-600 text-sm", children: ["Scholarship: -\u20B9", parseFloat(bill.scholarship_amount || 0).toLocaleString()] }))] }), _jsxs("div", { className: "text-right", children: [_jsx("span", { className: `px-3 py-1 rounded-full text-sm font-medium ${bill.status === 'paid'
                                                                                ? 'bg-green-100 text-green-800'
                                                                                : bill.status === 'overdue'
                                                                                    ? 'bg-red-100 text-red-800'
                                                                                    : bill.status === 'partially-paid'
                                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                                        : 'bg-gray-100 text-gray-800'}`, children: bill.status || 'Pending' }), _jsxs("p", { className: "text-sm text-gray-600 mt-2", children: ["Paid: \u20B9", parseFloat(bill.total_paid || 0).toLocaleString(), " / \u20B9", parseFloat(bill.net_amount || 0).toLocaleString()] }), bill.balance > 0 && (_jsxs("p", { className: "text-sm text-red-600 mt-1 font-semibold", children: ["Balance: \u20B9", parseFloat(bill.balance || 0).toLocaleString()] }))] })] }), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsx("button", { onClick: () => viewBill(bill.id), className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm", children: "View Details" }), _jsx("button", { onClick: () => downloadInvoice(bill), className: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm", children: "Download/Print" }), bill.balance > 0 && (_jsx("button", { className: "px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm", onClick: () => alert('Online payment integration coming soon!'), children: "Pay Online" }))] }), bill.payments && bill.payments.length > 0 && (_jsxs("div", { className: "mt-4", children: [_jsx("h4", { className: "font-semibold mb-2", children: "Payment History" }), _jsx("div", { className: "space-y-2", children: bill.payments.map((payment) => (_jsxs("div", { className: "bg-white rounded p-3 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString(), " on", ' ', new Date(payment.payment_date).toLocaleDateString()] }), _jsx("span", { className: "text-gray-600", children: payment.payment_mode })] }), payment.transaction_id && (_jsxs("p", { className: "text-gray-500 text-xs mt-1", children: ["Txn ID: ", payment.transaction_id] }))] }, payment.id))) })] }))] }, bill.id))) }))] }), payments.length > 0 && (_jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "All Payments" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Number" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bill Number" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: payments.map((payment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: new Date(payment.payment_date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 font-medium", children: payment.payment_number }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: payment.payment_mode }), _jsx("td", { className: "px-6 py-4", children: payment.fee_bills?.bill_number || '-' })] }, payment.id))) })] }) })] }))] }))] })] }), selectedBill && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-2xl font-bold", children: "Bill Details" }), _jsx("button", { onClick: () => setSelectedBill(null), className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-gray-50 rounded-lg p-4", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Bill Number" }), _jsx("p", { className: "font-semibold", children: selectedBill.bill_number })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Period" }), _jsxs("p", { className: "font-semibold", children: [new Date(selectedBill.bill_period_start).toLocaleDateString(), " - ", new Date(selectedBill.bill_period_end).toLocaleDateString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Due Date" }), _jsx("p", { className: "font-semibold", children: new Date(selectedBill.due_date).toLocaleDateString() })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Status" }), _jsx("span", { className: `px-2 py-1 rounded text-xs font-semibold ${selectedBill.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                            selectedBill.status === 'partially-paid' ? 'bg-yellow-100 text-yellow-800' :
                                                                selectedBill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'}`, children: selectedBill.status })] })] }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Bill Items" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Item" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedBill.items && selectedBill.items.length > 0 ? (selectedBill.items.map((item, index) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: item.item_name }), _jsxs("td", { className: `px-6 py-4 text-right font-semibold ${item.amount < 0 ? 'text-green-600' : 'text-gray-900'}`, children: [item.amount < 0 ? '-' : '', "\u20B9", Math.abs(parseFloat(item.amount || 0)).toLocaleString()] })] }, index)))) : (_jsx("tr", { children: _jsx("td", { colSpan: 2, className: "px-6 py-4 text-center text-gray-500", children: "No items found" }) })) })] }) })] }), _jsx("div", { className: "bg-gray-50 rounded-lg p-4", children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Class Fees:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.class_fees_total || 0).toLocaleString()] })] }), selectedBill.transport_fee_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Transport Fee:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.transport_fee_total || 0).toLocaleString()] })] })), selectedBill.optional_fees_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Optional Fees:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.optional_fees_total || 0).toLocaleString()] })] })), selectedBill.custom_fees_total !== 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Custom Fees:" }), _jsxs("span", { className: `font-semibold ${selectedBill.custom_fees_total < 0 ? 'text-green-600' : ''}`, children: [selectedBill.custom_fees_total < 0 ? '-' : '+', "\u20B9", Math.abs(parseFloat(selectedBill.custom_fees_total || 0)).toLocaleString()] })] })), selectedBill.fine_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Fine:" }), _jsxs("span", { className: "font-semibold text-red-600", children: ["+\u20B9", parseFloat(selectedBill.fine_total || 0).toLocaleString()] })] })), _jsxs("div", { className: "border-t border-gray-300 pt-2 flex justify-between", children: [_jsx("span", { className: "font-semibold", children: "Gross Amount:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.gross_amount || 0).toLocaleString()] })] }), selectedBill.discount_amount > 0 && (_jsxs("div", { className: "flex justify-between text-green-600", children: [_jsx("span", { children: "Discount:" }), _jsxs("span", { className: "font-semibold", children: ["-\u20B9", parseFloat(selectedBill.discount_amount || 0).toLocaleString()] })] })), selectedBill.scholarship_amount > 0 && (_jsxs("div", { className: "flex justify-between text-green-600", children: [_jsx("span", { children: "Scholarship:" }), _jsxs("span", { className: "font-semibold", children: ["-\u20B9", parseFloat(selectedBill.scholarship_amount || 0).toLocaleString()] })] })), _jsxs("div", { className: "border-t-2 border-gray-400 pt-2 flex justify-between text-lg", children: [_jsx("span", { className: "font-bold", children: "Net Amount:" }), _jsxs("span", { className: "font-bold", children: ["\u20B9", parseFloat(selectedBill.net_amount || 0).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Paid:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.total_paid || 0).toLocaleString()] })] }), _jsxs("div", { className: "border-t border-gray-300 pt-2 flex justify-between text-lg", children: [_jsx("span", { className: "font-bold", children: "Balance:" }), _jsxs("span", { className: `font-bold ${parseFloat(selectedBill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`, children: ["\u20B9", parseFloat(selectedBill.balance || 0).toLocaleString()] })] })] }) }), selectedBill.payments && selectedBill.payments.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Payment History" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Number" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Transaction ID" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedBill.payments.map((payment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: new Date(payment.payment_date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 font-medium", children: payment.payment_number }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: payment.payment_mode }), _jsx("td", { className: "px-6 py-4", children: payment.transaction_id || '-' })] }, payment.id))) })] }) })] })), _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { onClick: () => downloadInvoice(selectedBill), className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Download/Print Invoice" }), selectedBill.balance > 0 && (_jsx("button", { className: "flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700", onClick: () => alert('Online payment integration coming soon!'), children: "Pay Online" }))] })] })] }) }))] }));
}
