import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';


const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();


  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress size={50} />
      </Box>
    );
  }


  if (!user) {
    return <Navigate to="/login" replace />;
  }


  if (requiredRole) {
    // Role matching with support for new finance roles
    const hasAccess =
      user.role === requiredRole ||
      (requiredRole === 'super_admin' && user.role === 'admin') ||
      (requiredRole === 'admin' && user.role === 'super_admin') ||
      // Allow finance_manager and finance (backward compat) for finance routes
      (requiredRole === 'finance' && (user.role === 'finance_manager' || user.role === 'finance_member' || user.role === 'finance')) ||
      // Allow finance (old role) to access finance_manager routes for backward compatibility
      (requiredRole === 'finance_manager' && user.role === 'finance') ||
      (requiredRole === 'customer' && user.role === 'finance');


    if (!hasAccess) {
      // Redirect to appropriate dashboard based on user's actual role
      let redirectPath = '/admin/dashboard';
     
      if (user.role === 'super_admin' || user.role === 'admin') {
        redirectPath = '/admin/dashboard';
      } else if (user.role === 'finance' || user.role === 'finance_manager' || user.role === 'finance_member') {
        redirectPath = '/finance/dashboard';
      }
     
      return <Navigate to={redirectPath} replace />;
    }
  }


  return children;
};


export default ProtectedRoute;