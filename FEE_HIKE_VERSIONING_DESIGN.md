# Fee Hike & Historical Fee Protection System - Design

## Overview
A fee management system that properly handles fee hikes with complete version history, ensuring old bills remain unchanged when fees are updated.

## Core Principles

1. **Fee Versioning**: Every fee change creates a new version with effective dates
2. **Historical Protection**: Old bills are immutable - never recalculated
3. **Time-Based Selection**: Bills use fee version active for that specific month
4. **No Retroactive Changes**: Fee hikes only affect future bills

## Database Schema

### Fee Versioning Tables

1. **fee_definition_versions** - Version history for all fee types
2. **class_fee_versions** - Versioned class tuition fees
3. **transport_fee_versions** - Versioned transport fees
4. **optional_fee_versions** - Versioned optional fees

### Key Features

- `effective_from_date` - When this version becomes active
- `effective_to_date` - When this version expires (NULL = currently active)
- `version_number` - Sequential version number
- Unique constraint: No overlapping date ranges for same fee

## Fee Hike Logic

### When School Hikes Fees

1. **Close Old Version**:
   - Set `effective_to_date = yesterday` for current version
   - Set `is_active = false`

2. **Create New Version**:
   - `effective_from_date = today`
   - `effective_to_date = NULL` (active)
   - `version_number = previous + 1`
   - New amount

3. **Result**: Old bills unchanged, new bills use new fee

### Bill Generation Logic

When generating bill for month X:
```
SELECT fee_version WHERE
  effective_from_date <= first_day_of_month_X
  AND (effective_to_date >= last_day_of_month_X OR effective_to_date IS NULL)
```

This ensures:
- Bills for past months use old fees (even if fees hiked later)
- Bills for future months use new fees
- Mid-year hikes work correctly

## Student Overrides with Versioning

Student overrides also have versions:
- When student gets scholarship → Create version with effective_from
- When student opts out of transport → Create version with effective_from
- When generating bill → Apply student override version active for that month

## Example Scenarios

### Scenario 1: Annual Fee Hike
- Jan 2024: Tuition = ₹5000/month
- Jan 2025: School hikes to ₹6000/month
- Bill for Dec 2024: Uses ₹5000 (old version)
- Bill for Jan 2025: Uses ₹6000 (new version)

### Scenario 2: Mid-Year Hike
- Jan 2024: Tuition = ₹5000/month
- June 2024: School hikes to ₹5500/month
- Bill for May 2024: Uses ₹5000
- Bill for June 2024: Uses ₹5500

### Scenario 3: Multiple Hikes
- Jan 2024: ₹5000
- June 2024: ₹5500
- Oct 2024: ₹6000
- Each bill uses correct version for that month

