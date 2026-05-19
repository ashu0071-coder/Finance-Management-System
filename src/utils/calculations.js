/**
 * Calculate interest amount from total loan amount
 * Formula: Interest = Total Loan × Interest Rate / 100
 * Example: Total Loan ₹50,000 @ 10% = ₹5,000
 */
export const calculateInterest = (totalLoanAmount, interestRate = 10) => {
  return (totalLoanAmount * interestRate) / 100;
};


/**
 * Calculate bond fee (fixed amount from settings)
 * Default: ₹300
 */
export const calculateBondFee = (bondFeeAmount = 300) => {
  const parsedBondFee = Number(bondFeeAmount);
  return Number.isFinite(parsedBondFee) ? parsedBondFee : 300;
};


/**
 * Calculate net disbursed amount (what customer receives in hand)
 * Formula: Net Disbursed = Total Loan - Interest
 * Example: Total Loan ₹50,000 - Interest ₹5,000 = ₹45,000 disbursed
 */
export const calculateNetDisbursement = (totalLoanAmount, interestAmount) => {
  return totalLoanAmount - interestAmount;
};


/**
 * Calculate monthly interest
 */
export const calculateMonthlyInterest = (interest, tenureMonths = 3) => {
  return interest / tenureMonths;
};


/**
 * Calculate early payment refund
 * IMPORTANT: Bond fee is NON-REFUNDABLE. Only interest portion is refundable.
 *
 * How it works:
 * - If bond fee is properly stored in DB, use it directly
 * - If bond fee is 0 or missing (older records), use fallback bond fee from settings
 *
 * Example with ₹2,000 total charges:
 * - Total charges (interest_amount): ₹2,000
 * - Bond fee (from setting): ₹300 (non-refundable)
 * - Pure interest: ₹2,000 - ₹300 = ₹1,700 (refundable)
 * - Monthly Interest: ₹1,700 ÷ 3 = ₹566.67/month
 * - Paid in 1 month, 2 months remaining
 * - Refund: ₹566.67 × 2 = ₹1,133.33
 */
export const calculateEarlyPaymentRefund = (
  startDate,
  interestAmount,
  tenureMonths,
  paymentDate,
  bondFee = 0,
  fallbackBondFee = 300
) => {
  // Calculate months elapsed from start to payment date
  const monthsElapsed = calculateMonthsElapsed(startDate, paymentDate);
 
  // If paid after or at the tenure period, no refund
  if (monthsElapsed >= tenureMonths) {
    return 0;
  }
 
  // If bond fee is missing on old loans, use configured fallback bond fee from settings.
  const actualBondFee = bondFee > 0 ? bondFee : fallbackBondFee;
 
  // Calculate refundable interest (excluding bond fee which is never refunded)
  const refundableInterest = Math.max(interestAmount - actualBondFee, 0);
 
  // Calculate monthly interest from refundable portion only
  const monthlyInterest = refundableInterest / tenureMonths;
 
  // Calculate months remaining (unused)
  const monthsRemaining = tenureMonths - monthsElapsed;
 
  // Refund = monthly interest × months remaining
  return monthlyInterest * monthsRemaining;
};


/**
 * Calculate penalty for late payment
 * Daily penalty = (Total Loan Amount × Annual Penalty Rate) / 365
 * Formula: Total Penalty = Total Loan Amount × Penalty Days × Penalty Rate / 365
 */
export const calculatePenalty = (totalLoanAmount, dueDate, currentDate, penaltyRateAnnual = 80) => {
  const due = new Date(dueDate);
  const current = new Date(currentDate);
 
  if (current <= due) {
    return 0;
  }
 
  const daysOverdue = Math.floor((current - due) / (1000 * 60 * 60 * 24));
  const dailyPenalty = (totalLoanAmount * penaltyRateAnnual / 100) / 365;
 
  return dailyPenalty * daysOverdue;
};


/**
 * Calculate outstanding amount
 */
export const calculateOutstanding = (totalLoanAmount, totalPaid, penaltyAmount = 0) => {
  return totalLoanAmount - totalPaid + penaltyAmount;
};


/**
 * Calculate new due date for extension (add 3 months)
 */
export const calculateExtendedDueDate = (currentDueDate, monthsToAdd = 3) => {
  const due = new Date(currentDueDate);
  due.setMonth(due.getMonth() + monthsToAdd);
  return due;
};


/**
 * Calculate months elapsed since loan start
 */
export const calculateMonthsElapsed = (startDate, currentDate = new Date()) => {
  const start = new Date(startDate);
  const current = new Date(currentDate);
 
  const yearsDiff = current.getFullYear() - start.getFullYear();
  const monthsDiff = current.getMonth() - start.getMonth();
 
  return yearsDiff * 12 + monthsDiff;
};


/**
 * Calculate missed cycles (each cycle is 3 months)
 */
export const calculateMissedCycles = (originalDueDate, currentDate = new Date()) => {
  const due = new Date(originalDueDate);
  const current = new Date(currentDate);
 
  if (current <= due) {
    return 0;
  }
 
  const monthsOverdue = calculateMonthsElapsed(due, current);
  return Math.floor(monthsOverdue / 3);
};


/**
 * Check if loan should be defaulted (2 or more missed cycles)
 */
export const shouldBeDefaulted = (missedCycles) => {
  return missedCycles >= 2;
};


/**
 * Format currency
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};


/**
 * Format date
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};


/**
 * Get loan status color
 */
export const getLoanStatusColor = (status) => {
  const colors = {
    active: 'success',
    closed: 'default',
    overdue: 'warning',
    defaulted: 'error',
    extended: 'info',
  };
  return colors[status] || 'default';
};


/**
 * Calculate days until due date
 */
export const getDaysUntilDue = (dueDate) => {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};


/**
 * Calculate all loan values at once for new loan
 */
export const calculateLoanValues = (principal, bondFee, startDate, interestRate = 10, tenureMonths = 3) => {
  const interest = calculateInterest(principal, interestRate);
  const netDisbursed = calculateNetDisbursement(principal, interest);
  const totalLoanAmount = calculateTotalLoanAmount(principal, bondFee);
 
  const start = new Date(startDate);
  const dueDate = new Date(start);
  dueDate.setMonth(dueDate.getMonth() + tenureMonths);
 
  return {
    interestAmount: interest,
    netDisbursedAmount: netDisbursed,
    totalLoanAmount: totalLoanAmount,
    dueDate: dueDate.toISOString().split('T')[0],
    outstandingAmount: totalLoanAmount,
  };
};


/**
 * Calculate loan details for form display
 * User enters Total Loan Amount, system calculates interest and net disbursed
 * Note: Bond fee is a fixed amount from settings (default ₹300)
 */
export const calculateLoanDetails = (totalLoanAmount, interestRate, tenureMonths = 3, bondFeeAmount = 300) => {
  const interest_amount = calculateInterest(totalLoanAmount, interestRate);
  const bond_fee = calculateBondFee(bondFeeAmount); // Fixed bond fee amount
  const net_disbursed_amount = calculateNetDisbursement(totalLoanAmount, interest_amount);
  const monthly_interest = calculateMonthlyInterest(interest_amount, tenureMonths);
 
  return {
    interest_amount: Number(interest_amount.toFixed(2)),
    bond_fee: Number(bond_fee.toFixed(2)), // Still track internally for early payment refunds
    net_disbursed_amount: Number(net_disbursed_amount.toFixed(2)),
    total_loan_amount: Number(totalLoanAmount.toFixed(2)),
    monthly_interest: Number(monthly_interest.toFixed(2)),
  };
};





