-- Migration: Fix pending_amount check constraint violation
-- Purpose: Fix bug in collect_fee_payment_atomic where v_remaining was incorrectly calculated
-- Date: 2026-01-XX
--
-- Issue: Line 134 was subtracting rec.pending_amount instead of v_amount_to_pay,
--        which could cause pending_amount to go negative, violating the check constraint
--        "monthly_fee_components_pending_amount_check" (pending_amount >= 0)
--
-- Fix: 
--   1. Declare v_amount_to_pay variable
--   2. Calculate v_amount_to_pay = least(v_remaining, rec.pending_amount) before update
--   3. Use greatest(0, pending_amount - v_amount_to_pay) to ensure pending_amount >= 0
--   4. Subtract v_amount_to_pay (not rec.pending_amount) from v_remaining

-- ============================================
-- RPC Function: collect_fee_payment_atomic (Fixed)
-- ============================================

drop function if exists collect_fee_payment_atomic(uuid, uuid, uuid[], numeric, date, text, uuid, jsonb);
drop function if exists collect_fee_payment_atomic(uuid, uuid, uuid[], numeric, date, text, uuid);

create or replace function collect_fee_payment_atomic(
  p_school_id uuid,
  p_student_id uuid,
  p_component_ids uuid[],
  p_amount numeric,
  p_payment_date date,
  p_mode text,
  p_received_by uuid,
  p_meta jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
as $$
declare
  v_remaining numeric := p_amount;
  v_receipt text;
  rec record;
  v_total_paid numeric := 0;
  v_error_message text;
  v_amount_to_pay numeric; -- FIX: Declare variable for amount actually paid
begin
  -- Validate input
  if p_school_id is null or p_student_id is null or p_component_ids is null 
     or p_amount is null or p_payment_date is null or p_mode is null 
     or p_received_by is null then
    return json_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  if array_length(p_component_ids, 1) = 0 then
    return json_build_object(
      'success', false,
      'error', 'No fee components provided'
    );
  end if;

  if p_amount <= 0 then
    return json_build_object(
      'success', false,
      'error', 'Payment amount must be greater than 0'
    );
  end if;

  -- Validate payment mode
  if p_mode not in ('cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer') then
    return json_build_object(
      'success', false,
      'error', 'Invalid payment mode'
    );
  end if;

  -- Generate receipt number
  v_receipt := 'RCP-' || extract(epoch from now())::bigint;

  -- Lock rows and process components (oldest first)
  for rec in
    select *
    from monthly_fee_components
    where id = any(p_component_ids)
      and school_id = p_school_id
      and student_id = p_student_id
    order by period_year, period_month
    for update
  loop
    exit when v_remaining <= 0.01; -- Allow small rounding differences

    if rec.pending_amount <= 0 then
      continue;
    end if;

    -- FIX: Calculate amount to pay BEFORE using it
    v_amount_to_pay := least(v_remaining, rec.pending_amount);

    -- Insert payment record
    insert into monthly_fee_payments(
      monthly_fee_component_id,
      student_id,
      school_id,
      payment_amount,
      payment_date,
      payment_mode,
      transaction_id,
      cheque_number,
      bank_name,
      received_by,
      receipt_number,
      notes
    )
    values (
      rec.id,
      p_student_id,
      p_school_id,
      v_amount_to_pay,
      p_payment_date,
      p_mode,
      (p_meta->>'transaction_id'),
      (p_meta->>'cheque_number'),
      (p_meta->>'bank_name'),
      p_received_by,
      v_receipt,
      (p_meta->>'notes')
    );

    -- FIX: Update component amounts with greatest(0, ...) to ensure pending_amount >= 0
    update monthly_fee_components
    set 
      paid_amount = paid_amount + v_amount_to_pay,
      pending_amount = greatest(0, pending_amount - v_amount_to_pay), -- FIX: Ensure pending_amount >= 0 to satisfy check constraint
      status = case
        when (pending_amount - v_amount_to_pay) <= 0.01 then 'paid' -- Use 0.01 to handle rounding
        when (paid_amount + v_amount_to_pay) > 0 then 'partially-paid'
        else status
      end,
      updated_at = now()
    where id = rec.id;

    v_total_paid := v_total_paid + v_amount_to_pay;
    -- FIX: Subtract actual amount paid, not rec.pending_amount
    v_remaining := v_remaining - v_amount_to_pay;
  end loop;

  -- Validate that payment was distributed
  if v_total_paid <= 0 then
    return json_build_object(
      'success', false,
      'error', 'No payment was recorded. Please check that selected components have pending amounts.'
    );
  end if;

  return json_build_object(
    'success', true,
    'receipt', v_receipt,
    'paid', v_total_paid,
    'remaining', greatest(v_remaining, 0)
  );

exception
  when others then
    v_error_message := sqlerrm;
    return json_build_object(
      'success', false,
      'error', v_error_message,
      'paid', v_total_paid
    );
end;
$$;

-- Add comment
comment on function collect_fee_payment_atomic is 
  'Atomically collects fee payments for multiple components. Handles payment distribution, component updates, and receipt generation in a single transaction. FIXED: Correctly calculates v_remaining and ensures pending_amount >= 0.';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
