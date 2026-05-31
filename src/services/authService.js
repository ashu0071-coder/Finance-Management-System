import { supabase } from '../lib/supabase';


/**
 * Login with email and password
 */
export const login = async (email, password) => {
  try {
    console.log('Attempting login for:', email);
   
    // Query the users table to verify credentials
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, finance_company_id')
      .eq('email', email);


    console.log('User query result:', { data, error });


    if (error) {
      console.error('Database error:', error);
      throw new Error('Database error: ' + error.message);
    }


    if (!data || data.length === 0) {
      throw new Error('No account found with this email. Please check your email or contact administrator.');
    }


    const user = data[0];


    // Verify password using pgcrypto
    const { data: authData, error: authError } = await supabase.rpc(
      'verify_user_password',
      { user_email: email, user_password: password }
    );


    console.log('Password verification result:', { authData, authError });


    if (authError) {
      console.error('Password verification error:', authError);
      throw new Error('Password verification failed: ' + authError.message);
    }


    if (!authData) {
      throw new Error('Invalid password. Please try again.');
    }


    // Fetch finance company name if user belongs to one
    let finance_company_name = null;
    if (user.finance_company_id) {
      const { data: companyData } = await supabase
        .from('finance_companies')
        .select('company_name')
        .eq('id', user.finance_company_id)
        .single();
      finance_company_name = companyData?.company_name || null;
    }


    // Store user session in localStorage
    const session = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        finance_company_id: user.finance_company_id,
        finance_company_name,
      },
      timestamp: new Date().toISOString(),
    };


    localStorage.setItem('finance_session', JSON.stringify(session));
   
    console.log('Login successful:', session.user);


    return session.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};


/**
 * Logout current user
 */
export const logout = () => {
  localStorage.removeItem('finance_session');
  window.location.href = '/login';
};


/**
 * Get current session
 */
export const getSession = () => {
  const sessionStr = localStorage.getItem('finance_session');
  if (!sessionStr) return null;


  try {
    const session = JSON.parse(sessionStr);
    // Check if session is older than 24 hours
    const sessionTime = new Date(session.timestamp);
    const now = new Date();
    const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);


    if (hoursDiff > 24) {
      logout();
      return null;
    }


    return session.user;
  } catch {
    return null;
  }
};


/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  return getSession() !== null;
};


/**
 * Check if user has super_admin role
 */
export const isSuperAdmin = () => {
  const user = getSession();
  return user?.role === 'super_admin';
};


/**
 * Check if user has admin role (legacy support)
 */
export const isAdmin = () => {
  const user = getSession();
  return user?.role === 'admin' || user?.role === 'super_admin';
};


/**
 * Check if user has finance role
 */
export const isFinance = () => {
  const user = getSession();
  return user?.role === 'finance';
};


/**
 * Check if user has customer role (legacy support - now called finance)
 */
export const isCustomer = () => {
  const user = getSession();
  return user?.role === 'customer' || user?.role === 'finance';
};


/**
 * Get current user
 */
export const getCurrentUser = () => {
  return getSession();
};