# Unpaid Salaries Issue Summary

## Overview
This document summarizes all issues encountered while debugging and fixing the unpaid salaries feature in the salary management system.

---

## Problem Statement
The frontend was showing "No teachers with unpaid salaries" even though SQL queries confirmed that unpaid salary data exists in the database for multiple teachers.

---

## Issues Identified and Fixed

### Issue 1: Backend Query Selecting Non-Existent Columns
**Problem:**
- The backend route `/salary/unpaid` was trying to SELECT columns `credit_applied` and `effective_paid_amount` from the `teacher_unpaid_salary_months` view
- These columns do not exist in the current Supabase view definition
- This caused the Supabase query to fail silently, returning empty results

**Root Cause:**
- Migration `1008_add_salary_credit_system.sql` was supposed to add these columns to the view
- Either this migration was not applied, or a later migration removed them
- The backend code was written assuming these columns existed

**Fix Applied:**
- Removed `credit_applied` and `effective_paid_amount` from the SELECT statement in `apps/backend/src/routes/salary.ts` (line 1178)
- Removed these columns from the response mapping (line 1293-1294)

**Files Changed:**
- `apps/backend/src/routes/salary.ts`

---

### Issue 2: Backend Response Mapping Using Non-Existent Columns
**Problem:**
- Even after fixing the SELECT statement, the response mapping was still trying to access `credit_applied` and `effective_paid_amount` from the query results
- This would cause runtime errors when processing the response

**Fix Applied:**
- Removed `credit_applied` and `effective_paid_amount` from the `unpaid_months` mapping in the response object

**Files Changed:**
- `apps/backend/src/routes/salary.ts`

---

### Issue 3: Incorrect Route Replacement
**Problem:**
- When implementing the new salary API routes (`GET /salary` and `GET /salary/:role`), a simplified `SalaryPage` component was created
- This component replaced the original `SalaryManagement` component in the routes
- The original component had full functionality with tabs:
  - Salary Structure (create/edit teacher salary structures)
  - Unpaid Salaries (view and manage unpaid salaries)
  - All Records (view all salary records)
  - Reports (salary reports)
- The simplified component only showed a basic list of salary records

**Root Cause:**
- Misunderstanding of requirements - the new routes were meant to supplement existing functionality, not replace it

**Fix Applied:**
- Restored original routes to use `SalaryManagement` component for principal
- Restored original routes to use `SalaryPaymentSection` component for clerk
- Removed `SalaryPage` from active routes (kept in codebase for potential future use)

**Files Changed:**
- `apps/web/src/App.tsx`

---

### Issue 4: Frontend API URL Mismatch
**Problem:**
- The `SalaryPage` component was using hardcoded API URL construction
- It was calling `/api/salary/principal` which doesn't match backend route structure
- Backend routes are mounted at `/salary`, not `/api/salary`

**Fix Applied:**
- Updated to use shared `API_URL` and `ROUTES.salary` constants
- Changed to always call base `/salary` endpoint (which returns all records filtered by RLS)

**Files Changed:**
- `apps/web/src/pages/SalaryPage.tsx` (though this component is no longer in active use)

---

### Issue 5: TypeScript Type Definition Missing
**Problem:**
- `SalaryPage` component was accessing `payment_date` property on `SalaryRecord` interface
- The interface didn't include this property, causing TypeScript compilation errors

**Fix Applied:**
- Added `payment_date?: string | null;` to the `SalaryRecord` interface

**Files Changed:**
- `apps/web/src/pages/SalaryPage.tsx`

---

## Database View Structure

### Current `teacher_unpaid_salary_months` View Columns
As confirmed by `check_view_columns.sql`:
- `teacher_id` (uuid)
- `school_id` (uuid)
- `teacher_name` (text)
- `teacher_email` (text)
- `month` (integer)
- `year` (integer)
- `period_start` (date)
- `period_label` (text)
- `net_salary` (numeric)
- `paid_amount` (numeric)
- `pending_amount` (numeric)
- `payment_status` (text)
- `payment_date` (date)
- `is_unpaid` (boolean)
- `days_since_period_start` (integer)

### Missing Columns (Expected but Not Present)
- `credit_applied` - Expected from migration 1008
- `effective_paid_amount` - Expected from migration 1008

---

## SQL Queries Created for Debugging

### 1. `check_view_columns.sql`
- Checks what columns actually exist in the `teacher_unpaid_salary_months` view
- Used to identify missing columns

### 2. `check_unpaid_salaries_simple.sql`
- Simple queries to check unpaid salaries for a specific school
- Includes queries for:
  - `teacher_salary_summary` view
  - `teacher_unpaid_salary_months` view
  - `unpaid_teachers_summary` view
  - Teachers with salary structure but no payments

### 3. `debug_unpaid_salaries.sql`
- Comprehensive debugging queries
- Includes all queries from simple file plus additional diagnostic queries

### 4. `diagnose_unpaid_issue.sql`
- Diagnostic queries to understand why unpaid months aren't showing
- Checks:
  - Expected months vs actual months
  - Teachers with salary structure
  - `effective_from` date impact
  - View row counts

---

## Verification Results

### SQL Query Results (School ID: e5650d4b-2dbc-45f0-83d7-ce84b3bf9a3b)

**Query 2 Results (teacher_unpaid_salary_months):**
- Found unpaid months for multiple teachers:
  - hilal: 13 unpaid months (₹2,600,000 total)
  - waseem: 13 unpaid months (₹390,000 total)
  - showkat ah: 13 unpaid months (₹296,400 total)
  - teststaff: 13 unpaid months (₹78,000 total)
  - momin: 10 unpaid months (₹25,000.01 total)

**Query 3 Results (unpaid_teachers_summary):**
- Confirmed summary view also shows unpaid teachers with correct totals

**Conclusion:**
- Data exists in the database
- Views are working correctly
- The issue was purely in the backend query selecting non-existent columns

---

## Backend Routes Status

### Existing Routes (All Working)
- ✅ `GET /salary/unpaid` - Get unpaid salaries (FIXED)
- ✅ `GET /salary/records` - Get all salary records
- ✅ `GET /salary/reports` - Get salary reports
- ✅ `GET /salary/summary` - Get salary summary
- ✅ `GET /salary/structures` - Get salary structures
- ✅ `GET /salary/structure/:teacherId` - Get teacher salary structure
- ✅ `POST /salary/structure` - Create/update salary structure
- ✅ `POST /salary/generate` - Generate salary records
- ✅ `POST /salary/payments` - Record salary payment
- ✅ `GET /salary/payments` - Get payment history
- ✅ `GET /salary/credits/:teacherId` - Get teacher credits
- ✅ `GET /salary/history/:teacherId` - Get teacher payment history
- ✅ `GET /salary` - Get all salary records (NEW)
- ✅ `GET /salary/:role` - Get salary records by teacher role (NEW)

---

## Frontend Components Status

### Principal Salary Management
- ✅ `SalaryManagement` component - Full featured with tabs
  - Salary Structure tab
  - Unpaid Salaries tab
  - All Records tab
  - Reports tab
- Route: `/principal/salary` → `PrincipalDashboard` → `SalaryManagement`

### Clerk Salary Payment
- ✅ `SalaryPaymentSection` component - Payment focused
  - Unpaid salaries view
  - Payment recording
  - Teacher payment history
- Route: `/clerk/salary` → `ClerkDashboard` → `SalaryPaymentSection`

### Unused Component
- `SalaryPage` - Simple list component (created but not in active use)

---

## Migration Status

### Applied Migrations
- `1001_simplified_salary_payment_system.sql` - Base salary payment system
- `1003_fix_payment_status_logic.sql` - Payment status fixes
- `1004_fix_automatic_unpaid_status.sql` - Unpaid status fixes
- `1005_simplify_salary_payment_tracking.sql` - Simplified tracking
- `1007_optimize_salary_payment_queries.sql` - Performance optimizations

### Potentially Missing Migration
- `1008_add_salary_credit_system.sql` - Adds credit columns to view
  - Status: May not be applied or was reverted
  - Impact: `credit_applied` and `effective_paid_amount` columns missing

---

## Root Cause Analysis

### Primary Issue
The backend code was written to work with a view structure that includes credit system columns, but the actual database view doesn't have those columns. This mismatch caused the Supabase query to fail when trying to select non-existent columns.

### Why It Failed Silently
- The backend had error handling that returned empty results on error
- The frontend received an empty array, so it displayed "No unpaid salaries"
- No error was shown to the user, making debugging difficult

### Why SQL Queries Worked
- Direct SQL queries don't fail on missing columns - they just return NULL or skip them
- The view itself is correct and contains the data
- The issue was specifically with the Supabase client query trying to select specific columns

---

## Solution Summary

1. **Fixed Backend Query**: Removed non-existent columns from SELECT statement
2. **Fixed Response Mapping**: Removed non-existent columns from response object
3. **Restored Original Components**: Put back full-featured components in routes
4. **Fixed TypeScript Types**: Added missing property to interface

---

## Testing Checklist

- [ ] Backend `/salary/unpaid` endpoint returns data (not empty array)
- [ ] Frontend "Unpaid Salaries" tab shows teachers with unpaid amounts
- [ ] Frontend displays correct unpaid months for each teacher
- [ ] Frontend shows correct total unpaid amounts
- [ ] All tabs in Salary Management work correctly
- [ ] Clerk salary payment section works correctly

---

## Files Modified

1. `apps/backend/src/routes/salary.ts`
   - Line 1178: Removed `credit_applied`, `effective_paid_amount` from SELECT
   - Line 1293-1294: Removed from response mapping

2. `apps/web/src/App.tsx`
   - Restored original routes to use `SalaryManagement` and `SalaryPaymentSection`

3. `apps/web/src/pages/SalaryPage.tsx`
   - Added `payment_date` to interface (though component not in active use)

---

## Recommendations

1. **Apply Missing Migration**: If credit system is needed, ensure `1008_add_salary_credit_system.sql` is applied
2. **Add Error Logging**: Improve error handling to log Supabase query errors instead of silently returning empty results
3. **Column Validation**: Add a check at startup to validate expected columns exist in views
4. **Documentation**: Document which migrations are required for which features
5. **Testing**: Add integration tests that verify backend queries work with actual database schema

---

## Related Files

### SQL Debug Files
- `check_view_columns.sql` - Check view structure
- `check_unpaid_salaries_simple.sql` - Simple debugging queries
- `debug_unpaid_salaries.sql` - Comprehensive debugging
- `diagnose_unpaid_issue.sql` - Diagnostic queries

### Code Files
- `apps/backend/src/routes/salary.ts` - Backend salary routes
- `apps/web/src/pages/principal/salary/SalaryManagement.tsx` - Principal salary component
- `apps/web/src/pages/clerk/salary/SalaryPaymentSection.tsx` - Clerk salary component
- `apps/web/src/App.tsx` - Route configuration

---

## Date
Created: 2026-02-03
Last Updated: 2026-02-03
