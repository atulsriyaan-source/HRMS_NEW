import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, SHADOW, RADIUS } from "../../theme";
import AnnouncementCarousel from "../../components/common/AnnouncementCarousel";
import {
  FiUsers,
  FiBriefcase,
  FiCalendar,
  FiMapPin,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";

// Note: I kept your original leaves array here as fallback. 
// If you want this to update from backend too, just wrap it in useState inside the component.
const leaves = [
  { type: "Sick Leave", note: "Pending Approval", count: 8 },
  { type: "Casual Leave", note: "Approved", count: 6 },
  { type: "Earned Leave", note: "This Month", count: 4 },
  { type: "Maternity Leave", note: "Active", count: 2 },
];

const pillStyle = (status) => {
  const map = {
    Active: { background: "#e1f5ee", color: "#085041" },
    "On Leave": { background: "#fde8ef", color: "#993556" },
    Remote: { background: "#e8f4fa", color: "#0c447c" },
  };
  return map[status] || { background: "#f1f5f9", color: "#475569" };
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showDashboard, setShowDashboard] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Live Dynamic Metric States (UNTOUCHED) ---
  const [liveStats, setLiveStats] = useState([
    { label: "Total Employees", value: "...", delta: "Live tracking", up: true, icon: <FiUsers />, bg: "#e8f4fa", color: C.primary },
    { label: "Departments", value: "...", delta: "System wide", up: true, icon: <FiBriefcase />, bg: "#e1f5ee", color: "#0f6e56" },
    { label: "Pending Requests", value: "...", delta: "Needs action", up: false, icon: <FiCalendar />, bg: "#fde8ef", color: C.accent },
    { label: "Branches", value: "...", delta: "Active sites", up: null, icon: <FiMapPin />, bg: "#faeeda", color: "#854f0b" },
  ]);

  const [recentEmployees, setRecentEmployees] = useState([]);
  const [leaveStats, setLeaveStats] = useState(leaves); // Binded your leaves to state so it updates if backend sends it

  // Injected CSS keyframes engine for visual state synchronization loaders
  useEffect(() => {
    if (!document.getElementById("admin-loader-style")) {
      const style = document.createElement("style");
      style.id = "admin-loader-style";
      style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  }, []);

  // 🔥 YAHAN API CALL BIND KI HAI TERE BACKEND KE HISAB SE
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Get role from localStorage or default to admin
      const role = localStorage.getItem("role")?.toLowerCase() || "admin";

      // Concurrent fetch operations for analytical stats and announcement notices
      const [announcementsRes, statsRes] = await Promise.all([
        fetch('http://localhost:5000/api/admin/announcements'),
        fetch(`http://localhost:5000/api/admin/dashboard-summary?role=${role}`) // Passing role in query
      ]);

      if (announcementsRes.ok) {
        const annData = await announcementsRes.json();
        setAnnouncements(annData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        
        // Tere backend ne "data" key ke andar bheja hai, usko exact map kar raha hu
        if (statsData.success && statsData.data) {
          const beStats = statsData.data.stats;
          
          setLiveStats([
            { label: "Total Employees", value: beStats[0].value, delta: beStats[0].delta, up: beStats[0].up, icon: <FiUsers />, bg: "#e8f4fa", color: C.primary },
            { label: "Departments", value: beStats[1].value, delta: beStats[1].delta, up: beStats[1].up, icon: <FiBriefcase />, bg: "#e1f5ee", color: "#0f6e56" },
            { label: beStats[2].label, value: beStats[2].value, delta: beStats[2].delta, up: beStats[2].up, icon: <FiCalendar />, bg: "#fde8ef", color: C.accent },
            { label: "Branches", value: beStats[3].value, delta: beStats[3].delta, up: beStats[3].up, icon: <FiMapPin />, bg: "#faeeda", color: "#854f0b" },
          ]);
          
          setRecentEmployees(statsData.data.recentEmployees);
          setLeaveStats(statsData.data.leaves); // Map leaves from backend directly
        }
      }
    } catch (err) {
      console.error("Critical Admin Dashboard sync link down:", err);
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
        <div style={{
          width: "22px", height: "22px", border: "2px solid #e2e8f0", borderTop: `2px solid ${C.primary}`, borderRadius: "50%", animation: "spin 0.6s linear infinite"
        }}></div>
        <span style={{ marginLeft: "12px", fontWeight: "500" }}>Synchronizing Master Ledger Records...</span>
      </div>
    );
  }

  // TERA EXACT JSX CODE UNTOUCHED
  return (
    <div style={styles.page}>
      <div style={styles.pageHead}>
        <div>
          <div style={styles.welcome}>Welcome back, Admin</div>
          <h1 style={styles.pageTitle}>Dashboard Overview</h1>
          <p style={styles.pageSub}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button style={styles.addBtn} onClick={() => navigate("/admin/employees")}>+ Add Employee</button>
      </div>

      <div style={styles.statsGrid}>
        {liveStats.map((item) => (
          <div key={item.label} style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: item.bg, color: item.color }}>
              {item.icon}
            </div>
            <div style={styles.statValue}>{item.value}</div>
            <div style={styles.statLabel}>{item.label}</div>
            <div style={{ ...styles.statDelta, color: item.up === false ? C.accent : item.up ? "#0f6e56" : C.muted }}>
              {item.up === true && <FiArrowUp />}
              {item.up === false && <FiArrowDown />}
              {item.delta}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.twoCol}>
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>Recent Employees</span>
            <span style={styles.link} onClick={() => navigate("/admin/employees")}>View All</span>
          </div>
          {recentEmployees.map((emp, index) => (
            <div key={index} style={styles.empRow}>
              <div style={{ ...styles.empAvatar, background: emp.iBg, color: emp.iColor }}>
                {emp.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.empName}>{emp.name}</div>
                <div style={styles.empDept}>{emp.dept}</div>
              </div>
              <span style={{ ...styles.pill, ...pillStyle(emp.status) }}>
                {emp.status}
              </span>
            </div>
          ))}
          {recentEmployees.length === 0 && (
            <div style={{ color: C.muted, fontSize: "14px", padding: "20px 0" }}>No recent workforce adjustments registered.</div>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>Leave Management Quick Overview</span>
            <span style={styles.link} onClick={() => navigate("/admin/leaves")}>Manage</span>
          </div>
          {leaveStats.map((leave) => (
            <div key={leave.type} style={styles.leaveRow}>
              <div>
                <div style={styles.leaveType}>{leave.type}</div>
                <div style={styles.leaveNote}>{leave.note}</div>
              </div>
              <div style={styles.leaveCount}>{leave.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.bottomGrid}>
        <div style={styles.bigCard}>
          <div style={styles.bigTitle}>Department Distribution</div>
          <div style={styles.chartPlaceholder}>Analytics Engine Visualization Feed Active</div>
        </div>

        <div style={styles.bigCard}>
          <div style={styles.bigTitle}>Upcoming HR Directives</div>
          <div style={styles.activity}>Annual Performance Review Verifications</div>
          <div style={styles.activity}>Payroll Structuring & Ledger Auditing</div>
          <div style={styles.activity}>Dynamic Digital Profile Integration Routines</div>
          <div style={styles.activity}>Corporate Compliance Matrix Update Runs</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "32px", padding: "32px", fontFamily: "system-ui, -apple-system, sans-serif" },
  pageHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  welcome: { color: C.primary, fontWeight: "600", fontSize: "15px", marginBottom: "6px" },
  pageTitle: { fontSize: "32px", fontWeight: "700", margin: 0, color: C.text },
  pageSub: { color: C.muted, marginTop: "6px", fontSize: "15px" },
  addBtn: { padding: "10px 24px", background: C.primary, color: "#fff", border: "none", borderRadius: RADIUS.button, fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" },
  statCard: { background: "#fff", borderRadius: "24px", padding: "24px", boxShadow: "0 10px 35px rgba(15,23,42,.05)", border: "1px solid rgba(43,125,161,.08)" },
  statIcon: { width: "56px", height: "56px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "18px" },
  statValue: { fontSize: "36px", fontWeight: "700", color: C.text },
  statLabel: { color: C.muted, marginTop: "6px", fontSize: "14px" },
  statDelta: { marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "500" },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" },
  panel: { background: "#fff", borderRadius: "24px", padding: "24px", border: "1px solid rgba(43,125,161,.08)", boxShadow: "0 10px 35px rgba(15,23,42,.05)" },
  panelHead: { display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  panelTitle: { fontWeight: "700", fontSize: "18px", color: C.text },
  link: { color: C.primary, cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  empRow: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 0", borderBottom: "1px solid #eef2f6" },
  empAvatar: { width: "48px", height: "48px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" },
  empName: { fontWeight: "600", color: C.text, fontSize: "15px" },
  empDept: { fontSize: "13px", color: C.muted },
  pill: { padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" },
  leaveRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #eef2f6" },
  leaveType: { fontWeight: "600", color: C.text, fontSize: "15px" },
  leaveNote: { color: C.muted, fontSize: "13px", marginTop: "2px" },
  leaveCount: { fontSize: "24px", fontWeight: "700", color: C.primary },
  bottomGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" },
  bigCard: { background: "#fff", borderRadius: "24px", padding: "24px", border: "1px solid rgba(43,125,161,.08)", boxShadow: "0 10px 35px rgba(15,23,42,.05)" },
  bigTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "18px", color: C.text },
  chartPlaceholder: { height: "240px", borderRadius: "18px", background: "linear-gradient(135deg,#f5fbff,#eef8fd)", display: "flex", alignItems: "center", justifyContent: "center", color: C.primary, fontWeight: "600", fontSize: "14px" },
  activity: { padding: "14px", background: "#f8fafc", border: "1px solid #eef2f6", borderRadius: "14px", marginBottom: "12px", fontSize: "14px", color: C.text, fontWeight: "500" },
};