-- Update penalty calculation to use annual rate (80% per year / 365 days)
-- Instead of monthly rate (80% per month / 30 days)


-- Update settings
UPDATE settings SET
    key = 'penalty_rate_annual',
    description = 'Annual penalty rate percentage (applied as rate/365 per day)'
WHERE key = 'penalty_rate_monthly';


-- Remove days_per_month setting (no longer needed)
DELETE FROM settings WHERE key = 'days_per_month';


-- Update the calculate_penalty function
CREATE OR REPLACE FUNCTION calculate_penalty(
    p_total_loan_amount DECIMAL,
    p_due_date DATE,
    p_current_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
    v_days_overdue INTEGER;
    v_penalty_rate_annual DECIMAL;
    v_daily_penalty DECIMAL;
    v_total_penalty DECIMAL;
BEGIN
    -- Get annual penalty rate from settings
    SELECT CAST(value AS DECIMAL) INTO v_penalty_rate_annual
    FROM settings
    WHERE key = 'penalty_rate_annual';
   
    -- Default to 80% if not found
    IF v_penalty_rate_annual IS NULL THEN
        v_penalty_rate_annual := 80;
    END IF;
   
    -- Calculate days overdue
    v_days_overdue := GREATEST(0, p_current_date - p_due_date);
   
    IF v_days_overdue = 0 THEN
        RETURN 0;
    END IF;
   
    -- Calculate daily penalty using annual rate
    -- Formula: Daily Penalty = (Total Loan Amount × Annual Rate) / 365
    v_daily_penalty := (p_total_loan_amount * v_penalty_rate_annual / 100) / 365;
   
    -- Calculate total penalty
    -- Formula: Total Penalty = Daily Penalty × Days Overdue
    v_total_penalty := v_daily_penalty * v_days_overdue;
   
    RETURN ROUND(v_total_penalty, 2);
END;
$$ LANGUAGE plpgsql;


-- Add comment
COMMENT ON FUNCTION calculate_penalty IS 'Calculate penalty using annual rate: (Loan Amount × Annual Rate × Days Overdue) / 365';