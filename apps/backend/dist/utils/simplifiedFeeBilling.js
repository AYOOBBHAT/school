/**
 * Simplified Fee Billing Engine
 * Implements the correct industry-level fee system that supports:
 * - Discounts per fee category
 * - Custom fees per category
 * - Full free scholarships
 * - Extensible for any fee category
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/**
 * Get student fee override for a specific category
 * Returns discount, custom fee, and full free status
 */
async function getStudentFeeOverride(studentId, feeCategoryId, periodDate, adminSupabase) {
    const dateStr = periodDate.toISOString().split('T')[0];
    // Check for full free override (fee_category_id is null means applies to all)
    const { data: fullFreeOverride } = await adminSupabase
        .from('student_fee_overrides')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_full_free', true)
        .is('fee_category_id', null)
        .eq('is_active', true)
        .lte('effective_from', dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .limit(1)
        .maybeSingle();
    // If full free applies to all, return early
    if (fullFreeOverride) {
        return {
            discountAmount: 0,
            customFeeAmount: null,
            isFullFree: true
        };
    }
    // Get category-specific overrides
    const { data: overrides } = await adminSupabase
        .from('student_fee_overrides')
        .select('*')
        .eq('student_id', studentId)
        .eq('fee_category_id', feeCategoryId)
        .eq('is_active', true)
        .lte('effective_from', dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .order('created_at', { ascending: false });
    if (!overrides || overrides.length === 0) {
        return {
            discountAmount: 0,
            customFeeAmount: null,
            isFullFree: false
        };
    }
    // Aggregate overrides (sum discounts, take first custom fee, check full free)
    let totalDiscount = 0;
    let customFee = null;
    let isFullFree = false;
    for (const override of overrides) {
        if (override.is_full_free) {
            isFullFree = true;
            break; // Full free takes precedence
        }
        if (override.custom_fee_amount !== null && customFee === null) {
            customFee = parseFloat(override.custom_fee_amount);
        }
        if (override.discount_amount) {
            totalDiscount += parseFloat(override.discount_amount);
        }
    }
    return {
        discountAmount: totalDiscount,
        customFeeAmount: customFee,
        isFullFree
    };
}
/**
 * Calculate fee for a category using the correct logic:
 * if is_full_free: fee = 0
 * else if custom_fee_amount exists: fee = custom_fee_amount
 * else: fee = default_fee - discount_amount
 */
async function calculateCategoryFee(studentId, feeCategoryId, defaultFee, periodDate, adminSupabase) {
    // Get category name
    const { data: category } = await adminSupabase
        .from('fee_categories')
        .select('name')
        .eq('id', feeCategoryId)
        .single();
    // Get override
    const override = await getStudentFeeOverride(studentId, feeCategoryId, periodDate, adminSupabase);
    let finalFee;
    // Apply logic
    if (override.isFullFree) {
        finalFee = 0;
    }
    else if (override.customFeeAmount !== null) {
        finalFee = override.customFeeAmount;
    }
    else {
        finalFee = Math.max(0, defaultFee - override.discountAmount);
    }
    return {
        categoryId: feeCategoryId,
        categoryName: category?.name || 'Fee',
        defaultFee,
        discountAmount: override.discountAmount,
        customFeeAmount: override.customFeeAmount,
        isFullFree: override.isFullFree,
        finalFee
    };
}
/**
 * Calculate all fees for a student for a billing period
 */
export async function calculateStudentFeesSimplified(studentId, classGroupId, schoolId, periodType, periodDate, adminSupabase) {
    const dateStr = periodDate.toISOString().split('T')[0];
    const breakdown = [];
    const billItems = [];
    // Check for global full free (applies to all fees)
    const { data: globalFullFree } = await adminSupabase
        .from('student_fee_overrides')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_full_free', true)
        .is('fee_category_id', null)
        .eq('is_active', true)
        .lte('effective_from', dateStr)
        .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
        .limit(1)
        .maybeSingle();
    // If global full free, return zero fees
    if (globalFullFree) {
        return {
            billItems: [],
            totalAmount: 0,
            totalDiscount: 0,
            finalAmount: 0,
            breakdown: []
        };
    }
    // Get all class fee defaults for this class
    const { data: classFeeDefaults } = await adminSupabase
        .from('class_fee_defaults')
        .select(`
      *,
      fee_categories:fee_category_id(id, name, fee_type)
    `)
        .eq('class_group_id', classGroupId)
        .eq('school_id', schoolId)
        .eq('is_active', true);
    if (!classFeeDefaults) {
        return {
            billItems: [],
            totalAmount: 0,
            totalDiscount: 0,
            finalAmount: 0,
            breakdown: []
        };
    }
    let totalAmount = 0;
    let totalDiscount = 0;
    // Process each fee category
    for (const feeDefault of classFeeDefaults) {
        // Skip if fee cycle doesn't match
        if (feeDefault.fee_cycle !== periodType && feeDefault.fee_cycle !== 'per-bill') {
            continue;
        }
        const defaultFee = parseFloat(feeDefault.amount || 0);
        const feeCategoryId = feeDefault.fee_category_id;
        const categoryName = feeDefault.fee_categories?.name || 'Fee';
        const feeType = feeDefault.fee_categories?.fee_type || 'custom';
        // Calculate fee with overrides
        const calculation = await calculateCategoryFee(studentId, feeCategoryId, defaultFee, periodDate, adminSupabase);
        breakdown.push(calculation);
        // Add to bill items
        billItems.push({
            fee_category_id: feeCategoryId,
            item_name: categoryName,
            item_type: feeType,
            base_amount: defaultFee,
            discount_amount: calculation.discountAmount,
            final_amount: calculation.finalFee
        });
        totalAmount += defaultFee;
        totalDiscount += calculation.discountAmount;
    }
    // Get transport fee if applicable
    const { data: transportAssignment } = await adminSupabase
        .from('student_transport')
        .select('route_id, transport_routes:route_id(id, route_name)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .single();
    if (transportAssignment) {
        // Get transport fee default
        const { data: transportFeeDefault } = await adminSupabase
            .from('transport_fee_defaults')
            .select('*, transport_routes:route_id(id, route_name)')
            .eq('route_id', transportAssignment.route_id)
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .single();
        if (transportFeeDefault) {
            // Get transport fee category (assuming there's a transport category)
            const { data: transportCategory } = await adminSupabase
                .from('fee_categories')
                .select('id, name')
                .eq('school_id', schoolId)
                .eq('fee_type', 'transport')
                .limit(1)
                .single();
            if (transportCategory) {
                const transportDefaultFee = parseFloat(transportFeeDefault.base_fee || 0) +
                    parseFloat(transportFeeDefault.escort_fee || 0) +
                    parseFloat(transportFeeDefault.fuel_surcharge || 0);
                // Calculate transport fee with overrides
                const transportCalculation = await calculateCategoryFee(studentId, transportCategory.id, transportDefaultFee, periodDate, adminSupabase);
                breakdown.push(transportCalculation);
                billItems.push({
                    fee_category_id: transportCategory.id,
                    item_name: transportCategory.name || 'Transport Fee',
                    item_type: 'transport',
                    base_amount: transportDefaultFee,
                    discount_amount: transportCalculation.discountAmount,
                    final_amount: transportCalculation.finalFee
                });
                totalAmount += transportDefaultFee;
                totalDiscount += transportCalculation.discountAmount;
            }
        }
    }
    const finalAmount = Math.max(0, totalAmount - totalDiscount);
    return {
        billItems,
        totalAmount,
        totalDiscount,
        finalAmount,
        breakdown
    };
}
