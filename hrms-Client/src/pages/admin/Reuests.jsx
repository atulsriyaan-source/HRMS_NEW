import React, { useState, useEffect } from "react";

const C = {
  secondary: '#334155',
  muted: '#64748b',
  accent: '#2b7da1',
  text: '#0f172a',
  success: '#16a34a',
  danger: '#ef4444',
  borderLight: '#e2e8f0'
};

export default function HRRequestApprovalDashboard() {
  const [allRequests, setAllRequests] = useState([]);
  const [commentText, setCommentText] = useState({});
  const [loading, setLoading] = useState(true);
  
  // FIXED: Dynamic state layer added to capture the current active session role
  const [userRole, setUserRole] = useState("");

  const fetchHRMasterPool = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/hr/requests", {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAllRequests(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { 
    fetchHRMasterPool(); 
    // FIXED: Catch current normalized operational role parameter on initialization
    const savedRole = localStorage.getItem("role") || "";
    setUserRole(savedRole.toLowerCase());
  }, []);

  const handleAction = async (id, targetStatus) => {
    // Safety check block to completely restrict execution attempts from Admin
    if (userRole === "admin") return;

    const feedback = commentText[id] || "";
    if (targetStatus === 2 && !feedback) {
      alert("Please provide audit notes justification for rejection processing.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/hr/requests/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus, hrComments: feedback })
      });
      if (res.ok) {
        alert("System parameter state modified clean.");
        fetchHRMasterPool();
      }
    } catch (err) { console.error(err); }
  };

  const handleTextChange = (id, text) => {
    setCommentText(prev => ({ ...prev, [id]: text }));
  };

  return (
    <div style={styles.container}>
      {/* FIXED: Dynamic Header context title display depending on permissions state */}
      <h2 style={{ color: C.secondary, margin: "0 0 4px 0" }}>
        {userRole === "admin" ? "Service Requests (View-Only Mode)" : "All Requests"}
      </h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>
        {userRole === "admin" 
          ? "System audit view tracking logs history dashboard." 
          : "Manage universal request tickets, lifecycle approvals and database configuration override tokens."
        }
      </p>

      <div style={styles.card}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderLight}`, color: C.muted, fontSize: "12.5px", fontWeight: "700" }}>
              <th style={{ padding: "14px" }}>EMPLOYEE</th>
              <th style={{ padding: "14px" }}>CATEGORY TYPE</th>
              <th style={{ padding: "14px" }}>SUBJECT TITLE</th>
              <th style={{ padding: "14px" }}>DETAILED JUSTIFICATION</th>
              <th style={{ padding: "14px" }}>AUDIT STATUS</th>
              <th style={{ padding: "14px", textAlign: "center" }}>ACTION CONTROLS</th>
            </tr>
          </thead>
          <tbody>
            {allRequests.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderLight}`, fontSize: "13.5px" }}>
                <td style={{ padding: "14px" }}>
                  <strong>{r.employee_name || `Employee #${r.employee_id}`}</strong>
                </td>
                <td style={{ padding: "14px" }}>
                  <span style={styles.typeTag}>{r.request_type}</span>
                </td>
                <td style={{ padding: "14px" }}>
                  <span style={{ fontWeight: '600', color: C.text }}>{r.title}</span>
                </td>
                
                <td style={{ padding: "14px", maxWidth: "300px", lineHeight: '1.4' }}>
                  <div style={{ wordBreak: 'break-word', marginBottom: r.Attachment ? '8px' : '0' }}>
                    {r.description}
                  </div>
                  {r.Attachment && (
                    <div style={{ marginTop: '6px' }}>
                      <a 
                        href={`http://localhost:5000/uploads/requests/${r.Attachment}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={styles.attachmentLink}
                      >
                        📎 View Attachment
                      </a>
                    </div>
                  )}
                </td>

                <td style={{ padding: "14px" }}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: r.status === 1 ? "#ecfdf5" : r.status === 2 ? "#fef2f2" : "#fffbeb",
                    color: r.status === 1 ? C.success : r.status === 2 ? C.danger : "#b45309"
                  }}>
                    {r.status === 1 ? "Approved" : r.status === 2 ? "Rejected" : "Pending Internal Review"}
                  </span>
                </td>
                
                {/* FIXED: Applied role-based authorization branching strategy directly within UI rendering */}
                <td style={{ padding: "14px", textAlign: "center" }}>
                  {r.status === 0 ? (
                    userRole === "admin" ? (
                      <span style={{ color: C.muted, fontStyle: "italic", fontSize: '13px' }}>Awaiting HR Action</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "200px", margin: "0 auto" }}>
                        <input 
                          type="text" 
                          placeholder="Add dynamic feedback..." 
                          value={commentText[r.id] || ""} 
                          onChange={(e) => handleTextChange(r.id, e.target.value)} 
                          style={styles.smallInput} 
                        />
                        <div style={{ display: "flex", gap: "6px", justifyContent: 'center' }}>
                          <button onClick={() => handleAction(r.id, 1)} style={styles.actionBtn.approve}>Approve</button>
                          <button onClick={() => handleAction(r.id, 2)} style={styles.actionBtn.reject}>Reject</button>
                        </div>
                      </div>
                    )
                  ) : (
                    <span style={{ color: C.muted, fontStyle: "italic", fontSize: '13px' }}>
                      {r.status === 1 ? "✅ Granted" : "❌ Denied"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {allRequests.length === 0 && !loading && (
          <div style={{ padding: "40px", textAlign: "center", color: C.muted, fontSize: '14px' }}>
            🎉 No service request tickets are pending execution audits.
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { fontFamily: "'Inter', system-ui, sans-serif", padding: "24px" },
  card: { background: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", overflowX: 'auto', boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)" },
  typeTag: { background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" },
  statusBadge: { padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" },
  smallInput: { padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none", width: '100%', boxSizing: 'border-box' },
  attachmentLink: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    fontSize: '12px', 
    color: '#2b7da1', 
    fontWeight: '600', 
    textDecoration: 'none', 
    border: '1px solid #cbd5e1', 
    padding: '4px 8px', 
    borderRadius: '6px', 
    backgroundColor: '#f8fafc',
    transition: 'all 0.2s ease'
  },
  actionBtn: {
    approve: { background: "#16a34a", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", flex: 1 },
    reject: { background: "#ef4444", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", flex: 1 }
  }
};