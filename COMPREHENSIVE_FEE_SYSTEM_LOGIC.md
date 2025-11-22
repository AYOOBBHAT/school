# Comprehensive Fee Management System - Logic Documentation

## Fee Calculation Formula

### Base Calculation
```
For each fee category:
  Base Amount = Class Default Amount OR Student Override Amount
  Discount = Apply Scholarships (percentage/fixed/full waiver)
  Final Amount = Base Amount - Discount

Total Amount = Sum of all Base Amounts
Total Discount = Sum of all Discounts
Final Payable = Total Amount - Total Discount + Fines
```

### Detailed Breakdown

1. **Class Default Fees**
   - Pull all active fee defaults for student's class
   - Filter by fee cycle matching billing period
   - Use as base amounts

2. **Student Overrides**
   - Check if student has override for any fee category
   - If exists, replace class default with override amount

3. **Transport Fee**
   - If transport_enabled = false → Transport Fee = 0
   - If transport_fee_override exists → Use override amount
   - Else → Get transport fee from transport_fee_defaults (by route if specified)

4. **Optional Fees**
   - Only include if student has opted in (student_optional_fees)
   - Filter by fee cycle matching billing period

5. **Custom Fees**
   - Include all active custom fees for student
   - Filter by fee cycle matching billing period

6. **Scholarships/Discounts**
   - Apply in order of priority:
     - Full waiver → 100% discount
     - Percentage discount → Apply percentage
     - Fixed discount → Subtract fixed amount
   - Can apply to: all fees, tuition only, transport only, or specific category

## Bill Generation Logic

### Step 1: Determine Billing Period
- Based on student's fee cycle preference or class default
- Calculate period_start and period_end dates
- Generate period_label (e.g., "January 2024", "Q1 2024")

### Step 2: Calculate Fees
- Call `calculateStudentFees()` function
- Returns: billItems, totalAmount, totalDiscount, finalAmount

### Step 3: Calculate Due Date
- Default: 15 days from bill date
- Can be customized per school/class

### Step 4: Create Bill
- Insert into `fee_bills` table
- Generate unique bill_number
- Set status = 'generated'

### Step 5: Create Bill Items
- Insert each fee item into `fee_bill_items`
- Include base_amount, discount_amount, final_amount

## Payment Processing Logic

### Step 1: Record Payment
- Insert into `fee_payments` table
- Trigger automatically updates bill status

### Step 2: Update Bill Status
- Calculate total paid amount
- Update bill.paid_amount
- Update bill.pending_amount = total_amount - discount_amount - paid_amount
- Update status:
  - If paid_amount >= (total_amount - discount_amount) → 'paid'
  - Else if paid_amount > 0 → 'partially_paid'
  - Else → Keep current status

### Step 3: Handle Partial Payments
- Multiple payments can be recorded for same bill
- Each payment updates bill status automatically
- Track payment history per bill

## Unpaid Months Calculation

### Logic
```sql
SELECT DISTINCT
  period_start,
  period_end,
  period_label,
  status,
  pending_amount
FROM fee_bills
WHERE student_id = ?
  AND school_id = ?
  AND status IN ('generated', 'partially_paid', 'overdue')
  AND pending_amount > 0
ORDER BY period_start ASC
```

### Overdue Detection
- Compare due_date with current date
- If due_date < today AND status != 'paid' → Mark as overdue
- Calculate fine if overdue

## Fine Calculation Logic

### Step 1: Check if Overdue
- Get bill due_date
- Calculate days overdue = today - due_date

### Step 2: Get Fine Rule
- Find active fine rule where days_after_due <= days overdue
- Use most restrictive rule (highest days_after_due)

### Step 3: Calculate Fine
- Fixed: Use fine_amount
- Percentage: (pending_amount * fine_percentage) / 100
- Per Day: fine_amount * days_overdue

### Step 4: Apply Cap
- If max_fine_amount exists, cap fine at that amount

### Step 5: Update Bill
- Add fine_amount to bill
- Update total_amount (if fine is separate line item)
- Mark as overdue

## Student Fee Profile Logic

### When Student Joins Class
1. Create default fee profile from class defaults
2. Set transport_enabled = true (default)
3. Inherit fee cycles from class

### When Principal Updates Student Fees
1. Create new fee profile entry with effective_from = today
2. Set previous profile effective_to = today - 1 day
3. Set previous profile is_active = false
4. New profile becomes active

### Fee Override Logic
- If student has override for a category → Use override amount
- Else → Use class default amount
- Overrides are time-bound (effective_from/effective_to)

## Scholarship Application Logic

### Priority Order
1. Full waiver (100% discount) - highest priority
2. Percentage discount
3. Fixed discount

### Application Scope
- **all**: Applies to all fees
- **tuition_only**: Only tuition fees
- **transport_only**: Only transport fees
- **specific_category**: Only specified fee category

### Calculation
- Scholarships are applied per fee item
- Multiple scholarships can stack (unless full waiver)
- Discount is capped at base amount (can't be negative)

## Transport Fee Logic

### Default Behavior
- If transport_enabled = true → Include transport fee
- If transport_enabled = false → Transport fee = 0

### Override Behavior
- If transport_fee_override exists → Use override amount
- Else → Look up transport_fee_defaults by:
  - class_group_id
  - route_name (if specified in student profile)
  - effective date range

### Route-Specific Pricing
- If student has transport_route → Use route-specific price
- Else → Use class-wide transport fee

## Custom Fees Logic

### Adding Custom Fees
- Principal/clerk can add custom fees per student
- Must specify: fee_category_id, amount, fee_cycle
- Can add description/notes

### Billing
- Custom fees included in bill if:
  - is_active = true
  - effective_from <= billing period
  - effective_to is null OR effective_to >= billing period
  - fee_cycle matches billing period

## Optional Fees Logic

### Opt-In Process
- Student/parent can opt in to optional fees
- Recorded in student_optional_fees table
- Can opt out by setting opted_in = false

### Billing
- Only include optional fees where opted_in = true
- Filter by fee cycle matching billing period

## Unpaid Months Calculation

### Query Logic
```typescript
async function getUnpaidMonths(
  studentId: string,
  schoolId: string,
  adminSupabase: any
): Promise<Array<{
  period_start: string;
  period_end: string;
  period_label: string;
  status: string;
  pending_amount: number;
  due_date: string;
  days_overdue: number;
}>> {
  const { data: unpaidBills, error } = await adminSupabase
    .from('fee_bills')
    .select('*')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .in('status', ['generated', 'partially_paid', 'overdue'])
    .gt('pending_amount', 0)
    .order('period_start', { ascending: true });

  if (error) throw new Error(error.message);

  const today = new Date();
  return (unpaidBills || []).map((bill: any) => {
    const dueDate = new Date(bill.due_date);
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      period_start: bill.period_start,
      period_end: bill.period_end,
      period_label: bill.period_label,
      status: daysOverdue > 0 ? 'overdue' : bill.status,
      pending_amount: parseFloat(bill.pending_amount) || 0,
      due_date: bill.due_date,
      days_overdue: daysOverdue
    };
  });
}
```

## Partial Payment Handling

### Recording Partial Payment
1. Insert payment record with payment_amount < pending_amount
2. Trigger automatically updates bill:
   - paid_amount += payment_amount
   - pending_amount -= payment_amount
   - status = 'partially_paid'

### Multiple Partial Payments
- Each payment is recorded separately
- Bill status updates automatically
- When paid_amount >= (total_amount - discount_amount):
  - status = 'paid'
  - pending_amount = 0

## RLS Rules Summary

### Principals/Clerks
- Full access to all fee management
- Can create/edit fee structures
- Can generate bills
- Can record payments
- Can approve scholarships

### Teachers
- Read-only access to student fee information
- Can view bills and payment history

### Students/Parents
- Can view own bills
- Can view own payment history
- Can view fee profile
- Cannot modify anything

## API Flow

### Generate Bill Flow
1. POST /fees/bills/generate
   - Body: { student_id, period_type, period_start, period_end }
2. System calculates fees
3. Creates bill and bill items
4. Returns bill_id

### Record Payment Flow
1. POST /fees/payments
   - Body: { bill_id, payment_amount, payment_mode, transaction_id }
2. System records payment
3. Trigger updates bill status
4. Returns payment record

### View Bills Flow
1. GET /fees/bills/student/:studentId
   - Returns all bills for student
2. GET /fees/bills/:billId
   - Returns bill details with items

### View Unpaid Flow
1. GET /fees/unpaid/:studentId
   - Returns unpaid bills with overdue status

