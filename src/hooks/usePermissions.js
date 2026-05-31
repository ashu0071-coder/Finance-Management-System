import { useAuth } from '../contexts/AuthContext';


/**
 * Hook to check if user has permission to perform actions
 * Members (finance_member) can only view, not modify
 */
export const usePermissions = () => {
  const { user } = useAuth();


  const isManager = user?.role === 'super_admin' || user?.role === 'finance_manager' || user?.role === 'finance';
  const isMember = user?.role === 'finance_member';
  const isSuperAdmin = user?.role === 'super_admin';


  return {
    canCreate: isManager,
    canEdit: isManager,
    canDelete: isManager,
    canViewOnly: isMember,
    isSuperAdmin,
    isManager,
    isMember,
  };
};