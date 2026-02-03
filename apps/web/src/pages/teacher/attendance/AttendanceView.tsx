import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { Assignment, Student } from '../types';
import { 
  loadAttendanceAssignments as loadAttendanceAssignmentsService,
  loadAttendanceForDate as loadAttendanceForDateService,
  saveAttendance as saveAttendanceService
} from '../../../services/attendance.service';
import { loadStudentsForAttendance } from '../../../services/teacher.service';

interface AttendanceViewProps {
  profile: any;
}

export default function AttendanceView({ profile }: AttendanceViewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [exceptions, setExceptions] = useState<Record<string, 'absent' | 'late'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    const loadRecords = async () => {
      if (!selectedAssignment || !attendanceDate || students.length === 0) return;
      
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) return;

        const records = await loadAttendanceForDateService(token, selectedAssignment.class_group_id, attendanceDate);
        // Only store exceptions (absent/late), not present
        const exceptionsMap: Record<string, 'absent' | 'late'> = {};
        (students ?? []).forEach((student) => {
          if (student?.id && records[student.id] && records[student.id] !== 'present') {
            exceptionsMap[student.id] = records[student.id] as 'absent' | 'late';
          }
        });
        setExceptions(exceptionsMap);
      } catch (error) {
        console.error('Error loading attendance records:', error);
      }
    };
    loadRecords();
  }, [attendanceDate, selectedAssignment, students]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      if (!token || !userId) return;

      const attendanceAssignments = await loadAttendanceAssignmentsService(token, userId);
      setAssignments(attendanceAssignments ?? []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (assignment: Assignment) => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const allStudents = await loadStudentsForAttendance(token, assignment.class_group_id, assignment.section_id || undefined);
      setStudents(allStudents ?? []);
      setSelectedAssignment(assignment);
      
      // Load attendance records for the current date - only store exceptions
      const records = await loadAttendanceForDateService(token, assignment.class_group_id, attendanceDate);
      const exceptionsMap: Record<string, 'absent' | 'late'> = {};
      (allStudents ?? []).forEach((student) => {
        if (student?.id && records[student.id] && records[student.id] !== 'present') {
          exceptionsMap[student.id] = records[student.id] as 'absent' | 'late';
        }
      });
      setExceptions(exceptionsMap);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const getStatus = (id: string): 'present' | 'absent' | 'late' => {
    return exceptions[id] ?? 'present';
  };

  const updateStatus = (id: string, status: 'present' | 'absent' | 'late') => {
    setExceptions(prev => {
      if (status === 'present') {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: status };
    });
  };

  const markAllPresent = () => {
    setExceptions({});
  };

  const markAllAbsent = () => {
    const allAbsent: Record<string, 'absent'> = {};
    (students ?? []).forEach(s => {
      if (s?.id) {
        allAbsent[s.id] = 'absent';
      }
    });
    setExceptions(allAbsent);
  };

  const handleSaveAttendance = async () => {
    if (!selectedAssignment) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('No authentication token');

      const payload = (students ?? []).map(s => ({
        student_id: s.id,
        class_group_id: selectedAssignment.class_group_id,
        date: attendanceDate,
        status: exceptions[s.id] ?? 'present',
        school_id: profile.school_id
      }));

      await saveAttendanceService(token, payload);
      alert('Attendance saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to save attendance');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Mark Attendance</h2>
      <p className="text-sm text-gray-600 mb-4">
        Select a class you are assigned to mark attendance for. Only classes assigned by the principal are shown.
      </p>
      
      {!selectedAssignment && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-gray-600 mb-4">Select a class to mark attendance:</p>
          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No attendance classes assigned.</p>
              <p className="text-sm">Please contact the principal to assign you to mark attendance for classes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(assignments ?? []).filter(Boolean).map((assignment) => (
                <button
                  key={assignment?.id || Math.random()}
                  onClick={() => assignment && loadStudents(assignment)}
                  className="bg-teal-50 hover:bg-teal-100 p-4 rounded-lg text-left transition border-2 border-teal-200"
                >
                  <div className="font-semibold text-teal-800">{assignment?.class_groups?.name ?? 'N/A'}</div>
                  {assignment?.sections && (
                    <div className="text-sm text-gray-600">Section: {assignment.sections.name}</div>
                  )}
                  {!assignment?.sections && (
                    <div className="text-sm text-gray-500">All Sections</div>
                  )}
                  <div className="text-teal-600 mt-2">📅 Attendance Class</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedAssignment && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold">
                {selectedAssignment?.class_groups?.name ?? 'N/A'}
                {selectedAssignment?.sections && ` - ${selectedAssignment.sections.name}`}
              </h3>
              <p className="text-gray-600">{selectedAssignment?.subjects?.name ?? 'N/A'}</p>
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
              <div className="flex gap-3 mb-4">
                <button 
                  onClick={markAllPresent} 
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  ✓ Mark All Present
                </button>
                <button 
                  onClick={markAllAbsent} 
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  ✕ Mark All Absent
                </button>
              </div>
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
                    {(students ?? []).filter(Boolean).map((student) => (
                      <tr key={student?.id || Math.random()}>
                        <td className="px-4 py-3 text-sm">{student?.roll_number ?? 'N/A'}</td>
                        <td className="px-4 py-3 text-sm font-medium">{student?.profile?.full_name ?? 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => student?.id && updateStatus(student.id, 'present')}
                              className={getStatus(student?.id || '') === 'present'
                                ? 'bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700'
                                : 'bg-gray-200 px-3 py-1 rounded hover:bg-gray-300'}
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => student?.id && updateStatus(student.id, 'absent')}
                              className={getStatus(student?.id || '') === 'absent'
                                ? 'bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700'
                                : 'bg-gray-200 px-3 py-1 rounded hover:bg-gray-300'}
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => student?.id && updateStatus(student.id, 'late')}
                              className={getStatus(student?.id || '') === 'late'
                                ? 'bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600'
                                : 'bg-gray-200 px-3 py-1 rounded hover:bg-gray-300'}
                            >
                              ⏰
                            </button>
                          </div>
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
  );
}
