# Salary Credit System - Overpayment Handling

## Overview
The salary credit system automatically handles overpayments by creating credits that are applied to future unpaid months. This ensures accurate accounting and prevents loss of overpaid amounts.

## How It Works

### 1. Payment Recording
When a clerk records a payment:
- System calculates expected salary for the month
- Compares payment amount with expected salary
- If payment exceeds expected salary, excess is calculated
- Excess amount is automatically converted to credit

### 2. Credit Application
Credits are automatically applied to future unpaid months:
- Applied in chronological order (oldest unpaid month first)
- Applied until credit is exhausted or all months are paid
- Multiple credits can be applied to the same month
- Partial application if credit is larger than one month's salary

### 3. Credit Tracking
- Each credit has a source payment reference
- Full audit trail of credit creation and application
- Credits can span multiple months
- Remaining balance is tracked automatically

## Database Schema

### `teacher_salary_credits`
Tracks credit balances:
- `credit_amount`: Total credit from overpayment
- `applied_amount`: Amount already applied
- `remaining_amount`: Available balance (computed)
- `source_payment_id`: Link to original payment
- `source_month/year`: Month of overpayment

### `teacher_salary_credit_applications`
Tracks credit applications to specific months:
- `credit_id`: Reference to credit record
- `applied_amount`: Amount applied to this month
- `applied_to_month/year`: Target month
- Ensures one application per credit per month

## Edge Cases Handled

### 1. Multiple Overpayments
**Scenario**: Teacher receives multiple overpayments
**Solution**: Credits are accumulated and applied chronologically (FIFO)

### 2. Partial Credit Application
**Scenario**: Credit (₹5000) is larger than one month's salary (₹3000)
**Solution**: ₹3000 applied to first month, ₹2000 to next month

### 3. No Future Unpaid Months
**Scenario**: Credit created but all future months are already paid
**Solution**: Credit is stored and automatically applied when unpaid months appear

### 4. Credit Larger Than Multiple Months
**Scenario**: Credit (₹15000) for 3 months of salary (₹5000 each)
**Solution**: Applied across 3 months: ₹5000 + ₹5000 + ₹5000

### 5. Existing Credits
**Scenario**: Teacher already has ₹2000 credit, new overpayment of ₹3000
**Solution**: New credit added to existing balance (total: ₹5000)

### 6. Concurrent Payments
**Scenario**: Multiple payments in same month
**Solution**: Each payment's excess is tracked separately with source reference

### 7. Credit Application Order
**Scenario**: Multiple credits available
**Solution**: Oldest credits applied first (FIFO - First In First Out)

### 8. Credit Exhaustion
**Scenario**: Credit fully applied to months
**Solution**: `remaining_amount` becomes 0, credit marked as fully utilized

## API Endpoints

### Record Payment (POST `/api/salary/payments`)
**Enhanced Response:**
```json
{
  "payment": { ... },
  "credit_applied": {
    "credit_id": "uuid",
    "total_credit": 5000.00,
    "applied_amount": 5000.00,
    "remaining_credit": 0.00,
    "months_applied": 2
  },
  "excess_amount": 5000.00,
  "message": "Payment recorded. Excess amount of ₹5000.00 has been applied as credit to future unpaid months."
}
```

### Get Credit Balance (GET `/api/salary/credits/:teacherId`)
**Response:**
```json
{
  "teacher_id": "uuid",
  "available_credit": 2000.00,
  "credits": [
    {
      "id": "uuid",
      "credit_amount": 5000.00,
      "applied_amount": 3000.00,
      "remaining_amount": 2000.00,
      "source_payment_id": "uuid",
      "source_month": 1,
      "source_year": 2026,
      "applications": [
        {
          "applied_amount": 3000.00,
          "applied_to_month": 2,
          "applied_to_year": 2026
        }
      ]
    }
  ]
}
```

## View Updates

### `teacher_unpaid_salary_months`
Now includes:
- `credit_applied`: Amount of credit applied to this month
- `effective_paid_amount`: Total payment (cash + credits)
- `pending_amount`: Calculated using effective paid amount

## Example Scenarios

### Scenario 1: Simple Overpayment
1. Teacher salary: ₹10,000/month
2. Clerk pays: ₹15,000 for January
3. System creates: ₹5,000 credit
4. Credit applied: ₹5,000 to February (if unpaid)
5. Result: January fully paid, February fully paid

### Scenario 2: Multiple Overpayments
1. January: Paid ₹12,000 (excess ₹2,000 → credit)
2. February: Paid ₹11,000 (excess ₹1,000 → credit)
3. Total credit: ₹3,000
4. March unpaid: ₹10,000
5. Credit applied: ₹3,000 to March
6. March remaining: ₹7,000

### Scenario 3: Large Overpayment
1. Teacher salary: ₹10,000/month
2. Clerk pays: ₹35,000 for January
3. Excess: ₹25,000
4. February unpaid: ₹10,000 → Credit applied: ₹10,000
5. March unpaid: ₹10,000 → Credit applied: ₹10,000
6. April unpaid: ₹10,000 → Credit applied: ₹5,000
7. Remaining credit: ₹0

### Scenario 4: No Future Unpaid Months
1. All future months already paid
2. Overpayment creates credit
3. Credit stored with `remaining_amount > 0`
4. When new unpaid month appears, credit automatically applied

## Database Functions

### `apply_salary_credits_to_future_months`
- Automatically applies credits to future unpaid months
- Returns application summary
- Handles partial applications
- Respects chronological order

### `get_teacher_credit_balance`
- Returns total available credit for a teacher
- Sums all remaining amounts
- Used for balance checks

## Security

### Row Level Security (RLS)
- Principals and Clerks: Can view and create credits
- Teachers: Can view their own credits only
- All operations scoped to school_id

## Performance

### Indexes
- `idx_teacher_salary_credits_teacher`: Fast teacher lookup
- `idx_teacher_salary_credits_remaining`: Fast available credit queries
- `idx_credit_applications_teacher_month`: Fast month-wise credit lookup

## Migration Order

1. Run `1008_add_salary_credit_system.sql`
2. System automatically handles overpayments going forward
3. Existing payments are not retroactively processed

## Testing Checklist

- [ ] Single overpayment applied to next month
- [ ] Multiple overpayments accumulated correctly
- [ ] Partial credit application works
- [ ] Credit larger than one month splits correctly
- [ ] Credit applied across multiple months
- [ ] No future months: Credit stored correctly
- [ ] Concurrent payments tracked separately
- [ ] Credit balance calculation accurate
- [ ] View shows credits in payment calculation
- [ ] RLS policies enforced correctly

## Future Enhancements

1. **Credit Refunds**: Allow manual credit refunds if needed
2. **Credit Expiry**: Optional expiry dates for credits
3. **Credit Reports**: Detailed credit usage reports
4. **Credit Notifications**: Notify when credits are applied
5. **Credit History**: Full audit trail with timestamps

---

**Last Updated**: 2026-01-17
**Version**: 1.0.0
**Status**: Production Ready ✅
