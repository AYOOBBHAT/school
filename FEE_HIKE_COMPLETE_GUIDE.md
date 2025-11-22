# Fee Hike & Historical Protection - Complete Guide

## Overview
A complete fee management system with fee versioning that ensures fee hikes only affect future bills, while old bills remain unchanged forever.

## Database Schema

### Version Tables

1. **`class_fee_versions`** - Versioned class tuition fees
   - `version_number`, `amount`, `effective_from_date`, `effective_to_date`
   - EXCLUDE constraint prevents overlapping date ranges

2. **`transport_fee_versions`** - Versioned transport fees
   - Supports route-specific versions
   - Same versioning structure

3. **`optional_fee_versions`** - Versioned optional fees
   - Version history for optional fees

4. **`student_fee_override_versions`** - Versioned student overrides
   - Student-specific overrides with versioning

5. **`scholarship_versions`** - Versioned scholarships
   - Scholarship changes over time

## Fee Hike Process

### Step 1: Close Previous Version
```sql
UPDATE class_fee_versions
SET 
  effective_to_date = (hike_date - 1 day),
  is_active = false
WHERE 
  class_group_id = X
  AND fee_category_id = Y
  AND is_active = true;
```

### Step 2: Create New Version
```sql
INSERT INTO class_fee_versions (
  version_number, -- Previous max + 1
  amount, -- New amount
  effective_from_date, -- Hike date
  effective_to_date, -- NULL (active)
  is_active -- true
);
```

## Bill Generation with Versioning

### For Billing Month X

```typescript
// Get fee version active for first day of month X
const billingDate = new Date(2024, 3, 1); // April 1, 2024

const feeVersion = await getClassFeeVersion(
  classGroupId,
  feeCategoryId,
  'monthly',
  billingDate, // Uses version active on this date
  adminSupabase
);

// Bill uses this version's amount
// Old bills remain unchanged even if fees hiked later
```

## Historical Protection Guarantees

✅ **Old Bills Unchanged**: Bills use fee version active when bill was generated  
✅ **No Retroactive Changes**: Fee hikes only affect future bills  
✅ **Complete Audit Trail**: All fee changes tracked with versions  
✅ **Safe Regeneration**: Can regenerate bills using correct historical version  
✅ **Database Constraints**: EXCLUDE constraints prevent overlapping versions  

## Example Timeline

### Scenario: Annual Fee Hike
- **2024**: ₹5000/month (version 1, Jan 1 - Dec 31)
- **2025**: ₹6000/month (version 2, Jan 1 - NULL)

**Bills:**
- Bill for Dec 2024 → Uses version 1 → ₹5000 ✅ (unchanged)
- Bill for Jan 2025 → Uses version 2 → ₹6000 ✅ (new fee)

### Scenario: Mid-Year Hike
- **Jan 2024**: ₹5000 (version 1)
- **June 1, 2024**: Hike to ₹5500 (version 2)

**Bills:**
- Bill for May 2024 → Uses version 1 → ₹5000 ✅
- Bill for June 2024 → Uses version 2 → ₹5500 ✅

### Scenario: Multiple Hikes
- **Jan**: ₹5000 (v1)
- **June**: ₹5500 (v2)
- **Oct**: ₹6000 (v3)

**Bills:**
- Jan-May → Version 1 → ₹5000
- June-Sep → Version 2 → ₹5500
- Oct-Dec → Version 3 → ₹6000

## Student Overrides with Versioning

### Student Gets Scholarship
- **Jan 2024**: No scholarship → Bill = ₹5000
- **March 1, 2024**: 40% scholarship → Bill = ₹5000 - 40% = ₹3000
- **June 1, 2024**: Fee hiked to ₹5500 → Bill = ₹5500 - 40% = ₹3300

**Result**: Scholarship applies to correct fee version for each month

## Transport Fee Hikes

### Route-Specific Hikes
- **Jan 2024**: Route A = ₹1000, Route B = ₹1200
- **June 2024**: Hike Route A to ₹1100

**Result**:
- Student on Route A, May 2024 → ₹1000
- Student on Route A, June 2024 → ₹1100
- Student on Route B, June 2024 → ₹1200 (unchanged)

## Constraints

### EXCLUDE Constraint
```sql
EXCLUDE USING gist (
  class_group_id WITH =,
  fee_category_id WITH =,
  fee_cycle WITH =,
  daterange(effective_from_date, coalesce(effective_to_date, 'infinity'::date)) WITH &&
)
```

**Prevents:**
- Overlapping date ranges
- Data corruption
- Invalid fee states

## API Functions

### Hike Fees
```typescript
await hikeClassFee(
  schoolId,
  classGroupId,
  feeCategoryId,
  feeCycle,
  newAmount,
  effectiveFromDate,
  createdBy,
  adminSupabase
);
```

### Get Fee for Billing Month
```typescript
const feeVersion = await getClassFeeVersion(
  classGroupId,
  feeCategoryId,
  feeCycle,
  billingDate,
  adminSupabase
);
```

## Migration Notes

1. **Existing Data**: Migration automatically converts existing fees to version 1
2. **Backward Compatible**: Old `class_fee_defaults` table still exists
3. **Gradual Migration**: Can use both systems during transition

## Best Practices

1. **Always Use Versions**: Use versioned tables for bill generation
2. **Never Modify Old Bills**: Once generated, bills are immutable
3. **Hike Dates**: Use first day of month for clean transitions
4. **Audit Trail**: Track who made changes and when
5. **Test Regeneration**: Verify old bills regenerate correctly

## System Guarantees

✅ **Historical Protection**: Old bills never change  
✅ **Time-Based Selection**: Correct fee for any date  
✅ **No Overlaps**: Database constraints prevent conflicts  
✅ **Complete History**: Full audit trail of all changes  
✅ **Safe Operations**: Can regenerate bills safely  

The system is production-ready and ensures complete historical fee protection!

