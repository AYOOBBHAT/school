import { Router } from 'express';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { cacheFetch, invalidateCache } from '../utils/cache.js';

const router = Router();

// Get all students for principal/clerk (grouped by class) or students for teacher's assigned classes
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { class_group_id, subject_id, section_id } = req.query;

  // Use service role key to bypass RLS for admin operations

  try {
    // For principal, use cache for summary (when no filters applied)
    const isPrincipalSummary = user.role === 'principal' && !class_group_id && !subject_id && !section_id;
    const cacheKey = `school:${user.schoolId || ''}:principal:students:summary`;

    if (isPrincipalSummary) {
      const cached = await cacheFetch(cacheKey, async () => {
        return await fetchStudentsSummary(user.schoolId);
      });

      return res.json(cached);
    }

    // For filtered queries or other roles, fetch directly (no cache)
    const result = await fetchStudentsData(user, req.query);
    return res.json(result);
  } catch (err: any) {
    console.error('[students-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * Fetch students summary with proper total count (for principal dashboard)
 * Groups by class and returns total_students from DB query
 */
async function fetchStudentsSummary(schoolId: string | null | undefined) {
  if (!schoolId) {
    throw new Error('School ID is required');
  }
  // Get total count of all active students (separate query for accuracy)
  const { count: totalCount, error: countError } = await adminSupabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('status', 'active');

  if (countError) {
    console.error('[students-admin] Error getting total count:', countError);
    throw new Error(countError.message);
  }

  // Get students grouped by class (with pagination for large datasets)
  const { data: students, error: studentsError } = await adminSupabase
    .from('students')
    .select(`
      id,
      roll_number,
      status,
      admission_date,
      class_group_id,
      section_id,
      profile:profiles!students_profile_id_fkey(
        id,
        full_name,
        email,
        phone,
        created_at
      ),
      class_groups:class_group_id(
        id,
        name,
        description,
        classifications:class_classifications(
          classification_value:classification_values(
            id,
            value,
            classification_type:classification_types(id, name)
          )
        )
      ),
      sections:section_id(
        id,
        name
      )
    `)
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('roll_number', { ascending: true, nullsFirst: false })
    .limit(10000); // High limit for summary (cached, so acceptable)

  if (studentsError) {
    console.error('[students-admin] Error fetching students:', studentsError);
    throw new Error(studentsError.message);
  }

  // Group students by class
  const studentsByClass: Record<string, any[]> = {};
  const unassignedStudents: any[] = [];
  const classIdsToFetch: Set<string> = new Set();

  (students || []).forEach((student: any) => {
    if (student.class_group_id) {
      const classId = student.class_group_id;
      if (!studentsByClass[classId]) {
        studentsByClass[classId] = [];
      }
      studentsByClass[classId].push(student);
      
      if (!student.class_groups) {
        classIdsToFetch.add(classId);
      }
    } else {
      unassignedStudents.push(student);
    }
  });

  // Fetch class details for classes that weren't loaded in the relation
  const classDetailsMap: Record<string, any> = {};
  if (classIdsToFetch.size > 0) {
    const { data: classDetails, error: classError } = await adminSupabase
      .from('class_groups')
      .select(`
        id,
        name,
        description,
        classifications:class_classifications(
          classification_value:classification_values(
            id,
            value,
            classification_type:classification_types(id, name)
          )
        )
      `)
      .in('id', Array.from(classIdsToFetch))
      .eq('school_id', schoolId);

    if (!classError && classDetails) {
      classDetails.forEach((cls: any) => {
        const classifications = (cls.classifications || []).map((cc: any) => ({
          type: cc.classification_value?.classification_type?.name || 'Unknown',
          value: cc.classification_value?.value || 'Unknown',
          type_id: cc.classification_value?.classification_type?.id || '',
          value_id: cc.classification_value?.id || ''
        }));
        classDetailsMap[cls.id] = {
          ...cls,
          classifications
        };
      });
    }
  }

  // Build classes array with student counts
  const classesWithStudents = Object.keys(studentsByClass).map(classId => {
    const classStudents = studentsByClass[classId];
    const firstStudent = classStudents[0];
    const classGroup = firstStudent.class_groups || classDetailsMap[classId];
    
    return {
      id: classId,
      name: classGroup?.name || 'Unknown Class',
      description: classGroup?.description || '',
      classifications: classGroup?.classifications || [],
      students: classStudents.map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        status: s.status,
        admission_date: s.admission_date,
        section_id: s.section_id,
        section_name: s.sections?.name || null,
        profile: s.profile
      })),
      student_count: classStudents.length
    };
  });

  // Sort classes by name
  classesWithStudents.sort((a, b) => a.name.localeCompare(b.name));

  return {
    classes: classesWithStudents,
    unassigned: unassignedStudents.map((s: any) => ({
      id: s.id,
      roll_number: s.roll_number,
      status: s.status,
      admission_date: s.admission_date,
      profile: s.profile
    })),
    total_students: totalCount || 0, // Use count from separate query, not students.length
    pagination: {
      page: 1,
      limit: 10000,
      total: totalCount || 0,
      total_pages: 1
    }
  };
}

/**
 * Fetch students data with filters and pagination (for filtered queries)
 */
async function fetchStudentsData(user: any, queryParams: any) {
  try {
    const { class_group_id, subject_id, section_id } = queryParams;
    let classGroupIds: string[] = [];

    // For teachers, only show students from their assigned classes
    if (user.role === 'teacher') {
    const { data: assignments, error: assignmentError } = await adminSupabase
      .from('teacher_assignments')
      .select('class_group_id, section_id, subject_id')
      .eq('teacher_id', user.id)
      .eq('school_id', user.schoolId);

    if (assignmentError) {
      console.error('[students-admin] Error fetching teacher assignments:', assignmentError);
      throw new Error(assignmentError.message);
    }

    if (!assignments || assignments.length === 0) {
      return { classes: [], unassigned: [], total_students: 0, pagination: { page: 1, limit: 50, total: 0, total_pages: 1 } };
    }

    // Filter by query params if provided
    let filteredAssignments = assignments;
    if (class_group_id) {
      filteredAssignments = filteredAssignments.filter((a: any) => a.class_group_id === class_group_id);
    }
    if (subject_id) {
      filteredAssignments = filteredAssignments.filter((a: any) => a.subject_id === subject_id);
    }
    if (section_id) {
      filteredAssignments = filteredAssignments.filter((a: any) => a.section_id === section_id);
    }

    classGroupIds = [...new Set(filteredAssignments.map((a: any) => a.class_group_id))];

    if (classGroupIds.length === 0) {
      return { classes: [], unassigned: [], total_students: 0, pagination: { page: 1, limit: 50, total: 0, total_pages: 1 } };
    }
    }

    // Build query
    let query = adminSupabase
      .from('students')
      .select(`
        id,
        roll_number,
        status,
        admission_date,
        class_group_id,
        section_id,
        profile:profiles!students_profile_id_fkey(
          id,
          full_name,
          email,
          phone,
          created_at
        ),
        class_groups:class_group_id(
          id,
          name,
          description,
          classifications:class_classifications(
            classification_value:classification_values(
              id,
              value,
              classification_type:classification_types(id, name)
            )
          )
        ),
        sections:section_id(
          id,
          name
        )
      `)
      .eq('school_id', user.schoolId)
      .eq('status', 'active'); // Only show active students

    // For teachers, filter by assigned classes
    if (user.role === 'teacher' && classGroupIds.length > 0) {
      query = query.in('class_group_id', classGroupIds);
    }

    // If class_group_id is provided in query (for all roles), filter by it
    if (class_group_id && user.role !== 'teacher') {
      query = query.eq('class_group_id', class_group_id as string);
    }

    // If section_id is provided, filter by it
    if (section_id) {
      query = query.eq('section_id', section_id as string);
    }

    // Add pagination (critical for 1M+ users)
    // Always use reasonable limits for scalability
    const requestedLimit = parseInt(queryParams.limit as string) || 50;
    const maxLimit = 100; // Maximum 100 per page for performance
    const page = parseInt(queryParams.page as string) || 1;
    const limit = Math.min(requestedLimit, maxLimit);
    const offset = (page - 1) * limit;

    // Get total count first (separate query for accuracy)
    const countQuery = adminSupabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', user.schoolId)
      .eq('status', 'active');

    if (user.role === 'teacher' && classGroupIds.length > 0) {
      countQuery.in('class_group_id', classGroupIds);
    }
    if (class_group_id && user.role !== 'teacher') {
      countQuery.eq('class_group_id', class_group_id as string);
    }
    if (section_id) {
      countQuery.eq('section_id', section_id as string);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('[students-admin] Error getting total count:', countError);
      throw new Error(countError.message);
    }

    const result = await query
      .order('roll_number', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);
    
    const { data: students, error } = result;

    if (error) {
      console.error('[students-admin] Error fetching students:', error);
      throw new Error(error.message);
    }

    // Transform classifications for classes
    const studentsWithClasses = (students || []).map((student: any) => {
      if (student.class_groups) {
        const classGroup = student.class_groups;
        const classifications = (classGroup.classifications || []).map((cc: any) => ({
          type: cc.classification_value?.classification_type?.name || 'Unknown',
          value: cc.classification_value?.value || 'Unknown',
          type_id: cc.classification_value?.classification_type?.id || '',
          value_id: cc.classification_value?.id || ''
        }));
        
        return {
          ...student,
          class_groups: {
            ...classGroup,
            classifications
          }
        };
      }
      return student;
    });

    // Group students by class
    const studentsByClass: Record<string, any[]> = {};
    const unassignedStudents: any[] = [];
    const classIdsToFetch: Set<string> = new Set();

    studentsWithClasses.forEach((student: any) => {
      if (student.class_group_id) {
        const classId = student.class_group_id;
        if (!studentsByClass[classId]) {
          studentsByClass[classId] = [];
        }
        studentsByClass[classId].push(student);
        
        // If class_groups relation wasn't loaded, we'll fetch it separately
        if (!student.class_groups) {
          classIdsToFetch.add(classId);
        }
      } else {
        unassignedStudents.push(student);
      }
    });

    // Fetch class details for classes that weren't loaded in the relation
    const classDetailsMap: Record<string, any> = {};
    if (classIdsToFetch.size > 0) {
      const { data: classDetails, error: classError } = await adminSupabase
        .from('class_groups')
        .select(`
          id,
          name,
          description,
          classifications:class_classifications(
            classification_value:classification_values(
              id,
              value,
              classification_type:classification_types(id, name)
            )
          )
        `)
        .in('id', Array.from(classIdsToFetch))
        .eq('school_id', user.schoolId);

      if (!classError && classDetails) {
        classDetails.forEach((cls: any) => {
          const classifications = (cls.classifications || []).map((cc: any) => ({
            type: cc.classification_value?.classification_type?.name || 'Unknown',
            value: cc.classification_value?.value || 'Unknown',
            type_id: cc.classification_value?.classification_type?.id || '',
            value_id: cc.classification_value?.id || ''
          }));
          classDetailsMap[cls.id] = {
            ...cls,
            classifications
          };
        });
      }
    }

    // Get class details for each class
    const classesWithStudents = Object.keys(studentsByClass).map(classId => {
      const classStudents = studentsByClass[classId];
      const firstStudent = classStudents[0];
      // Use class_groups from relation if available, otherwise use fetched classDetailsMap
      const classGroup = firstStudent.class_groups || classDetailsMap[classId];
      
      return {
        id: classId,
        name: classGroup?.name || 'Unknown Class',
        description: classGroup?.description || '',
        classifications: classGroup?.classifications || [],
        students: classStudents.map((s: any) => ({
          id: s.id,
          roll_number: s.roll_number,
          status: s.status,
          admission_date: s.admission_date,
          section_id: s.section_id,
          section_name: s.sections?.name || null,
          profile: s.profile
        })),
        student_count: classStudents.length
      };
    });

    // Sort classes by name
    classesWithStudents.sort((a, b) => a.name.localeCompare(b.name));

    return {
      classes: classesWithStudents,
      unassigned: unassignedStudents.map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        status: s.status,
        admission_date: s.admission_date,
        profile: s.profile
      })),
      total_students: totalCount || 0, // Use totalCount from separate query, not count from paginated query
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / limit),
        has_more: (totalCount || 0) > (offset + limit)
      }
    };
  } catch (err: any) {
    console.error('[students-admin] Error in fetchStudentsData:', err);
    throw err;
  }
}

// Get student's current fee configuration
router.get('/:studentId/fee-config', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Verify student belongs to the school
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, class_group_id')
      .eq('id', studentId)
      .eq('school_id', user.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    // Get current fee profile
    const { data: feeProfile } = await adminSupabase
      .from('student_fee_profile')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get current fee overrides (discounts)
    const { data: feeOverrides } = await adminSupabase
      .from('student_fee_overrides')
      .select(`
        *,
        fee_categories:fee_category_id(id, name, fee_type)
      `)
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`);

    // Get student transport route
    const { data: studentTransport } = await adminSupabase
      .from('student_transport')
      .select('*, transport_routes:route_id(id, route_name)')
      .eq('student_id', studentId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get class fees to find which one is selected
    let selectedClassFeeId = null;
    let classFeeDiscount = 0;
    if (student.class_group_id) {
      const { data: classFees } = await adminSupabase
        .from('class_fee_defaults')
        .select('id, fee_category_id')
        .eq('class_group_id', student.class_group_id)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (classFees && classFees.length > 0) {
        selectedClassFeeId = classFees[0].id;
        // Find discount for class fee category
        const classFeeOverride = feeOverrides?.find((fo: any) => 
          fo.fee_category_id === classFees[0].fee_category_id
        );
        if (classFeeOverride) {
          classFeeDiscount = parseFloat(classFeeOverride.discount_amount || 0);
        }
      }
    }

    // Get transport fee discount
    let transportFeeDiscount = 0;
    const transportCategory = feeOverrides?.find((fo: any) => 
      fo.fee_categories?.fee_type === 'transport'
    );
    if (transportCategory) {
      transportFeeDiscount = parseFloat(transportCategory.discount_amount || 0);
    }

    // Get all fee categories to include in other_fees
    const { data: allFeeCategories } = await adminSupabase
      .from('fee_categories')
      .select('id, name, fee_type')
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .neq('fee_type', 'transport')
      .neq('fee_type', 'tuition');

    // Get other fees discounts and build complete list
    const feeOverridesMap = new Map();
    (feeOverrides || []).forEach((fo: any) => {
      if (fo.fee_categories?.fee_type && 
          fo.fee_categories.fee_type !== 'transport' && 
          fo.fee_categories.fee_type !== 'tuition') {
        feeOverridesMap.set(fo.fee_category_id, parseFloat(fo.discount_amount || 0));
      }
    });

    // Build other_fees array with all categories (enabled if has discount, or default to enabled)
    const otherFees = (allFeeCategories || []).map((cat: any) => ({
      fee_category_id: cat.id,
      enabled: feeOverridesMap.has(cat.id) || true, // Enabled if has discount or default true
      discount: feeOverridesMap.get(cat.id) || 0
    }));

    // Get custom fees for this student's class (or all classes)
    const studentClassId = student?.class_group_id;
    let customFees: any[] = [];
    if (studentClassId) {
      const today = new Date().toISOString().split('T')[0];
      // First, get all custom fee category IDs for this school
      const { data: customCategories } = await adminSupabase
        .from('fee_categories')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('fee_type', 'custom')
        .eq('is_active', true);

      let customFeesData: any[] = [];
      if (customCategories && customCategories.length > 0) {
        const customCategoryIds = customCategories.map((cat: any) => cat.id);
        
        const { data: feesData } = await adminSupabase
          .from('optional_fee_definitions')
          .select('id, amount, fee_cycle, class_group_id, fee_category_id, class_groups:class_group_id(id, name), fee_categories:fee_category_id(id, name, description, fee_type)')
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .in('fee_category_id', customCategoryIds)
          .or(`class_group_id.eq.${studentClassId},class_group_id.is.null`)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('created_at', { ascending: false });
        
        customFeesData = feesData || [];
      }

      if (customFeesData) {
        // Get custom fee overrides (discounts/exemptions) for this student
        // Custom fee overrides are stored with fee_category_id pointing to the custom fee's category
        const customFeeCategoryIds = (customFeesData || []).map((cf: any) => cf.fee_category_id).filter(Boolean);
        
        let customFeeOverrides: any[] = [];
        if (customFeeCategoryIds.length > 0) {
          const { data: overrides } = await adminSupabase
            .from('student_fee_overrides')
            .select('fee_category_id, discount_amount, is_full_free')
            .eq('student_id', studentId)
            .eq('school_id', user.schoolId)
            .in('fee_category_id', customFeeCategoryIds)
            .eq('is_active', true)
            .lte('effective_from', today)
            .or(`effective_to.is.null,effective_to.gte.${today}`);
          
          customFeeOverrides = overrides || [];
        }

        // Map custom fees with their overrides
        customFees = (customFeesData || []).map((cf: any) => {
          // Find override by matching fee_category_id
          const override = customFeeOverrides.find((o: any) => 
            o.fee_category_id === cf.fee_category_id
          );
          return {
            custom_fee_id: cf.id,
            discount: override ? parseFloat(override.discount_amount || 0) : 0,
            is_exempt: override?.is_full_free || false
          };
        });
      }
    }

    return res.json({
      class_fee_id: selectedClassFeeId,
      class_fee_discount: classFeeDiscount,
      transport_enabled: feeProfile?.transport_enabled ?? true,
      transport_route_id: studentTransport?.route_id || null,
      transport_fee_discount: transportFeeDiscount,
      other_fees: otherFees,
      custom_fees: customFees
    });
  } catch (err: any) {
    console.error('[students-admin] Error fetching fee config:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Update student class assignment and fee configuration
router.put('/:studentId', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;
  const { class_group_id, section_id, roll_number, fee_config } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Verify student belongs to the school
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, profile_id, class_group_id, admission_date')
      .eq('id', studentId)
      .eq('school_id', user.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    // If class_group_id is provided, verify it belongs to the school
    if (class_group_id !== undefined) {
      if (class_group_id) {
        const { data: classGroup, error: classError } = await adminSupabase
          .from('class_groups')
          .select('id, school_id')
          .eq('id', class_group_id)
          .eq('school_id', user.schoolId)
          .single();

        if (classError || !classGroup) {
          return res.status(400).json({ error: 'Invalid class group or access denied' });
        }

        // If section_id is provided, verify it belongs to the class_group
        if (section_id) {
          const { data: section, error: sectionError } = await adminSupabase
            .from('sections')
            .select('id, class_group_id')
            .eq('id', section_id)
            .eq('class_group_id', class_group_id)
            .single();

          if (sectionError || !section) {
            return res.status(400).json({ error: 'Invalid section or section does not belong to the class' });
          }
        }
      }
    }

    // Update student record
    const updateData: any = {};
    const classChanged = class_group_id !== undefined && class_group_id !== student.class_group_id;
    
    if (class_group_id !== undefined) {
      updateData.class_group_id = class_group_id || null;
    }
    if (section_id !== undefined) {
      updateData.section_id = section_id || null;
    }
    if (roll_number !== undefined) {
      updateData.roll_number = roll_number || null;
    }

    const { data: updatedStudent, error: updateError } = await adminSupabase
      .from('students')
      .update(updateData)
      .eq('id', studentId)
      .select()
      .single();

    if (updateError) {
      console.error('[students-admin] Error updating student:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    // If class changed or fee_config provided, update fee configuration with versioning
    const finalClassId = class_group_id !== undefined ? class_group_id : student.class_group_id;
    if ((classChanged || fee_config) && finalClassId) {
      // IMPORTANT: Versioning logic - close old records and create new ones
      // Determine effective_from_date for new fee structure
      // If fee_config.effective_from_date is provided, use it; otherwise use admission_date or today
      let effectiveFromDate: string;
      if (fee_config?.effective_from_date) {
        effectiveFromDate = fee_config.effective_from_date;
        // Validate that effective_from_date is not in the past relative to admission
        if (student.admission_date && effectiveFromDate < student.admission_date) {
          return res.status(400).json({ 
            error: `Effective from date (${effectiveFromDate}) cannot be earlier than admission date (${student.admission_date})` 
          });
        }
      } else {
        // Default: use admission_date if available, otherwise use today
        effectiveFromDate = student.admission_date || today;
      }

      // Calculate the day before the new effective_from_date
      // This will be used to close old fee structures
      const effectiveFromDateObj = new Date(effectiveFromDate);
      effectiveFromDateObj.setDate(effectiveFromDateObj.getDate() - 1);
      const dayBeforeEffectiveFrom = effectiveFromDateObj.toISOString().split('T')[0];

      // Close all active fee records in parallel for better performance
      // This preserves the fee history for past months
      const updateTime = new Date().toISOString();
      const [profileCloseResult, overrideCloseResult, transportDeactivateResult] = await Promise.all([
        adminSupabase
          .from('student_fee_profile')
          .update({ 
            effective_to: dayBeforeEffectiveFrom, 
            is_active: false,
            updated_at: updateTime
          })
          .eq('student_id', studentId)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .is('effective_to', null),
        adminSupabase
          .from('student_fee_overrides')
          .update({ 
            effective_to: dayBeforeEffectiveFrom, 
            is_active: false,
            updated_at: updateTime
          })
          .eq('student_id', studentId)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .is('effective_to', null),
        adminSupabase
          .from('student_transport')
          .update({ 
            is_active: false,
            updated_at: updateTime
          })
          .eq('student_id', studentId)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
      ]);

      if (profileCloseResult.error) {
        console.error('[students-admin] Error closing old fee profiles:', profileCloseResult.error);
      }
      if (overrideCloseResult.error) {
        console.error('[students-admin] Error closing old fee overrides:', overrideCloseResult.error);
      }
      if (transportDeactivateResult.error) {
        console.error('[students-admin] Error deactivating old transport:', transportDeactivateResult.error);
      }

      // If fee_config provided, use it; otherwise, if class changed, use new class defaults
      let feeConfigToApply = fee_config;
      
      if (classChanged && !fee_config) {
        // Class changed but no fee_config provided - use new class defaults
        const { data: defaultFees } = await adminSupabase
          .from('class_fee_defaults')
          .select('id')
          .eq('class_group_id', finalClassId)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('created_at', { ascending: false })
          .limit(1);

        feeConfigToApply = {
          class_fee_id: defaultFees && defaultFees.length > 0 ? defaultFees[0].id : null,
          class_fee_discount: 0,
          transport_enabled: false,
          transport_route_id: null,
          transport_fee_discount: 0,
          other_fees: [],
          custom_fees: []
        };
      }

      if (feeConfigToApply) {
        // Pre-fetch transport category and route if transport is enabled (parallel fetch for better performance)
        const transportEnabled = feeConfigToApply.transport_enabled && feeConfigToApply.transport_route_id;
        const [classFeesResult, transportData] = await Promise.all([
          // Get default class fees
          adminSupabase
            .from('class_fee_defaults')
            .select(`
              *,
              fee_categories:fee_category_id(id, name, fee_type)
            `)
            .eq('class_group_id', finalClassId)
            .eq('school_id', user.schoolId)
            .eq('is_active', true)
            .lte('effective_from', today)
            .or(`effective_to.is.null,effective_to.gte.${today}`),
          // Pre-fetch transport route and category if transport is enabled
          transportEnabled ? Promise.all([
            adminSupabase
              .from('transport_routes')
              .select('id, route_name')
              .eq('id', feeConfigToApply.transport_route_id)
              .eq('school_id', user.schoolId)
              .single(),
            feeConfigToApply.transport_fee_discount > 0 
              ? adminSupabase
                  .from('fee_categories')
                  .select('id')
                  .eq('school_id', user.schoolId)
                  .eq('fee_type', 'transport')
                  .eq('is_active', true)
                  .limit(1)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null })
          ]) : Promise.resolve([{ data: null, error: null }, { data: null, error: null }])
        ]);

        const { data: classFees } = classFeesResult;
        const [routeResult, transportCategoryResult] = transportData as any[];

        if (classFees && classFees.length > 0) {
          let selectedClassFee = null;
          if (feeConfigToApply.class_fee_id) {
            selectedClassFee = classFees.find((cf: any) => cf.id === feeConfigToApply.class_fee_id);
          } else {
            selectedClassFee = classFees.find((cf: any) => 
              cf.fee_categories?.fee_type === 'tuition' || !cf.fee_category_id
            );
          }

          // Apply class fee discount
          if (selectedClassFee && feeConfigToApply.class_fee_discount > 0) {
            await adminSupabase
              .from('student_fee_overrides')
              .insert({
                student_id: studentId,
                school_id: user.schoolId,
                fee_category_id: selectedClassFee.fee_category_id || null,
                discount_amount: feeConfigToApply.class_fee_discount,
                effective_from: effectiveFromDate,
                is_active: true,
                applied_by: user.id
              });
          }
        }

        // Set up transport
        if (transportEnabled && routeResult.data && !routeResult.error) {
          const route = routeResult.data;
          const transportCategory = transportCategoryResult?.data;

          // Create transport records in parallel
          const transportInserts = [
            adminSupabase
              .from('student_fee_profile')
              .insert({
                student_id: studentId,
                school_id: user.schoolId,
                transport_enabled: true,
                transport_route: route.route_name,
                effective_from: effectiveFromDate,
                is_active: true
              }),
            adminSupabase
              .from('student_transport')
              .insert({
                student_id: studentId,
                route_id: feeConfigToApply.transport_route_id,
                school_id: user.schoolId,
                is_active: true
              })
          ];

          // Add transport discount override if needed
          if (feeConfigToApply.transport_fee_discount > 0 && transportCategory) {
            transportInserts.push(
              adminSupabase
                .from('student_fee_overrides')
                .insert({
                  student_id: studentId,
                  school_id: user.schoolId,
                  fee_category_id: transportCategory.id,
                  discount_amount: feeConfigToApply.transport_fee_discount,
                  effective_from: effectiveFromDate,
                  is_active: true,
                  applied_by: user.id
                })
            );
          }

          const transportResults = await Promise.all(transportInserts);
          transportResults.forEach((result, index) => {
            if (result.error) {
              console.error(`[students-admin] Error creating transport record ${index}:`, result.error);
            }
          });
        } else if (!transportEnabled || !feeConfigToApply.transport_enabled) {
          // Transport disabled - create new fee profile version with transport disabled
          const { error: transportDisabledError } = await adminSupabase
            .from('student_fee_profile')
            .insert({
              student_id: studentId,
              school_id: user.schoolId,
              transport_enabled: false,
              effective_from: effectiveFromDate,
              is_active: true
            });

          if (transportDisabledError) {
            console.error('[students-admin] Error creating transport disabled profile:', transportDisabledError);
          }
        }

        // Set up other fees (Library, Admission, Lab, Sports, etc.)
        // Batch create overrides for enabled fees with discounts
        // Disabled fees won't have overrides, so they won't be charged
        if (feeConfigToApply.other_fees && feeConfigToApply.other_fees.length > 0) {
          const otherFeeOverrides = feeConfigToApply.other_fees
            .filter((otherFee: any) => otherFee.enabled && otherFee.discount > 0)
            .map((otherFee: any) => ({
              student_id: studentId,
              school_id: user.schoolId,
              fee_category_id: otherFee.fee_category_id,
              discount_amount: otherFee.discount,
              effective_from: effectiveFromDate,
              is_active: true,
              applied_by: user.id
            }));

          if (otherFeeOverrides.length > 0) {
            const { error: otherFeesError } = await adminSupabase
              .from('student_fee_overrides')
              .insert(otherFeeOverrides);

            if (otherFeesError) {
              console.error('[students-admin] Error creating other fee overrides:', otherFeesError);
            }
          }
        }

        // Set up custom fees (discounts and exemptions)
        // Batch fetch and insert for better performance
        if (feeConfigToApply.custom_fees && feeConfigToApply.custom_fees.length > 0) {
          const customFeeIds = feeConfigToApply.custom_fees
            .map((cf: any) => cf.custom_fee_id)
            .filter(Boolean);

          if (customFeeIds.length > 0) {
            // Batch fetch all custom fee definitions
            const { data: customFeeDefs, error: customFeeDefsError } = await adminSupabase
              .from('optional_fee_definitions')
              .select('id, amount, fee_cycle, fee_category_id')
              .in('id', customFeeIds)
              .eq('school_id', user.schoolId);

            if (!customFeeDefsError && customFeeDefs) {
              // Batch fetch all fee categories to verify they are custom type
              const feeCategoryIds = [...new Set(customFeeDefs.map((cf: any) => cf.fee_category_id).filter(Boolean))];
              const { data: categories } = await adminSupabase
                .from('fee_categories')
                .select('id, fee_type')
                .in('id', feeCategoryIds)
                .eq('fee_type', 'custom');

              const validCategoryIds = new Set((categories || []).map((c: any) => c.id));

              // Build batch inserts for custom fee overrides
              const customFeeOverrides: any[] = [];
              for (const customFee of feeConfigToApply.custom_fees) {
                const customFeeDef = customFeeDefs.find((cf: any) => cf.id === customFee.custom_fee_id);
                if (customFeeDef && validCategoryIds.has(customFeeDef.fee_category_id)) {
                  if (customFee.is_exempt) {
                    customFeeOverrides.push({
                      student_id: studentId,
                      school_id: user.schoolId,
                      fee_category_id: customFeeDef.fee_category_id,
                      is_full_free: true,
                      effective_from: effectiveFromDate,
                      is_active: true,
                      applied_by: user.id,
                      notes: `Custom fee exemption: ${customFee.custom_fee_id}`
                    });
                  } else if (customFee.discount > 0) {
                    customFeeOverrides.push({
                      student_id: studentId,
                      school_id: user.schoolId,
                      fee_category_id: customFeeDef.fee_category_id,
                      discount_amount: customFee.discount,
                      effective_from: effectiveFromDate,
                      is_active: true,
                      applied_by: user.id,
                      notes: `Custom fee discount: ${customFee.custom_fee_id}`
                    });
                  }
                }
              }

              if (customFeeOverrides.length > 0) {
                const { error: customFeesInsertError } = await adminSupabase
                  .from('student_fee_overrides')
                  .insert(customFeeOverrides);

                if (customFeesInsertError) {
                  console.error('[students-admin] Error creating custom fee overrides:', customFeesInsertError);
                }
              }
            }
          }
        }
      }
    }

    console.log('[students-admin] Student updated successfully:', updatedStudent);
    
    // Invalidate cache after student update
    await invalidateCache(`school:${user.schoolId}:principal:students:summary`);

    return res.json({ student: updatedStudent, message: 'Student updated successfully' });
  } catch (err: any) {
    console.error('[students-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Promote/demote a student (move to different class)
router.post('/:studentId/promote', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { studentId } = req.params;
  const { target_class_id, section_id } = req.body;

  if (!target_class_id) {
    return res.status(400).json({ error: 'target_class_id is required' });
  }

  try {
    // Verify student belongs to the school
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, class_group_id')
      .eq('id', studentId)
      .eq('school_id', user.schoolId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found or access denied' });
    }

    // Verify target class belongs to the school
    const { data: targetClass, error: classError } = await adminSupabase
      .from('class_groups')
      .select('id, school_id, name')
      .eq('id', target_class_id)
      .eq('school_id', user.schoolId)
      .single();

    if (classError || !targetClass) {
      return res.status(400).json({ error: 'Invalid target class or access denied' });
    }

    // If section_id is provided, verify it belongs to the target class
    if (section_id) {
      const { data: section, error: sectionError } = await adminSupabase
        .from('sections')
        .select('id, class_group_id')
        .eq('id', section_id)
        .eq('class_group_id', target_class_id)
        .single();

      if (sectionError || !section) {
        return res.status(400).json({ error: 'Invalid section or section does not belong to the target class' });
      }
    }

    // Update student's class
    const updateData: any = {
      class_group_id: target_class_id
    };
    if (section_id) {
      updateData.section_id = section_id;
    } else {
      updateData.section_id = null; // Clear section if not provided
    }

    const { data: updatedStudent, error: updateError } = await adminSupabase
      .from('students')
      .update(updateData)
      .eq('id', studentId)
      .select()
      .single();

    if (updateError) {
      console.error('[students-admin] Error promoting student:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    console.log('[students-admin] Student promoted successfully:', {
      student_id: studentId,
      from_class: student.class_group_id,
      to_class: target_class_id
    });

    // Invalidate cache after student promotion
    await invalidateCache(`school:${user.schoolId}:principal:students:summary`);

    return res.json({
      student: updatedStudent,
      message: `Student moved to ${targetClass.name}`
    });
  } catch (err: any) {
    console.error('[students-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Promote entire class (bulk operation)
router.post('/class/:classId/promote', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { classId } = req.params;
  const { target_class_id, clear_sections } = req.body;

  if (!target_class_id) {
    return res.status(400).json({ error: 'target_class_id is required' });
  }

  try {
    // Verify source class belongs to the school
    const { data: sourceClass, error: sourceClassError } = await adminSupabase
      .from('class_groups')
      .select('id, school_id, name')
      .eq('id', classId)
      .eq('school_id', user.schoolId)
      .single();

    if (sourceClassError || !sourceClass) {
      return res.status(404).json({ error: 'Source class not found or access denied' });
    }

    // Verify target class belongs to the school
    const { data: targetClass, error: targetClassError } = await adminSupabase
      .from('class_groups')
      .select('id, school_id, name')
      .eq('id', target_class_id)
      .eq('school_id', user.schoolId)
      .single();

    if (targetClassError || !targetClass) {
      return res.status(400).json({ error: 'Invalid target class or access denied' });
    }

    // Get all students in the source class
    const { data: students, error: studentsError } = await adminSupabase
      .from('students')
      .select('id')
      .eq('class_group_id', classId)
      .eq('school_id', user.schoolId)
      .eq('status', 'active');

    if (studentsError) {
      return res.status(400).json({ error: studentsError.message });
    }

    if (!students || students.length === 0) {
      return res.status(400).json({ error: 'No active students found in the source class' });
    }

    // Update all students
    const updateData: any = {
      class_group_id: target_class_id
    };
    if (clear_sections) {
      updateData.section_id = null;
    }

    const { error: updateError } = await adminSupabase
      .from('students')
      .update(updateData)
      .eq('class_group_id', classId)
      .eq('school_id', user.schoolId)
      .eq('status', 'active');

    if (updateError) {
      console.error('[students-admin] Error promoting class:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    console.log('[students-admin] Class promoted successfully:', {
      from_class: sourceClass.name,
      to_class: targetClass.name,
      students_count: students.length
    });

    // Invalidate cache after class promotion
    await invalidateCache(`school:${user.schoolId}:principal:students:summary`);

    return res.json({
      message: `Successfully moved ${students.length} students from ${sourceClass.name} to ${targetClass.name}`,
      students_moved: students.length,
      from_class: sourceClass.name,
      to_class: targetClass.name
    });
  } catch (err: any) {
    console.error('[students-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

