# Fee Hike & Historical Protection - Logic Documentation

## Core Principle
**Fee hikes only affect future bills. Old bills remain unchanged forever.**

## Fee Versioning System

### 1. Version Structure
Each fee has multiple versions with:
- `version_number`: Sequential (1, 2, 3, ...)
- `effective_from_date`: When this version becomes active
- `effective_to_date`: When this version expires (NULL = currently active)
- `amount`: Fee amount for this version
- `is_active`: Whether this version is currently active

### 2. Creating a Fee Hike

**Step 1: Close Previous Version**
```sql
UPDATE class_fee_versions
SET 
  effective_to_date = (hike_date - 1 day),
  is_active = false
WHERE 
  class_group_id = X
  AND fee_category_id = Y
  AND fee_cycle = 'monthly'
  AND is_active = true
  AND (effective_to_date IS NULL OR effective_to_date >= hike_date);
```

**Step 2: Create New Version**
```sql
INSERT INTO class_fee_versions (
  version_number, -- Previous max + 1
  amount, -- New amount
  effective_from_date, -- Hike date
  effective_to_date, -- NULL (active)
  is_active -- true
);
```

**Result**: 
- Old bills (before hike_date) → Use old version
- New bills (from hike_date) → Use new version

## Bill Generation Logic

### When Generating Bill for Month X

```typescript
// Get fee version active for first day of month X
const billingDate = new Date(2024, 3, 1); // April 1, 2024

const feeVersion = await getClassFeeVersion(
  classGroupId,
  feeCategoryId,
  'monthly',
  billingDate, // April 1, 2024
  adminSupabase
);

// This returns the version where:
// effective_from_date <= April 1, 2024
// AND (effective_to_date >= April 1, 2024 OR effective_to_date IS NULL)
```

### Example Timeline

**Jan 2024**: Fee = ₹5000 (version 1, effective_from: 2024-01-01, effective_to: NULL)
- Bill for Jan 2024 → Uses version 1 → ₹5000

**June 1, 2024**: School hikes to ₹5500
- Close version 1: effective_to = 2024-05-31
- Create version 2: effective_from = 2024-06-01, amount = ₹5500

**Result**:
- Bill for May 2024 → Uses version 1 → ₹5000 (unchanged)
- Bill for June 2024 → Uses version 2 → ₹5500 (new fee)

**Oct 1, 2024**: School hikes to ₹6000
- Close version 2: effective_to = 2024-09-30
- Create version 3: effective_from = 2024-10-01, amount = ₹6000

**Result**:
- Bill for May 2024 → Uses version 1 → ₹5000
- Bill for June 2024 → Uses version 2 → ₹5500
- Bill for Oct 2024 → Uses version 3 → ₹6000

## Historical Protection

### Why Old Bills Stay Unchanged

1. **Bill Generation is Time-Specific**
   - When generating bill for April 2024, system queries: "What fee was active on April 1, 2024?"
   - Returns version 1 (₹5000)
   - Bill is generated with ₹5000 and saved

2. **Bills are Immutable**
   - Once generated, bills are never recalculated
   - Even if fees hiked later, old bills remain unchanged

3. **Version History is Preserved**
   - All fee versions are kept in database
   - Can audit fee changes over time
   - Can regenerate bills for any historical month using correct version

## Student Overrides with Versioning

### Student Gets Scholarship

**Jan 2024**: Student has no scholarship
- Bill for Jan 2024 → Uses class fee version 1 → ₹5000

**March 1, 2024**: Student gets 40% scholarship
- Create scholarship version 1: effective_from = 2024-03-01
- Close previous (no scholarship): effective_to = 2024-02-29

**Result**:
- Bill for Feb 2024 → Uses class fee version 1 → ₹5000 (no scholarship)
- Bill for March 2024 → Uses class fee version 1 → ₹5000 - 40% = ₹3000

**June 1, 2024**: School hikes fees to ₹5500
- Class fee version 2 created
- Student's scholarship still applies

**Result**:
- Bill for June 2024 → Uses class fee version 2 → ₹5500 - 40% = ₹3300

## Transport Fee Hikes

### Route-Specific Hikes

**Jan 2024**: Route A = ₹1000, Route B = ₹1200
- Version 1 for Route A: ₹1000
- Version 1 for Route B: ₹1200

**June 1, 2024**: Hike Route A to ₹1100
- Close Route A version 1
- Create Route A version 2: ₹1100
- Route B remains unchanged (still version 1)

**Result**:
- Student on Route A, May 2024 → ₹1000
- Student on Route A, June 2024 → ₹1100
- Student on Route B, June 2024 → ₹1200 (unchanged)

## Annual Fee Hikes

### New Academic Year

**2023-2024 Session**: Class 10 tuition = ₹5000/month
- Version 1: effective_from = 2023-04-01, effective_to = 2024-03-31

**2024-2025 Session**: Class 10 tuition = ₹6000/month
- Version 2: effective_from = 2024-04-01, effective_to = NULL

**Result**:
- Bill for March 2024 → Uses version 1 → ₹5000
- Bill for April 2024 → Uses version 2 → ₹6000

## Mid-Year Hikes

### Hike in Middle of Academic Year

**Jan 2024**: Fee = ₹5000
- Version 1: effective_from = 2024-01-01

**June 1, 2024**: Hike to ₹5500
- Close version 1: effective_to = 2024-05-31
- Create version 2: effective_from = 2024-06-01

**Result**:
- Bills Jan-May 2024 → Use version 1 → ₹5000
- Bills June-Dec 2024 → Use version 2 → ₹5500

## Multiple Hikes in Same Year

**Jan 2024**: ₹5000 (version 1)
**June 2024**: ₹5500 (version 2)
**Oct 2024**: ₹6000 (version 3)

**Result**:
- Jan-May 2024 → Version 1 → ₹5000
- June-Sep 2024 → Version 2 → ₹5500
- Oct-Dec 2024 → Version 3 → ₹6000

## Constraints

### No Overlapping Versions
```sql
EXCLUDE USING gist (
  class_group_id WITH =,
  fee_category_id WITH =,
  fee_cycle WITH =,
  daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) WITH &&
)
```

This ensures:
- No two versions can be active for the same time period
- Database enforces data integrity
- Prevents accidental overlapping versions

## Audit Trail

### Complete Fee History
```sql
SELECT 
  version_number,
  amount,
  effective_from_date,
  effective_to_date,
  created_by,
  created_at
FROM class_fee_versions
WHERE class_group_id = X
  AND fee_category_id = Y
ORDER BY version_number;
```

This shows:
- All fee changes over time
- Who made the change
- When the change was made
- Complete audit trail

## Bill Regeneration Safety

### Can Regenerate Bills Safely
- If bill is deleted, can regenerate using same billing date
- System will use correct fee version for that date
- Historical protection maintained

### Example
1. Generate bill for April 2024 → Uses version 1 → ₹5000
2. School hikes fees in June 2024
3. Delete April 2024 bill
4. Regenerate bill for April 2024 → Still uses version 1 → ₹5000 (unchanged)

## Implementation Checklist

✅ **Database Schema**
- Version tables with effective_from/effective_to
- EXCLUDE constraints prevent overlaps
- Indexes for fast date-based queries

✅ **Fee Hike Functions**
- Close previous version
- Create new version
- Handle version numbering

✅ **Bill Generation**
- Query fee version for specific date
- Use version active for billing month
- Never recalculate old bills

✅ **Student Overrides**
- Also versioned
- Respect time periods
- Stack on top of class fees

✅ **Audit Trail**
- Complete version history
- Track who made changes
- Track when changes were made

