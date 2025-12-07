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

interface FeeStructure {
  class_fee?: {
    fee_category_id: string;
    category_name: string;
    amount: number;
    fee_cycle: string;
    billing_frequency: string;
    start_date: string;
  };
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

/**
 * Load assigned fee structure for a student
 */
export async function loadAssignedFeeStructure(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<FeeStructure> {
  const today = new Date().toISOString().split('T')[0];

  // Get student details
  const { data: student, error: studentError } = await adminSupabase
    .from('students')
    .select('id, class_group_id, admission_date')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const admissionDate = student.admission_date || today;
  const result: FeeStructure = { custom_fees: [] };

  // 1. Get Class Fee
  if (student.class_group_id) {
    const { data: classFeeDefaults } = await adminSupabase
      .from('class_fee_defaults')
      .select(`
        id,
        fee_category_id,
        amount,
        fee_cycle,
        fee_categories:fee_category_id(id, name)
      `)
      .eq('class_group_id', student.class_group_id)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (classFeeDefaults) {
      // Check for student-specific override
      const { data: override } = await adminSupabase
        .from('student_fee_overrides')
        .select('*')
        .eq('student_id', studentId)
        .eq('fee_category_id', classFeeDefaults.fee_category_id)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      let finalAmount = parseFloat(classFeeDefaults.amount || 0);
      if (override) {
        if (override.is_full_free) {
          finalAmount = 0;
        } else if (override.custom_fee_amount) {
          finalAmount = parseFloat(override.custom_fee_amount);
        } else if (override.discount_amount) {
          finalAmount = Math.max(0, finalAmount - parseFloat(override.discount_amount));
        }
      }

      result.class_fee = {
        fee_category_id: classFeeDefaults.fee_category_id,
        category_name: classFeeDefaults.fee_categories?.name || 'Class Fee',
        amount: finalAmount,
        fee_cycle: classFeeDefaults.fee_cycle,
        billing_frequency: classFeeDefaults.fee_cycle,
        start_date: admissionDate
      };
    }
  }

  // 2. Get Transport Fee (if assigned)
  const { data: studentTransport } = await adminSupabase
    .from('student_transport')
    .select(`
      route_id,
      transport_routes:route_id(id, route_name)
    `)
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (studentTransport && studentTransport.route_id) {
    const { data: transportFee } = await adminSupabase
      .from('transport_fees')
      .select(`
        id,
        base_fee,
        escort_fee,
        fuel_surcharge,
        fee_cycle
      `)
      .eq('route_id', studentTransport.route_id)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (transportFee) {
      const totalAmount = parseFloat(transportFee.base_fee || 0) +
                         parseFloat(transportFee.escort_fee || 0) +
                         parseFloat(transportFee.fuel_surcharge || 0);

      result.transport_fee = {
        route_id: studentTransport.route_id,
        route_name: studentTransport.transport_routes?.route_name || 'Transport',
        amount: totalAmount,
        fee_cycle: transportFee.fee_cycle,
        billing_frequency: transportFee.fee_cycle,
        start_date: admissionDate
      };
    }
  }

  // 3. Get Custom Fees
  const { data: customFeeCategories } = await adminSupabase
    .from('fee_categories')
    .select('id')
    .eq('school_id', schoolId)
    .eq('fee_type', 'custom')
    .eq('is_active', true);

  if (customFeeCategories && customFeeCategories.length > 0) {
    const customCategoryIds = customFeeCategories.map((cat: any) => cat.id);

    const { data: customFees } = await adminSupabase
      .from('optional_fee_definitions')
      .select(`
        id,
        fee_category_id,
        amount,
        fee_cycle,
        class_group_id,
        fee_categories:fee_category_id(id, name)
      `)
      .in('fee_category_id', customCategoryIds)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .or(`class_group_id.eq.${student.class_group_id},class_group_id.is.null`);

    if (customFees) {
      for (const customFee of customFees) {
        // Check for student override
        const { data: override } = await adminSupabase
          .from('student_fee_overrides')
          .select('*')
          .eq('student_id', studentId)
          .eq('fee_category_id', customFee.fee_category_id)
          .eq('is_active', true)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .limit(1)
          .maybeSingle();

        let finalAmount = parseFloat(customFee.amount || 0);
        if (override) {
          if (override.is_full_free) {
            finalAmount = 0;
          } else if (override.custom_fee_amount) {
            finalAmount = parseFloat(override.custom_fee_amount);
          } else if (override.discount_amount) {
            finalAmount = Math.max(0, finalAmount - parseFloat(override.discount_amount));
          }
        }

        result.custom_fees.push({
          fee_category_id: customFee.fee_category_id,
          category_name: customFee.fee_categories?.name || 'Custom Fee',
          amount: finalAmount,
          fee_cycle: customFee.fee_cycle,
          billing_frequency: customFee.fee_cycle,
          start_date: admissionDate
        });
      }
    }
  }

  return result;
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

  // Class Fee
  if (feeStructure.class_fee && shouldBillThisMonth(feeStructure.class_fee.fee_cycle, feeStructure.class_fee.start_date)) {
    const amount = feeStructure.class_fee.fee_cycle === 'monthly' 
      ? feeStructure.class_fee.amount 
      : feeStructure.class_fee.fee_cycle === 'quarterly'
        ? feeStructure.class_fee.amount / 3
        : feeStructure.class_fee.fee_cycle === 'yearly'
          ? feeStructure.class_fee.amount / 12
          : feeStructure.class_fee.amount;

    components.push({
      student_id: studentId,
      school_id: schoolId,
      fee_category_id: feeStructure.class_fee.fee_category_id,
      fee_type: 'class-fee',
      fee_name: feeStructure.class_fee.category_name,
      period_year: year,
      period_month: month,
      period_start: periodStart,
      period_end: periodEnd,
      fee_amount: amount,
      fee_cycle: feeStructure.class_fee.fee_cycle as any,
      paid_amount: 0,
      pending_amount: amount,
      status: 'pending',
      due_date: dueDate,
      effective_from: feeStructure.class_fee.start_date
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
 * Get monthly fee ledger for a student (all months with status)
 */
export async function getMonthlyFeeLedger(
  studentId: string,
  schoolId: string,
  adminSupabase: any,
  startYear?: number,
  endYear?: number
): Promise<Array<{
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
}>> {
  const currentYear = new Date().getFullYear();
  const start = startYear || currentYear - 1;
  const end = endYear || currentYear + 1;

  // Get all monthly fee components for the student
  const { data: components, error } = await adminSupabase
    .from('monthly_fee_components')
    .select('*')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .gte('period_year', start)
    .lte('period_year', end)
    .order('period_year', { ascending: true })
    .order('period_month', { ascending: true });

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

  // Convert to array and sort
  return Array.from(monthMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });
}

/**
 * Ensure monthly fee components exist for a student up to current month
 */
export async function ensureMonthlyFeeComponentsExist(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<void> {
  const feeStructure = await loadAssignedFeeStructure(studentId, schoolId, adminSupabase);
  
  // Check if no fee is assigned
  if (!feeStructure.class_fee && !feeStructure.transport_fee && feeStructure.custom_fees.length === 0) {
    return; // No fee configured
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Get student admission date
  const { data: student } = await adminSupabase
    .from('students')
    .select('admission_date')
    .eq('id', studentId)
    .single();

  const admissionDate = student?.admission_date ? new Date(student.admission_date) : new Date(currentYear, 0, 1);
  const admissionYear = admissionDate.getFullYear();
  const admissionMonth = admissionDate.getMonth() + 1;

  // Generate components from admission to current month
  for (let year = admissionYear; year <= currentYear; year++) {
    const startMonth = year === admissionYear ? admissionMonth : 1;
    const endMonth = year === currentYear ? currentMonth : 12;

    for (let month = startMonth; month <= endMonth; month++) {
      const components = await generateMonthlyFeeComponents(
        studentId,
        schoolId,
        year,
        month,
        feeStructure,
        adminSupabase
      );

      // Upsert each component
      for (const component of components) {
        // Check if component already exists
        let query = adminSupabase
          .from('monthly_fee_components')
          .select('id, paid_amount, pending_amount, status')
          .eq('student_id', component.student_id)
          .eq('period_year', component.period_year)
          .eq('period_month', component.period_month)
          .eq('fee_type', component.fee_type);
        
        // Handle fee_category_id (can be null/empty for transport)
        if (component.fee_category_id && component.fee_type !== 'transport-fee') {
          query = query.eq('fee_category_id', component.fee_category_id);
        } else {
          // For transport fees or when fee_category_id is null
          query = query.is('fee_category_id', null);
        }
        
        const { data: existing } = await query.maybeSingle();

        if (existing) {
          // Update fee_amount if changed, but preserve payment info
          await adminSupabase
            .from('monthly_fee_components')
            .update({
              fee_amount: component.fee_amount,
              pending_amount: Math.max(0, component.fee_amount - parseFloat(existing.paid_amount || 0)),
              fee_name: component.fee_name,
              transport_route_id: component.transport_route_id,
              transport_route_name: component.transport_route_name,
              due_date: component.due_date,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Insert new component
          await adminSupabase
            .from('monthly_fee_components')
            .insert(component);
        }
      }
    }
  }
}

