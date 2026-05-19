-- RESTRUCTURE FOR MULTI-TENANT SAAS
-- Finance Companies as Tenants Model


-- Step 1: Create finance_companies table (your actual customers)
CREATE TABLE IF NOT EXISTS public.finance_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile_number TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
  subscription_start_date DATE,
  subscription_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Step 2: Drop the old role constraint FIRST
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;


-- Step 3: Update existing admin users to super_admin (now constraint is removed)
UPDATE users
SET role = 'super_admin'
WHERE role = 'admin';


-- Step 4: Add new role constraint with super_admin and finance
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'finance'));


-- Step 5: Add finance_company_id to users
ALTER TABLE users DROP COLUMN IF EXISTS customer_id;
ALTER TABLE users ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE;


-- Step 6: Add finance_company_id to all tables for multi-tenancy
ALTER TABLE customers ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE;


-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_finance_company ON customers(finance_company_id);
CREATE INDEX IF NOT EXISTS idx_loans_finance_company ON loans(finance_company_id);
CREATE INDEX IF NOT EXISTS idx_payments_finance_company ON payments(finance_company_id);
CREATE INDEX IF NOT EXISTS idx_users_finance_company ON users(finance_company_id);


-- Step 8: Verify the structure
SELECT
  id,
  email,
  role,
  finance_company_id,
  '✓ Super Admin updated successfully' as status
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';


-- Step 9: Show the new structure
SELECT
  'super_admin' as role,
  'Can see all finance companies and their data' as access,
  'You (asiftahashildar0071@gmail.com)' as example
UNION ALL
SELECT
  'finance' as role,
  'Can only see their own borrowers/loans' as access,
  'Finance companies you create' as example;



