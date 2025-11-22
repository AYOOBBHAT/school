-- Migration: Comprehensive Fee Management System
-- Supports school-level structures, class defaults, student customization, scholarships, discounts

-- ============================================
-- 1. FEE CATEGORIES (Master list of fee types)
-- ============================================
create table if not exists fee_categories (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null, -- e.g., "Tuition Fee", "Transport Fee", "Uniform Fee"
  code text, -- e.g., "TUIT", "TRANS", "UNIF"
  description text,
  fee_type text check (fee_type in ('tuition', 'transport', 'uniform', 'admission', 'annual', 'term', 'optional', 'custom')) not null,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, code)
);

create index idx_fee_categories_school on fee_categories(school_id, is_active);

-- ============================================
-- 2. CLASS FEE DEFAULTS (Default fees per class)
-- ============================================
create table if not exists class_fee_defaults (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  effective_from date,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(class_group_id, fee_category_id, fee_cycle, effective_from)
);

create index idx_class_fee_defaults_class on class_fee_defaults(class_group_id, is_active);
create index idx_class_fee_defaults_category on class_fee_defaults(fee_category_id);

-- ============================================
-- 3. TRANSPORT FEE DEFAULTS (Transport fees per route/class)
-- ============================================
create table if not exists transport_fee_defaults (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  route_name text, -- e.g., "Route A", "Route B", or null for class-wide
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  effective_from date,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_transport_fee_defaults_class on transport_fee_defaults(class_group_id, is_active);

-- ============================================
-- 4. OPTIONAL FEE DEFINITIONS (Optional fees available per class)
-- ============================================
create table if not exists optional_fee_definitions (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  effective_from date,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(class_group_id, fee_category_id, fee_cycle, effective_from)
);

create index idx_optional_fee_definitions_class on optional_fee_definitions(class_group_id, is_active);

-- ============================================
-- 5. STUDENT FEE PROFILE (Student-specific fee overrides)
-- ============================================
create table if not exists student_fee_profile (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Transport settings
  transport_enabled boolean default true,
  transport_route text, -- Override route if different from class default
  transport_fee_override numeric, -- Custom transport fee amount (null = use default)
  
  -- Fee cycle preferences
  tuition_fee_cycle text check (tuition_fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')),
  transport_fee_cycle text check (transport_fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')),
  
  -- Effective dates
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  unique(student_id, effective_from)
);

create index idx_student_fee_profile_student on student_fee_profile(student_id, is_active);
create index idx_student_fee_profile_school on student_fee_profile(school_id);

-- ============================================
-- 6. STUDENT FEE OVERRIDES (Override specific fee amounts)
-- ============================================
create table if not exists student_fee_overrides (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  override_amount numeric not null check (override_amount >= 0),
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(student_id, fee_category_id, effective_from)
);

create index idx_student_fee_overrides_student on student_fee_overrides(student_id, is_active);

-- ============================================
-- 7. STUDENT CUSTOM FEES (Additional fees not in class defaults)
-- ============================================
create table if not exists student_custom_fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  description text,
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_student_custom_fees_student on student_custom_fees(student_id, is_active);

-- ============================================
-- 8. STUDENT OPTIONAL FEES (Which optional fees student has opted in)
-- ============================================
create table if not exists student_optional_fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  optional_fee_definition_id uuid references optional_fee_definitions(id) on delete cascade,
  opted_in boolean default true,
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(student_id, optional_fee_definition_id, effective_from)
);

create index idx_student_optional_fees_student on student_optional_fees(student_id, is_active);

-- ============================================
-- 9. SCHOLARSHIPS & DISCOUNTS
-- ============================================
create table if not exists scholarships (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Scholarship type
  scholarship_type text check (scholarship_type in ('percentage', 'fixed', 'full_waiver')) not null,
  
  -- What fees it applies to
  applies_to text check (applies_to in ('all', 'tuition_only', 'transport_only', 'specific_category')) not null,
  fee_category_id uuid references fee_categories(id) on delete cascade, -- If applies_to = 'specific_category'
  
  -- Discount amount
  discount_percentage numeric check (discount_percentage >= 0 and discount_percentage <= 100), -- For percentage type
  discount_amount numeric check (discount_amount >= 0), -- For fixed type
  
  -- Approval
  approved_by uuid references profiles(id),
  approved_at timestamp,
  status text check (status in ('pending', 'approved', 'rejected', 'expired')) default 'pending',
  
  -- Effective dates
  effective_from date not null,
  effective_to date,
  is_active boolean default true,
  
  description text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_scholarships_student on scholarships(student_id, is_active, status);
create index idx_scholarships_school on scholarships(school_id);

-- ============================================
-- 10. FEE BILLS (Generated bills)
-- ============================================
-- Create table if it doesn't exist, or alter existing table
create table if not exists fee_bills (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  bill_number text not null,
  bill_date date not null,
  due_date date not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Add columns if they don't exist
alter table fee_bills
  add column if not exists period_type text check (period_type in ('monthly', 'quarterly', 'yearly', 'one-time')),
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists period_label text,
  add column if not exists total_amount numeric check (total_amount >= 0),
  add column if not exists discount_amount numeric default 0 check (discount_amount >= 0),
  add column if not exists fine_amount numeric default 0 check (fine_amount >= 0),
  add column if not exists paid_amount numeric default 0 check (paid_amount >= 0),
  add column if not exists pending_amount numeric check (pending_amount >= 0),
  add column if not exists status text check (status in ('draft', 'generated', 'partially_paid', 'paid', 'overdue', 'cancelled')) default 'generated',
  add column if not exists generated_by uuid references profiles(id),
  add column if not exists generated_at timestamp default now(),
  add column if not exists notes text;

-- Set defaults for existing rows
update fee_bills set period_type = 'monthly' where period_type is null;
update fee_bills set total_amount = 0 where total_amount is null;
update fee_bills set pending_amount = 0 where pending_amount is null;
update fee_bills set status = 'generated' where status is null;

-- Add constraints if they don't exist
do $$
begin
  -- Add unique constraint if it doesn't exist
  if not exists (
    select 1 from pg_constraint where conname = 'fee_bills_school_bill_number_unique'
  ) then
    alter table fee_bills add constraint fee_bills_school_bill_number_unique unique(school_id, bill_number);
  end if;
  
  -- Add not null constraints
  alter table fee_bills alter column period_type set not null;
  alter table fee_bills alter column total_amount set not null;
  alter table fee_bills alter column pending_amount set not null;
exception
  when others then
    -- Ignore if constraints already exist
    null;
end $$;

-- Create indexes if they don't exist
create index if not exists idx_fee_bills_student on fee_bills(student_id, status);
create index if not exists idx_fee_bills_school on fee_bills(school_id);
create index if not exists idx_fee_bills_period on fee_bills(period_start, period_end);
create index if not exists idx_fee_bills_due_date on fee_bills(due_date, status);

-- ============================================
-- 11. FEE BILL ITEMS (Line items in each bill)
-- ============================================
create table if not exists fee_bill_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid references fee_bills(id) on delete cascade,
  created_at timestamp default now()
);

-- Add columns if they don't exist (handle existing table)
alter table fee_bill_items
  add column if not exists student_id uuid references students(id) on delete cascade,
  add column if not exists school_id uuid references schools(id) on delete cascade;

-- Add remaining columns if they don't exist
alter table fee_bill_items
  add column if not exists fee_category_id uuid references fee_categories(id) on delete cascade,
  add column if not exists item_name text,
  add column if not exists item_type text check (item_type in ('tuition', 'transport', 'optional', 'custom', 'fine', 'discount')),
  add column if not exists base_amount numeric check (base_amount >= 0),
  add column if not exists discount_amount numeric default 0 check (discount_amount >= 0),
  add column if not exists final_amount numeric check (final_amount >= 0),
  add column if not exists quantity integer default 1,
  add column if not exists unit_price numeric,
  add column if not exists description text;

-- Set defaults for existing rows
update fee_bill_items set item_type = 'custom' where item_type is null;
update fee_bill_items set base_amount = 0 where base_amount is null;
update fee_bill_items set final_amount = 0 where final_amount is null;
update fee_bill_items set quantity = 1 where quantity is null;

-- Add not null constraints
do $$
begin
  alter table fee_bill_items alter column item_name set not null;
  alter table fee_bill_items alter column item_type set not null;
  alter table fee_bill_items alter column base_amount set not null;
  alter table fee_bill_items alter column final_amount set not null;
exception
  when others then
    null;
end $$;

-- Create indexes if they don't exist
create index if not exists idx_fee_bill_items_bill on fee_bill_items(bill_id);
create index if not exists idx_fee_bill_items_student on fee_bill_items(student_id);

-- ============================================
-- 12. FEE PAYMENTS (Payment records)
-- ============================================
create table if not exists fee_payments (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid references fee_bills(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Add columns if they don't exist
alter table fee_payments
  add column if not exists payment_amount numeric check (payment_amount > 0),
  add column if not exists payment_date date,
  add column if not exists payment_mode text check (payment_mode in ('cash', 'online', 'upi', 'card', 'cheque', 'bank_transfer')),
  add column if not exists transaction_id text,
  add column if not exists receipt_number text,
  add column if not exists received_by uuid references profiles(id),
  add column if not exists notes text;

-- Set defaults for existing rows
update fee_payments set payment_date = current_date where payment_date is null;
update fee_payments set payment_mode = 'cash' where payment_mode is null;

-- Add not null constraints
do $$
begin
  alter table fee_payments alter column payment_amount set not null;
  alter table fee_payments alter column payment_date set not null;
  alter table fee_payments alter column payment_mode set not null;
exception
  when others then
    null;
end $$;

-- Create indexes if they don't exist
create index if not exists idx_fee_payments_bill on fee_payments(bill_id);
create index if not exists idx_fee_payments_student on fee_payments(student_id);
create index if not exists idx_fee_payments_school on fee_payments(school_id);
create index if not exists idx_fee_payments_date on fee_payments(payment_date);

-- ============================================
-- 13. FINE RULES (Late fee rules)
-- ============================================
create table if not exists fine_rules (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  
  rule_name text not null,
  fine_type text check (fine_type in ('fixed', 'percentage', 'per_day')) not null,
  fine_amount numeric check (fine_amount >= 0), -- For fixed or per_day
  fine_percentage numeric check (fine_percentage >= 0 and fine_percentage <= 100), -- For percentage
  days_after_due integer check (days_after_due >= 0), -- Days after due date to apply fine
  max_fine_amount numeric, -- Maximum fine cap
  
  is_active boolean default true,
  effective_from date,
  effective_to date,
  
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create index idx_fine_rules_school on fine_rules(school_id, is_active);

-- ============================================
-- Enable Row Level Security
-- ============================================
alter table fee_categories enable row level security;
alter table class_fee_defaults enable row level security;
alter table transport_fee_defaults enable row level security;
alter table optional_fee_definitions enable row level security;
alter table student_fee_profile enable row level security;
alter table student_fee_overrides enable row level security;
alter table student_custom_fees enable row level security;
alter table student_optional_fees enable row level security;
alter table scholarships enable row level security;
alter table fee_bills enable row level security;
alter table fee_bill_items enable row level security;
alter table fee_payments enable row level security;
alter table fine_rules enable row level security;

-- ============================================
-- RLS Policies - Fee Categories
-- ============================================
drop policy if exists mt_fee_categories_select on fee_categories;
create policy mt_fee_categories_select on fee_categories
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_fee_categories_modify on fee_categories;
create policy mt_fee_categories_modify on fee_categories
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Class Fee Defaults
-- ============================================
drop policy if exists mt_class_fee_defaults_select on class_fee_defaults;
create policy mt_class_fee_defaults_select on class_fee_defaults
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_class_fee_defaults_modify on class_fee_defaults;
create policy mt_class_fee_defaults_modify on class_fee_defaults
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Transport Fee Defaults
-- ============================================
drop policy if exists mt_transport_fee_defaults_select on transport_fee_defaults;
create policy mt_transport_fee_defaults_select on transport_fee_defaults
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_transport_fee_defaults_modify on transport_fee_defaults;
create policy mt_transport_fee_defaults_modify on transport_fee_defaults
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Optional Fee Definitions
-- ============================================
drop policy if exists mt_optional_fee_definitions_select on optional_fee_definitions;
create policy mt_optional_fee_definitions_select on optional_fee_definitions
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_optional_fee_definitions_modify on optional_fee_definitions;
create policy mt_optional_fee_definitions_modify on optional_fee_definitions
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Fee Profile
-- ============================================
drop policy if exists mt_student_fee_profile_select on student_fee_profile;
create policy mt_student_fee_profile_select on student_fee_profile
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_profile.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_profile_modify on student_fee_profile;
create policy mt_student_fee_profile_modify on student_fee_profile
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Fee Overrides
-- ============================================
drop policy if exists mt_student_fee_overrides_select on student_fee_overrides;
create policy mt_student_fee_overrides_select on student_fee_overrides
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_overrides.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_overrides_modify on student_fee_overrides;
create policy mt_student_fee_overrides_modify on student_fee_overrides
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Custom Fees
-- ============================================
drop policy if exists mt_student_custom_fees_select on student_custom_fees;
create policy mt_student_custom_fees_select on student_custom_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_custom_fees.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_custom_fees_modify on student_custom_fees;
create policy mt_student_custom_fees_modify on student_custom_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Optional Fees
-- ============================================
drop policy if exists mt_student_optional_fees_select on student_optional_fees;
create policy mt_student_optional_fees_select on student_optional_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_optional_fees.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_optional_fees_modify on student_optional_fees;
create policy mt_student_optional_fees_modify on student_optional_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Scholarships
-- ============================================
drop policy if exists mt_scholarships_select on scholarships;
create policy mt_scholarships_select on scholarships
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = scholarships.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_scholarships_modify on scholarships;
create policy mt_scholarships_modify on scholarships
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Fee Bills
-- ============================================
drop policy if exists mt_fee_bills_select on fee_bills;
create policy mt_fee_bills_select on fee_bills
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = fee_bills.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_fee_bills_modify on fee_bills;
create policy mt_fee_bills_modify on fee_bills
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Fee Bill Items
-- ============================================
drop policy if exists mt_fee_bill_items_select on fee_bill_items;
create policy mt_fee_bill_items_select on fee_bill_items
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = fee_bill_items.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_fee_bill_items_modify on fee_bill_items;
create policy mt_fee_bill_items_modify on fee_bill_items
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Fee Payments
-- ============================================
drop policy if exists mt_fee_payments_select on fee_payments;
create policy mt_fee_payments_select on fee_payments
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = fee_payments.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_fee_payments_modify on fee_payments;
create policy mt_fee_payments_modify on fee_payments
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Fine Rules
-- ============================================
drop policy if exists mt_fine_rules_select on fine_rules;
create policy mt_fine_rules_select on fine_rules
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_fine_rules_modify on fine_rules;
create policy mt_fine_rules_modify on fine_rules
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- Triggers
-- ============================================
-- Drop existing triggers if they exist, then create new ones
drop trigger if exists update_fee_categories_updated_at on fee_categories;
create trigger update_fee_categories_updated_at
  before update on fee_categories
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_class_fee_defaults_updated_at on class_fee_defaults;
create trigger update_class_fee_defaults_updated_at
  before update on class_fee_defaults
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_transport_fee_defaults_updated_at on transport_fee_defaults;
create trigger update_transport_fee_defaults_updated_at
  before update on transport_fee_defaults
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_optional_fee_definitions_updated_at on optional_fee_definitions;
create trigger update_optional_fee_definitions_updated_at
  before update on optional_fee_definitions
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_student_fee_profile_updated_at on student_fee_profile;
create trigger update_student_fee_profile_updated_at
  before update on student_fee_profile
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_student_fee_overrides_updated_at on student_fee_overrides;
create trigger update_student_fee_overrides_updated_at
  before update on student_fee_overrides
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_student_custom_fees_updated_at on student_custom_fees;
create trigger update_student_custom_fees_updated_at
  before update on student_custom_fees
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_student_optional_fees_updated_at on student_optional_fees;
create trigger update_student_optional_fees_updated_at
  before update on student_optional_fees
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_scholarships_updated_at on scholarships;
create trigger update_scholarships_updated_at
  before update on scholarships
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_fee_bills_updated_at on fee_bills;
create trigger update_fee_bills_updated_at
  before update on fee_bills
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_fee_payments_updated_at on fee_payments;
create trigger update_fee_payments_updated_at
  before update on fee_payments
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_fine_rules_updated_at on fine_rules;
create trigger update_fine_rules_updated_at
  before update on fine_rules
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Function: Update bill status on payment
-- ============================================
create or replace function update_fee_bill_on_payment()
returns trigger language plpgsql as $$
declare
  total_paid numeric;
  bill_total numeric;
begin
  -- Calculate total paid for this bill
  select coalesce(sum(payment_amount), 0) into total_paid
  from fee_payments
  where bill_id = new.bill_id;
  
  -- Get bill total
  select total_amount into bill_total
  from fee_bills
  where id = new.bill_id;
  
  -- Update bill
  update fee_bills
  set 
    paid_amount = total_paid,
    pending_amount = bill_total - total_paid - coalesce(discount_amount, 0),
    status = case
      when total_paid >= (bill_total - coalesce(discount_amount, 0)) then 'paid'
      when total_paid > 0 then 'partially_paid'
      else status
    end,
    updated_at = now()
  where id = new.bill_id;
  
  return new;
end;
$$;

drop trigger if exists trigger_update_fee_bill_on_payment on fee_payments;
create trigger trigger_update_fee_bill_on_payment
  after insert or update on fee_payments
  for each row
  execute function update_fee_bill_on_payment();

-- ============================================
-- Comments
-- ============================================
comment on table fee_categories is 'Master list of fee types (tuition, transport, uniform, etc.)';
comment on table class_fee_defaults is 'Default fees per class - inherited by students';
comment on table transport_fee_defaults is 'Transport fees per route/class';
comment on table optional_fee_definitions is 'Optional fees available per class';
comment on table student_fee_profile is 'Student-specific fee settings (transport enabled, fee cycles)';
comment on table student_fee_overrides is 'Override specific fee amounts for a student';
comment on table student_custom_fees is 'Additional custom fees per student';
comment on table student_optional_fees is 'Which optional fees student has opted in';
comment on table scholarships is 'Scholarships and discounts per student';
comment on table fee_bills is 'Generated fee bills';
comment on table fee_bill_items is 'Line items in each bill';
comment on table fee_payments is 'Payment records';
comment on table fine_rules is 'Late fee rules';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

