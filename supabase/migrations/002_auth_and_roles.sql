-- Note: RLS is disabled for custom authentication
-- Data filtering is handled at the application level
-- Enable RLS when migrating to Supabase Auth


-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;


-- Create users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- Add user_id column to customers table to link with users
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;


-- Add created_by column to track which admin created records
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);


-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON loans(customer_id);


-- Row Level Security Policies
-- DISABLED: Using custom auth instead of Supabase Auth
-- Uncomment and modify these when migrating to Supabase Auth


/*
-- Customers table: Admins can see all, customers can only see their own
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Customers can view their own record"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid()
  );


CREATE POLICY "Admins can insert customers"
  ON customers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Admins can update customers"
  ON customers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


-- Loans table: Admins can see all, customers can only see their own loans
CREATE POLICY "Admins can view all loans"
  ON loans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Customers can view their own loans"
  ON loans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = loans.customer_id
      AND customers.user_id = auth.uid()
    )
  );


CREATE POLICY "Admins can insert loans"
  ON loans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Admins can update loans"
  ON loans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


-- Payments table: Admins can see all, customers can only see their own payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Customers can view their own payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loans
      JOIN customers ON customers.id = loans.customer_id
      WHERE loans.id = payments.loan_id
      AND customers.user_id = auth.uid()
    )
  );


CREATE POLICY "Admins can insert payments"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Admins can update payments"
  ON payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


-- Settings table: Only admins can access
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins can view settings"
  ON settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Admins can update settings"
  ON settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );


CREATE POLICY "Admins can insert settings"
  ON settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
*/


-- Function to create a default admin user (password: admin123)
-- Note: In production, you should use Supabase Auth instead of storing passwords directly
CREATE OR REPLACE FUNCTION create_default_admin()
RETURNS void AS $$
BEGIN
  INSERT INTO users (email, password_hash, role)
  VALUES ('admin@example.com', crypt('admin123', gen_salt('bf')), 'admin')
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Function to verify user password
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


-- Create the default admin user
SELECT create_default_admin();


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger for users table
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


-- Grant necessary permissions
GRANT ALL ON users TO authenticated;
GRANT ALL ON users TO anon;