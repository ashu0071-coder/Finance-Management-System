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
  Phone as PhoneIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getLoans } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';
import { getDailyDepositReturns, getDailyPayments, getDailyReceipts } from '../../services/dailyTransService';
import { calculatePenalty } from '../../utils/calculations';
import { calculateCashSummary } from '../../utils/dailyTransCalculations';
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


const isLoanOverdue = (loan, referenceDate = new Date()) => {
  if (!loan || loan.status === 'closed' || !loan.current_due_date) {
    return false;
  }


  const dueDate = new Date(loan.current_due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }


  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);


  const referenceDateOnly = new Date(referenceDate);
  referenceDateOnly.setHours(0, 0, 0, 0);


  return dueDateOnly < referenceDateOnly;
};


export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [penaltyRate, setPenaltyRate] = useState(80);
  const [cashInBankBase, setCashInBankBase] = useState(0);
  const [dailyReceipts, setDailyReceipts] = useState([]);
  const [dailyPayments, setDailyPayments] = useState([]);
  const [dailyDepositReturns, setDailyDepositReturns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, overdue, active, closed


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansData, settingsData, receiptData, paymentData, depositReturnData] = await Promise.all([
        getLoans(),
        getSettings(),
        getDailyReceipts(),
        getDailyPayments(),
        getDailyDepositReturns(),
      ]);
      setLoans(loansData);
      setDailyReceipts(receiptData);
      setDailyPayments(paymentData);
      setDailyDepositReturns(depositReturnData);
     
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
  const overdueLoans = loans?.filter((l) => isLoanOverdue(l)) ?? [];
  const closedLoans = loans?.filter((l) => l.status === 'closed') ?? [];
 
  const cashSummary = calculateCashSummary({
    receipts: dailyReceipts,
    payments: dailyPayments,
    loans,
    depositReturns: dailyDepositReturns,
  });


  const totalDepositReceipts = cashSummary.totalDepositReceipts;
  const totalBankAmountReceipts = cashSummary.totalBankAmountReceipts;
  const totalReceiptInflow = totalDepositReceipts + totalBankAmountReceipts;
  const totalBankAccountPaymentInflow = cashSummary.totalBankAccountPaymentInflow;
  const totalLoanOutflow = cashSummary.totalLoanOutflow;
  const totalLoanExtraCollection = cashSummary.totalLoanExtraCollection;


  const totalFinanceAmount = totalReceiptInflow;
  const remainingFinanceAmountRaw = cashSummary.rawCashInHand;
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


    if (!isLoanOverdue(loan)) {
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


        {/* Financial Metrics - Professional Clean Design */}
        <Box>
          <Typography
            variant="h4"
            fontWeight={700}
            sx={{ mb: 3, color: '#1a1a1a', letterSpacing: 0.5 }}
          >
            Financial Summary
          </Typography>
         
          <Stack spacing={3}>
            {/* Row 1: Deposit Receipt & Loan Amount */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Deposit Receipt */}
              <div style={{ flex: '1 1 calc(50% - 16px)', minWidth: '220px' }}>
                <Paper
                  sx={{
                    p: 2.8,
                    bgcolor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    }
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#666666', mb: 1.2, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Deposit Receipt
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: '#000000', fontWeight: 700, fontSize: '1.9rem', letterSpacing: -0.5 }}
                  >
                    ₹{Math.round(totalDepositReceipts).toLocaleString('en-IN')}
                  </Typography>
                </Paper>
              </div>


              {/* Loan Amount */}
              <div style={{ flex: '1 1 calc(50% - 16px)', minWidth: '220px' }}>
                <Paper
                  sx={{
                    p: 2.8,
                    bgcolor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    }
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#666666', mb: 1.2, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Loan Amount Issued
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: '#000000', fontWeight: 700, fontSize: '1.9rem', letterSpacing: -0.5 }}
                  >
                    ₹{Math.round(totalLoanOutflow).toLocaleString('en-IN')}
                  </Typography>
                </Paper>
              </div>
            </div>


            {/* Row 2: Loan Extra Collection & Cash in Bank */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Loan Extra Collection */}
              <div style={{ flex: '1 1 calc(50% - 16px)', minWidth: '220px' }}>
                <Paper
                  sx={{
                    p: 2.8,
                    bgcolor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    }
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#666666', mb: 1.2, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Collection & Interest
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: '#000000', fontWeight: 700, fontSize: '1.9rem', letterSpacing: -0.5 }}
                  >
                    ₹{Math.round(totalLoanExtraCollection).toLocaleString('en-IN')}
                  </Typography>
                </Paper>
              </div>


              {/* Cash in Bank */}
              <div style={{ flex: '1 1 calc(50% - 16px)', minWidth: '220px' }}>
                <Paper
                  sx={{
                    p: 2.8,
                    bgcolor: '#ffffff',
                    border: '1px solid #e0e0e0',
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    }
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#666666', mb: 1.2, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
                  >
                    Cash in Bank
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: '#000000', fontWeight: 700, fontSize: '1.9rem', letterSpacing: -0.5 }}
                  >
                    ₹{Math.round(remainingCashInBank).toLocaleString('en-IN')}
                  </Typography>
                </Paper>
              </div>
            </div>


            {/* Row 3: Cash in Hand - Primary Focus */}
            <Paper
              sx={{
                p: 3.5,
                bgcolor: '#fafafa',
                border: '2px solid #333333',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, color: '#333333', mb: 1.2, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    Available Balance
                  </Typography>
                  <Typography
                    variant="h3"
                    sx={{ color: '#000000', fontWeight: 800, fontSize: '2.2rem', letterSpacing: -1 }}
                  >
                    ₹{Math.round(remainingFinanceAmount).toLocaleString('en-IN')}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', color: '#999999' }}>
                  <Typography variant="caption" sx={{ fontSize: '1rem' }}>
                    Cash in Hand
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Box>


        {/* Search Bar */}
        <Box sx={{ mt: 4, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Search by loan number, customer name, mobile, or referrer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#999999' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#999999',
                },
                '&.Mui-focused': {
                  borderColor: '#333333',
                  boxShadow: '0 0 0 2px rgba(51, 51, 51, 0.08)',
                }
              },
              '& .MuiOutlinedInput-input': {
                fontSize: '0.95rem',
                padding: '12px 14px',
              }
            }}
          />
        </Box>


        {/* Tabs for filtering - Professional Styling */}
        <Paper
          sx={{
            mb: 3,
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              bgcolor: '#ffffff',
              '& .MuiTab-root': {
                py: 1,
                px: 1.2,
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#666666',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease',
                borderBottom: '2px solid transparent',
                minWidth: 0,
                flex: 1,
                '&:hover': {
                  color: '#333333',
                  bgcolor: '#f9f9f9',
                },
                '&.Mui-selected': {
                  color: '#000000',
                  fontWeight: 700,
                  borderBottom: '2px solid #000000',
                },
              },
              '& .MuiTabs-indicator': {
                display: 'none',
              }
            }}
          >
            <Tab label={`All (${loans.length})`} value="all" />
            <Tab label={`Overdue (${overdueLoans.length})`} value="overdue" />
            <Tab label={`Active (${activeLoans.length})`} value="active" />
            <Tab label={`Closed (${closedLoans.length})`} value="closed" />
          </Tabs>
        </Paper>


        {/* Loans Display */}
        <Box>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: '#666666', mb: 2.5, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            {filteredLoans.length} loan{filteredLoans.length === 1 ? '' : 's'} found
          </Typography>
         
          {filteredLoans.length === 0 ? (
            <Paper
              sx={{
                p: 5,
                textAlign: 'center',
                bgcolor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
              }}
            >
              <Typography variant="h6" sx={{ color: '#999999', fontWeight: 600 }}>
                No loans found
              </Typography>
              {searchTerm && (
                <Typography variant="body2" sx={{ color: '#999999', mt: 1 }}>
                  Try adjusting your search terms
                </Typography>
              )}
            </Paper>
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
              <Stack spacing={2}>
                {filteredLoans.map((loan) => {
                  const isOverdue = isLoanOverdue(loan);
                  const penaltyAmount = getLivePenaltyAmount(loan);


                  const getStatusColor = (status) => {
                    const colors = {
                      active: '#e8e8e8',
                      closed: '#f5f5f5',
                      overdue: '#fff0f0',
                      defaulted: '#ffd5d5',
                      extended: '#fffaed',
                    };
                    return colors[status] || '#fafafa';
                  };


                  const getStatusBorder = (status) => {
                    const colors = {
                      active: '#333333',
                      closed: '#999999',
                      overdue: '#cc0000',
                      defaulted: '#990000',
                      extended: '#ff9800',
                    };
                    return colors[status] || '#e0e0e0';
                  };


                  const chipStatusColors = {
                    active: 'default',
                    overdue: 'default',
                    closed: 'default',
                    defaulted: 'default',
                    extended: 'default',
                  };
                  const chipColor = chipStatusColors[loan.status] || 'default';
                 
                  return (
                    <Card
                      key={loan.id}
                      sx={{
                        borderLeft: '4px solid',
                        borderColor: getStatusBorder(loan.status),
                        bgcolor: getStatusColor(loan.status),
                        cursor: 'pointer',
                        border: '1px solid #e0e0e0',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.25s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
                          transform: 'translateY(-2px)',
                          borderColor: '#999999',
                        },
                      }}
                      onClick={() => navigate(`${basePath}/loans/${loan.id}`)}
                    >
                      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                        {/* Header */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: '1.05rem', sm: '1.1rem' }, color: '#000000' }}>
                              {loan.customers?.name || 'N/A'}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                              <PhoneIcon sx={{ fontSize: 13, color: '#999999' }} />
                              <Typography variant="caption" sx={{ fontSize: '0.8rem', color: '#666666' }}>
                                {loan.customers?.mobile_number || 'N/A'}
                              </Typography>
                            </Stack>
                            {loan.customers?.reference_person_name && (
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, mt: 0.5, display: 'block', color: '#555555' }}>
                                Referrer: {loan.customers.reference_person_name}
                                {loan.customers?.reference_person_mobile && ` • ${loan.customers.reference_person_mobile}`}
                              </Typography>
                            )}
                          </Box>
                          <Chip
                            label={loan.status.toUpperCase()}
                            color={chipColor}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              bgcolor: '#f0f0f0',
                              color: '#333333',
                              border: '1px solid #d0d0d0',
                            }}
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
                              backgroundColor: '#fff0f0',
                              border: '1px solid #ffcccc',
                              color: '#cc0000',
                              '& .MuiAlert-icon': {
                                color: '#cc0000',
                              }
                            }}
                          >
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#cc0000' }}>
                              ⚠️ OVERDUE! Penalty: ₹{Number(penaltyAmount).toLocaleString('en-IN')}
                            </Typography>
                          </Alert>
                        )}


                        <Divider sx={{ my: 1.2, borderColor: '#e8e8e8' }} />


                        {/* Loan Details */}
                        <Stack spacing={0.8}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                              Loan Number
                            </Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem', color: '#000000' }}>
                              {loan.loan_number}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                              Total Loan
                            </Typography>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem', color: '#000000' }}>
                              ₹{Number(loan.total_loan_amount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                              Outstanding
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{
                                fontSize: '0.9rem',
                                color: loan.outstanding_amount > 0 ? '#cc0000' : '#00aa00',
                              }}
                            >
                              ₹{Number(loan.outstanding_amount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>


                          {isOverdue && penaltyAmount > 0 && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <WarningIcon sx={{ fontSize: 14, color: '#ff9800' }} />
                                <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#ff9800' }}>
                                  Penalty
                                </Typography>
                              </Stack>
                              <Typography
                                variant="body2"
                                fontWeight={700}
                                sx={{ fontSize: '0.9rem', color: '#ff9800' }}
                              >
                                ₹{Number(penaltyAmount).toLocaleString('en-IN')}
                              </Typography>
                            </Stack>
                          )}


                          <Divider sx={{ my: 0.6, borderColor: '#e8e8e8' }} />


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                              Start Date
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#000000', fontWeight: 500 }}>
                              {format(new Date(loan.start_date), 'dd/MMM/yyyy')}
                            </Typography>
                          </Stack>


                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                              Due Date
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {isOverdue && <WarningIcon sx={{ fontSize: 14, color: '#cc0000' }} />}
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{
                                  fontSize: '0.85rem',
                                  color: isOverdue ? '#cc0000' : '#000000',
                                }}
                              >
                                {format(new Date(loan.current_due_date), 'dd/MMM/yyyy')}
                              </Typography>
                            </Stack>
                          </Stack>


                          {loan.status === 'closed' && loan.closure_date && (
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666666', fontWeight: 500 }}>
                                Closed On
                              </Typography>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                sx={{ fontSize: '0.85rem', color: '#00aa00' }}
                              >
                                {format(new Date(loan.closure_date), 'dd/MMM/yyyy')}
                              </Typography>
                            </Stack>
                          )}


                          {/* Total Amount Due */}
                          {isOverdue && penaltyAmount > 0 && (
                            <>
                              <Divider sx={{ my: 0.8, borderColor: '#e8e8e8' }} />
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                                sx={{
                                  backgroundColor: '#fff0f0',
                                  p: 1.5,
                                  borderRadius: '6px',
                                  mt: 1,
                                  border: '1px solid #ffcccc',
                                }}
                              >
                                <Typography variant="body1" sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#cc0000' }}>
                                  Total Amount Due
                                </Typography>
                                <Typography
                                  variant="h6"
                                  fontWeight={800}
                                  sx={{ fontSize: '1.1rem', color: '#cc0000' }}
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