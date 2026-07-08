// BalanceCards.jsx
import React from "react";
import { C, RADIUS } from "../../theme";

const LEAVE_CONFIG = [
  { key: "Casual",    label: "Casual Leave",     total: 7,   color: "#0c447c" },
  { key: "Sick",      label: "Sick Leave",        total: 7,   color: "#993556" },
  { key: "Earned",    label: "Earned Leave",      total: 14,  color: "#085041" },
  { key: "Flexi",     label: "Flexi Holiday",     total: 2,   color: "#633806" },
  { key: "Maternity", label: "Maternity Leave",   total: 180, color: "#72243e" },
  { key: "LWP",       label: "Leave Without Pay", total: null,color: "#5f5e5a" },
];

export default function BalanceCards({ balances, gender }) {
  const isFemale = gender?.toLowerCase() === "female";

  const visible = LEAVE_CONFIG.filter(lt => {
    if (lt.key === "Maternity") return isFemale;
    return balances[lt.key] !== undefined;
  });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "12px",
      marginBottom: "24px",
    }}>
      {visible.map(lt => {
        const remaining = Number(balances[lt.key] ?? 0);
        const used = lt.total !== null ? Math.max(0, lt.total - remaining) : 0;
        const pct = lt.total ? Math.min(100, Math.round((used / lt.total) * 100)) : 0;

        return (
          <div key={lt.key} style={{
            background: C.card,
            border: `1px solid ${C.borderLight}`,
            borderRadius: RADIUS.card,
            padding: "16px 14px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: C.muted, marginBottom: "6px" }}>
              {lt.label}
            </div>

            <div style={{ fontSize: "30px", fontWeight: "700", color: lt.color, lineHeight: 1 }}>
              {lt.total === null ? "—" : remaining.toFixed(1)}
            </div>

            <div style={{ fontSize: "11px", color: C.muted, marginTop: "4px" }}>
              {lt.total === null
                ? "No fixed limit"
                : `${used.toFixed(1)} used · ${lt.total} total`}
              {lt.key === "Earned" && (
                <span style={{ display: "block", color: "#085041", marginTop: "2px" }}>
                  Accrues from unused Casual/Sick
                </span>
              )}
              {lt.key === "Flexi" && (
                <span style={{ display: "block", color: "#633806", marginTop: "2px" }}>
                  Auto-approved
                </span>
              )}
            </div>

            {lt.total !== null && (
              <div style={{
                height: "4px", background: C.borderLight,
                borderRadius: "4px", marginTop: "10px", overflow: "hidden"
              }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: pct > 80 ? "#dc2626" : lt.color,
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}