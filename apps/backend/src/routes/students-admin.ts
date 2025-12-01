import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Get all students for principal/clerk (grouped by class) or students for teacher's assigned classes
router.get('/', requireRoles(['principal', 'clerk', 'teacher']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  const { class_group_id, subject_id, section_id } = req.query;

  // Use service role key to bypass RLS for admin operations
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);

  try {
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
        return res.status(400).json({ error: assignmentError.message });
      }

      if (!assignments || assignments.length === 0) {
        return res.json({ classes: [], unassigned: [], total_students: 0 });
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
        return res.json({ classes: [], unassigned: [], total_students: 0 });
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

    const { data: students, error } = await query.order('roll_number', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('[students-admin] Error fetching students:', error);
      return res.status(400).json({ error: error.message });
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

    studentsWithClasses.forEach((student: any) => {
      if (student.class_group_id && student.class_groups) {
        const classId = student.class_group_id;
        if (!studentsByClass[classId]) {
          studentsByClass[classId] = [];
        }
        studentsByClass[classId].push(student);
      } else {
        unassignedStudents.push(student);
      }
    });

    // Get class details for each class
    const classesWithStudents = Object.keys(studentsByClass).map(classId => {
      const classStudents = studentsByClass[classId];
      const firstStudent = classStudents[0];
      return {
        id: classId,
        name: firstStudent.class_groups?.name || 'Unknown Class',
        description: firstStudent.class_groups?.description || '',
        classifications: firstStudent.class_groups?.classifications || [],
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

    return res.json({
      classes: classesWithStudents,
      unassigned: unassignedStudents.map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        status: s.status,
        admission_date: s.admission_date,
        profile: s.profile
      })),
      total_students: studentsWithClasses.length
    });
  } catch (err: any) {
    console.error('[students-admin] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get student's current fee configuration
router.get('/:studentId/fee-config', requireRoles(['principal', 'clerk']), async (req, res) => {
  const { user } = req;
  if (!user) return res.status(500).json({ error: 'Server misconfigured' });

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
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

    return res.json({
      class_fee_id: selectedClassFeeId,
      class_fee_discount: classFeeDiscount,
      transport_enabled: feeProfile?.transport_enabled ?? true,
      transport_route_id: studentTransport?.route_id || null,
      transport_fee_discount: transportFeeDiscount,
      other_fees: otherFees
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

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
  const { studentId } = req.params;
  const { class_group_id, section_id, roll_number, fee_config } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Verify student belongs to the school
    const { data: student, error: studentError } = await adminSupabase
      .from('students')
      .select('id, school_id, profile_id, class_group_id')
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
      // This ensures historical fee data remains unchanged for past months
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Close all active fee profiles (set effective_to to yesterday, marking them as historical)
      // This preserves the fee history for past months
      const { error: profileCloseError } = await adminSupabase
        .from('student_fee_profile')
        .update({ 
          effective_to: yesterdayStr, 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .is('effective_to', null);

      if (profileCloseError) {
        console.error('[students-admin] Error closing old fee profiles:', profileCloseError);
      }

      // Close all active fee overrides (discounts, custom fees)
      // This preserves discount history for past months
      const { error: overrideCloseError } = await adminSupabase
        .from('student_fee_overrides')
        .update({ 
          effective_to: yesterdayStr, 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .is('effective_to', null);

      if (overrideCloseError) {
        console.error('[students-admin] Error closing old fee overrides:', overrideCloseError);
      }

      // Deactivate old student transport records (transport doesn't use effective dates)
      // Historical transport data is preserved in student_fee_profile
      const { error: transportDeactivateError } = await adminSupabase
        .from('student_transport')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .eq('school_id', user.schoolId)
        .eq('is_active', true);

      if (transportDeactivateError) {
        console.error('[students-admin] Error deactivating old transport:', transportDeactivateError);
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
          other_fees: []
        };
      }

      if (feeConfigToApply) {
        // Apply fee configuration (similar to add student logic)
        // Get default class fees
        const { data: classFees } = await adminSupabase
          .from('class_fee_defaults')
          .select(`
            *,
            fee_categories:fee_category_id(id, name, fee_type)
          `)
          .eq('class_group_id', finalClassId)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`);

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
                effective_from: today,
                is_active: true,
                applied_by: user.id
              });
          }
        }

        // Set up transport
        if (feeConfigToApply.transport_enabled && feeConfigToApply.transport_route_id) {
          const { data: route } = await adminSupabase
            .from('transport_routes')
            .select('id, route_name')
            .eq('id', feeConfigToApply.transport_route_id)
            .eq('school_id', user.schoolId)
            .single();

          if (route) {
            await adminSupabase
              .from('student_fee_profile')
              .insert({
                student_id: studentId,
                school_id: user.schoolId,
                transport_enabled: true,
                transport_route: route.route_name,
                effective_from: today,
                is_active: true
              });

            // Create student_transport record
            await adminSupabase
              .from('student_transport')
              .insert({
                student_id: studentId,
                route_id: feeConfigToApply.transport_route_id,
                school_id: user.schoolId,
                is_active: true
              });

            // Apply transport fee discount (create new versioned override)
            // If discount is 0, no override is created - student pays full transport fee
            if (feeConfigToApply.transport_fee_discount > 0) {
              const { data: transportCategory } = await adminSupabase
                .from('fee_categories')
                .select('id')
                .eq('school_id', user.schoolId)
                .eq('fee_type', 'transport')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

              if (transportCategory) {
                const { error: transportDiscountError } = await adminSupabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentId,
                    school_id: user.schoolId,
                    fee_category_id: transportCategory.id,
                    discount_amount: feeConfigToApply.transport_fee_discount,
                    effective_from: today, // New version starts today
                    is_active: true,
                    applied_by: user.id
                  });

                if (transportDiscountError) {
                  console.error('[students-admin] Error creating transport fee discount:', transportDiscountError);
                }
              }
            }
          }
        } else {
          // Transport disabled - create new fee profile version with transport disabled
          const { error: transportDisabledError } = await adminSupabase
            .from('student_fee_profile')
            .insert({
              student_id: studentId,
              school_id: user.schoolId,
              transport_enabled: false,
              effective_from: today, // New version starts today
              is_active: true
            });

          if (transportDisabledError) {
            console.error('[students-admin] Error creating transport disabled profile:', transportDisabledError);
          }
        }

        // Set up other fees (Library, Admission, Lab, Sports, etc.)
        // Create overrides for enabled fees with discounts
        // Disabled fees won't have overrides, so they won't be charged
        if (feeConfigToApply.other_fees && feeConfigToApply.other_fees.length > 0) {
          for (const otherFee of feeConfigToApply.other_fees) {
            if (otherFee.enabled) {
              // Create override if there's a discount, or if we need to track it
              // Note: If discount is 0 and enabled=true, no override is needed (uses default)
              // But if we want to explicitly track enabled fees, we could create a record with discount=0
              // For now, only create override if discount > 0
              if (otherFee.discount > 0) {
                const { error: otherFeeError } = await adminSupabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentId,
                    school_id: user.schoolId,
                    fee_category_id: otherFee.fee_category_id,
                    discount_amount: otherFee.discount,
                    effective_from: today,
                    is_active: true,
                    applied_by: user.id
                  });

                if (otherFeeError) {
                  console.error(`[students-admin] Error creating override for fee category ${otherFee.fee_category_id}:`, otherFeeError);
                }
              }
              // If enabled but discount=0, no override needed - fee will use default amount
            }
            // If disabled, no override is created - fee won't be charged
          }
        }
      }
    }

    console.log('[students-admin] Student updated successfully:', updatedStudent);
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

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
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

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient<any>(supabaseUrl, supabaseServiceKey);
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

