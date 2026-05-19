import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, login as authLogin, logout as authLogout } from '../services/authService';


const AuthContext = createContext(null);


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    // Check for existing session on mount
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);


  const login = async (email, password) => {
    const user = await authLogin(email, password);
    setUser(user);
    return user;
  };


  const logout = () => {
    authLogout();
    setUser(null);
  };


  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isCustomer: user?.role === 'customer' || user?.role === 'finance' || user?.role === 'finance_manager' || user?.role === 'finance_member',
  };


  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};



