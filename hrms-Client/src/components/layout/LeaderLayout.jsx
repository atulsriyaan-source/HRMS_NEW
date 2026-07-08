import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';

const C = {
  sidebarBg: '#1e293b', // A deeper, more executive slate blue/gray for Leaders
  sidebarHover: '#334155',
  sidebarActive: '#3b82f6',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  bodyBg: '#f8fafc',
  border: '#e2e8f0'
};

const LeaderLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [leaderName, setLeaderName] = useState('Leader');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
      setLeaderName(storedUser.name);
    }
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.clear();
      navigate("/");
    }
  };

  // View-Only executive menu items
  const menuItems = [
    { label: 'Executive Dashboard', path: '/leader/dashboard', icon: '📈' },
    { label: 'Candidates', path: '/leader/Recruitment/candidates', icon: '🧑‍💼' },
    { label: 'Interview Pipeline', path: '/leader/Recruitment/interviews', icon: '🎯' },
    { label: 'Timesheet Oversight', path: '/leader/timesheet', icon: '📋' },
    { label: 'Team Leaves', path: '/leader/leaves', icon: '📅' },
    { label: 'My Profile', path: '/leader/profile', icon: '👩‍💼' },
  ];

  return (
    <div style={styles.layoutWrapper}>
      
      {/* LEADER SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.logoSpace}>
          <strong style={{ fontSize: '18px', color: '#fff', letterSpacing: '1px' }}>WORKSPACE</strong>
          <span style={styles.roleTag}>Leadership Portal</span>
        </div>

        <nav style={styles.navMenu}>
          {menuItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navLink,
                  backgroundColor: isActive ? C.sidebarActive : 'transparent',
                  fontWeight: isActive ? '700' : '500'
                }}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            🚪 Log Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <div style={styles.mainViewport}>
        <header style={styles.topHeader}>
          <div style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
            Welcome back, <span style={{ color: C.sidebarActive }}>{leaderName}</span>
          </div>
          <div style={styles.avatarCircle}>
            {leaderName.charAt(0).toUpperCase()}
          </div>
        </header>

        <main style={styles.pageContent}>
          <Outlet /> {/* Renders LeaderTimesheet here */}
        </main>
      </div>

    </div>
  );
};

const styles = {
  layoutWrapper: { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "system-ui, sans-serif", backgroundColor: C.bodyBg },
  sidebar: { width: '260px', height: '100%', backgroundColor: C.sidebarBg, display: 'flex', flexDirection: 'column', color: C.textLight },
  logoSpace: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  roleTag: { fontSize: '11px', color: '#bfdbfe', background: '#1d4ed8', padding: '3px 8px', borderRadius: '4px', width: 'fit-content', marginTop: '4px', fontWeight: 'bold', textTransform: 'uppercase' },
  navMenu: { flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  navLink: { display: 'flex', alignItems: 'center', gap: '12px', color: C.textLight, textDecoration: 'none', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', transition: 'background 0.2s' },
  sidebarFooter: { padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  logoutBtn: { width: '100%', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' },
  mainViewport: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  topHeader: { height: '60px', backgroundColor: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
  avatarCircle: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: C.sidebarActive, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px' },
  pageContent: { flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }
};

export default LeaderLayout;