-- Daily transaction module
-- Adds receipt and payment tables for daybook operations


CREATE TABLE IF NOT EXISTS public.daily_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    deposit_amount DECIMAL(15, 2) NOT NULL CHECK (deposit_amount >= 0),
    entry_date DATE NOT NULL,
    period_days INTEGER NOT NULL CHECK (period_days > 0),
    percentage DECIMAL(10, 2) NOT NULL CHECK (percentage >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS public.daily_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_type TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    payment_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_daily_receipts_company_date
    ON public.daily_receipts (finance_company_id, entry_date DESC);


CREATE INDEX IF NOT EXISTS idx_daily_payments_company_date
    ON public.daily_payments (finance_company_id, payment_date DESC);


-- Dedicated timestamp trigger function for DailyTrans module isolation
CREATE OR REPLACE FUNCTION update_daily_trans_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS daily_receipts_updated_at ON public.daily_receipts;
CREATE TRIGGER daily_receipts_updated_at
    BEFORE UPDATE ON public.daily_receipts
    FOR EACH ROW EXECUTE FUNCTION update_daily_trans_updated_at_column();


DROP TRIGGER IF EXISTS daily_payments_updated_at ON public.daily_payments;
CREATE TRIGGER daily_payments_updated_at
    BEFORE UPDATE ON public.daily_payments
    FOR EACH ROW EXECUTE FUNCTION update_daily_trans_updated_at_column();


-- Development policy pattern used in this repo
ALTER TABLE public.daily_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_payments ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Allow all operations" ON public.daily_receipts;
DROP POLICY IF EXISTS "Allow all operations" ON public.daily_payments;


CREATE POLICY "Allow all operations" ON public.daily_receipts
    FOR ALL USING (true) WITH CHECK (true);


CREATE POLICY "Allow all operations" ON public.daily_payments
    FOR ALL USING (true) WITH CHECK (true);