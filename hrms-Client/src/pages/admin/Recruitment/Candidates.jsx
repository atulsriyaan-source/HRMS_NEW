import React, { useState, useEffect } from "react";
import { C, SHADOW, RADIUS } from "../../../theme";
import { apiUrl } from "../../../URL";

// ── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  FirstName: "", MiddleName: "", LastName: "", Gender: "",
  DateOfBirth: "", MaritalStatus: "", Nationality: "India",
  EmailId: "", AlternateEmailId: "",
  CountryCode1: "+91", MobileNo: "",
  CountryCode2: "+91", AlternateMobileNo: "",
  SpouseContactNo: "", MotherContactNo: "", FatherContactNo: "",
  EmergencyContactNo: "", EmergencyContactName: "",
  CurrentAddress: "", City: "", State: "", Country: "India",
  AppliedDesignation: "", AppliedDepartment: "",
  CurrentCompany: "", CurrentDesignation: "",
  TotalExperience: "", CurrentCTC: "", ExpectedCTC: "",
  NoticePeriod: "", SourceOfHiring: "Direct",
  ResumeFile: null, Photo: null,
};

const PIPELINE_STATUSES = [
  "Applied","Interview Scheduled","Interview Process",
  "Offer Discussion","Offer Process","Selected","On Hold",
];

const STATUS_STYLE = {
  "Applied":                      { bg: "#e8f4fa", color: "#0c447c" },
  "Interview Scheduled":          { bg: "#fff3e0", color: "#e65100" },
  "Interview Process":            { bg: "#e3f2fd", color: "#1565c0" },
  "Offer Discussion":             { bg: "#f3e8ff", color: "#7e22ce" },
  "Offer Process":                { bg: "#e8f5e9", color: "#2e7d32" },
  "Selected":                     { bg: "#c8e6c9", color: "#1b5e20" },
  "Offer Letter Sent":            { bg: "#fff8e1", color: "#f57f17" },
  "Offer Accepted":               { bg: "#dcfce7", color: "#15803d" },
  "Employee Created":             { bg: "#dbeafe", color: "#1d4ed8" },
  "Joined":                       { bg: "#cffafe", color: "#0f766e" },
  "Appointment Letter Sent":      { bg: "#ede9fe", color: "#6d28d9" },
  "Appointment Letter Accepted":  { bg: "#ecfccb", color: "#4d7c0f" },
  "Rejected":                     { bg: "#ffebee", color: "#c62828" },
  "On Hold":                      { bg: "#f5f5f5", color: "#616161" },
};

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ marginTop: "20px", marginBottom: "10px", fontSize: "13px", fontWeight: "700", color: C.primary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "10px 0", borderBottom: `1px solid ${C.border || "#e2e8f0"}` }}>
      <span style={{ color: C.muted, fontSize: "13px", fontWeight: "500" }}>{label}</span>
      <span style={{ color: C.text, fontSize: "13px", fontWeight: "600", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function initials(c) {
  if (!c) return "";
  return `${c.FirstName?.[0] || ""}${c.LastName?.[0] || ""}`.toUpperCase();
}

function Inp({ placeholder, value, onChange, type = "text", required = false }) {
  return (
    <input type={type} placeholder={placeholder} value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={styles.inputElement} required={required} />
  );
}

function Sel({ value, onChange, options = [], placeholder = "Select", valueKey, labelKey }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={styles.inputElement}>
      <option value="">{placeholder}</option>
      {options.map((opt) => {
        const v = valueKey ? opt[valueKey] : opt;
        const l = labelKey ? opt[labelKey] : opt;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

function FormSection({ title, children }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "14px", color: C.text }}>{title}</h3>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Candidates() {
  const [candidates,     setCandidates]     = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("All");
  const [showDrawer,     setShowDrawer]     = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [candidateForm,  setCandidateForm]  = useState(EMPTY_FORM);
  

  // master data
  const [departments,    setDepartments]    = useState([]);
  const [empStatuses,    setEmpStatuses]    = useState([]);

  // ── Role-based access ──────────────────────────────────────────────────────
  const userRole = (localStorage.getItem("role") || "").toLowerCase();
  const userDepartment = localStorage.getItem("department") || "";
  const userEmployeeId = localStorage.getItem("employeeId") || "";

  const isHr = userRole === "hr" || userRole === "admin";
  const isManager = userRole === "manager";
  const isLead = userRole === "lead";
  
  // Only HR can add candidates
  const canAddCandidate = isHr;
  const isReadOnly = isManager || isLead;

  useEffect(() => {
    fetchCandidates();
    fetchMasterData();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${apiUrl}/api/candidates/all?role=${encodeURIComponent(userRole)}&department=${encodeURIComponent(userDepartment)}`);
      const data = await res.json();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

 const fetchMasterData = async () => {
  try {
    const [deptRes, statusRes] = await Promise.all([
      fetch(`${apiUrl}/api/admin/departments`),
      fetch(`${apiUrl}/api/admin/employee-statuses`),
    ]);

    if (deptRes.ok) {
      setDepartments(await deptRes.json());
    }

    if (statusRes.ok) {
      setEmpStatuses(await statusRes.json());
    }
  } catch (err) {
    console.error("Master data fetch:", err);
  }
};

const departmentMap = React.useMemo(() => {
  const map = {};

  departments.forEach((d) => {
    map[d.id] = d.Department;
  });

  return map;
}, [departments]);

  // Role-based filtering: manager sees only their department's candidates
  const visibleCandidates = candidates.filter((c) => {
    // Manager: only see candidates from their department
    if (isManager) {
      const empDept = userDepartment;
      if (empDept && c.AppliedDepartment && 
          !c.AppliedDepartment.toLowerCase().includes(empDept.toLowerCase())) {
        return false;
      }
    }
    // Lead and HR see all candidates
    
    const keyword = search.toLowerCase();
    const nameMatch  = `${c.FirstName || ""} ${c.LastName || ""}`.toLowerCase().includes(keyword);
    const emailMatch = (c.EmailId || "").toLowerCase().includes(keyword);
    const mobMatch   = (c.MobileNo || "").includes(keyword);
    const statusMatch = statusFilter === "All" || c.CandidateStatus === statusFilter;
    return (nameMatch || emailMatch || mobMatch) && statusMatch;
  });

  const pipelineCount = candidates.filter((c) => PIPELINE_STATUSES.includes(c.CandidateStatus)).length;
  const selectedCount = candidates.filter((c) => ["Selected","Offer Letter Sent","Offer Accepted"].includes(c.CandidateStatus)).length;
  const rejectedCount = candidates.filter((c) => c.CandidateStatus === "Rejected").length;

  const setField = (key, val) => setCandidateForm((p) => ({ ...p, [key]: val }));

  const handleView = (candidate) => { setSelectedCandidate(candidate); setShowDrawer(true); };

  const handleAddCandidate = async () => {
    if (!isHr) {
      alert("Only HR can add candidates");
      return;
    }
    if (!candidateForm.FirstName || !candidateForm.LastName || !candidateForm.EmailId || !candidateForm.MobileNo || !candidateForm.AppliedDesignation) {
      alert("Please fill all required fields (*)"); return;
    }
    if (!candidateForm.ResumeFile) { alert("Resume is required"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(candidateForm).forEach((key) => {
        if (key !== "ResumeFile" && key !== "Photo") fd.append(key, candidateForm[key] ?? "");
      });
      if (candidateForm.ResumeFile) fd.append("ResumeFile", candidateForm.ResumeFile);
      if (candidateForm.Photo)      fd.append("Photo",      candidateForm.Photo);
      const response = await fetch(`${apiUrl}/api/candidates/create`, { method: "POST", body: fd });
      const data = await response.json();
      if (response.ok && data.success) {
        alert("Candidate added successfully!");
        setShowAddModal(false);
        setCandidateForm(EMPTY_FORM);
        fetchCandidates();
      } else {
        alert(data.message || "Failed to add candidate");
      }
    } catch (err) { console.error(err); alert("Error connecting to server"); }
    finally { setSaving(false); }
  };


  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Candidates</h1>
          <p style={styles.subtitle}>
            {isManager ? "View candidates from your department" :
             isLead ? "View all candidates in the pipeline" :
             "Manage recruitment pipeline and interview progress"}
          </p>
        </div>
        {canAddCandidate && (
          <button style={styles.addButton} onClick={() => setShowAddModal(true)}>+ Add Candidate</button>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard title="Total Candidates" value={candidates.length}  color={C.primary} />
        <StatCard title="In Pipeline"       value={pipelineCount}     color="#0f766e" />
        <StatCard title="Selected"          value={selectedCount}     color="#15803d" />
        <StatCard title="Rejected"          value={rejectedCount}     color={C.accent} />
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <input type="text" placeholder="Search by name, email or mobile…" value={search}
            onChange={(e) => setSearch(e.target.value)} style={styles.searchInput} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={styles.filterSelect}>
          <option value="All">All Statuses</option>
          {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Loading candidates…</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Candidate</th>
                <th style={styles.th}>Designation</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Experience</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCandidates.length > 0 ? visibleCandidates.map((c) => (
                <tr key={c.CandidateID} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.candidateCell}>
                      {c.Photo
                        ? <img src={`${apiUrl}/uploads/photos/${c.Photo}`} alt="" style={styles.avatarImg} />
                        : <div style={styles.miniAvatar}>{`${c.FirstName?.[0]||""}${c.LastName?.[0]||""}`}</div>
                      }
                      <div>
                        <div style={styles.name}>{c.FirstName} {c.LastName}</div>
                        <div style={styles.email}>{c.EmailId}</div>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>{c.AppliedDesignation || "—"}</td>
                  <td style={styles.td}>
    {departmentMap[c.AppliedDepartment] || "—"}
</td>
                  <td style={styles.td}>{c.TotalExperience ? `${c.TotalExperience} Yrs` : "—"}</td>
                  <td style={styles.td}><StatusPill status={c.CandidateStatus} /></td>
                  <td style={styles.td}>
                    <button style={styles.viewButton} onClick={() => handleView(c)}>View Profile</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" style={styles.empty}>No candidates found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Profile Drawer ────────────────────────────────────────────────────── */}
      {showDrawer && selectedCandidate && (
        <>
          <div style={styles.overlay} onClick={() => { setShowDrawer(false); setSelectedCandidate(null); }} />
          <div style={styles.drawer}>
            <div style={styles.drawerHead}>
              <span style={styles.drawerTitle}>Candidate Profile</span>
              <button style={styles.iconBtn} onClick={() => { setShowDrawer(false); setSelectedCandidate(null); }}>✕</button>
            </div>
            <div style={styles.drawerBody}>
              <div style={styles.drawerHero}>
                {selectedCandidate.Photo
                  ? <img src={`${apiUrl}/uploads/photos/${selectedCandidate.Photo}`} alt="" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={styles.av}>{initials(selectedCandidate)}</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={styles.heroName}>{selectedCandidate.FirstName} {selectedCandidate.LastName}</div>
                  <div style={styles.heroSub}>{selectedCandidate.AppliedDesignation}</div>
                  <div style={{ marginTop: "8px" }}><StatusPill status={selectedCandidate.CandidateStatus} /></div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
                {selectedCandidate.CurrentCompany && <Chip>🏢 {selectedCandidate.CurrentCompany}</Chip>}
                {selectedCandidate.TotalExperience && <Chip>⏳ {selectedCandidate.TotalExperience} Yrs</Chip>}
                {selectedCandidate.ExpectedCTC && <Chip>💰 {selectedCandidate.ExpectedCTC}</Chip>}
              </div>

              <SectionLabel>Personal Details</SectionLabel>
              <InfoRow label="Gender"         value={selectedCandidate.Gender} />
              <InfoRow label="Date of Birth"  value={selectedCandidate.DateOfBirth} />
              <InfoRow label="Marital Status" value={selectedCandidate.MaritalStatus} />
              <InfoRow label="Nationality"    value={selectedCandidate.Nationality} />

              <SectionLabel>Contact</SectionLabel>
              <InfoRow label="Email"           value={selectedCandidate.EmailId} />
              <InfoRow label="Alternate Email" value={selectedCandidate.AlternateEmailId} />
              <InfoRow label="Mobile"          value={`${selectedCandidate.CountryCode1 || "+91"} ${selectedCandidate.MobileNo}`} />
              <InfoRow label="Alternate Mobile" value={selectedCandidate.AlternateMobileNo ? `${selectedCandidate.CountryCode2 || "+91"} ${selectedCandidate.AlternateMobileNo}` : null} />
              <InfoRow label="Emergency Contact" value={selectedCandidate.EmergencyContactNo ? `${selectedCandidate.EmergencyContactName || ""} — ${selectedCandidate.EmergencyContactNo}` : null} />
              <InfoRow label="Spouse Contact"  value={selectedCandidate.SpouseContactNo} />
              <InfoRow label="Mother Contact"  value={selectedCandidate.MotherContactNo} />
              <InfoRow label="Father Contact"  value={selectedCandidate.FatherContactNo} />

              <SectionLabel>Address</SectionLabel>
              {selectedCandidate.CurrentAddress && <p style={styles.addressBlock}>{selectedCandidate.CurrentAddress}</p>}
              <InfoRow label="City"    value={selectedCandidate.City} />
              <InfoRow label="State"   value={selectedCandidate.State} />
              <InfoRow label="Country" value={selectedCandidate.Country} />

              <SectionLabel>Professional</SectionLabel>
              <InfoRow label="Current Company"     value={selectedCandidate.CurrentCompany} />
              <InfoRow label="Current Designation" value={selectedCandidate.CurrentDesignation} />
              <InfoRow label="Total Experience"    value={selectedCandidate.TotalExperience ? `${selectedCandidate.TotalExperience} Years` : null} />
              <InfoRow label="Current CTC"         value={selectedCandidate.CurrentCTC} />
              <InfoRow label="Expected CTC"        value={selectedCandidate.ExpectedCTC} />
              <InfoRow label="Notice Period"       value={selectedCandidate.NoticePeriod} />
              <InfoRow label="Source"              value={selectedCandidate.SourceOfHiring} />

              {selectedCandidate.ResumeFile && (
                <button style={styles.resumeBtn}
                  onClick={() => window.open(`${apiUrl}/uploads/resumes/${selectedCandidate.ResumeFile}`, "_blank")}>
                  📄 Open Resume
                </button>
              )}
            </div>
            <div style={styles.drawerFoot}>
              <button style={styles.drawerSecondary} onClick={() => { setShowDrawer(false); setSelectedCandidate(null); }}>Close</button>
            </div>
          </div>
        </>
      )}

      {/* ── Add Candidate Modal (HR Only) ───────────────────────────────────── */}
      {showAddModal && canAddCandidate && (
        <>
          <div style={styles.overlay} onClick={() => setShowAddModal(false)} />
          <div style={styles.modal}>
            <div style={styles.modalHead}>
              <div>
                <h2 style={styles.modalTitle}>Add New Candidate</h2>
                <p style={styles.modalSub}>Fields marked * are mandatory</p>
              </div>
              <button style={styles.iconBtn} onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <FormSection title="Personal Information">
                <div style={styles.grid2}>
                  <Inp placeholder="First Name *"    value={candidateForm.FirstName}    onChange={(v) => setField("FirstName", v)} required />
                  <Inp placeholder="Middle Name"     value={candidateForm.MiddleName}   onChange={(v) => setField("MiddleName", v)} />
                  <Inp placeholder="Last Name *"     value={candidateForm.LastName}     onChange={(v) => setField("LastName", v)} required />
                  <Sel value={candidateForm.Gender}  onChange={(v) => setField("Gender", v)} options={["Male","Female","Other"]} placeholder="Gender" />
                  <Inp type="date" value={candidateForm.DateOfBirth} onChange={(v) => setField("DateOfBirth", v)} placeholder="Date of Birth" />
                  <Sel value={candidateForm.MaritalStatus} onChange={(v) => setField("MaritalStatus", v)} options={["Single","Married","Divorced"]} placeholder="Marital Status" />
                </div>
              </FormSection>

              <FormSection title="Contact Details">
                <div style={styles.grid2}>
                  <Inp placeholder="Email ID *"      value={candidateForm.EmailId}          onChange={(v) => setField("EmailId", v)} required />
                  <Inp placeholder="Alternate Email" value={candidateForm.AlternateEmailId} onChange={(v) => setField("AlternateEmailId", v)} />
                  <Inp placeholder="Mobile Number *" value={candidateForm.MobileNo}         onChange={(v) => setField("MobileNo", v)} required />
                  <Inp placeholder="Alternate Mobile" value={candidateForm.AlternateMobileNo} onChange={(v) => setField("AlternateMobileNo", v)} />
                  <Inp placeholder="Emergency Contact Name" value={candidateForm.EmergencyContactName} onChange={(v) => setField("EmergencyContactName", v)} />
                  <Inp placeholder="Emergency Contact No"   value={candidateForm.EmergencyContactNo}  onChange={(v) => setField("EmergencyContactNo", v)} />
                  <Inp placeholder="Spouse Contact No"  value={candidateForm.SpouseContactNo}  onChange={(v) => setField("SpouseContactNo", v)} />
                  <Inp placeholder="Mother Contact No"  value={candidateForm.MotherContactNo}  onChange={(v) => setField("MotherContactNo", v)} />
                  <Inp placeholder="Father Contact No"  value={candidateForm.FatherContactNo}  onChange={(v) => setField("FatherContactNo", v)} />
                </div>
              </FormSection>

              <FormSection title="Address">
                <div style={styles.grid2}>
                  <Inp placeholder="Current Address" value={candidateForm.CurrentAddress} onChange={(v) => setField("CurrentAddress", v)} />
                  <Inp placeholder="City"            value={candidateForm.City}           onChange={(v) => setField("City", v)} />
                  <Inp placeholder="State"           value={candidateForm.State}          onChange={(v) => setField("State", v)} />
                  <Inp placeholder="Country"         value={candidateForm.Country}        onChange={(v) => setField("Country", v)} />
                </div>
              </FormSection>

              <FormSection title="Professional Information">
                <div style={styles.grid2}>
                  <Sel
    value={candidateForm.AppliedDepartment}
    onChange={(v) => {
        setField("AppliedDepartment", Number(v));
        setField("AppliedDesignation", "");
    }}
    options={departments}
    valueKey="id"
    labelKey="Department"
    placeholder="Applied Department *"
/>
                 <Inp
  placeholder="Applied Designation *"
  value={candidateForm.AppliedDesignation}
  onChange={(v) => setField("AppliedDesignation", v)}
  required
/>
                  <Inp placeholder="Current Company"     value={candidateForm.CurrentCompany}     onChange={(v) => setField("CurrentCompany", v)} />
                  <Inp placeholder="Current Designation" value={candidateForm.CurrentDesignation} onChange={(v) => setField("CurrentDesignation", v)} />
                  <Inp placeholder="Total Experience (Years)" value={candidateForm.TotalExperience} onChange={(v) => setField("TotalExperience", v)} />
                  <Inp placeholder="Current CTC"  value={candidateForm.CurrentCTC}  onChange={(v) => setField("CurrentCTC", v)} />
                  <Inp placeholder="Expected CTC" value={candidateForm.ExpectedCTC} onChange={(v) => setField("ExpectedCTC", v)} />
                  <Inp placeholder="Notice Period" value={candidateForm.NoticePeriod} onChange={(v) => setField("NoticePeriod", v)} />
                </div>
              </FormSection>

              <FormSection title="Hiring Information">
                <Sel
                  value={candidateForm.SourceOfHiring}
                  onChange={(v) => setField("SourceOfHiring", v)}
                  options={["Direct","LinkedIn","Naukri","Referral","Consultancy","Indeed","Website","Other"]}
                  placeholder="Source of Hiring"
                />
              </FormSection>

              <FormSection title="Attachments">
                <div style={styles.grid2}>
                  <div>
                    <label style={styles.fileLabel}>Resume (PDF) *</label>
                    <input type="file" accept=".pdf" style={styles.fileInput}
                      onChange={(e) => setField("ResumeFile", e.target.files[0])} required />
                  </div>
                  <div>
                    <label style={styles.fileLabel}>Profile Picture</label>
                    <input type="file" accept="image/*" style={styles.fileInput}
                      onChange={(e) => setField("Photo", e.target.files[0])} />
                  </div>
                </div>
              </FormSection>
            </div>

            <div style={styles.modalFoot}>
              <button style={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button style={{ ...styles.saveBtn, opacity: saving ? 0.75 : 1 }}
                onClick={handleAddCandidate} disabled={saving}>
                {saving ? "Saving…" : "Save Candidate"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ children }) {
  return <div style={{ background: "#f1f5f9", padding: "6px 12px", borderRadius: "999px", fontSize: "12px" }}>{children}</div>;
}

function StatCard({ title, value, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statTitle}>{title}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const st = STATUS_STYLE[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "600", background: st.bg, color: st.color }}>
      {status}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: { padding: "32px", background: C.bg, minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" },
  title: { margin: 0, fontSize: "28px", fontWeight: "700", color: C.text },
  subtitle: { color: C.muted, marginTop: "6px", fontSize: "14px" },
  addButton: { background: C.accent, color: "#fff", border: "none", padding: "12px 22px", borderRadius: RADIUS.button || "10px", cursor: "pointer", fontWeight: "600", boxShadow: "0 6px 16px rgba(214,58,110,0.22)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" },
  statCard: { background: C.card, padding: "20px", borderRadius: RADIUS.card || "14px", boxShadow: "0 4px 16px rgba(15,23,42,.06)", border: `1px solid ${C.borderLight}` },
  statValue: { fontSize: "28px", fontWeight: "700" },
  statTitle: { color: C.muted, fontSize: "13px", marginTop: "4px" },
  toolbar: { display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" },
  searchWrap: { flex: 1, maxWidth: "400px" },
  searchInput: { width: "100%", padding: "12px 16px", borderRadius: RADIUS.input || "10px", border: `1px solid ${C.borderLight}`, background: C.card, fontSize: "14px", color: C.text, outline: "none" },
  filterSelect: { padding: "11px 14px", borderRadius: RADIUS.input || "10px", border: `1px solid ${C.borderLight}`, background: C.card, fontSize: "14px", color: C.text },
  tableWrapper: { background: C.card, borderRadius: RADIUS.card, overflow: "hidden", boxShadow: SHADOW.card, border: `1px solid ${C.borderLight}` },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { background: "#f8fafc", padding: "14px 16px", textAlign: "left", fontWeight: "600", color: C.muted, fontSize: "12px", borderBottom: `2px solid ${C.borderLight}`, letterSpacing: "0.04em", textTransform: "uppercase" },
  td: { padding: "14px 16px", borderBottom: `1px solid ${C.borderLight}` },
  tr: {},
  candidateCell: { display: "flex", alignItems: "center", gap: "12px" },
  miniAvatar: { width: "36px", height: "36px", borderRadius: "50%", background: "#e8f4fa", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: C.primary, fontSize: "13px", flexShrink: 0 },
  avatarImg: { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 },
  name: { fontWeight: "600", color: C.text, fontSize: "14px" },
  email: { fontSize: "12px", color: C.muted, marginTop: "2px" },
  viewButton: { background: C.primary, color: "#fff", border: "none", padding: "7px 16px", borderRadius: RADIUS.button || "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" },
  loading: { padding: "80px", textAlign: "center", color: C.muted },
  empty: { textAlign: "center", padding: "60px", color: C.muted },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000 },
  drawer: { position: "fixed", top: 0, right: 0, width: "460px", height: "100vh", background: C.card, zIndex: 1002, boxShadow: "-12px 0 40px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column" },
  drawerHead: { position: "sticky", top: 0, background: C.card, zIndex: 10, padding: "18px 24px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  drawerTitle: { fontSize: "16px", fontWeight: "700", color: C.text },
  drawerBody: { flex: 1, padding: "24px", overflowY: "auto" },
  drawerHero: { display: "flex", alignItems: "center", gap: "16px", paddingBottom: "20px", borderBottom: `1px solid ${C.borderLight}`, marginBottom: "8px" },
  av: { width: "52px", height: "52px", borderRadius: "50%", background: C.inputBg, border: `2.5px solid ${C.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", color: C.primary, flexShrink: 0 },
  heroName: { fontSize: "16px", fontWeight: "700", color: C.text },
  heroSub: { fontSize: "12.5px", color: C.muted, marginTop: "2px" },
  addressBlock: { fontSize: "13px", color: C.text, lineHeight: "1.6", padding: "8px 0", borderBottom: `1px solid ${C.borderLight}` },
  drawerFoot: { padding: "16px 24px", borderTop: `1px solid ${C.borderLight}`, flexShrink: 0 },
  drawerSecondary: { width: "100%", padding: "10px", background: C.inputBg, color: C.text, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.button || "8px", fontSize: "13.5px", cursor: "pointer", fontWeight: "500" },
  iconBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: C.muted, padding: "4px" },
  resumeBtn: { marginTop: "16px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "10px 16px", borderRadius: "10px", fontWeight: "600", cursor: "pointer", width: "100%" },
  modal: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "90%", maxWidth: "820px", background: C.card, borderRadius: RADIUS.card, zIndex: 1001, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 48px rgba(0,0,0,0.18)" },
  modalTitle: { fontSize: "20px", fontWeight: "700", color: C.text, margin: 0 },
  modalSub: { fontSize: "13px", color: C.muted, marginTop: "4px" },
  modalHead: { padding: "20px 28px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 },
  modalBody: { padding: "24px 28px", overflowY: "auto", flex: 1 },
  modalFoot: { padding: "16px 28px", borderTop: `1px solid ${C.borderLight}`, display: "flex", gap: "12px", justifyContent: "flex-end", flexShrink: 0 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  inputElement: { width: "100%", padding: "10px 13px", border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.input || "8px", fontSize: "14px", background: C.inputBg, color: C.text, outline: "none", boxSizing: "border-box" },
  fileLabel: { display: "block", fontSize: "12.5px", fontWeight: "600", color: C.muted, marginBottom: "6px" },
  fileInput: { width: "100%", padding: "10px", border: `2px dashed ${C.borderLight}`, borderRadius: RADIUS.input || "8px", background: C.inputBg, fontSize: "13px", cursor: "pointer" },
  saveBtn: { padding: "11px 28px", background: C.accent, color: "#fff", border: "none", borderRadius: RADIUS.button || "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
  cancelBtn: { padding: "11px 20px", background: C.inputBg, color: C.text, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.button || "10px", fontSize: "14px", cursor: "pointer" },
};