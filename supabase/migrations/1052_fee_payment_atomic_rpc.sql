-- Migration: Atomic Fee Payment Collection RPC (Simplified)
-- Purpose: Move fee payment writes to PostgreSQL for atomic operations
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX
--
-- This function handles payment distribution, component updates, and receipt generation
-- All writes happen in a single transaction with row locking

-- ============================================
-- RPC Function: collect_fee_payment_atomic
-- ============================================
-- Drop existing function if it exists (to handle parameter name changes)

drop function if exists collect_fee_payment_atomic(uuid, uuid, uuid[], numeric, date, text, uuid, jsonb);
drop function if exists collect_fee_payment_atomic(uuid, uuid, uuid[], numeric, date, text, uuid);

-- Create the function
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
      least(v_remaining, rec.pending_amount),
      p_payment_date,
      p_mode,
      (p_meta->>'transaction_id'),
      (p_meta->>'cheque_number'),
      (p_meta->>'bank_name'),
      p_received_by,
      v_receipt,
      (p_meta->>'notes')
    );

    -- Update component amounts
    update monthly_fee_components
    set 
      paid_amount = paid_amount + least(v_remaining, rec.pending_amount),
      pending_amount = pending_amount - least(v_remaining, rec.pending_amount),
      status = case
        when (pending_amount - least(v_remaining, rec.pending_amount)) <= 0 then 'paid'
        when (paid_amount + least(v_remaining, rec.pending_amount)) > 0 then 'partially-paid'
        else status
      end,
      updated_at = now()
    where id = rec.id;

    v_total_paid := v_total_paid + least(v_remaining, rec.pending_amount);
    v_remaining := v_remaining - rec.pending_amount;
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
  'Atomically collects fee payments for multiple components. Handles payment distribution, component updates, and receipt generation in a single transaction.';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Test the function:
--
-- SELECT collect_fee_payment_atomic(
--   'school-uuid'::uuid,
--   'student-uuid'::uuid,
--   ARRAY['component-uuid-1'::uuid, 'component-uuid-2'::uuid],
--   5000.00::numeric,
--   '2026-01-15'::date,
--   'cash',
--   'user-uuid'::uuid,
--   '{"transaction_id": null, "notes": "Test payment"}'::jsonb
-- );
