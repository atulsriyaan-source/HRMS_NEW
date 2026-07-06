import React, { useState, useEffect } from "react";

const C = { secondary: '#334155', muted: '#64748b', accent: '#2b7da1', text: '#0f172a', success: '#16a34a', danger: '#ef4444' };

export default function EmployeeRequests() {
  const [requests, setRequests] = useState([]);
  const [reqType, setReqType] = useState("Backdated Timesheet Unlock");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState(null); // FIXED: Added file node tracker state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const storedUser = JSON.parse(localStorage.getItem("user")) || { id: 1, name: "Employee" };

  const fetchMyRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/employee/requests?employeeId=${storedUser.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setRequests(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchMyRequests(); }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // FIXED: Converted plain JSON maps into FormData sequence payload matrices
    const dataPayload = new FormData();
    dataPayload.append('employeeId', storedUser.id);
    dataPayload.append('employeeName', storedUser.name);
    dataPayload.append('requestType', reqType);
    dataPayload.append('title', title);
    dataPayload.append('description', description);
    
    if (selectedFile) {
      dataPayload.append('Attachment', selectedFile);
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/employee/requests", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`
          // CRITICAL REMINDER: Do not set Content-Type here, browser auto-maps multipart streams!
        },
        body: dataPayload
      });

      if (!response.ok) throw new Error("Server rejected request creation.");

      alert("Ticket layout published cleanly with attachments!");
      setTitle(""); setDescription(""); setSelectedFile(null);
      e.target.reset(); // Native file field UI reset
      fetchMyRequests();
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={{ color: C.secondary, margin: "0 0 4px 0" }}>🎫 Central Service Request Hub</h2>
      <p style={{ color: C.muted, fontSize: "14px", margin: "0 0 24px 0" }}>Raise requests for dynamic settings tweaks along with optional documentary backup assets.</p>
      
      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      <div style={styles.layoutSplit}>
        <form onSubmit={handleSubmit} style={styles.card}>
          <h3 style={styles.cardHeader}>Raise New Ticket</h3>
          
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Category Type *</label>
            <select value={reqType} onChange={(e) => setReqType(e.target.value)} style={styles.input}>
              <option value="Backdated Timesheet Unlock">Unlock Backdated Timesheet Window</option>
              <option value="Profile Update Request">Correction in Profile Name / Core Fields</option>
              <option value="IT Support / Access Token">IT Infrastructure Access / Key Updates</option>
              <option value="General Query Override">Other / General Operations Query</option>
            </select>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Subject Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={styles.input} placeholder="Summary line..." />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description Context *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} style={{ ...styles.input, resize: 'none', fontFamily: 'inherit' }} placeholder="Provide exhaustive execution metrics justification arguments..." />
          </div>

          {/* FIXED: Optional File Upload Component Layer Appended */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Upload Support Document / Proof Asset (Optional)</label>
            <input type="file" onChange={handleFileChange} style={{ ...styles.input, background: '#f8fafc' }} />
          </div>

          <button type="submit" disabled={isSubmitting} style={styles.submitBtn}>
            {isSubmitting ? "Routing to HR Command Desk..." : "Submit Ticket Request"}
          </button>
        </form>

        <div style={styles.card}>
          <h3 style={styles.cardHeader}>My Active Tickets History Logs</h3>
          <div style={styles.scrollContainer}>
            {requests.map((r) => (
              <div key={r.id} style={styles.ticketRow}>
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={styles.typeTag}>{r.request_type}</span>
                    <span style={{ fontSize: '11px', color: C.muted }}>Ticket #{r.id}</span>
                  </div>
                  <strong style={{ fontSize: "14px", color: C.text, display: 'block', marginBottom: '4px' }}>{r.title}</strong>
                  <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: C.muted, lineHeight: '1.4' }}>{r.description}</p>
                  
                  {/* FIXED: Link display to access active dynamic attachments anchors directly */}
                  {r.Attachment && (
                    <div style={{ marginBottom: '8px' }}>
                      <a href={`http://localhost:5000/uploads/requests/${r.Attachment}`} target="_blank" rel="noreferrer" style={styles.attachmentLink}>
                        📎 View Uploaded Document Asset
                      </a>
                    </div>
                  )}

                  {r.hr_comments && <div style={styles.hrNotesContainer}><strong>HR Notes:</strong> {r.hr_comments}</div>}
                </div>
                
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: r.status === 1 ? "#ecfdf5" : r.status === 2 ? "#fef2f2" : "#fffbeb",
                  color: r.status === 1 ? C.success : r.status === 2 ? C.danger : "#b45309"
                }}>
                  {r.status === 1 ? "Approved" : r.status === 2 ? "Rejected" : "Under HR Audit"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { fontFamily: "'Inter', system-ui, sans-serif", padding: "24px", maxWidth: "1280px", margin: "0 auto" },
  layoutSplit: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "24px", alignItems: "start" },
  card: { background: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" },
  cardHeader: { margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" },
  fieldGroup: { marginBottom: "14px" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13.5px", outline: "none", boxSizing: "border-box", backgroundColor: "#fdfefe" },
  submitBtn: { marginTop: "10px", width: "100%", padding: "12px", border: "none", borderRadius: "8px", background: "#2b7da1", color: "#fff", fontWeight: "600", cursor: "pointer", fontSize: "14px" },
  scrollContainer: { display: "flex", flexDirection: "column", gap: "12px" },
  ticketRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#f8fafc" },
  typeTag: { background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700" },
  statusBadge: { padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" },
  hrNotesContainer: { marginTop: '8px', padding: '8px 12px', background: '#fff', borderLeft: '3px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', color: '#475569' },
  errorBanner: { color: "#ef4444", background: "#fef2f2", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "13.5px" },
  attachmentLink: { display: 'inline-block', fontSize: '12px', color: '#2b7da1', fontWeight: '600', textDecoration: 'none', borderBottom: '1px dashed #2b7da1', paddingBottom: '2px' }
};