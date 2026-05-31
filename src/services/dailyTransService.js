import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);


const isFinanceRole = (role) => FINANCE_ROLES.has(role);


const applyCompanyFilter = (query, currentUser) => {
  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    return query.eq('finance_company_id', currentUser.finance_company_id);
  }
  return query;
};


export const getDailyReceipts = async () => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  let query = supabase
    .from('daily_receipts')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });


  query = applyCompanyFilter(query, currentUser);


  const { data, error } = await query;
  if (error) throw error;


  return data || [];
};


export const createDailyReceipt = async (receipt) => {
  const currentUser = getCurrentUser();


  const payload = {
    ...receipt,
    finance_company_id: currentUser?.finance_company_id || null,
    created_by: currentUser?.id || null,
  };


  const { data, error } = await supabase
    .from('daily_receipts')
    .insert([payload])
    .select()
    .single();


  if (error) throw error;
  return data;
};


export const updateDailyReceipt = async (id, updates) => {
  const currentUser = getCurrentUser();


  let query = supabase
    .from('daily_receipts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }


  const { data, error } = await query;
  if (error) throw error;


  return data;
};


export const deleteDailyReceipt = async (id) => {
  const currentUser = getCurrentUser();


  let query = supabase
    .from('daily_receipts')
    .delete()
    .eq('id', id);


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }


  const { error } = await query;
  if (error) throw error;
};


export const getDailyPayments = async () => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  let query = supabase
    .from('daily_payments')
    .select('*')
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });


  query = applyCompanyFilter(query, currentUser);


  const { data, error } = await query;
  if (error) throw error;


  return data || [];
};


export const createDailyPayment = async (payment) => {
  const currentUser = getCurrentUser();


  const payload = {
    ...payment,
    finance_company_id: currentUser?.finance_company_id || null,
    created_by: currentUser?.id || null,
  };


  const { data, error } = await supabase
    .from('daily_payments')
    .insert([payload])
    .select()
    .single();


  if (error) throw error;
  return data;
};


export const updateDailyPayment = async (id, updates) => {
  const currentUser = getCurrentUser();


  let query = supabase
    .from('daily_payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }


  const { data, error } = await query;
  if (error) throw error;


  return data;
};


export const deleteDailyPayment = async (id) => {
  const currentUser = getCurrentUser();


  let query = supabase
    .from('daily_payments')
    .delete()
    .eq('id', id);


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }


  const { error } = await query;
  if (error) throw error;
};