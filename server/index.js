const express = require('express');
const app = express();
const cors = require('cors');
const pool = require('./db');
const userRoutes = require('./Routes/userRoutes');
const pageRoutes = require('./Routes/pageRoutes'); // Import your page routes

// ---- Middleware ----//
app.use(cors());
app.use(express.json()); //request.body

// ---- Routes ----//
app.use('/users', userRoutes); //user routes
app.use('/api', pageRoutes); // Registers your create-page endpoint at /api/create-page

// Test route
app.get('/', (req, res) => {
    res.send('WMSU Announcement and Events API is running!');
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});