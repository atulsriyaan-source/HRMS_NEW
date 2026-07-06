import React, { useState, useEffect } from "react";
import { C, SHADOW, RADIUS } from "../../theme";
import { apiUrl } from "../../URL";

export default function ExitManagementDashboard() {
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [userContext, setUserContext] = useState(null);

  // Modal State for Action Controls
  const [activeRequest, setActiveRequest] = useState(null);
  const [actionForm, setActionForm] = useState({ proposedLWD: "", comments: "", status: "" });

  const fetchExitPool = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user"));
      // Backend lowercase check kar raha hai ('hr', 'admin'), isliye toLowerCase() lagaya
      const role = localStorage.getItem("role")?.toLowerCase() || "";
      
      // FIXED: Sending the required query parameters so backend can execute the correct SQL
      const fetchUrl = `${apiUrl}/api/employee/all-resignations?role=${role}&supervisorId=${currentUser.id}`;

      const res = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      
      const resData = await res.json();
      
      if (resData.success) {
        // Backend ne pehle se hi SQL me filter laga diya hai, sidha state me set karo
        setResignations(resData.data);
      }
    } catch (err) { 
      console.error("Failed to load exit tracks pool:", err); 
    } finally { 
      setLoading(false); 
    }
  };
  useEffect(() => {
    const role = localStorage.getItem("role")?.toUpperCase() || "";
    setUserRole(role);
    setUserContext(JSON.parse(localStorage.getItem("user")));
    fetchExitPool();
  }, []);

  const handleOpenActionModal = (record) => {
    setActiveRequest(record);
    // CRITICAL FIX: Mapping the correct conditional date properties for the form date picker
    const currentLWD = record.SystemLastWorkingDate || record.hr_confirmed_lwd || record.manager_proposed_lwd || "";
    
    setActionForm({
      proposedLWD: currentLWD ? currentLWD.split('T')[0] : "",
      comments: "",
      status: record.Status || record.status || "Manager Review"
    });
  };

  const handleProcessTransition = async (e) => {
    e.preventDefault();
    try {
      // 💡 DEBUG: Ek baar console me dekho ki backend se aane wale data me ID ka actual naam kya hai
      console.log("Active Request Row Data:", activeRequest);

      // FIXED: Safely extracting the ID by checking all common database column names
      const targetResignationId = 
        activeRequest.id || 
        activeRequest.ResignationID || 
        activeRequest.resignation_id || 
        activeRequest.resignationId;

        console.log(targetResignationId, "Resolved Resignation ID for Backend Payload");
      if (!targetResignationId) {
        alert("Execution Error: Resignation ID nahi mil rahi. Console check karo ki database column ka naam kya hai.");
        return;
      }

      // Syncing payload variables exactly to match the backend expectation
      const payload = {
        resignationId: targetResignationId, // ⚠️ YE LINE AB SURELY JAYEGI
        nextStatus: actionForm.status,
        managerComments: actionForm.comments,
        confirmedLWD: actionForm.proposedLWD
      };

      console.log("Sending Payload to Backend:", payload);

      const res = await fetch(`${apiUrl}/api/employee/update-resignation-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Separation milestone state transitioned successfully!");
        setActiveRequest(null);
        fetchExitPool(); // Re-hydrate logs grid view context
      } else {
        alert(`Server Notice: ${data.message}`);
      }
    } catch (err) { 
      console.error("Fetch pipeline connection failure:", err); 
      alert("Network crash processing transaction state.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "100px 40px", color: C.muted, textAlign: 'center' }}>
        <strong>Synchronizing organizational exit logs matrix data streams...</strong>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ color: C.secondary, margin: "0 0 4px 0" }}> Offboarding & Separation Command Desk</h2>
      <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>Audit workforce retention trends, adjust mandatory notice periods, and confirm final system-wide deactivations.</p>

      <div style={st.card}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderLight}`, color: C.muted, fontSize: "12.5px", fontWeight: "700" }}>
              <th style={{ padding: "14px" }}>EMPLOYEE CORE METADATA</th>
              <th style={{ padding: "14px" }}>SUBMITTED ON</th>
              <th style={{ padding: "14px" }}>REASON CATEGORY</th>
              <th style={{ padding: "14px" }}>PROPOSED LWD</th>
              <th style={{ padding: "14px" }}>LIFECYCLE STATUS</th>
              <th style={{ padding: "14px", textAlign: "center" }}>ACTION CONTROLS</th>
            </tr>
          </thead>
          <tbody>
            {resignations.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderLight}`, fontSize: "13.5px" }}>
                <td style={{ padding: "14px" }}>
                  <strong>{r.FirstName} {r.LastName}</strong>
                  <div style={{ fontSize: "11px", color: C.muted, marginTop: "2px" }}>Designation Scope: {r.role || "Standard Profile"}</div>
                </td>
                <td style={{ padding: "14px" }}>
                  {r.resignationDate ? new Date(r.resignationDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                </td>
                <td style={{ padding: "14px" }}><span style={st.typeTag}>{r.primaryReason || "Unspecified"}</span></td>
                <td style={{ padding: "14px", fontWeight: "700", color: C.primary }}>
                  {r.SystemLastWorkingDate ? new Date(r.SystemLastWorkingDate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : "Under Audit Setup"}
                </td>
                <td style={{ padding: "14px" }}>
                  <span style={{ 
                    ...st.statusBadge, 
                    backgroundColor: r.Status === "Closed" ? "#ecfdf5" : r.Status === "Withdrawal Requested" ? "#fff7ed" : "#fffbeb", 
                    color: r.Status === "Closed" ? C.success : r.Status === "Withdrawal Requested" ? "#c2410c" : "#b45309" 
                  }}>
                    {r.Status || "Awaiting Review"}
                  </span>
                </td>
                <td style={{ padding: "14px", textAlign: "center" }}>
                  <button onClick={() => handleOpenActionModal(r)} style={st.actionBtn}>
                    ⚙️ Process Request
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {resignations.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: "14px" }}>
            🎉 No separation tracking requests require your role's clearance attention.
          </div>
        )}
      </div>

      {/* ================= STICKY DYNAMIC WORKFLOW ALTERATION OVERLAY MODAL ================= */}
      {activeRequest && (
        <div style={st.modalOverlay}>
          <form onSubmit={handleProcessTransition} style={st.modalContainer}>
            <div style={st.modalHeader}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>Update Exit Track Milestone</h3>
              <button type="button" onClick={() => setActiveRequest(null)} style={st.modalCloseX}>✕</button>
            </div>
            
            <div style={{ padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={st.label}>Adjust / Propose Last Working Date (LWD)</label>
                <input 
                  type="date" 
                  value={actionForm.proposedLWD} 
                  onChange={(e) => setActionForm({ ...actionForm, proposedLWD: e.target.value })} 
                  style={st.input} 
                  required 
                />
              </div>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={st.label}>Advance Separation Pipeline Milestone State</label>
                <select 
                  value={actionForm.status} 
                  onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })} 
                  style={st.input} 
                  required
                >
                  <option value="Submitted">Resignation Submitted</option>
                  <option value="Manager Review">Manager Reviewing</option>
                  <option value="Manager LWD Propose">Manager LWD Recommendation Published</option>
                  <option value="HR Review">HR Review & Compliance Checks</option>
                  <option value="Negotiation">Retention & Negotiation Window Open</option>
                  <option value="HR LWD Confirmed">HR Final LWD Locked & Confirmed</option>
                  <option value="Exit Interview">Conduct Formal Exit Interview</option>
                  <option value="Asset Clearance">Asset Clearance & NOC Tracking</option>
                  <option value="Settlement">Full & Final Settlement (F&F)</option>
                  <option value="Closed">Approve Final Separation & Archive Employee Profile</option>
                </select>
              </div>
              
              <div style={{ marginBottom: "6px" }}>
                <label style={st.label}>Audit Evaluation Notes / Action Feedback Comments</label>
                <textarea 
                  rows={4} 
                  value={actionForm.comments} 
                  onChange={(e) => setActionForm({ ...actionForm, comments: e.target.value })} 
                  style={{ ...st.input, resize: "none", fontFamily: "inherit" }} 
                  placeholder="Provide executive clearance metrics, notice adjustment justification arguments, or clearance audit trails context data parameters..." 
                  required
                />
              </div>
            </div>

            <div style={st.modalFooter}>
              <button type="button" onClick={() => setActiveRequest(null)} style={st.cancelBtn}>Cancel</button>
              <button type="submit" style={st.submitBtn}>Save Configuration State</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Fixed Stylesheets Structure Node Configs Maps
const st = {
  card: { background: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", overflowX: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" },
  typeTag: { background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" },
  statusBadge: { padding: "4px 10px", borderRadius: "6px", fontSize: "11.5px", fontWeight: "700", whiteSpace: "nowrap" },
  actionBtn: { background: "transparent", border: "1px solid #cbd5e1", padding: "6px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "12.5px", fontWeight: "600", color: "#334155", transition: "all 0.2s" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" },
  modalContainer: { backgroundColor: "#ffffff", width: "100%", maxWidth: "500px", borderRadius: "16px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" },
  modalCloseX: { background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#64748b", padding: "4px" },
  modalFooter: { padding: "14px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px" },
  input: { width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", boxSizing: "border-box", outline: "none", backgroundColor: "#fdfefe" },
  label: { display: "block", fontSize: "12.5px", fontWeight: "600", marginBottom: "6px", color: "#334155" },
  cancelBtn: { background: "#f1f5f9", color: "#475569", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" },
  submitBtn: { background: "#2b7da1", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }
};