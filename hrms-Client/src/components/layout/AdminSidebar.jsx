import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { C, RADIUS, SHADOW } from "../../theme";
import logo from "/src/assets/WhiteLogo.png";
import {
  FiGrid,
  FiUsers,
  FiBriefcase,
  FiCalendar,
  FiLogOut,
  FiLayers,
  FiChevronDown,
  FiChevronRight,
  FiStar,
  FiClipboard,
  FiPieChart // New icon imported for the graphical data view
} from "react-icons/fi";

const navItems = [
  { label: "Dashboard", path: "/admin/dashboard", icon: <FiGrid /> },
  {
    label: "Master List",
    icon: <FiLayers />,
    hideForRoles: ["HR"], 
    children: [
      { label: "Departments", path: "/admin/departments", icon: <FiBriefcase /> },
      { label: "Leaves", path: "/admin/adminleaves", icon: <FiCalendar /> },
      { label: "Employee Status", path: "/admin/employeestatus", icon: <FiCalendar /> },
      { label: "Notice", path: "/admin/announcements", icon: <FiCalendar /> },
      { label: "Clients", path: "/admin/clients", icon: <FiCalendar /> },
      { label: "Projects", path: "/admin/projects", icon: <FiCalendar /> },
    ],
  },
  // =========================================================================
  // UPDATED: Employees Parent converted to Dropdown with List & Graph Views
  // =========================================================================
  { 
    label: "Employees", 
    icon: <FiUsers />, 
    children: [
      { label: "All Employees", path: "/admin/employees", icon: <FiUsers /> },
      { label: "Employee Analytics", path: "/admin/employees/analytics", icon: <FiPieChart /> }
    ]
  },
  { label: "Resignations", path: "/admin/resignations", icon: <FiUsers /> },
  {
    label: "Recruitment",
    icon: <FiUsers />,
    children: [
      { label: "Candidates", path: "/admin/Recruitment/candidates" },
      { label: "Interview Pipeline", path: "/admin/Recruitment/interviews" },
      { label: "Selected", path: "/admin/Recruitment/selected" },
    ],
  },
  { label: "TimeSheet", path: "/admin/timesheet", icon: <FiCalendar /> },
  {
    label: "Announcements",
    path: "/admin/announcements-view",
    icon: <FiStar />,
  },
  {
    label: "Leave Management",
    path: "/admin/leaves",
    icon: <FiCalendar />,
  },
  {
    label: "Service Requests",
    path: "/admin/requests",
    icon: <FiClipboard />,
  }
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [userRole, setUserRole] = useState("");
  const [openMenus, setOpenMenus] = useState({});

  useEffect(() => {
    const savedRole = localStorage.getItem("role") || sessionStorage.getItem("role") || "";
    setUserRole(savedRole.toUpperCase()); 
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  useEffect(() => {
    const newOpenMenus = { ...openMenus };
    navItems.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((child) => child.path === location.pathname);
        if (isChildActive) {
          newOpenMenus[item.label] = true;
        }
      }
    });
    setOpenMenus(newOpenMenus);
  }, [location.pathname]);

  const toggleMenu = (label) => {
    setOpenMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <div style={styles.logoWrapper}>
          <img src={logo} alt="Clinnex HRMS" style={styles.logo} />
        </div>
      </div>

      <div style={styles.sectionTitle}>MAIN MENU</div>

      <nav style={styles.nav}>
        {navItems.map((item) => {
          if (item.hideForRoles && item.hideForRoles.includes(userRole)) {
            return null;
          }

          if (item.children) {
            const isOpen = openMenus[item.label];
            const isChildActive = item.children.some((child) => child.path === location.pathname);

            return (
              <div key={item.label} style={styles.dropdownContainer}>
                <div
                  style={{
                    ...styles.navItem,
                    ...(isOpen ? styles.navItemExpanded : {}),
                    cursor: "pointer",
                  }}
                  onClick={() => toggleMenu(item.label)}
                  onMouseEnter={(e) => {
                    if (!isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isChildActive && !isOpen && <span style={styles.activeBar} />}
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={styles.chevron}>
                    {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                  </span>
                </div>

                {isOpen && (
                  <div style={styles.dropdownList}>
                    {item.children.map((child) => {
                      const active = location.pathname === child.path;
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          style={{
                            ...styles.dropdownItem,
                            ...(active ? styles.dropdownItemActive : {}),
                          }}
                        >
                          {active && <span style={styles.activeBarChild} />}
                          <span style={styles.dropdownIcon}>{child.icon}</span>
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = location.pathname === item.path;
          return (
            <Link
              key={item.label}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(active ? styles.navItemActive : {}),
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {active && <span style={styles.activeBar} />}
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <button onClick={handleLogout} style={styles.logout}>
          <FiLogOut />
          Logout
        </button>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: "250px",
    background: `linear-gradient(180deg, #0d2d3d 0%, #0a2532 45%, #071a24 100%)`,
    boxShadow: `4px 0 24px rgba(0,0,0,0.18), inset -1px 0 rgba(255,255,255,0.04)`,
    borderRight: "1px solid rgba(43,125,161,.15)",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,
  },
  header: {
    height: "90px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(43,125,161,0.12) 0%, rgba(255,255,255,0.02) 100%)",
  },
  logoWrapper: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "220px",
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))",
  },
  sectionTitle: {
    color: "rgba(255,255,255,.35)",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "2px",
    padding: "18px 24px 6px",
  },
  nav: {
    flex: 1,
    padding: "18px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    overflowY: "auto",
  },
  navItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "14px",
    color: "rgba(255,255,255,0.72)",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all .25s ease",
  },
  navItemActive: {
    background: "#2b7da1",
    color: "#fff",
    boxShadow: "0 4px 16px rgba(43,125,161,.25)",
  },
  navItemExpanded: {
    background: "rgba(255,255,255,0.02)",
    color: "#fff",
  },
  navIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.05)",
    fontSize: "18px",
    flexShrink: 0,
  },
  chevron: {
    display: "flex",
    alignItems: "center",
    fontSize: "16px",
    color: "rgba(255,255,255,0.4)",
  },
  activeBar: {
    position: "absolute",
    left: "-12px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "4px",
    height: "26px",
    background: "#d63a6e",
    borderRadius: "999px",
  },
  dropdownContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  dropdownList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingLeft: "36px",
    marginTop: "4px",
  },
  dropdownItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.5)",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: "500",
    transition: "all .2s ease",
  },
  dropdownItemActive: {
    color: "#fff",
    background: "rgba(43,125,161,0.2)",
  },
  dropdownIcon: {
    fontSize: "14px",
    opacity: 0.8,
  },
  activeBarChild: {
    position: "absolute",
    left: "-28px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "4px",
    height: "18px",
    background: "#d63a6e",
    borderRadius: "999px",
  },
  footer: {
    padding: "12px 10px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  logout: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    color: "#ff8aa7",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "14px",
  },
};