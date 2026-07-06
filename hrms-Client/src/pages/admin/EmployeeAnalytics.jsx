import React, { useState, useEffect } from "react";
import { 
  FiUsers, 
  FiUserPlus, 
  FiUserX, 
  FiTrendingUp, 
  FiPieChart, 
  FiActivity, 
  FiBarChart2,
  FiFilter
} from "react-icons/fi";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area
} from "recharts";

export default function EmployeeAnalytics() {
  // --- Dropdown/Filter States ---
  const [timeframe, setTimeframe] = useState("Last 6 Months");
  const [selectedDept, setSelectedDept] = useState("All Departments");
  const [empType, setEmpType] = useState("All Types");

  // --- Dynamic Dropdown Options State ---
  const [departmentsList, setDepartmentsList] = useState([]);

  // --- API Response Matrix State ---
  const [data, setData] = useState({
    metrics: { totalHeadcount: 0, newJoiners: 0, attritionRate: "0%" },
    departmentData: [],
    employeeTypeData: []
  });
  const [loading, setLoading] = useState(true);

  // =========================================================================
  // 1. LIFECYCLE HOOK: Fetch Departments for Filter Option Matching
  // =========================================================================
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const token = localStorage.getItem("token");
        // Update this URL if your base API route prefix differs
        const response = await fetch("http://localhost:5000/api/admin/departments", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        
        const deptData = await response.json();
        // Since your backend returns raw rows array: [ { id, Department, DepartmentCode, parent_id }, ... ]
        if (Array.isArray(deptData)) {
          setDepartmentsList(deptData);
        }
      } catch (err) {
        console.error("Failed gathering relational departments for filters:", err);
      }
    };

    fetchDepartments();
  }, []);

  // =========================================================================
  // 2. LIFECYCLE HOOK: Fetch Analytics Data Matrix
  // =========================================================================
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        
        const url = `http://localhost:5000/api/analytics/dashboard?timeframe=${encodeURIComponent(timeframe)}&department=${encodeURIComponent(selectedDept)}&type=${encodeURIComponent(empType)}`;
        
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        const resData = await response.json();
        if (resData.success) {
          setData({
            metrics: resData.metrics,
            departmentData: resData.departmentData,
            employeeTypeData: resData.employeeTypeData
          });
        }
      } catch (err) {
        console.error("Critical analytics streaming runtime failure:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeframe, selectedDept, empType]);

  // Metric block layout matrix
  const metricsConfig = [
    { title: "Total Headcount", value: data.metrics.totalHeadcount, change: "Active Profiles", icon: <FiUsers />, color: "#2b7da1" },
    { title: "New Joiners", value: data.metrics.newJoiners, change: "Past 30 Days", icon: <FiUserPlus />, color: "#139287" },
    { title: "Attrition Rate", value: data.metrics.attritionRate, change: "Inactive vs Active", icon: <FiUserX />, color: "#d63a6e" },
    { title: "Performance Score", value: "88%", change: "Platform Avg", icon: <FiTrendingUp />, color: "#f59e0b" },
  ];

  return (
    <div style={styles.container}>
      
      {/* Upper Content Header Row */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Employee Analytics Dashboard</h1>
          <p style={styles.subtitle}>Dynamic corporate breakdown reporting mapping Live SQL database structures.</p>
        </div>
      </div>

      {/* Filter Control Board Bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterTitle}>
          <FiFilter style={{ color: "#2b7da1" }} />
          <span>Analytics Filters:</span>
        </div>
        <div style={styles.filterGroup}>
          
          {/* Timeframe Filter Dropdown */}
          <select style={styles.select} value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
            <option>Last 30 Days</option>
            <option>Last 6 Months</option>
            <option>Year to Date</option>
          </select>

          {/* DYNAMIC: Department Filter Dropdown mapped from DB */}
          <select style={styles.select} value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
            <option value="All Departments">All Departments</option>
            {departmentsList.map((dept) => (
              <option key={dept.id} value={dept.Department}>
                {dept.Department}
              </option>
            ))}
          </select>

          {/* Employment Type Filter Dropdown */}
          {/* <select style={styles.select} value={empType} onChange={(e) => setEmpType(e.target.value)}>
            <option>All Types</option>
            <option>Full-Time</option>
            <option>Part-Time</option>
            <option>Contractor</option>
            <option>Intern</option>
          </select> */}
        </div>
      </div>

      {loading ? (
        /* UI Loading Stream State */
        <div style={styles.loaderArea}>
          <div style={styles.spinner}></div>
          <p style={styles.loaderText}>Fetching Live Metric Matrix...</p>
        </div>
      ) : (
        <>
          {/* Grid Matrix of Top Summary Cards */}
          <div style={styles.kpiGrid}>
            {metricsConfig.map((metric, idx) => (
              <div key={idx} style={styles.kpiCard}>
                <div style={styles.cardHeader}>
                  <span style={{ ...styles.iconWrapper, backgroundColor: `${metric.color}15`, color: metric.color }}>
                    {metric.icon}
                  </span>
                  <span style={{ ...styles.badge, color: metric.color, backgroundColor: `${metric.color}10` }}>
                    {metric.change}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <h3 style={styles.cardValue}>{metric.value}</h3>
                  <p style={styles.cardTitle}>{metric.title}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Core Graphic Rendering Engine Sections */}
          <div style={styles.chartGrid}>
            
            {/* Panel Left: Department-wise Bar Graph */}
            <div style={styles.chartCard}>
              <div style={styles.panelHeader}>
                <h3 style={styles.panelTitle}><FiBarChart2 style={styles.panelIcon} /> Headcount by Department</h3>
              </div>
              <div style={styles.chartContainerArea}>
                {data.departmentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                      <Bar dataKey="Headcount" radius={[6, 6, 0, 0]}>
                        {data.departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || "#2b7da1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={styles.noDataBox}>No department data available</div>
                )}
              </div>
            </div>

            {/* Panel Right: Employment Type Segmented Ring Pie */}
            <div style={styles.chartCard}>
              <div style={styles.panelHeader}>
                <h3 style={styles.panelTitle}><FiPieChart style={styles.panelIcon} /> Types of Employees</h3>
              </div>
              <div style={styles.chartContainerArea}>
                {data.employeeTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.employeeTypeData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {data.employeeTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || "#139287"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={styles.noDataBox}>No employment type data available</div>
                )}
              </div>
            </div>

          </div>

          {/* Bottom Area Dashboard Layer Matrix: Growth Trends */}
          <div style={styles.fullWidthPanel}>
            <div style={styles.panelHeader}>
              <h3 style={styles.panelTitle}><FiActivity style={styles.panelIcon} /> Historical Retention Stream Velocity</h3>
            </div>
            <div style={{ ...styles.chartContainerArea, height: "180px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.departmentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#139287" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#139287" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Headcount" stroke="#139287" strokeWidth={2} fillOpacity={1} fill="url(#growthGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Layout Stylesheets Node Config Matrix ---
const styles = {
  container: {
    padding: "30px",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: "6px 0 0 0",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "16px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px 20px",
    marginBottom: "32px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  filterTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: "600",
    color: "#334155",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  select: {
    padding: "8px 14px",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    color: "#475569",
    fontSize: "13px",
    fontWeight: "500",
    outline: "none",
    cursor: "pointer",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "24px",
    marginBottom: "32px",
  },
  kpiCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #f1f5f9",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.01)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconWrapper: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "999px",
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  cardValue: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#0f172a",
    margin: 0,
  },
  cardTitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0,
    fontWeight: "500",
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr",
    gap: "24px",
    marginBottom: "24px",
  },
  chartCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #f1f5f9",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.01)",
  },
  fullWidthPanel: {
    backgroundColor: "#ffffff",
    border: "1px solid #f1f5f9",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 20px rgba(15, 23, 42, 0.01)",
  },
  panelHeader: {
    marginBottom: "20px",
  },
  panelTitle: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#1e293b",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  panelIcon: {
    color: "#2b7da1",
    fontSize: "18px",
  },
  chartContainerArea: {
    height: "260px",
    width: "100%",
    position: "relative",
  },
  loaderArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 0",
    gap: "16px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #2b7da1",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loaderText: {
    fontSize: "14px",
    color: "#64748b",
    fontWeight: "500",
  },
  noDataBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#94a3b8",
    fontSize: "14px",
    border: "1px dashed #e2e8f0",
    borderRadius: "12px",
  }
};