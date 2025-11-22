# Fee Management System Design

## Overview
A scalable fee management system that supports:
- Per-class fee structures
- **Per-student fee cycles** (monthly, quarterly, yearly, one-time)
- Automatic bill generation based on student's cycle
- Payment tracking per period
- Pending/overdue calculations

## Database Schema

### Core Tables

#### 1. `student_fee_cycles` (NEW - Critical Addition)
Stores each student's fee cycle preferences. This is the key to supporting different cycles per student.

```sql
create table if not exists student_fee_cycles (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  
  -- Fee cycle configuration
  fee_cycle text check (fee_cycle in ('monthly', 'quarterly', 'yearly', 'one-time')) not null,
  
  -- Effective date range
  effective_from date not null, -- When this cycle starts
  effective_to date, -- NULL means currently active
  
  -- Optional: Override class fees for specific categories
  -- If NULL, uses class default; if set, uses this cycle for that category
  fee_category_id uuid references fee_categories(id) on delete set null,
  
  is_active boolean default true,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- One active cycle per student per category (or global if category is NULL)
  unique(student_id, fee_category_id) where is_active = true
);
```

#### 2. `fee_bill_periods` (NEW)
Tracks which periods have been billed for each student. This is critical for:
- Knowing which months/quarters/years are paid/unpaid
- Preventing duplicate bill generation
- Calculating pending periods

```sql
create table if not exists fee_bill_periods (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  bill_id uuid references fee_bills(id) on delete set null, -- NULL if not yet billed
  
  -- Period identification
  period_type text check (period_type in ('monthly', 'quarterly', 'yearly', 'one-time')) not null,
  period_year integer not null,
  period_month integer, -- 1-12 for monthly/quarterly, NULL for yearly/one-time
  period_quarter integer, -- 1-4 for quarterly, NULL for others
  
  -- Period dates
  period_start date not null,
  period_end date not null,
  
  -- Status
  status text check (status in ('pending', 'billed', 'partially-paid', 'paid', 'overdue', 'waived')) default 'pending',
  
  -- Amounts
  expected_amount numeric default 0,
  paid_amount numeric default 0,
  balance_amount numeric default 0,
  
  created_at timestamp default now(),
  updated_at timestamp default now(),
  
  -- One period per student per time period
  unique(student_id, period_type, period_year, period_month, period_quarter)
);

-- Index for fast lookups
create index idx_fee_bill_periods_student_status 
  on fee_bill_periods(student_id, status) 
  where status in ('pending', 'billed', 'partially-paid', 'overdue');
```

#### 3. Enhanced `fee_bills` table
Add reference to period:

```sql
alter table fee_bills 
  add column if not exists period_id uuid references fee_bill_periods(id) on delete set null;
```

## Billing Logic

### Step 1: Generate Fee Schedule for Student

```typescript
async function generateStudentFeeSchedule(
  studentId: string,
  schoolId: string,
  academicYear: number
) {
  // 1. Get student's fee cycles
  const cycles = await getStudentFeeCycles(studentId);
  
  // 2. Get student's class and admission date
  const student = await getStudent(studentId);
  const admissionDate = student.admission_date;
  const classId = student.class_group_id;
  
  // 3. Get class fee structure
  const classFees = await getClassFees(classId);
  
  // 4. Generate periods based on cycles
  const periods = [];
  
  for (const cycle of cycles) {
    if (cycle.fee_cycle === 'monthly') {
      // Generate monthly periods from admission date to end of academic year
      let currentDate = new Date(admissionDate);
      const yearEnd = new Date(academicYear, 11, 31); // Dec 31
      
      while (currentDate <= yearEnd) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        periods.push({
          student_id: studentId,
          school_id: schoolId,
          period_type: 'monthly',
          period_year: monthStart.getFullYear(),
          period_month: monthStart.getMonth() + 1,
          period_start: monthStart,
          period_end: monthEnd,
          status: 'pending'
        });
        
        currentDate = new Date(monthEnd);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    else if (cycle.fee_cycle === 'quarterly') {
      // Generate quarterly periods
      const quarters = [
        { start: [0, 1], end: [2, 31] },   // Q1: Jan-Mar
        { start: [3, 1], end: [5, 30] },   // Q2: Apr-Jun
        { start: [6, 1], end: [8, 30] },   // Q3: Jul-Sep
        { start: [9, 1], end: [11, 31] }   // Q4: Oct-Dec
      ];
      
      for (const quarter of quarters) {
        const quarterStart = new Date(academicYear, quarter.start[0], quarter.start[1]);
        const quarterEnd = new Date(academicYear, quarter.end[0], quarter.end[1]);
        
        if (quarterStart >= admissionDate) {
          periods.push({
            student_id: studentId,
            school_id: schoolId,
            period_type: 'quarterly',
            period_year: academicYear,
            period_quarter: Math.floor(quarter.start[0] / 3) + 1,
            period_start: quarterStart,
            period_end: quarterEnd,
            status: 'pending'
          });
        }
      }
    }
    else if (cycle.fee_cycle === 'yearly') {
      // One period for the entire year
      const yearStart = new Date(academicYear, 0, 1);
      const yearEnd = new Date(academicYear, 11, 31);
      
      if (yearStart >= admissionDate) {
        periods.push({
          student_id: studentId,
          school_id: schoolId,
          period_type: 'yearly',
          period_year: academicYear,
          period_start: yearStart,
          period_end: yearEnd,
          status: 'pending'
        });
      }
    }
    else if (cycle.fee_cycle === 'one-time') {
      // One-time fees are handled separately
      // They don't need period generation
    }
  }
  
  // 5. Insert periods into database
  await insertFeeBillPeriods(periods);
  
  return periods;
}
```

### Step 2: Generate Bills for Pending Periods

```typescript
async function generateBillsForPeriod(
  studentId: string,
  periodId: string,
  schoolId: string
) {
  // 1. Get period details
  const period = await getFeeBillPeriod(periodId);
  
  // 2. Get student details
  const student = await getStudent(studentId);
  const classId = student.class_group_id;
  
  // 3. Calculate fees for this period
  const billItems = [];
  let grossAmount = 0;
  
  // Class fees
  const classFees = await getClassFeesForPeriod(classId, period);
  for (const classFee of classFees) {
    const amount = calculateFeeAmount(classFee, period);
    billItems.push({
      item_type: 'class-fee',
      item_name: classFee.category_name,
      amount: amount,
      total_amount: amount,
      fee_category_id: classFee.fee_category_id,
      class_fee_id: classFee.id
    });
    grossAmount += amount;
  }
  
  // Transport fees
  const transport = await getStudentTransport(studentId);
  if (transport) {
    const transportFee = await getTransportFee(transport.route_id, period);
    if (transportFee) {
      const amount = calculateTransportFee(transportFee, period);
      billItems.push({
        item_type: 'transport-fee',
        item_name: `Transport - ${transport.route_name}`,
        amount: amount,
        total_amount: amount,
        transport_fee_id: transportFee.id
      });
      grossAmount += amount;
    }
  }
  
  // Optional fees
  const optionalFees = await getOptionalFeesForPeriod(schoolId, period);
  for (const optFee of optionalFees) {
    const amount = optFee.default_amount;
    billItems.push({
      item_type: 'optional-fee',
      item_name: optFee.name,
      amount: amount,
      total_amount: amount,
      optional_fee_id: optFee.id
    });
    grossAmount += amount;
  }
  
  // Custom fees (discounts, scholarships, fines)
  const customFees = await getStudentCustomFeesForPeriod(studentId, period);
  for (const customFee of customFees) {
    billItems.push({
      item_type: 'custom-fee',
      item_name: customFee.description,
      amount: customFee.amount, // Can be negative
      total_amount: customFee.amount,
      custom_fee_id: customFee.id
    });
    grossAmount += customFee.amount; // Add (subtract if negative)
  }
  
  // Calculate discounts and scholarships
  const discountAmount = billItems
    .filter(item => item.item_type === 'custom-fee' && item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  
  const scholarshipAmount = billItems
    .filter(item => item.item_type === 'custom-fee' && 
                    item.custom_fee_id && 
                    await isScholarship(item.custom_fee_id))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  
  const netAmount = Math.max(0, grossAmount - discountAmount - scholarshipAmount);
  
  // 4. Calculate due date
  const dueDate = calculateDueDate(period, classFees);
  
  // 5. Create bill
  const bill = await createBill({
    student_id: studentId,
    school_id: schoolId,
    period_id: periodId,
    bill_period_start: period.period_start,
    bill_period_end: period.period_end,
    due_date: dueDate,
    gross_amount: grossAmount,
    discount_amount: discountAmount,
    scholarship_amount: scholarshipAmount,
    net_amount: netAmount,
    status: 'pending'
  });
  
  // 6. Create bill items
  await createBillItems(bill.id, billItems);
  
  // 7. Update period status
  await updateFeeBillPeriod(periodId, {
    bill_id: bill.id,
    status: 'billed',
    expected_amount: netAmount
  });
  
  return bill;
}
```

### Step 3: Payment Tracking

```typescript
async function recordPayment(
  billId: string,
  amount: number,
  paymentMode: string,
  transactionId?: string
) {
  // 1. Create payment record
  const payment = await createPayment({
    bill_id: billId,
    amount_paid: amount,
    payment_mode: paymentMode,
    transaction_id: transactionId
  });
  
  // 2. Update bill status
  const bill = await getBill(billId);
  const totalPaid = await getTotalPaidForBill(billId);
  
  let newStatus = 'pending';
  if (totalPaid >= bill.net_amount) {
    newStatus = 'paid';
  } else if (totalPaid > 0) {
    newStatus = 'partially-paid';
  }
  
  await updateBill(billId, { status: newStatus });
  
  // 3. Update period status
  if (bill.period_id) {
    await updateFeeBillPeriod(bill.period_id, {
      paid_amount: totalPaid,
      balance_amount: bill.net_amount - totalPaid,
      status: newStatus
    });
  }
  
  return payment;
}
```

## Calculation Functions

### Calculate Pending Periods

```typescript
async function getPendingPeriods(studentId: string) {
  return await db.query(`
    SELECT 
      p.*,
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, p.period_end)) as months_overdue
    FROM fee_bill_periods p
    WHERE p.student_id = $1
      AND p.status IN ('pending', 'billed', 'partially-paid', 'overdue')
    ORDER BY p.period_start ASC
  `, [studentId]);
}
```

### Calculate Overdue Periods

```typescript
async function getOverduePeriods(studentId: string) {
  return await db.query(`
    SELECT 
      p.*,
      b.due_date,
      b.net_amount,
      b.balance,
      EXTRACT(DAY FROM AGE(CURRENT_DATE, b.due_date)) as days_overdue
    FROM fee_bill_periods p
    LEFT JOIN fee_bills b ON b.period_id = p.id
    WHERE p.student_id = $1
      AND p.status IN ('billed', 'partially-paid')
      AND b.due_date < CURRENT_DATE
      AND b.balance > 0
    ORDER BY b.due_date ASC
  `, [studentId]);
}
```

### Calculate Total Dues for Student

```typescript
async function getStudentTotalDues(studentId: string) {
  const result = await db.query(`
    SELECT 
      COUNT(*) as total_periods,
      COUNT(*) FILTER (WHERE status = 'paid') as paid_periods,
      COUNT(*) FILTER (WHERE status IN ('pending', 'billed', 'partially-paid', 'overdue')) as pending_periods,
      SUM(expected_amount) as total_expected,
      SUM(paid_amount) as total_paid,
      SUM(balance_amount) as total_balance,
      SUM(balance_amount) FILTER (WHERE status = 'overdue') as overdue_amount
    FROM fee_bill_periods
    WHERE student_id = $1
  `, [studentId]);
  
  return result.rows[0];
}
```

## Key Design Decisions

1. **Per-Student Fee Cycles**: The `student_fee_cycles` table allows each student to have different cycles, even within the same class.

2. **Period-Based Tracking**: `fee_bill_periods` tracks each billing period separately, making it easy to:
   - Know which months/quarters are paid
   - Generate bills only for pending periods
   - Calculate overdue periods

3. **Separation of Concerns**:
   - Periods define WHEN to bill
   - Bills define WHAT to bill
   - Payments track HOW MUCH was paid

4. **Performance Optimizations**:
   - Indexes on `(student_id, status)` for fast pending/overdue queries
   - Unique constraints prevent duplicate periods
   - Partial indexes for active records only

5. **Flexibility**:
   - Supports monthly, quarterly, yearly, one-time cycles
   - Can override cycles per fee category
   - Handles admission date (pro-rata calculations)
   - Supports custom fees, discounts, scholarships

## Migration Strategy

1. Add new tables (`student_fee_cycles`, `fee_bill_periods`)
2. Migrate existing bills to periods (one-time migration)
3. Update billing logic to use periods
4. Add period tracking to payment flow

