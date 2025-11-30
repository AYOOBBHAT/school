/**
 * Comprehensive Fee Billing Engine
 * Handles class defaults, student overrides, scholarships, discounts, and bill generation
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/**
 * Get class default fees for a student (using versioned fees)
 * Returns fees active for the billing period date
 */
export async function getClassDefaultFees(studentId, classGroupId, schoolId, periodDate, adminSupabase) {
    const dateStr = periodDate.toISOString().split('T')[0];
    // Get all fee categories for this class
    const { data: categories, error: catError } = await adminSupabase
        .from('class_fee_versions')
        .select(`
      fee_category_id,
      fee_cycle,
      fee_categories:fee_category_id(
        id,
        name,
        code,
        fee_type
      )
    `)
        .eq('class_group_id', classGroupId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
        .order('fee_categories.name');
    if (catError) {
        console.error('[getClassDefaultFees] Error getting categories:', catError);
        throw new Error(`Failed to get fee categories: ${catError.message}`);
    }
    // Get unique category+cycle combinations
    const uniqueCombos = new Map();
    (categories || []).forEach((cat) => {
        const key = `${cat.fee_category_id}_${cat.fee_cycle}`;
        if (!uniqueCombos.has(key)) {
            uniqueCombos.set(key, cat);
        }
    });
    // Get latest version for each combination
    const fees = [];
    for (const [key, cat] of uniqueCombos) {
        const { data: version, error: versionError } = await adminSupabase
            .from('class_fee_versions')
            .select('*')
            .eq('class_group_id', classGroupId)
            .eq('fee_category_id', cat.fee_category_id)
            .eq('fee_cycle', cat.fee_cycle)
            .eq('is_active', true)
            .lte('effective_from_date', dateStr)
            .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (versionError && versionError.code !== 'PGRST116') {
            console.error('[getClassDefaultFees] Error getting version:', versionError);
            continue;
        }
        if (version) {
            fees.push({
                fee_category_id: cat.fee_category_id,
                category_name: cat.fee_categories?.name || 'Unknown',
                amount: parseFloat(version.amount) || 0,
                fee_cycle: cat.fee_cycle,
                version_number: version.version_number
            });
        }
    }
    return fees;
}
/**
 * Get student fee profile (overrides, transport settings, etc.)
 */
export async function getStudentFeeProfile(studentId, schoolId, periodDate, adminSupabase) {
    // Get active fee profile
    const { data: profile, error: profileError } = await adminSupabase
        .from('student_fee_profile')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .lte('effective_from', periodDate.toISOString().split('T')[0])
        .or(`effective_to.is.null,effective_to.gte.${periodDate.toISOString().split('T')[0]}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
    // Get fee overrides
    const { data: overrides, error: overridesError } = await adminSupabase
        .from('student_fee_overrides')
        .select(`
      fee_category_id,
      override_amount,
      fee_categories:fee_category_id(name)
    `)
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .lte('effective_from', periodDate.toISOString().split('T')[0])
        .or(`effective_to.is.null,effective_to.gte.${periodDate.toISOString().split('T')[0]}`);
    // Custom fees and optional fees removed - no longer used
    const feeOverridesMap = new Map();
    (overrides || []).forEach((o) => {
        feeOverridesMap.set(o.fee_category_id, parseFloat(o.override_amount) || 0);
    });
    return {
        transport_enabled: profile?.transport_enabled ?? true,
        transport_route: profile?.transport_route || null,
        transport_fee_override: profile?.transport_fee_override ? parseFloat(profile.transport_fee_override) : null,
        tuition_fee_cycle: profile?.tuition_fee_cycle || null,
        transport_fee_cycle: profile?.transport_fee_cycle || null,
        fee_overrides: feeOverridesMap,
        custom_fees: [], // Removed
        optional_fees: [] // Removed
    };
}
/**
 * Get transport fee for student
 */
export async function getTransportFee(studentId, classGroupId, schoolId, periodDate, studentProfile, adminSupabase) {
    // If transport disabled, return 0
    if (!studentProfile.transport_enabled) {
        return 0;
    }
    // If override amount exists, use it
    if (studentProfile.transport_fee_override !== null) {
        return studentProfile.transport_fee_override;
    }
    // Get transport fee version active for this date
    const dateStr = periodDate.toISOString().split('T')[0];
    let query = adminSupabase
        .from('transport_fee_versions')
        .select('amount')
        .eq('class_group_id', classGroupId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
        .order('version_number', { ascending: false })
        .limit(1);
    // If route specified, filter by route
    if (studentProfile.transport_route) {
        query = query.eq('route_name', studentProfile.transport_route);
    }
    else {
        query = query.is('route_name', null);
    }
    const { data: transportFee, error } = await query.maybeSingle();
    if (error) {
        console.error('[getTransportFee] Error:', error);
        return 0;
    }
    return transportFee ? parseFloat(transportFee.amount) || 0 : 0;
}
/**
 * Get scholarships/discounts for student
 */
export async function getStudentScholarships(studentId, schoolId, periodDate, adminSupabase) {
    const { data: scholarships, error } = await adminSupabase
        .from('scholarships')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq('status', 'approved')
        .lte('effective_from', periodDate.toISOString().split('T')[0])
        .or(`effective_to.is.null,effective_to.gte.${periodDate.toISOString().split('T')[0]}`)
        .order('effective_from', { ascending: false });
    if (error) {
        console.error('[getStudentScholarships] Error:', error);
        return [];
    }
    return (scholarships || []).map((s) => ({
        scholarship_type: s.scholarship_type,
        applies_to: s.applies_to,
        fee_category_id: s.fee_category_id || null,
        discount_percentage: s.discount_percentage ? parseFloat(s.discount_percentage) : null,
        discount_amount: s.discount_amount ? parseFloat(s.discount_amount) : null
    }));
}
/**
 * Calculate fee with scholarships applied
 */
function applyScholarships(baseAmount, feeCategoryId, feeType, scholarships) {
    let totalDiscount = 0;
    for (const scholarship of scholarships) {
        // Check if scholarship applies to this fee
        let applies = false;
        if (scholarship.applies_to === 'all') {
            applies = true;
        }
        else if (scholarship.applies_to === 'tuition_only' && feeType === 'tuition') {
            applies = true;
        }
        else if (scholarship.applies_to === 'transport_only' && feeType === 'transport') {
            applies = true;
        }
        else if (scholarship.applies_to === 'specific_category' && scholarship.fee_category_id === feeCategoryId) {
            applies = true;
        }
        if (!applies)
            continue;
        // Apply discount
        if (scholarship.scholarship_type === 'full_waiver') {
            totalDiscount = baseAmount; // 100% discount
            break;
        }
        else if (scholarship.scholarship_type === 'percentage' && scholarship.discount_percentage) {
            const discount = (baseAmount * scholarship.discount_percentage) / 100;
            totalDiscount += discount;
        }
        else if (scholarship.scholarship_type === 'fixed' && scholarship.discount_amount) {
            totalDiscount += scholarship.discount_amount;
        }
    }
    // Cap discount at base amount
    totalDiscount = Math.min(totalDiscount, baseAmount);
    const finalAmount = Math.max(0, baseAmount - totalDiscount);
    return {
        discountAmount: totalDiscount,
        finalAmount
    };
}
/**
 * Calculate student fees for a billing period
 */
export async function calculateStudentFees(studentId, classGroupId, schoolId, periodType, periodDate, adminSupabase) {
    // Get class defaults
    const classDefaults = await getClassDefaultFees(studentId, classGroupId, schoolId, periodDate, adminSupabase);
    // Get student profile
    const studentProfile = await getStudentFeeProfile(studentId, schoolId, periodDate, adminSupabase);
    // Get scholarships
    const scholarships = await getStudentScholarships(studentId, schoolId, periodDate, adminSupabase);
    // Get transport fee
    const transportFee = await getTransportFee(studentId, classGroupId, schoolId, periodDate, studentProfile, adminSupabase);
    const billItems = [];
    let totalAmount = 0;
    let totalDiscount = 0;
    // Process class default fees
    for (const defaultFee of classDefaults) {
        // Skip if fee cycle doesn't match
        if (defaultFee.fee_cycle !== periodType && defaultFee.fee_cycle !== 'per-bill') {
            continue;
        }
        // Get fee category type
        const { data: category } = await adminSupabase
            .from('fee_categories')
            .select('fee_type, name')
            .eq('id', defaultFee.fee_category_id)
            .single();
        const feeType = category?.fee_type || 'custom';
        // Skip transport if disabled or if it's transport fee
        if (feeType === 'transport') {
            if (!studentProfile.transport_enabled) {
                continue; // Skip transport fee
            }
            // Use calculated transport fee instead
            if (transportFee > 0) {
                const transportDiscount = applyScholarships(transportFee, defaultFee.fee_category_id, 'transport', scholarships);
                billItems.push({
                    fee_category_id: defaultFee.fee_category_id,
                    item_name: category?.name || 'Transport Fee',
                    item_type: 'transport',
                    base_amount: transportFee,
                    discount_amount: transportDiscount.discountAmount,
                    final_amount: transportDiscount.finalAmount
                });
                totalAmount += transportFee;
                totalDiscount += transportDiscount.discountAmount;
            }
            continue;
        }
        // Get base amount (use override if exists)
        const baseAmount = studentProfile.fee_overrides.get(defaultFee.fee_category_id) || defaultFee.amount;
        // Apply scholarships
        const discount = applyScholarships(baseAmount, defaultFee.fee_category_id, feeType, scholarships);
        billItems.push({
            fee_category_id: defaultFee.fee_category_id,
            item_name: defaultFee.category_name,
            item_type: feeType === 'tuition' ? 'tuition' : 'custom',
            base_amount: baseAmount,
            discount_amount: discount.discountAmount,
            final_amount: discount.finalAmount
        });
        totalAmount += baseAmount;
        totalDiscount += discount.discountAmount;
    }
    // Optional fees and custom fees removed - no longer used
    const finalAmount = totalAmount - totalDiscount;
    return {
        billItems,
        totalAmount,
        totalDiscount,
        finalAmount: Math.max(0, finalAmount)
    };
}
/**
 * Generate fee bill for a student
 */
export async function generateFeeBill(studentId, classGroupId, schoolId, periodType, periodStart, periodEnd, periodLabel, dueDate, generatedBy, adminSupabase) {
    // Calculate fees
    const feeCalculation = await calculateStudentFees(studentId, classGroupId, schoolId, periodType, periodStart, adminSupabase);
    // Generate bill number
    const billNumber = `BILL-${schoolId.substring(0, 8)}-${Date.now()}`;
    // Fee bills removed - this function is no longer used
    throw new Error('Fee bills have been removed from the system');
}
/**
 * Calculate fine for overdue bill
 */
export async function calculateFine(billId, schoolId, adminSupabase) {
    // Fee bills removed - this function is no longer used
    return 0;
}
