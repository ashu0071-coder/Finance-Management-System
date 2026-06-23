-- =====================================================
-- STANDARDIZE LOAN NUMBERS TO 10001, 10002, ...
-- 1) Updates all existing loans (oldest first) to a pure numeric sequence.
-- 2) Replaces DB auto-number function so future loans continue this sequence.
-- =====================================================


BEGIN;


LOCK TABLE public.loans IN ACCESS EXCLUSIVE MODE;


-- Step 0: Ensure future inserts also use numeric sequence from 10001.
CREATE OR REPLACE FUNCTION public.generate_loan_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
BEGIN
    SELECT GREATEST(
      COALESCE(MAX((regexp_replace(loan_number, '\\D', '', 'g'))::INTEGER), 0) + 1,
      10001
    )
    INTO next_number
    FROM public.loans
    WHERE loan_number IS NOT NULL
      AND regexp_replace(loan_number, '\\D', '', 'g') <> '';


    RETURN next_number::TEXT;
END;
$$ LANGUAGE plpgsql;


-- Step 1: Temporary unique values to avoid unique-key conflicts during remap.
UPDATE public.loans
SET loan_number = 'TMP-' || id::text;


-- Step 2: Assign final sequential numbers starting from 10001.
WITH ordered_loans AS (
  SELECT
    id,
    (10000 + ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC))::text AS new_loan_number
  FROM public.loans
)
UPDATE public.loans l
SET loan_number = o.new_loan_number
FROM ordered_loans o
WHERE l.id = o.id;


COMMIT;


-- Verification (read-only)
SELECT id, loan_number, created_at
FROM public.loans
ORDER BY created_at ASC, id ASC;