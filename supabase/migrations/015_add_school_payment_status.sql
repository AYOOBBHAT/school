-- Migration: Add payment status to schools table
-- This enables tracking whether a school has paid their subscription

-- Add payment_status column to schools table
alter table schools 
add column if not exists payment_status text check (payment_status in ('paid', 'unpaid')) default 'paid';

-- Create index for faster lookups
create index if not exists idx_schools_payment_status on schools(payment_status);

-- Add comment
comment on column schools.payment_status is 'Payment status of the school subscription - paid or unpaid';

