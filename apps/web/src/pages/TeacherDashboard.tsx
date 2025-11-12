import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Assignment {
  id: string;
  class_group_id: string;
  subject_id: string;
  section_id: string | null;
  class_groups: {
    id: string;
    name: string;
    description: string | null;
  };
  subjects: {
    id: string;
    name: string;
    code: string | null;
  };
  sections: {
    id: string;
    name: string;
  } | null;
}

interface Student {
  id: string;
  roll_number: string | null;
  profile: {
    id: string;
    full_name: string;
    email: string;
  };
  section_name: string | null;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(true);
  const [currentView, setCurrentView] = useState<'classes' | 'attendance' | 'marks'>('classes');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Attendance states
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({});

  // Marks states
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [marksData, setMarksData] = useState<Record<string, { marks_obtained: string; max_marks: string }>>({});

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
            const redirectMap: Record<string, string> = {
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
        } else {
          console.error('[TeacherDashboard] Failed to verify role');
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('[TeacherDashboard] Error verifying role:', error);
        navigate('/login');
      } finally {
        setCheckingRole(false);
      }
    };

    verifyRole();
  }, [navigate]);

  const loadAssignments = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;

      if (!userId) return;

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
    } catch (error) {
      console.error('Error loading assignments:', error);
      setLoading(false);
    }
  };

  const loadStudents = async (assignment: Assignment) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
      const allStudents: Student[] = [];
      if (data.classes) {
        data.classes.forEach((cls: any) => {
          if (cls.id === assignment.class_group_id) {
            cls.students.forEach((student: any) => {
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
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadAttendanceForDate = async (assignment: Assignment, date: string, studentList: Student[]) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const response = await fetch(`${API_URL}/attendance?class_group_id=${assignment.class_group_id}&date=${date}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const records: Record<string, 'present' | 'absent' | 'late'> = {};
        studentList.forEach((student) => {
          const record = data.attendance?.find((a: any) => a.student_id === student.id);
          records[student.id] = record?.status || 'present';
        });
        setAttendanceRecords(records);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadExams = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    }
  };

  const loadClassesForMarks = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      // Get classes from teacher assignments
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (!userId) return;

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
      assignments.forEach((assignment: Assignment) => {
        if (!uniqueClasses.has(assignment.class_group_id)) {
          uniqueClasses.set(assignment.class_group_id, {
            id: assignment.class_group_id,
            name: assignment.class_groups.name
          });
        }
      });
      
      setClasses(Array.from(uniqueClasses.values()));
    } catch (error) {
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
      if (!token) return;

      // Get subjects from teacher assignments for the selected class
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (!userId) return;

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
        .filter((assignment: Assignment) => assignment.class_group_id === selectedClass)
        .forEach((assignment: Assignment) => {
          if (!uniqueSubjects.has(assignment.subject_id)) {
            uniqueSubjects.set(assignment.subject_id, {
              id: assignment.subject_id,
              name: assignment.subjects.name,
              code: assignment.subjects.code
            });
          }
        });
      
      setSubjects(Array.from(uniqueSubjects.values()));
    } catch (error) {
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
      if (!token) return;

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
      const allStudents: Student[] = [];
      if (data.classes) {
        data.classes.forEach((cls: any) => {
          if (cls.id === selectedClass) {
            cls.students.forEach((student: any) => {
              allStudents.push(student);
            });
          }
        });
      }
      setStudents(allStudents);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedAssignment) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

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
    } catch (error: any) {
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
      if (!token) return;

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
    } catch (error: any) {
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
    } else {
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

  if (checkingRole || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white min-h-screen fixed left-0 top-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-8">SchoolSaaS</h1>
          <div className="mb-6">
            <div className="text-sm text-gray-400">Logged in as</div>
            <div className="font-semibold">{profile?.full_name || 'Teacher'}</div>
            <div className="text-sm text-gray-400">{profile?.email}</div>
          </div>
          <nav className="space-y-2">
            <button
              onClick={() => setCurrentView('classes')}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                currentView === 'classes' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              📚 My Classes
            </button>
            <button
              onClick={() => setCurrentView('attendance')}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                currentView === 'attendance' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              📅 Attendance
            </button>
            <button
              onClick={() => setCurrentView('marks')}
              className={`w-full text-left px-4 py-2 rounded-lg transition ${
                currentView === 'marks' ? 'bg-blue-600' : 'hover:bg-gray-800'
              }`}
            >
              📊 Marks Entry
            </button>
          </nav>
          <button
            onClick={handleLogout}
            className="mt-8 w-full text-left px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        <div className="p-6">
          {currentView === 'classes' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">My Classes & Subjects</h2>
              {assignments.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <div className="text-gray-500 text-lg mb-2">No classes assigned yet</div>
                  <div className="text-gray-400 text-sm">
                    Contact your principal to assign you to classes and subjects.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
                      onClick={() => loadStudents(assignment)}
                    >
                      <h3 className="text-xl font-bold mb-2">{assignment.class_groups.name}</h3>
                      {assignment.sections && (
                        <p className="text-sm text-gray-600 mb-2">Section: {assignment.sections.name}</p>
                      )}
                      <p className="text-lg font-semibold text-blue-600">
                        {assignment.subjects.name} {assignment.subjects.code && `(${assignment.subjects.code})`}
                      </p>
                      {assignment.class_groups.description && (
                        <p className="text-sm text-gray-500 mt-2">{assignment.class_groups.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === 'attendance' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Mark Attendance</h2>
              
              {!selectedAssignment && (
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <p className="text-gray-600 mb-4">Select a class to mark attendance:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignments.map((assignment) => (
                      <button
                        key={assignment.id}
                        onClick={() => loadStudents(assignment)}
                        className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-left transition"
                      >
                        <div className="font-semibold">{assignment.class_groups.name}</div>
                        {assignment.sections && (
                          <div className="text-sm text-gray-600">Section: {assignment.sections.name}</div>
                        )}
                        <div className="text-blue-600">{assignment.subjects.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedAssignment && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-xl font-bold">
                        {selectedAssignment.class_groups.name}
                        {selectedAssignment.sections && ` - ${selectedAssignment.sections.name}`}
                      </h3>
                      <p className="text-gray-600">{selectedAssignment.subjects.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date</label>
                      <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="px-3 py-2 border rounded-md"
                      />
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No students found in this class.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No.</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {students.map((student) => (
                              <tr key={student.id}>
                                <td className="px-4 py-3 text-sm">{student.roll_number || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm font-medium">{student.profile.full_name}</td>
                                <td className="px-4 py-3">
                                  <select
                                    value={attendanceRecords[student.id] || 'present'}
                                    onChange={(e) => {
                                      setAttendanceRecords({
                                        ...attendanceRecords,
                                        [student.id]: e.target.value as 'present' | 'absent' | 'late'
                                      });
                                    }}
                                    className="px-3 py-1 border rounded-md text-sm"
                                  >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                    <option value="late">Late</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={handleSaveAttendance}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                        >
                          Save Attendance
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAssignment(null);
                            setStudents([]);
                          }}
                          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                        >
                          Back to Classes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {currentView === 'marks' && (
            <div>
              <h2 className="text-3xl font-bold mb-6">Enter Marks</h2>
              
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam *</label>
                    <select
                      value={selectedExam}
                      onChange={(e) => {
                        setSelectedExam(e.target.value);
                        setSelectedClass('');
                        setSelectedSubject('');
                        setStudents([]);
                        setMarksData({});
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select Exam</option>
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name} {exam.term && `(${exam.term})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Class *</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => {
                        setSelectedClass(e.target.value);
                        setSelectedSubject('');
                        setStudents([]);
                        setMarksData({});
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled={!selectedExam}
                    >
                      <option value="">Select Class</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Subject *</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setMarksData({});
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      disabled={!selectedClass}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name} {subject.code && `(${subject.code})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {selectedExam && selectedClass && selectedSubject && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold mb-2">Enter Marks for Students</h3>
                    <p className="text-gray-600">
                      {exams.find(e => e.id === selectedExam)?.name} - {classes.find(c => c.id === selectedClass)?.name} - {subjects.find(s => s.id === selectedSubject)?.name}
                    </p>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No students found in this class.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No.</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marks Obtained</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Marks</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {students.map((student) => (
                              <tr key={student.id}>
                                <td className="px-4 py-3 text-sm">{student.roll_number || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm font-medium">{student.profile.full_name}</td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={marksData[student.id]?.marks_obtained || ''}
                                    onChange={(e) => {
                                      setMarksData({
                                        ...marksData,
                                        [student.id]: {
                                          ...marksData[student.id],
                                          marks_obtained: e.target.value,
                                          max_marks: marksData[student.id]?.max_marks || ''
                                        }
                                      });
                                    }}
                                    className="w-24 px-2 py-1 border rounded-md text-sm"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={marksData[student.id]?.max_marks || ''}
                                    onChange={(e) => {
                                      setMarksData({
                                        ...marksData,
                                        [student.id]: {
                                          ...marksData[student.id],
                                          marks_obtained: marksData[student.id]?.marks_obtained || '',
                                          max_marks: e.target.value
                                        }
                                      });
                                    }}
                                    className="w-24 px-2 py-1 border rounded-md text-sm"
                                    placeholder="100"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={handleSaveMarks}
                          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
                        >
                          Submit Marks
                        </button>
                        <button
                          onClick={() => {
                            setSelectedExam('');
                            setSelectedClass('');
                            setSelectedSubject('');
                            setStudents([]);
                            setMarksData({});
                          }}
                          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                        >
                          Reset
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

