import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL || '', import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export default function TeacherDashboard() {
    const navigate = useNavigate();
    const [checkingRole, setCheckingRole] = useState(true);
    const [currentView, setCurrentView] = useState('classes');
    const [assignments, setAssignments] = useState([]);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    // Attendance states
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceRecords, setAttendanceRecords] = useState({});
    // Marks states
    const [exams, setExams] = useState([]);
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [marksData, setMarksData] = useState({});
    // Salary states
    const [salaryStructure, setSalaryStructure] = useState(null);
    const [salaryRecords, setSalaryRecords] = useState([]);
    const [loadingSalary, setLoadingSalary] = useState(false);
    // Fee states (read-only)
    const [studentFeeStatus, setStudentFeeStatus] = useState({});
    const [loadingFees, setLoadingFees] = useState(false);
    useEffect(() => {
        const verifyRole = async () => {
            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                if (!token) {
                    navigate('/login');
                    return;
                }
                const response = await fetch(`${API_URL}/auth/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    const role = data.profile?.role;
                    if (role !== 'teacher') {
                        console.warn('[TeacherDashboard] Unauthorized access attempt by role:', role);
                        const redirectMap = {
                            principal: '/principal/dashboard',
                            clerk: '/clerk',
                            student: '/student/home',
                            parent: '/parent/home'
                        };
                        const redirectPath = redirectMap[role] || '/login';
                        navigate(redirectPath, { replace: true });
                        return;
                    }
                    setProfile(data.profile);
                    loadAssignments();
                }
                else {
                    console.error('[TeacherDashboard] Failed to verify role');
                    navigate('/login');
                    return;
                }
            }
            catch (error) {
                console.error('[TeacherDashboard] Error verifying role:', error);
                navigate('/login');
            }
            finally {
                setCheckingRole(false);
            }
        };
        verifyRole();
    }, [navigate]);
    const loadAssignments = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const session = await supabase.auth.getSession();
            const userId = session.data.session?.user?.id;
            if (!userId)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load assignments');
            }
            const data = await response.json();
            setAssignments(data.assignments || []);
            setLoading(false);
        }
        catch (error) {
            console.error('Error loading assignments:', error);
            setLoading(false);
        }
    };
    const loadStudents = async (assignment) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Build query params
            const params = new URLSearchParams({
                class_group_id: assignment.class_group_id,
            });
            if (assignment.section_id) {
                params.append('section_id', assignment.section_id);
            }
            const response = await fetch(`${API_URL}/students-admin?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load students');
            }
            const data = await response.json();
            // Extract students from classes
            const allStudents = [];
            if (data.classes) {
                data.classes.forEach((cls) => {
                    if (cls.id === assignment.class_group_id) {
                        cls.students.forEach((student) => {
                            // Filter by section if section is assigned
                            if (!assignment.section_id || student.section_id === assignment.section_id) {
                                allStudents.push(student);
                            }
                        });
                    }
                });
            }
            setStudents(allStudents);
            setSelectedAssignment(assignment);
            // Load existing attendance for today if viewing attendance
            if (currentView === 'attendance') {
                loadAttendanceForDate(assignment, attendanceDate, allStudents);
            }
        }
        catch (error) {
            console.error('Error loading students:', error);
        }
    };
    const loadAttendanceForDate = async (assignment, date, studentList) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const response = await fetch(`${API_URL}/attendance?class_group_id=${assignment.class_group_id}&date=${date}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (response.ok) {
                const data = await response.json();
                const records = {};
                studentList.forEach((student) => {
                    const record = data.attendance?.find((a) => a.student_id === student.id);
                    records[student.id] = record?.status || 'present';
                });
                setAttendanceRecords(records);
            }
        }
        catch (error) {
            console.error('Error loading attendance:', error);
        }
    };
    const loadExams = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
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
    };
    const loadClassesForMarks = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get classes from teacher assignments
            const session = await supabase.auth.getSession();
            const userId = session.data.session?.user?.id;
            if (!userId)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load classes');
            }
            const data = await response.json();
            const assignments = data.assignments || [];
            // Get unique classes from assignments
            const uniqueClasses = new Map();
            assignments.forEach((assignment) => {
                if (!uniqueClasses.has(assignment.class_group_id)) {
                    uniqueClasses.set(assignment.class_group_id, {
                        id: assignment.class_group_id,
                        name: assignment.class_groups.name
                    });
                }
            });
            setClasses(Array.from(uniqueClasses.values()));
        }
        catch (error) {
            console.error('Error loading classes:', error);
        }
    };
    const loadSubjectsForMarks = async () => {
        if (!selectedClass) {
            setSubjects([]);
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get subjects from teacher assignments for the selected class
            const session = await supabase.auth.getSession();
            const userId = session.data.session?.user?.id;
            if (!userId)
                return;
            const response = await fetch(`${API_URL}/teacher-assignments/teacher/${userId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load subjects');
            }
            const data = await response.json();
            const assignments = data.assignments || [];
            // Filter assignments for selected class and get unique subjects
            const uniqueSubjects = new Map();
            assignments
                .filter((assignment) => assignment.class_group_id === selectedClass)
                .forEach((assignment) => {
                if (!uniqueSubjects.has(assignment.subject_id)) {
                    uniqueSubjects.set(assignment.subject_id, {
                        id: assignment.subject_id,
                        name: assignment.subjects.name,
                        code: assignment.subjects.code
                    });
                }
            });
            setSubjects(Array.from(uniqueSubjects.values()));
        }
        catch (error) {
            console.error('Error loading subjects:', error);
        }
    };
    const loadStudentsForMarks = async () => {
        if (!selectedClass) {
            setStudents([]);
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const params = new URLSearchParams({
                class_group_id: selectedClass,
            });
            const response = await fetch(`${API_URL}/students-admin?${params.toString()}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error('Failed to load students');
            }
            const data = await response.json();
            const allStudents = [];
            if (data.classes) {
                data.classes.forEach((cls) => {
                    if (cls.id === selectedClass) {
                        cls.students.forEach((student) => {
                            allStudents.push(student);
                        });
                    }
                });
            }
            setStudents(allStudents);
        }
        catch (error) {
            console.error('Error loading students:', error);
        }
    };
    const handleSaveAttendance = async () => {
        if (!selectedAssignment)
            return;
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const attendanceData = Object.entries(attendanceRecords).map(([studentId, status]) => ({
                student_id: studentId,
                class_group_id: selectedAssignment.class_group_id,
                date: attendanceDate,
                status,
                school_id: profile.school_id
            }));
            const response = await fetch(`${API_URL}/attendance/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ attendance: attendanceData }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save attendance');
            }
            alert('Attendance saved successfully!');
        }
        catch (error) {
            alert(error.message || 'Failed to save attendance');
        }
    };
    const handleSaveMarks = async () => {
        if (!selectedExam || !selectedClass || !selectedSubject) {
            alert('Please select Exam, Class, and Subject');
            return;
        }
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const marksArray = Object.entries(marksData)
                .filter(([_, data]) => data.marks_obtained && data.max_marks)
                .map(([studentId, data]) => ({
                student_id: studentId,
                exam_id: selectedExam,
                subject_id: selectedSubject,
                marks_obtained: parseFloat(data.marks_obtained),
                max_marks: parseFloat(data.max_marks),
                school_id: profile.school_id
            }));
            if (marksArray.length === 0) {
                alert('Please enter at least one mark');
                return;
            }
            const response = await fetch(`${API_URL}/marks/bulk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ marks: marksArray }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save marks');
            }
            alert('Marks saved successfully!');
            setMarksData({});
        }
        catch (error) {
            alert(error.message || 'Failed to save marks');
        }
    };
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    useEffect(() => {
        if (currentView === 'marks') {
            loadExams();
            loadClassesForMarks();
        }
    }, [currentView]);
    useEffect(() => {
        if (selectedClass) {
            loadSubjectsForMarks();
            loadStudentsForMarks();
        }
        else {
            setSubjects([]);
            setStudents([]);
        }
    }, [selectedClass]);
    useEffect(() => {
        if (selectedClass && selectedSubject) {
            loadStudentsForMarks();
        }
    }, [selectedSubject]);
    useEffect(() => {
        if (selectedAssignment && currentView === 'attendance') {
            loadAttendanceForDate(selectedAssignment, attendanceDate, students);
        }
    }, [attendanceDate, selectedAssignment, currentView]);
    const loadSalaryData = async () => {
        setLoadingSalary(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            const session = await supabase.auth.getSession();
            const userId = session.data.session?.user?.id;
            if (!userId)
                return;
            const [structureRes, recordsRes] = await Promise.all([
                fetch(`${API_URL}/salary/structure/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_URL}/salary/records`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (structureRes.ok) {
                const data = await structureRes.json();
                setSalaryStructure(data.structure);
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
            setLoadingSalary(false);
        }
    };
    const loadStudentFeeStatus = async () => {
        setLoadingFees(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token)
                return;
            // Get all students from teacher's assigned classes
            // assignments are already filtered for this teacher
            const classIds = [...new Set(assignments.map((a) => a.class_group_id))];
            if (classIds.length === 0) {
                setStudentFeeStatus({});
                return;
            }
            const statusMap = {};
            for (const classId of classIds) {
                const response = await fetch(`${API_URL}/students?class_group_id=${classId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    const students = data.students || [];
                    for (const student of students) {
                        // Fetch fee status for each student
                        const feeResponse = await fetch(`${API_URL}/fees/student/${student.id}/status`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (feeResponse.ok) {
                            const feeData = await feeResponse.json();
                            statusMap[student.id] = {
                                hasPending: feeData.hasPending || false,
                                totalPending: feeData.totalPending || 0,
                                studentName: student.profile?.full_name || '',
                                rollNumber: student.roll_number || '-'
                            };
                        }
                        else {
                            statusMap[student.id] = {
                                hasPending: false,
                                totalPending: 0,
                                studentName: student.profile?.full_name || '',
                                rollNumber: student.roll_number || '-'
                            };
                        }
                    }
                }
            }
            setStudentFeeStatus(statusMap);
        }
        catch (error) {
            console.error('Error loading student fee status:', error);
        }
        finally {
            setLoadingFees(false);
        }
    };
    useEffect(() => {
        if (currentView === 'fees') {
            // billing removed: ensure no fetch is attempted and clear status
            setStudentFeeStatus({});
            setLoadingFees(false);
        }
        if (currentView === 'salary') {
            loadSalaryData();
        }
    }, [currentView]);
    if (checkingRole || loading) {
        return (_jsx("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: _jsx("div", { className: "text-xl", children: "Loading..." }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("div", { className: "w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0", children: _jsxs("div", { className: "p-6", children: [_jsx("h1", { className: "text-2xl font-bold mb-8", children: "JhelumVerse" }), _jsxs("div", { className: "mb-6", children: [_jsx("div", { className: "text-sm text-gray-400", children: "Logged in as" }), _jsx("div", { className: "font-semibold", children: profile?.full_name || 'Teacher' }), _jsx("div", { className: "text-sm text-gray-400", children: profile?.email })] }), _jsxs("nav", { className: "space-y-2", children: [_jsx("button", { onClick: () => setCurrentView('classes'), className: `w-full text-left px-4 py-2 rounded-lg transition ${currentView === 'classes' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCDA My Classes" }), _jsx("button", { onClick: () => setCurrentView('attendance'), className: `w-full text-left px-4 py-2 rounded-lg transition ${currentView === 'attendance' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCC5 Attendance" }), _jsx("button", { onClick: () => setCurrentView('marks'), className: `w-full text-left px-4 py-2 rounded-lg transition ${currentView === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCCA Marks Entry" }), _jsx("button", { onClick: () => setCurrentView('salary'), className: `w-full text-left px-4 py-2 rounded-lg transition ${currentView === 'salary' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCB0 My Salary" }), false && (_jsx("button", { onClick: () => setCurrentView('fees'), className: `w-full text-left px-4 py-2 rounded-lg transition ${currentView === 'fees' ? 'bg-blue-600' : 'hover:bg-gray-800'}`, children: "\uD83D\uDCB5 Student Fees (View Only)" }))] }), _jsx("button", { onClick: handleLogout, className: "mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition", children: "\uD83D\uDEAA Logout" })] }) }), _jsx("div", { className: "ml-64", children: _jsxs("div", { className: "p-6", children: [currentView === 'classes' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "My Classes & Subjects" }), assignments.length === 0 ? (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-12 text-center", children: [_jsx("div", { className: "text-gray-500 text-lg mb-2", children: "No classes assigned yet" }), _jsx("div", { className: "text-gray-400 text-sm", children: "Contact your principal to assign you to classes and subjects." })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: assignments.map((assignment) => (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer", onClick: () => loadStudents(assignment), children: [_jsx("h3", { className: "text-xl font-bold mb-2", children: assignment.class_groups.name }), assignment.sections && (_jsxs("p", { className: "text-sm text-gray-600 mb-2", children: ["Section: ", assignment.sections.name] })), _jsxs("p", { className: "text-lg font-semibold text-blue-600", children: [assignment.subjects.name, " ", assignment.subjects.code && `(${assignment.subjects.code})`] }), assignment.class_groups.description && (_jsx("p", { className: "text-sm text-gray-500 mt-2", children: assignment.class_groups.description }))] }, assignment.id))) }))] })), currentView === 'attendance' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Mark Attendance" }), !selectedAssignment && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 mb-6", children: [_jsx("p", { className: "text-gray-600 mb-4", children: "Select a class to mark attendance:" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: assignments.map((assignment) => (_jsxs("button", { onClick: () => loadStudents(assignment), className: "bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition", children: [_jsx("div", { className: "font-semibold", children: assignment.class_groups.name }), assignment.sections && (_jsxs("div", { className: "text-sm text-gray-600", children: ["Section: ", assignment.sections.name] })), _jsx("div", { className: "text-blue-600", children: assignment.subjects.name })] }, assignment.id))) })] })), selectedAssignment && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-xl font-bold", children: [selectedAssignment.class_groups.name, selectedAssignment.sections && ` - ${selectedAssignment.sections.name}`] }), _jsx("p", { className: "text-gray-600", children: selectedAssignment.subjects.name })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1", children: "Date" }), _jsx("input", { type: "date", value: attendanceDate, onChange: (e) => setAttendanceDate(e.target.value), className: "px-3 py-2 border rounded-md" })] })] }), students.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No students found in this class." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll No." }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Name" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: students.map((student) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 text-sm", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-4 py-3 text-sm font-medium", children: student.profile.full_name }), _jsx("td", { className: "px-4 py-3", children: _jsxs("select", { value: attendanceRecords[student.id] || 'present', onChange: (e) => {
                                                                                    setAttendanceRecords({
                                                                                        ...attendanceRecords,
                                                                                        [student.id]: e.target.value
                                                                                    });
                                                                                }, className: "px-3 py-1 border rounded-md text-sm", children: [_jsx("option", { value: "present", children: "Present" }), _jsx("option", { value: "absent", children: "Absent" }), _jsx("option", { value: "late", children: "Late" })] }) })] }, student.id))) })] }) }), _jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx("button", { onClick: handleSaveAttendance, className: "bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700", children: "Save Attendance" }), _jsx("button", { onClick: () => {
                                                                setSelectedAssignment(null);
                                                                setStudents([]);
                                                            }, className: "bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400", children: "Back to Classes" })] })] }))] }))] })), currentView === 'marks' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Enter Marks" }), _jsx("div", { className: "bg-white rounded-lg shadow-md p-6 mb-6", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Exam *" }), _jsxs("select", { value: selectedExam, onChange: (e) => {
                                                            setSelectedExam(e.target.value);
                                                            setSelectedClass('');
                                                            setSelectedSubject('');
                                                            setStudents([]);
                                                            setMarksData({});
                                                        }, className: "w-full px-3 py-2 border border-gray-300 rounded-md", children: [_jsx("option", { value: "", children: "Select Exam" }), exams.map((exam) => (_jsxs("option", { value: exam.id, children: [exam.name, " ", exam.term && `(${exam.term})`] }, exam.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Class *" }), _jsxs("select", { value: selectedClass, onChange: (e) => {
                                                            setSelectedClass(e.target.value);
                                                            setSelectedSubject('');
                                                            setStudents([]);
                                                            setMarksData({});
                                                        }, className: "w-full px-3 py-2 border border-gray-300 rounded-md", disabled: !selectedExam, children: [_jsx("option", { value: "", children: "Select Class" }), classes.map((cls) => (_jsx("option", { value: cls.id, children: cls.name }, cls.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Select Subject *" }), _jsxs("select", { value: selectedSubject, onChange: (e) => {
                                                            setSelectedSubject(e.target.value);
                                                            setMarksData({});
                                                        }, className: "w-full px-3 py-2 border border-gray-300 rounded-md", disabled: !selectedClass, children: [_jsx("option", { value: "", children: "Select Subject" }), subjects.map((subject) => (_jsxs("option", { value: subject.id, children: [subject.name, " ", subject.code && `(${subject.code})`] }, subject.id)))] })] })] }) }), selectedExam && selectedClass && selectedSubject && (_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-xl font-bold mb-2", children: "Enter Marks for Students" }), _jsxs("p", { className: "text-gray-600", children: [exams.find(e => e.id === selectedExam)?.name, " - ", classes.find(c => c.id === selectedClass)?.name, " - ", subjects.find(s => s.id === selectedSubject)?.name] })] }), students.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No students found in this class." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll No." }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Name" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Marks Obtained" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Max Marks" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: students.map((student) => (_jsxs("tr", { children: [_jsx("td", { className: "px-4 py-3 text-sm", children: student.roll_number || 'N/A' }), _jsx("td", { className: "px-4 py-3 text-sm font-medium", children: student.profile.full_name }), _jsx("td", { className: "px-4 py-3", children: _jsx("input", { type: "number", value: marksData[student.id]?.marks_obtained || '', onChange: (e) => {
                                                                                    setMarksData({
                                                                                        ...marksData,
                                                                                        [student.id]: {
                                                                                            ...marksData[student.id],
                                                                                            marks_obtained: e.target.value,
                                                                                            max_marks: marksData[student.id]?.max_marks || ''
                                                                                        }
                                                                                    });
                                                                                }, className: "w-24 px-2 py-1 border rounded-md text-sm", placeholder: "0" }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("input", { type: "number", value: marksData[student.id]?.max_marks || '', onChange: (e) => {
                                                                                    setMarksData({
                                                                                        ...marksData,
                                                                                        [student.id]: {
                                                                                            ...marksData[student.id],
                                                                                            marks_obtained: marksData[student.id]?.marks_obtained || '',
                                                                                            max_marks: e.target.value
                                                                                        }
                                                                                    });
                                                                                }, className: "w-24 px-2 py-1 border rounded-md text-sm", placeholder: "100" }) })] }, student.id))) })] }) }), _jsxs("div", { className: "mt-4 flex gap-3", children: [_jsx("button", { onClick: handleSaveMarks, className: "bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700", children: "Submit Marks" }), _jsx("button", { onClick: () => {
                                                                setSelectedExam('');
                                                                setSelectedClass('');
                                                                setSelectedSubject('');
                                                                setStudents([]);
                                                                setMarksData({});
                                                            }, className: "bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400", children: "Reset" })] })] }))] }))] })), currentView === 'fees' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "Student Fee Status (Read-Only)" }), _jsx("p", { className: "text-gray-600 mb-4", children: "View fee status for students in your assigned classes. You cannot modify fees." }), loadingFees ? (_jsx("div", { className: "text-center py-8", children: "Loading fee status..." })) : (_jsx("div", { className: "bg-white rounded-lg shadow-md p-6", children: students.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No students found in your assigned classes." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Roll Number" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Student Name" }), _jsx("th", { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase", children: "Pending Fees" }), _jsx("th", { className: "px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase", children: "Fee Status" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: students.map((student) => {
                                                        const status = studentFeeStatus[student.id] || { hasPending: false, totalPending: 0, studentName: student.profile.full_name, rollNumber: student.roll_number || '-' };
                                                        return (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: status.rollNumber }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap font-medium", children: status.studentName }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-right", children: status.totalPending > 0 ? (_jsxs("span", { className: "text-red-600 font-semibold", children: ["\u20B9", status.totalPending.toLocaleString()] })) : (_jsx("span", { className: "text-green-600", children: "\u20B90" })) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap text-center", children: status.hasPending ? (_jsx("span", { className: "px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800", children: "Pending" })) : (_jsx("span", { className: "px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800", children: "Cleared" })) })] }, student.id));
                                                    }) })] }) })) }))] })), currentView === 'salary' && (_jsxs("div", { children: [_jsx("h2", { className: "text-3xl font-bold mb-6", children: "My Salary" }), loadingSalary ? (_jsx("div", { className: "text-center py-8", children: "Loading salary information..." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-white rounded-lg shadow-md p-6 mb-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Salary Structure" }), salaryStructure ? (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "Base Salary" }), _jsxs("div", { className: "text-lg font-semibold", children: ["\u20B9", salaryStructure.base_salary.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "HRA (House Rent Allowance)" }), _jsxs("div", { className: "text-lg font-semibold", children: ["\u20B9", salaryStructure.hra.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "Other Allowances" }), _jsxs("div", { className: "text-lg font-semibold", children: ["\u20B9", salaryStructure.other_allowances.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "Fixed Deductions" }), _jsxs("div", { className: "text-lg font-semibold text-red-600", children: ["\u20B9", salaryStructure.fixed_deductions.toLocaleString()] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "Salary Cycle" }), _jsx("div", { className: "text-lg font-semibold capitalize", children: salaryStructure.salary_cycle })] }), _jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-600", children: "Attendance-Based Deduction" }), _jsx("div", { className: "text-lg font-semibold", children: salaryStructure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled' })] }), _jsxs("div", { className: "md:col-span-2 pt-4 border-t", children: [_jsx("div", { className: "text-sm text-gray-600", children: "Gross Salary (Base + HRA + Allowances)" }), _jsxs("div", { className: "text-2xl font-bold text-green-600", children: ["\u20B9", (salaryStructure.base_salary + salaryStructure.hra + salaryStructure.other_allowances).toLocaleString()] })] })] })) : (_jsx("div", { className: "text-center py-8 text-gray-500", children: "Salary structure not set yet. Please contact your principal." }))] }), _jsxs("div", { className: "bg-white rounded-lg shadow-md p-6", children: [_jsx("h3", { className: "text-xl font-bold mb-4", children: "Salary History" }), salaryRecords.length === 0 ? (_jsx("div", { className: "text-center py-8 text-gray-500", children: "No salary records found." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Month/Year" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Gross Salary" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Deductions" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Attendance Deduction" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Net Salary" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Status" }), _jsx("th", { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Payment Date" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: salaryRecords
                                                                    .sort((a, b) => {
                                                                    if (a.year !== b.year)
                                                                        return b.year - a.year;
                                                                    return b.month - a.month;
                                                                })
                                                                    .map((record) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: [new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' }), " ", record.year] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: ["\u20B9", record.gross_salary.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap", children: ["\u20B9", record.total_deductions.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap text-red-600", children: ["\u20B9", record.attendance_deduction.toLocaleString()] }), _jsxs("td", { className: "px-6 py-4 whitespace-nowrap font-semibold text-green-600", children: ["\u20B9", record.net_salary.toLocaleString()] }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: _jsx("span", { className: `px-2 py-1 rounded text-xs ${record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                                    record.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                                                        'bg-blue-100 text-blue-800'}`, children: record.status }) }), _jsx("td", { className: "px-6 py-4 whitespace-nowrap", children: record.payment_date ? (_jsx("span", { className: "text-sm", children: new Date(record.payment_date).toLocaleDateString() })) : (_jsx("span", { className: "text-gray-400", children: "-" })) })] }, record.id))) })] }) }))] }), salaryRecords.length > 0 && (_jsx("div", { className: "mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4", children: _jsxs("p", { className: "text-sm text-blue-800", children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "Note:" }), " You can view your salary details above. For official salary slips, please contact your school administration."] }) }))] }))] }))] }) })] }));
}
