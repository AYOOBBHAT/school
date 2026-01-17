import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { API_URL } from '../utils/api';
import UnpaidFeeAnalytics from '../components/UnpaidFeeAnalytics';
import TeacherPaymentHistory from '../components/TeacherPaymentHistory';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

interface GenderBreakdown {
  total: number;
  male: number;
  female: number;
  other: number;
  unknown: number;
}

interface DashboardStats {
  totalStudents: number;
  totalStaff: number;
  totalClasses: number;
  studentsByGender: GenderBreakdown;
  staffByGender: GenderBreakdown;
}


interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  gender?: string;
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
    { path: '/principal/salary', label: 'Salary Management', icon: '💰' },
    { path: '/principal/fees', label: 'Fee Management', icon: '💵' },
  ];

  const filteredNav = navItems;

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">JhelumVerse</h1>
        <nav className="space-y-2">
          {filteredNav.map((item) => (
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

const createEmptyBreakdown = (): GenderBreakdown => ({
  total: 0,
  male: 0,
  female: 0,
  other: 0,
  unknown: 0,
});

const normalizeGenderKey = (value?: string | null): keyof GenderBreakdown => {
  if (!value) return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (['male', 'm', 'boy', 'boys'].includes(normalized)) return 'male';
  if (['female', 'f', 'girl', 'girls'].includes(normalized)) return 'female';
  if (normalized.length > 0 && normalized !== 'male' && normalized !== 'female') return 'other';
  return 'unknown';
};

const buildGenderBreakdown = (values: Array<string | null | undefined>): GenderBreakdown => {
  const breakdown = createEmptyBreakdown();
  values.forEach((value) => {
    const key = normalizeGenderKey(value);
    breakdown.total += 1;
    breakdown[key] += 1;
  });
  return breakdown;
};

const hydrateBreakdown = (incoming?: Partial<GenderBreakdown>): GenderBreakdown => ({
  total: incoming?.total ?? 0,
  male: incoming?.male ?? 0,
  female: incoming?.female ?? 0,
  other: incoming?.other ?? 0,
  unknown: incoming?.unknown ?? 0,
});

interface DoughnutChartProps {
  title: string;
  breakdown: GenderBreakdown;
  colors?: {
    male: string;
    female: string;
    other: string;
    unknown: string;
  };
}

function DoughnutChart({ title, breakdown, colors = {
  male: '#3B82F6', // blue
  female: '#EC4899', // pink
  other: '#10B981', // green
  unknown: '#9CA3AF', // gray
} }: DoughnutChartProps) {
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {segments.map((segment, index) => (
              <path
                key={index}
                d={segment.pathData}
                fill={segment.color}
                className="transition-all duration-500"
              />
            ))}
            {breakdown.total === 0 && (
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#E5E7EB"
                strokeWidth={strokeWidth}
              />
            )}
            {/* Inner circle to create doughnut effect */}
            <circle
              cx={center}
              cy={center}
              r={radius - strokeWidth}
              fill="white"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">{breakdown.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total</div>
            </div>
          </div>
        </div>
        <div className="mt-6 w-full max-w-xs">
          <div className="grid grid-cols-2 gap-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{item.label}</div>
                  <div className="text-xs text-gray-500">
                    {item.value} ({breakdown.total > 0 ? ((item.value / breakdown.total) * 100).toFixed(1) : 0}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalStaff: 0,
    totalClasses: 0,
    studentsByGender: createEmptyBreakdown(),
    staffByGender: createEmptyBreakdown(),
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
          } else if (schoolError) {
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
            } else {
              const errorText = await response.text();
              console.error('Error loading school from API:', errorText);
              await loadSchoolInfoFromSupabase();
            }
          } catch (apiError) {
            console.error('Error loading school from API:', apiError);
            await loadSchoolInfoFromSupabase();
          }
        };

        const loadStatsFallback = async () => {
          try {
            const [
              studentRows,
              staffRows,
              classesCount
            ] = await Promise.all([
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

            if (studentRows.error) throw studentRows.error;
            if (staffRows.error) throw staffRows.error;
            if (classesCount.error) throw classesCount.error;

            const studentGenders = buildGenderBreakdown(
              (studentRows.data || []).map((student: any) => {
                const profile = Array.isArray(student.profile) ? student.profile[0] : student.profile;
                return profile?.gender;
              })
            );
            const staffGenders = buildGenderBreakdown(
              (staffRows.data || []).map((member) => member.gender)
            );

            setStats({
              totalStudents: studentGenders.total,
              totalStaff: staffGenders.total,
              totalClasses: classesCount.count || 0,
              studentsByGender: studentGenders,
              staffByGender: staffGenders,
            });
          } catch (fallbackError) {
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
          } catch (statsError) {
            console.error('Error loading dashboard stats:', statsError);
            await loadStatsFallback();
          }
        };

        await loadSchoolInfo();
        await loadStats();
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
        {schoolInfo && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 mb-6 shadow-2xl">
            <div className="absolute inset-0 bg-black opacity-10"></div>
            <div className="relative z-10">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">
                Welcome to{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-white to-yellow-200 animate-pulse">
                  {schoolInfo.name}
                </span>
              </h1>
              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                {schoolInfo.join_code && (
                  <div className="flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="font-medium text-white">School Code:</span>
                    <span className="font-mono font-bold text-yellow-200">{schoolInfo.join_code}</span>
                  </div>
                )}
                {schoolInfo.registration_number && (
                  <div className="flex items-center gap-2 bg-white bg-opacity-20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <span className="font-medium text-white">Registration No:</span>
                    <span className="font-bold text-yellow-200">{schoolInfo.registration_number}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          </div>
        )}
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <DoughnutChart
          title="Student Gender Breakdown"
          breakdown={stats.studentsByGender}
          colors={{
            male: '#3B82F6', // blue
            female: '#EC4899', // pink
            other: '#10B981', // green
            unknown: '#9CA3AF', // gray
          }}
        />
        <DoughnutChart
          title="Staff Gender Breakdown"
          breakdown={stats.staffByGender}
          colors={{
            male: '#3B82F6', // blue
            female: '#EC4899', // pink
            other: '#10B981', // green
            unknown: '#9CA3AF', // gray
          }}
        />
      </div>

      {/* Unpaid Fee Analytics */}
      <UnpaidFeeAnalytics userRole="principal" />
    </div>
  );
}

function StaffManagement() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
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
    loadStaff();
    loadAllClasses();
    loadAllSubjects();
    loadAllAssignments();
    loadAttendanceAssignments();
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

  const loadAttendanceAssignments = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/teacher-attendance-assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Error loading attendance assignments:', error);
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

  useEffect(() => {
    if (dailyAttendanceModalOpen && selectedTeacher) {
      loadDailyAttendance(selectedTeacher.id, attendanceMonth, attendanceYear);
    }
  }, [dailyAttendanceModalOpen, attendanceMonth, attendanceYear, selectedTeacher]);

  // Get assignments count for each teacher
  const getTeacherAssignmentsCount = (teacherId: string) => {
    return allAssignments.filter(a => a.teacher_id === teacherId).length;
  };

  const loadDailyAttendance = async (teacherId: string, month: number, year: number) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get first and last day of the month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      const response = await fetch(
        `${API_URL}/teacher-attendance?teacher_id=${teacherId}&start_date=${firstDay.toISOString().split('T')[0]}&end_date=${lastDay.toISOString().split('T')[0]}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
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
        
        setDailyAttendance(attendanceMap);
        
        // Calculate stats (consider unmarked days as present)
        const totalDays = daysInMonth;
        const absentDays = Object.values(attendanceMap).filter(status => status === 'absent').length;
        const presentDays = totalDays - absentDays;
        
        setAttendanceStats({ totalDays, presentDays, absentDays });
      }
    } catch (error) {
      console.error('Error loading daily attendance:', error);
    }
  };

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
    } catch (error: any) {
      alert(error.message || 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

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

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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

  const toggleActionMenu = (memberId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
    if (Object.keys(actionMenuOpen).length > 0) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [actionMenuOpen]);

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
                                } else {
                                  const error = await response.json();
                                  throw new Error(error.error || 'Failed to remove assignment');
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

function ClassesManagement() {
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
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
    } catch (error: any) {
      console.error('Error loading classes:', error);
      setError(error.message || 'Failed to load classes. Please try again.');
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

  const handleEditClass = (classItem: ClassGroup) => {
    setEditingClass(classItem);
    setFormData({ name: classItem.name, description: classItem.description || '' });
    // Set selected classification values from the class
    const currentValueIds = classItem.classifications?.map(c => c.value_id).filter(Boolean) || [];
    setSelectedClassificationValues(currentValueIds);
    setEditModal(true);
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to update class');
    }
  };

  if (loading) return <div className="p-6">Loading classes...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Classes</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadClasses();
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
              <button
                onClick={() => handleEditClass(classItem)}
                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition"
                title="Edit class"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
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

      {/* Edit Class Modal */}
      {editModal && editingClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Class</h3>
            <form onSubmit={handleUpdateClass}>
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
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditModal(false);
                    setEditingClass(null);
                    setFormData({ name: '', description: '' });
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
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; code?: string } | null>(null);

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
    } catch (error: any) {
      console.error('Error loading subjects:', error);
      setError(error.message || 'Failed to load subjects. Please try again.');
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

  if (loading) return <div className="p-6">Loading subjects...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Subjects</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadSubjects();
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
      phone?: string;
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
  const [error, setError] = useState<string | null>(null);
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
  const [editFeeConfig, setEditFeeConfig] = useState({
    class_fee_id: '',
    class_fee_discount: 0,
    transport_enabled: false,
    transport_route_id: '',
    transport_fee_discount: 0,
    other_fees: [] as Array<{ fee_category_id: string; enabled: boolean; discount: number }>,
    custom_fees: [] as Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>,
    effective_from_date: '' // Apply From Date for new fee structure
  });
  const [editDefaultFees, setEditDefaultFees] = useState<{
    class_fees: any[];
    transport_routes: any[];
    other_fee_categories: any[];
    optional_fees: any[];
    custom_fees: any[];
  } | null>(null);
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
    gender: '' as 'male' | 'female' | 'other' | '',
    date_of_birth: '',
    home_address: '',
    guardian_name: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_relationship: 'parent'
  });
  
  // Fee configuration state
  const [defaultFees, setDefaultFees] = useState<{
    class_fees: any[];
    transport_routes: any[];
    other_fee_categories: any[];
    optional_fees: any[];
    custom_fees: any[];
  } | null>(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [feeConfig, setFeeConfig] = useState({
    class_fee_id: '', // Selected class fee ID
    class_fee_discount: 0,
    transport_enabled: true,
    transport_route_id: '',
    transport_fee_discount: 0,
    other_fees: [] as Array<{ fee_category_id: string; enabled: boolean; discount: number }>,
    custom_fees: [] as Array<{ custom_fee_id: string; discount: number; is_exempt: boolean }>
  });
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({
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
      } catch (error) {
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
    } catch (error: any) {
      console.error('Error loading students:', error);
      setError(error.message || 'Failed to load students. Please try again.');
    } finally {
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
      if (!token) return;

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
    } catch (error) {
      console.error('Error loading classes:', error);
      // Don't set error state here as it's a secondary load
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

  const loadDefaultFees = async (classId: string) => {
    try {
      setLoadingFees(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
      const customFeesConfig = (data.custom_fees || []).map((cf: any) => ({
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
    } catch (error) {
      console.error('Error loading default fees:', error);
      setDefaultFees(null);
    } finally {
      setLoadingFees(false);
    }
  };

  const handleEditStudent = async (student: any) => {
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
        if (!token) return;

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
      } catch (error) {
        console.error('Error loading fee config:', error);
      }
    }
    
    // Load default fees for the class
    if (student.class_group_id) {
      loadEditDefaultFees(student.class_group_id);
    }
  };

  const loadEditDefaultFees = async (classId: string) => {
    try {
      setLoadingEditFees(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
      } else {
        // No fees configured - set to empty but section will still show with 0 amount
        setEditFeeConfig(prev => ({
          ...prev,
          class_fee_id: '',
          class_fee_discount: 0
        }));
      }
    } catch (error) {
      console.error('Error loading default fees:', error);
      setEditDefaultFees(null);
    } finally {
      setLoadingEditFees(false);
    }
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
      setUpdatingStudent(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Prepare update data
      const updateData: any = {
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
    } catch (error: any) {
      alert(error.message || 'Failed to update student');
    } finally {
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
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to promote student');
    } finally {
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
      setPromoteClassModalOpen(false);
      alert(data.message || 'Class promoted successfully!');
      
      // Refetch students data (lightweight, no full page reload)
      await loadStudents(false);
    } catch (error: any) {
      alert(error.message || 'Failed to promote class');
    } finally {
      setUpdatingStudent(false);
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
          <div className="text-2xl mb-4">Loading students...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Students</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleAddStudent = async (e: React.FormEvent) => {
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
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to add student');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Students Management</h2>
        <div className="flex items-center gap-4">
          <div className="text-lg text-gray-600">
            Total: <span className="font-bold text-blue-600">{totalStudents}</span> students
          </div>
          <button
            onClick={() => setAddStudentModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            ➕ Add Student
          </button>
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
                            Phone
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {student.profile?.phone || 'N/A'}
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
                    Phone
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {student.profile?.phone || 'N/A'}
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Student: {selectedStudent.profile?.full_name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={editForm.class_group_id}
                  onChange={(e) => {
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
                    } else {
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
              <div>
                <label className="block text-sm font-medium mb-1">Roll Number</label>
                <input
                  type="text"
                  value={editForm.roll_number}
                  onChange={(e) => setEditForm({ ...editForm, roll_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              {/* Fee Configuration Section */}
              {editForm.class_group_id && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-lg font-semibold mb-3 text-gray-700">Fee Configuration</h4>
                  
                  {/* Apply From Date - Only show when editing (not adding new student) */}
                  {selectedStudent && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Apply From Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={editFeeConfig.effective_from_date || new Date().toISOString().split('T')[0]}
                        min={selectedStudent.admission_date || undefined}
                        onChange={(e) => setEditFeeConfig({ ...editFeeConfig, effective_from_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        The new fee structure will be effective from this date. Previous fee structure remains unchanged for all months before this date.
                        {selectedStudent.admission_date && ` (Student admission date: ${new Date(selectedStudent.admission_date).toLocaleDateString()})`}
                      </p>
                    </div>
                  )}
                  
                  {loadingEditFees ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading fee information...</p>
                    </div>
                  ) : editDefaultFees ? (
                    <div className="space-y-4">
                      {/* Class Fee Section - Always show if class is selected (like transport fee) */}
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h5 className="font-semibold text-gray-700 mb-2">Class Fee (Default for this class)</h5>
                        {(() => {
                          // Get the selected class fee (auto-selected first one or manually selected)
                          const classFeesArray = editDefaultFees.class_fees && Array.isArray(editDefaultFees.class_fees) ? editDefaultFees.class_fees : [];
                          let selectedClassFee: any = null;
                          
                          if (classFeesArray.length > 0) {
                            // Try to find by editFeeConfig.class_fee_id, or use first one
                            if (editFeeConfig.class_fee_id) {
                              selectedClassFee = classFeesArray.find((cf: any) => cf.id === editFeeConfig.class_fee_id);
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
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{categoryName}:</span>
                                <span className="font-medium">₹{defaultAmount.toFixed(2)}/{feeCycle}</span>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={defaultAmount}
                                  value={editFeeConfig.class_fee_discount}
                                  onChange={(e) => {
                                    const discount = parseFloat(e.target.value) || 0;
                                    setEditFeeConfig({ ...editFeeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                  }}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                                <span>Final Amount:</span>
                                <span className="text-green-600">₹{finalAmount.toFixed(2)}/{feeCycle}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Transport Fee Section */}
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-gray-700">Transport Fee</h5>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editFeeConfig.transport_enabled}
                              onChange={(e) => setEditFeeConfig({ ...editFeeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? editFeeConfig.transport_route_id : '' })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-600">Enable Transport</span>
                          </label>
                        </div>
                        {editFeeConfig.transport_enabled && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Select Route</label>
                              <select
                                value={editFeeConfig.transport_route_id}
                                onChange={(e) => setEditFeeConfig({ ...editFeeConfig, transport_route_id: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="">Select Transport Route</option>
                                {editDefaultFees.transport_routes.map((route: any) => (
                                  <option key={route.id} value={route.id}>
                                    {route.route_name} {route.bus_number ? `(${route.bus_number})` : ''} - ₹{route.fee?.total?.toFixed(2) || '0.00'}/{route.fee?.fee_cycle || 'monthly'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {editFeeConfig.transport_route_id && (() => {
                              const selectedRoute = editDefaultFees.transport_routes.find((r: any) => r.id === editFeeConfig.transport_route_id);
                              const routeFee = selectedRoute?.fee;
                              const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                              const finalTransportAmount = Math.max(0, defaultTransportAmount - editFeeConfig.transport_fee_discount);
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Route Fee:</span>
                                    <span className="font-medium">₹{defaultTransportAmount.toFixed(2)}/{routeFee?.fee_cycle || 'monthly'}</span>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editFeeConfig.transport_fee_discount}
                                      onChange={(e) => setEditFeeConfig({ ...editFeeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 border rounded text-sm"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                                    <span>Final Amount:</span>
                                    <span className="text-green-600">₹{finalTransportAmount.toFixed(2)}/{routeFee?.fee_cycle || 'monthly'}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Custom Fees Section - Always show if class is selected */}
                      {editDefaultFees.custom_fees && Array.isArray(editDefaultFees.custom_fees) && editDefaultFees.custom_fees.length > 0 && (
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <h5 className="font-semibold text-gray-700 mb-3">Custom Fees</h5>
                          <div className="space-y-3">
                            {editDefaultFees.custom_fees.map((customFee: any) => {
                              const feeConfigItem = editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id) || {
                                custom_fee_id: customFee.id,
                                discount: 0,
                                is_exempt: false
                              };
                              const feeAmount = parseFloat(customFee.amount || 0);
                              const finalAmount = feeConfigItem.is_exempt ? 0 : Math.max(0, feeAmount - feeConfigItem.discount);
                              const classLabel = customFee.class_groups?.name || 'All Classes';
                              const feeName = customFee.fee_categories?.name || customFee.name || 'Custom Fee';
                              
                              return (
                                <div key={customFee.id} className="bg-white p-3 rounded border">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-medium text-sm">{feeName}</span>
                                          <span className="text-xs text-gray-500 ml-2">({classLabel})</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-600">
                                          ₹{feeAmount.toFixed(2)}/{customFee.fee_cycle || 'monthly'}
                                        </span>
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer ml-3">
                                      <input
                                        type="checkbox"
                                        checked={feeConfigItem.is_exempt}
                                        onChange={(e) => {
                                          const updatedCustomFees = editFeeConfig.custom_fees.map(f =>
                                            f.custom_fee_id === customFee.id
                                              ? { ...f, is_exempt: e.target.checked, discount: e.target.checked ? 0 : f.discount }
                                              : f
                                          );
                                          if (!editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                            updatedCustomFees.push({
                                              custom_fee_id: customFee.id,
                                              discount: 0,
                                              is_exempt: e.target.checked
                                            });
                                          }
                                          setEditFeeConfig({ ...editFeeConfig, custom_fees: updatedCustomFees });
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-xs text-gray-600">Exempt</span>
                                    </label>
                                  </div>
                                  {!feeConfigItem.is_exempt && (
                                    <>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          max={feeAmount}
                                          value={feeConfigItem.discount}
                                          onChange={(e) => {
                                            const discount = parseFloat(e.target.value) || 0;
                                            const updatedCustomFees = editFeeConfig.custom_fees.map(f =>
                                              f.custom_fee_id === customFee.id
                                                ? { ...f, discount: Math.min(discount, feeAmount) }
                                                : f
                                            );
                                            if (!editFeeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                              updatedCustomFees.push({
                                                custom_fee_id: customFee.id,
                                                discount: Math.min(discount, feeAmount),
                                                is_exempt: false
                                              });
                                            }
                                            setEditFeeConfig({ ...editFeeConfig, custom_fees: updatedCustomFees });
                                          }}
                                          className="w-full px-2 py-1 border rounded text-sm"
                                          placeholder="0"
                                        />
                                      </div>
                                      <div className="flex justify-between text-xs font-semibold pt-1 border-t mt-1">
                                        <span>Final Amount:</span>
                                        <span className="text-green-600">₹{finalAmount.toFixed(2)}/{customFee.fee_cycle || 'monthly'}</span>
                                      </div>
                                    </>
                                  )}
                                  {feeConfigItem.is_exempt && (
                                    <div className="text-xs text-red-600 font-semibold pt-1">
                                      Student is exempt from this fee
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a class to configure fees</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateStudent}
                disabled={updatingStudent}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {updatingStudent ? 'Updating...' : 'Update'}
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

      {/* Add Student Modal */}
      {addStudentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={addStudentForm.full_name}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={addStudentForm.email}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={addStudentForm.username}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, username: e.target.value })}
                    className={`w-full px-3 py-2 pr-10 border rounded-md ${
                      usernameStatus.available === false
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : usernameStatus.available === true
                        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                        : ''
                    }`}
                    placeholder="Unique username for login (unique per school)"
                  />
                  {addStudentForm.username.trim().length > 0 && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {usernameStatus.checking ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      ) : usernameStatus.available === true ? (
                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : usernameStatus.available === false ? (
                        <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : null}
                    </div>
                  )}
                </div>
                {addStudentForm.username.trim().length > 0 && (
                  <div className="mt-1">
                    {usernameStatus.checking ? (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                        Checking availability...
                      </p>
                    ) : usernameStatus.message ? (
                      <p className={`text-xs font-medium ${
                    usernameStatus.available === true
                      ? 'text-green-600'
                      : usernameStatus.available === false
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }`}>
                    {usernameStatus.message}
                  </p>
                    ) : null}
                  </div>
                )}
                {addStudentForm.username.trim().length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">Username must be unique within your school</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={addStudentForm.password}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={addStudentForm.phone}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  value={addStudentForm.gender}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, gender: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Roll Number</label>
                <input
                  type="text"
                  value={addStudentForm.roll_number}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, roll_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select
                  value={addStudentForm.class_group_id}
                  onChange={async (e) => {
                    const classId = e.target.value;
                    setAddStudentForm({ ...addStudentForm, class_group_id: classId, section_id: '' });
                    if (classId) {
                      loadSections(classId);
                      // Load default fees for this class
                      await loadDefaultFees(classId);
                    } else {
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
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select Class (Optional)</option>
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
              {addStudentForm.class_group_id && sections[addStudentForm.class_group_id] && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <select
                    value={addStudentForm.section_id}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, section_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select Section (Optional)</option>
                    {sections[addStudentForm.class_group_id].map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={addStudentForm.date_of_birth}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Home Address</label>
                <textarea
                  value={addStudentForm.home_address}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, home_address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Enter home address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Admission Date</label>
                <input
                  type="date"
                  value={addStudentForm.admission_date}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, admission_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              
              {/* Fee Configuration Section - Only show if class is selected */}
              {addStudentForm.class_group_id && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-lg font-semibold mb-3 text-gray-700">Fee Configuration</h4>
                  
                  {loadingFees ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading fee information...</p>
                    </div>
                  ) : defaultFees ? (
                    <div className="space-y-4">
                      {/* Class Fee Section - Always show if class is selected (like transport fee) */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h5 className="font-semibold text-gray-700 mb-2">Class Fee (Default for this class)</h5>
                        {(() => {
                          // Get the selected class fee (auto-selected first one or manually selected)
                          const classFeesArray = defaultFees.class_fees && Array.isArray(defaultFees.class_fees) ? defaultFees.class_fees : [];
                          let selectedClassFee: any = null;
                          
                          if (classFeesArray.length > 0) {
                            // Try to find by feeConfig.class_fee_id, or use first one
                            if (feeConfig.class_fee_id) {
                              selectedClassFee = classFeesArray.find((cf: any) => cf.id === feeConfig.class_fee_id);
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
                          
                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">{categoryName}:</span>
                                <span className="font-medium">₹{defaultAmount.toFixed(2)}/{feeCycle}</span>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={defaultAmount}
                                  value={feeConfig.class_fee_discount}
                                  onChange={(e) => {
                                    const discount = parseFloat(e.target.value) || 0;
                                    setFeeConfig({ ...feeConfig, class_fee_discount: Math.min(discount, defaultAmount) });
                                  }}
                                  className="w-full px-2 py-1 border rounded text-sm"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                                <span>Final Amount:</span>
                                <span className="text-green-600">₹{finalAmount.toFixed(2)}/{feeCycle}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Transport Fee Section */}
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-semibold text-gray-700">Transport Fee</h5>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={feeConfig.transport_enabled}
                              onChange={(e) => setFeeConfig({ ...feeConfig, transport_enabled: e.target.checked, transport_route_id: e.target.checked ? feeConfig.transport_route_id : '' })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-600">Enable Transport</span>
                          </label>
                        </div>
                        {feeConfig.transport_enabled && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Select Route</label>
                              <select
                                value={feeConfig.transport_route_id}
                                onChange={(e) => setFeeConfig({ ...feeConfig, transport_route_id: e.target.value })}
                                className="w-full px-2 py-1 border rounded text-sm"
                              >
                                <option value="">Select Transport Route</option>
                                {defaultFees.transport_routes.map((route: any) => (
                                  <option key={route.id} value={route.id}>
                                    {route.route_name} {route.bus_number ? `(${route.bus_number})` : ''} - ₹{route.fee?.total?.toFixed(2) || '0.00'}/{route.fee?.fee_cycle || 'monthly'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {feeConfig.transport_route_id && (() => {
                              const selectedRoute = defaultFees.transport_routes.find((r: any) => r.id === feeConfig.transport_route_id);
                              const routeFee = selectedRoute?.fee;
                              const defaultTransportAmount = routeFee ? parseFloat(routeFee.total || 0) : 0;
                              const finalTransportAmount = Math.max(0, defaultTransportAmount - feeConfig.transport_fee_discount);
                              return (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Route Fee:</span>
                                    <span className="font-medium">₹{defaultTransportAmount.toFixed(2)}/{routeFee?.fee_cycle || 'monthly'}</span>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={feeConfig.transport_fee_discount}
                                      onChange={(e) => setFeeConfig({ ...feeConfig, transport_fee_discount: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 border rounded text-sm"
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                                    <span>Final Amount:</span>
                                    <span className="text-green-600">₹{finalTransportAmount.toFixed(2)}/{routeFee?.fee_cycle || 'monthly'}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Custom Fees Section - Always show if class is selected */}
                      {defaultFees.custom_fees && Array.isArray(defaultFees.custom_fees) && defaultFees.custom_fees.length > 0 && (
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                          <h5 className="font-semibold text-gray-700 mb-3">Custom Fees</h5>
                          <div className="space-y-3">
                            {defaultFees.custom_fees.map((customFee: any) => {
                              const feeConfigItem = feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id) || {
                                custom_fee_id: customFee.id,
                                discount: 0,
                                is_exempt: false
                              };
                              const feeAmount = parseFloat(customFee.amount || 0);
                              const finalAmount = feeConfigItem.is_exempt ? 0 : Math.max(0, feeAmount - feeConfigItem.discount);
                              const classLabel = customFee.class_groups?.name || 'All Classes';
                              const feeName = customFee.fee_categories?.name || customFee.name || 'Custom Fee';
                              
                              return (
                                <div key={customFee.id} className="bg-white p-3 rounded border">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-medium text-sm">{feeName}</span>
                                          <span className="text-xs text-gray-500 ml-2">({classLabel})</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-600">
                                          ₹{feeAmount.toFixed(2)}/{customFee.fee_cycle || 'monthly'}
                                        </span>
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer ml-3">
                                      <input
                                        type="checkbox"
                                        checked={feeConfigItem.is_exempt}
                                        onChange={(e) => {
                                          const updatedCustomFees = feeConfig.custom_fees.map(f =>
                                            f.custom_fee_id === customFee.id
                                              ? { ...f, is_exempt: e.target.checked, discount: e.target.checked ? 0 : f.discount }
                                              : f
                                          );
                                          if (!feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                            updatedCustomFees.push({
                                              custom_fee_id: customFee.id,
                                              discount: 0,
                                              is_exempt: e.target.checked
                                            });
                                          }
                                          setFeeConfig({ ...feeConfig, custom_fees: updatedCustomFees });
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-xs text-gray-600">Exempt</span>
                                    </label>
                                  </div>
                                  {!feeConfigItem.is_exempt && (
                                    <>
                                      <div>
                                        <label className="block text-xs text-gray-600 mb-1">Discount (₹)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          max={feeAmount}
                                          value={feeConfigItem.discount}
                                          onChange={(e) => {
                                            const discount = parseFloat(e.target.value) || 0;
                                            const updatedCustomFees = feeConfig.custom_fees.map(f =>
                                              f.custom_fee_id === customFee.id
                                                ? { ...f, discount: Math.min(discount, feeAmount) }
                                                : f
                                            );
                                            if (!feeConfig.custom_fees.find(f => f.custom_fee_id === customFee.id)) {
                                              updatedCustomFees.push({
                                                custom_fee_id: customFee.id,
                                                discount: Math.min(discount, feeAmount),
                                                is_exempt: false
                                              });
                                            }
                                            setFeeConfig({ ...feeConfig, custom_fees: updatedCustomFees });
                                          }}
                                          className="w-full px-2 py-1 border rounded text-sm"
                                          placeholder="0"
                                        />
                                      </div>
                                      <div className="flex justify-between text-xs font-semibold pt-1 border-t mt-1">
                                        <span>Final Amount:</span>
                                        <span className="text-green-600">₹{finalAmount.toFixed(2)}/{customFee.fee_cycle || 'monthly'}</span>
                                      </div>
                                    </>
                                  )}
                                  {feeConfigItem.is_exempt && (
                                    <div className="text-xs text-red-600 font-semibold pt-1">
                                      Student is exempt from this fee
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Select a class to configure fees</p>
                  )}
                </div>
              )}

              {/* Parent/Guardian Information Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-lg font-semibold mb-3 text-gray-700">Parent/Guardian Information</h4>
                <div>
                  <label className="block text-sm font-medium mb-1">Parent/Guardian Name *</label>
                  <input
                    type="text"
                    required
                    value={addStudentForm.guardian_name}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, guardian_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Full name of parent or guardian"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Parent/Guardian Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={addStudentForm.guardian_phone}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, guardian_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Phone number"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Parent/Guardian Email</label>
                  <input
                    type="email"
                    value={addStudentForm.guardian_email}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, guardian_email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Email address (optional)"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1">Relationship</label>
                  <select
                    value={addStudentForm.guardian_relationship}
                    onChange={(e) => setAddStudentForm({ ...addStudentForm, guardian_relationship: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="parent">Parent</option>
                    <option value="guardian">Guardian</option>
                    <option value="relative">Relative</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={usernameStatus.checking || usernameStatus.available === false}
                  className={`flex-1 px-4 py-2 rounded-lg ${
                    usernameStatus.checking || usernameStatus.available === false
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {usernameStatus.checking ? 'Checking...' : 'Add Student'}
                </button>
                <button
                  type="button"
                  onClick={() => {
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
  const [error, setError] = useState<string | null>(null);
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
    } catch (error: any) {
      console.error('Error loading types:', error);
      setError(error.message || 'Failed to load classification types. Please try again.');
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

  if (loading) return <div className="p-6">Loading classifications...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <span className="text-red-600 text-xl mr-2">⚠️</span>
            <div>
              <h3 className="text-red-800 font-semibold">Error Loading Classifications</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadTypes();
            }}
            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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


function ExamsManagement() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    term: '',
    schedule: [] as Array<{ subject_id: string; exam_date: string; time_from: string; time_to: string }>,
    class_group_ids: [] as string[]
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

  const loadSubjects = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/subjects`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubjects(data.subjects || []);
      }
    } catch (error) {
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
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
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

      const payload: any = {
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
    } catch (error: any) {
      alert(error.message || 'Failed to create exam');
    }
  };

  const addScheduleEntry = () => {
    setFormData({
      ...formData,
      schedule: [...formData.schedule, { subject_id: '', exam_date: '', time_from: '', time_to: '' }]
    });
  };

  const removeScheduleEntry = (index: number) => {
    setFormData({
      ...formData,
      schedule: formData.schedule.filter((_, i) => i !== index)
    });
  };

  const updateScheduleEntry = (index: number, field: string, value: string) => {
    const newSchedule = [...formData.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setFormData({ ...formData, schedule: newSchedule });
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
              schedule: [],
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
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create New Exam - Date Sheet</h3>
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

              {/* Schedule Section */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Exam Schedule *</label>
                  <button
                    type="button"
                    onClick={addScheduleEntry}
                    className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    + Add Subject
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.schedule.map((entry, index) => (
                    <div key={index} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-gray-700">Subject {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeScheduleEntry(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
                          <select
                            value={entry.subject_id}
                            onChange={(e) => updateScheduleEntry(index, 'subject_id', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            required
                          >
                            <option value="">Select Subject</option>
                            {subjects.map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name} {subject.code ? `(${subject.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                          <input
                            type="date"
                            value={entry.exam_date}
                            onChange={(e) => updateScheduleEntry(index, 'exam_date', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Time From *</label>
                          <input
                            type="time"
                            value={entry.time_from}
                            onChange={(e) => updateScheduleEntry(index, 'time_from', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Time To *</label>
                          <input
                            type="time"
                            value={entry.time_to}
                            onChange={(e) => updateScheduleEntry(index, 'time_to', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.schedule.length === 0 && (
                    <div className="text-center py-8 text-gray-500 border border-gray-300 rounded-lg">
                      No subjects added. Click "Add Subject" to create the date sheet.
                    </div>
                  )}
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
                      schedule: [],
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
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classes
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {exams.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No exams created yet. Click "Create Exam" to get started.
                </td>
              </tr>
            ) : (
              exams.map((exam) => {
                const schedule = exam.exam_schedule || [];
                const sortedSchedule = [...schedule].sort((a: any, b: any) => {
                  const dateA = new Date(a.exam_date).getTime();
                  const dateB = new Date(b.exam_date).getTime();
                  if (dateA !== dateB) return dateA - dateB;
                  return a.time_from.localeCompare(b.time_from);
                });

                return (
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
                      {sortedSchedule.length > 0 ? (
                        <div className="text-sm space-y-1 max-w-md">
                          {sortedSchedule.map((entry: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-gray-900">
                                {entry.subject?.name || 'Unknown Subject'}
                              </span>
                              <span className="text-gray-500">
                                {new Date(entry.exam_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                              <span className="text-gray-500">
                                {entry.time_from} - {entry.time_to}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No schedule</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getExamClassesDisplay(exam)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalaryManagement() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<any[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'structure' | 'records' | 'reports' | 'unpaid'>('structure');
  const [unpaidTeachers, setUnpaidTeachers] = useState<any[]>([]);
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());
  
  // Structure form
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState<any>(null); // Track if editing existing structure
  const [structureForm, setStructureForm] = useState({
    teacher_id: '',
    base_salary: '',
    hra: '',
    other_allowances: '',
    fixed_deductions: '',
    salary_cycle: 'monthly' as 'monthly' | 'weekly' | 'biweekly',
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
  }, [activeTab]);

  const loadData = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const [teachersRes, structuresRes] = await Promise.all([
        fetch(`${API_URL}/staff-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/salary/structures`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (teachersRes.ok) {
        const data = await teachersRes.json();
        setTeachers(data.staff?.filter((s: any) => s.role === 'teacher') || []);
      }

      if (structuresRes.ok) {
        const data = await structuresRes.json();
        setSalaryStructures(data.structures || []);
      }
    } catch (error) {
      console.error('Error loading salary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnpaidSalaries = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/salary/unpaid?time_scope=last_12_months`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUnpaidTeachers(data.teachers || []);
      } else {
        console.error('Error loading unpaid salaries:', await response.json().catch(() => ({})));
        setUnpaidTeachers([]);
      }
    } catch (error) {
      console.error('Error loading unpaid salaries:', error);
      setUnpaidTeachers([]);
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

  const handleSaveStructure = async (e: React.FormEvent) => {
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
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to save structure');
    }
  };


  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Salary Management</h2>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b">
        {[
          { id: 'structure', label: 'Salary Structure' },
          { id: 'unpaid', label: 'Unpaid Salaries' },
          { id: 'records', label: 'All Records' },
          { id: 'reports', label: 'Reports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Salary Structure Tab */}
      {activeTab === 'structure' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Teacher Salary Structures</h3>
            <button
              onClick={() => {
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
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              + Set Salary Structure
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance Deduction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryStructures.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No salary structures set. Click "Set Salary Structure" to get started.
                    </td>
                  </tr>
                ) : (
                  salaryStructures.map((structure) => (
                    <tr key={structure.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {structure.teacher?.full_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4">₹{structure.base_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.hra.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.other_allowances.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{structure.fixed_deductions.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {structure.attendance_based_deduction ? '✅ Enabled' : '❌ Disabled'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
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
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* All Records Tab */}
      {activeTab === 'records' && (
        <div>
          <h3 className="text-xl font-bold mb-4">All Salary Records</h3>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month/Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No salary records found
                    </td>
                  </tr>
                ) : (
                  salaryRecords.map((record: any) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4">{record.teacher?.full_name || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        {new Date(2000, record.month - 1).toLocaleString('default', { month: 'long' })} {record.year}
                      </td>
                      <td className="px-6 py-4">₹{record.gross_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">₹{record.total_deductions.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold">₹{record.net_salary.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'approved' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.payment_date ? new Date(record.payment_date).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unpaid Salaries Tab */}
      {activeTab === 'unpaid' && (
        <div>
          <h3 className="text-xl font-bold mb-4">Unpaid Teacher Salaries (Month-wise)</h3>
          <p className="text-gray-600 mb-6">
            View all unpaid salary months for teachers, including months where salary records were not generated.
          </p>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unpaid Months</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Unpaid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oldest Unpaid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unpaidTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No teachers with unpaid salaries. All teachers are up to date with their payments.
                    </td>
                  </tr>
                ) : (
                  unpaidTeachers.map((teacher: any) => {
                    const isExpanded = expandedTeachers.has(teacher.teacher_id);
                    
                    return (
                      <>
                        <tr key={teacher.teacher_id} className="hover:bg-gray-50">
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
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {teacher.oldest_unpaid_month ? (
                              <div>
                                <div>{teacher.oldest_unpaid_month.period_label}</div>
                                <div className="text-xs text-red-600">
                                  {teacher.oldest_unpaid_month.days_since_period_start} days overdue
                                </div>
                              </div>
                            ) : '-'}
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
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          <h3 className="text-xl font-bold mb-4">Salary Reports & Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-lg font-semibold mb-4">Monthly Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-semibold text-green-600">₹{(salaryRecords.filter((r: any) => r.status === 'paid').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Pending:</span>
                  <span className="font-semibold text-yellow-600">₹{(salaryRecords.filter((r: any) => r.status === 'pending').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Approved:</span>
                  <span className="font-semibold text-blue-600">₹{(salaryRecords.filter((r: any) => r.status === 'approved').reduce((sum: number, r: any) => sum + parseFloat(r.net_salary || 0), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Attendance Deduction:</span>
                  <span className="font-semibold text-red-600">₹{(salaryRecords.reduce((sum: number, r: any) => sum + parseFloat(r.attendance_deduction || 0), 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-lg font-semibold mb-4">Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Records:</span>
                  <span className="font-semibold">{salaryRecords.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'paid').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Approved Records:</span>
                  <span className="font-semibold">{salaryRecords.filter((r: any) => r.status === 'approved').length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              {selectedTeacherForEdit ? 'Edit Salary Structure' : 'Set Salary Structure'}
            </h3>
            <form onSubmit={handleSaveStructure} className="space-y-4">
              {/* Effective From Date - Always required for both new and edit */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  required
                  value={structureForm.effective_from_date || ''}
                  onChange={(e) => setStructureForm({ ...structureForm, effective_from_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  min={selectedTeacherForEdit ? undefined : new Date().toISOString().split('T')[0]} // Prevent past dates only for new structures
                />
                <p className="text-xs text-gray-600 mt-1">
                  {selectedTeacherForEdit 
                    ? 'The new salary structure will be effective from this date. Previous salary structure remains unchanged for all months before this date.'
                    : 'The salary structure will be effective from this date. Choose the date from which salary should start.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Teacher *</label>
                <select
                  value={structureForm.teacher_id}
                  onChange={(e) => setStructureForm({ ...structureForm, teacher_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Base Salary (₹) *</label>
                <input
                  type="number"
                  value={structureForm.base_salary}
                  onChange={(e) => setStructureForm({ ...structureForm, base_salary: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">HRA (₹)</label>
                <input
                  type="number"
                  value={structureForm.hra}
                  onChange={(e) => setStructureForm({ ...structureForm, hra: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Other Allowances (₹)</label>
                <input
                  type="number"
                  value={structureForm.other_allowances}
                  onChange={(e) => setStructureForm({ ...structureForm, other_allowances: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fixed Deductions (₹)</label>
                <input
                  type="number"
                  value={structureForm.fixed_deductions}
                  onChange={(e) => setStructureForm({ ...structureForm, fixed_deductions: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Salary Cycle</label>
                <select
                  value={structureForm.salary_cycle}
                  onChange={(e) => setStructureForm({ ...structureForm, salary_cycle: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={structureForm.attendance_based_deduction}
                    onChange={(e) => setStructureForm({ ...structureForm, attendance_based_deduction: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Enable Attendance-Based Deduction</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save Structure
                </button>
                <button
                  type="button"
                  onClick={() => {
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

function FeeManagement({ userRole = 'principal' }: { userRole?: 'principal' | 'clerk' }) {
  const [activeTab, setActiveTab] = useState<'class-fees' | 'custom-fees' | 'transport' | 'tracking' | 'hikes'>('class-fees');
  const [loading, setLoading] = useState(false);
  const isClerk = userRole === 'clerk';

  // Fee Categories removed - no longer used

  // Class Fees
  const [classGroups, setClassGroups] = useState<any[]>([]);
  const [classFees, setClassFees] = useState<any[]>([]);
  const [showClassFeeModal, setShowClassFeeModal] = useState(false);
  const [classFeeForm, setClassFeeForm] = useState({
    class_group_id: '',
    name: '',
    amount: '',
    fee_cycle: 'monthly' as 'one-time' | 'monthly' | 'quarterly' | 'yearly',
    due_day: 5,
    notes: ''
  });

  // Custom Fees
  const [customFees, setCustomFees] = useState<any[]>([]);
  const [showCustomFeeModal, setShowCustomFeeModal] = useState(false);
  const [customFeeForm, setCustomFeeForm] = useState({
    class_group_id: '', // Empty string = all classes, or specific class ID
    name: '',
    amount: '',
    fee_cycle: 'monthly' as 'one-time' | 'monthly' | 'quarterly' | 'yearly'
  });

  // Transport
  const [transportRoutes, setTransportRoutes] = useState<any[]>([]);
  const [transportFees, setTransportFees] = useState<any[]>([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({ route_name: '', bus_number: '', distance_km: '', zone: '', description: '' });
  const [showTransportFeeModal, setShowTransportFeeModal] = useState(false);
  const [transportFeeForm, setTransportFeeForm] = useState({
    route_id: '',
    base_fee: '',
    escort_fee: '0',
    fuel_surcharge: '0',
    fee_cycle: 'monthly' as 'monthly' | 'per-trip' | 'yearly',
    due_day: 5,
    notes: ''
  });

  // Optional Fees - REMOVED
  // Custom Fees - REMOVED
  // Bills - REMOVED
  
  // Students still needed for other features
  const [students, setStudents] = useState<any[]>([]);

  // Fee Tracking
  const [feeTracking, setFeeTracking] = useState<any[]>([]);
  const [selectedTrackingStudent, setSelectedTrackingStudent] = useState<any>(null);
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [generateBillForm, setGenerateBillForm] = useState({
    student_id: '',
    class_group_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Payments - REMOVED

  // Fee Hikes
  const [selectedFeeForHike, setSelectedFeeForHike] = useState<any>(null);
  const [showHikeModal, setShowHikeModal] = useState(false);
  const [hikeForm, setHikeForm] = useState({
    new_amount: '',
    effective_from_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [feeVersions, setFeeVersions] = useState<any[]>([]);


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
    else if (activeTab === 'transport') loadTransportData();
    else if (activeTab === 'tracking') loadFeeTracking();
    else if (activeTab === 'hikes') {
      // Load all fee types for hikes tab
      loadClassFees();
      loadTransportData();
      loadCustomFees();
    }
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  // loadFeeCategories removed - no longer needed

  const loadClassFees = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/fees/class-fees`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setClassFees(data.class_fees || []);
      }
    } catch (error) {
      console.error('Error loading class fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomFees = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/fees/custom-fees`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomFees(data.custom_fees || []);
      }
    } catch (error) {
      console.error('Error loading custom fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransportData = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error) {
      console.error('Error loading transport data:', error);
    } finally {
      setLoading(false);
    }
  };

  // loadOptionalFees, loadBills, loadPayments - REMOVED

  const handleSaveClassFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to save class fee');
    }
  };

  const handleSaveCustomFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to save custom fee');
    }
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to save route');
    }
  };

  const handleSaveTransportFee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
      alert(error.message || 'Failed to save transport fee');
    }
  };

  // handleSaveOptionalFee, handleSaveCustomFee, handleGenerateBills, handleSavePayment, viewBill - REMOVED

  const loadFeeTracking = async () => {
    // Fee tracking simplified - bills and payments removed
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get all students with their class and transport fees
      const [studentsRes] = await Promise.all([
        fetch(`${API_URL}/students`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        
        // Create simplified fee tracking data
        const feeTrackingData = (studentsData.students || []).map((student: any) => ({
          student: student,
          total_assigned: 0,
          total_paid: 0,
          pending_amount: 0,
          transport_amount: 0
        }));

        setFeeTracking(feeTrackingData);
      }
    } catch (error) {
      console.error('Error loading fee tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHikeFee = async (fee: any, feeType: 'class' | 'transport' | 'custom') => {
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
      if (!token) return;

      let url = '';
      if (feeType === 'class') {
        url = `${API_URL}/fees/class-fees/${fee.id}/versions`;
      } else if (feeType === 'transport') {
        url = `${API_URL}/fees/transport/fees/${fee.id}/versions`;
      } else if (feeType === 'custom') {
        url = `${API_URL}/fees/custom-fees/${fee.id}/versions`;
      }

      if (url) {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          setFeeVersions(data.versions || []);
        }
      }
    } catch (error) {
      console.error('Error loading fee versions:', error);
    }
  };

  const handleSubmitHike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeForHike) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      let url = '';
      if (selectedFeeForHike.feeType === 'class') {
        url = `${API_URL}/fees/class-fees/${selectedFeeForHike.id}/hike`;
      } else if (selectedFeeForHike.feeType === 'transport') {
        url = `${API_URL}/fees/transport/fees/${selectedFeeForHike.id}/hike`;
      }
      // Optional fees removed

      if (!url) return;

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
      if (activeTab === 'class-fees') loadClassFees();
      else if (activeTab === 'transport') loadTransportData();
      else if (activeTab === 'custom-fees') loadCustomFees();
      else if (activeTab === 'hikes') {
        // Reload all fee types for hikes tab
        loadClassFees();
        loadTransportData();
        loadCustomFees();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to hike fee');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-2xl font-bold text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Fee Management</h2>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              ...(isClerk ? [] : [
                { id: 'class-fees', label: 'Class Fees' },
                { id: 'custom-fees', label: 'Custom Fees' },
                { id: 'transport', label: 'Transport' },
                { id: 'hikes', label: 'Fee Hikes' },
              ]),
              { id: 'tracking', label: 'Fee Tracking' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Custom Fees Tab - Only for Principal */}
      {activeTab === 'custom-fees' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Custom Fees</h3>
            {!isClerk && (
              <button
                onClick={() => setShowCustomFeeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Custom Fee
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective From</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No custom fees found. Click "Add Custom Fee" to create one.
                    </td>
                  </tr>
                ) : (
                  customFees.map((fee) => (
                    <tr key={fee.id}>
                      <td className="px-6 py-4 font-medium">{fee.class_groups?.name || 'All Classes'}</td>
                      <td className="px-6 py-4">{fee.fee_categories?.name || fee.name || '-'}</td>
                      <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4">{fee.fee_cycle || '-'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{fee.effective_from ? new Date(fee.effective_from).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this custom fee?')) return;
                            try {
                              const token = (await supabase.auth.getSession()).data.session?.access_token;
                              if (!token) return;
                              const response = await fetch(`${API_URL}/fees/custom-fees/${fee.id}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (response.ok) {
                                alert('Custom fee deleted successfully!');
                                loadCustomFees();
                              } else {
                                const error = await response.json();
                                throw new Error(error.error || 'Failed to delete custom fee');
                              }
                            } catch (error: any) {
                              alert(error.message || 'Failed to delete custom fee');
                            }
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class Fees Tab - Only for Principal */}
      {activeTab === 'class-fees' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Class Fees</h3>
            {!isClerk && (
              <button
                onClick={() => setShowClassFeeModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Add Class Fee
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Day</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classFees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No class fees found. Click "Add Class Fee" to get started.
                    </td>
                  </tr>
                ) : (
                  classFees.map((fee) => (
                    <tr key={fee.id}>
                      <td className="px-6 py-4">{fee.class_groups?.name || '-'}</td>
                      <td className="px-6 py-4">{fee.name || fee.fee_categories?.name || 'Class Fee'}</td>
                      <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">{fee.fee_cycle}</td>
                      <td className="px-6 py-4">{fee.due_day || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button className="text-blue-600 hover:text-blue-800">Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transport Tab - Only for Principal */}
      {activeTab === 'transport' && !isClerk && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Transport Routes</h3>
              {!isClerk && (
                <button
                  onClick={() => setShowRouteModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Add Route
                </button>
              )}
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bus Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No transport routes found.
                      </td>
                    </tr>
                  ) : (
                    transportRoutes.map((route) => (
                      <tr key={route.id}>
                        <td className="px-6 py-4 font-medium">{route.route_name}</td>
                        <td className="px-6 py-4">{route.bus_number || '-'}</td>
                        <td className="px-6 py-4">{route.zone || '-'}</td>
                        <td className="px-6 py-4">{route.distance_km ? `${route.distance_km} km` : '-'}</td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800">Edit</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Transport Fees</h3>
              {!isClerk && (
                <button
                  onClick={() => setShowTransportFeeModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Add Transport Fee
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escort Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuel Surcharge</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportFees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No transport fees found.
                      </td>
                    </tr>
                  ) : (
                    transportFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.transport_routes?.route_name || '-'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.base_fee || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.escort_fee || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.fuel_surcharge || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle}</td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-800">Edit</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Optional Fees, Custom Fees, Bills - REMOVED */}

      {/* Fee Tracking Tab */}
      {activeTab === 'tracking' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Fee Collection Tracking</h3>
            <div className="flex gap-4">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Classes</option>
                {classGroups.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.name}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partially Paid</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Assigned</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Paid</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transport Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {feeTracking
                  .filter((track: any) => {
                    if (filterClass && track.student?.class_group_id !== filterClass) return false;
                    if (filterStatus === 'paid' && track.pending_amount > 0) return false;
                    if (filterStatus === 'pending' && track.pending_amount === 0) return false;
                    if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0)) return false;
                    return true;
                  })
                  .length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      No fee tracking data found.
                    </td>
                  </tr>
                ) : (
                  feeTracking
                    .filter((track: any) => {
                      if (filterClass && track.student?.class_group_id !== filterClass) return false;
                      if (filterStatus === 'paid' && track.pending_amount > 0) return false;
                      if (filterStatus === 'pending' && track.pending_amount === 0) return false;
                      if (filterStatus === 'partial' && (track.pending_amount === 0 || track.total_paid === 0)) return false;
                      return true;
                    })
                    .map((track: any) => (
                      <tr key={track.student?.id}>
                        <td className="px-6 py-4 font-medium">{track.student?.profile?.full_name || '-'}</td>
                        <td className="px-6 py-4">{track.student?.roll_number || '-'}</td>
                        <td className="px-6 py-4">{track.student?.class_groups?.name || '-'}</td>
                        <td className="px-6 py-4 text-right font-semibold">₹{parseFloat(track.total_assigned || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-green-600">₹{parseFloat(track.total_paid || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-red-600">₹{parseFloat(track.pending_amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">₹{parseFloat(track.transport_amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            track.pending_amount === 0 ? 'bg-green-100 text-green-800' :
                            track.total_paid > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {track.pending_amount === 0 ? 'Paid' : track.total_paid > 0 ? 'Partial' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedTrackingStudent(track);
                            }}
                            className="text-blue-600 hover:text-blue-800 mr-2"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Fee Details Modal (from Tracking) */}
      {selectedTrackingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Fee Details - {selectedTrackingStudent.student?.profile?.full_name}</h3>
              <button
                onClick={() => setSelectedTrackingStudent(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-bold mb-3">Fee Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Assigned</p>
                    <p className="text-xl font-semibold">₹{parseFloat(selectedTrackingStudent.total_assigned || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Paid</p>
                    <p className="text-xl font-semibold text-green-600">₹{parseFloat(selectedTrackingStudent.total_paid || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-xl font-semibold text-red-600">₹{parseFloat(selectedTrackingStudent.pending_amount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Transport Fee</p>
                    <p className="text-xl font-semibold">₹{parseFloat(selectedTrackingStudent.transport_amount || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Payments Tab - REMOVED */}

      {/* Modals will be added here - I'll create a simplified version with key modals */}
      {/* Class Fee Modal */}
      {showClassFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Class Fee</h3>
            <form onSubmit={handleSaveClassFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Class *</label>
                  <select
                    value={classFeeForm.class_group_id}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, class_group_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Select Class</option>
                    {classGroups.map((classGroup) => (
                      <option key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Name *</label>
                  <input
                    type="text"
                    value={classFeeForm.name}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Tuition Fee, Development Fee"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={classFeeForm.amount}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={classFeeForm.fee_cycle}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {classFeeForm.fee_cycle !== 'one-time' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Due Day (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={classFeeForm.due_day}
                      onChange={(e) => setClassFeeForm({ ...classFeeForm, due_day: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={classFeeForm.notes}
                    onChange={(e) => setClassFeeForm({ ...classFeeForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowClassFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Fee Modal */}
      {showCustomFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Custom Fee</h3>
            <form onSubmit={handleSaveCustomFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Class</label>
                  <select
                    value={customFeeForm.class_group_id}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, class_group_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  >
                    <option value="">All Classes</option>
                    {classGroups.map((classGroup) => (
                      <option key={classGroup.id} value={classGroup.id}>
                        {classGroup.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select "All Classes" to apply this fee to all classes, or select a specific class</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Fee Name *</label>
                  <input
                    type="text"
                    value={customFeeForm.name}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Library Fee, Lab Fee, Sports Fee"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customFeeForm.amount}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={customFeeForm.fee_cycle}
                    onChange={(e) => setCustomFeeForm({ ...customFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="one-time">One-time</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transport Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Add Transport Route</h3>
            <form onSubmit={handleSaveRoute}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Route Name *</label>
                  <input
                    type="text"
                    value={routeForm.route_name}
                    onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., Route A, North Zone"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bus Number</label>
                  <input
                    type="text"
                    value={routeForm.bus_number}
                    onChange={(e) => setRouteForm({ ...routeForm, bus_number: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., BUS-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Zone</label>
                  <input
                    type="text"
                    value={routeForm.zone}
                    onChange={(e) => setRouteForm({ ...routeForm, zone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="e.g., North, South, East, West"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Distance (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={routeForm.distance_km}
                    onChange={(e) => setRouteForm({ ...routeForm, distance_km: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={routeForm.description}
                    onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transport Fee Modal */}
      {showTransportFeeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Add Transport Fee</h3>
            <form onSubmit={handleSaveTransportFee}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Route *</label>
                  <select
                    value={transportFeeForm.route_id}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, route_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="">Select Route</option>
                    {transportRoutes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.route_name} {route.bus_number ? `(${route.bus_number})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Base Fee (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transportFeeForm.base_fee}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, base_fee: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Escort Fee (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transportFeeForm.escort_fee}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, escort_fee: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Fuel Surcharge (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transportFeeForm.fuel_surcharge}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, fuel_surcharge: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fee Cycle *</label>
                  <select
                    value={transportFeeForm.fee_cycle}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, fee_cycle: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    required
                  >
                    <option value="monthly">Monthly</option>
                    <option value="per-trip">Per Trip</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {transportFeeForm.fee_cycle !== 'per-trip' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Due Day (1-31)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={transportFeeForm.due_day}
                      onChange={(e) => setTransportFeeForm({ ...transportFeeForm, due_day: parseInt(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Notes</label>
                  <textarea
                    value={transportFeeForm.notes}
                    onChange={(e) => setTransportFeeForm({ ...transportFeeForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransportFeeModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optional Fee Modal - REMOVED */}

      {/* Custom Fee Modal - REMOVED */}

      {/* Generate Bill Modal - REMOVED */}

      {/* Payment Modal - REMOVED */}
      {/* Bill Detail Modal - REMOVED */}

      {/* Fee Hikes Tab - Only for Principal */}
      {activeTab === 'hikes' && !isClerk && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Fee Hikes & Version History</h3>
          <p className="text-gray-600 mb-6">
            Increase or decrease fees for future billing periods. Past bills remain unchanged.
          </p>

          {/* Class Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Class Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No class fees found.
                      </td>
                    </tr>
                  ) : (
                    classFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.class_groups?.name || '-'}</td>
                        <td className="px-6 py-4">{fee.name || fee.fee_categories?.name || 'Class Fee'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleHikeFee(fee, 'class')}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Hike Fee
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Transport Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Transport Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transportFees.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No transport fees found.
                      </td>
                    </tr>
                  ) : (
                    transportFees.map((fee) => {
                      const totalAmount = parseFloat(fee.base_fee || 0) + 
                                         parseFloat(fee.escort_fee || 0) + 
                                         parseFloat(fee.fuel_surcharge || 0);
                      return (
                        <tr key={fee.id}>
                          <td className="px-6 py-4">{fee.transport_routes?.route_name || '-'}</td>
                          <td className="px-6 py-4">₹{totalAmount.toLocaleString()}</td>
                          <td className="px-6 py-4">{fee.fee_cycle}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleHikeFee({ ...fee, amount: totalAmount }, 'transport')}
                              className="text-blue-600 hover:text-blue-800 mr-4"
                            >
                              Hike Fee
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Fees Section */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold mb-4">Custom Fees</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cycle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customFees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No custom fees found.
                      </td>
                    </tr>
                  ) : (
                    customFees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-6 py-4">{fee.class_groups?.name || 'All Classes'}</td>
                        <td className="px-6 py-4">{fee.fee_categories?.name || fee.name || '-'}</td>
                        <td className="px-6 py-4">₹{parseFloat(fee.amount || 0).toLocaleString()}</td>
                        <td className="px-6 py-4">{fee.fee_cycle || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleHikeFee(fee, 'custom')}
                            className="text-blue-600 hover:text-blue-800 mr-4"
                          >
                            Hike Fee
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Fee Hike Modal */}
      {showHikeModal && selectedFeeForHike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Hike Fee</h3>
            <form onSubmit={handleSubmitHike}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Amount
                </label>
                <input
                  type="text"
                  value={selectedFeeForHike.amount || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={hikeForm.new_amount}
                  onChange={(e) => setHikeForm({ ...hikeForm, new_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective From Date *
                </label>
                <input
                  type="date"
                  required
                  value={hikeForm.effective_from_date}
                  onChange={(e) => setHikeForm({ ...hikeForm, effective_from_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bills generated after this date will use the new amount. Past bills remain unchanged.
                </p>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={hikeForm.notes}
                  onChange={(e) => setHikeForm({ ...hikeForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>

              {/* Version History */}
              {feeVersions.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version History
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {feeVersions.map((version: any, idx: number) => (
                      <div key={version.id} className="text-xs mb-2 pb-2 border-b last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium">Version {version.version_number}</span>
                          <span>₹{parseFloat(version.amount || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-gray-500">
                          {new Date(version.effective_from_date).toLocaleDateString()} -{' '}
                          {version.effective_to_date 
                            ? new Date(version.effective_to_date).toLocaleDateString()
                            : 'Active'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowHikeModal(false);
                    setSelectedFeeForHike(null);
                    setFeeVersions([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Fee Hike
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
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
              } else {
                throw new Error('Failed to fetch profile');
              }
            } else {
              data = await response.json();
            }
          } catch (parseError) {
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
            } else {
              navigate('/login');
              return;
            }
          }
          
          const role = data?.profile?.role;
          
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
          } catch (fallbackError) {
            console.error('[PrincipalDashboard] Fallback check failed:', fallbackError);
          }
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
    else if (path === '/principal/salary') setCurrentView('salary');
    else if (path === '/principal/fees') setCurrentView('fees');
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
        {currentView === 'salary' && <SalaryManagement />}
        {currentView === 'fees' && <FeeManagement userRole="principal" />}
      </div>
    </div>
  );
}

