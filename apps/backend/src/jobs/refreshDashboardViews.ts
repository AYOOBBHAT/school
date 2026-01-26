/**
 * Background Job: Refresh Dashboard Materialized Views
 * 
 * This job should be run periodically (every 1-5 minutes) to keep
 * materialized views up-to-date with the latest data.
 * 
 * Setup options:
 * 1. Node.js cron: Use node-cron package
 * 2. System cron: Add to crontab
 * 3. Supabase Edge Function: Use pg_cron extension
 * 4. Job queue: Use BullMQ, Bull, or similar
 */

import { adminSupabase } from '../utils/supabaseAdmin.js';

/**
 * Refresh all dashboard materialized views
 * This function calls the PostgreSQL refresh function
 */
export async function refreshDashboardViews(): Promise<void> {
  try {
    const { error } = await adminSupabase.rpc('refresh_dashboard_views');

    if (error) {
      console.error('[refreshDashboardViews] Error refreshing views:', error);
      throw new Error(`Failed to refresh dashboard views: ${error.message}`);
    }

    console.log('[refreshDashboardViews] Successfully refreshed all dashboard views');
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[refreshDashboardViews] Error:', errorMessage);
    throw err;
  }
}

/**
 * Run the refresh job (for direct execution)
 */
if (require.main === module) {
  refreshDashboardViews()
    .then(() => {
      console.log('Dashboard views refresh completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Dashboard views refresh failed:', err);
      process.exit(1);
    });
}
