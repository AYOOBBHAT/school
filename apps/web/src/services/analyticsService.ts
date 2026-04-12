import { API_URL } from '../utils/api';
import { ROUTES } from '../utils/apiRoutes';
import { supabase } from '../utils/supabase';
import type { UnpaidFeeAnalyticsResponse } from './types';
import { normalizeUnpaidFeeAnalyticsResponse } from './unpaidFeeAnalyticsNormalize';

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
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const params = new URLSearchParams({
    time_scope: timeScope,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (classId) {
    params.append('class_group_id', classId);
  }

  const response = await fetch(`${API_URL}${ROUTES.clerkFees}/analytics/unpaid?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

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
