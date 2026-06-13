import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';


const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');


    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }


    try {
      setLoading(true);
      const user = await login(email, password);
     
      // Redirect based on user role
      if (user.role === 'super_admin' || user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'finance' || user.role === 'customer') {
        navigate('/finance/dashboard');
      } else {
        navigate('/admin/dashboard'); // Default fallback
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        position: 'relative',
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
        },
      }}
    >
      <Stack sx={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
        <Card
          sx={{
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              {/* Header */}
              <Box textAlign="center">
                <Box
                  component="img"
                  src="/logo.png"
                  alt="Finance Manager Logo"
                  sx={{
                    width: 84,
                    height: 84,
                    objectFit: 'contain',
                    mb: 1,
                    display: 'inline-block',
                  }}
                />
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  Finance Manager
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to your account
                </Typography>
              </Box>


              {/* Error Alert */}
              {error && (
                <Alert severity="error" onClose={() => setError('')}>
                  {error}
                </Alert>
              )}


              {/* Login Form */}
              <form onSubmit={handleSubmit}>
                <Stack spacing={2.5}>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                  />


                  <TextField
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />


                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                    startIcon={<LoginIcon />}
                    sx={{ py: 1.5, mt: 1 }}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      <Typography
        variant="body2"
        align="center"
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: { xs: 10, sm: 14 },
          zIndex: 1,
          px: 2,
          color: 'rgba(255, 255, 255, 0.95)',
          letterSpacing: 0.2,
          fontWeight: 500,
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
        }}
      >
        Developed and Maintained by AS Tech
      </Typography>
    </Box>
  );
};


export default Login;