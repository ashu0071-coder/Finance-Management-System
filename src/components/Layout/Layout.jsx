import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, AppBar, Typography, IconButton, useTheme, useMediaQuery, BottomNavigation, BottomNavigationAction, Paper, Divider, Button } from '@mui/material';
import { Menu as MenuIcon, Home as HomeIcon, People as PeopleIcon, AccountBalance as LoansIcon, Settings as SettingsIcon, Logout as LogoutIcon, Business as BusinessIcon, ReceiptLong as DailyTransIcon } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../contexts/AuthContext';


const drawerWidth = 240;


export default function Layout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isAdmin, isCustomer } = useAuth();


  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };


  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };


  // Get role display text
  const getRoleText = () => {
    if (isAdmin) {
      return user?.role === 'super_admin' ? 'Super Admin' : 'Admin Panel';
    }
    if (user?.role === 'finance_manager') return 'Finance Manager';
    if (user?.role === 'finance_member') return 'Finance Member';
    return 'Finance Company';
  };


  // Define menu items based on user role
  const getMenuItems = () => {
    if (isAdmin) {
      // Super Admin sees Finance Companies (their customers)
      if (user?.role === 'super_admin') {
        return [
          { text: 'Dashboard', icon: <HomeIcon />, path: '/admin/dashboard' },
          { text: 'Customers', icon: <BusinessIcon />, path: '/admin/finance-companies' },
        ];
      }
      // Regular admin (backward compatibility)
      return [
        { text: 'Dashboard', icon: <HomeIcon />, path: '/admin/dashboard' },
        { text: 'Customers', icon: <PeopleIcon />, path: '/admin/customers' },
        { text: 'Loans', icon: <LoansIcon />, path: '/admin/loans' },
        { text: 'DailyTrans', icon: <DailyTransIcon />, path: '/admin/daily-trans' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/admin/settings' },
      ];
    } else if (isCustomer) {
      // Finance member only sees Dashboard (read-only)
      if (user?.role === 'finance_member') {
        return [
          { text: 'Dashboard', icon: <HomeIcon />, path: '/finance/dashboard' },
        ];
      }
      // Finance manager and finance companies manage their borrowers and loans
      return [
        { text: 'Dashboard', icon: <HomeIcon />, path: '/finance/dashboard' },
        { text: 'Borrowers', icon: <PeopleIcon />, path: '/finance/customers' },
        { text: 'Loans', icon: <LoansIcon />, path: '/finance/loans' },
        { text: 'DailyTrans', icon: <DailyTransIcon />, path: '/finance/daily-trans' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/finance/settings' },
      ];
    }
    return [];
  };


  const menuItems = getMenuItems();


  const navValue = (() => {
    const basePath = isAdmin ? '/admin' : '/finance';
    if (location.pathname.startsWith(`${basePath}/finance-companies`)) return `${basePath}/finance-companies`;
    if (location.pathname.startsWith(`${basePath}/customers`)) return `${basePath}/customers`;
    if (location.pathname.startsWith(`${basePath}/loans`)) return `${basePath}/loans`;
    if (location.pathname.startsWith(`${basePath}/daily-trans`)) return `${basePath}/daily-trans`;
    if (location.pathname.startsWith(`${basePath}/settings`)) return `${basePath}/settings`;
    return `${basePath}/dashboard`;
  })();


  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box>
        <Toolbar sx={{ bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="Finance Manager Logo"
              sx={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
            />
            <Typography variant="h6" fontWeight={700} noWrap>
              {user?.finance_company_name || 'Loan Manager'}
            </Typography>
          </Box>
        </Toolbar>
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {getRoleText()}
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname.startsWith(item.path)}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.main',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? 'white' : 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: location.pathname.startsWith(item.path) ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      <Box sx={{ mt: 'auto' }}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ py: 1 }}
          >
            Logout
          </Button>
        </Box>
      </Box>
    </Box>
  );


  if (isMobile) {
    return (
      <Box>
        {/* Mobile Top Bar */}
        <AppBar position="fixed" elevation={2}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, minWidth: 0 }}>
              <Box
                component="img"
                src="/logo.png"
                alt="Finance Manager Logo"
                sx={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }}
              />
              <Typography variant="h6" fontWeight={700} noWrap>
                {user?.finance_company_name || 'Loan Manager'}
              </Typography>
            </Box>
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          </Toolbar>
        </AppBar>


        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>


        {/* Main Content */}
        <Box component="main" sx={{ p: 2, pt: 9, pb: isCustomer ? 2 : 11, width: '100vw' }}>
          {children}
        </Box>


        {/* Bottom Navigation - Dynamic based on menu items */}
        {menuItems.length > 0 && (
          <Paper
            sx={{
              position: 'fixed',
              bottom: 8,
              left: 8,
              right: 8,
              zIndex: 1100,
              pt: 0.7,
              pb: 0.7,
              px: 0.6,
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.4)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(247,249,252,0.9))',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 10px 28px rgba(2, 22, 56, 0.18)',
              overflow: 'hidden',
            }}
            elevation={0}
          >
            <BottomNavigation
              showLabels
              value={navValue}
              onChange={(event, newValue) => navigate(newValue)}
              sx={{
                px: 0,
                py: 0,
                bgcolor: 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                '& .MuiBottomNavigationAction-root': {
                  flex: 1,
                  minWidth: 60,
                  minHeight: 48,
                  borderRadius: 3,
                  mx: 0.3,
                  my: 0,
                  px: 1.1,
                  py: 0.45,
                  color: 'text.secondary',
                  transition: 'all 0.22s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.25rem',
                    transition: 'all 0.22s ease',
                  },
                  '&.Mui-selected': {
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #1565c0 0%, #42a5f5 100%)',
                    boxShadow: '0 8px 18px rgba(21, 101, 192, 0.34)',
                    '& .MuiSvgIcon-root': {
                      color: '#ffffff',
                    },
                  },
                },
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  transform: 'none',
                  transition: 'none',
                  '&.Mui-selected': {
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textAlign: 'center',
                  },
                },
              }}
            >
              {menuItems.map((item) => (
                <BottomNavigationAction
                  key={item.path}
                  label={item.text}
                  value={item.path}
                  icon={item.icon}
                />
              ))}
            </BottomNavigation>
          </Paper>
        )}
      </Box>
    );
  }


  // Desktop Layout
  return (
    <Box sx={{ display: 'flex' }}>
      {/* Desktop Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>


      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 4 }}>
        {children}
      </Box>
    </Box>
  );
}


Layout.propTypes = {
  children: PropTypes.node.isRequired,
};