import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FiStar } from "react-icons/fi";


// Using consistent theme variables
const C = {
  sidebarBg: '#0d2d3d',
  sidebarHover: '#1a4f66',
  sidebarActive: '#2b7da1',
  textLight: '#ffffff',
  textMuted: '#94a3b8',
  bodyBg: '#f8fafc',
  border: '#e2e8f0'
};

const ManagerLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [managerName, setManagerName] = useState('Manager');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser.name) {
      setManagerName(storedUser.name);
    }
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.clear();
      navigate("/");
    }
  };

  // Sidebar Menu items specifically crafted for Manager/Supervisor tasks
  const menuItems = [
    { label: 'Dashboard', path: '/manager/dashboard', icon: '📊' },
    { label: 'Timesheet Approvals', path: '/manager/timesheet', icon: '📋' },
    { label: 'Resignations', path: '/manager/resignations', icon: '👩‍💼' },
    { label: 'Team Leaves', path: '/manager/leaves', icon: '📅' },
    // { label: 'My Profile', path: '/manager/profile', icon: '👩‍💼' },
    { label: 'Candidates', path: '/manager/Recruitment/candidates', icon: '🧑‍💼' },
    { label: 'Interview Pipeline', path: '/manager/Recruitment/interviews', icon: '🎯' },
    { label: "Announcements", path: "/manager/announcements", icon: <FiStar />  },
  ];

  return (
    <div style={styles.layoutWrapper}>
      
      {/* 1. DEDICATED MANAGER SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.logoSpace}>
          <strong style={{ fontSize: '18px', color: '#fff', letterSpacing: '1px' }}>WORKSPACE</strong>
          <span style={styles.roleTag}>Manager Portal</span>
        </div>

        <nav style={styles.navMenu}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
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

      {/* 2. MAIN CONTENT VIEWPORT */}
      <div style={styles.mainViewport}>
        
        {/* TOP MINI NAVBAR */}
        <header style={styles.topHeader}>
          <div style={{ fontSize: '14px', color: C.sidebarBg, fontWeight: '600' }}>
            Welcome back, <span style={{ color: C.sidebarActive }}>{managerName}</span>
          </div>
          <div style={styles.avatarCircle}>
            {managerName.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* CONTROLLER RENDER REGION */}
        <main style={styles.pageContent}>
          <Outlet /> {/* This is where ManagerTimesheetReview renders! */}
        </main>
      </div>

    </div>
  );
};

const styles = {
  layoutWrapper: { display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: "system-ui, sans-serif", backgroundColor: C.bodyBg },
  sidebar: { width: '260px', height: '100%', backgroundColor: C.sidebarBg, display: 'flex', flexDirection: 'column', color: C.textLight },
  logoSpace: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  roleTag: { fontSize: '11px', color: '#cbd5e1', background: '#d63a6e', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', marginTop: '4px', fontWeight: 'bold' },
  navMenu: { flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  navLink: { display: 'flex', alignItems: 'center', gap: '12px', color: C.textLight, textDecoration: 'none', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', transition: 'background 0.2s' },
  sidebarFooter: { padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' },
  logoutBtn: { width: '100%', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' },
  
  mainViewport: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  topHeader: { height: '60px', backgroundColor: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' },
  avatarCircle: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: C.sidebarActive, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px' },
  pageContent: { flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }
};

export default ManagerLayout;