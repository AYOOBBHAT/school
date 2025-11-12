# Database Setup Instructions

## Step 1: Apply Schema to Supabase

You need to run the SQL schema in your Supabase project to create all the necessary tables.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (the one with URL `oqxbgbmlvrzqviurfvpo.supabase.co`)
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `/home/ayoobbhat/school/supabase/schema.sql`
6. Paste it into the SQL Editor
7. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Refresh Schema Cache (IMPORTANT!)

After running the schema, you MUST refresh the schema cache. In the same SQL Editor, run:

```sql
NOTIFY pgrst, 'reload schema';
```

This tells Supabase to refresh its schema cache so it recognizes the new tables.

### Option B: Using Supabase CLI (if installed)

```bash
# If you have Supabase CLI installed
supabase db push
```

## Step 2: Verify Tables Are Created

After running the schema, verify that the tables exist:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see these tables:
   - `schools`
   - `profiles`
   - `class_groups`
   - `sections`
   - `subjects`
   - `students`
   - `attendance`
   - `exams`
   - `marks`
   - `fee_structures`
   - `payments`
   - `clerk_logs`
   - `student_guardians`

## Step 3: Verify Service Role Key

Make sure your `.env` file has the correct service role key:

```env
SUPABASE_URL=https://oqxbgbmlvrzqviurfvpo.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** The service role key should start with `eyJ` and be a long JWT token. You can find it in:
- Supabase Dashboard > Settings > API > service_role key

## Step 4: Restart Backend Server

After applying the schema, restart your backend server:

```bash
cd apps/backend
npm run dev
```

## Troubleshooting

### Error: "Could not find the table 'public.schools'"
- Make sure you've run the schema.sql in Supabase SQL Editor
- Check that the tables exist in the Table Editor
- Verify you're connected to the correct Supabase project


## status: Running on caffeine & Hope






### Error: "Invalid API key"




- Verify your service role key is correct (not the anon key)
- Make sure there are no extra spaces or quotes in the .env file
- Restart the backend server after updating .env

### Error: "Permission denied" or RLS errors
- The service role key should bypass RLS automatically
- If you still get RLS errors, check that the policies in schema.sql were created correctly

### Error: "Email not confirmed" on login

**For new users:** This issue has been fixed. All new users created through the signup endpoints will have their emails automatically confirmed.

**For existing users:** If you have existing users who cannot log in due to "email not confirmed" error, you have two options:

1. **Via Approval (Recommended):** When a principal/clerk approves a user through the approval system, their email will be automatically confirmed.

2. **Via API Endpoint:** Use the `/auth/confirm-email` endpoint to confirm an existing user's email:
   ```bash
   curl -X POST http://localhost:4000/auth/confirm-email \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com"}'
   ```

3. **Via Supabase Dashboard:** 
   - Go to Supabase Dashboard > Authentication > Users
   - Find the user and click on them
   - Toggle "Email Confirmed" to true
   - Save the changes

### Error: "new row for relation 'students' violates check constraint 'students_status_check'"

This error occurs when trying to create a student with `status='pending'` but the database constraint doesn't allow it yet.

**Fix:** Run the migration SQL to update the constraint:

1. Go to Supabase Dashboard > SQL Editor
2. Open the migration file: `/supabase/migrations/001_update_students_status_constraint.sql`
3. Copy and paste the SQL into the SQL Editor
4. Click **Run**
5. Refresh the schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

**Quick Fix SQL:**
```sql
-- Drop the existing constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;

-- Add the new constraint that allows 'pending'
ALTER TABLE students
ADD CONSTRAINT students_status_check 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Update default to 'pending'
ALTER TABLE students
ALTER COLUMN status SET DEFAULT 'pending';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
```

### Debug: No Pending Approvals Showing

If you can't see pending approvals even after students sign up, check the following:

**1. Verify profiles are being created:**
   - Go to Supabase Dashboard > Table Editor > `profiles` table
   - Check if student profiles exist with `approval_status = 'pending'`
   - Verify they have the correct `school_id` matching your principal's school

**2. Check school_id matching:**
   - Your principal's profile should have a `school_id`
   - Student profiles should have the same `school_id` (from the join code they used)
   - Run this SQL to check:
     ```sql
     SELECT id, full_name, email, role, school_id, approval_status 
     FROM profiles 
     ORDER BY created_at DESC;
     ```

**3. Run debug queries:**
   - Open `/supabase/debug-pending-approvals.sql` in Supabase SQL Editor
   - Run the queries to see what's in the database

**4. Check backend logs:**
   - Look at the backend console for debug messages when loading approvals
   - Check for errors when students sign up
   - Verify the principal's `school_id` matches student `school_id`

**5. Common issues:**
   - **Different school_ids:** Student signed up with a different join code (different school)
   - **Profile not created:** Check backend logs for profile creation errors
   - **Approval status not set:** Old profiles might have NULL or wrong approval_status
   - **Database constraint error:** Make sure you ran the migration to allow 'pending' status

**6. Fix existing profiles:**
   If you have existing student profiles that need to be set to pending:
   ```sql
   -- Update profiles to pending status (be careful with this!)
   UPDATE profiles 
   SET approval_status = 'pending' 
   WHERE role = 'student' 
   AND (approval_status IS NULL OR approval_status != 'pending');
   ```

### Error: "Could not find the table 'public.classification_types' in the schema cache"

This error occurs when the classification tables haven't been created in your database yet.

**Fix:** Run the migration SQL to create the classification tables:

1. Go to Supabase Dashboard > SQL Editor
2. Open the migration file: `/supabase/migrations/002_add_classification_tables.sql`
3. Copy and paste the SQL into the SQL Editor
4. Click **Run**
5. Verify the tables were created:
   - Go to Table Editor
   - You should see: `classification_types`, `classification_values`, `class_classifications`
6. The schema cache will be automatically refreshed by the `NOTIFY pgrst, 'reload schema';` command

**Quick Fix SQL:**
```sql
-- Create classification types table
create table if not exists classification_types (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid references schools(id) on delete cascade,
  name text not null,
  display_order integer default 0,
  created_at timestamp default now(),
  unique(school_id, name)
);

-- Create classification values table
create table if not exists classification_values (
  id uuid primary key default uuid_generate_v4(),
  classification_type_id uuid references classification_types(id) on delete cascade,
  value text not null,
  display_order integer default 0,
  created_at timestamp default now(),
  unique(classification_type_id, value)
);

-- Create class classifications link table
create table if not exists class_classifications (
  class_group_id uuid references class_groups(id) on delete cascade,
  classification_value_id uuid references classification_values(id) on delete cascade,
  primary key (class_group_id, classification_value_id)
);

-- Enable RLS
alter table classification_types enable row level security;
alter table classification_values enable row level security;
alter table class_classifications enable row level security;

-- Add RLS policies (copy from schema.sql lines 430-480)
-- Then refresh schema cache
NOTIFY pgrst, 'reload schema';
```

**Note:** After running the migration, restart your backend server to ensure it picks up the new tables.

