import Dashboard from './Dashboard';


/**
 * Wrapper component that routes to the appropriate dashboard
 * based on the user's finance role:
 * - finance_manager & finance: Full Dashboard with all features
 * - finance_member: Dashboard with limited view (read-only)
 */
const FinanceDashboard = () => {
  // All finance roles now see the Dashboard
  // finance_member has restricted navigation via Layout component
  return <Dashboard />;
};


export default FinanceDashboard;



