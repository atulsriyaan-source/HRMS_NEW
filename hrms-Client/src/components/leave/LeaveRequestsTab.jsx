import React, { useMemo } from "react";
import { C } from "../../theme";

const LEAVE_TYPE_LABELS = {
  Casual: "Casual Leave", Sick: "Sick Leave", Earned: "Earned Leave",
  Flexi: "Flexi Holiday", LWP: "Leave Without Pay", Maternity: "Maternity Leave",
};

const STATUS_STYLE = {
  Pending:           { bg: "#fffbeb", color: "#92400e" },
  Approved:          { bg: "#ecfdf5", color: "#065f46" },
  Rejected:          { bg: "#fef2f2", color: "#b91c1c" },
  "Forwarded to HR": { bg: "#eff6ff", color: "#1e40af" },
};

function StatusPill({ status }) {
  const st = STATUS_STYLE[status] ?? STATUS_STYLE.Pending;
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: "999px",
      fontSize: "12px", fontWeight: "600", background: st.bg, color: st.color,
    }}>
      {status}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: "12px", fontWeight: "700", color: C.primary,
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: "14px", paddingBottom: "8px", borderBottom: `2px solid ${C.borderLight}`
    }}>
      {children}
    </div>
  );
}

export default function LeaveRequestsTab({ 
  requests = [], 
  onApprove, 
  onReject, 
  onViewDetails,
  userRole // Formally accepted parameter to clear parent call bindings safely
}) {
  const pendingRequests = useMemo(() => requests.filter(r => r.status === "Pending"), [requests]);
  const historyRequests = useMemo(() => requests.filter(r => r.status !== "Pending"), [requests]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Pending Global Tracker Sub-Section */}
      <div>
        <SectionLabel>All Global Pending Requests</SectionLabel>
        {pendingRequests.length === 0 ? (
          <div style={s.empty}>No global pending leave requests found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>Duration</Th>
                  <Th>Days</Th>
                  <Th>Reason</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map(r => (
                  <tr key={r.id}>
                    <Td style={{ fontWeight: "600" }}>{r.employeeName}</Td>
                    <Td>{LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}</Td>
                    <Td>{new Date(r.fromDate).toLocaleDateString()} - {new Date(r.toDate).toLocaleDateString()}</Td>
                    <Td style={{ fontWeight: "600" }}>{r.days}</Td>
                    <Td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button style={s.approveBtn} onClick={() => onApprove?.(r)}>Approve</button>
                        <button style={s.rejectBtn} onClick={() => onReject?.(r)}>Reject</button>
                        <button style={s.viewBtn} onClick={() => onViewDetails?.(r)}>View</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global History Sub-Section */}
      <div>
        <SectionLabel>Processed Leave History</SectionLabel>
        {historyRequests.length === 0 ? (
          <div style={s.empty}>No processed history available.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Type</Th>
                  <Th>Duration</Th>
                  <Th>Days</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {historyRequests.map(r => (
                  <tr key={r.id}>
                    <Td style={{ fontWeight: "600" }}>{r.employeeName}</Td>
                    <Td>{LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType}</Td>
                    <Td>{new Date(r.fromDate).toLocaleDateString()} - {new Date(r.toDate).toLocaleDateString()}</Td>
                    <Td style={{ fontWeight: "600" }}>{r.days}</Td>
                    <Td><StatusPill status={r.status} /></Td>
                    <Td><button style={s.viewBtn} onClick={() => onViewDetails?.(r)}>View</button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const Th = ({ children, style }) => (
  <th style={{
    textAlign: "left", padding: "12px", background: C.inputBg,
    borderBottom: `2px solid ${C.borderLight}`, fontSize: "12px",
    fontWeight: "600", color: C.muted, whiteSpace: "nowrap", ...style
  }}>{children}</th>
);

const Td = ({ children, style }) => (
  <td style={{ padding: "12px", borderBottom: `1px solid ${C.borderLight}`, fontSize: "13px", color: C.text, ...style }}>
    {children}
  </td>
);

const s = {
  table:      { width: "100%", borderCollapse: "collapse" },
  approveBtn: { padding: "5px 12px", background: "#ecfdf5", color: "#065f46", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  rejectBtn:  { padding: "5px 12px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  viewBtn:    { padding: "5px 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  empty:      { textAlign: "center", color: C.muted, padding: "24px", border: `1px dashed ${C.borderLight}`, borderRadius: "8px" }
};