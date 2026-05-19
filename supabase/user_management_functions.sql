-- Function to create a finance company user with password hash
CREATE OR REPLACE FUNCTION create_finance_user(
  user_email TEXT,
  user_password TEXT,
  company_id UUID
)
RETURNS void AS $$
BEGIN
  INSERT INTO users (email, password_hash, role, finance_company_id)
  VALUES (
    user_email,
    crypt(user_password, gen_salt('bf')),
    'finance',
    company_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to update user password
CREATE OR REPLACE FUNCTION update_user_password(
  user_email TEXT,
  new_password TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET password_hash = crypt(new_password, gen_salt('bf'))
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_finance_user(TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_password(TEXT, TEXT) TO anon, authenticated;



