import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { API_URL } from '../utils/api';
import UnpaidFeeAnalytics from '../components/UnpaidFeeAnalytics';
import TeacherPaymentHistory from '../components/TeacherPaymentHistory';
function Sidebar({ currentPath }) {
    const navigate = useNavigate();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    const navItems = [
        { path: '/principal/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/principal/staff', label: 'Staff Management', icon: '👥' },
        { path: '/principal/classifications', label: 'Classifications', icon: '🏷️' },
        { path: '/principal/classes', label: 'Classes', icon: '🏫' },
        { path: '/principal/subjects', label: 'Subjects', icon: '📚' },
        { path: '/principal/students', label: 'Students', icon: '🎓' },
        { path: '/principal/exams', label: 'Exams', icon: '📝' },
        { path: '/principal/salary', label: 'Salary Management', icon: '💰' },
        { path: '/principal/fees', label: 'Fee Management', icon: '💵' },
    ];
    const filteredNav = navItems;
    return (_jsxs("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: [_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsx("nav", { className: "space-y-2", children: filteredNav.map((item) => (_jsxs(Link, { to: item.path, className: `flex items-center space-x-3 px-4 py-3 rounded-lg transition ${currentPath === item.path
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800'}`, children: [_jsx("span", { children: item.icon }), _jsx("span", { children: item.label })] }, item.path))) })] }), _jsx("div", { className: "absolute bottom-0 w-full p-6", children: _jsx("button", { onClick: handleLogout, className: "w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition", children: "Logout" }) })] }));
}
const createEmptyBreakdown = () => ({
    total: 0,
    male: 0,
    female: 0,
    other: 0,
    unknown: 0,
});
const normalizeGenderKey = (value) => {
    if (!value)
        return 'unknown';
    const normalized = value.trim().toLowerCase();
    if (['male', 'm', 'boy', 'boys'].includes(normalized))
        return 'male';
    if (['female', 'f', 'girl', 'girls'].includes(normalized))
        return 'female';
    if (normalized.length > 0 && normalized !== 'male' && normalized !== 'female')
        return 'other';
    return 'unknown';
};
const buildGenderBreakdown = (values) => {
    const breakdown = createEmptyBreakdown();
    values.forEach((value) => {
        const key = normalizeGenderKey(value);
        breakdown.total += 1;
        breakdown[key] += 1;
    });
    return breakdown;
};
const hydrateBreakdown = (incoming) => ({
    total: incoming?.total ?? 0,
    male: incoming?.male ?? 0,
    female: incoming?.female ?? 0,
    other: incoming?.other ?? 0,
    unknown: incoming?.unknown ?? 0,
});
function DoughnutChart({ title, breakdown, colors = {
    male: '#3B82F6', // blue
    female: '#EC4899', // pink
    other: '#10B981', // green
    unknown: '#9CA3AF', // gray
} }) {
    const size = 200;
    const strokeWidth = 40;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;
    const data = [
        { label: 'Male', value: breakdown.male, color: colors.male },
        { label: 'Female', value: breakdown.female, color: colors.female },
        { label: 'Other', value: breakdown.other, color: colors.other },
        { label: 'Not Specified', value: breakdown.unknown, color: colors.unknown },
    ].filter(item => item.value > 0);
    // Calculate angles and paths for each segment
    let currentAngle = -90; // Start at top (12 o'clock)
    const segments = data.map((item) => {
        const percentage = breakdown.total > 0 ? (item.value / breakdown.total) : 0;
        const angle = percentage * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;
        // Calculate arc path
        const startAngleRad = (startAngle * Math.PI) / 180;
        const endAngleRad = (endAngle * Math.PI) / 180;
        const x1 = center + radius * Math.cos(startAngleRad);
        const y1 = center + radius * Math.sin(startAngleRad);
        const x2 = center + radius * Math.cos(endAngleRad);
        const y2 = center + radius * Math.sin(endAngleRad);
        const largeArcFlag = angle > 180 ? 1 : 0;
        const pathData = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
            'Z',
        ].join(' ');
        return {
            ...item,
            percentage,
            pathData,
        };
    });
    return (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-700 mb-4", children: title }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("div", { className: "relative", style: { width: size, height: size }, children: [_jsxs("svg", { width: size, height: size, children: [segments.map((segment, index) => (_jsx("path", { d: segment.pathData, fill: segment.color, className: "transition-all duration-500" }, index))), breakdown.total === 0 && (_jsx("circle", { cx: center, cy: center, r: radius, fill: "none", stroke: "#E5E7EB", strokeWidth: strokeWidth })), _jsx("circle", { cx: center, cy: center, r: radius - strokeWidth, fill: "white" })] }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-3xl font-bold text-gray-900", children: breakdown.total }), _jsx("div", { className: "text-xs text-gray-500 mt-1", children: "Total" })] }) })] }), _jsx("div", { className: "mt-6 w-full max-w-xs", children: _jsx("div", { className: "grid grid-cols-2 gap-3", children: data.map((item, index) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full flex-shrink-0", style: { backgroundColor: item.color } }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-gray-700 truncate", children: item.label }), _jsxs("div", { className: "text-xs text-gray-500", children: [item.value, " (", breakdown.total > 0 ? ((item.value / breakdown.total) * 100).toFixed(1) : 0, "%)"] })] })] }, index))) }) })] })] }));
}
function DashboardOverview() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalStaff: 0,
        totalClasses: 0,
        studentsByGender: createEmptyBreakdown(),
        staffByGender: createEmptyBreakdown(),
    });
    const [loading, setLoading] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [joinCodeCopied, setJoinCodeCopied] = useState(false);
    useEffect(() => {
        const loadDashboardData = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) {
                    console.error('Error getting user:', userError);
                    return;
                }
                if (!user) {
                    console.log('No user found');
                    return;
                }
                // Get user profile to get school_id
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('school_id')
                    .eq('id', user.id)
                    .single();
                if (profileError) {
                    console.error('Error loading profile:', profileError);
                    return;
                }
                if (!profile || !('school_id' in profile) || !profile.school_id) {
                    console.log('No profile or school_id found');
                    return;
                }
                const schoolId = profile.school_id;
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const loadSchoolInfoFromSupabase = async () => {
                    try {
                        const { data: school, error: schoolError } = await supabase
                            .from('schools')
                            .select('id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at')
                            .eq('id', schoolId)
                            .maybeSingle(); // Use maybeSingle() instead of single() to handle no results gracefully
                        if (!schoolError && school) {
                            console.log('School data loaded from Supabase fallback:', school);
                            setSchoolInfo(school);
                        }
                        else if (schoolError) {
                            console.error('Error loading school from Supabase:', schoolError);
                            // Don't throw, just log - school info is optional
                        }
                    }
                    catch (supabaseError) {
                        console.error('Error in Supabase query:', supabaseError);
                        // Don't throw - school info is optional
                    }
                };
                const loadSchoolInfo = async () => {
                    if (!token) {
                        await loadSchoolInfoFromSupabase();
                        return;
                    }
                    try {
                        const response = await fetch(`${API_URL}/school/info`, {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                        });
                        if (response.ok) {
                            try {
                                const data = await response.json();
                                // Handle both { school: {...} } and direct school object
                                const schoolData = data.school || data;
                                if (schoolData && typeof schoolData === 'object' && !Array.isArray(schoolData)) {
                                    console.log('School data loaded from API:', schoolData);
                                    setSchoolInfo(schoolData);
                                }
                                else {
                                    console.warn('Unexpected school data format:', data);
                                    await loadSchoolInfoFromSupabase();
                                }
                            }
                            catch (jsonError) {
                                console.error('Error parsing school JSON:', jsonError);
                                await loadSchoolInfoFromSupabase();
                            }
                        }
                        else {
                            const errorText = await response.text();
                            console.error('Error loading school from API:', response.status, errorText);
                            await loadSchoolInfoFromSupabase();
                        }
                    }
                    catch (apiError) {
                        console.error('Error loading school from API:', apiError);
                        await loadSchoolInfoFromSupabase();
                    }
                };
                const loadStatsFallback = async () => {
                    try {
                        const [studentRows, staffRows, classesCount] = await Promise.all([
                            supabase
                                .from('students')
                                .select('id, status, profile:profiles!students_profile_id_fkey(gender)')
                                .eq('school_id', schoolId)
                                .eq('status', 'active'),
                            supabase
                                .from('profiles')
                                .select('id, gender')
                                .eq('school_id', schoolId)
                                .in('role', ['principal', 'clerk', 'teacher'])
                                .eq('approval_status', 'approved'),
                            supabase
                                .from('class_groups')
                                .select('id', { count: 'exact', head: true })
                                .eq('school_id', schoolId)
                        ]);
                        if (studentRows.error)
                            throw studentRows.error;
                        if (staffRows.error)
                            throw staffRows.error;
                        if (classesCount.error)
                            throw classesCount.error;
                        const studentGenders = buildGenderBreakdown((studentRows.data || []).map((student) => {
                            const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
                            return profile?.gender;
                        }));
                        const staffGenders = buildGenderBreakdown((staffRows.data || []).map((member) => member.gender));
                        setStats({
                            totalStudents: studentGenders.total,
                            totalStaff: staffGenders.total,
                            totalClasses: classesCount.count || 0,
                            studentsByGender: studentGenders,
                            staffByGender: staffGenders,
                        });
                    }
                    catch (fallbackError) {
                        console.error('Error loading fallback stats:', fallbackError);
                    }
                };
                const loadStats = async () => {
                    if (!token) {
                        await loadStatsFallback();
                        return;
                    }
                    try {
                        const response = await fetch(`${API_URL}/dashboard/stats`, {
                            headers: {
                                Authorization: `Bearer ${token}`,
                            },
                        });
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('Error loading dashboard stats:', errorText);
                            await loadStatsFallback();
                            return;
                        }
                        const data = await response.json();
                        const payload = data?.stats;
                        setStats({
                            totalStudents: payload?.totalStudents ?? 0,
                            totalStaff: payload?.totalStaff ?? 0,
                            totalClasses: payload?.totalClasses ?? 0,
                            studentsByGender: hydrateBreakdown(payload?.studentsByGender),
                            staffByGender: hydrateBreakdown(payload?.staffByGender),
                        });
                    }
                    catch (statsError) {
                        console.error('Error loading dashboard stats:', statsError);
                        await loadStatsFallback();
                    }
                };
                await loadSchoolInfo();
                await loadStats();
            }
            catch (error) {
                console.error('Error loading dashboard:', error);
            }
            finally {
                setLoading(false);
            }
        };
        loadDashboardData();
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, []);
    if (loading) {
        return _jsx("div", { className: "p-6", children: "Loading..." });
    }
    const copyJoinCode = async () => {
        if (schoolInfo?.join_code) {
            try {
                await navigator.clipboard.writeText(schoolInfo.join_code);
                setJoinCodeCopied(true);
                setTimeout(() => setJoinCodeCopied(false), 2000);
            }
            catch (err) {
                console.error('Failed to copy join code:', err);
                // Fallback: select the text
                const textArea = document.createElement('textarea');
                textArea.value = schoolInfo.join_code;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setJoinCodeCopied(true);
                setTimeout(() => setJoinCodeCopied(false), 2000);
            }
        }
    };
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-6", children: [schoolInfo && (_jsxs("div", { className: "relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 mb-6 shadow-2xl", children: [_jsx("div", { className: "absolute inset-0 bg-black opacity-10" }), _jsxs("div", { className: "relative z-10", children: [_jsxs("h1", { className: "text-4xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg", children: ["Welcome to", ' ', _jsx("span", { className: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200 animate-pulse", children: schoolInfo.name })] }), _jsxs("div", { className: "flex flex-wrap gap-4 mt-4 text-sm", children: [schoolInfo.join_code && (_jsxs("div", { className: "flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg", children: [_jsx("span", { className: "font-medium text-white", children: "School Code:" }), _jsx("span", { className: "font-mono font-bold text-yellow-200", children: schoolInfo.join_code })] })), schoolInfo.registration_number && (_jsxs("div", { className: "flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg", children: [_jsx("span", { className: "font-medium text-white", children: "Registration No:" }), _jsx("span", { className: "font-bold text-yellow-200", children: schoolInfo.registration_number })] }))] })] }), _jsx("div", { className: "absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" }), _jsx("div", { className: "absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" })] })), _jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Dashboard" })] }), schoolInfo && (_jsx("div", { className: "bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "School Join Code" }), _jsx("p", { className: "text-sm opacity-90 mb-3", children: "Share this code with teachers, students, and parents so they can join your school" }), schoolInfo.join_code ? (_jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("code", { className: "text-2xl font-bold bg-white/20 px-4 py-2 rounded-lg font-mono", children: schoolInfo.join_code }), _jsx("button", { onClick: copyJoinCode, className: "bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2", children: joinCodeCopied ? (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: "Copied!" })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsx("span", { children: "Copy Code" })] })) })] })) : (_jsxs("div", { className: "bg-white/20 rounded-lg p-4", children: [_jsx("p", { className: "text-white font-semibold mb-2", children: "\u26A0\uFE0F Join Code Not Found" }), _jsx("p", { className: "text-sm opacity-90", children: "Your school join code is missing. Please contact support or check your school settings." }), _jsxs("p", { className: "text-xs opacity-75 mt-2", children: ["School ID: ", schoolInfo.id] })] }))] }), _jsx("div", { className: "text-6xl opacity-20 ml-4", children: "\uD83D\uDD11" })] }) })), process.env.NODE_ENV === 'development' && schoolInfo && (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm", children: [_jsx("p", { className: "font-semibold text-yellow-800 mb-2", children: "Debug Info:" }), _jsx("pre", { className: "text-xs text-yellow-700 overflow-auto", children: JSON.stringify({ schoolInfo, hasJoinCode: !!schoolInfo?.join_code }, null, 2) })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-8", children: [_jsx(DoughnutChart, { title: "Student Gender Breakdown", breakdown: stats.studentsByGender, colors: {
                            male: '#3B82F6', // blue
                            female: '#EC4899', // pink
                            other: '#10B981', // green
                            unknown: '#9CA3AF', // gray
                        } }), _jsx(DoughnutChart, { title: "Staff Gender Breakdown", breakdown: stats.staffByGender, colors: {
                            male: '#3B82F6', // blue
                            female: '#EC4899', // pink
                            other: '#10B981', // green
                            unknown: '#9CA3AF', // gray
                        } })] }), _jsx(UnpaidFeeAnalytics, { userRole: "principal" })] }));
}
function StaffManagement() {
    // Ref to track if component is mounted (for async operations)
    const isMountedRef = useRef(true);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [sections, setSections] = useState({});
    const [allAssignments, setAllAssignments] = useState([]);
    // Search and filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionMenuOpen, setActionMenuOpen] = useState({});
    // Modal states
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [dailyAttendanceModalOpen, setDailyAttendanceModalOpen] = useState(false);
    const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [viewAssignmentsModalOpen, setViewAssignmentsModalOpen] = useState(false);
    const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState(null);
    // Form states
    const [assignForm, setAssignForm] = useState({
        teacher_id: '',
        class_group_id: '',
        subject_id: '',
        section_id: ''
    });
    const [attendanceForm, setAttendanceForm] = useState({
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        notes: ''
    });
    // Daily attendance states
    const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
    const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
    const [dailyAttendance, setDailyAttendance] = useState({});
    const [attendanceStats, setAttendanceStats] = useState({ totalDays: 0, presentDays: 0, absentDays: 0 });
    const [savingAttendance, setSavingAttendance] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        approval_status: 'approved'
    });
    // Data states
    const [teacherAttendance, setTeacherAttendance] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [performanceData, setPerformanceData] = useState(null);
    const [teacherAssignments, setTeacherAssignments] = useState([]);
    const [attendanceAssignments, setAttendanceAssignments] = useState([]);
    // Attendance assignment modal states
    const [attendanceAssignmentModalOpen, setAttendanceAssignmentModalOpen] = useState(false);
    const [attendanceAssignmentForm, setAttendanceAssignmentForm] = useState({
        teacher_id: '',
        class_group_id: '',
        section_id: ''
    });
    // Add Staff Modal State (must be before any early returns)
    const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
    const [addStaffForm, setAddStaffForm] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'teacher',
        phone: '',
        gender: '',
        salary_start_date: '' // Optional: when salary should start (only for teachers)
    });
    useEffect(() => {
        isMountedRef.current = true;
        loadStaff();
        loadAllClasses();
        loadAllSubjects();
        loadAllAssignments();
        loadAttendanceAssignments();
        // Always return cleanup function to avoid React error #310
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const loadAllClasses = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAllClasses(data.classes || []);
            }
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
    };
    const loadAllSubjects = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/subjects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAllSubjects(data.subjects || []);
            }
        }
        catch (error) {
            console.error('Error loading subjects:', error);
        }
    };
    const loadAllAssignments = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAllAssignments(data.assignments || []);
            }
        }
        catch (error) {
            console.error('Error loading assignments:', error);
        }
    };
    const loadAttendanceAssignments = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-attendance-assignments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAttendanceAssignments(data.assignments || []);
            }
        }
        catch (error) {
            console.error('Error loading attendance assignments:', error);
        }
    };
    const loadSections = async (classId) => {
        if (!classId) {
            setSections(prev => ({ ...prev, [classId]: [] }));
            return;
        }
        if (sections[classId])
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setSections(prev => ({ ...prev, [classId]: data.sections || [] }));
            }
        }
        catch (error) {
            console.error('Error loading sections:', error);
        }
    };
    const loadStaff = async () => {
        try {
            setError(null);
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setError('No authentication token found. Please log in again.');
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/staff-admin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load staff' }));
                throw new Error(errorData.error || `Failed to load staff: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setStaff(data.staff || []);
        }
        catch (error) {
            console.error('Error loading staff:', error);
            setError(error.message || 'Failed to load staff. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleAssignTeacher = (teacher) => {
        setSelectedTeacher(teacher);
        setAssignForm({
            teacher_id: teacher.id,
            class_group_id: '',
            subject_id: '',
            section_id: ''
        });
        setAssignModalOpen(true);
    };
    const handleAssignAttendanceClass = (teacher) => {
        setSelectedTeacher(teacher);
        setAttendanceAssignmentForm({
            teacher_id: teacher.id,
            class_group_id: '',
            section_id: ''
        });
        setAttendanceAssignmentModalOpen(true);
    };
    const handleViewAttendance = async (teacher) => {
        setSelectedTeacher(teacher);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-attendance?teacher_id=${teacher.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setTeacherAttendance(data.attendance || []);
                setAttendanceSummary(data.summary || null);
                setAttendanceModalOpen(true);
            }
        }
        catch (error) {
            console.error('Error loading attendance:', error);
        }
    };
    const handleMarkAttendance = async () => {
        if (!selectedTeacher)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    teacher_id: selectedTeacher.id,
                    ...attendanceForm
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to mark attendance');
            }
            alert('Attendance marked successfully!');
            setAttendanceModalOpen(false);
            // Reload attendance
            handleViewAttendance(selectedTeacher);
        }
        catch (error) {
            alert(error.message || 'Failed to mark attendance');
        }
    };
    const handleEvaluatePerformance = async (teacher) => {
        setSelectedTeacher(teacher);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/staff-admin/${teacher.id}/performance`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setPerformanceData(data);
                setPerformanceModalOpen(true);
            }
        }
        catch (error) {
            console.error('Error loading performance:', error);
        }
    };
    const handleEditTeacher = (teacher) => {
        setSelectedTeacher(teacher);
        setEditForm({
            full_name: teacher.full_name || '',
            email: teacher.email || '',
            phone: teacher.phone || '',
            approval_status: teacher.approval_status === 'approved' ? 'approved' : 'rejected'
        });
        setEditModalOpen(true);
    };
    const handleUpdateTeacher = async () => {
        if (!selectedTeacher)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/staff-admin/${selectedTeacher.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update teacher');
            }
            alert('Teacher updated successfully!');
            setEditModalOpen(false);
            loadStaff();
        }
        catch (error) {
            alert(error.message || 'Failed to update teacher');
        }
    };
    const handleDeactivateTeacher = async (teacher) => {
        if (!confirm(`Are you sure you want to ${teacher.approval_status === 'approved' ? 'deactivate' : 'activate'} ${teacher.full_name}?`)) {
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/staff-admin/${teacher.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    approval_status: teacher.approval_status === 'approved' ? 'rejected' : 'approved'
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update teacher');
            }
            alert(`Teacher ${teacher.approval_status === 'approved' ? 'deactivated' : 'activated'} successfully!`);
            loadStaff();
        }
        catch (error) {
            alert(error.message || 'Failed to update teacher');
        }
    };
    const handleViewAssignments = async (teacher) => {
        setSelectedTeacher(teacher);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Load both teaching and attendance assignments
            const [teachingRes, attendanceRes] = await Promise.all([
                fetch(`${API_URL}/teacher-assignments/teacher/${teacher.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_URL}/teacher-attendance-assignments/teacher/${teacher.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
            ]);
            if (teachingRes.ok) {
                const data = await teachingRes.json();
                setTeacherAssignments(data.assignments || []);
            }
            if (attendanceRes.ok) {
                const data = await attendanceRes.json();
                // Update attendance assignments for this teacher
                setAttendanceAssignments(prev => {
                    const filtered = prev.filter(a => a.teacher_id !== teacher.id);
                    return [...filtered, ...(data.assignments || [])];
                });
            }
            setViewAssignmentsModalOpen(true);
        }
        catch (error) {
            console.error('Error loading assignments:', error);
        }
    };
    const handleCreateAssignment = async () => {
        if (!assignForm.teacher_id || !assignForm.class_group_id || !assignForm.subject_id) {
            alert('Please fill in all required fields');
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(assignForm),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create assignment');
            }
            alert('Teaching assignment created successfully!');
            setAssignModalOpen(false);
            loadAllAssignments();
        }
        catch (error) {
            alert(error.message || 'Failed to create assignment');
        }
    };
    const handleCreateAttendanceAssignment = async () => {
        if (!attendanceAssignmentForm.teacher_id || !attendanceAssignmentForm.class_group_id) {
            alert('Please select a class');
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-attendance-assignments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    teacher_id: attendanceAssignmentForm.teacher_id,
                    class_group_id: attendanceAssignmentForm.class_group_id,
                    section_id: attendanceAssignmentForm.section_id || null
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create attendance assignment');
            }
            alert('Attendance assignment created successfully! Teacher can now mark attendance for this class.');
            setAttendanceAssignmentModalOpen(false);
            loadAttendanceAssignments();
        }
        catch (error) {
            alert(error.message || 'Failed to create attendance assignment');
        }
    };
    const handleDeleteAssignment = async (assignmentId) => {
        if (!confirm('Are you sure you want to remove this assignment?')) {
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments/${assignmentId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete assignment');
            }
            alert('Assignment removed successfully!');
            loadAllAssignments();
            if (viewAssignmentsModalOpen) {
                handleViewAssignments(selectedTeacher);
            }
        }
        catch (error) {
            alert(error.message || 'Failed to delete assignment');
        }
    };
    useEffect(() => {
        if (assignForm.class_group_id) {
            loadSections(assignForm.class_group_id);
        }
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, [assignForm.class_group_id]);
    useEffect(() => {
        if (dailyAttendanceModalOpen && selectedTeacher) {
            loadDailyAttendance(selectedTeacher.id, attendanceMonth, attendanceYear);
        }
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed - loadDailyAttendance checks isMountedRef
        };
    }, [dailyAttendanceModalOpen, attendanceMonth, attendanceYear, selectedTeacher]);
    // Get assignments count for each teacher
    const getTeacherAssignmentsCount = (teacherId) => {
        return allAssignments.filter(a => a.teacher_id === teacherId).length;
    };
    const loadDailyAttendance = async (teacherId, month, year) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token || !isMountedRef.current)
                return;
            // Get first and last day of the month
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            const response = await fetch(`${API_URL}/teacher-attendance?teacher_id=${teacherId}&start_date=${firstDay.toISOString().split('T')[0]}&end_date=${lastDay.toISOString().split('T')[0]}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!isMountedRef.current)
                return;
            if (response.ok) {
                const data = await response.json();
                if (!isMountedRef.current)
                    return;
                const attendanceMap = {};
                const daysInMonth = lastDay.getDate();
                // Initialize all days as present by default
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
                    attendanceMap[dateStr] = 'present';
                }
                // Override with actual attendance records (only absent ones override the default present)
                (data.attendance || []).forEach((record) => {
                    if (record.status === 'absent') {
                        attendanceMap[record.date] = 'absent';
                    }
                });
                if (!isMountedRef.current)
                    return;
                setDailyAttendance(attendanceMap);
                // Calculate stats (consider unmarked days as present)
                const totalDays = daysInMonth;
                const absentDays = Object.values(attendanceMap).filter(status => status === 'absent').length;
                const presentDays = totalDays - absentDays;
                if (isMountedRef.current) {
                    setAttendanceStats({ totalDays, presentDays, absentDays });
                }
            }
        }
        catch (error) {
            if (isMountedRef.current) {
                console.error('Error loading daily attendance:', error);
            }
        }
    };
    const toggleDayAttendance = (dateStr) => {
        setDailyAttendance(prev => {
            const newAttendance = { ...prev };
            // Toggle between present and absent
            newAttendance[dateStr] = prev[dateStr] === 'absent' ? 'present' : 'absent';
            // Update stats
            const absentDays = Object.values(newAttendance).filter(status => status === 'absent').length;
            const presentDays = attendanceStats.totalDays - absentDays;
            setAttendanceStats({ totalDays: attendanceStats.totalDays, presentDays, absentDays });
            return newAttendance;
        });
    };
    const saveDailyAttendance = async () => {
        if (!selectedTeacher)
            return;
        try {
            setSavingAttendance(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get first and last day of the month
            const firstDay = new Date(attendanceYear, attendanceMonth - 1, 1);
            const lastDay = new Date(attendanceYear, attendanceMonth, 0);
            // Get all absent dates
            const absentDates = Object.entries(dailyAttendance)
                .filter(([date, status]) => status === 'absent')
                .map(([date]) => date);
            const response = await fetch(`${API_URL}/teacher-attendance/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    teacher_id: selectedTeacher.id,
                    start_date: firstDay.toISOString().split('T')[0],
                    end_date: lastDay.toISOString().split('T')[0],
                    absent_dates: absentDates
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save attendance');
            }
            alert('Attendance saved successfully!');
            loadDailyAttendance(selectedTeacher.id, attendanceMonth, attendanceYear);
        }
        catch (error) {
            alert(error.message || 'Failed to save attendance');
        }
        finally {
            setSavingAttendance(false);
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading staff..." });
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-red-600 text-xl mr-2", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-red-800 font-semibold", children: "Error Loading Staff" }), _jsx("p", { className: "text-red-600 text-sm mt-1", children: error })] })] }), _jsx("button", { onClick: () => {
                            setError(null);
                            loadStaff();
                        }, className: "mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }) }));
    }
    const handleAddStaff = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/principal-users/staff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: addStaffForm.email,
                    password: addStaffForm.password,
                    full_name: addStaffForm.full_name,
                    role: addStaffForm.role,
                    phone: addStaffForm.phone || null,
                    gender: addStaffForm.gender || null,
                    salary_start_date: addStaffForm.role === 'teacher' && addStaffForm.salary_start_date ? addStaffForm.salary_start_date : null
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add staff member');
            }
            alert(`${addStaffForm.role === 'clerk' ? 'Clerk' : 'Teacher'} added successfully!`);
            setAddStaffModalOpen(false);
            setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '', salary_start_date: '' });
            loadStaff();
        }
        catch (error) {
            alert(error.message || 'Failed to add staff member');
        }
    };
    // Filter staff based on search and filters
    const filteredStaff = staff.filter((member) => {
        const matchesSearch = member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'all' || member.role === roleFilter;
        const matchesStatus = statusFilter === 'all' || member.approval_status === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
    });
    const toggleActionMenu = (memberId, e) => {
        if (e)
            e.stopPropagation();
        setActionMenuOpen(prev => ({
            ...prev,
            [memberId]: !prev[memberId]
        }));
    };
    // Close action menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setActionMenuOpen({});
        };
        // Always add listener, cleanup will remove it
        document.addEventListener('click', handleClickOutside);
        // Always return cleanup function to avoid React error #310
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
        // Remove actionMenuOpen from dependencies - we want this to run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs("div", { className: "p-6 bg-gray-50 min-h-screen", children: [_jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Staff Management" }), _jsx("p", { className: "text-gray-600 mt-1", children: "Manage your school staff members and their assignments" })] }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("button", { onClick: () => {
                                            setViewAssignmentsModalOpen(true);
                                            setSelectedTeacher(null);
                                            loadAllAssignments();
                                            loadAttendanceAssignments();
                                        }, className: "bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 shadow-sm", children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsx("span", { className: "hidden sm:inline", children: "View All Assignments" }), _jsx("span", { className: "sm:hidden", children: "Assignments" })] }), _jsxs("button", { onClick: () => setAddStaffModalOpen(true), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm font-semibold", children: [_jsx("span", { children: "\u2795" }), _jsx("span", { children: "Add Staff" })] })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-sm p-4 mb-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", placeholder: "Search by name or email...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" }), _jsx("span", { className: "absolute left-3 top-2.5 text-gray-400", children: "\uD83D\uDD0D" })] }), _jsxs("select", { value: roleFilter, onChange: (e) => setRoleFilter(e.target.value), className: "px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Roles" }), _jsx("option", { value: "teacher", children: "Teachers" }), _jsx("option", { value: "clerk", children: "Clerks" })] }), _jsxs("select", { value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), className: "px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent", children: [_jsx("option", { value: "all", children: "All Status" }), _jsx("option", { value: "approved", children: "Approved" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "rejected", children: "Rejected" })] })] }), filteredStaff.length !== staff.length && (_jsxs("div", { className: "mt-3 text-sm text-gray-600", children: ["Showing ", filteredStaff.length, " of ", staff.length, " staff members"] }))] })] }), _jsx("div", { className: "bg-white rounded-lg shadow-sm overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gradient-to-r from-blue-50 to-indigo-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Staff Member" }), _jsx("th", { className: "px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Role & Status" }), _jsx("th", { className: "px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Assignments" }), _jsx("th", { className: "px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Joined" }), _jsx("th", { className: "px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: filteredStaff.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-12 text-center", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx("span", { className: "text-6xl mb-4", children: "\uD83D\uDC65" }), _jsx("p", { className: "text-gray-500 text-lg font-medium", children: "No staff members found" }), _jsx("p", { className: "text-gray-400 text-sm mt-1", children: searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                                                        ? 'Try adjusting your filters'
                                                        : 'Add your first staff member to get started' })] }) }) })) : (filteredStaff.map((member) => (_jsxs("tr", { className: "hover:bg-blue-50 transition-colors", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg", children: member.full_name?.charAt(0).toUpperCase() || '?' }), _jsxs("div", { className: "ml-4", children: [_jsx("div", { className: "text-sm font-semibold text-gray-900", children: member.full_name || 'N/A' }), _jsx("div", { className: "text-sm text-gray-500", children: member.email })] })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("span", { className: "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 w-fit", children: member.role }), _jsx("span", { className: `inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold w-fit ${member.approval_status === 'approved'
                                                            ? 'bg-green-100 text-green-800'
                                                            : member.approval_status === 'pending'
                                                                ? 'bg-yellow-100 text-yellow-800'
                                                                : 'bg-red-100 text-red-800'}`, children: member.approval_status })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm font-medium text-gray-900", children: getTeacherAssignmentsCount(member.id) }), _jsx("span", { className: "text-sm text-gray-500", children: getTeacherAssignmentsCount(member.id) === 1 ? 'assignment' : 'assignments' })] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-600", children: new Date(member.created_at).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsxs("div", { className: "relative inline-block", children: [_jsxs("button", { onClick: (e) => {
                                                            e.stopPropagation();
                                                            toggleActionMenu(member.id);
                                                        }, className: "inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition", children: [_jsx("span", { children: "Actions" }), _jsx("svg", { className: "ml-2 h-4 w-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }), actionMenuOpen[member.id] && (_jsx("div", { className: "absolute right-0 mt-2 w-64 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50", onClick: (e) => e.stopPropagation(), children: _jsxs("div", { className: "py-1", children: [member.role === 'teacher' && (_jsxs(_Fragment, { children: [_jsxs("button", { onClick: () => {
                                                                                handleAssignTeacher(member);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCDA" }), _jsx("span", { children: "Assign Teaching" })] }), _jsxs("button", { onClick: () => {
                                                                                handleAssignAttendanceClass(member);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCC5" }), _jsx("span", { children: "Assign Attendance Class" })] }), _jsxs("button", { onClick: () => {
                                                                                setSelectedTeacher(member);
                                                                                setDailyAttendanceModalOpen(true);
                                                                                loadDailyAttendance(member.id, attendanceMonth, attendanceYear);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDC64" }), _jsx("span", { children: "Mark Attendance" })] }), _jsxs("button", { onClick: () => {
                                                                                handleEvaluatePerformance(member);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCCA" }), _jsx("span", { children: "View Performance" })] }), _jsxs("button", { onClick: () => {
                                                                                handleViewAssignments(member);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDC41\uFE0F" }), _jsx("span", { children: "View All Assignments" })] }), _jsxs("button", { onClick: () => {
                                                                                setSelectedTeacher(member);
                                                                                setPaymentHistoryModalOpen(true);
                                                                                setActionMenuOpen({});
                                                                            }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCB0" }), _jsx("span", { children: "Payment History" })] }), _jsx("div", { className: "border-t border-gray-200 my-1" })] })), _jsxs("button", { onClick: () => {
                                                                        handleEditTeacher(member);
                                                                        setActionMenuOpen({});
                                                                    }, className: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-2", children: [_jsx("span", { children: "\u270F\uFE0F" }), _jsx("span", { children: "Edit" })] }), _jsxs("button", { onClick: () => {
                                                                        handleDeactivateTeacher(member);
                                                                        setActionMenuOpen({});
                                                                    }, className: `w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${member.approval_status === 'approved'
                                                                        ? 'text-red-700 hover:bg-red-50'
                                                                        : 'text-green-700 hover:bg-green-50'}`, children: [_jsx("span", { children: member.approval_status === 'approved' ? '🚫' : '✅' }), _jsx("span", { children: member.approval_status === 'approved' ? 'Deactivate' : 'Activate' })] })] }) }))] }) })] }, member.id)))) })] }) }) }), assignModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Teaching Assignment: ", selectedTeacher.full_name] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Assign teacher to teach a specific subject in a class. This is separate from attendance responsibilities." }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class *" }), _jsxs("select", { value: assignForm.class_group_id, onChange: (e) => {
                                                setAssignForm({ ...assignForm, class_group_id: e.target.value, section_id: '' });
                                                if (e.target.value) {
                                                    loadSections(e.target.value);
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), assignForm.class_group_id && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Section (Optional)" }), _jsxs("select", { value: assignForm.section_id, onChange: (e) => setAssignForm({ ...assignForm, section_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "No Section" }), (sections[assignForm.class_group_id] || []).map((section) => (_jsx("option", { value: section.id, children: section.name }, section.id)))] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Subject *" }), _jsxs("select", { value: assignForm.subject_id, onChange: (e) => setAssignForm({ ...assignForm, subject_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Subject" }), allSubjects.map((subject) => (_jsxs("option", { value: subject.id, children: [subject.name, " ", subject.code ? `(${subject.code})` : ''] }, subject.id)))] })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleCreateAssignment, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Assign" }), _jsx("button", { onClick: () => setAssignModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), attendanceModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-xl font-bold", children: ["Teacher Attendance: ", selectedTeacher.full_name] }), _jsx("button", { onClick: () => setAttendanceModalOpen(false), className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), attendanceSummary && (_jsxs("div", { className: "grid grid-cols-4 gap-4 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Days" }), _jsx("p", { className: "text-2xl font-bold", children: attendanceSummary.totalDays })] }), _jsxs("div", { className: "bg-green-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Present" }), _jsx("p", { className: "text-2xl font-bold text-green-600", children: attendanceSummary.presentDays })] }), _jsxs("div", { className: "bg-red-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Absent" }), _jsx("p", { className: "text-2xl font-bold text-red-600", children: attendanceSummary.absentDays })] }), _jsxs("div", { className: "bg-purple-50 rounded-lg p-4", children: [_jsx("p", { className: "text-sm text-gray-600", children: "Percentage" }), _jsxs("p", { className: "text-2xl font-bold text-purple-600", children: [attendanceSummary.attendancePercentage, "%"] })] })] })), _jsxs("div", { className: "mb-4 p-4 bg-gray-50 rounded-lg", children: [_jsx("h4", { className: "font-semibold mb-3", children: "Mark Attendance for Today" }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Date" }), _jsx("input", { type: "date", value: attendanceForm.date, onChange: (e) => setAttendanceForm({ ...attendanceForm, date: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Status" }), _jsxs("select", { value: attendanceForm.status, onChange: (e) => setAttendanceForm({ ...attendanceForm, status: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "present", children: "Present" }), _jsx("option", { value: "absent", children: "Absent" }), _jsx("option", { value: "late", children: "Late" }), _jsx("option", { value: "leave", children: "Leave" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Notes (Optional)" }), _jsx("input", { type: "text", value: attendanceForm.notes, onChange: (e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Add notes..." })] })] }), _jsx("button", { onClick: handleMarkAttendance, className: "mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Mark Attendance" })] }), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Notes" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: teacherAttendance.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm", children: new Date(record.date).toLocaleDateString() }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${record.status === 'present'
                                                                ? 'bg-green-100 text-green-800'
                                                                : record.status === 'late'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : record.status === 'leave'
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : 'bg-red-100 text-red-800'}`, children: record.status }) }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-500", children: record.notes || '-' })] }, record.id))) })] }), teacherAttendance.length === 0 && (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No attendance records yet." }))] })] }) })), performanceModalOpen && selectedTeacher && performanceData && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-xl font-bold", children: ["Performance: ", selectedTeacher.full_name] }), _jsx("button", { onClick: () => setPerformanceModalOpen(false), className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-6 mb-6", children: [_jsxs("div", { className: "bg-blue-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-semibold mb-3", children: "Attendance Metrics" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Total Days:" }), _jsx("span", { className: "font-bold", children: performanceData.attendance.totalDays })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Present:" }), _jsx("span", { className: "font-bold text-green-600", children: performanceData.attendance.presentDays })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Absent:" }), _jsx("span", { className: "font-bold text-red-600", children: performanceData.attendance.absentDays })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Late:" }), _jsx("span", { className: "font-bold text-yellow-600", children: performanceData.attendance.lateDays })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Leave:" }), _jsx("span", { className: "font-bold text-blue-600", children: performanceData.attendance.leaveDays })] }), _jsxs("div", { className: "flex justify-between border-t pt-2 mt-2", children: [_jsx("span", { children: "Attendance %:" }), _jsxs("span", { className: "font-bold text-purple-600", children: [performanceData.attendance.attendancePercentage, "%"] })] })] })] }), _jsxs("div", { className: "bg-purple-50 rounded-lg p-4", children: [_jsx("h4", { className: "font-semibold mb-3", children: "Marks Metrics" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Total Marks Entered:" }), _jsx("span", { className: "font-bold", children: performanceData.marks.totalEntered })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Verified:" }), _jsx("span", { className: "font-bold text-green-600", children: performanceData.marks.verified })] }), _jsxs("div", { className: "flex justify-between border-t pt-2 mt-2", children: [_jsx("span", { children: "Verification Rate:" }), _jsxs("span", { className: "font-bold text-purple-600", children: [performanceData.marks.verificationRate, "%"] })] })] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold mb-3", children: "Recent Attendance Records" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: performanceData.attendance.recentRecords.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm", children: new Date(record.date).toLocaleDateString() }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${record.status === 'present'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : record.status === 'late'
                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                        : record.status === 'leave'
                                                                            ? 'bg-blue-100 text-blue-800'
                                                                            : 'bg-red-100 text-red-800'}`, children: record.status }) })] }, record.date))) })] }) })] })] }) })), editModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Edit Teacher: ", selectedTeacher.full_name] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name" }), _jsx("input", { type: "text", value: editForm.full_name, onChange: (e) => setEditForm({ ...editForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email" }), _jsx("input", { type: "email", value: editForm.email, onChange: (e) => setEditForm({ ...editForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "text", value: editForm.phone, onChange: (e) => setEditForm({ ...editForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Status" }), _jsxs("select", { value: editForm.approval_status, onChange: (e) => setEditForm({ ...editForm, approval_status: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "approved", children: "Approved" }), _jsx("option", { value: "rejected", children: "Rejected" })] })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleUpdateTeacher, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Update" }), _jsx("button", { onClick: () => setEditModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), dailyAttendanceModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Mark Daily Attendance: ", selectedTeacher.full_name] }), _jsxs("div", { className: "mb-4 flex gap-4 items-center", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Month" }), _jsx("select", { value: attendanceMonth, onChange: (e) => {
                                                const newMonth = parseInt(e.target.value);
                                                setAttendanceMonth(newMonth);
                                                if (selectedTeacher) {
                                                    loadDailyAttendance(selectedTeacher.id, newMonth, attendanceYear);
                                                }
                                            }, className: "px-3 py-2 border rounded-md", children: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (_jsx("option", { value: m, children: new Date(2000, m - 1).toLocaleString('default', { month: 'long' }) }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Year" }), _jsx("input", { type: "number", value: attendanceYear, onChange: (e) => {
                                                const newYear = parseInt(e.target.value);
                                                setAttendanceYear(newYear);
                                                if (selectedTeacher) {
                                                    loadDailyAttendance(selectedTeacher.id, attendanceMonth, newYear);
                                                }
                                            }, className: "px-3 py-2 border rounded-md w-24", min: "2000", max: "2100" })] })] }), _jsxs("div", { className: "mb-4 grid grid-cols-3 gap-4", children: [_jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Total Days" }), _jsx("div", { className: "text-2xl font-bold text-blue-600", children: attendanceStats.totalDays })] }), _jsxs("div", { className: "bg-green-50 border border-green-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Present Days" }), _jsx("div", { className: "text-2xl font-bold text-green-600", children: attendanceStats.presentDays })] }), _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Absent Days" }), _jsx("div", { className: "text-2xl font-bold text-red-600", children: attendanceStats.absentDays })] })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("p", { className: "text-sm text-gray-600 mb-2", children: ["\uD83D\uDCA1 By default, all days are marked as ", _jsx("strong", { children: "Present" }), ". Click on a day to toggle it to ", _jsx("strong", { children: "Absent" }), "."] }), _jsxs("div", { className: "grid grid-cols-7 gap-2", children: [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (_jsx("div", { className: "text-center text-sm font-semibold text-gray-600 py-2", children: day }, day))), (() => {
                                            const firstDay = new Date(attendanceYear, attendanceMonth - 1, 1);
                                            const lastDay = new Date(attendanceYear, attendanceMonth, 0);
                                            const daysInMonth = lastDay.getDate();
                                            const firstDayOfWeek = firstDay.getDay();
                                            const days = [];
                                            // Empty cells for days before month starts
                                            for (let i = 0; i < firstDayOfWeek; i++) {
                                                days.push(_jsx("div", { className: "p-2" }, `empty-${i}`));
                                            }
                                            // Days of the month
                                            for (let day = 1; day <= daysInMonth; day++) {
                                                const dateStr = new Date(attendanceYear, attendanceMonth - 1, day).toISOString().split('T')[0];
                                                const status = dailyAttendance[dateStr] || 'present';
                                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                                days.push(_jsxs("button", { onClick: () => toggleDayAttendance(dateStr), className: `p-2 border-2 rounded-lg transition ${status === 'absent'
                                                        ? 'bg-red-100 border-red-500 text-red-800 font-semibold'
                                                        : 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'} ${isToday ? 'ring-2 ring-blue-500' : ''}`, title: `${day} ${new Date(attendanceYear, attendanceMonth - 1).toLocaleString('default', { month: 'long' })} - Click to toggle`, children: [_jsx("div", { className: "text-xs font-medium", children: day }), _jsx("div", { className: "text-xs mt-1", children: status === 'absent' ? '❌' : '✅' })] }, day));
                                            }
                                            return days;
                                        })()] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: saveDailyAttendance, disabled: savingAttendance, className: `flex-1 px-4 py-2 rounded-lg ${savingAttendance
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}`, children: savingAttendance ? 'Saving...' : 'Save Attendance' }), _jsx("button", { onClick: () => {
                                        setDailyAttendanceModalOpen(false);
                                        setSelectedTeacher(null);
                                    }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Close" })] })] }) })), addStaffModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add New Staff Member" }), _jsxs("form", { onSubmit: handleAddStaff, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name *" }), _jsx("input", { type: "text", required: true, value: addStaffForm.full_name, onChange: (e) => setAddStaffForm({ ...addStaffForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Role *" }), _jsxs("select", { value: addStaffForm.role, onChange: (e) => setAddStaffForm({ ...addStaffForm, role: e.target.value }), className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "teacher", children: "Teacher" }), _jsx("option", { value: "clerk", children: "Clerk" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email *" }), _jsx("input", { type: "email", required: true, value: addStaffForm.email, onChange: (e) => setAddStaffForm({ ...addStaffForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Password *" }), _jsx("input", { type: "password", required: true, minLength: 8, value: addStaffForm.password, onChange: (e) => setAddStaffForm({ ...addStaffForm, password: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "tel", value: addStaffForm.phone, onChange: (e) => setAddStaffForm({ ...addStaffForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Gender" }), _jsxs("select", { value: addStaffForm.gender, onChange: (e) => setAddStaffForm({ ...addStaffForm, gender: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Gender" }), _jsx("option", { value: "male", children: "Male" }), _jsx("option", { value: "female", children: "Female" }), _jsx("option", { value: "other", children: "Other" })] })] }), addStaffForm.role === 'teacher' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Salary Start Date (Optional)" }), _jsx("input", { type: "date", value: addStaffForm.salary_start_date, onChange: (e) => setAddStaffForm({ ...addStaffForm, salary_start_date: e.target.value }), className: "w-full px-3 py-2 border rounded-md" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Specify when the salary should start. This date will be used when setting the salary structure." })] })), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Add Staff" }), _jsx("button", { type: "button", onClick: () => {
                                                setAddStaffModalOpen(false);
                                                setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '', salary_start_date: '' });
                                            }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] })] }) })), attendanceAssignmentModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Attendance Assignment: ", selectedTeacher.full_name] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Assign teacher to mark attendance for a class. This is separate from teaching assignments. Teacher can mark day-wise attendance for this class." }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class *" }), _jsxs("select", { value: attendanceAssignmentForm.class_group_id, onChange: (e) => {
                                                setAttendanceAssignmentForm({ ...attendanceAssignmentForm, class_group_id: e.target.value, section_id: '' });
                                                if (e.target.value) {
                                                    loadSections(e.target.value);
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), attendanceAssignmentForm.class_group_id && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Section (Optional)" }), _jsxs("select", { value: attendanceAssignmentForm.section_id, onChange: (e) => setAttendanceAssignmentForm({ ...attendanceAssignmentForm, section_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "No Section (All Sections)" }), (sections[attendanceAssignmentForm.class_group_id] || []).map((section) => (_jsx("option", { value: section.id, children: section.name }, section.id)))] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "If no section is selected, teacher can mark attendance for all sections of this class." })] }))] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleCreateAttendanceAssignment, className: "flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700", children: "Assign Attendance" }), _jsx("button", { onClick: () => {
                                        setAttendanceAssignmentModalOpen(false);
                                        setSelectedTeacher(null);
                                    }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), paymentHistoryModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4", children: _jsx("div", { className: "bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto", children: _jsx(TeacherPaymentHistory, { teacherId: selectedTeacher.id, teacherName: selectedTeacher.full_name || undefined, onClose: () => {
                            setPaymentHistoryModalOpen(false);
                            setSelectedTeacher(null);
                        }, showHeader: true }) }) })), viewAssignmentsModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: selectedTeacher ? `All Assignments: ${selectedTeacher.full_name}` : 'All Teacher Assignments' }), _jsx("button", { onClick: () => {
                                        setViewAssignmentsModalOpen(false);
                                        setSelectedTeacher(null);
                                        loadAllAssignments();
                                        loadAttendanceAssignments();
                                    }, className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), _jsxs("div", { className: "mb-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-blue-600", children: "\uD83D\uDCDA Teaching Assignments" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Teachers assigned to teach specific subjects in classes." }), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Section" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Subject" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Assigned" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: (selectedTeacher ? teacherAssignments : allAssignments).map((assignment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm", children: assignment.teacher?.full_name || selectedTeacher?.full_name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.class_groups?.name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.sections?.name || '-' }), _jsxs("td", { className: "px-4 py-2 text-sm", children: [assignment.subjects?.name || 'N/A', " ", assignment.subjects?.code ? `(${assignment.subjects.code})` : ''] }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-500", children: new Date(assignment.created_at).toLocaleDateString() }), _jsx("td", { className: "px-4 py-2 text-sm", children: _jsx("button", { onClick: () => handleDeleteAssignment(assignment.id), className: "text-red-600 hover:text-red-900", children: "\uD83D\uDDD1\uFE0F Remove" }) })] }, assignment.id))) })] }), (selectedTeacher ? teacherAssignments : allAssignments).length === 0 && (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No teaching assignments found." }))] })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-teal-600", children: "\uD83D\uDCC5 Attendance Assignments" }), _jsx("p", { className: "text-sm text-gray-600 mb-3", children: "Teachers assigned to mark day-wise attendance for classes. Independent of teaching assignments." }), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Section" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Assigned" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: (selectedTeacher
                                                        ? attendanceAssignments.filter(a => a.teacher_id === selectedTeacher.id)
                                                        : attendanceAssignments).map((assignment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm", children: assignment.teacher?.full_name || selectedTeacher?.full_name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.class_group?.name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.section?.name || 'All Sections' }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-500", children: new Date(assignment.created_at).toLocaleDateString() }), _jsx("td", { className: "px-4 py-2 text-sm", children: _jsx("span", { className: `px-2 py-1 text-xs rounded-full ${assignment.is_active
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-gray-100 text-gray-800'}`, children: assignment.is_active ? 'Active' : 'Inactive' }) }), _jsx("td", { className: "px-4 py-2 text-sm", children: _jsx("button", { onClick: async () => {
                                                                        if (!confirm('Are you sure you want to remove this attendance assignment?'))
                                                                            return;
                                                                        try {
                                                                            const token = (await supabase.auth.getSession()).data.session?.access_token;
                                                                            if (!token)
                                                                                return;
                                                                            const response = await fetch(`${API_URL}/teacher-attendance-assignments/${assignment.id}`, {
                                                                                method: 'DELETE',
                                                                                headers: { Authorization: `Bearer ${token}` },
                                                                            });
                                                                            if (response.ok) {
                                                                                alert('Attendance assignment removed successfully!');
                                                                                loadAttendanceAssignments();
                                                                                if (selectedTeacher) {
                                                                                    handleViewAssignments(selectedTeacher);
                                                                                }
                                                                            }
                                                                            else {
                                                                                const error = await response.json();
                                                                                throw new Error(error.error || 'Failed to remove assignment');
                                                                            }
                                                                        }
                                                                        catch (error) {
                                                                            alert(error.message || 'Failed to remove assignment');
                                                                        }
                                                                    }, className: "text-red-600 hover:text-red-900", children: "\uD83D\uDDD1\uFE0F Remove" }) })] }, assignment.id))) })] }), (selectedTeacher
                                            ? attendanceAssignments.filter(a => a.teacher_id === selectedTeacher.id)
                                            : attendanceAssignments).length === 0 && (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No attendance assignments found." }))] })] })] }) }))] }));
}
function ClassesManagement() {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [classificationTypes, setClassificationTypes] = useState([]);
    const [classificationValues, setClassificationValues] = useState({});
    const [selectedClassificationValues, setSelectedClassificationValues] = useState([]);
    const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState(null);
    const [allSubjects, setAllSubjects] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    useEffect(() => {
        loadClasses();
        loadClassificationTypes();
        loadAllSubjects();
    }, []);
    const loadAllSubjects = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/subjects`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                return;
            const data = await response.json();
            setAllSubjects(data.subjects || []);
        }
        catch (error) {
            console.error('Error loading subjects:', error);
        }
    };
    const handleManageSubjects = async (classItem) => {
        // Reload classes to get the latest data including subjects
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
            try {
                const response = await fetch(`${API_URL}/classes`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (response.ok) {
                    const data = await response.json();
                    const updatedClass = data.classes?.find((c) => c.id === classItem.id) || classItem;
                    setSelectedClass(updatedClass);
                    setClasses(data.classes || []);
                }
                else {
                    setSelectedClass(classItem);
                }
            }
            catch (error) {
                console.error('Error loading classes:', error);
                setSelectedClass(classItem);
            }
        }
        else {
            setSelectedClass(classItem);
        }
        setSubjectsModalOpen(true);
        setSelectedSubjectId('');
    };
    const handleAddSubject = async () => {
        if (!selectedClass || !selectedSubjectId) {
            alert('Please select a subject');
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const response = await fetch(`${API_URL}/classes/${selectedClass.id}/subjects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ subject_id: selectedSubjectId }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add subject');
            }
            setSelectedSubjectId('');
            await loadClasses();
            // Update selected class with latest data
            const updatedClasses = await fetch(`${API_URL}/classes`, {
                headers: { Authorization: `Bearer ${token}` },
            }).then(res => res.json()).then(data => data.classes || []);
            const updatedClass = updatedClasses.find((c) => c.id === selectedClass.id);
            if (updatedClass) {
                setSelectedClass(updatedClass);
            }
        }
        catch (error) {
            alert(error.message || 'Failed to add subject');
        }
    };
    const handleRemoveSubject = async (classSubjectId) => {
        if (!selectedClass)
            return;
        if (!confirm('Are you sure you want to remove this subject from the class?')) {
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const response = await fetch(`${API_URL}/classes/${selectedClass.id}/subjects/${classSubjectId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to remove subject');
            }
            await loadClasses();
            // Update selected class with latest data
            if (selectedClass) {
                const updatedClasses = await fetch(`${API_URL}/classes`, {
                    headers: { Authorization: `Bearer ${token}` },
                }).then(res => res.json()).then(data => data.classes || []);
                const updatedClass = updatedClasses.find((c) => c.id === selectedClass.id);
                if (updatedClass) {
                    setSelectedClass(updatedClass);
                }
            }
        }
        catch (error) {
            alert(error.message || 'Failed to remove subject');
        }
    };
    const loadClassificationTypes = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/types`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                return;
            const data = await response.json();
            setClassificationTypes(data.types || []);
            // Load values for each type
            for (const type of data.types || []) {
                const valuesResponse = await fetch(`${API_URL}/classifications/types/${type.id}/values`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (valuesResponse.ok) {
                    const valuesData = await valuesResponse.json();
                    setClassificationValues(prev => ({ ...prev, [type.id]: valuesData.values || [] }));
                }
            }
        }
        catch (error) {
            console.error('Error loading classification types:', error);
        }
    };
    const loadClasses = async () => {
        try {
            setError(null);
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setError('No authentication token found. Please log in again.');
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/classes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load classes' }));
                throw new Error(errorData.error || `Failed to load classes: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setClasses(data.classes || []);
        }
        catch (error) {
            console.error('Error loading classes:', error);
            setError(error.message || 'Failed to load classes. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateClass = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const response = await fetch(`${API_URL}/classes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    classification_value_ids: selectedClassificationValues.length > 0 ? selectedClassificationValues : undefined,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create class');
            }
            setFormData({ name: '', description: '' });
            setSelectedClassificationValues([]);
            setShowModal(false);
            loadClasses();
        }
        catch (error) {
            alert(error.message || 'Failed to create class');
        }
    };
    const handleEditClass = (classItem) => {
        setEditingClass(classItem);
        setFormData({ name: classItem.name, description: classItem.description || '' });
        // Set selected classification values from the class
        const currentValueIds = classItem.classifications?.map(c => c.value_id).filter(Boolean) || [];
        setSelectedClassificationValues(currentValueIds);
        setEditModal(true);
    };
    const handleUpdateClass = async (e) => {
        e.preventDefault();
        if (!editingClass)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const response = await fetch(`${API_URL}/classes/${editingClass.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description,
                    classification_value_ids: selectedClassificationValues.length > 0 ? selectedClassificationValues : [],
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update class');
            }
            setFormData({ name: '', description: '' });
            setSelectedClassificationValues([]);
            setEditModal(false);
            setEditingClass(null);
            loadClasses();
        }
        catch (error) {
            alert(error.message || 'Failed to update class');
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading classes..." });
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-red-600 text-xl mr-2", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-red-800 font-semibold", children: "Error Loading Classes" }), _jsx("p", { className: "text-red-600 text-sm mt-1", children: error })] })] }), _jsx("button", { onClick: () => {
                            setError(null);
                            loadClasses();
                        }, className: "mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Classes Management" }), _jsx("button", { onClick: () => setShowModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Create Class" })] }), showModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Create New Class" }), _jsxs("form", { onSubmit: handleCreateClass, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Class Name" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3 })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Classifications ", classificationTypes.length > 0 && _jsx("span", { className: "text-gray-500 font-normal", children: "(Optional)" })] }), classificationTypes.length === 0 ? (_jsxs("div", { className: "border border-yellow-200 bg-yellow-50 rounded-lg p-3", children: [_jsx("p", { className: "text-xs text-yellow-800 mb-2", children: _jsx("strong", { children: "No classification types available." }) }), _jsx("p", { className: "text-xs text-yellow-700", children: "Create classification types (e.g., \"Grade\", \"Stream\", \"House\") in the Classifications section first, then add values to categorize your classes." })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs text-gray-500 mb-3", children: "Select classification values to categorize this class. You can select multiple values from different types." }), _jsx("div", { className: "space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50", children: classificationTypes.map((type) => (_jsxs("div", { className: "border-b border-gray-200 pb-3 last:border-b-0 last:pb-0", children: [_jsxs("div", { className: "font-semibold text-sm mb-2 text-gray-700 flex items-center gap-2", children: [_jsx("span", { className: "text-blue-600", children: "\u25CF" }), type.name] }), _jsx("div", { className: "flex flex-wrap gap-2 ml-4", children: classificationValues[type.id] && classificationValues[type.id].length > 0 ? (classificationValues[type.id].map((value) => (_jsxs("label", { className: "flex items-center space-x-2 cursor-pointer px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors", children: [_jsx("input", { type: "checkbox", checked: selectedClassificationValues.includes(value.id), onChange: (e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedClassificationValues([...selectedClassificationValues, value.id]);
                                                                                }
                                                                                else {
                                                                                    setSelectedClassificationValues(selectedClassificationValues.filter(id => id !== value.id));
                                                                                }
                                                                            }, className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm text-gray-700", children: value.value })] }, value.id)))) : (_jsx("span", { className: "text-xs text-gray-400 italic", children: "No values available for this type" })) })] }, type.id))) }), selectedClassificationValues.length > 0 && (_jsxs("div", { className: "mt-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1", children: ["\u2713 ", selectedClassificationValues.length, " classification value(s) selected"] }))] }))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Create" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowModal(false);
                                                setSelectedClassificationValues([]);
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: [classes.map((classItem) => (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900", children: classItem.name }), _jsx("button", { onClick: () => handleEditClass(classItem), className: "text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition", title: "Edit class", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" }) }) })] }), classItem.classifications && classItem.classifications.length > 0 ? (_jsxs("div", { className: "mb-3", children: [_jsx("div", { className: "text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide", children: "Classifications" }), _jsx("div", { className: "flex flex-wrap gap-2", children: classItem.classifications.map((classification, idx) => (_jsxs("span", { className: "px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md text-xs font-medium text-blue-800 shadow-sm", title: `${classification.type}: ${classification.value}`, children: [_jsxs("span", { className: "font-semibold text-blue-600", children: [classification.type, ":"] }), ' ', _jsx("span", { className: "text-blue-800", children: classification.value })] }, idx))) })] })) : (_jsx("div", { className: "mb-3", children: _jsx("div", { className: "text-xs text-gray-400 italic", children: "No classifications assigned" }) })), _jsxs("div", { className: "mb-3", children: [_jsxs("div", { className: "text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center justify-between", children: [_jsx("span", { children: "Subjects" }), _jsx("button", { onClick: () => handleManageSubjects(classItem), className: "text-blue-600 hover:text-blue-800 text-xs font-normal normal-case", title: "Manage subjects", children: "\u270F\uFE0F Manage" })] }), classItem.subjects && classItem.subjects.length > 0 ? (_jsx("div", { className: "flex flex-wrap gap-2", children: classItem.subjects.map((subject) => (_jsxs("span", { className: "px-2 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-md text-xs font-medium text-green-800 shadow-sm", title: subject.code ? `${subject.name} (${subject.code})` : subject.name, children: [subject.name, subject.code && _jsxs("span", { className: "text-green-600", children: [" (", subject.code, ")"] })] }, subject.id))) })) : (_jsx("div", { className: "text-xs text-gray-400 italic", children: "No subjects assigned" }))] }), _jsx("div", { className: "mb-4", children: _jsx("p", { className: "text-gray-600 text-sm", children: classItem.description || _jsx("span", { className: "text-gray-400 italic", children: "No description" }) }) }), _jsx("div", { className: "pt-3 border-t border-gray-100", children: _jsxs("div", { className: "text-xs text-gray-500", children: ["Created: ", new Date(classItem.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })] }) })] }, classItem.id))), classes.length === 0 && (_jsxs("div", { className: "col-span-full text-center py-12 text-gray-500", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDCDA" }), _jsx("p", { className: "text-lg font-semibold mb-2", children: "No classes yet" }), _jsx("p", { className: "text-sm", children: "Create your first class to get started" })] }))] }), editModal && editingClass && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Edit Class" }), _jsxs("form", { onSubmit: handleUpdateClass, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Class Name" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }), _jsx("textarea", { value: formData.description, onChange: (e) => setFormData({ ...formData, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", rows: 3 })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Classifications ", classificationTypes.length > 0 && _jsx("span", { className: "text-gray-500 font-normal", children: "(Optional)" })] }), classificationTypes.length === 0 ? (_jsxs("div", { className: "border border-yellow-200 bg-yellow-50 rounded-lg p-3", children: [_jsx("p", { className: "text-xs text-yellow-800 mb-2", children: _jsx("strong", { children: "No classification types available." }) }), _jsx("p", { className: "text-xs text-yellow-700", children: "Create classification types (e.g., \"Grade\", \"Stream\", \"House\") in the Classifications section first, then add values to categorize your classes." })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-xs text-gray-500 mb-3", children: "Select classification values to categorize this class. You can select multiple values from different types." }), _jsx("div", { className: "space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50", children: classificationTypes.map((type) => (_jsxs("div", { className: "border-b border-gray-200 pb-3 last:border-b-0 last:pb-0", children: [_jsxs("div", { className: "font-semibold text-sm mb-2 text-gray-700 flex items-center gap-2", children: [_jsx("span", { className: "text-blue-600", children: "\u25CF" }), type.name] }), _jsx("div", { className: "flex flex-wrap gap-2 ml-4", children: classificationValues[type.id] && classificationValues[type.id].length > 0 ? (classificationValues[type.id].map((value) => (_jsxs("label", { className: "flex items-center space-x-2 cursor-pointer px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors", children: [_jsx("input", { type: "checkbox", checked: selectedClassificationValues.includes(value.id), onChange: (e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedClassificationValues([...selectedClassificationValues, value.id]);
                                                                                }
                                                                                else {
                                                                                    setSelectedClassificationValues(selectedClassificationValues.filter(id => id !== value.id));
                                                                                }
                                                                            }, className: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" }), _jsx("span", { className: "text-sm text-gray-700", children: value.value })] }, value.id)))) : (_jsx("span", { className: "text-xs text-gray-400 italic", children: "No values available for this type" })) })] }, type.id))) }), selectedClassificationValues.length > 0 && (_jsxs("div", { className: "mt-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1", children: ["\u2713 ", selectedClassificationValues.length, " classification value(s) selected"] }))] }))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Update" }), _jsx("button", { type: "button", onClick: () => {
                                                setEditModal(false);
                                                setEditingClass(null);
                                                setFormData({ name: '', description: '' });
                                                setSelectedClassificationValues([]);
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), subjectsModalOpen && selectedClass && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-xl font-bold", children: ["Manage Subjects: ", selectedClass.name] }), _jsx("button", { onClick: () => {
                                        setSubjectsModalOpen(false);
                                        setSelectedClass(null);
                                        setSelectedSubjectId('');
                                    }, className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), _jsxs("div", { className: "mb-6 p-4 bg-gray-50 rounded-lg", children: [_jsx("h4", { className: "text-sm font-semibold mb-3 text-gray-700", children: "Add Subject" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs("select", { value: selectedSubjectId, onChange: (e) => setSelectedSubjectId(e.target.value), className: "flex-1 px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "", children: "Select a subject" }), allSubjects
                                                    .filter(subject => !selectedClass.subjects?.some(s => s.id === subject.id))
                                                    .map((subject) => (_jsxs("option", { value: subject.id, children: [subject.name, " ", subject.code ? `(${subject.code})` : ''] }, subject.id)))] }), _jsx("button", { onClick: handleAddSubject, className: "bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700", disabled: !selectedSubjectId, children: "Add" })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold mb-3 text-gray-700", children: "Current Subjects" }), selectedClass.subjects && selectedClass.subjects.length > 0 ? (_jsx("div", { className: "space-y-2", children: selectedClass.subjects.map((subject) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-gray-900", children: subject.name }), subject.code && (_jsxs("span", { className: "text-gray-500 ml-2", children: ["(", subject.code, ")"] }))] }), _jsx("button", { onClick: () => handleRemoveSubject(subject.class_subject_id), className: "text-red-600 hover:text-red-800 text-sm", title: "Remove subject", children: "\uD83D\uDDD1\uFE0F Remove" })] }, subject.id))) })) : (_jsxs("div", { className: "text-center py-8 text-gray-500", children: [_jsx("p", { children: "No subjects assigned to this class yet." }), _jsx("p", { className: "text-sm mt-1", children: "Add subjects using the form above." })] }))] }), _jsx("div", { className: "mt-6", children: _jsx("button", { onClick: () => {
                                    setSubjectsModalOpen(false);
                                    setSelectedClass(null);
                                    setSelectedSubjectId('');
                                }, className: "w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Close" }) })] }) }))] }));
}
function SubjectsManagement() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '' });
    const [editingSubject, setEditingSubject] = useState(null);
    useEffect(() => {
        loadSubjects();
    }, []);
    const loadSubjects = async () => {
        try {
            setError(null);
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setError('No authentication token found. Please log in again.');
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/subjects`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load subjects' }));
                throw new Error(errorData.error || `Failed to load subjects: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setSubjects(data.subjects || []);
        }
        catch (error) {
            console.error('Error loading subjects:', error);
            setError(error.message || 'Failed to load subjects. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateSubject = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const response = await fetch(`${API_URL}/subjects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.name,
                    code: formData.code || null,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create subject');
            }
            setFormData({ name: '', code: '' });
            setShowModal(false);
            loadSubjects();
        }
        catch (error) {
            alert(error.message || 'Failed to create subject');
        }
    };
    const handleDeleteSubject = async (subjectId) => {
        if (!confirm('Are you sure you want to delete this subject? This action cannot be undone.')) {
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            // Note: You may need to add a DELETE endpoint for subjects
            // For now, we'll just show an alert
            alert('Delete functionality needs to be implemented in the backend. Please contact support.');
        }
        catch (error) {
            alert(error.message || 'Failed to delete subject');
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading subjects..." });
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-red-600 text-xl mr-2", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-red-800 font-semibold", children: "Error Loading Subjects" }), _jsx("p", { className: "text-red-600 text-sm mt-1", children: error })] })] }), _jsx("button", { onClick: () => {
                            setError(null);
                            loadSubjects();
                        }, className: "mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Subjects Management" }), _jsx("button", { onClick: () => {
                            setShowModal(true);
                            setEditingSubject(null);
                            setFormData({ name: '', code: '' });
                        }, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Subject" })] }), showModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-md", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: editingSubject ? 'Edit Subject' : 'Create New Subject' }), _jsxs("form", { onSubmit: handleCreateSubject, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Subject Name *" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Subject Code (Optional)" }), _jsx("input", { type: "text", value: formData.code, onChange: (e) => setFormData({ ...formData, code: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "e.g., MATH, ENG, SCI" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: editingSubject ? 'Update' : 'Create' }), _jsx("button", { type: "button", onClick: () => {
                                                setShowModal(false);
                                                setEditingSubject(null);
                                                setFormData({ name: '', code: '' });
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Subject Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Code" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Created" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: subjects.map((subject) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: subject.name }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-500", children: subject.code || '-' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: new Date(subject.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsx("button", { onClick: () => handleDeleteSubject(subject.id), className: "text-red-600 hover:text-red-900", title: "Delete subject", children: "\uD83D\uDDD1\uFE0F Delete" }) })] }, subject.id))) })] }), subjects.length === 0 && (_jsxs("div", { className: "text-center py-12 text-gray-500", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDCDA" }), _jsx("p", { className: "text-lg font-semibold mb-2", children: "No subjects yet" }), _jsx("p", { className: "text-sm", children: "Create your first subject to get started" })] }))] })] }));
}
function StudentsManagement() {
    const [classesWithStudents, setClassesWithStudents] = useState([]);
    const [unassignedStudents, setUnassignedStudents] = useState([]);
    const [expandedClasses, setExpandedClasses] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalStudents, setTotalStudents] = useState(0);
    const [allClasses, setAllClasses] = useState([]);
    const [sections, setSections] = useState({});
    // Modal states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [promoteModalOpen, setPromoteModalOpen] = useState(false);
    const [promoteClassModalOpen, setPromoteClassModalOpen] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedClassId, setSelectedClassId] = useState('');
    // Form states
    const [editForm, setEditForm] = useState({
        class_group_id: '',
        section_id: '',
        roll_number: ''
    });
    const [editFeeConfig, setEditFeeConfig] = useState({
        class_fee_id: '',
        class_fee_discount: 0,
        transport_enabled: false,
        transport_route_id: '',
        transport_fee_discount: 0,
        other_fees: [],
        custom_fees: [],
        effective_from_date: '' // Apply From Date for new fee structure
    });
    const [editDefaultFees, setEditDefaultFees] = useState(null);
    const [loadingEditFees, setLoadingEditFees] = useState(false);
    const [updatingStudent, setUpdatingStudent] = useState(false);
    const [promoteForm, setPromoteForm] = useState({
        target_class_id: '',
        section_id: ''
    });
    const [promoteClassForm, setPromoteClassForm] = useState({
        target_class_id: '',
        clear_sections: false
    });
    // Add Student Modal State (must be before any early returns)
    const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
    const [addStudentForm, setAddStudentForm] = useState({
        email: '',
        password: '',
        full_name: '',
        username: '',
        phone: '',
        roll_number: '',
        class_group_id: '',
        section_id: '',
        admission_date: '',
        gender: '',
        date_of_birth: '',
        home_address: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        guardian_relationship: 'parent'
    });
    // Fee configuration state
    const [defaultFees, setDefaultFees] = useState(null);
    const [loadingFees, setLoadingFees] = useState(false);
    const [feeConfig, setFeeConfig] = useState({
        class_fee_id: '', // Selected class fee ID
        class_fee_discount: 0,
        transport_enabled: true,
        transport_route_id: '',
        transport_fee_discount: 0,
        other_fees: [],
        custom_fees: []
    });
    const [usernameStatus, setUsernameStatus] = useState({
        checking: false,
        available: null,
        message: ''
    });
    // Debounced username check - real-time validation while typing
    useEffect(() => {
        const checkUsername = async () => {
            const username = addStudentForm.username.trim();
            // Reset status if username is empty
            if (!username) {
                setUsernameStatus({ checking: false, available: null, message: '' });
                return;
            }
            // Don't check if username is too short
            if (username.length < 3) {
                setUsernameStatus({ checking: false, available: null, message: 'Username must be at least 3 characters' });
                return;
            }
            // Show checking state immediately
            setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' });
            try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                if (!token) {
                    setUsernameStatus({ checking: false, available: null, message: '' });
                    return;
                }
                const response = await fetch(`${API_URL}/principal-users/check-username/${encodeURIComponent(username)}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    setUsernameStatus({ checking: false, available: false, message: 'Error checking username' });
                    return;
                }
                const data = await response.json();
                setUsernameStatus({
                    checking: false,
                    available: data.available,
                    message: data.message || (data.available ? 'Username is available ✓' : 'Username already exists. Please choose another.')
                });
            }
            catch (error) {
                console.error('Error checking username:', error);
                setUsernameStatus({ checking: false, available: null, message: 'Error checking username' });
            }
        };
        // Debounce the check - wait 300ms after user stops typing (reduced from 500ms for faster feedback)
        const timeoutId = setTimeout(checkUsername, 300);
        return () => clearTimeout(timeoutId);
    }, [addStudentForm.username]);
    const loadStudents = async (showFullPageLoading = false) => {
        try {
            setError(null);
            if (showFullPageLoading) {
                setLoading(true);
            }
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setError('No authentication token found. Please log in again.');
                if (showFullPageLoading) {
                    setLoading(false);
                }
                return;
            }
            const response = await fetch(`${API_URL}/students-admin`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load students' }));
                throw new Error(errorData.error || `Failed to load students: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setClassesWithStudents(data.classes || []);
            setUnassignedStudents(data.unassigned || []);
            setTotalStudents(data.total_students || 0);
            // Auto-expand first class if available (only on initial load)
            if (showFullPageLoading && data.classes && data.classes.length > 0 && expandedClasses.size === 0) {
                setExpandedClasses(new Set([data.classes[0].id]));
            }
        }
        catch (error) {
            console.error('Error loading students:', error);
            setError(error.message || 'Failed to load students. Please try again.');
        }
        finally {
            if (showFullPageLoading) {
                setLoading(false);
            }
        }
    };
    useEffect(() => {
        loadStudents(true);
        loadAllClasses();
    }, []);
    const loadAllClasses = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load classes' }));
                throw new Error(errorData.error || `Failed to load classes: ${response.status}`);
            }
            const data = await response.json();
            setAllClasses(data.classes || []);
        }
        catch (error) {
            console.error('Error loading classes:', error);
            // Don't set error state here as it's a secondary load
        }
    };
    const loadSections = async (classId) => {
        if (!classId) {
            setSections(prev => ({ ...prev, [classId]: [] }));
            return;
        }
        // Check if sections are already loaded
        if (sections[classId]) {
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error('Failed to load sections');
            const data = await response.json();
            setSections(prev => ({ ...prev, [classId]: data.sections || [] }));
        }
        catch (error) {
            console.error('Error loading sections:', error);
            setSections(prev => ({ ...prev, [classId]: [] }));
        }
    };
    const loadDefaultFees = async (classId) => {
        try {
            setLoadingFees(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/principal-users/classes/${classId}/default-fees`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load default fees');
            }
            const data = await response.json();
            console.log('[Add Student] Loaded default fees:', data);
            console.log('[Add Student] Class fees array:', data.class_fees);
            console.log('[Add Student] Class fees length:', data.class_fees?.length);
            console.log('[Add Student] Is array?', Array.isArray(data.class_fees));
            setDefaultFees(data);
            // Set default class fee (first one if available)
            const defaultClassFeeId = data.class_fees && data.class_fees.length > 0 ? data.class_fees[0].id : '';
            console.log('[Add Student] Default class fee ID:', defaultClassFeeId);
            console.log('[Add Student] Class fees count:', data.class_fees?.length || 0);
            console.log('[Add Student] Custom fees count:', data.custom_fees?.length || 0);
            // Initialize custom_fees array with all custom fees
            const customFeesConfig = (data.custom_fees || []).map((cf) => ({
                custom_fee_id: cf.id,
                discount: 0,
                is_exempt: false
            }));
            setFeeConfig({
                class_fee_id: defaultClassFeeId,
                class_fee_discount: 0,
                transport_enabled: true,
                transport_route_id: '',
                transport_fee_discount: 0,
                other_fees: [],
                custom_fees: customFeesConfig
            });
        }
        catch (error) {
            console.error('Error loading default fees:', error);
            setDefaultFees(null);
        }
        finally {
            setLoadingFees(false);
        }
    };
    const handleEditStudent = async (student) => {
        setSelectedStudent(student);
        setEditForm({
            class_group_id: student.class_group_id || '',
            section_id: student.section_id || '',
            roll_number: student.roll_number || ''
        });
        setEditModalOpen(true);
        // Load current fee configuration
        if (student.id) {
            try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                if (!token)
                    return;
                const response = await fetch(`${API_URL}/students-admin/${student.id}/fee-config`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    const feeConfig = await response.json();
                    setEditFeeConfig({
                        class_fee_id: feeConfig.class_fee_id || '',
                        class_fee_discount: feeConfig.class_fee_discount || 0,
                        transport_enabled: feeConfig.transport_enabled ?? false,
                        transport_route_id: feeConfig.transport_route_id || '',
                        transport_fee_discount: feeConfig.transport_fee_discount || 0,
                        other_fees: feeConfig.other_fees || [],
                        custom_fees: feeConfig.custom_fees || [],
                        effective_from_date: '' // Will be set by user when editing
                    });
                }
            }
            catch (error) {
                console.error('Error loading fee config:', error);
            }
        }
        // Load default fees for the class
        if (student.class_group_id) {
            loadEditDefaultFees(student.class_group_id);
        }
    };
    const loadEditDefaultFees = async (classId) => {
        try {
            setLoadingEditFees(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/principal-users/classes/${classId}/default-fees`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load default fees');
            }
            const data = await response.json();
            console.log('[Edit Student] Loaded default fees:', data);
            console.log('[Edit Student] Class fees array:', data.class_fees);
            console.log('[Edit Student] Class fees length:', data.class_fees?.length);
            setEditDefaultFees(data);
            // Auto-select first class fee if available (always set it, even if already set, to ensure it's selected)
            if (data.class_fees && Array.isArray(data.class_fees) && data.class_fees.length > 0) {
                const defaultClassFeeId = data.class_fees[0].id;
                // Always set the first fee as default (overwrite if needed to ensure it's selected)
                setEditFeeConfig(prev => ({
                    ...prev,
                    class_fee_id: defaultClassFeeId,
                    class_fee_discount: prev.class_fee_id === defaultClassFeeId ? prev.class_fee_discount : 0
                }));
            }
            else {
                // No fees configured - set to empty but section will still show with 0 amount
                setEditFeeConfig(prev => ({
                    ...prev,
                    class_fee_id: '',
                    class_fee_discount: 0
                }));
            }
        }
        catch (error) {
            console.error('Error loading default fees:', error);
            setEditDefaultFees(null);
        }
        finally {
            setLoadingEditFees(false);
        }
    };
    const handlePromoteStudent = (student) => {
        setSelectedStudent(student);
        setPromoteForm({
            target_class_id: '',
            section_id: ''
        });
        setPromoteModalOpen(true);
    };
    const handlePromoteClass = (classId) => {
        setSelectedClassId(classId);
        setPromoteClassForm({
            target_class_id: '',
            clear_sections: false
        });
        setPromoteClassModalOpen(true);
    };
    const handleUpdateStudent = async () => {
        if (!selectedStudent)
            return;
        try {
            setUpdatingStudent(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Prepare update data
            const updateData = {
                class_group_id: editForm.class_group_id || null,
                section_id: editForm.section_id || null,
                roll_number: editForm.roll_number || null
            };
            // Include fee_config if class is selected
            if (editForm.class_group_id && editDefaultFees) {
                // Include effective_from_date if provided (for editing existing student)
                updateData.fee_config = {
                    ...editFeeConfig,
                    effective_from_date: editFeeConfig.effective_from_date || undefined
                };
            }
            const response = await fetch(`${API_URL}/students-admin/${selectedStudent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updateData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update student');
            }
            // Close modal first for better UX
            setEditModalOpen(false);
            // Show success message
            alert('Student updated successfully!');
            // Refetch students data (lightweight, no full page reload)
            await loadStudents(false);
        }
        catch (error) {
            alert(error.message || 'Failed to update student');
        }
        finally {
            setUpdatingStudent(false);
        }
    };
    const handlePromoteStudentSubmit = async () => {
        if (!selectedStudent || !promoteForm.target_class_id) {
            alert('Please select a target class');
            return;
        }
        try {
            setUpdatingStudent(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Remove section_id from the form data since sections are part of the class
            const { section_id, ...formData } = promoteForm;
            const response = await fetch(`${API_URL}/students-admin/${selectedStudent.id}/promote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to promote student');
            }
            const data = await response.json();
            setPromoteModalOpen(false);
            alert(data.message || 'Student promoted successfully!');
            // Refetch students data (lightweight, no full page reload)
            await loadStudents(false);
        }
        catch (error) {
            alert(error.message || 'Failed to promote student');
        }
        finally {
            setUpdatingStudent(false);
        }
    };
    const handlePromoteClassSubmit = async () => {
        if (!selectedClassId || !promoteClassForm.target_class_id) {
            alert('Please select a target class');
            return;
        }
        if (!confirm(`Are you sure you want to move all students from this class to the target class? This action cannot be undone.`)) {
            return;
        }
        try {
            setUpdatingStudent(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/students-admin/class/${selectedClassId}/promote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(promoteClassForm),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to promote class');
            }
            const data = await response.json();
            setPromoteClassModalOpen(false);
            alert(data.message || 'Class promoted successfully!');
            // Refetch students data (lightweight, no full page reload)
            await loadStudents(false);
        }
        catch (error) {
            alert(error.message || 'Failed to promote class');
        }
        finally {
            setUpdatingStudent(false);
        }
    };
    const toggleClass = (classId) => {
        setExpandedClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(classId)) {
                newSet.delete(classId);
            }
            else {
                newSet.add(classId);
            }
            return newSet;
        });
    };
    if (loading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Students Management" }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: _jsx("div", { className: "text-2xl mb-4", children: "Loading students..." }) })] }));
    }
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-red-600 text-xl mr-2", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-red-800 font-semibold", children: "Error Loading Students" }), _jsx("p", { className: "text-red-600 text-sm mt-1", children: error })] })] }), _jsx("button", { onClick: () => {
                            setError(null);
                            setLoading(true);
                            window.location.reload();
                        }, className: "mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }) }));
    }
    const handleAddStudent = async (e) => {
        e.preventDefault();
        // Prevent submission if username is invalid or still checking
        if (usernameStatus.checking) {
            alert('Please wait while we check username availability...');
            return;
        }
        if (usernameStatus.available === false) {
            alert('Please choose a different username. The current username is already taken.');
            return;
        }
        if (addStudentForm.username.trim().length < 3) {
            alert('Username must be at least 3 characters long.');
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/principal-users/students`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    email: addStudentForm.email,
                    password: addStudentForm.password,
                    full_name: addStudentForm.full_name,
                    username: addStudentForm.username,
                    phone: addStudentForm.phone || null,
                    roll_number: addStudentForm.roll_number || null,
                    class_group_id: addStudentForm.class_group_id || null,
                    section_id: addStudentForm.section_id || null,
                    admission_date: addStudentForm.admission_date || null,
                    gender: addStudentForm.gender || null,
                    date_of_birth: addStudentForm.date_of_birth || null,
                    home_address: addStudentForm.home_address || null,
                    guardian_name: addStudentForm.guardian_name,
                    guardian_phone: addStudentForm.guardian_phone,
                    guardian_email: addStudentForm.guardian_email || null,
                    guardian_relationship: addStudentForm.guardian_relationship,
                    // Include fee configuration if class is selected
                    fee_config: addStudentForm.class_group_id ? feeConfig : undefined
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add student');
            }
            alert('Student added successfully!');
            setAddStudentModalOpen(false);
            setAddStudentForm({
                email: '',
                password: '',
                full_name: '',
                username: '',
                phone: '',
                roll_number: '',
                class_group_id: '',
                section_id: '',
                admission_date: '',
                gender: '',
                date_of_birth: '',
                home_address: '',
                guardian_name: '',
                guardian_phone: '',
                guardian_email: '',
                guardian_relationship: 'parent'
            });
            setUsernameStatus({ checking: false, available: null, message: '' });
            setDefaultFees(null);
            setFeeConfig({
                class_fee_id: '',
                class_fee_discount: 0,
                transport_enabled: true,
                transport_route_id: '',
                transport_fee_discount: 0,
                other_fees: [],
                custom_fees: []
            });
            window.location.reload();
        }
        catch (error) {
            alert(error.message || 'Failed to add student');
        }
    };
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Students Management" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "text-lg text-gray-600", children: ["Total: ", _jsx("span", { className: "font-bold text-blue-600", children: totalStudents }), " students"] }), _jsx("button", { onClick: () => setAddStudentModalOpen(true), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition", children: "\u2795 Add Student" })] })] }), _jsx("div", { className: "space-y-4 mb-6", children: classesWithStudents.map((classItem) => {
                    const isExpanded = expandedClasses.has(classItem.id);
                    const classificationText = classItem.classifications && classItem.classifications.length > 0
                        ? ` (${classItem.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                        : '';
                    return (_jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("button", { onClick: () => toggleClass(classItem.id), className: "w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-2xl", children: isExpanded ? '▼' : '▶' }), _jsxs("div", { children: [_jsxs("h3", { className: "text-xl font-bold text-gray-900", children: [classItem.name, classificationText] }), classItem.description && (_jsx("p", { className: "text-sm text-gray-500 mt-1", children: classItem.description }))] })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    handlePromoteClass(classItem.id);
                                                }, className: "px-3 py-1 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition", title: "Promote entire class", children: "\u2B06 Promote Class" }), _jsxs("span", { className: "px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold", children: [classItem.student_count, " ", classItem.student_count === 1 ? 'student' : 'students'] })] })] }), isExpanded && (_jsx("div", { className: "border-t border-gray-200", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Roll No." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Section" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Phone" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classItem.students.map((student) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: student.profile?.full_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.section_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.email || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.phone || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-red-100 text-red-800'}`, children: student.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleEditStudent(student), className: "text-blue-600 hover:text-blue-900", title: "Edit student", children: "\u270F\uFE0F Edit" }), _jsx("button", { onClick: () => handlePromoteStudent(student), className: "text-green-600 hover:text-green-900", title: "Promote/Demote student", children: "\u2B06 Promote" })] }) })] }, student.id))) })] }) }) }))] }, classItem.id));
                }) }), unassignedStudents.length > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 bg-yellow-50 border-b border-yellow-200", children: [_jsxs("h3", { className: "text-lg font-semibold text-yellow-800", children: ["Unassigned Students (", unassignedStudents.length, ")"] }), _jsx("p", { className: "text-sm text-yellow-700 mt-1", children: "These students haven't been assigned to a class yet." })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Roll No." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Phone" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: unassignedStudents.map((student) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: student.profile?.full_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.email || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.phone || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'}`, children: student.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsx("button", { onClick: () => handleEditStudent(student), className: "text-blue-600 hover:text-blue-900", title: "Assign class to student", children: "\u270F\uFE0F Assign Class" }) })] }, student.id))) })] }) })] })), classesWithStudents.length === 0 && unassignedStudents.length === 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-gray-500 text-lg", children: "No students found." }), _jsx("div", { className: "text-gray-400 text-sm mt-2", children: "Students will appear here once they are approved and assigned to classes." })] })), editModalOpen && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Edit Student: ", selectedStudent.profile?.full_name] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class" }), _jsxs("select", { value: editForm.class_group_id, onChange: (e) => {
                                                const newClassId = e.target.value;
                                                setEditForm({ ...editForm, class_group_id: newClassId, section_id: '' });
                                                if (newClassId) {
                                                    // Load default fees for the new class (will auto-select first fee)
                                                    loadEditDefaultFees(newClassId);
                                                    // Reset fee config to defaults for new class (fee will be auto-selected after load)
                                                    setEditFeeConfig({
                                                        class_fee_id: '', // Will be set by loadEditDefaultFees if fees exist
                                                        class_fee_discount: 0,
                                                        transport_enabled: false,
                                                        transport_route_id: '',
                                                        transport_fee_discount: 0,
                                                        other_fees: [],
                                                        custom_fees: [], // Will be set by loadEditDefaultFees if fees exist
                                                        effective_from_date: ''
                                                    });
                                                }
                                                else {
                                                    setEditDefaultFees(null);
                                                    setEditFeeConfig({
                                                        class_fee_id: '',
                                                        class_fee_discount: 0,
                                                        transport_enabled: false,
                                                        transport_route_id: '',
                                                        transport_fee_discount: 0,
                                                        other_fees: [],
                                                        custom_fees: [],
                                                        effective_from_date: ''
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "No Class" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: editForm.roll_number, onChange: (e) => setEditForm({ ...editForm, roll_number: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), editForm.class_group_id && (_jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Fee Configuration" }), selectedStudent && (_jsxs("div", { className: "mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Apply From Date *" }), _jsx("input", { type: "date", required: true, value: editFeeConfig.effective_from_date || new Date().toISOString().split('T')[0], min: selectedStudent.admission_date || undefined, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, effective_from_date: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md" }), _jsxs("p", { className: "text-xs text-gray-600 mt-1", children: ["The new fee structure will be effective from this date. Previous fee structure remains unchanged for all months before this date.", selectedStudent.admission_date && ` (Student admission date: ${new Date(selectedStudent.admission_date).toLocaleDateString()})`] })] })), loadingEditFees ? (_jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "Loading fee information..." })] })) : editDefaultFees ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-2", children: "Class Fee (Default for this class)" }), (() => {
                                                            // Get the selected class fee (auto-selected first one or manually selected)
                                                            const classFeesArray = editDefaultFees.class_fees && Array.isArray(editDefaultFees.class_fees) ? editDefaultFees.class_fees : [];
                                                            let selectedClassFee = null;
                                                            if (classFeesArray.length > 0) {
                                                                // Try to find by editFeeConfig.class_fee_id, or use first one
                                                                if (editFeeConfig.class_fee_id) {
                                                                    selectedClassFee = classFeesArray.find((cf) => cf.id === editFeeConfig.class_fee_id);
                                                                }
                                                                // If not found or no fee_id set, use first fee
                                                                if (!selectedClassFee) {
                                                                    selectedClassFee = classFeesArray[0];
                                                                    // Auto-update editFeeConfig if it wasn't set
                                                                    if (!editFeeConfig.class_fee_id && selectedClassFee) {
                                                                        setEditFeeConfig(prev => ({ ...prev, class_fee_id: selectedClassFee.id }));
                                                                    }
                                                                }
                                                            }
                                                            console.log('[Edit Student Display] Class fees available:', classFeesArray.length);
                                                            console.log('[Edit Student Display] editFeeConfig.class_fee_id:', editFeeConfig.class_fee_id);
                                                            console.log('[Edit Student Display] Selected fee:', selectedClassFee ? { id: selectedClassFee.id, amount: selectedClassFee.amount } : 'none');
                                                            const categoryName = selectedClassFee?.fee_categories?.name || 'Class Fee';
                                                            const defaultAmount = selectedClassFee ? parseFloat(selectedClassFee.amount || 0) : 0;
                                                            const feeCycle = selectedClassFee?.fee_cycle || 'monthly';
                                                            const finalAmount = Math.max(0, defaultAmount - editFeeConfig.class_fee_discount);
                                                            return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [categoryName, ":"] }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultAmount.toFixed(2), "/", feeCycle] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: editFeeConfig.class_fee_discount, onChange: (e) => {
                                                                                    const discount = parseFloat(e.target.value) || 0;
                                                                                    setEditFeeConfig({ ...editFeeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                                                                }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", feeCycle] })] })] }));
                                                        })()] }), _jsxs("div", { className: "bg-green-50 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h5", { className: "font-semibold text-gray-700", children: "Transport Fee" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: editFeeConfig.transport_enabled, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? editFeeConfig.transport_route_id : '' }), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Enable Transport" })] })] }), editFeeConfig.transport_enabled && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Route" }), _jsxs("select", { value: editFeeConfig.transport_route_id, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_route_id: e.target.value }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Transport Route" }), editDefaultFees.transport_routes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : '', " - \u20B9", route.fee?.total?.toFixed(2) || '0.00', "/", route.fee?.fee_cycle || 'monthly'] }, route.id)))] })] }), editFeeConfig.transport_route_id && (() => {
                                                                    const selectedRoute = editDefaultFees.transport_routes.find((r) => r.id === editFeeConfig.transport_route_id);
                                                                    const routeFee = selectedRoute?.fee;
                                                                    const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                                                                    const finalTransportAmount = Math.max(0, defaultTransportAmount - editFeeConfig.transport_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Route Fee:" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: editFeeConfig.transport_fee_discount, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 }), className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] })] }));
                                                                })()] }))] }), editDefaultFees.custom_fees && Array.isArray(editDefaultFees.custom_fees) && editDefaultFees.custom_fees.length > 0 && (_jsxs("div", { className: "bg-purple-50 p-4 rounded-lg border border-purple-200", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-3", children: "Custom Fees" }), _jsx("div", { className: "space-y-3", children: editDefaultFees.custom_fees.map((customFee) => {
                                                                const feeConfigItem = editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id) || {
                                                                    custom_fee_id: customFee.id,
                                                                    discount: 0,
                                                                    is_exempt: false
                                                                };
                                                                const feeAmount = parseFloat(customFee.amount || 0);
                                                                const finalAmount = feeConfigItem.is_exempt ? 0 : Math.max(0, feeAmount - feeConfigItem.discount);
                                                                const classLabel = customFee.class_groups?.name || 'All Classes';
                                                                const feeName = customFee.fee_categories?.name || customFee.name || 'Custom Fee';
                                                                return (_jsxs("div", { className: "bg-white p-3 rounded border", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-sm", children: feeName }), _jsxs("span", { className: "text-xs text-gray-500 ml-2", children: ["(", classLabel, ")"] })] }), _jsxs("span", { className: "text-sm font-medium text-gray-600", children: ["\u20B9", feeAmount.toFixed(2), "/", customFee.fee_cycle || 'monthly'] })] }) }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer ml-3", children: [_jsx("input", { type: "checkbox", checked: feeConfigItem.is_exempt, onChange: (e) => {
                                                                                                const updatedCustomFees = editFeeConfig.custom_fees.map(f => f.custom_fee_id === customFee.id
                                                                                                    ? { ...f, is_exempt: e.target.checked, discount: e.target.checked ? 0 : f.discount }
                                                                                                    : f);
                                                                                                if (!editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                                                                                    updatedCustomFees.push({
                                                                                                        custom_fee_id: customFee.id,
                                                                                                        discount: 0,
                                                                                                        is_exempt: e.target.checked
                                                                                                    });
                                                                                                }
                                                                                                setEditFeeConfig({ ...editFeeConfig, custom_fees: updatedCustomFees });
                                                                                            }, className: "rounded" }), _jsx("span", { className: "text-xs text-gray-600", children: "Exempt" })] })] }), !feeConfigItem.is_exempt && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: feeAmount, value: feeConfigItem.discount, onChange: (e) => {
                                                                                                const discount = parseFloat(e.target.value) || 0;
                                                                                                const updatedCustomFees = editFeeConfig.custom_fees.map(f => f.custom_fee_id === customFee.id
                                                                                                    ? { ...f, discount: Math.min(discount, feeAmount) }
                                                                                                    : f);
                                                                                                if (!editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                                                                                    updatedCustomFees.push({
                                                                                                        custom_fee_id: customFee.id,
                                                                                                        discount: Math.min(discount, feeAmount),
                                                                                                        is_exempt: false
                                                                                                    });
                                                                                                }
                                                                                                setEditFeeConfig({ ...editFeeConfig, custom_fees: updatedCustomFees });
                                                                                            }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-xs font-semibold pt-1 border-t mt-1", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", customFee.fee_cycle || 'monthly'] })] })] })), feeConfigItem.is_exempt && (_jsx("div", { className: "text-xs text-red-600 font-semibold pt-1", children: "Student is exempt from this fee" }))] }, customFee.id));
                                                            }) })] }))] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "Select a class to configure fees" }))] }))] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleUpdateStudent, disabled: updatingStudent, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center", children: updatingStudent ? 'Updating...' : 'Update' }), _jsx("button", { onClick: () => setEditModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), promoteModalOpen && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Promote/Demote Student: ", selectedStudent.profile?.full_name] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Target Class" }), _jsxs("select", { value: promoteForm.target_class_id, onChange: (e) => {
                                            setPromoteForm({ ...promoteForm, target_class_id: e.target.value, section_id: '' });
                                        }, className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Target Class" }), allClasses.map((cls) => {
                                                const classificationText = cls.classifications && cls.classifications.length > 0
                                                    ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                    : '';
                                                return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                            })] })] }) }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handlePromoteStudentSubmit, className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Promote" }), _jsx("button", { onClick: () => setPromoteModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), addStudentModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add New Student" }), _jsxs("form", { onSubmit: handleAddStudent, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name *" }), _jsx("input", { type: "text", required: true, value: addStudentForm.full_name, onChange: (e) => setAddStudentForm({ ...addStudentForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email *" }), _jsx("input", { type: "email", required: true, value: addStudentForm.email, onChange: (e) => setAddStudentForm({ ...addStudentForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Username *" }), _jsxs("div", { className: "relative", children: [_jsx("input", { type: "text", required: true, value: addStudentForm.username, onChange: (e) => setAddStudentForm({ ...addStudentForm, username: e.target.value }), className: `w-full px-3 py-2 pr-10 border rounded-md ${usernameStatus.available === false
                                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                                        : usernameStatus.available === true
                                                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                                                            : ''}`, placeholder: "Unique username for login (unique per school)" }), addStudentForm.username.trim().length > 0 && (_jsx("div", { className: "absolute right-3 top-1/2 transform -translate-y-1/2", children: usernameStatus.checking ? (_jsx("div", { className: "animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" })) : usernameStatus.available === true ? (_jsx("svg", { className: "h-5 w-5 text-green-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })) : usernameStatus.available === false ? (_jsx("svg", { className: "h-5 w-5 text-red-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })) : null }))] }), addStudentForm.username.trim().length > 0 && (_jsx("div", { className: "mt-1", children: usernameStatus.checking ? (_jsxs("p", { className: "text-xs text-blue-600 flex items-center gap-1", children: [_jsx("span", { className: "animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" }), "Checking availability..."] })) : usernameStatus.message ? (_jsx("p", { className: `text-xs font-medium ${usernameStatus.available === true
                                                    ? 'text-green-600'
                                                    : usernameStatus.available === false
                                                        ? 'text-red-600'
                                                        : 'text-gray-500'}`, children: usernameStatus.message })) : null })), addStudentForm.username.trim().length === 0 && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Username must be unique within your school" }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Password *" }), _jsx("input", { type: "password", required: true, minLength: 8, value: addStudentForm.password, onChange: (e) => setAddStudentForm({ ...addStudentForm, password: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "tel", value: addStudentForm.phone, onChange: (e) => setAddStudentForm({ ...addStudentForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Gender" }), _jsxs("select", { value: addStudentForm.gender, onChange: (e) => setAddStudentForm({ ...addStudentForm, gender: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Gender" }), _jsx("option", { value: "male", children: "Male" }), _jsx("option", { value: "female", children: "Female" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: addStudentForm.roll_number, onChange: (e) => setAddStudentForm({ ...addStudentForm, roll_number: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class" }), _jsxs("select", { value: addStudentForm.class_group_id, onChange: async (e) => {
                                                const classId = e.target.value;
                                                setAddStudentForm({ ...addStudentForm, class_group_id: classId, section_id: '' });
                                                if (classId) {
                                                    loadSections(classId);
                                                    // Load default fees for this class
                                                    await loadDefaultFees(classId);
                                                }
                                                else {
                                                    setDefaultFees(null);
                                                    setFeeConfig({
                                                        class_fee_id: '',
                                                        class_fee_discount: 0,
                                                        transport_enabled: true,
                                                        transport_route_id: '',
                                                        transport_fee_discount: 0,
                                                        other_fees: [],
                                                        custom_fees: []
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Class (Optional)" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), addStudentForm.class_group_id && sections[addStudentForm.class_group_id] && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Section" }), _jsxs("select", { value: addStudentForm.section_id, onChange: (e) => setAddStudentForm({ ...addStudentForm, section_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Section (Optional)" }), sections[addStudentForm.class_group_id].map((section) => (_jsx("option", { value: section.id, children: section.name }, section.id)))] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Date of Birth" }), _jsx("input", { type: "date", value: addStudentForm.date_of_birth, onChange: (e) => setAddStudentForm({ ...addStudentForm, date_of_birth: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Home Address" }), _jsx("textarea", { value: addStudentForm.home_address, onChange: (e) => setAddStudentForm({ ...addStudentForm, home_address: e.target.value }), className: "w-full px-3 py-2 border rounded-md", rows: 3, placeholder: "Enter home address" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Admission Date" }), _jsx("input", { type: "date", value: addStudentForm.admission_date, onChange: (e) => setAddStudentForm({ ...addStudentForm, admission_date: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), addStudentForm.class_group_id && (_jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Fee Configuration" }), loadingFees ? (_jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "Loading fee information..." })] })) : defaultFees ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 p-4 rounded-lg border border-blue-200", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-2", children: "Class Fee (Default for this class)" }), (() => {
                                                            // Get the selected class fee (auto-selected first one or manually selected)
                                                            const classFeesArray = defaultFees.class_fees && Array.isArray(defaultFees.class_fees) ? defaultFees.class_fees : [];
                                                            let selectedClassFee = null;
                                                            if (classFeesArray.length > 0) {
                                                                // Try to find by feeConfig.class_fee_id, or use first one
                                                                if (feeConfig.class_fee_id) {
                                                                    selectedClassFee = classFeesArray.find((cf) => cf.id === feeConfig.class_fee_id);
                                                                }
                                                                // If not found or no fee_id set, use first fee
                                                                if (!selectedClassFee) {
                                                                    selectedClassFee = classFeesArray[0];
                                                                    // Auto-update feeConfig if it wasn't set
                                                                    if (!feeConfig.class_fee_id && selectedClassFee) {
                                                                        setFeeConfig(prev => ({ ...prev, class_fee_id: selectedClassFee.id }));
                                                                    }
                                                                }
                                                            }
                                                            console.log('[Add Student Display] Class fees available:', classFeesArray.length);
                                                            console.log('[Add Student Display] feeConfig.class_fee_id:', feeConfig.class_fee_id);
                                                            console.log('[Add Student Display] Selected fee:', selectedClassFee ? { id: selectedClassFee.id, amount: selectedClassFee.amount } : 'none');
                                                            const categoryName = selectedClassFee?.fee_categories?.name || 'Class Fee';
                                                            const defaultAmount = selectedClassFee ? parseFloat(selectedClassFee.amount || 0) : 0;
                                                            const feeCycle = selectedClassFee?.fee_cycle || 'monthly';
                                                            const finalAmount = Math.max(0, defaultAmount - feeConfig.class_fee_discount);
                                                            return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [categoryName, ":"] }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultAmount.toFixed(2), "/", feeCycle] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: feeConfig.class_fee_discount, onChange: (e) => {
                                                                                    const discount = parseFloat(e.target.value) || 0;
                                                                                    setFeeConfig({ ...feeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                                                                }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", feeCycle] })] })] }));
                                                        })()] }), _jsxs("div", { className: "bg-green-50 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h5", { className: "font-semibold text-gray-700", children: "Transport Fee" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: feeConfig.transport_enabled, onChange: (e) => setFeeConfig({ ...feeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? feeConfig.transport_route_id : '' }), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Enable Transport" })] })] }), feeConfig.transport_enabled && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Route" }), _jsxs("select", { value: feeConfig.transport_route_id, onChange: (e) => setFeeConfig({ ...feeConfig, transport_route_id: e.target.value }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Transport Route" }), defaultFees.transport_routes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : '', " - \u20B9", route.fee?.total?.toFixed(2) || '0.00', "/", route.fee?.fee_cycle || 'monthly'] }, route.id)))] })] }), feeConfig.transport_route_id && (() => {
                                                                    const selectedRoute = defaultFees.transport_routes.find((r) => r.id === feeConfig.transport_route_id);
                                                                    const routeFee = selectedRoute?.fee;
                                                                    const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                                                                    const finalTransportAmount = Math.max(0, defaultTransportAmount - feeConfig.transport_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Route Fee:" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: feeConfig.transport_fee_discount, onChange: (e) => setFeeConfig({ ...feeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 }), className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] })] }));
                                                                })()] }))] }), defaultFees.custom_fees && Array.isArray(defaultFees.custom_fees) && defaultFees.custom_fees.length > 0 && (_jsxs("div", { className: "bg-purple-50 p-4 rounded-lg border border-purple-200", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-3", children: "Custom Fees" }), _jsx("div", { className: "space-y-3", children: defaultFees.custom_fees.map((customFee) => {
                                                                const feeConfigItem = feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id) || {
                                                                    custom_fee_id: customFee.id,
                                                                    discount: 0,
                                                                    is_exempt: false
                                                                };
                                                                const feeAmount = parseFloat(customFee.amount || 0);
                                                                const finalAmount = feeConfigItem.is_exempt ? 0 : Math.max(0, feeAmount - feeConfigItem.discount);
                                                                const classLabel = customFee.class_groups?.name || 'All Classes';
                                                                const feeName = customFee.fee_categories?.name || customFee.name || 'Custom Fee';
                                                                return (_jsxs("div", { className: "bg-white p-3 rounded border", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "font-medium text-sm", children: feeName }), _jsxs("span", { className: "text-xs text-gray-500 ml-2", children: ["(", classLabel, ")"] })] }), _jsxs("span", { className: "text-sm font-medium text-gray-600", children: ["\u20B9", feeAmount.toFixed(2), "/", customFee.fee_cycle || 'monthly'] })] }) }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer ml-3", children: [_jsx("input", { type: "checkbox", checked: feeConfigItem.is_exempt, onChange: (e) => {
                                                                                                const updatedCustomFees = feeConfig.custom_fees.map(f => f.custom_fee_id === customFee.id
                                                                                                    ? { ...f, is_exempt: e.target.checked, discount: e.target.checked ? 0 : f.discount }
                                                                                                    : f);
                                                                                                if (!feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                                                                                    updatedCustomFees.push({
                                                                                                        custom_fee_id: customFee.id,
                                                                                                        discount: 0,
                                                                                                        is_exempt: e.target.checked
                                                                                                    });
                                                                                                }
                                                                                                setFeeConfig({ ...feeConfig, custom_fees: updatedCustomFees });
                                                                                            }, className: "rounded" }), _jsx("span", { className: "text-xs text-gray-600", children: "Exempt" })] })] }), !feeConfigItem.is_exempt && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: feeAmount, value: feeConfigItem.discount, onChange: (e) => {
                                                                                                const discount = parseFloat(e.target.value) || 0;
                                                                                                const updatedCustomFees = feeConfig.custom_fees.map(f => f.custom_fee_id === customFee.id
                                                                                                    ? { ...f, discount: Math.min(discount, feeAmount) }
                                                                                                    : f);
                                                                                                if (!feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                                                                                    updatedCustomFees.push({
                                                                                                        custom_fee_id: customFee.id,
                                                                                                        discount: Math.min(discount, feeAmount),
                                                                                                        is_exempt: false
                                                                                                    });
                                                                                                }
                                                                                                setFeeConfig({ ...feeConfig, custom_fees: updatedCustomFees });
                                                                                            }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-xs font-semibold pt-1 border-t mt-1", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", customFee.fee_cycle || 'monthly'] })] })] })), feeConfigItem.is_exempt && (_jsx("div", { className: "text-xs text-red-600 font-semibold pt-1", children: "Student is exempt from this fee" }))] }, customFee.id));
                                                            }) })] }))] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "Select a class to configure fees" }))] })), _jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Parent/Guardian Information" }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Name *" }), _jsx("input", { type: "text", required: true, value: addStudentForm.guardian_name, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Full name of parent or guardian" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Phone Number *" }), _jsx("input", { type: "tel", required: true, value: addStudentForm.guardian_phone, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Phone number" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Email" }), _jsx("input", { type: "email", value: addStudentForm.guardian_email, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_email: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Email address (optional)" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Relationship" }), _jsxs("select", { value: addStudentForm.guardian_relationship, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_relationship: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "parent", children: "Parent" }), _jsx("option", { value: "guardian", children: "Guardian" }), _jsx("option", { value: "relative", children: "Relative" }), _jsx("option", { value: "other", children: "Other" })] })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "submit", disabled: usernameStatus.checking || usernameStatus.available === false, className: `flex-1 px-4 py-2 rounded-lg ${usernameStatus.checking || usernameStatus.available === false
                                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                                : 'bg-green-600 text-white hover:bg-green-700'}`, children: usernameStatus.checking ? 'Checking...' : 'Add Student' }), _jsx("button", { type: "button", onClick: () => {
                                                setAddStudentModalOpen(false);
                                                setAddStudentForm({
                                                    email: '',
                                                    password: '',
                                                    full_name: '',
                                                    username: '',
                                                    phone: '',
                                                    roll_number: '',
                                                    class_group_id: '',
                                                    section_id: '',
                                                    admission_date: '',
                                                    gender: '',
                                                    date_of_birth: '',
                                                    home_address: '',
                                                    guardian_name: '',
                                                    guardian_phone: '',
                                                    guardian_email: '',
                                                    guardian_relationship: 'parent'
                                                });
                                                setUsernameStatus({ checking: false, available: null, message: '' });
                                                setDefaultFees(null);
                                                setFeeConfig({
                                                    class_fee_id: '',
                                                    class_fee_discount: 0,
                                                    transport_enabled: true,
                                                    transport_route_id: '',
                                                    transport_fee_discount: 0,
                                                    other_fees: [],
                                                    custom_fees: []
                                                });
                                            }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] })] }) })), promoteClassModalOpen && selectedClassId && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Promote Entire Class" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "This will move all active students from the current class to the target class." }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Target Class" }), _jsxs("select", { value: promoteClassForm.target_class_id, onChange: (e) => setPromoteClassForm({ ...promoteClassForm, target_class_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Target Class" }), allClasses.filter(cls => cls.id !== selectedClassId).map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: promoteClassForm.clear_sections, onChange: (e) => setPromoteClassForm({ ...promoteClassForm, clear_sections: e.target.checked }) }), _jsx("span", { className: "text-sm", children: "Clear section assignments" })] }) })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handlePromoteClassSubmit, className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Promote Class" }), _jsx("button", { onClick: () => setPromoteClassModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) }))] }));
}
// Helper functions for examples
const getExamplePlaceholder = (typeName) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('grade'))
        return 'Grade 9, Grade 10, Grade 11';
    if (lower.includes('section'))
        return 'A, B, C, D';
    if (lower.includes('house'))
        return 'Blue House, Red House, Green House';
    if (lower.includes('gender'))
        return 'Boys, Girls, Mixed';
    if (lower.includes('stream'))
        return 'Science, Arts, Commerce';
    if (lower.includes('level'))
        return 'Junior, Senior, Advanced';
    return 'Enter value';
};
const getExampleHint = (typeName) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('grade'))
        return 'Examples: Grade 9, Grade 10, Grade 11, Grade 12';
    if (lower.includes('section'))
        return 'Examples: A, B, C, D, E';
    if (lower.includes('house'))
        return 'Examples: Blue House, Red House, Green House, Yellow House';
    if (lower.includes('gender'))
        return 'Examples: Boys, Girls, Mixed';
    if (lower.includes('stream'))
        return 'Examples: Science, Arts, Commerce, Vocational';
    if (lower.includes('level'))
        return 'Examples: Junior Group, Senior Group, Advanced';
    return 'Enter a value for this classification type';
};
function ClassificationsManagement() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [showValueModal, setShowValueModal] = useState(false);
    const [selectedTypeId, setSelectedTypeId] = useState(null);
    const [typeForm, setTypeForm] = useState({ name: '' });
    const [valueForm, setValueForm] = useState({ value: '' });
    const [valuesMap, setValuesMap] = useState({});
    useEffect(() => {
        loadTypes();
    }, []);
    const loadTypes = async () => {
        try {
            setError(null);
            setLoading(true);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setError('No authentication token found. Please log in again.');
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/classifications/types`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load classification types' }));
                throw new Error(errorData.error || `Failed to load classification types: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            setTypes(data.types || []);
            // Load values for each type
            for (const type of data.types || []) {
                loadValuesForType(type.id);
            }
        }
        catch (error) {
            console.error('Error loading types:', error);
            setError(error.message || 'Failed to load classification types. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const loadValuesForType = async (typeId) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/types/${typeId}/values`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                return;
            const data = await response.json();
            setValuesMap(prev => ({ ...prev, [typeId]: data.values || [] }));
        }
        catch (error) {
            console.error('Error loading values:', error);
        }
    };
    const handleCreateType = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/types`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ name: typeForm.name }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create classification type');
            }
            setTypeForm({ name: '' });
            setShowTypeModal(false);
            loadTypes();
        }
        catch (error) {
            alert(error.message || 'Failed to create classification type');
        }
    };
    const handleCreateValue = async (e) => {
        e.preventDefault();
        if (!selectedTypeId)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/values`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    classification_type_id: selectedTypeId,
                    value: valueForm.value,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create classification value');
            }
            setValueForm({ value: '' });
            setShowValueModal(false);
            setSelectedTypeId(null);
            loadValuesForType(selectedTypeId);
        }
        catch (error) {
            alert(error.message || 'Failed to create classification value');
        }
    };
    const handleDeleteType = async (typeId) => {
        if (!confirm('Are you sure you want to delete this classification type? All values will be deleted.'))
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/types/${typeId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Failed to delete classification type');
            loadTypes();
        }
        catch (error) {
            alert(error.message || 'Failed to delete classification type');
        }
    };
    const handleDeleteValue = async (valueId, typeId) => {
        if (!confirm('Are you sure you want to delete this value?'))
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classifications/values/${valueId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Failed to delete classification value');
            loadValuesForType(typeId);
        }
        catch (error) {
            alert(error.message || 'Failed to delete classification value');
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading classifications..." });
    if (error) {
        return (_jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("span", { className: "text-red-600 text-xl mr-2", children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("h3", { className: "text-red-800 font-semibold", children: "Error Loading Classifications" }), _jsx("p", { className: "text-red-600 text-sm mt-1", children: error })] })] }), _jsx("button", { onClick: () => {
                            setError(null);
                            loadTypes();
                        }, className: "mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700", children: "Retry" })] }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-start mb-6", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-3xl font-bold mb-2", children: "Dynamic Class Classifications" }), _jsx("p", { className: "text-gray-600 mb-3", children: "Create custom classification types to organize your classes. Each school can define their own structure." }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4", children: [_jsx("h4", { className: "font-semibold text-blue-900 mb-2", children: "\uD83D\uDCA1 Examples:" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1 list-disc list-inside", children: [_jsxs("li", { children: [_jsx("strong", { children: "Gender-based:" }), " Create type \"Gender\" with values \"Boys\", \"Girls\" \u2192 Classes: \"Grade 9 \u2013 Boys\", \"Grade 9 \u2013 Girls\""] }), _jsxs("li", { children: [_jsx("strong", { children: "House system:" }), " Create type \"House\" with values \"Blue House\", \"Red House\", \"Green House\""] }), _jsxs("li", { children: [_jsx("strong", { children: "Section-based:" }), " Create type \"Section\" with values \"A\", \"B\", \"C\""] }), _jsxs("li", { children: [_jsx("strong", { children: "Custom:" }), " Create type \"Level\" with values \"Junior Group\", \"Senior Group\""] })] })] })] }), _jsx("button", { onClick: () => setShowTypeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md", children: "+ Add Classification Type" })] }), _jsxs("div", { className: "space-y-6", children: [types.map((type) => (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow", children: [_jsxs("div", { className: "flex justify-between items-center mb-4 pb-4 border-b border-gray-200", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-900", children: type.name }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [valuesMap[type.id]?.length || 0, " value", (valuesMap[type.id]?.length || 0) !== 1 ? 's' : '', " defined"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                                    setSelectedTypeId(type.id);
                                                    setShowValueModal(true);
                                                }, className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm", children: "+ Add Value" }), _jsx("button", { onClick: () => handleDeleteType(type.id), className: "bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm", children: "Delete Type" })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [(valuesMap[type.id] || []).map((value) => (_jsxs("div", { className: "flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition-shadow", children: [_jsx("span", { className: "text-sm font-medium text-blue-900", children: value.value }), _jsx("button", { onClick: () => handleDeleteValue(value.id, type.id), className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold transition-colors", title: "Delete value", children: "\u00D7" })] }, value.id))), (!valuesMap[type.id] || valuesMap[type.id].length === 0) && (_jsx("div", { className: "w-full text-center py-4", children: _jsx("span", { className: "text-gray-400 text-sm italic", children: "No values yet. Click \"+ Add Value\" to create one." }) }))] })] }, type.id))), types.length === 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83C\uDFF7\uFE0F" }), _jsx("h3", { className: "text-xl font-semibold text-gray-700 mb-2", children: "No Classification Types Yet" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Create your first classification type to start organizing your classes." }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "For example: \"Grade\", \"Section\", \"House\", \"Gender\", or any custom category your school uses." }), _jsx("button", { onClick: () => setShowTypeModal(true), className: "bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium shadow-md", children: "Create Your First Classification Type" })] }))] }), showTypeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-96", children: [_jsx("h3", { className: "text-xl font-bold mb-2", children: "Create Classification Type" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Define a category for classifying your classes (e.g., \"Grade\", \"Section\", \"House\", \"Gender\")" }), _jsxs("form", { onSubmit: handleCreateType, children: [_jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Type Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: typeForm.name, onChange: (e) => setTypeForm({ name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: "e.g., Grade, Section, House, Gender, Stream", required: true }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Examples: Grade, Section, House, Gender, Stream, Level, Group" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Create" }), _jsx("button", { type: "button", onClick: () => setShowTypeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showValueModal && selectedTypeId && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-2", children: ["Add Value to ", types.find(t => t.id === selectedTypeId)?.name] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Add a specific value for this classification type. You can add multiple values." }), _jsxs("form", { onSubmit: handleCreateValue, children: [_jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Value ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: valueForm.value, onChange: (e) => setValueForm({ value: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: getExamplePlaceholder(types.find(t => t.id === selectedTypeId)?.name || ''), required: true }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: getExampleHint(types.find(t => t.id === selectedTypeId)?.name || '') })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Add" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowValueModal(false);
                                                setSelectedTypeId(null);
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
}
function ExamsManagement() {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        term: '',
        schedule: [],
        class_group_ids: []
    });
    const [applyToAllClasses, setApplyToAllClasses] = useState(true);
    useEffect(() => {
        loadExams();
        loadClasses();
        loadSubjects();
    }, []);
    const loadClasses = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/classes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setClasses(data.classes || []);
            }
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
    };
    const loadSubjects = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/subjects`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setSubjects(data.subjects || []);
            }
        }
        catch (error) {
            console.error('Error loading subjects:', error);
        }
    };
    const loadExams = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/exams`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load exams');
            }
            const data = await response.json();
            setExams(data.exams || []);
        }
        catch (error) {
            console.error('Error loading exams:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreateExam = async (e) => {
        e.preventDefault();
        // Validate schedule
        if (formData.schedule.length === 0) {
            alert('Please add at least one subject to the schedule');
            return;
        }
        // Validate all schedule entries
        for (const entry of formData.schedule) {
            if (!entry.subject_id || !entry.exam_date || !entry.time_from || !entry.time_to) {
                alert('Please fill in all fields for each schedule entry');
                return;
            }
            // Validate time_from < time_to
            if (entry.time_from >= entry.time_to) {
                alert('End time must be after start time');
                return;
            }
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                alert('Please login to continue');
                return;
            }
            const payload = {
                name: formData.name,
                term: formData.term || null,
                schedule: formData.schedule,
            };
            // Only include class_group_ids if not applying to all classes
            if (!applyToAllClasses && formData.class_group_ids.length > 0) {
                payload.class_group_ids = formData.class_group_ids;
            }
            const response = await fetch(`${API_URL}/exams`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create exam');
            }
            setFormData({
                name: '',
                term: '',
                schedule: [],
                class_group_ids: []
            });
            setApplyToAllClasses(true);
            setShowModal(false);
            loadExams();
            alert('Exam created successfully!');
        }
        catch (error) {
            alert(error.message || 'Failed to create exam');
        }
    };
    const addScheduleEntry = () => {
        setFormData({
            ...formData,
            schedule: [...formData.schedule, { subject_id: '', exam_date: '', time_from: '', time_to: '' }]
        });
    };
    const removeScheduleEntry = (index) => {
        setFormData({
            ...formData,
            schedule: formData.schedule.filter((_, i) => i !== index)
        });
    };
    const updateScheduleEntry = (index, field, value) => {
        const newSchedule = [...formData.schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setFormData({ ...formData, schedule: newSchedule });
    };
    const getExamClassesDisplay = (exam) => {
        const examClasses = exam.exam_classes || [];
        if (examClasses.length === 0) {
            return _jsx("span", { className: "text-gray-500", children: "All Classes" });
        }
        return (_jsx("div", { className: "flex flex-wrap gap-1", children: examClasses.map((ec, idx) => (_jsx("span", { className: "bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded", children: ec.class_group?.name }, idx))) }));
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading..." });
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Exams Management" }), _jsx("button", { onClick: () => {
                            setShowModal(true);
                            setFormData({
                                name: '',
                                term: '',
                                schedule: [],
                                class_group_ids: []
                            });
                            setApplyToAllClasses(true);
                        }, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Create Exam" })] }), showModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Create New Exam - Date Sheet" }), _jsxs("form", { onSubmit: handleCreateExam, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Exam Name *" }), _jsx("input", { type: "text", value: formData.name, onChange: (e) => setFormData({ ...formData, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, placeholder: "e.g., Mid-Term Exam, Final Exam" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Term (Optional)" }), _jsx("input", { type: "text", value: formData.term, onChange: (e) => setFormData({ ...formData, term: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", placeholder: "e.g., Term 1, Semester 1" })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700", children: "Exam Schedule *" }), _jsx("button", { type: "button", onClick: addScheduleEntry, className: "text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700", children: "+ Add Subject" })] }), _jsxs("div", { className: "space-y-3", children: [formData.schedule.map((entry, index) => (_jsxs("div", { className: "border border-gray-300 rounded-lg p-4 bg-gray-50", children: [_jsxs("div", { className: "flex justify-between items-center mb-3", children: [_jsxs("span", { className: "text-sm font-medium text-gray-700", children: ["Subject ", index + 1] }), _jsx("button", { type: "button", onClick: () => removeScheduleEntry(index), className: "text-red-600 hover:text-red-800 text-sm", children: "Remove" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 mb-1", children: "Subject *" }), _jsxs("select", { value: entry.subject_id, onChange: (e) => updateScheduleEntry(index, 'subject_id', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", required: true, children: [_jsx("option", { value: "", children: "Select Subject" }), subjects.map((subject) => (_jsxs("option", { value: subject.id, children: [subject.name, " ", subject.code ? `(${subject.code})` : ''] }, subject.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 mb-1", children: "Date *" }), _jsx("input", { type: "date", value: entry.exam_date, onChange: (e) => updateScheduleEntry(index, 'exam_date', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 mb-1", children: "Time From *" }), _jsx("input", { type: "time", value: entry.time_from, onChange: (e) => updateScheduleEntry(index, 'time_from', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-gray-600 mb-1", children: "Time To *" }), _jsx("input", { type: "time", value: entry.time_to, onChange: (e) => updateScheduleEntry(index, 'time_to', e.target.value), className: "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm", required: true })] })] })] }, index))), formData.schedule.length === 0 && (_jsx("div", { className: "text-center py-8 text-gray-500 border border-gray-300 rounded-lg", children: "No subjects added. Click \"Add Subject\" to create the date sheet." }))] })] }), _jsx("div", { className: "mb-4", children: _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: applyToAllClasses, onChange: (e) => {
                                                    setApplyToAllClasses(e.target.checked);
                                                    if (e.target.checked) {
                                                        setFormData({ ...formData, class_group_ids: [] });
                                                    }
                                                }, className: "rounded" }), _jsx("span", { className: "text-sm font-medium text-gray-700", children: "Apply to All Classes" })] }) }), !applyToAllClasses && (_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Classes" }), _jsx("div", { className: "border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto", children: classes.map((cls) => (_jsxs("label", { className: "flex items-center space-x-2 mb-2", children: [_jsx("input", { type: "checkbox", checked: formData.class_group_ids.includes(cls.id), onChange: (e) => {
                                                            if (e.target.checked) {
                                                                setFormData({
                                                                    ...formData,
                                                                    class_group_ids: [...formData.class_group_ids, cls.id]
                                                                });
                                                            }
                                                            else {
                                                                setFormData({
                                                                    ...formData,
                                                                    class_group_ids: formData.class_group_ids.filter(id => id !== cls.id)
                                                                });
                                                            }
                                                        }, className: "rounded" }), _jsx("span", { className: "text-sm text-gray-700", children: cls.name })] }, cls.id))) })] })), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Create Exam" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowModal(false);
                                                setFormData({
                                                    name: '',
                                                    term: '',
                                                    schedule: [],
                                                    class_group_ids: []
                                                });
                                                setApplyToAllClasses(true);
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Exam Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Term" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Start Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "End Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Schedule" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Classes" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: exams.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No exams created yet. Click \"Create Exam\" to get started." }) })) : (exams.map((exam) => {
                                const schedule = exam.exam_schedule || [];
                                const sortedSchedule = [...schedule].sort((a, b) => {
                                    const dateA = new Date(a.exam_date).getTime();
                                    const dateB = new Date(b.exam_date).getTime();
                                    if (dateA !== dateB)
                                        return dateA - dateB;
                                    return a.time_from.localeCompare(b.time_from);
                                });
                                return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: exam.name }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-500", children: exam.term || '-' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: new Date(exam.start_date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: new Date(exam.end_date).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            }) }), _jsx("td", { className: "px-6 py-4", children: sortedSchedule.length > 0 ? (_jsx("div", { className: "text-sm space-y-1 max-w-md", children: sortedSchedule.map((entry, idx) => (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "font-medium text-gray-900", children: entry.subject?.name || 'Unknown Subject' }), _jsx("span", { className: "text-gray-500", children: new Date(entry.exam_date).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric'
                                                            }) }), _jsxs("span", { className: "text-gray-500", children: [entry.time_from, " - ", entry.time_to] })] }, idx))) })) : (_jsx("span", { className: "text-sm text-gray-400", children: "No schedule" })) }), _jsx("td", { className: "px-6 py-4", children: getExamClassesDisplay(exam) })] }, exam.id));
                            })) })] }) })] }));
}
function SalaryManagement() {
    const [teachers, setTeachers] = useState([]);
    const [salaryStructures, setSalaryStructures] = useState([]);
    const [salaryRecords, setSalaryRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('structure');
    const [unpaidTeachers, setUnpaidTeachers] = useState([]);
    const [expandedTeachers, setExpandedTeachers] = useState(new Set());
    // Structure form
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState(null); // Track if editing existing structure
    const [structureForm, setStructureForm] = useState({
        teacher_id: '',
        base_salary: '',
        hra: '',
        other_allowances: '',
        fixed_deductions: '',
        salary_cycle: 'monthly',
        attendance_based_deduction: false,
        effective_from_date: '' // Effective from date for new/edited structure
    });
    useEffect(() => {
        loadData();
    }, []);
    useEffect(() => {
        if (activeTab === 'unpaid') {
            loadUnpaidSalaries();
        }
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, [activeTab]);
    const loadData = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const [teachersRes, structuresRes] = await Promise.all([
                fetch(`${API_URL}/staff-admin`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/salary/structures`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (teachersRes.ok) {
                const data = await teachersRes.json();
                setTeachers(data.staff?.filter((s) => s.role === 'teacher') || []);
            }
            if (structuresRes.ok) {
                const data = await structuresRes.json();
                setSalaryStructures(data.structures || []);
            }
        }
        catch (error) {
            console.error('Error loading salary data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadUnpaidSalaries = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/unpaid?time_scope=last_12_months`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUnpaidTeachers(data.teachers || []);
            }
            else {
                console.error('Error loading unpaid salaries:', await response.json().catch(() => ({})));
                setUnpaidTeachers([]);
            }
        }
        catch (error) {
            console.error('Error loading unpaid salaries:', error);
            setUnpaidTeachers([]);
        }
    };
    const toggleTeacherExpansion = (teacherId) => {
        const newExpanded = new Set(expandedTeachers);
        if (newExpanded.has(teacherId)) {
            newExpanded.delete(teacherId);
        }
        else {
            newExpanded.add(teacherId);
        }
        setExpandedTeachers(newExpanded);
    };
    const handleSaveStructure = async (e) => {
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
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/structure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...structureForm,
                    base_salary: parseFloat(structureForm.base_salary),
                    hra: parseFloat(structureForm.hra) || 0,
                    other_allowances: parseFloat(structureForm.other_allowances) || 0,
                    fixed_deductions: parseFloat(structureForm.fixed_deductions) || 0,
                    effective_from_date: structureForm.effective_from_date
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save structure');
            }
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
        }
        catch (error) {
            alert(error.message || 'Failed to save structure');
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading..." });
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex justify-between items-center mb-6", children: _jsx("h2", { className: "text-3xl font-bold", children: "Salary Management" }) }), _jsx("div", { className: "flex space-x-2 mb-6 border-b", children: [
                    { id: 'structure', label: 'Salary Structure' },
                    { id: 'unpaid', label: 'Unpaid Salaries' },
                    { id: 'records', label: 'All Records' },
                    { id: 'reports', label: 'Reports' }
                ].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-4 py-2 font-medium ${activeTab === tab.id
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'}`, children: tab.label }, tab.id))) }), activeTab === 'structure' && (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Teacher Salary Structures" }), _jsx("button", { onClick: () => {
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
                                }, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Set Salary Structure" })] }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Base Salary" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "HRA" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Allowances" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Attendance Deduction" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryStructures.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No salary structures set. Click \"Set Salary Structure\" to get started." }) })) : (salaryStructures.map((structure) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: structure.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.base_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.hra.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.other_allowances.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.fixed_deductions.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: structure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => {
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
                                                    }, className: "text-blue-600 hover:text-blue-900", children: "Edit" }) })] }, structure.id)))) })] }) })] })), activeTab === 'records' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "All Salary Records" }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month/Year" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Gross" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Date" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryRecords.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No salary records found" }) })) : (salaryRecords.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: record.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: [new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' }), " ", record.year] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.gross_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.total_deductions.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", record.net_salary.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        record.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            'bg-blue-100 text-blue-800'}`, children: record.status }) }), _jsx("td", { className: "px-6 py-4", children: record.payment_date ? new Date(record.payment_date).toLocaleDateString() : '-' })] }, record.id)))) })] }) })] })), activeTab === 'unpaid' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Unpaid Teacher Salaries (Month-wise)" }), _jsx("p", { className: "text-gray-600 mb-6", children: "View all unpaid salary months for teachers, including months where salary records were not generated." }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Unpaid Months" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Total Unpaid" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Oldest Unpaid" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: unpaidTeachers.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No teachers with unpaid salaries. All teachers are up to date with their payments." }) })) : (unpaidTeachers.map((teacher) => {
                                        const isExpanded = expandedTeachers.has(teacher.teacher_id);
                                        return (_jsxs(_Fragment, { children: [_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4", children: teacher.unpaid_months_count > 0 && (_jsx("button", { onClick: () => toggleTeacherExpansion(teacher.teacher_id), className: "text-gray-500 hover:text-gray-700", children: isExpanded ? (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })) : (_jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })) })) }), _jsx("td", { className: "px-6 py-4 font-medium", children: teacher.teacher_name || 'Unknown' }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-600", children: teacher.teacher_email || '-' }), _jsx("td", { className: "px-6 py-4", children: _jsxs("span", { className: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800", children: [teacher.unpaid_months_count, " ", teacher.unpaid_months_count === 1 ? 'month' : 'months'] }) }), _jsxs("td", { className: "px-6 py-4 font-semibold text-orange-600", children: ["\u20B9", teacher.total_unpaid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), _jsx("td", { className: "px-6 py-4 text-sm text-gray-600", children: teacher.oldest_unpaid_month ? (_jsxs("div", { children: [_jsx("div", { children: teacher.oldest_unpaid_month.period_label }), _jsxs("div", { className: "text-xs text-red-600", children: [teacher.oldest_unpaid_month.days_since_period_start, " days overdue"] })] })) : '-' })] }, teacher.teacher_id), isExpanded && teacher.unpaid_months && teacher.unpaid_months.length > 0 && (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 bg-gray-50", children: _jsxs("div", { className: "ml-8", children: [_jsx("h4", { className: "text-sm font-semibold text-gray-700 mb-3", children: "Monthly Breakdown:" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-100", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Month" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Status" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Amount" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Days Overdue" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase", children: "Notes" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: teacher.unpaid_months.map((month, idx) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm font-medium", children: month.period_label }), _jsx("td", { className: "px-4 py-2", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${month.payment_status === 'paid'
                                                                                                    ? 'bg-green-100 text-green-800'
                                                                                                    : month.payment_status === 'partially-paid'
                                                                                                        ? 'bg-yellow-100 text-yellow-800'
                                                                                                        : 'bg-orange-100 text-orange-800'}`, children: month.payment_status === 'paid' ? 'Paid' :
                                                                                                    month.payment_status === 'partially-paid' ? 'Partially Paid' :
                                                                                                        'Unpaid' }) }), _jsxs("td", { className: "px-4 py-2 text-sm", children: [_jsxs("div", { className: "font-semibold", children: ["\u20B9", month.net_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }), month.paid_amount > 0 && (_jsxs("div", { className: "text-xs text-green-600", children: ["Cash: \u20B9", month.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })), month.credit_applied > 0 && (_jsxs("div", { className: "text-xs text-blue-600", children: ["Credit: \u20B9", month.credit_applied.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })), month.effective_paid_amount > 0 && month.effective_paid_amount !== month.paid_amount && (_jsxs("div", { className: "text-xs text-gray-600 font-medium", children: ["Total: \u20B9", month.effective_paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })), month.pending_amount > 0 && (_jsxs("div", { className: "text-xs text-orange-600", children: ["Pending: \u20B9", month.pending_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] }))] }), _jsx("td", { className: "px-4 py-2 text-sm", children: month.days_since_period_start > 0 ? (_jsxs("span", { className: "text-red-600 font-medium", children: [month.days_since_period_start, " days"] })) : (_jsx("span", { className: "text-gray-500", children: "-" })) }), _jsxs("td", { className: "px-4 py-2 text-xs text-gray-500", children: [month.payment_date && (_jsxs("span", { children: ["Last payment: ", new Date(month.payment_date).toLocaleDateString()] })), !month.payment_date && month.payment_status === 'unpaid' && (_jsx("span", { className: "text-orange-600", children: "No payment recorded" }))] })] }, `${month.year}-${month.month}-${idx}`))) })] }) })] }) }) }))] }));
                                    })) })] }) })] })), activeTab === 'reports' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Salary Reports & Analytics" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Monthly Summary" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Paid:" }), _jsxs("span", { className: "font-semibold text-green-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'paid').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Pending:" }), _jsxs("span", { className: "font-semibold text-yellow-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'pending').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Approved:" }), _jsxs("span", { className: "font-semibold text-blue-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'approved').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Attendance Deduction:" }), _jsxs("span", { className: "font-semibold text-red-600", children: ["\u20B9", (salaryRecords.reduce((sum, r) => sum + parseFloat(r.attendance_deduction || 0), 0)).toLocaleString()] })] })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Statistics" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Paid Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'paid').length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Pending Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'pending').length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Approved Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'approved').length })] })] })] })] })] })), showStructureModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: selectedTeacherForEdit ? 'Edit Salary Structure' : 'Set Salary Structure' }), _jsxs("form", { onSubmit: handleSaveStructure, className: "space-y-4", children: [_jsxs("div", { className: "mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Effective From Date *" }), _jsx("input", { type: "date", required: true, value: structureForm.effective_from_date || '', onChange: (e) => setStructureForm({ ...structureForm, effective_from_date: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-md", min: selectedTeacherForEdit ? undefined : new Date().toISOString().split('T')[0] }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: selectedTeacherForEdit
                                                ? 'The new salary structure will be effective from this date. Previous salary structure remains unchanged for all months before this date.'
                                                : 'The salary structure will be effective from this date. Choose the date from which salary should start.' })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Teacher *" }), _jsxs("select", { value: structureForm.teacher_id, onChange: (e) => setStructureForm({ ...structureForm, teacher_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Teacher" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.full_name }, teacher.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Base Salary (\u20B9) *" }), _jsx("input", { type: "number", value: structureForm.base_salary, onChange: (e) => setStructureForm({ ...structureForm, base_salary: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "HRA (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.hra, onChange: (e) => setStructureForm({ ...structureForm, hra: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Other Allowances (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.other_allowances, onChange: (e) => setStructureForm({ ...structureForm, other_allowances: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fixed Deductions (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.fixed_deductions, onChange: (e) => setStructureForm({ ...structureForm, fixed_deductions: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Salary Cycle" }), _jsxs("select", { value: structureForm.salary_cycle, onChange: (e) => setStructureForm({ ...structureForm, salary_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "biweekly", children: "Bi-weekly" })] })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: structureForm.attendance_based_deduction, onChange: (e) => setStructureForm({ ...structureForm, attendance_based_deduction: e.target.checked }), className: "rounded" }), _jsx("span", { className: "text-sm font-medium", children: "Enable Attendance-Based Deduction" })] }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save Structure" }), _jsx("button", { type: "button", onClick: () => {
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
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
}
function FeeManagement({ userRole = 'principal' }) {
    const [activeTab, setActiveTab] = useState('class-fees');
    const [loading, setLoading] = useState(false);
    const isClerk = userRole === 'clerk';
    // Fee Categories removed - no longer used
    // Class Fees
    const [classGroups, setClassGroups] = useState([]);
    const [classFees, setClassFees] = useState([]);
    const [showClassFeeModal, setShowClassFeeModal] = useState(false);
    const [classFeeForm, setClassFeeForm] = useState({
        class_group_id: '',
        name: '',
        amount: '',
        fee_cycle: 'monthly',
        due_day: 5,
        notes: ''
    });
    // Custom Fees
    const [customFees, setCustomFees] = useState([]);
    const [showCustomFeeModal, setShowCustomFeeModal] = useState(false);
    const [customFeeForm, setCustomFeeForm] = useState({
        class_group_id: '', // Empty string = all classes, or specific class ID
        name: '',
        amount: '',
        fee_cycle: 'monthly'
    });
    // Transport
    const [transportRoutes, setTransportRoutes] = useState([]);
    const [transportFees, setTransportFees] = useState([]);
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [routeForm, setRouteForm] = useState({ route_name: '', bus_number: '', distance_km: '', zone: '', description: '' });
    const [showTransportFeeModal, setShowTransportFeeModal] = useState(false);
    const [transportFeeForm, setTransportFeeForm] = useState({
        route_id: '',
        base_fee: '',
        escort_fee: '0',
        fuel_surcharge: '0',
        fee_cycle: 'monthly',
        due_day: 5,
        notes: ''
    });
    // Optional Fees - REMOVED
    // Custom Fees - REMOVED
    // Bills - REMOVED
    // Students still needed for other features
    const [students, setStudents] = useState([]);
    // Fee Tracking
    const [feeTracking, setFeeTracking] = useState([]);
    const [selectedTrackingStudent, setSelectedTrackingStudent] = useState(null);
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [generateBillForm, setGenerateBillForm] = useState({
        student_id: '',
        class_group_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });
    // Payments - REMOVED
    // Fee Hikes
    const [selectedFeeForHike, setSelectedFeeForHike] = useState(null);
    const [showHikeModal, setShowHikeModal] = useState(false);
    const [hikeForm, setHikeForm] = useState({
        new_amount: '',
        effective_from_date: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [feeVersions, setFeeVersions] = useState([]);
    useEffect(() => {
        loadInitialData();
    }, []);
    useEffect(() => {
        if (activeTab === 'class-fees') {
            loadClassFees();
        }
        else if (activeTab === 'custom-fees') {
            loadCustomFees();
        }
        else if (activeTab === 'transport')
            loadTransportData();
        else if (activeTab === 'tracking')
            loadFeeTracking();
        else if (activeTab === 'hikes') {
            // Load all fee types for hikes tab
            loadClassFees();
            loadTransportData();
            loadCustomFees();
        }
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, [activeTab]);
    const loadInitialData = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const [classesRes, studentsRes] = await Promise.all([
                fetch(`${API_URL}/classes`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/students-admin`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (classesRes.ok) {
                const data = await classesRes.json();
                setClassGroups(data.classes || []);
            }
            if (studentsRes.ok) {
                const data = await studentsRes.json();
                setStudents(data.students || []);
            }
        }
        catch (error) {
            console.error('Error loading initial data:', error);
        }
    };
    // loadFeeCategories removed - no longer needed
    const loadClassFees = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/class-fees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setClassFees(data.class_fees || []);
            }
        }
        catch (error) {
            console.error('Error loading class fees:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadCustomFees = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/custom-fees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setCustomFees(data.custom_fees || []);
            }
        }
        catch (error) {
            console.error('Error loading custom fees:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadTransportData = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const [routesRes, feesRes] = await Promise.all([
                fetch(`${API_URL}/fees/transport/routes`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/fees/transport/fees`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (routesRes.ok) {
                const data = await routesRes.json();
                setTransportRoutes(data.routes || []);
            }
            if (feesRes.ok) {
                const data = await feesRes.json();
                setTransportFees(data.transport_fees || []);
            }
        }
        catch (error) {
            console.error('Error loading transport data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    // loadOptionalFees, loadBills, loadPayments - REMOVED
    const handleSaveClassFee = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/class-fees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...classFeeForm,
                    amount: parseFloat(classFeeForm.amount),
                    due_day: parseInt(classFeeForm.due_day.toString()),
                    fee_category_id: null // Not used anymore
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save class fee');
            }
            alert('Class fee saved successfully!');
            setShowClassFeeModal(false);
            setClassFeeForm({
                class_group_id: '',
                name: '',
                amount: '',
                fee_cycle: 'monthly',
                due_day: 5,
                notes: ''
            });
            loadClassFees();
        }
        catch (error) {
            alert(error.message || 'Failed to save class fee');
        }
    };
    const handleSaveCustomFee = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/custom-fees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...customFeeForm,
                    amount: parseFloat(customFeeForm.amount)
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save custom fee');
            }
            alert('Custom fee saved successfully!');
            setShowCustomFeeModal(false);
            setCustomFeeForm({
                class_group_id: '',
                name: '',
                amount: '',
                fee_cycle: 'monthly'
            });
            loadCustomFees();
        }
        catch (error) {
            alert(error.message || 'Failed to save custom fee');
        }
    };
    const handleSaveRoute = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/transport/routes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...routeForm,
                    distance_km: routeForm.distance_km ? parseFloat(routeForm.distance_km) : null
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save route');
            }
            alert('Transport route saved successfully!');
            setShowRouteModal(false);
            setRouteForm({ route_name: '', bus_number: '', distance_km: '', zone: '', description: '' });
            loadTransportData();
        }
        catch (error) {
            alert(error.message || 'Failed to save route');
        }
    };
    const handleSaveTransportFee = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/transport/fees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...transportFeeForm,
                    base_fee: parseFloat(transportFeeForm.base_fee),
                    escort_fee: parseFloat(transportFeeForm.escort_fee) || 0,
                    fuel_surcharge: parseFloat(transportFeeForm.fuel_surcharge) || 0,
                    due_day: parseInt(transportFeeForm.due_day.toString())
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save transport fee');
            }
            alert('Transport fee saved successfully!');
            setShowTransportFeeModal(false);
            setTransportFeeForm({
                route_id: '',
                base_fee: '',
                escort_fee: '0',
                fuel_surcharge: '0',
                fee_cycle: 'monthly',
                due_day: 5,
                notes: ''
            });
            loadTransportData();
        }
        catch (error) {
            alert(error.message || 'Failed to save transport fee');
        }
    };
    // handleSaveOptionalFee, handleSaveCustomFee, handleGenerateBills, handleSavePayment, viewBill - REMOVED
    const loadFeeTracking = async () => {
        // Fee tracking simplified - bills and payments removed
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get all students with their class and transport fees
            const [studentsRes] = await Promise.all([
                fetch(`${API_URL}/students`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (studentsRes.ok) {
                const studentsData = await studentsRes.json();
                // Create simplified fee tracking data
                const feeTrackingData = (studentsData.students || []).map((student) => ({
                    student: student,
                    total_assigned: 0,
                    total_paid: 0,
                    pending_amount: 0,
                    transport_amount: 0
                }));
                setFeeTracking(feeTrackingData);
            }
        }
        catch (error) {
            console.error('Error loading fee tracking:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleHikeFee = async (fee, feeType) => {
        setSelectedFeeForHike({ ...fee, feeType });
        setHikeForm({
            new_amount: fee.amount?.toString() || '',
            effective_from_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setShowHikeModal(true);
        // Load version history
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            let url = '';
            if (feeType === 'class') {
                url = `${API_URL}/fees/class-fees/${fee.id}/versions`;
            }
            else if (feeType === 'transport') {
                url = `${API_URL}/fees/transport/fees/${fee.id}/versions`;
            }
            else if (feeType === 'custom') {
                url = `${API_URL}/fees/custom-fees/${fee.id}/versions`;
            }
            if (url) {
                const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (response.ok) {
                    const data = await response.json();
                    setFeeVersions(data.versions || []);
                }
            }
        }
        catch (error) {
            console.error('Error loading fee versions:', error);
        }
    };
    const handleSubmitHike = async (e) => {
        e.preventDefault();
        if (!selectedFeeForHike)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            let url = '';
            if (selectedFeeForHike.feeType === 'class') {
                url = `${API_URL}/fees/class-fees/${selectedFeeForHike.id}/hike`;
            }
            else if (selectedFeeForHike.feeType === 'transport') {
                url = `${API_URL}/fees/transport/fees/${selectedFeeForHike.id}/hike`;
            }
            // Optional fees removed
            if (!url)
                return;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    new_amount: parseFloat(hikeForm.new_amount),
                    effective_from_date: hikeForm.effective_from_date,
                    notes: hikeForm.notes
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to hike fee');
            }
            alert('Fee hike applied successfully! Future bills will use the new amount.');
            setShowHikeModal(false);
            setSelectedFeeForHike(null);
            setHikeForm({
                new_amount: '',
                effective_from_date: new Date().toISOString().split('T')[0],
                notes: ''
            });
            // Reload fees
            if (activeTab === 'class-fees')
                loadClassFees();
            else if (activeTab === 'transport')
                loadTransportData();
            else if (activeTab === 'custom-fees')
                loadCustomFees();
            else if (activeTab === 'hikes') {
                // Reload all fee types for hikes tab
                loadClassFees();
                loadTransportData();
                loadCustomFees();
            }
        }
        catch (error) {
            alert(error.message || 'Failed to hike fee');
        }
    };
    if (loading) {
        return (_jsx("div", { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Fee Management" }), _jsx("div", { className: "bg-white rounded-lg shadow mb-6", children: _jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex -mb-px", children: [
                            ...(isClerk ? [] : [
                                { id: 'class-fees', label: 'Class Fees' },
                                { id: 'custom-fees', label: 'Custom Fees' },
                                { id: 'transport', label: 'Transport' },
                                { id: 'hikes', label: 'Fee Hikes' },
                            ]),
                            { id: 'tracking', label: 'Fee Tracking' }
                        ].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: tab.label }, tab.id))) }) }) }), activeTab === 'custom-fees' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Custom Fees" }), !isClerk && (_jsx("button", { onClick: () => setShowCustomFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Custom Fee" }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Effective From" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: customFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No custom fees found. Click \"Add Custom Fee\" to create one." }) })) : (customFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: fee.class_groups?.name || 'All Classes' }), _jsx("td", { className: "px-6 py-4", children: fee.fee_categories?.name || fee.name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toFixed(2)] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle || '-' }), _jsx("td", { className: "px-6 py-4 text-xs text-gray-500", children: fee.effective_from ? new Date(fee.effective_from).toLocaleDateString() : '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: async () => {
                                                        if (!confirm('Are you sure you want to delete this custom fee?'))
                                                            return;
                                                        try {
                                                            const token = (await supabase.auth.getSession()).data.session?.access_token;
                                                            if (!token)
                                                                return;
                                                            const response = await fetch(`${API_URL}/fees/custom-fees/${fee.id}`, {
                                                                method: 'DELETE',
                                                                headers: { Authorization: `Bearer ${token}` }
                                                            });
                                                            if (response.ok) {
                                                                alert('Custom fee deleted successfully!');
                                                                loadCustomFees();
                                                            }
                                                            else {
                                                                const error = await response.json();
                                                                throw new Error(error.error || 'Failed to delete custom fee');
                                                            }
                                                        }
                                                        catch (error) {
                                                            alert(error.message || 'Failed to delete custom fee');
                                                        }
                                                    }, className: "text-red-600 hover:text-red-800", children: "Delete" }) })] }, fee.id)))) })] }) })] })), activeTab === 'class-fees' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Class Fees" }), !isClerk && (_jsx("button", { onClick: () => setShowClassFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Class Fee" }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Due Day" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No class fees found. Click \"Add Class Fee\" to get started." }) })) : (classFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || '-' }), _jsx("td", { className: "px-6 py-4", children: fee.name || fee.fee_categories?.name || 'Class Fee' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: fee.due_day || '-' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })), activeTab === 'transport' && !isClerk && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Routes" }), !isClerk && (_jsx("button", { onClick: () => setShowRouteModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Route" }))] }), _jsx("div", { className: "overflow-x-auto mb-6", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bus Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Zone" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Distance" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportRoutes.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No transport routes found." }) })) : (transportRoutes.map((route) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: route.route_name }), _jsx("td", { className: "px-6 py-4", children: route.bus_number || '-' }), _jsx("td", { className: "px-6 py-4", children: route.zone || '-' }), _jsx("td", { className: "px-6 py-4", children: route.distance_km ? `${route.distance_km} km` : '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, route.id)))) })] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Fees" }), !isClerk && (_jsx("button", { onClick: () => setShowTransportFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Transport Fee" }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Base Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Escort Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fuel Surcharge" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No transport fees found." }) })) : (transportFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.transport_routes?.route_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.base_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.escort_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.fuel_surcharge || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })] })), activeTab === 'tracking' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Collection Tracking" }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("select", { value: filterClass, onChange: (e) => setFilterClass(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((cg) => (_jsx("option", { value: cg.id, children: cg.name }, cg.id)))] }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Status" }), _jsx("option", { value: "paid", children: "Paid" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "partial", children: "Partially Paid" })] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Assigned" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Paid" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pending Amount" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Transport Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: feeTracking
                                        .filter((track) => {
                                        if (filterClass && track.student?.class_group_id !== filterClass)
                                            return false;
                                        if (filterStatus === 'paid' && track.pending_amount > 0)
                                            return false;
                                        if (filterStatus === 'pending' && track.pending_amount === 0)
                                            return false;
                                        if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0))
                                            return false;
                                        return true;
                                    })
                                        .length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 9, className: "px-6 py-4 text-center text-gray-500", children: "No fee tracking data found." }) })) : (feeTracking
                                        .filter((track) => {
                                        if (filterClass && track.student?.class_group_id !== filterClass)
                                            return false;
                                        if (filterStatus === 'paid' && track.pending_amount > 0)
                                            return false;
                                        if (filterStatus === 'pending' && track.pending_amount === 0)
                                            return false;
                                        if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0))
                                            return false;
                                        return true;
                                    })
                                        .map((track) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: track.student?.profile?.full_name || '-' }), _jsx("td", { className: "px-6 py-4", children: track.student?.roll_number || '-' }), _jsx("td", { className: "px-6 py-4", children: track.student?.class_groups?.name || '-' }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(track.total_assigned || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-right text-green-600", children: ["\u20B9", parseFloat(track.total_paid || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold text-red-600", children: ["\u20B9", parseFloat(track.pending_amount || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-right", children: ["\u20B9", parseFloat(track.transport_amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${track.pending_amount === 0 ? 'bg-green-100 text-green-800' :
                                                        track.total_paid > 0 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-red-100 text-red-800'}`, children: track.pending_amount === 0 ? 'Paid' : track.total_paid > 0 ? 'Partial' : 'Pending' }) }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => {
                                                        setSelectedTrackingStudent(track);
                                                    }, className: "text-blue-600 hover:text-blue-800 mr-2", children: "View Details" }) })] }, track.student?.id)))) })] }) })] })), selectedTrackingStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-2xl font-bold", children: ["Fee Details - ", selectedTrackingStudent.student?.profile?.full_name] }), _jsx("button", { onClick: () => setSelectedTrackingStudent(null), className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }), _jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Fee Summary" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Assigned" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_assigned || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Paid" }), _jsxs("p", { className: "text-xl font-semibold text-green-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_paid || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Pending" }), _jsxs("p", { className: "text-xl font-semibold text-red-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.pending_amount || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Transport Fee" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.transport_amount || 0).toLocaleString()] })] })] })] }) })] }) })), showClassFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Class Fee" }), _jsxs("form", { onSubmit: handleSaveClassFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Class *" }), _jsxs("select", { value: classFeeForm.class_group_id, onChange: (e) => setClassFeeForm({ ...classFeeForm, class_group_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Name *" }), _jsx("input", { type: "text", value: classFeeForm.name, onChange: (e) => setClassFeeForm({ ...classFeeForm, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Tuition Fee, Development Fee", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Amount (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: classFeeForm.amount, onChange: (e) => setClassFeeForm({ ...classFeeForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: classFeeForm.fee_cycle, onChange: (e) => setClassFeeForm({ ...classFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), classFeeForm.fee_cycle !== 'one-time' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: classFeeForm.due_day, onChange: (e) => setClassFeeForm({ ...classFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: classFeeForm.notes, onChange: (e) => setClassFeeForm({ ...classFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowClassFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showCustomFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Custom Fee" }), _jsxs("form", { onSubmit: handleSaveCustomFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Class" }), _jsxs("select", { value: customFeeForm.class_group_id, onChange: (e) => setCustomFeeForm({ ...customFeeForm, class_group_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Select \"All Classes\" to apply this fee to all classes, or select a specific class" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Custom Fee Name *" }), _jsx("input", { type: "text", value: customFeeForm.name, onChange: (e) => setCustomFeeForm({ ...customFeeForm, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Library Fee, Lab Fee, Sports Fee", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Amount (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: customFeeForm.amount, onChange: (e) => setCustomFeeForm({ ...customFeeForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: customFeeForm.fee_cycle, onChange: (e) => setCustomFeeForm({ ...customFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowCustomFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showRouteModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Route" }), _jsxs("form", { onSubmit: handleSaveRoute, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route Name *" }), _jsx("input", { type: "text", value: routeForm.route_name, onChange: (e) => setRouteForm({ ...routeForm, route_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Route A, North Zone", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bus Number" }), _jsx("input", { type: "text", value: routeForm.bus_number, onChange: (e) => setRouteForm({ ...routeForm, bus_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., BUS-001" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Zone" }), _jsx("input", { type: "text", value: routeForm.zone, onChange: (e) => setRouteForm({ ...routeForm, zone: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., North, South, East, West" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Distance (km)" }), _jsx("input", { type: "number", step: "0.1", min: "0", value: routeForm.distance_km, onChange: (e) => setRouteForm({ ...routeForm, distance_km: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description" }), _jsx("textarea", { value: routeForm.description, onChange: (e) => setRouteForm({ ...routeForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowRouteModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showTransportFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Fee" }), _jsxs("form", { onSubmit: handleSaveTransportFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route *" }), _jsxs("select", { value: transportFeeForm.route_id, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, route_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Route" }), transportRoutes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : ''] }, route.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Base Fee (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.base_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, base_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Escort Fee (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.escort_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, escort_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fuel Surcharge (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.fuel_surcharge, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fuel_surcharge: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: transportFeeForm.fee_cycle, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "per-trip", children: "Per Trip" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), transportFeeForm.fee_cycle !== 'per-trip' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: transportFeeForm.due_day, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: transportFeeForm.notes, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowTransportFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), activeTab === 'hikes' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Fee Hikes & Version History" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Increase or decrease fees for future billing periods. Past bills remain unchanged." }), _jsxs("div", { className: "mb-8", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Class Fees" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Current Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No class fees found." }) })) : (classFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || '-' }), _jsx("td", { className: "px-6 py-4", children: fee.name || fee.fee_categories?.name || 'Class Fee' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleHikeFee(fee, 'class'), className: "text-blue-600 hover:text-blue-800 mr-4", children: "Hike Fee" }) })] }, fee.id)))) })] }) })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Transport Fees" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Current Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "No transport fees found." }) })) : (transportFees.map((fee) => {
                                                const totalAmount = parseFloat(fee.base_fee || 0) +
                                                    parseFloat(fee.escort_fee || 0) +
                                                    parseFloat(fee.fuel_surcharge || 0);
                                                return (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.transport_routes?.route_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", totalAmount.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleHikeFee({ ...fee, amount: totalAmount }, 'transport'), className: "text-blue-600 hover:text-blue-800 mr-4", children: "Hike Fee" }) })] }, fee.id));
                                            })) })] }) })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Custom Fees" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Current Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: customFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No custom fees found." }) })) : (customFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || 'All Classes' }), _jsx("td", { className: "px-6 py-4", children: fee.fee_categories?.name || fee.name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle || '-' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleHikeFee(fee, 'custom'), className: "text-blue-600 hover:text-blue-800 mr-4", children: "Hike Fee" }) })] }, fee.id)))) })] }) })] })] })), showHikeModal && selectedFeeForHike && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Hike Fee" }), _jsxs("form", { onSubmit: handleSubmitHike, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Current Amount" }), _jsx("input", { type: "text", value: selectedFeeForHike.amount || '', disabled: true, className: "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "New Amount *" }), _jsx("input", { type: "number", step: "0.01", required: true, value: hikeForm.new_amount, onChange: (e) => setHikeForm({ ...hikeForm, new_amount: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Effective From Date *" }), _jsx("input", { type: "date", required: true, value: hikeForm.effective_from_date, onChange: (e) => setHikeForm({ ...hikeForm, effective_from_date: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Bills generated after this date will use the new amount. Past bills remain unchanged." })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: hikeForm.notes, onChange: (e) => setHikeForm({ ...hikeForm, notes: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg", rows: 3 })] }), feeVersions.length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Version History" }), _jsx("div", { className: "max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2", children: feeVersions.map((version, idx) => (_jsxs("div", { className: "text-xs mb-2 pb-2 border-b last:border-0", children: [_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { className: "font-medium", children: ["Version ", version.version_number] }), _jsxs("span", { children: ["\u20B9", parseFloat(version.amount || 0).toLocaleString()] })] }), _jsxs("div", { className: "text-gray-500", children: [new Date(version.effective_from_date).toLocaleDateString(), " -", ' ', version.effective_to_date
                                                                ? new Date(version.effective_to_date).toLocaleDateString()
                                                                : 'Active'] })] }, version.id))) })] })), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: () => {
                                                setShowHikeModal(false);
                                                setSelectedFeeForHike(null);
                                                setFeeVersions([]);
                                            }, className: "px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700", children: "Apply Fee Hike" })] })] })] }) }))] }));
}
// Export FeeManagement for use in ClerkDashboard
export { FeeManagement };
export default function PrincipalDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const [currentView, setCurrentView] = useState('dashboard');
    const [checkingRole, setCheckingRole] = useState(true);
    // Verify user is a principal before showing dashboard
    useEffect(() => {
        const verifyRole = async () => {
            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                const user = session.data.session?.user;
                console.log('[PrincipalDashboard] Session check:', {
                    hasToken: !!token,
                    hasUser: !!user,
                    userId: user?.id,
                    email: user?.email
                });
                if (!token || !user) {
                    console.warn('[PrincipalDashboard] No session or token found, redirecting to login');
                    navigate('/login');
                    return;
                }
                // Check user role via backend
                const response = await fetch(`${API_URL}/auth/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Cache-Control': 'no-cache',
                    },
                });
                if (response.ok || response.status === 304) {
                    let data;
                    try {
                        // For 304 responses, try to get cached data or re-fetch
                        if (response.status === 304) {
                            // Re-fetch with cache-busting
                            const freshResponse = await fetch(`${API_URL}/auth/profile?t=${Date.now()}`, {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Cache-Control': 'no-cache',
                                },
                            });
                            if (freshResponse.ok) {
                                data = await freshResponse.json();
                            }
                            else {
                                throw new Error('Failed to fetch profile');
                            }
                        }
                        else {
                            data = await response.json();
                        }
                    }
                    catch (parseError) {
                        console.error('[PrincipalDashboard] Error parsing profile response:', parseError);
                        // Fallback: try to get profile directly from Supabase
                        const userId = session.data.session?.user?.id;
                        if (!userId) {
                            navigate('/login');
                            return;
                        }
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('role, approval_status')
                            .eq('id', userId)
                            .single();
                        if (profileData && profileData.role === 'principal') {
                            // Profile found, allow access
                            setCheckingRole(false);
                            return;
                        }
                        else {
                            navigate('/login');
                            return;
                        }
                    }
                    const role = data?.profile?.role;
                    // Only principals and clerks can access this dashboard
                    if (role !== 'principal' && role !== 'clerk') {
                        console.warn('[PrincipalDashboard] Unauthorized access attempt by role:', role);
                        // Redirect to appropriate dashboard based on role
                        const redirectMap = {
                            student: '/student/home',
                            teacher: '/teacher/classes',
                            parent: '/parent/home'
                        };
                        const redirectPath = redirectMap[role] || '/login';
                        navigate(redirectPath, { replace: true });
                        return;
                    }
                }
                else {
                    console.error('[PrincipalDashboard] Failed to verify role, status:', response.status);
                    // Try fallback: check profile directly from Supabase
                    try {
                        const userId = session.data.session?.user?.id;
                        if (!userId) {
                            navigate('/login');
                            return;
                        }
                        const { data: profileData, error: profileError } = await supabase
                            .from('profiles')
                            .select('role, approval_status')
                            .eq('id', userId)
                            .single();
                        if (!profileError && profileData && profileData.role === 'principal') {
                            // Profile found, allow access
                            setCheckingRole(false);
                            return;
                        }
                    }
                    catch (fallbackError) {
                        console.error('[PrincipalDashboard] Fallback check failed:', fallbackError);
                    }
                    navigate('/login');
                    return;
                }
            }
            catch (error) {
                console.error('[PrincipalDashboard] Error verifying role:', error);
                navigate('/login');
                return;
            }
            finally {
                setCheckingRole(false);
            }
        };
        verifyRole();
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, [navigate]);
    useEffect(() => {
        const path = location.pathname;
        if (path === '/principal/dashboard')
            setCurrentView('dashboard');
        else if (path === '/principal/staff')
            setCurrentView('staff');
        else if (path === '/principal/classifications')
            setCurrentView('classifications');
        else if (path === '/principal/classes')
            setCurrentView('classes');
        else if (path === '/principal/subjects')
            setCurrentView('subjects');
        else if (path === '/principal/students')
            setCurrentView('students');
        else if (path === '/principal/exams')
            setCurrentView('exams');
        else if (path === '/principal/salary')
            setCurrentView('salary');
        else if (path === '/principal/fees')
            setCurrentView('fees');
        // Always return cleanup function (even if empty) to avoid React error #310
        return () => {
            // No cleanup needed
        };
    }, [location]);
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx(Sidebar, { currentPath: location.pathname }), _jsxs("div", { className: "ml-64 flex-1", children: [currentView === 'dashboard' && _jsx(DashboardOverview, {}), currentView === 'staff' && (_jsx(ErrorBoundary, { fallback: _jsx("div", { className: "p-6", children: _jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsx("h3", { className: "text-red-800 font-semibold mb-2", children: "Error Loading Staff Page" }), _jsx("p", { className: "text-red-600 text-sm", children: "Please refresh the page or try again later." })] }) }), children: _jsx(StaffManagement, {}) })), currentView === 'classifications' && _jsx(ClassificationsManagement, {}), currentView === 'classes' && _jsx(ClassesManagement, {}), currentView === 'subjects' && _jsx(SubjectsManagement, {}), currentView === 'students' && _jsx(StudentsManagement, {}), currentView === 'exams' && _jsx(ExamsManagement, {}), currentView === 'salary' && _jsx(SalaryManagement, {}), currentView === 'fees' && _jsx(FeeManagement, { userRole: "principal" })] })] }));
}
