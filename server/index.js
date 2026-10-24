require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');

const userRoutes = require('./Routes/userRoutes');
const pageRoutes = require('./Routes/pageRoutes'); 
const studentRoutes = require('./Routes/studentRoutes');
const mypageRegistrationRoutes = require('./Routes/mypageRegistrations');
const mypageAttendanceRoutes = require('./Routes/mypageAttendance');
const mypageNotificationRoutes = require('./Routes/mypageNotifications');
const adminRoutes = require('./Routes/adminRoutes');
const startAttendanceWorker = require('./Routes/attendanceWorker');

// ---- Global Middleware ----//
app.use(cors());
app.use(express.json());

// ---- Routes ----//
app.use('/api/users', userRoutes); 
app.use('/api', pageRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mypage/notifications', mypageNotificationRoutes);
app.use('/api/mypage/attendance', mypageAttendanceRoutes);
app.use('/api/mypage', mypageRegistrationRoutes);
app.use('/api/admin', adminRoutes);

// Root Health Check Route
app.get('/', (req, res) => {
    res.send('WMSU Announcement and Events API is running!');
});

// Fallback JSON 404 Handler (Prevents unexpected HTML <!DOCTYPE responses)
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Global Error Handler returning JSON
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
    // Auto-closes attendance windows whose scheduled close time has passed
    startAttendanceWorker();
});
