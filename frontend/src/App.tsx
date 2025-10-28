// MOONLIT Lab Portal Automation - Main App Component

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';

// Import components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import Orders from './pages/Orders';
import Results from './pages/Results';
import Patients from './pages/Patients';
import Settings from './pages/Settings';

// Import contexts
import { SocketProvider } from './contexts/SocketContext';
import { AuthProvider } from './contexts/AuthContext';

// Create Moonlit theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#C5A882', // Tan/Taupe - Primary buttons and interactions
      light: '#ddd0bc',
      dark: '#a38654',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#E89C8A', // Terracotta/Salmon - Accent color
      light: '#f3baa9',
      dark: '#d56f56',
      contrastText: '#ffffff',
    },
    success: {
      main: '#D4F1E8', // Mint green
      dark: '#a8d6c3',
      contrastText: '#0A1F3D',
    },
    error: {
      main: '#d56f56', // Soft red from terracotta family
      light: '#f3baa9',
      dark: '#b55944',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#F5D6C8', // Light coral
      dark: '#e2b8a4',
      contrastText: '#0A1F3D',
    },
    info: {
      main: '#6f7e97', // Soft navy-gray
      light: '#98a3b5',
      dark: '#4e5f7e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F5F1ED', // Cream background
      paper: '#ffffff',
    },
    text: {
      primary: '#0A1F3D', // Navy for primary text
      secondary: '#4e5f7e', // Lighter navy for secondary text
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // Headings use serif font
    h1: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '2.5rem',
      fontWeight: 500,
      color: '#0A1F3D',
      letterSpacing: '-0.01em',
    },
    h2: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '2rem',
      fontWeight: 500,
      color: '#0A1F3D',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '1.75rem',
      fontWeight: 500,
      color: '#0A1F3D',
      letterSpacing: '-0.01em',
    },
    h4: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '1.5rem',
      fontWeight: 500,
      color: '#0A1F3D',
    },
    h5: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '1.25rem',
      fontWeight: 500,
      color: '#0A1F3D',
    },
    h6: {
      fontFamily: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
      fontSize: '1.1rem',
      fontWeight: 500,
      color: '#0A1F3D',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#0A1F3D',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: '#4e5f7e',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          fontWeight: 500,
          padding: '10px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(197, 168, 130, 0.2)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 4px 12px rgba(197, 168, 130, 0.25)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(10, 31, 61, 0.05)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(10, 31, 61, 0.05)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#C5A882',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '9999px', // Pill shape
          fontWeight: 500,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
        >
          <AuthProvider>
            <SocketProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="new-order" element={<NewOrder />} />
                    <Route path="orders" element={<Orders />} />
                    <Route path="results" element={<Results />} />
                    <Route path="patients" element={<Patients />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </Router>
            </SocketProvider>
          </AuthProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;