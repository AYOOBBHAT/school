-- Migration: Fix Payment Status Logic - Automatic Unpaid Status
-- Purpose: Automatically mark students as unpaid for months without payment
--          Show unpaid salary months for teachers to principals
-- Note: This migration checks for table existence before creating views/functions

-- ============================================
-- HELPER: Check if table exists
-- ============================================
create or replace function table_exists(p_table_name text)
returns boolean language sql stable as $$
  select exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = p_table_name
  );
$$;

-- ============================================
-- 1. AUTO-UPDATE OVERDUE STATUS
-- ============================================
-- Function to automatically mark bills as overdue when due_date passes

create or replace function update_overdue_bills()
returns void language plpgsql as $$
begin
  -- Only update if fee_bills table exists
  if not table_exists('fee_bills') then
    return;
  end if;
  
  -- Update bills that are past due date and not paid
  execute format('
    update fee_bills
    set 
      status = ''overdue'',
      updated_at = now()
    where 
      due_date < current_date
      and status not in (''paid'', ''cancelled'')
      and pending_amount > 0
  ');
end;
$$;

-- Create a scheduled job (using pg_cron if available, otherwise manual trigger)
-- Note: In Supabase, you can set up a cron job via Dashboard → Database → Cron Jobs
-- Schedule: Run daily at midnight
-- SQL: SELECT update_overdue_bills();

-- ============================================
-- 2. STUDENT UNPAID MONTHS VIEW
-- ============================================
-- View that shows all unpaid months for students, including months without bills
-- Only create if required tables exist

do $$
begin
  -- Only create view if required tables exist
  if table_exists('students') and table_exists('profiles') then
    -- Check if fee_bills exists to determine view structure
    if table_exists('fee_bills') then
      -- Full view with fee_bills support
      execute format('
        drop view if exists student_unpaid_months cascade;
        create view student_unpaid_months as
        with 
        student_fee_cycles as (
          select distinct
            s.id as student_id,
            s.school_id,
            s.class_group_id,
            coalesce(
              (select sfp.tuition_fee_cycle from student_fee_profile sfp 
               where sfp.student_id = s.id 
               and sfp.is_active = true
               and (sfp.effective_to is null or sfp.effective_to >= current_date)
               limit 1),
              (select sfc.fee_cycle from student_fee_cycles sfc 
               where sfc.student_id = s.id 
               and sfc.fee_category_id is null 
               and sfc.is_active = true
               and (sfc.effective_to is null or sfc.effective_to >= current_date)
               limit 1),
              ''monthly''
            ) as fee_cycle,
            s.status as student_status
          from students s
          left join student_fee_profile sfp on sfp.student_id = s.id 
            and sfp.is_active = true
            and (sfp.effective_to is null or sfp.effective_to >= current_date)
          where s.status = ''active''
        ),
        expected_months as (
          select 
            sfc.student_id,
            sfc.school_id,
            sfc.class_group_id,
            sfc.fee_cycle,
            date_trunc(''month'', generate_series(
              date_trunc(''month'', current_date - interval ''12 months''),
              date_trunc(''month'', current_date),
              ''1 month''::interval
            ))::date as period_start,
            (date_trunc(''month'', generate_series(
              date_trunc(''month'', current_date - interval ''12 months''),
              date_trunc(''month'', current_date),
              ''1 month''::interval
            )) + interval ''1 month - 1 day'')::date as period_end
          from student_fee_cycles sfc
        ),
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
            case 
              when fb.due_date < current_date and fb.status != ''paid'' and fb.pending_amount > 0 
              then ''overdue''
              when fb.status = ''paid'' 
              then ''paid''
              when fb.pending_amount > 0 
              then ''unpaid''
              else fb.status
            end as payment_status
          from fee_bills fb
          where fb.status != ''cancelled''
        )
        select 
          em.student_id,
          em.school_id,
          em.class_group_id,
          em.period_start,
          em.period_end,
          to_char(em.period_start, ''Month YYYY'') as period_label,
          coalesce(ab.bill_id, null) as bill_id,
          coalesce(ab.bill_number, null) as bill_number,
          coalesce(ab.status, ''unpaid'') as bill_status,
          coalesce(ab.payment_status, ''unpaid'') as payment_status,
          coalesce(ab.pending_amount, 0) as pending_amount,
          coalesce(ab.total_amount, 0) as total_amount,
          coalesce(ab.paid_amount, 0) as paid_amount,
          coalesce(ab.due_date, em.period_end + interval ''7 days'') as due_date,
          case 
            when ab.due_date is not null and ab.due_date < current_date and ab.payment_status != ''paid''
            then (current_date - ab.due_date)::integer
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
          coalesce(ab.payment_status, ''unpaid'') != ''paid''
        order by em.student_id, em.period_start desc
      ');
    else
      -- Simplified view without fee_bills (all months marked as unpaid)
      execute format('
        drop view if exists student_unpaid_months cascade;
        create view student_unpaid_months as
        with 
        student_fee_cycles as (
          select distinct
            s.id as student_id,
            s.school_id,
            s.class_group_id,
            coalesce(
              (select sfp.tuition_fee_cycle from student_fee_profile sfp 
               where sfp.student_id = s.id 
               and sfp.is_active = true
               and (sfp.effective_to is null or sfp.effective_to >= current_date)
               limit 1),
              (select sfc.fee_cycle from student_fee_cycles sfc 
               where sfc.student_id = s.id 
               and sfc.fee_category_id is null 
               and sfc.is_active = true
               and (sfc.effective_to is null or sfc.effective_to >= current_date)
               limit 1),
              ''monthly''
            ) as fee_cycle,
            s.status as student_status
          from students s
          left join student_fee_profile sfp on sfp.student_id = s.id 
            and sfp.is_active = true
            and (sfp.effective_to is null or sfp.effective_to >= current_date)
          where s.status = ''active''
        ),
        expected_months as (
          select 
            sfc.student_id,
            sfc.school_id,
            sfc.class_group_id,
            sfc.fee_cycle,
            date_trunc(''month'', generate_series(
              date_trunc(''month'', current_date - interval ''12 months''),
              date_trunc(''month'', current_date),
              ''1 month''::interval
            ))::date as period_start,
            (date_trunc(''month'', generate_series(
              date_trunc(''month'', current_date - interval ''12 months''),
              date_trunc(''month'', current_date),
              ''1 month''::interval
            )) + interval ''1 month - 1 day'')::date as period_end
          from student_fee_cycles sfc
        )
        select 
          em.student_id,
          em.school_id,
          em.class_group_id,
          em.period_start,
          em.period_end,
          to_char(em.period_start, ''Month YYYY'') as period_label,
          null as bill_id,
          null as bill_number,
          ''unpaid'' as bill_status,
          ''unpaid'' as payment_status,
          0 as pending_amount,
          0 as total_amount,
          0 as paid_amount,
          em.period_end + interval ''7 days'' as due_date,
          case 
            when em.period_end < current_date
            then (current_date - em.period_end)::integer
            else 0
          end as days_overdue,
          true as bill_not_generated
        from expected_months em
        order by em.student_id, em.period_start desc
      ');
    end if;
  end if;
end $$;

-- ============================================
-- 3. UNPAID STUDENTS LIST VIEW
-- ============================================
-- View that lists all students with unpaid fees
-- Only create if student_unpaid_months view exists

do $$
begin
  if table_exists('students') and table_exists('profiles') then
    execute format('
      drop view if exists unpaid_students_list cascade;
      create view unpaid_students_list as
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
        max(sum.period_start) as latest_unpaid_month
      from students s
      inner join profiles p on p.id = s.profile_id
      left join class_groups cg on cg.id = s.class_group_id
      left join sections sec on sec.id = s.section_id
      inner join student_unpaid_months sum on sum.student_id = s.id
      where 
        s.status = ''active''
        and sum.payment_status != ''paid''
      group by 
        s.id, s.school_id, s.class_group_id, s.section_id, s.roll_number, s.status,
        p.id, p.full_name, p.email, p.phone, cg.name, sec.name
      having count(distinct sum.period_start) > 0
      order by total_pending_amount desc, max_days_overdue desc
    ');
  end if;
end $$;

-- ============================================
-- 4. PAYMENT STATUS DISTRIBUTION VIEW
-- ============================================
-- View that shows payment status distribution for a school

do $$
begin
  if table_exists('students') then
    execute format('
      drop view if exists payment_status_distribution cascade;
      create view payment_status_distribution as
      select 
        school_id,
        payment_status,
        count(distinct student_id) as student_count,
        count(*) as month_count,
        sum(pending_amount) as total_pending_amount,
        avg(pending_amount) as avg_pending_amount,
        sum(case when days_overdue > 0 then 1 else 0 end) as overdue_count
      from student_unpaid_months
      group by school_id, payment_status
      order by school_id, payment_status
    ');
  end if;
end $$;

-- ============================================
-- 5. TEACHER UNPAID SALARY MONTHS VIEW
-- ============================================
-- View that shows all unpaid salary months for teachers
-- Only create if required tables exist

do $$
begin
  if table_exists('profiles') and table_exists('teacher_salary_structure') then
    execute format('
      drop view if exists teacher_unpaid_salary_months cascade;
      create view teacher_unpaid_salary_months as
      with 
      active_teachers as (
        select distinct
          p.id as teacher_id,
          p.school_id,
          p.full_name,
          p.email,
          tss.id as salary_structure_id,
          tss.salary_cycle
        from profiles p
        inner join teacher_salary_structure tss on tss.teacher_id = p.id
        where p.role = ''teacher''
          and p.approval_status = ''approved''
      ),
      expected_salary_months as (
        select 
          at.teacher_id,
          at.school_id,
          at.full_name,
          at.email,
          at.salary_structure_id,
          extract(month from generate_series(
            date_trunc(''month'', current_date - interval ''12 months''),
            date_trunc(''month'', current_date),
            ''1 month''::interval
          ))::integer as month,
          extract(year from generate_series(
            date_trunc(''month'', current_date - interval ''12 months''),
            date_trunc(''month'', current_date),
            ''1 month''::interval
          ))::integer as year,
          date_trunc(''month'', generate_series(
            date_trunc(''month'', current_date - interval ''12 months''),
            date_trunc(''month'', current_date),
            ''1 month''::interval
          ))::date as period_start
        from active_teachers at
      ),
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
      )
      select 
        esm.teacher_id,
        esm.school_id,
        esm.full_name as teacher_name,
        esm.email as teacher_email,
        esm.month,
        esm.year,
        esm.period_start,
        to_char(make_date(esm.year, esm.month, 1), ''Month YYYY'') as period_label,
        coalesce(asr.salary_record_id, null) as salary_record_id,
        coalesce(asr.status, ''unpaid'') as payment_status,
        coalesce(asr.net_salary, 0) as net_salary,
        asr.payment_date,
        asr.approved_at,
        case 
          when asr.salary_record_id is null then true
          else false
        end as salary_not_generated,
        case 
          when coalesce(asr.status, ''unpaid'') = ''paid'' then false
          else true
        end as is_unpaid,
        (current_date - esm.period_start)::integer as days_since_period_start
      from expected_salary_months esm
      left join actual_salary_records asr on 
        asr.teacher_id = esm.teacher_id
        and asr.month = esm.month
        and asr.year = esm.year
      where 
        coalesce(asr.status, ''unpaid'') != ''paid''
      order by esm.teacher_id, esm.year desc, esm.month desc
    ');
  end if;
end $$;

-- ============================================
-- 6. UNPAID TEACHERS SUMMARY VIEW
-- ============================================
-- View for principals to see summary of unpaid teachers

do $$
begin
  if table_exists('profiles') then
    execute format('
      drop view if exists unpaid_teachers_summary cascade;
      create view unpaid_teachers_summary as
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
        array_agg(distinct period_label order by period_label) as unpaid_months_list
      from teacher_unpaid_salary_months
      where is_unpaid = true
      group by school_id, teacher_id, teacher_name, teacher_email
      order by total_unpaid_amount desc, max_days_unpaid desc
    ');
  end if;
end $$;

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================
-- Only create if tables exist

do $$
begin
  if table_exists('fee_bills') then
    execute format('create index if not exists idx_fee_bills_overdue_update on fee_bills(due_date, status, pending_amount) where status not in (''paid'', ''cancelled'') and pending_amount > 0');
    execute format('create index if not exists idx_fee_bills_student_period on fee_bills(student_id, period_start, period_end, status)');
  end if;
  
  if table_exists('teacher_salary_records') then
    execute format('create index if not exists idx_teacher_salary_records_teacher_month_year on teacher_salary_records(teacher_id, year, month, status)');
  end if;
end $$;

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================
-- Only create if views exist

do $$
begin
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'student_unpaid_months') then
    execute format('
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
      ) language sql stable as $func$
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
      $func$;
    ');
    
    execute format('
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
        max_days_overdue integer
      ) language sql stable as $func$
        select 
          student_id,
          full_name,
          roll_number,
          class_name,
          section_name,
          unpaid_months_count,
          total_pending_amount,
          max_days_overdue
        from unpaid_students_list
        where school_id = p_school_id
        order by total_pending_amount desc;
      $func$;
    ');
  end if;
  
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'teacher_unpaid_salary_months') then
    execute format('
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
      ) language sql stable as $func$
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
      $func$;
    ');
    
    execute format('
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
        unpaid_months_list text[]
      ) language sql stable as $func$
        select 
          teacher_id,
          teacher_name,
          teacher_email,
          unpaid_months_count,
          total_unpaid_amount,
          max_days_unpaid,
          unpaid_months_list
        from unpaid_teachers_summary
        where school_id = p_school_id
        order by total_unpaid_amount desc;
      $func$;
    ');
  end if;
end $$;

-- ============================================
-- 9. RLS POLICIES FOR VIEWS
-- ============================================
-- Grant access to views only if they exist

do $$
begin
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'student_unpaid_months') then
    execute format('grant select on student_unpaid_months to authenticated');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'unpaid_students_list') then
    execute format('grant select on unpaid_students_list to authenticated');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'payment_status_distribution') then
    execute format('grant select on payment_status_distribution to authenticated');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'teacher_unpaid_salary_months') then
    execute format('grant select on teacher_unpaid_salary_months to authenticated');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'unpaid_teachers_summary') then
    execute format('grant select on unpaid_teachers_summary to authenticated');
  end if;
end $$;

-- ============================================
-- 10. COMMENTS
-- ============================================
-- Add comments only if views/functions exist

do $$
begin
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'student_unpaid_months') then
    execute format('comment on view student_unpaid_months is ''Shows all unpaid months for students, including months without bills''');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'unpaid_students_list') then
    execute format('comment on view unpaid_students_list is ''Lists all students with unpaid fees and their totals''');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'payment_status_distribution') then
    execute format('comment on view payment_status_distribution is ''Payment status distribution statistics per school''');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'teacher_unpaid_salary_months') then
    execute format('comment on view teacher_unpaid_salary_months is ''Shows all unpaid salary months for teachers''');
  end if;
  if exists (select 1 from information_schema.views where table_schema = 'public' and table_name = 'unpaid_teachers_summary') then
    execute format('comment on view unpaid_teachers_summary is ''Summary of unpaid teachers for principals''');
  end if;
  
  execute format('comment on function update_overdue_bills() is ''Automatically marks bills as overdue when due_date passes''');
  
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'get_student_unpaid_months') then
    execute format('comment on function get_student_unpaid_months(uuid, uuid) is ''Get unpaid months for a specific student''');
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'get_teacher_unpaid_salary_months') then
    execute format('comment on function get_teacher_unpaid_salary_months(uuid, uuid) is ''Get unpaid salary months for a specific teacher''');
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'get_unpaid_students') then
    execute format('comment on function get_unpaid_students(uuid) is ''Get all unpaid students for a school''');
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'get_unpaid_teachers') then
    execute format('comment on function get_unpaid_teachers(uuid) is ''Get all unpaid teachers for a school (principals only)''');
  end if;
end $$;

-- ============================================
-- 11. REFRESH SCHEMA CACHE
-- ============================================
NOTIFY pgrst, 'reload schema';
