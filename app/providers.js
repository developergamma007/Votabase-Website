'use client';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ScreenshotProtection from './components/ScreenshotProtection';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

export default function Providers({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ScreenshotProtection />
      {children}
    </ThemeProvider>
  );
}

