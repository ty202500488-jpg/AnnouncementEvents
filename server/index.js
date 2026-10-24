require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');
const userRoutes = require('./Routes/userRoutes');
const pageRoutes = require('./Routes/pageRoutes'); 
const studentRoutes = require('./Routes/studentRoutes');
const mypageRegistrationRoutes = require('./Routes/mypageRegistrations');

// ---- Global Middleware ----//
app.use(cors());
app.use(express.json());

// ---- Routes ----//
app.use('/api/users', userRoutes); 
app.use('/api', pageRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mypage', mypageRegistrationRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('WMSU Announcement and Events API is running!');
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});