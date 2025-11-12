-- Migration: Add classification tables for dynamic class organization
-- This migration creates the tables needed for the dynamic classification system

-- Classification types: Custom classification categories for classes (e.g., "Grade", "Stream", "House", "Gender")
create table if not exists classification_types (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null, -- e.g., "Grade", "Stream", "House", "Gender"
  display_order integer default 0,
  created_at timestamp default now(),
  unique(school_id, name)
);

-- Classification values: Specific values for each type (e.g., "Grade 9", "Science", "Red House", "Boys")
create table if not exists classification_values (
  id uuid primary key default uuid_generate_v4(),
  classification_type_id uuid references classification_types(id) on delete cascade,
  value text not null, -- e.g., "Grade 9", "Science", "Red House"
  display_order integer default 0,
  created_at timestamp default now(),
  unique(classification_type_id, value)
);

-- Link classes to classification values (many-to-many)
create table if not exists class_classifications (
  class_group_id uuid references class_groups(id) on delete cascade,
  classification_value_id uuid references classification_values(id) on delete cascade,
  primary key (class_group_id, classification_value_id)
);

-- Enable Row Level Security
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;

-- Classification types policies
drop policy if exists mt_classification_types_select on classification_types;
create policy mt_classification_types_select on classification_types
  for select using (school_id = auth_claim('school_id')::uuid);

drop policy if exists mt_classification_types_modify on classification_types;
create policy mt_classification_types_modify on classification_types
  for all using (school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal')
  with check (school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal');

-- Classification values policies (accessible through type's school_id)
drop policy if exists mt_classification_values_select on classification_values;
create policy mt_classification_values_select on classification_values
  for select using (
    classification_type_id in (
      select id from classification_types where school_id = auth_claim('school_id')::uuid
    )
  );

drop policy if exists mt_classification_values_modify on classification_values;
create policy mt_classification_values_modify on classification_values
  for all using (
    classification_type_id in (
      select id from classification_types 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  ) with check (
    classification_type_id in (
      select id from classification_types 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  );

-- Class classifications policies
drop policy if exists mt_class_classifications_select on class_classifications;
create policy mt_class_classifications_select on class_classifications
  for select using (
    class_group_id in (
      select id from class_groups where school_id = auth_claim('school_id')::uuid
    )
  );

drop policy if exists mt_class_classifications_modify on class_classifications;
create policy mt_class_classifications_modify on class_classifications
  for all using (
    class_group_id in (
      select id from class_groups 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  ) with check (
    class_group_id in (
      select id from class_groups 
      where school_id = auth_claim('school_id')::uuid and auth_claim('role') = 'principal'
    )
  );

-- Refresh schema cache so Supabase recognizes the new tables
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE classification_types IS 'Custom classification categories for classes (e.g., Grade, Stream, House, Gender). Each school can define their own types.';
COMMENT ON TABLE classification_values IS 'Specific values for each classification type (e.g., Grade 9, Science, Red House, Boys)';
COMMENT ON TABLE class_classifications IS 'Links classes to classification values (many-to-many relationship)';

