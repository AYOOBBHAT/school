import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api.js';
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
        { path: '/principal/approvals', label: 'Pending Approvals', icon: '⏳' },
    ];
    return (_jsxs("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: [_jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsx("nav", { className: "space-y-2", children: navItems.map((item) => (_jsxs(Link, { to: item.path, className: `flex items-center space-x-3 px-4 py-3 rounded-lg transition ${currentPath === item.path
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
        pendingApprovals: 0,
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
                        .select('id, name, join_code, address, contact_email, contact_phone, logo_url, created_at')
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
                        const [studentRows, staffRows, classesCount, approvalsCount] = await Promise.all([
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
                                .eq('school_id', schoolId),
                            supabase
                                .from('profiles')
                                .select('id', { count: 'exact', head: true })
                                .eq('school_id', schoolId)
                                .eq('approval_status', 'pending')
                        ]);
                        if (studentRows.error)
                            throw studentRows.error;
                        if (staffRows.error)
                            throw staffRows.error;
                        if (classesCount.error)
                            throw classesCount.error;
                        if (approvalsCount.error)
                            throw approvalsCount.error;
                        const studentGenders = buildGenderBreakdown((studentRows.data || []).map((student) => {
                            const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
                            return profile?.gender;
                        }));
                        const staffGenders = buildGenderBreakdown((staffRows.data || []).map((member) => member.gender));
                        setStats({
                            totalStudents: studentGenders.total,
                            totalStaff: staffGenders.total,
                            totalClasses: classesCount.count || 0,
                            pendingApprovals: approvalsCount.count || 0,
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
                            pendingApprovals: payload?.pendingApprovals ?? 0,
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
        { label: 'Pending Approvals', value: stats.pendingApprovals, icon: '⏳', color: 'bg-orange-500' },
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
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900", children: "Dashboard" }), schoolInfo && (_jsxs("p", { className: "text-gray-600 mt-2", children: ["Welcome to ", schoolInfo.name] }))] }), schoolInfo && (_jsx("div", { className: "bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "School Join Code" }), _jsx("p", { className: "text-sm opacity-90 mb-3", children: "Share this code with teachers, students, and parents so they can join your school" }), schoolInfo.join_code ? (_jsxs("div", { className: "flex items-center gap-3 flex-wrap", children: [_jsx("code", { className: "text-2xl font-bold bg-white/20 px-4 py-2 rounded-lg font-mono", children: schoolInfo.join_code }), _jsx("button", { onClick: copyJoinCode, className: "bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2", children: joinCodeCopied ? (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: "Copied!" })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\uD83D\uDCCB" }), _jsx("span", { children: "Copy Code" })] })) })] })) : (_jsxs("div", { className: "bg-white/20 rounded-lg p-4", children: [_jsx("p", { className: "text-white font-semibold mb-2", children: "\u26A0\uFE0F Join Code Not Found" }), _jsx("p", { className: "text-sm opacity-90", children: "Your school join code is missing. Please contact support or check your school settings." }), _jsxs("p", { className: "text-xs opacity-75 mt-2", children: ["School ID: ", schoolInfo.id] })] }))] }), _jsx("div", { className: "text-6xl opacity-20 ml-4", children: "\uD83D\uDD11" })] }) })), process.env.NODE_ENV === 'development' && schoolInfo && (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm", children: [_jsx("p", { className: "font-semibold text-yellow-800 mb-2", children: "Debug Info:" }), _jsx("pre", { className: "text-xs text-yellow-700 overflow-auto", children: JSON.stringify({ schoolInfo, hasJoinCode: !!schoolInfo?.join_code }, null, 2) })] })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8", children: statCards.map((stat) => {
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
                }) }), renderBreakdownModal(), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Quick Actions" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs(Link, { to: "/principal/approvals", className: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center", children: [_jsx("div", { className: "text-2xl mb-2", children: "\u23F3" }), _jsx("div", { className: "font-semibold", children: "Review Approvals" }), _jsxs("div", { className: "text-sm text-gray-600", children: [stats.pendingApprovals, " pending"] })] }), _jsxs(Link, { to: "/principal/classes", className: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83C\uDFEB" }), _jsx("div", { className: "font-semibold", children: "Manage Classes" })] }), _jsxs(Link, { to: "/principal/staff", className: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center", children: [_jsx("div", { className: "text-2xl mb-2", children: "\uD83D\uDC65" }), _jsx("div", { className: "font-semibold", children: "Manage Staff" })] })] })] })] }));
}
function StaffManagement() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
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
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/staff-admin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Failed to load staff');
            const data = await response.json();
            setStaff(data.staff || []);
        }
        catch (error) {
            console.error('Error loading staff:', error);
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
        return _jsx("div", { className: "p-6", children: "Loading..." });
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
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/classes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load classes');
            }
            const data = await response.json();
            setClasses(data.classes || []);
        }
        catch (error) {
            console.error('Error loading classes:', error);
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
        return _jsx("div", { className: "p-6", children: "Loading..." });
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
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', code: '' });
    const [editingSubject, setEditingSubject] = useState(null);
    useEffect(() => {
        loadSubjects();
    }, []);
    const loadSubjects = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/subjects`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load subjects');
            }
            const data = await response.json();
            setSubjects(data.subjects || []);
        }
        catch (error) {
            console.error('Error loading subjects:', error);
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
        return _jsx("div", { className: "p-6", children: "Loading..." });
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
        gender: ''
    });
    useEffect(() => {
        const loadStudents = async () => {
            try {
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                if (!token)
                    return;
                const response = await fetch(`${API_URL}/students-admin`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok)
                    throw new Error('Failed to load students');
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
            if (!response.ok)
                throw new Error('Failed to load classes');
            const data = await response.json();
            setAllClasses(data.classes || []);
        }
        catch (error) {
            console.error('Error loading classes:', error);
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
    const handleEditStudent = (student) => {
        setSelectedStudent(student);
        setEditForm({
            class_group_id: student.class_group_id || '',
            section_id: student.section_id || '',
            roll_number: student.roll_number || ''
        });
        setEditModalOpen(true);
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
            // Remove section_id from the form data since sections are part of the class
            const { section_id, ...formData } = editForm;
            const response = await fetch(`${API_URL}/students-admin/${selectedStudent.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
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
        return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Students Management" }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: _jsx("div", { className: "text-2xl mb-4", children: "Loading..." }) })] }));
    }
    const handleAddStudent = async (e) => {
        e.preventDefault();
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
                    gender: addStudentForm.gender || null
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
                gender: ''
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
                                                }, className: "px-3 py-1 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition", title: "Promote entire class", children: "\u2B06 Promote Class" }), _jsxs("span", { className: "px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold", children: [classItem.student_count, " ", classItem.student_count === 1 ? 'student' : 'students'] })] })] }), isExpanded && (_jsx("div", { className: "border-t border-gray-200", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Roll No." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Section" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classItem.students.map((student) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: student.profile?.full_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.section_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.email || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active'
                                                                    ? 'bg-green-100 text-green-800'
                                                                    : 'bg-red-100 text-red-800'}`, children: student.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleEditStudent(student), className: "text-blue-600 hover:text-blue-900", title: "Edit student", children: "\u270F\uFE0F Edit" }), _jsx("button", { onClick: () => handlePromoteStudent(student), className: "text-green-600 hover:text-green-900", title: "Promote/Demote student", children: "\u2B06 Promote" })] }) })] }, student.id))) })] }) }) }))] }, classItem.id));
                }) }), unassignedStudents.length > 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 bg-yellow-50 border-b border-yellow-200", children: [_jsxs("h3", { className: "text-lg font-semibold text-yellow-800", children: ["Unassigned Students (", unassignedStudents.length, ")"] }), _jsx("p", { className: "text-sm text-yellow-700 mt-1", children: "These students haven't been assigned to a class yet." })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Roll No." }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: unassignedStudents.map((student) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900", children: student.profile?.full_name || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: student.profile?.email || 'N/A' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${student.status === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'}`, children: student.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm font-medium", children: _jsx("button", { onClick: () => handleEditStudent(student), className: "text-blue-600 hover:text-blue-900", title: "Assign class to student", children: "\u270F\uFE0F Assign Class" }) })] }, student.id))) })] }) })] })), classesWithStudents.length === 0 && unassignedStudents.length === 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-gray-500 text-lg", children: "No students found." }), _jsx("div", { className: "text-gray-400 text-sm mt-2", children: "Students will appear here once they are approved and assigned to classes." })] })), editModalOpen && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Edit Student: ", selectedStudent.profile?.full_name] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class" }), _jsxs("select", { value: editForm.class_group_id, onChange: (e) => {
                                                setEditForm({ ...editForm, class_group_id: e.target.value, section_id: '' });
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "No Class" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: editForm.roll_number, onChange: (e) => setEditForm({ ...editForm, roll_number: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handleUpdateStudent, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Update" }), _jsx("button", { onClick: () => setEditModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), promoteModalOpen && selectedStudent && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsxs("h3", { className: "text-xl font-bold mb-4", children: ["Promote/Demote Student: ", selectedStudent.profile?.full_name] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Target Class" }), _jsxs("select", { value: promoteForm.target_class_id, onChange: (e) => {
                                            setPromoteForm({ ...promoteForm, target_class_id: e.target.value, section_id: '' });
                                        }, className: "w-full px-3 py-2 border rounded-md", required: true, children: [_jsx("option", { value: "", children: "Select Target Class" }), allClasses.map((cls) => {
                                                const classificationText = cls.classifications && cls.classifications.length > 0
                                                    ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                    : '';
                                                return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                            })] })] }) }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { onClick: handlePromoteStudentSubmit, className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Promote" }), _jsx("button", { onClick: () => setPromoteModalOpen(false), className: "flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400", children: "Cancel" })] })] }) })), addStudentModalOpen && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add New Student" }), _jsxs("form", { onSubmit: handleAddStudent, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Full Name *" }), _jsx("input", { type: "text", required: true, value: addStudentForm.full_name, onChange: (e) => setAddStudentForm({ ...addStudentForm, full_name: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Email *" }), _jsx("input", { type: "email", required: true, value: addStudentForm.email, onChange: (e) => setAddStudentForm({ ...addStudentForm, email: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Username *" }), _jsx("input", { type: "text", required: true, value: addStudentForm.username, onChange: (e) => setAddStudentForm({ ...addStudentForm, username: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Unique username for login (unique per school)" }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Username must be unique within your school" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Password *" }), _jsx("input", { type: "password", required: true, minLength: 8, value: addStudentForm.password, onChange: (e) => setAddStudentForm({ ...addStudentForm, password: e.target.value }), className: "w-full px-3 py-2 border rounded-md", placeholder: "Minimum 8 characters" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Phone" }), _jsx("input", { type: "tel", value: addStudentForm.phone, onChange: (e) => setAddStudentForm({ ...addStudentForm, phone: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Gender" }), _jsxs("select", { value: addStudentForm.gender, onChange: (e) => setAddStudentForm({ ...addStudentForm, gender: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Gender" }), _jsx("option", { value: "male", children: "Male" }), _jsx("option", { value: "female", children: "Female" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: addStudentForm.roll_number, onChange: (e) => setAddStudentForm({ ...addStudentForm, roll_number: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Class" }), _jsxs("select", { value: addStudentForm.class_group_id, onChange: (e) => {
                                                setAddStudentForm({ ...addStudentForm, class_group_id: e.target.value, section_id: '' });
                                                if (e.target.value) {
                                                    loadSections(e.target.value);
                                                }
                                            }, className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Class (Optional)" }), allClasses.map((cls) => {
                                                    const classificationText = cls.classifications && cls.classifications.length > 0
                                                        ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                                                        : '';
                                                    return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                })] })] }), addStudentForm.class_group_id && sections[addStudentForm.class_group_id] && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Section" }), _jsxs("select", { value: addStudentForm.section_id, onChange: (e) => setAddStudentForm({ ...addStudentForm, section_id: e.target.value }), className: "w-full px-3 py-2 border rounded-md", children: [_jsx("option", { value: "", children: "Select Section (Optional)" }), sections[addStudentForm.class_group_id].map((section) => (_jsx("option", { value: section.id, children: section.name }, section.id)))] })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Admission Date" }), _jsx("input", { type: "date", value: addStudentForm.admission_date, onChange: (e) => setAddStudentForm({ ...addStudentForm, admission_date: e.target.value }), className: "w-full px-3 py-2 border rounded-md" })] }), _jsxs("div", { className: "flex gap-3 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Add Student" }), _jsx("button", { type: "button", onClick: () => {
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
                                                    gender: ''
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
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setLoading(false);
                return;
            }
            const response = await fetch(`${API_URL}/classifications/types`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok)
                throw new Error('Failed to load classification types');
            const data = await response.json();
            setTypes(data.types || []);
            // Load values for each type
            for (const type of data.types || []) {
                loadValuesForType(type.id);
            }
        }
        catch (error) {
            console.error('Error loading types:', error);
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
        return _jsx("div", { className: "p-6", children: "Loading..." });
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-start mb-6", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-3xl font-bold mb-2", children: "Dynamic Class Classifications" }), _jsx("p", { className: "text-gray-600 mb-3", children: "Create custom classification types to organize your classes. Each school can define their own structure." }), _jsxs("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4", children: [_jsx("h4", { className: "font-semibold text-blue-900 mb-2", children: "\uD83D\uDCA1 Examples:" }), _jsxs("ul", { className: "text-sm text-blue-800 space-y-1 list-disc list-inside", children: [_jsxs("li", { children: [_jsx("strong", { children: "Gender-based:" }), " Create type \"Gender\" with values \"Boys\", \"Girls\" \u2192 Classes: \"Grade 9 \u2013 Boys\", \"Grade 9 \u2013 Girls\""] }), _jsxs("li", { children: [_jsx("strong", { children: "House system:" }), " Create type \"House\" with values \"Blue House\", \"Red House\", \"Green House\""] }), _jsxs("li", { children: [_jsx("strong", { children: "Section-based:" }), " Create type \"Section\" with values \"A\", \"B\", \"C\""] }), _jsxs("li", { children: [_jsx("strong", { children: "Custom:" }), " Create type \"Level\" with values \"Junior Group\", \"Senior Group\""] })] })] })] }), _jsx("button", { onClick: () => setShowTypeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md", children: "+ Add Classification Type" })] }), _jsxs("div", { className: "space-y-6", children: [types.map((type) => (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow", children: [_jsxs("div", { className: "flex justify-between items-center mb-4 pb-4 border-b border-gray-200", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-900", children: type.name }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: [valuesMap[type.id]?.length || 0, " value", (valuesMap[type.id]?.length || 0) !== 1 ? 's' : '', " defined"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                                    setSelectedTypeId(type.id);
                                                    setShowValueModal(true);
                                                }, className: "bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm", children: "+ Add Value" }), _jsx("button", { onClick: () => handleDeleteType(type.id), className: "bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm", children: "Delete Type" })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [(valuesMap[type.id] || []).map((value) => (_jsxs("div", { className: "flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition-shadow", children: [_jsx("span", { className: "text-sm font-medium text-blue-900", children: value.value }), _jsx("button", { onClick: () => handleDeleteValue(value.id, type.id), className: "text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold transition-colors", title: "Delete value", children: "\u00D7" })] }, value.id))), (!valuesMap[type.id] || valuesMap[type.id].length === 0) && (_jsx("div", { className: "w-full text-center py-4", children: _jsx("span", { className: "text-gray-400 text-sm italic", children: "No values yet. Click \"+ Add Value\" to create one." }) }))] })] }, type.id))), types.length === 0 && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83C\uDFF7\uFE0F" }), _jsx("h3", { className: "text-xl font-semibold text-gray-700 mb-2", children: "No Classification Types Yet" }), _jsx("p", { className: "text-gray-600 mb-4", children: "Create your first classification type to start organizing your classes." }), _jsx("p", { className: "text-sm text-gray-500 mb-6", children: "For example: \"Grade\", \"Section\", \"House\", \"Gender\", or any custom category your school uses." }), _jsx("button", { onClick: () => setShowTypeModal(true), className: "bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium shadow-md", children: "Create Your First Classification Type" })] }))] }), showTypeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-96", children: [_jsx("h3", { className: "text-xl font-bold mb-2", children: "Create Classification Type" }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Define a category for classifying your classes (e.g., \"Grade\", \"Section\", \"House\", \"Gender\")" }), _jsxs("form", { onSubmit: handleCreateType, children: [_jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Type Name ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: typeForm.name, onChange: (e) => setTypeForm({ name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: "e.g., Grade, Section, House, Gender, Stream", required: true }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: "Examples: Grade, Section, House, Gender, Stream, Level, Group" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Create" }), _jsx("button", { type: "button", onClick: () => setShowTypeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showValueModal && selectedTypeId && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto", children: [_jsxs("h3", { className: "text-xl font-bold mb-2", children: ["Add Value to ", types.find(t => t.id === selectedTypeId)?.name] }), _jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Add a specific value for this classification type. You can add multiple values." }), _jsxs("form", { onSubmit: handleCreateValue, children: [_jsxs("div", { className: "mb-4", children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: ["Value ", _jsx("span", { className: "text-red-500", children: "*" })] }), _jsx("input", { type: "text", value: valueForm.value, onChange: (e) => setValueForm({ value: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500", placeholder: getExamplePlaceholder(types.find(t => t.id === selectedTypeId)?.name || ''), required: true }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: getExampleHint(types.find(t => t.id === selectedTypeId)?.name || '') })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Add" }), _jsx("button", { type: "button", onClick: () => {
                                                setShowValueModal(false);
                                                setSelectedTypeId(null);
                                            }, className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) }))] }));
}
function PendingApprovals() {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState([]);
    const [classAssignments, setClassAssignments] = useState({});
    const [sections, setSections] = useState({});
    const [loadingSections, setLoadingSections] = useState({});
    useEffect(() => {
        loadPendingApprovals();
        loadClasses();
    }, []);
    const loadPendingApprovals = async () => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                console.error('No authentication token found');
                setLoading(false);
                return;
            }
            // Get current user info for debugging
            const { data: { user } } = await supabase.auth.getUser();
            console.log('Current user:', user?.id);
            // Get current user's profile to check school_id
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id, role, school_id, full_name')
                .eq('id', user?.id)
                .single();
            console.log('Current user profile:', currentProfile);
            console.log('Loading pending approvals for school:', currentProfile?.school_id);
            const response = await fetch(`${API_URL}/approvals/pending`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to load pending approvals:', response.status, errorData);
                throw new Error(errorData.error || 'Failed to load pending approvals');
            }
            const data = await response.json();
            console.log('Pending approvals response:', data);
            console.log('Number of pending approvals:', data.pending?.length || 0);
            if (data.pending && data.pending.length > 0) {
                console.log('Pending approvals details:', data.pending);
            }
            else {
                console.warn('No pending approvals found. This could mean:');
                console.warn('1. No students have signed up yet');
                console.warn('2. All pending approvals have been processed');
                console.warn('3. Students signed up with a different school_id');
                console.warn('4. Students have approval_status other than "pending"');
            }
            setPending(data.pending || []);
        }
        catch (error) {
            console.error('Error loading pending approvals:', error);
            // Don't show alert for 403 Forbidden - user might not have permission
            // This can happen if a non-principal user somehow accesses this page
            if (error.message?.includes('Forbidden') || error.message?.includes('403') ||
                error.message?.toLowerCase().includes('forbidden')) {
                console.warn('[PendingApprovals] Access forbidden - user may not have permission');
                // Silently fail - the role check in PrincipalDashboard will redirect them
                setPending([]);
            }
            else {
                // Only show alert for other errors
                alert(`Error loading approvals: ${error.message || 'Unknown error'}`);
            }
        }
        finally {
            setLoading(false);
        }
    };
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
            if (!response.ok)
                throw new Error('Failed to load classes');
            const data = await response.json();
            console.log('[PendingApprovals] Classes loaded:', data.classes);
            // Log classifications for debugging
            if (data.classes && data.classes.length > 0) {
                data.classes.forEach((cls) => {
                    console.log(`[PendingApprovals] Class "${cls.name}" has classifications:`, cls.classifications);
                });
            }
            setClasses(data.classes || []);
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
    };
    const loadSections = async (classId, userId) => {
        if (!classId) {
            setSections(prev => ({ ...prev, [userId]: [] }));
            setLoadingSections(prev => ({ ...prev, [userId]: false }));
            return [];
        }
        setLoadingSections(prev => ({ ...prev, [userId]: true }));
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) {
                setLoadingSections(prev => ({ ...prev, [userId]: false }));
                return [];
            }
            const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok)
                throw new Error('Failed to load sections');
            const data = await response.json();
            const sectionsList = data.sections || [];
            setSections(prev => ({ ...prev, [userId]: sectionsList }));
            // Automatically assign first section if available
            if (sectionsList.length > 0) {
                const firstSectionId = sectionsList[0].id;
                setClassAssignments(prev => ({
                    ...prev,
                    [userId]: {
                        ...(prev[userId] || { class_group_id: '', section_id: '', roll_number: '' }),
                        class_group_id: classId,
                        section_id: firstSectionId
                    }
                }));
            }
            else {
                // No sections available, set section_id to empty (will be null in backend)
                setClassAssignments(prev => ({
                    ...prev,
                    [userId]: {
                        ...(prev[userId] || { class_group_id: '', section_id: '', roll_number: '' }),
                        class_group_id: classId,
                        section_id: ''
                    }
                }));
            }
            return sectionsList;
        }
        catch (error) {
            console.error('Error loading sections:', error);
            setSections(prev => ({ ...prev, [userId]: [] }));
            return [];
        }
        finally {
            setLoadingSections(prev => ({ ...prev, [userId]: false }));
        }
    };
    const handleClassChange = async (userId, classId) => {
        // Clear section when class changes (will be auto-assigned by loadSections)
        setClassAssignments(prev => ({
            ...prev,
            [userId]: {
                ...(prev[userId] || { class_group_id: '', section_id: '', roll_number: '' }),
                class_group_id: classId,
                section_id: '' // Will be set automatically by loadSections
            }
        }));
        // Always reload sections for the new class and auto-assign first section
        if (classId) {
            // loadSections will automatically assign the first section if available
            await loadSections(classId, userId);
        }
        else {
            // Clear sections if no class selected
            setSections(prev => ({ ...prev, [userId]: [] }));
            setClassAssignments(prev => ({
                ...prev,
                [userId]: {
                    ...(prev[userId] || { class_group_id: '', section_id: '', roll_number: '' }),
                    class_group_id: '',
                    section_id: ''
                }
            }));
        }
    };
    const handleAssignmentChange = async (userId, field, value) => {
        if (field === 'class_group_id') {
            await handleClassChange(userId, value);
        }
        else {
            setClassAssignments(prev => ({
                ...prev,
                [userId]: {
                    ...prev[userId] || { class_group_id: '', section_id: '', roll_number: '' },
                    [field]: value
                }
            }));
        }
    };
    const handleApproval = async (profileId, action, userRole) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const body = {
                profile_id: profileId,
                action,
            };
            // If approving a student, include class assignment
            if (action === 'approve' && userRole === 'student') {
                const assignment = classAssignments[profileId] || {};
                if (assignment.class_group_id) {
                    body.class_group_id = assignment.class_group_id;
                    // Automatically assign first section if class has sections and no section is selected
                    if (!assignment.section_id) {
                        const userSections = sections[profileId] || [];
                        if (userSections.length > 0) {
                            // Assign first section automatically
                            body.section_id = userSections[0].id;
                        }
                        else {
                            // No sections available, send null
                            body.section_id = null;
                        }
                    }
                    else {
                        body.section_id = assignment.section_id;
                    }
                }
                if (assignment.roll_number) {
                    body.roll_number = assignment.roll_number;
                }
            }
            const response = await fetch(`${API_URL}/approvals/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to process approval');
            }
            // Remove assignment data for this user
            const newAssignments = { ...classAssignments };
            delete newAssignments[profileId];
            setClassAssignments(newAssignments);
            const newSections = { ...sections };
            delete newSections[profileId];
            setSections(newSections);
            loadPendingApprovals();
        }
        catch (error) {
            alert(error.message || 'Failed to process approval');
        }
    };
    if (loading) {
        return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Pending Approvals" }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: _jsx("div", { className: "text-2xl mb-4", children: "Loading..." }) })] }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Pending Approvals" }), _jsxs("button", { onClick: loadPendingApprovals, className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDD04" }), _jsx("span", { children: "Refresh" })] })] }), process.env.NODE_ENV === 'development' && (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm", children: [_jsx("p", { className: "font-semibold text-yellow-800 mb-2", children: "Debug Info:" }), _jsxs("p", { className: "text-yellow-700", children: ["Pending count: ", pending.length] }), _jsx("pre", { className: "text-xs text-yellow-700 overflow-auto mt-2", children: JSON.stringify(pending, null, 2) })] })), pending.length === 0 ? (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\u2705" }), _jsx("p", { className: "text-gray-600 text-lg", children: "No pending approvals" }), _jsx("p", { className: "text-gray-500 text-sm mt-2", children: "All users who have signed up and are waiting for approval will appear here." })] })) : (_jsx("div", { className: "bg-white rounded-lg shadow-md overflow-hidden", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Email" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Role" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Requested Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Class Assignment" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: pending.map((user) => {
                                const assignment = classAssignments[user.id] || { class_group_id: '', section_id: '', roll_number: '' };
                                const userSections = sections[user.id] || [];
                                const isLoadingSections = loadingSections[user.id] || false;
                                return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm font-medium text-gray-900", children: user.full_name || 'N/A' }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("div", { className: "text-sm text-gray-900", children: user.email }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: "px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800", children: user.role }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500", children: new Date(user.created_at).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4", children: user.role === 'student' ? (_jsxs("div", { className: "space-y-2 min-w-[300px]", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Class" }), _jsxs("select", { value: assignment.class_group_id, onChange: (e) => handleAssignmentChange(user.id, 'class_group_id', e.target.value), className: "text-sm border border-gray-300 rounded-md px-2 py-1 w-full", children: [_jsx("option", { value: "", children: "Select Class (Optional)" }), classes.map((cls) => {
                                                                        // Build display text with classifications
                                                                        // Backend returns classifications in format: [{ type: string, value: string }]
                                                                        const classificationText = cls.classifications && Array.isArray(cls.classifications) && cls.classifications.length > 0
                                                                            ? ` (${cls.classifications.map((c) => `${c.type}: ${c.value}`).join(', ')})`
                                                                            : '';
                                                                        return (_jsxs("option", { value: cls.id, children: [cls.name, classificationText] }, cls.id));
                                                                    })] })] }), assignment.class_group_id && (_jsx("div", { children: isLoadingSections ? (_jsx("p", { className: "text-xs text-gray-500", children: "Loading sections..." })) : userSections.length > 0 ? (_jsxs("p", { className: "text-xs text-gray-600", children: ["Section: ", _jsx("span", { className: "font-semibold", children: userSections.find(s => s.id === assignment.section_id)?.name || userSections[0]?.name || 'Auto-assigned' })] })) : (_jsx("p", { className: "text-xs text-gray-500", children: "No sections available for this class. Section will be set to null." })) })), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-gray-600 mb-1", children: "Roll Number" }), _jsx("input", { type: "text", value: assignment.roll_number, onChange: (e) => handleAssignmentChange(user.id, 'roll_number', e.target.value), placeholder: "Optional", className: "text-sm border border-gray-300 rounded-md px-2 py-1 w-full" })] })] })) : (_jsx("span", { className: "text-sm text-gray-400", children: "N/A" })) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium", children: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: () => handleApproval(user.id, 'approve', user.role), className: "bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm", children: "Approve" }), _jsx("button", { onClick: () => handleApproval(user.id, 'reject', user.role), className: "bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm", children: "Reject" })] }) })] }, user.id));
                            }) })] }) }))] }));
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
function FeeManagement() {
    const [activeTab, setActiveTab] = useState('categories');
    const [loading, setLoading] = useState(false);
    // Fee Categories
    const [feeCategories, setFeeCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', display_order: 0 });
    // Class Fees
    const [classGroups, setClassGroups] = useState([]);
    const [classFees, setClassFees] = useState([]);
    const [showClassFeeModal, setShowClassFeeModal] = useState(false);
    const [classFeeForm, setClassFeeForm] = useState({
        class_group_id: '',
        fee_category_id: '',
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
    // Optional Fees
    const [optionalFees, setOptionalFees] = useState([]);
    const [showOptionalFeeModal, setShowOptionalFeeModal] = useState(false);
    const [optionalFeeForm, setOptionalFeeForm] = useState({
        name: '',
        description: '',
        default_amount: '',
        fee_cycle: 'one-time'
    });
    // Custom Fees
    const [students, setStudents] = useState([]);
    const [customFees, setCustomFees] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [showCustomFeeModal, setShowCustomFeeModal] = useState(false);
    const [customFeeForm, setCustomFeeForm] = useState({
        student_id: '',
        fee_type: 'discount',
        description: '',
        amount: '',
        fee_cycle: 'per-bill',
        notes: ''
    });
    // Bills
    const [bills, setBills] = useState([]);
    const [selectedBill, setSelectedBill] = useState(null);
    const [showGenerateBillModal, setShowGenerateBillModal] = useState(false);
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
    // Payments
    const [payments, setPayments] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        bill_id: '',
        amount_paid: '',
        payment_mode: 'cash',
        transaction_id: '',
        cheque_number: '',
        bank_name: '',
        notes: ''
    });
    useEffect(() => {
        loadInitialData();
    }, []);
    useEffect(() => {
        if (activeTab === 'categories')
            loadFeeCategories();
        else if (activeTab === 'class-fees') {
            loadClassFees();
            loadFeeCategories(); // Always load categories for modal dropdown
        }
        else if (activeTab === 'transport')
            loadTransportData();
        else if (activeTab === 'optional')
            loadOptionalFees();
        else if (activeTab === 'custom')
            loadCustomFees();
        else if (activeTab === 'bills')
            loadBills();
        else if (activeTab === 'payments')
            loadPayments();
        else if (activeTab === 'tracking')
            loadFeeTracking();
    }, [activeTab]);
    useEffect(() => {
        if (selectedStudent && activeTab === 'custom') {
            loadCustomFees();
        }
    }, [selectedStudent]);
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
    const loadFeeCategories = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/categories`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFeeCategories(data.categories || []);
            }
        }
        catch (error) {
            console.error('Error loading fee categories:', error);
        }
        finally {
            setLoading(false);
        }
    };
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
    const loadOptionalFees = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/optional`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setOptionalFees(data.optional_fees || []);
            }
        }
        catch (error) {
            console.error('Error loading optional fees:', error);
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
            const url = selectedStudent
                ? `${API_URL}/fees/custom?student_id=${selectedStudent}`
                : `${API_URL}/fees/custom`;
            const response = await fetch(url, {
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
    const loadBills = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/bills`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setBills(data.bills || []);
            }
        }
        catch (error) {
            console.error('Error loading bills:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const loadPayments = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/payments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setPayments(data.payments || []);
            }
        }
        catch (error) {
            console.error('Error loading payments:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSaveCategory = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/categories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(categoryForm)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save category');
            }
            alert('Fee category saved successfully!');
            setShowCategoryModal(false);
            setCategoryForm({ name: '', description: '', display_order: 0 });
            loadFeeCategories();
        }
        catch (error) {
            alert(error.message || 'Failed to save category');
        }
    };
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
                    due_day: parseInt(classFeeForm.due_day.toString())
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
                fee_category_id: '',
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
    const handleSaveOptionalFee = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/optional`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...optionalFeeForm,
                    default_amount: parseFloat(optionalFeeForm.default_amount)
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save optional fee');
            }
            alert('Optional fee saved successfully!');
            setShowOptionalFeeModal(false);
            setOptionalFeeForm({
                name: '',
                description: '',
                default_amount: '',
                fee_cycle: 'one-time'
            });
            loadOptionalFees();
        }
        catch (error) {
            alert(error.message || 'Failed to save optional fee');
        }
    };
    const handleSaveCustomFee = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/custom`, {
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
                student_id: '',
                fee_type: 'discount',
                description: '',
                amount: '',
                fee_cycle: 'per-bill',
                notes: ''
            });
            loadCustomFees();
        }
        catch (error) {
            alert(error.message || 'Failed to save custom fee');
        }
    };
    const handleGenerateBills = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/bills/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(generateBillForm)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate bills');
            }
            const data = await response.json();
            alert(`Successfully generated ${data.bills_generated} bill(s)!`);
            setShowGenerateBillModal(false);
            setGenerateBillForm({
                student_id: '',
                class_group_id: '',
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear()
            });
            loadBills();
        }
        catch (error) {
            alert(error.message || 'Failed to generate bills');
        }
    };
    const handleSavePayment = async (e) => {
        e.preventDefault();
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/fees/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...paymentForm,
                    amount_paid: parseFloat(paymentForm.amount_paid)
                })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to record payment');
            }
            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            setPaymentForm({
                bill_id: '',
                amount_paid: '',
                payment_mode: 'cash',
                transaction_id: '',
                cheque_number: '',
                bank_name: '',
                notes: ''
            });
            loadPayments();
            loadBills();
        }
        catch (error) {
            alert(error.message || 'Failed to record payment');
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
    const loadFeeTracking = async () => {
        setLoading(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get all students with their bills and payments
            const [billsRes, paymentsRes] = await Promise.all([
                fetch(`${API_URL}/fees/bills`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/fees/payments`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (billsRes.ok && paymentsRes.ok) {
                const billsData = await billsRes.json();
                const paymentsData = await paymentsRes.json();
                // Group by student
                const studentFeeMap = new Map();
                // Process bills
                (billsData.bills || []).forEach((bill) => {
                    const studentId = bill.student_id;
                    if (!studentFeeMap.has(studentId)) {
                        studentFeeMap.set(studentId, {
                            student: bill.students,
                            total_assigned: 0,
                            total_paid: 0,
                            pending_amount: 0,
                            transport_amount: 0,
                            bills: [],
                            payments: []
                        });
                    }
                    const studentFee = studentFeeMap.get(studentId);
                    studentFee.total_assigned += parseFloat(bill.net_amount || 0);
                    studentFee.total_paid += parseFloat(bill.total_paid || 0);
                    studentFee.pending_amount += parseFloat(bill.balance || 0);
                    studentFee.transport_amount += parseFloat(bill.transport_fee_total || 0);
                    studentFee.bills.push(bill);
                });
                // Process payments
                (paymentsData.payments || []).forEach((payment) => {
                    const studentId = payment.student_id;
                    if (studentFeeMap.has(studentId)) {
                        studentFeeMap.get(studentId).payments.push(payment);
                    }
                });
                setFeeTracking(Array.from(studentFeeMap.values()));
            }
        }
        catch (error) {
            console.error('Error loading fee tracking:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const downloadInvoice = (bill) => {
        // Create invoice HTML
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
        // Open print dialog
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
    if (loading) {
        return (_jsx("div", { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Fee Management" }), _jsx("div", { className: "bg-white rounded-lg shadow mb-6", children: _jsx("div", { className: "border-b border-gray-200", children: _jsx("nav", { className: "flex -mb-px", children: [
                            { id: 'categories', label: 'Fee Categories' },
                            { id: 'class-fees', label: 'Class Fees' },
                            { id: 'transport', label: 'Transport' },
                            { id: 'optional', label: 'Optional Fees' },
                            { id: 'custom', label: 'Custom Fees' },
                            { id: 'bills', label: 'Fee Bills' },
                            { id: 'payments', label: 'Payments' },
                            { id: 'tracking', label: 'Fee Tracking' }
                        ].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-6 py-4 text-sm font-medium border-b-2 ${activeTab === tab.id
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`, children: tab.label }, tab.id))) }) }) }), activeTab === 'categories' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Categories" }), _jsx("button", { onClick: () => setShowCategoryModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Category" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Description" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Order" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: feeCategories.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "No fee categories found. Click \"Add Category\" to get started." }) })) : (feeCategories.map((category) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: category.name }), _jsx("td", { className: "px-6 py-4", children: category.description || '-' }), _jsx("td", { className: "px-6 py-4", children: category.display_order }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, category.id)))) })] }) })] })), activeTab === 'class-fees' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Class Fees" }), _jsx("button", { onClick: () => setShowClassFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Class Fee" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Category" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Due Day" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: classFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No class fees found. Click \"Add Class Fee\" to get started." }) })) : (classFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.class_groups?.name || '-' }), _jsx("td", { className: "px-6 py-4", children: fee.fee_categories?.name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: fee.due_day || '-' }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })), activeTab === 'transport' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Routes" }), _jsx("button", { onClick: () => setShowRouteModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Route" })] }), _jsx("div", { className: "overflow-x-auto mb-6", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bus Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Zone" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Distance" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportRoutes.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-6 py-4 text-center text-gray-500", children: "No transport routes found." }) })) : (transportRoutes.map((route) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: route.route_name }), _jsx("td", { className: "px-6 py-4", children: route.bus_number || '-' }), _jsx("td", { className: "px-6 py-4", children: route.zone || '-' }), _jsx("td", { className: "px-6 py-4", children: route.distance_km ? `${route.distance_km} km` : '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, route.id)))) })] }) })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Transport Fees" }), _jsx("button", { onClick: () => setShowTransportFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Transport Fee" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Route" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Base Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Escort Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Fuel Surcharge" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: transportFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No transport fees found." }) })) : (transportFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.transport_routes?.route_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.base_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.escort_fee || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.fuel_surcharge || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })] })), activeTab === 'optional' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Optional Fees" }), _jsx("button", { onClick: () => setShowOptionalFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Optional Fee" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Name" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Default Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: optionalFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 4, className: "px-6 py-4 text-center text-gray-500", children: "No optional fees found." }) })) : (optionalFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: fee.name }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(fee.default_amount || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })), activeTab === 'custom' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Student Custom Fees" }), _jsx("button", { onClick: () => setShowCustomFeeModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Add Custom Fee" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Filter by Student" }), _jsxs("select", { value: selectedStudent, onChange: (e) => setSelectedStudent(e.target.value), className: "w-full md:w-64 border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Students" }), students.map((student) => (_jsxs("option", { value: student.id, children: [student.profile?.full_name, " (", student.roll_number, ")"] }, student.id)))] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Type" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Description" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Cycle" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: customFees.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, className: "px-6 py-4 text-center text-gray-500", children: "No custom fees found." }) })) : (customFees.map((fee) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: fee.students?.profile?.full_name || '-' }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${['discount', 'scholarship', 'concession', 'waiver'].includes(fee.fee_type)
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'}`, children: fee.fee_type }) }), _jsx("td", { className: "px-6 py-4", children: fee.description }), _jsxs("td", { className: `px-6 py-4 font-semibold ${fee.amount < 0 ? 'text-green-600' : 'text-red-600'}`, children: [fee.amount < 0 ? '-' : '+', "\u20B9", Math.abs(parseFloat(fee.amount || 0)).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: fee.fee_cycle }), _jsx("td", { className: "px-6 py-4", children: _jsx("button", { className: "text-blue-600 hover:text-blue-800", children: "Edit" }) })] }, fee.id)))) })] }) })] })), activeTab === 'bills' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Bills" }), _jsx("button", { onClick: () => setShowGenerateBillModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Generate Bills" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bill Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Period" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Paid" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Balance" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: bills.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "px-6 py-4 text-center text-gray-500", children: "No bills found. Click \"Generate Bills\" to create bills." }) })) : (bills.map((bill) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: bill.bill_number }), _jsx("td", { className: "px-6 py-4", children: bill.students?.profile?.full_name || '-' }), _jsxs("td", { className: "px-6 py-4", children: [new Date(bill.bill_period_start).toLocaleDateString(), " - ", new Date(bill.bill_period_end).toLocaleDateString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", parseFloat(bill.net_amount || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4", children: ["\u20B9", parseFloat(bill.total_paid || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", parseFloat(bill.balance || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                        bill.status === 'partially-paid' ? 'bg-yellow-100 text-yellow-800' :
                                                            bill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'}`, children: bill.status }) }), _jsxs("td", { className: "px-6 py-4", children: [_jsx("button", { onClick: () => viewBill(bill.id), className: "text-blue-600 hover:text-blue-800 mr-2", children: "View" }), _jsx("button", { onClick: () => downloadInvoice(bill), className: "text-green-600 hover:text-green-800 mr-2", children: "Print" })] })] }, bill.id)))) })] }) })] })), activeTab === 'tracking' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Collection Tracking" }), _jsxs("div", { className: "flex gap-4", children: [_jsxs("select", { value: filterClass, onChange: (e) => setFilterClass(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Classes" }), classGroups.map((cg) => (_jsx("option", { value: cg.id, children: cg.name }, cg.id)))] }), _jsxs("select", { value: filterStatus, onChange: (e) => setFilterStatus(e.target.value), className: "border border-gray-300 rounded-lg px-4 py-2", children: [_jsx("option", { value: "", children: "All Status" }), _jsx("option", { value: "paid", children: "Paid" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "partial", children: "Partially Paid" })] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Class" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Assigned" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Total Paid" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pending Amount" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Transport Fee" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: feeTracking
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
                                                        setSelectedBill(null);
                                                    }, className: "text-blue-600 hover:text-blue-800 mr-2", children: "View Details" }) })] }, track.student?.id)))) })] }) })] })), selectedTrackingStudent && !selectedBill && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("h3", { className: "text-2xl font-bold", children: ["Fee Details - ", selectedTrackingStudent.student?.profile?.full_name] }), _jsx("button", { onClick: () => setSelectedTrackingStudent(null), className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gray-50 rounded-lg p-4", children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Fee Summary" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Assigned" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_assigned || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Total Paid" }), _jsxs("p", { className: "text-xl font-semibold text-green-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.total_paid || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Pending" }), _jsxs("p", { className: "text-xl font-semibold text-red-600", children: ["\u20B9", parseFloat(selectedTrackingStudent.pending_amount || 0).toLocaleString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Transport Fee" }), _jsxs("p", { className: "text-xl font-semibold", children: ["\u20B9", parseFloat(selectedTrackingStudent.transport_amount || 0).toLocaleString()] })] })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Fee Bills" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bill Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Period" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Net Amount" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Paid" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Balance" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Actions" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedTrackingStudent.bills?.map((bill) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: bill.bill_number }), _jsxs("td", { className: "px-6 py-4", children: [new Date(bill.bill_period_start).toLocaleDateString(), " - ", new Date(bill.bill_period_end).toLocaleDateString()] }), _jsxs("td", { className: "px-6 py-4 text-right", children: ["\u20B9", parseFloat(bill.net_amount || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-right text-green-600", children: ["\u20B9", parseFloat(bill.total_paid || 0).toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(bill.balance || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                                            bill.status === 'partially-paid' ? 'bg-yellow-100 text-yellow-800' :
                                                                                'bg-red-100 text-red-800'}`, children: bill.status }) }), _jsxs("td", { className: "px-6 py-4", children: [_jsx("button", { onClick: () => {
                                                                                viewBill(bill.id);
                                                                                setSelectedTrackingStudent(null);
                                                                            }, className: "text-blue-600 hover:text-blue-800 mr-2", children: "View" }), _jsx("button", { onClick: () => downloadInvoice(bill), className: "text-green-600 hover:text-green-800", children: "Print" })] })] }, bill.id))) })] }) })] }), selectedTrackingStudent.payments && selectedTrackingStudent.payments.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Payment History" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Number" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Transaction ID" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedTrackingStudent.payments.map((payment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: new Date(payment.payment_date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 font-medium", children: payment.payment_number }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: payment.payment_mode }), _jsx("td", { className: "px-6 py-4", children: payment.transaction_id || '-' })] }, payment.id))) })] }) })] }))] })] }) })), activeTab === 'payments' && (_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold", children: "Fee Payments" }), _jsx("button", { onClick: () => setShowPaymentModal(true), className: "bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "+ Record Payment" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Bill Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Received By" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: payments.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-6 py-4 text-center text-gray-500", children: "No payments found." }) })) : (payments.map((payment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4 font-medium", children: payment.payment_number }), _jsx("td", { className: "px-6 py-4", children: payment.fee_bills?.bill_number || '-' }), _jsx("td", { className: "px-6 py-4", children: payment.students?.profile?.full_name || '-' }), _jsxs("td", { className: "px-6 py-4 font-semibold", children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: payment.payment_mode }), _jsx("td", { className: "px-6 py-4", children: new Date(payment.payment_date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4", children: "-" })] }, payment.id)))) })] }) })] })), showCategoryModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Fee Category" }), _jsxs("form", { onSubmit: handleSaveCategory, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Name *" }), _jsx("input", { type: "text", value: categoryForm.name, onChange: (e) => setCategoryForm({ ...categoryForm, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description" }), _jsx("textarea", { value: categoryForm.description, onChange: (e) => setCategoryForm({ ...categoryForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Display Order" }), _jsx("input", { type: "number", value: categoryForm.display_order, onChange: (e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowCategoryModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showClassFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Class Fee" }), _jsxs("form", { onSubmit: handleSaveClassFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Class *" }), _jsxs("select", { value: classFeeForm.class_group_id, onChange: (e) => setClassFeeForm({ ...classFeeForm, class_group_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Category *" }), _jsxs("select", { value: classFeeForm.fee_category_id, onChange: (e) => setClassFeeForm({ ...classFeeForm, fee_category_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Category" }), feeCategories.map((category) => (_jsx("option", { value: category.id, children: category.name }, category.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Amount (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: classFeeForm.amount, onChange: (e) => setClassFeeForm({ ...classFeeForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: classFeeForm.fee_cycle, onChange: (e) => setClassFeeForm({ ...classFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), classFeeForm.fee_cycle !== 'one-time' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: classFeeForm.due_day, onChange: (e) => setClassFeeForm({ ...classFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: classFeeForm.notes, onChange: (e) => setClassFeeForm({ ...classFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowClassFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showRouteModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Route" }), _jsxs("form", { onSubmit: handleSaveRoute, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route Name *" }), _jsx("input", { type: "text", value: routeForm.route_name, onChange: (e) => setRouteForm({ ...routeForm, route_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Route A, North Zone", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bus Number" }), _jsx("input", { type: "text", value: routeForm.bus_number, onChange: (e) => setRouteForm({ ...routeForm, bus_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., BUS-001" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Zone" }), _jsx("input", { type: "text", value: routeForm.zone, onChange: (e) => setRouteForm({ ...routeForm, zone: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., North, South, East, West" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Distance (km)" }), _jsx("input", { type: "number", step: "0.1", min: "0", value: routeForm.distance_km, onChange: (e) => setRouteForm({ ...routeForm, distance_km: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description" }), _jsx("textarea", { value: routeForm.description, onChange: (e) => setRouteForm({ ...routeForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowRouteModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showTransportFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Transport Fee" }), _jsxs("form", { onSubmit: handleSaveTransportFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Route *" }), _jsxs("select", { value: transportFeeForm.route_id, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, route_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Route" }), transportRoutes.map((route) => (_jsxs("option", { value: route.id, children: [route.route_name, " ", route.bus_number ? `(${route.bus_number})` : ''] }, route.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Base Fee (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.base_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, base_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Escort Fee (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.escort_fee, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, escort_fee: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fuel Surcharge (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: transportFeeForm.fuel_surcharge, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fuel_surcharge: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: transportFeeForm.fee_cycle, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "per-trip", children: "Per Trip" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), transportFeeForm.fee_cycle !== 'per-trip' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Due Day (1-31)" }), _jsx("input", { type: "number", min: "1", max: "31", value: transportFeeForm.due_day, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, due_day: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: transportFeeForm.notes, onChange: (e) => setTransportFeeForm({ ...transportFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowTransportFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showOptionalFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Optional Fee" }), _jsxs("form", { onSubmit: handleSaveOptionalFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Name *" }), _jsx("input", { type: "text", value: optionalFeeForm.name, onChange: (e) => setOptionalFeeForm({ ...optionalFeeForm, name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Library Fee, Sports Equipment Fee", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description" }), _jsx("textarea", { value: optionalFeeForm.description, onChange: (e) => setOptionalFeeForm({ ...optionalFeeForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Default Amount (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0", value: optionalFeeForm.default_amount, onChange: (e) => setOptionalFeeForm({ ...optionalFeeForm, default_amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: optionalFeeForm.fee_cycle, onChange: (e) => setOptionalFeeForm({ ...optionalFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowOptionalFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showCustomFeeModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Add Custom Fee" }), _jsxs("form", { onSubmit: handleSaveCustomFee, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Student *" }), _jsxs("select", { value: customFeeForm.student_id, onChange: (e) => setCustomFeeForm({ ...customFeeForm, student_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Student" }), students.map((student) => (_jsxs("option", { value: student.id, children: [student.profile?.full_name, " (", student.roll_number, ")"] }, student.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Type *" }), _jsxs("select", { value: customFeeForm.fee_type, onChange: (e) => setCustomFeeForm({ ...customFeeForm, fee_type: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "discount", children: "Discount" }), _jsx("option", { value: "scholarship", children: "Scholarship" }), _jsx("option", { value: "concession", children: "Concession" }), _jsx("option", { value: "waiver", children: "Waiver" }), _jsx("option", { value: "additional", children: "Additional Fee" }), _jsx("option", { value: "fine", children: "Fine" }), _jsx("option", { value: "late-fee", children: "Late Fee" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Description *" }), _jsx("input", { type: "text", value: customFeeForm.description, onChange: (e) => setCustomFeeForm({ ...customFeeForm, description: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "e.g., Merit Scholarship, Late Admission Fine", required: true })] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium mb-2", children: ["Amount (\u20B9) *", _jsx("span", { className: "text-gray-500 text-xs ml-2", children: "(Use positive for additional/fine, negative for discount/scholarship)" })] }), _jsx("input", { type: "number", step: "0.01", value: customFeeForm.amount, onChange: (e) => setCustomFeeForm({ ...customFeeForm, amount: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: ['discount', 'scholarship', 'concession', 'waiver'].includes(customFeeForm.fee_type) ? 'e.g., -5000' : 'e.g., 5000', required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Fee Cycle *" }), _jsxs("select", { value: customFeeForm.fee_cycle, onChange: (e) => setCustomFeeForm({ ...customFeeForm, fee_cycle: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "per-bill", children: "Per Bill" }), _jsx("option", { value: "one-time", children: "One-time" }), _jsx("option", { value: "monthly", children: "Monthly" }), _jsx("option", { value: "quarterly", children: "Quarterly" }), _jsx("option", { value: "yearly", children: "Yearly" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: customFeeForm.notes, onChange: (e) => setCustomFeeForm({ ...customFeeForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Save" }), _jsx("button", { type: "button", onClick: () => setShowCustomFeeModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showGenerateBillModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-md w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Generate Fee Bills" }), _jsxs("form", { onSubmit: handleGenerateBills, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Generate For" }), _jsxs("select", { value: generateBillForm.student_id ? 'student' : generateBillForm.class_group_id ? 'class' : 'all', onChange: (e) => {
                                                        if (e.target.value === 'all') {
                                                            setGenerateBillForm({ ...generateBillForm, student_id: '', class_group_id: '' });
                                                        }
                                                        else if (e.target.value === 'student') {
                                                            setGenerateBillForm({ ...generateBillForm, class_group_id: '' });
                                                        }
                                                        else {
                                                            setGenerateBillForm({ ...generateBillForm, student_id: '' });
                                                        }
                                                    }, className: "w-full border border-gray-300 rounded-lg px-4 py-2 mb-2", children: [_jsx("option", { value: "all", children: "All Students" }), _jsx("option", { value: "class", children: "Specific Class" }), _jsx("option", { value: "student", children: "Specific Student" })] })] }), generateBillForm.student_id !== '' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Student *" }), _jsxs("select", { value: generateBillForm.student_id, onChange: (e) => setGenerateBillForm({ ...generateBillForm, student_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Student" }), students.map((student) => (_jsxs("option", { value: student.id, children: [student.profile?.full_name, " (", student.roll_number, ")"] }, student.id)))] })] })), generateBillForm.class_group_id !== '' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Class *" }), _jsxs("select", { value: generateBillForm.class_group_id, onChange: (e) => setGenerateBillForm({ ...generateBillForm, class_group_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Class" }), classGroups.map((classGroup) => (_jsx("option", { value: classGroup.id, children: classGroup.name }, classGroup.id)))] })] })), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Month *" }), _jsx("select", { value: generateBillForm.month, onChange: (e) => setGenerateBillForm({ ...generateBillForm, month: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (_jsx("option", { value: m, children: new Date(2000, m - 1).toLocaleString('default', { month: 'long' }) }, m))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Year *" }), _jsx("input", { type: "number", min: "2000", max: "2100", value: generateBillForm.year, onChange: (e) => setGenerateBillForm({ ...generateBillForm, year: parseInt(e.target.value) }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] })] }), _jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800", children: [_jsxs("p", { children: [_jsx("strong", { children: "Note:" }), " Bills will be generated based on:"] }), _jsxs("ul", { className: "list-disc list-inside mt-1", children: [_jsx("li", { children: "Class fees for the selected period" }), _jsx("li", { children: "Transport fees if student is assigned to a route" }), _jsx("li", { children: "Optional fees based on their cycle" }), _jsx("li", { children: "Custom fees (discounts, scholarships, fines)" })] })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Generate Bills" }), _jsx("button", { type: "button", onClick: () => setShowGenerateBillModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), showPaymentModal && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-2xl w-full", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Record Payment" }), _jsxs("form", { onSubmit: handleSavePayment, children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bill *" }), _jsxs("select", { value: paymentForm.bill_id, onChange: (e) => {
                                                        const bill = bills.find((b) => b.id === e.target.value);
                                                        setPaymentForm({
                                                            ...paymentForm,
                                                            bill_id: e.target.value,
                                                            amount_paid: bill ? Math.min(bill.balance || bill.net_amount, bill.net_amount).toString() : ''
                                                        });
                                                    }, className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "", children: "Select Bill" }), bills.filter((b) => (b.balance || b.net_amount) > 0).map((bill) => (_jsxs("option", { value: bill.id, children: [bill.bill_number, " - ", bill.students?.profile?.full_name, " - Balance: \u20B9", parseFloat(bill.balance || bill.net_amount || 0).toLocaleString()] }, bill.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Amount Paid (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", min: "0.01", value: paymentForm.amount_paid, onChange: (e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Payment Mode *" }), _jsxs("select", { value: paymentForm.payment_mode, onChange: (e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", required: true, children: [_jsx("option", { value: "cash", children: "Cash" }), _jsx("option", { value: "online", children: "Online" }), _jsx("option", { value: "upi", children: "UPI" }), _jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "cheque", children: "Cheque" }), _jsx("option", { value: "bank-transfer", children: "Bank Transfer" })] })] }), paymentForm.payment_mode === 'online' || paymentForm.payment_mode === 'upi' || paymentForm.payment_mode === 'card' ? (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Transaction ID" }), _jsx("input", { type: "text", value: paymentForm.transaction_id, onChange: (e) => setPaymentForm({ ...paymentForm, transaction_id: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", placeholder: "Enter transaction ID" })] })) : null, paymentForm.payment_mode === 'cheque' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Cheque Number" }), _jsx("input", { type: "text", value: paymentForm.cheque_number, onChange: (e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })] })), paymentForm.payment_mode === 'bank-transfer' && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Bank Name" }), _jsx("input", { type: "text", value: paymentForm.bank_name, onChange: (e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2" })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-2", children: "Notes" }), _jsx("textarea", { value: paymentForm.notes, onChange: (e) => setPaymentForm({ ...paymentForm, notes: e.target.value }), className: "w-full border border-gray-300 rounded-lg px-4 py-2", rows: 3 })] })] }), _jsxs("div", { className: "flex gap-4 mt-6", children: [_jsx("button", { type: "submit", className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Record Payment" }), _jsx("button", { type: "button", onClick: () => setShowPaymentModal(false), className: "flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300", children: "Cancel" })] })] })] }) })), selectedBill && (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-2xl font-bold", children: "Bill Details" }), _jsx("button", { onClick: () => setSelectedBill(null), className: "text-gray-500 hover:text-gray-700 text-2xl", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "bg-gray-50 rounded-lg p-4", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Bill Number" }), _jsx("p", { className: "font-semibold", children: selectedBill.bill_number })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Student" }), _jsx("p", { className: "font-semibold", children: selectedBill.students?.profile?.full_name || '-' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Period" }), _jsxs("p", { className: "font-semibold", children: [new Date(selectedBill.bill_period_start).toLocaleDateString(), " - ", new Date(selectedBill.bill_period_end).toLocaleDateString()] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Due Date" }), _jsx("p", { className: "font-semibold", children: new Date(selectedBill.due_date).toLocaleDateString() })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-600", children: "Status" }), _jsx("span", { className: `px-2 py-1 rounded text-xs font-semibold ${selectedBill.status === 'paid' ? 'bg-green-100 text-green-800' :
                                                            selectedBill.status === 'partially-paid' ? 'bg-yellow-100 text-yellow-800' :
                                                                selectedBill.status === 'overdue' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'}`, children: selectedBill.status })] })] }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Bill Items" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Item" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedBill.items && selectedBill.items.length > 0 ? (selectedBill.items.map((item, index) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: item.item_name }), _jsxs("td", { className: `px-6 py-4 text-right font-semibold ${item.amount < 0 ? 'text-green-600' : 'text-gray-900'}`, children: [item.amount < 0 ? '-' : '', "\u20B9", Math.abs(parseFloat(item.amount || 0)).toLocaleString()] })] }, index)))) : (_jsx("tr", { children: _jsx("td", { colSpan: 2, className: "px-6 py-4 text-center text-gray-500", children: "No items found" }) })) })] }) })] }), _jsx("div", { className: "bg-gray-50 rounded-lg p-4", children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Class Fees:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.class_fees_total || 0).toLocaleString()] })] }), selectedBill.transport_fee_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Transport Fee:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.transport_fee_total || 0).toLocaleString()] })] })), selectedBill.optional_fees_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Optional Fees:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.optional_fees_total || 0).toLocaleString()] })] })), selectedBill.custom_fees_total !== 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Custom Fees:" }), _jsxs("span", { className: `font-semibold ${selectedBill.custom_fees_total < 0 ? 'text-green-600' : ''}`, children: [selectedBill.custom_fees_total < 0 ? '-' : '+', "\u20B9", Math.abs(parseFloat(selectedBill.custom_fees_total || 0)).toLocaleString()] })] })), selectedBill.fine_total > 0 && (_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Fine:" }), _jsxs("span", { className: "font-semibold text-red-600", children: ["+\u20B9", parseFloat(selectedBill.fine_total || 0).toLocaleString()] })] })), _jsxs("div", { className: "border-t border-gray-300 pt-2 flex justify-between", children: [_jsx("span", { className: "font-semibold", children: "Gross Amount:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.gross_amount || 0).toLocaleString()] })] }), selectedBill.discount_amount > 0 && (_jsxs("div", { className: "flex justify-between text-green-600", children: [_jsx("span", { children: "Discount:" }), _jsxs("span", { className: "font-semibold", children: ["-\u20B9", parseFloat(selectedBill.discount_amount || 0).toLocaleString()] })] })), selectedBill.scholarship_amount > 0 && (_jsxs("div", { className: "flex justify-between text-green-600", children: [_jsx("span", { children: "Scholarship:" }), _jsxs("span", { className: "font-semibold", children: ["-\u20B9", parseFloat(selectedBill.scholarship_amount || 0).toLocaleString()] })] })), _jsxs("div", { className: "border-t-2 border-gray-400 pt-2 flex justify-between text-lg", children: [_jsx("span", { className: "font-bold", children: "Net Amount:" }), _jsxs("span", { className: "font-bold", children: ["\u20B9", parseFloat(selectedBill.net_amount || 0).toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Paid:" }), _jsxs("span", { className: "font-semibold", children: ["\u20B9", parseFloat(selectedBill.total_paid || 0).toLocaleString()] })] }), _jsxs("div", { className: "border-t border-gray-300 pt-2 flex justify-between text-lg", children: [_jsx("span", { className: "font-bold", children: "Balance:" }), _jsxs("span", { className: `font-bold ${parseFloat(selectedBill.balance || 0) > 0 ? 'text-red-600' : 'text-green-600'}`, children: ["\u20B9", parseFloat(selectedBill.balance || 0).toLocaleString()] })] })] }) }), selectedBill.payments && selectedBill.payments.length > 0 && (_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-bold mb-3", children: "Payment History" }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Date" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Number" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Amount" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Mode" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Transaction ID" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: selectedBill.payments.map((payment) => (_jsxs("tr", { children: [_jsx("td", { className: "px-6 py-4", children: new Date(payment.payment_date).toLocaleDateString() }), _jsx("td", { className: "px-6 py-4 font-medium", children: payment.payment_number }), _jsxs("td", { className: "px-6 py-4 text-right font-semibold", children: ["\u20B9", parseFloat(payment.amount_paid || 0).toLocaleString()] }), _jsx("td", { className: "px-6 py-4", children: payment.payment_mode }), _jsx("td", { className: "px-6 py-4", children: payment.transaction_id || '-' })] }, payment.id))) })] }) })] })), _jsxs("div", { className: "flex gap-4", children: [_jsx("button", { onClick: () => downloadInvoice(selectedBill), className: "flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700", children: "Download/Print Invoice" }), selectedBill.balance > 0 && (_jsx("button", { onClick: () => {
                                                setPaymentForm({
                                                    ...paymentForm,
                                                    bill_id: selectedBill.id,
                                                    amount_paid: selectedBill.balance.toString()
                                                });
                                                setSelectedBill(null);
                                                setShowPaymentModal(true);
                                            }, className: "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700", children: "Record Payment" }))] })] })] }) }))] }));
}
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
        else if (path === '/principal/approvals')
            setCurrentView('approvals');
    }, [location]);
    if (checkingRole) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-center", children: _jsx("div", { className: "text-2xl font-bold text-gray-600", children: "Loading..." }) }) }));
    }
    return (_jsxs("div", { className: "flex min-h-screen bg-gray-50", children: [_jsx(Sidebar, { currentPath: location.pathname }), _jsxs("div", { className: "ml-64 flex-1", children: [currentView === 'dashboard' && _jsx(DashboardOverview, {}), currentView === 'staff' && _jsx(StaffManagement, {}), currentView === 'classifications' && _jsx(ClassificationsManagement, {}), currentView === 'classes' && _jsx(ClassesManagement, {}), currentView === 'subjects' && _jsx(SubjectsManagement, {}), currentView === 'students' && _jsx(StudentsManagement, {}), currentView === 'exams' && _jsx(ExamsManagement, {}), currentView === 'salary' && _jsx(SalaryManagement, {}), currentView === 'fees' && _jsx(FeeManagement, {}), currentView === 'approvals' && _jsx(PendingApprovals, {})] })] }));
}
