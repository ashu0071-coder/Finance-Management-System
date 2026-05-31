-- Fix for RLS Issues - Run this if you already ran the migration
-- This disables RLS on all tables


ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;


-- Drop any existing policies
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
DROP POLICY IF EXISTS "Customers can view their own record" ON customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON customers;
DROP POLICY IF EXISTS "Admins can update customers" ON customers;


DROP POLICY IF EXISTS "Admins can view all loans" ON loans;
DROP POLICY IF EXISTS "Customers can view their own loans" ON loans;
DROP POLICY IF EXISTS "Admins can insert loans" ON loans;
DROP POLICY IF EXISTS "Admins can update loans" ON loans;


DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "Customers can view their own payments" ON payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON payments;
DROP POLICY IF EXISTS "Admins can update payments" ON payments;


DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON settings;


-- Verify RLS is off
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('customers', 'loans', 'payments', 'settings');