import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);


const isFinanceRole = (role) => FINANCE_ROLES.has(role);


/**
 * Get all customers
 * Super admins see all, finance companies see only their borrowers
 */
export const getCustomers = async () => {
  const currentUser = getCurrentUser();


  // Finance users without company assignment must not see global data.
  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }
 
  let query = supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
 
  // Finance companies can only see their own borrowers
  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }
  // Super admin sees all
 
  const { data, error } = await query;
 
  if (error) throw error;
  return data;
};


/**
 * Get customer by ID
 * Validates access for finance role
 */
export const getCustomer = async (id) => {
  const currentUser = getCurrentUser();
 
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single();
 
  if (error) throw error;


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    throw new Error('Access denied: No finance company assigned');
  }
 
  // Validate access for finance companies
  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    if (data.finance_company_id !== currentUser.finance_company_id) {
      throw new Error('Access denied: You can only view your own borrowers');
    }
  }
 
  return data;
};


/**
 * Create new customer
 */
export const createCustomer = async (customer) => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Update customer
 */
export const updateCustomer = async (id, updates) => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Soft delete customer
 */
export const deleteCustomer = async (id) => {
  const { data, error } = await supabase
    .from('customers')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Search customers by name or mobile
 */
export const searchCustomers = async (searchTerm) => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  let query = supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${searchTerm}%,mobile_number.ilike.%${searchTerm}%`)
    .eq('is_active', true)
    .order('created_at', { ascending: false });


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }


  const { data, error } = await query;
 
  if (error) throw error;
  return data;
};