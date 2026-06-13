# Loan Management System


A comprehensive loan management web application built with React and Supabase that handles loan issuance, interest calculation, repayment tracking, extensions, penalties, and default handling.


## Features


- **Customer Management**: Add, edit, and track customer details with reference persons
- **Loan Management**: Create and manage loans with automatic interest calculation
- **Payment Tracking**: Record payments, calculate refunds, and apply penalties
- **Dashboard**: Real-time analytics and loan status overview
- **Notifications**: Due date reminders and overdue alerts
- **History Tracking**: Complete audit trail of all loan activities


## Tech Stack


- **Frontend**: React.js with Material-UI (MUI)
- **Backend**: Supabase (Authentication, Database, Real-time)
- **Database**: PostgreSQL (via Supabase)


## Loan Calculation Logic


### Interest & Disbursement
- Interest: 10% of principal (deducted upfront)
- Net disbursement: Principal - Interest
- Total loan: Principal + Bond Fee


### Early Repayment Refunds
- Repaid within 1 month: Refund 2/3 of interest
- Repaid within 2 months: Refund 1/3 of interest
- Repaid after 3 months: No refund


### Late Payment Penalty
- Daily penalty applied after due date
- Calculated on total loan amount
- Configurable penalty rate


### Loan Extension
- Pay full interest before due date
- Extends due date by 3 months
- Can extend multiple times


### Default Rule
- Marked as default after 2 missed due cycles
- Reference person becomes liable


## Project Structure


```
Finance Management/
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── functions/
│   └── seed.sql
├── src/
│   ├── components/
│   │   ├── customers/
│   │   ├── loans/
│   │   ├── payments/
│   │   └── dashboard/
│   ├── services/
│   ├── utils/
│   ├── hooks/
│   ├── contexts/
│   └── App.jsx
├── public/
└── package.json
```


## Setup Instructions


### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Supabase account


### 1. Supabase Setup


1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run all migration files in order from `supabase/migrations`
3. Make sure `supabase/migrations/005_explicit_data_api_grants.sql` is applied (required for explicit Data API exposure behavior)
4. Note your project URL and anon key from Project Settings > API


### Reset Data But Keep Login Credentials


If you want to clear all business/transactional data while keeping login credentials, run:


`supabase/clear_data_keep_logins.sql`


This script keeps rows in `users` (email/password hash), clears customers/loans/payments/daily transactions, recreates baseline settings, and removes only unreferenced `finance_companies` rows.


### Clear Only App-Entered Data (Keep Login, Companies, Settings)


If you only want to clear data entered through the app (loans, customers, payments, daily amount entries), run:


`supabase/clear_app_data_only.sql`


This keeps `users` and `finance_companies`, and resets app-managed settings values (including `cash_in_bank`) to defaults.


### 2. Environment Configuration


Create a `.env` file in the root directory:


```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```


### 3. Install Dependencies


```bash
npm install
```


### 4. Run Development Server


```bash
npm run dev
```


The application will be available at `http://localhost:5173`


## Usage


### Creating a Loan


1. Navigate to Customers and add a new customer with reference details
2. Go to Loans and click "New Loan"
3. Fill in loan details (principal, bond fee, start date)
4. System automatically calculates interest and net disbursement
5. Submit to create the loan


### Recording Payments


1. Navigate to active loan
2. Click "Record Payment"
3. Enter payment amount and date
4. System automatically calculates refunds or applies penalties
5. Loan status updates accordingly


### Extending a Loan


1. Open an active loan before due date
2. Click "Extend Loan"
3. Pay full interest amount
4. Due date extends by 3 months


## Database Schema


### Tables
- `customers`: Customer and reference person details
- `loans`: Loan records with principal, interest, dates
- `payments`: Payment history
- `loan_extensions`: Extension history
- `notifications`: System notifications
- `settings`: Configurable system settings


## API Integration


The app uses Supabase client for all backend operations:
- Real-time subscriptions for live updates
- Row Level Security for data protection
- Automatic API generation


## Development


### Available Scripts


- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint


## Contributing


1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request


## License


MIT License - feel free to use this project for your needs.


## Support


For issues or questions, please create an issue in the repository.