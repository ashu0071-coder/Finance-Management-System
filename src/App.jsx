import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import SuperAdminDashboard from './components/Dashboard/SuperAdminDashboard';
import FinanceDashboard from './components/Dashboard/FinanceDashboard';
import CustomerList from './components/Customers/CustomerList';
import CustomerForm from './components/Customers/CustomerForm';
import LoanList from './components/Loans/LoanList';
import LoanForm from './components/Loans/LoanForm';
import LoanDetail from './components/Loans/LoanDetail';
import PaymentForm from './components/Payments/PaymentForm';
import DailyTrans from './components/DailyTrans/DailyTrans';
import Settings from './components/Settings/Settings';
import FinanceCompanyList from './components/FinanceCompanies/FinanceCompanyList';
import FinanceCompanyForm from './components/FinanceCompanies/FinanceCompanyForm';


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
       
        {/* Root redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
       
        {/* Admin Routes - For super_admin role */}
        <Route path="/admin/*" element={
          <ProtectedRoute requiredRole="super_admin">
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Layout>
                <Routes>
                  <Route path="dashboard" element={<SuperAdminDashboard />} />
                 
                  {/* Finance Company Management */}
                  <Route path="finance-companies" element={<FinanceCompanyList />} />
                  <Route path="finance-companies/new" element={<FinanceCompanyForm />} />
                  <Route path="finance-companies/:id/edit" element={<FinanceCompanyForm />} />
                  <Route path="finance-companies/:id" element={<FinanceCompanyList />} />
                 
                  {/* Customer Management (Borrowers - for all companies) */}
                  <Route path="customers" element={<CustomerList />} />
                  <Route path="customers/new" element={<CustomerForm />} />
                  <Route path="customers/:id/edit" element={<CustomerForm />} />
                 
                  {/* Loan Management (for all companies) */}
                  <Route path="loans" element={<LoanList />} />
                  <Route path="loans/new" element={<LoanForm />} />
                  <Route path="loans/:id" element={<LoanDetail />} />
                  <Route path="loans/:id/payment" element={<PaymentForm />} />
                  <Route path="daily-trans" element={<DailyTrans />} />
                 
                  {/* Settings */}
                  <Route path="settings" element={<Settings />} />
                 
                  {/* Default redirect */}
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </Routes>
              </Layout>
            </Box>
          </ProtectedRoute>
        } />
       
        {/* Finance Company Routes - For finance role */}
        <Route path="/finance/*" element={
          <ProtectedRoute requiredRole="finance">
            <Box sx={{ display: 'flex', minHeight: '100vh' }}>
              <Layout>
                <Routes>
                  <Route path="dashboard" element={<FinanceDashboard />} />
                 
                  {/* Borrower Management - Only for finance_manager and finance */}
                  <Route path="customers" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <CustomerList />
                    </ProtectedRoute>
                  } />
                  <Route path="customers/new" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <CustomerForm />
                    </ProtectedRoute>
                  } />
                  <Route path="customers/:id/edit" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <CustomerForm />
                    </ProtectedRoute>
                  } />
                 
                  {/* Loan Management - Only for finance_manager and finance */}
                  <Route path="loans" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <LoanList />
                    </ProtectedRoute>
                  } />
                  <Route path="loans/new" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <LoanForm />
                    </ProtectedRoute>
                  } />
                  <Route path="loans/:id" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <LoanDetail />
                    </ProtectedRoute>
                  } />
                  <Route path="loans/:id/payment" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <PaymentForm />
                    </ProtectedRoute>
                  } />
                  <Route path="daily-trans" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <DailyTrans />
                    </ProtectedRoute>
                  } />
                 
                  {/* Settings - Only for finance_manager and finance */}
                  <Route path="settings" element={
                    <ProtectedRoute requiredRole="finance_manager">
                      <Settings />
                    </ProtectedRoute>
                  } />
                 
                  {/* Default redirect */}
                  <Route path="*" element={<Navigate to="/finance/dashboard" replace />} />
                </Routes>
              </Layout>
            </Box>
          </ProtectedRoute>
        } />
       
        {/* Legacy Customer Routes - Redirect to finance */}
        <Route path="/customer/*" element={
          <Navigate to="/finance/dashboard" replace />
        } />
       
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}


export default App;