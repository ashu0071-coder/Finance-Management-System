-- =====================================================
-- UPDATE ALL EXISTING LOAN NUMBERS TO 10001, 10002, ...
-- Ordered by created_at (oldest first), then id for stable ordering.
-- This updates ONLY loans.loan_number.
-- =====================================================


BEGIN;


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



