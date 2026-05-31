import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Divider,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { getCustomers, deleteCustomer, searchCustomers } from '../../services/customerService';
import { useAuth } from '../../contexts/AuthContext';


export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
 
  // Get base path based on user role
  const basePath = user?.role === 'super_admin' ? '/admin' : '/finance';


  useEffect(() => {
    loadCustomers();
  }, []);


  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError('Failed to load customers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = async (e) => {
    const term = e.target.value;
    setSearchTerm(term);
   
    if (term.trim() === '') {
      loadCustomers();
    } else {
      try {
        const data = await searchCustomers(term);
        setCustomers(data);
      } catch (err) {
        setError('Search failed: ' + err.message);
      }
    }
  };


  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteCustomer(id);
        loadCustomers();
      } catch (err) {
        setError('Failed to delete customer: ' + err.message);
      }
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
    <Box sx={{ pb: { xs: 10, sm: 4, } }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 20 }} />}
          onClick={() => navigate(`${basePath}/customers/new`)}
          sx={{ py: 1 }}
        >
          Add
        </Button>
      </Stack>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}


      {/* Search */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name or mobile..."
          value={searchTerm}
          onChange={handleSearch}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>


      {/* Customer Count */}
      <Typography variant="body1" color="text.secondary" mb={2}>
        {customers.length} customer{customers.length === 1 ? '' : 's'} found
      </Typography>


      {/* Customer Cards */}
      <Stack spacing={2}>
        {customers.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                No customers found
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate(`${basePath}/customers/new`)}
                sx={{ mt: 2 }}
              >
                Add First Customer
              </Button>
            </CardContent>
          </Card>
        ) : (
          customers.map((customer) => (
            <Card
              key={customer.id}
              sx={{
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                '&:hover': {
                  boxShadow: 3,
                  transform: 'translateY(-1px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                {/* Customer Name */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '1rem', sm: '1.125rem' } }}>
                    {customer.name}
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      color="primary"
                      onClick={() => navigate(`${basePath}/customers/${customer.id}/edit`)}
                      size="small"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(customer.id, customer.name)}
                      size="small"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>


                <Divider sx={{ my: 1.5 }} />


                {/* Customer Details */}
                <Stack spacing={1.5}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.3}>
                      <PhoneIcon color="action" sx={{ fontSize: 16 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem' }}>
                        Mobile
                      </Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={500} sx={{ pl: 3 }}>
                      {customer.mobile_number}
                    </Typography>
                  </Box>


                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.3}>
                      <PersonIcon color="action" sx={{ fontSize: 16 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem' }}>
                        Referer Details
                      </Typography>
                    </Stack>
                    <Box sx={{ pl: 3 }}>
                      <Typography variant="body2" fontWeight={500}>
                        Name : {customer.reference_person_name}
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        Number :{customer.reference_person_mobile}
                      </Typography>
                    </Box>
                  </Box>


                  {customer.address && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem', display: 'block', mb: 0.3 }}>
                        Address
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {customer.address}
                      </Typography>
                    </Box>
                  )}


                  {customer.notes && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem', display: 'block', mb: 0.3 }}>
                        Notes
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {customer.notes}
                      </Typography>
                    </Box>
                  )}
                </Stack>


                {/* Action Buttons */}
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" spacing={1}>
                  {/* <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<EditIcon fontSize="small" />}
                    onClick={() => navigate(`/customers/${customer.id}/edit`)}
                    sx={{ py: 0.75 }}
                  >
                    Edit
                  </Button> */}
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    onClick={() => navigate(`${basePath}/loans/new?customer=` + customer.id)}
                    sx={{ py: 0.75 }}
                  >
                    Create Loan
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))
        )}
      </Stack>
    </Box>
  );
}