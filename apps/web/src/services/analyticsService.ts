import { ROUTES } from '../utils/apiRoutes';
import type { UnpaidFeeAnalyticsResponse } from './types';
import { normalizeUnpaidFeeAnalyticsResponse } from './unpaidFeeAnalyticsNormalize';
import { apiFetch } from './apiClient';

/**
 * Fetch unpaid fee analytics with filters
 * Single source of truth for all analytics data
 */
export const fetchUnpaidAnalytics = async ({
  classId,
  timeScope,
  page = 1,
  limit = 20,
}: {
  classId?: string;
  timeScope: string;
  page?: number;
  limit?: number;
}): Promise<UnpaidFeeAnalyticsResponse> => {
  const params = new URLSearchParams({
    time_scope: timeScope,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (classId) {
    params.append('class_group_id', classId);
  }

  const response = await apiFetch(`${ROUTES.clerkFees}/analytics/unpaid?${params.toString()}`);

  if (!response.ok) {
    await response.json().catch(() => ({}));
    throw new Error('Failed to load analytics');
  }

  const raw = await response.json();

  if (import.meta.env.DEV) {
    console.log('[unpaid analytics] /clerk-fees/analytics/unpaid raw', raw);
  }

  const normalized = normalizeUnpaidFeeAnalyticsResponse(raw);

  if (import.meta.env.DEV) {
    console.log('[unpaid analytics] summary', normalized.summary);
  }

  return normalized;
};
