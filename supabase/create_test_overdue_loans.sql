-- Create test data for overdue loans
-- Run this in Supabase SQL Editor


-- First, we need to get or create a finance_company_id
-- If you're logged in as a finance company, replace this with your actual finance_company_id
-- For super admin testing, we'll use NULL


DO $$
DECLARE
    v_customer_1_id UUID;
    v_customer_2_id UUID;
    v_loan_1_id UUID;
    v_loan_2_id UUID;
    v_finance_company_id UUID;
BEGIN
    -- Get the first finance company ID (or use NULL for super admin)
    SELECT id INTO v_finance_company_id FROM finance_companies LIMIT 1;
   
    -- Create Customer 1 (for 15 days overdue loan)
    INSERT INTO customers (
        name,
        mobile_number,
        reference_person_name,
        reference_person_mobile,
        finance_company_id,
        is_active
    ) VALUES (
        'Test Customer - 15 Days Overdue',
        '9876543210',
        'Reference Person 1',
        '9876543211',
        v_finance_company_id,
        true
    ) RETURNING id INTO v_customer_1_id;
   
    -- Create Customer 2 (for 45 days overdue loan)
    INSERT INTO customers (
        name,
        mobile_number,
        reference_person_name,
        reference_person_mobile,
        finance_company_id,
        is_active
    ) VALUES (
        'Test Customer - 45 Days Overdue',
        '9876543220',
        'Reference Person 2',
        '9876543221',
        v_finance_company_id,
        true
    ) RETURNING id INTO v_customer_2_id;
   
    -- Create Loan 1: 15 days overdue
    -- Principal: 10,000, Interest: 10%, Bond Fee: 0
    INSERT INTO loans (
        customer_id,
        finance_company_id,
        principal_amount,
        interest_rate,
        interest_amount,
        bond_fee,
        total_loan_amount,
        net_disbursed_amount,
        start_date,
        original_due_date,
        current_due_date,
        tenure_months,
        outstanding_amount,
        status
    ) VALUES (
        v_customer_1_id,
        v_finance_company_id,
        10000.00,
        10.00,
        1000.00,
        0.00,
        10000.00,
        9000.00,
        CURRENT_DATE - INTERVAL '3 months 15 days',  -- Started 3 months 15 days ago
        CURRENT_DATE - INTERVAL '15 days',           -- Due date was 15 days ago
        CURRENT_DATE - INTERVAL '15 days',           -- Current due date is 15 days ago
        3,
        10000.00,
        'overdue'
    ) RETURNING id INTO v_loan_1_id;
   
    -- Create Loan 2: 45 days overdue
    -- Principal: 15,000, Interest: 10%, Bond Fee: 500
    INSERT INTO loans (
        customer_id,
        finance_company_id,
        principal_amount,
        interest_rate,
        interest_amount,
        bond_fee,
        total_loan_amount,
        net_disbursed_amount,
        start_date,
        original_due_date,
        current_due_date,
        tenure_months,
        outstanding_amount,
        status
    ) VALUES (
        v_customer_2_id,
        v_finance_company_id,
        15000.00,
        10.00,
        1500.00,
        500.00,
        15500.00,
        13500.00,
        CURRENT_DATE - INTERVAL '4 months 15 days',  -- Started 4 months 15 days ago
        CURRENT_DATE - INTERVAL '45 days',           -- Due date was 45 days ago
        CURRENT_DATE - INTERVAL '45 days',           -- Current due date is 45 days ago
        3,
        15500.00,
        'overdue'
    ) RETURNING id INTO v_loan_2_id;
   
    -- Output the results
    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Customer 1 ID: %', v_customer_1_id;
    RAISE NOTICE 'Loan 1 ID (15 days overdue): %', v_loan_1_id;
    RAISE NOTICE 'Customer 2 ID: %', v_customer_2_id;
    RAISE NOTICE 'Loan 2 ID (45 days overdue): %', v_loan_2_id;
    RAISE NOTICE '';
    RAISE NOTICE 'Expected Penalties (at 80%% annual rate):';
    RAISE NOTICE 'Loan 1 (₹10,000): Daily = ₹21.92, After 15 days = ₹329';
    RAISE NOTICE 'Loan 2 (₹15,500): Daily = ₹33.97, After 45 days = ₹1,529';
END $$;


-- Verify the loans were created
SELECT
    l.loan_number,
    c.name as customer_name,
    l.total_loan_amount,
    l.current_due_date,
    CURRENT_DATE - l.current_due_date as days_overdue,
    l.status
FROM loans l
JOIN customers c ON l.customer_id = c.id
WHERE c.name LIKE '%Test Customer%'
ORDER BY l.created_at DESC;