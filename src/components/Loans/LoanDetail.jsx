import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Alert,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  Extension as ExtensionIcon,
  ArrowBack as BackIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getLoan, extendLoan } from '../../services/loanService';
import { getPaymentsByLoan } from '../../services/paymentService';
import { getSettings } from '../../services/settingsService';
import { calculatePenalty, calculateMissedCycles } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';


const LoanDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const [loan, setLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extensionDialog, setExtensionDialog] = useState(false);
  const [extendingLoan, setExtendingLoan] = useState(false);
  const [extensionNotes, setExtensionNotes] = useState('');
  const [penaltyRate, setPenaltyRate] = useState(80); // Default annual penalty rate


  useEffect(() => {
    fetchLoanDetails();
    fetchSettings();
  }, [id]);


  const fetchLoanDetails = async () => {
    try {
      setLoading(true);
      const [loanData, paymentsData] = await Promise.all([
        getLoan(id),
        getPaymentsByLoan(id),
      ]);
      setLoan(loanData);
      setPayments(paymentsData);
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


  const handleExtendLoan = async () => {
    try {
      setExtendingLoan(true);
      await extendLoan(id, extensionNotes);
      setExtensionDialog(false);
      setExtensionNotes('');
      await fetchLoanDetails();
    } catch (err) {
      setError(err.message);
    } finally {
      setExtendingLoan(false);
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


  if (loading) {
    return <Typography>Loading...</Typography>;
  }


  if (error || !loan) {
    return (
      <Alert severity="error">
        {error || 'Loan not found'}
      </Alert>
    );
  }


  const isOverdue = new Date(loan.current_due_date) < new Date() && loan.status !== 'closed';
  const canExtend = canEdit && loan.status === 'active' && !isOverdue;
  const canPayment = canCreate && loan.status !== 'closed' && loan.status !== 'defaulted';


  // Calculate real-time penalty for overdue loans
  const currentPenalty = isOverdue
    ? calculatePenalty(loan.total_loan_amount, loan.current_due_date, new Date(), penaltyRate)
    : loan.penalty_amount || 0;


  // Calculate real-time missed cycles
  const currentMissedCycles = calculateMissedCycles(loan.original_due_date, new Date());


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(`${basePath}/loans`)}
            sx={{ minWidth: { xs: 'auto', sm: 'auto' } }}
          >
            <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>Back to Loans</Box>
            <Box sx={{ display: { xs: 'inline', sm: 'none' } }}>Back</Box>
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
            {loan.loan_number}
          </Typography>
          <Chip
            label={loan.status.toUpperCase()}
            color={getStatusColor(loan.status)}
            sx={{ fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          {canExtend && (
            <Button
              variant="outlined"
              startIcon={<ExtensionIcon />}
              onClick={() => setExtensionDialog(true)}
              fullWidth={true}
              sx={{ display: { xs: 'flex', sm: 'inline-flex' }, py: { xs: 1.5, sm: 1 } }}
            >
              Extend Loan
            </Button>
          )}
          {canPayment && (
            <Button
              variant="contained"
              startIcon={<PaymentIcon />}
              onClick={() => navigate(`${basePath}/loans/${id}/payment`)}
              fullWidth={true}
              sx={{ display: { xs: 'flex', sm: 'inline-flex' }, py: { xs: 1.5, sm: 1 } }}
            >
              Make Payment
            </Button>
          )}
        </Box>
      </Box>


      {loan.status === 'defaulted' && (
        <Alert severity="error" sx={{ mb: 2 }} icon={<WarningIcon />}>
          This loan has been marked as DEFAULTED. Contact reference person: {loan.customers.reference_person_name} ({loan.customers.reference_person_mobile})
        </Alert>
      )}


      {isOverdue && loan.status !== 'defaulted' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This loan is overdue. Penalty: ₹{Number(currentPenalty).toLocaleString()}
        </Alert>
      )}


      <Grid container spacing={3}>
        {/* Customer Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Customer Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Name:</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body1">{loan.customers.name}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Mobile:</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body1">{loan.customers.mobile_number}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Reference:</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body1">
                    {loan.customers.reference_person_name}
                    <br />
                    <Typography variant="body2" color="text.secondary">
                      {loan.customers.reference_person_mobile}
                    </Typography>
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>


        {/* Loan Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Loan Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Principal Amount:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" fontWeight="bold">
                    ₹{Number(loan.principal_amount).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Interest ({loan.interest_rate}%):</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" color="warning.main">
                    ₹{Number(loan.interest_amount).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Net Disbursed:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" color="success.main" fontWeight="bold">
                    ₹{Number(loan.net_disbursed_amount).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Total Loan:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h6" color="primary">
                    ₹{Number(loan.total_loan_amount).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>


        {/* Payment Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Payment Status
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', bgcolor: 'success.light' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Paid Amount</Typography>
                    <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>₹{Number(loan.total_paid).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', bgcolor: 'error.light' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Outstanding</Typography>
                    <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>₹{Number(loan.outstanding_amount).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', bgcolor: 'warning.light' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Penalty</Typography>
                    <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>₹{Number(currentPenalty).toLocaleString()}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', bgcolor: 'info.light' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Extensions</Typography>
                    <Typography variant="h5" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>{loan.extension_count}</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>


        {/* Dates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Important Dates
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Start Date:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1">
                    {format(new Date(loan.start_date), 'dd/MM/yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Original Due:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1">
                    {format(new Date(loan.original_due_date), 'dd/MM/yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Current Due:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" color={isOverdue ? 'error' : 'inherit'} fontWeight="bold">
                    {format(new Date(loan.current_due_date), 'dd/MM/yyyy')}
                    {isOverdue && ' (OVERDUE)'}
                  </Typography>
                </Grid>
                {loan.closure_date && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Closure Date:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1" color="success.main">
                        {format(new Date(loan.closure_date), 'dd/MM/yyyy')}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>


        {/* Additional Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Additional Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Tenure:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1">{loan.tenure_months} months</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Missed Cycles:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" color={currentMissedCycles > 0 ? 'error' : 'inherit'}>
                    {currentMissedCycles}
                  </Typography>
                </Grid>
                {loan.cheque_numbers && loan.cheque_numbers.length > 0 && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Cheque Numbers:</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body1">
                        {loan.cheque_numbers.join(', ')}
                      </Typography>
                    </Grid>
                  </>
                )}
                {loan.notes && (
                  <>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Notes:</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body1">{loan.notes}</Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>


        {/* Payment History */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Payment History
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {payments.length === 0 ? (
                <Typography color="text.secondary">No payments made yet</Typography>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Date</TableCell>
                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Type</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Amount</TableCell>
                        <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Refund</TableCell>
                        <TableCell align="right" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Net Payment</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Method</TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {format(new Date(payment.payment_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Chip label={payment.payment_type.toUpperCase()} size="small" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' } }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            ₹{Number(payment.amount).toLocaleString()}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main', display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {payment.refund_amount > 0 && `+₹${Number(payment.refund_amount).toLocaleString()}`}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            ₹{Number(payment.net_payment).toLocaleString()}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{payment.payment_method || '-'}</TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{payment.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Extension Dialog */}
      <Dialog open={extensionDialog} onClose={() => setExtensionDialog(false)}>
        <DialogTitle>Extend Loan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            To extend this loan, the customer must pay the full interest amount of ₹{Number(loan.interest_amount).toLocaleString()}.
            The due date will be extended by {loan.tenure_months} months.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Notes"
            value={extensionNotes}
            onChange={(e) => setExtensionNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExtensionDialog(false)}>Cancel</Button>
          <Button
            onClick={handleExtendLoan}
            variant="contained"
            disabled={extendingLoan}
          >
            {extendingLoan ? 'Extending...' : 'Confirm Extension'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


export default LoanDetail;



