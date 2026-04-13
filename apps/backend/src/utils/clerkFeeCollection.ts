/**
 * Clerk Fee Collection Utilities
 * Handles loading assigned fee structure, generating monthly components, and payment tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

interface MonthlyFeeComponent {
  id?: string;
  student_id: string;
  school_id: string;
  fee_category_id: string | null;
  fee_type: 'class-fee' | 'transport-fee' | 'custom-fee';
  fee_name: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  fee_amount: number;
  fee_cycle: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  transport_route_id?: string;
  transport_route_name?: string;
  paid_amount: number;
  pending_amount: number;
  status: 'pending' | 'partially-paid' | 'paid' | 'overdue';
  due_date?: string;
  effective_from?: string;
}

export interface ClassFeeLine {
  fee_category_id: string | null;
  category_name: string;
  amount: number;
  fee_cycle: string;
  billing_frequency: string;
  start_date: string;
}

interface FeeStructure {
  /** First class line — same as `class_fees[0]` when present (backward compatible API shape). */
  class_fee?: ClassFeeLine;
  /** All class fee version lines active as of the snapshot date. */
  class_fees: ClassFeeLine[];
  transport_fee?: {
    route_id: string;
    route_name: string;
    amount: number;
    fee_cycle: string;
    billing_frequency: string;
    start_date: string;
  };
  custom_fees: Array<{
    fee_category_id: string;
    category_name: string;
    amount: number;
    fee_cycle: string;
    billing_frequency: string;
    start_date: string;
  }>;
}

/** Calendar date in local timezone (avoids UTC drift for version cutoffs). */
function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Last calendar day of (year, month) — used as version / override snapshot date. */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

/** Student row needed to build structure without re-querying each month. */
export type FeeStructureStudentRow = {
  id: string;
  class_group_id: string | null;
  admission_date: string | null;
};

async function fetchAllStudentOverridesAsOf(
  studentId: string,
  asOfDate: Date,
  adminSupabase: any
): Promise<any[]> {
  const dateStr = toLocalYmd(asOfDate);
  const { data, error } = await adminSupabase
    .from('student_fee_overrides')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .lte('effective_from', dateStr)
    .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
    .order('effective_from', { ascending: false });

  if (error) {
    throw new Error(`Failed to load student fee overrides: ${error.message}`);
  }
  return data || [];
}

/** Latest override per fee_category_id (empty key = null category), same as repeated single-category queries. */
function latestOverrideByFeeCategory(overrides: any[]): Map<string, any> {
  const sorted = [...overrides].sort((a, b) =>
    String(b.effective_from).localeCompare(String(a.effective_from))
  );
  const m = new Map<string, any>();
  for (const row of sorted) {
    const k = row.fee_category_id == null ? '' : String(row.fee_category_id);
    if (!m.has(k)) {
      m.set(k, row);
    }
  }
  return m;
}

function pickOverrideForCategory(overrideMap: Map<string, any>, feeCategoryId: string | null): any | null {
  const k = feeCategoryId == null ? '' : String(feeCategoryId);
  return overrideMap.get(k) ?? null;
}

function applyOverrideToAmount(baseAmount: number, override: any | null): number {
  if (!override) return baseAmount;
  if (override.is_full_free) return 0;
  if (override.custom_fee_amount != null) return parseFloat(override.custom_fee_amount);
  if (override.discount_amount) return Math.max(0, baseAmount - parseFloat(override.discount_amount));
  return baseAmount;
}

/**
 * Build fee structure from version tables only, as of `asOfDate` (typically last day of billing month).
 * Pass `opts.student` when the caller already loaded the row to avoid an extra DB round-trip per month.
 */
export async function loadAssignedFeeStructureAsOf(
  studentId: string,
  schoolId: string,
  adminSupabase: any,
  asOfDate: Date,
  opts?: { student?: FeeStructureStudentRow }
): Promise<FeeStructure> {
  const dateStr = toLocalYmd(asOfDate);

  let student: FeeStructureStudentRow;
  if (opts?.student) {
    student = opts.student;
  } else {
    const { data: row, error: studentError } = await adminSupabase
      .from('students')
      .select('id, class_group_id, admission_date')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .single();

    if (studentError || !row) {
      throw new Error('Student not found');
    }
    student = row as FeeStructureStudentRow;
  }

  const admissionDate = student.admission_date || dateStr;
  const result: FeeStructure = { class_fees: [], custom_fees: [] };

  const overrideRows = await fetchAllStudentOverridesAsOf(studentId, asOfDate, adminSupabase);
  const overrideMap = latestOverrideByFeeCategory(overrideRows);

  // 1) Class fees — class_fee_versions (one line per fee_category_id + fee_cycle)
  if (student.class_group_id) {
    const { data: versionRows, error: cvError } = await adminSupabase
      .from('class_fee_versions')
      .select(
        `
        fee_category_id,
        fee_cycle,
        amount,
        effective_from_date,
        fee_categories:fee_category_id(id, name)
      `
      )
      .eq('school_id', schoolId)
      .eq('class_group_id', student.class_group_id)
      .lte('effective_from_date', dateStr)
      .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`);

    if (cvError) {
      throw new Error(`Failed to load class fee versions: ${cvError.message}`);
    }

    const sorted = [...(versionRows || [])].sort((a: any, b: any) =>
      String(b.effective_from_date).localeCompare(String(a.effective_from_date))
    );
    const byKey = new Map<string, any>();
    for (const row of sorted) {
      const k = `${row.fee_category_id ?? ''}|${row.fee_cycle}`;
      if (!byKey.has(k)) {
        byKey.set(k, row);
      }
    }

    for (const row of byKey.values()) {
      const catId = row.fee_category_id as string | null;
      const override = pickOverrideForCategory(overrideMap, catId);
      const base = parseFloat(row.amount || 0);
      const finalAmount = applyOverrideToAmount(base, override);
      const name =
        (row.fee_categories && (Array.isArray(row.fee_categories) ? row.fee_categories[0]?.name : row.fee_categories?.name)) ||
        'Class Fee';

      result.class_fees.push({
        fee_category_id: catId,
        category_name: name,
        amount: finalAmount,
        fee_cycle: row.fee_cycle,
        billing_frequency: row.fee_cycle,
        start_date: admissionDate
      });
    }

    if (result.class_fees.length > 0) {
      result.class_fee = result.class_fees[0];
    }
  }

  // 2) Transport — transport_fee_versions (route name + class); amounts are totals per version row
  const { data: studentTransport } = await adminSupabase
    .from('student_transport')
    .select(
      `
      route_id,
      transport_routes:route_id(id, route_name)
    `
    )
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const routeJoin = studentTransport?.transport_routes;
  const routeObj = Array.isArray(routeJoin) ? routeJoin[0] : routeJoin;

  if (studentTransport?.route_id && student.class_group_id) {
    const routeNameRaw = routeObj?.route_name;
    const routeName =
      typeof routeNameRaw === 'string'
        ? routeNameRaw
        : (routeNameRaw as { route_name?: string } | undefined)?.route_name;

    if (routeName) {
      const { data: tvRows, error: tvError } = await adminSupabase
        .from('transport_fee_versions')
        .select('fee_cycle, amount, effective_from_date')
        .eq('school_id', schoolId)
        .eq('class_group_id', student.class_group_id)
        .eq('route_name', routeName)
        .lte('effective_from_date', dateStr)
        .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`);

      if (tvError) {
        throw new Error(`Failed to load transport fee versions: ${tvError.message}`);
      }

      const tSorted = [...(tvRows || [])].sort((a: any, b: any) =>
        String(b.effective_from_date).localeCompare(String(a.effective_from_date))
      );
      const byCycle = new Map<string, any>();
      for (const row of tSorted) {
        if (!byCycle.has(row.fee_cycle)) {
          byCycle.set(row.fee_cycle, row);
        }
      }

      const tv = byCycle.get('monthly') || tSorted[0];
      if (tv) {
        const totalAmount = parseFloat(tv.amount || 0);

        result.transport_fee = {
          route_id: studentTransport.route_id,
          route_name: routeName || 'Transport',
          amount: totalAmount,
          fee_cycle: tv.fee_cycle,
          billing_frequency: tv.fee_cycle,
          start_date: admissionDate
        };
      }
    }
  }

  // 3) Custom / optional — optional_fee_versions
  const { data: customFeeCategories } = await adminSupabase
    .from('fee_categories')
    .select('id')
    .eq('school_id', schoolId)
    .eq('fee_type', 'custom')
    .eq('is_active', true);

  if (customFeeCategories?.length) {
    const customCategoryIds = customFeeCategories.map((cat: any) => cat.id);
    const cg = student.class_group_id;

    let optQuery = adminSupabase
      .from('optional_fee_versions')
      .select(
        `
        fee_category_id,
        fee_cycle,
        amount,
        effective_from_date,
        class_group_id,
        fee_categories:fee_category_id(id, name)
      `
      )
      .eq('school_id', schoolId)
      .in('fee_category_id', customCategoryIds)
      .lte('effective_from_date', dateStr)
      .or(`effective_to_date.is.null,effective_to_date.gte.${dateStr}`);

    if (cg) {
      optQuery = optQuery.or(`class_group_id.eq.${cg},class_group_id.is.null`);
    } else {
      optQuery = optQuery.is('class_group_id', null);
    }

    const { data: optRows, error: optErr } = await optQuery;

    if (optErr) {
      throw new Error(`Failed to load optional fee versions: ${optErr.message}`);
    }

    const groups = new Map<string, any[]>();
    for (const row of optRows || []) {
      const k = `${row.fee_category_id}|${row.fee_cycle}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(row);
    }

    for (const [, rows] of groups) {
      rows.sort((a: any, b: any) => {
        const c = String(b.effective_from_date).localeCompare(String(a.effective_from_date));
        if (c !== 0) return c;
        if (!cg) return 0;
        const ap = a.class_group_id === cg ? 1 : 0;
        const bp = b.class_group_id === cg ? 1 : 0;
        return bp - ap;
      });
      const customFee = rows[0];
      const override = pickOverrideForCategory(overrideMap, customFee.fee_category_id);
      const base = parseFloat(customFee.amount || 0);
      const finalAmount = applyOverrideToAmount(base, override);
      const catJoin = customFee.fee_categories;
      const catName =
        (catJoin && (Array.isArray(catJoin) ? catJoin[0]?.name : catJoin?.name)) || 'Custom Fee';

      result.custom_fees.push({
        fee_category_id: customFee.fee_category_id,
        category_name: catName,
        amount: finalAmount,
        fee_cycle: customFee.fee_cycle,
        billing_frequency: customFee.fee_cycle,
        start_date: admissionDate
      });
    }
  }

  return result;
}

/**
 * Load assigned fee structure for a student (snapshot as of today).
 */
export async function loadAssignedFeeStructure(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<FeeStructure> {
  return loadAssignedFeeStructureAsOf(studentId, schoolId, adminSupabase, new Date());
}

/**
 * Generate monthly fee components for a student based on fee structure
 */
export async function generateMonthlyFeeComponents(
  studentId: string,
  schoolId: string,
  year: number,
  month: number,
  feeStructure: FeeStructure,
  adminSupabase: any
): Promise<MonthlyFeeComponent[]> {
  const components: MonthlyFeeComponent[] = [];
  const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];
  const dueDate = new Date(year, month - 1, 15).toISOString().split('T')[0]; // 15th of month

  // Helper to check if a fee should be billed this month
  const shouldBillThisMonth = (feeCycle: string, startDate: string): boolean => {
    const start = new Date(startDate);
    const currentMonth = new Date(year, month - 1, 1);
    
    // Current month should be on or after start date
    if (currentMonth < start) return false;

    if (feeCycle === 'monthly') {
      // Monthly fees: bill every month from start date
      return true;
    }
    if (feeCycle === 'quarterly') {
      // Quarterly fees: bill in Jan, Apr, Jul, Oct (Q1, Q2, Q3, Q4)
      const quarterMonths = [1, 4, 7, 10];
      if (!quarterMonths.includes(month)) return false;
      
      const quarter = Math.floor((month - 1) / 3) + 1;
      const startQuarter = Math.floor((start.getMonth()) / 3) + 1;
      const startYear = start.getFullYear();
      
      // Must be in same quarter or later
      return (year === startYear && quarter >= startQuarter) || year > startYear;
    }
    if (feeCycle === 'yearly') {
      // Yearly fees: bill in January only
      return month === 1 && (year === start.getFullYear() || year > start.getFullYear());
    }
    if (feeCycle === 'one-time') {
      // One-time fees: bill only in the start month
      const startMonth = start.getMonth() + 1;
      const startYear = start.getFullYear();
      return year === startYear && month === startMonth;
    }
    return false;
  };

  const classLines =
    feeStructure.class_fees.length > 0
      ? feeStructure.class_fees
      : feeStructure.class_fee
        ? [feeStructure.class_fee]
        : [];

  for (const cf of classLines) {
    if (!cf || !shouldBillThisMonth(cf.fee_cycle, cf.start_date)) continue;

    const amount =
      cf.fee_cycle === 'monthly'
        ? cf.amount
        : cf.fee_cycle === 'quarterly'
          ? cf.amount / 3
          : cf.fee_cycle === 'yearly'
            ? cf.amount / 12
            : cf.amount;

    components.push({
      student_id: studentId,
      school_id: schoolId,
      fee_category_id: cf.fee_category_id,
      fee_type: 'class-fee',
      fee_name: cf.category_name,
      period_year: year,
      period_month: month,
      period_start: periodStart,
      period_end: periodEnd,
      fee_amount: amount,
      fee_cycle: cf.fee_cycle as any,
      paid_amount: 0,
      pending_amount: amount,
      status: 'pending',
      due_date: dueDate,
      effective_from: cf.start_date
    });
  }

  // Transport Fee
  if (feeStructure.transport_fee && shouldBillThisMonth(feeStructure.transport_fee.fee_cycle, feeStructure.transport_fee.start_date)) {
    const amount = feeStructure.transport_fee.fee_cycle === 'monthly'
      ? feeStructure.transport_fee.amount
      : feeStructure.transport_fee.fee_cycle === 'quarterly'
        ? feeStructure.transport_fee.amount / 3
        : feeStructure.transport_fee.fee_cycle === 'yearly'
          ? feeStructure.transport_fee.amount / 12
          : feeStructure.transport_fee.amount;

    // Transport fee doesn't require fee_category_id (can be null)
    components.push({
      student_id: studentId,
      school_id: schoolId,
      fee_category_id: null, // Transport uses null for fee_category_id
      fee_type: 'transport-fee',
      fee_name: `Transport - ${feeStructure.transport_fee.route_name}`,
      period_year: year,
      period_month: month,
      period_start: periodStart,
      period_end: periodEnd,
      fee_amount: amount,
      fee_cycle: feeStructure.transport_fee.fee_cycle as any,
      transport_route_id: feeStructure.transport_fee.route_id,
      transport_route_name: feeStructure.transport_fee.route_name,
      paid_amount: 0,
      pending_amount: amount,
      status: 'pending',
      due_date: dueDate,
      effective_from: feeStructure.transport_fee.start_date
    });
  }

  // Custom Fees
  for (const customFee of feeStructure.custom_fees) {
    if (shouldBillThisMonth(customFee.fee_cycle, customFee.start_date)) {
      const amount = customFee.fee_cycle === 'monthly'
        ? customFee.amount
        : customFee.fee_cycle === 'quarterly'
          ? customFee.amount / 3
          : customFee.fee_cycle === 'yearly'
            ? customFee.amount / 12
            : customFee.amount;

      components.push({
        student_id: studentId,
        school_id: schoolId,
        fee_category_id: customFee.fee_category_id,
        fee_type: 'custom-fee',
        fee_name: customFee.category_name,
        period_year: year,
        period_month: month,
        period_start: periodStart,
        period_end: periodEnd,
        fee_amount: amount,
        fee_cycle: customFee.fee_cycle as any,
        paid_amount: 0,
        pending_amount: amount,
        status: 'pending',
        due_date: dueDate,
        effective_from: customFee.start_date
      });
    }
  }

  return components;
}

/**
 * @deprecated Use PostgreSQL RPC function get_student_monthly_ledger instead
 * This function performs aggregation in Node.js which doesn't scale.
 * 
 * Replaced by: adminSupabase.rpc('get_student_monthly_ledger', { ... })
 * 
 * Migration: All ledger logic moved to database for better performance.
 * See migration: 1022_student_monthly_ledger_rpc.sql
 */
export async function getMonthlyFeeLedger(
  studentId: string,
  schoolId: string,
  adminSupabase: any,
  startYear?: number,
  endYear?: number,
  page: number = 1,
  limit: number = 24
): Promise<{
  data: Array<{
    month: string;
    year: number;
    monthNumber: number;
    components: Array<{
      id: string;
      fee_type: string;
      fee_name: string;
      fee_amount: number;
      paid_amount: number;
      pending_amount: number;
      status: string;
      due_date?: string;
    }>;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}> {
  const currentYear = new Date().getFullYear();
  const start = startYear || currentYear - 1;
  const end = endYear || currentYear + 1;

  // Step 1: Get distinct months (paginated) - most recent first
  // This is much more efficient than loading all components
  const { data: allMonths, error: monthsError } = await adminSupabase
    .from('monthly_fee_components')
    .select('period_year, period_month')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .gte('period_year', start)
    .lte('period_year', end);

  if (monthsError) {
    throw new Error(`Failed to get monthly fee ledger months: ${monthsError.message}`);
  }

  // Get unique months and sort by most recent first
  const uniqueMonthsSet = new Set<string>();
  const uniqueMonthsArray: Array<{ year: number; month: number }> = [];
  
  (allMonths || []).forEach((m: any) => {
    const key = `${m.period_year}-${m.period_month}`;
    if (!uniqueMonthsSet.has(key)) {
      uniqueMonthsSet.add(key);
      uniqueMonthsArray.push({ year: m.period_year, month: m.period_month });
    }
  });

  // Sort by most recent first (DESC)
  uniqueMonthsArray.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  // Calculate pagination
  const totalMonths = uniqueMonthsArray.length;
  const totalPages = Math.ceil(totalMonths / limit);
  const offset = (page - 1) * limit;
  const paginatedMonths = uniqueMonthsArray.slice(offset, offset + limit);

  // Step 2: Get components only for the paginated months
  // Build filter for specific months
  if (paginatedMonths.length === 0) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: totalMonths,
        total_pages: totalPages
      }
    };
  }

  // Step 2: Get components for paginated months
  // Create a Set for fast lookup of paginated months
  const paginatedMonthsSet = new Set(paginatedMonths.map(m => `${m.year}-${m.month}`));

  // Get all components for the date range (but only required columns - huge improvement!)
  // Then filter to paginated months in memory
  // This is still much more efficient than loading all columns with select('*')
  const { data: allComponents, error } = await adminSupabase
    .from('monthly_fee_components')
    .select('id, period_year, period_month, fee_type, fee_name, fee_amount, paid_amount, pending_amount, status, due_date')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .gte('period_year', start)
    .lte('period_year', end)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false });

  // Filter to only paginated months (fast Set lookup)
  const components = (allComponents || []).filter((comp: any) => 
    paginatedMonthsSet.has(`${comp.period_year}-${comp.period_month}`)
  );

  if (error) {
    throw new Error(`Failed to get monthly fee ledger: ${error.message}`);
  }

  // Group by month
  const monthMap = new Map<string, any>();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  (components || []).forEach((comp: any) => {
    const monthKey = `${comp.period_year}-${comp.period_month}`;
    const monthLabel = `${monthNames[comp.period_month - 1]} ${comp.period_year}`;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        month: monthLabel,
        year: comp.period_year,
        monthNumber: comp.period_month,
        components: []
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = comp.due_date ? new Date(comp.due_date) : null;
    if (dueDate) dueDate.setHours(0, 0, 0, 0);
    
    let status = comp.status;
    
    // Check if overdue (only for pending/partially-paid status)
    if ((status === 'pending' || status === 'partially-paid') && dueDate && dueDate < today) {
      status = 'overdue';
    }

    monthMap.get(monthKey).components.push({
      id: comp.id,
      fee_type: comp.fee_type,
      fee_name: comp.fee_name,
      fee_amount: parseFloat(comp.fee_amount || 0),
      paid_amount: parseFloat(comp.paid_amount || 0),
      pending_amount: parseFloat(comp.pending_amount || 0),
      status: status,
      due_date: comp.due_date
    });
  });

  // Convert to array and sort (most recent first)
  // Ensure months are in the same order as paginatedMonths
  const data = paginatedMonths.map(({ year, month }) => {
    const monthKey = `${year}-${month}`;
    return monthMap.get(monthKey) || {
      month: `${monthNames[month - 1]} ${year}`,
      year,
      monthNumber: month,
      components: []
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total: totalMonths,
      total_pages: totalPages
    }
  };
}

/**
 * Check if monthly fee components exist for a student (READ-ONLY)
 * This is safe to call during requests - it only checks, doesn't write
 * 
 * Returns true if components exist for current month, false otherwise
 */
export async function checkMonthlyFeeComponentsExist(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<boolean> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Quick check: see if any components exist for current month
  const { data: existing, error } = await adminSupabase
    .from('monthly_fee_components')
    .select('id')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('period_year', currentYear)
    .eq('period_month', currentMonth)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[checkMonthlyFeeComponentsExist] Error:', error);
    // On error, assume components don't exist (safer than assuming they do)
    return false;
  }

  return !!existing;
}

/** Natural key: student + month + fee line (matches partial unique indexes). */
export async function monthlyFeeComponentRowExists(
  adminSupabase: any,
  params: {
    student_id: string;
    school_id: string;
    period_year: number;
    period_month: number;
    fee_type: string;
    fee_category_id: string | null;
    transport_route_id?: string | null;
  }
): Promise<boolean> {
  let q = adminSupabase
    .from('monthly_fee_components')
    .select('id')
    .eq('student_id', params.student_id)
    .eq('school_id', params.school_id)
    .eq('period_year', params.period_year)
    .eq('period_month', params.period_month)
    .eq('fee_type', params.fee_type);

  if (params.fee_type === 'transport-fee') {
    q = q.is('fee_category_id', null);
    if (params.transport_route_id) {
      q = q.eq('transport_route_id', params.transport_route_id);
    } else {
      q = q.is('transport_route_id', null);
    }
  } else if (params.fee_category_id) {
    q = q.eq('fee_category_id', params.fee_category_id);
  } else {
    q = q.is('fee_category_id', null);
  }

  const { data, error } = await q.limit(1);
  if (error) {
    throw new Error(`monthlyFeeComponentRowExists: ${error.message}`);
  }
  return Array.isArray(data) && data.length > 0;
}

/**
 * Generate monthly fee components for a student (WRITE OPERATION)
 * 
 * ⚠️ WARNING: This performs database writes (INSERT/UPDATE)
 * ⚠️ DO NOT call this during request handling
 * ⚠️ Use in background jobs/cron only
 * 
 * This function should be called by:
 * - Daily cron job (generate for current month)
 * - Background worker (generate for new students)
 * - Admin script (bulk generation)
 */
export async function generateMonthlyFeeComponentsForStudent(
  studentId: string,
  schoolId: string,
  adminSupabase: any,
  targetYear?: number,
  targetMonth?: number
): Promise<{ generated: number; updated: number }> {
  const today = new Date();
  const currentYear = targetYear || today.getFullYear();
  const currentMonth = targetMonth || today.getMonth() + 1;

  const { data: studentRow, error: studentLoadErr } = await adminSupabase
    .from('students')
    .select('id, class_group_id, admission_date')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .single();

  if (studentLoadErr || !studentRow) {
    throw new Error('Student not found');
  }

  const admissionDate = studentRow.admission_date ? new Date(studentRow.admission_date) : new Date(currentYear, 0, 1);
  const admissionYear = admissionDate.getFullYear();
  const admissionMonth = admissionDate.getMonth() + 1;

  let generated = 0;

  const endYear = targetYear || currentYear;
  const endMonth = targetMonth || currentMonth;

  /** Per-run cache: same output as uncached (includes student-specific overrides/transport). Key = school|student|as-of date. */
  const structureCache = new Map<string, FeeStructure>();

  for (let year = admissionYear; year <= endYear; year++) {
    const startMonth = year === admissionYear ? admissionMonth : 1;
    const monthLimit = year === endYear ? endMonth : 12;

    for (let month = startMonth; month <= monthLimit; month++) {
      const asOfDate = lastDayOfMonth(year, month);
      const structureCacheKey = `${schoolId}|${studentId}|${toLocalYmd(asOfDate)}`;
      let feeStructure = structureCache.get(structureCacheKey);
      if (!feeStructure) {
        feeStructure = await loadAssignedFeeStructureAsOf(studentId, schoolId, adminSupabase, asOfDate, {
          student: studentRow as FeeStructureStudentRow,
        });
        structureCache.set(structureCacheKey, feeStructure);
      }

      const hasAny =
        feeStructure.class_fees.length > 0 ||
        !!feeStructure.transport_fee ||
        feeStructure.custom_fees.length > 0;
      if (!hasAny) {
        continue;
      }

      const components = await generateMonthlyFeeComponents(
        studentId,
        schoolId,
        year,
        month,
        feeStructure,
        adminSupabase
      );

      for (const component of components) {
        const exists = await monthlyFeeComponentRowExists(adminSupabase, {
          student_id: component.student_id,
          school_id: component.school_id,
          period_year: component.period_year,
          period_month: component.period_month,
          fee_type: component.fee_type,
          fee_category_id: component.fee_category_id ?? null,
          transport_route_id: component.transport_route_id ?? null
        });

        if (exists) {
          continue;
        }

        const { error: insertErr } = await adminSupabase.from('monthly_fee_components').insert(component);
        if (insertErr?.code === '23505') {
          continue;
        }
        if (insertErr) {
          throw new Error(insertErr.message);
        }
        generated++;
      }
    }
  }

  return { generated, updated: 0 };
}

/**
 * @deprecated Use checkMonthlyFeeComponentsExist() for read-only checks
 * This function performs writes and should NOT be called during requests
 * 
 * Kept for backward compatibility - will be removed in future version
 */
export async function ensureMonthlyFeeComponentsExist(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<void> {
  console.warn('[ensureMonthlyFeeComponentsExist] DEPRECATED: This function performs writes. Use checkMonthlyFeeComponentsExist() for read-only checks.');
  // For now, just check - don't generate during requests
  // Generation should be done by cron job
  await checkMonthlyFeeComponentsExist(studentId, schoolId, adminSupabase);
}

