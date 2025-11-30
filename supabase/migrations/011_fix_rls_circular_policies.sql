-- Migration: Fix RLS circular policy issues
-- Problem: student_guardians policies were causing infinite recursion
-- Solution: Simplify policies to avoid circular joins

-- ============================================
-- DROP OLD PROBLEMATIC POLICIES
-- ============================================

-- Drop fee category policies that have circular joins
drop policy if exists mt_fee_categories_select on fee_categories;
drop policy if exists mt_transport_routes_select on transport_routes;
drop policy if exists mt_transport_fees_select on transport_fees;
drop policy if exists mt_optional_fees_select on optional_fees;
drop policy if exists mt_class_fees_select on class_fees;

-- ============================================
-- RECREATE WITH SIMPLIFIED POLICIES (NO CIRCULAR JOINS)
-- ============================================

-- Fee Categories - Simplified (no student_guardians join)
create policy mt_fee_categories_select on fee_categories
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or auth_claim('role') in ('student', 'parent')
    )
  );

-- Class Fees - Simplified (no student_guardians join)
create policy mt_class_fees_select on class_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or auth_claim('role') in ('student', 'parent')
    )
  );

-- Transport Routes - Simplified (no student_guardians join)
create policy mt_transport_routes_select on transport_routes
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or auth_claim('role') in ('student', 'parent')
    )
  );

-- Transport Fees - Simplified (no student_guardians join)
create policy mt_transport_fees_select on transport_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or auth_claim('role') in ('student', 'parent')
    )
  );

-- Optional Fees - Simplified (no student_guardians join)
create policy mt_optional_fees_select on optional_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or auth_claim('role') in ('student', 'parent')
    )
  );

-- ============================================
-- FIX STUDENT GUARDIANS POLICIES
-- ============================================

-- Drop old student_guardians policies
drop policy if exists sg_select_staff on student_guardians;
drop policy if exists sg_select_guardian_self on student_guardians;

-- Create new simplified policies for student_guardians
-- Staff can see all links in their school
create policy sg_select_staff on student_guardians
  for select using (
    auth_claim('role') in ('principal', 'clerk', 'teacher')
  );

-- Guardian can only see their own links
create policy sg_select_guardian_self on student_guardians
  for select using (
    guardian_profile_id = auth.uid()
  );

-- ============================================
-- CREATE ADDITIONAL TRANSPORT POLICIES
-- ============================================

-- Drop old problematic student_transport policies
drop policy if exists mt_student_transport_select on student_transport;
drop policy if exists mt_student_transport_modify on student_transport;

-- Create new simplified policies for student_transport
create policy mt_student_transport_select on student_transport
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and student_id in (
        select sg.student_id from student_guardians sg
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

create policy mt_student_transport_modify on student_transport
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- FIX OTHER POLICIES THAT HAD CIRCULAR JOINS
-- ============================================

-- Drop and recreate student_custom_fees policies
drop policy if exists mt_student_custom_fees_select on student_custom_fees;
drop policy if exists mt_student_custom_fees_modify on student_custom_fees;

create policy mt_student_custom_fees_select on student_custom_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and student_id in (
        select sg.student_id from student_guardians sg
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

create policy mt_student_custom_fees_modify on student_custom_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Drop and recreate fee_bills policies
drop policy if exists mt_fee_bills_select on fee_bills;
drop policy if exists mt_fee_bills_modify on fee_bills;

create policy mt_fee_bills_select on fee_bills
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and student_id in (
        select sg.student_id from student_guardians sg
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

create policy mt_fee_bills_modify on fee_bills
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- Drop and recreate fee_bill_items policies
drop policy if exists mt_fee_bill_items_select on fee_bill_items;
drop policy if exists mt_fee_bill_items_modify on fee_bill_items;

create policy mt_fee_bill_items_select on fee_bill_items
  for select using (
    bill_id in (
      select id from fee_bills where school_id = auth_claim('school_id')::uuid
      and (
        auth_claim('role') in ('principal', 'clerk')
        or (auth_claim('role') = 'student' and student_id in (
          select s.id from students s where s.profile_id = auth.uid()
        ))
        or (auth_claim('role') = 'parent' and student_id in (
          select sg.student_id from student_guardians sg
          where sg.guardian_profile_id = auth.uid()
        ))
      )
    )
  );

create policy mt_fee_bill_items_modify on fee_bill_items
  for all using (
    bill_id in (
      select id from fee_bills where school_id = auth_claim('school_id')::uuid
      and auth_claim('role') in ('principal', 'clerk')
    )
  ) with check (
    bill_id in (
      select id from fee_bills where school_id = auth_claim('school_id')::uuid
      and auth_claim('role') in ('principal', 'clerk')
    )
  );

-- Drop and recreate fee_payments policies
drop policy if exists mt_fee_payments_select on fee_payments;
drop policy if exists mt_fee_payments_modify on fee_payments;

create policy mt_fee_payments_select on fee_payments
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and student_id in (
        select sg.student_id from student_guardians sg
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

create policy mt_fee_payments_modify on fee_payments
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
