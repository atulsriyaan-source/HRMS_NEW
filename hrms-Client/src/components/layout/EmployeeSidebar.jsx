import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiGrid, FiUser, FiCalendar, FiLogOut, FiClipboard, FiStar } from "react-icons/fi";

import logo from "/src/assets/WhiteLogo.png";
import { SHADOW } from "../../theme";

const navItems = [
  {
    label: "Dashboard",
    path: "/employee/dashboard",
    icon: <FiGrid />,
  },
  {
    label: "My Details",
    path: "/employee/details",
    icon: <FiUser />,
  },
  {
    label: "Manage Leaves",
    path: "/employee/leaves",
    icon: <FiCalendar />,
  },
  {
    label: "Resignation",
    path: "/employee/resignation",
    icon: <FiLogOut />,
  },
  {
    label: "TimeSheet",
    path: "/employee/timesheet",
    icon: <FiClipboard />,
  },
  {
    label: "Announcements",
    path: "/employee/announcements",
    icon: <FiStar />,
  },
   {
    label: "Requests",
    path: "/employee/requests",
    icon: <FiStar />,
  },
];

export default function EmployeeSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.header}>
        <img src={logo} alt="Clinnex HRMS" style={styles.logo} />
      </div>

      {/* Menu Title */}
      <div style={styles.sectionTitle}>EMPLOYEE PORTAL</div>

      {/* Navigation */}
      <nav style={styles.nav}>
        {navItems.map((item) => {
          const active = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(active ? styles.navItemActive : {}),
              }}
            >
              {active && <span style={styles.activeBar} />}

              <span style={styles.navIcon}>{item.icon}</span>

              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
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
    width: "260px",
    height: "100vh",
    position: "fixed",
    left: 0,
    top: 0,
    zIndex: 100,

    display: "flex",
    flexDirection: "column",

    background: `
      linear-gradient(
        180deg,
        #0d2d3d 0%,
        #0a2532 45%,
        #071a24 100%
      )
    `,

    borderRight: "1px solid rgba(43,125,161,.15)",

    boxShadow: SHADOW.sidebar,
  },

  header: {
    height: "90px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    borderBottom: "1px solid rgba(255,255,255,.06)",

    background:
      "linear-gradient(180deg, rgba(43,125,161,.12) 0%, rgba(255,255,255,.02) 100%)",
  },

  logo: {
    width: "220px",
    objectFit: "contain",
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
  },

  navItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",

    padding: "12px 14px",

    borderRadius: "14px",

    color: "rgba(255,255,255,.75)",
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

  navIcon: {
    width: "32px",
    height: "32px",

    borderRadius: "10px",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    background: "rgba(255,255,255,.05)",

    fontSize: "18px",

    flexShrink: 0,
  },

  activeBar: {
    position: "absolute",
    left: "-12px",
    top: "50%",

    transform: "translateY(-50%)",

    width: "4px",
    height: "28px",

    background: "#d63a6e",
    borderRadius: "999px",
  },

  footer: {
    padding: "12px 10px",

    borderTop: "1px solid rgba(255,255,255,.07)",
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