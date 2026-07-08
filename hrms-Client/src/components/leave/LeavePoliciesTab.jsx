// LeavePoliciesTab.jsx
import React, { useState, useEffect } from "react";
import { C, RADIUS } from "../../theme";
import { apiUrl } from "../../URL";

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "12px",
      fontWeight: "700",
      color: C.primary,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: "14px",
      paddingBottom: "8px",
      borderBottom: `2px solid ${C.borderLight}`
    }}>
      {children}
    </div>
  );
}

function InfoBox({ type = "info", children }) {
  const map = {
    info:  { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
    success: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
    error: { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" },
  };
  const st = map[type];
  return (
    <div style={{
      padding: "10px 16px",
      borderRadius: "6px",
      marginBottom: "16px",
      background: st.bg,
      color: st.color,
      border: `1px solid ${st.border}`,
      fontSize: "13px"
    }}>
      {children}
    </div>
  );
}

const LEAVE_TYPES = [
  { value: "Casual", label: "Casual Leave", total: 7, description: "Yearly allocation (1.75 per quarter)" },
  { value: "Sick", label: "Sick Leave", total: 7, description: "Yearly allocation (1.75 per quarter)" },
  { value: "Earned", label: "Earned Leave", total: 14, description: "Accrues from unused Casual/Sick (max 3.5/quarter)" },
  { value: "Flexi", label: "Flexi Holiday", total: 2, description: "Yearly allocation (auto-approved)" },
  { value: "Maternity", label: "Maternity Leave", total: 180, description: "For female employees only" },
  { value: "LWP", label: "Leave Without Pay", total: null, description: "No fixed limit" },
];

export default function LeavePoliciesTab() {
  const token = localStorage.getItem("token");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fixed Holidays
  const [fixedHolidays, setFixedHolidays] = useState([]);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [newFixedHoliday, setNewFixedHoliday] = useState({ name: '', date: '' });

  // Flexi Holidays
  const [flexiHolidays, setFlexiHolidays] = useState([]);
  const [showAddFlexi, setShowAddFlexi] = useState(false);
  const [newFlexiHoliday, setNewFlexiHoliday] = useState({ name: '', date: '' });

  // Leave Policy Settings
  const [policy, setPolicy] = useState({
    CasualLeave: 7,
    SickLeave: 7,
    EarnedLeave: 14,
    QuarterlyEarned: 3.5,
    FlexiHoliday: 2,
    MaternityLeave: 180,
    MaxEarnedCarryForward: 14
  });
  const [policyLoading, setPolicyLoading] = useState(false);

  useEffect(() => {
    fetchFixedHolidays();
    fetchFlexiHolidays();
    fetchLeavePolicy();
  }, []);

  const fetchFixedHolidays = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/fixed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFixedHolidays(data);
      }
    } catch (err) {
      console.error("Error fetching fixed holidays:", err);
    }
  };

  const fetchFlexiHolidays = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/flexi/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFlexiHolidays(data);
      }
    } catch (err) {
      console.error("Error fetching flexi holidays:", err);
    }
  };

  const fetchLeavePolicy = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/leaves/leave-policy`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setPolicy({
            CasualLeave: data.CasualLeave || 7,
            SickLeave: data.SickLeave || 7,
            EarnedLeave: data.EarnedLeave || 14,
            QuarterlyEarned: data.QuarterlyEarned || 3.5,
            FlexiHoliday: data.FlexiHoliday || 2,
            MaternityLeave: data.MaternityLeave || 180,
            MaxEarnedCarryForward: data.MaxEarnedCarryForward || 14
          });
        }
      }
    } catch (err) {
      console.error("Error fetching leave policy:", err);
    }
  };

  // ─── Fixed Holidays ──────────────────────────────────────────────────────────

  const handleAddFixedHoliday = async (e) => {
    e.preventDefault();
    if (!newFixedHoliday.name || !newFixedHoliday.date) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/fixed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          holidayName: newFixedHoliday.name,
          holidayDate: newFixedHoliday.date,
          optional: null
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Fixed holiday added successfully!' });
        setNewFixedHoliday({ name: '', date: '' });
        setShowAddFixed(false);
        fetchFixedHolidays();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.message || 'Failed to add holiday' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFixedHoliday = async (id) => {
    if (!confirm('Are you sure you want to delete this fixed holiday?')) return;

    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/fixed/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Fixed holiday deleted successfully!' });
        fetchFixedHolidays();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.message || 'Failed to delete' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server error. Please try again.' });
    }
  };

  // ─── Flexi Holidays ──────────────────────────────────────────────────────────

  const handleAddFlexiHoliday = async (e) => {
    e.preventDefault();
    if (!newFlexiHoliday.name || !newFlexiHoliday.date) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/flexi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          holidayName: newFlexiHoliday.name,
          holidayDate: newFlexiHoliday.date
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Flexi holiday created successfully!' });
        setNewFlexiHoliday({ name: '', date: '' });
        setShowAddFlexi(false);
        fetchFlexiHolidays();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.message || 'Failed to create' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFlexiStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await fetch(`${apiUrl}/api/leaves/holidays/flexi/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Flexi holiday ${newStatus.toLowerCase()}d successfully!` });
        fetchFlexiHolidays();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleDeleteFlexiHoliday = async (id) => {
    if (!confirm('Are you sure you want to delete this flexi holiday?')) return;

    try {
      const res = await fetch(`${apiUrl}/api/holidays/flexi/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Flexi holiday deleted successfully!' });
        fetchFlexiHolidays();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.message || 'Failed to delete' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server error. Please try again.' });
    }
  };

  // ─── Save Policy ─────────────────────────────────────────────────────────────

  const handleSavePolicy = async () => {
    setPolicyLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${apiUrl}/api/leaves/leave-policy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(policy)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Leave policy updated successfully!' });
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.message || 'Failed to update policy' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Server error. Please try again.' });
    } finally {
      setPolicyLoading(false);
    }
  };

  return (
    <div>
      {message && <InfoBox type={message.type}>{message.text}</InfoBox>}

      {/* ─── Fixed Holidays ───────────────────────────────────────────────────── */}

      <div style={s.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Fixed Holidays</SectionLabel>
          <button
            onClick={() => setShowAddFixed(!showAddFixed)}
            style={s.addBtn}
          >
            {showAddFixed ? "Cancel" : "+ Add Fixed Holiday"}
          </button>
        </div>

        {showAddFixed && (
          <form onSubmit={handleAddFixedHoliday} style={s.addForm}>
            <div style={s.addFormRow}>
              <div style={s.addFormField}>
                <label style={s.addFormLabel}>Holiday Name</label>
                <input
                  type="text"
                  value={newFixedHoliday.name}
                  onChange={e => setNewFixedHoliday({ ...newFixedHoliday, name: e.target.value })}
                  placeholder="e.g., Holi, Diwali"
                  style={s.addFormInput}
                  required
                />
              </div>
              <div style={s.addFormField}>
                <label style={s.addFormLabel}>Date</label>
                <input
                  type="date"
                  value={newFixedHoliday.date}
                  onChange={e => setNewFixedHoliday({ ...newFixedHoliday, date: e.target.value })}
                  style={s.addFormInput}
                  required
                />
              </div>
              <div style={s.addFormAction}>
                <button
                  type="submit"
                  disabled={loading}
                  style={s.submitBtn}
                >
                  {loading ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </form>
        )}

        <div style={s.holidayList}>
          {fixedHolidays.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "20px" }}>
              No fixed holidays added yet.
            </div>
          ) : (
            fixedHolidays.map(h => (
              <div key={h.id} style={s.holidayItem}>
                <div>
                  <span style={s.holidayName}>{h.HolidayName}</span>
                  <span style={s.holidayDate}>{h.HolidayDate ? new Date(h.HolidayDate).toLocaleDateString() : h.date}</span>
                  {h.Optional && (
                    <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "999px", background: "#fffbeb", color: "#92400e", marginLeft: "8px" }}>
                      Optional
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteFixedHoliday(h.id)}
                  style={s.deleteBtn}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Flexi Holidays ───────────────────────────────────────────────────── */}

      <div style={s.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionLabel>Flexi Holidays</SectionLabel>
          <button
            onClick={() => setShowAddFlexi(!showAddFlexi)}
            style={s.addBtn}
          >
            {showAddFlexi ? "Cancel" : "+ Add Flexi Holiday"}
          </button>
        </div>

        {showAddFlexi && (
          <form onSubmit={handleAddFlexiHoliday} style={s.addForm}>
            <div style={s.addFormRow}>
              <div style={s.addFormField}>
                <label style={s.addFormLabel}>Holiday Name</label>
                <input
                  type="text"
                  value={newFlexiHoliday.name}
                  onChange={e => setNewFlexiHoliday({ ...newFlexiHoliday, name: e.target.value })}
                  placeholder="e.g., Holi, Diwali"
                  style={s.addFormInput}
                  required
                />
              </div>
              <div style={s.addFormField}>
                <label style={s.addFormLabel}>Date</label>
                <input
                  type="date"
                  value={newFlexiHoliday.date}
                  onChange={e => setNewFlexiHoliday({ ...newFlexiHoliday, date: e.target.value })}
                  style={s.addFormInput}
                  required
                />
              </div>
              <div style={s.addFormAction}>
                <button
                  type="submit"
                  disabled={loading}
                  style={s.submitBtn}
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </form>
        )}

        <div style={s.holidayList}>
          {flexiHolidays.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "20px" }}>
              No flexi holidays created yet.
            </div>
          ) : (
            flexiHolidays.map(h => (
              <div key={h.FlexiHolidayID} style={s.holidayItem}>
                <div>
                  <span style={s.holidayName}>{h.HolidayName}</span>
                  <span style={s.holidayDate}>{new Date(h.HolidayDate).toLocaleDateString()}</span>
                  <span style={{
                    fontSize: "11px",
                    padding: "2px 10px",
                    borderRadius: "999px",
                    marginLeft: "8px",
                    background: h.Status === 'Active' ? "#ecfdf5" : "#fef2f2",
                    color: h.Status === 'Active' ? "#065f46" : "#b91c1c",
                  }}>
                    {h.Status}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleToggleFlexiStatus(h.FlexiHolidayID, h.Status)}
                    style={{
                      padding: "4px 12px",
                      background: h.Status === 'Active' ? "#fef2f2" : "#ecfdf5",
                      color: h.Status === 'Active' ? "#b91c1c" : "#065f46",
                      border: `1px solid ${h.Status === 'Active' ? "#fca5a5" : "#6ee7b7"}`,
                      borderRadius: "4px",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    {h.Status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteFlexiHoliday(h.FlexiHolidayID)}
                    style={s.deleteBtn}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ fontSize: "12px", color: C.muted, marginTop: "8px" }}>
          Note: Flexi holidays are auto-approved when employees select them in their leave application.
        </div>
      </div>

      {/* ─── Leave Policy Settings ───────────────────────────────────────────── */}

      <div style={s.section}>
        <SectionLabel>Leave Allocation Settings</SectionLabel>
        
        <div style={s.policyGrid}>
          {LEAVE_TYPES.map(lt => (
            <div key={lt.value} style={s.policyItem}>
              <label style={s.policyLabel}>
                {lt.label}
                <span style={{ fontSize: "11px", color: C.muted, display: "block" }}>
                  {lt.description}
                </span>
              </label>
              <input
                type="number"
                style={s.policyInput}
                value={policy[lt.value] ?? 0}
                onChange={e => setPolicy({ ...policy, [lt.value]: parseFloat(e.target.value) })}
                disabled={lt.value === 'LWP'}
                placeholder={lt.value === 'LWP' ? "Unlimited" : ""}
                step="0.1"
              />
            </div>
          ))}
          <div style={s.policyItem}>
            <label style={s.policyLabel}>
              Quarterly Earned Max
              <span style={{ fontSize: "11px", color: C.muted, display: "block" }}>
                Max earned per quarter (Casual 1.75 + Sick 1.75)
              </span>
            </label>
            <input
              type="number"
              style={s.policyInput}
              value={policy.QuarterlyEarned}
              onChange={e => setPolicy({ ...policy, QuarterlyEarned: parseFloat(e.target.value) })}
              step="0.1"
            />
          </div>
          <div style={s.policyItem}>
            <label style={s.policyLabel}>
              Max Earned Carry Forward
              <span style={{ fontSize: "11px", color: C.muted, display: "block" }}>
                Maximum earned leave that can be carried forward
              </span>
            </label>
            <input
              type="number"
              style={s.policyInput}
              value={policy.MaxEarnedCarryForward}
              onChange={e => setPolicy({ ...policy, MaxEarnedCarryForward: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        <button
          onClick={handleSavePolicy}
          disabled={policyLoading}
          style={s.savePolicyBtn}
        >
          {policyLoading ? "Saving..." : "Save All Settings"}
        </button>
      </div>

      {/* ─── Approval Hierarchy ──────────────────────────────────────────────── */}

      <div style={s.section}>
        <SectionLabel>Approval Hierarchy</SectionLabel>
        <div style={s.hierarchyCard}>
          <div style={s.hierarchyItem}>
            <span style={s.hierarchyRule}>≤ 3 days</span>
            <span>Employee → Manager (team only)</span>
          </div>
          <div style={s.hierarchyItem}>
            <span style={s.hierarchyRule}>&gt; 3 days</span>
            <span>Employee → HR / Admin</span>
          </div>
          <div style={s.hierarchyItem}>
            <span style={s.hierarchyRule}>Maternity / LWP</span>
            <span>Employee → HR / Admin</span>
          </div>
          <div style={s.hierarchyItem}>
            <span style={s.hierarchyRule}>Flexi Holiday</span>
            <span style={{ color: "#065f46", fontWeight: "600" }}>Auto-Approved</span>
          </div>
          <div style={{ fontSize: "12px", color: C.muted, marginTop: "12px", borderTop: `1px solid ${C.borderLight}`, paddingTop: "12px" }}>
            <strong>Note:</strong> Managers can approve only their team members. HR and Admin can approve all requests.
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  section: {
    background: C.card,
    border: `1px solid ${C.borderLight}`,
    borderRadius: RADIUS.card,
    padding: "20px",
    marginBottom: "24px"
  },
  addBtn: {
    padding: "6px 14px",
    background: C.primary,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  addForm: {
    background: C.inputBg,
    padding: "16px",
    borderRadius: RADIUS.input,
    marginBottom: "16px"
  },
  addFormRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap"
  },
  addFormField: {
    flex: 1,
    minWidth: "180px"
  },
  addFormLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: C.muted,
    display: "block",
    marginBottom: "4px"
  },
  addFormInput: {
    width: "100%",
    padding: "8px 12px",
    border: `1.5px solid ${C.borderLight}`,
    borderRadius: "6px",
    fontSize: "13px",
    background: C.card,
    color: C.text,
    outline: "none"
  },
  addFormAction: {
    display: "flex",
    alignItems: "flex-end"
  },
  submitBtn: {
    padding: "8px 20px",
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    height: "fit-content"
  },
  holidayList: {
    marginTop: "8px"
  },
  holidayItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: `1px solid ${C.borderLight}`,
    flexWrap: "wrap",
    gap: "8px"
  },
  holidayName: {
    fontWeight: "500",
    color: C.text,
    marginRight: "12px"
  },
  holidayDate: {
    fontSize: "13px",
    color: C.muted
  },
  deleteBtn: {
    padding: "4px 12px",
    background: "#fef2f2",
    color: "#b91c1c",
    border: `1px solid #fca5a5`,
    borderRadius: "4px",
    fontSize: "11px",
    cursor: "pointer"
  },
  policyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "16px"
  },
  policyItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  policyLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: C.text
  },
  policyInput: {
    width: "100%",
    padding: "8px 12px",
    border: `1.5px solid ${C.borderLight}`,
    borderRadius: "6px",
    fontSize: "13px",
    background: C.inputBg,
    color: C.text,
    outline: "none"
  },
  savePolicyBtn: {
    padding: "10px 24px",
    background: C.primary,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer"
  },
  hierarchyCard: {
    background: C.inputBg,
    borderRadius: RADIUS.input,
    padding: "16px"
  },
  hierarchyItem: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "8px 0",
    borderBottom: `1px solid ${C.borderLight}`,
    fontSize: "13px"
  },
  hierarchyRule: {
    fontWeight: "600",
    color: C.primary,
    minWidth: "100px"
  }
};