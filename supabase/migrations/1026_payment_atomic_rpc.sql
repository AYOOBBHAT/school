-- Migration: Atomic Fee Payment Collection RPC Function
-- Purpose: Move all payment logic to PostgreSQL for atomic operations and better concurrency
-- Author: Senior Developer - Production Optimization
-- Date: 2026-01-XX

-- ============================================
-- RPC Function: collect_fee_payment_atomic
-- ============================================
-- This function performs atomic fee payment collection in a single transaction
-- Eliminates race conditions, prevents double charges, and ensures data consistency
--
-- Parameters:
--   p_school_id: UUID of the school
--   p_student_id: UUID of the student
--   p_component_ids: Array of monthly_fee_component UUIDs
--   p_payment_amount: Total payment amount (will be distributed across components)
--   p_payment_date: Date of payment (DATE type)
--   p_mode: Payment mode ('cash', 'upi', 'online', 'card', 'cheque', 'bank_transfer')
--   p_received_by: UUID of the user collecting payment
--   p_meta: JSONB with optional fields (transaction_id, cheque_number, bank_name, notes)
--
-- Returns:
--   JSON object with success status, receipt_number, and payment details
--
-- Security:
--   Uses SECURITY DEFINER to bypass RLS (admin function)
--   Caller must have proper authentication via Supabase

create or replace function collect_fee_payment_atomic(
  p_school_id uuid,
  p_student_id uuid,
  p_component_ids uuid[],
  p_payment_amount numeric,
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
  v_remaining numeric := p_payment_amount;
  v_receipt_number text;
  v_payment_id uuid;
  v_total_pending numeric := 0;
  v_payments_created uuid[] := '{}';
  v_component record;
  v_amount_to_pay numeric;
  v_today date := current_date;
  v_current_year integer := extract(year from v_today);
  v_current_month integer := extract(month from v_today);
  v_error_message text;
  v_receipt_count integer;
begin
  -- Validate input
  if p_school_id is null or p_student_id is null or p_payment_amount is null 
     or p_payment_date is null or p_mode is null or p_received_by is null then
    return json_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  end if;

  if p_component_ids is null or array_length(p_component_ids, 1) = 0 then
    return json_build_object(
      'success', false,
      'error', 'No fee components provided'
    );
  end if;

  if p_payment_amount <= 0 then
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

  -- Calculate total pending amount (before locking)
  select coalesce(sum(pending_amount), 0) into v_total_pending
  from monthly_fee_components
  where id = any(p_component_ids)
    and school_id = p_school_id
    and student_id = p_student_id;

  -- Validate: Payment amount should not exceed total pending
  if p_payment_amount > v_total_pending then
    return json_build_object(
      'success', false,
      'error', format('Payment amount (₹%s) cannot exceed total pending amount (₹%s)', 
                     p_payment_amount::text, v_total_pending::text)
    );
  end if;

  -- Lock rows to prevent concurrent payment (FOR UPDATE)
  -- Process components in order of oldest period first (for proper distribution)
  for v_component in
    select *
    from monthly_fee_components
    where id = any(p_component_ids)
      and school_id = p_school_id
      and student_id = p_student_id
    order by period_year asc, period_month asc
    for update
  loop
    -- Check if component has pending amount
    if v_component.pending_amount <= 0 then
      continue;
    end if;

    -- Check for future months (prevent advance payments unless enabled)
    if v_component.period_year > v_current_year or 
       (v_component.period_year = v_current_year and v_component.period_month > v_current_month) then
      return json_build_object(
        'success', false,
        'error', format('Cannot record payment for future month (%s/%s). Advance payments require Principal approval.', 
                       v_component.period_month, v_component.period_year)
      );
    end if;

    -- Calculate amount to pay for this component
    v_amount_to_pay := least(v_remaining, v_component.pending_amount);

    -- Insert payment record
    insert into monthly_fee_payments (
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
      v_component.id,
      p_student_id,
      p_school_id,
      v_amount_to_pay,
      p_payment_date,
      p_mode,
      (p_meta->>'transaction_id'),
      (p_meta->>'cheque_number'),
      (p_meta->>'bank_name'),
      p_received_by,
      null, -- Receipt number will be set after all payments are created
      (p_meta->>'notes')
    )
    returning id into v_payment_id;

    -- Add payment ID to array
    v_payments_created := array_append(v_payments_created, v_payment_id);

    -- Update component amounts (trigger will also update, but we do it explicitly for atomicity)
    update monthly_fee_components
    set
      paid_amount = paid_amount + v_amount_to_pay,
      pending_amount = pending_amount - v_amount_to_pay,
      status = case
        when (pending_amount - v_amount_to_pay) <= 0 then 'paid'
        when (paid_amount + v_amount_to_pay) > 0 then 'partially-paid'
        else status
      end,
      updated_at = now()
    where id = v_component.id;

    -- Reduce remaining payment
    v_remaining := v_remaining - v_amount_to_pay;

    -- Exit if no more payment remaining
    exit when v_remaining <= 0.01; -- Allow small rounding differences (1 paisa)
  end loop;

  -- Validate that payment was distributed
  if array_length(v_payments_created, 1) = 0 then
    return json_build_object(
      'success', false,
      'error', 'No payment was recorded. Please check that selected components have pending amounts.'
    );
  end if;

  -- Generate receipt number (use existing function if available, otherwise generate)
  begin
    select generate_receipt_number(p_school_id) into v_receipt_number;
  exception
    when others then
      -- Fallback: generate receipt number manually
      select count(*) + 1 into v_receipt_count
      from monthly_fee_payments
      where school_id = p_school_id
        and receipt_number is not null;
      
      v_receipt_number := format('RCP-%s-%s', 
        extract(year from current_date),
        lpad(v_receipt_count::text, 6, '0')
      );
  end;

  -- Update all payment records with receipt number
  update monthly_fee_payments
  set receipt_number = v_receipt_number
  where id = any(v_payments_created);

  -- Return success with receipt number and payment IDs
  return json_build_object(
    'success', true,
    'receipt_number', v_receipt_number,
    'payment_ids', v_payments_created,
    'total_paid', p_payment_amount - v_remaining,
    'remaining', greatest(v_remaining, 0)
  );

exception
  when others then
    v_error_message := sqlerrm;
    return json_build_object(
      'success', false,
      'error', v_error_message,
      'payment_ids', v_payments_created
    );
end;
$$;

-- Add comment
comment on function collect_fee_payment_atomic is 
  'Atomically collects fee payments for multiple components in a single transaction. Prevents race conditions and ensures data consistency. Returns JSON with success status, receipt number, and payment details.';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the function was created:
--
-- SELECT 
--   proname as function_name,
--   pg_get_function_arguments(oid) as arguments,
--   pg_get_function_result(oid) as return_type
-- FROM pg_proc
-- WHERE proname = 'collect_fee_payment_atomic';
--
-- Test the function:
--
-- SELECT collect_fee_payment_atomic(
--   'school-uuid-here'::uuid,
--   'student-uuid-here'::uuid,
--   ARRAY['component-uuid-1'::uuid, 'component-uuid-2'::uuid],
--   5000.00::numeric,
--   '2026-01-15'::date,
--   'cash',
--   'user-uuid-here'::uuid,
--   '{"transaction_id": null, "notes": "Test payment"}'::jsonb
-- );
