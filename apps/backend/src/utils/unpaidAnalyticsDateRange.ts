/**
 * Date window for unpaid fee analytics (must match clerk-fees /analytics/unpaid RPC params).
 */
export type AnalyticsDateWindow = {
  startDateStr: string | null;
  endDateStr: string | null;
  /** Calendar month/year at end of window (used for on-demand fee generation) */
  endYear: number;
  endMonth: number;
};

/**
 * Mirrors the time_scope logic in GET /clerk-fees/analytics/unpaid
 */
export function getUnpaidAnalyticsDateRange(timeScope: string): AnalyticsDateWindow {
  const today = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;
  const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);

  switch (timeScope) {
    case 'all_time':
      break;
    case 'last_month':
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = lastDayOfPreviousMonth;
      break;
    case 'last_2_months':
      startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      endDate = lastDayOfPreviousMonth;
      break;
    case 'last_3_months':
      startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      endDate = lastDayOfPreviousMonth;
      break;
    case 'last_6_months':
      startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      endDate = lastDayOfPreviousMonth;
      break;
    case 'current_academic_year': {
      const currentMonth = today.getMonth();
      startDate =
        currentMonth >= 3
          ? new Date(today.getFullYear(), 3, 1)
          : new Date(today.getFullYear() - 1, 3, 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      break;
    }
    case 'custom':
      // Query params not wired yet; match clerk-fees fallback
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = lastDayOfPreviousMonth;
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      endDate = lastDayOfPreviousMonth;
      break;
  }

  const end = endDate ?? today;
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  return {
    startDateStr: startDate ? startDate.toISOString().split('T')[0] : null,
    endDateStr: endDate ? endDate.toISOString().split('T')[0] : null,
    endYear,
    endMonth,
  };
}
