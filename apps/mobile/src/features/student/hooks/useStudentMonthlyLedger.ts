import { useQuery } from '@tanstack/react-query';
import { loadProfile, loadMonthlyFeeLedger } from '../../../shared/services/student.service';
import { summarizeLedgerMonth, type MonthLedgerSummary } from '../../../shared/utils/monthlyFeeLedger';
import { queryKeys } from '../../../shared/queryKeys';

export function useStudentMonthlyFeeLedger() {
  return useQuery({
    queryKey: queryKeys.student.monthlyFeeLedger(),
    queryFn: async (): Promise<{
      months: MonthLedgerSummary[];
      rpcSummary: Record<string, number> | null;
    }> => {
      const { student } = await loadProfile();
      if (!student?.id) {
        return { months: [], rpcSummary: null };
      }
      const data = await loadMonthlyFeeLedger(student.id);
      const raw = data.monthly_ledger || [];
      return {
        months: raw.map((e) => summarizeLedgerMonth(e)),
        rpcSummary: data.summary ?? null,
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });
}
