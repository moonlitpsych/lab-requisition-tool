import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Patients: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Patients
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Patient list will be displayed here</Typography>
      </Paper>
    </Box>
  );
};

export default Patients;