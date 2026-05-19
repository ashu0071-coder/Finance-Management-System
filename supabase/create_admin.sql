-- Create Admin User
-- Email: asiftahashildar0071@gmail.com
-- Password: Asif@123


INSERT INTO users (email, password_hash, role)
VALUES (
  'asiftahashildar0071@gmail.com',
  crypt('Asif@123', gen_salt('bf')),
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET password_hash = crypt('Asif@123', gen_salt('bf'));


-- Verify the user was created
SELECT id, email, role, created_at
FROM users
WHERE email = 'asiftahashildar0071@gmail.com';



