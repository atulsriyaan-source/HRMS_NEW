const express = require('express');
const path = require('path');
const router = express.Router();
const multer = require('multer');
const  { getAllEmployees, getAllDepartments, getAllLeaves, addLeaveType, getAllLeaveTypes, 
        addEmployee, getEmployeeById, updateEmployee, deleteEmployee, getEmployeeStatus, 
        addEmployeeStatus, updateEmployeeStatus, deleteEmployeeStatus, getAnnouncements, 
        addAnnouncement, updateAnnouncement, deleteAnnouncement, getAllSupervisors, getAllInDirectSupervisors,
      getClients, addClient, updateClient, deleteClient, getAllProjects, getProjectById,
     createProject, updateProject, deleteProject, getClientsLookup, getTeamTimesheets, getDashboardSummary } = require('../controllers/adminController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this directory exists in your root server folder
  },
  filename: (req, file, cb) => {
    // Generates a unique filename using timestamps to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/dashboard-summary', getDashboardSummary);
router.get('/employees', getAllEmployees);
router.get('/departments', getAllDepartments);
router.get('/leaves', getAllLeaves);
router.get('/leave-types', getAllLeaveTypes);
router.post('/leave-types', addLeaveType);
router.post('/employees', upload.single('Photo'), addEmployee);
router.put('/employees/:id', upload.single('Photo'), updateEmployee);
router.get('/employees/:id', getEmployeeById);
router.delete('/employees/:id', deleteEmployee);
router.get('/employee-statuses', getEmployeeStatus);
router.post('/employee-statuses', addEmployeeStatus);
router.put('/employee-statuses/:id', updateEmployeeStatus);
router.delete('/employee-statuses/:id', deleteEmployeeStatus);
router.get('/announcements', getAnnouncements);
router.post('/announcements', upload.single('Photo'), addAnnouncement);
router.put('/announcements/:id', upload.single('Photo'), updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);
router.get('/supervisors', getAllSupervisors)
router.get('/in-direct-supervisors', getAllInDirectSupervisors)
router.get('/clients', getClients);
router.post('/clients', addClient);
router.put('/clients/:id', updateClient);
router.delete('/clients/:id', deleteClient);

router.get('/projects', getAllProjects);
router.get('/projects/:id', getProjectById);
router.post('/projects', createProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);
router.get('/clients-lookup', getClientsLookup);
router.get('/timesheets', getTeamTimesheets)

module.exports = router;