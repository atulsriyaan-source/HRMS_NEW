import React, { useState, useEffect } from "react";
import { C, SHADOW, RADIUS } from "../../theme";

export default function EmployeeDetails() {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State management controls for edit workflows
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Reusable fallback profile placeholder string image asset url
  const defaultProfileUrl = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

  const fetchProfile = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const employeeId = storedUser?.id || storedUser?.EmployeeID || storedUser?.employeeId;

      if (!employeeId) {
        setError("Session expired. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:5000/api/admin/employees/${employeeId}`);
      if (!response.ok) throw new Error("Failed to load profile details.");

      const data = await response.json();
      setEmployee(data);
      setFormData(data); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleInputChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`http://localhost:5000/api/admin/employees/${employee.EmployeeID}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to update profile records on backend schema.");
      
      const json = await response.json();
      if (json.success) {
        alert("Profile saved successfully!");
        setIsEditing(false);
        fetchProfile(); 
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) return dateString;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? dateString : date.toLocaleDateString("en-IN");
  };

  if (loading) return <div style={{ padding: "32px", color: C.text, fontFamily: "Inter, sans-serif" }}>Loading your profile...</div>;
  if (error) return <div style={{ padding: "32px", color: "#d63a6e", fontFamily: "Inter, sans-serif" }}>Error: {error}</div>;
  if (!employee) return null;

  return (
    <div style={styles.page}>
      {/* HEADER SECTION */}
      <div style={styles.header}>
        <div style={styles.avatarSection}>
          <img 
            src={employee.Photo ? `http://localhost:5000/uploads/${employee.Photo}` : defaultProfileUrl} 
            alt={`${employee.FirstName || "Employee"}'s Profile`} 
            style={styles.profileImage} 
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = defaultProfileUrl;
            }}
          />

          <div>
            <h1 style={styles.title}>
              {employee.FirstName} {employee.MiddleName || ""} {employee.LastName}
            </h1>
            <p style={styles.designation}>
              {employee.DesignationName || employee.role || "Employee"} • {employee.department_name || "General Department"}
            </p>
            <p style={styles.employeeId}>Employee ID Number: {employee.EmployeeID}</p>
          </div>
        </div>

        {/* Action Toggle Control Buttons */}
        {/* <div>
          {!isEditing ? (
            <button style={styles.editBtn} onClick={() => setIsEditing(true)}>Edit Profile</button>
          ) : (
            <div style={{ display: "flex", gap: "12px" }}>
              <button style={styles.cancelBtn} onClick={() => { setIsEditing(false); setFormData(employee); }}>Cancel</button>
              <button style={styles.saveBtn} disabled={isSaving} onClick={saveChanges}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div> */}
      </div>

      {/* PERSONAL WORKFORCE DATA */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Personal Information</h3>
        <div style={styles.grid}>
          <Info label="First Name" value={employee.FirstName} />
          <Info label="Middle Name" value={employee.MiddleName || "-"} />
          <Info label="Last Name" value={employee.LastName} />
          <Info label="Email Address" value={employee.EmailId} />
          
          <Info 
            label="Primary Contact" 
            value={employee.CurrentContactNo} 
            isEditable={isEditing} 
            fieldKey="CurrentContactNo"
            editValue={formData.CurrentContactNo}
            onChange={handleInputChange}
          />
          
          <Info label="Gender" value={employee.Gender || "N/A"} />
          <Info label="Date of Birth" value={formatDate(employee.DateOfBirth)} />
          
          <Info 
            label="Marital Status" 
            value={employee.MaritalStatus || "N/A"} 
            isEditable={isEditing} 
            fieldKey="MaritalStatus"
            editValue={formData.MaritalStatus}
            onChange={handleInputChange}
            isSelect={true}
            selectOptions={["Single", "Married", "Divorced", "Widowed"]}
          />
          
          <Info label="Blood Group" value={employee.BloodGroup || "N/A"} />
          <Info label="Nationality" value={employee.Nationality || "N/A"} />
        </div>
      </div>

      {/* CORE EMPLOYMENT STRUCTURE METRICS */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Employment Information</h3>
        <div style={styles.grid}>
          <Info label="System Privilege Role" value={employee.role} />
          <Info label="System Status" value={employee.Status} />
          <Info label="Employment Nature Type" value={employee.StatusOfEmployee || "N/A"} />
          <Info label="Direct Supervisor" value={employee.DirectSupervisor || "N/A"} />
          <Info label="Assigned Work Location" value={employee.WorkLocation || "N/A"} />
          <Info label="Official Start Date" value={formatDate(employee.StartDate)} />
        </div>
      </div>

      {/* UNIFIED ACADEMIC EDUCATION HISTORY TRACKING */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Education History</h3>
        {employee.education && employee.education.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {employee.education.map((edu) => (
              <div key={edu.id} style={styles.eduRow}>
                <div style={{ flex: 1 }}>
                  <div style={styles.eduDegree}>{edu.education_degree} ({edu.education_primary_subject})</div>
                  <div style={styles.eduSchool}>{edu.education_institute} • {edu.education_university_name}</div>
                  <div style={styles.eduMeta}>Timeline: {edu.education_startdate || "N/A"} - {edu.education_enddate || "N/A"} | Location: {edu.education_location}</div>
                </div>
                <div style={styles.eduScore}>
                  <div style={styles.scoreLabel}>Score Value</div>
                  <div style={styles.scoreValue}>{edu.education_percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: C.muted, fontSize: "14px" }}>No formal academic records found on file.</div>
        )}
      </div>

      {/* THREE COLUMN DETAILS CONTAINER */}
      <div style={styles.threeCol}>
        {/* RESIDENCE MAPPER */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Address Information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Info 
              label="Current Address" 
              value={employee.CurrentAddress || "N/A"} 
              isEditable={isEditing} 
              fieldKey="CurrentAddress"
              editValue={formData.CurrentAddress}
              onChange={handleInputChange}
              isTextArea={true}
            />
            <Info 
              label="Permanent Address" 
              value={employee.PermanantAddress || "N/A"} 
              isEditable={isEditing} 
              fieldKey="PermanantAddress"
              editValue={formData.PermanantAddress}
              onChange={handleInputChange}
              isTextArea={true}
            />
          </div>
        </div>

        {/* BANK LEDGER DATA */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Bank Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Info label="Account Holder Name" value={employee.AccountHolderName || "N/A"} isEditable={isEditing} fieldKey="AccountHolderName" editValue={formData.AccountHolderName} onChange={handleInputChange} />
            <Info label="Account Number" value={employee.AccountNumber || "N/A"} isEditable={isEditing} fieldKey="AccountNumber" editValue={formData.AccountNumber} onChange={handleInputChange} />
            <Info label="Bank Name" value={employee.BankName || "N/A"} isEditable={isEditing} fieldKey="BankName" editValue={formData.BankName} onChange={handleInputChange} />
            <Info label="IFSC Routing Code" value={employee.IFSCCode || "N/A"} isEditable={isEditing} fieldKey="IFSCCode" editValue={formData.IFSCCode} onChange={handleInputChange} />
          </div>
        </div>

        {/* OFFICIAL RECORDS LEDGER */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Official Documents</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Info label="PAN Number String" value={employee.PANNo || "N/A"} />
            <Info label="Aadhar ID Code" value={employee.AadharNo ? "[Aadhaar Redacted]" : "N/A"} />
            <Info label="Passport Number String" value={employee.PassportNo || "N/A"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, isEditable = false, fieldKey, editValue, onChange, isTextArea = false, isSelect = false, selectOptions = [] }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.label}>{label}</div>
      {isEditable ? (
        isSelect ? (
          <select 
            style={styles.inputField} 
            value={editValue || ""} 
            onChange={(e) => onChange(fieldKey, e.target.value)}
          >
            <option value="">Select Option</option>
            {selectOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : isTextArea ? (
          <textarea 
            style={{ ...styles.inputField, minHeight: "60px", resize: "vertical" }} 
            value={editValue || ""} 
            onChange={(e) => onChange(fieldKey, e.target.value)}
          />
        ) : (
          <input 
            type="text" 
            style={styles.inputField} 
            value={editValue || ""} 
            onChange={(e) => onChange(fieldKey, e.target.value)}
          />
        )
      ) : (
        <div style={styles.value}>{value}</div>
      )}
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "32px", fontFamily: "'Inter', system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, padding: "28px 32px", borderRadius: RADIUS.card, boxShadow: SHADOW.card },
  avatarSection: { display: "flex", alignItems: "center", gap: "24px" },
  profileImage: { width: "110px", height: "110px", borderRadius: "22px", objectFit: "cover", boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)", border: "2px solid #fff" },
  title: { margin: 0, fontSize: "34px", fontWeight: "700", color: C.text },
  designation: { fontSize: "18px", color: C.text, margin: "6px 0 4px 0", fontWeight: "500" },
  employeeId: { color: C.muted, fontSize: "15px", fontWeight: "500" },
  editBtn: { background: C.primary, color: "#fff", padding: "10px 20px", border: "none", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  cancelBtn: { background: "#f1f5f9", color: "#475569", padding: "10px 20px", border: "none", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  saveBtn: { background: "#0f6e56", color: "#fff", padding: "10px 20px", border: "none", borderRadius: RADIUS.button, cursor: "pointer", fontWeight: "600", fontSize: "14px" },
  card: { background: C.card, borderRadius: RADIUS.card, padding: "32px", boxShadow: SHADOW.card },
  cardTitle: { margin: "0 0 26px 0", fontSize: "20px", fontWeight: "700", color: C.primary, borderBottom: `2px solid ${C.borderLight || '#e2e8f0'}`, paddingBottom: "12px" },
  threeCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "24px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" },
  infoBox: { background: C.inputBg || "#f8fafc", border: `1px solid ${C.borderLight || '#e2e8f0'}`, borderRadius: RADIUS.button, padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "center" },
  label: { fontSize: "12px", color: C.muted, marginBottom: "6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  value: { fontSize: "15px", fontWeight: "600", color: C.text, wordBreak: "break-all" },
  inputField: { width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", boxSizing: "border-box", background: "#fff", color: "#1e293b", fontFamily: "inherit" },
  eduRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" },
  eduDegree: { fontSize: "16px", fontWeight: "600", color: C.text },
  eduSchool: { fontSize: "14px", color: C.muted, margin: "4px 0" },
  eduMeta: { fontSize: "12px", color: C.muted },
  eduScore: { textAlign: "right" },
  scoreLabel: { fontSize: "11px", color: C.muted, textTransform: "uppercase" },
  scoreValue: { fontSize: "18px", fontWeight: "700", color: C.primary }
};