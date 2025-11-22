/**
 * Comprehensive Fee Billing Engine
 * Handles class defaults, student overrides, scholarships, discounts, and bill generation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

interface FeeCalculationResult {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  breakdown: Array<{
    category: string;
    baseAmount: number;
    discountAmount: number;
    finalAmount: number;
  }>;
}

interface BillItem {
  fee_category_id: string;
  item_name: string;
  item_type: 'tuition' | 'transport' | 'optional' | 'custom' | 'fine' | 'discount';
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  description?: string;
}

/**
 * Get class default fees for a student (using versioned fees)
 * Returns fees active for the billing period date
 */
export async function getClassDefaultFees(
  studentId: string,
  classGroupId: string,
  schoolId: string,
  periodDate: Date,
  adminSupabase: any
): Promise<Array<{
  fee_category_id: string;
  category_name: string;
  amount: number;
  fee_cycle: string;
  version_number: number;
}>> {
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
  const uniqueCombos = new Map<string, any>();
  (categories || []).forEach((cat: any) => {
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
export async function getStudentFeeProfile(
  studentId: string,
  schoolId: string,
  periodDate: Date,
  adminSupabase: any
): Promise<{
  transport_enabled: boolean;
  transport_route: string | null;
  transport_fee_override: number | null;
  tuition_fee_cycle: string | null;
  transport_fee_cycle: string | null;
  fee_overrides: Map<string, number>;
  custom_fees: Array<{
    fee_category_id: string;
    amount: number;
    fee_cycle: string;
    description?: string;
  }>;
  optional_fees: Array<{
    optional_fee_definition_id: string;
    fee_category_id: string;
    amount: number;
    fee_cycle: string;
  }>;
}> {
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

  // Get custom fees
  const { data: customFees, error: customFeesError } = await adminSupabase
    .from('student_custom_fees')
    .select(`
      fee_category_id,
      amount,
      fee_cycle,
      description,
      fee_categories:fee_category_id(name)
    `)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .lte('effective_from', periodDate.toISOString().split('T')[0])
    .or(`effective_to.is.null,effective_to.gte.${periodDate.toISOString().split('T')[0]}`);

  // Get optional fees (opted in)
  const { data: optionalFees, error: optionalFeesError } = await adminSupabase
    .from('student_optional_fees')
    .select(`
      optional_fee_definition_id,
      opted_in,
      optional_fee_definitions:optional_fee_definition_id(
        id,
        fee_category_id,
        amount,
        fee_cycle,
        fee_categories:fee_category_id(name)
      )
    `)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('opted_in', true)
    .lte('effective_from', periodDate.toISOString().split('T')[0])
    .or(`effective_to.is.null,effective_to.gte.${periodDate.toISOString().split('T')[0]}`);

  const feeOverridesMap = new Map<string, number>();
  (overrides || []).forEach((o: any) => {
    feeOverridesMap.set(o.fee_category_id, parseFloat(o.override_amount) || 0);
  });

  return {
    transport_enabled: profile?.transport_enabled ?? true,
    transport_route: profile?.transport_route || null,
    transport_fee_override: profile?.transport_fee_override ? parseFloat(profile.transport_fee_override) : null,
    tuition_fee_cycle: profile?.tuition_fee_cycle || null,
    transport_fee_cycle: profile?.transport_fee_cycle || null,
    fee_overrides: feeOverridesMap,
    custom_fees: (customFees || []).map((cf: any) => ({
      fee_category_id: cf.fee_category_id,
      amount: parseFloat(cf.amount) || 0,
      fee_cycle: cf.fee_cycle,
      description: cf.description
    })),
    optional_fees: (optionalFees || [])
      .filter((of: any) => of.opted_in && of.optional_fee_definitions)
      .map((of: any) => ({
        optional_fee_definition_id: of.optional_fee_definition_id,
        fee_category_id: of.optional_fee_definitions.fee_category_id,
        amount: parseFloat(of.optional_fee_definitions.amount) || 0,
        fee_cycle: of.optional_fee_definitions.fee_cycle
      }))
  };
}

/**
 * Get transport fee for student
 */
export async function getTransportFee(
  studentId: string,
  classGroupId: string,
  schoolId: string,
  periodDate: Date,
  studentProfile: any,
  adminSupabase: any
): Promise<number> {
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
  } else {
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
export async function getStudentScholarships(
  studentId: string,
  schoolId: string,
  periodDate: Date,
  adminSupabase: any
): Promise<Array<{
  scholarship_type: 'percentage' | 'fixed' | 'full_waiver';
  applies_to: 'all' | 'tuition_only' | 'transport_only' | 'specific_category';
  fee_category_id: string | null;
  discount_percentage: number | null;
  discount_amount: number | null;
}>> {
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

  return (scholarships || []).map((s: any) => ({
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
function applyScholarships(
  baseAmount: number,
  feeCategoryId: string,
  feeType: string,
  scholarships: Array<{
    scholarship_type: 'percentage' | 'fixed' | 'full_waiver';
    applies_to: 'all' | 'tuition_only' | 'transport_only' | 'specific_category';
    fee_category_id: string | null;
    discount_percentage: number | null;
    discount_amount: number | null;
  }>
): { discountAmount: number; finalAmount: number } {
  let totalDiscount = 0;

  for (const scholarship of scholarships) {
    // Check if scholarship applies to this fee
    let applies = false;
    if (scholarship.applies_to === 'all') {
      applies = true;
    } else if (scholarship.applies_to === 'tuition_only' && feeType === 'tuition') {
      applies = true;
    } else if (scholarship.applies_to === 'transport_only' && feeType === 'transport') {
      applies = true;
    } else if (scholarship.applies_to === 'specific_category' && scholarship.fee_category_id === feeCategoryId) {
      applies = true;
    }

    if (!applies) continue;

    // Apply discount
    if (scholarship.scholarship_type === 'full_waiver') {
      totalDiscount = baseAmount; // 100% discount
      break;
    } else if (scholarship.scholarship_type === 'percentage' && scholarship.discount_percentage) {
      const discount = (baseAmount * scholarship.discount_percentage) / 100;
      totalDiscount += discount;
    } else if (scholarship.scholarship_type === 'fixed' && scholarship.discount_amount) {
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
export async function calculateStudentFees(
  studentId: string,
  classGroupId: string,
  schoolId: string,
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'one-time',
  periodDate: Date,
  adminSupabase: any
): Promise<{
  billItems: BillItem[];
  totalAmount: number;
  totalDiscount: number;
  finalAmount: number;
}> {
  // Get class defaults
  const classDefaults = await getClassDefaultFees(studentId, classGroupId, schoolId, periodDate, adminSupabase);

  // Get student profile
  const studentProfile = await getStudentFeeProfile(studentId, schoolId, periodDate, adminSupabase);

  // Get scholarships
  const scholarships = await getStudentScholarships(studentId, schoolId, periodDate, adminSupabase);

  // Get transport fee
  const transportFee = await getTransportFee(studentId, classGroupId, schoolId, periodDate, studentProfile, adminSupabase);

  const billItems: BillItem[] = [];
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

  // Add optional fees (if opted in)
  for (const optionalFee of studentProfile.optional_fees) {
    if (optionalFee.fee_cycle !== periodType && optionalFee.fee_cycle !== 'per-bill') {
      continue;
    }

    const { data: category } = await adminSupabase
      .from('fee_categories')
      .select('name')
      .eq('id', optionalFee.fee_category_id)
      .single();

    const discount = applyScholarships(optionalFee.amount, optionalFee.fee_category_id, 'optional', scholarships);

    billItems.push({
      fee_category_id: optionalFee.fee_category_id,
      item_name: category?.name || 'Optional Fee',
      item_type: 'optional',
      base_amount: optionalFee.amount,
      discount_amount: discount.discountAmount,
      final_amount: discount.finalAmount
    });

    totalAmount += optionalFee.amount;
    totalDiscount += discount.discountAmount;
  }

  // Add custom fees
  for (const customFee of studentProfile.custom_fees) {
    if (customFee.fee_cycle !== periodType && customFee.fee_cycle !== 'per-bill') {
      continue;
    }

    const { data: category } = await adminSupabase
      .from('fee_categories')
      .select('name')
      .eq('id', customFee.fee_category_id)
      .single();

    const discount = applyScholarships(customFee.amount, customFee.fee_category_id, 'custom', scholarships);

    billItems.push({
      fee_category_id: customFee.fee_category_id,
      item_name: category?.name || 'Custom Fee',
      item_type: 'custom',
      base_amount: customFee.amount,
      discount_amount: discount.discountAmount,
      final_amount: discount.finalAmount,
      description: customFee.description
    });

    totalAmount += customFee.amount;
    totalDiscount += discount.discountAmount;
  }

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
export async function generateFeeBill(
  studentId: string,
  classGroupId: string,
  schoolId: string,
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'one-time',
  periodStart: Date,
  periodEnd: Date,
  periodLabel: string,
  dueDate: Date,
  generatedBy: string,
  adminSupabase: any
): Promise<string> {
  // Calculate fees
  const feeCalculation = await calculateStudentFees(
    studentId,
    classGroupId,
    schoolId,
    periodType,
    periodStart,
    adminSupabase
  );

  // Generate bill number
  const billNumber = `BILL-${schoolId.substring(0, 8)}-${Date.now()}`;

  // Create bill
  const { data: bill, error: billError } = await adminSupabase
    .from('fee_bills')
    .insert({
      student_id: studentId,
      school_id: schoolId,
      bill_number: billNumber,
      bill_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      period_type: periodType,
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      period_label: periodLabel,
      total_amount: feeCalculation.totalAmount,
      discount_amount: feeCalculation.totalDiscount,
      pending_amount: feeCalculation.finalAmount,
      status: 'generated',
      generated_by: generatedBy
    })
    .select()
    .single();

  if (billError) {
    console.error('[generateFeeBill] Error creating bill:', billError);
    throw new Error(`Failed to create bill: ${billError.message}`);
  }

  // Create bill items
  const billItems = feeCalculation.billItems.map((item) => ({
    bill_id: bill.id,
    student_id: studentId,
    school_id: schoolId,
    fee_category_id: item.fee_category_id,
    item_name: item.item_name,
    item_type: item.item_type,
    base_amount: item.base_amount,
    discount_amount: item.discount_amount,
    final_amount: item.final_amount,
    description: item.description
  }));

  const { error: itemsError } = await adminSupabase
    .from('fee_bill_items')
    .insert(billItems);

  if (itemsError) {
    console.error('[generateFeeBill] Error creating bill items:', itemsError);
    // Rollback bill
    await adminSupabase.from('fee_bills').delete().eq('id', bill.id);
    throw new Error(`Failed to create bill items: ${itemsError.message}`);
  }

  return bill.id;
}

/**
 * Calculate fine for overdue bill
 */
export async function calculateFine(
  billId: string,
  schoolId: string,
  adminSupabase: any
): Promise<number> {
  // Get bill
  const { data: bill, error: billError } = await adminSupabase
    .from('fee_bills')
    .select('due_date, pending_amount, fine_amount')
    .eq('id', billId)
    .eq('school_id', schoolId)
    .single();

  if (billError || !bill) {
    return 0;
  }

  const dueDate = new Date(bill.due_date);
  const today = new Date();
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue <= 0) {
    return 0; // Not overdue
  }

  // Get active fine rules
  const { data: fineRules, error: rulesError } = await adminSupabase
    .from('fine_rules')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .lte('days_after_due', daysOverdue)
    .or(`effective_to.is.null,effective_to.gte.${today.toISOString().split('T')[0]}`)
    .order('days_after_due', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rulesError || !fineRules) {
    return 0; // No fine rule
  }

  let fineAmount = 0;
  const pendingAmount = parseFloat(bill.pending_amount) || 0;

  if (fineRules.fine_type === 'fixed') {
    fineAmount = parseFloat(fineRules.fine_amount) || 0;
  } else if (fineRules.fine_type === 'percentage') {
    fineAmount = (pendingAmount * (parseFloat(fineRules.fine_percentage) || 0)) / 100;
  } else if (fineRules.fine_type === 'per_day') {
    fineAmount = (parseFloat(fineRules.fine_amount) || 0) * daysOverdue;
  }

  // Apply max fine cap if exists
  if (fineRules.max_fine_amount) {
    fineAmount = Math.min(fineAmount, parseFloat(fineRules.max_fine_amount));
  }

  return Math.max(0, fineAmount);
}

