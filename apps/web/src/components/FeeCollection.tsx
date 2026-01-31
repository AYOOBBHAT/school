import { useState, useEffect, useMemo, useCallback, FormEvent, useRef } from 'react';
import { supabase } from '../utils/supabase';
import {
  loadClassesForFeeCollection,
  loadStudentsForFeeCollection
} from '../services/clerk.service';
import type { ClassGroup } from '../services/types';
import FeeDetailsDrawer from './FeeDetailsDrawer';

// Local Student type for FeeCollection (transformed UI-specific structure)
interface Student {
  id: string;
  name: string;
  roll_number: string;
  class: string;
  class_group_id?: string;
}

interface FeeComponent {
  id: string;
  fee_type: string;
  fee_name: string;
  fee_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: string;
  due_date?: string;
}

export default function FeeCollection() {
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]); // Store all students for filtering
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0); // Total students from API
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(''); // Empty = all classes
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false); // Track students loading state
  
  // Race condition guard: track the latest request ID
  const latestRequestRef = useRef(0);

  useEffect(() => {
    loadClasses();
  }, []);

  // Load / reload students when class filter changes (runs once on mount as well)
  useEffect(() => {
    loadStudents();
    // Keep search query but it will be re-applied to the new filtered list
  }, [selectedClass]);


  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;

      const data = await loadClassesForFeeCollection(token);
      const classesList = data.classes || [];
      console.log('[FeeCollection] Loaded classes:', classesList.map((c: any) => ({ id: c.id, name: c.name })));
      setClasses(classesList);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadStudents = async () => {
    // Increment request counter for race condition guard
    const requestId = ++latestRequestRef.current;
    
    // Set loading state to prevent debounced effect from running with stale data
    setLoadingStudents(true);
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setLoadingStudents(false);
        return;
      }

      // Use proper pagination - always page 1, limit 50 for initial load
      const data = await loadStudentsForFeeCollection(token, selectedClass || undefined, 1, 50);
      
      // Race condition guard: only update state if this is still the latest request
      if (requestId !== latestRequestRef.current) {
        console.log('[FeeCollection] Ignoring stale request result');
        setLoadingStudents(false);
        return;
      }
      
      // Debug logging - detailed response inspection
      console.log('[FeeCollection] Received data:', {
        classesCount: data.classes?.length || 0,
        unassignedCount: data.unassigned?.length || 0,
        selectedClass,
        searchQuery,
        total_students: (data as any).total_students,
        pagination: (data as any).pagination,
        fullResponse: data
      });
      
      // The /students-admin endpoint returns { classes: [...], unassigned: [...] }
      // Extract students from classes array
      let studentsList: Student[] = [];
      
      if (data.classes && Array.isArray(data.classes)) {
        console.log(`[FeeCollection] Processing ${data.classes.length} classes`);
        // Extract students from all classes (or just the selected class if filtered)
        data.classes.forEach((cls: any) => {
          console.log(`[FeeCollection] Processing class: ${cls.name} (id: ${cls.id}), students: ${cls.students?.length || 0}`);
          if (cls.students && Array.isArray(cls.students)) {
            console.log(`[FeeCollection] Class ${cls.name} has ${cls.students.length} students`);
            cls.students.forEach((s: any) => {
              const studentName = s.profile?.full_name || 'Unknown';
              console.log(`[FeeCollection] Adding student: ${studentName} (id: ${s.id}, roll: ${s.roll_number})`);
              studentsList.push({
                id: s.id,
                name: studentName,
                roll_number: s.roll_number || 'N/A',
                class: cls.name || 'N/A',
                class_group_id: cls.id
              });
            });
          } else {
            console.warn(`[FeeCollection] Class ${cls.name} has no students array or it's not an array:`, cls);
          }
        });
      } else {
        console.warn('[FeeCollection] No classes array in response or it\'s not an array:', data.classes);
      }
      
      // Also include unassigned students if no class filter is selected
      if (!selectedClass && data.unassigned && Array.isArray(data.unassigned)) {
        data.unassigned.forEach((s: any) => {
          studentsList.push({
            id: s.id,
            name: s.profile?.full_name || 'Unknown',
            roll_number: s.roll_number || 'N/A',
            class: 'Unassigned',
            class_group_id: undefined
          });
        });
      }
      
      console.log(`[FeeCollection] Extracted ${studentsList.length} students from response`);
      
      // Only update state if this is still the latest request
      if (requestId === latestRequestRef.current) {
        // Update allStudents - the debounced effect will handle updating students
        // This ensures single source of truth for filtering
        setAllStudents(studentsList);
        // Store total count from API response (never use studentsList.length as total)
        const totalFromAPI = (data as any).total_students || (data as any).pagination?.total || 0;
        setTotalStudentsCount(totalFromAPI);
        console.log(`[FeeCollection] Updated allStudents with ${studentsList.length} students (total from API: ${totalFromAPI})`);
        
        // If there's no search query, immediately update students (no need to wait for debounce)
        // But only if we're not loading (to prevent race conditions)
        if (!searchQuery.trim()) {
          console.log(`[FeeCollection] No search query, setting ${studentsList.length} students immediately`);
          setStudents(studentsList);
        }
        // If there's a search query, let the debounced effect handle it
      }
    } catch (error: any) {
      console.error('Error loading students:', error);
      // IMPORTANT: Do NOT clear students/allStudents on error
      // Only log the error and let the user see the existing data
      // This prevents the disappearing students bug
      
      // Show error message to user if no students are loaded
      if (allStudents.length === 0 && students.length === 0) {
        const errorMessage = error?.message || 'Failed to load students';
        console.error('[FeeCollection] API Error:', errorMessage);
        // Error will be visible in the UI through the empty state message
      }
    } finally {
      // Only clear loading state if this is still the latest request
      if (requestId === latestRequestRef.current) {
        setLoadingStudents(false);
      }
    }
  };

  // Apply search filter (predictive - starts with, but also includes partial matches)
  const applySearchFilter = (studentList: Student[], query: string) => {
    if (!query.trim()) {
      console.log(`[FeeCollection] No search query, setting all ${studentList.length} students`);
      setStudents(studentList);
      return;
    }

    const queryLower = query.toLowerCase().trim();
    const filtered = studentList.filter(s => {
      const nameLower = (s.name || '').toLowerCase();
      const rollNumberLower = (s.roll_number || '').toLowerCase();
      // Predictive search: name starts with query (preferred) or contains query
      const nameStartsWith = nameLower.startsWith(queryLower);
      const nameContains = nameLower.includes(queryLower);
      const rollMatches = rollNumberLower.includes(queryLower);
      return nameStartsWith || nameContains || rollMatches;
    });
    console.log(`[FeeCollection] Filtered ${filtered.length} students from ${studentList.length} with query "${query}"`);
    setStudents(filtered);
  };

  // Debounced search handler - re-applies when search query or students list changes
  // Note: allStudents is already filtered by class from the backend when selectedClass changes
  useEffect(() => {
    // Don't filter if we're loading new students (prevents race condition)
    if (loadingStudents) {
      console.log('[FeeCollection] Debounced effect skipped - loading students');
      return;
    }
    
    // Don't filter if allStudents is empty
    if (allStudents.length === 0) {
      console.log('[FeeCollection] Debounced effect skipped - no students available');
      // If there's no search query and no students, ensure students state is empty
      if (!searchQuery.trim()) {
        setStudents([]);
      }
      return;
    }
    
    console.log(`[FeeCollection] Debounced effect triggered - allStudents: ${allStudents.length}, searchQuery: "${searchQuery}"`);
    
    const timeoutId = setTimeout(() => {
      // Only apply filter if we're not loading (double-check to prevent race condition)
      if (!loadingStudents && allStudents.length > 0) {
        console.log(`[FeeCollection] Debounced effect executing - filtering ${allStudents.length} students`);
        // allStudents is already filtered by class from loadStudents() if selectedClass is set
        // So we just need to apply the search filter
        applySearchFilter(allStudents, searchQuery);
      } else {
        console.log('[FeeCollection] Debounced effect cancelled - loading or no students');
      }
    }, 150); // 150ms debounce for better performance

    return () => clearTimeout(timeoutId);
  }, [searchQuery, allStudents, loadingStudents]);

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Fee Collection</h2>
      </div>

      {/* Student Search */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold mb-4">Search Student</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Class Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Filter by Class (Optional)</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                const newClass = e.target.value;
                const selectedClassObj = classes.find(c => c.id === newClass);
                console.log(`[FeeCollection] Class filter changed to: ${newClass} (${selectedClassObj?.name || 'unknown'})`);
                console.log('[FeeCollection] Available classes:', classes.map((c: any) => ({ id: c.id, name: c.name })));
                setSelectedClass(newClass);
                setSearchQuery(''); // Clear search when class changes
                // Clear allStudents to prevent debounced effect from using stale data
                setAllStudents([]);
                setStudents([]); // Clear displayed students immediately
              }}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium mb-2">Search by Name</label>
            <input
              type="text"
              placeholder={selectedClass ? `Search in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}...` : "Type student name (predictive search)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              {selectedClass 
                ? `Searching in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'} - names starting with your input`
                : 'Search shows students whose names start with your input'}
            </p>
          </div>
        </div>
        
        {/* Search Results */}
        {searchQuery && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {students.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">
                {searchQuery ? (
                  <div>
                    <p>No students found matching "{searchQuery}"</p>
                    {selectedClass && (
                      <p className="text-xs mt-1">in {classes.find(c => c.id === selectedClass)?.name || 'selected class'}</p>
                    )}
                    {allStudents.length > 0 && (
                      <p className="text-xs mt-1 text-gray-400">Total students available: {allStudents.length}</p>
                    )}
                  </div>
                ) : (
                  'Start typing to search for students'
                )}
              </div>
            ) : (
              <>
                <div className="p-2 bg-gray-50 text-xs text-gray-600 border-b">
                  Found {students.length} student{students.length !== 1 ? 's' : ''} matching "{searchQuery}"
                  {selectedClass && ` in ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}`}
                </div>
                {students.slice(0, 50).map(student => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                      selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-600">
                      Roll: {student.roll_number} | Class: {student.class}
                    </div>
                  </div>
                ))}
                {students.length > 50 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                    Showing first 50 results. Refine your search for more specific results.
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Show all students when no search query but class is selected */}
        {!searchQuery && selectedClass && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            <div className="p-2 bg-gray-50 text-xs text-gray-600 border-b">
              Showing {students.length} of {totalStudentsCount || 0} students in {classes.find(c => c.id === selectedClass)?.name || 'selected class'}
            </div>
            {loadingStudents ? (
              <div className="p-4 text-center text-gray-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No students found in this class</div>
            ) : (
              students.slice(0, 50).map(student => (
                <div
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                    selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                >
                  <div className="font-semibold text-gray-900">{student.name}</div>
                  <div className="text-sm text-gray-600">
                    Roll: {student.roll_number} | Class: {student.class}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Show all students when no search query and no class filter (default view) */}
        {!searchQuery && !selectedClass && (
          <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
            {loadingStudents ? (
              <div className="p-4 text-center text-gray-500">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {allStudents.length === 0 ? (
                  <div>
                    <p>No students found. Please check:</p>
                    <ul className="text-xs mt-2 text-left list-disc list-inside space-y-1">
                      <li>Are there active students in the system?</li>
                      <li>Is your authentication token valid?</li>
                      <li>Check browser console for API errors</li>
                    </ul>
                  </div>
                ) : (
                  <div>
                    <p>Start typing to search for students</p>
                    <p className="text-xs mt-1 text-gray-400">Or select a class to filter</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="p-2 bg-gray-50 text-xs text-gray-600 border-b">
                  Showing {allStudents.length} of {totalStudentsCount || 0} students - Type to search or select a class to filter
                </div>
                {students.slice(0, 50).map(student => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition ${
                      selectedStudent?.id === student.id ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-600">
                      Roll: {student.roll_number} | Class: {student.class}
                    </div>
                  </div>
                ))}
                {students.length > 50 && (
                  <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                    Showing first 50 students. Use search or class filter to narrow down results.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Fee Details Drawer */}
      <FeeDetailsDrawer
        student={selectedStudent}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedStudent(null);
        }}
        onPaymentSuccess={() => {
          // Reload students list if needed
          loadStudents();
        }}
      />
    </div>
  );
}
