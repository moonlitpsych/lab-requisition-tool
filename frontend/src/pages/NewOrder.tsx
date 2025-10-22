// New Order Form - Submit lab orders to Labcorp or Quest

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Autocomplete,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Send as SendIcon,
  LocalHospital as LabIcon,
  Person as PersonIcon,
  Assignment as TestIcon,
  Description as NotesIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import axios from 'axios';
import { format } from 'date-fns';

// Common lab tests - you can expand this list
const COMMON_LAB_TESTS = [
  { code: '001453', name: 'Comprehensive Metabolic Panel (CMP)', category: 'Chemistry' },
  { code: '005009', name: 'Complete Blood Count with Differential', category: 'Hematology' },
  { code: '004515', name: 'Thyroid Stimulating Hormone (TSH)', category: 'Endocrinology' },
  { code: '303756', name: 'Lipid Panel', category: 'Chemistry' },
  { code: '001453', name: 'Hemoglobin A1c', category: 'Chemistry' },
  { code: '001859', name: 'Lithium Level', category: 'Drug Monitoring' },
  { code: '001529', name: 'Valproic Acid Level', category: 'Drug Monitoring' },
  { code: '004465', name: 'Prolactin', category: 'Endocrinology' },
  { code: '081950', name: 'Vitamin D, 25-Hydroxy', category: 'Chemistry' },
  { code: '001503', name: 'Vitamin B12', category: 'Chemistry' },
  { code: '002014', name: 'Urinalysis', category: 'Urinalysis' },
  { code: '001321', name: 'Basic Metabolic Panel', category: 'Chemistry' },
  { code: '001974', name: 'Liver Function Panel', category: 'Chemistry' },
  { code: '001610', name: 'Creatinine', category: 'Chemistry' },
  { code: '003269', name: 'Iron Panel', category: 'Chemistry' },
];

// Common diagnosis codes for psychiatry
const COMMON_DIAGNOSIS_CODES = [
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.1', description: 'Major depressive disorder, recurrent, moderate' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'F31.9', description: 'Bipolar disorder, unspecified' },
  { code: 'F20.9', description: 'Schizophrenia, unspecified' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified' },
  { code: 'F90.2', description: 'Attention-deficit hyperactivity disorder, combined type' },
  { code: 'F60.3', description: 'Borderline personality disorder' },
  { code: 'Z79.899', description: 'Other long term (current) drug therapy' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination' },
];

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  medicaidId: string;
  phone: string;
}

const NewOrder: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState<'labcorp' | 'quest'>('labcorp');
  const [patient, setPatient] = useState<PatientData>({
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    medicaidId: '',
    phone: '',
  });
  const [selectedTests, setSelectedTests] = useState<typeof COMMON_LAB_TESTS>([]);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [statOrder, setStatOrder] = useState(false);

  // Quick fill for testing - remove in production
  const quickFillTestData = () => {
    setPatient({
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: new Date('1980-01-15'),
      medicaidId: 'MED123456789',
      phone: '801-555-1234',
    });
    setSelectedTests([COMMON_LAB_TESTS[0], COMMON_LAB_TESTS[1], COMMON_LAB_TESTS[2]]);
    setSelectedDiagnoses(['F32.9', 'Z79.899']);
  };

  const validateForm = (): boolean => {
    if (!patient.firstName || !patient.lastName) {
      enqueueSnackbar('Please enter patient name', { variant: 'error' });
      return false;
    }
    if (!patient.dateOfBirth) {
      enqueueSnackbar('Please enter date of birth', { variant: 'error' });
      return false;
    }
    if (selectedTests.length === 0) {
      enqueueSnackbar('Please select at least one test', { variant: 'error' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const orderData = {
        portal,
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: format(patient.dateOfBirth!, 'yyyy-MM-dd'),
          medicaidId: patient.medicaidId,
          phone: patient.phone,
        },
        tests: selectedTests.map(test => ({
          code: test.code,
          name: test.name,
        })),
        diagnosisCodes: selectedDiagnoses,
        specialInstructions: specialInstructions + (statOrder ? ' [STAT ORDER]' : ''),
      };

      const response = await axios.post('/api/portal-automation/order', orderData);

      if (response.data.success) {
        enqueueSnackbar(
          `Order submitted to ${portal.toUpperCase()} - ${response.data.status === 'preview' ? 'Preview ready' : 'Processing'}`,
          { variant: 'success' }
        );

        // Navigate to orders page or dashboard
        if (response.data.status === 'preview') {
          // If preview, go to dashboard where preview modal can be opened
          navigate('/dashboard');
        } else {
          navigate('/orders');
        }
      }
    } catch (error: any) {
      console.error('Order submission failed:', error);
      enqueueSnackbar(
        error.response?.data?.message || 'Failed to submit order',
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setPatient({
      firstName: '',
      lastName: '',
      dateOfBirth: null,
      medicaidId: '',
      phone: '',
    });
    setSelectedTests([]);
    setSelectedDiagnoses([]);
    setSpecialInstructions('');
    setStatOrder(false);
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" fontWeight={600} gutterBottom>
          New Lab Order
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Submit lab orders to Labcorp or Quest portals
        </Typography>
      </Box>

      {/* Quick Test Data Button - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <Button
          onClick={quickFillTestData}
          size="small"
          sx={{ mb: 2 }}
          variant="outlined"
        >
          Quick Fill Test Data
        </Button>
      )}

      <Grid container spacing={3}>
        {/* Portal Selection */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <LabIcon color="primary" />
              <Typography variant="h6">Select Portal</Typography>
            </Box>

            <FormControl component="fieldset">
              <RadioGroup
                row
                value={portal}
                onChange={(e) => setPortal(e.target.value as 'labcorp' | 'quest')}
              >
                <FormControlLabel
                  value="labcorp"
                  control={<Radio />}
                  label={
                    <Chip
                      label="Labcorp"
                      color={portal === 'labcorp' ? 'primary' : 'default'}
                      clickable
                    />
                  }
                />
                <FormControlLabel
                  value="quest"
                  control={<Radio />}
                  label={
                    <Chip
                      label="Quest"
                      color={portal === 'quest' ? 'secondary' : 'default'}
                      clickable
                    />
                  }
                />
              </RadioGroup>
            </FormControl>
          </Paper>
        </Grid>

        {/* Patient Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <PersonIcon color="primary" />
              <Typography variant="h6">Patient Information</Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={patient.firstName}
                  onChange={(e) => setPatient({ ...patient, firstName: e.target.value })}
                  fullWidth
                  required
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={patient.lastName}
                  onChange={(e) => setPatient({ ...patient, lastName: e.target.value })}
                  fullWidth
                  required
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Date of Birth"
                  value={patient.dateOfBirth}
                  onChange={(date) => setPatient({ ...patient, dateOfBirth: date })}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      variant: 'outlined',
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  value={patient.phone}
                  onChange={(e) => setPatient({ ...patient, phone: e.target.value })}
                  fullWidth
                  variant="outlined"
                  placeholder="801-555-1234"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Medicaid ID"
                  value={patient.medicaidId}
                  onChange={(e) => setPatient({ ...patient, medicaidId: e.target.value })}
                  fullWidth
                  variant="outlined"
                  helperText="Optional - Enter if available"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Lab Tests Selection */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <TestIcon color="primary" />
              <Typography variant="h6">Lab Tests</Typography>
            </Box>

            <Autocomplete
              multiple
              options={COMMON_LAB_TESTS}
              value={selectedTests}
              onChange={(_, newValue) => setSelectedTests(newValue)}
              getOptionLabel={(option) => option.name}
              groupBy={(option) => option.category}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Lab Tests"
                  placeholder="Type to search tests..."
                  required
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    size="small"
                    color="primary"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />

            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Selected: {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={statOrder}
                  onChange={(e) => setStatOrder(e.target.checked)}
                  color="error"
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography>STAT Order</Typography>
                  <Chip label="Urgent" size="small" color="error" />
                </Box>
              }
              sx={{ mt: 2 }}
            />
          </Paper>
        </Grid>

        {/* Diagnosis Codes */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Diagnosis Codes (ICD-10)
            </Typography>

            <Autocomplete
              multiple
              options={COMMON_DIAGNOSIS_CODES}
              value={COMMON_DIAGNOSIS_CODES.filter(d => selectedDiagnoses.includes(d.code))}
              onChange={(_, newValue) => setSelectedDiagnoses(newValue.map(v => v.code))}
              getOptionLabel={(option) => `${option.code} - ${option.description}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Diagnosis Codes"
                  placeholder="Type to search..."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.code}
                    size="small"
                    color="secondary"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Paper>
        </Grid>

        {/* Special Instructions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <NotesIcon color="primary" />
              <Typography variant="h6">Special Instructions</Typography>
            </Box>

            <TextField
              label="Additional Notes (Optional)"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              multiline
              rows={3}
              fullWidth
              variant="outlined"
              placeholder="Enter any special instructions or notes..."
            />
          </Paper>
        </Grid>

        {/* Preview Alert */}
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Preview Mode Active:</strong> Your order will be filled on {portal === 'labcorp' ? 'Labcorp Link' : 'Quest Quanum'} but not submitted automatically.
              You'll review a screenshot of the filled form and can choose to submit or generate a PDF.
            </Typography>
          </Alert>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button
              onClick={handleClear}
              startIcon={<ClearIcon />}
              color="inherit"
              disabled={loading}
            >
              Clear Form
            </Button>

            <Button
              onClick={handleSubmit}
              variant="contained"
              color="primary"
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              disabled={loading}
            >
              {loading ? 'Submitting...' : `Submit to ${portal.toUpperCase()}`}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default NewOrder;