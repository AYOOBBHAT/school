import { devError } from '../../../utils/devLog';
import { useState, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';
import { fetchStudentProfile, fetchStudentMonthlyLedger } from '../../../services/student.service';
import { summarizeLedgerMonth, type MonthLedgerSummary } from '../../../utils/monthlyFeeLedger';

/**
 * Loads GET /clerk-fees/student/:studentId/monthly-ledger using the logged-in student's id only (from profile).
 */
export function useStudentMonthlyLedger() {
  const [months, setMonths] = useState<MonthLedgerSummary[]>([]);
  const [rpcSummary, setRpcSummary] = useState<Record<string, number> | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const loadMonthlyLedger = useCallback(async () => {
    setLoadingLedger(true);
    setLedgerError(null);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setLedgerError('Not signed in');
        setMonths([]);
        setRpcSummary(null);
        return;
      }

      const { student } = await fetchStudentProfile(token);
      if (!student?.id) {
        setLedgerError('Student record not found');
        setMonths([]);
        setRpcSummary(null);
        return;
      }

      const data = await fetchStudentMonthlyLedger(token, student.id);
      const raw = data.monthly_ledger || [];
      setMonths(raw.map((e) => summarizeLedgerMonth(e)));
      setRpcSummary(data.summary ?? null);
    } catch (e) {
      devError('[useStudentMonthlyLedger]', e);
      setLedgerError(e instanceof Error ? e.message : 'Failed to load monthly ledger');
      setMonths([]);
      setRpcSummary(null);
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  return { months, rpcSummary, ledgerError, loadingLedger, loadMonthlyLedger };
}
