import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { API_URL } from '../utils/api';
export default function StudentDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [profile, setProfile] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [marks, setMarks] = useState([]);
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
            // Fees tab removed - billing feature disabled
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
            // All users are approved by default (principals add users directly)
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
                    // Student record not found - this might mean student record wasn't created properly
                    console.error('[StudentDashboard] Student record not found:', errorMessage);
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
            // Bills and payments removed - no longer loading
        }
        catch (error) {
            console.error('Error loading fees:', error);
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
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Marks" }), false && (_jsx("button", { onClick: () => setActiveTab('fees'), className: `px-6 py-3 font-medium ${activeTab === 'fees'
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'}`, children: "Fees" }))] }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-6", children: [activeTab === 'overview' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Overview" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Profile" }), _jsx("p", { className: "text-gray-600", children: profile.profiles?.full_name || 'N/A' }), _jsx("p", { className: "text-gray-600 text-sm", children: profile.profiles?.email || 'N/A' }), profile.roll_number && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Roll No: ", profile.roll_number] })), profile.class_groups && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Class: ", profile.class_groups.name] })), profile.sections && (_jsxs("p", { className: "text-gray-600 text-sm", children: ["Section: ", profile.sections.name] }))] }), attendanceSummary && (_jsxs("div", { className: "bg-green-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Attendance" }), _jsxs("p", { className: "text-3xl font-bold text-green-600", children: [attendanceSummary.attendancePercentage.toFixed(1), "%"] }), _jsxs("p", { className: "text-gray-600 text-sm mt-2", children: [attendanceSummary.presentDays, " present / ", attendanceSummary.totalDays, " total"] })] })), feeSummary && (_jsxs("div", { className: "bg-purple-50 rounded-lg p-6", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "Fees" }), _jsxs("p", { className: "text-3xl font-bold text-purple-600", children: ["\u20B9", feeSummary.totalPending.toLocaleString()] }), _jsxs("p", { className: "text-gray-600 text-sm mt-2", children: [feeSummary.totalPaid.toLocaleString(), " / ", feeSummary.totalAssigned.toLocaleString(), " paid"] })] }))] })] })), activeTab === 'attendance' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Attendance" }), attendanceSummary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Days" }), _jsx("p", { className: "text-2xl font-bold", children: attendanceSummary.totalDays })] }), _jsxs("div", { className: "bg-green-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Present" }), _jsx("p", { className: "text-2xl font-bold text-green-600", children: attendanceSummary.presentDays })] }), _jsxs("div", { className: "bg-red-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Absent" }), _jsx("p", { className: "text-2xl font-bold text-red-600", children: attendanceSummary.absentDays })] }), _jsxs("div", { className: "bg-yellow-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Percentage" }), _jsxs("p", { className: "text-2xl font-bold text-yellow-600", children: [attendanceSummary.attendancePercentage.toFixed(1), "%"] })] })] })), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: attendance.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: new Date(record.date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${record.status === 'present'
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
                                        }) }))] })), activeTab === 'fees' && (_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold mb-6", children: "Fees & Payments" }), _jsx("div", { className: "text-center py-12 text-gray-600", children: "Billing has been removed from this deployment." }), false && (_jsxs(_Fragment, { children: [feeSummary && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Assigned" }), _jsxs("p", { className: "text-2xl font-bold", children: ["\u20B9", feeSummary?.totalAssigned.toLocaleString() || '0'] })] }), _jsxs("div", { className: "bg-green-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Paid" }), _jsxs("p", { className: "text-2xl font-bold text-green-600", children: ["\u20B9", feeSummary?.totalPaid.toLocaleString() || '0'] })] }), _jsxs("div", { className: "bg-red-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Pending" }), _jsxs("p", { className: "text-2xl font-bold text-red-600", children: ["\u20B9", feeSummary?.totalPending.toLocaleString() || '0'] })] }), _jsxs("div", { className: "bg-yellow-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Transport Fee" }), _jsxs("p", { className: "text-2xl font-bold text-yellow-600", children: ["\u20B9", feeSummary?.transportFee.toLocaleString() || '0'] })] })] })), _jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Fee Bills" }), _jsx("div", { className: "text-center py-8 text-gray-500 bg-gray-50 rounded-lg", children: "Fee bills have been removed from this deployment." })] }), _jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "All Payments" }), _jsx("div", { className: "text-center py-8 text-gray-500 bg-gray-50 rounded-lg", children: "Payment tracking has been removed from this deployment." })] })] }))] }))] })] })] }));
}
