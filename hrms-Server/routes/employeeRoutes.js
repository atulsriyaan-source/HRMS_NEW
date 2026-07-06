const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const employeeController = require('../controllers/employeeController');

// =========================================================================
// ADVANCED DYNAMIC MULTIPART STORAGE ENGINE
// =========================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Dynamic path handling allocation parameters based on fields route check
    if (file.fieldname === "attachment") {
      cb(null, "uploads/resignations/");
    } else if (file.fieldname === "Attachment") {
      cb(null, "uploads/requests/"); // New dedicated directory for generic tickets proof blocks
    } else {
      cb(null, "uploads/");
    }
  },
  filename: (req, file, cb) => {
    // Clean dynamic token filename creation to wipe out name clashes entirely
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

router.get("/dashboard-summary", employeeController.getDashboardSummary);

// =========================================================================
// RESIGNATION SYSTEM ENDPOINTS
// =========================================================================
router.post(
  "/submit-resignation",
  upload.single("attachment"),
  employeeController.submitResignation
);
router.get("/active-resignation", employeeController.getActiveResignation);
router.get("/all-resignations", employeeController.getAllResignations);
router.put("/update-resignation-status", employeeController.updateResignationStatus);

// =========================================================================
// TIMESHEET TRACKING WORKSPACE ENDPOINTS
// =========================================================================
router.get('/timesheets', employeeController.getTimesheets);
router.post('/timesheets', employeeController.addTimesheet);
router.put('/timesheets/:id', employeeController.updateTimesheet);
router.delete('/timesheets/:id', employeeController.deleteTimesheet); 

// =========================================================================
// UNIVERSAL GENERALIZED SERVICE REQUEST ENTRIES (With Optional Upload Interceptor)
// =========================================================================
// FIXED: Integrated upload handling directly inside POST route pipeline matching the form payload field name "Attachment"
router.post(
  "/requests", 
  upload.single("Attachment"), 
  employeeController.createRequest
);
router.get("/requests", employeeController.getEmployeeRequests);


module.exports = router;