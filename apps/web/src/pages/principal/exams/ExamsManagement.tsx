import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadClasses as loadClassesService,
  loadAllSubjectsForManagement,
  loadExamsForManagement,
  createExam
} from '../../../services/principal.service';
import { Profile, ClassGroup } from '../types';

export default function ExamsManagement() {
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

      const data = await loadClassesService(token);
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadSubjects = async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadAllSubjectsForManagement(token);
      setSubjects(data.subjects || []);
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

      const data = await loadExamsForManagement(token);
      setExams(data.exams || []);
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = async (e: FormEvent) => {
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

      await createExam(token, payload);

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
  );}