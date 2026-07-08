import React, { useState, useEffect, useCallback, useMemo } from "react";
import { C, RADIUS } from "../../../theme";
import { apiUrl } from "../../../URL";

// NOTE: adjust this if your backend exposes the employee master list under a
// different path — this mirrors the "/api/admin/departments" pattern already
// used in Candidates.jsx, assuming an analogous "/api/employees/all" route.
const EMPLOYEES_ENDPOINT = "/api/admin/employees";
const DEPARTMENTS_ENDPOINT = "/api/admin/departments";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  "Applied",
  "Domain Interview",
  "Management Interview",
  "Offer Discussion",
  "Offer Process",
];

const STATUS_STYLE = {
  "Applied":               { bg: "#e3f2fd", color: "#1565c0" },
  "Interview Scheduled":   { bg: "#fff8e1", color: "#ef6c00" },
  "Interview Process":     { bg: "#ede7f6", color: "#6a1b9a" },
  "Interview In Progress": { bg: "#ede7f6", color: "#6a1b9a" },
  "Offer Discussion":      { bg: "#f3e5f5", color: "#7b1fa2" },
  "Offer Process":         { bg: "#e8f5e9", color: "#2e7d32" },
  "Selected":              { bg: "#c8e6c9", color: "#1b5e20" },
  "Rejected":              { bg: "#ffebee", color: "#c62828" },
  "On Hold":               { bg: "#f5f5f5", color: "#616161" },
};

// ─── Rating Levels ─────────────────────────────────────────────────────────────

const RATING_LEVELS = [
  { value: 1, label: "Beginner" },
  { value: 2, label: "Intermediate" },
  { value: 3, label: "Proficient" },
  { value: 4, label: "Expert" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

const initials = (c) =>
  `${c.FirstName?.[0] ?? ""}${c.LastName?.[0] ?? ""}`.toUpperCase();

const getKanbanStage = (c) => {
  const status = c.CandidateStatus;
  const round  = c.CurrentRoundName;

  if (status === "Applied") return "Applied";
  if ((status === "Interview Scheduled" || status === "On Hold") && !round) return "Applied";
  if (round === "Offer Discussion" || status === "Offer Discussion") return "Offer Discussion";
  if (round === "Offer Process"    || status === "Offer Process")    return "Offer Process";
  if (round && STAGES.includes(round)) return round;
  
  // If no round but status is "Interview Scheduled" (after Offer Discussion Pass),
  // and we have a Pass result, check if next round is pending
  if (c.EvaluationResult === "Pass" && c.NextRoundPending) {
    // Still show in current round's column
    if (c.CurrentRoundName && STAGES.includes(c.CurrentRoundName)) {
      return c.CurrentRoundName;
    }
  }
  
  return "Applied";
};

const getNextRoundName = (currentRoundName) => {
  switch (currentRoundName) {
    case null: case undefined: case "": return "Domain Interview";
    case "Domain Interview":            return "Management Interview";
    case "Management Interview":        return "Offer Discussion";
    case "Offer Discussion":            return "Offer Process";
    default:                            return null;
  }
};

const getCardActions = (c, userRole, userEmployeeId) => {
  const status       = c.CandidateStatus;
  const round        = c.CurrentRoundName;
  const evalResult   = c.EvaluationResult;
  const nextPending  = c.NextRoundPending;
  
  const isHr = userRole === "hr" || userRole === "admin";
  const isManager = userRole === "manager";
  const isLead = userRole === "lead";
  
  // ── Lead: Read-only ──────────────────────────────────────────────────────
  if (isLead) {
    return { evaluate: null, schedule: null };
  }

  // ── Applied / Resume Screening ──────────────────────────────────────────
  if (status === "Applied") {
    if (isHr) {
      return { evaluate: "Review Resume", schedule: null };
    }
    return { evaluate: null, schedule: null };
  }

  // Shortlisted but no round created yet
  if (!round) {
    if (isHr) {
      return { evaluate: null, schedule: "Schedule Domain Interview" };
    }
    return { evaluate: null, schedule: null };
  }

  // ── Offer Process ─────────────────────────────────────────────────────────
  if (round === "Offer Process") {
    if (isHr) {
      return { evaluate: "Review Checklist", schedule: null };
    }
    return { evaluate: null, schedule: null };
  }

  // ── Offer Discussion ─────────────────────────────────────────────────────
  if (round === "Offer Discussion") {
    // Check if already passed and next round pending
    if ((evalResult === "Pass" || nextPending) && isHr) {
      return { evaluate: null, schedule: "Start Offer Process" };
    }
    // Not yet evaluated or on hold
    if (isHr) {
      return { evaluate: "Save Discussion", schedule: null };
    }
    return { evaluate: null, schedule: null };
  }

  // ── Standard interview rounds (Domain/Management) ──────────────────────
  const roundShort =
    round === "Domain Interview"     ? "Domain"
    : round === "Management Interview" ? "Management"
    : round;

  const isAssignedManager =
    isManager &&
    String(c.AssignedInterviewerId) === String(userEmployeeId);

  // Passed → show schedule button for next round (only HR)
  if (evalResult === "Pass" || nextPending) {
    if (isHr) {
      const nextRound = getNextRoundName(round);
      if (!nextRound) return { evaluate: null, schedule: null };
      const scheduleLabel =
        nextRound === "Management Interview" ? "Schedule Management"
        : nextRound === "Offer Discussion"   ? "Schedule Offer Discussion"
        : nextRound === "Offer Process"      ? "Start Offer Process"
        : `Schedule ${nextRound}`;
      return { evaluate: null, schedule: scheduleLabel };
    }
    return { evaluate: null, schedule: null };
  }

  // On Hold → Re-evaluate
  if (evalResult === "Hold") {
    if (isAssignedManager) {
      return { evaluate: `Evaluate ${roundShort}`, schedule: null };
    }
    if (isHr) {
      return { evaluate: null, schedule: null, waitingOnManager: true };
    }
    return { evaluate: null, schedule: null };
  }

  // Not yet evaluated (null) → Evaluate
  if (evalResult === null || evalResult === undefined) {
    const evaluateLabel =
      round === "Domain Interview"     ? "Evaluate Domain"
      : round === "Management Interview" ? "Evaluate Management"
      : `Evaluate ${roundShort}`;

    if (isAssignedManager) {
      return { evaluate: evaluateLabel, schedule: null };
    }
    if (isHr) {
      return { evaluate: null, schedule: null, waitingOnManager: true };
    }
    return { evaluate: null, schedule: null };
  }

  // Failed - no actions
  return { evaluate: null, schedule: null };
};

// ─── Subcomponents ─────────────────────────────────────────────────────────────

const StatCard = React.memo(({ title, value, color, icon }) => (
  <div style={s.statCard}>
    <div style={{ ...s.statIcon, background: color + "18" }}>
      <span style={{ fontSize: "20px" }}>{icon}</span>
    </div>
    <div style={{ ...s.statValue, color }}>{value}</div>
    <div style={s.statTitle}>{title}</div>
  </div>
));

const InfoRow = React.memo(({ label, value }) =>
  value ? (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value}</span>
    </div>
  ) : null
);

const SectionLabel = ({ children }) => (
  <div style={s.sectionLabel}>{children}</div>
);

const RatingSelect = ({ field, value, onChange }) => (
  <select value={value || ""} onChange={(e) => onChange(field, Number(e.target.value))} style={s.select}>
    <option value="">Select rating</option>
    {RATING_LEVELS.map((level) => (
      <option key={level.value} value={level.value}>
        {level.value} – {level.label}
      </option>
    ))}
  </select>
);

// ─── Main Component ────────────────────────────────────────────────────────────

export default function InterviewPipeline() {
  const [candidates, setCandidates]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showProfileModal, setShowProfileModal]   = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [outcomeForm, setOutcomeForm]       = useState({});
  const [scheduleForm, setScheduleForm]     = useState({
    RoundName: "Domain Interview",
    InterviewDate: "", InterviewTime: "",
    InterviewMode: "Online",
    InterviewerId: "", InterviewerName: "",
    InterviewerDesignation: "", Department: "",
    MeetingLink: "", Location: "",
    AdditionalInterviewers: [],
  });
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers]       = useState([]);
  const [offerTasks, setOfferTasks] = useState({
    SalaryApproval: false, OfferLetterGenerated: false, OfferLetterSent: false,
    CandidateAccepted: false, BackgroundVerification: false,
    DocumentsReceived: false, JoiningDateConfirmed: false,
  });
  const [commentHistory, setCommentHistory] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  
  // ── Role-based access ──────────────────────────────────────────────────────
  const userRole = (localStorage.getItem("role") || "").toLowerCase();
  const userDepartment = localStorage.getItem("department") || "";
  const userEmployeeId = String(
    JSON.parse(localStorage.getItem("user") || "{}").id || ""
  );
  
  const isHr = userRole === "hr" || userRole === "admin";
  const isManager = userRole === "manager";
  const isLead = userRole === "lead";

  // ── Data ────────────────────────────────────────────────────────────────────

  // FIXED: Added userRole and userDepartment to dependency array
  const refreshCandidates = useCallback(async () => {
    try {
      const res  = await fetch(`${apiUrl}/api/candidates/pipeline?t=${Date.now()}&role=${encodeURIComponent(userRole)}&department=${encodeURIComponent(userDepartment)}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCandidates(list);
      return list;
    } catch (err) {
      console.error("Refresh error:", err);
      return null;
    }
  }, [userRole, userDepartment]); // Fixed: Added dependencies

  useEffect(() => {
    refreshCandidates().finally(() => setLoading(false));
  }, [refreshCandidates]); // Fixed: Added refreshCandidates as dependency

  // Master data for the "Schedule Interview" modal: departments + managers
  useEffect(() => {
    (async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          fetch(`${apiUrl}${DEPARTMENTS_ENDPOINT}`),
          fetch(`${apiUrl}${EMPLOYEES_ENDPOINT}`),
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (empRes.ok) {
          const emps = await empRes.json();
          const list = Array.isArray(emps) ? emps : [];
          setManagers(list.filter((e) => (e.role || "").toLowerCase() === "manager"));
        }
      } catch (err) {
        console.error("Master data fetch (departments/managers):", err);
      }
    })();
  }, []);

  // Managers filtered to the department selected in the schedule form
  const filteredManagers = useMemo(() => {
    if (!scheduleForm.Department) return managers;
    const dept = departments.find((d) => d.Department === scheduleForm.Department);
    if (!dept) return managers;
    return managers.filter((m) => String(m.Department) === String(dept.id));
  }, [managers, departments, scheduleForm.Department]);

  // Reporting Managers filtered to the department selected in Offer Process form
const filteredReportingManagers = useMemo(() => {
  if (!outcomeForm.Department) return managers;
  const dept = departments.find((d) => d.Department === outcomeForm.Department);
  if (!dept) return managers;
  return managers.filter((m) => String(m.Department) === String(dept.id));
}, [managers, departments, outcomeForm.Department]);

  const managerName = useCallback(
    (m) => `${m.FirstName || ""} ${m.LastName || ""}`.trim(),
    []
  );

  // ── Derived ─────────────────────────────────────────────────────────────────

  const activeCandidates = useMemo(() => {
    let list = candidates.filter((c) => 
      c.CandidateStatus !== "Selected" && c.CandidateStatus !== "Rejected"
    );

    if (isManager) {
      list = list.filter((c) => {
        const candidateDept = c.AppliedDepartment || "";
        return candidateDept.toLowerCase().includes(userDepartment.toLowerCase());
      });
    }

    return list;
  }, [candidates, isManager, userDepartment]);

  const grouped = useMemo(() => {
    const g = {};
    STAGES.forEach((stage) => (g[stage] = []));
    activeCandidates.forEach((c) => {
      const stage = getKanbanStage(c);
      if (g[stage]) g[stage].push(c);
    });
    return g;
  }, [activeCandidates]);

  const pipelineCount = activeCandidates.length;
  const selectedCount = candidates.filter((c) => c.CandidateStatus === "Selected").length;
  const rejectedCount = candidates.filter((c) => c.CandidateStatus === "Rejected").length;

  // ── Score calculation ────────────────────────────────────────────────────────

  const calculateScore = useCallback(() => {
    const scoreFields = [
      "TechnicalKnowledge","ProblemSolving","DomainKnowledge","HandsOnExperience",
      "ProjectExposure","CommunicationSkills","Leadership","Ownership","Teamwork",
      "ConflictHandling","DecisionMaking","CultureFit","Stability",
    ];
    const values = scoreFields
      .map((f) => Number(outcomeForm[f]))
      .filter((v) => !isNaN(v) && v > 0);
    if (!values.length) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [outcomeForm]);

  const setField = useCallback((key, val) => {
    setOutcomeForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  // ── Open modals ──────────────────────────────────────────────────────────────

  const fetchComments = useCallback(async (candidateId) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/candidates/comments/${candidateId}`);
      const data = await res.json();
      setCommentHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch comments error:", err);
      setCommentHistory([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const handlePostComment = useCallback(async () => {
    if (!newComment.trim() || !selectedCandidate) return;
    setPostingComment(true);
    try {
      const res = await fetch(`${apiUrl}/api/candidates/comments/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          CandidateID: selectedCandidate.CandidateID,
          CommentText: newComment.trim(),
          CommentedBy: userEmployeeId,
          CommentedByRole: userRole,
        }),
      });
      if (res.ok) {
        setNewComment("");
        await fetchComments(selectedCandidate.CandidateID);
      } else {
        const err = await res.json();
        alert(err.message || "Failed to add comment");
      }
    } catch (err) {
      console.error("Post comment error:", err);
      alert("Failed to add comment");
    } finally {
      setPostingComment(false);
    }
  }, [newComment, selectedCandidate, userEmployeeId, userRole, fetchComments]);

  const openProfile = useCallback((candidate) => {
    setSelectedCandidate(candidate);
    setNewComment("");
    fetchComments(candidate.CandidateID);
    const round  = candidate.CurrentRoundName;
    const status = candidate.CandidateStatus;
    let init = {};

    if (status === "Applied") {
      init = {
        ResumeScore: "", RelevantExperience: "",
        CurrentCTC: candidate.CurrentCTC || "", ExpectedCTC: "",
        NoticePeriod: candidate.NoticePeriod || "",
        ScreeningRemarks: "", Result: "Pass",
      };
    } else if (round === "Domain Interview") {
      init = {
        TechnicalKnowledge: "", ProblemSolving: "", DomainKnowledge: "",
        HandsOnExperience: "", ProjectExposure: "", CommunicationSkills: "",
        Strengths: "", Weaknesses: "", Feedback: "", Result: "Pass",
      };
    } else if (round === "Management Interview") {
      init = {
        Leadership: "", Ownership: "", Teamwork: "", ConflictHandling: "",
        DecisionMaking: "", CultureFit: "", Stability: "",
        Feedback: "", Result: "Pass",
      };
    } else if (round === "Offer Discussion") {
      init = {
        CurrentCTC: candidate.CurrentCTC || "", ExpectedCTC: "",
        FinalOfferedCTC: "", NoticePeriod: candidate.NoticePeriod || "",
        ExpectedJoiningDate: "", NegotiationNotes: "", Result: "Pass",
      };
    } else if (round === "Offer Process") {
      init = {
        OfferCTC: "", Designation: candidate.AppliedDesignation || "",
        Department: "", ReportingManager: "", JoiningDate: "",
        WorkLocation: "", EmploymentType: "", Remarks: "",
      };
      setOfferTasks({
        SalaryApproval: false, OfferLetterGenerated: false, OfferLetterSent: false,
        CandidateAccepted: false, BackgroundVerification: false,
        DocumentsReceived: false, JoiningDateConfirmed: false,
      });
    }

    setOutcomeForm(init);
    setShowProfileModal(true);
  }, [fetchComments]);

  const openSchedule = useCallback((candidate) => {
    if (!isHr) {
      alert("Only HR can schedule interviews");
      return;
    }
    setSelectedCandidate(candidate);
    const nextRound = getNextRoundName(candidate.CurrentRoundName);
    setScheduleForm({
      RoundName: nextRound || "Domain Interview",
      InterviewDate: "", InterviewTime: "",
      InterviewMode: "Online",
      InterviewerId: "", InterviewerName: "",
      InterviewerDesignation: "", Department: "",
      MeetingLink: "", Location: "",
      AdditionalInterviewers: [],
    });
    setShowScheduleModal(true);
  }, [isHr]);

  // ── Submit: Schedule ─────────────────────────────────────────────────────────

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!isHr) {
      alert("Only HR can schedule interviews");
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/candidates/interviews/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          CandidateID: selectedCandidate.CandidateID, 
          ...scheduleForm,
          AdditionalInterviewers: JSON.stringify(scheduleForm.AdditionalInterviewers || []),
          ScheduledBy: userEmployeeId,
          ScheduledByRole: userRole,
        }),
      });
      if (res.ok) {
        setShowScheduleModal(false);
        await refreshCandidates();
        alert("Interview scheduled successfully!");
      } else {
        const err = await res.json();
        alert(err.message || "Failed to schedule interview");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to schedule interview");
    }
  };

  // ── Submit: Outcome ──────────────────────────────────────────────────────────

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    const c = selectedCandidate;
    const status = c.CandidateStatus;

    if (!isHr && !isManager) {
      alert("You are not authorized to evaluate candidates");
      return;
    }

    if (isManager && Number(c.AssignedInterviewerId) !== Number(userEmployeeId)) {
      alert("You can only evaluate interviews assigned to you");
      return;
    }

    const managerOnlyRounds = ["Domain Interview", "Management Interview"];
    if (managerOnlyRounds.includes(c.CurrentRoundName) && !isManager) {
      alert("Domain and Management interview rounds are evaluated by the assigned interviewer, not HR.");
      return;
    }

    // Applied → resume screening (only HR)
    if (status === "Applied") {
      if (!isHr) {
        alert("Only HR can review resumes");
        return;
      }
      try {
        const newStatus = outcomeForm.Result === "Pass" ? "Interview Scheduled" : "Rejected";
        const res = await fetch(`${apiUrl}/api/candidates/update-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            CandidateID: c.CandidateID, 
            CandidateStatus: newStatus,
            UpdatedBy: userEmployeeId,
            UpdatedByRole: userRole,
          }),
        });
        if (res.ok) {
          setShowProfileModal(false);
          await refreshCandidates();
          alert(outcomeForm.Result === "Pass"
            ? "Candidate shortlisted! Now schedule the Domain Interview."
            : "Candidate rejected."
          );
        } else {
          const err = await res.json();
          alert(err.message || "Failed to update status");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to update status");
      }
      return;
    }

    if (!c.LatestRoundID) {
      alert("No active round found. Please schedule the interview first.");
      return;
    }

    const payload = {
      RoundID:              c.LatestRoundID,
      CandidateID:          c.CandidateID,
      RoundResult:          outcomeForm.Result,
      TechnicalScore:       outcomeForm.TechnicalKnowledge   || null,
      CommunicationScore:   outcomeForm.CommunicationSkills  || null,
      DomainKnowledgeScore: outcomeForm.DomainKnowledge      || null,
      InterviewFeedback:    outcomeForm.Feedback || outcomeForm.NegotiationNotes || null,
      OverallScore:         calculateScore(),
      Strengths:            outcomeForm.Strengths   || null,
      Weaknesses:           outcomeForm.Weaknesses  || null,
      EvaluatedBy:          userEmployeeId,
      EvaluatedByRole:      userRole,
    };

    try {
      const res = await fetch(`${apiUrl}/api/candidates/interviews/update-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || "Failed to save evaluation");
        return;
      }

      setShowProfileModal(false);
      await refreshCandidates();

      if (outcomeForm.Result === "Pass") {
        const nextRound = getNextRoundName(c.CurrentRoundName);
        if (isHr) {
          alert(nextRound
            ? `Evaluation saved! Now schedule the ${nextRound}.`
            : "Evaluation saved!"
          );
        } else {
          alert("Evaluation saved! HR will schedule the next round.");
        }
      } else if (outcomeForm.Result === "Fail") {
        alert("Candidate rejected.");
      } else {
        alert("Candidate placed on hold. Use Re-evaluate when ready.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save evaluation");
    }
  };

  // ── Submit: Mark Selected ────────────────────────────────────────────────────

  const allTasksDone = useMemo(() => Object.values(offerTasks).every(Boolean), [offerTasks]);

  const handleMarkSelected = async () => {
    if (!isHr) {
      alert("Only HR can mark candidates as Selected");
      return;
    }
    if (!allTasksDone) {
      alert("Complete all checklist items first.");
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/candidates/interviews/update-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          RoundID:          selectedCandidate.LatestRoundID,
          CandidateID:      selectedCandidate.CandidateID,
          CandidateStatus:  "Selected",
          RoundResult:      "Selected",
          OfferCTC:         outcomeForm.OfferCTC,
          Designation:      outcomeForm.Designation,
          Department:       outcomeForm.Department,
          ReportingManager: outcomeForm.ReportingManager,
          JoiningDate:      outcomeForm.JoiningDate,
          Remarks:          outcomeForm.Remarks,
          EvaluatedBy:      userEmployeeId,
          EvaluatedByRole:  userRole,
        }),
      });
      if (res.ok) {
        alert("Candidate marked as Selected!");
        setShowProfileModal(false);
        await refreshCandidates();
      } else {
        const err = await res.json();
        alert(err.message || "Failed to mark as Selected");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to mark as Selected");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={s.pageHead}>
        <h1 style={s.pageTitle}>Interview Pipeline</h1>
        <p style={s.pageSub}>
          {isHr ? "Track and manage candidates across all stages" :
           isManager ? "View and evaluate candidates assigned to your department" :
           "View all candidates in the pipeline"}
        </p>
      </div>

      <div style={s.statsGrid}>
        <StatCard title="Total Candidates" value={candidates.length} color="#1565c0" icon="👥" />
        <StatCard title="In Pipeline"      value={pipelineCount}     color="#ef6c00" icon="🔄" />
        <StatCard title="Selected"         value={selectedCount}     color="#2e7d32" icon="✅" />
        <StatCard title="Rejected"         value={rejectedCount}     color="#c62828" icon="❌" />
      </div>

      {loading ? (
        <div style={s.loading}>Loading pipeline…</div>
      ) : (
        <div style={s.board}>
          {STAGES.map((stage) => (
            <div key={stage} style={s.column}>
              <div style={s.colHead}>
                <span style={s.colName}>{stage}</span>
                <span style={s.colBadge}>{grouped[stage]?.length || 0}</span>
              </div>
              <div style={s.colBody}>
                {!grouped[stage]?.length ? (
                  <div style={s.emptyCol}>No candidates</div>
                ) : (
                  grouped[stage].map((c) => {
                    const st      = STATUS_STYLE[c.CandidateStatus] ?? STATUS_STYLE["On Hold"];
                    const actions = getCardActions(c, userRole, userEmployeeId);
                    const result  = c.EvaluationResult;

                    return (
                      <div key={c.CandidateID} style={s.card}>
                        <div style={s.cardTop}>
                          <div style={s.av}>{initials(c)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={s.cname}>{c.FirstName} {c.LastName}</div>
                            <div style={s.cpos}>{c.AppliedDesignation}</div>
                          </div>
                        </div>

                        <div style={s.tags}>
                          <span style={s.tag}>⏳ {c.TotalExperience || 0} yrs</span>
                          <span style={s.tag}>🏢 {c.CurrentCompany || "—"}</span>
                          {c.AssignedInterviewerName && (
                            <span style={s.tag}>👤 {c.AssignedInterviewerName}</span>
                          )}
                        </div>

                        <div style={{ margin: "10px 0 8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          <span style={{ ...s.pill, background: st.bg, color: st.color }}>
                            {c.CandidateStatus}
                          </span>
                          {result === "Pass" && (
                            <span style={{ ...s.pill, background: "#c8e6c9", color: "#1b5e20" }}>✓ Passed</span>
                          )}
                          {result === "Hold" && (
                            <span style={{ ...s.pill, background: "#fff3e0", color: "#ef6c00" }}>⏸ On Hold</span>
                          )}
                          {result === "Fail" && (
                            <span style={{ ...s.pill, background: "#ffebee", color: "#c62828" }}>✗ Failed</span>
                          )}
                        </div>

                        <div style={s.cardActions}>
                          {actions.evaluate && (
                            <button style={s.btnPrimary} onClick={() => openProfile(c)}>
                              {actions.evaluate}
                            </button>
                          )}
                          {actions.schedule && (
                            <button style={s.btnOutline} onClick={() => openSchedule(c)}>
                              {actions.schedule}
                            </button>
                          )}
                          {!actions.evaluate && !actions.schedule && (
                            <span style={{ color: C.muted, fontSize: "12px", padding: "8px 0" }}>
                              {isLead ? "View only"
                                : actions.waitingOnManager ? "Awaiting interviewer evaluation"
                                : "Waiting for action"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Profile / Evaluation Modal ──────────────────────────────────────── */}
      {showProfileModal && selectedCandidate && (
        <div style={s.overlay}>
          <div style={s.profileModal}>
            <div style={s.modalHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={s.bigAv}>{initials(selectedCandidate)}</div>
                <div>
                  <div style={s.modalName}>{selectedCandidate.FirstName} {selectedCandidate.LastName}</div>
                  <div style={s.modalPos}>{selectedCandidate.AppliedDesignation}</div>
                  {selectedCandidate.AssignedInterviewerName && (
                    <div style={{ fontSize: "12px", color: C.muted, marginTop: "2px" }}>
                      Assigned to: {selectedCandidate.AssignedInterviewerName}
                    </div>
                  )}
                </div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowProfileModal(false)}>✕</button>
            </div>

            <div style={s.modalBody}>
              <SectionLabel>Basic Information</SectionLabel>
              <div style={s.infoGrid}>
                <InfoRow label="Candidate ID"    value={selectedCandidate.CandidateID} />
                <InfoRow label="Email"           value={selectedCandidate.EmailId} />
                <InfoRow label="Mobile"          value={selectedCandidate.MobileNo} />
                <InfoRow label="Experience"      value={`${selectedCandidate.TotalExperience || 0} Years`} />
                <InfoRow label="Current Company" value={selectedCandidate.CurrentCompany} />
                <InfoRow label="Current CTC"     value={selectedCandidate.CurrentCTC} />
                <InfoRow label="Notice Period"   value={selectedCandidate.NoticePeriod} />
                <InfoRow label="Expected CTC"    value={selectedCandidate.ExpectedCTC} />
                <InfoRow label="Location"        value={selectedCandidate.City} />
              </div>

              {selectedCandidate.CandidateStatus === "Applied" && selectedCandidate.ResumeFile && (
                <button
                  style={s.resumeBtn}
                  onClick={() => window.open(`${apiUrl}/uploads/resumes/${selectedCandidate.ResumeFile}`, "_blank")}
                >
                  📄 View Resume
                </button>
              )}

              <SectionLabel>Interview History</SectionLabel>
              {selectedCandidate.RoundHistory?.length > 0 ? (
                <table style={s.historyTable}>
                  <thead>
                    <tr>
                      {["Round","Date","Interviewer","Result","Score"].map((h) => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCandidate.RoundHistory.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{r.RoundName}</td>
                        <td style={s.td}>{r.InterviewDate ? new Date(r.InterviewDate).toLocaleDateString() : "—"}</td>
                        <td style={s.td}>{r.InterviewerName || "—"}</td>
                        <td style={s.td}>{r.RoundResult || "Pending"}</td>
                        <td style={s.td}>{r.OverallScore || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: C.muted, fontSize: "13px" }}>No interview history yet.</p>
              )}

              {/* Comments section */}
              <SectionLabel>Comments</SectionLabel>
              <div style={{ marginBottom: "16px" }}>
                {commentsLoading ? (
                  <p style={{ color: C.muted, fontSize: "13px" }}>Loading comments…</p>
                ) : commentHistory.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
                    {commentHistory.map((cm) => (
                      <div key={cm.CommentID} style={{ padding: "10px 12px", background: C.inputBg, borderRadius: "8px", border: `1px solid ${C.borderLight}` }}>
                        <div style={{ fontSize: "12px", color: C.muted, marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                          <span>{cm.CommentedByName || cm.CommentedByRole || "Team member"}</span>
                          <span>{new Date(cm.CreatedDate).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: "13.5px", color: C.text }}>{cm.CommentText}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: C.muted, fontSize: "13px", marginBottom: "12px" }}>No comments yet.</p>
                )}
                {!isLead && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <textarea
                      placeholder="Add a remark about this candidate…"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      style={{ ...s.textarea, minHeight: "44px", flex: 1 }}
                      rows={2}
                    />
                    <button
                      type="button"
                      style={{ ...s.btnOutline, flex: "none", alignSelf: "flex-end", padding: "10px 16px" }}
                      disabled={!newComment.trim() || postingComment}
                      onClick={handlePostComment}
                    >
                      {postingComment ? "Posting…" : "Add"}
                    </button>
                  </div>
                )}
              </div>

              {/* 1. Applied → Resume Screening (HR Only) */}
              {selectedCandidate.CandidateStatus === "Applied" && isHr && (
                <>
                  <SectionLabel>Resume Screening</SectionLabel>
                  <form onSubmit={handleOutcomeSubmit}>
                    <div style={s.scoreGrid}>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Resume Score</label>
                        <RatingSelect field="ResumeScore" value={outcomeForm.ResumeScore} onChange={setField} />
                      </div>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Relevant Experience</label>
                        <RatingSelect field="RelevantExperience" value={outcomeForm.RelevantExperience} onChange={setField} />
                      </div>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Current CTC</label>
                        <input type="text" value={outcomeForm.CurrentCTC || ""} onChange={(e) => setField("CurrentCTC", e.target.value)} style={s.scoreInput} />
                      </div>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Expected CTC</label>
                        <input type="text" value={outcomeForm.ExpectedCTC || ""} onChange={(e) => setField("ExpectedCTC", e.target.value)} style={s.scoreInput} />
                      </div>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Notice Period</label>
                        <input type="text" value={outcomeForm.NoticePeriod || ""} onChange={(e) => setField("NoticePeriod", e.target.value)} style={s.scoreInput} />
                      </div>
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Screening Remarks</label>
                      <textarea
                        placeholder="Notes on the resume…"
                        value={outcomeForm.ScreeningRemarks || ""}
                        onChange={(e) => setField("ScreeningRemarks", e.target.value)}
                        style={{ ...s.textarea, marginTop: "6px" }} rows={3}
                      />
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Decision</label>
                      <select value={outcomeForm.Result || "Pass"} onChange={(e) => setField("Result", e.target.value)} style={{ ...s.select, marginTop: "6px" }}>
                        <option value="Pass">Shortlist — Schedule Domain Interview</option>
                        <option value="Fail">Reject Application</option>
                      </select>
                    </div>
                    <div style={s.modalFoot}>
                      <button type="button" style={s.cancelBtn} onClick={() => setShowProfileModal(false)}>Cancel</button>
                      <button type="submit" style={s.primaryBtn}>Save Evaluation</button>
                    </div>
                  </form>
                </>
              )}

              {/* 2. Domain Interview - Assigned Manager ONLY */}
              {selectedCandidate.CurrentRoundName === "Domain Interview" &&
               isManager &&
               Number(selectedCandidate.AssignedInterviewerId) === Number(userEmployeeId) && (
                <>
                  <SectionLabel>Domain Interview Evaluation</SectionLabel>
                  <form onSubmit={handleOutcomeSubmit}>
                    <div style={s.scoreGrid}>
                      {["TechnicalKnowledge","ProblemSolving","DomainKnowledge","HandsOnExperience","ProjectExposure","CommunicationSkills"].map((f) => (
                        <div key={f} style={s.fieldCol}>
                          <label style={s.scoreLabel}>{f.replace(/([A-Z])/g, " $1").trim()}</label>
                          <RatingSelect field={f} value={outcomeForm[f]} onChange={setField} />
                        </div>
                      ))}
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Strengths</label>
                        <input type="text" value={outcomeForm.Strengths || ""} onChange={(e) => setField("Strengths", e.target.value)} style={s.scoreInput} />
                      </div>
                      <div style={s.fieldCol}>
                        <label style={s.scoreLabel}>Weaknesses</label>
                        <input type="text" value={outcomeForm.Weaknesses || ""} onChange={(e) => setField("Weaknesses", e.target.value)} style={s.scoreInput} />
                      </div>
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Technical Feedback</label>
                      <textarea placeholder="Detailed feedback…" value={outcomeForm.Feedback || ""} onChange={(e) => setField("Feedback", e.target.value)} style={{ ...s.textarea, marginTop: "6px" }} rows={3} />
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Decision</label>
                      <select value={outcomeForm.Result || "Pass"} onChange={(e) => setField("Result", e.target.value)} style={{ ...s.select, marginTop: "6px" }}>
                        <option value="Pass">Pass — Schedule Management Interview</option>
                        <option value="Fail">Fail — Reject</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>
                    <div style={s.modalFoot}>
                      <button type="button" style={s.cancelBtn} onClick={() => setShowProfileModal(false)}>Cancel</button>
                      <button type="submit" style={s.primaryBtn}>Save Evaluation</button>
                    </div>
                  </form>
                </>
              )}

              {/* 3. Management Interview - Assigned Manager ONLY */}
              {selectedCandidate.CurrentRoundName === "Management Interview" && 
               Number(selectedCandidate.AssignedInterviewerId) === Number(userEmployeeId) && (
                <>
                  <SectionLabel>Management Interview Evaluation</SectionLabel>
                  <form onSubmit={handleOutcomeSubmit}>
                    <div style={s.scoreGrid}>
                      {["Leadership","Ownership","Teamwork","ConflictHandling","DecisionMaking","CultureFit","Stability"].map((f) => (
                        <div key={f} style={s.fieldCol}>
                          <label style={s.scoreLabel}>{f.replace(/([A-Z])/g, " $1").trim()}</label>
                          <RatingSelect field={f} value={outcomeForm[f]} onChange={setField} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Management Feedback</label>
                      <textarea placeholder="Detailed feedback…" value={outcomeForm.Feedback || ""} onChange={(e) => setField("Feedback", e.target.value)} style={{ ...s.textarea, marginTop: "6px" }} rows={3} />
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Decision</label>
                      <select value={outcomeForm.Result || "Pass"} onChange={(e) => setField("Result", e.target.value)} style={{ ...s.select, marginTop: "6px" }}>
                        <option value="Pass">Pass — Schedule Offer Discussion</option>
                        <option value="Fail">Fail — Reject</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>
                    <div style={s.modalFoot}>
                      <button type="button" style={s.cancelBtn} onClick={() => setShowProfileModal(false)}>Cancel</button>
                      <button type="submit" style={s.primaryBtn}>Save Evaluation</button>
                    </div>
                  </form>
                </>
              )}

              {/* 4. Offer Discussion - HR Only */}
              {selectedCandidate.CurrentRoundName === "Offer Discussion" && isHr && (
                <>
                  <SectionLabel>Offer Discussion</SectionLabel>
                  <form onSubmit={handleOutcomeSubmit}>
                    <div style={s.scoreGrid}>
                      {[
                        { key: "CurrentCTC",         label: "Current CTC",          type: "text" },
                        { key: "ExpectedCTC",        label: "Expected CTC",         type: "text" },
                        { key: "FinalOfferedCTC",    label: "Final Offered CTC",    type: "text" },
                        { key: "NoticePeriod",       label: "Notice Period",        type: "text" },
                        { key: "ExpectedJoiningDate",label: "Expected Joining Date",type: "date" },
                      ].map(({ key, label, type }) => (
                        <div key={key} style={s.fieldCol}>
                          <label style={s.scoreLabel}>{label}</label>
                          <input type={type} value={outcomeForm[key] || ""} onChange={(e) => setField(key, e.target.value)} style={s.scoreInput} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Negotiation Notes</label>
                      <textarea placeholder="Notes…" value={outcomeForm.NegotiationNotes || ""} onChange={(e) => setField("NegotiationNotes", e.target.value)} style={{ ...s.textarea, marginTop: "6px" }} rows={3} />
                    </div>
                    <div style={{ marginTop: "16px" }}>
                      <label style={s.scoreLabel}>Decision</label>
                      <select value={outcomeForm.Result || "Pass"} onChange={(e) => setField("Result", e.target.value)} style={{ ...s.select, marginTop: "6px" }}>
                        <option value="Pass">Agreed — Start Offer Process</option>
                        <option value="Fail">Declined — Reject</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>
                    <div style={s.modalFoot}>
                      <button type="button" style={s.cancelBtn} onClick={() => setShowProfileModal(false)}>Cancel</button>
                      <button type="submit" style={s.primaryBtn}>Save Discussion</button>
                    </div>
                  </form>
                </>
              )}

            {/* 5. Offer Process Checklist - HR Only */}
{selectedCandidate.CurrentRoundName === "Offer Process" && isHr && (
  <>
    <SectionLabel>Offer Process Checklist</SectionLabel>
    <form onSubmit={(e) => e.preventDefault()}>
      <div style={s.checklist}>
        {Object.keys(offerTasks).map((key) => (
          <label key={key} style={s.checkRow}>
            <input
              type="checkbox"
              checked={offerTasks[key]}
              onChange={(e) => setOfferTasks((p) => ({ ...p, [key]: e.target.checked }))}
            />
            <span>{key.replace(/([A-Z])/g, " $1").trim()}</span>
          </label>
        ))}
      </div>
      <div style={{ ...s.scoreGrid, marginTop: "20px" }}>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Offer CTC</label>
          <input type="text" value={outcomeForm.OfferCTC || ""} onChange={(e) => setField("OfferCTC", e.target.value)} style={s.scoreInput} />
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Designation</label>
          <input type="text" value={outcomeForm.Designation || ""} onChange={(e) => setField("Designation", e.target.value)} style={s.scoreInput} />
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Department</label>
          <select 
            value={outcomeForm.Department || ""} 
            onChange={(e) => {
              setField("Department", e.target.value);
              setField("ReportingManager", ""); // Reset reporting manager when department changes
            }} 
            style={s.select}
          >
            <option value="">Select Department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.Department}>{d.Department}</option>
            ))}
          </select>
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Reporting Manager</label>
          <select 
            value={outcomeForm.ReportingManager || ""} 
            onChange={(e) => setField("ReportingManager", e.target.value)} 
            style={s.select}
          >
            <option value="">Select Reporting Manager</option>
            {filteredReportingManagers.map((m) => (
              <option key={m.EmployeeID} value={managerName(m)}>
                {managerName(m)}
              </option>
            ))}
          </select>
          {outcomeForm.Department && filteredReportingManagers.length === 0 && (
            <span style={{ fontSize: "12px", color: C.muted }}>
              No managers found in this department.
            </span>
          )}
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Joining Date</label>
          <input type="date" value={outcomeForm.JoiningDate || ""} onChange={(e) => setField("JoiningDate", e.target.value)} style={s.scoreInput} />
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Work Location</label>
          <input type="text" value={outcomeForm.WorkLocation || ""} onChange={(e) => setField("WorkLocation", e.target.value)} style={s.scoreInput} />
        </div>
        <div style={s.fieldCol}>
          <label style={s.scoreLabel}>Employment Type</label>
          <input type="text" value={outcomeForm.EmploymentType || ""} onChange={(e) => setField("EmploymentType", e.target.value)} style={s.scoreInput} />
        </div>
      </div>
      <div style={{ marginTop: "16px" }}>
        <label style={s.scoreLabel}>Final Remarks</label>
        <textarea placeholder="Final remarks…" value={outcomeForm.Remarks || ""} onChange={(e) => setField("Remarks", e.target.value)} style={{ ...s.textarea, marginTop: "6px" }} rows={3} />
      </div>
      {!allTasksDone && (
        <div style={s.checklistNote}>
          Complete all checklist items to enable "Mark as Selected"
        </div>
      )}
      <div style={s.modalFoot}>
        <button type="button" style={s.cancelBtn} onClick={() => setShowProfileModal(false)}>Cancel</button>
        <button
          type="button"
          style={{ ...s.primaryBtn, opacity: allTasksDone ? 1 : 0.5, cursor: allTasksDone ? "pointer" : "not-allowed" }}
          onClick={handleMarkSelected}
          disabled={!allTasksDone}
        >
          Mark as Selected
        </button>
      </div>
    </form>
  </>
)}
              {/* Read-only fallback */}
              {(() => {
                const stage = selectedCandidate.CurrentRoundName;
                const status = selectedCandidate.CandidateStatus;
                const isManagerStage = stage === "Domain Interview" || stage === "Management Interview";
                const isHrStage = stage === "Offer Discussion" || stage === "Offer Process";
                const assignedToMe = isManager && Number(selectedCandidate.AssignedInterviewerId) === Number(userEmployeeId);

                const handledAlready =
                  (status === "Applied" && isHr) ||
                  (isManagerStage && assignedToMe) ||
                  (isHrStage && isHr);

                if (handledAlready) return null;

                let message = "You do not have permission to evaluate this candidate.";
                if (isLead) {
                  message = "You have read-only access to this candidate.";
                } else if (isHr && isManagerStage) {
                  message = selectedCandidate.AssignedInterviewerName
                    ? `This round is being evaluated by ${selectedCandidate.AssignedInterviewerName}. You'll be able to schedule the next round once they submit their evaluation.`
                    : "This round is awaiting evaluation by the assigned interviewer.";
                } else if (isManager && isManagerStage && !assignedToMe) {
                  message = "This interview is assigned to another interviewer.";
                } else if (isManager && !isManagerStage) {
                  message = "This stage is handled by HR.";
                }

                return (
                  <div style={{ padding: "20px", textAlign: "center", color: C.muted }}>
                    <p>{message}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Modal (HR Only) ────────────────────────────────────────── */}
      {showScheduleModal && selectedCandidate && isHr && (
        <div style={s.overlay}>
          <div style={s.scheduleModal}>
            <div style={s.modalHead}>
              <div>
                <div style={s.modalName}>Schedule Interview</div>
                <div style={s.modalPos}>{selectedCandidate.FirstName} {selectedCandidate.LastName}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowScheduleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleScheduleSubmit} style={s.modalBody}>
              <div style={s.fieldCol}>
                <label style={s.scoreLabel}>Round</label>
                <input 
                  type="text" 
                  value={scheduleForm.RoundName} 
                  readOnly 
                  style={{ ...s.scoreInput, background: "#f0f0f0", cursor: "default" }} 
                />
              </div>
              
              <div style={s.scoreGrid}>
                <div style={s.fieldCol}>
                  <label style={s.scoreLabel}>Date</label>
                  <input 
                    type="date" 
                    value={scheduleForm.InterviewDate} 
                    onChange={(e) => setScheduleForm((p) => ({ ...p, InterviewDate: e.target.value }))} 
                    style={s.scoreInput} 
                    required 
                  />
                </div>
                <div style={s.fieldCol}>
                  <label style={s.scoreLabel}>Time</label>
                  <input 
                    type="time" 
                    value={scheduleForm.InterviewTime} 
                    onChange={(e) => setScheduleForm((p) => ({ ...p, InterviewTime: e.target.value }))} 
                    style={s.scoreInput} 
                    required 
                  />
                </div>
              </div>
              
              <div style={s.fieldCol}>
                <label style={s.scoreLabel}>Mode</label>
                <select 
                  value={scheduleForm.InterviewMode} 
                  onChange={(e) => setScheduleForm((p) => ({ ...p, InterviewMode: e.target.value }))} 
                  style={s.select}
                >
                  <option value="Online">Online</option>
                  <option value="In Person">In Person</option>
                  <option value="Telephonic">Telephonic</option>
                </select>
              </div>

              {/* Only show Department, Interviewer, and Additional Interviewers for Domain/Management rounds */}
              {(scheduleForm.RoundName === "Domain Interview" || scheduleForm.RoundName === "Management Interview") && (
                <>
                  <div style={s.fieldCol}>
                    <label style={s.scoreLabel}>Department</label>
                    <select 
                      value={scheduleForm.Department} 
                      onChange={(e) => setScheduleForm((p) => ({
                        ...p,
                        Department: e.target.value,
                        InterviewerId: "", 
                        InterviewerName: "", 
                        InterviewerDesignation: "",
                        AdditionalInterviewers: [],
                      }))}
                      style={s.select}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.Department}>{d.Department}</option>
                      ))}
                    </select>
                  </div>

                  <div style={s.scoreGrid}>
                    <div style={s.fieldCol}>
                      <label style={s.scoreLabel}>Interviewer Name</label>
                      <select 
                        value={scheduleForm.InterviewerId} 
                        onChange={(e) => {
                          const id = e.target.value;
                          const m = filteredManagers.find((x) => String(x.EmployeeID) === id);
                          setScheduleForm((p) => ({
                            ...p,
                            InterviewerId: id,
                            InterviewerName: m ? managerName(m) : "",
                          }));
                        }}
                        style={s.select}
                        required
                      >
                        <option value="">Select Interviewer</option>
                        {filteredManagers.map((m) => (
                          <option key={m.EmployeeID} value={m.EmployeeID}>{managerName(m)}</option>
                        ))}
                      </select>
                      {scheduleForm.Department && filteredManagers.length === 0 && (
                        <span style={{ fontSize: "12px", color: C.muted }}>
                          No managers found in this department.
                        </span>
                      )}
                    </div>
                    <div style={s.fieldCol}>
                      <label style={s.scoreLabel}>Designation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Senior Engineer" 
                        value={scheduleForm.InterviewerDesignation} 
                        onChange={(e) => setScheduleForm((p) => ({ ...p, InterviewerDesignation: e.target.value }))} 
                        style={s.scoreInput} 
                      />
                    </div>
                  </div>

                  {/* Additional Interviewers */}
                  <div style={s.fieldCol}>
                    <label style={s.scoreLabel}>Additional Interviewers</label>
                    {scheduleForm.AdditionalInterviewers.map((row, idx) => (
                      <div key={idx} style={{ ...s.scoreGrid, marginBottom: "8px" }}>
                        <select
                          value={row.EmployeeID}
                          onChange={(e) => {
                            const id = e.target.value;
                            const m = filteredManagers.find((x) => String(x.EmployeeID) === id);
                            setScheduleForm((p) => {
                              const next = [...p.AdditionalInterviewers];
                              next[idx] = { 
                                EmployeeID: id, 
                                Name: m ? managerName(m) : "", 
                                Designation: row.Designation 
                              };
                              return { ...p, AdditionalInterviewers: next };
                            });
                          }}
                          style={s.select}
                        >
                          <option value="">Select Interviewer</option>
                          {filteredManagers
                            .filter((m) => String(m.EmployeeID) !== String(scheduleForm.InterviewerId))
                            .map((m) => (
                              <option key={m.EmployeeID} value={m.EmployeeID}>
                                {managerName(m)}
                              </option>
                            ))}
                        </select>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            type="text"
                            placeholder="Designation"
                            value={row.Designation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScheduleForm((p) => {
                                const next = [...p.AdditionalInterviewers];
                                next[idx] = { ...next[idx], Designation: val };
                                return { ...p, AdditionalInterviewers: next };
                              });
                            }}
                            style={s.scoreInput}
                          />
                          <button
                            type="button"
                            onClick={() => setScheduleForm((p) => ({
                              ...p,
                              AdditionalInterviewers: p.AdditionalInterviewers.filter((_, i) => i !== idx),
                            }))}
                            style={{ ...s.cancelBtn, padding: "10px 14px" }}
                            aria-label="Remove interviewer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setScheduleForm((p) => ({
                        ...p,
                        AdditionalInterviewers: [
                          ...p.AdditionalInterviewers, 
                          { EmployeeID: "", Name: "", Designation: "" }
                        ],
                      }))}
                      style={{ ...s.btnOutline, flex: "none", padding: "8px 14px", alignSelf: "flex-start" }}
                    >
                      + Add Interviewer
                    </button>
                  </div>
                </>
              )}

              {scheduleForm.InterviewMode === "Online" && (
                <div style={s.fieldCol}>
                  <label style={s.scoreLabel}>Meeting Link</label>
                  <input 
                    type="url" 
                    placeholder="https://meet.google.com/…" 
                    value={scheduleForm.MeetingLink} 
                    onChange={(e) => setScheduleForm((p) => ({ ...p, MeetingLink: e.target.value }))} 
                    style={s.scoreInput} 
                  />
                </div>
              )}
              
              {scheduleForm.InterviewMode === "In Person" && (
                <div style={s.fieldCol}>
                  <label style={s.scoreLabel}>Location</label>
                  <input 
                    type="text" 
                    placeholder="Conference Room / Office" 
                    value={scheduleForm.Location} 
                    onChange={(e) => setScheduleForm((p) => ({ ...p, Location: e.target.value }))} 
                    style={s.scoreInput} 
                  />
                </div>
              )}
              
              <div style={s.modalFoot}>
                <button type="button" style={s.cancelBtn} onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" style={s.primaryBtn}>
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:      { padding: "28px", background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" },
  pageHead:  { marginBottom: "24px" },
  pageTitle: { fontSize: "24px", fontWeight: "700", color: C.text, margin: 0 },
  pageSub:   { fontSize: "14px", color: C.muted, marginTop: "4px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" },
  statCard:  { background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.card, padding: "20px" },
  statIcon:  { width: "42px", height: "42px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" },
  statValue: { fontSize: "28px", fontWeight: "700", lineHeight: 1 },
  statTitle: { fontSize: "13px", color: C.muted, marginTop: "6px" },
  loading:   { padding: "100px 20px", textAlign: "center", color: C.muted, fontSize: "15px" },
  board:     { display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "20px" },
  column:    { minWidth: "280px", width: "280px", background: C.card, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.card, display: "flex", flexDirection: "column", maxHeight: "78vh", flexShrink: 0 },
  colHead:   { padding: "16px 18px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" },
  colName:   { fontSize: "14px", fontWeight: "600", color: C.text },
  colBadge:  { background: C.inputBg, color: C.primary, border: `1px solid ${C.inputBorder}`, fontSize: "12px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px" },
  colBody:   { padding: "12px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" },
  emptyCol:  { textAlign: "center", padding: "40px 20px", color: C.muted, fontSize: "13px", border: `2px dashed ${C.inputBorder}`, borderRadius: "10px" },
  card:      { background: C.bg, border: `1px solid ${C.borderLight}`, borderRadius: "12px", padding: "16px" },
  cardTop:   { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  av:        { width: "38px", height: "38px", borderRadius: "50%", background: C.inputBg, border: `2px solid ${C.inputBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color: C.primary, flexShrink: 0 },
  cname:     { fontSize: "14px", fontWeight: "600", color: C.text },
  cpos:      { fontSize: "12.5px", color: C.muted, marginTop: "2px" },
  tags:      { display: "flex", gap: "6px", flexWrap: "wrap" },
  tag:       { fontSize: "11.5px", padding: "3px 8px", borderRadius: "999px", background: C.inputBg, color: C.primary, border: `1px solid ${C.inputBorder}` },
  pill:      { display: "inline-block", fontSize: "11.5px", fontWeight: "600", padding: "3px 9px", borderRadius: "999px" },
  cardActions:  { display: "flex", gap: "8px", marginTop: "14px" },
  btnPrimary:   { flex: 1, padding: "9px 10px", background: C.primary, color: "#fff", border: "none", borderRadius: RADIUS.button, fontSize: "12.5px", fontWeight: "600", cursor: "pointer" },
  btnOutline:   { flex: 1, padding: "9px 10px", background: "#fff", border: `1px solid ${C.inputBorder}`, color: C.primary, borderRadius: RADIUS.button, fontSize: "12.5px", fontWeight: "600", cursor: "pointer" },
  overlay:      { position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  profileModal: { background: C.card, width: "100%", maxWidth: "640px", borderRadius: "16px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" },
  scheduleModal:{ background: C.card, width: "100%", maxWidth: "480px", borderRadius: "16px", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" },
  modalHead:    { padding: "18px 24px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" },
  modalBody:    { padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "20px" },
  modalFoot:    { display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "20px", borderTop: `1px solid ${C.borderLight}`, marginTop: "auto" },
  bigAv:        { width: "52px", height: "52px", borderRadius: "50%", background: C.inputBg, border: `2px solid ${C.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700", color: C.primary },
  modalName:    { fontSize: "17px", fontWeight: "700", color: C.text },
  modalPos:     { fontSize: "13px", color: C.muted },
  closeBtn:     { background: "none", border: "none", fontSize: "22px", color: C.muted, cursor: "pointer", padding: "4px" },
  sectionLabel: { fontSize: "12px", fontWeight: "700", color: C.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: `1px solid ${C.borderLight}` },
  infoGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px 28px" },
  infoRow:   { display: "flex", flexDirection: "column", gap: "3px" },
  infoLabel: { fontSize: "11.5px", color: C.muted },
  infoValue: { fontSize: "13.5px", fontWeight: "600", color: C.text },
  scoreGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  fieldCol:   { display: "flex", flexDirection: "column", gap: "6px" },
  scoreLabel: { fontSize: "12.5px", fontWeight: "600", color: C.text },
  scoreInput: { width: "100%", padding: "10px 13px", border: `1px solid ${C.borderLight}`, background: C.inputBg, borderRadius: RADIUS.input, fontSize: "13.5px", outline: "none", color: C.text, boxSizing: "border-box" },
  textarea:   { width: "100%", padding: "11px 13px", border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.input, fontSize: "13.5px", fontFamily: "inherit", resize: "vertical", outline: "none", background: C.inputBg, color: C.text, minHeight: "80px", boxSizing: "border-box" },
  select:     { width: "100%", padding: "10px 13px", border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.input, fontSize: "13.5px", background: C.card, color: C.text, outline: "none", boxSizing: "border-box" },
  historyTable:{ width: "100%", borderCollapse: "collapse", fontSize: "13px", background: C.bg, borderRadius: "8px", overflow: "hidden" },
  th:          { padding: "10px 12px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: C.muted, background: C.inputBg, borderBottom: `1px solid ${C.borderLight}` },
  td:          { padding: "10px 12px", borderBottom: `1px solid ${C.borderLight}`, color: C.text },
  checklist:     { background: C.inputBg, border: `1px solid ${C.borderLight}`, borderRadius: RADIUS.card, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  checkRow:      { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "13.5px" },
  checklistNote: { marginTop: "12px", fontSize: "12px", color: "#ef6c00", background: "#fff8e1", border: "1px solid #ffe0b2", borderRadius: "8px", padding: "10px 14px" },
  cancelBtn:  { padding: "10px 20px", background: C.inputBg, border: `1px solid ${C.inputBorder}`, color: C.text, borderRadius: RADIUS.button, cursor: "pointer", fontSize: "13.5px", fontWeight: "500" },
  primaryBtn: { padding: "10px 24px", background: C.accent, color: "#fff", border: "none", borderRadius: RADIUS.button, cursor: "pointer", fontSize: "13.5px", fontWeight: "600" },
  resumeBtn:  { padding: "9px 16px", fontSize: "13px", fontWeight: "600", background: C.primary, color: "#fff", border: "none", borderRadius: RADIUS.button, cursor: "pointer" },
};