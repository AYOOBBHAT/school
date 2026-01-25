import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  loadClassificationTypes,
  loadClassificationValues,
  createClassificationType,
  createClassificationValue,
  deleteClassificationType,
  deleteClassificationValue
} from '../../../services/principal.service';
import { Profile, ClassGroup } from '../types';
import { ClassificationType, ClassificationValue } from '../types';
import { getExamplePlaceholder, getExampleHint } from '../utils';

export default function ClassificationsManagement() {
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

      const data = await loadClassificationTypes(token);
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

      const data = await loadClassificationValues(token, typeId);
      setValuesMap(prev => ({ ...prev, [typeId]: data.values || [] }));
    } catch (error) {
      console.error('Error loading values:', error);
    }
  };

  const handleCreateType = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createClassificationType(token, { name: typeForm.name });

      setTypeForm({ name: '' });
      setShowTypeModal(false);
      loadTypes();
    } catch (error: any) {
      alert(error.message || 'Failed to create classification type');
    }
  };

  const handleCreateValue = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId) return;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      await createClassificationValue(token, {
        classification_type_id: selectedTypeId,
        value: valueForm.value,
      });

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

      await deleteClassificationType(token, typeId);
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

      await deleteClassificationValue(token, valueId);
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