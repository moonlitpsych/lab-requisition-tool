// Layout Component - Main application layout with navigation

import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  Avatar,
  Badge,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  LocalHospital as LabIcon,
  Assignment as OrdersIcon,
  Assessment as ResultsIcon,
  People as PatientsIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Notifications as NotificationIcon,
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'New Order', icon: <LabIcon />, path: '/new-order' },
  { text: 'Orders', icon: <OrdersIcon />, path: '/orders' },
  { text: 'Results', icon: <ResultsIcon />, path: '/results' },
  { text: 'Patients', icon: <PatientsIcon />, path: '/patients' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ bgcolor: 'cream.50', borderBottom: '1px solid', borderColor: 'cream.300' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box sx={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'primary.main',
            borderRadius: 2,
          }}>
            <LabIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 500,
                color: 'text.primary',
                letterSpacing: '-0.01em'
              }}
            >
              moonlit
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              PSYCHIATRY LAB PORTAL
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider />

      <List sx={{ px: 1, py: 2 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                selected={isActive}
                sx={{
                  borderRadius: 2,
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'rgba(197, 168, 130, 0.1)', // Taupe with transparency
                  },
                  '&.Mui-selected': {
                    bgcolor: 'primary.main', // Taupe
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? 'white' : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
                {item.text === 'New Order' && (
                  <Chip
                    label="Quick"
                    size="small"
                    sx={{
                      height: 20,
                      bgcolor: 'secondary.main', // Terracotta
                      color: 'white',
                      '& .MuiChip-label': {
                        fontSize: '0.7rem',
                        fontWeight: 500,
                      }
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      {/* User Section */}
      <Box p={2} sx={{ bgcolor: 'cream.50', borderTop: '1px solid', borderColor: 'cream.300' }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar sx={{
            bgcolor: 'secondary.main', // Terracotta
            color: 'white',
            fontWeight: 500,
          }}>MR</Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              Dr. Reynolds
            </Typography>
            <Typography variant="caption" color="text.secondary">
              MOONLIT Psychiatry
            </Typography>
          </Box>
        </Box>

        {/* Connection Status */}
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: socket ? '#D4F1E8' : 'error.main', // Mint for success
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {socket ? 'Connected' : 'Disconnected'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 2px 8px rgba(10, 31, 61, 0.05)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              flexGrow: 1,
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500,
              letterSpacing: '-0.01em'
            }}
          >
            {menuItems.find(item => item.path === location.pathname)?.text || 'MOONLIT Lab Portal'}
          </Typography>

          <IconButton color="inherit">
            <Badge badgeContent={notifications} color="error">
              <NotificationIcon />
            </Badge>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;