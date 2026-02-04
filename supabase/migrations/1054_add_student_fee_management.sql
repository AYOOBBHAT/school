-- Migration: Add Student Fee Management System
-- Purpose: Create tables for fee bills and payments with RLS policies
-- Students can only view their own fee data

-- ============================================
-- 1. FEE BILLS TABLE
-- ============================================
create table if not exists fee_bills (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  bill_no text not null,
  due_date date not null,
  total_amount numeric not null check (total_amount >= 0),
  status text not null check (status in ('pending', 'partial', 'paid')) default 'pending',
  created_at timestamp default now(),
  unique(school_id, bill_no)
);

-- ============================================
-- 2. FEE PAYMENTS TABLE
-- ============================================
create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  bill_id uuid references fee_bills(id) on delete set null,
  amount numeric not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null check (method in ('cash', 'online', 'upi', 'card', 'cheque', 'bank-transfer')),
  created_at timestamp default now()
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================
create index if not exists idx_fee_bills_student_id on fee_bills(student_id);
create index if not exists idx_fee_bills_school_id on fee_bills(school_id);
create index if not exists idx_fee_bills_status on fee_bills(status);
create index if not exists idx_fee_payments_student_id on fee_payments(student_id);
create index if not exists idx_fee_payments_school_id on fee_payments(school_id);
create index if not exists idx_fee_payments_bill_id on fee_payments(bill_id);

-- ============================================
-- 4. FEE SUMMARY VIEW
-- ============================================
create or replace view student_fee_summary as
select
  s.id as student_id,
  s.school_id,
  coalesce(bill_totals.total_fee, 0) as total_fee,
  coalesce(payment_totals.paid_amount, 0) as paid_amount,
  coalesce(bill_totals.total_fee, 0) - coalesce(payment_totals.paid_amount, 0) as pending_amount
from students s
left join (
  select student_id, sum(total_amount) as total_fee
  from fee_bills
  group by student_id
) bill_totals on s.id = bill_totals.student_id
left join (
  select student_id, sum(amount) as paid_amount
  from fee_payments
  group by student_id
) payment_totals on s.id = payment_totals.student_id;

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================
alter table fee_bills enable row level security;
alter table fee_payments enable row level security;

-- ============================================
-- 6. RLS POLICIES - STUDENTS CAN ONLY SEE THEIR OWN DATA
-- ============================================

-- Policy: Students can only see their own bills
create policy "student_own_bills"
on fee_bills
for select
using (
  student_id in (
    select id from students where profile_id = auth.uid()
  )
);

-- Policy: Students can only see their own payments
create policy "student_own_payments"
on fee_payments
for select
using (
  student_id in (
    select id from students where profile_id = auth.uid()
  )
);

-- ============================================
-- 7. RLS POLICIES - SCHOOL ISOLATION (for staff)
-- ============================================

-- Policy: Staff can see bills for their school
create policy "staff_own_school_bills"
on fee_bills
for select
using (
  school_id in (
    select school_id from profiles where id = auth.uid()
  )
);

-- Policy: Staff can see payments for their school
create policy "staff_own_school_payments"
on fee_payments
for select
using (
  school_id in (
    select school_id from profiles where id = auth.uid()
  )
);

-- ============================================
-- 8. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- END OF MIGRATION
-- ============================================
