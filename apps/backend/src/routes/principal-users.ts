import { Router } from 'express';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';
import { requireRoles } from '../middleware/auth.js';
import { adminSupabase } from '../utils/supabaseAdmin.js';
import { invalidateCache } from '../utils/cache.js';

const router = Router();

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string;
const supabaseUrl = process.env.SUPABASE_URL as string;

// Use adminSupabase for all operations (already imported)
const supabase = adminSupabase;

// Schema for fee configuration when adding student
const feeConfigSchema = Joi.object({
  // Class fee selection and discount
  class_fee_id: Joi.string().uuid().allow('', null).optional(),
  class_fee_discount: Joi.number().min(0).default(0),
  
  // Transport configuration
  transport_enabled: Joi.boolean().default(true),
  transport_route_id: Joi.string().uuid().allow(null).optional(),
  transport_fee_discount: Joi.number().min(0).default(0),
  
  // Other fees configuration (array of fee category configurations)
  other_fees: Joi.array().items(Joi.object({
    fee_category_id: Joi.string().uuid().required(),
    enabled: Joi.boolean().default(true),
    discount: Joi.number().min(0).default(0)
  })).default([]),
  
  // Custom fees configuration (array of custom fee configurations)
  custom_fees: Joi.array().items(Joi.object({
    custom_fee_id: Joi.string().uuid().required(),
    discount: Joi.number().min(0).default(0),
    is_exempt: Joi.boolean().default(false)
  })).default([])
});

// Schema for adding student
const addStudentSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().required(),
  username: Joi.string().required(), // Username must be unique per school
  phone: Joi.string().allow('', null),
  roll_number: Joi.string().allow('', null),
  class_group_id: Joi.string().uuid().allow('', null),
  section_id: Joi.string().uuid().allow('', null),
  admission_date: Joi.string().allow('', null),
  gender: Joi.string().valid('male', 'female', 'other').allow('', null),
  date_of_birth: Joi.string().allow('', null), // ISO date string
  home_address: Joi.string().allow('', null),
  // Parent/Guardian information (mandatory)
  guardian_name: Joi.string().required(),
  guardian_phone: Joi.string().required(),
  guardian_email: Joi.string().email().allow('', null),
  guardian_relationship: Joi.string().default('parent'),
  // Fee configuration (optional - if not provided, defaults will be applied)
  fee_config: feeConfigSchema.optional()
});

// Schema for adding staff (clerk or teacher)
const addStaffSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().required(),
  role: Joi.string().valid('clerk', 'teacher').required(),
  phone: Joi.string().allow('', null),
  gender: Joi.string().valid('male', 'female', 'other').allow('', null),
  salary_start_date: Joi.date().optional().allow(null, '') // Optional: when salary should start (only for teachers)
});

// Get default fees for a class (for student enrollment UI)
router.get('/classes/:classId/default-fees', requireRoles(['principal']), async (req, res) => {
  const { classId } = req.params;
  const { user } = req;
  
  if (!user || !user.schoolId) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }


  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Get class fees (default fees for the class)
    // Get general class fees (where fee_category_id IS NULL) - these are the main class fees
    // Note: Simplified query - get all active fees regardless of effective dates
    // This ensures fees set by principal are always visible
    const { data: allClassFees, error: allClassFeesError } = await adminSupabase
      .from('class_fee_defaults')
      .select(`
        *,
        fee_categories:fee_category_id(id, name, description, fee_type)
      `)
      .eq('class_group_id', classId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (allClassFeesError) {
      console.error('[default-fees] Error fetching class fees:', allClassFeesError);
    }

    // Filter to only get general class fees (where fee_category_id is null)
    // This handles both null and undefined cases
    const classFees = (allClassFees || []).filter((cf: any) => 
      cf.fee_category_id === null || cf.fee_category_id === undefined
    );

    console.log(`[default-fees] Found ${allClassFees?.length || 0} total class fees for class ${classId}`);
    console.log(`[default-fees] Found ${classFees?.length || 0} general class fees (fee_category_id is null)`);
    if (allClassFees && allClassFees.length > 0) {
      console.log('[default-fees] Sample fee:', {
        id: allClassFees[0].id,
        fee_category_id: allClassFees[0].fee_category_id,
        amount: allClassFees[0].amount
      });
    }

    // 2. Get transport routes and their fees
    const { data: transportRoutes, error: transportRoutesError } = await adminSupabase
      .from('transport_routes')
      .select(`
        id,
        route_name,
        bus_number,
        zone,
        transport_fees:transport_fees!inner(
          id,
          base_fee,
          escort_fee,
          fuel_surcharge,
          fee_cycle,
          is_active
        )
      `)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .order('route_name');

    if (transportRoutesError) {
      console.error('[default-fees] Error fetching transport routes:', transportRoutesError);
    }

    // 3. Get all other fee categories with their amounts from class_fee_defaults or optional_fee_definitions
    const { data: feeCategories, error: categoriesError } = await adminSupabase
      .from('fee_categories')
      .select('id, name, description, fee_type, code, is_active, display_order')
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .neq('fee_type', 'transport') // Exclude transport as it's handled separately
      .order('name');

    if (categoriesError) {
      console.error('[default-fees] Error fetching fee categories:', categoriesError);
    }

    // 4. Get optional fee definitions for this class (fetch before using it)
    const { data: optionalFees, error: optionalFeesError } = await adminSupabase
      .from('optional_fee_definitions')
      .select(`
        *,
        fee_categories:fee_category_id(id, name, description, fee_type)
      `)
      .eq('class_group_id', classId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('created_at', { ascending: false });

    if (optionalFeesError) {
      console.error('[default-fees] Error fetching optional fees:', optionalFeesError);
    }

    // 5. Get custom fees (optional_fee_definitions where fee_category has fee_type='custom')
    // First, get all custom fee category IDs for this school
    const { data: customCategories, error: catError } = await supabase
      .from('fee_categories')
      .select('id')
      .eq('school_id', user.schoolId)
      .eq('fee_type', 'custom')
      .eq('is_active', true);

    let customFees: any[] = [];
    if (!catError && customCategories && customCategories.length > 0) {
      const customCategoryIds = customCategories.map((cat: any) => cat.id);
      
      // Now get optional_fee_definitions filtered by custom category IDs
      const { data: customFeesData, error: customFeesDataError } = await adminSupabase
        .from('optional_fee_definitions')
        .select(`
          *,
          class_groups:class_group_id(id, name),
          fee_categories:fee_category_id(id, name, description, fee_type)
        `)
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .in('fee_category_id', customCategoryIds)
        .or(`class_group_id.eq.${classId},class_group_id.is.null`) // This class OR all classes
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('created_at', { ascending: false });
      
      if (!customFeesDataError) {
        customFees = customFeesData || [];
      } else {
        console.error('[default-fees] Error fetching custom fees:', customFeesDataError);
      }
    }

    console.log(`[default-fees] Found ${customFees.length || 0} custom fees for class ${classId}`);

    // Get fee amounts for other categories from class_fee_defaults (for this class)
    // This is for fees that have a specific category (Library, Lab, etc.) - excludes general tuition fees
    const { data: otherClassFees, error: otherClassFeesError } = await adminSupabase
      .from('class_fee_defaults')
      .select(`
        *,
        fee_categories:fee_category_id(id, name, description, fee_type)
      `)
      .eq('class_group_id', classId)
      .eq('school_id', user.schoolId)
      .eq('is_active', true)
      .or(`effective_from.is.null,effective_from.lte.${today}`)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .not('fee_category_id', 'is', null); // Only fees with categories (not general class fees)

    if (otherClassFeesError) {
      console.error('[default-fees] Error fetching other class fees:', otherClassFeesError);
    }

    // Combine fee categories with their amounts
    // Show all fee categories, even if they don't have amounts yet (principal can still enable/disable them)
    const otherFeesWithAmounts = (feeCategories || []).map((category: any) => {
      // Find if there's a class fee default for this category
      const classFeeForCategory = (otherClassFees || []).find((cf: any) => 
        cf.fee_category_id === category.id
      );
      
      // If not found in class_fee_defaults, check optional_fee_definitions
      const optionalFeeForCategory = (optionalFees || []).find((of: any) => 
        of.fee_category_id === category.id
      );

      return {
        ...category,
        amount: classFeeForCategory ? parseFloat(classFeeForCategory.amount || 0) : 
                optionalFeeForCategory ? parseFloat(optionalFeeForCategory.amount || 0) : 0,
        fee_cycle: classFeeForCategory?.fee_cycle || optionalFeeForCategory?.fee_cycle || 'monthly',
        class_fee_id: classFeeForCategory?.id || null,
        optional_fee_id: optionalFeeForCategory?.id || null
      };
    }); // Removed filter - show all fee categories so principal can see and configure them

    return res.json({
      class_fees: classFees || [],
      transport_routes: (transportRoutes || []).map((route: any) => ({
        id: route.id,
        route_name: route.route_name,
        bus_number: route.bus_number,
        zone: route.zone,
        fee: route.transport_fees && route.transport_fees.length > 0 ? {
          base_fee: route.transport_fees[0].base_fee,
          escort_fee: route.transport_fees[0].escort_fee || 0,
          fuel_surcharge: route.transport_fees[0].fuel_surcharge || 0,
          total: (parseFloat(route.transport_fees[0].base_fee || 0) + 
                 parseFloat(route.transport_fees[0].escort_fee || 0) + 
                 parseFloat(route.transport_fees[0].fuel_surcharge || 0)),
          fee_cycle: route.transport_fees[0].fee_cycle
        } : null
      })),
      other_fee_categories: otherFeesWithAmounts || [],
      optional_fees: optionalFees || [],
      custom_fees: customFees || []
    });
  } catch (err: any) {
    console.error('[default-fees] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Check if username is available
router.get('/check-username/:username', requireRoles(['principal']), async (req, res) => {
  const { username } = req.params;
  const { user } = req;
  
  if (!user || !user.schoolId) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!username || username.trim().length === 0) {
    return res.json({ available: false, message: 'Username cannot be empty' });
  }


  try {
    // Check if username already exists in this school
    const { data: existingProfile, error } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (error) {
      console.error('[check-username] Error checking username:', error);
      return res.status(500).json({ error: 'Failed to check username availability' });
    }

    const available = !existingProfile;
    return res.json({ 
      available,
      message: available ? 'Username is available' : 'Username already exists'
    });
  } catch (err: any) {
    console.error('[check-username] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Principal adds a student
router.post('/students', requireRoles(['principal']), async (req, res) => {
  const { error, value } = addStudentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    // Check if username already exists in this school
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', value.username)
      .eq('school_id', user.schoolId)
      .single();

    if (existingProfile) {
      return res.status(400).json({ error: 'Username already exists in this school. Please choose a different username.' });
    }

    // For students, email can be duplicated within the same school (e.g., siblings)
    // But Supabase Auth requires unique emails globally, so we generate a unique email for auth
    // while storing the original email in the profile
    let authEmail = value.email;
    let emailSuffix = 1;
    
    // Check if email already exists in auth, and if so, generate a unique one
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some((u: any) => u.email === authEmail);
    
    if (emailExists) {
      // Generate unique email for auth: email+username@domain or email.username@domain
      const emailParts = value.email.split('@');
      if (emailParts.length === 2) {
        const [localPart, domain] = emailParts;
        // Use username to make it unique
        authEmail = `${localPart}+${value.username}@${domain}`;
        
        // If that still exists, add a number
        let stillExists = existingUsers?.users?.some((u: any) => u.email === authEmail);
        while (stillExists && emailSuffix < 100) {
          authEmail = `${localPart}+${value.username}${emailSuffix}@${domain}`;
          stillExists = existingUsers?.users?.some((u: any) => u.email === authEmail);
          emailSuffix++;
        }
      }
    }

    // Create auth user with potentially modified email
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: authEmail,
      password: value.password,
      email_confirm: true,
      user_metadata: { role: 'student', school_id: user.schoolId }
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Failed to create user' });
    }

    // Create profile (auto-approved for principal-added users)
    const profileData: any = {
      id: authData.user.id,
      role: 'student',
      school_id: user.schoolId,
      full_name: value.full_name,
      email: value.email,
      username: value.username, // Add username
      phone: value.phone || null,
      approval_status: 'approved',
      gender: value.gender || null
    };

    const { error: profileError } = await adminSupabase.from('profiles').insert(profileData);

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    // Create student record
    const studentData: any = {
      profile_id: authData.user.id,
      school_id: user.schoolId,
      status: 'active',
      roll_number: value.roll_number || null,
      admission_date: value.admission_date || null,
      date_of_birth: value.date_of_birth || null,
      home_address: value.home_address || null
    };

    if (value.class_group_id) {
      studentData.class_group_id = value.class_group_id;
    }
    if (value.section_id) {
      studentData.section_id = value.section_id;
    }

    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .insert(studentData)
      .select()
      .single();

    if (studentError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      await adminSupabase.from('profiles').delete().eq('id', authData.user.id);
      return res.status(400).json({ error: `Failed to create student record: ${studentError.message}` });
    }

    // Create parent/guardian profile
    // Generate unique email for guardian if needed
    let guardianAuthEmail = value.guardian_email || `${value.guardian_phone}@guardian.local`;
    const { data: existingGuardianUsers } = await adminSupabase.auth.admin.listUsers();
    const guardianEmailExists = existingGuardianUsers?.users?.some((u: any) => u.email === guardianAuthEmail);
    
    if (guardianEmailExists || !value.guardian_email) {
      // Generate unique email
      const emailParts = guardianAuthEmail.split('@');
      if (emailParts.length === 2) {
        const [localPart, domain] = emailParts;
        guardianAuthEmail = `${localPart}+${value.username}_guardian@${domain}`;
        let stillExists = existingGuardianUsers?.users?.some((u: any) => u.email === guardianAuthEmail);
        let emailSuffix = 1;
        while (stillExists && emailSuffix < 100) {
          guardianAuthEmail = `${localPart}+${value.username}_guardian${emailSuffix}@${domain}`;
          stillExists = existingGuardianUsers?.users?.some((u: any) => u.email === guardianAuthEmail);
          emailSuffix++;
        }
      }
    }

    // Create guardian auth user
    const { data: guardianAuthData, error: guardianAuthError } = await adminSupabase.auth.admin.createUser({
      email: guardianAuthEmail,
      password: `Guardian${value.guardian_phone.slice(-4)}!`, // Default password based on phone
      email_confirm: true,
      user_metadata: { role: 'parent', school_id: user.schoolId }
    });

    if (guardianAuthError || !guardianAuthData.user) {
      // Log error but continue - guardian can be added later
      console.error('[principal-users] Error creating guardian auth:', guardianAuthError);
    } else {
      // Create guardian profile
      const guardianProfileData: any = {
        id: guardianAuthData.user.id,
        role: 'parent',
        school_id: user.schoolId,
        full_name: value.guardian_name,
        email: value.guardian_email || guardianAuthEmail,
        phone: value.guardian_phone,
        approval_status: 'approved'
      };

      const { error: guardianProfileError } = await supabase
        .from('profiles')
        .insert(guardianProfileData);

      if (guardianProfileError) {
        console.error('[principal-users] Error creating guardian profile:', guardianProfileError);
        // Clean up guardian auth if profile creation fails
        if (guardianAuthData.user) {
          await adminSupabase.auth.admin.deleteUser(guardianAuthData.user.id);
        }
      } else {
        // Link guardian to student
        const { error: guardianLinkError } = await supabase
          .from('student_guardians')
          .insert({
            student_id: studentRecord.id,
            guardian_profile_id: guardianAuthData.user.id,
            relationship: value.guardian_relationship || 'parent'
          });

        if (guardianLinkError) {
          console.error('[principal-users] Error linking guardian to student:', guardianLinkError);
        }
      }
    }

    // ============================================
    // FEE CONFIGURATION SETUP
    // ============================================
    if (value.class_group_id && value.fee_config) {
      // Use admission_date if available, otherwise use today
      const effectiveFromDate = value.admission_date || new Date().toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0]; // Still needed for querying active class fees
      const feeConfig = value.fee_config;

      try {
        // 1. Get default class fees
        const { data: classFees, error: classFeesError } = await supabase
          .from('class_fee_defaults')
          .select(`
            *,
            fee_categories:fee_category_id(id, name, fee_type)
          `)
          .eq('class_group_id', value.class_group_id)
          .eq('school_id', user.schoolId)
          .eq('is_active', true)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`);

        if (!classFeesError && classFees && classFees.length > 0) {
          // Use selected class fee ID if provided, otherwise find tuition/class fee category
          let selectedClassFee = null;
          
          if (feeConfig.class_fee_id) {
            // Find the specific class fee by ID
            selectedClassFee = classFees.find((cf: any) => cf.id === feeConfig.class_fee_id);
          } else {
            // Fallback: Find tuition/class fee category (default behavior)
            selectedClassFee = classFees.find((cf: any) => 
              cf.fee_categories?.fee_type === 'tuition' || !cf.fee_category_id
            );
          }

          // Apply class fee discount if provided and class fee is selected
          if (selectedClassFee && feeConfig.class_fee_discount > 0) {
            const { error: overrideError } = await supabase
              .from('student_fee_overrides')
              .insert({
                student_id: studentRecord.id,
                school_id: user.schoolId,
                fee_category_id: selectedClassFee.fee_category_id || null,
                discount_amount: feeConfig.class_fee_discount,
                effective_from: effectiveFromDate,
                is_active: true,
                applied_by: user.id
              });

            if (overrideError) {
              console.error('[principal-users] Error creating class fee discount:', overrideError);
            }
          }
        }

        // 2. Set up transport fee profile
        if (feeConfig.transport_enabled && feeConfig.transport_route_id) {
          // Verify route exists and get route details
          const { data: route, error: routeError } = await supabase
            .from('transport_routes')
            .select('id, route_name')
            .eq('id', feeConfig.transport_route_id)
            .eq('school_id', user.schoolId)
            .single();

          if (!routeError && route) {
            // Create student fee profile for transport
            const { error: profileError } = await supabase
              .from('student_fee_profile')
              .insert({
                student_id: studentRecord.id,
                school_id: user.schoolId,
                transport_enabled: true,
                transport_route: route.route_name,
                effective_from: effectiveFromDate,
                is_active: true
              });

            if (profileError) {
              console.error('[principal-users] Error creating transport profile:', profileError);
            }

            // Get transport fee for this route
            const { data: transportFee, error: transportFeeError } = await supabase
              .from('transport_fees')
              .select('*, transport_routes:route_id(id, route_name)')
              .eq('route_id', feeConfig.transport_route_id)
              .eq('school_id', user.schoolId)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            // Apply transport fee discount if provided
            if (!transportFeeError && transportFee && feeConfig.transport_fee_discount > 0) {
              // Find transport fee category
              const { data: transportCategory } = await supabase
                .from('fee_categories')
                .select('id')
                .eq('school_id', user.schoolId)
                .eq('fee_type', 'transport')
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

              if (transportCategory) {
                const { error: transportDiscountError } = await supabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentRecord.id,
                    school_id: user.schoolId,
                    fee_category_id: transportCategory.id,
                    discount_amount: feeConfig.transport_fee_discount,
                    effective_from: effectiveFromDate,
                    is_active: true,
                    applied_by: user.id
                  });

                if (transportDiscountError) {
                  console.error('[principal-users] Error creating transport fee discount:', transportDiscountError);
                }
              }
            }
          }
        } else if (!feeConfig.transport_enabled) {
          // Disable transport
          const { error: profileError } = await supabase
            .from('student_fee_profile')
            .insert({
              student_id: studentRecord.id,
              school_id: user.schoolId,
              transport_enabled: false,
              effective_from: effectiveFromDate,
              is_active: true
            });

          if (profileError) {
            console.error('[principal-users] Error creating transport profile (disabled):', profileError);
          }
        }

        // 3. Set up other fees (Library, Admission, Lab, Sports, etc.)
        if (feeConfig.other_fees && feeConfig.other_fees.length > 0) {
          for (const otherFee of feeConfig.other_fees) {
            if (otherFee.enabled) {
              // Apply discount if provided
              if (otherFee.discount > 0) {
                const { error: otherFeeDiscountError } = await supabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentRecord.id,
                    school_id: user.schoolId,
                    fee_category_id: otherFee.fee_category_id,
                    discount_amount: otherFee.discount,
                    effective_from: effectiveFromDate,
                    is_active: true,
                    applied_by: user.id
                  });

                if (otherFeeDiscountError) {
                  console.error('[principal-users] Error creating other fee discount:', otherFeeDiscountError);
                }
              }
            } else {
              // Disable this fee category (set to full free)
              const { error: disableFeeError } = await supabase
                .from('student_fee_overrides')
                .insert({
                  student_id: studentRecord.id,
                  school_id: user.schoolId,
                  fee_category_id: otherFee.fee_category_id,
                  is_full_free: true,
                  effective_from: effectiveFromDate,
                  is_active: true,
                  applied_by: user.id
                });

              if (disableFeeError) {
                console.error('[principal-users] Error disabling fee:', disableFeeError);
              }
            }
          }
        }

        // 4. Set up custom fees (discounts and exemptions)
        if (feeConfig.custom_fees && feeConfig.custom_fees.length > 0) {
          for (const customFee of feeConfig.custom_fees) {
              // Get the custom fee definition to verify it exists
            // First verify it's a custom fee by checking the category
            const { data: customFeeDef, error: customFeeDefError } = await supabase
              .from('optional_fee_definitions')
              .select('id, amount, fee_cycle, fee_category_id')
              .eq('id', customFee.custom_fee_id)
              .eq('school_id', user.schoolId)
              .single();

            if (!customFeeDefError && customFeeDef) {
              // Verify the category is a custom fee type
              const { data: category } = await supabase
                .from('fee_categories')
                .select('fee_type')
                .eq('id', customFeeDef.fee_category_id)
                .eq('fee_type', 'custom')
                .single();

              if (!category) {
                continue; // Skip if not a custom fee
              }

              // If exempt, mark as full free
              if (customFee.is_exempt) {
                const { error: exemptError } = await supabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentRecord.id,
                    school_id: user.schoolId,
                    fee_category_id: customFeeDef.fee_category_id, // Use the custom fee's category ID
                    is_full_free: true,
                    effective_from: effectiveFromDate,
                    is_active: true,
                    applied_by: user.id,
                    notes: `Custom fee exemption: ${customFee.custom_fee_id}`
                  });

                if (exemptError) {
                  console.error('[principal-users] Error creating custom fee exemption:', exemptError);
                }
              } else if (customFee.discount > 0) {
                // Apply discount if provided
                const { error: customFeeDiscountError } = await supabase
                  .from('student_fee_overrides')
                  .insert({
                    student_id: studentRecord.id,
                    school_id: user.schoolId,
                    fee_category_id: customFeeDef.fee_category_id, // Use the custom fee's category ID
                    discount_amount: customFee.discount,
                    effective_from: effectiveFromDate,
                    is_active: true,
                    applied_by: user.id,
                    notes: `Custom fee discount: ${customFee.custom_fee_id}`
                  });

                if (customFeeDiscountError) {
                  console.error('[principal-users] Error creating custom fee discount:', customFeeDiscountError);
                }
              }
            }
          }
        }
      } catch (feeErr: any) {
        // Log fee configuration errors but don't fail student creation
        console.error('[principal-users] Error setting up fee configuration:', feeErr);
      }
    }

    // Invalidate cache after student creation
    await invalidateCache(`school:${user.schoolId}:principal:students:summary`);

    return res.status(201).json({
      message: 'Student added successfully',
      user: { id: authData.user.id, email: value.email, full_name: value.full_name }
    });
  } catch (err: any) {
    console.error('[principal-users] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Get all staff members for the school (with pagination and filters)
router.get('/staff', requireRoles(['principal']), async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  if (!user.schoolId) {
    return res.status(403).json({ error: 'School scope required' });
  }

  try {
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    // Parse filters
    const role = req.query.role as string || 'all';
    const status = req.query.status as string || 'all'; // approval_status filter

    // Build query with adminSupabase to bypass RLS for principal
    // Explicit, school-scoped select (no select('*'))
    let query = adminSupabase
      .from('profiles')
      .select(
        `
        id,
        full_name,
        email,
        role,
        is_active,
        approval_status,
        phone,
        created_at
        `,
        { count: 'exact' }
      )
      .eq('school_id', user.schoolId) // Filter by school_id explicitly (multi-tenant safety)
      .in('role', ['teacher', 'clerk']); // Only staff roles, no principals in this listing

    // Apply role filter only when not "all"
    if (role !== 'all') {
      query = query.eq('role', role);
    }

    // Apply approval_status filter only when not "all"
    if (status !== 'all') {
      query = query.eq('approval_status', status);
    }

    // Apply pagination using range (NOT offset + limit, but offset to offset + limit - 1)
    query = query.range(offset, offset + limit - 1);

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: staff, error, count } = await query;

    if (error) {
      console.error('[principal-users/staff] Error fetching staff:', error);
      console.error('[principal-users/staff] Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return res.status(400).json({ error: error.message || 'Failed to fetch staff' });
    }

    console.log(`[principal-users/staff] Found ${staff?.length || 0} staff members (total: ${count || 0}) for school ${user.schoolId}`);

    return res.json({
      staff: staff || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: any) {
    console.error('[principal-users/staff] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Principal adds a staff member (clerk or teacher)
router.post('/staff', requireRoles(['principal']), async (req, res) => {
  const { error, value } = addStaffSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { user } = req;
  if (!user || !user.schoolId) return res.status(500).json({ error: 'Server misconfigured' });


  try {
    // Check if email already exists
    const { data: existingUser } = await adminSupabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.find((u: any) => u.email === value.email);
    if (userExists) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Create auth user
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: value.email,
      password: value.password,
      email_confirm: true,
      user_metadata: { role: value.role, school_id: user.schoolId }
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || 'Failed to create user' });
    }

    // Create profile (auto-approved for principal-added users)
    const profileData: any = {
      id: authData.user.id,
      role: value.role, // clerk or teacher
      school_id: user.schoolId,
      full_name: value.full_name,
      email: value.email,
      phone: value.phone || null,
      approval_status: 'approved',
      gender: value.gender || null
    };

    const { error: profileError } = await adminSupabase.from('profiles').insert(profileData);

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: profileError.message });
    }

    // For teachers: If salary_start_date is provided, we note it but don't create salary structure yet
    // The principal will set the salary structure separately with the actual salary amounts
    // The salary_start_date can be used as the default effective_from_date when setting salary structure
    
    return res.status(201).json({
      message: `${value.role === 'clerk' ? 'Clerk' : 'Teacher'} added successfully`,
      user: { 
        id: authData.user.id, 
        email: value.email, 
        full_name: value.full_name, 
        role: value.role,
        salary_start_date: value.role === 'teacher' && value.salary_start_date ? value.salary_start_date : undefined
      }
    });
  } catch (err: any) {
    console.error('[principal-users] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;

