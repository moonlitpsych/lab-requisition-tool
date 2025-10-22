import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const Results: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Results
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Lab results will be displayed here</Typography>
      </Paper>
    </Box>
  );
};

export default Results;