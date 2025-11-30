# Fee Workflow System - Complete Documentation

## Overview

The fee workflow system allows principals to configure all fee-related details when adding a student. This ensures that each student's fee structure is stored independently and remains unchanged even if default fees are modified later.

## Backend Endpoints

### 1. Get Default Fees for a Class

**Endpoint:** `GET /api/principal-users/classes/:classId/default-fees`

**Purpose:** Retrieves all default fees available for a class, including:
- Class fees (tuition fees)
- Transport routes and their fees
- Other fee categories (Library, Admission, Lab, Sports, etc.)
- Optional fees

**Response:**
```json
{
  "class_fees": [
    {
      "id": "uuid",
      "class_group_id": "uuid",
      "fee_category_id": "uuid",
      "amount": 5000,
      "fee_cycle": "monthly",
      "fee_categories": {
        "id": "uuid",
        "name": "Tuition Fee",
        "fee_type": "tuition"
      }
    }
  ],
  "transport_routes": [
    {
      "id": "uuid",
      "route_name": "Route A",
      "bus_number": "BUS-001",
      "zone": "North",
      "fee": {
        "base_fee": 1000,
        "escort_fee": 200,
        "fuel_surcharge": 100,
        "total": 1300,
        "fee_cycle": "monthly"
      }
    }
  ],
  "other_fee_categories": [
    {
      "id": "uuid",
      "name": "Library Fee",
      "fee_type": "optional",
      "description": "Library access fee"
    }
  ],
  "optional_fees": []
}
```

### 2. Create Student with Fee Configuration

**Endpoint:** `POST /api/principal-users/students`

**Request Body:**
```json
{
  // Student personal details
  "email": "student@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "username": "johndoe",
  "phone": "+1234567890",
  "roll_number": "2024-001",
  "class_group_id": "uuid",
  "section_id": "uuid",
  "admission_date": "2024-01-01",
  "gender": "male",
  "date_of_birth": "2010-05-15",
  "home_address": "123 Main St",
  
  // Guardian details
  "guardian_name": "Jane Doe",
  "guardian_phone": "+1234567891",
  "guardian_email": "guardian@example.com",
  "guardian_relationship": "parent",
  
  // Fee configuration (optional)
  "fee_config": {
    // Class fee discount
    "class_fee_discount": 500,
    
    // Transport configuration
    "transport_enabled": true,
    "transport_route_id": "uuid",
    "transport_fee_discount": 100,
    
    // Other fees configuration
    "other_fees": [
      {
        "fee_category_id": "uuid",
        "enabled": true,
        "discount": 50
      },
      {
        "fee_category_id": "uuid",
        "enabled": false,  // This fee will be disabled for the student
        "discount": 0
      }
    ]
  }
}
```

**Fee Configuration Details:**

1. **Class Fee Discount** (`class_fee_discount`):
   - Amount to discount from the default class fee
   - Applied to the tuition/class fee category
   - Stored in `student_fee_overrides` table

2. **Transport Configuration**:
   - `transport_enabled`: `true` to enable transport, `false` to disable
   - `transport_route_id`: UUID of the selected transport route
   - `transport_fee_discount`: Amount to discount from transport fee
   - Stored in `student_fee_profile` and `student_fee_overrides` tables

3. **Other Fees** (`other_fees` array):
   - Each item represents a fee category (Library, Admission, Lab, Sports, etc.)
   - `enabled`: `true` to enable the fee, `false` to disable it
   - `discount`: Amount to discount from the fee
   - If `enabled: false`, the fee is set to full free (is_full_free = true)
   - Stored in `student_fee_overrides` table

## How It Works

### 1. Class Fee Setup

When a student is enrolled in a class:
- The system automatically retrieves default class fees from `class_fee_defaults`
- If a discount is provided, it's stored in `student_fee_overrides` with the discount amount
- The student's fee structure is independent of future changes to class defaults

### 2. Transport Fee Setup

When transport is enabled:
- The principal selects a transport route
- The system retrieves the route's default transport fee from `transport_fees`
- Transport settings are stored in `student_fee_profile`
- If a discount is provided, it's stored in `student_fee_overrides`
- If transport is disabled, `transport_enabled: false` is stored in `student_fee_profile`

### 3. Other Fees Setup

For other fee categories (Library, Admission, Lab, Sports, etc.):
- The principal can see all available fee categories
- Each fee can be enabled or disabled
- Discounts can be applied to enabled fees
- Disabled fees are stored with `is_full_free: true` in `student_fee_overrides`

### 4. Fee Independence

**Important:** All fee configurations are stored as snapshots at the time of student enrollment. This means:
- If default class fees change later, the student's fee structure remains unchanged
- The student's fees are calculated using their stored overrides, not the current defaults
- This ensures fee consistency and prevents unexpected changes

## Database Tables Used

1. **`student_fee_profile`**: Stores transport settings
   - `transport_enabled`: boolean
   - `transport_route`: text (route name)
   - `transport_fee_override`: numeric (custom transport fee, if any)

2. **`student_fee_overrides`**: Stores discounts and custom fees
   - `fee_category_id`: UUID (null for class-wide discounts)
   - `discount_amount`: numeric (discount to subtract)
   - `custom_fee_amount`: numeric (custom fee that replaces default)
   - `is_full_free`: boolean (if true, fee = 0)

3. **`class_fee_defaults`**: Default fees per class (read-only for student creation)

4. **`transport_fees`**: Default transport fees per route (read-only for student creation)

5. **`fee_categories`**: Master list of fee types (read-only for student creation)

## Frontend Integration

### Step 1: Fetch Default Fees

When the principal selects a class while adding a student:

```javascript
const response = await fetch(`${API_URL}/principal-users/classes/${classId}/default-fees`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { class_fees, transport_routes, other_fee_categories, optional_fees } = await response.json();
```

### Step 2: Display Fee Configuration UI

Show the following sections:

1. **Class Fee Section:**
   - Display default class fee amount
   - Input field for discount amount
   - Show final amount after discount

2. **Transport Fee Section:**
   - Dropdown to select transport route (or "No Transport")
   - Display route fee details (base_fee, escort_fee, fuel_surcharge, total)
   - Input field for transport fee discount
   - Checkbox to enable/disable transport

3. **Other Fees Section:**
   - List all other fee categories
   - For each category:
     - Checkbox to enable/disable
     - Input field for discount (if enabled)
     - Display default amount (if available)

### Step 3: Submit Student with Fee Config

```javascript
const studentData = {
  // ... student personal details ...
  fee_config: {
    class_fee_discount: classFeeDiscount,
    transport_enabled: transportEnabled,
    transport_route_id: selectedRouteId,
    transport_fee_discount: transportDiscount,
    other_fees: otherFeesConfig.map(fee => ({
      fee_category_id: fee.id,
      enabled: fee.enabled,
      discount: fee.discount || 0
    }))
  }
};

const response = await fetch(`${API_URL}/principal-users/students`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(studentData)
});
```

## Example Workflow

1. Principal navigates to "Add Student" page
2. Fills in student personal details (name, email, etc.)
3. Selects class → System fetches default fees for that class
4. **Class Fee Section:**
   - Sees default class fee: ₹5,000/month
   - Applies discount: ₹500
   - Final class fee: ₹4,500/month
5. **Transport Fee Section:**
   - Selects "Route A" (fee: ₹1,300/month)
   - Applies discount: ₹100
   - Final transport fee: ₹1,200/month
6. **Other Fees Section:**
   - Library Fee: Enabled, Discount: ₹50
   - Admission Fee: Disabled (student already paid)
   - Lab Fee: Enabled, No discount
   - Sports Fee: Enabled, Discount: ₹100
7. Clicks "Save" → Student is created with all fee configurations stored

## Error Handling

- If fee configuration fails, the student is still created (errors are logged but don't block student creation)
- Fee configuration errors are logged to console for debugging
- The system gracefully handles missing fee categories or routes

## Notes

- Fee configuration is optional - if not provided, student will use default fees
- All fees are stored with `effective_from` date set to the admission date
- Discounts are stored as absolute amounts, not percentages
- To apply a percentage discount, calculate the amount on the frontend before sending

