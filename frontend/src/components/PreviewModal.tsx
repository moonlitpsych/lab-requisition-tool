// Preview Modal Component - Shows order preview and allows confirmation

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as ConfirmIcon,
  Cancel as CancelIcon,
  PictureAsPdf as PdfIcon,
  Refresh as RefreshIcon,
  LocalHospital as LabIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useSocket } from '../contexts/SocketContext';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onConfirm?: () => void;
}

interface OrderPreview {
  orderId: string;
  portal: 'labcorp' | 'quest';
  status: string;
  previewUrl: string;
  patient: string;
  testsOrdered: Array<{ code?: string; name: string }>;
  diagnosisCodes: string[];
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onClose,
  orderId,
  onConfirm,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const socket = useSocket();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [orderData, setOrderData] = useState<OrderPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [automationStatus, setAutomationStatus] = useState<string>('');

  useEffect(() => {
    if (open && orderId) {
      fetchPreview();

      // Join socket room for real-time updates
      if (socket) {
        socket.emit('join-order-room', orderId);

        socket.on('order-status', (data) => {
          if (data.orderId === orderId) {
            setAutomationStatus(data.status);
          }
        });
      }
    }

    return () => {
      if (socket) {
        socket.off('order-status');
      }
    };
  }, [open, orderId, socket]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`/api/portal-automation/preview/${orderId}`);
      setOrderData(response.data);

    } catch (err: any) {
      console.error('Failed to fetch preview:', err);
      setError(err.response?.data?.error || 'Failed to load preview');
      enqueueSnackbar('Failed to load order preview', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      setAutomationStatus('Confirming order...');

      const response = await axios.post(`/api/portal-automation/confirm/${orderId}`);

      if (response.data.success) {
        enqueueSnackbar(
          `Order submitted successfully! Confirmation: ${response.data.confirmationNumber}`,
          { variant: 'success', autoHideDuration: 6000 }
        );

        if (onConfirm) {
          onConfirm();
        }
        onClose();
      } else {
        throw new Error(response.data.message || 'Confirmation failed');
      }

    } catch (err: any) {
      console.error('Failed to confirm order:', err);
      enqueueSnackbar(
        err.response?.data?.message || 'Failed to confirm order',
        { variant: 'error' }
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    try {
      setCancelling(true);

      const response = await axios.post(`/api/portal-automation/cancel/${orderId}`, {
        generatePdf: true,
      });

      if (response.data.success) {
        enqueueSnackbar('Order cancelled. PDF generated for manual submission.', {
          variant: 'info',
        });

        if (response.data.pdfUrl) {
          // Open PDF in new tab
          window.open(response.data.pdfUrl, '_blank');
        }

        onClose();
      }

    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      enqueueSnackbar('Failed to cancel order', { variant: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      const response = await axios.post(`/api/portal-automation/generate-pdf/${orderId}`);

      if (response.data.pdfUrl) {
        window.open(response.data.pdfUrl, '_blank');
        enqueueSnackbar('PDF generated successfully', { variant: 'success' });
      }

    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      enqueueSnackbar('Failed to generate PDF', { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '70vh',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h5" fontWeight={600}>
              Order Preview
            </Typography>
            {orderData && (
              <Chip
                label={orderData.portal.toUpperCase()}
                color={orderData.portal === 'labcorp' ? 'primary' : 'secondary'}
                icon={<LabIcon />}
              />
            )}
          </Box>
          <IconButton onClick={onClose} disabled={confirming || cancelling}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            <Button
              size="small"
              onClick={fetchPreview}
              startIcon={<RefreshIcon />}
              sx={{ ml: 2 }}
            >
              Retry
            </Button>
          </Alert>
        ) : orderData ? (
          <Box>
            {/* Order Details */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" gutterBottom>
                Order Details
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Patient"
                    secondary={orderData.patient}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Tests Ordered"
                    secondary={
                      <Box mt={1}>
                        {orderData.testsOrdered.map((test, index) => (
                          <Chip
                            key={index}
                            label={test.name}
                            size="small"
                            sx={{ mr: 1, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    }
                  />
                </ListItem>
                {orderData.diagnosisCodes && orderData.diagnosisCodes.length > 0 && (
                  <>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Diagnosis Codes"
                        secondary={orderData.diagnosisCodes.join(', ')}
                      />
                    </ListItem>
                  </>
                )}
              </List>
            </Paper>

            {/* Status Message */}
            {automationStatus && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {automationStatus}
              </Alert>
            )}

            {/* Preview Screenshot */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Form Preview
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Please review the filled form below. The order will be submitted exactly as shown.
              </Typography>

              <Paper
                sx={{
                  p: 1,
                  bgcolor: 'grey.100',
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'auto',
                  maxHeight: '400px',
                }}
              >
                <img
                  src={`http://localhost:3001${orderData.previewUrl}`}
                  alt="Order form preview"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-preview.png';
                    target.onerror = null;
                  }}
                />
              </Paper>
            </Box>

            {/* Information Alert */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Preview Mode:</strong> This order has been filled but not yet submitted.
                Click "Confirm & Submit" to send the order to {orderData.portal}, or
                "Cancel & Generate PDF" to create a PDF for manual submission.
              </Typography>
            </Alert>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleGeneratePdf}
          startIcon={<PdfIcon />}
          disabled={loading || confirming || cancelling}
        >
          Generate PDF
        </Button>

        <Box flex={1} />

        <Button
          onClick={handleCancel}
          startIcon={<CancelIcon />}
          color="inherit"
          disabled={loading || confirming || cancelling}
        >
          {cancelling ? 'Cancelling...' : 'Cancel & Generate PDF'}
        </Button>

        <Button
          onClick={handleConfirm}
          startIcon={confirming ? <CircularProgress size={20} /> : <ConfirmIcon />}
          variant="contained"
          color="primary"
          disabled={loading || confirming || cancelling || !orderData}
        >
          {confirming ? 'Submitting...' : 'Confirm & Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PreviewModal;