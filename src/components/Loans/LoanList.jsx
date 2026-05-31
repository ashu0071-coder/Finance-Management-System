import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Stack, Alert,
  CircularProgress,
  Divider,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { getLoans } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';
import { format } from 'date-fns';
import { calculatePenalty } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';


const LoanList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { canCreate } = usePermissions();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [penaltyRate, setPenaltyRate] = useState(80); // Default penalty rate


  useEffect(() => {
    fetchLoans();
    fetchSettings();
  }, [statusFilter]);


  const fetchLoans = async () => {
    try {
      setLoading(true);
      const filters = statusFilter === 'all' ? {} : { status: statusFilter };
      const data = await getLoans(filters);
      setLoans(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const fetchSettings = async () => {
    try {
      const settingsData = await getSettings();
      const penaltySetting = settingsData.find(s => s.key === 'penalty_rate_annual');
      if (penaltySetting) {
        setPenaltyRate(Number.parseFloat(penaltySetting.value));
      }
    } catch (err) {
      console.error('Failed to load penalty rate:', err);
    }
  };


  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      closed: 'default',
      overdue: 'warning',
      defaulted: 'error',
      extended: 'info',
    };
    return colors[status] || 'default';
  };


  const filteredLoans = loans.filter((loan) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      loan.loan_number?.toLowerCase().includes(search) ||
      loan.customers?.name?.toLowerCase().includes(search) ||
      loan.customers?.mobile_number?.includes(search)
    );
  });


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={50} />
      </Box>
    );
  }


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          Loans
        </Typography>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 20 }} />}
            onClick={() => navigate(`${basePath}/loans/new`)}
            sx={{ py: 1 }}
          >
            New Loan
          </Button>
        )}
      </Stack>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      {/* Filters */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            placeholder="Search by loan number, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
          />
         
          <TextField
            select
            fullWidth
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
          >
            <MenuItem value="all">All Loans</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
            <MenuItem value="extended">Extended</MenuItem>
            <MenuItem value="defaulted">Defaulted</MenuItem>
          </TextField>
        </Stack>
      </Paper>


      {/* Loan Count */}
      <Typography variant="body1" color="text.secondary" mb={2}>
        {filteredLoans.length} loan{filteredLoans.length === 1 ? '' : 's'} found
      </Typography>


      {/* Loan Cards - Scrollable with better spacing */}
      <Box
        sx={{
          maxHeight: 'calc(100vh - 320px)',
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
          {filteredLoans.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="text.secondary">
                  No loans found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            filteredLoans.map((loan) => {
            const isOverdue = new Date(loan.current_due_date) < new Date() && loan.status !== 'closed';
           
            // Calculate real-time penalty for overdue loans
            const penaltyAmount = isOverdue
              ? calculatePenalty(loan.total_loan_amount, loan.current_due_date, new Date(), penaltyRate)
              : loan.penalty_amount || 0;
           
            return (
              <Card
                key={loan.id}
                sx={{
                  borderLeft: '4px solid',
                  borderColor: isOverdue ? 'error.main' : getStatusColor(loan.status) + '.main',
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
                  {/* Header Row */}
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
                      color={getStatusColor(loan.status)}
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
                        Principal
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.875rem' }}>
                        ₹{Number(loan.principal_amount).toLocaleString('en-IN')}
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
                    {/* Penalty Amount - Show if overdue */}
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


                    {/* Closure Date - Show only for closed loans */}
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


                    {/* Total Amount Due for Overdue Loans */}
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


                  {/* Action Buttons */}
                  {loan.status !== 'closed' && loan.status !== 'defaulted' && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          startIcon={<ViewIcon fontSize="small" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`${basePath}/loans/${loan.id}`);
                          }}
                          sx={{ py: 0.75 }}
                        >
                          View
                        </Button>
                        {canCreate && (
                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            color="success"
                            startIcon={<PaymentIcon fontSize="small" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${basePath}/loans/${loan.id}/payment`);
                            }}
                            sx={{ py: 0.75 }}
                          >
                            Pay
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
        </Stack>
      </Box>
    </Box>
  );
};


export default LoanList;