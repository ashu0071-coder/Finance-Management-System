-- Database Verification Script
-- Run this in Supabase SQL Editor to check if everything is set up correctly


-- Check 1: Does the users table exist?
SELECT
  'Users table exists!' as status,
  COUNT(*) as total_users
FROM users;


-- Check 2: List all users
SELECT
  id,
  email,
  role,
  customer_id,
  created_at
FROM users
ORDER BY created_at DESC;


-- Check 3: Check if pgcrypto extension is enabled
SELECT
  extname as extension_name,
  extversion as version
FROM pg_extension
WHERE extname = 'pgcrypto';


-- Check 4: Test password verification function exists
SELECT
  proname as function_name,
  pronargs as argument_count
FROM pg_proc
WHERE proname = 'verify_user_password';


-- Check 5: Verify RLS is disabled (should show 'f' for false)
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'customers', 'loans', 'payments', 'settings');


-- Check 6: Test login credentials for your admin user
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM users WHERE email = 'asiftahashildar0071@gmail.com')
    THEN 'User exists ✓'
    ELSE 'User NOT FOUND ✗'
  END as user_status;


-- Check 7: Test password verification (should return TRUE)
SELECT verify_user_password('asiftahashildar0071@gmail.com', 'Asif@123') as password_correct;


-- Check 8: If user doesn't exist, create it now
INSERT INTO users (email, password_hash, role)
VALUES (
  'asiftahashildar0071@gmail.com',
  crypt('Asif@123', gen_salt('bf')),
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = crypt('Asif@123', gen_salt('bf'))
RETURNING id, email, role, 'User created/updated successfully!' as message;



