import cron from 'node-cron';
import logger from '../utils/logger.js';
import { generateMonthlyFeeComponentsJob } from './generateMonthlyFeeComponents.js';

/**
 * Schedules daily generation of monthly_fee_components for the current calendar month
 * for all active students (uses generateMonthlyFeeComponentsForStudent).
 *
 * Opt-in: set ENABLE_MONTHLY_FEE_GENERATION_CRON=true
 * Schedule: 02:00 server local time every day (see cron expression below).
 */
export function scheduleMonthlyFeeGeneration(): void {
  if (process.env.ENABLE_MONTHLY_FEE_GENERATION_CRON !== 'true') {
    logger.info(
      'Monthly fee generation cron is off (set ENABLE_MONTHLY_FEE_GENERATION_CRON=true to enable daily job)'
    );
    return;
  }

  const cronOpts =
    process.env.CRON_TIMEZONE && process.env.CRON_TIMEZONE.length > 0
      ? { timezone: process.env.CRON_TIMEZONE }
      : undefined;

  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        logger.info('[fee-generation-cron] started');
        const result = await generateMonthlyFeeComponentsJob();
        logger.info({ result }, '[fee-generation-cron] completed');
      } catch (err) {
        logger.error({ err }, '[fee-generation-cron] failed');
      }
    },
    cronOpts
  );

  logger.info('[fee-generation-cron] scheduled daily at 02:00 (server TZ or CRON_TIMEZONE)');

  if (process.env.FEE_GENERATION_ON_STARTUP === 'true') {
    void (async () => {
      try {
        logger.info('[fee-generation-startup] running catch-up for current month');
        const result = await generateMonthlyFeeComponentsJob();
        logger.info({ result }, '[fee-generation-startup] completed');
      } catch (err) {
        logger.error({ err }, '[fee-generation-startup] failed');
      }
    })();
  }
}
