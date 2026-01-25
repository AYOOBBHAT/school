import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadAllSubjectsForManagement,
  createSubject,
  deleteSubject
} from '../../../services/principal.service';
import { Profile, ClassGroup } from '../types';
import type { Subject } from '../../../services/types';

export default function SubjectsManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

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

      const data = await loadAllSubjectsForManagement(token);
      setSubjects(data.subjects || []);
    } catch (error: any) {
      console.error('Error loading subjects:', error);
      setError(error.message || 'Failed to load subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        alert('Please login to continue');
        return;
      }

      await createSubject(token, {
        name: formData.name,
        code: formData.code || null,
      });

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

      await deleteSubject(token, subjectId);
      alert('Subject deleted successfully!');
      loadSubjects();
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