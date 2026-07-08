const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const candidateController = require("../controllers/candidateController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "ResumeFile") {
      cb(null, "uploads/resumes");
    } else {
      cb(null, "uploads/photos");
    }
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });



router.post(
  "/create",
  upload.fields([
    { name: "ResumeFile", maxCount: 1 },
    { name: "Photo", maxCount: 1 },
  ]),
  candidateController.createCandidate
);

router.get("/all", candidateController.getCandidates);


router.get(
  "/pipeline",
  candidateController.getPipelineCandidates
);

router.post(
  "/interviews/schedule",
  candidateController.scheduleInterview
);

router.post(
  "/interviews/update-outcome",
  candidateController.updateRoundOutcome
);


router.get(
  "/selected-list",
  candidateController.getSelectedCandidates
);

router.post(
  "/update-status",
  candidateController.updateCandidateStatus
);

// ── Pipeline comments/remarks ──────────────────────────────────────────────
router.get(
  "/comments/:id",
  candidateController.getCandidateComments
);

router.post(
  "/comments/add",
  candidateController.addCandidateComment
);


router.post(
  "/convert-employee",
  candidateController.convertToEmployee
);

router.get(
  "/employee-created-list",
  candidateController.getEmployeeCreatedCandidates
);

router.post(
  "/mark-joined",
  candidateController.markEmployeeJoined
);

router.post(
  "/appointment-letter-accepted",
  candidateController.acceptAppointmentLetter
);

router.post(
  "/send-appointment-letter",
  candidateController.sendAppointmentLetter
);

router.post('/api/candidates/send-appointment-letter', candidateController.sendAppointmentLetter);

router.get("/:id", candidateController.getCandidateById);

module.exports = router;