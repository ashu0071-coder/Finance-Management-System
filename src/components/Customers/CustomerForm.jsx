import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Grid,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { addMonths } from 'date-fns';
import { getCustomer, createCustomer, updateCustomer } from '../../services/customerService';
import { createLoan } from '../../services/loanService';
import { getSettings } from '../../services/settingsService';
import { calculateLoanDetails } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';


const INTEREST_COMPONENT_RATE = 9;
const TOTAL_UPFRONT_DEDUCTION_RATE = 10;


export default function CustomerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
  const isEdit = Boolean(id);


  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
 
  const [customerData, setCustomerData] = useState({
    name: '',
    mobile_number: '',
    reference_person_name: '',
    reference_person_mobile: '',
  });


  const [loanData, setLoanData] = useState({
    start_date: new Date(),
    principal_amount: '',
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
    if (isEdit) {
      loadCustomer();
    } else {
      loadSettings();
    }
  }, [id, isEdit]);


  useEffect(() => {
    if (loanData.total_loan_amount && loanData.tenure_months) {
      const values = calculateLoanDetails(
        Number.parseFloat(loanData.total_loan_amount) || 0,
        INTEREST_COMPONENT_RATE,
        Number.parseInt(loanData.tenure_months) || 3
      );
      setCalculatedValues(values);
    }
  }, [loanData.total_loan_amount, loanData.tenure_months]);


  const loadSettings = async () => {
    try {
      const settingsData = await getSettings();
      const settingsMap = {};
      settingsData.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
     
      setLoanData(prev => ({
        ...prev,
        interest_rate: String(TOTAL_UPFRONT_DEDUCTION_RATE),
        tenure_months: settingsMap.default_loan_tenure_months || '3',
      }));
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };


  const loadCustomer = async () => {
    try {
      setLoading(true);
      const data = await getCustomer(id);
      setCustomerData(data);
      setError(null);
    } catch (err) {
      setError('Failed to load customer: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomerData((prev) => ({ ...prev, [name]: value }));
  };


  const handleLoanChange = (field, value) => {
    setLoanData(prev => ({ ...prev, [field]: value }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
   
    // Validation
    if (!customerData.name || !customerData.mobile_number || !customerData.reference_person_name || !customerData.reference_person_mobile) {
      setError('Please fill in all customer details');
      return;
    }


     if (isEdit) {
      try {
        setSaving(true);
        await updateCustomer(id, customerData);
        // Navigate based on user role
        const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
        navigate(`${basePath}/customers`);
      } catch (err) {
        setError('Failed to save customer: ' + err.message);
      } finally {
        setSaving(false);
      }
      return;
    }


    // For new customer, validate loan fields too
    if (!loanData.total_loan_amount || !loanData.interest_rate || !loanData.tenure_months) {
      setError('Please fill in all loan details');
      return;
    }


    try {
      setSaving(true);
     
      // Create customer first - include finance_company_id from logged-in user
      const customerPayload = {
        ...customerData,
        finance_company_id: user?.finance_company_id || null,
      };
      const newCustomer = await createCustomer(customerPayload);
     
      // Then create loan
      const dueDate = addMonths(loanData.start_date, Number.parseInt(loanData.tenure_months));
     
      const loanPayload = {
        customer_id: newCustomer.id,
        finance_company_id: user?.finance_company_id || null,
        principal_amount: calculatedValues.net_disbursed_amount,
        interest_rate: INTEREST_COMPONENT_RATE,
        interest_amount: calculatedValues.interest_amount,
        bond_fee: calculatedValues.bond_fee,
        total_loan_amount: calculatedValues.total_loan_amount,
        net_disbursed_amount: calculatedValues.net_disbursed_amount,
        start_date: loanData.start_date.toISOString().split('T')[0],
        original_due_date: dueDate.toISOString().split('T')[0],
        current_due_date: dueDate.toISOString().split('T')[0],
        tenure_months: Number.parseInt(loanData.tenure_months),
        outstanding_amount: calculatedValues.total_loan_amount,
        cheque_numbers: loanData.cheque_numbers ? loanData.cheque_numbers.split(',').map(s => s.trim()) : [],
        notes: loanData.notes,
      };


      const newLoan = await createLoan(loanPayload);
     
      // Navigate based on user role
      const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';
      navigate(`${basePath}/loans/${newLoan.id}`);
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 }, px: { xs: 2, sm: 0 } }}>
      <Typography variant="h4" component="h1" mb={3} fontWeight={700}>
        {isEdit ? 'Edit Customer' : 'Add Customer & Create Loan'}
      </Typography>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}


      <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%', overflow: 'hidden' }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Left Column - Customer & Reference */}
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                {/* Customer Details */}
                <Box>
                  <Typography variant="h6" fontWeight={600} mb={1.5} sx={{ fontSize: '1rem' }}>
                    Customer Details
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      required
                      label="Customer Name"
                      name="name"
                      value={customerData.name}
                      onChange={handleCustomerChange}
                      placeholder="Enter full name"
                    />
                   
                    <TextField
                      fullWidth
                      required
                      label="Mobile Number"
                      name="mobile_number"
                      value={customerData.mobile_number}
                      onChange={handleCustomerChange}
                      inputProps={{
                        maxLength: 10,
                        inputMode: 'numeric',
                        pattern: '[0-9]*'
                      }}
                      placeholder="10-digit mobile"
                    />
                  </Stack>
                </Box>
               
                <Divider />
               
                {/* Reference Person */}
                <Box>
                  <Typography variant="h6" fontWeight={600} mb={1.5} sx={{ fontSize: '1rem' }}>
                    Reference Person
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      required
                      label="Reference Name"
                      name="reference_person_name"
                      value={customerData.reference_person_name}
                      onChange={handleCustomerChange}
                      placeholder="Guarantor name"
                    />
                   
                    <TextField
                      fullWidth
                      required
                      label="Reference Mobile"
                      name="reference_person_mobile"
                      value={customerData.reference_person_mobile}
                      onChange={handleCustomerChange}
                      inputProps={{
                        maxLength: 10,
                        inputMode: 'numeric',
                        pattern: '[0-9]*'
                      }}
                      placeholder="10-digit mobile"
                    />
                  </Stack>
                </Box>
              </Stack>
            </Grid>


            {/* Right Column - Loan Details (only for new customers) */}
            {!isEdit && (
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="h6" fontWeight={600} mb={1.5} sx={{ fontSize: '1rem' }}>
                      Loan Details
                    </Typography>
                    <Stack spacing={2}>
                          <TextField
                            fullWidth
                            required
                            type="number"
                            label="Total Loan Amount"
                            value={loanData.total_loan_amount}
                            onChange={(e) => handleLoanChange('total_loan_amount', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            inputProps={{ min: 0 }}
                            InputProps={{ startAdornment: '₹' }}
                          />
                       
                          <TextField
                            fullWidth
                            required
                            type="number"
                            label="Initial Deduction (%)"
                            value={loanData.interest_rate}
                            disabled
                            inputProps={{ min: 10, max: 10 }}
                            helperText="Fixed at 10% total (9% interest + 1% bond fee)"
                          />


                          <TextField
                            fullWidth
                            required
                            type="number"
                            label="Tenure (Months)"
                            value={loanData.tenure_months}
                            onChange={(e) => handleLoanChange('tenure_months', e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            inputProps={{ min: 1, max: 60 }}
                          />


                        <Grid item xs={12}>
                          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                            <DatePicker
                              label="Start Date"
                              value={loanData.start_date}
                              onChange={(e) => handleLoanChange('start_date', e)}
                              inputFormat="dd/MM/yyyy"
                              renderInput={(params) => <TextField {...params} fullWidth />}
                            />
                          </LocalizationProvider>
                        </Grid>


                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Cheque Numbers (optional)"
                            value={loanData.cheque_numbers}
                            onChange={(e) => handleLoanChange('cheque_numbers', e.target.value)}
                            placeholder="e.g., 123456, 789012"
                          />
                        </Grid>


                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Notes (optional)"
                            value={loanData.notes}
                            onChange={(e) => handleLoanChange('notes', e.target.value)}
                          />
                        </Grid>
                    </Stack>
                  </Box>


                  {/* Calculation Summary */}
                  {loanData.total_loan_amount && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" mb={1}>
                          Loan Summary
                        </Typography>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Total Loan:</Typography>
                            <Typography variant="body2" fontWeight={600} color="primary">
                              ₹{calculatedValues.total_loan_amount.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Interest Amount (9%):</Typography>
                            <Typography variant="body2" fontWeight={600} color="warning.main">
                              ₹{calculatedValues.interest_amount.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Bond Fee (1%):</Typography>
                            <Typography variant="body2" fontWeight={600} color="info.main">
                              ₹{calculatedValues.bond_fee.toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Total Deduction (10%):</Typography>
                            <Typography variant="body2" fontWeight={700} color="error.main">
                              ₹{(calculatedValues.interest_amount + calculatedValues.bond_fee).toLocaleString()}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" color="text.secondary">Net Disbursed:</Typography>
                            <Typography variant="body2" fontWeight={600} color="success.main">
                              ₹{calculatedValues.net_disbursed_amount.toLocaleString()}
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>
                    </>
                  )}
                </Stack>
              </Grid>
            )}
          </Grid>


          {/* Action Buttons */}
          <Box mt={4}>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={() => navigate(`${basePath}/customers`)}
                disabled={saving}
                fullWidth
                sx={{ py: 0.5 }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                fullWidth
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                {(() => {
                  if (saving) return isEdit ? 'Updating...' : 'Creating...';
                  if (isEdit) return 'Update';
                  return 'Create';
                })()}
              </Button>
            </Stack>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}



