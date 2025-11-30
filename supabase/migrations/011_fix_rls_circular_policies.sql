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
-- Note: optional_fees table was removed in migration 012, so we skip it here
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

-- Note: optional_fees table was removed in migration 012, so we skip creating policy for it

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

-- Note: student_custom_fees table was removed in migration 012, so we skip it here

-- Note: fee_bills, fee_bill_items, and fee_payments tables were removed in migration 012, so we skip them here

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
