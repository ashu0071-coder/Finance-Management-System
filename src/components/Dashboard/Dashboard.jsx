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
  Avatar,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  WarningAmberRounded as WarningIcon,
  Search as SearchIcon,
  PictureAsPdfRounded as PdfIcon,
  CalendarTodayRounded as CalendarIcon,
  WalletRounded as WalletIcon,
  AccountBalanceRounded as BankIcon,
  CurrencyRupeeRounded as RupeeIcon,
  TrendingUpRounded as TrendingUpIcon,
  PercentRounded as PercentIcon,
  GridViewRounded as GridViewIcon,
  ScheduleRounded as OverdueIcon,
  CheckCircleOutlineRounded as ActiveIcon,
  TaskAltRounded as ClosedIcon,
  TuneRounded as FilterIcon,
  PersonRounded as PersonIcon,
  BadgeRounded as BadgeIcon,
  EventRounded as EventIcon,
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
  const totalLoanOutflow = cashSummary.totalLoanOutflow;
  const totalLoanExtraCollection = cashSummary.totalLoanExtraCollection;


  const totalFinanceAmount = totalReceiptInflow;
  const remainingFinanceAmountRaw = cashSummary.rawCashInHand;
  const remainingCashInBankRaw = cashInBankBase;


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


  const tabItems = [
    { value: 'all', label: 'All', count: loans.length, icon: <GridViewIcon sx={{ fontSize: 22, color:'#1865e1' }} /> },
    { value: 'overdue', label: 'Overdue', count: overdueLoans.length, icon: <OverdueIcon sx={{ fontSize: 22, color:'#d32f2f' }} /> },
    { value: 'active', label: 'Active', count: activeLoans.length, icon: <ActiveIcon sx={{ fontSize: 22, color:'#388e3c' }} /> },
    { value: 'closed', label: 'Closed', count: closedLoans.length, icon: <ClosedIcon sx={{ fontSize: 22, color:'#111935' }} /> },
  ];


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 }, px: { xs: 0.5, sm: 0 }, bgcolor: '#f4f7fd' }}>
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #dce8ff',
            backgroundImage: 'linear-gradient(100deg, rgba(248,251,255,0.82) 0%, rgba(241,246,255,0.64) 45%, rgba(233,240,255,0.24) 68%, rgba(233,240,255,0.08) 100%), url(/AC196C3A-D12F-45E0-92C9-DF3216806A88.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
            backgroundRepeat: 'no-repeat',
            '&::before': {
              content: '""',
              position: 'absolute',
              right: -80,
              top: -80,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(43,108,236,0.04) 0%, rgba(43,108,236,0) 72%)',
            },
          }}
        >
          <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography sx={{ fontWeight: 700, color: '#1865e1', fontSize: '1.05rem' }}>
                Welcome back!
              </Typography>
              <Typography
                variant="h3"
                sx={{ fontWeight: 800, color: '#17223a', fontSize: { xs: '2rem', sm: '2.5rem' }, lineHeight: 1.1, mt: 0.6 }}
              >
                Dashboard
              </Typography>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 1.4, color: '#6f7a8f' }}>
                <CalendarIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {format(new Date(), 'dd/MMM/yyyy')}
                </Typography>
              </Stack>
              <Button
                variant="contained"
                startIcon={<PdfIcon />}
                onClick={handleDownloadPDF}
                sx={{
                  mt: 2,
                  borderRadius: 2,
                  px: 1.2,
                  py: 1,
                  textTransform: 'none',
                  fontSize:'13px',
                  fontWeight: 700,
                  bgcolor: '#3f7ee5',
                  boxShadow: '0 10px 20px rgba(24,101,225,0.3)',
                  '&:hover': { bgcolor: '#5074b0' },
                }}
              >
                Download Loans PDF
              </Button>
            </Box>


          </Stack>
        </Paper>


        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1b243b' }}>
            Financial Summary
          </Typography>
          <Typography sx={{ color: '#6d7690', mt: 0.4, mb: 1.6 }}>
            Overview of your loan details
          </Typography>


          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {[
              {
                title: 'DEPOSIT RECEIPT',
                value: totalDepositReceipts,
                subtitle: 'Total amount deposited',
                icon: <WalletIcon />,
                iconBg: '#e9f8ee',
                iconColor: '#1f9d50',
                tint: 'rgba(40,167,69,0.12)',
              },
              {
                title: 'LOAN AMOUNT ISSUED',
                value: totalLoanOutflow,
                subtitle: 'Total amount issued',
                icon: <RupeeIcon />,
                iconBg: '#eaf1ff',
                iconColor: '#2168da',
                tint: 'rgba(64,123,255,0.14)',
              },
              {
                title: 'COLLECTION & INTEREST',
                value: totalLoanExtraCollection,
                subtitle: 'Track collections and interest earned on loans',
                icon: <PercentIcon />,
                iconBg: '#fff1e4',
                iconColor: '#f57c00',
                tint: 'rgba(255,152,0,0.14)',
              },
              {
                title: 'CASH IN BANK',
                value: remainingCashInBank,
                subtitle: 'Current balance available in bank',
                icon: <BankIcon />,
                iconBg: '#e6fbff',
                iconColor: '#007c91',
                tint: 'rgba(0,124,145,0.16)',
              },
              {
                title: 'CASH IN HAND',
                value: remainingFinanceAmount,
                subtitle: 'Available cash in hand',
                icon: <WalletIcon />,
                iconBg: '#f1edff',
                iconColor: '#6b4fd3',
                tint: 'rgba(107,79,211,0.16)',
              },
            ].map((item) => (
              <Paper
                key={item.title}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid #e4ebf7',
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'linear-gradient(120deg, #ffffff 0%, #f8fbff 100%)',


                  // Bottom wave
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    right: -20,
                    bottom: -30,
                    width: '75%',
                    height: '60%',
                    borderRadius: '90% 10% 0% 0% / 90% 60% 0% 0%',
                    background: `linear-gradient(135deg, ${item.tint} 0%, rgba(255,255,255,0) 100%)`,
                  },


                  // Top-right blob
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    right: -10,
                    top: -20,
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: `${item.tint}`,
                    opacity: 0.5,
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.6}>
                  <Stack direction="row" spacing={1.4} alignItems="flex-start" sx={{ minWidth: 0 }}>
                    <Avatar sx={{ width: 48, height: 48, bgcolor: item.iconBg, color: item.iconColor }}>
                      {item.icon}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: item.iconColor }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ mt: 0.3, fontWeight: 800, fontSize: '2rem', color: '#111935', lineHeight: 1.1 }}>
                        ₹{Math.round(item.value).toLocaleString('en-IN')}
                      </Typography>
                      <Typography sx={{ color: '#6b7590', fontSize: '0.89rem', mt: 0.5 }}>
                        {item.subtitle}
                      </Typography>
                    </Box>
                  </Stack>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: item.iconBg, color: item.iconColor }}>
                    <TrendingUpIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                </Stack>
              </Paper>
            ))}
          </Box>
        </Box>


        <TextField
          fullWidth
          placeholder="Search by loan number, customer name, mobile number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#7f889f' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <FilterIcon sx={{ color: '#2f7ceb' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: '#fff',
              '& fieldset': { borderColor: '#dfe7f5' },
              '&:hover fieldset': { borderColor: '#93b6ee' },
              '&.Mui-focused fieldset': { borderColor: '#2f7ceb' },
            },
            '& .MuiOutlinedInput-input': {
              py: 1.4,
            },
          }}
        />


        <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #dfe7f5', overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 74,
              '& .MuiTab-root': {
                minHeight: 74,
                textTransform: 'none',
                color: '#4a556d',
                fontWeight: 700,
                py: 0.8,
              },
              '& .Mui-selected': {
                color: '#1f64d0',
                bgcolor: '#f1f6ff',
              },
              '& .MuiTabs-indicator': {
                height: 3,
                bgcolor: '#1f64d0',
              },
            }}
          >
            {tabItems.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={
                  <Stack spacing={0.4} alignItems="center">
                    <Box sx={{ color: 'inherit' }}>{tab.icon}</Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>
                      {tab.label} ({tab.count})
                    </Typography>
                  </Stack>
                }
              />
            ))}
          </Tabs>
        </Paper>


        <Box>
          <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, color: '#313a4d', letterSpacing: 0.3, mb: 1.2 }}>
            {filteredLoans.length} LOANS FOUND
          </Typography>


          {filteredLoans.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                borderRadius: 2.5,
                border: '1px solid #e3eaf7',
                textAlign: 'center',
                bgcolor: '#fff',
              }}
            >
              <Avatar sx={{ width: 76, height: 76, mx: 'auto', mb: 1.6, bgcolor: '#e8f0ff', color: '#2f7ceb' }}>
                <SearchIcon sx={{ fontSize: 38 }} />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#1f2a44' }}>
                No loans found
              </Typography>
              <Typography sx={{ color: '#6c7690', mt: 0.6 }}>
                Try adjusting your search or filters
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.3}>
              {filteredLoans.map((loan) => {
                const isOverdue = isLoanOverdue(loan);
                const penaltyAmount = getLivePenaltyAmount(loan);


                const statusStyle = {
                  active: { bg: '#e8f6ed', color: '#1b8f4b' },
                  closed: { bg: '#edf3ff', color: '#2f7ceb' },
                  overdue: { bg: '#fff1f0', color: '#d93025' },
                  defaulted: { bg: '#fff1f0', color: '#d93025' },
                  extended: { bg: '#fff8e9', color: '#f57c00' },
                };


                const chipStyle = statusStyle[loan.status] || { bg: '#f0f4fa', color: '#4b5671' };


                return (
                  <Card
                    key={loan.id}
                    elevation={0}
                    onClick={() => navigate(`${basePath}/loans/${loan.id}`)}
                    sx={{
                      borderRadius: 2.5,
                      border: '1px solid #e1e8f6',
                      cursor: 'pointer',
                      transition: 'all .18s ease',
                      '&:hover': {
                        boxShadow: '0 8px 20px rgba(23,55,110,0.09)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '1.05rem', fontWeight: 800, color: '#18233d' }}>
                            {loan.customers?.name || 'N/A'}
                          </Typography>
                          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 0.4, color: '#69748e' }}>
                            <Stack direction="row" spacing={0.4} alignItems="center">
                              <PhoneIcon sx={{ fontSize: 15 }} />
                              <Typography sx={{ fontSize: '0.82rem' }}>{loan.customers?.mobile_number || 'N/A'}</Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.4} alignItems="center">
                              <BadgeIcon sx={{ fontSize: 15 }} />
                              <Typography sx={{ fontSize: '0.82rem' }}>{loan.loan_number || '-'}</Typography>
                            </Stack>
                          </Stack>
                          {loan.customers?.reference_person_name && (
                            <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mt: 0.5, color: '#74809c' }}>
                              <PersonIcon sx={{ fontSize: 14 }} />
                              <Typography sx={{ fontSize: '0.78rem' }}>
                                {loan.customers.reference_person_name}
                                {loan.customers?.reference_person_mobile ? ` • ${loan.customers.reference_person_mobile}` : ''}
                              </Typography>
                            </Stack>
                          )}
                        </Box>
                        <Chip
                          label={(loan.status || 'active').toUpperCase()}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.68rem',
                            bgcolor: chipStyle.bg,
                            color: chipStyle.color,
                            borderRadius: 1.3,
                          }}
                        />
                      </Stack>


                      {isOverdue && penaltyAmount > 0 && (
                        <Alert
                          severity="warning"
                          icon={<WarningIcon sx={{ color: '#ef6c00' }} />}
                          sx={{
                            mt: 1.2,
                            mb: 1.2,
                            borderRadius: 1.5,
                            bgcolor: '#fff6e8',
                            border: '1px solid #ffe0b2',
                            '& .MuiAlert-message': { width: '100%' },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#915000' }}>
                              Overdue Penalty
                            </Typography>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 900, color: '#ef6c00' }}>
                              ₹{Number(penaltyAmount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>
                        </Alert>
                      )}


                      <Divider sx={{ my: 1 }} />


                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.1 }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.72rem', color: '#72809f', fontWeight: 700 }}>Total Loan</Typography>
                          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#17223a', mt: 0.2 }}>
                            ₹{Number(loan.total_loan_amount || 0).toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontSize: '0.72rem', color: '#72809f', fontWeight: 700 }}>Outstanding</Typography>
                          <Typography
                            sx={{
                              fontSize: '1rem',
                              fontWeight: 900,
                              mt: 0.2,
                              color: Number(loan.outstanding_amount) > 0 ? '#d93025' : '#1b8f4b',
                            }}
                          >
                            ₹{Number(loan.outstanding_amount || 0).toLocaleString('en-IN')}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <EventIcon sx={{ fontSize: 14, color: '#7d89a5' }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.72rem', color: '#72809f', fontWeight: 700 }}>Start Date</Typography>
                            <Typography sx={{ fontSize: '0.82rem', color: '#223151', fontWeight: 700 }}>
                              {loan.start_date ? format(new Date(loan.start_date), 'dd/MMM/yyyy') : '-'}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={0.6} alignItems="center">
                          <CalendarIcon sx={{ fontSize: 14, color: isOverdue ? '#d93025' : '#7d89a5' }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.72rem', color: '#72809f', fontWeight: 700 }}>Due Date</Typography>
                            <Typography
                              sx={{
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                color: isOverdue ? '#d93025' : '#223151',
                              }}
                            >
                              {loan.current_due_date ? format(new Date(loan.current_due_date), 'dd/MMM/yyyy') : '-'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>


                      {isOverdue && penaltyAmount > 0 && (
                        <Paper
                          elevation={0}
                          sx={{
                            mt: 1.2,
                            px: 1.2,
                            py: 1,
                            borderRadius: 1.6,
                            border: '1px solid #ffcdd2',
                            bgcolor: '#fff5f6',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontWeight: 700, color: '#c62828', fontSize: '0.85rem' }}>
                              Total Amount Due
                            </Typography>
                            <Typography sx={{ fontWeight: 900, color: '#c62828', fontSize: '1rem' }}>
                              ₹{(Number(loan.outstanding_amount) + Number(penaltyAmount)).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>
                        </Paper>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}