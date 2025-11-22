# Fee Management System - Usage Guide

## Overview
This system allows different students in the same class to have different fee cycles (monthly, quarterly, yearly, one-time) and automatically tracks which periods are paid, pending, or overdue.

## Key Features

1. **Per-Student Fee Cycles**: Each student can have their own fee cycle, independent of their class
2. **Period-Based Tracking**: Each billing period (month/quarter/year) is tracked separately
3. **Automatic Bill Generation**: Bills are generated based on student's cycle and admission date
4. **Payment Tracking**: Tracks which periods are paid, partially paid, or overdue
5. **Pending/Overdue Calculations**: Easy queries to find pending and overdue periods

## Database Schema

### New Tables

1. **`student_fee_cycles`**: Stores each student's fee cycle preference
2. **`fee_bill_periods`**: Tracks each billing period per student
3. **Enhanced `fee_bills`**: Now includes `period_id` to link bills to periods

## API Endpoints

### 1. Set Student Fee Cycle
```
POST /fees/student-cycles
Body: {
  student_id: "uuid",
  fee_cycle: "monthly" | "quarterly" | "yearly" | "one-time",
  effective_from: "2024-01-01",
  effective_to: "2024-12-31" (optional),
  fee_category_id: "uuid" (optional - for category-specific cycles)
}
```

### 2. Generate Fee Schedule
```
POST /fees/generate-schedule
Body: {
  student_id: "uuid",
  academic_year: 2024
}
```
This generates all billing periods for the student based on their fee cycles and admission date.

### 3. Get Pending Periods
```
GET /fees/periods/pending/:studentId
```
Returns all periods that are pending, billed, partially-paid, or overdue.

### 4. Get Overdue Periods
```
GET /fees/periods/overdue/:studentId
```
Returns all periods that are overdue (due date passed, balance > 0).

### 5. Get Student Total Dues
```
GET /fees/dues/:studentId
```
Returns summary:
```json
{
  "dues": {
    "total_periods": 12,
    "paid_periods": 5,
    "pending_periods": 7,
    "total_expected": 50000,
    "total_paid": 25000,
    "total_balance": 25000,
    "overdue_amount": 10000
  }
}
```

## Workflow

### Step 1: Set Student Fee Cycle
When a student is admitted or changes their payment plan:

```typescript
// Example: Set monthly cycle for a student
await fetch('/fees/student-cycles', {
  method: 'POST',
  body: JSON.stringify({
    student_id: 'student-uuid',
    fee_cycle: 'monthly',
    effective_from: '2024-01-01'
  })
});
```

### Step 2: Generate Fee Schedule
Generate all billing periods for the academic year:

```typescript
await fetch('/fees/generate-schedule', {
  method: 'POST',
  body: JSON.stringify({
    student_id: 'student-uuid',
    academic_year: 2024
  })
});
```

This creates period records for:
- Monthly: 12 periods (Jan-Dec)
- Quarterly: 4 periods (Q1-Q4)
- Yearly: 1 period (entire year)

### Step 3: Generate Bills for Pending Periods
For each pending period, generate a bill:

```typescript
// Get pending periods
const { periods } = await fetch('/fees/periods/pending/:studentId').then(r => r.json());

// For each pending period, generate bill
for (const period of periods) {
  if (period.status === 'pending') {
    // Generate bill using existing bill generation logic
    // Link bill to period via period_id
  }
}
```

### Step 4: Track Payments
When a payment is received:

```typescript
// Record payment (existing endpoint)
await fetch('/fees/payments', {
  method: 'POST',
  body: JSON.stringify({
    bill_id: 'bill-uuid',
    amount_paid: 5000,
    payment_mode: 'cash'
  })
});

// Period status is automatically updated via database triggers
```

## Calculating Pending Months

```sql
-- Get all pending periods for a student
SELECT 
  period_type,
  period_year,
  period_month,
  period_quarter,
  period_start,
  period_end,
  status,
  expected_amount,
  paid_amount,
  balance_amount
FROM fee_bill_periods
WHERE student_id = 'student-uuid'
  AND status IN ('pending', 'billed', 'partially-paid', 'overdue')
ORDER BY period_start;
```

## Calculating Overdue Periods

```sql
-- Get overdue periods
SELECT 
  p.*,
  b.due_date,
  EXTRACT(DAY FROM AGE(CURRENT_DATE, b.due_date)) as days_overdue
FROM fee_bill_periods p
JOIN fee_bills b ON b.period_id = p.id
WHERE p.student_id = 'student-uuid'
  AND p.status IN ('billed', 'partially-paid')
  AND b.due_date < CURRENT_DATE
  AND b.balance > 0
ORDER BY b.due_date;
```

## Calculating Dues for a Specific Student

```typescript
// Use the API endpoint
const { dues } = await fetch('/fees/dues/:studentId').then(r => r.json());

// Or use SQL directly
SELECT 
  COUNT(*) as total_periods,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_periods,
  COUNT(*) FILTER (WHERE status IN ('pending', 'billed', 'partially-paid', 'overdue')) as pending_periods,
  SUM(expected_amount) as total_expected,
  SUM(paid_amount) as total_paid,
  SUM(balance_amount) as total_balance,
  SUM(balance_amount) FILTER (WHERE status = 'overdue') as overdue_amount
FROM fee_bill_periods
WHERE student_id = 'student-uuid';
```

## Example Scenarios

### Scenario 1: Student with Monthly Cycle
1. Set cycle: `fee_cycle: 'monthly'`
2. Generate schedule: Creates 12 monthly periods
3. Generate bills: One bill per month
4. Track payments: Each payment updates the corresponding period

### Scenario 2: Student with Quarterly Cycle
1. Set cycle: `fee_cycle: 'quarterly'`
2. Generate schedule: Creates 4 quarterly periods
3. Generate bills: One bill per quarter
4. Track payments: Each payment updates the corresponding quarter

### Scenario 3: Mixed Cycles (Different Categories)
1. Set global cycle: `fee_cycle: 'monthly'` (no category)
2. Set category-specific: `fee_cycle: 'yearly', fee_category_id: 'admission-fee-id'`
3. Generate schedule: Monthly periods for most fees, yearly for admission
4. Generate bills: Monthly bills with yearly admission fee included once

## Best Practices

1. **Generate schedules at start of academic year**: Run for all students
2. **Generate bills monthly**: Process pending periods and create bills
3. **Mark overdue daily**: Run `mark_overdue_periods()` function daily
4. **Track payments immediately**: Update period status in real-time
5. **Handle admission mid-year**: Periods start from admission date, not academic year start

## Migration from Existing System

1. Run migration: `018_add_student_fee_cycles.sql`
2. Set default cycles: Create monthly cycles for all existing students
3. Generate periods: Run schedule generation for current academic year
4. Link existing bills: Update `fee_bills.period_id` for existing bills
5. Update billing logic: Use period-based bill generation

## Performance Considerations

- **Indexes**: Already created for fast lookups
- **Batch operations**: Generate schedules in batches
- **Caching**: Cache student cycles and periods
- **Scheduled jobs**: Run overdue marking as background job

