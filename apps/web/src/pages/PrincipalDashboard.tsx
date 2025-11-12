import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  pendingApprovals: number;
}

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  approval_status: string;
  created_at: string;
}

interface ClassGroup {
  id: string;
  name: string;
  description: string;
  created_at: string;
  classifications?: Array<{
    type: string;
    value: string;
    type_id: string;
    value_id: string;
  }>;
  subjects?: Array<{
    id: string;
    name: string;
    code?: string;
    class_subject_id: string;
  }>;
}

interface Student {
  id: string;
  profile_id: string;
  roll_number: string;
  status: string;
  profile?: Profile;
}

function Sidebar({ currentPath }: { currentPath: string }) {
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
    { path: '/principal/approvals', label: 'Pending Approvals', icon: '⏳' },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">SchoolSaaS</h1>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                currentPath === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="absolute bottom-0 w-full p-6">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    pendingApprovals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
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

        if (!profile || !profile.school_id) {
          console.log('No profile or school_id found');
          return;
        }

        const schoolId = profile.school_id;

        // Get school info from backend API (more reliable, bypasses RLS issues)
        try {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          if (token) {
            const response = await fetch(`${API_URL}/school/info`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('School data loaded from API:', data.school);
              setSchoolInfo(data.school);
            } else {
              const errorText = await response.text();
              console.error('Error loading school from API:', errorText);
              
              // Fallback: Try Supabase directly
              const { data: school, error: schoolError } = await supabase
                .from('schools')
                .select('id, name, join_code, address, contact_email, contact_phone, logo_url, created_at')
                .eq('id', schoolId)
                .single();

              if (!schoolError && school) {
                console.log('School data loaded from Supabase fallback:', school);
                setSchoolInfo(school);
              } else {
                console.error('Error loading school from Supabase:', schoolError);
              }
            }
          }
        } catch (apiError) {
          console.error('Error loading school from API:', apiError);
          
          // Fallback: Try Supabase directly
          const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('id, name, join_code, address, contact_email, contact_phone, logo_url, created_at')
            .eq('id', schoolId)
            .single();

          if (!schoolError && school) {
            console.log('School data loaded from Supabase fallback:', school);
            setSchoolInfo(school);
          }
        }

        // Get stats
        const [students, staff, classes, approvals] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).in('role', ['clerk', 'teacher']),
          supabase.from('class_groups').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('approval_status', 'pending'),
        ]);

        setStats({
          totalStudents: students.count || 0,
          totalStaff: staff.count || 0,
          totalClasses: classes.count || 0,
          pendingApprovals: approvals.count || 0,
        });
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: '🎓', color: 'bg-blue-500' },
    { label: 'Staff Members', value: stats.totalStaff, icon: '👥', color: 'bg-green-500' },
    { label: 'Classes', value: stats.totalClasses, icon: '🏫', color: 'bg-purple-500' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: '⏳', color: 'bg-orange-500' },
  ];

  const copyJoinCode = async () => {
    if (schoolInfo?.join_code) {
      try {
        await navigator.clipboard.writeText(schoolInfo.join_code);
        setJoinCodeCopied(true);
        setTimeout(() => setJoinCodeCopied(false), 2000);
      } catch (err) {
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        {schoolInfo && (
          <p className="text-gray-600 mt-2">
            Welcome to {schoolInfo.name}
          </p>
        )}
      </div>

      {/* Join Code Card - Prominent Display */}
      {schoolInfo && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">School Join Code</h3>
              <p className="text-sm opacity-90 mb-3">
                Share this code with teachers, students, and parents so they can join your school
              </p>
              {schoolInfo.join_code ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <code className="text-2xl font-bold bg-white/20 px-4 py-2 rounded-lg font-mono">
                    {schoolInfo.join_code}
                  </code>
                  <button
                    onClick={copyJoinCode}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center gap-2"
                  >
                    {joinCodeCopied ? (
                      <>
                        <span>✓</span>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">⚠️ Join Code Not Found</p>
                  <p className="text-sm opacity-90">
                    Your school join code is missing. Please contact support or check your school settings.
                  </p>
                  <p className="text-xs opacity-75 mt-2">
                    School ID: {schoolInfo.id}
                  </p>
                </div>
              )}
            </div>
            <div className="text-6xl opacity-20 ml-4">🔑</div>
          </div>
        </div>
      )}

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && schoolInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm">
          <p className="font-semibold text-yellow-800 mb-2">Debug Info:</p>
          <pre className="text-xs text-yellow-700 overflow-auto">
            {JSON.stringify({ schoolInfo, hasJoinCode: !!schoolInfo?.join_code }, null, 2)}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} text-white p-4 rounded-full text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/principal/approvals"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-2xl mb-2">⏳</div>
            <div className="font-semibold">Review Approvals</div>
            <div className="text-sm text-gray-600">{stats.pendingApprovals} pending</div>
          </Link>
          <Link
            to="/principal/classes"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-2xl mb-2">🏫</div>
            <div className="font-semibold">Manage Classes</div>
          </Link>
          <Link
            to="/principal/staff"
            className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold">Manage Staff</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StaffManagement() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [sections, setSections] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  
  // Modal states
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewAssignmentsModalOpen, setViewAssignmentsModalOpen] = useState(false);
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

  useEffect(() => {
    loadStaff();
    loadAllClasses();
    loadAllSubjects();
    loadAllAssignments();
  }, []);

  const loadAllClasses = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllClasses(data.classes || []);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadAllSubjects = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllSubjects(data.subjects || []);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const loadAllAssignments = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/teacher-assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAllAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadSections = async (classId: string) => {
    if (!classId) {
      setSections(prev => ({ ...prev, [classId]: [] }));
      return;
    }

    if (sections[classId]) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSections(prev => ({ ...prev, [classId]: data.sections || [] }));
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadStaff = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/staff-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to load staff');

      const data = await response.json();
      setStaff(data.staff || []);
    } catch (error) {
      console.error('Error loading staff:', error);
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

  const handleViewAttendance = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/teacher-attendance?teacher_id=${teacher.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTeacherAttendance(data.attendance || []);
        setAttendanceSummary(data.summary || null);
        setAttendanceModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleMarkAttendance = async () => {
    if (!selectedTeacher) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to mark attendance');
    }
  };

  const handleEvaluatePerformance = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/staff-admin/${teacher.id}/performance`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data);
        setPerformanceModalOpen(true);
      }
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
    } catch (error: any) {
      alert(error.message || 'Failed to update teacher');
    }
  };

  const handleViewAssignments = async (teacher: Profile) => {
    setSelectedTeacher(teacher);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/teacher-assignments/teacher/${teacher.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTeacherAssignments(data.assignments || []);
        setViewAssignmentsModalOpen(true);
      }
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
    } catch (error: any) {
      alert(error.message || 'Failed to create assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return;
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
  }, [assignForm.class_group_id]);

  if (loading) return <div className="p-6">Loading...</div>;

  // Get assignments count for each teacher
  const getTeacherAssignmentsCount = (teacherId: string) => {
    return allAssignments.filter(a => a.teacher_id === teacherId).length;
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Staff Management</h2>
      
      {/* View All Assignments Button */}
      <div className="mb-4">
        <button
          onClick={() => {
            setViewAssignmentsModalOpen(true);
            setSelectedTeacher(null);
            loadAllAssignments();
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
        >
          📋 View All Assignments
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignments</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {staff.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{member.full_name || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{member.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      member.approval_status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : member.approval_status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {member.approval_status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {getTeacherAssignmentsCount(member.id)} {getTeacherAssignmentsCount(member.id) === 1 ? 'assignment' : 'assignments'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(member.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex flex-wrap gap-2">
                    {member.role === 'teacher' && (
                      <>
                        <button
                          onClick={() => handleAssignTeacher(member)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Assign to class/subject"
                        >
                          ➕ Assign
                        </button>
                        <button
                          onClick={() => handleViewAttendance(member)}
                          className="text-green-600 hover:text-green-900"
                          title="View attendance"
                        >
                          📅 Attendance
                        </button>
                        <button
                          onClick={() => handleEvaluatePerformance(member)}
                          className="text-purple-600 hover:text-purple-900"
                          title="View performance"
                        >
                          📊 Performance
                        </button>
                        <button
                          onClick={() => handleViewAssignments(member)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View assignments"
                        >
                          👁️ Assignments
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleEditTeacher(member)}
                      className="text-orange-600 hover:text-orange-900"
                      title="Edit teacher"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDeactivateTeacher(member)}
                      className={`${member.approval_status === 'approved' ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                      title={member.approval_status === 'approved' ? 'Deactivate' : 'Activate'}
                    >
                      {member.approval_status === 'approved' ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && (
          <div className="text-center py-12 text-gray-500">No staff members found.</div>
        )}
      </div>

      {/* Assign Teacher Modal */}
      {assignModalOpen && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Assign Teacher: {selectedTeacher.full_name}</h3>
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

      {/* View All Assignments Modal */}
      {viewAssignmentsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {selectedTeacher ? `Assignments: ${selectedTeacher.full_name}` : 'All Teacher Assignments'}
              </h3>
              <button
                onClick={() => {
                  setViewAssignmentsModalOpen(false);
                  setSelectedTeacher(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
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
                        {assignment.teacher?.full_name || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {assignment.class_groups?.name || 'N/A'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {assignment.sections?.name || 'N/A'}
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
                <div className="text-center py-8 text-gray-500">No assignments found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassesManagement() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [classificationTypes, setClassificationTypes] = useState<ClassificationType[]>([]);
  const [classificationValues, setClassificationValues] = useState<Record<string, ClassificationValue[]>>({});
  const [selectedClassificationValues, setSelectedClassificationValues] = useState<string[]>([]);
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  useEffect(() => {
    loadClasses();
    loadClassificationTypes();
    loadAllSubjects();
  }, []);

  const loadAllSubjects = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
      const data = await response.json();
      setAllSubjects(data.subjects || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const handleManageSubjects = async (classItem: ClassGroup) => {
    // Reload classes to get the latest data including subjects
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (token) {
      try {
        const response = await fetch(`${API_URL}/classes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const updatedClass = data.classes?.find((c: ClassGroup) => c.id === classItem.id) || classItem;
          setSelectedClass(updatedClass);
          setClasses(data.classes || []);
        } else {
          setSelectedClass(classItem);
        }
      } catch (error) {
        console.error('Error loading classes:', error);
        setSelectedClass(classItem);
      }
    } else {
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
      const updatedClass = updatedClasses.find((c: ClassGroup) => c.id === selectedClass.id);
      if (updatedClass) {
        setSelectedClass(updatedClass);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to add subject');
    }
  };

  const handleRemoveSubject = async (classSubjectId: string) => {
    if (!selectedClass) return;

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
        const updatedClass = updatedClasses.find((c: ClassGroup) => c.id === selectedClass.id);
        if (updatedClass) {
          setSelectedClass(updatedClass);
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to remove subject');
    }
  };

  const loadClassificationTypes = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classifications/types`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
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
    } catch (error) {
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
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
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
    } catch (error: any) {
      alert(error.message || 'Failed to create class');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Classes Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create Class
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create New Class</h3>
            <form onSubmit={handleCreateClass}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Class Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classifications {classificationTypes.length > 0 && <span className="text-gray-500 font-normal">(Optional)</span>}
                </label>
                {classificationTypes.length === 0 ? (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-800 mb-2">
                      <strong>No classification types available.</strong>
                    </p>
                    <p className="text-xs text-yellow-700">
                      Create classification types (e.g., "Grade", "Stream", "House") in the Classifications section first, then add values to categorize your classes.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3">
                      Select classification values to categorize this class. You can select multiple values from different types.
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {classificationTypes.map((type) => (
                        <div key={type.id} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                          <div className="font-semibold text-sm mb-2 text-gray-700 flex items-center gap-2">
                            <span className="text-blue-600">●</span>
                            {type.name}
                          </div>
                          <div className="flex flex-wrap gap-2 ml-4">
                            {classificationValues[type.id] && classificationValues[type.id].length > 0 ? (
                              classificationValues[type.id].map((value) => (
                                <label
                                  key={value.id}
                                  className="flex items-center space-x-2 cursor-pointer px-2 py-1 bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedClassificationValues.includes(value.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedClassificationValues([...selectedClassificationValues, value.id]);
                                      } else {
                                        setSelectedClassificationValues(
                                          selectedClassificationValues.filter(id => id !== value.id)
                                        );
                                      }
                                    }}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-700">{value.value}</span>
                                </label>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">No values available for this type</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedClassificationValues.length > 0 && (
                      <div className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                        ✓ {selectedClassificationValues.length} classification value(s) selected
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedClassificationValues([]);
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((classItem) => (
          <div key={classItem.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-900">{classItem.name}</h3>
            </div>
            
            {/* Classifications Display */}
            {classItem.classifications && classItem.classifications.length > 0 ? (
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Classifications
                </div>
                <div className="flex flex-wrap gap-2">
                  {classItem.classifications.map((classification, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-md text-xs font-medium text-blue-800 shadow-sm"
                      title={`${classification.type}: ${classification.value}`}
                    >
                      <span className="font-semibold text-blue-600">{classification.type}:</span>{' '}
                      <span className="text-blue-800">{classification.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <div className="text-xs text-gray-400 italic">No classifications assigned</div>
              </div>
            )}
            
            {/* Subjects Display */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center justify-between">
                <span>Subjects</span>
                <button
                  onClick={() => handleManageSubjects(classItem)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-normal normal-case"
                  title="Manage subjects"
                >
                  ✏️ Manage
                </button>
              </div>
              {classItem.subjects && classItem.subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {classItem.subjects.map((subject) => (
                    <span
                      key={subject.id}
                      className="px-2 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-md text-xs font-medium text-green-800 shadow-sm"
                      title={subject.code ? `${subject.name} (${subject.code})` : subject.name}
                    >
                      {subject.name}
                      {subject.code && <span className="text-green-600"> ({subject.code})</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">No subjects assigned</div>
              )}
            </div>
            
            {/* Description */}
            <div className="mb-4">
              <p className="text-gray-600 text-sm">
                {classItem.description || <span className="text-gray-400 italic">No description</span>}
              </p>
            </div>
            
            {/* Metadata */}
            <div className="pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Created: {new Date(classItem.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </div>
            </div>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg font-semibold mb-2">No classes yet</p>
            <p className="text-sm">Create your first class to get started</p>
          </div>
        )}
      </div>

      {/* Manage Subjects Modal */}
      {subjectsModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Manage Subjects: {selectedClass.name}</h3>
              <button
                onClick={() => {
                  setSubjectsModalOpen(false);
                  setSelectedClass(null);
                  setSelectedSubjectId('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Add Subject Form */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold mb-3 text-gray-700">Add Subject</h4>
              <div className="flex gap-2">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a subject</option>
                  {allSubjects
                    .filter(subject => !selectedClass.subjects?.some(s => s.id === subject.id))
                    .map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} {subject.code ? `(${subject.code})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleAddSubject}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  disabled={!selectedSubjectId}
                >
                  Add
                </button>
              </div>
            </div>

            {/* Current Subjects List */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-gray-700">Current Subjects</h4>
              {selectedClass.subjects && selectedClass.subjects.length > 0 ? (
                <div className="space-y-2">
                  {selectedClass.subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{subject.name}</span>
                        {subject.code && (
                          <span className="text-gray-500 ml-2">({subject.code})</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveSubject(subject.class_subject_id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                        title="Remove subject"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No subjects assigned to this class yet.</p>
                  <p className="text-sm mt-1">Add subjects using the form above.</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  setSubjectsModalOpen(false);
                  setSelectedClass(null);
                  setSelectedSubjectId('');
                }}
                className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectsManagement() {
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; code?: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; code?: string } | null>(null);

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
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
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
    } catch (error: any) {
      alert(error.message || 'Failed to create subject');
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
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
    } catch (error: any) {
      alert(error.message || 'Failed to delete subject');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Subjects Management</h2>
        <button
          onClick={() => {
            setShowModal(true);
            setEditingSubject(null);
            setFormData({ name: '', code: '' });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Add Subject
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingSubject ? 'Edit Subject' : 'Create New Subject'}
            </h3>
            <form onSubmit={handleCreateSubject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Code (Optional)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., MATH, ENG, SCI"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingSubject ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingSubject(null);
                    setFormData({ name: '', code: '' });
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subject Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjects.map((subject) => (
              <tr key={subject.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{subject.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{subject.code || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(subject.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDeleteSubject(subject.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete subject"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-lg font-semibold mb-2">No subjects yet</p>
            <p className="text-sm">Create your first subject to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ClassWithStudents {
  id: string;
  name: string;
  description: string;
  classifications: Array<{
    type: string;
    value: string;
    type_id: string;
    value_id: string;
  }>;
  students: Array<{
    id: string;
    roll_number: string;
    status: string;
    admission_date: string;
    section_id: string | null;
    section_name: string | null;
    profile: {
      id: string;
      full_name: string;
      email: string;
      created_at: string;
    };
  }>;
  student_count: number;
}

function StudentsManagement() {
  const [classesWithStudents, setClassesWithStudents] = useState<ClassWithStudents[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [sections, setSections] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [promoteClassModalOpen, setPromoteClassModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
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

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) return;

        const response = await fetch(`${API_URL}/students-admin`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to load students');

        const data = await response.json();
        setClassesWithStudents(data.classes || []);
        setUnassignedStudents(data.unassigned || []);
        setTotalStudents(data.total_students || 0);
        
        // Auto-expand first class if available
        if (data.classes && data.classes.length > 0) {
          setExpandedClasses(new Set([data.classes[0].id]));
        }
      } catch (error) {
        console.error('Error loading students:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
    loadAllClasses();
  }, []);

  const loadAllClasses = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load classes');

      const data = await response.json();
      setAllClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSections = async (classId: string) => {
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
      if (!token) return;

      const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load sections');

      const data = await response.json();
      setSections(prev => ({ ...prev, [classId]: data.sections || [] }));
    } catch (error) {
      console.error('Error loading sections:', error);
      setSections(prev => ({ ...prev, [classId]: [] }));
    }
  };

  // Load sections when class changes in edit form
  useEffect(() => {
    if (editForm.class_group_id) {
      loadSections(editForm.class_group_id);
    }
  }, [editForm.class_group_id]);

  // Load sections when class changes in promote form
  useEffect(() => {
    if (promoteForm.target_class_id) {
      loadSections(promoteForm.target_class_id);
    }
  }, [promoteForm.target_class_id]);

  const handleEditStudent = (student: any) => {
    setSelectedStudent(student);
    setEditForm({
      class_group_id: student.class_group_id || '',
      section_id: student.section_id || '',
      roll_number: student.roll_number || ''
    });
    if (student.class_group_id) {
      loadSections(student.class_group_id);
    }
    setEditModalOpen(true);
  };

  const handlePromoteStudent = (student: any) => {
    setSelectedStudent(student);
    setPromoteForm({
      target_class_id: '',
      section_id: ''
    });
    setPromoteModalOpen(true);
  };

  const handlePromoteClass = (classId: string) => {
    setSelectedClassId(classId);
    setPromoteClassForm({
      target_class_id: '',
      clear_sections: false
    });
    setPromoteClassModalOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/students-admin/${selectedStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update student');
      }

      alert('Student updated successfully!');
      setEditModalOpen(false);
      // Reload students
      window.location.reload();
    } catch (error: any) {
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
      if (!token) return;

      const response = await fetch(`${API_URL}/students-admin/${selectedStudent.id}/promote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(promoteForm),
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
    } catch (error: any) {
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
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to promote class');
    }
  };

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold mb-6">Students Management</h2>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-2xl mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Students Management</h2>
        <div className="text-lg text-gray-600">
          Total: <span className="font-bold text-blue-600">{totalStudents}</span> students
        </div>
      </div>

      {/* Classes with Students */}
      <div className="space-y-4 mb-6">
        {classesWithStudents.map((classItem) => {
          const isExpanded = expandedClasses.has(classItem.id);
          const classificationText = classItem.classifications && classItem.classifications.length > 0
            ? ` (${classItem.classifications.map(c => `${c.type}: ${c.value}`).join(', ')})`
            : '';

          return (
            <div key={classItem.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Class Header - Clickable */}
              <button
                onClick={() => toggleClass(classItem.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {classItem.name}{classificationText}
                    </h3>
                    {classItem.description && (
                      <p className="text-sm text-gray-500 mt-1">{classItem.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePromoteClass(classItem.id);
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 transition"
                    title="Promote entire class"
                  >
                    ⬆ Promote Class
                  </button>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    {classItem.student_count} {classItem.student_count === 1 ? 'student' : 'students'}
                  </span>
                </div>
              </button>

              {/* Students List - Expandable */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Roll No.
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Section
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {classItem.students.map((student) => (
                          <tr key={student.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {student.roll_number || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {student.profile?.full_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.section_name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.profile?.email || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  student.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {student.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditStudent(student)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Edit student"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handlePromoteStudent(student)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Promote/Demote student"
                                >
                                  ⬆ Promote
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned Students */}
      {unassignedStudents.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
            <h3 className="text-lg font-semibold text-yellow-800">
              Unassigned Students ({unassignedStudents.length})
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              These students haven't been assigned to a class yet.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll No.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unassignedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {student.roll_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {student.profile?.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.profile?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditStudent(student)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Assign class to student"
                      >
                        ✏️ Assign Class
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {classesWithStudents.length === 0 && unassignedStudents.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-500 text-lg">No students found.</div>
          <div className="text-gray-400 text-sm mt-2">
            Students will appear here once they are approved and assigned to classes.
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Edit Student: {selectedStudent.profile?.full_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={editForm.class_group_id}
                  onChange={(e) => {
                    setEditForm({ ...editForm, class_group_id: e.target.value, section_id: '' });
                    if (e.target.value) {
                      loadSections(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">No Class</option>
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
              {editForm.class_group_id && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <select
                    value={editForm.section_id}
                    onChange={(e) => setEditForm({ ...editForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">No Section</option>
                    {(sections[editForm.class_group_id] || []).map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Roll Number</label>
                <input
                  type="text"
                  value={editForm.roll_number}
                  onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateStudent}
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

      {/* Promote Student Modal */}
      {promoteModalOpen && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Promote/Demote Student: {selectedStudent.profile?.full_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Class</label>
                <select
                  value={promoteForm.target_class_id}
                  onChange={(e) => {
                    setPromoteForm({ ...promoteForm, target_class_id: e.target.value, section_id: '' });
                    if (e.target.value) {
                      loadSections(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Target Class</option>
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
              {promoteForm.target_class_id && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section (Optional)</label>
                  <select
                    value={promoteForm.section_id}
                    onChange={(e) => setPromoteForm({ ...promoteForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">No Section</option>
                    {(sections[promoteForm.target_class_id] || []).map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePromoteStudentSubmit}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Promote
              </button>
              <button
                onClick={() => setPromoteModalOpen(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote Class Modal */}
      {promoteClassModalOpen && selectedClassId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Promote Entire Class</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will move all active students from the current class to the target class.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Target Class</label>
                <select
                  value={promoteClassForm.target_class_id}
                  onChange={(e) => setPromoteClassForm({ ...promoteClassForm, target_class_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select Target Class</option>
                  {allClasses.filter(cls => cls.id !== selectedClassId).map((cls) => {
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
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={promoteClassForm.clear_sections}
                    onChange={(e) => setPromoteClassForm({ ...promoteClassForm, clear_sections: e.target.checked })}
                  />
                  <span className="text-sm">Clear section assignments</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePromoteClassSubmit}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Promote Class
              </button>
              <button
                onClick={() => setPromoteClassModalOpen(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClassificationType {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
}

interface ClassificationValue {
  id: string;
  classification_type_id: string;
  value: string;
  display_order: number;
  created_at: string;
}

// Helper functions for examples
const getExamplePlaceholder = (typeName: string): string => {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Grade 9, Grade 10, Grade 11';
  if (lower.includes('section')) return 'A, B, C, D';
  if (lower.includes('house')) return 'Blue House, Red House, Green House';
  if (lower.includes('gender')) return 'Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Science, Arts, Commerce';
  if (lower.includes('level')) return 'Junior, Senior, Advanced';
  return 'Enter value';
};

const getExampleHint = (typeName: string): string => {
  const lower = typeName.toLowerCase();
  if (lower.includes('grade')) return 'Examples: Grade 9, Grade 10, Grade 11, Grade 12';
  if (lower.includes('section')) return 'Examples: A, B, C, D, E';
  if (lower.includes('house')) return 'Examples: Blue House, Red House, Green House, Yellow House';
  if (lower.includes('gender')) return 'Examples: Boys, Girls, Mixed';
  if (lower.includes('stream')) return 'Examples: Science, Arts, Commerce, Vocational';
  if (lower.includes('level')) return 'Examples: Junior Group, Senior Group, Advanced';
  return 'Enter a value for this classification type';
};

function ClassificationsManagement() {
  const [types, setTypes] = useState<ClassificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '' });
  const [valueForm, setValueForm] = useState({ value: '' });
  const [valuesMap, setValuesMap] = useState<Record<string, ClassificationValue[]>>({});

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

      if (!response.ok) throw new Error('Failed to load classification types');
      const data = await response.json();
      setTypes(data.types || []);

      // Load values for each type
      for (const type of data.types || []) {
        loadValuesForType(type.id);
      }
    } catch (error) {
      console.error('Error loading types:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadValuesForType = async (typeId: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classifications/types/${typeId}/values`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;
      const data = await response.json();
      setValuesMap(prev => ({ ...prev, [typeId]: data.values || [] }));
    } catch (error) {
      console.error('Error loading values:', error);
    }
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to create classification type');
    }
  };

  const handleCreateValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to create classification value');
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (!confirm('Are you sure you want to delete this classification type? All values will be deleted.')) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classifications/types/${typeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete classification type');
      loadTypes();
    } catch (error: any) {
      alert(error.message || 'Failed to delete classification type');
    }
  };

  const handleDeleteValue = async (valueId: string, typeId: string) => {
    if (!confirm('Are you sure you want to delete this value?')) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classifications/values/${valueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete classification value');
      loadValuesForType(typeId);
    } catch (error: any) {
      alert(error.message || 'Failed to delete classification value');
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-bold mb-2">Dynamic Class Classifications</h2>
          <p className="text-gray-600 mb-3">
            Create custom classification types to organize your classes. Each school can define their own structure.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Examples:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Gender-based:</strong> Create type "Gender" with values "Boys", "Girls" → Classes: "Grade 9 – Boys", "Grade 9 – Girls"</li>
              <li><strong>House system:</strong> Create type "House" with values "Blue House", "Red House", "Green House"</li>
              <li><strong>Section-based:</strong> Create type "Section" with values "A", "B", "C"</li>
              <li><strong>Custom:</strong> Create type "Level" with values "Junior Group", "Senior Group"</li>
            </ul>
          </div>
        </div>
        <button
          onClick={() => setShowTypeModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md"
        >
          + Add Classification Type
        </button>
      </div>

      <div className="space-y-6">
        {types.map((type) => (
          <div key={type.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{type.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {valuesMap[type.id]?.length || 0} value{(valuesMap[type.id]?.length || 0) !== 1 ? 's' : ''} defined
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedTypeId(type.id);
                    setShowValueModal(true);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
                >
                  + Add Value
                </button>
                <button
                  onClick={() => handleDeleteType(type.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm"
                >
                  Delete Type
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(valuesMap[type.id] || []).map((value) => (
                <div
                  key={value.id}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="text-sm font-medium text-blue-900">{value.value}</span>
                  <button
                    onClick={() => handleDeleteValue(value.id, type.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center text-sm font-bold transition-colors"
                    title="Delete value"
                  >
                    ×
                  </button>
                </div>
              ))}
              {(!valuesMap[type.id] || valuesMap[type.id].length === 0) && (
                <div className="w-full text-center py-4">
                  <span className="text-gray-400 text-sm italic">No values yet. Click "+ Add Value" to create one.</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🏷️</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Classification Types Yet</h3>
            <p className="text-gray-600 mb-4">
              Create your first classification type to start organizing your classes.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              For example: "Grade", "Section", "House", "Gender", or any custom category your school uses.
            </p>
            <button
              onClick={() => setShowTypeModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium shadow-md"
            >
              Create Your First Classification Type
            </button>
          </div>
        )}
      </div>

      {showTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-2">Create Classification Type</h3>
            <p className="text-sm text-gray-600 mb-4">
              Define a category for classifying your classes (e.g., "Grade", "Section", "House", "Gender")
            </p>
            <form onSubmit={handleCreateType}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Grade, Section, House, Gender, Stream"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Examples: Grade, Section, House, Gender, Stream, Level, Group
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showValueModal && selectedTypeId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">Add Value to {types.find(t => t.id === selectedTypeId)?.name}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add a specific value for this classification type. You can add multiple values.
            </p>
            <form onSubmit={handleCreateValue}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={valueForm.value}
                  onChange={(e) => setValueForm({ value: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={getExamplePlaceholder(types.find(t => t.id === selectedTypeId)?.name || '')}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {getExampleHint(types.find(t => t.id === selectedTypeId)?.name || '')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowValueModal(false);
                    setSelectedTypeId(null);
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

function PendingApprovals() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [classAssignments, setClassAssignments] = useState<Record<string, {
    class_group_id: string;
    section_id: string;
    roll_number: string;
  }>>({});
  const [sections, setSections] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});

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
      } else {
        console.warn('No pending approvals found. This could mean:');
        console.warn('1. No students have signed up yet');
        console.warn('2. All pending approvals have been processed');
        console.warn('3. Students signed up with a different school_id');
        console.warn('4. Students have approval_status other than "pending"');
      }
      
      setPending(data.pending || []);
    } catch (error: any) {
      console.error('Error loading pending approvals:', error);
      
      // Don't show alert for 403 Forbidden - user might not have permission
      // This can happen if a non-principal user somehow accesses this page
      if (error.message?.includes('Forbidden') || error.message?.includes('403') || 
          error.message?.toLowerCase().includes('forbidden')) {
        console.warn('[PendingApprovals] Access forbidden - user may not have permission');
        // Silently fail - the role check in PrincipalDashboard will redirect them
        setPending([]);
      } else {
        // Only show alert for other errors
        alert(`Error loading approvals: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load classes');

      const data = await response.json();
      console.log('[PendingApprovals] Classes loaded:', data.classes);
      // Log classifications for debugging
      if (data.classes && data.classes.length > 0) {
        data.classes.forEach((cls: any) => {
          console.log(`[PendingApprovals] Class "${cls.name}" has classifications:`, cls.classifications);
        });
      }
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSections = async (classId: string, userId: string) => {
    if (!classId) {
      setSections(prev => ({ ...prev, [userId]: [] }));
      return;
    }

    setLoadingSections(prev => ({ ...prev, [userId]: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes/${classId}/sections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load sections');

      const data = await response.json();
      setSections(prev => ({ ...prev, [userId]: data.sections || [] }));
    } catch (error) {
      console.error('Error loading sections:', error);
    } finally {
      setLoadingSections(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleClassChange = (userId: string, classId: string) => {
    setClassAssignments(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        class_group_id: classId,
        section_id: ''
      }
    }));
    loadSections(classId, userId);
  };

  const handleAssignmentChange = (userId: string, field: 'class_group_id' | 'section_id' | 'roll_number', value: string) => {
    if (field === 'class_group_id') {
      handleClassChange(userId, value);
    } else {
      setClassAssignments(prev => ({
        ...prev,
        [userId]: {
          ...prev[userId] || { class_group_id: '', section_id: '', roll_number: '' },
          [field]: value
        }
      }));
    }
  };

  const handleApproval = async (profileId: string, action: 'approve' | 'reject', userRole?: string) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const body: any = {
        profile_id: profileId,
        action,
      };

      // If approving a student, include class assignment
      if (action === 'approve' && userRole === 'student') {
        const assignment = classAssignments[profileId] || {};
        if (assignment.class_group_id) {
          body.class_group_id = assignment.class_group_id;
        }
        if (assignment.section_id) {
          body.section_id = assignment.section_id;
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
    } catch (error: any) {
      alert(error.message || 'Failed to process approval');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-3xl font-bold mb-6">Pending Approvals</h2>
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-2xl mb-4">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Pending Approvals</h2>
        <button
          onClick={loadPendingApprovals}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm">
          <p className="font-semibold text-yellow-800 mb-2">Debug Info:</p>
          <p className="text-yellow-700">Pending count: {pending.length}</p>
          <pre className="text-xs text-yellow-700 overflow-auto mt-2">
            {JSON.stringify(pending, null, 2)}
          </pre>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <p className="text-gray-600 text-lg">No pending approvals</p>
          <p className="text-gray-500 text-sm mt-2">
            All users who have signed up and are waiting for approval will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class Assignment
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pending.map((user) => {
                const assignment = classAssignments[user.id] || { class_group_id: '', section_id: '', roll_number: '' };
                const userSections = sections[user.id] || [];
                const isLoadingSections = loadingSections[user.id] || false;

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'student' ? (
                        <div className="space-y-2 min-w-[300px]">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Class</label>
                            <select
                              value={assignment.class_group_id}
                              onChange={(e) => handleAssignmentChange(user.id, 'class_group_id', e.target.value)}
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full"
                            >
                              <option value="">Select Class (Optional)</option>
                              {classes.map((cls) => {
                                // Build display text with classifications
                                // Backend returns classifications in format: [{ type: string, value: string }]
                                const classificationText = cls.classifications && Array.isArray(cls.classifications) && cls.classifications.length > 0
                                  ? ` (${cls.classifications.map((c: any) => `${c.type}: ${c.value}`).join(', ')})`
                                  : '';
                                return (
                                  <option key={cls.id} value={cls.id}>
                                    {cls.name}{classificationText}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          {assignment.class_group_id && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Section</label>
                              <select
                                value={assignment.section_id}
                                onChange={(e) => handleAssignmentChange(user.id, 'section_id', e.target.value)}
                                disabled={isLoadingSections}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full disabled:bg-gray-100"
                              >
                                <option value="">Select Section (Optional)</option>
                                {userSections.map((section) => (
                                  <option key={section.id} value={section.id}>
                                    {section.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Roll Number</label>
                            <input
                              type="text"
                              value={assignment.roll_number}
                              onChange={(e) => handleAssignmentChange(user.id, 'roll_number', e.target.value)}
                              placeholder="Optional"
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleApproval(user.id, 'approve', user.role)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleApproval(user.id, 'reject', user.role)}
                          className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExamsManagement() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    term: '',
    start_date: '',
    end_date: '',
    class_group_ids: [] as string[]
  });
  const [applyToAllClasses, setApplyToAllClasses] = useState(true);

  useEffect(() => {
    loadExams();
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
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
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Please login to continue');
        return;
      }

      const payload: any = {
        name: formData.name,
        term: formData.term || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
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
        start_date: '',
        end_date: '',
        class_group_ids: []
      });
      setApplyToAllClasses(true);
      setShowModal(false);
      loadExams();
      alert('Exam created successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to create exam');
    }
  };

  const getExamClassesDisplay = (exam: any) => {
    const examClasses = exam.exam_classes || [];
    if (examClasses.length === 0) {
      return <span className="text-gray-500">All Classes</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {examClasses.map((ec: any, idx: number) => (
          <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            {ec.class_group?.name}
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Exams Management</h2>
        <button
          onClick={() => {
            setShowModal(true);
            setFormData({
              name: '',
              term: '',
              start_date: '',
              end_date: '',
              class_group_ids: []
            });
            setApplyToAllClasses(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Create Exam
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create New Exam</h3>
            <form onSubmit={handleCreateExam}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Exam Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                  placeholder="e.g., Mid-Term Exam, Final Exam"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Term (Optional)</label>
                <input
                  type="text"
                  value={formData.term}
                  onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g., Term 1, Semester 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={applyToAllClasses}
                    onChange={(e) => {
                      setApplyToAllClasses(e.target.checked);
                      if (e.target.checked) {
                        setFormData({ ...formData, class_group_ids: [] });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Apply to All Classes</span>
                </label>
              </div>
              {!applyToAllClasses && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Classes</label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {classes.map((cls) => (
                      <label key={cls.id} className="flex items-center space-x-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.class_group_ids.includes(cls.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                class_group_ids: [...formData.class_group_ids, cls.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                class_group_ids: formData.class_group_ids.filter(id => id !== cls.id)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{cls.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create Exam
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({
                      name: '',
                      term: '',
                      start_date: '',
                      end_date: '',
                      class_group_ids: []
                    });
                    setApplyToAllClasses(true);
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

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Exam Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Term
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Start Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                End Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {exams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  No exams created yet. Click "Create Exam" to get started.
                </td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{exam.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{exam.term || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(exam.start_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(exam.end_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4">
                    {getExamClassesDisplay(exam)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
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
        
        if (!token) {
          navigate('/login');
          return;
        }

        // Check user role via backend
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const role = data.profile?.role;
          
          // Only principals and clerks can access this dashboard
          if (role !== 'principal' && role !== 'clerk') {
            console.warn('[PrincipalDashboard] Unauthorized access attempt by role:', role);
            // Redirect to appropriate dashboard based on role
            const redirectMap: Record<string, string> = {
              student: '/student/home',
              teacher: '/teacher/classes',
              parent: '/parent/home'
            };
            const redirectPath = redirectMap[role] || '/login';
            navigate(redirectPath, { replace: true });
            return;
          }
        } else {
          console.error('[PrincipalDashboard] Failed to verify role');
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('[PrincipalDashboard] Error verifying role:', error);
        navigate('/login');
        return;
      } finally {
        setCheckingRole(false);
      }
    };

    verifyRole();
  }, [navigate]);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/principal/dashboard') setCurrentView('dashboard');
    else if (path === '/principal/staff') setCurrentView('staff');
    else if (path === '/principal/classifications') setCurrentView('classifications');
    else if (path === '/principal/classes') setCurrentView('classes');
    else if (path === '/principal/subjects') setCurrentView('subjects');
    else if (path === '/principal/students') setCurrentView('students');
    else if (path === '/principal/exams') setCurrentView('exams');
    else if (path === '/principal/approvals') setCurrentView('approvals');
  }, [location]);

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentPath={location.pathname} />
      <div className="ml-64 flex-1">
        {currentView === 'dashboard' && <DashboardOverview />}
        {currentView === 'staff' && <StaffManagement />}
        {currentView === 'classifications' && <ClassificationsManagement />}
        {currentView === 'classes' && <ClassesManagement />}
        {currentView === 'subjects' && <SubjectsManagement />}
        {currentView === 'students' && <StudentsManagement />}
        {currentView === 'exams' && <ExamsManagement />}
        {currentView === 'approvals' && <PendingApprovals />}
      </div>
    </div>
  );
}

