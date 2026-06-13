import { supabase } from '../lib/supabase';
import { getCurrentUser } from './authService';


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
    .select('amount');


  let loansQuery = supabase
    .from('loans')
    .select('total_loan_amount, net_disbursed_amount, total_paid, outstanding_amount');


  if (financeCompanyId) {
    receiptsQuery = receiptsQuery.eq('finance_company_id', financeCompanyId);
    paymentsQuery = paymentsQuery.eq('finance_company_id', financeCompanyId);
    loansQuery = loansQuery.eq('finance_company_id', financeCompanyId);
  }


  const [{ data: receipts, error: receiptsError }, { data: payments, error: paymentsError }, { data: loans, error: loansError }] = await Promise.all([
    receiptsQuery,
    paymentsQuery,
    loansQuery,
  ]);


  if (receiptsError) throw receiptsError;
  if (paymentsError) throw paymentsError;
  if (loansError) throw loansError;


  const totalDepositReceipts = (receipts || [])
    .filter((record) => !String(record?.name || '').startsWith(BANK_AMOUNT_NAME_PREFIX))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);


  const totalBankAmountReceipts = (receipts || [])
    .filter((record) => String(record?.name || '').startsWith(BANK_AMOUNT_NAME_PREFIX))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);


  const totalDailyPaymentOutflow = (payments || []).reduce(
    (sum, record) => sum + toSafeNumber(record.amount),
    0
  );


  const totalLoanOutflow = (loans || []).reduce(
    (sum, loan) => sum + toSafeNumber(loan.outstanding_amount),
    0
  );


  const totalLoanExtraCollection = (loans || []).reduce((sum, loan) => {
    const loanAmount = toSafeNumber(loan.total_loan_amount);
    const netDisbursed = toSafeNumber(loan.net_disbursed_amount);
    const paid = toSafeNumber(loan.total_paid);


    const upfrontDeduction = Math.max(0, loanAmount - netDisbursed);
    const overCollection = Math.max(0, paid - loanAmount);
    return sum + upfrontDeduction + overCollection;
  }, 0);


  const availableCashInHand =
    totalDepositReceipts +
    totalBankAmountReceipts -
    totalDailyPaymentOutflow -
    totalLoanOutflow +
    totalLoanExtraCollection;


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
 * Generate loan number
 */
const generateLoanNumber = async () => {
  // Get the count of existing loans
  const { data, error } = await supabase
    .from('loans')
    .select('loan_number', { count: 'exact', head: false })
    .order('created_at', { ascending: false })
    .limit(1);
 
  if (error && error.code !== 'PGRST116') throw error;
 
  // Generate loan number: LN + YEAR + sequential number (padded to 4 digits)
  const year = new Date().getFullYear();
  const nextNumber = (data && data.length > 0) ? extractNumberFromLoanNumber(data[0].loan_number) + 1 : 1;
  const loanNumber = `LN${year}${String(nextNumber).padStart(4, '0')}`;
 
  return loanNumber;
};


/**
 * Extract number from loan number (e.g., "LN202600001" -> 1)
 */
const extractNumberFromLoanNumber = (loanNumber) => {
  if (!loanNumber) return 0;
  // Extract last 4 digits
  const match = loanNumber.match(/(\d{4})$/);
  return match ? Number.parseInt(match[1], 10) : 0;
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


  // Generate loan number
  const loanNumber = await generateLoanNumber();
 
  const { data, error } = await supabase
    .from('loans')
    .insert([{ ...loan, loan_number: loanNumber }])
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