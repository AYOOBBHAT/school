import { useState, useCallback } from 'react';
import { supabase } from '../../../utils/supabase';
import { fetchStudentFees } from '../../../services/student.service';

export interface FeeSummary {
  student_id: string;
  total_fee: number;
  paid_amount: number;
  pending_amount: number;
}

export interface FeeBill {
  id: string;
  bill_no: string;
  due_date: string;
  total_amount: number;
  status: 'pending' | 'partial' | 'paid';
  created_at: string;
}

export interface FeePayment {
  id: string;
  bill_id: string | null;
  amount: number;
  payment_date: string;
  method: string;
  created_at: string;
}

export function useStudentFees() {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [bills, setBills] = useState<FeeBill[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFees = useCallback(async () => {
    try {
      setLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('[useStudentFees] No token available');
        return;
      }

      const data = await fetchStudentFees(token);
      console.log('[useStudentFees] Fees loaded:', {
        summary: data.summary,
        bills: data.bills?.length || 0,
        payments: data.payments?.length || 0
      });
      setSummary(data.summary || null);
      setBills(data.bills || []);
      setPayments(data.payments || []);
    } catch (error) {
      console.error('[useStudentFees] Error loading fees:', error);
      setSummary(null);
      setBills([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, bills, payments, loading, loadFees };
}
