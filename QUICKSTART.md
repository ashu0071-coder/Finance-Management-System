# Quick Start Guide


## Prerequisites
- Node.js 18+ installed
- Supabase account


## 5-Minute Setup


### 1. Install Dependencies
```bash
npm install
```


### 2. Setup Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run `supabase/migrations/001_initial_schema.sql`


### 3. Configure Environment
Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```


### 4. Disable RLS (Development Only)
In Supabase SQL Editor:
```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE loan_extensions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
```


### 5. Start Application
```bash
npm run dev
```


Open http://localhost:5173


## First Steps


1. **Settings** → Configure default interest rate and penalties
2. **Customers** → Add a customer
3. **Loans** → Create first loan
4. **Dashboard** → View analytics


## Features


### Creating a Loan
- Principal: Base loan amount
- Interest Rate: Default 10% (deducted upfront)
- Bond Fee: Additional security fee
- Net Disbursed = Principal - Interest
- Total Loan = Principal + Bond Fee


### Making Payments
- **Full Payment**: Pays entire outstanding
- **Partial Payment**: Pays portion of outstanding
- **Early Payment**: Automatic refund calculation
  - Within 1 month: 2 × monthly interest refund
  - Within 2 months: 1 × monthly interest refund


### Penalties
- Applied daily after due date
- Formula: (Total Loan × Penalty Rate) / 30
- Configurable in Settings


### Loan Extension
- Customer must pay full interest before due date
- Extends due date by original tenure (default 3 months)
- Can extend multiple times


### Default Status
- Triggered after 2 missed payment cycles
- Reference person becomes liable
- System alerts for follow-up


## Key Points


✅ Interest deducted upfront from principal
✅ Early repayment = refunds
✅ Late payment = penalties
✅ Extensions allowed before due date
✅ Auto-default after 2 missed cycles


## Support


- Check SETUP_GUIDE.md for detailed instructions
- Review README.md for complete documentation
- Check browser console for errors
- Verify Supabase connection in Settings


## Production Checklist


⚠️ Before going live:
- [ ] Enable RLS policies
- [ ] Add authentication
- [ ] Update security settings
- [ ] Configure backups
- [ ] Test all workflows
- [ ] Update environment variables


---


**Happy Lending! 💰**



