/**
 * Background Job: Generate Monthly Fee Components
 * 
 * This job should run daily (preferably at night) to generate monthly fee components
 * for all active students for the current month.
 * 
 * ⚠️ CRITICAL: This performs database writes (INSERT/UPDATE)
 * ⚠️ DO NOT run this during request handling
 * ⚠️ Use cron job or background worker only
 * 
 * Setup:
 * 1. Add to cron: 0 2 * * * (runs daily at 2 AM)
 * 2. Or use a job queue (Bull, BullMQ, etc.)
 * 3. Or use Supabase Edge Functions with cron trigger
 */

import { adminSupabase } from '../utils/supabaseAdmin.js';
import { generateMonthlyFeeComponentsForStudent } from '../utils/clerkFeeCollection.js';

/**
 * Generate monthly fee components for all active students
 * 
 * @param targetYear - Year to generate for (default: current year)
 * @param targetMonth - Month to generate for (default: current month)
 * @param schoolId - Optional: generate for specific school only
 * @param batchSize - Number of students to process per batch (default: 100)
 */
export async function generateMonthlyFeeComponentsJob(
  targetYear?: number,
  targetMonth?: number,
  schoolId?: string,
  batchSize: number = 100
): Promise<{
  totalStudents: number;
  processed: number;
  generated: number;
  updated: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
  const today = new Date();
  const year = targetYear || today.getFullYear();
  const month = targetMonth || today.getMonth() + 1;

  console.log(`[generateMonthlyFeeComponentsJob] Starting generation for ${year}-${month}`);

  // Get all active students
  let query = adminSupabase
    .from('students')
    .select('id, school_id, admission_date')
    .eq('status', 'active');

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  const { data: students, error: studentsError } = await query;

  if (studentsError) {
    throw new Error(`Failed to fetch students: ${studentsError.message}`);
  }

  if (!students || students.length === 0) {
    console.log('[generateMonthlyFeeComponentsJob] No active students found');
    return {
      totalStudents: 0,
      processed: 0,
      generated: 0,
      updated: 0,
      errors: []
    };
  }

  console.log(`[generateMonthlyFeeComponentsJob] Found ${students.length} active students`);

  let processed = 0;
  let totalGenerated = 0;
  let totalUpdated = 0;
  const errors: Array<{ studentId: string; error: string }> = [];

  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);
    console.log(`[generateMonthlyFeeComponentsJob] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(students.length / batchSize)}`);

    // Process batch in parallel (but limit concurrency)
    const batchPromises = batch.map(async (student: any) => {
      try {
        const result = await generateMonthlyFeeComponentsForStudent(
          student.id,
          student.school_id,
          adminSupabase,
          year,
          month
        );
        processed++;
        totalGenerated += result.generated;
        totalUpdated += result.updated;
        return { success: true, studentId: student.id };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[generateMonthlyFeeComponentsJob] Error for student ${student.id}:`, errorMessage);
        errors.push({ studentId: student.id, error: errorMessage });
        return { success: false, studentId: student.id, error: errorMessage };
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to avoid overwhelming the database
    if (i + batchSize < students.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[generateMonthlyFeeComponentsJob] Completed: ${processed}/${students.length} students processed`);
  console.log(`[generateMonthlyFeeComponentsJob] Generated: ${totalGenerated} components, Updated: ${totalUpdated} components`);

  return {
    totalStudents: students.length,
    processed,
    generated: totalGenerated,
    updated: totalUpdated,
    errors
  };
}

/**
 * CLI entry point (for manual execution or cron)
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const year = args[0] ? parseInt(args[0]) : undefined;
  const month = args[1] ? parseInt(args[1]) : undefined;
  const schoolId = args[2] || undefined;

  generateMonthlyFeeComponentsJob(year, month, schoolId)
    .then(result => {
      console.log('Job completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}
