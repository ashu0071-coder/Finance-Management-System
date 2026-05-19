-- Add finance_manager and finance_member roles
-- This migration adds support for two-tier finance company access


-- 1. Add new columns to finance_companies table for member credentials
ALTER TABLE finance_companies
ADD COLUMN IF NOT EXISTS member_email VARCHAR(255);


-- Drop member_name column if it exists (cleanup)
ALTER TABLE finance_companies
DROP COLUMN IF EXISTS member_name;


-- Drop unique constraint on email since we're using manager_email for login
ALTER TABLE finance_companies
DROP CONSTRAINT IF EXISTS finance_companies_email_key;


-- Make email nullable since it's no longer required
ALTER TABLE finance_companies
ALTER COLUMN email DROP NOT NULL;


-- 2. Update users table to support new roles
-- Drop the old check constraint and create a new one with all valid roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'finance', 'finance_manager', 'finance_member', 'customer'));


-- Drop old functions if they exist (with old INTEGER parameter)
DROP FUNCTION IF EXISTS create_finance_manager_user(TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS create_finance_member_user(TEXT, TEXT, INTEGER, TEXT);


-- 3. Create function to create finance manager user
CREATE OR REPLACE FUNCTION create_finance_manager_user(
  user_email TEXT,
  user_password TEXT,
  company_id UUID,
  user_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (email, password_hash, role, finance_company_id)
  VALUES (
    user_email,
    crypt(user_password, gen_salt('bf')),
    'finance_manager',
    company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Create function to create finance member user
CREATE OR REPLACE FUNCTION create_finance_member_user(
  user_email TEXT,
  user_password TEXT,
  company_id UUID,
  user_name TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (email, password_hash, role, finance_company_id)
  VALUES (
    user_email,
    crypt(user_password, gen_salt('bf')),
    'finance_member',
    company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update existing finance users to finance_manager role
UPDATE users
SET role = 'finance_manager'
WHERE role = 'finance';


-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION create_finance_manager_user TO postgres;
GRANT EXECUTE ON FUNCTION create_finance_member_user TO postgres;


COMMENT ON COLUMN finance_companies.member_email IS 'Email for finance member (read-only access)';



