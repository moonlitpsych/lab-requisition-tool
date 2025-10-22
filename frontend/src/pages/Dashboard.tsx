// Dashboard Component - Main overview with statistics and recent activity

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  LocalHospital as LabIcon,
  Assignment as OrderIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  Schedule as PendingIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import PreviewModal from '../components/PreviewModal';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedToday: number;
  failedOrders: number;
  resultsToReview: number;
  criticalResults: number;
}

interface RecentOrder {
  id: string;
  portal: 'labcorp' | 'quest';
  patient_name: string;
  status: string;
  confirmation_number?: string;
  created_at: string;
}

interface RecentResult {
  id: string;
  patient_name: string;
  test_name: string;
  result_status: string;
  result_date: string;
  is_reviewed: boolean;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const socket = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    completedToday: 0,
    failedOrders: 0,
    resultsToReview: 0,
    criticalResults: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();

    // Listen for real-time updates
    if (socket) {
      socket.on('order-status', (data) => {
        console.log('Order status update:', data);
        // Refresh dashboard when order status changes
        fetchDashboardData();
      });
    }

    return () => {
      if (socket) {
        socket.off('order-status');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch multiple endpoints in parallel
      const [ordersRes, resultsRes, statsRes] = await Promise.all([
        axios.get('/api/portal-automation/active-orders'),
        axios.get('/api/results/recent'),
        axios.get('/api/results/stats'),
      ]);

      setRecentOrders(ordersRes.data.orders || []);
      setRecentResults(resultsRes.data.results || []);

      // Calculate stats
      const activeOrders = ordersRes.data.orders || [];
      const resultStats = statsRes.data || {};

      setStats({
        totalOrders: activeOrders.length,
        pendingOrders: activeOrders.filter((o: any) => o.status === 'pending').length,
        completedToday: activeOrders.filter((o: any) =>
          o.status === 'completed' &&
          new Date(o.created_at).toDateString() === new Date().toDateString()
        ).length,
        failedOrders: activeOrders.filter((o: any) => o.status === 'failed').length,
        resultsToReview: resultStats.unreviewed || 0,
        criticalResults: resultStats.critical || 0,
      });

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handlePreviewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setPreviewModalOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CompleteIcon color="success" />;
      case 'pending':
        return <PendingIcon color="action" />;
      case 'preview':
        return <PreviewIcon color="info" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <OrderIcon />;
    }
  };

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'default';
      case 'preview':
        return 'info';
      case 'failed':
        return 'error';
      case 'critical':
        return 'error';
      case 'abnormal':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" fontWeight={600}>
            Dashboard
          </Typography>
          <Box>
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon className={refreshing ? 'spinning' : ''} />
            </IconButton>
            <Button
              variant="contained"
              startIcon={<LabIcon />}
              onClick={() => navigate('/new-order')}
              sx={{ ml: 2 }}
            >
              New Order
            </Button>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Welcome to MOONLIT Lab Portal Automation
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Active Orders
                  </Typography>
                  <Typography variant="h3">
                    {stats.totalOrders}
                  </Typography>
                </Box>
                <OrderIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Pending
                  </Typography>
                  <Typography variant="h3">
                    {stats.pendingOrders}
                  </Typography>
                </Box>
                <PendingIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Completed Today
                  </Typography>
                  <Typography variant="h3">
                    {stats.completedToday}
                  </Typography>
                </Box>
                <CompleteIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Failed
                  </Typography>
                  <Typography variant="h3">
                    {stats.failedOrders}
                  </Typography>
                </Box>
                <ErrorIcon sx={{ fontSize: 40, color: 'error.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Results to Review
                  </Typography>
                  <Typography variant="h3">
                    {stats.resultsToReview}
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Critical Results
                  </Typography>
                  <Typography variant="h3" color="error">
                    {stats.criticalResults}
                  </Typography>
                </Box>
                <ErrorIcon sx={{ fontSize: 40, color: 'error.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {stats.criticalResults > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={500}>
            {stats.criticalResults} critical result{stats.criticalResults !== 1 ? 's' : ''} require immediate attention!
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => navigate('/results?filter=critical')}
            sx={{ mt: 1 }}
          >
            View Critical Results
          </Button>
        </Alert>
      )}

      {stats.failedOrders > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" fontWeight={500}>
            {stats.failedOrders} order{stats.failedOrders !== 1 ? 's' : ''} failed and may need to be resubmitted.
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => navigate('/orders?filter=failed')}
            sx={{ mt: 1 }}
          >
            View Failed Orders
          </Button>
        </Alert>
      )}

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Recent Orders</Typography>
              <Button
                size="small"
                endIcon={<ArrowIcon />}
                onClick={() => navigate('/orders')}
              >
                View All
              </Button>
            </Box>

            <List>
              {recentOrders.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="No recent orders"
                    secondary="Create a new order to get started"
                  />
                </ListItem>
              ) : (
                recentOrders.slice(0, 5).map((order) => (
                  <React.Fragment key={order.id}>
                    <ListItem>
                      <Box display="flex" alignItems="center" mr={2}>
                        {getStatusIcon(order.status)}
                      </Box>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1">{order.patient_name}</Typography>
                            <Chip
                              label={order.portal}
                              size="small"
                              color={order.portal === 'labcorp' ? 'primary' : 'secondary'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                            </Typography>
                            {order.confirmation_number && (
                              <Typography variant="body2" color="success.main">
                                Confirmation: {order.confirmation_number}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Box>
                        <Chip
                          label={order.status}
                          size="small"
                          color={getStatusColor(order.status)}
                        />
                        {order.status === 'preview' && (
                          <IconButton
                            size="small"
                            onClick={() => handlePreviewOrder(order.id)}
                            sx={{ ml: 1 }}
                          >
                            <PreviewIcon />
                          </IconButton>
                        )}
                      </Box>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Recent Results</Typography>
              <Button
                size="small"
                endIcon={<ArrowIcon />}
                onClick={() => navigate('/results')}
              >
                View All
              </Button>
            </Box>

            <List>
              {recentResults.length === 0 ? (
                <ListItem>
                  <ListItemText
                    primary="No recent results"
                    secondary="Results will appear here as they become available"
                  />
                </ListItem>
              ) : (
                recentResults.slice(0, 5).map((result) => (
                  <React.Fragment key={result.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1">{result.patient_name}</Typography>
                            {!result.is_reviewed && (
                              <Chip label="Unreviewed" size="small" color="warning" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">{result.test_name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {format(new Date(result.result_date), 'MMM d, yyyy')}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={result.result_status}
                        size="small"
                        color={getStatusColor(result.result_status)}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Preview Modal */}
      {selectedOrderId && (
        <PreviewModal
          open={previewModalOpen}
          onClose={() => {
            setPreviewModalOpen(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
          onConfirm={() => {
            fetchDashboardData();
            setPreviewModalOpen(false);
            setSelectedOrderId(null);
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .spinning {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default Dashboard;