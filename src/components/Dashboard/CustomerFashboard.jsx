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
} from '@mui/material';
import {
  Warning,
  CheckCircle,
  Phone as PhoneIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getLoans } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';
import { calculatePenalty } from '../../utils/calculations';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';


const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [penaltyRate, setPenaltyRate] = useState(80);


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
      // For customers, loans will be automatically filtered by RLS policies
      const [loansData, settingsData] = await Promise.all([
        getLoans(),
        getSettings(),
      ]);
      setLoans(loansData);
     
      const penaltySetting = settingsData.find(s => s.key === 'penalty_rate_annual');
      if (penaltySetting) {
        setPenaltyRate(Number.parseFloat(penaltySetting.value));
      }
     
      setError(null);
    } catch (err) {
      setError('Failed to load your loans: ' + err.message);
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
 
  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + Number(l.outstanding_amount || 0),
    0
  );
 
  const totalBorrowed = loans.reduce(
    (sum, l) => sum + Number(l.total_loan_amount || 0),
    0
  );


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Dashboard
          </Typography>
          <Typography color="text.secondary">
            {format(new Date(), 'dd/MMM/yyyy')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Logged in as: {user?.email}
          </Typography>
        </Box>


        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        {/* Key Statistics */}
        <div style={{display:'flex', gap: '8px'}}>
          <div style={{width: 'calc(50% - 4px)'}}>
            <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <CheckCircle sx={{ fontSize: 32}} />
                <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
                  {activeLoans.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Active Loans</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{width: 'calc(50% - 4px)'}}>
            <Card sx={{ bgcolor: 'error.main', color: 'white', height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Warning sx={{ fontSize: 32}} />
                <Typography variant="h5" fontWeight={600} sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
                  {overdueLoans.length}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Overdue</Typography>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Money Summary */}
        <div style={{display:'flex', gap: '8px'}}>
          <div style={{width: '50%'}}>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Total Outstanding
              </Typography>
              <Typography variant="h5" color="error.main" fontWeight={600} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                ₹{totalOutstanding.toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </div>
          <div style={{width: '50%'}}>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Total Borrowed
              </Typography>
              <Typography variant="h5" color="primary.main" fontWeight={600} sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                ₹{totalBorrowed.toLocaleString('en-IN')}
              </Typography>
            </Paper>
          </div>
        </div>


        {/* Overdue Loans */}
        {overdueLoans.length > 0 && (
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
              <Warning color="error" />
              <Typography variant="h6" fontWeight={600} color="error">
                Overdue Loans ({overdueLoans.length})
              </Typography>
            </Stack>
            <Box
              sx={{
                maxHeight: 'calc(100vh - 500px)',
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
                {overdueLoans.map((loan) => {
                  const penaltyAmount = calculatePenalty(loan.total_loan_amount, loan.current_due_date, new Date(), penaltyRate);
                 
                  return (
                    <Card
                      key={loan.id}
                      sx={{
                        borderLeft: '4px solid',
                        borderColor: 'error.main',
                        cursor: 'pointer',
                        boxShadow: 2,
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          boxShadow: 6,
                          transform: 'translateY(-2px)',
                        },
                      }}
                      onClick={() => navigate(`/finance/loans/${loan.id}`)}
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
                            label="OVERDUE"
                            color="error"
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        </Stack>


                        {/* Overdue Alert */}
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
                              color="error.main"
                              sx={{ fontSize: '0.95rem' }}
                            >
                              ₹{Number(loan.outstanding_amount).toLocaleString('en-IN')}
                            </Typography>
                          </Stack>


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
                              <WarningIcon color="error" sx={{ fontSize: 14 }} />
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                color="error"
                                sx={{ fontSize: '0.875rem' }}
                              >
                                {format(new Date(loan.current_due_date), 'dd/MMM/yyyy')}
                              </Typography>
                            </Stack>
                          </Stack>


                          {/* Total Amount Due */}
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
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        )}


        {/* Active Loans */}
        {activeLoans.length > 0 && (
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom mb={2}>
              Active Loans ({activeLoans.length})
            </Typography>
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
                {activeLoans.map((loan) => (
                  <Card
                    key={loan.id}
                    sx={{
                      borderLeft: '4px solid',
                      borderColor: 'success.main',
                      cursor: 'pointer',
                      boxShadow: 2,
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-2px)',
                      },
                    }}
                    onClick={() => navigate(`/finance/loans/${loan.id}`)}
                  >
                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
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
                        <Chip label="ACTIVE" color="success" size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Loan Number</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>{loan.loan_number}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Total Loan</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>₹{Number(loan.total_loan_amount).toLocaleString('en-IN')}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Outstanding</Typography>
                          <Typography variant="body2" fontWeight={600} color={loan.outstanding_amount > 0 ? 'error.main' : 'success.main'} sx={{ fontSize: '0.95rem' }}>
                            ₹{Number(loan.outstanding_amount).toLocaleString('en-IN')}
                          </Typography>
                        </Stack>
                        <Divider sx={{ my: 0.8 }} />
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Start Date</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{format(new Date(loan.start_date), 'dd/MMM/yyyy')}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Due Date</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                            {format(new Date(loan.current_due_date), 'dd/MMM/yyyy')}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Box>
        )}


        {/* Closed Loans */}
        {closedLoans.length > 0 && (
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom mb={2}>
              Closed Loans ({closedLoans.length})
            </Typography>
            <Box
              sx={{
                maxHeight: 'calc(100vh - 500px)',
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
                {closedLoans.map((loan) => (
                  <Card
                    key={loan.id}
                    sx={{
                      borderLeft: '4px solid',
                      borderColor: 'info.main',
                      cursor: 'pointer',
                      boxShadow: 2,
                      transition: 'all 0.3s ease-in-out',
                      '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-2px)',
                      },
                    }}
                    onClick={() => navigate(`/finance/loans/${loan.id}`)}
                  >
                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
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
                        <Chip label="CLOSED" color="default" size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                      </Stack>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Loan Number</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>{loan.loan_number}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Total Loan</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>₹{Number(loan.total_loan_amount).toLocaleString('en-IN')}</Typography>
                        </Stack>
                        <Divider sx={{ my: 0.8 }} />
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Start Date</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{format(new Date(loan.start_date), 'dd/MMM/yyyy')}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Due Date</Typography>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                            {format(new Date(loan.current_due_date), 'dd/MMM/yyyy')}
                          </Typography>
                        </Stack>
                        {loan.closure_date && (
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>Closed On</Typography>
                            <Typography variant="body2" fontWeight={500} color="success.main" sx={{ fontSize: '0.875rem' }}>
                              {format(new Date(loan.closure_date), 'dd/MMM/yyyy')}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          </Box>
        )}


        {/* No Loans Message */}
        {loans.length === 0 && (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Loans Found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You don't have any loans yet. Contact your administrator for assistance.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  );
};


export default CustomerDashboard;