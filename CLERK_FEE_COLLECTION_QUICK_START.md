# 🚀 Quick Start Guide - Clerk Fee Collection

## For Developers

### 1. Database Setup

Run migrations in order:
```bash
# Migration 031 already exists - creates tables
psql $DATABASE_URL -f supabase/migrations/031_add_monthly_fee_component_tracking.sql

# Migration 032 - ensures helper function exists
psql $DATABASE_URL -f supabase/migrations/032_ensure_update_timestamp_function.sql
```

### 2. Backend Setup

```bash
cd apps/backend
pnpm install
pnpm run build
pnpm run dev
```

Backend will be available at `http://localhost:4000`

### 3. Frontend Setup

```bash
cd apps/web
pnpm install
pnpm run dev
```

Frontend will be available at `http://localhost:5173`

### 4. Environment Variables

Ensure these are set in `apps/backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
PORT=4000
```

And in `apps/web/.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:4000
```

## For School Administrators

### Principal Setup (One-time)

1. **Configure Fee Structure**
   - Go to Principal Dashboard → Fees
   - Set up class fee defaults
   - Configure transport routes and fees
   - Add custom fees (if any)

2. **Generate Monthly Components**
   - Select a student
   - Click "Generate Fee Schedule"
   - Choose date range (e.g., Jan 2025 - Dec 2025)
   - System creates monthly components for all applicable fees

### Clerk Daily Usage

1. **Login as Clerk**
   ```
   Navigate to: /clerk/dashboard
   ```

2. **Collect Fees**
   - Click "Collect Fees" button
   - Search for student by name or roll number
   - Click on student to view their fee ledger
   - Click "Collect" on any pending fee
   - Enter payment details:
     - Confirm amount
     - Select payment mode
     - Enter transaction ID (if online/UPI)
     - Add notes (optional)
   - Click "Record Payment"
   - Receipt number generated automatically

3. **View Dashboard Stats**
   - Today's collection
   - This month's collection
   - Total pending
   - Overdue count

## API Endpoints Reference

### Get Student Fee Structure
```http
GET /clerk-fees/students/:studentId/fee-structure
Authorization: Bearer {token}
```

### Record Payment
```http
POST /clerk-fees/record-payment
Authorization: Bearer {token}
Content-Type: application/json

{
  "monthly_fee_component_id": "uuid",
  "payment_amount": 2000,
  "payment_date": "2025-01-15",
  "payment_mode": "upi",
  "transaction_id": "TXN123456789",
  "notes": "Payment received"
}
```

### Get Payment History
```http
GET /clerk-fees/students/:studentId/payment-history
Authorization: Bearer {token}
```

### Get Dashboard Stats
```http
GET /clerk-fees/stats
Authorization: Bearer {token}
```

## Common Tasks

### Task 1: Add a New Student's Fee Structure

**Principal does this:**
1. Add student to system
2. Assign to class (inherits class fees)
3. Assign transport route (if applicable)
4. Add custom fees (if applicable)
5. Generate monthly components:
   ```http
   POST /clerk-fees/generate-monthly-components
   {
     "student_id": "uuid",
     "start_date": "2025-01-01",
     "end_date": "2025-12-31"
   }
   ```

### Task 2: Record a Payment

**Clerk does this:**
1. Go to Fee Collection page
2. Search and select student
3. Click "Collect" on pending fee
4. Fill payment form
5. Submit
6. System automatically:
   - Creates payment record
   - Updates component status
   - Generates receipt number
   - Refreshes UI

### Task 3: View Payment History

**Clerk/Principal does this:**
1. Go to Payment History page
2. Search by student
3. Filter by year/month (optional)
4. View all transactions with receipts

### Task 4: Generate Receipt

**Automatic:**
- Receipt number generated on payment recording
- Format: `RCP-YYYY-XXXXXX`
- Stored in `monthly_fee_payments.receipt_number`

**Manual retrieval:**
```http
GET /clerk-fees/receipts/:receiptNumber
```

## Troubleshooting

### Issue: Student has no fee components
**Solution:**
1. Check if student is assigned to a class
2. Check if class has fee defaults configured
3. Run "Generate Monthly Components" for the student
4. Verify date range covers current period

### Issue: Payment not recording
**Solution:**
1. Check clerk has proper role permissions
2. Verify student belongs to clerk's school
3. Check monthly component exists
4. Review browser console for errors

### Issue: Status not updating
**Solution:**
1. Verify database trigger exists: `update_monthly_fee_component_status()`
2. Check trigger is enabled
3. Refresh the page
4. Check database logs

### Issue: Receipt number not generating
**Solution:**
1. Verify function exists: `generate_receipt_number(school_uuid)`
2. Check function has proper permissions
3. Review database logs
4. Fallback to timestamp-based number

## Testing

### Test Scenario 1: Full Payment
1. Select student with pending fee
2. Record payment for full amount
3. Verify status changes to "Paid" (Green)
4. Check paid_amount = fee_amount
5. Check pending_amount = 0

### Test Scenario 2: Partial Payment
1. Select student with pending fee
2. Record payment for half amount
3. Verify status changes to "Partially Paid" (Yellow)
4. Check paid_amount = payment amount
5. Check pending_amount = fee_amount - paid_amount

### Test Scenario 3: Multiple Payments
1. Select student with pending fee
2. Record first partial payment
3. Record second partial payment
4. Verify status changes to "Paid" when fully paid
5. Check total paid_amount = sum of all payments

### Test Scenario 4: Overdue Fee
1. Create component with due_date in past
2. Leave unpaid
3. Verify status automatically becomes "Overdue" (Red)
4. Record payment
5. Verify status changes to "Paid"

## Security Testing

### Test Multi-Tenant Isolation
1. Login as Clerk from School A
2. Try to access student from School B (should fail)
3. Try to record payment for School B student (should fail)
4. Verify RLS policies prevent cross-school access

### Test Role Permissions
1. Login as Student
2. Try to access /clerk/fee-collection (should redirect)
3. Try to call POST /record-payment (should fail)
4. Verify only view permissions work

## Performance Monitoring

### Database Queries
- Use `EXPLAIN ANALYZE` on queries
- Check indexes are being used
- Monitor query execution time
- Optimize N+1 queries

### API Response Times
- Target: < 500ms for most endpoints
- Use logging to track slow queries
- Monitor database connection pool
- Add caching where appropriate

## Maintenance

### Regular Tasks
1. Monitor database size (monthly_fee_components grows over time)
2. Archive old payment records (yearly)
3. Backup receipt numbers
4. Review and optimize indexes
5. Update documentation as features evolve

## Documentation References

- **Complete Guide**: `CLERK_FEE_COLLECTION_GUIDE.md`
- **Visual Guide**: `CLERK_FEE_COLLECTION_VISUAL_GUIDE.md`
- **Summary**: `CLERK_FEE_COLLECTION_SUMMARY.md`
- **This File**: `CLERK_FEE_COLLECTION_COMPLETE.md`

## Support

For issues or questions:
1. Review documentation files
2. Check API responses
3. Verify database state
4. Test with different roles
5. Review RLS policies

---

**Status:** Production Ready ✅
**Version:** 1.0.0
**Last Updated:** December 7, 2025
