const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'announcement_events',
    password: process.env.DB_PASSWORD || '', // Falls back to empty if no password is set
    port: Number(process.env.DB_PORT || 5432),
    connectionTimeoutMillis: 5000
});

// Test the connection immediately on startup and print clear logs
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ DATABASE CONNECTION FAILED:');
        console.error(err.message);
        console.error('💡 TIP: Check your .env file to make sure DB_USER, DB_PASSWORD, and DB_NAME are correct.');
    } else {
        console.log('✅ DATABASE CONNECTED SUCCESSFULLY at:', res.rows[0].now);
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;