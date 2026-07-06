import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, SHADOW, RADIUS } from "../../theme";
import AnnouncementCarousel from "../../components/common/AnnouncementCarousel";
import {
  FiCalendar,
  FiUser,
  FiBriefcase,
  FiCheckCircle,
} from "react-icons/fi";

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [showDashboard, setShowDashboard] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  
  // --- Live Synchronized Employee State Matrix ---
  const [liveProfile, setLiveProfile] = useState({
    fullName: "Employee",
    department: "...",
    manager: "...",
    leaveBalance: "0",
    pendingRequests: 0, 
    casualLeave: 0,
    sickLeave: 0,
    earnedLeave: 0
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // --- Dynamic Injection of Keyframes for the UI Loader Spinner ---
  useEffect(() => {
    if (!document.getElementById("spinner-keyframes")) {
      const styleTag = document.createElement("style");
      styleTag.id = "spinner-keyframes";
      styleTag.innerHTML = `
        @keyframes dashboardSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleTag);
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Defensive parsing looking at explicit item or JSON stringified payload structures
      let storedEmployeeId = localStorage.getItem("employeeId"); 
      if (!storedEmployeeId && localStorage.getItem("user")) {
        try {
          const parsedUser = JSON.parse(localStorage.getItem("user"));
          storedEmployeeId = parsedUser.id || parsedUser.EmployeeID || parsedUser.employeeId;
        } catch (e) {
          console.error("Failed decoding text schema configuration from user object", e);
        }
      }

      if (!storedEmployeeId) {
        console.error("Contextual termination: No valid employee identifier located in storage mapping.");
        setIsLoading(false);
        return;
      }

      // Query payload linking via explicit identifier parameter matching your update
      const [announcementsRes, profileRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/announcements'),
        fetch(`http://localhost:5000/api/employee/dashboard-summary?employeeId=${storedEmployeeId}`)
      ]);

      if (announcementsRes.ok) {
        const annData = await announcementsRes.json();
        setAnnouncements(annData);
      }

      if (profileRes.ok) {
        const profData = await profileRes.json();
        if (profData.success) {
          setLiveProfile(profData.profile);
        }
      }
    } catch (err) {
      console.error("Dashboard lifecycle sync stream error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (!showDashboard && announcements.length > 0 && !isLoading) {
    return (
      <AnnouncementCarousel 
        announcements={announcements}
        onContinue={() => setShowDashboard(true)}
        continueText="Continue To Dashboard →"
      />
    );
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '88vh', 
        color: C.text,
        fontSize: "15px",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={styles.spinner}></div>
        <span style={{ marginLeft: "12px" }}>Connecting Live SQL Data Matrices...</span>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHead}>
        <div>
          <div style={styles.welcome}>Welcome Back, {liveProfile.fullName} 👋</div>
          <h1 style={styles.pageTitle}>Employee Dashboard</h1>
          <p style={styles.pageSub}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Dynamic Data Summary Grid */}
      <div style={styles.statsGrid}>
        {[
          { title: "Leave Balance", value: liveProfile.leaveBalance, icon: <FiCalendar />, color: C.primary, bg: "#e8f4fa" },
          { title: "Pending Requests", value: liveProfile.pendingRequests, icon: <FiCheckCircle />, color: C.accent, bg: "#fde8ef" },
          { title: "Department", value: liveProfile.department, icon: <FiBriefcase />, color: "#0f6e56", bg: "#e1f5ee" },
          { title: "Manager", value: liveProfile.manager, icon: <FiUser />, color: "#854f0b", bg: "#faeeda" },
        ].map((item, index) => (
          <div key={index} style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: item.bg, color: item.color }}>
              {item.icon}
            </div>
            <div style={styles.statValue}>{item.value}</div>
            <div style={styles.statTitle}>{item.title}</div>
          </div>
        ))}
      </div>

      {/* Panels Layout Blocks */}
      <div style={styles.panelGrid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Leave Summary</h3>
          <div style={styles.leaveItem}>Casual Leave : {liveProfile.casualLeave}</div>
          <div style={styles.leaveItem}>Sick Leave : {liveProfile.sickLeave}</div>
          <div style={styles.leaveItem}>Earned Leave : {liveProfile.earnedLeave}</div>
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Recent Notices</h3>
          {announcements.slice(0, 3).map((item) => (
            <div 
              key={item.id} 
              style={styles.noticeItem}
              onClick={() => navigate(`/employee/announcements/${item.id}`, { 
                state: { announcement: item } 
              })}
            >
              {item.Notice.length > 50 ? `${item.Notice.substring(0, 50)}...` : item.Notice}
              <span style={{ 
                display: 'block', 
                fontSize: '11px', 
                color: C.muted, 
                marginTop: '4px' 
              }}>
                {new Date(item.NoticeDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })}
              </span>
            </div>
          ))}
          {announcements.length === 0 && (
            <div style={{ color: C.muted, padding: '10px 0', fontSize: '14px' }}>
              No active notices right now.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { 
    display: "flex", 
    flexDirection: "column", 
    gap: "32px", 
    padding: "32px",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  pageHead: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  welcome: { 
    color: C.primary, 
    fontWeight: "600", 
    fontSize: "15px", 
    marginBottom: "6px" 
  },
  pageTitle: { 
    fontSize: "32px", 
    fontWeight: "700", 
    margin: 0, 
    color: C.text 
  },
  pageSub: { 
    color: C.muted, 
    marginTop: "6px", 
    fontSize: "15px" 
  },
  statsGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
    gap: "20px" 
  },
  statCard: { 
    background: C.card, 
    padding: "28px 24px", 
    borderRadius: RADIUS.card, 
    boxShadow: SHADOW.card 
  },
  statIcon: { 
    width: "60px", 
    height: "60px", 
    borderRadius: "16px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    fontSize: "26px", 
    marginBottom: "20px" 
  },
  statValue: { 
    fontSize: "24px", // Adjusted down layout to fit names/departments comfortably inside cards
    fontWeight: "700", 
    color: C.text, 
    marginBottom: "4px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  statTitle: { 
    color: C.muted, 
    fontSize: "15px" 
  },
  panelGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", 
    gap: "24px" 
  },
  panel: { 
    background: C.card, 
    padding: "28px", 
    borderRadius: RADIUS.card, 
    boxShadow: SHADOW.card 
  },
  panelTitle: { 
    fontSize: "19px", 
    fontWeight: "700", 
    color: C.text, 
    marginBottom: "20px" 
  },
  leaveItem: { 
    padding: "14px 18px", 
    background: "#f8fafc", 
    border: `1px solid ${C.borderLight || '#e2e8f0'}`, 
    borderRadius: RADIUS.button, 
    marginBottom: "10px", 
    fontSize: "15px", 
    color: C.text 
  },
  noticeItem: { 
    padding: "14px 18px", 
    background: "#f8fafc", 
    border: `1px solid ${C.borderLight || '#e2e8f0'}`, 
    borderRadius: RADIUS.button, 
    marginBottom: "10px", 
    fontSize: "14px", 
    color: C.text, 
    fontWeight: "500",
    cursor: "pointer"
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid #cbd5e1",
    borderTop: `2px solid ${C.primary}`,
    borderRadius: "50%",
    animation: "dashboardSpin 0.6s linear infinite" // Updated name binding to style injection mapping
  }
};