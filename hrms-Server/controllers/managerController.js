const db = require('../config/db');

exports.getManagerDashboardSummary = async (req, res) => {
  try {
    const managerId = req.query.managerId;

    if (!managerId) {
      return res.status(400).json({ success: false, message: "Manager ID is required." });
    }

    // 1. Team Size Query
    const [[{ teamSize }]] = await db.query(
      "SELECT COUNT(*) as teamSize FROM Employee WHERE DirectSupervisor = ? AND ArchiveStatus = '1'",
      [managerId]
    );

    // 2. Pending TIMESHEET Approvals Count
    const [[{ pendingApprovals }]] = await db.query(
      `SELECT COUNT(*) as pendingApprovals 
       FROM pms_timesheet t 
       JOIN Employee e ON t.employeeid = e.EmployeeID 
       WHERE e.DirectSupervisor = ? AND t.status = 0`,
      [managerId]
    );

    // 3. Fetch Team Members List
    const [teamRows] = await db.query(
      `SELECT 
        FirstName, LastName, role, StatusOfEmployee 
       FROM Employee 
       WHERE DirectSupervisor = ? AND ArchiveStatus = '1' 
       ORDER BY EmployeeID DESC 
       LIMIT 4`,
      [managerId]
    );

    const formattedTeam = teamRows.map(emp => {
      const first = emp.FirstName || "";
      const last = emp.LastName || "";
      const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "TM";
      
      let status = "Active";
      let iBg = "#e1f5ee", iColor = "#085041";
      
      if (emp.StatusOfEmployee && emp.StatusOfEmployee.toLowerCase().includes("leave")) {
        status = "On Leave";
        iBg = "#fde8ef"; iColor = "#993556";
      } else if (emp.StatusOfEmployee && emp.StatusOfEmployee.toLowerCase().includes("remote")) {
        status = "Remote";
        iBg = "#e8f4fa"; iColor = "#0c447c";
      }

      return {
        name: `${first} ${last}`.trim(),
        role: emp.role || "Team Member",
        status: status,
        initials: initials,
        iBg: iBg,
        iColor: iColor
      };
    });

    // 4. Fetch Pending TIMESHEETS for the Manager's Team
    const [approvalRows] = await db.query(
      `SELECT 
        t.timesheetid,
        t.timesheetdate,
        t.tothrs,
        t.totmin,
        e.FirstName, 
        e.LastName 
       FROM pms_timesheet t 
       JOIN Employee e ON t.employeeid = e.EmployeeID 
       WHERE e.DirectSupervisor = ? AND t.status = 0 
       ORDER BY t.createDate DESC 
       LIMIT 4`,
      [managerId]
    );

    // Transform timesheet rows for frontend display
    const formattedApprovals = approvalRows.map(req => {
      // Format hours and minutes clearly (e.g., "8h 30m")
      const hrs = req.tothrs ? `${req.tothrs}h` : "0h";
      const mins = req.totmin ? `${req.totmin}m` : "0m";

      return {
        type: `Timesheet (${hrs} ${mins})`,
        name: `${req.FirstName} ${req.LastName}`.trim(),
        date: new Date(req.timesheetdate).toLocaleDateString("en-GB", { day: '2-digit', month: 'short' }),
        status: "Pending" 
      };
    });

    // 5. Build Final Response
    return res.status(200).json({
      success: true,
      data: {
        stats: [
          {
            label: "My Team Size",
            value: String(teamSize),
            delta: "Active members",
            up: true,
            key: "team",
            bg: "#e8f4fa",
            color: "#2b7da1"
          },
          {
            label: "Pending Approvals",
            value: String(pendingApprovals),
            delta: "Timesheets to review",
            up: pendingApprovals > 0 ? false : null,
            key: "approvals",
            bg: "#fde8ef",
            color: "#d63a6e"
          },
          {
            label: "Team Attendance",
            value: "92%", 
            delta: "+2% this week",
            up: true,
            key: "attendance",
            bg: "#e1f5ee",
            color: "#0f6e56"
          },
          {
            label: "Avg Performance",
            value: "4.2/5",
            delta: "Consistent",
            up: null,
            key: "performance",
            bg: "#faeeda",
            color: "#854f0b"
          }
        ],
        team: formattedTeam,
        approvals: formattedApprovals
      }
    });

  } catch (error) {
    console.error("Manager dashboard summary query engine crash:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error gathering manager dashboard summaries.",
      error: error.message
    });
  }
};

// 1. FETCH TEAM TIMESHEETS FOR DIRECT OR INDIRECT SUPERVISORS
exports.getTeamTimesheets = async (req, res) => {
    try {
        const { supervisorId } = req.query; // This is the logged-in supervisor's EmployeeID (e.g., 1046)

        if (!supervisorId) {
            return res.status(400).json({ message: "Missing supervisor authentication parameter context." });
        }

        // 1. First, get the supervisor's full name from the database because 
        // DirectSupervisor/IndirectSupervisor columns store varchar names!
        const [supRows] = await db.query(
            `SELECT CONCAT(FirstName, ' ', LastName) AS FullName FROM employee WHERE EmployeeID = ?`, 
            [supervisorId]
        );

        if (supRows.length === 0) {
            return res.status(404).json({ message: "Supervisor profile not found." });
        }

        const supervisorName = supRows[0].FullName;

        // 2. Query timesheets matching against the supervisor's NAME string or their numeric ID fallback
        let query = `
            SELECT 
                t.*, 
                e.FirstName, e.LastName,
                e.DirectSupervisor, e.IndirectSupervisor,
                d.Department as DepartmentName
            FROM pms_timesheet t
            LEFT JOIN employee e ON t.employeeid = e.EmployeeID
            LEFT JOIN department d ON t.departmentid = d.id
            WHERE e.DirectSupervisor = ? 
               OR e.IndirectSupervisor = ?
               OR e.DirectSupervisor = ? -- Fallback if IDs are stored as text strings
               OR e.IndirectSupervisor = ?
               OR ? = 1 -- Global admin bypass
            ORDER BY t.timesheetdate DESC, t.employeeid ASC, t.timesheetid ASC
        `;
        
        const [rows] = await db.query(query, [
            supervisorName,   // Match text name (e.g., "Ramakant Yadav")
            supervisorName, 
            supervisorId,     // Match raw ID just in case it's a numeric string
            supervisorId,
            supervisorId
        ]);

        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching supervisor team timesheets:", error);
        res.status(500).json({ message: "Failed to load timesheets directory.", error: error.message });
    }
};

// 2. APPROVE OR REJECT A TIMESHEET LOG ENTRY
exports.reviewTimesheetStatus = async (req, res) => {
    try {
        const { id } = req.params; // timesheetid
        // Accept rejection_comment from the body payload
        const { status, supervisorId, rejection_comment } = req.body; 

        if (status === undefined || !supervisorId) {
            return res.status(400).json({ message: "Missing mandatory review action parameters." });
        }

        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const commentValue = status === 2 ? (rejection_comment || '') : null;

        const query = `
            UPDATE pms_timesheet 
            SET status = ?, approvedById = ?, approveDate = ?, rejection_comment = ? 
            WHERE timesheetid = ?
        `;
        
        await db.query(query, [status, supervisorId, currentTimestamp, commentValue, id]);
        res.status(200).json({ message: `Timesheet state updated successfully.` });
    } catch (error) {
        console.error("Error executing review state transformation:", error);
        res.status(500).json({ message: "Failed updating verification parameters.", error: error.message });
    }
};