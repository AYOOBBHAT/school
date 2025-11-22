# Comprehensive School Fee Management System - Complete Design

## Overview
A complete fee management system supporting school-level structures, class defaults, student-specific customization, scholarships, discounts, and flexible billing cycles.

## Database Schema

### Core Tables

1. **fee_categories** - Master list of fee types
2. **class_fee_defaults** - Default fees per class
3. **transport_fee_defaults** - Transport fees per route/class
4. **optional_fee_definitions** - Optional fees available per class
5. **student_fee_profile** - Student-specific fee overrides
6. **student_custom_fees** - Additional custom fees per student
7. **scholarships** - Scholarship/discount rules per student
8. **fee_bills** - Generated bills
9. **fee_bill_items** - Line items in each bill
10. **fee_payments** - Payment records

## System Logic

### 1. Class Defaults
- When a student joins a class, they inherit class default fees
- Defaults include: monthly tuition, optional fees, transport fee
- Defaults can be overridden per student

### 2. Student-Specific Overrides
- Transport: Can be disabled (fee = 0) or use different route price
- Scholarships: Percentage or fixed discount
- Custom fees: Additional fees not in class defaults
- Fee overrides: Change any default fee amount

### 3. Fee Calculation Formula
```
Base Fee = Class Default Fee
+ Student Override (if exists)
- Scholarship/Discount
+ Custom Fees
+ Transport Fee (if enabled)
+ Optional Fees (if opted in)
= Final Payable Amount
```

### 4. Bill Generation
- Generate bills based on student's fee cycle (monthly/quarterly/yearly)
- Pull class defaults + student overrides
- Apply scholarships/discounts
- Add transport (if enabled)
- Add optional fees (if opted in)
- Add custom fees
- Calculate total and due date

### 5. Payment Tracking
- Track payments per bill
- Calculate unpaid months
- Track overdue amounts
- Handle partial payments
- Apply late fees

## Permissions

- **Clerk**: Generate bills, view/collect payments
- **Principal/Admin**: Change fee structure, approve scholarships
- **Student/Parent**: View own bills & payment history

