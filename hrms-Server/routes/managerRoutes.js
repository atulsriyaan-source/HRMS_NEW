const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');

// Route to fetch timesheets filtered by Direct Supervisor or Indirect Supervisor (HR)
router.get('/timesheets', managerController.getTeamTimesheets);

router.get('/dashboard-summary', managerController.getManagerDashboardSummary);

// Route to update approval status (Approve / Reject) for a specific task entry step
router.put('/timesheets/review/:id', managerController.reviewTimesheetStatus);

module.exports = router;