import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { supabase } from '../../../utils/supabase';
import {
  checkUsername as checkUsernameService,
  loadStudentsAdmin as loadStudentsAdminService,
  loadClasses as loadClassesService,
  loadClassSections,
  loadDefaultFees as loadDefaultFeesService,
  loadStudentFeeConfig,
  updateStudent,
  promoteStudent,
  promoteClass,
  createStudent
} from '../../../services/principal.service';
import { Profile, ClassWithStudents } from '../types';
import type { ClassGroup } from '../../../services/types';

export default function StudentsManagement() {
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

        const data = await checkUsernameService(token, username);
        setUsernameStatus({
          checking: false,
          available: data.available,
          message: data.message || (data.available ? 'Username is available ✓' : 'Username already exists. Please choose another.')
        });
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameStatus({ checking: false, available: false, message: 'Error checking username' });
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

      const data = await loadStudentsAdminService(token);
      // Transform classes to match ClassWithStudents structure
      setClassesWithStudents((data.classes || []).map(cls => ({
        id: cls.id,
        name: cls.name,
        description: cls.description || null,
        classifications: [],
        students: (cls.students || []).map(s => ({
          id: s.id,
          roll_number: s.roll_number,
          status: 'active',
          section_id: s.section_id,
          section_name: null,
          profile: s.profile
        })),
        student_count: cls.students?.length || 0
      })));
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

      const data = await loadClassesService(token);
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

      const data = await loadClassSections(token, classId);
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

      const data = await loadDefaultFeesService(token, classId);
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

        const feeConfigData = await loadStudentFeeConfig(token, student.id);
        if (feeConfigData.fee_config) {
          const feeConfig = feeConfigData.fee_config;
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

      const data = await loadDefaultFeesService(token, classId);
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

      await updateStudent(token, selectedStudent.id, updateData);

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
      const data = await promoteStudent(token, selectedStudent.id, formData);
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

      const data = await promoteClass(token, selectedClassId, promoteClassForm);
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

  const handleAddStudent = async (e: FormEvent) => {
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

      await createStudent(token, {
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
      });

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