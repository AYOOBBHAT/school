import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { Assignment, Student } from '../types';
import { loadTeacherAssignments } from '../../../services/teacher.service';
import { loadStudentsForAttendance } from '../../../services/teacher.service';

interface ClassesOverviewProps {
  currentView: 'classes' | 'attendance' | 'marks' | 'salary' | 'fees';
}

export function ClassesOverview({ currentView }: ClassesOverviewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, [currentView]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      if (!token || !userId) return;

      // Load teaching assignments for classes/marks view
      const teachingData = await loadTeacherAssignments(token, userId);
      setAssignments(teachingData.assignments || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
      setAssignments([]);
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
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
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
  );
}
