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

