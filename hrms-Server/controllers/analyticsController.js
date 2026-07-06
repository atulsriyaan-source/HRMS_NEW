const db = require('../config/db');

exports.getDashboardMetrics = async (req, res) => {
  try {
    const { timeframe, department, type } = req.query;

    // --- Base Conditions Array for Dynamic Filtering ---
    let whereClauses = ["e.ArchiveStatus = '1'"]; // Base filter to omit archived profiles
    let queryParams = [];

    if (department && department !== "All Departments") {
      whereClauses.push("d.Department = ?");
      queryParams.push(department);
    }
    if (type && type !== "All Types") {
      whereClauses.push("e.StatusOfEmployee = ?");
      queryParams.push(type);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // =========================================================================
    // 1. QUERY: High-Level KPI Matrix Data Summary
    // =========================================================================
    const kpiQuery = `
      SELECT 
        COUNT(e.EmployeeID) as totalHeadcount,
        SUM(CASE WHEN e.CreatedDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as newJoiners,
        SUM(CASE WHEN e.Status = 'Inactive' THEN 1 ELSE 0 END) as inactiveCount
      FROM Employee e
      LEFT JOIN Department d ON e.Department = d.id
      ${whereSQL}
    `;

    // =========================================================================
    // 2. QUERY: Bar Graph Data - Headcount Grouped by Department
    // =========================================================================
    const deptQuery = `
      SELECT 
        COALESCE(d.Department, 'Unassigned') as name,
        COUNT(e.EmployeeID) as Headcount
      FROM Employee e
      LEFT JOIN Department d ON e.Department = d.id
      ${whereSQL}
      GROUP BY d.id, d.Department
      ORDER BY Headcount DESC
    `;

    // =========================================================================
    // 3. QUERY: Pie Chart Data - Types of Employment 
    // =========================================================================
    const typeQuery = `
      SELECT 
        COALESCE(e.StatusOfEmployee, 'Not Specified') as name,
        COUNT(e.EmployeeID) as value
      FROM Employee e
      LEFT JOIN Department d ON e.Department = d.id
      ${whereSQL}
      GROUP BY e.StatusOfEmployee
    `;

    // Execute queries concurrently using Promise.all
    const [kpiRows] = await db.query(kpiQuery, queryParams);
    const [deptRows] = await db.query(deptQuery, queryParams);
    const [typeRows] = await db.query(typeQuery, queryParams);

    const kpi = kpiRows[0] || { totalHeadcount: 0, newJoiners: 0, inactiveCount: 0 };
    
    // Formatting standard UI color matrices on backend to map onto the analytics charts
    const colors = ["#2b7da1", "#139287", "#d63a6e", "#f59e0b", "#64748b", "#7c3aed"];
    
    const formattedDeptData = deptRows.map((row, i) => ({
      ...row,
      color: colors[i % colors.length]
    }));

    const formattedTypeData = typeRows.map((row, i) => ({
      ...row,
      color: colors[(colors.length - 1 - i) % colors.length]
    }));

    // Respond with consolidated structured payload
    res.status(200).json({
      success: true,
      metrics: {
        totalHeadcount: kpi.totalHeadcount,
        newJoiners: kpi.newJoiners,
        attritionRate: kpi.totalHeadcount > 0 ? ((kpi.inactiveCount / kpi.totalHeadcount) * 100).toFixed(1) + "%" : "0%"
      },
      departmentData: formattedDeptData,
      employeeTypeData: formattedTypeData
    });

  } catch (error) {
    console.error("Analytics Generation Error:", error);
    res.status(500).json({ success: false, message: "Internal server registry breakdown runtime fault." });
  }
}