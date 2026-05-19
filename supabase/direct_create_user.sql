-- DIRECT CHECK AND CREATE USER
-- Run this in your Supabase SQL Editor at: https://mbgtoxfuyjflseglpftj.supabase.co


-- Step 1: Check if users table exists
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'users';


-- Step 2: If users table exists, count rows
SELECT COUNT(*) as total_users FROM users;


-- Step 3: List all users (if any exist)
SELECT id, email, role FROM users;


-- Step 4: Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Step 5: Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  customer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Step 6: Create password verification function
CREATE OR REPLACE FUNCTION verify_user_password(user_email TEXT, user_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM users
  WHERE email = user_email;
 
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
 
  RETURN stored_hash = crypt(user_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Step 7: DELETE old user if exists (to start fresh)
DELETE FROM users WHERE email = 'asiftahashildar0071@gmail.com';


-- Step 8: CREATE your admin user
INSERT INTO users (email, password_hash, role)
VALUES (
  'asiftahashildar0071@gmail.com',
  crypt('Asif@123', gen_salt('bf')),
  'admin'
);


-- Step 9: Verify user was created
SELECT
  id,
  email,
  role,
  created_at,
  'USER CREATED SUCCESSFULLY ✓' as status
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';


-- Step 10: Test the API will find this user
SELECT
  id,
  email,
  role,
  customer_id
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';


-- Step 11: Test password verification
SELECT
  email,
  verify_user_password('asiftahashildar0071@gmail.com', 'Asif@123') as password_is_correct
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';



