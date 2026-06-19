export const BANK_AMOUNT_NAME_PREFIX = 'BANK_AMOUNT:';


export const isBankAmountReceipt = (record) =>
  typeof record?.name === 'string' && record.name.startsWith(BANK_AMOUNT_NAME_PREFIX);


const toSafeNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};


export const calculateCashSummary = ({ receipts = [], payments = [], loans = [], depositReturns = [] }) => {
  const totalDepositReceipts = receipts
    .filter((record) => !isBankAmountReceipt(record))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);


  const totalBankAmountReceipts = receipts
    .filter((record) => isBankAmountReceipt(record))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);


  const totalDailyPaymentOutflow = payments.reduce(
    (sum, record) => sum + toSafeNumber(record.amount),
    0
  );


  const totalBankAccountPaymentInflow = payments.reduce((sum, record) => {
    const paymentType = String(record.payment_type || '').trim().toLowerCase();
    return paymentType === 'bank account' ? sum + toSafeNumber(record.amount) : sum;
  }, 0);


  const totalLoanOutflow = loans.reduce(
    (sum, loan) => sum + toSafeNumber(loan.outstanding_amount),
    0
  );


  const totalLoanExtraCollection = loans.reduce((sum, loan) => {
    const loanAmount = toSafeNumber(loan.total_loan_amount);
    const netDisbursed = toSafeNumber(loan.net_disbursed_amount);
    const paid = toSafeNumber(loan.total_paid);
    const upfrontDeduction = Math.max(0, loanAmount - netDisbursed);
    const overCollection = Math.max(0, paid - loanAmount);
    return sum + upfrontDeduction + overCollection;
  }, 0);


  const totalReturnedDepositPrincipal = depositReturns.reduce(
    (sum, record) => sum + toSafeNumber(record.principal_amount),
    0
  );


  const totalDepositReturnOutflow = depositReturns.reduce(
    (sum, record) => sum + toSafeNumber(record.return_amount),
    0
  );


  const rawCashInHand =
    totalDepositReceipts +
    totalReturnedDepositPrincipal +
    totalBankAmountReceipts -
    totalDailyPaymentOutflow -
    totalLoanOutflow +
    totalLoanExtraCollection -
    totalDepositReturnOutflow;


  return {
    totalDepositReceipts,
    totalBankAmountReceipts,
    totalDailyPaymentOutflow,
    totalBankAccountPaymentInflow,
    totalLoanOutflow,
    totalLoanExtraCollection,
    totalReturnedDepositPrincipal,
    totalDepositReturnOutflow,
    rawCashInHand,
  };
};


export const isWithinDateRange = (recordDate, fromDate, toDate) => {
  if (fromDate && recordDate < fromDate) {
    return false;
  }
  if (toDate && recordDate > toDate) {
    return false;
  }
  return true;
}; 