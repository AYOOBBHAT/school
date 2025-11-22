-- Migration: Add Fee Versioning and Historical Fee Protection
-- Ensures fee hikes only affect future bills, old bills remain unchanged

-- Enable btree_gist extension for EXCLUDE constraints
create extension if not exists btree_gist;

-- ============================================
-- 1. CLASS FEE VERSIONS (Versioned class tuition fees)
-- ============================================
create table if not exists class_fee_versions (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  
  -- Version information
  version_number integer not null,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  
  -- Effective date range
  effective_from_date date not null,
  effective_to_date date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure no overlapping date ranges for same class+category+cycle
  exclude using gist (
    class_group_id with =,
    fee_category_id with =,
    fee_cycle with =,
    daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) with &&
  )
);

create index idx_class_fee_versions_class on class_fee_versions(class_group_id, fee_category_id, fee_cycle, is_active);
create index idx_class_fee_versions_dates on class_fee_versions(effective_from_date, effective_to_date);
create index idx_class_fee_versions_active on class_fee_versions(class_group_id, effective_from_date, effective_to_date) where is_active = true;

-- ============================================
-- 2. TRANSPORT FEE VERSIONS (Versioned transport fees)
-- ============================================
create table if not exists transport_fee_versions (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  route_name text, -- NULL = class-wide, or specific route name
  
  -- Version information
  version_number integer not null,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  
  -- Effective date range
  effective_from_date date not null,
  effective_to_date date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure no overlapping date ranges
  exclude using gist (
    class_group_id with =,
    route_name with =,
    fee_cycle with =,
    daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) with &&
  )
);

create index idx_transport_fee_versions_class on transport_fee_versions(class_group_id, route_name, fee_cycle, is_active);
create index idx_transport_fee_versions_dates on transport_fee_versions(effective_from_date, effective_to_date);

-- ============================================
-- 3. OPTIONAL FEE VERSIONS (Versioned optional fees)
-- ============================================
create table if not exists optional_fee_versions (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  
  -- Version information
  version_number integer not null,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time', 'per-bill')) not null,
  
  -- Effective date range
  effective_from_date date not null,
  effective_to_date date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure no overlapping date ranges
  exclude using gist (
    class_group_id with =,
    fee_category_id with =,
    fee_cycle with =,
    daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) with &&
  )
);

create index idx_optional_fee_versions_class on optional_fee_versions(class_group_id, fee_category_id, fee_cycle, is_active);
create index idx_optional_fee_versions_dates on optional_fee_versions(effective_from_date, effective_to_date);

-- ============================================
-- 4. STUDENT FEE OVERRIDE VERSIONS (Versioned student overrides)
-- ============================================
create table if not exists student_fee_override_versions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  
  -- Version information
  version_number integer not null,
  override_amount numeric not null check (override_amount >= 0),
  
  -- Effective date range
  effective_from_date date not null,
  effective_to_date date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure no overlapping date ranges
  exclude using gist (
    student_id with =,
    fee_category_id with =,
    daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) with &&
  )
);

create index idx_student_override_versions_student on student_fee_override_versions(student_id, fee_category_id, is_active);
create index idx_student_override_versions_dates on student_fee_override_versions(effective_from_date, effective_to_date);

-- ============================================
-- 5. SCHOLARSHIP VERSIONS (Versioned scholarships)
-- ============================================
-- Note: scholarships table must exist (created in migration 021)
-- Create scholarship_versions table with conditional foreign key
create table if not exists scholarship_versions (
  id uuid primary key default uuid_generate_v4(),
  scholarship_id uuid, -- Will add FK constraint after scholarships table exists
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Version information
  version_number integer not null,
  scholarship_type text check (scholarship_type in ('percentage', 'fixed', 'full_waiver')) not null,
  applies_to text check (applies_to in ('all', 'tuition_only', 'transport_only', 'specific_category')) not null,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  discount_percentage numeric check (discount_percentage >= 0 and discount_percentage <= 100),
  discount_amount numeric check (discount_amount >= 0),
  
  -- Effective date range
  effective_from_date date not null,
  effective_to_date date, -- NULL = currently active
  
  -- Metadata
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- Ensure no overlapping date ranges
  exclude using gist (
    scholarship_id with =,
    daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) with &&
  )
);

-- Add foreign key constraint if scholarships table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'scholarships') then
    alter table scholarship_versions
      add constraint scholarship_versions_scholarship_id_fkey
      foreign key (scholarship_id) references scholarships(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_scholarship_versions_scholarship on scholarship_versions(scholarship_id, is_active);
create index if not exists idx_scholarship_versions_student on scholarship_versions(student_id, is_active);
create index if not exists idx_scholarship_versions_dates on scholarship_versions(effective_from_date, effective_to_date);

-- ============================================
-- 6. MIGRATE EXISTING DATA TO VERSIONS
-- ============================================

-- Migrate class_fee_defaults to class_fee_versions
insert into class_fee_versions (
  school_id,
  class_group_id,
  fee_category_id,
  version_number,
  amount,
  fee_cycle,
  effective_from_date,
  effective_to_date,
  is_active
)
select 
  school_id,
  class_group_id,
  fee_category_id,
  1 as version_number,
  amount,
  fee_cycle,
  coalesce(effective_from, '2020-01-01'::date) as effective_from_date,
  effective_to as effective_to_date,
  is_active
from class_fee_defaults
where not exists (
  select 1 from class_fee_versions cv
  where cv.class_group_id = class_fee_defaults.class_group_id
    and cv.fee_category_id = class_fee_defaults.fee_category_id
    and cv.fee_cycle = class_fee_defaults.fee_cycle
);

-- Migrate transport_fee_defaults to transport_fee_versions
insert into transport_fee_versions (
  school_id,
  class_group_id,
  route_name,
  version_number,
  amount,
  fee_cycle,
  effective_from_date,
  effective_to_date,
  is_active
)
select 
  school_id,
  class_group_id,
  route_name,
  1 as version_number,
  amount,
  fee_cycle,
  coalesce(effective_from, '2020-01-01'::date) as effective_from_date,
  effective_to as effective_to_date,
  is_active
from transport_fee_defaults
where not exists (
  select 1 from transport_fee_versions tv
  where tv.class_group_id = transport_fee_defaults.class_group_id
    and tv.route_name is not distinct from transport_fee_defaults.route_name
    and tv.fee_cycle = transport_fee_defaults.fee_cycle
);

-- Migrate optional_fee_definitions to optional_fee_versions
insert into optional_fee_versions (
  school_id,
  class_group_id,
  fee_category_id,
  version_number,
  amount,
  fee_cycle,
  effective_from_date,
  effective_to_date,
  is_active
)
select 
  school_id,
  class_group_id,
  fee_category_id,
  1 as version_number,
  amount,
  fee_cycle,
  coalesce(effective_from, '2020-01-01'::date) as effective_from_date,
  effective_to as effective_to_date,
  is_active
from optional_fee_definitions
where not exists (
  select 1 from optional_fee_versions ov
  where ov.class_group_id = optional_fee_definitions.class_group_id
    and ov.fee_category_id = optional_fee_definitions.fee_category_id
    and ov.fee_cycle = optional_fee_definitions.fee_cycle
);

-- Migrate student_fee_overrides to student_fee_override_versions
insert into student_fee_override_versions (
  student_id,
  school_id,
  fee_category_id,
  version_number,
  override_amount,
  effective_from_date,
  effective_to_date,
  is_active
)
select 
  student_id,
  school_id,
  fee_category_id,
  1 as version_number,
  override_amount,
  coalesce(effective_from, '2020-01-01'::date) as effective_from_date,
  effective_to as effective_to_date,
  is_active
from student_fee_overrides
where not exists (
  select 1 from student_fee_override_versions sov
  where sov.student_id = student_fee_overrides.student_id
    and sov.fee_category_id = student_fee_overrides.fee_category_id
);

-- ============================================
-- 7. Enable Row Level Security
-- ============================================
alter table class_fee_versions enable row level security;
alter table transport_fee_versions enable row level security;
alter table optional_fee_versions enable row level security;
alter table student_fee_override_versions enable row level security;
alter table scholarship_versions enable row level security;

-- ============================================
-- RLS Policies - Class Fee Versions
-- ============================================
drop policy if exists mt_class_fee_versions_select on class_fee_versions;
create policy mt_class_fee_versions_select on class_fee_versions
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_class_fee_versions_modify on class_fee_versions;
create policy mt_class_fee_versions_modify on class_fee_versions
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Transport Fee Versions
-- ============================================
drop policy if exists mt_transport_fee_versions_select on transport_fee_versions;
create policy mt_transport_fee_versions_select on transport_fee_versions
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_transport_fee_versions_modify on transport_fee_versions;
create policy mt_transport_fee_versions_modify on transport_fee_versions
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Optional Fee Versions
-- ============================================
drop policy if exists mt_optional_fee_versions_select on optional_fee_versions;
create policy mt_optional_fee_versions_select on optional_fee_versions
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_optional_fee_versions_modify on optional_fee_versions;
create policy mt_optional_fee_versions_modify on optional_fee_versions
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Fee Override Versions
-- ============================================
drop policy if exists mt_student_fee_override_versions_select on student_fee_override_versions;
create policy mt_student_fee_override_versions_select on student_fee_override_versions
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_fee_override_versions.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_fee_override_versions_modify on student_fee_override_versions;
create policy mt_student_fee_override_versions_modify on student_fee_override_versions
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Scholarship Versions
-- ============================================
drop policy if exists mt_scholarship_versions_select on scholarship_versions;
create policy mt_scholarship_versions_select on scholarship_versions
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk', 'teacher')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = scholarship_versions.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_scholarship_versions_modify on scholarship_versions;
create policy mt_scholarship_versions_modify on scholarship_versions
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
drop trigger if exists update_class_fee_versions_updated_at on class_fee_versions;
create trigger update_class_fee_versions_updated_at
  before update on class_fee_versions
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_transport_fee_versions_updated_at on transport_fee_versions;
create trigger update_transport_fee_versions_updated_at
  before update on transport_fee_versions
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_optional_fee_versions_updated_at on optional_fee_versions;
create trigger update_optional_fee_versions_updated_at
  before update on optional_fee_versions
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_student_fee_override_versions_updated_at on student_fee_override_versions;
create trigger update_student_fee_override_versions_updated_at
  before update on student_fee_override_versions
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_scholarship_versions_updated_at on scholarship_versions;
create trigger update_scholarship_versions_updated_at
  before update on scholarship_versions
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Function: Get fee version for a specific date
-- ============================================
create or replace function get_class_fee_version(
  p_class_group_id uuid,
  p_fee_category_id uuid,
  p_fee_cycle text,
  p_target_date date
)
returns table (
  id uuid,
  amount numeric,
  version_number integer,
  effective_from_date date,
  effective_to_date date
) language sql stable as $$
  select 
    id,
    amount,
    version_number,
    effective_from_date,
    effective_to_date
  from class_fee_versions
  where class_group_id = p_class_group_id
    and fee_category_id = p_fee_category_id
    and fee_cycle = p_fee_cycle
    and is_active = true
    and effective_from_date <= p_target_date
    and (effective_to_date is null or effective_to_date >= p_target_date)
  order by version_number desc
  limit 1;
$$;

create or replace function get_transport_fee_version(
  p_class_group_id uuid,
  p_route_name text,
  p_fee_cycle text,
  p_target_date date
)
returns table (
  id uuid,
  amount numeric,
  version_number integer,
  effective_from_date date,
  effective_to_date date
) language sql stable as $$
  select 
    id,
    amount,
    version_number,
    effective_from_date,
    effective_to_date
  from transport_fee_versions
  where class_group_id = p_class_group_id
    and route_name is not distinct from p_route_name
    and fee_cycle = p_fee_cycle
    and is_active = true
    and effective_from_date <= p_target_date
    and (effective_to_date is null or effective_to_date >= p_target_date)
  order by version_number desc
  limit 1;
$$;

create or replace function get_optional_fee_version(
  p_class_group_id uuid,
  p_fee_category_id uuid,
  p_fee_cycle text,
  p_target_date date
)
returns table (
  id uuid,
  amount numeric,
  version_number integer,
  effective_from_date date,
  effective_to_date date
) language sql stable as $$
  select 
    id,
    amount,
    version_number,
    effective_from_date,
    effective_to_date
  from optional_fee_versions
  where class_group_id = p_class_group_id
    and fee_category_id = p_fee_category_id
    and fee_cycle = p_fee_cycle
    and is_active = true
    and effective_from_date <= p_target_date
    and (effective_to_date is null or effective_to_date >= p_target_date)
  order by version_number desc
  limit 1;
$$;

-- ============================================
-- Function: Create new fee version (hike fees)
-- ============================================
create or replace function create_class_fee_version(
  p_school_id uuid,
  p_class_group_id uuid,
  p_fee_category_id uuid,
  p_fee_cycle text,
  p_new_amount numeric,
  p_effective_from_date date,
  p_created_by uuid
)
returns uuid language plpgsql as $$
declare
  v_new_version_id uuid;
  v_new_version_number integer;
  v_previous_effective_to date;
begin
  -- Get next version number
  select coalesce(max(version_number), 0) + 1 into v_new_version_number
  from class_fee_versions
  where class_group_id = p_class_group_id
    and fee_category_id = p_fee_category_id
    and fee_cycle = p_fee_cycle;
  
  -- Close previous active version
  update class_fee_versions
  set 
    effective_to_date = p_effective_from_date - interval '1 day',
    is_active = false,
    updated_at = now()
  where class_group_id = p_class_group_id
    and fee_category_id = p_fee_category_id
    and fee_cycle = p_fee_cycle
    and is_active = true
    and (effective_to_date is null or effective_to_date >= p_effective_from_date);
  
  -- Create new version
  insert into class_fee_versions (
    school_id,
    class_group_id,
    fee_category_id,
    version_number,
    amount,
    fee_cycle,
    effective_from_date,
    effective_to_date,
    is_active,
    created_by
  ) values (
    p_school_id,
    p_class_group_id,
    p_fee_category_id,
    v_new_version_number,
    p_new_amount,
    p_fee_cycle,
    p_effective_from_date,
    null, -- Active until next version
    true,
    p_created_by
  ) returning id into v_new_version_id;
  
  return v_new_version_id;
end;
$$;

-- ============================================
-- Comments
-- ============================================
comment on table class_fee_versions is 'Version history of class fees - ensures old bills remain unchanged when fees are hiked';
comment on table transport_fee_versions is 'Version history of transport fees - supports route-specific and class-wide fee hikes';
comment on table optional_fee_versions is 'Version history of optional fees - supports fee hikes for optional fees';
comment on table student_fee_override_versions is 'Version history of student fee overrides - ensures overrides respect time periods';
comment on table scholarship_versions is 'Version history of scholarships - ensures scholarships apply correctly to time periods';

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

