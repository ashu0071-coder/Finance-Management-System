import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';


const FinanceCompanyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);


  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
 
  const [formData, setFormData] = useState({
    company_name: '',
    owner_name: '',
    mobile_number: '',
    address: '',
    subscription_status: 'active',
    manager_email: '', // Manager login
    manager_password: '',
    member_email: '', // Member login (read-only)
    member_password: '',
  });


  useEffect(() => {
    if (isEdit) {
      fetchCompany();
    }
  }, [id]);


  const fetchCompany = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('finance_companies')
        .select('*')
        .eq('id', id)
        .single();


      if (err) throw err;
     
      setFormData({
        company_name: data.company_name,
        owner_name: data.owner_name,
        mobile_number: data.mobile_number || '',
        address: data.address || '',
        subscription_status: data.subscription_status,
        manager_email: data.email, // Manager email is the main email
        manager_password: '',
        member_email: data.member_email || '',
        member_password: '',
      });
    } catch (err) {
      setError('Failed to load company: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);


    // Validation
    if (!formData.company_name || !formData.owner_name) {
      setError('Company name and owner name are required');
      return;
    }


    if (!isEdit) {
      // For new companies, require manager credentials
      if (!formData.manager_email || !formData.manager_password) {
        setError('Manager email and password are required');
        return;
      }


      if (formData.manager_password.length < 6) {
        setError('Manager password must be at least 6 characters');
        return;
      }


      // If member credentials provided, validate them
      if (formData.member_email || formData.member_password) {
        if (!formData.member_email || !formData.member_password) {
          setError('Please fill both member email and password or leave them blank');
          return;
        }
        if (formData.member_password.length < 6) {
          setError('Member password must be at least 6 characters');
          return;
        }
        if (formData.member_email === formData.manager_email) {
          setError('Manager and member emails must be different');
          return;
        }
      }
    }


    try {
      setSaving(true);


      if (isEdit) {
        // Update existing company
        const { error: updateError } = await supabase
          .from('finance_companies')
          .update({
            company_name: formData.company_name,
            owner_name: formData.owner_name,
            mobile_number: formData.mobile_number,
            address: formData.address,
            subscription_status: formData.subscription_status,
            member_email: formData.member_email || null,
          })
          .eq('id', id);


        if (updateError) throw updateError;


        // Update manager password if provided
        if (formData.manager_password) {
          const { error: pwdError } = await supabase.rpc('update_user_password', {
            user_email: formData.manager_email || formData.email,
            new_password: formData.manager_password,
          });
          if (pwdError) throw pwdError;
        }


        // Update or create member if credentials provided
        if (formData.member_email) {
          // Check if member user exists
          const { data: existingMember } = await supabase
            .from('users')
            .select('id')
            .eq('email', formData.member_email)
            .single();


          if (existingMember && formData.member_password) {
            // Update existing member password
            const { error: memberPwdError } = await supabase.rpc('update_user_password', {
              user_email: formData.member_email,
              new_password: formData.member_password,
            });
            if (memberPwdError) throw memberPwdError;
          } else if (!existingMember && formData.member_password) {
            // Create new member user
            const { error: memberError } = await supabase.rpc('create_finance_member_user', {
              user_email: formData.member_email,
              user_password: formData.member_password,
              company_id: id,
              user_name: formData.owner_name,
            });
            if (memberError) throw memberError;
          }
        }


        setSuccess('Finance company updated successfully!');
      } else {
        // Create new company
        const { data: company, error: companyError } = await supabase
          .from('finance_companies')
          .insert([{
            company_name: formData.company_name,
            owner_name: formData.owner_name,
            mobile_number: formData.mobile_number,
            address: formData.address,
            subscription_status: formData.subscription_status,
            member_email: formData.member_email || null,
          }])
          .select()
          .single();


        if (companyError) throw companyError;


        // Create manager user
        const { error: managerError } = await supabase.rpc('create_finance_manager_user', {
          user_email: formData.manager_email,
          user_password: formData.manager_password,
          company_id: company.id,
          user_name: formData.owner_name,
        });


        if (managerError) throw managerError;


        // Create member user if credentials provided
        if (formData.member_email && formData.member_password) {
          const { error: memberError } = await supabase.rpc('create_finance_member_user', {
            user_email: formData.member_email,
            user_password: formData.member_password,
            company_id: company.id,
            user_name: formData.owner_name,
          });


          if (memberError) throw memberError;
        }


        setSuccess('Finance company created successfully with manager and member accounts!');
       
        // Navigate after short delay
        setTimeout(() => {
          navigate('/admin/finance-companies');
        }, 1500);
      }
    } catch (err) {
      setError('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={50} />
      </Box>
    );
  }


  return (
    <Box sx={{ pb: { xs: 10, sm: 4 } }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/admin/finance-companies')}
            sx={{ mb: 2 }}
          >
            Back to List
          </Button>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {isEdit ? 'Edit Finance' : 'Add Finance'}
          </Typography>
          <Typography color="text.secondary">
            {isEdit ? 'Update Finance details and subscription status' : 'Create a new finance'}
          </Typography>
        </Box>


        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}


        {/* Form */}
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <Typography variant="h6" gutterBottom>
                  Finance Information
                </Typography>
               
                <TextField
                  fullWidth
                  label="Finance Name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  disabled={saving}
                />


                <TextField
                  fullWidth
                  label="Owner Name"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  required
                  disabled={saving}
                />


                <TextField
                  fullWidth
                  label="Mobile Number"
                  name="mobile_number"
                  value={formData.mobile_number}
                  onChange={handleChange}
                  disabled={saving}
                />


                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  disabled={saving}
                />


                <FormControl fullWidth>
                  <InputLabel>Subscription Status</InputLabel>
                  <Select
                    name="subscription_status"
                    value={formData.subscription_status}
                    onChange={handleChange}
                    label="Subscription Status"
                    disabled={saving}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>


                {/* Manager Login Section */}
                <Box sx={{ mt: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom color="primary.dark">
                    Manager Login (Full Access)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Manager can add, edit, and delete loans and customers
                  </Typography>
                 
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Manager Email"
                      name="manager_email"
                      type="email"
                      value={formData.manager_email}
                      onChange={handleChange}
                      required={!isEdit}
                      disabled={saving || isEdit}
                      helperText={isEdit ? "Manager email cannot be changed" : ""}
                    />


                    <TextField
                      fullWidth
                      label={isEdit ? "New Manager Password (leave blank to keep current)" : "Manager Password"}
                      name="manager_password"
                      type="password"
                      value={formData.manager_password}
                      onChange={handleChange}
                      required={!isEdit}
                      disabled={saving}
                      helperText="Minimum 6 characters"
                    />
                  </Stack>
                </Box>


                {/* Member Login Section */}
                <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom color="warning.dark">
                    Member Login (Read-Only Access) - Optional
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Member can only view loans and customers, no add/edit/delete actions
                  </Typography>
                 
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Member Email"
                      name="member_email"
                      type="email"
                      value={formData.member_email}
                      onChange={handleChange}
                      disabled={saving}
                      helperText="Leave blank if you don't want a member account"
                    />


                    <TextField
                      fullWidth
                      label={isEdit ? "New Member Password (leave blank to keep current)" : "Member Password"}
                      name="member_password"
                      type="password"
                      value={formData.member_password}
                      onChange={handleChange}
                      disabled={saving}
                      helperText="Minimum 6 characters (required only if creating member account)"
                    />
                  </Stack>
                </Box>


                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    disabled={saving}
                    sx={{ flex: 1 }}
                  >
                    {saving ? 'Saving...' : (isEdit ? 'Update Finance' : 'Create Finance')}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/admin/finance-companies')}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </form>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
};


export default FinanceCompanyForm;



