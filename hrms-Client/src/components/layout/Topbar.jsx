import React, { useState, useEffect } from "react";
import { FiSearch, FiBell, FiSettings } from "react-icons/fi";
// import { C } from "../../theme"; // Uncomment if you are using your theme colors here

export default function Topbar() {
  const [userData, setUserData] = useState({
    name: "Loading...",
    role: "User",
    initial: "U",
    photo: null, // Holds the profile photo filename
  });

  // Reusable fallback profile placeholder image asset url
  const defaultProfileUrl = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  useEffect(() => {
    // 1. Grab the user data we saved in localStorage during login
    const storedUser = localStorage.getItem("user");
    
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      // 2. Set basic text info immediately so the UI doesn't lag
      setUserData(prev => ({
        ...prev,
        name: parsedUser.name,
        role: parsedUser.role,
        initial: parsedUser.name ? parsedUser.name.charAt(0).toUpperCase() : "U",
      }));

      // 3. Fetch their latest profile photo from the backend using their ID
      if (parsedUser.id) {
        fetch(`http://localhost:5000/api/admin/employees/${parsedUser.id}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.Photo) {
              setUserData(prev => ({ ...prev, photo: data.Photo }));
            }
          })
          .catch(err => console.error("Failed to fetch user photo for Topbar", err));
      }
    }
  }, []);

  return (
    <header style={styles.topbar}>
      <div style={styles.left}>
        {/* <div style={styles.searchBox}>
          <FiSearch size={18} />
          <input
            placeholder="Search employees, departments, payroll..."
            style={styles.input}
          />
        </div> */}
      </div>

      <div style={styles.right}>
        <button style={styles.iconBtn}>
          <FiBell size={18} />
          <span style={styles.notificationDot}></span>
        </button>

        <button style={styles.iconBtn}>
          <FiSettings size={18} />
        </button>

        <div style={styles.profile}>
          
          {/* UPDATED: Displays backend image if present, else seamlessly uses default silhouette fallback */}
          <img 
            src={userData.photo ? `http://localhost:5000/uploads/${userData.photo}` : defaultProfileUrl} 
            alt="Profile" 
            style={{ ...styles.avatar, objectFit: "cover" }} 
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = defaultProfileUrl;
            }}
          />

          <div>
            {/* Dynamic Name and Role */}
            <div style={styles.name}>{userData.name}</div>
            <div style={styles.role}>{userData.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    height: "90px",
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 32px",
    borderBottom: "1px solid #e8eef3",
    position: "sticky",
    top: 0,
    zIndex: 50,
  },

  left: {
    display: "flex",
    alignItems: "center",
  },

  searchBox: {
    width: "380px",
    height: "46px",
    background: "#f6f9fc",
    border: "1px solid #e5edf4",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 16px",
    color: "#64748b",
  },

  input: {
    flex: 1,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "14px",
  },

  right: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  iconBtn: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    border: "1px solid #e5edf4",
    background: "#fff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
  },

  notificationDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#d63a6e",
    position: "absolute",
    top: "11px",
    right: "11px",
  },

  profile: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    paddingLeft: "10px",
  },

  avatar: {
    width: "46px",
    height: "46px",
    borderRadius: "14px",
    background: "linear-gradient(135deg,#2b7da1,#3ea0cf)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "16px",
  },

  name: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
  },

  role: {
    fontSize: "12px",
    color: "#64748b",
    textTransform: "capitalize", 
  },
};