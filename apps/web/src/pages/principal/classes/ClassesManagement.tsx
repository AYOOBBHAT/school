import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadAllSubjectsForManagement,
  loadClasses as loadClassesService,
  addSubjectToClass,
  deleteClassSubject,
  loadClassificationTypes as loadClassificationTypesService,
  loadClassificationValues,
  createClass,
  updateClass
} from '../../../services/principal.service';
import { Profile, ClassificationType, ClassificationValue } from '../types';
import type { ClassGroup, Subject } from '../../../services/types';

export default function ClassesManagement() {
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
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
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

      const data = await loadAllSubjectsForManagement(token);
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
        const data = await loadClassesService(token);
        const updatedClass = data.classes?.find((c: ClassGroup) => c.id === classItem.id) || classItem;
        setSelectedClass(updatedClass);
        setClasses(data.classes || []);
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

      await addSubjectToClass(token, selectedClass.id, selectedSubjectId);

      setSelectedSubjectId('');
      await loadClasses();
      // Update selected class with latest data
      const data = await loadClassesService(token);
      const updatedClass = data.classes?.find((c: ClassGroup) => c.id === selectedClass.id);
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

      await deleteClassSubject(token, selectedClass.id, classSubjectId);

      await loadClasses();
      // Update selected class with latest data
      if (selectedClass) {
        const data = await loadClassesService(token);
        const updatedClass = data.classes?.find((c: ClassGroup) => c.id === selectedClass.id);
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

      const data = await loadClassificationTypesService(token);
      setClassificationTypes(data.types || []);

      // Load values for each type
      for (const type of data.types || []) {
        try {
          const valuesData = await loadClassificationValues(token, type.id);
          setClassificationValues(prev => ({ ...prev, [type.id]: valuesData.values || [] }));
        } catch (error) {
          console.error(`Error loading values for type ${type.id}:`, error);
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

      const data = await loadClassesService(token);
      setClasses(data.classes || []);
    } catch (error: any) {
      console.error('Error loading classes:', error);
      setError(error.message || 'Failed to load classes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Please login to continue');
        return;
      }

      await createClass(token, {
        name: formData.name,
        description: formData.description,
        classification_value_ids: selectedClassificationValues.length > 0 ? selectedClassificationValues : undefined,
      });

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

  const handleUpdateClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Please login to continue');
        return;
      }

      await updateClass(token, editingClass.id, {
        name: formData.name,
        description: formData.description,
        classification_value_ids: selectedClassificationValues.length > 0 ? selectedClassificationValues : [],
      });

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
  );}