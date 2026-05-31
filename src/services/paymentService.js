import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);


const isFinanceRole = (role) => FINANCE_ROLES.has(role);


/**
 * Create payment record
 * Allowed roles: super_admin, finance_manager
 */
export const createPayment = async (payment) => {
  const currentUser = getCurrentUser();
 
  // Allow super_admin, finance, and finance_manager to create payments
  const allowedRoles = ['super_admin', 'finance', 'finance_manager'];
  if (!currentUser || !allowedRoles.includes(currentUser.role)) {
    throw new Error('Access denied: You do not have permission to record payments');
  }


  if (isFinanceRole(currentUser.role) && !currentUser.finance_company_id) {
    throw new Error('Access denied: No finance company assigned');
  }


  if (isFinanceRole(currentUser.role)) {
    const { data: loanAccessData, error: loanAccessError } = await supabase
      .from('loans')
      .select('id')
      .eq('id', payment.loan_id)
      .eq('finance_company_id', currentUser.finance_company_id)
      .single();


    if (loanAccessError || !loanAccessData) {
      throw new Error('Access denied: You can only record payments for your own company loans');
    }
  }
 
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();
 
  if (error) throw error;
 
  // Update loan's total_paid and outstanding_amount
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', payment.loan_id)
    .single();
 
  if (loanError) throw loanError;
 
  const newTotalPaid = Number.parseFloat(loan.total_paid) + Number.parseFloat(payment.net_payment);
  // Derive outstanding from canonical values to avoid compounding drift.
  const newOutstanding = Number.parseFloat(loan.total_loan_amount) - newTotalPaid;
 
  const updates = {
    total_paid: newTotalPaid,
    outstanding_amount: Math.max(0, newOutstanding)
  };
 
  // If fully paid, close the loan
  if (newOutstanding <= 0) {
    updates.status = 'closed';
    updates.closure_date = new Date().toISOString().split('T')[0];
  }
 
  const { error: updateError } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', payment.loan_id);
 
  if (updateError) throw updateError;
 
  return data;
};


/**
 * Get payments for a loan
 */
export const getPaymentsByLoan = async (loanId) => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  if (isFinanceRole(currentUser?.role)) {
    const { data: loanAccessData, error: loanAccessError } = await supabase
      .from('loans')
      .select('id')
      .eq('id', loanId)
      .eq('finance_company_id', currentUser.finance_company_id)
      .single();


    if (loanAccessError || !loanAccessData) {
      return [];
    }
  }


  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('loan_id', loanId)
    .order('payment_date', { ascending: false });
 
  if (error) throw error;
  return data;
};


/**
 * Get all payments
 */
export const getAllPayments = async () => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }


  let query = supabase
    .from('payments')
    .select(`
      *,
      loans (
        finance_company_id,
        loan_number,
        customers (
          name
        )
      )
    `)
    .order('payment_date', { ascending: false })
    .limit(100);


  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('loans.finance_company_id', currentUser.finance_company_id);
  }


  const { data, error } = await query;
 
  if (error) throw error;
  return data;
};