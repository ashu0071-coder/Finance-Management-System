-- Fix outstanding amount drift and penalty base calculation
-- Run this in Supabase SQL Editor


-- 1) Ensure trigger calculates penalty on remaining outstanding, not original total loan.
CREATE OR REPLACE FUNCTION update_loan_status()
RETURNS TRIGGER AS $$
DECLARE
    v_current_penalty DECIMAL;
    v_base_outstanding DECIMAL;
BEGIN
    -- Outstanding should always be principal balance after all payment credits.
    v_base_outstanding := GREATEST(NEW.total_loan_amount - NEW.total_paid, 0);
    NEW.outstanding_amount := v_base_outstanding;


    -- Calculate penalty only for open overdue loans and only on remaining outstanding.
    IF NEW.status IN ('active', 'overdue', 'extended', 'defaulted')
       AND NEW.current_due_date < CURRENT_DATE
       AND v_base_outstanding > 0 THEN
        v_current_penalty := calculate_penalty(v_base_outstanding, NEW.current_due_date, CURRENT_DATE);
        NEW.penalty_amount := v_current_penalty;


        IF NEW.status = 'active' THEN
            NEW.status := 'overdue';
        END IF;
    ELSE
        NEW.penalty_amount := 0;
    END IF;


    -- Check default threshold (2+ missed 3-month cycles).
    IF NEW.status IN ('active', 'overdue', 'extended', 'defaulted')
       AND NEW.current_due_date < CURRENT_DATE THEN
        NEW.missed_cycles := FLOOR(EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.original_due_date)) / 3);


        IF NEW.missed_cycles >= 2 THEN
            NEW.status := 'defaulted';
        END IF;
    END IF;


    -- Close loan if no outstanding balance remains.
    IF NEW.outstanding_amount <= 0 AND NEW.status != 'closed' THEN
        NEW.status := 'closed';
        NEW.closure_date := CURRENT_DATE;
        NEW.penalty_amount := 0;
    END IF;


    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 2) One-time backfill: recompute total_paid/outstanding/penalty from payment history for all loans.
WITH payment_totals AS (
    SELECT
        l.id AS loan_id,
        COALESCE(SUM(p.net_payment), 0) AS total_net_payment
    FROM loans l
    LEFT JOIN payments p ON p.loan_id = l.id
    GROUP BY l.id
)
UPDATE loans l
SET
    total_paid = pt.total_net_payment,
    outstanding_amount = GREATEST(l.total_loan_amount - pt.total_net_payment, 0),
    penalty_amount = CASE
        WHEN l.status IN ('active', 'overdue', 'extended', 'defaulted')
             AND l.current_due_date < CURRENT_DATE
             AND GREATEST(l.total_loan_amount - pt.total_net_payment, 0) > 0
        THEN calculate_penalty(
            GREATEST(l.total_loan_amount - pt.total_net_payment, 0),
            l.current_due_date,
            CURRENT_DATE
        )
        ELSE 0
    END,
    status = CASE
        WHEN GREATEST(l.total_loan_amount - pt.total_net_payment, 0) <= 0 THEN 'closed'
        ELSE l.status
    END,
    closure_date = CASE
        WHEN GREATEST(l.total_loan_amount - pt.total_net_payment, 0) <= 0
            THEN COALESCE(l.closure_date, CURRENT_DATE)
        ELSE l.closure_date
    END,
    updated_at = TIMEZONE('utc'::text, NOW())
FROM payment_totals pt
WHERE l.id = pt.loan_id;