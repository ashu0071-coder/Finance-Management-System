# Setup Guide - Loan Management System


## Complete Installation Steps


### Step 1: Prerequisites


Ensure you have the following installed:
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- A modern web browser (Chrome, Firefox, Edge, or Safari)
- A Supabase account (free tier works)


### Step 2: Download and Install


1. **Extract the project**
   ```bash
   cd "Finance Management"
   ```


2. **Install dependencies**
   ```bash
   npm install
   ```


   This will install:
   - React and React DOM
   - Material-UI components
   - Supabase client
   - React Router
   - Date utilities
   - Chart libraries


### Step 3: Supabase Setup


#### Create Supabase Project


1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - Project name: "Loan Management"
   - Database password: (create a strong password)
   - Region: Choose closest to you
5. Wait for project to be created (1-2 minutes)


#### Get API Credentials


1. In your Supabase project dashboard
2. Click on **Settings** (gear icon) in left sidebar
3. Click on **API**
4. Copy two values:
   - **Project URL** (starts with https://)
   - **anon public** key under "Project API keys"


#### Run Database Migration


1. In Supabase dashboard, click on **SQL Editor** in left sidebar
2. Click "New Query"
3. Open file: `supabase/migrations/001_initial_schema.sql`
4. Copy entire contents and paste into SQL Editor
5. Click "Run" button (or press Ctrl+Enter)
6. You should see "Success. No rows returned"


#### Verify Database Setup


1. Click on **Table Editor** in left sidebar
2. You should see these tables:
   - customers
   - loans
   - payments
   - loan_extensions
   - notifications
   - settings
   - audit_log


### Step 4: Environment Configuration


1. In project root, create a file named `.env`
2. Add your Supabase credentials:


```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```


**Important**: Replace the values with your actual credentials from Step 3.


### Step 5: Update Row Level Security (RLS) Policies


For development, you can disable RLS or update the policies:


**Option A - Disable RLS (for development only)**
Run this in SQL Editor:
```sql
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE loan_extensions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
```


**Option B - Allow all authenticated users**
The migration already includes this, but verify policies exist.


### Step 6: Start the Application


```bash
npm run dev
```


You should see:
```
VITE v5.x.x  ready in xxx ms


  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```


Open your browser and go to: **http://localhost:5173**


### Step 7: Initial Configuration


1. Click on **Settings** in the sidebar
2. Review and adjust default values:
   - Default Interest Rate: 10% (recommended)
   - Default Loan Tenure: 3 months
   - Monthly Penalty Rate: 80% (adjust as needed)
   - Days Per Month: 30
3. Click **Save Settings**


### Step 8: Test the Application


#### Create First Customer
1. Go to **Customers** → **Add Customer**
2. Fill in:
   - Name: "Test Customer"
   - Mobile: "9876543210"
   - Reference Person Name: "Test Reference"
   - Reference Mobile: "9876543211"
3. Click **Save**


#### Create First Loan
1. Go to **Loans** → **New Loan**
2. Select the test customer
3. Enter:
   - Principal Amount: 10000
   - Interest Rate: 10
   - Bond Fee: 500
   - Start Date: Today
4. Review calculations:
   - Interest: ₹1,000 (10% of 10,000)
   - Bond Fee: ₹500
   - Net Disbursed: ₹9,000 (10,000 - 1,000)
   - Total Loan: ₹10,500 (10,000 + 500)
5. Click **Create Loan**


#### Record a Payment
1. Click on the loan you just created
2. Click **Make Payment**
3. Enter payment amount: 10500
4. Select payment method: Cash
5. Click **Record Payment**
6. Loan should be marked as **CLOSED**


## Troubleshooting


### Issue: "Missing Supabase environment variables"


**Solution**:
- Check that `.env` file exists in root directory
- Verify variable names start with `VITE_`
- Restart development server after creating .env file


### Issue: "Failed to load customers" or database errors


**Solution**:
- Verify SQL migration ran successfully
- Check Supabase project is not paused
- Verify RLS policies are configured correctly
- Check browser console for specific errors


### Issue: Calculations seem wrong


**Solution**:
- Verify settings in Settings page
- Check that interest rate is a percentage (10 for 10%, not 0.1)
- Review calculation logic in `src/utils/calculations.js`


### Issue: White screen or application won't load


**Solution**:
- Check browser console for errors
- Verify all npm packages installed correctly
- Clear browser cache
- Try `npm install` again


## Production Deployment


### Using Vercel (Recommended)


1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard
5. Deploy


### Using Netlify


1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. New site from Git
4. Add environment variables
5. Deploy


### Environment Variables for Production


Add these in your hosting platform:
```
VITE_SUPABASE_URL=your_production_url
VITE_SUPABASE_ANON_KEY=your_production_key
```


## Security Recommendations


### For Production Use:


1. **Enable RLS Policies**
   - Never disable RLS in production
   - Implement proper row-level security


2. **Add Authentication**
   - Implement Supabase Auth
   - Require login before accessing app
   - Add role-based access control


3. **API Keys**
   - Never commit .env file to Git
   - Use service role key only on server
   - Rotate keys periodically


4. **Backup**
   - Enable daily backups in Supabase
   - Export data regularly
   - Keep migration files updated


## Support


If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for JavaScript errors
3. Review this guide carefully
4. Check GitHub issues for similar problems


## Next Steps


After successful setup:
- Customize settings for your use case
- Add more customers and loans
- Explore dashboard analytics
- Configure automatic notifications (future feature)
- Customize UI theme in `src/main.jsx`


---


**Congratulations! Your Loan Management System is ready to use.** 🎉



