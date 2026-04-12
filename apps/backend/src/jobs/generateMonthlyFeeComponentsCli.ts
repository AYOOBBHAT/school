/**
 * CLI: generate monthly_fee_components for a given year/month (all active students).
 * Usage: pnpm run job:generate-monthly-fees -- [year] [month] [schoolId?]
 * Example: pnpm run job:generate-monthly-fees -- 2026 4
 */
import { generateMonthlyFeeComponentsJob } from './generateMonthlyFeeComponents.js';

const args = process.argv.slice(2);
const year = args[0] ? parseInt(args[0], 10) : undefined;
const month = args[1] ? parseInt(args[1], 10) : undefined;
const schoolId = args[2] || undefined;

generateMonthlyFeeComponentsJob(year, month, schoolId)
  .then((result) => {
    console.log('Job completed:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error('Job failed:', error);
    process.exit(1);
  });
