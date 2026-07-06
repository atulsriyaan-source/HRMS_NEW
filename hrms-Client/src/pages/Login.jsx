import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "/src/assets/full.png";
import BackgroundImage from "../assets/login.png"; 

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.identifier || !form.password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.identifier,
          password: form.password,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Invalid credentials");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      const normalizedRole = data.user.role ? data.user.role.toLowerCase() : "";

      if (normalizedRole === "admin" || normalizedRole === "hr") {
        navigate("/admin/dashboard");
      } else if (normalizedRole === "manager") {
        navigate("/manager/timesheet");
      } else if (normalizedRole === "leader") {
        navigate("/leader/timesheet");
      } else {
        navigate("/employee/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      
      {/* RIGHT SIDE AREA: Card completely snapped to the right */}
      <div style={styles.rightFormPane}>
        <div style={styles.loginCard}>
          
          {/* Main Logo & HRMS Label Grouping */}
          <div style={styles.cardHeaderArea}>
            <img src={logo} alt="Clinnex Logo" style={styles.integratedCardLogo} />
            <div style={styles.hrmsBadge}>HRMS PORTAL ACCESS</div>
          </div>

          <form onSubmit={handleSubmit} style={styles.formLayout}>
            
            {/* User Name Input Unit */}
            <div style={styles.inputContainer}>
              <span style={styles.fieldIcon}>👤</span>
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                onFocus={() => setFocusedField("identifier")}
                onBlur={() => setFocusedField(null)}
                placeholder="User Name"
                style={{
                  ...styles.inputField,
                  boxShadow: focusedField === "identifier" ? "0 0 0 2px rgba(19, 146, 135, 0.2)" : "none"
                }}
                required
              />
            </div>

            {/* Password Input Unit */}
            <div style={styles.inputContainer}>
              <span style={styles.fieldIcon}>🔒</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                placeholder="Password"
                style={{
                  ...styles.inputField,
                  boxShadow: focusedField === "password" ? "0 0 0 2px rgba(19, 146, 135, 0.2)" : "none"
                }}
                required
              />
            </div>

            {error && <div style={styles.errorText}>⚠️ {error}</div>}

            {/* Core Theme Teal Action Button */}
            <button
              type="submit"
              style={styles.actionButton}
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Recovery Inline Hyperlink */}
          <div style={styles.footerRow}>
            <span
              style={styles.forgotText}
              onClick={() => alert("Password reset instructions requested.")}
            >
              ❓ Forgot Password?
            </span>
          </div>

        </div>
      </div>

    </div>
  );
}

// --- Layout Aesthetic Stylesheets Node Config Matrix ---
const styles = {
  container: { 
    position: "fixed", 
    inset: 0, 
    width: "100vw", 
    height: "100vh", 
    display: "flex", 
    justifyContent: "flex-end", 
    alignItems: "center",
    overflow: "hidden", 
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundImage: "url(" + BackgroundImage + ")",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  },

  rightFormPane: {
    width: "100%",
    maxWidth: "500px", 
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingRight: "8%", 
    boxSizing: "border-box"
  },

  loginCard: {
    width: "100%",
    maxWidth: "360px",
    backgroundColor: "rgba(223, 241, 237, 0.85)", 
    backdropFilter: "blur(12px)",
    borderRadius: "20px",
    padding: "40px 28px 24px 28px",
    boxShadow: "0 20px 45px rgba(11, 63, 58, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    boxSizing: "border-box"
  },

  cardHeaderArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "28px",
    gap: "8px"
  },
  integratedCardLogo: {
    width: "100%",
    maxWidth: "180px",
    height: "auto",
    objectFit: "contain",
    filter: "drop-shadow(0px 2px 4px rgba(19, 146, 135, 0.08))"
  },
  hrmsBadge: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#139287",
    letterSpacing: "1.5px",
    opacity: 0.9,
    textTransform: "uppercase"
  },

  formLayout: {
    display: "flex",
    flexDirection: "column",
    gap: "18px"
  },

  inputContainer: {
    position: "relative",
    display: "flex",
    alignItems: "center"
  },
  fieldIcon: {
    position: "absolute",
    left: "16px",
    fontSize: "14px",
    color: "#64748b",
    userSelect: "none"
  },
  inputField: {
    width: "100%",
    padding: "14px 16px 14px 44px",
    border: "none",
    borderRadius: "24px", 
    fontSize: "14px",
    color: "#334155",
    backgroundColor: "#ffffff",
    outline: "none",
    transition: "box-shadow 0.2s ease-in-out",
    boxSizing: "border-box"
  },

  actionButton: {
    marginTop: "6px",
    padding: "13px",
    backgroundColor: "#139287",
    color: "#ffffff",
    border: "none",
    borderRadius: "24px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    boxShadow: "0 4px 12px rgba(19, 146, 135, 0.15)"
  },

  errorText: {
    color: "#dc2626",
    fontSize: "13px",
    textAlign: "center"
  },

  footerRow: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "flex-end"
  },
  forgotText: {
    fontSize: "12px",
    color: "#475569",
    cursor: "pointer",
    fontWeight: "500",
    opacity: 0.8,
    userSelect: "none"
  }
};