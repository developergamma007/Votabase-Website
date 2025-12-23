'use client';

import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const drawerWidth = 240;

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  const handleToggleDrawer = () => setOpen(!open);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Header */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleToggleDrawer} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Admin Panel
          </Typography>
          <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? drawerWidth : 60,
          flexShrink: 0,
          transition: 'width 0.3s',
          [`& .MuiDrawer-paper`]: {
            width: open ? drawerWidth : 60,
            transition: 'width 0.3s',
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <List>
          <ListItemButton component={Link} href="/dashboard">
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Dashboard" />}
          </ListItemButton>
          <ListItemButton component={Link} href="/tenants">
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Tenants" />}
          </ListItemButton>
          <ListItemButton component={Link} href="/reports">
            <ListItemIcon>
              <BarChartIcon />
            </ListItemIcon>
            {open && <ListItemText primary="Reports" />}
          </ListItemButton>
        </List>
      </Drawer>

      {/* Page content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
        {children}
      </Box>
    </Box>
  );
}

