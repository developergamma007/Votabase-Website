'use client';

import { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  IconButton,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  Logout as LogoutIcon,
  LiveTv,
  Groups,
  TrackChanges,
  Assessment,
  Campaign,
  Apartment,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const drawerWidth = 240;

const menuItems = [
  { label: 'Home', path: '/home', icon: <DashboardIcon /> },
  { label: 'Live Updates', path: '/liveUpdates', icon: <LiveTv /> },
  { label: 'Volunteers', path: '/volunteers', icon: <Groups /> },
  { label: 'Voters Data', path: '/votersData', icon: <PeopleIcon /> },
  { label: 'Voters Reach', path: '/votersReach', icon: <TrackChanges /> },
  { label: 'Result Analysis', path: '/resultAnalysis', icon: <Assessment /> },
  { label: 'Client Banners', path: '/clientBanners', icon: <Campaign /> },
  { label: 'Tenants', path: '/tenants', icon: <Apartment /> },
  { label: 'Reports', path: '/reports', icon: <BarChartIcon /> },
];

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const handleToggleDrawer = () => setOpen(!open);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <Box className="flex min-h-screen">
      {/* ================= HEADER ================= */}
      <AppBar
        position="fixed"
        className="bg-white text-gray-800 shadow-sm"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar className="flex justify-between">
          <div className="flex items-center gap-2">
            <IconButton onClick={handleToggleDrawer}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" className="font-semibold">
              Admin Panel
            </Typography>
          </div>

        <button
  onClick={handleLogout}
  startIcon={<LogoutIcon />}
  className="text-red-600 hover:bg-red-50 bg-white p-3 rounded-2xl"
>
  Logout
</button>

        </Toolbar>
      </AppBar>

      {/* ================= SIDEBAR ================= */}
      <Drawer
        variant="permanent"
        sx={{
          width: open ? drawerWidth : 72,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: open ? drawerWidth : 72,
            backgroundColor: '#e5e7eb', // ash color
            borderRight: '1px solid #d1d5db',
            transition: 'width 0.3s',
            overflowX: 'hidden',
          },
        }}
      >
        <Toolbar />

        <div className="px-2 space-y-1 mt-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  flex items-center gap-3 rounded-lg px-3 py-2
                  transition-all duration-200
                  ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-300 hover:text-blue-700'
                  }
                `}
              >
                <span
                  className={`flex items-center justify-center ${
                    isActive ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {item.icon}
                </span>

                {open && (
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Drawer>

      {/* ================= CONTENT ================= */}
      <Box
        component="main"
        className="flex-1 bg-gray-50 p-6 mt-16"
      >
        {children}
      </Box>
    </Box>
  );
}
