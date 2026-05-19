-- ONE-STEP FIX: Create Your Admin User
-- Copy this entire script and run it in Supabase SQL Editor


-- First, ensure pgcrypto extension exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Create the users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Grant permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;


-- Create password verification function
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


-- Create your admin user
INSERT INTO users (email, password_hash, role)
VALUES (
  'asiftahashildar0071@gmail.com',
  crypt('Asif@123', gen_salt('bf')),
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = crypt('Asif@123', gen_salt('bf'));


-- Verify user was created
SELECT
  id,
  email,
  role,
  created_at,
  'SUCCESS! User created. You can now login.' as message
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';



