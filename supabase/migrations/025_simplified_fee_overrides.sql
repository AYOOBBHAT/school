-- Migration: Simplified Fee Overrides System
-- Supports all scenarios: discounts, custom fees, full free scholarships
-- Extensible for any fee category (not just class and transport)

-- ============================================
-- 1. DROP OLD STUDENT FEE OVERRIDES TABLE (if exists)
-- ============================================
drop table if exists student_fee_overrides cascade;

-- ============================================
-- 2. CREATE NEW SIMPLIFIED STUDENT FEE OVERRIDES TABLE
-- ============================================
-- This table supports:
-- - Discounts per fee category (e.g., class_fee_discount, transport_fee_discount)
-- - Custom fees per category (overrides default completely)
-- - Full free scholarship (is_full_free flag)
-- - Extensible for any fee category
create table if not exists student_fee_overrides (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Fee category reference (null means applies to all fees, or use specific category)
  fee_category_id uuid references fee_categories(id) on delete cascade,
  
  -- Discount amounts (subtracted from default fees)
  -- These are per-category discounts
  discount_amount numeric default 0 check (discount_amount >= 0),
  
  -- Custom fee amounts (completely override default fees)
  -- If set, this replaces the default fee for this category
  custom_fee_amount numeric check (custom_fee_amount is null or custom_fee_amount >= 0),
  
  -- Full free scholarship flag
  -- If true for a category, that category's fee = 0
  -- If true and fee_category_id is null, ALL fees = 0
  is_full_free boolean default false,
  
  -- Effective date range
  effective_from date not null,
  effective_to date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  notes text,
  applied_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure one active override per student per category at a time
  unique(student_id, fee_category_id, effective_from)
);

create index idx_student_fee_overrides_student on student_fee_overrides(student_id, is_active);
create index idx_student_fee_overrides_category on student_fee_overrides(fee_category_id);
create index idx_student_fee_overrides_dates on student_fee_overrides(effective_from, effective_to);
create index idx_student_fee_overrides_school on student_fee_overrides(school_id);

-- ============================================
-- 3. HELPER FUNCTION: Get Student Fee Override for Category
-- ============================================
-- Returns the active override for a student and fee category on a given date
create or replace function get_student_fee_override(
  p_student_id uuid,
  p_fee_category_id uuid,
  p_date date default current_date
)
returns table (
  discount_amount numeric,
  custom_fee_amount numeric,
  is_full_free boolean
) as $$
begin
  return query
  select 
    coalesce(sum(sfo.discount_amount), 0) as discount_amount,
    max(sfo.custom_fee_amount) as custom_fee_amount, -- Take the first non-null custom fee
    bool_or(sfo.is_full_free) as is_full_free
  from student_fee_overrides sfo
  where sfo.student_id = p_student_id
    and (sfo.fee_category_id = p_fee_category_id or sfo.fee_category_id is null)
    and sfo.is_active = true
    and sfo.effective_from <= p_date
    and (sfo.effective_to is null or sfo.effective_to >= p_date);
end;
$$ language plpgsql stable;

-- ============================================
-- 4. HELPER FUNCTION: Calculate Student Fee for Category
-- ============================================
-- Implements the logic:
-- if is_full_free: fee = 0
-- else if custom_fee_amount exists: fee = custom_fee_amount
-- else: fee = default_fee - discount_amount
create or replace function calculate_student_fee(
  p_student_id uuid,
  p_fee_category_id uuid,
  p_default_fee numeric,
  p_date date default current_date
)
returns numeric as $$
declare
  v_override record;
  v_result numeric;
begin
  -- Get override for this student and category
  select * into v_override
  from get_student_fee_override(p_student_id, p_fee_category_id, p_date)
  limit 1;
  
  -- Apply logic
  if v_override.is_full_free then
    v_result := 0;
  elsif v_override.custom_fee_amount is not null then
    v_result := v_override.custom_fee_amount;
  else
    v_result := greatest(0, p_default_fee - coalesce(v_override.discount_amount, 0));
  end if;
  
  return v_result;
end;
$$ language plpgsql stable;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Helper functions (if not already exists)
create or replace function get_user_school_id()
returns uuid as $$
  select school_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function get_user_role()
returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Select policy: Principal, Clerk, Teacher can view all; Students/Parents can view their own
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
        select 1 from student_guardians sg 
        where sg.student_id = student_fee_overrides.student_id 
        and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

-- Modify policy: Only Principal can modify
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
-- 6. COMMENTS
-- ============================================
comment on table student_fee_overrides is 'Student-specific fee overrides: discounts, custom fees, and full free scholarships. Extensible for any fee category.';
comment on column student_fee_overrides.fee_category_id is 'Fee category this override applies to. NULL means applies to all fees (for full free scholarship).';
comment on column student_fee_overrides.discount_amount is 'Discount amount to subtract from default fee. Only used if custom_fee_amount is NULL.';
comment on column student_fee_overrides.custom_fee_amount is 'Custom fee amount that completely replaces default fee. If set, discount_amount is ignored.';
comment on column student_fee_overrides.is_full_free is 'If true, fee for this category is 0. If fee_category_id is NULL and this is true, ALL fees are 0.';

