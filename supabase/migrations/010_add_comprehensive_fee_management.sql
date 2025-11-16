-- Migration: Add comprehensive fee management system
-- Supports: Class Fees, Transport Fees, Optional Fees, Custom Fees per student
-- Fully isolated by school_id with Row Level Security

-- ============================================
-- 1. FEE CATEGORIES (Dynamic fee types per school)
-- ============================================
create table if not exists fee_categories (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null, -- e.g., "Tuition Fee", "Admission Fee", "Computer Fee", "Lab Fee"
  description text,
  is_active boolean default true,
  display_order integer default 0,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, name)
);

-- ============================================
-- 2. CLASS FEES (Fee structure per class per category)
-- ============================================
create table if not exists class_fees (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  class_group_id uuid references class_groups(id) on delete cascade,
  fee_category_id uuid references fee_categories(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  fee_cycle text check (fee_cycle in ('one-time', 'monthly', 'quarterly', 'yearly')) default 'monthly',
  due_day integer check (due_day >= 1 and due_day <= 31), -- Day of month when due
  due_date date, -- For one-time fees
  is_active boolean default true,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(class_group_id, fee_category_id, fee_cycle, due_date) -- Prevent duplicates
);

-- ============================================
-- 3. TRANSPORT ROUTES (Routes/Buses per school)
-- ============================================
create table if not exists transport_routes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  route_name text not null, -- e.g., "Route A", "Bus 1", "North Zone"
  bus_number text,
  distance_km numeric,
  zone text, -- e.g., "North", "South", "East", "West"
  description text,
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, route_name)
);

-- ============================================
-- 4. TRANSPORT FEES (Fee per route)
-- ============================================
create table if not exists transport_fees (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  route_id uuid references transport_routes(id) on delete cascade,
  base_fee numeric not null check (base_fee >= 0),
  escort_fee numeric default 0 check (escort_fee >= 0), -- Optional escort service fee
  fuel_surcharge numeric default 0 check (fuel_surcharge >= 0), -- Optional fuel surcharge
  fee_cycle text check (fee_cycle in ('monthly', 'per-trip', 'yearly')) default 'monthly',
  due_day integer check (due_day >= 1 and due_day <= 31), -- Day of month when due
  is_active boolean default true,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(route_id, fee_cycle)
);

-- ============================================
-- 5. OPTIONAL FEES (Additional fees per school)
-- ============================================
create table if not exists optional_fees (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null, -- e.g., "Library Fee", "Sports Equipment Fee"
  description text,
  default_amount numeric not null check (default_amount >= 0),
  fee_cycle text check (fee_cycle in ('one-time', 'monthly', 'quarterly', 'yearly')) default 'one-time',
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, name)
);

-- ============================================
-- 6. STUDENT TRANSPORT ASSIGNMENT
-- ============================================
create table if not exists student_transport (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  route_id uuid references transport_routes(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  start_date date default current_date,
  end_date date, -- NULL means currently active
  stop_name text, -- Specific stop for this student
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Partial unique index: One active transport assignment per student
create unique index student_transport_active_unique 
  on student_transport(student_id, route_id) 
  where is_active = true;

-- ============================================
-- 7. STUDENT CUSTOM FEES (Individual student adjustments)
-- ============================================
create table if not exists student_custom_fees (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  fee_type text check (fee_type in ('additional', 'discount', 'scholarship', 'concession', 'fine', 'late-fee', 'waiver')) not null,
  description text not null, -- e.g., "Merit Scholarship", "Late Admission Fine"
  amount numeric not null, -- Positive for additional/fine, negative for discount/scholarship
  fee_cycle text check (fee_cycle in ('one-time', 'monthly', 'quarterly', 'yearly', 'per-bill')) default 'per-bill',
  effective_from date default current_date,
  effective_to date, -- NULL means indefinite
  is_active boolean default true,
  applied_by uuid references profiles(id), -- Who added this custom fee
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- ============================================
-- 8. FEE BILLS (Generated bills per student per period)
-- ============================================
create table if not exists fee_bills (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  bill_number text not null, -- Unique bill number per school
  bill_period_start date not null, -- e.g., "2024-01-01" for January
  bill_period_end date not null, -- e.g., "2024-01-31" for January
  bill_date date default current_date,
  due_date date not null,
  
  -- Breakdown
  class_fees_total numeric default 0 check (class_fees_total >= 0),
  transport_fee_total numeric default 0 check (transport_fee_total >= 0),
  optional_fees_total numeric default 0 check (optional_fees_total >= 0),
  custom_fees_total numeric default 0, -- Can be negative (discounts)
  fine_total numeric default 0 check (fine_total >= 0),
  
  -- Totals
  gross_amount numeric not null check (gross_amount >= 0),
  discount_amount numeric default 0 check (discount_amount >= 0),
  scholarship_amount numeric default 0 check (scholarship_amount >= 0),
  net_amount numeric not null check (net_amount >= 0),
  
  -- Status
  status text check (status in ('draft', 'pending', 'partially-paid', 'paid', 'overdue', 'cancelled')) default 'pending',
  generated_by uuid references profiles(id),
  generated_at timestamp default now(),
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, bill_number)
);

-- ============================================
-- 9. FEE BILL ITEMS (Line items in each bill)
-- ============================================
create table if not exists fee_bill_items (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid references fee_bills(id) on delete cascade,
  item_type text check (item_type in ('class-fee', 'transport-fee', 'optional-fee', 'custom-fee', 'fine')) not null,
  item_name text not null, -- e.g., "Tuition Fee", "Transport - Route A", "Merit Scholarship"
  amount numeric not null, -- Can be negative for discounts
  quantity numeric default 1,
  total_amount numeric not null,
  fee_category_id uuid references fee_categories(id),
  class_fee_id uuid references class_fees(id),
  transport_fee_id uuid references transport_fees(id),
  optional_fee_id uuid references optional_fees(id),
  custom_fee_id uuid references student_custom_fees(id),
  display_order integer default 0,
  created_at timestamp default now()
);

-- ============================================
-- 10. FEE PAYMENTS (Payments against bills)
-- ============================================
create table if not exists fee_payments (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid references fee_bills(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  payment_number text not null, -- Unique payment number per school
  amount_paid numeric not null check (amount_paid > 0),
  payment_date timestamp default now(),
  payment_mode text check (payment_mode in ('cash', 'online', 'upi', 'card', 'cheque', 'bank-transfer')) not null,
  transaction_id text,
  cheque_number text,
  bank_name text,
  received_by uuid references profiles(id),
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique(school_id, payment_number)
);

-- ============================================
-- Enable Row Level Security
-- ============================================
alter table fee_categories enable row level security;
alter table class_fees enable row level security;
alter table transport_routes enable row level security;
alter table transport_fees enable row level security;
alter table optional_fees enable row level security;
alter table student_transport enable row level security;
alter table student_custom_fees enable row level security;
alter table fee_bills enable row level security;
alter table fee_bill_items enable row level security;
alter table fee_payments enable row level security;

-- ============================================
-- RLS Policies - Fee Categories
-- ============================================
drop policy if exists mt_fee_categories_select on fee_categories;
create policy mt_fee_categories_select on fee_categories
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

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
-- RLS Policies - Class Fees
-- ============================================
drop policy if exists mt_class_fees_select on class_fees;
create policy mt_class_fees_select on class_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_class_fees_modify on class_fees;
create policy mt_class_fees_modify on class_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Transport Routes
-- ============================================
drop policy if exists mt_transport_routes_select on transport_routes;
create policy mt_transport_routes_select on transport_routes
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_transport_routes_modify on transport_routes;
create policy mt_transport_routes_modify on transport_routes
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Transport Fees
-- ============================================
drop policy if exists mt_transport_fees_select on transport_fees;
create policy mt_transport_fees_select on transport_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_transport_fees_modify on transport_fees;
create policy mt_transport_fees_modify on transport_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Optional Fees
-- ============================================
drop policy if exists mt_optional_fees_select on optional_fees;
create policy mt_optional_fees_select on optional_fees
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and exists (
        select 1 from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg
        join students s on s.id = sg.student_id
        where sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_optional_fees_modify on optional_fees;
create policy mt_optional_fees_modify on optional_fees
  for all using (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  ) with check (
    school_id = auth_claim('school_id')::uuid
    and auth_claim('role') in ('principal', 'clerk')
  );

-- ============================================
-- RLS Policies - Student Transport
-- ============================================
drop policy if exists mt_student_transport_select on student_transport;
create policy mt_student_transport_select on student_transport
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
      or (auth_claim('role') = 'student' and student_id in (
        select s.id from students s where s.profile_id = auth.uid()
      ))
      or (auth_claim('role') = 'parent' and exists (
        select 1 from student_guardians sg where sg.student_id = student_transport.student_id and sg.guardian_profile_id = auth.uid()
      ))
    )
  );

drop policy if exists mt_student_transport_modify on student_transport;
create policy mt_student_transport_modify on student_transport
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
      auth_claim('role') in ('principal', 'clerk')
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
-- RLS Policies - Fee Bills
-- ============================================
drop policy if exists mt_fee_bills_select on fee_bills;
create policy mt_fee_bills_select on fee_bills
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
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
    bill_id in (
      select id from fee_bills where school_id = auth_claim('school_id')::uuid
      and (
        auth_claim('role') in ('principal', 'clerk')
        or (auth_claim('role') = 'student' and student_id in (
          select s.id from students s where s.profile_id = auth.uid()
        ))
        or (auth_claim('role') = 'parent' and exists (
          select 1 from student_guardians sg where sg.student_id = fee_bills.student_id and sg.guardian_profile_id = auth.uid()
        ))
      )
    )
  );

drop policy if exists mt_fee_bill_items_modify on fee_bill_items;
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

-- ============================================
-- RLS Policies - Fee Payments
-- ============================================
drop policy if exists mt_fee_payments_select on fee_payments;
create policy mt_fee_payments_select on fee_payments
  for select using (
    school_id = auth_claim('school_id')::uuid
    and (
      auth_claim('role') in ('principal', 'clerk')
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
-- Triggers to auto-update updated_at
-- ============================================
create trigger update_fee_categories_updated_at
  before update on fee_categories
  for each row
  execute function update_updated_at_column();

create trigger update_class_fees_updated_at
  before update on class_fees
  for each row
  execute function update_updated_at_column();

create trigger update_transport_routes_updated_at
  before update on transport_routes
  for each row
  execute function update_updated_at_column();

create trigger update_transport_fees_updated_at
  before update on transport_fees
  for each row
  execute function update_updated_at_column();

create trigger update_optional_fees_updated_at
  before update on optional_fees
  for each row
  execute function update_updated_at_column();

create trigger update_student_transport_updated_at
  before update on student_transport
  for each row
  execute function update_updated_at_column();

create trigger update_student_custom_fees_updated_at
  before update on student_custom_fees
  for each row
  execute function update_updated_at_column();

create trigger update_fee_bills_updated_at
  before update on fee_bills
  for each row
  execute function update_updated_at_column();

create trigger update_fee_payments_updated_at
  before update on fee_payments
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Function to generate unique bill number
-- ============================================
create or replace function generate_bill_number(school_uuid uuid)
returns text language plpgsql as $$
declare
  school_code text;
  bill_count bigint;
  new_bill_number text;
begin
  -- Get school code (first 3 letters of school name or use ID)
  select substring(upper(name), 1, 3) into school_code from schools where id = school_uuid;
  if school_code is null then
    school_code := upper(substring(school_uuid::text, 1, 3));
  end if;
  
  -- Count existing bills for this school
  select count(*) + 1 into bill_count from fee_bills where school_id = school_uuid;
  
  -- Generate bill number: SCHOOL-YYYYMMDD-XXXX
  new_bill_number := school_code || '-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(bill_count::text, 4, '0');
  
  return new_bill_number;
end;
$$;

-- ============================================
-- Function to generate unique payment number
-- ============================================
create or replace function generate_payment_number(school_uuid uuid)
returns text language plpgsql as $$
declare
  school_code text;
  payment_count bigint;
  new_payment_number text;
begin
  -- Get school code
  select substring(upper(name), 1, 3) into school_code from schools where id = school_uuid;
  if school_code is null then
    school_code := upper(substring(school_uuid::text, 1, 3));
  end if;
  
  -- Count existing payments for this school
  select count(*) + 1 into payment_count from fee_payments where school_id = school_uuid;
  
  -- Generate payment number: SCHOOL-PMT-YYYYMMDD-XXXX
  new_payment_number := school_code || '-PMT-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(payment_count::text, 4, '0');
  
  return new_payment_number;
end;
$$;

-- ============================================
-- Function to update fee bill status based on payments
-- ============================================
create or replace function update_fee_bill_status()
returns trigger language plpgsql as $$
declare
  bill_net_amount numeric;
  total_paid numeric;
begin
  -- Get bill net amount and total paid
  select net_amount into bill_net_amount from fee_bills where id = new.bill_id;
  select coalesce(sum(amount_paid), 0) into total_paid from fee_payments where bill_id = new.bill_id;
  
  -- Update bill status
  if total_paid >= bill_net_amount then
    update fee_bills set status = 'paid' where id = new.bill_id;
  elsif total_paid > 0 then
    update fee_bills set status = 'partially-paid' where id = new.bill_id;
  end if;
  
  return new;
end;
$$;

create trigger update_bill_status_on_payment
  after insert or update on fee_payments
  for each row
  execute function update_fee_bill_status();

-- ============================================
-- Refresh schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE fee_categories IS 'Dynamic fee categories per school (Tuition, Admission, Computer, etc.)';
COMMENT ON TABLE class_fees IS 'Fee structure per class per category with cycles (monthly/quarterly/yearly)';
COMMENT ON TABLE transport_routes IS 'Transport routes/buses per school';
COMMENT ON TABLE transport_fees IS 'Transport fee per route with optional charges';
COMMENT ON TABLE optional_fees IS 'Optional fees per school (Library, Sports, etc.)';
COMMENT ON TABLE student_transport IS 'Student transport assignment to routes';
COMMENT ON TABLE student_custom_fees IS 'Individual student fee adjustments (discounts, scholarships, fines)';
COMMENT ON TABLE fee_bills IS 'Generated fee bills per student per period';
COMMENT ON TABLE fee_bill_items IS 'Line items in each fee bill';
COMMENT ON TABLE fee_payments IS 'Payments against fee bills';

