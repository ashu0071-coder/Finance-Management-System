-- =====================================================
-- CLEAR ALL BUSINESS DATA, KEEP LOGIN CREDENTIALS
-- =====================================================
-- What this keeps:
--   - users table (email + password_hash credentials)
--   - finance_companies rows that are still referenced by users
--
-- What this clears:
--   - daily transactions, payments, extensions, notifications, loans, customers, audit logs, settings
--   - unreferenced finance_companies rows


BEGIN;


-- Child tables first
DELETE FROM public.daily_receipts;
DELETE FROM public.daily_payments;
DELETE FROM public.loan_extensions;
DELETE FROM public.notifications;
DELETE FROM public.payments;
DELETE FROM public.audit_log;


-- Parent transactional tables
DELETE FROM public.loans;
DELETE FROM public.customers;


-- Remove all settings data
DELETE FROM public.settings;


-- Recreate baseline settings so app logic remains stable after cleanup.
INSERT INTO public.settings (key, value, description)
VALUES
  ('default_interest_rate', '10', 'Default interest rate percentage'),
  ('default_loan_tenure_months', '3', 'Default loan tenure in months'),
  ('penalty_rate_annual', '80', 'Annual penalty rate percentage'),
  ('penalty_rate_monthly', '80', 'Monthly penalty rate percentage (legacy compatibility)'),
  ('days_per_month', '30', 'Days used for penalty calculation'),
  ('cash_in_bank', '0', 'Opening cash available in bank'),
  ('total_finance_amount', '0', 'Total capital available for lending (legacy compatibility)')
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();


-- Keep only tenant rows still needed by preserved user logins
DELETE FROM public.finance_companies fc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.users u
  WHERE u.finance_company_id = fc.id
);


COMMIT;


-- Verification summary
SELECT 'users' AS table_name, COUNT(*) AS remaining_rows FROM public.users
UNION ALL
SELECT 'finance_companies', COUNT(*) FROM public.finance_companies
UNION ALL
SELECT 'customers', COUNT(*) FROM public.customers
UNION ALL
SELECT 'loans', COUNT(*) FROM public.loans
UNION ALL
SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL
SELECT 'daily_receipts', COUNT(*) FROM public.daily_receipts
UNION ALL
SELECT 'daily_payments', COUNT(*) FROM public.daily_payments
UNION ALL
SELECT 'settings', COUNT(*) FROM public.settings
ORDER BY table_name;



