import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Grid,
  Alert,
  Divider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { getSettings, updateSetting } from '../../services/settingsService';


const Settings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);


  const [formData, setFormData] = useState({
    default_interest_rate: '',
    default_loan_tenure_months: '',
    penalty_rate_annual: '',
    cash_in_bank: '0',
  });


  useEffect(() => {
    fetchSettings();
  }, []);


  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
     
      const settingsMap = {};
      const formValues = {};
     
      data.forEach(setting => {
        settingsMap[setting.key] = setting;
        formValues[setting.key] = setting.value;
      });
     
      setSettings(settingsMap);
      setFormData((prev) => ({ ...prev, ...formValues }));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setSuccess(false);
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);


    try {
      await Promise.all(
        Object.entries(formData).map(([key, value]) =>
          updateSetting(key, value)
        )
      );
     
      setSuccess(true);
      await fetchSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography>Loading settings...</Typography>
      </Box>
    );
  }


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }} fontWeight={700}>
        Settings
      </Typography>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}


      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
              Default Loan Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />


            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Default Interest Rate (%)"
                  value={formData.default_interest_rate}
                  onChange={(e) => handleChange('default_interest_rate', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  inputProps={{ min: 0, max: 100 }}
                  helperText={settings.default_interest_rate?.description}
                  sx={{ '& .MuiInputBase-root': { fontSize: { xs: '1rem', sm: '1rem' } } }}
                />
              </Grid>


              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Default Loan Tenure (Months)"
                  value={formData.default_loan_tenure_months}
                  onChange={(e) => handleChange('default_loan_tenure_months', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  inputProps={{ min: 1, max: 60 }}
                  helperText={settings.default_loan_tenure_months?.description}
                  size="large"
                />
              </Grid>


              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  These values will be used as defaults when creating new loans.
                </Typography>
              </Grid>
            </Grid>


            <Divider sx={{ my: 3 }} />


            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
              Penalty Calculation Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />


            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Annual Penalty Rate (%)"
                  value={formData.penalty_rate_annual}
                  onChange={(e) => handleChange('penalty_rate_annual', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  inputProps={{ min: 0, max: 200 }}
                  helperText={settings.penalty_rate_annual?.description || 'Annual penalty rate percentage (applied as rate/365 per day)'}
                  size="large"
                />
              </Grid>


              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Penalty Calculation Formula:
                  </Typography>
                  <Typography variant="body2">
                    Daily Penalty = (Total Loan Amount × Annual Penalty Rate) ÷ 365 days
                  </Typography>
                  <Typography variant="body2">
                    Total Penalty = Daily Penalty × Days Overdue
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Example: For ₹10,000 loan at 80% annual rate, daily penalty = (₹10,000 × 80%) ÷ 365 = ₹21.92/day
                  </Typography>
                </Alert>
              </Grid>
            </Grid>


            <Divider sx={{ my: 3 }} />


            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
              Bank Balance Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />


            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Cash in Bank"
                  value={formData.cash_in_bank}
                  onChange={(e) => handleChange('cash_in_bank', e.target.value)}
                  onWheel={(e) => e.target.blur()}
                  inputProps={{ min: 0 }}
                  helperText={settings.cash_in_bank?.description || 'Current cash available in bank'}
                />
              </Grid>
            </Grid>


          </CardContent>
        </Card>


        <Box sx={{ mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            startIcon={<SaveIcon />}
            disabled={saving}
            sx={{ py: 2 }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};


export default Settings;