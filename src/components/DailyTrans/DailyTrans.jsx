import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { format, differenceInCalendarDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  createDailyPayment,
  createDailyReceipt,
  deleteDailyPayment,
  deleteDailyReceipt,
  getDailyPayments,
  getDailyReceipts,
  updateDailyPayment,
  updateDailyReceipt,
} from '../../services/dailyTransService';
import { getLoans } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';


const todayISO = () => new Date().toISOString().split('T')[0];
const BANK_AMOUNT_NAME_PREFIX = 'BANK_AMOUNT:';
const TRANSACTION_TYPE_OPTIONS = [
  'Salary',
  'Stationery',
  'Pigmy Deposit',
  'Misc',
  'Rent',
  'Direct Divident',
  'Travelling Exp',
  'Other Exp',
  'Bank Account',
];


const isBankAmountReceipt = (record) =>
  typeof record?.name === 'string' && record.name.startsWith(BANK_AMOUNT_NAME_PREFIX);


const buildBankAmountReceiptName = (type) => `${BANK_AMOUNT_NAME_PREFIX}${type}`;


const parseBankAmountType = (name) => {
  if (typeof name !== 'string') {
    return '';
  }
  return name.startsWith(BANK_AMOUNT_NAME_PREFIX)
    ? name.slice(BANK_AMOUNT_NAME_PREFIX.length).trim()
    : '';
};


const formatTransactionType = (value) => {
  if (!value) {
    return '';
  }


  const normalizedValue = String(value).trim();
  if (/^direct[\s_-]*deposit$/i.test(normalizedValue) || /^directDeposit$/i.test(normalizedValue)) {
    return 'Direct Divident';
  }


  if (TRANSACTION_TYPE_OPTIONS.includes(normalizedValue)) {
    return normalizedValue;
  }


  const spaced = normalizedValue
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();


  return spaced
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};


const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};


const calculateAccruedInterest = (depositAmount, startDate, periodDays, percentage, asOfDate) => {
  const principal = toNumber(depositAmount);
  const period = Math.max(1, Math.round(toNumber(periodDays)));
  const rate = toNumber(percentage);
  const start = new Date(startDate);
  const asOf = new Date(asOfDate);


  if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime())) {
    return 0;
  }


  const elapsedDays = Math.max(0, differenceInCalendarDays(asOf, start));
  const cappedDays = Math.min(elapsedDays, period);


  // Full period interest = deposit * percentage / 100. Accrued linearly day by day.
  const fullPeriodInterest = (principal * rate) / 100;
  const accrued = fullPeriodInterest * (cappedDays / period);


  return Math.round(accrued);
};


export default function DailyTrans() {
  const [activeTab, setActiveTab] = useState('receipt');
  const [receiptTab, setReceiptTab] = useState('deposit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [now, setNow] = useState(new Date());


  const [receiptForm, setReceiptForm] = useState({
    name: '',
    deposit_amount: '',
    entry_date: todayISO(),
    period_days: '',
    percentage: '',
  });


  const [paymentForm, setPaymentForm] = useState({
    payment_type: '',
    amount: '',
    payment_date: todayISO(),
  });


  const [bankAmountForm, setBankAmountForm] = useState({
    type: '',
    amount: '',
    date: todayISO(),
  });


  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loans, setLoans] = useState([]);
  const [cashInBankBase, setCashInBankBase] = useState(0);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [receiptFilters, setReceiptFilters] = useState({
    search: '',
    fromDate: '',
    toDate: '',
  });
  const [paymentFilters, setPaymentFilters] = useState({
    type: '',
    fromDate: '',
    toDate: '',
  });


  useEffect(() => {
    fetchData();
  }, []);


  useEffect(() => {
    // Re-render once per minute so interest stays fresh as day changes.
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);


    return () => clearInterval(timer);
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [receiptData, paymentData, loansData, settingsData] = await Promise.all([
        getDailyReceipts(),
        getDailyPayments(),
        getLoans(),
        getSettings(),
      ]);
      setReceipts(receiptData);
      setPayments(paymentData);
      setLoans(loansData);


      const cashInBankSetting = (settingsData || []).find((setting) => setting.key === 'cash_in_bank');
      const parsedCashInBank = Number.parseFloat(cashInBankSetting?.value);
      setCashInBankBase(Number.isFinite(parsedCashInBank) ? parsedCashInBank : 0);
    } catch (err) {
      setError(err.message || 'Failed to load daily transactions');
    } finally {
      setLoading(false);
    }
  };


  const totalDepositReceipts = useMemo(() => {
    return receipts
      .filter((record) => !isBankAmountReceipt(record))
      .reduce((sum, record) => sum + toNumber(record.deposit_amount), 0);
  }, [receipts]);


  const totalBankAmountReceipts = useMemo(() => {
    return receipts
      .filter((record) => isBankAmountReceipt(record))
      .reduce((sum, record) => sum + toNumber(record.deposit_amount), 0);
  }, [receipts]);


  const totalDailyPaymentOutflow = useMemo(() => {
    return payments.reduce((sum, record) => sum + toNumber(record.amount), 0);
  }, [payments]);


  const totalBankAccountPaymentInflow = useMemo(() => {
    return payments.reduce((sum, record) => {
      const paymentType = String(record.payment_type || '').trim().toLowerCase();
      return paymentType === 'bank account' ? sum + toNumber(record.amount) : sum;
    }, 0);
  }, [payments]);


  const totalLoanOutflow = useMemo(() => {
    return loans.reduce((sum, loan) => sum + toNumber(loan.outstanding_amount), 0);
  }, [loans]);


  const totalLoanExtraCollection = useMemo(() => {
    return loans.reduce((sum, loan) => {
      const loanAmount = toNumber(loan.total_loan_amount);
      const netDisbursed = toNumber(loan.net_disbursed_amount);
      const paid = toNumber(loan.total_paid);
      const upfrontDeduction = Math.max(0, loanAmount - netDisbursed);
      const overCollection = Math.max(0, paid - loanAmount);
      return sum + upfrontDeduction + overCollection;
    }, 0);
  }, [loans]);


  const rawCashInHand =
    totalDepositReceipts +
    totalBankAmountReceipts -
    totalDailyPaymentOutflow -
    totalLoanOutflow +
    totalLoanExtraCollection;


  const rawCashInBank =
    cashInBankBase - totalBankAmountReceipts + totalBankAccountPaymentInflow;


  const safeCashInHand = Math.max(0, Math.round(rawCashInHand));
  const safeCashInBank = Math.max(0, Math.round(rawCashInBank));


  const handleReceiptChange = (field, value) => {
    setReceiptForm((prev) => ({ ...prev, [field]: value }));
  };


  const handlePaymentChange = (field, value) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  };


  const handleBankAmountChange = (field, value) => {
    setBankAmountForm((prev) => ({ ...prev, [field]: value }));
  };


  const handleSaveReceipt = async (event) => {
    event.preventDefault();


    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');


      const payload = {
        name: receiptForm.name.trim(),
        deposit_amount: Math.round(toNumber(receiptForm.deposit_amount)),
        entry_date: receiptForm.entry_date,
        period_days: Math.max(1, Math.round(toNumber(receiptForm.period_days))),
        percentage: Math.round(toNumber(receiptForm.percentage)),
      };


      if (payload.deposit_amount <= 0) {
        throw new Error('Deposit amount must be greater than 0.');
      }


      if (editingReceiptId) {
        await updateDailyReceipt(editingReceiptId, payload);
      } else {
        await createDailyReceipt(payload);
      }


      setReceiptForm({
        name: '',
        deposit_amount: '',
        entry_date: todayISO(),
        period_days: '',
        percentage: '',
      });
      setEditingReceiptId(null);


      setSuccessMessage(editingReceiptId ? 'Receipt updated successfully.' : 'Receipt saved successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save receipt');
    } finally {
      setLoading(false);
    }
  };


  const handleSavePayment = async (event) => {
    event.preventDefault();


    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');


      const payload = {
        payment_type: paymentForm.payment_type.trim(),
        amount: Math.round(toNumber(paymentForm.amount)),
        payment_date: paymentForm.payment_date,
      };


      if (payload.amount <= 0) {
        throw new Error('Payment amount must be greater than 0.');
      }


      const previousAmount = editingPaymentId
        ? toNumber(payments.find((record) => record.id === editingPaymentId)?.amount)
        : 0;


      const availableForPayment = Math.max(0, Math.round(rawCashInHand + previousAmount));
      if (payload.amount > availableForPayment) {
        throw new Error(
          `Insufficient cash in hand. Available ₹${availableForPayment.toLocaleString('en-IN')}, requested ₹${payload.amount.toLocaleString('en-IN')}. Please enter a lower amount.`
        );
      }


      if (editingPaymentId) {
        await updateDailyPayment(editingPaymentId, payload);
      } else {
        await createDailyPayment(payload);
      }


      setPaymentForm({
        payment_type: '',
        amount: '',
        payment_date: todayISO(),
      });
      setEditingPaymentId(null);


      setSuccessMessage(editingPaymentId ? 'Payment updated successfully.' : 'Payment saved successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save payment');
    } finally {
      setLoading(false);
    }
  };


  const handleSaveBankAmount = async (event) => {
    event.preventDefault();


    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');


      const payload = {
        name: buildBankAmountReceiptName(bankAmountForm.type.trim()),
        deposit_amount: Math.round(toNumber(bankAmountForm.amount)),
        entry_date: bankAmountForm.date,
        period_days: 1,
        percentage: 0,
      };


      if (payload.deposit_amount <= 0) {
        throw new Error('Bank amount must be greater than 0.');
      }


      const availableBankAmount = Math.max(0, Math.round(rawCashInBank));
      if (payload.deposit_amount > availableBankAmount) {
        throw new Error(
          `Insufficient cash in bank. Available ₹${availableBankAmount.toLocaleString('en-IN')}, requested ₹${payload.deposit_amount.toLocaleString('en-IN')}. Please enter a lower amount.`
        );
      }


      await createDailyReceipt(payload);


      setBankAmountForm({
        type: '',
        amount: '',
        date: todayISO(),
      });


      setSuccessMessage('Bank amount saved successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save bank amount');
    } finally {
      setLoading(false);
    }
  };


  const receiptRows = useMemo(() => {
    return receipts.map((record) => {
      const interestAmount = calculateAccruedInterest(
        record.deposit_amount,
        record.entry_date,
        record.period_days,
        record.percentage,
        now
      );


      return {
        ...record,
        interestAmount,
      };
    });
  }, [receipts, now]);


  const depositReceiptRows = useMemo(() => {
    return receiptRows.filter((record) => !isBankAmountReceipt(record));
  }, [receiptRows]);


  const bankAmountRows = useMemo(() => {
    return receiptRows
      .filter((record) => isBankAmountReceipt(record))
      .map((record) => ({
        ...record,
        bank_type: formatTransactionType(parseBankAmountType(record.name)),
      }));
  }, [receiptRows]);


  const filteredDepositRows = useMemo(() => {
    return depositReceiptRows.filter((record) => {
      const search = receiptFilters.search.trim().toLowerCase();
      const recordName = (record.name || '').toLowerCase();
      const recordDate = record.entry_date || '';


      if (search && !recordName.includes(search)) {
        return false;
      }
      if (receiptFilters.fromDate && recordDate < receiptFilters.fromDate) {
        return false;
      }
      if (receiptFilters.toDate && recordDate > receiptFilters.toDate) {
        return false;
      }
      return true;
    });
  }, [depositReceiptRows, receiptFilters]);


  const filteredBankAmountRows = useMemo(() => {
    return bankAmountRows.filter((record) => {
      const search = receiptFilters.search.trim().toLowerCase();
      const recordType = (record.bank_type || '').toLowerCase();
      const recordDate = record.entry_date || '';


      if (search && !recordType.includes(search)) {
        return false;
      }
      if (receiptFilters.fromDate && recordDate < receiptFilters.fromDate) {
        return false;
      }
      if (receiptFilters.toDate && recordDate > receiptFilters.toDate) {
        return false;
      }
      return true;
    });
  }, [bankAmountRows, receiptFilters]);


  const filteredPaymentRows = useMemo(() => {
    return payments.filter((record) => {
      const typeFilter = paymentFilters.type.trim().toLowerCase();
      const recordType = (record.payment_type || '').toLowerCase();
      const recordDate = record.payment_date || '';


      if (typeFilter && !recordType.includes(typeFilter)) {
        return false;
      }
      if (paymentFilters.fromDate && recordDate < paymentFilters.fromDate) {
        return false;
      }
      if (paymentFilters.toDate && recordDate > paymentFilters.toDate) {
        return false;
      }
      return true;
    });
  }, [payments, paymentFilters]);


  let receiptSubmitLabel = 'Save';
  if (loading) {
    receiptSubmitLabel = 'Saving...';
  } else if (editingReceiptId) {
    receiptSubmitLabel = 'Update';
  }


  let paymentSubmitLabel = 'Save';
  if (loading) {
    paymentSubmitLabel = 'Saving...';
  } else if (editingPaymentId) {
    paymentSubmitLabel = 'Update';
  }


  const headerCellSx = {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    fontWeight: 700,
    fontSize: '0.82rem',
    py: 1.2,
    px: 1.4,
    whiteSpace: 'nowrap',
  };


  const bodyCellSx = {
    py: 1.1,
    px: 1.4,
    fontSize: '0.86rem',
    verticalAlign: 'middle',
  };


  let receiptFormTitle = 'Bank Amount Entry';
  if (receiptTab === 'deposit') {
    receiptFormTitle = editingReceiptId ? 'Edit Deposit' : 'Deposit Entry';
  }


  const isDepositReceiptTab = receiptTab === 'deposit';


  let receiptRecordsTitle = 'Bank Amount Records';
  if (isDepositReceiptTab) {
    receiptRecordsTitle = 'Deposit Records';
  }


  let receiptFilterLabel = 'Filter by Type';
  if (isDepositReceiptTab) {
    receiptFilterLabel = 'Filter by Name';
  }


  let receiptTableMinWidth = 520;
  if (isDepositReceiptTab) {
    receiptTableMinWidth = 780;
  }


  let bankAmountSaveLabel = 'Save';
  if (loading) {
    bankAmountSaveLabel = 'Saving...';
  }


  const handleEditReceipt = (record) => {
    setEditingReceiptId(record.id);
    setReceiptForm({
      name: record.name || '',
      deposit_amount: Number(record.deposit_amount || 0).toString(),
      entry_date: record.entry_date || todayISO(),
      period_days: Number(record.period_days || 1).toString(),
      percentage: Number(record.percentage || 0).toString(),
    });
    setActiveTab('receipt');
    setError(null);
    setSuccessMessage('');
  };


  const handleDeleteReceipt = async (id) => {
    const confirmed = globalThis.confirm('Delete this receipt record?');
    if (!confirmed) {
      return;
    }


    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      await deleteDailyReceipt(id);


      if (editingReceiptId === id) {
        setEditingReceiptId(null);
        setReceiptForm({
          name: '',
          deposit_amount: '',
          entry_date: todayISO(),
          period_days: '',
          percentage: '',
        });
      }


      setSuccessMessage('Receipt deleted successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete receipt');
    } finally {
      setLoading(false);
    }
  };


  const handleEditPayment = (record) => {
    setEditingPaymentId(record.id);
    setPaymentForm({
      payment_type: record.payment_type || '',
      amount: Number(record.amount || 0).toString(),
      payment_date: record.payment_date || todayISO(),
    });
    setActiveTab('payment');
    setError(null);
    setSuccessMessage('');
  };


  const handleDeletePayment = async (id) => {
    const confirmed = globalThis.confirm('Delete this payment record?');
    if (!confirmed) {
      return;
    }


    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      await deleteDailyPayment(id);


      if (editingPaymentId === id) {
        setEditingPaymentId(null);
        setPaymentForm({
          payment_type: '',
          amount: '',
          payment_date: todayISO(),
        });
      }


      setSuccessMessage('Payment deleted successfully.');
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete payment');
    } finally {
      setLoading(false);
    }
  };


  const downloadTablePdf = (title, filenamePrefix, head, body) => {
    if (body.length === 0) {
      setError(`No ${title.toLowerCase()} records found to download.`);
      return;
    }


    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedAt = format(new Date(), 'dd/MMM/yyyy HH:mm');


    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`${title} Report`, pageWidth / 2, 14, { align: 'center' });


    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${generatedAt}`, pageWidth / 2, 20, { align: 'center' });
    doc.text(`Total records: ${body.length}`, pageWidth / 2, 25, { align: 'center' });


    autoTable(doc, {
      startY: 30,
      head: [head],
      body,
      margin: { top: 30, right: 8, bottom: 8, left: 8 },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 1.8,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [25, 118, 210],
        textColor: 255,
        fontStyle: 'bold',
      },
    });


    doc.save(`${filenamePrefix}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
  };


  const handleDownloadDepositPdf = () => {
    const body = filteredDepositRows.map((record) => [
      record.name || '-',
      Number(record.deposit_amount || 0).toLocaleString('en-IN'),
      record.entry_date ? format(new Date(record.entry_date), 'dd/MMM/yyyy') : '-',
      Number(record.period_days || 0).toLocaleString('en-IN'),
      `${Number(record.percentage || 0).toLocaleString('en-IN')}%`,
      Number(record.interestAmount || 0).toLocaleString('en-IN'),
    ]);


    downloadTablePdf(
      'Deposit',
      'daily-trans-deposit',
      ['Name', 'Deposit Amount', 'Date', 'Period', 'Percentage', 'Interest Amount'],
      body
    );
  };


  const handleDownloadBankAmountPdf = () => {
    const body = filteredBankAmountRows.map((record) => [
      record.bank_type || '-',
      Number(record.deposit_amount || 0).toLocaleString('en-IN'),
      record.entry_date ? format(new Date(record.entry_date), 'dd/MMM/yyyy') : '-',
    ]);


    downloadTablePdf(
      'Bank Amount',
      'daily-trans-bank-amount',
      ['Type', 'Amount', 'Date'],
      body
    );
  };


  const handleDownloadPaymentPdf = () => {
    const body = filteredPaymentRows.map((record) => [
      formatTransactionType(record.payment_type) || '-',
      Number(record.amount || 0).toLocaleString('en-IN'),
      record.payment_date ? format(new Date(record.payment_date), 'dd/MMM/yyyy') : '-',
    ]);


    downloadTablePdf(
      'Payment',
      'daily-trans-payment',
      ['Type', 'Amount', 'Date'],
      body
    );
  };


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Daily Transactions
      </Typography>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}


      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}


      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Alert severity="info">Available Cash in Hand: ₹{safeCashInHand.toLocaleString('en-IN')}</Alert>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Alert severity="info">Available Cash in Bank: ₹{safeCashInBank.toLocaleString('en-IN')}</Alert>
        </Grid>
      </Grid>


      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(event, value) => setActiveTab(value)}
          variant="fullWidth"
        >
          <Tab label="Receipt" value="receipt" />
          <Tab label="Payment" value="payment" />
        </Tabs>
      </Paper>


      {activeTab === 'receipt' && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {receiptFormTitle}
              </Typography>
              <Divider sx={{ mb: 3 }} />


              <Tabs
                value={receiptTab}
                onChange={(event, value) => {
                  setReceiptTab(value);
                  setEditingReceiptId(null);
                }}
                sx={{ mb: 3 }}
              >
                <Tab label="Deposit" value="deposit" />
                <Tab label="Bank Amount" value="bank_amount" />
              </Tabs>


              {receiptTab === 'deposit' && (
                <Box component="form" onSubmit={handleSaveReceipt}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="Name"
                      value={receiptForm.name}
                      onChange={(e) => handleReceiptChange('name', e.target.value)}
                    />
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Deposit Amount"
                      value={receiptForm.deposit_amount}
                      onChange={(e) => handleReceiptChange('deposit_amount', e.target.value)}
                      inputProps={{ min: 0 }}
                      InputProps={{ startAdornment: '₹' }}
                    />
                  </Grid>


                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      type="date"
                      label="Date"
                      value={receiptForm.entry_date}
                      onChange={(e) => handleReceiptChange('entry_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>


                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Period"
                      value={receiptForm.period_days}
                      onChange={(e) => handleReceiptChange('period_days', e.target.value)}
                      inputProps={{ min: 1 }}
                      helperText="Used as number of days for daily interest accrual"
                    />
                  </Grid>


                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Percentage"
                      value={receiptForm.percentage}
                      onChange={(e) => handleReceiptChange('percentage', e.target.value)}
                      inputProps={{ min: 0 }}
                      InputProps={{ endAdornment: '%' }}
                    />
                  </Grid>
                </Grid>


                <Box sx={{ mt: 3 }}>
                  <Button type="submit" variant="contained" disabled={loading} sx={{ mr: 1 }}>
                    {receiptSubmitLabel}
                  </Button>
                  {editingReceiptId && (
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={loading}
                      onClick={() => {
                        setEditingReceiptId(null);
                        setReceiptForm({
                          name: '',
                          deposit_amount: '',
                          entry_date: todayISO(),
                          period_days: '',
                          percentage: '',
                        });
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </Box>
                </Box>
              )}


              {receiptTab === 'bank_amount' && (
                <Box component="form" onSubmit={handleSaveBankAmount}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        required
                        label="Type"
                        value={bankAmountForm.type}
                        onChange={(e) => handleBankAmountChange('type', e.target.value)}
                      />
                    </Grid>


                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        required
                        type="number"
                        label="Amount"
                        value={bankAmountForm.amount}
                        onChange={(e) => handleBankAmountChange('amount', e.target.value)}
                        inputProps={{ min: 0 }}
                        InputProps={{ startAdornment: '₹' }}
                      />
                    </Grid>


                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        required
                        type="date"
                        label="Date"
                        value={bankAmountForm.date}
                        onChange={(e) => handleBankAmountChange('date', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>


                  <Box sx={{ mt: 3 }}>
                    <Button type="submit" variant="contained" disabled={loading}>
                      {bankAmountSaveLabel}
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>


          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" gutterBottom>
                  {receiptRecordsTitle}
                </Typography>
                {isDepositReceiptTab && (
                  <Button variant="outlined" onClick={handleDownloadDepositPdf}>
                    Download Deposit PDF
                  </Button>
                )}
                {!isDepositReceiptTab && (
                  <Button variant="outlined" onClick={handleDownloadBankAmountPdf}>
                    Download Bank Amount PDF
                  </Button>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />


              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label={receiptFilterLabel}
                    value={receiptFilters.search}
                    onChange={(e) => setReceiptFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    type="date"
                    label="From Date"
                    value={receiptFilters.fromDate}
                    onChange={(e) => setReceiptFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    type="date"
                    label="To Date"
                    value={receiptFilters.toDate}
                    onChange={(e) => setReceiptFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{ height: '100%' }}
                    onClick={() => setReceiptFilters({ search: '', fromDate: '', toDate: '' })}
                  >
                    Clear
                  </Button>
                </Grid>
              </Grid>


              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: 2, overflowX: 'auto', overflowY: 'auto', maxHeight: 420, borderColor: 'divider' }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    minWidth: receiptTableMinWidth,
                    '& .MuiTableRow-root:nth-of-type(even)': {
                      backgroundColor: 'action.hover',
                    },
                    '& .MuiTableBody-root .MuiTableRow-root:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    },
                  }}
                >
                  <TableHead>
                    {receiptTab === 'deposit' && (
                      <TableRow>
                        <TableCell sx={{ ...headerCellSx, minWidth: 170 }}>Name</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, minWidth: 130 }}>Deposit Amount</TableCell>
                        <TableCell sx={{ ...headerCellSx, minWidth: 110 }}>Date</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, minWidth: 90 }}>Period</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, minWidth: 95 }}>Percentage</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, minWidth: 130 }}>Interest Amount</TableCell>
                        <TableCell align="center" sx={{ ...headerCellSx, minWidth: 110 }}>Actions</TableCell>
                      </TableRow>
                    )}


                    {receiptTab === 'bank_amount' && (
                      <TableRow>
                        <TableCell sx={{ ...headerCellSx, minWidth: 170 }}>Type</TableCell>
                        <TableCell align="right" sx={{ ...headerCellSx, minWidth: 130 }}>Amount</TableCell>
                        <TableCell sx={{ ...headerCellSx, minWidth: 130 }}>Date</TableCell>
                        <TableCell align="center" sx={{ ...headerCellSx, minWidth: 110 }}>Actions</TableCell>
                      </TableRow>
                    )}
                  </TableHead>
                  <TableBody>
                    {receiptTab === 'deposit' && filteredDepositRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                          No deposits found.
                        </TableCell>
                      </TableRow>
                    )}


                    {receiptTab === 'deposit' && filteredDepositRows.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell sx={bodyCellSx}>{record.name}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>₹{Number(record.deposit_amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell sx={bodyCellSx}>{record.entry_date ? format(new Date(record.entry_date), 'dd/MMM/yyyy') : '-'}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{record.period_days}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{record.percentage}%</TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700, color: 'success.main' }}>
                          ₹{Number(record.interestAmount).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell align="center" sx={bodyCellSx}>
                          <IconButton size="small" color="primary" onClick={() => handleEditReceipt(record)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteReceipt(record.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}


                    {receiptTab === 'bank_amount' && filteredBankAmountRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                          No bank amount records found.
                        </TableCell>
                      </TableRow>
                    )}


                    {receiptTab === 'bank_amount' && filteredBankAmountRows.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell sx={bodyCellSx}>{record.bank_type}</TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}>
                          ₹{Number(record.deposit_amount).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{record.entry_date ? format(new Date(record.entry_date), 'dd/MMM/yyyy') : '-'}</TableCell>
                        <TableCell align="center" sx={bodyCellSx}>
                          <IconButton size="small" color="error" onClick={() => handleDeleteReceipt(record.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}


      {activeTab === 'payment' && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {editingPaymentId ? 'Edit Payment' : 'Payment Entry'}
              </Typography>
              <Divider sx={{ mb: 3 }} />


              <Box component="form" onSubmit={handleSavePayment}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      select
                      fullWidth
                      required
                      label="Type"
                      value={paymentForm.payment_type}
                      onChange={(e) => handlePaymentChange('payment_type', e.target.value)}
                    >
                      {TRANSACTION_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>


                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Amount"
                      value={paymentForm.amount}
                      onChange={(e) => handlePaymentChange('amount', e.target.value)}
                      inputProps={{ min: 0 }}
                      InputProps={{ startAdornment: '₹' }}
                    />
                  </Grid>


                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      type="date"
                      label="Date"
                      value={paymentForm.payment_date}
                      onChange={(e) => handlePaymentChange('payment_date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>


                <Box sx={{ mt: 3 }}>
                  <Button type="submit" variant="contained" disabled={loading} sx={{ mr: 1 }}>
                    {paymentSubmitLabel}
                  </Button>
                  {editingPaymentId && (
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={loading}
                      onClick={() => {
                        setEditingPaymentId(null);
                        setPaymentForm({
                          payment_type: '',
                          amount: '',
                          payment_date: todayISO(),
                        });
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>


          <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" gutterBottom>
                  Payment Records
                </Typography>
                <Button variant="outlined" onClick={handleDownloadPaymentPdf}>
                  Download Payment PDF
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />


              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Filter by Type"
                    value={paymentFilters.type}
                    onChange={(e) => setPaymentFilters((prev) => ({ ...prev, type: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    type="date"
                    label="From Date"
                    value={paymentFilters.fromDate}
                    onChange={(e) => setPaymentFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    type="date"
                    label="To Date"
                    value={paymentFilters.toDate}
                    onChange={(e) => setPaymentFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{ height: '100%' }}
                    onClick={() => setPaymentFilters({ type: '', fromDate: '', toDate: '' })}
                  >
                    Clear
                  </Button>
                </Grid>
              </Grid>


              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ borderRadius: 2, overflowX: 'auto', overflowY: 'auto', maxHeight: 420, borderColor: 'divider' }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    minWidth: 560,
                    '& .MuiTableRow-root:nth-of-type(even)': {
                      backgroundColor: 'action.hover',
                    },
                    '& .MuiTableBody-root .MuiTableRow-root:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...headerCellSx, minWidth: 190 }}>Type</TableCell>
                      <TableCell align="right" sx={{ ...headerCellSx, minWidth: 130 }}>Amount</TableCell>
                      <TableCell sx={{ ...headerCellSx, minWidth: 130 }}>Date</TableCell>
                      <TableCell align="center" sx={{ ...headerCellSx, minWidth: 110 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPaymentRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                          No payments found.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredPaymentRows.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell sx={bodyCellSx}>{formatTransactionType(record.payment_type)}</TableCell>
                        <TableCell align="right" sx={{ ...bodyCellSx, fontWeight: 700 }}>
                          ₹{Number(record.amount).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{record.payment_date ? format(new Date(record.payment_date), 'dd/MMM/yyyy') : '-'}</TableCell>
                        <TableCell align="center" sx={bodyCellSx}>
                          <IconButton size="small" color="primary" onClick={() => handleEditPayment(record)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeletePayment(record.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}