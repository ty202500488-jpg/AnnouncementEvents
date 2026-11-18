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

// ---- Global Security Headers & Middleware ---- //
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    next();
});

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
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

// Global Error Handler returning JSON without leaking internal stack traces
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err.stack || err.message);
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ message: 'Forbidden: Cross-origin request denied.' });
    }
    return res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = Number(process.env.PORT || 5000);
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 WMSU Campus Portal Server running on http://localhost:${PORT}`);
        startAttendanceWorker();
    });
}

module.exports = app;
