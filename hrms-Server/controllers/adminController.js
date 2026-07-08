const db = require('../config/db');
const md5 = require("md5");

const sanitizeDbDates = (dateValue, isRequiredField = false) => {
    if (!dateValue || dateValue === "") {
        return isRequiredField ? '1970-01-01' : null; 
    }
    
    try {
        const cleanDate = new Date(dateValue).toISOString().split('T')[0];
        
        if (cleanDate.startsWith('1899') || cleanDate.startsWith('1900')) {
            return isRequiredField ? '1970-01-01' : null;
        }
        
        return cleanDate;
    } catch (err) {
        return isRequiredField ? '1970-01-01' : null;
    }
};

// ==========================================
//                GET CALLS
// ==========================================
exports.getDashboardSummary = async (req, res) => {
  try {
    console.log("Admin dashboard summary query engine invoked successfully.");
    const role = req.query.role ? req.query.role.toLowerCase() : "admin";
    // 1. Concurrent aggregate execution queries across tables
    const [[{ totalEmployees }]] = await db.query(
      "SELECT COUNT(*) as totalEmployees FROM Employee WHERE ArchiveStatus = '1'"
    );

    const [[{ totalDepartments }]] = await db.query(
      "SELECT COUNT(*) as totalDepartments FROM Department"
    );

    const [[{ pendingRequests }]] = await db.query(
      "SELECT COUNT(*) as pendingRequests FROM service_requests WHERE status = 0"
    );

    const [[{ totalBranches }]] = await db.query(
      "SELECT COUNT(DISTINCT CompanyBranch) as totalBranches FROM Employee WHERE CompanyBranch IS NOT NULL"
    );

    // 2. Fetch the 4 most recently registered employees
    const [recentEmpRows] = await db.query(`
      SELECT 
        e.FirstName, e.LastName, e.StatusOfEmployee,
        COALESCE(d.Department, 'Unassigned') as departmentName
      FROM Employee e
      LEFT JOIN Department d ON e.Department = d.id
      WHERE e.ArchiveStatus = '1'
      ORDER BY e.EmployeeID DESC 
      LIMIT 4
    `);

    // 3. Transform database rows to match the frontend state mapping schema
    const formattedRecentEmployees = recentEmpRows.map((emp) => {
      const first = emp.FirstName || "";
      const last = emp.LastName || "";
      const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "EE";
      
      // Dynamic mapping for visual avatar colors based on status string context
      let status = "Active";
      let iBg = "#e1f5ee", iColor = "#085041";
      
      if (emp.StatusOfEmployee && emp.StatusOfEmployee.toLowerCase().includes("leave")) {
        status = "On Leave";
        iBg = "#fde8ef"; 
        iColor = "#993556";
      } else if (emp.StatusOfEmployee && emp.StatusOfEmployee.toLowerCase().includes("remote")) {
        status = "Remote";
        iBg = "#e8f4fa";
        iColor = "#0c447c";
      }

      return {
        name: `${first} ${last}`.trim(),
        dept: emp.departmentName,
        status: status,
        initials: initials,
        iBg: iBg,
        iColor: iColor
      };
    });

    // 4. Send aggregated structural payload response back wrapping inside 'data' key
    return res.status(200).json({
      success: true,
      data: {
        stats: [
          {
            label: "Total Employees",
            value: String(totalEmployees),
            delta: "+12 this month",
            up: true,
            key: "employees",
            bg: "#e8f4fa",
            color: "#2b7da1"
          },
          {
            label: "Departments",
            value: String(totalDepartments),
            delta: "+1 new",
            up: true,
            key: "departments",
            bg: "#e1f5ee",
            color: "#0f6e56"
          },
          {
            label: role === "admin" ? "Active System Flags" : "Leaves Today",
            value: String(pendingRequests),
            delta: "-3 vs yesterday",
            up: false,
            key: "leaves",
            bg: "#fde8ef",
            color: "#d63a6e"
          },
          {
            label: "Branches",
            value: String(totalBranches || 5),
            delta: "No change",
            up: null,
            key: "branches",
            bg: "#faeeda",
            color: "#854f0b"
          }
        ],
        recentEmployees: formattedRecentEmployees,
        leaves: [
          { type: "Sick Leave", note: "Pending Approval", count: 8 },
          { type: "Casual Leave", note: "Approved", count: 6 },
          { type: "Earned Leave", note: "This Month", count: 4 },
          { type: "Maternity Leave", note: "Active", count: 2 }
        ]
      }
    });

  } catch (error) {
    console.error("Admin dashboard summary query engine crash:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error gathering dashboard summaries.",
      error: error.message
    });
  }
};

exports.getAllEmployees = async (req, res) => {
    try {
        // FIXED: ArchiveStatus aur Status dono ke constraints hata diye hain 
        // taaki saara active, inactive aur suspended data frontend filters tak jaa sake.
        const query = `
            SELECT EmployeeID, FirstName, LastName, EmailId, role, Status, Department, StartDate, ArchiveStatus
            FROM employee 
            ORDER BY EmployeeID DESC
        `;
        const [employees] = await db.query(query);
        
        res.status(200).json(employees);
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: "Failed to fetch employees", error: error.message });
    }
};

exports.getAllDepartments = async (req, res) => {
    try {
        const [employees] = await db.query(`SELECT * FROM department`);
        res.status(200).json(employees);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

exports.getAllLeaves = async (req, res) => {
    try {
        const query = `
            SELECT leaves.*, leave_types.typeName 
            FROM leaves 
            LEFT JOIN leave_types ON leaves.LeaveType = leave_types.id
        `;
        const [leaves] = await db.query(query);
        res.status(200).json(leaves);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

exports.getAllLeaveTypes = async (req, res) => {
    try {
        const [types] = await db.query(`SELECT * FROM leave_types`);
        res.status(200).json(types);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    // 1. Fetch Profile Data with joined department structural metadata
    const [employeeRows] = await db.query(`
      SELECT e.*, d.Department as department_name 
      FROM employee e
      LEFT JOIN Department d ON e.Department = d.id
      WHERE e.EmployeeID = ?
    `, [id]);

    if (!employeeRows || employeeRows.length === 0) {
      return res.status(404).json({ message: "Employee profile record not found." });
    }

    const employeeData = employeeRows[0];

    // 2. Fetch linked structural items from employee_education_details
    const [educationRows] = await db.query(
      'SELECT * FROM employee_education_details WHERE emp_id = ? ORDER BY id DESC',
      [id]
    );

    // 3. Respond with an integrated data structure
    return res.status(200).json({
      ...employeeData,
      education: educationRows || []
    });

  } catch (error) {
    console.error("Error fetching single employee dataset:", error);
    return res.status(500).json({ 
      message: "Failed to fetch unified employee metrics profiles.", 
      error: error.message 
    });
  }
};

exports.getEmployeeStatus = async (req, res) => {
    try {
        const [statuses] = await db.query('SELECT * FROM employee_status ORDER BY employee_status ASC');
        res.status(200).json(statuses);
    } catch (error) {
        console.error("Error fetching statuses:", error);
        res.status(500).json({ message: "Failed to fetch statuses", error: error.message });
    }
};

exports.getAnnouncements = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM noticeboard ORDER BY id DESC');
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching announcements:", error);
        res.status(500).json({ message: "Failed to fetch announcements", error: error.message });
    }
};

exports.getAllSupervisors = async (req, res) => {
    try {
        const query = `
            SELECT *
            FROM employee
            WHERE LOWER(role) IN ('manager','supervisor')
              AND ArchiveStatus = '0'
              AND Status = 'Active'
            ORDER BY FirstName ASC
        `;

        const [rows] = await db.query(query);

        res.status(200).json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch supervisors"
        });
    }
};

exports.getAllInDirectSupervisors = async (req, res) => {
    try {
        const query = `SELECT * FROM employee WHERE role IN ('hr') ORDER BY EmployeeID DESC`;
        const [rows] = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching in-direct supervisors API:", error.message);
        res.status(500).json({ message: "Failed to fetch in-direct supervisors", error: error.message });
    }
};

exports.getClients = async (req, res) => {
    try {
        const query = `SELECT * FROM pms_client ORDER BY ClientId DESC`;
        const [rows] = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({ message: "Failed to fetch clients", error: error.message });
    }
};

exports.getAllProjects = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.clientname 
      FROM pms_project p 
      LEFT JOIN pms_client c ON p.clientid = c.clientid
      ORDER BY p.projectid DESC
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ message: 'Failed to retrieve project directory records.' });
  }
};

// 2. GET SINGLE PROJECT BY ID
exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM pms_project WHERE projectid = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Project record not found.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving specific project schema.' });
  }
};

exports.getClientsLookup = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT clientid, clientname FROM pms_client ORDER BY clientname ASC');
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load reference client mapping dictionary.' });
  }
};


exports.getTeamTimesheets = async (req, res) => {
    try {
        const { supervisorId, role } = req.query; 

        if (!supervisorId) {
            return res.status(400).json({ message: "Missing supervisor authentication parameter context." });
        }

        // Check if the user has global oversight capabilities
        const isGlobalAdmin = (role === 'admin' || role === 'hr' || role === 'leader');

        let query = "";
        let queryParams = [];

        if (isGlobalAdmin) {
            // GLOBAL OVERSIGHT: Fetch ALL timesheets across the company
            query = `
                SELECT 
                    t.*, 
                    e.FirstName, e.LastName,
                    e.DirectSupervisor, e.IndirectSupervisor,
                    d.Department as DepartmentName
                FROM pms_timesheet t
                LEFT JOIN employee e ON t.employeeid = e.EmployeeID
                LEFT JOIN department d ON t.departmentid = d.id
                ORDER BY t.timesheetdate DESC, t.employeeid ASC, t.timesheetid ASC
            `;
        } else {
            // MANAGER OVERSIGHT: Fetch only employees assigned to this supervisor
            const [supRows] = await db.query(
                `SELECT CONCAT(FirstName, ' ', LastName) AS FullName FROM employee WHERE EmployeeID = ?`, 
                [supervisorId]
            );

            const supervisorName = supRows.length > 0 ? supRows[0].FullName : '';

            query = `
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
                   OR e.DirectSupervisor = ? 
                   OR e.IndirectSupervisor = ?
                ORDER BY t.timesheetdate DESC, t.employeeid ASC, t.timesheetid ASC
            `;
            queryParams = [supervisorName, supervisorName, supervisorId, supervisorId];
        }

        const [rows] = await db.query(query, queryParams);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching team timesheets:", error);
        res.status(500).json({ message: "Failed to load timesheets.", error: error.message });
    }
};

// ==========================================
//                POST CALLS
// ==========================================

exports.addLeaveType = async (req, res) => {
    try {
        const { typeName, daysAllowed, status } = req.body;
        const finalStatus = status || 'Active';

        const [result] = await db.query(
            `INSERT INTO leave_types (typeName, daysAllowed, status) VALUES (?, ?, ?)`,
            [typeName, daysAllowed, finalStatus]
        );
        
        res.status(201).json({ message: "Leave type added successfully", id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

exports.addEmployee = async (req, res) => {
    try {
        const employeeData = req.body;
        if (req.file) {
            employeeData.Photo = req.file.filename;
        }

        const today = new Date().toISOString().split('T')[0];
        employeeData.CreatedDate = today;
        employeeData.CreatedBy = 'Admin'; 

        if (employeeData.Password) {
            employeeData.Password = md5(employeeData.Password);
        }
        
        const columns = Object.keys(employeeData);
        const values = Object.values(employeeData);
        const placeholders = columns.map(() => '?').join(', ');
        
        const query = `INSERT INTO employee (${columns.join(', ')}) VALUES (${placeholders})`;
        const [result] = await db.query(query, values);
        
        res.status(201).json({ message: "Employee added successfully", employeeId: result.insertId });
    } catch (error) {
        console.error("Error adding employee:", error);
        res.status(500).json({ message: "Failed to save employee", error: error.message });
    }
};

exports.addEmployeeStatus = async (req, res) => {
    try {
        const { employee_status } = req.body; 
        const query = `INSERT INTO employee_status (employee_status) VALUES (?)`;
        await db.query(query, [employee_status]);
        res.status(201).json({ message: "Status added successfully!" });
    } catch (error) {
        console.error("Error adding status:", error);
        res.status(500).json({ message: "Failed to add status", error: error.message });
    }
};

exports.addAnnouncement = async (req, res) => {
    try {
        // FIXED: Added Description parameter from payload destruction
        const { Notice, Description, NoticeDate, EndDate, CreatedBy } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const photoPath = req.file ? req.file.filename : ''; 

        const query = `
            INSERT INTO noticeboard 
            (Notice, Description, Photo, NoticeDate, CreatedDate, EndDate, ModifiedDate, CreatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const creatorId = CreatedBy || 1; 

        // FIXED: Mapped Description value directly into database binding query block
        const [result] = await db.query(query, [Notice, Description || "", photoPath, NoticeDate, today, EndDate || null, today, creatorId]);
        res.status(201).json({ message: "Announcement published successfully!", id: result.insertId });
    } catch (error) {
        console.error("Error adding announcement:", error);
        res.status(500).json({ message: "Failed to create announcement", error: error.message });
    }
};

exports.addClient = async (req, res) => {
    try {
        const clientData = { ...req.body };
        const today = new Date().toISOString().split('T')[0];
        
        clientData.CreatedDate = today;
        clientData.CreatedBy = 1;

        delete clientData.CDAStartdate;
        delete clientData.CDAEnddate;
        delete clientData.MSAStartdate;
        delete clientData.MSAEnddate;

        // FIXED: Explicitly pass 'true' for core fields that your database restricts with NOT NULL
        const requiredFields = ['CDAStart', 'CDAEnd', 'MSAStart', 'MSAEnd'];
        const optionalFields = ['MSADraftInitiationDate', 'LocalAgreementStartdate', 'LocalAgreementEnddate'];

        requiredFields.forEach(field => {
            clientData[field] = sanitizeDbDates(clientData[field], true);
        });
        optionalFields.forEach(field => {
            clientData[field] = sanitizeDbDates(clientData[field], false);
        });

        const columns = Object.keys(clientData);
        const values = Object.values(clientData);
        const placeholders = columns.map(() => '?').join(', ');

        const query = `INSERT INTO pms_client (${columns.join(', ')}) VALUES (${placeholders})`;
        const [result] = await db.query(query, values);

        res.status(201).json({ message: "Client profile created successfully", clientId: result.insertId });
    } catch (error) {
        console.error("Error adding client:", error);
        res.status(500).json({ message: "Failed to save client profile", error: error.message });
    }
};

exports.createProject = async (req, res) => {
  try {
    const data = req.body;
    
    const query = `
      INSERT INTO pms_project (
        projectcode, protocol, clientid, clientstudyid, studyid, tid, currencyid,
        studytype, noofsites, noofsubject, noofvisits, studyduration, edc,
        contractsigndate, totalcontractvalue, submissiontype, contractsigned,
        expectedstudystartdate, expectedstudyenddate, actualstudystartdate, actualstudyenddate,
        startdatecomment, enddatecomment, protocol_desc, createdby, createddate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      data.projectcode, data.protocol, data.clientid || null, data.clientstudyid || null,
      data.studyid || null, data.tid || null, data.currencyid || null, data.studytype || null,
      data.noofsites || null, data.noofsubject || null, data.noofvisits || null, data.studyduration || null,
      data.edc || null, data.contractsigndate || null, data.totalcontractvalue || null,
      data.submissiontype, data.contractsigned || 0,
      data.expectedstudystartdate, data.expectedstudyenddate, data.actualstudystartdate, data.actualstudyenddate,
      data.startdatecomment, data.enddatecomment, data.protocol_desc, data.userId || null
    ];

    const [result] = await db.query(query, values);
    res.status(201).json({ message: 'Project record created successfully', projectid: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to commit new project record to database.' });
  }
};

// ==========================================
//               UPDATE CALLS
// ==========================================

// exports.updateEmployee = async (req, res) => {
//     try {
//         console.log("Update employee API invoked with payload:", req.body);
//         const { id } = req.params;
//         const employeeData = req.body;
//         console.log(employeeData)
//         // If a file is uploaded, attach its filename to employeeData
//         if (req.file) {
//             employeeData.Photo = req.file.filename;
//         }

//         // Clean up un-updatable keys 
//         delete employeeData.EmployeeID;
//         delete employeeData.CreatedDate;
//         delete employeeData.CreatedBy;
        
//         // If no file was sent, and the frontend sent an empty photo field,
//         // we check if it's meant to clear it or if we should skip updating it
//         if (!req.file && (employeeData.Photo === undefined || employeeData.Photo === '')) {
//              delete employeeData.Photo; 
//         }

//         const today = new Date().toISOString().split('T')[0];
//         employeeData.ModifiedDate = today;

//         if (employeeData.Password) {
//             employeeData.Password = md5(employeeData.Password);
//         } else {
//              delete employeeData.Password;
//         }

//         const columns = Object.keys(employeeData);
//         const values = Object.values(employeeData);
        
//         if (columns.length === 0) {
//             return res.status(400).json({ message: "No data provided to update" });
//         }

//         const setClause = columns.map(col => `${col} = ?`).join(', ');
//         const query = `UPDATE employee SET ${setClause} WHERE EmployeeID = ?`;
//         values.push(id);

//         const [result] = await db.query(query, values);

//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: "Employee not found" });
//         }

//         res.status(200).json({ message: "Employee updated successfully" });
//     } catch (error) {
//         console.error("Error updating employee:", error);
//         res.status(500).json({ message: "Failed to update employee", error: error.message });
//     }
// };

exports.updateEmployee = async (req, res) => {
    try {
        console.log("Update employee API invoked with payload:", req.body);
        const { id } = req.params;
        const employeeData = req.body;

        // If a file is uploaded, attach its filename to employeeData
        if (req.file) {
            employeeData.Photo = req.file.filename;
        }

        // 1. STRIP UN-UPDATABLE & JOINED VIRTUAL FIELDS (Fixes the crash)
        const fieldsToIgnore = [
            'EmployeeID',
            'CreatedDate',
            'CreatedBy',
            'department_name', // Remove virtual joined columns from getEmployeeById
            'education'        // Remove the nested array from getEmployeeById
        ];
        
        fieldsToIgnore.forEach(field => {
            delete employeeData[field];
        });
        
        // If no file was sent, and the frontend sent an empty photo field,
        // check if it's meant to clear it or if we should skip updating it
        if (!req.file && (employeeData.Photo === undefined || employeeData.Photo === '')) {
             delete employeeData.Photo; 
        }

        const today = new Date().toISOString().split('T')[0];
        employeeData.ModifiedDate = today;

        // ─── UPDATED PASSWORD CHECK BLOCK ───
        // Only hash and update the password if it's provided, not empty, and not placeholder text
        if (
            employeeData.Password && 
            employeeData.Password.trim() !== "" && 
            employeeData.Password !== "undefined" && 
            employeeData.Password !== "null"
        ) {
            employeeData.Password = md5(employeeData.Password);
        } else {
            // Completely remove Password from the dataset so it is omitted from the SQL UPDATE query
            delete employeeData.Password;
        }
        // ────────────────────────────────────

        // 2. Build safe update query using remaining real columns
        const columns = Object.keys(employeeData);
        const values = Object.values(employeeData);
        
        if (columns.length === 0) {
            return res.status(400).json({ message: "No data provided to update" });
        }

        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const query = `UPDATE employee SET ${setClause} WHERE EmployeeID = ?`;
        values.push(id);

        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }

        res.status(200).json({ message: "Employee updated successfully" });
    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({ message: "Failed to update employee", error: error.message });
    }
};

exports.updateEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { employee_status } = req.body;

        const query = `UPDATE employee_status SET employee_status = ? WHERE id = ?`;
        const [result] = await db.query(query, [employee_status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Status entry not found" });
        }

        res.status(200).json({ message: "Status updated successfully!" });
    } catch (error) {
        console.error("Error updating employee status:", error);
        res.status(500).json({ message: "Failed to update status option", error: error.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        // FIXED: Added Description destructured parameter tracking
        const { Notice, Description, NoticeDate, EndDate } = req.body;
        const today = new Date().toISOString().split('T')[0];

        let query = '';
        let queryParams = [];

        // FIXED: Included Description inside query maps safely
        if (req.file) {
            query = `
                UPDATE noticeboard 
                SET Notice = ?, Description = ?, Photo = ?, NoticeDate = ?, EndDate = ?, ModifiedDate = ? 
                WHERE id = ?
            `;
            queryParams = [Notice, Description || "", req.file.filename, NoticeDate, EndDate || null, today, id];
        } else {
            query = `
                UPDATE noticeboard 
                SET Notice = ?, Description = ?, NoticeDate = ?, EndDate = ?, ModifiedDate = ? 
                WHERE id = ?
            `;
            queryParams = [Notice, Description || "", NoticeDate, EndDate || null, today, id];
        }

        const [result] = await db.query(query, queryParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }

        res.status(200).json({ message: "Announcement updated successfully!" });
    } catch (error) {
        console.error("Error updating announcement:", error);
        res.status(500).json({ message: "Failed to update announcement", error: error.message });
    }
};

exports.updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const clientData = { ...req.body };

        delete clientData.ClientId;
        delete clientData.CreatedDate;
        delete clientData.CreatedBy;

        delete clientData.CDAStartdate;
        delete clientData.CDAEnddate;
        delete clientData.MSAStartdate;
        delete clientData.MSAEnddate;

        // FIXED: Safely intercept fields that your SQL schema marks as NOT NULL
        const requiredFields = ['CDAStart', 'CDAEnd', 'MSAStart', 'MSAEnd'];
        const optionalFields = ['MSADraftInitiationDate', 'LocalAgreementStartdate', 'LocalAgreementEnddate'];

        requiredFields.forEach(field => {
            clientData[field] = sanitizeDbDates(clientData[field], true);
        });
        optionalFields.forEach(field => {
            clientData[field] = sanitizeDbDates(clientData[field], false);
        });

        const columns = Object.keys(clientData);
        const values = Object.values(clientData);
        
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const query = `UPDATE pms_client SET ${setClause} WHERE ClientId = ?`;
        
        values.push(id);

        const [result] = await db.query(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Client registry not found" });
        }

        res.status(200).json({ message: "Client profile updated successfully" });
    } catch (error) {
        console.error("Error updating client:", error);
        res.status(500).json({ message: "Failed to update client profile", error: error.message });
    }
};

exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const query = `
      UPDATE pms_project SET 
        projectcode = ?, protocol = ?, clientid = ?, clientstudyid = ?, studyid = ?, 
        tid = ?, currencyid = ?, studytype = ?, noofsites = ?, noofsubject = ?, 
        noofvisits = ?, studyduration = ?, edc = ?, contractsigndate = ?, totalcontractvalue = ?, 
        submissiontype = ?, contractsigned = ?, expectedstudystartdate = ?, expectedstudyenddate = ?, 
        actualstudystartdate = ?, actualstudyenddate = ?, startdatecomment = ?, enddatecomment = ?, 
        protocol_desc = ?, modifiedby = ?, modifieddate = NOW()
      WHERE projectid = ?
    `;

    const values = [
      data.projectcode, data.protocol, data.clientid || null, data.clientstudyid || null,
      data.studyid || null, data.tid || null, data.currencyid || null, data.studytype || null,
      data.noofsites || null, data.noofsubject || null, data.noofvisits || null, data.studyduration || null,
      data.edc || null, data.contractsigndate || null, data.totalcontractvalue || null,
      data.submissiontype, data.contractsigned || 0,
      data.expectedstudystartdate, data.expectedstudyenddate, data.actualstudystartdate, data.actualstudyenddate,
      data.startdatecomment, data.enddatecomment, data.protocol_desc, data.userId || null,
      id
    ];

    const [result] = await db.query(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Project record to update not found.' });
    }

    res.status(200).json({ message: 'Project parameters updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Transactional updates execution failed.' });
  }
};

// ==========================================
//               DELETE CALLS
// ==========================================

exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            UPDATE employee 
            SET ArchiveStatus = '1', Status = 'Inactive' 
            WHERE EmployeeID = ?
        `;
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }

        res.status(200).json({ message: "Employee successfully archived" });
    } catch (error) {
        console.error("Error soft deleting employee:", error);
        res.status(500).json({ message: "Failed to delete employee", error: error.message });
    }
};

exports.deleteEmployeeStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `DELETE FROM employee_status WHERE id = ?`;
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Status entry not found" });
        }

        res.status(200).json({ message: "Status option removed successfully!" });
    } catch (error) {
        console.error("Error deleting employee status:", error);
        res.status(500).json({ message: "Failed to remove status option", error: error.message });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM noticeboard WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Announcement not found" });
        }

        res.status(200).json({ message: "Announcement deleted successfully!" });
    } catch (error) {
        console.error("Error deleting announcement:", error);
        res.status(500).json({ message: "Failed to delete announcement", error: error.message });
    }
};

exports.deleteClient = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM pms_client WHERE ClientId = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Client registry not found" });
        }

        res.status(200).json({ message: "Client profile successfully purged" });
    } catch (error) {
        console.error("Error executing client purge:", error);
        res.status(500).json({ message: "Failed to delete client profile", error: error.message });
    }
};

exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM pms_project WHERE projectid = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Target project record does not exist.' });
    }
    res.status(200).json({ message: 'Project row successfully dropped from master tables.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Database constraint restriction prevented dropping row.' });
  }
};
