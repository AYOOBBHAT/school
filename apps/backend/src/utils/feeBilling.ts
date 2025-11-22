/**
 * Fee Billing Utilities
 * Handles period generation, bill creation, and payment tracking
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

interface Period {
  student_id: string;
  school_id: string;
  period_type: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  period_year: number;
  period_month?: number;
  period_quarter?: number;
  period_start: Date;
  period_end: Date;
  status: 'pending' | 'billed' | 'partially-paid' | 'paid' | 'overdue' | 'waived';
}

/**
 * Generate fee schedule periods for a student based on their fee cycles
 */
export async function generateStudentFeeSchedule(
  studentId: string,
  schoolId: string,
  academicYear: number,
  adminSupabase: any
): Promise<Period[]> {
  // 1. Get student's fee cycles
  const { data: cycles, error: cyclesError } = await adminSupabase
    .from('student_fee_cycles')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_active', true);

  if (cyclesError) throw new Error(`Failed to get fee cycles: ${cyclesError.message}`);

  // If no cycles set, use class default (monthly)
  if (!cycles || cycles.length === 0) {
    // Create default monthly cycle
    const { error: createError } = await adminSupabase
      .from('student_fee_cycles')
      .insert({
        student_id: studentId,
        school_id: schoolId,
        fee_cycle: 'monthly',
        effective_from: new Date(academicYear, 0, 1).toISOString().split('T')[0],
        is_active: true
      });

    if (createError) throw new Error(`Failed to create default cycle: ${createError.message}`);
    
    cycles.push({
      student_id: studentId,
      school_id: schoolId,
      fee_cycle: 'monthly',
      effective_from: new Date(academicYear, 0, 1).toISOString().split('T')[0]
    });
  }

  // 2. Get student details
  const { data: student, error: studentError } = await adminSupabase
    .from('students')
    .select('admission_date, class_group_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    throw new Error('Student not found');
  }

  const admissionDate = student.admission_date 
    ? new Date(student.admission_date) 
    : new Date(academicYear, 0, 1);
  
  const periods: Period[] = [];

  // 3. Generate periods for each cycle
  for (const cycle of cycles) {
    const effectiveFrom = new Date(cycle.effective_from);
    const effectiveTo = cycle.effective_to ? new Date(cycle.effective_to) : null;
    const yearEnd = new Date(academicYear, 11, 31);

    if (cycle.fee_cycle === 'monthly') {
      let currentDate = new Date(Math.max(admissionDate.getTime(), effectiveFrom.getTime()));
      const endDate = effectiveTo ? new Date(Math.min(effectiveTo.getTime(), yearEnd.getTime())) : yearEnd;

      while (currentDate <= endDate) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        periods.push({
          student_id: studentId,
          school_id: schoolId,
          period_type: 'monthly',
          period_year: monthStart.getFullYear(),
          period_month: monthStart.getMonth() + 1,
          period_start: monthStart,
          period_end: monthEnd,
          status: 'pending'
        });

        currentDate = new Date(monthEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (cycle.fee_cycle === 'quarterly') {
      const quarters = [
        { start: [0, 1], end: [2, 31], quarter: 1 },   // Q1: Jan-Mar
        { start: [3, 1], end: [5, 30], quarter: 2 },   // Q2: Apr-Jun
        { start: [6, 1], end: [8, 30], quarter: 3 },   // Q3: Jul-Sep
        { start: [9, 1], end: [11, 31], quarter: 4 }   // Q4: Oct-Dec
      ];

      for (const quarter of quarters) {
        const quarterStart = new Date(academicYear, quarter.start[0], quarter.start[1]);
        const quarterEnd = new Date(academicYear, quarter.end[0], quarter.end[1]);

        if (quarterStart >= admissionDate && 
            quarterStart >= effectiveFrom &&
            (!effectiveTo || quarterStart <= effectiveTo)) {
          periods.push({
            student_id: studentId,
            school_id: schoolId,
            period_type: 'quarterly',
            period_year: academicYear,
            period_quarter: quarter.quarter,
            period_start: quarterStart,
            period_end: quarterEnd,
            status: 'pending'
          });
        }
      }
    } else if (cycle.fee_cycle === 'yearly') {
      const yearStart = new Date(academicYear, 0, 1);
      const yearEnd = new Date(academicYear, 11, 31);

      if (yearStart >= admissionDate && 
          yearStart >= effectiveFrom &&
          (!effectiveTo || yearStart <= effectiveTo)) {
        periods.push({
          student_id: studentId,
          school_id: schoolId,
          period_type: 'yearly',
          period_year: academicYear,
          period_start: yearStart,
          period_end: yearEnd,
          status: 'pending'
        });
      }
    }
    // one-time fees are handled separately, no periods needed
  }

  // 4. Insert periods into database (ignore duplicates)
  if (periods.length > 0) {
    const periodsToInsert = periods.map(p => ({
      student_id: p.student_id,
      school_id: p.school_id,
      period_type: p.period_type,
      period_year: p.period_year,
      period_month: p.period_month || null,
      period_quarter: p.period_quarter || null,
      period_start: p.period_start.toISOString().split('T')[0],
      period_end: p.period_end.toISOString().split('T')[0],
      status: p.status
    }));

    const { error: insertError } = await adminSupabase
      .from('fee_bill_periods')
      .upsert(periodsToInsert, {
        onConflict: 'student_id,period_type,period_year,period_month,period_quarter',
        ignoreDuplicates: true
      });

    if (insertError) {
      console.error('Error inserting periods:', insertError);
      // Don't throw, just log - periods might already exist
    }
  }

  return periods;
}

/**
 * Get pending periods for a student
 */
export async function getPendingPeriods(
  studentId: string,
  adminSupabase: any
): Promise<any[]> {
  const { data, error } = await adminSupabase
    .from('fee_bill_periods')
    .select('*')
    .eq('student_id', studentId)
    .in('status', ['pending', 'billed', 'partially-paid', 'overdue'])
    .order('period_start', { ascending: true });

  if (error) throw new Error(`Failed to get pending periods: ${error.message}`);
  return data || [];
}

/**
 * Get overdue periods for a student
 */
export async function getOverduePeriods(
  studentId: string,
  adminSupabase: any
): Promise<any[]> {
  const { data, error } = await adminSupabase
    .from('fee_bill_periods')
    .select(`
      *,
      fee_bills!inner(
        due_date,
        net_amount,
        balance:net_amount - (
          select coalesce(sum(amount_paid), 0)
          from fee_payments
          where bill_id = fee_bills.id
        )
      )
    `)
    .eq('student_id', studentId)
    .in('status', ['billed', 'partially-paid'])
    .lt('fee_bills.due_date', new Date().toISOString().split('T')[0])
    .gt('fee_bills.balance', 0)
    .order('fee_bills.due_date', { ascending: true });

  if (error) throw new Error(`Failed to get overdue periods: ${error.message}`);
  return data || [];
}

/**
 * Get total dues for a student
 */
export async function getStudentTotalDues(
  studentId: string,
  adminSupabase: any
): Promise<{
  total_periods: number;
  paid_periods: number;
  pending_periods: number;
  total_expected: number;
  total_paid: number;
  total_balance: number;
  overdue_amount: number;
}> {
  const { data, error } = await adminSupabase
    .from('fee_bill_periods')
    .select('status, expected_amount, paid_amount, balance_amount')
    .eq('student_id', studentId);

  if (error) throw new Error(`Failed to get student dues: ${error.message}`);

  const periods = data || [];
  
  const result = {
    total_periods: periods.length,
    paid_periods: periods.filter((p: any) => p.status === 'paid').length,
    pending_periods: periods.filter((p: any) => 
      ['pending', 'billed', 'partially-paid', 'overdue'].includes(p.status)
    ).length,
    total_expected: periods.reduce((sum: number, p: any) => 
      sum + parseFloat(p.expected_amount || 0), 0
    ),
    total_paid: periods.reduce((sum: number, p: any) => 
      sum + parseFloat(p.paid_amount || 0), 0
    ),
    total_balance: periods.reduce((sum: number, p: any) => 
      sum + parseFloat(p.balance_amount || 0), 0
    ),
    overdue_amount: periods
      .filter((p: any) => p.status === 'overdue')
      .reduce((sum: number, p: any) => sum + parseFloat(p.balance_amount || 0), 0)
  };

  return result;
}

/**
 * Calculate due date for a period based on class fees
 */
export function calculateDueDate(
  periodStart: Date,
  periodEnd: Date,
  dueDay?: number
): Date {
  if (dueDay && dueDay >= 1 && dueDay <= 31) {
    // Use specified due day of the month
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDay);
    
    // If due day is after period end, use period end
    if (dueDate > periodEnd) {
      return periodEnd;
    }
    
    return dueDate;
  }
  
  // Default: 7 days after period end
  const dueDate = new Date(periodEnd);
  dueDate.setDate(dueDate.getDate() + 7);
  return dueDate;
}

/**
 * Mark overdue periods (should be run as a scheduled job)
 */
export async function markOverduePeriods(adminSupabase: any): Promise<void> {
  const { error } = await adminSupabase.rpc('mark_overdue_periods');
  
  if (error) {
    console.error('Error marking overdue periods:', error);
    throw new Error(`Failed to mark overdue periods: ${error.message}`);
  }
}

