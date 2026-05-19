-- Disable RLS on finance_companies table (using application-level security)
ALTER TABLE finance_companies DISABLE ROW LEVEL SECURITY;


-- Also ensure anon role has necessary permissions
GRANT ALL ON finance_companies TO anon;
GRANT ALL ON finance_companies TO authenticated;


-- Ensure anon has permissions on users table for creating finance users
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;



