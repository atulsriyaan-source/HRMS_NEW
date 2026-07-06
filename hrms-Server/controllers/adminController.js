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
        const [employee] = await db.query('SELECT * FROM employee WHERE EmployeeID = ?', [id]);
        if (employee.length === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }
        res.status(200).json(employee[0]);
    } catch (error) {
        console.error("Error fetching single employee:", error);
        res.status(500).json({ message: "Failed to fetch employee", error: error.message });
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
        const query = `SELECT * FROM employee WHERE role IN ('manager') ORDER BY EmployeeID DESC`;
        const [rows] = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching supervisors API:", error.message);
        res.status(500).json({ message: "Failed to fetch supervisors", error: error.message });
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

exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const employeeData = req.body;

        if (req.file) {
            employeeData.Photo = req.file.filename;
        }

        delete employeeData.EmployeeID;
        delete employeeData.CreatedDate;
        delete employeeData.CreatedBy;
        
        if (!req.file && employeeData.Photo !== undefined) {
             delete employeeData.Photo; 
        }

        const today = new Date().toISOString().split('T')[0];
        employeeData.ModifiedDate = today;

        if (employeeData.Password) {
            employeeData.Password = md5(employeeData.Password);
        } else {
             delete employeeData.Password;
        }

        const columns = Object.keys(employeeData);
        const values = Object.values(employeeData);
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
