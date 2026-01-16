-- Migration: Fix Automatic Unpaid Status Logic
-- Purpose: Automatically mark students as unpaid for months without payment
--          Show unpaid salary months for teachers to principals
--          Fix payment status distribution logic

-- ============================================
-- 1. FIX STUDENT UNPAID MONTHS VIEW
-- ============================================
-- Ensure students are marked unpaid for months without bills OR without payment

drop view if exists student_unpaid_months cascade;

create or replace view student_unpaid_months as
with 
-- Get all active students
active_students as (
  select 
    s.id as student_id,
    s.school_id,
    s.class_group_id,
    s.section_id,
    s.roll_number,
    s.admission_date,
    coalesce(
      -- Try student_fee_profile first
      (select sfp.tuition_fee_cycle from student_fee_profile sfp 
       where sfp.student_id = s.id 
       and sfp.is_active = true
       and (sfp.effective_to is null or sfp.effective_to >= current_date)
       limit 1),
      -- Then try student_fee_cycles
      (select sfc.fee_cycle from student_fee_cycles sfc 
       where sfc.student_id = s.id 
       and sfc.fee_category_id is null 
       and sfc.is_active = true
       and (sfc.effective_to is null or sfc.effective_to >= current_date)
       limit 1),
      -- Default to monthly
      'monthly'
    ) as fee_cycle
  from students s
  where s.status = 'active'
),
-- Generate expected months for each student (from admission date to current month)
expected_months as (
  select 
    ast.student_id,
    ast.school_id,
    ast.class_group_id,
    ast.section_id,
    ast.roll_number,
    ast.fee_cycle,
    date_trunc('month', generate_series(
      greatest(
        date_trunc('month', coalesce(ast.admission_date, current_date - interval '12 months')),
        date_trunc('month', current_date - interval '12 months')
      ),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::date as period_start,
    (date_trunc('month', generate_series(
      greatest(
        date_trunc('month', coalesce(ast.admission_date, current_date - interval '12 months')),
        date_trunc('month', current_date - interval '12 months')
      ),
      date_trunc('month', current_date),
      '1 month'::interval
    )) + interval '1 month - 1 day')::date as period_end
  from active_students ast
),
-- Get actual bills for these periods
actual_bills as (
  select 
    fb.student_id,
    fb.period_start,
    fb.period_end,
    fb.status,
    fb.pending_amount,
    fb.total_amount,
    fb.paid_amount,
    fb.due_date,
    fb.bill_number,
    fb.id as bill_id,
    -- Determine payment status
    case 
      when fb.status = 'paid' then 'paid'
      when fb.due_date < current_date and fb.pending_amount > 0 then 'overdue'
      when fb.pending_amount > 0 then 'unpaid'
      when fb.status = 'partially_paid' then 'partially_paid'
      else 'unpaid'
    end as payment_status
  from fee_bills fb
  where fb.status != 'cancelled'
)
select 
  em.student_id,
  em.school_id,
  em.class_group_id,
  em.section_id,
  em.roll_number,
  em.period_start,
  em.period_end,
  to_char(em.period_start, 'Month YYYY') as period_label,
  coalesce(ab.bill_id, null) as bill_id,
  coalesce(ab.bill_number, null) as bill_number,
  coalesce(ab.status, 'unpaid') as bill_status,
  -- CRITICAL: If no bill exists, mark as unpaid
  -- If bill exists but not paid, use bill's payment status
  coalesce(ab.payment_status, 'unpaid') as payment_status,
  coalesce(ab.pending_amount, 0) as pending_amount,
  coalesce(ab.total_amount, 0) as total_amount,
  coalesce(ab.paid_amount, 0) as paid_amount,
  coalesce(ab.due_date, em.period_end + interval '7 days') as due_date,
  case 
    when ab.due_date is not null and ab.due_date < current_date and coalesce(ab.payment_status, 'unpaid') != 'paid'
    then extract(day from current_date - ab.due_date)::integer
    when ab.due_date is null and em.period_end < current_date
    then extract(day from current_date - em.period_end)::integer
    else 0
  end as days_overdue,
  case 
    when ab.bill_id is null then true
    else false
  end as bill_not_generated
from expected_months em
left join actual_bills ab on 
  ab.student_id = em.student_id
  and ab.period_start = em.period_start
where 
  -- Only show unpaid months (including months without bills)
  coalesce(ab.payment_status, 'unpaid') != 'paid'
order by em.student_id, em.period_start desc;

-- ============================================
-- 2. FIX UNPAID STUDENTS LIST VIEW
-- ============================================
-- List all students with unpaid fees (including months without bills)

drop view if exists unpaid_students_list cascade;

create or replace view unpaid_students_list as
select distinct
  s.id as student_id,
  s.school_id,
  s.class_group_id,
  s.section_id,
  s.roll_number,
  s.status as student_status,
  p.id as profile_id,
  p.full_name,
  p.email,
  p.phone,
  cg.name as class_name,
  sec.name as section_name,
  count(distinct sum.period_start) as unpaid_months_count,
  sum(sum.pending_amount) as total_pending_amount,
  max(sum.days_overdue) as max_days_overdue,
  min(sum.period_start) as oldest_unpaid_month,
  max(sum.period_start) as latest_unpaid_month,
  -- Count months without bills
  sum(case when sum.bill_not_generated then 1 else 0 end) as months_without_bills
from students s
inner join profiles p on p.id = s.profile_id
left join class_groups cg on cg.id = s.class_group_id
left join sections sec on sec.id = s.section_id
inner join student_unpaid_months sum on sum.student_id = s.id
where 
  s.status = 'active'
  and sum.payment_status != 'paid'
group by 
  s.id, s.school_id, s.class_group_id, s.section_id, s.roll_number, s.status,
  p.id, p.full_name, p.email, p.phone, cg.name, sec.name
-- Include students even if pending_amount is 0 (months without bills)
having count(distinct sum.period_start) > 0
order by total_pending_amount desc, max_days_overdue desc;

-- ============================================
-- 3. FIX PAYMENT STATUS DISTRIBUTION VIEW
-- ============================================
-- Correct distribution counting all students, not just those with bills

drop view if exists payment_status_distribution cascade;

create or replace view payment_status_distribution as
with all_students as (
  select distinct
    s.id as student_id,
    s.school_id
  from students s
  where s.status = 'active'
),
student_status_map as (
  select 
    ast.student_id,
    ast.school_id,
    case 
      when not exists (
        select 1 from student_unpaid_months sum 
        where sum.student_id = ast.student_id 
        and sum.payment_status != 'paid'
      ) then 'paid'
      when exists (
        select 1 from student_unpaid_months sum 
        where sum.student_id = ast.student_id 
        and sum.payment_status = 'partially_paid'
      ) then 'partially_paid'
      else 'unpaid'
    end as payment_status
  from all_students ast
)
select 
  school_id,
  payment_status,
  count(distinct student_id) as student_count,
  sum(case when payment_status = 'unpaid' then 1 else 0 end) as unpaid_students,
  sum(case when payment_status = 'partially_paid' then 1 else 0 end) as partially_paid_students,
  sum(case when payment_status = 'paid' then 1 else 0 end) as paid_students,
  -- Get total pending amount from unpaid months
  coalesce((
    select sum(sum.pending_amount)
    from student_unpaid_months sum
    where sum.school_id = ssm.school_id
    and sum.payment_status != 'paid'
  ), 0) as total_pending_amount
from student_status_map ssm
group by school_id, payment_status
order by school_id, payment_status;

-- ============================================
-- 4. FIX TEACHER UNPAID SALARY MONTHS VIEW
-- ============================================
-- Show all unpaid salary months, including months without salary records

drop view if exists teacher_unpaid_salary_months cascade;

create or replace view teacher_unpaid_salary_months as
with 
-- Get all active teachers with salary structure
active_teachers as (
  select distinct
    p.id as teacher_id,
    p.school_id,
    p.full_name,
    p.email,
    tss.id as salary_structure_id,
    tss.salary_cycle,
    tss.base_salary + tss.hra + tss.other_allowances - tss.fixed_deductions as expected_salary
  from profiles p
  inner join teacher_salary_structure tss on tss.teacher_id = p.id
  where p.role = 'teacher'
    and p.approval_status = 'approved'
    and p.school_id is not null
),
-- Generate expected months (last 12 months + current month)
expected_salary_months as (
  select 
    at.teacher_id,
    at.school_id,
    at.full_name,
    at.email,
    at.salary_structure_id,
    at.expected_salary,
    extract(month from generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::integer as month,
    extract(year from generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::integer as year,
    date_trunc('month', generate_series(
      date_trunc('month', current_date - interval '12 months'),
      date_trunc('month', current_date),
      '1 month'::interval
    ))::date as period_start
  from active_teachers at
),
-- Get actual salary records
actual_salary_records as (
  select 
    tsr.teacher_id,
    tsr.month,
    tsr.year,
    tsr.status,
    tsr.net_salary,
    tsr.payment_date,
    tsr.approved_at,
    tsr.id as salary_record_id
  from teacher_salary_records tsr
  where tsr.status != 'rejected'
)
select 
  esm.teacher_id,
  esm.school_id,
  esm.full_name as teacher_name,
  esm.email as teacher_email,
  esm.month,
  esm.year,
  esm.period_start,
  to_char(make_date(esm.year, esm.month, 1), 'Month YYYY') as period_label,
  coalesce(asr.salary_record_id, null) as salary_record_id,
  -- CRITICAL: If no salary record exists, mark as unpaid
  -- If record exists but status is not 'paid', use record's status
  coalesce(asr.status, 'unpaid') as payment_status,
  coalesce(asr.net_salary, esm.expected_salary) as net_salary,
  asr.payment_date,
  asr.approved_at,
  case 
    when asr.salary_record_id is null then true
    else false
  end as salary_not_generated,
  case 
    when coalesce(asr.status, 'unpaid') = 'paid' then false
    else true
  end as is_unpaid,
  -- Calculate days since period start (for overdue calculation)
  extract(day from current_date - esm.period_start)::integer as days_since_period_start
from expected_salary_months esm
left join actual_salary_records asr on 
  asr.teacher_id = esm.teacher_id
  and asr.month = esm.month
  and asr.year = esm.year
where 
  -- Only show unpaid months (including months without salary records)
  coalesce(asr.status, 'unpaid') != 'paid'
order by esm.teacher_id, esm.year desc, esm.month desc;

-- ============================================
-- 5. FIX UNPAID TEACHERS SUMMARY VIEW
-- ============================================
-- Summary for principals to see unpaid teachers

drop view if exists unpaid_teachers_summary cascade;

create or replace view unpaid_teachers_summary as
select 
  school_id,
  teacher_id,
  teacher_name,
  teacher_email,
  count(*) as unpaid_months_count,
  sum(net_salary) as total_unpaid_amount,
  max(days_since_period_start) as max_days_unpaid,
  min(period_start) as oldest_unpaid_month,
  max(period_start) as latest_unpaid_month,
  array_agg(distinct period_label order by period_label) as unpaid_months_list,
  -- Count months without salary records
  sum(case when salary_not_generated then 1 else 0 end) as months_without_salary_records
from teacher_unpaid_salary_months
where is_unpaid = true
group by school_id, teacher_id, teacher_name, teacher_email
order by total_unpaid_amount desc, max_days_unpaid desc;

-- ============================================
-- 6. AUTO-UPDATE BILL STATUS TRIGGER
-- ============================================
-- Automatically update bill status when payment is made

create or replace function auto_update_bill_status()
returns trigger language plpgsql as $$
declare
  bill_record record;
  total_paid numeric;
begin
  -- Get the bill
  select * into bill_record
  from fee_bills
  where id = new.bill_id;
  
  if not found then
    return new;
  end if;
  
  -- Calculate total paid for this bill
  select coalesce(sum(payment_amount), 0) into total_paid
  from fee_payments
  where bill_id = new.bill_id;
  
  -- Update bill status and amounts
  update fee_bills
  set 
    paid_amount = total_paid,
    pending_amount = bill_record.total_amount - coalesce(bill_record.discount_amount, 0) - total_paid,
    status = case
      when total_paid >= (bill_record.total_amount - coalesce(bill_record.discount_amount, 0)) then 'paid'
      when total_paid > 0 then 'partially_paid'
      when bill_record.due_date < current_date and (bill_record.total_amount - coalesce(bill_record.discount_amount, 0) - total_paid) > 0 then 'overdue'
      else 'generated'
    end,
    updated_at = now()
  where id = new.bill_id;
  
  return new;
end;
$$;

-- Drop existing trigger if exists
drop trigger if exists trigger_auto_update_bill_status on fee_payments;

-- Create trigger
create trigger trigger_auto_update_bill_status
  after insert or update on fee_payments
  for each row
  execute function auto_update_bill_status();

-- ============================================
-- 7. AUTO-UPDATE OVERDUE BILLS FUNCTION
-- ============================================
-- Function to automatically mark bills as overdue

create or replace function update_overdue_bills()
returns void language plpgsql as $$
begin
  -- Update bills that are past due date and not paid
  update fee_bills
  set 
    status = 'overdue',
    updated_at = now()
  where 
    due_date < current_date
    and status not in ('paid', 'cancelled')
    and pending_amount > 0;
end;
$$;

-- ============================================
-- 8. HELPER FUNCTIONS (UPDATED)
-- ============================================

-- Function to get unpaid months for a specific student
create or replace function get_student_unpaid_months(
  p_student_id uuid,
  p_school_id uuid
)
returns table (
  period_start date,
  period_end date,
  period_label text,
  payment_status text,
  pending_amount numeric,
  days_overdue integer,
  bill_not_generated boolean
) language sql stable as $$
  select 
    period_start,
    period_end,
    period_label,
    payment_status,
    pending_amount,
    days_overdue,
    bill_not_generated
  from student_unpaid_months
  where student_id = p_student_id
    and school_id = p_school_id
  order by period_start desc;
$$;

-- Function to get unpaid salary months for a specific teacher
create or replace function get_teacher_unpaid_salary_months(
  p_teacher_id uuid,
  p_school_id uuid
)
returns table (
  month integer,
  year integer,
  period_label text,
  payment_status text,
  net_salary numeric,
  days_since_period_start integer,
  salary_not_generated boolean
) language sql stable as $$
  select 
    month,
    year,
    period_label,
    payment_status,
    net_salary,
    days_since_period_start,
    salary_not_generated
  from teacher_unpaid_salary_months
  where teacher_id = p_teacher_id
    and school_id = p_school_id
  order by year desc, month desc;
$$;

-- Function to get unpaid students for a school
create or replace function get_unpaid_students(
  p_school_id uuid
)
returns table (
  student_id uuid,
  full_name text,
  roll_number text,
  class_name text,
  section_name text,
  unpaid_months_count bigint,
  total_pending_amount numeric,
  max_days_overdue integer,
  months_without_bills bigint
) language sql stable as $$
  select 
    student_id,
    full_name,
    roll_number,
    class_name,
    section_name,
    unpaid_months_count,
    total_pending_amount,
    max_days_overdue,
    months_without_bills
  from unpaid_students_list
  where school_id = p_school_id
  order by total_pending_amount desc;
$$;

-- Function to get unpaid teachers for a school (for principals)
create or replace function get_unpaid_teachers(
  p_school_id uuid
)
returns table (
  teacher_id uuid,
  teacher_name text,
  teacher_email text,
  unpaid_months_count bigint,
  total_unpaid_amount numeric,
  max_days_unpaid integer,
  unpaid_months_list text[],
  months_without_salary_records bigint
) language sql stable as $$
  select 
    teacher_id,
    teacher_name,
    teacher_email,
    unpaid_months_count,
    total_unpaid_amount,
    max_days_unpaid,
    unpaid_months_list,
    months_without_salary_records
  from unpaid_teachers_summary
  where school_id = p_school_id
  order by total_unpaid_amount desc;
$$;

-- ============================================
-- 9. GRANT PERMISSIONS
-- ============================================

grant select on student_unpaid_months to authenticated;
grant select on unpaid_students_list to authenticated;
grant select on payment_status_distribution to authenticated;
grant select on teacher_unpaid_salary_months to authenticated;
grant select on unpaid_teachers_summary to authenticated;

-- ============================================
-- 10. COMMENTS
-- ============================================

comment on view student_unpaid_months is 'Shows all unpaid months for students, including months without bills - automatically marks as unpaid';
comment on view unpaid_students_list is 'Lists all students with unpaid fees, including those with months without bills';
comment on view payment_status_distribution is 'Correct payment status distribution counting all students, not just those with bills';
comment on view teacher_unpaid_salary_months is 'Shows all unpaid salary months for teachers, including months without salary records';
comment on view unpaid_teachers_summary is 'Summary of unpaid teachers for principals - shows all unpaid months';
comment on function auto_update_bill_status() is 'Automatically updates bill status when payment is made';
comment on function update_overdue_bills() is 'Automatically marks bills as overdue when due_date passes';
comment on function get_student_unpaid_months(uuid, uuid) is 'Get unpaid months for a specific student (includes months without bills)';
comment on function get_teacher_unpaid_salary_months(uuid, uuid) is 'Get unpaid salary months for a specific teacher (includes months without records)';
comment on function get_unpaid_students(uuid) is 'Get all unpaid students for a school (includes students with months without bills)';
comment on function get_unpaid_teachers(uuid) is 'Get all unpaid teachers for a school (principals only - includes months without salary records)';

-- ============================================
-- 11. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
