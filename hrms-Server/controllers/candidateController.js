const db = require("../config/db");
const md5 = require("md5");

// ─── Pipeline stages in order ──────────────────────────────────────────────────
const PIPELINE_STAGES = [
  "Domain Interview",
  "Management Interview",
  "Offer Discussion",
  "Offer Process",
];

const getNextStage = (currentRoundName) => {
  const idx = PIPELINE_STAGES.indexOf(currentRoundName);
  if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1];
};

// Rounds a Manager (assigned interviewer) is responsible for evaluating.
// HR schedules these but does NOT evaluate them.
const MANAGER_EVALUATED_ROUNDS = ["Domain Interview", "Management Interview"];
// Rounds HR is responsible for handling end-to-end (scheduling + evaluating).
const HR_EVALUATED_ROUNDS = ["Offer Discussion", "Offer Process"];

// ─── Create Candidate ──────────────────────────────────────────────────────────
exports.createCandidate = async (req, res) => {
  try {
    const {
      FirstName, MiddleName, LastName, Gender, DateOfBirth, MaritalStatus,
      Nationality, EmailId, AlternateEmailId, CountryCode1, MobileNo,
      CountryCode2, AlternateMobileNo,
      SpouseContactNo, MotherContactNo, FatherContactNo,
      EmergencyContactNo, EmergencyContactName,
      CurrentAddress, City, State, Country,
      AppliedDesignation, AppliedDepartment, CurrentCompany, CurrentDesignation,
      TotalExperience, CurrentCTC, ExpectedCTC, NoticePeriod, SourceOfHiring,
    } = req.body;

    const resume = req.files?.ResumeFile?.[0]?.filename || null;
    const photo  = req.files?.Photo?.[0]?.filename || null;

    if (!FirstName || !LastName || !EmailId || !MobileNo || !AppliedDesignation) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const [existing] = await db.query(
      `SELECT CandidateID FROM interview_candidates WHERE EmailId = ?`, [EmailId]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: "Candidate already exists with this email" });
    }

    await db.query(
      `INSERT INTO interview_candidates (
        FirstName, MiddleName, LastName, Gender, DateOfBirth, MaritalStatus, Nationality,
        EmailId, AlternateEmailId, CountryCode1, MobileNo, CountryCode2, AlternateMobileNo,
        SpouseContactNo, MotherContactNo, FatherContactNo, EmergencyContactNo, EmergencyContactName,
        CurrentAddress, City, State, Country, AppliedDesignation, AppliedDepartment,
        CurrentCompany, CurrentDesignation, TotalExperience, CurrentCTC, ExpectedCTC,
        NoticePeriod, SourceOfHiring, CandidateStatus, ResumeFile, Photo
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        FirstName, MiddleName, LastName, Gender, DateOfBirth, MaritalStatus, Nationality,
        EmailId, AlternateEmailId, CountryCode1, MobileNo, CountryCode2, AlternateMobileNo,
        SpouseContactNo || null, MotherContactNo || null, FatherContactNo || null,
        EmergencyContactNo || null, EmergencyContactName || null,
        CurrentAddress, City, State, Country, AppliedDesignation, AppliedDepartment,
        CurrentCompany, CurrentDesignation, TotalExperience, CurrentCTC, ExpectedCTC,
        NoticePeriod, SourceOfHiring, "Applied", resume, photo,
      ]
    );

    res.status(201).json({ success: true, message: "Candidate created successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get All Candidates ────────────────────────────────────────────────────────

exports.getCandidates = async (req, res) => {
  try {
    const { role, department } = req.query;
    const isManager = (role || "").toLowerCase() === "manager";

    let sql = `SELECT * FROM interview_candidates`;
    const params = [];
    if (isManager && department) {
      sql += ` WHERE AppliedDepartment = ?`;
      params.push(department);
    }
    sql += ` ORDER BY CandidateID DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Candidate By ID ───────────────────────────────────────────────────────
exports.getCandidateById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM interview_candidates WHERE CandidateID = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Candidate not found" });
    res.json({ success: true, candidate: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPipelineCandidates = async (req, res) => {
  try {
    // Server-side RBAC (see note on getCandidates above).
    const { role, department } = req.query;
    const isManager = (role || "").toLowerCase() === "manager";

    let sql = `
      SELECT * FROM interview_candidates
      WHERE CandidateStatus NOT IN (
        'Offer Accepted','Employee Created','Appointment Letter Sent',
        'Appointment Letter Accepted','Joined'
      )
    `;
    const params = [];
    if (isManager && department) {
      sql += ` AND AppliedDepartment = ?`;
      params.push(department);
    }
    sql += ` ORDER BY CandidateID DESC`;

    const [candidates] = await db.query(sql, params);

    for (const c of candidates) {
      const [rounds] = await db.query(`
        SELECT
          RoundID, RoundNumber, RoundName, RoundResult,
          InterviewFeedback, TechnicalScore, CommunicationScore,
          AttitudeScore, DomainKnowledgeScore, OverallScore,
          InterviewDate, InterviewerName, InterviewerId,
          InterviewerDesignation, AdditionalInterviewers, InterviewMode
        FROM interview_rounds
        WHERE CandidateID = ?
        ORDER BY RoundID ASC
      `, [c.CandidateID]);

      c.RoundHistory = rounds;

      // ── Deduplicate: for each RoundName keep only the latest row ──────────
      const latestByName = {};
      for (const r of rounds) {
        // Always overwrite — since rounds are ASC by RoundID, last one wins
        latestByName[r.RoundName] = r;
      }
      const dedupedRounds = Object.values(latestByName);
      // Restore original order by RoundID
      dedupedRounds.sort((a, b) => a.RoundID - b.RoundID);

      // ── Find the ACTIVE round ─────────────────────────────────────────────
      // Priority 1: last round with date but no result (scheduled, needs eval)
      // Priority 2: last Hold round (needs re-evaluation)
      // Priority 3: last Pass round that has a next stage (needs scheduling)
      // Priority 4: absolute last round

      let lastRound = null;

      const pendingEval = dedupedRounds.filter(
        r => r.InterviewDate && !r.RoundResult
      );
      const holdRounds = dedupedRounds.filter(
        r => r.RoundResult === "Hold"
      );
      const passedRounds = dedupedRounds.filter(
        r => r.RoundResult === "Pass"
      );

      if (pendingEval.length) {
        // Scheduled but not yet evaluated — needs Evaluate button
        lastRound = pendingEval[pendingEval.length - 1];
      } else if (holdRounds.length) {
        // On hold — needs Re-evaluate button
        lastRound = holdRounds[holdRounds.length - 1];
      } else if (passedRounds.length) {
        // All passed — last passed round drives next schedule
        lastRound = passedRounds[passedRounds.length - 1];
      } else {
        lastRound = dedupedRounds.length
          ? dedupedRounds[dedupedRounds.length - 1]
          : null;
      }

      if (lastRound) {
        c.LatestRoundID    = lastRound.RoundID;
        c.CurrentRoundName = lastRound.RoundName;
        c.EvaluationResult = lastRound.RoundResult || null;
        // Who is allowed to evaluate this round — feeds the frontend's
        // isAssignedManager check in InterviewPipeline.jsx.
        c.AssignedInterviewerId = lastRound.InterviewerId || null;
        c.AssignedInterviewerName = lastRound.InterviewerName || null;
        c.AdditionalInterviewers = lastRound.AdditionalInterviewers
          ? JSON.parse(lastRound.AdditionalInterviewers)
          : [];
      } else {
        c.LatestRoundID    = null;
        c.CurrentRoundName = null;
        c.EvaluationResult = null;
        c.AssignedInterviewerId = null;
        c.AdditionalInterviewers = [];
      }

      // ── NextRoundPending ──────────────────────────────────────────────────
      c.NextRoundPending = false;
      if (c.EvaluationResult === "Pass" && c.CurrentRoundName) {
        const next = getNextStage(c.CurrentRoundName);
        if (next) {
          // Check in deduped rounds if next stage already exists
          const alreadyScheduled = dedupedRounds.some(
            r => r.RoundName === next && (r.InterviewDate || r.RoundResult)
          );
          c.NextRoundPending = !alreadyScheduled;
        }
      }

      c.ResumeURL = c.ResumeFile
        ? `${process.env.BASE_URL}/uploads/resumes/${c.ResumeFile}`
        : null;
      c.PhotoURL = c.Photo
        ? `${process.env.BASE_URL}/uploads/photos/${c.Photo}`
        : null;
    }

    res.json(candidates);
  } catch (error) {
    console.error("Pipeline Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Candidate Profile ─────────────────────────────────────────────────────
exports.getCandidateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const [candidate] = await db.query(
      `SELECT * FROM interview_candidates WHERE CandidateID = ?`, [id]
    );
    if (!candidate.length) return res.status(404).json({ success: false, message: "Candidate not found" });

    const c = candidate[0];
    const [rounds] = await db.query(
      `SELECT * FROM interview_rounds WHERE CandidateID = ? ORDER BY RoundNumber ASC`, [id]
    );

    res.json({
      success: true,
      candidate: {
        ...c,
        ResumeURL: c.ResumeFile ? `${process.env.BASE_URL}/uploads/resumes/${c.ResumeFile}` : null,
        PhotoURL:  c.Photo      ? `${process.env.BASE_URL}/uploads/photos/${c.Photo}`       : null,
      },
      rounds,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    let {
      CandidateID, RoundName, InterviewDate, InterviewTime,
      InterviewMode, InterviewerId, InterviewerName, InterviewerDesignation,
      Department, MeetingLink, Location, AdditionalInterviewers,
      ScheduledBy, ScheduledByRole,
    } = req.body;

    if (!CandidateID || !RoundName || !InterviewDate || !InterviewTime) {
      return res.status(400).json({ success: false, message: "CandidateID, RoundName, InterviewDate, and InterviewTime are required" });
    }

    const role = (ScheduledByRole || "").toLowerCase();
    if (role && role !== "hr" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Only HR can schedule interviews" });
    }

    // HR-only rounds: ignore interviewer fields
    const HR_ROUNDS = ["Offer Discussion", "Offer Process"];
    if (HR_ROUNDS.includes(RoundName)) {
      InterviewerId = null;
      InterviewerName = "HR";
      InterviewerDesignation = "HR";
      Department = null;
      AdditionalInterviewers = null;
    }

    const interviewDateTime = `${InterviewDate} ${InterviewTime}:00`;

    const [lastRound] = await db.query(
      `SELECT MAX(RoundNumber) AS MaxRound FROM interview_rounds WHERE CandidateID = ?`,
      [CandidateID]
    );
    const nextRoundNumber = (lastRound[0]?.MaxRound || 0) + 1;

    let additionalInterviewersJson = null;
    if (AdditionalInterviewers && !HR_ROUNDS.includes(RoundName)) {
      try {
        const parsed = typeof AdditionalInterviewers === "string" ? JSON.parse(AdditionalInterviewers) : AdditionalInterviewers;
        const cleaned = (Array.isArray(parsed) ? parsed : []).filter(row => row && row.EmployeeID);
        if (cleaned.length) additionalInterviewersJson = JSON.stringify(cleaned);
      } catch (e) {
        console.warn("AdditionalInterviewers parse error:", e.message);
      }
    }

    await db.query(
      `INSERT INTO interview_rounds (
        CandidateID, RoundNumber, RoundName, InterviewMode, InterviewDate,
        InterviewerName, InterviewerId, InterviewerDesignation,
        AdditionalInterviewers, Department, MeetingLink, Location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        CandidateID, nextRoundNumber, RoundName, InterviewMode, interviewDateTime,
        InterviewerName || null, InterviewerId || null, InterviewerDesignation || null,
        additionalInterviewersJson, Department || null,
        MeetingLink || null, Location || null,
      ]
    );

    let newStatus = "Interview Scheduled";
    if (RoundName === "Offer Discussion") newStatus = "Offer Discussion";
    else if (RoundName === "Offer Process") newStatus = "Offer Process";

    await db.query(
      `UPDATE interview_candidates SET CandidateStatus = ?, AssignedInterviewerId = ? WHERE CandidateID = ?`,
      [newStatus, InterviewerId || null, CandidateID]
    );

    res.json({ success: true, message: "Interview scheduled successfully" });
  } catch (error) {
    console.error("Schedule Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRoundOutcome = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      RoundID, CandidateID, RoundResult, CandidateStatus,
      TechnicalScore, CommunicationScore, AttitudeScore, DomainKnowledgeScore,
      Strengths, Weaknesses, InterviewFeedback, OverallScore,
      OfferCTC, OfferedDesignation, OfferedDepartment,
      ReportingManager, JoiningDate, Remarks, Comments,
      EvaluatedBy, EvaluatedByRole,
    } = req.body;

    const role = (EvaluatedByRole || "").toLowerCase();
    const isHr = role === "hr" || role === "admin";
    const isManagerRole = role === "manager";


    
    if (role === "lead") {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "Leads have read-only access" });
    }

    // ── Mark as Selected (from Offer Process checklist) — HR/admin only ───
    if (CandidateStatus === "Selected") {
      if (!isHr) {
        await conn.rollback();
        return res.status(403).json({ success: false, message: "Only HR can mark a candidate as Selected" });
      }

      await conn.query(
        `UPDATE interview_candidates SET CandidateStatus = 'Selected' WHERE CandidateID = ?`,
        [CandidateID]
      );

      await conn.query(
        `UPDATE interview_rounds SET RoundResult = 'Selected', InterviewFeedback = ? WHERE RoundID = ?`,
        [Remarks || "Candidate selected", RoundID]
      );

      // Upsert offer record
      const [existingOffer] = await conn.query(
        `SELECT OfferID FROM candidate_offer WHERE CandidateID = ?`, [CandidateID]
      );
      if (existingOffer.length) {
        await conn.query(
          `UPDATE candidate_offer SET
            OfferedCTC = ?, OfferedDesignation = ?, OfferedDepartment = ?,
            ReportingManager = ?, JoiningDate = ?, OfferStatus = 'Accepted',
            OfferAcceptedDate = NOW(), Remarks = ?
          WHERE CandidateID = ?`,
          [OfferCTC, OfferedDesignation, OfferedDepartment, ReportingManager, JoiningDate, Remarks, CandidateID]
        );
      } else {
        await conn.query(
          `INSERT INTO candidate_offer (
            CandidateID, OfferedCTC, OfferedDesignation, OfferedDepartment,
            ReportingManager, JoiningDate, OfferStatus, OfferAcceptedDate, Remarks
          ) VALUES (?, ?, ?, ?, ?, ?, 'Accepted', NOW(), ?)`,
          [CandidateID, OfferCTC, OfferedDesignation, OfferedDepartment, ReportingManager, JoiningDate, Remarks]
        );
      }

      if (Comments && Comments.trim()) {
        await conn.query(
          `INSERT INTO candidate_comments (CandidateID, CommentText, CommentedBy, CommentedByRole)
           VALUES (?, ?, ?, ?)`,
          [CandidateID, Comments.trim(), EvaluatedBy || null, EvaluatedByRole || null]
        );
      }
      await conn.commit();
      const [updated] = await conn.query(`SELECT * FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]);
      return res.json({ success: true, message: "Candidate marked as Selected", candidate: updated[0] });
    }

    // ── Regular round evaluation — figure out who's allowed first ──────────
    if (!RoundID) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "RoundID is required" });
    }

    const [roundRow] = await conn.query(
      `SELECT RoundName, InterviewerId FROM interview_rounds WHERE RoundID = ?`, [RoundID]
    );
    if (!roundRow.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Interview round not found" });
    }
    const evaluatedRoundName = roundRow[0].RoundName;
    const assignedInterviewerId = roundRow[0].InterviewerId;
    console.log("========== UPDATE OUTCOME ==========");
console.log("Round:", evaluatedRoundName);
console.log("Assigned:", assignedInterviewerId, typeof assignedInterviewerId);
console.log("EvaluatedBy:", EvaluatedBy, typeof EvaluatedBy);
console.log("Role:", EvaluatedByRole);
console.log("====================================");

    if (MANAGER_EVALUATED_ROUNDS.includes(evaluatedRoundName)) {
      // Domain / Management Interview: ONLY the assigned manager may
      // evaluate. HR scheduled it, but does not submit the outcome —
      // this mirrors the "Interviewer assigned by the respective
      // Interview Manager" requirement.
      if (!isManagerRole || !assignedInterviewerId || String(assignedInterviewerId) !== String(EvaluatedBy)) {
        await conn.rollback();
        return res.status(403).json({
          success: false,
          message: isHr
            ? "Domain and Management interviews are evaluated by the assigned interviewer, not HR."
            : "You can only evaluate interviews assigned to you.",
        });
      }
    } else {
      // Offer Discussion / Offer Process (and anything else): HR/admin only.
      if (!isHr) {
        await conn.rollback();
        return res.status(403).json({ success: false, message: "Only HR can process this stage" });
      }
    }

    const saveComment = async () => {
      if (Comments && Comments.trim()) {
        await conn.query(
          `INSERT INTO candidate_comments (CandidateID, CommentText, CommentedBy, CommentedByRole)
           VALUES (?, ?, ?, ?)`,
          [CandidateID, Comments.trim(), EvaluatedBy || null, EvaluatedByRole || null]
        );
      }
    };

    const dbResult = RoundResult === "Pass" ? "Pass"
                   : RoundResult === "Fail" ? "Fail"
                   : "Hold";

    // Update the round scores and result
    await conn.query(
      `UPDATE interview_rounds SET
        RoundResult = ?, TechnicalScore = ?, CommunicationScore = ?,
        AttitudeScore = ?, DomainKnowledgeScore = ?, Strengths = ?,
        Weaknesses = ?, InterviewFeedback = ?, OverallScore = ?
      WHERE RoundID = ?`,
      [
        dbResult,
        TechnicalScore || null, CommunicationScore || null,
        AttitudeScore || null, DomainKnowledgeScore || null,
        Strengths || null, Weaknesses || null,
        InterviewFeedback || null, OverallScore || null,
        RoundID,
      ]
    );

    // Determine new candidate status
    let newCandidateStatus;

switch (dbResult) {

    case "Fail":
        newCandidateStatus = "Rejected";
        break;

    case "Hold":
        newCandidateStatus = "On Hold";
        break;

    case "Pass":

        switch (evaluatedRoundName) {

            case "Domain Interview":
                // Waiting for HR to schedule Management Interview
                newCandidateStatus = "Interview Scheduled";
                break;

            case "Management Interview":
                // Waiting for HR to schedule Offer Discussion
                newCandidateStatus = "Interview Scheduled";
                break;

            case "Offer Discussion":
                // Waiting for HR to schedule Offer Process
                newCandidateStatus = "Interview Scheduled";
                break;

            case "Offer Process":
                // Final stage
                newCandidateStatus = "Selected";
                break;

            default:
                newCandidateStatus = "Interview Scheduled";
        }

        break;

    default:
        newCandidateStatus = "Interview Scheduled";
}

    await conn.query(
      `UPDATE interview_candidates SET CandidateStatus = ? WHERE CandidateID = ?`,
      [newCandidateStatus, CandidateID]
    );

    await saveComment();
    await conn.commit();

    const [updatedRound]     = await conn.query(`SELECT * FROM interview_rounds WHERE RoundID = ?`, [RoundID]);
    const [updatedCandidate] = await conn.query(`SELECT * FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]);

    // Archive if rejected
    if (dbResult === "Fail") {
      // fire-and-forget soft archive
      db.query(
        `UPDATE interview_candidates SET CandidateStatus = 'Rejected' WHERE CandidateID = ?`,
        [CandidateID]
      ).catch(console.error);
    }

    res.json({
      success: true,
      message: "Round outcome updated successfully",
      round: updatedRound[0],
      candidate: updatedCandidate[0],
    });
  } catch (error) {
    await conn.rollback();
    console.error("Outcome Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
};

// ─── Update Candidate Status ───────────────────────────────────────────────────
// Used for the Applied → resume-screening decision. HR/admin only.
exports.updateCandidateStatus = async (req, res) => {
  try {
    const { CandidateID, CandidateStatus, Comments, UpdatedBy, UpdatedByRole } = req.body;
    if (!CandidateID || !CandidateStatus) {
      return res.status(400).json({ success: false, message: "CandidateID and CandidateStatus are required" });
    }

    const role = (UpdatedByRole || "").toLowerCase();
    if (role && role !== "hr" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Only HR can review resumes / update this status" });
    }

    const [candidate] = await db.query(
      `SELECT CandidateID FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]
    );
    if (!candidate.length) return res.status(404).json({ success: false, message: "Candidate not found" });

    await db.query(
      `UPDATE interview_candidates SET CandidateStatus = ? WHERE CandidateID = ?`,
      [CandidateStatus, CandidateID]
    );

    if (Comments && Comments.trim()) {
      await db.query(
        `INSERT INTO candidate_comments (CandidateID, CommentText, CommentedBy, CommentedByRole)
         VALUES (?, ?, ?, ?)`,
        [CandidateID, Comments.trim(), UpdatedBy || null, UpdatedByRole || null]
      );
    }

    res.json({ success: true, message: "Status updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Pipeline Comments ──────────────────────────────────────────────────────
// A running remarks log per candidate (see migration_recruitment_enhancements.sql
// for the `candidate_comments` table). HR, managers and leads can all add
// comments — this is meant for shared visibility across the hiring team.
exports.getCandidateComments = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT * FROM candidate_comments WHERE CandidateID = ? ORDER BY CreatedDate ASC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addCandidateComment = async (req, res) => {
  try {
    const { CandidateID, CommentText, CommentedBy, CommentedByName, CommentedByRole } = req.body;
    if (!CandidateID || !CommentText || !CommentText.trim()) {
      return res.status(400).json({ success: false, message: "CandidateID and CommentText are required" });
    }
    const [result] = await db.query(
      `INSERT INTO candidate_comments (CandidateID, CommentText, CommentedBy, CommentedByName, CommentedByRole)
       VALUES (?, ?, ?, ?, ?)`,
      [CandidateID, CommentText.trim(), CommentedBy || null, CommentedByName || null, CommentedByRole || null]
    );
    const [row] = await db.query(`SELECT * FROM candidate_comments WHERE CommentID = ?`, [result.insertId]);
    res.status(201).json({ success: true, comment: row[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Selected Candidates ───────────────────────────────────────────────────
exports.getSelectedCandidates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.CandidateID, c.FirstName, c.LastName, c.EmailId,
        c.AppliedDesignation, c.AppliedDepartment, c.CandidateStatus,
        o.OfferID, o.OfferedCTC, o.OfferedDesignation, o.JoiningDate, o.OfferStatus
      FROM interview_candidates c
      LEFT JOIN candidate_offer o ON o.CandidateID = c.CandidateID
      WHERE c.CandidateStatus IN (
        'Selected','Employee Created','Appointment Letter Sent','Appointment Letter Accepted'
      )
      ORDER BY FIELD(c.CandidateStatus,
        'Selected','Employee Created','Appointment Letter Sent','Appointment Letter Accepted'
      ), c.CandidateID DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Convert to Employee ───────────────────────────────────────────────────────
exports.convertToEmployee = async (req, res) => {
  let connection;
  try {
    const { CandidateID } = req.body;
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [candidateRows] = await connection.query(
      `SELECT * FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]
    );
    if (!candidateRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    const c = candidateRows[0];
    if (c.CandidateStatus !== "Selected") {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Only Selected candidates can be converted to employee" });
    }

    const [existing] = await connection.query(
      `SELECT EmployeeID FROM employee WHERE EmailId = ? OR CurrentContactNo = ?`,
      [c.EmailId, c.MobileNo]
    );
    if (existing.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Employee already exists with this email or mobile" });
    }

    const today = new Date().toISOString().split("T")[0];
    const [offerDetails] = await connection.query(
      `SELECT OfferedCTC, OfferedDesignation, OfferedDepartment, JoiningDate, ReportingManager
       FROM candidate_offer WHERE CandidateID = ? ORDER BY OfferID DESC LIMIT 1`,
      [CandidateID]
    );

    const designation = c.AppliedDesignation;
    const department  = offerDetails[0]?.OfferedDepartment  || c.AppliedDepartment;
    const joiningDate = offerDetails[0]?.JoiningDate        || today;

    const [employeeResult] = await connection.query(
      `INSERT INTO employee (
        FirstName, MiddleName, LastName, DirectSupervisor, IndirectSupervisor,
        CurrentAddress, PermanantAddress, EmailId, Password, CountryCode1,
        CurrentContactNo, CountryCode2, AlternateContactNo, CountryCode3,
        EmergencyContactNo, MaritalStatus, Gender, DateOfBirth, Nationality,
        BloodGroup, NomineeName, NomineeRelation, Photo, AccountHolderName,
        AccountNumber, BankName, IFSCCode, NEFT, Branch, PANNo, DrivingLicense,
        ExpiryDrivingLicense, PassportNo, StartDate, EndDate, PassportLocation,
        Designation, DesignationStartDate, DesignationEndDate, Department,
        CompanyBranch, WorkingBranch, WorkLocation, CreatedDate, ModifiedDate,
        CreatedBy, ModifiedBy, Status, StatusOfEmployee, role, ArchiveStatus,
        ArchiveReason, AadharNo, PFNo, PFUANNo, ESICNo, AlternateEmailId
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        c.FirstName, c.MiddleName || "", c.LastName, "", "",
        c.CurrentAddress || "", c.CurrentAddress || "", c.EmailId, md5("123456"), c.CountryCode1 || "+91",
        c.MobileNo || "", c.CountryCode2 || "", c.AlternateMobileNo || "", "",
        c.EmergencyContactNo || "", c.MaritalStatus || "", c.Gender || "", c.DateOfBirth || "", c.Nationality || "",
        "", "", "", c.Photo || null, "",
        "", "", "", "", "", "", "",
        "", "", joiningDate, "", "",
        designation, joiningDate, "", department,
        0, 0, "", today, null,
        "HR", "HR", "Active", "Working", "employee", "0",
        null, "", "", "", "", c.AlternateEmailId || "",
      ]
    );

    await connection.query(
      `UPDATE interview_candidates SET CandidateStatus = 'Employee Created' WHERE CandidateID = ?`,
      [CandidateID]
    );

    await connection.commit();
    res.json({ success: true, message: "Candidate converted to employee", EmployeeID: employeeResult.insertId });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Convert Employee Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// ─── Mark Employee Joined ──────────────────────────────────────────────────────
exports.markEmployeeJoined = async (req, res) => {
  try {
    const { CandidateID } = req.body;
    if (!CandidateID) return res.status(400).json({ success: false, message: "CandidateID is required" });

    const [candidate] = await db.query(
      `SELECT CandidateStatus FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]
    );
    if (!candidate.length) return res.status(404).json({ success: false, message: "Candidate not found" });
    if (candidate[0].CandidateStatus !== "Employee Created") {
      return res.status(400).json({ success: false, message: "Only Employee Created candidates can be marked as Joined" });
    }

    await db.query(
      `UPDATE interview_candidates SET CandidateStatus = 'Joined' WHERE CandidateID = ?`, [CandidateID]
    );
    res.json({ success: true, message: "Employee marked as Joined" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Get Employee Created Candidates ──────────────────────────────────────────
exports.getEmployeeCreatedCandidates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.CandidateID, c.FirstName, c.LastName, c.EmailId,
        c.AppliedDesignation, c.CandidateStatus,
        o.OfferID, o.AppointmentLetterSentDate, o.AppointmentLetterAcceptedDate,
        o.AppointmentLetterFile
      FROM interview_candidates c
      LEFT JOIN candidate_offer o ON o.CandidateID = c.CandidateID
      WHERE c.CandidateStatus IN ('Employee Created','Appointment Letter Sent','Appointment Letter Accepted')
      ORDER BY c.CandidateID DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Send Appointment Letter ───────────────────────────────────────────────────
exports.sendAppointmentLetter = async (req, res) => {
  let connection;
  try {
    const { CandidateID, AppointmentLetterContent, AppointmentLetterFile } = req.body;
    if (!CandidateID) return res.status(400).json({ success: false, message: "CandidateID is required" });

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [candidate] = await connection.query(
      `SELECT CandidateStatus FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]
    );
    if (!candidate.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Candidate not found" }); }
    if (candidate[0].CandidateStatus !== "Employee Created") {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Only Employee Created candidates can receive appointment letters" });
    }

    const [offer] = await connection.query(
      `SELECT OfferID FROM candidate_offer WHERE CandidateID = ?`, [CandidateID]
    );
    if (!offer.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Offer record not found" }); }

    await connection.query(
      `UPDATE candidate_offer SET
        AppointmentLetterContent = ?, AppointmentLetterFile = ?,
        AppointmentLetterSentDate = NOW(), OfferStatus = 'Sent'
      WHERE CandidateID = ?`,
      [AppointmentLetterContent, AppointmentLetterFile, CandidateID]
    );
    await connection.query(
      `UPDATE interview_candidates SET CandidateStatus = 'Appointment Letter Sent' WHERE CandidateID = ?`,
      [CandidateID]
    );

    await connection.commit();
    res.json({ success: true, message: "Appointment Letter sent successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// ─── Accept Appointment Letter ─────────────────────────────────────────────────
exports.acceptAppointmentLetter = async (req, res) => {
  let connection;
  try {
    const { CandidateID } = req.body;
    if (!CandidateID) return res.status(400).json({ success: false, message: "CandidateID is required" });

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [candidate] = await connection.query(
      `SELECT CandidateStatus FROM interview_candidates WHERE CandidateID = ?`, [CandidateID]
    );
    if (!candidate.length) { await connection.rollback(); return res.status(404).json({ success: false, message: "Candidate not found" }); }
    if (candidate[0].CandidateStatus !== "Appointment Letter Sent") {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Only candidates with sent appointment letters can accept" });
    }

    await connection.query(
      `UPDATE candidate_offer SET OfferStatus = 'Accepted', AppointmentLetterAcceptedDate = NOW() WHERE CandidateID = ?`,
      [CandidateID]
    );
    await connection.query(
      `UPDATE interview_candidates SET CandidateStatus = 'Appointment Letter Accepted' WHERE CandidateID = ?`,
      [CandidateID]
    );

    await connection.commit();
    res.json({ success: true, message: "Appointment letter accepted" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (connection) connection.release();
  }
};