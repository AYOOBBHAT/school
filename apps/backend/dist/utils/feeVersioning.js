/**
 * Fee Versioning Utilities
 * Handles fee hikes, version management, and historical fee protection
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/**
 * Get class fee version active for a specific date
 */
export async function getClassFeeVersion(classGroupId, feeCategoryId, feeCycle, targetDate, adminSupabase) {
    const dateStr = targetDate.toISOString().split('T')[0];
    const { data, error } = await adminSupabase
        .from('class_fee_versions')
        .select('*')
        .eq('class_group_id', classGroupId)
        .eq('fee_category_id', feeCategoryId)
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('[getClassFeeVersion] Error:', error);
        throw new Error(`Failed to get class fee version: ${error.message}`);
    }
    if (!data)
        return null;
    return {
        id: data.id,
        amount: parseFloat(data.amount) || 0,
        version_number: data.version_number,
        effective_from_date: data.effective_from_date,
        effective_to_date: data.effective_to_date
    };
}
/**
 * Get transport fee version active for a specific date
 */
export async function getTransportFeeVersion(classGroupId, routeName, feeCycle, targetDate, adminSupabase) {
    const dateStr = targetDate.toISOString().split('T')[0];
    let query = adminSupabase
        .from('transport_fee_versions')
        .select('*')
        .eq('class_group_id', classGroupId)
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
        .order('version_number', { ascending: false })
        .limit(1);
    if (routeName) {
        query = query.eq('route_name', routeName);
    }
    else {
        query = query.is('route_name', null);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
        console.error('[getTransportFeeVersion] Error:', error);
        throw new Error(`Failed to get transport fee version: ${error.message}`);
    }
    if (!data)
        return null;
    return {
        id: data.id,
        amount: parseFloat(data.amount) || 0,
        version_number: data.version_number
    };
}
/**
 * Get optional fee version active for a specific date
 */
export async function getOptionalFeeVersion(classGroupId, feeCategoryId, feeCycle, targetDate, adminSupabase) {
    const dateStr = targetDate.toISOString().split('T')[0];
    // Handle null values properly for UUID columns
    let query = adminSupabase
        .from('optional_fee_versions')
        .select('*')
        .eq('fee_category_id', feeCategoryId)
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`)
        .order('version_number', { ascending: false })
        .limit(1);
    // Handle class_group_id (can be null for "All Classes")
    if (classGroupId) {
        query = query.eq('class_group_id', classGroupId);
    }
    else {
        query = query.is('class_group_id', null);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
        console.error('[getOptionalFeeVersion] Error:', error);
        throw new Error(`Failed to get optional fee version: ${error.message}`);
    }
    if (!data)
        return null;
    return {
        id: data.id,
        amount: parseFloat(data.amount) || 0,
        version_number: data.version_number
    };
}
/**
 * Hike class fee (create new version)
 */
export async function hikeClassFee(schoolId, classGroupId, feeCategoryId, feeCycle, newAmount, effectiveFromDate, createdBy, adminSupabase) {
    // Get current max version number
    // Handle null values properly for UUID columns
    let versionQuery = adminSupabase
        .from('class_fee_versions')
        .select('version_number, id')
        .eq('fee_cycle', feeCycle)
        .order('version_number', { ascending: false })
        .limit(1);
    // Handle class_group_id (can be null)
    if (classGroupId) {
        versionQuery = versionQuery.eq('class_group_id', classGroupId);
    }
    else {
        versionQuery = versionQuery.is('class_group_id', null);
    }
    // Handle fee_category_id (can be null for general class fees)
    if (feeCategoryId) {
        versionQuery = versionQuery.eq('fee_category_id', feeCategoryId);
    }
    else {
        versionQuery = versionQuery.is('fee_category_id', null);
    }
    const { data: currentVersions, error: versionError } = await versionQuery.maybeSingle();
    if (versionError && versionError.code !== 'PGRST116') {
        throw new Error(`Failed to get current version: ${versionError.message}`);
    }
    const newVersionNumber = currentVersions ? currentVersions.version_number + 1 : 1;
    const effectiveFromStr = effectiveFromDate.toISOString().split('T')[0];
    const previousEffectiveTo = new Date(effectiveFromDate);
    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);
    const previousEffectiveToStr = previousEffectiveTo.toISOString().split('T')[0];
    // Close previous active version
    // Handle null values properly for UUID columns
    let closeQuery = adminSupabase
        .from('class_fee_versions')
        .update({
        effective_to_date: previousEffectiveToStr,
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .or(`effective_to_date.is.null,effective_to_date.gte.${effectiveFromStr}`);
    // Handle class_group_id (can be null)
    if (classGroupId) {
        closeQuery = closeQuery.eq('class_group_id', classGroupId);
    }
    else {
        closeQuery = closeQuery.is('class_group_id', null);
    }
    // Handle fee_category_id (can be null for general class fees)
    if (feeCategoryId) {
        closeQuery = closeQuery.eq('fee_category_id', feeCategoryId);
    }
    else {
        closeQuery = closeQuery.is('fee_category_id', null);
    }
    const { error: closeError } = await closeQuery;
    if (closeError) {
        console.error('[hikeClassFee] Error closing previous version:', closeError);
        throw new Error(`Failed to close previous version: ${closeError.message}`);
    }
    // Create new version
    // Handle null values properly for UUID columns
    const insertData = {
        school_id: schoolId,
        class_group_id: classGroupId || null,
        fee_category_id: feeCategoryId || null,
        version_number: newVersionNumber,
        amount: newAmount,
        fee_cycle: feeCycle,
        effective_from_date: effectiveFromStr,
        effective_to_date: null, // Active until next version
        is_active: true,
        created_by: createdBy
    };
    const { data: newVersion, error: createError } = await adminSupabase
        .from('class_fee_versions')
        .insert(insertData)
        .select()
        .single();
    if (createError) {
        console.error('[hikeClassFee] Error creating new version:', createError);
        throw new Error(`Failed to create new version: ${createError.message}`);
    }
    return newVersion.id;
}
/**
 * Hike transport fee
 */
export async function hikeTransportFee(schoolId, classGroupId, routeName, feeCycle, newAmount, effectiveFromDate, createdBy, adminSupabase) {
    // Get current max version number
    // Handle null values properly for UUID columns
    let query = adminSupabase
        .from('transport_fee_versions')
        .select('version_number, id')
        .eq('fee_cycle', feeCycle)
        .order('version_number', { ascending: false })
        .limit(1);
    // Handle class_group_id (can be null)
    if (classGroupId) {
        query = query.eq('class_group_id', classGroupId);
    }
    else {
        query = query.is('class_group_id', null);
    }
    // Handle route_name (can be null)
    if (routeName) {
        query = query.eq('route_name', routeName);
    }
    else {
        query = query.is('route_name', null);
    }
    const { data: currentVersions, error: versionError } = await query.maybeSingle();
    if (versionError && versionError.code !== 'PGRST116') {
        throw new Error(`Failed to get current version: ${versionError.message}`);
    }
    const newVersionNumber = currentVersions ? currentVersions.version_number + 1 : 1;
    const effectiveFromStr = effectiveFromDate.toISOString().split('T')[0];
    const previousEffectiveTo = new Date(effectiveFromDate);
    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);
    const previousEffectiveToStr = previousEffectiveTo.toISOString().split('T')[0];
    // Close previous active version
    // Handle null values properly for UUID columns
    let closeQuery = adminSupabase
        .from('transport_fee_versions')
        .update({
        effective_to_date: previousEffectiveToStr,
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .or(`effective_to_date.is.null,effective_to_date.gte.${effectiveFromStr}`);
    // Handle class_group_id (can be null)
    if (classGroupId) {
        closeQuery = closeQuery.eq('class_group_id', classGroupId);
    }
    else {
        closeQuery = closeQuery.is('class_group_id', null);
    }
    // Handle route_name (can be null)
    if (routeName) {
        closeQuery = closeQuery.eq('route_name', routeName);
    }
    else {
        closeQuery = closeQuery.is('route_name', null);
    }
    const { error: closeError } = await closeQuery;
    if (closeError) {
        console.error('[hikeTransportFee] Error closing previous version:', closeError);
        throw new Error(`Failed to close previous version: ${closeError.message}`);
    }
    // Create new version
    // Handle null values properly for UUID columns
    const insertData = {
        school_id: schoolId,
        class_group_id: classGroupId || null,
        route_name: routeName || null,
        version_number: newVersionNumber,
        amount: newAmount,
        fee_cycle: feeCycle,
        effective_from_date: effectiveFromStr,
        effective_to_date: null,
        is_active: true,
        created_by: createdBy
    };
    const { data: newVersion, error: createError } = await adminSupabase
        .from('transport_fee_versions')
        .insert(insertData)
        .select()
        .single();
    if (createError) {
        console.error('[hikeTransportFee] Error creating new version:', createError);
        throw new Error(`Failed to create new version: ${createError.message}`);
    }
    return newVersion.id;
}
/**
 * Hike optional/custom fee (create new version)
 */
export async function hikeOptionalFee(schoolId, classGroupId, feeCategoryId, feeCycle, newAmount, effectiveFromDate, createdBy, adminSupabase) {
    // Get current max version number
    // Handle null values properly for UUID columns
    let versionQuery = adminSupabase
        .from('optional_fee_versions')
        .select('version_number, id')
        .eq('fee_category_id', feeCategoryId)
        .eq('fee_cycle', feeCycle)
        .order('version_number', { ascending: false })
        .limit(1);
    // Handle class_group_id (can be null for "All Classes")
    if (classGroupId) {
        versionQuery = versionQuery.eq('class_group_id', classGroupId);
    }
    else {
        versionQuery = versionQuery.is('class_group_id', null);
    }
    const { data: currentVersions, error: versionError } = await versionQuery.maybeSingle();
    if (versionError && versionError.code !== 'PGRST116') {
        throw new Error(`Failed to get current version: ${versionError.message}`);
    }
    const newVersionNumber = currentVersions ? currentVersions.version_number + 1 : 1;
    const effectiveFromStr = effectiveFromDate.toISOString().split('T')[0];
    const previousEffectiveTo = new Date(effectiveFromDate);
    previousEffectiveTo.setDate(previousEffectiveTo.getDate() - 1);
    const previousEffectiveToStr = previousEffectiveTo.toISOString().split('T')[0];
    // Close previous active version
    // Handle null values properly for UUID columns
    let closeQuery = adminSupabase
        .from('optional_fee_versions')
        .update({
        effective_to_date: previousEffectiveToStr,
        is_active: false,
        updated_at: new Date().toISOString()
    })
        .eq('fee_category_id', feeCategoryId)
        .eq('fee_cycle', feeCycle)
        .eq('is_active', true)
        .or(`effective_to_date.is.null,effective_to_date.gte.${effectiveFromStr}`);
    // Handle class_group_id (can be null for "All Classes")
    if (classGroupId) {
        closeQuery = closeQuery.eq('class_group_id', classGroupId);
    }
    else {
        closeQuery = closeQuery.is('class_group_id', null);
    }
    const { error: closeError } = await closeQuery;
    if (closeError) {
        console.error('[hikeOptionalFee] Error closing previous version:', closeError);
        throw new Error(`Failed to close previous version: ${closeError.message}`);
    }
    // Create new version
    // Handle null values properly for UUID columns
    const insertData = {
        school_id: schoolId,
        class_group_id: classGroupId || null,
        fee_category_id: feeCategoryId,
        version_number: newVersionNumber,
        amount: newAmount,
        fee_cycle: feeCycle,
        effective_from_date: effectiveFromStr,
        effective_to_date: null, // Active until next version
        is_active: true,
        created_by: createdBy
    };
    const { data: newVersion, error: createError } = await adminSupabase
        .from('optional_fee_versions')
        .insert(insertData)
        .select()
        .single();
    if (createError) {
        console.error('[hikeOptionalFee] Error creating new version:', createError);
        throw new Error(`Failed to create new version: ${createError.message}`);
    }
    return newVersion.id;
}
/**
 * Get fee version for billing month
 * This is the core function that ensures historical protection
 */
export async function getFeeVersionForBillingMonth(classGroupId, feeCategoryId, feeCycle, billingMonth, // First day of the billing month
adminSupabase) {
    // Get the version active for the first day of the billing month
    const version = await getClassFeeVersion(classGroupId, feeCategoryId, feeCycle, billingMonth, adminSupabase);
    if (!version) {
        throw new Error(`No fee version found for class ${classGroupId}, category ${feeCategoryId}, cycle ${feeCycle} on ${billingMonth.toISOString()}`);
    }
    return version.amount;
}
