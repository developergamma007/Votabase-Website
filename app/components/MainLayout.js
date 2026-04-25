'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  LiveTv,
  Groups,
  PersonAddAlt,
  HowToVote,
  TrackChanges,
  Assessment,
  Campaign,
  Apartment,
  BarChart,
  Smartphone,
  Search as SearchIcon,
  FamilyRestroom,
  EventNote,
  HowToVote as HowToVoteIcon,
  Print as PrintIcon,
  AccountCircle,
  Logout as LogoutIcon,
  UploadFile,
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { mobileApi } from '../lib/mobileApi';

const menuItems = [
  // Core dashboard
  { label: 'Home', path: '/home', icon: <HomeIcon fontSize="small" /> },
  // { label: 'Voters Data', path: '/votersData', icon: <HowToVote fontSize="small" /> },
  // { label: 'Voters Reach', path: '/votersReach', icon: <TrackChanges fontSize="small" /> },
  // { label: 'Result Analysis', path: '/resultAnalysis', icon: <Assessment fontSize="small" /> },
  // { label: 'Client Banners', path: '/clientBanners', icon: <Campaign fontSize="small" /> },
  // { label: 'Tenants', path: '/tenants', icon: <Apartment fontSize="small" /> },
  // { label: 'Reports', path: '/reports', icon: <BarChart fontSize="small" /> },

  // Mobile suite (these paths are more specific than '/mobile', so should come first)
  { label: 'Search Voter', path: '/mobile/search-voter', icon: <SearchIcon fontSize="small" /> },
  { label: 'Search Booth', path: '/mobile/search-booth', icon: <HowToVoteIcon fontSize="small" /> },
  { label: 'Voters Family', path: '/mobile/voters-family', icon: <FamilyRestroom fontSize="small" /> },
  { label: 'Meetings', path: '/mobile/meetings', icon: <EventNote fontSize="small" /> },
  { label: 'Poll Day', path: '/mobile/poll-day', icon: <TrackChanges fontSize="small" /> },
  { label: 'Print', path: '/mobile/print', icon: <PrintIcon fontSize="small" /> },
  // { label: 'Extract', path: '/mobile/extract', icon: <UploadFile fontSize="small" /> },
  { label: 'Add Volunteer', path: '/mobile/add-volunteer', icon: <PersonAddAlt fontSize="small" /> },
  { label: 'Manage Volunteers', path: '/mobile/my-volunteers', icon: <Groups fontSize="small" /> },
  { label: 'Volunteer Analysis', path: '/mobile/volunteer-analysis', icon: <BarChart fontSize="small" /> },
  { label: 'Promotions', path: '/mobile/promotions', icon: <Campaign fontSize="small" /> },
];

export default function MainLayout({ children, hidePrimaryNav = false }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState({});
  const [role, setRole] = useState('');
  const [printEnabled, setPrintEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const parsed = JSON.parse(localStorage.getItem('userInfo') || '{}');
      setUserInfo(parsed || {});
      const rawRole = parsed?.role || localStorage.getItem('role') || '';
      setRole(rawRole.replace('ROLE_', '').toUpperCase());
    } catch {
      setUserInfo({});
      const rawRole = typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '';
      setRole(rawRole.replace('ROLE_', '').toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (role && role !== 'BOOTH') {
      mobileApi.fetchMessageTemplate(null, 'PRINT')
        .then(res => {
          const enabled = res?.data?.result?.enabled;
          if (enabled !== undefined) setPrintEnabled(enabled);
        })
        .catch(() => setPrintEnabled(true)); // default to true if failed
    }
  }, [role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Reset scroll position on route change
    window.scrollTo(0, 0);
    const contentArea = document.querySelector('.content-area');
    if (contentArea) contentArea.scrollTop = 0;

    if (window.matchMedia('(max-width: 900px)').matches) {
      setOpen(false);
      setProfileOpen(false);
    }
  }, [pathname]);

  const filteredMenuItems = useMemo(() => {
    let items = menuItems;
    
    if (role === 'BOOTH') {
      items = items.filter(item => !['/home', '/volunteers', '/mobile/add-volunteer', '/mobile/my-volunteers', '/mobile/volunteer-analysis'].includes(item.path));
    }
    
    // Only show Promotions to SUPER_ADMIN
    if (role !== 'SUPER_ADMIN') {
      items = items.filter(item => item.path !== '/mobile/promotions');
    }
    
    // Voters Family and Meetings restricted to specific volunteer levels
    if (!['SUPER_ADMIN', 'ADMIN', 'WARD', 'BOOTH', 'USER'].includes(role)) {
      items = items.filter(item => !['/mobile/voters-family', '/mobile/meetings'].includes(item.path));
    }

    if (!printEnabled) {
      items = items.filter(item => item.path !== '/mobile/print');
    }
    return items;
  }, [role, printEnabled]);

  const activeLabel = useMemo(() => {
    const found = filteredMenuItems.find((item) => pathname.startsWith(item.path));
    return found?.label || 'Dashboard';
  }, [pathname, filteredMenuItems]);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  };

  const isSmallScreen = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;

  const handleNavClick = () => {
    if (!open) {
      setOpen(true);
    } else if (isSmallScreen()) {
      setOpen(false);
    }
  };

  const handleBackdropClick = () => {
    if (isSmallScreen() && open) {
      setOpen(false);
    }
    if (profileOpen) setProfileOpen(false);
  };

  const displayName = userInfo?.firstName || userInfo?.userName || userInfo?.name || 'User';
  const displayPhone = userInfo?.phone || userInfo?.mobile || '';

  return (
    <div className={`app-shell app-font ${open ? 'nav-open' : 'nav-closed'}`}>
      {!hidePrimaryNav && (
        <aside className={`side-nav ${open ? 'expanded' : 'collapsed'}`}>
          <div className="brand-row">
            <button className="icon-btn" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
              <MenuIcon fontSize="small" />
            </button>
            {open && (
              <div>
                <p className="brand-title">Votabase</p>
                <p className="brand-subtitle">Premium Console</p>
              </div>
            )}
          </div>
          <nav className="menu-grid">
            {filteredMenuItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link key={item.path} href={item.path} className={`menu-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                  <span className="menu-icon">{item.icon}</span>
                  {open && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}
      <div className="main-wrap">
        <header className="top-bar">
          {!hidePrimaryNav && (
            <button
              className={`top-bar-menu ${open ? 'hidden' : ''}`}
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              type="button"
            >
              <MenuIcon fontSize="small" />
            </button>
          )}
          <div className="top-bar-title">
            <h6 className="top-title">{activeLabel}</h6>
          </div>
          <div className="profile-menu">
            <button className="profile-trigger" type="button" onClick={() => setProfileOpen((v) => !v)}>
              <AccountCircle fontSize="small" />
            </button>
            {profileOpen ? (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <div className="profile-name">{displayName}</div>
                  {displayPhone ? <div className="profile-phone">{displayPhone}</div> : null}
                </div>
                <button onClick={handleLogout} className="profile-logout" type="button">
                  <LogoutIcon fontSize="small" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="content-area" onClick={handleBackdropClick}>{children}</main>
      </div>
    </div>
  );
}
