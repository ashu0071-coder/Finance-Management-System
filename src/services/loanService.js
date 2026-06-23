import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';
import { calculateCashSummary } from '../utils/dailyTransCalculations';


const FINANCE_ROLES = new Set(['finance', 'finance_manager', 'finance_member']);
const BANK_AMOUNT_NAME_PREFIX = 'BANK_AMOUNT:';


const isFinanceRole = (role) => FINANCE_ROLES.has(role);


const toSafeNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};


const getAvailableCashInHand = async (financeCompanyId) => {
  let receiptsQuery = supabase
    .from('daily_receipts')
    .select('name, deposit_amount');


  let paymentsQuery = supabase
    .from('daily_payments')
    .select('amount, payment_type');


  let depositReturnsQuery = supabase
    .from('daily_deposit_returns')
    .select('principal_amount, return_amount');


  let loansQuery = supabase
    .from('loans')
    .select('total_loan_amount, net_disbursed_amount, total_paid, outstanding_amount');


  if (financeCompanyId) {
    receiptsQuery = receiptsQuery.eq('finance_company_id', financeCompanyId);
    paymentsQuery = paymentsQuery.eq('finance_company_id', financeCompanyId);
    depositReturnsQuery = depositReturnsQuery.eq('finance_company_id', financeCompanyId);
    loansQuery = loansQuery.eq('finance_company_id', financeCompanyId);
  }


  const [
    { data: receipts, error: receiptsError },
    { data: payments, error: paymentsError },
    { data: depositReturns, error: depositReturnsError },
    { data: loans, error: loansError },
  ] = await Promise.all([
    receiptsQuery,
    paymentsQuery,
    depositReturnsQuery,
    loansQuery,
  ]);


  if (receiptsError) throw receiptsError;
  if (paymentsError) throw paymentsError;
  if (depositReturnsError) throw depositReturnsError;
  if (loansError) throw loansError;


  const availableCashInHand = calculateCashSummary({
    receipts,
    payments,
    loans,
    depositReturns,
  }).rawCashInHand;


  return Math.max(0, availableCashInHand);
};


/**
 * Get all loans with customer details
 * Automatically filters by finance_company_id for finance role users
 */
export const getLoans = async (filters = {}) => {
  const currentUser = getCurrentUser();


  // Finance users without company assignment must not see global data.
  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    return [];
  }
 
  let query = supabase
    .from('loans')
    .select(`
      *,
      customers (
        id,
        name,
        mobile_number,
        reference_person_name,
        reference_person_mobile
      )
    `)
    .order('created_at', { ascending: false});
 
  // If user is a finance company, only show their loans
  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    query = query.eq('finance_company_id', currentUser.finance_company_id);
  }
  // Super admin sees all loans
 
  // Apply additional filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.customer_id) {
    query = query.eq('customer_id', filters.customer_id);
  }
 
  const { data, error } = await query;
 
  if (error) throw error;
  return data;
};


/**
 * Get loan by ID with all related data
 * Validates access based on user role
 */
export const getLoan = async (id) => {
  const currentUser = getCurrentUser();
 
  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      customers (
        id,
        name,
        mobile_number,
        reference_person_name,
        reference_person_mobile,
        address
      ),
      payments (
        id,
        payment_date,
        amount,
        payment_type,
        refund_amount,
        net_payment,
        payment_method,
        transaction_reference,
        notes,
        created_at
      ),
      loan_extensions (
        id,
        extension_number,
        previous_due_date,
        new_due_date,
        interest_paid,
        extension_date,
        notes
      )
    `)
    .eq('id', id)
    .single();
 
  if (error) throw error;


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    throw new Error('Access denied: No finance company assigned');
  }


  // Validate access for finance companies
  if (isFinanceRole(currentUser?.role) && currentUser?.finance_company_id) {
    if (data.finance_company_id !== currentUser.finance_company_id) {
      throw new Error('Access denied: You can only view your own loans');
    }
  }
 
  // Validate access for customers
  if (currentUser?.role === 'customer' && currentUser?.customer_id) {
    if (data.customer_id !== currentUser.customer_id) {
      throw new Error('Access denied: You can only view your own loans');
    }
  }
 
  return data;
};


/**
 * Create new loan
 */
export const createLoan = async (loan) => {
  const currentUser = getCurrentUser();


  if (isFinanceRole(currentUser?.role) && !currentUser?.finance_company_id) {
    throw new Error('Access denied: No finance company assigned');
  }


  const targetFinanceCompanyId = loan.finance_company_id || currentUser?.finance_company_id || null;


  const netDisbursed = toSafeNumber(loan.net_disbursed_amount);
  const totalLoanAmount = toSafeNumber(loan.total_loan_amount);
  const requiredDisbursedAmount = netDisbursed > 0 ? netDisbursed : totalLoanAmount;


  if (requiredDisbursedAmount > 0) {
    const availableCashInHand = await getAvailableCashInHand(targetFinanceCompanyId);


    if (availableCashInHand < requiredDisbursedAmount) {
      throw new Error(
        `Insufficient cash in hand. Available ₹${Math.round(availableCashInHand).toLocaleString('en-IN')}, required ₹${Math.round(requiredDisbursedAmount).toLocaleString('en-IN')}.`
      );
    }
  }


  const { data, error } = await supabase
    .from('loans')
    // Loan number is generated in DB trigger/function to keep sequence atomic.
    .insert([{ ...loan }])
    .select(`
      *,
      customers (
        id,
        name,
        mobile_number
      )
    `)
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Update loan
 */
export const updateLoan = async (id, updates) => {
  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Delete loan by ID
 * Deleting a loan automatically removes related payments/extensions via DB cascade.
 */
export const deleteLoan = async (id) => {
  const currentUser = getCurrentUser();


  if (!currentUser) {
    throw new Error('Access denied: Please login first');
  }


  if (!(currentUser.role === 'super_admin' || currentUser.role === 'finance_manager' || currentUser.role === 'finance')) {
    throw new Error('Access denied: You do not have permission to delete loans');
  }


  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('id, finance_company_id')
    .eq('id', id)
    .single();


  if (loanError) {
    throw loanError;
  }


  if (isFinanceRole(currentUser.role) && currentUser.finance_company_id) {
    if (loan.finance_company_id !== currentUser.finance_company_id) {
      throw new Error('Access denied: You can only delete loans from your own finance company');
    }
  }


  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', id);


  if (error) throw error;
  return true;
};


/**
 * Get overdue loans
 */
export const getOverdueLoans = async () => {
  const { data, error } = await supabase
    .from('v_overdue_loans')
    .select('*');
 
  if (error) throw error;
  return data;
};


/**
 * Get defaulted loans
 */
export const getDefaultedLoans = async () => {
  const { data, error } = await supabase
    .from('v_defaulted_loans')
    .select('*');
 
  if (error) throw error;
  return data;
};


/**
 * Get active loans summary
 */
export const getActiveLoansSummary = async () => {
  const { data, error } = await supabase
    .from('v_active_loans_summary')
    .select('*')
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Get revenue summary
 */
export const getRevenueSummary = async () => {
  const { data, error } = await supabase
    .from('v_revenue_summary')
    .select('*')
    .single();
 
  if (error) throw error;
  return data;
};


/**
 * Extend loan
 */
export const extendLoan = async (loanId, notes = '') => {
  // Get loan details
  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select('*')
    .eq('id', loanId)
    .single();
 
  if (loanError) throw loanError;
 
  // Calculate new due date (add tenure months)
  const currentDueDate = new Date(loan.current_due_date);
  const newDueDate = new Date(currentDueDate);
  newDueDate.setMonth(newDueDate.getMonth() + loan.tenure_months);
 
  // Create extension record
  const extensionData = {
    loan_id: loanId,
    extension_number: loan.extension_count + 1,
    previous_due_date: loan.current_due_date,
    new_due_date: newDueDate.toISOString().split('T')[0],
    interest_paid: loan.interest_amount,
    extension_date: new Date().toISOString().split('T')[0],
    notes: notes,
  };
 
  const { error: extensionError } = await supabase
    .from('loan_extensions')
    .insert([extensionData]);
 
  if (extensionError) throw extensionError;
 
  // Update loan with new due date
  const { data: updatedLoan, error: updateError } = await supabase
    .from('loans')
    .update({
      current_due_date: extensionData.new_due_date,
      extension_count: loan.extension_count + 1,
      status: 'extended'
    })
    .eq('id', loanId)
    .select()
    .single();
 
  if (updateError) throw updateError;
  return updatedLoan;
};