import logger from './logger.js';
import { adminSupabase } from './supabaseAdmin.js';
import { generateMonthlyFeeComponentsForStudent } from './clerkFeeCollection.js';

const DEFAULT_MAX_STUDENTS = 400;
const DEFAULT_ANALYTICS_CONCURRENCY = 5;

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Inclusive calendar months between start and end (date strings YYYY-MM-DD). */
function monthsInRangeInclusive(startStr: string, endStr: string): Array<{ year: number; month: number }> {
  const start = parseYmd(startStr);
  const end = parseYmd(endStr);
  const out: Array<{ year: number; month: number }> = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/**
 * Before analytics: run insert-only fee generation for capped students through the window end.
 * Generation checks each expected line (student, month, fee_type, fee_category_id, transport_route_id);
 * existing rows are never updated. A student with only class fee for a month still gets transport/custom
 * inserted on the next pass.
 *
 * `all_time` (no start date): only the window **end** month is reflected in `monthsInRange` for logging.
 *
 * Opt-out: FEE_GENERATION_ON_ANALYTICS=false
 * Cap: FEE_GENERATION_ANALYTICS_MAX_STUDENTS (default 400)
 */
export async function ensureMonthlyFeeComponentsForAnalytics(params: {
  schoolId: string;
  classGroupId: string | null;
  startDateStr: string | null;
  endDateStr: string | null;
  endYear: number;
  endMonth: number;
}): Promise<{
  ran: boolean;
  studentsChecked: number;
  studentsGenerated: number;
  generatedRows: number;
  updatedRows: number;
  monthsInRange: number;
  /** Students for whom at least one new component row was inserted. */
  missingMonthsDetected: number;
  errors: number;
}> {
  const empty = {
    ran: false,
    studentsChecked: 0,
    studentsGenerated: 0,
    generatedRows: 0,
    updatedRows: 0,
    monthsInRange: 0,
    missingMonthsDetected: 0,
    errors: 0,
  };

  if (process.env.FEE_GENERATION_ON_ANALYTICS === 'false') {
    return empty;
  }

  const maxStudents = parseInt(process.env.FEE_GENERATION_ANALYTICS_MAX_STUDENTS || '', 10) || DEFAULT_MAX_STUDENTS;

  let q = adminSupabase
    .from('students')
    .select('id, school_id')
    .eq('school_id', params.schoolId)
    .eq('status', 'active');

  if (params.classGroupId) {
    q = q.eq('class_group_id', params.classGroupId);
  }

  const { data: students, error: stErr } = await q;

  if (stErr || !students?.length) {
    logger.warn(
      { schoolId: params.schoolId, err: stErr?.message },
      '[fee-generation-analytics] no students or query error'
    );
    return { ...empty, ran: true, studentsChecked: 0 };
  }

  const capped = students.slice(0, maxStudents);
  if (students.length > maxStudents) {
    logger.warn(
      {
        schoolId: params.schoolId,
        total: students.length,
        maxStudents,
      },
      '[fee-generation-analytics] student cap applied — increase FEE_GENERATION_ANALYTICS_MAX_STUDENTS if needed'
    );
  }

  const months =
    params.startDateStr && params.endDateStr
      ? monthsInRangeInclusive(params.startDateStr, params.endDateStr)
      : [{ year: params.endYear, month: params.endMonth }];

  const monthsInRange = months.length;

  logger.info(
    {
      schoolId: params.schoolId,
      endYear: params.endYear,
      endMonth: params.endMonth,
      monthsInRange,
      studentsToProcess: capped.length,
    },
    '[fee-generation-analytics] running per-component insert-only generation for all capped students'
  );

  let generatedRows = 0;
  let updatedRows = 0;
  let errors = 0;
  let studentsWithNewComponents = 0;

  const concurrencyRaw = parseInt(process.env.FEE_GENERATION_ANALYTICS_CONCURRENCY || '', 10);
  const concurrency =
    Number.isFinite(concurrencyRaw) && concurrencyRaw > 0
      ? Math.min(concurrencyRaw, 20)
      : DEFAULT_ANALYTICS_CONCURRENCY;

  if (process.env.NODE_ENV === 'development') {
    console.time('fee-generation-analytics');
  }

  for (let i = 0; i < capped.length; i += concurrency) {
    const batch = capped.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(({ id: studentId }) =>
        generateMonthlyFeeComponentsForStudent(
          studentId,
          params.schoolId,
          adminSupabase,
          params.endYear,
          params.endMonth
        )
      )
    );

    for (let j = 0; j < results.length; j++) {
      const studentId = batch[j].id;
      const r = results[j];
      if (r.status === 'fulfilled') {
        generatedRows += r.value.generated;
        updatedRows += r.value.updated;
        if (r.value.generated > 0) {
          studentsWithNewComponents++;
        }
      } else {
        errors++;
        const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        logger.error(
          { schoolId: params.schoolId, studentId, err: errMsg },
          '[fee-generation-analytics] generateMonthlyFeeComponentsForStudent failed'
        );
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.timeEnd('fee-generation-analytics');
  }

  logger.info(
    {
      schoolId: params.schoolId,
      studentsProcessed: capped.length,
      studentsWithNewComponents,
      generatedRows,
      updatedRows,
      errors,
      monthsInRange,
      endYear: params.endYear,
      endMonth: params.endMonth,
    },
    '[fee-generation-analytics] ensure completed'
  );

  return {
    ran: true,
    studentsChecked: capped.length,
    studentsGenerated: capped.length - errors,
    generatedRows,
    updatedRows,
    monthsInRange,
    missingMonthsDetected: studentsWithNewComponents,
    errors,
  };
}
