import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, RADIUS } from "../../theme";
import {
  FiUsers,
  FiClock,
  FiCheckSquare,
  FiTrendingUp,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";

const pillStyle = (status) => {
  const map = {
    Active: { background: "#e1f5ee", color: "#085041" },
    "On Leave": { background: "#fde8ef", color: "#993556" },
    Remote: { background: "#e8f4fa", color: "#0c447c" },
    Pending: { background: "#fffbeb", color: "#b45309" },
    Urgent: { background: "#fef2f2", color: "#b91c1c" },
  };
  return map[status] || { background: "#f1f5f9", color: "#475569" };
};

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Live dynamic synchronization states
  const [stats, setStats] = useState([
    { label: "My Team Size", value: "...", delta: "Active members", up: true, icon: <FiUsers />, bg: "#e8f4fa", color: C.primary },
    { label: "Pending Approvals", value: "...", delta: "Requires action", up: false, icon: <FiClock />, bg: "#fde8ef", color: C.accent },
    { label: "Team Attendance", value: "92%", delta: "+2% this week", up: true, icon: <FiCheckSquare />, bg: "#e1f5ee", color: "#0f6e56" },
    { label: "Avg Performance", value: "4.2/5", delta: "Consistent", up: null, icon: <FiTrendingUp />, bg: "#faeeda", color: "#854f0b" },
  ]);
  const [team, setTeam] = useState([]);
  const [approvals, setApprovals] = useState([]);

  // Spin utility loader block engine injection
  useEffect(() => {
    if (!document.getElementById("manager-loader-keyframes")) {
      const tag = document.createElement("style");
      tag.id = "manager-loader-keyframes";
      tag.innerHTML = `@keyframes managerSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(tag);
    }
  }, []);

  const fetchManagerData = async () => {
    try {
      setIsLoading(true);
      
      // Look up logged manager identifier reference code safely
      let storedManagerId = localStorage.getItem("employeeId");
      if (!storedManagerId && localStorage.getItem("user")) {
        try {
          const parsed = JSON.parse(localStorage.getItem("user"));
          storedManagerId = parsed.id || parsed.EmployeeID || parsed.employeeId;
        } catch (e) {
          console.error("Error parsing layout configuration mapping fallback:", e);
        }
      }

      if (!storedManagerId) {
        console.error("Manager ID parameter not found contextually in local device mapping.");
        setIsLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:5000/api/manager/dashboard-summary?managerId=${storedManagerId}`);
      
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          // Re-map structural array and icons cleanly
          const updatedStats = json.data.stats.map((backendItem, idx) => ({
            ...backendItem,
            icon: idx === 0 ? <FiUsers /> : idx === 1 ? <FiClock /> : idx === 2 ? <FiCheckSquare /> : <FiTrendingUp />
          }));
          
          setStats(updatedStats);
          setTeam(json.data.team || []);
          setApprovals(json.data.approvals || []);
        }
      }
    } catch (err) {
      console.error("Failed executing synchronization connection stream layout:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerData();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '88vh', color: C.text, fontSize: "15px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "20px", height: "20px", border: "2px solid #e2e8f0", borderTop: `2px solid ${C.primary}`, borderRadius: "50%", animation: "managerSpin 0.6s linear infinite" }}></div>
        <span style={{ marginLeft: "12px", fontWeight: "500" }}>Connecting Live Manager Metrics Matrix...</span>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHead}>
        <div>
          <div style={styles.welcome}>Welcome back, Manager</div>
          <h1 style={styles.pageTitle}>My Team Overview</h1>
          <p style={styles.pageSub}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        {/* <button style={styles.addBtn} onClick={() => navigate("/manager/tasks/new")}>
          + Assign New Task
        </button> */}
      </div>

      {/* Team Stats */}
      <div style={styles.statsGrid}>
        {stats.map((item) => (
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

      {/* Panels for Team and Approvals */}
      <div style={styles.twoCol}>
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>My Direct Reports</span>
            {/* <span style={styles.link} onClick={() => navigate("/manager/team")}>View All</span> */}
          </div>
          {team.map((emp, index) => (
            <div key={index} style={styles.empRow}>
              <div style={{ ...styles.empAvatar, background: emp.iBg, color: emp.iColor }}>
                {emp.initials}
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.empName}>{emp.name}</div>
                <div style={styles.empDept}>{emp.role}</div>
              </div>
              <span style={{ ...styles.pill, ...pillStyle(emp.status) }}>
                {emp.status}
              </span>
            </div>
          ))}
          {team.length === 0 && (
            <div style={{ color: C.muted, fontSize: "14px", padding: "15px 0" }}>No reporting staff found.</div>
          )}
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>Pending Approvals</span>
            <span style={styles.link} onClick={() => navigate("/manager/timesheet")}>Action Hub</span>
          </div>
          {approvals.map((req, idx) => (
            <div key={idx} style={styles.leaveRow}>
              <div>
                <div style={styles.leaveType}>{req.type}</div>
                <div style={styles.leaveNote}>{req.name} • {req.date}</div>
              </div>
              <span style={{ ...styles.pill, ...pillStyle(req.status) }}>
                {req.status}
              </span>
            </div>
          ))}
          {approvals.length === 0 && (
            <div style={{ color: C.muted, fontSize: "14px", padding: "15px 0" }}>You're all caught up!</div>
          )}
        </div>
      </div>

      {/* Bottom Activity Board */}
      <div style={styles.bottomGrid}>
        <div style={styles.bigCard}>
          <div style={styles.bigTitle}>Team Project Progress</div>
          <div style={styles.chartPlaceholder}>Team Analytics Chart Coming Soon</div>
        </div>

        <div style={styles.bigCard}>
          <div style={styles.bigTitle}>Action Items</div>
          <div style={styles.activity}>Conduct 1-on-1 with Sneha</div>
          <div style={styles.activity}>Review Frontend Architecture Docs</div>
          <div style={styles.activity}>Approve Monthly Timesheets</div>
          <div style={styles.activity}>Submit Quarterly Team Budget</div>
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
  bottomGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" },
  bigCard: { background: "#fff", borderRadius: "24px", padding: "24px", border: "1px solid rgba(43,125,161,.08)", boxShadow: "0 10px 35px rgba(15,23,42,.05)" },
  bigTitle: { fontSize: "18px", fontWeight: "700", marginBottom: "18px", color: C.text },
  chartPlaceholder: { height: "240px", borderRadius: "18px", background: "linear-gradient(135deg,#f5fbff,#eef8fd)", display: "flex", alignItems: "center", justifyContent: "center", color: C.primary, fontWeight: "600", fontSize: "14px" },
  activity: { padding: "14px", background: "#f8fafc", border: "1px solid #eef2f6", borderRadius: "14px", marginBottom: "12px", fontSize: "14px", color: C.text, fontWeight: "500" },
};