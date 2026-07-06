const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const candidateRoutes = require("./routes/candidateRoutes");
const managerRoutes = require('./routes/managerRoutes');
const leaveRoutes = require("./routes/leaveRoutes");
const hrRoutes = require('./routes/hrRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const PORT = process.env.PORT || 5000;

const db = require('./config/db');

const app = express();

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors())
app.use(express.json())

// api
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/employee', employeeRoutes)
app.use("/api/candidates", candidateRoutes);
app.use('/api/manager', managerRoutes);
app.use("/api/leaves", leaveRoutes); 
app.use('/api/hr', hrRoutes);
app.use('/api/analytics', analyticsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

