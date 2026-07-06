import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoutes";

// auth
import Login from "./pages/Login";

// common
import EmployeeLeaves from "./pages/common/Leave";
import Announcements from "./pages/common/Announcements";

// admin
import AdminDashboard from "./pages/admin/Dashboard";
import AdminEmployees from "./pages/admin/Employees";
import AdminDepartments from "./pages/admin/Departments";
import AdminLeaves from './pages/admin/Leaves';
import AdminEmployeeStatus from './pages/admin/EmployeeStatus';
import AdminAnnouncement from './pages/admin/Announcement';
import AdminClient from './pages/admin/Client';
import AdminProjects from './pages/admin/Projects';
import Candidates from "./pages/admin/Recruitment/Candidates";
import InterviewPipeline from "./pages/admin/Recruitment/InterviewPipeline";
import SelectedCandidates from "./pages/admin/Recruitment/SelectedCandidates";
import AdminTimeSheet from "./pages/admin/TimeSheet";
import AdminRequests from "./pages/admin/Reuests";
import AdminResignations from "./pages/admin/Resignations";
import EmployeeAnalytics from "./pages/admin/EmployeeAnalytics";

// employee
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeDetails from "./pages/employee/Details";
import EmployeeResign from './pages/employee/Resign';
import TimeSheetMaster from "./pages/employee/TimeSheet";
import EmployeeRequests from "./pages/employee/Request";

// manager
import ManagerTimesheetReview from "./pages/manager/TimeSheets";
import ManagerResignations from "./pages/manager/Resignations";

// leader
import LeaderTimesheet from "./pages/leader/TimeSheet";

// layouts
import LeaderLayout from "./components/layout/LeaderLayout";
import AdminLayout from "./components/layout/AdminLayout";
import EmployeeLayout from "./components/layout/EmployeeLayout";
import ManagerLayout from "./components/layout/ManagerLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* ==========================================================================
           1. ADMIN & HR ROUTING MODULE
           ========================================================================== */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={["admin", "hr"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="departments" element={<AdminDepartments />} />
          <Route path="adminleaves" element={<AdminLeaves />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="employeestatus" element={<AdminEmployeeStatus />} />
          <Route path="announcements" element={<AdminAnnouncement />} />
          <Route path="announcements-view" element={<Announcements />} />
          <Route path="announcements-view/:id" element={<Announcements />} />
          <Route path="clients" element={<AdminClient />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="/admin/Recruitment/candidates" element={<Candidates />} />
          <Route path="/admin/Recruitment/interviews" element={<InterviewPipeline />} />
          <Route path="/admin/Recruitment/selected" element={<SelectedCandidates />} />
          <Route path="/admin/timesheet" element={<AdminTimeSheet />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
          <Route path="/admin/resignations" element={<AdminResignations />} />
          <Route path="/admin/employees/analytics" element={<EmployeeAnalytics />} />
        </Route>

        {/* ==========================================================================
           2. STANDARD EMPLOYEE ROUTING MODULE
           ========================================================================== */}
        <Route 
          path="/employee" 
          element={
            <ProtectedRoute allowedRoles={["employee"]}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="details" element={<EmployeeDetails />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="announcements/:id" element={<Announcements />} />
          <Route path="resignation" element={<EmployeeResign />} />
          <Route path="timesheet" element={<TimeSheetMaster/>}/> 
          <Route path="requests" element={<EmployeeRequests />} />
        </Route>

        {/* ==========================================================================
           3. FIXED: SEPARATE MANAGER ROUTING MODULE (/manager/...)
           ========================================================================== */}
        <Route 
          path="/manager" 
          element = {
            <ProtectedRoute allowedRoles={["manager"]}>
              <ManagerLayout /> {/* FIXED: Uses separate manager shell with unique sidebar context */}
            </ProtectedRoute>
          }
        >
          {/* URL resolves perfectly to: /manager/timesheet */}
          <Route path="timesheet" element={<ManagerTimesheetReview />} />
          <Route path="resignations" element={<ManagerResignations />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="announcements/:id" element={<Announcements />} />
        </Route>

        <Route 
          path="/leader" 
          element={
            <ProtectedRoute allowedRoles={["leader"]}>
              <LeaderLayout />
            </ProtectedRoute>
          }
        >
          <Route path="timesheet" element={<LeaderTimesheet />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;