-- Complete Setup Script - Run this ONCE in Supabase SQL Editor
-- This script does everything needed for authentication


-- Step 1: Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Step 2: Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Step 3: Add user_id column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;


-- Step 4: Add created_by columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);


-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loans(customer_id);


-- Step 6: Disable RLS (we're using custom auth, not Supabase Auth)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;


-- Step 7: Function to verify user password
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


-- Step 8: Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Step 9: Trigger for users table
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- Step 10: Grant permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;


-- Step 11: Create your admin user
INSERT INTO users (email, password_hash, role)
VALUES (
  'asiftahashildar0071@gmail.com',
  crypt('Asif@123', gen_salt('bf')),
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = crypt('Asif@123', gen_salt('bf'));


-- Step 12: Create default admin (optional backup)
INSERT INTO users (email, password_hash, role)
VALUES ('admin@example.com', crypt('admin123', gen_salt('bf')), 'admin')
ON CONFLICT (email) DO NOTHING;


-- Step 13: Verify setup
SELECT 'Users table exists' as status, COUNT(*) as user_count FROM users;
SELECT id, email, role, created_at FROM users ORDER BY created_at;



