/**
 * Calculate interest amount from total loan amount
 * Formula: Interest = Total Loan × Interest Rate / 100
 * Example: Total Loan ₹50,000 @ 9% = ₹4,500
 */
export const calculateInterest = (totalLoanAmount, interestRate = 9) => {
  return Math.round((totalLoanAmount * interestRate) / 100);
};


/**
 * Calculate bond fee as 1% of loan amount (fixed, non-configurable)
 * Example: Loan ₹10,000 → Bond Fee = ₹100
 */
export const calculateBondFee = (totalLoanAmount) => {
  return Math.round(totalLoanAmount * 0.01);
};


/**
 * Calculate net disbursed amount (what customer receives in hand)
 * Formula: Net Disbursed = Total Loan - Interest - Bond Fee
 * Example: Total Loan ₹10,000 - Interest ₹900 (9%) - Bond Fee ₹100 (1%) = ₹9,000 disbursed
 */
export const calculateNetDisbursement = (totalLoanAmount, interestAmount, bondFee) => {
  return Math.round(totalLoanAmount - interestAmount - bondFee);
};


/**
 * Calculate monthly interest
 */
export const calculateMonthlyInterest = (interest, tenureMonths = 3) => {
  return Math.round(interest / tenureMonths);
};


/**
 * Calculate early payment refund
 * IMPORTANT: Bond fee is NON-REFUNDABLE. Only interest portion is refundable.
 *
 * Bond fee = 1% of loan amount (fixed, non-refundable)
 * Pure interest = interest_amount - bond_fee (refundable proportionally)
 *
 * Example with loan ₹10,000, interest_rate 9%, bond_fee ₹100:
 * - Total charges (interest_amount): ₹1,000 (10% total = 9% interest + 1% bond)
 * - Bond fee: ₹100 (non-refundable)
 * - Pure interest: ₹900 (refundable)
 * - Monthly Interest: ₹300/month
 * - Paid in 1 month, 2 months remaining
 * - Refund: ₹300 × 2 = ₹600
 */
export const calculateEarlyPaymentRefund = (
  startDate,
  interestAmount,
  tenureMonths,
  paymentDate,
  bondFee = 0,
  fallbackBondFee = 0
) => {
  // Calculate months elapsed from start to payment date
  const monthsElapsed = calculateMonthsElapsed(startDate, paymentDate);
 
  // If paid after or at the tenure period, no refund
  if (monthsElapsed >= tenureMonths) {
    return 0;
  }
 
  // interestAmount already stores only the interest component.
  // Bond fee is stored separately and remains non-refundable.
  const refundableInterest = Math.max(interestAmount, 0);
 
  // Calculate monthly interest from refundable portion only
  const monthlyInterest = refundableInterest / tenureMonths;
 
  // Calculate months remaining (unused)
  const monthsRemaining = tenureMonths - monthsElapsed;
 
  // Refund = monthly interest × months remaining
  return Math.round(monthlyInterest * monthsRemaining);
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
 
  return Math.round(dailyPenalty * daysOverdue);
};


/**
 * Calculate outstanding amount
 */
export const calculateOutstanding = (totalLoanAmount, totalPaid, penaltyAmount = 0) => {
  return Math.round(totalLoanAmount - totalPaid + penaltyAmount);
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
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
 * User enters Total Loan Amount and Interest Rate, system calculates:
 * - Bond Fee: fixed 1% of loan amount (non-configurable)
 * - Interest Amount: based on interest rate (e.g. 9%)
 * - Total Deduction: Bond Fee + Interest (e.g. 10% total if interest is 9%)
 * - Net Disbursed: Loan Amount - Interest - Bond Fee
 *
 * Example: Loan ₹10,000 @ 9% interest
 *   Bond Fee = 1% = ₹100
 *   Interest = 9% = ₹900
 *   Total Deduction = ₹1,000 (10%)
 *   Net Disbursed = ₹9,000
 */
export const calculateLoanDetails = (totalLoanAmount, interestRate, tenureMonths = 3) => {
  const interest_amount = calculateInterest(totalLoanAmount, interestRate);
  const bond_fee = calculateBondFee(totalLoanAmount); // 1% of loan amount
  const net_disbursed_amount = calculateNetDisbursement(totalLoanAmount, interest_amount, bond_fee);
  const monthly_interest = calculateMonthlyInterest(interest_amount, tenureMonths);
 
  return {
    interest_amount,
    bond_fee,
    net_disbursed_amount,
    total_loan_amount: Math.round(totalLoanAmount),
    monthly_interest,
  };
};





