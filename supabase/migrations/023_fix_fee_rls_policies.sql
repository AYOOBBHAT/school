-- Migration: Fix RLS Policies for Fee Management
-- Replace auth_claim() with profile lookups since custom claims are not set in JWT
-- Also restrict Clerk from modifying fee structures (only Principal can)

-- ============================================
-- Helper function to get user's school_id
-- ============================================
create or replace function get_user_school_id()
returns uuid as $$
  select school_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================
-- Helper function to get user's role
-- ============================================
create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ============================================
-- RLS Policies - Fee Categories
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_fee_categories_select on fee_categories;
create policy mt_fee_categories_select on fee_categories
  for select using (school_id = get_user_school_id());

drop policy if exists mt_fee_categories_modify on fee_categories;
create policy mt_fee_categories_modify on fee_categories
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Class Fee Defaults
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_class_fee_defaults_select on class_fee_defaults;
create policy mt_class_fee_defaults_select on class_fee_defaults
  for select using (school_id = get_user_school_id());

drop policy if exists mt_class_fee_defaults_modify on class_fee_defaults;
create policy mt_class_fee_defaults_modify on class_fee_defaults
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Transport Fee Defaults
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_transport_fee_defaults_select on transport_fee_defaults;
create policy mt_transport_fee_defaults_select on transport_fee_defaults
  for select using (school_id = get_user_school_id());

drop policy if exists mt_transport_fee_defaults_modify on transport_fee_defaults;
create policy mt_transport_fee_defaults_modify on transport_fee_defaults
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Optional Fee Definitions
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_optional_fee_definitions_select on optional_fee_definitions;
create policy mt_optional_fee_definitions_select on optional_fee_definitions
  for select using (school_id = get_user_school_id());

drop policy if exists mt_optional_fee_definitions_modify on optional_fee_definitions;
create policy mt_optional_fee_definitions_modify on optional_fee_definitions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Student Fee Profile
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_student_fee_profile_select on student_fee_profile;
create policy mt_student_fee_profile_select on student_fee_profile
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_profile.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_profile_modify on student_fee_profile;
create policy mt_student_fee_profile_modify on student_fee_profile
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Student Fee Overrides
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_student_fee_overrides_select on student_fee_overrides;
create policy mt_student_fee_overrides_select on student_fee_overrides
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_overrides.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_overrides_modify on student_fee_overrides;
create policy mt_student_fee_overrides_modify on student_fee_overrides
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Student Custom Fees
-- Note: student_custom_fees table was removed in migration 012, so we skip it here
-- ============================================

-- ============================================
-- RLS Policies - Student Optional Fees
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_student_optional_fees_select on student_optional_fees;
create policy mt_student_optional_fees_select on student_optional_fees
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_optional_fees.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_optional_fees_modify on student_optional_fees;
create policy mt_student_optional_fees_modify on student_optional_fees
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Scholarships
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_scholarships_select on scholarships;
create policy mt_scholarships_select on scholarships
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = scholarships.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_scholarships_modify on scholarships;
create policy mt_scholarships_modify on scholarships
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Fee Bills, Fee Bill Items, Fee Payments
-- Note: fee_bills, fee_bill_items, and fee_payments tables were removed in migration 012, so we skip them here
-- ============================================

-- ============================================
-- RLS Policies - Fine Rules
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_fine_rules_select on fine_rules;
create policy mt_fine_rules_select on fine_rules
  for select using (school_id = get_user_school_id());

drop policy if exists mt_fine_rules_modify on fine_rules;
create policy mt_fine_rules_modify on fine_rules
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Class Fee Versions
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_class_fee_versions_select on class_fee_versions;
create policy mt_class_fee_versions_select on class_fee_versions
  for select using (school_id = get_user_school_id());

drop policy if exists mt_class_fee_versions_modify on class_fee_versions;
create policy mt_class_fee_versions_modify on class_fee_versions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Transport Fee Versions
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_transport_fee_versions_select on transport_fee_versions;
create policy mt_transport_fee_versions_select on transport_fee_versions
  for select using (school_id = get_user_school_id());

drop policy if exists mt_transport_fee_versions_modify on transport_fee_versions;
create policy mt_transport_fee_versions_modify on transport_fee_versions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Optional Fee Versions
-- Principal can modify, Clerk can only view
-- ============================================
drop policy if exists mt_optional_fee_versions_select on optional_fee_versions;
create policy mt_optional_fee_versions_select on optional_fee_versions
  for select using (school_id = get_user_school_id());

drop policy if exists mt_optional_fee_versions_modify on optional_fee_versions;
create policy mt_optional_fee_versions_modify on optional_fee_versions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Student Fee Override Versions
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_student_fee_override_versions_select on student_fee_override_versions;
create policy mt_student_fee_override_versions_select on student_fee_override_versions
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_override_versions.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_override_versions_modify on student_fee_override_versions;
create policy mt_student_fee_override_versions_modify on student_fee_override_versions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

-- ============================================
-- RLS Policies - Scholarship Versions
-- Principal can modify, Clerk can view
-- ============================================
drop policy if exists mt_scholarship_versions_select on scholarship_versions;
create policy mt_scholarship_versions_select on scholarship_versions
  for select using (
    school_id = get_user_school_id()
    and (
      get_user_role() in ('principal', 'clerk', 'teacher')
      or (get_user_role() = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (get_user_role() = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = scholarship_versions.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_scholarship_versions_modify on scholarship_versions;
create policy mt_scholarship_versions_modify on scholarship_versions
  for all using (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  ) with check (
    school_id = get_user_school_id()
    and get_user_role() = 'principal'
  );

