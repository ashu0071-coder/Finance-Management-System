import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  Warning,
  CheckCircle,
  Schedule,
  Phone as PhoneIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getLoans } from '../../services/loanService';
import { getCustomers } from '../../services/customerService';
import { getSettings } from '../../services/settingsService';
import { getDailyPayments, getDailyReceipts } from '../../services/dailyTransService';
import { calculatePenalty } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const BANK_AMOUNT_NAME_PREFIX = 'BANK_AMOUNT:';


const isBankAmountReceipt = (record) =>
  typeof record?.name === 'string' && record.name.startsWith(BANK_AMOUNT_NAME_PREFIX);


const toSafeNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }


  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }


  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};


export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [penaltyRate, setPenaltyRate] = useState(80);
  const [cashInBankBase, setCashInBankBase] = useState(0);
  const [dailyReceipts, setDailyReceipts] = useState([]);
  const [dailyPayments, setDailyPayments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, overdue, active, closed


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansData, customersData, settingsData, receiptData, paymentData] = await Promise.all([
        getLoans(),
        getCustomers(),
        getSettings(),
        getDailyReceipts(),
        getDailyPayments(),
      ]);
      setLoans(loansData);
      setCustomers(customersData);
      setDailyReceipts(receiptData);
      setDailyPayments(paymentData);
     
      const penaltySetting = settingsData.find(s => s.key === 'penalty_rate_annual');
      if (penaltySetting) {
        setPenaltyRate(Number.parseFloat(penaltySetting.value));
      }


      const cashInBankSetting = settingsData.find((s) => s.key === 'cash_in_bank');
      const parsedCashInBank = Number.parseFloat(cashInBankSetting?.value);
      setCashInBankBase(Number.isFinite(parsedCashInBank) ? parsedCashInBank : 0);
     
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={50} />
      </Box>
    );
  }


  const activeLoans = loans?.filter((l) => l.status === 'active') ?? [];
  const overdueLoans = loans?.filter((l) => l.status === 'overdue') ?? [];
  const closedLoans = loans?.filter((l) => l.status === 'closed') ?? [];
 
  // Finance pool is now derived from daily transaction inflow/outflow and loan outflow.
  const totalDepositReceipts = dailyReceipts
    .filter((record) => !isBankAmountReceipt(record))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);
  const totalBankAmountReceipts = dailyReceipts
    .filter((record) => isBankAmountReceipt(record))
    .reduce((sum, record) => sum + toSafeNumber(record.deposit_amount), 0);
  const totalReceiptInflow = totalDepositReceipts + totalBankAmountReceipts;


  const totalDailyPaymentOutflow = dailyPayments.reduce(
    (sum, record) => sum + toSafeNumber(record.amount),
    0
  );


  const totalBankAccountPaymentInflow = dailyPayments.reduce((sum, record) => {
    const paymentType = String(record.payment_type || '').trim().toLowerCase();
    return paymentType === 'bank account' ? sum + toSafeNumber(record.amount) : sum;
  }, 0);


  // Use remaining outstanding balance so repayment automatically reduces loan outflow.
  const totalLoanOutflow = loans.reduce(
    (sum, loan) => sum + toSafeNumber(loan.outstanding_amount),
    0
  );


  // Upfront deduction (interest + bond fee) and over-collection above
  // total loan amount should be added back into finance.
  const totalLoanExtraCollection = loans.reduce((sum, loan) => {
    const netDisbursed = toSafeNumber(loan.net_disbursed_amount);
    const paid = toSafeNumber(loan.total_paid);
    const loanAmount = toSafeNumber(loan.total_loan_amount);


    const upfrontDeduction = Math.max(0, loanAmount - netDisbursed);
    const overCollection = Math.max(0, paid - loanAmount);


    return sum + upfrontDeduction + overCollection;
  }, 0);


  const totalFinanceAmount = totalReceiptInflow;
  const remainingFinanceAmountRaw =
    totalReceiptInflow - totalDailyPaymentOutflow - totalLoanOutflow + totalLoanExtraCollection;
  const remainingCashInBankRaw =
    cashInBankBase - totalBankAmountReceipts + totalBankAccountPaymentInflow;


  // Never show negative balances in the UI.
  const remainingFinanceAmount = Math.max(0, remainingFinanceAmountRaw);
  const remainingCashInBank = Math.max(0, remainingCashInBankRaw);


  // Filter loans based on active tab
  const getFilteredLoans = () => {
    let filtered = loans;
   
    // Filter by tab
    if (activeTab === 'overdue') {
      filtered = overdueLoans;
    } else if (activeTab === 'active') {
      filtered = activeLoans;
    } else if (activeTab === 'closed') {
      filtered = closedLoans;
    }
   
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((loan) =>
        loan.loan_number?.toLowerCase().includes(search) ||
        loan.customers?.name?.toLowerCase().includes(search) ||
        loan.customers?.mobile_number?.includes(search) ||
        loan.customers?.reference_person_name?.toLowerCase().includes(search)
      );
    }
   
    return filtered;
  };


  const filteredLoans = getFilteredLoans();


  const getLivePenaltyAmount = (loan) => {
    const storedPenalty = Math.max(0, Math.round(toSafeNumber(loan.penalty_amount)));
    const dueDate = loan.current_due_date ? new Date(loan.current_due_date) : null;


    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return storedPenalty;
    }


    const isLoanOverdue = loan.status !== 'closed' && dueDate < new Date();
    if (!isLoanOverdue) {
      return storedPenalty;
    }


    const outstandingBase = Math.max(toSafeNumber(loan.outstanding_amount), 0);
    const fallbackBase = Math.max(toSafeNumber(loan.total_loan_amount) - toSafeNumber(loan.total_paid), 0);
    const penaltyBase = outstandingBase > 0 ? outstandingBase : fallbackBase;


    const calculatedPenalty = calculatePenalty(penaltyBase, dueDate, new Date(), penaltyRate);
    return Math.max(storedPenalty, Math.max(0, Math.round(Number(calculatedPenalty || 0))));
  };


  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };


  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();


    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('All Loans Report', pageWidth / 2, 15, { align: 'center' });


    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${format(new Date(), 'dd/MMM/yyyy HH:mm')}`, pageWidth / 2, 22, { align: 'center' });
    doc.text(`Total Loans: ${loans.length}  |  Finance Inflow: \u20B9${Math.round(totalFinanceAmount).toLocaleString('en-IN')}  |  Cash in hand: \u20B9${Math.round(remainingFinanceAmount).toLocaleString('en-IN')}`, pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(8);
    doc.text('All amounts are in INR', pageWidth / 2, 33, { align: 'center' });


    const tableData = loans.map((loan) => [
      loan.loan_number || '-',
      loan.customers?.name || '-',
      loan.customers?.mobile_number || '-',
      `${Math.round(toSafeNumber(loan.total_loan_amount)).toLocaleString('en-IN')}`,
      `${Math.round(toSafeNumber(loan.bond_fee)).toLocaleString('en-IN')}`,
      `${Math.round(toSafeNumber(loan.interest_amount)).toLocaleString('en-IN')}`,
      `${Math.round(toSafeNumber(loan.net_disbursed_amount)).toLocaleString('en-IN')}`,
      `${Math.round(Number(getLivePenaltyAmount(loan) || 0)).toLocaleString('en-IN')}`,
      `${Math.round(toSafeNumber(loan.outstanding_amount)).toLocaleString('en-IN')}`,
      `${Math.round(toSafeNumber(loan.total_paid)).toLocaleString('en-IN')}`,
      loan.status?.toUpperCase() || '-',
      loan.start_date ? format(new Date(loan.start_date), 'dd/MMM/yyyy') : '-',
      loan.current_due_date ? format(new Date(loan.current_due_date), 'dd/MMM/yyyy') : '-',
      loan.closure_date ? format(new Date(loan.closure_date), 'dd/MMM/yyyy') : '-',
    ]);


    autoTable(doc, {
      startY: 38,
      head: [[
        'Loan No',
        'Customer',
        'Mobile',
        'Loan Amt',
        'Bond Fee',
        'Interest',
        'Disbursed',
        'Penalty',
        'Outstanding',
        'Paid',
        'Status',
        'Start Date',
        'Due Date',
        'Closed On',
      ]],
      body: tableData,
      margin: { top: 38, right: 8, bottom: 8, left: 8 },
      tableWidth: pageWidth - 16,
      theme: 'grid',
      styles: {
        fontSize: 6.5,
        cellPadding: 1.4,
        overflow: 'ellipsize',
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [25, 118, 210],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: 1.6,
        halign: 'center',
        valign: 'middle',
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 18, halign: 'left' },
        1: { cellWidth: 30, halign: 'left' },
        2: { cellWidth: 22 },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 14, halign: 'right' },
        6: { cellWidth: 16, halign: 'right' },
        7: { cellWidth: 16, halign: 'right' },
        8: { cellWidth: 18, halign: 'right' },
        9: { cellWidth: 16, halign: 'right' },
        10: { cellWidth: 15 },
        11: { cellWidth: 18 },
        12: { cellWidth: 18 },
        13: { cellWidth: 16 },
      },
    });


    doc.save(`loans-report-${format(new Date(), 'dd-MMM-yyyy')}.pdf`);
  };


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                Dashboard
              </Typography>
              <Typography color="text.secondary">
                {format(new Date(), 'dd/MMM/yyyy')}
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="error"
              startIcon={<PdfIcon />}
              onClick={handleDownloadPDF}
              sx={{ mt: { xs: 0, sm: 0.5 }, flexShrink: 0 }}
            >
              Download All Loans PDF
            </Button>
          </Stack>
        </Box>


        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        {/* Statistics Cards - Clickable */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 calc(25% - 8px)', minWidth: '150px' }}>
            <Card
              sx={{
                bgcolor: 'success.main',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => setActiveTab('active')}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <CheckCircle sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {activeLoans.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Active Loans</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{ flex: '1 1 calc(25% - 8px)', minWidth: '150px' }}>
            <Card
              sx={{
                bgcolor: 'error.main',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => setActiveTab('overdue')}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Warning sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {overdueLoans.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Overdue</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{ flex: '1 1 calc(25% - 8px)', minWidth: '150px' }}>
            <Card
              sx={{
                bgcolor: 'info.main',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => setActiveTab('closed')}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Schedule sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {closedLoans.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Closed</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{ flex: '1 1 calc(25% - 8px)', minWidth: '150px' }}>
            <Card
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4,
                },
              }}
              onClick={() => navigate(`${basePath}/customers`)}
            >
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <TrendingUp sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight={700}>
                  {customers.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Customers</Typography>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Money Summary */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* <div style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '200px' }}>
            <Paper sx={{ p: 2.5, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', display: 'block', mb: 0.5 }}>
                Total Outstanding
              </Typography>
              <Typography variant="h5" color="error.main" fontWeight={700}>
                ₹{Math.round(totalOutstanding).toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </div>
          <div style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '200px' }}>
            <Paper sx={{ p: 2.5, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', display: 'block', mb: 0.5 }}>
                Total Disbursed
              </Typography>
              <Typography variant="h5" color="success.main" fontWeight={700}>
                ₹{Math.round(totalDisbursed).toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </div> */}
          <div style={{ flex: '1 1 calc(33.33% - 8px)', minWidth: '200px' }}>
            <Paper sx={{ p: 2.5, bgcolor: 'background.paper', height: '100%' }}>
              {/* <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem', display: 'block', mb: 0.5 }}>
                Total Finance Amount
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight={700}>
                ₹{Math.round(totalFinanceAmount).toLocaleString('en-IN')}
              </Typography> */}
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="body2" color="text.secondary">
                Deposit Receipt: ₹{Math.round(totalDepositReceipts).toLocaleString('en-IN')}
              </Typography>
              {/* <Typography variant="body2" color="text.secondary">
                Bank Amount Receipt: ₹{Math.round(totalBankAmountReceipts).toLocaleString('en-IN')}
              </Typography> */}
              {/* <Typography variant="body2" color="text.secondary">
                Daily Payments (-): ₹{Math.round(totalDailyPaymentOutflow).toLocaleString('en-IN')}
              </Typography> */}
              <Typography variant="body2" color="text.secondary">
                Loan Amount (-): ₹{Math.round(totalLoanOutflow).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Loan Extra Collection (+): ₹{Math.round(totalLoanExtraCollection).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body1" color="primary.main" fontWeight={700}>
                Cash in Bank: ₹{Math.round(remainingCashInBank).toLocaleString('en-IN')}
              </Typography>
              <Typography variant="body1" color="success.main" fontWeight={700}>
                Cash in hand: ₹{Math.round(remainingFinanceAmount).toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </div>
        </div>


        {/* Search Bar */}
        <TextField
          fullWidth
          placeholder="Search by loan number, customer name, mobile, or referrer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
            }
          }}
        />


        {/* Tabs for filtering */}
        <Paper>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                py: 2,
                fontWeight: 600,
              },
            }}
          >
            <Tab label={`All (${loans.length})`} value="all" />
            <Tab
              label={`Overdue (${overdueLoans.length})`}
              value="overdue"
              sx={{ color: 'error.main' }}
            />
            <Tab label={`Active (${activeLoans.length})`} value="active" />
            <Tab label={`Closed (${closedLoans.length})`} value="closed" />
          </Tabs>
        </Paper>


        {/* Loans Display */}
        <Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {filteredLoans.length} loan{filteredLoans.length === 1 ? '' : 's'} found
          </Typography>
         
          {filteredLoans.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary">
                  No loans found
                </Typography>
                {searchTerm && (
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    Try adjusting your search terms
                  </Typography>
                )}
              </CardContent>
            </Card>
          ) : (
            <Box
              sx={{
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto',
                overflowX: 'hidden',
                pr: 1,
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.3)',
                  },
                },
              }}
            >
              <Stack spacing={2.5}>
                {filteredLoans.map((loan) => {
                  const isOverdue = loan.status !== 'closed' && new Date(loan.current_due_date) < new Date();
                  const penaltyAmount = getLivePenaltyAmount(loan);


                  const getStatusColor = (status) => {
                    const colors = {
                      active: 'success.main',
                      closed: 'info.main',
                      overdue: 'error.main',
                      defaulted: 'error.dark',
                      extended: 'warning.main',
                    };
                    return colors[status] || 'default';
                  };


                  const chipStatusColors = {
                    active: 'success',
                    overdue: 'error',
                    closed: 'default',
                    defaulted: 'error',
                    extended: 'warning',
                  };
                  const chipColor = chipStatusColors[loan.status] || 'default';
                 
                  return (
                    <Card
                      key={loan.id}
                      sx={{
                        borderLeft: '4px solid',
                        borderColor: getStatusColor(loan.status),
                        cursor: 'pointer',
                        boxShadow: 2,
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-2px)',
                        },
                      }}
                      onClick={() => navigate(`${basePath}/loans/${loan.id}`)}
                    >
                      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                        {/* Header */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
                              {loan.customers?.name || 'N/A'}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.3}>
                              <PhoneIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.813rem' }}>
                                {loan.customers?.mobile_number || 'N/A'}
                              </Typography>
                            </Stack>
                            {loan.customers?.reference_person_name && (
                              <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.75rem', fontWeight: 500, mt: 0.5, display: 'block' }}>
                                Referrer: {loan.customers.reference_person_name}
                                {loan.customers?.reference_person_mobile && ` • ${loan.customers.reference_person_mobile}`}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={loan.status.toUpperCase()}
                            color={chipColor}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        </Stack>


                        {/* Overdue Alert */}
                        {isOverdue && penaltyAmount > 0 && (
                          <Alert
                            severity="warning"
                            icon={<WarningIcon />}
                            sx={{
                              mt: 1.5,
                              mb: 1.5,
                              py: 0.8,
                              fontWeight: 600,
                              backgroundColor: 'warning.light',
                            }}
                          >
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              ⚠️ OVERDUE! Penalty: ₹{Number(penaltyAmount).toLocaleString('en-IN')}
                            </Typography>
                          </Alert>
                        )}


                        <Divider sx={{ my: 1.5 }} />


                        {/* Loan Details */}
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Loan Number
                            </Typography>
                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                              {loan.loan_number}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Total Loan
                            </Typography>
                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                              ₹{Number(loan.total_loan_amount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Outstanding
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color={loan.outstanding_amount > 0 ? 'error.main' : 'success.main'}
                              sx={{ fontSize: '0.95rem' }}
                            >
                              ₹{Number(loan.outstanding_amount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>


                          {isOverdue && penaltyAmount > 0 && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <WarningIcon color="warning" sx={{ fontSize: 14 }} />
                                <Typography variant="body2" color="warning.main" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                  Penalty
                                </Typography>
                              </Stack>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                color="warning.main"
                                sx={{ fontSize: '0.95rem' }}
                              >
                                ₹{Number(penaltyAmount).toLocaleString('en-IN')}
                              </Typography>
                            </Stack>
                          )}


                          <Divider sx={{ my: 0.8 }} />


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Start Date
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                              {format(new Date(loan.start_date), 'dd/MMM/yyyy')}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Due Date
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {isOverdue && <WarningIcon color="error" sx={{ fontSize: 14 }} />}
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color={isOverdue ? 'error' : 'inherit'}
                                sx={{ fontSize: '0.875rem' }}
                              >
                                {format(new Date(loan.current_due_date), 'dd/MMM/yyyy')}
                              </Typography>
                            </Stack>
                          </Stack>


                          {loan.status === 'closed' && loan.closure_date && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                Closed On
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color="success.main"
                                sx={{ fontSize: '0.875rem' }}
                              >
                                {format(new Date(loan.closure_date), 'dd/MMM/yyyy')}
                              </Typography>
                            </Stack>
                          )}


                          {/* Total Amount Due */}
                          {isOverdue && penaltyAmount > 0 && (
                            <>
                              <Divider sx={{ my: 0.8 }} />
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  backgroundColor: 'rgba(211, 47, 47, 0.08)',
                                  p: 1.5,
                                  borderRadius: 1,
                                  mt: 1,
                                  border: '1px solid',
                                  borderColor: 'error.light',
                                }}
                              >
                                <Typography variant="body1" color="error.main" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                                  Total Amount Due
                                </Typography>
                                <Typography
                                  variant="h6"
                                  fontWeight={700}
                                  color="error.main"
                                  sx={{ fontSize: '1.25rem' }}
                                >
                                  ₹{(Number(loan.outstanding_amount) + Number(penaltyAmount)).toLocaleString('en-IN')}
                                </Typography>
                              </Stack>
                            </>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Box>
      </Stack>


    </Box>
  );
}