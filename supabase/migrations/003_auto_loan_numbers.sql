-- =====================================================
-- ADD TRIGGER FOR AUTO-GENERATING LOAN NUMBERS
-- =====================================================
-- This ensures loan_number is always generated automatically


-- Create trigger function to auto-generate loan number
CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if loan_number is not provided
    IF NEW.loan_number IS NULL THEN
        NEW.loan_number := generate_loan_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Create trigger that runs before insert
DROP TRIGGER IF EXISTS trigger_set_loan_number ON loans;
CREATE TRIGGER trigger_set_loan_number
    BEFORE INSERT ON loans
    FOR EACH ROW
    EXECUTE FUNCTION set_loan_number();



