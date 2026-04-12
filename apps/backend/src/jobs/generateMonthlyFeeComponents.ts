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
 * When `schoolId` is omitted, processing runs **per school** (distinct school_id from students)
 * to avoid one unbounded global scan and to isolate failures per tenant.
 */

import { adminSupabase } from '../utils/supabaseAdmin.js';
import { generateMonthlyFeeComponentsForStudent } from '../utils/clerkFeeCollection.js';
import logger from '../utils/logger.js';

async function generateMonthlyFeeComponentsForSchool(
  year: number,
  month: number,
  schoolId: string,
  batchSize: number
): Promise<{
  totalStudents: number;
  processed: number;
  generated: number;
  updated: number;
  errors: Array<{ studentId: string; error: string }>;
}> {
  let query = adminSupabase
    .from('students')
    .select('id, school_id, admission_date')
    .eq('status', 'active')
    .eq('school_id', schoolId);

  const { data: students, error: studentsError } = await query;

  if (studentsError) {
    throw new Error(`Failed to fetch students: ${studentsError.message}`);
  }

  if (!students || students.length === 0) {
    logger.info({ schoolId, year, month }, '[generateMonthlyFeeComponentsJob] no active students in school');
    return {
      totalStudents: 0,
      processed: 0,
      generated: 0,
      updated: 0,
      errors: []
    };
  }

  logger.info(
    { schoolId, year, month, totalStudents: students.length },
    '[generateMonthlyFeeComponentsJob] school batch starting'
  );

  let processed = 0;
  let totalGenerated = 0;
  let totalUpdated = 0;
  const errors: Array<{ studentId: string; error: string }> = [];

  for (let i = 0; i < students.length; i += batchSize) {
    const batch = students.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (student: { id: string; school_id: string }) => {
        try {
          const result = await generateMonthlyFeeComponentsForStudent(
            student.id,
            student.school_id,
            adminSupabase,
            year,
            month
          );
          return {
            ok: true as const,
            studentId: student.id,
            generated: result.generated,
            updated: result.updated
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(
            { schoolId, studentId: student.id, err: errorMessage },
            '[generateMonthlyFeeComponentsJob] student failed'
          );
          return { ok: false as const, studentId: student.id, error: errorMessage };
        }
      })
    );

    for (const row of batchResults) {
      if (row.ok) {
        processed++;
        totalGenerated += row.generated;
        totalUpdated += row.updated;
      } else {
        errors.push({ studentId: row.studentId, error: row.error });
      }
    }

    if (i + batchSize < students.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.info(
    {
      schoolId,
      year,
      month,
      processed,
      totalStudents: students.length,
      generated: totalGenerated,
      updated: totalUpdated,
      errorCount: errors.length,
    },
    '[generateMonthlyFeeComponentsJob] school batch completed'
  );

  return {
    totalStudents: students.length,
    processed,
    generated: totalGenerated,
    updated: totalUpdated,
    errors
  };
}

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

  logger.info({ year, month, schoolId: schoolId ?? 'all' }, '[generateMonthlyFeeComponentsJob] starting');

  if (schoolId) {
    return generateMonthlyFeeComponentsForSchool(year, month, schoolId, batchSize);
  }

  const { data: schoolRows, error: schoolsError } = await adminSupabase
    .from('students')
    .select('school_id')
    .eq('status', 'active');

  if (schoolsError) {
    throw new Error(`Failed to list schools from active students: ${schoolsError.message}`);
  }

  const schoolIds = [...new Set((schoolRows || []).map((r: { school_id: string }) => r.school_id).filter(Boolean))];

  if (schoolIds.length === 0) {
    logger.info({ year, month }, '[generateMonthlyFeeComponentsJob] no active students (no schools)');
    return {
      totalStudents: 0,
      processed: 0,
      generated: 0,
      updated: 0,
      errors: []
    };
  }

  logger.info({ year, month, schoolCount: schoolIds.length }, '[generateMonthlyFeeComponentsJob] multi-tenant run');

  let totalStudents = 0;
  let processed = 0;
  let generated = 0;
  let updated = 0;
  const errors: Array<{ studentId: string; error: string }> = [];

  for (const sid of schoolIds) {
    try {
      const r = await generateMonthlyFeeComponentsForSchool(year, month, sid, batchSize);
      totalStudents += r.totalStudents;
      processed += r.processed;
      generated += r.generated;
      updated += r.updated;
      errors.push(...r.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ schoolId: sid, year, month, err: msg }, '[generateMonthlyFeeComponentsJob] school failed');
    }
  }

  logger.info(
    {
      year,
      month,
      schoolCount: schoolIds.length,
      totalStudents,
      processed,
      generated,
      updated,
      errorCount: errors.length,
    },
    '[generateMonthlyFeeComponentsJob] all schools completed'
  );

  return {
    totalStudents,
    processed,
    generated,
    updated,
    errors
  };
}

// CLI: use `pnpm run job:generate-monthly-fees -- [year] [month] [schoolId?]` (see generateMonthlyFeeComponentsCli.ts)
