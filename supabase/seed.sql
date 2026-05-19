-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================


-- Insert sample customers
INSERT INTO customers (name, mobile_number, reference_person_name, reference_person_mobile, address) VALUES
    ('John Doe', '9876543210', 'Jane Doe', '9876543211', '123 Main Street, City'),
    ('Alice Smith', '9876543212', 'Bob Smith', '9876543213', '456 Oak Avenue, Town'),
    ('Charlie Brown', '9876543214', 'Lucy Brown', '9876543215', '789 Pine Road, Village');


-- Insert sample loans
INSERT INTO loans (
    customer_id,
    loan_number,
    principal_amount,
    interest_rate,
    interest_amount,
    bond_fee,
    total_loan_amount,
    net_disbursed_amount,
    start_date,
    original_due_date,
    current_due_date,
    outstanding_amount,
    status
)
SELECT
    c.id,
    generate_loan_number(),
    50000.00,
    10.00,
    5000.00,
    2000.00,
    52000.00,
    45000.00,
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '75 days',
    CURRENT_DATE + INTERVAL '75 days',
    52000.00,
    'active'
FROM customers c
WHERE c.name = 'John Doe';


INSERT INTO loans (
    customer_id,
    loan_number,
    principal_amount,
    interest_rate,
    interest_amount,
    bond_fee,
    total_loan_amount,
    net_disbursed_amount,
    start_date,
    original_due_date,
    current_due_date,
    outstanding_amount,
    total_paid,
    status
)
SELECT
    c.id,
    generate_loan_number(),
    100000.00,
    10.00,
    10000.00,
    5000.00,
    105000.00,
    90000.00,
    CURRENT_DATE - INTERVAL '95 days',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '5 days',
    105000.00,
    0.00,
    'overdue'
FROM customers c
WHERE c.name = 'Alice Smith';



