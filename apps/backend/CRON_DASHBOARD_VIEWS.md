# Dashboard Materialized Views - Auto Refresh Setup

This document explains how to set up automatic refresh of dashboard materialized views.

## Overview

Materialized views precompute heavy aggregations (COUNT, SUM, GROUP BY) to eliminate expensive queries during API requests. They must be refreshed periodically to stay up-to-date.

## Refresh Function

The `refresh_dashboard_views()` PostgreSQL function refreshes all views concurrently (non-blocking).

## Setup Options

### Option 1: Node.js Cron (Recommended for Node.js apps)

Install `node-cron`:
```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

Create `apps/backend/src/cron/dashboardViews.ts`:
```typescript
import cron from 'node-cron';
import { refreshDashboardViews } from '../jobs/refreshDashboardViews.js';

// Refresh every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('[Cron] Refreshing dashboard views...');
  try {
    await refreshDashboardViews();
  } catch (err) {
    console.error('[Cron] Failed to refresh dashboard views:', err);
  }
});

console.log('Dashboard views refresh cron job started (every 2 minutes)');
```

Import in your main server file:
```typescript
import './cron/dashboardViews.js';
```

### Option 2: System Cron (Linux/Mac)

Add to crontab (`crontab -e`):
```bash
# Refresh dashboard views every 2 minutes
*/2 * * * * cd /home/ubuntu/school/apps/backend && node -r ts-node/register src/jobs/refreshDashboardViews.ts
```

### Option 3: Supabase pg_cron Extension (Recommended for Supabase)

Enable pg_cron in Supabase:
```sql
-- Enable pg_cron extension (run in Supabase SQL Editor)
create extension if not exists pg_cron;

-- Schedule refresh every 2 minutes
select cron.schedule(
  'refresh-dashboard-views',
  '*/2 * * * *', -- Every 2 minutes
  $$select refresh_dashboard_views()$$
);

-- Verify schedule
select * from cron.job;
```

### Option 4: Job Queue (BullMQ/Bull)

If you're using a job queue system:

```typescript
import { Queue } from 'bullmq';
import { refreshDashboardViews } from './jobs/refreshDashboardViews.js';

const dashboardQueue = new Queue('dashboard-refresh', {
  connection: { /* Redis config */ }
});

// Add recurring job
await dashboardQueue.add(
  'refresh-views',
  {},
  {
    repeat: {
      pattern: '*/2 * * * *' // Every 2 minutes
    }
  }
);

// Process job
dashboardQueue.process('refresh-views', async () => {
  await refreshDashboardViews();
});
```

## Refresh Frequency

Recommended refresh intervals:
- **High traffic (1M+ users)**: Every 1-2 minutes
- **Medium traffic (100k-1M users)**: Every 2-5 minutes
- **Low traffic (<100k users)**: Every 5-10 minutes

## Manual Refresh

To refresh manually:
```sql
SELECT refresh_dashboard_views();
```

Or via Node.js:
```typescript
import { refreshDashboardViews } from './jobs/refreshDashboardViews.js';
await refreshDashboardViews();
```

## Monitoring

Check view freshness:
```sql
-- Check when views were last refreshed
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE matviewname LIKE 'mv_%';
```

## Performance Impact

- **Refresh time**: 50-200ms (depends on data size)
- **Concurrent refresh**: Non-blocking, allows reads during refresh
- **Storage**: Minimal (views are small, typically <10MB per school)

## Troubleshooting

If views are stale:
1. Check if cron job is running
2. Verify `refresh_dashboard_views()` function exists
3. Check PostgreSQL logs for errors
4. Manually refresh: `SELECT refresh_dashboard_views();`
