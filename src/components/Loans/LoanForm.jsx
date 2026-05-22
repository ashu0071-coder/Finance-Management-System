import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Divider,
  Paper,
  Stack,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { getCustomers } from '../../services/customerService';
import { createLoan } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';
import { calculateLoanDetails } from '../../utils/calculations';
import { addMonths } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';


const INTEREST_COMPONENT_RATE = 9;
const TOTAL_UPFRONT_DEDUCTION_RATE = 10;


const LoanForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const preSelectedCustomer = searchParams.get('customer');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


  const [formData, setFormData] = useState({
    customer_id: '',
    start_date: new Date(),
    total_loan_amount: '',
    interest_rate: '',
    tenure_months: '',
    cheque_numbers: '',
    notes: '',
  });


  const [calculatedValues, setCalculatedValues] = useState({
    interest_amount: 0,
    bond_fee: 0,
    net_disbursed_amount: 0,
    total_loan_amount: 0,
    monthly_interest: 0,
  });


  useEffect(() => {
    fetchInitialData();
  }, []);


  useEffect(() => {
    if (formData.total_loan_amount && formData.tenure_months) {
      const values = calculateLoanDetails(
        Number.parseFloat(formData.total_loan_amount) || 0,
        INTEREST_COMPONENT_RATE,
        Number.parseInt(formData.tenure_months) || 3
      );
      setCalculatedValues(values);
    }
  }, [formData.total_loan_amount, formData.tenure_months]);


  const fetchInitialData = async () => {
    try {
      const [customersData, settingsData] = await Promise.all([
        getCustomers(),
        getSettings(),
      ]);
      setCustomers(customersData.filter(c => c.is_active));
     
      const settingsMap = {};
      settingsData.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });


      // Keep interest component fixed at 9%.
      // With bond fee fixed at 1%, this guarantees total upfront deduction is 10%.
      setFormData(prev => ({
        ...prev,
        customer_id: preSelectedCustomer || '',
        interest_rate: String(TOTAL_UPFRONT_DEDUCTION_RATE),
        tenure_months: settingsMap.default_loan_tenure_months || '3',
      }));
    } catch (err) {
      setError(err.message);
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
      const dueDate = addMonths(formData.start_date, Number.parseInt(formData.tenure_months));
     
      const loanData = {
        customer_id: formData.customer_id,
        finance_company_id: user?.finance_company_id || null,
        principal_amount: calculatedValues.net_disbursed_amount, // Principal = what customer receives
        interest_rate: INTEREST_COMPONENT_RATE,
        interest_amount: calculatedValues.interest_amount,
        bond_fee: calculatedValues.bond_fee,
        total_loan_amount: calculatedValues.total_loan_amount,
        net_disbursed_amount: calculatedValues.net_disbursed_amount,
        start_date: formData.start_date.toISOString().split('T')[0],
        original_due_date: dueDate.toISOString().split('T')[0],
        current_due_date: dueDate.toISOString().split('T')[0],
        tenure_months: Number.parseInt(formData.tenure_months),
        outstanding_amount: calculatedValues.total_loan_amount,
        cheque_numbers: formData.cheque_numbers ? formData.cheque_numbers.split(',').map(s => s.trim()) : [],
        notes: formData.notes,
      };


      const newLoan = await createLoan(loanData);
      navigate(`${basePath}/loans/${newLoan.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 700, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        Create New Loan
      </Typography>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                  Loan Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      select
                      fullWidth
                      required
                      label="Customer"
                      value={formData.customer_id}
                      onChange={(e) => handleChange('customer_id', e.target.value)}
                      InputLabelProps={{ style: { fontSize: '1rem' } }}
                      sx={{ '& .MuiInputBase-root': { fontSize: { xs: '1rem', sm: '1rem' } } }}
                    >
                      {customers.map((customer) => (
                        <MenuItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.mobile_number}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                      <DatePicker
                        label="Start Date"
                        value={formData.start_date}
                        onChange={(date) => handleChange('start_date', date)}
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
                      label="Tenure (Months)"
                      value={formData.tenure_months}
                      onChange={(e) => handleChange('tenure_months', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      inputProps={{ min: 1, max: 60 }}
                    />
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Total Loan Amount"
                      value={formData.total_loan_amount}
                      onChange={(e) => handleChange('total_loan_amount', e.target.value)}
                      onWheel={(e) => e.target.blur()}
                      inputProps={{ min: 0 }}
                      InputProps={{ startAdornment: '₹' }}
                    />
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Initial Deduction (%)"
                      value={formData.interest_rate}
                      disabled
                      inputProps={{ min: 10, max: 10 }}
                      helperText="Fixed at 10% total (9% interest + 1% bond fee)"
                    />
                  </Grid>


                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Cheque Numbers (comma separated)"
                      value={formData.cheque_numbers}
                      onChange={(e) => handleChange('cheque_numbers', e.target.value)}
                      placeholder="e.g., 123456, 789012"
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
            <Paper sx={{ p: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
                Calculation Summary
              </Typography>
              <Divider sx={{ my: 2 }} />
             
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                  Total Loan Amount
                </Typography>
                <Typography variant="h6" sx={{ fontSize: { xs: '1.25rem', sm: '1.25rem' } }}>
                  ₹{Number(formData.total_loan_amount || 0).toLocaleString()}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Interest Amount (9%)
                </Typography>
                <Typography variant="h6" color="warning.main">
                  ₹{calculatedValues.interest_amount.toLocaleString()}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Monthly Interest
                </Typography>
                <Typography variant="body1">
                  ₹{calculatedValues.monthly_interest.toLocaleString()}
                </Typography>
              </Box>


              <Divider sx={{ my: 2 }} />


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Net Disbursed to Customer
                </Typography>
                <Typography variant="h5" color="success.main">
                  ₹{calculatedValues.net_disbursed_amount.toLocaleString()}
                </Typography>
              </Box>


              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer Must Repay
                </Typography>
                <Typography variant="h5" color="error.main" fontWeight={700}>
                  ₹{calculatedValues.total_loan_amount.toLocaleString()}
                </Typography>
              </Box>


              <Divider sx={{ my: 2 }} />


              <Typography variant="caption" color="text.secondary">
                * Total Loan = Amount entered (what customer must repay)
                <br />
                * Initial deduction = 10% of Total Loan
                <br />
                * Split: 9% interest + 1% bond fee
                <br />
                * Net Disbursed = Total Loan - (Interest + Bond Fee)
              </Typography>
            </Paper>
          </Grid>
        </Grid>


        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !formData.customer_id || !formData.total_loan_amount}
          >
            {loading ? 'Creating...' : 'Create Loan'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate(`${basePath}/loans`)}
            disabled={loading}
          >
            Cancel
          </Button>
        </Box>


        {/* Detailed Loan Summary Section */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600}>
              Loan Summary
            </Typography>
            <Divider sx={{ my: 2 }} />
           
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Total Loan Amount
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    ₹{calculatedValues.total_loan_amount.toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    What customer must repay
                  </Typography>
                </Paper>
              </Grid>


              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Net Disbursed Amount
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    ₹{calculatedValues.net_disbursed_amount.toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    What customer receives in hand
                  </Typography>
                </Paper>
              </Grid>


              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Breakdown
                </Typography>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Interest Amount (9% component for {formData.tenure_months || 0} months):
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="warning.main">
                      ₹{calculatedValues.interest_amount.toLocaleString('en-IN')}
                    </Typography>
                  </Stack>


                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Bond Fee (1% of Loan - Non-refundable):
                    </Typography>
                    <Typography variant="body1" fontWeight={600} color="info.main">
                      ₹{calculatedValues.bond_fee.toLocaleString('en-IN')}
                    </Typography>
                  </Stack>


                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Monthly Interest Payment:
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      ₹{calculatedValues.monthly_interest.toLocaleString('en-IN')}
                    </Typography>
                  </Stack>


                  <Divider />


                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1" fontWeight={600}>
                      Total Deducted (Interest + Bond Fee):
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="error.main">
                      ₹{(calculatedValues.interest_amount + calculatedValues.bond_fee).toLocaleString('en-IN')}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>


              <Grid item xs={12}>
                <Alert severity="info" variant="outlined">
                  <Typography variant="body2">
                    <strong>How it works:</strong>
                    <br />
                    • Customer needs: ₹{calculatedValues.total_loan_amount.toLocaleString('en-IN')} to repay
                    <br />
                    • Bond Fee (1%): ₹{calculatedValues.bond_fee.toLocaleString('en-IN')} (non-refundable)
                    <br />
                    • Interest (9%): ₹{calculatedValues.interest_amount.toLocaleString('en-IN')}
                    <br />
                    • Total Deduction (10% = 9% interest + 1% bond fee): ₹{(calculatedValues.interest_amount + calculatedValues.bond_fee).toLocaleString('en-IN')}
                    <br />
                    • Customer receives: ₹{calculatedValues.net_disbursed_amount.toLocaleString('en-IN')}
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </form>
    </Box>
  );
};


export default LoanForm;





