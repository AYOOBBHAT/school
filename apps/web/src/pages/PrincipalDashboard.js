import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
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
    const [activeBreakdown, setActiveBreakdown] = useState(null);
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
                if (!profile || !profile.school_id) {
                    console.log('No profile or school_id found');
                    return;
                }
                const schoolId = profile.school_id;
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const loadSchoolInfoFromSupabase = async () => {
                    const { data: school, error: schoolError } = await supabase
                        .from('schools')
                        .select('id, name, join_code, registration_number, address, contact_email, contact_phone, logo_url, created_at')
                        .eq('id', schoolId)
                        .single();
                    if (!schoolError && school) {
                        console.log('School data loaded from Supabase fallback:', school);
                        setSchoolInfo(school);
                    }
                    else if (schoolError) {
                        console.error('Error loading school from Supabase:', schoolError);
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
                            },
                        });
                        if (response.ok) {
                            const data = await response.json();
                            console.log('School data loaded from API:', data.school);
                            setSchoolInfo(data.school);
                        }
                        else {
                            const errorText = await response.text();
                            console.error('Error loading school from API:', errorText);
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
    }, []);
    if (loading) {
        return _jsx("div", { className: "p-6", children: "Loading..." });
    }
    const statCards = [
        {
            label: 'Total Students',
            value: stats.totalStudents,
            icon: '🎓',
            color: 'bg-blue-500',
            description: 'Click to view gender-wise totals',
            onClick: stats.totalStudents > 0 ? () => setActiveBreakdown('students') : undefined,
        },
        {
            label: 'Staff Members',
            value: stats.totalStaff,
            icon: '👥',
            color: 'bg-green-500',
            description: 'Click to view gender-wise totals',
            onClick: stats.totalStaff > 0 ? () => setActiveBreakdown('staff') : undefined,
        },
        { label: 'Classes', value: stats.totalClasses, icon: '🏫', color: 'bg-purple-500' },
    ];
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
    const renderBreakdownModal = () => {
        if (!activeBreakdown)
            return null;
        const breakdown = activeBreakdown === 'students' ? stats.studentsByGender : stats.staffByGender;
        const title = activeBreakdown === 'students' ? 'Student Gender Breakdown' : 'Staff Gender Breakdown';
        const rows = [
            { label: 'Male', value: breakdown.male },
            { label: 'Female', value: breakdown.female },
            { label: 'Other', value: breakdown.other },
            { label: 'Not Specified', value: breakdown.unknown },
        ];
        const formatPercent = (value, total) => {
            if (!total)
                return '0%';
            return `${((value / total) * 100).toFixed(1)}%`;
        };
        return (_jsx("div", { className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4", children: _jsxs("div", { className: "bg-white rounded-lg shadow-2xl w-full max-w-md p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-900", children: title }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Total: ", breakdown.total] })] }), _jsx("button", { type: "button", onClick: () => setActiveBreakdown(null), className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), _jsxs("div", { className: "divide-y divide-gray-100", children: [rows.map((row) => (_jsxs("div", { className: "flex items-center justify-between py-3 text-sm", children: [_jsx("span", { className: "text-gray-700", children: row.label }), _jsxs("span", { className: "font-semibold text-gray-900", children: [row.value, breakdown.total > 0 && (_jsx("span", { className: "text-gray-500 text-xs ml-2", children: formatPercent(row.value, breakdown.total) }))] })] }, row.label))), _jsxs("div", { className: "flex items-center justify-between py-3 text-sm font-semibold", children: [_jsx("span", { className: "text-gray-900", children: "Total" }), _jsx("span", { className: "text-gray-900", children: breakdown.total })] })] }), _jsx("p", { className: "text-xs text-gray-500 mt-4", children: "Tip: Update staff and student profiles with gender information to keep these insights accurate." })] }) }));
    };
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Dashboard" }), schoolInfo && (_jsxs("div", { className: "mt-4 space-y-2", children: [_jsxs("p", { className: "text-gray-600", children: ["Welcome to ", _jsx("span", { className: "font-semibold text-gray-900", children: schoolInfo.name })] }), _jsxs("div", { className: "flex flex-wrap gap-4 text-sm text-gray-600", children: [schoolInfo.join_code && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: "School Code:" }), _jsx("span", { className: "font-mono font-semibold text-gray-900", children: schoolInfo.join_code })] })), schoolInfo.registration_number && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: "Registration No:" }), _jsx("span", { className: "font-semibold text-gray-900", children: schoolInfo.registration_number })] }))] })] }))] }), schoolInfo && (_jsx("div", { className: "bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "School Join Code" }), _jsx("p", { className: "text-sm opacity-90 mb-3", children: "Share this code with teachers, students, and parents so they can join your school" }), schoolInfo.join_code ? (_jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("code", { className: "text-2xl font-bold bg-white/20 px-4 py-2 rounded-lg font-mono", children: schoolInfo.join_code }), _jsx("button", { onClick: copyJoinCode, className: "bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2", children: joinCodeCopied ? (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: "Copied!" })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsx("span", { children: "Copy Code" })] })) })] })) : (_jsxs("div", { className: "bg-white/20 rounded-lg p-4", children: [_jsx("p", { className: "text-white font-semibold mb-2", children: "\u26A0\uFE0F Join Code Not Found" }), _jsx("p", { className: "text-sm opacity-90", children: "Your school join code is missing. Please contact support or check your school settings." }), _jsxs("p", { className: "text-xs opacity-75 mt-2", children: ["School ID: ", schoolInfo.id] })] }))] }), _jsx("div", { className: "text-6xl opacity-20 ml-4", children: "\uD83D\uDD11" })] }) })), process.env.NODE_ENV === 'development' && schoolInfo && (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm", children: [_jsx("p", { className: "font-semibold text-yellow-800 mb-2", children: "Debug Info:" }), _jsx("pre", { className: "text-xs text-yellow-700 overflow-auto", children: JSON.stringify({ schoolInfo, hasJoinCode: !!schoolInfo?.join_code }, null, 2) })] })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: statCards.map((stat) => {
                    const isInteractive = Boolean(stat.onClick);
                    const handleKeyDown = (event) => {
                        if (!isInteractive)
                            return;
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            stat.onClick?.();
                        }
                    };
                    return (_jsxs("div", { className: `bg-white rounded-lg shadow-md p-6 transition ${isInteractive ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg focus-within:ring-2 focus-within:ring-blue-500' : ''}`, onClick: stat.onClick, role: isInteractive ? 'button' : undefined, tabIndex: isInteractive ? 0 : undefined, onKeyDown: handleKeyDown, title: isInteractive ? 'Click to view detailed breakdown' : undefined, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-600 text-sm", children: stat.label }), _jsx("p", { className: "text-3xl font-bold text-gray-900 mt-2", children: stat.value })] }), _jsx("div", { className: `${stat.color} text-white p-4 rounded-full text-2xl`, children: stat.icon })] }), isInteractive && (_jsx("p", { className: "text-xs text-gray-500 mt-3", children: stat.description || 'Click to view more details' }))] }, stat.label));
                }) }), renderBreakdownModal(), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs(Link, { to: "/principal/classes", className: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83C\uDFEB" }), _jsx("div", { className: "font-semibold", children: "Manage Classes" })] }), _jsxs(Link, { to: "/principal/staff", className: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83D\uDC65" }), _jsx("div", { className: "font-semibold", children: "Manage Staff" })] })] })] })] }));
}
function StaffManagement() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allClasses, setAllClasses] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]);
    const [sections, setSections] = useState({});
    const [allAssignments, setAllAssignments] = useState([]);
    // Modal states
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
    const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [viewAssignmentsModalOpen, setViewAssignmentsModalOpen] = useState(false);
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
    // Add Staff Modal State (must be before any early returns)
    const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
    const [addStaffForm, setAddStaffForm] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'teacher',
        phone: '',
        gender: ''
    });
    useEffect(() => {
        loadStaff();
        loadAllClasses();
        loadAllSubjects();
        loadAllAssignments();
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
            const response = await fetch(`${API_URL}/teacher-assignments/teacher/${teacher.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setTeacherAssignments(data.assignments || []);
                setViewAssignmentsModalOpen(true);
            }
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
            alert('Teacher assigned successfully!');
            setAssignModalOpen(false);
            loadAllAssignments();
        }
        catch (error) {
            alert(error.message || 'Failed to create assignment');
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
    }, [assignForm.class_group_id]);
    // Get assignments count for each teacher
    const getTeacherAssignmentsCount = (teacherId) => {
        return allAssignments.filter(a => a.teacher_id === teacherId).length;
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
                    gender: addStaffForm.gender || null
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add staff member');
            }
            alert(`${addStaffForm.role === 'clerk' ? 'Clerk' : 'Teacher'} added successfully!`);
            setAddStaffModalOpen(false);
            setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '' });
            loadStaff();
        }
        catch (error) {
            alert(error.message || 'Failed to add staff member');
        }
    };
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Staff Management" }), _jsx("button", { onClick: () => setAddStaffModalOpen(true), className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition", children: "\u2795 Add Staff" })] }), _jsx("div", { className: "mb-4", children: _jsx("button", { onClick: () => {
                        setViewAssignmentsModalOpen(true);
                        setSelectedTeacher(null);
                        loadAllAssignments();
                    }, className: "bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition", children: "\uD83D\uDCCB View All Assignments" }) }), _jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Role" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Assignments" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Joined" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: staff.map((member) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: member.full_name || 'N/A' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-500", children: member.email }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800", children: member.role }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${member.approval_status === 'approved'
                                                    ? 'bg-green-100 text-green-800'
                                                    : member.approval_status === 'pending'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-red-100 text-red-800'}`, children: member.approval_status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsxs("span", { className: "text-sm text-gray-600", children: [getTeacherAssignmentsCount(member.id), " ", getTeacherAssignmentsCount(member.id) === 1 ? 'assignment' : 'assignments'] }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: new Date(member.created_at).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [member.role === 'teacher' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleAssignTeacher(member), className: "text-blue-600 hover:text-blue-900", title: "Assign to class/subject", children: "\u2795 Assign" }), _jsx("button", { onClick: () => handleViewAttendance(member), className: "text-green-600 hover:text-green-900", title: "View attendance", children: "\uD83D\uDCC5 Attendance" }), _jsx("button", { onClick: () => handleEvaluatePerformance(member), className: "text-purple-600 hover:text-purple-900", title: "View performance", children: "\uD83D\uDCCA Performance" }), _jsx("button", { onClick: () => handleViewAssignments(member), className: "text-indigo-600 hover:text-indigo-900", title: "View assignments", children: "\uD83D\uDC41\uFE0F Assignments" })] })), _jsx("button", { onClick: () => handleEditTeacher(member), className: "text-orange-600 hover:text-orange-900", title: "Edit teacher", children: "\u270F\uFE0F Edit" }), _jsx("button", { onClick: () => handleDeactivateTeacher(member), className: `${member.approval_status === 'approved' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`, title: member.approval_status === 'approved' ? 'Deactivate' : 'Activate', children: member.approval_status === 'approved' ? '🚫 Deactivate' : '✅ Activate' })] }) })] }, member.id))) })] }), staff.length === 0 && (_jsx("div", { className: "text-center py-12 text-gray-500", children: "No staff members found." }))] }), assignModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Assign Teacher: ", selectedTeacher.full_name] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class *" }), _jsxs("select", { value: assignForm.class_group_id, onChange: (e) => {
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
                                                                            : 'bg-red-100 text-red-800'}`, children: record.status }) })] }, record.date))) })] }) })] })] }) })), editModalOpen && selectedTeacher && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Edit Teacher: ", selectedTeacher.full_name] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name" }), _jsx("input", { type: "text", value: editForm.full_name, onChange: (e) => setEditForm({ ...editForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email" }), _jsx("input", { type: "email", value: editForm.email, onChange: (e) => setEditForm({ ...editForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "text", value: editForm.phone, onChange: (e) => setEditForm({ ...editForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Status" }), _jsxs("select", { value: editForm.approval_status, onChange: (e) => setEditForm({ ...editForm, approval_status: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "approved", children: "Approved" }), _jsx("option", { value: "rejected", children: "Rejected" })] })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleUpdateTeacher, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Update" }), _jsx("button", { onClick: () => setEditModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), addStaffModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add New Staff Member" }), _jsxs("form", { onSubmit: handleAddStaff, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name *" }), _jsx("input", { type: "text", required: true, value: addStaffForm.full_name, onChange: (e) => setAddStaffForm({ ...addStaffForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Role *" }), _jsxs("select", { value: addStaffForm.role, onChange: (e) => setAddStaffForm({ ...addStaffForm, role: e.target.value }), className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "teacher", children: "Teacher" }), _jsx("option", { value: "clerk", children: "Clerk" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email *" }), _jsx("input", { type: "email", required: true, value: addStaffForm.email, onChange: (e) => setAddStaffForm({ ...addStaffForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Password *" }), _jsx("input", { type: "password", required: true, minLength: 8, value: addStaffForm.password, onChange: (e) => setAddStaffForm({ ...addStaffForm, password: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "tel", value: addStaffForm.phone, onChange: (e) => setAddStaffForm({ ...addStaffForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Gender" }), _jsxs("select", { value: addStaffForm.gender, onChange: (e) => setAddStaffForm({ ...addStaffForm, gender: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Gender" }), _jsx("option", { value: "male", children: "Male" }), _jsx("option", { value: "female", children: "Female" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Add Staff" }), _jsx("button", { type: "button", onClick: () => {
                                                setAddStaffModalOpen(false);
                                                setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '' });
                                            }, className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] })] }) })), viewAssignmentsModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: selectedTeacher ? `Assignments: ${selectedTeacher.full_name}` : 'All Teacher Assignments' }), _jsx("button", { onClick: () => {
                                        setViewAssignmentsModalOpen(false);
                                        setSelectedTeacher(null);
                                    }, className: "text-gray-500 hover:text-gray-700", children: "\u2715" })] }), _jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Section" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Subject" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Assigned" }), _jsx("th", { className: "px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: (selectedTeacher ? teacherAssignments : allAssignments).map((assignment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-2 text-sm", children: assignment.teacher?.full_name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.class_groups?.name || 'N/A' }), _jsx("td", { className: "px-4 py-2 text-sm", children: assignment.sections?.name || 'N/A' }), _jsxs("td", { className: "px-4 py-2 text-sm", children: [assignment.subjects?.name || 'N/A', " ", assignment.subjects?.code ? `(${assignment.subjects.code})` : ''] }), _jsx("td", { className: "px-4 py-2 text-sm text-gray-500", children: new Date(assignment.created_at).toLocaleDateString() }), _jsx("td", { className: "px-4 py-2 text-sm", children: _jsx("button", { onClick: () => handleDeleteAssignment(assignment.id), className: "text-red-600 hover:text-red-900", children: "\uD83D\uDDD1\uFE0F Remove" }) })] }, assignment.id))) })] }), (selectedTeacher ? teacherAssignments : allAssignments).length === 0 && (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No assignments found." }))] })] }) }))] }));
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
        other_fees: []
    });
    const [editDefaultFees, setEditDefaultFees] = useState(null);
    const [loadingEditFees, setLoadingEditFees] = useState(false);
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
        other_fees: []
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
    useEffect(() => {
        const loadStudents = async () => {
            try {
                setError(null);
                setLoading(true);
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                if (!token) {
                    setError('No authentication token found. Please log in again.');
                    setLoading(false);
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
                // Auto-expand first class if available
                if (data.classes && data.classes.length > 0) {
                    setExpandedClasses(new Set([data.classes[0].id]));
                }
            }
            catch (error) {
                console.error('Error loading students:', error);
                setError(error.message || 'Failed to load students. Please try again.');
            }
            finally {
                setLoading(false);
            }
        };
        loadStudents();
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
            // Initialize other_fees array with all fee categories
            const otherFeesConfig = (data.other_fee_categories || []).map((cat) => ({
                fee_category_id: cat.id,
                enabled: true,
                discount: 0
            }));
            // Set default class fee (first one if available)
            const defaultClassFeeId = data.class_fees && data.class_fees.length > 0 ? data.class_fees[0].id : '';
            console.log('[Add Student] Default class fee ID:', defaultClassFeeId);
            console.log('[Add Student] Class fees count:', data.class_fees?.length || 0);
            console.log('[Add Student] Other fees count:', data.other_fee_categories?.length || 0);
            setFeeConfig({
                class_fee_id: defaultClassFeeId,
                class_fee_discount: 0,
                transport_enabled: true,
                transport_route_id: '',
                transport_fee_discount: 0,
                other_fees: otherFeesConfig
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
                        other_fees: feeConfig.other_fees || []
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
            setEditDefaultFees(data);
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
                updateData.fee_config = editFeeConfig;
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
            alert('Student updated successfully!');
            setEditModalOpen(false);
            // Reload students
            window.location.reload();
        }
        catch (error) {
            alert(error.message || 'Failed to update student');
        }
    };
    const handlePromoteStudentSubmit = async () => {
        if (!selectedStudent || !promoteForm.target_class_id) {
            alert('Please select a target class');
            return;
        }
        try {
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
            alert(data.message || 'Student promoted successfully!');
            setPromoteModalOpen(false);
            // Reload students
            window.location.reload();
        }
        catch (error) {
            alert(error.message || 'Failed to promote student');
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
            alert(data.message || 'Class promoted successfully!');
            setPromoteClassModalOpen(false);
            // Reload students
            window.location.reload();
        }
        catch (error) {
            alert(error.message || 'Failed to promote class');
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
                other_fees: []
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
                                                    // Load default fees for the new class
                                                    loadEditDefaultFees(newClassId);
                                                    // Reset fee config to defaults for new class
                                                    setEditFeeConfig({
                                                        class_fee_id: '',
                                                        class_fee_discount: 0,
                                                        transport_enabled: false,
                                                        transport_route_id: '',
                                                        transport_fee_discount: 0,
                                                        other_fees: []
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
                                                        other_fees: []
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "No Class" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: editForm.roll_number, onChange: (e) => setEditForm({ ...editForm, roll_number: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), editForm.class_group_id && (_jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Fee Configuration" }), loadingEditFees ? (_jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "Loading fee information..." })] })) : editDefaultFees ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 p-4 rounded-lg", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-2", children: "Class Fee (Default for this class)" }), editDefaultFees.class_fees && Array.isArray(editDefaultFees.class_fees) && editDefaultFees.class_fees.length > 0 ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Class Fee" }), _jsxs("select", { value: editFeeConfig.class_fee_id, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, class_fee_id: e.target.value, class_fee_discount: 0 }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Class Fee" }), editDefaultFees.class_fees.map((cf) => {
                                                                                    const categoryName = cf.fee_categories?.name || 'Class Fee';
                                                                                    const defaultAmount = parseFloat(cf.amount || 0);
                                                                                    return (_jsxs("option", { value: cf.id, children: [categoryName, " - \u20B9", defaultAmount.toFixed(2), "/", cf.fee_cycle] }, cf.id));
                                                                                })] })] }), editFeeConfig.class_fee_id && (() => {
                                                                    const selectedClassFee = editDefaultFees.class_fees.find((cf) => cf.id === editFeeConfig.class_fee_id);
                                                                    if (!selectedClassFee)
                                                                        return null;
                                                                    const categoryName = selectedClassFee.fee_categories?.name || 'Class Fee';
                                                                    const defaultAmount = parseFloat(selectedClassFee.amount || 0);
                                                                    const finalAmount = Math.max(0, defaultAmount - editFeeConfig.class_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [categoryName, ":"] }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultAmount.toFixed(2), "/", selectedClassFee.fee_cycle] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: editFeeConfig.class_fee_discount, onChange: (e) => {
                                                                                            const discount = parseFloat(e.target.value) || 0;
                                                                                            setEditFeeConfig({ ...editFeeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                                                                        }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", selectedClassFee.fee_cycle] })] })] }));
                                                                })()] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "No class fees configured for this class yet." }))] }), _jsxs("div", { className: "bg-green-50 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h5", { className: "font-semibold text-gray-700", children: "Transport Fee" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: editFeeConfig.transport_enabled, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? editFeeConfig.transport_route_id : '' }), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Enable Transport" })] })] }), editFeeConfig.transport_enabled && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Route" }), _jsxs("select", { value: editFeeConfig.transport_route_id, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_route_id: e.target.value }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Transport Route" }), editDefaultFees.transport_routes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : '', " - \u20B9", route.fee?.total?.toFixed(2) || '0.00', "/", route.fee?.fee_cycle || 'monthly'] }, route.id)))] })] }), editFeeConfig.transport_route_id && (() => {
                                                                    const selectedRoute = editDefaultFees.transport_routes.find((r) => r.id === editFeeConfig.transport_route_id);
                                                                    const routeFee = selectedRoute?.fee;
                                                                    const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                                                                    const finalTransportAmount = Math.max(0, defaultTransportAmount - editFeeConfig.transport_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Route Fee:" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: editFeeConfig.transport_fee_discount, onChange: (e) => setEditFeeConfig({ ...editFeeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 }), className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] })] }));
                                                                })()] }))] }), editDefaultFees.other_fee_categories && editDefaultFees.other_fee_categories.length > 0 && (_jsxs("div", { className: "bg-yellow-50 p-4 rounded-lg", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-3", children: "Other Fees" }), _jsx("div", { className: "space-y-3", children: editDefaultFees.other_fee_categories.map((category) => {
                                                                const feeConfigItem = editFeeConfig.other_fees.find(f => f.fee_category_id === category.id) || {
                                                                    fee_category_id: category.id,
                                                                    enabled: true,
                                                                    discount: 0
                                                                };
                                                                const defaultAmount = parseFloat(category.amount || 0);
                                                                const finalAmount = Math.max(0, defaultAmount - feeConfigItem.discount);
                                                                return (_jsxs("div", { className: "bg-white p-3 rounded border", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-sm", children: category.name }), _jsxs("span", { className: "text-sm font-medium text-gray-600", children: ["\u20B9", defaultAmount.toFixed(2), "/", category.fee_cycle || 'monthly'] })] }), category.description && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: category.description }))] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer ml-3", children: [_jsx("input", { type: "checkbox", checked: feeConfigItem.enabled, onChange: (e) => {
                                                                                                const updatedOtherFees = editFeeConfig.other_fees.map(f => f.fee_category_id === category.id
                                                                                                    ? { ...f, enabled: e.target.checked, discount: e.target.checked ? f.discount : 0 }
                                                                                                    : f);
                                                                                                if (!editFeeConfig.other_fees.find(f => f.fee_category_id === category.id)) {
                                                                                                    updatedOtherFees.push({
                                                                                                        fee_category_id: category.id,
                                                                                                        enabled: e.target.checked,
                                                                                                        discount: 0
                                                                                                    });
                                                                                                }
                                                                                                setEditFeeConfig({ ...editFeeConfig, other_fees: updatedOtherFees });
                                                                                            }, className: "rounded" }), _jsx("span", { className: "text-xs text-gray-600", children: "Enable" })] })] }), feeConfigItem.enabled && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: feeConfigItem.discount, onChange: (e) => {
                                                                                                const discount = parseFloat(e.target.value) || 0;
                                                                                                const updatedOtherFees = editFeeConfig.other_fees.map(f => f.fee_category_id === category.id
                                                                                                    ? { ...f, discount: Math.min(discount, defaultAmount) }
                                                                                                    : f);
                                                                                                if (!editFeeConfig.other_fees.find(f => f.fee_category_id === category.id)) {
                                                                                                    updatedOtherFees.push({
                                                                                                        fee_category_id: category.id,
                                                                                                        enabled: true,
                                                                                                        discount: Math.min(discount, defaultAmount)
                                                                                                    });
                                                                                                }
                                                                                                setEditFeeConfig({ ...editFeeConfig, other_fees: updatedOtherFees });
                                                                                            }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-xs font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", category.fee_cycle || 'monthly'] })] })] }))] }, category.id));
                                                            }) })] }))] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "Select a class to configure fees" }))] }))] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleUpdateStudent, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Update" }), _jsx("button", { onClick: () => setEditModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), promoteModalOpen && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Promote/Demote Student: ", selectedStudent.profile?.full_name] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Target Class" }), _jsxs("select", { value: promoteForm.target_class_id, onChange: (e) => {
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
                                                        other_fees: []
                                                    });
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Class (Optional)" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), addStudentForm.class_group_id && sections[addStudentForm.class_group_id] && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Section" }), _jsxs("select", { value: addStudentForm.section_id, onChange: (e) => setAddStudentForm({ ...addStudentForm, section_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Section (Optional)" }), sections[addStudentForm.class_group_id].map((section) => (_jsx("option", { value: section.id, children: section.name }, section.id)))] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Date of Birth" }), _jsx("input", { type: "date", value: addStudentForm.date_of_birth, onChange: (e) => setAddStudentForm({ ...addStudentForm, date_of_birth: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Home Address" }), _jsx("textarea", { value: addStudentForm.home_address, onChange: (e) => setAddStudentForm({ ...addStudentForm, home_address: e.target.value }), className: "w-full px-3 py-2 border rounded-md", rows: 3, placeholder: "Enter home address" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Admission Date" }), _jsx("input", { type: "date", value: addStudentForm.admission_date, onChange: (e) => setAddStudentForm({ ...addStudentForm, admission_date: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), addStudentForm.class_group_id && (_jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Fee Configuration" }), loadingFees ? (_jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "Loading fee information..." })] })) : defaultFees ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 p-4 rounded-lg border border-blue-200", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-2", children: "Class Fee (Default for this class)" }), defaultFees.class_fees && Array.isArray(defaultFees.class_fees) && defaultFees.class_fees.length > 0 ? (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Class Fee" }), _jsxs("select", { value: feeConfig.class_fee_id, onChange: (e) => setFeeConfig({ ...feeConfig, class_fee_id: e.target.value, class_fee_discount: 0 }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Class Fee" }), defaultFees.class_fees.map((cf) => {
                                                                                    const categoryName = cf.fee_categories?.name || 'Class Fee';
                                                                                    const defaultAmount = parseFloat(cf.amount || 0);
                                                                                    return (_jsxs("option", { value: cf.id, children: [categoryName, " - \u20B9", defaultAmount.toFixed(2), "/", cf.fee_cycle] }, cf.id));
                                                                                })] })] }), feeConfig.class_fee_id && (() => {
                                                                    const selectedClassFee = defaultFees.class_fees.find((cf) => cf.id === feeConfig.class_fee_id);
                                                                    if (!selectedClassFee)
                                                                        return null;
                                                                    const categoryName = selectedClassFee.fee_categories?.name || 'Class Fee';
                                                                    const defaultAmount = parseFloat(selectedClassFee.amount || 0);
                                                                    const finalAmount = Math.max(0, defaultAmount - feeConfig.class_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [categoryName, ":"] }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultAmount.toFixed(2), "/", selectedClassFee.fee_cycle] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: feeConfig.class_fee_discount, onChange: (e) => {
                                                                                            const discount = parseFloat(e.target.value) || 0;
                                                                                            setFeeConfig({ ...feeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                                                                        }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", selectedClassFee.fee_cycle] })] })] }));
                                                                })()] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "No class fees configured for this class yet." }))] }), _jsxs("div", { className: "bg-green-50 p-4 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h5", { className: "font-semibold text-gray-700", children: "Transport Fee" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: feeConfig.transport_enabled, onChange: (e) => setFeeConfig({ ...feeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? feeConfig.transport_route_id : '' }), className: "rounded" }), _jsx("span", { className: "text-sm text-gray-600", children: "Enable Transport" })] })] }), feeConfig.transport_enabled && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Select Route" }), _jsxs("select", { value: feeConfig.transport_route_id, onChange: (e) => setFeeConfig({ ...feeConfig, transport_route_id: e.target.value }), className: "w-full px-2 py-1 border rounded text-sm", children: [_jsx("option", { value: "", children: "Select Transport Route" }), defaultFees.transport_routes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : '', " - \u20B9", route.fee?.total?.toFixed(2) || '0.00', "/", route.fee?.fee_cycle || 'monthly'] }, route.id)))] })] }), feeConfig.transport_route_id && (() => {
                                                                    const selectedRoute = defaultFees.transport_routes.find((r) => r.id === feeConfig.transport_route_id);
                                                                    const routeFee = selectedRoute?.fee;
                                                                    const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                                                                    const finalTransportAmount = Math.max(0, defaultTransportAmount - feeConfig.transport_fee_discount);
                                                                    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-600", children: "Route Fee:" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", defaultTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", value: feeConfig.transport_fee_discount, onChange: (e) => setFeeConfig({ ...feeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 }), className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-sm font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalTransportAmount.toFixed(2), "/", routeFee?.fee_cycle || 'monthly'] })] })] }));
                                                                })()] }))] }), _jsxs("div", { className: "bg-yellow-50 p-4 rounded-lg border border-yellow-200", children: [_jsx("h5", { className: "font-semibold text-gray-700 mb-3", children: "Other Fees" }), defaultFees.other_fee_categories && Array.isArray(defaultFees.other_fee_categories) && defaultFees.other_fee_categories.length > 0 ? (_jsx("div", { className: "space-y-3", children: defaultFees.other_fee_categories.map((category) => {
                                                                const feeConfigItem = feeConfig.other_fees.find(f => f.fee_category_id === category.id) || {
                                                                    fee_category_id: category.id,
                                                                    enabled: true,
                                                                    discount: 0
                                                                };
                                                                const defaultAmount = parseFloat(category.amount || 0);
                                                                const finalAmount = Math.max(0, defaultAmount - feeConfigItem.discount);
                                                                return (_jsxs("div", { className: "bg-white p-3 rounded border", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-sm", children: category.name }), _jsxs("span", { className: "text-sm font-medium text-gray-600", children: ["\u20B9", defaultAmount.toFixed(2), "/", category.fee_cycle || 'monthly'] })] }), category.description && (_jsx("p", { className: "text-xs text-gray-500 mt-1", children: category.description }))] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer ml-3", children: [_jsx("input", { type: "checkbox", checked: feeConfigItem.enabled, onChange: (e) => {
                                                                                                const updatedOtherFees = feeConfig.other_fees.map(f => f.fee_category_id === category.id
                                                                                                    ? { ...f, enabled: e.target.checked, discount: e.target.checked ? f.discount : 0 }
                                                                                                    : f);
                                                                                                // If not found, add it
                                                                                                if (!feeConfig.other_fees.find(f => f.fee_category_id === category.id)) {
                                                                                                    updatedOtherFees.push({
                                                                                                        fee_category_id: category.id,
                                                                                                        enabled: e.target.checked,
                                                                                                        discount: 0
                                                                                                    });
                                                                                                }
                                                                                                setFeeConfig({ ...feeConfig, other_fees: updatedOtherFees });
                                                                                            }, className: "rounded" }), _jsx("span", { className: "text-xs text-gray-600", children: "Enable" })] })] }), feeConfigItem.enabled && (_jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Discount (\u20B9)" }), _jsx("input", { type: "number", min: "0", step: "0.01", max: defaultAmount, value: feeConfigItem.discount, onChange: (e) => {
                                                                                                const discount = parseFloat(e.target.value) || 0;
                                                                                                const updatedOtherFees = feeConfig.other_fees.map(f => f.fee_category_id === category.id
                                                                                                    ? { ...f, discount: Math.min(discount, defaultAmount) }
                                                                                                    : f);
                                                                                                // If not found, add it
                                                                                                if (!feeConfig.other_fees.find(f => f.fee_category_id === category.id)) {
                                                                                                    updatedOtherFees.push({
                                                                                                        fee_category_id: category.id,
                                                                                                        enabled: true,
                                                                                                        discount: Math.min(discount, defaultAmount)
                                                                                                    });
                                                                                                }
                                                                                                setFeeConfig({ ...feeConfig, other_fees: updatedOtherFees });
                                                                                            }, className: "w-full px-2 py-1 border rounded text-sm", placeholder: "0" })] }), _jsxs("div", { className: "flex justify-between text-xs font-semibold pt-1 border-t", children: [_jsx("span", { children: "Final Amount:" }), _jsxs("span", { className: "text-green-600", children: ["\u20B9", finalAmount.toFixed(2), "/", category.fee_cycle || 'monthly'] })] })] }))] }, category.id));
                                                            }) })) : (_jsx("p", { className: "text-sm text-gray-500", children: "No other fees configured for this class yet." }))] })] })) : (_jsx("p", { className: "text-sm text-gray-500", children: "Select a class to configure fees" }))] })), _jsxs("div", { className: "border-t pt-4 mt-4", children: [_jsx("h4", { className: "text-lg font-semibold mb-3 text-gray-700", children: "Parent/Guardian Information" }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Name *" }), _jsx("input", { type: "text", required: true, value: addStudentForm.guardian_name, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Full name of parent or guardian" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Phone Number *" }), _jsx("input", { type: "tel", required: true, value: addStudentForm.guardian_phone, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Phone number" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Parent/Guardian Email" }), _jsx("input", { type: "email", value: addStudentForm.guardian_email, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_email: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Email address (optional)" })] }), _jsxs("div", { className: "mt-3", children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Relationship" }), _jsxs("select", { value: addStudentForm.guardian_relationship, onChange: (e) => setAddStudentForm({ ...addStudentForm, guardian_relationship: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "parent", children: "Parent" }), _jsx("option", { value: "guardian", children: "Guardian" }), _jsx("option", { value: "relative", children: "Relative" }), _jsx("option", { value: "other", children: "Other" })] })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "submit", disabled: usernameStatus.checking || usernameStatus.available === false, className: `flex-1 px-4 py-2 rounded-lg ${usernameStatus.checking || usernameStatus.available === false
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
                                                    other_fees: []
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
    // Structure form
    const [showStructureModal, setShowStructureModal] = useState(false);
    const [structureForm, setStructureForm] = useState({
        teacher_id: '',
        base_salary: '',
        hra: '',
        other_allowances: '',
        fixed_deductions: '',
        salary_cycle: 'monthly',
        attendance_based_deduction: false
    });
    // Generate salary form
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generateForm, setGenerateForm] = useState({
        teacher_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    });
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const [teachersRes, structuresRes, recordsRes] = await Promise.all([
                fetch(`${API_URL}/staff-admin`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/salary/structures`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/salary/records`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (teachersRes.ok) {
                const data = await teachersRes.json();
                setTeachers(data.staff?.filter((s) => s.role === 'teacher') || []);
            }
            if (structuresRes.ok) {
                const data = await structuresRes.json();
                setSalaryStructures(data.structures || []);
            }
            if (recordsRes.ok) {
                const data = await recordsRes.json();
                setSalaryRecords(data.records || []);
            }
        }
        catch (error) {
            console.error('Error loading salary data:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSaveStructure = async (e) => {
        e.preventDefault();
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
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save structure');
            }
            alert('Salary structure saved successfully!');
            setShowStructureModal(false);
            setStructureForm({
                teacher_id: '',
                base_salary: '',
                hra: '',
                other_allowances: '',
                fixed_deductions: '',
                salary_cycle: 'monthly',
                attendance_based_deduction: false
            });
            loadData();
        }
        catch (error) {
            alert(error.message || 'Failed to save structure');
        }
    };
    const handleGenerateSalary = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(generateForm),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate salary');
            }
            alert('Salary generated successfully!');
            setShowGenerateModal(false);
            setGenerateForm({
                teacher_id: '',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear()
            });
            loadData();
        }
        catch (error) {
            alert(error.message || 'Failed to generate salary');
        }
    };
    const handleApprove = async (recordId) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/records/${recordId}/approve`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to approve');
            }
            alert('Salary approved successfully!');
            loadData();
        }
        catch (error) {
            alert(error.message || 'Failed to approve');
        }
    };
    const handleMarkPaid = async (recordId) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/salary/records/${recordId}/mark-paid`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    payment_date: new Date().toISOString().split('T')[0]
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to mark as paid');
            }
            alert('Salary marked as paid!');
            loadData();
        }
        catch (error) {
            alert(error.message || 'Failed to mark as paid');
        }
    };
    if (loading)
        return _jsx("div", { className: "p-6", children: "Loading..." });
    return (_jsxs("div", { className: "p-6", children: [_jsx("div", { className: "flex justify-between items-center mb-6", children: _jsx("h2", { className: "text-3xl font-bold", children: "Salary Management" }) }), _jsx("div", { className: "flex space-x-2 mb-6 border-b", children: [
                    { id: 'structure', label: 'Salary Structure' },
                    { id: 'generate', label: 'Generate Salary' },
                    { id: 'pending', label: 'Pending Salaries' },
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
                                        attendance_based_deduction: false
                                    });
                                    setShowStructureModal(true);
                                }, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Set Salary Structure" })] }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Base Salary" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "HRA" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Allowances" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Attendance Deduction" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryStructures.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No salary structures set. Click \"Set Salary Structure\" to get started." }) })) : (salaryStructures.map((structure) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: structure.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.base_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.hra.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.other_allowances.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", structure.fixed_deductions.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: structure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { onClick: () => {
                                                        setStructureForm({
                                                            teacher_id: structure.teacher_id,
                                                            base_salary: structure.base_salary.toString(),
                                                            hra: structure.hra.toString(),
                                                            other_allowances: structure.other_allowances.toString(),
                                                            fixed_deductions: structure.fixed_deductions.toString(),
                                                            salary_cycle: structure.salary_cycle,
                                                            attendance_based_deduction: structure.attendance_based_deduction
                                                        });
                                                        setShowStructureModal(true);
                                                    }, className: "text-blue-600 hover:text-blue-900", children: "Edit" }) })] }, structure.id)))) })] }) })] })), activeTab === 'generate' && (_jsx("div", { children: _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Generate Monthly Salary" }), _jsxs("form", { onSubmit: handleGenerateSalary, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Teacher *" }), _jsxs("select", { value: generateForm.teacher_id, onChange: (e) => setGenerateForm({ ...generateForm, teacher_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Teacher" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.full_name }, teacher.id)))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Month *" }), _jsx("select", { value: generateForm.month, onChange: (e) => setGenerateForm({ ...generateForm, month: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (_jsx("option", { value: m, children: new Date(2000, m - 1).toLocaleString('default', { month: 'long' }) }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Year *" }), _jsx("input", { type: "number", value: generateForm.year, onChange: (e) => setGenerateForm({ ...generateForm, year: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, min: "2000", max: "2100" })] })] }), _jsx("button", { type: "submit", className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Generate Salary" })] })] }) })), activeTab === 'pending' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Pending Salary Approvals" }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month/Year" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Gross" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryRecords.filter((r) => r.status === 'pending' || r.status === 'approved').length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No pending salaries" }) })) : (salaryRecords.filter((r) => r.status === 'pending' || r.status === 'approved').map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: record.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: [new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' }), " ", record.year] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.gross_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.total_deductions.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", record.net_salary.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        record.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            'bg-blue-100 text-blue-800'}`, children: record.status }) }), _jsxs("td", { className: "px-6 py-4", children: [record.status === 'pending' && (_jsx("button", { onClick: () => handleApprove(record.id), className: "text-green-600 hover:text-green-900 mr-3", children: "Approve" })), record.status === 'approved' && (_jsx("button", { onClick: () => handleMarkPaid(record.id), className: "text-blue-600 hover:text-blue-900", children: "Mark as Paid" }))] })] }, record.id)))) })] }) })] })), activeTab === 'records' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "All Salary Records" }), _jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Teacher" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month/Year" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Gross" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Date" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryRecords.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No salary records found" }) })) : (salaryRecords.map((record) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: record.teacher?.full_name || 'Unknown' }), _jsxs("td", { className: "px-6 py-4", children: [new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' }), " ", record.year] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.gross_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", record.total_deductions.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", record.net_salary.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        record.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                            'bg-blue-100 text-blue-800'}`, children: record.status }) }), _jsx("td", { className: "px-6 py-4", children: record.payment_date ? new Date(record.payment_date).toLocaleDateString() : '-' })] }, record.id)))) })] }) })] })), activeTab === 'reports' && (_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Salary Reports & Analytics" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Monthly Summary" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Paid:" }), _jsxs("span", { className: "font-semibold text-green-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'paid').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Pending:" }), _jsxs("span", { className: "font-semibold text-yellow-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'pending').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Approved:" }), _jsxs("span", { className: "font-semibold text-blue-600", children: ["\u20B9", (salaryRecords.filter((r) => r.status === 'approved').reduce((sum, r) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Attendance Deduction:" }), _jsxs("span", { className: "font-semibold text-red-600", children: ["\u20B9", (salaryRecords.reduce((sum, r) => sum + parseFloat(r.attendance_deduction || 0), 0)).toLocaleString()] })] })] })] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Statistics" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Total Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Paid Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'paid').length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Pending Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'pending').length })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-600", children: "Approved Records:" }), _jsx("span", { className: "font-semibold", children: salaryRecords.filter((r) => r.status === 'approved').length })] })] })] })] })] })), showStructureModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Set Salary Structure" }), _jsxs("form", { onSubmit: handleSaveStructure, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Teacher *" }), _jsxs("select", { value: structureForm.teacher_id, onChange: (e) => setStructureForm({ ...structureForm, teacher_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Teacher" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.full_name }, teacher.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Base Salary (\u20B9) *" }), _jsx("input", { type: "number", value: structureForm.base_salary, onChange: (e) => setStructureForm({ ...structureForm, base_salary: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", required: true, min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "HRA (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.hra, onChange: (e) => setStructureForm({ ...structureForm, hra: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Other Allowances (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.other_allowances, onChange: (e) => setStructureForm({ ...structureForm, other_allowances: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fixed Deductions (\u20B9)" }), _jsx("input", { type: "number", value: structureForm.fixed_deductions, onChange: (e) => setStructureForm({ ...structureForm, fixed_deductions: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", min: "0", step: "0.01" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Salary Cycle" }), _jsxs("select", { value: structureForm.salary_cycle, onChange: (e) => setStructureForm({ ...structureForm, salary_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2", children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "weekly", children: "Weekly" }), _jsx("option", { value: "biweekly", children: "Bi-weekly" })] })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center space-x-2", children: [_jsx("input", { type: "checkbox", checked: structureForm.attendance_based_deduction, onChange: (e) => setStructureForm({ ...structureForm, attendance_based_deduction: e.target.checked }), className: "rounded" }), _jsx("span", { className: "text-sm font-medium", children: "Enable Attendance-Based Deduction" })] }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save Structure" }), _jsx("button", { type: "button", onClick: () => setShowStructureModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
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
    // Fee Overrides
    const [feeOverrides, setFeeOverrides] = useState([]);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideForm, setOverrideForm] = useState({
        student_id: '',
        discount_amount: '',
        custom_fee_amount: '',
        is_full_free: false,
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
        notes: ''
    });
    const [overrideFilterStudent, setOverrideFilterStudent] = useState('');
    const [overrideModalFilterClass, setOverrideModalFilterClass] = useState('');
    useEffect(() => {
        loadInitialData();
    }, []);
    useEffect(() => {
        if (activeTab === 'class-fees') {
            loadClassFees();
        }
        else if (activeTab === 'transport')
            loadTransportData();
        else if (activeTab === 'tracking')
            loadFeeTracking();
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
    // loadOptionalFees, loadCustomFees, loadBills, loadPayments - REMOVED
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
            // Optional fees removed
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
            // Optional fees removed
        }
        catch (error) {
            alert(error.message || 'Failed to hike fee');
        }
    };
    const loadFeeOverrides = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // If filtering by student, load that student's overrides
            // Otherwise, we'll need to load all students' overrides (for now, show message)
            if (overrideFilterStudent) {
                const response = await fetch(`${API_URL}/student-fee-overrides/student/${overrideFilterStudent}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setFeeOverrides(data.overrides || []);
                }
            }
            else {
                // For "all students", we'd need a different endpoint
                // For now, show empty and prompt user to select a student
                setFeeOverrides([]);
            }
        }
        catch (error) {
            console.error('Error loading fee overrides:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSaveOverride = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            if (!overrideForm.student_id) {
                alert('Please select a student');
                return;
            }
            const payload = {
                student_id: overrideForm.student_id,
                effective_from: overrideForm.effective_from,
                notes: overrideForm.notes || null
            };
            // If full free, set that flag
            if (overrideForm.is_full_free) {
                payload.is_full_free = true;
                payload.fee_category_id = null; // null means applies to all fees
            }
            else {
                // Fee category is always null - applies to all fees
                payload.fee_category_id = null;
                if (overrideForm.custom_fee_amount) {
                    payload.custom_fee_amount = parseFloat(overrideForm.custom_fee_amount);
                }
                else if (overrideForm.discount_amount) {
                    payload.discount_amount = parseFloat(overrideForm.discount_amount);
                }
            }
            if (overrideForm.effective_to) {
                payload.effective_to = overrideForm.effective_to;
            }
            const response = await fetch(`${API_URL}/student-fee-overrides`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save fee override');
            }
            alert('Fee override saved successfully!');
            setShowOverrideModal(false);
            setOverrideForm({
                student_id: '',
                discount_amount: '',
                custom_fee_amount: '',
                is_full_free: false,
                effective_from: new Date().toISOString().split('T')[0],
                effective_to: '',
                notes: ''
            });
            loadFeeOverrides();
        }
        catch (error) {
            alert(error.message || 'Failed to save fee override');
        }
    };
    const handleDeleteOverride = async (overrideId) => {
        if (!confirm('Are you sure you want to deactivate this fee override?'))
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/student-fee-overrides/${overrideId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete fee override');
            }
            alert('Fee override deactivated successfully!');
            loadFeeOverrides();
        }
        catch (error) {
            alert(error.message || 'Failed to delete fee override');
        }
    };
    if (loading) {
        return (_jsx("div", { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Fee Management" }), _jsx("div", { className: "bg-white rounded-lg shadow mb-6", children: _jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex -mb-px", children: [
                            ...(isClerk ? [] : [
                                { id: 'class-fees', label: 'Class Fees' },
                                { id: 'transport', label: 'Transport' },
                                { id: 'hikes', label: 'Fee Hikes' },
                                { id: 'overrides', label: 'Fee Overrides' }
                            ]),
                            { id: 'tracking', label: 'Fee Tracking' }
                        ].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: tab.label }, tab.id))) }) }) }), activeTab === 'class-fees' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Class Fees" }), !isClerk && (_jsx("button", { onClick: () => setShowClassFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Class Fee" }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Due Day" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No class fees found. Click \"Add Class Fee\" to get started." }) })) : (classFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || '-' }), _jsx("td", { className: "px-6 py-4", children: fee.name || fee.fee_categories?.name || 'Class Fee' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: fee.due_day || '-' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })), activeTab === 'transport' && !isClerk && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Routes" }), !isClerk && (_jsx("button", { onClick: () => setShowRouteModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Route" }))] }), _jsx("div", { className: "overflow-x-auto mb-6", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bus Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Zone" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Distance" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportRoutes.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No transport routes found." }) })) : (transportRoutes.map((route) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: route.route_name }), _jsx("td", { className: "px-6 py-4", children: route.bus_number || '-' }), _jsx("td", { className: "px-6 py-4", children: route.zone || '-' }), _jsx("td", { className: "px-6 py-4", children: route.distance_km ? `${route.distance_km} km` : '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, route.id)))) })] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Fees" }), !isClerk && (_jsx("button", { onClick: () => setShowTransportFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Transport Fee" }))] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Base Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Escort Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fuel Surcharge" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No transport fees found." }) })) : (transportFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.transport_routes?.route_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.base_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.escort_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.fuel_surcharge || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })] })), activeTab === 'tracking' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Collection Tracking" }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("select", { value: filterClass, onChange: (e) => setFilterClass(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((cg) => (_jsx("option", { value: cg.id, children: cg.name }, cg.id)))] }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Status" }), _jsx("option", { value: "paid", children: "Paid" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "partial", children: "Partially Paid" })] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Assigned" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Paid" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pending Amount" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Transport Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: feeTracking
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
                                                    }, className: "text-blue-600 hover:text-blue-800 mr-2", children: "View Details" }) })] }, track.student?.id)))) })] }) })] })), selectedTrackingStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-2xl font-bold", children: ["Fee Details - ", selectedTrackingStudent.student?.profile?.full_name] }), _jsx("button", { onClick: () => setSelectedTrackingStudent(null), className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }), _jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Fee Summary" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Assigned" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_assigned || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Paid" }), _jsxs("p", { className: "text-xl font-semibold text-green-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_paid || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Pending" }), _jsxs("p", { className: "text-xl font-semibold text-red-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.pending_amount || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Transport Fee" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.transport_amount || 0).toLocaleString()] })] })] })] }) })] }) })), showClassFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Class Fee" }), _jsxs("form", { onSubmit: handleSaveClassFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Class *" }), _jsxs("select", { value: classFeeForm.class_group_id, onChange: (e) => setClassFeeForm({ ...classFeeForm, class_group_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Name *" }), _jsx("input", { type: "text", value: classFeeForm.name, onChange: (e) => setClassFeeForm({ ...classFeeForm, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Tuition Fee, Development Fee", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Amount (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: classFeeForm.amount, onChange: (e) => setClassFeeForm({ ...classFeeForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: classFeeForm.fee_cycle, onChange: (e) => setClassFeeForm({ ...classFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), classFeeForm.fee_cycle !== 'one-time' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: classFeeForm.due_day, onChange: (e) => setClassFeeForm({ ...classFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: classFeeForm.notes, onChange: (e) => setClassFeeForm({ ...classFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowClassFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showRouteModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Route" }), _jsxs("form", { onSubmit: handleSaveRoute, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route Name *" }), _jsx("input", { type: "text", value: routeForm.route_name, onChange: (e) => setRouteForm({ ...routeForm, route_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Route A, North Zone", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bus Number" }), _jsx("input", { type: "text", value: routeForm.bus_number, onChange: (e) => setRouteForm({ ...routeForm, bus_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., BUS-001" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Zone" }), _jsx("input", { type: "text", value: routeForm.zone, onChange: (e) => setRouteForm({ ...routeForm, zone: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., North, South, East, West" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Distance (km)" }), _jsx("input", { type: "number", step: "0.1", min: "0", value: routeForm.distance_km, onChange: (e) => setRouteForm({ ...routeForm, distance_km: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description" }), _jsx("textarea", { value: routeForm.description, onChange: (e) => setRouteForm({ ...routeForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowRouteModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showTransportFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Fee" }), _jsxs("form", { onSubmit: handleSaveTransportFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route *" }), _jsxs("select", { value: transportFeeForm.route_id, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, route_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Route" }), transportRoutes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : ''] }, route.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Base Fee (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.base_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, base_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Escort Fee (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.escort_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, escort_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fuel Surcharge (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.fuel_surcharge, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fuel_surcharge: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: transportFeeForm.fee_cycle, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "per-trip", children: "Per Trip" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), transportFeeForm.fee_cycle !== 'per-trip' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: transportFeeForm.due_day, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: transportFeeForm.notes, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowTransportFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), activeTab === 'hikes' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Fee Hikes & Version History" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Increase or decrease fees for future billing periods. Past bills remain unchanged." }), _jsxs("div", { className: "mb-8", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Class Fees" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fee Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Current Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No class fees found." }) })) : (classFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || '-' }), _jsx("td", { className: "px-6 py-4", children: fee.name || fee.fee_categories?.name || 'Class Fee' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleHikeFee(fee, 'class'), className: "text-blue-600 hover:text-blue-800 mr-4", children: "Hike Fee" }) })] }, fee.id)))) })] }) })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h4", { className: "text-lg font-semibold mb-4", children: "Transport Fees" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Current Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "No transport fees found." }) })) : (transportFees.map((fee) => {
                                                const totalAmount = parseFloat(fee.base_fee || 0) +
                                                    parseFloat(fee.escort_fee || 0) +
                                                    parseFloat(fee.fuel_surcharge || 0);
                                                return (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.transport_routes?.route_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", totalAmount.toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleHikeFee({ ...fee, amount: totalAmount }, 'transport'), className: "text-blue-600 hover:text-blue-800 mr-4", children: "Hike Fee" }) })] }, fee.id));
                                            })) })] }) })] })] })), showHikeModal && selectedFeeForHike && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Hike Fee" }), _jsxs("form", { onSubmit: handleSubmitHike, children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Current Amount" }), _jsx("input", { type: "text", value: selectedFeeForHike.amount || '', disabled: true, className: "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "New Amount *" }), _jsx("input", { type: "number", step: "0.01", required: true, value: hikeForm.new_amount, onChange: (e) => setHikeForm({ ...hikeForm, new_amount: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Effective From Date *" }), _jsx("input", { type: "date", required: true, value: hikeForm.effective_from_date, onChange: (e) => setHikeForm({ ...hikeForm, effective_from_date: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Bills generated after this date will use the new amount. Past bills remain unchanged." })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Notes (Optional)" }), _jsx("textarea", { value: hikeForm.notes, onChange: (e) => setHikeForm({ ...hikeForm, notes: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg", rows: 3 })] }), feeVersions.length > 0 && (_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Version History" }), _jsx("div", { className: "max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2", children: feeVersions.map((version, idx) => (_jsxs("div", { className: "text-xs mb-2 pb-2 border-b last:border-0", children: [_jsxs("div", { className: "flex justify-between", children: [_jsxs("span", { className: "font-medium", children: ["Version ", version.version_number] }), _jsxs("span", { children: ["\u20B9", parseFloat(version.amount || 0).toLocaleString()] })] }), _jsxs("div", { className: "text-gray-500", children: [new Date(version.effective_from_date).toLocaleDateString(), " -", ' ', version.effective_to_date
                                                                ? new Date(version.effective_to_date).toLocaleDateString()
                                                                : 'Active'] })] }, version.id))) })] })), _jsxs("div", { className: "flex justify-end space-x-3", children: [_jsx("button", { type: "button", onClick: () => {
                                                setShowHikeModal(false);
                                                setSelectedFeeForHike(null);
                                                setFeeVersions([]);
                                            }, className: "px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "Cancel" }), _jsx("button", { type: "submit", className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700", children: "Apply Fee Hike" })] })] })] }) })), activeTab === 'overrides' && !isClerk && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Student Fee Overrides" }), _jsx("button", { onClick: () => {
                                    setOverrideForm({
                                        student_id: overrideFilterStudent || '',
                                        discount_amount: '',
                                        custom_fee_amount: '',
                                        is_full_free: false,
                                        effective_from: new Date().toISOString().split('T')[0],
                                        effective_to: '',
                                        notes: ''
                                    });
                                    setShowOverrideModal(true);
                                }, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Fee Override" })] }), _jsx("p", { className: "text-gray-600 mb-6", children: "Manage student-specific fee overrides: discounts, custom fees, and full free scholarships." }), _jsxs("div", { className: "mb-4 grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Filter by Class" }), _jsxs("select", { value: overrideFilterStudent ? students.find(s => s.id === overrideFilterStudent)?.class_group_id || '' : '', onChange: (e) => {
                                            const classId = e.target.value;
                                            setOverrideFilterStudent(''); // Reset student filter when class changes
                                            // Filter students by class for the dropdown
                                        }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Filter by Student" }), _jsxs("select", { value: overrideFilterStudent, onChange: (e) => {
                                            setOverrideFilterStudent(e.target.value);
                                            loadFeeOverrides();
                                        }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Students" }), students.map((student) => (_jsxs("option", { value: student.id, children: [student.profile?.full_name, " (", student.roll_number, ") - ", classGroups.find(cg => cg.id === student.class_group_id)?.name || ''] }, student.id)))] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Discount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Custom Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Full Free" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Effective From" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Effective To" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: feeOverrides.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-4 text-center text-gray-500", children: overrideFilterStudent
                                                ? 'No fee overrides found for this student. Click "Add Fee Override" to create one.'
                                                : 'Please select a student to view their fee overrides, or click "Add Fee Override" to create a new one.' }) })) : (feeOverrides.map((override) => (_jsxs("tr", { children: [_jsxs("td", { className: "px-6 py-4", children: [override.students?.profile?.full_name || '-', _jsx("div", { className: "text-xs text-gray-500", children: override.students?.roll_number || '' })] }), _jsx("td", { className: "px-6 py-4", children: override.is_full_free ? (_jsx("span", { className: "px-2 py-1 rounded text-xs bg-purple-100 text-purple-800", children: "Full Free" })) : override.custom_fee_amount ? (_jsx("span", { className: "px-2 py-1 rounded text-xs bg-blue-100 text-blue-800", children: "Custom Fee" })) : override.discount_amount > 0 ? (_jsx("span", { className: "px-2 py-1 rounded text-xs bg-green-100 text-green-800", children: "Discount" })) : (_jsx("span", { className: "text-gray-400", children: "-" })) }), _jsx("td", { className: "px-6 py-4", children: override.discount_amount > 0 ? `₹${parseFloat(override.discount_amount || 0).toLocaleString()}` : '-' }), _jsx("td", { className: "px-6 py-4", children: override.custom_fee_amount ? `₹${parseFloat(override.custom_fee_amount || 0).toLocaleString()}` : '-' }), _jsx("td", { className: "px-6 py-4", children: override.is_full_free ? '✅ Yes' : '❌ No' }), _jsx("td", { className: "px-6 py-4", children: new Date(override.effective_from).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4", children: override.effective_to ? new Date(override.effective_to).toLocaleDateString() : 'Active' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { onClick: () => handleDeleteOverride(override.id), className: "text-red-600 hover:text-red-800", children: "Deactivate" }) })] }, override.id)))) })] }) })] })), showOverrideModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Fee Override" }), _jsxs("form", { onSubmit: handleSaveOverride, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Filter by Class" }), _jsxs("select", { value: overrideModalFilterClass, onChange: (e) => {
                                                        setOverrideModalFilterClass(e.target.value);
                                                        setOverrideForm({ ...overrideForm, student_id: '' }); // Reset student when class changes
                                                    }, className: "w-full border border-gray-300 rounded-lg px-4 py-2 mb-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Student *" }), _jsxs("select", { value: overrideForm.student_id, onChange: (e) => setOverrideForm({ ...overrideForm, student_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Student" }), students
                                                            .filter((student) => !overrideModalFilterClass || student.class_group_id === overrideModalFilterClass)
                                                            .map((student) => (_jsxs("option", { value: student.id, children: [student.profile?.full_name, " (", student.roll_number, ") - ", classGroups.find(cg => cg.id === student.class_group_id)?.name || ''] }, student.id)))] })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center space-x-2 mb-2", children: [_jsx("input", { type: "checkbox", checked: overrideForm.is_full_free, onChange: (e) => {
                                                            setOverrideForm({
                                                                ...overrideForm,
                                                                is_full_free: e.target.checked,
                                                                discount_amount: '',
                                                                custom_fee_amount: ''
                                                            });
                                                        }, className: "rounded" }), _jsx("span", { className: "text-sm font-medium", children: "Full Free Scholarship (All fees = 0)" })] }) }), !overrideForm.is_full_free && (_jsx(_Fragment, { children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Discount Amount (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: overrideForm.discount_amount, onChange: (e) => {
                                                                    setOverrideForm({
                                                                        ...overrideForm,
                                                                        discount_amount: e.target.value,
                                                                        custom_fee_amount: '' // Clear custom fee if discount is set
                                                                    });
                                                                }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", disabled: !!overrideForm.custom_fee_amount }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Amount to subtract from default fee" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Custom Fee Amount (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: overrideForm.custom_fee_amount, onChange: (e) => {
                                                                    setOverrideForm({
                                                                        ...overrideForm,
                                                                        custom_fee_amount: e.target.value,
                                                                        discount_amount: '' // Clear discount if custom fee is set
                                                                    });
                                                                }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", disabled: !!overrideForm.discount_amount }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Override default fee completely" })] })] }) })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Effective From *" }), _jsx("input", { type: "date", value: overrideForm.effective_from, onChange: (e) => setOverrideForm({ ...overrideForm, effective_from: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Effective To (Optional)" }), _jsx("input", { type: "date", value: overrideForm.effective_to, onChange: (e) => setOverrideForm({ ...overrideForm, effective_to: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Leave empty for indefinite" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: overrideForm.notes, onChange: (e) => setOverrideForm({ ...overrideForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save Override" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowOverrideModal(false);
                                                setOverrideForm({
                                                    student_id: '',
                                                    discount_amount: '',
                                                    custom_fee_amount: '',
                                                    is_full_free: false,
                                                    effective_from: new Date().toISOString().split('T')[0],
                                                    effective_to: '',
                                                    notes: ''
                                                });
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
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
                        const { data: profileData } = await supabase
                            .from('profiles')
                            .select('role, approval_status')
                            .eq('id', session.data.session?.user?.id)
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
                        const { data: profileData, error: profileError } = await supabase
                            .from('profiles')
                            .select('role, approval_status')
                            .eq('id', session.data.session?.user?.id)
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
    }, [location]);
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx(Sidebar, { currentPath: location.pathname }), _jsxs("div", { className: "ml-64 flex-1", children: [currentView === 'dashboard' && _jsx(DashboardOverview, {}), currentView === 'staff' && _jsx(StaffManagement, {}), currentView === 'classifications' && _jsx(ClassificationsManagement, {}), currentView === 'classes' && _jsx(ClassesManagement, {}), currentView === 'subjects' && _jsx(SubjectsManagement, {}), currentView === 'students' && _jsx(StudentsManagement, {}), currentView === 'exams' && _jsx(ExamsManagement, {}), currentView === 'salary' && _jsx(SalaryManagement, {}), currentView === 'fees' && _jsx(FeeManagement, { userRole: "principal" })] })] }));
}
