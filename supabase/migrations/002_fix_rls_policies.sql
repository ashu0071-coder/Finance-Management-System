-- =====================================================
-- FIX RLS POLICIES FOR DEVELOPMENT/STANDALONE USE
-- =====================================================
-- This migration allows anonymous access to all tables for development
-- In production, you should implement proper authentication


-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON loans;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON payments;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON loan_extensions;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON notifications;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON audit_log;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON settings;


-- Create new policies that allow all operations (for development)
-- Note: In production, replace 'true' with proper auth checks


CREATE POLICY "Allow all operations" ON customers
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON loans
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON payments
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON loan_extensions
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON notifications
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON audit_log
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON settings
    FOR ALL USING (true) WITH CHECK (true);



