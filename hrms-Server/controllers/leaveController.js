const db = require("../config/db");

// ─── Helper Functions ──────────────────────────────────────────────────────────

const floorInt = (val) => Math.floor(Number(val || 0));
const roundHalf = (val) => Math.round(Number(val) * 2) / 2;

async function getLeavePolicy() {
  const [rows] = await db.query(
    `SELECT * FROM leave_policy ORDER BY PolicyID DESC LIMIT 1`
  );
  if (!rows.length) {
    throw new Error("Leave policy not configured.");
  }
  return rows[0];
}

async function ensureBalanceRow(employeeId, year, gender) {
  const [rows] = await db.query(
    `SELECT id FROM leave_balance WHERE EmployeeId = ? AND Year = ?`,
    [employeeId, year]
  );
  if (rows.length) return;

  const policy = await getLeavePolicy();
  await db.query(
    `INSERT INTO leave_balance
    (EmployeeId, Year, CasualLeave, SickLeave, EarnedLeave, FlexiHoliday, MaternityLeave)
    VALUES (?,?,?,?,?,?,?)`,
    [
      employeeId, year,
      policy.CasualLeave,
      policy.SickLeave,
      0,
      policy.FlexiHoliday,
      gender?.toLowerCase() === "female" ? policy.MaternityLeave : 0
    ]
  );
}

/**
 * Earned leave accrual — credited quarterly based on unused Casual and Sick leaves
 * 
 * Rule: For each quarter, unused Casual and Sick leave converts to Earned Leave.
 * Quarterly allocation: Casual 7/4 = 1.75, Sick 7/4 = 1.75
 * Total possible earned per quarter: 3.5 days
 * Maximum earned: 14 days (can carry forward)
 */
async function calculateAndCreditEarnedLeave(employeeId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  // Nothing to credit in Q1
  if (quarter === 1) return;

  // Credit previous completed quarter
  const creditQuarter = quarter - 1;

  // Already credited?
  const [already] = await db.query(
    `SELECT EarnedLogID FROM earned_leave_log
     WHERE EmployeeID = ? AND Year = ? AND Quarter = ?`,
    [employeeId, year, creditQuarter]
  );
  if (already.length) return;

  // Get leave policy
  const [policyRows] = await db.query(
    `SELECT CasualLeave, SickLeave, EarnedLeave
     FROM leave_policy ORDER BY PolicyID DESC LIMIT 1`
  );
  
  const yearlyCasual = Number(policyRows[0]?.CasualLeave || 7);
  const yearlySick = Number(policyRows[0]?.SickLeave || 7);
  const yearlyLimit = Number(policyRows[0]?.EarnedLeave || 14);
  
  // Quarterly allocation
  const quarterlyCasual = yearlyCasual / 4; // 1.75
  const quarterlySick = yearlySick / 4; // 1.75

  // Quarter Month Range
  let startMonth = 1, endMonth = 3;
  if (creditQuarter === 2) { startMonth = 4; endMonth = 6; }
  if (creditQuarter === 3) { startMonth = 7; endMonth = 9; }
  if (creditQuarter === 4) { startMonth = 10; endMonth = 12; }

  // Get Casual and Sick leaves taken in the quarter (Approved ones)
  const [taken] = await db.query(
    `SELECT LeaveType, SUM(Days) as total
     FROM leave_requests
     WHERE EmployeeID = ?
     AND Status = 'Approved'
     AND LeaveType IN ('Casual','Sick')
     AND YEAR(FromDate) = ?
     AND MONTH(FromDate) BETWEEN ? AND ?
     GROUP BY LeaveType`,
    [employeeId, year, startMonth, endMonth]
  );

  let usedCasual = 0;
  let usedSick = 0;
  taken.forEach(row => {
    if (row.LeaveType === 'Casual') usedCasual = Number(row.total || 0);
    if (row.LeaveType === 'Sick') usedSick = Number(row.total || 0);
  });

  // Calculate unused days that convert to earned
  const unusedCasual = Math.max(0, quarterlyCasual - usedCasual);
  const unusedSick = Math.max(0, quarterlySick - usedSick);
  const earnedToCredit = unusedCasual + unusedSick;

  if (earnedToCredit <= 0) return;

  // Get current earned balance
  const [balanceRows] = await db.query(
    `SELECT EarnedLeave FROM leave_balance WHERE EmployeeId = ? AND Year = ?`,
    [employeeId, year]
  );
  const currentEarned = Number(balanceRows[0]?.EarnedLeave || 0);

  // Don't exceed yearly limit
  const credit = Math.min(earnedToCredit, yearlyLimit - currentEarned);
  if (credit <= 0) return;

  // Credit Earned Leave
  await db.query(
    `UPDATE leave_balance 
     SET EarnedLeave = EarnedLeave + ?
     WHERE EmployeeId = ? AND Year = ?`,
    [credit, employeeId, year]
  );

  // Log the credit
  await db.query(
    `INSERT INTO earned_leave_log (EmployeeID, Year, Quarter, EarnedDays)
     VALUES (?,?,?,?)`,
    [employeeId, year, creditQuarter, credit]
  );
}

async function getUserRole(employeeId) {
  const [rows] = await db.query(
    `SELECT role FROM employee WHERE EmployeeID = ?`,
    [employeeId]
  );
  return rows[0]?.role || 'employee';
}

// ─── Apply Leave ───────────────────────────────────────────────────────────────
exports.applyLeave = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const employeeId = req.user.id;
    const userRole = await getUserRole(employeeId);

    let {
      leaveType, halfDay, fromDate, toDate, reason,
      flexiSelected, emergencyContact, contactNumber, handoverTo
    } = req.body;

    const attachment = req.file ? req.file.filename : null;

    if (!leaveType || !fromDate || !toDate || !reason) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (end < start) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "To date must be after From date" });
    }

    let days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (halfDay && halfDay !== "Full") {
      days = 0.5;
    }

    // Sick Leave Attachment
    if (leaveType === "Sick" && days > 2 && !attachment) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Doctor's prescription required for Sick Leave exceeding 2 days." });
    }

    const year = start.getFullYear();

    const [empRows] = await conn.query(
      `SELECT Gender FROM employee WHERE EmployeeID = ?`,
      [employeeId]
    );
    const gender = empRows[0]?.Gender || "Male";

    // Credit earned leave before checking balance
    try {
      await calculateAndCreditEarnedLeave(employeeId);
    } catch (e) {
      console.error("Earned leave calculation error:", e.message);
    }

    await ensureBalanceRow(employeeId, year, gender);

    const [balRows] = await conn.query(
      `SELECT * FROM leave_balance WHERE EmployeeId = ? AND Year = ?`,
      [employeeId, year]
    );
    const bal = balRows[0];

    // Check balance
    const colMap = {
      Casual: "CasualLeave", Sick: "SickLeave", Earned: "EarnedLeave",
      Flexi: "FlexiHoliday", Maternity: "MaternityLeave", LWP: null
    };

    const col = colMap[leaveType];
    if (col) {
      const remaining = Number(bal[col] || 0);
      if (remaining < days && leaveType !== "Maternity") {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient ${leaveType} balance. Available: ${remaining} days`
        });
      }
    }

    // Flexi Holiday Validation
    let flexiHolidayID = null;
    let status = "Pending";
    let isFlexiAutoApproved = false;

    if (leaveType === "Flexi") {
      if (!flexiSelected) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Please select a Flexi Holiday." });
      }

      if (fromDate !== toDate) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Flexi Holiday must be a single day." });
      }

      days = 1;
      halfDay = "Full";

      const [holiday] = await conn.query(
        `SELECT * FROM flexi_holidays WHERE FlexiHolidayID = ? AND Status = 'Active'`,
        [flexiSelected]
      );
      if (!holiday.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid or inactive Flexi Holiday selected." });
      }

      // Check if already used
      const [already] = await conn.query(
        `SELECT LeaveID FROM leave_requests
         WHERE EmployeeID = ? AND FlexiHolidayID = ?
         AND Status IN ('Approved', 'Pending')`,
        [employeeId, flexiSelected]
      );
      if (already.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "You have already selected this Flexi Holiday." });
      }

      flexiHolidayID = flexiSelected;
      
      // Flexi is auto-approved
      status = "Approved";
      isFlexiAutoApproved = true;
    }

    // Insert leave request
    const [result] = await conn.query(
      `INSERT INTO leave_requests
      (EmployeeID, LeaveType, HalfDay, FromDate, ToDate, Days, Reason,
       Attachment, FlexiHolidayID, EmergencyContact, ContactNumber, HandoverTo,
       Status, CreatedAt, ApprovedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        employeeId, leaveType, halfDay || "Full",
        fromDate, toDate, days, reason,
        attachment, flexiHolidayID,
        emergencyContact || null, contactNumber || null,
        handoverTo || null,
        status,
        new Date(),
        isFlexiAutoApproved ? new Date() : null
      ]
    );

    // For Flexi, deduct balance immediately
    if (leaveType === "Flexi" && isFlexiAutoApproved) {
      await conn.query(
        `UPDATE leave_balance SET FlexiHoliday = FlexiHoliday - 1
         WHERE EmployeeId = ? AND Year = ?`,
        [employeeId, year]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      message: isFlexiAutoApproved
        ? "Flexi Holiday approved automatically."
        : "Leave application submitted successfully.",
      autoApproved: isFlexiAutoApproved
    });

  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// ─── Get My Requests ───────────────────────────────────────────────────────────
exports.getMyRequests = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const [rows] = await db.query(`
      SELECT lr.*,
             fh.HolidayName,
             CONCAT(a.FirstName,' ',a.LastName) AS approvedByName
      FROM leave_requests lr
      LEFT JOIN employee a ON a.EmployeeID = lr.ApprovedBy
      LEFT JOIN flexi_holidays fh ON fh.FlexiHolidayID = lr.FlexiHolidayID
      WHERE lr.EmployeeID = ?
      ORDER BY lr.LeaveID DESC
    `, [employeeId]);

    const mapped = rows.map(r => ({
      id: r.LeaveID,
      leaveType: r.LeaveType,
      halfDay: r.HalfDay,
      fromDate: r.FromDate,
      toDate: r.ToDate,
      days: r.Days,
      reason: r.Reason,
      status: r.Status,
      appliedOn: r.CreatedAt,
      approvedOn: r.ApprovedAt,
      approvedBy: r.approvedByName,
      attachment: r.Attachment,
      flexiHolidayID: r.FlexiHolidayID,
      flexiHolidayName: r.HolidayName
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Get my requests error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Balance ───────────────────────────────────────────────────────────────
exports.getBalance = async (req, res) => {
  try {
    const employeeId = req.user.id;
    const year = new Date().getFullYear();

    const [empRows] = await db.query(
      `SELECT Gender FROM employee WHERE EmployeeID = ?`,
      [employeeId]
    );
    const gender = empRows[0]?.Gender || "Male";

    // Credit earned leave if eligible
    try {
      await calculateAndCreditEarnedLeave(employeeId);
    } catch (e) {
      console.error("Earned leave calculation:", e.message);
    }

    await ensureBalanceRow(employeeId, year, gender);

    const [balRows] = await db.query(
      `SELECT * FROM leave_balance WHERE EmployeeId = ? AND Year = ?`,
      [employeeId, year]
    );

    if (!balRows.length) {
      return res.status(404).json({ success: false, message: "Leave balance not found." });
    }

    const bal = balRows[0];
    const response = {
      Casual: Number(bal.CasualLeave || 0),
      Sick: Number(bal.SickLeave || 0),
      Earned: Number(bal.EarnedLeave || 0),
      Flexi: Number(bal.FlexiHoliday || 0),
    };

    if (gender.toLowerCase() === "female") {
      response.Maternity = Number(bal.MaternityLeave || 0);
    }

    res.json({ success: true, balance: response });

  } catch (err) {
    console.error("Get balance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Pending Approvals ────────────────────────────────────────────────────────
exports.getPendingApprovals = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.user.id;
    const userRole = req.user.role || 'employee';

    let query = `
      SELECT lr.*,
             CONCAT(e.FirstName,' ',e.LastName) AS employeeName,
             e.Department AS department,
             e.role AS employeeRole,
             e.DirectSupervisor
      FROM leave_requests lr
      JOIN employee e ON e.EmployeeID = lr.EmployeeID
      WHERE lr.Status = 'Pending'
    `;

    const params = [];

    if (userRole === 'manager') {
      query += ` AND e.DirectSupervisor = ?`;
      params.push(userId);
    }

    query += ` ORDER BY lr.CreatedAt DESC`;

    const [rows] = await db.query(query, params);

    const mapped = rows.map(r => ({
      id: r.LeaveID,
      employeeId: r.EmployeeID,
      employeeName: r.employeeName || "Unknown",
      department: r.department,
      leaveType: r.LeaveType,
      halfDay: r.HalfDay,
      fromDate: r.FromDate,
      toDate: r.ToDate,
      days: r.Days,
      reason: r.Reason,
      status: r.Status,
      appliedOn: r.CreatedAt,
      canApprove: userRole === 'admin' || userRole === 'hr' || 
                  (userRole === 'manager' && r.Days <= 3 && !['Maternity', 'LWP'].includes(r.LeaveType))
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Get pending approvals error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Approve Leave ─────────────────────────────────────────────────────────────
exports.approveLeave = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { id } = req.params;
    const approverId = req.user.id;
    const approverRole = req.user.role;

    const [rows] = await conn.query(
      `SELECT * FROM leave_requests WHERE LeaveID = ?`,
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    const leave = rows[0];

    // Flexi is auto-approved
    if (leave.LeaveType === "Flexi") {
      await conn.rollback();
      return res.json({ success: true, message: "Flexi leave is auto-approved" });
    }

    if (leave.Status === "Approved") {
      await conn.rollback();
      return res.json({ success: true, message: "Already approved" });
    }

    if (leave.Status === "Rejected") {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Cannot approve a rejected request" });
    }

    // Check if user can approve
    let canApprove = false;
    const days = Number(leave.Days);

    if (approverRole === 'admin' || approverRole === 'hr') {
      canApprove = true;
    } else if (approverRole === 'manager') {
      const [emp] = await conn.query(
        `SELECT DirectSupervisor FROM employee WHERE EmployeeID = ?`,
        [leave.EmployeeID]
      );
      if (emp[0]?.DirectSupervisor == approverId) {
        if (days <= 3 && !['Maternity', 'LWP'].includes(leave.LeaveType)) {
          canApprove = true;
        }
      }
    }

    if (!canApprove) {
      await conn.rollback();
      let msg = "You don't have permission to approve this leave request";
      if (approverRole === 'manager' && days > 3) {
        msg = "Leaves exceeding 3 days require HR or Admin approval";
      }
      if (approverRole === 'manager' && ['Maternity', 'LWP'].includes(leave.LeaveType)) {
        msg = "Maternity and LWP require HR or Admin approval";
      }
      return res.status(403).json({ success: false, message: msg });
    }

    // Approve the leave
    await conn.query(
      `UPDATE leave_requests
       SET Status = 'Approved', ApprovedBy = ?, ApprovedAt = NOW()
       WHERE LeaveID = ?`,
      [approverId, id]
    );

    // Log approval
    await conn.query(
      `INSERT INTO leave_approvals (LeaveId, ApprovedBy, ApprovalRole, ActionTaken, Remarks)
       VALUES (?, ?, ?, 'Approved', ?)`,
      [id, approverId, approverRole, req.body?.remarks || null]
    );

    // Deduct balance
    const fromDate = new Date(leave.FromDate);
    const year = fromDate.getFullYear();
    
    const [empRows] = await conn.query(
      `SELECT Gender FROM employee WHERE EmployeeID = ?`,
      [leave.EmployeeID]
    );
    const gender = empRows[0]?.Gender || "Male";
    await ensureBalanceRow(leave.EmployeeID, year, gender);

    const colMap = {
      Casual: "CasualLeave", Sick: "SickLeave", Earned: "EarnedLeave",
      Flexi: "FlexiHoliday", Maternity: "MaternityLeave", LWP: null
    };
    const col = colMap[leave.LeaveType];
    if (col && leave.LeaveType !== "Flexi") {
      const daysToDeduct = Number(leave.Days);
      await conn.query(
        `UPDATE leave_balance
         SET ${col} = GREATEST(0, ${col} - ?)
         WHERE EmployeeId = ? AND Year = ?`,
        [daysToDeduct, leave.EmployeeID, year]
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Leave approved successfully" });

  } catch (err) {
    await conn.rollback();
    console.error("Approve leave error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

// ─── Reject Leave ─────────────────────────────────────────────────────────────
exports.rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const rejecterId = req.user.id;
    const rejecterRole = req.user.role;

    const [rows] = await db.query(
      `SELECT * FROM leave_requests WHERE LeaveID = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    const leave = rows[0];

    // Flexi is auto-approved, cannot be rejected
    if (leave.LeaveType === "Flexi") {
      return res.status(400).json({ success: false, message: "Flexi leave is auto-approved and cannot be rejected" });
    }

    let canReject = false;
    if (['admin', 'hr'].includes(rejecterRole)) {
      canReject = true;
    } else if (rejecterRole === 'manager') {
      const [emp] = await db.query(
        `SELECT DirectSupervisor FROM employee WHERE EmployeeID = ?`,
        [leave.EmployeeID]
      );
      if (emp[0]?.DirectSupervisor == rejecterId) {
        canReject = true;
      }
    }

    if (!canReject) {
      return res.status(403).json({ success: false, message: "You don't have permission to reject this leave request" });
    }

    await db.query(
      `UPDATE leave_requests SET Status = 'Rejected', RejectedBy = ? WHERE LeaveID = ?`,
      [rejecterId, id]
    );
    await db.query(
      `INSERT INTO leave_approvals (LeaveId, ApprovedBy, ApprovalRole, ActionTaken, Remarks)
       VALUES (?, ?, ?, 'Rejected', ?)`,
      [id, rejecterId, rejecterRole, req.body?.remarks || null]
    );

    res.json({ success: true, message: "Leave rejected" });
  } catch (err) {
    console.error("Reject leave error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Get Employee Leave Details ──────────────────────────────────────────────
exports.getEmployeeLeaveDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const year = new Date().getFullYear();
    const userRole = req.user.role;

    if (!['admin', 'hr', 'manager'].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Permission denied" });
    }

    // If manager, check if employee is under them
    if (userRole === 'manager') {
      const [emp] = await db.query(
        `SELECT DirectSupervisor FROM employee WHERE EmployeeID = ?`,
        [employeeId]
      );
      if (emp[0]?.DirectSupervisor != req.user.id) {
        return res.status(403).json({ success: false, message: "You can only view your team members" });
      }
    }

    // Get employee info
    const [empRows] = await db.query(
      `SELECT EmployeeID, FirstName, LastName, Department, role FROM employee WHERE EmployeeID = ?`,
      [employeeId]
    );
    if (!empRows.length) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }
    const employee = empRows[0];

    // Get leave balance
    const [balRows] = await db.query(
      `SELECT * FROM leave_balance WHERE EmployeeId = ? AND Year = ?`,
      [employeeId, year]
    );
    const balance = balRows[0] || {};

    // Get leave requests for the year
    const [leaveRows] = await db.query(
      `SELECT LeaveID, LeaveType, Status, Days, FromDate, ToDate, CreatedAt, ApprovedAt
       FROM leave_requests
       WHERE EmployeeID = ? AND YEAR(FromDate) = ?
       ORDER BY CreatedAt DESC`,
      [employeeId, year]
    );

    const used = {}, pending = {}, approved = {};
    leaveRows.forEach(l => {
      const type = l.LeaveType;
      if (!used[type]) used[type] = 0;
      if (!pending[type]) pending[type] = 0;
      if (!approved[type]) approved[type] = 0;
      used[type] += l.Days;
      if (l.Status === 'Pending') pending[type] += l.Days;
      if (l.Status === 'Approved') approved[type] += l.Days;
    });

    // Get earned leave history
    const [earnedLogs] = await db.query(
      `SELECT Quarter, EarnedDays, CreditedAt FROM earned_leave_log
       WHERE EmployeeID = ? AND Year = ?
       ORDER BY Quarter ASC`,
      [employeeId, year]
    );

    res.json({
      employee: {
        id: employee.EmployeeID,
        name: `${employee.FirstName} ${employee.LastName}`,
        department: employee.Department,
        role: employee.role
      },
      balance: {
        Casual: Number(balance.CasualLeave || 0),
        Sick: Number(balance.SickLeave || 0),
        Earned: Number(balance.EarnedLeave || 0),
        Flexi: Number(balance.FlexiHoliday || 0),
        Maternity: Number(balance.MaternityLeave || 0)
      },
      used, pending, approved,
      earnedLogs,
      leaves: leaveRows.map(l => ({
        id: l.LeaveID,
        type: l.LeaveType,
        days: l.Days,
        status: l.Status,
        fromDate: l.FromDate,
        toDate: l.ToDate,
        appliedOn: l.CreatedAt,
        approvedOn: l.ApprovedAt
      }))
    });
  } catch (err) {
    console.error("Get employee leave details error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Fixed Holidays ──────────────────────────────────────────────────────────

exports.getFixedHolidays = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT * FROM holiday WHERE Year = ? ORDER BY HolidayDate ASC`,
      [year]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get fixed holidays error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createFixedHoliday = async (req, res) => {
  try {
    const { holidayName, holidayDate, optional } = req.body;
    const year = new Date(holidayDate).getFullYear();
    const month = String(new Date(holidayDate).getMonth() + 1).padStart(2, '0');

    if (!holidayName || !holidayDate) {
      return res.status(400).json({ success: false, message: "Holiday name and date are required" });
    }

    const [existing] = await db.query(
      `SELECT id FROM holiday WHERE HolidayDate = ?`,
      [holidayDate]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: "Holiday already exists on this date" });
    }

    await db.query(
      `INSERT INTO holiday (HolidayName, HolidayDate, Optional, Month, Year)
       VALUES (?, ?, ?, ?, ?)`,
      [holidayName, holidayDate, optional || null, month, year]
    );

    res.json({ success: true, message: "Fixed holiday created successfully" });
  } catch (err) {
    console.error("Create fixed holiday error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFixedHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM holiday WHERE id = ?`, [id]);
    res.json({ success: true, message: "Fixed holiday deleted successfully" });
  } catch (err) {
    console.error("Delete fixed holiday error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Flexi Holidays ──────────────────────────────────────────────────────────

exports.getActiveFlexiHolidays = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT FlexiHolidayID, HolidayName, HolidayDate, Year
       FROM flexi_holidays
       WHERE Year = ? AND Status = 'Active'
       ORDER BY HolidayDate ASC`,
      [year]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get flexi holidays error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAllFlexiHolidays = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT fh.*, CONCAT(e.FirstName,' ',e.LastName) AS createdByName
       FROM flexi_holidays fh
       LEFT JOIN employee e ON e.EmployeeID = fh.CreatedBy
       WHERE fh.Year = ?
       ORDER BY fh.HolidayDate DESC`,
      [year]
    );
    res.json(rows);
  } catch (err) {
    console.error("Get all flexi holidays error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createFlexiHoliday = async (req, res) => {
  try {
    const { holidayName, holidayDate } = req.body;
    const year = new Date(holidayDate).getFullYear();
    const createdBy = req.user.id;

    if (!holidayName || !holidayDate) {
      return res.status(400).json({ success: false, message: "Holiday name and date are required" });
    }

    const [existing] = await db.query(
      `SELECT FlexiHolidayID FROM flexi_holidays WHERE HolidayDate = ? AND Year = ?`,
      [holidayDate, year]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: "Holiday already exists on this date" });
    }

    await db.query(
      `INSERT INTO flexi_holidays (HolidayName, HolidayDate, Year, Status, CreatedBy)
       VALUES (?, ?, ?, 'Active', ?)`,
      [holidayName, holidayDate, year, createdBy]
    );

    res.json({ success: true, message: "Flexi holiday created successfully" });
  } catch (err) {
    console.error("Create flexi holiday error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFlexiHolidayStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query(
      `UPDATE flexi_holidays SET Status = ? WHERE FlexiHolidayID = ?`,
      [status, id]
    );
    res.json({ success: true, message: "Flexi holiday status updated" });
  } catch (err) {
    console.error("Update flexi holiday error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteFlexiHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [used] = await db.query(
      `SELECT LeaveID FROM leave_requests WHERE FlexiHolidayID = ?`,
      [id]
    );
    if (used.length) {
      return res.status(400).json({ 
        success: false, 
        message: "Cannot delete: This flexi holiday has been used in leave requests" 
      });
    }

    await db.query(`DELETE FROM flexi_holidays WHERE FlexiHolidayID = ?`, [id]);
    res.json({ success: true, message: "Flexi holiday deleted successfully" });
  } catch (err) {
    console.error("Delete flexi holiday error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Leave Policy ────────────────────────────────────────────────────────────

exports.getLeavePolicy = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM leave_policy ORDER BY PolicyID DESC LIMIT 1`
    );
    if (!rows.length) {
      return res.json({
        CasualLeave: 7,
        SickLeave: 7,
        EarnedLeave: 14,
        QuarterlyEarned: 3.5,
        FlexiHoliday: 2,
        MaternityLeave: 180,
        MaxEarnedCarryForward: 14
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Get leave policy error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLeavePolicy = async (req, res) => {
  try {
    const {
      CasualLeave, SickLeave, EarnedLeave,
      QuarterlyEarned, FlexiHoliday, MaternityLeave,
      MaxEarnedCarryForward
    } = req.body;

    await db.query(
      `INSERT INTO leave_policy 
       (CasualLeave, SickLeave, EarnedLeave, QuarterlyEarned, FlexiHoliday, MaternityLeave, MaxEarnedCarryForward)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       CasualLeave = VALUES(CasualLeave),
       SickLeave = VALUES(SickLeave),
       EarnedLeave = VALUES(EarnedLeave),
       QuarterlyEarned = VALUES(QuarterlyEarned),
       FlexiHoliday = VALUES(FlexiHoliday),
       MaternityLeave = VALUES(MaternityLeave),
       MaxEarnedCarryForward = VALUES(MaxEarnedCarryForward)`,
      [CasualLeave, SickLeave, EarnedLeave, QuarterlyEarned, FlexiHoliday, MaternityLeave, MaxEarnedCarryForward]
    );

    res.json({ success: true, message: "Leave policy updated successfully" });
  } catch (err) {
    console.error("Update leave policy error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};