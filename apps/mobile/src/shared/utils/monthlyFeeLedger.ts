/**
 * Month-level aggregation for monthly_fee_components (same rules as web).
 */

export type LedgerComponentRow = {
  id?: string;
  fee_type?: string;
  fee_name?: string;
  fee_amount?: number;
  paid_amount?: number;
  pending_amount?: number;
  status?: string;
  due_date?: string | null;
};

export type MonthlyLedgerEntryInput = {
  month?: string;
  year?: number;
  monthNumber?: number;
  period_month?: number;
  period_year?: number;
  components?: LedgerComponentRow[];
};

export type MonthLedgerSummary = {
  monthLabel: string;
  year?: number;
  monthNumber?: number;
  totalFee: number;
  totalPaid: number;
  totalPending: number;
  monthStatus: 'paid' | 'partially-paid' | 'unpaid';
  components: LedgerComponentRow[];
};

export function computeMonthStatus(components: LedgerComponentRow[]): 'paid' | 'partially-paid' | 'unpaid' {
  if (!components.length) return 'unpaid';

  const normalized = components.map((c) => (c.status || '').toLowerCase());

  const allPaid = normalized.every((s) => s === 'paid');
  if (allPaid) return 'paid';

  if (normalized.some((s) => s === 'partially-paid')) return 'partially-paid';

  const hasPaid = normalized.some((s) => s === 'paid');
  const hasUnpaidShape = normalized.some((s) => s === 'pending' || s === 'overdue');
  if (hasPaid && hasUnpaidShape) return 'partially-paid';

  return 'unpaid';
}

export function summarizeLedgerMonth(entry: MonthlyLedgerEntryInput): MonthLedgerSummary {
  const comps = entry.components ?? [];
  const totalFee = comps.reduce((s, c) => s + Number(c.fee_amount ?? 0), 0);
  const totalPaid = comps.reduce((s, c) => s + Number(c.paid_amount ?? 0), 0);
  const totalPending = comps.reduce((s, c) => s + Number(c.pending_amount ?? 0), 0);

  const year = entry.year ?? entry.period_year;
  const monthNumber = entry.monthNumber ?? entry.period_month;

  return {
    monthLabel: entry.month ?? (year && monthNumber ? `${monthNumber}/${year}` : ''),
    year,
    monthNumber,
    totalFee,
    totalPaid,
    totalPending,
    monthStatus: computeMonthStatus(comps),
    components: comps,
  };
}
