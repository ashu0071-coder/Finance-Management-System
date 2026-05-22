import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Grid,
  Alert,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Paper,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { getLoan } from '../../services/loanService';
import { createPayment } from '../../services/paymentService';
import { getSettings } from '../../services/settingsService';
import { calculateEarlyPaymentRefund, calculatePenalty, calculateBondFee } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';


const PaymentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [penaltyRate, setPenaltyRate] = useState(80); // Default annual penalty rate


  const [formData, setFormData] = useState({
    payment_date: new Date(),
    amount: '',
    payment_type: 'full',
    payment_method: 'cash',
    transaction_reference: '',
    notes: '',
  });


  const [refundAmount, setRefundAmount] = useState(0);


  useEffect(() => {
    fetchLoan();
    fetchSettings();
  }, [id]);


  useEffect(() => {
    if (loan && formData.payment_date) {
      if (formData.payment_type !== 'full') {
        setRefundAmount(0);
        return;
      }


      // Fallback bond fee remains for older records, but refund is based on unused interest only.
      const fallbackBondFee = calculateBondFee(loan.total_loan_amount || 0);
      const refund = calculateEarlyPaymentRefund(
        loan.start_date,
        loan.interest_amount,
        loan.tenure_months,
        formData.payment_date,
        loan.bond_fee || 0,
        fallbackBondFee
      );
      setRefundAmount(refund);
    }
  }, [loan, formData.payment_date, formData.payment_type]);


  useEffect(() => {
    if (loan && formData.payment_type === 'full') {
      // Calculate the actual amount to collect from the borrower.
      // For early settlement, borrower pays outstanding minus refundable unused interest.
      const isOverdue = new Date(loan.current_due_date) < new Date(formData.payment_date) && loan.status !== 'closed';
      const penalty = isOverdue
        ? calculatePenalty(loan.total_loan_amount, loan.current_due_date, formData.payment_date, penaltyRate)
        : loan.penalty_amount || 0;
      const totalAmount = Math.max(0, loan.outstanding_amount + penalty - refundAmount);
      setFormData(prev => ({
        ...prev,
        amount: totalAmount.toString(),
      }));
    }
  }, [formData.payment_type, loan, penaltyRate, refundAmount, formData.payment_date]);


  const fetchLoan = async () => {
    try {
      const loanData = await getLoan(id);
      setLoan(loanData);
      setFormData(prev => ({
        ...prev,
        amount: loanData.outstanding_amount.toString(),
      }));
    } catch (err) {
      setError(err.message);
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


  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);


    try {
      const paymentData = {
        loan_id: id,
        payment_date: formData.payment_date.toISOString().split('T')[0],
        amount: Number.parseFloat(formData.amount),
        payment_type: formData.payment_type,
        payment_method: formData.payment_method,
        transaction_reference: formData.transaction_reference,
        refund_amount: refundAmount,
        net_payment: Number.parseFloat(formData.amount) + refundAmount,
        notes: formData.notes,
      };


      await createPayment(paymentData);
      navigate(`${basePath}/loans/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  if (!loan) {
    return <Typography>Loading...</Typography>;
  }


  const netPayment = Number.parseFloat(formData.amount || 0) + refundAmount;
  const isEarlyPayment = new Date(formData.payment_date) < new Date(loan.current_due_date);
 
  // Calculate real-time penalty for overdue loans
  const isOverdue = new Date(loan.current_due_date) < new Date() && loan.status !== 'closed';
  const currentPenalty = isOverdue
    ? calculatePenalty(loan.total_loan_amount, loan.current_due_date, new Date(), penaltyRate)
    : loan.penalty_amount || 0;


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 700, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        Make Payment - {loan.loan_number}
      </Typography>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      {isOverdue && currentPenalty > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Overdue Payment!</strong> This loan is overdue since {format(new Date(loan.current_due_date), 'dd/MM/yyyy')}.
          A penalty of ₹{currentPenalty.toLocaleString()} has been added to the total amount.
        </Alert>
      )}


      {isEarlyPayment && refundAmount > 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <strong>Early Payment Benefit!</strong> Paying before the due date ({format(new Date(loan.current_due_date), 'dd/MM/yyyy')})
          will save you ₹{refundAmount.toLocaleString()} in interest!
        </Alert>
      )}


      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                  Payment Details
                </Typography>
                <Divider sx={{ mb: 3 }} />


                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <FormLabel component="legend" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Payment Type</FormLabel>
                      <RadioGroup
                        row={false}
                        value={formData.payment_type}
                        onChange={(e) => handleChange('payment_type', e.target.value)}
                        sx={{ flexDirection: { xs: 'column', sm: 'row' } }}
                      >
                        <FormControlLabel value="full" control={<Radio />} label="Full Payment" sx={{ '& .MuiTypography-root': { fontSize: { xs: '0.9rem', sm: '1rem' } } }} />
                        <FormControlLabel value="partial" control={<Radio />} label="Partial Payment" sx={{ '& .MuiTypography-root': { fontSize: { xs: '0.9rem', sm: '1rem' } } }} />
                      </RadioGroup>
                    </FormControl>
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                      <DatePicker
                        label="Payment Date"
                        value={formData.payment_date}
                        onChange={(date) => handleChange('payment_date', date)}
                        inputFormat="dd/MM/yyyy"
                        renderInput={(params) => <TextField {...params} fullWidth required />}
                      />
                    </LocalizationProvider>
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Payment Amount"
                      value={formData.amount}
                      onChange={(e) => handleChange('amount', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      inputProps={{
                        min: 0,
                        max: loan.outstanding_amount + currentPenalty,
                      }}
                      InputProps={{ startAdornment: '₹' }}
                      disabled={formData.payment_type === 'full'}
                      helperText={isOverdue ? `Includes penalty: ₹${currentPenalty.toLocaleString()}` : ''}
                    />
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      required
                      label="Payment Method"
                      value={formData.payment_method}
                      onChange={(e) => handleChange('payment_method', e.target.value)}
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="cheque">Cheque</MenuItem>
                      <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="card">Card</MenuItem>
                    </TextField>
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Transaction Reference"
                      value={formData.transaction_reference}
                      onChange={(e) => handleChange('transaction_reference', e.target.value)}
                      placeholder="Cheque no, Transaction ID, etc."
                    />
                  </Grid>


                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      value={formData.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>


          <Grid item xs={12} md={4}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default', mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Loan Summary
              </Typography>
              <Divider sx={{ my: 2 }} />
             
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {loan.customers.name}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Loan Amount
                </Typography>
                <Typography variant="h6">
                  ₹{Number(loan.total_loan_amount).toLocaleString()}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Already Paid
                </Typography>
                <Typography variant="body1" color="success.main">
                  ₹{Number(loan.total_paid).toLocaleString()}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Penalty Amount
                </Typography>
                <Typography variant="body1" color="warning.main" fontWeight="bold">
                  ₹{Number(currentPenalty).toLocaleString()}
                </Typography>
                {isOverdue && currentPenalty > 0 && (
                  <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 0.5 }}>
                    Due date passed: {format(new Date(loan.current_due_date), 'dd/MM/yyyy')}
                  </Typography>
                )}
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Outstanding Amount
                </Typography>
                <Typography variant="h6" color="error.main">
                  ₹{Number(loan.outstanding_amount).toLocaleString()}
                </Typography>
              </Box>


              <Divider sx={{ my: 2 }} />


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">
                  Total Amount Due (Outstanding + Penalty)
                </Typography>
                <Typography variant="h5" color="error.main" fontWeight="bold">
                  ₹{Number(loan.outstanding_amount + currentPenalty).toLocaleString()}
                </Typography>
              </Box>
            </Paper>


            <Paper sx={{ p: 3, bgcolor: isEarlyPayment ? 'success.light' : 'background.default', mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Payment Calculation
              </Typography>
              <Divider sx={{ my: 2 }} />
             
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Borrower Pays
                </Typography>
                <Typography variant="h6">
                  ₹{Number(formData.amount || 0).toLocaleString()}
                </Typography>
              </Box>


              {isEarlyPayment && refundAmount > 0 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.dark">
                      Early Payment Refund 🎉
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      ₹{refundAmount.toLocaleString()}
                    </Typography>
                  </Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Great! Paying early saves you ₹{refundAmount.toLocaleString()} in interest.
                    You only need to pay ₹{Number(formData.amount || 0).toLocaleString()} instead of ₹{netPayment.toLocaleString()}.
                  </Alert>
                </>
              )}


              <Divider sx={{ my: 2 }} />


              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">
                  {isEarlyPayment ? 'Settlement Credit Applied To Loan' : 'Payment Applied To Loan'}
                </Typography>
                <Typography variant="h4" color={isEarlyPayment ? 'text.secondary' : 'primary'} fontWeight="bold">
                  ₹{netPayment.toLocaleString()}
                </Typography>
                {isEarlyPayment && (
                  <Typography variant="caption" color="success.dark" sx={{ display: 'block', mt: 0.5 }}>
                    Borrower pays less, but the loan still gets full credit including the waived interest.
                  </Typography>
                )}
              </Box>


              {formData.payment_type === 'full' && netPayment > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This will close the loan.
                </Alert>
              )}
            </Paper>
          </Grid>
        </Grid>


        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !formData.amount || Number.parseFloat(formData.amount) === 0}
          >
            {loading ? 'Processing...' : 'Record Payment'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(`${basePath}/loans/${id}`)}
            disabled={loading}
          >
            Cancel
          </Button>
        </Box>
      </form>
    </Box>
  );
};


export default PaymentForm;





