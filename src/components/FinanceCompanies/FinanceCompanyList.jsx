import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  CalendarToday as CalendarIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';


const FinanceCompanyList = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, company: null });
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    fetchCompanies();
  }, []);


  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('finance_companies')
        .select('*')
        .order('created_at', { ascending: false });


      if (err) throw err;
      setCompanies(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load Customers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteClick = (e, company) => {
    e.stopPropagation();
    setDeleteDialog({ open: true, company });
  };


  const handleDeleteConfirm = async () => {
    if (!deleteDialog.company) return;


    try {
      setDeleting(true);
     
      // Delete associated users first
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('finance_company_id', deleteDialog.company.id);


      if (userError) throw userError;


      // Delete the company
      const { error: deleteError } = await supabase
        .from('finance_companies')
        .delete()
        .eq('id', deleteDialog.company.id);


      if (deleteError) throw deleteError;


      // Refresh the list
      await fetchCompanies();
      setDeleteDialog({ open: false, company: null });
    } catch (err) {
      setError('Failed to delete: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };


  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, company: null });
  };


  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      suspended: 'warning',
      cancelled: 'error',
    };
    return colors[status] || 'default';
  };


  const filteredCompanies = companies.filter(company =>
    company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (company.email && company.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );


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
        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
          <div>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Customers
            </Typography>
          </div>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/admin/finance-companies/new')}
          >
            Add Customer
          </Button>
        </Box>


        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}


        {/* Search */}
        <Card>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by company name, owner, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </CardContent>
        </Card>


        {/* Companies Grid */}
        {filteredCompanies.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign="center" py={6}>
                <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {searchQuery ? 'No companies found matching your search' : 'No Customers yet'}
                </Typography>
                {!searchQuery && (
                  <>
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
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredCompanies.map((company) => (
              <div key={company.id}>
                <Card
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
                        {company.email && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {company.email}
                            </Typography>
                          </Box>
                        )}
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
                            Since {format(new Date(company.created_at), 'dd/MM/yyyy')}
                          </Typography>
                        </Box>
                      </Stack>


                      {/* Actions */}
                      <Box display="flex" gap={1} pt={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/finance-companies/${company.id}/edit`);
                          }}
                          sx={{ flex: 1 }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={(e) => handleDeleteClick(e, company)}
                          sx={{ flex: 1 }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </Stack>


      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Finance Company</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteDialog.company?.company_name}</strong>?
            <br /><br />
            This will also delete all associated manager and member user accounts.
            <br /><br />
            <strong>Warning:</strong> This action cannot be undone!
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


export default FinanceCompanyList;



