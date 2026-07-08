import React, { useState, useMemo, useEffect } from "react";
import { C, RADIUS } from "../../theme";
import { apiUrl } from "../../URL";

const ALL_LEAVE_TYPES = [
  { value: "Casual",    label: "Casual Leave",       color: "#0c447c", total: 7   },
  { value: "Sick",      label: "Sick Leave",          color: "#993556", total: 7   },
  { value: "Earned",    label: "Earned Leave",        color: "#085041", total: 14  },
  { value: "Flexi",     label: "Flexi Holiday",       color: "#633806", total: 2   },
  { value: "LWP",       label: "Leave Without Pay",   color: "#5f5e5a", total: null},
  { value: "Maternity", label: "Maternity Leave",     color: "#72243e", total: 180 },
];

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const d1 = new Date(from), d2 = new Date(to);
  if (d2 < d1) return 0;
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "12px", fontWeight: "700", color: C.primary,
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: "14px", paddingBottom: "8px", borderBottom: `2px solid ${C.borderLight}`,
    }}>
      {children}
    </div>
  );
}

function InfoBox({ type = "info", children }) {
  const map = {
    info:  { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe", icon: "ℹ" },
    warn:  { bg: "#fffbeb", color: "#92400e", border: "#fcd34d", icon: "⚠" },
    error: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", icon: "✕" },
  };
  const st = map[type];
  return (
    <div style={{
      display: "flex", gap: "12px", padding: "12px 16px",
      borderRadius: RADIUS.input, background: st.bg,
      border: `1px solid ${st.border}`, color: st.color,
      fontSize: "13px", marginBottom: "16px", alignItems: "flex-start",
    }}>
      <span style={{ fontSize: "15px", flexShrink: 0, fontWeight: "700" }}>{st.icon}</span>
      <span style={{ lineHeight: "1.5" }}>{children}</span>
    </div>
  );
}

function ApprovalWorkflow({ days, leaveType }) {
  const needsHR = days > 3 || ["Maternity", "LWP"].includes(leaveType);
  const steps = needsHR ? ["You", "HR/Admin"] : ["You", "Manager"];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "12px 16px", background: C.inputBg,
      borderRadius: RADIUS.input, border: `1px solid ${C.borderLight}`,
      marginBottom: "16px", flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "13px", fontWeight: "600", color: C.text, marginRight: "4px" }}>
        Approval path:
      </span>
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <span style={{
            padding: "4px 12px", borderRadius: "6px",
            background: C.card, border: `1px solid ${C.borderLight}`,
            fontSize: "12px", fontWeight: "500", color: C.text,
          }}>
            {step}
          </span>
          {i < steps.length - 1 && <span style={{ color: C.muted }}>→</span>}
        </React.Fragment>
      ))}
      {leaveType === "Flexi" && (
        <span style={{ fontSize: "12px", color: "#065f46", marginLeft: "4px", fontWeight: "600" }}>
          (Auto-approved)
        </span>
      )}
      {needsHR && leaveType !== "Flexi" && (
        <span style={{ fontSize: "12px", color: "#92400e", marginLeft: "4px" }}>
          (requires HR/Admin approval)
        </span>
      )}
    </div>
  );
}

const Required = () => <span style={{ color: "#dc2626" }}>*</span>;
const ErrMsg   = ({ children }) => (
  <span style={{ fontSize: "12px", color: "#dc2626", marginTop: "2px" }}>{children}</span>
);

export default function ApplyLeaveTab({ onSubmit, gender, balances = {} }) {
  const isFemale = gender?.toLowerCase() === "female";
  const token = localStorage.getItem("token");

  const [flexiHolidays, setFlexiHolidays] = useState([]);
  const [loadingFlexi, setLoadingFlexi] = useState(false);

  const fetchFlexiHolidays = async () => {
    try {
      setLoadingFlexi(true);
      const res = await fetch(`${apiUrl}/api/leaves/holidays/flexi/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        setFlexiHolidays([]);
        return;
      }
      const data = await res.json();
      setFlexiHolidays(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching flexi holidays:", err);
      setFlexiHolidays([]);
    } finally {
      setLoadingFlexi(false);
    }
  };

  useEffect(() => {
    fetchFlexiHolidays();
  }, []);

  const leaveTypes = useMemo(() => {
    return ALL_LEAVE_TYPES
      .filter(lt => {
        if (lt.value === "Maternity") return isFemale;
        return true;
      })
      .map(lt => {
        const bal = Number(balances[lt.value] ?? 0);
        const disabled = lt.total !== null && lt.value !== "LWP" && lt.value !== "Maternity" && bal <= 0;
        return { ...lt, balance: bal, disabled };
      });
  }, [isFemale, balances]);

  const [form, setForm] = useState({
    leaveType: "", halfDay: "Full",
    fromDate: "", toDate: "",
    reason: "", attachment: null,
    flexiSelected: "",
    emergencyContact: "", contactNumber: "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const calculateDays = () => {
    if (form.leaveType === "Flexi") return 1;
    if (form.halfDay !== "Full") return 0.5;
    return daysBetween(form.fromDate, form.toDate);
  };

  const days = calculateDays();
  const isSickLong = form.leaveType === "Sick" && days > 2;
  const needsDoc = isSickLong;

  const validate = () => {
    const e = {};
    if (!form.leaveType) e.leaveType = "Select a leave type";

    if (form.leaveType !== "Flexi") {
      if (!form.fromDate) e.fromDate = "Required";
      if (!form.toDate) e.toDate = "Required";
      if (form.fromDate && form.toDate && new Date(form.toDate) < new Date(form.fromDate)) {
        e.toDate = "Must be after from date";
      }
    }

    if (!form.reason.trim()) e.reason = "Reason is required";

    if (form.leaveType === "Flexi" && !form.flexiSelected) {
      e.flexiSelected = "Select a flexi holiday";
    }

    if (needsDoc && !form.attachment)
      e.attachment = "Doctor's prescription required";

    if (form.leaveType && days > 0) {
      const lt = leaveTypes.find(l => l.value === form.leaveType);
      if (lt && lt.total !== null && lt.value !== "Maternity") {
        const bal = Number(balances[form.leaveType] || 0);
        if (bal < days) {
          e.leaveType = `Insufficient balance. Available: ${bal} days`;
        }
      }
    }

    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    
    let submitData = {
      leaveType: form.leaveType,
      reason: form.reason,
      emergencyContact: form.emergencyContact || "",
      contactNumber: form.contactNumber || "",
      attachment: form.attachment,
    };

    if (form.leaveType === "Flexi") {
      const selectedHoliday = flexiHolidays.find(
        (h) => String(h.FlexiHolidayID) === String(form.flexiSelected)
      );
      
      if (selectedHoliday) {
        // Crucial fix: Format date into YYYY-MM-DD cleanly so backend new Date() handles it safely
        const dateObj = new Date(selectedHoliday.HolidayDate);
        const formattedDate = dateObj.toISOString().split('T')[0];

        submitData.fromDate = formattedDate;
        submitData.toDate = formattedDate;
        submitData.halfDay = "Full";
        submitData.flexiSelected = selectedHoliday.FlexiHolidayID; 
      }
    } else {
      submitData.fromDate = form.fromDate;
      submitData.toDate = form.toDate;
      submitData.halfDay = form.halfDay;
    }

    onSubmit(submitData); 
  };
  
  const selectedType = leaveTypes.find(l => l.value === form.leaveType);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SectionLabel>Apply for Leave</SectionLabel>

      <div style={{ ...s.field, marginBottom: "16px" }}>
        <label style={s.label}>Leave Type <Required /></label>
        <select
          style={{ ...s.input, borderColor: errors.leaveType ? "#dc2626" : undefined }}
          value={form.leaveType}
          onChange={e => set("leaveType", e.target.value)}
        >
          <option value="">Select leave type…</option>
          ={leaveTypes.map(lt => (
            <option key={lt.value} value={lt.value} disabled={lt.disabled}>
              {lt.label}
              {lt.total !== null && lt.value !== "Maternity"
                ? ` (${lt.balance} days left)`
                : lt.value === "LWP" ? " (no limit)" : ""}
              {lt.disabled ? " — no balance" : ""}
            </option>
          ))}
        </select>
        {errors.leaveType && <ErrMsg>{errors.leaveType}</ErrMsg>}
      </div>

      {form.leaveType === "Flexi" && (
        <div style={{ marginBottom: "16px" }}>
          <label style={s.label}>Select Flexi Holiday <Required /></label>
          {loadingFlexi ? (
            <div style={{ padding: "10px", color: C.muted }}>Loading flexi holidays...</div>
          ) : flexiHolidays.length === 0 ? (
            <div style={{ padding: "10px", color: "#92400e", background: "#fffbeb", borderRadius: RADIUS.input }}>
              No active flexi holidays available. Please contact HR.
            </div>
          ) : (
            <select
              style={{ ...s.input, borderColor: errors.flexiSelected ? "#dc2626" : undefined }}
              value={form.flexiSelected}
              onChange={e => set("flexiSelected", e.target.value)}
            >
              <option value="">Select a flexi holiday…</option>
              {flexiHolidays.map(h => (
                <option key={h.FlexiHolidayID} value={h.FlexiHolidayID}>
                  {h.HolidayName} ({new Date(h.HolidayDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
          {errors.flexiSelected && <ErrMsg>{errors.flexiSelected}</ErrMsg>}
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "4px" }}>
            Flexi holidays are single-day leaves and are auto-approved.
          </div>
        </div>
      )}

      {form.leaveType !== "Flexi" && (
        <div style={s.grid3}>
          <div style={s.field}>
            <label style={s.label}>From Date <Required /></label>
            <input
              type="date"
              style={{ ...s.input, borderColor: errors.fromDate ? "#dc2626" : undefined }}
              value={form.fromDate}
              onChange={e => set("fromDate", e.target.value)}
            />
            {errors.fromDate && <ErrMsg>{errors.fromDate}</ErrMsg>}
          </div>
          <div style={s.field}>
            <label style={s.label}>To Date <Required /></label>
            <input
              type="date"
              style={{ ...s.input, borderColor: errors.toDate ? "#dc2626" : undefined }}
              value={form.toDate}
              onChange={e => set("toDate", e.target.value)}
            />
            {errors.toDate && <ErrMsg>{errors.toDate}</ErrMsg>}
          </div>
          <div style={s.field}>
            <label style={s.label}>Day Type</label>
            <select style={s.input} value={form.halfDay} onChange={e => set("halfDay", e.target.value)}>
              <option value="Full">Full Day</option>
              <option value="First">First Half</option>
              <option value="Second">Second Half</option>
            </select>
          </div>
        </div>
      )}

      {form.leaveType === "Flexi" && form.flexiSelected && (
        <div style={{ ...s.field, marginBottom: "16px" }}>
          <label style={s.label}>Selected Date</label>
          <div style={{
            padding: "10px 14px", background: C.inputBg,
            borderRadius: RADIUS.input, border: `1px solid ${C.borderLight}`,
            fontSize: "14px", color: C.text
          }}>
            {flexiHolidays.find(h => String(h.FlexiHolidayID) === String(form.flexiSelected))?.HolidayName || "Selected"} 
            {" - "}
            {flexiHolidays.find(h => String(h.FlexiHolidayID) === String(form.flexiSelected))?.HolidayDate 
               ? new Date(flexiHolidays.find(h => String(h.FlexiHolidayID) === String(form.flexiSelected)).HolidayDate).toLocaleDateString() 
               : ""}
          </div>
        </div>
      )}

      {days > 0 && form.leaveType && (
        <>
          <InfoBox type="info">
            <strong>{days} day{days !== 1 ? "s" : ""}</strong> — {selectedType?.label || form.leaveType}
            {selectedType?.total !== null && selectedType?.value !== "Maternity" && (
              <span style={{ marginLeft: "8px", opacity: 0.8 }}>
                (Balance after: {Math.max(0, Number(balances[form.leaveType] || 0) - days)} days)
              </span>
            )}
          </InfoBox>
          <ApprovalWorkflow days={days} leaveType={form.leaveType} />
        </>
      )}

      {isSickLong && (
        <InfoBox type="warn">
          Sick leave exceeding 2 days requires a doctor's prescription. Please upload it below.
        </InfoBox>
      )}
      {form.leaveType === "Maternity" && (
        <InfoBox type="info">
          Maternity leave is 180 days. HR will contact you to confirm your expected delivery date.
        </InfoBox>
      )}
      {form.leaveType === "LWP" && (
        <InfoBox type="warn">
          Leave Without Pay is only approved when all other leave balances are exhausted.
        </InfoBox>
      )}

      <div style={s.grid2}>
        <div style={s.field}>
          <label style={s.label}>Emergency Contact</label>
          <input
            type="text" style={s.input} placeholder="Name"
            value={form.emergencyContact}
            onChange={e => set("emergencyContact", e.target.value)}
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Contact Number</label>
          <input
            type="tel" style={s.input} placeholder="Phone number"
            value={form.contactNumber}
            onChange={e => set("contactNumber", e.target.value)}
          />
        </div>
      </div>

      <div style={{ ...s.field, marginBottom: "16px" }}>
        <label style={s.label}>Reason <Required /></label>
        <textarea
          rows={3}
          style={{ ...s.textarea, borderColor: errors.reason ? "#dc2626" : undefined }}
          placeholder="Briefly describe the reason for your leave…"
          value={form.reason}
          onChange={e => set("reason", e.target.value)}
        />
        {errors.reason && <ErrMsg>{errors.reason}</ErrMsg>}
      </div>

      {needsDoc && (
        <div style={{ ...s.field, marginBottom: "20px" }}>
          <label style={s.label}>Doctor's Prescription <Required /></label>
          <input
            type="file" style={s.input}
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => set("attachment", e.target.files[0] || null)}
          />
          {errors.attachment && <ErrMsg>{errors.attachment}</ErrMsg>}
          {form.attachment && (
            <div style={{
              marginTop: "8px", fontSize: "13px", display: "flex", alignItems: "center",
              gap: "10px", padding: "10px 14px", background: C.inputBg,
              borderRadius: RADIUS.input, border: `1px solid ${C.borderLight}`,
            }}>
              <span style={{ fontWeight: "500" }}>📎 {form.attachment.name}</span>
              <span
                style={{ color: "#dc2626", cursor: "pointer", marginLeft: "auto", fontWeight: "600", fontSize: "12px" }}
                onClick={() => set("attachment", null)}
              >
                Remove
              </span>
            </div>
          )}
        </div>
      )}

      <button type="submit" style={s.submitBtn}>Submit Application</button>
    </form>
  );
}

const s = {
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  grid3:     { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" },
  field:     { display: "flex", flexDirection: "column", gap: "6px" },
  label:     { fontSize: "13px", fontWeight: "600", color: C.text },
  input:     { width: "100%", padding: "10px 14px", border: `1.5px solid ${C.borderLight}`, borderRadius: RADIUS.input, fontSize: "14px", background: C.inputBg, color: C.text, outline: "none", boxSizing: "border-box" },
  textarea:  { width: "100%", padding: "10px 14px", border: `1.5px solid ${C.borderLight}`, borderRadius: RADIUS.input, fontSize: "14px", background: C.inputBg, color: C.text, outline: "none", resize: "vertical", fontFamily: "inherit", minHeight: "80px", boxSizing: "border-box" },
  submitBtn: { marginTop: "8px", padding: "12px 32px", background: C.accent, color: "#fff", border: "none", borderRadius: RADIUS.button, fontSize: "14px", fontWeight: "600", cursor: "pointer" },
};