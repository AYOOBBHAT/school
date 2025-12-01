# Student Fee Configuration Editing - Versioning Guide

## Overview

This document explains how the system handles fee configuration editing for students with proper versioning and historical tracking. All fee changes are versioned to ensure past billing periods remain unchanged.

## Core Principles

1. **No Retroactive Changes**: Fee modifications only apply from the day of change onward
2. **Historical Preservation**: All past fee configurations are preserved with effective date ranges
3. **Versioning**: Every change creates a new version, never overwrites old data
4. **Date-Based Selection**: Fee calculations use the active configuration based on the billing date

## Fee Configuration Components

### 1. Class Fee
- **Default**: Automatically applies the class's default fee
- **Editable**: Principal can select a specific class fee and apply discounts
- **Versioning**: When class changes, old class fee configuration is closed and new one starts

### 2. Transport Fee
- **Route Selection**: Principal selects transport route
- **Enable/Disable**: Can enable or disable transport
- **Discounts**: Can apply transport fee discounts
- **Versioning**: Route changes create new transport configuration version

### 3. Other Fees
- **Categories**: Library, Admission, Lab, Sports, and other custom fees
- **Enable/Disable**: Principal can enable/disable each fee category
- **Discounts**: Can apply discounts to each enabled fee
- **Versioning**: Each change creates new override records

## Database Schema

### Tables Used

1. **`student_fee_profile`**
   - Stores transport settings and fee cycle preferences
   - Fields: `transport_enabled`, `transport_route`, `effective_from`, `effective_to`, `is_active`
   - Versioned by effective date ranges

2. **`student_fee_overrides`**
   - Stores discounts and custom fee amounts per category
   - Fields: `fee_category_id`, `discount_amount`, `custom_fee_amount`, `effective_from`, `effective_to`, `is_active`
   - Versioned by effective date ranges

3. **`student_transport`**
   - Links student to transport route
   - Fields: `student_id`, `route_id`, `is_active`
   - Historical records preserved by deactivating old records

## Fee Editing Workflow

### When Principal Edits Student

1. **Load Current Configuration**
   - Fetch active fee profile
   - Fetch active fee overrides
   - Fetch current transport route
   - Display in edit modal

2. **User Makes Changes**
   - Modify class, transport route, discounts, or enable/disable fees
   - Changes are shown in real-time with calculated final amounts

3. **Save Changes**
   - Close old records (set `effective_to = yesterday`, `is_active = false`)
   - Create new records with `effective_from = today`
   - Preserve all historical data

### Class Change Logic

**Scenario**: Principal changes student's class from Class A to Class B

1. **Close Old Configuration**
   - Set `effective_to = yesterday` for all active fee profiles
   - Set `effective_to = yesterday` for all active fee overrides
   - Deactivate old transport records

2. **Apply New Class Defaults**
   - If no fee_config provided, use new class's default fees
   - If fee_config provided, use the provided configuration

3. **Create New Records**
   - New fee profile with `effective_from = today`
   - New fee overrides with `effective_from = today`
   - New transport record if transport enabled

4. **Result**
   - Past months: Use old class fee (from Class A)
   - Future months: Use new class fee (from Class B)
   - Historical records preserved

### Transport Fee Change Logic

**Scenario**: Principal changes transport route or enables/disables transport

1. **Close Old Transport Profile**
   - Set `effective_to = yesterday` for active transport profile
   - Deactivate old `student_transport` record

2. **Create New Transport Configuration**
   - New `student_fee_profile` with new transport settings
   - New `student_transport` record if transport enabled
   - New fee override if discount applied

3. **Result**
   - Past months: Use old transport fee
   - Future months: Use new transport fee
   - Historical records preserved

### Discount Change Logic

**Scenario**: Principal changes discount amount for class fee, transport, or other fees

1. **Close Old Override**
   - Set `effective_to = yesterday` for the specific fee override
   - Set `is_active = false`

2. **Create New Override**
   - New `student_fee_overrides` record with new discount
   - `effective_from = today`
   - `is_active = true`

3. **Result**
   - Past months: Use old discount amount
   - Future months: Use new discount amount
   - Historical records preserved

### Other Fees Enable/Disable Logic

**Scenario**: Principal enables or disables a fee category (e.g., Library fee)

1. **If Enabling with Discount**
   - Create new `student_fee_overrides` record
   - `effective_from = today`
   - `discount_amount = provided discount`

2. **If Disabling**
   - No override record created
   - Fee won't be charged (billing logic checks for overrides)

3. **Result**
   - Past months: Use previous enable/disable state
   - Future months: Use new enable/disable state
   - Historical records preserved

## API Endpoints

### GET `/students-admin/:studentId/fee-config`
**Purpose**: Get student's current active fee configuration

**Response**:
```json
{
  "class_fee_id": "uuid",
  "class_fee_discount": 0,
  "transport_enabled": true,
  "transport_route_id": "uuid",
  "transport_fee_discount": 0,
  "other_fees": [
    {
      "fee_category_id": "uuid",
      "enabled": true,
      "discount": 0
    }
  ]
}
```

### PUT `/students-admin/:studentId`
**Purpose**: Update student details and fee configuration

**Request Body**:
```json
{
  "class_group_id": "uuid",
  "section_id": "uuid",
  "roll_number": "string",
  "fee_config": {
    "class_fee_id": "uuid",
    "class_fee_discount": 0,
    "transport_enabled": true,
    "transport_route_id": "uuid",
    "transport_fee_discount": 0,
    "other_fees": [
      {
        "fee_category_id": "uuid",
        "enabled": true,
        "discount": 0
      }
    ]
  }
}
```

**Behavior**:
- If `class_group_id` changes, automatically closes old fee config and applies new class defaults (unless `fee_config` provided)
- If `fee_config` provided, uses the provided configuration
- Always creates new versioned records with `effective_from = today`
- Always closes old records with `effective_to = yesterday`

## Frontend Integration

### Edit Student Modal

1. **Load Current Config**
   - On modal open, fetch current fee configuration
   - Display in fee configuration section

2. **Class Change Handling**
   - When class changes, reload default fees for new class
   - Reset fee config to defaults (user can still customize)
   - Show warning if class changed (fees will update)

3. **Fee Configuration UI**
   - Class Fee: Dropdown to select fee, discount input, final amount display
   - Transport Fee: Enable checkbox, route dropdown, discount input, final amount display
   - Other Fees: List of all fee categories with enable/disable, discount input, final amount display

4. **Save Changes**
   - Send updated student data with `fee_config`
   - Backend handles versioning automatically
   - Show success message

## Billing Logic Integration

### Monthly Fee Calculation

When generating bills for a specific month:

1. **Get Active Configuration for Date**
   ```sql
   SELECT * FROM student_fee_profile
   WHERE student_id = ?
     AND effective_from <= billing_month_start
     AND (effective_to >= billing_month_end OR effective_to IS NULL)
     AND is_active = true
   ```

2. **Get Active Overrides for Date**
   ```sql
   SELECT * FROM student_fee_overrides
   WHERE student_id = ?
     AND effective_from <= billing_month_start
     AND (effective_to >= billing_month_end OR effective_to IS NULL)
     AND is_active = true
   ```

3. **Calculate Fees**
   - Use class fee version active for that month
   - Apply student's discount override for that month
   - Use transport fee if enabled for that month
   - Apply other fees based on enable/disable state for that month

### Historical Accuracy

- **Past Bills**: Never recalculated, use fee configuration active at that time
- **Future Bills**: Use current active configuration
- **Mid-Month Changes**: Changes apply from change date, not retroactively

## Example Scenarios

### Scenario 1: Class Change Mid-Year

**Timeline**:
- January: Student in Class 5, Fee ₹5000/month
- March 15: Principal moves student to Class 6, Fee ₹6000/month

**Result**:
- January & February bills: ₹5000 (Class 5 fee)
- March bill: ₹5000 (Class 5 fee, change on 15th doesn't affect March)
- April onwards: ₹6000 (Class 6 fee)

**Database**:
- Old fee profile: `effective_from = 2024-01-01`, `effective_to = 2024-03-14`
- New fee profile: `effective_from = 2024-03-15`, `effective_to = NULL`

### Scenario 2: Discount Applied

**Timeline**:
- January: Student pays full class fee ₹5000/month
- March 10: Principal applies ₹500 discount

**Result**:
- January & February bills: ₹5000 (no discount)
- March bill: ₹5000 (no discount, change on 10th doesn't affect March)
- April onwards: ₹4500 (with discount)

**Database**:
- Old override: None (no discount)
- New override: `effective_from = 2024-03-10`, `discount_amount = 500`

### Scenario 3: Transport Route Change

**Timeline**:
- January: Student on Route A, Fee ₹1000/month
- April 5: Principal changes to Route B, Fee ₹1200/month

**Result**:
- January-March bills: ₹1000 (Route A)
- April bill: ₹1000 (Route A, change on 5th doesn't affect April)
- May onwards: ₹1200 (Route B)

**Database**:
- Old transport profile: `effective_from = 2024-01-01`, `effective_to = 2024-04-04`
- New transport profile: `effective_from = 2024-04-05`, `effective_to = NULL`

## Best Practices

1. **Always Use Effective Dates**: Never update existing records, always create new ones
2. **Close Old Records Properly**: Always set `effective_to` to yesterday when creating new version
3. **Preserve History**: Never delete fee configuration records
4. **Date-Based Queries**: Always query by date range when fetching active configuration
5. **Validate Changes**: Ensure new configuration is valid before closing old one

## Error Handling

1. **Validation Errors**: Return 400 with specific error message
2. **Database Errors**: Log error, return 500 with generic message
3. **Partial Updates**: Use transactions to ensure atomicity
4. **Rollback**: If new record creation fails, old records remain active

## Testing Checklist

- [ ] Edit student class - verify old fees preserved
- [ ] Edit transport route - verify old transport fee preserved
- [ ] Apply discount - verify old discount preserved
- [ ] Disable fee category - verify old state preserved
- [ ] Enable fee category - verify old state preserved
- [ ] Multiple changes at once - verify all changes versioned correctly
- [ ] Bill generation for past month - uses old configuration
- [ ] Bill generation for future month - uses new configuration

