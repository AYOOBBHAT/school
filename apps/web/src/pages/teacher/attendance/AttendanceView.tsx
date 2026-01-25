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
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
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
        // Map records to student list format
        const result: Record<string, 'present' | 'absent' | 'late'> = {};
        students.forEach((student) => {
          result[student.id] = records[student.id] || 'present';
        });
        setAttendanceRecords(result);
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
      setAssignments(attendanceAssignments);
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
      setStudents(allStudents);
      setSelectedAssignment(assignment);
      
      // Load attendance records for the current date
      const records = await loadAttendanceForDateService(token, assignment.class_group_id, attendanceDate);
      const result: Record<string, 'present' | 'absent' | 'late'> = {};
      allStudents.forEach((student) => {
        result[student.id] = records[student.id] || 'present';
      });
      setAttendanceRecords(result);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedAssignment) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('No authentication token');

      const attendanceData = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        student_id: studentId,
        class_group_id: selectedAssignment.class_group_id,
        date: attendanceDate,
        status,
        school_id: profile.school_id
      }));

      await saveAttendanceService(token, attendanceData);
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
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  onClick={() => loadStudents(assignment)}
                  className="bg-teal-50 hover:bg-teal-100 p-4 rounded-lg text-left transition border-2 border-teal-200"
                >
                  <div className="font-semibold text-teal-800">{assignment.class_groups.name}</div>
                  {assignment.sections && (
                    <div className="text-sm text-gray-600">Section: {assignment.sections.name}</div>
                  )}
                  {!assignment.sections && (
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
  );
}
