# Database Migrations

This directory contains SQL migration scripts for updating the database schema.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of the migration file
5. Paste into the SQL Editor
6. Click **Run**
7. Refresh the schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

### Option 2: Supabase CLI (if installed)

```bash
supabase db push
```

## Available Migrations

### 001_update_students_status_constraint.sql

**Purpose:** Updates the `students.status` column constraint to allow `'pending'` status.

**When to run:** After updating the code to use `'pending'` status for new student signups.

**What it does:**
- Drops the old constraint that only allowed `'active'` and `'inactive'`
- Adds a new constraint that allows `'active'`, `'inactive'`, and `'pending'`
- Sets the default value to `'pending'` for new records

**Important:** Run this migration if you're getting the error:
```
new row for relation "students" violates check constraint "students_status_check"
```

### 002_add_classification_tables.sql

**Purpose:** Creates the classification tables needed for the dynamic class classification system.

**When to run:** If you're getting the error:
```
Could not find the table 'public.classification_types' in the schema cache
```

**What it does:**
- Creates `classification_types` table (e.g., "Grade", "Section", "House", "Gender")
- Creates `classification_values` table (e.g., "Grade 9", "Section A", "Red House")
- Creates `class_classifications` table (links classes to classification values)
- Enables Row Level Security (RLS) on all tables
- Creates RLS policies for school isolation
- Refreshes the schema cache

**Important:** This migration must be run if you want to use the dynamic classification feature for organizing classes.

### 010_add_comprehensive_fee_management.sql

**Purpose:** Creates the comprehensive fee management system supporting multiple fee types, transport management, and bill generation.

**When to run:** If you're getting errors like:
```
Could not find the table 'class_fees' in the schema cache
Could not find the table 'transport_routes' in the schema cache
```

**What it does:**
- Creates `fee_categories` table (Tuition, Admission, Lab, Computer, etc.)
- Creates `class_fees` table (fee per class per category with `due_day` column)
- Creates `transport_routes` table (routes/buses per school)
- Creates `transport_fees` table (fee per route with `due_day` column)
- Creates `optional_fees` table (additional fees per school)
- Creates `student_transport` table (student-to-route assignments)
- Creates `student_custom_fees` table (individual adjustments: scholarships, fines, waivers)
- Creates `fee_bills` table (generated bills per student per period)
- Creates `fee_bill_items` table (line items in bills)
- Creates `fee_payments` table (payment tracking)
- Creates utility functions: `generate_bill_number()`, `generate_payment_number()`, `update_fee_bill_status()`
- Enables RLS on all tables with comprehensive policies
- Refreshes schema cache

**Important:** This migration depends on migration 009 (which creates the `update_updated_at_column()` function).

### 011_fix_rls_circular_policies.sql (NEW - CRITICAL FIX)

**Purpose:** Fixes infinite recursion errors in RLS policies created by migration 010.

**When to run:** MUST run after migration 010 if you're getting errors like:
```
Infinite recursion detected in policy for relation "students"
Could not find the 'due_day' column of 'class_fee_defaults' in the schema cache
```

**What it does:**
- Drops problematic circular RLS policies
- Recreates policies with simplified role-based access instead of complex joins
- Prevents `students` → `student_guardians` → `students` circular references
- Maintains security while improving performance
- Refreshes schema cache to register all changes

**Why it's needed:**
The migration 010 had RLS policies that joined `students` and `student_guardians` in a way that created circular dependencies. PostgreSQL's policy engine detected this recursion and threw errors. Migration 011 simplifies these policies to avoid the circular joins while maintaining the same security model.

**Important:** Apply this migration immediately after migration 010 to resolve infinite recursion errors. This migration is **CRITICAL** for the fee management system to function properly.

## Migration Order (Critical!)

Migrations MUST be run in this exact order:

1. `001_update_students_status_constraint.sql`
2. `002_add_classification_tables.sql`
3. `003_add_teacher_assignments.sql`
4. `004_add_class_subjects.sql`
5. `005_refresh_schema_cache.sql`
6. `006_add_exam_classes.sql`
7. `007_add_exam_schedule.sql`
8. `008_add_gender_to_profiles.sql`
9. `009_add_teacher_salary_tables.sql` ← Creates `update_updated_at_column()` function
10. `010_add_comprehensive_fee_management.sql` ← Uses function from 009
11. `011_fix_rls_circular_policies.sql` ← **MUST run right after 010**
12. `012_link_users_to_profiles.sql`
13. `013_add_school_registration_number.sql`
14. `014_add_student_username_auth.sql`

### Critical Dependencies

**If you run migration 010 without 009:**
```
ERROR: function update_updated_at_column() does not exist
```

**If you run migration 011 without 010:**
```
ERROR: policy "mt_fee_categories_select" for relation "fee_categories" does not exist
```

**If you don't run migration 011 after 010:**
```
ERROR: Infinite recursion detected in policy for relation "students"
ERROR: Could not find the 'due_day' column of 'class_fee_defaults' in the schema cache
```

## Troubleshooting

### Schema Cache Issues

If changes don't appear after running migrations, manually refresh the schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

### Rollback a Migration

If you need to rollback, you can run the "drop" statements from the migration in reverse order. However, it's recommended to create a new migration that handles the cleanup properly.

### Migration Failed Partway

If a migration fails partway through:

1. Check Supabase logs for the specific error
2. Fix the issue (e.g., missing dependency)
3. Re-run the entire migration from the start

Supabase tracks which migrations have been applied, so if a migration fails, you can fix it and run it again.

## Performance Notes

Migration 011 actually improves performance by:
- Reducing complexity in RLS policy evaluation
- Avoiding unnecessary joins in policy conditions
- Maintaining the same security guarantees with simpler expressions
