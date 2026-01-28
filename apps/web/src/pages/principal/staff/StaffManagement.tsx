import { useState, useEffect, useRef, useCallback, FormEvent, MouseEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadStaff as loadStaffService,
  loadAllClasses as loadAllClassesService,
  loadAllSubjects as loadAllSubjectsService,
  loadAllAssignments as loadAllAssignmentsService,
  loadAttendanceAssignments as loadAttendanceAssignmentsService,
  loadSections as loadSectionsService,
  loadTeacherAttendance,
  markTeacherAttendance,
  loadTeacherPerformance,
  updateTeacher,
  loadTeacherAssignments,
  loadTeacherAttendanceAssignments,
  createTeacherAssignment,
  createAttendanceAssignment,
  deleteAssignment,
  loadDailyAttendance as loadDailyAttendanceService,
  saveDailyAttendance as saveDailyAttendanceService,
  createStaff,
  deleteAttendanceAssignment
} from '../../../services/principal.service';
import { Profile } from '../types';
import type { ClassGroup, Subject } from '../../../services/types';
import TeacherPaymentHistory from '../../../components/TeacherPaymentHistory';

export default function StaffManagement() {
  // Ref to track if component is mounted (for async operations)
  const isMountedRef = useRef(true);
  
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionMenuOpen, setActionMenuOpen] = useState<Record<string, boolean>>({});
  
  // Modal states
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [dailyAttendanceModalOpen, setDailyAttendanceModalOpen] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewAssignmentsModalOpen, setViewAssignmentsModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Profile | null>(null);
  
  // Form states
  const [assignForm, setAssignForm] = useState({
    teacher_id: '',
    class_group_id: '',
    subject_id: '',
    section_id: ''
  });
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'present' as 'present' | 'absent' | 'late' | 'leave',
    notes: ''
  });
  
  // Daily attendance states
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [attendanceStats, setAttendanceStats] = useState({ totalDays: 0, presentDays: 0, absentDays: 0 });
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    approval_status: 'approved' as 'approved' | 'rejected'
  });
  
  // Data states
  const [teacherAttendance, setTeacherAttendance] = useState<any[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [attendanceAssignments, setAttendanceAssignments] = useState<any[]>([]);
  
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
    role: 'teacher' as 'clerk' | 'teacher',
    phone: '',
    gender: '' as 'male' | 'female' | 'other' | '',
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
      if (!token) return;

      const data = await loadAllClassesService(token);
      setAllClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadAllSubjects = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadAllSubjectsService(token);
      setAllSubjects(data.subjects || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadAllAssignments = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadAllAssignmentsService(token);
      setAllAssignments(data.assignments || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadAttendanceAssignments = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadAttendanceAssignmentsService(token);
      setAttendanceAssignments(data.assignments || []);
    } catch (error) {
      console.error('Error loading attendance assignments:', error);
    }
  };

  const loadSections = useCallback(async (classId: string) => {
    if (!classId) {
      setSections(prev => ({ ...prev, [classId]: [] }));
      return;
    }

    // Check if already loaded using functional update to avoid dependency
    setSections(prev => {
      if (prev[classId]) return prev; // Already loaded, don't fetch again
      
      // Fetch sections asynchronously
      (async () => {
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          if (!token) return;

          const data = await loadSectionsService(token, classId);
          setSections(prevSections => ({ ...prevSections, [classId]: data.sections || [] }));
        } catch (error) {
          console.error('Error loading sections:', error);
        }
      })();
      
      return prev; // Return unchanged for now
    });
  }, []); // Empty deps - uses functional updates

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

      const data = await loadStaffService(token);

      // Normalize staff shape:
      // - Old API: { id, profile_id, profile: { ... }, created_at }
      // - New API: flat profile rows: { id, full_name, email, role, created_at, ... }
      const normalizedStaff = (data.staff || []).map((s: any) => {
        const profile = s.profile || s;
        return {
          ...profile,
          // Prefer top-level created_at if present, otherwise profile.created_at
          created_at: s.created_at || profile.created_at
        };
      });

      setStaff(normalizedStaff);
    } catch (error: any) {
      console.error('Error loading staff:', error);
      setError(error.message || 'Failed to load staff. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeacher = (teacher: Profile) => {
    setSelectedTeacher(teacher);
    setAssignForm({
      teacher_id: teacher.id,
      class_group_id: '',
      subject_id: '',
      section_id: ''
    });
    setAssignModalOpen(true);
  };

  const handleAssignAttendanceClass = (teacher: Profile) => {
    setSelectedTeacher(teacher);
    setAttendanceAssignmentForm({
      teacher_id: teacher.id,
      class_group_id: '',
      section_id: ''
    });
    setAttendanceAssignmentModalOpen(true);
  };

  const handleViewAttendance = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadTeacherAttendance(token, teacher.id);
      setTeacherAttendance(data.attendance || []);
      setAttendanceSummary(data.summary || null);
      setAttendanceModalOpen(true);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedTeacher) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await markTeacherAttendance(token, {
        teacher_id: selectedTeacher.id,
        ...attendanceForm
      });

      alert('Attendance marked successfully!');
      setAttendanceModalOpen(false);
      // Reload attendance
      handleViewAttendance(selectedTeacher);
    } catch (error: any) {
      alert(error.message || 'Failed to mark attendance');
    }
  };

  const handleEvaluatePerformance = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadTeacherPerformance(token, teacher.id);
      setPerformanceData(data);
      setPerformanceModalOpen(true);
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  };

  const handleEditTeacher = (teacher: Profile) => {
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
    if (!selectedTeacher) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await updateTeacher(token, selectedTeacher.id, editForm);

      alert('Teacher updated successfully!');
      setEditModalOpen(false);
      loadStaff();
    } catch (error: any) {
      alert(error.message || 'Failed to update teacher');
    }
  };

  const handleDeactivateTeacher = async (teacher: Profile) => {
    if (!confirm(`Are you sure you want to ${teacher.approval_status === 'approved' ? 'deactivate' : 'activate'} ${teacher.full_name}?`)) {
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await updateTeacher(token, teacher.id, {
        approval_status: teacher.approval_status === 'approved' ? 'rejected' : 'approved'
      });

      alert(`Teacher ${teacher.approval_status === 'approved' ? 'deactivated' : 'activated'} successfully!`);
      loadStaff();
    } catch (error: any) {
      alert(error.message || 'Failed to update teacher');
    }
  };

  const handleViewAssignments = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Load both teaching and attendance assignments
      const [teachingData, attendanceData] = await Promise.all([
        loadTeacherAssignments(token, teacher.id),
        loadTeacherAttendanceAssignments(token, teacher.id)
      ]);

      setTeacherAssignments(teachingData.assignments || []);

      // Update attendance assignments for this teacher
      setAttendanceAssignments(prev => {
        const filtered = prev.filter(a => a.teacher_id !== teacher.id);
        return [...filtered, ...(attendanceData.assignments || [])];
      });

      setViewAssignmentsModalOpen(true);
    } catch (error) {
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
      if (!token) return;

      await createTeacherAssignment(token, assignForm);

      alert('Teaching assignment created successfully!');
      setAssignModalOpen(false);
      loadAllAssignments();
    } catch (error: any) {
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
      if (!token) return;

      await createAttendanceAssignment(token, {
        teacher_id: attendanceAssignmentForm.teacher_id,
        class_group_id: attendanceAssignmentForm.class_group_id,
        section_id: attendanceAssignmentForm.section_id || null
      });

      alert('Attendance assignment created successfully! Teacher can now mark attendance for this class.');
      setAttendanceAssignmentModalOpen(false);
      loadAttendanceAssignments();
    } catch (error: any) {
      alert(error.message || 'Failed to create attendance assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await deleteAssignment(token, assignmentId);

      alert('Assignment removed successfully!');
      loadAllAssignments();
      if (viewAssignmentsModalOpen) {
        handleViewAssignments(selectedTeacher!);
      }
    } catch (error: any) {
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
  }, [assignForm.class_group_id, loadSections]);

  // Get assignments count for each teacher
  const getTeacherAssignmentsCount = (teacherId: string) => {
    return allAssignments.filter(a => a.teacher_id === teacherId).length;
  };

  const loadDailyAttendance = useCallback(async (teacherId: string, month: number, year: number) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token || !isMountedRef.current) return;

      // Get first and last day of the month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      const data = await loadDailyAttendanceService(
        token,
        teacherId,
        firstDay.toISOString().split('T')[0],
        lastDay.toISOString().split('T')[0]
      );

      if (!isMountedRef.current) return;
      if (!isMountedRef.current) return;
      
      const attendanceMap: Record<string, 'present' | 'absent'> = {};
      const daysInMonth = lastDay.getDate();
      
      // Initialize all days as present by default
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
        attendanceMap[dateStr] = 'present';
      }
      
      // Override with actual attendance records (only absent ones override the default present)
      (data.attendance || []).forEach((record: any) => {
        if (record.status === 'absent') {
          attendanceMap[record.date] = 'absent';
        }
      });
      
      if (!isMountedRef.current) return;
      setDailyAttendance(attendanceMap);
      
      // Calculate stats (consider unmarked days as present)
      const totalDays = daysInMonth;
      const absentDays = Object.values(attendanceMap).filter(status => status === 'absent').length;
      const presentDays = totalDays - absentDays;
      
      if (isMountedRef.current) {
        setAttendanceStats({ totalDays, presentDays, absentDays });
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Error loading daily attendance:', error);
      }
    }
  }, []); // Empty deps - function uses isMountedRef (stable) and receives all data as parameters

  useEffect(() => {
    if (dailyAttendanceModalOpen && selectedTeacher) {
      loadDailyAttendance(selectedTeacher.id, attendanceMonth, attendanceYear);
    }
    // Always return cleanup function (even if empty) to avoid React error #310
    return () => {
      // No cleanup needed - loadDailyAttendance checks isMountedRef
    };
  }, [dailyAttendanceModalOpen, selectedTeacher, loadDailyAttendance, attendanceMonth, attendanceYear]);

  const toggleDayAttendance = (dateStr: string) => {
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
    if (!selectedTeacher) return;
    
    try {
      setSavingAttendance(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get first and last day of the month
      const firstDay = new Date(attendanceYear, attendanceMonth - 1, 1);
      const lastDay = new Date(attendanceYear, attendanceMonth, 0);
      
      // Get all absent dates
      const absentDates = Object.entries(dailyAttendance)
        .filter(([date, status]) => status === 'absent')
        .map(([date]) => date);

      await saveDailyAttendanceService(token, {
        teacher_id: selectedTeacher.id,
        start_date: firstDay.toISOString().split('T')[0],
        end_date: lastDay.toISOString().split('T')[0],
        absent_dates: absentDates
      });

      alert('Attendance saved successfully!');
      loadDailyAttendance(selectedTeacher.id, attendanceMonth, attendanceYear);
    } catch (error: any) {
      alert(error.message || 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Close action menu when clicking outside
  // CRITICAL: This useEffect MUST be before any early returns to avoid React error #310
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

  if (loading) return <div className="p-6">Loading staff...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Staff</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadStaff();
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createStaff(token, {
        email: addStaffForm.email,
        password: addStaffForm.password,
        full_name: addStaffForm.full_name,
        role: addStaffForm.role,
        phone: addStaffForm.phone || null,
        gender: addStaffForm.gender || null,
        salary_start_date: addStaffForm.role === 'teacher' && addStaffForm.salary_start_date ? addStaffForm.salary_start_date : null
      });

      alert(`${addStaffForm.role === 'clerk' ? 'Clerk' : 'Teacher'} added successfully!`);
      setAddStaffModalOpen(false);
      setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '', salary_start_date: '' });
      loadStaff();
    } catch (error: any) {
      alert(error.message || 'Failed to add staff member');
    }
  };

  // Filter staff based on search and filters
  const filteredStaff = staff.filter((member) => {
    const matchesSearch = 
      member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || member.approval_status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const toggleActionMenu = (memberId: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setActionMenuOpen(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Staff Management</h2>
            <p className="text-gray-600 mt-1">Manage your school staff members and their assignments</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setViewAssignmentsModalOpen(true);
                setSelectedTeacher(null);
                loadAllAssignments();
                loadAttendanceAssignments();
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 shadow-sm"
            >
              <span>📋</span>
              <span className="hidden sm:inline">View All Assignments</span>
              <span className="sm:hidden">Assignments</span>
            </button>
            <button
              onClick={() => setAddStaffModalOpen(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm font-semibold"
            >
              <span>➕</span>
              <span>Add Staff</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="teacher">Teachers</option>
              <option value="clerk">Clerks</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {filteredStaff.length !== staff.length && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredStaff.length} of {staff.length} staff members
            </div>
          )}
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Staff Member
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role & Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Assignments
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-6xl mb-4">👥</span>
                      <p className="text-gray-500 text-lg font-medium">No staff members found</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'Add your first staff member to get started'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => (
                  <tr key={member.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-lg">
                          {member.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">{member.full_name || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 w-fit">
                          {member.role}
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                            member.approval_status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : member.approval_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {member.approval_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {getTeacherAssignmentsCount(member.id)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getTeacherAssignmentsCount(member.id) === 1 ? 'assignment' : 'assignments'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(member.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleActionMenu(member.id);
                          }}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
                        >
                          <span>Actions</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {actionMenuOpen[member.id] && (
                          <div className="absolute right-0 mt-2 w-64 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50" onClick={(e) => e.stopPropagation()}>
                            <div className="py-1">
                              {member.role === 'teacher' && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleAssignTeacher(member);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                  >
                                    <span>📚</span>
                                    <span>Assign Teaching</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleAssignAttendanceClass(member);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-2"
                                  >
                                    <span>📅</span>
                                    <span>Assign Attendance Class</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTeacher(member);
                                      setDailyAttendanceModalOpen(true);
                                      loadDailyAttendance(member.id, attendanceMonth, attendanceYear);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2"
                                  >
                                    <span>👤</span>
                                    <span>Mark Attendance</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleEvaluatePerformance(member);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-2"
                                  >
                                    <span>📊</span>
                                    <span>View Performance</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleViewAssignments(member);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2"
                                  >
                                    <span>👁️</span>
                                    <span>View All Assignments</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTeacher(member);
                                      setPaymentHistoryModalOpen(true);
                                      setActionMenuOpen({});
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                    <span>💰</span>
                                    <span>Payment History</span>
                                  </button>
                                  <div className="border-t border-gray-200 my-1"></div>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  handleEditTeacher(member);
                                  setActionMenuOpen({});
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                              >
                                <span>✏️</span>
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  handleDeactivateTeacher(member);
                                  setActionMenuOpen({});
                                }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                                  member.approval_status === 'approved'
                                    ? 'text-red-700 hover:bg-red-50'
                                    : 'text-green-700 hover:bg-green-50'
                                }`}
                              >
                                <span>{member.approval_status === 'approved' ? '🚫' : '✅'}</span>
                                <span>{member.approval_status === 'approved' ? 'Deactivate' : 'Activate'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Teacher Modal */}
      {assignModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Teaching Assignment: {selectedTeacher.full_name}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign teacher to teach a specific subject in a class. This is separate from attendance responsibilities.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class *</label>
                <select
                  value={assignForm.class_group_id}
                  onChange={(e) => {
                    setAssignForm({ ...assignForm, class_group_id: e.target.value, section_id: '' });
                    if (e.target.value) {
                      loadSections(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Class</option>
                  {allClasses.map((cls) => {
                    const classificationText = cls.classifications && cls.classifications.length > 0
                      ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                      : '';
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{classificationText}
                      </option>
                    );
                  })}
                </select>
              </div>
              {assignForm.class_group_id && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section (Optional)</label>
                  <select
                    value={assignForm.section_id}
                    onChange={(e) => setAssignForm({ ...assignForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">No Section</option>
                    {(sections[assignForm.class_group_id] || []).map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <select
                  value={assignForm.subject_id}
                  onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Subject</option>
                  {allSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} {subject.code ? `(${subject.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateAssignment}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Assign
              </button>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Attendance Modal */}
      {attendanceModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Teacher Attendance: {selectedTeacher.full_name}</h3>
              <button
                onClick={() => setAttendanceModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {attendanceSummary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Days</p>
                  <p className="text-2xl font-bold">{attendanceSummary.totalDays}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Present</p>
                  <p className="text-2xl font-bold text-green-600">{attendanceSummary.presentDays}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{attendanceSummary.absentDays}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Percentage</p>
                  <p className="text-2xl font-bold text-purple-600">{attendanceSummary.attendancePercentage}%</p>
                </div>
              </div>
            )}

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-3">Mark Attendance for Today</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={attendanceForm.status}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="leave">Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={attendanceForm.notes}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Add notes..."
                  />
                </div>
              </div>
              <button
                onClick={handleMarkAttendance}
                className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Mark Attendance
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teacherAttendance.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-2 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            record.status === 'present'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'late'
                              ? 'bg-yellow-100 text-yellow-800'
                              : record.status === 'leave'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{record.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {teacherAttendance.length === 0 && (
                <div className="text-center py-8 text-gray-500">No attendance records yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Performance Modal */}
      {performanceModalOpen && selectedTeacher && performanceData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Performance: {selectedTeacher.full_name}</h3>
              <button
                onClick={() => setPerformanceModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Attendance Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Days:</span>
                    <span className="font-bold">{performanceData.attendance.totalDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Present:</span>
                    <span className="font-bold text-green-600">{performanceData.attendance.presentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Absent:</span>
                    <span className="font-bold text-red-600">{performanceData.attendance.absentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Late:</span>
                    <span className="font-bold text-yellow-600">{performanceData.attendance.lateDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leave:</span>
                    <span className="font-bold text-blue-600">{performanceData.attendance.leaveDays}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span>Attendance %:</span>
                    <span className="font-bold text-purple-600">{performanceData.attendance.attendancePercentage}%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Marks Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Marks Entered:</span>
                    <span className="font-bold">{performanceData.marks.totalEntered}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified:</span>
                    <span className="font-bold text-green-600">{performanceData.marks.verified}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span>Verification Rate:</span>
                    <span className="font-bold text-purple-600">{performanceData.marks.verificationRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Recent Attendance Records</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {performanceData.attendance.recentRecords.map((record: any) => (
                      <tr key={record.date}>
                        <td className="px-4 py-2 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              record.status === 'present'
                                ? 'bg-green-100 text-green-800'
                                : record.status === 'late'
                                ? 'bg-yellow-100 text-yellow-800'
                                : record.status === 'leave'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Teacher: {selectedTeacher.full_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={editForm.approval_status}
                  onChange={(e) => setEditForm({ ...editForm, approval_status: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateTeacher}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Update
              </button>
              <button
                onClick={() => setEditModalOpen(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Attendance Modal */}
      {dailyAttendanceModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Mark Daily Attendance: {selectedTeacher.full_name}</h3>
            
            {/* Month/Year Selector */}
            <div className="mb-4 flex gap-4 items-center">
              <div>
                <label className="block text-sm font-medium mb-1">Month</label>
                <select
                  value={attendanceMonth}
                  onChange={(e) => {
                    const newMonth = parseInt(e.target.value);
                    setAttendanceMonth(newMonth);
                    if (selectedTeacher) {
                      loadDailyAttendance(selectedTeacher.id, newMonth, attendanceYear);
                    }
                  }}
                  className="px-3 py-2 border rounded-md"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>
                      {new Date(2000, m-1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year</label>
                <input
                  type="number"
                  value={attendanceYear}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    setAttendanceYear(newYear);
                    if (selectedTeacher) {
                      loadDailyAttendance(selectedTeacher.id, attendanceMonth, newYear);
                    }
                  }}
                  className="px-3 py-2 border rounded-md w-24"
                  min="2000"
                  max="2100"
                />
              </div>
            </div>

            {/* Statistics */}
            <div className="mb-4 grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">Total Days</div>
                <div className="text-2xl font-bold text-blue-600">{attendanceStats.totalDays}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">Present Days</div>
                <div className="text-2xl font-bold text-green-600">{attendanceStats.presentDays}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm text-gray-600">Absent Days</div>
                <div className="text-2xl font-bold text-red-600">{attendanceStats.absentDays}</div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                💡 By default, all days are marked as <strong>Present</strong>. Click on a day to toggle it to <strong>Absent</strong>.
              </p>
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                    {day}
                  </div>
                ))}
                {/* Calendar days */}
                {(() => {
                  const firstDay = new Date(attendanceYear, attendanceMonth - 1, 1);
                  const lastDay = new Date(attendanceYear, attendanceMonth, 0);
                  const daysInMonth = lastDay.getDate();
                  const firstDayOfWeek = firstDay.getDay();
                  const days = [];
                  
                  // Empty cells for days before month starts
                  for (let i = 0; i < firstDayOfWeek; i++) {
                    days.push(<div key={`empty-${i}`} className="p-2"></div>);
                  }
                  
                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = new Date(attendanceYear, attendanceMonth - 1, day).toISOString().split('T')[0];
                    const status = dailyAttendance[dateStr] || 'present';
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    
                    days.push(
                      <button
                        key={day}
                        onClick={() => toggleDayAttendance(dateStr)}
                        className={`p-2 border-2 rounded-lg transition ${
                          status === 'absent'
                            ? 'bg-red-100 border-red-500 text-red-800 font-semibold'
                            : 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
                        } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                        title={`${day} ${new Date(attendanceYear, attendanceMonth - 1).toLocaleString('default', { month: 'long' })} - Click to toggle`}
                      >
                        <div className="text-xs font-medium">{day}</div>
                        <div className="text-xs mt-1">{status === 'absent' ? '❌' : '✅'}</div>
                      </button>
                    );
                  }
                  
                  return days;
                })()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveDailyAttendance}
                disabled={savingAttendance}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  savingAttendance
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {savingAttendance ? 'Saving...' : 'Save Attendance'}
              </button>
              <button
                onClick={() => {
                  setDailyAttendanceModalOpen(false);
                  setSelectedTeacher(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {addStaffModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Add New Staff Member</h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={addStaffForm.full_name}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select
                  value={addStaffForm.role}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, role: e.target.value as 'clerk' | 'teacher' })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="teacher">Teacher</option>
                  <option value="clerk">Clerk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={addStaffForm.email}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={addStaffForm.password}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={addStaffForm.phone}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={addStaffForm.gender}
                  onChange={(e) => setAddStaffForm({ ...addStaffForm, gender: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {/* Salary Start Date - Only show for teachers */}
              {addStaffForm.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Salary Start Date (Optional)</label>
                  <input
                    type="date"
                    value={addStaffForm.salary_start_date}
                    onChange={(e) => setAddStaffForm({ ...addStaffForm, salary_start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Specify when the salary should start. This date will be used when setting the salary structure.
                  </p>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Add Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddStaffModalOpen(false);
                    setAddStaffForm({ email: '', password: '', full_name: '', role: 'teacher', phone: '', gender: '', salary_start_date: '' });
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Assignment Modal */}
      {attendanceAssignmentModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Attendance Assignment: {selectedTeacher.full_name}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Assign teacher to mark attendance for a class. This is separate from teaching assignments. Teacher can mark day-wise attendance for this class.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class *</label>
                <select
                  value={attendanceAssignmentForm.class_group_id}
                  onChange={(e) => {
                    setAttendanceAssignmentForm({ ...attendanceAssignmentForm, class_group_id: e.target.value, section_id: '' });
                    if (e.target.value) {
                      loadSections(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Class</option>
                  {allClasses.map((cls) => {
                    const classificationText = cls.classifications && cls.classifications.length > 0
                      ? ` (${cls.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
                      : '';
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}{classificationText}
                      </option>
                    );
                  })}
                </select>
              </div>
              {attendanceAssignmentForm.class_group_id && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section (Optional)</label>
                  <select
                    value={attendanceAssignmentForm.section_id}
                    onChange={(e) => setAttendanceAssignmentForm({ ...attendanceAssignmentForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">No Section (All Sections)</option>
                    {(sections[attendanceAssignmentForm.class_group_id] || []).map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    If no section is selected, teacher can mark attendance for all sections of this class.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateAttendanceAssignment}
                className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700"
              >
                Assign Attendance
              </button>
              <button
                onClick={() => {
                  setAttendanceAssignmentModalOpen(false);
                  setSelectedTeacher(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {paymentHistoryModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto">
            <TeacherPaymentHistory
              teacherId={selectedTeacher.id}
              teacherName={selectedTeacher.full_name || undefined}
              onClose={() => {
                setPaymentHistoryModalOpen(false);
                setSelectedTeacher(null);
              }}
              showHeader={true}
            />
          </div>
        </div>
      )}

      {/* View All Assignments Modal - Shows both Teaching and Attendance */}
      {viewAssignmentsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {selectedTeacher ? `All Assignments: ${selectedTeacher.full_name}` : 'All Teacher Assignments'}
              </h3>
              <button
                onClick={() => {
                  setViewAssignmentsModalOpen(false);
                  setSelectedTeacher(null);
                  loadAllAssignments();
                  loadAttendanceAssignments();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {/* Teaching Assignments Section */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-blue-600">📚 Teaching Assignments</h4>
              <p className="text-sm text-gray-600 mb-3">
                Teachers assigned to teach specific subjects in classes.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedTeacher ? teacherAssignments : allAssignments).map((assignment: any) => (
                      <tr key={assignment.id}>
                        <td className="px-4 py-2 text-sm">
                          {assignment.teacher?.full_name || selectedTeacher?.full_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {assignment.class_groups?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {assignment.sections?.name || '-'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {assignment.subjects?.name || 'N/A'} {assignment.subjects?.code ? `(${assignment.subjects.code})` : ''}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(assignment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️ Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(selectedTeacher ? teacherAssignments : allAssignments).length === 0 && (
                  <div className="text-center py-8 text-gray-500">No teaching assignments found.</div>
                )}
              </div>
            </div>

            {/* Attendance Assignments Section */}
            <div>
              <h4 className="text-lg font-semibold mb-3 text-teal-600">📅 Attendance Assignments</h4>
              <p className="text-sm text-gray-600 mb-3">
                Teachers assigned to mark day-wise attendance for classes. Independent of teaching assignments.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedTeacher 
                      ? attendanceAssignments.filter(a => a.teacher_id === selectedTeacher.id)
                      : attendanceAssignments
                    ).map((assignment: any) => (
                      <tr key={assignment.id}>
                        <td className="px-4 py-2 text-sm">
                          {assignment.teacher?.full_name || selectedTeacher?.full_name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {assignment.class_group?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {assignment.section?.name || 'All Sections'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {new Date(assignment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            assignment.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {assignment.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <button
                            onClick={async () => {
                              if (!confirm('Are you sure you want to remove this attendance assignment?')) return;
                              try {
                                const token = (await supabase.auth.getSession()).data.session?.access_token;
                                if (!token) return;
                                await deleteAttendanceAssignment(token, assignment.id);
                                alert('Attendance assignment removed successfully!');
                                loadAttendanceAssignments();
                                if (selectedTeacher) {
                                  handleViewAssignments(selectedTeacher);
                                }
                              } catch (error: any) {
                                alert(error.message || 'Failed to remove assignment');
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️ Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(selectedTeacher 
                  ? attendanceAssignments.filter(a => a.teacher_id === selectedTeacher.id)
                  : attendanceAssignments
                ).length === 0 && (
                  <div className="text-center py-8 text-gray-500">No attendance assignments found.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}