import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, SHADOW, RADIUS } from "../../theme";
import { apiUrl } from '../../URL';

const PROCESS_STEPS = [
  { key: "Submitted", title: "Resignation submitted", desc: "Your request has been received" },
  { key: "Manager Review", title: "Manager review", desc: "Reviewed by your reporting manager" },
  { key: "Manager LWD Propose", title: "Manager recommended LWD", desc: "Manager proposes a last working date" },
  { key: "HR Review", title: "HR review", desc: "HR verifies notice period & documents" },
  { key: "Negotiation", title: "Accepted / negotiation", desc: "Resignation accepted or discussed" },
  { key: "HR LWD Confirmed", title: "HR confirmed LWD", desc: "Final last working date is confirmed" },
  { key: "Exit Interview", title: "Exit interview", desc: "Formal feedback session" },
  { key: "Asset Clearance", title: "Asset clearance", desc: "Return company assets & NOC" },
  { key: "Settlement", title: "Final settlement", desc: "Full & final processed" },
  { key: "Closed", title: "Closed", desc: "Separation process complete" },
];

export default function EmployeeResign() {
  const navigate = useNavigate();

  const [showConfirmModal, setShowConfirmModal] = useState(true);
  const [resignationSubmitted, setResignationSubmitted] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState("Pending");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  // State to store the active resignation ID for withdrawal
  const [activeResignationId, setActiveResignationId] = useState(null); 

  const [form, setForm] = useState({
    resignationDate: "",
    primaryReason: "",
    additionalComments: "",
    attachment: null,
  });

  const noticePeriodDays = 90;

  const fetchActiveResignationState = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const empId = storedUser?.id || storedUser?.EmployeeID || "";

      if (!empId) {
        setPageLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/api/employee/active-resignation?employeeId=${empId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();

      // CRITICAL MODIFICATION: If the resignation status is "Withdrawal Approved", 
      // treat it as non-active so the employee can submit a fresh resignation request.
      if (data.success && data.hasActiveResignation && data.data?.Status !== "Withdrawal Approved") {
        const record = data.data;
        setResignationSubmitted(true);
        setShowConfirmModal(false);
        setStatus(record.Status);
        
        setActiveResignationId(record.id || record.ResignationID || record.resignation_id);

        const targetIndex = PROCESS_STEPS.findIndex(step => step.key.toLowerCase() === record.Status.toLowerCase());
        setCurrentStepIndex(targetIndex !== -1 ? targetIndex : 0);
      } else {
        // Either no active record exists, or the last one was approved for withdrawal
        setResignationSubmitted(false);
        // Keep tracking the past ID or keep it null so a new entry forms cleanly
        setActiveResignationId(null);
        setStatus("Pending");
      }
    } catch (err) {
      console.error("Failed to sync structural exit log tracking tracks:", err);
    } finally {
      setPageLoading(false);
    }
  };

  // --- 1. SYNC STATE FROM DATABASE ON MOUNT ---
  useEffect(() => {
    fetchActiveResignationState();
  }, []);

  const calculateLWD = () => {
    if (!form.resignationDate) return "";
    const date = new Date(form.resignationDate);
    date.setDate(date.getDate() + noticePeriodDays);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // --- 2. MULTIPART FORM SUBMISSION WITH PAYLOAD IDENTIFIER ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.resignationDate || !form.primaryReason) {
      return alert("Please fill all required fields");
    }

    const formData = new FormData();
    formData.append("resignationDate", form.resignationDate);
    formData.append("primaryReason", form.primaryReason);
    formData.append("additionalComments", form.additionalComments);

    if (form.attachment) {
      formData.append("attachment", form.attachment);
    }

    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && (storedUser.id || storedUser.EmployeeID)) {
      formData.append("employeeId", storedUser.id || storedUser.EmployeeID);
    } else {
      return alert("Session expired. Please log in again to authentic context parameters.");
    }

    try {
      const res = await fetch(`${apiUrl}/api/employee/submit-resignation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!data.success) {
        return alert(data.message);
      }

      alert("Resignation submitted successfully");
      
      // Reset form controls
      setForm({ resignationDate: "", primaryReason: "", additionalComments: "", attachment: null });
      setAcknowledged(false);

      // Refresh state from the backend to load the step tracking grid view interface
      await fetchActiveResignationState();
      
    } catch (err) {
      console.error(err);
      alert("Failed to submit resignation");
    }
  };

  // --- 3. HANDLE WITHDRAWAL API CALL ---
  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw your resignation? HR will need to approve this withdrawal.")) {
      return;
    }

    if (!activeResignationId) {
      return alert("Error: Resignation record ID not found. Please refresh the page.");
    }

    try {
      const payload = {
        resignationId: activeResignationId,
        nextStatus: "Withdrawal Requested",
        managerComments: "Employee initiated a withdrawal request from the portal."
      };

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
        alert("Withdrawal request sent successfully.");
        setStatus("Withdrawal Requested");
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error("Failed to withdraw:", err);
      alert("Network error processing withdrawal.");
    }
  };

  if (pageLoading) {
    return (
      <div style={{ padding: "100px 40px", color: C.muted, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <strong>Synchronizing departure workflow data streams...</strong>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Resignation</h1>
        <p style={styles.subtitle}>Submit your resignation request and track its status</p>
      </div>

      {/* Form View (Visible if no active request is logged or if previous was approved for withdrawal) */}
      {!resignationSubmitted && (
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Submit resignation</h2>

          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Resignation date *</label>
                <input
                  type="date"
                  style={styles.input}
                  value={form.resignationDate}
                  onChange={(e) => setForm({ ...form, resignationDate: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>Primary reason *</label>
                <select
                  style={styles.input}
                  value={form.primaryReason}
                  onChange={(e) => setForm({ ...form, primaryReason: e.target.value })}
                  required
                >
                  <option value="">Select reason</option>
                  <option value="Career Growth">Career growth</option>
                  <option value="Compensation">Compensation</option>
                  <option value="Higher Education">Higher education</option>
                  <option value="Relocation">Relocation</option>
                  <option value="Work-Life Balance">Work-life balance</option>
                  <option value="Personal Reasons">Personal reasons</option>
                  <option value="Health Reasons">Health reasons</option>
                  <option value="Retirement">Retirement</option>
                  <option value="Managerial Issues">Managerial issues</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <label style={styles.label}>Additional comments</label>
              <textarea
                rows={5}
                style={styles.textarea}
                placeholder="Please provide additional details…"
                value={form.additionalComments}
                onChange={(e) => setForm({ ...form, additionalComments: e.target.value })}
              />
            </div>

            <div style={{ marginTop: "24px" }}>
              <label style={styles.label}>Supporting attachment (optional)</label>
              <input
                type="file"
                style={styles.input}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => setForm({ ...form, attachment: e.target.files[0] || null })}
              />
              {form.attachment && (
                <div style={styles.filePreview}>
                  <span style={{ fontSize: "16px" }}>📎</span>
                  <span style={{ flex: 1 }}>{form.attachment.name}</span>
                  <span style={styles.fileRemove} onClick={() => setForm({ ...form, attachment: null })}>Remove</span>
                </div>
              )}
            </div>

            <div style={styles.noticeBox}>
              <div><strong>System notice period:</strong> {noticePeriodDays} days</div>
              <div style={{ marginTop: "4px" }}><strong>Expected last working date:</strong> {calculateLWD() || "—"}</div>
            </div>

            <label style={styles.ackRow}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ width: "18px", height: "18px", marginTop: "2px", flexShrink: 0 }}
              />
              <span style={{ fontSize: "14px", color: C.text, lineHeight: "1.5" }}>
                I understand that submitting this resignation will initiate the formal exit process.
              </span>
            </label>

            <button
              type="submit"
              style={{
                ...styles.submitBtn,
                opacity: acknowledged ? 1 : 0.5,
                cursor: acknowledged ? "pointer" : "not-allowed",
              }}
              disabled={!acknowledged}
            >
              Submit resignation request
            </button>
          </form>
        </div>
      )}

      {/* Confirmation Modal overlay block */}
      {showConfirmModal && !resignationSubmitted && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.confirmTitle}>Are you sure you want to resign?</h2>
            <p style={styles.confirmText}>This action will start the formal separation process.</p>
            <div style={styles.confirmButtons}>
              <button style={styles.cancelBtn} onClick={() => navigate("/employee/dashboard")}>No, go back</button>
              <button style={styles.continueBtn} onClick={() => setShowConfirmModal(false)}>Yes, continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Post Submission Tracking Steps Block */}
      {resignationSubmitted && (
        <>
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Resignation process</h2>
            <div style={styles.timeline}>
              {PROCESS_STEPS.map((step, index) => {
                const isDone = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step.key} style={styles.step}>
                    <div
                      style={{
                        ...styles.iconCircle,
                        background: isDone ? "#16a34a" : isCurrent ? C.primary : "#e8f4fa",
                        color: isDone || isCurrent ? "#fff" : C.primary,
                      }}
                    >
                      {isDone ? "✓" : index + 1}
                    </div>
                    <div style={styles.stepContent}>
                      <div style={styles.stepTitle}>{step.title}</div>
                      <div style={styles.stepDesc}>{step.desc}</div>
                    </div>
                    {isCurrent && <span style={styles.currentTag}>In progress</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {status !== "Withdrawal Requested" && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Withdraw resignation</h2>
              <p style={styles.withdrawText}>If you have discussed with your manager or HR and wish to continue your employment, you may submit a withdrawal request.</p>
              <button style={styles.withdrawBtn} onClick={handleWithdraw}>Withdraw resignation</button>
            </div>
          )}

          {status === "Withdrawal Requested" && (
            <div style={{ ...styles.card, background: "#fff7ed", border: "1px solid #fed7aa" }}>
              <p style={{ margin: 0, color: "#9a3412", fontSize: "14.5px" }}>
                Your withdrawal request has been submitted and is pending HR approval. You'll be notified once it's reviewed.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "24px", position: "relative" },
  header: { marginBottom: "8px" },
  title: { margin: 0, fontSize: "32px", fontWeight: "700", color: C.text },
  subtitle: { color: C.muted, marginTop: "6px", fontSize: "15.5px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  modal: { background: C.card, borderRadius: RADIUS.card, padding: "40px", textAlign: "center", boxShadow: SHADOW.card, maxWidth: "480px", width: "100%" },
  confirmTitle: { fontSize: "24px", fontWeight: "700", marginBottom: "12px", color: C.text },
  confirmText: { color: C.muted, marginBottom: "28px" },
  confirmButtons: { display: "flex", justifyContent: "center", gap: "14px" },
  continueBtn: { background: "#16a34a", color: "#fff", border: "none", padding: "13px 26px", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600" },
  cancelBtn: { background: "#f1f5f9", color: C.text, border: `1px solid ${C.border}`, padding: "13px 26px", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600" },
  card: { background: C.card, borderRadius: RADIUS.card, padding: "32px", boxShadow: SHADOW.card },
  sectionTitle: { margin: "0 0 26px 0", fontSize: "20px", fontWeight: "700", color: C.primary, borderBottom: `2px solid ${C.border}`, paddingBottom: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" },
  label: { display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: C.text },
  input: { width: "100%", padding: "13px 16px", borderRadius: RADIUS.button, border: `1px solid ${C.border}`, backgroundColor: "#f8fafc", fontSize: "15px", outline: "none" },
  textarea: { width: "100%", padding: "13px 16px", borderRadius: RADIUS.button, border: `1px solid ${C.border}`, backgroundColor: "#f8fafc", fontSize: "15px", resize: "vertical", minHeight: "130px", outline: "none" },
  filePreview: { marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: RADIUS.button, fontSize: "13.5px", color: C.text },
  fileRemove: { color: "#dc2626", cursor: "pointer", fontSize: "12.5px", fontWeight: "600", flexShrink: 0 },
  noticeBox: { margin: "24px 0", padding: "18px 20px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: RADIUS.button, color: "#1e40af", fontSize: "14.5px" },
  ackRow: { display: "flex", gap: "10px", alignItems: "flex-start", margin: "20px 0", cursor: "pointer" },
  submitBtn: { marginTop: "12px", border: "none", background: C.accent, color: "#fff", padding: "15px 32px", borderRadius: RADIUS.button, fontWeight: "600", fontSize: "16px", boxShadow: "0 10px 25px rgba(214,58,110,0.25)", transition: "all 0.2s" },
  timeline: { display: "flex", flexDirection: "column", gap: "20px" },
  step: { display: "flex", gap: "18px", alignItems: "flex-start", position: "relative" },
  iconCircle: { width: "44px", height: "44px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", flexShrink: 0, transition: "all 0.2s" },
  stepContent: { paddingTop: "6px", flex: 1 },
  stepTitle: { fontWeight: "600", color: C.text, fontSize: "15px", marginBottom: "3px" },
  stepDesc: { color: C.muted, fontSize: "13.5px", lineHeight: "1.5" },
  currentTag: { alignSelf: "center", fontSize: "11.5px", fontWeight: "600", color: C.primary, background: "#e8f4fa", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" },
  withdrawText: { color: C.muted, marginBottom: "20px" },
  withdrawBtn: { background: "#dc2626", color: "#fff", border: "none", padding: "14px 24px", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600" }
};