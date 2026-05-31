-- =====================================================
-- LOAN MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =====================================================


-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================
-- SETTINGS TABLE
-- =====================================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
    ('default_interest_rate', '10', 'Default interest rate percentage'),
    ('default_loan_tenure_months', '3', 'Default loan tenure in months'),
    ('total_finance_amount', '0', 'Total capital available for lending'),
    ('penalty_rate_monthly', '80', 'Monthly penalty rate percentage'),
    ('days_per_month', '30', 'Days used for penalty calculation');


-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    reference_person_name VARCHAR(255) NOT NULL,
    reference_person_mobile VARCHAR(20) NOT NULL,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- Create index for mobile number search
CREATE INDEX idx_customers_mobile ON customers(mobile_number);
CREATE INDEX idx_customers_name ON customers(name);


-- =====================================================
-- LOANS TABLE
-- =====================================================
CREATE TYPE loan_status AS ENUM ('active', 'closed', 'overdue', 'defaulted', 'extended');


CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
   
    -- Loan Details
    loan_number VARCHAR(50) UNIQUE NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    interest_amount DECIMAL(15, 2) NOT NULL,
    bond_fee DECIMAL(15, 2) DEFAULT 0,
    total_loan_amount DECIMAL(15, 2) NOT NULL,
    net_disbursed_amount DECIMAL(15, 2) NOT NULL,
   
    -- Dates
    start_date DATE NOT NULL,
    original_due_date DATE NOT NULL,
    current_due_date DATE NOT NULL,
    closure_date DATE,
   
    -- Status
    status loan_status DEFAULT 'active',
    tenure_months INTEGER DEFAULT 3,
    extension_count INTEGER DEFAULT 0,
    missed_cycles INTEGER DEFAULT 0,
   
    -- Payments
    total_paid DECIMAL(15, 2) DEFAULT 0,
    outstanding_amount DECIMAL(15, 2) NOT NULL,
    penalty_amount DECIMAL(15, 2) DEFAULT 0,
   
    -- Documents
    cheque_numbers TEXT[],
    bond_document_url TEXT,
   
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
   
    CONSTRAINT principal_positive CHECK (principal_amount > 0),
    CONSTRAINT interest_positive CHECK (interest_amount >= 0),
    CONSTRAINT total_positive CHECK (total_loan_amount > 0)
);


-- Create indexes
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_due_date ON loans(current_due_date);
CREATE INDEX idx_loans_number ON loans(loan_number);


-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TYPE payment_type AS ENUM ('full', 'partial', 'extension', 'penalty');


CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
   
    -- Payment Details
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_type payment_type NOT NULL,
   
    -- Refund for early payment
    refund_amount DECIMAL(15, 2) DEFAULT 0,
    net_payment DECIMAL(15, 2) NOT NULL,
   
    -- Payment method
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(255),
   
    -- Metadata
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
   
    CONSTRAINT amount_positive CHECK (amount > 0)
);


-- Create indexes
CREATE INDEX idx_payments_loan ON payments(loan_id);
CREATE INDEX idx_payments_date ON payments(payment_date);


-- =====================================================
-- LOAN EXTENSIONS TABLE
-- =====================================================
CREATE TABLE loan_extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
   
    -- Extension Details
    extension_number INTEGER NOT NULL,
    previous_due_date DATE NOT NULL,
    new_due_date DATE NOT NULL,
    interest_paid DECIMAL(15, 2) NOT NULL,
    extension_date DATE NOT NULL,
   
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
   
    CONSTRAINT interest_paid_positive CHECK (interest_paid > 0)
);


-- Create indexes
CREATE INDEX idx_extensions_loan ON loan_extensions(loan_id);


-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TYPE notification_type AS ENUM ('due_reminder', 'overdue_alert', 'default_alert', 'payment_received', 'extension_granted');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');


CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
   
    -- Notification Details
    type notification_type NOT NULL,
    status notification_status DEFAULT 'pending',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    recipient_mobile VARCHAR(20),
   
    -- Scheduling
    scheduled_date DATE,
    sent_at TIMESTAMP WITH TIME ZONE,
   
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- Create indexes
CREATE INDEX idx_notifications_loan ON notifications(loan_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_date);


-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- 'loan', 'payment', 'customer', etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', etc.
    changes JSONB,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- Create indexes
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(performed_at);


-- =====================================================
-- FUNCTIONS
-- =====================================================


-- Function to generate loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    loan_num TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(loan_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM loans;
   
    loan_num := 'LN' || TO_CHAR(EXTRACT(YEAR FROM CURRENT_DATE), 'FM0000') || LPAD(next_number::TEXT, 4, '0');
    RETURN loan_num;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate monthly interest
CREATE OR REPLACE FUNCTION calculate_monthly_interest(
    principal DECIMAL,
    interest_rate DECIMAL,
    tenure_months INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN (principal * interest_rate / 100) / tenure_months;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate refund for early payment
CREATE OR REPLACE FUNCTION calculate_early_payment_refund(
    p_loan_id UUID,
    p_payment_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
    v_interest_amount DECIMAL;
    v_start_date DATE;
    v_tenure_months INTEGER;
    v_months_elapsed INTEGER;
    v_monthly_interest DECIMAL;
    v_refund DECIMAL := 0;
BEGIN
    -- Get loan details
    SELECT interest_amount, start_date, tenure_months
    INTO v_interest_amount, v_start_date, v_tenure_months
    FROM loans
    WHERE id = p_loan_id;
   
    -- Calculate months elapsed
    v_months_elapsed := EXTRACT(MONTH FROM AGE(p_payment_date, v_start_date));
   
    -- Calculate monthly interest
    v_monthly_interest := v_interest_amount / v_tenure_months;
   
    -- Calculate refund based on months elapsed
    IF v_months_elapsed <= 1 THEN
        v_refund := v_monthly_interest * 2;
    ELSIF v_months_elapsed <= 2 THEN
        v_refund := v_monthly_interest * 1;
    ELSE
        v_refund := 0;
    END IF;
   
    RETURN v_refund;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate penalty
CREATE OR REPLACE FUNCTION calculate_penalty(
    p_total_loan_amount DECIMAL,
    p_due_date DATE,
    p_current_date DATE
)
RETURNS DECIMAL AS $$
DECLARE
    v_days_overdue INTEGER;
    v_penalty_rate DECIMAL;
    v_days_per_month INTEGER;
    v_daily_penalty DECIMAL;
    v_total_penalty DECIMAL;
BEGIN
    -- Get settings
    SELECT CAST(value AS DECIMAL) INTO v_penalty_rate FROM settings WHERE key = 'penalty_rate_monthly';
    SELECT CAST(value AS INTEGER) INTO v_days_per_month FROM settings WHERE key = 'days_per_month';
   
    -- Calculate days overdue
    v_days_overdue := GREATEST(0, p_current_date - p_due_date);
   
    IF v_days_overdue = 0 THEN
        RETURN 0;
    END IF;
   
    -- Calculate daily penalty
    v_daily_penalty := (p_total_loan_amount * v_penalty_rate / 100) / v_days_per_month;
   
    -- Calculate total penalty
    v_total_penalty := v_daily_penalty * v_days_overdue;
   
    RETURN ROUND(v_total_penalty, 2);
END;
$$ LANGUAGE plpgsql;


-- Function to update loan status
CREATE OR REPLACE FUNCTION update_loan_status()
RETURNS TRIGGER AS $$
DECLARE
    v_current_penalty DECIMAL;
BEGIN
    -- Calculate current penalty if overdue
    IF NEW.current_due_date < CURRENT_DATE AND NEW.status IN ('active', 'overdue', 'extended') THEN
        v_current_penalty := calculate_penalty(NEW.total_loan_amount, NEW.current_due_date, CURRENT_DATE);
        NEW.penalty_amount := v_current_penalty;
        NEW.outstanding_amount := NEW.total_loan_amount - NEW.total_paid + v_current_penalty;
       
        -- Update status to overdue
        IF NEW.status = 'active' THEN
            NEW.status := 'overdue';
        END IF;
    END IF;
   
    -- Check for default (2 missed cycles, assuming 3 months per cycle)
    IF NEW.current_due_date < CURRENT_DATE THEN
        NEW.missed_cycles := FLOOR(EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.original_due_date)) / 3);
       
        IF NEW.missed_cycles >= 2 AND NEW.status != 'closed' THEN
            NEW.status := 'defaulted';
        END IF;
    END IF;
   
    -- Check if loan should be closed
    IF NEW.outstanding_amount <= 0 AND NEW.status != 'closed' THEN
        NEW.status := 'closed';
        NEW.closure_date := CURRENT_DATE;
    END IF;
   
    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Trigger for loan status updates
CREATE TRIGGER trigger_update_loan_status
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_status();


-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Triggers for updating timestamps
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================


-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;


-- Create policies (allow all for authenticated users - adjust based on your auth requirements)
CREATE POLICY "Allow all operations for authenticated users" ON customers
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON loans
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON payments
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON loan_extensions
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON notifications
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON audit_log
    FOR ALL USING (auth.role() = 'authenticated');


CREATE POLICY "Allow all operations for authenticated users" ON settings
    FOR ALL USING (auth.role() = 'authenticated');


-- =====================================================
-- VIEWS FOR DASHBOARD
-- =====================================================


-- Active loans summary
CREATE OR REPLACE VIEW v_active_loans_summary AS
SELECT
    COUNT(*) as total_active_loans,
    SUM(total_loan_amount) as total_loan_value,
    SUM(outstanding_amount) as total_outstanding,
    SUM(total_paid) as total_collected
FROM loans
WHERE status IN ('active', 'overdue', 'extended');


-- Overdue loans
CREATE OR REPLACE VIEW v_overdue_loans AS
SELECT
    l.id,
    l.loan_number,
    c.name as customer_name,
    c.mobile_number,
    l.total_loan_amount,
    l.outstanding_amount,
    l.current_due_date,
    l.penalty_amount,
    CURRENT_DATE - l.current_due_date as days_overdue
FROM loans l
JOIN customers c ON l.customer_id = c.id
WHERE l.status = 'overdue'
ORDER BY l.current_due_date;


-- Defaulted loans
CREATE OR REPLACE VIEW v_defaulted_loans AS
SELECT
    l.id,
    l.loan_number,
    c.name as customer_name,
    c.mobile_number,
    c.reference_person_name,
    c.reference_person_mobile,
    l.total_loan_amount,
    l.outstanding_amount,
    l.missed_cycles
FROM loans l
JOIN customers c ON l.customer_id = c.id
WHERE l.status = 'defaulted'
ORDER BY l.current_due_date;


-- Revenue summary
CREATE OR REPLACE VIEW v_revenue_summary AS
SELECT
    SUM(CASE WHEN status = 'closed' THEN interest_amount ELSE 0 END) as collected_interest,
    SUM(penalty_amount) as total_penalties,
    SUM(CASE WHEN status = 'closed' THEN interest_amount ELSE 0 END) +
    SUM(penalty_amount) as total_revenue
FROM loans;


-- =====================================================
-- END OF SCHEMA
-- =====================================================