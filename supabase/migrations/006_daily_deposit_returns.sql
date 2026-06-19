-- Deposit return ledger for DailyTrans module
-- Archives returned deposits and removes the active receipt in one transaction.


CREATE TABLE IF NOT EXISTS public.daily_deposit_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finance_company_id UUID REFERENCES finance_companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    daily_receipt_id UUID,
    name TEXT NOT NULL,
    principal_amount DECIMAL(15, 2) NOT NULL CHECK (principal_amount >= 0),
    interest_amount DECIMAL(15, 2) NOT NULL CHECK (interest_amount >= 0),
    return_amount DECIMAL(15, 2) NOT NULL CHECK (return_amount >= 0),
    entry_date DATE NOT NULL,
    closing_date DATE NOT NULL,
    period_days INTEGER NOT NULL CHECK (period_days > 0),
    percentage DECIMAL(10, 2) NOT NULL CHECK (percentage >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_daily_deposit_returns_company_date
    ON public.daily_deposit_returns (finance_company_id, closing_date DESC);


DROP TRIGGER IF EXISTS daily_deposit_returns_updated_at ON public.daily_deposit_returns;
CREATE TRIGGER daily_deposit_returns_updated_at
    BEFORE UPDATE ON public.daily_deposit_returns
    FOR EACH ROW EXECUTE FUNCTION update_daily_trans_updated_at_column();


ALTER TABLE public.daily_deposit_returns ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Allow all operations" ON public.daily_deposit_returns;


CREATE POLICY "Allow all operations" ON public.daily_deposit_returns
    FOR ALL USING (true) WITH CHECK (true);


CREATE OR REPLACE FUNCTION public.return_daily_deposit(
    p_receipt_id UUID,
    p_finance_company_id UUID,
    p_created_by UUID,
    p_return_amount DECIMAL,
    p_interest_amount DECIMAL,
    p_closing_date DATE
)
RETURNS public.daily_deposit_returns
LANGUAGE plpgsql
AS $$
DECLARE
    source_receipt public.daily_receipts%ROWTYPE;
    inserted_return public.daily_deposit_returns%ROWTYPE;
BEGIN
    SELECT *
    INTO source_receipt
    FROM public.daily_receipts
    WHERE id = p_receipt_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit record not found';
    END IF;


    IF p_finance_company_id IS NOT NULL
       AND source_receipt.finance_company_id IS DISTINCT FROM p_finance_company_id THEN
        RAISE EXCEPTION 'Access denied for selected deposit';
    END IF;


    INSERT INTO public.daily_deposit_returns (
        finance_company_id,
        created_by,
        daily_receipt_id,
        name,
        principal_amount,
        interest_amount,
        return_amount,
        entry_date,
        closing_date,
        period_days,
        percentage
    )
    VALUES (
        source_receipt.finance_company_id,
        p_created_by,
        source_receipt.id,
        source_receipt.name,
        source_receipt.deposit_amount,
        GREATEST(0, p_interest_amount),
        GREATEST(0, p_return_amount),
        source_receipt.entry_date,
        p_closing_date,
        source_receipt.period_days,
        source_receipt.percentage
    )
    RETURNING * INTO inserted_return;


    DELETE FROM public.daily_receipts
    WHERE id = source_receipt.id;


    RETURN inserted_return;
END;
$$;