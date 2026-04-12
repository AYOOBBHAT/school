# Monthly fee component generation (`monthly_fee_components`)

## Audit (why data stopped at Jan 2026)

1. **Generation logic** lives in `src/utils/clerkFeeCollection.ts`:
   - `generateMonthlyFeeComponents()` — builds rows for one student × month from assigned fee structure.
   - `generateMonthlyFeeComponentsForStudent()` — loops from admission through **target year/month** and upserts rows.

2. **Batch job** — `src/jobs/generateMonthlyFeeComponents.ts`:
   - `generateMonthlyFeeComponentsJob(targetYear?, targetMonth?, schoolId?)` loads all **active** students and calls `generateMonthlyFeeComponentsForStudent` for the given month (default: **today’s** year/month).

3. **Automatic generation today**
   - **Not** run from API request paths: `checkMonthlyFeeComponentsExist()` is read-only; comments say generation is for cron only.
   - Until enabled, **nothing** creates Feb/Mar/Apr rows if the job never ran.

4. **Gap**
   - If the daily/scheduled job was **never deployed** (or last manual run targeted Jan 2026 only), later months simply **do not exist**, so any feature that depends on `monthly_fee_components` for those months sees **empty** results.

## Temporary backfill (SQL)

Migration `1057_backfill_monthly_fee_components_2026_feb_apr.sql` clones **Jan 2026** rows into **Feb–Apr 2026** where missing (`paid_amount = 0`, `pending_amount = fee_amount`, `status = pending`).  
Students **without** Jan 2026 rows are unchanged — run the Node job for those.

## Long-term operations

| Option | Implementation |
|--------|----------------|
| **A — Cron (recommended)** | Set `ENABLE_MONTHLY_FEE_GENERATION_CRON=true` on the backend. Daily at **02:00** (optional `CRON_TIMEZONE`) runs `generateMonthlyFeeComponentsJob()` for the **current** month. |
| **B — On-demand** | Run `pnpm run job:generate-monthly-fees -- <year> <month> [schoolId]` from `apps/backend` (uses service role via existing env). Repeat for each missing month if needed. |
| **C — Startup catch-up** | Set `FEE_GENERATION_ON_STARTUP=true` to run one job when the server boots (current month only; may be slow for huge schools). |

## Data continuity rule

For each billable month, inserts use `fee_amount`, `paid_amount = 0`, `pending_amount = fee_amount`, `status = pending` (until payments update via existing triggers/RPCs).

## Do not tie to analytics

Keep generation **out of** analytics routes; use cron, CLI, or SQL backfill so analytics stays read-only on fee generation.
