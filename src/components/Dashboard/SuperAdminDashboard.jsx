import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Add as AddIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';


const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [financeCompanies, setFinanceCompanies] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    fetchData();
  }, []);


  const fetchData = async () => {
    try {
      setLoading(true);
     
      // Fetch all finance companies
      const { data: companies, error: compError } = await supabase
        .from('finance_companies')
        .select('*')
        .order('created_at', { ascending: false });


      if (compError) throw compError;


      setFinanceCompanies(companies || []);
     
      // Calculate stats
      const active = companies?.filter(c => c.subscription_status === 'active').length || 0;
      const suspended = companies?.filter(c => c.subscription_status === 'suspended').length || 0;
     
      setStats({
        total: companies?.length || 0,
        active,
        suspended,
      });
     
      setError(null);
    } catch (err) {
      setError('Failed to load finance companies: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      suspended: 'warning',
      cancelled: 'error',
    };
    return colors[status] || 'default';
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
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Super Admin Dashboard
          </Typography>
          <Typography color="text.secondary">
            Manage your finance company customers
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
        <div style={{display:'flex', gap: '8px', flexWrap: 'wrap'}}>
          <div style={{flex: '1', minWidth: '200px'}}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white', height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <BusinessIcon sx={{ fontSize: 32}} />
                <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
                  {stats.total}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Total Finance Companies</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{flex: '1', minWidth: '200px'}}>
            <Card sx={{ bgcolor: 'success.main', color: 'white', height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <ActiveIcon sx={{ fontSize: 32}} />
                <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
                  {stats.active}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Active Subscriptions</Typography>
              </CardContent>
            </Card>
          </div>


          <div style={{flex: '1', minWidth: '200px'}}>
            <Card sx={{ bgcolor: 'warning.main', color: 'white', height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <InactiveIcon sx={{ fontSize: 32}} />
                <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
                  {stats.suspended}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>Suspended Accounts</Typography>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Quick Actions */}
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ fontSize: '0.95rem', mb: 1.5 }}>
              Quick Actions
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                variant="contained"
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => navigate('/admin/finance-companies/new')}
                sx={{ py: 1.25, fontSize: '0.875rem' }}
              >
                Add Finance Company
              </Button>
              <Button
                variant="outlined"
                fullWidth
                color="primary"
                startIcon={<ViewIcon />}
                onClick={() => navigate('/admin/finance-companies')}
                sx={{ py: 1.25, fontSize: '0.875rem' }}
              >
                View All Companies
              </Button>
            </Stack>
          </CardContent>
        </Card>


        {/* Finance Companies List */}
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={600}>
              Recent Customers
            </Typography>
            <Button
              size="small"
              onClick={() => navigate('/admin/finance-companies')}
            >
              View All
            </Button>
          </Box>
         
          {financeCompanies.length === 0 ? (
            <Card>
              <CardContent>
                <Box textAlign="center" py={6}>
                  <BusinessIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Customers Yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Start by adding your first finance company customer
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/admin/finance-companies/new')}
                  >
                    Add First Company
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {financeCompanies.slice(0, 6).map((company) => (
                <Card
                  key={company.id}
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    }
                  }}
                  onClick={() => navigate(`/admin/finance-companies/${company.id}`)}
                >
                  <CardContent>
                    <Stack spacing={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6" fontWeight={700} noWrap>
                            {company.company_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {company.owner_name}
                          </Typography>
                        </Box>
                        <Chip
                          label={company.subscription_status.toUpperCase()}
                          color={getStatusColor(company.subscription_status)}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>


                      {/* Contact Details */}
                      <Stack spacing={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {company.email}
                          </Typography>
                        </Box>
                        {company.mobile_number && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {company.mobile_number}
                            </Typography>
                          </Box>
                        )}
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            Since {format(new Date(company.created_at), 'dd/MMM/yyyy')}
                          </Typography>
                        </Box>
                      </Stack>


                      {/* Actions */}
                      <Box display="flex" gap={1} pt={1}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<EditIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/finance-companies/${company.id}/edit`);
                          }}
                          fullWidth
                        >
                          Edit
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </Box>
      </Stack>
    </Box>
  );
};


export default SuperAdminDashboard;