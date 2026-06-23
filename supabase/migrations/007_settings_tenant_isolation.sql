-- Enforce tenant-isolated settings so each finance company has independent values.


ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS finance_company_id UUID REFERENCES public.finance_companies(id) ON DELETE CASCADE;


-- Remove duplicate rows within each scope (global or tenant), keeping the latest row.
WITH ranked_settings AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY key, COALESCE(finance_company_id::text, 'GLOBAL_SCOPE')
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.settings
)
DELETE FROM public.settings s
USING ranked_settings r
WHERE s.id = r.id
  AND r.rn > 1;


-- Drop legacy uniqueness on key that causes cross-tenant value sharing.
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_key_key;
DROP INDEX IF EXISTS public.settings_key_key;


-- Enforce one global row per key (optional) and one tenant row per key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_unique_global_key
ON public.settings (key)
WHERE finance_company_id IS NULL;


CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_unique_tenant_key
ON public.settings (key, finance_company_id)
WHERE finance_company_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS idx_settings_finance_company_id
ON public.settings (finance_company_id);


-- Seed required setting keys for every finance company that is missing them.
WITH default_settings AS (
  SELECT *
  FROM (
    VALUES
      ('default_interest_rate', '10', 'Default interest rate percentage'),
      ('default_loan_tenure_months', '3', 'Default loan tenure in months'),
      ('penalty_rate_annual', '80', 'Annual penalty rate percentage'),
      ('cash_in_bank', '0', 'Current cash available in bank')
  ) AS ds(key, value, description)
)
INSERT INTO public.settings (
  key,
  value,
  description,
  finance_company_id,
  created_at,
  updated_at
)
SELECT
  ds.key,
  ds.value,
  ds.description,
  fc.id,
  TIMEZONE('utc'::text, NOW()),
  TIMEZONE('utc'::text, NOW())
FROM public.finance_companies fc
CROSS JOIN default_settings ds
LEFT JOIN public.settings s
  ON s.finance_company_id = fc.id
 AND s.key = ds.key
WHERE s.id IS NULL;