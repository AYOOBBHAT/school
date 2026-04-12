import type { UnpaidFeeAnalyticsResponse } from './types';

type RawSummary = Record<string, unknown> | undefined;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Pick inner payload whether Express flattened RPC or client sees RPC-shaped JSON. */
export function unwrapUnpaidFeeAnalyticsRaw(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const nested =
    r.get_unpaid_fee_analytics ??
    r['get_unpaid_fee_analytics'] ??
    (typeof r.data === 'object' && r.data !== null
      ? (r.data as Record<string, unknown>).get_unpaid_fee_analytics ??
        (r.data as Record<string, unknown>)['get_unpaid_fee_analytics']
      : undefined);

  if (nested && typeof nested === 'object') return nested as Record<string, unknown>;

  if (r.analytics && typeof r.analytics === 'object') return r.analytics as Record<string, unknown>;

  if ('summary' in r && 'students' in r) return r;

  return r;
}

function normalizeSummary(s: RawSummary): UnpaidFeeAnalyticsResponse['summary'] {
  if (!s || typeof s !== 'object') {
    return {
      total_students: 0,
      unpaid_count: 0,
      partially_paid_count: 0,
      paid_count: 0,
      total_unpaid_amount: 0,
    };
  }

  const o = s as Record<string, unknown>;

  return {
    total_students: num(
      o.total_students ?? o.totalStudents,
      0
    ),
    unpaid_count: num(
      o.unpaid_count ?? o.unpaidCount ?? o.unpaid,
      0
    ),
    partially_paid_count: num(
      o.partially_paid_count ?? o.partiallyPaidCount ?? o.partial ?? o.partially_paid,
      0
    ),
    paid_count: num(
      o.paid_count ?? o.paidCount ?? o.paid,
      0
    ),
    total_unpaid_amount: num(
      o.total_unpaid_amount ?? o.totalUnpaidAmount,
      0
    ),
  };
}

/**
 * Returns a single UnpaidFeeAnalyticsResponse regardless of API nesting.
 */
export function normalizeUnpaidFeeAnalyticsResponse(raw: unknown): UnpaidFeeAnalyticsResponse {
  const unwrapped = unwrapUnpaidFeeAnalyticsRaw(raw) ?? {};

  const summary = normalizeSummary(unwrapped.summary as RawSummary);

  const chartRaw = unwrapped.chart_data as Record<string, unknown> | undefined;
  const chart_data = {
    paid: num(chartRaw?.paid ?? summary.paid_count, summary.paid_count),
    unpaid: num(chartRaw?.unpaid ?? summary.unpaid_count, summary.unpaid_count),
    partially_paid: num(
      chartRaw?.partially_paid ?? summary.partially_paid_count,
      summary.partially_paid_count
    ),
  };

  const students = Array.isArray(unwrapped.students) ? unwrapped.students : [];

  let pagination = unwrapped.pagination as UnpaidFeeAnalyticsResponse['pagination'] | undefined;
  if (!pagination || typeof pagination !== 'object') {
    pagination = {
      page: 1,
      limit: students.length || 10,
      total: students.length || 0,
      total_pages: 1,
    };
  }

  return {
    summary,
    chart_data,
    students: students as UnpaidFeeAnalyticsResponse['students'],
    pagination,
  };
}
