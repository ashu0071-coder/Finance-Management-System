import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App.jsx';


const theme = createTheme({
  palette: {
    primary: {
      main: '#1565c0', // Professional Blue
      light: '#5e92f3',
      dark: '#003c8f',
    },
    secondary: {
      main: '#7b1fa2', // Purple accent
      light: '#ae52d4',
      dark: '#4a0072',
    },
    error: {
      main: '#d32f2f',
    },
    success: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Reduce overall UI scale slightly for denser layout.
    fontSize: 14,
    h4: {
      fontSize: '1.6rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.35rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1.12rem',
      fontWeight: 600,
    },
    button: {
      fontSize: '0.92rem',
      fontWeight: 500,
      textTransform: 'none', // More friendly, less corporate
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        size: 'medium',
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: '0.92rem',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '0.92rem',
          },
        },
      },
    },
  },
});


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);