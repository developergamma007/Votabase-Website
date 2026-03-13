'use client';

import { useMemo, useState } from 'react';
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
  Logout as LogoutIcon,
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const menuItems = [
  // Core dashboard
  // { label: 'Home', path: '/home', icon: <HomeIcon fontSize="small" /> },
  // { label: 'Live Updates', path: '/liveUpdates', icon: <LiveTv fontSize="small" /> },
  // { label: 'Volunteers', path: '/volunteers', icon: <Groups fontSize="small" /> },
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
  { label: 'Add Volunteer', path: '/mobile/add-volunteer', icon: <PersonAddAlt fontSize="small" /> },
  { label: 'My Volunteers', path: '/mobile/my-volunteers', icon: <Groups fontSize="small" /> },
];

export default function MainLayout({ children, hidePrimaryNav = false }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const activeLabel = useMemo(() => {
    const found = menuItems.find((item) => pathname.startsWith(item.path));
    return found?.label || 'Dashboard';
  }, [pathname]);

  const handleLogout = () => {
    localStorage.clear();
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <div className="app-shell app-font">
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
            {menuItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link key={item.path} href={item.path} className={`menu-item ${isActive ? 'active' : ''}`}>
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
          <div>
            <h6 className="top-title">{activeLabel}</h6>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogoutIcon fontSize="small" />
            Logout
          </button>
        </header>

        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
