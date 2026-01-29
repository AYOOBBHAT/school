import { API_URL } from '../utils/api';
import { ROUTES } from '../utils/apiRoutes';
import { supabase } from '../utils/supabase';
import type { UnpaidFeeAnalyticsResponse } from './types';

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
    const error = await response.json().catch(() => ({ error: 'Failed to load analytics' }));
    throw new Error(error.error || 'Failed to load analytics');
  }

  const data = await response.json();
  const result = data.analytics || data;

  // Ensure pagination exists
  if (!result.pagination) {
    result.pagination = {
      page: 1,
      limit: result.students?.length || 10,
      total: result.students?.length || 0,
      total_pages: 1,
    };
  }

  return result;
};
