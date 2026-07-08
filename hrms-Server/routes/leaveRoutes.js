const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const verifyToken = require("../middlewares/authMiddleware");
const checkRole = require("../middlewares/roleMiddleware");
const leaveController = require("../controllers/leaveController");

// ─── File upload (doctor prescription) ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/leave-docs"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ─── Employee routes ─────────────────────────────────────────────────────────
router.get("/balance", verifyToken, leaveController.getBalance);
router.get("/my-requests", verifyToken, leaveController.getMyRequests);
router.get("/all-requests", verifyToken, leaveController.getAllRequests);
router.get("/requests", verifyToken, leaveController.getAllRequests); 
router.post("/apply", verifyToken, upload.single("attachment"), leaveController.applyLeave);

// ─── Pending Approvals (Manager/HR/Admin) ────────────────────────────────────
router.get("/pending-approvals", verifyToken, leaveController.getPendingApprovals);

// ─── Approve / Reject ─────────────────────────────────────────────────────────
router.put("/:id/approve", verifyToken, leaveController.approveLeave);
router.put("/:id/reject", verifyToken, leaveController.rejectLeave);

// ─── Employee Leave Details (Manager/HR/Admin) ──────────────────────────────
router.get("/employee/:employeeId/details", verifyToken, leaveController.getEmployeeLeaveDetails);

// ─── Fixed Holidays (Admin only) ─────────────────────────────────────────────
router.get("/holidays/fixed", verifyToken, leaveController.getFixedHolidays);
router.post("/holidays/fixed", verifyToken, leaveController.createFixedHoliday);
router.delete("/holidays/fixed/:id", verifyToken, leaveController.deleteFixedHoliday);

// ─── Flexi Holidays ───────────────────────────────────────────────────────────
router.get("/holidays/flexi/active", leaveController.getActiveFlexiHolidays);
router.get("/holidays/flexi/all", verifyToken, leaveController.getAllFlexiHolidays);
router.post("/holidays/flexi", verifyToken,  leaveController.createFlexiHoliday);
router.put("/holidays/flexi/:id", verifyToken, leaveController.updateFlexiHolidayStatus);
router.delete("/holidays/flexi/:id", verifyToken, leaveController.deleteFlexiHoliday);

// ─── Leave Policy (Admin only) ───────────────────────────────────────────────
router.get("/leave-policy", verifyToken, leaveController.getLeavePolicy);
router.put("/leave-policy", verifyToken, checkRole(['admin']), leaveController.updateLeavePolicy);

module.exports = router;