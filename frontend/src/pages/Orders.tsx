import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Orders: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Orders
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Orders list will be displayed here</Typography>
      </Paper>
    </Box>
  );
};

export default Orders;