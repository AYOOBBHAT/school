import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { Student } from '../types';
import { 
  loadExams, 
  loadClassesForMarks, 
  loadSubjectsForMarks, 
  loadStudentsForMarks, 
  saveMarks 
} from '../../../services/teacher.service';

interface MarksEntryViewProps {
  profile: any;
}

export default function MarksEntryView({ profile }: MarksEntryViewProps) {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [marksData, setMarksData] = useState<Record<string, { marks_obtained: string; max_marks: string }>>({});

  useEffect(() => {
    const loadData = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      if (!token || !userId) return;

      try {
        const [examsData, classesData] = await Promise.all([
          loadExams(token),
          loadClassesForMarks(token, userId)
        ]);
        setExams(examsData);
        setClasses(classesData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedClass) {
        setSubjects([]);
        setStudents([]);
        return;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      if (!token || !userId) return;

      try {
        const [subjectsData, studentsData] = await Promise.all([
          loadSubjectsForMarks(token, userId, selectedClass),
          loadStudentsForMarks(token, selectedClass)
        ]);
        setSubjects(subjectsData);
        setStudents(studentsData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, [selectedClass]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedClass || !selectedSubject) return;

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      try {
        const studentsData = await loadStudentsForMarks(token, selectedClass);
        setStudents(studentsData);
      } catch (error) {
        console.error('Error loading students:', error);
      }
    };
    loadData();
  }, [selectedSubject, selectedClass]);

  const handleSaveMarks = async () => {
    if (!selectedExam || !selectedClass || !selectedSubject) {
      alert('Please select Exam, Class, and Subject');
      return;
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error('No authentication token');

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
        throw new Error('Please enter at least one mark');
      }

      await saveMarks(token, marksArray);
      alert('Marks saved successfully!');
      setMarksData({});
    } catch (error: any) {
      alert(error.message || 'Failed to save marks');
    }
  };

  return (
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
  );
}
