const db = require('../config/db');

exports.getAllRequestsForHR = async (req, res) => {
    try {
        // HR handles all entries sorted chronologically
        const query = `SELECT * FROM service_requests ORDER BY status ASC, id DESC`;
        const [rows] = await db.query(query);
        
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching HR master pool:", error);
        res.status(500).json({ success: false, message: "Internal server error reading master data tracks." });
    }
};

exports.updateRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, hrComments } = req.body; // status logic: 1 = Approved, 2 = Rejected

        if (status === undefined || status === null) {
            return res.status(400).json({ success: false, message: "Target validation status token required." });
        }

        const query = `UPDATE service_requests SET status = ?, hr_comments = ? WHERE id = ?`;
        const [result] = await db.query(query, [status, hrComments || null, requestId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Target request track node not found." });
        }

        res.status(200).json({ success: true, message: "Request system status updated clean." });
    } catch (error) {
        console.error("Error updating ticket resolution:", error);
        res.status(500).json({ success: false, message: "Failed to modify configuration table states." });
    }
};