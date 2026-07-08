import React, { useState, useEffect } from "react";
import { C, RADIUS } from "../../theme";
import { apiUrl } from "../../URL";

// Reliable fallback for standard mandatory public holidays in case backend route is missing
const DEFAULT_FIXED_HOLIDAYS = [
  { HolidayID: "f1", HolidayName: "New Year's Day", HolidayDate: "2026-01-01", HolidayType: "Fixed" },
  { HolidayID: "f2", HolidayName: "Republic Day", HolidayDate: "2026-01-26", HolidayType: "Fixed" },
  { HolidayID: "f3", HolidayName: "Independence Day", HolidayDate: "2026-08-15", HolidayType: "Fixed" },
  { HolidayID: "f4", HolidayName: "Mahatma Gandhi Jayanti", HolidayDate: "2026-10-02", HolidayType: "Fixed" },
  { HolidayID: "f5", HolidayName: "Christmas Day", HolidayDate: "2026-12-25", HolidayType: "Fixed" }
];

export default function HolidaysTab({ flexiSelected = [] }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchAllHolidays = async () => {
      try {
        setLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        // 1. Fetch Flexi Holidays (Confirmed working endpoint)
        let flexiData = [];
        try {
          const flexiRes = await fetch(`${apiUrl}/api/leaves/holidays/flexi/active`, { headers });
          if (flexiRes.ok) {
            const data = await flexiRes.json();
            flexiData = (Array.isArray(data) ? data : []).map(h => ({
              ...h,
              HolidayType: "Flexi",
              HolidayID: h.HolidayID || h.FlexiHolidayID,
              HolidayName: h.HolidayName,
              HolidayDate: h.HolidayDate
            }));
          }
        } catch (err) {
          console.error("Failed to fetch flexi holidays:", err);
        }

        // 2. Fetch Fixed Holidays 
        let fixedData = [];
        try {
          // Trying common clean route structure pattern
          const fixedRes = await fetch(`${apiUrl}/api/leaves/holidays/fixed`, { headers });
          if (fixedRes.ok) {
            const data = await fixedRes.json();
            fixedData = (Array.isArray(data) ? data : []).map(h => ({ ...h, HolidayType: "Fixed" }));
          } else {
            // If API responds with 404, safely adopt baseline fixed calendar dates
            console.warn("Fixed holiday route missing; using default public holiday schedule.");
            fixedData = DEFAULT_FIXED_HOLIDAYS;
          }
        } catch (err) {
          console.error("Failed to fetch fixed holidays from API:", err);
          fixedData = DEFAULT_FIXED_HOLIDAYS;
        }

        // Merge arrays cleanly
        setHolidays([...fixedData, ...flexiData]);
      } catch (err) {
        console.error("General holiday loading process encountered an error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllHolidays();
  }, [token]);

  // Apply filtering rules down to view state
  const visibleHolidays = holidays.filter((holiday) => {
    if (holiday.HolidayType === "Fixed") {
      return true;
    }
    if (holiday.HolidayType === "Flexi") {
      const idToCheck = holiday.HolidayID || holiday.FlexiHolidayID;
      return flexiSelected.map(String).includes(String(idToCheck));
    }
    return true; 
  });

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>Loading holiday calendar...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 4px 0", color: C.text, fontSize: "16px", fontWeight: "600" }}>
          Holiday Calendar 2026
        </h3>
        <p style={{ margin: 0, color: C.muted, fontSize: "13px" }}>
          Showing your structural company mandates alongside personal floating options.
        </p>
      </div>

      {visibleHolidays.length === 0 ? (
        <div style={{ padding: "30px", textAlign: "center", color: C.muted, background: C.inputBg, borderRadius: RADIUS.input }}>
          No calendar events matches the criteria.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visibleHolidays.map((holiday) => {
            const isFixed = holiday.HolidayType === "Fixed";
            const targetId = holiday.HolidayID || holiday.FlexiHolidayID;
            
            return (
              <div
                key={`${holiday.HolidayType}-${targetId}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: isFixed ? C.card : "#f0fdf4", 
                  border: `1px solid ${isFixed ? C.borderLight : "#bbf7d0"}`,
                  borderRadius: RADIUS.input,
                }}
              >
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: C.text }}>
                    {holiday.HolidayName}
                  </div>
                  <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
                    {new Date(holiday.HolidayDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    letterSpacing: "0.05em",
                    background: isFixed ? "#eff6ff" : "#dcfce7",
                    color: isFixed ? "#1e40af" : "#15803d",
                    border: `1px solid ${isFixed ? "#bfdbfe" : "#bbf7d0"}`,
                  }}
                >
                  {isFixed ? "Fixed Mandate" : "Selected Flexi"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}