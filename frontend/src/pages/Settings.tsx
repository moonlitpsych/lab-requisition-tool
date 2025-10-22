import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Settings
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Portal credentials and settings will be configured here</Typography>
      </Paper>
    </Box>
  );
};

export default Settings;