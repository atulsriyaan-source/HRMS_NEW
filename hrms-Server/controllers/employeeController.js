const db = require('../config/db');

const cleanBigInt = (val) => {
    return (!val || val === "" || isNaN(val)) ? 0 : parseInt(val);
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const employeeId = req.query.employeeId;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: "Missing employeeId" });
    }

    // Fixed Query: Self-Join for Manager Name + Active Status Logic
    const query = `
      SELECT 
        e.EmployeeID,
        e.FirstName,
        e.LastName,
        CONCAT(m.FirstName, ' ', m.LastName) as managerName,
        d.Department as departmentName,
        (SELECT COUNT(*) FROM service_requests r WHERE r.employee_id = e.EmployeeID AND r.status = 0) as livePendingRequests
      FROM Employee e
      LEFT JOIN Employee m ON e.DirectSupervisor = m.EmployeeID
      LEFT JOIN Department d ON e.Department = d.id
      WHERE e.EmployeeID = ? AND e.ArchiveStatus = '0' 
      LIMIT 1
    `;

    const [rows] = await db.query(query, [employeeId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Profile not found or inactive." });
    }

    const emp = rows[0];

    return res.status(200).json({
      success: true,
      profile: {
        fullName: `${emp.FirstName} ${emp.LastName}`,
        department: emp.departmentName || 'General',
        manager: emp.managerName || 'Not Assigned',
        pendingRequests: Number(emp.livePendingRequests),
        // Leave balances ko dynamic query se lana hoga, hardcode mat rakho
        leaveBalance: 12, 
        casualLeave: 5,
        sickLeave: 4,
        earnedLeave: 3
      }
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
// 1. FETCH LOGGED-IN EMPLOYEE TIMESHEETS
exports.getTimesheets = async (req, res) => {
    try {
        const { employeeId } = req.query;
        if (!employeeId) {
            return res.status(400).json({ message: "Authentication context mismatch. Missing employee id." });
        }

        const query = `
            SELECT * FROM pms_timesheet 
            WHERE employeeid = ? 
            ORDER BY timesheetdate DESC, timesheetid DESC
        `;
        const [rows] = await db.query(query, [employeeId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching timesheets:", error);
        res.status(500).json({ message: "Failed to fetch timesheet records", error: error.message });
    }
};

// 2. ADD NEW STEP LOG TASK (FIXED)
exports.addTimesheet = async (req, res) => {
    try {
        const tsData = { ...req.body };
        
        tsData.status = 0; // Default: Pending Review

        // Inject fallback placeholders for approval parameters to satisfy NOT NULL table rules
        tsData.approvedById = 0;
        tsData.approveDate = '1970-01-01 00:00:00'; 

        // FIXED: Explicitly delete UI state keys so they don't break dynamic INSERT queries
        delete tsData.timesheetid;
        delete tsData.billingType;
        delete tsData.studyid; 

        // Sanitize IDs
        tsData.projectid = cleanBigInt(tsData.projectid);
        tsData.taskid = cleanBigInt(tsData.taskid);
        tsData.activitytypeid = cleanBigInt(tsData.activitytypeid);
        tsData.nonprojectactivityid = cleanBigInt(tsData.nonprojectactivityid);
        tsData.pmscontractid = cleanBigInt(tsData.pmscontractid);
        tsData.departmentid = cleanBigInt(tsData.departmentid);
        tsData.roleid = cleanBigInt(tsData.roleid);
        tsData.unitid = cleanBigInt(tsData.unitid);

        // String formatting
        tsData.tothrs = tsData.tothrs ? String(tsData.tothrs) : "0";
        tsData.totmin = tsData.totmin ? String(tsData.totmin) : "0";
        tsData.unitcnt = tsData.unitcnt ? String(tsData.unitcnt) : "0";

        const columns = Object.keys(tsData);
        const values = Object.values(tsData);
        const placeholders = columns.map(() => '?').join(', ');

        const query = `INSERT INTO pms_timesheet (${columns.join(', ')}) VALUES (${placeholders})`;
        const [result] = await db.query(query, values);

        res.status(201).json({ message: "Task logged successfully", id: result.insertId });
    } catch (error) {
        console.error("Error adding timesheet entry:", error);
        res.status(500).json({ message: "Failed to save entry log", error: error.message });
    }
};

// 3. EDIT PENDING LOG TASK (FIXED)
exports.updateTimesheet = async (req, res) => {
    try {
        const { id } = req.params;
        const tsData = { ...req.body };

        const [existing] = await db.query('SELECT status FROM pms_timesheet WHERE timesheetid = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ message: "Timesheet log not found" });
        
        if (existing[0].status === 1) {
            return res.status(403).json({ message: "This entry is already locked and cannot be altered." });
        }

        // 1. Strip UI-specific state fields
        delete tsData.timesheetid;
        delete tsData.createDate;
        delete tsData.updateDate;
        delete tsData.FirstName;
        delete tsData.LastName;
        delete tsData.billingType; 
        delete tsData.studyid; 

        // 2. FIXED: Strip Manager metadata (Fixes the DATETIME crash)
        delete tsData.approveDate;
        delete tsData.approvedById;
        delete tsData.rejection_comment;

        // Reset status to 0 (Pending) so the manager can review the corrections
        tsData.status = 0; 

        tsData.projectid = cleanBigInt(tsData.projectid);
        tsData.taskid = cleanBigInt(tsData.taskid);
        tsData.activitytypeid = cleanBigInt(tsData.activitytypeid);
        tsData.nonprojectactivityid = cleanBigInt(tsData.nonprojectactivityid);
        tsData.pmscontractid = cleanBigInt(tsData.pmscontractid);
        tsData.departmentid = cleanBigInt(tsData.departmentid);
        tsData.roleid = cleanBigInt(tsData.roleid);
        tsData.unitid = cleanBigInt(tsData.unitid);

        tsData.tothrs = tsData.tothrs ? String(tsData.tothrs) : "0";
        tsData.totmin = tsData.totmin ? String(tsData.totmin) : "0";
        tsData.unitcnt = tsData.unitcnt ? String(tsData.unitcnt) : "0";

        const columns = Object.keys(tsData);
        const values = Object.values(tsData);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        
        const query = `UPDATE pms_timesheet SET ${setClause} WHERE timesheetid = ?`;
        values.push(id);

        await db.query(query, values);
        res.status(200).json({ message: "Timesheet entry updated successfully" });
    } catch (error) {
        console.error("Error updating timesheet log entry:", error);
        res.status(500).json({ message: "Failed to save entry adjustments", error: error.message });
    }
};

// 4. DELETE CONTROLLER
exports.deleteTimesheet = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT status FROM pms_timesheet WHERE timesheetid = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ message: "Timesheet log not found" });
        if (existing[0].status === 1) {
            return res.status(403).json({ message: "Cannot delete an approved or locked timesheet record." });
        }

        await db.query('DELETE FROM pms_timesheet WHERE timesheetid = ?', [id]);
        res.status(200).json({ message: "Timesheet step purged successfully." });
    } catch (error) {
        console.error("Error deleting timesheet:", error);
        res.status(500).json({ message: "Failed to delete timesheet", error: error.message });
    }
};

// 5. RESIGNATION WORKFLOWS
exports.submitResignation = async (req, res) => {
  try {
    console.log("Inspecting incoming request data context:");
    console.log("req.user:", req.user);
    console.log("req.body:", req.body);

    // FIXED: Safe extraction matrix to fall back to the frontend's injected employeeId field
    let employeeId = null;
    
    if (req.user && req.user.id) {
      employeeId = req.user.id;
    } else if (req.user && req.user.EmployeeID) {
      employeeId = req.user.EmployeeID;
    } else if (req.body && (req.body.employeeId || req.body.EmployeeID)) {
      employeeId = req.body.employeeId || req.body.EmployeeID;
    }

    // Guard clause: If both req.user and req.body fall through, return a clean error instead of crashing node
    if (!employeeId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authorization state context mismatch. Missing employee session identifier." 
      });
    }

    const { resignationDate, primaryReason, additionalComments } = req.body;
    const noticePeriodDays = 90;

    const lwd = new Date(resignationDate);
    lwd.setDate(lwd.getDate() + noticePeriodDays);

    const attachmentPath = req.file ? `/uploads/resignations/${req.file.filename}` : null;

    const [result] = await db.query(
      `INSERT INTO employee_resignations (EmployeeID, ResignationDate, PrimaryReason, AdditionalComments, NoticePeriodDays, SystemLastWorkingDate, AttachmentPath, Status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, resignationDate, primaryReason, additionalComments || null, noticePeriodDays, lwd, attachmentPath, "Submitted"]
    );

    res.status(201).json({ success: true, message: "Resignation submitted successfully", resignationId: result.insertId });
  } catch (error) {
    console.error("Error writing resignation node block:", error);
    res.status(500).json({ success: false, message: "Failed to submit resignation", error: error.message });
  }
};

exports.getActiveResignation = async (req, res) => {
  try {
    console.log("Checking getActiveResignation query context params:", req.query);

    let employeeId = null;
    
    if (req.user && req.user.id) {
      employeeId = req.user.id;
    } else if (req.user && req.user.EmployeeID) {
      employeeId = req.user.EmployeeID;
    } else if (req.query && (req.query.employeeId || req.query.EmployeeID)) {
      employeeId = req.query.employeeId || req.query.EmployeeID;
    }

    if (!employeeId) {
      return res.status(200).json({ 
        success: false, 
        hasActiveResignation: false, 
        message: "Awaiting valid structural user session token or query identifier parameters." 
      });
    }

    // FIXED: Changed ORDER BY id DESC to ORDER BY ResignationDate DESC
    const query = `
      SELECT * FROM employee_resignations
      WHERE EmployeeID = ? 
      ORDER BY ResignationDate DESC LIMIT 1
    `;
    const [rows] = await db.query(query, [employeeId]);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, hasActiveResignation: false });
    }

    res.status(200).json({ success: true, hasActiveResignation: true, data: rows[0] });
  } catch (error) {
    console.error("Error retrieving separation context state:", error);
    res.status(500).json({ success: false, message: "Failed to read resignation logs", error: error.message });
  }
};

exports.getAllResignations = async (req, res) => {
  try {
    // Frontend se bheja gaya role hamesha lowercase me convert kar lena chahiye taaki case-mismatch na ho
    const role = req.query.role ? req.query.role.toLowerCase() : "";
    const supervisorId = req.query.supervisorId;
    
    let query = "";
    let queryParams = [];

    // 1. ADMIN: Can view ALL resignations company-wide
    if (role === 'admin') {
      query = `
        SELECT r.*, e.FirstName, e.LastName, e.role, d.Department as DepartmentName 
        FROM employee_resignations r
        JOIN employee e ON r.EmployeeID = e.EmployeeID
        LEFT JOIN department d ON e.department = d.id
        ORDER BY r.ResignationDate DESC
      `;
    } 
    // 2. HR: Can view ONLY where they are assigned as the Indirect Supervisor
    else if (role === 'hr') {
      query = `
        SELECT r.*, e.FirstName, e.LastName, e.role, d.Department as DepartmentName 
        FROM employee_resignations r
        JOIN employee e ON r.EmployeeID = e.EmployeeID
        LEFT JOIN department d ON e.department = d.id
        WHERE e.IndirectSupervisor = ?
        ORDER BY r.ResignationDate DESC
      `;
      queryParams = [supervisorId];
    } 
    // 3. MANAGER (or any other role): Can view ONLY where they are the Direct Supervisor
    else {
      query = `
        SELECT r.*, e.FirstName, e.LastName, e.role, d.Department as DepartmentName 
        FROM employee_resignations r
        JOIN employee e ON r.EmployeeID = e.EmployeeID
        LEFT JOIN department d ON e.department = d.id
        WHERE e.DirectSupervisor = ?
        ORDER BY r.ResignationDate DESC
      `;
      queryParams = [supervisorId];
    }

    const [rows] = await db.query(query, queryParams);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error pulling exit records:", error);
    res.status(500).json({ success: false, message: "Failed to load resignation requests" });
  }
};

// UPDATE RESIGNATION STATE STATUS MATRIX
exports.updateResignationStatus = async (req, res) => {
  try {
    const { resignationId, nextStatus, managerComments, confirmedLWD } = req.body;

    console.log("Processing Exit Transition Payload:", req.body);

    // 1. Mandatory Parameters Validation
    if (!resignationId || !nextStatus) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing parameters validation. resignationId and nextStatus are mandatory.",
        received: req.body
      });
    }

    // 2. Build Dynamic Update Query for employee_resignations
    let updateFields = "`Status` = ?";
    let queryParams = [nextStatus];

    // Append Comments if provided
    if (managerComments) {
      updateFields += ", `AdditionalComments` = CONCAT(IFNULL(AdditionalComments,''), '\nFeedback: ', ?)";
      queryParams.push(managerComments);
    }

    // Append Last Working Date if provided (Ignore if withdrawal is approved)
    if (confirmedLWD && nextStatus !== 'Withdrawal Approved') {
      updateFields += ", `SystemLastWorkingDate` = ?";
      queryParams.push(new Date(confirmedLWD));
    } else if (nextStatus === 'Withdrawal Approved') {
      // Clear or preserve the working date column gracefully on reversal approval
      updateFields += ", `SystemLastWorkingDate` = NULL";
    }

    // Finalizing Query for Resignation Table
    queryParams.push(resignationId);
    await db.query(
      `UPDATE employee_resignations SET ${updateFields} WHERE ResignationID = ?`, 
      queryParams
    );

    // 3. AUTOMATION BLOCK A: Deactivate Employee on 'Closed' status
    if (nextStatus === 'Closed') {
      const [record] = await db.query(
        `SELECT EmployeeID FROM employee_resignations WHERE ResignationID = ?`, 
        [resignationId]
      );

      if (record.length > 0) {
        const empId = record[0].EmployeeID;
        await db.query(
          `UPDATE employee SET Status = 'Inactive' WHERE EmployeeID = ?`, 
          [empId]
        );
        console.log(`System Alert: Employee ${empId} profile archived after final settlement.`);
      }
    }

    // 4. AUTOMATION BLOCK B: Reactivate / Retain Employee on 'Withdrawal Approved' status
    if (nextStatus === 'Withdrawal Approved') {
      const [record] = await db.query(
        `SELECT EmployeeID FROM employee_resignations WHERE ResignationID = ?`, 
        [resignationId]
      );

      if (record.length > 0) {
        const empId = record[0].EmployeeID;
        // Ensures employee status remains or reverts to 'Active' 
        await db.query(
          `UPDATE employee SET Status = 'Active' WHERE EmployeeID = ?`, 
          [empId]
        );
        console.log(`System Alert: Employee ${empId} profile marked Active following withdrawal approval.`);
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Resignation state advanced to ${nextStatus} successfully.` 
    });

  } catch (error) {
    console.error("Critical Failure in Transition Lifecycle:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal Server Error during status transition.", 
      error: error.message 
    });
  }
};

exports.createRequest = async (req, res) => {
    try {
        const { employeeId, employeeName, requestType, title, description } = req.body;
        
        // FIXED: Catch uploaded file details if present, else default empty
        const attachmentPath = req.file ? req.file.filename : null;

        if (!employeeId || !requestType || !title || !description) {
            return res.status(400).json({ success: false, message: "Missing tracking metrics parameters." });
        }

        const query = `
            INSERT INTO service_requests 
            (employee_id, employee_name, request_type, title, description, Attachment, status) 
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `;

        const [result] = await db.query(query, [employeeId, employeeName || null, requestType, title, description, attachmentPath]);
        
        res.status(201).json({ success: true, message: "Ticket raised clean with optional variables data!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal crash on multipart mapping nodes." });
    }
};

// =========================================================================
// 2. GET EMPLOYEE REQUESTS (Employee sees their own history)
// =========================================================================
exports.getEmployeeRequests = async (req, res) => {
    try {
        const { employeeId } = req.query;

        if (!employeeId) {
            return res.status(400).json({ success: false, message: "Employee identity verification failed." });
        }

        const query = `SELECT * FROM service_requests WHERE employee_id = ? ORDER BY id DESC`;
        const [rows] = await db.query(query, [employeeId]);
        
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching employee tickets:", error);
        res.status(500).json({ success: false, message: "Failed to query historical log states." });
    }
};