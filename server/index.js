require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./db');

const userRoutes = require('./Routes/userRoutes');
const pageRoutes = require('./Routes/pageRoutes');
const studentRoutes = require('./Routes/studentRoutes');
const mypageRegistrationRoutes = require('./Routes/mypageRegistrations');
const mypageAttendanceRoutes = require('./Routes/mypageAttendance');
const mypageNotificationRoutes = require('./Routes/mypageNotifications');
const adminRoutes = require('./Routes/adminRoutes');
const { startAttendanceWorker } = require('./Routes/attendanceWorker');

// ---- Global Middleware ---- //
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// ---- Routes ---- //
// Mount userRoutes on both /api/users and /users so all frontend fetch paths resolve
app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

app.use('/api/student', studentRoutes);
app.use('/student', studentRoutes);
app.use('/api/mypage/attendance', mypageAttendanceRoutes);
app.use('/api/mypage', mypageRegistrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', mypageNotificationRoutes);
app.use('/api', pageRoutes);

// Root Health Check Route
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'WMSU Campus Portal API (Normalized 3NF PostgreSQL)',
        port: Number(process.env.PORT || 5000)
    });
});

// Fallback JSON 404 Handler
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler returning JSON
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack || err.message);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
    console.log(`🚀 WMSU Campus Portal Server running on http://localhost:${PORT}`);
    startAttendanceWorker();
});
