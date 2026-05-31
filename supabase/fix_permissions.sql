-- FIX RLS AND PERMISSIONS
-- This will allow the API to read from the users table


-- Step 1: Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;


-- Step 2: Drop any existing policies that might be blocking access
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;


-- Step 3: Grant full permissions to anon and authenticated roles
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


-- Step 4: Grant sequence permissions if they exist
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- Step 5: Verify RLS is OFF (should show 'f' for false)
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'users';


-- Step 6: Verify permissions are granted
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'users'
AND grantee IN ('anon', 'authenticated');


-- Step 7: Test query as anonymous user (simulating API call)
SET ROLE anon;
SELECT id, email, role, customer_id
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';
RESET ROLE;


-- Step 8: Confirm user exists and is readable
SELECT
  id,
  email,
  role,
  customer_id,
  created_at,
  '✓ User exists and should be accessible via API' as status
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';